#!/usr/bin/env python3
"""Clear Chapter 06 `osr:` block bodies for all cards or a named card.

Usage:
    python3 scripts/clear_ch06_osr.py check --all
    python3 scripts/clear_ch06_osr.py write --all
    python3 scripts/clear_ch06_osr.py check --name "Timestop"
    python3 scripts/clear_ch06_osr.py write --name "Timestop"

If no selector is provided, the script defaults to `--all`.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path("/home/joshu/Synthetic-Dream-Machine")
DEFAULT_CHAPTER = ROOT / "Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_06_Powers.md"
PENDING_BODY = "(pending verbatim extraction)"

CARD_RE = re.compile(r"^## (.+?)\n(.*?)(?=^## |\Z)", flags=re.S | re.M)
OSR_RE = re.compile(
    r"(osr:\n)(.*?)(\n(?:\n  <div class=\"power-return\">|<div style=\"text-align: right\">))",
    flags=re.S,
)


@dataclass(frozen=True)
class CardBlock:
    heading: str
    start: int
    end: int
    text: str


@dataclass(frozen=True)
class ClearArtifact:
    chapter_text: str
    placeholders_before: int
    placeholders_after: int
    cards_found: int
    cards_selected: int
    blocks_changed: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["check", "write"], help="Check for drift or rewrite file")
    parser.add_argument("--chapter", type=Path, default=DEFAULT_CHAPTER)

    selector = parser.add_mutually_exclusive_group()
    selector.add_argument("--all", action="store_true", help="Clear osr blocks in all cards")
    selector.add_argument("--name", help="Exact Chapter 06 card heading to clear")
    return parser.parse_args()


def parse_cards(chapter_text: str) -> list[CardBlock]:
    cards: list[CardBlock] = []
    for match in CARD_RE.finditer(chapter_text):
        cards.append(
            CardBlock(
                heading=match.group(1).strip(),
                start=match.start(),
                end=match.end(),
                text=match.group(0),
            )
        )
    return cards


def ensure_selector(args: argparse.Namespace) -> tuple[bool, str | None]:
    if args.all or args.name:
        return args.all, args.name
    return True, None


def select_cards(cards: list[CardBlock], select_all: bool, name: str | None) -> list[CardBlock]:
    if select_all:
        selected = [card for card in cards if OSR_RE.search(card.text)]
        if not selected:
            raise RuntimeError("no parseable osr: blocks found in Chapter 06 cards")
        return selected

    assert name is not None
    matching = [card for card in cards if card.heading == name]
    if not matching:
        raise RuntimeError(f'no card found for --name "{name}"')
    if len(matching) > 1:
        raise RuntimeError(f'--name "{name}" is ambiguous; multiple cards share this heading')

    card = matching[0]
    if not OSR_RE.search(card.text):
        raise RuntimeError(f'card "{name}" does not contain a parseable osr: block')
    return [card]


def clear_osr_body(card_text: str) -> tuple[str, bool]:
    match = OSR_RE.search(card_text)
    if not match:
        raise RuntimeError("osr block not found in selected card")
    old_body = match.group(2)
    changed = old_body != PENDING_BODY
    new_text = card_text[: match.start()] + match.group(1) + PENDING_BODY + match.group(3) + card_text[match.end() :]
    return new_text, changed


def build_artifact(chapter_text: str, selected_cards: list[CardBlock], cards_found: int) -> ClearArtifact:
    replacements: list[tuple[int, int, str]] = []
    changed_count = 0

    for card in selected_cards:
        new_card_text, changed = clear_osr_body(card.text)
        if changed:
            changed_count += 1
        replacements.append((card.start, card.end, new_card_text))

    replacements.sort(key=lambda item: item[0])
    pieces: list[str] = []
    cursor = 0
    for start, end, replacement in replacements:
        pieces.append(chapter_text[cursor:start])
        pieces.append(replacement)
        cursor = end
    pieces.append(chapter_text[cursor:])
    updated = "".join(pieces)

    return ClearArtifact(
        chapter_text=updated,
        placeholders_before=chapter_text.count(PENDING_BODY),
        placeholders_after=updated.count(PENDING_BODY),
        cards_found=cards_found,
        cards_selected=len(selected_cards),
        blocks_changed=changed_count,
    )


def print_summary(artifact: ClearArtifact, drift: bool) -> None:
    print(f"cards found: {artifact.cards_found}")
    print(f"cards selected: {artifact.cards_selected}")
    print(f"blocks changed: {artifact.blocks_changed}")
    print(f"pending before: {artifact.placeholders_before}")
    print(f"pending after: {artifact.placeholders_after}")
    print(f"drift: {'yes' if drift else 'no'}")


def main() -> int:
    args = parse_args()
    select_all, name = ensure_selector(args)

    try:
        chapter_text = args.chapter.read_text(encoding="utf-8")
        cards = parse_cards(chapter_text)
        selected_cards = select_cards(cards, select_all=select_all, name=name)
        artifact = build_artifact(chapter_text, selected_cards=selected_cards, cards_found=len(cards))
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    drift = artifact.chapter_text != chapter_text

    if args.mode == "write":
        args.chapter.write_text(artifact.chapter_text, encoding="utf-8")
        print_summary(artifact, drift)
        return 0

    print_summary(artifact, drift)
    return 1 if drift else 0


if __name__ == "__main__":
    raise SystemExit(main())
