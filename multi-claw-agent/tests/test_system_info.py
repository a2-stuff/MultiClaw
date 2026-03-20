from src.system_info import get_system_info


def test_system_info_returns_all_fields():
    info = get_system_info()
    assert "hostname" in info
    assert "os" in info
    assert "cpu" in info
    assert "memory" in info
    assert "disk" in info
    assert "processes" in info
    assert "open_ports" in info
    assert info["cpu"]["count"] > 0
    assert info["memory"]["total_gb"] > 0


def test_system_info_cpu_percent():
    info = get_system_info()
    assert 0 <= info["cpu"]["percent"] <= 100


def test_system_info_memory_percent():
    info = get_system_info()
    assert 0 <= info["memory"]["percent"] <= 100
