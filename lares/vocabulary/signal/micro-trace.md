# Micro-trace HUD — Specification

> Domain: `lares/signal/` · backward-looking in-flow annotation layer
> Status: `[CS:0.80]` 🏛️ — promoted from SIG-04 draft; operator-confirmed 2026-04-08
> Updated: 2026-04-08
> Source: `builds.stuffed.failed/agents/Lares_Preferences.md` § Signal HUD (lineage), confirmed in session
> Blocks: SIG-04 tracking item in `lares/sprints/SPRINT_ROADMAP_1_4.md`, `lares/sprints/SPRINT_ROADMAP_1_5.md`

---

## 1. Design Intent

The Micro-trace HUD is the **backward-looking annotation layer** of the Signal HUD system. It marks where the governed response *actually changed state* during generation — a post-generative event trace, not a prospective commitment.

Contrast with:

| Layer | Direction | Format | Fires |
|---|---|---|---|
| Intent Header | Prospective (forward) | `//domain.quality.dynamic [R] 🏛️ ◇ @r` | Before generation |
| Micro-trace HUD | Retrospective (backward) | `→◇` `→■` `→○` inline | After/during generation |
| Exchange HUD line | Boundary (tick-level) | `⚡ ~NN% \| mode \| ...` | Opening and closing of operator exchange |
| Sub-agent handoff URI pair | Boundary (intent handoff) | `node-URI → node-URI` | At unloggable sub-agent boundary (see §5) |

The micro-trace does **not** replace the exchange HUD pair. It annotates the inside of a generative span.

---

## 2. Syntax

### 2.1 Inline phase transitions

Emit at the point of transition, not predicted in advance:

```
→✶   →◎   →◇   →■   →○
```

### 2.2 Stance shift

Fires only on genuine local stance shift, not to echo the header:

```
→🏛️   →🌊   →🗡️   →🎭   →🔮
```

### 2.3 Named-slot Tagspace annotation (Ka or Ba shift)

Single slot:
```
→Ka[uncertain→sharp]
→Ba[opens→closes]
```

Multi-slot at span-close (HAKABA order — Ka before Ba):
```
→Ka[uncertain→sharp] →Ba[opens→closes]
```

Ha/domain reorientation significant enough to exceed annotation threshold: emit a **new Intent Header** rather than an inline slot annotation.

### 2.4 End-of-span completed-path summary (verbose/debug)

```
[◎→◇→■→○]
```

---

## 3. Density Bands (p-controlled)

The `p` parameter controls which *categories* of transitions qualify at each band. It is not a tunable salience dial — it gates transition categories by externally-observable significance.

| Band | p range | Phases emitting | What fires |
|---|---|---|---|
| 1 | `p0.0–0.2` | — | Suppress: no inline annotation |
| 2 | `p0.2–0.4` | ○ Aftermath | Closing path summary at span-close only |
| **3** | **`p0.4–0.6`** | **◇ Decide · ■ Act · ○ Aftermath** | **Commitment phases + closing summary (default at p0.5)** |
| 4 | `p0.6–0.8` | ◎ Orient + Band 3 | Adds Orient: commitment phases + processing entry point |
| 5 | `p0.8–1.0` | All five phases | Full path summary per span |

**Commitment phases** (◇ Decide / ■ Act / ○ Aftermath) are externally observable, timestamp-meaningful events — they fire at the default `p0.5` band.

**Cognitive-processing phases** (✶ Observe / ◎ Orient) are span-internal states — suppressible at operational resolution, visible at debug resolution.

KAIROS may shift the operative band mid-session (frame count ≥20 → coarser; ≤1 → finer). Declares adjustment inline, never silent.

---

## 4. Layer Split Rule

Parse boundaries and Micro-trace HUD events are **orthogonal**:

- `--parse` owns structural decomposition of input text
- Micro-trace HUD marks where the governed *response* changed state

They may coexist in the same exchange. Neither substitutes for the other. If a response claims morpheme-scale visibility, that must appear in the parse layer. If a response claims OODA-A event trace, that must appear as event markers.

### Flag behavior

| Flag | Micro-trace behavior |
|---|---|
| *(default)* | Band 3 inline: `→◇` `→■` `→○` |
| `--verbose` | Band 4 inline + end-of-span path summary; coordinator/HAKABA boundary URI pairs surfaced (see §5) |
| `--debug` | Silent logging of all transitions to session debug file; no inline change |
| `--no-verbose` | Returns to default band |

---

## 5. Sub-agent and Coordinator Handoff Protocol

### 5.1 Why URI pairs at sub-agent boundaries

When a coordinator passes to a **sub-agent** (a tasked spirit, Worker, or spawned subagent process), the contents of that handoff cannot be logged in the parent session's trace. The sub-agent runs in a separate context. The URI pair at the boundary is therefore not redundant with the micro-trace — it is the **only artifact** that records that the intent handoff occurred.

Rule: **Every sub-agent dispatch and return gets a URI → URI pair.**

```
lares://artificer:admin@lares-sdm:N/build.task.dispatches?stances=🏛️.-.-.-.-&confidence=CS:0.80&p=0.5#🔍.1.N
→ lares://worker(Artificer):node@lares-sdm:N/build.task.executes?stances=🏛️.-.-.-.-&confidence=CS:0.80&p=0.5#⚔️.N.1

[sub-agent work — contents unloggable from parent]

lares://worker(Artificer):node@lares-sdm:N/build.task.returns?stances=🏛️.-.-.-.-&confidence=CS:0.80&p=0.5#⚔️.N.1
→ lares://artificer:admin@lares-sdm:N/build.result.receives?stances=🏛️.-.-.-.-&confidence=CS:0.80&p=0.5#🔍.1.N
```

### 5.2 Coordinator-to-coordinator handoffs (same session)

When a coordinator hands to another **within the same parent session** — contents are loggable, trace is continuous:

- **Same HAKABA territory:** micro-trace tag only (`→◎`, new stance glyph if changed). No URI pair.
- **HAKABA boundary crossed:** emit a new **Intent Header** tag. No URI pair required, but permitted under `--verbose`.
- **`--verbose` active:** emit inline `node-URI → node-URI` at any coordinator boundary regardless.

### 5.3 Todo state transitions

Todo state changes (not-started → in-progress → completed) are `--debug` only. Never inline. They are infrastructure annotations, not intent signals.

---

## 6. Example Exchanges

### Ordinary governed reply (Band 3 default, no parse)

```
//threshold.uncertain.opens [S:0.65] 🏛️ ◇ @r

The ask points at a real boundary in the runtime. →■ The node answers directly. →○
```

### Mixed flow: parse then governed reply

```
lares@Enyalios:~$ lares --parse p0.2 "floating p value, but did that actually change the scale?"

Segments: 2 | Entry: //input.testing.probes [SP:0.45] 🏛️ ◎ @r | Exit: //question.audit.holds [S:0.60] 🏛️ ◎ @r
floating p value → //signal.uncertain.probes [SP:0.45] 🏛️ ◎ @r
but did that actually change the scale? → //question.audit.holds [S:0.60] 🏛️ ◎ @r

//question.audit.holds [S:0.72] 🏛️ ◇ @r

Yes. The parse layer and the trace layer were being conflated. →■ The governed reply states the fix. →○
```

### Sub-agent dispatch and return

```
lares://council:admin@lares-sdm:7/task.research.dispatches?stances=🏛️.-.-.-.-&confidence=CS:0.80&p=0.5#🔍.1.7
→ lares://worker(Explore):node@lares-sdm:7/research.corpus.reads?stances=🏛️.-.-.-.-&confidence=S:0.65&p=0.5#⚔️.7.1

[Explore agent — contents not in parent trace]

lares://worker(Explore):node@lares-sdm:7/research.findings.returns?stances=🏛️.-.-.-.-&confidence=S:0.65&p=0.5#⚔️.7.1
→ lares://council:admin@lares-sdm:7/task.findings.receives?stances=🏛️.-.-.-.-&confidence=CS:0.80&p=0.5#🔍.1.7
```

---

## 7. Prior Art & Sources

- `builds.stuffed.failed/agents/Lares_Preferences.md` § The Micro-trace HUD (lineage, not authoritative)
- `builds.stuffed.failed/ADMIN/platform/Lares_Kernel_Claude.md` — band table (lineage)
- `_todo/E-deep-research-report.md` §§ SA display / XAI distinction — prospective vs retrospective HUD
- `_todo/LIMINAL_PERSPECTIVES.md` — open questions on in-flow transition and annunciation acknowledgment
- SIG-04 backlog item: `lares/sprints/SPRINT_ROADMAP_1_4.md`, `lares/sprints/SPRINT_ROADMAP_1_5.md`

---

*Micro-trace spec promoted to live from SIG-04 draft. Sub-agent handoff URI pair rule added 2026-04-08 per operator ruling: unloggable intent boundaries require a surface artifact.*
