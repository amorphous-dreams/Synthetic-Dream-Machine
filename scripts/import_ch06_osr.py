#!/usr/bin/env python3
"""Deterministically import Chapter 06 `osr:` blocks from staged BECMI witnesses.

Usage:
    python3 scripts/import_ch06_osr.py check
    python3 scripts/import_ch06_osr.py write
    python3 scripts/import_ch06_osr.py check --card "Magic Missile"
    python3 scripts/import_ch06_osr.py write --card "Magic Missile"
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path("/home/joshu/Synthetic-Dream-Machine")
DEFAULT_CHAPTER = ROOT / "Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_06_Powers_and_ECM.md"
DEFAULT_CROSSWALK = ROOT / "_todo/TODO_BECMI_Spell_Effect_Crosswalk.md"
DEFAULT_STAGING = ROOT / "_todo/TODO_BECMI_Spell_Material_Staging.md"

PENDING_TOKEN = "osr:\n(pending verbatim extraction)"
REVIEW_QUEUE_HEADING = "## Chapter 06 `osr:` Import Review Queue\n\n"
REFERENCE_REUSE_MARKER = "## Reference Reuse Targets\n"
REVIEW_LINE_RE = re.compile(r"^- `(.+?)`: (.+)$")


@dataclass(frozen=True)
class ReviewItem:
    classic_name: str
    note: str


@dataclass(frozen=True)
class Witness:
    lane: str
    anchor: str
    text: str


@dataclass(frozen=True)
class Record:
    classic_name: str
    card_heading: str
    expected_lanes: list[str]
    missing_lanes: list[str]
    witnesses: list[Witness]


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
    parser.add_argument("--staging", type=Path, default=DEFAULT_STAGING)
    parser.add_argument("--card", help="Exact Chapter 06 heading to update")
    return parser.parse_args()


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


def parse_records(staging_text: str) -> dict[str, Record]:
    records: dict[str, Record] = {}
    for match in re.finditer(r"^## (.+?)\n(.*?)(?=^## |\Z)", staging_text, flags=re.S | re.M):
        classic_name = match.group(1).strip()
        body = match.group(2)
        card_heading = extract_metadata_value(body, "Chapter 06 card heading")
        expected_lanes = extract_backtick_list(body, "expected witness lanes")
        missing_lanes = extract_backtick_list(body, "missing expected witness lanes")
        if missing_lanes == ["none"]:
            missing_lanes = []

        witnesses: list[Witness] = []
        for witness_match in re.finditer(r"^### Witness: (.+?)\n(.*?)(?=^### |\Z)", body, flags=re.S | re.M):
            witness_body = witness_match.group(2)
            lane = extract_metadata_value(witness_body, "source lane")
            anchor = extract_metadata_value(witness_body, "staging anchor / section")
            text_match = re.search(r"```text\n(.*?)\n```", witness_body, flags=re.S)
            if not text_match:
                raise RuntimeError(f"missing fenced witness text for {classic_name} / {lane}")
            witnesses.append(Witness(lane=lane, anchor=anchor, text=text_match.group(1)))

        records[classic_name] = Record(
            classic_name=classic_name,
            card_heading=card_heading,
            expected_lanes=expected_lanes,
            missing_lanes=missing_lanes,
            witnesses=witnesses,
        )
    return records


def extract_metadata_value(body: str, field: str) -> str:
    match = re.search(rf"^- {re.escape(field)}: `(.+?)`$", body, flags=re.M)
    if not match:
        raise RuntimeError(f"missing metadata field: {field}")
    return match.group(1)


def extract_backtick_list(body: str, field: str) -> list[str]:
    match = re.search(rf"^- {re.escape(field)}: (.+)$", body, flags=re.M)
    if not match:
        raise RuntimeError(f"missing list field: {field}")
    return re.findall(r"`([^`]+)`", match.group(1))


def select_names(ordered_names: list[str], records: dict[str, Record], target_card: str | None) -> list[str]:
    if not target_card:
        return ordered_names
    selected = [name for name in ordered_names if records[name].card_heading == target_card]
    if not selected:
        raise RuntimeError(f'no Chapter 06 spell card found for --card "{target_card}"')
    return selected


def render_osr_block(record: Record) -> str:
    if not record.witnesses:
        return "(pending verbatim extraction)"

    rendered: list[str] = []
    for witness in record.witnesses:
        rendered.append(f"[{witness.lane} | {witness.anchor}]")
        rendered.append(witness.text)
        rendered.append("")
    return "\n".join(rendered).rstrip()


def has_complete_witness_coverage(record: Record) -> bool:
    expected = set(record.expected_lanes) - set(record.missing_lanes)
    actual = {witness.lane for witness in record.witnesses}
    return actual == expected


def apply_osr_blocks(chapter_text: str, records: dict[str, Record], selected_names: list[str]) -> str:
    updated = chapter_text
    for classic_name in selected_names:
        record = records[classic_name]
        heading = record.card_heading
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
            + render_osr_block(record)
            + osr_match.group(3)
            + card_block[osr_match.end() :]
        )
        updated = updated[:start] + new_card + updated[end:]
    return updated


def record_status(record: Record) -> str:
    return "yes" if record.witnesses and not record.missing_lanes and has_complete_witness_coverage(record) else "[needs-review]"


def record_review_item(record: Record) -> ReviewItem | None:
    if not record.witnesses:
        return ReviewItem(record.classic_name, "no witness text extracted from the clean staging file")
    if record.missing_lanes:
        missing = ", ".join(record.missing_lanes)
        return ReviewItem(record.classic_name, f"missing expected witness lanes in clean staging: {missing}")
    if not has_complete_witness_coverage(record):
        actual = ", ".join(witness.lane for witness in record.witnesses) or "none"
        expected = ", ".join(lane for lane in record.expected_lanes if lane not in record.missing_lanes) or "none"
        return ReviewItem(record.classic_name, f"staging witness coverage mismatch: expected {expected}; found {actual}")
    return None


def parse_existing_review_items(crosswalk_text: str) -> dict[str, str]:
    section_match = re.search(
        r"## Chapter 06 `osr:` Import Review Queue\n\n(.*?)(?=\n## Reference Reuse Targets\n)",
        crosswalk_text,
        flags=re.S,
    )
    if not section_match:
        return {}
    items: dict[str, str] = {}
    for line in section_match.group(1).splitlines():
        match = REVIEW_LINE_RE.match(line.strip())
        if match:
            items[match.group(1)] = match.group(2)
    return items


def update_crosswalk(
    crosswalk_text: str,
    statuses: dict[str, str],
    review_items: list[ReviewItem],
    selected_names: list[str],
    bulk_mode: bool,
) -> str:
    selected_set = set(selected_names)
    updated_lines: list[str] = []
    for line in crosswalk_text.splitlines():
        if line.startswith("| ") and not line.startswith("| ---"):
            parts = [part.strip() for part in line.strip("|").split("|")]
            if len(parts) == 7 and parts[4] == "spell" and parts[5] == "✓" and parts[0] in selected_set:
                parts[6] = statuses[parts[0]]
                line = "| " + " | ".join(parts) + " |"
        updated_lines.append(line)

    review_map = {} if bulk_mode else parse_existing_review_items(crosswalk_text)
    for classic_name in selected_names:
        review_map.pop(classic_name, None)
    for item in review_items:
        review_map[item.classic_name] = item.note

    review_lines = [f"- `{name}`: {review_map[name]}" for name in sorted(review_map)]
    review_queue = REVIEW_QUEUE_HEADING + "\n".join(review_lines) + "\n\n"

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
    staging_text: str,
    target_card: str | None,
) -> ImportArtifact:
    rows = parse_spell_rows(crosswalk_text)
    ordered_names = unique_classic_names(rows)
    records = parse_records(staging_text)
    missing_records = [name for name in ordered_names if name not in records]
    if missing_records:
        missing = ", ".join(missing_records[:10])
        raise RuntimeError(f"missing clean staging records for: {missing}")

    selected_names = select_names(ordered_names, records, target_card)
    statuses = {name: record_status(records[name]) for name in selected_names}
    review_items = [item for name in selected_names if (item := record_review_item(records[name]))]

    new_chapter = apply_osr_blocks(chapter_text, records, selected_names)
    new_crosswalk = update_crosswalk(
        crosswalk_text=crosswalk_text,
        statuses=statuses,
        review_items=review_items,
        selected_names=selected_names,
        bulk_mode=target_card is None,
    )

    row_status_counts: dict[str, int] = {}
    for name in selected_names:
        status = statuses[name]
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
    staging_text = args.staging.read_text(encoding="utf-8")
    artifact = build_artifact(
        chapter_text=chapter_text,
        crosswalk_text=crosswalk_text,
        staging_text=staging_text,
        target_card=args.card,
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
