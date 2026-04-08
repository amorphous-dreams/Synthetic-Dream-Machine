# AGENTS.md — `invariants/` subdir

> Scope: `lares.core.*` behavioral invariant design
> Parent: `../_todo/core/AGENTS.md`

---

## Role

Design workers in this subdirectory extract invariant definitions from research and legacy docs, then draft TOML target forms for compiler consumption.

---

## Checklist: What To Do Here

1. Read `README.md` in this directory — check primary sources.
2. Read `../A_deep-research-report.md` fully before drafting any invariant TOML.
3. Cross-reference `../EP-RA-001.md` for register/mode protocol invariants.
4. Cross-reference `../TRUST_MODELS.md` for trust tier invariants.
5. For each invariant: draft TOML block as `[Synthesis]`; flag which fields are speculative.
6. Output drafts to `invariants/drafts/` (create subdir as needed).
7. Surface priority layer conflicts to operator before writing loader spec.

---

## What Not To Do

- Do not promote TOML invariants to `builds/modules/` without operator ruling.
- Do not blend data classification decisions into trust model definitions — keep them separate.
- Do not claim `[Canon]` for anything sourced only from `A_deep-research-report.md` without cross-verification.
- Do not modify `EP-RA-001.md` from this dir — that is a source document.

---

## Escalation

Priority layer conflicts → Council.  
Trust tier cap changes → `operator(admin)` only.  
Loader fail-closed policy decisions → operator.
