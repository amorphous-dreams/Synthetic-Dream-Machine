# TODO: BECMI -> SDM+ Conversion Master

## Intent
Track BECMI/RC conversion work as optional overlays on top of the consolidated SDM base model.

Base model (locked):
- Core rules: `Synthetic_Dream_Machine_01_Quickstart.md`
- Gear/item/vehicle catalogs: `Synthetic_Dream_Machine_05_Gear_Index.md`

## Conversion Policy
- BECMI/RC procedures are compatibility overlays, not replacements for canonical SDM baseline.
- Any overlay must declare:
  - what baseline step it modifies,
  - whether it is optional,
  - how to disable it cleanly.

## Conversion Goals
1. Preserve recognizable BECMI/RC procedure identity where it improves play clarity.
2. Express converted procedures in SDM-native units, cadence, and chapter anchors.
3. Keep SDM baseline stable while allowing optional compatibility overlays.
4. Maintain runnable table-facing loops, not only conceptual crosswalk notes.
5. Minimize adjudication drift across sessions and referees.

## State of Play
- FTLS Chapter 05 has a stable object-procedure front end and working family scaffold.
- Numeric ontology is locked policy for active conversion work: BECMI level, HD, and spell-tier references already map to SDM `Level` and `Power Level`.
- Class locks and most D&D ability-score terminology have already been removed or reduced in active chapter conversion.
- Armor/shield Defense has been corrected from descending AC assumptions to SDM additive armor bonuses.
- The full staged spell corpus now exists across the six `_todo/TODO_BECMI_Spell_Material_Staging_*.md` files and feeds a live crosswalk workspace in `_todo/TODO_BECMI_Spell_Effect_Crosswalk.md`.
- That crosswalk now has a flat canonical catalog, preserved cross-tradition class/spell tags, an SDM-first grouped family layer, and completed grouped-`partial` to Phase 1 sync.
- Method correction (2026-03-23): staging docs should contain scraped/curated source text from `_becmi` extraction, not synthesized context overlays.
- The remaining conversion burden is now: run an evidence-backed context harvest pass from `_becmi` and convert that curated material into chapter-ready bridge doctrine.

## Uplift Execution Log (Consolidated)

- 2026-03-23 lane-harvest cleanup locked in: removed synthesized context inserts from staging docs, preserved source-evidence-only policy, and completed broad OCR/readability normalization across Companion/Master/RC evidence blocks.
- 2026-03-23 confidence survey completed against all staged lanes: B 0.93, E 0.89, C 0.91, M 0.95, I 0.95, RC 0.95 with provenance completeness sustained at 1.00.
- Phase B bridge activation is in effect: Chapter 06 was prioritized first, then Chapter 05 bridge continuation.
- Chapter 06 alpha scaffolding and normalization completed in manuscript form: doctrine locks, card-template normalization, navigation indexing, provenance pointers, and baseline recognizer coverage were landed.
- 2026-03-25 Expert lane uplift completed: all Expert `undecided` rows were resolved via evidence-lock notes and status normalization.
- 2026-03-25 Companion lane uplift batch C1 executed: six C-lane rows were evidence-locked and promoted (`Earthquake`, `Insect Plague`, `Sword`, `Call Lightning`, `Control Temperature 10' radius`, `Faerie Fire`), reducing C-lane undecided from 13 to 7.

## Lane Confidence Gate (B/E/C/M/I/RC)

Current baseline from the Phase 1 canonical catalog pass, updated 2026-03-23 after PDF ToC cross-check plus the Companion MU spell recovery:

| Lane | Capture Confidence (spell/magic/metaphysics captured) | Provenance Complete | Target | Last Survey |
| --- | --- | --- | --- | --- |
| B | 0.93 | 1.00 | > 0.95 capture, keep provenance at 1.00 | 2026-03-23 |
| E | 0.93 | 1.00 | > 0.95 capture, keep provenance at 1.00 | 2026-03-25 |
| C | 0.91 | 1.00 | > 0.95 capture, keep provenance at 1.00 | 2026-03-23 |
| M | 0.95 | 1.00 | > 0.95 capture, keep provenance at 1.00 | 2026-03-23 |
| I | 0.95 | 1.00 | > 0.95 capture, keep provenance at 1.00 | 2026-03-23 |
| RC | 0.95 | 1.00 | > 0.95 capture, keep provenance at 1.00 | 2026-03-23 |

Survey findings (2026-03-23):
- **B +0.02**: DM higher-level spell guidance, lost spell books, and item operation procedures now fully staged. OCR texture is the only remaining issue.
- **E +0.02**: Expert spells 1-6 and research/lost books fully staged. Expert page-65 miscellaneous magic items are now fully captured in the staging block; remaining Expert issues are OCR texture and normalization.
- **C +0.02**: Companion **Magic-User Spells: 5th through 9th Level** are now staged from Companion pages 22-28 via TSV reflow, alongside the existing cleric/druid and item sections. The primary structural gap is closed; remaining work is OCR cleanup and later comparison against RC wording for any version-specific differences.
- **M +0.05**: Artifact content (doctrine, catalog, appendix), non-human spellcasters, spell lists, and Master Procedures (`Anti-Magic Effects` + `Dispel Magic`) are now staged. The prior procedure gap is closed; remaining Master cleanup is OCR texture and normalization only.
- **I +0.01**: Immortals Sections 1-2 PP conversion/rank/recovery context is now staged alongside Section 3 (Immortal Magic), closing the prior low-priority framing gap.
- **RC +0.07**: RC Chapter 16 item-description catalog is now staged from source text (potions, wands/staves/rods, rings, miscellaneous items, swords), alongside the existing construct and item-enchantment procedures. Remaining RC work is cleanup-level OCR normalization, not missing source-evidence.

### Lane Batch Checkpoints

| Date | Batch | B undecided | E undecided | C undecided | M undecided | RC undecided | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-03-25 | Expert completion | 2 | 0 | 13 | 9 | 5 | Expert lane stabilized; no unresolved Expert `undecided` rows. |
| 2026-03-25 | Companion C1 | 2 | 0 | 7 | 9 | 5 | Promotions: `Earthquake`/`Insect Plague` -> `custom`; `Sword`/`Call Lightning`/`Control Temperature 10' radius`/`Faerie Fire` -> `partial`. |
| 2026-03-25 | Companion C2 | 2 | 0 | 0 | 9 | 5 | Promotions: `Creeping Doom`/`Metal to Wood` -> `custom`; `Hold Animal`/`Locate`/`Produce Fire`/`Protection from Lightning`/`Warp Wood` -> `partial`. |
| 2026-03-25 | Master M1 | 2 | 0 | 0 | 0 | 5 | Promotions: `Dissolve`/`Heat Metal`/`Wizardry`/`Explosive Cloud`/`Power Word Kill`/`Feeblemind`/`Statue` -> `custom`; `Dance`/`Power Word Blind` -> `partial`. |
| 2026-03-25 | RC1 form suite | 2 | 0 | 0 | 0 | 0 | Promotions: `Clothform`/`Stoneform`/`Woodform`/`Ironform`/`Steelform` -> `partial` with RC-only exception notes preserved. |
| 2026-03-25 | Basic B1 closure | 0 | 0 | 0 | 0 | 0 | Promotions: `Light`/`Ventriloquism` -> `partial` with Basic/RC trigger-scope evidence locks; all tracked lane backlogs at zero. |

### >0.95 Capture Uplift Plan (Context Harvest First)

Goal of this uplift phase: raise capture confidence by scraping and cleaning missing context, not by making final conversion decisions yet.

Common context products required for every lane (`B/E/C/M/I/RC`):
- `Missing Context Queue`: one line per row listing what is missing (trigger, limits, duration, target class, exception cases, reverse form behavior, failure mode).
- `Alias and Naming Registry`: canonical name, source spellings, reverse names, and index variants (no mechanical judgement yet).
- `Procedure Skeleton Extracts`: neutral paraphrase blocks per row (`when used`, `what it affects`, `what stops it`, `how it ends`).
- `Edge-Case Index`: explicit collection of caveats (object interactions, planar exceptions, anti-magic interactions, concentration breaks, permanence rules).
- `Source Evidence Pointer`: per-row citation pointers already present in Phase 1, verified and cleaned for readability.

1. **B lane (0.91 -> >0.95)**
  - Scrape and clean missing baseline context for low-tier foundations and scroll wrappers.
  - Build compact trigger/effect/end-state extracts for all Basic rows with `undecided` or ambiguous notes.

2. **E lane (0.87 -> >0.95)**
  - Harvest missing context from high-tier Expert rows (illusion walls, kill/destruction, polymorph and anti-magic boundary behavior).
  - Build an `ECM context packet` (what blocks/reflects/suppresses and under what conditions) without selecting final SDM implementation.

3. **C lane (0.91 -> >0.95)**
  - Primary Companion extraction gap is now closed: the Magic-User 5th-9th level spell descriptions are staged from Companion source text.
  - Next Companion uplift step: review the new MU spell run for Companion-specific wording differences versus RC and flag meaningful divergences for downstream conversion.
  - Secondary: continue cleanup of ring/staff/rod/misc extracts into reusable neutral templates that downstream conversion can map later.

4. **M lane (0.95 -> >0.95)**
  - Master Procedures extraction gap is now closed: `Anti-Magic Effects` and `Dispel Magic` are staged in the Master lane.
  - Remaining Master work is cleanup-focused: normalize residual OCR texture in the new procedure block and keep neutral extract formatting consistent.
  - Optional follow-up: compare Master procedure wording against RC/Companion parallels to flag doctrinal deltas for later conversion notes.

5. **I lane (0.95 -> sustain)**
  - Keep cleanup focused on OCR/line-wrap normalization while preserving source meaning.
  - Use the new Sections 1-2 framing block when deriving downstream power-cost and regeneration doctrine notes.

6. **RC lane (0.95 -> sustain)**
  - Keep OCR/line-wrap cleanup focused on readability only; do not mutate source meaning.
  - Cross-compare RC item-property wording against B/E/C/M analogs and capture doctrinal deltas for downstream conversion notes.

### Execution Rules For Context-First Uplift

- This phase captures and cleans context only; conversion design choices are deferred to implementation passes.
- Confidence lift is earned by shrinking the `Missing Context Queue`, not by forcing mapping statuses.
- Provenance must remain at `1.00`; any source/staging drift blocks lane sign-off.
- For OCR-heavy or layout-dense pages, render page PNGs first and curate against the image plus extracted text before writing staging updates. Preferred helper: `scripts/render_becmi_pages_png.sh`.
- Store rendered page images under `_todo/_page_renders/.cache/<lane>/` and keep page numbers in the filename for source-traceability.
- Sequence rule: complete lane staging evidence harvest first (scrape + clean missing context from PDFs), then run crosswalk updates as a follow-up pass.
- During this phase, avoid crosswalk status churn unless needed to fix provenance pointer breakage.
- Lane sign-off for this phase requires:
  - all rows have a context completeness check,
  - all missing-context items are either resolved or explicitly queued,
  - alias/reverse/index variants are normalized,
  - edge-case extracts are present for high-risk rows.

## API Conversion Doctrine

### Preserve External Recognizers
- Preserve classic item names.
- Preserve classic spell and effect names when they function as familiar API labels.
- Preserve familiar family labels and classic subtable names where they aid lookup.
- Treat preserved BECMI-facing names as labels and recognizers, not mechanical authority.

### Replace Internal Mechanics
- `AC` and descending defense become additive `Armor` and `Defense`.
- `hit points` become `Life`.
- Class restrictions become Traits, practices, bearer requirements, or gear-compatibility limits.
- Spell tiers become `Power Level`.
- Character/caster level and monster `HD` become SDM `Level`.
- Attack and save math become SDM roll language, save language, and `[+]` / `[-]`.

### Canonical Reference Order
- `Synthetic_Dream_Machine_01_Quickstart.md` controls core rules truth.
- `Synthetic_Dream_Machine_05_Gear_Index.md` controls item math and presentation.
- `Synthetic_Dream_Machine_04_Powers_Index.md` controls power-facing storage and trigger language.
- `Synthetic_Dream_Machine_03_Traits_Index.md` informs classless identity replacements.
- `Synthetic_Dream_Machine_06_Campaign_Regions.md` only applies when region/faction/world-process context matters.
- `Vastlands_Guidebook`, `Our_Golden_Age`, and `Ultraviolet_Grasslands_and_the_Black_City_2e` are style guides, not mechanical canon.

## Conversion Standards
- Canon first:
  - Quickstart/Gear canon is the baseline; overlays must not redefine core rules.
- Procedure shape preservation:
  - Keep trigger -> procedure -> output -> consequence structure explicit.
- Unit consistency:
  - Use canonical SDM value/carry units unless an overlay explicitly states a conversion mode.
- Reversibility:
  - Every overlay can be disabled without breaking baseline procedures.
- Traceability:
  - Each conversion note should reference its canonical SDM destination anchor.

## Alignment Constants (Locked)
- Character and caster level scaling: convert BECMI character/caster levels to SDM `Level` by halving and always rounding up.
- Hit-Dice scaling: convert BECMI `HD` creature potency to SDM `Level` by halving and always rounding up. This is separate from SDM `Hero Dice (HD)`.
- Spell-to-power scaling: `Spell Level x2 = SDM Power Level`; cantrips and other minor at-will or `x/day` free effects map to `Power Level 1`.
- Manuscript presentation policy: Chapter-facing text should be `SDM only`; source reference values stay in TODO/reference notes, not inline in the manuscript.

## Numeric Ontology Reference
- Use `Level` for entity potency, caster potency, summon strength, curse removal strength, dispelling strength, and other force-of-source references.
- Use `Power Level` for spell-tier storage, eligibility, archive capacity, and any direct spell-to-power conversion.
- Use `Level` thresholds for converted creature filters and control limits.
- Examples:
  - `3 HD -> Level 2`
  - `7 HD -> Level 4`
  - `15 HD -> Level 8`
  - `26th level caster -> Level 13 practitioner`
  - `36th level cleric -> Level 18 holy practitioner`
  - `1st-level spell -> Power Level 2`
  - `4th-level spell -> Power Level 8`
  - `cantrip/minor at-will or x/day effect -> Power Level 1`

## Shared Phase Tracker

### Phase A: Mechanical Resolution Cleanup
- Remove hidden D&D math while preserving classic names and labels.
- Convert save language, attack math, morale/reaction references, and source-era combat modifiers into SDM-native resolution.
- Use this phase to eliminate remaining descending-AC-era logic and disguised THAC0 assumptions.

### Phase B: Power / Spell API Bridge
- Preserve classic spell-item names while routing internal behavior through SDM `power` concepts.
- Apply `Power Level` for storage, eligibility, and capacity.
- Apply `Level` for force-of-source, dispel/counterforce, summon strength, and curse-removal strength.
- Record ambiguous classic spell names in TODO notes rather than leaving them implicit in chapter prose.
- Phase B execution order is locked for this pass: Chapter 06 design decisions -> Chapter 06 alpha completion -> Chapter 05 bridge continuation.

### Phase C: Family-by-Family Internal Conversion
- Convert item families in a fixed order:
  1. Potions / Oils / Elixirs
  2. Scrolls / Formulae / Map-Documents
  3. Wands / Staves / Rods
  4. Rings / Amulets / Charms
  5. Miscellaneous Items / Strange Items / Oddities
  6. Armor / Shields / Wards
  7. Missile Weapons / Missiles
  8. Swords
  9. Miscellaneous Weapons
- Standardize trigger model, bearer requirements, resolution language, damage/Defense/save scale, status/control effects, depletion/failure model, and output record.

### Phase D: Back-Half System Conversion
- Convert salvage/building/modding formulas to SDM-native units and procedures.
- Convert archives/albums/grimoires to SDM-native storage and activation language aligned to Gear and Powers.
- Remove remaining chapter-facing BECMI economy and slot assumptions.

### Phase E: Final Consistency and Acceptance Pass
- Run final manuscript verification for forbidden mechanics terms and inconsistent SDM terminology.
- Verify preserved BECMI labels no longer carry BECMI internal mechanics.
- Sync accepted policy and any deliberate exceptions back into linked TODOs.

## Other Pass

## Active Linked TODOs
- Loot/Treasure stabilized plan:
  - `_todo/TODO_Loot_Treasure_Conversion.md`
- Magitech Chapter 05 alignment:
  - `_todo/TODO_Magitech_Fantascience_Chapter05.md`
- SDM consolidation master:
  - `_todo/TODO_SDM_Gear_Index_Master.md`


## Active Queue
1. Keep the spell/effect crosswalk in lockstep: grouped status changes or note promotions must be mirrored back into Phase 1 immediately.
2. Continue Chapter 06 alpha drafting pass: expand canonical recognizer coverage and complete section-level scale/source organization.
3. Run Chapter 06 alpha verification pass (tag consistency, overcharge consistency, recognizer discoverability, and Level/Power Level boundaries).
4. Mark Chapter 06 as `alpha` complete before resuming new Chapter 05 bridge edits.
5. Resume Chapter 05 Phase B bridge batches with the now-locked Chapter 06 API doctrine.
6. Re-validate overlay assumptions against current Quickstart/Gear canon as downstream manuscript edits resume.
7. Treat API-surface preservation with internal SDM replacement as the default conversion mode for Chapter 05 and adjacent passes.

## Activities Checklist
- [ ] Build/refresh BECMI -> SDM crosswalk index by subsystem (`B/E/C/M/I` lanes).
- [ ] Add short procedure excerpts (paraphrase + source refs) for each active overlay lane.
- [ ] Draft `Siege-as-Dungeon` procedure in FTLS format (watch-based).
- [ ] Draft `Immortal/Spheres in SDM+` reference page (factional physics + world-process play).
- [ ] Reconcile `I03` overlay interaction rules with `C04` nexus update procedure.
- [ ] Validate each overlay against current Quickstart/Gear anchors.
- [ ] Mark each overlay as optional/default-off/default-on explicitly.
- [ ] Add disable-path note for each overlay (how to revert to pure SDM baseline).
- [ ] Run at least one table-walkthrough per overlay family (discovery, combat, economy, progression).
- [x] Record identified drift/ambiguity points and patch target TODOs.
- [ ] Sync accepted overlay decisions into linked TODOs (`Loot`, `Magitech`, `SDM consolidation master`).

## Future TODO Passes

### F1: Spells -> Powers
- [x] Treat `_todo/TODO_BECMI_Spell_Material_Staging_*.md` as the canonical staged spell corpus for this pass.
- [x] Preserve canonical OSR spell names as the primary crosswalk row keys and Chapter 06 lookup surface.
- [x] Record existing stylized entries from `Synthetic_Dream_Machine_04_Powers_Index.md` as named SDM variants with `see` handling, not as replacements for canonical spell names.
- [x] Define fallback policy for unmatched spells (`direct map`, `partial map`, `custom power required`, `undecided`).
- [ ] Deepen the spell-pattern crosswalk from status tagging into chapter-ready SDM Powers doctrine.
- [ ] Apply locked scaling constants (`Spell Level x2 = SDM Power Level`; cantrip floor).
- [ ] Define conversion rules for range/duration/targeting in SDM procedure language.
- [ ] Use the manuscript pattern `canonical spell first, variant callout second` whenever a Luka-style descendant already exists (for example: `Magic Missile` -> `see Tragic Missile`).
- [ ] Route outputs to canonical powers destinations and quick-reference anchors.
- [ ] Use FTLS Chapter 06 as the first major destination chapter for the full staged spell corpus and crosswalk outputs.
- [ ] Add validation scenario set:
  - direct attack/control,
  - utility/exploration,
  - summon/transform/exception cases.
- [ ] Add relationship notes for likely combined-power / overcharge families where several classic spells may collapse into one SDM progression.
- [ ] Mark likely locked-rider families where higher Overcharge effects should require RSS, archive, corruption-cleaning, or other campaign-side unlock work before safe use.
- [x] Lock final Chapter 06 design decisions into chapter doctrine and supporting TODO notes.
- [ ] Mark Chapter 06 as `alpha` complete before promoting additional Chapter 05 bridge batches.

### F2: Magic Items -> Magitech and Fantascience
- Queue policy: begin or resume this pass only after Chapter 06 reaches `alpha` state.
- [ ] Build family-by-family crosswalk (`RC/BECMI magic item families` -> `SDM magitech/fantascience lanes`).
- [ ] Keep procedure conversion separate from terminology conversion (mechanics first, naming pass second).
- [ ] Route converted generation flow to Chapter 05 canonical anchors.
- [ ] Define compatibility tags for source behaviors where direct SDM mappings are partial.
- [ ] Validate loot handoff integrity (`treasure yield -> item generation -> use/constraints`).
- [ ] Add acceptance test set:
  - permanent item path,
  - consumable/charged item path,
  - cursed/complication-bearing item path.
- [ ] Use Chapter 05 armor/shield conversion as the model pattern for `retain BECMI API surface, replace internal mechanics`.
  

### Other Passes
- `C03` Agent/retainer reliability + delegation canonicalization.
- `B05` Unified zoom handoff matrix (round/turn/watch/week/month).
- `I02` Sphere-like factional physics normalization.
- `M02` Siege logic canonicalization.

## Future Pass Standards
- Future passes must not redefine Quickstart core mechanics.
- Future passes must preserve optional-overlay toggles and disable paths.
- Future pass outputs must include explicit canonical SDM anchor references.

## Done Criteria
- Overlay work references canonical SDM anchors, not superseded chapter structures.
- Overlay toggles are explicit and local (no global ambiguity).
- Loot/magic-item overlays remain compatible with consolidated Quickstart+Gear model.
