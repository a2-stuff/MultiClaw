import pytest
from unittest.mock import patch, MagicMock


# ---------------------------------------------------------------------------
# Interface
# ---------------------------------------------------------------------------

def test_plugin_has_required_interface():
    from main import Plugin
    p = Plugin()
    assert hasattr(p, "activate")
    assert hasattr(p, "deactivate")
    assert hasattr(p, "get_tools")
    assert hasattr(p, "active")
    assert hasattr(p, "docker_version")


def test_plugin_initial_state():
    from main import Plugin
    p = Plugin()
    assert p.active is False
    assert p.docker_version is None


# ---------------------------------------------------------------------------
# activate — happy path (docker already installed and running)
# ---------------------------------------------------------------------------

@patch("installer.is_docker_installed_sync", return_value=True)
@patch("installer.is_docker_running_sync", return_value=True)
@patch("installer.get_docker_version_sync", return_value="Docker version 24.0.7, build afdd53b")
def test_activate_docker_already_running(mock_version, mock_running, mock_installed):
    from main import Plugin
    p = Plugin()
    p.activate({})
    assert p.active is True
    assert p.docker_version == "Docker version 24.0.7, build afdd53b"


# ---------------------------------------------------------------------------
# activate — docker not installed, installation succeeds
# ---------------------------------------------------------------------------

@patch("installer.is_docker_installed_sync", return_value=False)
@patch("installer.install_docker_sync", return_value=True)
@patch("installer.is_docker_running_sync", return_value=True)
@patch("installer.get_docker_version_sync", return_value="Docker version 24.0.7, build afdd53b")
def test_activate_installs_docker_when_missing(mock_version, mock_running, mock_install, mock_installed):
    from main import Plugin
    p = Plugin()
    p.activate({})
    assert p.active is True
    mock_install.assert_called_once()


# ---------------------------------------------------------------------------
# activate — docker not installed, installation fails
# ---------------------------------------------------------------------------

@patch("installer.is_docker_installed_sync", return_value=False)
@patch("installer.install_docker_sync", return_value=False)
def test_activate_graceful_when_install_fails(mock_install, mock_installed):
    from main import Plugin
    p = Plugin()
    p.activate({})
    assert p.active is False
    assert p.docker_version is None


# ---------------------------------------------------------------------------
# activate — docker installed but daemon not running, start succeeds
# ---------------------------------------------------------------------------

@patch("installer.is_docker_installed_sync", return_value=True)
@patch("installer.is_docker_running_sync", return_value=False)
@patch("installer.start_docker_sync", return_value=True)
@patch("installer.get_docker_version_sync", return_value="Docker version 24.0.7, build afdd53b")
def test_activate_starts_daemon_when_stopped(mock_version, mock_start, mock_running, mock_installed):
    from main import Plugin
    p = Plugin()
    p.activate({})
    assert p.active is True
    mock_start.assert_called_once()


# ---------------------------------------------------------------------------
# activate — docker installed, daemon not running, start fails
# ---------------------------------------------------------------------------

@patch("installer.is_docker_installed_sync", return_value=True)
@patch("installer.is_docker_running_sync", return_value=False)
@patch("installer.start_docker_sync", return_value=False)
def test_activate_graceful_when_daemon_wont_start(mock_start, mock_running, mock_installed):
    from main import Plugin
    p = Plugin()
    p.activate({})
    assert p.active is False
    assert p.docker_version is None


# ---------------------------------------------------------------------------
# deactivate
# ---------------------------------------------------------------------------

def test_deactivate_is_noop():
    from main import Plugin
    p = Plugin()
    p.active = True
    p.docker_version = "Docker version 24.0.7"
    p.deactivate()
    # No exception — deactivate is a no-op


# ---------------------------------------------------------------------------
# get_tools
# ---------------------------------------------------------------------------

@patch("installer.is_docker_installed_sync", return_value=True)
@patch("installer.is_docker_running_sync", return_value=True)
@patch("installer.get_docker_version_sync", return_value="Docker version 24.0.7, build afdd53b")
def test_get_tools_returns_nine_tools(mock_version, mock_running, mock_installed):
    from main import Plugin
    p = Plugin()
    p.activate({})
    tools = p.get_tools()
    assert isinstance(tools, list)
    assert len(tools) == 9


@patch("installer.is_docker_installed_sync", return_value=True)
@patch("installer.is_docker_running_sync", return_value=True)
@patch("installer.get_docker_version_sync", return_value="Docker version 24.0.7, build afdd53b")
def test_get_tools_contains_expected_names(mock_version, mock_running, mock_installed):
    from main import Plugin
    p = Plugin()
    p.activate({})
    tools = p.get_tools()
    names = [t["name"] for t in tools]
    expected = [
        "docker_list_containers",
        "docker_run",
        "docker_stop",
        "docker_start",
        "docker_remove",
        "docker_logs",
        "docker_pull",
        "docker_images",
        "docker_stats",
    ]
    for name in expected:
        assert name in names, f"Tool '{name}' missing from get_tools()"


@patch("installer.is_docker_installed_sync", return_value=True)
@patch("installer.is_docker_running_sync", return_value=True)
@patch("installer.get_docker_version_sync", return_value="Docker version 24.0.7, build afdd53b")
def test_get_tools_each_has_handler(mock_version, mock_running, mock_installed):
    from main import Plugin
    import asyncio
    p = Plugin()
    p.activate({})
    for tool in p.get_tools():
        assert "handler" in tool, f"Tool '{tool['name']}' missing handler"
        assert callable(tool["handler"]), f"Tool '{tool['name']}' handler is not callable"
        assert asyncio.iscoroutinefunction(tool["handler"]), (
            f"Tool '{tool['name']}' handler is not a coroutine function"
        )


def test_get_tools_returns_empty_when_inactive():
    from main import Plugin
    p = Plugin()
    # Never activated — active is False
    tools = p.get_tools()
    assert tools == []
