import { analyzeWellLogQuality } from "@/lib/las/quality-engine";
import { ParsedLAS } from "@/lib/las/parser";

describe("Well Log Quality Engine (analyzeWellLogQuality)", () => {
  const mockValidLAS: ParsedLAS = {
    version: "2.0",
    wrap: false,
    wellInfo: {
      wellName: "SAMPLE-WELL",
      company: "ENERGY-CORP",
      field: "NIGER-DELTA",
      location: "OFFSHORE",
      country: "NIGERIA",
      state: "RIVERS",
      apiUwi: "API-12345",
      serviceCompany: "SLB",
      date: "2026-01-01",
      startDepth: 1000,
      stopDepth: 1004,
      step: 1,
      nullValue: -999.25,
      depthUnit: "M",
    },
    curves: [
      { mnemonic: "DEPT", unit: "M", code: "", description: "Depth" },
      { mnemonic: "GR", unit: "GAPI", code: "", description: "Gamma Ray" },
      { mnemonic: "RHOB", unit: "G/CC", code: "", description: "Density" },
      { mnemonic: "NPHI", unit: "V/V", code: "", description: "Neutron Porosity" },
      { mnemonic: "DT", unit: "US/F", code: "", description: "Sonic" },
      { mnemonic: "RT", unit: "OHMM", code: "", description: "Resistivity" },
      { mnemonic: "CALI", unit: "IN", code: "", description: "Caliper" },
    ],
    data: {
      depth: [1000, 1001, 1002, 1003, 1004],
      curves: {
        DEPT: [1000, 1001, 1002, 1003, 1004],
        GR: [55, 60, 62, 58, 61],
        RHOB: [2.35, 2.38, 2.4, 2.39, 2.42],
        NPHI: [0.22, 0.25, 0.23, 0.21, 0.24],
        DT: [75, 78, 80, 76, 77],
        RT: [15, 18, 20, 19, 22],
        CALI: [8.5, 8.5, 8.5, 8.5, 8.5],
      },
    },
    rawHeader: "",
    totalPoints: 5,
  };

  it("evaluates a high-quality LAS log with an EXCELLENT score", () => {
    const result = analyzeWellLogQuality(mockValidLAS);

    expect(result.overallScore).toBeGreaterThanOrEqual(85);
    expect(result.qualityGrade).toMatch(/EXCELLENT|GOOD/);
    expect(result.curveSummaries.length).toBe(mockValidLAS.curves.length);
  });

  it("flags duplicate depths as CRITICAL anomalies", () => {
    const duplicateLAS: ParsedLAS = {
      ...mockValidLAS,
      data: {
        ...mockValidLAS.data,
        depth: [1000, 1001, 1001, 1003, 1004], // duplicate at 1001
      },
    };

    const result = analyzeWellLogQuality(duplicateLAS);
    const dupAnomaly = result.anomalies.find((a) => a.anomalyType === "DUPLICATE_DEPTH");

    expect(dupAnomaly).toBeDefined();
    expect(dupAnomaly?.severity).toBe("CRITICAL");
  });

  it("detects depth gaps larger than expected step", () => {
    const gapLAS: ParsedLAS = {
      ...mockValidLAS,
      data: {
        ...mockValidLAS.data,
        depth: [1000, 1001, 1010, 1011, 1012], // gap between 1001 and 1010 (> 3x step)
      },
    };

    const result = analyzeWellLogQuality(gapLAS);
    const gapAnomaly = result.anomalies.find((a) => a.anomalyType === "DEPTH_GAP");

    expect(gapAnomaly).toBeDefined();
    expect(gapAnomaly?.severity).toBe("WARNING");
  });

  it("identifies missing required core curves", () => {
    const missingCurvesLAS: ParsedLAS = {
      ...mockValidLAS,
      curves: [
        { mnemonic: "DEPT", unit: "M", code: "", description: "Depth" },
        { mnemonic: "GR", unit: "GAPI", code: "", description: "Gamma Ray" },
      ],
      data: {
        depth: [1000, 1001, 1002],
        curves: {
          DEPT: [1000, 1001, 1002],
          GR: [55, 60, 62],
        },
      },
      totalPoints: 3,
    };

    const result = analyzeWellLogQuality(missingCurvesLAS);

    expect(result.missingStandardCurves).toContain("RHOB");
    expect(result.missingStandardCurves).toContain("NPHI");
    expect(result.missingStandardCurves).toContain("RT");
  });
});
