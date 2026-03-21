"""Tool schema generation, format conversion, and execution for the agentic loop."""

import inspect
import json
import logging
from typing import Any

logger = logging.getLogger("uvicorn.error")

# Max size for tool results before truncation (bytes)
MAX_RESULT_SIZE = 15_000


def generate_tool_schema(tool: dict) -> dict:
    """Generate a canonical tool schema from a plugin tool dict with handler."""
    handler = tool["handler"]
    sig = inspect.signature(handler)
    properties: dict[str, dict] = {}
    required: list[str] = []

    type_map = {str: "string", int: "integer", float: "number", bool: "boolean"}

    for name, param in sig.parameters.items():
        annotation = param.annotation
        prop: dict[str, Any] = {"type": type_map.get(annotation, "string")}

        if param.default is not inspect.Parameter.empty:
            prop["default"] = param.default
        else:
            required.append(name)

        properties[name] = prop

    return {
        "name": tool["name"],
        "description": tool.get("description", ""),
        "parameters": {
            "type": "object",
            "properties": properties,
            "required": required,
        },
    }


def to_anthropic_tools(canonical_tools: list[dict]) -> list[dict]:
    """Convert canonical tool schemas to Anthropic format."""
    return [
        {
            "name": t["name"],
            "description": t["description"],
            "input_schema": t["parameters"],
        }
        for t in canonical_tools
    ]


def to_openai_tools(canonical_tools: list[dict]) -> list[dict]:
    """Convert canonical tool schemas to OpenAI function-calling format."""
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["parameters"],
            },
        }
        for t in canonical_tools
    ]


def to_gemini_tools(canonical_tools: list[dict]):
    """Convert canonical tool schemas to Gemini FunctionDeclaration format."""
    from google.genai import types

    declarations = []
    for t in canonical_tools:
        params = t["parameters"]
        # Gemini uses a simplified schema — convert our JSON schema
        gemini_properties = {}
        for prop_name, prop_def in params.get("properties", {}).items():
            gemini_type = prop_def.get("type", "STRING").upper()
            # Map JSON schema types to Gemini types
            type_map = {
                "STRING": "STRING",
                "INTEGER": "INTEGER",
                "NUMBER": "NUMBER",
                "BOOLEAN": "BOOLEAN",
            }
            gemini_properties[prop_name] = types.Schema(
                type=type_map.get(gemini_type, "STRING"),
            )

        declarations.append(
            types.FunctionDeclaration(
                name=t["name"],
                description=t["description"],
                parameters=types.Schema(
                    type="OBJECT",
                    properties=gemini_properties,
                    required=params.get("required", []),
                )
                if gemini_properties
                else None,
            )
        )
    return [types.Tool(function_declarations=declarations)]


def truncate_result(result: str) -> str:
    """Truncate large tool results to save tokens."""
    if len(result) <= MAX_RESULT_SIZE:
        return result
    half = MAX_RESULT_SIZE // 2
    return (
        result[:half]
        + f"\n\n... [truncated {len(result) - MAX_RESULT_SIZE:,} chars to save tokens] ...\n\n"
        + result[-half:]
    )


async def execute_tool(
    tool_name: str,
    arguments: dict,
    tools: list[dict],
) -> str:
    """Execute a tool call by dispatching to the plugin handler."""
    handler = None
    for t in tools:
        if t["name"] == tool_name:
            handler = t["handler"]
            break

    if not handler:
        return json.dumps({"error": f"Unknown tool: {tool_name}"})

    try:
        result = await handler(**arguments)
        result_str = json.dumps(result) if isinstance(result, (dict, list)) else str(result)
        return truncate_result(result_str)
    except Exception as e:
        logger.error(f"Tool execution error ({tool_name}): {e}")
        return json.dumps({"error": f"Tool '{tool_name}' failed: {str(e)}"})
