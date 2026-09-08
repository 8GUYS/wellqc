import { QualityAnalysisResult } from './quality-engine';
import { ParsedLAS } from './parser';

export interface AIAnalysisOutput {
  summary: string;
  recommendations: string[];
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidenceScore: number; // 0.0 - 1.0
  flaggedIntervals: {
    startDepth: number;
    endDepth: number;
    curveMnemonic: string;
    issue: string;
    recommendation: string;
  }[];
}

/**
 * AI Natural Language Summariser & Recommendation Engine for Well Logs
 */
export function generateAIAnalysis(las: ParsedLAS, qaResult: QualityAnalysisResult): AIAnalysisOutput {
  const wellName = las.wellInfo.wellName;
  const unit = las.wellInfo.depthUnit;
  const criticalAnomalies = qaResult.anomalies.filter((a) => a.severity === 'CRITICAL');
  const warningAnomalies = qaResult.anomalies.filter((a) => a.severity === 'WARNING');

  const flaggedIntervals: AIAnalysisOutput['flaggedIntervals'] = [];
  const recommendations: string[] = [];

  // Group anomalies into interval buckets
  qaResult.anomalies.forEach((a) => {
    flaggedIntervals.push({
      startDepth: a.depthStart,
      endDepth: a.depthEnd,
      curveMnemonic: a.curveMnemonic,
      issue: a.description,
      recommendation: a.suggestedCorrection,
    });
  });

  // Construct structured AI natural language text
  let summary = `Automated petrophysical QA inspection for ${wellName} (${las.wellInfo.startDepth}–${las.wellInfo.stopDepth} ${unit}). `;
  
  if (qaResult.qualityGrade === 'EXCELLENT') {
    summary += `Log quality is benchmarked as EXCELLENT with an overall score of ${qaResult.overallScore}/100. High data fidelity across key petrophysical channels. `;
  } else if (qaResult.qualityGrade === 'GOOD') {
    summary += `Log quality is rated GOOD (${qaResult.overallScore}/100). Data is suitable for reservoir evaluation following minor curve standardisation and despiking. `;
  } else if (qaResult.qualityGrade === 'POOR') {
    summary += `Log quality is POOR (${qaResult.overallScore}/100). Significant anomalies detected including ${criticalAnomalies.length} critical flags and ${warningAnomalies.length} sensor warnings. `;
  } else {
    summary += `CRITICAL WARNING: Well log score is ${qaResult.overallScore}/100. Multiple physical threshold violations, severe noise, or sensor failures were detected. `;
  }

  // Highlight key curve specific anomalies
  if (criticalAnomalies.length > 0) {
    const firstCrit = criticalAnomalies[0];
    summary += `Notably, curve ${firstCrit.curveMnemonic} contains ${firstCrit.description.toLowerCase()} near ${firstCrit.depthStart} ${unit}. `;
  }

  if (qaResult.missingStandardCurves.length > 0) {
    summary += `Missing core standard curves: ${qaResult.missingStandardCurves.join(', ')}. `;
    recommendations.push(`Import or synthesise missing curves (${qaResult.missingStandardCurves.join(', ')}) prior to porosity/water saturation calculations.`);
  }

  if (criticalAnomalies.some((a) => a.anomalyType === 'IMPOSSIBLE_VALUE')) {
    recommendations.push('Apply physical boundary clipping to density (RHOB: 1.0–3.2 g/cc) and neutron porosity (NPHI: -0.05–0.60 v/v).');
  }

  if (warningAnomalies.some((a) => a.anomalyType === 'EXTREME_SPIKE')) {
    recommendations.push('Execute automated median filtering despiking routine on affected depth intervals before reservoir zoning.');
  }

  if (warningAnomalies.some((a) => a.anomalyType === 'FLATLINE')) {
    recommendations.push('Review tool calibration logs for stuck sensor intervals flagged in RHOB/NPHI.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Log suite is fully validated. Ready for automated petrophysical workflow ingestion.');
  }

  let riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (qaResult.overallScore < 50) riskRating = 'CRITICAL';
  else if (qaResult.overallScore < 75) riskRating = 'HIGH';
  else if (qaResult.overallScore < 90) riskRating = 'MEDIUM';

  const confidenceScore = Number((0.85 + (qaResult.overallScore / 100) * 0.12).toFixed(2));

  return {
    summary,
    recommendations,
    riskRating,
    confidenceScore,
    flaggedIntervals: flaggedIntervals.slice(0, 10), // Top 10 flagged intervals
  };
}
