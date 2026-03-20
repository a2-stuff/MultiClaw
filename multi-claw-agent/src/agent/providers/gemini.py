from typing import AsyncIterator
from src.agent.providers.base import BaseProvider


class GeminiProvider(BaseProvider):
    name = "gemini"
    models = [
        {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash"},
        {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro"},
    ]

    def __init__(self):
        self._api_key: str = ""
        self._client = None

    def configure(self, api_key: str) -> None:
        self._api_key = api_key
        from google import genai
        self._client = genai.Client(api_key=api_key)

    def is_configured(self) -> bool:
        return bool(self._api_key)

    async def run(self, prompt: str, model: str, system: str = "", max_tokens: int = 4096) -> dict:
        if not self._client:
            raise RuntimeError("Gemini provider not configured")
        from google.genai import types
        config = types.GenerateContentConfig(max_output_tokens=max_tokens, system_instruction=system if system else None)
        response = await self._client.aio.models.generate_content(model=model, contents=prompt, config=config)
        return {
            "output": response.text or "",
            "usage": {
                "input_tokens": getattr(response.usage_metadata, "prompt_token_count", 0) if response.usage_metadata else 0,
                "output_tokens": getattr(response.usage_metadata, "candidates_token_count", 0) if response.usage_metadata else 0,
            },
        }

    async def run_stream(self, prompt: str, model: str, system: str = "", max_tokens: int = 4096) -> AsyncIterator[str]:
        if not self._client:
            raise RuntimeError("Gemini provider not configured")
        from google.genai import types
        config = types.GenerateContentConfig(max_output_tokens=max_tokens, system_instruction=system if system else None)
        async for chunk in await self._client.aio.models.generate_content_stream(model=model, contents=prompt, config=config):
            if chunk.text:
                yield chunk.text
