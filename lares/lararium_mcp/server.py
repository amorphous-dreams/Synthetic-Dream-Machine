"""Dependency-light stdio MCP server for the Lararium carrier spine.

The server binds the current `lares/`-native resolver, carrier ingress, virtual
indexes, resources, and read-only tools to the MCP JSON-RPC stdio transport.
It intentionally avoids any SDK dependency for the first bootstrapping slice.
"""

from __future__ import annotations

import json
import sys
import traceback
from collections.abc import Callable
from typing import Any

from .compiler import compile_boot_receipt, compile_full_boot, compile_minimal_boot
from .resources import ResourceEntry, inspect_carrier, inspect_resolution, list_lar_resources, read_lar_resource_or_index
from .tools import (
    inspect_carrier_tool,
    list_lar_carriers_tool,
    read_lar_resource_tool,
    resolve_lar_uri_tool,
)


SERVER_NAME = "lararium-mcp"
SERVER_VERSION = "0.1.0"
LATEST_PROTOCOL_VERSION = "2025-11-25"
SUPPORTED_PROTOCOL_VERSIONS = (
    "2025-11-25",
    "2025-06-18",
    "2025-03-26",
    "2024-11-05",
)


JSONRPC_PARSE_ERROR = -32700
JSONRPC_INVALID_REQUEST = -32600
JSONRPC_METHOD_NOT_FOUND = -32601
JSONRPC_INVALID_PARAMS = -32602
JSONRPC_INTERNAL_ERROR = -32603
MCP_RESOURCE_NOT_FOUND = -32002


class MCPError(Exception):
    """Error that should become a JSON-RPC error response."""

    def __init__(self, code: int, message: str, data: object | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.data = data


def _response(request_id: str | int, result: dict[str, object]) -> dict[str, object]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _error_response(request_id: str | int | None, code: int, message: str, data: object | None = None) -> dict[str, object]:
    error: dict[str, object] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    response: dict[str, object] = {"jsonrpc": "2.0", "error": error}
    if request_id is not None:
        response["id"] = request_id
    return response


def _require_params(message: dict[str, object]) -> dict[str, object]:
    params = message.get("params", {})
    if not isinstance(params, dict):
        raise MCPError(JSONRPC_INVALID_PARAMS, "params must be an object")
    return params


def _require_string(params: dict[str, object], name: str) -> str:
    value = params.get(name)
    if not isinstance(value, str) or not value:
        raise MCPError(JSONRPC_INVALID_PARAMS, f"params.{name} must be a non-empty string")
    return value


def _resource_to_mcp(entry: ResourceEntry) -> dict[str, object]:
    return {
        "uri": entry.uri,
        "name": entry.name,
        "title": entry.name,
        "mimeType": entry.mime_type,
        "annotations": {"audience": ["user", "assistant"], "priority": 0.7},
    }


def _mime_type_for(uri: str) -> str:
    for entry in list_lar_resources():
        if entry.uri == uri:
            return entry.mime_type
    if uri.startswith("lar:///INDEXES/"):
        return "application/json"
    return "text/markdown"


def _json_tool_result(value: object) -> str:
    if isinstance(value, str):
        return value
    return json.dumps(value, indent=2, sort_keys=True)


def _tool_result(value: object, is_error: bool = False) -> dict[str, object]:
    return {"content": [{"type": "text", "text": _json_tool_result(value)}], "isError": is_error}


def _uri_schema(description: str) -> dict[str, object]:
    return {
        "type": "object",
        "properties": {"uri": {"type": "string", "description": description}},
        "required": ["uri"],
        "additionalProperties": False,
    }


TOOL_HANDLERS: dict[str, Callable[[dict[str, object]], object]] = {
    "lararium.resolve_lar_uri": lambda args: resolve_lar_uri_tool(_require_string(args, "uri")),
    "lararium.read_lar_resource": lambda args: read_lar_resource_tool(_require_string(args, "uri")),
    "lararium.list_lar_resources": lambda args: list_lar_carriers_tool(),
    "lararium.inspect_carrier": lambda args: inspect_carrier_tool(_require_string(args, "uri")),
    "lararium.compile_minimal_boot": lambda args: compile_minimal_boot(
        str(args["entry"]) if isinstance(args.get("entry"), str) else "lar:///AGENTS"
    ),
    "lararium.compile_full_boot": lambda args: compile_full_boot(
        str(args["entry"]) if isinstance(args.get("entry"), str) else "lar:///AGENTS"
    ),
    "lararium.compile_boot_receipt": lambda args: compile_boot_receipt(compile_minimal_boot()),
}


_OPTIONAL_ENTRY_SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "entry": {
            "type": "string",
            "description": "Entry URI for the boot closure. Defaults to lar:///AGENTS.",
        }
    },
    "additionalProperties": False,
}

TOOL_DEFINITIONS: tuple[dict[str, object], ...] = (
    {
        "name": "lararium.resolve_lar_uri",
        "title": "Resolve lar URI",
        "description": "Resolve a lar:/// URI into file-backed or virtual Lararium resource metadata.",
        "inputSchema": _uri_schema("A lar:/// URI such as lar:///AGENTS or lar:///INDEXES/carriers."),
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True},
    },
    {
        "name": "lararium.read_lar_resource",
        "title": "Read Lararium resource",
        "description": "Read a file-backed Lararium carrier or a virtual index resource.",
        "inputSchema": _uri_schema("A readable Lararium resource URI."),
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True},
    },
    {
        "name": "lararium.list_lar_resources",
        "title": "List Lararium resources",
        "description": "List file-backed carrier resources and virtual index resources.",
        "inputSchema": {"type": "object", "additionalProperties": False},
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True},
    },
    {
        "name": "lararium.inspect_carrier",
        "title": "Inspect carrier",
        "description": "Inspect carrier metadata, implements bundle, shape diagnostics, rating posture, and depth state.",
        "inputSchema": _uri_schema("A file-backed Lararium carrier URI."),
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True},
    },
    {
        "name": "lararium.compile_minimal_boot",
        "title": "Compile minimal boot",
        "description": (
            "Compile the minimal boot closure from the AGENTS required-core. "
            "Returns a boot artifact with resolved loci, roles, implements bundles, and validation. "
            "Use this when you need the smallest lawful hydration set for cold-start context."
        ),
        "inputSchema": _OPTIONAL_ENTRY_SCHEMA,
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True},
    },
    {
        "name": "lararium.compile_full_boot",
        "title": "Compile full boot",
        "description": (
            "Compile the full boot closure: required-core plus all indexed carriers. "
            "Returns a boot artifact with the complete reachable carrier graph. "
            "Use this when you need the full hydrated graph for inspection or drift detection."
        ),
        "inputSchema": _OPTIONAL_ENTRY_SCHEMA,
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True},
    },
    {
        "name": "lararium.compile_boot_receipt",
        "title": "Compile boot receipt",
        "description": (
            "Compile a boot receipt: a sha256-digested summary of the current minimal boot closure. "
            "Use this for cache invalidation, drift detection, or continuity persistence."
        ),
        "inputSchema": {"type": "object", "additionalProperties": False},
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True},
    },
)


def _handle_initialize(message: dict[str, object]) -> dict[str, object]:
    params = _require_params(message)
    requested = params.get("protocolVersion")
    protocol_version = requested if requested in SUPPORTED_PROTOCOL_VERSIONS else LATEST_PROTOCOL_VERSION
    return {
        "protocolVersion": protocol_version,
        "capabilities": {
            "resources": {},
            "tools": {},
        },
        "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
        "instructions": (
            "Read-only Lararium MCP server. Source truth stays under lares/. "
            "Use lar:///AGENTS, lar:///LARES, lar:///ha.ka.ba/**, and virtual lar:///INDEXES/** resources."
        ),
    }


def _handle_resources_list(_message: dict[str, object]) -> dict[str, object]:
    return {"resources": [_resource_to_mcp(entry) for entry in list_lar_resources()]}


def _handle_resources_read(message: dict[str, object]) -> dict[str, object]:
    params = _require_params(message)
    uri = _require_string(params, "uri")
    try:
        text = read_lar_resource_or_index(uri)
    except FileNotFoundError as exc:
        raise MCPError(MCP_RESOURCE_NOT_FOUND, "Resource not found", {"uri": uri, "detail": str(exc)}) from exc
    return {"contents": [{"uri": uri, "mimeType": _mime_type_for(uri), "text": text}]}


def _handle_tools_list(_message: dict[str, object]) -> dict[str, object]:
    return {"tools": list(TOOL_DEFINITIONS)}


def _handle_tools_call(message: dict[str, object]) -> dict[str, object]:
    params = _require_params(message)
    name = _require_string(params, "name")
    arguments = params.get("arguments", {})
    if not isinstance(arguments, dict):
        raise MCPError(JSONRPC_INVALID_PARAMS, "params.arguments must be an object")
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        raise MCPError(JSONRPC_METHOD_NOT_FOUND, f"Unknown tool: {name}")
    try:
        return _tool_result(handler(arguments))
    except FileNotFoundError as exc:
        return _tool_result({"error": "Resource not found", "detail": str(exc)}, is_error=True)
    except ValueError as exc:
        return _tool_result({"error": "Invalid URI", "detail": str(exc)}, is_error=True)


def _handle_resource_templates_list(_message: dict[str, object]) -> dict[str, object]:
    return {
        "resourceTemplates": [
            {
                "uriTemplate": "lar:///INDEXES/{index}",
                "name": "Lararium virtual indexes",
                "title": "Lararium virtual indexes",
                "description": "Compiler-produced index resources such as carriers, interfaces, and invariants.",
                "mimeType": "application/json",
            },
            {
                "uriTemplate": "lar:///ha.ka.ba/{path}",
                "name": "Stable ha.ka.ba source carriers",
                "title": "Stable ha.ka.ba source carriers",
                "description": "File-backed Lararium source carriers under lares/ha-ka-ba/.",
                "mimeType": "text/markdown",
            },
        ]
    }


REQUEST_HANDLERS: dict[str, Callable[[dict[str, object]], dict[str, object]]] = {
    "initialize": _handle_initialize,
    "ping": lambda _message: {},
    "resources/list": _handle_resources_list,
    "resources/read": _handle_resources_read,
    "resources/templates/list": _handle_resource_templates_list,
    "tools/list": _handle_tools_list,
    "tools/call": _handle_tools_call,
}


def handle_jsonrpc_message(message: object) -> dict[str, object] | None:
    """Handle one JSON-RPC message object.

    Notifications return ``None`` because JSON-RPC notifications must not receive
    responses.
    """

    if not isinstance(message, dict):
        return _error_response(None, JSONRPC_INVALID_REQUEST, "JSON-RPC message must be an object")

    request_id = message.get("id")
    if "id" not in message:
        # Accept notifications, including notifications/initialized and cancelled.
        return None

    if not isinstance(request_id, (str, int)):
        return _error_response(None, JSONRPC_INVALID_REQUEST, "request id must be a string or integer")
    if message.get("jsonrpc") != "2.0":
        return _error_response(request_id, JSONRPC_INVALID_REQUEST, "jsonrpc must be '2.0'")

    method = message.get("method")
    if not isinstance(method, str):
        return _error_response(request_id, JSONRPC_INVALID_REQUEST, "method must be a string")

    handler = REQUEST_HANDLERS.get(method)
    if handler is None:
        return _error_response(request_id, JSONRPC_METHOD_NOT_FOUND, f"Method not found: {method}")

    try:
        return _response(request_id, handler(message))
    except MCPError as exc:
        return _error_response(request_id, exc.code, exc.message, exc.data)
    except Exception as exc:  # pragma: no cover - defensive server boundary
        print(traceback.format_exc(), file=sys.stderr)
        return _error_response(request_id, JSONRPC_INTERNAL_ERROR, "Internal error", {"detail": str(exc)})


def run_stdio() -> int:
    """Run newline-delimited JSON-RPC over stdin/stdout."""

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
        except json.JSONDecodeError as exc:
            response = _error_response(None, JSONRPC_PARSE_ERROR, "Parse error", {"detail": str(exc)})
        else:
            response = handle_jsonrpc_message(message)
        if response is not None:
            sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
            sys.stdout.flush()
    return 0


def main() -> int:
    return run_stdio()


if __name__ == "__main__":
    raise SystemExit(main())
