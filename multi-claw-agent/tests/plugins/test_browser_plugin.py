import pytest
from unittest.mock import patch, MagicMock


def test_plugin_has_required_interface():
    from plugins.browser_control.main import Plugin
    p = Plugin()
    assert hasattr(p, "activate")
    assert hasattr(p, "deactivate")
    assert hasattr(p, "get_tools")


def test_init_sets_defaults():
    from plugins.browser_control.main import Plugin
    p = Plugin()
    assert p.active is False
    assert p.engine is None
    assert p._config is not None


@patch("plugins.browser_control.installer.check_playwright_installed", return_value=True)
@patch("plugins.browser_control.installer.ensure_browser_binary", return_value=True)
def test_activate_succeeds_when_playwright_available(mock_binary, mock_check):
    from plugins.browser_control.main import Plugin
    p = Plugin()
    p.activate({})
    assert p.active is True


@patch("plugins.browser_control.installer.check_playwright_installed", return_value=False)
def test_activate_fails_when_playwright_missing(mock_check):
    from plugins.browser_control.main import Plugin
    p = Plugin()
    p.activate({})
    assert p.active is False


def test_get_tools_empty_when_inactive():
    from plugins.browser_control.main import Plugin
    p = Plugin()
    assert p.get_tools() == []


@patch("plugins.browser_control.installer.check_playwright_installed", return_value=True)
@patch("plugins.browser_control.installer.ensure_browser_binary", return_value=True)
def test_get_tools_returns_tools_when_active(mock_binary, mock_check):
    from plugins.browser_control.main import Plugin
    p = Plugin()
    p.activate({})
    tools = p.get_tools()
    assert len(tools) > 0
    assert all("name" in t and "description" in t and "handler" in t for t in tools)
    tool_names = [t["name"] for t in tools]
    assert "browser_navigate" in tool_names
    assert "browser_click" in tool_names
    assert "browser_fill" in tool_names
    assert "browser_screenshot" in tool_names


@patch("plugins.browser_control.installer.check_playwright_installed", return_value=True)
@patch("plugins.browser_control.installer.ensure_browser_binary", return_value=True)
def test_js_tool_excluded_when_disabled(mock_binary, mock_check):
    from plugins.browser_control.main import Plugin
    p = Plugin()
    p.activate({})
    tool_names = [t["name"] for t in p.get_tools()]
    assert "browser_execute_js" not in tool_names


def test_deactivate_sets_inactive():
    from plugins.browser_control.main import Plugin
    p = Plugin()
    p.active = True
    p.deactivate()
    assert p.active is False


@patch("plugins.browser_control.installer.check_playwright_installed", return_value=True)
@patch("plugins.browser_control.installer.ensure_browser_binary", return_value=True)
def test_plugin_loads_through_plugin_loader(mock_binary, mock_check):
    """Verify the plugin works through the real PluginLoader in-place."""
    from pathlib import Path
    from src.plugins.manager import PluginManager
    from src.plugins.loader import PluginLoader

    # Use the actual plugins directory (PluginLoader uses spec_from_file_location)
    plugins_dir = Path(__file__).resolve().parent.parent.parent / "plugins"
    mgr = PluginManager(plugins_dir)
    loader = PluginLoader(mgr)
    loader.load_plugin("browser_control")

    assert "browser_control" in loader.active_plugins
    tools = loader.get_all_tools()
    browser_tools = [t for t in tools if t["name"].startswith("browser_")]
    assert len(browser_tools) >= 18

    loader.unload_plugin("browser_control")
    assert "browser_control" not in loader.active_plugins
