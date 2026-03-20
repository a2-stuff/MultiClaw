import pytest


@pytest.mark.asyncio
async def test_config_push_accepts_api_key(client):
    resp = await client.post(
        "/api/config",
        json={"anthropic_api_key": "sk-ant-test-key-123"},
        headers={"X-API-Key": "test-secret"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["accepted"] is True


@pytest.mark.asyncio
async def test_config_push_requires_auth(client):
    resp = await client.post(
        "/api/config",
        json={"anthropic_api_key": "sk-ant-test-key-123"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_config_returns_current(client):
    await client.post(
        "/api/config",
        json={"anthropic_api_key": "sk-ant-pushed-key"},
        headers={"X-API-Key": "test-secret"},
    )
    resp = await client.get(
        "/api/config",
        headers={"X-API-Key": "test-secret"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "anthropic" in data["configured_providers"]
    assert "anthropic_api_key" not in data
