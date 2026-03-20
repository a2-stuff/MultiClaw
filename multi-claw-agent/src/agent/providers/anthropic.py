from typing import AsyncIterator
from anthropic import AsyncAnthropic
from src.agent.providers.base import BaseProvider


class AnthropicProvider(BaseProvider):
    name = "anthropic"
    models = [
        {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6"},
        {"id": "claude-opus-4-6", "name": "Claude Opus 4.6"},
        {"id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5"},
    ]

    def __init__(self):
        self._api_key: str = ""
        self._client: AsyncAnthropic | None = None

    def configure(self, api_key: str) -> None:
        self._api_key = api_key
        self._client = AsyncAnthropic(api_key=api_key)

    def is_configured(self) -> bool:
        return bool(self._api_key)

    async def run(self, prompt: str, model: str, system: str = "", max_tokens: int = 4096) -> dict:
        if not self._client:
            raise RuntimeError("Anthropic provider not configured")
        kwargs: dict = {"model": model, "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]}
        if system:
            kwargs["system"] = system
        response = await self._client.messages.create(**kwargs)
        return {
            "output": response.content[0].text if response.content else "",
            "usage": {"input_tokens": response.usage.input_tokens, "output_tokens": response.usage.output_tokens},
        }

    async def run_stream(self, prompt: str, model: str, system: str = "", max_tokens: int = 4096) -> AsyncIterator[str]:
        if not self._client:
            raise RuntimeError("Anthropic provider not configured")
        kwargs: dict = {"model": model, "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]}
        if system:
            kwargs["system"] = system
        async with self._client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield text
