import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from src.main import app
    return TestClient(app, raise_server_exceptions=False)


def test_accept_registration_missing_fields(client):
    resp = client.post("/api/tailscale/accept-registration", json={})
    # Pydantic validation returns 422 for missing required fields
    assert resp.status_code == 422


def test_accept_registration_non_tailscale_ip(client):
    resp = client.post(
        "/api/tailscale/accept-registration",
        json={"dashboard_url": "http://100.64.0.1:3000", "api_key": "mck_test"},
        headers={"X-Forwarded-For": "192.168.1.1"},
    )
    # Should reject non-Tailscale IPs
    assert resp.status_code == 403
