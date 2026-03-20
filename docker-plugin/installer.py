import logging
import subprocess

logger = logging.getLogger(__name__)


def is_docker_installed_sync() -> bool:
    """Check if Docker CLI is available by running `docker --version`."""
    try:
        result = subprocess.run(
            ["docker", "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.returncode == 0
    except FileNotFoundError:
        return False
    except subprocess.TimeoutExpired:
        logger.warning("Timed out checking docker --version")
        return False


def is_docker_running_sync() -> bool:
    """Check if Docker daemon is running by running `docker info`."""
    try:
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            text=True,
            timeout=15,
        )
        return result.returncode == 0
    except FileNotFoundError:
        return False
    except subprocess.TimeoutExpired:
        logger.warning("Timed out checking docker info")
        return False


def get_docker_version_sync() -> str:
    """Return the Docker version string from `docker --version`."""
    try:
        result = subprocess.run(
            ["docker", "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            return result.stdout.strip()
        return ""
    except FileNotFoundError:
        return ""
    except subprocess.TimeoutExpired:
        logger.warning("Timed out getting docker version")
        return ""


def install_docker_sync() -> bool:
    """Install Docker using the official convenience script, then add user to docker group."""
    try:
        logger.info("Installing Docker via get.docker.com convenience script...")
        result = subprocess.run(
            ["sh", "-c", "curl -fsSL https://get.docker.com | sh"],
            timeout=300,
        )
        if result.returncode != 0:
            logger.error("Docker installation script failed")
            return False

        # Add current user to docker group
        import os
        user = os.environ.get("USER") or os.environ.get("LOGNAME") or ""
        if user:
            subprocess.run(
                ["sudo", "usermod", "-aG", "docker", user],
                timeout=30,
            )

        logger.info("Docker installed successfully")
        return True
    except FileNotFoundError as e:
        logger.error(f"Required command not found during Docker install: {e}")
        return False
    except subprocess.TimeoutExpired:
        logger.error("Docker installation timed out")
        return False


def start_docker_sync() -> bool:
    """Start the Docker daemon using systemctl."""
    try:
        result = subprocess.run(
            ["sudo", "systemctl", "start", "docker"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.returncode == 0
    except FileNotFoundError:
        logger.error("systemctl not found — cannot start Docker daemon")
        return False
    except subprocess.TimeoutExpired:
        logger.warning("Timed out starting Docker daemon")
        return False
