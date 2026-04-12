<!-- lar:///compiler.builds.pipeline/lares/compiler/?confidence=CS:0.80&p=0.5 → ∞ -->

# Lares Compiler — Pipeline State

> Scope: Current state of the Lares module assembly pipeline
> Status: Active — first build scripts live as of 2026-04-10
> Updated: 2026-04-10
> Owner: `lares/compiler/` design dir; scripts in `builds/scripts/`

---

## Pipeline Architecture

```
Source                      Compiler                    Output
────────────────────────────────────────────────────────────────
lares/modules/*/             combine_modules.py           builds/output/
  MODULE.md                   - discovers modules          lares-claude-code.md
  observe/CONTEXT.md          - reads frontmatter YAML     lares-vscode.md
  orient/ARCHITECTURE.md      - topo-sort by deps          lares-claude-ai.md
  decide/CONVENTIONS.md       - selects phases by tier     lares-chatgpt.md
  act/PROCEDURES.md           - assembles output
  assess/VERIFICATION.md
                             verify_uri.py               exit 0 / exit 1 + report
                              - scans *.md files
                              - checks lares: URI rules
                              - reports violation codes

                             eprime_audit.py             stdout: FILE:LINE report
                              - checks prose for
                                be-verb identity forms

Orchestration: builds/Makefile
  make verify       → URI compliance check
  make audit        → E-Prime audit
  make check        → verify + audit
  make build-cc     → Claude Code target
  make build-all    → all four targets
  make clean        → wipe builds/output/
```

---

## Platform Targets

| Target | Token Budget | Phase Selection | Output Path |
|---|---|---|---|
| `claude-code` | ~33,000B | All phases (full graph) | `builds/output/lares-claude-code.md` |
| `vscode` | ~7,900B | MODULE.md + decide only | `builds/output/lares-vscode.md` |
| `claude-ai` | ~20,000B | MODULE.md + orient + decide | `builds/output/lares-claude-ai.md` |
| `chatgpt` | ~1,400B | MODULE.md only | `builds/output/lares-chatgpt.md` |

Token estimates: ~4 chars per token. `combine_modules.py` reports estimated vs budget at assembly time.

---

## Module Graph (Current)

| Module | Dependencies | Files |
|---|---|---|
| `talk-story` | (none) | MODULE.md + 5 phases |
| `uri-schema` | talk-story | MODULE.md + URI_SCHEMA.md + 5 phases |
| `micro-trace` | uri-schema | MODULE.md + 5 phases |
| `sigilization` | uri-schema | MODULE.md + 5 phases |

Dependency order: talk-story → uri-schema → micro-trace, sigilization

---

## Script Status

| Script | Status | Notes |
|---|---|---|
| `builds/scripts/eprime_audit.py` | ✅ Working | E-Prime validation; pre-existing |
| `builds/scripts/verify_uri.py` | ✅ New 2026-04-10 | URI compliance validator; codes U-01–U-08 |
| `builds/scripts/combine_modules.py` | ✅ New 2026-04-10 | Module assembler; 4 platform targets |
| `builds/Makefile` | ✅ New 2026-04-10 | Orchestration; `make check` = full quality pass |

---

## Validation Rules (verify_uri.py)

| Code | Rule | Source |
|---|---|---|
| U-01 | RFC 3986 order: `?query` before `#fragment` | URI_SCHEMA.md §1.1 |
| U-02 | `stances=` required in exchange-level URIs | URI_SCHEMA.md §3.4 |
| U-03 | `stances=` must have 5 positions (dot-separated) | URI_SCHEMA.md §3.4 |
| U-04 | Amplitude chars: only `^`, `.`, `-`, `?` per position | URI_SCHEMA.md §3.4 |
| U-05 | Chronometer must have 5 positions | URI_SCHEMA.md §3.5 |
| U-06 | Each chronometer position: phase prefix + counter | URI_SCHEMA.md §3.5 |
| U-07 | No emoji / non-ASCII in canonical URIs | URI_SCHEMA.md §1 |
| U-08 | URI must parse without error | RFC 3986 |

---

## Open / Pending

| ID | Item | Status |
|---|---|---|
| P-01 | TOML module descriptors — structured frontmatter (vs YAML in code fences) | `lares/schemas/` pending |
| P-02 | Typed IR — intermediate representation between source and assembled output | Architecture in review |
| P-03 | MemPalace integration — write assembled URIs to STATE.jsonl | `lares/crystal/` pending |
| P-04 | Cache-breakpoint placement — stable blocks before breakpoints | S2 scope |
| P-05 | Three-tier browser manifest split (OP-11) | Operator call needed |
| P-06 | Codex budget ceiling for AGENTS.md root (OP-12) | Operator call needed |

---

## Primary Source Docs (Unconsumed — to incorporate)

| File | Contents | Priority |
|---|---|---|
| `_todo/core/Modular_Architecture-draft.md` | Compiler architecture draft | High |
| `_todo/core/PIPELINE.md` | Original pipeline state map | High — reconcile |
| `_todo/core/TODO_Deterministic_Build_Plan.md` | Build restart plan | Medium |
| `_todo/core/B_deep-research-report.md` | TOML + cache strategy | Medium |
| `_todo/core/PROMPTCRAFT.md` | Prompt engineering conventions | Low |

---

## Last Run Results

```
First run of full pipeline: 2026-04-10
  make check   → not yet executed (scripts just created)
  make build-cc → not yet executed
  
Run: cd Synthetic-Dream-Machine && make -C builds check
```

<!-- lar:///compiler.builds.pipeline/lares/compiler/?confidence=CS:0.80&p=0.5 → ∞ -->
