import hmac
import logging
import time
from collections import defaultdict
from fastapi import Depends, HTTPException, Request
from fastapi.security import APIKeyHeader
from src.config import settings

logger = logging.getLogger("uvicorn.error")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Simple in-memory rate limiting for failed auth
_failed_attempts: dict[str, list[float]] = defaultdict(list)
_MAX_FAILURES = 10
_WINDOW_SECONDS = 900  # 15 minutes
_MAX_TRACKED_IPS = 10000  # Prevent unbounded memory growth
_last_cleanup = time.time()

def _cleanup_stale_entries() -> None:
    """Periodically remove stale entries to prevent memory leak."""
    global _last_cleanup
    now = time.time()
    if now - _last_cleanup < 300:  # Cleanup every 5 minutes
        return
    _last_cleanup = now
    stale_ips = [ip for ip, attempts in _failed_attempts.items()
                 if not attempts or now - max(attempts) > _WINDOW_SECONDS]
    for ip in stale_ips:
        del _failed_attempts[ip]

def _check_rate_limit(client_ip: str) -> None:
    _cleanup_stale_entries()
    now = time.time()
    attempts = _failed_attempts[client_ip]
    # Prune old entries for this IP
    _failed_attempts[client_ip] = [t for t in attempts if now - t < _WINDOW_SECONDS]
    if len(_failed_attempts[client_ip]) >= _MAX_FAILURES:
        raise HTTPException(status_code=429, detail="Too many failed authentication attempts")
    # Evict oldest IP if we're tracking too many
    if len(_failed_attempts) > _MAX_TRACKED_IPS:
        oldest_ip = min(_failed_attempts, key=lambda ip: max(_failed_attempts[ip]) if _failed_attempts[ip] else 0)
        del _failed_attempts[oldest_ip]

def _record_failure(client_ip: str) -> None:
    _failed_attempts[client_ip].append(time.time())

async def require_api_key(request: Request, api_key: str | None = Depends(api_key_header)) -> str:
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)
    if not api_key or not settings.agent_secret:
        _record_failure(client_ip)
        logger.warning("Auth failure from %s: missing key", client_ip)
        raise HTTPException(status_code=403, detail="Missing or invalid API key")
    if not hmac.compare_digest(api_key, settings.agent_secret):
        _record_failure(client_ip)
        logger.warning("Auth failure from %s: invalid key", client_ip)
        raise HTTPException(status_code=403, detail="Missing or invalid API key")
    return api_key
