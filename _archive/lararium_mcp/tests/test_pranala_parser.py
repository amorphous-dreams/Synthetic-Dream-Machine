"""Tests for pranala_parser — PranaEdge extraction from carrier text."""

from __future__ import annotations

import unittest

from lares.lararium_mcp.pranala_parser import PranaEdge, parse_pranala_edges

CARRIER = "lar:///ha.ka.ba/api/v0.1/pono/e-prime"


class InlinePranalaTests(unittest.TestCase):
    def test_inline_owns(self) -> None:
        text = "<<~ pranala #owns-child ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>"
        edges = parse_pranala_edges(CARRIER, text)
        self.assertEqual(len(edges), 1)
        e = edges[0]
        self.assertEqual(e.family, "control")
        self.assertEqual(e.role, "owns")
        self.assertEqual(e.to_uri, "lar:///ha.ka.ba/api/v0.1/mu")
        self.assertEqual(e.from_uri, CARRIER)

    def test_inline_implements(self) -> None:
        text = "<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>"
        edges = parse_pranala_edges(CARRIER, text)
        self.assertEqual(len(edges), 1)
        e = edges[0]
        self.assertEqual(e.family, "control")
        self.assertEqual(e.role, "implements")

    def test_inline_relation_default_family(self) -> None:
        text = "<<~ pranala #rel ? -> lar:///ha.ka.ba/api/v0.1/pono/meme >>"
        edges = parse_pranala_edges(CARRIER, text)
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].family, "relation")
        self.assertIsNone(edges[0].role)

    def test_inline_no_fragment(self) -> None:
        text = "<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>"
        edges = parse_pranala_edges(CARRIER, text)
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].role, "owns")

    def test_multiple_inline(self) -> None:
        text = (
            "<<~ pranala #a ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>\n"
            "<<~ pranala #b ? -> lar:///ha.ka.ba/api/v0.1/pono/loci family:control role:implements >>\n"
        )
        edges = parse_pranala_edges(CARRIER, text)
        self.assertEqual(len(edges), 2)
        families = {e.family for e in edges}
        self.assertEqual(families, {"control"})


class SugarFormTests(unittest.TestCase):
    def test_loulou(self) -> None:
        text = "<<~ loulou lar:///ha.ka.ba/api/v0.1/mu >>"
        edges = parse_pranala_edges(CARRIER, text)
        self.assertEqual(len(edges), 1)
        e = edges[0]
        self.assertEqual(e.family, "relation")
        self.assertEqual(e.to_uri, "lar:///ha.ka.ba/api/v0.1/mu")
        self.assertEqual(e.propagation, "none")

    def test_aka(self) -> None:
        text = "<<~ aka lar:///ha.ka.ba/api/v0.1/pono/RFC-2119#normative-language >>"
        edges = parse_pranala_edges(CARRIER, text)
        self.assertEqual(len(edges), 1)
        e = edges[0]
        self.assertEqual(e.family, "observe")

    def test_kahea(self) -> None:
        text = "<<~ kahea lar:///ha.ka.ba/api/v0.1/mu >>"
        edges = parse_pranala_edges(CARRIER, text)
        self.assertEqual(len(edges), 1)
        e = edges[0]
        self.assertEqual(e.family, "dataflow")
        self.assertEqual(e.propagation, "push-forward")


class QuestionMarkResolutionTests(unittest.TestCase):
    def test_fragment_in_sigil_wins_over_ahu(self) -> None:
        # #owns in the sigil wins; ahu stack is irrelevant
        text = (
            "<<~ ahu #edges >>\n"
            "<<~ pranala #owns ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>\n"
            "<<~/ahu >>\n"
        )
        edges = parse_pranala_edges(CARRIER, text)
        e = next(ed for ed in edges if ed.family == "control")
        self.assertEqual(e.from_socket, CARRIER + "#owns")

    def test_question_mark_no_fragment_uses_ahu(self) -> None:
        # No #fragment → ahu stack provides the socket
        text = (
            "<<~ ahu #edges >>\n"
            "<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>\n"
            "<<~/ahu >>\n"
        )
        edges = parse_pranala_edges(CARRIER, text)
        e = next(ed for ed in edges if ed.family == "control")
        self.assertEqual(e.from_socket, CARRIER + "#edges")

    def test_question_mark_outside_ahu_falls_back_to_carrier(self) -> None:
        # No #fragment, no ahu → carrier URI root
        text = "<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>"
        edges = parse_pranala_edges(CARRIER, text)
        self.assertEqual(edges[0].from_socket, CARRIER)

    def test_nested_ahu_innermost_wins_no_fragment(self) -> None:
        text = (
            "<<~ ahu #outer >>\n"
            "<<~ ahu #inner >>\n"
            "<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>\n"
            "<<~/ahu >>\n"
            "<<~/ahu >>\n"
        )
        edges = parse_pranala_edges(CARRIER, text)
        e = edges[0]
        self.assertEqual(e.from_socket, CARRIER + "#inner")

    def test_ahu_stack_pops_correctly(self) -> None:
        text = (
            "<<~ ahu #a >>\n"
            "<<~/ahu >>\n"
            "<<~ ahu #b >>\n"
            "<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>\n"
            "<<~/ahu >>\n"
        )
        edges = parse_pranala_edges(CARRIER, text)
        self.assertEqual(edges[0].from_socket, CARRIER + "#b")


class BlockPranalaTests(unittest.TestCase):
    def test_block_with_toml(self) -> None:
        text = """\
<<~ pranala #shelf ? -> lar:///ha.ka.ba/docs/crystal >>
```toml
family = "relation"
lifecycle = "template"
label = "source shelf"
payload = { priority = "support" }
```
<<~/pranala >>
"""
        edges = parse_pranala_edges(CARRIER, text)
        self.assertEqual(len(edges), 1)
        e = edges[0]
        self.assertEqual(e.family, "relation")
        self.assertEqual(e.lifecycle, "template")
        self.assertEqual(e.label, "source shelf")
        self.assertEqual(e.to_uri, "lar:///ha.ka.ba/docs/crystal")

    def test_block_does_not_also_produce_inline_match(self) -> None:
        # The opening line of a block pranala should not produce a second inline edge
        text = """\
<<~ pranala #shelf ? -> lar:///ha.ka.ba/docs/crystal >>
```toml
family = "relation"
```
<<~/pranala >>
"""
        edges = parse_pranala_edges(CARRIER, text)
        self.assertEqual(len(edges), 1)


class LiveCarrierTests(unittest.TestCase):
    """Parse actual carrier files and assert key edges are extracted."""

    def _parse(self, file_path: str, carrier_uri: str) -> list[PranaEdge]:
        from pathlib import Path
        text = Path(file_path).read_text(encoding="utf-8")
        return parse_pranala_edges(carrier_uri, text)

    def test_agents_has_control_owns_edges(self) -> None:
        edges = self._parse(
            "lares/AGENTS.md",
            "lar:///AGENTS",
        )
        control_owns = [e for e in edges if e.family == "control" and e.role == "owns"]
        targets = {e.to_uri for e in control_owns}
        self.assertIn("lar:///ha.ka.ba/api/v0.1/mu", targets)
        self.assertIn("lar:///ha.ka.ba/api/v0.1/lararium", targets)
        self.assertIn("lar:///LARES", targets)

    def test_mu_has_control_owns_to_children(self) -> None:
        edges = self._parse(
            "lares/ha-ka-ba/api/v0.1/mu.md",
            "lar:///ha.ka.ba/api/v0.1/mu",
        )
        owns_targets = {e.to_uri for e in edges if e.family == "control" and e.role == "owns"}
        self.assertIn("lar:///ha.ka.ba/api/v0.1/mu/chao", owns_targets)
        self.assertIn("lar:///ha.ka.ba/api/v0.1/mu/the-four-tools", owns_targets)

    def test_mu_children_have_implements_edges(self) -> None:
        edges = self._parse(
            "lares/ha-ka-ba/api/v0.1/mu/chao.md",
            "lar:///ha.ka.ba/api/v0.1/mu/chao",
        )
        impl_targets = {e.to_uri for e in edges if e.role == "implements"}
        self.assertIn("lar:///ha.ka.ba/api/v0.1/pono/meme", impl_targets)


if __name__ == "__main__":
    unittest.main()
