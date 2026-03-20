import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock, call
import pytest

from main import Plugin


def make_ctx(log_fn=None):
    ctx = MagicMock()
    if log_fn:
        ctx.log = log_fn
    return ctx


# ---------------------------------------------------------------------------
# activate — Docker not available
# ---------------------------------------------------------------------------

class TestActivateDockerUnavailable:
    def test_active_is_false_when_docker_unavailable(self):
        plugin = Plugin()
        with patch("main.is_docker_available_sync", return_value=False):
            plugin.activate(make_ctx())
        assert plugin.active is False

    def test_portainer_url_is_none_when_docker_unavailable(self):
        plugin = Plugin()
        with patch("main.is_docker_available_sync", return_value=False):
            plugin.activate(make_ctx())
        assert plugin.portainer_url is None

    def test_logs_warning_when_docker_unavailable(self):
        plugin = Plugin()
        log_calls = []
        ctx = make_ctx(log_fn=lambda level, msg: log_calls.append((level, msg)))
        with patch("main.is_docker_available_sync", return_value=False):
            plugin.activate(ctx)
        assert any(level == "warning" for level, _ in log_calls)


# ---------------------------------------------------------------------------
# activate — Portainer not installed, install succeeds
# ---------------------------------------------------------------------------

class TestActivateInstallSuccess:
    def test_active_is_true_after_successful_install(self):
        plugin = Plugin()
        with patch("main.is_docker_available_sync", return_value=True), \
             patch("main.is_portainer_installed_sync", return_value=False), \
             patch("main.install_portainer_sync", return_value=True), \
             patch("main.get_portainer_url_sync", return_value="https://1.2.3.4:9443"):
            plugin.activate(make_ctx())
        assert plugin.active is True

    def test_portainer_url_set_after_successful_install(self):
        plugin = Plugin()
        with patch("main.is_docker_available_sync", return_value=True), \
             patch("main.is_portainer_installed_sync", return_value=False), \
             patch("main.install_portainer_sync", return_value=True), \
             patch("main.get_portainer_url_sync", return_value="https://1.2.3.4:9443"):
            plugin.activate(make_ctx())
        assert plugin.portainer_url == "https://1.2.3.4:9443"

    def test_start_not_called_when_portainer_not_installed(self):
        plugin = Plugin()
        with patch("main.is_docker_available_sync", return_value=True), \
             patch("main.is_portainer_installed_sync", return_value=False), \
             patch("main.install_portainer_sync", return_value=True), \
             patch("main.start_portainer_sync") as mock_start, \
             patch("main.get_portainer_url_sync", return_value="https://1.2.3.4:9443"):
            plugin.activate(make_ctx())
        mock_start.assert_not_called()


# ---------------------------------------------------------------------------
# activate — Portainer not installed, install fails
# ---------------------------------------------------------------------------

class TestActivateInstallFailure:
    def test_active_is_false_when_install_fails(self):
        plugin = Plugin()
        with patch("main.is_docker_available_sync", return_value=True), \
             patch("main.is_portainer_installed_sync", return_value=False), \
             patch("main.install_portainer_sync", return_value=False):
            plugin.activate(make_ctx())
        assert plugin.active is False

    def test_portainer_url_is_none_when_install_fails(self):
        plugin = Plugin()
        with patch("main.is_docker_available_sync", return_value=True), \
             patch("main.is_portainer_installed_sync", return_value=False), \
             patch("main.install_portainer_sync", return_value=False):
            plugin.activate(make_ctx())
        assert plugin.portainer_url is None

    def test_logs_warning_when_install_fails(self):
        plugin = Plugin()
        log_calls = []
        ctx = make_ctx(log_fn=lambda level, msg: log_calls.append((level, msg)))
        with patch("main.is_docker_available_sync", return_value=True), \
             patch("main.is_portainer_installed_sync", return_value=False), \
             patch("main.install_portainer_sync", return_value=False):
            plugin.activate(ctx)
        assert any(level == "warning" for level, _ in log_calls)


# ---------------------------------------------------------------------------
# activate — Portainer already installed (start path)
# ---------------------------------------------------------------------------

class TestActivateAlreadyInstalled:
    def test_active_is_true_when_already_installed(self):
        plugin = Plugin()
        with patch("main.is_docker_available_sync", return_value=True), \
             patch("main.is_portainer_installed_sync", return_value=True), \
             patch("main.start_portainer_sync", return_value=True), \
             patch("main.get_portainer_url_sync", return_value="https://5.6.7.8:9443"):
            plugin.activate(make_ctx())
        assert plugin.active is True

    def test_start_is_called_when_already_installed(self):
        plugin = Plugin()
        with patch("main.is_docker_available_sync", return_value=True), \
             patch("main.is_portainer_installed_sync", return_value=True), \
             patch("main.start_portainer_sync") as mock_start, \
             patch("main.get_portainer_url_sync", return_value="https://5.6.7.8:9443"):
            plugin.activate(make_ctx())
        mock_start.assert_called_once()

    def test_install_not_called_when_already_installed(self):
        plugin = Plugin()
        with patch("main.is_docker_available_sync", return_value=True), \
             patch("main.is_portainer_installed_sync", return_value=True), \
             patch("main.install_portainer_sync") as mock_install, \
             patch("main.start_portainer_sync", return_value=True), \
             patch("main.get_portainer_url_sync", return_value="https://5.6.7.8:9443"):
            plugin.activate(make_ctx())
        mock_install.assert_not_called()

    def test_portainer_url_set_when_already_installed(self):
        plugin = Plugin()
        with patch("main.is_docker_available_sync", return_value=True), \
             patch("main.is_portainer_installed_sync", return_value=True), \
             patch("main.start_portainer_sync", return_value=True), \
             patch("main.get_portainer_url_sync", return_value="https://5.6.7.8:9443"):
            plugin.activate(make_ctx())
        assert plugin.portainer_url == "https://5.6.7.8:9443"


# ---------------------------------------------------------------------------
# deactivate
# ---------------------------------------------------------------------------

class TestDeactivate:
    def test_deactivate_does_not_raise(self):
        plugin = Plugin()
        plugin.deactivate()  # should not raise

    def test_deactivate_after_activate_does_not_raise(self):
        plugin = Plugin()
        with patch("main.is_docker_available_sync", return_value=True), \
             patch("main.is_portainer_installed_sync", return_value=True), \
             patch("main.start_portainer_sync", return_value=True), \
             patch("main.get_portainer_url_sync", return_value="https://5.6.7.8:9443"):
            plugin.activate(make_ctx())
        plugin.deactivate()  # should not raise


# ---------------------------------------------------------------------------
# get_tools
# ---------------------------------------------------------------------------

class TestGetTools:
    def test_returns_empty_list_when_inactive(self):
        plugin = Plugin()
        assert plugin.get_tools() == []

    def test_returns_one_tool_when_active(self):
        plugin = Plugin()
        with patch("main.is_docker_available_sync", return_value=True), \
             patch("main.is_portainer_installed_sync", return_value=True), \
             patch("main.start_portainer_sync", return_value=True), \
             patch("main.get_portainer_url_sync", return_value="https://5.6.7.8:9443"):
            plugin.activate(make_ctx())
        tools = plugin.get_tools()
        assert len(tools) == 1

    def test_tool_name_is_get_portainer_url(self):
        plugin = Plugin()
        with patch("main.is_docker_available_sync", return_value=True), \
             patch("main.is_portainer_installed_sync", return_value=True), \
             patch("main.start_portainer_sync", return_value=True), \
             patch("main.get_portainer_url_sync", return_value="https://5.6.7.8:9443"):
            plugin.activate(make_ctx())
        tool = plugin.get_tools()[0]
        assert tool["name"] == "get_portainer_url"

    def test_tool_has_description(self):
        plugin = Plugin()
        with patch("main.is_docker_available_sync", return_value=True), \
             patch("main.is_portainer_installed_sync", return_value=True), \
             patch("main.start_portainer_sync", return_value=True), \
             patch("main.get_portainer_url_sync", return_value="https://5.6.7.8:9443"):
            plugin.activate(make_ctx())
        tool = plugin.get_tools()[0]
        assert "description" in tool
        assert tool["description"]

    def test_tool_handler_returns_url(self):
        plugin = Plugin()
        with patch("main.is_docker_available_sync", return_value=True), \
             patch("main.is_portainer_installed_sync", return_value=True), \
             patch("main.start_portainer_sync", return_value=True), \
             patch("main.get_portainer_url_sync", return_value="https://5.6.7.8:9443"):
            plugin.activate(make_ctx())
        tool = plugin.get_tools()[0]
        assert tool["handler"]() == "https://5.6.7.8:9443"

    def test_tool_handler_returns_correct_url_after_activate(self):
        plugin = Plugin()
        expected_url = "https://192.168.0.50:9443"
        with patch("main.is_docker_available_sync", return_value=True), \
             patch("main.is_portainer_installed_sync", return_value=True), \
             patch("main.start_portainer_sync", return_value=True), \
             patch("main.get_portainer_url_sync", return_value=expected_url):
            plugin.activate(make_ctx())
        tool = plugin.get_tools()[0]
        assert tool["handler"]() == expected_url
