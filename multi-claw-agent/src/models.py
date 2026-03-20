from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel, Field

class AgentStatus(str, Enum):
    IDLE = "idle"
    BUSY = "busy"
    ERROR = "error"
    OFFLINE = "offline"

class HealthResponse(BaseModel):
    status: str = "healthy"
    agent_id: str
    agent_name: str
    version: str
    uptime: float
    current_status: AgentStatus = AgentStatus.IDLE
    active_tasks: int = 0
    loaded_skills: int = 0
    loaded_plugins: int = 0

class TaskRequest(BaseModel):
    task_id: str = ""
    prompt: str
    tools: list[str] = Field(default_factory=list)
    max_turns: int = 10
    stream: bool = True
    provider: str = ""
    model: str = ""

class TaskStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class TaskResponse(BaseModel):
    task_id: str
    status: TaskStatus
    result: str | None = None
    error: str | None = None
    created_at: datetime
    completed_at: datetime | None = None

class SkillMetadata(BaseModel):
    name: str
    description: str = ""
    version: str = "0.1.0"
    author: str = ""
    installed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    entry_point: str = "main.py"

class PluginMetadata(BaseModel):
    name: str
    description: str = ""
    version: str = "0.1.0"
    author: str = ""
    installed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    enabled: bool = True
    entry_point: str = "main.py"
    dependencies: list[str] = Field(default_factory=list)

class SkillInfo(BaseModel):
    name: str
    description: str = ""

class GitPluginMetadata(BaseModel):
    name: str
    slug: str
    repo_url: str
    type: str = "git-plugin"
    installed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    enabled: bool = True
    skills: list[SkillInfo] = Field(default_factory=list)
