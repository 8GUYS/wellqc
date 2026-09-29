from __future__ import annotations
from typing import Dict, List, Literal, Optional
from pydantic import BaseModel
from backend.app.services.parser import ParsedLAS
from backend.app.services.quality_engine import QualityAnalysisResult

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


def generate_ai_analysis(las: ParsedLAS, qa_result: QualityAnalysisResult) -> AIAnalysisOutput:
    well_name = las.wellInfo.wellName
    unit = las.wellInfo.depthUnit
    critical_anomalies = [a for a in qa_result.anomalies if a.severity == "CRITICAL"]
    warning_anomalies = [a for a in qa_result.anomalies if a.severity == "WARNING"]

    flagged_intervals: List[FlaggedInterval] = []
    recommendations: List[str] = []

    for a in qa_result.anomalies:
        flagged_intervals.append(
            FlaggedInterval(
                startDepth=a.depthStart,
                endDepth=a.depthEnd,
                curveMnemonic=a.curveMnemonic,
                issue=a.description,
                recommendation=a.suggestedCorrection,
            )
        )

    summary = f"Automated petrophysical QA inspection for {well_name} ({las.wellInfo.startDepth}–{las.wellInfo.stopDepth} {unit}). "

    if qa_result.qualityGrade == "EXCELLENT":
        summary += f"Log quality is benchmarked as EXCELLENT with an overall score of {qa_result.overallScore}/100. High data fidelity across key petrophysical channels. "
    elif qa_result.qualityGrade == "GOOD":
        summary += f"Log quality is rated GOOD ({qa_result.overallScore}/100). Data is suitable for reservoir evaluation following minor curve standardisation and despiking. "
    elif qa_result.qualityGrade == "POOR":
        summary += f"Log quality is POOR ({qa_result.overallScore}/100). Significant anomalies detected including {len(critical_anomalies)} critical flags and {len(warning_anomalies)} sensor warnings. "
    else:
        summary += f"CRITICAL WARNING: Well log score is {qa_result.overallScore}/100. Multiple physical threshold violations, severe noise, or sensor failures were detected. "

    if critical_anomalies:
        first_crit = critical_anomalies[0]
        summary += f"Notably, curve {first_crit.curveMnemonic} contains {first_crit.description.lower()} near {first_crit.depthStart} {unit}. "

    if qa_result.missingStandardCurves:
        missing_str = ", ".join(qa_result.missingStandardCurves)
        summary += f"Missing core standard curves: {missing_str}. "
        recommendations.append(f"Import or synthesise missing curves ({missing_str}) prior to porosity/water saturation calculations.")

    if any(a.anomalyType == "IMPOSSIBLE_VALUE" for a in critical_anomalies):
        recommendations.append("Apply physical boundary clipping to density (RHOB: 1.0–3.2 g/cc) and neutron porosity (NPHI: -0.05–0.60 v/v).")

    if any(a.anomalyType == "EXTREME_SPIKE" for a in warning_anomalies):
        recommendations.append("Execute automated median filtering despiking routine on affected depth intervals before reservoir zoning.")

    if any(a.anomalyType == "FLATLINE" for a in warning_anomalies):
        recommendations.append("Review tool calibration logs for stuck sensor intervals flagged in RHOB/NPHI.")

    if not recommendations:
        recommendations.append("Log suite is fully validated. Ready for automated petrophysical workflow ingestion.")

    if qa_result.overallScore < 50:
        risk_rating = "CRITICAL"
    elif qa_result.overallScore < 75:
        risk_rating = "HIGH"
    elif qa_result.overallScore < 90:
        risk_rating = "MEDIUM"
    else:
        risk_rating = "LOW"

    confidence_score = round(0.85 + (qa_result.overallScore / 100.0) * 0.12, 2)

    return AIAnalysisOutput(
        summary=summary,
        recommendations=recommendations,
        riskRating=risk_rating,
        confidenceScore=confidence_score,
        flaggedIntervals=flagged_intervals[:10],
    )
