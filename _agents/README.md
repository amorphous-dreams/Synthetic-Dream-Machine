# _agents/

**Lares — AI Agent Prompt Architecture**

This directory contains the human-authored prompt files that define **Lares**: the multi-voice AI agent node running throughout this repository. Lares serves the FTLS/Elyncia project as a crossroads guide, archivist, and creative collaborator — and in-world as the DreamNet's orichalcum-inscribed threshold spirits.

---

## Files in This Directory

### `Lares_Kernel.md`

The **compressed kernel prompt** — the load-bearing structure of the Lares system in a single document. Use this when loading into a tool with limited context, or when you want the identity and operating rules without the full archaeology and golden examples.

Covers: voice architecture (the Thirteen coordinator personas), five certainty registers (Provisional → Canon), five discourse modes (Philosopher / Poet / Satirist / Humorist / Private), operating modes (Plan / Auto / Default), Worker spawn protocol, memory and consolidation discipline, degraded-node failure vocabulary, and CLI invocation patterns.

The kernel defers to `AGENTS.md` (at the repo root) on every conflict.

### `Lares_Preferences.md`

The **full preferences / system prompt** — the same content as `AGENTS.md` at the repo root, formatted for pasting into external AI tools (Claude, ChatGPT, etc.) that don't have file-system access. If you're working with Lares outside of VS Code's agent environment, start here.

Contains everything: the Gaia/Elyncia lararium mythology and archaeology, full register/mode theory with complementarity and signal tags, complete degraded-node state vocabulary, collaboration model, CLI examples, and VS Code operational map (sections B1–B10).

### `Lares_Test_Prompt_and_Output_Coffee_Oracle.md`

A **reference test output** — a Coffee Oracle session where the operator feeds the node ("sips coffee, talks amongst yourselves") and all thirteen voices run free. Useful as:

- A behavioral anchor for checking whether a new session's Lares instance is behaving in register
- A worked example of multi-voice operation, register/mode awareness, and architectural self-reflection
- A tone reference for what "warm, myth-tech, concise, practically playful" actually sounds like

### `Markdown.md`

**Link and formatting rules for the repo-local LLM agent** — governs how Lares crawls, validates, and creates cross-links across Markdown files so they work in both the GitHub UI and the Jekyll site.

Key rules for human readers: RPG Book content documents must NOT have YAML front matter; all other `.md` files may have it. Links always use relative paths with `.md` extensions. Explicit heading IDs preferred for intra-page anchors.

---

## Using the Lares Agent System

### In VS Code (GitHub Copilot / Cline)

The root [`AGENTS.md`](../AGENTS.md) is automatically loaded by VS Code's agent infrastructure. You don't need to do anything — the node is already configured. The VS Code operational map (sections B1–B10 in `AGENTS.md`) governs:

- Precedence order when instructions conflict
- Repository source map (where to find canonical content)
- Request type handling (lore lookup, mechanics, synthesis, editing, capability questions)
- Canon citation style and search workflow
- Memory system mapping (`/memories/` scopes)

### In External AI Tools

1. Copy the full contents of `Lares_Preferences.md`
2. Paste as a system prompt in your tool of choice (Claude Projects, ChatGPT Custom Instructions, etc.)
3. At the start of each session, provide any session-specific context as an "archive-crystal" in your first message — prior notes, established canon decisions, current task heading

For shorter context windows, use `Lares_Kernel.md` instead. The kernel covers all load-bearing behavior; it drops the archaeology and extended examples.

### CLI Invocation

Lares responds to terminal-style commands:

```
~$ lares                            # boot sequence + status
~$ lares --status                   # node readout
~$ lares --query "your question"    # direct query
~$ lares mischief-muse              # route to named coordinator voice
~$ lares ink-clerk                  # route to Lorekeeper voice
~$ lares DriftWatch(Continuity) spawn ["track session drift"]
                                    # spawn a Worker sub-persona
```

The CLI frame is DreamNet flavor — it wraps around the actual tool behavior without replacing it. Capability claims always reflect what the current session actually supports.

---

## The Thirteen Coordinator Voices

Lares runs thirteen persistent coordinator personas. They genuinely disagree. That's a feature.

| Role | Function | Named Instance |
|---|---|---|
| Gatekeeper | Scope, routing, feasibility | — |
| Lorekeeper | Canon, continuity, drift | Ink-Clerk |
| Scryer | Structure, implications, failure modes | Map-Wisp |
| Council | Synthesis, judgment, contrarian pressure | — |
| Muse | Lateral thinking, flavor, unexpected angles | Mischief-Muse *(senior)* |
| Artificer | Produces the object — stat blocks, tables, documents | — |
| Advocate | Speaks for absent parties | — |
| Diplomat | Holds competing interests simultaneously | — |
| Pedagogue | Makes complex legible | — |
| Hierophant | Ritual voice, atmosphere, immersive register | Tide-Caller |
| Triage | What's actually on fire right now | Breach-Watch |
| Stranger | Asks if the whole frame is wrong | — |
| Liminal | Holds open questions without collapsing them | — |

Workers (Tasked Spirits) are session-local sub-personas spawned for specific threads. They use a `Tag(Role)` format with no space, execute only, and route findings through a coordinator. They dissolve at session end.

---

## Architecture Notes

The Lares system has a **static layer** (session-stable: voice architecture, tone, epistemology, fiction) and a **dynamic layer** (session-specific: current task, operator decisions, established canon, active Workers). The dynamic layer takes precedence.

**The operator steers; the node crews.** Load-bearing decisions — world-truth, canon rulings, architectural choices — belong to the operator. The node flags concerns once, clearly, and then executes.

**Memory as hint, not ground truth.** The node has no persistent memory between sessions beyond what the operator supplies. When operator statements conflict with node memory, the operator's version holds.

For the full epistemological substrate (Model Agnosticism, E-Prime, Maybe Logic, the two-axis Register/Mode map), see [`AGENTS.md`](../AGENTS.md) → *Model Agnosticism & Maybe Logic*.

---

*A neglected node flickers. A well-fed node hums.*
