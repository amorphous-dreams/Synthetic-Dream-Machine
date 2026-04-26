"""Tests for MemeGraph — walk, sort, cycle detection, hash."""

from __future__ import annotations

import unittest

from lares.lararium_mcp.meme_graph import DeclaredUnresolved, Meme, MemeGraph
from lares.lararium_mcp.pranala_parser import PranaEdge


def _make_meme(uri: str, control_targets: list[str] | None = None) -> Meme:
    edges = [
        PranaEdge(
            from_uri=uri, from_socket=uri,
            to_uri=t, to_socket='',
            family='control', role='owns',
        )
        for t in (control_targets or [])
    ]
    return Meme(
        uri=uri, path=None,
        content_hash=Meme.make_hash(uri, None),
        metadata={}, edges_out=edges,
        virtual=True, exists=False,
    )


def _simple_graph() -> MemeGraph:
    """A → B → C; A → D"""
    g = MemeGraph()
    g.add_meme(_make_meme("lar:///A", ["lar:///B", "lar:///D"]))
    g.add_meme(_make_meme("lar:///B", ["lar:///C"]))
    g.add_meme(_make_meme("lar:///C"))
    g.add_meme(_make_meme("lar:///D"))
    return g


class SuccessorsTests(unittest.TestCase):
    def test_successors_by_family(self) -> None:
        g = _simple_graph()
        succs = g.successors("lar:///A", "control")
        self.assertIn("lar:///B", succs)
        self.assertIn("lar:///D", succs)

    def test_successors_empty_for_leaf(self) -> None:
        g = _simple_graph()
        self.assertEqual(g.successors("lar:///C", "control"), [])

    def test_successors_unknown_family(self) -> None:
        g = _simple_graph()
        self.assertEqual(g.successors("lar:///A", "relation"), [])


class TopologicalSortTests(unittest.TestCase):
    def test_kahn_sort_sources_before_targets(self) -> None:
        g = _simple_graph()
        kahn = g.topological_sort({"lar:///A", "lar:///B", "lar:///C", "lar:///D"})
        idx = {u: i for i, u in enumerate(kahn)}
        self.assertLess(idx["lar:///A"], idx["lar:///B"])
        self.assertLess(idx["lar:///B"], idx["lar:///C"])

    def test_restricted_to_uri_set(self) -> None:
        g = _simple_graph()
        result = g.topological_sort({"lar:///A", "lar:///B"})
        self.assertNotIn("lar:///C", result)
        self.assertNotIn("lar:///D", result)


class OneHopRelationTests(unittest.TestCase):
    def test_one_hop_relation(self) -> None:
        g = MemeGraph()
        rel_edge = PranaEdge(
            from_uri="lar:///A", from_socket="lar:///A",
            to_uri="lar:///Neighbor", to_socket='',
            family='relation',
        )
        a = Meme(
            uri="lar:///A", path=None,
            content_hash=Meme.make_hash("lar:///A", None),
            metadata={}, edges_out=[rel_edge],
            virtual=True, exists=False,
        )
        g.add_meme(a)
        additional = g.one_hop_relation(["lar:///A"])
        self.assertIn("lar:///Neighbor", additional)

    def test_already_in_control_set_not_added(self) -> None:
        g = _simple_graph()
        # D is already in control closure; it shouldn't appear in relation expansion
        rel_edge = PranaEdge(
            from_uri="lar:///A", from_socket="lar:///A",
            to_uri="lar:///D", to_socket='',
            family='relation',
        )
        a = Meme(
            uri="lar:///A", path=None,
            content_hash=Meme.make_hash("lar:///A", None),
            metadata={}, edges_out=[rel_edge],
            virtual=True, exists=False,
        )
        g.add_meme(a)
        additional = g.one_hop_relation({"lar:///A", "lar:///B", "lar:///C", "lar:///D"})
        self.assertNotIn("lar:///D", additional)


class MemeImplementsPropertyTests(unittest.TestCase):
    def test_implements_derived_from_edges_out(self) -> None:
        impl_edge = PranaEdge(
            from_uri="lar:///Carrier", from_socket="lar:///Carrier",
            to_uri="lar:///ha.ka.ba/api/v0.1/pono/meme", to_socket='',
            family='control', role='implements',
        )
        owns_edge = PranaEdge(
            from_uri="lar:///Carrier", from_socket="lar:///Carrier",
            to_uri="lar:///ha.ka.ba/api/v0.1/pono/loci", to_socket='',
            family='control', role='owns',
        )
        meme = Meme(
            uri="lar:///Carrier", path=None,
            content_hash=Meme.make_hash("lar:///Carrier", None),
            metadata={}, edges_out=[impl_edge, owns_edge],
            virtual=True, exists=False,
        )
        self.assertIn("lar:///ha.ka.ba/api/v0.1/pono/meme", meme.implements)
        self.assertNotIn("lar:///ha.ka.ba/api/v0.1/pono/loci", meme.implements)

    def test_no_metadata_implements_field_needed(self) -> None:
        meme = _make_meme("lar:///X")
        self.assertEqual(meme.implements, ())


class DeclaredUnresolvedTests(unittest.TestCase):
    def test_control_edge_is_error(self) -> None:
        edge = PranaEdge(
            from_uri="lar:///A", from_socket="lar:///A",
            to_uri="lar:///Missing", to_socket='',
            family='control', role='owns',
        )
        du = DeclaredUnresolved.from_edge(edge)
        self.assertEqual(du.severity, 'error')

    def test_relation_edge_is_warning(self) -> None:
        edge = PranaEdge(
            from_uri="lar:///A", from_socket="lar:///A",
            to_uri="lar:///Missing", to_socket='',
            family='relation',
        )
        du = DeclaredUnresolved.from_edge(edge)
        self.assertEqual(du.severity, 'warning')

    def test_graph_reports_unresolved(self) -> None:
        g = MemeGraph()
        edge = PranaEdge(
            from_uri="lar:///A", from_socket="lar:///A",
            to_uri="lar:///NotLoaded", to_socket='',
            family='control', role='owns',
        )
        a = Meme(
            uri="lar:///A", path=None,
            content_hash=Meme.make_hash("lar:///A", None),
            metadata={}, edges_out=[edge],
            virtual=True, exists=False,
        )
        g.add_meme(a)
        unresolved = g.declared_unresolved()
        self.assertEqual(len(unresolved), 1)
        self.assertEqual(unresolved[0].uri, "lar:///NotLoaded")


class ClosureHashTests(unittest.TestCase):
    def test_hash_is_stable(self) -> None:
        g = _simple_graph()
        uris = g.topological_sort({"lar:///A", "lar:///B", "lar:///C", "lar:///D"})
        h1 = g.closure_hash(uris, [])
        h2 = g.closure_hash(uris, [])
        self.assertEqual(h1, h2)

    def test_hash_changes_when_meme_added(self) -> None:
        g1 = _simple_graph()
        g2 = _simple_graph()
        g2.add_meme(_make_meme("lar:///Extra"))
        uris1 = g1.topological_sort({"lar:///A", "lar:///B", "lar:///C", "lar:///D"})
        uris2 = uris1 + ["lar:///Extra"]
        h1 = g1.closure_hash(uris1, [])
        h2 = g2.closure_hash(uris2, [])
        self.assertNotEqual(h1, h2)


if __name__ == "__main__":
    unittest.main()
