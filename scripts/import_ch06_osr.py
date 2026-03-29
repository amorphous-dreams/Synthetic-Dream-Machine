#!/usr/bin/env python3
"""Deterministically import Chapter 06 `osr:` blocks from staged BECMI witnesses.

Usage:
    python3 scripts/import_ch06_osr.py check
    python3 scripts/import_ch06_osr.py write

The importer reads the Chapter 06 manuscript and the spell/effect crosswalk,
extracts literal spell text from the staged BECMI corpus, and then either:

- `check`: report whether the current files already match the deterministic import
- `write`: rewrite the target files to the deterministic import result

The import contract is RC-first. When the current RC staging lane does not expose
the needed body text, the importer falls back to a staged Companion or Master
witness and records that row as `[needs-review]` in the crosswalk review queue.
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
DEFAULT_RC = ROOT / "_todo/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md"
DEFAULT_COMPANION = ROOT / "_todo/TODO_BECMI_Spell_Material_Staging_Companion.md"
DEFAULT_MASTER = ROOT / "_todo/TODO_BECMI_Spell_Material_Staging_Master.md"

PENDING_TOKEN = "osr:\n(pending verbatim extraction)"
REVIEW_QUEUE_HEADING = "## Chapter 06 `osr:` Import Review Queue\n\n"
REFERENCE_REUSE_MARKER = "## Reference Reuse Targets\n"

LEVEL_HEADING_RE = re.compile(
    r"^\s*(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth) Level .*Spells\s*$",
    re.I,
)
RC_SECTION_RE = re.compile(r"^\[RC page ")


@dataclass(frozen=True)
class ReviewItem:
    classic_name: str
    note: str


@dataclass(frozen=True)
class ImportArtifact:
    chapter_text: str
    crosswalk_text: str
    placeholder_count_before: int
    placeholder_count_after: int
    row_status_counts: dict[str, int]
    review_items: list[ReviewItem]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["check", "write"], help="Check for drift or rewrite files")
    parser.add_argument("--chapter", type=Path, default=DEFAULT_CHAPTER)
    parser.add_argument("--crosswalk", type=Path, default=DEFAULT_CROSSWALK)
    parser.add_argument("--rc", type=Path, default=DEFAULT_RC)
    parser.add_argument("--companion", type=Path, default=DEFAULT_COMPANION)
    parser.add_argument("--master", type=Path, default=DEFAULT_MASTER)
    return parser.parse_args()


def norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def load_lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines()


def parse_spell_rows(crosswalk_text: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for line in crosswalk_text.splitlines():
        if line.startswith("| ") and not line.startswith("| ---"):
            parts = [part.strip() for part in line.strip("|").split("|")]
            if len(parts) == 7 and parts[4] == "spell" and parts[5] == "✓":
                rows.append(parts)
    return rows


def unique_classic_names(rows: list[list[str]]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for row in rows:
        classic_name = row[0]
        if classic_name not in seen:
            seen.add(classic_name)
            ordered.append(classic_name)
    return ordered


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


def build_rc_heading_index(unique_names: list[str], rc_lines: list[str]) -> tuple[dict[str, int], list[int]]:
    manual_rc_key = {
        "Fire Ball / Fireball": "Fireball",
        "Ice Storm/Wall": "Ice Storm/Wall of Ice",
        "Invisibility 10' Radius": "Invisibility 10' radius",
        "Pass-Wall / Passwall": "Passwall",
        "Polymorph Other / Others": "Polymorph Other",
        "Control Temperature 10' Radius": "Control Temperature 10' radius",
    }

    canonical_by_norm: dict[str, str] = {}
    for classic_name in unique_names:
        for alias in [part.strip() for part in classic_name.split("/")]:
            canonical_by_norm[norm(alias)] = classic_name
    for canonical, rc_key in manual_rc_key.items():
        canonical_by_norm[norm(rc_key)] = canonical

    exact_start_by_canonical: dict[str, int] = {}
    all_heading_starts: list[int] = []
    for index, raw_line in enumerate(rc_lines):
        line = raw_line.strip().rstrip("*")
        if index <= 200:
            continue
        canonical = canonical_by_norm.get(norm(line))
        if not canonical:
            continue
        next_window = " ".join(part.strip() for part in rc_lines[index + 1 : index + 8])
        if "Range:" not in next_window:
            continue
        all_heading_starts.append(index)
        exact_start_by_canonical.setdefault(canonical, index)

    all_heading_starts.sort()
    return exact_start_by_canonical, all_heading_starts


def extract_from_lines(lines: list[str], title: str, known_names: set[str]) -> str | None:
    candidates: list[int] = []
    for index, raw_line in enumerate(lines):
        if raw_line.strip().rstrip("*").lower() != title.lower():
            continue
        next_window = " ".join(part.strip() for part in lines[index + 1 : index + 8])
        if "Range:" in next_window:
            candidates.append(index)

    if not candidates:
        return None

    start = candidates[0]
    end = len(lines)
    for cursor in range(start + 1, len(lines)):
        current = lines[cursor].strip()
        current_cmp = current.rstrip("*")
        next_window = " ".join(part.strip() for part in lines[cursor + 1 : cursor + 8])
        if LEVEL_HEADING_RE.match(current) or current.startswith("```") or current.startswith("### ") or current.startswith("["):
            end = cursor
            break
        if "Range:" in next_window and norm(current_cmp) in known_names:
            end = cursor
            break

    return "\n".join(lines[start:end]).strip("\n")


def rc_extract(canonical: str, rc_lines: list[str], start_by_canonical: dict[str, int], all_starts: list[int]) -> str | None:
    start = start_by_canonical.get(canonical)
    if start is None:
        return None

    end = len(rc_lines)
    for candidate in all_starts:
        if candidate > start:
            end = candidate
            break
    for cursor in range(start + 1, len(rc_lines)):
        current = rc_lines[cursor].strip()
        if LEVEL_HEADING_RE.match(current) or RC_SECTION_RE.match(current) or current.startswith("```") or current.startswith("### "):
            end = min(end, cursor)
            break
    return "\n".join(rc_lines[start:end]).strip("\n")


def compute_osr_blocks(
    unique_names: list[str],
    rc_lines: list[str],
    companion_lines: list[str],
    master_lines: list[str],
) -> tuple[dict[str, str], dict[str, str], list[ReviewItem]]:
    start_by_canonical, all_starts = build_rc_heading_index(unique_names, rc_lines)
    manual_source = {
        "Power Word Kill": ("Companion Set", companion_lines, "Power Word Kill"),
        "Shapechange": ("Master Set", master_lines, "Shapechange"),
        "Timestop": ("Master Set", master_lines, "Timestop"),
    }
    known_names = {norm(name) for name in unique_names} | {
        norm("Ice Storm/Wall of Ice"),
        norm("Passwall"),
        norm("Fireball"),
        norm("Polymorph Other"),
        norm("Control Temperature 10' radius"),
        norm("Invisibility 10' radius"),
        norm("Power Word Kill"),
        norm("Shapechange"),
        norm("Timestop"),
    }

    blocks: dict[str, str] = {}
    statuses: dict[str, str] = {}
    review_items: list[ReviewItem] = []

    for classic_name in unique_names:
        block = rc_extract(classic_name, rc_lines, start_by_canonical, all_starts)
        status = "yes"
        note = None

        if block is None:
            source_label, source_lines, title = manual_source[classic_name]
            block = extract_from_lines(source_lines, title, known_names)
            if block is None:
                raise RuntimeError(f"could not extract fallback witness for {classic_name}")
            status = "[needs-review]"
            note = (
                f"Imported from {source_label} witness because the current RC staging lane "
                f"surfaces only list/index evidence for this entry."
            )
        blocks[classic_name] = block
        statuses[classic_name] = status
        if note:
            review_items.append(ReviewItem(classic_name=classic_name, note=note))

    return blocks, statuses, review_items


def apply_osr_blocks(chapter_text: str, card_map: dict[str, str], blocks: dict[str, str], ordered_names: list[str]) -> str:
    updated = chapter_text
    for classic_name in ordered_names:
        heading = card_map.get(classic_name)
        if not heading:
            raise RuntimeError(f"no Chapter 06 card mapping for {classic_name}")
        anchor = f"## {heading}\n"
        start = updated.find(anchor)
        if start == -1:
            raise RuntimeError(f"missing Chapter 06 heading for {heading}")
        end = updated.find("\n## ", start + len(anchor))
        if end == -1:
            end = len(updated)
        card_block = updated[start:end]
        osr_match = re.search(
            r"(osr:\n)(.*?)(\n(?:\n  <div class=\"power-return\">|<div style=\"text-align: right\">))",
            card_block,
            flags=re.S,
        )
        if not osr_match:
            raise RuntimeError(f"osr block not found in card {heading}")
        new_card = (
            card_block[: osr_match.start()]
            + osr_match.group(1)
            + blocks[classic_name]
            + osr_match.group(3)
            + card_block[osr_match.end() :]
        )
        updated = updated[:start] + new_card + updated[end:]
    return updated


def update_crosswalk(crosswalk_text: str, statuses: dict[str, str], review_items: list[ReviewItem]) -> str:
    updated_lines: list[str] = []
    for line in crosswalk_text.splitlines():
        if line.startswith("| ") and not line.startswith("| ---"):
            parts = [part.strip() for part in line.strip("|").split("|")]
            if len(parts) == 7 and parts[4] == "spell" and parts[5] == "✓":
                parts[6] = statuses[parts[0]]
                line = "| " + " | ".join(parts) + " |"
        updated_lines.append(line)

    review_queue = REVIEW_QUEUE_HEADING + "\n".join(
        f"- `{item.classic_name}`: {item.note}" for item in review_items
    ) + "\n\n"
    updated = "\n".join(updated_lines)
    if REVIEW_QUEUE_HEADING in updated:
        updated = re.sub(
            r"## Chapter 06 `osr:` Import Review Queue\n\n.*?\n(?=## Reference Reuse Targets\n)",
            review_queue,
            updated,
            flags=re.S,
        )
    else:
        updated = updated.replace(REFERENCE_REUSE_MARKER, review_queue + REFERENCE_REUSE_MARKER)
    return updated


def build_artifact(
    chapter_text: str,
    crosswalk_text: str,
    rc_lines: list[str],
    companion_lines: list[str],
    master_lines: list[str],
) -> ImportArtifact:
    rows = parse_spell_rows(crosswalk_text)
    ordered_names = unique_classic_names(rows)
    card_map = parse_card_map(chapter_text)
    blocks, statuses, review_items = compute_osr_blocks(ordered_names, rc_lines, companion_lines, master_lines)

    new_chapter = apply_osr_blocks(chapter_text, card_map, blocks, ordered_names)
    new_crosswalk = update_crosswalk(crosswalk_text, statuses, review_items)

    row_status_counts: dict[str, int] = {}
    for row in rows:
        status = statuses[row[0]]
        row_status_counts[status] = row_status_counts.get(status, 0) + 1

    return ImportArtifact(
        chapter_text=new_chapter,
        crosswalk_text=new_crosswalk,
        placeholder_count_before=chapter_text.count("(pending verbatim extraction)"),
        placeholder_count_after=new_chapter.count("(pending verbatim extraction)"),
        row_status_counts=row_status_counts,
        review_items=review_items,
    )


def print_summary(artifact: ImportArtifact, drift: bool) -> None:
    print(f"placeholders before: {artifact.placeholder_count_before}")
    print(f"placeholders after: {artifact.placeholder_count_after}")
    print(f"crosswalk statuses: {artifact.row_status_counts}")
    if artifact.review_items:
        print("review queue:")
        for item in artifact.review_items:
            print(f"  - {item.classic_name}")
    print(f"drift: {'yes' if drift else 'no'}")


def main() -> int:
    args = parse_args()

    chapter_text = args.chapter.read_text(encoding="utf-8")
    crosswalk_text = args.crosswalk.read_text(encoding="utf-8")
    artifact = build_artifact(
        chapter_text=chapter_text,
        crosswalk_text=crosswalk_text,
        rc_lines=load_lines(args.rc),
        companion_lines=load_lines(args.companion),
        master_lines=load_lines(args.master),
    )

    chapter_drift = artifact.chapter_text != chapter_text
    crosswalk_drift = artifact.crosswalk_text != crosswalk_text
    drift = chapter_drift or crosswalk_drift

    if args.mode == "write":
        args.chapter.write_text(artifact.chapter_text, encoding="utf-8")
        args.crosswalk.write_text(artifact.crosswalk_text, encoding="utf-8")
        print_summary(artifact, drift)
        return 0

    print_summary(artifact, drift)
    if drift:
        if chapter_drift:
            print(f"chapter drift: {args.chapter}", file=sys.stderr)
        if crosswalk_drift:
            print(f"crosswalk drift: {args.crosswalk}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
