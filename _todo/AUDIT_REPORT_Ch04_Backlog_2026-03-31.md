# Re-Audit: Chapter 04 Backlog / Work-State
**Date**: 2026-03-31
**Scope**: direct measurement of live `Synthetic_Dream_Machine_04_Powers_Index.md`, `_todo/TODO_SDM_Powers_Index.md`, `_todo/TODO_BECMI_Spell_Effect_Crosswalk.md`, and `_todo/TODO_BECMI_Spell_Effect_Conversion_Doctrine.md`
**Method**: source-derived only; no confidence claims inherited from prior audit prose

---

## Executive Summary

This re-audit was prompted by structural changes since the last all-systems audit (2026-03-29). The crosswalk and doctrine files underwent significant migration surgery — Phase 2 family mapping rows moved out of the crosswalk into the doctrine’s Module/Migration-Tables architecture — resulting in stale governance claims in both files. The Chapter 04 itself is in excellent shape.

Current measured state by layer:

1. **Chapter 04 (Powers Index)**: unchanged and clean. 112 entries, QA tracking parity confirmed, mean confidence 0.996875 by direct arithmetic, all doctrine calibration anchors verified against live file. Minor cosmetic encoding discrepancy in 21 entry names (apostrophe variant) does not affect use.

2. **Crosswalk**: structurally simplified — Phase 2 rows removed, Phase 1 catalog grown (+10 spell rows). Governance section still claims counts from the old structure. Evidence lock markers are **no longer present in the workspace** — they lived in the deleted Phase 2 family tables and were not migrated. The Evidence-Note Density gate claim (≥50 markers, 1.00 rating) is now inaccurate.

3. **Doctrine**: 13 modules fully populated with migration tables, ALL STATUS: DRAFT. 310 mapped rows (down 52 from prior 362). Evidence markers were not carried over. Ch06 Propagation Plan is documented but requires operator APPROVED signal on all modules before execution begins.

4. **Import backlog**: unchanged and unstarted. All 194 unique spell names (formerly 184) show `osr: imported = -`. The Chapter 06 `osr:` import pass has not begun.

---

## Audit Method

Direct measurements only. No confidence claims carried from prior notes.

Sources read:
- `Synthetic_Dream_Machine_04_Powers_Index.md` (4544 lines)
- `_todo/TODO_SDM_Powers_Index.md` (136 lines)
- `_todo/TODO_BECMI_Spell_Effect_Crosswalk.md` (782 lines)
- `_todo/TODO_BECMI_Spell_Effect_Conversion_Doctrine.md` (1449 lines)

Scripts used: inline Python measurement — regex H2 counts, table row parsing, status label counts, apostrophe encoding check, calibration anchor extraction.

---

## Layer 1: Chapter 04 — SDM Powers Index

### Structural Measurement

| Metric | Measured | Prior Audit | Delta |
| --- | --- | --- | --- |
| Total H2 sections | 114 | n/a | — |
| Power entries (H2 minus template) | **112** | 112 | 0 |
| `osr:` blocks in power entries | 0 | 0 | 0 |
| `osr:` in template section only | 1 (line 161) | n/a | — |
| `pending verbatim extraction` | 0 | 0 | 0 |

### QA Tracking Parity

| Metric | Measured | Prior Audit | Delta |
| --- | --- | --- | --- |
| QA table rows | **112** | 112 | 0 |
| Live Ch04 powers | **112** | 112 | 0 |
| Entries at 1.00 | **105** | 105 | 0 |
| Entries at 0.95 | **7** | 7 | 0 |
| Entries at 0.90–0.94 | **0** | 0 | 0 |
| Entries below 0.90 | **0** | 0 | 0 |
| Exact arithmetic mean | **0.996875** | 0.996875 | 0 |

**Parity check result**: PASS — 91 names match exactly; 21 names differ only in apostrophe encoding (U+2019 right single quotation mark in QA table vs U+0027 ASCII apostrophe in Ch04 headings). These are the same 21 Nunka’s/Rehoryan’s/Runo’s/Stoyevod’s/Usha’s named powers. Functionally identical; cosmetic encoding variance only.

### 0.95-Rated Entries (Spot-Check)

All 7 entries verified present and well-formed in live Ch04:

| Entry | Rating | Justification (confirmed) |
| --- | --- | --- |
| Caustic Purification | 0.95 | Vastlands non-standard table format; canonicalized from row text |
| Cut the Sky | 0.95 | Vastlands non-standard table format |
| Ha-Ka-Ba Short Circuit | 0.95 | Vastlands non-standard table format |
| Lay in Wires | 0.95 | Vastlands non-standard table format |
| Sense Allegiance | 0.95 | Vastlands non-standard table format |
| Viridian Sun | 0.95 | Vastlands non-standard table format |
| Thornstone Obelisk | 0.95 | Synthesis: blends VLG statline with Magitecnica overcharge destruction clause |

All six Vastlands non-standard entries are standard power cards with correct P/R/T/D fields, flavor text, and body text. Rating is accurate.

### Doctrine Calibration Anchors (Verified)

The doctrine uses these Ch04 entries as P: calibration references. All confirmed against live file:

| Entry | Doctrine claim | Live Ch04 P: | Status |
| --- | --- | --- | --- |
| Pyreball | P: 6 (3rd-level × 2) | **P: 6** | ✓ VERIFIED |
| Real-Time Rebuild | P: variable | **P: variable** | ✓ VERIFIED |
| Reuse the Shell | P: 1–12 | **P: 1–12** | ✓ VERIFIED |
| Hlod Person | P: 4 (2nd-level × 2) | **P: 4** | ✓ VERIFIED |

### Chapter 04 Confidence Rating

**Re-rated: 0.997 (rounds to 1.00)**

Breakdown:
- Entry and QA parity: 1.00
- Confidence score accuracy: 1.00 (0.95 entries confirmed well-formed and accurately rated)
- Calibration anchor accuracy: 1.00 (all 4 anchors live at expected P: values)
- Encoding discrepancy (21 entries): cosmetic, does not affect operational use; no deduction warranted

**Chapter 04 is publication-ready for its current scope. No corrections needed.**

---

## Layer 2: Crosswalk — TODO_BECMI_Spell_Effect_Crosswalk.md

### Structural Migration Since Prior Audit

The crosswalk underwent substantial reduction. Phase 2 family mapping tables (the `family-1` through `family-13` workspace with 362 direct/partial/custom rows) were migrated into the Doctrine. The crosswalk now contains:

- Governance/provenance/confidence sections (unchanged)
- Exception State Ledger (12 rows — confirmed)
- Phase B Backlog documentation
- Reference sections (variant inventory, canonical doctrine, etc.)
- Phase 1 Catalog Workspace (Phase 1 execution tracker rows only)

### Phase 1 Catalog — Measured Counts

| Metric | Measured | Prior Audit | Delta |
| --- | --- | --- | --- |
| Total Phase 1 rows | **314** | 304 | +10 |
| Spell rows | **203** | 193 | +10 |
| Item-effect rows | **73** | 73 | 0 |
| Procedure rows | **38** | 38 | 0 |
| Unique spell names (✓ import) | **194** | 184 | +10 |
| Ch06 Import ✓ | **203** | 193 | +10 |
| Ch06 Import — | **111** | 111 | 0 |
| osr: imported = yes | **0** | 0 | 0 |
| osr: imported = - (not started) | **203** | 193 | +10 |

**New entries (+10 spell rows)**: Holmes/OD&D/Greyhawk-era spells added to Phase 1: `Dancing Lights`, `Darkness`, `Enlargement`, `Audible Glamer`, `ESP`, `Clairaudience`, `Magic Mouth`, `Pyrotechnics`, `Ray of Enfeeblement`, `Slow`, `Strength`. Also `Clairvoyance` and `Conjure Elemental` gained additional pre-RC lane evidence. The +10 unique names represent net new spell-import targets.

### Exception State Ledger — Measured

| Metric | Measured | Prior Audit | Delta |
| --- | --- | --- | --- |
| Exception rows | **12** | 12 | 0 |
| RC-only exceptions | **8** | 8 | 0 |
| Master-only procedure exceptions | **4** | 4 | 0 |

All 12 verified: Analyze, Entangle, Create Air, Clothform, Stoneform, Woodform, Ironform, Steelform (RC-only spells) and Artifact Activation, Artifact Charges And Recharge, Artifact Intelligence And Auto-Defense, Creating Artifacts (Master-only procedures). Status: confirmed and locked.

### Phase 2 Mapping Rows — Now in Doctrine

Phase 2 rows (direct/partial/custom) are no longer in the crosswalk. **0 direct/partial/custom rows measured in crosswalk**. These now live in the Doctrine’s Module Migration Tables (see Layer 3).

### Evidence Marker Crisis

| Metric | Measured (crosswalk) | Prior Audit | Delta |
| --- | --- | --- | --- |
| `Evidence lock:` markers | **0** | included in 56 | -56 |
| `Verification pass (` markers | **0** | included in 56 | -56 |
| `Evidence Checked Date` (column header only) | 1 | — | — |
| Total inline evidence markers | **0** | 56 | **-56** |

**Finding**: The 56 inline evidence markers that met the ≥50 gate were located in the old Phase 2 family workspace rows. Those rows were deleted when the Phase 2 tables migrated to Doctrine. The evidence annotations were NOT carried over to the Doctrine migration tables.

The current workspace contains **effectively zero inline evidence markers** outside the Exception State Ledger.

### Stale Governance Claims in Crosswalk

The Metadata Rubrics section of the crosswalk (lines ~100–148) still contains counts from the old structure:

| Claim in crosswalk | Measured reality | Status |
| --- | --- | --- |
| "363 explicit row-state labels: 14 direct, 141 partial, and 208 custom" | 310 rows in doctrine (13d/136p/161c) | **STALE** |
| "56 inline evidence lock/verification pass markers" | 0 in workspace | **STALE — markers lost** |
| "Row-State Coverage (1.00): 362 explicit status labels" | 310 in doctrine | **STALE** |
| "Evidence-Note Density (1.00): 56 audited markers; gate exceeded" | 0 in workspace | **STALE — gate unverifiable** |
| "12 exception rows confirmed" | 12 confirmed | **ACCURATE** |

### Crosswalk Confidence Re-Rating

Using the documented rubrics:

| Sub-score | Prior Rating | Re-Measured | Notes |
| --- | --- | --- | --- |
| Schema Capture | 1.00 | **1.00** | Table shapes present and consistent |
| Family Metadata Completeness | 1.00 | **N/A → 1.00** | Families replaced by Doctrine modules (13/13 with full doc) |
| Row-State Label Coverage | 1.00 | **1.00** | 310 rows in doctrine all carry explicit status labels |
| Evidence-Note Density | 1.00 | **FAILED** | Markers lost in migration; 0 in workspace; gate requires ≥50 |
| Downstream Drafting Readiness | 0.90 | **0.85** | Evidence markers gone; stale governance claims in rubrics; but import infrastructure is otherwise intact |

**Overall re-rate**: **0.85 / Minimum Viable** (not Approved Working Infrastructure until evidence markers are restored or rubrics updated to reflect current structure)

The crosswalk’s own documented threshold table says:
- Minimum Viable = 0.85: "Provenance verified; all rows have status labels; exception ledger exists; staging corpus frozen"
- Approved Working Infrastructure = 0.90: additionally requires "evidence-note density ≥50 markers"

Current state satisfies Minimum Viable but not the Approved Working Infrastructure gate as specified, because the evidence marker count is now 0.

**Operational judgment**: the Phase 1 catalog itself is clean and the exception ledger holds. The import work remains blocked on Ch06 alpha (by design). But the governance self-claim of 0.90 is now inaccurate and should be updated on the next pass.

---

## Layer 3: Doctrine — TODO_BECMI_Spell_Effect_Conversion_Doctrine.md

### Module Architecture — Measured

| Metric | Measured | Notes |
| --- | --- | --- |
| Total modules | **13** | All `### Module:` sections |
| Modules with STATUS: DRAFT | **13** | All |
| Modules with STATUS: APPROVED | **0** | Propagation Plan not triggered |
| Total migration table rows | **310** | Across all 12 modules with tables |
| Ritual Mechanics rows | **8** | Stubbed; 8 rows present but deferred |

Module row distribution:

| Module | Rows | direct | partial | custom |
| --- | --- | --- | --- | --- |
| ECM – Etheric Counter-Magitech | 7 | 0 | 0 | 7 |
| Ritual Mechanics — Cross-Family Procedures | 8 (stub) | — | — | — |
| Mana, Counterspells, and Jamming | 10 | 0 | 1 | 9 |
| Battle, Elements, and Force | 66 | 6 | 33 | 27 |
| Biomancy | 34 | 2 | 21 | 11 |
| Illusion and Glamour | 16 | 0 | 14 | 2 |
| Summoning and Binding | 16 | 0 | 8 | 8 |
| Rites of the Deathless | 13 | 0 | 5 | 8 |
| Psychic Warfare | 18 | 2 | 10 | 6 |
| Knowledge and Oracle | 27 | 2 | 18 | 7 |
| Alchemy and Artifice | 84 | 1 | 22 | 61 |
| Light and Void | 5 | 0 | 4 | 1 |
| Immortal Metaphysics | 14 | 0 | 0 | 14 |
| **TOTAL** | **310** | **13** | **136** | **161** |

### Row Count Delta vs Prior Audit

Prior audit (2026-03-29) crosswalk Phase 2 measured: 362 rows (14d / 140p / 208c)
Current doctrine migration tables: 310 rows (13d / 136p / 161c)

Delta: **−52 rows** total:
- Item-effect rows: 114 → 75 (**−39**)
- Procedure rows: 64 → 40 (**−24**)
- Spell rows: 184 → 195 (**+11** — net gain from new entries)

The item-effect and procedure drops are largest. Cross-referencing the Deferred Gear Chapter Bundle Notes section and the Immortal Metaphysics module collapse: these drops represent intentional consolidation/deferral rather than accidental loss. Specifically:
- Deferred gear bundles (Staff of Power, Staff of Wizardry, etc.) removed from active mapping rows
- Immortal-procedure rows that were granular across families collapsed into Immortal Metaphysics module rows (14 total)

This is plausible consolidation. However, **no explicit annotation records this reduction** in the doctrine. The drop cannot be fully confirmed from the current workspace state without cross-referencing the git log or prior snapshots.

### Evidence Marker State in Doctrine

**0 inline evidence markers** in doctrine migration tables. The migration tables use a 4-column format: `Classic Name | Type | Notes | Mapping Status`. Evidence lock language is not carried in Notes fields.

This confirms the finding from Layer 2: the 56 evidence markers from the old Phase 2 workspace are not in the current infrastructure.

### STATUS Gate and Propagation Blocker

The Ch06 Propagation Plan (documented in Doctrine §Ch06 Propagation Plan) requires:
> Operator marks all module STATUS headers as `APPROVED`.

Current: **0 of 13 modules APPROVED**. This is the upstream gate for executing Ch06 restructure (Steps 1–5: temp file creation, header restructure, power card relocation, QA pass, chapter replacement).

---

## Summary Table: Current vs Prior Audit

| Metric | Prior Audit (2026-03-29) | Re-Measured (2026-03-31) | Status |
| --- | --- | --- | --- |
| Ch04 power entries | 112 | **112** | ✓ UNCHANGED |
| Ch04 QA entries | 112 | **112** | ✓ UNCHANGED |
| Ch04 mean confidence | 0.996875 | **0.996875** | ✓ CONFIRMED |
| Ch04 calibration anchors | 4 anchors (all correct) | **4 anchors (all correct)** | ✓ CONFIRMED |
| Exception ledger rows | 12 | **12** | ✓ CONFIRMED |
| Phase 1 catalog rows | 304 | **314** (+10) | Δ GROWN |
| Unique import spell names | 184 | **194** (+10) | Δ GROWN |
| osr: imported rows | 0 | **0** | ✓ NOT STARTED |
| Phase 2 mapping rows | 362 (in crosswalk) | **310** (in doctrine, −52) | Δ MIGRATED |
| Evidence lock markers | 56 (>= gate threshold) | **0** (lost in migration) | ✗ REGRESSION |
| Modules STATUS APPROVED | n/a | **0 of 13** | BLOCKED |
| Crosswalk rated confidence | 0.90 | **0.85 re-rated** | Δ DOWNGRADED |

---

## Findings

### Confirmed Strengths

1. Chapter 04 is clean, accurate, and calibration-ready. All doctrine P: anchors verified. Rating confirmed at 0.996875.
2. Phase 1 catalog has grown cleanly — 10 new Holmes/OD&D/Greyhawk spell rows correctly added.
3. Exception State Ledger is accurate: 12 rows, all confirmed and locked.
4. Module architecture in Doctrine is complete (13 modules, all have doctrine sections and migration tables).
5. All 310 migration table rows carry explicit `direct` / `partial` / `custom` status labels.

### Issues Found

1. **Evidence marker loss** — the 56 inline evidence lock / verification pass markers no longer exist in the workspace. They were part of the deleted Phase 2 family tables and were not carried to Doctrine migration tables. The evidence-note density gate (≥50) cannot currently be verified and technically fails.

2. **Stale governance claims** — The crosswalk Metadata Rubrics section still presents the old 363/362/56 numbers. These no longer reflect the live workspace. Any agent reading these sections will receive misleading confidence ratings.

3. **Row count unaccounted** — The 52-row drop (−39 item-effect, −24 procedure, +11 spell) is plausible as intentional consolidation, but no annotation records it. If correctness of the migration matters for downstream work, a spot-check against the old Phase 2 family tables (possibly via git log) should be performed.

4. **All modules DRAFT** — The Ch06 Propagation Plan is entirely blocked. No progress toward execution after the module architecture was written. The operator needs to review modules and mark STATUS APPROVED to unblock Step 1.

5. **Apostrophe encoding split** — 21 Ch04 power names use curly apostrophes (U+2019) in the QA table but straight apostrophes (U+0027) in the live Ch04 headings. This is cosmetic only, but automated parity scripts will report false mismatches.

---

## Recommended Next Steps

1. **Fix stale governance claims in crosswalk**: Update Metadata Rubrics section numbers to reflect current reality:
   - Row-state count: 310 (in Doctrine)
   - Evidence markers: 0 (acknowledge migration gap, update gate description)
   - Crosswalk confidence self-rating: 0.85 Minimum Viable (not 0.90 AWI until evidence restored)

2. **Decide on evidence markers**: Either restore evidence lock annotations to Doctrine migration table Notes fields (ideally for all high-risk custom rows), or formally retire the ≥50 marker gate and replace with a structural equivalent.

3. **Operator module review**: Operator should read and mark each Doctrine module STATUS: APPROVED or STATUS: NEEDS-REVISION before Ch06 Propagation Plan Step 1 can begin.

4. **Apostrophe encoding cleanup (low priority)**: Harmonize QA table entry names to use the same apostrophe character as Ch04 headings. Either direction works; consistency prevents false parity failures.

---

## Audit Sign-off

All numbers in this report are directly measured from the current workspace state (2026-03-31). No precision is claimed beyond what direct file inspection can reproduce.

This report supersedes the Chapter 04 / crosswalk / doctrine claims in `AUDIT_REPORT_Confidence_Ratings.md` where the above measurements differ.
