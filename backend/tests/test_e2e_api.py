import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

SAMPLE_LAS = """~Version Information
VERS.   2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
WRAP.    NO : ONE LINE PER DEPTH STEP
~Well Information
#MNEM.UNIT       DATA                       DESCRIPTION
#----.----       ------------------------- ---------------------------------
STRT .M          1000.0000                 : START DEPTH
STOP .M          1005.0000                 : STOP DEPTH
STEP .M          1.0000                    : STEP
NULL .           -999.2500                 : NULL VALUE
WELL .           TEST-WELL-E2E             : WELL NAME
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

def test_health_check():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "WellQC" in data["service"]

def test_demo_login_and_me():
    client = TestClient(app)
    # Login via demo endpoint
    demo_resp = client.post("/api/auth/demo", json={})
    assert demo_resp.status_code == 200
    demo_data = demo_resp.json()
    assert "user" in demo_data

    # Verify /api/auth/me uses session cookie stored in client automatically
    me_resp = client.get("/api/auth/me")
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["user"]["email"] == demo_data["user"]["email"]

def test_dashboard_with_auth():
    client = TestClient(app)
    client.post("/api/auth/demo", json={})

    resp = client.get("/api/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert "totalWells" in data
    assert "lasFilesUploaded" in data
    assert "recentActivity" in data

def test_wells_api_with_auth():
    client = TestClient(app)
    client.post("/api/auth/demo", json={})

    resp = client.get("/api/wells")
    assert resp.status_code == 200
    data = resp.json()
    assert "wells" in data
    assert isinstance(data["wells"], list)

def test_las_precheck_quality_and_analysis():
    client = TestClient(app)
    resp = client.post(
        "/api/las?action=precheck",
        json={"content": SAMPLE_LAS, "fileName": "test_well.las"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "curveSummaries" in data
    assert "curveMappings" in data
    assert "anomalies" in data
    assert "overallScore" in data
    assert "qualityGrade" in data
    assert "aiSummary" in data
    assert data["overallScore"] > 0

def test_las_diagnose():
    client = TestClient(app)
    resp = client.post(
        "/api/las/diagnose",
        json={
            "las": {
                "depth": [1000.0, 1001.0, 1002.0, 1003.0, 1004.0],
                "curves": {
                    "GR": [45.0, 50.0, -999.25, 60.0, 58.0],
                    "RHOB": [2.3, 2.4, 2.35, -999.25, 2.45],
                },
                "curveMeta": [
                    {"mnemonic": "GR"},
                    {"mnemonic": "RHOB"},
                ],
                "wellInfo": {
                    "nullValue": -999.25,
                    "startDepth": 1000.0,
                    "stopDepth": 1004.0,
                    "depthUnit": "m",
                },
            }
        },
    )
    assert resp.status_code == 200
    diagnostics = resp.json()
    assert isinstance(diagnostics, list)
    assert len(diagnostics) == 2
    assert diagnostics[0]["curveMnemonic"] in ("GR", "RHOB")


def test_get_well_detail_requires_auth():
    client = TestClient(app)
    # Direct unauthenticated request must return 401 with helpful instructions and WWW-Authenticate header
    resp = client.get("/api/wells/42-999-00001")
    assert resp.status_code == 401
    assert "Authentication is required" in resp.json()["detail"]
    assert "Authorize" in resp.json()["detail"]


def test_get_well_detail_flow():
    client = TestClient(app)
    # 1. Login via demo endpoint and get bearer token
    demo_resp = client.post("/api/auth/demo", json={})
    assert demo_resp.status_code == 200
    token = demo_resp.json().get("token")
    assert token is not None

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create a well
    create_resp = client.post(
        "/api/wells",
        json={
            "name": "Swagger Test Well Alpha",
            "apiNo": "99-123-45678",
            "operatorName": "Apex Energy",
            "fieldName": "Niger Delta Block 4",
            "basin": "Niger Delta",
            "country": "Nigeria",
            "latitude": 4.85,
            "longitude": 6.95,
            "tdFt": 12500,
        },
        headers=headers,
    )
    assert create_resp.status_code == 200
    created_well = create_resp.json()["well"]
    well_id = created_well["id"]

    # 3. Retrieve well by internal UUID
    uuid_resp = client.get(f"/api/wells/{well_id}", headers=headers)
    assert uuid_resp.status_code == 200
    data = uuid_resp.json()
    assert data["well"]["id"] == well_id
    assert data["well"]["apiNo"] == "99-123-45678"
    assert "curvesData" in data
    assert "curveSummaries" in data

    # 4. Retrieve well by API Number (e.g. Swagger input "99-123-45678")
    api_resp = client.get("/api/wells/99-123-45678", headers=headers)
    assert api_resp.status_code == 200
    assert api_resp.json()["well"]["id"] == well_id

    # 5. Retrieve well by Well Name
    name_resp = client.get("/api/wells/Swagger Test Well Alpha", headers=headers)
    assert name_resp.status_code == 200
    assert name_resp.json()["well"]["id"] == well_id

    # 6. Non-existent well returns 404
    missing_resp = client.get("/api/wells/non-existent-well-id", headers=headers)
    assert missing_resp.status_code == 404

