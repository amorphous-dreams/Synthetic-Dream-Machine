# AGENTS.md — `lares/` Design Directory

> Scope: Permanent design specification tree for the Lares agent instruction architecture.
> Updated: 2026-04-08
> Governs: Agents working within `lares/**`

---

## Role of This Directory

`lares/` is the **canonical design ontology tree**. It is the permanent specification home for the Lares agent architecture, not a source-of-truth for deployed prompts. Content here is drafted, verified, and promoted — not executed directly.

Agents working here function as **design workers**: read, synthesize, draft, and hand findings upward. They do not promote to `builds/` unilaterally.

---

## Subdomain Map

Work in the appropriate subdirectory. Each subdir has its own README.md and AGENTS.md.

| Subdir | When to work here |
|---|---|
| `signal/` | HUD annotation grammar, Tagspace, `lares:` URI format, p-band model, micro-trace |
| `crystal/` | STATE.jsonl schema, seal/fork/resume protocol, crystal state machine |
| `compiler/` | TOML manifest pipeline, typed IR, module descriptors, host emitters |
| `invariants/` | `lares.core.*` behavioral invariants, priority layers, trust model, register guard |
| `schemas/` | TOML schemas for module/tool/permission descriptors, bootloader |
| `registry/` | `lares:` URI registry, resolver rules, promotion ledger |
| `platform/` | Multi-platform packaging, browser tier manifests, host budget maps |

---

## Consumption Workflow

When working with a source doc in `_todo/core/`:

1. Read the source doc in `_todo/core/`
2. Identify which subdir(s) its content belongs in (see `README.md` consumption map)
3. Extract canonical content into the appropriate `lares/` subdir — draft the relevant spec section or TOML stub
4. Do **not** delete or archive the source file; mark it as consumed in the target subdir's README.md
5. Escalate design decisions to the coordinator; do not resolve load-bearing calls unilaterally

---

## Register Policy

All design content in this tree is `[S:]` or below until the operator explicitly promotes it. Design workers may propose promotion; they do not grant it.

- `[P:]` — sketch / brainstorm
- `[SP:]` — provisional design candidate
- `[S:]` — working design synthesis (default for active design work)
- `[CS:]` — near-promoted; awaiting operator confirm
- `[C:0.95]` — promoted to design-canon; `lares:` URI assigned; ready for `builds/` migration

---

## What Not to Do

- Do not edit files in `builds/agents/` directly from a design pass — propose the change, then run the pipeline
- Do not treat research reports (`A_deep-research-report.md`, `B_deep-research-report.md`) as canon — they are `[S:]` external synthesis
- Do not collapse open decisions (Q1–Q17 in `Signal_HUD_Tagspace-draft.md`) without an operator ruling
- Do not archive `Signal_HUD_Tagspace-draft.md` before AE-08/AE-09 — it is the sole source for several load-bearing specs

---

## Escalation Path

Design workers → Lares (Scryer) for structural findings → Lares (Council) for contested calls → operator for load-bearing decisions.
