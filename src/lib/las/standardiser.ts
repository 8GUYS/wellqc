export interface CustomAliasEntry {
  id: string;
  alias: string;
  standardMnemonic: string;
  addedBy: string;
  addedAt: string; // ISO 8601 string
}

export interface StandardCurveDef {
  standardMnemonic: string;
  name: string;
  category: 'DEPTH' | 'GAMMA' | 'DENSITY' | 'POROSITY' | 'SONIC' | 'RESISTIVITY' | 'CALIPER' | 'POTENTIAL' | 'OTHER';
  standardUnit: string;
  acceptableUnits: string[];
  aliases: string[];
  customAliases?: CustomAliasEntry[];
  minPhysical: number;
  maxPhysical: number;
  description: string;
}

export const STANDARD_CURVES: Record<string, StandardCurveDef> = {
  DEPTH: {
    standardMnemonic: 'DEPT',
    name: 'Measured Depth',
    category: 'DEPTH',
    standardUnit: 'FT',
    acceptableUnits: ['FT', 'M', 'FEET', 'METERS'],
    aliases: ['DEPT', 'DEPTH', 'MD', 'TVD', 'DEPT_FT', 'DEPT_M'],
    minPhysical: 0,
    maxPhysical: 50000,
    description: 'Measured depth along borehole trajectory',
  },
  GR: {
    standardMnemonic: 'GR',
    name: 'Gamma Ray',
    category: 'GAMMA',
    standardUnit: 'GAPI',
    acceptableUnits: ['GAPI', 'API', 'EU', 'CPS'],
    aliases: ['GR', 'GAMMA', 'GRC', 'GAM', 'GR_CORR', 'GRR', 'SGR', 'ECGR', 'HGR'],
    minPhysical: 0,
    maxPhysical: 150,
    description: 'Natural gamma ray radiation log',
  },
  RHOB: {
    standardMnemonic: 'RHOB',
    name: 'Bulk Density',
    category: 'DENSITY',
    standardUnit: 'G/CC',
    acceptableUnits: ['G/CC', 'G/CM3', 'KGM3', 'KG/M3', 'KG/M^3', 'G/C3', 'KGM/-3'],
    aliases: ['RHOB', 'DEN', 'RHOZ', 'BDEN', 'ZDEN', 'RHO', 'RHOB_CORR', 'RHO8'],
    minPhysical: 1.65,
    maxPhysical: 2.65,
    description: 'Formation bulk density log',
  },
  NPHI: {
    standardMnemonic: 'NPHI',
    name: 'Neutron Porosity',
    category: 'POROSITY',
    standardUnit: 'V/V',
    acceptableUnits: ['V/V', 'PU', 'P.U.', '%', 'PERCENT', 'PCT', 'DECIMAL', 'M3/M3'],
    aliases: ['NPHI', 'NEUT', 'CNL', 'NPOR', 'TNPH', 'PHIN', 'NPHI_LS', 'NPLC', 'NPR'],
    minPhysical: 0,
    maxPhysical: 0.60,
    description: 'Thermal neutron porosity log',
  },
  DT: {
    standardMnemonic: 'DT',
    name: 'Sonic Travel Time',
    category: 'SONIC',
    standardUnit: 'US/F',
    acceptableUnits: ['US/F', 'US/FT', 'US/M', 'US/MET', 'US/MTR', 'US/METER', 'US/METRE'],
    aliases: ['DT', 'DTCO', 'AC', 'DTC', 'SONI', 'DELTA_T', 'DTC1', 'DT35'],
    minPhysical: 20,
    maxPhysical: 240,
    description: 'Compressional wave acoustic travel time',
  },
  RT: {
    standardMnemonic: 'RT',
    name: 'True Deep Resistivity',
    category: 'RESISTIVITY',
    standardUnit: 'OHMM',
    acceptableUnits: ['OHMM', 'OHM.M', 'OHM-M', 'OHMS'],
    aliases: ['RT', 'ILD', 'LLD', 'RD', 'RES_DEEP', 'AT90', 'RDEP', 'HDRS', 'R40O', 'AO90'],
    minPhysical: 0.2,
    maxPhysical: 2000,
    description: 'Deep un-invaded formation resistivity',
  },
  CALI: {
    standardMnemonic: 'CALI',
    name: 'Caliper',
    category: 'CALIPER',
    standardUnit: 'IN',
    acceptableUnits: ['IN', 'INCH', 'MM', 'CM', 'MILLIMETER', 'CENTIMETER'],
    aliases: ['CALI', 'CAL', 'HCAL', 'CALS', 'CALP', 'BS', 'CLP', 'HDAR'],
    minPhysical: 6,
    maxPhysical: 16,
    description: 'Borehole diameter measurement log',
  },
  PEF: {
    standardMnemonic: 'PEF',
    name: 'Photoelectric Factor',
    category: 'OTHER',
    standardUnit: 'B/E',
    acceptableUnits: ['B/E', 'BARN/ELECTRON', 'B/ELECT', 'PE'],
    aliases: ['PEF', 'PE', 'PEFZ', 'PEFL', 'PEF8'],
    minPhysical: 0.5,
    maxPhysical: 15.0,
    description: 'Photoelectric absorption index log',
  },
  SP: {
    standardMnemonic: 'SP',
    name: 'Spontaneous Potential',
    category: 'POTENTIAL',
    standardUnit: 'MV',
    acceptableUnits: ['MV', 'VOLTS', 'MILLIVOLTS'],
    aliases: ['SP', 'SPC', 'SPO', 'SP_CORR'],
    minPhysical: -250,
    maxPhysical: 250,
    description: 'Spontaneous electrical potential log',
  },
  MSFL: {
    standardMnemonic: 'MSFL',
    name: 'Micro-spherical Focused Resistivity',
    category: 'RESISTIVITY',
    standardUnit: 'OHMM',
    acceptableUnits: ['OHMM', 'OHM.M'],
    aliases: ['MSFL', 'RXO', 'MICRO', 'RFOC', 'RMFL'],
    minPhysical: 0.2,
    maxPhysical: 2000,
    description: 'Flushed zone micro-resistivity',
  },
  LLS: {
    standardMnemonic: 'LLS',
    name: 'Shallow Resistivity',
    category: 'RESISTIVITY',
    standardUnit: 'OHMM',
    acceptableUnits: ['OHMM', 'OHM.M'],
    aliases: ['LLS', 'ILM', 'RS', 'RES_SHAL', 'AT20', 'RLA2'],
    minPhysical: 0.2,
    maxPhysical: 2000,
    description: 'Shallow invaded zone resistivity',
  },
};

export interface StandardisationResult {
  originalMnemonic: string;
  standardMnemonic: string;
  matchedName: string;
  confidence: number; // 0.0 to 1.0
  isAutoMatched: boolean;
  standardUnit: string;
  unitMismatch: boolean;
  category: string;
}

// LocalStorage keys for custom alias overrides
const CUSTOM_ALIASES_KEY = 'wellqc_custom_aliases_v2';
const LEGACY_CUSTOM_ALIASES_KEY = 'wellqc_custom_aliases';

// Runtime in-memory storage for custom aliases
let inMemoryCustomAliases: CustomAliasEntry[] = [];

/**
 * Returns stored custom aliases from runtime memory, browser storage, or legacy format migration.
 */
export function getCustomAliases(): CustomAliasEntry[] {
  if (inMemoryCustomAliases.length > 0) {
    return inMemoryCustomAliases;
  }

  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawV2 = localStorage.getItem(CUSTOM_ALIASES_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (Array.isArray(parsed)) {
        inMemoryCustomAliases = parsed;
        return inMemoryCustomAliases;
      }
    }

    // Check and migrate legacy format Record<string, string[]>
    const legacyRaw = localStorage.getItem(LEGACY_CUSTOM_ALIASES_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Record<string, string[]>;
      const migrated: CustomAliasEntry[] = [];
      for (const [curve, aliases] of Object.entries(legacy)) {
        if (Array.isArray(aliases)) {
          for (const alias of aliases) {
            migrated.push({
              id: `legacy-${curve}-${alias}`,
              alias: alias.trim().toUpperCase(),
              standardMnemonic: curve.trim().toUpperCase(),
              addedBy: "Legacy Analyst",
              addedAt: new Date().toISOString(),
            });
          }
        }
      }
      if (migrated.length > 0) {
        inMemoryCustomAliases = migrated;
        localStorage.setItem(CUSTOM_ALIASES_KEY, JSON.stringify(migrated));
        return inMemoryCustomAliases;
      }
    }
  } catch {
    // fallback
  }

  return inMemoryCustomAliases;
}

/**
 * Updates in-memory and client-side custom aliases
 */
export function setCustomAliases(entries: CustomAliasEntry[]): void {
  inMemoryCustomAliases = [...entries];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CUSTOM_ALIASES_KEY, JSON.stringify(entries));
    } catch {
      // ignore
    }
  }
}

export interface AliasValidationResult {
  valid: boolean;
  error?: string;
  mappedCurve?: string;
}

/**
 * Validates whether a new or edited alias conflicts with ANY curve's alias list (built-in or custom).
 * Returns an inline error string if already claimed by a different curve:
 * "{alias} is already mapped to {otherCurve}. Remove or choose a different alias."
 */
export function validateAliasForCurve(
  alias: string,
  targetCurve: string,
  editingAlias?: string,
  customAliasesList?: CustomAliasEntry[]
): AliasValidationResult {
  const cleanAlias = alias.trim().toUpperCase();
  const cleanTarget = targetCurve.trim().toUpperCase();

  if (!cleanAlias) {
    return { valid: false, error: "Alias cannot be empty." };
  }

  const cleanEditing = editingAlias?.trim().toUpperCase();

  // 1. Search every standard curve's standard mnemonic and built-in aliases
  for (const [key, def] of Object.entries(STANDARD_CURVES)) {
    const curveMnem = def.standardMnemonic.toUpperCase();

    // Check if alias matches standard mnemonic directly
    if (cleanAlias === curveMnem || cleanAlias === key.toUpperCase()) {
      if (curveMnem !== cleanTarget && key.toUpperCase() !== cleanTarget) {
        return {
          valid: false,
          error: `${cleanAlias} is already mapped to ${def.standardMnemonic}. Remove or choose a different alias.`,
          mappedCurve: def.standardMnemonic,
        };
      } else {
        return {
          valid: false,
          error: `${cleanAlias} is already the standard mnemonic for ${def.standardMnemonic}.`,
          mappedCurve: def.standardMnemonic,
        };
      }
    }

    // Check built-in aliases
    for (const builtIn of def.aliases) {
      const cleanBuiltIn = builtIn.trim().toUpperCase();
      if (cleanBuiltIn === cleanAlias) {
        if (curveMnem !== cleanTarget && key.toUpperCase() !== cleanTarget) {
          return {
            valid: false,
            error: `${cleanAlias} is already mapped to ${def.standardMnemonic}. Remove or choose a different alias.`,
            mappedCurve: def.standardMnemonic,
          };
        } else {
          return {
            valid: false,
            error: `${cleanAlias} is already a built-in alias for ${def.standardMnemonic}.`,
            mappedCurve: def.standardMnemonic,
          };
        }
      }
    }
  }

  // 2. Search every custom alias (built-in checked above, now custom across all curves)
  const customEntries = customAliasesList || getCustomAliases();
  for (const entry of customEntries) {
    const entryAlias = entry.alias.trim().toUpperCase();
    const entryCurve = entry.standardMnemonic.trim().toUpperCase();

    // If editing self, skip
    if (cleanEditing && entryAlias === cleanEditing && entryCurve === cleanTarget) {
      continue;
    }

    if (entryAlias === cleanAlias) {
      if (entryCurve !== cleanTarget) {
        return {
          valid: false,
          error: `${cleanAlias} is already mapped to ${entry.standardMnemonic}. Remove or choose a different alias.`,
          mappedCurve: entry.standardMnemonic,
        };
      } else {
        return {
          valid: false,
          error: `${cleanAlias} is already an alias for ${entry.standardMnemonic}.`,
          mappedCurve: entry.standardMnemonic,
        };
      }
    }
  }

  return { valid: true };
}

export interface AddAliasResult {
  success: boolean;
  error?: string;
  mappedCurve?: string;
  entry?: CustomAliasEntry;
}

// Save custom aliases to storage with duplicate verification across all curves
export function addCustomAlias(
  standardMnemonic: string,
  newAlias: string,
  addedBy: string = "Petrophysicist"
): AddAliasResult {
  const cleanAlias = newAlias.trim().toUpperCase();
  const cleanMnem = standardMnemonic.trim().toUpperCase();

  const validation = validateAliasForCurve(cleanAlias, cleanMnem);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      mappedCurve: validation.mappedCurve,
    };
  }

  const newEntry: CustomAliasEntry = {
    id: `alias_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    alias: cleanAlias,
    standardMnemonic: cleanMnem,
    addedBy,
    addedAt: new Date().toISOString(),
  };

  const current = getCustomAliases();
  const updated = [...current, newEntry];
  setCustomAliases(updated);

  return { success: true, entry: newEntry };
}

// Edit an existing custom alias with duplicate verification
export function editCustomAlias(
  standardMnemonic: string,
  oldAlias: string,
  newAlias: string
): AddAliasResult {
  const cleanOld = oldAlias.trim().toUpperCase();
  const cleanNew = newAlias.trim().toUpperCase();
  const cleanMnem = standardMnemonic.trim().toUpperCase();

  if (cleanOld === cleanNew) {
    const existing = getCustomAliases().find(
      (e) => e.standardMnemonic === cleanMnem && e.alias.toUpperCase() === cleanOld
    );
    return { success: true, entry: existing };
  }

  const validation = validateAliasForCurve(cleanNew, cleanMnem, cleanOld);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      mappedCurve: validation.mappedCurve,
    };
  }

  const current = getCustomAliases();
  const index = current.findIndex(
    (e) => e.standardMnemonic === cleanMnem && e.alias.toUpperCase() === cleanOld
  );

  if (index === -1) {
    return { success: false, error: `Alias "${oldAlias}" not found under ${standardMnemonic}.` };
  }

  const updatedEntry: CustomAliasEntry = {
    ...current[index],
    alias: cleanNew,
    addedAt: new Date().toISOString(),
  };

  const updated = [...current];
  updated[index] = updatedEntry;
  setCustomAliases(updated);

  return { success: true, entry: updatedEntry };
}

// Remove an existing custom alias
export function removeCustomAlias(standardMnemonic: string, aliasToRemove: string): boolean {
  const cleanAlias = aliasToRemove.trim().toUpperCase();
  const cleanMnem = standardMnemonic.trim().toUpperCase();

  const current = getCustomAliases();
  const updated = current.filter(
    (e) => !(e.standardMnemonic === cleanMnem && e.alias.toUpperCase() === cleanAlias)
  );

  if (updated.length === current.length) {
    return false;
  }

  setCustomAliases(updated);
  return true;
}

/**
 * Updates the active upload session stored in localStorage with newly added aliases
 * and dispatches a global 'wellqc_alias_updated' window event.
 *
 * `reanalyzer` operates on data straight out of JSON.parse (session.parsedLAS),
 * which has no precise static type at this point in the code. Rather than
 * widening it to `unknown` (which would then reject any caller passing a
 * specifically-typed function, e.g. `(las: ParsedLAS) => QualityAnalysisResult`),
 * the parameter is generic: TypeScript infers T/R from whatever function the
 * caller actually passes, and no `any` is used anywhere.
 */
export function updateActiveUploadWithNewAlias<T = unknown, R = unknown>(
  reanalyzer?: (parsed: T) => R,
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('wellqc_upload_workspace');
    if (!raw) return false;
    const session = JSON.parse(raw);
    if (!session || !session.parsedLAS) return false;

    if (typeof reanalyzer === 'function') {
      session.qaResult = reanalyzer(session.parsedLAS as T);
    }
    session.updatedAt = Date.now();
    localStorage.setItem('wellqc_upload_workspace', JSON.stringify(session));
    window.dispatchEvent(new CustomEvent('wellqc_alias_updated', { detail: { qaResult: session.qaResult } }));
    return true;
  } catch (err) {
    console.warn('Failed to update active upload workspace with alias:', err);
    return false;
  }
}

// Retrieve standard curve definitions merged with custom persistent aliases
export function getMergedStandardCurves(customList?: CustomAliasEntry[]): Record<string, StandardCurveDef> {
  const custom = customList || getCustomAliases();
  const merged: Record<string, StandardCurveDef> = {};

  for (const [key, def] of Object.entries(STANDARD_CURVES)) {
    const curveCustom = custom.filter((c) => c.standardMnemonic.toUpperCase() === key.toUpperCase());
    const customAliases = curveCustom.map((c) => c.alias);
    const combinedAliases = Array.from(new Set([...def.aliases, ...customAliases]));
    merged[key] = {
      ...def,
      aliases: combinedAliases,
      customAliases: curveCustom,
    };
  }

  return merged;
}

/**
 * Standardises raw LAS curve mnemonics to petrophysical standard names
 */
export function standardiseMnemonic(
  rawMnemonic: string,
  rawUnit: string = '',
  customList?: CustomAliasEntry[]
): StandardisationResult {
  const cleanMnem = rawMnemonic.trim().toUpperCase();
  const cleanUnit = rawUnit.trim().toUpperCase();
  const curves = getMergedStandardCurves(customList);

  // Exact match against standard keys
  if (curves[cleanMnem]) {
    const std = curves[cleanMnem];
    return {
      originalMnemonic: rawMnemonic,
      standardMnemonic: std.standardMnemonic,
      matchedName: std.name,
      confidence: 1.0,
      isAutoMatched: true,
      standardUnit: std.standardUnit,
      unitMismatch: cleanUnit ? !std.acceptableUnits.includes(cleanUnit) : false,
      category: std.category,
    };
  }

  // Alias lookup matching
  for (const std of Object.values(curves)) {
    for (const alias of std.aliases) {
      if (cleanMnem === alias || cleanMnem.startsWith(alias) || alias.startsWith(cleanMnem)) {
        const confidence = cleanMnem === alias ? 0.95 : 0.82;
        return {
          originalMnemonic: rawMnemonic,
          standardMnemonic: std.standardMnemonic,
          matchedName: std.name,
          confidence,
          isAutoMatched: true,
          standardUnit: std.standardUnit,
          unitMismatch: cleanUnit ? !std.acceptableUnits.includes(cleanUnit) : false,
          category: std.category,
        };
      }
    }
  }

  // Fallback match for custom curves (e.g., TEMP, ROP, TORQ, CWD)
  return {
    originalMnemonic: rawMnemonic,
    standardMnemonic: cleanMnem,
    matchedName: `Custom Curve (${cleanMnem})`,
    confidence: 0.50,
    isAutoMatched: false,
    standardUnit: cleanUnit || 'UNKN',
    unitMismatch: false,
    category: 'OTHER',
  };
}
