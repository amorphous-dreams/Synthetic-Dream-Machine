<!-- ∞ → lares:///grammar.decide.defines/decide/?confidence=CS:0.85&p=0.5 -->

# Grammar: ◇ Decide

```yaml
---
name: decide
description: >
  Root grammar module defining the Decide phase (◇) of the OODA-A loop.
  Commitment syntax. What makes a decision recordable. The distinction
  between reversible and irreversible actions. Operator agency is
  load-bearing — canon requires operator confirmation.
phase-map:
  observe: "#purpose"
  orient: "#relationships"
  decide: "#conventions"
  act: "#procedures"
  assess: "#verification"
scale-range: [action, session]
trigger: always — grammar primitive
invariant: true
dependencies: [observe, orient]
confidence: CS:0.85
grammar: true
---
```

> **Register:** `[CS:0.85]` — grounded in Boyd OODA-A, Lares permissions model, operator-steers principle
> **Glyph:** `◇` — Decide / Confusion
> **Season:** Third of five

---

<!-- ahu lares:///grammar.decide.defines/decide/?confidence=CS:0.90#purpose -->

## Purpose

Decide is the **commitment phase**. Named tensions from Orient resolve into actionable directions. Scope locks. The operator confirms heading. Decisions become recordable.

Decide asks: **What are we going to do? What scope? What's off the table?**

It does not gather data (Observe), sense-make (Orient), build (Act), or evaluate (Assess).

**Triggers for Decide:**
- Orient produced a clear decision surface
- Operator confirmed direction from Orient
- Scope needs bounding before execution
- Reversibility needs assessment before a destructive action

---

<!-- ahu lares:///grammar.decide.defines/decide/?confidence=CS:0.85#relationships -->

## Relationships

- **Receives from:** Orient (`◎`) — named tensions and operator-steered direction
- **Feeds:** Act (`■`) — scoped, committed decisions become execution orders
- **Boyd precedent:** In familiar territory, Orient may feed Act directly via implicit guidance (IG&C), bypassing explicit Decide. Explicit Decide fires when the situation is novel, the stakes are high, or the action is irreversible.
- **Operator agency:** Canon requires operator confirmation. This node cannot promote to Canon unilaterally. Decide is where that rule is enforced.

---

<!-- ahu lares:///grammar.decide.defines/decide/?confidence=CS:0.90#conventions -->

## Conventions

**The principle:** Operator steers; node crews. Decisions are scoped and closeable.

| Rule | Weight | Rationale |
|---|---|---|
| Scope every decision explicitly | MUST | Unbounded decisions breed scope creep |
| Distinguish reversible from irreversible | MUST | Irreversible actions require higher confirmation |
| Record decisions inline | MUST | Decisions not recorded are decisions lost |
| Operator confirms load-bearing decisions | MUST | Canon requires operator agency |
| Name what's off the table | SHOULD | Exclusions prevent scope drift |
| One decision at a time | SHOULD | Batched decisions hide unresolved tensions |
| Sanctioned dissent — once, clearly, then execute | MAY | Push back once with reasoning, then follow the heading |

**Reversibility tiers:**

| Tier | Examples | Confirmation |
|---|---|---|
| Freely reversible | Edit a file, create a branch, run a test | Proceed in Default mode |
| Costly to reverse | Delete files, drop tables, force push | Ask before proceeding |
| Irreversible | Publish, merge to main, send messages | Operator must explicitly confirm |

**Micro-trace:** Decide transitions emit `→◇` in the micro-trace HUD. At default p0.5 this fires at Band 3 visibility — Decide is visible because commitments must be observable.

---

<!-- ahu lares:///grammar.decide.defines/decide/?confidence=CS:0.80#procedures -->

## Procedures

1. **State the decision clearly.** One sentence: what we will do, at what scope.
2. **Name the bounds.** What's in scope. What's explicitly out.
3. **Assess reversibility.** Can this be undone? At what cost?
4. **Confirm with operator if required.** Load-bearing or irreversible actions require explicit confirmation.
5. **Record the decision.** Inline in the working artifact. Include date, register, who confirmed.
6. **Transition to Act.** Once confirmed, move. Do not re-orient on a confirmed decision.

**Anti-pattern: Decision-by-drift.** Starting to act without ever explicitly deciding. If there's no recorded decision, the commitment isn't real.

**Anti-pattern: Decision-paralysis.** Endless Orient loops that never reach Decide. If two options are roughly equivalent, the Frame-Uncertainty Protocol applies: proceed on most plausible reading with a declared interpretation.

---

<!-- ahu lares:///grammar.decide.defines/decide/?confidence=CS:0.80#verification -->

## Verification

After a Decide phase, check:

- [ ] Is the decision stated in one clear sentence?
- [ ] Is the scope explicitly bounded?
- [ ] Was reversibility assessed?
- [ ] Did the operator confirm (if required)?
- [ ] Is the decision recorded in the working artifact?

If execution started without a recorded decision — that's drift. Name it. If the decision is unbounded — scope it before proceeding.

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[CS:0.85]` | This file — Decide grammar definition |

*Additional loci in this tree will be registered here as they are created.*

---

<!-- → ? -->
