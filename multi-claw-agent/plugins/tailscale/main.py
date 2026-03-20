import logging
from plugins.tailscale import discovery

logger = logging.getLogger("uvicorn.error")


class Plugin:
    def __init__(self):
        self.active = False
        self.tailscale_ip = None
        self.hostname = None

    def activate(self, ctx: dict):
        if not discovery.is_tailscale_running_sync():
            logger.warning("Tailscale is not running — plugin inactive")
            self.active = False
            return
        try:
            self.tailscale_ip = discovery.get_tailscale_ip_sync()
            self.active = True
            logger.info(f"Tailscale plugin active (IP: {self.tailscale_ip})")
        except Exception as e:
            logger.warning(f"Tailscale plugin failed to activate: {e}")
            self.active = False

    def deactivate(self):
        pass

    def get_tools(self) -> list[dict]:
        if not self.active:
            return []
        return [
            {
                "name": "discover_peers",
                "description": "Discover MultiClaw peers on the Tailscale network by tag",
                "handler": discovery.discover_peers,
            },
            {
                "name": "discover_dashboard",
                "description": "Find the MultiClaw dashboard on the Tailscale network",
                "handler": discovery.discover_dashboard,
            },
            {
                "name": "get_tailscale_status",
                "description": "Get full Tailscale node status",
                "handler": discovery.get_tailscale_status,
            },
            {
                "name": "get_tailscale_ip",
                "description": "Get this node's Tailscale IP address",
                "handler": discovery.get_tailscale_ip,
            },
        ]
