"""Tests for the Lararium MCP prompts surface."""

from __future__ import annotations

import unittest

from lares.lararium_mcp.prompts import get_prompt, list_prompts
from lares.lararium_mcp.server import handle_jsonrpc_message


class PromptCatalogTests(unittest.TestCase):
    def test_catalog_non_empty(self) -> None:
        prompts = list_prompts()
        self.assertGreater(len(prompts), 0)

    def test_catalog_names_are_namespaced(self) -> None:
        for p in list_prompts():
            self.assertTrue(p["name"].startswith("lararium-"), p["name"])

    def test_all_prompts_have_description(self) -> None:
        for p in list_prompts():
            self.assertIn("description", p)
            self.assertTrue(p["description"])

    def test_resolve_uri_declares_required_argument(self) -> None:
        catalog = {p["name"]: p for p in list_prompts()}
        resolve = catalog["lararium-resolve_uri"]
        args = resolve["arguments"]
        self.assertTrue(any(a["name"] == "uri" and a["required"] for a in args))

    def test_read_carrier_declares_required_argument(self) -> None:
        catalog = {p["name"]: p for p in list_prompts()}
        read = catalog["lararium-read_carrier"]
        args = read["arguments"]
        self.assertTrue(any(a["name"] == "uri" and a["required"] for a in args))


class PromptGetTests(unittest.TestCase):
    def _assert_message_shape(self, result: dict) -> None:
        self.assertIn("messages", result)
        self.assertGreater(len(result["messages"]), 0)
        msg = result["messages"][0]
        self.assertEqual(msg["role"], "user")
        self.assertIn("type", msg["content"])
        self.assertIn("text", msg["content"])
        self.assertTrue(msg["content"]["text"])

    def test_boot_minimal_returns_messages(self) -> None:
        result = get_prompt("lararium-boot_minimal")
        self._assert_message_shape(result)
        self.assertIn("lar:///AGENTS", result["messages"][0]["content"]["text"])

    def test_hydrate_full_returns_messages(self) -> None:
        result = get_prompt("lararium-hydrate_full")
        self._assert_message_shape(result)
        self.assertIn("full boot", result["messages"][0]["content"]["text"].lower())

    def test_boot_receipt_returns_sha256(self) -> None:
        result = get_prompt("lararium-boot_receipt")
        self._assert_message_shape(result)
        self.assertIn("sha256", result["messages"][0]["content"]["text"])

    def test_resolve_uri_requires_argument(self) -> None:
        with self.assertRaises(ValueError):
            get_prompt("lararium-resolve_uri", {})

    def test_resolve_uri_with_agents(self) -> None:
        result = get_prompt("lararium-resolve_uri", {"uri": "lar:///AGENTS"})
        self._assert_message_shape(result)
        text = result["messages"][0]["content"]["text"]
        self.assertIn("lar:///AGENTS", text)
        self.assertIn("caps-file", text)

    def test_read_carrier_requires_argument(self) -> None:
        with self.assertRaises(ValueError):
            get_prompt("lararium-read_carrier", {})

    def test_read_carrier_with_agents(self) -> None:
        result = get_prompt("lararium-read_carrier", {"uri": "lar:///AGENTS"})
        self._assert_message_shape(result)
        self.assertIn("AGENTS", result["messages"][0]["content"]["text"])

    def test_compare_hydration_shows_counts(self) -> None:
        result = get_prompt("lararium-compare_hydration")
        self._assert_message_shape(result)
        text = result["messages"][0]["content"]["text"]
        self.assertIn("minimal_locus_count", text)
        self.assertIn("additional_loci_count", text)

    def test_unknown_prompt_raises_key_error(self) -> None:
        with self.assertRaises(KeyError):
            get_prompt("lararium-does_not_exist")


class PromptsMCPTests(unittest.TestCase):
    def _req(self, method: str, params: dict | None = None) -> dict:
        msg: dict = {"jsonrpc": "2.0", "id": 1, "method": method}
        if params:
            msg["params"] = params
        response = handle_jsonrpc_message(msg)
        assert response is not None
        return response

    def test_initialize_declares_prompts_capability(self) -> None:
        response = self._req("initialize", {
            "protocolVersion": "2025-11-25",
            "capabilities": {},
            "clientInfo": {"name": "test", "version": "0"},
        })
        caps = response["result"]["capabilities"]
        self.assertIn("prompts", caps)

    def test_prompts_list_via_jsonrpc(self) -> None:
        response = self._req("prompts/list")
        prompts = response["result"]["prompts"]
        names = {p["name"] for p in prompts}
        self.assertIn("lararium-boot_minimal", names)
        self.assertIn("lararium-hydrate_full", names)
        self.assertIn("lararium-boot_receipt", names)
        self.assertIn("lararium-resolve_uri", names)
        self.assertIn("lararium-read_carrier", names)
        self.assertIn("lararium-compare_hydration", names)

    def test_prompts_get_boot_minimal_via_jsonrpc(self) -> None:
        response = self._req("prompts/get", {"name": "lararium-boot_minimal", "arguments": {}})
        self.assertNotIn("error", response)
        msgs = response["result"]["messages"]
        self.assertTrue(msgs)
        self.assertIn("lar:///AGENTS", msgs[0]["content"]["text"])

    def test_prompts_get_resolve_uri_via_jsonrpc(self) -> None:
        response = self._req("prompts/get", {
            "name": "lararium-resolve_uri",
            "arguments": {"uri": "lar:///LARES"},
        })
        self.assertNotIn("error", response)
        text = response["result"]["messages"][0]["content"]["text"]
        self.assertIn("lar:///LARES", text)

    def test_prompts_get_missing_argument_returns_error(self) -> None:
        response = self._req("prompts/get", {
            "name": "lararium-resolve_uri",
            "arguments": {},
        })
        self.assertIn("error", response)

    def test_prompts_get_unknown_name_returns_error(self) -> None:
        response = self._req("prompts/get", {"name": "lararium-no_such", "arguments": {}})
        self.assertIn("error", response)


if __name__ == "__main__":
    unittest.main()
