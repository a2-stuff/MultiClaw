import asyncio
import logging
from contextlib import asynccontextmanager

logger = logging.getLogger("uvicorn.error")
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx
from src.api.health import router as health_router
from src.api.tasks import router as tasks_router
from src.agent.task_runner import task_runner
from src.api.plugins import router as plugins_router, plugin_loader
from src.api.crons import router as crons_router, cron_manager
from src.config import settings


async def discover_dashboard_via_tailscale():
    """Try to find the dashboard on the tailnet."""
    if not settings.tailscale_enabled:
        return None
    try:
        from plugins.tailscale.discovery import discover_dashboard, get_tailscale_ip
        dashboard = await discover_dashboard()
        if dashboard:
            url = f"http://{dashboard['ip']}:{settings.tailscale_dashboard_port}"
            logger.info(f"Discovered dashboard via Tailscale at {url}")
            return url
    except Exception as e:
        logger.info(f"Tailscale dashboard discovery failed: {e}")
    return None


async def _try_connect(agent_url: str) -> bool:
    """Attempt a single connection to the dashboard. Returns True on success."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{settings.dashboard_url}/api/agents/connect",
                json={
                    "api_key": settings.api_key,
                    "agent_name": settings.agent_name,
                    "agent_url": agent_url,
                },
            )
        if resp.status_code == 200:
            data = resp.json()
            settings.agent_id = data["agent_id"]
            settings.agent_secret = data["agent_secret"]
            logger.info(f"Connected to dashboard as '{settings.agent_name}' (id: {settings.agent_id})")
            return True
        else:
            logger.info(f"Dashboard registration failed: {resp.status_code} {resp.text}")
            return False
    except Exception as e:
        logger.info(f"Could not reach dashboard: {e}")
        return False


async def register_with_dashboard():
    """Connect to dashboard on startup using API key, with retries."""
    if not settings.api_key:
        logger.info("No MULTICLAW_API_KEY set — skipping auto-register")
        return

    if not settings.dashboard_url:
        discovered = await discover_dashboard_via_tailscale()
        if discovered:
            settings.dashboard_url = discovered
        else:
            logger.info("No MULTICLAW_DASHBOARD_URL set and Tailscale discovery failed — skipping auto-register")
            return

    if settings.tailscale_enabled and not settings.agent_url:
        try:
            from plugins.tailscale.discovery import get_tailscale_ip
            ts_ip = await get_tailscale_ip()
            agent_url = f"http://{ts_ip}:{settings.port}"
        except Exception:
            agent_url = f"http://localhost:{settings.port}"
    else:
        agent_url = settings.agent_url or f"http://localhost:{settings.port}"

    logger.info(f"Connecting to dashboard at {settings.dashboard_url}...")
    delays = [0, 2, 5, 10, 20]
    for i, delay in enumerate(delays):
        if delay:
            await asyncio.sleep(delay)
        if await _try_connect(agent_url):
            return
        if i < len(delays) - 1:
            logger.info(f"Retrying connection in {delays[i + 1]}s...")
    logger.warning("Could not connect to dashboard after retries — agent will run without auth until restarted")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task_runner.start()
    plugin_loader.load_all_enabled()
    cron_manager.start_scheduler()
    if settings.auto_register:
        await register_with_dashboard()
    yield
    cron_manager.shutdown_scheduler()
    await task_runner.stop()

def _get_cors_origins() -> list[str]:
    if settings.cors_origins:
        return [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    if settings.dashboard_url:
        return [settings.dashboard_url]
    return []


app = FastAPI(title="MultiClaw Agent", version="0.1.0", lifespan=lifespan)
from src.api.logs import router as logs_router, setup_log_capture
setup_log_capture()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["X-API-Key", "Content-Type", "Authorization"],
    allow_credentials=False,
)
app.include_router(health_router)
app.include_router(tasks_router)
from src.api.stream import router as stream_router
app.include_router(stream_router)
from src.api.skills import router as skills_router
app.include_router(skills_router)
app.include_router(plugins_router)
app.include_router(crons_router)
from src.api.config_endpoint import router as config_router
app.include_router(config_router)
from src.api.tailscale import router as tailscale_router
app.include_router(tailscale_router)
from src.api.git_plugins import router as git_plugins_router
app.include_router(git_plugins_router)
from src.api.self_update import router as self_update_router
app.include_router(self_update_router)
app.include_router(logs_router)
