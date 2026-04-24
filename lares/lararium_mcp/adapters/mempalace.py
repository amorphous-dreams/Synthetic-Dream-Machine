"""MemPalace sidecar adapter for the Lararium MCP carrier spine.

MemPalace runs as a standalone MCP server (JSON-RPC over stdio).  This adapter
manages its subprocess lifetime and exposes high-level methods for the tool
groups the Lararium spine consumes: search/query, knowledge graph, agent diary,
navigation, and tunnels.

The adapter uses no mempalace Python import — coupling stays at the protocol
boundary (JSON-RPC over stdin/stdout), keeping MemPalace independently
deployable and upgradeable.

Configuration:
    command: list of strings to launch the MemPalace MCP server
             default: ["python", "-m", "mempalace.mcp_server"]
    env:     optional dict of extra environment variables
             relevant keys: PALACE_PATH, MEMPALACE_COLLECTION, MEMPALACE_CONFIG

Lifecycle:
    adapter = MemPalaceAdapter(command=[...])
    adapter.start()
    adapter.initialize()
    result = adapter.search("some query")
    adapter.stop()

Or use as a context manager:
    with MemPalaceAdapter(command=[...]) as adapter:
        result = adapter.search("some query")
"""

from __future__ import annotations

import json
import subprocess
import threading
from typing import Any


_DEFAULT_COMMAND = ["python", "-m", "mempalace.mcp_server"]
_PROTOCOL_VERSION = "2025-11-25"


class AdapterError(Exception):
    """Raised when the MemPalace adapter encounters a protocol or process error."""


class MemPalaceAdapter:
    """JSON-RPC stdio client adapter for a MemPalace MCP server subprocess."""

    def __init__(
        self,
        command: list[str] | None = None,
        env: dict[str, str] | None = None,
    ) -> None:
        self._command = command or _DEFAULT_COMMAND
        self._env = env
        self._process: subprocess.Popen[str] | None = None
        self._lock = threading.Lock()
        self._next_id = 1

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Launch the MemPalace subprocess."""
        if self._process is not None and self._process.poll() is None:
            return
        self._process = subprocess.Popen(
            self._command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=self._env,
        )

    def stop(self) -> None:
        """Terminate the MemPalace subprocess."""
        if self._process is not None:
            self._process.terminate()
            try:
                self._process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._process.kill()
            self._process = None

    def alive(self) -> bool:
        """Return True when the subprocess runs and has not exited."""
        return self._process is not None and self._process.poll() is None

    def __enter__(self) -> "MemPalaceAdapter":
        self.start()
        self.initialize()
        return self

    def __exit__(self, *_: object) -> None:
        self.stop()

    # ------------------------------------------------------------------
    # JSON-RPC transport
    # ------------------------------------------------------------------

    def _send(self, method: str, params: dict[str, Any] | None = None) -> Any:
        if not self.alive():
            raise AdapterError("MemPalace process not running — call start() first")
        assert self._process is not None
        assert self._process.stdin is not None
        assert self._process.stdout is not None

        with self._lock:
            request_id = self._next_id
            self._next_id += 1

        request: dict[str, Any] = {"jsonrpc": "2.0", "id": request_id, "method": method}
        if params is not None:
            request["params"] = params

        line = json.dumps(request, separators=(",", ":")) + "\n"
        self._process.stdin.write(line)
        self._process.stdin.flush()

        raw = self._process.stdout.readline()
        if not raw:
            raise AdapterError("MemPalace process closed stdout unexpectedly")

        response = json.loads(raw)
        if "error" in response:
            err = response["error"]
            raise AdapterError(f"MemPalace error {err.get('code')}: {err.get('message')}")
        return response.get("result")

    def _call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> Any:
        result = self._send("tools/call", {"name": name, "arguments": arguments or {}})
        if isinstance(result, dict) and result.get("isError"):
            content = result.get("content", [{}])
            detail = content[0].get("text", "") if content else ""
            raise AdapterError(f"MemPalace tool error ({name}): {detail}")
        return result

    # ------------------------------------------------------------------
    # Protocol handshake
    # ------------------------------------------------------------------

    def initialize(self) -> dict[str, Any]:
        """Send the MCP initialize handshake and return server capabilities."""
        result = self._send("initialize", {
            "protocolVersion": _PROTOCOL_VERSION,
            "capabilities": {},
            "clientInfo": {"name": "lararium-mcp", "version": "0.1.0"},
        })
        self._send_notification("notifications/initialized")
        return result  # type: ignore[return-value]

    def _send_notification(self, method: str, params: dict[str, Any] | None = None) -> None:
        if not self.alive():
            return
        assert self._process is not None
        assert self._process.stdin is not None
        notification: dict[str, Any] = {"jsonrpc": "2.0", "method": method}
        if params:
            notification["params"] = params
        self._process.stdin.write(json.dumps(notification, separators=(",", ":")) + "\n")
        self._process.stdin.flush()

    def list_tools(self) -> list[dict[str, Any]]:
        result = self._send("tools/list")
        return result.get("tools", []) if isinstance(result, dict) else []

    # ------------------------------------------------------------------
    # Memory search and query
    # ------------------------------------------------------------------

    def search(self, query: str, *, n_results: int = 5, drawer: str | None = None) -> Any:
        """Search MemPalace memory by semantic query."""
        args: dict[str, Any] = {"query": query, "n_results": n_results}
        if drawer is not None:
            args["drawer"] = drawer
        return self._call_tool("mempalace_search", args)

    # ------------------------------------------------------------------
    # Knowledge graph
    # ------------------------------------------------------------------

    def kg_query(self, entity: str) -> Any:
        """Query the knowledge graph for an entity and its relationships."""
        return self._call_tool("mempalace_kg_query", {"entity": entity})

    def kg_stats(self) -> Any:
        """Return knowledge graph statistics."""
        return self._call_tool("mempalace_kg_stats")

    def kg_timeline(self, entity: str | None = None) -> Any:
        """Return knowledge graph timeline, optionally filtered by entity."""
        args: dict[str, Any] = {}
        if entity is not None:
            args["entity"] = entity
        return self._call_tool("mempalace_kg_timeline", args)

    # ------------------------------------------------------------------
    # Agent diary
    # ------------------------------------------------------------------

    def diary_write(self, entry: str, *, tags: list[str] | None = None) -> Any:
        """Write an entry to the agent diary."""
        args: dict[str, Any] = {"entry": entry}
        if tags:
            args["tags"] = tags
        return self._call_tool("mempalace_diary_write", args)

    def diary_read(self, *, n_entries: int = 10, tag: str | None = None) -> Any:
        """Read recent agent diary entries."""
        args: dict[str, Any] = {"n_entries": n_entries}
        if tag is not None:
            args["tag"] = tag
        return self._call_tool("mempalace_diary_read", args)

    # ------------------------------------------------------------------
    # Navigation and tunnels
    # ------------------------------------------------------------------

    def traverse(self, start: str, *, direction: str = "forward") -> Any:
        """Traverse the palace navigation graph from a starting node."""
        return self._call_tool("mempalace_traverse", {"start": start, "direction": direction})

    def create_tunnel(self, source: str, target: str, *, label: str | None = None) -> Any:
        """Create a navigation tunnel between two palace nodes."""
        args: dict[str, Any] = {"source": source, "target": target}
        if label is not None:
            args["label"] = label
        return self._call_tool("mempalace_create_tunnel", args)
