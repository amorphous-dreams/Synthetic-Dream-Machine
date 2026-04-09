#!/usr/bin/env python3
"""Normalize power card structure in Chapter 06.

Enforces canonical card layout — same structure across all cards, with
optional sections (osr:) present only where they belong.

Normalizations applied:
  1. Old footer (<div style="text-align: right">) → new footer (<div class="power-return">)
  2. Missing blank line before footer (Create Air, Lore, Clothform)
  3. Single blank line between tags: and meta: → double blank line
  4. Trailing empty blockquote line (>) at end of tags: block → removed

Usage:
    python3 _todo/BECMI/scripts/normalize_ch06_cards.py check
    python3 _todo/BECMI/scripts/normalize_ch06_cards.py write
    python3 _todo/BECMI/scripts/normalize_ch06_cards.py check --name "Sword"
    python3 _todo/BECMI/scripts/normalize_ch06_cards.py write --name "Cure Light Wounds"
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path("/home/joshu/Synthetic-Dream-Machine")
DEFAULT_CHAPTER = ROOT / "FTLS/Flying_Triremes_and_Laser_Swords_06_Powers_and_ECM.md"

# Matches every power card div (one or more blank lines after opening tag)
CARD_RE = re.compile(
    r'<div class="power-card" markdown="1">\n\n+(#{2,6}) (.+?)\n(.*?)\n</div>',
    flags=re.S,
)

# Old-style footer that needs replacing
OLD_FOOTER_RE = re.compile(
    r'\n+(<div style="text-align: right">.*?</div>)\n\n</div>',
    flags=re.S,
)

# Canonical new footer block
NEW_FOOTER = """\

  <div class="power-return">
    &nbsp;&nbsp;
    <a class="js-back-link" href="#chapter-06-power-index-anchor" aria-label="Back to previous page">
      ↩ Back
    </a>
  </div>

</div>"""

# Trailing empty blockquote line(s) at end of tags: block (>\nmeta: or >\n>\nmeta: etc.)
# Matches: last real tag line, then one or more empty ">" lines, then newline+meta:
TAGS_TRAILING_BLANK_QUOTE_RE = re.compile(r'(>   \[[^\]]+\])((?:\n>)+)(\nmeta:)')

# Single blank line between last tag and meta: (no trailing empty > line)
TAGS_TO_META_SINGLE_RE = re.compile(r'(>   \[[^\]]+\])(\nmeta:)')


@dataclass
class NormResult:
    heading: str
    old_footer: bool
    tags_trailing_blank_quote: bool
    tags_meta_spacing: bool

    @property
    def changed(self) -> bool:
        return self.old_footer or self.tags_trailing_blank_quote or self.tags_meta_spacing


def normalize_card(card_text: str) -> tuple[str, NormResult]:
    heading_m = re.match(r'<div class="power-card" markdown="1">\n\n+(#{2,6}) (.+?)\n', card_text)
    heading = heading_m.group(2).strip() if heading_m else "?"
    result = NormResult(heading=heading, old_footer=False, tags_trailing_blank_quote=False, tags_meta_spacing=False)

    new_text = card_text

    # 1. Old footer → new footer (also fixes pre-footer blank lines)
    old_m = OLD_FOOTER_RE.search(new_text)
    if old_m:
        new_text = new_text[: old_m.start()] + NEW_FOOTER
        result.old_footer = True

    # 2. Trailing empty blockquote line(s) at end of tags: block
    tq_m = TAGS_TRAILING_BLANK_QUOTE_RE.search(new_text)
    if tq_m:
        # Remove the empty ">" lines and ensure exactly one blank line before meta:
        new_text = new_text[: tq_m.start(2)] + "\n\nmeta:" + new_text[tq_m.end():]
        result.tags_trailing_blank_quote = True

    # 3. Single blank line between last tag and meta: (no trailing empty > line)
    tm_m = TAGS_TO_META_SINGLE_RE.search(new_text)
    if tm_m:
        new_text = new_text[: tm_m.start(2)] + "\n\nmeta:" + new_text[tm_m.end():]
        result.tags_meta_spacing = True

    return new_text, result


def parse_cards(chapter_text: str) -> list[tuple[int, int, str, str]]:
    """Returns list of (start, end, heading, card_text)."""
    return [
        (m.start(), m.end(), m.group(2).strip(), m.group(0))
        for m in CARD_RE.finditer(chapter_text)
    ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["check", "write"])
    parser.add_argument("--chapter", type=Path, default=DEFAULT_CHAPTER)
    selector = parser.add_mutually_exclusive_group()
    selector.add_argument("--all", action="store_true", help="Process all cards (default)")
    selector.add_argument("--name", help="Exact card heading to process")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    chapter_text = args.chapter.read_text(encoding="utf-8")
    cards = parse_cards(chapter_text)

    name_filter: str | None = args.name

    results: list[NormResult] = []
    replacements: list[tuple[int, int, str]] = []

    for start, end, heading, card_text in cards:
        if name_filter and heading.lower() != name_filter.strip().lower():
            continue
        new_text, result = normalize_card(card_text)
        results.append(result)
        if result.changed:
            replacements.append((start, end, new_text))

    # Apply replacements (sorted by position, non-overlapping)
    replacements.sort(key=lambda r: r[0])
    pieces: list[str] = []
    cursor = 0
    for start, end, new_text in replacements:
        pieces.append(chapter_text[cursor:start])
        pieces.append(new_text)
        cursor = end
    pieces.append(chapter_text[cursor:])
    updated_text = "".join(pieces)

    drift = updated_text != chapter_text

    # Summary
    changed = [r for r in results if r.changed]
    old_footer_count = sum(1 for r in results if r.old_footer)
    tq_count = sum(1 for r in results if r.tags_trailing_blank_quote)
    tm_count = sum(1 for r in results if r.tags_meta_spacing)

    print(f"cards scanned:         {len(results)}")
    print(f"cards changed:         {len(changed)}")
    print(f"  old footer → new:    {old_footer_count}")
    print(f"  tags trailing quote: {tq_count}")
    print(f"  tags→meta spacing:   {tm_count}")
    print(f"drift: {'yes' if drift else 'no'}")

    if changed:
        print()
        for r in changed:
            flags = []
            if r.old_footer:
                flags.append("footer")
            if r.tags_trailing_blank_quote:
                flags.append("tags-trailing-quote")
            if r.tags_meta_spacing:
                flags.append("tags-meta-spacing")
            print(f"  {r.heading}: {', '.join(flags)}")

    if args.mode == "write":
        if drift:
            args.chapter.write_text(updated_text, encoding="utf-8")
            print()
            print(f"wrote: {args.chapter}")
        else:
            print()
            print("no changes needed")
        return 0

    # check mode: return 1 if drift (signals normalization needed)
    return 1 if drift else 0


if __name__ == "__main__":
    raise SystemExit(main())
