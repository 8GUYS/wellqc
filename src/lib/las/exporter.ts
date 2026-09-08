import { ParsedLAS } from "./parser";
import type { QualityAnalysisResult } from "./quality-engine";
import { STANDARD_CURVES, standardiseMnemonic } from "./standardiser";

export interface CleanedCurveExport {
  originalMnemonic: string;
  exportMnemonic: string;
  unit: string;
  description: string;
  values: number[];
  rawNullCount: number;
  physicalOutlierCount: number;
  spikeReplacementCount: number;
  convertedUnitCount: number;
}

export interface CleanedDataExport {
  fileStem: string;
  lasContent: string;
  csvContent: string;
  duplicateDepthRowsRemoved: number;
  curves: CleanedCurveExport[];
}

const NULL_TOLERANCE = 0.01;

export function buildCleanedDataExport(las: ParsedLAS, qa: QualityAnalysisResult): CleanedDataExport {
  const nullValue = Number.isFinite(las.wellInfo.nullValue) ? las.wellInfo.nullValue : -999.25;
  const uniqueDepthIndexes = getUniqueDepthIndexes(las.data.depth);
  const duplicateDepthRowsRemoved = Math.max(0, las.data.depth.length - uniqueDepthIndexes.length);
  const curves = buildCleanedCurves(las, nullValue);
  const fileStem = makeCleanedFileStem(las);
  const depthUnit = cleanHeaderText(las.wellInfo.depthUnit || "FT");
  const firstDepth = uniqueDepthIndexes.length > 0 ? las.data.depth[uniqueDepthIndexes[0]] : las.wellInfo.startDepth;
  const lastDepth =
    uniqueDepthIndexes.length > 0
      ? las.data.depth[uniqueDepthIndexes[uniqueDepthIndexes.length - 1]]
      : las.wellInfo.stopDepth;

  const lasLines = [
    "~VERSION INFORMATION",
    "VERS.                 2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0",
    "WRAP.                  NO : ONE LINE PER DEPTH STEP",
    "~WELL INFORMATION",
    `# Cleaned by WellQC+ on ${new Date().toISOString()}`,
    `# QA grade ${qa.qualityGrade}; score ${qa.overallScore}/100; anomalies ${qa.anomalyCount}`,
    `# Duplicate depth rows removed: ${duplicateDepthRowsRemoved}`,
    formatHeaderLine("STRT", depthUnit, firstDepth, "START DEPTH"),
    formatHeaderLine("STOP", depthUnit, lastDepth, "STOP DEPTH"),
    formatHeaderLine("STEP", depthUnit, las.wellInfo.step, "STEP VALUE"),
    formatHeaderLine("NULL", "", nullValue, "NULL VALUE"),
    formatHeaderLine("WELL", "", las.wellInfo.wellName, "WELL NAME"),
    formatHeaderLine("COMP", "", las.wellInfo.company, "COMPANY"),
    formatHeaderLine("FLD", "", las.wellInfo.field, "FIELD"),
    formatHeaderLine("LOC", "", las.wellInfo.location, "LOCATION"),
    formatHeaderLine("CTRY", "", las.wellInfo.country, "COUNTRY"),
    formatHeaderLine("STAT", "", las.wellInfo.state, "STATE"),
    formatHeaderLine("API", "", las.wellInfo.apiUwi, "API / UWI"),
    formatHeaderLine("SRVC", "", las.wellInfo.serviceCompany, "SERVICE COMPANY"),
    formatHeaderLine("DATE", "", las.wellInfo.date, "LOG DATE"),
    "~CURVE INFORMATION",
    formatCurveLine("DEPT", depthUnit, "1 MEASURED DEPTH"),
    ...curves.map((curve, index) =>
      formatCurveLine(
        curve.exportMnemonic,
        curve.unit,
        `${index + 2} ${curve.description}; original mnemonic ${curve.originalMnemonic}`,
      ),
    ),
    "~PARAMETER INFORMATION",
    formatHeaderLine("QC_SCORE", "", qa.overallScore, "WELLQC+ QUALITY SCORE"),
    formatHeaderLine("QC_GRADE", "", qa.qualityGrade, "WELLQC+ QUALITY GRADE"),
    formatHeaderLine("QC_WARN", "", qa.warningCount, "WARNING ANOMALY COUNT"),
    formatHeaderLine("QC_CRIT", "", qa.criticalCount, "CRITICAL ANOMALY COUNT"),
    "~ASCII",
    ...uniqueDepthIndexes.map((rowIndex) =>
      [
        formatNumber(las.data.depth[rowIndex]),
        ...curves.map((curve) => formatNumber(curve.values[rowIndex] ?? nullValue)),
      ]
        .map((value) => value.padStart(12))
        .join(" "),
    ),
  ];

  const csvLines = [
    ["DEPTH", ...curves.map((curve) => curve.exportMnemonic)].map(csvCell).join(","),
    ...uniqueDepthIndexes.map((rowIndex) =>
      [
        formatNumber(las.data.depth[rowIndex]),
        ...curves.map((curve) => formatNumber(curve.values[rowIndex] ?? nullValue)),
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  return {
    fileStem,
    lasContent: `${lasLines.join("\n")}\n`,
    csvContent: `${csvLines.join("\n")}\n`,
    duplicateDepthRowsRemoved,
    curves,
  };
}

export function makeCleanedFileStem(las: ParsedLAS): string {
  const source = las.wellInfo.wellName || las.wellInfo.apiUwi || "well_log";
  return source
    .trim()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "well_log";
}

function buildCleanedCurves(las: ParsedLAS, nullValue: number): CleanedCurveExport[] {
  const usedMnemonics = new Set<string>(["DEPT"]);

  return las.curves.reduce<CleanedCurveExport[]>((cleanedCurves, curveMeta) => {
    const standard = standardiseMnemonic(curveMeta.mnemonic, curveMeta.unit);

    if (standard.category === "DEPTH" || standard.standardMnemonic === "DEPT") {
      return cleanedCurves;
    }

    const exportMnemonic = allocateMnemonic(standard.standardMnemonic, usedMnemonics);
    const standardDefinition = STANDARD_CURVES[standard.standardMnemonic];
    const { values, stats } = cleanCurveValues(
      las.data.curves[curveMeta.mnemonic] || [],
      las.data.depth.length,
      curveMeta.unit,
      standard.standardMnemonic,
      nullValue,
    );

    cleanedCurves.push({
      originalMnemonic: curveMeta.mnemonic,
      exportMnemonic,
      unit: standardDefinition?.standardUnit || cleanHeaderText(curveMeta.unit || standard.standardUnit || "UNKN"),
      description: standardDefinition?.name || curveMeta.description || standard.matchedName,
      values,
      ...stats,
    });

    return cleanedCurves;
  }, []);
}

function cleanCurveValues(
  rawValues: number[],
  totalRows: number,
  rawUnit: string,
  standardMnemonic: string,
  nullValue: number,
): {
  values: number[];
  stats: Pick<
    CleanedCurveExport,
    "rawNullCount" | "physicalOutlierCount" | "spikeReplacementCount" | "convertedUnitCount"
  >;
} {
  const standardDefinition = STANDARD_CURVES[standardMnemonic];
  let rawNullCount = 0;
  let physicalOutlierCount = 0;
  let convertedUnitCount = 0;

  const values = Array.from({ length: totalRows }, (_, index) => {
    const rawValue = rawValues[index];

    if (isNullSample(rawValue, nullValue)) {
      rawNullCount++;
      return nullValue;
    }

    const conversion = convertToStandardUnit(rawValue, rawUnit, standardMnemonic);
    if (conversion.converted) {
      convertedUnitCount++;
    }

    if (
      standardDefinition &&
      (conversion.value < standardDefinition.minPhysical || conversion.value > standardDefinition.maxPhysical)
    ) {
      physicalOutlierCount++;
      return nullValue;
    }

    return conversion.value;
  });

  const despiked = replaceSinglePointSpikes(values, nullValue);

  return {
    values: despiked.values,
    stats: {
      rawNullCount,
      physicalOutlierCount,
      spikeReplacementCount: despiked.replacementCount,
      convertedUnitCount,
    },
  };
}

export function convertToStandardUnit(
  value: number,
  rawUnit: string,
  standardMnemonic: string,
): { value: number; converted: boolean } {
  const unit = rawUnit.trim().toUpperCase().replace(/[^A-Z0-9%/]/g, "");

  // 1. NPHI (Neutron Porosity: % or PU -> V/V decimal 0.0 to 0.6)
  if (standardMnemonic === "NPHI") {
    const isPercentUnit =
      unit === "%" ||
      unit === "PU" ||
      unit.includes("PERCENT") ||
      unit.includes("PCT") ||
      unit.includes("P.U");
    if (isPercentUnit || Math.abs(value) > 1.0) {
      return Math.abs(value) > 1.0 ? { value: value / 100, converted: true } : { value, converted: false };
    }
  }

  // 2. RHOB (Bulk Density: kg/m3 -> g/cc decimal 1.0 to 3.2)
  if (standardMnemonic === "RHOB") {
    const isKgM3Unit =
      unit === "KGM3" ||
      unit.includes("KG") ||
      unit.includes("M3") ||
      unit.includes("G/M3");
    if (isKgM3Unit || Math.abs(value) > 100.0) {
      return Math.abs(value) > 100.0 ? { value: value / 1000, converted: true } : { value, converted: false };
    }
  }

  // 3. CALI (Caliper: mm or cm -> inch 4.0 to 30.0)
  if (standardMnemonic === "CALI") {
    const isMmUnit = unit === "MM" || unit.includes("MILLI");
    const isCmUnit = unit === "CM" || unit.includes("CENTI");

    if (isMmUnit || Math.abs(value) > 40.0) {
      return Math.abs(value) > 40.0 ? { value: value / 25.4, converted: true } : { value, converted: false };
    }
    if (isCmUnit) {
      return { value: value / 2.54, converted: true };
    }
  }

  // 4. DT (Sonic Travel Time: us/m -> us/ft 40 to 200)
  if (standardMnemonic === "DT") {
    const isUsMUnit =
      unit.includes("US/M") ||
      unit.includes("MET") ||
      unit.includes("MTR") ||
      unit.includes("/M");
    if (isUsMUnit || Math.abs(value) > 200.0) {
      return Math.abs(value) > 200.0 ? { value: value / 3.280839895, converted: true } : { value, converted: false };
    }
  }

  return { value, converted: false };
}

function replaceSinglePointSpikes(
  values: number[],
  nullValue: number,
): { values: number[]; replacementCount: number } {
  const validValues = values.filter((value) => !isNullSample(value, nullValue));

  if (validValues.length < 5) {
    return { values, replacementCount: 0 };
  }

  const mean = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
  const variance = validValues.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / validValues.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev <= 0.001) {
    return { values, replacementCount: 0 };
  }

  const cleaned = [...values];
  let replacementCount = 0;

  for (let index = 1; index < values.length - 1; index++) {
    const previous = values[index - 1];
    const current = values[index];
    const next = values[index + 1];

    if (isNullSample(previous, nullValue) || isNullSample(current, nullValue) || isNullSample(next, nullValue)) {
      continue;
    }

    const diffPrevious = Math.abs(current - previous);
    const diffNext = Math.abs(current - next);

    if (diffPrevious > 4.5 * stdDev && diffNext > 4.5 * stdDev) {
      const windowValues = values
        .slice(Math.max(0, index - 2), Math.min(values.length, index + 3))
        .filter((value, windowIndex) => {
          const sourceIndex = Math.max(0, index - 2) + windowIndex;
          return sourceIndex !== index && !isNullSample(value, nullValue);
        });

      cleaned[index] = median(windowValues) ?? nullValue;
      replacementCount++;
    }
  }

  return { values: cleaned, replacementCount };
}

function getUniqueDepthIndexes(depthValues: number[]): number[] {
  const seenDepths = new Set<string>();
  const indexes: number[] = [];

  depthValues.forEach((depth, index) => {
    if (!Number.isFinite(depth)) {
      return;
    }

    const key = depth.toFixed(6);
    if (seenDepths.has(key)) {
      return;
    }

    seenDepths.add(key);
    indexes.push(index);
  });

  return indexes;
}

function allocateMnemonic(preferredMnemonic: string, usedMnemonics: Set<string>): string {
  const base = cleanMnemonic(preferredMnemonic || "CURVE");
  let candidate = base;
  let suffix = 2;

  while (usedMnemonics.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix++;
  }

  usedMnemonics.add(candidate);
  return candidate;
}

function cleanMnemonic(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24) || "CURVE";
}

function isNullSample(value: number | undefined, nullValue: number): boolean {
  return typeof value !== "number" || !Number.isFinite(value) || Math.abs(value - nullValue) < NULL_TOLERANCE;
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function formatHeaderLine(mnemonic: string, unit: string, value: string | number, description: string): string {
  const formattedValue = typeof value === "number" ? formatNumber(value) : cleanHeaderText(value);
  return `${mnemonic}.${unit.padEnd(8)} ${String(formattedValue).padStart(16)} : ${description}`;
}

function formatCurveLine(mnemonic: string, unit: string, description: string): string {
  return `${mnemonic}.${unit.padEnd(8)} : ${description}`;
}

function cleanHeaderText(value: string): string {
  return value.replace(/\r?\n/g, " ").trim();
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "-999.25";
  }

  const fixed = Math.abs(value) >= 1000 ? value.toFixed(4) : value.toFixed(5);
  return fixed.replace(/\.?0+$/, "");
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
