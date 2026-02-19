# TODO: SDM Rules Consolidation Master

## Intent (Canonical Model)
- Collect existing SDM rules from `Our_Golden_Age`, `Vastlands_Guidebook`, and `Ultraviolet_Grasslands_and_the_Black_City_2e` into two canonical destinations:
  - `Synthetic_Dream_Machine_01_Quickstart.md` (core rules)
  - `Synthetic_Dream_Machine_05_Gear_Index.md` (gear/items/vehicles rules + tables)
- Keep rules single-sourced where possible; use pointers instead of duplicate rule text.
- Use this consolidation as the foundation for stable loot/treasure conversion acceptance criteria and implementation planning.

## Canonical Boundaries

### Quickstart Is Canonical For
- Core play loop and resolution primitives.
- Character fundamentals, advancement, and growth procedures.
- Inventory/burdens/slot logic (core mechanics).
- Hallmark progression and lifecycle procedures.
- Caravan/trade operational procedures (market research, haggling, route play, misfortune loop).

### Gear Index Is Canonical For
- Gear/item/vehicle catalogs and tables.
- Source-variant catalog lanes (where intentionally preserved).
- Gear-specific mechanical references that are not core-system duplicates.
- Pointer hubs that route readers to Quickstart for core mechanics.

## Scope Rules
- No compatibility shim requirement for renamed headings/anchors.
- No synthesis by default during extraction/relocation passes.
- Structural normalization allowed (heading hierarchy, ToC alignment, dedupe of exact/functional duplicates).
- Source lineage tracked in TODO context, not required inline in chapter body.

## Current State (2026-02-18)
- Quickstart has deep ToC and normalized hierarchy.
- Core hallmark rules are in Quickstart under `# INVEST YOUR EXPERIENCE`.
- Growing-through-play rules are in Quickstart and promoted to chapter-level visibility.
- Gear chapter points to Quickstart for core mechanics and caravan/trade procedures.
- Gear chapter remains focused on catalogs/tables and gear-specific rule lanes.
- VLG character-equipment core procedures are canonical in Quickstart (`VLG Character Equipment`, `Slots and Sizes`, `Available Items and Packed Items`, `DROPPING ITEMS`, `IMPROVISING WITH ITEMS`, `STARTING CASH`).
- Gear `Catalog-Derived Rules` now keeps only pointer links for those core procedures.

## Active Work Queue
1. Keep Quickstart/Gear boundary clean:
- remove any newly introduced functional duplicates from Gear.
- preserve gear-owned tables in Gear with Quickstart pointers when appropriate.

2. Maintain heading/anchor stability:
- after heading changes, rebuild ToCs and reconcile internal links.
- update cross-file anchors immediately when headings are renamed.

3. Source maintenance pass (OGA/VLG/UVG):
- verify no core mechanics remain stranded in Gear when they belong in Quickstart.
- verify no catalog/tables remain stranded in Quickstart when they belong in Gear.
4. Character Creation lane follow-up:
- keep `BACKGROUND TRAIT`, `PATH TRAIT`, and `FREE TRAIT` canonical in their index chapters (Traits/Paths), not Quickstart core.
- keep `ONE STRANGE ITEM`, `VLG One Useful Kit`, and other catalog-heavy item tables in Gear.

## Definition of Done
- Quickstart contains canonical core mechanics and caravan procedure blocks.
- Gear contains canonical gear/item/vehicle catalogs and tables.
- No intentional duplicate mechanics remain across both files.
- ToCs in both files resolve cleanly.
- No stale in-repo links to removed/renamed anchors.

## Archive Policy
- This file is now the single active SDM consolidation tracker.
- Legacy phase notes are intentionally retired from active planning.
- Historical detail remains available in git history.
