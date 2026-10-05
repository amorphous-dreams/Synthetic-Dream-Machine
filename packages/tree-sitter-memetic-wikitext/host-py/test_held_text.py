"""A carrier that HOLDS a text whole gives the text back byte for byte.

A text another grammar reads — a pre-ruling specimen, a measured corpus — rides inside one typed
ahu, fenced by a backtick run longer than any the text carries, so no wikitext law reads inside it.
`held` hands back exactly what went in; a text holding no such ahu reads as itself.
"""
from __future__ import annotations

import os
import shutil
import subprocess

import pytest

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


def test_hold_opens_the_root_meta_inside_stx_not_above_it():
    """The canonical writer (`@lararium/memetic-frame` `frameCarrier`) puts STX right after the head
    and bounds ALL root metadata inside STX..ETX. `hold()` matches that order: DOCTYPE, SOH head,
    STX, root toml meta, the holding ahu, ETX, EOT — never a `toml meta` block between the head
    (SOH, code 0001) and STX (code 0002), which reads as the `meta-before-stx` torn fault."""
    carrier = ht.hold(_TEXT, uri="x/y", file_path="x/y.mem", role="a probe", held_type="text/x-memetic-wikitext")
    lines = carrier.split("\n")

    def _idx(predicate):
        return next(i for i, ln in enumerate(lines) if predicate(ln))

    doctype = _idx(lambda ln: ln.startswith("<<!DOCTYPE"))
    soh = _idx(lambda ln: ln.startswith('<<^ code="&#x0001;"'))
    stx = _idx(lambda ln: ln == '<<^ code="&#x0002;">>')
    meta = _idx(lambda ln: ln == "```toml meta")
    ahu = _idx(lambda ln: ln == "<<~ ahu #/held>>")
    etx = _idx(lambda ln: ln.startswith('<<^ code="&#x0003;"'))
    eot = _idx(lambda ln: ln.startswith('<<^ code="&#x0004;"'))

    assert doctype < soh < stx < meta < ahu < etx < eot
    # STX stands immediately after the head — no root meta rides between them.
    assert lines[soh + 1] == '<<^ code="&#x0002;">>'


def test_hold_leaves_the_check_unminted_for_normalize_to_stamp():
    """`hold()` mints no block check of its own; `lares meme normalize` is the one door every
    carrier's check passes through (per the writer's own docstring)."""
    carrier = ht.hold(_TEXT, uri="x/y", file_path="x/y.mem", role="a probe", held_type="text/x-memetic-wikitext")
    assert "ni:///sha-256;" not in carrier


@pytest.mark.skipif(shutil.which("lares") is None, reason="the lares CLI frame-checks the carrier")
def test_hold_output_reads_canonical_through_the_ts_frame_reader(tmp_path):
    """A cross-language weld: a carrier `hold()` writes, once `lares meme normalize` stamps its
    check, must read canonical (not torn) through the TS frame checker — the same reader that
    refused the pre-heal, meta-before-STX bytes."""
    carrier = ht.hold(_TEXT, uri="x/y", file_path="x/y.mem", role="a probe", held_type="text/x-memetic-wikitext")
    path = tmp_path / "probe.mem"
    path.write_text(carrier, encoding="utf-8")
    subprocess.run(["lares", "meme", "normalize", str(path)], check=True, stdout=subprocess.DEVNULL)
    result = subprocess.run(["lares", "meme", "check", str(path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "torn" not in (result.stdout + result.stderr)


def test_every_wild_specimen_holds_its_text():
    """The wild specimens are carriers holding a pre-ruling meme; what they hold opens on its own SOH."""
    for name in sorted(os.listdir(_SPECIMEN_DIR)):
        if not name.startswith("wild-"):
            continue
        with open(os.path.join(_SPECIMEN_DIR, name), encoding="utf-8") as fh:
            carrier = fh.read()
        assert ht.held_type(carrier) == "text/x-memetic-wikitext", name
        assert ht.held(carrier).startswith("<<^ &#x0001; ? -> lar:///"), name
