import {
  standardiseMnemonic,
  validateAliasForCurve,
  addCustomAlias,
  editCustomAlias,
  removeCustomAlias,
  getMergedStandardCurves,
  setCustomAliases,
  CustomAliasEntry,
} from "@/lib/las/standardiser";

describe("Mnemonic Standardiser (standardiseMnemonic)", () => {
  beforeEach(() => {
    // Reset custom aliases before each test
    setCustomAliases([]);
  });

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

describe("Issue 2: Cross-Curve Duplicate Alias Validation", () => {
  beforeEach(() => {
    setCustomAliases([]);
  });

  it("blocks adding another standard curve's mnemonic with exact required error", () => {
    // Attempting to add RT under CALI
    const validation = validateAliasForCurve("RT", "CALI");
    expect(validation.valid).toBe(false);
    expect(validation.error).toBe("RT is already mapped to RT. Remove or choose a different alias.");
    expect(validation.mappedCurve).toBe("RT");

    // Also verify addCustomAlias blocks it
    const result = addCustomAlias("CALI", "RT");
    expect(result.success).toBe(false);
    expect(result.error).toBe("RT is already mapped to RT. Remove or choose a different alias.");
  });

  it("blocks adding a built-in alias already claimed by another curve", () => {
    // ILD belongs to RT; user tries to add ILD under CALI
    const validation = validateAliasForCurve("ILD", "CALI");
    expect(validation.valid).toBe(false);
    expect(validation.error).toBe("ILD is already mapped to RT. Remove or choose a different alias.");
    expect(validation.mappedCurve).toBe("RT");
  });

  it("blocks adding a custom alias already claimed by another curve", () => {
    // Add custom alias under GR
    const added = addCustomAlias("GR", "MY_GAMMA_TOOL", "Analyst Alice");
    expect(added.success).toBe(true);

    // Analyst tries to add MY_GAMMA_TOOL under RHOB
    const validation = validateAliasForCurve("MY_GAMMA_TOOL", "RHOB");
    expect(validation.valid).toBe(false);
    expect(validation.error).toBe("MY_GAMMA_TOOL is already mapped to GR. Remove or choose a different alias.");
    expect(validation.mappedCurve).toBe("GR");

    const addResult = addCustomAlias("RHOB", "MY_GAMMA_TOOL");
    expect(addResult.success).toBe(false);
    expect(addResult.error).toBe("MY_GAMMA_TOOL is already mapped to GR. Remove or choose a different alias.");
  });

  it("allows saving a clean, unique alias", () => {
    const validation = validateAliasForCurve("SUPER_CAL_V2", "CALI");
    expect(validation.valid).toBe(true);
    expect(validation.error).toBeUndefined();

    const addResult = addCustomAlias("CALI", "SUPER_CAL_V2", "Analyst Bob");
    expect(addResult.success).toBe(true);
    expect(addResult.entry?.alias).toBe("SUPER_CAL_V2");
  });
});

describe("Issue 3: Edit and Remove Custom Aliases", () => {
  beforeEach(() => {
    setCustomAliases([]);
  });

  it("allows editing an existing custom alias to a new valid name", () => {
    addCustomAlias("GR", "TEMP_GAM", "Analyst Alice");

    // Edit TEMP_GAM to PERM_GAM
    const editRes = editCustomAlias("GR", "TEMP_GAM", "PERM_GAM");
    expect(editRes.success).toBe(true);
    expect(editRes.entry?.alias).toBe("PERM_GAM");

    // Old alias should no longer map to GR
    const oldStd = standardiseMnemonic("TEMP_GAM");
    expect(oldStd.isAutoMatched).toBe(false);

    // New alias should now map to GR
    const newStd = standardiseMnemonic("PERM_GAM");
    expect(newStd.standardMnemonic).toBe("GR");
    expect(newStd.confidence).toBe(0.95);
  });

  it("blocks editing if the new alias conflicts with another curve", () => {
    addCustomAlias("CALI", "CUSTOM_CAL", "Analyst Bob");

    // Try to edit CUSTOM_CAL to DEN (which is built-in under RHOB)
    const editRes = editCustomAlias("CALI", "CUSTOM_CAL", "DEN");
    expect(editRes.success).toBe(false);
    expect(editRes.error).toBe("DEN is already mapped to RHOB. Remove or choose a different alias.");
  });

  it("allows removing a custom alias", () => {
    addCustomAlias("NPHI", "MY_NEUTRON_TOOL", "Analyst Charlie");

    // Verify it resolves
    expect(standardiseMnemonic("MY_NEUTRON_TOOL").standardMnemonic).toBe("NPHI");

    // Remove it
    const removed = removeCustomAlias("NPHI", "MY_NEUTRON_TOOL");
    expect(removed).toBe(true);

    // It should no longer map to NPHI
    const after = standardiseMnemonic("MY_NEUTRON_TOOL");
    expect(after.isAutoMatched).toBe(false);
    expect(after.standardMnemonic).toBe("MY_NEUTRON_TOOL");
  });
});

describe("Issue 4: Built-in vs Custom Alias Distinction & Attribution", () => {
  beforeEach(() => {
    setCustomAliases([]);
  });

  it("tracks author and timestamp attribution on custom aliases", () => {
    const author = "Sarah Jenkins";
    const res = addCustomAlias("CALI", "CALIPER_MOD_4", author);
    expect(res.success).toBe(true);
    expect(res.entry).toBeDefined();
    expect(res.entry?.addedBy).toBe(author);
    expect(res.entry?.addedAt).toBeDefined();
    expect(new Date(res.entry!.addedAt).getTime()).not.toBeNaN();
  });

  it("distinguishes built-in aliases from custom ones in getMergedStandardCurves", () => {
    addCustomAlias("DT", "SONIC_CUSTOM_TAG", "Dr. Miller");

    const merged = getMergedStandardCurves();
    const dtCurve = merged["DT"];

    expect(dtCurve.aliases).toContain("DTCO"); // Built-in
    expect(dtCurve.aliases).toContain("SONIC_CUSTOM_TAG"); // Custom

    expect(dtCurve.customAliases).toBeDefined();
    expect(dtCurve.customAliases).toHaveLength(1);
    expect(dtCurve.customAliases![0].alias).toBe("SONIC_CUSTOM_TAG");
    expect(dtCurve.customAliases![0].addedBy).toBe("Dr. Miller");
  });
});
