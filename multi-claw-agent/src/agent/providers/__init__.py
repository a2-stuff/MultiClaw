from src.agent.providers.base import BaseProvider
from src.agent.providers.anthropic import AnthropicProvider
from src.agent.providers.openai_provider import OpenAIProvider
from src.agent.providers.gemini import GeminiProvider
from src.agent.providers.openrouter import OpenRouterProvider
from src.agent.providers.deepseek import DeepSeekProvider


class ProviderRegistry:
    def __init__(self):
        self._providers: dict[str, BaseProvider] = {
            "anthropic": AnthropicProvider(),
            "openai": OpenAIProvider(),
            "gemini": GeminiProvider(),
            "openrouter": OpenRouterProvider(),
            "deepseek": DeepSeekProvider(),
        }

    def get(self, name: str) -> BaseProvider | None:
        return self._providers.get(name)

    def list_providers(self) -> list[str]:
        return list(self._providers.keys())

    def list_models(self) -> list[dict]:
        models = []
        for provider in self._providers.values():
            for m in provider.models:
                models.append({**m, "provider": provider.name})
        return models

    def list_configured(self) -> list[str]:
        return [name for name, p in self._providers.items() if p.is_configured()]
