import logging
from collections import deque
from fastapi import APIRouter, Depends, Query
from src.auth import require_api_key

router = APIRouter(prefix="/api/logs", dependencies=[Depends(require_api_key)])

_log_buffer: deque[dict] = deque(maxlen=1000)


class BufferHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        _log_buffer.append({
            "timestamp": record.created,
            "level": record.levelname,
            "logger": record.name,
            "message": self.format(record),
        })


def setup_log_capture():
    handler = BufferHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    handler.setLevel(logging.DEBUG)
    logging.getLogger().addHandler(handler)
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logging.getLogger(name).addHandler(handler)


@router.get("")
async def get_logs(
    limit: int = Query(default=100, ge=1, le=1000),
    level: str = Query(default=""),
):
    logs = list(_log_buffer)
    if level:
        level_upper = level.upper()
        logs = [l for l in logs if l["level"] == level_upper]
    logs.reverse()
    return logs[:limit]


@router.delete("")
async def clear_logs():
    _log_buffer.clear()
    return {"success": True}
