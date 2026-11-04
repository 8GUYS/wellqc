import pytest
import numpy as np
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.comparison import (
    compare_two_wells,
    _compute_lag_shift,
    _clean_curve_series,
    _estimate_formations,
)
from types import SimpleNamespace
from backend.app.models.models import User, Well, LASFile, Curve
from backend.app.core.database import SessionLocal, set_rls_context
from backend.app.core.security import create_session_token

client = TestClient(app)


def test_clean_curve_series():
    depth = np.array([1000.0, 1001.0, 1002.0, 1003.0, 1004.0])
    vals = np.array([50.0, -999.25, np.nan, 75.0, np.inf])
    cd, cv = _clean_curve_series(depth, vals, -999.25)
    assert len(cd) == 2
    assert list(cd) == [1000.0, 1003.0]
    assert list(cv) == [50.0, 75.0]


def test_compute_lag_shift():
    # Signal with known sinusoidal shape
    x = np.linspace(0, 4 * np.pi, 100)
    signal = np.sin(x)
    # Shifted signal by 5 steps
    grid_step = 0.5
    s_a = signal
    s_b = np.roll(signal, 5)
    best_lag_depth, max_corr = _compute_lag_shift(grid_step, s_a, s_b, max_steps=10)
    assert max_corr > 0.95
    assert abs(abs(best_lag_depth) - (5 * grid_step)) < 0.01


def test_estimate_formations():
    depth = np.linspace(2000, 6000, 100)
    gr = np.linspace(40, 120, 100)
    markers = _estimate_formations(depth, {"GR": gr})
    assert "Benin" in markers
    assert "Agbada" in markers
    assert "Akata" in markers
    assert markers["Benin"] == 2000.0
    assert markers["Agbada"] is not None
    assert markers["Akata"] is not None
    assert markers["Agbada"] < markers["Akata"]


def test_compare_two_wells_identical():
    depth = list(np.linspace(1000, 2000, 200))
    # Synthetic gamma ray and resistivity
    gr = list(50 + 25 * np.sin(np.linspace(0, 10, 200)))
    rt = list(10 + 5 * np.cos(np.linspace(0, 10, 200)))

    data_a = {
        "depth": depth,
        "curves": {"GR": gr, "RT": rt},
    }
    data_b = {
        "depth": depth,
        "curves": {"GR": gr, "RT": rt},
    }

    res = compare_two_wells(
        well_a_id="well-1",
        well_a_name="Well-01",
        curves_data_a=data_a,
        well_b_id="well-2",
        well_b_name="Well-02",
        curves_data_b=data_b,
        depth_unit="FT",
    )

    assert res.composite_correlation_score >= 95.0
    assert res.overall_match_grade == "EXCELLENT_MATCH"
    assert "GR" in res.common_curves
    assert "RT" in res.common_curves
    assert len(res.curve_correlations) == 2

    gr_stat = next(c for c in res.curve_correlations if c.mnemonic == "GR")
    assert gr_stat.pearson_r > 0.98
    assert gr_stat.stratigraphic_continuity == "HIGH"
    assert gr_stat.rmsd < 0.1


def test_compare_two_wells_all_available_channels():
    depth = list(np.linspace(1000, 2000, 200))
    gr = list(50 + 25 * np.sin(np.linspace(0, 10, 200)))
    rt = list(10 + 5 * np.cos(np.linspace(0, 10, 200)))
    rhob = list(2.4 + 0.2 * np.sin(np.linspace(0, 5, 200)))
    dt = list(80 + 10 * np.cos(np.linspace(0, 5, 200)))
    nphi = list(0.25 + 0.05 * np.sin(np.linspace(0, 5, 200)))

    # Well A has DT (primary only); Well B has NPHI (offset only)
    data_a = {
        "depth": depth,
        "curves": {"GR": gr, "RT": rt, "RHOB": rhob, "DT": dt},
    }
    data_b = {
        "depth": depth,
        "curves": {"GR": gr, "RT": rt, "RHOB": rhob, "NPHI": nphi},
    }

    res = compare_two_wells(
        well_a_id="well-1",
        well_a_name="Well-01",
        curves_data_a=data_a,
        well_b_id="well-2",
        well_b_name="Well-02",
        curves_data_b=data_b,
        depth_unit="FT",
    )

    assert len(res.common_curves) == 3
    assert set(res.common_curves) == {"GR", "RT", "RHOB"}
    assert res.curves_well_a_only == ["DT"]
    assert res.curves_well_b_only == ["NPHI"]
    assert len(res.curve_correlations) == 5

    dt_stat = next(c for c in res.curve_correlations if c.mnemonic == "DT")
    assert dt_stat.availability == "WELL_A_ONLY"
    assert dt_stat.stratigraphic_continuity == "PRIMARY_ONLY"
    assert dt_stat.sample_count > 0
    assert dt_stat.min_a > 0

    nphi_stat = next(c for c in res.curve_correlations if c.mnemonic == "NPHI")
    assert nphi_stat.availability == "WELL_B_ONLY"
    assert nphi_stat.stratigraphic_continuity == "OFFSET_ONLY"
    assert nphi_stat.sample_count > 0
    assert nphi_stat.min_b > 0


def test_compare_two_wells_with_depth_offset():
    # Well A logged from 2000 to 4000
    depth_a = list(np.linspace(2000, 4000, 200))
    # Well B logged from 2500 to 4500 (overlap is 2500 to 4000)
    depth_b = list(np.linspace(2500, 4500, 200))

    data_a = {
        "depth": depth_a,
        "curves": {"GR": list(np.random.normal(60, 10, 200))},
    }
    data_b = {
        "depth": depth_b,
        "curves": {"GR": list(np.random.normal(60, 10, 200))},
    }

    res = compare_two_wells(
        well_a_id="well-a",
        well_a_name="Well A",
        curves_data_a=data_a,
        well_b_id="well-b",
        well_b_name="Well B",
        curves_data_b=data_b,
    )

    assert res.overlap_start_depth == 2500.0
    assert res.overlap_stop_depth == 4000.0
    assert res.overlap_span == 1500.0


def test_compare_endpoint_validation():
    db = SessionLocal()
    try:
        set_rls_context(db, SimpleNamespace(id="admin", role="ADMIN"))
        user = db.query(User).filter(User.email == "analyst@wellqc.com").first()
        if not user:
            import uuid
            user = User(
                id=str(uuid.uuid4()),
                email="analyst@wellqc.com",
                name="QC Analyst",
                passwordHash="test_hash_secret_123",
                role="USER",
                department="Petrophysics",
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        token = create_session_token({
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
        })
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {token}"}
    client.cookies.set("wellqc_session", token)

    # Empty payload should fail validation
    res = client.post("/api/wells/compare", json={}, headers=headers)
    assert res.status_code == 422

    # Malicious injection attempt in ID should be caught
    res_mal = client.post(
        "/api/wells/compare",
        json={"primary_well_id": "'; DROP TABLE wells; --", "offset_well_id": "valid-id"},
        headers=headers,
    )
    assert res_mal.status_code in [400, 422]

    # Non-existent wells should return 404
    res_404 = client.post(
        "/api/wells/compare",
        json={"primary_well_id": "non-existent-1", "offset_well_id": "non-existent-2"},
        headers=headers,
    )
    assert res_404.status_code == 404


def test_hybrid_formation_markers_api():
    import uuid
    from backend.app.models.models import Field, Operator
    db = SessionLocal()
    well_id = None
    user_id = None
    created_user = False
    try:
        set_rls_context(db, SimpleNamespace(id="admin", role="ADMIN"))
        user = db.query(User).filter(User.email == "analyst@wellqc.com").first()
        if not user:
            user = User(
                id=str(uuid.uuid4()),
                email="analyst@wellqc.com",
                name="QC Analyst",
                passwordHash="test_hash_secret_123",
                role="USER",
                department="Petrophysics",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            created_user = True

        user_id = user.id
        set_rls_context(db, SimpleNamespace(id=user.id, role="ADMIN"))

        field = db.query(Field).first()
        if not field:
            field = Field(name="Marker Test Field", basin="Niger Delta", country="Nigeria")
            db.add(field)
            db.commit()

        op = db.query(Operator).first()
        if not op:
            op = Operator(name="Marker Test Op")
            db.add(op)
            db.commit()

        well = Well(
            id=str(uuid.uuid4()),
            apiNo=f"MARKER-{uuid.uuid4().hex[:6]}",
            name=f"Marker Test Well {uuid.uuid4().hex[:4]}",
            operatorName=op.name,
            fieldName=field.name,
            basin="Niger Delta",
            country="Nigeria",
            latitude=4.85,
            longitude=6.25,
            elevFt=45.0,
            tdFt=9500.0,
            depthUnit="FT",
            qualityScore=88,
            qualityGrade="GOOD",
            ownerId=user.id,
        )
        db.add(well)
        db.commit()
        db.refresh(well)

        token = create_session_token({
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
        })
        well_id = well.id
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {token}"}
    client.cookies.set("wellqc_session", token)

    try:
        # 1. GET markers when none exist -> returns estimation fallback
        res_get = client.get(f"/api/wells/{well_id}/markers", headers=headers)
        assert res_get.status_code == 200
        markers = res_get.json().get("markers", [])
        assert len(markers) >= 3
        assert all(m["source"] == "ESTIMATED" for m in markers)

        # 2. POST custom verified picks
        verified_payload = {
            "markers": [
                {
                    "formationName": "Benin Formation",
                    "topDepth": 1150.0,
                    "source": "VERIFIED",
                    "notes": "Biostratigraphic top confirmation",
                },
                {
                    "formationName": "Agbada Formation",
                    "topDepth": 4200.0,
                    "source": "VERIFIED",
                    "notes": "Paralic reservoir sand top",
                },
                {
                    "formationName": "Akata Formation",
                    "topDepth": 8100.0,
                    "source": "VERIFIED",
                    "notes": "Marine shale baseline kick",
                },
            ]
        }
        res_post = client.post(f"/api/wells/{well_id}/markers", json=verified_payload, headers=headers)
        assert res_post.status_code == 200
        assert res_post.json()["count"] == 3

        # 3. GET markers again -> returns verified interpreter picks
        res_get2 = client.get(f"/api/wells/{well_id}/markers", headers=headers)
        assert res_get2.status_code == 200
        markers2 = res_get2.json().get("markers", [])
        assert len(markers2) == 3
        assert all(m["source"] == "VERIFIED" for m in markers2)
        benin = next(m for m in markers2 if "Benin" in m["formationName"])
        assert benin["topDepth"] == 1150.0
    finally:
        if well_id:
            clean_db = SessionLocal()
            try:
                set_rls_context(clean_db, SimpleNamespace(id=user_id or "admin", role="ADMIN"))
                from backend.app.models.models import FormationMarker
                clean_db.query(FormationMarker).filter(FormationMarker.wellId == well_id).delete(synchronize_session=False)
                clean_db.query(Well).filter(Well.id == well_id).delete(synchronize_session=False)
                if created_user and user_id:
                    clean_db.query(User).filter(User.id == user_id).delete(synchronize_session=False)
                clean_db.commit()
            finally:
                clean_db.close()