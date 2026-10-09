from __future__ import annotations

import time
import warnings
from typing import Dict, List, Optional, Tuple

import numpy as np
from scipy.interpolate import PchipInterpolator
from sklearn.impute import KNNImputer

from backend.app.schemas.imputation import (
    ImputationBenchmarkMetric,
    ImputationBenchmarkResult,
    ImputationStrategy,
)
from backend.app.services.curve_utils import null_mask, to_float_array, true_runs

KNN_WINDOW_ROWS = 10000
BENCHMARK_SEED = 42
BENCHMARK_sMAX_MASKED = 150

_STRATEGY_LABELS: Dict[str, str] = {
    "KNN": "K-Nearest Neighbours (KNN)",
    "LINEAR": "Linear Interpolation (Baseline)",
    "MEDIAN": "Median Statistical Imputer",
    "MEAN": "Mean Statistical Imputer",
    "SPLINE": "Monotone Cubic Spline (PCHIP)",
}

_BENCHMARK_STRATEGIES: List[ImputationStrategy] = ["KNN", "LINEAR", "MEDIAN", "MEAN", "SPLINE"]


def _null_mask(series: List[float], null_value: float) -> np.ndarray:
    return null_mask(series, null_value)


def _nan_array(series: List[float], null_value: float) -> np.ndarray:
    arr = to_float_array(series).copy()
    arr[null_mask(arr, null_value)] = np.nan
    return arr


def _fill_nulls(series: List[float], null_idx: np.ndarray, filled: np.ndarray) -> List[float]:
    result = list(series)
    for i in null_idx:
        result[int(i)] = float(filled[int(i)])
    return result


def impute_linear(series: List[float], null_value: float) -> List[float]:
    """Linear interpolation; leading/trailing nulls take the nearest valid value."""
    arr = _nan_array(series, null_value)
    valid = ~np.isnan(arr)
    if not valid.any() or valid.all():
        return list(series)
    idx = np.arange(arr.size)
    filled = np.interp(idx, idx[valid], arr[valid])
    return _fill_nulls(series, np.flatnonzero(~valid), filled)


def impute_mean(series: List[float], null_value: float) -> List[float]:
    arr = _nan_array(series, null_value)
    valid = ~np.isnan(arr)
    if not valid.any() or valid.all():
        return list(series)
    filled = np.full(arr.size, float(arr[valid].mean()))
    return _fill_nulls(series, np.flatnonzero(~valid), filled)


def impute_median(series: List[float], null_value: float) -> List[float]:
    arr = _nan_array(series, null_value)
    valid = ~np.isnan(arr)
    if not valid.any() or valid.all():
        return list(series)
    filled = np.full(arr.size, float(np.median(arr[valid])))
    return _fill_nulls(series, np.flatnonzero(~valid), filled)


def impute_spline(series: List[float], null_value: float) -> List[float]:
    """Monotone cubic (PCHIP) interpolation; edges take the nearest valid value."""
    arr = _nan_array(series, null_value)
    valid = ~np.isnan(arr)
    if not valid.any() or valid.all():
        return list(series)
    if valid.sum() < 2:
        return impute_linear(series, null_value)
    idx = np.arange(arr.size)
    interp = PchipInterpolator(idx[valid], arr[valid], extrapolate=False)
    filled = interp(idx)
    edge = np.interp(idx, idx[valid], arr[valid])
    filled = np.where(np.isnan(filled), edge, filled)
    return _fill_nulls(series, np.flatnonzero(~valid), filled)


def impute_knn_all(
    curves_data: Dict[str, List[float]],
    null_value: float,
    k: int = 5,
    targets: Optional[List[str]] = None,
) -> Dict[str, List[float]]:
    """
    Impute several curves with a single KNN fit per window. Returns
    {mnemonic: values} for every requested target (default: all curves). A curve
    with no valid samples in a window is left as it was there.
    """
    mnemonics = list(curves_data.keys())
    wanted = [m for m in (targets if targets is not None else mnemonics) if m in curves_data]
    if not mnemonics or not wanted:
        return {}

    n = max(len(curves_data[m]) for m in mnemonics)
    matrix = np.full((n, len(mnemonics)), np.nan)
    for j, m in enumerate(mnemonics):
        col = _nan_array(curves_data[m], null_value)
        matrix[: col.size, j] = col

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)  # all-NaN columns are expected
        means = np.nanmean(matrix, axis=0) if n else np.array([])
        stds = np.nanstd(matrix, axis=0) if n else np.array([])
    means = np.where(np.isfinite(means), means, 0.0)
    stds = np.where(np.isfinite(stds) & (stds > 0), stds, 1.0)
    scaled = (matrix - means) / stds
    row_pos = (np.arange(n) / max(n, 1) * 5.0).reshape(-1, 1)

    imputed_scaled = scaled.copy()
    for start in range(0, n, KNN_WINDOW_ROWS):
        stop = min(start + KNN_WINDOW_ROWS, n)
        block = scaled[start:stop]
        has_data = np.isfinite(block).any(axis=0)
        if not has_data.any() or stop - start < 2:
            continue
        cols = np.flatnonzero(has_data)
        features = np.hstack([block[:, cols], row_pos[start:stop]])
        imputer = KNNImputer(n_neighbors=max(1, min(k, stop - start - 1)), weights="distance")
        out = imputer.fit_transform(features)
        imputed_scaled[start:stop, cols] = out[:, : len(cols)]

    restored = imputed_scaled * stds + means
    results: Dict[str, List[float]] = {}
    for m in wanted:
        j = mnemonics.index(m)
        original = list(curves_data[m])
        mask = null_mask(original, null_value)
        for i in np.flatnonzero(mask):
            val = restored[int(i), j] if int(i) < n else np.nan
            if np.isfinite(val):
                original[int(i)] = float(val)
        results[m] = original
    return results


def impute_knn(
    curves_data: Dict[str, List[float]],
    target_mnemonic: str,
    null_value: float,
    k: int = 5,
) -> List[float]:
    if target_mnemonic not in curves_data:
        return []
    return impute_knn_all(curves_data, null_value, k, [target_mnemonic])[target_mnemonic]


def drop_missing_rows(
    depth: List[float],
    curves: Dict[str, List[float]],
    null_value: float,
    target_mnemonic: Optional[str] = None,
) -> Dict:
    n = len(depth)
    keys = list(curves.keys())

    def _col_mask(m: str) -> np.ndarray:
        mk = null_mask(curves[m], null_value)
        if mk.size < n:  # a short column is missing data at the end
            mk = np.concatenate([mk, np.ones(n - mk.size, dtype=bool)])
        return mk[:n]

    if target_mnemonic:
        drop = _col_mask(target_mnemonic) if target_mnemonic in curves else np.zeros(n, dtype=bool)
    elif keys:
        drop = np.zeros(n, dtype=bool)
        for m in keys:
            drop |= _col_mask(m)
    else:
        drop = np.zeros(n, dtype=bool)

    keep = np.flatnonzero(~drop)
    new_depth = [depth[i] for i in keep]
    new_curves = {m: [curves[m][i] for i in keep if i < len(curves[m])] for m in keys}
    return {
        "depth": new_depth,
        "curves": new_curves,
        "totalPoints": len(new_depth),
        "startDepth": new_depth[0] if new_depth else (depth[0] if depth else 0.0),
        "stopDepth": new_depth[-1] if new_depth else (depth[-1] if depth else 0.0),
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
    if strategy == "LINEAR":
        return impute_linear(series, null_value)
    if strategy == "MEDIAN":
        return impute_median(series, null_value)
    if strategy == "MEAN":
        return impute_mean(series, null_value)
    if strategy == "SPLINE":
        return impute_spline(series, null_value)
    # ROW_DROPPING removes rows; it has no per-value result. Use drop_missing_rows.
    return list(series)


def _choose_masked_gaps(
    valid: np.ndarray, natural_runs: List[Tuple[int, int]]
) -> Tuple[np.ndarray, int]:
    """Pick realistic gaps to hide for the benchmark. Returns (indices, gap_length)."""
    n = valid.size
    n_valid = int(valid.sum())
    budget = max(1, min(int(n_valid * 0.15), BENCHMARK_MAX_MASKED))
    lengths = [e - s for s, e in natural_runs]
    gap_len = int(np.clip(np.median(lengths) if lengths else 10, 3, 30))
    gap_len = min(gap_len, max(1, budget))

    window_ok = np.convolve(valid.astype(int), np.ones(gap_len, dtype=int), mode="valid") == gap_len
    candidates = [int(s) for s in np.flatnonzero(window_ok) if s >= 1 and s + gap_len <= n - 1]

    rng = np.random.default_rng(BENCHMARK_SEED)
    chosen: List[int] = []
    for s in rng.permutation(candidates) if candidates else []:
        s = int(s)
        if all(abs(s - c) >= gap_len + 2 for c in chosen):
            chosen.append(s)
        if len(chosen) * gap_len >= budget:
            break

    if chosen:
        idx = np.concatenate([np.arange(s, s + gap_len) for s in sorted(chosen)])
        return idx, gap_len

    # Too short for gap blocks: fall back to evenly spaced single samples.
    valid_idx = np.flatnonzero(valid)
    step = max(len(valid_idx) // budget, 1)
    return valid_idx[::step][:budget], 1


def benchmark_imputation_methods(
    depth: List[float],
    curves: Dict[str, List[float]],
    target_mnemonic: str,
    null_value: float,
) -> ImputationBenchmarkResult:
    raw_series = curves.get(target_mnemonic, [])
    mask = _null_mask(raw_series, null_value)
    valid = ~mask
    valid_count = int(valid.sum())

    total_null_count = int(mask.sum())
    null_percentage = (total_null_count / len(raw_series) * 100.0) if len(raw_series) else 0.0

    if valid_count < 20:
        return ImputationBenchmarkResult(
            curveMnemonic=target_mnemonic,
            totalNullCount=total_null_count,
            nullPercentage=null_percentage,
            testedSampleCount=valid_count,
            metrics=[],
            bestStrategy="LINEAR",
            recommendationReason="Insufficient non-null samples to run cross-validation benchmark.",
        )

    masked_idx, gap_len = _choose_masked_gaps(valid, true_runs(mask))
    raw_arr = to_float_array(raw_series)
    actuals = raw_arr[masked_idx]
    masked_series = list(raw_series)
    for i in masked_idx:
        masked_series[int(i)] = null_value

    curves_copy = dict(curves)
    curves_copy[target_mnemonic] = masked_series

    actual_mean = actuals.mean()
    actual_variance = ((actuals - actual_mean) ** 2).mean()
    ss_total = float(((actuals - actual_mean) ** 2).sum())
    n_gaps = max(1, len(masked_idx) // max(gap_len, 1))

    metrics: List[ImputationBenchmarkMetric] = []
    for strategy in _BENCHMARK_STRATEGIES:
        t_start = time.perf_counter()
        imputed = run_single_strategy(curves_copy, target_mnemonic, strategy, null_value)
        t_end = time.perf_counter()

        predictions = to_float_array([imputed[int(i)] for i in masked_idx])
        errors = predictions - actuals
        sum_sq = float((errors ** 2).sum())
        rmse = (sum_sq / len(actuals)) ** 0.5
        mae = float(np.abs(errors).sum()) / len(actuals)
        r2 = (1.0 - sum_sq / ss_total) if ss_total > 0 else 1.0
        pred_var = ((predictions - predictions.mean()) ** 2).mean()
        variance_ratio = (pred_var / actual_variance * 100.0) if actual_variance > 0 else 100.0

        metrics.append(
            ImputationBenchmarkMetric(
                strategy=strategy,
                strategyLabel=_STRATEGY_LABELS[strategy],
                rmse=round(rmse, 4),
                mae=round(mae, 4),
                r2Score=round(r2, 4),
                varianceRatio=round(variance_ratio, 2),
                executionTimeMs=round((t_end - t_start) * 1000.0, 2),
                rank=1,
                isRecommended=False,
                notes=f"Evaluated on {len(actuals)} hidden samples in {n_gaps} gap(s) of about {gap_len} sample(s).",
            )
        )

    metrics.sort(key=lambda m: (-m.r2Score, m.rmse))
    for pos, m in enumerate(metrics):
        m.rank = pos + 1
    best = metrics[0]
    best.isRecommended = True

    return ImputationBenchmarkResult(
        curveMnemonic=target_mnemonic,
        totalNullCount=total_null_count,
        nullPercentage=round(null_percentage, 2),
        testedSampleCount=len(actuals),
        metrics=metrics,
        bestStrategy=best.strategy,
        recommendationReason=(
            f"{best.strategyLabel} achieved the highest R² ({best.r2Score}) and RMSE {best.rmse} "
            f"when {n_gaps} gap(s) of about {gap_len} sample(s) were hidden and recovered."
        ),
    )
