# TODO: BECMI -> SDM Magic Item Conversion (Chapter 05+)

## Intent
Convert BECMI/RC magic-item procedures into SDM chapter-ready form using the current canonical SDM model:
- Core mechanics baseline: `Synthetic_Dream_Machine_01_Quickstart.md`
- Gear/item/vehicle table surface: `Synthetic_Dream_Machine_05_Gear_Index.md` (near-final, catalog-focused)
- Conversion-governance master: `_todo/TODO_BECMI_Conversion.md`
- Loot integration acceptance: `_todo/TODO_Loot_Treasure_Conversion.md`

This TODO is the execution tracker for magic-item conversion specifically.

## Canonical Context (Locked)

### Baseline Ownership
- Quickstart owns core mechanics (inventory, advancement, hallmark lifecycle, caravan/trade core procedures).
- Gear Index owns gear/item/vehicle catalogs and gear tables.
- Magic-item generation and adjudication depth belongs in Chapter 05 magitech/fantascience lane.

### Scope Boundary
- This pass converts BECMI/RC magic-item procedure behavior into SDM structure.
- This pass does not re-open Quickstart core rules or Gear catalog ownership.
- Domain/tax systems remain out of scope for this pass.

### Alignment Priority
- `Synthetic_Dream_Machine_05_Gear_Index.md` controls item-facing presentation:
  - tags,
  - bulk,
  - slot pressure,
  - ward/armor language,
  - catalog-facing output format.
- `Vastlands_Guidebook/Vastlands_Guidebook.md` controls everyday weird-gear tone:
  - wards,
  - albums,
  - strange items,
  - mods,
  - portable occult gear.
- `Our_Golden_Age/Our_Golden_Age.md` controls relic consequence and metaphysical pressure:
  - shrines,
  - godsign,
  - signals,
  - daemon/noosphere interfaces,
  - buildertech,
  - seizure-worthy apparatus.
- BECMI/RC remains the recognizable procedural substrate, not the dominant chapter identity.
- UVG and Magitecnica remain support sources only where they sharpen oldtech texture or power-boundary handling.

## Conversion Goals
1. Preserve recognizable RC/BECMI procedural cadence for item generation and handling.
2. Express converted procedure steps in SDM-native language and anchor structure.
3. Keep Chapter 05 as single source of truth for detailed magic-item generation flow.
4. Keep Loot and Gear chapters pointer-driven for magic-item generation details.
5. Reduce adjudication ambiguity while keeping optional compatibility overlays explicit.

## Conversion Standards
- Mechanics-first, terminology-second:
  - first convert procedure behavior; then normalize naming where appropriate.
- No core-rule duplication:
  - do not restate Quickstart core mechanics unless required as a concise pointer.
- Gear consistency:
  - when a procedure depends on item classes/tables, route to Gear anchors.
- Overlay discipline:
  - each RC/BECMI compatibility behavior must be optional and disableable.
- Traceability:
  - each converted subsection should map to source family and canonical SDM destination anchor.

## Source Inputs
- Primary conversion source:
  - `_becmi/TSR 1071 - The D&D Rules Cyclopedia.pdf` (magic-item procedure bands)
- SDM context sources:
  - `Our_Golden_Age/Our_Golden_Age.md`
  - `Vastlands_Guidebook/Vastlands_Guidebook.md`
  - `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md`
- Canonical destination references:
  - `Synthetic_Dream_Machine_01_Quickstart.md`
  - `Synthetic_Dream_Machine_05_Gear_Index.md`

## Chapter Targets
- Primary chapter target:
  - `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_05_Magitech_and_Fantascience.md`
- Pointer-only chapter target:
  - `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_09_Loot_and_Treasure.md`

## Active Work Plan

### Phase 1: Procedure Inventory and Crosswalk
- [x] Build family-level crosswalk for magic-item procedures:
  - generation,
  - identification,
  - charges/consumption,
  - curse/complication handling,
  - creation/fabrication,
  - market buy/sell handling.
- [x] Mark each family as:
  - `direct map`,
  - `partial map`,
  - `custom SDM procedure needed`.
- [x] Assign each item family to a primary FTLS lane:
  - field gear and practical weird objects,
  - relics, buildertech, and restricted apparatus,
  - conversion, modding, faults, and curses.

### Phase 2: Chapter 05 Procedure Consolidation
- [x] Consolidate the chapter front-end around an FTLS object loop and SDM item output record.
- [x] Add a Phase 1 overlay spine:
  - `FTLS Object Procedure`,
  - `Object Families Catalog`,
  - `Legacy Recognizers and Old-School Effect Coverage`.
- [x] Keep strong old-school recognizers in the intermediate chapter state:
  - named effects,
  - iconic item behaviors,
  - familiar family subtables and weapon riders.
- [x] Convert first family slices into stronger FTLS catalog entries while keeping dense import support:
  - potions / oils / elixirs,
  - scrolls / formulae / map-documents.
- [x] Convert next family slices into stronger FTLS catalog entries while keeping dense import support:
  - wands / staves / rods,
  - rings / amulets / charms.
- [x] Convert next family slices into stronger FTLS catalog entries while keeping dense import support:
  - miscellaneous items / strange items / oddities,
  - armor / shields / wards.
- [x] Convert weapon family slices into stronger FTLS catalog entries while keeping dense import support:
  - missile weapons / missiles,
  - swords,
  - miscellaneous weapons.
- [x] Consolidate the detailed middle of Chapter 05 into legacy support bands:
  - generation support,
  - identification and use support,
  - risk and fallout support,
  - retention and conversion support,
  - legacy family effect coverage.
- [x] Ensure chapter internal structure follows runnable loop order:
  - generate -> identify -> activate/use -> deplete/fail/curse -> repair/create -> market interface.
- [x] Add explicit boundary pointers to Chapters 04, 06, 07, and 09.
- [x] Remove/replace any duplicate procedure text in other chapters with pointers.
- [x] Promote shared family-resolution and item-use defaults from legacy support into the core `Anomolous Object Procedure`.
- [x] Upgrade family catalog blocks into runnable mini-procedures for common imported items.
- [x] Add compact FTLS resolver inserts for armor, ranged weapons, swords, and weapon secondary riders.
- [x] Demote legacy support bands to secondary expansion status instead of primary ownership.

### Phase 3: Gear/Quickstart Alignment
- [ ] Verify no converted magic-item procedure conflicts with Quickstart core mechanics.
- [x] Re-anchor Chapter 05 outputs to Gear Index-facing fields:
  - object name,
  - class/family,
  - tags,
  - bulk/slot pressure,
  - trigger mode,
  - usage model,
  - risk note,
  - company consequence,
  - legal/faction/divine attention.
- [ ] Verify table/category references align with current Gear Index headings/anchors.
- [ ] Keep hallmark progression references aligned with Quickstart canonical upgrade model.

### Phase 4: Loot Handoff Validation
- [x] Ensure Loot/Treasure chapter uses handoff references to Chapter 05 (not duplicate generation logic).
- [ ] Validate end-to-end flow:
  - treasure result -> magic-item handoff -> generation/adjudication -> table-facing outcome.

### Phase 5: Optional Terminology Normalization
- [ ] Apply controlled RC-term -> SDM-term naming normalization only after mechanics are stable.
- [ ] Keep legacy aliases where mapping confidence is medium/low.
- [x] Add doctrine notes for VLG-first gear tone, OGA-first relic consequence, and Gear Index-first item presentation.

## Acceptance Criteria

### A. Canonical Ownership
- Chapter 05 contains complete magic-item generation/adjudication procedure.
- Gear/Quickstart do not contain conflicting duplicate magic-item procedures.

### B. Runnable Procedure Quality
- Referee can run item generation and use handling from Chapter 05 without missing steps.
- Procedure order is explicit and consistent.
- Converted item families resolve into SDM-facing object records rather than naked RC results.

### C. Cross-Chapter Integrity
- Gear and Loot references to Chapter 05 anchors resolve.
- No stale links to retired headings or superseded sections.

### D. Compatibility Overlay Safety
- RC/BECMI-specific behaviors are clearly marked optional.
- Baseline SDM behavior remains coherent with overlays disabled.

## Validation Checklist
- [ ] Crosswalk completeness reviewed for all targeted magic-item families.
- [ ] Chapter 05 flow run-through completed for at least 3 item families.
- [ ] Pointer integrity verified from Gear and Loot docs.
- [ ] Anchor/link check passes across touched markdown files.
- [ ] No baseline core-rule drift introduced in Quickstart.

## Dependencies and Coordination
- Depends on boundary lock in `_todo/TODO_SDM_Gear_Index_Master.md`.
- Must stay compatible with acceptance model in `_todo/TODO_Loot_Treasure_Conversion.md`.
- Must follow overlay standards in `_todo/TODO_BECMI_Conversion.md`.

## Out of Scope
- Full spells -> powers conversion (tracked in `_todo/TODO_BECMI_Conversion.md`, future pass F2).
- Broad economy rebalance beyond magic-item procedure requirements.
- Domain play integration.
