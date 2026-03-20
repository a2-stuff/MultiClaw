# plugins/browser_control/engine.py
import base64
import logging
from dataclasses import dataclass, field
from urllib.parse import urlparse

from playwright.async_api import async_playwright, Page

logger = logging.getLogger("uvicorn.error")


@dataclass
class BrowserConfig:
    browser: str = "chromium"
    headless: bool = True
    viewport: dict = field(default_factory=lambda: {"width": 1280, "height": 720})
    default_timeout: int = 30000
    user_agent: str | None = None
    blocked_url_patterns: list[str] = field(default_factory=list)
    allowed_url_patterns: list[str] = field(default_factory=list)


class PlaywrightEngine:
    def __init__(self, config: BrowserConfig):
        self.config = config
        self._playwright = None
        self._browser = None
        self._context = None
        self._pages: list[Page] = []
        self._current_page_index: int = 0
        self._started = False
        self._restart_count = 0
        self._max_restarts = 3
        self._pw_context_manager = None

    @property
    def current_page(self) -> Page | None:
        if self._pages and 0 <= self._current_page_index < len(self._pages):
            return self._pages[self._current_page_index]
        return None

    async def ensure_started(self) -> None:
        if not self._started:
            if self._restart_count >= self._max_restarts:
                raise RuntimeError("Browser failed to restart after 3 attempts")
            self._restart_count += 1
            await self.start()

    async def start(self) -> None:
        try:
            self._pw_context_manager = async_playwright()
            self._playwright = await self._pw_context_manager.__aenter__()

            launcher = getattr(self._playwright, self.config.browser, self._playwright.chromium)
            self._browser = await launcher.launch(headless=self.config.headless)
            self._browser.on("disconnected", self._on_browser_disconnect)

            context_opts = {"viewport": self.config.viewport}
            if self.config.user_agent:
                context_opts["user_agent"] = self.config.user_agent
            self._context = await self._browser.new_context(**context_opts)
            self._context.set_default_timeout(self.config.default_timeout)

            page = await self._context.new_page()
            self._pages = [page]
            self._current_page_index = 0
            self._started = True
            self._restart_count = 0
            logger.info(f"Browser engine started ({self.config.browser})")
        except Exception as e:
            logger.error(f"Failed to start browser engine: {e}")
            self._started = False
            raise

    async def stop(self) -> None:
        try:
            if self._context:
                await self._context.close()
            if self._browser:
                await self._browser.close()
            if self._pw_context_manager:
                await self._pw_context_manager.__aexit__(None, None, None)
        except Exception as e:
            logger.warning(f"Error during browser shutdown: {e}")
        finally:
            self._playwright = None
            self._browser = None
            self._context = None
            self._pages = []
            self._current_page_index = 0
            self._started = False

    def _on_browser_disconnect(self) -> None:
        logger.warning("Browser disconnected unexpectedly")
        self._started = False

    def _is_url_blocked(self, url: str) -> bool:
        if not url or not url.strip():
            return True
        try:
            parsed = urlparse(url)
            hostname = parsed.hostname or ""
        except Exception:
            return True

        if self.config.allowed_url_patterns:
            return not any(p in url for p in self.config.allowed_url_patterns)

        return any(p in hostname or p in url for p in self.config.blocked_url_patterns)

    def _ok(self, data=None) -> dict:
        return {"ok": True, "data": data, "error": None}

    def _err(self, msg: str) -> dict:
        return {"ok": False, "data": None, "error": msg}

    async def navigate(self, url: str) -> dict:
        await self.ensure_started()
        if not url or not url.strip():
            return self._err("Invalid URL: empty or blank")
        if self._is_url_blocked(url):
            return self._err(f"URL blocked by security policy: {url}")
        try:
            page = self.current_page
            await page.goto(url, wait_until="domcontentloaded")
            return self._ok({"url": page.url, "title": await page.title()})
        except Exception as e:
            return self._err(f"Navigation failed: {e}")

    async def click(self, selector: str) -> dict:
        await self.ensure_started()
        if not selector or not selector.strip():
            return self._err("Invalid selector: empty")
        try:
            await self.current_page.click(selector)
            return self._ok()
        except Exception as e:
            return self._err(f"Click failed: {e}")

    async def fill(self, selector: str, value: str) -> dict:
        await self.ensure_started()
        if not selector or not selector.strip():
            return self._err("Invalid selector: empty")
        try:
            await self.current_page.fill(selector, value)
            return self._ok()
        except Exception as e:
            return self._err(f"Fill failed: {e}")

    async def submit_form(self, selector: str) -> dict:
        await self.ensure_started()
        if not selector or not selector.strip():
            return self._err("Invalid selector: empty")
        try:
            element = self.current_page.locator(selector)
            tag = await element.evaluate("el => el.tagName.toLowerCase()")
            if tag == "form":
                await element.evaluate("el => el.submit()")
            else:
                await element.click()
            return self._ok()
        except Exception as e:
            return self._err(f"Submit failed: {e}")

    async def screenshot(self, full_page: bool = False) -> dict:
        await self.ensure_started()
        try:
            data = await self.current_page.screenshot(full_page=full_page)
            return self._ok({"image": base64.b64encode(data).decode(), "format": "png"})
        except Exception as e:
            return self._err(f"Screenshot failed: {e}")

    async def get_text(self, selector: str) -> dict:
        await self.ensure_started()
        if not selector or not selector.strip():
            return self._err("Invalid selector: empty")
        try:
            text = await self.current_page.text_content(selector)
            return self._ok({"text": text or ""})
        except Exception as e:
            return self._err(f"Get text failed: {e}")

    async def get_page_content(self, format: str = "text") -> dict:
        await self.ensure_started()
        try:
            page = self.current_page
            if format == "html":
                content = await page.content()
            else:
                content = await page.evaluate("() => document.body.innerText")
            return self._ok({"content": content})
        except Exception as e:
            return self._err(f"Get page content failed: {e}")

    async def execute_js(self, script: str) -> dict:
        await self.ensure_started()
        if not script or not script.strip():
            return self._err("Invalid script: empty")
        try:
            logger.warning(f"Executing JS: {script[:200]}")
            result = await self.current_page.evaluate(script)
            return self._ok({"result": result})
        except Exception as e:
            return self._err(f"JS error: {e}")

    async def wait_for(self, selector: str, timeout: int = 30000) -> dict:
        await self.ensure_started()
        if not selector or not selector.strip():
            return self._err("Invalid selector: empty")
        try:
            await self.current_page.wait_for_selector(selector, timeout=timeout)
            return self._ok()
        except Exception as e:
            return self._err(f"Wait failed: {e}")

    async def select_option(self, selector: str, value: str) -> dict:
        await self.ensure_started()
        if not selector or not selector.strip():
            return self._err("Invalid selector: empty")
        try:
            await self.current_page.select_option(selector, value)
            return self._ok()
        except Exception as e:
            return self._err(f"Select option failed: {e}")

    async def go_back(self) -> dict:
        await self.ensure_started()
        try:
            await self.current_page.go_back()
            page = self.current_page
            return self._ok({"url": page.url, "title": await page.title()})
        except Exception as e:
            return self._err(f"Go back failed: {e}")

    async def new_tab(self, url: str = "") -> dict:
        await self.ensure_started()
        if url and self._is_url_blocked(url):
            return self._err(f"URL blocked by security policy: {url}")
        try:
            page = await self._context.new_page()
            self._pages.append(page)
            self._current_page_index = len(self._pages) - 1
            if url:
                await page.goto(url, wait_until="domcontentloaded")
            return self._ok({
                "tab_index": self._current_page_index,
                "url": page.url,
                "total_tabs": len(self._pages),
            })
        except Exception as e:
            return self._err(f"New tab failed: {e}")

    async def close_tab(self) -> dict:
        await self.ensure_started()
        if len(self._pages) <= 1:
            return self._err("Cannot close the last tab")
        try:
            page = self._pages.pop(self._current_page_index)
            await page.close()
            self._current_page_index = min(self._current_page_index, len(self._pages) - 1)
            return self._ok({
                "tab_index": self._current_page_index,
                "total_tabs": len(self._pages),
            })
        except Exception as e:
            return self._err(f"Close tab failed: {e}")

    async def list_tabs(self) -> dict:
        await self.ensure_started()
        tabs = []
        for i, page in enumerate(self._pages):
            tabs.append({
                "index": i,
                "url": page.url,
                "title": await page.title(),
                "active": i == self._current_page_index,
            })
        return self._ok({"tabs": tabs})

    async def switch_tab(self, index: int) -> dict:
        await self.ensure_started()
        if index < 0 or index >= len(self._pages):
            return self._err(f"Invalid tab index: {index} (have {len(self._pages)} tabs)")
        self._current_page_index = index
        page = self.current_page
        return self._ok({"tab_index": index, "url": page.url, "title": await page.title()})

    async def hover(self, selector: str) -> dict:
        await self.ensure_started()
        if not selector or not selector.strip():
            return self._err("Invalid selector: empty")
        try:
            await self.current_page.hover(selector)
            return self._ok()
        except Exception as e:
            return self._err(f"Hover failed: {e}")

    async def press_key(self, key: str) -> dict:
        await self.ensure_started()
        if not key or not key.strip():
            return self._err("Invalid key: empty")
        try:
            await self.current_page.keyboard.press(key)
            return self._ok()
        except Exception as e:
            return self._err(f"Key press failed: {e}")

    async def scroll(self, direction: str = "down", amount: int = 500) -> dict:
        await self.ensure_started()
        try:
            delta_y = amount if direction == "down" else -amount
            await self.current_page.mouse.wheel(0, delta_y)
            return self._ok()
        except Exception as e:
            return self._err(f"Scroll failed: {e}")

    async def get_url(self) -> dict:
        await self.ensure_started()
        try:
            page = self.current_page
            return self._ok({"url": page.url, "title": await page.title()})
        except Exception as e:
            return self._err(f"Get URL failed: {e}")
