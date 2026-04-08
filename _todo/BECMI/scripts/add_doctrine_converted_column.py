#!/usr/bin/env python3
"""Add a `Converted` column to all Doctrine migration tables whose `Classic Name`
entries have a corresponding heading in FTLS Chapter 06.

Usage:
    python3 _todo/BECMI/scripts/add_doctrine_converted_column.py check
    python3 _todo/BECMI/scripts/add_doctrine_converted_column.py write

`check` reports which tables would be modified and what values would be written.
`write` applies changes in-place.

Column values:
- `yes`  — classic name has osr: imported = yes in the crosswalk
- `wip`  — classic name has osr: imported = in-progress in the crosswalk
- `no`   — classic name has a Ch06 card but has not been imported yet
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path("/home/joshu/Synthetic-Dream-Machine")
DOCTRINE = ROOT / "_todo/BECMI/TODO_BECMI_Spell_Effect_Conversion_Doctrine.md"
CROSSWALK = ROOT / "_todo/BECMI/TODO_BECMI_Spell_Effect_Crosswalk.md"
CHAPTER06 = ROOT / "FTLS/Flying_Triremes_and_Laser_Swords_06_Powers_and_ECM.md"

CONVERTED_COL = "Converted"
SEP_CELL = " --- "


# ---------------------------------------------------------------------------
# Label / alias matching (mirrors import_ch06_osr.py logic)
# ---------------------------------------------------------------------------

def normalize_label(label: str) -> str:
    return " ".join(label.strip().lower().split())


def alias_forms(label: str) -> set[str]:
    parts = [p.strip() for p in re.split(r"\s*,\s*aka\s+", label, flags=re.I) if p.strip()]
    forms = {normalize_label(label)}
    for p in parts:
        forms.add(normalize_label(p))
    return forms


def labels_match(left: str, right: str) -> bool:
    return bool(alias_forms(left) & alias_forms(right))


# ---------------------------------------------------------------------------
# Build lookup sets from Ch06 and crosswalk
# ---------------------------------------------------------------------------

def build_ch06_names(chapter_text: str) -> set[str]:
    """Return the set of all h2 headings in Chapter 06 (normalized)."""
    return {
        normalize_label(m.group(1))
        for m in re.finditer(r"^## (.+)$", chapter_text, re.M)
    }


def build_imported_names(crosswalk_text: str, status: str) -> set[str]:
    """Return Classic Names where osr: imported column == status (e.g. 'yes', 'in-progress')."""
    names: set[str] = set()
    for line in crosswalk_text.splitlines():
        if not line.startswith("| ") or line.startswith("| ---"):
            continue
        parts = [p.strip() for p in line.strip("|").split("|")]
        if len(parts) == 7 and parts[4] == "spell" and parts[5] == "✓" and parts[6] == status:
            names.add(normalize_label(parts[0]))
    return names


def converted_value(classic_name: str, yes_names: set[str], wip_names: set[str]) -> str:
    forms = alias_forms(classic_name)
    if forms & yes_names:
        return "yes"
    if forms & wip_names:
        return "wip"
    return "no"


# ---------------------------------------------------------------------------
# Row / table helpers
# ---------------------------------------------------------------------------

def parse_row(line: str) -> list[str] | None:
    """Parse a markdown table row; return None for separator rows or non-row lines."""
    stripped = line.strip()
    if not stripped.startswith("|"):
        return None
    cells = [c.strip() for c in stripped.strip("|").split("|")]
    return cells


def is_separator_row(line: str) -> bool:
    stripped = line.strip()
    if not stripped.startswith("|"):
        return False
    cells = [c.strip() for c in stripped.strip("|").split("|")]
    return all(re.fullmatch(r":?-+:?", c) for c in cells if c)


def has_converted_col(header_cells: list[str]) -> bool:
    return any(c.strip() == CONVERTED_COL for c in header_cells)


def classic_name_col_index(header_cells: list[str]) -> int | None:
    for i, c in enumerate(header_cells):
        if c.strip().lower() in ("classic name", "name"):
            return i
    return None


def is_ch06_table(header_cells: list[str], data_rows: list[list[str]], ch06_names: set[str], classic_idx: int) -> bool:
    """True if at least one data row in the table has a Classic Name present in Ch06."""
    for cells in data_rows:
        if classic_idx < len(cells):
            name = cells[classic_idx].strip()
            # match any alias form against ch06_names
            if alias_forms(name) & ch06_names:
                return True
    return False


# ---------------------------------------------------------------------------
# Main transform
# ---------------------------------------------------------------------------

def transform(doctrine_text: str, ch06_names: set[str], yes_names: set[str], wip_names: set[str]) -> tuple[str, list[str]]:
    """Return (updated_text, list_of_change_descriptions)."""
    lines = doctrine_text.splitlines(keepends=True)
    output: list[str] = []
    changes: list[str] = []

    i = 0
    while i < len(lines):
        line = lines[i]

        # Detect start of a markdown table: pipe row followed by separator row
        header_cells = parse_row(line.rstrip("\n"))
        if (
            header_cells is not None
            and not is_separator_row(line)
            and i + 1 < len(lines)
            and is_separator_row(lines[i + 1])
        ):
            # We are at the header row of a table
            classic_idx = classic_name_col_index(header_cells)
            if classic_idx is None or has_converted_col(header_cells):
                # Not a name-bearing table or already patched — pass through verbatim
                output.append(line)
                i += 1
                continue

            # Collect the full table (header + sep + data rows)
            table_start = i
            sep_line = lines[i + 1]
            sep_cells = parse_row(sep_line.rstrip("\n"))
            j = i + 2
            data_rows: list[tuple[int, list[str]]] = []  # (lineno, cells)
            while j < len(lines):
                row_cells = parse_row(lines[j].rstrip("\n"))
                if row_cells is None:
                    break
                if is_separator_row(lines[j]):
                    break
                data_rows.append((j, row_cells))
                j += 1

            # Check if any data row Classic Name matches Ch06
            all_data_cells = [cells for _, cells in data_rows]
            if not is_ch06_table(header_cells, all_data_cells, ch06_names, classic_idx):
                # Not a Ch06-relevant table; pass through
                output.append(line)
                i += 1
                continue

            # Patch header
            new_header_cells = header_cells + [CONVERTED_COL]
            new_sep_cells = (sep_cells or []) + [SEP_CELL]
            output.append("| " + " | ".join(new_header_cells) + " |\n")
            output.append("| " + " | ".join(new_sep_cells) + " |\n")
            changes.append(f"  table at L{table_start + 1}: added Converted column header")

            # Patch data rows
            for lineno, cells in data_rows:
                classic_name = cells[classic_idx].strip() if classic_idx < len(cells) else ""
                # Only assign converted value when this row has a Ch06 match
                if alias_forms(classic_name) & ch06_names:
                    val = converted_value(classic_name, yes_names, wip_names)
                else:
                    val = "—"
                new_cells = cells + [val]
                output.append("| " + " | ".join(new_cells) + " |\n")

            i = j
            continue

        output.append(line)
        i += 1

    return "".join(output), changes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["check", "write"])
    args = parser.parse_args()

    doctrine_text = DOCTRINE.read_text(encoding="utf-8")
    crosswalk_text = CROSSWALK.read_text(encoding="utf-8")
    chapter_text = CHAPTER06.read_text(encoding="utf-8")

    ch06_names = build_ch06_names(chapter_text)
    yes_names = build_imported_names(crosswalk_text, "yes")
    wip_names = build_imported_names(crosswalk_text, "in-progress")

    new_text, changes = transform(doctrine_text, ch06_names, yes_names, wip_names)

    drift = new_text != doctrine_text
    print(f"tables modified: {len(changes)}")
    for c in changes:
        print(c)
    print(f"drift: {'yes' if drift else 'no'}")

    if args.mode == "write":
        if drift:
            DOCTRINE.write_text(new_text, encoding="utf-8")
        return 0

    return 1 if drift else 0


if __name__ == "__main__":
    raise SystemExit(main())
