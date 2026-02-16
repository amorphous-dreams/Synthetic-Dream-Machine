# TODO: SDM Gear Index Master

## Purpose
Single source of truth for SDM Gear Index planning, coverage tracking, editorial normalization, and migration history.

## Current State
- Chapter target: `Synthetic_Dream_Machine_05_Gear_Index.md`.
- Last sync update: `2026-02-16`.
- Verbatim extraction and relocation across OGA/VLG/UVG/ERK (+ Magitecnica) is complete.
- A/B/C migrated corpus has been redistributed from temporary migration lanes into final `Gear Catalogs` subsections.
- Source coverage for P1/P2 is complete; only optional P3 context remains.
- `VLG` `WEAPON & BEARER` is explicitly out-of-scope for Gear Index (Path material).
- Reorganization pass #2 is complete (structural dedupe only, no synthesis), with top-level chapter flow now split into:
  - `# SDM Gear Table of Contents`
  - `# SDM Gear Rules`
  - `# SDM Gear Index`
- Rules/mechanics and meta content are centralized in `# SDM Gear Rules`; catalog entries and catalog prose are centralized in `# SDM Gear Index`.
- `### Gear-Anchored Power Mechanics` now lives only in `# SDM Gear Rules`; index-side reference stubs for this block have been removed.
- `### Market Research and Liquidation` is positioned inside `## Economy and Trade Overlays`.
- Source provenance markers were moved out of chapter body into this TODO (`## Chapter Source Marker Archive`) to keep chapter reorganization unconstrained.
- Deep table of contents is present near chapter top and has been regenerated to match current headings/anchors after each reorg pass.
- Anchor map changed with normalization and section renames; inbound repo links are updated directly (no compatibility shim).

## Chapter Source Marker Archive
Moved from `Synthetic_Dream_Machine_05_Gear_Index.md` on 2026-02-16.

```text
> Source: Vastlands_Guidebook/Vastlands_Guidebook.md (## INVENTORY + ### BURDENS, lines ~1099-1155)
> Source: Vastlands_Guidebook/Vastlands_Guidebook.md (### Investing in Hallmarks context, lines ~1297-1331)
> Source: Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md (### Inventory + level context, lines ~467-491)
> Source: Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md (### Inventory and Sacks cluster, lines ~5669-5755)
> Source: Our_Golden_Age/Our_Golden_Age.md (## UPGRADE YOUR ITEMS cluster, lines ~1048-1116)
> Source: `Eternal_Return_Key/Eternal_Return_Key.md` (`### M. Inventory` + `#### UNITS OF MATTER`, lines ~1036-1065)
> Source: Eternal_Return_Key/Eternal_Return_Key.md (#### DAMAGE IMPOSES BURDENS, lines ~1197-1203)
> Source: `Magitecnica/Magitecnica_01_Codex_1_The_Use_and_Misuse_of_Powers_Great_and_Small.md` (`IV.c. Carrying Powers (Inventory)`, lines ~200-213)
> Source: `Magitecnica/Magitecnica_02_Codex_2_The_Flesh_Source_Protocols.md` (`BURDEN SHARE`, lines ~822-831)
> Source: Vastlands_Guidebook/Vastlands_Guidebook.md (# EQUIPMENT through pre-# POWERS, lines ~2615-3893)
> Source: `Vastlands_Guidebook/Vastlands_Guidebook.md` (`## CHARACTER EQUIPMENT` through `## OTHER ATTRIBUTES`, lines ~719-923)
> Source: `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` (`## Gear & Services` through service subsections, lines ~6995-7294)
> Source: Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md (## Vehicles & Mounts through transport fixes, lines ~6309-6994)
> Source: `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` (`## Gear & Services` through service subsections, lines ~6995-7294)
> Source: Vastlands_Guidebook/Vastlands_Guidebook.md (# EQUIPMENT through pre-# POWERS, lines ~2615-3893)
> Source: `Magitecnica/Magitecnica_01_Codex_1_The_Use_and_Misuse_of_Powers_Great_and_Small.md` (`D. The Viridian Practice` features + anchor weapon powers, lines ~934-944 and ~968-1032)
> Source: `Magitecnica/Magitecnica_02_Codex_2_The_Flesh_Source_Protocols.md` (`NUNKA'S EPIDERMAL SCULPT`, lines ~657-701)
> Source: `Magitecnica/Magitecnica_02_Codex_2_The_Flesh_Source_Protocols.md` (`NUNKA'S WEAPON MORPH`, lines ~634-653)
> Source: Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md (### Burdenbeast Modification, lines ~7473-7481)
> Source: Vastlands_Guidebook/Vastlands_Guidebook.md (# EQUIPMENT through pre-# POWERS, lines ~2615-3893)
> Source: `Magitecnica/Magitecnica_01_Codex_1_The_Use_and_Misuse_of_Powers_Great_and_Small.md` (`VI.a. Getting a New Power` pricing table, lines ~430-443)
> Source: Our_Golden_Age/Our_Golden_Age.md (## CASH ASSETS cluster, lines ~2892-2935)
> Source: `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` (`## Trade & Goods`, lines ~5941-6078)
> Source: Our_Golden_Age/Our_Golden_Age.md (### 47. Trade, lines ~3740-3750)
> Source: Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md (A First Caravan continuation + post-trade caravan context, lines ~6079-6290)
> Source: `Eternal_Return_Key/Eternal_Return_Key.md` (`#### Items (7+str)` + `#### Economy`, lines ~840-906)
> Source: Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md (#### Locations and Treasures (d30), lines ~1329-1363)
> Source: Our_Golden_Age/Our_Golden_Age.md (### Conspiracy Salvaged + ### Aftermaths of the L'Ost, lines ~7806-7860)
> Source: Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md (### Out of Supplies + ### Source Code Corruption, lines ~5916-5940)
> Source: Vastlands_Guidebook/Vastlands_Guidebook.md (# EQUIPMENT through pre-# POWERS, lines ~2615-3893)
> Source: Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md (Rest & Relaxation + 100 Strange Items, lines ~7309-7442)
> Source: Our_Golden_Age/Our_Golden_Age.md (### They Trade Odd Produce context, lines ~6068-6094)
> Source: Our_Golden_Age/Our_Golden_Age.md (### Hedonic Burden Review pre-gear context, lines ~6367-6406)
> Source: `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` (`## Gear & Services` through service subsections, lines ~6995-7294)
> Source: Vastlands_Guidebook/Vastlands_Guidebook.md (# EQUIPMENT through pre-# POWERS, lines ~2615-3893)
> Source: Our_Golden_Age/Our_Golden_Age.md (### Traditional Orange Land Attire, lines ~6395-6406)
> Source: `Our_Golden_Age/Our_Golden_Age.md` (`### Weapons Against the Blue God`, lines ~3996-4055)
> Source: `Our_Golden_Age/Our_Golden_Age.md` (`### Cat Approved and Disdained Weapons`, lines ~4841-4910)
> Source: `Our_Golden_Age/Our_Golden_Age.md` (`### Fruits of Blood and Soil` + `### Red Land Dress and Wear` + `### Human Liberty Insurance Gear` + `### Unrusting Travel Options` + `### Sundry Russet Souvenirs`, lines ~5457-5525)
> Source: `Our_Golden_Age/Our_Golden_Age.md` (`### Order Maintenance Equipment` and adjacent transport/souvenir blocks, lines ~6407-6460)
> Source: `Eternal_Return_Key/Eternal_Return_Key.md` (`#### SALVAGABLE ARMOR!` + `#### THIS WILL WORK FOR SELF-DEFENSE ...`, lines ~588-604)
> Source: Vastlands_Guidebook/Vastlands_Guidebook.md (# EQUIPMENT through pre-# POWERS, lines ~2615-3893)
> Source: Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md (## Vehicles & Mounts through transport fixes, lines ~6309-6994)
> Source: Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md (### 100 Strange Items, lines ~7332-7436)
> Source: Our_Golden_Age/Our_Golden_Age.md (## HELIODOR MERCANTILE STANDARD GOODS cluster, lines ~7212-7308)
> Source: Our_Golden_Age/Our_Golden_Age.md (### Curios Et Knick Knacks, lines ~8110-8124)
```

## Working Rules (Style + Process)
- Keep chapter gear-focused; remove non-gear/path leftovers.
- No synthesis unless explicitly entering synthesis phase.
- Prefer relocation/reorganization of verbatim material over rewriting.
- Preserve source lineage in the TODO source marker archive, not inline in the chapter body.
- Allow powers in chapter scope as:
  - carried as Traits/Burdens, and
  - anchored to gear for magic-item style effects.
- Keep compatibility shims out of scope.

## Active Future TODO Plan
1. Source-coverage maintenance pass:
- Re-run source-to-section sanity check after each structural cleanup wave.
- Track any newly discovered Luka-source gear/equipment blocks.

2. Optional editorial synthesis phase (only when explicitly requested):
- Consolidate duplicate mechanics prose into canonical SDM-facing wording.
- Keep source-variant mechanics as explicit option lanes.

3. Optional P3 expansion (only if requested):
- `There_A_Red_Door` scenario flavor hooks.

## Coverage Tracker (Merged)
# TODO: SDM Gear Index Source Coverage Pass

## Purpose
Build a complete source-coverage map for Chapter 05 using SDM markdown sources, then identify missing gear/equipment/items context for extraction.

## Scope
- Required source books:
  - `Our_Golden_Age/Our_Golden_Age.md` (OGA)
  - `Vastlands_Guidebook/Vastlands_Guidebook.md` (VLG)
  - `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` (UVG)
  - `Eternal_Return_Key/Eternal_Return_Key.md` (ERK)
- Additional scope:
  - Any other markdown source in-repo authored by Luka Rejec.

## Coverage Criteria
A source block is in-scope if it materially contributes to any Chapter 05 section:
- Core units, inventory, burdens, hallmarks.
- Market research, pricing, liquidation, trade loops.
- Gear catalogs: goods, kits, tools, services, armor, weapons, vehicles/mounts, implants/prosthetics, curios/souvenirs.
- Economy/trade overlays and campaign finance interfaces.
- Loot/treasure handling, value/bulk modifiers, and risk/fallout hooks.
- Hazard/operational constraints that directly impact gear/loot operations.

## Pass Method
1. Build source inventory
- Enumerate all in-repo Luka Rejec markdown books and tag each as `required` or `extended`.

2. Discover candidate headings
- Scan headings and local context for terms:
  - `gear`, `equipment`, `items`, `inventory`, `burden`, `hallmark`
  - `armor`, `weapon`, `mount`, `vehicle`, `services`, `trade goods`
  - `cash`, `market`, `haggling`, `loot`, `treasure`, `salvage`

3. Map to chapter structure
- For each candidate block, assign target section in `Synthetic_Dream_Machine_05_Gear_Index.md`.

4. Determine status
- Mark each candidate as one of:
  - `covered-main` (already in chapter main body)
  - `covered-appendix` (in `_todo/TODO_SDM_Gear_Index_Verbatim_Appendix.md` only)
  - `missing` (not yet extracted)
  - `out-of-scope` (not gear-index relevant)

5. Prioritize missing blocks
- Rank by impact:
  - `P1`: core rules/mechanics gaps
  - `P2`: catalog breadth gaps
  - `P3`: context/flavor/support gaps

## Deliverables
- Coverage matrix table added to this file with columns:
  - `source_file`
  - `heading`
  - `target_section`
  - `status`
  - `priority`
  - `notes`
- Gap summary with extraction batches (`Batch A`, `Batch B`, ...).
- Extraction-ready checklist for each missing block.

## Initial Checklist
- [x] Inventory all Luka Rejec markdown source files in repo.
- [x] Build candidate heading list for OGA/VLG/UVG/ERK.
- [x] Build candidate heading list for additional Luka Rejec sources.
- [x] Fill first-pass coverage matrix (`covered-main` / `covered-appendix` / `missing` / `out-of-scope`).
- [x] Produce prioritized gap list (P1/P2/P3).
- [x] Define extraction batch plan for all P1 and P2 gaps.

## Source Inventory (Luka Rejec)

| source_file | scope_tag | notes |
|---|---|---|
| `Our_Golden_Age/Our_Golden_Age.md` | required | author metadata confirmed (`author: "Luka Rejec"`). |
| `Vastlands_Guidebook/Vastlands_Guidebook.md` | required | author metadata confirmed (`author: "Luka Rejec"`). |
| `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` | required | author metadata confirmed (`author: "Luka Rejec"`). |
| `Eternal_Return_Key/Eternal_Return_Key.md` | required | author metadata confirmed (`author: "Luka Rejec"`). |
| `Magitecnica/Magitecnica_01_Codex_1_The_Use_and_Misuse_of_Powers_Great_and_Small.md` | extended | Luka source; power-focused but contains inventory/gear-adjacent mechanics. |
| `Magitecnica/Magitecnica_02_Codex_2_The_Flesh_Source_Protocols.md` | extended | Luka source; powers/items with armor/weapon/burden and inventory-slot interactions. |
| `There_A_Red_Door/There_A_Red_Door.md` | extended | Luka source; adventure text with sparse gear/loot references. |

## First-Pass Coverage Matrix

| source_file | heading | target_section | status | priority | notes |
|---|---|---|---|---|---|
| `Vastlands_Guidebook/Vastlands_Guidebook.md` | `## CHARACTER EQUIPMENT` (+ `HOW ITEMS WORK`, `ONE STRANGE ITEM`, `STARTING CASH`) | `Gear Catalogs > General Goods and Kits` | covered-main | P0 | Present in chapter main body with source tags. |
| `Vastlands_Guidebook/Vastlands_Guidebook.md` | `## INVENTORY` + `### BURDENS` | `Core Units, Inventory, Burdens, Hallmarks` | covered-main | P0 | Main carry/burden baseline already integrated. |
| `Vastlands_Guidebook/Vastlands_Guidebook.md` | `### Investing in Hallmarks` | `Core Units, Inventory, Burdens, Hallmarks` | covered-main | P0 | Hallmark leveling context already integrated. |
| `Vastlands_Guidebook/Vastlands_Guidebook.md` | `# EQUIPMENT` corpus (`WEAPONS`, `ARMORS`, `MISCELLANEOUS ITEMS`, `VEHICLES AND MOUNTS`) | `Gear Catalogs > General Goods and Kits` + `Tools and Services` + `Armor and Weapons (Source Variants)` + `Vehicles and Mounts` | covered-main | P0 | Relocated from migration lane into final gear subsections. |
| `Vastlands_Guidebook/Vastlands_Guidebook.md` | `#### WEAPON & BEARER` | Path rules (non-gear chapter lane) | out-of-scope | P3 | Explicitly excluded from Gear Index dedupe pass (Path material). |
| `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` | `### Inventory`, `### Inventory and Sacks`, `### Units and Encumbrance` | `Core Units, Inventory, Burdens, Hallmarks` | covered-main | P0 | Included in core carry/load sections. |
| `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` | `### The Pleasure of Treasure`, `### Treasure Is Heavy`, `### So Hack It Up` | `Core Units...` + `Loot and Treasure` | covered-main | P0 | Current chapter has treasure weight/hacking rules. |
| `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` | `## Trade & Goods` + `Market Research` + `Haggling Table` + `Trade Goods` | `Economy and Trade Overlays` | covered-main | P0 | Core market loop already integrated. |
| `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` | `## A First Caravan`, `### Trade Routes (Milk Runs)`, `### Financiers` | `Economy and Trade Overlays` | covered-main | P0 | Caravan economics and financier context included. |
| `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` | `## Vehicles & Mounts` (+ add-ons) | `Gear Catalogs > Vehicles and Mounts` | covered-main | P0 | Full vehicle/mount corpus integrated. |
| `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` | `## Gear & Services` (+ armors/weapons/implants/services) | `Gear Catalogs > Tools and Services` | covered-main | P0 | Main catalog section present. |
| `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` | `### Out of Supplies`, `### Source Code Corruption` | `Hazards and Operational Constraints` | covered-main | P0 | Hazard procedures already integrated. |
| `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` | `#### Locations and Treasures (d30)` | `Loot and Treasure` | covered-main | P0 | Integrated in chapter loot generation flow with source lineage tag. |
| `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` | `### 100 Strange Items` | `Gear Catalogs > Curios and Souvenirs` | covered-main | P0 | Relocated from migration lane into final gear subsection. |
| `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` | `### Burdenbeast Modification` | `Gear Catalogs > Vehicles and Mounts` | covered-main | P0 | Relocated from migration lane into final gear subsection. |
| `Our_Golden_Age/Our_Golden_Age.md` | `## UPGRADE YOUR ITEMS` | `Core Units, Inventory, Burdens, Hallmarks` | covered-main | P0 | Included in hallmark/item progression context. |
| `Our_Golden_Age/Our_Golden_Age.md` | `## CASH ASSETS` | `Economy and Trade Overlays` | covered-main | P0 | Economy framing integrated. |
| `Our_Golden_Age/Our_Golden_Age.md` | Regional gear blocks (`Weapons Against the Blue God`, `Cat Approved...`, `Human Liberty Insurance Gear`, etc.) | `Gear Catalogs > Armor and Weapons (Source Variants)` | covered-main | P0 | Regional variant lanes preserved in body. |
| `Our_Golden_Age/Our_Golden_Age.md` | `## HELIODOR MERCANTILE STANDARD GOODS` | `Gear Catalogs > Curios and Souvenirs` | covered-main | P0 | Included in main chapter. |
| `Our_Golden_Age/Our_Golden_Age.md` | `### They Trade Odd Produce`, `### Hedonic Burden Review` | `Gear Catalogs > Tools and Services` | covered-main | P0 | Relocated from migration lane into final gear subsection. |
| `Our_Golden_Age/Our_Golden_Age.md` | `### 47. Trade` | `Market Research and Liquidation` + `Economy and Trade Overlays` | covered-main | P0 | Integrated in economy/trade overlays with source lineage tag. |
| `Our_Golden_Age/Our_Golden_Age.md` | `### Conspiracy Salvaged` | `Loot and Treasure` or `Market Research and Liquidation` | covered-main | P0 | Integrated under `Loot and Treasure > Campaign-Scale Fallout Interface`. |
| `Our_Golden_Age/Our_Golden_Age.md` | `### Curios Et Knick Knacks` | `Gear Catalogs > Curios and Souvenirs` | covered-main | P0 | Integrated in Curios and Souvenirs with source lineage tag. |
| `Eternal_Return_Key/Eternal_Return_Key.md` | `#### SALVAGABLE ARMOR!` | `Gear Catalogs > Armor and Weapons (Source Variants)` | covered-main | P0 | Included in main chapter. |
| `Eternal_Return_Key/Eternal_Return_Key.md` | `### M. Inventory` + `#### HALLMARK` + `#### DAMAGE IMPOSES BURDENS` | `Core Units, Inventory, Burdens, Hallmarks` | covered-main | P0 | ERK inventory/burden signatures integrated. |
| `Eternal_Return_Key/Eternal_Return_Key.md` | `#### Items (7+str)` + `#### Economy` templates | `Economy and Trade Overlays` | covered-main | P0 | Relocated into final economy section from migration lane. |
| `Magitecnica/Magitecnica_01_Codex_1_The_Use_and_Misuse_of_Powers_Great_and_Small.md` | `IV.c. Carrying Powers (Inventory)` | `Core Units, Inventory, Burdens, Hallmarks` (extended note lane) | covered-main | P0 | Integrated in core inventory/burden section with source lineage tag. |
| `Magitecnica/Magitecnica_01_Codex_1_The_Use_and_Misuse_of_Powers_Great_and_Small.md` | Power market/sale block (`Order of Power | Mint | Pre-Loved | Looted`) | `Market Research and Liquidation` | covered-main | P0 | Integrated as pricing lane in market/liquidation section. |
| `Magitecnica/Magitecnica_01_Codex_1_The_Use_and_Misuse_of_Powers_Great_and_Small.md` | Anchor weapon/hallmark projectile constraints | `Gear Catalogs > Armor and Weapons (Source Variants)` | covered-main | P0 | Integrated via Viridian Practice anchor-weapon block. |
| `Magitecnica/Magitecnica_02_Codex_2_The_Flesh_Source_Protocols.md` | `NUNKA'S WEAPON MORPH` | `Gear Catalogs > Armor and Weapons (Source Variants)` | covered-main | P0 | Integrated as source-variant weapon morph block. |
| `Magitecnica/Magitecnica_02_Codex_2_The_Flesh_Source_Protocols.md` | `BURDEN SHARE` | `Core Units, Inventory, Burdens, Hallmarks` | covered-main | P0 | Integrated in core burden mechanics section. |
| `Magitecnica/Magitecnica_02_Codex_2_The_Flesh_Source_Protocols.md` | Natural armor/tissue modifications occupying inventory slots | `Gear Catalogs > Implants and Prosthetics` | covered-main | P0 | Integrated via NUNKA'S EPIDERMAL SCULPT block. |
| `There_A_Red_Door/There_A_Red_Door.md` | Adventure treasure references (scenario-specific) | `Loot and Treasure` (optional hooks only) | out-of-scope | P3 | Narrative scenario references; no reusable canonical table/procedure block identified yet. |

## Prioritized Gaps (Current)

### P1
- Batch A complete. No open P1 gaps currently.

### P2
- Batch B and Batch C complete. No open P2 gaps currently.

### P3
- `VLG`: `WEAPON & BEARER` is path-mode material; excluded from Gear Index scope.
- `There_A_Red_Door`: adventure-specific treasure/burden references (optional flavor hooks only).

## Extraction Batch Plan

### Batch A (P1 Mechanics) - Completed
- `UVG`: `Locations and Treasures (d30)`.
- `OGA`: `47. Trade`.

### Batch B (P2 Catalog Breadth) - Completed
- `OGA`: `Conspiracy Salvaged`, `Curios Et Knick Knacks`.

### Batch C (P2 Extended Luka Systems) - Completed
- `Magitecnica 01`: `IV.c Carrying Powers (Inventory)`, power sale/pricing lane, hallmark projectile anchor text.
- `Magitecnica 02`: `NUNKA'S WEAPON MORPH`, `BURDEN SHARE`, natural armor/inventory-slot biomod blocks.

### Batch D (Optional P3 Context)
- `VLG`: `WEAPON & BEARER` (skipped; path-mode out-of-scope for Gear Index).
- `There_A_Red_Door`: scenario flavor hooks only if explicitly requested.

## Extraction-Ready Checklist
- [x] Execute Batch A extraction into chapter/main or companion annex with source lineage tags.
- [x] Execute Batch B extraction into `Gear Catalogs > Curios and Souvenirs` and/or market sections.
- [x] Execute Batch C extraction into extended variant lanes (no synthesis).
- [x] Re-run coverage matrix statuses after each batch.

## Notes
- Verbatim appendix archive source for comparison:
  - `_todo/TODO_SDM_Gear_Index_Verbatim_Appendix.md`
- Main chapter target:
  - `Synthetic_Dream_Machine_05_Gear_Index.md`

## Editorial Normalization Plan (Merged)
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
6. `Loot and Treasure` integration (anchor: `#loot-and-treasure-merged-from-legacy-sdm-06`).
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
- Moved loot integration block into chapter flow between `Economy and Trade Overlays` and `Hazards and Operational Constraints` (`#loot-and-treasure-merged-from-legacy-sdm-06`).
- Completed Batch 2 extraction pass across VLG/UVG/OGA/ERK context blocks.
- Removed non-gear extraction leftovers and artifact text.
- Deduped relocated source blocks: first occurrence retained in main body, appendix now carries remaining context-only verbatim blocks.
- Moved `Working Duplicate / Variant Snapshot` to main body before the appendix and normalized it to the explicit map schema (`item_name`, `source_count`, `sources`, `variants`).
- Moved the in-chapter verbatim appendix into `_todo/TODO_SDM_Gear_Index_Verbatim_Appendix.md` and finalized chapter section order in `Synthetic_Dream_Machine_05_Gear_Index.md`.

## Archive Note
- Detailed source surveys, intermediate extraction inventory, and earlier reorganization notes are preserved in git history for this file.

## Verbatim Appendix Migration Log (Merged)
# TODO: SDM Gear Index Verbatim Appendix Archive

## Status
All verbatim appendix corpus blocks have been migrated into `Synthetic_Dream_Machine_05_Gear_Index.md` in section-appropriate locations.

## Migration Log
- Moved `### A. VLG Corpus (Verbatim)` into final `Gear Catalogs` subsections (`General Goods and Kits`, `Tools and Services`, `Armor and Weapons (Source Variants)`, `Vehicles and Mounts`).
- Moved `### B. UVG Corpus (Verbatim)` into final `Gear Catalogs` subsections (`Tools and Services`, `Curios and Souvenirs`, `Vehicles and Mounts`).
- Moved `### C. OGA Corpus (Verbatim)` into final `Gear Catalogs` subsections (`Tools and Services`, `Armor and Weapons (Source Variants)`).
- Moved `### D. ERK Corpus (Verbatim)` into `Economy and Trade Overlays` before loot section.

## Notes
- This file is intentionally kept as a lightweight migration record.
- Use `Synthetic_Dream_Machine_05_Gear_Index.md` as the single current canonical location for moved verbatim blocks.

## Chapter 05 Migration Archive (Merged)
# TODO: SDM Gear Index Chapter 05 + Loot Merge + Chapter Shift

## Status
- Migration is complete.
- This TODO is archived for reference.
- Active follow-up work moved to:
  - `_todo/TODO_SDM_Gear_Index_Editorial_Normalization.md`
  - `_todo/TODO_Magitech_Fantascience_Chapter05.md`

## Active Queue
- None in this file.

## Archive: Completed Outcomes
- Created canonical chapter file: `Synthetic_Dream_Machine_05_Gear_Index.md`.
- Merged legacy loot chapter content into chapter 05 and kept the loot anchor:
  - `#loot-and-treasure-merged-from-legacy-sdm-06`
- Retired legacy file:
  - `Synthetic_Dream_Machine_06_Loot_and_Treasure.md`
- Renumbered campaign chapter:
  - `Synthetic_Dream_Machine_05_Campaign_Regions.md` -> `Synthetic_Dream_Machine_06_Campaign_Regions.md`
- Rewrote stale repo references to the old loot filename.
- Completed verbatim extraction sweep from:
  - `Vastlands_Guidebook`
  - `Ultraviolet_Grasslands_and_the_Black_City_2e`
  - `Our_Golden_Age`
  - `Eternal_Return_Key`
  - additional Luka Rejec markdown sources
- Opened and handed off final editorial pass planning to:
  - `_todo/TODO_SDM_Gear_Index_Editorial_Normalization.md`

## Archive Note
- Full migration plan details and intermediate checklist history are preserved in git history for this file.
