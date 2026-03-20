# plugins/browser_control/installer.py
import importlib.util
import logging
import subprocess
import sys

logger = logging.getLogger("uvicorn.error")


def check_playwright_installed() -> bool:
    return importlib.util.find_spec("playwright") is not None


def ensure_browser_binary(browser_type: str = "chromium") -> bool:
    try:
        result = subprocess.run(
            [sys.executable, "-m", "playwright", "install", browser_type],
            capture_output=True, text=True, timeout=300,
        )
        if result.returncode == 0:
            logger.info(f"Playwright {browser_type} binary ready")
            return True
        logger.error(f"Failed to install {browser_type}: {result.stderr}")
        return False
    except Exception as e:
        logger.error(f"Browser binary install failed: {e}")
        return False


def ensure_system_deps(browser_type: str = "chromium") -> None:
    if sys.platform == "linux":
        try:
            subprocess.run(
                [sys.executable, "-m", "playwright", "install-deps", browser_type],
                capture_output=True, text=True, timeout=300,
            )
        except Exception as e:
            logger.warning(f"System deps install failed (may need sudo): {e}")
