import { buildCleanedDataExport, makeCleanedFileStem } from "@/lib/las/exporter";
import { ParsedLAS } from "@/lib/api-types";
import { QualityAnalysisResult } from "@/lib/las/quality-engine";

describe("CWLS LAS 2.0 & CSV Exporter", () => {
  const mockLAS: ParsedLAS = {
    version: "2.0",
    wrap: false,
    wellInfo: {
      wellName: "Alpha-01 Offshore",
      company: "WellQC Petroleum Ltd",
      field: "Agbami Field",
      location: "Niger Delta Deepwater",
      country: "Nigeria",
      state: "Rivers",
      apiUwi: "NUPRC-12345-NG",
      serviceCompany: "Schlumberger",
      date: "2026-01-15",
      startDepth: 1000,
      stopDepth: 1002,
      step: 0.5,
      nullValue: -999.25,
      depthUnit: "FT",
    },
    curves: [
      { mnemonic: "GR", unit: "GAPI", description: "Gamma Ray", code: "" },
      { mnemonic: "RHOB", unit: "G/CC", description: "Bulk Density", code: "" },
    ],
    data: {
      // Intentionally includes a duplicate depth step at 1001.0
      depth: [1000.0, 1000.5, 1001.0, 1001.0, 1001.5, 1002.0],
      curves: {
        GR: [45.2, 52.0, 60.1, 60.1, 55.4, 49.8],
        RHOB: [2.35, 2.38, -999.25, -999.25, 2.42, 2.45],
      },
    },
    rawHeader: "~VERSION INFORMATION...",
    totalPoints: 6,
  };

  const mockQA: QualityAnalysisResult = {
    overallScore: 88,
    qualityGrade: "GOOD",
    completenessScore: 95,
    consistencyScore: 90,
    anomalyCount: 2,
    warningCount: 1,
    criticalCount: 1,
    curveSummaries: [],
    anomalies: [],
    missingStandardCurves: [],
  };

  describe("makeCleanedFileStem", () => {
    it("sanitizes filenames into safe stems", () => {
      const stem = makeCleanedFileStem(mockLAS);
      expect(stem).toBe("Alpha-01_Offshore");
    });

    it("falls back to well_log when well info is missing", () => {
      const emptyLAS = {
        ...mockLAS,
        wellInfo: { ...mockLAS.wellInfo, wellName: "", apiUwi: "" },
      };
      const stem = makeCleanedFileStem(emptyLAS);
      expect(stem).toBe("well_log");
    });
  });

  describe("buildCleanedDataExport", () => {
    it("generates valid CWLS LAS 2.0 sections", () => {
      const result = buildCleanedDataExport(mockLAS, mockQA);

      expect(result.fileStem).toBe("Alpha-01_Offshore");
      expect(result.lasContent).toContain("~VERSION INFORMATION");
      expect(result.lasContent).toContain("VERS.                 2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0");
      expect(result.lasContent).toContain("~WELL INFORMATION");
      expect(result.lasContent).toContain("~CURVE INFORMATION");
      expect(result.lasContent).toContain("~PARAMETER INFORMATION");
      expect(result.lasContent).toContain("~ASCII");

      // Verify parameters
      expect(result.lasContent).toContain("QC_SCORE");
      expect(result.lasContent).toContain("QC_GRADE");
    });

    it("prunes duplicate depth index rows cleanly", () => {
      const result = buildCleanedDataExport(mockLAS, mockQA);

      // The original depth array had 6 rows with 1 duplicate (1001.0 twice)
      expect(result.duplicateDepthRowsRemoved).toBe(1);

      // ASCII section should contain 5 data rows
      const asciiSection = result.lasContent.split("~ASCII")[1].trim().split("\n");
      expect(asciiSection.length).toBe(5);
    });

    it("produces standard comma-separated CSV with headers", () => {
      const result = buildCleanedDataExport(mockLAS, mockQA);

      const lines = result.csvContent.trim().split("\n");
      expect(lines[0]).toBe("DEPTH,GR,RHOB");
      expect(lines.length).toBe(6); // 1 header + 5 deduplicated rows
    });

    it("preserves null representations properly", () => {
      const result = buildCleanedDataExport(mockLAS, mockQA);

      expect(result.lasContent).toContain("-999.25");
      expect(result.csvContent).toContain("-999.25");
    });
  });
});
