from src.config import settings
from src.agent.providers import ProviderRegistry


class AgentBrain:
    def __init__(self):
        self.registry = ProviderRegistry()
        self.default_provider = settings.default_provider
        self.default_model = settings.default_model
        self.max_tokens = settings.max_tokens
        self._configure_providers()

    def _configure_providers(self):
        key_map = {
            "anthropic": settings.anthropic_api_key or settings._dashboard_anthropic_key,
            "openai": settings.openai_api_key or settings._dashboard_openai_key,
            "gemini": settings.google_api_key or settings._dashboard_google_key,
            "openrouter": settings.openrouter_api_key or settings._dashboard_openrouter_key,
            "deepseek": settings.deepseek_api_key or settings._dashboard_deepseek_key,
        }
        for provider_name, key in key_map.items():
            if key:
                provider = self.registry.get(provider_name)
                if provider:
                    provider.configure(key)

    def refresh_client(self):
        self._configure_providers()

    def _resolve_provider(self, provider: str = "", model: str = ""):
        p_name = provider or self.default_provider
        m_name = model or self.default_model
        p = self.registry.get(p_name)
        if not p:
            raise ValueError(f"Unknown provider: {p_name}")
        if not p.is_configured():
            raise RuntimeError(f"Provider '{p_name}' has no API key configured")
        return p, m_name

    async def run(self, prompt: str, system: str = "", provider: str = "", model: str = "") -> dict:
        p, m = self._resolve_provider(provider, model)
        return await p.run(prompt, m, system=system, max_tokens=self.max_tokens)

    async def run_stream(self, prompt: str, system: str = "", provider: str = "", model: str = ""):
        p, m = self._resolve_provider(provider, model)
        async for text in p.run_stream(prompt, m, system=system, max_tokens=self.max_tokens):
            yield text

    def get_status(self) -> dict:
        return {
            "default_provider": self.default_provider,
            "default_model": self.default_model,
            "configured_providers": self.registry.list_configured(),
            "available_models": self.registry.list_models(),
        }
