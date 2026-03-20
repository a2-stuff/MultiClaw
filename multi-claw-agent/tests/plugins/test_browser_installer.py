import pytest
from unittest.mock import patch, MagicMock


def test_check_playwright_installed_true():
    with patch("importlib.util.find_spec", return_value=MagicMock()):
        from plugins.browser_control.installer import check_playwright_installed
        assert check_playwright_installed() is True


def test_check_playwright_installed_false():
    with patch("importlib.util.find_spec", return_value=None):
        from plugins.browser_control.installer import check_playwright_installed
        assert check_playwright_installed() is False


@patch("subprocess.run")
def test_ensure_browser_binary_success(mock_run):
    mock_run.return_value = MagicMock(returncode=0)
    from plugins.browser_control.installer import ensure_browser_binary
    assert ensure_browser_binary("chromium") is True


@patch("subprocess.run")
def test_ensure_browser_binary_failure(mock_run):
    mock_run.return_value = MagicMock(returncode=1, stderr="error")
    from plugins.browser_control.installer import ensure_browser_binary
    assert ensure_browser_binary("chromium") is False


@patch("subprocess.run", side_effect=Exception("timeout"))
def test_ensure_browser_binary_exception(mock_run):
    from plugins.browser_control.installer import ensure_browser_binary
    assert ensure_browser_binary("chromium") is False


@patch("sys.platform", "linux")
@patch("subprocess.run")
def test_ensure_system_deps_runs_on_linux(mock_run):
    mock_run.return_value = MagicMock(returncode=0)
    from plugins.browser_control.installer import ensure_system_deps
    ensure_system_deps("chromium")
    mock_run.assert_called_once()
