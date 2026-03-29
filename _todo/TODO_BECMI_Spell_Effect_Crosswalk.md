# TODO: BECMI Spell / Effect Crosswalk

This document is the downstream handoff artifact for the completed BECMI spell-material staging corpus.

Purpose:
- track classic spell and effect names across the staged core books
- build the full canonical spell crosswalk from the staged corpus
- support FTLS Chapter 06 powers drafting as the next major downstream consumer
- support the broader `Spells -> Powers` conversion pass

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

- Confidence audit is complete and the metadata layer is now rated **0.90 / 1.00 floor-based** as approved working infrastructure.
- The staged corpus remains source-frozen and is the only legal witness set for Chapter 06 `osr:` imports.
- Chapter 06 design decisions are locked; Chapter 06 `alpha` is still open.
- Chapter 05 bridge continuation remains paused until Chapter 06 reaches `alpha`.
- Operational import backlog for the spell-only Chapter 06 `osr:` pass is defined below under `## Phase B Backlog: Chapter 06 osr: Import`.

## Execution Lock Snapshot (2026-03-28)

- **Source lock**: open and frozen on the six staged spell files only.
- **Confidence lock**: open at **Approved Working Infrastructure (0.90 / 1.00 floor-based)**.
- **Exception lock**: all 14 verified exception rows remain in force pending new evidence.
- **Chapter 06 design lock**: open; activation/payment/storage/overcharge/scale doctrine is already locked.
- **Chapter 06 alpha gate**: still closed; literal `osr:` import is part of the remaining alpha work.
- **Chapter 05 bridge gate**: closed until Chapter 06 `alpha` is complete.

## Exception State Ledger

This table is the canonical record of all verified exception-state rows. Updated each time provenance uplift work is performed.

Interpretation: `Confirmed RC-only` means all five pre-RC staging files (Basic, Expert, Companion, Master, Immortals) were searched and no standalone spell witness was found. `Confirmed Master-only` means no RC procedure witness was found in the RC staging file. Both statuses were verified 2026-03-26 during the Phase 1 provenance ledger pass.

| Row | Exception Class | Pre-RC Witness Status | Evidence Checked Date | Decision | Notes |
| --- | --- | --- | --- | --- | --- |
| Analyze | RC-only spell | Confirmed RC-only | 2026-03-26 | Keep as RC-only exception | Search of B/E/C/M/I staging files returned no standalone spell witness. Low-tier MU1 analysis utility not evidenced in pre-RC lanes. |
| Entangle | RC-only spell | Confirmed RC-only | 2026-03-26 | Keep as RC-only exception | Search returned one hit in Master staging (line 3052–3053) describing an artifact trap mechanism, not a standalone arcane spell. No spell witness. |
| Create Air | RC-only spell | Confirmed RC-only | 2026-03-26 | Keep as RC-only exception | No pre-RC spell witness found. Environmental survival entry appears only in RC arcane spell list. |
| Clothform | RC-only spell | Confirmed RC-only | 2026-03-26 | Keep as RC-only exception | No pre-RC spell witness found. Form-spell suite (Cloth/Stone/Wood/Iron/Steelform) appears to have been introduced at the RC compendium stage. |
| Stoneform | RC-only spell | Confirmed RC-only | 2026-03-26 | Keep as RC-only exception | No pre-RC spell witness found. Part of RC-introduced form-spell suite. |
| Woodform | RC-only spell | Confirmed RC-only | 2026-03-26 | Keep as RC-only exception | No pre-RC spell witness found. Part of RC-introduced form-spell suite. |
| Ironform | RC-only spell | Confirmed RC-only | 2026-03-26 | Keep as RC-only exception | No pre-RC spell witness found. Part of RC-introduced form-spell suite. |
| Steelform | RC-only spell | Confirmed RC-only | 2026-03-26 | Keep as RC-only exception | No pre-RC spell witness found. Advanced form-spell variant in RC-introduced suite. |
| Artifact Activation | Master-only procedure | Confirmed Master-only | 2026-03-26 | Keep as Master-only exception | Attunement/discovery doctrine. RC staging does not contain a structurally equivalent standalone procedure witness. |
| Artifact Charges And Recharge | Master-only procedure | Confirmed Master-only | 2026-03-26 | Keep as Master-only exception | Magnitude-reserve doctrine. RC staging does not contain a structurally equivalent standalone procedure witness. |
| Artifact Intelligence And Auto-Defense | Master-only procedure | Confirmed Master-only | 2026-03-26 | Keep as Master-only exception | Autonomous agency doctrine. RC staging does not contain a structurally equivalent standalone procedure witness. |
| Creating Artifacts | Master-only procedure | Confirmed Master-only | 2026-03-26 | Keep as Master-only exception | Design workflow procedure. RC staging does not contain a structurally equivalent standalone procedure witness. |

## Metadata Scrape Confidence (2026-03-28 sync)

- Scope: the metadata scrape pass is still evaluated as a separate layer from provenance, but the score now inherits the audited staging baseline where weaker source lanes increase downstream re-check burden.
- Interpretation rule: provenance confidence answers "do the rows point back to the staged corpus clearly enough?" Metadata confidence answers "do the rows carry enough structured metadata to drive conversion work without re-scraping the whole corpus?"

### Metadata Rubrics

- **Schema Capture Confidence**
	- what it measures: whether the expected metadata-bearing table shapes are present and stable across the workspace
	- freeze signal: the artifact currently contains **15** Phase 1 catalog tables using the full provenance-bearing row shape and **32** Phase 2 mapping tables using the conversion-note row shape
	- rating: **1.00 / 1.00**
	- reason: table inventory matches the audited expected shape count.
- **Family Metadata Completeness**
	- what it measures: whether each generic family block carries the minimum metadata needed for Chapter 06 ordering and regrouping work
	- freeze signal: all **13** family blocks currently include the full four-line metadata package: `Current Header`, `Proposed Tag Family`, `Legacy Groups Merged`, and `Downstream Notes` for a total of **52** metadata lines
	- rating: **1.00 / 1.00**
	- reason: all 13 families carry the full metadata package.
- **Row-State Label Coverage**
	- what it measures: whether Phase 2 rows carry explicit downstream-decision metadata rather than floating as unclassified notes
	- freeze signal: the current mapping tables expose **363** explicit row-state labels: **14** `direct`, **141** `partial`, and **208** `custom`
	- rating: **1.00 / 1.00**
	- reason: audited row-state coverage is 100%.
- **Evidence-Note Density**
	- what it measures: how often the scrape already preserved high-value explanatory metadata such as `Evidence lock`, `Verification pass`, and `Existing SDM variant` notes for downstream drafting
	- freeze signal: Phase 2 table rows carrying an inline evidence lock, evidence note, or verification pass marker now total **52**, exceeding the `>= 50` target
	- rating: **1.00 / 1.00**
	- reason: the audited marker count clears the current gate target.
- **Downstream Drafting Readiness**
	- what it measures: whether the scraped metadata is good enough to support Chapter 06 family drafting without returning to the staging corpus for every local decision
	- freeze signal: provenance-bearing Phase 1 rows, regrouped family tables, explicit family-order metadata, and row-state labels now coexist in one artifact with the staging corpus already frozen beneath it
	- rating: **0.90 / 1.00**
	- reason: drafting is approved to proceed, but weaker lanes still justify occasional returns to staged witnesses during import review.

- Overall metadata scrape confidence: **Approved Working Infrastructure (0.90 / 1.00 floor-based)**
	- summary: all structural metadata gates are green; remaining drag is execution vigilance, not tracker incompleteness.
- Residual metadata risks:
	- row-note depth is uneven by design, with denser annotation concentrated on exception rows, RC-only rows, and high-risk conversion families
	- some repeated note language and alias phrasing still need later editorial normalization, but they do not block downstream use
	- `partial` and `custom` remain working judgment labels rather than final publication taxonomy; expect a small number of reclassifications during drafting

## Mapping Status Decision Matrix

Use these criteria when assigning or reviewing `direct`, `partial`, or `custom` status to any Phase 2 family row. Apply the first matching row in the table.

| Criterion | → `direct` | → `partial` | → `custom` |
| --- | --- | --- | --- |
| **SDM corpus match** | Functional match found; mechanics transfer with renaming only | Recognizer exists but requires mechanics adaptation or doctrine delta | No adequate SDM recognizer; new doctrine required |
| **Effect scope delta** | ≤ 10% delta on core mechanics (range, duration, save) | > 10% delta but preservable via tag, modifier, or variant note | Core mechanic unavailable in SDM; requires invention |
| **Reverse / alternate form** | No reverse, OR reverse is a clean symmetric inversion | Reverse present with rules delta that needs a conversion note | Reverse creates fundamentally different doctrine |
| **Evidence lock status** | Lock confirmed, no edge cases | Lock partial or implicit; edge case present | No lock or hard exception flags present |
| **Chapter 06 decision pending?** | No — mapping is unambiguous | Minor clarification needed during drafting | Yes — requires a doctrine decision before mapping |

## Metadata Confidence v2 Gate (2026-03-27)

Threshold definitions for moving between confidence bands:

| Threshold | Score | Gate Criteria |
| --- | --- | --- |
| **Minimum Viable** | 0.85 | Provenance verified; all rows have status labels; exception ledger exists; staging corpus frozen |
| **Approved Working Infrastructure** | 0.90 | Evidence-note density ≥ 50 markers; decision matrix documented; high-risk families (healing, defense/boundary, barrier) carry source-grounded evidence locks |
| **High Confidence** | 0.95 | Top custom rows and remaining fragile families carry denser evidence locks and a refresh audit confirms calibration |
| **Publication Ready** | 0.98 | All `partial`/`custom` rows carry evidence locks; row-state audit confirms calibration across all families; v2 gate in place |

### Current rating: Approved Working Infrastructure (0.90 / 1.00)

- **Provenance (1.00)**: Exception ledger verified, all 14 exception rows confirmed, and the staged corpus remains frozen.
- **Row-State Coverage (1.00)**: 363 explicit status labels; audit sample confirmed consistent calibration.
- **Evidence-Note Density (1.00)**: 52 audited inline evidence/verification markers; current gate target exceeded.
- **Downstream Drafting Readiness (0.90)**: import work is approved, but execution should keep spot-check discipline on weaker lanes and table-derived rows.

**Gate status**: Open for Chapter 06 multi-witness `osr:` preservation import.


## Forward Plan

1. Pass 1: update all stale confidence or audit notes and decide and implement locks across the active `_todo` governance stack.
2. Pass 2: build the clean multi-witness staging layer, then import literal `osr:` text into Chapter 06 Power cards for every in-scope spell recognizer row.
3. Pass 3: convert, power by power, `osr:` references into SDM system terms with the minimum changes required.
4. Pass 4: refine the Chapter 06 main-content rules blocks after the preservation pass is frozen.
5. **Phase B: Power / Spell API Bridge** — consume crosswalk doctrine to finish the bridge inside `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_06_Powers.md`: convert classic spell names that still function only as recognizers into explicit SDM `power` language; lock `Power Level` for storage/capacity and `Level` for counterforce/dispel.

## Phase B Backlog: Chapter 06 `osr:` Import

This is the execution backlog for the first downstream phase after the staging-confidence lock. Current in-scope workload is the **194-row spell-only pass**: **181** normal spell rows plus **13** rows already flagged `[table-derived]` in `osr: imported`. This backlog covers literal OSR text preservation only. It does **not** authorize early SDM rewrite, balance work, or doctrine invention inside the `osr:` block.

### Pass 1: Lock, Readiness, And Tracker Normalization

1. Update all stale confidence or audit notes and decide and implement locks across the active `_todo` governance docs before any family import batch begins.
2. Synchronize this crosswalk's confidence section to the 2026-03-28 audit report and treat that report as the current measured baseline.
3. Record the current sequencing locks explicitly:
   - staged spell corpus frozen as source truth,
   - Chapter 06 design decisions locked,
   - Chapter 06 `alpha` still open,
   - Chapter 05 bridge work paused until Chapter 06 `alpha`.
4. Confirm the tracker contract is stable before import starts:
   - `Type = spell`,
   - `Ch06 Import = ✓`,
   - `osr: imported` is the execution-state field.
5. Treat the 13 existing `[table-derived]` rows as mandatory review-priority rows for the later exception sweep.

### Gate And Freeze

6. Record the import gate as open only when the staging corpus remains frozen, provenance stays at required confidence, the exception ledger remains verified, and the clean multi-witness staging file remains reproducible from the frozen lane docs.
7. Treat the six staging documents as the only legal upstream witness base for `osr:` imports, and `_todo/TODO_BECMI_Spell_Material_Staging.md` as the primary downstream import source. Do not copy from PDFs, OCR scratch files, or ad hoc notes once this phase begins.
8. Keep the current exception doctrine in force:
   - verified `RC`-only rows remain `RC`-only exceptions,
   - verified `Master`-only procedures remain `Master`-only exceptions,
   - no new provenance uplift work is bundled into the import pass unless a row is truly blocked.

### `osr:` Block Contract

9. Use `osr:` as a multi-witness preservation field, not a rewrite field. Imported text should stay verbatim to the staged source except for minimal line-wrap cleanup required by Markdown/card readability.
10. Preserve classic procedure details when they appear in any staged witness: original spell name, class/spell-level cues, range, duration, effect language, save language, reverse-form handling, and termination conditions.
11. When multiple staged witnesses exist, include all available witnesses in deterministic lane order inside the literal `osr:` block: `Basic`, `Expert`, `Companion`, `Master`, `Immortals`, `Rules Cyclopedia`.
12. Each witness inside `osr:` should carry a compact source label and its literal text. Do not synthesize a preferred merged body, silently reconcile wording deltas, or collapse the witness bundle back to one compendium surface.
13. If a row has a meaningful wording-delta or table-derived risk note, preserve that warning in row notes or import-review notes rather than silently harmonizing the text.

### Crosswalk Control Board

14. Treat `Ch06 Import` and `osr: imported` as the canonical import tracker for every Chapter 06 recognizer row.
15. Normalize import-state usage:
   - `Ch06 Import`: `✓` when a Chapter 06 card exists, `—` when no Chapter 06 card is planned.
   - `osr: imported`: `-` not started, `in-progress` active work, `yes` imported, `[needs-review]` imported but blocked on witness-audit or formatting/rendering check.
16. Limit blocker notes to real execution blockers only: missing Chapter 06 card, malformed staged witness extraction, missing expected witness lanes, or card-rendering/import failure.
17. Bulk runs may resync all in-scope spell rows and the full review queue. Targeted runs should update only the selected card's row state and any review-queue entry tied to that one spell.
18. Work in existing Chapter 06 family order so import and review follow manuscript structure rather than source-book order.

### Manuscript Import Pass

19. Build or refresh `_todo/TODO_BECMI_Spell_Material_Staging.md` before manuscript import work so Chapter 06 consumes one clean downstream witness bundle.
20. Replace every Chapter 06 spell-card `osr:` block for OSR recognizer cards with the full staged witness bundle for that spell.
21. Keep the FTLS main rules body, tags, and existing `meta:` structure stable during this pass except where minimum provenance cleanup is required to match the imported witness.
22. Do not import `osr:` blocks for non-OSR heritage powers, item-effects, procedures, or other entries that are not part of the spell recognizer bridge.
23. Preserve existing `see` pointers to SDM variants; those pointers are not a reason to omit the canonical OSR block.

### Audit And Acceptance

24. After each family batch, verify that:
   - the `osr:` block is no longer placeholder text,
   - all expected staged witnesses appear in deterministic lane order,
   - the imported text matches the staged anchor named in the row,
   - the row tracker is updated in the crosswalk,
   - the card still renders cleanly as Markdown.
25. Run stricter spot checks on all exception-state rows, all `RC`-only exceptions, all `Master`-only exceptions, every row already marked `[table-derived]`, and every row where the clean staging file reports a missing expected witness lane.
26. Capture unresolved problems in an import-review queue instead of solving them by rewriting the preserved OSR text.
27. The import phase is complete only when all 194 in-scope rows are no longer `-` and all Chapter 06 spell recognizer rows marked `✓` show `osr: imported = yes` or an explicit review-state marker.

### Downstream Handoff

28. Once the literal import pass is complete, open the next queue separately:
   - convert `osr:` references into SDM-native Chapter 06 rules text,
   - refine main-body FTLS mechanics power by power,
   - leave `osr:` preservation text frozen unless provenance correction is required.


## Chapter 06 `osr:` Import Review Queue



## Reference Reuse Targets

- Reuse [Synthetic_Dream_Machine_04_Powers_Index.md](/home/joshu/Synthetic-Dream-Machine/Synthetic_Dream_Machine_04_Powers_Index.md) for power template shape, storage tags, and existing variant precedent.
- Reuse [Synthetic_Dream_Machine_05_Gear_Index.md](/home/joshu/Synthetic-Dream-Machine/Synthetic_Dream_Machine_05_Gear_Index.md) for ward mechanics, antimagic handling, spell-eater style item interfaces, and storage-facing gear language.
- Reuse [Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_10_Appendix_Null_Referee_Resources.md](/home/joshu/Synthetic-Dream-Machine/Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_10_Appendix_Null_Referee_Resources.md) for tag vocabulary that should inform grouped family heuristics and cross-labels.
- Reuse [Synthetic_Dream_Machine_01_Quickstart.md](/home/joshu/Synthetic-Dream-Machine/Synthetic_Dream_Machine_01_Quickstart.md) for burden, item, and broad powers-access assumptions when the mechanics-delta note needs a canonical anchor.
- Reuse [Synthetic_Dream_Machine_03_Traits_Index.md](/home/joshu/Synthetic-Dream-Machine/Synthetic_Dream_Machine_03_Traits_Index.md) when storage-form differences or bearer-access doctrine suggest trait-side handling such as `Power Scroller`.
- Reuse [Vastlands_Guidebook/Vastlands_Guidebook.md](/home/joshu/Synthetic-Dream-Machine/Vastlands_Guidebook/Vastlands_Guidebook.md) for `Albums of Power`, `Storing Powers`, `Activating Powers`, and `Proper Wizard` as the clearest non-slot precedent set for SDM family naming and power storage behavior. Also a good referencve for Luka Rejec style & tone mapping.

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

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Cure Light Wounds | C1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Detect Evil | C1, MU2 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Detect Magic | C1, MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Light | C1, MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Protection from Evil | C1, MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Purify Food and Water | C1 | Basic, RC | Basic -> Spell Lists and Basic Spell Descriptions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Remove Fear | C1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Resist Cold | C1 | Basic, RC | Basic -> Spell Lists and Basic Spell Descriptions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |

#### Arcane (Basic-Anchored And Shared Entries)

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Charm Person | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Fire Ball / Fireball | MU3 | Basic, Expert, Master, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Chapter Context and Witnesses; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Floating Disc | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Hold Portal | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Light | C1, MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Magic Missile | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Protection from Evil | C1, MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Read Languages | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Read Magic | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Scrolls | spell | ✓ | yes |
| Shield | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Sleep | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Ventriloquism | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |

#### Item And Interface Effects

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Maps to Treasures / Treasure Maps |  | Basic, Expert, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | — | - |
| Protection / Protection Scrolls |  | Basic, Expert, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | — | - |
| Protection from Lycanthropes |  | Basic, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | — | - |
| Protection from Undead |  | Basic, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | — | - |
| Spell Scrolls / Spells |  | Basic, Expert, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | — | - |
| Cursed / Cursed Scroll |  | Basic, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | — | - |
| Holy Water |  | Basic | Basic -> Magic Item Identification, Use Model, and Charge Doctrine | item-effect | — | - |

#### Procedures

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Turning Undead |  | Basic | Basic -> Turning Undead | procedure | — | - |

### E - Expert

#### Cleric

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Bless | C2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Continual Light | C3, MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Cure Blindness | C3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Cure Disease | C3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Find Traps | C2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Growth of Animal | C3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Hold Person | C2, MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Know Alignment | C2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Locate Object | C3, MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Remove Curse | C3, MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Resist Fire | C2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Silence 15' Radius | C2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Snake Charm | C2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Speak with Animals | C2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Speak with the Dead | C3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Speak with Plants | C4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Sticks to Snakes | C4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Striking | C3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Animate Dead | C4, MU5 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Create Water | C4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Cure Serious Wounds | C4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Dispel Magic | C4, MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Neutralize Poison | C4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |

#### Arcane

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Continual Light | C3, MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Detect Evil | C1, MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Detect Invisible | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Dispel Magic | C4, MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| ESP | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Fly | MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Invisibility | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Invisibility 10' Radius | MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Knock | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Levitate | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Lightning Bolt | MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Locate Object | C3, MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Mirror Image | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Phantasmal Force | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Protection from Evil 10' Radius | C4, MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Protection from Normal Missiles | MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Water Breathing | Dr3, MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Druidic and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Web | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Wizard Lock | MU2 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Anti-Magic Shell | MU6 | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Chapter Context and Witnesses; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Animate Dead | C4, MU5 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Charm Monster | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Clairvoyance | MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Cloudkill | MU5 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Confusion | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Conjure Elemental | MU5 | Expert, Companion, Immortals, RC | Expert -> Clerical and Magic-User Spell Expansions; Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items; Immortals -> Section 3: Immortal Magic -> Explanation of Terms, Charts S1-S4 -> Conjure Elemental; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Death Spell | MU6 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Dimension Door | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Disintegrate | MU6 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Geas | MU6 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Growth of Plants | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Hallucinatory Terrain | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Haste | MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Hold Monster | MU5 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Ice Storm/Wall | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Infravision | MU3 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Invisible Stalker | MU6 | Expert, Immortals, RC | Expert -> Clerical and Magic-User Spell Expansions; Immortals -> Section 3: Immortal Magic -> Explanation of Terms, Charts S1-S4 -> Invisible Stalker; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Lower Water | MU6 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Magic Jar | MU5 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Massmorph | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Pass-Wall / Passwall | MU5 | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Chapter Context and Witnesses; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Polymorph Other / Others | MU4 | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Chapter Context and Witnesses; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Polymorph Self | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Projected Image | MU6 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Remove Curse | C3, MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Clerical and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Stone to Flesh | MU6 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Teleport | MU5 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Wall of Fire | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Wall of Stone | MU5 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Wizard Eye | MU4 | Expert, RC | Expert -> Clerical and Magic-User Spell Expansions; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |

#### Item And Interface Effects

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Animal Control |  | Expert | Expert -> Magic Item Doctrine and Intelligent Weapons | item-effect | — | - |
| Dragon Control |  | Expert | Expert -> Magic Item Doctrine and Intelligent Weapons | item-effect | — | - |
| Heroism |  | Expert | Expert -> Magic Item Doctrine and Intelligent Weapons | item-effect | — | - |
| Intelligent Swords / Special Swords |  | Expert | Expert -> Magic Item Doctrine and Intelligent Weapons | item-effect | — | - |
| Invulnerability |  | Expert | Expert -> Magic Item Doctrine and Intelligent Weapons | item-effect | — | - |
| Djinni Summoning |  | Expert | Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text -> Rings | item-effect | — | - |
| Human Control |  | Expert | Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text -> Rings | item-effect | — | - |
| Plant Control |  | Expert | Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text -> Rings | item-effect | — | - |
| Protection from Elementals |  | Expert, RC | Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text -> Protection Scrolls; RC -> Scrolls | item-effect | — | - |
| Protection +1, 5' radius |  | Expert | Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text -> Rings | item-effect | — | - |
| Protection from Magic |  | Expert, RC | Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text -> Protection Scrolls; RC -> Scrolls | item-effect | — | - |
| Regeneration |  | Expert | Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text -> Rings | item-effect | — | - |
| Spell Storing |  | Expert, Companion, RC | Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text -> Rings; Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | — | - |
| Treasure Finding |  | Expert | Expert -> Magic Item Doctrine and Intelligent Weapons | item-effect | — | - |
| Ring of Spell Turning |  | Expert, RC | Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | — | - |
| Wand of Negation |  | Expert | Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text -> Wands, Staves, and Rods | item-effect | — | - |
| Elemental Devices |  | Expert | Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text -> Miscellaneous Magic Items | item-effect | — | - |
| Helm of Teleportation |  | Expert | Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text -> Miscellaneous Magic Items | item-effect | — | - |

#### Procedures

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Alchemical Potion Duplication / Potion Research Support |  | Expert | Expert -> Magic Support Infrastructure | procedure | — | - |
| Sage Magical Research Support |  | Expert | Expert -> Magic Support Infrastructure | procedure | — | - |
| Spellbook Replacement |  | Basic, Expert, RC | Basic -> Spellbooks and Lost Book Recovery; Expert -> Research and Lost Spell Books; RC -> Magic-User Spell Books and Lost Spell Books | procedure | — | - |
| Magic Item Range/Duration Default |  | Expert | Expert -> Magic Item Doctrine and Intelligent Weapons | procedure | — | - |
| Magic Detection/Control Blocking |  | Expert | Expert -> Magic Item Doctrine and Intelligent Weapons | procedure | — | - |
| Intelligent Item Will Power / Control Check |  | Expert | Expert -> Magic Item Doctrine and Intelligent Weapons | procedure | — | - |

### C - Companion

#### Cleric

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Aerial Servant | C6 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Animate Objects | C6 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Barrier | C6 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Commune | C5 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Create Food | C5 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Create Normal Animals | C6 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Cure Critical Wounds | C5 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Cureall | C6 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Dispel Evil | C5 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Earthquake | C7 | Companion, Master, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Cleric Spells; Master -> Seventh-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Find the Path | C6 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Holy Word | C7 | Companion, Master, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Cleric Spells; Master -> Seventh-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Insect Plague | C5 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Quest | C5 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Raise Dead | C5 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Raise Dead Fully | C7 | Companion, Master, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Cleric Spells; Master -> Seventh-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Restore | C7 | Companion, Master, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Cleric Spells; Master -> Seventh-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Speak with Monsters | C6 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Truesight | C5 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |
| Word of Recall | C6 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |

#### Arcane

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Contact Outer Plane | MU5 | Companion, Immortals, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Magic-User Spells; Immortals -> Section 3: Immortal Magic -> Explanation of Terms, Charts S1-S4 -> Contact Outer Plane; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Charm Plant | MU7 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Create Normal Monsters | MU7 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Summon Object | MU7 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Sword | MU7 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Teleport any Object | MU7 | Companion, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |

#### Item And Interface Effects

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Communication |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Scrolls; RC -> Scrolls | item-effect | — | - |
| Creation |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Scrolls; RC -> Scrolls | item-effect | — | - |
| Delay |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Scrolls; RC -> Scrolls | item-effect | — | - |
| Equipment |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Scrolls; RC -> Scrolls | item-effect | — | - |
| Illumination |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Scrolls; RC -> Scrolls | item-effect | — | - |
| Mages |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Scrolls; RC -> Scrolls | item-effect | — | - |
| Mapping |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Scrolls; RC -> Scrolls | item-effect | — | - |
| Portals |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Scrolls; RC -> Scrolls | item-effect | — | - |
| Questioning |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Scrolls; RC -> Scrolls | item-effect | — | - |
| Repetition |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Scrolls; RC -> Scrolls | item-effect | — | - |
| Seeing |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Scrolls; RC -> Scrolls | item-effect | — | - |
| Shelter |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Scrolls; RC -> Scrolls | item-effect | — | - |
| Spell Catching |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Scrolls; RC -> Scrolls | item-effect | — | - |
| Trapping |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Scrolls; RC -> Scrolls | item-effect | — | - |
| Truth |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Scrolls; RC -> Scrolls | item-effect | — | - |
| Truthfulness |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | — | - |
| Truthlessness |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | — | - |
| Ring of Elemental Adaptation |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | — | - |
| Ring of Holiness |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | — | - |
| Ring of Life Protection |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | — | - |
| Ring of Memory |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | — | - |
| Ring of Remedies |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | — | - |
| Ring of Spell Eating |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | — | - |
| Ring of Survival |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings; RC -> Chapter 16 Item Description Catalog -> Rings | item-effect | — | - |
| Staff of Dispelling |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods; RC -> Chapter 16 Item Description Catalog -> Wands, Staves, and Rods | item-effect | — | - |
| Staff of the Druids |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods; RC -> Chapter 16 Item Description Catalog -> Wands, Staves, and Rods | item-effect | — | - |
| Staff of an Element |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods; RC -> Chapter 16 Item Description Catalog -> Wands, Staves, and Rods | item-effect | — | - |
| Staff of Harming |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods; RC -> Chapter 16 Item Description Catalog -> Wands, Staves, and Rods | item-effect | — | - |
| Rod of Health |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods; RC -> Chapter 16 Item Description Catalog -> Wands, Staves, and Rods | item-effect | — | - |
| Rod of the Wyrm |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods; RC -> Chapter 16 Item Description Catalog -> Wands, Staves, and Rods | item-effect | — | - |
| Quill of Copying |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Miscellaneous Items; RC -> Chapter 16 Item Description Catalog -> Miscellaneous Items | item-effect | — | - |
| Talisman of Elemental Travel |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Miscellaneous Items; RC -> Chapter 16 Item Description Catalog -> Miscellaneous Items | item-effect | — | - |
| Slate of Identification |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Miscellaneous Items; RC -> Chapter 16 Item Description Catalog -> Miscellaneous Items | item-effect | — | - |

#### Druid

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Anti-Animal Shell | Dr6 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Anti-Plant Shell | Dr5 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Call Lightning | Dr3 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Control Temperature 10' Radius | Dr4 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Control Winds | Dr5 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Creeping Doom | Dr7 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Faerie Fire | Dr1 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Hold Animal | Dr3 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Locate | Dr1 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Metal to Wood | Dr7 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Obscure | Dr2 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Pass Plant | Dr5 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Plant Door | Dr4 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Predict Weather | Dr1 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Produce Fire | Dr2 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Protection from Lightning | Dr4 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Summon Weather | Dr6 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Transport Through Plants | Dr6 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Warp Wood | Dr2 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Water Breathing | Dr3, MU3 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Weather Control | Dr7, MU6 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |

### M - Master

#### Cleric And Druid

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Detect Danger | Dr1 | Master, RC | Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Dissolve | Dr5, MU5 | Master, RC | Master -> Druid Spell Material; RC -> Druidic and Magical Spells Lists and Spell Descriptions | spell | ✓ | yes |
| Heat Metal | Dr2 | Master, RC | Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Protection from Poison | Dr3 | Master, RC | Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Summon Animals | Dr4 | Master, RC | Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Summon Elemental | Dr7 | Master, RC | Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Survival | C7, MU9 | Master, RC | Master -> Seventh-Level Cleric Spells; RC -> Clerical and Magical Spell Descriptions | spell | ✓ | yes |
| Travel | C7, MU8 | Master, RC | Master -> Seventh-Level Cleric Spells; Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Clerical and Magical Spell Descriptions | spell | ✓ | yes |
| Turn Wood | Dr6 | Master, RC | Master -> Druid Spell Material; RC -> Druidic Spells List and Spell Descriptions | spell | ✓ | yes |
| Wish | C7, MU9 | Master, RC | Master -> Seventh-Level Cleric Spells; Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Clerical and Magical Spell Descriptions | spell | ✓ | yes |
| Wizardry | C7 | Master, RC | Master -> Seventh-Level Cleric Spells; RC -> Clerical Spells List and Spell Descriptions | spell | ✓ | yes |

#### Arcane

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Clone | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Contingency | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Create Any Monster | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Create Magical Monsters | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Dance | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Explosive Cloud | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Force Field | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Gate | MU9 | Companion, Master, RC | Companion -> High-Level Cleric, Druid, and Magic-User Spell Material -> Ninth-Level Magic-User Spells; Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Heal | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Immunity | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Mass Charm | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Maze | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Meteor Swarm | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Mind Barrier | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Permanence | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Polymorph Any Object | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Power Word Blind | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Power Word Kill | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Prismatic Wall | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Feeblemind | MU5 | Master, RC | Master -> Artifact Chapter Context and Witnesses; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Move Earth | MU6 | Master, RC | Master -> Non-Human Spellcasters and Special Spellcaster Procedures; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Reincarnation | MU6 | Master, RC | Master -> Non-Human Spellcasters and Special Spellcaster Procedures; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Telekinesis | MU5 | Master, RC | Master -> Artifact Chapter Context and Witnesses; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Wall of Iron | MU6 | Master, RC | Master -> Non-Human Spellcasters and Special Spellcaster Procedures; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Lore | MU7 | Master, RC | Master -> Artifact Chapter Context and Witnesses; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Magic Door | MU7 | Master, RC | Master -> Artifact Chapter Context and Witnesses; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Mass Invisibility | MU7 | Master, RC | Master -> Artifact Chapter Context and Witnesses; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Power Word Stun | MU7 | Master, RC | Master -> Artifact Chapter Context and Witnesses; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Reverse Gravity | MU7 | Master, RC | Master -> Artifact Chapter Context and Witnesses; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Statue | MU7 | Master, RC | Master -> Artifact Chapter Context and Witnesses; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Shapechange | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Symbol | MU8 | Master, RC | Master -> Eighth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Timestop | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |

#### Item And Interface Effects

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Control Animals |  | Master | Master -> Artifact Chapter Context and Witnesses | item-effect | — | [table-derived] |
| Control Plants |  | Master | Master -> Artifact Chapter Context and Witnesses | item-effect | — | [table-derived] |
| Control Lesser Undead |  | Master | Master -> Artifact Chapter Context and Witnesses | item-effect | — | [table-derived] |
| Control Greater Undead |  | Master | Master -> Artifact Chapter Context and Witnesses | item-effect | — | [table-derived] |
| Control Giants |  | Master | Master -> Artifact Chapter Context and Witnesses | item-effect | — | [table-derived] |
| Control Dragons |  | Master | Master -> Artifact Chapter Context and Witnesses | item-effect | — | [table-derived] |
| Control Humans |  | Master | Master -> Artifact Chapter Context and Witnesses | item-effect | — | [table-derived] |
| Anti-Magic Ray |  | Master | Master -> Artifact Chapter Context and Witnesses | item-effect | — | [table-derived] |
| Plane Travel |  | Master | Master -> Artifact Chapter Context and Witnesses | item-effect | — | [table-derived] |
| Life Trapping |  | Expert, Master, RC | Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text -> Miscellaneous Magic Items; Master -> Artifact Chapter Context and Witnesses; RC -> Chapter 16 Item Description Catalog -> Miscellaneous Magic Items | item-effect | — | [table-derived] |
| Mapmaking |  | Master | Master -> Artifact Chapter Context and Witnesses | item-effect | — | [table-derived] |
| Open Mind |  | Master | Master -> Artifact Chapter Context and Witnesses | item-effect | — | [table-derived] |
| Turn Undead Bonus |  | Master | Master -> Artifact Chapter Context and Witnesses | item-effect | — | [table-derived] |
| Spell Damage Bonus |  | Master | Master -> Artifact Chapter Context and Witnesses | item-effect | — | [table-derived] |
| Choose Best Option / Choose Option |  | Master | Master -> Artifact Chapter Context and Witnesses | item-effect | — | [table-derived] |

#### Procedures

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Artifact Activation |  | Master | Master -> Artifact Chapter Context and Witnesses | procedure | — | - |
| Artifact Charges And Recharge |  | Master | Master -> Artifact Chapter Context and Witnesses | procedure | — | - |
| Artifact Intelligence And Auto-Defense |  | Master | Master -> Artifact Chapter Context and Witnesses | procedure | — | - |
| Artifact Handicaps And Penalties |  | Master, RC | Master -> Artifact Chapter Context and Witnesses; RC -> Artifacts | procedure | — | - |
| Attacking An Artifact |  | Master, RC | Master -> Artifact Chapter Context and Witnesses; RC -> Artifacts | procedure | — | - |
| Destruction Of An Artifact |  | Master, RC | Master -> Artifact Chapter Context and Witnesses; RC -> Artifacts | procedure | — | - |
| Creating Artifacts |  | Master | Master -> Artifact Chapter Context and Witnesses | procedure | — | - |
| Artifact Discovery And Power Reveal |  | Master | Master -> Artifact Chapter Context and Witnesses | procedure | — | - |
| Artifact Command Word / Thought / Gesture Interfaces |  | Master | Master -> Artifact Chapter Context and Witnesses | procedure | — | - |
| Artifact Recharge Exceptions And Paid Recharge |  | Master | Master -> Artifact Chapter Context and Witnesses | procedure | — | - |
| Artifact Conditional Revelation Triggers |  | Master | Master -> Artifact Chapter Context and Witnesses | procedure | — | - |
| Artifact Autonomous Service / Refusal |  | Master | Master -> Artifact Chapter Context and Witnesses | procedure | — | - |

### I - Immortals

No unique Phase 1 spell rows are currently Immortals-primary; Immortals remains represented as a co-source lane within relevant rows.

#### Procedures

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Immortal Power Point Conversion And Bookkeeping |  | Immortals | Immortals -> Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context -> Section 1: Changes | procedure | — | - |
| Immortal Rank And Level Frame |  | Immortals | Immortals -> Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context -> Section 1: Changes | procedure | — | - |
| Immortal GT Advancement Costs And Gate |  | Immortals | Immortals -> Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context -> increasing ability scores, rank costs, and GT advancement gate | procedure | — | - |
| Immortal Sphere Bias And Recovery |  | Immortals | Immortals -> Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context -> Section 2: New Characters Information | procedure | — | - |
| Immortal Sphere-Factor Cost Model |  | Immortals | Immortals -> Section 3: Immortal Magic -> Power Cost | procedure | — | - |
| Immortal Magical Effect Index (S1-S4) |  | Immortals | Immortals -> Section 3: Immortal Magic -> General Notes, Charts S1-S4 | procedure | — | - |
| Immortal Caster Level Rule |  | Immortals | Immortals -> Section 3: Immortal Magic -> Caster Level | procedure | — | - |
| Immortal Range / Duration Scaling |  | Immortals | Immortals -> Section 3: Immortal Magic -> Changing Range and Duration | procedure | — | - |
| Immortal Conjuring And Summoning Limits |  | Immortals | Immortals -> Section 3: Immortal Magic -> Conjuring and Summoning | procedure | — | - |
| Immortal Damage Scaling And Averaging |  | Immortals | Immortals -> Section 3: Immortal Magic -> Damage | procedure | — | - |
| Immortal Mental Effect Resolution |  | Immortals | Immortals -> Section 3: Immortal Magic -> Mental Effects | procedure | — | - |
| Immortal Limits On Use |  | Immortals | Immortals -> Section 3: Immortal Magic -> Limits on Use | procedure | — | - |
| Immortal Undead / Entropy Curing |  | Immortals | Immortals -> Section 3: Immortal Magic -> Undead Curing | procedure | — | - |
| Immortal Effect Explanation Overrides |  | Immortals | Immortals -> Section 3: Immortal Magic -> Explanation of Terms, Charts S1-S4 | procedure | — | - |

### RC - Rules Cyclopedia

#### Spells

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Analyze | MU1 | RC | RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Entangle | MU2 | RC | RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Create Air | MU3 | RC | RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Clothform | MU4 | RC | RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Stoneform | MU6 | RC | RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Woodform | MU5 | RC | RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Delayed Blast Fireball | MU7 | RC, Master | RC -> Magical Spells List and Spell Descriptions; Master -> Artifact Chapter Context and Witnesses | spell | ✓ | yes |
| Ironform | MU7 | RC | RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |
| Steelform | MU8 | RC | RC -> Magical Spells List and Spell Descriptions | spell | ✓ | yes |

#### Item And Interface Effects

No RC-primary Phase 1 item/interface rows are currently parked here; item-side `RC` evidence is carried as co-source context on the Basic, Expert, and Companion buckets.

#### Procedures

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Ch06 Import | osr: imported |
| --- | --- | --- | --- | --- | --- | --- |
| Charm Person Spell Resolution |  | RC | RC -> Spell-Adjacent Procedures and DM Spell Doctrine -> Charm Person Spells | procedure | — | - |
| Damage to Magical Items |  | Companion, RC | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Damage To Magic Items; RC -> Spell-Adjacent Procedures and DM Spell Doctrine -> Damage to Magical Items | procedure | — | - |
| Haste Speed Stacking Rules |  | RC | RC -> Spell-Adjacent Procedures and DM Spell Doctrine -> Haste Spell | procedure | — | - |
| Magic-User Starting Spell Choice |  | RC | RC -> Spell-Adjacent Procedures and DM Spell Doctrine -> Magic-User Spell Choice | procedure | — | - |
| Experience from Spells and Enchanted Items |  | RC | RC -> Spell Research -> Experience from Spells and Enchanted Items | procedure | — | - |

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
| Magic Missile | spell | Canonical Chapter 06 entry should remain `Magic Missile`. Existing SDM variant: `Tragic Missile` (Vastlands / Apocrypha of the O.S.). | partial |
| Fire Ball / Fireball | spell | Preserve `Fire Ball` (pre-RC BECMI) and `Fireball` (RC) as equivalent recognizer aliases. Chapter 06 now locks the mixed canonical key directly on the card heading rather than preferring an FTLS alt-name over it. Existing SDM variant: `Pyreball` (Vastlands / Apocrypha of the O.S.). Keep as the base fireburst family anchor beneath `Delayed Blast Fireball` and `Meteor Swarm`. | partial |
| Lightning Bolt | spell | Core line-artillery recognizer in the base attack family. | direct |
| Delayed Blast Fireball | spell | Timed artillery variant of the fireburst family. Treat as the middle rung between `Fire Ball / Fireball` and `Meteor Swarm`, not proof of a mandatory standalone export. | partial |
| Meteor Swarm | spell | Extreme artillery recognizer and current fireburst capstone above `Fire Ball / Fireball` and `Delayed Blast Fireball`. Keep as custom until Chapter 06 decides whether it remains a separate apex effect or becomes an overcharge endpoint. Evidence lock: Range 240', creates 1-4 40' radius meteor impacts (choose locations), each impact deals 10d10 fire damage with save-for-half, impacts persist with hazard interactions (craters, rubble, fire spread). | custom |
| Spell Damage Bonus | item-effect | Master artifact-table damage rider that augments one spell's damage on use rather than creating a new standalone payload. Strong Chapter 05 precedent for temporary artillery overcharge attached to an item-side interface instead of a separate castable effect. Evidence lock: augments one spell cast by the artifact user within 1 round, scaling bonus by spell level (1d6 bonus per spell level, max +6d6 damage), applies to damage rolls only (no save re-rolls), one-use-per-artifact-activation model. | custom |

#### Battle and Force / Hazards / Destruction

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Call Lightning | spell | Druidic artillery recognizer. Evidence lock: requires active storm within range, grants one 20' strike zone bolt per turn for duration, deals 8d6 electrical damage with save-for-half, and permits deferred bolt cadence while the spell remains active; ends when duration expires or weather prerequisite breaks. | partial |
| Cloudkill | spell | High-tier battlefield hazard / area denial lane. Expert evidence lock: drifting poison cloud (30' across, 20' tall) moves with wind/caster direction, sinks into low spaces, and disperses against thick vegetation; all living targets take ongoing damage and sub-5 HD targets also risk death by poison save failure. | custom |
| Death Spell | spell | High-tier kill / sweep spell lane. Expert evidence lock: resolves against a 4-32 HD budget inside a 60' cube, applies to lowest-HD living targets first, excludes undead and 8+ HD creatures, and uses Death Ray saves for survivability. | custom |
| Disintegrate | spell | Matter-destruction lane. Expert evidence lock: single-target annihilation for creatures or nonmagical objects (Death Ray save allowed), with explicit non-interaction against magic items and active spell effects. | custom |
| Explosive Cloud | spell | Custom mixed-condition area hazard: a moving cloudkill-profile cloud that forces repeat saves against paralysis while dealing unavoidable per-round explosion damage that bypasses conventional elemental immunities. | custom |
| Ice Storm/Wall | spell | Hybrid artillery and wall-control effect with dual-mode casting: a short damage storm with save-for-half or a longer wall with breach damage and creature-type exceptions. | custom |
| Insect Plague | spell | Custom battlefield swarm and area-denial effect: an outdoor-only 30' radius swarm lasting 1 day, driving off sub-3 HD creatures, obscuring visibility, and requiring stationary concentration to steer up to 20' per round. | custom |
| Power Word Blind | spell | Word-of-power debilitation lane. Evidence lock: no-save blindness at 120' for targets under fixed HP thresholds (longer duration for lower-HP targets), with explicit AC/save penalties and restricted cure access requiring equal-or-higher caster-tier clerical intervention. | partial |
| Power Word Kill | spell | Custom word-of-power execution effect at 120' with hard HP thresholds that kill low-HP targets, stun mid-HP targets, and allow only a narrow penalized save exception for magic-user-capable victims. | custom |
| Sword | spell | Force-weapon and animated blade lane. Evidence lock: caster-concentration directed magical blade at 30' that attacks twice per round using caster attack level, deals two-handed sword damage, and can strike targets requiring high-grade magical hit capability; concentration break pauses attacks but not duration, while dispel/wish can end the blade early. | partial |
| Wall of Fire | spell | Barrier-plus-damage lane bridging battlefield denial and direct harm. Treat as a partial fire-family recognizer, with relationship notes toward `Pyreball` and broader fireburst consolidation. | partial |

### family-2

- Current Header: `Healing and Restoration`
- Proposed Tag Family: `healing-restoration`
- Legacy Groups Merged: `Restoration and Thresholds / Healing / Resurrection`; `Purge and Safeguards / Recovery / Cleansing`; healing-support rows from `Support and Augmentation / Blessing / Sustainment`
- Downstream Notes: keep cure/restore/raise family coherent and distinct from biomancy transformation edits.

#### Regrouped Legacy Tables

#### Restoration and Thresholds / Healing / Resurrection

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Cure Critical Wounds | spell | Higher-tier healing upgrade. | direct |
| Cureall | spell | Broad repair / cleanse package: heals all wounds leaving only 1d6 hp remaining, OR removes exactly one of curse/neutralize poison/paralysis/disease/blindness/feeblemind per cast. Evidence lock: Range Touch, Duration Permanent; victim left at full hp minus 1d6 remaining after healing; caster must name the single condition addressed if multiple afflictions are present; uniquely enables just-raised creatures to forgo mandatory 2-week recovery rest (only Cureall triggers this exception, not standard magical healing). | partial |
| Restore | spell | Level-drain reversal and anti-drain lane. Evidence lock: Range Touch, Duration Permanent; restores exactly one energy-drained level; cleric casting temporarily loses one level (non-permanent, recovers after 2d10 days rest); reverse (Life Drain) draws one level from victim at no cost to caster but is Chaotic — key asymmetry for SDM drain-recovery doctrine. | partial |
| Raise Dead Fully | spell | Higher-tier resurrection lane beyond basic revival; keep as a deliberately separate row from `Raise Dead`. Evidence lock: Range 60', Duration Permanent; raises any living creature (not humans/demihumans only); humans and demihumans wake immediately at full hp with no recovery penalties — afflictions held at time of death persist; time limit 4 months dead at C17, +4 months per level above 17; immediately fatal to undead 7 HD or less with no save; higher undead receive saving rolls against the penalties. | custom |
| Heal | spell | Extreme recovery recognizer crossing clerical and arcane traditions at high tier. Evidence lock: Range Touch, Duration Permanent; effect identical to `Cureall` — heals all wounds leaving only 1d6 hp remaining, OR removes exactly one of curse/neutralize poison/disease/blindness/feeblemind; cures only one named condition per cast if multiple afflictions are present. Arcane capstone form of the same broad-repair and cleanse pattern. | custom |
| Survival | spell | Hazard-environment life support package for void, plane, and extreme condition play. | partial |

#### Purge and Safeguards / Recovery / Cleansing

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Cure Blindness | spell | Condition-removal lane for sensory impairment. Existing SDM family variants: `Real-Time Rebuild` for bodily restoration and `Restorative Slumber` for longer-form burden/attribute recovery. | partial |
| Cure Disease | spell | Disease-removal and anti-corruption-adjacent lane. Existing SDM family variant: `Real-Time Rebuild`, which explicitly flushes toxins or afflictions and restores damaged systems by power setting. | partial |
| Neutralize Poison | spell | Poison-cleansing and poison-creation lane. Existing SDM family variant: `Real-Time Rebuild`, which explicitly flushes toxins at lower power settings. | partial |
| Protection from Poison | spell | Poison immunity and anti-breath lane. Existing SDM family variant: `Real-Time Rebuild`, which is still a recovery-style toxin-handling cousin rather than true prophylactic immunity, so this remains only a partial match. | partial |
| Raise Dead | spell | Companion lane for the classic recognizer; keep distinct from `Raise Dead Fully` (do not alias-collapse). Evidence lock: Range 120', Duration Permanent; humans and demihumans only; body must be present at casting; time limit 4 days dead at C8, +4 days per level above 8; returns at 1 hp with mandatory 2-week bed rest that no magical healing can accelerate; also destroys most undead but is non-destructive against vampires (forces coffin retreat only). Existing SDM variant: `Raise Dead` (UVG2e Spells), with `Recall Soul` as a soul-return ritual cousin for explicit soul-handling conversions. | partial |
| Remove Curse | spell | Major curse-removal recognizer. Expert evidence lock: removes one curse from a character, item, or area, though some item curses are only temporarily lifted without higher-tier follow-up. Reverse form (`Curse`) stays bespoke conversion doctrine because it is intentionally open-ended within bounded safe limits and includes a save gate. | custom |

#### Support and Augmentation / Blessing / Sustainment

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Bless | spell | Morale and combat blessing lane. Expert evidence lock: applies to allies in a 20' square who are not yet in melee, granting +1 morale and +1 to attack/damage; reverse form (`Blight`) imposes mirrored penalties with a save gate. | partial |
| Continual Light | spell | Persistent light/darkness-management lane shared across clerical and arcane traditions. Expert evidence lock: permanent 30' bright light ending only via `Dispel Magic` or `Continual Darkness`; eye-target casting can blind on a failed save, and the reverse form blocks infravision and mundane light. | partial |
| Create Air | spell | Environmental survival and sealed-space support lane for vacuum, underwater, or enclosed-hazard play; likely a bespoke sustainment wrapper unless folded into broader life-support doctrine. Verification pass (2026-03-24) checked staged Basic/Expert/Companion/Master/Immortals lanes and found no standalone pre-`RC` spell witness; keep as explicit `RC`-only provenance exception unless new staged evidence is added. | custom |
| Create Food | spell | Supply-generation and survival support. Existing SDM family variant: `Process Food`, which converts raw matter into usable rations; `Green Haven` is a secondary expedition-sustainment cousin where the classic row is read as camp support rather than pure conjuration. | partial |
| Create Water | spell | Expedition sustainment lane for liquid-resource generation. Existing SDM cousins in `Process Food` and broader survival wrappers support a supply-doctrine mapping without requiring a literal slot-era clone. | partial |
| Cure Light Wounds | spell | Foundational healing support. Existing SDM family variants: `Rehoryan's Progressive Restoration` and `Restorative Slumber`, which frame healing as regenerative or recuperative process rather than instant slot discharge. | partial |
| Cure Serious Wounds | spell | Mid-tier healing support. Existing SDM family variants: `Rehoryan's Progressive Restoration` and `Real-Time Rebuild`, which provide stronger repair and regrowth scaling. | partial |
| Haste | spell | Acceleration and combat-tempo support; existing SDM cousin `Nunka's Biophysical Overdrive` expresses the same lane as metabolic overdrive with exhaustion burdens. | partial |
| Illumination | item-effect | Reusable flame-scroll utility for sustained light and fire-starting. | direct |
| Immunity | spell | Apex blanket-protection lane spanning broad hazard categories. Keep as custom until Chapter 06 sets explicit immunity scope boundaries and exception taxonomy. Evidence lock: Master entry grants broad hazard immunity (acid, electricity, fire, cold, gas/poison, or petrification — caster must specify at casting). Range 0 (self must cast), Duration 24 hours. Cannot stack with other immunity spells; explicit gaps for save-based effects and magic items. | custom |
| Light | spell | Shared cross-tradition light/darkness recognizer. Evidence lock: `Range 120'`, `Effect volume 30' diameter`, object-attachment movement, and save-gated blindness when targeted at eyes; the main conversion edge case is the reverse `Darkness` cancel/counter-cancel interaction. Existing SDM cousins support illumination and deception utility, so this remains a partial recognizer rather than a one-to-one blindness-control clone. | partial |
| Purify Food and Water | spell | Basic purification and supply-safety support. Existing SDM family variant: `Process Food`, which turns unsafe or inedible organic matter into workable supplies; `Toxin Render` is a narrower waste-processing cousin rather than a straight purification duplicate. | partial |
| Resist Cold | spell | Foundational elemental protection support. Basic evidence lock: `Range 0`, `Duration 6 turns`, `Effect all creatures within 30'`. Remaining ambiguity is conversion taxonomy around which cold hazards the protection covers. | partial |
| Ring of Holiness | item-effect | Cleric/druid power-augmentation wrapper tied to ring use; later conversion should express this as eligibility, blessing-layer access, or reduced burden around holy/nature powers rather than extra slot grant. Evidence lock: Companion ring worn by cleric/druid grants access to one bonus clerical/druidic spell per day (any level available to the wearer) and allows one daily casting without using a prepared slot; no effect on spell-like abilities or other power sources. | custom |
| Ring of Life Protection | item-effect | Anti-drain and life-threshold safeguard interface with finite depletion behavior; distinct from ordinary healing because it prevents or defers loss rather than repairing it after the fact. Evidence lock: Companion/RC ring with 5 charges; wearer can spend 1 charge to prevent one energy drain, Constitution loss, or level loss from any source (spell, ability, item); charges recover at 1 per day of rest — if all charges depleted, ring becomes inert until next recovery period. | custom |
| Ring of Remedies | item-effect | Bundled condition-repair and cleansing wrapper across multiple cure lanes; a strong reusable Chapter 05 model for one item exposing several tagged recovery functions instead of one-to-one spell copies. Evidence lock: Companion/RC ring with multiple 1-use daily cure functions (Cure Light Wounds 1/day, Blindness 1/day, Disease 1/day, Poison 1/day); at wearer's option, may combine two or more uses into one effect (e.g., curing both blindness and poison in a single touch). | custom |
| Ring of Survival | item-effect | Environmental hardening and hazard-resistance wrapper at item scale. | partial |
| Rod of Health | item-effect | Cleric-only healing rod that inherits the full staff-of-healing package without spending charges, but can affect any given creature only once per day regardless of which healing/remedy function is chosen. Useful Chapter 05 model for renewable recovery access with strict per-target cadence. | partial |
| Haste Speed Stacking Rules | procedure | Action-economy doctrine for haste and other speed layers: hit-roll bonuses scale by speed difference, AC improves by -2 per added speed layer, magic-use timings do not speed up, and only two different speed sources may stack. Strong Chapter 05/06 guide for acceleration handling without collapsing every speed effect into raw extra actions. Evidence lock: RC/Master doctrine — only TWO different speed-modifying effects can stack on one creature; hit-roll bonuses based on net speed difference (+1 per 10% faster movement), AC bonus scaled by layers (-2 per layer), spell casting times and initiative not improved by haste effects, magical crafting and research unaffected. | custom |
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
| Detect Magic | spell | Shared cleric and magic-user magic-sense recognizer that likely maps directly as a sensory or tagging power. | direct |
| Detect Evil | spell | Intent and hostility sensing spell rather than a clean moral-alignment scanner, so conversion needs care. | partial |
| Read Languages | spell | Straight information-access utility. Existing SDM family variant: `Anti-Babylon` (Eternal Return Key lane in the Powers Index), which broadens the classic language bridge into universal communication. Existing SDM family variant: `Anti-Babylon` (Eternal Return Key). | partial |
| Locate Object | spell | Object-search and direction lane shared across cleric and arcane traditions, useful for Chapter 06 retrieval and tracking tags. | direct |
| Truesight | spell | Premium anti-concealment recognizer covering invisibility, ethereal presence, and hidden forms. Likely needs a high-tier reveal tag package. | partial |
| Analyze | spell | RC-first analysis and inspection recognizer that broadens low-tier magical diagnostics. Verification pass (2026-03-24) checked staged Basic/Expert/Companion/Master/Immortals lanes and found no standalone pre-`RC` spell witness; keep as explicit `RC`-only provenance exception unless new staged evidence is added. | partial |
| Wizard Eye | spell | Remote-sight scouting sensor that pairs cleanly with clairvoyance-like reveal procedures. | partial |
| Lore | spell | Deep-history and object-reading lane useful for premium information-retrieval tags. | partial |
| Choose Best Option / Choose Option | item-effect | Master artifact-table decision aid that collapses uncertain branches into a single recommended choice. Better treated as a premium guidance interface than as a literal divination spell clone. | custom |
| Mapmaking | item-effect | Master artifact-table mapping interface that turns sensory reach into cartographic output. Strong Chapter 05 precedent for recon tools that create stable records rather than immediate combat information. | custom |

#### Knowledge and Mind / Sensing / Counter-Sense

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Clairvoyance | spell | Remote-sight lane. Existing SDM family variant: `Eyes of the Arrow` (Vastlands / The Viridian Practice), a projectile-bound remote sensor. | partial |
| Detect Danger | spell | Hazard-sense hybrid lane combining detection and danger reading. Existing SDM family variant: `Yellow Foresight`, which scans a wide area for sentients and general mood. | partial |
| Detect Invisible | spell | Arcane perception / anti-concealment lane. Existing SDM family variant: `Eyes of Akaula`, which sees invisible, hidden, departed, and dead things. | partial |
| ESP | spell | Thought-reading / awareness lane. Existing SDM family variant: `Yellow Foresight`, which reads sentient presence and general mood rather than exact thoughts. | partial |
| Feeblemind | spell | Severe cognition-destruction lane with class-filtered targeting. Evidence lock: arcane-capable victims save at penalty or collapse to functional Int 2 until dispel or cureall remediation. | custom |
| Find Traps | spell | Detection and hazard-reading spell. Expert evidence lock: reveals mechanical and magical traps within 30' via glow cue, but does not disclose trap type, disarm method, ambushes, or natural hazards. | partial |
| Infravision | spell | Sensory enhancement lane. Existing SDM family variant: `Rehoryan's Prophetic Song`, which can grant night vision as a durable biomantic adaptation instead of temporary spell vision. | partial |
| Locate | spell | Druidic animal / plant location lane. Evidence lock: self-range directional sense for one named normal or giant animal/plant type within 120', with explicit exclusions (fantastic creatures, plant monsters, intelligent targets) and no save on qualifying targets; ends after 6 turns. | partial |
| Magic Jar | spell | Identity-transfer and mind-storage lane. Existing SDM variant: `Magic Jar` (UVG2e Spells). | partial |
| Mind Barrier | spell | High-tier noospheric defense lane for hostile mental influence suppression. Keep as custom until mental-defense tags and intrusion categories are normalized. | custom |

#### Communication and Inquiry / Speech / Divination

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Speak with Animals | spell | Baseline non-human communication lane for ecology and scouting play. | partial |
| Speak with the Dead | spell | Corpse-interrogation lane with strong overlap to existing SDM husk-speaking precedents. Strong family comparison point for `Speak With Husk`. | partial |
| Speak with Monsters | spell | Broad creature-negotiation lane beyond animal and plant channels. Existing SDM family variant: `Anti-Babylon` (Eternal Return Key), which generalizes communication across entities rather than preserving narrow species lanes. | partial |
| Speak with Plants | spell | Plant-sentience communication lane that completes the speak-with progression. Existing SDM family variant: `Anti-Babylon` (Eternal Return Key), which already covers communication with plants, animals, minerals, and data stores. | partial |
| Commune | spell | Divine consultation and constrained-answer procedure for high-confidence guidance, likely better treated as bespoke oracle/contact doctrine than as ordinary divination throughput. | custom |
| Know Alignment | spell | Alignment/intention interrogation lane used for truthfulness and affiliation reads. | partial |
| Questioning | item-effect | Nonliving-object interrogation procedure useful for forensic and archive scenes. Nonliving-object interrogation procedure. | partial |
| Truth | item-effect | Living-mind questioning interface via enhanced mental-read procedure. Living-mind question procedure via an enhanced ESP-like readout. | partial |
| Truthfulness | item-effect | Cursed ring compulsion that forces honest speech rather than revealing truth by insight. Companion/RC evidence lock: the wearer must tell the truth whenever speaking, making this a behavioral constraint interface rather than a divination readout. | custom |
| Truthlessness | item-effect | Cursed ring compulsion that forces false speech rather than concealing thoughts. Companion/RC evidence lock: the wearer lies whenever speaking, making this a behavioral inversion interface rather than a detection or charm effect. | custom |

### family-4

- Current Header: `Transformation and Alteration`
- Proposed Tag Family: `transformation-alteration`
- Legacy Groups Merged: `Transformation and Fabrication / Biomancy / Creation`; `Transformation and Fabrication / Nature / Material Shaping`
- Downstream Notes: keep polymorph/material-form suites aligned for later tier and burden mapping.

#### Regrouped Legacy Tables

#### Transformation and Fabrication / Biomancy / Creation

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Polymorph Self | spell | Self-transformation recognizer with existing SDM cousins `Alter Self` and `Skinshift`, but Chapter 06 still needs explicit form-change limits. Expert evidence lock: self-only timed form change with new form HD capped at caster HD, preserving AC, hit points, hit rolls, and saves while granting physical but not special abilities and blocking spellcasting. | partial |
| Polymorph Other / Others | spell | Canonical mixed-name row: preserve `Polymorph Other` (heading form) and `Polymorph Others` (list/index form) as equivalent recognizer aliases. Chapter 06 now locks the mixed canonical key on the card heading rather than collapsing it to a shortened single-name surface. Expert evidence lock: target-facing permanent-until-dispelled transformation with spell save, HD-ratio limit (new form max 2x original HD), and behavior/tendency inheritance from the new form. | partial |
| Summon Animals | spell | Druidic ally-call effect with explicit HD budgeting; useful for summon scaling via SDM Level. Existing high-confidence family lane for druidic ally summoning. | partial |
| Animate Objects | spell | Object animation lane that likely maps only with explicit gear and object-agent handling. | partial |
| Animate Dead | spell | Corpse animation and minion-control doctrine carrier shared across cleric and arcane lanes. Existing SDM cousin `Animate Corpse` is relationship guidance, not a one-to-one replacement. Keep as custom because command scope, persistence, corpse-source handling, and Undeath-facing doctrine still need explicit conversion rules. | custom |
| Clone | spell | Identity-duplication / backup-body procedure, clearly beyond a simple direct powers mapping. Identity-duplication and backup-body procedure with delayed death-insurance implications, clearly beyond a simple one-power mapping and likely needing custom continuity/body-vault doctrine. | custom |
| Polymorph Any Object | spell | Extreme transmutation endpoint that extends polymorph doctrine beyond creature targets. Extreme transmutation endpoint that extends polymorph doctrine beyond creature targets and should remain a custom ceiling case for later Chapter 06 handling. Treat this as a relationship note to the broader polymorph suite, not as evidence for a simple direct map. | custom |
| Shapechange | spell | Supreme self-transformation package and ceiling case for form-shift taxonomy. Supreme self-transformation lane and ceiling case for self-directed form doctrine; compare `Skinshift` only as a distant family cousin. Keep as custom until Chapter 06 fixes duration, capability inheritance, and identity-stability policy. | custom |
| Reincarnation | spell | Death-reversal via body replacement that should stay distinct from raise-dead effects. Death-reversal via a new body rather than simple revival, so it should stay distinct from the `Raise Dead` line and carry replacement-form consequences in any later conversion. | custom |

#### Transformation and Fabrication / Nature / Material Shaping

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Anti-Animal Shell | spell | Creature-class exclusion boundary for fauna and beast-adjacent targets. Treat as custom boundary taxonomy doctrine (who is denied passage and what target classes qualify). Treat as boundary taxonomy doctrine (who is denied passage, what qualifies as target class) rather than ordinary protection math. | custom |
| Anti-Plant Shell | spell | Vegetation-class exclusion boundary. This is a custom barrier-interface case for passage denial against plant entities/effects, not a generic resistance shell. | custom |
| Clothform | spell | RC-only soft-material transmutation entry in the form-spell suite. Evidence lock: creates one-piece permanent non-dispellable cloth up to 30' x 30', with craft-shaped outcomes, seamless joining on later castings, and no forced overlap. Verification pass (2026-03-24) confirmed the current RC-only provenance exception. | partial |
| Contact Outer Plane | spell | Dangerous intelligence-contact procedure reaching across planar distance with explicit backlash risk; Immortals preserves the same family while removing the insanity risk for Immortal users. Better treated as bespoke high-tier inquiry doctrine than generic divination. | custom |
| Creeping Doom | spell | Custom high-tier swarm devastation effect: a 1,000-insect swarm occupying at least 20' x 20', expandable to 60' x 60', inflicting automatic scaling damage while the caster remains within 120' and ending on expiry, range break, or dispel. | custom |
| Dissolve | spell | Terrain-liquefaction lane with reversible battlefield-state conversion. Evidence lock: up to 3,000 sq ft of non-construction soil or rock becomes deep mud that slows movement to 10% and can trap targets, while reverse `Harden` permanently locks the same volume into rock with a save-gated escape clause. Keep as custom because the terrain rewrite and reversal logic are bespoke. | custom |
| Entangle | spell | RC-only arcane restraint and vegetation-control lane; current staged corpus has no standalone pre-RC spell witness. RC arcane restraint and vegetation-control lane; notable as a non-druid entanglement entry. Verification pass (2026-03-24) checked staged Basic/Expert/Companion/Master/Immortals lanes and found no standalone pre-`RC` spell witness; keep as explicit `RC`-only provenance exception unless new staged evidence is added. | partial |
| Faerie Fire | spell | Outlining / reveal lane. Evidence lock: non-damaging visibility outline at 60' that can mark detected creatures/objects and grants +2 attack bonus against marked targets; footprint scales by caster level in man-sized equivalents and ends cleanly on duration expiry. | partial |
| Growth of Animal | spell | Creature enhancement / scaling lane. Expert evidence lock: doubles one normal/giant animal's size, strength, damage, and carrying capacity for 12 turns while leaving behavior, AC, and hit points unchanged; excludes intelligent animal races and fantastic creatures. | partial |
| Growth of Plants | spell | Terrain / vegetation alteration lane. Existing SDM family variant: `Green Haven`, which coerces vegetation into shelter and thorn barriers; it is a narrower plant-shaping cousin rather than a pure growth accelerator. | partial |
| Heat Metal | spell | Custom sustained anti-armor effect: level-scaled metal heating runs seven rounds with escalating then tapering no-save damage, optional forced dropping, ignition at peak heat, concentration disruption, and weaker side effects on magical targets. | custom |
| Hold Animal | spell | Beast-specific restraint lane. Evidence lock: affects normal/giant animals only (excluding fantastic or higher-intelligence targets), applies HD-budget targeting by caster level, and requires spell saves to resist long-duration paralysis; summoned/conjured/controlled animals remain valid targets. | partial |
| Ironform | spell | RC-only form-spell lane for permanent non-dispellable iron creation, up to 500 sq ft at 2" thickness, with recast refinement and fortification durability guidance. Verification pass (2026-03-24) confirmed the current RC-only provenance exception. | partial |
| Metal to Wood | spell | Custom permanent material transformation that converts metal to dead wood by level-scaled weight, with strong resistance for magic items and explicit gear fallout such as dropped armor and degraded weapons. | custom |
| Produce Fire | spell | Portable flame / attack lane. Evidence lock: conjures non-self-harming torch-grade flame in hand with duration scaling, supports ignition utility and short-range throw/drop delivery, and allows on/off toggling by concentration while active. | partial |
| Protection from Lightning | spell | Touch-applied lightning protection grants a level-scaled d6 cancellation pool that persists across electrical attacks until exhausted, then normal overflow handling resumes. | partial |
| Steelform | spell | RC-only advanced form-spell lane that inherits ironform procedure while upgrading the output to weapon-grade steel with stronger structural durability. Verification pass (2026-03-24) confirmed the current RC-only provenance exception. | partial |
| Sticks to Snakes | spell | Wood-to-serpent conversion and battlefield-weaponization effect; keep as custom until obedience scope, persistence, and material-to-creature rules are normalized. | custom |
| Stone to Flesh | spell | Petrification-reversal lane. Expert evidence lock: restores petrified targets or converts large stone volume to flesh; reverse form (`Flesh to Stone`) is a save-gated petrification effect that includes carried gear. | partial |
| Stoneform | spell | RC-only form-spell lane for 1,000 cubic feet of permanent non-dispellable single-piece stone, with casting-time scaling by complexity and recast refinement or seam-free expansion rules. Verification pass (2026-03-24) confirmed the current RC-only provenance exception. | partial |
| Telekinesis | spell | Classic force-manipulation recognizer; compare `Objective Telekinesis` as a likely SDM cousin. | partial |
| Turn Wood | spell | Custom material-interaction control effect that repels and redirects wooden objects with explicit category targeting and displacement behavior. | custom |
| Warp Wood | spell | Wooden-structure deformation lane. Evidence lock: permanently warps wooden weapons only by arrow-equivalent capacity budget, with save opportunities for wielded magical targets and plus-based resist chances; excludes non-weapon wooden objects. | partial |
| Woodform | spell | RC-only form-spell lane for up to 1,000 cubic feet of permanent non-dispellable wood, with single-piece constraints, recast refinement, and seam-free joining for large constructions. Verification pass (2026-03-24) confirmed the current RC-only provenance exception. | partial |

#### Terrain and Environment / Weather / Infrastructure

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Lower Water | spell | Custom hydrology-control procedure that halves water depth across up to 10,000 square feet for 10 turns, can strand vessels, and ends with a hazardous refill surge. | custom |
| Control Temperature 10' Radius | spell | Canonical Chapter 06 display form is `Control Temperature 10' Radius`; retain lowercase `Control Temperature 10' radius` as a source-era alias recognizer. Evidence lock: self-centered moving 20' diameter microclimate, immediate up/down shift up to 50 F, optional round-by-round retuning by concentration, and fixed end-state at duration expiry. | partial |
| Control Winds | spell | Directional weather-force control with movement, hazard, and projectile-pressure implications. Keep as custom environment-control doctrine pending full weather-suite normalization. | custom |
| Weather Control | spell | High-tier weather command lane crossing druidic and arcane traditions. Keep as the custom suite anchor for chapter-scale climate control, hazard shaping, and travel pressure. | custom |
| Earthquake | spell | Custom high-tier terrain rewrite affecting an outdoor area up to 60' square at C17 plus 5' per level above, with collapse, rockslide, and crack-engulf risks resolved across the zone for 1 turn. | custom |
| Move Earth | spell | Massive terrain repositioning and landscape engineering recognizer. Existing SDM family variant: `Dryland Sculpture`, which is a smaller-scale but high-confidence terrain-forming and infrastructure-shaping cousin rather than a direct mass-displacement duplicate. | partial |
| Hallucinatory Terrain | spell | Large-scale terrain-falsification illusion that masks real features without physically changing them; it persists until dispelled or tested by touch or intelligent scrutiny. | partial |
| Obscure | spell | Concealment / weather-obscuration lane. Existing SDM family variant: `Yellow Cloud`, which creates an opaque dust veil and can overcharge into an immobile wall of obscuring material. Primary placement belongs with terrain/environment because the effect works by materially altering battlefield atmosphere rather than pure false imagery. | partial |
| Predict Weather | spell | Custom environment-intelligence procedure for routing and hazard preparation through forecast and horizon reading. | custom |
| Summon Weather | spell | Custom macro-environment override for calling weather, pending Chapter 06 doctrine on intensity, duration, and collateral effects. | custom |
| Wall of Stone | spell | Custom rapid-structure and barrier creation effect pending explicit Chapter 06 rules for geometry, breach handling, and noncombat construction. | custom |
| Wall of Iron | spell | Durable material barrier and infrastructure-fabrication lane for persistent iron mass. Keep as custom until Chapter 06 defines creation-versus-obstruction handling and breach rules. | custom |

### family-5

- Current Header: `Mind and Emotion`
- Proposed Tag Family: `mind-emotion`
- Legacy Groups Merged: `Influence and Control / Restraint / Compulsion`; `Influence and Control / Charm / Binding`
- Downstream Notes: maintain clean separation between compulsion/charm doctrine and concealment/illusion doctrine.

#### Regrouped Legacy Tables

#### Influence and Control / Restraint / Compulsion

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Sleep | spell | Core low-tier disable recognizer and likely a direct control template. | direct |
| Hold Person | spell | Straight restraint/paralysis recognizer already central to many fantasy power taxonomies. Existing SDM variant: `Hlod Person` (Vastlands / Apocrypha of the O.S.). | direct |
| Web | spell | Area restraint and denial recognizer that likely maps directly. | direct |
| Confusion | spell | Mind-state disruption lane; keep as partial until Chapter 06 settles the exact status and control phrasing. | partial |
| Quest | spell | Compulsion and obligation doctrine that likely belongs in vow-binding rather than flat status control, with explicit fulfillment and breach consequences. Evidence lock: Companion/RC spell, Range 30', Duration until completed or removed; compels one save-able target to perform one specific behavior/quest or risk escalating magical penalties (1 point damage per week escalating to -1 all rolls, then 1d6 con loss per week); rebound damage to caster if quest is impossible or directly fatal; task can be specific (retrieve item) or conditional (lay low for a season); removable only by Cureall/Wish or Remove Geas. | custom |
| Dance | spell | Forced-movement / compulsion lane. Evidence lock: touch-delivered no-save incapacitation forcing dance behavior, with explicit inability to attack/cast/flee plus save/AC penalties and tiered duration scaling by caster level band. | partial |
| Hold Monster | spell | Higher-tier restraint extension of the hold-family control recognizer. | partial |
| Mass Charm | spell | Group-scale social compulsion package beyond single-target charm doctrine. Group compulsion / social-control lane. Reverse form `Remove Charm` is now folded into this parent row instead of tracked as a standalone Chapter 06 import row. Evidence lock: Master spell, Range 60', Duration varies by caster level (1 week +1 day per level above 11); affects multiple humanoid targets in view (caster level determines max HD affected). Targets gain saves; successful charm creates loyalty to caster, blocks attacks on caster, and obeys bold commands. Dangerous commands grant new saves. Reverse (Remove Charm) clears all charm in a 20' x 20' x 20' volume and blocks charm-from-objects for 1 turn. RC still indexes `Remove Charm` as a standalone MU 8 entry, but Chapter 06 now preserves it as parent-row reverse doctrine rather than a separate card. | custom |
| Power Word Stun | spell | Word-of-power incapacitation lane bridging blind/kill style hard control effects. Word-of-power incapacitation lane between the blind and kill variants. Evidence lock: Master artifact context, Range 120', Duration 1d4 rounds; no save; renders target paralyzed/stunned. HP threshold based on caster level (e.g., C17 affects up to 60 HD, +5 per level). Affected creatures are helpless, cannot act, but remain aware. Dispel Magic can end early. Target wakes if struck. | custom |
| Open Mind | item-effect | Master artifact-table mental breach interface with an extreme save penalty at touch range. Better treated as an item-borne domination/bypass tool than a standalone spell row. Evidence lock: Master artifact power, Range touch, no save but target can resist with magic resistance; target loses will save against next spell/mental effect within 1 round, acts as if under charm effect for domination purposes, no protection spells block the effect. Severe mental intrusion tool; use once per day max. | custom |
| Control Animals | item-effect | Master artifact-table creature-command interface with HD budgeting and duration already encoded into the artifact power cost. Distinct from the potion wrapper because this is a reusable artifact payload. Evidence lock: Master artifact power, Range 60', Duration 1d6 turns; controls up to caster-level-equivalent HD of normal/giant animals (exclude intelligent animals and fantastic creatures); animals obey bold commands and will fight; no save if delivered via artifact interface. Controlled animals gain saving throws vs spells/magical effects as normal. | custom |
| Control Plants | item-effect | Master artifact-table plant-command interface that functions as a reusable artifact payload rather than a one-use wrapper. | custom |
| Control Giants | item-effect | Giant-type command interface carried by artifact power tables; a clean Master-native control surface rather than a standard spell import. Evidence lock: Master artifact power, Range 60', Duration 1 turn per use; compels one target giant type (exclude storm/cloud giants, artifact-grade giants) with a save; commanded giant obeys one sequence of orders for the duration, resists self-harmful commands (rolls save again), and regains independence on spell end. Artifact interface no-save variant treats as forced service for duration only. | custom |
| Control Dragons | item-effect | Dragon-type command interface from the Master artifact table. Strong Chapter 05 case for command-by-category bundles that stay item-side rather than becoming generic spell exports. Evidence lock: Master artifact power, Range 90', Duration 1 turn; compels one dragon type (exclude platinum, artifact-grade, or ancient wyrms) with a save at -2; commanded dragon follows orders but plots escape, resists obviously lethal commands (new save), obeys major movement/attack orders. Artifact interface: no save on first use, target regards artifact bearer as ally but regains will on spell end. One-use-per-day model standard. | custom |
| Control Humans | item-effect | Human-command interface staged in the Master artifact tables, useful as a reusable domination surface distinct from the Expert ring and potion shells. Evidence lock: Master artifact power, Range 60', Duration 1d6 turns per use; compels one humanoid (human, demihuman, humanoid monster) with a save; affected target follows orders, will not attack allies of artifact user, resists obviously fatal orders (new save). Artifact source versions may treat as no-save domination limited to 1 use per 24 hours. | custom |

#### Influence and Control / Charm / Binding

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Charm Monster | spell | Broad creature-charm lane. Existing SDM family variant: `Hero's Goldenmouth`, but only as a broad persuasive-capture cousin; the current corpus does not yet provide a clean nonhuman domination equivalent. | partial |
| Charm Person | spell | Core low-tier social control spell. Existing SDM family variant: `Hero's Goldenmouth` (Our Golden Age), which reframes charm as persuasive social capture rather than hard domination. | partial |
| Charm Person Spell Resolution | procedure | Target-classification and repeat-save cadence doctrine for `Charm Person`: constrains valid victims to humanoid societies, sets intelligence-based intervals for renewed saves, and clarifies that dangerous one-sided orders trigger new resistance checks. Strong Chapter 05/06 control-procedure support beyond the base spell text. | partial |
| Charm Plant | spell | Plant-specific command and control effect; keep as custom until plant agency and obedience boundaries are normalized against broader influence doctrine. Evidence lock: Companion/Master druid spell, Range 30', Duration 1 day +1 day per caster level; affects one plant/plant creature (save allowed); charmed plant accepts caster as friend and ally, provides shelter/hiding/nourishment if capable, will not attack caster or party. Dangerous orders grant new save. Explicitly does not affect plant golems or magical plant constructs. | custom |
| Holy Word | spell | High-tier word of power / banishment lane. Existing SDM family variant: `Sense Allegiance`, which provides the clearest current ethical-targeting plus stun/interdiction cousin, though it is much narrower than the full clerical word-of-power package. | partial |
| Remove Fear | spell | Fear-cleansing and morale-stabilization lane now grouped under `Mind and Emotion`. Basic evidence lock: `Range Touch`, `Duration 2 turns`, single living target support, with reverse-form behavior preserved as a separate alias edge case. | partial |
| Snake Charm | spell | Creature-specific charm/control spell. Expert evidence lock: charms up to 1 HD of snakes per caster level with no save, suppresses attacks unless provoked, and uses shorter duration against already-attacking snakes than in passive use. | partial |

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
| Invisibility 10' Radius | spell | Canonical Chapter 06 display form is `Invisibility 10' Radius`; retain lowercase `Invisibility 10' radius` as a source alias recognizer. `Yellow Cloud` is the clearest existing Luka-style battlefield-scale concealment cousin. | partial |
| Mass Invisibility | spell | High-tier crowd concealment lane above the 10-foot-radius variant. `Yellow Cloud` remains the strongest existing crowd-obscuration precedent in the current SDM corpus. | partial |
| Ventriloquism | spell | Sound-projection and false-source deception utility. Evidence lock: `Range 60'`, `Duration 2 turns`, one item or location as the projected voice source, and no save gate; the effect's value is positional misattribution rather than control or damage. | partial |
| Mirror Image | spell | Defensive misdirection via decoy duplicates in direct-threat contexts. Defensive illusion / misdirection lane. Expert evidence lock: creates 1-4 adjacent duplicates that track caster movement and speech; each successful single-target hit removes one image instead of striking the caster, while area effects clear all images and still affect the caster. | partial |
| Phantasmal Force | spell | Core constructed-illusion recognizer for scene-level false stimuli. Core illusion-construction spell. Expert evidence lock: concentration-sustained illusion over a 20' cube that can simulate terrain, monsters, or attacks; disbelief/save behavior and non-real damage handling (unconscious/paralyzed stand-ins with short wear-off) make this a bespoke adjudication procedure rather than a direct effect clone. | custom |
| Projected Image | spell | Remote image/proxy presence lane for deception and diversion. Expert evidence lock: creates a non-corporeal visual double at range that can origin-point apparent spellcasting while the real caster still needs target visibility; the image ignores spells and missiles and collapses on contact or melee strike. | partial |
| Massmorph | spell | Group disguise effect for coordinated infiltration. Expert evidence lock: disguises up to 100 willing man-sized targets as trees over a large area and only drops on a given subject when the spell ends, is dispelled, or that subject leaves the area. | partial |
| Statue | spell | Self-concealment and false-object transformation lane with modal defense-state complexity. Evidence lock: the caster can toggle once per round into immobile stone form with AC improvement, broad hazard immunities, breathing suspension, and initiative benefit against incoming elemental attacks, while magical attacks still apply and the duration scales at long form. | custom |

### family-7

- Current Header: `Traversal and Mobility`
- Proposed Tag Family: `traversal-mobility`
- Legacy Groups Merged: `Mobility and Access / Movement / Traversal`
- Downstream Notes: keep route and movement tools separate from boundary-seal and planar-gate doctrine.

#### Regrouped Legacy Tables

#### Mobility and Access / Movement / Traversal

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Levitate | spell | Vertical movement recognizer that likely maps directly. | direct |
| Floating Disc | spell | Canonical spell name can stay unchanged while pointing to the existing stylized `Floating Disc` UVG variant in the Powers Index. Existing SDM variant: `Floating Disc` (UVG2e Spells). | direct |
| Fly | spell | Core aerial mobility recognizer needed for personal-scale movement powers and item references. Core aerial movement recognizer. | direct |
| Find the Path | spell | Navigation / routing procedure rather than pure movement; useful for Chapter 06 pathfinding and noosphere-guidance tags. Navigation and route-certainty lane. | partial |
| Knock | spell | Canonical lock-opening entry should remain `Knock`; existing SDM variant: `Knock / Lock` (UVG2e spell lane in the Powers Index). Existing SDM variant: `Knock / Lock` (UVG2e Spells). | partial |
| Teleport | spell | Major transit power; likely direct at concept level but will need SDM range / mishap doctrine decisions. Major transit spell; compare `Linked Portals` as a family cousin. | partial |
| Travel | spell | Composite mobility package combining flight, gaseous movement, and adjacent-plane transfer. Likely needs Chapter 06 decomposition or a premium bundled mobility power with environment and survival riders rather than a flat one-to-one export. | custom |
| Dimension Door | spell | Short-range relocation entry that bridges tactical repositioning and teleport doctrine. | partial |
| Pass-Wall / Passwall | spell | Canonical mixed-name row: preserve `Pass-Wall` (pre-RC BECMI) and `Passwall` (RC) as equivalent recognizer aliases. Chapter 06 now locks canonical `Pass-Wall` on the card heading and promotes `_Veil-walk_` to the invocation line as the FTLS heritage-flavored alias. Existing SDM family variant: `Linked Portals`, used here as a controlled passage-through-barriers cousin rather than a literal wall-phasing duplicate. | partial |
| Magic Door | spell | Portal and egress manipulation lane. Existing SDM family variant: `Linked Portals`, which is the clearest current astral-bridge precedent for controlled passage and reversible entry. Portal and egress manipulation lane with reversible entry-control logic. | partial |
| Pass Plant | spell | Plant transit lane. Existing SDM family variant: `Linked Portals`, used here as a traversal cousin rather than a literal vegetation-only doorway. Primary placement stays with mobility because the row's job is passage, not plant reshaping. | partial |
| Plant Door | spell | Vegetation access / doorway lane. Existing SDM family variant: `Linked Portals`, which is the closest current controlled-passage precedent even though the classical wrapper is plant-specific. | partial |
| Transport Through Plants | spell | Plant-network transit lane. Existing SDM family variant: `Linked Portals`, which already expresses location-bridging as a distinct traversal procedure. | partial |
| Water Breathing | spell | Druidic aquatic adaptation and access lane. Chapter 06 now locks canonical `Water Breathing` on the card heading and promotes `_Swamp's Gift_` to the invocation line as the heritage-flavored alias. Treat as custom environment-interface doctrine around breath medium, pressure, and exposure assumptions rather than a simple movement-speed modifier. | custom |
| Gate | spell | Planar aperture and translocation endpoint for high-tier traversal and summoning crossover, likely a bespoke apex mobility/interface effect rather than a generic teleport derivative. | custom |
| Teleport any Object | spell | Object-only transit lane that should stay distinct from creature teleport effects. Object-only transit lane adjacent to `Teleport`. | partial |

### family-8

- Current Header: `Dimensional, Planar, and Exotic Access`
- Proposed Tag Family: `dimensional-planar-exotic-access`
- Legacy Groups Merged: `Mobility and Access / Dimensional and Sanctuary Transit`
- Downstream Notes: prioritize sanctuary return, planar pathing, and exotic-access edge rules.

#### Regrouped Legacy Tables

#### Mobility and Access / Dimensional and Sanctuary Transit

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Word of Recall | spell | Return-to-sanctuary extraction spell with strong campaign-loop implications. Chapter 06 now places this under `Dimensional, Planar, and Exotic Access`, so Phase 2 tracks it as dimensional/sanctuary transit instead of generic traversal. Return-to-sanctuary transit lane. | partial |
| Plane Travel | item-effect | Master artifact-table planar-shift interface for self and gear. Strong Chapter 05 precedent for item-borne transplanar access that stays distinct from full gate-style aperture creation. | custom |

### family-9

- Current Header: `Duration and Binding Rituals`
- Proposed Tag Family: `duration-binding-rituals`
- Legacy Groups Merged: `Defense and Boundaries / Duration and Binding Rituals`; ritual-binding rows from `Defense and Boundaries / Seals / Passage Control`
- Downstream Notes: codify persistence, commitment, and release conditions for long-duration bindings.

#### Regrouped Legacy Tables

#### Defense and Boundaries / Wards / Barriers

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Protection from Evil | spell | Hybrid defensive buff plus contact ward against enchanted or summoned beings; not just a generic Defense bonus. Basic cleric defensive barrier spell. Arcane defensive barrier; shared with cleric lane. | partial |
| Shield | spell | Personal defense shell. Chapter 06 now prefers `Shield Ward` as the canonical adaptation name for this spell while preserving classic `Shield` as the source recognizer and lookup alias. `Entropic Shield` remains a sibling FTLS variant rather than the canonical import surface. | direct |
| Resist Fire | spell | Fire resistance and mitigation recognizer that likely maps cleanly to tagged elemental protection language. | direct |
| Barrier | spell | High-tier warding and boundary-control lane for Chapter 06 barrier taxonomy above simple protection buffs. Evidence lock: Range 60', Duration 12 turns; area up to 30' diameter × 30' high of whirling hammers; 7d10 damage no save to any entity crossing the barrier; reverse (Remove Barrier) additionally destroys wall of ice/fire/clothform/woodform/wall of stone but explicitly cannot affect wall of iron/stoneform/ironform/steelform. | custom |
| Dispel Evil | spell | Counterforce / banishment family member that overlaps with anti-hostile or anti-outsider doctrine rather than plain damage. Counterforce / banishment lane. | partial |
| Force Field | spell | Premium structural barrier lane and Chapter 05 interface anchor for layered ward persistence, directional blocking, and throughput exceptions. Evidence lock: Range 120', Duration 6 turns; immovable pure-force barrier; shape limited to sphere (max 20' radius) or flat surfaces/combinations up to 5,000 sq ft; only `Disintegrate` or `Wish` can destroy it — `Dispel Magic` explicitly cannot; `Teleport`/`Dimension Door` can bypass; enclosed creatures are magically preserved (no starvation or suffocation); plane-specific — does not persist across planar transitions. | custom |
| Prismatic Wall | spell | Bespoke high-tier layered-spectrum barrier; the current SDM corpus lacks a close analogue, so this should stay custom. Evidence note (partial — staged text not recovered): Master artifact chart gives `R 60', DR 6 turns, EF 10' radius sphere or 500 sq ft flat`; no standalone spell description was staged in Master or RC staging files; treat as evidence-limited until a full text block is recovered from source. | custom |

#### Ethereal Counter Magitech / Dispels / Suppression / Jamming

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Anti-Magic Shell | spell | Major counter-magic boundary recognizer spanning arcane and artifact-adjacent ECM doctrine. Expert evidence lock: Range 0 (caster only), Duration 12 turns; near-body invisible barrier (within roughly 1 inch of caster) stops all spells and spell effects in both directions including the caster's own magic; only `Wish` bypasses it; `Dispel Magic` is explicitly ineffective; caster can dismiss the barrier at will at any time. | custom |
| Anti-Magic Ray | item-effect | Master artifact-table focused suppression beam with full 100% anti-magic value for its duration. Strong ECM interface case for directional cancellation rather than passive warding. Evidence lock: Master artifact power, Range 120', Duration 1d6 rounds; caster directs a cancellation beam at one target or 20' x 20' area; all magic within the area is suppressed (creatures are unable to cast, items are non-magical, ongoing spells are dormant). No save; area moves with beam if target is chosen. Dispel Magic cannot counter it. | custom |
| Protection from Magic | item-effect | Protection-scroll ECM ward that creates a moving 10' circle around the reader and blocks spells or spell effects from crossing the boundary. Expert evidence lock: duration 1-4 turns, item-origin effects are also blocked, and only `Wish` breaks it early. Strong Chapter 05 boundary-interface model for denial fields rather than generic resistance. | custom |
| Dispel Magic | spell | Major counterforce recognizer and a core canonical anchor for ECM scope. Expert evidence lock: affects spell effects in a 20' cube, auto-dispels equal-or-lower caster-level magic, and fails at 5% per higher caster level; it does not affect ordinary magic items. Keep as a bespoke ECM conversion anchor rather than a generic resistance buff. | custom |
| Silence 15' Radius | spell | Anti-speech and anti-spellcasting field that functions as a partial noospheric-jamming and casting-denial cousin rather than a full anti-magic shell. Expert evidence lock: the 30' sphere suppresses speech and spellcasting inside the area, can be fixed in place or attached to a failed-save target, and still allows hearing sounds from outside it. | partial |
| Spell Catching | item-effect | Counter-capture wrapper for hostile spell energy routed into storage media; a core ECM reference case and strong bridge for Power Level-banded hostile capture. Catches one incoming spell into scroll capacity bands; strong Chapter 05/06 bridge case for hostile-power capture into storage media using explicit Power Level capacity rather than slot logic. Evidence lock: Companion/RC scroll or artifact, trigger on one incoming spell attack; user rolls save vs Spells, success captures the spell into scroll storage (usable once within 24 hours), failure means spell resolves normally. Captured spell can be released at will, transferred to other scrolls, or stored indefinitely if not used. | custom |
| Ring of Spell Eating | item-effect | Ring-native spell absorption and denial interface; distinct from simple resistance tags and a direct ECM item case for consuming or canceling incoming powers rather than reflecting them. Hostile spell-defense and absorption interface distinct from plain spell turning; a core Chapter 05 ECM item case for canceling or consuming incoming powers instead of merely reflecting them. Evidence lock: Companion/RC ring, 1/day activation; next incoming spell targeting the wearer is absorbed (damage spells heal the wearer by the absorbed damage, other spells are canceled), on tenth use in a day the ring becomes dormant for 24 hours. Cannot absorb wish or similar apex effects. | custom |
| Ring of Spell Turning | item-effect | Reflects 2-12 incoming spell attacks back at their casters, redirecting rather than consuming the payload. Core ECM item model with finite reflection capacity alongside `Ring of Spell Eating`. Expert evidence lock: only true spells are reflected, not monster spell-like powers or item-borne spell-like effects. | custom |
| Staff of Dispelling | item-effect | Charged dispel interface with special handling across temporary and permanent magic carriers; likely a key Chapter 05 example for `Level`-based counterforce with carrier-specific exceptions. Touch-based targeted dispel interface with special handling for potions, scrolls, and permanent items; likely a key Chapter 05 example for using `Level` as counterforce strength while preserving carrier-specific edge cases. | custom |

#### Defense and Boundaries / Seals / Passage Control

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Hold Portal | spell | Low-tier closure / access-control spell. Existing SDM family variant: `Knock / Lock`, whose overcharge explicitly flings a portal open or seals, welds, or fuses it shut. | partial |
| Maze | spell | Custom exile and battlefield-removal boundary effect with spatial-separation logic and explicit return-condition doctrine. | custom |
| Permanence | spell | Custom persistence-lock doctrine for long-term enchantment anchoring; Chapter 06 still needs explicit rules for bindable scope, maintenance risks, and safe removal. | custom |
| Wizard Lock | spell | Arcane closure / keyed barrier lane. Existing SDM family variant: `Knock / Lock`, which already handles opening, locking, and forcibly sealing portals, including resistance from magical locks. | partial |

#### Defense and Boundaries / Duration and Binding Rituals

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Geas | spell | High-tier compulsion and binding ritual lane now grouped under `Duration and Binding Rituals`. Expert evidence lock: Range 30', Duration until completed or removed; compels one specific perform-or-avoid task with a save vs. Spells gate; rebounds on caster if the task is impossible or directly fatal to the target; DM-assigned cumulative penalties if the target disobeys, escalating until completion or death; not removable by `Dispel Magic` or `Remove Curse`; reverse (Remove Geas) fails at 5% per caster level difference when the removing caster is lower level. | custom |

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
| Summon Object | spell | Object-call retrieval effect that bridges summoning and transport procedure language. Remote retrieval and object-call lane. | partial |
| Create Normal Animals | spell | Low-tier creature-fabrication rung distinct from summoning and useful for companion or ecology pressure. Existing SDM seed power `Vegetable of Birth` is the clearest gestation cousin. Use this as the creation bundle's low-tier anchor with explicit ecology, load, and encounter-pressure constraints. | custom |
| Create Normal Monsters | spell | Mid-tier creature-fabrication lane below magical and any-monster endpoints. In the creation bundle, this is the first monster-grade rung after `Create Normal Animals`, with bounded taxonomy and encounter-pressure outputs. | custom |
| Create Magical Monsters | spell | High-tier magical-creature fabrication lane above normal monsters and below `Create Any Monster`. Treat it as the middle-to-upper creation-bundle rung, with explicit complexity, special-ability budgeting, and control-burden escalation. | custom |
| Create Any Monster | spell | Apex creature-fabrication endpoint with the broadest taxonomy scope. Capstone of the creation bundle above normal and magical monster tiers, requiring strict doctrine for command reliability, persistence failure modes, and campaign-scale impact. | custom |

#### Interfaces and Scrollcraft / Spell Storage / Tooling

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Magic-User Starting Spell Choice | procedure | Spellbook seeding and restricted-availability doctrine for beginning arcane casters: `Read Magic` is mandatory as the first gift, second-spell choice should remain genuinely useful, and the referee may control campaign spell access by withholding spells from teachers, scrolls, and found books. Strong Chapter 05/06 provenance note for early spell archive and curriculum curation. | custom |
| Read Magic | spell | Decoding gate for scrolls and arcane writing; this family should group deciphering, storage, and transfer interfaces. Core scroll / spellbook deciphering gate. | partial |
| Spell Storing | item-effect | Source spell-retention wrapper. Keep the canonical key, but convert it as a trait/item power archive with Power Level capacity and later discharge rules rather than as prepared-slot retention. Ring-based spell payload storage and later discharge; should convert it as an item-side power archive with Power Level capacity and release rules, not as prepared-slot retention. Expert evidence lock: found rings carry a fixed 1-6-spell payload, refilling requires direct casting into the ring, stored effects resolve at the minimum caster level needed, and the ring does not absorb attacks cast at the wearer. | custom |
| Spell Scrolls / Spells | item-effect | Generic casting-from-scroll wrapper that must stay visible for Chapter 05/06 bridges. Generic spell-scroll wrapper covering class restrictions, multi-spell payloads, and copy-versus-cast handling. | partial |
| Protection / Protection Scrolls | item-effect | Wrapper row for protection-scroll family where the payload references another spell recognizer. Generic moving circle-of-protection wrapper shared by the specific protection scroll variants. Basic evidence lock: usable by any class, creates a moving 10' circle centered on reader, blocks listed creature entry, does not block their spell or missile attacks, and breaks if protected side initiates hand-to-hand attack. | partial |
| Cursed / Cursed Scroll | item-effect | Failure-state wrapper that applies negative spell-like outcomes; useful as a generalized cursed-interface pattern. Immediate curse-on-sight scroll wrapper; niche but persistent enough to deserve a canonical lookup row. Basic evidence lock: curse triggers on seeing writing; reading aloud is not required. | partial |
| Maps to Treasures / Treasure Maps | item-effect | Non-spell utility wrapper, but still an indexed magical information interface in treasure text. Treasure-location wrapper with normal, magical, combined, and special treasure lanes; niche but reusable lookup surface. Basic evidence lock: map prepared in advance by referee, may be partial/riddle form, and may require `Read Languages` for use. | custom |
| Quill of Copying | item-effect | Procedure for spell/text duplication with strong archive tooling implications. Spell transcription and copy-risk procedure; strong Chapter 05/06 spell-handling bridge. | custom |
| Slate of Identification | item-effect | Item-mediated identification interface that bridges detection and item-use doctrine. Item-identification procedure surface distinct from `Read Magic` and `Mages` scroll behavior. | partial |
| Communication | item-effect | Paired remote-writing interface that functions as a distance-safe text channel on the same plane. Paired remote-writing scroll interface across any distance on the same plane. | partial |
| Delay | item-effect | Delayed-release wrapper for a stored spell payload, useful for trigger-based spell handling; Chapter 05 should treat this as deferred activation doctrine rather than slot hold-state. Scroll-carried delayed-release wrapper for one stored spell payload; Chapter 05 should model this as a trigger/interface note with deferred activation timing rather than as held slot-state. | custom |
| Mages | item-effect | Scroll-based nearby magic-effect identification that complements `Read Magic` rather than replacing it. | partial |
| Portals | item-effect | Scroll-native pass-wall interface and compact access-control wrapper. Scroll-native reusable `Pass-Wall / Passwall` interface. | partial |
| Ring of Memory | item-effect | Immediate one-spell recall interface for spellcasters only: the wearer must choose within 1 turn of casting, then the spell is instantly relearned, with the ring restoring only one spell per day. Strong Chapter 05 model for short-horizon recovery/retention rather than passive memory bonuses or broad archive storage. | custom |

#### Interfaces and Scrollcraft / Treasure / Utility Devices

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Creation | item-effect | Scroll-generated temporary mundane item fabrication: one non-living item up to 5' x 10' x 1' and 5,000 cn, never magical or alive, expiring on command or after 24 hours. Strong Chapter 05 model for temporary fabricated gear with hard material and duration limits. | custom |
| Equipment | item-effect | Scroll that manifests from a fixed list of mundane adventuring gear: six entries inscribed, any three manifested per day within 10', each restored only after the created item vanishes. Good Chapter 05 precedent for menu-based utility fabrication instead of open-ended item creation. | custom |
| Mapping | item-effect | Scroll-generated bounded survey interface: once per day it records a chosen fully contained area within 100', up to 10,000 square feet, with limited secret-door detection. Strong Chapter 05 precedent for reconnaissance tools that create records rather than immediate tactical effects. | custom |
| Protection from Elementals | item-effect | Circle protection scroll keyed specifically to elementals. Expert evidence lock: creates a moving 10' radius circle around the reader, blocks elemental attacks unless the protected side strikes first in hand-to-hand combat, and lasts 2 turns. | partial |
| Protection from Evil 10' Radius | spell | Canonical grouped display form for the group-radius protection lane, with lowercase `10' radius` retained only as a source alias. Keep as a partial family variant of `Protection from Evil`. | partial |
| Protection from Lycanthropes | item-effect | Circle protection scroll keyed to lycanthrope types by quantity band. | partial |
| Protection from Normal Missiles | spell | Projectile-denial ward for nonmagical missile vectors. Chapter 05 should treat this as an interface-grade filtering ward with explicit projectile-category exceptions rather than a generic defense bonus. | custom |
| Protection from Undead | item-effect | Circle protection scroll keyed to undead by type and quantity. | partial |
| Repetition | item-effect | Scroll wrapper that replays the same-level spell effect after one turn; note for future conversion that this should become an SDM trigger/interface note, not a slot-replay rule. Scroll wrapper that replays the same-level spell effect after one turn. | custom |
| Holy Water | item-effect | Consumable anti-undead vial interface. Basic evidence lock: prepared by clerics, usable by any class, must remain in special vials to stay holy, inflicts 1-8 damage to undead on a successful hit, and is delivered by thrown-missile or hand-to-hand strike that breaks the vial. | partial |
| Ring of Elemental Adaptation | item-effect | Plane-keyed elemental survival ring in seven variants that lets the wearer breathe and see normally within the matching Elemental Plane, making it a clean support interface for elemental travel without providing the travel itself. Plane-keyed elemental survival ring available in seven variants (single element, paired Air/Water or Earth/Fire, or all-elements) that lets the wearer breathe and see normally within the matching Elemental Plane. Strong supporting interface for talisman/staff travel bundles, but narrower than those because it does not itself provide transit or command. | partial |
| Rod of the Wyrm | item-effect | Alignment-keyed draconic interface: once per day the rod becomes a 30 hp servant dragon, by rod type, for messenger, steed, guard, or combat service. Wrong-alignment use triggers betrayal, and destruction of the dragon form destroys the rod permanently. | custom |
| Seeing | item-effect | Scroll-based remote creature imaging procedure. | partial |
| Shelter | item-effect | Pocket-room refuge scroll that creates a furnished extradimensional room with replenishing food, temporary weapons, and a 12-hour use window. Strong Chapter 05 model for refuge interfaces that bundle shelter and logistics, with a severe trap state if the scroll is removed while occupants remain inside. | custom |
| Staff of Harming | item-effect | Cleric-only Chaotic harm staff: touch inflicts 2-7 damage in addition to normal staff damage at 1 charge per harmed creature, and it can spend 2/2/3/4 charges to deliver cause blindness, cause disease, cause serious wounds, or create poison as reversed cleric payloads. | custom |
| Staff of an Element | item-effect | Element-tuned summoning, negation, and planar operation interface; a strong bundle case rather than a single-spell export, especially when Chapter 05 needs one item to expose several element-keyed functions. Element-tuned summoning, negation, and planar operation interface; includes multi-element and elemental-power variants, so it is a strong Chapter 05 bundle case rather than a single-spell export. | custom |
| Staff of the Druids | item-effect | Druid power-augmentation and charge-linked upkeep interface; should convert as attuned access to druidic functions or bundled powers rather than as raw slot augmentation. | custom |
| Symbol | spell | Custom sigil-triggered hazard package with explicit condition, payload, and reset doctrine rather than a plain static trap. | custom |
| Talisman of Elemental Travel | item-effect | Lesser talismans reverse a conjure-elemental effect to send the wearer to one matching Elemental Plane while granting breathable element-matter and strong vision there; the greater talisman covers all planes and can spend charges to compel elemental obedience. Strong Chapter 05 bundle case for transit, adaptation, and command in one interface. | custom |
| Trapping | item-effect | Scroll-created physical trap keyed by placement surface: floor for pit, ceiling for falling block, otherwise dart or gas logic. Strong Chapter 05 precedent for trigger-bearing utility items that instantiate real environmental hazards rather than illusory ones. | custom |
| Wizardry | spell | Cross-tradition rules-eligibility bridge for temporary legal use of one magic-user device or one 1st-2nd level magic-user scroll spell. Evidence lock: it includes procedural knowledge transfer, lasts one turn or until used, and applies minimum-caster-level handling. | custom |

### family-11

- Current Header: `Undead and the Deathless`
- Proposed Tag Family: `undead-deathless`
- Legacy Groups Merged: undead-focused rows currently distributed across transformation, communication, restoration, and protection families
- Downstream Notes: consolidate death/undeath handling here during row migration, preserving both hostile-undead and restoration-threshold doctrines.

#### Regrouped Legacy Tables

#### Undead Command, Trapping, and Artifact Interfaces

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Control Lesser Undead | item-effect | Master artifact-table undead-command interface for lesser undead tiers, with explicit HD ceilings and creature-count limits in the staged witness. Clean Chapter 05 precedent for undead-control bundles that remain item-side rather than spell-side. | custom |
| Control Greater Undead | item-effect | Master artifact-table undead-command interface for higher undead tiers with larger HD budgets. Distinct from clerical turning and should not be collapsed into ordinary charm/control families. | custom |
| Turning Undead | procedure | Core clerical anti-undead procedure with matrix lookup, retreat / destroy thresholds, and target-type-specific outcomes. Basic evidence lock: result bands determine whether undead are unaffected, turned, or destroyed, and turning power scales by cleric level against the target undead type. | custom |
| Turn Undead Bonus | item-effect | Artifact-table rider that improves turning rolls and destroyed-HD budget for one turn. Strong interface precedent for temporary class-feature amplification instead of direct offensive output. | custom |
| Life Trapping | item-effect | Item-bound entrapment effect that removes a target into contained stasis rather than killing or banishing it conventionally. Master artifact evidence gives the generic effect surface; Expert and RC add direct `Mirror of Life Trapping` witnesses, so this should stay one containment-interface row with broader item provenance rather than split into a separate named-item family row. | custom |

#### Meta-Doctrine and Exceptions / Artifact Rules / Systems

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Artifact Activation | procedure | Attunement-plus-discovery doctrine for artifact powers: possession alone is insufficient, and full use may require ritual, event, legend, or research. Strong Chapter 05 bridge for staged unlock and control workflows. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless an `RC` witness appears. | custom |
| Artifact Charges And Recharge | procedure | Renewable artifact reserve doctrine: magnitude sets the power budget, each use drains cost-matched charges, and spent capacity regenerates over time rather than depleting like ordinary items. Strong Chapter 05 model for rechargeable high-tier reserves. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless an `RC` witness appears. | custom |
| Artifact Intelligence And Auto-Defense | procedure | Semi-autonomous artifact agency doctrine covering telepathic guidance, refusal, and item-side defensive behavior outside the bearer's ordinary action economy. Strong Chapter 05/06 precedent for willful items and automatic defense logic. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless an `RC` witness appears. | custom |
| Artifact Handicaps And Penalties | procedure | Core adverse-effect framework for mortal artifact users, distinguishing permanent handicaps from temporary penalties. RC preserves the distinction; Master carries the fuller procedure surface. | custom |
| Destruction Of An Artifact | procedure | High-tier termination pathway for otherwise persistent artifact effects. Permanent-destruction quest procedure and Immortal-response consequences. RC confirms that each artifact has a unique legendary destruction method; Master carries the fuller destruction workflow and aftermath. | custom |
| Attacking An Artifact | procedure | Artifact durability, attack-immunity boundaries, damage thresholds, power loss, and recall behavior under sustained attacks. RC confirms the immunity and destruction baseline; Master carries the fuller degradation procedure. | custom |
| Creating Artifacts | procedure | Artifact design workflow for Sphere-aligned purpose, magnitude-based power and adversity budgets, and built-in activation or discovery methods rather than generic magic-item assembly. Strong design-side bridge for Chapter 05 artifact construction. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless an `RC` witness appears. | custom |
| Immortal Power Point Conversion And Bookkeeping | procedure | Core Immortals entry procedure for converting mortal XP into permanent and current PP tracks, with temporary-vs-permanent expenditure bookkeeping. Strong Chapter 05 bridge for reserve-style power economies that distinguish recoverable spend from permanent loss. | custom |
| Immortal Rank And Level Frame | procedure | Rank-and-level progression doctrine for Immortals: PP total determines rank, level still tracks progress within rank, and downstream gains key off the new Immortal hierarchy rather than mortal class tiers. | custom |
| Immortal GT Advancement Costs And Gate | procedure | Permanent-PP advancement doctrine tying ability-score purchase costs to Immortal rank and requiring Greater Talent maxima before rank advancement. Strong Chapter 05 bridge for high-tier stat investment gates and advancement thresholds. | custom |
| Immortal Sphere Bias And Recovery | procedure | Sphere-selection and planar-bias doctrine linking Immortal alignment context, PP regeneration, hit-point recovery, and ability-score recovery to hostile/neutral/friendly bias. Strong Chapter 05 guide for location-sensitive regeneration and resource cadence. | custom |
| Immortal Sphere-Factor Cost Model | procedure | Core Immortal magic economy: base PP cost multiplied by Sphere relationship factor, making dominance/opposition a formal cost model rather than flavor text. Strong Chapter 05 bridge for sphere-attuned cost scaling. | custom |
| Immortal Magical Effect Index (S1-S4) | procedure | Indexed PP vocabulary that unifies mortal spells and many non-spell magical effects, making it a core bridge between classic recognizers and Chapter 05 power language. Reference-index procedure for mapping mortal and non-spell effects to Immortal power-cost handling. Operationally this is the bridge that treats classic spells and many artifact-style non-spell effects as one indexed PP vocabulary, making it especially useful for Chapter 05 unification work. | custom |
| Immortal Caster Level Rule | procedure | Effective caster-level baseline for Immortal effect scaling is 2 x HD, which drives duration, scaling, and dispel resistance even though the effect is created rather than cast. Sets effective caster level at 2 x HD for all created effects and dispel interactions. Important downstream consequence: duration, scaling, and dispel resistance all key off this doubled effective level even though the effect is created rather than cast. | custom |
| Immortal Range / Duration Scaling | procedure | Cost-doubling doctrine for extending range, duration, and even volume, with hard limits on range-0 or instant/permanent effects and no cross-planar reach without an existing path. Cost-doubling framework for extending range, duration, and effect volume, including planar-path limits. Instant/permanent effects and range-0 effects cannot be extended, volume increases may require geometry-aware recalculation, and cross-planar reach still requires an existing path such as a gate or wormhole. | custom |
| Immortal Conjuring And Summoning Limits | procedure | Constraint doctrine for conjured allies and summoned entities at Immortal tier: response depends on normal movement or an opened path, and hostile Sphere or elemental bias can block the effect entirely. Defines transplanar response requirements and sphere/element bias constraints on conjured or summoned entities. Summoned beings must be able to reach the caller by their normal movement or via an opened path, and hostile elemental or Sphere bias can block response entirely even when the named effect normally works. | custom |
| Immortal Damage Scaling And Averaging | procedure | HD-scaled damage expression using 1d6 per HD, with explicit average-damage substitution and clamped per-die modifiers for fast high-tier resolution. High-tier damage rule set using HD-based dice and optional average-damage method for faster resolution. Immortal-created effects deal 1d6 per HD of the creator, average-damage substitution is explicitly encouraged for speed, and per-die modifiers are clamped by the die's natural min/max rather than added naively to the final total. | custom |
| Immortal Mental Effect Resolution | procedure | Recurring resistance doctrine for charmed or feebleminded Immortals: A-M and saves matter first, self-cure is unavailable, and later escape depends on Intelligence-check cadence plus renewed saves. Non-magical recovery cadence for charmed/feebleminded Immortals via Intelligence checks plus save retries. Permanent mortal-style mental effects become recurring resistance procedures at Immortal tier: A-M and saves still matter up front, magical self-cure is unavailable, and later escape depends on Intelligence-based check cadence followed by a fresh save. | custom |
| Immortal Limits On Use | procedure | Action-economy and target-scope doctrine for created effects: self-only effects may be delivered by touch, mortal magic cannot affect Immortals, and each round allows either one magical action or the form's available physical attacks, not both. | custom |
| Immortal Undead / Entropy Curing | procedure | Conversion rule that re-reads undead-curative magic as Entropy-creature healing at Immortal tier. Strong Chapter 05 bridge for affinity-based target remapping and undead/entropy exception handling. | custom |
| Immortal Effect Explanation Overrides | procedure | Alphabetical override layer that turns named spells and non-spell effects into Immortal-specific procedures, exceptions, and retuned limits. Operationally this is the evidence surface for spell-family-specific Immortal reinterpretations such as `Contact Outer Plane`, `Invisible Stalker`, and `Maze`. | custom |

#### Meta-Doctrine and Exceptions / Artifact / Immortal Rules

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Artifact Activation | procedure | Attunement-plus-discovery doctrine for artifact powers: possession alone is insufficient, and full use may require ritual, event, legend, or research. Strong Chapter 05 bridge for staged unlock and control workflows. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless an `RC` witness appears. | custom |
| Artifact Charges And Recharge | procedure | Renewable artifact reserve doctrine: magnitude sets the power budget, each use drains cost-matched charges, and spent capacity regenerates over time rather than depleting like ordinary items. Strong Chapter 05 model for rechargeable high-tier reserves. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless an `RC` witness appears. | custom |
| Artifact Handicaps And Penalties | procedure | Core adverse-effect framework for mortal artifact users, distinguishing permanent handicaps from temporary penalties. RC preserves the distinction; Master carries the fuller procedure surface. | custom |
| Artifact Intelligence And Auto-Defense | procedure | Semi-autonomous artifact agency doctrine covering telepathic guidance, refusal, and item-side defensive behavior outside the bearer's ordinary action economy. Strong Chapter 05/06 precedent for willful items and automatic defense logic. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless an `RC` witness appears. | custom |
| Attacking An Artifact | procedure | Artifact durability, attack-immunity boundaries, damage thresholds, power loss, and recall behavior under sustained attacks. RC confirms the immunity and destruction baseline; Master carries the fuller degradation procedure. | custom |
| Creating Artifacts | procedure | Artifact design workflow for Sphere-aligned purpose, magnitude-based power and adversity budgets, and built-in activation or discovery methods rather than generic magic-item assembly. Strong design-side bridge for Chapter 05 artifact construction. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless an `RC` witness appears. | custom |
| Destruction Of An Artifact | procedure | Permanent-destruction quest procedure and Immortal-response consequences. RC confirms that each artifact has a unique legendary destruction method; Master carries the fuller destruction workflow and aftermath. | custom |
| Immortal Conjuring And Summoning Limits | procedure | Defines transplanar response requirements and hostile Sphere/element bias constraints that can block even nominally valid summoning effects. Defines transplanar response requirements and sphere/element bias constraints on conjured or summoned entities. Summoned beings must be able to reach the caller by their normal movement or via an opened path, and hostile elemental or Sphere bias can block response entirely even when the named effect normally works. | custom |
| Immortal Damage Scaling And Averaging | procedure | High-tier damage rule set using 1d6 per HD plus optional average-damage handling and clamped per-die modifiers for faster resolution. High-tier damage rule set using HD-based dice and optional average-damage method for faster resolution. Immortal-created effects deal 1d6 per HD of the creator, average-damage substitution is explicitly encouraged for speed, and per-die modifiers are clamped by the die's natural min/max rather than added naively to the final total. | custom |
| Immortal Limits On Use | procedure | Action-economy and target-scope doctrine for created effects: self-only effects may be delivered by touch, mortal magic cannot affect Immortals, and each round allows either one magical action or the form's available physical attacks, not both. | custom |

### family-12

- Current Header: `Heritage Powers`
- Proposed Tag Family: `heritage-powers`
- Legacy Groups Merged: none (no direct BECMI-only legacy group)
- Downstream Notes: reserve for lineage/culture-bound additions and Chapter 06 heritage imports.

#### Regrouped Legacy Tables

#### Meta-Doctrine and Exceptions / Reality Rewrite / High-Tier

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Wish | spell | Canonical heading should remain `Wish` even where the SDM descendant is `Big Wish`. Treat `Big Wish` as the tone-forward variant, but keep this row as the high-tier reality-rewrite recognizer and likely ritual-grade exception doctrine. | custom |
| Timestop | spell | Temporal exception effect and high-tier action-economy breaker. Keep as custom because it rewrites scene sequencing rather than merely granting speed, remaining distinct from the ordinary acceleration family. | custom |
| Reverse Gravity | spell | Battlefield-physics inversion that behaves as a rules exception rather than a standard force attack. Battlefield-physics inversion and area-control exception effect, likely requiring custom environmental resolution language instead of ordinary force-attack mapping. | custom |
| Contingency | spell | Conditional trigger/do-if framework for precommitted defensive or utility responses. Treat as a custom meta-procedure because Chapter 06 still needs explicit trigger grammar, stored payload scope, and precommit limits. | custom |

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
| Protection from Elementals | item-effect | Circle protection scroll keyed specifically to elementals. Expert evidence lock: creates a moving 10' radius circle around the reader, blocks elemental attacks unless the protected side strikes first in hand-to-hand combat, and lasts 2 turns. | partial |
| Protection from Lycanthropes | item-effect | Circle protection scroll keyed to lycanthrope types by quantity band. | partial |
| Protection from Magic | item-effect | Protection-scroll ECM ward that creates a moving 10' circle around the reader and blocks spells or spell effects from crossing the boundary. Expert evidence lock: duration is 1-4 turns, item-origin effects are also blocked, and only `Wish` breaks it early. Strong Chapter 05 denial-field model rather than generic resistance. | custom |
| Protection from Undead | item-effect | Circle protection scroll keyed to undead by type and quantity. | partial |
| Questioning | item-effect | Nonliving-object interrogation procedure. | partial |
| Repetition | item-effect | Scroll wrapper that replays the same-level spell effect after one turn. | custom |
| Seeing | item-effect | Scroll-based remote creature imaging procedure. | partial |
| Shelter | item-effect | Pocket-room refuge scroll with supplies and extradimensional trapping edge cases. Companion gives this a furnished extradimensional room with replenishing food, temporary weapons, 12-hour use windows, and a severe trap state if the scroll is removed while occupants remain inside. Strong Chapter 05 model for refuge interfaces that bundle shelter, logistics, and containment risk. | custom |
| Spell Scrolls / Spells | item-effect | Generic spell-scroll wrapper covering class restrictions, multi-spell payloads, and copy-versus-cast handling. | partial |
| Spell Catching | item-effect | Catches one incoming spell into scroll capacity bands; strong Chapter 05/06 bridge case for hostile-power capture into storage media using explicit Power Level capacity rather than slot logic. | custom |
| Spell Storing | item-effect | Ring-based spell payload storage and later discharge; should convert as an item-side power archive with Power Level capacity and release rules, not as prepared-slot retention. Expert evidence lock: found rings carry a fixed 1-6-spell payload, refilling requires direct casting into the ring, stored effects resolve at the minimum caster level needed, and the ring does not absorb attacks cast at the wearer. | custom |
| Trapping | item-effect | Scroll-created physical trap keyed by placement surface. Companion ties payload to placement surface: floor for pit, ceiling for falling-block, otherwise poison-dart or gas logic, and the created trap is real rather than illusory. Good Chapter 05 precedent for trigger-bearing utility items that instantiate environmental hazards instead of casting direct attacks. | custom |
| Truth | item-effect | Living-mind question procedure via an enhanced ESP-like readout. | partial |
| Cursed / Cursed Scroll | item-effect | Immediate curse-on-sight scroll wrapper; niche but persistent enough to deserve a canonical lookup row. Basic evidence lock: curse triggers on seeing writing; reading aloud is not required. | partial |

#### Non-Spell Rows - Ring Interfaces

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Ring of Elemental Adaptation | item-effect | Plane-keyed elemental survival ring available in seven variants (single element, paired Air/Water or Earth/Fire, or all-elements) that lets the wearer breathe and see normally within the matching Elemental Plane. Strong supporting interface for talisman/staff travel bundles, but narrower than those because it does not itself provide transit or command. | partial |
| Djinni Summoning | item-effect | Ring-call interface for a bound djinni servant. Expert evidence lock: summons one djinni to serve the wearer for up to one day, keyed to the current wearer rather than a generic owner, and the ring can only be used once per week. | custom |
| Human Control | item-effect | Ring-borne domination wrapper that mirrors the human-control potion but persists until cancelled, removed, or dispelled. Expert evidence lock: this is not a short fixed-duration charm; it stays active until the wearer ends it, the ring is removed, or `Dispel Magic` breaks it. | custom |
| Plant Control | item-effect | Ring-borne plant-command interface that mirrors the potion family but depends on sustained concentration. Expert evidence lock: this does not grant indefinite passive command; control lasts only while the wearer concentrates. | custom |
| Protection +1, 5' radius | item-effect | Shared-aura defense ring that grants a modest ward to everyone nearby, including enemies. Expert evidence lock: improves the wearer's Armor Class and Saving Throws by 1 and gives the same bonus to all creatures within 5', friend and foe alike. | custom |
| Regeneration | item-effect | Slow regenerative ring with bodily repair and hard failure boundaries. Expert evidence lock: restores 1 hp per turn, regrows lost limbs, stops functioning at 0 hp or below, and cannot regenerate fire or acid damage. | custom |
| Ring of Holiness | item-effect | Cleric/druid power-augmentation wrapper tied to ring use; later conversion should express this as eligibility, blessing-layer access, or reduced burden around holy/nature powers rather than extra slot grant. | custom |
| Ring of Life Protection | item-effect | Anti-drain and life-threshold safeguard interface with finite depletion behavior; useful as a threshold-protection model distinct from ordinary healing because it prevents or defers loss rather than repairing it after the fact. | custom |
| Ring of Memory | item-effect | Immediate one-spell recall interface for spellcasters only: the wearer must choose within 1 turn of casting, then the spell is instantly relearned, with the ring restoring only one spell per day. Strong Chapter 05 model for short-horizon recovery/retention rather than passive memory bonuses or broad archive storage. | custom |
| Ring of Remedies | item-effect | Bundled condition-repair and cleansing wrapper across multiple cure lanes; likely a reusable Chapter 05 model for one item exposing several tagged recovery functions instead of one-to-one spell copies. | custom |
| Ring of Spell Eating | item-effect | Hostile spell-defense and absorption interface distinct from plain spell turning; a core Chapter 05 ECM item case for canceling or consuming incoming powers instead of merely reflecting them. | custom |
| Ring of Spell Turning | item-effect | Finite ECM reflection item that redirects 2-12 incoming spell attacks back at their casters rather than consuming them. Expert evidence lock: each reflected attack spends part of the limited budget, returns the hostile payload at original force, and only true spells are reflected, not monster spell-like powers or item-borne spell-like effects. | custom |
| Ring of Survival | item-effect | Environmental hardening and hazard-resistance wrapper at item scale. | partial |

#### Non-Spell Rows - Potion Interfaces

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Animal Control | item-effect | Control-potion interface for commanding mundane or giant animals by total HD budget. Expert evidence lock: controls 3-18 HD of normal or giant animals only, excludes fantastic or magical beasts, and controlled animals become afraid and leave if able when control ends. | custom |
| Dragon Control | item-effect | High-risk command potion keyed by dragon type. Expert evidence lock: controls up to 3 dragons of the matching type, cannot force spellcasting, and controlled dragons become hostile when the effect ends. | custom |
| Heroism | item-effect | Temporary level-boost and survivability potion for martial or ordinary users rather than full casters. Expert evidence lock: no effect on cleric, elf, magic-user, or thief; fighters, dwarves, halflings, normal men, or monsters gain higher-level or higher-HD statistics for the duration. | custom |
| Invulnerability | item-effect | Defensive enhancement potion that grants both AC and save bonuses with anti-spam backlash. Expert evidence lock: grants +2 AC and +2 Saving Throws, but repeated use more than once per week causes sickness instead of stacking protection. | custom |
| Treasure Finding | item-effect | Treasure-sense potion for directional and distance-bearing acquisition, not appraisal. Expert evidence lock: detects direction and distance but not amount, and keys to the largest treasure within 360'. | custom |

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
| Wand of Negation | item-effect | Narrow ECM wand that cancels one other wand or staff effect instead of countering free-cast spells. Expert evidence lock: negates one wand or staff effect, and if the canceled effect has duration the negation persists for one round. | custom |
| Elemental Devices | item-effect | Element-tuned miscellaneous interface that summons and controls a device elemental under the ordinary elemental-control rules. Expert evidence lock: bowl, brazier, censer, or stone variants each work once per day, take 1 turn to use, and summon the matching elemental type. | custom |

#### Non-Spell Rows - Arcane Tools and Utility Interfaces

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Helm of Teleportation | item-effect | Recharge-gated teleport interface tied to external recasting rather than daily charges. Expert evidence lock: the wearer may teleport normally or teleport another creature/item, but after one use the helm stays inert until a `Teleport` spell is cast upon it, after which self-teleport may be repeated until another outbound payload is attempted. | custom |
| Intelligent Swords / Special Swords | item-effect | Willful weapon subsystem rather than a bundle of standalone spell rows. Expert evidence lock: intelligent swords may speak, know an alignment tongue, sometimes `read magic`, and carry built-in detection or spell-family powers; special swords are purpose-built by powerful beings and add alignment-keyed effects such as paralysis, save bonuses, or petrification when used for their special purpose. | custom |
| Quill of Copying | item-effect | Spell transcription and copy-risk procedure; strong Chapter 05/06 spell-handling bridge. | custom |
| Slate of Identification | item-effect | Item-identification procedure surface distinct from `Read Magic` and `Mages` scroll behavior. | partial |

#### Non-Spell Rows - Enchantment Handling and Durability

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Damage to Magical Items | procedure | Carrier durability and destruction doctrine for potions, scrolls, wands, staves, rods, rings, and other permanent items under harsh treatment. RC sets explicit toughness bands (+1 for potions/scrolls, +2 for wands/staves, +3 for permanent miscellaneous items) and preserves partial-damage loss on magical bonuses. Strong Chapter 05 bridge for item-wear and catastrophic-loss handling. | custom |
| Experience from Spells and Enchanted Items | procedure | Enchantment-economics reward doctrine for spell research, magical items, and large enchanted builds. RC ties XP to successful first-of-kind magical work, downgrades vessel/home awards to one-third gp spent, and divides collaborative awards among participating spellcasters. Strong Chapter 05/06 support for research and fabrication reward policy. | custom |
| Alchemical Potion Duplication / Potion Research Support | procedure | Specialist-support doctrine for potion copying and potion-only research outside direct caster labor. Expert evidence lock: an alchemist can duplicate a potion from a formula or sample at half normal time and cost, and can research new potion types at twice the cost and time required for a magic-user. | custom |
| Sage Magical Research Support | procedure | Obscure-knowledge support workflow for magical investigation. Expert evidence lock: sages can research hidden or ancient knowledge but carry failure chance, book-acquisition cost, and time burdens set by the referee. | custom |
| Spellbook Replacement | procedure | Arcane archive-recovery doctrine for lost spellbooks. Basic, Expert, and RC all preserve the same recovery burden: a magic-user or elf cannot regain spells until the book is replaced, and restoration requires substantial gold, study time, and the caster's full attention rather than ordinary adventuring activity. | custom |
| Magic Item Range/Duration Default | procedure | Default-caster baseline for magic-item effects when an item omits its own numbers. Expert evidence lock: any missing range or duration should be treated as though produced by a 6th-level spell caster. | custom |
| Magic Detection/Control Blocking | procedure | Material-occlusion doctrine for item-side detection and control effects. Expert evidence lock: a thin sheet of lead, 1' of other metal, or 10' of stone blocks these ranges and interactions. | custom |
| Intelligent Item Will Power / Control Check | procedure | Willful-item control doctrine for intelligent weapons and similar autonomous magic. Expert evidence lock: item will power derives from Intelligence, Ego, and extraordinary powers; user will power comes from Intelligence plus Wisdom with wound penalties; control contests trigger on handling, injury, competing weapons, alternate users, and special-purpose opportunities. | custom |

#### Non-Spell Rows - Artifact Procedures

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Artifact Activation | procedure | Attunement-plus-discovery doctrine for artifact powers: possession alone is insufficient, and full use may require ritual, event, legend, or research. Strong Chapter 05 bridge for staged unlock and control workflows. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless an `RC` witness appears. | custom |
| Artifact Charges And Recharge | procedure | Renewable artifact reserve doctrine: magnitude sets the power budget, each use drains cost-matched charges, and spent capacity regenerates over time rather than depleting like ordinary items. Strong Chapter 05 model for rechargeable high-tier reserves. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless an `RC` witness appears. | custom |
| Artifact Intelligence And Auto-Defense | procedure | Semi-autonomous artifact agency doctrine covering telepathic guidance, refusal, and item-side defensive behavior outside the bearer's ordinary action economy. Strong Chapter 05/06 precedent for willful items and automatic defense logic. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless an `RC` witness appears. | custom |
| Artifact Handicaps And Penalties | procedure | Core adverse-effect framework for mortal artifact users (permanent handicaps and temporary penalties). RC directly preserves the handicap/penalty distinction; Master carries the fuller procedure surface. | custom |
| Attacking An Artifact | procedure | Artifact durability, attack-immunity boundaries, damage thresholds, power loss, and recall behavior under sustained attacks. RC confirms the immunity/destruction baseline; Master carries the fuller degradation procedure. | custom |
| Destruction Of An Artifact | procedure | Permanent-destruction quest procedure and Immortal-response consequences. RC confirms that each artifact has a unique legendary destruction method; Master carries the fuller destruction workflow and aftermath. | custom |
| Creating Artifacts | procedure | Artifact design workflow for Sphere-aligned purpose, magnitude-based power and adversity budgets, and built-in activation or discovery methods rather than generic magic-item assembly. Strong design-side bridge for Chapter 05 artifact construction. Current staged-corpus state is `Master`-only; treat as a legitimate non-`RC` exception unless an `RC` witness appears. | custom |

#### Non-Spell Rows - Immortal Procedures

| Classic Name | Type | Notes | Mapping Status |
| --- | --- | --- | --- |
| Immortal Power Point Conversion And Bookkeeping | procedure | Core Immortals reserve-economy procedure converting mortal XP into permanent and current PP tracks, with temporary-vs-permanent expenditure bookkeeping. | custom |
| Immortal Rank And Level Frame | procedure | Rank-and-level progression doctrine for Immortals, with PP total determining rank while level still tracks progress within rank. | custom |
| Immortal GT Advancement Costs And Gate | procedure | Permanent-PP stat-purchase and advancement-gate doctrine requiring Greater Talent maxima before rank promotion. | custom |
| Immortal Sphere Bias And Recovery | procedure | Sphere-choice and planar-bias recovery doctrine linking location bias to PP, hit-point, and ability-score regeneration cadence. | custom |
| Immortal Sphere-Factor Cost Model | procedure | Core Sphere-relationship multiplier doctrine for Immortal magic costs, turning dominance and opposition into explicit PP cost scaling. | custom |
| Immortal Magical Effect Index (S1-S4) | procedure | Reference-index procedure for mapping mortal and non-spell effects to Immortal power-cost handling. Operationally this is the bridge that treats classic spells and many artifact-style non-spell effects as one indexed PP vocabulary, making it especially useful for Chapter 05 unification work. | custom |
| Immortal Caster Level Rule | procedure | Sets effective caster level at 2 x HD for all created effects and dispel interactions. Important downstream consequence: duration, scaling, and dispel resistance all key off this doubled effective level even though the effect is created rather than cast. | custom |
| Immortal Range / Duration Scaling | procedure | Cost-doubling framework for extending range, duration, and effect volume, including planar-path limits. Instant/permanent effects and range-0 effects cannot be extended, volume increases may require geometry-aware recalculation, and cross-planar reach still requires an existing path such as a gate or wormhole. | custom |
| Immortal Conjuring And Summoning Limits | procedure | Defines transplanar response requirements and sphere/element bias constraints on conjured or summoned entities. Summoned beings must be able to reach the caller by their normal movement or via an opened path, and hostile elemental or Sphere bias can block response entirely even when the named effect normally works. | custom |
| Immortal Damage Scaling And Averaging | procedure | High-tier damage rule set using HD-based dice and optional average-damage method for faster resolution. Immortal-created effects deal 1d6 per HD of the creator, average-damage substitution is explicitly encouraged for speed, and per-die modifiers are clamped by the die's natural min/max rather than added naively to the final total. | custom |
| Immortal Mental Effect Resolution | procedure | Non-magical recovery cadence for charmed/feebleminded Immortals via Intelligence checks plus save retries. Permanent mortal-style mental effects become recurring resistance procedures at Immortal tier: A-M and saves still matter up front, magical self-cure is unavailable, and later escape depends on Intelligence-based check cadence followed by a fresh save. | custom |
| Immortal Limits On Use | procedure | Action-economy and target-scope doctrine for created effects, including self-only effects delivered by touch. Immortal-created magic can affect Immortals while mortal-created magic cannot, incorporeal beings ignore magic entirely, self-only effects can be delivered outward by touch, and each round permits either one magical action or the form's available physical attacks, not both. | custom |
| Immortal Undead / Entropy Curing | procedure | Re-reads undead-curative magic as Entropy-creature healing at Immortal tier, with Turn-style handling explicitly excluded. | custom |
| Immortal Effect Explanation Overrides | procedure | Alphabetical override layer for named Immortal spell/effect exceptions, covering spell-family-specific reinterpretations such as `Contact Outer Plane`, `Invisible Stalker`, and `Maze`. | custom |

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

## Deferred Gear Chapter Bundle Notes

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

- `partial` is being used where the classic recognizer is clear but the SDM implementation will need storage, retention, trigger, bearer-language, or powers-taxonomy bridge text.
- `custom` is being used where the classic spell is really a bundled subsystem, ritual-grade exception, or doctrine carrier rather than a clean one-power export.
- Overcharge relationships should be captured during later conversion passes whenever multiple classic rows obviously form one scaling family. Fireburst ladders, acceleration ladders, and related escalating artillery or control suites are the main candidates.
- When a classic family is likely to collapse into one SDM power progression, note whether higher riders may begin locked, corrupted, or encrypted and require RSS- or campaign-side work to unlock safely.
- ECM rows should continue to prefer negation, denial, capture, reflection, cancellation, and jamming language over broad defensive or restorative bucket sprawl.
- The staged corpus has been frozen so that Chapter 06 can treat the crosswalk and BECMI/RC staging files as canonical spell-source infrastructure.