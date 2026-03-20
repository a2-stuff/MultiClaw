import json
from pathlib import Path
from unittest.mock import patch, MagicMock
import subprocess
import pytest
from src.crons.executor import CronExecutor


@pytest.fixture
def runs_dir(tmp_path):
    d = tmp_path / "cron_runs"
    d.mkdir()
    return d


@pytest.fixture
def executor(runs_dir):
    return CronExecutor(runs_dir)


def test_execute_success(executor):
    result = executor.execute("job-1", "echo hello")
    assert result["exit_code"] == 0
    assert "hello" in result["output"]
    assert result["duration_ms"] >= 0
    assert result["started_at"] is not None
    assert result["completed_at"] is not None


def test_execute_failure(executor):
    result = executor.execute("job-2", "exit 1")
    assert result["exit_code"] == 1


def test_execute_timeout(executor):
    result = executor.execute("job-3", "sleep 10", timeout=1)
    assert result["exit_code"] == -1
    assert "timed out" in result["output"].lower()


def test_execute_output_truncated(executor):
    result = executor.execute("job-4", "python3 -c \"print('x' * 5000)\"")
    assert len(result["output"]) <= 2048


def test_run_history_appended(executor, runs_dir):
    executor.execute("job-5", "echo run1")
    executor.execute("job-5", "echo run2")
    history_file = runs_dir / "job-5.jsonl"
    assert history_file.exists()
    lines = history_file.read_text().strip().split("\n")
    assert len(lines) == 2
    run1 = json.loads(lines[0])
    assert run1["exit_code"] == 0


def test_run_history_pruned_to_50(executor, runs_dir):
    history_file = runs_dir / "job-6.jsonl"
    with history_file.open("a") as fh:
        for i in range(55):
            fh.write(json.dumps({"exit_code": 0, "output": f"run {i}"}) + "\n")
    executor.execute("job-6", "echo new")
    lines = history_file.read_text().strip().split("\n")
    assert len(lines) == 50
    last = json.loads(lines[-1])
    assert "new" in last["output"]


def test_get_runs(executor, runs_dir):
    executor.execute("job-7", "echo test")
    runs = executor.get_runs("job-7")
    assert len(runs) == 1
    assert runs[0]["exit_code"] == 0


def test_get_runs_empty(executor):
    assert executor.get_runs("nonexistent") == []


def test_delete_runs(executor, runs_dir):
    executor.execute("job-8", "echo test")
    assert (runs_dir / "job-8.jsonl").exists()
    executor.delete_runs("job-8")
    assert not (runs_dir / "job-8.jsonl").exists()


def test_delete_runs_nonexistent(executor):
    executor.delete_runs("nonexistent-job")  # must not raise


def test_execute_invalid_job_id(executor):
    with pytest.raises(ValueError):
        executor.execute("../../etc/passwd", "echo x")


# ── CronManager tests ──────────────────────────────────────────────────────

from src.crons.manager import CronManager


@pytest.fixture
def cron_manager(tmp_path):
    crons_file = tmp_path / "crons.json"
    runs_dir = tmp_path / "cron_runs"
    return CronManager(crons_file, runs_dir)


def test_create_cron(cron_manager):
    job = cron_manager.create("Test Job", "echo hi", "*/5 * * * *")
    assert job["name"] == "Test Job"
    assert job["command"] == "echo hi"
    assert job["schedule"] == "*/5 * * * *"
    assert job["enabled"] is True
    assert job["id"] is not None
    assert job["next_run_at"] is not None


def test_create_invalid_schedule(cron_manager):
    with pytest.raises(ValueError, match="Invalid cron expression"):
        cron_manager.create("Bad", "echo x", "not a cron")


def test_create_empty_name(cron_manager):
    with pytest.raises(ValueError, match="name"):
        cron_manager.create("", "echo x", "* * * * *")


def test_create_empty_command(cron_manager):
    with pytest.raises(ValueError, match="command"):
        cron_manager.create("Test", "", "* * * * *")


def test_list_crons(cron_manager):
    cron_manager.create("Job 1", "echo 1", "* * * * *")
    cron_manager.create("Job 2", "echo 2", "0 * * * *")
    jobs = cron_manager.list()
    assert len(jobs) == 2


def test_get_cron(cron_manager):
    job = cron_manager.create("Test", "echo test", "* * * * *")
    found = cron_manager.get(job["id"])
    assert found is not None
    assert found["name"] == "Test"


def test_get_nonexistent(cron_manager):
    assert cron_manager.get("nonexistent") is None


def test_update_cron(cron_manager):
    job = cron_manager.create("Old Name", "echo old", "* * * * *")
    updated = cron_manager.update(job["id"], name="New Name", command="echo new")
    assert updated["name"] == "New Name"
    assert updated["command"] == "echo new"
    assert updated["updated_at"] is not None


def test_update_invalid_schedule(cron_manager):
    job = cron_manager.create("Test", "echo x", "* * * * *")
    with pytest.raises(ValueError, match="Invalid cron expression"):
        cron_manager.update(job["id"], schedule="bad")


def test_update_nonexistent(cron_manager):
    assert cron_manager.update("nonexistent", name="x") is None


def test_delete_cron(cron_manager):
    job = cron_manager.create("Test", "echo x", "* * * * *")
    assert cron_manager.delete(job["id"]) is True
    assert cron_manager.get(job["id"]) is None


def test_delete_nonexistent(cron_manager):
    assert cron_manager.delete("nonexistent") is False


def test_persistence(tmp_path):
    crons_file = tmp_path / "crons.json"
    runs_dir = tmp_path / "cron_runs"
    mgr1 = CronManager(crons_file, runs_dir)
    mgr1.create("Persist", "echo persist", "0 2 * * *")
    mgr2 = CronManager(crons_file, runs_dir)
    jobs = mgr2.list()
    assert len(jobs) == 1
    assert jobs[0]["name"] == "Persist"


def test_disable_enable(cron_manager):
    job = cron_manager.create("Test", "echo x", "* * * * *")
    updated = cron_manager.update(job["id"], enabled=False)
    assert updated["enabled"] is False
    updated = cron_manager.update(job["id"], enabled=True)
    assert updated["enabled"] is True


# ── Cron API tests ────────────────────────────────────────────────────────

from httpx import AsyncClient, ASGITransport
from src.main import app
from src.config import settings


@pytest.fixture
def api_headers():
    return {"X-API-Key": settings.agent_secret}


@pytest.mark.asyncio
async def test_api_create_cron(api_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/crons/", json={
            "name": "API Test", "command": "echo api", "schedule": "*/10 * * * *"
        }, headers=api_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "API Test"
    assert data["id"] is not None


@pytest.mark.asyncio
async def test_api_create_invalid_schedule(api_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/crons/", json={
            "name": "Bad", "command": "echo x", "schedule": "not valid"
        }, headers=api_headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_api_list_crons(api_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/crons/", headers=api_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_api_get_cron(api_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        create = await client.post("/api/crons/", json={
            "name": "Get Test", "command": "echo get", "schedule": "0 * * * *"
        }, headers=api_headers)
        cron_id = create.json()["id"]
        resp = await client.get(f"/api/crons/{cron_id}", headers=api_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Get Test"


@pytest.mark.asyncio
async def test_api_get_nonexistent(api_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/crons/nonexistent", headers=api_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_api_update_cron(api_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        create = await client.post("/api/crons/", json={
            "name": "Update Test", "command": "echo old", "schedule": "0 * * * *"
        }, headers=api_headers)
        cron_id = create.json()["id"]
        resp = await client.put(f"/api/crons/{cron_id}", json={
            "name": "Updated", "command": "echo new"
        }, headers=api_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated"


@pytest.mark.asyncio
async def test_api_delete_cron(api_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        create = await client.post("/api/crons/", json={
            "name": "Delete Test", "command": "echo del", "schedule": "0 * * * *"
        }, headers=api_headers)
        cron_id = create.json()["id"]
        resp = await client.delete(f"/api/crons/{cron_id}", headers=api_headers)
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True


@pytest.mark.asyncio
async def test_api_trigger_cron(api_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        create = await client.post("/api/crons/", json={
            "name": "Trigger Test", "command": "echo trigger", "schedule": "0 * * * *"
        }, headers=api_headers)
        cron_id = create.json()["id"]
        resp = await client.post(f"/api/crons/{cron_id}/run", headers=api_headers)
    assert resp.status_code == 200
    assert resp.json()["triggered"] is True


@pytest.mark.asyncio
async def test_api_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/crons/")
    assert resp.status_code == 403
