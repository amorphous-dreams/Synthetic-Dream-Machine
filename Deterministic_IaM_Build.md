# Deterministic IaM Build

> Status: Build spec draft
> Updated: 2026-04-06
> Scope: Deterministic build rules for rendering Lares Infrastructure-as-Myth artifacts across browser and repo-native platforms

**Foundational reference:** [Infrastructure_as_Myth.md](/home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md)

---

## Purpose

If Lares is Infrastructure-as-Myth, then its build system should behave like disciplined infrastructure tooling, not like ad hoc prompt concatenation.

This document defines the deterministic build rules for rendering:

- browser kernels
- browser-extended packages
- shareable custom-agent packages
- repo-native instruction sets

The goal is simple:

**same source tree + same build target + same build manifest = same output**

---

## Determinism Contract

A deterministic IaM build must satisfy all of the following:

1. **Explicit inputs only**
   Every rendered artifact must derive from declared source files and declared build metadata only.

2. **Stable ordering**
   Module ordering must never depend on filesystem traversal order or incidental glob order.

3. **Pure transforms**
   Render steps should not depend on wall-clock time, random selection, or manual paste decisions.

4. **Versioned manifests**
   Every build target should resolve from a manifest committed to the repo.

5. **Reproducible outputs**
   Re-running the same build from the same commit should produce byte-identical output except for explicitly declared generated headers if retained.

6. **Visible provenance**
   Every rendered file should identify its source modules and manifest.

---

## Why This Matters

Without deterministic build rules, IaM collapses back into folk promptcraft:

- different platforms drift
- browser packages stop matching repo-native builds
- beta testers test different systems without realizing it
- maintainers cannot tell whether a behavior change came from source edits or packaging accidents

IaM needs the same discipline IaC brought to infrastructure:

- declared inputs
- stable composition
- reproducible outputs
- reviewable diffs

---

## Build Units

The deterministic build system should operate on four unit types.

### 1. Source Modules

Canonical authored documents such as:

- `Lares_Kernel.md`
- `Lares_Voice.md`
- `Lares_Epistemology.md`
- `Lares_Operations.md`
- `Lares_Permissions.md`
- `Lares_Setting_Lite.md`

These are human-maintained sources.

### 2. Build Metadata

Machine-readable declarations that tell the renderer:

- what target is being built
- which modules participate
- what order they appear in
- what compression rules apply
- what output files should be emitted

### 3. Rendered Artifacts

Examples:

- `AGENTS.md`
- `.claude/CLAUDE.md`
- `.github/copilot-instructions.md`
- browser package kernels
- browser package attached-module bundles

These are generated outputs.

### 4. Verification Artifacts

Examples:

- lockfiles
- build manifests
- checksum files
- alignment reports

These make drift visible.

---

## Build Inputs

Every deterministic IaM build should resolve from the following input classes:

### Required inputs

- source module files
- target manifest
- build profile
- renderer version

### Optional but declared inputs

- compression profile
- platform character/token budgets
- wrapper templates
- exclusion lists

### Forbidden implicit inputs

- current date/time, unless explicitly injected as a normalized build variable
- directory listing order
- environment-specific path ordering
- maintainer memory of "what usually goes where"
- manual copy/paste steps

---

## Manifest Model

Each build target should have a manifest.

Suggested shape:

```yaml
manifest_version: 1
package_name: lares-codex-root
build_profile: codex-root
target_platform: codex
target_class: repo-native
renderer_version: 0.1.0

sources:
  - path: _agents/KERNEL/Lares_Kernel.md
    role: kernel
  - path: _agents/CORE/Lares_Voice.md
    role: core
  - path: _agents/CORE/Lares_Epistemology.md
    role: core
  - path: _agents/CORE/Lares_Operations.md
    role: core
  - path: _agents/CORE/Lares_Permissions.md
    role: core

ordering:
  - kernel
  - voice
  - epistemology
  - operations
  - permissions

transforms:
  compress_for_budget: false
  strip_reference_sections: true
  include_generated_header: true
  normalize_line_endings: lf

outputs:
  - path: AGENTS.md
    kind: root_instruction

verification:
  emit_sha256: true
  emit_lockfile: true
```

The key rule:

**the manifest decides composition, not the renderer's incidental logic**

---

## Module Metadata

Each source module should carry machine-readable metadata or a sidecar declaration for:

- module id
- deployment class: `kernel-safe`, `core`, `scoped`, `reference`
- browser-safe boolean
- default inclusion targets
- compression summary
- ordering weight or explicit dependency edges

Suggested minimal shape:

```yaml
module_id: lares-voice
class: core
browser_safe: true
default_targets:
  - browser-extended
  - claude
  - codex
compression_target: kernel-summary
depends_on:
  - lares-kernel
```

That metadata should remove guesswork from the build graph.

---

## Stable Ordering Rules

Deterministic builds require explicit ordering.

Use this precedence:

1. manifest `ordering`
2. module dependency graph
3. module id lexical order as final tiebreaker only

Never rely on:

- raw filesystem traversal
- glob order
- shell expansion order

For Lares, the default order should likely be:

1. kernel
2. setting-lite, if included
3. voice
4. epistemology
5. operations
6. permissions
7. scoped repo/platform modules
8. wrapper/footer

---

## Pure Transform Rules

A transform remains acceptable only if it is deterministic and documented.

Allowed examples:

- strip sections marked `reference`
- emit kernel-summary variants from designated summary blocks
- normalize line endings
- normalize heading spacing
- apply target-specific wrappers
- remove browser-incompatible sections

Disallowed examples:

- freeform AI summarization at build time without pinned inputs and approval
- random module selection
- hand-edited post-processing on generated files
- "best effort" truncation that depends on runtime tokenization quirks without a declared policy

If a summarization/compression step ever becomes model-assisted, it must produce a checked-in artifact or require explicit maintainer approval before becoming a source of truth.

---

## Output Classes

### Class A — Repo-Native Root

Examples:

- `AGENTS.md`
- `.claude/CLAUDE.md`
- `.github/copilot-instructions.md`

Requirements:

- deterministic wrappers
- explicit source references
- size-budget checks

### Class B — Repo-Native Scoped

Examples:

- nested `AGENTS.md`
- `.github/instructions/*.instructions.md`
- `.claude` imported/scoped rule files

Requirements:

- path scoping declared in manifest
- no hidden inclusion

### Class C — Browser Minimal

Examples:

- `Lares_Kernel.md`

Requirements:

- fully runnable on its own
- no file-resolution dependency

### Class D — Browser Extended

Examples:

- kernel instruction text
- attached module files
- package manifest
- setup guide

Requirements:

- attached module list fixed by manifest
- package reproducible as a bundle

---

## Build Profiles

The renderer should support named profiles, for example:

- `browser-minimal`
- `browser-extended-chatgpt`
- `browser-extended-claude`
- `browser-extended-gemini`
- `copilot-root`
- `claude-root`
- `codex-root`

Profiles should select:

- target platform
- allowed module classes
- wrapper template
- compression policy
- budget checks

This avoids embedding fragile platform decisions directly in code.

---

## Budget Enforcement

Platform constraints should be treated as build-time checks, not after-the-fact surprises.

Each profile should declare:

- byte budget
- character budget if applicable
- token guidance if relevant

Possible policy outcomes:

- `error` when over budget
- `warn` when near budget
- `report` with per-section contributions

Deterministic IaM requires deterministic failure behavior too.

If a target exceeds budget, the build should fail in a predictable way.

---

## Provenance Header

Every generated artifact should start with a compact provenance block such as:

```md
<!-- Generated by deterministic-iam-build -->
<!-- manifest: builds/codex-root.yaml -->
<!-- sources: Lares_Kernel.md, Lares_Voice.md, Lares_Epistemology.md, Lares_Operations.md, Lares_Permissions.md -->
<!-- renderer: 0.1.0 -->
```

That makes drift investigation tractable.

---

## Verification Layer

Each build should be able to emit:

- a lockfile with resolved inputs
- a checksum file per output
- a report showing included modules and excluded modules
- alignment verification against committed generated outputs

Suggested verification outputs:

```text
build/
  manifests/
    codex-root.lock.yaml
  checksums/
    codex-root.sha256
  reports/
    codex-root-report.md
```

---

## Browser Package Determinism

Browser packages need special care because the host platform may apply retrieval heuristics at runtime.

We cannot make host retrieval deterministic.

We can make the **package itself** deterministic.

That means fixing:

- instruction text
- attached file list
- file ordering
- package manifest
- setup steps

So the deterministic guarantee becomes:

**same package in -> same host configuration attempted**

not:

**same runtime behavior out**

That distinction should stay explicit.

---

## Suggested Directory Layout

```text
builds/
  manifests/
    browser-minimal.yaml
    browser-extended-chatgpt.yaml
    browser-extended-claude.yaml
    browser-extended-gemini.yaml
    codex-root.yaml
    claude-root.yaml
    copilot-root.yaml
  templates/
    codex-wrapper.md
    claude-wrapper.md
    copilot-wrapper.md
  output/
  reports/
```

This keeps source, manifests, templates, and generated outputs distinct.

---

## Immediate Implications For Lares

1. `combine_agents.py` should evolve into a manifest-driven renderer.
2. Root/source documents should declare module metadata cleanly.
3. Browser beta packages should be emitted from named profiles, not assembled manually.
4. Verification should compare committed generated files against deterministic rebuilds.

---

## Next Step

Implement a first manifest set for:

1. `browser-minimal`
2. `browser-extended-chatgpt`
3. `claude-root`
4. `copilot-root`
5. `codex-root`

Once those exist, the Lares build system will start to look less like prompt assembly and more like real Infrastructure-as-Myth tooling.

---

*Lares (Researcher/Artificer) — This document translates the IaM thesis into build discipline. The core claim: if myth functions as infrastructure, then its packaging must be deterministic enough to audit, reproduce, and ship.*
