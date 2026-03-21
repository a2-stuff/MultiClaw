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

    async def run_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        model: str,
        system: str = "",
        max_tokens: int = 4096,
    ) -> dict:
        if not self._client:
            raise RuntimeError("Gemini provider not configured")
        from google.genai import types
        from src.agent.tool_executor import to_gemini_tools
        import json as _json

        # Build Gemini contents from canonical messages
        contents = []
        for msg in messages:
            if msg["role"] == "user":
                contents.append(types.Content(role="user", parts=[types.Part.from_text(text=msg["content"])]))
            elif msg["role"] == "assistant":
                parts = []
                if msg.get("content"):
                    parts.append(types.Part.from_text(text=msg["content"]))
                for tc in msg.get("tool_calls", []):
                    parts.append(types.Part.from_function_call(
                        name=tc["name"],
                        args=tc["arguments"],
                    ))
                contents.append(types.Content(role="model", parts=parts))
            elif msg["role"] == "tool":
                # Gemini uses function_response
                try:
                    result_data = _json.loads(msg["content"])
                except (ValueError, TypeError):
                    result_data = {"result": msg["content"]}
                contents.append(types.Content(
                    role="user",
                    parts=[types.Part.from_function_response(
                        name=msg.get("tool_name", "unknown"),
                        response=result_data,
                    )],
                ))

        config = types.GenerateContentConfig(
            max_output_tokens=max_tokens,
            system_instruction=system if system else None,
            tools=to_gemini_tools(tools) if tools else None,
        )

        response = await self._client.aio.models.generate_content(
            model=model, contents=contents, config=config
        )

        content = ""
        tool_calls = []
        if response.candidates and response.candidates[0].content:
            for part in response.candidates[0].content.parts:
                if part.text:
                    content += part.text
                elif part.function_call:
                    tool_calls.append({
                        "id": f"gemini_{part.function_call.name}_{id(part)}",
                        "name": part.function_call.name,
                        "arguments": dict(part.function_call.args) if part.function_call.args else {},
                    })

        return {
            "content": content,
            "tool_calls": tool_calls,
            "stop_reason": "tool_use" if tool_calls else "end_turn",
            "usage": {
                "input_tokens": getattr(response.usage_metadata, "prompt_token_count", 0) if response.usage_metadata else 0,
                "output_tokens": getattr(response.usage_metadata, "candidates_token_count", 0) if response.usage_metadata else 0,
            },
        }
