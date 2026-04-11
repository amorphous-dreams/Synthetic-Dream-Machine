<!-- ∞ → lares:///grammar.ooda-a.holds/ooda-a/?confidence=S:0.65&p=0.5 -->

# Grammar: OODA-A

---
# OODA-A Phase Details

## Observe

### Loop Position
receives:
- phase loci
- exchange spans
- loop-back pressure
- closure pressure
changes:
- disconnected pages into timed sequence
- isolated phase definitions into a navigational instrument
- static registry reading into loop-time reading
hands forward:
- read order
- phase relation
- handoff expectations
- closure expectations
should not:
- collapse into five unrelated labels
- treat Assess as optional residue
- let a locus float without temporal placement

### Handoff
1. Where in the loop did this span happen?
2. What entered the phase?
3. What left the phase?
4. Which phase should fire next?

## Orient

### Loop Position
receives:
- raw findings
- named gaps
- conflicting signals
- stance pressure from the current reading frame
changes:
- raw material into candidate pattern
- friction into named tension
- ambiguity into explicit open questions
hands forward:
- a decision surface
- competing readings
- declared drift, mismatch, or surprise
should not:
- gather a fresh corpus unless the loop genuinely needs more signal
- lock scope
- start building
- call the work complete

### Handoff
1. Which tensions matter here?
2. Which readings compete?
3. What still lacks operator steering?
4. What decision shape has emerged?

## Decide

### Loop Position
receives:
- oriented pattern and tension
- operator steering
- reversibility concerns
- scope pressure
changes:
- open possibility into chosen heading
- blurry effort into bounded scope
- implicit permission into explicit authorization
hands forward:
- the action heading
- scope bounds
- exclusions
- reversibility notes
should not:
- reopen broad sense-making without cause
- start implementation before commitment lands
- hide the cost of irreversible moves

### Handoff
1. What did the node choose?
2. What sits inside scope?
3. What remains outside scope?
4. Did the operator need to confirm this move?
5. How reversible does the move remain?

## Act

### Loop Position
receives:
- bounded scope
- execution heading
- operator permissions
- known blockers and constraints
changes:
- intention into artifact
- plan into edits, commands, or generated structure
- open work into completed work
hands forward:
- the built artifact
- deviations, if any
- blocker notes
- evidence for closure
should not:
- widen scope mid-build
- smuggle in cleanup nobody asked for
- silently rewrite the decision

### Handoff
1. What changed?
2. Which commands or edits produced the change?
3. Did the work stay inside scope?
4. Which blockers or deviations appeared?

## Assess

### Loop Position
receives:
- artifacts
- execution notes
- deviations
- unresolved residue
changes:
- finished work into judged outcome
- loose residue into carry-forward or release
- a completed cycle into closure or loop-back
hands forward:
- a closure statement
- carry-forward state
- release notes
- the next Observe heading when the loop reopens
should not:
- quietly celebrate without evaluation
- reopen settled decisions without cause
- start new implementation inside the closure span

### Handoff
1. Did the artifact satisfy the decision?
2. What residue remains live?
3. What can drop away now?
4. Does the next cycle need more data, a new decision, or nothing at all?

```yaml
---
name: ooda-a
description: >
  The five-season loop cluster: Observe, Orient, Decide, Act, Assess.
  This locus gives the grammar its time structure and binds the five
  phase loci into one navigational instrument.
phase-map:
  observe: "#loop-position"
  orient: "#handoff"
  decide: "#conventions"
  act: "#procedures"
  assess: "#reading-test"
trigger: always — root loop discipline
invariant: true
dependencies: [observe, orient, decide, act, assess]
confidence: S:0.65
grammar: true
product_identity: true
heritage: >
  Boyd's OODA loop carried forward through the Lares extension that
  makes Aftermath explicit as Assess. The cluster name OODA-A, as used
  for this Lares grammar and instrument panel, should be treated as  <!-- e-prime ok -->
  Product Identity.
---
```

> **Register:** `[S:0.65]` — active draft under operator steering
> **Glyphs:** `✶◎◇■○`
> **Question:** How does the grammar move in time?

---

<!-- ahu lares:///grammar.ooda-a.holds/ooda-a/?confidence=S:0.65#identity -->

## Product Identity Note

The underlying loop idea remains open as method. The **OODA-A** cluster name, as used in the Lares
grammar and design system, should be treated as **Product Identity**. <!-- e-prime ok -->

Use the loop idea freely. Do not wear the exact cluster name as a claim to this system.

---

<!-- ahu lares:///grammar.ooda-a.holds/ooda-a/?confidence=S:0.65#loop-position -->

## Loop Position

OODA-A wraps the whole grammar. The cluster gives every later locus a timed place inside the
instrument.

OODA-A receives:

- phase loci
- exchange spans
- loop-back pressure
- closure pressure

OODA-A changes:

- disconnected pages into timed sequence
- isolated phase definitions into a navigational instrument
- static registry reading into loop-time reading

OODA-A hands forward:

- read order
- phase relation
- handoff expectations
- closure expectations

OODA-A should not:

- collapse into five unrelated labels
- treat Assess as optional residue
- let a locus float without temporal placement

---

<!-- ahu lares:///grammar.ooda-a.holds/ooda-a/?confidence=S:0.65#handoff -->

## Handoff

The cluster routes motion across the five phases:

`✶ Observe → ◎ Orient → ◇ Decide → ■ Act → ○ Assess`

and from there either:

- closes the current cycle
- or routes the next cycle back to `✶ Observe`

The handoff should let a later reader answer:

1. Where in the loop did this span happen?
2. What entered the phase?
3. What left the phase?
4. Which phase should fire next?

When those answers disappear, the locus stops reading as loop-time grammar.

---

<!-- ahu lares:///grammar.ooda-a.holds/ooda-a/?confidence=S:0.65#members -->

## Members

| Phase | Glyph | LOCUS | One-line |
|---|---|---|---|
| Observe | `✶` | [observe/LOCI.md](../observe/LOCI.md) | Gather what has arrived without premature analysis |
| Orient | `◎` | [orient/LOCI.md](../orient/LOCI.md) | Work gathered signal into pattern, tension, and open questions |
| Decide | `◇` | [decide/LOCI.md](../decide/LOCI.md) | Commit the heading and bound the scope |
| Act | `■` | [act/LOCI.md](../act/LOCI.md) | Carry the decision into artifact |
| Assess | `○` | [assess/LOCI.md](../assess/LOCI.md) | Judge outcome, residue, and loop-back need |

---

<!-- ahu lares:///grammar.ooda-a.holds/ooda-a/?confidence=S:0.65#conventions -->

## Conventions

| Rule | Weight | Rationale |
|---|---|---|
| Read grammar in loop-time | MUST | The system moves through phases, not shelves |
| Make receives, changes, and handoff legible | MUST | Temporal motion needs explicit joints |
| Keep Assess inside the loop | MUST | Closure belongs to the instrument |
| Let local tone vary without losing timing | SHOULD | Voice can shift; temporal legibility cannot |
| Use E-Prime pressure on phase prose | SHOULD | Cleaner claim-shape supports cleaner loop-time |

**Relation to E-Prime:** OODA-A tells a locus when it speaks. E-Prime sharpens how the locus speaks.
The two lenses work together during every grammar pass.

---

<!-- ahu lares:///grammar.ooda-a.holds/ooda-a/?confidence=S:0.65#procedures -->

## Procedures

1. Locate the current phase.
2. Name what the phase receives.
3. Name what the phase changes.
4. Name what the phase hands forward.
5. Name the next expected phase or the closure condition.

**Failure mode:** registry prose that names a concept but never locates the concept in the loop. That
kind of prose turns the instrument back into a shelf.

---

<!-- ahu lares:///grammar.ooda-a.holds/ooda-a/?confidence=S:0.65#reading-test -->

## Reading Test

A grammar locus passes the OODA-A test when a future reader can recover all of this:

- the current phase location
- the incoming material
- the outgoing material
- the next temporal move

If the reader can only recover a static definition, the locus still needs loop-time work.

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
