import { parseLASContent } from "@/lib/las/parser";

describe("LAS Parser Engine (parseLASContent)", () => {
  const sampleLas = `~Version Information
VERS.   2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
WRAP.    NO : ONE LINE PER DEPTH STEP
~Well Information
#MNEM.UNIT       DATA                       DESCRIPTION
#----.----       ------------------------- ---------------------------------
STRT .M          1000.0000                 : START DEPTH
STOP .M          1005.0000                 : STOP DEPTH
STEP .M          1.0000                    : STEP
NULL .           -999.2500                 : NULL VALUE
WELL .           TEST-WELL-01              : WELL NAME
COMP .           CHEVRON                   : COMPANY
FLD  .           AGBAMI                    : FIELD
~Curve Information
#MNEM.UNIT       API CODES                 DESCRIPTION
#----.----       ------------------------- ---------------------------------
DEPT .M                                    : 1  DEPTH
GR   .GAPI                                 : 2  GAMMA RAY
RHOB .G/CC                                 : 3  BULK DENSITY
~A Depth         GR       RHOB
 1000.0000       45.20    2.35
 1001.0000       52.10    2.40
 1002.0000       -999.25  2.38
 1003.0000       60.40    -999.25
 1004.0000       58.90    2.42
 1005.0000       61.00    2.45
`;

  it("successfully parses well information and metadata", () => {
    const result = parseLASContent(sampleLas);

    expect(result.version).toBe("2.0");
    expect(result.wrap).toBe(false);
    expect(result.wellInfo.wellName).toBe("TEST-WELL-01");
    expect(result.wellInfo.company).toBe("CHEVRON");
    expect(result.wellInfo.field).toBe("AGBAMI");
    expect(result.wellInfo.startDepth).toBe(1000);
    expect(result.wellInfo.stopDepth).toBe(1005);
    expect(result.wellInfo.step).toBe(1);
    expect(result.wellInfo.nullValue).toBe(-999.25);
    expect(result.wellInfo.depthUnit).toBe("M");
  });

  it("extracts curve definitions correctly", () => {
    const result = parseLASContent(sampleLas);

    expect(result.curves).toHaveLength(3);
    expect(result.curves.map((c) => c.mnemonic)).toEqual(["DEPT", "GR", "RHOB"]);
    expect(result.curves[1].unit).toBe("GAPI");
  });

  it("parses depth and numerical curve series accurately", () => {
    const result = parseLASContent(sampleLas);

    expect(result.totalPoints).toBe(6);
    expect(result.data.depth).toEqual([1000, 1001, 1002, 1003, 1004, 1005]);
    expect(result.data.curves["GR"]).toEqual([45.2, 52.1, -999.25, 60.4, 58.9, 61.0]);
    expect(result.data.curves["RHOB"]).toEqual([2.35, 2.4, 2.38, -999.25, 2.42, 2.45]);
  });

  it("handles missing ASCII data gracefully without crashing", () => {
    const emptyLas = `~Version
VERS. 2.0 :
~Well
WELL. EMPTY_WELL :
~Curve
DEPT.M : Depth
`;
    const result = parseLASContent(emptyLas);

    expect(result.wellInfo.wellName).toBe("EMPTY_WELL");
    expect(result.totalPoints).toBe(0);
    expect(result.data.depth).toEqual([]);
  });
});
