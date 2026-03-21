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

    async def run_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        model: str,
        system: str = "",
        max_tokens: int = 4096,
    ) -> dict:
        if not self._client:
            raise RuntimeError("Anthropic provider not configured")
        from src.agent.tool_executor import to_anthropic_tools

        # Convert canonical messages to Anthropic format
        anthropic_messages = []
        for msg in messages:
            if msg["role"] == "user":
                anthropic_messages.append({"role": "user", "content": msg["content"]})
            elif msg["role"] == "assistant":
                content_blocks = []
                if msg.get("content"):
                    content_blocks.append({"type": "text", "text": msg["content"]})
                for tc in msg.get("tool_calls", []):
                    content_blocks.append({
                        "type": "tool_use",
                        "id": tc["id"],
                        "name": tc["name"],
                        "input": tc["arguments"],
                    })
                anthropic_messages.append({"role": "assistant", "content": content_blocks})
            elif msg["role"] == "tool":
                anthropic_messages.append({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": msg["tool_call_id"],
                        "content": msg["content"],
                    }],
                })

        kwargs: dict = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": anthropic_messages,
        }
        if system:
            kwargs["system"] = system
        if tools:
            kwargs["tools"] = to_anthropic_tools(tools)

        response = await self._client.messages.create(**kwargs)

        content = ""
        tool_calls = []
        for block in response.content:
            if block.type == "text":
                content += block.text
            elif block.type == "tool_use":
                tool_calls.append({
                    "id": block.id,
                    "name": block.name,
                    "arguments": block.input,
                })

        return {
            "content": content,
            "tool_calls": tool_calls,
            "stop_reason": response.stop_reason,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
        }
