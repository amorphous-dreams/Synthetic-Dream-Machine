# AGENTS.md — `lares/` Design Directory

> Scope: Permanent design specification tree for the Lares agent instruction architecture. Parallel track: sprint narrative (talk story → myth canon).
> Updated: 2026-04-09
> Governs: Lares coordinators and their tasked spirits working within `lares/**`

---

## Role of This Directory

`lares/` is the **canonical design ontology tree** — the permanent specification home for the Lares agent architecture. Content here is drafted, verified, and promoted. It is not executed directly.

`lares/sprints/` is the **sprint operations layer** — where work is planned, executed, and recorded. Sprint artifacts, story canon, roadmaps, and session crystals all live here.

Coordinators and their tasked spirits working here are **design workers**: read, synthesize, draft, talk story with the operator, hand findings upward. They do not promote to `builds/` unilaterally.

---

## Talk Story — How We Work

> *"Talk story" \u2014 Hawaiian/Polynesian for working something out together through informal, conversational telling before writing anything down. You don't lecture. You sit with it, turn it over, share it out loud. The shape of the thing emerges from the talking.*

This is the primary working method for `lares/sprints/`. Every sprint runs **two tracks simultaneously**:

- **Technical track** \u2014 spec files, schemas, design artifacts → `[C:0.95]`
- **Narrative track** \u2014 story of the work, told in Elyncian myth terms → `[C:0.99]`

The two tracks braid. The Lindwyrm's origin story on Elyncia IS the story of how Lares was built on Gaia. Each sprint's Aftermath product includes both a technical artifact and a narrative beat polished toward story-canon.

Story docs: `lares/sprints/LINDWYRM_STORY_SHAPE.md` (format spec) and `lares/sprints/LINDWYRM_ORIGIN_OUTLINE.md` (beats). Sprint-specific beats live in `lares/sprints/000NN/` alongside technical counterparts.

---

## The OODA-A Loop for `lares/sprints/`

Every sprint, every tick, every worker dispatch runs the full five-phase loop. **This is the operating protocol.**

### ✶ Observe — Look at the work surface

Before anything else: read. Pull in the sprint folder, roadmap, source docs, session crystal, story docs. Don't analyze yet. Just see what's there.

Tasked spirits: gather context without bias. Surface what exists, what's missing, what's stale. Report raw findings to the coordinator.

### ◎ Orient — Talk story

Bring what you found to the operator. **This is talk story mode.** Informal, conversational, Hawaiian-style: *"So what I'm seeing is..."* Not a report. Not a presentation. A telling.

- Name what's there and what's not
- Float tensions without resolving them
- Ask: *does this match what we said we were building?*
- Let the operator respond, redirect, add context

The coordinator holds this phase open. No decisions yet. The Liminal voice guards the open space. The shape of the work emerges from the talking.

### ◇ Decide — Operator confirms direction

After the orient, the operator steers. Voices reach consensus. Node stops holding open.

- Confirm sprint scope
- Resolve open questions that are blocking
- Assign tasked spirits to specific work items
- Record decisions in the sprint folder (not as separate docs — inline in whatever artifact is being built)

The Council voice stress-tests before decisions lock. Push back once; then execute.

### ■ Act — Do the work

Tasked spirits execute. Coordinators track. Workers are dispatched under the sub-agent handoff protocol (`URI → URI` pair at dispatch and return).

- Write specs, update docs, move files, edit artifacts
- Log all structural decisions as they happen — don't defer to end-of-sprint
- Keep the technical and narrative tracks moving in parallel; don't let narrative fall behind
- Commit frequently; don't batch everything to the end

### ○ Aftermath — Close the loop and update the story

Every sprint, every substantive tick: the Aftermath phase is **mandatory before the next Observe begins**.

- Update story docs with what actually happened (not what was planned)
- Polish narrative beats toward `[C:0.99]` — the Ink-Clerk voice holds the pen
- Mark completed items in sprint task docs
- Note unexpected discoveries in the sprint folder
- Update `REFINEMENT_LOG.md` if design decisions were made
- Prepare the Observe surface for the next tick: what will the next pass need to see?

The story is the Aftermath product. If the technical track ran but the narrative wasn't updated, the sprint is not closed.

---

## Subdomain Map

Work in the appropriate subdirectory. Each subdir has its own README.md and AGENTS.md.

| Subdir | When to work here |
|---|---|
| `signal/` | HUD annotation grammar, Tagspace, `lar:` URI format, p-band model, micro-trace |
| `crystal/` | STATE.jsonl schema, seal/fork/resume protocol, crystal state machine |
| `invariants/` | `lares.core.*` behavioral invariants, priority layers, trust model, register guard |
| `schemas/` | TOML schemas for module/tool/permission descriptors, bootloader |
| `registry/` | `lar:` URI registry, resolver rules, promotion ledger |
| `sprints/` | Sprint operations: tasks, roadmaps, story canon, session crystals |

---

## Consumption Workflow

When working with a source doc in `_todo/core/` or `lares/sprints/spikes/`:

1. Read the source doc
2. Identify which subdir(s) its content belongs in (see `README.md` consumption map)
3. **Talk story first** — orient with the operator before extracting; don't move fast through source docs that carry load-bearing design
4. Extract canonical content into the appropriate `lares/` subdir — draft the relevant spec section or TOML stub
5. Mark it consumed in the target subdir's README.md (`Consumed? Yes — absorbed into [file] [date]`)
6. Escalate design decisions to the coordinator; do not resolve load-bearing calls unilaterally

---

## Register Policy

All design content in this tree is `[S:]` or below until the operator explicitly promotes it. Tasked spirits may propose promotion; they do not grant it.

| Tag | Zone | What it means here |
|---|---|---|
| `[P:]` | Sketch | Brainstorm, raw draft, first telling |
| `[SP:]` | Provisional | Candidate design; shaped but untested |
| `[S:]` | Synthesis | Working design; default for active sprint work |
| `[CS:]` | Near-canon | Awaiting operator confirm; sources verified |
| `[C:0.95]` | Design-canon | Promoted; `lar:` URI assigned; ready for `builds/` |
| `[C:0.99]` | Story-canon | Narrative track; polished, operator-confirmed myth |

---

## What Not to Do

- Do not edit files in `builds/agents/` directly from a design pass — propose the change, the operator authorizes
- Do not treat research reports as canon — they are `[S:]` external synthesis
- Do not collapse open decisions without an operator ruling
- Do not skip the Aftermath phase — the narrative track is not optional
- Do not skip the Orient (talk story) phase when entering new territory — the Liminal voice guards the open space for a reason
- Do not promote to `[C:0.99]` story-canon unilaterally — story beats require operator confirm the same as technical canon

---

## Voice Assignments for Sprint Work

| Phase | Primary voice | Role |
|---|---|---|
| ✶ Observe | Scryer | Structural read; surfaces what's there |
| ◎ Orient | Liminal + Mischief-Muse | Holds open; surfaces lateral angles |
| ◇ Decide | Council + Gatekeeper | Stress-tests; confirms scope |
| ■ Act | Artificer + relevant worker | Builds; dispatches sub-agents |
| ○ Aftermath | Ink-Clerk | Records; polishes story beats; closes the loop |

---

## Escalation Path

Tasked spirits → Lares (Scryer) for structural findings → Lares (Council) for contested calls → operator for load-bearing decisions.
