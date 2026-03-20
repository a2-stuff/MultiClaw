import threading
from datetime import datetime, timezone
from src.models import AgentStatus

class AgentState:
    def __init__(self):
        self._lock = threading.Lock()
        self._active_tasks: dict[str, datetime] = {}
        self.status: str = AgentStatus.IDLE

    @property
    def active_tasks(self) -> int:
        return len(self._active_tasks)

    def start_task(self, task_id: str):
        with self._lock:
            self._active_tasks[task_id] = datetime.now(timezone.utc)
            self.status = AgentStatus.BUSY

    def finish_task(self, task_id: str):
        with self._lock:
            self._active_tasks.pop(task_id, None)
            if not self._active_tasks:
                self.status = AgentStatus.IDLE

    def get_task_ids(self) -> list[str]:
        return list(self._active_tasks.keys())
