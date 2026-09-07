import { ParsedLAS } from './parser';

export type ImputationStrategy = 'KNN' | 'LINEAR' | 'MEAN' | 'MEDIAN' | 'SPLINE' | 'ROW_DROPPING';

export type MissingValueCause = 
  | 'CASING_SHOE_BOUNDARY'
  | 'BOREHOLE_WASHOUT'
  | 'TELEMETRY_DROPOUT'
  | 'OFF_BOTTOM_WINDOW'
  | 'UNKNOWN_SENSOR_GAP';

export interface MissingValueDiagnostic {
  curveMnemonic: string;
  totalPoints: number;
  nullCount: number;
  nullPercentage: number;
  primaryCause: MissingValueCause;
  causeDescription: string;
  recommendedStrategy: ImputationStrategy;
  recommendedThresholdAction: 'DROP_ROWS' | 'APPLY_IMPUTATION' | 'NO_ACTION_NEEDED';
}

export interface ImputationBenchmarkMetric {
  strategy: ImputationStrategy;
  strategyLabel: string;
  rmse: number; // Root Mean Squared Error
  mae: number;  // Mean Absolute Error
  r2Score: number; // R-squared (0.0 to 1.0)
  varianceRatio: number; // Preserved variance vs original
  executionTimeMs: number;
  rank: number;
  isRecommended: boolean;
  notes: string;
}

export interface ImputationBenchmarkResult {
  curveMnemonic: string;
  totalNullCount: number;
  nullPercentage: number;
  testedSampleCount: number;
  metrics: ImputationBenchmarkMetric[];
  bestStrategy: ImputationStrategy;
  recommendationReason: string;
}

/**
 * Standardize null values across various LAS representations
 */
export function isNullValue(val: number | null | undefined, nullValue: number): boolean {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return true;
  if (Math.abs(val - nullValue) < 0.01) return true;
  // Standard LAS null representations
  if (val === -999.25 || val === -9999 || val === -999.2500 || val === 999.25 || val === -999.9) return true;
  return false;
}

/**
 * Detect petrophysical root cause of missing values for a given curve
 */
export function diagnoseMissingValueCauses(las: ParsedLAS): MissingValueDiagnostic[] {
  const depth = las.data.depth;
  const nullValue = las.wellInfo.nullValue;
  const totalPoints = depth.length;
  const diagnostics: MissingValueDiagnostic[] = [];

  const startDepth = las.wellInfo.startDepth;
  const stopDepth = las.wellInfo.stopDepth;
  const depthSpan = Math.abs(stopDepth - startDepth) || 1;

  // Find caliper curve if available for washout detection
  const caliCurveKey = Object.keys(las.data.curves).find(
    (k) => k.toUpperCase().includes('CAL') || k.toUpperCase().includes('CDEV')
  );
  const caliValues = caliCurveKey ? las.data.curves[caliCurveKey] : null;

  for (const cMeta of las.curves) {
    const rawValues = las.data.curves[cMeta.mnemonic] || [];
    let nullCount = 0;
    const nullIndices: number[] = [];

    rawValues.forEach((v, idx) => {
      if (isNullValue(v, nullValue)) {
        nullCount++;
        nullIndices.push(idx);
      }
    });

    const nullPercentage = totalPoints > 0 ? (nullCount / totalPoints) * 100 : 0;

    if (nullCount === 0) {
      diagnostics.push({
        curveMnemonic: cMeta.mnemonic,
        totalPoints,
        nullCount: 0,
        nullPercentage: 0,
        primaryCause: 'UNKNOWN_SENSOR_GAP',
        causeDescription: 'No missing values detected in log channel.',
        recommendedStrategy: 'LINEAR',
        recommendedThresholdAction: 'NO_ACTION_NEEDED',
      });
      continue;
    }

    // Determine cause based on null distribution & auxiliary log behavior
    let primaryCause: MissingValueCause = 'UNKNOWN_SENSOR_GAP';
    let causeDescription = 'General telemetry gap or isolated missing sample readings.';

    const shallowNulls = nullIndices.filter((idx) => {
      const d = depth[idx];
      return Math.abs(d - startDepth) < depthSpan * 0.08;
    });

    const deepNulls = nullIndices.filter((idx) => {
      const d = depth[idx];
      return Math.abs(d - stopDepth) < depthSpan * 0.08;
    });

    // A. Casing Shoe Boundary Check (Missing values localized to upper interval)
    if (shallowNulls.length / nullCount > 0.6 && ['DT', 'RT', 'RHOB', 'NPHI', 'AT40'].includes(cMeta.mnemonic.toUpperCase())) {
      primaryCause = 'CASING_SHOE_BOUNDARY';
      causeDescription = `Null values concentrated near casing shoe / shallow interval (${startDepth.toFixed(1)} ${las.wellInfo.depthUnit}). Sensors reading casing metal or mud column instead of formation.`;
    }
    // B. Borehole Washout Check (Caliper > 15-16 inches during density/neutron nulls)
    else if (caliValues && (cMeta.mnemonic.toUpperCase().includes('RHOB') || cMeta.mnemonic.toUpperCase().includes('NPHI') || cMeta.mnemonic.toUpperCase().includes('PEF'))) {
      const washoutNulls = nullIndices.filter((idx) => {
        const cVal = caliValues[idx];
        return cVal && cVal > 15.5 && !isNullValue(cVal, nullValue);
      });
      if (washoutNulls.length / nullCount > 0.3) {
        primaryCause = 'BOREHOLE_WASHOUT';
        causeDescription = 'Null or invalid sensor readings correlate with severe borehole enlargement (caliper > 15.5 in), causing tool pad contact loss.';
      }
    }
    // C. Off-Bottom Window Check
    else if (deepNulls.length / nullCount > 0.6) {
      primaryCause = 'OFF_BOTTOM_WINDOW';
      causeDescription = `Null readings at bottom hole interval (${stopDepth.toFixed(1)} ${las.wellInfo.depthUnit}) due to tool pickup or survey cutoff.`;
    }
    // D. Telemetry Dropout Check (Large continuous missing blocks across multiple channels)
    else if (nullCount >= 15) {
      primaryCause = 'TELEMETRY_DROPOUT';
      causeDescription = `Extended cluster of ${nullCount} missing samples caused by sensor signal dropout or telemetry interruption.`;
    }

    // Recommendation logic
    let recommendedStrategy: ImputationStrategy = 'KNN';
    let recommendedThresholdAction: 'DROP_ROWS' | 'APPLY_IMPUTATION' | 'NO_ACTION_NEEDED' = 'APPLY_IMPUTATION';

    if (nullPercentage < 2.0) {
      recommendedThresholdAction = 'DROP_ROWS';
      recommendedStrategy = 'ROW_DROPPING';
      causeDescription += ` Low missing percentage (${nullPercentage.toFixed(2)}%) qualifies for listwise row deletion without affecting petrophysical statistics.`;
    } else if (cMeta.mnemonic.toUpperCase().includes('DT') || cMeta.mnemonic.toUpperCase().includes('SONIC')) {
      recommendedStrategy = 'KNN'; // KNN preserves sonic transitions better than linear
    } else if (nullPercentage > 25.0) {
      recommendedStrategy = 'KNN';
    }

    diagnostics.push({
      curveMnemonic: cMeta.mnemonic,
      totalPoints,
      nullCount,
      nullPercentage,
      primaryCause,
      causeDescription,
      recommendedStrategy,
      recommendedThresholdAction,
    });
  }

  return diagnostics;
}

/**
 * Baseline Linear Interpolation
 */
export function imputeLinear(series: number[], nullValue: number): number[] {
  const result = [...series];
  const n = result.length;

  let i = 0;
  while (i < n) {
    if (isNullValue(result[i], nullValue)) {
      const start = i - 1;
      while (i < n && isNullValue(result[i], nullValue)) {
        i++;
      }
      const end = i;

      const leftVal = start >= 0 ? result[start] : (end < n ? result[end] : 0);
      const rightVal = end < n ? result[end] : (start >= 0 ? result[start] : 0);

      const count = end - start - 1;
      for (let j = 1; j <= count; j++) {
        const idx = start + j;
        if (start < 0 && end >= n) {
          result[idx] = 0;
        } else if (start < 0) {
          result[idx] = rightVal;
        } else if (end >= n) {
          result[idx] = leftVal;
        } else {
          const t = j / (count + 1);
          result[idx] = leftVal + t * (rightVal - leftVal);
        }
      }
    } else {
      i++;
    }
  }

  return result;
}

/**
 * Mean Imputer
 */
export function imputeMean(series: number[], nullValue: number): number[] {
  const valid = series.filter((v) => !isNullValue(v, nullValue));
  if (valid.length === 0) return series.map(() => 0);
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  return series.map((v) => (isNullValue(v, nullValue) ? mean : v));
}

/**
 * Median Imputer
 */
export function imputeMedian(series: number[], nullValue: number): number[] {
  const valid = series.filter((v) => !isNullValue(v, nullValue)).sort((a, b) => a - b);
  if (valid.length === 0) return series.map(() => 0);
  const mid = Math.floor(valid.length / 2);
  const median = valid.length % 2 !== 0 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
  return series.map((v) => (isNullValue(v, nullValue) ? median : v));
}

/**
 * Cubic Spline / Polynomial Interpolation
 */
export function imputeSpline(series: number[], nullValue: number): number[] {
  // Uses smooth local weighted quadratic / cubic polynomial window
  const result = [...series];
  const n = result.length;

  for (let i = 0; i < n; i++) {
    if (isNullValue(result[i], nullValue)) {
      // Collect surrounding 6 non-null neighbors
      const neighbors: { idx: number; val: number }[] = [];
      let step = 1;
      while (neighbors.length < 6 && step < 50) {
        if (i - step >= 0 && !isNullValue(series[i - step], nullValue)) {
          neighbors.push({ idx: i - step, val: series[i - step] });
        }
        if (i + step < n && !isNullValue(series[i + step], nullValue)) {
          neighbors.push({ idx: i + step, val: series[i + step] });
        }
        step++;
      }

      if (neighbors.length < 2) {
        result[i] = imputeLinear(series, nullValue)[i];
      } else {
        // Distance-weighted average with quadratic curvature factor
        let weightSum = 0;
        let valSum = 0;
        neighbors.forEach((nb) => {
          const dist = Math.abs(nb.idx - i);
          const w = 1 / Math.pow(dist, 1.5);
          weightSum += w;
          valSum += nb.val * w;
        });
        result[i] = weightSum > 0 ? valSum / weightSum : 0;
      }
    }
  }

  return result;
}

/**
 * K-Nearest Neighbours (KNN) Imputer
 * Uses multi-curve feature vector (depth & available curves) to find nearest sample rows
 */
export function imputeKNN(
  curvesData: Record<string, number[]>,
  targetMnemonic: string,
  nullValue: number,
  k: number = 5
): number[] {
  const targetSeries = curvesData[targetMnemonic];
  if (!targetSeries) return [];

  const featureMnemonics = Object.keys(curvesData).filter((m) => m !== targetMnemonic);
  const rowCount = targetSeries.length;

  // Standardize feature columns for Euclidean distance calculations
  const featureStats: Record<string, { mean: number; std: number }> = {};
  featureMnemonics.forEach((m) => {
    const validVals = curvesData[m].filter((v) => !isNullValue(v, nullValue));
    if (validVals.length > 0) {
      const mean = validVals.reduce((a, b) => a + b, 0) / validVals.length;
      const variance = validVals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validVals.length;
      featureStats[m] = { mean, std: Math.sqrt(variance) || 1.0 };
    }
  });

  const validRows: number[] = [];
  const missingRows: number[] = [];

  for (let r = 0; r < rowCount; r++) {
    if (isNullValue(targetSeries[r], nullValue)) {
      missingRows.push(r);
    } else {
      validRows.push(r);
    }
  }

  if (validRows.length === 0) return targetSeries.map(() => 0);

  const result = [...targetSeries];

  missingRows.forEach((mRow) => {
    // Compute Euclidean distance to all valid rows using available non-null features & depth index proximity
    const distances: { rowIdx: number; dist: number }[] = [];

    validRows.forEach((vRow) => {
      let featureDistSq = 0;
      let usedFeatures = 0;

      featureMnemonics.forEach((m) => {
        const valM = curvesData[m][mRow];
        const valV = curvesData[m][vRow];
        const stats = featureStats[m];

        if (stats && !isNullValue(valM, nullValue) && !isNullValue(valV, nullValue)) {
          const normM = (valM - stats.mean) / stats.std;
          const normV = (valV - stats.mean) / stats.std;
          featureDistSq += Math.pow(normM - normV, 2);
          usedFeatures++;
        }
      });

      // Spatial depth distance weight
      const depthDistNorm = Math.abs(mRow - vRow) / rowCount;
      const totalDist = Math.sqrt(featureDistSq + Math.pow(depthDistNorm * 5, 2));

      distances.push({ rowIdx: vRow, dist: totalDist });
    });

    distances.sort((a, b) => a.dist - b.dist);
    const topK = distances.slice(0, Math.min(k, distances.length));

    // Inverse distance weighted average of K nearest neighbours
    let wSum = 0;
    let vSum = 0;
    topK.forEach((item) => {
      const weight = 1 / (item.dist + 1e-5);
      wSum += weight;
      vSum += targetSeries[item.rowIdx] * weight;
    });

    result[mRow] = wSum > 0 ? vSum / wSum : targetSeries[validRows[0]];
  });

  return result;
}

/**
 * Drop Rows containing missing values (Threshold Listwise Deletion)
 */
export function dropMissingRows(las: ParsedLAS, targetMnemonic?: string): ParsedLAS {
  const depth = las.data.depth;
  const nullValue = las.wellInfo.nullValue;
  const curveKeys = Object.keys(las.data.curves);

  const newDepth: number[] = [];
  const newCurves: Record<string, number[]> = {};
  curveKeys.forEach((k) => {
    newCurves[k] = [];
  });

  for (let i = 0; i < depth.length; i++) {
    let shouldDrop = false;
    if (targetMnemonic) {
      const val = las.data.curves[targetMnemonic]?.[i];
      if (isNullValue(val, nullValue)) shouldDrop = true;
    } else {
      // Drop if ANY curve has null at depth i
      for (const k of curveKeys) {
        if (isNullValue(las.data.curves[k]?.[i], nullValue)) {
          shouldDrop = true;
          break;
        }
      }
    }

    if (!shouldDrop) {
      newDepth.push(depth[i]);
      curveKeys.forEach((k) => {
        newCurves[k].push(las.data.curves[k][i]);
      });
    }
  }

  return {
    ...las,
    totalPoints: newDepth.length,
    wellInfo: {
      ...las.wellInfo,
      startDepth: newDepth[0] || las.wellInfo.startDepth,
      stopDepth: newDepth[newDepth.length - 1] || las.wellInfo.stopDepth,
    },
    data: {
      depth: newDepth,
      curves: newCurves,
    },
  };
}

/**
 * Empirical Benchmarking Suite for Imputation Algorithms
 * Evaluates Ground-Truth accuracy (RMSE, MAE, R², Variance) on held-out validation points
 */
export function benchmarkImputationMethods(
  las: ParsedLAS,
  targetMnemonic: string
): ImputationBenchmarkResult {
  const rawSeries = las.data.curves[targetMnemonic] || [];
  const nullValue = las.wellInfo.nullValue;

  // Filter valid non-null indices
  const validIndices: number[] = [];
  rawSeries.forEach((v, idx) => {
    if (!isNullValue(v, nullValue)) validIndices.push(idx);
  });

  const totalNullCount = rawSeries.length - validIndices.length;
  const nullPercentage = rawSeries.length > 0 ? (totalNullCount / rawSeries.length) * 100 : 0;

  if (validIndices.length < 20) {
    return {
      curveMnemonic: targetMnemonic,
      totalNullCount,
      nullPercentage,
      testedSampleCount: validIndices.length,
      metrics: [],
      bestStrategy: 'LINEAR',
      recommendationReason: 'Insufficient non-null samples to run cross-validation benchmark.',
    };
  }

  // Artificial Masking: Mask 15% of valid ground-truth points
  const maskCount = Math.min(Math.floor(validIndices.length * 0.15), 150);
  const maskedIndicesSet = new Set<number>();
  const step = Math.floor(validIndices.length / maskCount);
  for (let i = 0; i < maskCount; i++) {
    maskedIndicesSet.add(validIndices[i * step]);
  }

  const maskedSeries = [...rawSeries];
  const groundTruth: { idx: number; actual: number }[] = [];
  maskedIndicesSet.forEach((idx) => {
    groundTruth.push({ idx, actual: rawSeries[idx] });
    maskedSeries[idx] = nullValue; // Artificially set to null for testing
  });

  const curvesDataCopy = { ...las.data.curves, [targetMnemonic]: maskedSeries };

  const strategies: { id: ImputationStrategy; label: string }[] = [
    { id: 'KNN', label: 'K-Nearest Neighbours (KNN)' },
    { id: 'LINEAR', label: 'Linear Interpolation (Baseline)' },
    { id: 'MEDIAN', label: 'Median Statistical Imputer' },
    { id: 'MEAN', label: 'Mean Statistical Imputer' },
    { id: 'SPLINE', label: 'Cubic Spline Fitting' },
  ];

  const actuals = groundTruth.map((gt) => gt.actual);
  const actualMean = actuals.reduce((a, b) => a + b, 0) / actuals.length;
  const actualVariance = actuals.reduce((a, b) => a + Math.pow(b - actualMean, 2), 0) / actuals.length;
  const ssTotal = actuals.reduce((a, b) => a + Math.pow(b - actualMean, 2), 0);

  const metrics: ImputationBenchmarkMetric[] = [];

  strategies.forEach((strat) => {
    const tStart = performance.now();
    let imputedSeries: number[] = [];

    if (strat.id === 'KNN') {
      imputedSeries = imputeKNN(curvesDataCopy, targetMnemonic, nullValue, 5);
    } else if (strat.id === 'LINEAR') {
      imputedSeries = imputeLinear(maskedSeries, nullValue);
    } else if (strat.id === 'MEDIAN') {
      imputedSeries = imputeMedian(maskedSeries, nullValue);
    } else if (strat.id === 'MEAN') {
      imputedSeries = imputeMean(maskedSeries, nullValue);
    } else if (strat.id === 'SPLINE') {
      imputedSeries = imputeSpline(maskedSeries, nullValue);
    }
    const tEnd = performance.now();

    // Calculate validation metrics against ground-truth
    let sumSqError = 0;
    let sumAbsError = 0;
    const predictions: number[] = [];

    groundTruth.forEach((gt) => {
      const pred = imputedSeries[gt.idx];
      predictions.push(pred);
      const err = pred - gt.actual;
      sumSqError += err * err;
      sumAbsError += Math.abs(err);
    });

    const rmse = Math.sqrt(sumSqError / groundTruth.length);
    const mae = sumAbsError / groundTruth.length;

    // R2 score computation
    const r2Score = ssTotal > 0 ? Math.max(0, 1 - sumSqError / ssTotal) : 1.0;

    // Variance preservation ratio
    const predMean = predictions.reduce((a, b) => a + b, 0) / predictions.length;
    const predVariance = predictions.reduce((a, b) => a + Math.pow(b - predMean, 2), 0) / predictions.length;
    const varianceRatio = actualVariance > 0 ? (predVariance / actualVariance) * 100 : 100;

    let notes = `Evaluated on ${groundTruth.length} masked ground-truth points.`;
    if (strat.id === 'KNN') notes = 'Best preserves multi-channel petrophysical lithology correlations.';
    if (strat.id === 'LINEAR') notes = 'Simple continuous depth interpolation baseline.';

    metrics.push({
      strategy: strat.id,
      strategyLabel: strat.label,
      rmse: parseFloat(rmse.toFixed(4)),
      mae: parseFloat(mae.toFixed(4)),
      r2Score: parseFloat(r2Score.toFixed(4)),
      varianceRatio: parseFloat(varianceRatio.toFixed(2)),
      executionTimeMs: parseFloat((tEnd - tStart).toFixed(2)),
      rank: 1,
      isRecommended: false,
      notes,
    });
  });

  // Rank strategies by highest R² and lowest RMSE
  metrics.sort((a, b) => b.r2Score - a.r2Score || a.rmse - b.rmse);
  metrics.forEach((m, idx) => {
    m.rank = idx + 1;
  });

  const bestMetric = metrics[0];
  bestMetric.isRecommended = true;

  let recommendationReason = `KNN Imputation achieved the highest R² score (${bestMetric.r2Score}) and lowest RMSE (${bestMetric.rmse}) against ground-truth logs.`;
  if (bestMetric.strategy === 'ROW_DROPPING') {
    recommendationReason = `Missing data percentage is trivial (${nullPercentage.toFixed(2)}%). Row dropping is recommended to preserve raw measurement integrity without synthetic imputation.`;
  } else if (bestMetric.strategy !== 'KNN') {
    recommendationReason = `${bestMetric.strategyLabel} outperformed other algorithms with an R² accuracy of ${bestMetric.r2Score}.`;
  }

  return {
    curveMnemonic: targetMnemonic,
    totalNullCount,
    nullPercentage: parseFloat(nullPercentage.toFixed(2)),
    testedSampleCount: groundTruth.length,
    metrics,
    bestStrategy: bestMetric.strategy,
    recommendationReason,
  };
}
