# TODO: BECMI Spell Extraction Spot Check

This report reflects the current split staging layout and the current corpus-closeout state across all six core books.

Current artifact layout:
- `_todo/TODO_BECMI_Spell_Material_Staging.md` is now a manifest/index only.
- Each source book now has its own staging file:
  - `_todo/TODO_BECMI_Spell_Material_Staging_Basic.md`
  - `_todo/TODO_BECMI_Spell_Material_Staging_Expert.md`
  - `_todo/TODO_BECMI_Spell_Material_Staging_Companion.md`
  - `_todo/TODO_BECMI_Spell_Material_Staging_Master.md`
  - `_todo/TODO_BECMI_Spell_Material_Staging_Immortals.md`
  - `_todo/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md`
- Each per-book staging file now includes a `Table Check QA Pass` section near the top so table/list validation can be tracked during later cleanup rounds.

## Final Sweep Categories

- Included in the final closeout sweep:
  - artifact / immortal-power doctrine
  - magic operation doctrine
  - spell lifecycle procedures
  - magic interpretation meta
- Explicitly excluded for now:
  - creature scans
  - monster spellcaster rosters as a dedicated corpus
  - bestiary-focused magical doctrine not needed for spell or item curation

## Final Sweep Results

- Corpus QA checks:
  - known OCR-regression families were re-scanned: `100k`, `100t`, `f100r`, `b100d`, `100p`, broad `IO'` damage, literal `\n`, and stray post-asterisk glyph debris
  - current result: no broad regression-family hits remain in the staged corpus
  - remaining end-of-line hyphenations are now mostly ordinary source texture and table/list density rather than meaning-breaking OCR failures
- Magic/meta candidate review:
  - one real high-value extraction gap was found and closed during the final review: Master artifact power doctrine and artifact-effect procedures
  - the Master staging file now includes artifact purpose, activation, power limits, recharging, intelligence, adverse effects, attack/destruction rules, and power-category guidance, while intentionally excluding the named-artifact catalog
  - the current corpus already contains at least one staged source for:
    - anti-magic / dispel / curse doctrine
    - magical range / duration modification rules
    - conjuring / summoning doctrine
    - mental-effect interpretation notes
    - magic-item identification / activation / charge / damage / sale / use restrictions
    - spell research / copying / books / lost books / item creation procedures
    - artifact / immortal-power-adjacent interpretation text
- Freeze decision:
  - extraction should now be treated as functionally complete for the targeted spell + magic-item curation scope
  - any later extraction work should be limited to newly discovered concrete defects or a separate creature-focused scan

## Full Table QA Pass - 2026-03-22

- Basic:
  - reviewed the Turning Undead table, spell lists, and adjacent structured spell-property blocks
  - result: no blocking row/column defects found
- Expert:
  - reviewed the leveled spell lists, spell-expansion sections, and structured spell-property blocks
  - result: no blocking row/column defects found
- Companion:
  - reviewed treasure tables, spell-scroll type and level tables, wand/staff/rod tables, ring tables, and miscellaneous-item tables
  - result: table-local OCR scars were cleaned in the generator, the densest treasure tables were rewritten into sequential readable tables, and no blocking row/column defects remain
- Master:
  - reviewed the cleric and magic-user experience tables, saving throw matrices, turning tables, and artifact power tables
  - result: the top cleric and magic-user matrices were reconstructed into readable text tables, and no blocking row/column defects remain in the reviewed Master table regions
- Immortals:
  - reviewed the sphere-factor matrix, sample cost table, duration and mental-effect tables, and magical-effect index anchors
  - result: no blocking row/column defects found
- Rules Cyclopedia:
  - reviewed the clerical, magical, and druidic spell lists plus the later reconstructed spellcaster and scroll tables
  - result: no blocking row/column defects found

Chapter 06 readiness:
- the staged corpus is now table-stable enough for spell-patterning and crosswalk expansion work
- the former Master top-matrix blocker is now cleared

## New Sections Cleanup Ledger

- `Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items`
  - extraction mode: mixed Companion reconstruction using curated procedure blocks, readable layout-table slices, and TSV-reflowed item descriptions
  - structural issues found: earlier treasure/procedure spill, damaged price/capacity tables, and list/table readability problems
  - cleanup used: anchored section start, rebuilt price table, compact table normalization for `Spell Catching`, and narrow phrase cleanup only where emitted output still broke meaning
  - remaining acceptable residue: raw source spacing noise and some table-density texture in the treasure tables
- `Master -> Non-Human Spellcasters and Special Spellcaster Procedures`
  - extraction mode: anchored TSV page reflow plus explicit reconstructed undead-control table and trimmed page-tail cleanup
  - structural issues found: flattened undead-control matrix, procedure spill from neighboring layout columns, and noisy tail residue on the final page
  - cleanup used: table reconstruction, exact tail trimming, and narrow generator-backed phrase cleanup
  - remaining acceptable residue: preserved three-column texture in the prose-heavy `Energy Drainers` / undead-recovery portion, but row relationships and section boundaries are now stable
- `Master -> Artifact Power Doctrine and Artifact Effect Procedures`
  - extraction mode: stitched Master extraction using cropped opening columns for page 83, layout-character slices for pages 83-85 doctrine columns, and page-by-page cropped layout columns for pages 86-92
  - structural issues found: clipped right-column doctrine text, mixed-column collisions in the opening pages, dense gutter contamination in the power-table pages, and the need to exclude the named-artifact catalog while keeping the doctrine and power tables
  - cleanup used: section-specific stitched extraction, right-column replacement with layout-character slices, tighter per-page cropped layout columns for the dense power pages, and narrow emitted-phrase fixes only where clipping still broke meaning
  - remaining acceptable residue: ordinary table density, source hyphenation, and local lexical scars in the doctrine and power tables; page-level reading order is now stable and the section remains usable without catalog spill
- `Immortals -> Section 3: Immortal Magic`
  - extraction mode: labeled page-and-column layout extraction across pages 18-21
  - structural issues found: chart-heavy opening density, page-header residue, and broken multiline effect phrases
  - cleanup used: labeled page slices, exact multiline phrase repairs, and Immortals-only wrap cleanup
  - remaining acceptable residue: chart density and long-line texture only
- `Rules Cyclopedia -> Monster Spellcasters`
  - extraction mode: hybrid RC extraction with TSV prose reflow, reconstructed tables, and stitched notes/spell-list slices
  - structural issues found: multi-column spellcaster table collisions, collapsed undead-control table, and mixed prose/list ordering
  - cleanup used: table reconstruction, split page handling by content type, and narrow list cleanup
  - remaining acceptable residue: preserved list/table density and some source spacing scars, but the spellcaster limits and undead-control doctrine are readable
- `Rules Cyclopedia -> Scrolls`
  - extraction mode: TSV coordinate reflow with compact table normalization
  - structural issues found: three-column interleave and flattened `Spell Catching` capacity output
  - cleanup used: TSV reflow plus compact table render
  - remaining acceptable residue: ordinary line-wrap and source-layout texture
- `Rules Cyclopedia -> Spell Research`
  - extraction mode: anchored TSV coordinate reflow from the actual spell-research page
  - structural issues found: earlier wrong line-range extraction and section-boundary drift
  - cleanup used: anchored page extraction only
  - remaining acceptable residue: minor OCR texture only

## Basic

- Source PDF: `TSR 1011B - Set 1 Basic Rules.pdf`
- Output file: `_todo/TODO_BECMI_Spell_Material_Staging_Basic.md`
- Upgraded sections:
  - `Cleric Rules, Turning, and First-Level Spell Procedures`
    - method: TSV-based prose recovery plus an explicit rendered Turning Undead table
    - result: no longer starts in class-intro spill, and the Turning Undead table is now readable as a table instead of a flattened residue block
  - `Spell Lists and Basic Spell Descriptions`
    - method: stitched block with page-aware rebuild
    - ingredients:
      - curated page 35 spell-list reconstruction from the rendered source page
      - pages 26-27 clerical descriptions via TSV column reflow
      - pages 38-42 magic-user spell-book and spell-description material via TSV column reflow
    - result: page 35 no longer depends on clipped column crops, and the old anchored magic-user slice has been replaced with a cleaner page-aware pass
  - `Higher Level Spells, Magic-User Spell Allocation, and Lost Spell Books`
    - method: curated page-specific reconstruction
    - ingredients:
      - DM pages 17-18 higher-level cleric and magic-user spell guidance
      - short player-page spell-book/lost-book carryover from the earlier magic-user section
    - result: the old polluted rules-index/rules-procedure slice is gone, replaced by the actual higher-level spell guidance, spell-assignment notes, and lost-book procedure text
  - `Scrolls and Spell-Adjacent Treasure Text`
    - method: curated page-specific reconstruction
    - ingredients:
      - treasure pages 43-44 `e. Scrolls`
      - treasure pages 43-44 `f. Rings`
      - page 42 magic-item identification and use procedures
      - Basic missile-weapons `Holy Water` consumable procedure
      - pages 43-45 potion, wand, staff, rod, and selected miscellaneous-device procedures
    - result: the old armor/potion spill is gone, and the Basic staging corpus now keeps the scroll/ring material and the adjacent item-operation layer in one contiguous section: identification by testing, permanent vs. temporary item behavior, concentration requirements, charge depletion, potion duration/stacking rules, class-use restrictions for wands and staves, and device-specific activation procedures
- Remaining artifacts:
  - some OCR scars still survive inside the TSV-reflowed magic-user description pages, especially punctuation, odd spacing, and a few broken words
  - the Basic clerical description block still preserves some source-text hyphenation and spacing scars
  - the next obvious Basic target is a more surgical cleanup of the remaining TSV lexical artifacts, not another structural extraction change

## Expert

- Source PDF: `TSR 1012B - Set 2 Expert Rules.pdf`
- Output file: `_todo/TODO_BECMI_Spell_Material_Staging_Expert.md`
- Upgraded sections:
  - `Clerical and Magic-User Spell Expansions`
    - method: stitched TSV page reflow
    - ingredients:
      - Expert pages `7-11` for the clerical spell section
      - Expert page `13` rebuilt as a curated magic-user spell-list block plus curated first/second-level reverse-spell notes
      - Expert pages `14-18` for the remaining magic-user spell prose
      - explicit skip over the intervening fighter and thief class-table pages
    - result: the earlier fighter/thief table contamination is removed from the spell-expansion section, the magic-user level lists now appear in proper order instead of column-interleaved order, and the spell text stays attached to the actual clerical and magic-user source pages
  - `Research and Lost Spell Books`
    - method: curated page-specific reconstruction
    - ingredients:
      - Expert pages 27-28 `Research (Magic Spells and Items)`
      - Expert page 28 `Spell Books, Lost`
    - result: the contaminated NPC-party and specialist spill is gone; the section now contains the actual research procedure, item-creation doctrine, worked cost/time examples, and lost spell-book recovery guidance
  - `Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text`
    - method: curated page-specific reconstruction
    - ingredients:
      - treasure page 60 cursed-item doctrine and general magic-item notes
      - treasure page 63 `e. SCROLLS`
      - treasure pages 63-64 `f. RINGS`
      - treasure page 64 `g. WANDS, STAVES, AND RODS`
      - treasure page 65 selected `h. MISCELLANEOUS MAGIC ITEMS`
    - result: the Expert treasure section now carries the missing ring and miscellaneous-item procedures alongside the scroll and wand/staff/rod material, which makes it more useful for later spell and magic-item curation
- Remaining artifacts:
  - the spell-expansion section is structurally complete and the earlier high-signal OCR residue has been cleaned
  - only ordinary source hyphenation, line-wrap roughness, and small lexical scars remain; these are below the threshold for another dedicated Expert extraction pass

## Rules Cyclopedia

- Output file: `_todo/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md`
- Status: retained from the previous RC-focused pass
- Key methods remain:
  - hybrid `Chapter 3` extraction
  - mixed table handling for `Monster Spellcasters`
  - TSV reflow for `Scrolls` and `Spell Research`
  - cropped-column extraction for `Index to Spells`

## Companion

- Source PDF: `TSR 1013 - Set 3 Companion Set.pdf`
- Output file: `_todo/TODO_BECMI_Spell_Material_Staging_Companion.md`
- Upgraded sections:
  - `High-Level Cleric and Druid Spell Material`
    - method: stitched TSV page reflow
    - ingredients:
      - Companion pages `13-14` anchored at `FIFTH LEVEL CLERIC SPELLS`
      - Companion pages `15-17` anchored at the actual `Druid` section
      - explicit stop before later fighter material
    - result: the old class-spill range slice is gone; the section now starts at the actual cleric spell heading, carries the druid transition and druid philosophy cleanly, and keeps spell headings attached to the correct descriptions
  - `Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items`
    - method: mixed Companion treasure reconstruction
    - ingredients:
      - curated block for `B. Buying and Selling Magic Items`, including a rebuilt price-suggestions table
      - curated `Damage To Magic Items` procedure block
      - readable layout-table extraction for the Companion treasure tables
      - TSV-reflowed description block beginning at `6. Scrolls` and continuing through scrolls, wands/staves/rods, rings, and miscellaneous items
    - result: the earlier procedure and treasure spill is materially reduced, and the staging file now captures the actual Companion item-operation layer needed for later spell and magic-item curation: buying/selling doctrine, damage handling, spell-catching, element staves, ring behavior, quill-copying, and talisman-driven elemental travel
- Remaining artifacts:
  - the Companion `Buying and Selling Magic Items` price table is now readable, but the surrounding treasure tables still preserve some raw source-layout scars, spacing noise, and damaged glyphs
  - `Spell Catching` and related item descriptions are now structurally usable, but minor OCR texture and line-wrap cleanup still remain in the treasure-description block
  - the spell and treasure sections are structurally usable; the next Companion work, if any, is table/OCR polish rather than another extraction-method redesign

## Master / Immortals

- Outputs:
  - `_todo/TODO_BECMI_Spell_Material_Staging_Master.md`
  - `_todo/TODO_BECMI_Spell_Material_Staging_Immortals.md`

## Master

- Source PDF: `TSR 1021 - Set 4 Master Rules.pdf`
- Output file: `_todo/TODO_BECMI_Spell_Material_Staging_Master.md`
- Upgraded sections:
  - `Master Cleric, Druid, and Magic-User Spell Material`
    - method: stitched anchored TSV page reflow
    - ingredients:
      - Master pages `5-6` for the cleric block
      - Master pages `6-7` for the druid block
      - Master pages `8-10` for the magic-user block
    - result: the old broad line-range slab is replaced by class-specific anchored sub-blocks, so the Master spell material now follows the actual cleric, druid, and magic-user page boundaries instead of one undifferentiated extract
  - `Non-Human Spellcasters and Special Spellcaster Procedures`
    - method: anchored TSV page reflow across the actual non-human spellcaster pages
    - ingredients:
      - Master pages `59-61` for `Spell Casters (Non-Human)`, usable spell lists, special monster spellcasters, undead spellcasters, and `Undead Lieges and Pawns`
      - explicit stop before `Selecting Monsters by`
    - result: the old broad procedures spill is removed; the section now starts at the actual non-human spellcaster doctrine and carries through the undead-control material in source order
  - `Artifact Power Doctrine and Artifact Effect Procedures`
    - method: stitched cropped-column extraction for the opening doctrine pages plus page-by-page cropped layout columns for the dense power-table pages
    - ingredients:
      - Master pages `82-92` anchored at the actual artifact doctrine opening
      - artifact purpose, use, activation, powers, recharging, intelligence, adverse effects, attack/destruction, and power-category rules
      - explicit exclusion of `The "Known" Artifacts` catalog
    - result: the final "it belongs with spells" sweep found one real doctrine gap, and it is now staged in the Master corpus with stable page-level reading order, so Immortals' references to non-spell magical effects in artifact power descriptions have a direct source block without the earlier whole-page interleave
- Remaining artifacts:
  - the Master spell section still preserves some two-column table/list interleave, especially around cleric and magic-user progression tables
  - the non-human procedures section and artifact-doctrine block are much cleaner structurally, but still carry table/list OCR texture and some lexical scars from the source text
  - the next Master work, if needed, is targeted table/OCR polish rather than another section-boundary rewrite

## Immortals

- Output file: `_todo/TODO_BECMI_Spell_Material_Staging_Immortals.md`
- Status: section-aware pass implemented
- Extraction methods:
  - `Section 3: Immortal Magic`
    - method: labeled page-and-column layout extraction
    - ingredients:
      - Immortals pages `18-21` split into labeled column slices for the real `Section 3: Immortal Magic` opening, chart-heavy continuation, and alphabetical effect explanations
      - explicit stop before `Section 4: Character Advancement`
    - result: the old broad line-range slab is replaced by labeled Section 3 page slices, so the staging file no longer depends on a coarse text-range slice and no longer risks pulling in later advancement material
- Remaining artifacts:
  - the Immortals section still preserves some source layout density around the chart-heavy opening page
  - the alphabetical effect explanations are now structurally readable and materially cleaner; recent iteration also cleared the page-21 `Hold Monster`, `Insect Swarm`, `Invisible Stalker`, `Levitate`, `Light`, `Lightning Bolt`, and `Maze` wrap scars
  - the remaining residue is mostly ordinary wrap texture and chart density
  - if more Immortals work is needed later, it should be table/chart polish rather than another section-boundary rewrite

## Acceptance Notes

- Coverage:
  - all six source books now have separate staging files
  - the old monolithic staging file was replaced with a manifest
- Reproducibility:
  - `scripts/build_becmi_spell_staging.sh` is the canonical generation path for all current staging files
- Corpus QA progress:
  - the earlier high-risk OCR-regression families (`100k`, `100t`, `f100r`, `b100d`, `100p`, broad `IO'/10'` substitution damage, and post-asterisk glyph debris) have been triaged and are now generator-controlled rather than being left as silent manuscript drift
  - the final regression scan found no broad family hits in the staged corpus
  - the remaining defects are mostly localized crop/OCR texture, table density, and ordinary source hyphenation rather than broad cleanup-rule breakage
- Remaining next-step targets:
  - optionally decide whether any remaining dense chart/table pages in Immortals or Rules Cyclopedia warrant one more dedicated table-focused polish pass
  - begin the spell/effect crosswalk work in `_todo/TODO_BECMI_Spell_Effect_Crosswalk.md` now that all six books have per-book, section-aware staging files
