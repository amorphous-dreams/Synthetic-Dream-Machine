"""Tests for the Lararium hydration closure compiler."""

from __future__ import annotations

import json
import unittest

from lares.lararium_mcp.compiler import (
    ENTRY_URI,
    compile_boot_receipt,
    compile_full_boot,
    compile_minimal_boot,
)
from lares.lararium_mcp.server import handle_jsonrpc_message


class MinimalBootTests(unittest.TestCase):
    def setUp(self) -> None:
        self.artifact = compile_minimal_boot()

    def test_artifact_label(self) -> None:
        self.assertEqual(self.artifact["artifact"], "minimal-boot")

    def test_entry_uri(self) -> None:
        self.assertEqual(self.artifact["entry"], ENTRY_URI)

    def test_required_core_count(self) -> None:
        self.assertEqual(self.artifact["locus_count"], 14)
        self.assertEqual(len(self.artifact["closure"]), 14)

    def test_agents_is_first_and_depth_zero(self) -> None:
        first = self.artifact["closure"][0]
        self.assertEqual(first["uri"], ENTRY_URI)
        self.assertEqual(first["depth"], 0)

    def test_all_loci_exist(self) -> None:
        missing = self.artifact["validation"]["missing"]
        self.assertEqual(missing, [], f"missing loci: {missing}")

    def test_all_resolved(self) -> None:
        self.assertTrue(self.artifact["validation"]["all_resolved"])
        self.assertTrue(self.artifact["validation"]["all_exist"])

    def test_lares_present(self) -> None:
        uris = [e["uri"] for e in self.artifact["closure"]]
        self.assertIn("lar:///LARES", uris)

    def test_hydration_sockets_annotated(self) -> None:
        sockets = {e["uri"]: e["hydration_socket"] for e in self.artifact["closure"]}
        self.assertEqual(sockets[ENTRY_URI], "entry")
        self.assertEqual(sockets["lar:///ha.ka.ba/api/v0.1/pono/e-prime"], "AGENTS#preload-e-prime")
        self.assertEqual(sockets["lar:///ha.ka.ba/api/v0.1/mu"], "AGENTS#threshold-to-mu")
        self.assertEqual(sockets["lar:///LARES"], "AGENTS#continue-to-lares")

    def test_implements_bundles_present(self) -> None:
        agents_entry = next(e for e in self.artifact["closure"] if e["uri"] == ENTRY_URI)
        self.assertIsInstance(agents_entry["implements"], list)
        self.assertTrue(len(agents_entry["implements"]) > 0)

    def test_compiled_at_present(self) -> None:
        self.assertIn("T", self.artifact["compiled_at"])


class FullBootTests(unittest.TestCase):
    def setUp(self) -> None:
        self.artifact = compile_full_boot()

    def test_artifact_label(self) -> None:
        self.assertEqual(self.artifact["artifact"], "full-boot")

    def test_full_boot_superset_of_minimal(self) -> None:
        minimal = compile_minimal_boot()
        minimal_uris = {e["uri"] for e in minimal["closure"]}
        full_uris = {e["uri"] for e in self.artifact["closure"]}
        self.assertTrue(minimal_uris.issubset(full_uris), "full boot must include all required-core loci")

    def test_full_boot_larger_than_minimal(self) -> None:
        minimal = compile_minimal_boot()
        self.assertGreater(self.artifact["locus_count"], minimal["locus_count"])

    def test_no_duplicate_uris(self) -> None:
        uris = [e["uri"] for e in self.artifact["closure"]]
        self.assertEqual(len(uris), len(set(uris)))

    def test_compiler_note_present(self) -> None:
        self.assertIn("compiler_note", self.artifact)


class BootReceiptTests(unittest.TestCase):
    def setUp(self) -> None:
        self.minimal = compile_minimal_boot()
        self.receipt = compile_boot_receipt(self.minimal)

    def test_artifact_label(self) -> None:
        self.assertEqual(self.receipt["artifact"], "boot-receipt")

    def test_sha256_present_and_hex(self) -> None:
        sha = self.receipt["sha256"]
        self.assertEqual(len(sha), 64)
        int(sha, 16)  # raises if not hex

    def test_receipt_is_deterministic(self) -> None:
        r1 = compile_boot_receipt(self.minimal)
        r2 = compile_boot_receipt(self.minimal)
        self.assertEqual(r1["sha256"], r2["sha256"])

    def test_locus_count_matches_minimal(self) -> None:
        self.assertEqual(self.receipt["locus_count"], self.minimal["locus_count"])

    def test_validation_propagated(self) -> None:
        self.assertTrue(self.receipt["validation"]["all_exist"])


class CompilerMCPToolTests(unittest.TestCase):
    def _call_tool(self, name: str, arguments: dict | None = None) -> dict:
        response = handle_jsonrpc_message({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments or {}},
        })
        assert response is not None
        return response

    def test_compile_minimal_boot_tool(self) -> None:
        response = self._call_tool("lararium-compile_minimal_boot")
        self.assertFalse(response["result"]["isError"])
        data = json.loads(response["result"]["content"][0]["text"])
        self.assertEqual(data["artifact"], "minimal-boot")
        self.assertEqual(data["locus_count"], 14)

    def test_compile_full_boot_tool(self) -> None:
        response = self._call_tool("lararium-compile_full_boot")
        self.assertFalse(response["result"]["isError"])
        data = json.loads(response["result"]["content"][0]["text"])
        self.assertEqual(data["artifact"], "full-boot")
        self.assertGreater(data["locus_count"], 14)

    def test_compile_boot_receipt_tool(self) -> None:
        response = self._call_tool("lararium-compile_boot_receipt")
        self.assertFalse(response["result"]["isError"])
        data = json.loads(response["result"]["content"][0]["text"])
        self.assertEqual(data["artifact"], "boot-receipt")
        self.assertEqual(len(data["sha256"]), 64)

    def test_compiler_tools_listed(self) -> None:
        response = handle_jsonrpc_message({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        assert response is not None
        names = {t["name"] for t in response["result"]["tools"]}
        self.assertIn("lararium-compile_minimal_boot", names)
        self.assertIn("lararium-compile_full_boot", names)
        self.assertIn("lararium-compile_boot_receipt", names)

    def test_boot_resources_listed(self) -> None:
        response = handle_jsonrpc_message({"jsonrpc": "2.0", "id": 3, "method": "resources/list"})
        assert response is not None
        uris = {r["uri"] for r in response["result"]["resources"]}
        self.assertIn("lar:///boot/minimal", uris)
        self.assertIn("lar:///boot/full", uris)
        self.assertIn("lar:///boot/receipt", uris)

    def test_boot_minimal_resource_readable(self) -> None:
        response = handle_jsonrpc_message({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "resources/read",
            "params": {"uri": "lar:///boot/minimal"},
        })
        assert response is not None
        contents = response["result"]["contents"]
        self.assertEqual(contents[0]["mimeType"], "application/json")
        data = json.loads(contents[0]["text"])
        self.assertEqual(data["artifact"], "minimal-boot")


if __name__ == "__main__":
    unittest.main()
