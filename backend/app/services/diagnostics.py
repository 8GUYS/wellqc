from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np

from backend.app.schemas.enums import DiagnosticCause, ImputationStrategy, ThresholdAction
from backend.app.schemas.imputation import CurveMetaPayload, MissingValueDiagnostic, WellInfoPayload
from backend.app.services.curve_utils import (  # noqa: F401  (is_null_value re-exported)
    NULL_CLUSTER_MIN_RUN,
    is_null_value,
    null_mask,
    to_float_array,
    true_runs,
)
from backend.app.services.standardiser import standardise_mnemonic

_SHOE_CURVES = {"DT", "DTS", "RT", "RM", "RHOB", "NPHI"}
_WASHOUT_CURVES = {"RHOB", "NPHI", "PEF", "DRHO", "DPHI"}
_WASHOUT_FRACTION = 0.3
_WASHOUT_RATIO = 1.2
_WASHOUT_MIN_EXTRA_INCHES = 2.0
_SHORT_GAP_SAMPLES = 5


def _std_key(mnemonic: str) -> str:
    r = standardise_mnemonic(mnemonic)
    return r.standardMnemonic if r.isAutoMatched else ""


def _hole_reference_inches(
    curves: Dict[str, List[float]], null_value: float
) -> Optional[Tuple[float, np.ndarray, np.ndarray]]:
    """(washout limit in inches, caliper in inches, valid mask) or None when there is no caliper."""
    cali_key = next((k for k in curves if _std_key(k) == "CALI"), None)
    if cali_key is None:
        return None
    cali = to_float_array(curves[cali_key]).copy()
    valid = ~null_mask(cali, null_value)
    if not valid.any():
        return None
    if float(np.median(cali[valid])) > 40.0:  # millimetres
        cali = cali / 25.4

    bs_key = next((k for k in curves if _std_key(k) == "BS"), None)
    ref = None
    if bs_key is not None:
        bs = to_float_array(curves[bs_key])
        bs_valid = ~null_mask(bs, null_value)
        if bs_valid.any():
            ref = float(np.median(bs[bs_valid]))
            if ref > 40.0:
                ref /= 25.4
    if ref is None:
        ref = float(np.percentile(cali[valid], 25))  # gauge-hole level
    limit = max(ref * _WASHOUT_RATIO, ref + _WASHOUT_MIN_EXTRA_INCHES)
    return limit, cali, valid


def diagnose_missing_value_causes(
    depth: List[float],
    curves: Dict[str, List[float]],
    curve_meta: List[CurveMetaPayload],
    well_info: WellInfoPayload,
) -> List[MissingValueDiagnostic]:
    total_points = len(depth)
    null_value = well_info.nullValue
    start_depth = well_info.startDepth
    stop_depth = well_info.stopDepth
    depth_span = abs(stop_depth - start_depth) or 1.0
    depth_arr = to_float_array(depth)

    hole = _hole_reference_inches(curves, null_value)

    diagnostics: List[MissingValueDiagnostic] = []

    for c_meta in curve_meta:
        raw = curves.get(c_meta.mnemonic, [])
        mask = null_mask(raw, null_value)
        null_idx = np.flatnonzero(mask)
        null_count = int(null_idx.size)
        null_percentage = (null_count / total_points * 100.0) if total_points > 0 else 0.0

        if null_count == 0:
            diagnostics.append(
                MissingValueDiagnostic(
                    curveMnemonic=c_meta.mnemonic,
                    totalPoints=total_points,
                    nullCount=0,
                    nullPercentage=0.0,
                    primaryCause=DiagnosticCause.UNKNOWN_SENSOR_GAP,
                    causeDescription="No missing values detected in log channel.",
                    recommendedStrategy=ImputationStrategy.LINEAR,
                    recommendedThresholdAction=ThresholdAction.NO_ACTION_NEEDED,
                )
            )
            continue

        valid_idx = np.flatnonzero(~mask)
        runs = true_runs(mask)
        longest_run = max((e - s for s, e in runs), default=0)

        if valid_idx.size == 0:
            diagnostics.append(
                MissingValueDiagnostic(
                    curveMnemonic=c_meta.mnemonic,
                    totalPoints=total_points,
                    nullCount=null_count,
                    nullPercentage=null_percentage,
                    primaryCause=DiagnosticCause.UNKNOWN_SENSOR_GAP,
                    causeDescription="Channel contains no valid samples; there is nothing to impute from.",
                    recommendedStrategy=ImputationStrategy.LINEAR,
                    recommendedThresholdAction=ThresholdAction.NO_ACTION_NEEDED,
                )
            )
            continue

        in_range = null_idx[null_idx < depth_arr.size]
        shallow = int(np.sum(np.abs(depth_arr[in_range] - start_depth) < depth_span * 0.08))
        deep = int(np.sum(np.abs(depth_arr[in_range] - stop_depth) < depth_span * 0.08))

        std = _std_key(c_meta.mnemonic)

        primary_cause: DiagnosticCause = DiagnosticCause.UNKNOWN_SENSOR_GAP
        cause_description = "General telemetry gap or isolated missing sample readings."
        decided = False

        # A. Casing shoe boundary
        if shallow / null_count > 0.6 and std in _SHOE_CURVES:
            primary_cause = DiagnosticCause.CASING_SHOE_BOUNDARY
            cause_description = (
                f"Null values concentrated near casing shoe / shallow interval "
                f"({start_depth:.1f} {well_info.depthUnit}). Sensors reading casing metal "
                f"or mud column instead of formation."
            )
            decided = True

        # B. Borehole washout (only when it actually explains the nulls)
        if not decided and hole is not None and std in _WASHOUT_CURVES:
            limit, cali, cali_valid = hole
            washed = [
                i for i in null_idx
                if i < cali.size and cali_valid[i] and cali[i] > limit
            ]
            if len(washed) / null_count > _WASHOUT_FRACTION:
                primary_cause = DiagnosticCause.BOREHOLE_WASHOUT
                cause_description = (
                    f"Null or invalid sensor readings correlate with borehole enlargement "
                    f"(caliper above {limit:.1f} in), causing tool pad contact loss."
                )
                decided = True

        # C. Off-bottom window
        if not decided and deep / null_count > 0.6:
            primary_cause = DiagnosticCause.OFF_BOTTOM_WINDOW
            cause_description = (
                f"Null readings at bottom hole interval ({stop_depth:.1f} "
                f"{well_info.depthUnit}) due to tool pickup or survey cutoff."
            )
            decided = True

        # D. Telemetry dropout: one extended consecutive run
        if not decided and longest_run >= NULL_CLUSTER_MIN_RUN:
            primary_cause = DiagnosticCause.TELEMETRY_DROPOUT
            cause_description = (
                f"Extended cluster of {longest_run} consecutive missing samples caused by "
                f"sensor signal dropout or telemetry interruption."
            )

        first_valid, last_valid = int(valid_idx[0]), int(valid_idx[-1])
        interior_nulls = int(np.sum((null_idx > first_valid) & (null_idx < last_valid)))

        if null_percentage < 2.0 and interior_nulls == 0:
            threshold_action = ThresholdAction.DROP_ROWS
            strategy = ImputationStrategy.ROW_DROPPING
            cause_description += (
                f" The {null_percentage:.2f}% missing samples are all at the start or end of the log, "
                f"so trimming those rows removes no interior data (rows are removed for every curve)."
            )
        elif longest_run <= _SHORT_GAP_SAMPLES and null_percentage < 25.0:
            threshold_action = ThresholdAction.APPLY_IMPUTATION
            strategy = ImputationStrategy.LINEAR
            cause_description += " Gaps are short, so linear interpolation is accurate and cheap."
        else:
            threshold_action = ThresholdAction.APPLY_IMPUTATION
            strategy = ImputationStrategy.KNN

        diagnostics.append(
            MissingValueDiagnostic(
                curveMnemonic=c_meta.mnemonic,
                totalPoints=total_points,
                nullCount=null_count,
                nullPercentage=null_percentage,
                primaryCause=primary_cause,
                causeDescription=cause_description,
                recommendedStrategy=strategy,
                recommendedThresholdAction=threshold_action,
            )
        )

    return diagnostics
