import pytest

@pytest.mark.asyncio
async def test_protected_endpoint_rejects_no_key(client):
    resp = await client.get("/api/status")
    assert resp.status_code == 403

@pytest.mark.asyncio
async def test_protected_endpoint_rejects_bad_key(client):
    resp = await client.get("/api/status", headers={"X-API-Key": "wrong-key"})
    assert resp.status_code == 403

@pytest.mark.asyncio
async def test_protected_endpoint_accepts_valid_key(client):
    resp = await client.get("/api/status", headers={"X-API-Key": "test-secret"})
    assert resp.status_code == 200
