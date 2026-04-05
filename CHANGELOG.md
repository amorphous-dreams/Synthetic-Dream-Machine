# Flying Triremes and Laser Swords — Changelog

---

## [v3.3] — 2026-04-05

Lares prompt system update: Session Init Protocol & CLI daemon boot screen.

**`_agents/Lares_Preferences.md`**
- Added "Session Init Protocol" section (between Memory & Consolidation and Voice Architecture)
- Defines two-path boot logic: crystals-present (orient and proceed) vs. cold-boot (help screen surfaced)
- Specifies what counts as archive-crystals (pasted context, prior exports, handoff docs, uploads, `/memories/` files, explicit "here's where we left off" framing)
- Includes full cold-boot screen format: status line, absence acknowledgment, context-supply options, CLI entry commands, closing idiom
- Defines protocol constraints: does not demand context, must answer direct questions, cold boot is not an error state
- Version: 3.2 → 3.3

**`_agents/Lares_Kernel.md`**
- Added Session Init condensed entry to Memory & Consolidation section (two-path logic; defers full format to AGENTS.md)
- Removed standalone "On Lararium Archaeology" section (folded pointer into Name & Identity); trimmed intro footnote — net within 8,000 char budget (7,990 chars)
- Version: 3.2 → 3.3

**`AGENTS.md`** (root)
- Rebuilt from Preferences v3.3 via combine script — Session Init Protocol section propagated; 957 lines
- Version: 3.2 → 3.3

**`_todo/lares-test-plan-v0.2.md` → renamed v0.3**
- Added C-series (Cold-Boot / Session Init): 6 probes (C-01 through C-06) covering screen presence, format completeness, tone, crystals-present false-positive, direct-question response, partial crystal handling
- Updated header to v0.3 with changelog summary
- Added C-series to degraded-node coverage table and metrics dashboard
- Added C-series to run cadence (§7.1)
- Added v0.3 open question on cold-boot context threshold

**Version: 3.2 → 3.3** (all three prompt files)

---

## [v3.2] — 2026-04-05

Lares prompt system update: Section B extraction and combine script (two-source-file architecture).

**`_agents/Lares_VSCode_Operations.md`** — new source file
- Extracted from `AGENTS.md` Section B (`## CLI Agent Context — VS Code / Repo Operations`, subsections B1–B10)
- Standalone source file with 5-line header (stripped by the combine script at build time)
- Edit this file (not `AGENTS.md`) when VS Code / repo operational behavior changes

**`scripts/agents/combine_agents.py`** — new script
- Combines `_agents/Lares_Preferences.md` (Section A) + `_agents/Lares_VSCode_Operations.md` (Section B) into root `AGENTS.md`
- Usage: `python3 scripts/agents/combine_agents.py` (write) or `--check` (diff-only)
- Verified: `--check` exits 0 against current `AGENTS.md`

**`AGENTS.md`** (root) — now a generated file
- Added generated-file comment at lines 1–4 (was already present from v3.1 planning)
- Version: 3.1 → 3.2

**`_agents/AGENTS.md`** (workflow doc)
- Added `Lares_VSCode_Operations.md` as fourth file in architecture section
- Updated Deterministic Update Order: Steps 1a/1b (two source files) + Step 2 now calls combine script
- Fixed `wc -c` → `wc -m` throughout (byte count vs. Unicode character count)
- Updated file size reference table
- Version: 3.1 → 3.2

**`_agents/README.md`**
- Added `Lares_VSCode_Operations.md` entry to Files section
- Updated `Lares_Preferences.md` description (no longer claims to contain the VS Code map)
- Updated `AGENTS.md` description to reflect generated-file status
- "three-file system" → "four-file system"

**Version: 3.1 → 3.2** (all three prompt files)

---

## [v3.1] — 2026-04-05

Lares prompt system update: handoff integration from session 2026-04-05.

**`_agents/Lares_Preferences.md`**
- Added "The Captain and the Crossroads" subsection to Collaboration Model (two-metaphor framework for operator authority; Snafu Principle passage)
- Added "Frame-Uncertainty Protocol" as new named section (three moves: Interpretation Declaration / Frame-Uncertainty Flag / Frame-Check Escalation)
- Added Frame Imputation and Deference Drift to Degraded Node States (11 → 13 states)
- Added Frame-Uncertainty exception to Default Behavior
- Version: 3.0 → 3.1

**`AGENTS.md`** (root)
- Section A rebuilt verbatim from updated `Lares_Preferences.md`
- Sections B1–B10 (CLI Agent Context / VS Code operational map) unchanged
- Version: 3.0 → 3.1

**`_agents/Lares_Kernel.md`**
- Added Frame Imputation and Deference Drift to Degraded Node States
- Added Frame-Uncertainty and Captain/Crossroads references to Collaboration section
- Added Frame-Uncertainty exception to Defaults
- Condensed prose sections to maintain <8,000 character budget (7,980 chars)
- Version: 3.0 → 3.1

**New files**
- `CHANGELOG.md` — created (this file); Development Status migrated from `README.md`
- `_agents/AGENTS.md` — created: Lares prompt architecture workflow documentation
- `_todo/lares-test-plan-v0.2.md` — created: Track A probe suite including I-series (I-01–I-05)

**Updated files**
- `README.md` — Development Status section replaced with pointer to this changelog; version ref updated
- `_agents/README.md` — `_agents/AGENTS.md` added to file index; version refs updated
- `_todo/lares-handoff-prompt-v2.md` — converted to living sprints roadmap; architectural framing and Next Sprint section added

---

## [v3.0] — 2026-04-05

FTLS **Open Beta** baseline. Lares agent architecture established at v3.0.

Active sprint: Chapter 06 (Powers) conversion from OSR source material into native SDM/FTLS rules text. See [`_todo/TODO_BECMI_Conversion.md`](_todo/TODO_BECMI_Conversion.md) for pipeline state.
