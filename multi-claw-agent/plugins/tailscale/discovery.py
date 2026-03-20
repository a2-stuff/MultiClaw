import asyncio
import json
import subprocess


async def get_tailscale_status() -> dict:
    """Run `tailscale status --json` and return parsed output."""
    proc = await asyncio.create_subprocess_exec(
        "tailscale", "status", "--json",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError("tailscale status failed")
    return json.loads(stdout.decode())


async def discover_peers(tag: str) -> list[dict]:
    """Find peers with a specific Tailscale tag."""
    status = await get_tailscale_status()
    peers = []
    for _key, peer in status.get("Peer", {}).items():
        peer_tags = peer.get("Tags") or []
        if tag in peer_tags:
            peers.append({
                "hostname": peer.get("HostName", ""),
                "ip": peer["TailscaleIPs"][0] if peer.get("TailscaleIPs") else "",
                "online": peer.get("Online", False),
                "tags": peer_tags,
            })
    return peers


async def discover_dashboard() -> dict | None:
    """Find the first online peer tagged as multiclaw-dashboard."""
    peers = await discover_peers("tag:multiclaw-dashboard")
    for p in peers:
        if p["online"]:
            return p
    return peers[0] if peers else None


async def get_tailscale_ip() -> str:
    """Get this node's Tailscale IPv4 address."""
    proc = await asyncio.create_subprocess_exec(
        "tailscale", "ip", "-4",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError("tailscale ip failed")
    return stdout.decode().strip()


async def is_tailscale_running() -> bool:
    """Check if tailscaled is active."""
    proc = await asyncio.create_subprocess_exec(
        "tailscale", "status",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc.communicate()
    return proc.returncode == 0


def get_tailscale_ip_sync() -> str:
    """Synchronous version for use at startup before event loop."""
    result = subprocess.run(
        ["tailscale", "ip", "-4"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError("tailscale ip failed")
    return result.stdout.strip()


def is_tailscale_running_sync() -> bool:
    """Synchronous version for use at startup."""
    result = subprocess.run(
        ["tailscale", "status"],
        capture_output=True, text=True,
    )
    return result.returncode == 0
