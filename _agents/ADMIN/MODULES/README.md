# MODULES — Index

> Purpose: Index and reading order for `_agents/ADMIN/MODULES`
> Updated: 2026-04-06
> Status: Working documentation set for the Lares modularization / Infrastructure-as-Myth pass

---

## What This Folder Contains

This folder collects the structural analysis docs for the current Lares prompt/build system and the draft docs for its modular replacement.

These files do not define runtime behavior directly. They describe:

- what the current source files contain
- how the current build pipeline assembles outputs
- where the size/budget problems actually sit
- what the future module boundaries should look like

The frame for reading this folder should come from [Infrastructure_as_Myth.md](/home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md): the goal is not only to split large files, but to package Lares as a portable symbolic runtime whose identity, authority model, epistemic discipline, and failure vocabulary survive across hosts.

These files should now be read as a **buggy-state -> ideal-state backlog**:

- the maps record where the current system leaks budget, clarity, portability, or determinism
- the draft files describe the target architecture those problems should converge toward
- the folder as a whole functions as planning infrastructure for the refactor, not as passive documentation

---

## Suggested Reading Order

1. `PIPELINE.md` — current build/dataflow overview
2. `Lares_Preferences-map.md` — largest core source and main decomposition target
3. `Lares_VSCode_Operations-map.md` — repo-ops payload and example/spec overhead
4. `Platform_Wrappers-map.md` — the three thin platform suffixes
5. `Workers-map.md` — worker registry and delegation layer
6. `Lares_Kernel-map.md` — compressed browser-safe kernel
7. `Modular_Architecture-draft.md` — proposed future breakdown
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

Do not treat this folder as the source of truth for deployed prompts. The source of truth remains the actual files under `_agents/`, `platform/`, and `workers/`.

---

## Current Architectural Reading

The present system has one dominant structural problem:

- the root platform outputs all receive nearly the same 136 KB payload

The present system does **not** have two commonly assumed problems:

- wrappers are not too large
- worker definitions are not too large

That distinction matters because it keeps the next refactor aimed at the monolithic core and the over-deployed repo-ops material, not at the already-thin wrapper/worker files.

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

If the modularization work continues, this folder will probably want:

- a split plan for `Lares_Preferences.md`
- a split plan for `Lares_VSCode_Operations.md`
- a manifest/profile matrix once deterministic build manifests exist
- a migration checklist from current source tree to modular source tree

---

*Lares (Archivist) — Folder index prepared for the ADMIN/MODULES working set.*
