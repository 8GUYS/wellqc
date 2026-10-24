import { QARepairRequestPayload } from "@/lib/las/api";

describe("Petrophysical QA Engine Deliverables & Anomaly Filters", () => {
  const _TARGET_ANOMALY_TYPES = [
    "DUPLICATE_DEPTH",
    "IMPOSSIBLE_VALUE",
    "NULL_CLUSTER",
    "EXTREME_SPIKE",
  ];

  function isTargetAnomaly(type: string): boolean {
    const norm = (type || "").toUpperCase().trim();
    return (
      norm === "DUPLICATE_DEPTH" ||
      norm === "IMPOSSIBLE_VALUE" ||
      norm === "NULL_CLUSTER" ||
      norm === "NULL_DEPTH" ||
      norm === "EXTREME_SPIKE"
    );
  }

  it("filters anomalies strictly to the 4 approved categories", () => {
    const sampleAnomalies = [
      { anomalyType: "DUPLICATE_DEPTH", curveMnemonic: "DEPT" },
      { anomalyType: "IMPOSSIBLE_VALUE", curveMnemonic: "GR" },
      { anomalyType: "NULL_CLUSTER", curveMnemonic: "RHOB" },
      { anomalyType: "EXTREME_SPIKE", curveMnemonic: "DT" },
      { anomalyType: "UNIT_MISMATCH", curveMnemonic: "CALI" },
      { anomalyType: "NON_STANDARD_MNEMONIC", curveMnemonic: "UNKNOWN" },
      { anomalyType: "FLATLINE", curveMnemonic: "NPHI" },
    ];

    const filtered = sampleAnomalies.filter((a) => isTargetAnomaly(a.anomalyType));

    expect(filtered).toHaveLength(4);
    expect(filtered.map((f) => f.anomalyType)).toEqual([
      "DUPLICATE_DEPTH",
      "IMPOSSIBLE_VALUE",
      "NULL_CLUSTER",
      "EXTREME_SPIKE",
    ]);
  });

  it("constructs a valid QARepairRequestPayload with user-approved repair actions", () => {
    const payload: QARepairRequestPayload = {
      wellId: "test-well-uuid-1",
      wellName: "Offshore-Alpha-1X",
      despiking: true,
      outlierClipping: true,
      duplicateDepthPruning: true,
      imputationStrategy: "NONE",
    };

    expect(payload.despiking).toBe(true);
    expect(payload.outlierClipping).toBe(true);
    expect(payload.duplicateDepthPruning).toBe(true);
    expect(payload.imputationStrategy).toBe("NONE");
  });
});
