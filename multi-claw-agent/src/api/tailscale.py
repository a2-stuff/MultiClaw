import asyncio
import logging
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from src.config import settings

logger = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/api/tailscale", tags=["tailscale"])


class AcceptRegistrationRequest(BaseModel):
    dashboard_url: str
    api_key: str


def is_tailscale_ip(ip: str) -> bool:
    """Check if IP is in Tailscale CGNAT range (100.64.0.0/10)."""
    if not ip:
        return False
    parts = ip.split(".")
    if len(parts) != 4:
        return False
    try:
        first, second = int(parts[0]), int(parts[1])
        return first == 100 and 64 <= second <= 127
    except ValueError:
        return False


@router.post("/accept-registration")
async def accept_registration(req: AcceptRegistrationRequest, request: Request):
    # Validate source is a Tailscale IP
    client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    if not client_ip:
        client_ip = request.client.host if request.client else ""

    if not is_tailscale_ip(client_ip):
        return JSONResponse({"error": "Only Tailscale connections accepted"}, status_code=403)

    # Store the API key and dashboard URL for registration
    settings.api_key = req.api_key
    settings.dashboard_url = req.dashboard_url
    settings.auto_register = True

    logger.info(f"Accepted registration push from dashboard at {req.dashboard_url}")

    # Trigger registration in background
    from src.main import register_with_dashboard
    asyncio.create_task(register_with_dashboard())

    return {"status": "registration_initiated"}
