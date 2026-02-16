# TODO: SDM Gear Index Editorial Normalization Pass

## Status Snapshot
- Extraction/reorganization groundwork is complete.
- Verbatim appendix content has been migrated into `Synthetic_Dream_Machine_05_Gear_Index.md`; appendix file is now a migration log stub.
- Dedupe pass (no synthesis) is in progress for gear-focused cleanup.
- A/B/C migrated corpus has been redistributed from the temporary migration lane into final `Gear Catalogs` subsections.
- `VLG` `WEAPON & BEARER` path material is explicitly out of scope for this chapter.

## Active Scope
- Finalize canonical chapter structure from extracted corpus.
- Resolve duplicate/variant handling decisions.
- Preserve source lineage while moving play-facing content into final locations.
- Validate links/anchors and final chapter flow.

## Active Plan
### Phase 0: Dedupe Gate
- Produce `KEEP-SEPARATE` vs `MERGE-CANDIDATE` decisions with one-line rationale per item family.

### Phase 0 Output (v1 Decisions)
#### KEEP-SEPARATE
| Item Family | Sources | Decision Rationale |
|---|---|---|
| Region-branded weapon catalogs (Blue/Violet/Ruby/Amber) | OGA | Distinct legal/social context and bespoke mechanics; not true duplicates of generic weapon lists. |
| Region-branded clothing/attire sets | OGA | Clothing entries encode setting-specific status, tags, and effects that are not interchangeable. |
| Region-branded travel options | OGA | Named transports are lore-anchored and mechanically distinct from UVG/VLG vehicle chassis. |
| Souvenir/curio tables | OGA, UVG | Similar category, but content function is flavor-forward and intentionally divergent. |
| Traveler services menus | UVG, OGA | Service economies differ in structure and purpose; merge would erase procedural distinctions. |
| Trade goods catalogs | UVG, OGA | Commodity sets represent different markets and source geographies, not duplicate item lists. |
| Corruption/out-of-supplies hazard procedures | UVG | Procedure block is unique support context; no direct equivalent to merge with. |
| Hallmark progression variants | VLG, OGA, ERK | Shared concept but materially different progression rules; keep as selectable profiles. |

#### MERGE-CANDIDATE
| Item Family | Sources | Decision Rationale |
|---|---|---|
| Carry units and money conversion (`sk/st/sp/cash`) | VLG, UVG, ERK, Loot | Semantically identical chassis appears repeatedly; retain one canonical rule block. |
| Inventory slot baselines (`Items 7+STR`, `Traits 7+THO`) | VLG, UVG, ERK | Core rule is repeated with minor wording shifts; safe to canonicalize once. |
| Burden mechanics (`-1 per burden`, overflow behavior) | VLG, ERK | Same mechanical role with compatible expression; merge into one baseline + examples. |
| Market research + haggling loop | UVG, Loot/SDM | Procedural overlap is high; create one canonical transaction loop with optional modifiers. |
| Treasure mass/value handling | UVG, Loot/SDM | Same gameplay domain (valuation, extraction, transport pressure); unify into one section. |
| Core gear taxonomy (goods/tools/armor/weapons/vehicles/services) | VLG, UVG, OGA | Repeated structural taxonomy; normalize one chapter-wide category scaffold. |
| Weapon archetype families (knife/spear/sword/bow/blaster) | VLG, UVG, OGA | Shared mechanical archetypes can be canonical rows with source variants retained beneath. |
| Armor archetype families (light/medium/heavy/special) | VLG, UVG, OGA | Overlapping defensive lanes; merge baseline tiers and preserve source-specific tags. |
| Vehicle stat lanes (capacity/speed/requires/cost) | VLG, UVG, OGA | Comparable schema across books; canonicalize columns and keep source model variants. |
| Cash/asset economy framing | OGA, Loot/SDM | Strong overlap in campaign-economy interface; one canonical economy sidebar is sufficient. |

#### Phase 0 Rule
- For all `MERGE-CANDIDATE` families, preserve source variance as sub-entries under canonical rows; do not delete source-significant constraints (legal tags, rarity tags, setting restrictions).

### Phase 1: Structure Lock
- Finalize main-body section skeleton and section ordering for chapter 05.

### Phase 1 Output (Locked Skeleton v1)
Main body section order for `Synthetic_Dream_Machine_05_Gear_Index.md`:

1. `Canon Boundary` and source method.
2. `Core Units, Inventory, Burdens, Hallmarks`.
3. `Market Research, Pricing, and Liquidation Loop`.
4. `Gear Catalogs`:
   - `General Goods and Kits`
   - `Tools and Services`
   - `Armor`
   - `Weapons`
   - `Vehicles and Mounts`
   - `Implants and Prosthetics`
   - `Curios and Souvenirs`
5. `Economy and Trade Overlays` (cash assets, route operations, financiers, contract play).
6. `Loot and Treasure` integration (anchor: `<a id="sdm-loot-and-treasure"></a>`).
7. `Hazards and Operational Constraints` (optional support procedures).
8. `Working Duplicate / Variant Snapshot`.

Companion verbatim archive: `_todo/TODO_SDM_Gear_Index_Verbatim_Appendix.md`.

### Phase 1 Relocation Targets (No Text Moves Yet)
- `Core Units, Inventory, Burdens, Hallmarks`:
  - VLG inventory/burdens + hallmark blocks.
  - ERK inventory/units/burdens blocks.
  - UVG inventory/units/encumbrance support.
- `Market Research, Pricing, and Liquidation Loop`:
  - Existing chapter market/liquidation section.
  - UVG market research + haggling + trade goods handling procedures.
  - Loot chapter valuation/extraction loops.
- `Gear Catalogs`:
  - VLG equipment chapter tables.
  - UVG gear/services and vehicles/mounts blocks.
  - OGA region catalog tables (kept as source-variant lanes).
- `Economy and Trade Overlays`:
  - OGA cash assets.
  - UVG caravan economics/financiers/trade routes.
  - Existing loot chapter economy interfaces.
- `Hazards and Operational Constraints`:
  - UVG out-of-supplies and corruption support.
  - Any burden-driven operating constraints not already covered above.

### Phase 2: Relocation + Lineage
- Move normalized text/tables into final section locations.
- Add source lineage tags to canonicalized entries (`book`, `heading`, `line anchor`).
- Remove duplicate appendix copies once relocated blocks are anchored in main body.

### Phase 3: Consistency Validation
- Validate internal anchors and inbound links.
- Run duplicate checks in final main body.
- Run flow review for chapter progression (`Gear -> Economy/Market -> Loot/Treasure`).

## Active Checklist
- [x] Phase 0 dedupe gate: produce `KEEP-SEPARATE` vs `MERGE-CANDIDATE` decisions.
- [x] Phase 1 structure lock: finalize section skeleton for chapter main body.
- [x] Phase 2 relocation: move normalized text/tables into final section locations with source lineage tags.
- [x] Phase 3 consistency validation: links, anchors, duplicate checks, and chapter flow review.
- [x] Build duplicate/variant map (`item_name`, `source_count`, `variants`).
- [x] Tag each canonicalized entry with source lineage (`book`, `heading`, `line anchor`).
- [x] Normalize wording around merged loot prose (`chapter` vs `section` references).
- [x] Validate internal anchors and all inbound repo links.
- [x] Run final consistency read for chapter 05 flow (`Gear -> Economy/Market -> Loot/Treasure` interfaces).

## Handoff
- Source-coverage pass plan and execution tracking now live in:
  - `_todo/TODO_SDM_Gear_Index_Source_Coverage.md`

## Archive: Completed Work
- Approved no-synthesis appendix outline.
- Reordered chapter 05 appendix blocks to match that outline.
- Moved `#sdm-loot-and-treasure` block into chapter flow between `Economy and Trade Overlays` and `Hazards and Operational Constraints`.
- Completed Batch 2 extraction pass across VLG/UVG/OGA/ERK context blocks.
- Removed non-gear extraction leftovers and artifact text.
- Deduped relocated source blocks: first occurrence retained in main body, appendix now carries remaining context-only verbatim blocks.
- Moved `Working Duplicate / Variant Snapshot` to main body before the appendix and normalized it to the explicit map schema (`item_name`, `source_count`, `sources`, `variants`).
- Moved the in-chapter verbatim appendix into `_todo/TODO_SDM_Gear_Index_Verbatim_Appendix.md` and finalized chapter section order in `Synthetic_Dream_Machine_05_Gear_Index.md`.

## Archive Note
- Detailed source surveys, intermediate extraction inventory, and earlier reorganization notes are preserved in git history for this file.
