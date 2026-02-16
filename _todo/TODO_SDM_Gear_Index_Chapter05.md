# TODO: SDM Gear Index Chapter 05 + Loot Merge + Chapter Shift

## Purpose
- Add a new root SDM chapter file: `Synthetic_Dream_Machine_05_Gear_Index.md`.
- Merge the full content currently in `Synthetic_Dream_Machine_06_Loot_and_Treasure.md` into the end of the new Gear Index chapter.
- Re-number downstream SDM chapters so Gear Index is canonical `Chapter 05`.
- Execute a full-repo filename/link/reference migration for the adjusted chapter layout.
- Plan verbatim extraction of gear tables and item descriptions from SDM markdown sources (`OGA`, `VLG`, `UVG`, `ERK`, and other Luka Rejec markdown), with `VLG` Gear as base seed.

## Condensed Update Instructions
- Extraction target set: `Our_Golden_Age`, `Vastlands_Guidebook`, `Ultraviolet_Grasslands_and_the_Black_City_2e`, `Eternal_Return_Key`, plus other Luka Rejec markdown files in-repo.
- No compatibility shim/redirect file is required for retired `Synthetic_Dream_Machine_06_Loot_and_Treasure.md`.
- Keep loot content appended at chapter end during merge staging; once extraction is complete, place market research/liquidation rules in the best-fit final chapter location.

## Chapter Numbering Decision (Target Canon)
- `01` -> `Synthetic_Dream_Machine_01_Quickstart.md` (unchanged)
- `02` -> `Synthetic_Dream_Machine_02_Paths_Index.md` (unchanged)
- `03` -> `Synthetic_Dream_Machine_03_Traits_Index.md` (unchanged)
- `04` -> `Synthetic_Dream_Machine_04_Powers_Index.md` (unchanged)
- `05` -> `Synthetic_Dream_Machine_05_Gear_Index.md` (new, includes merged Loot/Treasure section at end)
- `06` -> `Synthetic_Dream_Machine_06_Campaign_Regions.md` (currently `05`)
- Standalone `Synthetic_Dream_Machine_06_Loot_and_Treasure.md` is retired after merge.

## Scope
- In scope:
  - New TODO + execution plan for SDM chapter insertion and renumber.
  - Merge legacy SDM loot chapter content into Gear Index as the trailing section.
  - File rename for shifted campaign chapter.
  - Repo-wide update of markdown links, file mentions, and chapter-label references affected by this shift.
  - Mandatory full-repo rewrite of all references to the old standalone loot chapter path/name.
  - Verbatim extraction plan for gear content from `VLG`, `UVG`, `OGA`, `ERK`, and other Luka Rejec markdown.
- Out of scope (for this TODO start):
  - Final editorial rewrite of merged loot text.
  - New game-balance decisions across all gear entries.
  - Cross-book semantic reconciliation beyond extraction + source tagging.
  - Compatibility shim/redirect stub at `Synthetic_Dream_Machine_06_Loot_and_Treasure.md`.

## High-Risk Notes
- Filename collision risk: `Synthetic_Dream_Machine_06_Loot_and_Treasure.md` currently blocks renaming campaign chapter to `..._06_Campaign_Regions.md`.
- Use collision-safe sequence:
  1. Merge loot content into new chapter 05.
  2. Remove legacy loot file.
  3. Rename campaign file from `05` to `06`.
- No-shim decision increases risk of dead links if rewrite/validation is incomplete; all stale path references must be removed before delete.
- Avoid blind replacement of generic text like `Chapter 05` / `Chapter 06` across FTLS content.
- Preserve non-SDM chapter references (for example FTLS chapter numbering).

## Global Migration Plan (Files + Links + References)

### Phase 1 - Introduce New Chapter 05
- Create `Synthetic_Dream_Machine_05_Gear_Index.md` with front matter and initial scaffold.
- Add temporary section stubs:
  - Canon boundary
  - Source map
  - Gear category index
  - Verbatim extraction appendix (working area)
  - Final section anchor for merged loot content: `<a id="sdm-loot-and-treasure"></a>`

### Phase 2 - Merge Legacy Loot into Chapter 05 (At End)
- Copy all content from `Synthetic_Dream_Machine_06_Loot_and_Treasure.md` into the end of `Synthetic_Dream_Machine_05_Gear_Index.md`.
- Append body content only (skip legacy front matter and top-level H1 from the source chapter).
- Preserve heading hierarchy/content order from the legacy loot chapter.
- Place merged content under a clear terminal heading, for example:
  - `## Loot and Treasure (Merged from Legacy SDM 06)`
- Ensure this is the final major section in chapter 05.

### Phase 3 - Shift Campaign Chapter Number
- Remove legacy file after successful merge:
  - delete `Synthetic_Dream_Machine_06_Loot_and_Treasure.md`
- Rename campaign chapter:
  - `Synthetic_Dream_Machine_06_Campaign_Regions.md` -> `Synthetic_Dream_Machine_06_Campaign_Regions.md`

### Phase 4 - Repo-Wide Reference Rewrite
- Requirement: update references in the entire repo, not only "likely affected" files.
- Required exact replacements:
  - `Synthetic_Dream_Machine_06_Campaign_Regions.md` -> `Synthetic_Dream_Machine_06_Campaign_Regions.md`
  - `Synthetic_Dream_Machine_06_Loot_and_Treasure.md` -> `Synthetic_Dream_Machine_05_Gear_Index.md#sdm-loot-and-treasure`
  - `SDM 06 Loot and Treasure` -> `SDM 05 Gear Index` (loot section context)
  - `SDM 06` references to loot chapter -> `SDM 05` (loot section context)
- Review likely affected docs:
  - `_todo/TODO_BECMI_Conversion.md`
  - `_todo/TODO_Loot_Treasure_Conversion.md`
  - `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md`
  - `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_09_Loot_and_Treasure.md`

### Phase 5 - Validation
- No stale references:
  - `rg -n "Synthetic_Dream_Machine_05_Campaign_Regions\\.md|Synthetic_Dream_Machine_06_Loot_and_Treasure\\.md" --glob '*.md'`
- Broader stale-reference sweep (all text mentions, not only links):
  - `rg -n "Loot and Treasure|SDM 06 Loot|SDM 06" --glob '*.md'`
- Confirm new references exist:
  - `rg -n "Synthetic_Dream_Machine_06_Campaign_Regions\\.md|Synthetic_Dream_Machine_05_Gear_Index\\.md#sdm-loot-and-treasure" --glob '*.md'`
- Confirm chapter-text mentions were updated only where context is SDM numbering.
- Confirm merged loot section is at end of `Synthetic_Dream_Machine_05_Gear_Index.md`.
- Confirm no compatibility shim file remains at retired loot path.

## Verbatim Extraction Plan (Gear Tables + Item Descriptions)

### Extraction Rules
- Preserve source wording verbatim in extraction blocks.
- Keep each extracted block tagged with source, heading, and line anchor.
- Do not normalize wording during extraction pass; normalize only in a later editorial pass.
- Keep one entry = one source citation row (even for duplicates across books).

### Data Model for Extraction Rows
- `item_or_table_name`
- `category`
- `verbatim_text`
- `size`
- `cost`
- `mechanics`
- `source_book`
- `source_path`
- `source_heading`
- `source_line_anchor`
- `notes`

### Seed Order (Priority)
1. `VLG` (base-seed)
2. `UVG`
3. `OGA`
4. `ERK`
5. Other Luka Rejec markdown sources with gear-relevant content

### Source Anchors (Initial Queue)
- `Vastlands_Guidebook/Vastlands_Guidebook.md`
  - `## CHARACTER EQUIPMENT` (`:719`)
  - `### HOW ITEMS WORK` (`:737`)
  - `## ONE STRANGE ITEM` (`:798`)
  - `## ONE USEFUL KIT` (`:871`)
  - `### STARTING CASH` (`:887`) for item-price scale context
- `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md`
  - `## Trade & Goods` (`:5941`)
  - `### Thirty Ultraviolet Trade Goods (d30)` (`:6023`)
  - `## Gear & Services` (`:6995`)
  - `### Grassland General Goods` (`:7003`)
  - `### Toolkits` (`:7042`)
  - `### Armors` (`:7073`)
  - `### Weapons` + sub-tables (`:7131`, `:7153`, `:7177`, `:7190`, `:7209`)
  - `### Implants & Prosthetics` (`:7230`)
- `Our_Golden_Age/Our_Golden_Age.md`
  - `### Weapons Against the Blue God` (`:3996`)
  - `### Cat Approved and Disdained Weapons` (`:4841`)
  - `### Fruits of Blood and Soil` (`:5457`)
  - `### Red Land Dress and Wear` (`:5471`)
  - `### Human Liberty Insurance Gear` (`:5482`)
  - `### Unrusting Travel Options` (`:5493`)
  - `### Sundry Russet Souvenirs` (`:5502`)
  - `### Order Maintenance Equipment` (`:6407`)
- `Eternal_Return_Key/Eternal_Return_Key.md`
  - `#### SALVAGABLE ARMOR!` (`:588`)
  - `#### THIS WILL WORK FOR SELF-DEFENSE ...` (`:604`)
  - `#### Items (7+str)` (`:840`)
  - `#### Economy` (`:882`)
  - `### M. Inventory` (`:1036`)
  - `#### UNITS OF MATTER` (`:1048`)
- Additional Luka Rejec markdown discovery rule:
  - Identify markdown files with author marker (`Luka Rejec` / `LUKA REJEC`) and extract gear-relevant sections only.

## Implementation Passes

### Pass A - Scaffold Chapter 05
- Create chapter 05 scaffold and explicit loot-section anchor.

### Pass B - Merge Existing SDM Loot Chapter
- Append current SDM loot chapter content to chapter 05 end.
- Keep content order and headings intact.
- Apply only minimal heading tweaks needed for local coherence.

### Pass C - Renumber Campaign Chapter
- Remove legacy standalone loot file.
- Rename campaign chapter to chapter 06.
- Update repo links/references.

### Pass D - VLG Base-Seed Extraction
- Extract all VLG equipment tables and item descriptions verbatim into chapter 05 working appendix.
- Preserve original table structures before any merge logic.

### Pass E - UVG Ingestion
- Extract UVG gear/services tables verbatim.
- Tag UVG-specific mechanics (reload, powered, rare/restricted, environmental tags, etc.).

### Pass F - OGA Ingestion
- Extract OGA gear/equipment tables verbatim.
- Tag region-specific provenance to avoid losing setting context.

### Pass G - ERK + Luka Corpus Ingestion
- Extract ERK gear/inventory/economy-relevant content verbatim.
- Run a Luka-author discovery sweep across markdown files and ingest only gear-relevant sections.

### Pass H - Consolidation Prep + Loot Placement (No Rewrite Yet)
- Build duplicate map (`same/similar item names across books`).
- Add `source_count` and `variant` flags.
- After extraction is complete, place market research/liquidation rules into the best-fit final chapter section (not necessarily terminal).
- Queue editorial normalization as a separate pass after extraction and placement are complete.

## Acceptance Criteria
1. New todo exists and defines SDM renumbering with merged loot-in-gear approach.
2. Plan includes collision-safe migration order for chapter/file changes.
3. Plan includes exact link/reference rewrite + validation commands.
4. All references to the old standalone loot chapter are updated repo-wide.
5. Plan explicitly requires legacy loot chapter content to be appended at end of chapter 05.
6. Plan defines verbatim extraction workflow across `VLG`, `UVG`, `OGA`.
7. `VLG` is explicitly designated as base-seed.
8. Plan includes `ERK` and other Luka Rejec markdown in extraction scope.
9. Plan explicitly states no compatibility shim/redirect file.
10. Final placement of market research/liquidation rules is decided after extraction.

## Work Checklist
- [x] Create `Synthetic_Dream_Machine_05_Gear_Index.md` scaffold in repo root.
- [x] Add end-section anchor for loot in chapter 05 (`sdm-loot-and-treasure`).
- [x] Append content from `Synthetic_Dream_Machine_06_Loot_and_Treasure.md` to end of chapter 05.
- [x] Append body content only (skip legacy front matter and top H1).
- [x] Verify merged loot section is terminal in chapter 05.
- [x] Delete `Synthetic_Dream_Machine_06_Loot_and_Treasure.md` after merge.
- [x] Do not create compatibility shim/redirect at retired loot path.
- [ ] Rename `Synthetic_Dream_Machine_06_Campaign_Regions.md` -> `Synthetic_Dream_Machine_06_Campaign_Regions.md`.
- [x] Run exact filename reference replacements across markdown files.
- [x] Run targeted SDM chapter-label replacements for loot references (`SDM 06` -> `SDM 05` where applicable).
- [ ] Validate zero stale references to old filenames.
- [ ] Run a full-repo stale-reference sweep and resolve all remaining old loot chapter mentions.
- [ ] Extract VLG gear tables and item descriptions verbatim into chapter 05 working appendix.
- [ ] Extract UVG gear tables and item descriptions verbatim into chapter 05 working appendix.
- [ ] Extract OGA gear tables and item descriptions verbatim into chapter 05 working appendix.
- [ ] Extract ERK gear/inventory/economy content verbatim into chapter 05 working appendix.
- [ ] Run Luka-author markdown discovery and extract additional gear-relevant content.
- [ ] Build duplicate/variant map with source tags for later consolidation.
- [ ] Decide and implement final chapter placement for market research/liquidation rules after extraction.
- [ ] Open follow-up TODO for post-extraction editorial normalization pass.
