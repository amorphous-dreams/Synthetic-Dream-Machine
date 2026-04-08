# Canonical Design Ontology Tree — `lares/`

> Purpose: Permanent design specification tree for the Lares agent instruction architecture, `lares:` URI schema, deterministic build compiler, and crystal state machine.
> Updated: 2026-04-08
> Status: Active — source docs in `_todo/core/`; design artifacts in this tree; `lares:` URI promotion pending schema lock
> URI: `[pending lares: URI schema settlement]`

---

## What This Folder Is

This is the **canonical design ontology tree** for the Lares agent architecture. It is the permanent specification home where:

1. Source docs from `_todo/core/` are consumed and their content is extracted into the appropriate subdomain
2. New research is digested and synthesized into typed design artifacts
3. Design artifacts graduate from draft → design-canon → `builds/` once each subdomain's `lares:` URI schema settles at `C:~0.95`

**The source of truth for deployed prompts remains `builds/agents/`.** Files here are design specifications, not live runtime. Source scratch docs remain in `_todo/core/` until consumed.

---

## Design Subdirectories

Each subdirectory is a design domain. Each has its own README.md (scope + legacy file inventory) and AGENTS.md (local agent instructions). When a subdir's design is promoted, it receives a `lares:` URI at `C:0.95` or above.

| Subdir | Domain | Status |
|---|---|---|
| [`signal/`](signal/README.md) | Signal HUD · Tagspace · lares: URI scheme · p-band model | Active draft |
| [`crystal/`](crystal/README.md) | Archive Crystal state machine · STATE.jsonl · seal protocol | Active draft |
| [`compiler/`](compiler/README.md) | Deterministic build compiler · typed IR · manifests · TOML pipeline | Active draft |
| [`invariants/`](invariants/README.md) | `lares.core.*` behavioral invariants · priority layers · conflict resolution | Active draft |
| [`schemas/`](schemas/README.md) | TOML schemas: module, tool, permission descriptors | Active draft |
| [`registry/`](registry/README.md) | `lares:` URI registry · resolver rules · promotion ledger | Active draft |
| [`platform/`](platform/README.md) | Multi-platform packaging · browser tiers · host budget maps | Active draft |

---

## Legacy File Inventory — Consumption Map

These files existed before the subdirectory structure. Each is assigned to one or more target subdirs. Consuming a file means extracting its canonical content into the target subdir's design and marking it here.

| File | Target Subdir(s) | Consumed? | Notes |
|---|---|---|---|
| `Signal_HUD_Tagspace-draft.md` | `signal/` + `crystal/` | No — do not archive until AE-08/AE-09 | Blocked; review after AE-08/AE-09 land |
| `TODO_Signal_HUD_Crystal_Plan.md` | `signal/` (Epics 1–4) + `crystal/` (Epic 5) | No — active task tracker | **⬆ HIGH** — drives all signal/ + crystal/ work; review first |
| `TODO_Resolution_Scale_Design.md` | `signal/` | No | **⬆ HIGH** — p-band model; blocks signal/ URI settlement |
| `Modular_Architecture-draft.md` | `compiler/` | No | **⬆ HIGH** — compiler architecture foundation; review before build work |
| `PIPELINE.md` | `compiler/` | No | **⬆ HIGH** — build pipeline spec; needed to settle compiler/ flow |
| `TODO_Deterministic_Build_Plan.md` | `compiler/` | No | Drives compiler/ roadmap; review after PIPELINE.md |
| `Lares_Kernel-map.md` | `compiler/` | No | IR map for kernel module; review during compiler/ type-slot work |
| `Lares_Preferences-map.md` | `compiler/` | No | IR map for preferences module; review alongside Kernel-map |
| `Lares_VSCode_Operations-map.md` | `compiler/` | No | IR map for VSCode ops module; lower pri than Kernel/Preferences maps |
| `Platform_Wrappers-map.md` | `compiler/` + `platform/` | No | Bridges compiler/ + platform/; review when platform/ scope settles |
| `Workers-map.md` | `compiler/` | No | IR map for worker slots; review during compiler/ Worker typing |
| `PROMPTCRAFT.md` | `compiler/` | No | Prompt engineering patterns; review for compiler output style guidance |
| `TODO_PARSE_DOC_SPEC.md` | `schemas/` | No | **⬆ HIGH** — `--parse` schema spec; blocks schemas/ URI settlement |
| `A_deep-research-report.md` | `invariants/` | No — primary invariant/trust research | **⬆ HIGH** — grounds `lares.core.*` behavioral invariants; review early |
| `B_deep-research-report.md` | `schemas/` + `compiler/` | No — primary schema/cache research | **⬆ HIGH** — grounds TOML schemas + cache model; review early |
| `EP-RA-001.md` | `invariants/` | No — bidirectional register/mode protocol | **⬆ HIGH** — foundational mode/register protocol; blocks invariants/ settlement |
| `TRUST_MODELS.md` | `invariants/` | No — admin governance trust model | **⬆ HIGH** — permission tier grounding; review alongside EP-RA-001 |
| `MULTIPLATFORM_PACKAGING_RESEARCH.md` | `platform/` | No | Review when platform/ packaging scope opens |

---

## Promotion Protocol

A design artifact is promoted when:

1. Its subdir's scope is settled (README.md finalized, AGENTS.md current)
2. The design reaches `C:0.95` — operator confirms, sources are verified
3. A `lares:` URI is assigned from the registry (see `registry/`)
4. The content migrates to `builds/agents/` or a new module source file

Until then, all content is `[S:]` or below.

---

## Cross-References

- [Infrastructure_as_Myth.md](../Infrastructure_as_Myth.md) — thesis framing for portability and symbolic runtime design
- [builds/agents/](../builds/agents/) — live source files; destination for promoted content
- [builds.stuffed.failed/](../builds.stuffed.failed/) — archived failure corpus; reference for what not to port
- [_todo/core/](../_todo/core/) — transient source docs; consumption tracked in the table above
