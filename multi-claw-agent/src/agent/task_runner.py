import asyncio
import uuid
from datetime import datetime, timezone
from src.agent.core import AgentBrain
from src.agent.state import AgentState
from src.config import settings
from src.models import TaskRequest, TaskStatus


def _build_system_prompt() -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    name = settings.agent_name or "MultiClaw Agent"
    if settings.identity:
        return (
            f"{settings.identity}\n\n"
            f"Current date and time: {now}"
        )
    return (
        f"You are {name}, an AI agent managed by the MultiClaw platform. "
        f"The current date and time is {now}. "
        "You are helpful, accurate, and concise. "
        "Answer questions directly and to the point."
    )

class TaskRecord:
    def __init__(self, task_id: str, request: TaskRequest):
        self.task_id = task_id
        self.request = request
        self.status = TaskStatus.QUEUED
        self.result: str | None = None
        self.error: str | None = None
        self.created_at = datetime.now(timezone.utc)
        self.completed_at: datetime | None = None

class TaskRunner:
    def __init__(self):
        self.brain = AgentBrain()
        self.state = AgentState()
        self.tasks: dict[str, TaskRecord] = {}
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._worker_task: asyncio.Task | None = None

    def start(self):
        self._worker_task = asyncio.create_task(self._worker())

    async def stop(self):
        if self._worker_task:
            self._worker_task.cancel()

    async def _worker(self):
        while True:
            task_id = await self._queue.get()
            record = self.tasks.get(task_id)
            if not record: continue
            record.status = TaskStatus.RUNNING
            self.state.start_task(task_id)
            try:
                result = await self.brain.run(
                    prompt=record.request.prompt,
                    system=_build_system_prompt(),
                    provider=record.request.provider,
                    model=record.request.model,
                )
                record.result = result["output"]
                record.status = TaskStatus.COMPLETED
                record.completed_at = datetime.now(timezone.utc)
            except Exception as e:
                record.error = str(e)
                record.status = TaskStatus.FAILED
                record.completed_at = datetime.now(timezone.utc)
            finally:
                self.state.finish_task(task_id)
                self._queue.task_done()

    async def submit(self, request: TaskRequest) -> str:
        task_id = request.task_id or f"task-{uuid.uuid4().hex[:12]}"
        record = TaskRecord(task_id=task_id, request=request)
        self.tasks[task_id] = record
        await self._queue.put(task_id)
        return task_id

    def get_status(self, task_id: str) -> dict | None:
        record = self.tasks.get(task_id)
        if not record: return None
        return {
            "task_id": record.task_id, "status": record.status, "result": record.result,
            "error": record.error, "created_at": record.created_at.isoformat(),
            "completed_at": record.completed_at.isoformat() if record.completed_at else None,
        }

    def list_tasks(self) -> list[dict]:
        return [self.get_status(tid) for tid in self.tasks]

task_runner = TaskRunner()
