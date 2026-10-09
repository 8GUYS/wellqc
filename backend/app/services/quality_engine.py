from __future__ import annotations
import math
from typing import Dict, List, Optional, Set
import numpy as np
from pydantic import BaseModel
from backend.app.services.curve_utils import is_null_value, null_mask
from backend.app.services.parser import ParsedLAS
from backend.app.services.standardiser import (
    CustomAliasEntry,
    STANDARD_CURVES,
    convert_to_standard_unit,
    standardise_mnemonic,
)

from backend.app.schemas.enums import AnomalySeverity, QualityGrade

class AnomalyReportItem(BaseModel):
    id: Optional[str] = None
    curveMnemonic: str
    depthStart: float
    depthEnd: float
    anomalyType: str
    severity: AnomalySeverity
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
    status: QualityGrade
    anomalies: List[AnomalyReportItem]

class QualityAnalysisResult(BaseModel):
    overallScore: int
    qualityGrade: QualityGrade
    completenessScore: int
    consistencyScore: int
    anomalyCount: int
    criticalCount: int
    warningCount: int
    curveSummaries: List[CurveHealthSummary]
    anomalies: List[AnomalyReportItem]
    missingStandardCurves: List[str]


def analyze_well_log_quality(
    las: ParsedLAS,
    custom_aliases: Optional[List[CustomAliasEntry]] = None,
) -> QualityAnalysisResult:
    depth_array = las.data.depth
    null_value = las.wellInfo.nullValue
    total_points = len(depth_array)
    anomalies: List[AnomalyReportItem] = []
    curve_summaries: List[CurveHealthSummary] = []

    # 1. Check Depth Sequence & Gaps
    null_depth_rows_set = set(las.nullDepthRows or [])
    if las.nullDepthRows:
        valid_bad_depths = [depth_array[r] for r in las.nullDepthRows if r < len(depth_array)]
        d_start = min(valid_bad_depths) if valid_bad_depths else (las.wellInfo.startDepth or 0.0)
        d_end = max(valid_bad_depths) if valid_bad_depths else (las.wellInfo.stopDepth or 0.0)
        anomalies.append(
            AnomalyReportItem(
                curveMnemonic="DEPT",
                depthStart=d_start,
                depthEnd=d_end,
                anomalyType="NULL_DEPTH",
                severity="CRITICAL",
                description=f"Null or invalid depth value detected at {len(las.nullDepthRows)} row(s).",
                suggestedCorrection="Remove or repair rows with missing depth coordinates.",
            )
        )

    valid_depth_indices = [i for i in range(len(depth_array)) if i not in null_depth_rows_set]
    duplicate_depth_count = 0
    step_val = abs(las.wellInfo.step or 0.0)

    for k in range(1, len(valid_depth_indices)):
        prev_i = valid_depth_indices[k - 1]
        curr_i = valid_depth_indices[k]
        d_prev = depth_array[prev_i]
        d_curr = depth_array[curr_i]
        step = d_curr - d_prev
        index_diff = curr_i - prev_i

        if abs(step) < 0.0001:
            duplicate_depth_count += 1
            if duplicate_depth_count <= 5:
                anomalies.append(
                    AnomalyReportItem(
                        curveMnemonic="DEPT",
                        depthStart=d_curr,
                        depthEnd=d_curr,
                        anomalyType="DUPLICATE_DEPTH",
                        severity="CRITICAL",
                        description=f"Duplicate depth value detected at {d_curr} {las.wellInfo.depthUnit}",
                        suggestedCorrection="Remove duplicate depth index row.",
                    )
                )
        elif step_val > 0 and step > step_val * max(index_diff, 1) * 3:
            anomalies.append(
                AnomalyReportItem(
                    curveMnemonic="DEPT",
                    depthStart=d_prev,
                    depthEnd=d_curr,
                    anomalyType="DEPTH_GAP",
                    severity="WARNING",
                    description=f"Unexplained depth gap of {d_curr - d_prev:.2f} {las.wellInfo.depthUnit} between {d_prev} and {d_curr}",
                    suggestedCorrection="Perform linear depth interpolation or verify raw tool telemetry log.",
                )
            )

    # 2. Track Standard Curves Inventory
    present_standard_mnemonics: Set[str] = set()
    expected_key_curves = ["GR", "RHOB", "NPHI", "DT", "RT", "CALI"]

    # 3. Process Each Curve Channel
    for c_meta in las.curves:
        raw_values = las.data.curves.get(c_meta.mnemonic, [])
        std_res = standardise_mnemonic(c_meta.mnemonic, c_meta.unit, custom_aliases)

        if std_res.standardMnemonic != "UNKNOWN":
            present_standard_mnemonics.add(std_res.standardMnemonic)

        curve_anomalies: List[AnomalyReportItem] = []

        if std_res.unitMismatch:
            curve_anomalies.append(
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

        # Filter non-null values
        valid_points: List[dict] = []
        null_count = 0

        for idx, v in enumerate(raw_values):
            if is_null_value(v, null_value):
                null_count += 1
            else:
                conv_val, _ = convert_to_standard_unit(v, c_meta.unit, std_res.standardMnemonic)
                valid_points.append({
                    "depth": depth_array[idx] if idx < len(depth_array) else 0.0,
                    "val": conv_val,
                    "idx": idx,
                })

        null_percentage = (null_count / total_points * 100.0) if total_points > 0 else 0.0

        # Extended null runs detection (run >= 10)
        null_run_start = -1
        for index in range(len(raw_values) + 1):
            is_null = (
                index < len(raw_values)
                and is_null_value(raw_values[index], null_value)
            )
            if is_null and null_run_start == -1:
                null_run_start = index
            if not is_null and null_run_start != -1:
                run_length = index - null_run_start
                if run_length >= 10:
                    start_d = depth_array[null_run_start] if null_run_start < len(depth_array) else 0.0
                    end_d = depth_array[index - 1] if index - 1 < len(depth_array) else 0.0
                    curve_anomalies.append(
                        AnomalyReportItem(
                            curveMnemonic=c_meta.mnemonic,
                            depthStart=start_d,
                            depthEnd=end_d,
                            anomalyType="NULL_CLUSTER",
                            severity="WARNING",
                            description=f"Missing-data cluster of {run_length} consecutive samples.",
                            suggestedCorrection="Review the acquisition interval and retain the samples as null if recovery is not defensible.",
                        )
                    )
                null_run_start = -1

        # Statistical metrics
        min_val: Optional[float] = None
        max_val: Optional[float] = None
        mean_val: Optional[float] = None

        if valid_points:
            vals = [p["val"] for p in valid_points]
            min_val = float(min(vals))
            max_val = float(max(vals))
            mean_val = float(sum(vals) / len(vals))

            variance = sum((b - mean_val) ** 2 for b in vals) / len(vals)
            std_dev = math.sqrt(variance)

            std_def = STANDARD_CURVES.get(std_res.standardMnemonic)

            # A. Physical Limit Checks
            if std_def:
                impossible_count = 0
                for p in valid_points:
                    if p["val"] < std_def.minPhysical or p["val"] > std_def.maxPhysical:
                        if impossible_count < 4:
                            null_repr = str(null_value) if null_value is not None else "null"
                            curve_anomalies.append(
                                AnomalyReportItem(
                                    curveMnemonic=c_meta.mnemonic,
                                    depthStart=p["depth"],
                                    depthEnd=p["depth"],
                                    anomalyType="IMPOSSIBLE_VALUE",
                                    severity="CRITICAL",
                                    description=f"Physically impossible value {p['val']:.2f} {c_meta.unit} at depth {p['depth']} (expected {std_def.minPhysical}–{std_def.maxPhysical})",
                                    suggestedCorrection=f"Clip value to physical limits or flag as null ({null_repr}).",
                                )
                            )
                            impossible_count += 1

            # B. Spike Detection (diffPrev > 4.5*stdDev and diffNext > 4.5*stdDev)
            if std_dev > 0.001 and len(valid_points) >= 3:
                spike_count = 0
                for i in range(1, len(valid_points) - 1):
                    p_prev = valid_points[i - 1]
                    p_curr = valid_points[i]
                    p_next = valid_points[i + 1]

                    diff_prev = abs(p_curr["val"] - p_prev["val"])
                    diff_next = abs(p_curr["val"] - p_next["val"])

                    if diff_prev > 4.5 * std_dev and diff_next > 4.5 * std_dev:
                        if spike_count < 5:
                            curve_anomalies.append(
                                AnomalyReportItem(
                                    curveMnemonic=c_meta.mnemonic,
                                    depthStart=p_curr["depth"],
                                    depthEnd=p_curr["depth"],
                                    anomalyType="EXTREME_SPIKE",
                                    severity="WARNING",
                                    description=f"Unrealistic spike value {p_curr['val']:.2f} detected at depth {p_curr['depth']} {las.wellInfo.depthUnit}",
                                    suggestedCorrection="Apply median despiking filter across 5-point window.",
                                )
                            )
                            spike_count += 1

            # C. Flatline Sensor Detection (> 25 consecutive identical points)
            flatline_length = 1
            flatline_start_depth = valid_points[0]["depth"]

            for i in range(1, len(valid_points)):
                if abs(valid_points[i]["val"] - valid_points[i - 1]["val"]) < 0.00001:
                    flatline_length += 1
                else:
                    if flatline_length > 25:
                        curve_anomalies.append(
                            AnomalyReportItem(
                                curveMnemonic=c_meta.mnemonic,
                                depthStart=flatline_start_depth,
                                depthEnd=valid_points[i - 1]["depth"],
                                anomalyType="FLATLINE",
                                severity="WARNING",
                                description=f"Stuck/flatline sensor output detected over {flatline_length} steps ({flatline_start_depth} to {valid_points[i - 1]['depth']} {las.wellInfo.depthUnit})",
                                suggestedCorrection="Mark flatline depth interval as unreliable sensor telemetry.",
                            )
                        )
                    flatline_length = 1
                    flatline_start_depth = valid_points[i]["depth"]

            if flatline_length > 25:
                curve_anomalies.append(
                    AnomalyReportItem(
                        curveMnemonic=c_meta.mnemonic,
                        depthStart=flatline_start_depth,
                        depthEnd=valid_points[-1]["depth"],
                        anomalyType="FLATLINE",
                        severity="WARNING",
                        description=f"Stuck/flatline sensor output detected over {flatline_length} steps ({flatline_start_depth} to {valid_points[-1]['depth']} {las.wellInfo.depthUnit})",
                        suggestedCorrection="Mark flatline depth interval as unreliable sensor telemetry.",
                    )
                )

        # Health score calculation
        penalty = null_percentage * 0.5
        for a in curve_anomalies:
            penalty += 15.0 if a.severity == "CRITICAL" else 8.0

        health_score = max(0, min(100, round(100.0 - penalty)))
        if health_score < 50:
            status = "CRITICAL"
        elif health_score < 75:
            status = "POOR"
        elif health_score < 90:
            status = "GOOD"
        else:
            status = "EXCELLENT"

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
                status=status,
                anomalies=curve_anomalies,
            )
        )
        anomalies.extend(curve_anomalies)

    # 4. Missing Key Standard Curves
    missing_standard_curves = [c for c in expected_key_curves if c not in present_standard_mnemonics]
    for missing_curve in missing_standard_curves:
        anomalies.append(
            AnomalyReportItem(
                curveMnemonic=missing_curve,
                depthStart=las.wellInfo.startDepth,
                depthEnd=las.wellInfo.stopDepth,
                anomalyType="MISSING_CORE_CURVE",
                severity="WARNING",
                description=f"Core standard petrophysical curve {missing_curve} is absent from this well log dataset.",
                suggestedCorrection="Synthesize channel via multi-log empirical regression or KNN estimation.",
            )
        )

    # Ensure deterministic ID
    for i, a in enumerate(anomalies):
        if not a.id:
            a.id = f"anom-{a.curveMnemonic}-{a.anomalyType}-{round(a.depthStart or 0.0)}-{i}"

    # 5. Aggregate quality scores
    null_clusters = sum(1 for a in anomalies if a.anomalyType == "NULL_CLUSTER")
    completeness_score = max(0, round(100.0 - (len(missing_standard_curves) * 12.0 + null_clusters * 5.0)))

    avg_curve_health = (
        sum(c.healthScore for c in curve_summaries) / len(curve_summaries)
        if curve_summaries
        else 50.0
    )

    critical_count = sum(1 for a in anomalies if a.severity == "CRITICAL")
    warning_count = sum(1 for a in anomalies if a.severity == "WARNING")

    consistency_penalty = critical_count * 12.0 + warning_count * 4.0
    consistency_score = max(0, round(100.0 - consistency_penalty))

    overall_score = max(
        0,
        min(100, round(avg_curve_health * 0.5 + completeness_score * 0.3 + consistency_score * 0.2)),
    )

    if overall_score < 50:
        quality_grade = "CRITICAL"
    elif overall_score < 75:
        quality_grade = "POOR"
    elif overall_score < 90:
        quality_grade = "GOOD"
    else:
        quality_grade = "EXCELLENT"

    return QualityAnalysisResult(
        overallScore=overall_score,
        qualityGrade=quality_grade,
        completenessScore=completeness_score,
        consistencyScore=consistency_score,
        anomalyCount=len(anomalies),
        criticalCount=critical_count,
        warningCount=warning_count,
        curveSummaries=curve_summaries,
        anomalies=anomalies,
        missingStandardCurves=missing_standard_curves,
    )
