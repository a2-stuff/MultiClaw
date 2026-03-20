import pytest
from unittest.mock import patch, MagicMock


def test_plugin_has_required_interface():
    from plugins.tailscale.main import Plugin
    p = Plugin()
    assert hasattr(p, "activate")
    assert hasattr(p, "deactivate")
    assert hasattr(p, "get_tools")


@patch("plugins.tailscale.discovery.is_tailscale_running_sync", return_value=True)
@patch("plugins.tailscale.discovery.get_tailscale_ip_sync", return_value="100.64.0.1")
def test_activate_caches_ip(mock_ip, mock_running):
    from plugins.tailscale.main import Plugin
    p = Plugin()
    p.activate({})
    assert p.tailscale_ip == "100.64.0.1"
    assert p.active is True


@patch("plugins.tailscale.discovery.is_tailscale_running_sync", return_value=False)
def test_activate_graceful_when_not_running(mock_running):
    from plugins.tailscale.main import Plugin
    p = Plugin()
    p.activate({})
    assert p.active is False
    assert p.tailscale_ip is None


def test_deactivate_is_noop():
    from plugins.tailscale.main import Plugin
    p = Plugin()
    p.active = True
    p.deactivate()


@patch("plugins.tailscale.discovery.is_tailscale_running_sync", return_value=True)
@patch("plugins.tailscale.discovery.get_tailscale_ip_sync", return_value="100.64.0.1")
def test_get_tools_returns_tool_list(mock_ip, mock_running):
    from plugins.tailscale.main import Plugin
    p = Plugin()
    p.activate({})
    tools = p.get_tools()
    assert isinstance(tools, list)
    assert len(tools) >= 3
    tool_names = [t["name"] for t in tools]
    assert "discover_peers" in tool_names
    assert "discover_dashboard" in tool_names
    assert "get_tailscale_status" in tool_names
