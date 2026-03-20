from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from src.auth import require_api_key
from src.crons.manager import CronManager
from src.config import settings

cron_manager = CronManager(
    crons_file=settings.base_dir / "crons.json",
    runs_dir=settings.base_dir / "cron_runs",
)

router = APIRouter(prefix="/api/crons", dependencies=[Depends(require_api_key)])


class CreateCronRequest(BaseModel):
    name: str
    command: str
    schedule: str
    enabled: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if len(v) > 255:
            raise ValueError("Name must be 255 characters or less")
        return v.strip()

    @field_validator("command")
    @classmethod
    def validate_command(cls, v: str) -> str:
        if len(v) > 4096:
            raise ValueError("Command must be 4096 characters or less")
        return v.strip()


class UpdateCronRequest(BaseModel):
    name: str | None = None
    command: str | None = None
    schedule: str | None = None
    enabled: bool | None = None


@router.get("/")
async def list_crons():
    return cron_manager.list()


@router.post("/", status_code=201)
async def create_cron(req: CreateCronRequest):
    try:
        job = cron_manager.create(req.name, req.command, req.schedule, req.enabled)
        return job
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{cron_id}")
async def get_cron(cron_id: str):
    job = cron_manager.get(cron_id)
    if not job:
        raise HTTPException(status_code=404, detail="Cron job not found")
    return job


@router.put("/{cron_id}")
async def update_cron(cron_id: str, req: UpdateCronRequest):
    kwargs = {k: v for k, v in req.model_dump().items() if v is not None}
    if not kwargs:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        job = cron_manager.update(cron_id, **kwargs)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not job:
        raise HTTPException(status_code=404, detail="Cron job not found")
    return job


@router.delete("/{cron_id}")
async def delete_cron(cron_id: str):
    if not cron_manager.delete(cron_id):
        raise HTTPException(status_code=404, detail="Cron job not found")
    return {"deleted": True}


@router.post("/{cron_id}/run")
async def trigger_cron(cron_id: str):
    if not cron_manager.trigger(cron_id):
        raise HTTPException(status_code=404, detail="Cron job not found")
    return {"triggered": True}


@router.get("/{cron_id}/runs")
async def get_cron_runs(cron_id: str):
    job = cron_manager.get(cron_id)
    if not job:
        raise HTTPException(status_code=404, detail="Cron job not found")
    return {"runs": cron_manager.executor.get_runs(cron_id)}
