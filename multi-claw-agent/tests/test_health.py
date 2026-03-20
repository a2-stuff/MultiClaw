import pytest

@pytest.mark.asyncio
async def test_health_returns_ok(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "agent_id" in data
    assert "uptime" in data

@pytest.mark.asyncio
async def test_health_includes_version(client):
    resp = await client.get("/health")
    data = resp.json()
    assert "version" in data
