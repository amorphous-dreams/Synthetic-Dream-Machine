# Talk Story — Canonical Protocol

> **Register:** `[C:0.95]`
> **Status:** Active. Operative from pre-Sprint-0 onward.
> **Location note:** This dir (`lares/talk_story/`) is the design truth. `.github/skills/talk-story/SKILL.md` is the VS Code loading surface derived from this spec.

---

## What It Is

Talk story is the ◎ Orient phase of the Lares OODA-A loop. It is the mandatory working method for any problem where the shape hasn't emerged yet. It is not a report, a presentation, or a decision. It is a telling — conversational, informal, joint.

The name comes from Hawaiian/Polynesian usage: working something out together through informal telling before writing anything down. You don't lecture. You sit with it, turn it over, share it out loud. The shape of the thing emerges from the talking.

---

## Protocol Spec

### When to invoke

- Starting a sprint tick and the work surface needs to be read aloud before decisions lock
- A source doc carries load-bearing design that should not be moved through fast
- Two or more valid directions are visible and the operator needs to steer
- Something feels off but the exact tension hasn't been named
- The narrative track has fallen behind the technical track

### When NOT to invoke

- Operator has already confirmed direction → ◇ Decide, execute
- Single deterministic action (edit a file, check a fact) → ■ Act directly
- A previous orient already ran this tick and produced a decision → do not re-open

---

## Procedure

### 1. ✶ Observe first

Read before talking. Pull: sprint task doc, ROADMAP.md, relevant source docs, session crystal if loaded. Surface raw findings without analysis. Observe ≠ Orient.

### 2. ◎ Open

Begin with what you found, stated plainly:

> *"So what I'm seeing is..."*
> *"The tension here is..."*
> *"What's missing from this picture is..."*

Rules:
- **Informal register.** No formal report prose. Short sentences. Direct.
- **Name what's there AND what's not.** Gaps carry as much signal as content.
- **Float tensions without resolving them.** The Liminal voice holds. Don't collapse ambiguity prematurely.
- **Ask the alignment question.** Does this match what we said we were building?
- **Lateral connections welcome.** Mischief-Muse fires during orient, not after.

### 3. Operator responds

The operator steers. This is not the node's phase to resolve. Redirect the telling toward what the operator surfaced.

### 4. ◇ Close when direction is confirmed

Operator confirms scope, resolves the blocking tension, or says "good enough — move." Liminal releases its hold. Record decisions inline in the working artifact — not in a separate doc.

---

## Two-Track Model

Every sprint runs two tracks. Talk story serves both.

| Track | Register | Role |
|---|---|---|
| Technical | `[C:0.95]` | Surface spec gaps, unresolved design questions, stale content |
| Narrative | `[C:0.95]` | Connect technical decisions to Elyncian myth beats; name the story of the work |

A sprint is not closed until both tracks are updated. Narrative beats get polished in ○ Aftermath — raw material comes from talk story.

---

## Voice Assignments During Orient

| Voice | Role |
|---|---|
| Liminal | Holds open space; prevents premature closure; asks "what are we not seeing?" |
| Mischief-Muse | Lateral connections and unexpected reframes |
| Scryer | Structures what was found; names patterns in raw material |

---

## Deployment Surfaces

This spec is the source of truth. Derived artifacts:

| Surface | Path | Notes |
|---|---|---|
| VS Code skill | [`.github/skills/talk-story/SKILL.md`](../../.github/skills/talk-story/SKILL.md) | Discovery surface for Copilot Chat; derived from this doc |
| OODA-A loop ref | [`lares/AGENTS.md`](../AGENTS.md) | Talk story positioned under ◎ Orient |
| Two-track table | [`lares/README.md`](../README.md) | Sprint-level braid of technical + narrative |
| Epic sandbox | [`lares/scrum/epics/TALK_STORY/`](../scrum/epics/TALK_STORY/) | Protocol evolution, backlog, orientation history |

---

## Changelog

| Version | Change |
|---|---|
| v1.0 | Protocol established in pre-Sprint-0 orientation (2026-04-08 browser session) |
| v1.1 | SKILL.md created and validated against VS Code extension format (2026-04-08/09 Claude Code session) |
| v1.2 | Canonical dir created (`lares/talk_story/`); SKILL.md retargeted as derived surface (2026-04-09) |
