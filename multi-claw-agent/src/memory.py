"""Memory client for reading/writing shared state and knowledge via the dashboard API."""

from __future__ import annotations

from typing import Any

import httpx

from src.config import settings


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class MemoryError(Exception):
    """Base exception for memory client errors."""


class VersionConflictError(MemoryError):
    """Raised when a state update conflicts with the current version."""

    def __init__(self, message: str, current_version: int | None = None):
        super().__init__(message)
        self.current_version = current_version


# ---------------------------------------------------------------------------
# State client
# ---------------------------------------------------------------------------

class StateClient:
    """Shared state (key-value) operations."""

    def __init__(self, base_url: str, headers: dict[str, str]):
        self._base_url = base_url.rstrip("/")
        self._headers = headers

    async def list_keys(self, namespace: str = "default") -> list[dict]:
        """List all keys in a namespace."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self._base_url}/api/memory/state/{namespace}",
                    headers=self._headers,
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as exc:
            raise MemoryError(f"Failed to connect to dashboard: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise MemoryError(f"Dashboard returned {exc.response.status_code}: {exc.response.text}") from exc

    async def get(self, key: str, namespace: str = "default") -> Any:
        """Get the value for a key (unwrapped)."""
        entry = await self.get_entry(key, namespace)
        return entry["value"]

    async def get_entry(self, key: str, namespace: str = "default") -> dict:
        """Get the full entry for a key."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self._base_url}/api/memory/state/{namespace}/{key}",
                    headers=self._headers,
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as exc:
            raise MemoryError(f"Failed to connect to dashboard: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise MemoryError(f"Dashboard returned {exc.response.status_code}: {exc.response.text}") from exc

    async def set(
        self,
        key: str,
        value: Any,
        namespace: str = "default",
        version: int | None = None,
        expires_at: str | None = None,
    ) -> dict:
        """Set a key's value. Raises VersionConflictError on 409."""
        body: dict[str, Any] = {"value": value}
        if version is not None:
            body["version"] = version
        if expires_at is not None:
            body["expiresAt"] = expires_at

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.put(
                    f"{self._base_url}/api/memory/state/{namespace}/{key}",
                    headers=self._headers,
                    json=body,
                )
                if resp.status_code == 409:
                    data = resp.json() if resp.content else {}
                    current = data.get("currentVersion") or data.get("version")
                    raise VersionConflictError(
                        f"Version conflict for key '{key}' in namespace '{namespace}'",
                        current_version=current,
                    )
                resp.raise_for_status()
                return resp.json()
        except VersionConflictError:
            raise
        except httpx.ConnectError as exc:
            raise MemoryError(f"Failed to connect to dashboard: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise MemoryError(f"Dashboard returned {exc.response.status_code}: {exc.response.text}") from exc

    async def delete(self, key: str, namespace: str = "default") -> bool:
        """Delete a key. Returns True if deleted."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.delete(
                    f"{self._base_url}/api/memory/state/{namespace}/{key}",
                    headers=self._headers,
                )
                resp.raise_for_status()
                return True
        except httpx.ConnectError as exc:
            raise MemoryError(f"Failed to connect to dashboard: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise MemoryError(f"Dashboard returned {exc.response.status_code}: {exc.response.text}") from exc


# ---------------------------------------------------------------------------
# Knowledge client
# ---------------------------------------------------------------------------

class KnowledgeClient:
    """Knowledge base operations."""

    def __init__(self, base_url: str, headers: dict[str, str]):
        self._base_url = base_url.rstrip("/")
        self._headers = headers

    async def ingest(self, content: str, metadata: dict | None = None) -> dict:
        """Add a knowledge entry."""
        body: dict[str, Any] = {"content": content}
        if metadata is not None:
            body["metadata"] = metadata

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self._base_url}/api/memory/ingest",
                    headers=self._headers,
                    json=body,
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as exc:
            raise MemoryError(f"Failed to connect to dashboard: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise MemoryError(f"Dashboard returned {exc.response.status_code}: {exc.response.text}") from exc

    async def search(self, query: str, top_k: int = 10) -> dict:
        """Semantic search over knowledge entries."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self._base_url}/api/memory/search",
                    headers=self._headers,
                    json={"query": query, "topK": top_k},
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as exc:
            raise MemoryError(f"Failed to connect to dashboard: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise MemoryError(f"Dashboard returned {exc.response.status_code}: {exc.response.text}") from exc

    async def list_entries(self, limit: int = 50, offset: int = 0) -> dict:
        """List knowledge entries with pagination."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self._base_url}/api/memory/entries",
                    headers=self._headers,
                    params={"limit": limit, "offset": offset},
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as exc:
            raise MemoryError(f"Failed to connect to dashboard: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise MemoryError(f"Dashboard returned {exc.response.status_code}: {exc.response.text}") from exc

    async def delete(self, entry_id: str) -> bool:
        """Delete a knowledge entry. Returns True if deleted."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.delete(
                    f"{self._base_url}/api/memory/entries/{entry_id}",
                    headers=self._headers,
                )
                resp.raise_for_status()
                return True
        except httpx.ConnectError as exc:
            raise MemoryError(f"Failed to connect to dashboard: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise MemoryError(f"Dashboard returned {exc.response.status_code}: {exc.response.text}") from exc


# ---------------------------------------------------------------------------
# Main client
# ---------------------------------------------------------------------------

class MemoryClient:
    """Main client that provides access to both state and knowledge."""

    def __init__(self) -> None:
        base_url = settings.dashboard_url
        headers = {"X-API-Key": settings.agent_secret}
        self._state = StateClient(base_url, headers)
        self._knowledge = KnowledgeClient(base_url, headers)

    @property
    def state(self) -> StateClient:
        return self._state

    @property
    def knowledge(self) -> KnowledgeClient:
        return self._knowledge


# Module-level singleton
memory = MemoryClient()
