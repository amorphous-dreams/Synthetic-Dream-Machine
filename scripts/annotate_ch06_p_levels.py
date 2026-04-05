#!/usr/bin/env python3
"""Annotate Chapter 06 OSR power cards with P: (Power Level) values.

Derives P: from the crosswalk 'Class(es)/Spell-level' column using:
    P: = max(1, min_spell_level × 2)

For multi-class or multi-level rows the minimum spell level is used
(matching the lowest access point; conversion notes can document escalated
forms in the card body during Pass 3).

Usage:
    python3 scripts/annotate_ch06_p_levels.py check
    python3 scripts/annotate_ch06_p_levels.py write
    python3 scripts/annotate_ch06_p_levels.py write --card "Magic Missile"
    python3 scripts/annotate_ch06_p_levels.py check --show-edge-cases
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path("/home/joshu/Synthetic-Dream-Machine")
DEFAULT_CHAPTER = ROOT / "Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_06_Powers_and_ECM.md"
DEFAULT_CROSSWALK = ROOT / "_todo/TODO_BECMI_Spell_Effect_Crosswalk.md"

# Attribute-line marker written into pending stubs
PENDING_BODY = "{pending conversion}"

# Card block boundaries
CARD_BLOCK_RE = re.compile(
    r'(<div class="power-card"[^>]*>.*?</div>\s*</div>)',
    re.DOTALL,
)
HEADING_RE = re.compile(r"^###\s+(.+)", re.MULTILINE)

# Regex to find the first blockquote attribute line (P: already set)
P_LINE_RE = re.compile(r"^> \*\*P:\*\*\s*(.+)$", re.MULTILINE)

# The pending body token, as it appears inside a blockquote
PENDING_BQ_RE = re.compile(r">\s*\{pending conversion\}")

# Class-code → numeric level extractor: C1, MU3, D5, Dr3, etc.
CLASS_LEVEL_RE = re.compile(r"[A-Za-z]+(\d+)")

# Procedure / artifact / non-spell markers — these don't get P: from the formula
PROCEDURE_TYPES = {"procedure", "artifact-procedure", "meta"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["check", "write"])
    parser.add_argument("--chapter", type=Path, default=DEFAULT_CHAPTER)
    parser.add_argument("--crosswalk", type=Path, default=DEFAULT_CROSSWALK)
    parser.add_argument("--card", help="Exact Chapter 06 card heading to update (substring match)")
    parser.add_argument("--show-edge-cases", action="store_true",
                        help="Print edge-case rows that need manual P: review")
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Label normalisation (from import_ch06_osr.py)
# ---------------------------------------------------------------------------

def normalize_label(label: str) -> str:
    return " ".join(label.strip().lower().split())


def alias_forms(label: str) -> set[str]:
    parts = [p.strip() for p in re.split(r"\s*,\s*aka\s+", label, flags=re.I) if p.strip()]
    forms = {normalize_label(label)}
    for part in parts:
        forms.add(normalize_label(part))
    return forms


def labels_match(left: str, right: str) -> bool:
    return bool(alias_forms(left) & alias_forms(right))


# ---------------------------------------------------------------------------
# Crosswalk parsing
# ---------------------------------------------------------------------------

def parse_crosswalk_p_map(crosswalk_text: str) -> dict[str, int | None]:
    """Build {classic_name: P: value} from Class(es)/Spell-level column.

    Returns None for rows that are procedures, artifacts, or have irregular
    level encodings that need manual review.
    """
    p_map: dict[str, int | None] = {}
    seen: set[str] = set()

    for line in crosswalk_text.splitlines():
        # Table row: | name | class/level | ... | type | ✓ | ... |
        if not line.startswith("|") or line.startswith("| ---") or line.startswith("| Classic Name"):
            continue
        parts = [p.strip() for p in line.split("|")]
        # Remove empty first/last from split
        parts = [p for p in parts if p or True]
        if parts[0] == "":
            parts = parts[1:]
        if parts[-1] == "":
            parts = parts[:-1]
        if len(parts) < 6:
            continue

        classic_name = parts[0]
        class_level_field = parts[1]   # e.g. "C1", "MU3", "C1, MU2", "procedure"
        row_type = parts[4] if len(parts) >= 5 else ""

        if classic_name in seen:
            continue

        # Skip non-spell rows
        if row_type in PROCEDURE_TYPES or classic_name.startswith("|"):
            continue

        # Extract all numeric spell levels from the class-level field
        levels = [int(m.group(1)) for m in CLASS_LEVEL_RE.finditer(class_level_field)]

        if not levels:
            # Edge case: free-word field (e.g. "variable", "special", "Immortal")
            # Only store None if not already known — don't overwrite a valid entry
            if classic_name not in seen:
                p_map[classic_name] = None
            # Don't mark as seen yet — a later row may have numeric data
        else:
            min_level = min(levels)
            p_val = max(1, min_level * 2)
            p_map[classic_name] = p_val
            seen.add(classic_name)

    return p_map


# ---------------------------------------------------------------------------
# Chapter card parsing and annotation
# ---------------------------------------------------------------------------

def iter_card_blocks(chapter_text: str) -> list[tuple[str, int, int]]:
    """Return list of (heading, start, end) for every power-card div."""
    results = []
    for m in CARD_BLOCK_RE.finditer(chapter_text):
        block = m.group(1)
        hm = HEADING_RE.search(block)
        if hm:
            results.append((hm.group(1).strip(), m.start(), m.end()))
    return results


def find_card(chapter_text: str, target: str) -> tuple[str, int, int] | None:
    for heading, start, end in iter_card_blocks(chapter_text):
        if labels_match(heading, target):
            return heading, start, end
    return None


def card_needs_p_annotation(card_block: str) -> bool:
    """True if the card body is pending AND has no P: line already."""
    has_pending = PENDING_BODY in card_block
    has_p = bool(P_LINE_RE.search(card_block))
    return has_pending and not has_p


def inject_p_line(card_block: str, p_val: int) -> str:
    """Insert a > **P:** X line right after the opening blockquote title line."""
    # Find the body blockquote opening — the first "> **NAME**" line
    # then insert P:/R:/T:/D: stub with pending markers
    # Pattern: after "> {pending conversion}" we replace it with attribute + pending body
    new_attr = f"> **P:** {p_val} **R:** — **T:** — **D:** —  \n>\n> {{pending conversion}}"
    return PENDING_BQ_RE.sub(new_attr.replace("\\", "\\\\"), card_block, count=1)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()

    chapter_text = args.chapter.read_text()
    crosswalk_text = args.crosswalk.read_text()

    p_map = parse_crosswalk_p_map(crosswalk_text)

    cards = iter_card_blocks(chapter_text)

    edge_cases: list[tuple[str, str]] = []  # (heading, reason)
    misses: list[str] = []                  # cards not found in crosswalk
    updates: list[tuple[str, int]] = []     # (heading, p_val)
    already_done: list[str] = []            # already have P:
    skipped_native: list[str] = []          # cards with full SDM body (no pending marker)

    for heading, start, end in cards:
        block = chapter_text[start:end]

        # Skip native/non-pending cards
        if PENDING_BODY not in block:
            skipped_native.append(heading)
            continue

        # Skip if P: already injected
        if P_LINE_RE.search(block):
            already_done.append(heading)
            continue

        # Filter by --card if supplied
        if args.card and not labels_match(heading, args.card):
            continue

        # Look up in p_map
        matched_name = None
        matched_p = None

        for classic_name, p_val in p_map.items():
            if labels_match(heading, classic_name):
                matched_name = classic_name
                matched_p = p_val
                break

        if matched_name is None:
            misses.append(heading)
            edge_cases.append((heading, "not found in crosswalk — manual review"))
            continue

        if matched_p is None:
            edge_cases.append((heading, f"spell level non-numeric in crosswalk ('{classic_name}') — manual P: needed"))
            continue

        updates.append((heading, matched_p))

    # Report
    print(f"Cards total: {len(cards)}")
    print(f"Native (non-pending) — skipped: {len(skipped_native)}")
    print(f"Already annotated — skipped: {len(already_done)}")
    print(f"Queued for P: annotation: {len(updates)}")
    print(f"Edge cases (manual review needed): {len(edge_cases)}")
    print()

    if args.show_edge_cases or args.mode == "check":
        if edge_cases:
            print("=== EDGE CASES ===")
            for h, reason in edge_cases:
                print(f"  [{h}] — {reason}")
            print()
        if misses:
            print("=== CROSSWALK MISSES (not in crosswalk) ===")
            for h in misses:
                print(f"  {h}")
            print()

    if args.mode == "check":
        print(f"P: annotation pass: {'READY' if len(edge_cases) < 20 else 'NEEDS REVIEW'}")
        sys.exit(0)

    # Write mode
    if args.mode == "write":
        updated = chapter_text
        # Process in reverse order to preserve offsets
        update_map: dict[str, int] = {normalize_label(h): p for h, p in updates}

        applied = 0
        for heading, start, end in reversed(iter_card_blocks(updated)):
            norm = normalize_label(heading)
            if norm not in update_map:
                continue
            p_val = update_map[norm]
            old_block = updated[start:end]
            new_block = inject_p_line(old_block, p_val)
            if new_block != old_block:
                updated = updated[:start] + new_block + updated[end:]
                applied += 1

        args.chapter.write_text(updated)
        print(f"Written: {applied} cards annotated with P: values")
        print(f"Edge cases NOT annotated (manual review): {len(edge_cases)}")
        for h, reason in edge_cases:
            print(f"  [{h}] — {reason}")


if __name__ == "__main__":
    main()
