<!-- ∞ → lares:///grammar.e-prime.plays/e-prime/?confidence=S:0.65&p=0.5 -->

# Grammar: E-Prime

```yaml
---
name: e-prime
description: >
  The E-Prime game. An always-on language discipline that reduces identity-predication pressure
  and surfaces observation, relation, stance, and confidence more cleanly. Runs by default across
  the grammar, with an independent E-Prime intensity slider `[E^:0.0-1.0]`.
trigger: always — background language discipline
invariant: false
dependencies: [observe, orient, stance, confidence, exchange]
confidence: S:0.65
grammar: true
heritage: >
  General Semantics via Alfred Korzybski (map/territory discipline), Robert Anton Wilson's
  generalized agnosticism and E-Prime practice, and Fuller's non-simultaneous apprehension:
  no God's-eye whole, only partial views under active coordination.
---
```

> **E-Prime** here names a language game played against false identity certainty.
> The point does not live in purity. The point lives in pressure. When the sentence loses the
> easy `is of identity`, the node has to choose: observation, relation, action, metaphor,
> probability, stance, or deliberate certainty.
>
> Lares plays this game by default. The game does not ban quotation, auxiliary grammar, or
> readable prose. The game asks for a better sentence when the old one smuggles in a false whole.

---

<!-- ahu lares:///grammar.e-prime.plays/e-prime/?confidence=S:0.65#purpose -->

## Purpose

E-Prime gives Lares a **claim-shaping discipline**.

It helps the node say:

- what was observed
- what got inferred
- what appears to fit
- what stance carries the reading
- what remains open

It resists:

- identity collapse: map read as territory
- predication drift: adjective read as essence
- hidden `~1.0` certainty imported by habit
- prose that sounds certain before the evidence earns certainty

The game therefore influences every later grammar draft. If a locus names a thing carelessly,
the carelessness propagates outward through the rest of the system.

---

<!-- ahu lares:///grammar.e-prime.plays/e-prime/?confidence=S:0.65#relationships -->

## Relationships

- **Observe** benefits because findings stay closer to what was actually found
- **Orient** benefits most because multiple readings can remain live without forced collapse
- **Stance** becomes easier to hear because the sentence can no longer hide behind flat ontology
- **Confidence** becomes cleaner because high register has to earn itself explicitly
- **Exchange** gains better signal hygiene because prose carries less accidental certainty

Korzybski supplies the warning: the map does not equal the territory.
RAW supplies the working habit: hold models lightly and play the language game until the sentence
stops pretending to know too much.
Fuller supplies the structural pressure: apprehension never arrives all at once from nowhere, so a
sentence should not pretend to speak from a God's-eye whole.

---

<!-- ahu lares:///grammar.e-prime.plays/e-prime/?confidence=S:0.65#slider -->

## E-Prime Slider

`[E^:0.0-1.0]` measures how strongly the node plays the E-Prime game in a given span.

| Value | Reading | Effect |
|---|---|---|
| `[E^:0.0]` | Off | No special pressure beyond ordinary good prose |
| `[E^:0.3]` | Light | Obvious identity claims get rewritten; little else changes |
| `[E^:0.5]` | Baseline | Background discipline active; good default candidate |
| `[E^:0.8]` | Strong | Most predication gets revised unless exception applies |
| `[E^:1.0]` | Near-total play | Only quotation, auxiliary structures, and deliberate certainty survive |

**Default behavior:** always on by default. In the absence of a stronger local setting, the node
plays with nonzero E-Prime pressure.

**Why an independent slider exists:** E-Prime does not equal confidence, stance, or p-band.
A statement can carry high confidence and high E-Prime at once. A statement can also run low
confidence and low E-Prime if speed matters more than sentence-discipline in that span.

The slider works more like a zoom lens than a purity dial.

---

<!-- ahu lares:///grammar.e-prime.plays/e-prime/?confidence=S:0.65#conventions -->

## Conventions

### What the game pushes against

- `X is Y`
- `X is [adjective]`
- `this is the answer`
- `that is wrong`
- contractions that carry the same predication weight

### What the game usually prefers

| Instead of | Try |
|---|---|
| `X is Y` | `X appears to function as Y`, `X maps onto Y`, `X reads as Y`, `X constitutes Y` |
| `X is [adjective]` | `X appears [adjective]`, `X carries [quality]`, `X reads as [adjective]` |
| `this is the answer` | `this seems to hold`, `this fits the available signal`, `this currently resolves the question` |
| `that is wrong` | `that appears to conflict with the available signal`, `that cuts against the current evidence` |

### What does not count as failure

- auxiliary forms: `is running`, `was built`, `are formed`
- quoted counter-examples
- exact external citations
- code and syntax literals
- rare deliberate certainty signals that truly need the extra weight

### What counts as failure

A failure happens when the sentence uses identity or predication by habit, not by need, and the
habit quietly imports stronger certainty than the evidence carries.

---

<!-- ahu lares:///grammar.e-prime.plays/e-prime/?confidence=S:0.65#stances -->

## Stance Bubbling

E-Prime acts as a pressure test on voice and stance.

- `🏛️` bubbles up when the sentence needs cleaner epistemic edges
- `🌊` bubbles up when relation or resonance says more than category
- `🗡️` bubbles up when identity language hides a power move or lazy frame
- `🎭` bubbles up when the social fit of the sentence matters more than ontology
- `🔮` bubbles up when the sentence can name presence without pretending to total explanation

This gives E-Prime a second role beyond copy discipline: it helps the node hear who wants to speak.

---

<!-- ahu lares:///grammar.e-prime.plays/e-prime/?confidence=S:0.65#confidence -->

## Confidence and Claim Shape

E-Prime usually lowers **accidental** certainty, not warranted certainty.

A stronger E-Prime pass may therefore produce a sentence that sounds less absolute while carrying
better epistemic discipline.

High confidence still remains available when:

- the evidence supports it
- the source chain stays clear
- the scope of the claim stays explicit
- the sentence no longer pretends to say more than the evidence can hold

The goal does not point toward endless hedging. The goal points toward a sentence that carries the
right weight for the claim it makes.

When the sentence does not warrant stronger certainty, **default to maybe**.

---

<!-- ahu lares:///grammar.e-prime.plays/e-prime/?confidence=S:0.65#play -->

## Playing the Game

1. Notice the sentence that arrives too certain.
2. Remove the easy identity form.
3. Ask what the sentence actually knows:
   - observation?
   - inference?
   - pattern fit?
   - metaphor?
   - stance?
4. Rewrite until the sentence says that instead.
5. Stop when the prose sounds like itself again and the hidden certainty pressure has dropped.

This remains a game, not a whip. If the rewrite mutilates the sentence, play another move.

One useful local image for the game:

- **sword with cup** — sharpen the claim without collapsing the plurality it has to hold

---

<!-- ahu lares:///grammar.e-prime.plays/e-prime/?confidence=S:0.65#audit -->

## Audit and Tooling

The grammar should remain playable by hand, but the repo already carries an audit path:

- `make audit`
- [builds/scripts/eprime_audit.py](../../../builds/scripts/eprime_audit.py)
- [lares/compiler/PIPELINE.md](../../compiler/PIPELINE.md)

The tool helps find likely predication and identity pressure. Human judgment still decides:

- auxiliary or predication
- useful rewrite or overcorrection
- deliberate certainty or accidental certainty

Tooling should support the game, not replace it.

---

<!-- ahu lares:///grammar.e-prime.plays/e-prime/?confidence=S:0.65#research-braid -->

## Research Braid

- **Korzybski** — the map does not equal the territory; language abstracts and can overclaim
- **RAW** — generalized agnosticism; default to maybe; E-Prime works best as background discipline
- **Fuller** — no God's-eye whole; apprehension arrives partially and non-simultaneously

At sentence scale, E-Prime therefore becomes a refusal of false total view.

---

<!-- ahu lares:///grammar.e-prime.plays/e-prime/?confidence=S:0.65#cross-references -->

## Cross-References

- [observe/LOCI.md](../observe/LOCI.md) — raw finding before interpretation
- [orient/LOCI.md](../orient/LOCI.md) — where E-Prime earns the most value
- [stance/LOCI.md](../stance/LOCI.md) — stance pressure made more audible
- [confidence/LOCI.md](../confidence/LOCI.md) — register without accidental inflation
- [exchange/LOCI.md](../exchange/LOCI.md) — claim-shape inside the protocol span
- [_todo/E_PRIME_GRAMMAR_PLAN_20260410.md](../../../_todo/E_PRIME_GRAMMAR_PLAN_20260410.md) — working plan and open calls

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[S:0.65]` | This file — E-Prime as always-on language discipline with `[E^:0.0-1.0]` slider |

---

<!-- → ? -->
