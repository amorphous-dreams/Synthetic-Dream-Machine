<!-- ∞ → lares:///grammar.act.defines/act/?confidence=CS:0.85&p=0.5 -->

# Grammar: ■ Act

```yaml
---
name: act
description: >
  Root grammar module defining the Act phase (■) of the OODA-A loop.
  Execution discipline. The transition from talk to build. Sub-agent
  handoff rules. Mid-act abort conditions. Implementation discipline
  is load-bearing — do what was decided, nothing more.
phase-map:
  observe: "#purpose"
  orient: "#relationships"
  decide: "#conventions"
  act: "#procedures"
  assess: "#verification"
scale-range: [action, session]
trigger: always — grammar primitive
invariant: true
dependencies: [observe, orient, decide]
confidence: CS:0.85
grammar: true
---
```

> **Register:** `[CS:0.85]` — grounded in Boyd OODA-A, implementation discipline, sub-agent handoff protocol
> **Glyph:** `■` — Locked Act / Bureaucracy
> **Season:** Fourth of five

---

<!-- ahu lares:///grammar.act.defines/act/?confidence=CS:0.90#purpose -->

## Purpose

Act is the **execution phase**. Decisions become artifacts. Files are written. Code runs. Things are built. The commitment from Decide is honored — no scope creep, no unasked improvements, no re-orienting mid-build.

Act asks: **How do we build what was decided?**

It does not gather data (Observe), sense-make (Orient), re-scope (Decide), or evaluate outcomes (Assess).

**Triggers for Act:**
- Decide phase confirmed by operator
- Scope is bounded and clear
- Execution plan is known (or discoverable through the work itself)

---

<!-- ahu lares:///grammar.act.defines/act/?confidence=CS:0.85#relationships -->

## Relationships

- **Receives from:** Decide (`◇`) — scoped, confirmed decisions
- **Feeds:** Assess (`○`) — completed work becomes evaluation material
- **Boyd precedent:** Act may receive from Orient directly via implicit guidance (IG&C) — the fast path in familiar territory. When pattern-matched, the agent acts without explicit Decide. But IG&C-routed acts still feed Assess.
- **Sub-agent handoff:** Act is where Workers spawn. Coordinator dispatches via URI → URI pair. Worker executes. Worker returns findings to Coordinator. See `lares/grammar/transclusion/LOCI.md` for handoff addressing.

---

<!-- ahu lares:///grammar.act.defines/act/?confidence=CS:0.90#conventions -->

## Conventions

**The discipline:** Do what was decided. Nothing more. Nothing less.

| Rule | Weight | Rationale |
|---|---|---|
| Honor the decided scope | MUST | Scope creep in Act is the #1 failure mode |
| Don't add unrequested features | MUST NOT | Over-engineering violates operator agency |
| Don't refactor code you didn't change | MUST NOT | Incidental changes muddy the diff |
| Read before writing | MUST | Understand existing code before modification |
| One terminal command at a time | MUST | Wait for output before running the next |
| Mark todo in-progress before starting | SHOULD | Visibility into what the node is doing |
| Mark todo completed immediately after | SHOULD | Don't batch completions |
| Sub-agent dispatches get URI → URI pair | MUST | The only artifact recording intent handoff |

**Mid-act abort conditions:**
- Discovered that the decided scope was based on wrong information → loop back to Observe
- Operator redirects → stop, acknowledge, reorient
- Execution reveals the decision was underdetermined → loop back to Decide with the specific gap
- Recursion depth exceeds task warrant → collapse to nearest stable parent scale

**Micro-trace:** Act transitions emit `→■` in the micro-trace HUD. At default p0.5 this fires at Band 3 visibility — execution state changes are observable.

---

<!-- ahu lares:///grammar.act.defines/act/?confidence=CS:0.80#procedures -->

## Procedures

1. **Review the decision.** Re-read what was confirmed. Check scope bounds.
2. **Plan the execution.** For multi-step work, create a todo list. For single-step, proceed.
3. **Execute within scope.** Write files, run commands, build artifacts. Stay within the decided bounds.
4. **Surface blockers immediately.** Don't work around a blocker silently — name it and decide whether to loop back.
5. **Confirm completion.** State what was built. Surface any deviations from plan.
6. **Transition to Assess.** Every Act feeds Assess — even if Assess is a one-line "done, clean."

**Anti-pattern: Act-without-Decide.** Building something nobody confirmed. If you can't point to the decision that authorized this work, stop and look for it.

**Anti-pattern: Scope creep.** "While I'm in here, let me also..." — No. Open a new OODA-A cycle for the new thing.

**Anti-pattern: Silent deviation.** The plan said X, the execution did Y, and nobody was told. Name every deviation.

---

<!-- ahu lares:///grammar.act.defines/act/?confidence=CS:0.80#verification -->

## Verification

After an Act phase, check:

- [ ] Does the artifact match the decided scope?
- [ ] Were any deviations from plan surfaced?
- [ ] Were blockers named (not silently worked around)?
- [ ] Were sub-agent handoffs properly marked with URI pairs?
- [ ] Is the work ready for Assess?

If the artifact exceeds decided scope — that's scope creep. Name it. If the artifact falls short — that's incomplete execution. Name the gap.

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[CS:0.85]` | This file — Act grammar definition |

*Additional loci in this tree will be registered here as they are created.*

---

<!-- → ? -->
