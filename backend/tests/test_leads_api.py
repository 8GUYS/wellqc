"""
Tests for Enterprise Lead Capture & Contact Inquiry Endpoints (`/api/leads`).
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.app.core.database import get_db
from backend.app.core.rate_limit import limiter
from backend.app.main import app
from backend.app.services import email as email_service


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
def mock_db_client():
    fake_db = MagicMock()

    def _override_db():
        yield fake_db

    app.dependency_overrides[get_db] = _override_db
    try:
        with TestClient(app) as client:
            yield client, fake_db
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_submit_demo_request_persists_lead_and_dispatches_emails(mock_db_client):
    client, fake_db = mock_db_client

    with (
        patch("backend.app.api.leads.get_effective_email_config", return_value={"provider": "DEV_LOGGER", "frontend_url": "https://wellqc.vercel.app"}),
        patch("backend.app.api.leads.resolve_lead_notification_email", return_value="admin@wellqcplus.com"),
        patch("backend.app.api.leads.send_demo_request_emails") as mock_send,
    ):
        res = client.post(
            "/api/leads/demo",
            json={
                "fullName": "Dr. Adaobi Okoro",
                "workEmail": "adaobi@seplatenergy.com",
                "company": "Seplat Energy",
                "jobTitle": "Lead Petrophysicist",
                "fleetSize": "250 – 1,000 Wells",
                "primaryObjective": "NUPRC Regulatory Compliance Filing",
                "timeframe": "This Week",
                "notes": "Need WQC-08-A certificates for 80 Niger Delta wells.",
            },
        )

    assert res.status_code == 201
    body = res.json()
    assert body["success"] is True

    # ActivityLog entry added and committed
    assert fake_db.add.called
    added_log = fake_db.add.call_args[0][0]
    assert added_log.action == "DEMO_REQUEST"
    assert added_log.targetType == "ENTERPRISE_LEAD"
    assert added_log.targetId == "adaobi@seplatenergy.com"
    assert fake_db.commit.called

    # Email dispatch scheduled and executed by TestClient
    mock_send.assert_called_once()
    call_kwargs = mock_send.call_args.kwargs
    assert call_kwargs["full_name"] == "Dr. Adaobi Okoro"
    assert call_kwargs["work_email"] == "adaobi@seplatenergy.com"
    assert call_kwargs["company"] == "Seplat Energy"
    assert call_kwargs["admin_email"] == "admin@wellqcplus.com"


def test_submit_demo_request_rejects_invalid_email(mock_db_client):
    client, _ = mock_db_client
    res = client.post(
        "/api/leads/demo",
        json={
            "fullName": "Test User",
            "workEmail": "not-an-email",
            "company": "Acme Oil",
        },
    )
    assert res.status_code == 400


def test_submit_contact_inquiry_persists_and_dispatches_emails(mock_db_client):
    client, fake_db = mock_db_client

    with (
        patch("backend.app.api.leads.get_effective_email_config", return_value={"provider": "DEV_LOGGER", "frontend_url": "https://wellqc.vercel.app"}),
        patch("backend.app.api.leads.resolve_lead_notification_email", return_value="support@wellqcplus.com"),
        patch("backend.app.api.leads.send_contact_inquiry_emails") as mock_send,
    ):
        res = client.post(
            "/api/leads/contact",
            json={
                "name": "Chidi Williams",
                "email": "chidi@operator.ng",
                "company": "Niger Delta E&P",
                "message": "Can WellQC run in an air-gapped VPC?",
            },
        )

    assert res.status_code == 201
    assert res.json()["success"] is True
    assert fake_db.add.called
    added_log = fake_db.add.call_args[0][0]
    assert added_log.action == "CONTACT_INQUIRY"
    assert added_log.targetType == "SUPPORT_INQUIRY"

    mock_send.assert_called_once()
    assert mock_send.call_args.kwargs["email"] == "chidi@operator.ng"
    assert mock_send.call_args.kwargs["admin_email"] == "support@wellqcplus.com"


def test_send_demo_request_emails_dispatches_admin_and_confirmation_via_emailjs():
    cfg = {
        "provider": "EMAILJS",
        "frontend_url": "https://wellqc.vercel.app",
        "emailjs_service_id": "service_test",
        "emailjs_template_id": "template_test",
        "emailjs_public_key": "pub_test",
        "emailjs_private_key": "priv_test",
    }
    with patch.object(email_service, "_send_via_emailjs", return_value={"id": "ok", "response": "OK"}) as mock_ejs:
        result = email_service.send_demo_request_emails(
            full_name="Engr. Tunde <Ops>",
            work_email="tunde@operator.com",
            company="Operator & Co",
            fleet_size="50 – 250 Wells",
            primary_objective="Automated QA",
            notes="Check <script> escaping",
            admin_email="sales@wellqcplus.com",
            config=cfg,
        )

    assert mock_ejs.call_count == 2
    assert result["adminNotification"]["transport"] == "emailjs"
    assert result["requesterConfirmation"]["transport"] == "emailjs"
    # Verify HTML escaping protects email HTML payload
    sent_html = mock_ejs.call_args_list[0].kwargs["html_content"]
    assert "<script>" not in sent_html
    assert "&lt;script&gt;" in sent_html


def test_list_leads_admin_access(mock_db_client):
    client, fake_db = mock_db_client
    admin_user = MagicMock(role="ADMIN")

    from backend.app.core.dependencies import get_current_user

    app.dependency_overrides[get_current_user] = lambda: admin_user
    try:
        mock_query = fake_db.query.return_value
        mock_filter = mock_query.filter.return_value
        mock_order = mock_filter.order_by.return_value
        mock_order.limit.return_value.all.return_value = [
            MagicMock(
                id="act_1",
                userName="Test Lead",
                userRole="LEAD",
                action="DEMO_REQUEST",
                targetType="ENTERPRISE_LEAD",
                targetId="lead@corp.com",
                details="Details",
                createdAt=None,
                ipAddress="127.0.0.1",
            )
        ]

        res = client.get("/api/leads")
        assert res.status_code == 200
        body = res.json()
        assert "leads" in body
        assert len(body["leads"]) == 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)

