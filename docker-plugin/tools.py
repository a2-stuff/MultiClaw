import asyncio
import json
import logging

logger = logging.getLogger(__name__)


async def _run_docker(*args: str) -> tuple[int, str, str]:
    """Run a docker command and return (returncode, stdout, stderr)."""
    proc = await asyncio.create_subprocess_exec(
        "docker", *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return proc.returncode, stdout.decode(), stderr.decode()


def _parse_json_lines(output: str) -> list[dict]:
    """Parse newline-delimited JSON output (docker --format json produces one JSON object per line)."""
    results = []
    for line in output.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            results.append(json.loads(line))
        except json.JSONDecodeError:
            logger.warning(f"Could not parse JSON line: {line!r}")
    return results


async def docker_list_containers() -> list[dict]:
    """List all containers (running and stopped) using `docker ps -a --format json`."""
    returncode, stdout, stderr = await _run_docker("ps", "-a", "--format", "json")
    if returncode != 0:
        logger.error(f"docker ps failed: {stderr}")
        return []
    return _parse_json_lines(stdout)


async def docker_run(
    image: str,
    name: str | None = None,
    ports: list[str] | None = None,
    volumes: list[str] | None = None,
    env: list[str] | None = None,
    detach: bool = True,
    restart: str | None = None,
) -> dict:
    """Run a Docker container. Returns {success, container_id} or {success, error}."""
    cmd = ["run"]
    if detach:
        cmd.append("-d")
    if name:
        cmd.extend(["--name", name])
    if restart:
        cmd.extend(["--restart", restart])
    for port in ports or []:
        cmd.extend(["-p", port])
    for volume in volumes or []:
        cmd.extend(["-v", volume])
    for var in env or []:
        cmd.extend(["-e", var])
    cmd.append(image)

    returncode, stdout, stderr = await _run_docker(*cmd)
    if returncode != 0:
        return {"success": False, "error": stderr.strip()}
    return {"success": True, "container_id": stdout.strip()}


async def docker_stop(container: str) -> dict:
    """Stop a running container. Returns {success} or {success, error}."""
    returncode, stdout, stderr = await _run_docker("stop", container)
    if returncode != 0:
        return {"success": False, "error": stderr.strip()}
    return {"success": True}


async def docker_start(container: str) -> dict:
    """Start a stopped container. Returns {success} or {success, error}."""
    returncode, stdout, stderr = await _run_docker("start", container)
    if returncode != 0:
        return {"success": False, "error": stderr.strip()}
    return {"success": True}


async def docker_remove(container: str) -> dict:
    """Remove a container. Returns {success} or {success, error}."""
    returncode, stdout, stderr = await _run_docker("rm", container)
    if returncode != 0:
        return {"success": False, "error": stderr.strip()}
    return {"success": True}


async def docker_logs(container: str, tail: int = 100) -> dict:
    """Fetch container logs. Returns {logs} or {logs, error}."""
    returncode, stdout, stderr = await _run_docker("logs", "--tail", str(tail), container)
    if returncode != 0:
        return {"logs": stdout, "error": stderr.strip()}
    return {"logs": stdout}


async def docker_pull(image: str) -> dict:
    """Pull a Docker image. Returns {success, output} or {success, output, error}."""
    returncode, stdout, stderr = await _run_docker("pull", image)
    if returncode != 0:
        return {"success": False, "output": stdout, "error": stderr.strip()}
    return {"success": True, "output": stdout}


async def docker_images() -> list[dict]:
    """List all Docker images using `docker images --format json`."""
    returncode, stdout, stderr = await _run_docker("images", "--format", "json")
    if returncode != 0:
        logger.error(f"docker images failed: {stderr}")
        return []
    return _parse_json_lines(stdout)


async def docker_stats() -> list[dict]:
    """Get resource usage stats for running containers using `docker stats --no-stream --format json`."""
    returncode, stdout, stderr = await _run_docker("stats", "--no-stream", "--format", "json")
    if returncode != 0:
        logger.error(f"docker stats failed: {stderr}")
        return []
    return _parse_json_lines(stdout)
