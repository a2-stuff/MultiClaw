import logging
from src.config import settings
from src.agent.providers import ProviderRegistry
from src.agent.tool_executor import generate_tool_schema, execute_tool

logger = logging.getLogger("uvicorn.error")


class AgentBrain:
    def __init__(self):
        self.registry = ProviderRegistry()
        self.default_provider = settings.default_provider
        self.default_model = settings.default_model
        self.max_tokens = settings.max_tokens
        self._configure_providers()

    def _configure_providers(self):
        key_map = {
            "anthropic": settings.anthropic_api_key or settings._dashboard_anthropic_key,
            "openai": settings.openai_api_key or settings._dashboard_openai_key,
            "gemini": settings.google_api_key or settings._dashboard_google_key,
            "openrouter": settings.openrouter_api_key or settings._dashboard_openrouter_key,
            "deepseek": settings.deepseek_api_key or settings._dashboard_deepseek_key,
        }
        for provider_name, key in key_map.items():
            if key:
                provider = self.registry.get(provider_name)
                if provider:
                    provider.configure(key)

    def refresh_client(self):
        self._configure_providers()

    def _resolve_provider(self, provider: str = "", model: str = ""):
        p_name = provider or self.default_provider
        m_name = model or self.default_model
        p = self.registry.get(p_name)
        if not p:
            raise ValueError(f"Unknown provider: {p_name}")
        if not p.is_configured():
            raise RuntimeError(f"Provider '{p_name}' has no API key configured")
        return p, m_name

    async def run(self, prompt: str, system: str = "", provider: str = "", model: str = "") -> dict:
        p, m = self._resolve_provider(provider, model)
        return await p.run(prompt, m, system=system, max_tokens=self.max_tokens)

    async def run_stream(self, prompt: str, system: str = "", provider: str = "", model: str = ""):
        p, m = self._resolve_provider(provider, model)
        async for text in p.run_stream(prompt, m, system=system, max_tokens=self.max_tokens):
            yield text

    async def run_agentic(
        self,
        prompt: str,
        system: str = "",
        provider: str = "",
        model: str = "",
        tools: list[dict] | None = None,
        max_turns: int = 10,
    ) -> dict:
        """Run a multi-turn agentic loop with tool calling.

        Args:
            prompt: User prompt
            system: System prompt (should include tool context)
            provider/model: LLM provider and model
            tools: Raw plugin tools with handlers
            max_turns: Max agentic loop iterations

        Returns:
            {output, usage, tool_calls_log, turns}
        """
        p, m = self._resolve_provider(provider, model)

        # If no tools, fall back to single-shot
        if not tools:
            result = await p.run(prompt, m, system=system, max_tokens=self.max_tokens)
            return {
                "output": result["output"],
                "usage": result["usage"],
                "tool_calls_log": [],
                "turns": 1,
            }

        # Build canonical tool schemas for the provider (skip tools without handlers)
        valid_tools = [t for t in tools if callable(t.get("handler"))]
        canonical_tools = [generate_tool_schema(t) for t in valid_tools]

        # Start conversation
        messages = [{"role": "user", "content": prompt}]
        total_usage = {"input_tokens": 0, "output_tokens": 0}
        tool_calls_log: list[dict] = []

        for turn in range(max_turns):
            response = await p.run_with_tools(
                messages=messages,
                tools=canonical_tools,
                model=m,
                system=system,
                max_tokens=self.max_tokens,
            )

            # Accumulate token usage
            total_usage["input_tokens"] += response["usage"]["input_tokens"]
            total_usage["output_tokens"] += response["usage"]["output_tokens"]

            # No tool calls — we have a final text response
            if not response["tool_calls"]:
                return {
                    "output": response["content"],
                    "usage": total_usage,
                    "tool_calls_log": tool_calls_log,
                    "turns": turn + 1,
                }

            # Append assistant message with tool calls
            messages.append({
                "role": "assistant",
                "content": response["content"],
                "tool_calls": response["tool_calls"],
            })

            # Execute each tool call and append results
            for tc in response["tool_calls"]:
                logger.info(f"Executing tool: {tc['name']}")
                result = await execute_tool(tc["name"], tc["arguments"], valid_tools)

                tool_calls_log.append({
                    "turn": turn + 1,
                    "tool": tc["name"],
                    "arguments": tc["arguments"],
                    "result_preview": result[:200] if len(result) > 200 else result,
                })

                tool_msg = {
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result,
                    "tool_name": tc["name"],  # Needed for Gemini
                }
                messages.append(tool_msg)

        # Max turns exhausted — return whatever we have
        last_content = response["content"] if response.get("content") else ""
        if not last_content:
            last_content = (
                f"[Agent reached max turns ({max_turns}). "
                f"Executed {len(tool_calls_log)} tool calls. Last tool results are available.]"
            )

        return {
            "output": last_content,
            "usage": total_usage,
            "tool_calls_log": tool_calls_log,
            "turns": max_turns,
        }

    def get_status(self) -> dict:
        return {
            "default_provider": self.default_provider,
            "default_model": self.default_model,
            "configured_providers": self.registry.list_configured(),
            "available_models": self.registry.list_models(),
        }
