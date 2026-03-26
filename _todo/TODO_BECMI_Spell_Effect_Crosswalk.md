# TODO: BECMI Spell / Effect Crosswalk

This document is the downstream handoff artifact for the completed BECMI spell-material staging corpus.

Purpose:
- track classic spell and effect names across the staged core books
- build the full canonical spell crosswalk from the staged corpus
- support FTLS Chapter 06 powers drafting as the next major downstream consumer
- support the broader `F2: Spells -> Powers` conversion pass

Source corpus:
- `_todo/TODO_BECMI_Spell_Material_Staging_Basic.md`
- `_todo/TODO_BECMI_Spell_Material_Staging_Expert.md`
- `_todo/TODO_BECMI_Spell_Material_Staging_Companion.md`
- `_todo/TODO_BECMI_Spell_Material_Staging_Master.md`
- `_todo/TODO_BECMI_Spell_Material_Staging_Immortals.md`
- `_todo/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md`

Rules for this artifact:
- This is a crosswalk workspace, not a source-text staging file.
- Use the staged corpus as the source of truth; do not copy from PDFs ad hoc.
- Preserve classic names as lookup keys.
- Do not convert terminology to SDM terms until a mapping decision is recorded.
- Preserve classic OSR spell names as the primary Chapter 06 headings and lookup surface even when an SDM-native variant already exists.
- Creature-specific spellcaster scans remain out of scope unless they are required to clarify the spell corpus itself.

## Provenance Contract

- Treat provenance as a required field of the crosswalk, not optional supporting note quality.
- For most spell rows, the minimum acceptable source shape is **2+ sources**:
	- one pre-`RC` BECMI source lane (`Basic`, `Expert`, `Companion`, `Master`, or `Immortals`) when evidenced in the staged corpus
	- one `RC` source anchor when the spell or effect appears in the Rules Cyclopedia staging lane
- Express that pairing explicitly in both provenance-facing columns:
	- `Source Book(s)` should normally show the pre-`RC` lane plus `RC`
	- `Staging Anchor / Section` should normally show both the pre-`RC` anchor and the `RC -> ...` anchor
- `RC` is the canonical compendium lookup surface, but it is not a license to drop earlier BECMI evidence when that evidence exists.
- `RC`-only rows are allowed only when the staged corpus currently shows no earlier evidenced BECMI source. Treat those rows as **exception state**, not baseline completion.
- If a row has a pre-`RC` BECMI source but no `RC` source, treat that as incomplete provenance unless the row is explicitly out of RC scope.
- If a row has `RC` plus multiple pre-`RC` lanes, keep the earliest evidenced lane and any semantically important later lane(s); do not over-minimize provenance down to a single BECMI witness if later BECMI lanes materially change wording, scaling, or reverse-form handling.
- Chapter 05 and Chapter 06 downstream exports should inherit this doctrine: prefer paired provenance (`becmi:<lane>` plus `becmi:Rules Cyclopedia`) whenever both are evidenced.

## State of Play

- 2026-03-23 final row audit: added `Remove Charm (MU 8)` and `Ring of Spell Turning`; synced five Phase 1/Phase 2 status mismatches (`Cursed / Cursed Scroll`, `Lightning Bolt`, `Maps to Treasures / Treasure Maps`, `Mass Charm`, `Power Word Stun`).
- 2026-03-24 provenance/parity/alias consolidation: verified explicit RC-only exception notes for `Analyze`, `Entangle`, `Create Air`, `Clothform`, `Stoneform`, `Woodform`, `Ironform`, `Steelform`; restored flat/grouped key parity (240/240); and locked Chapter 06 recognizer surfaces for `Shield`, `Water Breathing`, and `Pass-Wall / Passwall`, with `Raise Dead` and `Raise Dead Fully` preserved as distinct canonical keys.
- 2026-03-25 lane-first rebucket + verification: Phase 1 now uses fixed parent buckets (`B`, `E`, `C`, `M`, `I`, `RC`) with topic sub-buckets; RC now contains only true RC-primary spell rows; item/procedure RC subsections remain intentionally empty; unique spell/effect count stable at 241.
- 2026-03-25 Expert uplift completion: all Expert `undecided` rows were resolved using context-first evidence locks; status-cell syntax normalized to canonical tokens.
- 2026-03-25 Companion uplift batch C1 executed with evidence-lock notes and status promotions: `Earthquake` -> `custom`; `Insect Plague` -> `custom`; `Sword` -> `partial`; `Call Lightning` -> `partial`; `Control Temperature 10' radius` -> `partial`; `Faerie Fire` -> `partial`. C lane undecided delta: 13 -> 7.
- 2026-03-25 Companion uplift batch C2 executed with evidence-lock notes and status promotions: `Creeping Doom` -> `custom`; `Hold Animal` -> `partial`; `Locate` -> `partial`; `Metal to Wood` -> `custom`; `Produce Fire` -> `partial`; `Protection from Lightning` -> `partial`; `Warp Wood` -> `partial`. C lane undecided delta: 7 -> 0.
- 2026-03-25 Master uplift batch M1 executed with evidence-lock notes and status promotions: `Dissolve`, `Heat Metal`, `Wizardry`, `Explosive Cloud`, `Power Word Kill`, `Feeblemind`, and `Statue` -> `custom`; `Dance` and `Power Word Blind` -> `partial`. M lane undecided delta: 9 -> 0.
- 2026-03-25 RC uplift batch RC1 executed with evidence-lock notes and status promotions: `Clothform`, `Stoneform`, `Woodform`, `Ironform`, and `Steelform` -> `partial`. RC lane undecided delta: 5 -> 0.
- 2026-03-25 Basic uplift batch B1 executed with evidence-lock notes and status promotions: `Light` and `Ventriloquism` -> `partial` (flat catalog + grouped mirrors synchronized). B lane undecided delta: 2 -> 0.
- The six-book staged spell corpus is complete. Phase 1 is now considered frozen (Phase 1 freeze 2026-03-23). Staging files in `_todo/` remain as source references.
- Phase 1 carries the flat canonical catalog with cross-tradition `Class(es)/Spell-level` tags preserved where relevant.
- Phase 2 has been remapped into the SDM-first functional family taxonomy used for downstream Chapter 06 planning; family coverage audit confirms all Phase 1 rows appear in at least one Phase 2 family section.
- The grouped-`partial` to flat-`undecided` sync backlog is cleared. All current Phase 1/Phase 2 status pairs are now consistent.
- Existing SDM variants are being recorded as relationship notes rather than allowed to replace canonical spell recognizers.
- Next: Phase B bridge work — consuming crosswalk doctrine to finish the power/spell API bridge inside Chapter 05 and its supporting TODO notes.

## Provenance Confidence (2026-03-23 Full Pass)

- Scope: full RC-linked provenance audit across both Phase 1 and Phase 2 tables, plus Immortals co-source checks where applicable.
- Result: all RC-linked rows now include explicit `RC -> ...` staging anchors; all Immortals-linked rows now include explicit `Immortals -> ...` anchors.
- Interpretation rule: anchor completeness is not the same thing as provenance sufficiency. A row can have a valid `RC -> ...` anchor and still be incomplete if an earlier evidenced BECMI co-source has not yet been carried forward into the row.
- Audit metrics (Phase 1 + Phase 2 combined):
	- RC rows total: 135
	- RC-only rows: 71
	- RC+other-source rows: 64
	- RC rows missing RC anchors: 0
	- Immortals rows total: 21
	- Immortals rows missing Immortals anchors: 0
- Confidence rating: **High (0.92 / 1.00)** for source-provenance completeness in this artifact.
- Residual risk: medium-low semantic risk remains where some Master co-sources are evidenced via artifact-effect tables rather than full standalone spell writeups; provenance is explicit, but conversion semantics should still treat those rows as table-derived precedents.
- Remaining provenance uplift target: reduce `RC-only` rows whenever an earlier staged BECMI witness can be evidenced without guesswork, because the preferred steady state for most spells is `pre-RC BECMI + RC`, not `RC` alone.
- Current flat-catalog `RC`-only spell exceptions after targeted uplift: `Analyze`, `Entangle`, `Create Air`, `Clothform`, `Stoneform`, `Woodform`, `Ironform`, and `Steelform`. Treat these as evidence-backed exception state unless new staged pre-`RC` witnesses are added.
- Current flat-catalog non-`RC` artifact procedure exceptions after targeted uplift: `Artifact Activation`, `Artifact Charges And Recharge`, `Artifact Intelligence And Auto-Defense`, and `Creating Artifacts`. Treat these as evidence-backed `Master`-only exception state unless a structurally equivalent staged `RC` procedure witness is later added.

## Forward Plan

1. **Phase B: Power / Spell API Bridge** — consume crosswalk doctrine to finish the bridge inside `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_06_Powers.md`: convert classic spell names that still function only as recognizers into explicit SDM `power` language; lock `Power Level` for storage/capacity and `Level` for counterforce/dispel.
2. Continue the focused `custom` enrichment passes on high-signal rows to guide Chapter 05/06 drafting, especially item-interface wrappers, artifact doctrine, and the Immortal scaling rules.
3. Add relationship notes for likely combined-power or Overcharge families where multiple classic spells may collapse into one SDM power progression (fireburst ladder, acceleration ladder).
4. Keep the grouped family workspace and flat Phase 1 catalog in lockstep; no further family regrouping is needed — solve new ambiguity with note quality, tags, and relationship guidance.
5. Run a provenance uplift pass against `RC-only` and single-lane rows so spells that clearly have both pre-`RC` BECMI and `RC` evidence are normalized to dual-source form before Chapter 06 bulk export accelerates.

## Reference Reuse Targets

- Reuse [Synthetic_Dream_Machine_04_Powers_Index.md](/home/joshu/Synthetic-Dream-Machine/Synthetic_Dream_Machine_04_Powers_Index.md) for power template shape, storage tags, and existing variant precedent.
- Reuse [Synthetic_Dream_Machine_05_Gear_Index.md](/home/joshu/Synthetic-Dream-Machine/Synthetic_Dream_Machine_05_Gear_Index.md) for ward mechanics, antimagic handling, spell-eater style item interfaces, and storage-facing gear language.
- Reuse [Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_10_Appendix_Null_Referee_Resources.md](/home/joshu/Synthetic-Dream-Machine/Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_10_Appendix_Null_Referee_Resources.md) for tag vocabulary that should inform grouped family heuristics and cross-labels.
- Reuse [Synthetic_Dream_Machine_01_Quickstart.md](/home/joshu/Synthetic-Dream-Machine/Synthetic_Dream_Machine_01_Quickstart.md) for burden, item, and broad powers-access assumptions when the mechanics-delta note needs a canonical anchor.
- Reuse [Synthetic_Dream_Machine_03_Traits_Index.md](/home/joshu/Synthetic-Dream-Machine/Synthetic_Dream_Machine_03_Traits_Index.md) when storage-form differences or bearer-access doctrine suggest trait-side handling such as `Power Scroller`.
- Reuse [Vastlands_Guidebook/Vastlands_Guidebook.md](/home/joshu/Synthetic-Dream-Machine/Vastlands_Guidebook/Vastlands_Guidebook.md) for `Albums of Power`, `Storing Powers`, `Activating Powers`, and `Proper Wizard` as the clearest non-slot precedent set for SDM family naming and power storage behavior.

## Canonical Name / Variant Doctrine

- The crosswalk is keyed by canonical OSR spell or effect name first.
- Existing entries in [Synthetic_Dream_Machine_04_Powers_Index.md](/home/joshu/Synthetic-Dream-Machine/Synthetic_Dream_Machine_04_Powers_Index.md) that clearly descend from classic spells should be treated as unique SDM variants, not as replacements for the canonical row key.
- Chapter 06 should normally list the canonical spell name, then note any existing stylized SDM variant with a `see` pointer.
- The default manuscript pattern is: canonical spell entry first, variant callout second. Example: `Magic Missile` with a note to see `Tragic Missile`.
- A canonical spell may have zero, one, or several existing SDM variants. Record them when they exist; do not force one variant to become the only canonical implementation.
- Existing variant powers are useful precedent for tone, presentation, and implementation direction, but they do not erase the need to preserve the classic recognizer/API surface.

Variant recording rule for this workspace:
- When a clear SDM variant already exists, record it in the row `Notes` field as `Existing SDM variant: <Power Name> (<source lane>)` until or unless the table grows a dedicated variant column.

## RC Canonical Compendium Reference Doctrine

- Treat `RC` as the canonical compendium text surface, not as a replacement for pre-compendium BECMI spell history.
- For any row that includes `RC`, keep version awareness explicit in source references:
	- `RC` anchor: compendium wording/index form used for canonical lookup.
	- pre-`RC` anchor(s): earliest staged BECMI source lane(s) currently evidenced in this repository.
- Normal completion target: if a spell is present in `RC` and also present in staged pre-`RC` BECMI material, the row should show both. Do not collapse it to a lone `RC` witness for convenience.
- If a row currently has only `RC` source support in staged material, keep it `RC`-only for now and treat pre-`RC` provenance as unresolved rather than assumed.
- When `RC` normalizes spelling, naming, or indexing relative to earlier books, preserve both forms in row notes as recognizer aliases.
- For item-effect rows evidenced from the staged Chapter 16 catalog, prefer explicit item-surface anchors instead of generic `RC` shorthand:
	- `RC -> Chapter 16 Item Description Catalog -> Rings`
	- `RC -> Chapter 16 Item Description Catalog -> Wands, Staves, and Rods`
	- `RC -> Chapter 16 Item Description Catalog -> Miscellaneous Items`

### Preferred Row Shapes

- **Standard spell row with dual provenance**
	- `Source Book(s)`: `Basic, RC` or `Expert, Master, RC`
	- `Staging Anchor / Section`: `Basic -> ...; RC -> ...`
- **Legitimate RC-only exception row**
	- Use only when no earlier staged BECMI witness is currently evidenced.
	- Note that status explicitly in `Notes` when it matters for downstream conversion confidence.
- **Item-effect row with RC catalog witness**
	- `Source Book(s)`: `Companion, RC` or `Expert, RC`
	- `Staging Anchor / Section`: `Companion -> ...; RC -> Chapter 16 Item Description Catalog -> ...`
- **Non-RC exception row**
	- Allowed when the spell/effect is genuinely outside the Rules Cyclopedia corpus or the current staged RC lane does not evidence it.
	- Treat this as an exception state that should be obvious from `Source Book(s)` rather than hidden in notes.

## Verification Cadence

1. Re-run the flat-row versus grouped-family coverage check after any regrouping or row promotion and confirm there are no ungrouped Phase 1 keys.
2. Re-run the grouped-`partial` and grouped-`custom` spot checks whenever a focused cleanup pass lands so the flat catalog never drifts behind the grouped workspace.
3. Review ECM membership only when a row actually tests the boundary between generic defense and real counter-magitech behavior.
4. Keep the mechanics-delta note concise and stable so later executors do not silently reintroduce slot-era assumptions.
5. On provenance cleanup passes, audit rows in this order: `RC-only` spell rows first, then single-lane pre-`RC` rows, then mixed-source rows with incomplete `Staging Anchor / Section` coverage.
6. Treat a row as provenance-complete only when its `Source Book(s)` and `Staging Anchor / Section` columns agree about the same witnessed lane set.
7. Re-run flat Phase 1 versus grouped family `Classic Name` parity after any row-name normalization; expected steady-state is exact set equality (current target: 240/240, missing=0, extra=0).
8. On consolidation-sensitive families, explicitly confirm whether near-neighbor rows are aliases or intentional separate canonical keys (for example `Raise Dead` versus `Raise Dead Fully`) and record the decision in row notes.

## Existing Variant Inventory

Starter batch of already-identified Luka-style descendants or family variants from the Powers Index.

| Canonical Key | Existing SDM Variant | Relation | Powers Index Source Lane | Planning Use |
| --- | --- | --- | --- | --- |
| Magic Missile | Tragic Missile | close descendant | Vastlands / Apocrypha of the O.S. | Keep `Magic Missile` as the Chapter 06 heading; add `see Tragic Missile`. |
| Floating Disc | Floating Disc | direct stylized rendition | UVG2e Spells | Canonical entry can point directly to the existing variant without renaming the recognizer. |
| Knock | Knock / Lock | broadened descendant | UVG2e Spells | Treat `Knock` as canonical and note the lock/unlock SDM variant alongside it. |
| Hold Person | Hlod Person | playful descendant | Vastlands / Apocrypha of the O.S. | Preserve the canonical restraint spell name and use the Luka version as a named variant. |
| Animate Dead | Animate Corpse | close descendant | UVG2e Spells | Use the canonical necromancy key while treating the UVG rite as a specific implementation path. |
| Raise Dead | Raise Dead | dark exact-name rendition | UVG2e Spells | Same recognizer, but the UVG rendering is an undead/parody-of-life implementation rather than a clean restoration effect. |
| Magic Jar | Magic Jar | exact-name rendition | UVG2e Spells | Strong direct precedent for identity-transfer / crystal mind-storage handling in Chapter 06. |
| Read Languages / language-bridge family | Anti-Babylon | family variant | Eternal Return Key | Useful for language, communication, and universal-translation families without collapsing them into one exact spell name. |
| Fire Ball / Fireball | Pyreball | close descendant | Vastlands / Apocrypha of the O.S. | Preserve both staged-corpus spellings while pointing to the existing Luka-style fireburst variant. |
| Polymorph Self / Alter Self family | Alter Self | family variant | UVG2e Spells | Useful precedent for self-directed transformation even when the canonical BECMI keys remain separate. |
| Wish | Big Wish | stylized high-tier descendant | Vastlands / Apocrypha of the O.S. | Preserve `Wish` as the canonical heading and treat `Big Wish` as a distinctive SDM presentation. |

## Likely Further Candidates From Powers Index Compare Pass

Validated candidates from a broader compare pass. These are promising enough to track, but should not all be promoted to row-level `Existing SDM variant` notes without a spell-by-spell decision.

| Canonical Spell / Family | Powers Index Entry | Confidence | Why It Looks Relevant | Likely Use |
| --- | --- | --- | --- | --- |
| Truesight / True Seeing family | Eyes of Akaula | medium-high | Sees invisible, hidden, departed, and dead things for a day; strong reveal/divination package. | Good precedent for premium perception and anti-concealment powers. |
| Wizard Eye / Clairvoyance family | Eyes of the Arrow | medium-high | Binds awareness to a projectile to create a mobile remote sensor. | Good precedent for remote-sight and scouting powers. |
| Teleportation / portal family | Linked Portals | medium | Two linked astral hoops move creatures and objects through connected space rather than instant self-relocation. | Better treated as a portal/travel family cousin than a direct `Teleport` replacement. |
| Telekinesis / mage-hand family | Objective Telekinesis | medium-high | Creates an ectoplasmic hand that manipulates and crushes nearby objects. | Good precedent for low-tier force-manipulation powers. |
| Speak With Dead family | Speak With Husk | high | Corpse answers three questions; overcharge allows fuller conversation. | Strong candidate for eventual row-level variant handling. |
| Detect Evil / Know Alignment family | Sense Allegiance | medium-high | Reads a creature's ethics directly and can stun evil targets on contact. | Strong precedent for allegiance-reading and anti-evil detection lanes. |
| Invisibility / concealment family | Ecosphere Veil | medium-high | Makes creatures disregard the target; overcharge reaches effective invisibility and trace suppression. | Strong SDM-native concealment precedent, though it is built on disregard rather than simple optical hiding. |
| Polymorph Self / shapechange family | Skinshift | medium-high | Full body transformation into familiar beast forms with escalating size options. | Stronger and broader than `Alter Self`; likely useful when the transformation pass deepens. |
| Charm Person / Mass Charm family | Hero's Goldenmouth | medium | Crowd-facing charm through rhetoric and trust rather than direct domination. | Better treated as a social-compulsion cousin than a clean exact spell rename. |
| Obscuring mist / fog / concealment family | Yellow Cloud | medium | A 9m cube of sight-blocking dust plus an overcharged dust wall. | Good concealment / battlefield-obscuration precedent. |
| Detect sentience / aura-reading / ESP family | Yellow Foresight | medium | Scans a wide area for the number and general mood of sentients; overcharge nudges attitude. | Good precedent for mood-reading and population-sense divinations. |
| Regeneration / restoration family | Rehoryan's Progressive Restoration | medium-high | Rapid life recovery plus staged bodily repair and regrowth. | Strong precedent for higher-tier restoration/regeneration effects distinct from ordinary cure spells. |
| Cure disease / poison purge / organ repair family | Real-Time Rebuild | high | Explicit power settings flush toxins or afflictions, restore organs, regrow limbs, or rebuild bodies. | One of the strongest SDM precedents for bodily repair, poison purge, and major restoration notes. |
| Raise Dead / soul-return family | Recall Soul | medium-high | Calls back a soul as an ectoplasmic entity that can be captured or redirected into further procedures. | Useful ritual cousin when resurrection conversion needs explicit soul-handling rather than simple revival. |
| Haste / acceleration family | Nunka's Biophysical Overdrive | medium-high | Drives the target into short-term overperformance followed by exhaustion burdens. | Strong speed-boost precedent with explicitly SDM costs and aftermath. |
| Fire Ball / Fireball storage-delivery family | Gem Bomb | medium | Encodes an explosive forcefield into a gem, with overcharge exploding like a Fireball. | Good item-interface cousin for fireburst delivery and storage notes. |

## Active Phase Scope

## Phase 1 Catalog Workspace

Initial flat catalog seed for the full-spell pass. This section uses lane-first parent buckets (`B`, `E`, `C`, `M`, `I`, `RC`) with topic sub-buckets so source lineage stays explicit while uncatalogued names remain visible.

`Class(es)/Spell-level` uses RC shorthand: `C` = cleric, `Dr` = druid, `MU` = magic-user. Duplicate canonical rows keep the full cross-tradition class tags where relevant. Non-spell rows stay blank in this column.

Expert catalog dedupe note: when an BECMI era spell is shared across cleric and magic-user lists, keep canonical rows with full cross-tradition class tags to avoid note drift. Source-era spelling or capitalization variants may be retained only as alias language inside the notes.

### B - Basic

#### Cleric

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status | Ch06 Import |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cure Light Wounds | C1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Foundational healing support. Existing SDM family variants: `Rehoryan's Progressive Restoration` and `Restorative Slumber`, which frame healing as regenerative or recuperative process rather than instant slot discharge. | partial | ✓ |
| Detect Evil | C1, MU2 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Basic cleric foundation spell. | partial | ✓ |
| Detect Magic | C1, MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Shared cleric / magic-user recognizer. | direct | ✓ |
| Light | C1, MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Shared cross-tradition light / darkness recognizer. Basic evidence lock: cleric form `Range 120'`, `Duration 12 turns`, `Effect volume 30' diameter`; magic-user form keeps the same volume with level-scaled duration. Reverse/darkness interaction remains a conversion edge case, but baseline trigger/effect envelope is now explicit from Basic spell text. | partial | ✓ |
| Protection from Evil | C1, MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Basic cleric defensive barrier spell. | partial | ✓ |
| Purify Food and Water | C1 | Basic, RC | Basic -> Spell Lists and Basic Spell Descriptions; RC -> Clerical Spells List and Spell Descriptions | spell | Basic purification and supply-safety support. Existing SDM family variant: `Process Food`, which turns unsafe or inedible organic matter into workable supplies; `Toxin Render` is a narrower waste-processing cousin rather than a straight purification duplicate. | partial | ✓ |
| Remove Fear | C1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Basic cleric fear-removal spell. Basic evidence lock: `Range Touch`, `Duration 2 turns`, single living target support; Basic casting guidance confirms use as active anti-fear support, while Expert preserves reverse-form behavior as a separate alias edge case. | partial | ✓ |
| Resist Cold | C1 | Basic, RC | Basic -> Spell Lists and Basic Spell Descriptions; RC -> Clerical Spells List and Spell Descriptions | spell | Basic cleric resistance foundation. Basic evidence lock: `Range 0`, `Duration 6 turns`, `Effect all creatures within 30'`. Remaining ambiguity is conversion taxonomy (hazard classes covered), not missing baseline trigger/effect data. | partial | ✓ |

#### Arcane (Basic-Anchored And Shared Entries)

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status | Ch06 Import |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Charm Person | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Core low-tier social control spell. Existing SDM family variant: `Hero's Goldenmouth` (Our Golden Age), which reframes charm as persuasive social capture rather than hard domination. | partial | ✓ |
| Fire Ball / Fireball | MU3 | Basic, Expert, Master, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Canonical mixed-name row: preserve `Fire Ball` (pre-RC BECMI) and `Fireball` (RC) as equivalent recognizer aliases. Existing SDM variant: `Pyreball` (Vastlands / Apocrypha of the O.S.). Keep as a family anchor for the likely fireburst relationship ladder with `Delayed Blast Fireball` and `Meteor Swarm`, not as proof those later entries must stay separate powers. | partial | ✓ |
| Floating Disc | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Existing SDM variant: `Floating Disc` (UVG2e Spells). | direct | ✓ |
| Hold Portal | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Low-tier closure / access-control spell. Existing SDM family variant: `Knock / Lock`, whose overcharge explicitly flings a portal open or seals, welds, or fuses it shut. | partial | ✓ |
| Light | C1, MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Arcane evidence lock: `Range 120'`, `Duration 6 turns + 1 turn/level`, `Effect volume 30' diameter`; cast on an object for moving light, cast at eyes for save-gated blindness, and reversed `Darkness` interacts as cancel/counter-cancel. Existing SDM cousins cover illumination/deception utility, so this remains a partial recognizer mapping rather than a one-to-one blindness-control clone. | partial | ✓ |
| Magic Missile | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Existing SDM variant: `Tragic Missile` (Vastlands / Apocrypha of the O.S.). | partial | ✓ |
| Protection from Evil | C1, MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Arcane defensive barrier; shared with cleric lane. | partial | ✓ |
| Read Languages | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Existing SDM family variant: `Anti-Babylon` (Eternal Return Key). | partial | ✓ |
| Read Magic | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Scrolls | spell | Core scroll / spellbook deciphering gate. | partial | ✓ |
| Shield | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Personal defense shell. Chapter 06 canonical import surface is `Shield Ward (Shield)`, with `Entropic Shield` tracked as a sibling FTLS variant expression rather than a replacement recognizer. | direct | ✓ |
| Sleep | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Core low-tier disable spell. | direct | ✓ |
| Ventriloquism | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Evidence lock: `Range 60'`, `Duration 2 turns`, and one item/location as the projected voice source within range; no direct damage, no save gate, and effect value is source-misattribution for deception/positioning. Existing SDM cousins live in illusion/influence tooling, so this is promoted to partial rather than held as unresolved. | partial | ✓ |

#### Item And Interface Effects

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status | Ch06 Import |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Maps to Treasures / Treasure Maps |  | Basic, Expert, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | Treasure-location wrapper with normal, magical, combined, and special treasure lanes; niche but reusable lookup surface. Basic evidence lock: map prepared in advance by referee, may be partial/riddle form, and may require `Read Languages` for use. | custom | — |
| Protection / Protection Scrolls |  | Basic, Expert, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | Generic moving circle-of-protection wrapper shared by the specific protection scroll variants. Basic evidence lock: usable by any class, creates a moving 10' circle centered on reader, blocks listed creature entry, does not block their spell or missile attacks, and breaks if protected side initiates hand-to-hand attack. | partial | — |
| Protection from Lycanthropes |  | Basic, RC | Basic -> Protection Scrolls; RC -> Scrolls | item-effect | Circle protection scroll keyed to lycanthrope types by quantity band. | partial | — |
| Protection from Undead |  | Basic, RC | Basic -> Protection Scrolls; RC -> Scrolls | item-effect | Circle protection scroll keyed to undead by type and quantity. | partial | — |
| Spell Scrolls / Spells |  | Basic, Expert, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | Generic spell-scroll wrapper covering class restrictions, multi-spell payloads, and copy-versus-cast handling. | partial | — |
| Cursed / Cursed Scroll |  | Basic, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | Immediate curse-on-sight scroll wrapper; niche but persistent enough to deserve a canonical lookup row. Basic evidence lock: curse triggers on seeing writing; reading aloud is not required. | partial | — |

### E - Expert

#### Cleric

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status | Ch06 Import |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bless | C2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Morale and combat blessing lane. Expert evidence lock: applies to allies in a 20' square who are not yet in melee, granting +1 morale and +1 to attack/damage; reverse form (`Blight`) imposes mirrored penalties with a save gate. | partial | ✓ |
| Continual Light | C3, MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Clerical light / darkness lane as well as arcane one. Expert evidence lock: creates a permanent 30' radius bright-light field that ends only via `Dispel Magic` or `Continual Darkness`; eye-target cast can blind on failed save. Reverse form is full darkness that blocks infravision and mundane light until canceled. | partial | ✓ |
| Cure Blindness | C3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Condition-removal lane for sensory impairment. Existing SDM family variants: `Real-Time Rebuild` for bodily restoration and `Restorative Slumber` for longer-form burden/attribute recovery. | partial | ✓ |
| Cure Disease | C3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Disease-removal and anti-corruption-adjacent lane. Existing SDM family variant: `Real-Time Rebuild`, which explicitly flushes toxins or afflictions and restores damaged systems by power setting. | partial | ✓ |
| Find Traps | C2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Detection and hazard-reading spell. Expert evidence lock: reveals mechanical and magical traps within 30' via glow cue, but does not disclose trap type, disarm method, ambushes, or natural hazards. | partial | ✓ |
| Growth of Animal | C3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Creature enhancement / scaling lane. Expert evidence lock: doubles one normal/giant animal's size, strength, damage, and carrying capacity for 12 turns while leaving behavior, AC, and hit points unchanged; excludes intelligent animal races and fantastic creatures. | partial | ✓ |
| Hold Person | C2, MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Existing SDM variant: `Hlod Person` (Vastlands / Apocrypha of the O.S.). | direct | ✓ |
| Know Alignment | C2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Alignment/intention interrogation lane used for truthfulness and affiliation reads. | partial | ✓ |
| Locate Object | C3, MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Clerical object-direction lane. | direct | ✓ |
| Remove Curse | C3, MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Major curse-removal recognizer. Expert evidence lock: removes one curse from a character, item, or area, but some item curses are only temporarily lifted without higher-tier follow-up. Reverse form (`Curse`) is explicitly open-ended within bounded safe limits and includes a save gate, so this remains bespoke conversion doctrine. | custom | ✓ |
| Resist Fire | C2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Fire resistance and mitigation lane. | direct | ✓ |
| Silence 15' Radius | C2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Anti-speech and anti-spellcasting field lane. Expert evidence lock: the 30' sphere fully suppresses speech and spellcasting inside the area, can be fixed in place or attached to a failed-save target, and does not block hearing sounds from outside the sphere. Keep as a partial noospheric-jamming / casting-denial cousin rather than a full anti-magic shell. | partial | ✓ |
| Snake Charm | C2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Creature-specific charm/control spell. Expert evidence lock: charms up to 1 HD of snakes per caster level with no save, suppresses attacks unless provoked, and uses shorter duration against already-attacking snakes than in passive use. | partial | ✓ |
| Speak with Animals | C2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Baseline non-human communication lane for ecology and scouting play. | partial | ✓ |
| Speak with the Dead | C3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Strong family comparison point for `Speak With Husk`. | partial | ✓ |
| Speak with Plants | C4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Plant-sentience communication lane that completes the speak-with progression. Existing SDM family variant: `Anti-Babylon` (Eternal Return Key), which already covers communication with plants, animals, minerals, and data stores. | partial | ✓ |
| Sticks to Snakes | C4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Wood-to-serpent transformation and battlefield-weaponization lane. Keep as custom until material-to-creature conversion, obedience scope, and reversion/persistence rules are normalized. | custom | ✓ |
| Striking | C3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Weapon augmentation and combat support lane. Existing SDM family variant: `Imbue Edge`, which buffs an edged weapon's damage and lets it harm intangibles for the duration. | partial | ✓ |
| Animate Dead | C4, MU5 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Clerical necromancy lane for corpse animation, control, and ongoing minion obedience; the same recognizer also appears in arcane spell lists. Keep as custom and treat existing SDM necromancy as relationship guidance into `Animate Corpse` and Undeath-facing doctrine rather than as a flat one-to-one export. | custom | ✓ |
| Create Water | C4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Expedition sustainment lane for liquid-resource generation. Existing SDM cousins in `Process Food` and broader survival wrappers support a supply-doctrine mapping without requiring a literal slot-era clone. | partial | ✓ |
| Cure Serious Wounds | C4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Mid-tier healing support. Existing SDM family variants: `Rehoryan's Progressive Restoration` and `Real-Time Rebuild`, which provide stronger repair and regrowth scaling. | partial | ✓ |
| Dispel Magic | C4, MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Clerical Ethereal Counter Magitech lane. Expert evidence lock: affects spell effects in a 20' cube, auto-dispels effects cast by equal-or-lower caster level, and has 5% failure per level when challenging higher-level magic; does not affect ordinary magic items. Keep as a bespoke ECM conversion anchor rather than a generic resistance buff. | custom | ✓ |
| Neutralize Poison | C4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | Poison-cleansing and poison-creation lane. Existing SDM family variant: `Real-Time Rebuild`, which explicitly flushes toxins at lower power settings. | partial | ✓ |

#### Arcane

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status | Ch06 Import |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Continual Light | C3, MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Higher-tier light / darkness lane. Expert evidence lock: creates a permanent 30' radius bright-light field that ends only via `Dispel Magic` or `Continual Darkness`; eye-target cast can blind on failed save. Reverse form is full darkness that blocks infravision and mundane light until canceled. | partial | ✓ |
| Detect Evil | C1, MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Needs care because classic BECMI intent/hostility reading is not identical to a clean moral-alignment scanner. | partial | ✓ |
| Detect Invisible | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Arcane perception / anti-concealment lane. Existing SDM family variant: `Eyes of Akaula`, which sees invisible, hidden, departed, and dead things. | partial | ✓ |
| Dispel Magic | C4, MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Major Ethereal Counter Magitech recognizer. Expert evidence lock: affects spell effects in a 20' cube, auto-dispels effects cast by equal-or-lower caster level, and has 5% failure per level when challenging higher-level magic; does not affect ordinary magic items. Keep as a bespoke ECM conversion anchor rather than a generic resistance buff. | custom | ✓ |
| ESP | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Thought-reading / awareness lane. Existing SDM family variant: `Yellow Foresight`, which reads sentient presence and general mood rather than exact thoughts. | partial | ✓ |
| Fly | MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Core aerial movement recognizer. | direct | ✓ |
| Invisibility | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Core concealment baseline for personal stealth and line-of-sight disruption. Existing SDM family variants: `Ecosphere Veil` for disregard-based stealth and `Yellow Cloud` for visual obscuration. | partial | ✓ |
| Invisibility 10' radius | MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Canonical display form is `Invisibility 10' radius`; retain `Invisibility 10' Radius` as a source alias recognizer. `Yellow Cloud` is the clearest existing Luka-style battlefield-scale concealment cousin. | partial | ✓ |
| Knock | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Existing SDM variant: `Knock / Lock` (UVG2e Spells). | partial | ✓ |
| Levitate | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Vertical movement recognizer. | direct | ✓ |
| Lightning Bolt | MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Core line-artillery recognizer. | direct | ✓ |
| Locate Object | C3, MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Arcane search / direction lane. | direct | ✓ |
| Mirror Image | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Defensive illusion / misdirection lane. Expert evidence lock: creates 1-4 adjacent duplicates that track caster movement and speech; each successful single-target hit removes one image instead of striking the caster, while area effects clear all images and still affect the caster. | partial | ✓ |
| Phantasmal Force | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Core illusion-construction spell. Expert evidence lock: concentration-sustained illusion over a 20' cube that can simulate terrain, monsters, or attacks; disbelief/save behavior and non-real damage handling (unconscious/paralyzed stand-ins with short wear-off) make this a bespoke adjudication procedure rather than a direct effect clone. | custom | ✓ |
| Protection from Evil 10' Radius | C4, MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Group-radius extension of the protection boundary lane. Canonical Chapter 06 display form is `Protection from Evil 10' Radius`; lowercase `10' radius` is retained as a source alias recognizer. Keep as a partial family variant of `Protection from Evil`. | partial | ✓ |
| Protection from Normal Missiles | MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Projectile-denial boundary lane for nonmagical missile vectors. Chapter 05 should treat this as an ward with explicit projectile-category exceptions rather than a generic defense bonus. | custom | ✓ |
| Water Breathing | Dr3, MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Druidic and Magical Spells Lists and Spell Descriptions | spell | Aquatic adaptation/access lane that should be modeled as environment-interface doctrine (breath medium override plus pressure/exposure assumptions) rather than simple movement speed text. Chapter 06 recognizer surface currently uses `Swamp's Gift (Water Breathing)`; retain canonical `Water Breathing` as the API key. | custom | ✓ |
| Web | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Area restraint and denial spell. | direct | ✓ |
| Wizard Lock | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Arcane closure / keyed barrier lane. Existing SDM family variant: `Knock / Lock`, which already handles opening, locking, and forcibly sealing portals, including resistance from magical locks. | partial | ✓ |
| Anti-Magic Shell | MU6 | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Major counter-magic boundary recognizer. Expert evidence lock: creates a near-body personal barrier that blocks spells and spell effects in both directions, including the caster's own magic while active; only `Wish` bypasses direct cancellation. Treat as a bespoke ECM shell with explicit ingress/egress and suppression behavior, not as a generic resistance buff. | custom | ✓ |
| Animate Dead | C4, MU5 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Existing SDM variant: `Animate Corpse` (UVG2e Spells), but the classic row still needs custom doctrine for command scope, persistence, and corpse-source handling. Treat this as a relationship note, not a replacement. | custom | ✓ |
| Charm Monster | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Broad creature-charm lane. Existing SDM family variant: `Hero's Goldenmouth`, but only as a broad persuasive-capture cousin; the current corpus does not yet provide a clean nonhuman domination equivalent. | partial | ✓ |
| Clairvoyance | MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Remote-sight lane. Existing SDM family variant: `Eyes of the Arrow` (Vastlands / The Viridian Practice), a projectile-bound remote sensor. | partial | ✓ |
| Cloudkill | MU5 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | High-tier battlefield hazard / area denial lane. Expert evidence lock: drifting poison cloud (30' across, 20' tall) moves with wind/caster direction, sinks into low spaces, and disperses against thick vegetation; all living targets take ongoing damage and sub-5 HD targets also risk death by poison save failure. | custom | ✓ |
| Confusion | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Mind-disruption lane. | partial | ✓ |
| Conjure Elemental | MU5 | Expert, Companion, Immortals, RC | Expert -> Clerical and Magic-User Spell Expansions; Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items; Immortals -> Section 3: Immortal Magic -> Conjuring and Summoning; RC -> Magical Spells List and Spell Descriptions | spell | Foundational elemental-calling recognizer with cross-book spell and item relevance. | partial | ✓ |
| Death Spell | MU6 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | High-tier kill / sweep spell lane. Expert evidence lock: resolves against a 4-32 HD budget inside a 60' cube, applies to lowest-HD living targets first, excludes undead and 8+ HD creatures, and uses Death Ray saves for survivability. | custom | ✓ |
| Dimension Door | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Short-range relocation entry that bridges tactical repositioning and teleport doctrine. | partial | ✓ |
| Disintegrate | MU6 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Matter-destruction lane. Expert evidence lock: single-target annihilation for creatures or nonmagical objects (Death Ray save allowed), with explicit non-interaction against magic items and active spell effects. | custom | ✓ |
| Geas | MU6 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Compulsion / binding lane. Expert evidence lock: imposes a specific perform/avoid command with a spell save gate, rebounds if the command is impossible or directly suicidal, and applies escalating penalties until obedience; explicitly not removable by `Dispel Magic` or `Remove Curse` in base form. | custom | ✓ |
| Growth of Plants | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Terrain / vegetation alteration lane. Existing SDM family variant: `Green Haven`, which coerces vegetation into shelter and thorn barriers; it is a narrower plant-shaping cousin rather than a pure growth accelerator. | partial | ✓ |
| Hallucinatory Terrain | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Large-scale illusion / terrain falsification lane. Expert evidence lock: creates an indoor or outdoor terrain-feature illusion that can mask real features, persists until dispelled or touched/tested by an intelligent creature, and functions as deception rather than physical terrain rewrite. | partial | ✓ |
| Haste | MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Acceleration and combat-tempo support. Existing SDM family variant: `Nunka's Biophysical Overdrive`, which expresses haste-like speed and output boosts as metabolic overdrive with exhaustion burdens. Likely future relationship-group candidate for a single SDM power with Overcharge riders instead of multiple near-duplicate exports. | partial | ✓ |
| Hold Monster | MU5 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Higher-tier restraint extension of the hold-family control recognizer. | partial | ✓ |
| Ice Storm/Wall | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Hybrid artillery / wall-control lane. Expert evidence lock: dual-mode cast (short-duration damage storm with save-for-half, or longer wall geometry with breach damage and creature-type exceptions), with explicit area constraints and support requirements for wall placement. Good candidate for overcharge tiers if paired with lower/higher weather-control siblings. | custom | ✓ |
| Infravision | MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Sensory enhancement lane. Existing SDM family variant: `Rehoryan's Prophetic Song`, which can grant night vision as a durable biomantic adaptation instead of temporary spell vision. | partial | ✓ |
| Invisible Stalker | MU6 | Expert, Immortals, RC | Expert -> Clerical and Magic-User Spell Expansions; Immortals -> Section 3: Immortal Magic; RC -> Magical Spells List and Spell Descriptions | spell | Precision servitor-calling lane for pursuit, scouting, and delegated action. | partial | ✓ |
| Lower Water | MU6 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Hydrology-control and exposure-engineering lane. Expert evidence lock: affects up to 10,000 square feet by halving water depth for 10 turns, can strand vessels, and ends with a hazardous refill surge that can clear decks and damage hulls. Keep as a custom terrain/environment procedure rather than a movement rider. | custom | ✓ |
| Magic Jar | MU5 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Existing SDM variant: `Magic Jar` (UVG2e Spells). | partial | ✓ |
| Massmorph | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Group disguise / illusion-transformation lane. Expert evidence lock: disguises up to 100 man-sized willing targets as trees over a large area, remains active until dispelled or dismissed, and drops per-target only when a disguised subject exits the affected area. | partial | ✓ |
| Pass-Wall / Passwall | MU5 | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Canonical mixed-name row: preserve `Pass-Wall` (pre-RC BECMI) and `Passwall` (RC) as equivalent recognizer aliases. Chapter 06 recognizer surface currently uses `Veilwalk (Pass-Wall)` while preserving the canonical key. Existing SDM family variant: `Linked Portals`, used here as a controlled passage-through-barriers cousin rather than a literal wall-phasing duplicate. | partial | ✓ |
| Polymorph Other / Others | MU4 | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Canonical mixed-name row: preserve `Polymorph Other` (heading form) and `Polymorph Others` (list/index form) as equivalent recognizer aliases. Expert evidence lock: target-facing permanent-until-dispelled transformation with spell save, HD-ratio limit (new form max 2x original HD), and behavior/tendency inheritance from the new form. | partial | ✓ |
| Polymorph Self | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Existing SDM family variants: `Alter Self`, `Skinshift`. Expert evidence lock: self-only timed form change with HD cap (new form <= caster HD), preserves the caster's AC/hit points/hit rolls/saves, grants physical but not special/supernatural abilities, and blocks spellcasting while transformed. | partial | ✓ |
| Projected Image | MU6 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Remote duplicate / projection lane. Expert evidence lock: creates a non-corporeal visual double at range that can origin-point apparent spellcasting while the real caster still needs target visibility; image ignores spells/missiles and collapses on physical contact or melee strike. | partial | ✓ |
| Remove Curse | C3, MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | Arcane curse-removal lane. Expert evidence lock: removes one curse from a character, item, or area, but some item curses are only temporarily lifted without higher-tier follow-up. Reverse form (`Curse`) is explicitly open-ended within bounded safe limits and includes a save gate, so this remains bespoke conversion doctrine. | custom | ✓ |
| Stone to Flesh | MU6 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Petrification-reversal lane. Expert evidence lock: restores petrified targets or converts large stone volume to flesh; reverse form (`Flesh to Stone`) is a save-gated petrification effect that includes carried gear. | partial | ✓ |
| Teleport | MU5 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Major transit spell; compare `Linked Portals` as a family cousin. | partial | ✓ |
| Wall of Fire | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Barrier-plus-damage lane that bridges battlefield denial and direct harm. Treat as partial pending fire-family consolidation with existing fireburst descendants such as `Pyreball`. | partial | ✓ |
| Wall of Stone | MU5 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Structural barrier/infrastructure creation lane. Keep as custom until Chapter 06 codifies persistent obstacle geometry, breach rules, and noncombat construction handling. | custom | ✓ |
| Wizard Eye | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | Remote-sight scouting sensor that pairs cleanly with clairvoyance-like reveal procedures. | partial | ✓ |

#### Item And Interface Effects

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status | Ch06 Import |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Protection from Elementals |  | Expert, RC | Expert -> Protection Scrolls; RC -> Scrolls | item-effect | Circle protection scroll keyed specifically to elementals. | partial | — |
| Protection from Magic |  | Expert, RC | Expert -> Protection Scrolls; RC -> Scrolls | item-effect | Protection-scroll ECM ward that creates a 10' moving circle around the reader. Expert evidence lock: no spells or spell effects, including item-origin effects, may cross in or out; duration is 1-4 turns; only `Wish` can break it early. Useful as a Chapter 05 boundary-interface denial model rather than generic resistance. Candidate for ECM. | custom | — |
| Spell Storing |  | Expert, Companion, RC | Expert -> Rings; Companion -> Ring Tables; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | Ring-based spell payload storage and later discharge; should convert as an item-side power archive with Power Level capacity and release rules, not as prepared-slot retention, and it does not absorb attacks cast at the wearer. | custom | — |
| Ring of Spell Turning |  | Expert, RC | Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | Reflects 2-12 incoming spell attacks back to their casters; distinct from absorption in that the spell is redirected rather than consumed. Expert evidence lock: finite reflection budget is consumed per reflected spell attack, and the incoming hostile payload is redirected at original force rather than stored. A core ECM item model at the Expert tier alongside Ring of Spell Eating at higher weight. | custom | — |

### C - Companion

#### Cleric

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status | Ch06 Import |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Aerial Servant | C6 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Summoned retrieval-agent procedure with logistics and custody implications. | partial | ✓ |
| Animate Objects | C6 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Object animation lane. | partial | ✓ |
| Barrier | C6 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | High-tier warding and boundary-control spell that should help define Chapter 06 barrier taxonomy above simple protection buffs, especially exclusion and anti-passage behavior. | custom | ✓ |
| Commune | C5 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Divine consultation and constrained-answer procedure for high-confidence guidance, likely better treated as bespoke oracle/contact doctrine than as ordinary divination throughput. | custom | ✓ |
| Create Food | C5 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Supply-generation and survival support. Existing SDM family variant: `Process Food`, which converts raw matter into usable rations; `Green Haven` is a secondary expedition-sustainment cousin where the classic row is read as camp support rather than pure conjuration. | partial | ✓ |
| Create Normal Animals | C6 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Creature-fabrication lane distinct from summoning. Use as the low-tier anchor of the creation bundle with explicit ecology/load constraints and encounter-pressure outputs. Existing SDM seed power: `Vegetable of Birth` (There A Red Door), which already models creature-seed gestation into full creature emergence. | custom | ✓ |
| Cure Critical Wounds | C5 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Higher-tier healing upgrade. | direct | ✓ |
| Cureall | C6 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Broad healing / cleanse package. | partial | ✓ |
| Dispel Evil | C5 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Counterforce / banishment lane. | partial | ✓ |
| Earthquake | C7 | Companion, Master, RC | Companion -> High-Level Cleric Spell Material; Master -> Seventh-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | High-tier terrain and structural disruption lane. Evidence lock: outdoor terrain section up to 60' square at C17 (plus 5' per level above), with structural collapse and rockslide effects in-area, and crack-engulf risk resolved as random target selection with a Death save escape gate; effect ends after 1 turn. Keep as custom due to encounter-scale terrain rewrite and destruction doctrine. | custom | ✓ |
| Find the Path | C6 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Navigation and route-certainty lane. | partial | ✓ |
| Holy Word | C7 | Companion, Master, RC | Companion -> High-Level Cleric Spell Material; Master -> Seventh-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | High-tier word of power / banishment lane. Existing SDM family variant: `Sense Allegiance`, which provides the clearest current ethical-targeting plus stun/interdiction cousin, though it is much narrower than the full clerical word-of-power package. | partial | ✓ |
| Insect Plague | C5 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Battlefield swarm / area-denial lane. Evidence lock: outdoor/above-ground only 30' radius swarm with 1-day duration; drives off sub-3 HD creatures (no save), obscures visibility, and requires caster concentration plus no movement to steer up to 20' per round; disturbance ends control and disperses the swarm. Keep as custom because concentration-bound hazard steering and HD-threshold routing are bespoke. | custom | ✓ |
| Quest | C5 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Compulsion / obligation lane that likely needs vow-binding or command-doctrine framing with explicit fulfillment and breach consequences, not just a flat charm/status export. | custom | ✓ |
| Raise Dead | C5 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Companion lane for the classic recognizer before Master expansions. Treat as the baseline resurrection recognizer and keep distinct from `Raise Dead Fully` (do not alias-collapse). Existing SDM variant: `Raise Dead` (UVG2e Spells), with `Recall Soul` as a strong soul-return ritual cousin where the conversion wants explicit soul-handling. | partial | ✓ |
| Raise Dead Fully | C7 | Companion, Master, RC | Companion -> High-Level Cleric Spell Material; Master -> Seventh-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | Higher-tier resurrection lane beyond basic revival, likely requiring bespoke life-restoration doctrine or ritual-grade threshold handling with explicit body-integrity and post-return consequences rather than a simple stronger `Raise Dead`. Keep as a deliberately separate canonical row from `Raise Dead`, not a naming variant. | custom | ✓ |
| Restore | C7 | Companion, Master, RC | Companion -> High-Level Cleric Spell Material; Master -> Seventh-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | Restoration / anti-drain / recovery lane. | partial | ✓ |
| Speak with Monsters | C6 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Broad creature-negotiation lane beyond animal and plant channels. Existing SDM family variant: `Anti-Babylon` (Eternal Return Key), which generalizes communication across entities rather than preserving narrow species lanes. | partial | ✓ |
| Truesight | C5 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Reveal-all / anti-concealment lane. | partial | ✓ |
| Word of Recall | C6 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Return-to-sanctuary transit lane. | partial | ✓ |

#### Arcane

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status | Ch06 Import |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Contact Outer Plane | MU5 | Companion, Immortals, RC | Companion -> Fifth-Level Magic-User Spells; Immortals -> Section 3: Immortal Magic; RC -> Magical Spells List and Spell Descriptions | spell | Dangerous intelligence-contact and revelation procedure that reaches across planar distance with explicit backlash risk; better treated as bespoke high-tier inquiry doctrine than generic divination. Immortals preserves the same effect family while explicitly removing the insanity risk for Immortal characters. | custom | ✓ |
| Charm Plant | MU7 | Companion, RC | Companion -> Seventh-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Plant-specific command/control lane. Keep as custom until plant-agency and obedience boundaries are normalized against broader influence doctrine. | custom | ✓ |
| Create Normal Monsters | MU7 | Companion, RC | Companion -> Seventh-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Mid-tier creature-fabrication lane below magical and any-monster endpoints. In the creation bundle, this is the first monster-grade step after `Create Normal Animals`, with bounded taxonomy and encounter-pressure outputs. | custom | ✓ |
| Summon Object | MU7 | Companion, RC | Companion -> Seventh-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Remote retrieval and object-call lane. | partial | ✓ |
| Sword | MU7 | Companion, RC | Companion -> Seventh-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Force-weapon and animated blade lane. Evidence lock: caster-concentration directed magical blade at 30' that attacks twice per round using caster attack level, deals two-handed sword damage, and can strike targets requiring high-grade magical hit capability; concentration break pauses attacks but not duration, while dispel/wish can end the blade early. | partial | ✓ |
| Teleport any Object | MU7 | Companion, RC | Companion -> Seventh-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Object-only transit lane adjacent to `Teleport`. | partial | ✓ |

#### Item And Interface Effects

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status | Ch06 Import |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Communication |  | Companion, RC | Companion -> Scrolls; RC -> Scrolls | item-effect | Paired remote-writing scroll interface across any distance on the same plane. | partial | — |
| Creation |  | Companion, RC | Companion -> Scrolls; RC -> Scrolls | item-effect | Scroll-generated temporary mundane item fabrication procedure. Companion constrains this to one normal non-living item up to 5' x 10' x 1' and 5,000 cn, forbids magic and living outputs, and auto-expunges the result on command or after 24 hours. Strong Chapter 05 model for temporary fabricated gear with hard material and duration limits rather than freeform conjuration. | custom | — |
| Delay |  | Companion, RC | Companion -> Scrolls; RC -> Scrolls | item-effect | Scroll-carried delayed-release wrapper for one stored spell payload; Chapter 05 should model this as a trigger/interface note with deferred activation timing rather than as held slot-state. | custom | — |
| Equipment |  | Companion, RC | Companion -> Scrolls; RC -> Scrolls | item-effect | Scroll that manifests from a fixed list of mundane adventuring gear. Companion fixes six named gear entries on the parchment, allows any three to be manifested per day within 10', and restores the name only when the created item vanishes. Good Chapter 05 precedent for menu-based utility fabrication instead of open-ended item creation. | custom | — |
| Illumination |  | Companion, RC | Companion -> Scrolls; RC -> Scrolls | item-effect | Reusable flame-scroll utility for sustained light and fire-starting. | direct | — |
| Mages |  | Companion, RC | Companion -> Scrolls; RC -> Scrolls | item-effect | Scroll-based nearby magic-effect identification; complements `Read Magic` rather than replacing it. | partial | — |
| Mapping |  | Companion, RC | Companion -> Scrolls; RC -> Scrolls | item-effect | Scroll-generated area map with limited secret-door detection. Companion makes this a once-per-day survey tool for a chosen fully-contained area within 100', up to 10,000 square feet. Useful Chapter 05 example for bounded reconnaissance interfaces that create records rather than immediate tactical effects. | custom | — |
| Portals |  | Companion, RC | Companion -> Scrolls; RC -> Scrolls | item-effect | Scroll-native reusable `Pass-Wall / Passwall` interface. | partial | — |
| Questioning |  | Companion, RC | Companion -> Scrolls; RC -> Scrolls | item-effect | Nonliving-object interrogation procedure. | partial | — |
| Repetition |  | Companion, RC | Companion -> Scrolls; RC -> Scrolls | item-effect | Scroll wrapper that replays the same-level spell effect after one turn. | custom | — |
| Seeing |  | Companion, RC | Companion -> Scrolls; RC -> Scrolls | item-effect | Scroll-based remote creature imaging procedure. | partial | — |
| Shelter |  | Companion, RC | Companion -> Scrolls; RC -> Scrolls | item-effect | Pocket-room refuge scroll with supplies and extradimensional trapping edge cases. Companion gives this a furnished extradimensional room with replenishing food, temporary weapons, 12-hour use windows, and a severe trap state if the scroll is removed while occupants remain inside. Strong Chapter 05 model for refuge interfaces that bundle shelter, logistics, and containment risk. | custom | — |
| Spell Catching |  | Companion, RC | Companion -> Scrolls; RC -> Scrolls | item-effect | Catches one incoming spell into scroll capacity bands; strong Chapter 05/06 bridge case for hostile-power capture into storage media using explicit Power Level capacity rather than slot logic. | custom | — |
| Trapping |  | Companion, RC | Companion -> Scrolls; RC -> Scrolls | item-effect | Scroll-created physical trap keyed by placement surface. Companion ties payload to placement surface: floor for pit, ceiling for falling-block, otherwise poison-dart or gas logic, and the created trap is real rather than illusory. Good Chapter 05 precedent for trigger-bearing utility items that instantiate environmental hazards instead of casting direct attacks. | custom | — |
| Truth |  | Companion, RC | Companion -> Scrolls; RC -> Scrolls | item-effect | Living-mind question procedure via an enhanced ESP-like readout. | partial | — |
| Ring of Elemental Adaptation |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | Plane-keyed elemental survival ring available in seven variants (single element, paired Air/Water or Earth/Fire, or all-elements) that lets the wearer breathe and see normally within the matching Elemental Plane. Strong supporting interface for talisman/staff travel bundles, but narrower than those because it does not itself provide transit or command. | partial | — |
| Ring of Holiness |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | Cleric/druid power-augmentation wrapper tied to ring use; later conversion should express this as eligibility, blessing-layer access, or reduced burden around holy/nature powers rather than extra slot grant. | custom | — |
| Ring of Life Protection |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | Anti-drain and life-threshold safeguard interface with finite depletion behavior; useful as a threshold-protection model distinct from ordinary healing because it prevents or defers loss rather than repairing it after the fact. | custom | — |
| Ring of Memory |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | Immediate one-spell recall interface for spellcasters only: the wearer must choose within 1 turn of casting, then the spell is instantly relearned, with the ring restoring only one spell per day. Strong Chapter 05 model for short-horizon recovery/retention rather than passive memory bonuses or broad archive storage. | custom | — |
| Ring of Remedies |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | Bundled condition-repair and cleansing wrapper across multiple cure lanes; likely a reusable Chapter 05 model for one item exposing several tagged recovery functions instead of one-to-one spell copies. | custom | — |
| Ring of Spell Eating |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | Hostile spell-defense and absorption interface distinct from plain spell turning; a core Chapter 05 ECM item case for canceling or consuming incoming powers instead of merely reflecting them. | custom | — |
| Ring of Survival |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | Environmental hardening and hazard-resistance wrapper at item scale. | partial | — |
| Staff of Dispelling |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods; RC -> Chapter 16 Item Description Catalog -> Wands, Staves, and Rods | item-effect | Touch-based targeted dispel interface with special handling for potions, scrolls, and permanent items; likely a key Chapter 05 example for using `Level` as counterforce strength while preserving carrier-specific edge cases. | custom | — |
| Staff of the Druids |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods; RC -> Chapter 16 Item Description Catalog -> Wands, Staves, and Rods | item-effect | Druid power-augmentation and charge-linked upkeep interface; should convert as attuned access to druidic functions or bundled powers rather than as raw slot augmentation. | custom | — |
| Staff of an Element |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods; RC -> Chapter 16 Item Description Catalog -> Wands, Staves, and Rods | item-effect | Element-tuned summoning, negation, and planar operation interface; includes multi-element and elemental-power variants, so it is a strong Chapter 05 bundle case rather than a single-spell export. | custom | — |
| Staff of Harming |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods; RC -> Chapter 16 Item Description Catalog -> Wands, Staves, and Rods | item-effect | Cleric-only Chaotic harm staff: touch inflicts 2-7 damage in addition to normal staff damage at 1 charge per harmed creature, and it can spend 2/2/3/4 charges to deliver cause blindness, cause disease, cause serious wounds, or create poison as reversed cleric payloads. | custom | — |
| Rod of Health |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods; RC -> Chapter 16 Item Description Catalog -> Wands, Staves, and Rods | item-effect | Cleric-only healing rod that inherits the full staff-of-healing package without spending charges, but can affect any given creature only once per day regardless of which healing/remedy function is chosen. Useful Chapter 05 model for renewable recovery access with strict per-target cadence. | partial | — |
| Rod of the Wyrm |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods; RC -> Chapter 16 Item Description Catalog -> Wands, Staves, and Rods | item-effect | Alignment-keyed draconic interface: once per day the rod becomes a 30 hp servant dragon (gold, blue, or black by rod type) that can serve as messenger, steed, guard, or combatant, but a wrong-alignment user triggers immediate betrayal and a slain dragon form destroys the rod permanently. | custom | — |
| Quill of Copying |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Miscellaneous Items; RC -> Chapter 16 Item Description Catalog -> Miscellaneous Items | item-effect | Spell transcription and copy-risk procedure; strong Chapter 05/06 spell-handling bridge. | custom | — |
| Talisman of Elemental Travel |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Miscellaneous Items; RC -> Chapter 16 Item Description Catalog -> Miscellaneous Items | item-effect | Lesser talismans reverse a conjure elemental on the Prime Plane to send the wearer into one matching Elemental Plane while granting breathable element-matter and strong vision there; the greater talisman covers all planes and can spend up to 10 charges per trip to compel elemental obedience. Strong Chapter 05 bundle case for transit, adaptation, and command in one interface. | custom | — |
| Slate of Identification |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Miscellaneous Items; RC -> Chapter 16 Item Description Catalog -> Miscellaneous Items | item-effect | Item-identification procedure surface distinct from `Read Magic` and `Mages` scroll behavior. | partial | — |

#### Druid

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status | Ch06 Import |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Anti-Animal Shell | Dr6 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Creature-class exclusion boundary for fauna and beast-adjacent targets. Treat as boundary taxonomy doctrine (who is denied passage, what qualifies as target class) rather than ordinary protection math. | custom | ✓ |
| Anti-Plant Shell | Dr5 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Vegetation-class exclusion boundary. This is a custom barrier-interface case for passage denial against plant entities/effects, not a generic resistance shell. | custom | ✓ |
| Call Lightning | Dr3 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Druidic artillery recognizer. Evidence lock: requires active storm within range, grants one 20' strike zone bolt per turn for duration, deals 8d6 electrical damage with save-for-half, and permits deferred bolt cadence while the spell remains active; ends when duration expires or weather prerequisite breaks. | partial | ✓ |
| Control Temperature 10' radius | Dr4 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Canonical display form is `Control Temperature 10' radius`; retain `Control Temperature 10' Radius` as a source alias recognizer. Evidence lock: self-centered moving 20' diameter microclimate, immediate up/down shift up to 50 F, optional round-by-round retuning by concentration, and fixed end-state at duration expiry. | partial | ✓ |
| Control Winds | Dr5 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Directional weather-force control with direct movement, hazard, and projectile-pressure implications. Keep as custom environment-control doctrine pending full weather suite normalization. | custom | ✓ |
| Creeping Doom | Dr7 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | High-tier swarm devastation lane. Evidence lock: summons a 1,000-insect swarm occupying at least 20' x 20' (expandable to 60' x 60') that inflicts automatic scaling damage (up to 100/round per creature in zone), moves while caster remains within 120', and ends on duration expiry, range break, or successful dispel. Keep as custom for high-complexity autonomous hazard behavior. | custom | ✓ |
| Faerie Fire | Dr1 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Outlining / reveal lane. Evidence lock: non-damaging visibility outline at 60' that can mark detected creatures/objects and grants +2 attack bonus against marked targets; footprint scales by caster level in man-sized equivalents and ends cleanly on duration expiry. | partial | ✓ |
| Hold Animal | Dr3 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Beast-specific restraint lane. Evidence lock: affects normal/giant animals only (excluding fantastic or higher-intelligence targets), applies HD-budget targeting by caster level, and requires spell saves to resist long-duration paralysis; summoned/conjured/controlled animals remain valid targets. | partial | ✓ |
| Locate | Dr1 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Druidic animal / plant location lane. Evidence lock: self-range directional sense for one named normal or giant animal/plant type within 120', with explicit exclusions (fantastic creatures, plant monsters, intelligent targets) and no save on qualifying targets; ends after 6 turns. | partial | ✓ |
| Metal to Wood | Dr7 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Material transformation lane. Evidence lock: permanently transmutes metal to dead wood by level-scaled weight budget, with strong magic-item resistance and explicit gear outcomes (armor drops, weapons degrade to wooden clubs); not reversible by standard dispel. Keep as custom because permanence and transformation side effects require bespoke handling. | custom | ✓ |
| Obscure | Dr2 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Concealment / weather-obscuration lane. Existing SDM family variant: `Yellow Cloud`, which creates an opaque dust veil and can overcharge into an immobile wall of obscuring material. Primary placement belongs with terrain/environment because the effect works by materially altering battlefield atmosphere rather than pure false imagery. | partial | ✓ |
| Pass Plant | Dr5 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Plant transit lane. Existing SDM family variant: `Linked Portals`, used here as a traversal cousin rather than a literal vegetation-only doorway. Primary placement stays with mobility because the row's job is passage, not plant reshaping. | partial | ✓ |
| Plant Door | Dr4 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Vegetation access / doorway lane. Existing SDM family variant: `Linked Portals`, which is the closest current controlled-passage precedent even though the classical wrapper is plant-specific. | partial | ✓ |
| Predict Weather | Dr1 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Forecast and horizon-reading lane. Treat as a custom environment-intelligence interface feeding travel and hazard-prep procedures rather than generic divination. | custom | ✓ |
| Produce Fire | Dr2 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Portable flame / attack lane. Evidence lock: conjures non-self-harming torch-grade flame in hand with duration scaling, supports ignition utility and short-range throw/drop delivery, and allows on/off toggling by concentration while active. | partial | ✓ |
| Protection from Lightning | Dr4 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Elemental defense lane. Evidence lock: touch-applied lightning protection grants level-scaled d6 damage cancellation pool, carries through multiple electrical attacks until pool exhaustion, and then reverts to normal save/damage handling on overflow hits. | partial | ✓ |
| Summon Weather | Dr6 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Weather-calling and macro-environment override lane. Keep as custom until weather-scale intensity, duration, and collateral doctrine are codified. | custom | ✓ |
| Transport Through Plants | Dr6 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Plant-network transit lane. Existing SDM family variant: `Linked Portals`, which already expresses location-bridging as a distinct traversal procedure. | partial | ✓ |
| Warp Wood | Dr2 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Wooden-structure deformation lane. Evidence lock: permanently warps wooden weapons only by arrow-equivalent capacity budget, with save opportunities for wielded magical targets and plus-based resist chances; excludes non-weapon wooden objects. | partial | ✓ |
| Water Breathing | Dr3, MU3 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic and Magical Spells Lists and Spell Descriptions | spell | Druidic aquatic adaptation/access lane that should be modeled as environment-interface doctrine (breath medium override plus pressure/exposure assumptions). Chapter 06 recognizer surface currently uses `Swamp's Gift (Water Breathing)` while keeping canonical `Water Breathing` as the key. Duplicate flat-catalog rows for this name represent provenance-lane continuity, not separate recognizers. | custom | ✓ |
| Weather Control | Dr7, MU6 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic and Magical Spells Lists and Spell Descriptions | spell | High-tier weather command lane crossing druidic and arcane traditions. Keep as custom suite anchor for chapter-scale climate control, hazard shaping, and travel pressure. | custom | ✓ |

### M - Master

#### Cleric And Druid

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status | Ch06 Import |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Detect Danger | Dr1 | Master, RC | Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Hazard-sense hybrid lane combining detection and danger reading. Existing SDM family variant: `Yellow Foresight`, which scans a wide area for sentients and general mood. | partial | ✓ |
| Dissolve | Dr5, MU5 | Master, RC | Master -> Druid Spell Material; RC -> Druidic and Magical Spells Lists and Spell Descriptions | spell | Terrain-liquefaction lane; compare mud / stone transmutation effects. Evidence lock: transmutes non-construction soil/rock volume (up to 3,000 sq ft and 10' depth/thickness) within range into deep mud that slows movement to 10% and can trap targets; reverse (`Harden`) can permanently lock the same volume into rock with save-gated escape from entrapment. Keep as custom because reversible terrain-state conversion is a bespoke battlefield/environment procedure. | custom | ✓ |
| Heat Metal | Dr2 | Master, RC | Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Sustained heat / anti-armor / concentration-break lane. Evidence lock: level-scaled target-mass metal heating over 7 rounds with escalating then tapering damage (no save), optional drop behavior, ignition side effects at peak heat, and concentration disruption on damage ticks; magical targets resist damage side effects while nonmagical composites degrade. Keep as custom due multi-round escalation and equipment-state interaction doctrine. | custom | ✓ |
| Protection from Poison | Dr3 | Master, RC | Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Poison immunity and anti-breath lane. Existing SDM family variant: `Real-Time Rebuild`, which is still a recovery-style toxin-handling cousin rather than true prophylactic immunity, so this remains only a partial match. | partial | ✓ |
| Summon Animals | Dr4 | Master, RC | Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Existing high-confidence family lane for druidic ally summoning. | partial | ✓ |
| Summon Elemental | Dr7 | Master, RC | Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Druidic elemental-calling lane complementary to Conjure Elemental. | partial | ✓ |
| Survival | C7, MU9 | Master, RC | Master -> Seventh-Level Cleric Spells; RC -> Clerical and Magical Spell Descriptions | spell | Hazard-environment life support package for void, plane, and extreme condition play. | partial | ✓ |
| Travel | C7, MU8 | Master, RC | Master -> Seventh-Level Cleric Spells; Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Clerical and Magical Spell Descriptions | spell | Composite traversal package combining flight, gaseous movement, and adjacent-plane transfer; probably needs Chapter 06 decomposition or a premium bundled mobility power with environment/survival riders instead of a flat one-to-one export. | custom | ✓ |
| Turn Wood | Dr6 | Master, RC | Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | Wooden-object repulsion and vector-redirection lane. Treat as a custom material-interaction control effect with explicit category targeting and displacement behavior. | custom | ✓ |
| Wish | C7, MU9 | Master, RC | Master -> Seventh-Level Cleric Spells; Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Clerical and Magical Spell Descriptions | spell | High-tier reality rewrite recognizer; existing SDM variant: `Big Wish`. Preserve `Wish` as the canonical heading and treat `Big Wish` as the tone-forward descendant, with later conversion likely framed as ritual-grade exception doctrine rather than an ordinary Chapter 06 export. | custom | ✓ |
| Wizardry | C7 | Master, RC | Master -> Seventh-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | Cross-tradition item / scroll use bridge lane. Evidence lock: grants temporary legal use of one magic-user device or one 1st-2nd level magic-user scroll spell for one turn (or until used), including procedural knowledge transfer and minimum-caster-level effect handling. Keep as custom as a rules-eligibility bridge rather than a standard effect payload. | custom | ✓ |

#### Arcane

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status | Ch06 Import |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Clone | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Identity-duplication and backup-body procedure with delayed death-insurance implications, clearly beyond a simple one-power mapping and likely needing custom continuity/body-vault doctrine. | custom | ✓ |
| Contingency | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Conditional trigger/do-if framework for precommitted defensive or utility responses. Treat as custom meta-procedure because Chapter 06 needs explicit trigger grammar, stored payload scope, and precommit limits. | custom | ✓ |
| Create Any Monster | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Apex creature-fabrication endpoint with broadest taxonomy scope. Capstone of the creation bundle above normal and magical tiers; requires strict doctrine for command reliability, persistence failure modes, and campaign-scale ecosystem/faction impact. | custom | ✓ |
| Create Magical Monsters | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | High-tier magical-creature fabrication lane. Midpoint of the creation bundle between normal-monster and any-monster endpoints, with explicit complexity, special-ability budgeting, and control-burden escalation. | custom | ✓ |
| Dance | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Forced-movement / compulsion lane. Evidence lock: touch-delivered no-save incapacitation forcing dance behavior, with explicit inability to attack/cast/flee plus save/AC penalties and tiered duration scaling by caster level band. | partial | ✓ |
| Explosive Cloud | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | High-tier area hazard lane. Evidence lock: cloudkill-profile moving cloud that imposes repeat saves each round to avoid paralysis while simultaneously dealing unavoidable per-round explosion damage that bypasses conventional elemental immunities. Keep as custom for mixed-condition plus immunity-piercing hazard logic. | custom | ✓ |
| Force Field | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Premium structural barrier lane and Chapter 05 interface anchor for layered ward persistence, directional blocking, and throughput exceptions. | custom | ✓ |
| Gate | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Planar aperture and translocation endpoint for high-tier traversal and summoning crossover, likely a bespoke apex mobility/interface effect rather than a generic teleport derivative. | custom | ✓ |
| Heal | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Extreme recovery recognizer crossing clerical and arcane traditions at high tier, likely collapsing multiple cure/cleanse/restoration lanes into one bespoke capstone recovery procedure. | custom | ✓ |
| Immunity | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Apex blanket-protection lane spanning broad hazard categories. Keep as custom until Chapter 06 sets explicit immunity scope boundaries and exception taxonomy. | custom | ✓ |
| Mass Charm | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Group compulsion / social-control lane. Reverse form `Remove Charm` (see companion row) removes all charm effects in a given volume and suppresses object-charm for 1 turn; the RC indexes it as a standalone MU 8 entry. | custom | ✓ |
| Remove Charm | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Reverse of Mass Charm; area-charm clearing effect that removes all charm effects within a 20' x 20' x 20' volume and prevents objects in that area from creating charm effects for 1 turn. RC indexes this as a standalone MU 8 entry rather than a plain reverse annotation; the object-charm suppression rider is a bespoke procedure note with no direct SDM parallel yet. | partial | ✓ |
| Maze | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Exile and battlefield-removal boundary effect. Keep as custom due its spatial-separation logic and return-condition doctrine requirements. | custom | ✓ |
| Meteor Swarm | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Extreme artillery recognizer and capstone of the fireburst relationship ladder above `Fire Ball / Fireball` and `Delayed Blast Fireball`. Keep as custom for Phase 1 because the current corpus does not justify a clean direct export, but note the likely future overcharge-family relationship. | custom | ✓ |
| Mind Barrier | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | High-tier noospheric defense lane for hostile mental influence suppression. Keep as custom until mental-defense tags and intrusion categories are normalized. | custom | ✓ |
| Permanence | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Long-term enchantment anchoring and persistence-lock doctrine. Treat as custom because Chapter 06 must define what can be bound, maintenance costs/risks, and conditions for safe removal or collapse. | custom | ✓ |
| Polymorph Any Object | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Extreme transmutation endpoint that extends polymorph doctrine beyond creature targets and should remain a custom ceiling case for later Chapter 06 handling. Treat this as a relationship note to the broader polymorph suite, not as evidence for a simple direct map. | custom | ✓ |
| Power Word Blind | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Word-of-power debilitation lane. Evidence lock: no-save blindness at 120' for targets under fixed HP thresholds (longer duration for lower-HP targets), with explicit AC/save penalties and restricted cure access requiring equal-or-higher caster-tier clerical intervention. | partial | ✓ |
| Power Word Kill | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Word-of-power execution lane. Evidence lock: no-save word-effect at 120' with hard HP thresholds that kill low-HP targets and stun mid-HP targets, plus special save exception for magic-user-capable targets at penalty and multi-target low-HP kill mode. Keep as custom for threshold-gated lethal routing. | custom | ✓ |
| Prismatic Wall | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Complex high-tier barrier lane. The current SDM corpus does not provide a close named layered-spectrum wall analogue, so this likely needs bespoke high-tier barrier text rather than a borrowed family variant. | custom | ✓ |
| Feeblemind | MU5 | Master, RC | Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Severe cognition-destruction lane. Evidence lock: target class-limited to arcane-capable victims, save gate at penalty, and permanent cognition collapse to functional Int 2 until dispel/cureall remediation. Keep as custom for class-filter plus persistent cognitive-disable doctrine. | custom | ✓ |
| Move Earth | MU6 | Master, RC | Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Massive terrain repositioning and landscape engineering recognizer. Existing SDM family variant: `Dryland Sculpture`, which is a smaller-scale but high-confidence terrain-forming and infrastructure-shaping cousin rather than a direct mass-displacement duplicate. | partial | ✓ |
| Reincarnation | MU6 | Master, RC | Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Death-reversal via a new body rather than simple revival, so it should stay distinct from the `Raise Dead` line and carry replacement-form consequences in any later conversion. | custom | ✓ |
| Telekinesis | MU5 | Master, RC | Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Classic force-manipulation recognizer; compare `Objective Telekinesis` as a likely cousin. | partial | ✓ |
| Wall of Iron | MU6 | Master, RC | Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Durable material barrier plus infrastructure fabrication lane. Keep as custom where chapter procedures need explicit creation-versus-obstruction handling for persistent iron mass. | custom | ✓ |
| Lore | MU7 | Master, RC | Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Deep-history and object-reading lane useful for premium information-retrieval tags. | partial | ✓ |
| Magic Door | MU7 | Master, RC | Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Portal and egress manipulation lane with reversible entry-control logic. Existing SDM family variant: `Linked Portals`, which is the clearest current astral-bridge precedent for controlled passage and reversible entry. | partial | ✓ |
| Mass Invisibility | MU7 | Master, RC | Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | High-tier crowd concealment lane above the 10-foot-radius variant. `Yellow Cloud` remains the strongest existing crowd-obscuration precedent in the current SDM corpus. | partial | ✓ |
| Power Word Stun | MU7 | Master, RC | Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Word-of-power incapacitation lane between the blind and kill variants. | custom | ✓ |
| Reverse Gravity | MU7 | Master, RC | Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Battlefield-physics inversion and area-control exception effect, likely requiring custom environmental resolution language instead of ordinary force-attack mapping. | custom | ✓ |
| Statue | MU7 | Master, RC | Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Self-concealment and false-object transformation lane. Evidence lock: caster self-transformation toggled once per round into immobile AC-improved stone form with broad hazard immunities, breathing suspension, and reactive initiative bonus when shifting before incoming elemental attacks; magical attacks still apply and duration is long-form level scaled. Keep as custom due modal defense-state procedure complexity. | custom | ✓ |
| Shapechange | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Supreme self-transformation lane and ceiling case for self-directed form doctrine; compare `Skinshift` only as a distant family cousin. Keep as custom until Chapter 06 fixes duration, capability inheritance, and identity-stability policy. | custom | ✓ |
| Symbol | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Sigil-triggered boundary hazard lane. Treat as a custom trigger-interface package (condition, payload, and reset doctrine) instead of a plain static trap export. | custom | ✓ |
| Timestop | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Temporal supremacy lane and action-economy exception effect. Keep as custom because it rewrites scene sequencing rather than merely granting speed, and should remain separate from the ordinary acceleration family unless later doctrine proves otherwise. | custom | ✓ |

#### Procedures

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status | Ch06 Import |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Artifact Activation |  | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Activation/discovery interface for artifact powers; supports staged unlock and control workflows. Master emphasizes that possession is insufficient: activation and per-power control may require ritual, event, legend, or research, and discovery should unfold gradually. Strong Chapter 05 bridge case for attunement-plus-discovery doctrine rather than instant full access. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless a structurally equivalent `RC` procedure witness is later added. | custom | — |
| Artifact Charges And Recharge |  | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Artifact power-budget, charge-drain, and recharge-cycle doctrine for repeated effect use. Master ties artifact magnitude to total power budget, has each use drain charges equal to the selected power's cost, and treats recharge as regeneration over time rather than ordinary finite-item depletion. Useful Chapter 05 model for renewable high-tier reserves instead of consumable wand-style charge logic. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless a structurally equivalent `RC` procedure witness is later added. | custom | — |
| Artifact Intelligence And Auto-Defense |  | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Rudimentary artifact agency and self-defense behavior when attacked or endangered. Master presentation supports semi-autonomous artifact behavior, including telepathic guidance when worth is proven and separate protective logic from the bearer's ordinary action economy. Good Chapter 05/06 precedent for item-side will, refusal, and automatic defensive responses. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless a structurally equivalent `RC` procedure witness is later added. | custom | — |
| Artifact Handicaps And Penalties |  | Master, RC | Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Artifacts | procedure | Core adverse-effect framework for mortal artifact users (permanent handicaps and temporary penalties). RC directly preserves the handicap/penalty distinction; Master carries the fuller procedure surface. | custom | — |
| Attacking An Artifact |  | Master, RC | Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Artifacts | procedure | Artifact durability, attack-immunity boundaries, damage thresholds, power loss, and recall behavior under sustained attacks. RC confirms the immunity/destruction baseline; Master carries the fuller degradation procedure. | custom | — |
| Destruction Of An Artifact |  | Master, RC | Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Artifacts | procedure | Permanent-destruction quest procedure and Immortal-response consequences. RC confirms that each artifact has a unique legendary destruction method; Master carries the fuller destruction workflow and aftermath. | custom | — |
| Creating Artifacts |  | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Artifact design workflow including magnitude, power limits, activation model, and adverse-effect selection. Master ties every artifact to an Immortal's Sphere-aligned purpose, uses magnitude (`Minor`/`Lesser`/`Greater`/`Major`) to set both power count and adversity load, and expects activation/discovery methods to be designed as part of the item rather than bolted on later. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless a structurally equivalent `RC` procedure witness is later added. | custom | — |

### I - Immortals

No unique Phase 1 spell rows are currently Immortals-primary; Immortals remains represented as a co-source lane within relevant rows.

#### Procedures

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status | Ch06 Import |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Immortal Magical Effect Index (S1-S4) |  | Immortals | Immortals -> Section 3: Immortal Magic -> General Notes, Charts S1-S4 | procedure | Reference-index procedure for mapping mortal and non-spell effects to Immortal power-cost handling. Operationally this is the bridge that treats classic spells and many artifact-style non-spell effects as one indexed PP vocabulary, making it especially useful for Chapter 05 unification work. | custom | — |
| Immortal Caster Level Rule |  | Immortals | Immortals -> Section 3: Immortal Magic -> Caster Level | procedure | Sets effective caster level at 2 x HD for all created effects and dispel interactions. Important downstream consequence: duration, scaling, and dispel resistance all key off this doubled effective level even though the effect is created rather than cast. | custom | — |
| Immortal Range / Duration Scaling |  | Immortals | Immortals -> Section 3: Immortal Magic -> Changing Range and Duration | procedure | Cost-doubling framework for extending range, duration, and effect volume, including planar-path limits. Instant/permanent effects and range-0 effects cannot be extended, volume increases may require geometry-aware recalculation, and cross-planar reach still requires an existing path such as a gate or wormhole. | custom | — |
| Immortal Conjuring And Summoning Limits |  | Immortals | Immortals -> Section 3: Immortal Magic -> Conjuring and Summoning | procedure | Defines transplanar response requirements and sphere/element bias constraints on conjured or summoned entities. Summoned beings must be able to reach the caller by their normal movement or via an opened path, and hostile elemental or Sphere bias can block response entirely even when the named effect normally works. | custom | — |
| Immortal Damage Scaling And Averaging |  | Immortals | Immortals -> Section 3: Immortal Magic -> Damage | procedure | High-tier damage rule set using HD-based dice and optional average-damage method for faster resolution. Immortal-created effects deal 1d6 per HD of the creator, average-damage substitution is explicitly encouraged for speed, and per-die modifiers are clamped by the die's natural min/max rather than added naively to the final total. | custom | — |
| Immortal Mental Effect Resolution |  | Immortals | Immortals -> Section 3: Immortal Magic -> Mental Effects | procedure | Non-magical recovery cadence for charmed/feebleminded Immortals via Intelligence checks plus save retries. Permanent mortal-style mental effects become recurring resistance procedures at Immortal tier: A-M and saves still matter up front, magical self-cure is unavailable, and later escape depends on Intelligence-based check cadence followed by a fresh save. | custom | — |
| Immortal Limits On Use |  | Immortals | Immortals -> Section 3: Immortal Magic -> Limits on Use | procedure | Action-economy and target-scope doctrine for created effects, including self-only effects delivered by touch. Immortal-created magic can affect Immortals while mortal-created magic cannot, incorporeal beings ignore magic entirely, self-only effects can be delivered outward by touch, and each round permits either one magical action or the form's available physical attacks, not both. | custom | — |

### RC - Rules Cyclopedia

#### Spells

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status | Ch06 Import |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Analyze | MU1 | RC | RC -> Magical Spells List and Spell Descriptions | spell | RC-first analysis and inspection recognizer that broadens low-tier magical diagnostics. Verification pass (2026-03-24) checked staged Basic/Expert/Companion/Master/Immortals lanes and found no standalone pre-`RC` spell witness; keep as explicit `RC`-only provenance exception unless new staged evidence is added. | partial | ✓ |
| Entangle | MU2 | RC | RC -> Magical Spells List and Spell Descriptions | spell | RC arcane restraint and vegetation-control lane; notable as a non-druid entanglement entry. Verification pass (2026-03-24) checked staged Basic/Expert/Companion/Master/Immortals lanes and found no standalone pre-`RC` spell witness; keep as explicit `RC`-only provenance exception unless new staged evidence is added. | partial | ✓ |
| Create Air | MU3 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Environmental survival and sealed-space support lane for vacuum, underwater, or enclosed-hazard play; likely a bespoke sustainment wrapper unless folded into broader life-support doctrine. Verification pass (2026-03-24) checked staged Basic/Expert/Companion/Master/Immortals lanes and found no standalone pre-`RC` spell witness; keep as explicit `RC`-only provenance exception unless new staged evidence is added. | custom | ✓ |
| Clothform | MU4 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Soft-material transmutation lane; sibling to later form-spell entries. Evidence lock: creates one-piece permanent non-dispellable cloth mass (up to 30' x 30') with shaping dependent on caster craft capability, joinable seamless extension via repeated castings, and strict no-overlap/no-forced-placement behavior at creation. Verification pass (2026-03-24) confirmed current RC-only provenance exception. | partial | ✓ |
| Stoneform | MU6 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Stone transmutation lane within the broader form-spell suite. Evidence lock: creates 1,000 cubic feet of permanent non-dispellable stone in single-piece geometry with level-of-detail casting-time scaling, iterative recast refinement/lock workflow, and structural-use joining rules for seam-free expansion. Verification pass (2026-03-24) confirmed current RC-only provenance exception. | partial | ✓ |
| Woodform | MU5 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Wood transmutation lane paired with the other form spells. Evidence lock: creates up to 1,000 cubic feet of permanent non-dispellable wood with single-piece/no-moving-parts constraints, recast-based refinement and lock-in workflow, and seam-free joining for large constructions. Verification pass (2026-03-24) confirmed current RC-only provenance exception. | partial | ✓ |
| Delayed Blast Fireball | MU7 | RC, Master | RC -> Magical Spells List and Spell Descriptions; Master -> Artifact Power Doctrine and Artifact Effect Procedures | spell | Timed artillery recognizer related to `Fire Ball / Fireball`. Treat as the middle rung in the likely fireburst relationship ladder rather than as proof of a mandatory standalone export. | partial | ✓ |
| Ironform | MU7 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Metal transmutation and body-state lane within the form-spell suite. Evidence lock: creates permanent non-dispellable iron mass (up to 500 sq ft, 2" thick) with support/placement constraints, recast-based refinement and lock workflow, and structural AC/HP guidance as part of fortification doctrine. Verification pass (2026-03-24) confirmed current RC-only provenance exception. | partial | ✓ |
| Steelform | MU8 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Advanced metal transmutation lane in the later form-spell suite. Evidence lock: explicitly inherits ironform procedure while upgrading output to weapon-quality steel, including permanent structure durability guidance and high-fidelity crafted-item use cases. Verification pass (2026-03-24) confirmed current RC-only provenance exception. | partial | ✓ |

#### Item And Interface Effects

No RC-primary Phase 1 item/interface rows are currently parked here; item-side `RC` evidence is carried as co-source context on the Basic, Expert, and Companion buckets.

#### Procedures

No RC-primary Phase 1 procedure rows are currently parked here; procedural `RC` evidence is carried as co-source context on the Master bucket's artifact procedures.

## Powers Family Workspace For Chapter 06

### SDM Family Doctrine For This Remap

- This pass is organizing import and conversion notes, not asserting literal one-to-one SDM powers yet.
- Canonical BECMI/RC names remain the lookup keys; generic family headers now mirror the live Chapter 06 family order exactly.
- Group headings in this workspace use `family-1` through `family-13` only. Legacy slash-style families are retained as nested migration context under each generic family, with `family-13` reserved for aggregated non-spell rows.
- Each generic family carries a metadata block with `Current Header`, `Proposed Tag Family`, `Legacy Groups Merged`, and `Downstream Notes` to support Phase B and Chapter 05/06 conversion passes.
- Maintenance rule: when Chapter 06 family headers change, update `Current Header` values and `family-1`..`family-12` ordering first, preserve `family-13` as the non-spell aggregator, then perform any row-level regrouping.
- Family assignment follows this order: primary theme/doctrine, then storage mode (`trait`, `item`, `burden`, `location`), then secondary tags such as `ward`, `healing`, `recon`, `summon`, `mobility`, `signal`, `artifact`, `curse`, and `reality`.
- Provenance stays in Phase 1 Catalog; family tables intentionally omit source/staging columns to keep conversion context readable.
- Use tags and relationship notes for nuance; do not solve every ambiguity by minting new family headings.
- `magitech` and `fantascience` remain cross-cutting flavor and implementation tags, not primary family names.
- Vancian versus SDM delta to preserve during later conversion: powers persist after use, use costs Life rather than prepared slots, access is by acquisition rather than class list, and high-tier effects are gated by danger, corruption, rarity, or ritual burden rather than by daily slot scarcity.
- Source-era storage mechanics such as `Spell Storing` should be carried forward as conversion notes toward trait/item/burden interfaces, not reintroduced as prepared-slot subsystems.
- If a section is mostly about scroll wrappers, archive behavior, spell storage, or treasure-device operations, prefer `Interfaces and Scrollcraft` over forcing it into Ethereal Counter Magitech.
- Related OSR spell ladders may collapse into one future SDM power with Overcharge riders rather than separate exports. Candidate relationship groups include `Fire Ball / Fireball` -> `Delayed Blast Fireball` -> `Meteor Swarm`, and `Haste` plus later acceleration variants.
- Ethereal Counter Magitech (ECM) remains a first-class concept inside `Ethereal Counter Magitech`. It covers suppression, negation, reflection, capture, cancellation, and noospheric interference rather than generic defense or generic cleansing.
- Use an `ecm` tag for rows that meet the thematic and mechanical criteria even when the row also belongs in another family such as barriers or weather.
- Use `skilled`, `expert` and `master` tags to sort powers into "teirs" - for example all the spell effects from the Artifacts source provenance belong in `master` tier. 
- Use the BECMI/RC context to decide on appropriate tags.

### family-1

- Current Header: `Battle and Force`
- Proposed Tag Family: `battle-force`
- Legacy Groups Merged: `Battle and Force / Artillery / Pressure`; `Battle and Force / Hazards / Destruction`
- Downstream Notes: preserve fireburst ladder and artillery-hazard relationships for Overcharge consolidation.

#### Regrouped Legacy Tables

#### Battle and Force / Artillery / Pressure

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Magic Missile | spell | Canonical Chapter 06 entry should remain `Magic Missile`. Existing SDM variant: `Tragic Missile` (Vastlands / Apocrypha of the O.S. lane in the Powers Index). | partial |
| Fire Ball / Fireball | spell | Canonical mixed-name row: preserve `Fire Ball` (pre-RC BECMI) and `Fireball` (RC) as equivalent recognizer aliases. Existing SDM variant: `Pyreball` (Vastlands / Apocrypha of the O.S. lane in the Powers Index). | partial |
| Lightning Bolt | spell | Core line-artillery recognizer that should sit beside fireburst effects in the base attack family. | direct |
| Delayed Blast Fireball | spell | Timed artillery variant of the fireburst family with explicit delay mechanics. | partial |
| Meteor Swarm | spell | Extreme area-artillery endpoint for high-tier offensive scaling doctrine. Treat as the current fireburst capstone and keep custom until Chapter 06 decides whether this remains a separate apex effect or an overcharge endpoint above `Fire Ball / Fireball` and `Delayed Blast Fireball`. | custom |

#### Battle and Force / Hazards / Destruction

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Call Lightning | spell | Druidic artillery recognizer. Evidence lock: requires active storm within range, grants one 20' strike zone bolt per turn for duration, deals 8d6 electrical damage with save-for-half, and permits deferred bolt cadence while the spell remains active; ends when duration expires or weather prerequisite breaks. | partial |
| Cloudkill | spell | High-tier battlefield hazard / area denial lane. | undecided |
| Death Spell | spell | High-tier kill / sweep spell lane. | undecided |
| Disintegrate | spell | Matter-destruction lane. | undecided |
| Explosive Cloud | spell | High-tier area hazard lane. Evidence lock: cloudkill-profile moving cloud that imposes repeat saves each round to avoid paralysis while simultaneously dealing unavoidable per-round explosion damage that bypasses conventional elemental immunities. Keep as custom for mixed-condition plus immunity-piercing hazard logic. | custom |
| Ice Storm/Wall | spell | Hybrid artillery / wall-control lane. | undecided |
| Insect Plague | spell | Battlefield swarm / area-denial lane. Evidence lock: outdoor/above-ground only 30' radius swarm with 1-day duration; drives off sub-3 HD creatures (no save), obscures visibility, and requires caster concentration plus no movement to steer up to 20' per round; disturbance ends control and disperses the swarm. Keep as custom because concentration-bound hazard steering and HD-threshold routing are bespoke. | custom |
| Power Word Blind | spell | Word-of-power debilitation lane. Evidence lock: no-save blindness at 120' for targets under fixed HP thresholds (longer duration for lower-HP targets), with explicit AC/save penalties and restricted cure access requiring equal-or-higher caster-tier clerical intervention. | partial |
| Power Word Kill | spell | Word-of-power execution lane. Evidence lock: no-save word-effect at 120' with hard HP thresholds that kill low-HP targets and stun mid-HP targets, plus special save exception for magic-user-capable targets at penalty and multi-target low-HP kill mode. Keep as custom for threshold-gated lethal routing. | custom |
| Sword | spell | Force-weapon and animated blade lane. Evidence lock: caster-concentration directed magical blade at 30' that attacks twice per round using caster attack level, deals two-handed sword damage, and can strike targets requiring high-grade magical hit capability; concentration break pauses attacks but not duration, while dispel/wish can end the blade early. | partial |
| Wall of Fire | spell | Barrier-plus-damage lane. Keep relationship notes in mind with other escalating fireburst and fire-control effects for later Overcharge consolidation. Treat as partial pending fire-family consolidation with existing descendants such as `Pyreball`. | partial |

### family-2

- Current Header: `Healing and Restoration`
- Proposed Tag Family: `healing-restoration`
- Legacy Groups Merged: `Restoration and Thresholds / Healing / Resurrection`; `Purge and Safeguards / Recovery / Cleansing`; healing-support rows from `Support and Augmentation / Blessing / Sustainment`
- Downstream Notes: keep cure/restore/raise family coherent and distinct from biomancy transformation edits.

#### Regrouped Legacy Tables

#### Restoration and Thresholds / Healing / Resurrection

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Cure Critical Wounds | spell | Straight higher-tier healing upgrade; likely direct. | direct |
| Cureall | spell | Broad repair / cleanse package that may collapse several classic condition-removal channels into one SDM power pattern. | partial |
| Restore | spell | Recovery of drained or diminished capability is important for Chapter 06 recovery taxonomy, but the exact SDM equivalent still needs policy. | partial |
| Raise Dead Fully | spell | More than basic resurrection; likely needs custom life-restoration doctrine or a high-tier ritual framing with explicit threshold, body-integrity, and post-return handling rather than a simple stronger revival effect. Keep as a deliberately separate canonical row from `Raise Dead`, not a naming variant. | custom |
| Heal | spell | Extreme recovery recognizer crossing clerical and arcane traditions at high tier, likely collapsing multiple cure/cleanse/restoration lanes into one bespoke capstone recovery procedure. | custom |
| Survival | spell | Hazard-environment life support package for void, plane, and extreme condition play. | partial |

#### Purge and Safeguards / Recovery / Cleansing

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Cure Blindness | spell | Condition-removal lane for sensory impairment. Existing SDM family variants: `Real-Time Rebuild` for bodily restoration and `Restorative Slumber` for longer-form burden/attribute recovery. | partial |
| Cure Disease | spell | Disease-removal and anti-corruption-adjacent lane. Existing SDM family variant: `Real-Time Rebuild`, which explicitly flushes toxins or afflictions and restores damaged systems by power setting. | partial |
| Neutralize Poison | spell | Poison-cleansing and poison-creation lane. Existing SDM family variant: `Real-Time Rebuild`, which explicitly flushes toxins at lower power settings. | partial |
| Protection from Poison | spell | Poison immunity and anti-breath lane. Existing SDM family variant: `Real-Time Rebuild`, which is still a recovery-style toxin-handling cousin rather than true prophylactic immunity, so this remains only a partial match. | partial |
| Raise Dead | spell | Companion lane for the classic recognizer before Master expansions. Treat as the baseline resurrection recognizer and keep distinct from `Raise Dead Fully` (do not alias-collapse). Existing SDM variant: `Raise Dead` (UVG2e Spells), with `Recall Soul` as a strong soul-return ritual cousin where the conversion wants explicit soul-handling. | partial |
| Remove Curse | spell | Major curse-removal recognizer. | undecided |

#### Support and Augmentation / Blessing / Sustainment

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Bless | spell | Morale and combat blessing lane. | undecided |
| Continual Light | spell | Persistent light/darkness-management support effect. | undecided |
| Create Air | spell | Environmental survival and sealed-space support lane for vacuum, underwater, or enclosed-hazard play; likely a bespoke sustainment wrapper unless folded into broader life-support doctrine. | custom |
| Create Food | spell | Supply-generation and survival support. Existing SDM family variant: `Process Food`, which converts raw matter into usable rations; `Green Haven` is a secondary expedition-sustainment cousin where the classic row is read as camp support rather than pure conjuration. | partial |
| Create Water | spell | Expedition sustainment lane for liquid-resource generation. Existing SDM cousins in `Process Food` and broader survival wrappers support a supply-doctrine mapping without requiring a literal slot-era clone. | partial |
| Cure Light Wounds | spell | Foundational healing support. Existing SDM family variants: `Rehoryan's Progressive Restoration` and `Restorative Slumber`, which frame healing as regenerative or recuperative process rather than instant slot discharge. | partial |
| Cure Serious Wounds | spell | Mid-tier healing support. Existing SDM family variants: `Rehoryan's Progressive Restoration` and `Real-Time Rebuild`, which provide stronger repair and regrowth scaling. | partial |
| Haste | spell | Acceleration and combat-tempo support. Existing SDM family variant: `Nunka's Biophysical Overdrive`, which expresses haste-like speed and output boosts as metabolic overdrive with exhaustion burdens. Likely future relationship-group candidate for a single SDM power with Overcharge riders instead of multiple near-duplicate exports. | partial |
| Illumination | item-effect | Reusable flame-scroll utility for sustained light and fire-starting. | direct |
| Immunity | spell | Apex blanket-protection lane spanning broad hazard categories. Keep as custom until Chapter 06 sets explicit immunity scope boundaries and exception taxonomy. | custom |
| Light | spell | Shared cross-tradition light/darkness utility. Evidence lock: `Range 120'`, `Effect volume 30' diameter`, object-attachment movement, and save-gated blindness when targeted at eyes; reverse/darkness remains a cancel/counter-cancel edge interaction. Existing SDM coverage supports illumination and deception utility, so this tracks as partial. | partial |
| Purify Food and Water | spell | Basic purification and supply-safety support. Existing SDM family variant: `Process Food`, which turns unsafe or inedible organic matter into workable supplies; `Toxin Render` is a narrower waste-processing cousin rather than a straight purification duplicate. | partial |
| Resist Cold | spell | Foundational elemental protection support. | undecided |
| Ring of Holiness | item-effect | Cleric/druid power-augmentation wrapper tied to ring use; later conversion should express this as eligibility, blessing-layer access, or reduced burden around holy/nature powers rather than extra slot grant. | custom |
| Ring of Life Protection | item-effect | Anti-drain and life-threshold safeguard interface; useful as a threshold-protection model distinct from ordinary healing because it prevents or defers loss rather than repairing it after the fact. | custom |
| Ring of Remedies | item-effect | Bundled condition-repair and cleansing wrapper; likely a reusable item model for one interface exposing several tagged recovery functions instead of one-to-one spell copies. | custom |
| Ring of Survival | item-effect | Environmental hardening and hazard-resistance wrapper. | partial |
| Rod of Health | item-effect | Cleric-only healing rod that inherits the full staff-of-healing package without spending charges, but can affect any given creature only once per day regardless of which healing/remedy function is chosen. | partial |
| Striking | spell | Weapon augmentation and combat support lane. Existing SDM family variant: `Imbue Edge`, which buffs an edged weapon's damage and lets it harm intangibles for the duration. | partial |

### family-3

- Current Header: `Detection and Divination`
- Proposed Tag Family: `detection-divination`
- Legacy Groups Merged: `Knowledge and Revelation / Detection / Perception`; `Knowledge and Mind / Sensing / Counter-Sense`; inquiry/divination rows from `Communication and Inquiry / Speech / Divination`
- Downstream Notes: preserve anti-concealment and remote-sensing split from illusion payloads.

#### Regrouped Legacy Tables

#### Knowledge and Revelation / Detection / Perception

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Detect Magic | spell | Foundational magic-sense recognizer shared across cleric and magic-user lanes; likely a direct sensory/tagging power. | direct |
| Detect Evil | spell | Needs care because classic BECMI intent/hostility reading is not identical to a clean moral-alignment scanner. | partial |
| Read Languages | spell | Straight information-access utility. Existing SDM family variant: `Anti-Babylon` (Eternal Return Key lane in the Powers Index), which broadens the classic language bridge into universal communication. | partial |
| Locate Object | spell | Search-and-direction utility likely useful for Chapter 06 information/retrieval tags. | direct |
| Truesight | spell | Strong full-spectrum perception package for invisibility/ethereal/hidden detection; likely needs a premium reveal tag set. | partial |
| Analyze | spell | RC-first analysis and inspection recognizer that broadens low-tier magical diagnostics. | partial |
| Wizard Eye | spell | Remote-sight scouting sensor that pairs cleanly with clairvoyance-like reveal procedures. | partial |
| Lore | spell | Deep-history and object-reading lane useful for premium information-retrieval tags. | partial |

#### Knowledge and Mind / Sensing / Counter-Sense

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Clairvoyance | spell | Remote-sight lane. Existing SDM family variant: `Eyes of the Arrow` (Vastlands / The Viridian Practice), a projectile-bound remote sensor. | partial |
| Detect Danger | spell | Hazard-sense hybrid lane combining detection and danger reading. Existing SDM family variant: `Yellow Foresight`, which scans a wide area for sentients and general mood. | partial |
| Detect Invisible | spell | Arcane perception / anti-concealment lane. Existing SDM family variant: `Eyes of Akaula`, which sees invisible, hidden, departed, and dead things. | partial |
| ESP | spell | Thought-reading / awareness lane. Existing SDM family variant: `Yellow Foresight`, which reads sentient presence and general mood rather than exact thoughts. | partial |
| Feeblemind | spell | Severe cognition-destruction lane. Evidence lock: target class-limited to arcane-capable victims, save gate at penalty, and permanent cognition collapse to functional Int 2 until dispel/cureall remediation. Keep as custom for class-filter plus persistent cognitive-disable doctrine. | custom |
| Find Traps | spell | Detection and hazard-reading spell. | undecided |
| Infravision | spell | Sensory enhancement lane. Existing SDM family variant: `Rehoryan's Prophetic Song`, which can grant night vision as a durable biomantic adaptation instead of temporary spell vision. | partial |
| Locate | spell | Druidic animal / plant location lane. Evidence lock: self-range directional sense for one named normal or giant animal/plant type within 120', with explicit exclusions (fantastic creatures, plant monsters, intelligent targets) and no save on qualifying targets; ends after 6 turns. | partial |
| Magic Jar | spell | Identity-transfer and mind-storage lane. | partial |
| Mind Barrier | spell | High-tier noospheric defense lane for hostile mental influence suppression. Keep as custom until mental-defense tags and intrusion categories are normalized. | custom |

#### Communication and Inquiry / Speech / Divination

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Speak with Animals | spell | Baseline non-human communication lane for ecology and scouting play. | partial |
| Speak with the Dead | spell | Corpse-interrogation lane with strong overlap to existing SDM husk-speaking precedents. | partial |
| Speak with Monsters | spell | Broad creature-negotiation lane beyond animal and plant channels. Existing SDM family variant: `Anti-Babylon` (Eternal Return Key), which generalizes communication across entities rather than preserving narrow species lanes. | partial |
| Speak with Plants | spell | Plant-sentience communication lane that completes the speak-with progression. Existing SDM family variant: `Anti-Babylon` (Eternal Return Key), which already covers communication with plants, animals, minerals, and data stores. | partial |
| Commune | spell | Divine consultation and constrained-answer procedure for high-confidence guidance, likely better treated as bespoke oracle/contact doctrine than as ordinary divination throughput. | custom |
| Know Alignment | spell | Alignment/intention interrogation lane used for truthfulness and affiliation reads. | partial |
| Questioning | item-effect | Nonliving-object interrogation procedure useful for forensic and archive scenes. | partial |
| Truth | item-effect | Living-mind questioning interface via enhanced mental-read procedure. | partial |

### family-4

- Current Header: `Transformation and Alteration`
- Proposed Tag Family: `transformation-alteration`
- Legacy Groups Merged: `Transformation and Fabrication / Biomancy / Creation`; `Transformation and Fabrication / Nature / Material Shaping`
- Downstream Notes: keep polymorph/material-form suites aligned for later tier and burden mapping.

#### Regrouped Legacy Tables

#### Transformation and Fabrication / Biomancy / Creation

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Polymorph Self | spell | Self-transformation recognizer; likely maps partially because SDM form-change limits still need explicit doctrine. Existing SDM family variant: `Alter Self` (UVG2e spell lane in the Powers Index). | partial |
| Polymorph Other / Others | spell | Canonical mixed-name row: preserve `Polymorph Other` (heading form) and `Polymorph Others` (list/index form) as equivalent recognizer aliases. | partial |
| Summon Animals | spell | Druidic ally-call effect with explicit HD budgeting; useful for summon scaling via SDM Level. | partial |
| Animate Objects | spell | Object animation effect that likely maps, but may need gear/object-agent handling. | partial |
| Animate Dead | spell | Major doctrine carrier for minion control and undead creation; likely requires custom or tightly-scoped overlay language. Existing SDM variant: `Animate Corpse` (UVG2e spell lane in the Powers Index). Future pass should treat this as a relationship note into Undeath's Decrees rather than a flat one-power export. | custom |
| Clone | spell | Identity-duplication / backup-body procedure, clearly beyond a simple direct powers mapping. | custom |
| Polymorph Any Object | spell | Extreme transmutation endpoint that extends polymorph doctrine beyond creature targets. | custom |
| Shapechange | spell | Supreme self-transformation package and ceiling case for form-shift taxonomy. | custom |
| Reincarnation | spell | Death-reversal via body replacement that should stay distinct from raise-dead effects. | custom |

#### Transformation and Fabrication / Nature / Material Shaping

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Anti-Animal Shell | spell | Creature-class exclusion boundary for fauna and beast-adjacent targets. Treat as custom boundary taxonomy doctrine (who is denied passage and what target classes qualify). | custom |
| Anti-Plant Shell | spell | Vegetation-class exclusion boundary. This is a custom barrier-interface case for passage denial against plant entities/effects, not a generic resistance shell. | custom |
| Clothform | spell | RC-only soft-material transmutation lane in the form-spell suite. Evidence lock: one-piece permanent non-dispellable cloth output (up to 30' x 30') with craft-shaped outcomes, seamless later joins, and no forced overlap casting. | partial |
| Contact Outer Plane | spell | Dangerous intelligence-contact and revelation lane. | custom |
| Creeping Doom | spell | High-tier swarm devastation lane. Evidence lock: summons a 1,000-insect swarm occupying at least 20' x 20' (expandable to 60' x 60') that inflicts automatic scaling damage (up to 100/round per creature in zone), moves while caster remains within 120', and ends on duration expiry, range break, or successful dispel. Keep as custom for high-complexity autonomous hazard behavior. | custom |
| Dissolve | spell | Terrain-liquefaction lane. Evidence lock: transmutes non-construction soil/rock volume (up to 3,000 sq ft and 10' depth/thickness) within range into deep mud that slows movement to 10% and can trap targets; reverse (`Harden`) can permanently lock the same volume into rock with save-gated escape from entrapment. Keep as custom because reversible terrain-state conversion is a bespoke battlefield/environment procedure. | custom |
| Entangle | spell | RC-only arcane restraint and vegetation-control lane; current staged corpus has no standalone pre-RC spell witness. | partial |
| Faerie Fire | spell | Outlining / reveal lane. Evidence lock: non-damaging visibility outline at 60' that can mark detected creatures/objects and grants +2 attack bonus against marked targets; footprint scales by caster level in man-sized equivalents and ends cleanly on duration expiry. | partial |
| Growth of Animal | spell | Creature enhancement / scaling lane. | undecided |
| Growth of Plants | spell | Terrain / vegetation alteration lane. Existing SDM family variant: `Green Haven`, which coerces vegetation into shelter and thorn barriers; it is a narrower plant-shaping cousin rather than a pure growth accelerator. | partial |
| Heat Metal | spell | Sustained heat / anti-armor / concentration-break lane. Evidence lock: level-scaled target-mass metal heating over 7 rounds with escalating then tapering damage (no save), optional drop behavior, ignition side effects at peak heat, and concentration disruption on damage ticks; magical targets resist damage side effects while nonmagical composites degrade. Keep as custom due multi-round escalation and equipment-state interaction doctrine. | custom |
| Hold Animal | spell | Beast-specific restraint lane. Evidence lock: affects normal/giant animals only (excluding fantastic or higher-intelligence targets), applies HD-budget targeting by caster level, and requires spell saves to resist long-duration paralysis; summoned/conjured/controlled animals remain valid targets. | partial |
| Ironform | spell | RC-only metal transmutation and body-state lane in the form-spell suite. Evidence lock: permanent non-dispellable iron output up to 500 sq ft at fixed thickness with recast refinement/lock workflow and fortification durability guidance. | partial |
| Metal to Wood | spell | Material transformation lane. Evidence lock: permanently transmutes metal to dead wood by level-scaled weight budget, with strong magic-item resistance and explicit gear outcomes (armor drops, weapons degrade to wooden clubs); not reversible by standard dispel. Keep as custom because permanence and transformation side effects require bespoke handling. | custom |
| Produce Fire | spell | Portable flame / attack lane. Evidence lock: conjures non-self-harming torch-grade flame in hand with duration scaling, supports ignition utility and short-range throw/drop delivery, and allows on/off toggling by concentration while active. | partial |
| Protection from Lightning | spell | Elemental defense lane. Evidence lock: touch-applied lightning protection grants level-scaled d6 damage cancellation pool, carries through multiple electrical attacks until pool exhaustion, and then reverts to normal save/damage handling on overflow hits. | partial |
| Steelform | spell | RC-only advanced metal transmutation lane in the form-spell suite. Evidence lock: ironform-equivalent procedure with weapon-grade steel output and stronger durability profile for structural and crafted applications. | partial |
| Sticks to Snakes | spell | Wood-to-serpent transformation and battlefield-weaponization lane. Keep as custom until material-to-creature conversion, obedience scope, and reversion/persistence rules are normalized. | custom |
| Stone to Flesh | spell | Petrification-reversal lane. | undecided |
| Stoneform | spell | RC-only stone transmutation lane within the broader form-spell suite. Evidence lock: 1,000 cubic feet permanent non-dispellable single-piece stone with casting-time scaling by complexity, recast refinement/lock workflow, and seam-free expansion support. | partial |
| Telekinesis | spell | Classic force-manipulation recognizer. | partial |
| Turn Wood | spell | Wooden-object repulsion and vector-redirection lane. Treat as a custom material-interaction control effect with explicit category targeting and displacement behavior. | custom |
| Warp Wood | spell | Wooden-structure deformation lane. Evidence lock: permanently warps wooden weapons only by arrow-equivalent capacity budget, with save opportunities for wielded magical targets and plus-based resist chances; excludes non-weapon wooden objects. | partial |
| Woodform | spell | RC-only wood transmutation lane paired with the other form spells. Evidence lock: up to 1,000 cubic feet permanent non-dispellable wood with single-piece constraints, iterative recast refinement/lock process, and seam-free joining for large constructions. | partial |

#### Terrain and Environment / Weather / Infrastructure

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Lower Water | spell | Hydrology-control and exposure-engineering lane. Primary placement belongs with terrain/environment and should be treated as custom doctrine for level shifting and basin manipulation. | custom |
| Control Temperature 10' radius | spell | Canonical display form is `Control Temperature 10' radius`; retain `Control Temperature 10' Radius` as a source alias recognizer. Evidence lock: self-centered moving 20' diameter microclimate, immediate up/down shift up to 50 F, optional round-by-round retuning by concentration, and fixed end-state at duration expiry. | partial |
| Control Winds | spell | Directional weather-force control with movement, hazard, and projectile-pressure implications. Keep as custom environment-control doctrine pending full weather suite normalization. | custom |
| Weather Control | spell | High-tier weather command lane across druidic and arcane traditions. Keep as custom suite anchor for chapter-scale climate control, hazard shaping, and travel pressure. | custom |
| Earthquake | spell | Large-scale terrain and structure disruption effect for macro encounter shifts. Evidence lock: outdoor terrain section up to 60' square at C17 (plus 5' per level above), with structural collapse and rockslide effects in-area, and crack-engulf risk resolved as random target selection with a Death save escape gate; effect ends after 1 turn. Keep as custom due to encounter-scale terrain rewrite and destruction doctrine. | custom |
| Move Earth | spell | Massive terrain repositioning and landscape engineering recognizer. Existing SDM family variant: `Dryland Sculpture`, which is a smaller-scale but high-confidence terrain-forming and infrastructure-shaping cousin rather than a direct mass-displacement duplicate. | partial |
| Hallucinatory Terrain | spell | Terrain-level illusion masking and environmental deception package. | undecided |
| Obscure | spell | Concealment / weather-obscuration lane. Existing SDM family variant: `Yellow Cloud`, which creates an opaque dust veil and can overcharge into an immobile wall of obscuring material. Primary placement belongs with terrain/environment because the effect works by materially altering battlefield atmosphere rather than pure false imagery. | partial |
| Predict Weather | spell | Forecast and horizon-reading lane. Primary placement belongs with terrain/environment and should be treated as custom environment-intelligence doctrine for routing and hazard prep. | custom |
| Summon Weather | spell | Weather-calling and macro-environment override lane. Primary placement belongs with terrain/environment and should remain custom until intensity/duration/collateral doctrine is codified. | custom |
| Wall of Stone | spell | Rapid structural barrier creation for chokepoints and fortification. Keep as custom until Chapter 06 codifies persistent obstacle geometry, breach rules, and noncombat construction handling. | custom |
| Wall of Iron | spell | Durable metal wall creation for heavy-duty terrain shaping and denial. Keep as custom where procedures need explicit creation-versus-obstruction handling for persistent iron mass. | custom |

### family-5

- Current Header: `Mind and Emotion`
- Proposed Tag Family: `mind-emotion`
- Legacy Groups Merged: `Influence and Control / Restraint / Compulsion`; `Influence and Control / Charm / Binding`
- Downstream Notes: maintain clean separation between compulsion/charm doctrine and concealment/illusion doctrine.

#### Regrouped Legacy Tables

#### Influence and Control / Restraint / Compulsion

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Sleep | spell | Classic low-tier disable effect; likely a direct control template. | direct |
| Hold Person | spell | Straight restraint/paralysis recognizer already central to many fantasy power taxonomies. Existing SDM variant: `Hlod Person` (Vastlands / Apocrypha of the O.S. lane in the Powers Index). | direct |
| Web | spell | Area denial plus entanglement effect; likely direct. | direct |
| Confusion | spell | Mind-state disruption effect; needs a clean SDM status / control phrasing pass. | partial |
| Quest | spell | Compulsion / obligation spell likely better treated as a vow-binding or command doctrine than a simple status effect. | custom |
| Dance | spell | Forced-movement / compulsion lane. Evidence lock: touch-delivered no-save incapacitation forcing dance behavior, with explicit inability to attack/cast/flee plus save/AC penalties and tiered duration scaling by caster level band. | partial |
| Hold Monster | spell | Higher-tier restraint extension of the hold-family control recognizer. | partial |
| Mass Charm | spell | Group-scale social compulsion package beyond single-target charm doctrine. | custom |
| Remove Charm | spell | Area-wide charm removal plus 1-turn object-charm suppression; RC's standalone indexing for this reverse elevates it above a simple reversed-entry note. Keep as partial until Chapter 06 codifies area-dispel of control effects and object-source blocking. | partial |
| Power Word Stun | spell | Word-of-power incapacitation lane bridging blind/kill style hard control effects. | custom |

#### Influence and Control / Charm / Binding

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Charm Monster | spell | Broad creature-charm lane. Existing SDM family variant: `Hero's Goldenmouth`, but only as a broad persuasive-capture cousin; the current corpus does not yet provide a clean nonhuman domination equivalent. | partial |
| Charm Person | spell | Core low-tier social control spell. Existing SDM family variant: `Hero's Goldenmouth` (Our Golden Age), which reframes charm as persuasive social capture rather than hard domination. | partial |
| Charm Plant | spell | Plant-specific command/control lane. Keep as custom until plant-agency and obedience boundaries are normalized against broader influence doctrine. | custom |
| Holy Word | spell | High-tier word of power / banishment lane. Existing SDM family variant: `Sense Allegiance`, which provides the clearest current ethical-targeting plus stun/interdiction cousin, though it is much narrower than the full clerical word-of-power package. | partial |
| Remove Fear | spell | Fear-cleansing and morale stabilization as a counter-compulsion lane. Chapter 06 now places this under `Mind and Emotion`, so Phase 2 groups it with influence/control interactions rather than expedition sustainment. | partial |
| Snake Charm | spell | Creature-specific charm/control spell. | undecided |

### family-6

- Current Header: `Veils and Influence`
- Proposed Tag Family: `veils-influence`
- Legacy Groups Merged: `Veils and Illusions / Concealment / Deception`
- Downstream Notes: route visibility and deception effects here unless the effect is direct command/control.

#### Regrouped Legacy Tables

#### Veils and Illusions / Concealment / Deception

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Invisibility | spell | Core concealment baseline for personal stealth and line-of-sight disruption. Existing SDM family variants: `Ecosphere Veil` for disregard-based stealth and `Yellow Cloud` for visual obscuration. | partial |
| Invisibility 10' radius | spell | Canonical display form is `Invisibility 10' radius`; retain `Invisibility 10' Radius` as a source alias recognizer. `Yellow Cloud` is the clearest existing Luka-style battlefield-scale concealment cousin. | partial |
| Mass Invisibility | spell | High-tier crowd concealment lane above the 10-foot-radius variant. `Yellow Cloud` remains the strongest existing crowd-obscuration precedent in the current SDM corpus. | partial |
| Ventriloquism | spell | Sound-projection and false-source deception utility. Evidence lock: `Range 60'`, `Duration 2 turns`, single item/location projection anchor, and no save-gated resistance in baseline text; role is positional/audio misdirection, not direct control or barrier effects. | partial |
| Mirror Image | spell | Defensive misdirection via decoy duplicates in direct-threat contexts. | undecided |
| Phantasmal Force | spell | Core constructed-illusion recognizer for scene-level false stimuli. | undecided |
| Projected Image | spell | Remote image/proxy presence lane for deception and diversion play. | undecided |
| Massmorph | spell | Group disguise or false-form presentation for coordinated infiltration. | undecided |
| Statue | spell | Self-concealment through object-form mimicry with strong ambush utility. Evidence lock: caster self-transformation toggled once per round into immobile AC-improved stone form with broad hazard immunities, breathing suspension, and reactive initiative bonus when shifting before incoming elemental attacks; magical attacks still apply and duration is long-form level scaled. Keep as custom due modal defense-state procedure complexity. | custom |

### family-7

- Current Header: `Traversal and Mobility`
- Proposed Tag Family: `traversal-mobility`
- Legacy Groups Merged: `Mobility and Access / Movement / Traversal`
- Downstream Notes: keep route and movement tools separate from boundary-seal and planar-gate doctrine.

#### Regrouped Legacy Tables

#### Mobility and Access / Movement / Traversal

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Levitate | spell | Vertical movement utility; likely a direct map. | direct |
| Floating Disc | spell | Canonical spell name can stay unchanged while pointing to the existing stylized `Floating Disc` UVG variant in the Powers Index. | direct |
| Fly | spell | Core aerial mobility recognizer needed for personal-scale movement powers and item references. | direct |
| Find the Path | spell | Navigation / routing procedure rather than pure movement; useful for Chapter 06 pathfinding and noosphere-guidance tags. | partial |
| Knock | spell | Canonical lock-opening entry should remain `Knock`; existing SDM variant: `Knock / Lock` (UVG2e spell lane in the Powers Index). | partial |
| Teleport | spell | Major transit power; likely direct at concept level but will need SDM range / mishap doctrine decisions. | partial |
| Travel | spell | Composite package combining flight, planar transfer, and gaseous traversal; probably needs custom Chapter 06 decomposition or a premium bundled mobility power with environment/survival riders instead of a flat one-to-one export. | custom |
| Dimension Door | spell | Short-range relocation entry that bridges tactical repositioning and teleport doctrine. | partial |
| Pass-Wall / Passwall | spell | Canonical mixed-name row: preserve `Pass-Wall` (pre-RC BECMI) and `Passwall` (RC) as equivalent recognizer aliases. Chapter 06 recognizer surface currently uses `Veilwalk (Pass-Wall)` while preserving the canonical key. | partial |
| Magic Door | spell | Portal and egress manipulation lane. Existing SDM family variant: `Linked Portals`, which is the clearest current astral-bridge precedent for controlled passage and reversible entry. | partial |
| Pass Plant | spell | Plant transit lane. Existing SDM family variant: `Linked Portals`, used here as a traversal cousin rather than a literal vegetation-only doorway. Primary placement stays with mobility because the row's job is passage, not plant reshaping. | partial |
| Plant Door | spell | Vegetation access / doorway lane. Existing SDM family variant: `Linked Portals`, which is the closest current controlled-passage precedent even though the classical wrapper is plant-specific. | partial |
| Transport Through Plants | spell | Plant-network transit lane. Existing SDM family variant: `Linked Portals`, which already expresses location-bridging as a distinct traversal procedure. | partial |
| Water Breathing | spell | Druidic aquatic adaptation/access lane. Chapter 06 recognizer surface currently uses `Swamp's Gift (Water Breathing)` while preserving canonical `Water Breathing` as the key. Primary placement stays with mobility/access, but conversion should be treated as custom environment-interface doctrine (breath medium, pressure, and exposure assumptions), not a generic speed modifier. | custom |
| Gate | spell | Planar aperture and translocation endpoint for high-tier traversal and summoning crossover, likely a bespoke apex mobility/interface effect rather than a generic teleport derivative. | custom |
| Teleport any Object | spell | Object-only transit lane that should stay distinct from creature teleport effects. | partial |

### family-8

- Current Header: `Dimensional, Planar, and Exotic Access`
- Proposed Tag Family: `dimensional-planar-exotic-access`
- Legacy Groups Merged: `Mobility and Access / Dimensional and Sanctuary Transit`
- Downstream Notes: prioritize sanctuary return, planar pathing, and exotic-access edge rules.

#### Regrouped Legacy Tables

#### Mobility and Access / Dimensional and Sanctuary Transit

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Word of Recall | spell | Return-to-sanctuary extraction spell with strong campaign-loop implications. Chapter 06 now places this under `Dimensional, Planar, and Exotic Access`, so Phase 2 tracks it as dimensional/sanctuary transit instead of generic traversal. | partial |

### family-9

- Current Header: `Duration and Binding Rituals`
- Proposed Tag Family: `duration-binding-rituals`
- Legacy Groups Merged: `Defense and Boundaries / Duration and Binding Rituals`; ritual-binding rows from `Defense and Boundaries / Seals / Passage Control`
- Downstream Notes: codify persistence, commitment, and release conditions for long-duration bindings.

#### Regrouped Legacy Tables

#### Defense and Boundaries / Wards / Barriers

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Protection from Evil | spell | Hybrid defensive buff plus contact ward against enchanted or summoned beings; not just a generic Defense bonus. | partial |
| Shield | spell | Clean self-defense shell; Chapter 06 canonical import surface is `Shield Ward (Shield)`, with `Entropic Shield` tracked as a sibling FTLS variant expression rather than a replacement recognizer. | direct |
| Resist Fire | spell | Elemental mitigation template that likely maps cleanly to tagged resistance language. | direct |
| Barrier | spell | High-level warding/boundary effect that should help define Chapter 06 barrier taxonomy above simple protection spells. | custom |
| Dispel Evil | spell | Counterforce / banishment family member that overlaps with anti-hostile or anti-outsider doctrine rather than plain damage. | partial |
| Force Field | spell | Premium barrier package that should inform upper-tier ward layering and persistence doctrine. | custom |
| Prismatic Wall | spell | Complex high-tier barrier lane. The current SDM corpus does not provide a close named layered-spectrum wall analogue, so this likely needs bespoke high-tier barrier text rather than a borrowed family variant. | custom |

#### Ethereal Counter Magitech / Dispels / Suppression / Jamming

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Anti-Magic Shell | spell | Core anti-magic barrier recognizer spanning arcane and high-tier artifact-adjacent lanes. | custom |
| Protection from Magic | item-effect | Protection-circle interface specifically blocking spells and spell effects across boundary edges. This is a clean ECM ward wrapper and a strong Chapter 05 model for denial fields rather than generic protection. | custom |
| Dispel Magic | spell | Major counterforce recognizer and one of the core canonical anchors for ECM scope. The grouped ECM pass now treats this as a bespoke conversion anchor rather than an unresolved loose cousin. | custom |
| Silence 15' Radius | spell | Anti-speech and anti-spellcasting field lane; useful where ECM overlaps with noospheric jamming and casting denial even though the current corpus lacks a clean silence-only named precedent. | partial |
| Spell Catching | item-effect | Counter-capture wrapper for hostile spell energy routed into storage media; a core ECM reference case and strong bridge for Power Level-banded hostile capture. | custom |
| Ring of Spell Eating | item-effect | Ring-native spell absorption and denial interface; distinct from simple resistance tags and a direct ECM item case for consuming or canceling incoming powers rather than reflecting them. | custom |
| Ring of Spell Turning | item-effect | Reflects 2-12 incoming spell attacks back to their casters; the complement to Ring of Spell Eating, covering reflection rather than absorption. Model for directional ECM counterforce at item scale with finite capacity. | custom |
| Staff of Dispelling | item-effect | Charged dispel interface with special handling across temporary and permanent magic carriers; likely a key Chapter 05 example for `Level`-based counterforce with carrier-specific exceptions. | custom |

#### Defense and Boundaries / Seals / Passage Control

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Hold Portal | spell | Low-tier closure / access-control spell. Existing SDM family variant: `Knock / Lock`, whose overcharge explicitly flings a portal open or seals, welds, or fuses it shut. | partial |
| Maze | spell | Exile and battlefield-removal boundary effect. Keep as custom due its spatial-separation logic and return-condition doctrine requirements. | custom |
| Permanence | spell | Long-term enchantment anchoring and persistence-lock doctrine. Treat as custom because Chapter 06 must define bindability scope, upkeep risks, and safe unbinding conditions. | custom |
| Wizard Lock | spell | Arcane closure / keyed barrier lane. Existing SDM family variant: `Knock / Lock`, which already handles opening, locking, and forcibly sealing portals, including resistance from magical locks. | partial |

#### Defense and Boundaries / Duration and Binding Rituals

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Geas | spell | High-tier compulsion and binding ritual lane. Chapter 06 now places this in `Duration and Binding Rituals`, so Phase 2 tracks it as persistent oath/constraint binding rather than generic charm handling. | partial |

### family-10

- Current Header: `Creation and Conjuration`
- Proposed Tag Family: `creation-conjuration`
- Legacy Groups Merged: `Summons and Servitors / Calling / Fabrication`; conjuration rows from `Interfaces and Scrollcraft / Treasure / Utility Devices`
- Downstream Notes: maintain distinction between summoned agents, fabricated matter, and transport interfaces.

#### Regrouped Legacy Tables

#### Summons and Servitors / Calling / Fabrication

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Conjure Elemental | spell | Foundational elemental-calling recognizer with cross-book spell and item relevance. | partial |
| Invisible Stalker | spell | Precision servitor-calling lane for pursuit, scouting, and delegated action. | partial |
| Aerial Servant | spell | Summoned retrieval-agent procedure with logistics and custody implications. | partial |
| Summon Elemental | spell | Druidic elemental-calling lane complementary to Conjure Elemental. | partial |
| Summon Object | spell | Object-call retrieval effect that bridges summoning and transport procedure language. | partial |
| Create Normal Animals | spell | Creature creation lane adjacent to summoning, useful for companion and ecology pressure. Bundle seed tier: `Vegetable of Birth` (There A Red Door) is the strongest current gestation precedent for controlled non-monstrous outputs. | custom |
| Create Normal Monsters | spell | Mid-tier monster fabrication lane below magical and any-monster creation tiers. First monster-grade rung in the bundle, with bounded taxonomy and encounter-pressure outputs. | custom |
| Create Magical Monsters | spell | Magical creature fabrication lane with higher design complexity and power expectations. Mid bundle rung above normal monsters with explicit special-ability budgeting and higher control burden. | custom |
| Create Any Monster | spell | Extreme top-tier creature creation endpoint with broadest scope. Bundle capstone requiring strict doctrine for command reliability, persistence failure modes, and campaign-scale impact. | custom |

#### Interfaces and Scrollcraft / Spell Storage / Tooling

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Read Magic | spell | Decoding gate for scrolls and arcane writing; this family should group deciphering, storage, and transfer interfaces. | partial |
| Spell Storing | item-effect | Source spell-retention wrapper. Keep the canonical key, but convert it as a trait/item power archive with Power Level capacity and later discharge rules rather than as prepared-slot retention. | custom |
| Spell Scrolls / Spells | item-effect | Generic casting-from-scroll wrapper that must stay visible for Chapter 05/06 bridges. | partial |
| Protection / Protection Scrolls | item-effect | Wrapper row for protection-scroll family where the payload references another spell recognizer. | partial |
| Cursed / Cursed Scroll | item-effect | Failure-state wrapper that applies negative spell-like outcomes; useful as a generalized cursed-interface pattern. | partial |
| Maps to Treasures / Treasure Maps | item-effect | Non-spell utility wrapper, but still an indexed magical information interface in treasure text. | custom |
| Quill of Copying | item-effect | Procedure for spell/text duplication with strong archive tooling implications. | custom |
| Slate of Identification | item-effect | Item-mediated identification interface that bridges detection and item-use doctrine. | partial |
| Communication | item-effect | Paired remote-writing interface that functions as a distance-safe text channel on the same plane. | partial |
| Delay | item-effect | Delayed-release wrapper for a stored spell payload, useful for trigger-based spell handling; Chapter 05 should treat this as deferred activation doctrine rather than slot hold-state. | custom |
| Mages | item-effect | Scroll-based magic-effect detection that complements Read Magic without replacing it. | partial |
| Portals | item-effect | Scroll-native pass-wall interface and compact access-control wrapper. | partial |
| Ring of Memory | item-effect | Immediate one-spell recall interface for spellcasters only: the wearer must choose within 1 turn of casting, then the spell is instantly relearned, with the ring restoring only one spell per day. Strong Chapter 05 model for short-horizon recovery/retention rather than passive memory bonuses or broad archive storage. | custom |

#### Interfaces and Scrollcraft / Treasure / Utility Devices

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Creation | item-effect | Temporary mundane-item fabrication with hard output limits: one non-living item up to 5' x 10' x 1' and 5,000 cn, never magical or alive, and gone on command or after 24 hours. | custom |
| Equipment | item-effect | Menu-based gear fabrication: six fixed mundane entries are inscribed on the scroll, any three can be manifested per day, and each returns to the parchment when its created item vanishes. | custom |
| Mapping | item-effect | Once-per-day bounded survey tool that records a chosen fully-contained area within 100', up to 10,000 square feet, making it a reconnaissance/archive interface rather than a combat spell. | custom |
| Protection from Elementals | item-effect | Circle protection scroll keyed specifically to elementals. | partial |
| Protection from Evil 10' Radius | spell | Canonical grouped display form for the group-radius protection lane (clerical framing). Treat lowercase `10' radius` as a retained alias recognizer, not a separate doctrine island. | partial |
| Protection from Lycanthropes | item-effect | Circle protection scroll keyed to lycanthrope types by quantity band. | partial |
| Protection from Normal Missiles | spell | Projectile-denial boundary lane for nonmagical missile vectors. Chapter 05 should treat this as an interface-grade filtering ward with explicit projectile-category exceptions rather than a generic defense bonus. | custom |
| Protection from Undead | item-effect | Circle protection scroll keyed to undead by type and quantity. | partial |
| Repetition | item-effect | Scroll wrapper that replays the same-level spell effect after one turn; note for future conversion that this should become an SDM trigger/interface note, not a slot-replay rule. | custom |
| Ring of Elemental Adaptation | item-effect | Plane-keyed elemental survival ring in seven variants that lets the wearer breathe and see normally within the matching Elemental Plane, making it a clean support interface for elemental travel without providing the travel itself. | partial |
| Rod of the Wyrm | item-effect | Alignment-keyed draconic interface: once per day the rod becomes a 30 hp servant dragon that can serve as messenger, steed, guard, or combatant, but a wrong-alignment user triggers immediate betrayal and a slain dragon form destroys the rod permanently. | custom |
| Seeing | item-effect | Scroll-based remote creature imaging procedure. | partial |
| Shelter | item-effect | Extradimensional refuge with replenishing provisions, temporary equipment, 12-hour use windows, and a serious trap state if the scroll is removed while occupants remain inside. | custom |
| Staff of Harming | item-effect | Cleric-only Chaotic harm staff: touch inflicts 2-7 damage in addition to normal staff damage at 1 charge per harmed creature, and it can spend 2/2/3/4 charges to deliver cause blindness, cause disease, cause serious wounds, or create poison as reversed cleric payloads. | custom |
| Staff of an Element | item-effect | Element-tuned summoning, negation, and planar operation interface; a strong bundle case rather than a single-spell export, especially when Chapter 05 needs one item to expose several element-keyed functions. | custom |
| Staff of the Druids | item-effect | Druid power-augmentation and charge-linked upkeep interface; should convert as attuned access to druidic functions or bundled powers rather than as raw slot augmentation. | custom |
| Symbol | spell | Sigil-triggered boundary hazard lane. Treat as a custom trigger-interface package (condition, payload, and reset doctrine) instead of a plain static trap export. | custom |
| Talisman of Elemental Travel | item-effect | Lesser talismans reverse conjure elemental into one matching elemental-plane transit while granting breathable element-matter and strong vision there; the greater talisman covers all planes and can spend charges to compel elemental obedience. Strong Chapter 05 bundle case for transit, adaptation, and command in one interface. | custom |
| Trapping | item-effect | Placement-keyed trap fabrication: floor yields pit, ceiling yields falling block, and other surfaces yield dart or gas logic, with the resulting trap being physically real rather than illusory. | custom |
| Wizardry | spell | Cross-tradition item / scroll use bridge lane. Evidence lock: grants temporary legal use of one magic-user device or one 1st-2nd level magic-user scroll spell for one turn (or until used), including procedural knowledge transfer and minimum-caster-level effect handling. Keep as custom as a rules-eligibility bridge rather than a standard effect payload. | custom |

### family-11

- Current Header: `Undead and the Deathless`
- Proposed Tag Family: `undead-deathless`
- Legacy Groups Merged: undead-focused rows currently distributed across transformation, communication, restoration, and protection families
- Downstream Notes: consolidate death/undeath handling here during row migration, preserving both hostile-undead and restoration-threshold doctrines.

#### Regrouped Legacy Tables

#### Meta-Doctrine and Exceptions / Artifact Rules / Systems

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Artifact Activation | procedure | Attunement-plus-discovery doctrine for artifact-grade effects: possession alone is insufficient, and activation/control may require ritual, event, legend, or research before full use becomes available. | custom |
| Artifact Charges And Recharge | procedure | Renewable high-tier reserve doctrine: artifact magnitude sets power budget, each use drains cost-matched charges, and spent capacity regenerates over time instead of behaving like ordinary finite-item depletion. | custom |
| Artifact Intelligence And Auto-Defense | procedure | Governs semi-autonomous artifact behavior, including telepathic guidance, refusal, and defensive or retaliatory item-side responses that do not map cleanly to bearer action economy. | custom |
| Artifact Handicaps And Penalties | procedure | Drawback model for artifact use that should influence Chapter 06 risk/cost doctrine. | custom |
| Destruction Of An Artifact | procedure | High-tier termination pathway for otherwise persistent artifact effects. | custom |
| Attacking An Artifact | procedure | Durability, threshold-loss, and recall behavior when artifacts are directly attacked. | custom |
| Creating Artifacts | procedure | Design-time artifact workflow covering Sphere-aligned purpose, magnitude-based power/adversity budget, and built-in activation/discovery methods rather than bolt-on item powers. | custom |
| Immortal Magical Effect Index (S1-S4) | procedure | Indexed PP vocabulary that unifies mortal spells and many non-spell magical effects, making it a core bridge between classic recognizers and Chapter 05 power language. | custom |
| Immortal Caster Level Rule | procedure | Effective caster-level baseline for Immortal effect scaling is 2 x HD, which drives duration, scaling, and dispel resistance even though the effect is created rather than cast. | custom |
| Immortal Range / Duration Scaling | procedure | Cost-doubling doctrine for extending range, duration, and even volume, with hard limits on range-0 or instant/permanent effects and no cross-planar reach without an existing path. | custom |
| Immortal Conjuring And Summoning Limits | procedure | Constraint doctrine for conjured allies and summoned entities at Immortal tier: response depends on normal movement or an opened path, and hostile Sphere or elemental bias can block the effect entirely. | custom |
| Immortal Damage Scaling And Averaging | procedure | HD-scaled damage expression using 1d6 per HD, with explicit average-damage substitution and clamped per-die modifiers for fast high-tier resolution. | custom |
| Immortal Mental Effect Resolution | procedure | Recurring resistance doctrine for charmed or feebleminded Immortals: A-M and saves matter first, self-cure is unavailable, and later escape depends on Intelligence-check cadence plus renewed saves. | custom |
| Immortal Limits On Use | procedure | Action and scope constraints on active magical effects: mortal magic cannot affect Immortals, self-only effects can be delivered by touch, and each round allows magical action or physical attacks, not both. | custom |

#### Meta-Doctrine and Exceptions / Artifact / Immortal Rules

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Artifact Activation | procedure | Attunement-plus-discovery interface for artifact powers; possession alone is insufficient, and activation/control may require ritual, event, legend, or research before full use becomes available. | custom |
| Artifact Charges And Recharge | procedure | Renewable reserve doctrine for artifact power use: magnitude sets budget, each use drains cost-matched charges, and spent capacity regenerates over time instead of acting like ordinary finite-item depletion. | custom |
| Artifact Handicaps And Penalties | procedure | Core adverse-effect framework for mortal artifact users. | custom |
| Artifact Intelligence And Auto-Defense | procedure | Semi-autonomous artifact agency with telepathic guidance, refusal, and defensive or retaliatory item-side behavior that does not reduce cleanly to the bearer's own action economy. | custom |
| Attacking An Artifact | procedure | Artifact durability, damage thresholds, power loss, and recall behavior under sustained attacks. | custom |
| Creating Artifacts | procedure | Artifact design workflow including Sphere-aligned purpose, magnitude-based power/adversity load, and deliberate activation/discovery methods rather than generic magic-item assembly. | custom |
| Destruction Of An Artifact | procedure | Permanent-destruction quest procedure and Immortal-response consequences. | custom |
| Immortal Conjuring And Summoning Limits | procedure | Defines transplanar response requirements and hostile Sphere/element bias constraints that can block even nominally valid summoning effects. | custom |
| Immortal Damage Scaling And Averaging | procedure | High-tier damage rule set using 1d6 per HD plus optional average-damage handling and clamped per-die modifiers for faster resolution. | custom |
| Immortal Limits On Use | procedure | Action-economy and target-scope doctrine for created effects, including touch-delivery of self-only effects and the one-magical-action-or-physical-attacks-per-round limit. | custom |

### family-12

- Current Header: `Heritage Powers`
- Proposed Tag Family: `heritage-powers`
- Legacy Groups Merged: none (no direct BECMI-only legacy group)
- Downstream Notes: reserve for lineage/culture-bound additions and Chapter 06 heritage imports.

#### Regrouped Legacy Tables

#### Meta-Doctrine and Exceptions / Reality Rewrite / High-Tier

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Wish | spell | Canonical spell name should remain `Wish` even where the tone-forward SDM variant is `Big Wish` in the Powers Index. This is exactly the sort of high-recognizer / unique-variant pairing the crosswalk must preserve, with later conversion likely framed as a ritual-grade exception rather than a slot spell. | custom |
| Timestop | spell | Temporal exception effect and high-tier action-economy breaker. | custom |
| Reverse Gravity | spell | Battlefield-physics inversion that behaves as a rules exception rather than a standard force attack. | custom |
| Contingency | spell | Conditional trigger/do-if framework for precommitted reality edits and defensive reactions. | custom |

### family-13

- Current Header: `Non-Spell Rows`
- Proposed Tag Family: `non-spell-rows`
- Legacy Groups Merged: all non-spell catalog entries (`item-effect`, `procedure`)
- Downstream Notes: this is an explicit aggregation surface for interface/procedure rows so spell-only family audits remain clean.

#### Regrouped Legacy Tables

#### Non-Spell Rows - Scroll and Parchment Interfaces

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Communication | item-effect | Paired remote-writing scroll interface across any distance on the same plane. | partial |
| Creation | item-effect | Scroll-generated temporary mundane item fabrication procedure. Companion constrains this to one normal non-living item up to 5' x 10' x 1' and 5,000 cn, forbids magic and living outputs, and auto-expunges the result on command or after 24 hours. Strong Chapter 05 model for temporary fabricated gear with hard material and duration limits rather than freeform conjuration. | custom |
| Delay | item-effect | Scroll-carried delayed-release wrapper for one stored spell payload; Chapter 05 should model this as a trigger/interface note with deferred activation timing rather than as held slot-state. | custom |
| Equipment | item-effect | Scroll that manifests from a fixed list of mundane adventuring gear. Companion fixes six named gear entries on the parchment, allows any three to be manifested per day within 10', and restores the name only when the created item vanishes. Good Chapter 05 precedent for menu-based utility fabrication instead of open-ended item creation. | custom |
| Illumination | item-effect | Reusable flame-scroll utility for sustained light and fire-starting. | direct |
| Mages | item-effect | Scroll-based nearby magic-effect identification; complements `Read Magic` rather than replacing it. | partial |
| Maps to Treasures / Treasure Maps | item-effect | Treasure-location wrapper with normal, magical, combined, and special treasure lanes; niche but reusable lookup surface. Basic evidence lock: map prepared in advance by referee, may be partial/riddle form, and may require `Read Languages` for use. | custom |
| Mapping | item-effect | Scroll-generated area map with limited secret-door detection. Companion makes this a once-per-day survey tool for a chosen fully-contained area within 100', up to 10,000 square feet. Useful Chapter 05 example for bounded reconnaissance interfaces that create records rather than immediate tactical effects. | custom |
| Portals | item-effect | Scroll-native reusable `Pass-Wall / Passwall` interface. | partial |
| Protection / Protection Scrolls | item-effect | Generic moving circle-of-protection wrapper shared by the specific protection scroll variants. Basic evidence lock: usable by any class, creates a moving 10' circle centered on reader, blocks listed creature entry, does not block their spell or missile attacks, and breaks if protected side initiates hand-to-hand attack. | partial |
| Protection from Elementals | item-effect | Circle protection scroll keyed specifically to elementals. | partial |
| Protection from Lycanthropes | item-effect | Circle protection scroll keyed to lycanthrope types by quantity band. | partial |
| Protection from Magic | item-effect | Protection-scroll ECM ward that blocks spells and spell effects from crossing the boundary; useful as a Chapter 05 boundary-interface model for denial fields rather than generic resistance. | custom |
| Protection from Undead | item-effect | Circle protection scroll keyed to undead by type and quantity. | partial |
| Questioning | item-effect | Nonliving-object interrogation procedure. | partial |
| Repetition | item-effect | Scroll wrapper that replays the same-level spell effect after one turn. | custom |
| Seeing | item-effect | Scroll-based remote creature imaging procedure. | partial |
| Shelter | item-effect | Pocket-room refuge scroll with supplies and extradimensional trapping edge cases. Companion gives this a furnished extradimensional room with replenishing food, temporary weapons, 12-hour use windows, and a severe trap state if the scroll is removed while occupants remain inside. Strong Chapter 05 model for refuge interfaces that bundle shelter, logistics, and containment risk. | custom |
| Spell Scrolls / Spells | item-effect | Generic spell-scroll wrapper covering class restrictions, multi-spell payloads, and copy-versus-cast handling. | partial |
| Spell Catching | item-effect | Catches one incoming spell into scroll capacity bands; strong Chapter 05/06 bridge case for hostile-power capture into storage media using explicit Power Level capacity rather than slot logic. | custom |
| Spell Storing | item-effect | Ring-based spell payload storage and later discharge; should convert as an item-side power archive with Power Level capacity and release rules, not as prepared-slot retention, and it does not absorb attacks cast at the wearer. | custom |
| Trapping | item-effect | Scroll-created physical trap keyed by placement surface. Companion ties payload to placement surface: floor for pit, ceiling for falling-block, otherwise poison-dart or gas logic, and the created trap is real rather than illusory. Good Chapter 05 precedent for trigger-bearing utility items that instantiate environmental hazards instead of casting direct attacks. | custom |
| Truth | item-effect | Living-mind question procedure via an enhanced ESP-like readout. | partial |
| Cursed / Cursed Scroll | item-effect | Immediate curse-on-sight scroll wrapper; niche but persistent enough to deserve a canonical lookup row. Basic evidence lock: curse triggers on seeing writing; reading aloud is not required. | partial |

#### Non-Spell Rows - Ring Interfaces

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Ring of Elemental Adaptation | item-effect | Plane-keyed elemental survival ring available in seven variants (single element, paired Air/Water or Earth/Fire, or all-elements) that lets the wearer breathe and see normally within the matching Elemental Plane. Strong supporting interface for talisman/staff travel bundles, but narrower than those because it does not itself provide transit or command. | partial |
| Ring of Holiness | item-effect | Cleric/druid power-augmentation wrapper tied to ring use; later conversion should express this as eligibility, blessing-layer access, or reduced burden around holy/nature powers rather than extra slot grant. | custom |
| Ring of Life Protection | item-effect | Anti-drain and life-threshold safeguard interface with finite depletion behavior; useful as a threshold-protection model distinct from ordinary healing because it prevents or defers loss rather than repairing it after the fact. | custom |
| Ring of Memory | item-effect | Immediate one-spell recall interface for spellcasters only: the wearer must choose within 1 turn of casting, then the spell is instantly relearned, with the ring restoring only one spell per day. Strong Chapter 05 model for short-horizon recovery/retention rather than passive memory bonuses or broad archive storage. | custom |
| Ring of Remedies | item-effect | Bundled condition-repair and cleansing wrapper across multiple cure lanes; likely a reusable Chapter 05 model for one item exposing several tagged recovery functions instead of one-to-one spell copies. | custom |
| Ring of Spell Eating | item-effect | Hostile spell-defense and absorption interface distinct from plain spell turning; a core Chapter 05 ECM item case for canceling or consuming incoming powers instead of merely reflecting them. | custom |
| Ring of Spell Turning | item-effect | Reflects 2-12 incoming spell attacks back to their casters; distinct from absorption in that the spell is redirected rather than consumed. Finite (2-12 charge) reflection capacity with clean counterforce directionality. A core ECM item model at the Expert tier alongside Ring of Spell Eating at higher weight. | custom |
| Ring of Survival | item-effect | Environmental hardening and hazard-resistance wrapper at item scale. | partial |

#### Non-Spell Rows - Staff, Rod, and Talisman Interfaces

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Staff of Dispelling | item-effect | Touch-based targeted dispel interface with special handling for potions, scrolls, and permanent items; likely a key Chapter 05 example for using `Level` as counterforce strength while preserving carrier-specific edge cases. | custom |
| Staff of the Druids | item-effect | Druid power-augmentation and charge-linked upkeep interface; should convert as attuned access to druidic functions or bundled powers rather than as raw slot augmentation. | custom |
| Staff of an Element | item-effect | Element-tuned summoning, negation, and planar operation interface; includes multi-element and elemental-power variants, so it is a strong Chapter 05 bundle case rather than a single-spell export. | custom |
| Staff of Harming | item-effect | Cleric-only Chaotic harm staff: touch inflicts 2-7 damage in addition to normal staff damage at 1 charge per harmed creature, and it can spend 2/2/3/4 charges to deliver cause blindness, cause disease, cause serious wounds, or create poison as reversed cleric payloads. | custom |
| Rod of Health | item-effect | Cleric-only healing rod that inherits the full staff-of-healing package without spending charges, but can affect any given creature only once per day regardless of which healing/remedy function is chosen. Useful Chapter 05 model for renewable recovery access with strict per-target cadence. | partial |
| Rod of the Wyrm | item-effect | Alignment-keyed draconic interface: once per day the rod becomes a 30 hp servant dragon (gold, blue, or black by rod type) that can serve as messenger, steed, guard, or combatant, but a wrong-alignment user triggers immediate betrayal and a slain dragon form destroys the rod permanently. | custom |
| Talisman of Elemental Travel | item-effect | Lesser talismans reverse a conjure elemental on the Prime Plane to send the wearer into one matching Elemental Plane while granting breathable element-matter and strong vision there; the greater talisman covers all planes and can spend up to 10 charges per trip to compel elemental obedience. Strong Chapter 05 bundle case for transit, adaptation, and command in one interface. | custom |

#### Non-Spell Rows - Arcane Tools and Utility Interfaces

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Quill of Copying | item-effect | Spell transcription and copy-risk procedure; strong Chapter 05/06 spell-handling bridge. | custom |
| Slate of Identification | item-effect | Item-identification procedure surface distinct from `Read Magic` and `Mages` scroll behavior. | partial |

#### Non-Spell Rows - Artifact Procedures

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Artifact Activation | procedure | Activation/discovery interface for artifact powers; supports staged unlock and control workflows. Master emphasizes that possession is insufficient: activation and per-power control may require ritual, event, legend, or research, and discovery should unfold gradually. Strong Chapter 05 bridge case for attunement-plus-discovery doctrine rather than instant full access. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless a structurally equivalent `RC` procedure witness is later added. | custom |
| Artifact Charges And Recharge | procedure | Artifact power-budget, charge-drain, and recharge-cycle doctrine for repeated effect use. Master ties artifact magnitude to total power budget, has each use drain charges equal to the selected power's cost, and treats recharge as regeneration over time rather than ordinary finite-item depletion. Useful Chapter 05 model for renewable high-tier reserves instead of consumable wand-style charge logic. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless a structurally equivalent `RC` procedure witness is later added. | custom |
| Artifact Intelligence And Auto-Defense | procedure | Rudimentary artifact agency and self-defense behavior when attacked or endangered. Master presentation supports semi-autonomous artifact behavior, including telepathic guidance when worth is proven and separate protective logic from the bearer's ordinary action economy. Good Chapter 05/06 precedent for item-side will, refusal, and automatic defensive responses. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless a structurally equivalent `RC` procedure witness is later added. | custom |
| Artifact Handicaps And Penalties | procedure | Core adverse-effect framework for mortal artifact users (permanent handicaps and temporary penalties). RC directly preserves the handicap/penalty distinction; Master carries the fuller procedure surface. | custom |
| Attacking An Artifact | procedure | Artifact durability, attack-immunity boundaries, damage thresholds, power loss, and recall behavior under sustained attacks. RC confirms the immunity/destruction baseline; Master carries the fuller degradation procedure. | custom |
| Destruction Of An Artifact | procedure | Permanent-destruction quest procedure and Immortal-response consequences. RC confirms that each artifact has a unique legendary destruction method; Master carries the fuller destruction workflow and aftermath. | custom |
| Creating Artifacts | procedure | Artifact design workflow including magnitude, power limits, activation model, and adverse-effect selection. Master ties every artifact to an Immortal's Sphere-aligned purpose, uses magnitude (`Minor`/`Lesser`/`Greater`/`Major`) to set both power count and adversity load, and expects activation/discovery methods to be designed as part of the item rather than bolted on later. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless a structurally equivalent `RC` procedure witness is later added. | custom |

#### Non-Spell Rows - Immortal Procedures

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Immortal Magical Effect Index (S1-S4) | procedure | Reference-index procedure for mapping mortal and non-spell effects to Immortal power-cost handling. Operationally this is the bridge that treats classic spells and many artifact-style non-spell effects as one indexed PP vocabulary, making it especially useful for Chapter 05 unification work. | custom |
| Immortal Caster Level Rule | procedure | Sets effective caster level at 2 x HD for all created effects and dispel interactions. Important downstream consequence: duration, scaling, and dispel resistance all key off this doubled effective level even though the effect is created rather than cast. | custom |
| Immortal Range / Duration Scaling | procedure | Cost-doubling framework for extending range, duration, and effect volume, including planar-path limits. Instant/permanent effects and range-0 effects cannot be extended, volume increases may require geometry-aware recalculation, and cross-planar reach still requires an existing path such as a gate or wormhole. | custom |
| Immortal Conjuring And Summoning Limits | procedure | Defines transplanar response requirements and sphere/element bias constraints on conjured or summoned entities. Summoned beings must be able to reach the caller by their normal movement or via an opened path, and hostile elemental or Sphere bias can block response entirely even when the named effect normally works. | custom |
| Immortal Damage Scaling And Averaging | procedure | High-tier damage rule set using HD-based dice and optional average-damage method for faster resolution. Immortal-created effects deal 1d6 per HD of the creator, average-damage substitution is explicitly encouraged for speed, and per-die modifiers are clamped by the die's natural min/max rather than added naively to the final total. | custom |
| Immortal Mental Effect Resolution | procedure | Non-magical recovery cadence for charmed/feebleminded Immortals via Intelligence checks plus save retries. Permanent mortal-style mental effects become recurring resistance procedures at Immortal tier: A-M and saves still matter up front, magical self-cure is unavailable, and later escape depends on Intelligence-based check cadence followed by a fresh save. | custom |
| Immortal Limits On Use | procedure | Action-economy and target-scope doctrine for created effects, including self-only effects delivered by touch. Immortal-created magic can affect Immortals while mortal-created magic cannot, incorporeal beings ignore magic entirely, self-only effects can be delivered outward by touch, and each round permits either one magical action or the form's available physical attacks, not both. | custom |

#### Borderline Family Notes

- `Ethereal Counter Magitech` versus `Interfaces and Scrollcraft`: use `Ethereal Counter Magitech` when the effect suppresses, catches, dispels, blocks, reflects, or jams hostile magic; use `Interfaces and Scrollcraft` when the row is mainly about storage, activation, copying, delayed release, or treasure-device handling.
- `Knowledge and Revelation` versus `Veils and Illusions`: anti-concealment lives under `Knowledge and Revelation`; concealment, disguise, proxy images, and false stimuli live under `Veils and Illusions`. Some pairs such as `Detect Invisible` and `Invisibility` are intentionally mirror cases across the boundary.
- `Restoration and Thresholds` versus `Transformation and Fabrication`: healing, cure, resurrection, and recovery stay in `Restoration and Thresholds`; regrowth, mutation, body editing, and form rewriting stay in `Transformation and Fabrication`. Biomantic rebuild powers may be cited in both notes, but should still get one primary placement.
- `Mobility and Access` versus `Defense and Boundaries`: passage, transit, relocation, and route certainty live under `Mobility and Access`; locks, wards, seals, exclusion zones, and persistent boundary control live under `Defense and Boundaries`.
- `Summons and Servitors` versus `Transformation and Fabrication`: called agents, servitors, elementals, and delegated entities live under `Summons and Servitors`; created or altered bodies, matter reshaping, and fabricated forms live under `Transformation and Fabrication`.
- `Support and Augmentation` versus `Terrain and Environment`: expedition sustainment, buffs, survival prep, and supply safety live under `Support and Augmentation`; macro weather, landscape, and infrastructure manipulation live under `Terrain and Environment`, even when the practical use is still camp support.
- `Communication and Inquiry` versus `Influence and Control`: asking, translating, consulting, and establishing a channel live under `Communication and Inquiry`; compelled obedience, rhetorical capture, banishing speech-acts, and command-binding live under `Influence and Control`, even when words are the delivery mechanism.
- `Veils and Illusions` versus `Terrain and Environment`: if the row mainly lies about the battlefield or denies sight without materially changing the world, keep it under `Veils and Illusions`; if it physically reshapes plants, stone, weather, or terrain, keep it under `Terrain and Environment`.

## Family Coverage Audit

- Base-catalog SDM-family promotion is now complete: every flat row in the Phase 1 catalog appears in at least one grouped family section.
- Cross-family duplication is still allowed where it improves drafting clarity, but missing-family coverage is no longer the blocker.
- Future regrouping work should now focus on SDM family boundaries, relationship notes, Overcharge candidates, and variant tagging rather than raw promotion completeness.

## Deferred Bundle Notes

- Staff of Power bundle to resolve in the next pass:
	- `Fire Ball / Fireball`
	- `Lightning Bolt`
	- `Ice Storm`
	- `Continual Light`
	- `Telekinesis`
- Staff of Wizardry bundle to resolve in the next pass:
	- `Invisibility`
	- `Pass-Wall / Passwall`
	- `Web`
	- `Conjure Elemental`
	- whirlwind / cone of paralyzation riders
- Staff of Elemental Power still needs a dedicated bridge note pass for effect naming and elemental counter-negation phrasing.
- Expert ECM item coverage status (2026-03-23): `Ring of Spell Turning` and `Ring of Spell Eating` are both now in Phase 1. Expert wands (Wand of Cold, Wand of Fear, Wand of Fire Balls, Wand of Illusion, Wand of Lightning Bolts, Wand of Negation, Wand of Polymorphing, etc.) are treated as delivery interfaces for existing spell families and do not receive separate Phase 1 rows; `Wand of Negation` (cancels one other wand or staff effect for 1 round) is the only Expert wand with a distinct ECM-adjacent interface, and should be noted if the ECM family needs deeper item-interface coverage in Chapter 05.

## Implementation Notes

- This seed batch remains valid, but it is now only the first slice of a larger full-spell crosswalk.
- Tranche B/C now extends grouped Chapter 06-facing families across SDM-first lanes for detection, wards, movement, control, illusion, transformation, environment, summoning/calling, communication/interrogation, restoration, storage interfaces, and high-tier doctrine.
- Tranche B now also records the planning doctrine for existing Luka-style variants: canonical spell names remain the lookup surface, while stylized SDM powers are captured as named variants to point at.
- The grouped family layer should de-duplicate canonical rows whenever possible; use the most useful primary family and avoid repeating the same lookup row across multiple sections unless a cross-family repeat is truly necessary.
- `partial` is being used where the classic recognizer is clear but the SDM implementation will need storage, retention, trigger, bearer-language, or powers-taxonomy bridge text.
- `custom` is being used where the classic spell is really a bundled subsystem, ritual-grade exception, or doctrine carrier rather than a clean one-power export.
- This pass is writing notes for conversion, not final SDM powers. Where a classic row clearly wants to become a trait, item, burden, or location interface later, record that pressure in notes instead of forcing a premature one-power mapping.
- Overcharge relationships should be captured during later conversion passes whenever multiple classic rows obviously form one scaling family. Fireburst ladders, acceleration ladders, and related escalating artillery or control suites are the main candidates.
- When a classic family is likely to collapse into one SDM power progression, note whether higher riders may begin locked, corrupted, or encrypted and require RSS- or campaign-side work to unlock safely.
- ECM rows should continue to prefer negation, denial, capture, reflection, cancellation, and jamming language over broad defensive or restorative bucket sprawl.
- Existing SDM variants from UVG / VLG / OGA sources should be harvested systematically during the next passes, especially for high-signal canonical names that already have obvious descendants in the Powers Index.
- The staged corpus should now be expanded outward from this seed batch until Chapter 06 can treat the crosswalk as canonical spell-source infrastructure.
