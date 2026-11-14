"""
CE1-34 — Tests for Prometheus /metrics endpoint.

Verifies:
- GET /metrics returns 200
- Content-Type is text/plain (Prometheus exposition format)
- Response body contains expected metric families
"""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from backend.app.main import app
    with TestClient(app) as c:
        yield c


def test_metrics_returns_200(client):
    response = client.get("/metrics")
    assert response.status_code == 200


def test_metrics_content_type_is_plain_text(client):
    response = client.get("/metrics")
    assert "text/plain" in response.headers.get("content-type", "")


def test_metrics_contains_http_request_counters(client):
    # Hit health endpoint first to ensure at least one instrumented request
    client.get("/api/health")
    response = client.get("/metrics")
    body = response.text
    # Prometheus instrumentator emits http_requests_total
    assert "http_requests" in body or "http_request" in body


def test_metrics_excluded_from_openapi_schema(client):
    response = client.get("/openapi.json")
    schema = response.json()
    paths = schema.get("paths", {})
    assert "/metrics" not in paths, "/metrics must not appear in Swagger UI"
