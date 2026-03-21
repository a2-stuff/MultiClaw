"""Tests for the memory client (state + knowledge) with mocked HTTP responses."""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import httpx

from src.memory import (
    StateClient,
    KnowledgeClient,
    MemoryClient,
    MemoryError,
    VersionConflictError,
)

BASE_URL = "http://dashboard:3100"
HEADERS = {"X-API-Key": "mca_test-agent-secret"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_response(status_code: int = 200, json_data=None, text: str = ""):
    """Build a mock httpx.Response."""
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = json_data if json_data is not None else {}
    resp.text = text
    resp.content = b"content"
    resp.is_success = 200 <= status_code < 300
    if status_code >= 400:
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            message=f"HTTP {status_code}",
            request=MagicMock(),
            response=resp,
        )
    else:
        resp.raise_for_status.return_value = None
    return resp


def _mock_async_client(response):
    """Create a patched AsyncClient context manager returning *response*."""
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=response)
    mock_client.put = AsyncMock(return_value=response)
    mock_client.post = AsyncMock(return_value=response)
    mock_client.delete = AsyncMock(return_value=response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


# =========================================================================
# StateClient
# =========================================================================

class TestStateClient:

    def setup_method(self):
        self.state = StateClient(BASE_URL, HEADERS)

    # -- list_keys ---------------------------------------------------------

    @pytest.mark.asyncio
    async def test_list_keys_returns_entries(self):
        entries = [{"id": "1", "key": "k1", "version": 1}]
        mock = _mock_async_client(_make_response(json_data=entries))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            result = await self.state.list_keys("ns")
        assert result == entries
        mock.get.assert_called_once_with(
            f"{BASE_URL}/api/memory/state/ns",
            headers=HEADERS,
        )

    @pytest.mark.asyncio
    async def test_list_keys_default_namespace(self):
        mock = _mock_async_client(_make_response(json_data=[]))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            await self.state.list_keys()
        mock.get.assert_called_once_with(
            f"{BASE_URL}/api/memory/state/default",
            headers=HEADERS,
        )

    # -- get / get_entry ---------------------------------------------------

    @pytest.mark.asyncio
    async def test_get_entry_returns_full_entry(self):
        entry = {"id": "1", "key": "greeting", "value": "hello", "version": 2}
        mock = _mock_async_client(_make_response(json_data=entry))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            result = await self.state.get_entry("greeting", "ns")
        assert result == entry
        mock.get.assert_called_once_with(
            f"{BASE_URL}/api/memory/state/ns/greeting",
            headers=HEADERS,
        )

    @pytest.mark.asyncio
    async def test_get_unwraps_value(self):
        entry = {"id": "1", "key": "greeting", "value": "hello", "version": 1}
        mock = _mock_async_client(_make_response(json_data=entry))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            result = await self.state.get("greeting")
        assert result == "hello"

    @pytest.mark.asyncio
    async def test_get_entry_not_found_raises(self):
        mock = _mock_async_client(
            _make_response(404, json_data={"error": "Key not found"}, text="Key not found")
        )
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            with pytest.raises(MemoryError, match="404"):
                await self.state.get_entry("missing")

    # -- set ---------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_set_creates_entry(self):
        created = {"id": "abc", "key": "color", "value": '"blue"', "version": 1}
        mock = _mock_async_client(_make_response(201, json_data=created))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            result = await self.state.set("color", "blue")
        assert result == created
        mock.put.assert_called_once_with(
            f"{BASE_URL}/api/memory/state/default/color",
            headers=HEADERS,
            json={"value": "blue"},
        )

    @pytest.mark.asyncio
    async def test_set_with_version_and_expiry(self):
        mock = _mock_async_client(_make_response(200, json_data={"version": 3}))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            await self.state.set(
                "color", "red", namespace="ui", version=2, expires_at="2026-12-31T00:00:00Z"
            )
        mock.put.assert_called_once_with(
            f"{BASE_URL}/api/memory/state/ui/color",
            headers=HEADERS,
            json={"value": "red", "version": 2, "expiresAt": "2026-12-31T00:00:00Z"},
        )

    @pytest.mark.asyncio
    async def test_set_version_conflict_raises(self):
        conflict_resp = _make_response(409, json_data={"currentVersion": 5})
        # Override raise_for_status — version conflict is checked before raise_for_status
        conflict_resp.raise_for_status.side_effect = None
        mock = _mock_async_client(conflict_resp)
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            with pytest.raises(VersionConflictError) as exc_info:
                await self.state.set("color", "red", version=3)
        assert exc_info.value.current_version == 5

    @pytest.mark.asyncio
    async def test_set_server_error_raises(self):
        mock = _mock_async_client(
            _make_response(500, text="Internal Server Error")
        )
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            with pytest.raises(MemoryError, match="500"):
                await self.state.set("k", "v")

    # -- delete ------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_delete_returns_true(self):
        mock = _mock_async_client(_make_response(200, json_data={"success": True}))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            result = await self.state.delete("old-key", "ns")
        assert result is True
        mock.delete.assert_called_once_with(
            f"{BASE_URL}/api/memory/state/ns/old-key",
            headers=HEADERS,
        )

    @pytest.mark.asyncio
    async def test_delete_not_found_raises(self):
        mock = _mock_async_client(
            _make_response(404, text="Key not found")
        )
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            with pytest.raises(MemoryError, match="404"):
                await self.state.delete("missing")

    # -- connection errors -------------------------------------------------

    @pytest.mark.asyncio
    async def test_connection_error_raises_memory_error(self):
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        with patch("src.memory.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(MemoryError, match="Failed to connect"):
                await self.state.list_keys()


# =========================================================================
# KnowledgeClient
# =========================================================================

class TestKnowledgeClient:

    def setup_method(self):
        self.knowledge = KnowledgeClient(BASE_URL, HEADERS)

    # -- ingest ------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_ingest_without_metadata(self):
        created = {"id": "k1", "hasEmbedding": False}
        mock = _mock_async_client(_make_response(201, json_data=created))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            result = await self.knowledge.ingest("Agent found a bug")
        assert result == created
        mock.post.assert_called_once_with(
            f"{BASE_URL}/api/memory/ingest",
            headers=HEADERS,
            json={"content": "Agent found a bug"},
        )

    @pytest.mark.asyncio
    async def test_ingest_with_metadata(self):
        created = {"id": "k2", "hasEmbedding": True}
        meta = {"source": "agent-001", "type": "observation"}
        mock = _mock_async_client(_make_response(201, json_data=created))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            result = await self.knowledge.ingest("Database is slow", metadata=meta)
        assert result["hasEmbedding"] is True
        mock.post.assert_called_once_with(
            f"{BASE_URL}/api/memory/ingest",
            headers=HEADERS,
            json={"content": "Database is slow", "metadata": meta},
        )

    @pytest.mark.asyncio
    async def test_ingest_server_error_raises(self):
        mock = _mock_async_client(_make_response(500, text="error"))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            with pytest.raises(MemoryError, match="500"):
                await self.knowledge.ingest("test")

    # -- search ------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_search_returns_results(self):
        search_result = {
            "results": [{"id": "k1", "content": "database is slow", "similarity": 0.92}],
            "totalWithEmbeddings": 5,
        }
        mock = _mock_async_client(_make_response(json_data=search_result))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            result = await self.knowledge.search("performance issues")
        assert len(result["results"]) == 1
        assert result["results"][0]["similarity"] == 0.92
        mock.post.assert_called_once_with(
            f"{BASE_URL}/api/memory/search",
            headers=HEADERS,
            json={"query": "performance issues", "topK": 10},
        )

    @pytest.mark.asyncio
    async def test_search_custom_top_k(self):
        mock = _mock_async_client(_make_response(json_data={"results": [], "totalWithEmbeddings": 0}))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            await self.knowledge.search("anything", top_k=3)
        mock.post.assert_called_once_with(
            f"{BASE_URL}/api/memory/search",
            headers=HEADERS,
            json={"query": "anything", "topK": 3},
        )

    @pytest.mark.asyncio
    async def test_search_unavailable_raises(self):
        mock = _mock_async_client(
            _make_response(503, text="Embedding generation unavailable")
        )
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            with pytest.raises(MemoryError, match="503"):
                await self.knowledge.search("test")

    # -- list_entries ------------------------------------------------------

    @pytest.mark.asyncio
    async def test_list_entries_default_pagination(self):
        data = {"entries": [], "total": 0, "limit": 50, "offset": 0}
        mock = _mock_async_client(_make_response(json_data=data))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            result = await self.knowledge.list_entries()
        assert result["total"] == 0
        mock.get.assert_called_once_with(
            f"{BASE_URL}/api/memory/entries",
            headers=HEADERS,
            params={"limit": 50, "offset": 0},
        )

    @pytest.mark.asyncio
    async def test_list_entries_custom_pagination(self):
        data = {"entries": [{"id": "k1"}], "total": 100, "limit": 5, "offset": 10}
        mock = _mock_async_client(_make_response(json_data=data))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            result = await self.knowledge.list_entries(limit=5, offset=10)
        assert result["total"] == 100
        mock.get.assert_called_once_with(
            f"{BASE_URL}/api/memory/entries",
            headers=HEADERS,
            params={"limit": 5, "offset": 10},
        )

    # -- delete ------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_delete_entry(self):
        mock = _mock_async_client(_make_response(json_data={"success": True}))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            result = await self.knowledge.delete("entry-abc")
        assert result is True
        mock.delete.assert_called_once_with(
            f"{BASE_URL}/api/memory/entries/entry-abc",
            headers=HEADERS,
        )

    @pytest.mark.asyncio
    async def test_delete_not_found_raises(self):
        mock = _mock_async_client(_make_response(404, text="Entry not found"))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            with pytest.raises(MemoryError, match="404"):
                await self.knowledge.delete("missing")

    # -- connection errors -------------------------------------------------

    @pytest.mark.asyncio
    async def test_connection_error_on_ingest(self):
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        with patch("src.memory.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(MemoryError, match="Failed to connect"):
                await self.knowledge.ingest("test")


# =========================================================================
# MemoryClient (top-level)
# =========================================================================

class TestMemoryClient:

    @pytest.mark.asyncio
    async def test_client_reads_settings(self):
        with patch("src.memory.settings") as mock_settings:
            mock_settings.dashboard_url = "http://dash:3100"
            mock_settings.agent_secret = "mca_secret123"
            client = MemoryClient()
        assert client.state._base_url == "http://dash:3100"
        assert client.state._headers == {"X-API-Key": "mca_secret123"}
        assert client.knowledge._base_url == "http://dash:3100"
        assert client.knowledge._headers == {"X-API-Key": "mca_secret123"}

    @pytest.mark.asyncio
    async def test_client_strips_trailing_slash(self):
        with patch("src.memory.settings") as mock_settings:
            mock_settings.dashboard_url = "http://dash:3100/"
            mock_settings.agent_secret = "mca_s"
            client = MemoryClient()
        assert client.state._base_url == "http://dash:3100"

    @pytest.mark.asyncio
    async def test_state_and_knowledge_are_accessible(self):
        with patch("src.memory.settings") as mock_settings:
            mock_settings.dashboard_url = "http://dash:3100"
            mock_settings.agent_secret = "mca_s"
            client = MemoryClient()
        assert isinstance(client.state, StateClient)
        assert isinstance(client.knowledge, KnowledgeClient)
