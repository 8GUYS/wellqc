from __future__ import annotations

import random
import re
import string
import time
import warnings
from datetime import datetime, timezone
from typing import Callable, Dict, List, Literal, Optional, Sequence, Set, Tuple, TypeVar

import numpy as np
from pydantic import BaseModel

T = TypeVar("T")
R = TypeVar("R")

MatchType = Literal["CUSTOM", "EXACT", "ALIAS", "PATTERN", "UNKNOWN"]

# Flip to False once every caller passes custom aliases explicitly.
USE_GLOBAL_ALIAS_FALLBACK = True


class CustomAliasEntry(BaseModel):
    id: str
    alias: str
    standardMnemonic: str
    addedBy: str
    addedAt: str  # ISO 8601 string
    userId: Optional[str] = None
    userEmail: Optional[str] = None


class StandardCurveDef(BaseModel):
    standardMnemonic: str
    name: str
    category: str  # 'DEPTH' | 'TRAJECTORY' | 'GAMMA' | 'DENSITY' | 'POROSITY' | 'SONIC' | 'RESISTIVITY' | 'CALIPER' | 'POTENTIAL' | 'TEMPERATURE' | 'OTHER'
    standardUnit: str
    acceptableUnits: List[str]
    aliases: List[str]
    # Hard limits: outside these the value is physically impossible.
    minPhysical: float
    maxPhysical: float
    description: str
    customAliases: Optional[List[CustomAliasEntry]] = None


class _StandardCurvesDict(dict):
    def __missing__(self, key):
        if key == "DEPTH" and "DEPT" in self:
            return self["DEPT"]
        raise KeyError(key)

    def get(self, key, default=None):
        if key not in dict.keys(self) and key == "DEPTH" and "DEPT" in self:
            return self["DEPT"]
        return dict.get(self, key, default)


# Unit lists shared by several curves below.
_RES_UNITS = ["OHMM", "OHM.M", "OHM-M", "OHMS"]
_POROSITY_UNITS = ["V/V", "PU", "P.U.", "%", "PERCENT", "PCT", "DECIMAL", "M3/M3", "FRAC"]
_DEPTH_UNITS = ["FT", "M", "FEET", "METERS", "METRES"]

# TVD is NOT measured depth: its own entry, category TRAJECTORY, so the parser's
# `category == "DEPTH"` depth-column detection never picks it.
STANDARD_CURVES: Dict[str, StandardCurveDef] = _StandardCurvesDict({
    "DEPT": StandardCurveDef(
        standardMnemonic="DEPT",
        name="Measured Depth",
        category="DEPTH",
        standardUnit="FT",
        acceptableUnits=_DEPTH_UNITS,
        aliases=["DEPT", "DEPTH", "MD", "DEPT_FT", "DEPT_M"],
        minPhysical=0.0,
        maxPhysical=25000.0,
        description="Measured depth along borehole trajectory",
    ),
    "TVD": StandardCurveDef(
        standardMnemonic="TVD",
        name="True Vertical Depth",
        category="TRAJECTORY",
        standardUnit="FT",
        acceptableUnits=_DEPTH_UNITS,
        aliases=["TVD", "TVDEPTH"],
        minPhysical=0.0,
        maxPhysical=25000.0,
        description="True vertical depth",
    ),
    "GR": StandardCurveDef(
        standardMnemonic="GR",
        name="Gamma Ray",
        category="GAMMA",
        standardUnit="GAPI",
        acceptableUnits=["GAPI", "API", "EU", "CPS"],
        aliases=["GR", "GAMMA", "GRC", "GAM", "GR_CORR", "GRR", "SGR", "ECGR", "HGR","GRS"],
        minPhysical=0.0,
        maxPhysical=150.0,
        description="Natural gamma ray radiation log",
    ),
    "CGR": StandardCurveDef(
        standardMnemonic="CGR",
        name="Computed Gamma Ray (K+Th)",
        category="GAMMA",
        standardUnit="GAPI",
        acceptableUnits=["GAPI", "API"],
        aliases=["CGR", "HCGR"],
        minPhysical=0.0,
        maxPhysical=150.0,
        description="Gamma ray without uranium contribution",
    ),
    "POTA": StandardCurveDef(
        standardMnemonic="POTA",
        name="Potassium",
        category="GAMMA",
        standardUnit="PCT",
        acceptableUnits=["PCT", "%", "PERCENT"],
        aliases=["HFK"],
        minPhysical=0.0,
        maxPhysical=6.0,
        description="Spectral gamma ray potassium",
    ),
    "THOR": StandardCurveDef(
        standardMnemonic="THOR",
        name="Thorium",
        category="GAMMA",
        standardUnit="PPM",
        acceptableUnits=["PPM"],
        aliases=["HTHO"],
        minPhysical=0.0,
        maxPhysical=30.0,
        description="Spectral gamma ray thorium",
    ),
    "URAN": StandardCurveDef(
        standardMnemonic="URAN",
        name="Uranium",
        category="GAMMA",
        standardUnit="PPM",
        acceptableUnits=["PPM"],
        aliases=["HURA"],
        minPhysical=0.0,
        maxPhysical=10.0,
        description="Spectral gamma ray uranium",
    ),
    "RHOB": StandardCurveDef(
        standardMnemonic="RHOB",
        name="Bulk Density",
        category="DENSITY",
        standardUnit="G/CC",
        acceptableUnits=["G/CC", "G/CM3", "KGM3", "KG/M3", "KG/M^3", "G/C3"],
        aliases=["RHOB", "DEN", "RHOZ", "BDEN", "ZDEN", "RHO", "RHOB_CORR", "RHO8"],
        minPhysical=1.65,
        maxPhysical=2.65,
        description="Formation bulk density log",
    ),
    "NPHI": StandardCurveDef(
        standardMnemonic="NPHI",
        name="Neutron Porosity",
        category="POROSITY",
        standardUnit="V/V",
        acceptableUnits=_POROSITY_UNITS,
        aliases=["NPHI", "NEUT", "CNL", "NPOR", "TNPH", "PHIN", "NPHI_LS", "NPLC", "NPR"],
        minPhysical=0.0,
        maxPhysical=0.6,
        description="Thermal neutron porosity log",
    ),
    "DT": StandardCurveDef(
        standardMnemonic="DT",
        name="Sonic Travel Time",
        category="SONIC",
        standardUnit="US/FT",
        acceptableUnits=["US/F", "US/FT", "US/M", "US/MET", "US/MTR", "US/METER", "US/METRE"],
        aliases=["DT", "DTCO", "AC", "DTC", "SONI", "DELTA_T", "DTC1", "DT35","BCSL"],
        minPhysical=40.0,
        maxPhysical=240.0,
        description="Compressional wave acoustic travel time",
    ),
    "RT": StandardCurveDef(
        standardMnemonic="RT",
        name="True Deep Resistivity",
        category="RESISTIVITY",
        standardUnit="OHMM",
        acceptableUnits=_RES_UNITS,
        aliases=["RT", "ILD", "LLD", "RD", "RES_DEEP", "AT90", "RDEP", "HDRS", "R40O", "AO90"],
        minPhysical=0.2,
        maxPhysical=2000.0,
        description="Deep un-invaded formation resistivity",
    ),
    "RM": StandardCurveDef(
        standardMnemonic="RM",
        name="Medium Resistivity",
        category="RESISTIVITY",
        standardUnit="OHMM",
        acceptableUnits=_RES_UNITS,
        aliases=["RM", "RMED", "ILM", "RES_MED", "AT30", "AT60", "AO30", "AO60"],
        minPhysical=0.2,
        maxPhysical=2000.0,
        description="Medium-depth formation resistivity",
    ),
    "LLS": StandardCurveDef(
        standardMnemonic="LLS",
        name="Shallow Resistivity",
        category="RESISTIVITY",
        standardUnit="OHMM",
        acceptableUnits=["OHMM", "OHM.M"],
        aliases=["LLS", "RS", "RES_SHAL", "AT10", "AT20", "RLA2", "AO10", "AO20"],
        minPhysical=0.2,
        maxPhysical=2000.0,
        description="Shallow invaded zone resistivity",
    ),
    "MSFL": StandardCurveDef(
        standardMnemonic="MSFL",
        name="Micro-spherical Focused Resistivity",
        category="RESISTIVITY",
        standardUnit="OHMM",
        acceptableUnits=["OHMM", "OHM.M"],
        aliases=["MSFL", "RXO", "MICRO", "RFOC", "RMFL"],
        minPhysical=0.2,
        maxPhysical=2000.0,
        description="Flushed zone micro-resistivity",
    ),
    "CALI": StandardCurveDef(
        standardMnemonic="CALI",
        name="Caliper",
        category="CALIPER",
        standardUnit="IN",
        acceptableUnits=["IN", "INCH", "INCHES", "MM", "CM", "MILLIMETER", "CENTIMETER"],
        aliases=["CALI", "CAL", "HCAL", "CALS", "CALP", "CLP", "HDAR", "CALX", "CALY"],
        minPhysical=6.0,
        maxPhysical=16,
        description="Borehole diameter measurement log",
    ),
    "BS": StandardCurveDef(
        standardMnemonic="BS",
        name="Bit Size",
        category="CALIPER",
        standardUnit="IN",
        acceptableUnits=["IN", "INCH", "INCHES", "MM", "CM"],
        aliases=["BS", "BIT", "BITSIZE", "BIT_SIZE"],
        minPhysical=6,
        maxPhysical=16,
        description="Drill bit diameter",
    ),
    "PEF": StandardCurveDef(
        standardMnemonic="PEF",
        name="Photoelectric Factor",
        category="OTHER",
        standardUnit="B/E",
        acceptableUnits=["B/E", "BARN/ELECTRON", "B/ELECT", "PE"],
        aliases=["PEF", "PE", "PEFZ", "PEFL", "PEF8"],
        minPhysical=0.5,
        maxPhysical=15.0,
        description="Photoelectric absorption index log",
    ),
    "SP": StandardCurveDef(
        standardMnemonic="SP",
        name="Spontaneous Potential",
        category="POTENTIAL",
        standardUnit="MV",
        acceptableUnits=["MV", "MILLIVOLTS"],
        aliases=["SP", "SPC", "SPO", "SP_CORR"],
        minPhysical=-250.0,
        maxPhysical=250.0,
        description="Spontaneous electrical potential log",
    ),
    "TEMP": StandardCurveDef(
        standardMnemonic="TEMP",
        name="Temperature",
        category="TEMPERATURE",
        standardUnit="DEGC",
        acceptableUnits=["DEGC", "C"],
        aliases=["TEMP", "TEMPERATURE", "MTEM", "TEMP_C"],
        minPhysical=4.0,
        maxPhysical=220.0,
        description="Borehole or formation temperature",
    ),
})


class StandardisationResult(BaseModel):
    originalMnemonic: str
    standardMnemonic: str
    matchedName: str
    confidence: float  # 0.0 to 1.0
    isAutoMatched: bool
    standardUnit: str
    unitMismatch: bool
    category: str
    matchType: MatchType = "UNKNOWN"
    conflictedWith: Optional[List[str]] = None


class UnitConversionResult(BaseModel):
    values: List[float]
    factor: float
    rule: Literal["NONE", "UNIT", "INFERRED"]
    inferred: bool
    converted: bool
    rawUnit: str
    standardUnit: str


# ---------------------------------------------------------------------------
# Normalisers
# ---------------------------------------------------------------------------
_UNIT_STRIP = re.compile(r"[\s.\-_^*]")


def normalise_mnemonic(mnemonic: Optional[str]) -> str:
    return (mnemonic or "").strip().upper()


def normalise_unit(unit: Optional[str]) -> str:
    """Upper-case and drop spaces, dots, dashes, underscores, ^ and *."""
    return _UNIT_STRIP.sub("", (unit or "").upper())


_UNIT_CANON: Dict[str, str] = {}


def _reg_unit(canon: str, *names: str) -> None:
    _UNIT_CANON[normalise_unit(canon)] = canon
    for n in names:
        _UNIT_CANON[normalise_unit(n)] = canon


_reg_unit("G/CC", "G/CM3", "G/C3", "GM/CC", "GM/CM3", "GCC", "G/CMC")
_reg_unit("KG/M3", "KGM3", "KG/M^3", "KGM/-3", "KG/CUM")
_reg_unit("US/FT", "US/F", "USEC/FT", "US/FEET", "USPF")
_reg_unit("US/M", "US/MET", "US/MTR", "US/METER", "US/METRE", "US/METERS", "USEC/M")
_reg_unit("V/V", "VV", "DECIMAL", "FRAC", "FRACTION", "M3/M3", "DEC")
_reg_unit("PCT", "PERCENT", "PERC", "%", "PU", "P.U.")
_reg_unit("IN", "INCH", "INCHES")
_reg_unit("MM", "MILLIMETER", "MILLIMETRE", "MILLIMETERS")
_reg_unit("CM", "CENTIMETER", "CENTIMETRE")
_reg_unit("MV", "MILLIVOLT", "MILLIVOLTS")
_reg_unit("V", "VOLT", "VOLTS")
_reg_unit("GAPI", "API")
_reg_unit("OHMM", "OHM.M", "OHM-M", "OHM*M")
_reg_unit("FT", "FEET", "FOOT")
_reg_unit("M", "METER", "METERS", "METRE", "METRES")
_reg_unit("DEGC", "C", "CELSIUS", "DEG C")
_reg_unit("B/E", "BARN/ELECTRON", "BARNS/ELECTRON", "B/ELECT", "B/EL")
_reg_unit("PPM")
_reg_unit("PE")
_reg_unit("CPS")
_reg_unit("EU")


def canonical_unit(unit: Optional[str]) -> str:
    n = normalise_unit(unit)
    return _UNIT_CANON.get(n, n)


# ---------------------------------------------------------------------------
# Indexes built once at import
# ---------------------------------------------------------------------------
def _build_builtin_index() -> Dict[str, Tuple[str, str]]:
    idx: Dict[str, Tuple[str, str]] = {}
    for key, def_ in dict.items(STANDARD_CURVES):
        for name in [key] + list(def_.aliases):
            n = normalise_mnemonic(name)
            prev = idx.get(n)
            if prev is not None and prev[0] != key:
                raise ValueError(f"Alias '{n}' is claimed by both {prev[0]} and {key}.")
            idx.setdefault(n, (key, "EXACT" if n == key else "ALIAS"))
    return idx


_BUILTIN_INDEX: Dict[str, Tuple[str, str]] = _build_builtin_index()

_ACCEPTABLE_CANON: Dict[str, Set[str]] = {
    key: {canonical_unit(u) for u in def_.acceptableUnits} | {canonical_unit(def_.standardUnit)}
    for key, def_ in dict.items(STANDARD_CURVES)
}

# Channel suffixes such as GR_1, RHOB:2, DT.1 resolve to their base mnemonic.
_CHANNEL_SUFFIX = re.compile(r"^(?P<base>.+?)[_:.]\d{1,2}$")

_CONFIDENCE: Dict[str, float] = {
    "CUSTOM": 0.98,
    "EXACT": 1.0,
    "ALIAS": 0.95,
    "PATTERN": 0.85,
    "UNKNOWN": 0.0,
}


# "LocalStorage" keys for custom alias overrides -- kept for parity with
# the TS source. Unused here: there is no browser storage server-side.
CUSTOM_ALIASES_KEY = "wellqc_custom_aliases_v2"
LEGACY_CUSTOM_ALIASES_KEY = "wellqc_custom_aliases"

# Runtime in-memory storage for custom aliases (deprecated fallback)
_in_memory_custom_aliases: List[CustomAliasEntry] = []


def get_custom_aliases() -> List[CustomAliasEntry]:
    """Deprecated. Returns the process-wide aliases; pass `custom_list` explicitly instead."""
    return list(_in_memory_custom_aliases)


def set_custom_aliases(entries: List[CustomAliasEntry]) -> None:
    """Deprecated. Shared across requests, so one user's aliases can leak to another."""
    warnings.warn(
        "set_custom_aliases is deprecated; pass custom aliases explicitly.",
        DeprecationWarning,
        stacklevel=2,
    )
    global _in_memory_custom_aliases
    _in_memory_custom_aliases = list(entries)


def _resolve_custom(custom_list: Optional[Sequence[CustomAliasEntry]]) -> Sequence[CustomAliasEntry]:
    if custom_list is not None:
        return custom_list
    if USE_GLOBAL_ALIAS_FALLBACK:
        return _in_memory_custom_aliases
    return []


def _canon_target(target: Optional[str]) -> str:
    t = normalise_mnemonic(target)
    return "DEPT" if t == "DEPTH" else t


def _custom_index(entries: Sequence[CustomAliasEntry]) -> Dict[str, str]:
    """alias -> standard key. Entries pointing at unknown curves are ignored."""
    idx: Dict[str, str] = {}
    for e in entries:
        alias = normalise_mnemonic(e.alias)
        target = _canon_target(e.standardMnemonic)
        if alias and target in STANDARD_CURVES:
            idx.setdefault(alias, target)
    return idx


# ---------------------------------------------------------------------------
# Alias validation
# ---------------------------------------------------------------------------
class AliasValidationResult(BaseModel):
    valid: bool
    error: Optional[str] = None
    mappedCurve: Optional[str] = None


_ALIAS_CHARS = re.compile(r"^[A-Z0-9_:.\-]+$")
MAX_ALIAS_LENGTH = 24


def _alias_conflict(
    alias: str, existing_curve: str, target: str, same_target_phrase: str
) -> AliasValidationResult:
    if existing_curve.upper() != target:
        error = f"{alias} is already mapped to {existing_curve}. Remove or choose a different alias."
    else:
        error = f"{alias} is already {same_target_phrase} {existing_curve}."
    return AliasValidationResult(valid=False, error=error, mappedCurve=existing_curve)


def validate_alias_for_curve(
    alias: str,
    target_curve: str,
    editing_alias: Optional[str] = None,
    custom_aliases_list: Optional[List[CustomAliasEntry]] = None,
) -> AliasValidationResult:
    """
    Validates whether a new or edited alias is usable for `target_curve`: it must be
    well formed, the target must exist, and no other curve (built-in or custom) may
    already claim it. Conflicts return the inline message:
    "{alias} is already mapped to {otherCurve}. Remove or choose a different alias."
    """
    clean_alias = normalise_mnemonic(alias)
    clean_target = _canon_target(target_curve)

    if not clean_alias:
        return AliasValidationResult(valid=False, error="Alias cannot be empty.")
    if len(clean_alias) > MAX_ALIAS_LENGTH:
        return AliasValidationResult(
            valid=False, error=f"Alias is too long (maximum {MAX_ALIAS_LENGTH} characters)."
        )
    if not _ALIAS_CHARS.match(clean_alias):
        return AliasValidationResult(
            valid=False,
            error="Alias may only contain letters, digits and the characters _ : . -",
        )
    if clean_target not in STANDARD_CURVES:
        return AliasValidationResult(valid=False, error=f"Unknown standard curve '{clean_target}'.")

    clean_editing = normalise_mnemonic(editing_alias) if editing_alias else None

    # 1. Search every standard curve's standard mnemonic and built-in aliases
    built_in = _BUILTIN_INDEX.get(clean_alias)
    if built_in is not None:
        key, kind = built_in
        phrase = "the standard mnemonic for" if kind == "EXACT" else "a built-in alias for"
        return _alias_conflict(clean_alias, STANDARD_CURVES[key].standardMnemonic, clean_target, phrase)

    # 2. Search every custom alias across all curves
    custom_entries = custom_aliases_list if custom_aliases_list is not None else _resolve_custom(None)
    for entry in custom_entries:
        entry_alias = normalise_mnemonic(entry.alias)
        entry_curve = _canon_target(entry.standardMnemonic)

        # If editing self, skip
        if clean_editing and entry_alias == clean_editing and entry_curve == clean_target:
            continue

        if entry_alias == clean_alias:
            return _alias_conflict(clean_alias, entry.standardMnemonic, clean_target, "an alias for")

    return AliasValidationResult(valid=True, mappedCurve=clean_target)


class AddAliasResult(BaseModel):
    success: bool
    error: Optional[str] = None
    mappedCurve: Optional[str] = None
    entry: Optional[CustomAliasEntry] = None


def _generate_id() -> str:
    """Port of `alias_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`."""
    rand_part = "".join(random.choices(string.ascii_lowercase + string.digits, k=5))
    return f"alias_{int(time.time() * 1000)}_{rand_part}"


def _iso_now() -> str:
    """Port of `new Date().toISOString()`."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _same_alias(entry: CustomAliasEntry, mnemonic: str, alias: str) -> bool:
    return _canon_target(entry.standardMnemonic) == mnemonic and normalise_mnemonic(entry.alias) == alias


def _commit(updated: List[CustomAliasEntry], custom_list: Optional[List[CustomAliasEntry]]) -> None:
    """Explicit list: caller owns persistence and nothing is shared. No list: legacy global state."""
    if custom_list is None:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            set_custom_aliases(updated)
    else:
        custom_list[:] = updated


def add_custom_alias(
    standard_mnemonic: str,
    new_alias: str,
    added_by: str = "Petrophysicist",
    custom_list: Optional[List[CustomAliasEntry]] = None,
) -> AddAliasResult:
    """
    Add a custom alias with duplicate verification across all curves.
    With `custom_list` the list is updated in place and no shared state is touched.
    """
    clean_alias = normalise_mnemonic(new_alias)
    clean_mnem = _canon_target(standard_mnemonic)

    validation = validate_alias_for_curve(clean_alias, clean_mnem, custom_aliases_list=custom_list)
    if not validation.valid:
        return AddAliasResult(success=False, error=validation.error, mappedCurve=validation.mappedCurve)

    new_entry = CustomAliasEntry(
        id=_generate_id(),
        alias=clean_alias,
        standardMnemonic=clean_mnem,
        addedBy=added_by,
        addedAt=_iso_now(),
    )

    current = list(custom_list) if custom_list is not None else get_custom_aliases()
    _commit(current + [new_entry], custom_list)

    return AddAliasResult(success=True, mappedCurve=clean_mnem, entry=new_entry)


def edit_custom_alias(
    standard_mnemonic: str,
    old_alias: str,
    new_alias: str,
    custom_list: Optional[List[CustomAliasEntry]] = None,
) -> AddAliasResult:
    """Edit an existing custom alias with duplicate verification."""
    clean_old = normalise_mnemonic(old_alias)
    clean_new = normalise_mnemonic(new_alias)
    clean_mnem = _canon_target(standard_mnemonic)

    current = list(custom_list) if custom_list is not None else get_custom_aliases()

    if clean_old == clean_new:
        existing = next((e for e in current if _same_alias(e, clean_mnem, clean_old)), None)
        return AddAliasResult(success=True, mappedCurve=clean_mnem, entry=existing)

    validation = validate_alias_for_curve(clean_new, clean_mnem, clean_old, custom_aliases_list=current)
    if not validation.valid:
        return AddAliasResult(success=False, error=validation.error, mappedCurve=validation.mappedCurve)

    index = next((i for i, e in enumerate(current) if _same_alias(e, clean_mnem, clean_old)), -1)
    if index == -1:
        return AddAliasResult(success=False, error=f'Alias "{old_alias}" not found under {standard_mnemonic}.')

    updated_entry = current[index].model_copy(update={"alias": clean_new, "addedAt": _iso_now()})

    updated = list(current)
    updated[index] = updated_entry
    _commit(updated, custom_list)

    return AddAliasResult(success=True, mappedCurve=clean_mnem, entry=updated_entry)


def remove_custom_alias(
    standard_mnemonic: str,
    alias_to_remove: str,
    custom_list: Optional[List[CustomAliasEntry]] = None,
) -> bool:
    """Remove an existing custom alias."""
    clean_alias = normalise_mnemonic(alias_to_remove)
    clean_mnem = _canon_target(standard_mnemonic)

    current = list(custom_list) if custom_list is not None else get_custom_aliases()
    updated = [e for e in current if not _same_alias(e, clean_mnem, clean_alias)]

    if len(updated) == len(current):
        return False

    _commit(updated, custom_list)
    return True


def update_active_upload_with_new_alias(reanalyzer: Optional[Callable[[T], R]] = None) -> bool:
    # Browser-only in the TS source (re-runs QA for the open upload). The UI now does this
    # itself through the backend (`refreshActiveUploadQa` in src/lib/las/api.ts).
    return False


def get_merged_standard_curves(
    custom_list: Optional[List[CustomAliasEntry]] = None,
) -> Dict[str, StandardCurveDef]:
    """Retrieve standard curve definitions merged with custom persistent aliases."""
    custom = _resolve_custom(custom_list)
    merged = _StandardCurvesDict()

    for key, def_ in dict.items(STANDARD_CURVES):
        curve_custom = [c for c in custom if _canon_target(c.standardMnemonic) == key]
        custom_aliases = [c.alias for c in curve_custom]
        combined_aliases = list(dict.fromkeys(def_.aliases + custom_aliases))
        merged[key] = def_.model_copy(update={"aliases": combined_aliases, "customAliases": curve_custom})

    # merged["DEPTH"] resolution is handled by _StandardCurvesDict itself
    # (mirrors the TS source's Object.defineProperty on `merged`).
    return merged


# ---------------------------------------------------------------------------
# Mnemonic matching
# ---------------------------------------------------------------------------
def _lookup(name: str, custom_idx: Dict[str, str]) -> Optional[Tuple[str, str]]:
    if not name:
        return None
    if name in custom_idx:
        return custom_idx[name], "CUSTOM"
    return _BUILTIN_INDEX.get(name)


def _unit_mismatch(std_key: str, raw_unit: str) -> bool:
    if not normalise_unit(raw_unit):
        return False
    return canonical_unit(raw_unit) not in _ACCEPTABLE_CANON[std_key]


def standardise_mnemonic(
    raw_mnemonic: str,
    raw_unit: str = "",
    custom_list: Optional[List[CustomAliasEntry]] = None,
) -> StandardisationResult:
    clean_mnem = normalise_mnemonic(raw_mnemonic)
    custom_idx = _custom_index(_resolve_custom(custom_list))

    # Custom alias -> standard key -> built-in alias
    hit = _lookup(clean_mnem, custom_idx)

    # Channel suffix (GR_1, RHOB:2 ...) resolves to the base mnemonic
    if hit is None:
        m = _CHANNEL_SUFFIX.match(clean_mnem)
        if m:
            base_hit = _lookup(m.group("base"), custom_idx)
            if base_hit is not None:
                hit = (base_hit[0], "PATTERN")

    # Fallback match for custom curves (e.g., ROP, TORQ, CWD)
    if hit is None:
        clean_unit = (raw_unit or "").strip().upper()
        return StandardisationResult(
            originalMnemonic=raw_mnemonic,
            standardMnemonic=clean_mnem,
            matchedName=f"Custom Curve ({clean_mnem})",
            confidence=_CONFIDENCE["UNKNOWN"],
            isAutoMatched=False,
            standardUnit=clean_unit or "UNKN",
            unitMismatch=False,
            category="OTHER",
            matchType="UNKNOWN",
        )

    key, match_type = hit
    std = STANDARD_CURVES[key]
    return StandardisationResult(
        originalMnemonic=raw_mnemonic,
        standardMnemonic=std.standardMnemonic,
        matchedName=std.name,
        confidence=_CONFIDENCE[match_type],
        isAutoMatched=True,
        standardUnit=std.standardUnit,
        unitMismatch=_unit_mismatch(key, raw_unit),
        category=std.category,
        matchType=match_type,  # type: ignore[arg-type]
    )


class RawCurveRef(BaseModel):
    """Port of the inline `{ mnemonic: string; unit?: string }[]` parameter
    type of resolveCurveSetConflicts."""
    mnemonic: str
    unit: Optional[str] = None


def resolve_curve_set_conflicts(
    raw_curves: List[RawCurveRef],
    custom_list: Optional[List[CustomAliasEntry]] = None,
) -> List[StandardisationResult]:
    initial_results = [standardise_mnemonic(c.mnemonic, c.unit or "", custom_list) for c in raw_curves]
    grouped_by_standard: Dict[str, List[int]] = {}
    for index, result in enumerate(initial_results):
        if not result.isAutoMatched:
            continue
        group = grouped_by_standard.setdefault(result.standardMnemonic, [])
        group.append(index)

    results: List[StandardisationResult] = []
    for index, result in enumerate(initial_results):
        resolved = result
        for standard_mnemonic, indices in grouped_by_standard.items():
            if len(indices) > 1 and index in indices:
                position_in_group = indices.index(index)  # 0 = first occurrence, keeps the base name
                other_original_mnemonics = [
                    normalise_mnemonic(raw_curves[i].mnemonic) for i in indices if i != index
                ]

                disambiguated_name = (
                    standard_mnemonic if position_in_group == 0 else f"{standard_mnemonic}_{position_in_group}"
                )

                resolved = result.model_copy(
                    update=dict(
                        standardMnemonic=disambiguated_name,
                        matchedName=f"{result.matchedName} (auto-disambiguated: {len(indices)} curves share this family)",
                        isAutoMatched=True,
                        confidence=min(result.confidence, 0.75),
                        conflictedWith=other_original_mnemonics,
                    )
                )
                break
        results.append(resolved)

    return results


# ---------------------------------------------------------------------------
# Unit conversion (decided once per curve, never per value)
# ---------------------------------------------------------------------------
_MM_PER_IN = 25.4
_CM_PER_IN = 2.54
_US_M_PER_US_FT = 3.280839895

_PERCENT_POROSITY = ("NPHI",)

# standard key -> {canonical raw unit: multiplier to reach the standard unit}
_UNIT_FACTORS: Dict[str, Dict[str, float]] = {}
for _k in _PERCENT_POROSITY:
    _UNIT_FACTORS[_k] = {"PCT": 0.01}
for _k in ("RHOB",):
    _UNIT_FACTORS[_k] = {"KG/M3": 0.001}
for _k in ("CALI", "BS"):
    _UNIT_FACTORS[_k] = {"MM": 1.0 / _MM_PER_IN, "CM": 1.0 / _CM_PER_IN}
for _k in ("DT",):
    _UNIT_FACTORS[_k] = {"US/M": 1.0 / _US_M_PER_US_FT}
_UNIT_FACTORS["SP"] = {"V": 1000.0}

_HARD_NULL_SENTINELS = {-999.25, -9999.0, 999.25, -999.9}


def _is_null(val: Optional[float], null_value: Optional[float]) -> bool:
    """Mirrors diagnostics.is_null_value; duplicated to keep this module a leaf."""
    if val is None:
        return True
    try:
        f = float(val)
    except (TypeError, ValueError):
        return True
    if f != f or f in (float("inf"), float("-inf")):
        return True
    if null_value is not None and abs(f - null_value) < 0.01:
        return True
    return f in _HARD_NULL_SENTINELS


def unit_factor(raw_unit: str, standard_mnemonic: str) -> float:
    """Multiplier implied by the declared unit alone (1.0 if none or unrecognised)."""
    return _UNIT_FACTORS.get(standard_mnemonic, {}).get(canonical_unit(raw_unit), 1.0)


def _unit_is_recognised(standard_mnemonic: str, canon: str) -> bool:
    if not canon:
        return False
    if canon in _UNIT_FACTORS.get(standard_mnemonic, {}):
        return True
    return canon in _ACCEPTABLE_CANON.get(standard_mnemonic, set())


def _infer_factor(standard_mnemonic: str, valid_values: Sequence[float]) -> float:
    """Conservative inference for curves with a blank or unrecognised unit."""
    if len(valid_values) < 10:
        return 1.0
    arr = np.asarray(valid_values, dtype=float)
    median = float(np.median(arr))
    if standard_mnemonic in _PERCENT_POROSITY and float(np.percentile(arr, 99)) > 1.5:
        return 0.01
    if standard_mnemonic == "RHOB" and median > 100.0:
        return 0.001
    if standard_mnemonic in ("CALI", "BS") and median > 40.0:
        return 1.0 / _MM_PER_IN
    if standard_mnemonic == "DT" and median > 250.0:
        return 1.0 / _US_M_PER_US_FT
    return 1.0


def convert_series_to_standard_unit(
    values: Sequence[float],
    raw_unit: str,
    standard_mnemonic: str,
    null_value: Optional[float] = None,
) -> UnitConversionResult:
    """
    Convert a whole curve with one factor.

    rule == "UNIT":     the declared unit told us the factor.
    rule == "INFERRED": the unit was blank/unrecognised and the data magnitude implied it.
    rule == "NONE":     no conversion applied.
    Null samples are left exactly as they were.
    """
    std_def = STANDARD_CURVES.get(standard_mnemonic)
    std_unit = std_def.standardUnit if std_def else ""
    canon = canonical_unit(raw_unit)
    factors = _UNIT_FACTORS.get(standard_mnemonic, {})

    inferred = False
    if canon in factors:
        factor, rule = factors[canon], "UNIT"
    elif std_def is None or _unit_is_recognised(standard_mnemonic, canon):
        factor, rule = 1.0, "NONE"
    else:
        valid = [v for v in values if not _is_null(v, null_value)]
        factor = _infer_factor(standard_mnemonic, valid)
        inferred = factor != 1.0
        rule = "INFERRED" if inferred else "NONE"

    if factor == 1.0:
        out = list(values)
    else:
        out = [v if _is_null(v, null_value) else round(v * factor, 10) for v in values]

    return UnitConversionResult(
        values=out,
        factor=factor,
        rule=rule,  # type: ignore[arg-type]
        inferred=inferred,
        converted=factor != 1.0,
        rawUnit=raw_unit,
        standardUnit=std_unit,
    )


def convert_to_standard_unit(
    value: float,
    raw_unit: str,
    standard_mnemonic: str,
) -> Tuple[float, bool]:
    """
    Scalar compatibility wrapper. Uses the declared unit only (no magnitude
    guessing), so the same unit always gives the same factor for every value.
    Prefer convert_series_to_standard_unit for whole curves.
    """
    factor = unit_factor(raw_unit, standard_mnemonic)
    if factor == 1.0:
        return value, False
    return round(value * factor, 10), True