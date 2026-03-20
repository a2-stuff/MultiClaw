# tests/plugins/test_browser_engine.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from dataclasses import dataclass


@pytest.fixture
def config():
    from plugins.browser_control.engine import BrowserConfig
    return BrowserConfig(
        browser="chromium",
        headless=True,
        viewport={"width": 1280, "height": 720},
        default_timeout=30000,
        user_agent=None,
        blocked_url_patterns=["169.254.169.254", "localhost", "127.0.0.1"],
        allowed_url_patterns=[],
    )


def test_engine_init(config):
    from plugins.browser_control.engine import PlaywrightEngine
    engine = PlaywrightEngine(config)
    assert engine._started is False
    assert engine._restart_count == 0
    assert engine._playwright is None


@pytest.mark.asyncio
async def test_engine_start_and_stop(config):
    from plugins.browser_control.engine import PlaywrightEngine
    engine = PlaywrightEngine(config)

    mock_pw = AsyncMock()
    mock_browser = AsyncMock()
    mock_context = AsyncMock()
    mock_page = AsyncMock()
    mock_page.url = "about:blank"
    mock_page.title = AsyncMock(return_value="")

    mock_pw.chromium.launch = AsyncMock(return_value=mock_browser)
    mock_browser.new_context = AsyncMock(return_value=mock_context)
    mock_context.new_page = AsyncMock(return_value=mock_page)
    mock_browser.on = MagicMock()

    with patch("plugins.browser_control.engine.async_playwright") as mock_apw:
        mock_apw.return_value.__aenter__ = AsyncMock(return_value=mock_pw)
        mock_apw.return_value.__aexit__ = AsyncMock(return_value=None)
        engine._playwright = mock_pw
        engine._browser = mock_browser
        engine._context = mock_context
        engine._pages = [mock_page]
        engine._current_page_index = 0
        engine._started = True

        assert engine._started is True
        assert engine.current_page == mock_page

        await engine.stop()
        assert engine._started is False


@pytest.mark.asyncio
async def test_navigate_validates_url(config):
    from plugins.browser_control.engine import PlaywrightEngine
    engine = PlaywrightEngine(config)
    engine._started = True
    mock_page = AsyncMock()
    mock_page.url = "https://example.com"
    mock_page.title = AsyncMock(return_value="Example")
    engine._pages = [mock_page]
    engine._current_page_index = 0

    result = await engine.navigate("http://169.254.169.254/latest/meta-data")
    assert result["ok"] is False
    assert "blocked" in result["error"].lower()

    result = await engine.navigate("http://localhost:8080/admin")
    assert result["ok"] is False
    assert "blocked" in result["error"].lower()


@pytest.mark.asyncio
async def test_navigate_success(config):
    from plugins.browser_control.engine import PlaywrightEngine
    engine = PlaywrightEngine(config)
    engine._started = True
    mock_page = AsyncMock()
    mock_page.url = "https://example.com"
    mock_page.title = AsyncMock(return_value="Example Domain")
    mock_page.goto = AsyncMock()
    engine._pages = [mock_page]
    engine._current_page_index = 0

    result = await engine.navigate("https://example.com")
    assert result["ok"] is True
    assert result["data"]["url"] == "https://example.com"


@pytest.mark.asyncio
async def test_navigate_empty_url(config):
    from plugins.browser_control.engine import PlaywrightEngine
    engine = PlaywrightEngine(config)
    engine._started = True
    engine._pages = [AsyncMock()]
    engine._current_page_index = 0

    result = await engine.navigate("")
    assert result["ok"] is False
    assert "empty" in result["error"].lower() or "invalid" in result["error"].lower()


@pytest.mark.asyncio
async def test_ensure_started_calls_start_when_not_started(config):
    from plugins.browser_control.engine import PlaywrightEngine
    engine = PlaywrightEngine(config)
    engine._started = False
    engine.start = AsyncMock()
    await engine.ensure_started()
    engine.start.assert_awaited_once()


@pytest.mark.asyncio
async def test_ensure_started_skips_when_already_started(config):
    from plugins.browser_control.engine import PlaywrightEngine
    engine = PlaywrightEngine(config)
    engine._started = True
    engine.start = AsyncMock()
    await engine.ensure_started()
    engine.start.assert_not_awaited()


@pytest.mark.asyncio
async def test_crash_recovery_caps_at_max_restarts(config):
    from plugins.browser_control.engine import PlaywrightEngine
    engine = PlaywrightEngine(config)
    engine._started = False
    engine._restart_count = 3
    engine._max_restarts = 3
    with pytest.raises(RuntimeError, match="failed to restart"):
        await engine.ensure_started()


@pytest.mark.asyncio
async def test_close_last_tab_returns_error(config):
    from plugins.browser_control.engine import PlaywrightEngine
    engine = PlaywrightEngine(config)
    engine._started = True
    engine._pages = [AsyncMock()]
    engine._current_page_index = 0
    result = await engine.close_tab()
    assert result["ok"] is False
    assert "last tab" in result["error"].lower()


@pytest.mark.asyncio
async def test_switch_tab_invalid_index(config):
    from plugins.browser_control.engine import PlaywrightEngine
    engine = PlaywrightEngine(config)
    engine._started = True
    engine._pages = [AsyncMock()]
    engine._current_page_index = 0
    result = await engine.switch_tab(5)
    assert result["ok"] is False
    assert "invalid" in result["error"].lower()
