"""Smoke tests for the Lararium MCP carrier spine."""

from __future__ import annotations

import unittest

from lares.lararium_mcp import read_carrier, resolve_lar_uri
from lares.lararium_mcp.resources import list_lar_resources, read_lar_resource_or_index


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


if __name__ == "__main__":
    unittest.main()
