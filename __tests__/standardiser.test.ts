import {
  standardiseMnemonic,
  validateAliasForCurve,
  STANDARD_CURVES,
} from "@/lib/las/standardiser";

describe("Mnemonic Standardisation & Aliasing Engine", () => {
  describe("STANDARD_CURVES dictionary", () => {
    it("contains standard petroleum log families", () => {
      expect(STANDARD_CURVES["GR"]).toBeDefined();
      expect(STANDARD_CURVES["RHOB"]).toBeDefined();
      expect(STANDARD_CURVES["NPHI"]).toBeDefined();
      expect(STANDARD_CURVES["DT"]).toBeDefined();
      expect(STANDARD_CURVES["DEPT"]).toBeDefined();
    });

    it("has valid physical measurement limits for standard curves", () => {
      expect(STANDARD_CURVES["GR"].minPhysical).toBe(0);
      expect(STANDARD_CURVES["GR"].maxPhysical).toBeGreaterThan(100);
      expect(STANDARD_CURVES["RHOB"].minPhysical).toBeGreaterThan(1.0);
      expect(STANDARD_CURVES["RHOB"].maxPhysical).toBeLessThan(4.0);
    });
  });

  describe("standardiseMnemonic", () => {
    it("matches exact standard curves with confidence 1.0", () => {
      const match = standardiseMnemonic("GR", "GAPI");
      expect(match.standardMnemonic).toBe("GR");
      expect(match.confidence).toBe(1.0);
      expect(match.isAutoMatched).toBe(true);
    });

    it("resolves vendor aliases correctly", () => {
      const grVendor = standardiseMnemonic("GAMMA", "GAPI");
      expect(grVendor.standardMnemonic).toBe("GR");

      const densityVendor = standardiseMnemonic("RHOZ", "G/CC");
      expect(densityVendor.standardMnemonic).toBe("RHOB");

      const sonicVendor = standardiseMnemonic("DTCO", "US/F");
      expect(sonicVendor.standardMnemonic).toBe("DT");
    });

    it("detects unit compatibility and flags mismatches", () => {
      const validUnit = standardiseMnemonic("GR", "GAPI");
      expect(validUnit.unitMismatch).toBe(false);

      const invalidUnit = standardiseMnemonic("GR", "DEGC");
      expect(invalidUnit.unitMismatch).toBe(true);
    });

    it("handles unknown or bespoke vendor curves cleanly", () => {
      const unknown = standardiseMnemonic("CUSTOM_ANALYTICS_CHAN_99", "V/V");
      expect(unknown.standardMnemonic).toBe("CUSTOM_ANALYTICS_CHAN_99");
      expect(unknown.confidence).toBeLessThan(1.0);
    });
  });

  describe("validateAliasForCurve", () => {
    it("allows non-conflicting new aliases", () => {
      const result = validateAliasForCurve("GAMMA_ACQUIRED_LWD", "GR");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects empty alias", () => {
      const result = validateAliasForCurve("", "GR");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot be empty");
    });

    it("prevents assigning an alias already mapped to another curve", () => {
      // RHOB is a standard curve, cannot be assigned as alias to GR
      const result = validateAliasForCurve("RHOB", "GR");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("already mapped");
    });
  });
});
