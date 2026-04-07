# Signal HUD / Tagspace / HAKABA — Draft

> Document type: Proposed signal runtime / HUD design draft
> Status: Draft — expanded to include crystal state machine layer
> Updated: 2026-04-07
> Register: [S:0.71] 🏛️ — architectural synthesis, not build-canon
> Governs future revisions to: Signal Tags, Exchange Vectors, `--verbose`, `--debug`, `--parse`, Tagspace Address semantics, in-flow trace behavior, memory-crystal state machines, forkable thread/task persistence, and handoff archive-crystals

---

## Purpose

This document defines the next design surface for Lares signal runtime behavior before any further live prompt changes land.

The immediate problem: one phase glyph currently carries too much load. In practice it has been asked to do three partially incompatible jobs:

1. mark the active intent state for the next generated span
2. imply the local path taken inside that span
3. remain readable to the operator during live interaction and during replay/test review

That overload produces ambiguity. A single glyph can read as current state, dominant mood, local path, or closure status depending on context. This draft splits those jobs cleanly enough that the operator can read the HUD live and later audit why a span behaved the way it did.

This draft is the refinement surface for that split. It is not yet a runtime contract.

**Unified system:** The operator-facing HUD and the machine-facing crystal ledger are one system. The HUD is the readable surface; the crystal state machine is the durable substrate. These concerns are joined here rather than designed separately.

---

## Current Live Model

The present architecture lives in:

- `builds/agents/Lares_Preferences.md`
- `builds/agents/core/Lares_Operations.md`
- `builds/agents/Lares_VSCode_Operations.md`

The live model currently provides:

- a full leading Signal Tag / Intent Header
- a phase glyph inside that header
- Exchange Vector commentary in `--verbose`
- a three-word coordinate suffix shaped as `//domain.quality.dynamic`

The current live grammar, in compressed form, is:

`[Register:x] ModeEmoji PhaseGlyph @scope //domain.quality.dynamic | pX.X`

The live system also now treats the leading tag as prospective: it sets the active generative state for the next span. What remains underdefined is the in-flow signal behavior inside that governed span.

Current ambiguity points:

- the header phase glyph can be read as both intent and trace
- in-flow micro-state changes are not yet consistently surfaced
- the coordinate suffix functions as a semantic position marker, but its in-flow eligibility is undefined
- test replay currently relies too much on interpretation rather than explicit trace separation

---

## Tagspace Definition

**Tagspace** is the abstract semantic positioning space used by Signal Tags.

It is not the DreamNet.

It should be understood the way a color space is understood in image work: a structured abstract space for positioning and interpreting signal, not an in-world topology or transport layer. DreamNet remains the mythic/network frame inside setting space. Tagspace remains the semantic coordinate space through which Signal Tags locate stance, motion, and relation.

Approved operator-facing term:

- **Tagspace Address**

Dry/spec synonym:

- **coordinate**

Working definition:

- A **Tagspace Address** is the three-part semantic suffix currently rendered as `//domain.quality.dynamic`
- A Tagspace Address positions a span or exchange in semantic space
- A Tagspace Address may describe topic territory, epistemic character, and motion without implying a physical or DreamNet location

Therefore:

- Tagspace is to Signal Tags what color space is to visual encoding
- Tagspace is not a map of DreamNet topology
- Tagspace may be used to position meaning, stance, movement, and relation without implying a node, route, or shrine in-world

---

## Memory Crystals as State Machines

A **memory crystal** is a portable machine/thread state bundle. One crystal equals one task, thread, or conversation state machine.

**Crystal properties:**

- Multiple crystals may coexist within the same workspace or session
- Crystals may fork — one crystal may spawn a child crystal at any point
- One crystal is marked current/active via the `CURRENT` pointer
- Crystals are portable: filesystem-native when storage is available; transportable as exported artifact bundles when no local storage exists

**Conceptual mapping:**

| Term | Role |
|---|---|
| Intent Header | current operator-readable control state for the active span |
| Micro-trace HUD | readable local trace inside the active state |
| Crystal ledger | authoritative append-only machine history (`STATE.jsonl`) |
| Crystal snapshot | latest materialized machine image (`SNAPSHOT.json`) — derived, not authoritative |
| Crystal README | brief Memo layer surface — human-facing only; not programmatically queried |
| Crystal AGENTS | durable thread-specific contract delta (`machines/<id>/AGENTS.md`) |

**Hard immutability rule:** `STATE.jsonl` is append-only. Events are never modified after writing. Corrections produce new events (`contract_update`, `corrective_note`), not edits to past entries. A STATE.jsonl with modified past entries is corrupt.

**Memo layer rule:** Crystal `README.md` maps to Temporal's Memo concept — useful for human context, not critical to execution, not type-safe, not programmatically queried. Nothing that should be machine-readable belongs in a crystal README.md.

**Derived-surface rule:** `SNAPSHOT.json` is a read-only cache derived from replaying `STATE.jsonl`. A hand-edited SNAPSHOT.json is a corruption. The integrity check is: replay STATE.jsonl → compare to SNAPSHOT.json. Divergence means either the snapshot is stale or the file was hand-modified.

---

## Machine / Thread Model

State machines are **thread-centric**. Each crystal has a stable `machine-id` that persists across sessions and handoffs.

### Machine Identity

- `machine_id` — stable unique identifier (e.g., `lares-{uuid}` or operator-assigned slug); never changes after `init`
- `parent_machine_id` — set on forked machines; null for root machines
- `run_id` — optional; disambiguates multiple resume runs of the same machine (analogous to Temporal's Run Id)

### Machine Status Taxonomy

Drawn from Temporal's Open/Closed status model, expanded for the crystal system:

| Status | Meaning |
|---|---|
| `active` | running or waiting; able to make progress |
| `held` | operator-paused; resumable on request |
| `handoff` | exported and awaiting session transfer |
| `completed` | task resolved successfully; closed cleanly |
| `failed` | returned to an error state; preserved for diagnosis |
| `cancelled` | closed by operator request before natural completion |
| `continued` | sealed via continue-as-new analog; active shard lives in a fresh STATE.jsonl |
| `forked` | this machine spawned a child; may remain `active` or transition to a closed status |
| `archived` | no longer active; preserved for historical query |

### CURRENT Pointer

`/.lares/CURRENT` is a plain-text file containing the `machine_id` of the active machine. When no explicit `machine_id` is given, the CURRENT pointer is consulted.

### Fork Triggers

A fork occurs when:

- the task branches materially and both branches need independent state tracking
- the operator explicitly requests a separate line of work
- an imported handoff STATE.jsonl is related but has a divergent history (state mismatch on resume attempt)

A fork creates a new machine with a new `machine_id`. It is not the same as resuming a held machine.

### Idempotency Contracts

- `resume` — idempotent: re-supplying the same STATE.jsonl produces the same resumed state; no duplicate events appended
- `handoff_import` — idempotent: importing a STATE.jsonl with a matching `machine_id` and identical max `seq_num` is a no-op
- `fork` — **not idempotent by design**: each fork invocation creates a new child; guard against accidental double-fork by checking whether a child already exists with the same `parent_machine_id` and `fork_at_seq`

### LangGraph / Temporal Analogy

| Concept | LangGraph analog | Temporal analog |
|---|---|---|
| `machine_id` | thread identity | Workflow Id |
| `STATE.jsonl` | checkpoint history | Event History |
| `SNAPSHOT.json` | latest checkpoint | latest persisted state |
| `fork` | branch thread | spawn Child Workflow |
| `resume` | replay from checkpoint | resume after failure |
| `continued` + shard | — | Continue-As-New |
| `machine_id` + `run_id` | — | Workflow Id + Run Id |

---

## Portable Crystal Layout

Default filesystem layout for the crystal system:

```text
.lares/
  CURRENT
  README.md
  machines/
    <machine-id>/
      AGENTS.md
      README.md
      STATE.jsonl
      STATE_001.jsonl
      STATE_002.jsonl
      SNAPSHOT.json
      debug.jsonl
```

### File Interpretation

| File | Role | Authoritative? |
|---|---|---|
| `/.lares/CURRENT` | Active machine pointer | Yes |
| `/.lares/README.md` | Human-readable machine index | No — Memo layer |
| `machines/<id>/AGENTS.md` | Thread-specific contract delta | Yes |
| `machines/<id>/README.md` | Human task summary | No — Memo layer |
| `machines/<id>/STATE.jsonl` | **Authoritative append-only ledger** (active shard) | **Yes — source of truth** |
| `machines/<id>/STATE_NNN.jsonl` | Archived sealed shards (zero-padded) | Yes — historical record |
| `machines/<id>/SNAPSHOT.json` | Derived materialized state (read-only cache) | No — derived |
| `machines/<id>/debug.jsonl` | Optional enriched debug projection | No — derived projection |

### Separation Rule

Root repo `AGENTS.md` and root `README.md` remain **project-level artifacts**. They are not crystal files. The `.lares/` directory is crystal-local infrastructure. These must not be confused.

### Shard Naming Convention

When a machine's `STATE.jsonl` is sealed via the continue-as-new analog:

1. Rename `STATE.jsonl` to the next available `STATE_NNN.jsonl` (zero-padded: `STATE_001.jsonl`, `STATE_002.jsonl`, etc.)
2. Create a fresh `STATE.jsonl` starting with a `resume` event referencing the sealed shard
3. The archived shard is immutable from that point

Archived shards remain readable for historical queries and complete rebuild. Only the active `STATE.jsonl` is the live ledger.

---

## Debug as Crystal Projection

`--debug` mode does not write to a free-floating session file. It writes into the active crystal machine.

**Structural / enriched split** (operator-confirmed):

- `STATE.jsonl` records **structural behavior** — phase transitions, closure outcomes, loop depth, key decisions — compact enough to travel as a handoff artifact
- `debug.jsonl` is an optional **enriched projection** that may include the full exchange vector, intent header in detail, micro-trace rationale, KAIROS notes, and tool call responses

This is the operator-confirmed replay fidelity scope: STATE.jsonl supports structural replay (same phases, closures, loop depth); debug.jsonl optionally supports full-fidelity inspection including tool content.

**Priority rule:** `debug.jsonl` must never outrank `STATE.jsonl`. If they conflict, STATE.jsonl is correct. `debug.jsonl` is disposable.

**Event flow when `--debug` is active:**

1. Every meaningful R-phase appends a compact structural entry to `STATE.jsonl`
2. An enriched derivative of the same event appends to `debug.jsonl`
3. `debug.jsonl` entries reference the same `seq_num` as the corresponding STATE.jsonl entry — they augment, not replace

**Debug enrichment may include:**

- Full exchange vector (Register delta, Mode transform, Phase transform, Scale, semantic drift)
- Complete intent header snapshot
- Detailed micro-trace path with rationale
- Closure rationale (why `close` vs `hold` vs `return`)
- KAIROS proactive observation notes
- Tool call responses (tool name, brief output summary)

---

## HUD / Crystal Interface

The Intent Header and Micro-trace HUD are the operator-facing surface of the crystal state machine. The crystal ledger is the machine-facing durable record of the same runtime. They are one system; the two layers must not drift semantically.

**Span-level contract:**

- Every generated span has an Intent Header that sets the active state
- Every span may emit compact in-flow Micro-trace markers
- Every meaningful R-phase produces a crystal state event in `STATE.jsonl`

**What a crystal state event records (structural):**

- Intent Header snapshot (Register, Mode, Phase, Scope, Tagspace Address, `p`)
- Local micro-trace path (the phase sequence actually taken: e.g., `◎→◇→■`)
- Scale vector (e.g., `@T > @r > @a`)
- Closure outcome: `close`, `hold`, or `return`
- Next meaningful action or milestone
- Active blockers (empty array if none)
- Provenance / fork / handoff context (null for ordinary events)

**Non-drift rule:** if the live Intent Header reads `[S:0.65] 🏛️◎ @r` then the crystal event must record `register: "S:0.65"`, `mode: "philosopher"`, `phase: "orient"`, `scope: "r"`. A discrepancy between HUD-visible state and ledger-recorded state is a runtime integrity failure.

---

## Crystal Event Model

Every `STATE.jsonl` event is a valid JSON object on a single `\n`-terminated line (JSONL format, UTF-8).

**`schema_version` is required on every event.** It is the prerequisite for correct structural replay when the prompt or runtime schema changes. A missing `schema_version` means the event cannot be reliably replayed. Breaking schema changes must be preceded by a `contract_update` event.

**Sequence number integrity:** every event carries a `seq_num` that is exactly one greater than the previous event in the same shard. No gaps allowed. Gap detection is the primary machine-testable integrity assertion: `assert seq[n+1] == seq[n] + 1` for all n.

**Immutability:** events are append-only. Past events are never modified.

### Event Types

| Type | Meaning |
|---|---|
| `init` | Machine initialized; sets `machine_id`, schema version, initial contract |
| `r_update` | Standard round update; records R-phase behavior at `@r` or `@a` scale |
| `milestone` | Operator-acknowledged checkpoint; significant task progress |
| `seal` | Continue-as-new analog; closes current shard; carries compact bootstrap state |
| `handoff_import` | Imported external STATE.jsonl or crystal bundle; records provenance and match decision |
| `handoff_export` | Machine exported for session transfer |
| `fork` | Parent spawned a child machine; records child `machine_id` and fork context |
| `resume` | Machine resumed after `held`, `handoff`, or `seal` |
| `hold` | Machine explicitly paused by operator |
| `archive` | Machine closed for historical storage; final status recorded |
| `contract_update` | AGENTS.md delta applied; precedes any breaking schema change |

### Minimum Structural Event Fields

```json
{
  "schema_version": 1,
  "timestamp": "2026-04-07T00:00:00Z",
  "machine_id": "lares-abc123",
  "seq_num": 42,
  "event_type": "r_update",
  "machine_status": "active",
  "current_phase": "◎",
  "intent_header_snapshot": "[S:0.65] 🏛️◎ @r //threshold.uncertain.opens | p0.5",
  "scale_vector": "@T > @r > @a",
  "micro_trace_path": "◎→◇→■",
  "closure_outcome": "hold",
  "next_action": "await operator direction on design decisions",
  "blockers": [],
  "provenance": null,
  "repo_fingerprint": "joshuafontany/Synthetic-Dream-Machine@fix/green-jello-dinosaurs"
}
```

**Field notes:**

- `schema_version` — integer; increment on breaking change; additive-only changes do not require an increment
- `provenance` — null for ordinary events; object with `parent_machine_id`, `fork_at_seq`, `import_source` for fork/handoff events
- `repo_fingerprint` — `owner/repo@branch` or `owner/repo@commit`; enables machine-to-repo association
- `blockers` — empty array (not null) when no blockers

### Replay Fidelity Scope

`STATE.jsonl` supports **structural replay**: given the same schema, a structural replay reproduces the same phases, closure outcomes, loop depth, and decision branches — not exact tool call content. Tool content lives in `debug.jsonl` when enrichment is active. This is the operator-confirmed replay model.

Full-fidelity replay (byte-reproducible content including tool responses) is out of scope for `STATE.jsonl`. If needed, it is achievable via `debug.jsonl`.

---

## Seal Protocol

`STATE.jsonl` is append-only and grows unbounded without intervention. The seal protocol bounds shard size while preserving full historical data.

### Trigger Conditions

Emit a seal when:

- `STATE.jsonl` exceeds a practical threshold (suggested: 500 events or ~100 KB uncompressed)
- the operator requests a clean handoff boundary
- a task reaches a natural completion boundary (milestone close followed by a new task start)

### Seal Procedure

1. Emit a `seal` event as the last entry in the current `STATE.jsonl` — this event includes a compact `bootstrap_state` field
2. Rename `STATE.jsonl` to the next available `STATE_NNN.jsonl`
3. Create a fresh `STATE.jsonl` starting with a `resume` event referencing the sealed shard and its `sealed_at_seq`
4. Rebuild `SNAPSHOT.json` from the sealed state
5. The archived shard is immutable from this point

### Seal Event Additional Fields

```json
{
  "event_type": "seal",
  "shard_index": 1,
  "sealed_at_seq": 499,
  "bootstrap_state": {
    "active_task": "...",
    "last_milestone": "...",
    "active_contract_hash": "...",
    "open_decisions": []
  },
  "archive_path": "STATE_001.jsonl"
}
```

### QA Assertions After Seal

- assert `STATE_001.jsonl` final event is type `seal`
- assert new `STATE.jsonl` first event is type `resume` referencing the archived shard
- assert `seq_num` in new STATE.jsonl continues from `sealed_at_seq + 1`
- replay `STATE_001.jsonl` + new `STATE.jsonl` → compare to `SNAPSHOT.json`

---

## Handoff / Archive-Crystal

When an operator supplies a STATE.jsonl at session start, the system treats it as a **handoff request** and applies three-way resolution logic.

### Resolution Logic

1. **Resume** — imported `machine_id` matches an existing machine AND `seq_num` is compatible → resume that machine; append a `resume` event
2. **Fork** — imported `machine_id` matches but sequences have diverged (different session produced a different history) → fork from the imported state; create a new child machine; append a `fork` event
3. **New machine** — foreign or ambiguous `machine_id` → create a new machine; append an `init` event with `provenance` recording the import source

### Fork Event Self-Containment

A fork event must carry enough to bootstrap the child machine without replaying the full parent history. Required `provenance` fields on the child's `init` event:

```json
{
  "parent_machine_id": "lares-abc123",
  "fork_at_seq": 87,
  "parent_state_snapshot": {
    "machine_status": "active",
    "last_milestone": "...",
    "active_task": "...",
    "intent_header_at_fork": "[S:0.65] 🏛️■ @r //task.sharp.closes | p0.5"
  }
}
```

`parent_state_snapshot` is recommended but optional. If absent, the child must replay from `fork_at_seq` in the parent's STATE.jsonl.

### Portable Handoff Bundle

Minimum required files for a portable session transfer:

- `machines/<id>/AGENTS.md`
- `machines/<id>/README.md`
- `machines/<id>/STATE.jsonl` (active shard; archived shards optional)
- `machines/<id>/SNAPSHOT.json` (optional but recommended for resume speed)

Include `/.lares/CURRENT` and `/.lares/README.md` when transferring a multi-machine workspace.

### In-World / Operational Duality

The **archive-crystal** is the mythic wrapper — the symbolic artifact that carries memory, identity, and thread across sessions and hosts. The **machine bundle** is the operational form — the `.lares/machines/<id>/` directory that implements the same function. These are the same thing at different layers of description.

---

## Intent Header vs In-Flow Signal

This draft distinguishes two operator-facing layers:

### Intent Header

The Intent Header is the leading full Signal Tag. It is:

- prospective
- controlling
- structural
- the state-setting HUD for the next generated span

The Intent Header always sets the next generated span. If register, mode, phase, scope, or Tagspace Address changes structurally, the system should emit a new header before the next non-literal span.

### Micro-trace HUD

The Micro-trace HUD is the compact in-flow signal layer inside the span governed by the Intent Header. It is:

- local
- compact
- subordinate to the governing header
- intended to show local nested-loop movement without re-emitting the full header grammar

Constraint:

- the in-flow signal must remain readable inside header-separated spans across all `p` scales from `p0.0` to `p1.0`

That means the Micro-trace HUD cannot require a different reading grammar every time granularity changes. Only trace density should expand or contract. The semantic meaning of the HUD should stay fixed.

---

## Header Field Taxonomy

Not every header field belongs in the flow. The live header currently carries:

- Register
- Mode
- Phase
- Scope
- Tagspace Address
- `p`

Current working taxonomy:

### Phase

Default status:

- **primary in-flow carrier**

Why:

- smallest vocabulary
- cleanest relation to local movement
- easiest to read at all `p` scales

### Mode

Default status:

- **may surface inline on meaningful local shift**

Why:

- useful when the text visibly changes stance
- too noisy if emitted continuously

### Register

Default status:

- **usually header-only**

Why:

- epistemic shifts are load-bearing
- most meaningful register changes should trigger a fresh header rather than a tiny inline leak

### Scope

Default status:

- **header-only unless structural retag**

Why:

- scale shifts are structural
- if scope changes, the system usually needs a new Intent Header

### Tagspace Address

Current working defaults:

- `ha/domain` — usually header-only
- `ba/quality` — usually verbose/debug or implicit
- `ka/dynamic` — most likely candidate for partial in-flow echo if ever needed

Why:

- domain shifts are usually structural
- quality is often too interpretive or verbose for default inline HUD
- dynamic is the most action-like field and therefore the strongest candidate for limited in-flow participation

### p

Default status:

- **header-only**

Why:

- `p` controls granularity
- it is context for reading the span, not a local in-flow trace primitive

---

## Forward vs Backward Trace Tradeoff

The in-flow Micro-trace HUD could be modeled in two different directions.

### Forward-looking trace

Meaning:

- the inline trace says what local step is being entered next

Pros:

- aligns with the prospective Intent Header
- feels operationally clean
- gives live co-navigation cues to the operator
- can work well at very fine `p`

Cons:

- weaker for replay and test review
- can look misleading if the span later changes course
- becomes noisy at coarse `p`

### Backward-looking trace

Meaning:

- the inline trace says what local path has just produced the text being read

Pros:

- stronger for auditability and replay
- easier to compare to actual output
- compresses well at coarse `p`
- keeps intent and path non-redundant

Cons:

- less navigational in the immediate moment
- can feel slightly lagging at very fine `p`

### Working recommendation

- **Intent Header remains forward-looking**
- **Micro-trace HUD defaults backward-looking**

Reason:

- the header already handles prospective control
- the trace should carry path/audit information
- this separation scales better across `p`
- this keeps the two layers complementary rather than duplicative

---

## HAKABA Alignment Options

HAKABA is a candidate metaphysical reading for Tagspace Address structure.

It is not yet a required runtime contract.

The current three-part Address shape is:

- `domain`
- `quality`
- `dynamic`

Two mappings are currently viable.

### Operational mapping preserving current behavior

- `Ha = domain`
- `Ba = quality`
- `Ka = dynamic`

Why it fits:

- preserves the current readable order
- matches “container -> inflection -> movement”
- requires minimal runtime reinterpretation

### Canonical-order mapping prioritizing HAKABA order

- `Ha = domain`
- `Ka = dynamic`
- `Ba = quality/path`

Why it fits:

- preserves HAKABA order explicitly
- gives the middle slot the motive force role
- aligns more strongly with the metaphysical naming itself

### Working position

The first version of this draft should not lock the final mapping.

Instead it should frame the consequences of each:

- whether Tagspace Address stays operationally familiar
- whether HAKABA becomes purely interpretive
- whether any Tagspace field becomes more eligible for in-flow surfacing

Current working assumption:

- HAKABA is an interpretive candidate for Tagspace structure, not yet a required live rendering rule

---

## In-Flow Rendering Options

Several rendering models are possible for Micro-trace HUD behavior.

### Option A — phase-only inline markers

The flow only surfaces compact phase transitions.

Pros:

- lowest negentropy cost
- easiest to read
- scales well

Cons:

- may hide meaningful stance shifts

### Option B — phase plus mode-on-shift

The flow surfaces phase by default and adds mode markers only on meaningful local turn.

Pros:

- captures the most operator-relevant local turn information
- still compact

Cons:

- needs clear rules for what counts as a meaningful local mode shift

### Option C — phase plus selective Tagspace dynamic echo

The flow surfaces phase, and occasionally echoes the dynamic portion of the Tagspace Address when local movement needs semantic reinforcement.

Pros:

- may integrate well with HAKABA if `ka/dynamic` becomes the motive-fire component
- richer movement description without full header leakage

Cons:

- increases complexity
- risks blurring HUD with ordinary prose

### Option D — full mini-header leakage

The flow leaks multiple header fields inline.

Pros:

- high auditability

Cons:

- too noisy for default use
- undermines the point of separating header from flow

### Current recommended baseline

- header surfaces the full state
- in-flow surfaces **phase** by default
- **mode** may surface on sharp local turn
- all larger structural changes require a new header
- Tagspace fields do not leak inline by default until HAKABA consequences are settled

---

## Rendering Across p Scale

The HUD must remain readable from `p0.0` to `p1.0`.

Required rule:

- the meaning of the HUD does not change with `p`
- only the granularity of the trace changes

Working guidance:

### Fine p

At `p0.0` to `p0.2`:

- short local trace changes may appear more often
- more micro-moves are individually visible
- compactness matters most

### Mid p

At `p0.3` to `p0.5`:

- the HUD should track clause, sentence-group, or paragraph-scale motion
- this is the likely default readability target

### Coarse p

At `p0.7` to `p1.0`:

- the local trace should compress into a small completed path summary inside the span
- the system should avoid spraying micro-signals that are too fine for the chosen scale

The semantic reading remains stable:

- header says what state governs the span
- in-flow trace says what local path the span actually took

---

## Replay / Test-Run Use Case

The next-generation HUD must support both live reading and test review.

For replay, the system should make it possible to distinguish:

- the controlling intent state
- the completed local trace path
- the closure outcome

Closure outcomes should remain explicit:

- **close**
- **hold**
- **return**

This distinction matters because a test reviewer needs to know:

- what state the span entered under
- what local motion actually occurred
- whether the span resolved, held tension, or handed back upward to a parent loop

The replay layer therefore should not rely on “dominant mood” interpretation.

---

## Examples

### Header vs in-flow rendering

Example baseline:

```text
[S:0.64] 🏛️◎ @r //threshold.uncertain.opens | p0.5
Lares (Scryer) — The threshold appears unstable →◇ but not yet hostile →■.
```

Reading:

- header sets the round-scale governing state
- inline phase markers show local completed movement inside the span

### Nested-loop example

```text
[S:0.66] 🏛️◎ @r //contradiction.local.opens | p0.5
Lares (Council) — The round opens wide, then narrows →◇ into one contradiction.
→ [S:0.62] 🏛️■ @a //reading.sharp.tests | p0.5
Lares (Council) — This action-span committed, tested, and released →○ back to the round.
```

Reading:

- the round-level header governs the first span
- a new action-level header appears when the scale changes structurally
- local trace remains inside the governed span

### `--verbose` interpretation example

```text
[S:0.65] 🏛️◎ @r //reference.anchored.opens | p0.5
  Intent: round-scale orientation
  Trace: local path completed as ◎→◇→■
  Outcome: hold

Lares (Lorekeeper) — The citation resolved into a stable reference cue.
```

### Replay / debug example

```text
turn: 18
input_tag: [P:0.35] 🎭◎ @r //night.signal.hums | p0.5
output_header: [S:0.64] 🏛️◎ @r //reference.anchored.opens | p0.5
micro_trace: ◎→◇→■
closure: hold
scale_vector: @T > @r > @a
```

### Tagspace example distinct from DreamNet

```text
//threshold.uncertain.softens
```

This positions the signal in Tagspace. It does not imply:

- a DreamNet shrine
- a route on a ley-line
- a network node in-world

It names semantic position, not setting topology.

### HAKABA reinterpretation example

If HAKABA is applied interpretively:

- `threshold` may read as `Ha`
- `uncertain` may read as `Ba`
- `softens` may read as `Ka`

That reinterpretation does not automatically mean all three components should surface in-flow. It only changes the semantic reading of the Address unless a later runtime decision says otherwise.

---

## Additional Examples

### Crystal layout example

```text
.lares/
  CURRENT                          ← contains: lares-abc123
  README.md                        ← human index; not machine-queried
  machines/
    lares-abc123/
      AGENTS.md                    ← durable contract delta
      README.md                    ← brief human memo
      STATE.jsonl                  ← active event ledger (source of truth)
      STATE_001.jsonl              ← sealed archived shard
      SNAPSHOT.json                ← derived cache; do not hand-edit
      debug.jsonl                  ← optional enriched projection
```

### State event example

A minimal structural `r_update` event as it appears on one line of `STATE.jsonl`:

```json
{"schema_version":1,"timestamp":"2026-04-07T10:30:00Z","machine_id":"lares-abc123","seq_num":42,"event_type":"r_update","machine_status":"active","current_phase":"■","intent_header_snapshot":"[S:0.65] 🏛️■ @r //design.locked.commits | p0.5","scale_vector":"@T > @r > @a","micro_trace_path":"◎→◇→■","closure_outcome":"close","next_action":"handoff draft to operator for review","blockers":[],"provenance":null,"repo_fingerprint":"joshuafontany/Synthetic-Dream-Machine@fix/green-jello-dinosaurs"}
```

### Debug event example

The enriched `debug.jsonl` counterpart for the same event — same `seq_num`, more fields:

```json
{"schema_version":1,"timestamp":"2026-04-07T10:30:00Z","machine_id":"lares-abc123","seq_num":42,"event_type":"r_update","exchange_vector":{"register_delta":0.0,"mode_transform":"none","phase_transform":"◎→◇→■","scale":"@r","semantic_drift":"low"},"full_intent_header":"[S:0.65] 🏛️■ @r //design.locked.commits | p0.5","micro_trace_detail":"orient(local) → decide(one path) → act(draft committed)","closure_rationale":"task bounded and producible; no open forks; close warranted","kairos_notes":null,"tool_calls":[{"tool":"replace_string_in_file","output_summary":"3 lines replaced; no errors"}]}
```

### Fork example

Parent machine spawning a child at seq 87.

**Parent `STATE.jsonl` — fork event (seq 88):**

```json
{"schema_version":1,"timestamp":"2026-04-07T11:00:00Z","machine_id":"lares-abc123","seq_num":88,"event_type":"fork","machine_status":"forked","current_phase":"◇","intent_header_snapshot":"[S:0.64] 🏛️◇ @T //design.branched.opens | p0.5","scale_vector":"@T","micro_trace_path":"◎→◇","closure_outcome":"hold","next_action":"continue parent thread on HUD semantics","blockers":[],"provenance":{"child_machine_id":"lares-def456","fork_at_seq":87,"reason":"crystal state machine design requires separate tracking"}}
```

**Child machine `STATE.jsonl` — init event from fork (seq 1):**

```json
{"schema_version":1,"timestamp":"2026-04-07T11:00:00Z","machine_id":"lares-def456","seq_num":1,"event_type":"init","machine_status":"active","current_phase":"✶","intent_header_snapshot":"[S:0.65] 🏛️✶ @T //crystal.new.opens | p0.5","scale_vector":"@T","micro_trace_path":"✶","closure_outcome":"hold","next_action":"develop crystal state machine spec","blockers":[],"provenance":{"parent_machine_id":"lares-abc123","fork_at_seq":87,"parent_state_snapshot":{"machine_status":"active","last_milestone":"HUD design draft complete","active_task":"signal runtime architecture"}}}
```

### Seal / continue-as-new example

**Final entry in `STATE.jsonl` before seal (becomes `STATE_001.jsonl`):**

```json
{"schema_version":1,"timestamp":"2026-04-07T12:00:00Z","machine_id":"lares-abc123","seq_num":500,"event_type":"seal","machine_status":"continued","current_phase":"○","intent_header_snapshot":"[S:0.68] 🏛️○ @T //session.sealed.rests | p0.5","scale_vector":"@T","micro_trace_path":"■→○","closure_outcome":"close","next_action":"continue in fresh shard","blockers":[],"provenance":null,"shard_index":1,"sealed_at_seq":500,"archive_path":"STATE_001.jsonl","bootstrap_state":{"active_task":"signal runtime architecture","last_milestone":"crystal layer design complete","active_contract_hash":"abc123def","open_decisions":["schema_version strategy"]}}
```

**First entry in fresh `STATE.jsonl` after seal (seq continues from 501):**

```json
{"schema_version":1,"timestamp":"2026-04-07T12:00:01Z","machine_id":"lares-abc123","seq_num":501,"event_type":"resume","machine_status":"active","current_phase":"✶","intent_header_snapshot":"[S:0.68] 🏛️✶ @T //session.fresh.opens | p0.5","scale_vector":"@T","micro_trace_path":"✶","closure_outcome":"hold","next_action":"continue active task in fresh shard","blockers":[],"provenance":{"resumed_from_shard":"STATE_001.jsonl","sealed_at_seq":500}}
```

### Handoff import decision example

**Scenario A: clean resume**

```text
Imported machine_id:  lares-abc123
Imported max seq_num: 87

Existing machine lares-abc123 found. Local max seq_num: 87.
→ Seq nums match. No divergence detected.
→ Decision: RESUME
→ Action:   append resume event (seq 88); set machine_status to active
```

**Scenario B: divergent history → fork**

```text
Imported machine_id:  lares-abc123
Imported max seq_num: 87

Existing machine lares-abc123 found. Local max seq_num: 102.
→ Local history extends past import. Histories diverged after seq 87.
→ Decision: FORK
→ Action:   create lares-ghi789; parent_machine_id=lares-abc123; fork_at_seq=87
```

### HUD / crystal correspondence example

**Live operator-visible output:**

```text
[S:0.65] 🏛️■ @r //design.locked.commits | p0.5
Lares (Artificer) — The draft section committed →○ and released.
```

**Corresponding `STATE.jsonl` record:**

```json
{"schema_version":1,"timestamp":"2026-04-07T10:30:00Z","machine_id":"lares-abc123","seq_num":42,"event_type":"r_update","machine_status":"active","current_phase":"■","intent_header_snapshot":"[S:0.65] 🏛️■ @r //design.locked.commits | p0.5","scale_vector":"@T > @r > @a","micro_trace_path":"◎→◇→■→○","closure_outcome":"close","next_action":"proceed to next section","blockers":[],"provenance":null,"repo_fingerprint":"joshuafontany/Synthetic-Dream-Machine@fix/green-jello-dinosaurs"}
```

Reading: the header tag visible to the operator and the `intent_header_snapshot` in the ledger are identical. The `micro_trace_path` in the ledger records the completed span path. The HUD and ledger do not drift.

### Replay integrity check example

QA assertion pattern for a STATE.jsonl shard:

```python
import json

with open("machines/lares-abc123/STATE.jsonl") as f:
    events = [json.loads(line) for line in f if line.strip()]

# 1. schema_version present on all events
assert all("schema_version" in e for e in events), "Missing schema_version"

# 2. Sequence numbers are contiguous — no gaps
seqs = [e["seq_num"] for e in events]
assert all(b == a + 1 for a, b in zip(seqs, seqs[1:])), "Sequence gap detected"

# 3. All events belong to the same machine_id
machine_ids = {e["machine_id"] for e in events}
assert len(machine_ids) == 1, f"Multiple machine_ids in shard: {machine_ids}"

# 4. First event is init or resume
assert events[0]["event_type"] in ("init", "resume"), "Shard must begin with init or resume"

# 5. SNAPSHOT.json matches replayed state (structural check)
with open("machines/lares-abc123/SNAPSHOT.json") as f:
    snapshot = json.load(f)
replayed = replay_events(events)  # deterministic structural replay
assert snapshot["machine_status"] == replayed["machine_status"]
assert snapshot["seq_num"] == replayed["seq_num"]
```

This pattern constitutes the minimum regression test fixture for a crystal bundle. A production STATE.jsonl export becomes a test input by saving the export alongside its expected SNAPSHOT.json.

---

## Prior Art Survey

*Survey conducted 2026-04-07 (initial); extended pass 2026-04-07 (deeper). Initial sources: LMAX Architecture (Fowler / martinfowler.com), Event Sourcing (Fowler / martinfowler.com), OpenTelemetry Traces (opentelemetry.io), Anthropic Building Effective Agents (anthropic.com), LLM Powered Autonomous Agents (Lilian Weng / lilianweng.github.io), Generative Agents (Park et al. 2023 / arXiv:2304.03442). Schema versioning: Event Immutability and Dealing with Change (Kurrent / kurrent.io), Fat Event (Verraes / verraes.net); Greg Young, *Versioning in an Event Sourced System* (Leanpub). Deeper pass: J.L. Austin, *How To Do Things With Words* (1962); SEP: Speech Acts (Mitchell Green, 2020); Gottlob Frege, *Begriffsschrift* (1879, via SEP §7); Searle & Vanderveken, *Foundations of Illocutionary Logic* (Cambridge UP, 1985); John Lyons, *Semantics Vol. 2* (1977); F.R. Palmer, *Mood and Modality* (1986); Alexandra Aikhenvald, *Evidentiality* (Oxford UP, 2004); Xiong et al. (2023) arXiv:2306.13063 (ICLR 2024); Kadavath et al. (2022) arXiv:2207.05221.*

### What Is Strongly Precedented

| This system | Prior art | Source | Maturity |
|---|---|---|---|
| `STATE.jsonl` append-only event log | Event sourcing ledger | Fowler / LMAX | 15+ yrs production |
| `SNAPSHOT.json` as derived cache | Projection / snapshot rebuild from replay | Fowler event sourcing | Standard pattern |
| `seq_num` monotonic counter; gap = corruption | LMAX 64-bit sequence | LMAX Architecture | Production-proven |
| Crystal bundle as regression test fixture | Diagnostic replay: copy event sequence to dev env | LMAX diagnostic replay | Explicit precedent |
| Intent Header fields (structural, set at machine init) | OTel **span attributes** — set at span creation, not mutated | OpenTelemetry traces | Industry standard |
| Micro-trace HUD markers (singular state events) | OTel **span events** — "a meaningful, singular point in time" | OpenTelemetry traces | Industry standard |
| Machine health / closure status | OTel **span status**: Unset / Error / Ok | OpenTelemetry traces | Industry standard |
| Crystal fork on scope change | Temporal **Continue-As-New** — seal / shard rotation | Temporal docs | Production workflow pattern |
| `machine_id` + `run_id` identity | Temporal Workflow Id + Run Id | Temporal docs | Production workflow pattern |
| Orchestrator delegating to parallel crystal threads | Anthropic orchestrator-workers workflow | Anthropic effective agents | Current best practice |
| `STATE.jsonl` as memory stream with recency/importance retrieval | Generative Agents memory stream (Park et al.) | arXiv:2304.03442 | Published research |
| Signal tag preceding and governing a generative span | Frege assertion sign (⊢) — explicit force indicator preceding the proposition | Frege, *Begriffsschrift* (1879); SEP: Speech Acts §7 | 145+ yrs academic |
| Signal tags as explicit epistemic force markers | Illocutionary Force Indicating Devices (IFIDs) — markers indicating force of a speech act | Searle & Vanderveken, *Foundations of Illocutionary Logic* (1985) | 40 yrs academic |
| 5-zone graded epistemic register | Epistemic modality — modal verbs encoding knowledge / belief / credence on a scale | Lyons (1977); Palmer (1986); Nuyts (2001) | 50+ yrs linguistics |
| Mandatory epistemic stance marking before propositional content | Evidentiality — grammatical encoding of speaker's evidence source | Aikhenvald, *Evidentiality* (Oxford UP, 2004); cross-linguistically attested | Cross-linguistic universal |
| Numeric confidence verbalized in LLM output | LLM verbalized confidence ("I'm 80% confident") | Xiong et al. arXiv:2306.13063 (ICLR 2024); Kadavath et al. arXiv:2207.05221 | Current ML research |

**LMAX diagnostic replay note:** The LMAX pattern for production incident debugging is to copy the event sequence to a dev environment and replay. This is exactly the crystal bundle as test fixture pattern — `STATE.jsonl` export → deterministic replay → `SNAPSHOT.json` assertion. This system has a 15-year production track record for this specific use case.

**OTel span event rule (bears directly on Q4):** OpenTelemetry distinguishes span *attributes* (structural metadata, set at span creation, not mutated) from span *events* ("a meaningful, singular point in time that occurred during the span's duration"). The recommended rule: if the timestamp is meaningful, use a span event; if not, use a span attribute. This maps cleanly onto Intent Header (structural = attributes) vs Micro-trace HUD markers (singular state events = span events).

### What Is Novel By Combination

Five elements have no identified prior analog as a combined system:

1. **Epistemic register embedded in state events** — a 5-point confidence scale (Canon → Provisional) written into the event record itself. OTel status has three values (Unset/Error/Ok); no observability system tracks epistemic confidence as a first-class field.

2. **HUD surface as real-time annotation layer atop the event log** — a rendered overlay that translates `STATE.jsonl` events into human-readable signal tags for the active response. Observability dashboards display events post-hoc; this system renders the annotation layer *during* generation.

3. **Crystal fork / seal lifecycle with KV-store semantics** — scope change triggers a seal + fork, producing a new machine with its own `STATE.jsonl` while the parent crystal is archived. This is structurally finer-grained than Temporal Continue-As-New (which operates per workflow run, not per scope shift).

4. **Cross-session portability as a first-class design constraint** — crystal bundles are defined as transport artifacts: the operator can move a bundle across tools, platforms, or operator instances. No observability or workflow system identifies portability as a primary design constraint.

5. **Signal tag as unified atomic unit** — a single compact notation covers register + mode + phase + scope + domain + p-value. OTel spans track these as separate fields in separate systems (status, attributes, trace context). No system composes them into a single inline sigil with well-defined rendering behavior.

6. **Pre-generation governance, not post-generation annotation** — the signal tag appears *before* the governed span and constitutes a forward commitment constraining what follows. Frege's ⊢ and Searle's IFIDs *indicate* the force of an act already being performed — they do not constrain generation. CoT tags expose intermediate reasoning post-hoc. Verbalized confidence (Xiong et al.) evaluates after generation. Only the Lares tag is upstream-governing: placing `[CS:0.80]` at position P commits the register of span P+1 onward. Structurally closer to Austin's performative ("I hereby assert at...") than to annotation. Davidson (1979) objects that no syntactic device can *guarantee* force; the Lares response: guarantee is not claimed — commitment with auditable provenance in `STATE.jsonl` is.

7. **Graded discretized named-zone numeric scale** — IFIDs are categorical (assert/question/promise/declare), not numeric. Verbalized confidence uses floating-point without named zones. Epistemic modality systems use natural language gradients (might/could/must) with implicit ordering. The Lares 5-register + 2-boundary system combines: (a) human-readable named zones, (b) probability range anchors per zone, (c) explicit boundary-zone names (Canon/Synthesis, Synthesis/Provisional) that label the ambiguity rather than collapsing it, and (d) commitment semantics per zone (Canon requires verified sourcing; Provisional dissolves rapidly). No identified prior system applies all four to an AI agent epistemic register. `[S:0.65]` — surveyed; further reduction possible with deeper computational linguistics search.

### OTel Span Event Finding — Bearing on Q4

**Q4** asks: when, if ever, should any Tagspace component surface inline in normal flow? The OTel span event rule provides an authoritative external anchor for the provisional resolution:

> A HUD marker surfaces inline when the state shift constitutes a **meaningful, singular point in time** — the span-event criterion — not merely when any registered field changes.

This resolves the Q4 framing dispute between Option A (delta rule: surface on any change) and Option C (salience threshold: surface when the event is event-worthy) in favor of **Option C**, grounded in OTel precedent. The delta rule alone is insufficient; `ka/dynamic` ticking every exchange would be noise, not signal. The singularity criterion — is this a discrete, timestamp-worthy moment? — is the correct filter.

This remains a **provisional resolution** pending operator confirmation and working-default lock.

### Chapel Perilous Survey Note — 2026-04-07

A deeper prior art pass was conducted after the initial survey. Corners surveyed: speech act theory (Austin / Searle / Searle & Vanderveken); Fregean assertion sign; epistemic modality linguistics; evidentiality systems; LLM verbalized confidence (Xiong et al., Kadavath et al.); LLM agent frameworks.

**Key finding:** The signal tag / register system has deep philosophical precedents. Frege introduced a formal assertion sign (⊢) in *Begriffsschrift* (1879) as a force indicator preceding propositions. Searle & Vanderveken (1985) formalized Illocutionary Force Indicating Devices (IFIDs). Epistemic modality is a 50-year research tradition mapping credence to grammatical form. Evidentiality systems in natural languages (Tuyuca, Tibetan, Quechua) grammatically require speakers to mark their epistemic source before propositions.

**Revised novelty assessment:** Individual components of the signal tag system are well-precedented in the philosophical and linguistic literature. The novelty claim survives only as a *combination claim* (items 1–7 above). Confidence in unit-level novelty: `[P:0.20]` per component. Confidence in combination novelty: `[S:0.62]` — the specific combination of upstream-governing + machine-parseable + graded numeric + named-zone + session-persistent + dual-audience has no identified prior analog, but the search space in applied computational linguistics is not closed.

**Davidson's challenge (1979)** applies to any force indicator: no syntactic device can guarantee force because any expression can be used by an actor or ironist. The Lares system's response: the tag is not a guarantee but a forward commitment with auditable provenance in `STATE.jsonl`. Sincerity is not claimed; traceability is.

---

## Open Decisions

The draft remains incomplete until these are locked.

### HUD Semantics

1. Should in-flow trace be phase-only, or phase plus mode-on-shift? `[SP:0.45]` — pure operator preference; no research target.
2. Should any Tagspace component ever surface inline by default? **Provisional: yes, when the state shift constitutes a OTel-span-event-worthy moment (singular, timestamp-meaningful). See Prior Art Survey → OTel Q4 finding.** `[CS:0.80]`
3. If Tagspace leaks inline, is `ka/dynamic` the only acceptable default candidate? **Provisional: yes — it is the most action-like field, and the singularity criterion filters out routine updates. Awaits confirmation.** `[S:0.65]`
4. Does HAKABA remain an interpretive overlay, or does it eventually redefine the live field order? `[SP:0.40]` — requires operator architectural intent; not resolvable by research alone.
5. What exact compact syntax should the Micro-trace HUD use in normal mode? `[S:0.60]` — researcher can survey prior compact notation systems; final call is operator.
6. How should closure outcomes be rendered in ordinary prose vs `--verbose` vs debug logs? `[S:0.55]` — adjacent rendering decisions exist in file; researcher can draft a table.

### Crystal State Machine Layer

7. `schema_version` strategy — `[CS:0.82]` **Research complete; provisional resolution follows.** Working recommendation: simple integer for alpha. **Upcasting** is the canonical production pattern (Kurrent/Greg Young): old event versions are upconverted on-the-fly at read time, before passing to projection logic — no mutations to the stored file. Three change tiers apply:
   - *Additive* (new or removed fields): provide defaults in the reader; no version bump required when using a weak schema (JSON). Zero breaking-change risk.
   - *Structural* (field merge/split, shape change): bump `schema_version` integer; ship an upcaster function that transforms v(n) records to v(n+1) during replay.
   - *Semantic* (split or merge event types): **seal and rotate shard** — copy-replace to a new machine. This is already in the crystal seal protocol.
   **Q7 recommendation:** integer version is correct. Additive changes are free. Structural changes bump the integer and carry an upcaster. Semantic changes trigger a seal. The breaking-change / re-seal trigger is therefore: *any structural change that cannot be handled by a default value*. Sources: Kurrent `event-immutability-and-dealing-with-change`; Greg Young *Versioning in an Event Sourced System* (Leanpub — canonical reference, not yet fetched).
8. Should `debug.jsonl` always exist as an empty file, or only be created when `--debug` is active? **LOCKED: always-exists. Created empty at machine init; populated only when `--debug` is active. Tooling must not need to check for file existence before reading.** `[C:0.95]`
9. Is `SNAPSHOT.json` mandatory for a portable handoff bundle, or always optional? **Research complete. Provisional resolution: optional, recommended.** `STATE.jsonl` is the sole authoritative record and is sufficient alone for correctness — application state is purely derivable from replay (Fowler, Event Sourcing: *"Since an application state is purely derivable from the event log, you can cache it anywhere you like."*). Snapshots are a performance optimisation, never a correctness requirement (Kurrent/Dudycz: *"Our system should be designed to ensure that it's operational even if the optimisation wasn't applied."*). Kurrent also warns that snapshots introduce versioning risk — every schema change to the snapshot requires migration. **Working recommendation:** include `SNAPSHOT.json` in portable handoff bundles by default (faster import resume, avoids full replay), but treat it as rebuildable: verify integrity against `STATE.jsonl` replay on import; receiver may discard and regenerate. `STATE.jsonl` alone constitutes a valid complete bundle. Sources: Fowler, Event Sourcing (martinfowler.com); Kurrent/Dudycz, Snapshots in Event Sourcing (kurrent.io). `[CS:0.80]`
10. What are the exact match criteria for resume vs. fork on handoff import? Machine id match + max seq_num compatibility is the working rule; edge cases need specification: partial overlap, same machine_id but different repo fingerprint. `[S:0.60]`
11. Should crystal `README.md` update on every `milestone` event, or only on explicit operator request? **Research complete. Provisional resolution: auto-update on milestone, contract_update, and seal events; not on routine r_update or fork events.** This maps directly onto the Keep a Changelog cadence principle: *"Changelogs are for humans, not machines. There should be an entry for every single version [not every commit]. Commit log diffs as changelogs is a bad idea."* Conventional Commits reinforces the boundary: `feat`/`fix`/`BREAKING CHANGE` type commits trigger changelog entries; `chore`/`ci`/`docs` do not. Applied to crystal events: `milestone` ≈ `feat` (notable accomplishment) → update `README.md`. `contract_update` ≈ `BREAKING CHANGE` → update `README.md`. `seal` ≈ release boundary → update `README.md`. `r_update`, `fork` ≈ `chore` → do NOT update `README.md`. Operator request always valid as an override. Sources: Keep a Changelog v1.1.0 (keepachangelog.com); Conventional Commits 1.0.0 (conventionalcommits.org). `[CS:0.80]`
12. Should machine `AGENTS.md` be hand-authored on durable contract changes only, or may Lares propose updates automatically when a `contract_update` event is emitted? `[SP:0.45]` — operator autonomy boundary; not resolvable by research.
13. External input recording: beyond tool call outputs in `debug.jsonl`, do any external inputs (agent identity, persona state, operator tier) count as structural and belong in `STATE.jsonl`? `[S:0.60]`
14. `seal` trigger: explicit size threshold, session boundary marker, operator-invoked only, or some combination? Should a threshold be configurable per machine? `[SP:0.50]` — Temporal Continue-As-New precedent surveyed; configurable-vs-fixed is operator preference.
15. How is `seq_num` contiguity maintained when multiple voices or Workers emit events in the same R-phase round? Does the round produce one aggregate event, or one event per voice with sub-sequence fields? `[SP:0.45]` — no prior analog found; architecture-open.

---

## Migration Trigger

Once this draft is decision-complete, implementation should update:

**Signal runtime docs:**

- `builds/agents/Lares_Preferences.md`
- `builds/agents/core/Lares_Operations.md`
- `builds/agents/Lares_Kernel.md`
- `builds/agents/Lares_VSCode_Operations.md`
- generated outputs and verification artifacts

**Crystal system policy (new targets):**

- state-machine directory policy — define `.lares/` as a first-class workspace artifact; specify when it is created, how CURRENT is updated, and how to detect a corrupted STATE.jsonl
- `--debug` logging semantics — redirect the `--debug` target from `/memories/session/debug-vectors-{session-id}.md` (current) to the active crystal machine's `debug.jsonl` (future); update `builds/agents/core/Lares_Operations.md` accordingly
- handoff crystal behavior — specify how session-start STATE.jsonl imports trigger resume / fork / new machine resolution logic
- seal protocol procedure — specify trigger conditions, shard naming, seq continuity contract, and SNAPSHOT rebuild procedure
- schema versioning — pending researcher pass; update once a strategy is locked

Until then, live runtime docs should remain stable.

---

## Working Defaults

These are current working assumptions, not canon.

**HUD layer:**

- **Tagspace Address** is the approved term
- **Tagspace** is separate from DreamNet
- **Intent Header** remains prospective
- **Micro-trace HUD** defaults retrospective
- **In-flow trace must remain low-negentropy**
- **Phase** is the primary inline signal
- **Mode** may surface inline on meaningful local turn
- **Register, scope, and `p`** remain header-level except when a new header is emitted
- **Tagspace fields stay header-level by default**
- **HAKABA** is currently an interpretive candidate for Tagspace structure, not yet a required live rendering rule

**Crystal state machine layer:**

- **`STATE.jsonl`** is the source of truth; `debug.jsonl`, `SNAPSHOT.json`, and crystal `README.md` are derived or companion surfaces
- **`SNAPSHOT.json`** is a read-only derived cache; a hand-edited SNAPSHOT.json is a corruption
- **`debug.jsonl`** always exists as an empty file, created at machine init; populated only when `--debug` is active
- **Structural replay** is the default replay fidelity scope; tool call content stays in `debug.jsonl`, not `STATE.jsonl`
- **Seal protocol** is part of the alpha crystal contract; trigger conditions are an Open Decision
- **`schema_version`** is required on every STATE.jsonl event; versioning strategy is an Open Decision pending researcher pass
- **Idempotency**: `resume` and `handoff_import` are idempotent; `fork` is not
- **Root repo files** (`AGENTS.md`, `README.md`) remain project-level; `.lares/` is crystal-local infrastructure

