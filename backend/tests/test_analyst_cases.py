import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.parser import parse_las_content, LASParseError
from backend.app.services.quality_engine import analyze_well_log_quality
from backend.app.services.cleaner import clean_las_log_data, CleaningOptions
from backend.app.services.standardiser import CustomAliasEntry, standardise_mnemonic

client = TestClient(app)

SAMPLE_NORMAL_LAS = """~VERSION INFORMATION
VERS. 2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
WRAP. NO  : ONE LINE PER DEPTH STEP
~WELL INFORMATION
STRT.M 1000.0 : START DEPTH
STOP.M 1005.0 : STOP DEPTH
STEP.M 1.0    : STEP VALUE
NULL.  -999.25 : NULL VALUE
WELL. TEST WELL : WELL NAME
COMP. CHEVRON : COMPANY
FLD. TEST FIELD : FIELD
~CURVE INFORMATION
DEPT.M : 1 DEPTH
GR  .GAPI : 2 GAMMA RAY
RHOB.G/CC : 3 DENSITY
~ASCII
1000.0  45.2  2.35
1001.0  52.1  2.40
1002.0  -999.25 2.38
1003.0  60.4  -999.25
1004.0  58.9  2.42
1005.0  61.0  2.45
"""

SAMPLE_NO_NULL_LAS = """~VERSION INFORMATION
VERS. 2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
WRAP. NO  : ONE LINE PER DEPTH STEP
~WELL INFORMATION
STRT.M 1000.0 : START DEPTH
STOP.M 1005.0 : STOP DEPTH
STEP.M 1.0    : STEP VALUE
WELL. NO NULL WELL : WELL NAME
COMP. CHEVRON : COMPANY
~CURVE INFORMATION
DEPT.M : 1 DEPTH
GR  .GAPI : 2 GAMMA RAY
RHOB.G/CC : 3 DENSITY
~ASCII
1000.0  45.2  2.35
1001.0  52.1  2.40
1002.0  55.0  2.38
1003.0  60.4  2.41
1004.0  58.9  2.42
1005.0  61.0  2.45
"""

SAMPLE_NULL_DEPTH_LAS = """~VERSION INFORMATION
VERS. 2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
WRAP. NO  : ONE LINE PER DEPTH STEP
~WELL INFORMATION
STRT.M 1000.0 : START DEPTH
STOP.M 1005.0 : STOP DEPTH
STEP.M 1.0    : STEP VALUE
NULL.  -999.25 : NULL VALUE
WELL. BAD DEPTH WELL : WELL NAME
~CURVE INFORMATION
DEPT.M : 1 DEPTH
GR  .GAPI : 2 GAMMA RAY
~ASCII
1000.0   45.2
1001.0   52.1
-999.25  55.0
1003.0   60.4
1004.0   58.9
1005.0   61.0
"""

SAMPLE_BLANK_UNIT_LAS = """~VERSION INFORMATION
VERS. 2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
WRAP. NO  : ONE LINE PER DEPTH STEP
~WELL INFORMATION
STRT.M 1000.0 : START DEPTH
STOP.M 1002.0 : STOP DEPTH
STEP.M 1.0    : STEP VALUE
NULL.  -999.25 : NULL VALUE
WELL. BLANK UNIT WELL : WELL NAME
~CURVE INFORMATION
DEPT.M : 1 DEPTH
GR  .     : 2 GAMMA RAY WITH BLANK UNIT
~ASCII
1000.0  45.2
1001.0  52.1
1002.0  55.0
"""


def test_invalid_las_text_returns_400():
    res = client.post("/api/las?action=precheck", json={"content": "hello world this is not a las file"})
    assert res.status_code == 400
    assert "Not a valid LAS file" in res.json()["detail"]


def test_normal_file_curve_count_includes_depth():
    res = client.post("/api/las?action=precheck", json={"content": SAMPLE_NORMAL_LAS})
    assert res.status_code == 200
    data = res.json()
    assert data["curveCount"] == 3  # DEPT + GR + RHOB
    assert len(data["warnings"]) == 0


def test_file_with_no_null_marker_does_not_crash():
    # 1. Precheck
    res = client.post("/api/las?action=precheck", json={"content": SAMPLE_NO_NULL_LAS})
    assert res.status_code == 200
    data = res.json()
    assert any("null marker" in w.lower() for w in data["warnings"])

    # 2. Analyze
    res_analyze = client.post("/api/las/analyze", json={"content": SAMPLE_NO_NULL_LAS})
    assert res_analyze.status_code == 200
    assert res_analyze.json()["parsed"]["wellInfo"]["nullValue"] is None

    res_clean = client.post("/api/las/clean", json={"content": SAMPLE_NO_NULL_LAS})
    assert res_clean.status_code == 200
    clean_data = res_clean.json()
    assert "-999.25 : NULL VALUE" in clean_data["cleanedLasText"]
    assert clean_data["cleanedLas"]["wellInfo"]["nullValue"] == -999.25
    assert "no NULL marker" in clean_data["verificationReport"]["summaryMessage"]


def test_file_with_null_depth_row_reports_null_depth_anomaly():
    parsed = parse_las_content(SAMPLE_NULL_DEPTH_LAS)
    assert len(parsed.nullDepthRows) == 1
    assert parsed.nullDepthRows[0] == 2

    qa = analyze_well_log_quality(parsed)
    null_depth_anoms = [a for a in qa.anomalies if a.anomalyType == "NULL_DEPTH"]
    assert len(null_depth_anoms) == 1
    assert null_depth_anoms[0].curveMnemonic == "DEPT"

    # Confirm no false huge depth gap (e.g. 2000m) is reported because the null depth row was excluded
    depth_gap_anoms = [a for a in qa.anomalies if a.anomalyType == "DEPTH_GAP"]
    assert len(depth_gap_anoms) == 0


def test_clean_blank_unit_curve_preserves_blank_unit():
    # Decision 2: blank unit curves keep their blank unit without forced conversion
    parsed = parse_las_content(SAMPLE_BLANK_UNIT_LAS)
    cleaned = clean_las_log_data(parsed, options=CleaningOptions(unitStandardization=True))
    gr_curve = next(c for c in cleaned.cleanedLas.curves if c.mnemonic == "GR")
    assert gr_curve.unit == ""


def test_diagnose_endpoint_with_null_value_none():
    payload = {
        "las": {
            "depth": [1000.0, 1001.0, 1002.0],
            "curves": {"GR": [45.0, 50.0, 55.0]},
            "curveMeta": [{"mnemonic": "GR", "unit": "GAPI", "description": "Gamma"}],
            "wellInfo": {
                "wellName": "TEST",
                "startDepth": 1000.0,
                "stopDepth": 1002.0,
                "step": 1.0,
                "nullValue": None,
                "depthUnit": "M",
            },
        }
    }
    res = client.post("/api/las/diagnose", json=payload)
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_custom_alias_used_in_cleaning():
    sample_custom = """~VERSION INFORMATION
VERS. 2.0 : CWLS LOG ASCII STANDARD
WRAP. NO
~WELL INFORMATION
STRT.M 1000.0 :
STOP.M 1001.0 :
STEP.M 1.0 :
NULL. -999.25 :
WELL. TEST :
~CURVE INFORMATION
DEPT.M : 1 DEPTH
GAMX.GAPI : 2 CUSTOM GAMMA
~ASCII
1000.0 50.0
1001.0 55.0
"""
    custom_aliases = [
        CustomAliasEntry(
            id="test-1",
            alias="GAMX",
            standardMnemonic="GR",
            addedBy="Test",
            addedAt="2026-10-05T00:00:00Z",
        )
    ]
    parsed = parse_las_content(sample_custom, custom_aliases=custom_aliases)
    cleaned = clean_las_log_data(parsed, custom_aliases=custom_aliases, options=CleaningOptions(unitStandardization=True))
    assert any(c.mnemonic == "GR" for c in cleaned.cleanedLas.curves)

