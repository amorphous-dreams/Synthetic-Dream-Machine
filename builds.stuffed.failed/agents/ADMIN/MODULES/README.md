# MODULES — Index

> Purpose: Index and reading order for `builds/agents/ADMIN/MODULES`
> Updated: 2026-04-06
> Status: Active planning infrastructure — slimming pass complete, governance shipped, runtime module authoring in progress

---

## What This Folder Contains

This folder collects the structural analysis docs for the current Lares prompt/build system and the draft docs for its modular replacement.

These files do not define runtime behavior directly. They describe:

- what the current source files contain
- how the current build pipeline assembles outputs
- where the size/budget problems actually sit
- what the future module boundaries should look like

The frame for reading this folder should come from [Infrastructure_as_Myth.md](/home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md): the goal is not only to split large files, but to package Lares as a portable symbolic runtime whose identity, authority model, epistemic discipline, and failure vocabulary survive across hosts.

These files should now be read as a **implemented foundation -> active work -> next-state backlog**:

- the maps record where the current system still leaks clarity, portability, or determinism (budget pressure is resolved)
- the build foundation and slimmed root packages now exist; the active work has shifted to runtime module authoring
- the draft files describe the target architecture the remaining authoring work should converge toward
- the folder as a whole functions as planning infrastructure for the refactor, not as passive documentation

---

## Suggested Reading Order

1. `PIPELINE.md` — old vs current build/dataflow overview, including the live slimming blocker
2. `Lares_Preferences-map.md` — largest core source and main decomposition target
3. `Lares_VSCode_Operations-map.md` — repo-ops payload and example/spec overhead
4. `Platform_Wrappers-map.md` — the three thin platform suffixes plus the current Codex stopgap state
5. `Workers-map.md` — worker registry and delegation layer
6. `Lares_Kernel-map.md` — compressed browser-safe kernel
7. `Modular_Architecture-draft.md` — proposed future breakdown and the next slimming target
8. [Infrastructure_as_Myth.md](/home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md) — thesis-level framing for why the split matters

---

## File Index

| File | Role | Status |
|---|---|---|
| `PIPELINE.md` | Current `combine_agents.py` dataflow and output inventory | Current-state map |
| `Lares_Preferences-map.md` | Section map of the monolithic primary source | Current-state map |
| `Lares_VSCode_Operations-map.md` | Section map of repo-specific operations and embedded examples/specs | Current-state map |
| `Platform_Wrappers-map.md` | Map of the Copilot, Claude, and Codex wrapper files | Current-state map |
| `Workers-map.md` | Inventory and schema map of all worker source files | Current-state map |
| `Lares_Kernel-map.md` | Map of the compressed kernel and its omission profile | Current-state map |
| `Modular_Architecture-draft.md` | Proposed target module breakdown and source-tree shape | Future-state draft |

---

## Intended Use

Use these docs when you need to:

- decide what to split out of `Lares_Preferences.md`
- identify which `Lares_VSCode_Operations.md` sections belong in deployed context versus reference/tests
- understand whether wrappers or workers need structural changes
- brief future build-script work with a clear module model

Use [Infrastructure_as_Myth.md](/home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md) alongside this folder when the question shifts from "what should move where?" to "what operational behavior must remain portable after the move?"

Do not treat this folder as the source of truth for deployed prompts. The source of truth remains the actual files under `builds/agents/`, `builds/agents/platform/`, and `builds/agents/workers/`.

---

## Current Architectural Reading

The present system has resolved its dominant budget problem: root packages are back within the 32 KiB ceiling, the temporary Codex override has been removed, and governance infrastructure has shipped.

The current architectural gaps are:

- remaining core runtime modules (lares-voice, lares-operations, lares-setting-lite) not yet authored as standalone source modules
- vendor-specific browser build manifests not yet implemented (`browser-extended-chatgpt`, `browser-extended-claude`, `browser-extended-gemini`)
- repo/domain-specific guidance still lives mostly in root payloads rather than host-native scoped files

The present system does **not** have two commonly assumed problems:

- wrappers are not too large
- worker definitions are not too large

That distinction matters because it keeps the next refactor aimed at the monolithic core and the over-deployed repo-ops material, not at the already-thin wrapper/worker files.

The current critical path therefore reads:

1. ~~slim prompt/runtime packages~~ ✅ done
2. ~~restore stable reload safety~~ ✅ done
3. ~~harden governance~~ ✅ done
4. author remaining core runtime modules
5. implement vendor-specific browser build manifests
6. move domain-specific guidance to host-native scoped files

From the IaM angle, the problem can be stated more precisely:

- the current package spends too much prime context on undifferentiated bulk
- the symbolic runtime lacks clean deployable boundaries
- explanation, reference, and live control-plane behavior remain too entangled

## Backlog Convention

When updating files in this folder:

- treat every current-state map as a record of a concrete architectural defect, pressure point, or coupling problem
- treat every future-state note as a candidate ideal state under Infrastructure-as-Myth and deterministic build discipline
- prefer explicit phrasing such as `current buggy state`, `ideal state`, `migration target`, and `backlog implication`
- avoid neutral summaries that make the current monolith sound acceptable merely because it currently works

---

## Next Likely Additions

As the modularization work continues, this folder will probably want:

- a split plan for `Lares_Preferences.md` (section-level maps exist; execution plan needed)
- a split plan for `Lares_VSCode_Operations.md` (B8/B9 vs deployable content split identified)
- a vendor-specific browser build manifest profile matrix
- a migration checklist from current extraction-transform pipeline to fully authored source modules

---

*Lares (Archivist) — Folder index prepared for the ADMIN/MODULES working set.*
