# tests/plugins/test_browser_security.py
import pytest
from unittest.mock import AsyncMock


@pytest.fixture
def blocked_engine():
    from plugins.browser_control.engine import PlaywrightEngine, BrowserConfig
    config = BrowserConfig(
        blocked_url_patterns=[
            "169.254.169.254", "metadata.google.internal",
            "localhost", "127.0.0.1", "0.0.0.0", "[::1]",
        ],
    )
    engine = PlaywrightEngine(config)
    engine._started = True
    mock_page = AsyncMock()
    mock_page.url = "https://example.com"
    mock_page.title = AsyncMock(return_value="Example")
    mock_page.goto = AsyncMock()
    engine._pages = [mock_page]
    engine._current_page_index = 0
    return engine


@pytest.fixture
def allowlist_engine():
    from plugins.browser_control.engine import PlaywrightEngine, BrowserConfig
    config = BrowserConfig(
        blocked_url_patterns=[],
        allowed_url_patterns=["example.com", "github.com"],
    )
    engine = PlaywrightEngine(config)
    engine._started = True
    mock_page = AsyncMock()
    mock_page.url = "https://example.com"
    mock_page.title = AsyncMock(return_value="Example")
    mock_page.goto = AsyncMock()
    engine._pages = [mock_page]
    engine._current_page_index = 0
    return engine


@pytest.mark.asyncio
async def test_blocks_cloud_metadata(blocked_engine):
    result = await blocked_engine.navigate("http://169.254.169.254/latest/meta-data/")
    assert result["ok"] is False
    assert "blocked" in result["error"].lower()


@pytest.mark.asyncio
async def test_blocks_gcp_metadata(blocked_engine):
    result = await blocked_engine.navigate("http://metadata.google.internal/computeMetadata/v1/")
    assert result["ok"] is False


@pytest.mark.asyncio
async def test_blocks_localhost(blocked_engine):
    result = await blocked_engine.navigate("http://localhost:8080")
    assert result["ok"] is False


@pytest.mark.asyncio
async def test_blocks_127(blocked_engine):
    result = await blocked_engine.navigate("http://127.0.0.1:3000/admin")
    assert result["ok"] is False


@pytest.mark.asyncio
async def test_blocks_ipv6_localhost(blocked_engine):
    result = await blocked_engine.navigate("http://[::1]:8080")
    assert result["ok"] is False


@pytest.mark.asyncio
async def test_allows_normal_urls(blocked_engine):
    result = await blocked_engine.navigate("https://github.com")
    assert result["ok"] is True


@pytest.mark.asyncio
async def test_allowlist_permits_listed(allowlist_engine):
    result = await allowlist_engine.navigate("https://example.com/page")
    assert result["ok"] is True


@pytest.mark.asyncio
async def test_allowlist_blocks_unlisted(allowlist_engine):
    result = await allowlist_engine.navigate("https://evil.com")
    assert result["ok"] is False


@pytest.mark.asyncio
async def test_blocks_empty_url(blocked_engine):
    result = await blocked_engine.navigate("")
    assert result["ok"] is False


@pytest.mark.asyncio
async def test_blocks_new_tab_url(blocked_engine):
    result = await blocked_engine.new_tab("http://169.254.169.254/")
    assert result["ok"] is False


def test_js_tool_gated_by_config():
    from plugins.browser_control.tools import build_tools
    from unittest.mock import MagicMock
    engine = MagicMock()
    tools_off = build_tools(engine, {"allow_js_execution": False})
    tools_on = build_tools(engine, {"allow_js_execution": True})
    names_off = [t["name"] for t in tools_off]
    names_on = [t["name"] for t in tools_on]
    assert "browser_execute_js" not in names_off
    assert "browser_execute_js" in names_on
