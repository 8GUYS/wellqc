from backend.app.services.parser import parse_las_content

sample_las = """~Version Information
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
"""

def test_parses_well_information_and_metadata():
    result = parse_las_content(sample_las)
    assert result.version == "2.0"
    assert result.wrap is False
    assert result.wellInfo.wellName == "TEST-WELL-01"
    assert result.wellInfo.company == "CHEVRON"
    assert result.wellInfo.field == "AGBAMI"
    assert result.wellInfo.startDepth == 1000.0
    assert result.wellInfo.stopDepth == 1005.0
    assert result.wellInfo.step == 1.0
    assert result.wellInfo.nullValue == -999.25
    assert result.wellInfo.depthUnit == "M"

def test_extracts_curve_definitions_correctly():
    result = parse_las_content(sample_las)
    assert len(result.curves) == 3
    assert [c.mnemonic for c in result.curves] == ["DEPT", "GR", "RHOB"]
    assert result.curves[1].unit == "GAPI"

def test_parses_depth_and_numerical_curve_series():
    result = parse_las_content(sample_las)
    assert result.totalPoints == 6
    assert result.data.depth == [1000.0, 1001.0, 1002.0, 1003.0, 1004.0, 1005.0]
    assert result.data.curves["GR"] == [45.2, 52.1, -999.25, 60.4, 58.9, 61.0]
    assert result.data.curves["RHOB"] == [2.35, 2.4, 2.38, -999.25, 2.42, 2.45]

def test_handles_missing_ascii_gracefully():
    empty_las = """~Version
VERS. 2.0 :
~Well
WELL. EMPTY_WELL :
~Curve
DEPT.M : Depth
"""
    result = parse_las_content(empty_las)
    assert result.wellInfo.wellName == "EMPTY_WELL"
    assert result.totalPoints == 0
    assert result.data.depth == []
