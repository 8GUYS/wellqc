from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional, Tuple

import numpy as np
from pydantic import BaseModel, Field

from backend.app.services.curve_utils import (
    FLATLINE_EXEMPT,
    SONIC_CURVES,
    SPIKE_SIGMA,
    find_flatline_runs,
    find_spikes,
    is_null_value,
    null_mask,
    to_float_array,
    true_runs,
)
from backend.app.schemas.enums import QualityGrade
from backend.app.services.imputation import (
    ML_MIN_MANUAL_SAMPLES,
    ML_MIN_TRAIN_SAMPLES,
    impute_knn_all,
    is_flag_curve,
    recommend_for_gaps,
    run_single_strategy,
)
from backend.app.services.parser import LASCurveMeta, LASData, ParsedLAS
from backend.app.services.quality_engine import QualityAnalysisResult, analyze_well_log_quality
from backend.app.services.standardiser import (
    STANDARD_CURVES,
    CustomAliasEntry,
    convert_series_to_standard_unit,
    standardise_mnemonic,
)

IMPUTE_MAX_NULL_FRACTION = 0.4
ML_METHODS = ("RANDOM_FOREST", "GRADIENT_BOOSTING")
FILL_METHODS = ("KNN", "LINEAR", "SPLINE", "RANDOM_FOREST", "GRADIENT_BOOSTING", "AUTO", "MEDIAN")


class ApprovedFix(BaseModel):
    """
    One problem the user approved for repair, found by its curve and depth range, with the method
    chosen for it. `curve` is the mnemonic shown in the anomaly list (use "DEPT" for duplicate depths).
    `method` is REMOVE_SECOND / COMPARE_ROWS for duplicate depths, REMOVE / CLIP / DELETE_ROW for
    impossible values, KNN / LINEAR / SPLINE / RANDOM_FOREST / GRADIENT_BOOSTING / AUTO for null clusters
    (AUTO lets the benchmark choose the method for that cluster), and is not used for spikes.
    """
    problem: Literal["DUPLICATE_DEPTH", "IMPOSSIBLE_VALUE", "NULL_CLUSTER", "EXTREME_SPIKE"]
    curve: str
    depthStart: float
    depthEnd: float
    method: Optional[str] = None


class CleaningOptions(BaseModel):
    despiking: bool = True
    outlierClipping: bool = True
    unitStandardization: bool = True
    duplicateDepthPruning: bool = True
    duplicateAction: Literal["REMOVE_SECOND", "COMPARE_ROWS"] = "REMOVE_SECOND"
    impossibleAction: Literal["REMOVE", "CLIP", "DELETE_ROW"] = "REMOVE"
    approvedFixes: Optional[List[ApprovedFix]] = None
    flatlineHandling: bool = True
    depthGapInterpolation: bool = True
    imputationStrategy: Literal[
        "NONE", "KNN", "LINEAR", "SPLINE", "RANDOM_FOREST", "GRADIENT_BOOSTING", "AUTO", "MEDIAN"
    ] = "KNN"
    spikeSigma: float = SPIKE_SIGMA
    maxImputeGapSamples: int = 100
    maxDepthGapFillSteps: int = 10


class VerificationReport(BaseModel):
    outliersRemovedCount: int
    spikesDespikedCount: int
    unitsConvertedCount: int
    duplicateDepthsPrunedCount: int
    nullsImputedCount: int
    flatlinesHandledCount: int
    depthGapsInterpolatedCount: int
    originalQualityScore: int
    cleanedQualityScore: int
    originalGrade: QualityGrade
    cleanedGrade: QualityGrade
    scoreImprovement: int
    isVerifiedClean: bool
    summaryMessage: str
    imputedByCurve: Dict[str, int] = Field(default_factory=dict)
    notes: List[str] = Field(default_factory=list)
    outliersClippedCount: int = 0
    outlierRowsDeletedCount: int = 0
    goodReadingsLostInDeletedRows: int = 0


class CleanedLogResult(BaseModel):
    cleanedLas: ParsedLAS
    cleanedQa: QualityAnalysisResult
    verificationReport: VerificationReport
    cleanedLasText: str
    cleanedCsvText: str


def despike_series(
    values: List[float], null_val: float, sigma: float = SPIKE_SIGMA
) -> Tuple[List[float], int]:
    """Replace each spike with the mean of its two neighbours. Returns (values, count)."""
    arr = to_float_array(values)
    nulls = null_mask(arr, null_val)
    idx = find_spikes(arr, nulls, sigma)
    if idx.size == 0:
        return list(values), 0
    out = arr.copy()
    out[idx] = (arr[idx - 1] + arr[idx + 1]) / 2.0
    return out.tolist(), int(idx.size)


def _gap_rows(
    depth: np.ndarray, step: float, max_fill_steps: int
) -> Tuple[np.ndarray, np.ndarray, int]:
    """Rows to insert so regular depth gaps (> 3 steps) become continuous again."""
    empty = (np.array([], dtype=int), np.array([], dtype=float), 0)
    if step <= 0 or depth.size < 2:
        return empty
    diffs = np.diff(depth)
    positions: List[int] = []
    values: List[float] = []
    gaps = 0
    for i in np.flatnonzero(np.abs(diffs) > step * 3):
        gap = float(diffs[i])
        m = int(round(abs(gap) / step))
        if m < 3 or m > max_fill_steps or abs(abs(gap) - m * step) > 0.25 * step:
            continue
        for k in range(1, m):
            positions.append(int(i) + 1)
            values.append(float(depth[i]) + k * gap / m)
        gaps += 1
    if not positions:
        return empty
    return np.array(positions, dtype=int), np.array(values, dtype=float), gaps


def _rows_to_keep(depth_full: np.ndarray, valid_counts: Optional[np.ndarray] = None) -> np.ndarray:
    """
    Row numbers to keep, in file order. Rows with a non-numeric depth are dropped. Depths are
    compared after rounding to 6 decimals; when a depth appears more than once, one row is kept:
    the first one, or (when valid_counts is given) the one with the most valid readings, with a tie
    going to the first.
    """
    finite_idx = np.flatnonzero(np.isfinite(depth_full))
    rounded = np.round(depth_full[finite_idx], 6)
    if valid_counts is None:
        order = np.lexsort((finite_idx, rounded))
    else:
        order = np.lexsort((finite_idx, -valid_counts[finite_idx], rounded))
    sorted_depth = rounded[order]
    first_of_depth = np.ones(order.size, dtype=bool)
    first_of_depth[1:] = sorted_depth[1:] != sorted_depth[:-1]
    return np.sort(finite_idx[order][first_of_depth])


DUPLICATE_DEPTH_TOL = 1e-4


def _approved_duplicate_rows(
    depth_full: np.ndarray,
    fixes: List[Tuple[int, ApprovedFix]],
    valid_counts: Optional[np.ndarray],
    hit_fixes: set,
) -> np.ndarray:
    """
    Row numbers to keep when only the approved duplicate depths are repaired. Every row that is not
    at an approved duplicate depth is kept, including rows with a non-numeric depth. At an approved
    depth one row is kept: the first, or with COMPARE_ROWS the one with the most valid readings
    (a tie keeps the first). `hit_fixes` collects the indexes of the fixes that found a duplicate.
    """
    drop = np.zeros(depth_full.size, dtype=bool)
    finite_idx = np.flatnonzero(np.isfinite(depth_full))
    order = finite_idx[np.argsort(depth_full[finite_idx], kind="stable")]
    sorted_depth = depth_full[order]
    for k, fix in fixes:
        lo = np.searchsorted(sorted_depth, fix.depthStart - DUPLICATE_DEPTH_TOL, side="left")
        hi = np.searchsorted(sorted_depth, fix.depthStart + DUPLICATE_DEPTH_TOL, side="right")
        rows = np.sort(order[lo:hi])
        if rows.size < 2:
            continue
        hit_fixes.add(k)
        rows = rows[~drop[rows]]
        if rows.size < 2:
            continue
        if fix.method == "COMPARE_ROWS" and valid_counts is not None:
            best = rows[int(np.argmax(valid_counts[rows]))]
        else:
            best = rows[0]
        drop[rows[rows != best]] = True
    return np.flatnonzero(~drop)


def _fixes_for_curve(
    fixes: List[Tuple[int, ApprovedFix]], names: set
) -> List[Tuple[int, ApprovedFix]]:
    """The approved fixes that belong to a curve, matched by mnemonic (not case sensitive)."""
    return [(k, f) for k, f in fixes if f.curve.upper() in names]


def _in_range(depth: np.ndarray, fix: ApprovedFix, tol: float) -> np.ndarray:
    lo, hi = sorted((fix.depthStart, fix.depthEnd))
    return (depth >= lo - tol) & (depth <= hi + tol)


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def build_las_file_string(las: ParsedLAS, qa: QualityAnalysisResult, report: VerificationReport) -> str:
    null_val = las.wellInfo.nullValue if las.wellInfo.nullValue is not None else -999.25
    wi = las.wellInfo
    now_iso = datetime.now(timezone.utc).isoformat()
    lines = [
        "~VERSION INFORMATION",
        "VERS.                 2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0",
        "WRAP.                  NO : ONE LINE PER DEPTH STEP",
        "~WELL INFORMATION",
        f"# Cleaned & Repaired by WellQC Enterprise Engine on {now_iso}",
        f"# Verification Audit: Initial Score {report.originalQualityScore}% ({report.originalGrade}) -> Cleaned Score {report.cleanedQualityScore}% ({report.cleanedGrade})",
        f"# Outliers Nulled: {report.outliersRemovedCount} | Outliers Clipped: {report.outliersClippedCount} | Rows Deleted (impossible values): {report.outlierRowsDeletedCount} | Spikes Despiked: {report.spikesDespikedCount} | Units Standardized: {report.unitsConvertedCount} | Imputed Values: {report.nullsImputedCount}",
    ]
    if report.imputedByCurve:
        listing = ", ".join(f"{k}={v}" for k, v in report.imputedByCurve.items())
        lines.append(f"# Imputed samples by curve (not measured data): {listing}")
    lines += [
        f"STRT.{wi.depthUnit:<6} {(f'{wi.startDepth:>12.4f}' if las.data.depth else ' ' * 12)} : START DEPTH",
        f"STOP.{wi.depthUnit:<6} {(f'{wi.stopDepth:>12.4f}' if las.data.depth else ' ' * 12)} : STOP DEPTH",
        f"STEP.{wi.depthUnit:<6} {(f'{wi.step:>12.4f}' if wi.step else ' ' * 12)} : STEP VALUE",
        f"NULL.        {null_val:>12.2f} : NULL VALUE",
        f"WELL.        {_clean_text(wi.wellName)} : WELL NAME",
    ]
    optional = [
        ("COMP", _clean_text(wi.company), "COMPANY"),
        ("FLD ", _clean_text(wi.field), "FIELD"),
        ("LOC ", _clean_text(wi.location), "LOCATION"),
        ("CTRY", _clean_text(wi.country), "COUNTRY"),
        ("STAT", _clean_text(wi.state), "STATE"),
        ("SRVC", _clean_text(wi.serviceCompany), "SERVICE COMPANY"),
        ("API ", _clean_text(wi.apiUwi), "API / UWI"),
        ("DATE", _clean_text(wi.date), "LOG DATE"),
        ("LATI", f"{wi.latitude:.6f}" if wi.latitude is not None else "", "LATITUDE"),
        ("LONG", f"{wi.longitude:.6f}" if wi.longitude is not None else "", "LONGITUDE"),
    ]
    for key, value, desc in optional:
        if value:
            lines.append(f"{key}.        {value} : {desc}")

    lines.append("~CURVE INFORMATION")
    lines.append(f"DEPT.{wi.depthUnit:<6}             : 1 MEASURED DEPTH")
    for i, c in enumerate(las.curves):
        lines.append(f"{c.mnemonic}.{c.unit:<6} : {i + 2} {c.description}")
    lines.append("~ASCII")

    n = len(las.data.depth)
    columns: List[List[str]] = [[f"{d:>10.4f}" if math.isfinite(d) else f"{null_val:>10.2f}" for d in las.data.depth]]
    for c in las.curves:
        col = las.data.curves.get(c.mnemonic) or [null_val] * n
        mask = null_mask(col, null_val)
        columns.append([f"{null_val:>10.2f}" if m else f"{v:>10.4f}" for v, m in zip(col, mask)])
    for row in zip(*columns):
        lines.append(" ".join(row))
    return "\n".join(lines) + "\n"


def build_csv_file_string(las: ParsedLAS) -> str:
    null_val = las.wellInfo.nullValue if las.wellInfo.nullValue is not None else -999.25
    n = len(las.data.depth)
    rows = [",".join(["DEPTH"] + [c.mnemonic for c in las.curves])]
    columns: List[List[str]] = [[f"{d:.4f}" if math.isfinite(d) else "" for d in las.data.depth]]
    for c in las.curves:
        col = las.data.curves.get(c.mnemonic) or [null_val] * n
        mask = null_mask(col, null_val)
        columns.append(["" if m else f"{v:.4f}" for v, m in zip(col, mask)])
    for row in zip(*columns):
        rows.append(",".join(row))
    return "\n".join(rows) + "\n"


def clean_las_log_data(
    las: ParsedLAS,
    initial_qa: Optional[QualityAnalysisResult] = None,
    options: Optional[CleaningOptions] = None,
    custom_aliases: Optional[List[CustomAliasEntry]] = None,
) -> CleanedLogResult:
    opts = options or CleaningOptions()
    raw_qa = initial_qa or analyze_well_log_quality(las, custom_aliases)
    notes: List[str] = []
    declared_null = las.wellInfo.nullValue
    no_marker = declared_null is None or not math.isfinite(declared_null)
    if no_marker:
        # No marker declared and none found in the data: the cleaned file still needs one.
        null_val = -999.25
        notes.append("The file had no NULL marker; -999.25 was used in the cleaned output.")
    else:
        null_val = declared_null

    outliers_removed = outliers_clipped = spikes_despiked = units_converted = 0
    rows_deleted = good_lost = 0
    duplicate_depths_pruned = nulls_imputed = flatlines_handled = 0
    depth_gaps_repaired = 0

    metas = list(las.curves)
    stds = [standardise_mnemonic(m.mnemonic, m.unit, custom_aliases) for m in metas]

    approved = opts.approvedFixes
    indexed = list(enumerate(approved)) if approved is not None else []
    fixes_of = lambda kind: [(k, f) for k, f in indexed if f.problem == kind]
    hit_fixes: set = set()
    tol = abs(las.wellInfo.step) * 0.5 if las.wellInfo.step else 1e-6

    depth_full = to_float_array(las.data.depth)
    n0 = depth_full.size
    keep = np.arange(n0)

    def row_valid_counts() -> np.ndarray:
        counts = np.zeros(n0, dtype=int)
        for meta, std in zip(metas, stds):
            if std.category == "DEPTH":
                continue
            col = to_float_array(las.data.curves.get(meta.mnemonic, []))
            if col.size < n0:
                col = np.concatenate([col, np.full(n0 - col.size, np.nan)])
            counts += (~null_mask(col[:n0], null_val)).astype(int)
        return counts

    if approved is None:
        if opts.duplicateDepthPruning:
            counts = row_valid_counts() if opts.duplicateAction == "COMPARE_ROWS" else None
            keep = _rows_to_keep(depth_full, counts)
    else:
        dup_fixes = fixes_of("DUPLICATE_DEPTH")
        if dup_fixes:
            need_counts = any(f.method == "COMPARE_ROWS" for _, f in dup_fixes)
            keep = _approved_duplicate_rows(
                depth_full, dup_fixes, row_valid_counts() if need_counts else None, hit_fixes
            )
    duplicate_depths_pruned = n0 - keep.size
    depth = depth_full[keep]
    flagged_orig = set(las.nullDepthRows)
    null_depth_flag = np.array([int(orig) in flagged_orig for orig in keep], dtype=bool)
    delete_rows = np.zeros(depth.size, dtype=bool)

    # 2. Clean each curve (arrays, once per curve)
    sonic_seen = False
    original_names = {m.mnemonic for m in metas}
    used_names: set = set()
    cleaned: Dict[str, np.ndarray] = {}
    cleaner_nulled: Dict[str, np.ndarray] = {}
    orig_of: Dict[str, str] = {}
    new_metas: List[LASCurveMeta] = []

    for meta, std in zip(metas, stds):
        if std.category == "DEPTH":
            notes.append(f"{meta.mnemonic} is a depth index, not a log curve; it was not cleaned as one.")
            continue

        raw = to_float_array(las.data.curves.get(meta.mnemonic, []))
        if raw.size < n0:
            raw = np.concatenate([raw, np.full(n0 - raw.size, np.nan)])
        vals = raw[:n0][keep].copy()
        nulls = null_mask(vals, null_val)
        vals[nulls] = null_val

        matched = std.isAutoMatched
        std_key = std.standardMnemonic if matched else ""
        std_def = STANDARD_CURVES.get(std_key)
        curve_names = {meta.mnemonic.upper()} | ({std_key.upper()} if std_key else set())

        # Unit conversion: one factor for the whole curve. A blank or unrecognised unit is never
        # converted or relabelled on a guess; the values stay as they are and the user is warned.
        keep_unit = False
        if opts.unitStandardization and matched:
            conv = convert_series_to_standard_unit(vals.tolist(), meta.unit, std_key, null_val)
            if conv.converted and conv.inferred:
                keep_unit = True
                notes.append(
                    f"{meta.mnemonic}: unit missing or unrecognised; values left unchanged. "
                    f"They look like they need a x{conv.factor:g} factor. Confirm the unit."
                )
            elif conv.converted:
                vals = np.asarray(conv.values, dtype=float)
                units_converted += int((~nulls).sum())
            if not meta.unit.strip():
                keep_unit = True
                if not (conv.converted and conv.inferred):
                    notes.append(f"{meta.mnemonic}: unit is blank in the file; it was left blank. Confirm the unit.")

        made_null = np.zeros(vals.size, dtype=bool)

        imp_fixes = _fixes_for_curve(fixes_of("IMPOSSIBLE_VALUE"), curve_names)
        if std_def is not None and (opts.outlierClipping if approved is None else bool(imp_fixes)):
            with np.errstate(invalid="ignore"):
                bad = ~nulls & ((vals < std_def.minPhysical) | (vals > std_def.maxPhysical))
            if approved is None:
                to_fix = [(opts.impossibleAction, bad)]
            else:
                to_fix = []
                for k, fix in imp_fixes:
                    sel = bad & _in_range(depth, fix, tol)
                    if sel.any():
                        hit_fixes.add(k)
                        to_fix.append((fix.method or opts.impossibleAction, sel))
                        bad = bad & ~sel
            for action, sel in to_fix:
                if action == "CLIP":
                    outliers_clipped += int(sel.sum())
                    vals[sel] = np.clip(vals[sel], std_def.minPhysical, std_def.maxPhysical)
                elif action == "DELETE_ROW":
                    delete_rows |= sel
                    vals[sel] = null_val
                    nulls |= sel
                else:
                    outliers_removed += int(sel.sum())
                    vals[sel] = null_val
                    nulls |= sel
                    made_null |= sel

        spk_fixes = _fixes_for_curve(fixes_of("EXTREME_SPIKE"), curve_names)
        is_sonic = std_key in SONIC_CURVES
        sonic_seen = sonic_seen or is_sonic
        if (opts.despiking and is_sonic) if approved is None else bool(spk_fixes):
            idx = find_spikes(vals, nulls, opts.spikeSigma)
            if approved is not None and idx.size:
                wanted = np.zeros(idx.size, dtype=bool)
                for k, fix in spk_fixes:
                    hit = _in_range(depth[idx], fix, tol)
                    if hit.any():
                        hit_fixes.add(k)
                        wanted |= hit
                idx = idx[wanted]
            if idx.size:
                original = vals.copy()
                vals[idx] = (original[idx - 1] + original[idx + 1]) / 2.0
                spikes_despiked += int(idx.size)

        # Flatlines -> null
        if opts.flatlineHandling and std_key not in FLATLINE_EXEMPT:
            runs = find_flatline_runs(vals, nulls)
            for s, e in runs:
                vals[s:e] = null_val
                nulls[s:e] = True
            flatlines_handled += len(runs)

        # Naming: never overwrite another curve
        clean_name, clean_unit = meta.mnemonic, meta.unit
        if opts.unitStandardization and matched and std_def is not None:
            clean_unit = meta.unit if keep_unit else std_def.standardUnit
            target = std.standardMnemonic
            if target == meta.mnemonic or (target not in used_names and target not in original_names):
                clean_name = target
            else:
                notes.append(f"{meta.mnemonic} kept its name because {target} is already in use by another curve.")
        used_names.add(clean_name)

        new_metas.append(
            LASCurveMeta(
                mnemonic=clean_name,
                unit=clean_unit,
                code=meta.code or "0",
                description=std.matchedName if matched else meta.description,
            )
        )
        cleaned[clean_name] = vals
        cleaner_nulled[clean_name] = made_null
        orig_of[clean_name] = meta.mnemonic

    if approved is None and opts.despiking and not sonic_seen:
        notes.append("Despiking applies to the sonic (DT) curve only; no sonic curve was recognised in this file.")

    inserted_rows = np.zeros(depth.size, dtype=bool)
    if approved is None and opts.depthGapInterpolation and opts.imputationStrategy != "NONE" and cleaned:
        ins_idx, ins_val, _ = _gap_rows(depth, abs(las.wellInfo.step), opts.maxDepthGapFillSteps)
        if ins_idx.size:
            depth = np.insert(depth, ins_idx, ins_val)
            for name in cleaned:
                cleaned[name] = np.insert(cleaned[name], ins_idx, null_val)
                cleaner_nulled[name] = np.insert(cleaner_nulled[name], ins_idx, False)
            inserted_rows = np.insert(inserted_rows, ins_idx, True)
            null_depth_flag = np.insert(null_depth_flag, ins_idx, False)
            delete_rows = np.insert(delete_rows, ins_idx, False)

    if delete_rows.any():
        rows_deleted = int(delete_rows.sum())
        good_lost = sum(int((~null_mask(arr[delete_rows], null_val)).sum()) for arr in cleaned.values())
        alive = ~delete_rows
        depth = depth[alive]
        null_depth_flag = null_depth_flag[alive]
        inserted_rows = inserted_rows[alive]
        for name in cleaned:
            cleaned[name] = cleaned[name][alive]
            cleaner_nulled[name] = cleaner_nulled[name][alive]
        notes.append(
            f"{rows_deleted} row(s) were deleted because of an impossible value; "
            f"{good_lost} good reading(s) on other curves were removed with them. "
            "The depth column now has a gap at each deleted row."
        )

    imputed_by_curve: Dict[str, int] = {}
    null_fixes = fixes_of("NULL_CLUSTER")
    fill_wanted = opts.imputationStrategy != "NONE" if approved is None else bool(null_fixes)
    if fill_wanted and cleaned:
        n = depth.size
        plans: Dict[str, Tuple[np.ndarray, int, int]] = {}
        flag_curves: List[str] = []
        for name, arr in cleaned.items():
            nulls = null_mask(arr, null_val)
            if nulls.any() and is_flag_curve(arr.tolist(), null_val):
                flag_curves.append(name)
                for k, f in _fixes_for_curve(null_fixes, {orig_of.get(name, name).upper(), name.upper()}):
                    hit_fixes.add(k)
                continue
            valid_idx = np.flatnonzero(~nulls)
            if valid_idx.size >= 2:
                fillable = nulls & ~cleaner_nulled[name]
                span = int(valid_idx[-1] - valid_idx[0] + 1)
                n_null = int(fillable[valid_idx[0]:valid_idx[-1] + 1].sum())
                if n_null > 0 and (approved is not None or n_null < span * IMPUTE_MAX_NULL_FRACTION):
                    plans[name] = (fillable, int(valid_idx[0]), int(valid_idx[-1]))

        gaps: List[Tuple[str, int, int, str]] = []
        too_long = 0
        for name, (nulls, first_valid, last_valid) in plans.items():
            curve_fixes = _fixes_for_curve(null_fixes, {orig_of.get(name, name).upper(), name.upper()})
            if approved is not None and not curve_fixes:
                continue
            for s, e in true_runs(nulls):
                if s <= first_valid or e - 1 >= last_valid:
                    continue
                method = opts.imputationStrategy
                if approved is not None:
                    hits = [
                        (k, f) for k, f in curve_fixes
                        if _in_range(depth[s:e], f, tol).any()
                    ]
                    if not hits:
                        continue
                    hit_fixes.update(k for k, _ in hits)
                    method = hits[0][1].method or opts.imputationStrategy
                if e - s > opts.maxImputeGapSamples:
                    too_long += 1
                    continue
                if method == "NONE":
                    continue
                if method not in FILL_METHODS:
                    notes.append(f"{name}: fill method {method} is not available; linear interpolation was used.")
                    method = "LINEAR"
                gaps.append((name, s, e, method))
        if approved is not None and too_long:
            notes.append(f"{too_long} approved null gap(s) are longer than {opts.maxImputeGapSamples} samples and were left unfilled.")
        if flag_curves:
            notes.append(f"{', '.join(flag_curves)}: flag curve(s) hold whole-number codes, so their null gaps were not filled.")

        if gaps:
            as_lists = {k: v.tolist() for k, v in cleaned.items()}

            if any(g[3] == "AUTO" for g in gaps):
                try:
                    picks = recommend_for_gaps(
                        depth.tolist(), as_lists, null_val, [(g[0], g[1], g[2]) for g in gaps if g[3] == "AUTO"]
                    )
                except Exception as exc:
                    notes.append(f"AUTO could not run the benchmark ({type(exc).__name__}); linear interpolation was used.")
                    picks = {}
                gaps = [
                    (g[0], g[1], g[2], picks.get((g[0], g[1], g[2]), {}).get("method", "LINEAR") if g[3] == "AUTO" else g[3])
                    for g in gaps
                ]
                chosen_counts: Dict[str, int] = {}
                for g in gaps:
                    if (g[0], g[1], g[2]) in picks:
                        chosen_counts[g[3]] = chosen_counts.get(g[3], 0) + 1
                if chosen_counts:
                    notes.append("AUTO chose: " + ", ".join(f"{m} for {c} gap(s)" for m, c in sorted(chosen_counts.items())) + ".")

            knn_results: Dict[str, List[float]] = {}
            knn_targets = sorted({g[0] for g in gaps if g[3] == "KNN"})
            if knn_targets:
                try:
                    knn_results = impute_knn_all(as_lists, null_val, 5, knn_targets)
                except Exception as exc:  # fall back rather than fail the whole clean
                    notes.append(f"KNN imputation failed ({type(exc).__name__}); linear interpolation was used instead.")
                    gaps = [(g[0], g[1], g[2], "LINEAR" if g[3] == "KNN" else g[3]) for g in gaps]

            filled_curves: Dict[Tuple[str, str], Optional[List[float]]] = {}

            def filled_values(name: str, method: str) -> Optional[List[float]]:
                if method == "KNN":
                    return knn_results.get(name)
                if (name, method) not in filled_curves:
                    try:
                        filled_curves[(name, method)] = run_single_strategy(as_lists, name, method, null_val)
                    except Exception as exc:
                        notes.append(f"{name}: {method} failed ({type(exc).__name__}); linear interpolation was used.")
                        filled_curves[(name, method)] = run_single_strategy(as_lists, name, "LINEAR", null_val)
                return filled_curves[(name, method)]

            tree_cautions: Dict[Tuple[str, str], int] = {}
            tree_too_short: Dict[Tuple[str, str], int] = {}
            for name, s, e, method in gaps:
                if method in ML_METHODS:
                    n_valid = int((~null_mask(cleaned[name], null_val)).sum())
                    if n_valid < ML_MIN_MANUAL_SAMPLES:
                        tree_too_short[(name, method)] = n_valid
                    elif n_valid < ML_MIN_TRAIN_SAMPLES:
                        tree_cautions[(name, method)] = n_valid
            for name, s, e, method in gaps:
                imputed = filled_values(name, method)
                if imputed is None or len(imputed) != n:
                    imputed = None
                arr = cleaned[name]
                filled = 0
                for i in range(s, e):
                    v = imputed[i] if imputed is not None else None
                    if v is not None and not is_null_value(v, null_val):
                        arr[i] = round(float(v), 4)
                        filled += 1
                if filled:
                    imputed_by_curve[name] = imputed_by_curve.get(name, 0) + filled
                    nulls_imputed += filled
            labels = {"RANDOM_FOREST": "Random Forest", "GRADIENT_BOOSTING": "Gradient Boosting"}
            for (name, method), cnt in sorted(tree_cautions.items()):
                notes.append(
                    f"{name}: {labels[method]} filled using only {cnt} readings ({ML_MIN_TRAIN_SAMPLES}+ recommended). "
                    "Review the filled values before using this data."
                )
            for (name, method), cnt in sorted(tree_too_short.items()):
                notes.append(
                    f"{name}: {labels[method]} needs at least {ML_MIN_MANUAL_SAMPLES} valid readings; "
                    f"this curve has {cnt}, so its gaps were left unfilled."
                )

    if approved is not None:
        unmatched = len(approved) - len(hit_fixes)
        if unmatched:
            notes.append(
                f"{unmatched} of {len(approved)} approved fix(es) did not find anything to repair "
                "(already repaired, outside the repair rules, or the curve or depth did not match)."
            )

    # Count depth gaps that were actually repaired
    for s, e in true_runs(inserted_rows):
        if any(not null_mask(arr[s:e], null_val).any() for arr in cleaned.values()):
            depth_gaps_repaired += 1

    cleaned_las = las.model_copy(
        update={
            "curves": new_metas,
            "data": LASData(depth=depth.tolist(), curves={k: v.tolist() for k, v in cleaned.items()}),
            "totalPoints": int(depth.size),
            "wrap": False,
            "nullDepthRows": np.flatnonzero(null_depth_flag).tolist(),
            "wellInfo": las.wellInfo.model_copy(
                update={
                    "nullValue": null_val,
                    "startDepth": float(depth[0]) if depth.size else las.wellInfo.startDepth,
                    "stopDepth": float(depth[-1]) if depth.size else las.wellInfo.stopDepth,
                }
            ),
        }
    )

    cleaned_qa = analyze_well_log_quality(cleaned_las, custom_aliases)
    score_improvement = cleaned_qa.overallScore - raw_qa.overallScore
    is_verified_clean = cleaned_qa.overallScore >= 80 and cleaned_qa.criticalCount == 0

    if score_improvement < 0:
        notes.append(
            f"The quality score went DOWN by {-score_improvement} after cleaning; review the changes before using this output."
        )

    if is_verified_clean:
        change = (
            f"boosted by +{score_improvement}%" if score_improvement > 0
            else "unchanged" if score_improvement == 0
            else f"reduced by {-score_improvement}%"
        )
        summary = f"Data cleaned and verified. Quality score {change} to {cleaned_qa.overallScore}% ({cleaned_qa.qualityGrade})."
    else:
        change = (
            f"improved by +{score_improvement}%" if score_improvement > 0
            else "unchanged" if score_improvement == 0
            else f"reduced by {-score_improvement}%"
        )
        summary = (
            f"Data partially repaired. Quality score {change} to {cleaned_qa.overallScore}%. "
            f"Some sensor gaps require manual petrophysical review."
        )

    if no_marker:
        summary = "The file had no NULL marker, so -999.25 was used in the cleaned output. " + summary

    report = VerificationReport(
        outliersRemovedCount=outliers_removed,
        outliersClippedCount=outliers_clipped,
        outlierRowsDeletedCount=rows_deleted,
        goodReadingsLostInDeletedRows=good_lost,
        spikesDespikedCount=spikes_despiked,
        unitsConvertedCount=units_converted,
        duplicateDepthsPrunedCount=duplicate_depths_pruned,
        nullsImputedCount=nulls_imputed,
        flatlinesHandledCount=flatlines_handled,
        depthGapsInterpolatedCount=depth_gaps_repaired,
        originalQualityScore=raw_qa.overallScore,
        cleanedQualityScore=cleaned_qa.overallScore,
        originalGrade=raw_qa.qualityGrade,
        cleanedGrade=cleaned_qa.qualityGrade,
        scoreImprovement=score_improvement,
        isVerifiedClean=is_verified_clean,
        summaryMessage=summary,
        imputedByCurve=imputed_by_curve,
        notes=notes,
    )

    return CleanedLogResult(
        cleanedLas=cleaned_las,
        cleanedQa=cleaned_qa,
        verificationReport=report,
        cleanedLasText=build_las_file_string(cleaned_las, cleaned_qa, report),
        cleanedCsvText=build_csv_file_string(cleaned_las),
    )