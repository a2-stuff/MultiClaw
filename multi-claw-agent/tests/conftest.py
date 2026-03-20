import os
os.environ["MULTICLAW_AGENT_SECRET"] = "test-secret"

import pytest
from httpx import ASGITransport, AsyncClient
from src.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
