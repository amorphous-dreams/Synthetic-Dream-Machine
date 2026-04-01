#!/usr/bin/env python3
"""Clear Chapter 06 `osr:` block bodies and/or power text bodies for all cards or a named card.

Usage:
    python3 scripts/clear_ch06_osr.py check --all
    python3 scripts/clear_ch06_osr.py write --all --clear-osr
    python3 scripts/clear_ch06_osr.py write --all --clear-bodies
    python3 scripts/clear_ch06_osr.py write --all --clear-osr --clear-bodies
    python3 scripts/clear_ch06_osr.py check --name "Timestop" --clear-osr
    python3 scripts/clear_ch06_osr.py write --name "Timestop" --clear-bodies

Flags:
    --clear-osr        Clear osr: block bodies (default: no clearing unless specified)
    --clear-bodies     Clear power text bodies and insert '> {pending conversion}' stub
    --update-crosswalk Update crosswalk 'osr: imported' column when clearing osr blocks
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path("/home/joshu/Synthetic-Dream-Machine")
DEFAULT_CHAPTER = ROOT / "Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_06_Powers_and_ECM.md"
DEFAULT_CROSSWALK = ROOT / "_todo/TODO_BECMI_Spell_Effect_Crosswalk.md"
PENDING_OSR_BODY = "{pending verbatim extraction}"
PENDING_POWER_BODY = "> {pending conversion}"

CARD_RE = re.compile(r"^## (.+?)\n(.*?)(?=^## |\Z)", flags=re.S | re.M)
OSR_RE = re.compile(
    r"(osr:\n)(.*?)(\n(?:\n  <div class=\"power-return\">|<div style=\"text-align: right\">))",
    flags=re.S,
)
# Power body: heading + quoted section up to tags:
# Groups: (1) heading line (2) spell name quote line (3) blank quote line (4) all description (5) tags: line
POWER_BODY_RE = re.compile(
    r"(^## .+?\n)(\n)(> \*\*.*?\*\*\n)(>\n)((?:>.*?\n)*?)(tags:)",
    flags=re.S | re.M,
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
    placeholders_osr_before: int
    placeholders_osr_after: int
    placeholders_body_before: int
    placeholders_body_after: int
    cards_found: int
    cards_selected: int
    osr_blocks_changed: int
    power_bodies_changed: int
    crosswalk_rows_updated: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["check", "write"], help="Check for drift or rewrite file")
    parser.add_argument("--chapter", type=Path, default=DEFAULT_CHAPTER)
    parser.add_argument("--crosswalk", type=Path, default=DEFAULT_CROSSWALK)
    parser.add_argument("--clear-osr", action="store_true", help="Clear osr: block bodies")
    parser.add_argument("--clear-bodies", action="store_true", help="Clear power text bodies and insert stub")
    parser.add_argument("--update-crosswalk", action="store_true", help="Update crosswalk osr: imported column")

    selector = parser.add_mutually_exclusive_group()
    selector.add_argument("--all", action="store_true", help="Clear blocks in all cards")
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


def update_crosswalk_row(crosswalk_path: Path, card_heading: str) -> bool:
    """Update the osr: imported column for the matching spell row. Returns True if updated."""
    if not crosswalk_path.exists():
        return False
    
    crosswalk_text = crosswalk_path.read_text(encoding="utf-8")
    
    # Find Phase 1 Catalog table rows with pipe-delimited format
    # Pattern: | Classic Name | Class/Level | ... | osr: imported |
    # We match lines starting with | and containing the card heading as first column
    
    lines = crosswalk_text.split("\n")
    updated = False
    
    for i, line in enumerate(lines):
        # Phase 1 Catalog rows start with "| "
        if line.startswith("|") and "| yes |" in line or "| [needs-review] |" in line or "| - |" in line:
            # Parse pipe-delimited columns
            cols = [col.strip() for col in line.split("|")]
            # First column (index 1) is the spell name
            if len(cols) >= 8 and cols[1] == card_heading:
                # Last column (index -2, before trailing |) is osr: imported
                # Replace with -
                cols[-2] = "-"
                lines[i] = "|" + "|".join(cols) + "|"
                updated = True
                break
    
    if updated:
        crosswalk_path.write_text("\n".join(lines), encoding="utf-8")
    
    return updated


def clear_osr_body(card_text: str) -> tuple[str, bool]:
    match = OSR_RE.search(card_text)
    if not match:
        raise RuntimeError("osr block not found in selected card")
    old_body = match.group(2)
    changed = old_body != PENDING_OSR_BODY
    new_text = card_text[: match.start()] + match.group(1) + PENDING_OSR_BODY + match.group(3) + card_text[match.end() :]
    return new_text, changed


def clear_power_body(card_text: str) -> tuple[str, bool]:
    """Clear the power text body and replace with pending stub.
    
    Preserves: heading line, spell name (bold), blank quote line.
    Replaces: all description content with pending stub.
    """
    match = POWER_BODY_RE.search(card_text)
    if not match:
        # No power body found or card structure doesn't match pattern
        return card_text, False
    
    heading_line = match.group(1)          # "## Spell Name\n"
    blank_after_heading = match.group(2)   # "\n"
    spell_name_quote = match.group(3)      # "> **Spell Name**\n"
    blank_quote_line = match.group(4)      # ">\n"
    description_content = match.group(5)   # all the description lines
    tags_line = match.group(6)             # "tags:"
    
    # Check if already cleared (only has pending stub)
    changed = description_content.strip() != PENDING_POWER_BODY.strip()
    
    if changed:
        # Rebuild: heading + blanks + spell name + blank quote + pending stub + blank + tags
        new_body = (
            heading_line
            + blank_after_heading
            + spell_name_quote
            + blank_quote_line
            + PENDING_POWER_BODY + "\n"
            + "\n"
            + tags_line
        )
        new_text = card_text[: match.start()] + new_body + card_text[match.end() :]
        return new_text, True
    
    return card_text, False


def build_artifact(
    chapter_text: str,
    selected_cards: list[CardBlock],
    cards_found: int,
    clear_osr: bool = False,
    clear_bodies: bool = False,
    crosswalk_path: Path | None = None,
) -> ClearArtifact:
    replacements: list[tuple[int, int, str]] = []
    osr_changed_count = 0
    body_changed_count = 0
    crosswalk_updated_count = 0

    for card in selected_cards:
        new_card_text = card.text
        
        # Clear OSR block if requested
        if clear_osr:
            try:
                new_card_text, osr_changed = clear_osr_body(new_card_text)
                if osr_changed:
                    osr_changed_count += 1
                    # Update crosswalk if requested
                    if crosswalk_path and crosswalk_path.exists():
                        if update_crosswalk_row(crosswalk_path, card.heading):
                            crosswalk_updated_count += 1
            except RuntimeError:
                # Card may not have osr block, continue with other operations
                pass
        
        # Clear power body if requested
        if clear_bodies:
            new_card_text, body_changed = clear_power_body(new_card_text)
            if body_changed:
                body_changed_count += 1
        
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
        placeholders_osr_before=chapter_text.count(PENDING_OSR_BODY),
        placeholders_osr_after=updated.count(PENDING_OSR_BODY),
        placeholders_body_before=chapter_text.count(PENDING_POWER_BODY),
        placeholders_body_after=updated.count(PENDING_POWER_BODY),
        cards_found=cards_found,
        cards_selected=len(selected_cards),
        osr_blocks_changed=osr_changed_count,
        power_bodies_changed=body_changed_count,
        crosswalk_rows_updated=crosswalk_updated_count,
    )


def print_summary(artifact: ClearArtifact, drift: bool) -> None:
    print(f"cards found: {artifact.cards_found}")
    print(f"cards selected: {artifact.cards_selected}")
    print(f"osr blocks changed: {artifact.osr_blocks_changed}")
    print(f"power bodies changed: {artifact.power_bodies_changed}")
    print(f"crosswalk rows updated: {artifact.crosswalk_rows_updated}")
    print(f"osr pending before: {artifact.placeholders_osr_before}")
    print(f"osr pending after: {artifact.placeholders_osr_after}")
    print(f"body pending before: {artifact.placeholders_body_before}")
    print(f"body pending after: {artifact.placeholders_body_after}")
    print(f"drift: {'yes' if drift else 'no'}")


def main() -> int:
    args = parse_args()
    select_all, name = ensure_selector(args)

    # Default: if no clearing flags specified, default to clearing OSR
    clear_osr = args.clear_osr or (not args.clear_bodies)
    clear_bodies = args.clear_bodies
    
    try:
        chapter_text = args.chapter.read_text(encoding="utf-8")
        cards = parse_cards(chapter_text)
        selected_cards = select_cards(cards, select_all=select_all, name=name)
        artifact = build_artifact(
            chapter_text,
            selected_cards=selected_cards,
            cards_found=len(cards),
            clear_osr=clear_osr,
            clear_bodies=clear_bodies,
            crosswalk_path=args.crosswalk if args.update_crosswalk else None,
        )
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
