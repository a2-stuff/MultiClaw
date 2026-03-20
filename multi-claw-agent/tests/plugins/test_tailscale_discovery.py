import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

MOCK_STATUS = {
    "Self": {
        "TailscaleIPs": ["100.64.0.1"],
        "HostName": "dashboard-host",
        "DNSName": "dashboard-host.tailnet.ts.net.",
        "Online": True,
        "Tags": ["tag:multiclaw-dashboard"],
    },
    "Peer": {
        "nodekey:abc123": {
            "TailscaleIPs": ["100.64.0.2"],
            "HostName": "agent-1",
            "DNSName": "agent-1.tailnet.ts.net.",
            "Online": True,
            "Tags": ["tag:multiclaw-agent"],
        },
        "nodekey:def456": {
            "TailscaleIPs": ["100.64.0.3"],
            "HostName": "agent-2",
            "DNSName": "agent-2.tailnet.ts.net.",
            "Online": False,
            "Tags": ["tag:multiclaw-agent"],
        },
        "nodekey:ghi789": {
            "TailscaleIPs": ["100.64.0.4"],
            "HostName": "other-machine",
            "DNSName": "other-machine.tailnet.ts.net.",
            "Online": True,
            "Tags": [],
        },
    },
}


def make_mock_process(stdout: str, returncode: int = 0):
    proc = AsyncMock()
    proc.communicate = AsyncMock(return_value=(stdout.encode(), b""))
    proc.returncode = returncode
    return proc


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_get_tailscale_status(mock_exec):
    from plugins.tailscale.discovery import get_tailscale_status
    mock_exec.return_value = make_mock_process(json.dumps(MOCK_STATUS))
    status = await get_tailscale_status()
    assert status["Self"]["HostName"] == "dashboard-host"
    assert len(status["Peer"]) == 3


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_discover_peers_by_tag(mock_exec):
    from plugins.tailscale.discovery import discover_peers
    mock_exec.return_value = make_mock_process(json.dumps(MOCK_STATUS))
    peers = await discover_peers("tag:multiclaw-agent")
    assert len(peers) == 2
    assert peers[0]["hostname"] == "agent-1"
    assert peers[0]["ip"] == "100.64.0.2"
    assert peers[0]["online"] is True
    assert peers[1]["hostname"] == "agent-2"
    assert peers[1]["online"] is False


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_discover_peers_no_match(mock_exec):
    from plugins.tailscale.discovery import discover_peers
    mock_exec.return_value = make_mock_process(json.dumps(MOCK_STATUS))
    peers = await discover_peers("tag:nonexistent")
    assert peers == []


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_discover_dashboard(mock_exec):
    from plugins.tailscale.discovery import discover_dashboard
    status = json.loads(json.dumps(MOCK_STATUS))
    status["Peer"]["nodekey:dash1"] = {
        "TailscaleIPs": ["100.64.0.10"],
        "HostName": "my-dashboard",
        "DNSName": "my-dashboard.tailnet.ts.net.",
        "Online": True,
        "Tags": ["tag:multiclaw-dashboard"],
    }
    mock_exec.return_value = make_mock_process(json.dumps(status))
    result = await discover_dashboard()
    assert result is not None
    assert result["ip"] == "100.64.0.10"
    assert result["hostname"] == "my-dashboard"


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_get_tailscale_ip(mock_exec):
    from plugins.tailscale.discovery import get_tailscale_ip
    mock_exec.return_value = make_mock_process("100.64.0.1\n")
    ip = await get_tailscale_ip()
    assert ip == "100.64.0.1"


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_is_tailscale_running_true(mock_exec):
    from plugins.tailscale.discovery import is_tailscale_running
    mock_exec.return_value = make_mock_process("100.64.0.1 dashboard-host")
    result = await is_tailscale_running()
    assert result is True


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_is_tailscale_running_false(mock_exec):
    from plugins.tailscale.discovery import is_tailscale_running
    mock_exec.return_value = make_mock_process("", returncode=1)
    result = await is_tailscale_running()
    assert result is False


def test_get_tailscale_ip_sync():
    from plugins.tailscale.discovery import get_tailscale_ip_sync
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout="100.64.0.1\n", returncode=0)
        ip = get_tailscale_ip_sync()
        assert ip == "100.64.0.1"


def test_is_tailscale_running_sync():
    from plugins.tailscale.discovery import is_tailscale_running_sync
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        assert is_tailscale_running_sync() is True
