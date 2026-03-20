import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from src.agent.core import AgentBrain
from src.agent.state import AgentState

def test_agent_state_initial():
    state = AgentState()
    assert state.status == "idle"
    assert state.active_tasks == 0

def test_agent_state_track_task():
    state = AgentState()
    state.start_task("task-1")
    assert state.active_tasks == 1
    assert state.status == "busy"
    state.finish_task("task-1")
    assert state.active_tasks == 0
    assert state.status == "idle"

@pytest.mark.asyncio
async def test_agent_brain_run_prompt():
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="Hello from Claude")]
    mock_response.usage = MagicMock(input_tokens=10, output_tokens=5)
    mock_response.stop_reason = "end_turn"
    with patch("src.agent.providers.anthropic.AsyncAnthropic") as MockClient:
        instance = MockClient.return_value
        instance.messages.create = AsyncMock(return_value=mock_response)
        brain = AgentBrain()
        brain.registry.get("anthropic").configure("test-key")
        result = await brain.run("Say hello")
    assert result["output"] == "Hello from Claude"
    assert result["usage"]["input_tokens"] == 10
