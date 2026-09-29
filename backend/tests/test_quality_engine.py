from backend.app.services.parser import LASCurveMeta, LASData, ParsedLAS, WellInfo
from backend.app.services.quality_engine import analyze_well_log_quality

mock_valid_las = ParsedLAS(
    version="2.0",
    wrap=False,
    wellInfo=WellInfo(
        wellName="SAMPLE-WELL",
        company="ENERGY-CORP",
        field="NIGER-DELTA",
        location="OFFSHORE",
        country="NIGERIA",
        state="RIVERS",
        apiUwi="API-12345",
        serviceCompany="SLB",
        date="2026-01-01",
        startDepth=1000.0,
        stopDepth=1004.0,
        step=1.0,
        nullValue=-999.25,
        depthUnit="M",
    ),
    curves=[
        LASCurveMeta(mnemonic="DEPT", unit="M", code="", description="Depth"),
        LASCurveMeta(mnemonic="GR", unit="GAPI", code="", description="Gamma Ray"),
        LASCurveMeta(mnemonic="RHOB", unit="G/CC", code="", description="Density"),
        LASCurveMeta(mnemonic="NPHI", unit="V/V", code="", description="Neutron Porosity"),
        LASCurveMeta(mnemonic="DT", unit="US/F", code="", description="Sonic"),
        LASCurveMeta(mnemonic="RT", unit="OHMM", code="", description="Resistivity"),
        LASCurveMeta(mnemonic="CALI", unit="IN", code="", description="Caliper"),
    ],
    data=LASData(
        depth=[1000.0, 1001.0, 1002.0, 1003.0, 1004.0],
        curves={
            "DEPT": [1000.0, 1001.0, 1002.0, 1003.0, 1004.0],
            "GR": [55.0, 60.0, 62.0, 58.0, 61.0],
            "RHOB": [2.35, 2.38, 2.4, 2.39, 2.42],
            "NPHI": [0.22, 0.25, 0.23, 0.21, 0.24],
            "DT": [75.0, 78.0, 80.0, 76.0, 77.0],
            "RT": [15.0, 18.0, 20.0, 19.0, 22.0],
            "CALI": [8.5, 8.5, 8.5, 8.5, 8.5],
        },
    ),
    rawHeader="",
    totalPoints=5,
)

def test_evaluates_high_quality_las_log():
    result = analyze_well_log_quality(mock_valid_las)
    assert result.overallScore >= 85
    assert result.qualityGrade in ("EXCELLENT", "GOOD")
    assert len(result.curveSummaries) == len(mock_valid_las.curves)

def test_flags_duplicate_depths_as_critical():
    dup_las = mock_valid_las.model_copy(deep=True)
    dup_las.data.depth = [1000.0, 1001.0, 1001.0, 1003.0, 1004.0]

    result = analyze_well_log_quality(dup_las)
    dup_anomaly = next((a for a in result.anomalies if a.anomalyType == "DUPLICATE_DEPTH"), None)
    assert dup_anomaly is not None
    assert dup_anomaly.severity == "CRITICAL"

def test_detects_depth_gaps_larger_than_step():
    gap_las = mock_valid_las.model_copy(deep=True)
    gap_las.data.depth = [1000.0, 1001.0, 1010.0, 1011.0, 1012.0]

    result = analyze_well_log_quality(gap_las)
    gap_anomaly = next((a for a in result.anomalies if a.anomalyType == "DEPTH_GAP"), None)
    assert gap_anomaly is not None
    assert gap_anomaly.severity == "WARNING"

def test_identifies_missing_required_core_curves():
    missing_las = mock_valid_las.model_copy(deep=True)
    missing_las.curves = [
        LASCurveMeta(mnemonic="DEPT", unit="M", code="", description="Depth"),
        LASCurveMeta(mnemonic="GR", unit="GAPI", code="", description="Gamma Ray"),
    ]
    missing_las.data.depth = [1000.0, 1001.0, 1002.0]
    missing_las.data.curves = {
        "DEPT": [1000.0, 1001.0, 1002.0],
        "GR": [55.0, 60.0, 62.0],
    }
    missing_las.totalPoints = 3

    result = analyze_well_log_quality(missing_las)
    assert "RHOB" in result.missingStandardCurves
    assert "NPHI" in result.missingStandardCurves
    assert "RT" in result.missingStandardCurves
