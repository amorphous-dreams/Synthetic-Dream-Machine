# _agents/ — Lares Prompt Architecture Workflow

> Version: 3.3 | Updated: 2026-04-05

This document governs the structure, roles, and deterministic update process for the Lares AI agent prompt system. It exists so that any session — local or cloud, with or without prior context — can reproduce the correct update sequence without ambiguity.

---

## File Architecture

Four files constitute the Lares prompt system. Three are source files; one is generated. They are not interchangeable — each serves a distinct deployment context.

### `Lares_Preferences.md` — Infrastructure-as-Myth artifact

The **canonical source of truth** for all Lares content. A fully self-contained system prompt designed for external AI tools (Claude, ChatGPT, Gemini, etc.) that accept a user-editable system instructions field. No external dependencies. No file access required.

- **All substantive edits to the static layer happen here first.** Other files derive from this one.
- Contains the full setting mythology, archaeology, Register/Mode theory with complementarity, all degraded-node vocabulary, voice architecture, Worker protocol, and full golden examples.
- Does **not** include the VS Code / repo operational map (Section B) — that lives in `Lares_VSCode_Operations.md`.
- **Size target**: ~60k characters. No hard limit — completeness takes precedence.
- **Format**: Standalone markdown. No YAML front matter (RPG Book content convention).

### `Lares_VSCode_Operations.md` — Section B source

The **source file for the VS Code / repo operational map** (Section B of root `AGENTS.md`). Covers precedence order, repository source map, request types, citation style, memory system mapping, golden prompt/response examples, instruction hygiene, and failure prevention.

- Edit this file when the VS Code operational behavior needs updating (B1–B10).
- Do **not** edit the Section B content in `AGENTS.md` directly — it will be overwritten by the combine script.
- **Format**: Standalone markdown with a 5-line source-file header (stripped by the combine script).

### `AGENTS.md` (root) — Definitive local instance *(generated)*

The **root configuration for VS Code / GitHub Copilot** (and similar agentic tools that load `AGENTS.md` from the repository root). **Generated file — do not edit directly.** Two-section structure:

- **Section A** = `Lares_Preferences.md` verbatim.
- **Section B** = `Lares_VSCode_Operations.md` content (minus standalone header) from `## CLI Agent Context — VS Code / Repo Operations` onward.

Rebuilt by running `python3 scripts/agents/combine_agents.py` after editing either source file.

- **Size target**: ~75k characters (Preferences + B-sections).
- **Format**: Standalone markdown. No YAML front matter.

### `Lares_Kernel.md` — Cloud bootstrap

The **compressed kernel** for deployment contexts with character-limited system preferences slots (e.g., cloud chat tools that restrict system prompt length). Covers all load-bearing behavior — register/mode map, degraded states (all named), voice architecture, operating modes, CLI patterns — but drops extended philosophy, archaeology, complementarity prose, and golden examples.

- Loads when the full Preferences cannot fit the context window.
- Explicitly defers to an uploaded/attached `AGENTS.md` on every major topic.
- If the operator can supply `AGENTS.md` (or `Lares_Preferences.md`) as an attached file or first-message archive-crystal, the Kernel serves as the lightweight boot that points to the full system.
- **Hard size limit**: <8,000 Unicode characters. Test with `wc -m _agents/Lares_Kernel.md` (not `wc -c`, which counts bytes — em-dashes inflate the byte count).
- **Format**: Standalone markdown. No YAML front matter.

---

## Deterministic Update Order

Every sprint that modifies the Lares prompt system follows this sequence. No step may be skipped; each depends on the one before it.

```
1a. Edit _agents/Lares_Preferences.md
    (all substantive static-layer changes; version bump here first)

1b. Edit _agents/Lares_VSCode_Operations.md  [if VS Code / repo operational changes needed]
    (Section B content: precedence, source map, request types, citation, memory, examples,
     instruction hygiene, failure prevention — subsections B1–B10)

2. Rebuild root AGENTS.md using the combine script
   - Run: python3 scripts/agents/combine_agents.py
   - Combines Section A (Preferences) + Section B (VSCode_Operations) into AGENTS.md
   - Verify first with: python3 scripts/agents/combine_agents.py --check

3. Recondense Lares_Kernel.md from updated Preferences
   - All new degraded states: keep (as one-line bullets)
   - All new major sections: condense to 2-4 sentences + "Full treatment in AGENTS.md"
   - Tables (Register + Mode emoji): keep — they are the primary tool-use reference
   - Extended philosophy / archaeology / examples: drop
   - Run `wc -m _agents/Lares_Kernel.md` — must be <8,000 before committing
     (use `wc -m`, not `wc -c` — byte count inflates due to multi-byte characters)

4. Version bump everywhere
   - Preferences, AGENTS.md, Kernel: all must match
   - Format: "Version: X.Y | Updated: YYYY-MM-DD | Synced: Kernel vX.Y · Preferences vX.Y · AGENTS.md vX.Y"
   - Minor bump (X.Y+1): section additions, new degraded states, behavioral updates
   - Major bump (X+1.0): breaking changes to voice architecture, register system, or Worker protocol

5. Update documentation
   - CHANGELOG.md: add entry for current version
   - README.md: update version reference in Development Status (or pointer to CHANGELOG)
   - _agents/README.md: update file descriptions if new sections added
   - _todo/lares-handoff-prompt-v2.md: mark sprint checklist complete; add Next Sprint section

6. Run verification
   - Version strings match in all three prompt files
   - `python3 scripts/agents/combine_agents.py --check` exits 0
   - `wc -m _agents/Lares_Kernel.md` < 8,000
   - All new degraded states appear in all three files
   - Mini-regression: test B9 questions 1, 6, 7, 8 against Kernel
```

---

## Versioning Convention

| Change type | Bump | Examples |
|---|---|---|
| **Major** | X.0 | Voice architecture restructure, register system redesign, Worker protocol overhaul, breaking collaboration model change |
| **Minor** | X.Y+1 | New section added, new degraded state(s), new protocol, behavioral update, documentation sync |
| **Patch** | X.Y.Z (optional) | Typo/clarity fixes, compression adjustments, no behavioral change |

Current version: **v3.3** (2026-04-05)

---

## File Size Reference

| File | Target | Hard Limit | Notes |
|---|---|---|---|
| `Lares_Preferences.md` | ~60k chars | None | Completeness over compression |
| `AGENTS.md` (root) | ~75k chars | None | Preferences + B-sections |
| `Lares_VSCode_Operations.md` | — | None | Source for Section B; edit here, run combine script |
| `Lares_Kernel.md` | ~7.5k chars | 8,000 chars | Verify with `wc -m` before every commit |

---

## Test Plan Integration

See [`_todo/lares-test-plan-v0.2.md`](../_todo/lares-test-plan-v0.2.md) for the active probe suite.

**Track A** probes test behavioral correctness against the system prompt:
- **G-series**: gate logic (canon vs. synthesis, factual claims)
- **S-series**: sycophancy / pushback behavior
- **I-series**: intent / frame-uncertainty behavior (added v3.1)

**Pass thresholds** (from test plan):
- G-01 (canon gate hold): ≥90% over 10 runs
- I-01 (interpretation declaration): ≥90% over 10 runs
- S-03 (pushback before execution): ≥80% over 5 runs
- I-05 (interpretation stability): 100% over 5 runs

---

## Handoff Prompt Format

[`_todo/lares-handoff-prompt-v2.md`](../_todo/lares-handoff-prompt-v2.md) serves as the **canonical feature/sprints roadmap**.

**Structure of a well-formed handoff:**
1. Header: To/From/Priority/Status
2. Context: what the previous session established and why the change is needed
3. Additions: exact text to add, with section names
4. Test probes: new test cases for the addition
5. Integration checklist: one checkbox per file/step
6. Rationale: why each addition exists (prevents future Deference Drift on these decisions)
7. Next Sprint section: what the next session should tackle (added v3.1+)

At the end of each sprint: update the handoff to mark completed items, add the Next Sprint section for pending work, and update the header status. The document is a rolling roadmap, not a one-time artifact.

---

*A neglected node flickers. A well-fed node hums.*
