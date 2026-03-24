#!/usr/bin/env python3
"""Extract verbatim spell blocks from staged BECMI markdown documents.

Usage:
    extract_becmi_spell_blocks.py path/to/staging.md --title "Magic Missile"
    extract_becmi_spell_blocks.py path/to/staging.md --title "Fly" --title "Lightning Bolt"

The script searches inside fenced text blocks first, then falls back to the full file.
A spell block starts at an exact title line and continues through the contiguous
rules text until the next spell-style title or the next markdown/code-fence boundary.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


TITLE_RANGE_RE = re.compile(r"^[A-Za-z0-9'.,()/*+\- ]+$")
FIELD_RE = re.compile(r"^(Range|Duration|Effect):")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path, help="Staging markdown file to scan")
    parser.add_argument(
        "--title",
        action="append",
        required=True,
        help="Exact spell title to extract. Repeat for multiple titles.",
    )
    parser.add_argument(
        "--with-source",
        action="store_true",
        help="Prefix each extracted block with the source file path.",
    )
    return parser.parse_args()


def extract_text_regions(markdown: str) -> list[list[str]]:
    regions: list[list[str]] = []
    in_text_fence = False
    current: list[str] = []
    for line in markdown.splitlines():
        if line.startswith("```text"):
            in_text_fence = True
            current = []
            continue
        if in_text_fence and line.startswith("```"):
            regions.append(current[:])
            in_text_fence = False
            current = []
            continue
        if in_text_fence:
            current.append(line.rstrip("\n"))
    return regions


def looks_like_spell_title(lines: list[str], index: int) -> bool:
    line = lines[index].strip()
    if not line or not TITLE_RANGE_RE.match(line):
        return False
    if index + 1 >= len(lines):
        return False
    return bool(FIELD_RE.match(lines[index + 1].strip()))


def looks_like_section_heading(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    letters_only = re.sub(r"[^A-Za-z]+", "", stripped)
    return bool(letters_only) and letters_only.isupper() and len(letters_only) >= 6


def find_block(lines: list[str], title: str) -> list[str] | None:
    candidates: list[list[str]] = []
    for index, raw_line in enumerate(lines):
        if raw_line.strip() != title:
            continue
        block = [raw_line.rstrip()]
        cursor = index + 1
        while cursor < len(lines):
            line = lines[cursor].rstrip()
            if cursor > index + 1 and looks_like_spell_title(lines, cursor):
                break
            if looks_like_section_heading(line):
                break
            if line.startswith("[") and line.endswith("]"):
                break
            if line.startswith("### ") or line.startswith("## "):
                break
            block.append(line)
            cursor += 1
        while block and not block[-1].strip():
            block.pop()
        if len(block) >= 4:
            candidates.append(block)
    if not candidates:
        return None
    return max(candidates, key=lambda block: sum(len(line.strip()) for line in block))


def main() -> int:
    args = parse_args()
    if not args.file.exists():
        print(f"error: file not found: {args.file}", file=sys.stderr)
        return 2

    markdown = args.file.read_text(encoding="utf-8")
    regions = extract_text_regions(markdown)
    search_spaces = regions + [markdown.splitlines()]

    missing: list[str] = []
    for title in args.title:
        block = None
        for region in search_spaces:
            block = find_block(region, title)
            if block:
                break
        if not block:
            missing.append(title)
            continue
        if args.with_source:
            print(f"# source: {args.file}")
        print("=" * 80)
        print("\n".join(block))
        print()

    if missing:
        print("error: could not extract title(s): " + ", ".join(missing), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
