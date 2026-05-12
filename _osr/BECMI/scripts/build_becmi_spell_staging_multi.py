#!/usr/bin/env python3
"""Build a clean multi-witness Chapter 06 spell staging artifact.

Usage:
    python3 _todo/BECMI/scripts/build_becmi_spell_staging_multi.py check
    python3 _todo/BECMI/scripts/build_becmi_spell_staging_multi.py write
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

# Pull in sibling script without making `_todo/BECMI/scripts/` a package.
sys.path.insert(0, str(Path(__file__).parent))
from fix_staging_fence_apostrophes import fix_fences  # noqa: E402


ROOT = Path("/home/joshu/Synthetic-Dream-Machine")
DEFAULT_CHAPTER = ROOT / "ftls/Flying_Triremes_and_Laser_Swords_06_Powers_and_ECM.md"
DEFAULT_CROSSWALK = ROOT / "_todo/BECMI/TODO_BECMI_Spell_Effect_Crosswalk.md"
DEFAULT_OUTPUT = ROOT / "_todo/BECMI/TODO_BECMI_Spell_Material_Staging.md"
DEFAULT_PRE_ADD = ROOT / "_todo/BECMI/TODO_PRE_ADD_Spell_Staging.md"

LANE_ORDER = [
    "Men & Magic",
    "Greyhawk",
    "Holmes",
    "OD&D Family",
    "Basic",
    "Expert",
    "Companion",
    "Master",
    "Immortals",
    "Rules Cyclopedia",
]

PLAIN_LANE_PATHS = {
    "Basic": ROOT / "_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Basic.md",
    "Expert": ROOT / "_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Expert.md",
    "Companion": ROOT / "_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Companion.md",
    "Master": ROOT / "_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Master.md",
    "Immortals": ROOT / "_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Immortals.md",
    "Rules Cyclopedia": ROOT / "_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md",
}

LANE_SOURCE_LABEL = {
    "Men & Magic": "Men & Magic",
    "Greyhawk": "Greyhawk",
    "Holmes": "Holmes Basic",
    "OD&D Family": "OD&D Family",
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
# Note: do NOT include \[ here. Source staging files use [Page N: ...] annotation
# markers inside code fence bodies; matching those would cut spell blocks prematurely.
GENERIC_HEADING_RE = re.compile(r"^(## |### )")
MASTER_ENTRY_RE = re.compile(r"^\s*\d+\.?\s+\S")
IMMORTALS_ENTRY_RE = re.compile(r"^[A-Z][A-Za-z0-9' /(),.*-]+:")
STRUCTURED_FENCE_RE = re.compile(r'```text id="(?P<id>[^"]+)"\n(?P<body>.*?)\n```', re.S)


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


@dataclass(frozen=True)
class StructuredWitness:
    anchor: str
    target: str
    text: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["check", "write"], help="Check for drift or rewrite the staging file")
    parser.add_argument("--chapter", type=Path, default=DEFAULT_CHAPTER)
    parser.add_argument("--crosswalk", type=Path, default=DEFAULT_CROSSWALK)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--pre-add", type=Path, default=DEFAULT_PRE_ADD)
    return parser.parse_args()


def norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def clean_numbered_entry_label(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"^\d+\.?\s+", "", cleaned)
    cleaned = cleaned.split("(", 1)[0].strip()
    cleaned = re.sub(r"\s*\([^)]*\)\s*$", "", cleaned)
    return cleaned.rstrip("*").strip()


def parse_card_map(chapter_text: str) -> dict[str, str]:
    card_map: dict[str, str] = {}
    for match in re.finditer(r"^### (.+?)\n(.*?)(?=^#{1,3} |\Z)", chapter_text, re.S | re.M):
        title = match.group(1).strip()
        body = match.group(2)
        for spell_name in set(re.findall(r"(?:becmi|odnd):[^;\n]+; spell: ([^\n>]+)", body)):
            card_map[spell_name.strip()] = title
    card_map.update(
        {
            "Fireball": "Fireball",
            "Animal Growth": "Animal Growth",
            "Audible Glamer": "Audible Glamer",
            "Clairaudience": "Clairaudience",
            "Control Temperature 10' Radius": "Control Temperature 10' Radius",
            "Dancing Lights": "Dancing Lights",
            "Darkness": "Darkness",
            "Enlargement": "Enlargement",
            "Finger of Death": "Finger of Death",
            "Invisibility 10' Radius": "Invisibility 10' Radius",
            "Magic Mouth": "Magic Mouth",
            "Passwall": "Passwall",
            "Polymorph Others": "Polymorph Others",
            "Pyrotechnics": "Pyrotechnics",
            "Ray of Enfeeblement": "Ray of Enfeeblement",
            "Slow": "Slow",
            "Speak with Animals": "Speak with Animals",
            "Strength": "Strength",
        }
    )
    return card_map


def normalize_lane_name(raw: str) -> str | None:
    text = raw.strip()
    if not text:
        return None
    mapping = {
        "MM": "Men & Magic",
        "Men & Magic": "Men & Magic",
        "GH": "Greyhawk",
        "Greyhawk": "Greyhawk",
        "HB": "Holmes",
        "Holmes": "Holmes",
        "OD&D": "OD&D Family",
        "OD&D Family": "OD&D Family",
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


def parse_structured_block(body: str) -> tuple[str | None, str | None]:
    lines = body.strip().splitlines()
    target: str | None = None
    text_start = 0
    for index, line in enumerate(lines):
        if line.startswith("Target:"):
            target = line.split(":", 1)[1].strip()
        if target and not line.strip():
            text_start = index + 1
            break
    if not target:
        return None, None
    text = "\n".join(lines[text_start:]).strip()
    return target, text or None


def parse_pre_add_witnesses(pre_add_text: str) -> dict[str, dict[str, StructuredWitness]]:
    lane_prefixes = {
        "mm-": "Men & Magic",
        "gh-": "Greyhawk",
        "hb-": "Holmes",
        "odnd-": "OD&D Family",
    }
    witnesses: dict[str, dict[str, StructuredWitness]] = {lane: {} for lane in lane_prefixes.values()}
    for match in STRUCTURED_FENCE_RE.finditer(pre_add_text):
        block_id = match.group("id")
        lane = next((mapped for prefix, mapped in lane_prefixes.items() if block_id.startswith(prefix)), None)
        if not lane:
            continue
        target, text = parse_structured_block(match.group("body"))
        if not target or not text or text.startswith("{placeholder:"):
            continue
        witnesses[lane][norm(target)] = StructuredWitness(anchor=block_id, target=target, text=text)
    return witnesses


def spell_aliases(classic_name: str, card_heading: str) -> list[str]:
    aliases: list[str] = []
    for candidate in [classic_name, card_heading, *[part.strip() for part in classic_name.split("/")]]:
        if candidate and candidate not in aliases:
            aliases.append(candidate)
    manual = {
        "Control Temperature 10' Radius": ["Control Temperature 10' radius"],
        "Delayed Blast Fireball": ["Delayed Blast Fire Ball", "Delayed Blast Fireball"],
        "Fireball": ["Fire Ball", "Fireball"],
        "Animal Growth": ["Growth of Animal", "Growth of Animals", "Animal Growth"],
        "Ice Storm/Wall": ["Ice Storm/Wall of Ice"],
        "Invisibility 10' Radius": ["Invisibility 10' radius"],
        "Passwall": ["Pass-Wall", "Passwall"],
        "Polymorph Others": ["Polymorph Other", "Polymorph Others"],
        "Darkness": ["Darkness", "Darkness, 5' Radius"],
        "Slow": ["Slow", "Slow Spell"],
        "Speak with Animals": ["Speak with Animals", "Speak with Animal"],
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
            # Spell titles always start with an uppercase letter or a digit (numbered list
            # entry). Skip lowercase-starting lines to avoid matching spell name references
            # that appear mid-sentence inside prose or artifact descriptions.
            if not line_text or not (line_text[0].isupper() or line_text[0].isdigit()):
                continue
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
                # Stop at code fence boundaries to avoid capturing fence markers from the
                # upstream staging documents into the extracted spell block.
                if current.startswith("```"):
                    end = cursor
                    break
                if norm(current_cmp) in known_norms:
                    end = cursor
                    break
                # Stop at staging page-annotation boundary markers, e.g.:
                #   [Companion pages 15-17: druid transition, philosophy...]
                # These delimit section boundaries in the upstream staging docs.
                # Exclude sourcing-note markers such as:
                #   [Expert Set sourcing note (MU1): ... (pages 13-14) ...]
                # which are valid witness content and must be preserved.
                if (
                    current.startswith("[")
                    and re.search(r"\bpage", current, re.I)
                    and "sourcing note" not in current
                ):
                    end = cursor
                    break
                # Stop at a new spell description opener: an uppercase title line
                # immediately followed by a "Range:" field header.  This catches
                # spell-title variants not present in known_norms (e.g. "Protection
                # from Evil 10' Radius" vs. "Protection from Evil") and prevents
                # the extractor from running through multiple sequential spells.
                # Also stop at BECMI spell-level section headers such as
                # "Third-Level Druid Spell", "First Level Clerical Spells", etc.
                # These appear between spell blocks in the Master staging file and
                # must not be absorbed into the preceding spell's witness block.
                if re.match(
                    r"(?:First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth)"
                    r"[-\s]Level\s+(?:Druid|Cleric(?:al)?|Magic-?User|M\.?U\.?)\s+Spell",
                    current, re.I
                ):
                    end = cursor
                    break
                next_line = lines[cursor + 1].strip() if cursor + 1 < len(lines) else ""
                if (
                    current
                    and current[0].isupper()
                    and not current.startswith(("Range:", "Duration:", "Effect:", "["))
                    and not current[0].isdigit()
                    and next_line.startswith("Range:")
                ):
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
        if norm(clean_numbered_entry_label(match.group(1))) in alias_norms:
            blocks.append(stripped)
    return blocks


def collect_master_candidates(lines: list[str], aliases: list[str]) -> list[str]:
    alias_norms = {norm(alias.rstrip("*")) for alias in aliases}
    blocks: list[str] = []
    for index, raw_line in enumerate(lines):
        if "(" not in raw_line:
            continue
        label = clean_numbered_entry_label(raw_line)
        if norm(label) not in alias_norms:
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
            # Stop at a new spell description opener (uppercase title + Range: next line).
            next_line = lines[end + 1].strip() if end + 1 < len(lines) else ""
            if (
                current.strip()
                and current.strip()[0].isupper()
                and not current.strip().startswith(("Range:", "Duration:", "Effect:", "["))
                and not current.strip()[0].isdigit()
                and next_line.startswith("Range:")
            ):
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


def prefer_full_spell_blocks(candidates: list[str]) -> list[str]:
    preferred = [candidate for candidate in candidates if "\n" in candidate or "Range:" in candidate]
    return preferred if preferred else candidates


def prefer_spell_description_block(candidates: list[str]) -> str | None:
    """Return the best candidate that looks like a real BECMI spell description.

    Selection priority:
    1. Blocks that have Range:/Duration:/Effect: header fields AND body prose
       (i.e. at least one non-header line after the header cluster).  Among
       those, prefer the shortest to avoid runaway blocks that captured text
       past the spell boundary.
    2. Blocks that have only the header fields (compact spell-list entries) —
       acceptable if no body-prose block exists.
    3. None if no candidate has Range:/Duration:/Effect: in its opening lines.

    This avoids two failure modes:
      - Runaway overcapture: a non-spell occurrence of the name (e.g. an armor
        table entry) produces a 1000+ line block with no Range: header near
        the top; the filter eliminates it.
      - Over-shortening: a compact indented spell-list entry (4 lines, headers
        only) beats the full description when both have Range: near the top;
        the body-prose requirement makes the full description win instead.
    """
    HEADER_FIELDS = ("Range:", "Duration:", "Effect:")

    def has_header(candidate: str) -> bool:
        lines = candidate.splitlines()
        return any(l.strip().startswith(HEADER_FIELDS) for l in lines[1:8])

    def has_body(candidate: str) -> bool:
        """Return True if there are prose lines after the header cluster."""
        lines = candidate.splitlines()
        in_headers = False
        past_headers = False
        for line in lines[1:]:
            stripped = line.strip()
            if stripped.startswith(HEADER_FIELDS):
                in_headers = True
            elif in_headers and stripped:
                past_headers = True
                break
        return past_headers

    headed = [c for c in candidates if has_header(c)]
    if not headed:
        return None

    with_body = [c for c in headed if has_body(c)]
    pool = with_body if with_body else headed
    return min(pool, key=lambda c: c.count("\n"))


DESCRIPTION_FIELDS_RE = re.compile(r"^(Range|Duration|Effect):", re.M)


def is_description_content(text: str) -> bool:
    """Return True if text looks like a real spell description rather than a bare
    numbered list entry.  A bare entry like '3. Raise Dead Fully*' is noise —
    it comes from a spell-list table, not the spell's description block.
    We accept the text if it is multi-line OR contains at least one of the
    canonical spell-description field headers."""
    if not text or not text.strip():
        return False
    if "\n" in text.strip():
        return True
    return bool(DESCRIPTION_FIELDS_RE.search(text))


def choose_best_block(candidates: list[str], *, prefer_compact_details: bool = False) -> str | None:
    if not candidates:
        return None
    return max(
        candidates,
        key=lambda block: (
            1 if prefer_compact_details and re.search(r"\b(?:R|DR|EF)\b", block) else 0,
            block.count("\n"),
            len(block),
        ),
    )


def extract_witness(
    lane: str,
    lines: list[str],
    structured_witnesses: dict[str, dict[str, StructuredWitness]],
    classic_name: str,
    card_heading: str,
    known_norms: set[str],
) -> str | None:
    aliases = spell_aliases(classic_name, card_heading)
    if lane in structured_witnesses:
        lane_witnesses = structured_witnesses[lane]
        for alias in aliases:
            witness = lane_witnesses.get(norm(alias))
            if witness:
                return witness.text
        return None
    if lane == "Master":
        named_candidates = prefer_full_spell_blocks(collect_named_candidates(lines, aliases, known_norms))
        if named_candidates:
            result = prefer_spell_description_block(named_candidates)
            if result is None:
                # No Range:-headed candidate.  Accept choose_best_block result only
                # if it actually contains spell-description header fields, OR if it is
                # a sourcing-note witness (2-line format documenting that Master Set
                # cross-references this spell without adding a new description).
                # Reject bare cross-reference lists and procedures-section runaways.
                fallback = choose_best_block(named_candidates)
                if fallback and (
                    any(
                        l.strip().startswith(("Range:", "Duration:", "Effect:"))
                        for l in fallback.splitlines()[:10]
                    )
                    or "sourcing note" in fallback
                ):
                    result = fallback
            if result and is_description_content(result):
                return result
        compact_candidates = collect_master_candidates(lines, aliases)
        # Do NOT fall back to bare list entries via collect_list_candidates —
        # those single-line numbered entries are noise; they belong in the
        # lane file's Spell Lists Appendix, not in per-spell witness blocks.
        result = choose_best_block(compact_candidates, prefer_compact_details=True)
        # For compact candidates, require actual spell-description signals.
        # A multi-line block that lacks Range:/Duration:/Effect: headers and the
        # stat-abbreviation pattern is a procedures-section runaway (e.g. the
        # "Reincarnation (C21) / Special Monster Spellcasters / ..." cross-
        # reference cluster), not a compact spell stat entry.  Reject it.
        # Prefer the stat-abbrev candidate if the longest candidate lacks it —
        # choose_best_block maximizes length which may return a bare cost-table
        # entry before the actual (R x, DR y, EF z; Cn) compact form.
        has_description = result and DESCRIPTION_FIELDS_RE.search(result)
        result_flat = result and " ".join(result.split())
        has_stat_abbrev = result_flat and re.search(r"\((?:R|DR|EF)[\s\d']", result_flat)
        if result and not has_description and not has_stat_abbrev:
            # Try to find a better candidate with stat abbreviations
            for c in compact_candidates:
                c_flat = " ".join(c.split())
                if re.search(r"\((?:R|DR|EF)[\s\d']", c_flat):
                    result = c
                    has_stat_abbrev = True
                    break
        if result and (has_description or has_stat_abbrev):
            return result
        return None
    if lane == "Immortals":
        # Immortals lane entries often appear as single-line cross-references in the
        # format "SpellName: See General Notes (...)" — accept any non-empty candidate
        # returned by collect_immortals_candidates without requiring multi-line or
        # Range:/Duration:/Effect: headers.
        return choose_best_block(collect_immortals_candidates(lines, aliases))
    candidates = collect_named_candidates(lines, aliases, known_norms)
    # Do NOT include collect_list_candidates results — bare numbered list entries
    # (e.g. "1. Charm Person") are spell-list noise, not description content.
    # Prefer the shortest candidate whose opening lines contain a Range: header;
    # fall back to choose_best_block only when no headed candidate exists.
    result = prefer_spell_description_block(candidates) or choose_best_block(candidates)
    return result if result and is_description_content(result) else None


def build_output(
    chapter_text: str,
    crosswalk_text: str,
    lane_lines: dict[str, list[str]],
    structured_witnesses: dict[str, dict[str, StructuredWitness]],
) -> str:
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
        "- Witness order is deterministic: Men & Magic, Greyhawk, Holmes, OD&D Family, Basic, Expert, Companion, Master, Immortals, Rules Cyclopedia.",
        "- The staged spell source docs remain the frozen upstream truth; this file is the primary downstream import source for Chapter 06.",
        "",
        "Upstream source files:",
        "- `_todo/BECMI/TODO_PRE_ADD_Spell_Staging.md`",
        "- `_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Basic.md`",
        "- `_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Expert.md`",
        "- `_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Companion.md`",
        "- `_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Master.md`",
        "- `_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Immortals.md`",
        "- `_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md`",
    ]

    for row in rows:
        witnesses: list[Witness] = []
        missing_lanes: list[str] = []
        for lane in row.source_lanes:
            witness_text = extract_witness(
                lane=lane,
                lines=lane_lines.get(lane, []),
                structured_witnesses=structured_witnesses,
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


APPENDIX_SENTINEL = "## Spell Lists Appendix"


def strip_appendix(lines: list[str]) -> list[str]:
    """Return lines with everything from the Spell Lists Appendix sentinel onward
    removed.  This prevents appendix content from being scanned as spell
    description material."""
    for i, line in enumerate(lines):
        if line.strip() == APPENDIX_SENTINEL:
            return lines[:i]
    return lines


def main() -> int:
    args = parse_args()
    chapter_text = args.chapter.read_text(encoding="utf-8")
    crosswalk_text = args.crosswalk.read_text(encoding="utf-8")
    lane_lines = {
        lane: strip_appendix(path.read_text(encoding="utf-8").splitlines())
        for lane, path in PLAIN_LANE_PATHS.items()
    }
    structured_witnesses = parse_pre_add_witnesses(args.pre_add.read_text(encoding="utf-8"))

    rendered = build_output(
        chapter_text=chapter_text,
        crosswalk_text=crosswalk_text,
        lane_lines=lane_lines,
        structured_witnesses=structured_witnesses,
    )
    rendered, _ = fix_fences(rendered)
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
