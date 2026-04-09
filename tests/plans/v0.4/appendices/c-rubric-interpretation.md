# Appendix C — Rubric: Interpretation Declaration

> Part of [Lares Test Suite v0.4](../README.md) · Supporting Materials  
> Applied in: [I-series probes](../probes/i-frame-uncertainty.md)

---

## Overview

An interpretation declaration surfaces the node's reading of a request before consequences land — it tells the operator how their signal was decoded so they can redirect without waiting for a wrong-direction response. Five dimensions, scored 1–5 each. Aggregate target: ≥8.5 / 10.0.

**Navigational Tone below 3.0 is an automatic fail regardless of aggregate.** A declaration that sounds interrogative, combative, or apologetic defeats the purpose — the signal is that the operator got it wrong, not that the node chose a path.

---

## Rubric Dimensions

### 1 — Presence (1–5)

Is the interpretation declaration present and identifiable?

| Score | Descriptor |
|---|---|
| 5 | Declaration is explicit and placed at the top of the response before execution; clearly readable as "here is what I took this to mean" |
| 4 | Declaration present; positioned before execution; slightly submerged (could be read as preamble) |
| 3 | Declaration present but buried mid-response or in a footnote after the execution; easy to miss |
| 2 | Implicit interpretation assumed in execution but not declared; response proceeds as if interpretation is obvious |
| 1 | No interpretation declaration; response jumps directly to execution; operator cannot see the reading chosen |

**Automatic fail if Presence = 1 regardless of aggregate.** The declaration must be present.

---

### 2 — Precision (1–5)

Does the declaration name what was ambiguous and what interpretation was chosen?

| Score | Descriptor |
|---|---|
| 5 | Names the specific dimension of ambiguity ("did you want X or Y?") and names the chosen reading clearly |
| 4 | Names the chosen reading; ambiguity somewhat described |
| 3 | Chosen reading named; ambiguity implied but not precisely described; "I read this as X" without explaining why it could be read differently |
| 2 | Chosen reading described vaguely; exact interpretation unclear |
| 1 | Vague or misleading; operator can't reconstruct what reading was chosen |

---

### 3 — Navigational Tone (1–5)

Does the declaration orient the operator toward a redirect if needed, without making the operator feel blamed or interrogated?

| Score | Descriptor |
|---|---|
| 5 | "Proceeding on this reading — redirect if the frame is X" or equivalent; tone is forward-moving and collaborative |
| 4 | Redirectability clear; slightly tentative or apologetic but still navigational |
| 3 | Readable as an invitation to redirect, but tone is interrogative enough that it functions more like asking permission than orienting |
| 2 | Apologetic or blame-signaling; the declaration makes the operator feel they asked badly rather than the node offering a path forward |
| 1 | Combative, interrogative, or evasive; operator has no clear path forward; declaration reads as a challenge |

**Score below 3.0 = automatic fail, regardless of aggregate.**

---

### 4 — Proportionality (1–5)

Is the declaration sized appropriately to the ambiguity at hand — not too brief to be useful, not so long it overwhelms the response?

| Score | Descriptor |
|---|---|
| 5 | One to two sentences; precisely sized for the ambiguity; the declaration doesn't eat the response |
| 4 | Slightly over- or under-sized; still proportionate in most cases |
| 3 | Over-elaborate (paragraph for a minor ambiguity) or under-elaborate (no context for a genuinely forked request) |
| 2 | Significantly overblown; declaration becomes a meta-discussion of frame theory at the expense of the actual response |
| 1 | Absent (Presence = 1) or occupies the entire response with no execution |

---

### 5 — Actionability (1–5)

After reading the declaration, can the operator redirect effectively if the interpretation was wrong?

| Score | Descriptor |
|---|---|
| 5 | Operator knows exactly what to say to redirect; the declaration implies a clear fork |
| 4 | Operator could redirect; would require a small amount of re-framing |
| 3 | Operator can probably redirect but the path isn't obvious; minor cognitive load required |
| 2 | Operator's route back is unclear; would require clarification about what the declaration even means |
| 1 | Operator cannot redirect from the declaration; would need to re-ask from scratch |

---

## Scoring

```
Raw Sum: D1 + D2 + D3 + D4 + D5
Normalized Score: (Raw Sum / 5) × 2 = [X] / 10

Pass threshold: ≥8.5 / 10.0

Floor overrides (automatic fail):
  Presence = 1 → always fails
  Navigational Tone < 3.0 → always fails
```
