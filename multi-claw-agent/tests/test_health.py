import pytest

@pytest.mark.asyncio
async def test_health_returns_ok(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "version" in data

@pytest.mark.asyncio
async def test_health_detailed_requires_auth(client):
    resp = await client.get("/health/detailed")
    assert resp.status_code == 403

@pytest.mark.asyncio
async def test_health_detailed_returns_full_info(client):
    resp = await client.get("/health/detailed", headers={"X-API-Key": "test-secret"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "agent_id" in data
    assert "uptime" in data
    assert "version" in data
