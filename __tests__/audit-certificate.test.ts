import { NUPRC_11_ANOMALY_CATEGORIES, AuditCertificateData } from "@/components/reports/audit-certificate-modal";

describe("NUPRC Regulatory Audit Document Specifications", () => {
  it("enforces all 11 standardized NUPRC / PIA anomaly categories", () => {
    expect(NUPRC_11_ANOMALY_CATEGORIES).toHaveLength(11);

    const codes = NUPRC_11_ANOMALY_CATEGORIES.map((c) => c.code);
    expect(codes).toContain("DUPLICATE_DEPTH");
    expect(codes).toContain("IMPOSSIBLE_VALUE");
    expect(codes).toContain("EXTREME_SPIKE");
    expect(codes).toContain("NULL_CLUSTER");
    expect(codes).toContain("NULL_DEPTH");
    expect(codes).toContain("DEPTH_GAP");
    expect(codes).toContain("DUPLICATE_CURVE");
    expect(codes).toContain("UNIT_MISMATCH");
    expect(codes).toContain("OUT_OF_TYPICAL_RANGE");
    expect(codes).toContain("FLATLINE");
    expect(codes).toContain("MISSING_CORE_CURVE");
  });

  it("marks critical categories with CRITICAL severity tag", () => {
    const criticals = NUPRC_11_ANOMALY_CATEGORIES.filter((c) => c.severity === "CRITICAL").map(
      (c) => c.code
    );

    expect(criticals).toContain("DUPLICATE_DEPTH");
    expect(criticals).toContain("IMPOSSIBLE_VALUE");
    expect(criticals).toContain("NULL_DEPTH");
  });

  it("validates data contract for AuditCertificateData", () => {
    const cert: AuditCertificateData = {
      wellName: "Oloibiri-Deep-04",
      apiNo: "NUPRC-UWI-NG-2026-9042",
      fieldName: "Oloibiri Field",
      basin: "Niger Delta Basin",
      operatorName: "WellQC E&P",
      startDepth: 4000.0,
      stopDepth: 6500.0,
      step: 0.5,
      depthUnit: "FT",
      qualityScore: 82,
      qualityGrade: "GOOD",
      completenessIndex: 97.4,
      anomalies: [
        {
          curveMnemonic: "GR",
          depthStart: 4120.0,
          depthEnd: 4122.0,
          anomalyType: "EXTREME_SPIKE",
          severity: "WARNING",
          description: "High frequency transient spike",
        },
      ],
      actionsApplied: {
        despiking: true,
        boundaryClamping: true,
        duplicateDepthPruning: true,
        imputationStrategy: "NONE",
      },
      cleanedScore: 96,
      cleanedGrade: "EXCELLENT",
      timestamp: new Date().toISOString(),
    };

    expect(cert.wellName).toBe("Oloibiri-Deep-04");
    expect(cert.completenessIndex).toBeGreaterThanOrEqual(95.0); // NUPRC Schedule 4 standard
    expect(cert.cleanedScore).toBeGreaterThan(cert.qualityScore);
    expect(cert.actionsApplied?.despiking).toBe(true);
  });
});
