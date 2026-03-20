import os
import sys
import subprocess
import asyncio
import logging
from pathlib import Path
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from src.auth import require_api_key
from src.config import settings

logger = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/api", dependencies=[Depends(require_api_key)])


@router.post("/self-update")
async def self_update():
    """Pull latest code from the agent's git repository."""
    repo_dir = settings.base_dir  # This is the multi-claw-agent directory

    # Check if it's a git repo
    git_dir = repo_dir / ".git"
    if not git_dir.exists():
        # Check parent directory (might be in MultiClaw root)
        repo_dir = repo_dir.parent
        git_dir = repo_dir / ".git"
        if not git_dir.exists():
            return JSONResponse(
                {"error": "Agent directory is not a git repository"},
                status_code=400
            )

    try:
        # Get current commit hash before pull
        before = subprocess.run(
            ["git", "-C", str(repo_dir), "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=10
        )
        before_hash = before.stdout.strip() if before.returncode == 0 else "unknown"

        # Get current branch
        branch = subprocess.run(
            ["git", "-C", str(repo_dir), "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=10
        )
        branch_name = branch.stdout.strip() if branch.returncode == 0 else "unknown"

        # Pull latest
        result = subprocess.run(
            ["git", "-C", str(repo_dir), "pull", "--ff-only"],
            capture_output=True, text=True, timeout=60
        )

        if result.returncode != 0:
            logger.warning("Self-update git pull failed: %s", result.stderr)
            return JSONResponse(
                {"error": "git pull failed", "updated": False},
                status_code=500
            )

        # Get new commit hash
        after = subprocess.run(
            ["git", "-C", str(repo_dir), "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=10
        )
        after_hash = after.stdout.strip() if after.returncode == 0 else "unknown"

        # Check if anything changed
        already_up_to_date = "Already up to date" in result.stdout

        # Get commit log of what changed
        changes = []
        if not already_up_to_date and before_hash != "unknown":
            log = subprocess.run(
                ["git", "-C", str(repo_dir), "log", "--oneline", f"{before_hash}..{after_hash}"],
                capture_output=True, text=True, timeout=10
            )
            if log.returncode == 0:
                changes = [line.strip() for line in log.stdout.strip().split("\n") if line.strip()]

        logger.info(f"Self-update: {before_hash} -> {after_hash} ({'no changes' if already_up_to_date else f'{len(changes)} new commits'})")

        return {
            "updated": True,
            "already_up_to_date": already_up_to_date,
            "branch": branch_name,
            "before": before_hash,
            "after": after_hash,
            "changes": changes,
            "restart_required": not already_up_to_date,
            "message": "Already up to date" if already_up_to_date else f"Updated from {before_hash} to {after_hash}. Restart agent to apply changes.",
        }
    except subprocess.TimeoutExpired:
        return JSONResponse({"error": "Update timed out", "updated": False}, status_code=504)
    except Exception as e:
        logger.error("Self-update error: %s", e)
        return JSONResponse({"error": "Update failed", "updated": False}, status_code=500)


@router.post("/restart")
async def restart_agent():
    """Restart the agent process."""
    logger.warning("Restart requested via API — shutting down in 1 second...")

    async def _do_restart():
        await asyncio.sleep(1)
        # Re-exec the current process
        os.execv(sys.executable, [sys.executable, "-m", "uvicorn", "src.main:app",
                                  "--host", settings.host, "--port", str(settings.port)])

    asyncio.create_task(_do_restart())
    return {"restarting": True, "message": "Agent will restart in 1 second"}
