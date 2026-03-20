import platform
import socket
import time
import psutil


def get_system_info() -> dict:
    """Collect comprehensive system information."""
    # CPU
    cpu_percent = psutil.cpu_percent(interval=0.1)
    cpu_count = psutil.cpu_count()
    cpu_count_physical = psutil.cpu_count(logical=False)

    # Memory
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()

    # Disk
    disk = psutil.disk_usage("/")

    # Network - open ports (listening)
    open_ports = []
    connections = {"established": 0, "listen": 0, "time_wait": 0, "close_wait": 0, "total": 0}
    try:
        for conn in psutil.net_connections(kind="inet"):
            connections["total"] += 1
            status = conn.status.lower().replace("-", "_")
            if status == "listen":
                connections["listen"] += 1
                open_ports.append({
                    "port": conn.laddr.port,
                    "address": conn.laddr.ip,
                    "pid": conn.pid,
                })
            elif status == "established":
                connections["established"] += 1
            elif status == "time_wait":
                connections["time_wait"] += 1
            elif status == "close_wait":
                connections["close_wait"] += 1
    except (psutil.AccessDenied, PermissionError):
        pass

    # Deduplicate ports
    seen_ports = set()
    unique_ports = []
    for p in open_ports:
        if p["port"] not in seen_ports:
            seen_ports.add(p["port"])
            unique_ports.append(p)

    # Network I/O
    net_io = psutil.net_io_counters()

    # Processes
    process_count = len(psutil.pids())

    # Uptime
    boot_time = psutil.boot_time()
    uptime_seconds = time.time() - boot_time

    # Load average (Linux/macOS)
    try:
        load_avg = psutil.getloadavg()
    except (AttributeError, OSError):
        load_avg = (0, 0, 0)

    # Top processes by CPU
    top_procs = []
    try:
        for proc in sorted(psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]),
                          key=lambda p: p.info.get("cpu_percent", 0) or 0, reverse=True)[:5]:
            info = proc.info
            if info.get("cpu_percent", 0) or info.get("memory_percent", 0):
                top_procs.append({
                    "pid": info["pid"],
                    "name": info["name"],
                    "cpu": round(info.get("cpu_percent", 0) or 0, 1),
                    "mem": round(info.get("memory_percent", 0) or 0, 1),
                })
    except (psutil.AccessDenied, PermissionError):
        pass

    return {
        "hostname": socket.gethostname(),
        "os": f"{platform.system()} {platform.release()}",
        "platform": platform.platform(),
        "arch": platform.machine(),
        "python": platform.python_version(),
        "boot_time": boot_time,
        "uptime_seconds": round(uptime_seconds),
        "load_avg": {
            "1m": round(load_avg[0], 2),
            "5m": round(load_avg[1], 2),
            "15m": round(load_avg[2], 2),
        },
        "cpu": {
            "percent": cpu_percent,
            "count": cpu_count,
            "count_physical": cpu_count_physical,
            "freq_mhz": round(psutil.cpu_freq().current) if psutil.cpu_freq() else None,
        },
        "memory": {
            "total_gb": round(mem.total / (1024**3), 2),
            "used_gb": round(mem.used / (1024**3), 2),
            "available_gb": round(mem.available / (1024**3), 2),
            "percent": mem.percent,
        },
        "swap": {
            "total_gb": round(swap.total / (1024**3), 2),
            "used_gb": round(swap.used / (1024**3), 2),
            "percent": swap.percent,
        },
        "disk": {
            "total_gb": round(disk.total / (1024**3), 2),
            "used_gb": round(disk.used / (1024**3), 2),
            "free_gb": round(disk.free / (1024**3), 2),
            "percent": disk.percent,
        },
        "network": {
            "bytes_sent_mb": round(net_io.bytes_sent / (1024**2), 1),
            "bytes_recv_mb": round(net_io.bytes_recv / (1024**2), 1),
            "packets_sent": net_io.packets_sent,
            "packets_recv": net_io.packets_recv,
        },
        "connections": connections,
        "processes": process_count,
        "top_processes": top_procs,
        "open_ports": unique_ports[:20],
    }
