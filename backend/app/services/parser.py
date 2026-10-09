from __future__ import annotations

import math
import re
from typing import Dict, List, Optional, Tuple

import numpy as np
from pydantic import BaseModel, Field

from backend.app.services.standardiser import CustomAliasEntry, standardise_mnemonic

STEP_MISMATCH_TOLERANCE = 0.05  # 5 % between header STEP and the data's median step


class LASParseError(ValueError):
    """The text is not a usable LAS file."""


class LASHeaderItem(BaseModel):
    mnemonic: str
    unit: str
    value: str
    description: str


class LASCurveMeta(BaseModel):
    mnemonic: str
    unit: str
    code: str = ""
    description: str = ""
    # Set only when the header listed this mnemonic more than once and this copy was renamed
    # (GR -> GR_1); holds the name as it appeared in the file.
    originalMnemonic: Optional[str] = None


class WellInfo(BaseModel):
    wellName: str = ""
    company: str = ""
    field: str = ""
    location: str = ""
    country: str = ""
    state: str = ""
    apiUwi: str = ""
    serviceCompany: str = ""
    date: str = ""
    # 0.0 means "not available" (no data rows and no header value, or step undeterminable).
    startDepth: float = 0.0
    stopDepth: float = 0.0
    step: float = 0.0
    # None = the file declares no null marker and none could be found in its data.
    nullValue: Optional[float] = None
    depthUnit: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class LASData(BaseModel):
    depth: List[float]
    curves: Dict[str, List[float]]


class ParsedLAS(BaseModel):
    version: str = ""
    wrap: bool = False
    wellInfo: WellInfo
    curves: List[LASCurveMeta]
    data: LASData
    rawHeader: str = ""
    totalPoints: int = 0
    # Header of the depth/index channel (not part of `curves`).
    depthCurve: Optional[LASCurveMeta] = None
    # Positions (0-based, in data.depth) of rows whose depth is null or invalid. These rows are
    # kept as read and only flagged here and in `warnings`.
    nullDepthRows: List[int] = Field(default_factory=list)
    # Everything the parser had to guess, fix or skip.
    warnings: List[str] = Field(default_factory=list)


# CWLS standard well items that have NO measurement unit: the whole text after the
# dot is the value.
NON_UNIT_WELL_MNEMONICS = {
    "WELL", "COMP", "FLD", "LOC", "SRVC", "CTRY", "CNTY", "STAT",
    "PROV", "DATE", "API", "UWI", "LATI", "LONG", "GDAT",
}

_NUMERIC_WELL_ITEMS = {"NULL", "STEP", "STRT", "STOP"}


def _is_number(text: str) -> bool:
    try:
        float(text)
        return True
    except ValueError:
        return False


def _parse_header_line(line: str, last_colon: bool = True) -> Optional[LASHeaderItem]:
    """
    MNEM.UNIT VALUE : DESCRIPTION

    `last_colon=True` (well/version lines): the description follows the LAST colon,
    except a colon between two digits (10:30:00), which belongs to the value.
    `last_colon=False` (curve lines): the first colon after the period.
    The mnemonic may itself contain colons (GR:1) because the search for the
    description colon starts after the first period.
    """
    period_idx = line.find(".")
    if period_idx == -1:
        return None
    mnem = line[:period_idx].strip().upper()
    if not mnem:
        return None
    tail = line[period_idx + 1:]

    colon = tail.rfind(":") if last_colon else tail.find(":")
    if (
        last_colon
        and colon > 0
        and colon + 1 < len(tail)
        and tail[colon - 1].isdigit()
        and tail[colon + 1].isdigit()
    ):
        colon = -1  # time-of-day inside the value, no description present

    rest_raw = tail[:colon] if colon != -1 else tail
    desc = tail[colon + 1:].strip() if colon != -1 else ""
    rest = rest_raw.strip()

    if not rest:
        return LASHeaderItem(mnemonic=mnem, unit="", value="", description=desc)

    if mnem in NON_UNIT_WELL_MNEMONICS:
        return LASHeaderItem(mnemonic=mnem, unit="", value=re.sub(r"\s+", " ", rest), description=desc)

    if rest_raw[0].isspace():
        return LASHeaderItem(mnemonic=mnem, unit="", value=re.sub(r"\s+", " ", rest), description=desc)

    match = re.search(r"\s", rest)
    if match:
        unit = rest[: match.start()].strip()
        val = re.sub(r"\s+", " ", rest[match.start() + 1:].strip())
    else:
        unit, val = rest, ""

    # "NULL.-999.25" has no space: the number landed in `unit`.
    if mnem in _NUMERIC_WELL_ITEMS and not val and _is_number(unit):
        unit, val = "", unit

    return LASHeaderItem(mnemonic=mnem, unit=unit, value=val, description=desc)


def _parse_curve_header_line(line: str) -> Optional[LASCurveMeta]:
    item = _parse_header_line(line, last_colon=False)
    if not item:
        return None
    return LASCurveMeta(
        mnemonic=item.mnemonic,
        unit=item.unit,
        code=item.value or item.mnemonic,
        description=item.description,
    )


def _section_code(sec: str) -> str:
    if sec.startswith("~LOG_"):
        if "DEFINITION" in sec:
            return "~C"
        if "DATA" in sec:
            return "~A"
        if "PARAMETER" in sec:
            return "~P"
        return sec
    for prefix in ("~V", "~W", "~C", "~P", "~O", "~A"):
        if sec.startswith(prefix):
            return prefix
    return sec


def _parse_coordinate(text: str, limit: float) -> Optional[float]:
    """Decimal, hemisphere-lettered (N/S/E/W) or degrees-minutes-seconds -> signed decimal degrees."""
    t = (text or "").upper()
    t = re.sub(r"DEG(REES?)?", " ", t)
    letters = re.findall(r"[NSEW]", t)
    nums = re.findall(r"-?\d+(?:\.\d+)?", t)
    if not nums:
        return None
    first = float(nums[0])
    deg = abs(first)
    minutes = float(nums[1]) if len(nums) > 1 else 0.0
    seconds = float(nums[2]) if len(nums) > 2 else 0.0
    value = deg + abs(minutes) / 60.0 + abs(seconds) / 3600.0
    if first < 0 or (len(letters) == 1 and letters[0] in ("S", "W")):
        value = -value
    if abs(value) > limit:
        return None
    return value


def _normalise_depth_unit(unit: str) -> str:
    u = re.sub(r"[\s.]", "", (unit or "").upper())
    if u in ("M", "METER", "METERS", "METRE", "METRES"):
        return "M"
    if u in ("FT", "F", "FEET", "FOOT"):
        return "FT"
    return u or ""


def _to_float(token: str) -> float:
    """The number, or NaN for text / NaN / inf (the caller turns NaN into the file's null)."""
    try:
        v = float(token)
    except ValueError:
        return math.nan
    return v if math.isfinite(v) else math.nan


# A null marker is written as 9s: -999, -999.25, -9999, -99999.0 ...
_NINES_NULL = re.compile(r"^-9{3,}(\.\d+)?$")


def _detect_null_marker(rows: List[List[float]]) -> Optional[Tuple[float, int]]:
    """
    Find the null marker in the data when the header does not declare one.

    Looks at every value after the first column (the first column is depth, and depths
    such as 999.0 are real) and picks the most frequent value that is written like a
    null marker (negative, all 9s: -999.25, -999, -9999 ...). Returns (value, count),
    or None when the data holds no such value.
    """
    counts: Dict[float, int] = {}
    for row in rows:
        for v in row[1:]:
            if math.isfinite(v) and v < 0 and _NINES_NULL.match(f"{v:.6f}".rstrip("0").rstrip(".")):
                counts[v] = counts.get(v, 0) + 1
    if not counts:
        return None
    best = max(counts, key=lambda k: counts[k])
    return best, counts[best]


def parse_las_content(
    content: str,
    custom_aliases: Optional[List[CustomAliasEntry]] = None,
) -> ParsedLAS:
    """Parse LAS text. Raises LASParseError when no curve definitions can be found."""
    content = (content or "").lstrip("﻿")
    if not content.strip():
        raise LASParseError("LAS content is empty.")

    warnings: List[str] = []
    current_section: Optional[str] = None
    version_items: Dict[str, LASHeaderItem] = {}
    well_items: Dict[str, LASHeaderItem] = {}
    curve_metas: List[LASCurveMeta] = []
    header_lines: List[str] = []
    ascii_lines: List[Tuple[int, str]] = []
    data_sections_seen = 0

    for lineno, line in enumerate(content.splitlines(), 1):
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#"):
            if current_section not in ("~A", "~SKIP"):
                header_lines.append(line)
            continue

        if trimmed.startswith("~"):
            code = _section_code(trimmed.split()[0].upper())
            if code == "~A":
                data_sections_seen += 1
                if data_sections_seen > 1:
                    code = "~SKIP"
                    if data_sections_seen == 2:
                        warnings.append("Multiple data sections found; only the first was read.")
            current_section = code
            if code not in ("~A", "~SKIP"):
                header_lines.append(line)
            continue

        if current_section not in ("~A", "~SKIP"):
            header_lines.append(line)

        if current_section in ("~V", "~W"):
            item = _parse_header_line(trimmed, last_colon=True)
            if item:
                (version_items if current_section == "~V" else well_items)[item.mnemonic] = item
        elif current_section == "~C":
            meta = _parse_curve_header_line(trimmed)
            if meta:
                curve_metas.append(meta)
        elif current_section == "~A":
            ascii_lines.append((lineno, trimmed))

    if not curve_metas:
        raise LASParseError("Not a valid LAS file: no curve definitions (~C / ~Curve section) were found.")

    version = version_items.get("VERS", None)
    version_str = version.value if version and version.value else ""
    if not version_str:
        warnings.append("VERS is missing in the header; version left blank.")
    if version_str.startswith("3"):
        warnings.append("LAS 3.0 file: only the first log data set was parsed.")
    wrap = ((version_items["WRAP"].value if "WRAP" in version_items else "NO") or "NO").upper().startswith("Y")
    dlm = (version_items["DLM"].value if "DLM" in version_items else "").upper()
    comma_delimited = dlm.startswith("COMMA")

    def _float_val(key: str) -> Optional[float]:
        """The header number, or None when the item is absent, empty or not a number."""
        item = well_items.get(key)
        if item is None or not item.value:
            return None
        try:
            return float(item.value)
        except ValueError:
            return None

    declared_null = _float_val("NULL")
    if declared_null is not None and not math.isfinite(declared_null):
        declared_null = None

    # ---- unique mnemonics ----------------------------------------------------
    used: set = set()
    for meta in curve_metas:
        base = meta.mnemonic
        name, n = base, 0
        while name in used:
            n += 1
            name = f"{base}_{n}"
        if name != base:
            warnings.append(f"Duplicate curve mnemonic {base} renamed to {name}.")
            meta.mnemonic = name
            meta.originalMnemonic = base
        used.add(name)

    # ---- tokenise rows -------------------------------------------------------
    bad_tokens: List[Tuple[int, str]] = []

    def _tokens(text: str, lineno: int = 0) -> List[float]:
        parts = [p.strip() for p in text.split(",")] if (comma_delimited or "," in text) else text.split()
        out: List[float] = []
        for part in parts:
            try:
                float(part)
            except ValueError:
                bad_tokens.append((lineno, part))  # not a number at all (NaN/inf are fine: they are null markers)
            out.append(_to_float(part))
        return out

    n_meta = len(curve_metas)
    rows: List[List[float]] = []
    row_lines: List[int] = []
    if wrap:
        flat: List[float] = []
        for lineno, text in ascii_lines:
            flat.extend(_tokens(text, lineno))
        usable = (len(flat) // n_meta) * n_meta
        if usable != len(flat):
            warnings.append("Wrapped data ended mid-record; the incomplete trailing record was dropped.")
        rows = [flat[i:i + n_meta] for i in range(0, usable, n_meta)]
        ncols_first = n_meta
    else:
        rows = [_tokens(text, lineno) for lineno, text in ascii_lines]
        row_lines = [lineno for lineno, _ in ascii_lines]
        ncols_first = len(rows[0]) if rows else n_meta

    # ---- the null marker: from the header, otherwise found in the data ---------
    null_value: Optional[float]
    if declared_null is not None:
        null_value = declared_null
    else:
        found = _detect_null_marker(rows)
        if found is not None:
            null_value = found[0]
            warnings.append(
                f"NULL is not declared in the header; {null_value:g} was identified as the null "
                f"marker from the data ({found[1]} value(s))."
            )
        else:
            null_value = None
            warnings.append(
                "NULL is not declared in the header and no null marker was found in the data; "
                "nullValue is left empty."
            )
    # Text, NaN/inf and missing values become the null marker, or NaN when there is none.
    fill = null_value if null_value is not None else math.nan
    rows = [[fill if not math.isfinite(v) else v for v in r] for r in rows]

    # ---- report what was wrong with the data block, with file line numbers ----
    MAX_DETAIL = 10
    for lineno, tok in bad_tokens[:MAX_DETAIL]:
        warnings.append(f"Line {lineno}: '{tok[:20]}' is not a number and was treated as null ({'blank' if null_value is None else format(null_value, 'g')}).")
    if len(bad_tokens) > MAX_DETAIL:
        warnings.append(f"{len(bad_tokens) - MAX_DETAIL} more non-numeric value(s) were treated as null.")
    if not wrap and rows:
        short = [(row_lines[i], len(r)) for i, r in enumerate(rows) if r and len(r) < ncols_first]
        for lineno, got in short[:MAX_DETAIL]:
            warnings.append(
                f"Line {lineno}: row has {got} value(s) but {ncols_first} were expected; "
                "the missing values were set to null."
            )
        if len(short) > MAX_DETAIL:
            warnings.append(f"{len(short) - MAX_DETAIL} more incomplete row(s) were padded with null.")
        if short and short[-1][0] == row_lines[-1]:
            warnings.append(f"The file looks truncated: the last data row (line {row_lines[-1]}) is incomplete.")

    # ---- which column is depth? ---------------------------------------------
    depth_idx = -1
    for idx, meta in enumerate(curve_metas):
        std = standardise_mnemonic(meta.mnemonic, meta.unit, custom_aliases)
        if std.category == "DEPTH":
            depth_idx = idx
            break

    depth_meta: Optional[LASCurveMeta]
    if depth_idx >= 0:
        depth_col = depth_idx
        curve_cols = [(m, i) for i, m in enumerate(curve_metas) if i != depth_idx]
        depth_meta = curve_metas[depth_idx]
    elif ncols_first > n_meta and not wrap:
        depth_col = 0
        curve_cols = [(m, i + 1) for i, m in enumerate(curve_metas)]
        depth_meta = None
        warnings.append("No depth channel in the curve section; the first data column was used as depth.")
    else:
        depth_col = 0
        curve_cols = [(m, i) for i, m in enumerate(curve_metas) if i != 0]
        depth_meta = curve_metas[0]
        warnings.append(f"No recognised depth channel; {curve_metas[0].mnemonic} was used as the depth index.")

    # ---- build columns -------------------------------------------------------
    depth_values: List[float] = []
    curves_data: Dict[str, List[float]] = {m.mnemonic: [] for m, _ in curve_cols}
    col_lists = [(col, curves_data[m.mnemonic]) for m, col in curve_cols]
    null_depth_rows: List[int] = []      # positions in data.depth whose depth is null or invalid
    null_depth_where: List[str] = []     # file line (or record number) of each, for the warning
    for src_idx, row in enumerate(rows):
        if not row:
            continue
        d = row[depth_col] if depth_col < len(row) else fill
        if not math.isfinite(d) or (null_value is not None and abs(d - null_value) < 0.01):
            # Flag it, do not drop it: the row stays in the data exactly as read.
            null_depth_rows.append(len(depth_values))
            null_depth_where.append(
                f"line {row_lines[src_idx]}" if src_idx < len(row_lines) else f"record {src_idx + 1}"
            )
        depth_values.append(d)
        for col, out in col_lists:
            out.append(row[col] if col < len(row) else fill)
    if null_depth_rows:
        shown = ", ".join(null_depth_where[:MAX_DETAIL])
        more = f" (+{len(null_depth_rows) - MAX_DETAIL} more)" if len(null_depth_rows) > MAX_DETAIL else ""
        warnings.append(
            f"{len(null_depth_rows)} row(s) have a null or invalid depth and were kept but flagged: {shown}{more}."
        )

    # ---- depth range and step come from the data -----------------------------
    depth_unit = _normalise_depth_unit(well_items["STRT"].unit if "STRT" in well_items else "")
    if not depth_unit and "STOP" in well_items:
        depth_unit = _normalise_depth_unit(well_items["STOP"].unit)
    if not depth_unit and depth_meta is not None:
        depth_unit = _normalise_depth_unit(depth_meta.unit)
    if not depth_unit:
        warnings.append("Depth unit is not stated in the file; left blank.")

    header_start = _float_val("STRT")
    header_stop = _float_val("STOP")
    header_step = _float_val("STEP")
    if header_step is None:
        header_step = 0.0

    data_step: Optional[float] = None
    flagged = set(null_depth_rows)
    valid_depths = [d for i, d in enumerate(depth_values) if i not in flagged]

    if len(valid_depths) >= 2:
        diffs = np.diff(np.asarray(valid_depths, dtype=float))
        nonzero = diffs[np.abs(diffs) > 1e-9]
        if nonzero.size:
            data_step = float(np.median(nonzero))

    if valid_depths:
        start_depth, stop_depth = valid_depths[0], valid_depths[-1]
        tol = abs(data_step) if data_step else 1.0
        if header_start is not None and abs(header_start - start_depth) > tol:
            warnings.append(f"Header STRT {header_start:g} differs from the first data depth {start_depth:g}; data value used.")
        if header_stop is not None and abs(header_stop - stop_depth) > tol:
            warnings.append(f"Header STOP {header_stop:g} differs from the last data depth {stop_depth:g}; data value used.")
    else:
        start_depth = header_start if header_start is not None else 0.0
        stop_depth = header_stop if header_stop is not None else 0.0

    if math.isfinite(header_step) and header_step != 0.0:
        step = header_step
        if data_step and abs(abs(header_step) - abs(data_step)) > STEP_MISMATCH_TOLERANCE * abs(data_step):
            warnings.append(f"Header STEP {header_step:g} does not match the data's step {data_step:g}; data value used.")
            step = data_step
    elif data_step:
        step = data_step
        warnings.append(f"Header STEP missing or zero; {data_step:g} taken from the data.")
    else:
        step = 0.0
        warnings.append("STEP could not be determined from the header or the data; left as 0.")

    # ---- well metadata -------------------------------------------------------
    def _text(*keys: str) -> str:
        for key in keys:
            item = well_items.get(key)
            if item is not None:
                cleaned = re.sub(r"\s+", " ", item.value).strip()
                if cleaned:
                    return cleaned
        return ""

    well_name = _text("WELL")
    company = _text("COMP")
    field = _text("FLD")
    country = _text("CTRY", "CNTY")
    for label, value in (("WELL", well_name), ("COMP", company), ("FLD", field)):
        if not value:
            warnings.append(f"{label} is missing in the header; left blank.")

    lat = _parse_coordinate(_text("LATI"), 90.0)
    lon = _parse_coordinate(_text("LONG"), 180.0)
    if lat == 0.0 and lon == 0.0:
        lat = lon = None  # both zero is a placeholder, not a location

    well_info = WellInfo(
        wellName=well_name,
        company=company,
        field=field,
        location=_text("LOC"),
        country=country,
        state=_text("STAT"),
        apiUwi=_text("API", "UWI"),
        serviceCompany=_text("SRVC"),
        date=_text("DATE"),
        startDepth=start_depth,
        stopDepth=stop_depth,
        step=step,
        nullValue=null_value,
        depthUnit=depth_unit,
        latitude=lat,
        longitude=lon,
    )

    return ParsedLAS(
        version=version_str,
        wrap=wrap,
        wellInfo=well_info,
        curves=[m for m, _ in curve_cols],
        data=LASData(depth=depth_values, curves=curves_data),
        rawHeader="\n".join(header_lines),
        totalPoints=len(depth_values),
        nullDepthRows=null_depth_rows,
        depthCurve=depth_meta,
        warnings=warnings,
    )