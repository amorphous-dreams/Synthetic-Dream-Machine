<!-- ∞ → lares:///grammar.ooda-a.holds/ooda-a/?confidence=S:0.65&p=0.5 -->

# Grammar: OODA-A

```yaml
---
name: ooda-a
description: >
  The five-season loop cluster: Observe, Orient, Decide, Act, Assess. This cluster binds the
  phase loci into one timed navigational instrument rather than five disconnected static definitions.
  In Lares, grammar gets read in loop-time. OODA-A is the clockwork that makes that reading possible.
trigger: always — root loop discipline
invariant: true
dependencies: [observe, orient, decide, act, assess]
confidence: S:0.65
grammar: true
product_identity: true
heritage: >
  Boyd's OODA loop carried forward through the Lares extension that makes Aftermath explicit as
  Assess. The cluster name OODA-A, as used for this Lares grammar and instrument panel, should be
  treated as Product Identity.
---
```

> **OODA-A** names the loop as one instrument.
> The five phases do not sit here as shelf labels. They sit here as a timed path:
> gather, sense-make, commit, execute, close. A grammar locus should read differently when the
> reader knows which season they stand inside.

---

<!-- ahu lares:///grammar.ooda-a.holds/ooda-a/?confidence=S:0.65#identity -->

## Product Identity Note

The underlying loop idea remains open as method. The **OODA-A** cluster name, as used in the Lares
grammar and design system, should be treated as **Product Identity**.

Use the idea freely. Do not wear the exact cluster name as a claim to be this system.

---

<!-- ahu lares:///grammar.ooda-a.holds/ooda-a/?confidence=S:0.65#purpose -->

## Purpose

OODA-A gives the grammar a **time structure**.

It tells a reader:

- where they are in the loop
- what this phase receives
- what this phase transforms
- what this phase hands onward
- what should remain after closure

Without the cluster, the five phase files can still exist, but they read too easily as static doctrine.
With the cluster, the reader can recover motion.

---

<!-- ahu lares:///grammar.ooda-a.holds/ooda-a/?confidence=S:0.65#members -->

## Members

| Phase | Glyph | LOCUS | One-line |
|---|---|---|---|
| Observe | `✶` | [observe/LOCI.md](../observe/LOCI.md) | Gather what is here without premature analysis |
| Orient | `◎` | [orient/LOCI.md](../orient/LOCI.md) | Sense-make and hold plurality without premature closure |
| Decide | `◇` | [decide/LOCI.md](../decide/LOCI.md) | Commit the heading and bound the scope |
| Act | `■` | [act/LOCI.md](../act/LOCI.md) | Build what was decided and nothing more |
| Assess | `○` | [assess/LOCI.md](../assess/LOCI.md) | Evaluate closure, residue, and what carries forward |

---

<!-- ahu lares:///grammar.ooda-a.holds/ooda-a/?confidence=S:0.65#relationships -->

## Relationships

The loop reads as:

```
✶ Observe → ◎ Orient → ◇ Decide → ■ Act → ○ Assess
                   ↑                          ↓
                   └──────── loop back ───────┘
```

Each phase has its own LOCI, but the cluster defines their relation in time.

- **Observe** supplies raw material
- **Orient** names pattern, tension, and plurality
- **Decide** locks the heading
- **Act** turns commitment into artifact
- **Assess** closes the loop or reopens it at the right point

The cluster therefore acts as a read-order discipline and a memory discipline.

---

<!-- ahu lares:///grammar.ooda-a.holds/ooda-a/?confidence=S:0.65#conventions -->

## Conventions

| Rule | Weight | Rationale |
|---|---|---|
| Read grammar in loop-time, not as disconnected pages | MUST | The system moves; the docs should preserve that motion |
| Every locus should name inputs and outputs where possible | SHOULD | Motion becomes legible when handoff is explicit |
| Assess is part of the loop, not an optional appendix | MUST | Closure belongs to the instrument, not the footnotes |
| Phase files may differ in local tone, but not in temporal legibility | SHOULD | Variety without structural drift |

**E-Prime relation:** OODA-A defines when a concept appears. E-Prime sharpens how the concept gets
named. Together they form the two primary lenses for the grammar-wide pass.

---

<!-- ahu lares:///grammar.ooda-a.holds/ooda-a/?confidence=S:0.65#reading-test -->

## Reading Test

A grammar locus passes the OODA-A test when a future reader can answer:

1. Where in the loop am I?
2. What did this phase receive?
3. What does this phase change?
4. What comes next?

If the answer to those questions stays fuzzy, the file still reads like a static label rather than a
loop-time instrument.

---

<!-- ahu lares:///grammar.ooda-a.holds/ooda-a/?confidence=S:0.65#cross-references -->

## Cross-References

- [observe/LOCI.md](../observe/LOCI.md)
- [orient/LOCI.md](../orient/LOCI.md)
- [decide/LOCI.md](../decide/LOCI.md)
- [act/LOCI.md](../act/LOCI.md)
- [assess/LOCI.md](../assess/LOCI.md)
- [e-prime/LOCI.md](../e-prime/LOCI.md)
- [_todo/LARES_GRAMMAR_OODA_EPRIME_PASS_PLAN_20260410.md](../../../_todo/LARES_GRAMMAR_OODA_EPRIME_PASS_PLAN_20260410.md)

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[S:0.65]` | This file — OODA-A loop cluster; Product Identity marker for the Lares-specific cluster name |

---

<!-- → ? -->
