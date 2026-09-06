import { ParsedLAS } from './parser';
import { standardiseMnemonic, STANDARD_CURVES } from './standardiser';
import { convertToStandardUnit } from './exporter';

export interface AnomalyReportItem {
  curveMnemonic: string;
  depthStart: number;
  depthEnd: number;
  anomalyType: 
    | 'IMPOSSIBLE_VALUE'
    | 'EXTREME_SPIKE'
    | 'FLATLINE'
    | 'DEPTH_GAP'
    | 'NULL_CLUSTER'
    | 'UNIT_MISMATCH'
    | 'DUPLICATE_CURVE'
    | 'DUPLICATE_DEPTH';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string;
  suggestedCorrection: string;
}

export interface CurveHealthSummary {
  mnemonic: string;
  standardMnemonic: string;
  unit: string;
  nullCount: number;
  totalPoints: number;
  nullPercentage: number;
  minVal: number | null;
  maxVal: number | null;
  meanVal: number | null;
  healthScore: number; // 0 - 100
  status: 'EXCELLENT' | 'GOOD' | 'POOR' | 'CRITICAL';
  anomalies: AnomalyReportItem[];
}

export interface QualityAnalysisResult {
  overallScore: number; // 0 - 100
  qualityGrade: 'EXCELLENT' | 'GOOD' | 'POOR' | 'CRITICAL';
  completenessScore: number;
  consistencyScore: number;
  anomalyCount: number;
  criticalCount: number;
  warningCount: number;
  curveSummaries: CurveHealthSummary[];
  anomalies: AnomalyReportItem[];
  missingStandardCurves: string[];
}

/**
 * Enterprise Well Log Quality Assurance Engine
 */
export function analyzeWellLogQuality(las: ParsedLAS): QualityAnalysisResult {
  const depthArray = las.data.depth;
  const nullValue = las.wellInfo.nullValue;
  const totalPoints = depthArray.length;
  const anomalies: AnomalyReportItem[] = [];
  const curveSummaries: CurveHealthSummary[] = [];

  // 1. Check Depth Sequence & Gaps
  let duplicateDepthCount = 0;
  for (let i = 1; i < depthArray.length; i++) {
    const dPrev = depthArray[i - 1];
    const dCurr = depthArray[i];
    const step = dCurr - dPrev;

    if (Math.abs(step) < 0.0001) {
      duplicateDepthCount++;
      if (duplicateDepthCount <= 5) {
        anomalies.push({
          curveMnemonic: 'DEPT',
          depthStart: dCurr,
          depthEnd: dCurr,
          anomalyType: 'DUPLICATE_DEPTH',
          severity: 'CRITICAL',
          description: `Duplicate depth value detected at ${dCurr} ${las.wellInfo.depthUnit}`,
          suggestedCorrection: 'Remove duplicate depth index row.',
        });
      }
    } else if (step > Math.abs(las.wellInfo.step) * 3) {
      anomalies.push({
        curveMnemonic: 'DEPT',
        depthStart: dPrev,
        depthEnd: dCurr,
        anomalyType: 'DEPTH_GAP',
        severity: 'WARNING',
        description: `Unexplained depth gap of ${(dCurr - dPrev).toFixed(2)} ${las.wellInfo.depthUnit} between ${dPrev} and ${dCurr}`,
        suggestedCorrection: 'Perform linear depth interpolation or verify raw tool telemetry log.',
      });
    }
  }

  // 2. Track Standard Curves Inventory
  const presentStandardMnemonics = new Set<string>();
  const expectedKeyCurves = ['GR', 'RHOB', 'NPHI', 'DT', 'RT', 'CALI'];

  // 3. Process Each Log Curve Channel
  for (const cMeta of las.curves) {
    const rawValues = las.data.curves[cMeta.mnemonic] || [];
    const stdRes = standardiseMnemonic(cMeta.mnemonic, cMeta.unit);
    
    if (stdRes.standardMnemonic !== 'UNKNOWN') {
      presentStandardMnemonics.add(stdRes.standardMnemonic);
    }

    if (stdRes.unitMismatch) {
      anomalies.push({
        curveMnemonic: cMeta.mnemonic,
        depthStart: las.wellInfo.startDepth,
        depthEnd: las.wellInfo.stopDepth,
        anomalyType: 'UNIT_MISMATCH',
        severity: 'WARNING',
        description: `Curve ${cMeta.mnemonic} unit '${cMeta.unit}' does not match standard unit '${stdRes.standardUnit}'`,
        suggestedCorrection: `Convert unit from ${cMeta.unit} to ${stdRes.standardUnit}.`,
      });
    }

    // Filter non-null values
    const validPoints: { depth: number; val: number; idx: number }[] = [];
    let nullCount = 0;

    rawValues.forEach((v, idx) => {
      if (v === nullValue || Math.abs(v - nullValue) < 0.01 || isNaN(v)) {
        nullCount++;
      } else {
        validPoints.push({
          depth: depthArray[idx],
          val: convertToStandardUnit(v, cMeta.unit, stdRes.standardMnemonic).value,
          idx,
        });
      }
    });

    const nullPercentage = totalPoints > 0 ? (nullCount / totalPoints) * 100 : 0;
    const curveAnomalies: AnomalyReportItem[] = [];

    // Extended null runs are a distinct telemetry-quality issue, not just a percentage.
    let nullRunStart = -1;
    for (let index = 0; index <= rawValues.length; index++) {
      const isNull = index < rawValues.length && (rawValues[index] === nullValue || Math.abs(rawValues[index] - nullValue) < 0.01 || Number.isNaN(rawValues[index]));
      if (isNull && nullRunStart === -1) nullRunStart = index;
      if (!isNull && nullRunStart !== -1) {
        const runLength = index - nullRunStart;
        if (runLength >= 10) {
          curveAnomalies.push({
            curveMnemonic: cMeta.mnemonic,
            depthStart: depthArray[nullRunStart],
            depthEnd: depthArray[index - 1],
            anomalyType: 'NULL_CLUSTER',
            severity: 'WARNING',
            description: `Missing-data cluster of ${runLength} consecutive samples.`,
            suggestedCorrection: 'Review the acquisition interval and retain the samples as null if recovery is not defensible.',
          });
        }
        nullRunStart = -1;
      }
    }

    // Calculate statistical metrics
    let minVal: number | null = null;
    let maxVal: number | null = null;
    let meanVal: number | null = null;

    if (validPoints.length > 0) {
      const vals = validPoints.map((p) => p.val);
      minVal = Math.min(...vals);
      maxVal = Math.max(...vals);
      const sum = vals.reduce((a, b) => a + b, 0);
      meanVal = sum / vals.length;

      // Variance & StdDev
      const variance = vals.reduce((a, b) => a + Math.pow(b - meanVal!, 2), 0) / vals.length;
      const stdDev = Math.sqrt(variance);

      const stdDef = STANDARD_CURVES[stdRes.standardMnemonic];

      // A. Physical Limit Checks
      if (stdDef) {
        validPoints.forEach((p) => {
          if (p.val < stdDef.minPhysical || p.val > stdDef.maxPhysical) {
            if (curveAnomalies.filter((a) => a.anomalyType === 'IMPOSSIBLE_VALUE').length < 4) {
              curveAnomalies.push({
                curveMnemonic: cMeta.mnemonic,
                depthStart: p.depth,
                depthEnd: p.depth,
                anomalyType: 'IMPOSSIBLE_VALUE',
                severity: 'CRITICAL',
                description: `Physically impossible value ${p.val.toFixed(2)} ${cMeta.unit} at depth ${p.depth} (expected ${stdDef.minPhysical}–${stdDef.maxPhysical})`,
                suggestedCorrection: `Clip value to physical limits or flag as null (${nullValue}).`,
              });
            }
          }
        });
      }

      // B. Spike Detection (Z-Score > 4.0 or sudden jump)
      if (stdDev > 0.001) {
        for (let i = 1; i < validPoints.length - 1; i++) {
          const pPrev = validPoints[i - 1];
          const pCurr = validPoints[i];
          const pNext = validPoints[i + 1];

          const diffPrev = Math.abs(pCurr.val - pPrev.val);
          const diffNext = Math.abs(pCurr.val - pNext.val);

          if (diffPrev > 4.5 * stdDev && diffNext > 4.5 * stdDev) {
            if (curveAnomalies.filter((a) => a.anomalyType === 'EXTREME_SPIKE').length < 5) {
              curveAnomalies.push({
                curveMnemonic: cMeta.mnemonic,
                depthStart: pCurr.depth,
                depthEnd: pCurr.depth,
                anomalyType: 'EXTREME_SPIKE',
                severity: 'WARNING',
                description: `Unrealistic spike value ${pCurr.val.toFixed(2)} detected at depth ${pCurr.depth} ${las.wellInfo.depthUnit}`,
                suggestedCorrection: 'Apply median despiking filter across 5-point window.',
              });
            }
          }
        }
      }

      // C. Flatline Sensor Detection (> 25 consecutive identical points)
      let flatlineLength = 1;
      let flatlineStartDepth = validPoints[0].depth;

      for (let i = 1; i < validPoints.length; i++) {
        if (Math.abs(validPoints[i].val - validPoints[i - 1].val) < 0.00001) {
          flatlineLength++;
        } else {
          if (flatlineLength > 25) {
            curveAnomalies.push({
              curveMnemonic: cMeta.mnemonic,
              depthStart: flatlineStartDepth,
              depthEnd: validPoints[i - 1].depth,
              anomalyType: 'FLATLINE',
              severity: 'WARNING',
              description: `Stuck/flatline sensor output detected over ${flatlineLength} steps (${flatlineStartDepth} to ${validPoints[i - 1].depth} ${las.wellInfo.depthUnit})`,
              suggestedCorrection: 'Mark flatline depth interval as unreliable sensor telemetry.',
            });
          }
          flatlineLength = 1;
          flatlineStartDepth = validPoints[i].depth;
        }
      }
      if (flatlineLength > 25) {
        curveAnomalies.push({
          curveMnemonic: cMeta.mnemonic,
          depthStart: flatlineStartDepth,
          depthEnd: validPoints[validPoints.length - 1].depth,
          anomalyType: 'FLATLINE',
          severity: 'WARNING',
          description: `Stuck/flatline sensor output detected over ${flatlineLength} steps (${flatlineStartDepth} to ${validPoints[validPoints.length - 1].depth} ${las.wellInfo.depthUnit})`,
          suggestedCorrection: 'Mark flatline depth interval as unreliable sensor telemetry.',
        });
      }
    }

    // Health Score calculation for curve (100 - penalties)
    let penalty = nullPercentage * 0.5;
    curveAnomalies.forEach((a) => {
      penalty += a.severity === 'CRITICAL' ? 15 : 8;
    });

    const healthScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));
    let status: 'EXCELLENT' | 'GOOD' | 'POOR' | 'CRITICAL' = 'EXCELLENT';
    if (healthScore < 50) status = 'CRITICAL';
    else if (healthScore < 75) status = 'POOR';
    else if (healthScore < 90) status = 'GOOD';

    curveSummaries.push({
      mnemonic: cMeta.mnemonic,
      standardMnemonic: stdRes.standardMnemonic,
      unit: cMeta.unit,
      nullCount,
      totalPoints,
      nullPercentage,
      minVal,
      maxVal,
      meanVal,
      healthScore,
      status,
      anomalies: curveAnomalies,
    });

    anomalies.push(...curveAnomalies);
  }

  // 4. Missing Key Standard Curves
  const missingStandardCurves = expectedKeyCurves.filter((c) => !presentStandardMnemonics.has(c));

  // 5. Compute Aggregate Quality Scores
  const completenessScore = Math.max(
    0,
    Math.round(100 - (missingStandardCurves.length * 12 + (anomalies.filter((a) => a.anomalyType === 'NULL_CLUSTER').length * 5)))
  );

  const avgCurveHealth = curveSummaries.length > 0
    ? curveSummaries.reduce((sum, c) => sum + c.healthScore, 0) / curveSummaries.length
    : 50;

  const criticalCount = anomalies.filter((a) => a.severity === 'CRITICAL').length;
  const warningCount = anomalies.filter((a) => a.severity === 'WARNING').length;

  const consistencyPenalty = criticalCount * 12 + warningCount * 4;
  const consistencyScore = Math.max(0, Math.round(100 - consistencyPenalty));

  const overallScore = Math.max(
    0,
    Math.min(100, Math.round(avgCurveHealth * 0.5 + completenessScore * 0.3 + consistencyScore * 0.2))
  );

  let qualityGrade: 'EXCELLENT' | 'GOOD' | 'POOR' | 'CRITICAL' = 'EXCELLENT';
  if (overallScore < 50) qualityGrade = 'CRITICAL';
  else if (overallScore < 75) qualityGrade = 'POOR';
  else if (overallScore < 90) qualityGrade = 'GOOD';

  return {
    overallScore,
    qualityGrade,
    completenessScore,
    consistencyScore,
    anomalyCount: anomalies.length,
    criticalCount,
    warningCount,
    curveSummaries,
    anomalies,
    missingStandardCurves,
  };
}
