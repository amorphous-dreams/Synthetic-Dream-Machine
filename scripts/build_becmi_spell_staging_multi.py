#!/usr/bin/env python3
"""Build a clean multi-witness Chapter 06 spell staging artifact.

Usage:
    python3 scripts/build_becmi_spell_staging_multi.py check
    python3 scripts/build_becmi_spell_staging_multi.py write
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path("/home/joshu/Synthetic-Dream-Machine")
DEFAULT_CHAPTER = ROOT / "Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_06_Powers.md"
DEFAULT_CROSSWALK = ROOT / "_todo/TODO_BECMI_Spell_Effect_Crosswalk.md"
DEFAULT_OUTPUT = ROOT / "_todo/TODO_BECMI_Spell_Material_Staging.md"

LANE_ORDER = [
    "Basic",
    "Expert",
    "Companion",
    "Master",
    "Immortals",
    "Rules Cyclopedia",
]

LANE_PATHS = {
    "Basic": ROOT / "_todo/TODO_BECMI_Spell_Material_Staging_Basic.md",
    "Expert": ROOT / "_todo/TODO_BECMI_Spell_Material_Staging_Expert.md",
    "Companion": ROOT / "_todo/TODO_BECMI_Spell_Material_Staging_Companion.md",
    "Master": ROOT / "_todo/TODO_BECMI_Spell_Material_Staging_Master.md",
    "Immortals": ROOT / "_todo/TODO_BECMI_Spell_Material_Staging_Immortals.md",
    "Rules Cyclopedia": ROOT / "_todo/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md",
}

LANE_SOURCE_LABEL = {
    "Basic": "Basic Rules",
    "Expert": "Expert Set",
    "Companion": "Companion Set",
    "Master": "Master Set",
    "Immortals": "Immortals Set",
    "Rules Cyclopedia": "Rules Cyclopedia",
}

LEVEL_HEADING_RE = re.compile(
    r"^\s*(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth) Level .*Spells\s*$",
    re.I,
)
GENERIC_HEADING_RE = re.compile(r"^(## |### |\[)")
MASTER_ENTRY_RE = re.compile(r"^\s+\d+\s+\S")
IMMORTALS_ENTRY_RE = re.compile(r"^[A-Z][A-Za-z0-9' /(),.*-]+:")


@dataclass(frozen=True)
class SpellRow:
    classic_name: str
    source_lanes: list[str]
    anchor_by_lane: dict[str, str]
    card_heading: str


@dataclass(frozen=True)
class Witness:
    lane: str
    source_label: str
    anchor: str
    canonical_key: str
    card_heading: str
    text: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["check", "write"], help="Check for drift or rewrite the staging file")
    parser.add_argument("--chapter", type=Path, default=DEFAULT_CHAPTER)
    parser.add_argument("--crosswalk", type=Path, default=DEFAULT_CROSSWALK)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def parse_card_map(chapter_text: str) -> dict[str, str]:
    card_map: dict[str, str] = {}
    for match in re.finditer(r"^## (.+?)\n(.*?)(?=^## |\Z)", chapter_text, re.S | re.M):
        title = match.group(1).strip()
        body = match.group(2)
        for spell_name in set(re.findall(r"becmi:[^;\n]+; spell: ([^\n>]+)", body)):
            card_map[spell_name.strip()] = title
    card_map.update(
        {
            "Fire Ball / Fireball": "Fireball",
            "Invisibility 10' Radius": "Invisibility 10' Radius",
            "Pass-Wall / Passwall": "Pass-Wall",
            "Polymorph Other / Others": "Polymorph Other",
            "Control Temperature 10' Radius": "Control Temperature 10' Radius",
        }
    )
    return card_map


def normalize_lane_name(raw: str) -> str | None:
    text = raw.strip()
    if not text:
        return None
    mapping = {
        "B": "Basic",
        "Basic": "Basic",
        "E": "Expert",
        "Expert": "Expert",
        "C": "Companion",
        "Companion": "Companion",
        "M": "Master",
        "Master": "Master",
        "I": "Immortals",
        "Immortals": "Immortals",
        "RC": "Rules Cyclopedia",
        "Rules Cyclopedia": "Rules Cyclopedia",
    }
    return mapping.get(text)


def parse_anchor_map(anchor_field: str) -> dict[str, str]:
    anchor_by_lane: dict[str, str] = {}
    for chunk in anchor_field.split(";"):
        if "->" not in chunk:
            continue
        raw_lane, raw_anchor = chunk.split("->", 1)
        lane = normalize_lane_name(raw_lane)
        if lane:
            anchor_by_lane[lane] = raw_anchor.strip()
    return anchor_by_lane


def parse_spell_rows(crosswalk_text: str, chapter_text: str) -> list[SpellRow]:
    card_map = parse_card_map(chapter_text)
    rows: list[SpellRow] = []
    seen: set[str] = set()
    for line in crosswalk_text.splitlines():
        if not line.startswith("| ") or line.startswith("| ---"):
            continue
        parts = [part.strip() for part in line.strip("|").split("|")]
        if len(parts) != 7 or parts[4] != "spell" or parts[5] != "✓":
            continue
        classic_name = parts[0]
        if classic_name in seen:
            continue
        seen.add(classic_name)
        source_lanes = [
            lane
            for lane in LANE_ORDER
            if lane in {
                normalize_lane_name(chunk)
                for chunk in (piece.strip() for piece in parts[2].split(","))
            }
        ]
        card_heading = card_map.get(classic_name)
        if not card_heading:
            raise RuntimeError(f"missing Chapter 06 card mapping for {classic_name}")
        rows.append(
            SpellRow(
                classic_name=classic_name,
                source_lanes=source_lanes,
                anchor_by_lane=parse_anchor_map(parts[3]),
                card_heading=card_heading,
            )
        )
    return rows


def spell_aliases(classic_name: str, card_heading: str) -> list[str]:
    aliases: list[str] = []
    for candidate in [classic_name, card_heading, *[part.strip() for part in classic_name.split("/")]]:
        if candidate and candidate not in aliases:
            aliases.append(candidate)
    manual = {
        "Control Temperature 10' Radius": ["Control Temperature 10' radius"],
        "Delayed Blast Fireball": ["Delayed Blast Fire Ball"],
        "Fire Ball / Fireball": ["Fire Ball", "Fireball"],
        "Ice Storm/Wall": ["Ice Storm/Wall of Ice"],
        "Invisibility 10' Radius": ["Invisibility 10' radius"],
        "Pass-Wall / Passwall": ["Pass-Wall", "Passwall"],
        "Polymorph Other / Others": ["Polymorph Other", "Polymorph Others"],
    }
    for candidate in manual.get(classic_name, []):
        if candidate not in aliases:
            aliases.append(candidate)
    return aliases


def collect_named_candidates(lines: list[str], aliases: list[str], known_norms: set[str]) -> list[str]:
    blocks: list[str] = []
    alias_norms = {norm(alias) for alias in aliases}
    for alias in aliases:
        for index, raw_line in enumerate(lines):
            line_text = raw_line.strip()
            if norm(line_text.rstrip("*")) not in alias_norms:
                continue
            next_window = " ".join(part.strip() for part in lines[index + 1 : index + 8])
            end = len(lines)
            for cursor in range(index + 1, len(lines)):
                current = lines[cursor].strip()
                current_cmp = current.rstrip("*")
                if LEVEL_HEADING_RE.match(current) or GENERIC_HEADING_RE.match(current):
                    end = cursor
                    break
                if norm(current_cmp) in known_norms:
                    end = cursor
                    break
                upcoming = " ".join(part.strip() for part in lines[cursor + 1 : cursor + 8])
                if ("Range:" in upcoming or lines[cursor].strip().startswith("Range:")) and norm(current_cmp) in known_norms:
                    end = cursor
                    break
            block = "\n".join(lines[index:end]).strip("\n")
            if block:
                blocks.append(block)
    return blocks


def collect_list_candidates(lines: list[str], aliases: list[str]) -> list[str]:
    alias_norms = {norm(alias.rstrip("*")) for alias in aliases}
    blocks: list[str] = []
    for raw_line in lines:
        stripped = raw_line.strip()
        match = re.match(r"^\d+\s*\.\s+(.+)$", stripped)
        if not match:
            continue
        if norm(match.group(1).rstrip("*")) in alias_norms:
            blocks.append(stripped)
    return blocks


def collect_master_candidates(lines: list[str], aliases: list[str]) -> list[str]:
    patterns = [re.compile(rf"\b{re.escape(alias)}\b", re.I) for alias in aliases]
    blocks: list[str] = []
    for index, raw_line in enumerate(lines):
        if not any(pattern.search(raw_line) for pattern in patterns):
            continue
        if "(" not in raw_line:
            continue
        start = index
        end = index + 1
        while end < len(lines):
            current = lines[end]
            if not current.strip():
                break
            if MASTER_ENTRY_RE.match(current):
                break
            if LEVEL_HEADING_RE.match(current.strip()) or GENERIC_HEADING_RE.match(current.strip()):
                break
            end += 1
        block = "\n".join(lines[start:end]).strip("\n")
        if block:
            blocks.append(block)
    return blocks


def collect_immortals_candidates(lines: list[str], aliases: list[str]) -> list[str]:
    alias_prefixes = tuple(f"{alias}:" for alias in aliases)
    blocks: list[str] = []
    for index, raw_line in enumerate(lines):
        if not raw_line.startswith(alias_prefixes):
            continue
        start = index
        end = index + 1
        while end < len(lines):
            current = lines[end]
            if not current.strip():
                break
            if IMMORTALS_ENTRY_RE.match(current) and not current.startswith(" "):
                break
            if GENERIC_HEADING_RE.match(current):
                break
            end += 1
        block = "\n".join(lines[start:end]).strip("\n")
        if block:
            blocks.append(block)
    return blocks


def choose_best_block(candidates: list[str]) -> str | None:
    if not candidates:
        return None
    return max(candidates, key=lambda block: (block.count("\n"), len(block)))


def extract_witness(
    lane: str,
    lines: list[str],
    classic_name: str,
    card_heading: str,
    known_norms: set[str],
) -> str | None:
    aliases = spell_aliases(classic_name, card_heading)
    if lane == "Master":
        return choose_best_block(collect_master_candidates(lines, aliases))
    if lane == "Immortals":
        return choose_best_block(collect_immortals_candidates(lines, aliases))
    candidates = collect_named_candidates(lines, aliases, known_norms)
    candidates.extend(collect_list_candidates(lines, aliases))
    return choose_best_block(candidates)


def build_output(chapter_text: str, crosswalk_text: str, lane_lines: dict[str, list[str]]) -> str:
    rows = parse_spell_rows(crosswalk_text, chapter_text)
    known_norms = {norm(alias) for row in rows for alias in spell_aliases(row.classic_name, row.card_heading)}

    parts: list[str] = [
        "# TODO: BECMI Spell Material Staging",
        "",
        "This staging document is the clean downstream aggregation layer for Chapter 06 `osr:` imports.",
        "",
        "Rules for this artifact:",
        "- One canonical spell record per importable Chapter 06 spell.",
        "- Witness text stays literal to the frozen upstream staging docs; no cross-source synthesis or normalization is introduced here.",
        "- Witness order is deterministic: Basic, Expert, Companion, Master, Immortals, Rules Cyclopedia.",
        "- The six lane staging docs remain the frozen upstream truth; this file is the primary downstream import source for Chapter 06.",
        "",
        "Upstream source files:",
        "- `_todo/TODO_BECMI_Spell_Material_Staging_Basic.md`",
        "- `_todo/TODO_BECMI_Spell_Material_Staging_Expert.md`",
        "- `_todo/TODO_BECMI_Spell_Material_Staging_Companion.md`",
        "- `_todo/TODO_BECMI_Spell_Material_Staging_Master.md`",
        "- `_todo/TODO_BECMI_Spell_Material_Staging_Immortals.md`",
        "- `_todo/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md`",
    ]

    for row in rows:
        witnesses: list[Witness] = []
        missing_lanes: list[str] = []
        for lane in row.source_lanes:
            witness_text = extract_witness(
                lane=lane,
                lines=lane_lines[lane],
                classic_name=row.classic_name,
                card_heading=row.card_heading,
                known_norms=known_norms,
            )
            if witness_text is None:
                missing_lanes.append(lane)
                continue
            witnesses.append(
                Witness(
                    lane=lane,
                    source_label=LANE_SOURCE_LABEL[lane],
                    anchor=row.anchor_by_lane.get(lane, "(anchor missing)"),
                    canonical_key=row.classic_name,
                    card_heading=row.card_heading,
                    text=witness_text,
                )
            )

        parts.extend(
            [
                "",
                f"## {row.classic_name}",
                "",
                f"- canonical spell key: `{row.classic_name}`",
                f"- Chapter 06 card heading: `{row.card_heading}`",
                "- expected witness lanes: " + ", ".join(f"`{lane}`" for lane in row.source_lanes),
                "- missing expected witness lanes: "
                + (", ".join(f"`{lane}`" for lane in missing_lanes) if missing_lanes else "`none`"),
                f"- witness count: `{len(witnesses)}`",
            ]
        )
        for witness in witnesses:
            parts.extend(
                [
                    "",
                    f"### Witness: {witness.lane}",
                    "",
                    f"- source lane: `{witness.lane}`",
                    f"- source label: `{witness.source_label}`",
                    f"- staging anchor / section: `{witness.anchor}`",
                    f"- canonical spell key: `{witness.canonical_key}`",
                    f"- Chapter 06 card heading: `{witness.card_heading}`",
                    "",
                    "```text",
                    witness.text,
                    "```",
                ]
            )

    return "\n".join(parts) + "\n"


def main() -> int:
    args = parse_args()
    chapter_text = args.chapter.read_text(encoding="utf-8")
    crosswalk_text = args.crosswalk.read_text(encoding="utf-8")
    lane_lines = {lane: path.read_text(encoding="utf-8").splitlines() for lane, path in LANE_PATHS.items()}

    rendered = build_output(chapter_text=chapter_text, crosswalk_text=crosswalk_text, lane_lines=lane_lines)
    current = args.output.read_text(encoding="utf-8") if args.output.exists() else ""
    drift = rendered != current

    if args.mode == "write":
        args.output.write_text(rendered, encoding="utf-8")
        print(f"drift: {'yes' if drift else 'no'}")
        print(f"output: {args.output}")
        return 0

    print(f"drift: {'yes' if drift else 'no'}")
    print(f"output: {args.output}")
    if drift:
        print(f"staging drift: {args.output}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
