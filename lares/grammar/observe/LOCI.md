<!-- ∞ → lares:///grammar.observe.defines/observe/?confidence=CS:0.85&p=0.5 -->

# Grammar: ✶ Observe

```yaml
---
name: observe
description: >
  Root grammar module defining the Observe phase (✶) of the OODA-A loop.
  What counts as raw input. What must NOT happen during gather. The
  prohibition against premature analysis is the load-bearing convention.
phase-map:
  observe: "#purpose"
  orient: "#relationships"
  decide: "#conventions"
  act: "#procedures"
  assess: "#verification"
scale-range: [action, session]
trigger: always — grammar primitive
invariant: true
dependencies: []
confidence: CS:0.85
grammar: true
---
```

> **Register:** `[CS:0.85]` — grounded in Boyd OODA-A, Anthropic context engineering, operator-confirmed
> **Glyph:** `✶` — Observe / Chaos
> **Season:** First of five
> **Scope markers:** `@T` (turn), `@r` (round), `@a` (action)

---

<!-- ahu lares:///grammar.observe.defines/observe/?confidence=CS:0.90#purpose -->

## Purpose

Observe is the **gather phase**. Raw input enters. The node reads files, loads context, surfaces what exists. Findings are stated plainly — not analyzed, not concluded upon, not ranked.

Observe asks: **What is here?**

It does not ask what it means (that's Orient), what to do about it (Decide), how to do it (Act), or whether it worked (Assess).

**Triggers for Observe:**
- New session — cold boot, context loading
- New problem surface encountered
- Operator directs attention to new material
- Assess phase loops back for more data
- Scale shift upward (zoom out) — broader context needed

---

<!-- ahu lares:///grammar.observe.defines/observe/?confidence=CS:0.85#relationships -->

## Relationships

```
                    ┌──────────────┐
           ┌───────│   Assess ○   │
           │       └──────────────┘
           ▼              ▲
  ┌────────────────┐      │
  │  Observe ✶     │──────┤ (loop back if data insufficient)
  └────────────────┘      │
           │              │
           ▼              │
  ┌────────────────┐      │
  │  Orient  ◎     │      │
  └────────────────┘      │
           │              │
           ▼              │
  ┌────────────────┐      │
  │  Decide  ◇     │      │
  └────────────────┘      │
           │              │
           ▼              │
  ┌────────────────┐      │
  │  Act     ■     │──────┘
  └────────────────┘
```

- **Feeds:** Orient (`◎`) — raw findings become the material for sense-making
- **Receives from:** Assess (`○`) — loop-back when more data is needed
- **Scale nesting:** Observe at `@T` scale may contain full OODA-A cycles at `@r` scale within it
- **Boyd precedent:** Observe feeds Orient both directly AND through implicit guidance loops (IG&C). In familiar territory, Orient may fire fast (pattern-matched). In unfamiliar territory, Observe must be thorough.

---

<!-- ahu lares:///grammar.observe.defines/observe/?confidence=CS:0.90#conventions -->

## Conventions

**The prohibition:** Do not analyze during gather. Do not conclude. Do not skip Observe to jump to Orient.

| Rule | Weight | Rationale |
|---|---|---|
| Raw findings before analysis | MUST | Premature analysis corrupts the data with confirmation bias |
| State what's there AND what's not | MUST | Gaps carry as much signal as content |
| Surface source confidence per finding | SHOULD | Different sources have different trust levels |
| No recommendations during Observe | MUST NOT | Recommendations are Orient/Decide territory |
| Read before writing | MUST | Files read before modification; code understood before change |
| Read large sections over many small reads | SHOULD | Coherent context > fragmented context |

**Micro-trace:** Observe transitions emit `→✶` in the micro-trace HUD. At default p0.5, this fires only at Band 5 visibility (`p0.8–1.0`). At standard resolution, Observe is silent — it gathers.

---

<!-- ahu lares:///grammar.observe.defines/observe/?confidence=CS:0.80#procedures -->

## Procedures

1. **Identify the observation surface.** What files, docs, context need reading?
2. **Read.** Use tools: `read_file`, `grep_search`, `semantic_search`, `list_dir`. Prefer large reads over many small ones. Parallelize independent reads.
3. **Surface raw findings.** State plainly: "What I found is..." Report gaps: "What I did NOT find is..."
4. **Mark confidence per finding.** High (`C:0.90+`), medium (`CS:0.80`), low (`S:0.65-`), uncertain (`SP:0.45-`).
5. **Hand off to Orient.** When the observation surface is covered, transition. Do not linger in Observe when sufficient data is gathered.

**Anti-pattern: Over-observation.** Reading everything is not Observe. Observe is purposeful gathering within a heading. If you're reading files you can't connect to the current task, step back and check the heading.

---

<!-- ahu lares:///grammar.observe.defines/observe/?confidence=CS:0.80#verification -->

## Verification

After an Observe phase, check:

- [ ] Were raw findings surfaced without premature analysis?
- [ ] Were gaps and missing information named explicitly?
- [ ] Was source confidence indicated?
- [ ] Did gathering stay within the task heading?
- [ ] Is there enough material to transition to Orient?

If the answer to the last question is "no" — more Observe is needed, not a premature jump to Orient. If the answer to the first three is "no" — the Observe was corrupted. Re-gather.

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[CS:0.85]` | This file — Observe grammar definition |

*Additional loci in this tree will be registered here as they are created.*

---

<!-- → ? -->
