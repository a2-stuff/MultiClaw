from typing import AsyncIterator
from openai import AsyncOpenAI
from src.agent.providers.base import BaseProvider


class OpenAIProvider(BaseProvider):
    name = "openai"
    models = [
        {"id": "gpt-4o", "name": "GPT-4o"},
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini"},
        {"id": "o3-mini", "name": "o3 Mini"},
    ]

    def __init__(self):
        self._api_key: str = ""
        self._client: AsyncOpenAI | None = None

    def configure(self, api_key: str) -> None:
        self._api_key = api_key
        self._client = AsyncOpenAI(api_key=api_key)

    def is_configured(self) -> bool:
        return bool(self._api_key)

    async def run(self, prompt: str, model: str, system: str = "", max_tokens: int = 4096) -> dict:
        if not self._client:
            raise RuntimeError("OpenAI provider not configured")
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        response = await self._client.chat.completions.create(model=model, messages=messages, max_tokens=max_tokens)
        choice = response.choices[0]
        return {
            "output": choice.message.content or "",
            "usage": {"input_tokens": response.usage.prompt_tokens if response.usage else 0, "output_tokens": response.usage.completion_tokens if response.usage else 0},
        }

    async def run_stream(self, prompt: str, model: str, system: str = "", max_tokens: int = 4096) -> AsyncIterator[str]:
        if not self._client:
            raise RuntimeError("OpenAI provider not configured")
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        stream = await self._client.chat.completions.create(model=model, messages=messages, max_tokens=max_tokens, stream=True)
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
