#!/usr/bin/env python3
"""MultiClaw interactive TUI dashboard — built with Rich."""

import os
import select
import subprocess
import sys
import termios
import tty
from collections import deque
from pathlib import Path

from rich.console import Console
from rich.layout import Layout
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from manage import (
    AGENT_DIR,
    AGENT_UNIT,
    DASHBOARD_DIR,
    DASHBOARD_UNIT,
    ROOT,
    SERVICES,
    _agent_port,
    _count_crons,
    _count_dir_entries,
    _dashboard_port,
    _fetch_health,
    _format_bytes,
    _format_uptime,
    _get_version,
    _query_agents_db,
    _service_info,
    _systemctl,
)

# ---------------------------------------------------------------------------
# Keyboard
# ---------------------------------------------------------------------------

def _get_key(timeout: float = 0.5) -> str | None:
    if select.select([sys.stdin], [], [], timeout)[0]:
        return sys.stdin.read(1)
    return None


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------

def _gather_data() -> dict:
    dash_port = _dashboard_port()
    agent_port = _agent_port()
    dash_info = _service_info(SERVICES["dashboard"])
    agent_info = _service_info(SERVICES["agent"])
    dash_health = _fetch_health(dash_port) if dash_info["state"] == "active" else None
    agent_health = _fetch_health(agent_port) if agent_info["state"] == "active" else None
    total_agents, online_agents = _query_agents_db()
    db_path = DASHBOARD_DIR / "data" / "multiclaw.db"
    db_size = _format_bytes(db_path.stat().st_size) if db_path.exists() else "—"
    return {
        "dash_port": dash_port, "agent_port": agent_port,
        "dash_info": dash_info, "agent_info": agent_info,
        "dash_health": dash_health, "agent_health": agent_health,
        "total_agents": total_agents, "online_agents": online_agents,
        "db_size": db_size,
        "skills": _count_dir_entries(AGENT_DIR / "skills"),
        "plugins": _count_dir_entries(AGENT_DIR / "plugins"),
        "crons": _count_crons(AGENT_DIR),
    }


# ---------------------------------------------------------------------------
# Widget renderers
# ---------------------------------------------------------------------------

def _state_text(info: dict) -> Text:
    s = info["state"]
    if s == "active":
        return Text("● online", style="green bold")
    if s == "failed":
        return Text("● failed", style="red bold")
    return Text("○ stopped", style="dim")


def _make_services_table(data: dict) -> Table:
    t = Table(show_header=True, header_style="bold cyan", box=None, padding=(0, 2), expand=True)
    t.add_column("Service", style="bold")
    t.add_column("State")
    t.add_column("PID", justify="right")
    t.add_column("Uptime", justify="right")
    t.add_column("CPU", justify="right")
    t.add_column("Memory", justify="right")
    for name, info in [("Dashboard", data["dash_info"]), ("Agent", data["agent_info"])]:
        t.add_row(
            name, _state_text(info),
            str(info["pid"]) if info["pid"] else "—",
            _format_uptime(info["uptime"]),
            f"{info['cpu']:.1f}%" if info["cpu"] is not None else "—",
            _format_bytes(info["memory"]),
        )
    return t


def _make_dash_panel(data: dict) -> Panel:
    v = data["dash_health"].get("version", "—") if data["dash_health"] else "—"
    txt = f"Agents: {data['total_agents']} ({data['online_agents']} online)  DB: {data['db_size']}\nPort: {data['dash_port']}  Version: {v}"
    return Panel(txt, title="[bold cyan]Dashboard[/bold cyan]", border_style="cyan")


def _make_agent_panel(data: dict) -> Panel:
    if data["agent_health"] and "tasks" in data["agent_health"]:
        t = data["agent_health"]["tasks"]
        tl = f"Tasks: {t.get('completed',0)} done, {t.get('active',0)} active, {t.get('failed',0)} failed"
    else:
        tl = "Tasks: —"
    v = data["agent_health"].get("version", "—") if data["agent_health"] else "—"
    txt = f"{tl}\nSkills: {data['skills']}  Plugins: {data['plugins']}  Crons: {data['crons']}\nPort: {data['agent_port']}  Version: {v}"
    return Panel(txt, title="[bold green]Agent[/bold green]", border_style="green")


def _make_log_panel(log_lines: deque, log_service: str, height: int) -> Panel:
    # Show only the last N lines that fit
    visible = height - 2  # panel border
    lines = list(log_lines)[-max(visible, 1):]
    txt = Text("\n".join(lines)) if lines else Text("No logs available", style="dim")
    return Panel(txt, title=f"[bold yellow]Logs — {log_service.capitalize()}[/bold yellow]", border_style="yellow")


def _make_footer(message: str | None) -> Text:
    keys = Text()
    for i, (k, l) in enumerate([("s","Start"),("p","Stop"),("r","Restart"),("i","Install"),("u","Uninstall"),("d","Dash Logs"),("a","Agent Logs"),("q","Quit")]):
        if i > 0:
            keys.append(" ", style="dim")
        keys.append(f" {k} ", style="bold white on rgb(60,60,60)")
        keys.append(f"{l}", style="dim")
    if message:
        keys.append(f"  │  {message}", style="bold yellow")
    return keys


# ---------------------------------------------------------------------------
# Full layout
# ---------------------------------------------------------------------------

def _build_layout(data: dict, log_lines: deque, log_service: str, message: str | None, term_h: int) -> Layout:
    """Build a Layout that fits exactly in term_h rows."""
    layout = Layout()

    # Fixed sizes: services=6, details=7, footer=1
    # Logs get the rest
    log_h = max(term_h - 6 - 7 - 1, 5)

    layout.split_column(
        Layout(name="services", size=6),
        Layout(name="details", size=7),
        Layout(name="logs", size=log_h),
        Layout(name="footer", size=1),
    )

    layout["services"].update(
        Panel(_make_services_table(data), title="[bold blue]MultiClaw Manager[/bold blue]", border_style="blue")
    )

    details = Layout()
    details.split_row(
        Layout(_make_dash_panel(data)),
        Layout(_make_agent_panel(data)),
    )
    layout["details"].update(details)

    layout["logs"].update(_make_log_panel(log_lines, log_service, log_h))
    layout["footer"].update(_make_footer(message))

    return layout


# ---------------------------------------------------------------------------
# Draw
# ---------------------------------------------------------------------------

def _draw(console: Console, data: dict, log_lines: deque, log_service: str, message: str | None):
    term_h = console.size.height
    layout = _build_layout(data, log_lines, log_service, message, term_h)
    # Move to top-left, print layout (which fills the screen exactly)
    console.print("\033[H", end="")
    console.print(layout)


# ---------------------------------------------------------------------------
# Log loading
# ---------------------------------------------------------------------------

def _load_logs(service: str, n: int = 100) -> tuple[list[str], str | None]:
    unit = SERVICES[service]
    result = subprocess.run(
        ["journalctl", "-u", unit, "-n", str(n), "--no-pager", "--show-cursor"],
        capture_output=True, text=True, check=False,
    )
    lines, cursor = [], None
    for line in result.stdout.splitlines():
        if line.startswith("-- cursor:"):
            cursor = line.split(":", 1)[1].strip()
        else:
            lines.append(line)
    return lines, cursor


def _load_new_logs(service: str, cursor: str | None) -> tuple[list[str], str | None]:
    if cursor is None:
        return _load_logs(service, 10)
    unit = SERVICES[service]
    result = subprocess.run(
        ["journalctl", "-u", unit, f"--after-cursor={cursor}", "--no-pager", "--show-cursor"],
        capture_output=True, text=True, check=False,
    )
    lines, new_cursor = [], cursor
    for line in result.stdout.splitlines():
        if line.startswith("-- cursor:"):
            new_cursor = line.split(":", 1)[1].strip()
        else:
            lines.append(line)
    return lines, new_cursor


# ---------------------------------------------------------------------------
# Service actions
# ---------------------------------------------------------------------------

def _do_service_action(action: str, service: str) -> str:
    units = list(SERVICES.values()) if service == "all" else [SERVICES[service]]
    results = []
    for unit in units:
        try:
            _systemctl(action, unit)
            results.append(f"✓ {unit} {action}ed")
        except subprocess.CalledProcessError as e:
            results.append(f"✗ {unit}: {e.stderr.strip()[:60]}")
    return "  ".join(results)


def _do_install() -> str:
    import getpass, shutil
    user = getpass.getuser()
    node = shutil.which("node")
    venv_python = AGENT_DIR / ".venv" / "bin" / "python"
    if not node:
        return "✗ node not found"
    if not venv_python.exists():
        return "✗ venv not found"
    units = {
        f"/etc/systemd/system/{SERVICES['dashboard']}.service": DASHBOARD_UNIT.format(user=user, work_dir=DASHBOARD_DIR, node=node),
        f"/etc/systemd/system/{SERVICES['agent']}.service": AGENT_UNIT.format(user=user, work_dir=AGENT_DIR, python=venv_python),
    }
    for path, content in units.items():
        subprocess.run(["sudo", "tee", path], input=content, capture_output=True, text=True, check=True)
    _systemctl("daemon-reload")
    for unit in SERVICES.values():
        _systemctl("enable", unit)
        _systemctl("start", unit)
    return "✓ Installed & started"


def _do_uninstall() -> str:
    for unit in SERVICES.values():
        _systemctl("stop", unit, check=False)
        _systemctl("disable", unit, check=False)
    for name in SERVICES.values():
        p = Path(f"/etc/systemd/system/{name}.service")
        if p.exists():
            subprocess.run(["sudo", "rm", str(p)], check=True)
    _systemctl("daemon-reload")
    return "✓ Removed"


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main():
    console = Console()
    log_service = "dashboard"
    log_lines: deque[str] = deque(maxlen=200)
    log_cursor: str | None = None
    message: str | None = None
    refresh_counter = 0
    needs_redraw = True

    data = _gather_data()
    initial_lines, log_cursor = _load_logs(log_service)
    log_lines.extend(initial_lines)

    old_settings = termios.tcgetattr(sys.stdin)
    sys.stdout.write("\033[?1049h\033[?25l")  # alt screen + hide cursor
    sys.stdout.flush()

    try:
        tty.setcbreak(sys.stdin)

        while True:
            if needs_redraw:
                _draw(console, data, log_lines, log_service, message)
                needs_redraw = False

            key = _get_key(0.5)
            refresh_counter += 1

            if key == "q" or key == "\x03":
                break

            if key in ("s", "p", "r"):
                action = {"s": "start", "p": "stop", "r": "restart"}[key]
                message = "Pick: [1] Dashboard  [2] Agent  [3] Both  [Esc] Cancel"
                _draw(console, data, log_lines, log_service, message)
                ch = _get_key(5.0)
                svc = {"1": "dashboard", "2": "agent", "3": "all"}.get(ch or "")
                if svc:
                    message = f"{action.capitalize()}ing {svc}..."
                    _draw(console, data, log_lines, log_service, message)
                    message = _do_service_action(action, svc)
                    data = _gather_data()
                    new_lines, log_cursor = _load_logs(log_service)
                    log_lines.clear()
                    log_lines.extend(new_lines)
                else:
                    message = None
                needs_redraw = True
                refresh_counter = 0
                continue

            if key == "i":
                message = "Installing..."
                _draw(console, data, log_lines, log_service, message)
                try:
                    message = _do_install()
                except Exception as e:
                    message = f"✗ {e}"
                data = _gather_data()
                new_lines, log_cursor = _load_logs(log_service)
                log_lines.clear()
                log_lines.extend(new_lines)
                needs_redraw = True
                refresh_counter = 0
                continue

            if key == "u":
                message = "Uninstall? [y] Yes  [any] Cancel"
                _draw(console, data, log_lines, log_service, message)
                if _get_key(5.0) == "y":
                    message = "Uninstalling..."
                    _draw(console, data, log_lines, log_service, message)
                    try:
                        message = _do_uninstall()
                    except Exception as e:
                        message = f"✗ {e}"
                    data = _gather_data()
                else:
                    message = None
                needs_redraw = True
                refresh_counter = 0
                continue

            if key == "d" and log_service != "dashboard":
                log_service = "dashboard"
                log_lines.clear()
                lines, log_cursor = _load_logs(log_service)
                log_lines.extend(lines)
                message = None
                needs_redraw = True

            if key == "a" and log_service != "agent":
                log_service = "agent"
                log_lines.clear()
                lines, log_cursor = _load_logs(log_service)
                log_lines.extend(lines)
                message = None
                needs_redraw = True

            if refresh_counter >= 10:
                refresh_counter = 0
                data = _gather_data()
                new_lines, log_cursor = _load_new_logs(log_service, log_cursor)
                if new_lines:
                    log_lines.extend(new_lines)
                message = None
                needs_redraw = True

    except KeyboardInterrupt:
        pass
    finally:
        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_settings)
        sys.stdout.write("\033[?25h\033[?1049l")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
