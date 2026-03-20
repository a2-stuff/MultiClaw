import pytest
from unittest.mock import patch, AsyncMock

@pytest.mark.asyncio
async def test_submit_task(client):
    with patch("src.api.tasks.task_runner") as mock_runner:
        mock_runner.submit = AsyncMock(return_value="task-123")
        resp = await client.post("/api/tasks", json={"prompt": "Hello"}, headers={"X-API-Key": "test-secret"})
    assert resp.status_code == 200
    assert resp.json()["task_id"] == "task-123"
    assert resp.json()["status"] == "queued"

@pytest.mark.asyncio
async def test_get_task_status(client):
    with patch("src.api.tasks.task_runner") as mock_runner:
        mock_runner.get_status.return_value = {"task_id": "task-123", "status": "completed", "result": "Done"}
        resp = await client.get("/api/tasks/task-123", headers={"X-API-Key": "test-secret"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"

@pytest.mark.asyncio
async def test_list_tasks(client):
    with patch("src.api.tasks.task_runner") as mock_runner:
        mock_runner.list_tasks.return_value = []
        resp = await client.get("/api/tasks", headers={"X-API-Key": "test-secret"})
    assert resp.status_code == 200
    assert resp.json() == []
