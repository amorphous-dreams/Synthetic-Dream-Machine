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
- The remaining conversion burden is primarily internal implementation cleanup: roll math, save language, combat modifiers, spell-to-power interfacing, and chapter-wide consistency.

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
- Manuscript presentation policy: Chapter-facing text should be `SDM only`; legacy values stay in TODO/reference notes, not inline in the manuscript.

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
- Convert save language, attack math, morale/reaction references, and legacy combat modifiers into SDM-native resolution.
- Use this phase to eliminate remaining descending-AC-era logic and disguised THAC0 assumptions.

### Phase B: Power / Spell API Bridge
- Preserve classic spell-item names while routing internal behavior through SDM `power` concepts.
- Apply `Power Level` for storage, eligibility, and capacity.
- Apply `Level` for force-of-source, dispel/counterforce, summon strength, and curse-removal strength.
- Record ambiguous classic spell names in TODO notes rather than leaving them implicit in chapter prose.

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
1. Re-validate overlay assumptions against current Quickstart/Gear canon.
2. Keep overlay docs free of core-rules duplication.
3. Maintain short crosswalk notes from RC terms to SDM anchors.
4. Treat API-surface preservation with internal SDM replacement as the default conversion mode for Chapter 05 and adjacent passes.

## Activities Checklist
- [ ] Build/refresh BECMI -> SDM crosswalk index by subsystem (`B/E/C/M/I` lanes).
- [ ] Add short procedure excerpts (paraphrase + source refs) for each active overlay lane.
- [ ] Draft `Siege-as-Dungeon` procedure in FTLS format (watch-based).
- [ ] Draft `Immortal/Spheres in SDM+` reference page (factional physics + world-process play).
- [ ] Reconcile `I03` carryover rules with `C04` nexus update procedure.
- [ ] Validate each overlay against current Quickstart/Gear anchors.
- [ ] Mark each overlay as optional/default-off/default-on explicitly.
- [ ] Add disable-path note for each overlay (how to revert to pure SDM baseline).
- [ ] Run at least one table-walkthrough per overlay family (discovery, combat, economy, progression).
- [ ] Record identified drift/ambiguity points and patch target TODOs.
- [ ] Sync accepted overlay decisions into linked TODOs (`Loot`, `Magitech`, `SDM consolidation master`).

## Future TODO Passes

### F1: Magic Items -> Magitech and Fantascience
- [ ] Build family-by-family crosswalk (`RC/BECMI magic item families` -> `SDM magitech/fantascience lanes`).
- [ ] Keep procedure conversion separate from terminology conversion (mechanics first, naming pass second).
- [ ] Route converted generation flow to Chapter 05 canonical anchors.
- [ ] Define compatibility tags for legacy behaviors where direct SDM mappings are partial.
- [ ] Validate loot handoff integrity (`treasure yield -> item generation -> use/constraints`).
- [ ] Add acceptance test set:
  - permanent item path,
  - consumable/charged item path,
  - cursed/complication-bearing item path.
- [ ] Use Chapter 05 armor/shield conversion as the model pattern for `retain BECMI API surface, replace internal mechanics`.

### F2: Spells -> Powers
- [ ] Build spell-pattern crosswalk into SDM Powers taxonomy.
- [ ] Apply locked scaling constants (`Spell Level x2 = SDM Power Level`; cantrip floor).
- [ ] Define conversion rules for range/duration/targeting in SDM procedure language.
- [ ] Define fallback policy for unmatched spells (`direct map`, `partial map`, `custom power required`).
- [ ] Route outputs to canonical powers destinations and quick-reference anchors.
- [ ] Add validation scenario set:
  - direct attack/control,
  - utility/exploration,
  - summon/transform/exception cases.
  

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
- Overlay work references canonical SDM anchors, not legacy chapter structures.
- Overlay toggles are explicit and local (no global ambiguity).
- Loot/magic-item overlays remain compatible with consolidated Quickstart+Gear model.
