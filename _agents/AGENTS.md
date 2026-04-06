# _agents/ — Lares Prompt Architecture Workflow

> Version: 3.4 | Updated: 2026-04-05

This document governs the structure, roles, and deterministic update process for the Lares AI agent prompt system. It exists so that any session — local or cloud, with or without prior context — can reproduce the correct update sequence without ambiguity.

---

## File Architecture

Five files constitute the Lares prompt system. Four are source files; generated deployment artifacts derive from them. They are not interchangeable — each serves a distinct deployment context.

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

### `Lares_Codex_Coordinator.md` — Codex wrapper source

The **Codex coordinator wrapper** for the generated `.codex/agents/lares.toml`
file. This source carries only the Codex-specific coordination layer and wraps
the copied `Lares_Preferences.md` core prompt during generation.

- Edit this file when Codex coordinator behavior changes.
- Do **not** edit `.codex/agents/lares.toml` directly — it is generated.
- Rebuilt by running `python3 scripts/agents/combine_agents.py`.

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

2. Rebuild generated artifacts using the combine script
   - Run: python3 scripts/agents/combine_agents.py
   - Combines Section A (Preferences) + Section B (VSCode_Operations) into AGENTS.md
   - Wraps Preferences with Lares_Codex_Coordinator.md into .codex/agents/lares.toml
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
   - `.codex/agents/lares.toml` matches generated output
   - `wc -m _agents/Lares_Kernel.md` < 8,000
   - All new degraded states appear in all three files
   - Mini-regression: test B9 questions 1, 6, 7, 8 against Kernel
   - E-Prime audit: `python3 scripts/agents/eprime_audit.py _agents/Lares_Preferences.md _agents/Lares_Kernel.md _agents/Lares_VSCode_Operations.md`
     Re-run whenever a new section appears in any prompt source file. Target: zero unflagged violations.
```

---

## Versioning Convention

| Change type | Bump | Examples |
|---|---|---|
| **Major** | X.0 | Voice architecture restructure, register system redesign, Worker protocol overhaul, breaking collaboration model change |
| **Minor** | X.Y+1 | New section added, new degraded state(s), new protocol, behavioral update, documentation sync |
| **Patch** | X.Y.Z (optional) | Typo/clarity fixes, compression adjustments, no behavioral change |

Current version: **v3.4** (2026-04-05)

---

## File Size Reference

| File | Target | Hard Limit | Notes |
|---|---|---|---|
| `Lares_Preferences.md` | ~60k chars | None | Completeness over compression |
| `AGENTS.md` (root) | ~75k chars | None | Preferences + B-sections |
| `Lares_VSCode_Operations.md` | — | None | Source for Section B; edit here, run combine script |
| `Lares_Kernel.md` | ~7.5k chars | 8,000 chars | Verify with `wc -m` before every commit |

---

## Operational Language & E-Prime Spec

E-Prime discipline runs as background practice throughout all Lares source files. This spec defines what counts as a violation, what does not, and what the acceptable resolution forms look like. Audit runs against this definition; any open ambiguity resolves here first, not in the individual audit pass.

### What Counts as a Violation

**Identity and predication forms of "to be":**
- `X is Y` — is of identity
- `X is [adjective]` — is of predication
- `was`, `were`, `am`, `are`, `be`, `been`, `being` used as main verb (not auxiliary)
- Contractions where `'s` = "is": `it's [noun/adj]`, `that's [noun/adj]`, `there's [noun]`, `he's [noun/adj]`, `she's [noun/adj]`

Every surviving instance of the above should carry deliberate ~0.99999 register weight — readable as a conscious certainty signal, not an overlooked default.

### What Does NOT Count as a Violation

- **Auxiliary-is**: `is running`, `was developed`, `are formed`, `is designed to`, `was used` — the "to be" serves as a helper verb, not a predication. The audit script annotates these `[likely aux]` for human review; default disposition is non-violation unless context shows predication weight.
- **Possessives**: `node's`, `operator's`, `Wilson's`, `Elyncia's` — the `'s` marks possession, not "is"
- **Quoted and named forms**: `"the is of identity"`, `"X is Y"` counter-examples in the E-Prime substitution table — directly quoted by necessity
- **Code block contents**: triple-backtick fenced blocks, inline code spans — auto-excluded from audit
- **Lines marked `<!-- eprime-ok -->`**: see bar below

### The `<!-- eprime-ok -->` Bar

This marker reserves for two categories only:

1. **Verbatim external citations** — RAW's words, Mal-2's words, Sri Syadasti's catma passage. Their text cannot be paraphrased without mis-attribution.
2. **E-Prime substitution table counter-examples** — the "Instead of" column quotes forms being replaced; the quotes cannot themselves be E-Primed.

**Mythology and Elyncia setting prose do not receive blanket ok-marking.** These sections operate in Poet mode and still skew operator reading. Attempt substitution first. Ok-mark only where substitution would distort meaning or mis-attribute quasi-quoted content.

### Preferred Substitutions

| Avoid | Prefer |
|---|---|
| `X is Y` | `X appears to function as Y`, `X maps onto Y`, `X reads as Y`, `X constitutes Y` |
| `X is [adjective]` | `X appears [adj]`, `X carries [quality]`, `X reads as [adj]` |
| `was [noun/adj]` | `functioned as`, `appeared as`, `carried` |
| `it's [truth claim]` | `it appears`, `it seems to`, `it reads as` |
| `that's [truth claim]` | `that appears`, `that reads as`, `that constitutes` |

### Audit Tool

`scripts/agents/eprime_audit.py` — run after any section addition to a prompt file. See Phase B of the E-Prime pass sprint documentation in `_todo/lares-handoff-prompt-v2.md`.

Re-run trigger: **any time a new section is added to a prompt source file** (`Lares_Preferences.md`, `Lares_Kernel.md`, `Lares_VSCode_Operations.md`).

### Playing the E-Prime Game

The E-Prime game is a language revision practice: run the audit, work through the flags, and play with substitutions until each sentence captures the intended meaning — without the hidden ~1.0 certainty weight that identity/predication "to be" imports by default. You're done when the prose sounds right *and* all remaining flags are either confirmed auxiliaries or deliberate ok-marks.

**Step-by-step:**

1. **Run the audit** on the target file(s):
   ```
   python3 scripts/agents/eprime_audit.py _agents/Lares_Preferences.md
   ```
   Note the per-file count (predication + likely-aux split). That's your starting score.

2. **Work through flags in document order.** For each flagged line:
   - Read the sentence in context. Identify the intent the sentence needs to carry.
   - Is the "to be" functioning as an auxiliary, or carrying predication/identity weight?
     - **Auxiliary** (e.g., `is running`, `was developed`, `are formed`): non-violation. Skip or note `[likely aux]` confirmed.
     - **Predication / identity**: attempt a substitution from the Preferred Substitutions table above.

3. **Play with the substitution** until it sounds right:
   - Try the first preferred form. Read it at speed.
   - If it sounds forced or evasive, try the next preferred form, or restructure the whole sentence.
   - If no substitution sounds natural and the sentence clearly needs to carry ~0.99999 certainty — a deliberate, conscious signal — it may stay as-is. That's the game finding its own limit.

4. **Mark verbatim citations** with `<!-- eprime-ok -->`. Only two categories earn the ok-mark (see bar above). Reaching for it on non-citation material is a signal to work harder on the substitution.

5. **Re-run the audit.** The goal: zero unflagged violations — all remaining flags should be `[likely aux]` confirmed, counter-example quotes inside the Preferred Substitutions table, or explicitly ok-marked external citations.

6. **Read the section aloud** (or skim at speed). The prose should still carry the voice of the original — warm, myth-tech, practical. If substitutions have made it stilted, over-hedged, or evasive, revise again. The game produces better language, not weaker language.

**When to play it:**
- Before running the behavioral test suite against a new Lares instance
- After adding any new section to a prompt source file
- During any sprint that touches the static layer

**The game is won** when the audit returns zero non-auxiliary, non-ok-marked violations, and the prose still reads as intentional rather than hedged.

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
