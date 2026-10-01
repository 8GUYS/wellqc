import os
import json
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.standardiser import set_custom_aliases

client = TestClient(app)

DATA_DIR = os.path.join(os.getcwd(), "data")
ALIASES_FILE = os.path.join(DATA_DIR, "custom-aliases.json")

from backend.app.core.database import SessionLocal
from backend.app.models.models import CustomAlias

@pytest.fixture(autouse=True)
def setup_aliases():
    os.makedirs(DATA_DIR, exist_ok=True)
    orig = "[]"
    if os.path.exists(ALIASES_FILE):
        with open(ALIASES_FILE, "r") as f:
            orig = f.read()
    with open(ALIASES_FILE, "w") as f:
        f.write("[]")
    set_custom_aliases([])
    
    test_aliases = ["GAMMA_SPECIAL_V3", "DENS_TEMP", "DENS_PERM", "NEW_TEST_ALIAS"]
    db = SessionLocal()
    try:
        db.query(CustomAlias).filter(CustomAlias.alias.in_(test_aliases)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()

    yield

    db = SessionLocal()
    try:
        db.query(CustomAlias).filter(CustomAlias.alias.in_(test_aliases)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()

    with open(ALIASES_FILE, "w") as f:
        f.write(orig)
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
