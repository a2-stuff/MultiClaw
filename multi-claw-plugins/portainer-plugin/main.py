from installer import (
    is_docker_available_sync,
    is_portainer_installed_sync,
    install_portainer_sync,
    start_portainer_sync,
    get_portainer_url_sync,
)


class Plugin:
    def __init__(self):
        self.active = False
        self.portainer_url = None

    def activate(self, ctx):
        if not is_docker_available_sync():
            if ctx and hasattr(ctx, "log"):
                ctx.log("warning", "Docker is not available; Portainer plugin will not activate.")
            self.active = False
            return

        if not is_portainer_installed_sync():
            success = install_portainer_sync()
            if not success:
                if ctx and hasattr(ctx, "log"):
                    ctx.log("warning", "Portainer installation failed; plugin will not activate.")
                self.active = False
                return
        else:
            start_portainer_sync()

        self.portainer_url = get_portainer_url_sync()
        self.active = True

    def deactivate(self):
        pass

    def get_tools(self):
        if not self.active:
            return []
        url = self.portainer_url
        return [
            {
                "name": "get_portainer_url",
                "description": "Get the Portainer web UI URL",
                "handler": lambda: url,
            }
        ]
