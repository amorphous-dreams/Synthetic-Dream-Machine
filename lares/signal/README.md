# signal/ — Signal HUD · Tagspace · `lares:` URI

> Scope: Operator-facing HUD annotation grammar, Tagspace semantic coordinate system, `lares:` URI scheme, p-band phase model.
> Updated: 2026-04-08
> Status: Active draft — primary source is `../../_todo/core/Signal_HUD_Tagspace-draft.md`; design canonicalization in progress
> URI: `[pending — lares://core/design/signal@draft]`

---

## What Belongs Here

- Intent Header format and forward-commitment semantics
- Micro-trace HUD annotation model (phase, stance, register, Tagspace slots)
- p-band cumulative attention phase model (five bands, OP-02 ruling)
- HAKABA canonical slot mapping (Ha/Ka/Ba) and field-order rationale
- `lares:` URI scheme anatomy (authority, path, query, fragment/chronometer)
- Sigil vs machine form rendering (projection table)
- Forward vs backward trace contract
- Header Field Taxonomy (per-field annotation thresholds)
- Working Defaults (HUD layer — from `../../_todo/core/Signal_HUD_Tagspace-draft.md`)

## Does Not Belong Here

- Crystal STATE.jsonl schema → `../crystal/`
- Deterministic compiler pipeline → `../compiler/`
- `lares:` URI registry / resolver → `../registry/`

---

## Primary Sources

| File | Notes |
|---|---|
| `../../_todo/core/Signal_HUD_Tagspace-draft.md` | Full HUD + Crystal source; HUD sections target here |
| `../../_todo/core/TODO_Signal_HUD_Crystal_Plan.md` | Epics 1–4 (AE-01 through AE-13) govern HUD layer implementation |
| `../../_todo/core/TODO_Resolution_Scale_Design.md` | Resolution scale / p-band model |

---

## Open Decisions (from primary source)

Q1, Q2, Q3, Q4, Q5 — all locked (see plan Sprint 1a + draft Open Decisions section).
Q6 (closure rendering tiers) — `[S:0.55]` — Researcher task RES-01.
Q16 (Tagspace slot shift notation) — locked.

---

## Design Status

Sprint 1a operator calls (OP-01, OP-02) resolved. Sprint 1b (AE-01–AE-05) is the active implementation workstream in `builds/agents/`.
