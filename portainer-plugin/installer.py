import subprocess


def is_docker_available_sync() -> bool:
    try:
        result = subprocess.run(
            ["docker", "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def is_portainer_installed_sync() -> bool:
    try:
        result = subprocess.run(
            ["docker", "ps", "-a", "--filter", "name=portainer", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return "portainer" in result.stdout
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def install_portainer_sync() -> bool:
    try:
        volume_result = subprocess.run(
            ["docker", "volume", "create", "portainer_data"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if volume_result.returncode != 0:
            return False

        run_result = subprocess.run(
            [
                "docker", "run", "-d",
                "-p", "8000:8000",
                "-p", "9443:9443",
                "--name", "portainer",
                "--restart=always",
                "-v", "/var/run/docker.sock:/var/run/docker.sock",
                "-v", "portainer_data:/data",
                "portainer/portainer-ce:lts",
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        return run_result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def start_portainer_sync() -> bool:
    try:
        result = subprocess.run(
            ["docker", "start", "portainer"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def get_portainer_url_sync() -> str:
    try:
        result = subprocess.run(
            ["hostname", "-I"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        ip = result.stdout.strip().split()[0] if result.stdout.strip() else "localhost"
    except (FileNotFoundError, subprocess.TimeoutExpired, IndexError):
        ip = "localhost"
    return f"https://{ip}:9443"
