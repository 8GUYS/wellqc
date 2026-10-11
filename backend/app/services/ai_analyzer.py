from __future__ import annotations

from typing import Dict, List, Literal

from pydantic import BaseModel

from backend.app.schemas.enums import AnomalySeverity, AnomalyType, QualityGrade
from backend.app.services.parser import ParsedLAS
from backend.app.services.quality_engine import AnomalyReportItem, EXPECTED_KEY_CURVES, QualityAnalysisResult
from backend.app.services.standardiser import STANDARD_CURVES

MAX_FLAGGED_INTERVALS = 10
_SEVERITY_ORDER = {
    AnomalySeverity.CRITICAL: 0,
    AnomalySeverity.WARNING: 1,
    AnomalySeverity.INFO: 2,
    "CRITICAL": 0,
    "WARNING": 1,
    "INFO": 2,
}
_RISK_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


class FlaggedInterval(BaseModel):
    startDepth: float
    endDepth: float
    curveMnemonic: str
    issue: str
    recommendation: str


class AIAnalysisOutput(BaseModel):
    summary: str
    recommendations: List[str]
    riskRating: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    confidenceScore: float
    flaggedIntervals: List[FlaggedInterval]


def _curves_for(anomalies: List[AnomalyReportItem], anomaly_type: str | AnomalyType) -> List[str]:
    names: List[str] = []
    for a in anomalies:
        if a.anomalyType == anomaly_type and a.curveMnemonic not in names:
            names.append(a.curveMnemonic)
    return names


def _join(names: List[str], limit: int = 6) -> str:
    shown = ", ".join(names[:limit])
    return shown + (f" and {len(names) - limit} more" if len(names) > limit else "")


def generate_ai_analysis(las: ParsedLAS, qa_result: QualityAnalysisResult) -> AIAnalysisOutput:
    well_name = las.wellInfo.wellName
    unit = las.wellInfo.depthUnit
    anomalies = qa_result.anomalies
    critical = [a for a in anomalies if a.severity in (AnomalySeverity.CRITICAL, "CRITICAL")]
    warnings = [a for a in anomalies if a.severity in (AnomalySeverity.WARNING, "WARNING")]

    ordered = sorted(anomalies, key=lambda a: (_SEVERITY_ORDER.get(a.severity, 3), a.depthStart))
    flagged = [
        FlaggedInterval(
            startDepth=a.depthStart,
            endDepth=a.depthEnd,
            curveMnemonic=a.curveMnemonic,
            issue=a.description,
            recommendation=a.suggestedCorrection,
        )
        for a in ordered[:MAX_FLAGGED_INTERVALS]
    ]

    summary = f"Automated petrophysical QA inspection for {well_name} ({las.wellInfo.startDepth}–{las.wellInfo.stopDepth} {unit}). "

    if las.totalPoints == 0 or not las.curves:
        summary += "No log data rows or curves were found, so no quality assessment is possible. "
    elif qa_result.qualityGrade in (QualityGrade.EXCELLENT, "EXCELLENT"):
        summary += f"Log quality is benchmarked as EXCELLENT with an overall score of {qa_result.overallScore}/100. "
    elif qa_result.qualityGrade in (QualityGrade.GOOD, "GOOD"):
        summary += f"Log quality is rated GOOD ({qa_result.overallScore}/100). Data is suitable for reservoir evaluation after the flagged items below are reviewed. "
    elif qa_result.qualityGrade in (QualityGrade.POOR, "POOR"):
        summary += f"Log quality is POOR ({qa_result.overallScore}/100). Significant anomalies detected including {len(critical)} critical flags and {len(warnings)} warnings. "
    else:
        summary += f"CRITICAL WARNING: Well log score is {qa_result.overallScore}/100. Multiple physical-limit violations, depth problems, or sensor failures were detected. "

    if critical:
        first = critical[0]
        summary += f"Notably, curve {first.curveMnemonic} shows: {first.description} "

    missing = qa_result.missingStandardCurves
    recs: List[str] = []

    if missing:
        summary += f"Missing core standard curves: {', '.join(missing)}. "
        recs.append(f"Import or synthesise missing curves ({', '.join(missing)}) prior to porosity/water saturation calculations.")

    dup = _curves_for(anomalies, "DUPLICATE_DEPTH")
    if dup:
        recs.append("Remove duplicate depth rows and confirm the depth index is strictly monotonic before any interval-based calculation.")

    gaps = _curves_for(anomalies, "DEPTH_GAP")
    if gaps:
        recs.append("Verify the logged intervals around the flagged depth gaps; repair them only if the gaps are regular missing rows, not unlogged sections.")

    # Physical limits, quoted from the standardiser
    std_by_mnem: Dict[str, str] = {s.mnemonic: s.standardMnemonic for s in qa_result.curveSummaries}
    impossible = _curves_for(anomalies, "IMPOSSIBLE_VALUE")
    if impossible:
        parts = []
        for m in impossible[:6]:
            d = STANDARD_CURVES.get(std_by_mnem.get(m, ""))
            parts.append(f"{m} ({d.minPhysical:g}–{d.maxPhysical:g} {d.standardUnit})" if d else m)
        recs.append(
            "Review values outside physical limits on " + ", ".join(parts)
            + ". Check unit scaling and tool failure first, then null or correct the affected samples."
        )

    spikes = _curves_for(anomalies, "EXTREME_SPIKE")
    if spikes:
        recs.append(f"Execute median despiking on {_join(spikes)} over the flagged depths before reservoir zoning.")

    flat = _curves_for(anomalies, "FLATLINE")
    if flat:
        recs.append(f"Review tool calibration and acquisition logs for stuck-sensor intervals on {_join(flat)}.")

    units = _curves_for(anomalies, "UNIT_MISMATCH")
    if units:
        recs.append(f"Standardise units on {_join(units)} (the declared unit is not the expected one).")

    inferred = _curves_for(anomalies, "UNIT_INFERRED")
    if inferred:
        recs.append(f"Confirm the units of {_join(inferred)}; they were missing in the header and were inferred from the values.")

    clusters = _curves_for(anomalies, "NULL_CLUSTER")
    if clusters:
        recs.append(f"Investigate extended missing-data intervals on {_join(clusters)}; impute only where the gap is short and well constrained by neighbouring logs.")

    atypical = _curves_for(anomalies, "OUT_OF_TYPICAL_RANGE")
    if atypical:
        recs.append(f"Check {_join(atypical)} against lithology: some values are outside their usual range but inside physical limits.")

    dup_curves = _curves_for(anomalies, "DUPLICATE_CURVE")
    if dup_curves:
        recs.append(f"Resolve duplicate curve headers ({_join(dup_curves)}): keep the primary channel and rename or drop the copy.")

    nonstd = _curves_for(anomalies, "NON_STANDARD_MNEMONIC")
    if nonstd:
        recs.append(f"Map {_join(nonstd)} to the standard dictionary with a custom alias if they are known equivalents.")

    if not recs:
        if qa_result.anomalyCount == 0:
            recs.append("No issues were flagged by the automated checks. Ready for petrophysical workflow ingestion.")
        else:
            recs.append("Review the flagged intervals before ingestion.")

    score = qa_result.overallScore
    if score < 50:
        risk = "CRITICAL"
    elif score < 75:
        risk = "HIGH"
    elif score < 90:
        risk = "MEDIUM"
    else:
        risk = "LOW"
    if critical and _RISK_ORDER.index(risk) < _RISK_ORDER.index("MEDIUM"):
        risk = "MEDIUM"

    core_present = (len(EXPECTED_KEY_CURVES) - len(missing)) / len(EXPECTED_KEY_CURVES)
    data_factor = min(1.0, las.totalPoints / 500.0)
    confidence = round(0.5 + 0.45 * core_present * data_factor, 2)

    return AIAnalysisOutput(
        summary=summary,
        recommendations=recs,
        riskRating=risk,  # type: ignore[arg-type]
        confidenceScore=confidence,
        flaggedIntervals=flagged,
    )
