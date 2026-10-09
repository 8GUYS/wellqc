from __future__ import annotations

from typing import Dict, List, Optional, Set

import numpy as np
from pydantic import BaseModel

from backend.app.services.curve_utils import (
    FLATLINE_EXEMPT,
    FLATLINE_MIN_RUN,
    NULL_CLUSTER_MIN_RUN,
    NULL_REPORT_MIN_RUN,
    SPIKE_SIGMA,
    SONIC_CURVES,
    find_cycle_skips,
    find_flatline_runs,
    find_spikes,
    null_mask,
    to_float_array,
    true_runs,
)
from backend.app.services.parser import ParsedLAS
from backend.app.services.standardiser import (
    CustomAliasEntry,
    STANDARD_CURVES,
    convert_series_to_standard_unit,
    standardise_mnemonic,
)

EXPECTED_KEY_CURVES = ["GR", "RHOB", "NPHI", "DT", "RT", "CALI"]

# Every anomaly found is reported and counted. Scoring is where the limits are: each kind of
# penalty has a ceiling, so one badly damaged curve cannot drive a score to 0 on its own.
# Curve score = 100 - null penalty - critical penalty - warning penalty (never below 0).
SEVERITY_PENALTY = {"CRITICAL": 15.0, "WARNING": 8.0, "INFO": 0.0}        # points per anomaly
SEVERITY_PENALTY_CAP = {"CRITICAL": 75.0, "WARNING": 40.0, "INFO": 0.0}   # most a curve can lose
NULL_PENALTY_PER_PERCENT = 0.5      # points per 1% of the curve that is empty
NULL_PENALTY_CAP = 30.0
# Well-level parts
MISSING_CURVE_PENALTY = 12.0        # completeness: per missing key curve
NULL_CLUSTER_PENALTY = 5.0          # completeness: per long run of missing data
NULL_CLUSTER_PENALTY_CAP = 30.0
CONSISTENCY_CRITICAL_PENALTY = 12.0
CONSISTENCY_CRITICAL_CAP = 60.0
CONSISTENCY_WARNING_PENALTY = 4.0
CONSISTENCY_WARNING_CAP = 40.0


class AnomalyReportItem(BaseModel):
    id: Optional[str] = None
    curveMnemonic: str
    depthStart: float
    depthEnd: float
    anomalyType: str
    severity: str  # 'CRITICAL' | 'WARNING' | 'INFO'
    description: str
    suggestedCorrection: str


class CurveHealthSummary(BaseModel):
    mnemonic: str
    standardMnemonic: str
    unit: str
    nullCount: int
    totalPoints: int
    nullPercentage: float
    minVal: Optional[float] = None
    maxVal: Optional[float] = None
    meanVal: Optional[float] = None
    healthScore: int
    status: str  # 'EXCELLENT' | 'GOOD' | 'POOR' | 'CRITICAL'
    anomalies: List[AnomalyReportItem]


class QualityAnalysisResult(BaseModel):
    overallScore: int
    qualityGrade: str  # 'EXCELLENT' | 'GOOD' | 'POOR' | 'CRITICAL'
    completenessScore: int
    consistencyScore: int
    anomalyCount: int
    criticalCount: int
    warningCount: int
    curveSummaries: List[CurveHealthSummary]
    anomalies: List[AnomalyReportItem]
    missingStandardCurves: List[str]
    # True totals (nothing is capped). Optional extras for the page and the report.
    infoCount: int = 0
    anomalyCountsByType: Dict[str, int] = {}
    anomaliesPer1000Samples: float = 0.0


def _grade(score: float) -> str:
    if score < 50:
        return "CRITICAL"
    if score < 75:
        return "POOR"
    if score < 90:
        return "GOOD"
    return "EXCELLENT"


def _curve_penalty(null_percentage: float, curve_anoms: List[AnomalyReportItem]) -> float:
    """Points lost by one curve. Every anomaly counts; each kind of penalty has a ceiling."""
    penalty = min(NULL_PENALTY_CAP, null_percentage * NULL_PENALTY_PER_PERCENT)
    for severity, per_item in SEVERITY_PENALTY.items():
        n = sum(1 for a in curve_anoms if a.severity == severity)
        penalty += min(SEVERITY_PENALTY_CAP[severity], n * per_item)
    return penalty


def _depth_anomalies(las: ParsedLAS, depth: np.ndarray) -> List[AnomalyReportItem]:
    items: List[AnomalyReportItem] = []
    unit = las.wellInfo.depthUnit

    # Rows the parser flagged as having a null/invalid depth: report them once, then leave
    # them out of the duplicate/step/gap checks so they cannot cause false depth gaps.
    flagged = sorted({i for i in las.nullDepthRows if 0 <= i < depth.size})
    if flagged:
        keep = np.ones(depth.size, dtype=bool)
        keep[flagged] = False
        valid_depth = depth[keep]
        first = flagged[0]
        before = depth[:first][keep[:first]]
        after = depth[first + 1 :][keep[first + 1 :]]
        d_start = float(before[-1]) if before.size else (float(valid_depth[0]) if valid_depth.size else 0.0)
        d_end = float(after[0]) if after.size else d_start
        rows_txt = ", ".join(str(i + 1) for i in flagged[:10]) + (" ..." if len(flagged) > 10 else "")
        items.append(
            AnomalyReportItem(
                curveMnemonic="DEPT",
                depthStart=d_start,
                depthEnd=d_end,
                anomalyType="NULL_DEPTH",
                severity="WARNING",
                description=f"{len(flagged)} data row(s) have a null or invalid depth (row {rows_txt}).",
                suggestedCorrection="Check the depth column; the row is kept in the file and left out of the depth checks.",
            )
        )
        depth = valid_depth

    if depth.size < 2:
        return items
    steps = np.diff(depth)
    step_ref = abs(las.wellInfo.step)
    if step_ref == 0.0:
        nz = np.abs(steps[np.abs(steps) > 1e-9])
        step_ref = float(np.median(nz)) if nz.size else 0.0

    dup_idx = np.flatnonzero(np.abs(steps) < 0.0001) + 1
    for i in dup_idx:
        d = float(depth[i])
        items.append(
            AnomalyReportItem(
                curveMnemonic="DEPT",
                depthStart=d,
                depthEnd=d,
                anomalyType="DUPLICATE_DEPTH",
                severity="CRITICAL",
                description=f"Duplicate depth value detected at {d} {unit}",
                suggestedCorrection="Remove duplicate depth index row.",
            )
        )

    if step_ref > 0.0:
        gap_idx = np.flatnonzero((np.abs(steps) > step_ref * 3) & (np.abs(steps) >= 0.0001)) + 1
        gaps: List[AnomalyReportItem] = []
        for i in gap_idx:
            d_prev, d_curr = float(depth[i - 1]), float(depth[i])
            gaps.append(
                AnomalyReportItem(
                    curveMnemonic="DEPT",
                    depthStart=d_prev,
                    depthEnd=d_curr,
                    anomalyType="DEPTH_GAP",
                    severity="WARNING",
                    description=f"Unexplained depth gap of {abs(d_curr - d_prev):.2f} {unit} between {d_prev} and {d_curr}",
                    suggestedCorrection="Perform linear depth interpolation or verify raw tool telemetry log.",
                )
            )
        items.extend(gaps)
    return items


def analyze_well_log_quality(
    las: ParsedLAS,
    custom_aliases: Optional[List[CustomAliasEntry]] = None,
) -> QualityAnalysisResult:
    depth = to_float_array(las.data.depth)
    null_value = las.wellInfo.nullValue
    total_points = int(depth.size)
    depth_unit = las.wellInfo.depthUnit

    anomalies: List[AnomalyReportItem] = _depth_anomalies(las, depth)
    curve_summaries: List[CurveHealthSummary] = []
    present_standard: Set[str] = set()
    null_cluster_total = 0

    for c_meta in las.curves:
        raw = to_float_array(las.data.curves.get(c_meta.mnemonic, []))
        if raw.size < total_points:  # short column: the missing tail is missing data
            raw = np.concatenate([raw, np.full(total_points - raw.size, np.nan)])
        raw = raw[:total_points]
        nulls = null_mask(raw, null_value)

        std_res = standardise_mnemonic(c_meta.mnemonic, c_meta.unit, custom_aliases)
        std_key = std_res.standardMnemonic if std_res.isAutoMatched else ""
        std_def = STANDARD_CURVES.get(std_key)
        if std_key:
            present_standard.add(std_key)

        curve_anoms: List[AnomalyReportItem] = []

        if c_meta.originalMnemonic:
            curve_anoms.append(
                AnomalyReportItem(
                    curveMnemonic=c_meta.mnemonic,
                    depthStart=las.wellInfo.startDepth,
                    depthEnd=las.wellInfo.stopDepth,
                    anomalyType="DUPLICATE_CURVE",
                    severity="WARNING",
                    description=(
                        f"The header lists {c_meta.originalMnemonic} more than once; "
                        f"this copy was loaded as {c_meta.mnemonic}."
                    ),
                    suggestedCorrection=(
                        f"Check which tool run each {c_meta.originalMnemonic} channel came from, keep the primary one "
                        "and rename or drop the other."
                    ),
                )
            )

        if not std_res.isAutoMatched:
            curve_anoms.append(
                AnomalyReportItem(
                    curveMnemonic=c_meta.mnemonic,
                    depthStart=las.wellInfo.startDepth,
                    depthEnd=las.wellInfo.stopDepth,
                    anomalyType="NON_STANDARD_MNEMONIC",
                    severity="INFO",
                    description=f"Mnemonic {c_meta.mnemonic} is not in the standard curve dictionary.",
                    suggestedCorrection=(
                        "If this is a known equivalent of a standard curve, add a custom alias on the "
                        "Standardisation page; otherwise it is kept as a custom curve."
                    ),
                )
            )

        if std_res.unitMismatch:
            curve_anoms.append(
                AnomalyReportItem(
                    curveMnemonic=c_meta.mnemonic,
                    depthStart=las.wellInfo.startDepth,
                    depthEnd=las.wellInfo.stopDepth,
                    anomalyType="UNIT_MISMATCH",
                    severity="WARNING",
                    description=f"Curve {c_meta.mnemonic} unit '{c_meta.unit}' does not match standard unit '{std_res.standardUnit}'",
                    suggestedCorrection=f"Convert unit from {c_meta.unit} to {std_res.standardUnit}.",
                )
            )

        # One conversion decision for the whole curve.
        valid_raw = raw[~nulls]
        if std_def is not None:
            conv = convert_series_to_standard_unit(raw.tolist(), c_meta.unit, std_key, null_value)
            values = np.asarray(conv.values, dtype=float)
            unit_label = std_def.standardUnit if conv.converted else c_meta.unit
            if conv.inferred:
                curve_anoms.append(
                    AnomalyReportItem(
                        curveMnemonic=c_meta.mnemonic,
                        depthStart=las.wellInfo.startDepth,
                        depthEnd=las.wellInfo.stopDepth,
                        anomalyType="UNIT_INFERRED",
                        severity="INFO",
                        description=f"Curve {c_meta.mnemonic} has no recognised unit; values were treated as {std_def.standardUnit} after rescaling by {conv.factor:g} based on their magnitude.",
                        suggestedCorrection=f"Confirm the unit in the LAS header and set it to the actual unit ({std_def.standardUnit} expected).",
                    )
                )
        else:
            values = raw
            unit_label = c_meta.unit

        null_count = int(nulls.sum())
        null_percentage = (null_count / total_points * 100.0) if total_points > 0 else 0.0

        # Only nulls BETWEEN valid readings are reported. Nulls at the very START or END of a
        # curve (tool not logging yet / already stopped) are normal and are not flagged or
        # penalised (they still show in the null % column). 10+ in a row = WARNING cluster,
        # 1-9 = INFO (0 points). A curve that is empty everywhere is still a real problem.
        all_runs = [(s, e) for s, e in true_runs(nulls) if e - s >= NULL_REPORT_MIN_RUN]
        has_valid = null_count < len(nulls)
        edge_runs = [(s, e) for s, e in all_runs if has_valid and (s == 0 or e == len(nulls))]
        runs = [r for r in all_runs if r not in edge_runs]
        null_cluster_total += sum(1 for s, e in runs if e - s >= NULL_CLUSTER_MIN_RUN)
        interior_null_count = sum(e - s for s, e in runs if e - s >= NULL_CLUSTER_MIN_RUN)  # short gaps (1-9) are listed but cost no points
        cluster_items = [
            AnomalyReportItem(
                curveMnemonic=c_meta.mnemonic,
                depthStart=float(depth[s]),
                depthEnd=float(depth[e - 1]),
                anomalyType="NULL_CLUSTER",
                severity="WARNING" if e - s >= NULL_CLUSTER_MIN_RUN else "INFO",
                description=(
                    f"Missing-data cluster of {e - s} consecutive samples."
                    if e - s >= NULL_CLUSTER_MIN_RUN
                    else (
                        "Isolated missing value (1 sample)."
                        if e - s == 1
                        else f"Short missing-data gap of {e - s} consecutive samples."
                    )
                ),
                suggestedCorrection=(
                    "Review the acquisition interval and retain the samples as null if recovery is not defensible."
                    if e - s >= NULL_CLUSTER_MIN_RUN
                    else "Short gap; can be interpolated if the curve is continuous here."
                ),
            )
            for s, e in runs
        ]
        curve_anoms.extend(cluster_items)

        # Statistics in the curve's own unit (matches the stored unit label)
        min_val = max_val = mean_val = None
        if valid_raw.size:
            min_val = float(valid_raw.min())
            max_val = float(valid_raw.max())
            mean_val = float(valid_raw.mean())

            valid_conv = values[~nulls]

            # A. Hard physical limits -> CRITICAL, grouped into intervals
            if std_def is not None:
                with np.errstate(invalid="ignore"):
                    impossible = ~nulls & ((values < std_def.minPhysical) | (values > std_def.maxPhysical))
                imp_runs = true_runs(impossible)
                imp_items: List[AnomalyReportItem] = []
                for s, e in imp_runs:
                    seg = values[s:e]
                    d0, d1 = float(depth[s]), float(depth[e - 1])
                    if e - s == 1:
                        desc = (
                            f"Physically impossible value {seg[0]:.2f} {unit_label} at depth {d0} "
                            f"(expected {std_def.minPhysical}–{std_def.maxPhysical})"
                        )
                    else:
                        desc = (
                            f"{e - s} consecutive physically impossible values ({seg.min():.2f} to {seg.max():.2f} {unit_label}) "
                            f"between {d0} and {d1} (expected {std_def.minPhysical}–{std_def.maxPhysical})"
                        )
                    imp_items.append(
                        AnomalyReportItem(
                            curveMnemonic=c_meta.mnemonic,
                            depthStart=d0,
                            depthEnd=d1,
                            anomalyType="IMPOSSIBLE_VALUE",
                            severity="CRITICAL",
                            description=desc,
                            suggestedCorrection=(
                                f"Clip value to physical limits or flag as null ({null_value})."
                                if null_value is not None
                                else "Clip value to physical limits or flag as null (no NULL marker declared)."
                            ),
                        )
                    )
                curve_anoms.extend(imp_items)

            # B. Spikes (shared definition with the cleaner)
            # Spikes and cycle skips are checked on the sonic log (DT) only.
            is_sonic = std_key in SONIC_CURVES
            skip_runs = find_cycle_skips(values, nulls) if is_sonic else []
            spike_idx = find_spikes(values, nulls, SPIKE_SIGMA) if is_sonic else np.array([], dtype=int)
            if skip_runs and spike_idx.size:
                in_skip = np.zeros(len(values), dtype=bool)
                for a0, b0 in skip_runs:
                    in_skip[a0:b0] = True
                spike_idx = spike_idx[~in_skip[spike_idx]]
            spike_items = [
                AnomalyReportItem(
                    curveMnemonic=c_meta.mnemonic,
                    depthStart=float(depth[i]),
                    depthEnd=float(depth[i]),
                    anomalyType="EXTREME_SPIKE",
                    severity="WARNING",
                    description=f"Unrealistic spike value {values[i]:.2f} detected at depth {float(depth[i])} {depth_unit}",
                    suggestedCorrection="Apply median despiking filter across 5-point window.",
                )
                for i in spike_idx
            ]
            curve_anoms.extend(spike_items)

            for s0, e0 in skip_runs:
                d0, d1 = float(depth[s0]), float(depth[e0 - 1])
                curve_anoms.append(
                    AnomalyReportItem(
                        curveMnemonic=c_meta.mnemonic,
                        depthStart=d0,
                        depthEnd=d1,
                        anomalyType="CYCLE_SKIP",
                        severity="WARNING",
                        description=f"Probable sonic cycle skip over {e0 - s0} samples ({d0} to {d1} {depth_unit}): readings are unusually slow compared with the surrounding log.",
                        suggestedCorrection="Treat this interval as unreliable; null it and re-interpolate, or re-pick the sonic transit times.",
                    )
                )

            # C. Flatlines (stuck sensor)
            if std_key not in FLATLINE_EXEMPT and valid_conv.size:
                for s, e in find_flatline_runs(values, nulls, FLATLINE_MIN_RUN):
                    d0, d1 = float(depth[s]), float(depth[e - 1])
                    curve_anoms.append(
                        AnomalyReportItem(
                            curveMnemonic=c_meta.mnemonic,
                            depthStart=d0,
                            depthEnd=d1,
                            anomalyType="FLATLINE",
                            severity="WARNING",
                            description=f"Stuck/flatline sensor output detected over {e - s} steps ({d0} to {d1} {depth_unit})",
                            suggestedCorrection="Mark flatline depth interval as unreliable sensor telemetry.",
                        )
                    )

        interior_pct = (interior_null_count / total_points * 100.0) if total_points > 0 else 0.0
        penalty = _curve_penalty(interior_pct, curve_anoms)
        health_score = max(0, min(100, round(100.0 - penalty)))

        curve_summaries.append(
            CurveHealthSummary(
                mnemonic=c_meta.mnemonic,
                standardMnemonic=std_res.standardMnemonic,
                unit=c_meta.unit,
                nullCount=null_count,
                totalPoints=total_points,
                nullPercentage=null_percentage,
                minVal=min_val,
                maxVal=max_val,
                meanVal=mean_val,
                healthScore=health_score,
                status=_grade(health_score),
                anomalies=curve_anoms,
            )
        )
        anomalies.extend(curve_anoms)

    # Missing key curves
    missing = [c for c in EXPECTED_KEY_CURVES if c not in present_standard]
    for curve in missing:
        anomalies.append(
            AnomalyReportItem(
                curveMnemonic=curve,
                depthStart=las.wellInfo.startDepth,
                depthEnd=las.wellInfo.stopDepth,
                anomalyType="MISSING_CORE_CURVE",
                severity="WARNING",
                description=f"Core standard petrophysical curve {curve} is absent from this well log dataset.",
                suggestedCorrection="Synthesize channel via multi-log empirical regression or KNN estimation.",
            )
        )

    for i, a in enumerate(anomalies):
        if not a.id:
            a.id = f"anom-{a.curveMnemonic}-{a.anomalyType}-{round(a.depthStart or 0.0)}-{i}"

    # Aggregate scores. All anomalies are counted; the ceilings keep one problem area from
    # zeroing the whole well.
    completeness = max(
        0,
        round(
            100.0
            - (
                len(missing) * MISSING_CURVE_PENALTY
                + min(NULL_CLUSTER_PENALTY_CAP, null_cluster_total * NULL_CLUSTER_PENALTY)
            )
        ),
    )
    avg_health = (
        sum(c.healthScore for c in curve_summaries) / len(curve_summaries) if curve_summaries else 50.0
    )
    critical_count = sum(1 for a in anomalies if a.severity == "CRITICAL")
    warning_count = sum(1 for a in anomalies if a.severity == "WARNING")
    info_count = sum(1 for a in anomalies if a.severity == "INFO")
    consistency = max(
        0,
        round(
            100.0
            - min(CONSISTENCY_CRITICAL_CAP, critical_count * CONSISTENCY_CRITICAL_PENALTY)
            - min(CONSISTENCY_WARNING_CAP, warning_count * CONSISTENCY_WARNING_PENALTY)
        ),
    )
    overall = max(0, min(100, round(avg_health * 0.5 + completeness * 0.3 + consistency * 0.2)))

    counts_by_type: Dict[str, int] = {}
    for a in anomalies:
        counts_by_type[a.anomalyType] = counts_by_type.get(a.anomalyType, 0) + 1
    per_1000 = round(len(anomalies) / total_points * 1000.0, 2) if total_points > 0 else 0.0

    return QualityAnalysisResult(
        overallScore=overall,
        qualityGrade=_grade(overall),
        completenessScore=completeness,
        consistencyScore=consistency,
        anomalyCount=len(anomalies),
        criticalCount=critical_count,
        warningCount=warning_count,
        curveSummaries=curve_summaries,
        anomalies=anomalies,
        missingStandardCurves=missing,
        infoCount=info_count,
        anomalyCountsByType=counts_by_type,
        anomaliesPer1000Samples=per_1000,
    )