#!/usr/bin/env python3
"""
remove_type_tags_index.py — Strip `type:` prefix from [type:X] tags in the
Traits Index (SDM_03) and Gear Index (SDM_05).

SDM_03 rules:
  - [type:path]         → DELETE the entire line (redundant with [path:X])
  - [type:background]   → [background]
  - [type:corruption]   → [corruption]
  - [type:power]        → [power]
  No dedup needed — none of the flat equivalents already appear on those cards.

SDM_05 rules (both blockquote tag lines AND inline table cells):
  16 simple renames — strip the `type:` prefix, keep the value unchanged.
  No deletions.
  Double-space collapse applied only on modified lines.

Usage:
  python3 scripts/remove_type_tags_index.py [--dry-run] [--traits] [--gear]

  --traits  process Synthetic_Dream_Machine_03_Traits_Index.md
  --gear    process Synthetic_Dream_Machine_05_Gear_Index.md
  (without either flag, processes both)
"""

import re
import sys
import os

DRY_RUN = '--dry-run' in sys.argv
do_traits = '--traits' in sys.argv or ('--gear' not in sys.argv)
do_gear   = '--gear'   in sys.argv or ('--traits' not in sys.argv)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------------------
# SDM_03 transformation
# ---------------------------------------------------------------------------

TRAITS_PATH = os.path.join(BASE, 'Synthetic_Dream_Machine_03_Traits_Index.md')

SDM03_DELETE = re.compile(r'^(>[ \t]+)\[type:path\]$')
SDM03_RENAME = {
    '[type:background]': '[background]',
    '[type:corruption]':  '[corruption]',
    '[type:power]':       '[power]',
}

def transform_traits(lines):
    deleted = 0
    renamed = 0
    out = []
    for line in lines:
        stripped = line.rstrip('\n')
        if SDM03_DELETE.match(stripped):
            deleted += 1
            continue  # drop the line
        hit = False
        for old, new in SDM03_RENAME.items():
            if old in stripped:
                stripped = stripped.replace(old, new)
                renamed += 1
                hit = True
                break
        out.append(stripped + '\n')
    return out, deleted, renamed

# ---------------------------------------------------------------------------
# SDM_05 transformation — generic: strip [type:X] -> [X] for all values
# ---------------------------------------------------------------------------

GEAR_PATH = os.path.join(BASE, 'Synthetic_Dream_Machine_05_Gear_Index.md')

TYPE_STRIP = re.compile(r'\[type:([^\]]+)\]')
DOUBLE_SPACE = re.compile(r'  +')

def dedup_tags(line):
    """Remove duplicate [tag] occurrences on a single line (keep first)."""
    seen = set()
    def replacer(m):
        tag = m.group(0)
        if tag in seen:
            return ''
        seen.add(tag)
        return tag
    return re.sub(r'\[[^\]]+\]', replacer, line)

def transform_gear(lines):
    renamed = 0
    out = []
    for line in lines:
        stripped = line.rstrip('\n')
        if '[type:' not in stripped:
            out.append(line)
            continue
        new = TYPE_STRIP.sub(r'[\1]', stripped)
        count = len(TYPE_STRIP.findall(stripped))
        renamed += count
        new = dedup_tags(new)
        new = DOUBLE_SPACE.sub(' ', new)
        out.append(new + '\n')
    return out, renamed

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if do_traits:
    with open(TRAITS_PATH, encoding='utf-8') as fh:
        lines = fh.readlines()
    out, deleted, renamed = transform_traits(lines)
    verb = "Would change" if DRY_RUN else "Changed"
    print(f"SDM_03 Traits: {verb} — {deleted} [type:path] lines deleted, {renamed} renames")
    if not DRY_RUN:
        with open(TRAITS_PATH, 'w', encoding='utf-8') as fh:
            fh.writelines(out)

if do_gear:
    with open(GEAR_PATH, encoding='utf-8') as fh:
        lines = fh.readlines()
    out, renamed = transform_gear(lines)
    verb = "Would change" if DRY_RUN else "Changed"
    print(f"SDM_05 Gear: {verb} — {renamed} renames")
    if not DRY_RUN:
        with open(GEAR_PATH, 'w', encoding='utf-8') as fh:
            fh.writelines(out)
