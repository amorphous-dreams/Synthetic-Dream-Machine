# Multi-Platform LLM Packaging Research

> Status: Active research note
> Updated: 2026-04-06
> Scope: Best-practice patterns for automating reusable LLM instruction packages across multiple hosts without relying on the repo's own Infrastructure-as-Myth terminology

---

## Purpose

This note translates the current Lares modularization problem into vendor-neutral and vendor-adjacent search terms:

- repository instruction packaging
- prompt asset pipelines
- reusable agent instruction layers
- path-scoped AI coding guidance
- modular memory/import systems
- shared prompt deployment across multiple hosts

The goal is not to find a vendor using the exact same language as Infrastructure-as-Myth. The goal is to identify the overlapping operational pattern that multiple vendors already reward:

`small root instructions + scoped additive files + versioned source artifacts + deterministic regeneration`

---

## Primary Source Findings

### 1. OpenAI Codex

Source:
- https://platform.openai.com/docs/codex
- https://openai.com/index/introducing-codex/

Relevant platform pattern:

- OpenAI's current Codex docs confirm Codex as a repo-connected coding agent across web, IDE, CLI, and SDK surfaces.
- The more specific `AGENTS.md` layering strategy remains an implementation pattern already reflected in this repo and consistent with current Codex usage, but it was not the main detail surfaced in the current official pages reviewed here.
- Practical implication: treat Codex packaging as a repo-aware instruction system and keep the root compact enough that narrower guidance can live closer to the work.

Lares implication:

- The current slim root work aligns with Codex best practice.
- Full best-practice alignment still requires more nested/scoped `AGENTS.md` use instead of concentrating all repo guidance in the root.

### 2. Anthropic Claude Code

Source:
- https://docs.anthropic.com/en/docs/claude-code/memory

Relevant platform pattern:

- Claude Code supports `CLAUDE.md` project memory and explicit `@path` imports.
- Imports can recurse, and nested `CLAUDE.md` files can be discovered in subtrees.
- Anthropic explicitly frames this as hierarchical memory, with project-wide instructions at the root and more local instructions deeper in the tree.

Lares implication:

- A thin root `CLAUDE.md` plus imported always-on modules matches the documented path better than one bundled generated file.
- Full modularization for Claude should eventually use import-based composition or subtree-local files, not only pre-bundled root generation.

### 3. GitHub Copilot

Source:
- https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions?tool=vscode
- https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/configure-custom-instructions/add-repository-instructions?tool=webui
- https://github.blog/changelog/2025-09-03-copilot-code-review-path-scoped-custom-instruction-file-support

Relevant platform pattern:

- Copilot supports repository-wide instructions in `.github/copilot-instructions.md`.
- It also supports path-specific `NAME.instructions.md` files in `.github/instructions/` with `applyTo` glob targeting.
- `excludeAgent` lets a file apply to coding-agent or code-review contexts selectively.
- GitHub's explicit recommendation trend is toward concise repository-wide instructions plus more focused scoped files.

Lares implication:

- The slimmed root Copilot file aligns with the "keep the repo-wide file small" guidance.
- Full best-practice alignment requires creating `.github/instructions/*.instructions.md` files for specialized domains instead of keeping all non-root guidance only in source docs and generated wrappers.

### 4. Gemini Gems

Source:
- https://support.google.com/gemini/answer/15235603?hl=en
- https://support.google.com/gemini/answer/15146780?co=GENIE.Platform%3DDesktop&hl=en
- https://support.google.com/gemini/answer/16504957?hl=en

Relevant platform pattern:

- Gems operate as reusable instruction bundles with optional uploaded files.
- Google emphasizes clear instructions, contextual files, and reusable saved configurations rather than repo-discovered hierarchical imports.
- Gems can be shared and edited as package-like prompt assets.

Lares implication:

- The browser-safe kernel already maps onto the Gem-style single-package model.
- If Lares is exported to Gemini-class environments, the package boundary should be explicit: one standalone kernel plus optional attached reference files, not an assumption of repo-native discovery.

---

## Cross-Vendor Convergence

Across OpenAI, Anthropic, GitHub, and Google, the same packaging pattern keeps reappearing:

1. Keep the root/global instruction layer small.
2. Put stable invariants in the global layer.
3. Move specialized guidance into narrower files or attached context.
4. Prefer additive or scoped composition over duplicating one monolith into many outputs.
5. Treat instructions as maintained assets, not one-off pasted blobs.

That convergence does not prove Infrastructure-as-Myth as a named concept. It does support the practical build claim underneath it:

**cross-platform agent behavior gets easier to maintain when instruction assets are layered, scoped, and regenerated from versioned source artifacts**

---

## Current Lares Position Against Those Patterns

### What now aligns

- Root package budgets are back under control.
- Manifests and verification artifacts exist.
- Browser-safe kernel exists as a first-class rendered artifact.
- Repo-native roots now compose from a smaller bundle instead of the full Preferences monolith.

### What still falls short of full best practice

- Claude is still emitted as one generated root bundle rather than using `@imports` or deeper subtree-local `CLAUDE.md` layering.
- Copilot does not yet use `.github/instructions/*.instructions.md` scoped files.
- Codex uses a slim root, but the richer nested `AGENTS.md` strategy remains mostly unrealized.
- The authored source tree still centers large composite documents, with extraction transforms standing in for fully separated runtime modules.

---

## Practical Best-Practice Rules For Lares

These appear to hold across vendors and should guide the next iterations.

### Rule 1: Root files should carry invariants only

Put only load-bearing, cross-task rules in root packages:

- identity floor
- authority gates
- epistemic model
- collaboration contract
- minimal environment-wide repo ops

### Rule 2: Specialized behavior should live in scoped files

Examples:

- `_todo/` workflow guidance
- governance and roster rules
- review-only guidance
- domain-specific repo rules
- CLI-heavy operational detail

### Rule 3: Source modularity should exist before render modularity

Marker extraction from large documents works as a migration bridge, but the end state should be authored source modules with explicit identities and metadata.

### Rule 4: Browser packages should be standalone

The browser kernel should not rely on repo discovery assumptions.

### Rule 5: Platform-native scoping should be used where available

- Codex: nested `AGENTS.md`
- Claude: `@imports` and subtree-local `CLAUDE.md`
- Copilot: `.github/instructions/*.instructions.md` with `applyTo` and `excludeAgent`
- Gemini: explicit saved bundle plus attached files

### Rule 6: Deterministic rebuild must remain the control plane

The repo should continue to prefer:

- manifest-declared composition
- generated platform outputs
- verification artifacts
- reproducible rebuilds from versioned source

---

## Iteration Direction

The current blocker sprint solved budget safety. The next modularization sprint should not reopen that decision.

The next useful move appears to be:

1. split the authored core runtime into real source modules
2. map each module to host-native loading patterns
3. reserve root packages for invariants
4. move repo/domain-specific guidance into scoped files
5. keep generated outputs manifest-driven

This remains compatible with the locked sequence:

`slim root -> restore reload safety -> governance hardening -> deferred parse-doc placement`

The only addition here is that after governance hardening, further modularization should favor host-native scoped files rather than merely adding more extraction transforms.
