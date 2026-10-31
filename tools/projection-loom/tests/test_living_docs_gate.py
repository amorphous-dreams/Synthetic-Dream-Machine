"""Synthetic, CAD-independent witnesses for the o-takiage living-surface gate."""

from __future__ import annotations

import base64
import hashlib
import importlib.util
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "check_living_docs.py"
SPEC = importlib.util.spec_from_file_location("loom_live_docs_gate", SOURCE)
assert SPEC and SPEC.loader
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)


def _carrier(body: str) -> str:
    span = gate.STX + "\n" + body + "\n" + gate.ETX
    digest = base64.urlsafe_b64encode(
        hashlib.sha256(span.encode("utf-8")).digest()
    ).decode("ascii").rstrip("=")
    return (
        '<<!DOCTYPE "memetic-wikitext+tiddlywiki">>\n'
        + span
        + "ni:///sha-256;" + digest + "\n\n"
        + '<<^ code="&#x0004;" -> to="?">>\n'
    )


def test_living_fronts_refuse_recursive_markdown() -> None:
    assert gate.inspect_markdown_set(set(gate.FRONTS)) == []
    errors = gate.inspect_markdown_set(set(gate.FRONTS) | {
        "tools/projection-loom/docs/ROADMAP.md"
    })
    assert any("Unexpected tracked" in error for error in errors)
    errors = gate.inspect_markdown_set({"tools/projection-loom/README.md"})
    assert any("front missing" in error for error in errors)


def test_relative_front_links_require_real_living_files(tmp_path: Path) -> None:
    front = tmp_path / "tools" / "projection-loom" / "README.md"
    target = front.parent / "docs" / "HANDOFF.md"
    target.parent.mkdir(parents=True)
    front.write_text(
        "[Handoff](docs/HANDOFF.md) [Remote](https://github.com/x/y) "
        "[Local](#section)\n",
        encoding="utf-8",
    )
    target.write_text("# Handoff\n", encoding="utf-8")
    assert gate.inspect_markdown_links(front, tmp_path) == []
    target.unlink()
    missing = gate.inspect_markdown_links(front, tmp_path)
    assert len(missing) == 1 and "target missing" in missing[0]


def test_front_links_cannot_escape_repository(tmp_path: Path) -> None:
    front = tmp_path / "README.md"
    front.write_text("[Elsewhere](../outside.md)\n", encoding="utf-8")
    problems = gate.inspect_markdown_links(front, tmp_path)
    assert any("escapes repository" in p for p in problems)


def test_framed_ashes_validate_and_tamper_refuses(tmp_path: Path) -> None:
    carrier = tmp_path / "carrier.mem"
    carrier.write_text(_carrier("<<~ ahu #/entry>>\nLive\n<<~/ahu>>"), encoding="utf-8")
    assert gate.inspect_carrier(carrier, no_nested_ashes=True) == []
    carrier.write_text(
        carrier.read_text(encoding="utf-8").replace("Live", "Altered"),
        encoding="utf-8",
    )
    assert any("checksum" in p for p in gate.inspect_carrier(carrier))


def test_recursive_ashes_are_not_current_carrier_content(tmp_path: Path) -> None:
    carrier = tmp_path / "carrier.mem"
    carrier.write_text(_carrier("<<~ ahu #/ashes>>\nOld\n<<~/ahu>>"), encoding="utf-8")
    assert gate.inspect_carrier(carrier) == []
    problems = gate.inspect_carrier(carrier, no_nested_ashes=True)
    assert any("historical ashes" in p for p in problems)
