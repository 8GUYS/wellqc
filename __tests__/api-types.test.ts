import { CurveAnomalyItem, CurveHealthStatus, CurveHealthSummary } from "@/lib/api-types";

describe("API Data Contracts & Quality Types", () => {
  it("enforces strong typing for CurveHealthSummary", () => {
    const anomaly: CurveAnomalyItem = {
      curveMnemonic: "GR",
      depthStart: 1000,
      depthEnd: 1002,
      anomalyType: "EXTREME_SPIKE",
      severity: "WARNING",
      description: "Sudden spike in gamma ray reading",
      suggestedCorrection: "Verify tool calibration",
    };

    const status: CurveHealthStatus = "EXCELLENT";

    const summary: CurveHealthSummary = {
      mnemonic: "GR",
      standardMnemonic: "GR",
      unit: "GAPI",
      nullCount: 0,
      totalPoints: 500,
      nullPercentage: 0,
      minVal: 20,
      maxVal: 120,
      meanVal: 65,
      healthScore: 98,
      status,
      anomalies: [anomaly],
    };

    expect(summary.mnemonic).toBe("GR");
    expect(summary.status).toBe("EXCELLENT");
    expect(summary.anomalies).toHaveLength(1);
    expect(summary.anomalies[0].severity).toBe("WARNING");
  });
});
