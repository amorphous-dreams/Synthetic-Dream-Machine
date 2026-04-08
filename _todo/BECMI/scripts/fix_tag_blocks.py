#!/usr/bin/env python3
"""
fix_tag_blocks.py — Clean up tag-block artifacts left by the [type:X] removal pass.

Two fixes, applied only inside `tags:` … `meta:` blocks:
  1. Remove empty blockquote lines (`> ` alone on a line).
  2. Re-indent misindented tradition tags: `> [tag]` → `>   [tag]`.

Usage:
  python3 _todo/BECMI/scripts/fix_tag_blocks.py [--dry-run] FILE [FILE ...]
"""

import re
import sys

DRY_RUN = '--dry-run' in sys.argv
files = [f for f in sys.argv[1:] if f != '--dry-run']

if not files:
    print("Usage: fix_tag_blocks.py [--dry-run] FILE [FILE ...]")
    sys.exit(1)

EMPTY_QUOTE  = re.compile(r'^> $')
LOW_INDENT   = re.compile(r'^> (\[)')  # `> [tag]` — tradition tag with only 1 space

for path in files:
    with open(path, encoding='utf-8') as fh:
        lines = fh.readlines()

    out = []
    in_tags = False
    removed = 0
    reindented = 0

    for line in lines:
        stripped = line.rstrip('\n')

        if stripped == 'tags:':
            in_tags = True
            out.append(line)
            continue

        if stripped.startswith('meta:'):
            in_tags = False

        if in_tags:
            if EMPTY_QUOTE.match(stripped):
                removed += 1
                continue  # drop the line entirely

            m = LOW_INDENT.match(stripped)
            if m:
                # `> [tag]` → `>   [tag]`
                fixed = '>   ' + stripped[2:] + '\n'
                out.append(fixed)
                reindented += 1
                continue

        out.append(line)

    verb = "Would change" if DRY_RUN else "Changed"
    print(f"{path}: {verb} {removed} empty lines removed, {reindented} tags re-indented")

    if not DRY_RUN:
        with open(path, 'w', encoding='utf-8') as fh:
            fh.writelines(out)
