#!/usr/bin/env python3
"""Rebuild Chapter 06 power organization to match the doctrine module structure."""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path


ROOT = Path("/home/joshu/Synthetic-Dream-Machine")
DEFAULT_CHAPTER = ROOT / "Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_06_Powers_and_ECM.md"
DEFAULT_DOCTRINE = ROOT / "_todo/TODO_BECMI_Spell_Effect_Conversion_Doctrine.md"
DEFAULT_OUTPUT = ROOT / "_todo/TODO_Ch06_Temp_Structure.md"

SKIP_MODULES = {
    "ECM – Etheric Counter-Magitech",
    "Ritual Mechanics — Cross-Family Procedures",
    "Immortal Metaphysics",
}

MOVED_RITUAL_SPELLS = {
    "Contingency",
    "Permanence",
    "Symbol",
    "Timestop",
    "Wish",
    "Wizardry",
}

MANUAL_ROUTES = {
    "Entropic Shield": ("Battle, Elements, and Force", "Force"),
    "Shield Ward": ("Battle, Elements, and Force", "Force"),
    "Mage Armor": ("Battle, Elements, and Force", "Force"),
    "Reckless Dweomer": ("Mana, Counterspells, and Jamming", "Mana"),
    "Adaptive Form": ("Biomancy", "Faerie Bodycrafts"),
    "Assimilation Protocol": ("Biomancy", "Faerie Bodycrafts"),
    "Avatar of the Dream": ("Knowledge and Oracle", "Signal and Attunement"),
    "Battle Shell": ("Battle, Elements, and Force", "Force"),
    "Breaker of Waves": ("Battle, Elements, and Force", "Traversal and Passage"),
    "Burrower's Instinct": ("Knowledge and Oracle", "Detection and Analysis"),
    "Call of the Deep": ("Biomancy", "Faerie Bodycrafts"),
    "Crown of the Grave": ("Rites of the Deathless", "Undead Command"),
    "Dream Pounce": ("Battle, Elements, and Force", "Traversal and Passage"),
    "Dream-Skim": ("Knowledge and Oracle", "Signal and Attunement"),
    "Earthshaker": ("Battle, Elements, and Force", "Elemental Earth"),
    "Echo Memory": ("Knowledge and Oracle", "Archive Access"),
    "Echolocation Pulse": ("Knowledge and Oracle", "Detection and Analysis"),
    "Elemental Gift": ("Battle, Elements, and Force", "Force"),
    "Giant Growth": ("Biomancy", "Biotic Augmentation"),
    "Grave-Wrought Gift": ("Rites of the Deathless", "Ka Restoration"),
    "Howl": ("Psychic Warfare", "Fear and Morale"),
    "Laughing Curse": ("Psychic Warfare", "Fear and Morale"),
    "Lizard Leap": ("Battle, Elements, and Force", "Traversal and Passage"),
    "Mist-Woven Hide": ("Illusion and Glamour", "Self-State"),
    "Myrmidon Surge": ("Knowledge and Oracle", "Signal and Attunement"),
    "Overmind Link": ("Knowledge and Oracle", "Signal and Attunement"),
    "Overwatch": ("Knowledge and Oracle", "Detection and Analysis"),
    "Pheromone Beacon": ("Knowledge and Oracle", "Signal and Attunement"),
    "Prey-Binder": ("Summoning and Binding", "Covenant and Binding"),
    "Psychedelic Veil": ("Illusion and Glamour", "Personal Veil"),
    "Shadow Step": ("Battle, Elements, and Force", "Traversal and Passage"),
    "Shadowform": ("Illusion and Glamour", "Self-State"),
    "Shell Craft": ("Alchemy and Artifice", "Fabrication and Artifact Craft"),
    "Soul Anchor": ("Rites of the Deathless", "Resurrection"),
    "Summon Guardian Spirit": ("Summoning and Binding", "Summoning"),
    "Surge": ("Battle, Elements, and Force", "Elemental Water"),
    "Thunder Step": ("Battle, Elements, and Force", "Traversal and Passage"),
    "Venom Bolt": ("Biomancy", "Systemic Treatment"),
    "Warren-Soul": ("Battle, Elements, and Force", "Traversal and Passage"),
}


@dataclass(frozen=True)
class Card:
    name: str
    block: str
    section: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["check", "write"])
    parser.add_argument("--chapter", type=Path, default=DEFAULT_CHAPTER)
    parser.add_argument("--doctrine", type=Path, default=DEFAULT_DOCTRINE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def normalize_label(label: str) -> str:
    label = label.replace("’", "'").replace("–", "-").replace("—", "-")
    return " ".join(label.strip().lower().split())


def alias_forms(label: str) -> set[str]:
    parts = [part.strip() for part in re.split(r"\s*,\s*aka\s+", label, flags=re.I) if part.strip()]
    forms = {normalize_label(label)}
    forms.update(normalize_label(part) for part in parts)
    return forms


def labels_match(left: str, right: str) -> bool:
    return bool(alias_forms(left) & alias_forms(right))


def slugify(text: str) -> str:
    text = text.strip().lower()
    text = text.replace("’", "").replace("'", "")
    text = text.replace("–", "-").replace("—", "-")
    text = re.sub(r"[`*_]", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"[^a-z0-9\-]", "", text)
    text = re.sub(r"\-+", "-", text).strip("-")
    return text


def parse_doctrine(doctrine_text: str) -> tuple[list[str], dict[str, list[str]], dict[str, tuple[str, str]], dict[tuple[str, str], list[str]]]:
    module_order: list[str] = []
    submodule_order: dict[str, list[str]] = {}
    row_routes: dict[str, tuple[str, str]] = {}
    doctrine_rows: dict[tuple[str, str], list[str]] = defaultdict(list)
    current_module: str | None = None
    current_submodule: str | None = None

    for line in doctrine_text.splitlines():
        module_match = re.match(r"^### Module: (.+)$", line)
        if module_match:
            module_name = module_match.group(1)
            current_module = module_name
            current_submodule = None
            if module_name not in SKIP_MODULES:
                module_order.append(module_name)
                submodule_order[module_name] = []
            continue

        submodule_match = re.match(r"^##### (.+)$", line)
        if submodule_match and current_module and current_module not in SKIP_MODULES:
            submodule_name = submodule_match.group(1)
            current_submodule = submodule_name
            module_name = current_module
            submodule_order[module_name].append(submodule_name)
            continue

        if not current_module or current_module in SKIP_MODULES or not current_submodule:
            continue
        if not line.startswith("| ") or line.startswith("| Classic Name ") or line.startswith("| ---"):
            continue

        parts = [part.strip() for part in line.strip("|").split("|")]
        if len(parts) < 4:
            continue
        name = parts[0]
        doctrine_rows[(current_module, current_submodule)].append(name)
        for form in alias_forms(name):
            existing = row_routes.get(form)
            route = (current_module, current_submodule)
            if not existing:
                row_routes[form] = route

    return module_order, submodule_order, row_routes, doctrine_rows


def extract_index_block(chapter_text: str) -> tuple[str, str]:
    start = chapter_text.index("## Chapter 06 Power Index\n")
    end = chapter_text.index("## Using Powers\n")
    return chapter_text[:start], chapter_text[end:]


def split_remainder(remainder_text: str) -> tuple[str, str, str, str]:
    ritual_start = remainder_text.index("# Ritual Mechanics\n")
    immortal_start = remainder_text.index("# Immortal Metaphysics\n")
    cards_start = remainder_text.index("# Battle and Force\n")
    return (
        remainder_text[:ritual_start],
        remainder_text[ritual_start:immortal_start],
        remainder_text[immortal_start:cards_start],
        remainder_text[cards_start:],
    )


def parse_cards(cards_text: str) -> list[Card]:
    section_positions = [(match.start(), match.group(1).strip()) for match in re.finditer(r"^# (.+)$", cards_text, flags=re.M)]
    card_matches = list(
        re.finditer(
            r"<div class=\"power-card\" markdown=\"1\">\n\n(#{2,6}) (.+?)\n(.*?)\n</div>",
            cards_text,
            flags=re.S,
        )
    )
    cards: list[Card] = []
    for match in card_matches:
        section = ""
        for position, heading in section_positions:
            if position < match.start():
                section = heading
            else:
                break
        cards.append(Card(name=match.group(2).strip(), block=match.group(0), section=section))
    return cards


def rewrite_card_heading(block: str) -> str:
    return re.sub(r"^(<div class=\"power-card\" markdown=\"1\">\n\n)#{2,6} ", r"\1### ", block, count=1, flags=re.M)


def route_card(card: Card, row_routes: dict[str, tuple[str, str]]) -> tuple[str, str]:
    for form in alias_forms(card.name):
        if form in row_routes:
            return row_routes[form]
    for manual_name, route in MANUAL_ROUTES.items():
        if labels_match(card.name, manual_name):
            return route
    raise RuntimeError(f"no doctrine route for card: {card.name} (section: {card.section})")


def build_index(module_order: list[str], submodule_order: dict[str, list[str]], grouped_cards: dict[tuple[str, str], list[Card]]) -> str:
    lines = [
        "## Chapter 06 Power Index",
        '<a id="chapter-06-power-index-anchor"></a>',
        "",
        "- [Powers](#powers)",
        "  - [Chapter 06 Power Index](#chapter-06-power-index)",
        "  - [Using Powers](#using-powers)",
        "    - [Activating Powers](#activating-powers)",
        "    - [Skills, Paths, and Powers](#skills-paths-and-powers)",
        "    - [Power Attributes](#power-attributes)",
        "    - [Locked Powers](#locked-powers)",
        "    - [Power Tags](#power-tags)",
        "    - [Powers by Gameplay Scale](#powers-by-gameplay-scale)",
        "- [ECM: Etheric Counter-Magitech](#ecm-etheric-countermagitech)",
        "  - [ECM Tags](#ecm-tags)",
        "  - [ECM at the Table](#ecm-at-the-table)",
        "  - [Charms ([charm] [spoof] [hijack])](#charms-charm-spoof-hijack)",
        "  - [Glamours ([glamour] [spoof] [veil])](#glamours-glamour-spoof-veil)",
        "  - [Illusions ([illusion]  [figment] [spoof] [jam] [veil])](#illusions-illusion--figment-spoof-jam-veil)",
        "  - [Scrying and Anti-Scrying ([scan] [veil] [jam])](#scrying-and-antiscrying-scan-veil-jam)",
        "  - [Veiling and Revealing ([veil] [reveal])](#veiling-and-revealing-veil-reveal)",
        "  - [Jamming Fields ([aversion] [jam] [field])](#jamming-fields-aversion-jam-field)",
        "  - [Counterspells ([negate] [supress] [redirect] [capture] [hijack])](#counterspells-negate-supress-redirect-capture-hijack)",
        "- [Ritual Mechanics](#ritual-mechanics)",
        "  - [Cross-Family Procedures](#cross-family-procedures)",
    ]

    for card in grouped_cards.get(("Ritual Mechanics — Cross-Family Procedures", "Cross-Family Procedures"), []):
        lines.append(f"    - [{card.name}](#{slugify(card.name)})")

    lines.extend(
        [
            "- [Immortal Metaphysics](#immortal-metaphysics)",
            "  - [Rank and Power Economy](#rank-and-power-economy)",
            "  - [Immortal Effect Doctrine](#immortal-effect-doctrine)",
        ]
    )

    for module in module_order:
        module_slug = slugify(module)
        lines.append(f"- [{module}](#{module_slug})")
        for submodule in submodule_order[module]:
            cards = grouped_cards.get((module, submodule), [])
            if not cards:
                continue
            submodule_slug = slugify(submodule)
            lines.append(f"  - [{submodule}](#{submodule_slug})")
            for card in cards:
                lines.append(f"    - [{card.name}](#{slugify(card.name)})")

    return "\n".join(lines) + "\n\n"


def build_modules(module_order: list[str], submodule_order: dict[str, list[str]], grouped_cards: dict[tuple[str, str], list[Card]]) -> str:
    chunks: list[str] = []
    for module in module_order:
        module_chunks = [f"# {module}", ""]
        wrote_module = False
        for submodule in submodule_order[module]:
            cards = grouped_cards.get((module, submodule), [])
            if not cards:
                continue
            wrote_module = True
            module_chunks.append(f"## {submodule}")
            module_chunks.append("")
            for card in cards:
                module_chunks.append(rewrite_card_heading(card.block))
                module_chunks.append("")
        if wrote_module:
            chunks.append("\n".join(module_chunks).rstrip() + "\n")
    return "\n".join(chunks).rstrip() + "\n"


def append_cards_to_block(block_text: str, cards: list[Card]) -> str:
    if not cards:
        return block_text.rstrip() + "\n"
    block = block_text.rstrip() + "\n\n"
    for card in cards:
        block += rewrite_card_heading(card.block) + "\n\n"
    return block.rstrip() + "\n"


def sanitize_ritual_placeholder_rows(block_text: str) -> str:
    cleaned: list[str] = []
    for line in block_text.splitlines():
        match = re.match(r"^\|\s*(.+?)\s*\|", line)
        if match and match.group(1).strip() in MOVED_RITUAL_SPELLS:
            continue
        cleaned.append(line)
    return "\n".join(cleaned) + "\n"


def build_output(chapter_text: str, doctrine_text: str) -> str:
    module_order, submodule_order, row_routes, doctrine_rows = parse_doctrine(doctrine_text)
    prefix, remainder = extract_index_block(chapter_text)
    prelude_text, ritual_block, immortal_block, cards_text = split_remainder(remainder)
    ritual_block = sanitize_ritual_placeholder_rows(ritual_block)
    cards = parse_cards(cards_text)

    cards_by_name = {card.name: card for card in cards}
    routed_cards: dict[tuple[str, str], list[Card]] = defaultdict(list)
    assigned_names: set[str] = set()

    for module in module_order:
        for submodule in submodule_order[module]:
            for doctrine_name in doctrine_rows.get((module, submodule), []):
                for card in cards:
                    if card.name in assigned_names:
                        continue
                    if labels_match(card.name, doctrine_name):
                        routed_cards[(module, submodule)].append(card)
                        assigned_names.add(card.name)
                        break

    unresolved: list[str] = []
    for card in cards:
        if card.name in assigned_names:
            continue
        try:
            module, submodule = route_card(card, row_routes)
        except RuntimeError:
            unresolved.append(f"{card.name} (section: {card.section})")
            continue
        routed_cards[(module, submodule)].append(card)
        assigned_names.add(card.name)

    if unresolved:
        raise RuntimeError("no doctrine route for cards: " + "; ".join(unresolved))

    if len(assigned_names) != len(cards_by_name):
        missing = sorted(set(cards_by_name) - assigned_names)
        raise RuntimeError(f"unassigned cards: {', '.join(missing)}")

    index_block = build_index(module_order, submodule_order, routed_cards)
    modules_block = build_modules(module_order, submodule_order, routed_cards)
    ritual_cards = routed_cards.get(("Ritual Mechanics — Cross-Family Procedures", "Cross-Family Procedures"), [])
    immortal_rank_cards = routed_cards.get(("Immortal Metaphysics", "Rank and Power Economy"), [])
    immortal_effect_cards = routed_cards.get(("Immortal Metaphysics", "Immortal Effect Doctrine"), [])
    ritual_final = append_cards_to_block(ritual_block, ritual_cards)
    immortal_final = append_cards_to_block(immortal_block, immortal_rank_cards + immortal_effect_cards)
    return prefix + index_block + prelude_text + ritual_final + "\n" + immortal_final + "\n" + modules_block


def main() -> int:
    args = parse_args()
    chapter_text = args.chapter.read_text(encoding="utf-8")
    doctrine_text = args.doctrine.read_text(encoding="utf-8")
    rebuilt = build_output(chapter_text, doctrine_text)

    if args.mode == "write":
        args.output.write_text(rebuilt, encoding="utf-8")
        print(f"wrote {args.output}")
        return 0

    if args.output.exists() and args.output.read_text(encoding="utf-8") == rebuilt:
        print(f"no drift: {args.output}")
        return 0
    print(f"drift: {args.output}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())