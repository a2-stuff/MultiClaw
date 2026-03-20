from fastapi import APIRouter, Depends, HTTPException
from src.auth import require_api_key
from src.agent.task_runner import task_runner
from src.models import TaskRequest

router = APIRouter(prefix="/api", dependencies=[Depends(require_api_key)])

@router.post("/tasks")
async def submit_task(request: TaskRequest):
    task_id = await task_runner.submit(request)
    return {"task_id": task_id, "status": "queued"}

@router.get("/tasks")
async def list_tasks():
    return task_runner.list_tasks()

@router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    status = task_runner.get_status(task_id)
    if not status: raise HTTPException(status_code=404, detail="Task not found")
    return status
