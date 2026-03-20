import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.fixture
def mock_engine():
    engine = MagicMock()
    engine.navigate = AsyncMock(return_value={"ok": True, "data": {"url": "https://example.com"}})
    engine.click = AsyncMock(return_value={"ok": True, "data": None})
    engine.fill = AsyncMock(return_value={"ok": True, "data": None})
    engine.submit_form = AsyncMock(return_value={"ok": True, "data": None})
    engine.screenshot = AsyncMock(return_value={"ok": True, "data": {"image": "abc"}})
    engine.get_text = AsyncMock(return_value={"ok": True, "data": {"text": "Hello"}})
    engine.get_page_content = AsyncMock(return_value={"ok": True, "data": {"content": "page"}})
    engine.execute_js = AsyncMock(return_value={"ok": True, "data": {"result": 42}})
    engine.wait_for = AsyncMock(return_value={"ok": True, "data": None})
    engine.select_option = AsyncMock(return_value={"ok": True, "data": None})
    engine.go_back = AsyncMock(return_value={"ok": True, "data": None})
    engine.new_tab = AsyncMock(return_value={"ok": True, "data": None})
    engine.close_tab = AsyncMock(return_value={"ok": True, "data": None})
    engine.list_tabs = AsyncMock(return_value={"ok": True, "data": {"tabs": []}})
    engine.switch_tab = AsyncMock(return_value={"ok": True, "data": None})
    engine.hover = AsyncMock(return_value={"ok": True, "data": None})
    engine.press_key = AsyncMock(return_value={"ok": True, "data": None})
    engine.scroll = AsyncMock(return_value={"ok": True, "data": None})
    engine.get_url = AsyncMock(return_value={"ok": True, "data": {"url": "https://example.com"}})
    engine.ensure_started = AsyncMock()
    return engine


def test_build_tools_returns_all_tools(mock_engine):
    from plugins.browser_control.tools import build_tools
    config = {"allow_js_execution": True}
    tools = build_tools(mock_engine, config)
    names = [t["name"] for t in tools]
    assert "browser_navigate" in names
    assert "browser_click" in names
    assert "browser_fill" in names
    assert "browser_submit_form" in names
    assert "browser_screenshot" in names
    assert "browser_get_text" in names
    assert "browser_get_page_content" in names
    assert "browser_execute_js" in names
    assert "browser_wait_for" in names
    assert "browser_select_option" in names
    assert "browser_go_back" in names
    assert "browser_new_tab" in names
    assert "browser_close_tab" in names
    assert "browser_list_tabs" in names
    assert "browser_switch_tab" in names
    assert "browser_hover" in names
    assert "browser_press_key" in names
    assert "browser_scroll" in names
    assert "browser_get_url" in names
    assert len(names) == 19


def test_build_tools_excludes_js_when_disabled(mock_engine):
    from plugins.browser_control.tools import build_tools
    config = {"allow_js_execution": False}
    tools = build_tools(mock_engine, config)
    names = [t["name"] for t in tools]
    assert "browser_execute_js" not in names
    assert len(names) == 18


def test_all_tools_have_required_keys(mock_engine):
    from plugins.browser_control.tools import build_tools
    tools = build_tools(mock_engine, {"allow_js_execution": True})
    for tool in tools:
        assert "name" in tool, f"Tool missing 'name': {tool}"
        assert "description" in tool, f"Tool missing 'description': {tool}"
        assert "handler" in tool, f"Tool missing 'handler': {tool}"
        assert callable(tool["handler"]), f"Handler not callable: {tool['name']}"


@pytest.mark.asyncio
async def test_navigate_handler_calls_ensure_started(mock_engine):
    from plugins.browser_control.tools import build_tools
    tools = build_tools(mock_engine, {"allow_js_execution": False})
    nav_tool = next(t for t in tools if t["name"] == "browser_navigate")
    await nav_tool["handler"](url="https://example.com")
    mock_engine.ensure_started.assert_awaited_once()
    mock_engine.navigate.assert_awaited_once_with("https://example.com")


@pytest.mark.asyncio
async def test_fill_handler(mock_engine):
    from plugins.browser_control.tools import build_tools
    tools = build_tools(mock_engine, {"allow_js_execution": False})
    fill_tool = next(t for t in tools if t["name"] == "browser_fill")
    await fill_tool["handler"](selector="#email", value="test@example.com")
    mock_engine.fill.assert_awaited_once_with("#email", "test@example.com")


@pytest.mark.asyncio
async def test_screenshot_handler(mock_engine):
    from plugins.browser_control.tools import build_tools
    tools = build_tools(mock_engine, {"allow_js_execution": False})
    ss_tool = next(t for t in tools if t["name"] == "browser_screenshot")
    await ss_tool["handler"](full_page=True)
    mock_engine.screenshot.assert_awaited_once_with(True)
