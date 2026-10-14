import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_auth_flow(monkeypatch):
    from backend.app.core.config import settings
    monkeypatch.setattr(settings, "REQUIRE_EMAIL_VERIFICATION", True)
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
    assert reg_data["user"]["isEmailVerified"] is False
    assert reg_data["requiresVerification"] is True
    
    # In development mode, verification token is returned for testing / dev convenience
    token = reg_data.get("verificationToken")
    assert token is not None

    # 2. Login attempt BEFORE email verification must fail with 403 Forbidden
    pre_verify_login = client.post(
        "/api/auth/login",
        json={
            "email": test_email,
            "password": "Password123!",
        },
    )
    assert pre_verify_login.status_code == 403
    assert "not been verified" in pre_verify_login.json()["detail"].lower()

    # 3. Test invalid or tampered verification token
    bad_token_res = client.get("/api/auth/verify-email?token=invalid.tampered.token")
    assert bad_token_res.status_code == 400

    # 4. Verify email using the valid signed token
    verify_res = client.get(f"/api/auth/verify-email?token={token}")
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["success"] is True
    assert verify_data["user"]["isEmailVerified"] is True
    session_cookie = verify_res.cookies.get("wellqc_session")
    assert session_cookie is not None

    # 5. Login with correct credentials AFTER email verification succeeds
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
    assert login_data["user"]["isEmailVerified"] is True

    # 6. Login with incorrect password returns 401 Unauthorized
    bad_res = client.post(
        "/api/auth/login",
        json={
            "email": test_email,
            "password": "WrongPassword!",
        },
    )
    assert bad_res.status_code == 401

    # 7. Check /api/auth/me with session cookie
    me_res = client.get("/api/auth/me", cookies={"wellqc_session": session_cookie})
    assert me_res.status_code == 200
    assert me_res.json()["user"]["email"] == test_email
    assert me_res.json()["user"]["isEmailVerified"] is True

    # 8. Test resend verification endpoint (for existing verified user it gracefully succeeds)
    resend_res = client.post(
        "/api/auth/resend-verification",
        json={"email": test_email},
    )
    assert resend_res.status_code == 200
    assert resend_res.json()["success"] is True

    # 9. Check /api/auth/logout
    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == 200
    assert logout_res.json()["success"] is True

    # 10. Forgot password for non-existent email (anti-enumeration returns success)
    unknown_forgot = client.post(
        "/api/auth/forgot-password",
        json={"email": "nonexistent_subsurface_user@example.com"},
    )
    assert unknown_forgot.status_code == 200
    assert unknown_forgot.json()["success"] is True
    assert "resetToken" not in unknown_forgot.json()

    # 11. Forgot password for registered user
    forgot_res = client.post(
        "/api/auth/forgot-password",
        json={"email": test_email},
    )
    assert forgot_res.status_code == 200
    assert forgot_res.json()["success"] is True
    reset_token = forgot_res.json().get("resetToken")
    assert reset_token is not None

    # 12. Reset password with invalid / malformed token
    bad_reset = client.post(
        "/api/auth/reset-password",
        json={"token": "invalid.corrupt.token", "password": "BrandNewPassword123!"},
    )
    assert bad_reset.status_code == 400

    # 13. Reset password with password shorter than 8 chars
    short_pwd = client.post(
        "/api/auth/reset-password",
        json={"token": reset_token, "password": "short"},
    )
    assert short_pwd.status_code == 400

    # 14. Reset password with valid token and strong new password
    valid_reset = client.post(
        "/api/auth/reset-password",
        json={"token": reset_token, "password": "NewStrongPassword456!"},
    )
    assert valid_reset.status_code == 200
    assert valid_reset.json()["success"] is True

    # 15. Attempt login with old password must now fail with 401
    old_pwd_login = client.post(
        "/api/auth/login",
        json={"email": test_email, "password": "Password123!"},
    )
    assert old_pwd_login.status_code == 401

    # 16. Login with newly reset password succeeds with 200
    new_pwd_login = client.post(
        "/api/auth/login",
        json={"email": test_email, "password": "NewStrongPassword456!"},
    )
    assert new_pwd_login.status_code == 200
    assert new_pwd_login.json()["user"]["email"] == test_email
