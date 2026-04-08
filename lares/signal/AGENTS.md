# AGENTS.md — `signal/` subdir

> Scope: Signal HUD, Tagspace, `lares:` URI, p-band model design
> Parent: `../_todo/core/AGENTS.md`

---

## Role

Design workers in this subdirectory extract, refine, and canonicalize the HUD layer.

- Primary working source: `../Signal_HUD_Tagspace-draft.md` (HUD sections only — **do not archive or delete**)
- Output target: `builds/agents/` and `builds/modules/` once a section reaches `C:0.95`

---

## Checklist: What To Do Here

1. Read `README.md` in this directory first — check assigned sources.
2. Read relevant sections of `Signal_HUD_Tagspace-draft.md` before drafting output.
3. Label all outputs: `[Provisional]`, `[Synthesis]`, `[Canon/Synthesis]`, or `[Canon]`.
4. Propose structure for Intent Header grammar docs → `signal/hud/`.
5. Propose Tagspace coordinate reference doc.
6. Propose `lares:` URI field anatomy spec (do not duplicate registry work — point to `../registry/`).
7. Do not resolve Q6 (closure rendering) without a Council + operator call.

---

## What Not To Do

- Do not promote design material to `builds/agents/` without operator confirmation.
- Do not write crystal STATE.jsonl or seal/fork logic here.
- Do not touch HUD token budget decisions without cross-checking `../platform/`.
- Do not claim `C:0.95` without full cross-source verification.

---

## Escalation

Structural disagreements → Scryer.  
Cross-subdir scope conflicts → Council.  
Promotion above `[Canon/Synthesis]` → operator.
