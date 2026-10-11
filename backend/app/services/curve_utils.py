from __future__ import annotations

from typing import List, Optional, Sequence, Tuple

import numpy as np

HARD_NULL_SENTINELS = (-999.25, -9999.0, 999.25, -999.9)

# A spike is a sample further than SPIKE_SIGMA standard deviations from BOTH of
# its immediate neighbours. QA flags with this and the cleaner repairs with it.
SPIKE_SIGMA = 4.5
SPIKE_MIN_STD = 0.001
SPIKE_MIN_VALID_SAMPLES = 5

# Spike and cycle-skip checks run on the sonic log only (standard name below).
SONIC_CURVES = frozenset({"DT"})

# Cycle skip: a short block (SKIP_MIN_RUN..SKIP_MAX_RUN samples) that reads more
# than SKIP_RISE_FRACTION above the rolling median of the surrounding
# SKIP_WINDOW samples. A single sample is a spike, not a cycle skip.
SKIP_WINDOW = 51
SKIP_RISE_FRACTION = 0.20
SKIP_MIN_RUN = 2
SKIP_MAX_RUN = 24

# More than FLATLINE_MIN_RUN identical consecutive samples = stuck sensor.
FLATLINE_MIN_RUN = 25
FLATLINE_TOLERANCE = 1e-5
# Curves that are legitimately constant over long intervals (bit size is set by
# the drill bit, depth indexes never repeat). Never flag or null these.
FLATLINE_EXEMPT = frozenset({"DEPT", "TVD", "BS"})

# A run of at least this many consecutive nulls is a "cluster".
NULL_CLUSTER_MIN_RUN = 10
# Every run of at least this many nulls is LISTED as an anomaly (1 = every null).
# Runs shorter than NULL_CLUSTER_MIN_RUN are listed as INFO and cost no points.
NULL_REPORT_MIN_RUN = 1


def is_null_value(val: Optional[float], null_value: Optional[float]) -> bool:
    """Scalar null test. Same rules as `null_mask`."""
    if val is None:
        return True
    try:
        fval = float(val)
    except (TypeError, ValueError):
        return True
    if fval != fval or fval in (float("inf"), float("-inf")):
        return True
    if null_value is not None and abs(fval - null_value) < 0.01:
        return True
    return fval in HARD_NULL_SENTINELS


def to_float_array(values: Sequence) -> np.ndarray:
    """Float array from a list that may hold None or junk (junk becomes NaN)."""
    try:
        return np.asarray(values, dtype=float)
    except (TypeError, ValueError):
        out = np.empty(len(values), dtype=float)
        for i, v in enumerate(values):
            try:
                out[i] = float(v)
            except (TypeError, ValueError):
                out[i] = np.nan
        return out


def null_mask(values: Sequence, null_value: Optional[float]) -> np.ndarray:
    """Vectorised null test: NaN/Inf, the file's NULL value, or a common sentinel."""
    arr = to_float_array(values)
    mask = ~np.isfinite(arr)
    if null_value is not None:
        with np.errstate(invalid="ignore"):
            mask |= np.abs(arr - null_value) < 0.01
    for sentinel in HARD_NULL_SENTINELS:
        mask |= arr == sentinel
    return mask


def true_runs(mask: np.ndarray) -> List[Tuple[int, int]]:
    """(start, end_exclusive) for every run of True in a boolean array."""
    if mask.size == 0:
        return []
    padded = np.concatenate(([False], mask.astype(bool), [False])).astype(np.int8)
    d = np.diff(padded)
    starts = np.flatnonzero(d == 1)
    ends = np.flatnonzero(d == -1)
    return list(zip(starts.tolist(), ends.tolist()))


def find_spikes(values: np.ndarray, nulls: np.ndarray, sigma: float = SPIKE_SIGMA) -> np.ndarray:
    """
    Indices of spike samples. A spike needs a valid sample on each side (adjacent,
    not just "the next valid one") and must differ from both by more than
    sigma * std, where std is taken over all valid samples.
    """
    n = len(values)
    if n < 3:
        return np.array([], dtype=int)
    valid = values[~nulls]
    if valid.size < SPIKE_MIN_VALID_SAMPLES:
        return np.array([], dtype=int)
    std = float(np.std(valid))
    if std < SPIKE_MIN_STD:
        return np.array([], dtype=int)
    thr = sigma * std
    with np.errstate(invalid="ignore"):
        usable = ~(nulls[1:-1] | nulls[:-2] | nulls[2:])
        hit = (
            usable
            & (np.abs(values[1:-1] - values[:-2]) > thr)
            & (np.abs(values[1:-1] - values[2:]) > thr)
        )
    return np.flatnonzero(hit) + 1


def find_cycle_skips(
    values: np.ndarray,
    nulls: np.ndarray,
    window: int = SKIP_WINDOW,
    rise: float = SKIP_RISE_FRACTION,
    min_run: int = SKIP_MIN_RUN,
    max_run: int = SKIP_MAX_RUN,
) -> List[Tuple[int, int]]:
    """
    (start, end_exclusive) of cycle-skip blocks in a sonic (DT) curve: runs of
    min_run..max_run consecutive valid samples sitting more than `rise` (fraction)
    above the rolling median. Only upward jumps count (a skip makes DT too slow).
    """
    idx = np.flatnonzero(~nulls)
    if idx.size < max(window // 2, SPIKE_MIN_VALID_SAMPLES):
        return []
    v = values[idx]
    med = np.empty_like(v)
    half = window // 2
    # rolling median without pandas: simple loop over compact valid samples
    for k in range(v.size):
        lo, hi = max(0, k - half), min(v.size, k + half + 1)
        med[k] = np.median(v[lo:hi])
    high_c = (med > 0) & (v > med * (1.0 + rise))
    # Scatter back to full length so a run can never bridge a null gap.
    high = np.zeros(len(values), dtype=bool)
    high[idx] = high_c
    out: List[Tuple[int, int]] = []
    for a, b in true_runs(high):
        if min_run <= (b - a) <= max_run:
            out.append((int(a), int(b)))
    return out


def find_sonic_events(
    values: np.ndarray, nulls: np.ndarray, sigma: float = SPIKE_SIGMA
) -> Tuple[np.ndarray, List[Tuple[int, int]]]:
    """
    (spike_indices, cycle_skip_runs) for a sonic curve. Samples inside a cycle-skip
    block are reported as part of that block only, never also as spikes.
    """
    skips = find_cycle_skips(values, nulls)
    spikes = find_spikes(values, nulls, sigma)
    if skips and spikes.size:
        inside = np.zeros(len(values), dtype=bool)
        for a, b in skips:
            inside[a:b] = True
        spikes = spikes[~inside[spikes]]
    return spikes, skips




def find_flatline_runs(
    values: np.ndarray,
    nulls: np.ndarray,
    min_run: int = FLATLINE_MIN_RUN,
    tol: float = FLATLINE_TOLERANCE,
) -> List[Tuple[int, int]]:
    """(start, end_exclusive) of runs longer than `min_run` identical adjacent samples."""
    n = len(values)
    if n <= min_run:
        return []
    same = np.zeros(n, dtype=bool)
    with np.errstate(invalid="ignore"):
        same[1:] = (np.abs(values[1:] - values[:-1]) < tol) & ~nulls[1:] & ~nulls[:-1]
    run_id = np.cumsum(~same)  # non-decreasing; a new id starts wherever `same` is False
    valid_idx = np.flatnonzero(~nulls)
    if valid_idx.size == 0:
        return []
    counts = np.bincount(run_id[valid_idx], minlength=int(run_id[-1]) + 1)
    runs: List[Tuple[int, int]] = []
    for rid in np.flatnonzero(counts > min_run):
        start = int(np.searchsorted(run_id, rid, side="left"))
        end = int(np.searchsorted(run_id, rid, side="right"))
        runs.append((start, end))
    return runs