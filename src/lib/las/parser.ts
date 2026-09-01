import { standardiseMnemonic } from './standardiser';

export interface LASHeaderItem {
  mnemonic: string;
  unit: string;
  value: string;
  description: string;
}

export interface LASCurveMeta {
  mnemonic: string;
  unit: string;
  code: string;
  description: string;
}

export interface ParsedLAS {
  version: string;
  wrap: boolean;
  wellInfo: {
    wellName: string;
    company: string;
    field: string;
    location: string;
    country: string;
    state: string;
    apiUwi: string;
    serviceCompany: string;
    date: string;
    startDepth: number;
    stopDepth: number;
    step: number;
    nullValue: number;
    depthUnit: string;
    latitude?: number;
    longitude?: number;
  };
  curves: LASCurveMeta[];
  data: {
    depth: number[];
    curves: Record<string, number[]>;
  };
  rawHeader: string;
  totalPoints: number;
}

/**
 * Enterprise LAS 2.0 / 3.0 Parser Engine
 * Handles dirty headers, missing units, variable whitespace, and NaN/null replacements.
 */
export function parseLASContent(content: string): ParsedLAS {
  const lines = content.split(/\r?\n/);

  let currentSection: string | null = null;
  const versionItems: Record<string, LASHeaderItem> = {};
  const wellItems: Record<string, LASHeaderItem> = {};
  const curveMetas: LASCurveMeta[] = [];
  const headerLines: string[] = [];
  const asciiLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      if (currentSection !== '~A' && currentSection !== '~ASCII') {
        headerLines.push(line);
      }
      continue;
    }

    // Check for section headers (e.g. ~VERSION, ~WELL, ~CURVE, ~PARAMETER, ~ASCII)
    if (trimmed.startsWith('~')) {
      const sectionName = trimmed.split(/\s+/)[0].toUpperCase();
      if (sectionName.startsWith('~V')) currentSection = '~V';
      else if (sectionName.startsWith('~W')) currentSection = '~W';
      else if (sectionName.startsWith('~C')) currentSection = '~C';
      else if (sectionName.startsWith('~P')) currentSection = '~P';
      else if (sectionName.startsWith('~O')) currentSection = '~O';
      else if (sectionName.startsWith('~A')) currentSection = '~A';
      else currentSection = sectionName;

      if (currentSection !== '~A') headerLines.push(line);
      continue;
    }

    if (currentSection !== '~A') {
      headerLines.push(line);
    }

    // Parse header line format: MNEM.UNIT VALUE : DESCRIPTION
    if (currentSection === '~V' || currentSection === '~W') {
      const parsedItem = parseHeaderLine(trimmed);
      if (parsedItem) {
        if (currentSection === '~V') versionItems[parsedItem.mnemonic] = parsedItem;
        if (currentSection === '~W') wellItems[parsedItem.mnemonic] = parsedItem;
      }
    } else if (currentSection === '~C') {
      const parsedCurve = parseCurveHeaderLine(trimmed);
      if (parsedCurve) {
        curveMetas.push(parsedCurve);
      }
    } else if (currentSection === '~A') {
      asciiLines.push(trimmed);
    }
  }

  // Parse well parameters with safe fallbacks
  const startDepth = parseFloat(wellItems['STRT']?.value || '0');
  const stopDepth = parseFloat(wellItems['STOP']?.value || '0');
  const step = parseFloat(wellItems['STEP']?.value || '0.5');
  const nullValue = parseFloat(wellItems['NULL']?.value || '-999.25');
  const depthUnit = wellItems['STRT']?.unit || wellItems['STOP']?.unit || 'FT';

  const wellName = wellItems['WELL']?.value || wellItems['NAME']?.value || 'UNKNOWN_WELL';
  const company = wellItems['COMP']?.value || 'NDI-GROUP-5';
  const field = wellItems['FLD']?.value || 'NIGER DELTA';
  const location = wellItems['LOC']?.value || '';
  const country = wellItems['CTRY']?.value || wellItems['CNTY']?.value || 'NIGERIA';
  const state = wellItems['STAT']?.value || 'DELTA STATE';
  const apiUwi = wellItems['API']?.value || wellItems['UWI']?.value || `API-${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  const serviceCompany = wellItems['SRVC']?.value || 'SLB';
  const date = wellItems['DATE']?.value || new Date().toISOString().split('T')[0];

  const lat = parseFloat(wellItems['LATI']?.value || '0') || undefined;
  const lon = parseFloat(wellItems['LONG']?.value || '0') || undefined;

  // Parse Matrix ASCII Data
  const depthValues: number[] = [];
  const curvesData: Record<string, number[]> = {};

  curveMetas.forEach((c) => {
    curvesData[c.mnemonic] = [];
  });

  // Identify if any curve in curveMetas represents Measured Depth
  const depthCurveIndex = curveMetas.findIndex((c) => {
    const std = standardiseMnemonic(c.mnemonic, c.unit);
    return std.category === 'DEPTH' || std.standardMnemonic === 'DEPT';
  });

  for (const line of asciiLines) {
    const tokens = line.trim().split(/\s+/).map((t) => parseFloat(t));
    if (tokens.length > 0 && !isNaN(tokens[0])) {
      const depthVal = (depthCurveIndex >= 0 && depthCurveIndex < tokens.length)
        ? tokens[depthCurveIndex]
        : tokens[0];
      depthValues.push(depthVal);

      // If no depth curve is declared in ~C header but tokens has an extra leading column for depth, offset curve indices by +1
      const offset = (depthCurveIndex === -1 && tokens.length > curveMetas.length) ? 1 : 0;

      curveMetas.forEach((c, idx) => {
        const tokenIdx = idx + offset;
        const val = tokenIdx < tokens.length ? tokens[tokenIdx] : nullValue;
        curvesData[c.mnemonic].push(isNaN(val) ? nullValue : val);
      });
    }
  }

  return {
    version: versionItems['VERS']?.value || '2.0',
    wrap: (versionItems['WRAP']?.value || 'NO').toUpperCase().startsWith('Y'),
    wellInfo: {
      wellName,
      company,
      field,
      location,
      country,
      state,
      apiUwi,
      serviceCompany,
      date,
      startDepth,
      stopDepth,
      step,
      nullValue,
      depthUnit,
      latitude: lat,
      longitude: lon,
    },
    curves: curveMetas,
    data: {
      depth: depthValues,
      curves: curvesData,
    },
    rawHeader: headerLines.join('\n'),
    totalPoints: depthValues.length,
  };
}

function parseHeaderLine(line: string): LASHeaderItem | null {
  const colonIndex = line.indexOf(':');
  const mainPart = colonIndex !== -1 ? line.substring(0, colonIndex) : line;
  const description = colonIndex !== -1 ? line.substring(colonIndex + 1).trim() : '';

  const periodIndex = mainPart.indexOf('.');
  if (periodIndex === -1) return null;

  const mnemonic = mainPart.substring(0, periodIndex).trim().toUpperCase();
  const restRaw = mainPart.substring(periodIndex + 1);
  const rest = restRaw.trim();

  if (!rest) {
    return { mnemonic, unit: '', value: '', description };
  }

  if (/^\s/.test(restRaw)) {
    return { mnemonic, unit: '', value: rest, description };
  }

  const firstSpaceIndex = rest.search(/\s/);
  let unit = '';
  let value = '';

  if (firstSpaceIndex !== -1) {
    unit = rest.substring(0, firstSpaceIndex).trim();
    value = rest.substring(firstSpaceIndex + 1).trim();
  } else {
    unit = rest;
  }

  return { mnemonic, unit, value, description };
}

function parseCurveHeaderLine(line: string): LASCurveMeta | null {
  const item = parseHeaderLine(line);
  if (!item) return null;
  return {
    mnemonic: item.mnemonic,
    unit: item.unit,
    code: item.value || item.mnemonic,
    description: item.description,
  };
}
