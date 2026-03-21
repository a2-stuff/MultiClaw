from abc import ABC, abstractmethod
from typing import AsyncIterator


class BaseProvider(ABC):
    name: str = ""
    models: list[dict] = []

    @abstractmethod
    def configure(self, api_key: str) -> None:
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        pass

    @abstractmethod
    async def run(self, prompt: str, model: str, system: str = "", max_tokens: int = 4096) -> dict:
        pass

    @abstractmethod
    async def run_stream(self, prompt: str, model: str, system: str = "", max_tokens: int = 4096) -> AsyncIterator[str]:
        pass

    @abstractmethod
    async def run_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        model: str,
        system: str = "",
        max_tokens: int = 4096,
    ) -> dict:
        """Run a completion with tool definitions.

        Args:
            messages: Canonical message list [{role, content, tool_calls?, tool_call_id?}]
            tools: Canonical tool schemas [{name, description, parameters}]
            model: Model ID string
            system: System prompt
            max_tokens: Max output tokens

        Returns:
            {
                "content": str,          # Text response (may be empty if tool_use)
                "tool_calls": list[dict], # [{id, name, arguments}]
                "stop_reason": str,       # Provider-specific stop reason
                "usage": {input_tokens, output_tokens}
            }
        """
        pass
