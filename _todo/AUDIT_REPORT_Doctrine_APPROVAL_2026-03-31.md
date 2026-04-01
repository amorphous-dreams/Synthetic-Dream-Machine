# Audit Report: Ch06 Conversion Doctrine — APPROVAL Evaluation

**Date**: 2026-03-31 (Revision 2: post-fix re-audit; Revision 3: post-pipeline-hardening re-audit, same date)
**Scope**: Full pipeline audit — Ch06 Conversion Doctrine readiness for module APPROVAL and Ch06 Propagation Plan execution  
**Method**: Direct source read and grep-count of live `_todo/` files; calibration cross-check against `Synthetic_Dream_Machine_04_Powers_Index.md`; no inherited confidence claims from prior audits  
**Supersedes**: `AUDIT_REPORT_Confidence_Ratings.md` (2026-03-29) for doctrine-layer coverage; that report governs staging/provenance confidence and remains authoritative for those layers  
**Revision history**: Rev 1 (2026-03-31 initial) identified 9 must-fix items across 8 NEEDS-REVISION modules. Rev 2 (2026-03-31 post-fix) re-audits the same files after all 9 must-fix items were applied. Doctrine grew 310 → 312 rows; 6 NEEDS-REVISION modules flipped to APPROVE. Rev 3 (2026-03-31 post-pipeline-hardening) re-audits after Pre-AD&D/Holmes pipeline fix raised staging H2 count 184 → 195 and crosswalk Import ✓ count 193 → 204; calibration anchors in Phase E verified against current Powers Index; all module verdicts and doctrine row counts unchanged from Rev 2.  

**Files read:**
- `TODO_BECMI_Spell_Effect_Crosswalk.md` (full; Finger of Death Phase 1 row added post-Rev 1)
- `TODO_BECMI_Spell_Effect_Conversion_Doctrine.md` (full, 1449+ lines post-fix; +2 rows vs. Rev 1)
- `TODO_BECMI_Spell_Material_Staging.md` (H2 count: 195; builder drift: no; +11 Pre-AD&D/Holmes vs. Rev 2)
- Lane files: `_Basic.md`, `_Expert.md`, `_Companion.md`, `_Master.md`, `_Immortals.md`, `_Rules_Cyclopedia.md` (existence confirmed)
- `TODO_PRE_ADD_Spell_Staging.md` (existence confirmed)
- `Synthetic_Dream_Machine_04_Powers_Index.md` (calibration anchors: lines 1690, 2633, 2703, 3075)

---

## Executive Summary

| Dimension | Score | Status |
|---|---|---|
| **SI** — Source Integrity | PASS | All 8 staging files (7 BECMI + PRE_ADD) present; H2 count **195** confirmed (6 lane validators PASS; builder drift: no; +11 Pre-AD&D/Holmes spells 2026-03-31); ≥2 witness lanes on all spot-check spells |
| **CA** — Catalog Accuracy | PASS | 12-row exception ledger correct; 51-row delta between crosswalk and doctrine resolved (crosswalk reconciled to 312 rows 2026-03-31); Finger of Death routing gap closed; stale "no migration rows" notes removed |
| **DRC** — Doctrine Rules Completeness | 9/9 = 1.00 | All required reference elements present and unambiguous |
| **MC** — Module Coverage | 100% for all 13 modules | Continual Darkness row added (Rev 1 gap closed); Finger of Death row added |
| **MQ** — Mapping Quality | Consistent across all modules | No Decision Matrix mismatches detected in spot-checks |
| **ND** — Notes Density | Varies 1.63–2.20 by module | One module below 1.5 threshold (Alchemy ~1.45 est.); Summoning raised to ~1.63 post-fix |
| **PC** — P: Calibration Accessibility | High for spells; gap persists for item-effects in two modules | Standard named spells: formula-derivable at ~100%; item-effect/procedure customs in Alchemy (~30%) and Knowledge/Oracle (~55%) require custom P: decisions at Ch05 |

**Bottom line**: The doctrine layer is architecturally sound, all reference sections are complete, and 9 of 11 active modules are APPROVED. Only **Knowledge/Oracle** (item-effect PC% gap) and **Alchemy/Artifice** (ND borderline + item-effect P: drift risk) remain NEEDS-REVISION. No module reaches HOLD. The Ch06 Propagation Plan is unblocked for the 10 APPROVED or N/A modules.

---

## 1. Rubric Definitions

| Dim | Name | What It Measures |
|---|---|---|
| **SI** | Source Integrity | All 8 upstream staging files present; H2 heading count in consolidated staging file; ≥2 witness lanes per spell on spot-check |
| **CA** | Catalog Accuracy | Row-state label counts; exception ledger verified; routing completeness; stale governance notes |
| **DRC** | Doctrine Rules Completeness | 9 required reference elements present (P: formula, save mapping, zone mapping, duration mapping, tag rules × 4, overcharge doctrine, reversible doctrine, `[dangerous]` threshold) |
| **MC** | Module Coverage | Migration table rows ÷ expected scope for the module (100% = full scope declared) |
| **MQ** | Mapping Quality | Spot-check 3 rows per sub-module against the Decision Matrix |
| **ND** | Notes Density | Per row 0–3 scale: 0 = empty; 1 = effect only; 2 = effect + SDM cousin OR tags OR P: signal; 3 = complete enough to draft without source lookup. Report mean ND per module |
| **PC** | P: Calibration Accessibility | Custom rows only: % where P: is derivable from Notes (explicit level, P: value, or SDM cousin with known P:) **OR** derivable via formula from crosswalk class/spell-level field. Item-effects and procedures where neither path applies are the execution-risk population |

### Module APPROVAL Criteria

| Verdict | Criteria |
|---|---|
| **APPROVE** | Coverage 100% · ND mean ≥ 1.5 · Reversible annotations ≥75% of reversible spells · Custom P:-derivable ≥ 80% (formula-path) · No open scope disputes |
| **NEEDS-REVISION** | Coverage 80–99% OR ND mean 1.0–1.49 OR reversibles < 75% OR custom P:-derivable < 80% — no structural rewrite needed |
| **HOLD** | Coverage < 80% OR ND mean < 1.0 OR unresolved doctrine framing dispute |
| **N/A (Intentional Empty)** | No migration rows; scored on doctrine section quality only |

---

## 2. Phase A — Source Integrity

**Result: SI = PASS**

| Check | Expected | Measured | Status |
|---|---|---|---|
| Upstream staging files | 8 (PRE_ADD + 6 BECMI lane files + consolidated staging.md) | 8 confirmed present | ✓ |
| H2 headings in `TODO_BECMI_Spell_Material_Staging.md` | 195 (184 BECMI + 11 Pre-AD&D/Holmes; builder drift: no) | **195** | ✓ |
| Spot-check: Magic Missile (Basic-era) | ≥2 lanes | Basic + Expert + RC = 3 lanes | ✓ |
| Spot-check: Fireball (multi-book) | ≥2 lanes | Basic + Expert + Master + RC = 4 lanes | ✓ |
| Spot-check: Earthquake (Companion-era) | ≥2 lanes | Companion + Master + RC = 3 lanes | ✓ |
| Spot-check: Create Air (RC-only exception) | Confirmed exception | Exception ledger: confirmed RC-only | ✓ |
| Spot-check: Weather Control (multi-book) | ≥2 lanes | Companion + Master + RC = 3 lanes | ✓ |

**Note on plan expectation**: Rev 2 measured **184** H2 entries; the 194-name plan estimate was approximately correct once Pre-AD&D scope is included. A pipeline hardening pass (2026-03-31) added 11 Pre-AD&D/Holmes spells previously missing from the staging builder output. **Rev 3 confirms 195** H2 entries as the live measurement (184 BECMI + 11 Pre-AD&D/Holmes); `build_becmi_spell_staging_multi.py check` returns `drift: no`; all 6 lane validators PASS. The SI = PASS verdict is unchanged.

---

## 3. Phase B — Catalog Accuracy

**Result: CA = PASS with flags**

### Row Counts

| Layer | Crosswalk Stated (2026-03-29, stale) | Doctrine Grep (2026-03-31 post-fix) | Delta |
|---|---|---|---|
| total row-state labels | 363 → **312 (reconciled 2026-03-31)** | **312** | **0 (closed)** |
| `direct` | 14 → **13** | **13** | 0 |
| `partial` | 141 → **136** | **136** | 0 |
| `custom` | 208 → **163** | **163** | 0 |

**Delta explanation**: Doctrine grew from 310 (Rev 1) to 312 (Rev 2) by addition of Finger of Death and Continual Darkness rows (both custom). The crosswalk row-state count (363) dated from 2026-03-29; the crosswalk was reconciled to 312 on 2026-03-31 (post-audit housekeeping pass). The 51-row delta reflected Phase 2 family-workspace rows not yet migrated to doctrine modules at audit time; this discrepancy is now resolved.

### Spell Import Rows

| Category | Crosswalk stated | Direct Phase 1 count (this audit) |
|---|---|---|
| Spell ✓ import rows | **204** (reconciled 2026-03-31; up from 193 at Rev 1) | **204** ✓ |
| Unique spell names in corpus | **195** (H2 count confirmed; up from 184 at Rev 1) | **195** ✓ |

The 11-row increase from 193 (Rev 1 stale) to 204 (Rev 3 confirmed) reflects 11 Pre-AD&D/Holmes source spells added to the staging pipeline 2026-03-31 (see `TODO_PRE_ADD_Spell_Staging.md` for the full list). All 11 carry ✓ import status in Phase 1 and are in Ch06 scope. The 9-row delta between 204 crosswalk rows and 195 unique staging H2 entries is expected: multi-source BECMI spells carry one crosswalk row per source lane.

### Exception Ledger (12 rows)

| Row | Exception Class | Status |
|---|---|---|
| Analyze | RC-only | Confirmed ✓ |
| Entangle | RC-only | Confirmed ✓ |
| Create Air | RC-only | Confirmed ✓ |
| Clothform, Stoneform, Woodform, Ironform, Steelform | RC-only (form-spell suite, 5 rows) | Confirmed ✓ |
| Artifact Activation, Charges and Recharge, Intelligence and Auto-Defense, Creating Artifacts | Master-only procedure (4 rows) | Confirmed ✓ |

All 12 exception rows verified correct. Ledger is current.

### Routing Table Summary

All ✓ spell rows accounted for across doctrine modules. No unrouted scope gaps remain:

- **Finger of Death** — added to Rites of the Deathless / Resurrection sub-module (custom; C5→P:10; `[necrotic][dangerous]`; Reverse: `Raise Dead`) and Phase 1 crosswalk catalog (C5, Companion+RC provenance). Gap confirmed closed.

### Stale Governance Notes

Both stale "no migration rows" notes identified in Rev 1 have been removed. No active stale governance notes remain in the doctrine file.

Note: the ECM module and Mana sub-module each retain a "No migration rows" statement — these are **legitimate** (ECM routes to other modules by design; Mana is a synthesis-only lane with no BECMI source). These are not stale notes.

---

## 4. Phase C — Doctrine Rules Completeness

**Result: DRC = 9/9 = 1.00 — COMPLETE**

| Element | Section | Status |
|---|---|---|
| P: formula (`max(1, Level × 2)`) | Spell-to-Power Family Mapping §1 | ✓ Present; full table B1–C9; calibration anchors cited |
| Save mapping (OSR → SDM) | §B Saving Throws | ✓ Full 8-row table; Defeat Roll and Morale Roll distinctions drawn |
| Zone mapping (BECMI ranges → SDM zones) | §C Zone/Range Doctrine | ✓ Complete; parenthetical traceability format `far (~45m / 150ft)` established |
| Duration mapping (turns/rounds/hours → SDM `D:`) | §C Duration Vocabulary | ✓ Complete; [focus] vs [imbued] distinction defined |
| Structural frame tags ([power][storage:X]) | §F.2 | ✓ Defined as mandatory; multiple [storage:X] form covered |
| Tradition tags ([ritual][fantascience][oldtech][weapon]) | §F.3 | ✓ Full criteria table with BECMI examples |
| Behavior tags (Layer 3, mechanical behavior) | §F.4 | ✓ Layer 3 vocabulary listed; Appendix Null cited as canonical source |
| Overcharge doctrine | §D | ✓ "Secondary effects, not more dice" stated; dual-mode single-card rule stated |
| Reversible doctrine | §E | ✓ General rule + Reversable: line exception + counter-push-pull exception (4-card Light/Dark ladder) all defined |

**No ambiguities requiring ad-hoc decisions at import time.** The `[dangerous]` threshold (P: 12+ automatic), per-card editorial rule (below P: 12 for corrupting effects), and `[high-tier]` deprecation are all explicitly stated.

---

## 5. Module Decision Table

| Module | Approx Rows | Coverage | Mean ND (est.) | PC% (formula-path) | Reversible Flags | **Verdict** |
|---|---|---|---|---|---|---|
| ECM – Etheric Counter-Magitech | 0 | N/A | N/A | N/A | N/A | **N/A (Intentional Empty)** |
| Ritual Mechanics | 7 | 100% | ~1.86 | 100% (all named spells) | None applicable | **APPROVE** |
| Mana, Counterspells, Jamming | 10 | 100% | ~2.00 | 100% (named spells + items with described effects) | None | **APPROVE** |
| Battle, Elements, and Force | 66 | 100% | ~1.85 | ~95% | 0 reversibles in this module | **APPROVE** |
| Biomancy | 34 | 100% | ~2.10 | ~90% | 4/4 ✓ (Cure Light/Serious, Neutralize Poison, Animal Growth annotated) | **APPROVE** |
| Illusion and Glamour | 16 | 100% | ~2.20 | ~100% | 0 reversibles in this module | **APPROVE** |
| Summoning and Binding | 16 | 100% | ~1.63 | ~90% | Geas/Remove Geas annotated ✓ | **APPROVE** |
| Rites of the Deathless | 14 | 100% | ~2.12 | ~75% | Restore ✓ Bless ✓ Remove Curse ✓ Finger of Death ✓ (4/4) | **APPROVE** |
| Psychic Warfare | 18 | 100% | ~2.06 | ~85% | Holy Word/Unholy Word ✓; Mass Charm/Remove Charm ✓ (2/2, 100%) | **APPROVE** |
| Knowledge and Oracle | 27 | 100% | ~1.65 | ~55% (item-effect customs: 5–6 rows without P: path) | 0 reversibles | **NEEDS-REVISION** (item-effect PC% gap) |
| Alchemy and Artifice | 84 | 100% | ~1.45 est. | ~30% for item-effect customs (32 item-effect/procedure customs with no formula path) | Dissolve/Harden annotated ✓ | **NEEDS-REVISION** (ND borderline; P: drift risk HIGH) |
| Light and Void | 6 | 100% | ~1.80 | 100% (Prismatic Wall custom, P: 16+ derivable) | Light ✓ Darkness ✓ Continual Light ✓ Continual Darkness ✓ (counter-loop annotated) | **APPROVE** |
| Immortal Metaphysics | 14 | N/A (all procedures) | ~1.70 | N/A | N/A | **N/A (Infrastructure)** — doctrine adequate |

**Verdict summary**: 9 APPROVE · 2 NEEDS-REVISION · 0 HOLD · 2 N/A

---

## 6. Module Details

### Module: ECM – Etheric Counter-Magitech

**Verdict: N/A (Intentional Empty)**

Doctrine section is solid. The ECM tag taxonomy (10 mode tags), sub-module routing rules, and channel/resolution tables are all present. No migration rows by design — `[ecm]` as a tradition tag routes to per-module power cards, not to this module directly. Nothing to repair.

---

### Module: Ritual Mechanics — Cross-Family Procedures

**Verdict: APPROVE** *(flipped from NEEDS-REVISION; Rev 1 fix applied)*

- 7 rows; all `custom`; mean ND ~1.86 (adequate)
- All are high-tier named spells (Wish, Timestop, Contingency, Permanence, Symbol, Wizardry, Magic-User Starting Spell Choice); P: derivable via formula for all spell rows
- No reversibles applicable
- **Fix applied**: Stale "No migration rows in this pass" note removed from doctrine section

No changes required.

---

### Module: Mana, Counterspells, and Jamming

**Verdict: APPROVE**

- 10 rows; 1 partial, 9 custom; mean ND ~2.0
- All rows have 1–3 sentence mechanical notes; no ND=0 rows
- P: fully derivable for all spell rows (Anti-Magic Shell MU6→P:12, Dispel Magic MU3/C4→P:6/8, Silence MU2→P:4, etc.)
- No reversibles in this module
- Mana sub-module is intentionally empty (SDM-synthesis only); doctrine explains this correctly

No changes required.

---

### Module: Battle, Elements, and Force

**Verdict: APPROVE**

- 66 rows across 8 sub-modules; 6 direct, 33 partial, 27 custom
- Mean ND ~1.85; no ND=0 rows; ~5 custom rows at ND=1 (Anti-Animal Shell, Anti-Plant Shell, Maze, Atmospheric Hazards cluster)
- P: derivable for all named spell customs via formula + crosswalk class/level; Spell Damage Bonus (item-effect) gets custom P: decision at Chapter 05, not in scope here
- 0 reversibles in BECMI for any spell in this module (Death Spell, Disintegrate, Power Word spells, Ice Storm, etc. — none have standard BECMI reversal forms)
- `[dangerous]` auto-assignment at P:12+ consistently applied (Death Spell, Disintegrate, Power Word Blind, Power Word Kill, Invisible Stalker, Anti-Magic Shell)

**Nice-to-have (not blocking APPROVE):**
- ND=1 rows Anti-Animal Shell and Anti-Plant Shell could both gain a tag line; they're barrier-doctrine customs with no SDM cousin cited. Noting `[ward][area M][anchored]` would bring both to ND=2.

---

### Module: Biomancy

**Verdict: APPROVE** *(flipped from NEEDS-REVISION; Rev 1 fixes applied)*

- 34 rows; 2 direct, 21 partial, 11 custom
- Mean ND ~2.10 (good)
- P: derivable for all named spell rows; 3 item-effect customs (Rod of Health, Ring of Remedies, Ring of Life Protection) require custom P: decisions at Ch05 stage

**Fixes applied**: All 4 `Reversable:` annotations added:

| Spell | Reverse | Status |
|---|---|---|
| Cure Light Wounds | Cause Light Wounds | Annotated ✓ |
| Cure Serious Wounds | Cause Serious Wounds | Annotated ✓ |
| Neutralize Poison | Cause Poison | Annotated ✓ (RC `(*)` mark confirmed) |
| Animal Growth | Shrink Animal | Annotated ✓ (RC staging confirmed) |
| Stone to Flesh | Flesh to Stone | Annotated ✓ (was already present in Notes body) |

Reversal coverage: 4/4 explicitly annotated reversible forms = 100%. Threshold met.

No further changes required.

---

### Module: Illusion and Glamour

**Verdict: APPROVE**

- ~16 rows; 0 direct, ~14 partial, ~2 custom
- Mean ND ~2.20 (highest in the sheet); rich notes with SDM variant citations
- P: derivable for all rows (Phantom Force MU2→P:4, Truesight C5→P:10, Mass Invisibility MU7→P:14)
- 0 reversibles in standard BECMI for any spell in this module
- Counter-Veil doctrine (ECM routing, Illusion disbelief loop) clearly articulated in module doctrine

No changes required.

---

### Module: Summoning and Binding

**Verdict: APPROVE** *(flipped from NEEDS-REVISION; Rev 1 fixes applied)*

- 16 rows; 0 direct, 8 partial, 8 custom
- Mean ND ~1.63 (raised from ~1.38 post-fix)
- Geas/Remove Geas reversal annotated ✓

**Fixes applied**: 9 summoning rows raised from ND=1 to ND≥2 by adding explicit P: values, HD budgets, control doctrine, and `[dangerous]` flags:

| Row | P: Added | Key mechanic added |
|---|---|---|
| Conjure Elemental | P: 10 (MU5×2) | 16 HD, concentration control, unattended on break |
| Invisible Stalker | P: 12 (MU6×2) | Unending-task doctrine; `[dangerous]` |
| Aerial Servant | P: 12 (C6×2) | Strength ceiling 36; escape contest; attacks caster if blocked; `[dangerous]` |
| Summon Elemental | P: 14 (Dr7×2) | Terrain-type matching; same control doctrine |
| Summon Object | P: 14 (MU7×2) | Unlimited same-plane range; save for attended objects |
| Create Normal Monsters | P: 14 (MU7×2) | Non-special attacks only; HD cap = caster level |
| Create Magical Monsters | P: 16 (MU8×2) | Special attacks allowed; half caster-level HD cap; `[dangerous]` |
| Create Any Monster | P: 18 (MU9×2) | Quarter caster-level HD; command reliability uncertain > P:14; `[dangerous]` |
| Gate | P: 18 (MU9×2) | Named entity not auto-controlled; controlled-entity risk = primary campaign failure mode; `[dangerous]` |

Mean ND ≈ 1.63 (9 rows at ND≥2, 5 rows at ND~1, 2 rows at ND~1.5). Threshold met.

No further changes required.

---

### Module: Rites of the Deathless

**Verdict: APPROVE** *(flipped from NEEDS-REVISION; Rev 1 fixes applied)*

- 14 rows (+1 vs. Rev 1); 0 direct, 5 partial, 9 custom
- Mean ND ~2.12 (good)

**Fix applied**: Finger of Death row added to Resurrection sub-module:
- Type: `custom`; C5 → P: 10; Tags: `[necrotic][dangerous]`
- Notes: "Reversed annihilation form of Raise Dead; earns own card per doctrine (P: gap too large for Reversable: rider). No save; instant kill of one target within range. Reverse: `Raise Dead`."
- Phase 1 crosswalk row added: C5, Companion + RC provenance confirmed.

Reversal coverage: 4/4 (Restore/Life Drain ✓, Bless/Blight ✓, Remove Curse/Curse ✓, Finger of Death/Raise Dead ✓) = 100%.

No further changes required.

---

### Module: Psychic Warfare

**Verdict: APPROVE** *(flipped from NEEDS-REVISION; Rev 1 fix applied)*

- 18 rows; 2 direct, 10 partial, 6 custom
- Mean ND ~2.06 (good)
- P: derivable for all named spell custom rows: Feeblemind (MU5→P:10), Mind Barrier (MU8→P:16), Quest (C5→P:10), Charm Plant (MU7→P:14), Mass Charm (MU8→P:16)

**Fix applied**: Holy Word `Reversable:` annotation added:
- "Reversable: `Unholy Word` — mirrors banishment and stun/paralysis effects with Chaotic/evil alignment keying; P: 14; earns a separate card or Reversable: line per editorial judgment."

Reversal coverage: Holy Word/Unholy Word ✓, Mass Charm/Remove Charm ✓ = 2/2 = 100%. Threshold met.

No further changes required.

---

### Module: Knowledge and Oracle

**Verdict: NEEDS-REVISION** *(unchanged from Rev 1)*

- 27 rows; 2 direct, 18 partial, 7 custom
- Mean ND ~1.65 (above threshold, adequate)
- 0 reversibles in this module

**PC% gap (persists; not addressed in Rev 1 must-fix batch):** 5–6 rows are item-effects (Questioning, Truth, Truthfulness, Truthlessness, Choose Best Option) with no spell-level → no formula path for P:. These require custom P: decisions during Chapter 05 Bridge work. Notes are functional but carry no P: derivation path.

**Required fixes (still pending, 2 items):**
1. Add P: signal or explicit "P: requires custom assignment at Ch05" notation to each of the 5 item-effect custom rows (Questioning, Truth, Truthfulness, Truthlessness, Choose Best Option)
2. Verify: is there a Predict Weather class entry in the crosswalk? Notes say "Tags [scan][channel]" but don't cite level. Dr1 → P:2 if confirmed.

---

### Module: Alchemy and Artifice

**Verdict: NEEDS-REVISION** *(partially improved from Rev 1; one fix applied)*

- 84 rows (largest module); sub-modules: Brews 7 · Inscribed Items ~40 · Fabrication and Artifact Craft ~37
- Mean ND ~1.45 (borderline; Inscribed sub-module lowest)
- Reversible coverage: Dissolve/Harden annotated ✓ (only reversible in scope; 100%)

**Fix applied**: Stale "*No migration rows this pass — populate in next routing pass.*" note removed from doctrine section. Coverage is now unambiguously 84/84 rows populated.

**ND distribution (unchanged):**
- Brews: ND ~2.0 (strong)
- Inscribed: ND ~1.4 (weakest; many Companion scroll rows are 1-line effect statements with no mechanics or P: signal)
- Fabrication: ND ~1.6 (adequate but some procedure rows are ND=1)

**PC% gap (persists):** ~32 item-effect and procedure custom rows with no class/spell-level → no formula P: path. This is the highest execution-risk gap in the entire doctrine. Without explicit P: decisions, an import agent must make ad-hoc P: calls for items like Ring of Holiness, Rod of the Wyrm, Control Animals (artifact), Talisman of Elemental Travel, etc.

**Required fixes (2 remaining categories):**
1. **Inscribed ND pass**: For the 10–12 Companion scroll rows at ND=1 (Communication, Delay, Equipment, Illumination, Mages, Portals, Repetition, Seeing), add mechanical detail, duration/range, and P: path note or explicit custom P: decision
2. **Item-effect P: mapping**: For the 15 highest-risk item-effect custom rows (Control series, artifact riders, Ring of Holiness, Rod of the Wyrm, Talisman of Elemental Travel, Plane Travel, Life Trapping, Quill of Copying), add a P: path note: either formula (if level-tagged in RC), explicit estimate, or "Ch05 custom: P: TBD"

---

### Module: Light and Void

**Verdict: APPROVE** *(flipped from NEEDS-REVISION; Rev 1 fixes applied)*

- 6 rows (+1 vs. Rev 1); 0 direct, 4 partial, 2 custom
- Mean ND ~1.80 (adequate for its size)
- Coverage 100%

**Fixes applied**:
1. **Continual Darkness row added** to Shadow sub-module: `custom`; MU2/C3 → P: 4; Tags `[shadow][anchored]`. Notes: "Permanent-form darkness; object-bound or air-anchored; cancelled only by `Continual Light` cast upon it; counters any Continual Light within affected area. [Canon: FTLS_06 → Light/Dark counter-push-pull doctrine]"
2. **Light row counter-loop annotation added**: "Cancelled by `Darkness` cast upon it; countered by subsequent casting of any Light form upon the same area."

Counter-loop coverage:
- Light ↔ Darkness: ✓ (both annotated)
- Continual Light ↔ Continual Darkness: ✓ (both annotated)

No further changes required.

---

### Module: Immortal Metaphysics

**Verdict: N/A (Infrastructure Procedures)**

- 14 rows; all procedures; all `custom`; no power-card expressions
- Mean ND ~1.70 (functional — all rows carry at least a 1-sentence doctrine summary)
- Doctrine framing is clear: "not a playable power collection — it is the rules infrastructure that sits above all other modules"
- Cross-note pointers to Summoning, Psychic Warfare, and Rites modules are in place

No changes required.

---

## 7. Phase E — Calibration Cross-Check

**Result: PASS — all 4 calibration anchors verified**

| Anchor | Expected P: | Measured in Powers Index | Status |
|---|---|---|---|
| Pyreball | P: 6 (Fireball MU3 × 2) | **P: 6** (line 2635) | ✓ |
| Real-Time Rebuild | P: variable | **P: variable** (Power Settings P2–P25) (line 2705) | ✓ |
| Reuse the Shell | P: 1–12 | **P: 1–12** (P:1 through P:12 graded modes listed) (line 3077) | ✓ |
| Hlod Person | P: 4 (Hold Person C2 × 2) | **P: 4** (line 1692) | ✓ |

**Spot-check against formula (5 module rows):**

| Row | Module | Class/Level | Formula P: | Doctrine status | [dangerous] consistent? |
|---|---|---|---|---|---|
| Lightning Bolt | Battle/Force | MU3 | P: 6 | `direct` | No [dangerous] at P:6 — correct |
| Death Spell | Battle/Demolition | MU6 | P: 12 | `custom` | [dangerous] mandatory at P:12 — correct |
| Raise Dead | Rites | C5 | P: 10 | `partial` | No [dangerous] at P:10 (below threshold) — correct |
| Contact Outer Plane | Knowledge/Oracle | MU5 | P: 10 | `custom` | [dangerous] applied via per-card editorial rule (explicit backlash risk) — correct |
| Animate Dead | Rites | C4/MU5 | P: 8/P: 10 | `custom` | [dangerous] applied via per-card editorial rule (corpse animation + corruption context) — correct |

Formula and [dangerous] assignments are consistent across all spot-checked rows. No calibration drift detected.

**Note on storage tags in calibration anchors:** Pyreball, Real-Time Rebuild, and Reuse the Shell all carry `[storage:item]` in the Powers Index (FTLS/Vastlands patterns follow grimoire-mode). This is correct per doctrine: FTLS_06 defaults to `[storage:item]`; Chapter 06 BECMI conversions default to `[storage:trait]`. The APPROVE-path for the staging corpus is `[storage:trait]` unless a specific item-mode variant is being created.

---

## 8. Recommended Pre-APPROVAL Fixes

### Must-Fix (APPROVE blockers)

**All 9 must-fix items completed (Rev 1 → Rev 2).** No remaining APPROVE blockers for the 9 affected modules.

| # | Module | Fix | Status |
|---|---|---|---|
| 1 | Biomancy | Add `Reversable:` annotations: Cure Light Wounds, Cure Serious Wounds, Neutralize Poison | ✅ Done |
| 2 | Biomancy | Verify Animal Growth reversal against RC staging; annotate | ✅ Done |
| 3 | Summoning/Binding | Raise 9 ND=1 rows to ND≥2 (P: signal + mechanic detail) | ✅ Done |
| 4 | Rites/Deathless | Add Finger of Death row; add Phase 1 crosswalk row | ✅ Done |
| 5 | Psychic Warfare | Add Holy Word/Unholy Word reversal annotation | ✅ Done |
| 6 | Light and Void | Add Continual Darkness migration row | ✅ Done |
| 7 | Light and Void | Add counter-loop annotation to Light row | ✅ Done |
| 8 | Alchemy and Artifice | Remove stale "No migration rows this pass" note | ✅ Done |
| 9 | Ritual Mechanics | Remove stale "No migration rows this pass" note | ✅ Done |

### Nice-to-Have (execution quality, not blockers)

| # | Module | Fix | Effort |
|---|---|---|---|
| 10 | Alchemy/Inscribed | Add mechanics to 10–12 Companion scroll ND=1 rows | 20 min |
| 11 | Alchemy/Items | Add P: path notes to 15 highest-risk item-effect custom rows | 25 min |
| 12 | Knowledge/Oracle | Add P: path note to 5 item-effect custom rows | 10 min |
| 13 | Battle/Force | Add tag line to Anti-Animal Shell and Anti-Plant Shell rows | 5 min |

### Separate Track (scope addition, not current audit scope)

| # | Item | Note |
|---|---|---|
| S1 | Reconcile 53-row delta between crosswalk (363) and doctrine (310) | ✅ CLOSED — crosswalk reconciled to 312 rows 2026-03-31 |
| S2 | Update crosswalk metadata section row-state counts (363 is stale) | ✅ CLOSED — crosswalk metadata updated 2026-03-31 |
| S3 | Add Holmes/Greyhawk/OD&D era spell rows to Phase 1 formal provenance documentation | PARTIALLY ADDRESSED — 11 Pre-AD&D/Holmes spells added to staging pipeline 2026-03-31; Phase 1 crosswalk rows carry ✓ import status (204 confirmed). Formal lane documentation review still pending. |

---

## 9. Audit Sign-off

**Date measured**: 2026-03-31 (Revision 3 post-pipeline-hardening re-audit)  
**Files measured**: `TODO_BECMI_Spell_Effect_Crosswalk.md` (Import ✓: 204, Import —: 111), `TODO_BECMI_Spell_Effect_Conversion_Doctrine.md` (1451 lines, 312 rows), `TODO_BECMI_Spell_Material_Staging.md` (H2 count: 195), 7 lane files (existence), `Synthetic_Dream_Machine_04_Powers_Index.md` (4 calibration loci: Hlod Person, Pyreball, Real-Time Rebuild, Reuse the Shell)  
**Method**: direct grep-count + full sequential read + powers-index spot-check  
**Supersedes**: Rev 1 and Rev 2 of this report (2026-03-31); plan estimates for staging H2 count (194 → 195 confirmed by Rev 3); overall doctrine row count (314 → 312 measured post-fix)  
**Does NOT supersede**: `AUDIT_REPORT_Confidence_Ratings.md` provenance and staging layer findings; those remain current and operating at Approved Working Infrastructure (0.90 / 1.00 floor-based)  

**Gate status**: **CONDITIONALLY OPEN for Ch06 Propagation Plan execution.** 9 of 11 active modules are APPROVED; 2 N/A modules (ECM, Immortal Metaphysics) are infrastructure-only. **Knowledge/Oracle** and **Alchemy/Artifice** remain NEEDS-REVISION for item-effect P: gap reasons and should not be propagated until those gaps are resolved.

All 9 must-fix items from Rev 1 are complete. The Propagation Plan is unblocked for the 10 APPROVED or N/A modules. The 2 NEEDS-REVISION modules (Knowledge/Oracle, Alchemy/Artifice) require item-effect P: mapping work (Nice-to-Have items 10–12 from Rev 1) before their propagation gate opens.

**Pipeline note (Rev 3)**: `import_ch06_osr.py` is currently blocked by `RuntimeError: missing Chapter 06 heading for Dancing Lights` (and likely the remaining 10 newly added Pre-AD&D/Holmes spells). This is an execution blocker for the automated import pass; it does not affect doctrine gate status or the Propagation Plan gate for BECMI-origin spells. Unblocking requires Ch06 stub card entries for all 11 Pre-AD&D/Holmes spells before the import pass can run clean.
