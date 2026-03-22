import json
import logging
import os
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("uvicorn.error")

# Keep shell=True since arbitrary commands are by design,
# but use an allowlist to prevent leaking ANY secrets (not just MULTICLAW_*)
_SAFE_ENV_KEYS = {"PATH", "HOME", "LANG", "USER", "SHELL", "TERM", "HOSTNAME", "LC_ALL", "TZ", "TMPDIR"}

def _get_safe_env() -> dict[str, str]:
    """Return minimal safe environment — allowlist only, no secrets."""
    return {k: v for k, v in os.environ.items() if k in _SAFE_ENV_KEYS}

MAX_OUTPUT_BYTES = 2048
MAX_RUNS = 50
DEFAULT_TIMEOUT = 300
_VALID_JOB_ID = re.compile(r"^[\w\-]{1,128}$")


class CronExecutor:
    def __init__(self, runs_dir: Path):
        self.runs_dir = Path(runs_dir)
        self.runs_dir.mkdir(parents=True, exist_ok=True)

    def _history_path(self, job_id: str) -> Path:
        if not _VALID_JOB_ID.match(job_id):
            raise ValueError(f"Invalid job_id: {job_id!r}")
        return self.runs_dir / f"{job_id}.jsonl"

    def execute(self, job_id: str, command: str, timeout: int = DEFAULT_TIMEOUT) -> dict:
        started_at = datetime.now(timezone.utc).isoformat()
        start_time = time.monotonic()
        logger.info("Cron %s executing", job_id)
        try:
            result = subprocess.run(
                command, shell=True, capture_output=True, text=True, timeout=timeout,
                env=_get_safe_env(),
            )
            exit_code = result.returncode
            output = (result.stdout + result.stderr)[-MAX_OUTPUT_BYTES:]
        except subprocess.TimeoutExpired:
            exit_code = -1
            output = f"Command timed out after {timeout}s"
        except Exception as e:
            exit_code = -1
            output = str(e)

        duration_ms = int((time.monotonic() - start_time) * 1000)
        logger.info("Cron %s finished: exit=%d duration=%dms", job_id, exit_code, duration_ms)
        completed_at = datetime.now(timezone.utc).isoformat()

        run_entry = {
            "started_at": started_at,
            "completed_at": completed_at,
            "exit_code": exit_code,
            "output": output,
            "duration_ms": duration_ms,
        }
        self._append_run(job_id, run_entry)
        return run_entry

    def get_runs(self, job_id: str) -> list[dict]:
        history_file = self._history_path(job_id)
        if not history_file.exists():
            return []
        lines = history_file.read_text().strip().split("\n")
        return [json.loads(line) for line in lines if line.strip()]

    def delete_runs(self, job_id: str) -> None:
        history_file = self._history_path(job_id)
        if history_file.exists():
            history_file.unlink()

    def _append_run(self, job_id: str, entry: dict) -> None:
        history_file = self._history_path(job_id)
        entries: list[str] = []
        if history_file.exists():
            entries = [line for line in history_file.read_text().strip().split("\n") if line.strip()]
        entries.append(json.dumps(entry))
        if len(entries) > MAX_RUNS:
            entries = entries[-MAX_RUNS:]
        history_file.write_text("\n".join(entries) + "\n")
