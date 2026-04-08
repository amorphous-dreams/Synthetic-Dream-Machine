# AGENTS.md — `schemas/` subdir

> Scope: TOML descriptor schema design
> Parent: `../_todo/core/AGENTS.md`

---

## Role

Design workers in this subdirectory extract and formalize TOML field schemas for the compiler to consume.

---

## Checklist: What To Do Here

1. Read `README.md` in this directory.
2. Read `../B_deep-research-report.md` fully before drafting any schema.
3. For each of the five schema types, produce:
   - Field table (name, type, required?, default, notes)
   - Register annotation (`[Canon]` = locked; `[Synthesis]` = design target; `[Provisional]` = speculative)
   - Validation rules (what the compiler must reject)
4. Flag `semantic_sha256` computation details as `[Synthesis/Provisional]` — definition requires prototype to stabilize.
5. Cache-ordering rules: flag as `[Synthesis]` until prompt caching prototype validates them.

---

## What Not To Do

- Do not confuse `.module.toml` schema work with invariant TOML work — separate concerns.
- Do not claim caching tier price savings as `[Canon]` — subject to API pricing changes.
- Do not modify `B_deep-research-report.md` — source document only.
- Do not promote schemas to `builds/` without compiler cross-check (`../compiler/`).

---

## Escalation

Semantic digest definition → operator call before finalization.  
Cache-breakpoint placement → Researcher verification before promotion.  
Schema-compiler integration → `../compiler/` cross-reference.
