import { standardiseMnemonic, STANDARD_CURVES } from "@/lib/las/standardiser";

describe("Mnemonic Standardiser (standardiseMnemonic)", () => {
  it("matches exact standard mnemonics with 1.0 confidence", () => {
    const gr = standardiseMnemonic("GR", "GAPI");
    expect(gr.standardMnemonic).toBe("GR");
    expect(gr.matchedName).toBe("Gamma Ray");
    expect(gr.confidence).toBe(1.0);
    expect(gr.unitMismatch).toBe(false);

    const rhob = standardiseMnemonic("RHOB", "G/CC");
    expect(rhob.standardMnemonic).toBe("RHOB");
    expect(rhob.confidence).toBe(1.0);
    expect(rhob.unitMismatch).toBe(false);
  });

  it("identifies vendor aliases and maps them to standard API curves", () => {
    const gamma = standardiseMnemonic("GAMMA", "GAPI");
    expect(gamma.standardMnemonic).toBe("GR");
    expect(gamma.matchedName).toBe("Gamma Ray");
    expect(gamma.confidence).toBe(0.95);

    const den = standardiseMnemonic("DEN", "G/CC");
    expect(den.standardMnemonic).toBe("RHOB");
    expect(den.confidence).toBe(0.95);

    const cnl = standardiseMnemonic("CNL", "V/V");
    expect(cnl.standardMnemonic).toBe("NPHI");
    expect(cnl.confidence).toBe(0.95);

    const ild = standardiseMnemonic("ILD", "OHMM");
    expect(ild.standardMnemonic).toBe("RT");
    expect(ild.confidence).toBe(0.95);
  });

  it("detects unit mismatches against acceptable units", () => {
    const wrongUnit = standardiseMnemonic("GR", "DEGC");
    expect(wrongUnit.standardMnemonic).toBe("GR");
    expect(wrongUnit.unitMismatch).toBe(true);

    const correctUnit = standardiseMnemonic("GR", "API");
    expect(correctUnit.unitMismatch).toBe(false);
  });

  it("falls back cleanly for unrecognized/custom mnemonics", () => {
    const custom = standardiseMnemonic("CUSTOM_TOOL_XYZ", "VOLTS");
    expect(custom.standardMnemonic).toBe("CUSTOM_TOOL_XYZ");
    expect(custom.matchedName).toContain("Custom Curve");
    expect(custom.confidence).toBe(0.5);
  });
});
