# TODO: Chapter 05 RC Magic Item Procedure Migration

## Purpose
- Create a first-pass migration spec for RC Treasure magic-item procedures into Chapter 05.
- Preserve RC procedural cadence and table-facing flow for the migration window.
- Make Chapter 05 the single source of truth for full magic-item treasure generation.
- Keep Chapter 09 as a short pointer for full rules.

## Scope (Pass 1)
- In scope:
  - RC procedure capture from `Chapter 16` pages `228-255` (within the wider chapter span `224-255`).
  - Chapter 05 planned anchor and section map for full magic-item procedures.
  - Chapter 09 planned reduction of `Treasure Table H` to a pointer block.
  - Explicit exclusion of RC class-restriction mechanics.
  - Preserve recognizable RC item names, terms, and etymological language in procedure text.
- Out of scope:
  - Full line-by-line implementation inside Chapter 05 and Chapter 09 in this TODO pass.
  - Rebalancing all values, rarity weights, or economy assumptions beyond procedural mapping.
  - Adding optional role gates in Pass 1.
  - SDM-native renaming and terminology replacement of RC item outputs.

## Source Span and Fidelity
- Primary source band: `_becmi/TSR 1071 - The D&D Rules Cyclopedia.pdf`, `Chapter 16`, pages `228-255`.
- Fidelity target: RC-close wording and procedure order, translated into FTLS chapter structure.
- Style guardrail: capture procedure shape and adjudication loops; do not copy protected text verbatim.
- Source priority for later implementation mapping:
  1. `Our_Golden_Age/Our_Golden_Age.md`
  2. `Vastlands_Guidebook/Vastlands_Guidebook.md`
  3. `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md`
  4. Other SDM/FTLS references

## Procedural Tropes to Capture
1. Main treasure-to-item flow:
   - `Treasure result -> Magical Items Main Table -> subtable -> description resolver`.
2. Temporary vs permanent item handling model.
3. Identification-through-use/testing risk model.
4. Use/activation operations:
   - wear/use requirements
   - concentration/action timing
   - charges/consumption behavior
5. Default adjudication constants:
   - range/duration fallback behavior
   - duration tracking responsibilities
6. Cursed item handling loop:
   - detection
   - adjudication
   - removal hierarchy
7. DM control valve:
   - reroll/reject/choose outcomes if a result harms campaign play.
8. Weapon generation branch model:
   - simple method vs detailed method
   - modifier branch handling
9. Sword/misc weapon secondary procedure tropes:
   - extra modifiers
   - special-opponent logic
   - talent/power branch behavior
10. Magic-item market procedures:
    - buy/sell framing
    - buyer acquisition friction
11. Item creation procedures:
    - prerequisites
    - specialist/material gates
    - success-roll model
    - time/cost loop
12. Artifact handling as a distinct high-tier exception track.

## Explicit Exclusions
- Locked for Pass 1:
  1. Do not include RC class-restriction coding in Chapter 05 migration text.
  2. Remove/avoid usability gating tokens like `(C) (M) (S)` as core mechanics.
  3. If role limits are needed later, treat them as optional FTLS tags in a later pass, not Pass 1 core.

## Chapter 05 Target Structure
- Planned anchor target:
  - `## Magic Item Treasure Generation`
- Planned section order under that anchor:
  1. generation flow
  2. use/limits
  3. cursed flow
  4. weapon branches
  5. magic-item market procedure
  6. creation
- Placement rule:
  - Keep existing Grimoire material below this new top procedure block.

## Chapter 09 Reduction Plan
1. Keep `Treasure Table G: Relic/Magic Yield`.
2. Replace `Treasure Table H` body with a short pointer to Chapter 05 full rules.
3. Remove duplicated detailed resolver logic from Chapter 09 once Chapter 05 is authoritative.
- Planned pointer target:
  - `Flying_Triremes_and_Laser_Swords_05_Magitech_and_Fantascience.md#magic-item-treasure-generation`

## Pass 2: SDM-ification and Data-Mining
- Purpose:
  - Translate RC-first generated outputs into SDM-native language in a controlled second pass.
- Inputs:
  - RC-first Chapter 05 procedure text (Pass 1).
  - SDM corpus candidates:
    1. `Our_Golden_Age/Our_Golden_Age.md`
    2. `Vastlands_Guidebook/Vastlands_Guidebook.md`
    3. `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md`
    4. `Synthetic_Dream_Machine_04_Powers_Index.md` and related SDM references
- Method:
  1. Build an `RC term -> SDM close-match` index by item family.
  2. Mark each mapping with confidence (`high`, `medium`, `low`) and source citation.
  3. Keep the rolled legacy name/term as the primary output during alignment; add SDM aliases only when useful.
  4. Keep legacy aliases inline until confidence is high enough for primary-term swap.
  5. Use high-confidence matches as base references for remaining conversions.
  6. Leave no-close-match entries as RC term + alias note for later design pass.
- Output:
  - A conversion appendix or mapping table that can drive Chapter 05 terminology normalization without changing procedure order.

## Acceptance Criteria
1. TODO explicitly covers RC procedural tropes from `p228-p255`.
2. TODO explicitly states "no class restrictions in Pass 1."
3. TODO defines Chapter 09 as pointer-only for full magic-item generation.
4. TODO is decision-complete enough for single-pass implementation by another agent.
5. TODO explicitly defers SDM-ification to Pass 2 with a data-mining mapping method.

## Test and Validation Checklist
1. Scope test:
   - every major RC procedural band from `p228-p255` is represented in the trope list.
2. Exclusion test:
   - no class-restriction mechanics appear in planned Pass 1 outputs.
3. Link test:
   - planned Chapter 09 pointer anchor resolves to planned Chapter 05 heading.
4. Duplication test:
   - single-source-of-truth rule is enforced (`Chapter 05 full`, `Chapter 09 pointer`).
5. Readability test:
   - procedure order in Chapter 05 matches table-use flow at the table.
6. Pass-separation test:
   - Pass 1 retains RC naming/etymology and Pass 2 owns SDM term replacement.
7. Mapping test:
   - Pass 2 produces cited `RC -> SDM` close-match mappings with confidence tags.

## Risks and Mitigations
- Risk: anchor drift between plan and implementation.
  - Mitigation: use exact heading text for Chapter 05 anchor and verify slug after edit.
- Risk: procedural drift from RC sequence during rewrite.
  - Mitigation: keep subsection order fixed to RC procedure cadence in this TODO.
- Risk: duplicate logic remains in Chapter 09 after migration.
  - Mitigation: enforce explicit de-duplication checkpoint in implementation checklist.
- Risk: role restrictions creep back in through copied table notation.
  - Mitigation: Pass 1 exclusion gate blocks `(C) (M) (S)` style restrictions.

## Work Checklist
- [x] Create Chapter 05 top anchor: `Magic Item Treasure Generation`.
- [x] Draft Chapter 05 generation-flow section from RC procedure tropes.
- [x] Draft Chapter 05 use/limits section.
- [x] Draft Chapter 05 cursed-item loop section.
- [x] Draft Chapter 05 weapon branch section.
- [x] Add RC family-level resolver tropes block (Potions through Miscellaneous Weapons) under generation flow.
- [x] Add condensed resolver microtables for Potions and Scrolls (RC naming retained, no class restrictions).
- [x] Add condensed resolver microtables for Wands/Staves/Rods, Rings, and Miscellaneous Items.
- [x] Add condensed resolver microprocedures for Armor/Shields, Missile Weapons/Missiles, Swords, and Miscellaneous Weapons.
- [x] Add weapon secondary resolver tables (additional modifiers, opponent categories, talents, intelligent sword track).
- [x] Add condensed RC-cadence description procedures (Potions, Scrolls, Wands/Staves/Rods, Rings/Misc handling notes).
- [x] Apply source-alignment correction pass: charge defaults, spell-scroll count (`d6` style), ring/rod terms, armor power procedure, weapon secondary tables, and sip-identification skill gate.
- [x] Add nostalgia-pass classic descriptive name lists for core item families (Potions, Scrolls, Wands/Staves/Rods, Rings, Miscellaneous Items).
- [x] Expand nostalgia-pass descriptive lists for secondary classic sets (Armor/Shield special powers, Missile Talents, Sword intelligence/powers, Opponents, Additional-Modifier Talents).
- [x] Refocus descriptive extraction into RC-style named sections (`Potion Descriptions`, `Scroll Descriptions`, `Wand/Staff/Rod Descriptions`, and related classic heading blocks).
- [x] Draft Chapter 05 magic-item market section (buy/sell framing + buyer-search friction only).
- [x] Draft Chapter 05 creation loop section.
- [x] Verify no class-restriction mechanics are included in Pass 1 core text.
- [x] Reduce Chapter 09 Table H to a short pointer block.
- [x] Verify pointer target resolves to Chapter 05 anchor.
- [x] Remove duplicated detailed resolver blocks from Chapter 09.
- [x] Run final consistency pass for single-source-of-truth behavior.
- [ ] Build Pass 2 `RC -> SDM` conversion index by item family.
- [ ] Data-mine SDM books for close-enough conversion anchors with citations.
- [ ] Assign confidence tags to each candidate mapping.
- [ ] Draft terminology-swap rules (`high` confidence swap, `medium/low` alias retention).
- [ ] Apply SDM terminology normalization in Chapter 05 as a separate controlled pass.
