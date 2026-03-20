from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.auth import require_api_key
from src.config import settings

router = APIRouter(prefix="/api/config", dependencies=[Depends(require_api_key)])


class ConfigPush(BaseModel):
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    google_api_key: str | None = None
    openrouter_api_key: str | None = None
    deepseek_api_key: str | None = None
    default_model: str | None = None
    default_provider: str | None = None
    identity: str | None = None


@router.post("")
async def receive_config(config: ConfigPush):
    changed = False
    key_map = {
        "anthropic_api_key": "_dashboard_anthropic_key",
        "openai_api_key": "_dashboard_openai_key",
        "google_api_key": "_dashboard_google_key",
        "openrouter_api_key": "_dashboard_openrouter_key",
        "deepseek_api_key": "_dashboard_deepseek_key",
    }
    for field, attr in key_map.items():
        value = getattr(config, field, None)
        if value is not None:
            setattr(settings, attr, value)
            changed = True
    if config.default_model is not None:
        settings.default_model = config.default_model
        changed = True
    if config.default_provider is not None:
        settings.default_provider = config.default_provider
        changed = True
    if config.identity is not None:
        settings.identity = config.identity
        changed = True
    if changed:
        from src.agent.task_runner import task_runner
        task_runner.brain.refresh_client()
    return {"accepted": True, "changed": changed}


@router.get("")
async def get_config():
    from src.agent.task_runner import task_runner
    return task_runner.brain.get_status()
