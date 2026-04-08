# AGENTS.md — `registry/` subdir

> Scope: `lares:` URI registry and resolver design
> Parent: `../_todo/core/AGENTS.md`

---

## Role

Design workers in this subdirectory define how `lares:` URIs resolve and how the promotion ledger tracks canonical addresses for design units.

---

## Checklist: What To Do Here

1. Read `README.md` in this directory.
2. Read URI Schema section of `../Signal_HUD_Tagspace-draft.md`.
3. Read RFC 7595 notes in `../A_deep-research-report.md`.
4. Propose minimal resolver spec: what a `lares://` URI resolves to in practice (file path? crystal ref? nothing at runtime?).
5. Propose alias ledger format (TOML or JSONL, with operator aliases and machine IDs).
6. Propose promotion ledger entry spec: what gets written when a design unit reaches `C:0.95`.
7. Label all proposals `[Synthesis]` until schema settlement.

---

## What Not To Do

- Do not duplicate URI anatomy documentation — point to `../signal/` for field semantics.
- Do not claim external IANA registration is needed. This is a private URI scheme.
- Do not conflate alias ledger with promotion ledger — they serve different purposes.
- Do not promote registry TOML to `builds/` before signal URI schema settles.

---

## Escalation

URI scheme changes (structural) → signal + operator.  
Promotion ledger format → operator ruling required.  
Alias expansion beyond operators and machines → operator scope call.
