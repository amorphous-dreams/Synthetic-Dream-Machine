#!/usr/bin/env python3
"""
Remove [type:X] prefix from power card tag lines.

- [type:other] is deleted entirely (no replacement)
- [type:ritual] -> [ritual]
- [type:oldtech] -> [oldtech]
- [type:fantascience] -> [fantascience]
- Deduplicates [fantascience] and [oldtech] on a single line
  (FTLS_06 has cards with both [type:fantascience] structural tag
   and [fantascience] thematic tag)
- Collapses double spaces left by [type:other] deletion
"""

import re
import sys
from pathlib import Path


def transform_line(line: str) -> str:
    # Only touch lines that contain [type: — leave everything else alone
    if '[type:' not in line:
        return line

    original = line

    # 1. Delete [type:other] — remove tag and any immediately following space
    line = re.sub(r'\[type:other\] ?', '', line)

    # 2. Rename the remaining type-wrapped tags
    line = line.replace('[type:ritual]', '[ritual]')
    line = line.replace('[type:oldtech]', '[oldtech]')
    line = line.replace('[type:fantascience]', '[fantascience]')

    # 3. Deduplicate [fantascience] on the same line
    #    (FTLS_06 has cards with structural [type:fantascience] AND thematic [fantascience])
    if line.count('[fantascience]') > 1:
        first = line.index('[fantascience]') + len('[fantascience]')
        suffix = line[first:].replace('[fantascience]', '').replace('  ', ' ')
        line = line[:first] + suffix

    # 4. Deduplicate [oldtech] on the same line
    if line.count('[oldtech]') > 1:
        first = line.index('[oldtech]') + len('[oldtech]')
        suffix = line[first:].replace('[oldtech]', '').replace('  ', ' ')
        line = line[:first] + suffix

    # 5. Collapse double spaces left after [type:other] deletion on this line
    line = re.sub(r'(?<=\S)  +', ' ', line)

    return line


def process_file(path: Path, dry_run: bool = False) -> int:
    text = path.read_text(encoding='utf-8')
    lines = text.splitlines(keepends=True)
    changed = 0
    new_lines = []
    for i, line in enumerate(lines):
        new_line = transform_line(line)
        if new_line != line:
            changed += 1
        new_lines.append(new_line)

    if not dry_run:
        path.write_text(''.join(new_lines), encoding='utf-8')

    return changed


def main():
    if len(sys.argv) < 2:
        print("Usage: remove_type_prefix.py <file1> [file2 ...] [--dry-run]")
        sys.exit(1)

    dry_run = '--dry-run' in sys.argv
    files = [a for a in sys.argv[1:] if not a.startswith('--')]

    total = 0
    for f in files:
        p = Path(f)
        if not p.exists():
            print(f"ERROR: {f} not found", file=sys.stderr)
            continue
        n = process_file(p, dry_run=dry_run)
        action = "Would change" if dry_run else "Changed"
        print(f"{action} {n} lines in {f}")
        total += n

    print(f"Total: {total} lines affected")
    if dry_run:
        print("(dry-run — no files written)")


if __name__ == '__main__':
    main()
