from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional, Tuple

import numpy as np
from pydantic import BaseModel, Field

from backend.app.services.curve_utils import (
    FLATLINE_EXEMPT,
    SPIKE_SIGMA,
    find_flatline_runs,
    find_spikes,
    is_null_value,
    null_mask,
    to_float_array,
    true_runs,
)
from backend.app.schemas.enums import QualityGrade
from backend.app.services.imputation import impute_knn_all, impute_linear, impute_median
from backend.app.services.parser import LASCurveMeta, LASData, ParsedLAS
from backend.app.services.quality_engine import QualityAnalysisResult, analyze_well_log_quality
from backend.app.services.standardiser import (
    STANDARD_CURVES,
    CustomAliasEntry,
    convert_series_to_standard_unit,
    standardise_mnemonic,
)

IMPUTE_MAX_NULL_FRACTION = 0.4


class CleaningOptions(BaseModel):
    despiking: bool = True
    outlierClipping: bool = True
    unitStandardization: bool = True
    duplicateDepthPruning: bool = True
    flatlineHandling: bool = True
    depthGapInterpolation: bool = True
    imputationStrategy: Literal["NONE", "KNN", "LINEAR", "MEDIAN"] = "KNN"
    spikeSigma: float = SPIKE_SIGMA
    maxImputeGapSamples: int = 20
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
        f"# Cleaned & Repaired by WellQC+ Enterprise Engine on {now_iso}",
        f"# Verification Audit: Initial Score {report.originalQualityScore}% ({report.originalGrade}) -> Cleaned Score {report.cleanedQualityScore}% ({report.cleanedGrade})",
        f"# Outliers Nulled: {report.outliersRemovedCount} | Spikes Despiked: {report.spikesDespikedCount} | Units Standardized: {report.unitsConvertedCount} | Imputed Values: {report.nullsImputedCount}",
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

    outliers_removed = spikes_despiked = units_converted = 0
    duplicate_depths_pruned = nulls_imputed = flatlines_handled = 0
    depth_gaps_repaired = 0

    # 1. Prune duplicate / non-finite depths (keep the first of each)
    depth_full = to_float_array(las.data.depth)
    n0 = depth_full.size
    keep = np.arange(n0)
    if opts.duplicateDepthPruning:
        finite_idx = np.flatnonzero(np.isfinite(depth_full))
        _, first = np.unique(np.round(depth_full[finite_idx], 6), return_index=True)
        keep = np.sort(finite_idx[first])
        duplicate_depths_pruned = n0 - keep.size
    depth = depth_full[keep]
    flagged_orig = set(las.nullDepthRows)
    null_depth_flag = np.array([int(orig) in flagged_orig for orig in keep], dtype=bool)

    # 2. Clean each curve (arrays, once per curve)
    metas = list(las.curves)
    stds = [standardise_mnemonic(m.mnemonic, m.unit, custom_aliases) for m in metas]
    original_names = {m.mnemonic for m in metas}
    used_names: set = set()
    cleaned: Dict[str, np.ndarray] = {}
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

        # Physically impossible values -> null
        if opts.outlierClipping and std_def is not None:
            with np.errstate(invalid="ignore"):
                bad = ~nulls & ((vals < std_def.minPhysical) | (vals > std_def.maxPhysical))
            outliers_removed += int(bad.sum())
            vals[bad] = null_val
            nulls |= bad

        # Spikes -> mean of neighbours
        if opts.despiking:
            idx = find_spikes(vals, nulls, opts.spikeSigma)
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

    # 3. Repair regular depth gaps by inserting the missing rows (they are filled below)
    inserted_rows = np.zeros(depth.size, dtype=bool)
    if opts.depthGapInterpolation and opts.imputationStrategy != "NONE" and cleaned:
        ins_idx, ins_val, _ = _gap_rows(depth, abs(las.wellInfo.step), opts.maxDepthGapFillSteps)
        if ins_idx.size:
            depth = np.insert(depth, ins_idx, ins_val)
            for name in cleaned:
                cleaned[name] = np.insert(cleaned[name], ins_idx, null_val)
            inserted_rows = np.insert(inserted_rows, ins_idx, True)
            null_depth_flag = np.insert(null_depth_flag, ins_idx, False)

    # 4. Fill interior gaps only
    imputed_by_curve: Dict[str, int] = {}
    if opts.imputationStrategy != "NONE" and cleaned:
        n = depth.size
        plans: Dict[str, Tuple[np.ndarray, int, int]] = {}
        for name, arr in cleaned.items():
            nulls = null_mask(arr, null_val)
            valid_idx = np.flatnonzero(~nulls)
            n_null = int(nulls.sum())
            if valid_idx.size >= 2 and 0 < n_null < n * IMPUTE_MAX_NULL_FRACTION:
                plans[name] = (nulls, int(valid_idx[0]), int(valid_idx[-1]))

        if plans:
            as_lists = {k: v.tolist() for k, v in cleaned.items()}
            strategy = opts.imputationStrategy
            knn_results: Dict[str, List[float]] = {}
            if strategy == "KNN":
                try:
                    knn_results = impute_knn_all(as_lists, null_val, 5, list(plans))
                except Exception as exc:  # fall back rather than fail the whole clean
                    notes.append(f"KNN imputation failed ({type(exc).__name__}); linear interpolation was used instead.")
                    strategy = "LINEAR"

            for name, (nulls, first_valid, last_valid) in plans.items():
                if strategy == "KNN":
                    imputed = knn_results.get(name)
                elif strategy == "LINEAR":
                    imputed = impute_linear(as_lists[name], null_val)
                else:
                    imputed = impute_median(as_lists[name], null_val)
                if imputed is None or len(imputed) != n:
                    continue
                arr = cleaned[name]
                filled = 0
                for s, e in true_runs(nulls):
                    if s <= first_valid or e - 1 >= last_valid:
                        continue  # leading/trailing: casing shoe or off-bottom, not recoverable
                    if e - s > opts.maxImputeGapSamples:
                        continue
                    for i in range(s, e):
                        v = imputed[i]
                        if not is_null_value(v, null_val):
                            arr[i] = round(float(v), 4)
                            filled += 1
                if filled:
                    imputed_by_curve[name] = filled
                    nulls_imputed += filled

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