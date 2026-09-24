"""
Port of the imputation + benchmarking logic from
src/lib/las/imputation-engine.ts, rebuilt on pandas/numpy with sklearn's
KNNImputer doing the heavy numerical lifting (per the Sprint 4 CE2 decision:
Python owns everything imputation/benchmark-related; TS keeps parsing +
quality scoring).

Strategy definitions (LINEAR / MEAN / MEDIAN / SPLINE) are kept as faithful
element-for-element ports of the TS versions so single-strategy calls match
the old client-side behavior. KNN is intentionally NOT a port of the TS
hand-rolled distance calc — it's real sklearn.impute.KNNImputer, run over a
standardized feature matrix (all curves) plus a scaled depth-position
column standing in for the TS version's explicit depth-distance term.
Because the underlying algorithm differs, KNN metrics will differ from
historical TS-produced numbers; every other strategy should match closely.
"""

from __future__ import annotations

import time
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.impute import KNNImputer

from .diagnostics import is_null_value
from .models import ImputationBenchmarkMetric, ImputationBenchmarkResult

_STRATEGY_LABELS = {
    "KNN": "K-Nearest Neighbours (KNN)",
    "LINEAR": "Linear Interpolation (Baseline)",
    "MEDIAN": "Median Statistical Imputer",
    "MEAN": "Mean Statistical Imputer",
    "SPLINE": "Cubic Spline Fitting",
}

_BENCHMARK_STRATEGIES = ["KNN", "LINEAR", "MEDIAN", "MEAN", "SPLINE"]


def _null_mask(series: List[float], null_value: float) -> np.ndarray:
    return np.array([is_null_value(v, null_value) for v in series], dtype=bool)


def impute_linear(series: List[float], null_value: float) -> List[float]:
    result = list(series)
    n = len(result)
    mask = _null_mask(result, null_value)

    i = 0
    while i < n:
        if mask[i]:
            start = i - 1
            while i < n and mask[i]:
                i += 1
            end = i

            left_val = result[start] if start >= 0 else (result[end] if end < n else 0.0)
            right_val = result[end] if end < n else (result[start] if start >= 0 else 0.0)

            count = end - start - 1
            for j in range(1, count + 1):
                idx = start + j
                if start < 0 and end >= n:
                    result[idx] = 0.0
                elif start < 0:
                    result[idx] = right_val
                elif end >= n:
                    result[idx] = left_val
                else:
                    t = j / (count + 1)
                    result[idx] = left_val + t * (right_val - left_val)
        else:
            i += 1

    return result


def impute_mean(series: List[float], null_value: float) -> List[float]:
    mask = _null_mask(series, null_value)
    valid = [v for v, m in zip(series, mask) if not m]
    if not valid:
        return [0.0] * len(series)
    mean = sum(valid) / len(valid)
    return [mean if m else v for v, m in zip(series, mask)]


def impute_median(series: List[float], null_value: float) -> List[float]:
    mask = _null_mask(series, null_value)
    valid = sorted(v for v, m in zip(series, mask) if not m)
    if not valid:
        return [0.0] * len(series)
    mid = len(valid) // 2
    median = valid[mid] if len(valid) % 2 != 0 else (valid[mid - 1] + valid[mid]) / 2
    return [median if m else v for v, m in zip(series, mask)]


def impute_spline(series: List[float], null_value: float) -> List[float]:
    result = list(series)
    n = len(result)
    mask = _null_mask(series, null_value)

    for i in range(n):
        if not mask[i]:
            continue

        neighbors: List[Tuple[int, float]] = []
        step = 1
        while len(neighbors) < 6 and step < 50:
            if i - step >= 0 and not mask[i - step]:
                neighbors.append((i - step, series[i - step]))
            if i + step < n and not mask[i + step]:
                neighbors.append((i + step, series[i + step]))
            step += 1

        if len(neighbors) < 2:
            result[i] = impute_linear(series, null_value)[i]
        else:
            weight_sum = 0.0
            val_sum = 0.0
            for idx, val in neighbors:
                dist = abs(idx - i)
                w = 1 / (dist ** 1.5)
                weight_sum += w
                val_sum += val * w
            result[i] = val_sum / weight_sum if weight_sum > 0 else 0.0

    return result


def impute_knn(
    curves_data: Dict[str, List[float]],
    target_mnemonic: str,
    null_value: float,
    k: int = 5,
) -> List[float]:
    """
    sklearn.impute.KNNImputer over a standardized multi-curve feature matrix.

    Columns: every curve (features + target), each null-standardized via
    (x - mean_of_valid) / std_of_valid — mirroring the TS version's
    per-feature z-scoring — plus a scaled row-position column that stands
    in for the TS version's explicit depth-distance penalty term.
    """
    target_series = curves_data.get(target_mnemonic)
    if target_series is None:
        return []

    row_count = len(target_series)
    mnemonics = list(curves_data.keys())

    df = pd.DataFrame({m: curves_data[m] for m in mnemonics})
    # Standardize null representations to real NaN for every column
    for m in mnemonics:
        df[m] = df[m].apply(lambda v, nv=null_value: np.nan if is_null_value(v, nv) else float(v))

    # z-score each column on its own valid values (matches TS featureStats)
    scaled = pd.DataFrame(index=df.index)
    stats: Dict[str, Tuple[float, float]] = {}
    for m in mnemonics:
        col = df[m]
        mean = col.mean(skipna=True)
        std = col.std(skipna=True, ddof=0)
        std = std if (std and std > 0) else 1.0
        mean = mean if pd.notna(mean) else 0.0
        stats[m] = (mean, std)
        scaled[m] = (col - mean) / std

    # Depth-position proxy, scaled the same way the TS code weights it
    # (depthDistNorm * 5 before squaring) so nearby rows are preferred.
    row_idx = np.arange(row_count)
    scaled["__row_pos__"] = (row_idx / max(row_count, 1)) * 5

    imputer = KNNImputer(n_neighbors=min(k, max(row_count - 1, 1)), weights="distance")
    imputed = imputer.fit_transform(scaled.to_numpy())
    imputed_df = pd.DataFrame(imputed, columns=list(scaled.columns), index=scaled.index)

    target_mean, target_std = stats[target_mnemonic]
    restored = imputed_df[target_mnemonic] * target_std + target_mean

    # Only overwrite originally-null positions; keep observed values exact.
    result = list(target_series)
    for i in range(row_count):
        if is_null_value(target_series[i], null_value):
            val = restored.iloc[i]
            result[i] = float(val) if pd.notna(val) else (result[i] if i > 0 else 0.0)
    return result


def drop_missing_rows(
    depth: List[float],
    curves: Dict[str, List[float]],
    null_value: float,
    target_mnemonic: Optional[str] = None,
) -> Dict:
    curve_keys = list(curves.keys())
    new_depth: List[float] = []
    new_curves: Dict[str, List[float]] = {k: [] for k in curve_keys}

    for i in range(len(depth)):
        if target_mnemonic:
            should_drop = is_null_value(curves.get(target_mnemonic, [None] * len(depth))[i], null_value)
        else:
            should_drop = any(is_null_value(curves[k][i], null_value) for k in curve_keys)

        if not should_drop:
            new_depth.append(depth[i])
            for k in curve_keys:
                new_curves[k].append(curves[k][i])

    return {
        "depth": new_depth,
        "curves": new_curves,
        "totalPoints": len(new_depth),
        "startDepth": new_depth[0] if new_depth else (depth[0] if depth else 0.0),
        "stopDepth": new_depth[-1] if new_depth else (depth[-1] if depth else 0.0),
    }


_STRATEGY_FN = {
    "LINEAR": lambda series, curves, target, null_value: impute_linear(series, null_value),
    "MEDIAN": lambda series, curves, target, null_value: impute_median(series, null_value),
    "MEAN": lambda series, curves, target, null_value: impute_mean(series, null_value),
    "SPLINE": lambda series, curves, target, null_value: impute_spline(series, null_value),
    "KNN": lambda series, curves, target, null_value: impute_knn(curves, target, null_value, 5),
}


def run_single_strategy(
    curves: Dict[str, List[float]],
    target_mnemonic: str,
    strategy: str,
    null_value: float,
    k: int = 5,
) -> List[float]:
    series = curves[target_mnemonic]
    if strategy == "KNN":
        return impute_knn(curves, target_mnemonic, null_value, k)
    return _STRATEGY_FN[strategy](series, curves, target_mnemonic, null_value)


def benchmark_imputation_methods(
    depth: List[float],
    curves: Dict[str, List[float]],
    target_mnemonic: str,
    null_value: float,
) -> ImputationBenchmarkResult:
    raw_series = curves.get(target_mnemonic, [])
    mask = _null_mask(raw_series, null_value)
    valid_indices = [i for i, m in enumerate(mask) if not m]

    total_null_count = len(raw_series) - len(valid_indices)
    null_percentage = (total_null_count / len(raw_series) * 100) if raw_series else 0.0

    if len(valid_indices) < 20:
        return ImputationBenchmarkResult(
            curveMnemonic=target_mnemonic,
            totalNullCount=total_null_count,
            nullPercentage=null_percentage,
            testedSampleCount=len(valid_indices),
            metrics=[],
            bestStrategy="LINEAR",
            recommendationReason="Insufficient non-null samples to run cross-validation benchmark.",
        )

    # Artificial masking: hold out 15% of valid ground-truth points (cap 150)
    mask_count = min(int(len(valid_indices) * 0.15), 150)
    mask_count = max(mask_count, 1)
    step = max(len(valid_indices) // mask_count, 1)

    masked_indices_set = set()
    for i in range(mask_count):
        pos = i * step
        if pos < len(valid_indices):
            masked_indices_set.add(valid_indices[pos])

    masked_series = list(raw_series)
    ground_truth: List[Tuple[int, float]] = []
    for idx in sorted(masked_indices_set):
        ground_truth.append((idx, raw_series[idx]))
        masked_series[idx] = null_value

    curves_copy = dict(curves)
    curves_copy[target_mnemonic] = masked_series

    actuals = np.array([gt[1] for gt in ground_truth])
    actual_mean = actuals.mean()
    actual_variance = ((actuals - actual_mean) ** 2).mean()
    ss_total = ((actuals - actual_mean) ** 2).sum()

    metrics: List[ImputationBenchmarkMetric] = []

    for strategy in _BENCHMARK_STRATEGIES:
        t_start = time.perf_counter()
        imputed_series = run_single_strategy(curves_copy, target_mnemonic, strategy, null_value)
        t_end = time.perf_counter()

        predictions = np.array([imputed_series[idx] for idx, _ in ground_truth])
        errors = predictions - actuals

        sum_sq_error = float((errors ** 2).sum())
        sum_abs_error = float(np.abs(errors).sum())

        rmse = (sum_sq_error / len(ground_truth)) ** 0.5
        mae = sum_abs_error / len(ground_truth)
        r2_score = (1 - sum_sq_error / ss_total) if ss_total > 0 else 1.0

        pred_mean = predictions.mean()
        pred_variance = ((predictions - pred_mean) ** 2).mean()
        variance_ratio = (pred_variance / actual_variance * 100) if actual_variance > 0 else 100.0

        notes = f"Evaluated on {len(ground_truth)} masked ground-truth points."
        if strategy == "KNN":
            notes = "Best preserves multi-channel petrophysical lithology correlations."
        elif strategy == "LINEAR":
            notes = "Simple continuous depth interpolation baseline."

        metrics.append(
            ImputationBenchmarkMetric(
                strategy=strategy,
                strategyLabel=_STRATEGY_LABELS[strategy],
                rmse=round(rmse, 4),
                mae=round(mae, 4),
                r2Score=round(r2_score, 4),
                varianceRatio=round(variance_ratio, 2),
                executionTimeMs=round((t_end - t_start) * 1000, 2),
                rank=1,
                isRecommended=False,
                notes=notes,
            )
        )

    metrics.sort(key=lambda m: (-m.r2Score, m.rmse))
    for idx, m in enumerate(metrics):
        m.rank = idx + 1

    best_metric = metrics[0]
    best_metric.isRecommended = True

    recommendation_reason = (
        f"KNN Imputation achieved the highest R\u00b2 score ({best_metric.r2Score}) and "
        f"lowest RMSE ({best_metric.rmse}) against ground-truth logs."
    )
    if best_metric.strategy != "KNN":
        recommendation_reason = (
            f"{best_metric.strategyLabel} outperformed other algorithms with an "
            f"R\u00b2 accuracy of {best_metric.r2Score}."
        )

    return ImputationBenchmarkResult(
        curveMnemonic=target_mnemonic,
        totalNullCount=total_null_count,
        nullPercentage=round(null_percentage, 2),
        testedSampleCount=len(ground_truth),
        metrics=metrics,
        bestStrategy=best_metric.strategy,
        recommendationReason=recommendation_reason,
    )