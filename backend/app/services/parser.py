from __future__ import annotations
import math
import re
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from backend.app.services.standardiser import standardise_mnemonic

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
    company: str = "NDI-GROUP-5"
    field: str = "NIGER DELTA"
    location: str = ""
    country: str = "NIGERIA"
    state: str = "DELTA STATE"
    apiUwi: str = "API-UNKNOWN"
    serviceCompany: str = "SLB"
    date: str = ""
    startDepth: float = 0.0
    stopDepth: float = 0.0
    step: float = 0.5
    nullValue: float = -999.25
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
    curves: List[LASCurveMeta]
    data: LASData
    rawHeader: str = ""
    totalPoints: int = 0


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

    if rest_raw.startswith(" "):
        return LASHeaderItem(mnemonic=mnem, unit="", value=rest, description=desc)

    # Unit is before first whitespace, value is after
    match = re.search(r"\s", rest)
    if match:
        first_space = match.start()
        unit = rest[:first_space].strip()
        val = rest[first_space + 1:].strip()
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


def parse_las_content(content: str) -> ParsedLAS:
    """
    Enterprise LAS 2.0 / 3.0 Parser Engine
    Handles dirty headers, missing units, variable whitespace, and NaN/null replacements.
    """
    lines = content.splitlines()

    current_section: Optional[str] = None
    version_items: Dict[str, LASHeaderItem] = {}
    well_items: Dict[str, LASHeaderItem] = {}
    curve_metas: List[LASCurveMeta] = []
    header_lines: List[str] = []
    ascii_lines: List[str] = []

    for line in lines:
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#"):
            if current_section not in ("~A", "~ASCII"):
                header_lines.append(line)
            continue

        if trimmed.startswith("~"):
            sec = trimmed.split()[0].upper()
            if sec.startswith("~V"):
                current_section = "~V"
            elif sec.startswith("~W"):
                current_section = "~W"
            elif sec.startswith("~C"):
                current_section = "~C"
            elif sec.startswith("~P"):
                current_section = "~P"
            elif sec.startswith("~O"):
                current_section = "~O"
            elif sec.startswith("~A"):
                current_section = "~A"
            else:
                current_section = sec

            if current_section != "~A":
                header_lines.append(line)
            continue

        if current_section != "~A":
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
                curve_metas.append(parsed_curve)
        elif current_section == "~A":
            ascii_lines.append(trimmed)

    # Parse well parameters with safe fallbacks
    def _float_val(key: str, default: float) -> float:
        try:
            return float(well_items[key].value) if key in well_items and well_items[key].value else default
        except Exception:
            return default

    start_depth = _float_val("STRT", 0.0)
    stop_depth = _float_val("STOP", 0.0)
    step = _float_val("STEP", 0.5)
    null_value = _float_val("NULL", -999.25)

    depth_unit = "FT"
    if "STRT" in well_items and well_items["STRT"].unit:
        depth_unit = well_items["STRT"].unit
    elif "STOP" in well_items and well_items["STOP"].unit:
        depth_unit = well_items["STOP"].unit

    well_name = well_items.get("WELL", LASHeaderItem(mnemonic="WELL", unit="", value="UNKNOWN_WELL", description="")).value or "UNKNOWN_WELL"
    company = well_items.get("COMP", LASHeaderItem(mnemonic="COMP", unit="", value="NDI-GROUP-5", description="")).value or "NDI-GROUP-5"
    field = well_items.get("FLD", LASHeaderItem(mnemonic="FLD", unit="", value="NIGER DELTA", description="")).value or "NIGER DELTA"
    location = well_items.get("LOC", LASHeaderItem(mnemonic="LOC", unit="", value="", description="")).value or ""
    country = well_items.get("CTRY", well_items.get("CNTY", LASHeaderItem(mnemonic="CTRY", unit="", value="NIGERIA", description=""))).value or "NIGERIA"
    state = well_items.get("STAT", LASHeaderItem(mnemonic="STAT", unit="", value="DELTA STATE", description="")).value or "DELTA STATE"
    api_uwi = well_items.get("API", well_items.get("UWI", LASHeaderItem(mnemonic="API", unit="", value="API-12345", description=""))).value or "API-12345"
    service_company = well_items.get("SRVC", LASHeaderItem(mnemonic="SRVC", unit="", value="SLB", description="")).value or "SLB"
    date_str = well_items.get("DATE", LASHeaderItem(mnemonic="DATE", unit="", value="", description="")).value or ""

    lat_val = _float_val("LATI", 0.0)
    lon_val = _float_val("LONG", 0.0)
    lat = lat_val if lat_val != 0.0 else None
    lon = lon_val if lon_val != 0.0 else None

    # Parse matrix ASCII data
    depth_values: List[float] = []
    curves_data: Dict[str, List[float]] = {c.mnemonic: [] for c in curve_metas}

    # Identify if any curve in curve_metas represents Measured Depth
    depth_curve_idx = -1
    for idx, c in enumerate(curve_metas):
        std = standardise_mnemonic(c.mnemonic, c.unit)
        if std.category == "DEPTH" or std.standardMnemonic == "DEPT":
            depth_curve_idx = idx
            break

    for line in ascii_lines:
        tokens: List[float] = []
        for t in line.split():
            try:
                tokens.append(float(t))
            except ValueError:
                tokens.append(null_value)

        if tokens:
            if 0 <= depth_curve_idx < len(tokens):
                depth_val = tokens[depth_curve_idx]
            else:
                depth_val = tokens[0]
            depth_values.append(depth_val)

            offset = 1 if (depth_curve_idx == -1 and len(tokens) > len(curve_metas)) else 0

            for idx, c in enumerate(curve_metas):
                token_idx = idx + offset
                val = tokens[token_idx] if token_idx < len(tokens) else null_value
                curves_data[c.mnemonic].append(null_value if math.isnan(val) else val)

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
            startDepth=start_depth if start_depth != 0.0 or not depth_values else depth_values[0],
            stopDepth=stop_depth if stop_depth != 0.0 or not depth_values else depth_values[-1],
            step=step,
            nullValue=null_value,
            depthUnit=depth_unit,
            latitude=lat,
            longitude=lon,
        ),
        curves=curve_metas,
        data=LASData(
            depth=depth_values,
            curves=curves_data,
        ),
        rawHeader="\n".join(header_lines),
        totalPoints=len(depth_values),
    )
