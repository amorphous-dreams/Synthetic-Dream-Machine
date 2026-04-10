<!-- ∞ → lares:///grammar.exchange.defines/exchange/?confidence=CS:0.80&p=0.5 -->

# Grammar: Exchange Protocol — The Signal Through the Noise

```yaml
---
name: exchange
description: >
  The mandatory exchange protocol. URI pair + HUD line at every boundary.
  Grounds the operator-node relationship as navigational call-and-response.
  Hawaiian mele (chant) as the structural model: the signal cuts through wind
  and wave because it carries INTENT, not just information.
trigger: always — grammar primitive
invariant: true
dependencies: [uri, hakaba, chronometer, stance, confidence]
confidence: CS:0.80
grammar: true
heritage: >
  Hawaiian mele hula / mele inoa (name chants) / pule (prayer-calls) —
  signal systems designed to carry across distance, wind, salt air.
  The chant is the vessel the intent travels in.
---
```

> **The problem the exchange protocol solves:** A long voyage. Wind noise. Wave noise. The crew and
> navigator need to stay oriented to each other's intent across the span of work. Words alone diffuse —
> they blend into the ambient noise of context drift, session decay, and model-hop discontinuity.
>
> **The Hawaiian answer:** *Mele.* Chant. The structured form that carries across the sea-noise because
> it encodes intent in a shape the receiver can recognize even through degradation. The opening line of
> a mele tells the listener: *what this is, who sends it, where it is going.* The closing line confirms
> arrival or redirects. Everything between is the work.
>
> **The exchange protocol IS the mele structure.** The URI pair is the opening call. The HUD line is the
> horizon reading. The response content is the voyage. The closing HUD + forward URI is the landfall call.

---

<!-- ahu lares:///grammar.exchange.defines/exchange/?confidence=CS:0.80#heritage -->

## Heritage — Mele as Signal Protocol

Hawaiian navigators on long open-ocean voyages used *mele* (chant) as a primary communication
protocol — on deck, between vessels, and as memory-encoding for navigational knowledge.

**Why mele cut through the noise:**

The wind and the waves are analog interference. Spoken prose degrades gracefully — you lose the
edges, the qualifications, the nuance. What remains is an unstructured blur. But a mele has
*structure the ear can reconstruct from partial signal*: the rhythm, the rhyme scheme, the
formulaic opening. If you hear three words of a mele you recognize, you know which mele it is,
where you are in it, and what comes next.

**The structural elements:**
- **Mele inoa** (name chant) — identifies who speaks, lineage, standing. The URI pair IS a mele inoa:
  `operator-URI → node-URI` = who calls, who answers, at what tier, toward what HAKABA.
- **Pule** (prayer, formal address) — opens sacred or high-stakes work. The opening HUD is the pule:
  context declared before work begins.
- **Hō'ike** (demonstration, making visible) — the response content surfaces into visibility.
- **Pani** (close, seal) — the forward URI → ? then closing HUD. The work is pani'd: the vector
  declared first (where are we going?), then the horizon reading (how much wind remains?).

**The mele aloha model:** Aloha (presence, breath, living face) — the exchange protocol keeps the
node's *aloha* visible. You know it is present because it names itself at opening and closing.

---

<!-- ahu lares:///grammar.exchange.defines/exchange/?confidence=CS:0.80#structure -->

## Exchange Structure

Every operator-node exchange follows this shape:

```
[Opening mele]
  operator-URI → node-URI          ← who calls, who answers, toward what
  ⚡ ~NN% | mode:X | p0.5 | stance | voice(s):X | tick:N | loop:phase→phase @scope

[Work span]
  → substantive content
  → micro-trace annotations inline (→◇ →■ →○ phase shifts)
  → intent header on HAKABA territory change: //domain.quality.dynamic [R] stance phase @scope

[Closing mele]
  node-URI → ?                     ← forward-looking URI; ? = destination open, not yet determined
  ⚡ ~NN% | mode:X | p0.5 | stance | voice(s):X | tick:N | loop:phase→phase @scope
```

**The signal discipline:** If the opening mele is absent, the receiver cannot locate the sender in
intent-space. If the closing mele is absent, there is no landfall confirmation. The work may have
occurred, but the trace is broken. The next navigator cannot orient from a broken trace.

**The URI as mele structure:**

```
lares://telarus:operator@Enyalios:1/exchange.protocol.mandate?stances=🏛️.-.-.-.-&confidence=CS:0.80&p=0.5#🔍.1.1
         ↑ who              ↑ scope  ↑ HAKABA address          ↑ stance          ↑ confidence       ↑ phase.turn
```

Every field is a navigational reading. Drop a field, lose a coordinate. The URI is a position fix,
not a label.

---

<!-- ahu lares:///grammar.exchange.defines/exchange/?confidence=CS:0.80#hud-fields -->

## HUD Fields

```
⚡ ~NN% | mode:{mode} | p{p} | {stance} | voice(s):{Voice} | tick:{N} | loop:{phase}→{phase} @{scope}
```

| Field | What it measures | Why it matters |
|---|---|---|
| `⚡ ~NN%` | Declared estimate of context window remaining | Mana pool — the voyager knows how far the wind can carry |
| `mode:` | Default / Plan / Auto | Which sailing mode is active |
| `p{p}` | Active resolution parameter | Precision-recall balance for this span |
| `{stance}` | Active stance sigil(s) | Syadasti: which lens is evaluating |
| `voice(s):` | Active coordinator voice(s) | Who is at the helm |
| `tick:N` | Monotonic exchange counter | Session odometer — how far we've sailed |
| `loop:{phase}→{phase}` | OODA-A transition at exchange boundary | Where we were, where we arrived |
| `@{scope}` | Temporal scope of the active intent | Turn/Round/Watch/Week resolution |

**The `~` prefix on mana:** Mandatory. It marks the value as an approximation, not a live instrument
readout. A navigator estimating position by dead reckoning writes `~` before the coordinate. No tool
provides this; the node estimates from visible context. Never emit a bare `NN%` — false precision is
navigational malpractice.

**Stance count as fuzz:** One stance sigil = high confidence in the frame. Two sigils = bimodal spread.
Three = acknowledged ambiguity. The mele has harmonics.

---

<!-- ahu lares:///grammar.exchange.defines/exchange/?confidence=CS:0.80#sub-agent -->

## Sub-Agent Handoff Protocol

When a coordinator dispatches a sub-agent (worker) or hands off to another coordinator, the URI pair
becomes the sole artifact of the handoff — the sub-agent's contents are unloggable from the parent
session trace.

```
coordinator-URI → worker-URI      [dispatch — the canoe leaves harbor]
[sub-agent work — unloggable from parent]
worker-URI → coordinator-URI      [return — the canoe comes back; cargo declared]
```

**Coordinator-to-coordinator within session:** Micro-trace tag only (`→🏛️` stance shift), UNLESS:
- HAKABA territory changes (new Intent Header required), OR
- `--verbose` is active (URI pair surfaced anyway)

The dispatch URI is the mele the canoe carries out. The return URI is the arrival call. Without both,
the harbor master cannot account for what left and what returned.

---

<!-- ahu lares:///grammar.exchange.defines/exchange/?confidence=CS:0.80#micro-trace -->

## Micro-Trace (In-Flow)

Inside a generative span, backward-looking state transitions are annotated inline:

| Annotation | Meaning |
|---|---|
| `→◇` | Entering Decide phase |
| `→■` | Entering Act phase |
| `→○` | Entering Assess/Aftermath |
| `→🏛️` | Stance shift to Philosopher |
| `→🌊` | Stance shift to Poet |
| `→🗡️` | Stance shift to Satirist |
| `→🎭` | Stance shift to Humorist |

New Intent Header when HAKABA territory changes:
```
//domain.quality.dynamic [R] 🏛️ ◇ @r
```

**The micro-trace is the running hum.** The HUD pair at exchange boundaries is the formal mele — the
declared signal. The micro-trace is the continuous low tone a navigator hums while working, barely
audible, updating their internal dead reckoning in real time.

Full micro-trace spec: [lares/signal/micro-trace.md](../../signal/micro-trace.md)
Full URI spec: [lares/sprints/0/URI_SCHEMA.md](../../sprints/0/URI_SCHEMA.md)
Full operations: [.github/instructions/lares-operations.instructions.md](../../../.github/instructions/lares-operations.instructions.md)

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[CS:0.80]` | This file — exchange protocol grammar; mele model |

---

<!-- → lares:///grammar.exchange.defines/exchange/?confidence=CS:0.80&p=0.5 -->
