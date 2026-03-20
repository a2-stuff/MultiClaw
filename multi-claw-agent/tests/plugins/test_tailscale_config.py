import pytest


def test_config_has_tailscale_fields():
    from src.config import Settings
    s = Settings(
        tailscale_enabled=True,
        tailscale_mode="tailscale-only",
        tailscale_tag="tag:multiclaw-agent",
        tailscale_dashboard_port=3000,
    )
    assert s.tailscale_enabled is True
    assert s.tailscale_mode == "tailscale-only"
    assert s.tailscale_tag == "tag:multiclaw-agent"
    assert s.tailscale_dashboard_port == 3000


def test_config_tailscale_defaults():
    from src.config import Settings
    s = Settings()
    assert s.tailscale_enabled is False
    assert s.tailscale_mode == "dual-stack"
    assert s.tailscale_tag == "tag:multiclaw-agent"
    assert s.tailscale_dashboard_port == 3000
