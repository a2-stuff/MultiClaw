import asyncio
import logging
import uuid
from datetime import datetime, timezone
from src.agent.core import AgentBrain
from src.agent.state import AgentState
from src.config import settings
from src.models import TaskRequest, TaskStatus

logger = logging.getLogger("uvicorn.error")


def _build_system_prompt(active_tools: list[dict], unavailable_plugins: list[dict]) -> str:
    """Build a system prompt that includes tool awareness."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    name = settings.agent_name or "MultiClaw Agent"

    if settings.identity:
        base = f"{settings.identity}\n\nCurrent date and time: {now}"
    else:
        base = (
            f"You are {name}, an AI agent managed by the MultiClaw platform. "
            f"The current date and time is {now}. "
            "You are helpful, accurate, and concise. "
            "Answer questions directly and to the point."
        )

    sections = [base]

    # Tell the LLM what tools it has
    if active_tools:
        tool_list = "\n".join(
            f"  - **{t['name']}**: {t.get('description', '')} (plugin: {t.get('plugin', 'unknown')})"
            for t in active_tools
        )
        sections.append(
            "## Available Tools\n"
            "You have the following tools available. Use them when the task requires it. "
            "Be efficient — only call tools when necessary and minimize redundant calls.\n"
            f"{tool_list}"
        )

    # Tell the LLM about plugins that exist but aren't installed
    if unavailable_plugins:
        plugin_list = "\n".join(
            f"  - **{p['name']}**: {p.get('description', 'No description')}"
            for p in unavailable_plugins
        )
        sections.append(
            "## Plugins Available But Not Installed\n"
            "The following plugins exist in the MultiClaw registry but are NOT installed "
            "on this agent. If the user's request would benefit from these capabilities, "
            "let them know which plugin(s) need to be installed and that an administrator "
            "can deploy them from the dashboard.\n"
            f"{plugin_list}"
        )

    return "\n\n".join(sections)


def _get_plugin_context() -> tuple[list[dict], list[dict]]:
    """Get active tools and unavailable plugin info from the plugin system.

    Returns:
        (active_tools, unavailable_plugins)
    """
    try:
        from src.api.plugins import plugin_loader, plugin_manager
    except ImportError:
        logger.warning("Could not import plugin system")
        return [], []

    # Active tools from loaded plugins
    active_tools = plugin_loader.get_all_tools()

    # Find plugins that are installed but not active (not loaded / disabled)
    all_plugin_names = set(plugin_manager.list_plugins())
    active_plugin_names = set(plugin_loader.active_plugins.keys())
    inactive_names = all_plugin_names - active_plugin_names

    unavailable_plugins = []
    for name in inactive_names:
        meta = plugin_manager.get_plugin(name)
        if meta:
            unavailable_plugins.append({
                "name": meta.get("name", name),
                "description": meta.get("description", ""),
            })

    return active_tools, unavailable_plugins


class TaskRecord:
    def __init__(self, task_id: str, request: TaskRequest):
        self.task_id = task_id
        self.request = request
        self.status = TaskStatus.QUEUED
        self.result: str | None = None
        self.error: str | None = None
        self.created_at = datetime.now(timezone.utc)
        self.completed_at: datetime | None = None
        self.tool_calls_log: list[dict] = []
        self.turns: int = 1
        self.usage: dict = {}


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
            if not record:
                continue
            record.status = TaskStatus.RUNNING
            self.state.start_task(task_id)
            try:
                result = await self._execute(record)
                record.result = result["output"]
                record.tool_calls_log = result.get("tool_calls_log", [])
                record.turns = result.get("turns", 1)
                record.usage = result.get("usage", {})
                record.status = TaskStatus.COMPLETED
                record.completed_at = datetime.now(timezone.utc)
            except Exception as e:
                logger.error(f"Task {task_id} failed: {e}")
                record.error = str(e)
                record.status = TaskStatus.FAILED
                record.completed_at = datetime.now(timezone.utc)
            finally:
                self.state.finish_task(task_id)
                self._queue.task_done()

    async def _execute(self, record: TaskRecord) -> dict:
        """Execute a task — agentic loop if tools available, single-shot otherwise."""
        active_tools, unavailable_plugins = _get_plugin_context()

        # Filter tools if the request specifies specific ones
        if record.request.tools:
            requested = set(record.request.tools)
            filtered_tools = [t for t in active_tools if t["name"] in requested]

            # Check if any requested tools aren't available
            available_names = {t["name"] for t in active_tools}
            missing = requested - available_names
            if missing:
                logger.warning(f"Task requested unavailable tools: {missing}")
        else:
            # Empty list = give the LLM all available tools
            filtered_tools = active_tools

        system = _build_system_prompt(filtered_tools, unavailable_plugins)

        # Use agentic loop (handles both tool and no-tool cases)
        return await self.brain.run_agentic(
            prompt=record.request.prompt,
            system=system,
            provider=record.request.provider,
            model=record.request.model,
            tools=filtered_tools if filtered_tools else None,
            max_turns=record.request.max_turns,
        )

    async def submit(self, request: TaskRequest) -> str:
        task_id = request.task_id or f"task-{uuid.uuid4().hex[:12]}"
        record = TaskRecord(task_id=task_id, request=request)
        self.tasks[task_id] = record
        await self._queue.put(task_id)
        return task_id

    def get_status(self, task_id: str) -> dict | None:
        record = self.tasks.get(task_id)
        if not record:
            return None
        return {
            "task_id": record.task_id,
            "status": record.status,
            "result": record.result,
            "error": record.error,
            "created_at": record.created_at.isoformat(),
            "completed_at": record.completed_at.isoformat() if record.completed_at else None,
            "tool_calls_log": record.tool_calls_log,
            "turns": record.turns,
            "usage": record.usage,
        }

    def list_tasks(self) -> list[dict]:
        return [self.get_status(tid) for tid in self.tasks]


task_runner = TaskRunner()
