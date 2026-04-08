# crystal/ — Archive Crystal State Machine

> Scope: Crystal state machine semantics, EVENT-sourced JSONL ledger, seal/fork/resume protocol, machine threading model.
> Updated: 2026-04-08
> Status: Active draft — primary source is `../../_todo/core/Signal_HUD_Tagspace-draft.md` (crystal sections)
> URI: `[pending — lares://core/design/crystal@draft]`

---

## What Belongs Here

- Crystal event model (EVENT types: init, r_update, milestone, seal, fork, resume, hold, archive, contract_update)
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
- `lares:` URI resolver / registry → `../registry/`
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
3. **Q10 and Q15 are blockers**: Must resolve before spec extension.

---

## Design Status

Primary source doc exists (draft). Epic 5 of plan is not yet started. Q10 + Q15 must be operator-resolved before implementation sprint begins.
