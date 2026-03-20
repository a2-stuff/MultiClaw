import time
from fastapi import APIRouter, Depends
from src.config import settings
from src.models import HealthResponse, TaskStatus
from src.auth import require_api_key
from src.system_info import get_system_info

router = APIRouter()
_start_time = time.time()
_version = "0.1.0"


def _get_task_stats(task_runner) -> dict:
    active = 0
    completed = 0
    failed = 0
    queued = 0
    for record in task_runner.tasks.values():
        if record.status == TaskStatus.RUNNING:
            active += 1
        elif record.status == TaskStatus.COMPLETED:
            completed += 1
        elif record.status == TaskStatus.FAILED:
            failed += 1
        elif record.status == TaskStatus.QUEUED:
            queued += 1
    return {
        "active": active,
        "completed": completed,
        "failed": failed,
        "queued": queued,
    }


@router.get("/health")
async def health():
    """Public health check - minimal information only."""
    return {
        "status": "healthy",
        "version": _version,
    }


@router.get("/health/detailed", dependencies=[Depends(require_api_key)])
async def health_detailed():
    """Protected detailed health - requires authentication."""
    from src.agent.task_runner import task_runner
    return {
        "status": "healthy",
        "agent_id": settings.agent_id,
        "agent_name": settings.agent_name,
        "version": _version,
        "uptime": time.time() - _start_time,
        "tasks": _get_task_stats(task_runner),
        "system": get_system_info(),
    }
