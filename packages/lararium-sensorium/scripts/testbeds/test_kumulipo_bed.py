"""Tests — the Kumulipo bed reads the text its fixture carriers HOLD, never the carrier around it.

Each fixture stands as a canonical carrier holding one text whole (`held_text`). The bed's lines, its
wā markers and its hinge all index that held text, so the measurement reads exactly the bytes the
controls were generated as.
"""
from __future__ import annotations

import os

import kumulipo_bed as kb
from kumulipo_sections import held, held_type

_FIX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fixtures", "shuffled-kumulipo")


def _carrier(name: str) -> str:
    with open(os.path.join(_FIX, name), encoding="utf-8") as fh:
        return fh.read()


def test_the_fixtures_are_carriers_holding_a_text():
    """CONTROL: the file itself opens on the declaration, so a bed reading the file whole would
    measure lines the controls never held."""
    for name in ("kumulipo-beckwith.mem", "kumulipo-liliuokalani.mem"):
        carrier = _carrier(name)
        assert carrier.startswith("<<!DOCTYPE ")
        assert held_type(carrier) == "text/x-memetic-wikitext"
        assert held(carrier) != carrier


def test_each_bed_reads_the_held_text_line_for_line():
    for bed, name in (("beckwith", "kumulipo-beckwith.mem"), ("liliuokalani", "kumulipo-liliuokalani.mem")):
        assert kb.bed_text(bed) == held(_carrier(name)).splitlines()


def test_the_ground_truth_indexes_the_held_text():
    """The numbers the scorer reads, pinned: sixteen wā in every bed, the hinge where the held text puts it."""
    beck = kb.ground_truth("beckwith")
    lili = kb.ground_truth("liliuokalani")
    assert (beck["n_lines"], beck["n_wa"], beck["hinge"]) == (11748, 16, 5651)
    assert (lili["n_lines"], lili["n_wa"], lili["hinge"]) == (4125, 16, 1076)
