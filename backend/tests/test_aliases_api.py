import os
import json
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.standardiser import set_custom_aliases

client = TestClient(app)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from backend.app.core.database import Base, get_db
from backend.app.models.models import CustomAlias

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(autouse=True)
def setup_aliases():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    set_custom_aliases([])
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)
    set_custom_aliases([])

def test_get_aliases_returns_array():
    res = client.get("/api/standardisation/aliases")
    assert res.status_code == 200
    assert "aliases" in res.json()
    assert isinstance(res.json()["aliases"], list)

def test_post_creates_new_alias():
    res = client.post(
        "/api/standardisation/aliases",
        json={
            "standardMnemonic": "GR",
            "alias": "GAMMA_SPECIAL_V3",
            "addedBy": "Dr. Evelyn Reed",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["entry"]["alias"] == "GAMMA_SPECIAL_V3"
    assert data["entry"]["standardMnemonic"] == "GR"
    assert data["entry"]["addedBy"] == "Dr. Evelyn Reed"
    assert "addedAt" in data["entry"]

def test_post_blocks_duplicate_alias_across_curves():
    res = client.post(
        "/api/standardisation/aliases",
        json={
            "standardMnemonic": "CALI",
            "alias": "RT",
        },
    )
    assert res.status_code == 400
    data = res.json()
    assert data["detail"] == "RT is already mapped to RT. Remove or choose a different alias."

def test_put_edits_existing_alias():
    # First create
    client.post(
        "/api/standardisation/aliases",
        json={
            "standardMnemonic": "RHOB",
            "alias": "DENS_TEMP",
        },
    )
    # Edit
    res = client.put(
        "/api/standardisation/aliases",
        json={
            "standardMnemonic": "RHOB",
            "oldAlias": "DENS_TEMP",
            "newAlias": "DENS_PERM",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["entry"]["alias"] == "DENS_PERM"

def test_delete_alias():
    client.post(
        "/api/standardisation/aliases",
        json={
            "standardMnemonic": "CALI",
            "alias": "CAL_TEST_TO_REMOVE",
        },
    )
    res = client.delete("/api/standardisation/aliases?standardMnemonic=CALI&alias=CAL_TEST_TO_REMOVE")
    assert res.status_code == 200
    data = res.json()
    assert any(a["alias"] == "CAL_TEST_TO_REMOVE" for a in data["aliases"]) is False


def test_get_standard_curves_returns_19_curves():
    res = client.get("/api/standardisation/curves")
    assert res.status_code == 200
    data = res.json()
    assert "curves" in data
    assert len(data["curves"]) == 19
    mnemonics = [c["standardMnemonic"] for c in data["curves"]]
    assert "DEPT" in mnemonics
    assert "TVD" in mnemonics
    assert "CGR" in mnemonics
    assert "POTA" in mnemonics
    assert "THOR" in mnemonics
    assert "URAN" in mnemonics
    assert "RM" in mnemonics
    assert "BS" in mnemonics
    assert "TEMP" in mnemonics

