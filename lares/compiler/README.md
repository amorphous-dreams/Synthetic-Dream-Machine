# compiler/ — Deterministic Build Compiler

> Scope: Typed IR compiler, module graph assembly, combine scripts, verify scripts, prompt caching strategy.
> Updated: 2026-04-08
> Status: Active — `builds/scripts/` has working combine/verify scripts; architecture under refactor
> URI: `[pending — lares://core/design/compiler@draft]`

---

## What Belongs Here

- Module graph assembly algorithm (how `.module.toml` descriptors resolve to assembled prompt)
- Combine script architecture (`scripts/agents/combine_agents.py`)
- Verify script architecture (`scripts/agents/verify_alignment.py`)
- Cache-friendly assembly ordering rules (stable blocks early, breakpoint positioning)
- Typed IR specification (intermediate representation between source docs and assembled output)
- Source map files (legacy: `*-map.md` files) — track layout of source → output
- `PIPELINE.md` — current pipeline state record
- PROMPTCRAFT notes (prompt engineering conventions integrated with compiler)

## Does Not Belong Here

- Module/tool TOML schemas themselves → `../schemas/`
- `lares.core.*` behavioral invariants → `../invariants/`
- Platform-specific output constraints → `../platform/`
- Crystal STATE.jsonl → `../crystal/`

---

## Primary Sources

| File | Consumed? | Notes |
|---|---|---|
| `../../_todo/core/Modular_Architecture-draft.md` | No | Primary compiler architecture draft |
| `../../_todo/core/PIPELINE.md` | No | Current pipeline state map |
| `../../_todo/core/TODO_Deterministic_Build_Plan.md` | No | Build restart plan |
| `../../_todo/core/Lares_Kernel-map.md` | No | Source layout map |
| `../../_todo/core/Lares_Preferences-map.md` | No | Source layout map |
| `../../_todo/core/Lares_VSCode_Operations-map.md` | No | Source layout map |
| `../../_todo/core/Workers-map.md` | No | Worker registry map |
| `../../_todo/core/PROMPTCRAFT.md` | No | Prompt engineering conventions |
| `../../_todo/core/TODO_PARSE_DOC_SPEC.md` | No | Parse/doc formatting spec |
| `../../_todo/core/B_deep-research-report.md` | No | TOML schemas + cache strategy (partial — also → schemas/) |

---

## Design Status

Working scripts exist. Architecture refactor is the active sprint. `builds/scripts/` is ground truth for current state. This design dir holds the evolving spec that precedes script rewrites.
