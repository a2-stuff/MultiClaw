# plugins/browser_control/main.py
import json
import logging
from pathlib import Path

logger = logging.getLogger("uvicorn.error")


class Plugin:
    name = "browser-control"
    description = "Browser automation via Playwright"

    def __init__(self):
        self.active = False
        self.engine = None
        self._config = self._load_config()

    def _load_config(self) -> dict:
        config_path = Path(__file__).parent / "plugin.json"
        if config_path.exists():
            meta = json.loads(config_path.read_text())
            return meta.get("config", {})
        return {
            "browser": "chromium",
            "headless": True,
            "viewport": {"width": 1280, "height": 720},
            "default_timeout": 30000,
            "user_agent": None,
            "allow_js_execution": False,
            "blocked_url_patterns": [
                "169.254.169.254", "metadata.google.internal",
                "localhost", "127.0.0.1", "0.0.0.0", "[::1]",
            ],
            "allowed_url_patterns": [],
        }

    def activate(self, ctx: dict):
        from plugins.browser_control.installer import (
            check_playwright_installed,
            ensure_browser_binary,
            ensure_system_deps,
        )

        if not check_playwright_installed():
            logger.error(
                "Playwright not installed. Run: pip install playwright && playwright install chromium"
            )
            self.active = False
            return

        browser_type = self._config.get("browser", "chromium")
        if not ensure_browser_binary(browser_type):
            logger.error(f"Failed to ensure {browser_type} binary")
            self.active = False
            return

        ensure_system_deps(browser_type)

        from plugins.browser_control.engine import PlaywrightEngine, BrowserConfig
        config = BrowserConfig(
            browser=self._config.get("browser", "chromium"),
            headless=self._config.get("headless", True),
            viewport=self._config.get("viewport", {"width": 1280, "height": 720}),
            default_timeout=self._config.get("default_timeout", 30000),
            user_agent=self._config.get("user_agent"),
            blocked_url_patterns=self._config.get("blocked_url_patterns", []),
            allowed_url_patterns=self._config.get("allowed_url_patterns", []),
        )
        self.engine = PlaywrightEngine(config)
        self.active = True
        logger.info(f"Browser control plugin activated ({browser_type}, headless={config.headless})")

    def deactivate(self):
        if self.engine and self.engine._started:
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(self.engine.stop())
                else:
                    loop.run_until_complete(self.engine.stop())
            except Exception as e:
                logger.warning(f"Error stopping browser engine: {e}")
        self.engine = None
        self.active = False

    def get_tools(self) -> list[dict]:
        if not self.active or not self.engine:
            return []
        from plugins.browser_control.tools import build_tools
        return build_tools(self.engine, self._config)
