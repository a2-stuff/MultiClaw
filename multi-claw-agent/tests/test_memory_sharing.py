"""Tests for multi-agent memory sharing scenarios.

Simulates two agents using the memory system concurrently — reading/writing
shared state and knowledge entries through the dashboard API.
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock, call
import httpx

from src.memory import (
    StateClient,
    KnowledgeClient,
    MemoryError,
    VersionConflictError,
)

BASE_URL = "http://dashboard:3100"
AGENT_1_HEADERS = {"X-API-Key": "mca_agent-001-secret"}
AGENT_2_HEADERS = {"X-API-Key": "mca_agent-002-secret"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resp(status_code: int = 200, json_data=None, text: str = ""):
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = json_data if json_data is not None else {}
    resp.text = text
    resp.content = b"content"
    if status_code >= 400:
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            message=f"HTTP {status_code}", request=MagicMock(), response=resp,
        )
    else:
        resp.raise_for_status.return_value = None
    return resp


def _mock_client_with_responses(responses: list):
    """Create a mock AsyncClient that returns different responses per call.

    Each entry in *responses* is a (method, response) tuple.
    Calls are matched in order across all methods.
    """
    call_index = {"i": 0}
    mock_client = AsyncMock()

    async def _dispatch(*args, **kwargs):
        idx = call_index["i"]
        call_index["i"] += 1
        if idx < len(responses):
            return responses[idx]
        raise RuntimeError(f"Unexpected call #{idx}")

    mock_client.get = AsyncMock(side_effect=_dispatch)
    mock_client.put = AsyncMock(side_effect=_dispatch)
    mock_client.post = AsyncMock(side_effect=_dispatch)
    mock_client.delete = AsyncMock(side_effect=_dispatch)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


def _simple_mock(response):
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=response)
    mock_client.put = AsyncMock(return_value=response)
    mock_client.post = AsyncMock(return_value=response)
    mock_client.delete = AsyncMock(return_value=response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


# =========================================================================
# Shared State — Multi-Agent Scenarios
# =========================================================================

class TestSharedStateMultiAgent:
    """Two agents sharing state through the same namespace."""

    def setup_method(self):
        self.agent1_state = StateClient(BASE_URL, AGENT_1_HEADERS)
        self.agent2_state = StateClient(BASE_URL, AGENT_2_HEADERS)

    @pytest.mark.asyncio
    async def test_agent1_writes_agent2_reads(self):
        """Agent 1 writes a value, Agent 2 reads it back."""
        entry = {
            "id": "s1", "namespace": "shared", "key": "status",
            "value": "processing", "version": 1,
            "createdBy": "agent-001",
        }

        # Agent 1 writes
        write_mock = _simple_mock(_resp(201, json_data=entry))
        with patch("src.memory.httpx.AsyncClient", return_value=write_mock):
            result = await self.agent1_state.set("status", "processing", namespace="shared")
        assert result["createdBy"] == "agent-001"
        write_mock.put.assert_called_once_with(
            f"{BASE_URL}/api/memory/state/shared/status",
            headers=AGENT_1_HEADERS,
            json={"value": "processing"},
        )

        # Agent 2 reads
        read_mock = _simple_mock(_resp(200, json_data=entry))
        with patch("src.memory.httpx.AsyncClient", return_value=read_mock):
            value = await self.agent2_state.get("status", namespace="shared")
        assert value == "processing"
        read_mock.get.assert_called_once_with(
            f"{BASE_URL}/api/memory/state/shared/status",
            headers=AGENT_2_HEADERS,
        )

    @pytest.mark.asyncio
    async def test_optimistic_concurrency_conflict(self):
        """Two agents try to update the same key — second gets a version conflict."""
        # Agent 1 updates successfully (version 1 → 2)
        updated = {"id": "s1", "key": "counter", "value": "10", "version": 2}
        mock1 = _simple_mock(_resp(200, json_data=updated))
        with patch("src.memory.httpx.AsyncClient", return_value=mock1):
            result = await self.agent1_state.set("counter", 10, namespace="shared", version=1)
        assert result["version"] == 2

        # Agent 2 tries to update with stale version 1 → 409
        conflict_resp = _resp(409, json_data={"error": "Version conflict", "currentVersion": 2})
        conflict_resp.raise_for_status.side_effect = None  # 409 is checked before raise
        mock2 = _simple_mock(conflict_resp)
        with patch("src.memory.httpx.AsyncClient", return_value=mock2):
            with pytest.raises(VersionConflictError) as exc_info:
                await self.agent2_state.set("counter", 20, namespace="shared", version=1)
        assert exc_info.value.current_version == 2

    @pytest.mark.asyncio
    async def test_retry_after_version_conflict(self):
        """Agent retries with correct version after a conflict."""
        # First attempt: conflict
        conflict_resp = _resp(409, json_data={"currentVersion": 3})
        conflict_resp.raise_for_status.side_effect = None
        mock_conflict = _simple_mock(conflict_resp)
        with patch("src.memory.httpx.AsyncClient", return_value=mock_conflict):
            with pytest.raises(VersionConflictError) as exc_info:
                await self.agent2_state.set("counter", 99, namespace="shared", version=2)
        new_version = exc_info.value.current_version

        # Second attempt: success with correct version
        success = {"id": "s1", "key": "counter", "value": "99", "version": 4}
        mock_success = _simple_mock(_resp(200, json_data=success))
        with patch("src.memory.httpx.AsyncClient", return_value=mock_success):
            result = await self.agent2_state.set(
                "counter", 99, namespace="shared", version=new_version,
            )
        assert result["version"] == 4

    @pytest.mark.asyncio
    async def test_namespace_isolation(self):
        """Agents using different namespaces don't see each other's keys."""
        # Agent 1 writes to namespace "agent1-private"
        entry1 = {"id": "s1", "key": "secret", "value": "mine", "version": 1}
        mock1 = _simple_mock(_resp(201, json_data=entry1))
        with patch("src.memory.httpx.AsyncClient", return_value=mock1):
            await self.agent1_state.set("secret", "mine", namespace="agent1-private")

        # Agent 2 tries to read from that namespace — key not found
        mock2 = _simple_mock(_resp(404, text="Key not found"))
        with patch("src.memory.httpx.AsyncClient", return_value=mock2):
            with pytest.raises(MemoryError, match="404"):
                await self.agent2_state.get_entry("secret", namespace="agent2-private")

    @pytest.mark.asyncio
    async def test_agent1_writes_agent2_deletes(self):
        """Agent 2 can delete a key created by Agent 1."""
        # Agent 1 creates
        mock_create = _simple_mock(_resp(201, json_data={"id": "s1", "version": 1}))
        with patch("src.memory.httpx.AsyncClient", return_value=mock_create):
            await self.agent1_state.set("temp", "data", namespace="shared")

        # Agent 2 deletes
        mock_delete = _simple_mock(_resp(200, json_data={"success": True}))
        with patch("src.memory.httpx.AsyncClient", return_value=mock_delete):
            result = await self.agent2_state.delete("temp", namespace="shared")
        assert result is True

    @pytest.mark.asyncio
    async def test_both_agents_list_same_namespace(self):
        """Both agents see the same keys when listing a shared namespace."""
        keys = [
            {"id": "s1", "key": "a", "version": 1},
            {"id": "s2", "key": "b", "version": 1},
        ]
        mock1 = _simple_mock(_resp(200, json_data=keys))
        with patch("src.memory.httpx.AsyncClient", return_value=mock1):
            result1 = await self.agent1_state.list_keys("shared")

        mock2 = _simple_mock(_resp(200, json_data=keys))
        with patch("src.memory.httpx.AsyncClient", return_value=mock2):
            result2 = await self.agent2_state.list_keys("shared")

        assert result1 == result2 == keys


# =========================================================================
# Knowledge Base — Multi-Agent Scenarios
# =========================================================================

class TestKnowledgeMultiAgent:
    """Two agents sharing the knowledge base."""

    def setup_method(self):
        self.agent1_kb = KnowledgeClient(BASE_URL, AGENT_1_HEADERS)
        self.agent2_kb = KnowledgeClient(BASE_URL, AGENT_2_HEADERS)

    @pytest.mark.asyncio
    async def test_agent1_ingests_agent2_searches(self):
        """Agent 1 ingests knowledge, Agent 2 finds it via search."""
        # Agent 1 ingests
        ingested = {"id": "k1", "hasEmbedding": True}
        mock_ingest = _simple_mock(_resp(201, json_data=ingested))
        with patch("src.memory.httpx.AsyncClient", return_value=mock_ingest):
            result = await self.agent1_kb.ingest(
                "The API rate limit is 100 req/min",
                metadata={"source": "agent-001"},
            )
        assert result["hasEmbedding"] is True

        # Agent 2 searches
        search_result = {
            "results": [{
                "id": "k1",
                "content": "The API rate limit is 100 req/min",
                "similarity": 0.95,
                "metadata": {"source": "agent-001"},
            }],
            "totalWithEmbeddings": 1,
        }
        mock_search = _simple_mock(_resp(200, json_data=search_result))
        with patch("src.memory.httpx.AsyncClient", return_value=mock_search):
            results = await self.agent2_kb.search("rate limiting")
        assert results["results"][0]["similarity"] == 0.95
        assert results["results"][0]["metadata"]["source"] == "agent-001"

    @pytest.mark.asyncio
    async def test_both_agents_ingest_then_list(self):
        """Both agents contribute knowledge, both can list all entries."""
        entries = {
            "entries": [
                {"id": "k1", "content": "from agent 1", "createdBy": "agent-001"},
                {"id": "k2", "content": "from agent 2", "createdBy": "agent-002"},
            ],
            "total": 2, "limit": 50, "offset": 0,
        }
        # Agent 1 lists
        mock1 = _simple_mock(_resp(200, json_data=entries))
        with patch("src.memory.httpx.AsyncClient", return_value=mock1):
            result1 = await self.agent1_kb.list_entries()
        assert result1["total"] == 2

        # Agent 2 lists — sees the same entries
        mock2 = _simple_mock(_resp(200, json_data=entries))
        with patch("src.memory.httpx.AsyncClient", return_value=mock2):
            result2 = await self.agent2_kb.list_entries()
        assert result2["total"] == 2

    @pytest.mark.asyncio
    async def test_agent2_deletes_agent1_entry(self):
        """Agent 2 can delete knowledge ingested by Agent 1."""
        mock = _simple_mock(_resp(200, json_data={"success": True}))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            result = await self.agent2_kb.delete("k1")
        assert result is True

    @pytest.mark.asyncio
    async def test_search_with_no_embeddings(self):
        """Search returns 503 when embedding service is unavailable."""
        mock = _simple_mock(
            _resp(503, text="Embedding generation unavailable")
        )
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            with pytest.raises(MemoryError, match="503"):
                await self.agent1_kb.search("anything")


# =========================================================================
# Cross-Cutting: Auth Headers
# =========================================================================

class TestAgentAuthHeaders:
    """Verify each agent sends its own credentials."""

    @pytest.mark.asyncio
    async def test_agents_use_different_api_keys(self):
        agent1 = StateClient(BASE_URL, AGENT_1_HEADERS)
        agent2 = StateClient(BASE_URL, AGENT_2_HEADERS)

        mock1 = _simple_mock(_resp(200, json_data=[]))
        with patch("src.memory.httpx.AsyncClient", return_value=mock1):
            await agent1.list_keys()
        mock1.get.assert_called_once_with(
            f"{BASE_URL}/api/memory/state/default",
            headers=AGENT_1_HEADERS,
        )

        mock2 = _simple_mock(_resp(200, json_data=[]))
        with patch("src.memory.httpx.AsyncClient", return_value=mock2):
            await agent2.list_keys()
        mock2.get.assert_called_once_with(
            f"{BASE_URL}/api/memory/state/default",
            headers=AGENT_2_HEADERS,
        )

    @pytest.mark.asyncio
    async def test_invalid_api_key_rejected(self):
        """Dashboard rejects requests with invalid API key."""
        bad_agent = StateClient(BASE_URL, {"X-API-Key": "mca_invalid"})
        mock = _simple_mock(_resp(401, text="Invalid API key"))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            with pytest.raises(MemoryError, match="401"):
                await bad_agent.list_keys()

    @pytest.mark.asyncio
    async def test_missing_api_key_rejected(self):
        """Dashboard rejects requests with no API key."""
        no_auth = StateClient(BASE_URL, {})
        mock = _simple_mock(_resp(401, text="Missing authorization header or API key"))
        with patch("src.memory.httpx.AsyncClient", return_value=mock):
            with pytest.raises(MemoryError, match="401"):
                await no_auth.list_keys()
