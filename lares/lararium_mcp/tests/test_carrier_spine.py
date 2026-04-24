"""Smoke tests for the Lararium MCP carrier spine."""

from __future__ import annotations

import unittest

from lares.lararium_mcp import read_carrier, resolve_lar_uri
from lares.lararium_mcp.resources import list_lar_resources, read_lar_resource_or_index
from lares.lararium_mcp.server import handle_jsonrpc_message


class CarrierSpineTests(unittest.TestCase):
    def test_caps_file_roots_resolve(self) -> None:
        for uri in ("lar:///AGENTS", "lar:///LARES"):
            resolution = resolve_lar_uri(uri)
            self.assertFalse(resolution.virtual)
            self.assertTrue(resolution.exists)
            self.assertEqual(resolution.kind, "caps-file")

    def test_caps_virtual_index_root_resolves_without_disk_file(self) -> None:
        resolution = resolve_lar_uri("lar:///INDEXES/AnyCase/Child")
        self.assertTrue(resolution.virtual)
        self.assertFalse(resolution.exists)
        self.assertEqual(resolution.kind, "caps-virtual")
        self.assertEqual(resolution.child_path, ("AnyCase", "Child"))

    def test_tuple_root_resolves_to_stable_source_file(self) -> None:
        resolution = resolve_lar_uri("lar:///ha.ka.ba/api/v0.1/pono/meme")
        self.assertFalse(resolution.virtual)
        self.assertTrue(resolution.exists)
        self.assertTrue(str(resolution.path).endswith("lares/ha-ka-ba/api/v0.1/pono/meme.md"))

    def test_carrier_ingress_extracts_interface_bundle(self) -> None:
        record = read_carrier("lar:///ha.ka.ba/api/v0.1/pono/meme")
        self.assertTrue(record.shape.valid)
        self.assertEqual(record.shape.rating, "typed meme")
        self.assertIn("lar:///ha.ka.ba/api/v0.1/pono/invariant", record.implements)

    def test_virtual_indexes_materialize(self) -> None:
        resources = list_lar_resources()
        self.assertTrue(any(item.uri == "lar:///INDEXES/interfaces" for item in resources))
        interface_index = read_lar_resource_or_index("lar:///INDEXES/interfaces")
        self.assertIn("lar:///ha.ka.ba/api/v0.1/pono/meme", interface_index)

    def test_mcp_initialize(self) -> None:
        response = handle_jsonrpc_message(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-11-25",
                    "capabilities": {},
                    "clientInfo": {"name": "test", "version": "0"},
                },
            }
        )
        self.assertIsNotNone(response)
        assert response is not None
        self.assertEqual(response["result"]["protocolVersion"], "2025-11-25")
        self.assertIn("resources", response["result"]["capabilities"])
        self.assertIn("tools", response["result"]["capabilities"])

    def test_mcp_resources_list_and_read(self) -> None:
        listed = handle_jsonrpc_message({"jsonrpc": "2.0", "id": 2, "method": "resources/list"})
        self.assertIsNotNone(listed)
        assert listed is not None
        resources = listed["result"]["resources"]
        self.assertTrue(any(item["uri"] == "lar:///INDEXES/interfaces" for item in resources))

        read = handle_jsonrpc_message(
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "resources/read",
                "params": {"uri": "lar:///INDEXES/interfaces"},
            }
        )
        self.assertIsNotNone(read)
        assert read is not None
        contents = read["result"]["contents"]
        self.assertEqual(contents[0]["mimeType"], "application/json")
        self.assertIn("lar:///ha.ka.ba/api/v0.1/pono/meme", contents[0]["text"])

    def test_mcp_tools_list_and_call(self) -> None:
        listed = handle_jsonrpc_message({"jsonrpc": "2.0", "id": 4, "method": "tools/list"})
        self.assertIsNotNone(listed)
        assert listed is not None
        self.assertTrue(any(item["name"] == "lararium-resolve_lar_uri" for item in listed["result"]["tools"]))

        called = handle_jsonrpc_message(
            {
                "jsonrpc": "2.0",
                "id": 5,
                "method": "tools/call",
                "params": {
                    "name": "lararium-resolve_lar_uri",
                    "arguments": {"uri": "lar:///INDEXES/carriers"},
                },
            }
        )
        self.assertIsNotNone(called)
        assert called is not None
        self.assertFalse(called["result"]["isError"])
        self.assertIn('"virtual": true', called["result"]["content"][0]["text"])

    def test_notification_returns_no_response(self) -> None:
        response = handle_jsonrpc_message({"jsonrpc": "2.0", "method": "notifications/initialized"})
        self.assertIsNone(response)


if __name__ == "__main__":
    unittest.main()
