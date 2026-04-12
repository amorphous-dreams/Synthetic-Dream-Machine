# crystal/ — Archive Crystal State Machine

> Scope: Crystal state machine semantics, EVENT-sourced JSONL ledger, seal/fork/resume protocol, machine threading model.
> Updated: 2026-04-08
> Status: Active draft — primary source is `../../_todo/core/Signal_HUD_Tagspace-draft.md` (crystal sections)
> URI: `[pending — lar://core/design/crystal@draft]`

---

## What Belongs Here

- Crystal event model (EVENT types: init, r_update, milestone, seal, fork, resume, hold, archive, contract_update, **drift_correction**)
- STATE.jsonl append-only ledger schema
- SNAPSHOT.json (derived cache atop ledger) spec
- debug.jsonl enriched projection spec
- CURRENT pointer semantics (`.lares/CURRENT`)
- Seal protocol and fork/resume contract
- Machine / Thread model (Ephemeral Machine Patterns)
- Handoff and Archive-Crystal packet spec
- Open Questions Q10 and Q15 (structural prerequisites — **resolve before further spec**):
  - Q10: When do resume/fork trigger vs fresh init?
  - Q15: How does seq_num work across multi-voice?

## Does Not Belong Here

- HUD rendering / Intent Header grammar → `../signal/`
- `lar:` URI resolver / registry → `../registry/`
- TOML schemas for modules/tools → `../schemas/`
- Platform-specific crystal storage constraints → `../platform/`

---

## Primary Sources

| File | Notes |
|---|---|
| `../../_todo/core/Signal_HUD_Tagspace-draft.md` | Crystal sections (state machine, event model, seal, fork/resume, machine threading, open decisions Q10/Q15) |
| `../../_todo/core/TODO_Signal_HUD_Crystal_Plan.md` | Epic 5 tracker governs crystal implementation workstream |

---

## Critical Review Summary

Eight concerns were raised about this design (2026-04-08 session). Key structural issues:

1. **Probabilistic runtime**: LLM cannot reliably maintain deterministic STATE.jsonl without external tooling. External MCP server or sidecar is the recommended path.
2. **Replay ≠ structural replay**: STATE.jsonl gives audit trail, not behavioral reproduction. Drop "replay" language.
3. **Q10 and Q15 are blockers**: Must resolve before spec extension.4. **Prospective commitment / automation surprise**: The intent header is declared *before* generation begins, creating a forward-commitment contract. When the declared header diverges from the actual output (register, stance, or scope mismatch), this constitutes automation surprise — the CRM/aviation failure mode where the copilot's declared intent diverges from actual behavior. The current non-drift rule (CRY-07) detects mismatch but defines no recovery protocol. **CRY-07 must specify a mismatch recovery protocol, not just a mismatch detection assertion.** Minimum viable contract: on mismatch, the node flags the delta inline, emits a corrected end-of-span tag, and STATE.jsonl records the correction as the authoritative result (actual output overrides declared plan). See `../../_todo/LIMINAL_PERSPECTIVES.md` §4.
5. **`drift_correction` event type required**: The mismatch recovery protocol requires a dedicated event type. When a correction occurs: (1) node emits the corrected end-of-span tag inline, (2) a `drift_correction` event is appended to STATE.jsonl with fields: `declared_uri` (the original intent header), `actual_register`, `actual_stance`, `delta_description`. The `drift_correction` event is the authoritative record; the original `r_update` event is not modified (immutability holds). Annunciation is fire-and-forward; the operator decides whether to acknowledge or steer. This event type must be added to CRY-01's event schema table at S1.
6. **SA vs XAI distinction — non-drift rule governs projection errors, not integrity failures `[CS:0.80]`**: Through the Endsley SA lens, the intent header is a *prospective SA display* — it shows what the node will do. When a declared header diverges from actual output, this constitutes a **Level 3 SA failure (projection error)**, not an integrity failure. Projection errors are expected and normal in dynamic environments; the correct system response is to annunciate the change, not to flag corruption. CRY-07's non-drift rule must explicitly distinguish between: (a) **governing field drift** (register, stance, or phase differ between header and actual output) — annunciate + emit `drift_correction` event + STATE.jsonl records correction as authoritative; (b) **annotation field drift** (micro-trace or closure outcome differs from header projection) — normal; the header was prospective, the annotation records what actually happened. The micro-trace `→[tag]` transition marks *are* the annunciation protocol — they surface the delta between declared plan and actual execution in real time. See `../../_todo/E-deep-research-report.md` §2.2 (Endsley 2023).
---

## Design Status

Primary source doc exists (draft). Epic 5 of plan is not yet started. Q10 + Q15 must be operator-resolved before implementation sprint begins.
