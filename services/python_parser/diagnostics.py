"""
Port of diagnoseMissingValueCauses() from src/lib/las/imputation-engine.ts.

Kept as a line-by-line mirror of the TS logic (same thresholds, same
ordering of checks) so DA2's diagnostics never silently diverge between
the client-side TS path and this service.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from .models import CurveMeta, MissingValueDiagnostic, WellInfo

# Standard LAS null sentinels the TS side also treats as null (see isNullValue)
_HARD_NULL_SENTINELS = {-999.25, -9999.0, 999.25, -999.9}


def is_null_value(val: Optional[float], null_value: float) -> bool:
    if val is None:
        return True
    try:
        fval = float(val)
    except (TypeError, ValueError):
        return True
    if fval != fval or fval in (float("inf"), float("-inf")):  # NaN / Inf
        return True
    if abs(fval - null_value) < 0.01:
        return True
    if fval in _HARD_NULL_SENTINELS:
        return True
    return False


def diagnose_missing_value_causes(
    depth: List[float],
    curves: Dict[str, List[float]],
    curve_meta: List[CurveMeta],
    well_info: WellInfo,
) -> List[MissingValueDiagnostic]:
    total_points = len(depth)
    null_value = well_info.nullValue
    start_depth = well_info.startDepth
    stop_depth = well_info.stopDepth
    depth_span = abs(stop_depth - start_depth) or 1.0

    cali_key = next(
        (k for k in curves.keys() if "CAL" in k.upper() or "CDEV" in k.upper()),
        None,
    )
    cali_values = curves.get(cali_key) if cali_key else None

    diagnostics: List[MissingValueDiagnostic] = []

    for c_meta in curve_meta:
        raw_values = curves.get(c_meta.mnemonic, [])
        null_indices: List[int] = [
            idx for idx, v in enumerate(raw_values) if is_null_value(v, null_value)
        ]
        null_count = len(null_indices)
        null_percentage = (null_count / total_points * 100) if total_points > 0 else 0.0

        if null_count == 0:
            diagnostics.append(
                MissingValueDiagnostic(
                    curveMnemonic=c_meta.mnemonic,
                    totalPoints=total_points,
                    nullCount=0,
                    nullPercentage=0.0,
                    primaryCause="UNKNOWN_SENSOR_GAP",
                    causeDescription="No missing values detected in log channel.",
                    recommendedStrategy="LINEAR",
                    recommendedThresholdAction="NO_ACTION_NEEDED",
                )
            )
            continue

        primary_cause = "UNKNOWN_SENSOR_GAP"
        cause_description = "General telemetry gap or isolated missing sample readings."

        shallow_nulls = [
            idx for idx in null_indices if abs(depth[idx] - start_depth) < depth_span * 0.08
        ]
        deep_nulls = [
            idx for idx in null_indices if abs(depth[idx] - stop_depth) < depth_span * 0.08
        ]

        mnemonic_upper = c_meta.mnemonic.upper()

        # A. Casing Shoe Boundary Check
        if (len(shallow_nulls) / null_count > 0.6) and mnemonic_upper in (
            "DT", "RT", "RHOB", "NPHI", "AT40",
        ):
            primary_cause = "CASING_SHOE_BOUNDARY"
            cause_description = (
                f"Null values concentrated near casing shoe / shallow interval "
                f"({start_depth:.1f} {well_info.depthUnit}). Sensors reading casing metal "
                f"or mud column instead of formation."
            )
        # B. Borehole Washout Check
        elif cali_values is not None and any(
            tag in mnemonic_upper for tag in ("RHOB", "NPHI", "PEF")
        ):
            washout_nulls = [
                idx
                for idx in null_indices
                if idx < len(cali_values)
                and cali_values[idx] is not None
                and cali_values[idx] > 15.5
                and not is_null_value(cali_values[idx], null_value)
            ]
            if len(washout_nulls) / null_count > 0.3:
                primary_cause = "BOREHOLE_WASHOUT"
                cause_description = (
                    "Null or invalid sensor readings correlate with severe borehole "
                    "enlargement (caliper > 15.5 in), causing tool pad contact loss."
                )
        # C. Off-Bottom Window Check
        elif len(deep_nulls) / null_count > 0.6:
            primary_cause = "OFF_BOTTOM_WINDOW"
            cause_description = (
                f"Null readings at bottom hole interval ({stop_depth:.1f} "
                f"{well_info.depthUnit}) due to tool pickup or survey cutoff."
            )
        # D. Telemetry Dropout Check
        elif null_count >= 15:
            primary_cause = "TELEMETRY_DROPOUT"
            cause_description = (
                f"Extended cluster of {null_count} missing samples caused by sensor "
                f"signal dropout or telemetry interruption."
            )

        recommended_strategy = "KNN"
        recommended_threshold_action = "APPLY_IMPUTATION"

        if null_percentage < 2.0:
            recommended_threshold_action = "DROP_ROWS"
            recommended_strategy = "ROW_DROPPING"
            cause_description += (
                f" Low missing percentage ({null_percentage:.2f}%) qualifies for "
                f"listwise row deletion without affecting petrophysical statistics."
            )
        elif "DT" in mnemonic_upper or "SONIC" in mnemonic_upper:
            recommended_strategy = "KNN"
        elif null_percentage > 25.0:
            recommended_strategy = "KNN"

        diagnostics.append(
            MissingValueDiagnostic(
                curveMnemonic=c_meta.mnemonic,
                totalPoints=total_points,
                nullCount=null_count,
                nullPercentage=null_percentage,
                primaryCause=primary_cause,
                causeDescription=cause_description,
                recommendedStrategy=recommended_strategy,
                recommendedThresholdAction=recommended_threshold_action,
            )
        )

    return diagnostics