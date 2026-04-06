# Modular Architecture — Draft

> Document type: Proposed source-tree/module breakdown
> Status: Draft derived from `PROMPTCRAFT.md` + `Deterministic_IaM_Build.md` + `Infrastructure_as_Myth.md`
> Updated: 2026-04-06
> Register: [S:0.68] 🏛️ — structural synthesis, not yet build-canon

---

## Purpose

This document turns the modularization direction in `PROMPTCRAFT.md` into a concrete draft architecture for the Lares source tree and build system.

It treats Lares as an Infrastructure-as-Myth package, not merely a large prompt that needs trimming. In this frame, module boundaries should preserve the symbolic-operational runtime: identity, authority, epistemic discipline, failure vocabulary, and packaging.

It answers three questions:

1. what the always-on modules should be
2. what should move into scoped or reference-only files
3. how platform wrappers fit once the build stops centering one monolithic source file

It should be read as the **ideal-state side of the backlog**. The current-state maps in this folder document the failure modes and pressure points; this draft names the target shape they should converge toward.

---

## Design Goal

Shift from:

`one canonical monolith -> three near-identical generated platform files`

to:

`one canonical source tree -> kernel + core modules + scoped modules + thin deterministic wrappers`

That architecture should support both runtime classes already identified in PROMPTCRAFT:

- browser/paste contexts that need one runnable kernel
- repo-native contexts that can load richer modular instruction infrastructure

It should also satisfy the IaM tests stated in `Infrastructure_as_Myth.md`:

- portability across hosts
- legibility through symbolic handles
- auditability through versioned artifacts
- compression via reusable terms and modules
- correctability through named failure states
- packaging into deployable host-specific outputs

Those criteria provide the architectural standard for the split. If a proposed module boundary weakens those properties, it is probably the wrong boundary.

## Backlog Role

**Current buggy state:** one oversized source payload and one oversized repo-ops payload get pushed almost unchanged into every root platform artifact.

**Ideal state:** a deterministic IaM build renders a small runnable kernel, a stable core symbolic runtime, scoped repo modules, and thin host wrappers from an explicit source tree.

Everything in this draft should be interpreted as a migration target, not a claim that the repo already behaves this way.

## Current Migration Target

The manifest-driven build foundation now exists. The next migration target is practical rather than theoretical:

- extract always-on core runtime modules from the monolithic root payloads
- move reference/spec material out of root always-on context
- shrink Codex, Claude, and Copilot root packages to reload-safe budgets
- restore a stable VS Code/Codex reload path
- only then shift the critical path to governance hardening

---

## IaM Reading Of The Split

The modular architecture should preserve Lares as a **portable symbolic runtime for agent behavior**.

That means:

- `kernel` preserves the smallest executable form of the mythic runtime
- core modules preserve the control plane of the runtime
- scoped modules preserve environment-specific behavior without polluting every host
- reference/spec material preserves explanation, examples, and test anchors without consuming always-on context budget
- wrappers preserve host integration rather than duplicating the runtime itself

This distinction matters because IaM does not treat myth as ornament. It treats mythic terms as coordination artifacts. If a term improves steering, recall, authority legibility, or failure correction, it belongs somewhere in the runtime. If it only decorates, it belongs in reference or lore.

---

## Proposed Module Stack

### Layer 1: Kernel

**Module:** `lares-kernel`

Purpose:

- smallest runnable Lares for browser or plain API contexts
- compressed identity and behavior floor
- fallback deployment artifact when no file loading exists

Likely source:

- `_agents/KERNEL/Lares_Kernel.md`

Deployment class:

- browser-safe
- also used as the compressed summary baseline for repo-native roots

---

### Layer 2: Core Repo Modules

These stay always-on for repo-native agents and provide the actual IaM runtime.

#### `lares-voice`

Purpose:

- mandatory coordinator/Worker attribution rules
- thirteen voices
- Worker tag and escalation lifecycle
- named speaking roles as operator-legible control endpoints

Primary source candidate:

- split from `Lares_Preferences.md` Voice Architecture section

#### `lares-epistemology`

Purpose:

- registers
- modes
- input signal reading
- signal tags/exchange vectors if retained
- degraded-node states tied to epistemic failure
- compact symbolic handles for truth-status, tone, and correction

Primary source candidate:

- split from `Lares_Preferences.md` Model Agnosticism sections

#### `lares-operations`

Purpose:

- collaboration model
- frame-uncertainty
- default behavior
- proactive surfacing
- session init
- memory/consolidation
- operating modes that truly need always-on status
- ritualized protocols for day-to-day steering

Primary source candidate:

- split from `Lares_Preferences.md` operational sections

#### `lares-permissions`

Purpose:

- User / Operator / Admin model
- canon promotion gate
- de-escalation
- capability honesty
- trust-boundary guidance
- authority made legible inside the runtime rather than left implicit

Primary source candidate:

- split from `Lares_Preferences.md` Identity & Permissions + adjacent authority rules

#### `lares-setting-lite`

Purpose:

- preserve compact mythic continuity
- define Gaia/Elyncia/Lararium/DreamNet framing in small form
- carry fiction-escalation boundary without dragging full lore
- preserve the symbolic handles that make the rest of the runtime memorable and portable

Primary source candidate:

- compressed extraction from `Name & Identity Frame`, `Setting & System`, and the fiction-escalation notes

---

### Layer 3: Scoped Repo Modules

These load only where the environment or task justifies them.

#### `lares-repo-ops`

Purpose:

- precedence rules
- repository source map
- canon citation style
- memory path mapping
- long-context repo workflow

Primary source candidate:

- the high-value portion of `Lares_VSCode_Operations.md` Section B

#### `lares-cli`

Purpose:

- terminal identity
- command formatting
- CLI-specific response conventions

Primary source candidate:

- `CLI Interaction & Roleplay` section

#### `lares-dream`

Purpose:

- Dream Mode lifecycle
- dream-lock handling
- dream artifact format

Primary source candidate:

- Dream Mode material in Operating Modes

#### `lares-todo-workflows`

Purpose:

- `_todo/`-specific editing and workflow guidance
- task-planning or admin notes that should not pollute every root file

Primary source candidate:

- future extraction from repo-specific admin docs rather than the current monolith

---

### Layer 4: Reference / Spec Material

These documents remain important, but they should not spend prime instruction budget.

#### `lares-archaeology`

- Roman lararia detail
- extended setting synthesis material

#### `lares-design-lineage`

- RAW / Korzybski / Discordian design background beyond operational minimum

#### `lares-examples`

- golden prompt/response examples
- format demonstrations

#### `lares-regression-spec`

- regression checklist
- expected pass criteria

These likely belong in `_agents/REFERENCE/` or `tests/`, not in always-loaded runtime modules.

The governing rule here comes from IaM directly: if material does not improve operational compression, steering, portability, or correction, it should not occupy always-on runtime space.

---

## Proposed Source Tree

```text
_agents/
  KERNEL/
    Lares_Kernel.md
  CORE/
    Lares_Voice.md
    Lares_Epistemology.md
    Lares_Operations.md
    Lares_Permissions.md
    Lares_Setting_Lite.md
  SCOPED/
    Lares_Repo_Ops.md
    Lares_CLI.md
    Lares_Dream.md
    Lares_Todo_Workflows.md
  REFERENCE/
    Lares_Archaeology.md
    Lares_Design_Lineage.md
    Lares_Examples.md
    Lares_Regression_Spec.md
  platform/
    Lares_Copilot_Wrapper.md
    Lares_Claude_Wrapper.md
    Lares_Codex_Wrapper.md
  workers/
    *.md
```

This should be treated as a target shape, not a claim that the repo should be renamed immediately.

---

## Mapping From Current Files

| Current source | Proposed destination | Notes |
|---|---|---|
| `_agents/Lares_Kernel.md` | `KERNEL/Lares_Kernel.md` | Already functions as compressed runtime kernel |
| `_agents/Lares_Preferences.md` | split across `CORE/`, `SCOPED/`, `REFERENCE/` | Main decomposition target |
| `_agents/Lares_VSCode_Operations.md` | mostly `SCOPED/Lares_Repo_Ops.md`; examples/spec move to `REFERENCE/` or `tests/` | Only a small fraction should remain always loaded |
| `_agents/platform/*.md` | remain in `platform/` | Thin wrappers/templates |
| `_agents/workers/*.md` | remain in `workers/` | Already compact and well-scoped |

---

## Build Implications

This module breakdown pairs cleanly with the deterministic build model:

- manifests declare which modules each profile includes
- ordering stays explicit
- wrappers apply last
- budgets check the resolved package, not the whole authoring tree

It also pairs with the IaM thesis:

- symbolic runtime remains stable across hosts
- packaging changes without erasing identity
- auditability improves because authority, epistemology, and collaboration stop hiding inside one giant file

Suggested default root order for repo-native builds:

1. `lares-kernel`
2. `lares-setting-lite`
3. `lares-voice`
4. `lares-epistemology`
5. `lares-operations`
6. `lares-permissions`
7. scoped repo module(s) as required
8. platform wrapper/footer

That ordering follows the logic in `Deterministic_IaM_Build.md` while preserving the current "identity before operations" feel.

---

## Root Artifact Strategy By Platform

### Codex

Root should stay compact and rely on nested/scoped docs where useful. `AGENTS.md` should no longer receive the entire `Preferences + VSCode Operations` payload verbatim.

Recommended root composition:

- kernel
- setting-lite
- voice
- epistemology
- operations
- permissions
- compact repo-ops index
- codex wrapper

### Claude

Root `CLAUDE.md` should remain short and import stable modules or scoped rules rather than embedding long examples/reference content.

Recommended root composition:

- kernel
- voice
- epistemology
- operations
- permissions
- repo-ops import/index
- claude wrapper

### Copilot

Repository-wide instructions should stay extremely small, with specialized guidance moving into `.github/instructions/*.instructions.md`.

Recommended root composition:

- compressed kernel
- minimal repo source map
- minimal citation/grounding rules
- copilot wrapper

The richer Lares runtime for Copilot should live in scoped instruction files, not the repository-global root.

---

## Non-Goals

This draft does not yet define:

- final filenames or exact casing
- import syntax per platform
- manifest schema details beyond the related build doc
- the exact compression policy for each section
- whether `lares-setting-lite` remains always-on everywhere

Those decisions should follow after the module boundaries are accepted.

---

## Recommended Next Moves

1. Treat this file as the reference architecture for future `[future module]` labels in the existing maps.
2. Split `Lares_Preferences.md` on paper first, before changing source paths.
3. Extract the deployable repo-ops subset from `Lares_VSCode_Operations.md`.
4. Move examples/regression material into reference docs or tests.
5. Convert `combine_agents.py` from concatenation logic to manifest-driven assembly only after the content split exists.

---

## Summary

The modular architecture should not preserve the current file boundaries. It should preserve the operational runtime:

- kernel for runnable identity
- core modules for always-on behavior
- scoped modules for environment-specific guidance
- reference docs for human understanding and test/spec material
- wrappers for host integration only

That structure keeps Infrastructure-as-Myth portable without continuing to pay monolith costs on every platform. It treats Lares less like a prompt blob and more like a packaged symbolic runtime whose behavior can be rendered, audited, and deployed across hosts.

---

*Lares (Archivist/Artificer) — Drafted from live module maps, PROMPTCRAFT, and the deterministic build spec on 2026-04-06.*
