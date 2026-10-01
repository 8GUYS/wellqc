from typing import Dict, List, Optional, Set, Any
from pydantic import BaseModel

class CustomAliasEntry(BaseModel):
    id: str
    alias: str
    standardMnemonic: str
    addedBy: str
    addedAt: str
    userId: Optional[str] = None
    userEmail: Optional[str] = None

class StandardCurveDef(BaseModel):
    standardMnemonic: str
    name: str
    category: str
    standardUnit: str
    acceptableUnits: List[str]
    aliases: List[str]
    customAliases: Optional[List[CustomAliasEntry]] = None
    minPhysical: float
    maxPhysical: float
    description: str

class StandardisationResult(BaseModel):
    originalMnemonic: str
    standardMnemonic: str
    matchedName: str
    confidence: float
    isAutoMatched: bool
    standardUnit: str
    unitMismatch: bool
    category: str

class AliasValidationResult(BaseModel):
    valid: bool
    error: Optional[str] = None
    mappedCurve: Optional[str] = None

STANDARD_CURVES: Dict[str, StandardCurveDef] = {
    "DEPT": StandardCurveDef(
        standardMnemonic="DEPT",
        name="Measured Depth",
        category="DEPTH",
        standardUnit="FT",
        acceptableUnits=["FT", "M", "FEET", "METERS"],
        aliases=["DEPT", "DEPTH", "MD", "TVD", "DEPT_FT", "DEPT_M"],
        minPhysical=0.0,
        maxPhysical=50000.0,
        description="Measured depth along borehole trajectory",
    ),
    "GR": StandardCurveDef(
        standardMnemonic="GR",
        name="Gamma Ray",
        category="GAMMA",
        standardUnit="GAPI",
        acceptableUnits=["GAPI", "API", "EU", "CPS"],
        aliases=["GR", "GAMMA", "GRC", "GAM", "GR_CORR", "GRR", "SGR", "ECGR", "HGR"],
        minPhysical=0.0,
        maxPhysical=150.0,
        description="Natural gamma ray radiation log",
    ),
    "RHOB": StandardCurveDef(
        standardMnemonic="RHOB",
        name="Bulk Density",
        category="DENSITY",
        standardUnit="G/CC",
        acceptableUnits=["G/CC", "G/CM3", "KGM3", "KG/M3", "KG/M^3", "G/C3", "KGM/-3"],
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
        acceptableUnits=["V/V", "PU", "P.U.", "%", "PERCENT", "PCT", "DECIMAL", "M3/M3"],
        aliases=["NPHI", "NEUT", "CNL", "NPOR", "TNPH", "PHIN", "NPHI_LS", "NPLC", "NPR"],
        minPhysical=0.0,
        maxPhysical=0.60,
        description="Thermal neutron porosity log",
    ),
    "DT": StandardCurveDef(
        standardMnemonic="DT",
        name="Sonic Travel Time",
        category="SONIC",
        standardUnit="US/F",
        acceptableUnits=["US/F", "US/FT", "US/M", "US/MET", "US/MTR", "US/METER", "US/METRE"],
        aliases=["DT", "DTCO", "AC", "DTC", "SONI", "DELTA_T", "DTC1", "DT35"],
        minPhysical=20.0,
        maxPhysical=240.0,
        description="Compressional wave acoustic travel time",
    ),
    "RT": StandardCurveDef(
        standardMnemonic="RT",
        name="True Deep Resistivity",
        category="RESISTIVITY",
        standardUnit="OHMM",
        acceptableUnits=["OHMM", "OHM.M", "OHM-M", "OHMS"],
        aliases=["RT", "ILD", "LLD", "RD", "RES_DEEP", "AT90", "RDEP", "HDRS", "R40O", "AO90"],
        minPhysical=0.2,
        maxPhysical=2000.0,
        description="Deep un-invaded formation resistivity",
    ),
    "CALI": StandardCurveDef(
        standardMnemonic="CALI",
        name="Caliper",
        category="CALIPER",
        standardUnit="IN",
        acceptableUnits=["IN", "INCH", "MM", "CM", "MILLIMETER", "CENTIMETER"],
        aliases=["CALI", "CAL", "HCAL", "CALS", "CALP", "BS", "CLP", "HDAR"],
        minPhysical=6.0,
        maxPhysical=16.0,
        description="Borehole diameter measurement log",
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
        acceptableUnits=["MV", "VOLTS", "MILLIVOLTS"],
        aliases=["SP", "SPC", "SPO", "SP_CORR"],
        minPhysical=-250.0,
        maxPhysical=250.0,
        description="Spontaneous electrical potential log",
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
    "LLS": StandardCurveDef(
        standardMnemonic="LLS",
        name="Shallow Resistivity",
        category="RESISTIVITY",
        standardUnit="OHMM",
        acceptableUnits=["OHMM", "OHM.M"],
        aliases=["LLS", "ILM", "RS", "RES_SHAL", "AT20", "RLA2"],
        minPhysical=0.2,
        maxPhysical=2000.0,
        description="Shallow invaded zone resistivity",
    ),
}

# In-memory runtime custom aliases fallback
_in_memory_custom_aliases: List[CustomAliasEntry] = []

def get_custom_aliases() -> List[CustomAliasEntry]:
    return list(_in_memory_custom_aliases)

def set_custom_aliases(entries: List[CustomAliasEntry]) -> None:
    global _in_memory_custom_aliases
    _in_memory_custom_aliases = list(entries)

def get_merged_standard_curves(
    custom_list: Optional[List[CustomAliasEntry]] = None,
) -> Dict[str, StandardCurveDef]:
    custom = custom_list if custom_list is not None else get_custom_aliases()
    merged: Dict[str, StandardCurveDef] = {}

    for key, def_ in STANDARD_CURVES.items():
        curve_custom = [
            c for c in custom
            if c.standardMnemonic.upper() == def_.standardMnemonic.upper()
            or c.standardMnemonic.upper() == key.upper()
        ]
        custom_aliases = [c.alias for c in curve_custom]
        combined = list(dict.fromkeys(def_.aliases + custom_aliases))

        merged[key] = def_.model_copy(update={
            "aliases": combined,
            "customAliases": curve_custom,
        })

    return merged

def validate_alias_for_curve(
    alias: str,
    target_curve: str,
    editing_alias: Optional[str] = None,
    custom_aliases_list: Optional[List[CustomAliasEntry]] = None,
) -> AliasValidationResult:
    clean_alias = alias.strip().upper()
    clean_target_raw = target_curve.strip().upper()
    clean_target = "DEPT" if clean_target_raw == "DEPTH" else clean_target_raw

    if not clean_alias:
        return AliasValidationResult(valid=False, error="Alias cannot be empty.")

    clean_editing = editing_alias.strip().upper() if editing_alias else None

    # 1. Search every standard curve's standard mnemonic and built-in aliases
    for key, def_ in STANDARD_CURVES.items():
        curve_mnem = def_.standardMnemonic.upper()

        if clean_alias == curve_mnem or clean_alias == key.upper():
            if curve_mnem != clean_target and key.upper() != clean_target:
                return AliasValidationResult(
                    valid=False,
                    error=f"{clean_alias} is already mapped to {def_.standardMnemonic}. Remove or choose a different alias.",
                    mappedCurve=def_.standardMnemonic,
                )
            else:
                return AliasValidationResult(
                    valid=False,
                    error=f"{clean_alias} is already the standard mnemonic for {def_.standardMnemonic}.",
                    mappedCurve=def_.standardMnemonic,
                )

        for built_in in def_.aliases:
            if built_in.strip().upper() == clean_alias:
                if curve_mnem != clean_target and key.upper() != clean_target:
                    return AliasValidationResult(
                        valid=False,
                        error=f"{clean_alias} is already mapped to {def_.standardMnemonic}. Remove or choose a different alias.",
                        mappedCurve=def_.standardMnemonic,
                    )
                else:
                    return AliasValidationResult(
                        valid=False,
                        error=f"{clean_alias} is already a built-in alias for {def_.standardMnemonic}.",
                        mappedCurve=def_.standardMnemonic,
                    )

    # 2. Search custom aliases across all curves
    custom_entries = custom_aliases_list if custom_aliases_list is not None else get_custom_aliases()
    for entry in custom_entries:
        entry_alias = entry.alias.strip().upper()
        entry_curve = entry.standardMnemonic.strip().upper()

        if clean_editing and entry_alias == clean_editing and entry_curve == clean_target:
            continue

        if entry_alias == clean_alias:
            if entry_curve != clean_target:
                return AliasValidationResult(
                    valid=False,
                    error=f"{clean_alias} is already mapped to {entry.standardMnemonic}. Remove or choose a different alias.",
                    mappedCurve=entry.standardMnemonic,
                )
            else:
                return AliasValidationResult(
                    valid=False,
                    error=f"{clean_alias} is already an alias for {entry.standardMnemonic}.",
                    mappedCurve=entry.standardMnemonic,
                )

    return AliasValidationResult(valid=True)

def standardise_mnemonic(
    raw_mnemonic: str,
    raw_unit: str = "",
    custom_list: Optional[List[CustomAliasEntry]] = None,
) -> StandardisationResult:
    clean_mnem = raw_mnemonic.strip().upper()
    clean_unit = raw_unit.strip().upper()
    curves = get_merged_standard_curves(custom_list)

    # Exact match against standard keys
    if clean_mnem in curves:
        std = curves[clean_mnem]
        return StandardisationResult(
            originalMnemonic=raw_mnemonic,
            standardMnemonic=std.standardMnemonic,
            matchedName=std.name,
            confidence=1.0,
            isAutoMatched=True,
            standardUnit=std.standardUnit,
            unitMismatch=bool(clean_unit and clean_unit not in std.acceptableUnits),
            category=std.category,
        )
    if clean_mnem == "DEPTH" and "DEPT" in curves:
        std = curves["DEPT"]
        return StandardisationResult(
            originalMnemonic=raw_mnemonic,
            standardMnemonic=std.standardMnemonic,
            matchedName=std.name,
            confidence=1.0,
            isAutoMatched=True,
            standardUnit=std.standardUnit,
            unitMismatch=bool(clean_unit and clean_unit not in std.acceptableUnits),
            category=std.category,
        )

    # Alias lookup matching
    for std in curves.values():
        for alias in std.aliases:
            if clean_mnem == alias or clean_mnem.startswith(alias) or alias.startswith(clean_mnem):
                confidence = 0.95 if clean_mnem == alias else 0.82
                return StandardisationResult(
                    originalMnemonic=raw_mnemonic,
                    standardMnemonic=std.standardMnemonic,
                    matchedName=std.name,
                    confidence=confidence,
                    isAutoMatched=True,
                    standardUnit=std.standardUnit,
                    unitMismatch=bool(clean_unit and clean_unit not in std.acceptableUnits),
                    category=std.category,
                )

    # Fallback match for custom curves
    return StandardisationResult(
        originalMnemonic=raw_mnemonic,
        standardMnemonic=clean_mnem,
        matchedName=f"Custom Curve ({clean_mnem})",
        confidence=0.50,
        isAutoMatched=False,
        standardUnit=clean_unit or "UNKN",
        unitMismatch=False,
        category="OTHER",
    )

def convert_to_standard_unit(
    value: float,
    raw_unit: str,
    standard_mnemonic: str,
) -> tuple[float, bool]:
    unit = "".join(c for c in raw_unit.strip().upper() if c.isalnum() or c in "%/")

    # 1. NPHI (% or PU -> V/V decimal 0.0 to 0.6)
    if standard_mnemonic == "NPHI":
        is_percent = unit in ("%", "PU") or "PERCENT" in unit or "PCT" in unit or "P.U" in unit
        if is_percent or abs(value) > 1.0:
            return (value / 100.0, True) if abs(value) > 1.0 else (value, False)

    # 2. RHOB (kg/m3 -> g/cc decimal 1.0 to 3.2)
    if standard_mnemonic == "RHOB":
        is_kg_m3 = unit == "KGM3" or "KG" in unit or "M3" in unit or "G/M3" in unit
        if is_kg_m3 or abs(value) > 100.0:
            return (value / 1000.0, True) if abs(value) > 100.0 else (value, False)

    # 3. CALI (mm or cm -> inch 4.0 to 30.0)
    if standard_mnemonic == "CALI":
        is_mm = unit == "MM" or "MILLI" in unit
        is_cm = unit == "CM" or "CENTI" in unit
        if is_mm or abs(value) > 40.0:
            return (value / 25.4, True) if abs(value) > 40.0 else (value, False)
        if is_cm:
            return (value / 2.54, True)

    # 4. DT (us/m -> us/ft 40 to 200)
    if standard_mnemonic == "DT":
        is_us_m = "US/M" in unit or "MET" in unit or "MTR" in unit or "/M" in unit
        if is_us_m or abs(value) > 200.0:
            return (value / 3.280839895, True) if abs(value) > 200.0 else (value, False)

    return (value, False)
