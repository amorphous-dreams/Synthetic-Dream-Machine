# Confidence Ratings Audit
**Date**: 2026-03-29
**Scope**: direct re-audit of live `_todo/` governance and BECMI staging/import infrastructure
**Method**: source-derived only; no confidence claims inherited from prior audit notes

---

## Executive Summary

This pass re-ran the audit from the current workspace state instead of treating earlier audit prose as authoritative.

Current measured state:

1. The staged BECMI corpus is reproducible from source. All available lane validators pass, and the full six-lane staging orchestrator plus clean multi-witness builder both report `drift: no`.
2. The downstream Chapter 06 import layer is now synchronized with the deterministic importer. After applying `python3 scripts/import_ch06_osr.py write`, a fresh `python3 scripts/import_ch06_osr.py check` returns `drift: no`.
3. The crosswalk metadata layer is materially strong, and the active governance counts now match the live file surface. The live crosswalk now contains **12** exception-ledger rows, **362** mapping-decision rows, **304** execution rows, **193** spell-import rows, **184** unique spell names, and **0** active `[table-derived]` rows.
4. The evidence-marker target is currently satisfied by direct count: **56** inline `Evidence lock` / `Verification pass` / `Evidence Checked Date` markers are present.
5. The SDM powers audit remains strong by direct measurement: `TODO_SDM_Powers_Index.md` contains **112** rated entries with an exact arithmetic mean of **0.996875** (`105` at `1.00`, `7` at `0.95`).

Operational judgment:

- **Source staging confidence**: verified by current validator/orchestrator runs.
- **Crosswalk metadata confidence**: strong enough for continued work, but stale counts in the docs need to stop being treated as ground truth.
- **Chapter 06 import synchronization**: green on the final rerun.

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

Measured execution rows:

- Total execution rows: **304**
- `spell`: **193**
- `item-effect`: **73**
- `procedure`: **38**

Import tracker state:

- `Ch06 Import = ✓`: **193**
- `Ch06 Import = —`: **111**
- `osr: imported = yes`: **193** row entries
- `osr: imported = -`: **96**

Unique import-key count:

- Unique spell names marked for import: **184**

Corrections versus stale governance prose:

- The importer works against **184 unique spell names**, not a 194-row spell-only pass.
- The prior explicit `[table-derived]` markers were re-examined against the current staging corpus and retired where staged prose now exists.

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

1. The BECMI staging corpus is currently reproducible from the scripted pipeline.
2. All six staging lanes now have dedicated validator scripts, and all six passed on the final rerun.
3. Crosswalk family metadata is complete across all 13 family sections.
4. Evidence-marker density remains above the documented gate threshold.
5. The powers index remains in very strong shape by direct measurement.

### Drift And Overclaims Found

1. The prior audit totals for exceptions, mapping rows, and table-derived rows did not match the live crosswalk; this rerun corrected the stale counts in the active crosswalk.
2. The deterministic importer exposed manuscript drift during the first pass; this rerun reconciled it and the final import check is now clean.
3. Exact lane confidence decimals are still quoted in governance materials, but this repo does not currently provide a source-derived scoring routine that re-measures those decimals.

---

## Current Audit Judgment

Use this state instead of the superseded “all clear” framing:

- **Staging corpus**: verified
- **Crosswalk metadata layer**: verified and synchronized to the current measured counts
- **Exception ledger**: present and internally structured, but currently 12 rows
- **Evidence-note threshold**: met
- **Chapter 06 import layer**: synchronized
- **Exact lane score decimals**: not re-measured in this pass; do not treat inherited numbers as freshly audited facts

Practical gate read:

- Safe to keep using the staged corpus and crosswalk as working infrastructure.
- Safe to describe the Chapter 06 import stack as aligned for the current workspace snapshot.

---

## Recommended Next Steps

1. If exact lane confidence decimals are still desired, add an explicit reproducible scoring rubric or script instead of carrying forward narrative scores from earlier notes.
2. Spot-check high-risk imported Chapter 06 cards after the deterministic rewrite, especially cards whose staged witnesses include table-adjacent or mixed-context source text.
3. Keep the new Companion and Immortals validators in the standard rerun path so future audits do not fall back to indirect lane coverage.

---

## Audit Sign-off

This report supersedes inherited audit prose only where the numbers above were directly re-measured from the current workspace.

It does **not** claim any precision that the current repo cannot reproduce from source.
