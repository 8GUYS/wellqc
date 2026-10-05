from __future__ import annotations
import math
from typing import Any, List, Optional, Sequence, Tuple
import numpy as np

# Standard petrophysical sentinel null representations used across CWLS LAS files
HARD_NULL_SENTINELS: Tuple[float, ...] = (
    -999.25,
    -9999.0,
    -999.0,
    999.25,
    9999.0,
    1e30,
    -1e30,
)


def to_float_array(values: Any) -> np.ndarray:
    """
    Safely convert a sequence of numeric or string values into a 1D float64 numpy array.
    Non-convertible or missing entries become np.nan.
    """
    if isinstance(values, np.ndarray) and values.dtype == np.float64:
        return values.copy()
    try:
        arr = np.asarray(values, dtype=np.float64)
    except (ValueError, TypeError):
        cleaned = []
        for v in values:
            try:
                cleaned.append(float(v))
            except (ValueError, TypeError):
                cleaned.append(np.nan)
        arr = np.array(cleaned, dtype=np.float64)
    return arr


def is_null_value(val: Any, null_value: Optional[float] = None) -> bool:
    """
    Check if a single value represents a NULL reading.
    Accounts for None, NaN, +/-inf, file-declared null marker (if provided),
    and CWLS hard null sentinels.
    """
    if val is None:
        return True
    try:
        f = float(val)
    except (ValueError, TypeError):
        return True

    if not math.isfinite(f):
        return True

    if null_value is not None:
        if abs(f - null_value) < 0.01:
            return True

    for sentinel in HARD_NULL_SENTINELS:
        if abs(f - sentinel) < 0.01:
            return True

    return False


def null_mask(values: Any, null_value: Optional[float] = None) -> np.ndarray:
    """
    Generate a boolean numpy mask indicating which elements are NULL.
    True = Null, False = Valid numeric measurement.
    """
    arr = to_float_array(values)
    mask = ~np.isfinite(arr)

    if null_value is not None:
        with np.errstate(invalid="ignore"):
            mask |= np.abs(arr - null_value) < 0.01

    for sentinel in HARD_NULL_SENTINELS:
        with np.errstate(invalid="ignore"):
            mask |= np.abs(arr - sentinel) < 0.01

    return mask


def detect_spikes(
    values: Any,
    null_value: Optional[float] = None,
    window_size: int = 7,
    threshold_sigma: float = 3.5,
) -> np.ndarray:
    """
    Detect anomalous extreme single-point or narrow spikes in a curve series
    using a rolling median and median absolute deviation (MAD).
    Returns a boolean mask of spike indices.
    """
    arr = to_float_array(values)
    n = len(arr)
    spike_mask = np.zeros(n, dtype=bool)
    if n < window_size:
        return spike_mask

    mask = null_mask(arr, null_value)
    valid_indices = np.where(~mask)[0]
    if len(valid_indices) < window_size:
        return spike_mask

    half = window_size // 2
    valid_vals = arr[valid_indices]
    m = len(valid_vals)

    for i in range(m):
        start = max(0, i - half)
        end = min(m, i + half + 1)
        win = valid_vals[start:end]
        if len(win) < 3:
            continue
        med = float(np.median(win))
        mad = float(np.median(np.abs(win - med)))
        sigma = 1.4826 * mad
        if sigma > 1e-6:
            diff = abs(valid_vals[i] - med)
            if diff > threshold_sigma * sigma:
                spike_mask[valid_indices[i]] = True

    return spike_mask


def detect_flatlines(
    values: Any,
    null_value: Optional[float] = None,
    min_consecutive: int = 5,
    tolerance: float = 1e-5,
) -> List[Tuple[int, int]]:
    """
    Detect intervals where consecutive non-null readings are identical,
    indicating sensor freeze or stuck tool response.
    Returns a list of (start_idx, end_idx) inclusive tuples.
    """
    arr = to_float_array(values)
    mask = null_mask(arr, null_value)
    flatline_spans: List[Tuple[int, int]] = []

    start = -1
    consecutive = 1

    for i in range(len(arr)):
        if mask[i]:
            if start != -1 and consecutive >= min_consecutive:
                flatline_spans.append((start, i - 1))
            start = -1
            consecutive = 1
            continue

        if start == -1:
            start = i
            consecutive = 1
        else:
            prev_val = arr[i - 1]
            curr_val = arr[i]
            if abs(curr_val - prev_val) <= tolerance:
                consecutive += 1
            else:
                if consecutive >= min_consecutive:
                    flatline_spans.append((start, i - 1))
                start = i
                consecutive = 1

    if start != -1 and consecutive >= min_consecutive:
        flatline_spans.append((start, len(arr) - 1))

    return flatline_spans
