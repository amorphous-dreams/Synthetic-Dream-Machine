# Platform Best Practices — Lares Agent Infrastructure

This document records per-platform best practices, format constraints, known anti-patterns, and
operational notes for the Lares agent infrastructure. Update here as new platforms ship or docs change.

Sources: VS Code Copilot agent-customization SKILL.md (Sprint 1), Claude Code official docs at
`https://code.claude.com/docs/en/sub-agents` and `https://code.claude.com/docs/en/memory`
(retrieved 2026-04-05).

---

## Platform Status

| Platform   | Status     | Coordinator file                    | Worker files                          | Retire gate |
|------------|------------|-------------------------------------|---------------------------------------|-------------|
| **AGENTS.md** | Active (deferred) | `AGENTS.md` (root)          | —                                     | Retire when all 3 platforms QA'd (see note in combine_agents.py) |
| **Copilot**  | ✅ Sprint 1 complete | `.github/copilot-instructions.md` | `.github/agents/<slug>.agent.md`  | — |
| **Claude**   | ⏳ Sprint 2 pending | `.claude/CLAUDE.md`            | `.claude/agents/<slug>.md`            | — |
| **Codex**    | ⏳ Future          | `.codex/agents/lares.toml`         | `.codex/agents/<slug>.toml`           | — |

---

## VS Code Copilot

**Reference:** agent-customization SKILL.md (2026); VS Code `settings.json` → `chat.agent.enabled`

### Format: `.github/agents/<slug>.agent.md`

```yaml
---
name: "Slug"          # Required — show name in Copilot UI
description: "..."    # Required — discovery surface; determines when Copilot delegates
tools: [...]          # Optional — allowlist; inherits all if omitted
user-invocable: false # Optional — hides from picker; agent invokes only
---
Body is the system prompt for this subagent.
```

### Best practices

- **YAML block must be clean.** Comments (`# ...`) inside YAML frontmatter silently corrupt the
  parser. Generated-file notices go in the Markdown body after the closing `---`.
- **One instructions file.** Use either `AGENTS.md` (root) or `.github/copilot-instructions.md`,
  never both. Our `AGENTS.md` coexists temporarily — known anti-pattern, intentionally deferred
  until all three platforms are QA'd.
- **`description` is the delegation key.** Copilot uses it to decide when to delegate. Write it as
  a clear delegation trigger, not a job title. Include "Use when:" or equivalent phrasing.
  Minimum ~80 characters; include domain keywords.
- **`user-invocable: false`** prevents the agent from surfacing in the @-mention picker — correct
  for Worker Tasked Spirits that should only be invoked by the coordinator, not directly by the
  user.
- **Tool allowlisting:** Prefer explicit `tools` lists over inheriting all tools. Workers should
  have only the tools their role requires. Least-privilege reduces blast radius on misrouted
  delegations.
- **Worker system prompts start fresh.** Subagents receive only their own system prompt plus basic
  environment details — not the parent's full conversation context. System prompt should be
  self-contained enough to operate without coordinator context.
- **Generated file discipline.** Never edit `.github/agents/*.agent.md` directly. Edit
  `_agents/workers/<slug>.md` and run `combine_agents.py`. Verify with `verify_alignment.py`.

### File layout

```
.github/
  copilot-instructions.md      ← Coordinator (Preferences + Section B + Copilot Wrapper)
  agents/
    worker.agent.md
    engineer.agent.md
    researcher.agent.md
    agent-engineer.agent.md
    assistant.agent.md
```

### Known issues / deferred items

- Root `AGENTS.md` coexists with `.github/copilot-instructions.md` — Copilot "use only one"
  anti-pattern. Retire `AGENTS.md` once Copilot + Claude + Codex are all QA'd.

---

## Claude Code

**Reference:** `https://code.claude.com/docs/en/sub-agents` and
`https://code.claude.com/docs/en/memory` (retrieved 2026-04-05)

### Format: `.claude/agents/<slug>.md`

```yaml
---
name: slug              # Required — unique identifier, lowercase + hyphens
description: "..."      # Required — when Claude should delegate to this subagent
tools: Read, Grep, Bash # Optional — allowlist; inherits all if omitted
model: inherit          # Optional — sonnet/opus/haiku/inherit (default: inherit)
---
Body is the system prompt.
```

**Key difference from Copilot:** Claude Code subagents use the same YAML-frontmatter format.
`user-invocable: false` has no Claude equivalent — Claude uses the `description` field and
operator instructions to gate delegation.

### Coordinator: `.claude/CLAUDE.md`

Claude Code reads `CLAUDE.md` (not `copilot-instructions.md`). The project coordinator file lives
at `CLAUDE.md` (root) or `.claude/CLAUDE.md`. Both are loaded — `.claude/CLAUDE.md` takes
precedence when both exist. The docs note:

> "Claude Code reads `CLAUDE.md`, not `AGENTS.md`. If your repository already uses `AGENTS.md`
> for other coding agents, create a `CLAUDE.md` that imports it so both tools read the same
> instructions without duplicating them."

Our approach: generate `.claude/CLAUDE.md` from the same `_agents/` sources (Preferences +
Section B + Claude Wrapper), keeping Lares identity intact without duplicating content.

### Best practices

- **CLAUDE.md size target: under 200 lines.** Content beyond ~200 lines consumes context and
  reduces adherence. Our full Preferences file exceeds this — accepted tradeoff for load-bearing
  myth/protocol content (Claude docs acknowledge the tension). Monitor if adherence degrades.
- **Import syntax for modular rules.** `CLAUDE.md` can import additional files with `@path/to/file`
  syntax. For future growth: move large sections to `.claude/rules/<topic>.md` and import. Rules in
  `.claude/rules/` can also carry `paths:` frontmatter to scope instructions to specific glob
  patterns — load only when those files are active.
- **HTML comments are stripped from CLAUDE.md context.** `<!-- comment -->` blocks are stripped
  before injection into Claude's context window. Generated-file notices and maintainer notes can
  use HTML comments safely — they don't burn context tokens but remain visible when the file is
  read directly. This is cleaner than the Copilot approach (which puts notices in the MD body).
- **Subagent system prompts are isolated.** Subagents receive only their own system prompt plus
  basic environment details (working directory, etc.) — not the full Claude Code system prompt or
  CLAUDE.md. Keep system prompts self-contained.
- **`description` drives delegation.** Claude uses description to decide when to delegate. Include
  "Use proactively" when you want the subagent to be invoked automatically without explicit user
  request. Our workers are coordinator-invoked — keep descriptions as "Use when: ..." triggers.
- **Persistent memory (optional).** Subagents support a `memory: project` field that gives them a
  persistent directory at `.claude/agent-memory/<name>/`. The first 200 lines of `MEMORY.md` in
  that directory loads at session start. Our workers are stateless by design — no `memory` field.
  The main Lares coordinator memory is handled by the `/memories/` system in VS Code.
- **Model selection.** Workers default to `inherit` (same model as main conversation). Override
  with `model: haiku` for fast read-only workers (Researcher, Worker) to reduce latency and cost.
  Override with `model: sonnet` for content-heavy workers (Assistant, Agent-Engineer).
- **`permissionMode`.** Subagents inherit permission mode from the main conversation. Can override
  per-subagent. `plan` (read-only) is a good default for Worker and Researcher. Leave unset for
  Engineer and Agent-Engineer (they need write access).
- **Tool names differ from Copilot.** Claude tools use PascalCase: `Read`, `Write`, `Edit`,
  `Bash`, `Grep`, `Glob`, `WebFetch`, `Agent`. Copilot uses lowercase/camelCase. Source worker
  files currently use Copilot-style lowercase lists — the Claude builder must translate or the
  Claude workers need separate tool fields. **Resolution: store Claude tool names in a separate
  `tools_claude:` frontmatter field in each worker source; fall back to omitting `tools` (inherits
  all) if absent. Review per-worker.**

### File layout

```
.claude/
  CLAUDE.md                    ← Coordinator (Preferences + Section B + Claude Wrapper)
  agents/
    worker.md
    engineer.md
    researcher.md
    agent-engineer.md
    assistant.md
```

### Known issues / open questions

- **Tool name translation:** Worker source files list Copilot-style tools. Claude worker builder
  needs a mapping layer or a separate `tools_claude:` field. Each worker's effective tool set
  should be reviewed against Claude tool names before Sprint 2 ships.
- **Model tuning:** Per-worker model overrides not yet set in source files. Add `model:` to
  worker sources if per-platform model selection is needed (the combine builder can read a
  `model:` field directly from frontmatter and pass through to `.claude/agents/` output).

---

## Codex

**Reference:** Not yet researched. Sprint 3 / Future.

Format expected: TOML manifest + system prompt. Builder and verify support pending. Worker source
files will be shared — only the builder/emit layer will differ.

---

## Build System Quick Reference

```
# Rebuild all platforms:
python3 scripts/agents/combine_agents.py

# Rebuild Copilot only:
python3 scripts/agents/combine_agents.py --platform copilot

# Rebuild Claude only (Sprint 2+):
python3 scripts/agents/combine_agents.py --platform claude

# Check alignment (diff without writing):
python3 scripts/agents/combine_agents.py --check

# Verify all generated files are in sync with sources:
python3 scripts/agents/verify_alignment.py
```

Source files live in `_agents/`. Generated files live in `.github/` (Copilot), `.claude/` (Claude),
`.codex/` (Codex, future). Never edit generated files directly.
