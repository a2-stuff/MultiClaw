import subprocess
import pytest
from unittest.mock import patch, MagicMock


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_run(returncode: int = 0, stdout: str = "", stderr: str = ""):
    m = MagicMock()
    m.returncode = returncode
    m.stdout = stdout
    m.stderr = stderr
    return m


# ---------------------------------------------------------------------------
# is_docker_installed_sync
# ---------------------------------------------------------------------------

def test_is_docker_installed_returns_true_when_present():
    from installer import is_docker_installed_sync
    with patch("subprocess.run", return_value=_mock_run(0, "Docker version 24.0.0")) as mock_run:
        assert is_docker_installed_sync() is True
        mock_run.assert_called_once_with(
            ["docker", "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )


def test_is_docker_installed_returns_false_when_missing():
    from installer import is_docker_installed_sync
    with patch("subprocess.run", side_effect=FileNotFoundError):
        assert is_docker_installed_sync() is False


def test_is_docker_installed_returns_false_on_timeout():
    from installer import is_docker_installed_sync
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="docker", timeout=10)):
        assert is_docker_installed_sync() is False


def test_is_docker_installed_returns_false_on_nonzero():
    from installer import is_docker_installed_sync
    with patch("subprocess.run", return_value=_mock_run(1)):
        assert is_docker_installed_sync() is False


# ---------------------------------------------------------------------------
# is_docker_running_sync
# ---------------------------------------------------------------------------

def test_is_docker_running_returns_true_when_daemon_up():
    from installer import is_docker_running_sync
    with patch("subprocess.run", return_value=_mock_run(0)) as mock_run:
        assert is_docker_running_sync() is True
        mock_run.assert_called_once_with(
            ["docker", "info"],
            capture_output=True,
            text=True,
            timeout=15,
        )


def test_is_docker_running_returns_false_when_daemon_down():
    from installer import is_docker_running_sync
    with patch("subprocess.run", return_value=_mock_run(1)):
        assert is_docker_running_sync() is False


def test_is_docker_running_returns_false_on_file_not_found():
    from installer import is_docker_running_sync
    with patch("subprocess.run", side_effect=FileNotFoundError):
        assert is_docker_running_sync() is False


def test_is_docker_running_returns_false_on_timeout():
    from installer import is_docker_running_sync
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="docker", timeout=15)):
        assert is_docker_running_sync() is False


# ---------------------------------------------------------------------------
# get_docker_version_sync
# ---------------------------------------------------------------------------

def test_get_docker_version_returns_string():
    from installer import get_docker_version_sync
    version_str = "Docker version 24.0.7, build afdd53b"
    with patch("subprocess.run", return_value=_mock_run(0, version_str)):
        result = get_docker_version_sync()
        assert result == version_str


def test_get_docker_version_returns_empty_on_failure():
    from installer import get_docker_version_sync
    with patch("subprocess.run", return_value=_mock_run(1)):
        assert get_docker_version_sync() == ""


def test_get_docker_version_returns_empty_on_file_not_found():
    from installer import get_docker_version_sync
    with patch("subprocess.run", side_effect=FileNotFoundError):
        assert get_docker_version_sync() == ""


def test_get_docker_version_returns_empty_on_timeout():
    from installer import get_docker_version_sync
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="docker", timeout=10)):
        assert get_docker_version_sync() == ""


# ---------------------------------------------------------------------------
# install_docker_sync
# ---------------------------------------------------------------------------

def test_install_docker_returns_true_on_success():
    from installer import install_docker_sync
    with patch("subprocess.run", return_value=_mock_run(0)) as mock_run:
        with patch("os.environ.get", return_value="testuser"):
            result = install_docker_sync()
    assert result is True


def test_install_docker_returns_false_on_script_failure():
    from installer import install_docker_sync
    with patch("subprocess.run", return_value=_mock_run(1)):
        result = install_docker_sync()
    assert result is False


def test_install_docker_returns_false_on_file_not_found():
    from installer import install_docker_sync
    with patch("subprocess.run", side_effect=FileNotFoundError):
        result = install_docker_sync()
    assert result is False


def test_install_docker_returns_false_on_timeout():
    from installer import install_docker_sync
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="sh", timeout=300)):
        result = install_docker_sync()
    assert result is False


# ---------------------------------------------------------------------------
# start_docker_sync
# ---------------------------------------------------------------------------

def test_start_docker_returns_true_on_success():
    from installer import start_docker_sync
    with patch("subprocess.run", return_value=_mock_run(0)) as mock_run:
        assert start_docker_sync() is True
        mock_run.assert_called_once_with(
            ["sudo", "systemctl", "start", "docker"],
            capture_output=True,
            text=True,
            timeout=30,
        )


def test_start_docker_returns_false_on_failure():
    from installer import start_docker_sync
    with patch("subprocess.run", return_value=_mock_run(1)):
        assert start_docker_sync() is False


def test_start_docker_returns_false_on_file_not_found():
    from installer import start_docker_sync
    with patch("subprocess.run", side_effect=FileNotFoundError):
        assert start_docker_sync() is False


def test_start_docker_returns_false_on_timeout():
    from installer import start_docker_sync
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="sudo", timeout=30)):
        assert start_docker_sync() is False
