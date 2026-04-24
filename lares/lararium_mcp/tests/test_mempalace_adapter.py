"""Unit tests for the MemPalace sidecar adapter.

Tests mock the subprocess entirely — no live MemPalace process required.
"""

from __future__ import annotations

import io
import json
import unittest
from unittest.mock import MagicMock, patch

from lares.lararium_mcp.adapters.mempalace import AdapterError, MemPalaceAdapter


def _make_response(request_id: int, result: object) -> str:
    return json.dumps({"jsonrpc": "2.0", "id": request_id, "result": result}) + "\n"


def _make_error_response(request_id: int, code: int, message: str) -> str:
    return json.dumps({
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": code, "message": message},
    }) + "\n"


def _mock_process(*response_lines: str) -> MagicMock:
    """Return a mock Popen-like object that yields the given response lines."""
    proc = MagicMock()
    proc.poll.return_value = None  # alive
    proc.stdin = MagicMock()
    proc.stdout = io.StringIO("".join(response_lines))
    return proc


class AdapterLifecycleTests(unittest.TestCase):
    def test_alive_false_before_start(self) -> None:
        adapter = MemPalaceAdapter()
        self.assertFalse(adapter.alive())

    def test_alive_true_after_mock_start(self) -> None:
        adapter = MemPalaceAdapter(command=["echo"])
        with patch("subprocess.Popen") as mock_popen:
            mock_popen.return_value = _mock_process()
            adapter.start()
        self.assertTrue(adapter.alive())

    def test_start_idempotent_when_alive(self) -> None:
        adapter = MemPalaceAdapter(command=["echo"])
        with patch("subprocess.Popen") as mock_popen:
            proc = _mock_process()
            mock_popen.return_value = proc
            adapter.start()
            adapter.start()  # second call should not spawn a new process
        self.assertEqual(mock_popen.call_count, 1)

    def test_stop_terminates_process(self) -> None:
        adapter = MemPalaceAdapter(command=["echo"])
        with patch("subprocess.Popen") as mock_popen:
            proc = _mock_process()
            mock_popen.return_value = proc
            adapter.start()
            adapter.stop()
        proc.terminate.assert_called_once()
        self.assertFalse(adapter.alive())


class AdapterJsonRpcTests(unittest.TestCase):
    def _adapter_with_responses(self, *lines: str) -> MemPalaceAdapter:
        adapter = MemPalaceAdapter(command=["echo"])
        with patch("subprocess.Popen") as mock_popen:
            mock_popen.return_value = _mock_process(*lines)
            adapter.start()
        return adapter

    def test_send_raises_when_not_started(self) -> None:
        adapter = MemPalaceAdapter()
        with self.assertRaises(AdapterError):
            adapter._send("ping")

    def test_initialize_returns_capabilities(self) -> None:
        caps = {"tools": {}, "resources": {}}
        adapter = self._adapter_with_responses(
            _make_response(1, {"protocolVersion": "2025-11-25", "capabilities": caps}),
        )
        result = adapter.initialize()
        self.assertIn("capabilities", result)

    def test_error_response_raises_adapter_error(self) -> None:
        adapter = self._adapter_with_responses(
            _make_error_response(1, -32601, "Method not found"),
        )
        with self.assertRaises(AdapterError, msg="Method not found"):
            adapter._send("tools/list")

    def test_call_tool_returns_result(self) -> None:
        tool_result = {"content": [{"type": "text", "text": "found 3 items"}], "isError": False}
        adapter = self._adapter_with_responses(
            _make_response(1, tool_result),
        )
        result = adapter._call_tool("mempalace_search", {"query": "test"})
        self.assertEqual(result, tool_result)

    def test_call_tool_raises_on_is_error(self) -> None:
        tool_result = {"content": [{"type": "text", "text": "palace not found"}], "isError": True}
        adapter = self._adapter_with_responses(
            _make_response(1, tool_result),
        )
        with self.assertRaises(AdapterError):
            adapter._call_tool("mempalace_search", {"query": "test"})


class AdapterHighLevelTests(unittest.TestCase):
    def _adapter_with(self, tool_result: object) -> MemPalaceAdapter:
        payload = {"content": [{"type": "text", "text": json.dumps(tool_result)}], "isError": False}
        adapter = MemPalaceAdapter(command=["echo"])
        with patch("subprocess.Popen") as mock_popen:
            # Enough lines for any single-call test
            lines = [_make_response(i, payload) for i in range(1, 10)]
            mock_popen.return_value = _mock_process(*lines)
            adapter.start()
        return adapter

    def test_search_calls_correct_tool(self) -> None:
        adapter = self._adapter_with({"results": []})
        adapter.search("some query")
        written = adapter._process.stdin.write.call_args_list
        request = json.loads(written[0][0][0].strip())
        self.assertEqual(request["params"]["name"], "mempalace_search")
        self.assertEqual(request["params"]["arguments"]["query"], "some query")

    def test_kg_query_calls_correct_tool(self) -> None:
        adapter = self._adapter_with({})
        adapter.kg_query("Lares")
        written = adapter._process.stdin.write.call_args_list
        request = json.loads(written[0][0][0].strip())
        self.assertEqual(request["params"]["name"], "mempalace_kg_query")

    def test_diary_write_calls_correct_tool(self) -> None:
        adapter = self._adapter_with({})
        adapter.diary_write("session note")
        written = adapter._process.stdin.write.call_args_list
        request = json.loads(written[0][0][0].strip())
        self.assertEqual(request["params"]["name"], "mempalace_diary_write")
        self.assertEqual(request["params"]["arguments"]["entry"], "session note")

    def test_traverse_calls_correct_tool(self) -> None:
        adapter = self._adapter_with({})
        adapter.traverse("wing-a")
        written = adapter._process.stdin.write.call_args_list
        request = json.loads(written[0][0][0].strip())
        self.assertEqual(request["params"]["name"], "mempalace_traverse")
        self.assertEqual(request["params"]["arguments"]["start"], "wing-a")

    def test_create_tunnel_passes_source_target(self) -> None:
        adapter = self._adapter_with({})
        adapter.create_tunnel("wing-a", "wing-b", label="quick-link")
        written = adapter._process.stdin.write.call_args_list
        request = json.loads(written[0][0][0].strip())
        args = request["params"]["arguments"]
        self.assertEqual(args["source"], "wing-a")
        self.assertEqual(args["target"], "wing-b")
        self.assertEqual(args["label"], "quick-link")


if __name__ == "__main__":
    unittest.main()
