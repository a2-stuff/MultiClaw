from pathlib import Path
from typing import Any
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    agent_id: str = ""
    agent_name: str = "MultiClaw Agent"
    agent_url: str = ""  # External URL for dashboard to reach this agent
    host: str = "0.0.0.0"
    port: int = 8100
    api_key: str = ""  # The mck_ key from the dashboard Keys page
    agent_secret: str = ""  # Set automatically after connecting to dashboard
    dashboard_url: str = ""  # URL of the dashboard (e.g. http://dashboard:3100)
    cors_origins: str = ""  # Comma-separated allowed origins; empty = dashboard_url only
    auto_register: bool = True
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    google_api_key: str = ""
    openrouter_api_key: str = ""
    deepseek_api_key: str = ""
    default_provider: str = "anthropic"
    default_model: str = "claude-sonnet-4-6"
    identity: str = ""
    max_tokens: int = 4096
    base_dir: Path = Path(__file__).parent.parent
    skills_dir: Path = Path("")
    plugins_dir: Path = Path("")

    # TLS
    tls_cert: str = ""
    tls_key: str = ""

    # Tailscale
    tailscale_enabled: bool = False
    tailscale_mode: str = "dual-stack"  # "tailscale-only" or "dual-stack"
    tailscale_tag: str = "tag:multiclaw-agent"
    tailscale_dashboard_port: int = 3100  # Dashboard port for discovery

    # Dashboard-pushed config (set at runtime, not from env)
    _dashboard_anthropic_key: str = ""
    _dashboard_openai_key: str = ""
    _dashboard_google_key: str = ""
    _dashboard_openrouter_key: str = ""
    _dashboard_deepseek_key: str = ""

    model_config = {"env_prefix": "MULTICLAW_", "env_file": ".env"}

    def model_post_init(self, __context: Any) -> None:
        if not self.skills_dir or str(self.skills_dir) == ".":
            self.skills_dir = self.base_dir / "skills"
        if not self.plugins_dir or str(self.plugins_dir) == ".":
            self.plugins_dir = self.base_dir / "plugins"


settings = Settings()
