import subprocess
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock
import pytest

from installer import (
    is_docker_available_sync,
    is_portainer_installed_sync,
    install_portainer_sync,
    start_portainer_sync,
    get_portainer_url_sync,
)


# ---------------------------------------------------------------------------
# is_docker_available_sync
# ---------------------------------------------------------------------------

class TestIsDockerAvailableSync:
    def test_returns_true_when_docker_exits_zero(self):
        mock_result = MagicMock(returncode=0)
        with patch("installer.subprocess.run", return_value=mock_result) as mock_run:
            assert is_docker_available_sync() is True
            mock_run.assert_called_once_with(
                ["docker", "--version"],
                capture_output=True,
                text=True,
                timeout=10,
            )

    def test_returns_false_when_docker_exits_nonzero(self):
        mock_result = MagicMock(returncode=1)
        with patch("installer.subprocess.run", return_value=mock_result):
            assert is_docker_available_sync() is False

    def test_returns_false_on_file_not_found(self):
        with patch("installer.subprocess.run", side_effect=FileNotFoundError):
            assert is_docker_available_sync() is False

    def test_returns_false_on_timeout(self):
        with patch("installer.subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="docker", timeout=10)):
            assert is_docker_available_sync() is False


# ---------------------------------------------------------------------------
# is_portainer_installed_sync
# ---------------------------------------------------------------------------

class TestIsPortainerInstalledSync:
    def test_returns_true_when_portainer_in_output(self):
        mock_result = MagicMock(returncode=0, stdout="portainer\n")
        with patch("installer.subprocess.run", return_value=mock_result) as mock_run:
            assert is_portainer_installed_sync() is True
            mock_run.assert_called_once_with(
                ["docker", "ps", "-a", "--filter", "name=portainer", "--format", "{{.Names}}"],
                capture_output=True,
                text=True,
                timeout=10,
            )

    def test_returns_false_when_portainer_not_in_output(self):
        mock_result = MagicMock(returncode=0, stdout="")
        with patch("installer.subprocess.run", return_value=mock_result):
            assert is_portainer_installed_sync() is False

    def test_returns_false_on_file_not_found(self):
        with patch("installer.subprocess.run", side_effect=FileNotFoundError):
            assert is_portainer_installed_sync() is False

    def test_returns_false_on_timeout(self):
        with patch("installer.subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="docker", timeout=10)):
            assert is_portainer_installed_sync() is False


# ---------------------------------------------------------------------------
# install_portainer_sync
# ---------------------------------------------------------------------------

class TestInstallPortainerSync:
    def test_returns_true_on_success(self):
        volume_result = MagicMock(returncode=0)
        run_result = MagicMock(returncode=0)
        with patch("installer.subprocess.run", side_effect=[volume_result, run_result]) as mock_run:
            assert install_portainer_sync() is True
            assert mock_run.call_count == 2
            # First call: volume create
            first_call_args = mock_run.call_args_list[0][0][0]
            assert "volume" in first_call_args
            assert "create" in first_call_args
            assert "portainer_data" in first_call_args
            # Second call: docker run
            second_call_args = mock_run.call_args_list[1][0][0]
            assert "run" in second_call_args
            assert "portainer/portainer-ce:lts" in second_call_args

    def test_returns_false_when_volume_creation_fails(self):
        volume_result = MagicMock(returncode=1)
        with patch("installer.subprocess.run", return_value=volume_result):
            assert install_portainer_sync() is False

    def test_returns_false_when_docker_run_fails(self):
        volume_result = MagicMock(returncode=0)
        run_result = MagicMock(returncode=1)
        with patch("installer.subprocess.run", side_effect=[volume_result, run_result]):
            assert install_portainer_sync() is False

    def test_returns_false_on_file_not_found(self):
        with patch("installer.subprocess.run", side_effect=FileNotFoundError):
            assert install_portainer_sync() is False

    def test_returns_false_on_timeout(self):
        with patch("installer.subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="docker", timeout=30)):
            assert install_portainer_sync() is False

    def test_docker_run_includes_required_flags(self):
        volume_result = MagicMock(returncode=0)
        run_result = MagicMock(returncode=0)
        with patch("installer.subprocess.run", side_effect=[volume_result, run_result]) as mock_run:
            install_portainer_sync()
            run_args = mock_run.call_args_list[1][0][0]
            assert "-p" in run_args
            assert "8000:8000" in run_args
            assert "9443:9443" in run_args
            assert "--name" in run_args
            assert "portainer" in run_args
            assert "--restart=always" in run_args
            assert "/var/run/docker.sock:/var/run/docker.sock" in run_args
            assert "portainer_data:/data" in run_args


# ---------------------------------------------------------------------------
# start_portainer_sync
# ---------------------------------------------------------------------------

class TestStartPortainerSync:
    def test_returns_true_on_success(self):
        mock_result = MagicMock(returncode=0)
        with patch("installer.subprocess.run", return_value=mock_result) as mock_run:
            assert start_portainer_sync() is True
            mock_run.assert_called_once_with(
                ["docker", "start", "portainer"],
                capture_output=True,
                text=True,
                timeout=30,
            )

    def test_returns_false_on_nonzero_exit(self):
        mock_result = MagicMock(returncode=1)
        with patch("installer.subprocess.run", return_value=mock_result):
            assert start_portainer_sync() is False

    def test_returns_false_on_file_not_found(self):
        with patch("installer.subprocess.run", side_effect=FileNotFoundError):
            assert start_portainer_sync() is False

    def test_returns_false_on_timeout(self):
        with patch("installer.subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="docker", timeout=30)):
            assert start_portainer_sync() is False


# ---------------------------------------------------------------------------
# get_portainer_url_sync
# ---------------------------------------------------------------------------

class TestGetPortainerUrlSync:
    def test_returns_url_with_detected_ip(self):
        mock_result = MagicMock(returncode=0, stdout="192.168.1.100 172.17.0.1\n")
        with patch("installer.subprocess.run", return_value=mock_result):
            url = get_portainer_url_sync()
            assert url == "https://192.168.1.100:9443"

    def test_falls_back_to_localhost_on_file_not_found(self):
        with patch("installer.subprocess.run", side_effect=FileNotFoundError):
            url = get_portainer_url_sync()
            assert url == "https://localhost:9443"

    def test_falls_back_to_localhost_on_timeout(self):
        with patch("installer.subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="hostname", timeout=10)):
            url = get_portainer_url_sync()
            assert url == "https://localhost:9443"

    def test_falls_back_to_localhost_on_empty_output(self):
        mock_result = MagicMock(returncode=0, stdout="")
        with patch("installer.subprocess.run", return_value=mock_result):
            url = get_portainer_url_sync()
            assert url == "https://localhost:9443"

    def test_url_scheme_is_https(self):
        mock_result = MagicMock(returncode=0, stdout="10.0.0.1\n")
        with patch("installer.subprocess.run", return_value=mock_result):
            url = get_portainer_url_sync()
            assert url.startswith("https://")

    def test_url_port_is_9443(self):
        mock_result = MagicMock(returncode=0, stdout="10.0.0.1\n")
        with patch("installer.subprocess.run", return_value=mock_result):
            url = get_portainer_url_sync()
            assert url.endswith(":9443")
