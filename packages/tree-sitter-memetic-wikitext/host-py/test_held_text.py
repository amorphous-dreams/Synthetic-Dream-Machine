"""A carrier that HOLDS a text whole gives the text back byte for byte.

A text another grammar reads — a pre-ruling specimen, a measured corpus — rides inside one typed
ahu, fenced by a backtick run longer than any the text carries, so no wikitext law reads inside it.
`held` hands back exactly what went in; a text holding no such ahu reads as itself.
"""
from __future__ import annotations

import os

import held_text as ht

_HERE = os.path.dirname(os.path.abspath(__file__))
_SPECIMEN_DIR = os.path.normpath(os.path.join(_HERE, "..", "fixtures", "specimens"))

_TEXT = (
    "<<^ &#x0001; ? -> lar:///x/y>>\n"
    "```toml iam\n"
    'type = "text/x-memetic-wikitext"\n'
    "```\n"
    "\n"
    "<<~ ahu #a>>\n"
    "body\n"
    "<<~/ahu>>\n"
    "\n"
    "<<^ &#x0003;>>\n"
)


def test_a_held_text_comes_back_byte_for_byte():
    carrier = ht.hold(_TEXT, uri="x/y", file_path="x/y.mem", role="a probe", held_type="text/x-memetic-wikitext")
    assert ht.held(carrier) == _TEXT


def test_the_holder_declares_the_held_type():
    carrier = ht.hold(_TEXT, uri="x/y", file_path="x/y.mem", role="a probe", held_type="text/x-memetic-wikitext")
    assert ht.held_type(carrier) == "text/x-memetic-wikitext"


def test_the_fence_outgrows_every_backtick_run_the_text_carries():
    text = "````\nfour\n````\n"
    carrier = ht.hold(text, uri="x/y", file_path="x/y.mem", role="a probe", held_type="text/markdown")
    assert "\n`````\n" in carrier
    assert ht.held(carrier) == text


def test_a_text_holding_nothing_reads_as_itself():
    """CONTROL: a reader that unwrapped every file would hand a plain one back altered."""
    assert ht.held(_TEXT) == _TEXT
    assert ht.held_type(_TEXT) is None


def test_every_wild_specimen_holds_its_text():
    """The wild specimens are carriers holding a pre-ruling meme; what they hold opens on its own SOH."""
    for name in sorted(os.listdir(_SPECIMEN_DIR)):
        if not name.startswith("wild-"):
            continue
        with open(os.path.join(_SPECIMEN_DIR, name), encoding="utf-8") as fh:
            carrier = fh.read()
        assert ht.held_type(carrier) == "text/x-memetic-wikitext", name
        assert ht.held(carrier).startswith("<<^ &#x0001; ? -> lar:///"), name
