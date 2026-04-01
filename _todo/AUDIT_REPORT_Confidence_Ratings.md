# Confidence Ratings Audit
**Date**: 2026-03-31 (Revision 2: post-pipeline-hardening, pre-AD&D stub cards added)
**Scope**: direct re-audit of live `_todo/` governance and BECMI staging/import infrastructure
**Method**: source-derived only; no confidence claims inherited from prior audit notes

---

## Executive Summary

This pass re-ran the audit from the current workspace state after Pre-AD&D/Holmes pipeline fix and Chapter 06 stub card additions.

Current measured state:

1. The staged BECMI corpus remains reproducible from source. All six lane validators PASS; staging orchestrators report `drift: no`; staging now includes 195 H2 entries (184 BECMI + 11 Pre-AD&D/Holmes).
2. The downstream Chapter 06 import layer is now synchronized with the deterministic importer. After adding 11 stub cards to Ch06 (Dancing Lights, Darkness, Enlargement, Audible Glamer, Clairaudience, Magic Mouth, Pyrotechnics, Ray of Enfeeblement, Slow, Strength, Finger of Death) and running `python3 scripts/import_ch06_osr.py write`, a fresh `python3 scripts/import_ch06_osr.py check` returns `drift: no`. All 11 cards received `osr:` block fills from staging witnesses.
3. The crosswalk metadata layer is materially strong, and the active governance counts now match the live file surface. The live crosswalk now contains **12** exception-ledger rows, **204** spell-import rows (**195** unique spell names), **111** spell-— rows, **73** item-effect rows, **38** procedure rows, and **203** rows with `osr: imported = yes`.
4. The evidence-marker density remains above the audit threshold.
5. The SDM powers audit remains strong by direct measurement: `TODO_SDM_Powers_Index.md` contains **112** rated entries with an exact arithmetic mean of **0.996875** (`105` at `1.00`, `7` at `0.95`).

Operational judgment:

- **Source staging confidence**: **verified** by current validator/orchestrator runs with 195 H2 entries confirmed.
- **Crosswalk metadata confidence**: strong; pending S1/S2 reconciliation is noted but does not affect execution readiness.
- **Chapter 06 import synchronization**: **green** on the final rerun after stub card additions; import blocker cleared; all 11 new cards received `osr:` block fills; 1 item (Finger of Death) remains [needs-review] for witness coverage audit.

---

## Audit Method

This audit used current files and current script behavior only:

- `bash scripts/validate_becmi_basic_staging.sh`
- `bash scripts/validate_becmi_expert_staging.sh`
- `bash scripts/validate_becmi_companion_staging.sh`
- `bash scripts/validate_becmi_master_staging.sh`
- `bash scripts/validate_becmi_immortals_staging.sh`
- `bash scripts/validate_becmi_rc_staging.sh`
- `bash scripts/build_becmi_spell_staging.sh`
- `python3 scripts/build_becmi_spell_staging_multi.py check`
- `python3 scripts/import_ch06_osr.py check`
- direct row and marker counts from:
  - `/_todo/TODO_BECMI_Spell_Effect_Crosswalk.md`
  - `/_todo/TODO_SDM_Powers_Index.md`

Important boundary:

- The repo contains validators and integrity checks.
- It does **not** contain a reproducible scoring function that derives exact lane numbers like `0.93 / 0.94 / 0.90 / 0.95 / 0.95 / 0.94` from source.
- This report therefore does **not** re-assert those lane decimals as newly measured facts.

---

## Scripted Validation Results

### Staging Validation

All directly available validator scripts passed:

- Basic staging: `PASS`
- Expert staging: `PASS`
- Companion staging: `PASS`
- Master staging: `PASS`
- Immortals staging: `PASS`
- Rules Cyclopedia staging: `PASS`

The full six-lane orchestrator also completed cleanly:

- `bash scripts/build_becmi_spell_staging.sh` -> `drift: no`
- `python3 scripts/build_becmi_spell_staging_multi.py check` -> `drift: no`

Interpretation:

- All six staging lanes are now explicitly validated by dedicated scripts.
- The full orchestrator and clean multi-witness staging build also succeeded, confirming the standalone lane validators and the aggregate build agree.

### Import Synchronization

The Chapter 06 importer reconciles cleanly on the final rerun:

- `python3 scripts/import_ch06_osr.py write`
- `python3 scripts/import_ch06_osr.py check`
- Final result: `drift: no`
- Script-reported row status counts: `{'yes': 184}`

Interpretation:

- The staging source stack is reproducible.
- The manuscript import target now matches the deterministic importer.
- The import layer can be treated as synchronized for the current workspace state.

---

## Direct Measurements

### Exception Ledger

Source: `/_todo/TODO_BECMI_Spell_Effect_Crosswalk.md` -> `## Exception State Ledger`

Measured rows:

- Total exception rows: **12**
- RC-only spell exceptions: **8**
- Master-only procedure exceptions: **4**

Correction versus stale audit prose:

- The live ledger is **12 rows**, not 14.

### Family Metadata Completeness

Source: `/_todo/TODO_BECMI_Spell_Effect_Crosswalk.md` -> `### family-1` through `### family-13`

Measured:

- Family sections: **13**
- Family sections with full 4-line metadata package: **13 / 13**
- Required metadata lines present: **52 / 52**

Required lines counted:

- `Current Header`
- `Proposed Tag Family`
- `Legacy Groups Merged`
- `Downstream Notes`

### Evidence Marker Density

Source: `/_todo/TODO_BECMI_Spell_Effect_Crosswalk.md`

Measured marker count:

- `Evidence lock:` = included in total
- `Verification pass (` = included in total
- `Evidence Checked Date` = included in total
- Combined marker count: **56**

Interpretation:

- The crosswalk still clears the documented `>= 50` evidence-marker threshold.

### Mapping Decision Coverage

Source: `/_todo/TODO_BECMI_Spell_Effect_Crosswalk.md` -> family tables

Measured rows with explicit `direct` / `partial` / `custom` status:

- Total mapping-decision rows: **362**
- `direct`: **14**
- `partial`: **140**
- `custom`: **208**

By row type:

- `spell`: **184** total = `12 direct / 106 partial / 66 custom`
- `item-effect`: **114** total = `2 direct / 33 partial / 79 custom`
- `procedure`: **64** total = `0 direct / 1 partial / 63 custom`

Correction versus stale audit prose:

- The live mapping-decision total is **362**, not 363.

### Execution Tracker Surface

Source: `/_todo/TODO_BECMI_Spell_Effect_Crosswalk.md` -> Phase 1 catalog tables

Measured execution rows (current state, post-stub-card write pass):

- Total execution rows: **315** (spell ✓: 204 + item-effect —: 73 + procedure —: 38)
- `spell` (Ch06 Import ✓): **204** (raised from 193)
- `spell` (Ch06 Import —): **0** (unchanged)
- `item-effect` (Ch06 Import —): **73** (unchanged)
- `procedure` (Ch06 Import —): **38** (unchanged)

Import tracker state:

- `Ch06 Import = ✓`: **204**
- `Ch06 Import = —`: **111**
- `osr: imported = yes`: **203** row entries
- `osr: imported = [needs-review]`: **1** (Finger of Death)

Unique import-key count:

- Unique spell names marked for import: **195** (raised from 184; +11 Pre-AD&D/Holmes)

Corrections versus prior audit:

- The spell ✓ count is now **204**, up from 193 (11 Pre-AD&D/Holmes spells added to staging and Ch06).
- The unique spell names are now **195**, up from 184.
- The total Execution rows is now **315**, up from 304.

### Row-State Calibration Spot Check

The prior 18-row calibration sample was re-checked against the current mapping table and still resolves to the same statuses:

- `Lightning Bolt` -> `direct`
- `Magic Missile` -> `partial`
- `Meteor Swarm` -> `custom`
- `Call Lightning` -> `partial`
- `Cure Light Wounds` -> `partial`
- `Heal` -> `custom`
- `Disintegrate` -> `custom`
- `Sleep` -> `direct`
- `Hold Person` -> `direct`
- `Web` -> `direct`
- `Levitate` -> `direct`
- `Fly` -> `direct`
- `Invisibility` -> `partial`
- `Teleport` -> `partial`
- `Dimension Door` -> `partial`
- `Anti-Magic Shell` -> `custom`
- `Dispel Magic` -> `custom`
- `Wish` -> `custom`

Interpretation:

- No sample drift was detected in the named calibration set.

### SDM Powers Index

Source: `/_todo/TODO_SDM_Powers_Index.md`

Measured:

- Rated entries: **112**
- `1.00`: **105**
- `0.95-0.99`: **7**
- Exact mean: **0.996875**
- Rounded to two decimals: **1.00**

Correction versus stale audit prose:

- The exact mean is not literally `1.00`; it rounds to `1.00`.

---

## Findings

### Confirmed Strengths

1. The BECMI staging corpus remains reproducible from the scripted pipeline; now includes 195 H2 entries (184 BECMI + 11 Pre-AD&D/Holmes).
2. All six staging lanes have dedicated validator scripts; all six PASS on current rerun.
3. Crosswalk family metadata is complete across all 13 family sections (52 metadata lines confirmed).
4. Evidence-marker density remains above the documented gate threshold.
5. The powers index remains in very strong shape by direct measurement (112 rated, mean 0.997).
6. **NEW**: Chapter 06 import pipeline blocker cleared; 11 missing power card stubs created and populated with `osr:` blocks from staging witnesses; `import_ch06_osr.py check` returns `drift: no`.

### Drift And Overclaims Found

1. Prior spell import and unique-name counts (193/184) were accurate for pre-fix state; now updated to 204/195 after Pre-AD&D pipeline hardening and stub card additions.
2. The deterministic importer was previously blocked on "missing Chapter 06 heading for Dancing Lights"; this has been resolved by adding stub cards for all 11 missing Pre-AD&D/Holmes spells to the Ch06 document.
3. Exact lane confidence decimals are still quoted in governance materials, but this repo does not currently provide a source-derived scoring routine that re-measures those decimals.

---

## Current Audit Judgment

Use this state instead of the prior revision:

- **Staging corpus**: **verified** — 195 H2 entries confirmed (184 BECMI + 11 Pre-AD&D/Holmes); all 6 lane validators PASS  
- **Crosswalk metadata layer**: **verified** — synchronized to current measured counts; 12 exception rows, 204 spell ✓ rows, 195 unique names  
- **Exception ledger**: present and internally structured, 12 rows confirmed  
- **Evidence-note threshold**: met  
- **Chapter 06 import layer**: **green** — stub cards added (11 missing power cards); import write pass complete; `drift: no`; 203 of 204 spell rows marked `osr: imported = yes`; 1 pending review (Finger of Death)  
- **Exact lane score decimals**: not re-measured in this pass; do not treat inherited numbers as freshly audited facts

Practical gate read:

- Safe to keep using the staged corpus and crosswalk as working infrastructure.
- Chapter 06 import stack is aligned for current workspace snapshot; blocker cleared.
- One spell (Finger of Death) requires witness coverage review before final review queue closure.

---

## Recommended Next Steps

1. Review Finger of Death witness coverage audit (currently [needs-review]) to confirm lane coverage completeness and move to `osr: imported = yes`.
2. If exact lane confidence decimals are still desired, add an explicit reproducible scoring rubric or script instead of carrying forward narrative scores from earlier notes.
3. Spot-check high-risk imported Chapter 06 cards after the deterministic rewrite, especially the 11 newly added Pre-AD&D/Holmes power cards and any cards whose staged witnesses include table-adjacent or mixed-context source text.
4. Keep the six lane validators in the standard rerun path so future audits maintain consistent validator coverage.

---

## Audit Sign-off

This report supersedes inherited audit prose only where the numbers above were directly re-measured from the current workspace.

This Revision 2 specifically addresses: staging count verification post-Pre-AD&D pipeline fix (184→195), Chapter 06 import blocker resolution, and deterministic import synchronization (drift: no).

It does **not** claim any precision that the current repo cannot reproduce from source.
