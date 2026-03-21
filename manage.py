#!/usr/bin/env python3
"""MultiClaw CLI management tool."""

import getpass
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import click
import httpx
import psutil
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

# ---------------------------------------------------------------------------
# Paths & constants
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent
DASHBOARD_DIR = ROOT / "multi-claw-dashboard"
AGENT_DIR = ROOT / "multi-claw-agent"
SERVICES = {
    "dashboard": "multiclaw-dashboard",
    "agent": "multiclaw-agent",
}
console = Console()

DASHBOARD_UNIT = """\
[Unit]
Description=MultiClaw Dashboard
After=network.target

[Service]
Type=simple
User={user}
WorkingDirectory={work_dir}
EnvironmentFile=-{work_dir}/.env
ExecStart={node} --import tsx server/index.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
"""

AGENT_UNIT = """\
[Unit]
Description=MultiClaw Agent
After=network.target

[Service]
Type=simple
User={user}
WorkingDirectory={work_dir}
EnvironmentFile=-{work_dir}/.env
ExecStart={python} -m uvicorn src.main:app --host 0.0.0.0
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
"""


def _read_env(env_path: Path) -> dict[str, str]:
    """Parse a .env file into a dict. Strips quotes and comments."""
    env: dict[str, str] = {}
    if not env_path.exists():
        return env
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        val = val.strip().strip("\"'")
        env[key.strip()] = val
    return env


def _dashboard_port() -> int:
    env = _read_env(DASHBOARD_DIR / ".env")
    return int(env.get("PORT", "3100"))


def _agent_port() -> int:
    env = _read_env(AGENT_DIR / ".env")
    return int(env.get("MULTICLAW_PORT", "8100"))


def _systemctl(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    """Run a systemctl command with sudo."""
    cmd = ["sudo", "systemctl", *args]
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def _systemctl_show(unit: str) -> dict[str, str]:
    """Get systemd service properties without sudo."""
    result = subprocess.run(
        ["systemctl", "show", unit,
         "--property=ActiveState,SubState,MainPID,ActiveEnterTimestamp,Description"],
        capture_output=True, text=True, check=False,
    )
    props: dict[str, str] = {}
    for line in result.stdout.splitlines():
        if "=" in line:
            k, _, v = line.partition("=")
            props[k] = v
    return props


def _service_info(unit: str) -> dict:
    """Gather service state, PID, uptime, CPU, memory."""
    props = _systemctl_show(unit)
    active = props.get("ActiveState", "unknown")
    pid = int(props.get("MainPID", "0"))
    info: dict = {
        "state": active,
        "pid": pid if pid > 0 else None,
        "uptime": None,
        "cpu": None,
        "memory": None,
    }
    if active == "active" and pid > 0:
        try:
            proc = psutil.Process(pid)
            started = datetime.fromtimestamp(proc.create_time(), tz=timezone.utc)
            delta = datetime.now(tz=timezone.utc) - started
            info["uptime"] = delta.total_seconds()
            info["cpu"] = proc.cpu_percent(interval=0.1)
            mem = proc.memory_info()
            info["memory"] = mem.rss
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return info


def _format_uptime(seconds: float | None) -> str:
    if seconds is None:
        return "—"
    s = int(seconds)
    days, s = divmod(s, 86400)
    hours, s = divmod(s, 3600)
    mins, _ = divmod(s, 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    parts.append(f"{mins}m")
    return " ".join(parts)


def _format_bytes(n: int | None) -> str:
    if n is None:
        return "—"
    if n < 1024 * 1024:
        return f"{n / 1024:.0f} KB"
    if n < 1024 * 1024 * 1024:
        return f"{n / (1024 * 1024):.1f} MB"
    return f"{n / (1024 * 1024 * 1024):.1f} GB"


def _get_version() -> str:
    pkg = DASHBOARD_DIR / "package.json"
    if pkg.exists():
        try:
            return json.loads(pkg.read_text()).get("version", "0.1.0")
        except Exception:
            pass
    return "0.1.0"


def _fetch_health(port: int) -> dict | None:
    """Fetch /health endpoint with 2s timeout. Returns None on failure."""
    try:
        r = httpx.get(f"http://127.0.0.1:{port}/health", timeout=2.0)
        if r.status_code == 200:
            return r.json()
    except (httpx.RequestError, ValueError):
        pass
    return None


def _query_agents_db() -> tuple[int, int]:
    """Read agent counts directly from dashboard SQLite DB.
    Returns (total, online)."""
    db_path = DASHBOARD_DIR / "data" / "multiclaw.db"
    if not db_path.exists():
        return 0, 0
    try:
        with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
            total = conn.execute("SELECT COUNT(*) FROM agents").fetchone()[0]
            online = conn.execute(
                "SELECT COUNT(*) FROM agents WHERE status = 'online'"
            ).fetchone()[0]
        return total, online
    except Exception:
        return 0, 0


def _count_dir_entries(directory: Path) -> int:
    """Count immediate subdirectories (skills, plugins, etc.)."""
    if not directory.exists():
        return 0
    return sum(1 for p in directory.iterdir() if p.is_dir() and not p.name.startswith((".", "_")))


def _count_crons(agent_dir: Path) -> int:
    """Count cron entries from crons.json."""
    crons_file = agent_dir / "crons.json"
    if not crons_file.exists():
        return 0
    try:
        data = json.loads(crons_file.read_text())
        return len(data) if isinstance(data, list) else 0
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# CLI group
# ---------------------------------------------------------------------------
@click.group()
@click.version_option(version=_get_version(), prog_name="multiclaw")
def cli():
    """MultiClaw service management CLI."""
    pass


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

@cli.command()
def status():
    """Show status of all MultiClaw services."""
    dash_port = _dashboard_port()
    agent_port = _agent_port()

    # Gather service info
    dash_info = _service_info(SERVICES["dashboard"])
    agent_info = _service_info(SERVICES["agent"])

    # Main status table
    table = Table(show_header=True, header_style="bold cyan", box=None, padding=(0, 2))
    table.add_column("Service", style="bold")
    table.add_column("State")
    table.add_column("PID", justify="right")
    table.add_column("Uptime", justify="right")
    table.add_column("CPU", justify="right")
    table.add_column("Memory", justify="right")

    for name, info in [("Dashboard", dash_info), ("Agent", agent_info)]:
        if info["state"] == "active":
            state = Text("● online", style="green")
        elif info["state"] == "failed":
            state = Text("● failed", style="red")
        else:
            state = Text("○ stopped", style="dim")

        table.add_row(
            name,
            state,
            str(info["pid"]) if info["pid"] else "—",
            _format_uptime(info["uptime"]),
            f"{info['cpu']:.1f}%" if info["cpu"] is not None else "—",
            _format_bytes(info["memory"]),
        )

    console.print(Panel(table, title="[bold]MultiClaw Status[/bold]", border_style="blue"))

    # Dashboard details
    dash_health = _fetch_health(dash_port) if dash_info["state"] == "active" else None
    total_agents, online_agents = _query_agents_db()
    db_path = DASHBOARD_DIR / "data" / "multiclaw.db"
    db_size = _format_bytes(db_path.stat().st_size) if db_path.exists() else "—"

    dash_lines = []
    dash_lines.append(f"Agents: {total_agents} registered ({online_agents} online)    DB: {db_size}")
    version = dash_health.get("version", "—") if dash_health else "—"
    dash_lines.append(f"Port: {dash_port}                         Version: {version}")
    console.print(Panel("\n".join(dash_lines), title="[bold]Dashboard[/bold]", border_style="cyan"))

    # Agent details
    agent_health = _fetch_health(agent_port) if agent_info["state"] == "active" else None
    skills_count = _count_dir_entries(AGENT_DIR / "skills")
    plugins_count = _count_dir_entries(AGENT_DIR / "plugins")
    crons_count = _count_crons(AGENT_DIR)

    agent_lines = []
    if agent_health and "tasks" in agent_health:
        t = agent_health["tasks"]
        agent_lines.append(
            f"Tasks: {t.get('completed', 0)} completed, "
            f"{t.get('active', 0)} active, {t.get('failed', 0)} failed"
        )
    else:
        agent_lines.append("Tasks: —")
    agent_lines.append(
        f"Skills: {skills_count} loaded    "
        f"Plugins: {plugins_count} loaded    "
        f"Crons: {crons_count} scheduled"
    )
    a_version = agent_health.get("version", "—") if agent_health else "—"
    agent_lines.append(f"Port: {agent_port}                         Version: {a_version}")
    console.print(Panel("\n".join(agent_lines), title="[bold]Agent[/bold]", border_style="green"))


SERVICE_CHOICES = click.Choice(["dashboard", "agent", "all"])


def _resolve_services(service: str) -> list[str]:
    """Resolve service name to list of systemd unit names."""
    if service == "all":
        return list(SERVICES.values())
    return [SERVICES[service]]


_ACTION_LABELS = {
    "start": ("Starting", "started"),
    "stop": ("Stopping", "stopped"),
    "restart": ("Restarting", "restarted"),
}


def _control_service(action: str, service: str):
    """Start/stop/restart service(s) and print status."""
    ing, ed = _ACTION_LABELS.get(action, (f"{action.capitalize()}ing", f"{action}ed"))
    units = _resolve_services(service)
    for unit in units:
        console.print(f"[bold]{ing}[/bold] {unit}...")
        try:
            _systemctl(action, unit)
            console.print(f"  [green]✓[/green] {unit} {ed}")
        except subprocess.CalledProcessError as e:
            console.print(f"  [red]✗[/red] {unit} failed: {e.stderr.strip()}")
            sys.exit(1)
    if action in ("start", "restart"):
        time.sleep(2)
    console.print()
    ctx = click.Context(status)
    ctx.invoke(status)


@cli.command()
@click.argument("service", default="all", type=SERVICE_CHOICES)
def start(service):
    """Start MultiClaw services."""
    _control_service("start", service)


@cli.command()
@click.argument("service", default="all", type=SERVICE_CHOICES)
def stop(service):
    """Stop MultiClaw services."""
    _control_service("stop", service)


@cli.command()
@click.argument("service", default="all", type=SERVICE_CHOICES)
def restart(service):
    """Restart MultiClaw services."""
    _control_service("restart", service)


@cli.command()
@click.argument("service", type=click.Choice(["dashboard", "agent"]))
@click.option("-n", "--lines", default=50, help="Number of lines to show.")
@click.option("-f", "--follow", is_flag=True, help="Follow log output.")
def logs(service, lines, follow):
    """Tail logs for a MultiClaw service.

    SERVICE must be 'dashboard' or 'agent' (not 'all' — use two terminals
    to follow both simultaneously).
    """
    unit = SERVICES[service]
    cmd = ["journalctl", "-u", unit, "-n", str(lines)]
    if follow:
        cmd.append("--follow")
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        console.print(f"[red]Failed to read logs:[/red] {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        pass


@cli.command()
@click.option("-y", "--yes", is_flag=True, help="Skip confirmation prompts.")
def install(yes):
    """Generate and install systemd unit files for both services."""
    user = getpass.getuser()
    node = shutil.which("node")
    venv_python = AGENT_DIR / ".venv" / "bin" / "python"

    if not node:
        console.print("[red]Error:[/red] node not found in PATH. Run install.sh first.")
        sys.exit(1)
    if not venv_python.exists():
        console.print(f"[red]Error:[/red] Python venv not found at {venv_python}. Run install.sh first.")
        sys.exit(1)

    units = {
        f"/etc/systemd/system/{SERVICES['dashboard']}.service": DASHBOARD_UNIT.format(
            user=user,
            work_dir=DASHBOARD_DIR,
            node=node,
        ),
        f"/etc/systemd/system/{SERVICES['agent']}.service": AGENT_UNIT.format(
            user=user,
            work_dir=AGENT_DIR,
            python=venv_python,
        ),
    }

    # Check for existing unit files
    existing = [p for p in units if Path(p).exists()]
    if existing and not yes:
        console.print("[yellow]Warning:[/yellow] Existing unit files found:")
        for p in existing:
            console.print(f"  {p}")
        if not click.confirm("Overwrite?", default=False):
            console.print("Aborted.")
            return

    # Write unit files via sudo tee
    for path, content in units.items():
        subprocess.run(
            ["sudo", "tee", path],
            input=content, capture_output=True, text=True, check=True,
        )
        console.print(f"  [green]✓[/green] Wrote {path}")

    _systemctl("daemon-reload")
    console.print("  [green]✓[/green] Reloaded systemd daemon")

    for unit in SERVICES.values():
        _systemctl("enable", unit)
        console.print(f"  [green]✓[/green] Enabled {unit}")

    if yes or click.confirm("\nStart services now?", default=True):
        for unit in SERVICES.values():
            _systemctl("start", unit)
            console.print(f"  [green]✓[/green] Started {unit}")
        time.sleep(2)
        console.print()
        ctx = click.Context(status)
        ctx.invoke(status)
    else:
        console.print("\nServices installed but not started. Use [bold]manage.py start[/bold] when ready.")


@cli.command()
@click.option("-y", "--yes", is_flag=True, help="Skip confirmation prompt.")
def uninstall(yes):
    """Stop, disable, and remove systemd unit files for both services."""
    if not yes:
        if not click.confirm(
            "This will stop and remove both MultiClaw services. Continue?",
            default=False,
        ):
            console.print("Aborted.")
            return

    for unit in SERVICES.values():
        _systemctl("stop", unit, check=False)
        console.print(f"  [green]✓[/green] Stopped {unit}")
        _systemctl("disable", unit, check=False)
        console.print(f"  [green]✓[/green] Disabled {unit}")

    for name in SERVICES.values():
        path = Path(f"/etc/systemd/system/{name}.service")
        if path.exists():
            subprocess.run(["sudo", "rm", str(path)], check=True)
            console.print(f"  [green]✓[/green] Removed {path}")

    _systemctl("daemon-reload")
    console.print("  [green]✓[/green] Reloaded systemd daemon")
    console.print("\n[bold]MultiClaw services removed.[/bold]")


def _run_step(description: str, cmd: list[str], cwd: Path | None = None) -> bool:
    """Run a build step, print result. Returns True on success."""
    console.print(f"  [bold]{description}...[/bold]")
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if result.returncode != 0:
        console.print(f"  [red]✗ Failed:[/red] {description}")
        if result.stderr.strip():
            console.print(f"    {result.stderr.strip()[:200]}")
        return False
    console.print(f"  [green]✓[/green] {description}")
    return True


@cli.command()
def update():
    """Pull latest code, rebuild, and restart services."""
    # Check for dirty working tree
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=ROOT, capture_output=True, text=True,
    )
    if result.stdout.strip():
        console.print("[red]Error:[/red] Working tree has uncommitted changes:")
        for line in result.stdout.strip().splitlines()[:10]:
            console.print(f"  {line}")
        console.print("\nCommit or stash changes before updating.")
        sys.exit(1)

    # Check which services are currently running
    was_running: list[str] = []
    for name, unit in SERVICES.items():
        info = _service_info(unit)
        if info["state"] == "active":
            was_running.append(name)

    if was_running:
        console.print(f"Stopping running services: {', '.join(was_running)}")
        for name in was_running:
            _systemctl("stop", SERVICES[name], check=False)

    console.print("\n[bold]Updating...[/bold]")

    # Git pull
    if not _run_step("git pull", ["git", "pull", "origin", "main"], cwd=ROOT):
        console.print("[red]Update aborted at git pull.[/red]")
        sys.exit(1)

    # Build steps — fail fast on first error
    steps = [
        ("npm install (dashboard)", ["npm", "install"], DASHBOARD_DIR),
        ("npm install (client)", ["npm", "install"], DASHBOARD_DIR / "client"),
        ("Build client", ["npm", "run", "build"], DASHBOARD_DIR / "client"),
        ("pip install (agent)", [str(AGENT_DIR / ".venv" / "bin" / "pip"), "install", "-e", "."], AGENT_DIR),
        ("Run DB migrations", ["npx", "tsx", "server/db/migrate.ts"], DASHBOARD_DIR),
    ]
    for desc, cmd, cwd in steps:
        if not _run_step(desc, cmd, cwd):
            console.print(f"\n[red]Build failed at: {desc}. Skipping restart.[/red]")
            sys.exit(1)

    # Restart previously-running services
    if was_running:
        console.print(f"\nRestarting services: {', '.join(was_running)}")
        for name in was_running:
            _systemctl("start", SERVICES[name])
            console.print(f"  [green]✓[/green] Started {SERVICES[name]}")
        time.sleep(2)

    console.print()
    ctx = click.Context(status)
    ctx.invoke(status)


@cli.command()
def tui():
    """Launch interactive TUI dashboard."""
    subprocess.run([sys.executable, str(ROOT / "tui.py")], check=True)


@cli.command(name="agents")
def list_agents():
    """List all registered agents and their status."""
    db_path = DASHBOARD_DIR / "data" / "multiclaw.db"
    if not db_path.exists():
        console.print("[red]Database not found.[/red] Is the dashboard installed?")
        sys.exit(1)

    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
        rows = conn.execute(
            "SELECT name, url, status, last_seen, spawned_locally, spawn_pid, spawn_port, spawn_dir, spawn_host FROM agents ORDER BY name"
        ).fetchall()

    if not rows:
        console.print("No agents registered.")
        return

    table = Table(show_header=True, header_style="bold cyan", box=None, padding=(0, 2))
    table.add_column("Name", style="bold")
    table.add_column("URL")
    table.add_column("State")
    table.add_column("PID", justify="right")
    table.add_column("Port", justify="right")
    table.add_column("Host")

    for name, url, status, last_seen, spawned, pid, port, sdir, host in rows:
        if status == "online":
            state = Text("● online", style="green")
        elif status == "error":
            state = Text("● error", style="red")
        else:
            state = Text("○ offline", style="dim")

        table.add_row(
            name,
            url,
            state,
            str(pid) if pid else "—",
            str(port) if port else "—",
            host or ("local" if spawned else "remote"),
        )

    console.print(Panel(table, title="[bold]Agents[/bold]", border_style="green"))


@cli.command(name="restart-agent")
@click.argument("agent_name")
def restart_agent(agent_name):
    """Restart a specific spawned agent by name."""
    db_path = DASHBOARD_DIR / "data" / "multiclaw.db"
    if not db_path.exists():
        console.print("[red]Database not found.[/red]")
        sys.exit(1)

    with sqlite3.connect(str(db_path)) as conn:
        row = conn.execute(
            "SELECT id, spawn_pid, spawn_port, spawn_dir FROM agents WHERE name = ? AND spawned_locally = 1",
            (agent_name,),
        ).fetchone()

    if not row:
        console.print(f"[red]Spawned agent '{agent_name}' not found.[/red]")
        console.print("Use [bold]manage.py agents[/bold] to list available agents.")
        sys.exit(1)

    agent_id, pid, port, spawn_dir = row

    if pid:
        console.print(f"Stopping agent [bold]{agent_name}[/bold] (PID {pid})...")
        try:
            import signal
            os.kill(pid, signal.SIGTERM)
            time.sleep(2)
        except ProcessLookupError:
            pass
        console.print(f"  [green]✓[/green] Stopped")

    if not spawn_dir or not Path(spawn_dir).exists():
        console.print(f"[red]Agent directory not found: {spawn_dir}[/red]")
        sys.exit(1)

    venv_python = Path(spawn_dir) / ".venv" / "bin" / "python"
    if not venv_python.exists():
        console.print(f"[red]Python venv not found at {venv_python}[/red]")
        sys.exit(1)

    console.print(f"Starting agent [bold]{agent_name}[/bold] on port {port}...")
    proc = subprocess.Popen(
        [str(venv_python), "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", str(port)],
        cwd=spawn_dir,
        start_new_session=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    with sqlite3.connect(str(db_path)) as conn:
        conn.execute("UPDATE agents SET spawn_pid = ? WHERE id = ?", (proc.pid, agent_id))

    Path(spawn_dir, ".pid").write_text(str(proc.pid))

    console.print(f"  [green]✓[/green] Started (PID {proc.pid})")

    time.sleep(2)
    health = _fetch_health(port)
    if health:
        console.print(f"  [green]✓[/green] Agent is healthy")
    else:
        console.print(f"  [yellow]⚠[/yellow] Agent not responding yet (may still be starting)")


if __name__ == "__main__":
    cli()
