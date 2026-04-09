#!/usr/bin/env python3
"""Apply confirmed source-lane additions to the crosswalk.

Adds missing Basic, Expert, or Companion lanes (with anchors) to the first
occurrence of each affected spell row. Applies only to the first occurrence
since parse_spell_rows() in build_becmi_spell_staging_multi.py deduplicates
by classic_name — the first row wins.

Usage:
    python3 _todo/BECMI/scripts/fix_crosswalk_source_lanes.py check
    python3 _todo/BECMI/scripts/fix_crosswalk_source_lanes.py write
"""
from __future__ import annotations

import argparse
import re
import sys

CROSSWALK = "/home/joshu/Synthetic-Dream-Machine/_todo/BECMI/TODO_BECMI_Spell_Effect_Crosswalk.md"

# ── Anchors ─────────────────────────────────────────────────────────────────
# Values are the path portion ONLY — the lane prefix is added automatically
# by apply_fixes when rebuilding the anchor field.

BASIC_MU2_ANCHOR = "Spell Lists and Basic Spell Descriptions -> Magic-User Spells: Second Level"

EXPERT_C5_ANCHOR = "Clerical and Magic-User Spell Expansions -> Fifth-Level Clerical Spells"
EXPERT_C6_ANCHOR = "Clerical and Magic-User Spell Expansions -> Sixth-Level Clerical Spells"

COMP_HLL = "High-Level Cleric, Druid, and Magic-User Spell Material"
COMP_MU5_ANCHOR = f"{COMP_HLL} -> Fifth-Level Magic-User Spells"
COMP_MU6_ANCHOR = f"{COMP_HLL} -> Sixth-Level Magic-User Spells"
COMP_MU7_ANCHOR = f"{COMP_HLL} -> Seventh-Level Magic-User Spells"
COMP_MU8_ANCHOR = f"{COMP_HLL} -> Eighth-Level Magic-User Spells"
COMP_MU9_ANCHOR = f"{COMP_HLL} -> Ninth-Level Magic-User Spells"
COMP_DRUID_ANCHOR = "Druid Spell Material"

# ── Fix table ────────────────────────────────────────────────────────────────
# Each entry: (classic_name, new_lane, new_anchor)
# `new_lane` is the lane identifier as it should appear in the Source Book(s)
# column.  The script adds it in LANE_ORDER position.
# Only the first occurrence of `classic_name` in the crosswalk is modified.

FIXES: list[tuple[str, str, str]] = [
    # ── Category B: Basic lane missing from MU2 spells ────────────────────
    ("Continual Light",     "Basic", BASIC_MU2_ANCHOR),
    ("Detect Invisible",    "Basic", BASIC_MU2_ANCHOR),
    ("ESP",                 "Basic", BASIC_MU2_ANCHOR),
    ("Invisibility",        "Basic", BASIC_MU2_ANCHOR),
    ("Knock",               "Basic", BASIC_MU2_ANCHOR),
    ("Levitate",            "Basic", BASIC_MU2_ANCHOR),
    ("Locate Object",       "Basic", BASIC_MU2_ANCHOR),
    ("Mirror Image",        "Basic", BASIC_MU2_ANCHOR),
    ("Phantasmal Force",    "Basic", BASIC_MU2_ANCHOR),
    ("Web",                 "Basic", BASIC_MU2_ANCHOR),
    ("Wizard Lock",         "Basic", BASIC_MU2_ANCHOR),
    ("Dispel Magic",        "Basic", BASIC_MU2_ANCHOR),  # first row 431 missing Basic; 444 duplicate already has it

    # ── Category C: Expert lane missing from Companion-origin Cleric spells
    ("Animate Objects",  "Expert", EXPERT_C6_ANCHOR),
    ("Commune",          "Expert", EXPERT_C5_ANCHOR),
    ("Create Food",      "Expert", EXPERT_C5_ANCHOR),
    ("Dispel Evil",      "Expert", EXPERT_C5_ANCHOR),
    ("Find the Path",    "Expert", EXPERT_C6_ANCHOR),
    ("Insect Plague",    "Expert", EXPERT_C5_ANCHOR),
    ("Quest",            "Expert", EXPERT_C5_ANCHOR),
    ("Raise Dead",       "Expert", EXPERT_C5_ANCHOR),
    ("Speak with Monsters", "Expert", EXPERT_C6_ANCHOR),
    ("Word of Recall",   "Expert", EXPERT_C6_ANCHOR),

    # ── Category D: Companion lane missing from Master-listed MU spells ───
    # MU5
    ("Dissolve",             "Companion", COMP_MU5_ANCHOR),
    ("Feeblemind",           "Companion", COMP_MU5_ANCHOR),
    ("Telekinesis",          "Companion", COMP_MU5_ANCHOR),
    # MU6
    ("Move Earth",           "Companion", COMP_MU6_ANCHOR),
    ("Wall of Iron",         "Companion", COMP_MU6_ANCHOR),
    # MU7
    ("Lore",                 "Companion", COMP_MU7_ANCHOR),
    ("Magic Door",           "Companion", COMP_MU7_ANCHOR),
    ("Mass Invisibility",    "Companion", COMP_MU7_ANCHOR),
    ("Power Word Stun",      "Companion", COMP_MU7_ANCHOR),
    ("Reverse Gravity",      "Companion", COMP_MU7_ANCHOR),
    ("Statue",               "Companion", COMP_MU7_ANCHOR),
    ("Delayed Blast Fireball", "Companion", COMP_MU7_ANCHOR),
    # MU8
    ("Dance",                "Companion", COMP_MU8_ANCHOR),
    ("Explosive Cloud",      "Companion", COMP_MU8_ANCHOR),
    ("Mass Charm",           "Companion", COMP_MU8_ANCHOR),
    ("Mind Barrier",         "Companion", COMP_MU8_ANCHOR),
    ("Permanence",           "Companion", COMP_MU8_ANCHOR),
    ("Polymorph Any Object", "Companion", COMP_MU8_ANCHOR),
    ("Power Word Blind",     "Companion", COMP_MU8_ANCHOR),
    ("Symbol",               "Companion", COMP_MU8_ANCHOR),
    # MU9
    ("Maze",                 "Companion", COMP_MU9_ANCHOR),
    ("Meteor Swarm",         "Companion", COMP_MU9_ANCHOR),
    ("Power Word Kill",      "Companion", COMP_MU9_ANCHOR),

    # ── Category A: Dedup fix — first Water Breathing row (458) missing
    #    Companion + Master; second row (634) has them but gets deduplicated.
    ("Water Breathing",  "Companion", COMP_DRUID_ANCHOR),
    ("Water Breathing",  "Master",    "Druid Spell Material"),

    # ── Residual: Dispel Magic has Master procedures expansion worth capturing
    ("Dispel Magic",     "Master",    "High-Level Procedure Notes"),
]

# LANE_ORDER — used to insert new lanes in canonical position
LANE_ORDER = [
    "Men & Magic", "Greyhawk", "Holmes", "OD&D Family",
    "Basic", "Expert", "Companion", "Master", "Immortals", "Rules Cyclopedia",
]

# Abbreviation → canonical name for LANE_ORDER lookups.
# The crosswalk uses abbreviated names like 'RC' in its cell values.
_LANE_CANONICAL: dict[str, str] = {
    "RC": "Rules Cyclopedia",
    "Rules Cyclopedia": "Rules Cyclopedia",
    "OD&D": "OD&D Family",
    "OD&D Family": "OD&D Family",
    "MM": "Men & Magic",
    "Men & Magic": "Men & Magic",
    "HB": "Holmes",
    "Holmes": "Holmes",
}


def _lane_pos(name: str) -> int:
    """Return the position of `name` in LANE_ORDER, handling abbreviations."""
    canonical = _LANE_CANONICAL.get(name, name)
    try:
        return LANE_ORDER.index(canonical)
    except ValueError:
        return len(LANE_ORDER)  # unknown lane → sort to end


def parse_row(line: str) -> list[str] | None:
    """Return the 7 stripped cell values if `line` is a data row, else None."""
    if not line.startswith("| ") or line.startswith("| ---"):
        return None
    parts = [p.strip() for p in line.strip("|").split("|")]
    if len(parts) != 7:
        return None
    return parts


def lanes_from_field(field: str) -> list[str]:
    """Parse comma-separated lane names from the Source Book(s) column."""
    return [p.strip() for p in field.split(",") if p.strip()]


def anchors_from_field(field: str) -> list[tuple[str, str]]:
    """Parse `Lane -> Anchor` pairs from the Staging Anchor column."""
    pairs: list[tuple[str, str]] = []
    for chunk in field.split(";"):
        chunk = chunk.strip()
        if "->" in chunk:
            lane, anchor = chunk.split("->", 1)
            pairs.append((lane.strip(), anchor.strip()))
    return pairs


def insert_in_order(existing: list[str], new_item: str) -> list[str]:
    """Insert new_item into existing list at the correct LANE_ORDER position."""
    if new_item in existing:
        return existing
    new_pos = _lane_pos(new_item)
    for i, item in enumerate(existing):
        if _lane_pos(item) > new_pos:
            return existing[:i] + [new_item] + existing[i:]
    return existing + [new_item]


def apply_fixes(text: str, fixes: list[tuple[str, str, str]], dry_run: bool) -> str:
    """Apply all fixes to the crosswalk text.  Returns modified text."""
    lines = text.splitlines(keepends=True)
    # Track which spells we have already patched (first-occurrence rule).
    patched: dict[str, set[str]] = {}  # classic_name -> set of added lanes

    # Build a quick lookup: {classic_name: [(new_lane, new_anchor), ...]}
    fix_map: dict[str, list[tuple[str, str]]] = {}
    for classic_name, new_lane, new_anchor in fixes:
        fix_map.setdefault(classic_name, []).append((new_lane, new_anchor))

    changes: list[str] = []

    for i, line in enumerate(lines):
        row = parse_row(line.rstrip("\n"))
        if row is None:
            continue
        classic_name = row[0]
        pending = fix_map.get(classic_name)
        if pending is None:
            continue
        already_done = patched.get(classic_name, set())

        # Determine which additions still need to happen (first-occurrence only).
        to_apply = [
            (lane, anchor) for lane, anchor in pending
            if lane not in already_done
        ]
        if not to_apply:
            continue  # second/later occurrence — skip (dedup rule)

        # Parse current columns 3 (Source Books) and 4 (Anchors).
        current_lanes = lanes_from_field(row[2])
        current_anchors = anchors_from_field(row[3])

        new_lanes = list(current_lanes)
        new_anchors = dict(current_anchors)  # lane -> anchor_text

        for new_lane, new_anchor in to_apply:
            if new_lane not in new_lanes:
                new_lanes = insert_in_order(new_lanes, new_lane)
            # Only set the anchor if missing; don't overwrite an existing one.
            if new_lane not in new_anchors:
                new_anchors[new_lane] = new_anchor

        if new_lanes == current_lanes and new_anchors == dict(current_anchors):
            continue  # nothing changed

        # Re-sort lane list to canonical LANE_ORDER (also fixes pre-existing inversions).
        new_lanes.sort(key=_lane_pos)

        # Rebuild the anchor field in LANE_ORDER, preserving abbreviations from
        # the crosswalk cell values (e.g., 'RC' not 'Rules Cyclopedia').
        # Collect all known lane tokens (existing + new) sorted by position.
        all_lane_tokens = list(new_anchors.keys())
        all_lane_tokens.sort(key=_lane_pos)
        anchor_parts: list[str] = []
        for lane in all_lane_tokens:
            anchor_parts.append(f"{lane} -> {new_anchors[lane]}")

        new_sources_field = ", ".join(new_lanes)
        new_anchors_field = "; ".join(anchor_parts)

        old_line = line.rstrip("\n")
        new_cells = [row[0], row[1], new_sources_field, new_anchors_field, row[4], row[5], row[6]]
        new_line = "| " + " | ".join(new_cells) + " |"

        changes.append(f"  {classic_name}: {current_lanes} -> {new_lanes}")
        lines[i] = new_line + ("\n" if line.endswith("\n") else "")

        # Record all lanes we applied (for dedup tracking).
        patched.setdefault(classic_name, set()).update(lane for lane, _ in to_apply)

    if changes:
        print(f"{'[DRY RUN] ' if dry_run else ''}Applied {len(changes)} fix(es):")
        for c in changes:
            print(c)
    else:
        print("No changes needed.")

    return "".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["check", "write"])
    args = parser.parse_args()

    text = open(CROSSWALK, encoding="utf-8").read()
    result = apply_fixes(text, FIXES, dry_run=(args.mode == "check"))

    if args.mode == "write":
        open(CROSSWALK, "w", encoding="utf-8").write(result)
        print(f"Written: {CROSSWALK}")
    else:
        print("(check mode — no files written)")


if __name__ == "__main__":
    main()
