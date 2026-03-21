from typing import AsyncIterator
from openai import AsyncOpenAI
from src.agent.providers.base import BaseProvider


class OpenRouterProvider(BaseProvider):
    name = "openrouter"
    models = [
        {"id": "anthropic/claude-sonnet-4", "name": "Claude Sonnet 4 (via OR)"},
        {"id": "openai/gpt-4o", "name": "GPT-4o (via OR)"},
        {"id": "google/gemini-2.5-flash", "name": "Gemini 2.5 Flash (via OR)"},
        {"id": "deepseek/deepseek-r1", "name": "DeepSeek R1 (via OR)"},
    ]

    def __init__(self):
        self._api_key: str = ""
        self._client: AsyncOpenAI | None = None

    def configure(self, api_key: str) -> None:
        self._api_key = api_key
        self._client = AsyncOpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")

    def is_configured(self) -> bool:
        return bool(self._api_key)

    async def run(self, prompt: str, model: str, system: str = "", max_tokens: int = 4096) -> dict:
        if not self._client:
            raise RuntimeError("OpenRouter provider not configured")
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
            raise RuntimeError("OpenRouter provider not configured")
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        stream = await self._client.chat.completions.create(model=model, messages=messages, max_tokens=max_tokens, stream=True)
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def run_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        model: str,
        system: str = "",
        max_tokens: int = 4096,
    ) -> dict:
        if not self._client:
            raise RuntimeError("OpenRouter provider not configured")
        import json as _json
        from src.agent.tool_executor import to_openai_tools

        openai_messages = []
        if system:
            openai_messages.append({"role": "system", "content": system})

        for msg in messages:
            if msg["role"] == "user":
                openai_messages.append({"role": "user", "content": msg["content"]})
            elif msg["role"] == "assistant":
                oai_msg: dict = {"role": "assistant", "content": msg.get("content") or ""}
                if msg.get("tool_calls"):
                    oai_msg["tool_calls"] = [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {
                                "name": tc["name"],
                                "arguments": _json.dumps(tc["arguments"]),
                            },
                        }
                        for tc in msg["tool_calls"]
                    ]
                openai_messages.append(oai_msg)
            elif msg["role"] == "tool":
                openai_messages.append({
                    "role": "tool",
                    "tool_call_id": msg["tool_call_id"],
                    "content": msg["content"],
                })

        kwargs: dict = {
            "model": model,
            "messages": openai_messages,
            "max_tokens": max_tokens,
        }
        if tools:
            kwargs["tools"] = to_openai_tools(tools)

        response = await self._client.chat.completions.create(**kwargs)
        choice = response.choices[0]

        tool_calls = []
        if choice.message.tool_calls:
            for tc in choice.message.tool_calls:
                tool_calls.append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": _json.loads(tc.function.arguments),
                })

        return {
            "content": choice.message.content or "",
            "tool_calls": tool_calls,
            "stop_reason": choice.finish_reason,
            "usage": {
                "input_tokens": response.usage.prompt_tokens if response.usage else 0,
                "output_tokens": response.usage.completion_tokens if response.usage else 0,
            },
        }
