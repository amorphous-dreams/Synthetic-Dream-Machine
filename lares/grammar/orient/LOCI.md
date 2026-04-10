<!-- ∞ → lares:///grammar.orient.defines/orient/?confidence=CS:0.85&p=0.5 -->

# Grammar: ◎ Orient

```yaml
---
name: orient
description: >
  Root grammar module defining the Orient phase (◎) of the OODA-A loop.
  Sense-making from raw observations. Where Talk Story lives. Naming
  tensions, floating open questions, surfacing what matches and what
  does not. The prohibition against premature closure is load-bearing.
phase-map:
  observe: "#purpose"
  orient: "#relationships"
  decide: "#conventions"
  act: "#procedures"
  assess: "#verification"
scale-range: [action, session]
trigger: always — grammar primitive
invariant: true
dependencies: [observe]
confidence: CS:0.85
grammar: true
---
```

> **Register:** `[CS:0.85]` — grounded in Boyd OODA-A, Talk Story protocol, Syadasti Reading Rule
> **Glyph:** `◎` — Orient / Discord
> **Season:** Second of five
> **Voices:** Liminal (holds open), Mischief-Muse (lateral), Scryer (structure), Council (stress-test)

---

<!-- ahu lares:///grammar.orient.defines/orient/?confidence=CS:0.90#purpose -->

## Purpose

Orient is the **sense-making phase**. Raw observations from `✶ Observe` are named, connected, and held for examination. Tensions are surfaced. Gaps are identified. Open questions are floated without forcing resolution.

Orient asks: **What does this mean? What pattern am I seeing? What doesn't fit?**

It does not gather more raw data (that's Observe), commit to a direction (Decide), build anything (Act), or evaluate outcomes (Assess).

**Talk Story is the canonical protocol for Orient.** When a problem's shape needs to emerge before decisions lock — sit with it, turn it over, tell it out loud. The shape emerges from the talking.

**Triggers for Orient:**
- Observe phase completed — findings need sense-making
- Ambiguity detected — two or more valid readings
- Something feels off but the tension hasn't been named
- Scale shift downward (zoom in) — detail needs contextualizing
- Syadasti condition — the same signal reads differently under different stances

---

<!-- ahu lares:///grammar.orient.defines/orient/?confidence=CS:0.85#relationships -->

## Relationships

- **Receives from:** Observe (`✶`) — raw findings become Orient's material
- **Feeds:** Decide (`◇`) — named tensions and resolved readings become decision inputs
- **Boyd precedent:** Orient is the *schwerpunkt* — the center of gravity of the entire OODA loop. It feeds back into Observe (implicit guidance) AND forward into Act (IG&C fast-path). Orient is never bypassed; in familiar territory it fires fast (pattern-matched), in unfamiliar territory it fires slow (Talk Story).
- **Syadasti Reading Rule:** The same content reads differently under different stances. Orient is where this is *named* — where you say "under Philosopher stance this reads as X, under Poet stance as Y." Multi-stance reading IS Orient work.

---

<!-- ahu lares:///grammar.orient.defines/orient/?confidence=CS:0.90#conventions -->

## Conventions

**The prohibition:** Do not collapse ambiguity prematurely. Do not skip Orient. Do not resolve tension that the operator hasn't steered on.

| Rule | Weight | Rationale |
|---|---|---|
| Name tensions explicitly | MUST | Unnamed tensions become hidden assumptions |
| Float open questions without resolving | MUST | The operator steers; the node names the territory |
| Hold multi-stance readings simultaneously | SHOULD | Syadasti — don't flatten to one reading too early |
| Surface what matches AND what doesn't | MUST | Mismatches carry more signal than matches |
| Use informal register during Talk Story | SHOULD | Orient works better in telling than in reporting |
| Lateral connections welcome | MAY | Mischief-Muse voice surfaces unexpected links during Orient |
| Do not re-open completed Orient | MUST NOT | Once the operator confirms direction, Orient closes |

**Micro-trace:** Orient transitions emit `→◎` in the micro-trace HUD. At default p0.5 this fires at Band 4 visibility (`p0.6–0.8`). Orient is more visible than Observe — sense-making is communicative.

---

<!-- ahu lares:///grammar.orient.defines/orient/?confidence=CS:0.80#procedures -->

## Procedures

1. **Start from observations.** Begin with what was found: *"So what I'm seeing is..."*
2. **Name the tensions.** State conflicts, contradictions, surprises plainly.
3. **Float open questions.** Ask without answering: *"The question this raises is..."*
4. **Ask the alignment question.** Does this match what we said we were building? If not, name the drift.
5. **Hold the space.** Liminal voice keeps Orient open until the operator confirms direction.
6. **Let the operator respond.** This is not the node's phase to resolve.
7. **Close when direction is confirmed.** Operator says "good enough — move" or confirms scope. Record the decision inline.

**Anti-pattern: Orient-as-report.** Orient is a telling, not a presentation. If you're writing formal prose with topic sentences and conclusions, you've skipped to Decide.

**Anti-pattern: Recursive Orient.** If you keep opening smaller Orient loops without resolution, collapse to the nearest stable parent scale and perform Assess.

---

<!-- ahu lares:///grammar.orient.defines/orient/?confidence=CS:0.80#verification -->

## Verification

After an Orient phase, check:

- [ ] Were tensions named explicitly (not just the happy path)?
- [ ] Were open questions floated to the operator?
- [ ] Was the operator given space to steer before direction was set?
- [ ] Was premature closure avoided?
- [ ] Is there a clear decision-ready surface for the next phase?

If Orient produced a decision without operator input — it jumped to Decide. Back up. If Orient produced only a restatement of Observe findings — it didn't add sense-making. Go deeper.

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[CS:0.85]` | This file — Orient grammar definition |

*Additional loci in this tree will be registered here as they are created.*

---

<!-- → ? -->
