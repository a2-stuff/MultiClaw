from typing import AsyncIterator
from openai import AsyncOpenAI
from src.agent.providers.base import BaseProvider


class DeepSeekProvider(BaseProvider):
    name = "deepseek"
    models = [
        {"id": "deepseek-chat", "name": "DeepSeek V3"},
        {"id": "deepseek-reasoner", "name": "DeepSeek R1"},
    ]

    def __init__(self):
        self._api_key: str = ""
        self._client: AsyncOpenAI | None = None

    def configure(self, api_key: str) -> None:
        self._api_key = api_key
        self._client = AsyncOpenAI(api_key=api_key, base_url="https://api.deepseek.com")

    def is_configured(self) -> bool:
        return bool(self._api_key)

    async def run(self, prompt: str, model: str, system: str = "", max_tokens: int = 4096) -> dict:
        if not self._client:
            raise RuntimeError("DeepSeek provider not configured")
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
            raise RuntimeError("DeepSeek provider not configured")
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        stream = await self._client.chat.completions.create(model=model, messages=messages, max_tokens=max_tokens, stream=True)
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
