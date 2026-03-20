import asyncio
import json
import time
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from src.auth import require_api_key
from src.agent.task_runner import task_runner
from src.config import settings

router = APIRouter(prefix="/api", dependencies=[Depends(require_api_key)])

async def _status_event_generator(request: Request):
    while True:
        if await request.is_disconnected(): break
        status = {
            "agent_id": settings.agent_id, "agent_name": settings.agent_name,
            "status": task_runner.state.status, "active_tasks": task_runner.state.active_tasks,
            "task_ids": task_runner.state.get_task_ids(), "timestamp": time.time(),
        }
        yield f"event: status\ndata: {json.dumps(status)}\n\n"
        await asyncio.sleep(2)

@router.get("/stream")
async def stream_status(request: Request):
    return StreamingResponse(_status_event_generator(request), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

async def _task_stream_generator(task_id: str, request: Request):
    while True:
        if await request.is_disconnected(): break
        status = task_runner.get_status(task_id)
        if not status:
            yield f"event: error\ndata: {json.dumps({'error': 'Task not found'})}\n\n"
            break
        yield f"event: task_update\ndata: {json.dumps(status)}\n\n"
        if status["status"] in ("completed", "failed", "cancelled"): break
        await asyncio.sleep(1)

@router.get("/stream/tasks/{task_id}")
async def stream_task(task_id: str, request: Request):
    return StreamingResponse(_task_stream_generator(task_id, request), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
