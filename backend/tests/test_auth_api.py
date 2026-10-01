import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_auth_flow():
    # 1. Register test user with unique email
    test_email = f"py_tester_{int(pytest.importorskip('time').time())}@example.com"
    reg_res = client.post(
        "/api/auth/register",
        json={
            "name": "Python Tester",
            "email": test_email,
            "password": "Password123!",
            "role": "PETROPHYSICIST",
            "acceptedNda": True,
        },
    )
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "user" in reg_data
    assert reg_data["user"]["email"] == test_email
    cookie = reg_res.cookies.get("wellqc_session")
    assert cookie is not None

    # 2. Login with correct credentials
    login_res = client.post(
        "/api/auth/login",
        json={
            "email": test_email,
            "password": "Password123!",
        },
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["user"]["name"] == "Python Tester"

    # 3. Login with incorrect password
    bad_res = client.post(
        "/api/auth/login",
        json={
            "email": test_email,
            "password": "WrongPassword!",
        },
    )
    assert bad_res.status_code == 401

    # 4. Check /api/auth/me with session cookie
    me_res = client.get("/api/auth/me", cookies={"wellqc_session": cookie})
    assert me_res.status_code == 200
    assert me_res.json()["user"]["email"] == test_email

    # 5. Check /api/auth/logout
    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == 200
    assert logout_res.json()["success"] is True
