from __future__ import annotations
import math
import re
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from backend.app.services.curve_utils import is_null_value, HARD_NULL_SENTINELS
from backend.app.services.standardiser import standardise_mnemonic, CustomAliasEntry


class LASParseError(ValueError):
    """Raised when text content is not a valid CWLS LAS file or has unrecoverable syntax errors."""
    pass


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


class WellInfo(BaseModel):
    wellName: str = "UNKNOWN_WELL"
    company: str = ""
    field: str = ""
    location: str = ""
    country: str = ""
    state: str = ""
    apiUwi: str = ""
    serviceCompany: str = ""
    date: str = ""
    startDepth: float = 0.0
    stopDepth: float = 0.0
    step: float = 0.5
    nullValue: Optional[float] = None
    depthUnit: str = "FT"
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class LASData(BaseModel):
    depth: List[float]
    curves: Dict[str, List[float]]


class ParsedLAS(BaseModel):
    version: str = "2.0"
    wrap: bool = False
    wellInfo: WellInfo
    depthCurve: Optional[LASCurveMeta] = None
    curves: List[LASCurveMeta]
    data: LASData
    rawHeader: str = ""
    totalPoints: int = 0
    warnings: List[str] = []
    nullDepthRows: List[int] = []


# CWLS LAS 2.0 / 3.0 standard well metadata items that have NO measurement unit.
NON_UNIT_WELL_MNEMONICS = {
    "WELL", "COMP", "FLD", "LOC", "SRVC", "CTRY", "CNTY", "STAT",
    "PROV", "DATE", "API", "UWI", "LATI", "LONG", "GDAT"
}


def _parse_header_line(line: str) -> Optional[LASHeaderItem]:
    colon_idx = line.find(":")
    main_part = line[:colon_idx] if colon_idx != -1 else line
    desc = line[colon_idx + 1:].strip() if colon_idx != -1 else ""

    period_idx = main_part.find(".")
    if period_idx == -1:
        return None

    mnem = main_part[:period_idx].strip().upper()
    rest_raw = main_part[period_idx + 1:]
    rest = rest_raw.strip()

    if not rest:
        return LASHeaderItem(mnemonic=mnem, unit="", value="", description=desc)

    # 1. Non-unit well items
    if mnem in NON_UNIT_WELL_MNEMONICS:
        cleaned_val = re.sub(r"\s+", " ", rest)
        return LASHeaderItem(mnemonic=mnem, unit="", value=cleaned_val, description=desc)

    # 2. CWLS Standard: If text after '.' begins with whitespace, there is NO unit
    if rest_raw and rest_raw[0].isspace():
        cleaned_val = re.sub(r"\s+", " ", rest)
        return LASHeaderItem(mnemonic=mnem, unit="", value=cleaned_val, description=desc)

    # 3. Standard with unit: unit is before first whitespace, value is after
    match = re.search(r"\s", rest)
    if match:
        first_space = match.start()
        unit = rest[:first_space].strip()
        val = re.sub(r"\s+", " ", rest[first_space + 1:].strip())
    else:
        unit = rest
        val = ""

    return LASHeaderItem(mnemonic=mnem, unit=unit, value=val, description=desc)


def _parse_curve_header_line(line: str) -> Optional[LASCurveMeta]:
    item = _parse_header_line(line)
    if not item:
        return None
    return LASCurveMeta(
        mnemonic=item.mnemonic,
        unit=item.unit,
        code=item.value or item.mnemonic,
        description=item.description,
    )


def parse_las_content(
    content: str,
    custom_aliases: Optional[List[CustomAliasEntry]] = None,
) -> ParsedLAS:
    """
    Enterprise LAS 2.0 / 3.0 Parser Engine
    Handles dirty headers, missing units, variable whitespace, and NaN/null replacements.
    Separates the depth index curve into depthCurve, tracking data in curves.
    """
    if not content or not isinstance(content, str):
        raise LASParseError("Not a valid LAS file: Empty or invalid content provided.")

    # Validate that standard CWLS section headers exist
    if "~" not in content or not any(s in content.upper() for s in ("~V", "~W", "~C", "~A")):
        raise LASParseError("Not a valid LAS file: missing required CWLS sections (~Version, ~Well, or ~Curves).")

    lines = content.splitlines()

    current_section: Optional[str] = None
    version_items: Dict[str, LASHeaderItem] = {}
    well_items: Dict[str, LASHeaderItem] = {}
    all_curve_metas: List[LASCurveMeta] = []
    header_lines: List[str] = []
    ascii_lines: List[str] = []
    warnings: List[str] = []
    data_sections_seen = 0

    for line in lines:
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#"):
            if current_section not in ("~A", "~ASCII", "~IGNORED_DATA"):
                header_lines.append(line)
            continue

        if trimmed.startswith("~"):
            sec = trimmed.split()[0].upper()
            if sec.endswith("_DATA") or sec.startswith("~A") or sec == "~ASCII":
                data_sections_seen += 1
                if data_sections_seen == 1:
                    current_section = "~A"
                else:
                    current_section = "~IGNORED_DATA"
                    if data_sections_seen == 2:
                        warnings.append("Multiple data sections found; only the first was read.")
            elif sec.startswith("~V"):
                current_section = "~V"
            elif sec.startswith("~W"):
                current_section = "~W"
            elif sec.startswith("~C"):
                current_section = "~C"
            elif sec.startswith("~P"):
                current_section = "~P"
            elif sec.startswith("~O"):
                current_section = "~O"
            else:
                current_section = sec

            if current_section not in ("~A", "~IGNORED_DATA"):
                header_lines.append(line)
            continue

        if current_section not in ("~A", "~IGNORED_DATA"):
            header_lines.append(line)

        if current_section in ("~V", "~W"):
            parsed_item = _parse_header_line(trimmed)
            if parsed_item:
                if current_section == "~V":
                    version_items[parsed_item.mnemonic] = parsed_item
                else:
                    well_items[parsed_item.mnemonic] = parsed_item
        elif current_section == "~C":
            parsed_curve = _parse_curve_header_line(trimmed)
            if parsed_curve:
                all_curve_metas.append(parsed_curve)
        elif current_section == "~A":
            ascii_lines.append(trimmed)

    # Parse well parameters with safe fallbacks
    def _float_val(key: str, default: Optional[float]) -> Optional[float]:
        if key in well_items and well_items[key].value.strip():
            try:
                return float(well_items[key].value.strip())
            except Exception:
                return default
        return default

    start_depth = _float_val("STRT", 0.0) or 0.0
    stop_depth = _float_val("STOP", 0.0) or 0.0
    step = _float_val("STEP", 0.5) or 0.5

    # Check for NULL value declaration
    null_value = _float_val("NULL", None)
    if null_value is None:
        warnings.append("No NULL marker declared in ~Well section; unstated missing value indicators will be tracked.")

    depth_unit = "FT"
    if "STRT" in well_items and well_items["STRT"].unit:
        depth_unit = well_items["STRT"].unit
    elif "STOP" in well_items and well_items["STOP"].unit:
        depth_unit = well_items["STOP"].unit

    raw_well_name = well_items.get("WELL", LASHeaderItem(mnemonic="WELL", unit="", value="", description="")).value.strip()
    well_name = re.sub(r"\s+", " ", raw_well_name).strip() if raw_well_name else ""
    if not well_name:
        warnings.append("Well name (WELL) not declared in ~Well section.")
        well_name = "UNKNOWN_WELL"

    company = re.sub(r"\s+", " ", well_items.get("COMP", LASHeaderItem(mnemonic="COMP", unit="", value="", description="")).value).strip()

    field = re.sub(r"\s+", " ", well_items.get("FLD", LASHeaderItem(mnemonic="FLD", unit="", value="", description="")).value).strip()

    location = re.sub(r"\s+", " ", well_items.get("LOC", LASHeaderItem(mnemonic="LOC", unit="", value="", description="")).value).strip()
    country = re.sub(r"\s+", " ", well_items.get("CTRY", well_items.get("CNTY", LASHeaderItem(mnemonic="CTRY", unit="", value="", description=""))).value).strip()
    state = re.sub(r"\s+", " ", well_items.get("STAT", LASHeaderItem(mnemonic="STAT", unit="", value="", description="")).value).strip()
    api_uwi = re.sub(r"\s+", " ", well_items.get("API", well_items.get("UWI", LASHeaderItem(mnemonic="API", unit="", value="", description=""))).value).strip()
    service_company = re.sub(r"\s+", " ", well_items.get("SRVC", LASHeaderItem(mnemonic="SRVC", unit="", value="", description="")).value).strip()
    date_str = well_items.get("DATE", LASHeaderItem(mnemonic="DATE", unit="", value="", description="")).value.strip()

    lat_val = _float_val("LATI", None)
    lon_val = _float_val("LONG", None)
    lat = lat_val if (lat_val is not None and lat_val != 0.0) else None
    lon = lon_val if (lon_val is not None and lon_val != 0.0) else None

    # Separate Depth Curve from measurement curves
    depth_curve_idx = -1
    for idx, c in enumerate(all_curve_metas):
        std = standardise_mnemonic(c.mnemonic, c.unit, custom_aliases)
        if std.category == "DEPTH" or std.standardMnemonic == "DEPT":
            depth_curve_idx = idx
            break

    if depth_curve_idx == -1 and all_curve_metas:
        depth_curve_idx = 0

    depth_curve_meta = all_curve_metas[depth_curve_idx] if 0 <= depth_curve_idx < len(all_curve_metas) else None
    measurement_curves = [c for idx, c in enumerate(all_curve_metas) if idx != depth_curve_idx]

    # Parse matrix ASCII data
    depth_values: List[float] = []
    curves_data: Dict[str, List[float]] = {c.mnemonic: [] for c in all_curve_metas}
    null_depth_rows: List[int] = []

    for row_idx, line in enumerate(ascii_lines):
        tokens: List[float] = []
        for t in line.split():
            try:
                tokens.append(float(t))
            except ValueError:
                tokens.append(float("nan") if null_value is None else null_value)

        if tokens:
            if 0 <= depth_curve_idx < len(tokens):
                depth_val = tokens[depth_curve_idx]
            else:
                depth_val = tokens[0]

            # Check if depth is null or invalid
            if is_null_value(depth_val, null_value) or math.isnan(depth_val):
                null_depth_rows.append(row_idx)
                warnings.append(f"Row {row_idx + 1} has a null or invalid depth reading ({depth_val}).")

            depth_values.append(depth_val)

            offset = 1 if (depth_curve_idx == -1 and len(tokens) > len(all_curve_metas)) else 0

            for idx, c in enumerate(all_curve_metas):
                token_idx = idx + offset
                val = tokens[token_idx] if token_idx < len(tokens) else (float("nan") if null_value is None else null_value)
                curves_data[c.mnemonic].append(val)

    # Measurements curves dictionary (excluding depth)
    measurement_curves_data: Dict[str, List[float]] = {
        c.mnemonic: curves_data.get(c.mnemonic, []) for c in measurement_curves
    }
    if depth_curve_meta and depth_curve_meta.mnemonic in curves_data:
        # Also preserve depth curve in data dictionary for backwards compatibility
        measurement_curves_data[depth_curve_meta.mnemonic] = curves_data[depth_curve_meta.mnemonic]

    start_d = depth_values[0] if depth_values else start_depth
    stop_d = depth_values[-1] if depth_values else stop_depth

    return ParsedLAS(
        version=version_items.get("VERS", LASHeaderItem(mnemonic="VERS", unit="", value="2.0", description="")).value or "2.0",
        wrap=(version_items.get("WRAP", LASHeaderItem(mnemonic="WRAP", unit="", value="NO", description="")).value or "NO").upper().startswith("Y"),
        wellInfo=WellInfo(
            wellName=well_name,
            company=company,
            field=field,
            location=location,
            country=country,
            state=state,
            apiUwi=api_uwi,
            serviceCompany=service_company,
            date=date_str,
            startDepth=start_d,
            stopDepth=stop_d,
            step=step,
            nullValue=null_value,
            depthUnit=depth_unit,
            latitude=lat,
            longitude=lon,
        ),
        depthCurve=depth_curve_meta,
        curves=measurement_curves,
        data=LASData(
            depth=depth_values,
            curves=measurement_curves_data,
        ),
        rawHeader="\n".join(header_lines),
        totalPoints=len(depth_values),
        warnings=warnings,
        nullDepthRows=null_depth_rows,
    )
