# TODO: BECMI Spell / Effect Crosswalk

This document is the downstream handoff artifact for the completed BECMI spell-material staging corpus.

Purpose:
- track classic spell and effect names across the staged core books
- support Chapter 05 power / spell bridge work
- support the broader `F2: Spells -> Powers` conversion pass

Source corpus:
- `_todo/TODO_BECMI_Spell_Material_Staging_Basic.md`
- `_todo/TODO_BECMI_Spell_Material_Staging_Expert.md`
- `_todo/TODO_BECMI_Spell_Material_Staging_Companion.md`
- `_todo/TODO_BECMI_Spell_Material_Staging_Master.md`
- `_todo/TODO_BECMI_Spell_Material_Staging_Immortals.md`
- `_todo/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md`

Rules for this artifact:
- This is a crosswalk workspace, not a source-text staging file.
- Use the staged corpus as the source of truth; do not copy from PDFs ad hoc.
- Preserve classic names as lookup keys.
- Do not convert terminology to SDM terms until a mapping decision is recorded.
- Creature-specific spellcaster scans remain out of scope for this first pass.

## First-Pass Scope

- Chapter 05-relevant spell and effect names first
- spell and effect names that directly govern magic-item behavior
- supporting doctrine names where the effect itself is procedural rather than a simple spell title

Examples:
- `Dispel Magic`
- `Remove Curse`
- `Spell Catching`
- `Spell Storing`
- `Conjure Elemental`
- `Invisible Stalker`
- `Anti-Magic Shell`

## Suggested Row Fields

Use one row per classic spell or effect name, with these fields:

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Example | RC, Expert | `Chapter 3` / `Spell Research` | spell / effect / item-effect | short source-use note | direct / partial / custom / undecided |

## Mapping Status Vocabulary

- `direct`: likely maps cleanly to an existing SDM/FTLS power or procedure
- `partial`: partly maps, but still needs bridge text or interpretation
- `custom`: likely needs new SDM-compatible power text or item-specific handling
- `undecided`: not reviewed yet

## Immediate Next Work

- seed this crosswalk with the Chapter 05 spell/effect names that appear in item entries
- record at least one source-book anchor for each name from the staged corpus
- defer actual SDM mapping decisions until the bridge pass begins

## Seed Batch A: Chapter 05 Bridge Starters

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Dispel Magic | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures | spell | Recurs as both a direct spell recognizer and a counterforce procedure in item and artifact handling. | undecided |
| Remove Curse | Basic, Expert, Master, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; Master -> Artifact Power Doctrine and Artifact Effect Procedures | spell | Governs curse removal, uncursing thresholds, and several stuck-item or cursed-item release procedures. | undecided |
| Anti-Magic Shell | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures | spell | Appears both as a full spell and as a reusable barrier/item-effect recognizer. | undecided |
| Spell Catching | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items; RC -> Scrolls | item-effect | Scroll behavior with storage-capacity rules, save interaction, and one-spell retention. Likely bridge-heavy rather than direct spell mapping. | partial |
| Spell Storing | Expert, Companion | Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text; Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items | item-effect | Ring/storage behavior that preserves classic recognizer language while needing SDM storage/capacity treatment. | partial |
| Conjure Elemental | Expert, Companion, Immortals, RC | Expert -> Clerical and Magic-User Spell Expansions; Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items | spell | Needed for staff/talisman references and for summon-strength routing via SDM Level. | undecided |
| Invisible Stalker | Expert, Immortals, RC | Expert -> Clerical and Magic-User Spell Expansions; Immortals -> Section 3: Immortal Magic | spell | Summoning recognizer that also appears in item-security and service-context references. | undecided |
| Raise Dead | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | spell | Explicit Chapter 05 bridge example for keeping classic names while replacing internals with SDM Level/Power logic. | undecided |

## Deferred Bundle Notes

- Staff of Power bundle to resolve in the next pass:
	- `Fire Ball`
	- `Lightning Bolt`
	- `Ice Storm`
	- `Continual Light`
	- `Telekinesis`
- Staff of Wizardry bundle to resolve in the next pass:
	- `Invisibility`
	- `Pass-Wall`
	- `Web`
	- `Conjure Elemental`
	- whirlwind / cone of paralyzation riders
- Staff of Elemental Power still needs a dedicated bridge note pass for effect naming and elemental counter-negation phrasing.

## Implementation Notes

- This seed batch is intentionally minimum viable and Chapter 05-driven, not a full spell catalog.
- `partial` is being used where the classic recognizer is clear but the SDM implementation will need storage, retention, trigger, or bearer-language bridge text.
- Use this table as the immediate input to Phase B work in `_todo/TODO_Magitech_Fantascience_Chapter05.md`.
