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
