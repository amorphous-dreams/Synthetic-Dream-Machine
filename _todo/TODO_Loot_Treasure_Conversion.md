# TODO: Loot & Treasure Conversion Pass (BECMI/RC -> SDM+)

## Purpose
- Run a dedicated quality-confidence pass for loot and treasure procedures as a standalone workstream.
- Convert BECMI/Rules Cyclopedia treasure play into SDM+ canonical procedures across:
  - treasure types and hoards
  - transport burden and extraction logistics
  - liquidation/fencing/economy interfaces
- Align BECMI/Rules Cyclopedia loot and treasure economy scale to the SDM+ economy scale.

## Economy Normalization Decision
- Canonical conversion rule for this pass: `1 cash (€) = 1 silver` (BECMI/RC scale alignment).

## Source Priority and Intent
Intent: align and curate BECMI/Rules Cyclopedia loot-treasure procedures into SDM+ references. Canonical procedure text should land in SDM numbered chapters when source-priority patterns are clear; net-new procedure synthesis belongs in FTLS chapters.

Source Priority (highest to lowest):
1. `Our_Golden_Age/Our_Golden_Age.md`
2. `Vastlands_Guidebook/Vastlands_Guidebook.md`
3. `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md`
4. All other SDM books (including FTLS as net-new synthesis layer)

Scope note:
- Elyncia/meta docs are not source-priority canon drivers for this pass.
- Goal is spiritual successor behavior, not exhaustive one-to-one conversion.

## Translation Guardrails (OSR Intent, SDM/Luka Style)
- Preserve **recognizable BECMI procedure identity** (treasure type cadence, carried vs lair distinctions, cash-out friction, encumbrance pressure).
- Express procedures in **SDM-native language and units** (`cash`, `sp/st/sk`, tags, Attention handoff), not TSR-era statblocks.
- Favor **short loops and explicit referee verbs** over exhaustive simulation detail.
- Keep pressure and consequences attached to existing SDM/FTLS systems (RSS Attention/Encounter Die, weekly cadence handoffs).
- Ship RC/BECMI imports as **optional overlays** first; promote only what improves table behavior and readability.

## Conversion Scope
- `LT01` Treasure Discovery and Generation
- `LT02` Hoard Composition and Site Risk Coupling
- `LT03` Transport Burden, Carriage, and Extraction Throughput
- `LT04` Liquidation, Fencing, and Market-Time Friction

## Rubric (0.0-1.0)
Use the same quality-confidence scale as `_todo/TODO_BECMI_Conversion.md`.

| Score Band | Meaning |
|---|---|
| `0.00-0.25` | Mention/lore only; not runnable. |
| `0.26-0.40` | Fragmentary; one-off rules, missing loop stages. |
| `0.41-0.60` | Functional narrow loop; weak integration/escalation. |
| `0.61-0.80` | Strong repeatable loop with explicit cadence and cost. |
| `0.81-0.95` | Canon-ready and cross-linked with adjacent systems. |
| `0.96-1.00` | Fully canonical, multi-scale, low-adjudication drift. |

## Primary BECMI/RC Anchors
- `RC Ch. 16` (treasure tables, magic items, recovery/handling)
- `RC Ch. 4` + `RC Ch. 6` (encumbrance, overland movement and carriage constraints)
- `RC Ch. 7` (site risk and discovery context for treasure placement)

Rules Cyclopedia source: `_becmi/TSR 1071 - The D&D Rules Cyclopedia.pdf`.

## SDM+ Evidence Start Points
- Core units and inventory economics:
  - `Synthetic_Dream_Machine_01_Quickstart.md:196`
  - `Synthetic_Dream_Machine_01_Quickstart.md:201`
  - `Synthetic_Dream_Machine_01_Quickstart.md:223`
  - `Synthetic_Dream_Machine_01_Quickstart.md:448`
- Canonical treasure consolidation chapter:
  - `Synthetic_Dream_Machine_05_Gear_Index.md#sdm-loot-and-treasure:1`
- Salvage -> value -> trade chain:
  - `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:462`
  - `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:495`
  - `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:519`
  - `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:603`
- Primary implementation target:
  - `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_09_Loot_and_Treasure.md:1`

## Quality Confidence Workplan (Per LT Principle)
For each `LT0X`:
1. Capture coverage evidence (where rule exists).
2. Capture behavior evidence (trigger -> procedure -> output -> consequences).
3. Capture pattern evidence (reused Luka pattern across scales/books).
4. Capture gap evidence (missing loops, ambiguity, placeholders, contradictions).
5. Assign score and add patch focus.

## Canonical Behavior Targets

### `LT01` Treasure Discovery and Generation
- Expected loop:
  - `site/discovery context` -> `treasure generation procedure` -> `category/value output` -> `record tags and constraints`
- Required outputs:
  - value band
  - bulk (`sp/st/sk`)
  - handling tag (legal/restricted/volatile/perishable/soul-bound/etc.)
  - immediate risk hook

### `LT02` Hoard Composition and Site Risk Coupling
- Expected loop:
  - `hoard source context` -> `composition` -> `guardianship/pressure hooks` -> `recovery complexity`
- Required outputs:
  - mixed hoard structure (cash, goods, oddities, relics, leverage items)
  - extraction complications tied to existing encounter/attention systems

### `LT03` Transport Burden and Extraction Throughput
- Expected loop:
  - `acquire loot` -> `convert to carry units` -> `movement/encumbrance impacts` -> `loss/breakage/theft risk`
- Required outputs:
  - explicit carry conversion using SDM units (`sp/st/sk`)
  - burden penalties
  - caravan/retainer/vehicle carriage hooks

### `LT04` Liquidation, Fencing, and Market-Time Friction
- Expected loop:
  - `declare liquidation channel` -> `time + roll + market state` -> `net value + obligations`
- Required outputs:
  - sale channels (open market, fence, faction contract, ritual conversion)
  - default markdown/markup logic
  - time cost and legal/faction heat consequences

## Deliverables
- One completed quality-confidence report section per `LT01-LT04`.
- One live summary table for loot/treasure principles and scores.
- Patch targets for:
  - SDM numbered chapter canonicalization
  - FTLS chapter implementation (especially chapter 09 replacement)
- Final cross-link back into `_todo/TODO_BECMI_Conversion.md` procedure map and next-step queue.

## Current Implementation Snapshot (FTLS 09 + SDM 06)
- `Synthetic_Dream_Machine_05_Gear_Index.md#sdm-loot-and-treasure` is the canonical SDM consolidation layer for loot/treasure market behavior.
- `FTLS 09` is now a runnable BECMI spiritual-successor overlay for `LT01-LT04`:
  - `LT01` includes a full `d20` loot table, Area-Level value bands, and linked sub-tables (`A-G`) for coin mix, gem/jewelry condition/grade/profile, special treasure, and relic yield.
  - `LT01` now includes `Treasure Table H` for specific magic-item generation (RC-family cadence, SDM+ source resolution ladder) plus `Pre-Rolled Opposition Use` for encounter-ready seeded items.
  - `LT01` now includes updated coin-mix economy weirdness (`1-3 Expected / 4-5 Surprising / 6 Error`) with OGA/FTLS concept references.
  - `LT02` includes hoard-band picks, area-tagged hoard profiles, risk riders, and explicit `Step 5` escalation hooks.
  - `LT03` separates on-foot vs pack-animal/vehicle overload handling, with speed guidance and source links.
  - `LT04` now includes context framing + channel matrix + `LT04` cash-out overlay (fees, liquidity caps, refusal/fallback buyers) and linkage to in-chapter `Illicit lots` handling.
- Economy alignment is explicit in chapter text: `1 cash (€) = 1 silver`.
- BECMI denomination conversion is explicit for operations (`cp/sp/ep/gp/pp -> cash`).
- Treasure-family mapping is explicit and tag-linked (`coins`, `gems`, `trade goods`, `relics`, `intel`, `illegal`, etc.).
- RC letter-table overlays remain pending implementation in FTLS 09.
- This is now beyond placeholder baseline; next pass is RC/BECMI table/procedure ingestion as optional overlays within one spiritual-successor flow.

## Proposed Edit Targets (active implementation)
- `Synthetic_Dream_Machine_05_Gear_Index.md#sdm-loot-and-treasure` (canonical SDM treasure-generation consolidation chapter)
- `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_09_Loot_and_Treasure.md` (primary net-new synthesis target)
- `Synthetic_Dream_Machine_01_Quickstart.md` (canonical unit/economy panels)
- Optional: small compatibility sidebars in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md`

## Quality Confidence Reports (Active)

### `LT01` Treasure Discovery and Generation
- **Quality confidence score:** `0.84` (`Canon-ready`)
- **Coverage evidence:**
  - Discovery-to-action handoff exists in `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:530` and FTLS area/node conversion in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:299`.
  - Salvage crits already call into a random loot pipeline in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:496`.
  - Dedicated generation is explicit in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_09_Loot_and_Treasure.md` (`LT01`, value bands, and `BECMI Treasure Family -> SDM Tags` with expanded family coverage).
- **Gaps lowering score:**
  - RC Ch.16 Treasure Type letter logic is not yet available as an optional LT01 generator mode.
  - RC ingestion does not yet have inline chapter overlay blocks for letter-table execution (`lair`/`carried`) in the current flow.
- **Patch focus:**
  1. Add RC letter-table overlays to LT01 without replacing current SDM-first defaults.
  2. Add clear inline referee steps for running RC letter outputs inside the existing flow.

### `LT02` Hoard Composition and Site Risk Coupling
- **Quality confidence score:** `0.85` (`Canon-ready`)
- **Coverage evidence:**
  - UVG discovery entries include concrete valuables + sack counts in site context (for example `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:855`, `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:965`).
  - FTLS already models site pressure/escalation that can guard hoards (`Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:356`).
  - Hoard tiering, expanded profile rows, risk riders, and explicit escalation hooks are now explicit in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_09_Loot_and_Treasure.md` (`LT02`).
- **Gaps lowering score:**
  - Overlap handling is present as referee guidance but still not formalized as a deterministic tie-break matrix.
  - Weekly fallout thresholds are present, but campaign-profile event-column mapping is still not standardized in one compact reference block.
- **Patch focus:**
  1. Add a short tie-break matrix for multi-profile tag collisions.
  2. Add a one-line event-column mapping for weekly pre-roll fallout by campaign profile.

### `LT03` Transport Burden, Carriage, and Extraction Throughput
- **Quality confidence score:** `0.88` (`Canon-ready`)
- **Coverage evidence:**
  - Core size and currency units are explicit in `Synthetic_Dream_Machine_01_Quickstart.md:196`, `Synthetic_Dream_Machine_01_Quickstart.md:202`.
  - Travel supply and cargo unit consistency reinforced in `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:10384`.
  - FTLS salvage already resolves into sacks and inventory pressure in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:495`, and `FTLS 09` now gives explicit on-foot vs pack/vehicle overload + speed guidance.
- **Gaps lowering score:**
  - Transport logic is now centralized in FTLS09, but RC/BECMI-specific carriage and conversion edge cases are not yet pulled in as optional overlays.
  - No explicit RC-facing conversion table yet for animal/cart/vehicle burden examples by item family.
- **Patch focus:**
  1. Add RC/BECMI optional transport overlays (strict encumbrance examples + carriage edge cases).
  2. Add item-family-specific breakage/loss guidance tied to overload outcomes.

### `LT04` Liquidation, Fencing, and Market-Time Friction
- **Quality confidence score:** `0.84` (`Canon-ready`)
- **Coverage evidence:**
  - VLG has direct merchant-sale precedent in `Vastlands_Guidebook/Vastlands_Guidebook.md:1604`.
  - FTLS has a full market research + deal + haggling chain in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:519`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:531`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:550`.
  - `FTLS 09` presents a two-layer liquidation procedure (SDM06 market resolution + channel profile) with illicit-lot handling in the escalation hook step.
- **Gaps lowering score:**
  - RC magical/special-item sale cadence (buyer search + offer bounds) is still missing as an explicit optional panel.
  - Multi-day magical-item buyer search economics are not yet expressed as a compact escalation mini-loop (collector/faction/auction paths).
- **Patch focus:**
  1. Add RC-style magical-item buyer-search + fallback offer bounds as an optional LT04 overlay.
  2. Add compact magical-item sale economy hooks (time, visibility, obligations) aligned with SDM06 channels.

## Live Scoreboard

| ID | Principle | Score | Rubric Band | Status | Immediate Conversion Target |
|---|---|---|---|---|---|
| `LT01` | Treasure discovery/generation | `0.84` | Canon-ready | Baseline complete | Add RC Ch.16 letter-table optional overlays within the existing spiritual-successor flow. |
| `LT02` | Hoard composition/risk coupling | `0.85` | Canon-ready | Baseline complete | Add deterministic tag tie-break matrix + compact weekly event-column mapping. |
| `LT03` | Transport burden/extraction throughput | `0.88` | Canon-ready | Baseline complete | Add RC optional transport overlays and item-family breakage/loss guidance. |
| `LT04` | Liquidation/fencing/time friction | `0.84` | Canon-ready | Baseline complete | Add magical-item buyer-search economy overlay (time/offer/obligation bands). |

## Checklist
- [x] Establish `LT01-LT04` baseline scores with evidence.
- [x] Complete repo-wide sweep focused on loot/treasure semantics (not only salvage passages).
- [x] Start implementation by replacing FTLS chapter 09 placeholder with a runnable conversion draft.
- [x] Add explicit BECMI denomination conversion (`cp/sp/ep/gp/pp`) under `1 cash = 1 silver` policy.
- [x] Draft canonical `Loot Generation Table` profile(s) with SDM unit outputs.
- [x] Draft `Hoard Composition` procedure with risk coupling.
- [x] Draft `Transport & Burden` procedure and carriage profiles.
- [x] Draft `Liquidation/Fence` procedure (time, channel, legal/faction consequences).
- [x] Re-rate `LT01` and `LT02` after first implementation draft against source-priority evidence (`OGA > VLG > UVG`).
- [x] Calibrate `LT01` value scaling by Area-Level bands aligned with RSS salvage market bands.
- [x] Add deterministic `LT02` escalation hooks (tier, legality, haul size) and area-tagged hoard profiles.
- [x] Re-rate `LT01-LT04` after Chapter 09 tightening pass.
- [x] Add explicit translation guardrails (`OSR intent`, `SDM/Luka expression`) to this TODO and chapter implementation.
- [x] Confirm single spiritual-successor flow (no `SDM Default` / `RC Strict` mode bifurcation in chapter framing).
- [ ] Re-add initial `LT01` RC->SDM conversion card (pilot mappings for coins/gems/jewelry/special/magic) in visible chapter text.
- [x] Create SDM-numbered canonical treasure chapter: `Synthetic_Dream_Machine_05_Gear_Index.md#sdm-loot-and-treasure`.
- [x] Set FTLS 09 as BECMI spiritual-successor overlay grounded on SDM canonical treasure chapter.
- [x] Integrate results back into `_todo/TODO_BECMI_Conversion.md` once pass is complete.
- [x] Add Coin Mix `SDM Economy Weirdness` table (`1-3 Expected / 4-5 Surprising / 6 Error`) with concept references.
- [x] Rework gem/jewelry handling tables to runnable dice procedures (`d6` condition, `d100` grade + `2d6` size/quality, `d6 x d10` form + price bands).
- [x] Fix LT04 fence-row cross-link (`Step 6` -> `Step 5`) to remove anchor drift.
- [x] Add `Treasure Table H` specific magic-item generation packet (RC-family cadence -> SDM+ source resolution) and `Pre-Rolled Opposition Use` pass.
- [ ] Convert RC Ch.16 Treasure Type letter tables (`Treasure in Lair` / `Treasure Carried`) into optional LT01/LT02 generation mode.
- [ ] Convert RC gem/jewelry value + damage handling into optional LT01/LT04 modifiers.
- [x] Convert RC `Cashing Treasure` procedure (fee bands, town liquidity limit, refusal/fallback buyers) into LT04 overlay panel.
- [ ] Convert RC magical item sale guidance into explicit LT04 optional procedure (buyer search cadence and offer bounds).
- [ ] Expand magical-item buyer-search economics beyond current overlay (collector/faction/auction pathing and obligations).
- [ ] Convert BECMI set-level treasure procedures (Basic/Expert/Companion/Master) into optional overlays where they differ from RC.
- [ ] Add one FTLS09 appendix mapping RC item/treasure families directly to current SDM tag schema and channel defaults.

## Detailed Source Notes (Reviewed)
- `RC Ch.16` gives the exact random treasure workflow we need to ingest:
  - `Random Treasure Checklist`
  - `Treasure Types Table: Treasure in Lairs` + `Treasure Carried`
  - `Average Treasure Values`
  - `Gems`, `Jewelry`, `Special Treasure`, and `Damaged` handling
  - `Cashing Treasure` procedure (fees, liquidity, refusal, fallback private buyer)
- `RC Ch.10` reinforces treasure realization behavior (`XP from actual value kept/sold`) and flags magical-item sale XP as restricted; this matters for anti-abuse notes even though LT05 is out of current scope.
- `Basic Set` contributes old-school referee cadence we can optionally preserve:
  - `Random Treasures`, `Placed Treasures`, `Adjusting Treasure`, `Other Treasure Types`, `Average Treasure Values`
- `Expert Set` reinforces wilderness/unguarded treasure placement rhythm and references Basic treasure type usage.
- `Companion Set` adds practical economy procedure language:
  - `Cashing Normal Treasures`
  - `Planning and Placing Treasure` with explicit encumbrance awareness and coin->gem/jewelry value densification guidance.

## Next Steps: RC/BECMI Item Tables and Procedures (Detailed Plan)
1. `Phase 0 - Integrity + Framing Hygiene`
   - Keep one spiritual-successor chapter flow; avoid adding parallel mode framing.
   - Deliverable: clean internal anchors + consistent single-flow procedure text.

2. `Phase A - RC Table Ingestion` (`LT01`, `LT02`)
   - Build RC letter-table overlays as optional inserts in `FTLS 09`, not a replacement for SDM-first defaults.
   - Inputs: `Treasure Type letter(s)`, `context (lair vs carried)`, `area level band`, `area tags`.
   - Translate RC table outputs into SDM lot records: `Family`, `Tags`, `Base Value (cash)`, `Bulk (sp/st/sk)`, `Risk hooks`.
   - Handle both Part 1 coin results and Part 2 (`gems`, `jewelry`, `special`, `magic`) in one pass.
   - Deliverable: Appendix mapping `RC Treasure Type letter -> FTLS09 LT01/LT02 steps`.

3. `Phase B - Gem/Jewelry/Special Value Layer` (`LT01`, `LT04`)
   - Baseline FTLS tables now exist (`C/D/E/F`); add optional RC-strict overlays on top rather than replacing default tables.
   - Implement RC value overlay pipeline:
     - Gem Value table
     - Variable size/quality adjustments
     - Damaged gems/jewelry value loss
     - Special Treasure value table
   - Add batch-roll guidance (grouped gem/jewelry rolls) as a referee speed option.
   - Normalize results to SDM units and tags without breaking `1 cash = 1 silver`.
   - Deliverable: `RC Value Overlay` block with explicit conversion formulae.

4. `Phase C - RC Cash-Out Mode` (`LT04`)
   - Status: baseline implemented in `FTLS09 LT04 Overlay` (fees, liquidity cap, refusal/fallback, breakup loss, illicit heat coupling).
   - Remaining: optional short referee flowchart and advanced magical-item buyer-search economics.
   - Deliverable: finalize the `LT04 RC Cash-Out Mode` presentation polish + magical-item sale mini-loop.

5. `Phase D - BECMI Set-Level Deltas` (`LT01-LT04`)
   - Capture only meaningful deltas from Basic/Expert/Companion/Master:
     - unguarded/placed treasure cadence
     - adjust-treasure referee heuristics
     - encumbrance-aware conversion guidance (coins -> denser value items)
   - Keep these as optional overlays so RC remains the main BECMI baseline.
   - Deliverable: `BECMI Delta Notes` appendix (`source`, `delta`, `where applied in FTLS09`).

6. `Phase E - Documentation + QA`
   - Add explicit crosswalk tables:
     - `RC table row -> FTLS09 rule step`
     - `RC item family -> SDM tags + default channel`
   - Re-rate `LT01-LT04` after overlays land with one evidence block per principle.

## Acceptance Criteria for This Step
- Internal FTLS09 link hygiene passes (`Illicit lots` references resolve to the correct step anchor).
- FTLS09 keeps one spiritual-successor flow and uses optional RC overlay blocks (no mode bifurcation).
- `LT01`: referee can run one full RC letter-coded treasure result end-to-end in FTLS09 with no missing lookup step.
- `LT02`: hoard build supports RC carried/lair splits plus deterministic tie-break behavior.
- `LT03`: transport outcomes remain consistent after RC-value overlays are applied.
- `LT04`: referee can cash out gems/jewelry in three settlement sizes using explicit fee/liquidity/fallback rules.
- Crosswalk appendix exists and links every imported RC/BECMI procedure to a concrete FTLS09 section.
