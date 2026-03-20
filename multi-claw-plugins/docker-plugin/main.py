import logging
import sys
import os

logger = logging.getLogger(__name__)


class Plugin:
    def __init__(self):
        self.active = False
        self.docker_version = None

    def activate(self, ctx: dict):
        # Import installer relative to this file's location so the plugin
        # works both when installed into the agent plugins directory and
        # when run as a standalone bundle from docker-plugin/.
        plugin_dir = os.path.dirname(os.path.abspath(__file__))
        if plugin_dir not in sys.path:
            sys.path.insert(0, plugin_dir)

        from installer import (
            is_docker_installed_sync,
            install_docker_sync,
            is_docker_running_sync,
            start_docker_sync,
            get_docker_version_sync,
        )

        if not is_docker_installed_sync():
            logger.info("Docker not found — attempting installation...")
            if not install_docker_sync():
                logger.error("Docker installation failed — plugin inactive")
                self.active = False
                return

        if not is_docker_running_sync():
            logger.info("Docker daemon not running — attempting to start...")
            if not start_docker_sync():
                logger.error("Could not start Docker daemon — plugin inactive")
                self.active = False
                return

        self.docker_version = get_docker_version_sync()
        self.active = True
        logger.info(f"Docker plugin active ({self.docker_version})")

    def deactivate(self):
        pass

    def get_tools(self) -> list[dict]:
        if not self.active:
            return []

        plugin_dir = os.path.dirname(os.path.abspath(__file__))
        if plugin_dir not in sys.path:
            sys.path.insert(0, plugin_dir)

        import tools

        return [
            {
                "name": "docker_list_containers",
                "description": "List all Docker containers (running and stopped)",
                "handler": tools.docker_list_containers,
            },
            {
                "name": "docker_run",
                "description": "Run a Docker container from an image",
                "handler": tools.docker_run,
            },
            {
                "name": "docker_stop",
                "description": "Stop a running Docker container",
                "handler": tools.docker_stop,
            },
            {
                "name": "docker_start",
                "description": "Start a stopped Docker container",
                "handler": tools.docker_start,
            },
            {
                "name": "docker_remove",
                "description": "Remove a Docker container",
                "handler": tools.docker_remove,
            },
            {
                "name": "docker_logs",
                "description": "Fetch logs from a Docker container",
                "handler": tools.docker_logs,
            },
            {
                "name": "docker_pull",
                "description": "Pull a Docker image from a registry",
                "handler": tools.docker_pull,
            },
            {
                "name": "docker_images",
                "description": "List all locally available Docker images",
                "handler": tools.docker_images,
            },
            {
                "name": "docker_stats",
                "description": "Get resource usage stats for running Docker containers",
                "handler": tools.docker_stats,
            },
        ]
