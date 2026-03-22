from __future__ import annotations

import asyncio
import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from croniter import croniter

from src.crons.executor import CronExecutor


class CronManager:
    def __init__(self, crons_file: Path, runs_dir: Path):
        self.crons_file = Path(crons_file)
        self.runs_dir = Path(runs_dir)
        self.executor = CronExecutor(self.runs_dir)
        self._lock = threading.Lock()
        self._scheduler: AsyncIOScheduler | None = None
        self._crons: list[dict] = self._load()

    def start_scheduler(self) -> None:
        self._scheduler = AsyncIOScheduler(timezone="UTC")
        for cron in self._crons:
            if cron["enabled"]:
                self._add_to_scheduler(cron)
        self._scheduler.start()

    def shutdown_scheduler(self) -> None:
        if self._scheduler:
            self._scheduler.shutdown(wait=False)

    def create(self, name: str, command: str, schedule: str, enabled: bool = True) -> dict:
        if not name.strip():
            raise ValueError("name is required")
        if not command.strip():
            raise ValueError("command is required")
        self._validate_schedule(schedule)
        cron = {
            "id": str(uuid.uuid4()),
            "name": name.strip(),
            "command": command.strip(),
            "schedule": schedule.strip(),
            "enabled": enabled,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": None,
            "last_run_at": None,
            "last_exit_code": None,
            "last_output": None,
            "next_run_at": self._compute_next_run(schedule),
        }
        with self._lock:
            self._crons.append(cron)
            self._save()
        if enabled and self._scheduler:
            self._add_to_scheduler(cron)
        return cron

    def list(self) -> list[dict]:
        with self._lock:
            return list(self._crons)

    def get(self, cron_id: str) -> dict | None:
        with self._lock:
            return next((c for c in self._crons if c["id"] == cron_id), None)

    def update(self, cron_id: str, **kwargs) -> dict | None:
        if "schedule" in kwargs:
            self._validate_schedule(kwargs["schedule"])
        with self._lock:
            cron = next((c for c in self._crons if c["id"] == cron_id), None)
            if not cron:
                return None
            for key in ("name", "command", "schedule", "enabled"):
                if key in kwargs:
                    cron[key] = kwargs[key]
            cron["updated_at"] = datetime.now(timezone.utc).isoformat()
            if "schedule" in kwargs:
                cron["next_run_at"] = self._compute_next_run(cron["schedule"])
            self._save()
        if self._scheduler:
            self._remove_from_scheduler(cron_id)
            if cron["enabled"]:
                self._add_to_scheduler(cron)
        return cron

    def delete(self, cron_id: str) -> bool:
        with self._lock:
            before = len(self._crons)
            self._crons = [c for c in self._crons if c["id"] != cron_id]
            if len(self._crons) == before:
                return False
            self._save()
        if self._scheduler:
            self._remove_from_scheduler(cron_id)
        self.executor.delete_runs(cron_id)
        return True

    def trigger(self, cron_id: str) -> bool:
        cron = self.get(cron_id)
        if not cron:
            return False
        if self._scheduler:
            self._scheduler.add_job(
                self._run_cron, args=[cron], id=f"manual-{cron_id}",
                replace_existing=True,
            )
        return True

    async def _run_cron(self, cron: dict) -> None:
        result = await asyncio.to_thread(self.executor.execute, cron["id"], cron["command"])
        with self._lock:
            live = next((c for c in self._crons if c["id"] == cron["id"]), None)
            if live:
                live["last_run_at"] = result["started_at"]
                live["last_exit_code"] = result["exit_code"]
                live["last_output"] = result["output"]
                live["next_run_at"] = self._compute_next_run(live["schedule"])
                self._save()

    def _add_to_scheduler(self, cron: dict) -> None:
        if not self._scheduler:
            return
        parts = cron["schedule"].split()
        trigger = CronTrigger(
            minute=parts[0], hour=parts[1], day=parts[2],
            month=parts[3], day_of_week=parts[4], timezone="UTC",
        )
        self._scheduler.add_job(
            self._run_cron, trigger=trigger, args=[cron],
            id=cron["id"], replace_existing=True, misfire_grace_time=60,
        )

    def _remove_from_scheduler(self, cron_id: str) -> None:
        if not self._scheduler:
            return
        try:
            self._scheduler.remove_job(cron_id)
        except Exception:
            pass

    def _validate_schedule(self, schedule: str) -> None:
        try:
            croniter(schedule)
        except (ValueError, KeyError):
            raise ValueError(f"Invalid cron expression: {schedule}")

    def _compute_next_run(self, schedule: str) -> str | None:
        try:
            cron = croniter(schedule, datetime.now(timezone.utc))
            return cron.get_next(datetime).isoformat()
        except Exception:
            return None

    def _load(self) -> list[dict]:
        if not self.crons_file.exists():
            return []
        try:
            data = json.loads(self.crons_file.read_text())
            return data if isinstance(data, list) else []
        except Exception:
            return []

    def _save(self) -> None:
        self.crons_file.write_text(json.dumps(self._crons, indent=2, default=str))
