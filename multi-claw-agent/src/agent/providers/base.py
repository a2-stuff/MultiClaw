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
