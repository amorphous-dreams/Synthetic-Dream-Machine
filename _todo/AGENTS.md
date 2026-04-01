~$ lares --context "BECMI → SDM+ pipeline; post-commit clean start"

## Branch And Working Tree

Branch: `feature/osr-power-text`
Working tree: clean — all changes committed before this session begins.

## Project State

This is the BECMI → SDM+ conversion pipeline for Flying Triremes and Laser Swords (FTLS). Work is organized inside `_todo/` with canonical governance documents. The primary downstream manuscript targets are:

- `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_06_Powers_and_ECM.md` — Chapter 06: active osr: import target
- `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_05_Magitech_and_Fantascience.md` — Chapter 05: paused until Chapter 06 alpha is complete

## Doctrine State

- Doctrine file: `_todo/TODO_BECMI_Spell_Effect_Conversion_Doctrine.md`
- Row count: **312 rows** (13 direct / 136 partial / 163 custom) — confirmed 2026-03-31
- Modules: 9 APPROVE · 2 NEEDS-REVISION · 0 HOLD · 2 N/A
- Gate: **CONDITIONALLY OPEN** for Ch06 Propagation Plan (9 of 11 active modules approved)
- Audit authority: `_todo/AUDIT_REPORT_Doctrine_APPROVAL_2026-03-31.md` (Revision 2)

### NEEDS-REVISION Modules (do not propagate these yet)

1. **Knowledge and Oracle** — item-effect P: calibration gap (~55% derivable); 5–6 rows without a formula path
2. **Alchemy and Artifice** — ND borderline (~1.45 est.); 32 item-effect/procedure customs with no formula path; P: drift risk HIGH

### Locked Formula

`P: = max(1, BECMI Spell Level × 2)` — stable and not under review.

## Crosswalk State

File: `_todo/TODO_BECMI_Spell_Effect_Crosswalk.md`

- Phase 1 catalog: 15 provenance-bearing tables, 304 execution rows
- Phase 2 family workspace: 32 mapping tables, 13 family blocks with full metadata packages
- Row-state labels: **312** (13D / 136P / 163C) — reconciled 2026-03-31
- Exception ledger: 12 verified rows (8 RC-only, 4 Master-only) — all confirmed
- Confidence lock: **Approved Working Infrastructure (0.90 / 1.00 floor-based)** — open
- Import backlog: **195-name spell-only pass** (204 crosswalk entries with `Ch06 Import ✓`); execution queue defined in `## Phase B Backlog: Chapter 06 osr: Import`
  - **+11 Pre-AD&D/Holmes spells added 2026-03-31** — pipeline hardened to include these in staging; counts updated from the prior 184/193 figures
  - All 315 tracked spell rows are currently `osr: imported = -` (none imported yet)

### Current Import Blocker (as of 2026-03-31)

`import_ch06_osr.py` raises `RuntimeError: missing Chapter 06 heading for Dancing Lights`. The 11 newly included Pre-AD&D/Holmes spells do not yet have Chapter 06 cards. **Immediate prerequisite**: add Chapter 06 spell cards for the 11 new Pre-AD&D spells before running the import pass. Previous `osr: imported` counts (e.g., `{'yes': 184}` from the 2026-03-29 audit) were from a temp-file run; the live chapter file has all `osr:` blocks still at placeholder state.

### Sequencing Locks (as of 2026-03-28)

- Source frozen: staged spell corpus is the only legal upstream witness base
- Chapter 06 design decisions: locked
- Chapter 06 alpha: still open; literal `osr:` import is part of remaining alpha work
- Chapter 05 bridge: closed until Chapter 06 alpha complete

## Active Work Queue

Source of truth: `_todo/TODO_BECMI_Conversion.md` → `## Active Queue`

1. **Add Chapter 06 cards for 11 new Pre-AD&D/Holmes spells** — `import_ch06_osr.py` is currently broken until Chapter 06 headings exist for all 11 newly included spells (first failure: `Dancing Lights`). This is the immediate unblocking step.
2. Keep the spell/effect crosswalk in lockstep: Chapter 06 `osr:` import-state changes must be mirrored back into the flat catalog immediately.
3. Execute the Chapter 06 spell-only `osr:` preservation import pass in existing family order (195 spells, 204 import rows).
4. Run Chapter 06 alpha verification after the preservation import pass (tag consistency, overcharge consistency, recognizer discoverability, Level/Power Level boundaries).
5. Mark Chapter 06 as `alpha` complete before resuming new Chapter 05 bridge edits.
6. Resume Chapter 05 Phase B bridge batches with the now-locked Chapter 06 API doctrine.
7. Re-validate overlay assumptions against current Quickstart/Gear canon as downstream manuscript edits resume.

Immediate execution target: **item 1 above** — create stub Chapter 06 cards for the 11 Pre-AD&D/Holmes spells so `import_ch06_osr.py check` can run cleanly. Then **Phase B Backlog Pass 1 → items 1–3** in `TODO_BECMI_Spell_Effect_Crosswalk.md`.

## Governance File Index

| File | Purpose | Status |
|---|---|---|
| `_todo/AUDIT_REPORT_Doctrine_APPROVAL_2026-03-31.md` | Doctrine approval audit Rev 2 | Current; gate authority |
| `_todo/AUDIT_REPORT_Confidence_Ratings.md` | Staging/provenance confidence audit (2026-03-29) | Frozen historical snapshot; authoritative for those layers |
| `_todo/TODO_BECMI_Spell_Effect_Conversion_Doctrine.md` | 312-row conversion doctrine | Active; append only |
| `_todo/TODO_BECMI_Spell_Effect_Crosswalk.md` | Phase catalog + exception ledger + family workspace + import backlog | Active; primary import control surface |
| `_todo/TODO_BECMI_Conversion.md` | Conversion master TODO and execution log | Active |
| `_todo/TODO_BECMI_Spell_Material_Staging.md` | Clean multi-witness staging file | Rebuild before manuscript import |
| `_todo/TODO_BECMI_Spell_Material_Staging_Basic.md` | Basic lane staging (frozen) | Frozen source |
| `_todo/TODO_BECMI_Spell_Material_Staging_Expert.md` | Expert lane staging (frozen) | Frozen source |
| `_todo/TODO_BECMI_Spell_Material_Staging_Companion.md` | Companion lane staging (frozen) | Frozen source |
| `_todo/TODO_BECMI_Spell_Material_Staging_Master.md` | Master lane staging (frozen) | Frozen source |
| `_todo/TODO_BECMI_Spell_Material_Staging_Immortals.md` | Immortals lane staging (frozen) | Frozen source |
| `_todo/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md` | RC lane staging (frozen) | Frozen source |
| `_todo/TODO_PRE_ADD_Spell_Staging.md` | Pre-AD&D spell staging (frozen) | Frozen source |
| `_todo/TODO_FTLS_Chapter_Action_Plan.md` | FTLS chapter-level action plan | Active |
| `_todo/TODO_Magitech_Fantascience_Chapter05.md` | Chapter 05 alignment TODO | Paused |
| `_todo/TODO_Lares_Chapter05_Agent_Prompt.md` | Chapter 05 Lares agent prompt | Active |

## Calibration Anchors (SDM Powers Index)

| Spell | P: via formula | Confirmed SDM variant |
|---|---|---|
| Cure Light Wounds (C1) | P:2 | `Mending Light` — line 1690 |
| Sleep (M1) | P:2 | `Quiescent Field Pulse` — line 2633 |
| Fireball (M3) | P:6 | `Incendiary Burst` — line 2703 |
| Lightning Bolt (M3) | P:6 | `Voltaic Surge` — line 3075 |

## Doctrine Completion Targets (Nice-to-Have, Not Yet Scheduled)

These are the only items left before the full doctrine gate can open unconditionally:

1. **Knowledge/Oracle** — add P: notes for the 5–6 item-effect custom rows; raise PC% from ~55% → ≥80%
2. **Alchemy/Artifice** — deepen notes on the 32 item-effect/procedure custom rows; raise ND from ~1.45 → ≥1.5; reduce P: drift risk
3. Per-row reversible annotations for any remaining reversible-capable rows across all modules (audit found 75%+ coverage; tighten to 100%)

These should not block the `osr:` import pass. They are a parallel track.
