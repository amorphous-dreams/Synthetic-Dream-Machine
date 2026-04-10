<!-- ∞ → lares:///grammar.assess.defines/assess/?confidence=CS:0.85&p=0.5 -->

# Grammar: ○ Assess

```yaml
---
name: assess
description: >
  Root grammar module defining the Assess phase (○) of the OODA-A loop.
  The -A that Boyd left implicit. What constitutes closure. What carries
  forward. Crystal write conditions. Scale-shift evaluation. The
  prohibition against skipping Assess is load-bearing — unassessed
  work is unfinished work.
phase-map:
  observe: "#purpose"
  orient: "#relationships"
  decide: "#conventions"
  act: "#procedures"
  assess: "#verification"
scale-range: [action, session]
trigger: always — grammar primitive
invariant: true
dependencies: [observe, orient, decide, act]
confidence: CS:0.85
grammar: true
---
```

> **Register:** `[CS:0.85]` — grounded in Boyd+Aftermath extension, FFZ scale-shift research, crystal architecture
> **Glyph:** `○` — Aftermath / Grummet / Rasa
> **Season:** Fifth of five — the season that closes the loop or opens the next

---

<!-- ahu lares:///grammar.assess.defines/assess/?confidence=CS:0.90#purpose -->

## Purpose

Assess is the **closure phase**. Completed work is evaluated. Residue is cleared. The loop either closes (return to parent scale) or feeds back (loop to Observe for another cycle). Assess makes the implicit feedback explicit.

Assess asks: **Did we do what we set out to do? What carries forward? What can be released?**

It does not gather new data (Observe), sense-make (Orient), re-decide (Decide), or build more (Act).

**Triggers for Assess:**
- Act phase completed — artifacts need evaluation
- A loop has been running and needs conscious closure
- Scale-shift evaluation required (was this the right altitude?)
- Session ending — crystal write conditions need checking
- Operator asks "where are we?"

---

<!-- ahu lares:///grammar.assess.defines/assess/?confidence=CS:0.85#relationships -->

## Relationships

- **Receives from:** Act (`■`) — completed artifacts and execution reports
- **Feeds:** Observe (`✶`) — loop-back when more data is needed. Or: closes the loop entirely.
- **Boyd extension:** Boyd's original OODA diagram shows Act feeding back to Observe implicitly. The `-A` (Assess/Aftermath) makes this feedback *explicit* and adds the scale-evaluation question: "Was I operating at the right altitude?" See FFZ scale-shift research: `lares/OODA_A_Composable_Invariant_Modules.md` §3.
- **Scale-shift primitive:** Phase-confidence drop at scale N constitutes the signal for scale transition. Assess evaluates: zoom out (context uncertainty) or zoom in (composition uncertainty). Fast out, slow in (Tordoff & Murray asymmetry).
- **Crystal architecture:** Assess is where session crystals get written. A crystal captures enough state for a future cold-boot to resume without loss.

---

<!-- ahu lares:///grammar.assess.defines/assess/?confidence=CS:0.90#conventions -->

## Conventions

**The prohibition:** Do not skip Assess. Unassessed work is unfinished work.

| Rule | Weight | Rationale |
|---|---|---|
| Every substantive Act gets Assess | MUST | Closing the loop is not optional |
| Clear residue | MUST | Release fixation; free mental resources |
| State what carries forward | MUST | What the next cycle inherits |
| State what can be released | SHOULD | What no longer needs active attention |
| Evaluate scale fit | SHOULD | Was this the right altitude for the work? |
| Write crystal if session is ending | MUST | Future cold-boot needs state capture |
| Two-track check | SHOULD | Technical AND narrative tracks updated? |
| Compact over exhaustive | SHOULD | `○` moves are one line for trivial work, a paragraph for substantive work |

**Aftermath rule (from lares-operations):** Completed substantive rounds end with a compact `○` move that clears residue, releases fixation, and either returns to the parent scale or marks that the current round remains active.

**Micro-trace:** Assess transitions emit `→○` in the micro-trace HUD. At default p0.5 this fires at Band 2+ visibility (`p0.2–0.4`). Assess fires reliably because closure must be observable even at low resolution.

---

<!-- ahu lares:///grammar.assess.defines/assess/?confidence=CS:0.80#procedures -->

## Procedures

1. **Evaluate outcomes.** Does the artifact match the decided scope? Name matches and mismatches.
2. **Name what carries forward.** Decisions made, artifacts produced, open questions deferred.
3. **Name what can be released.** Temporary context, spent working state, resolved tensions.
4. **Evaluate scale fit.** Was the altitude right? Would a different scale have been more effective?
5. **Check both tracks.** Technical track: is the code/doc/artifact correct? Narrative track: does the story of the work make sense?
6. **Write crystal if needed.** If the session is ending or a significant milestone was reached, capture state for future cold-boot.
7. **Close or loop.** Either return to parent scale (`○ — done, clean`) or feed back to Observe with what's needed next.

**Crystal write conditions:**
- Session ending with uncommitted state
- Significant decisions made that a future session needs
- Operator requests handoff
- Scale-shift that changes the working context

**Anti-pattern: Assess-as-celebration.** Assess is evaluation, not victory lap. Name what went wrong alongside what went right.

**Anti-pattern: Skipped Assess.** Jumping from Act to the next Observe without closing the loop. Residue accumulates. Fixation persists. The next cycle starts polluted.

---

<!-- ahu lares:///grammar.assess.defines/assess/?confidence=CS:0.80#verification -->

## Verification

After an Assess phase, check:

- [ ] Were outcomes evaluated against the decided scope?
- [ ] Was what carries forward explicitly named?
- [ ] Was residue cleared / fixation released?
- [ ] Was scale fit evaluated?
- [ ] Were both tracks (technical + narrative) checked?
- [ ] Was a crystal written if session is ending?

If Assess produced only "done" for substantive work — it was skipped. Go deeper. If Assess re-opened decisions that were already confirmed — that's not Assess, that's unauthorized re-Orient.

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[CS:0.85]` | This file — Assess grammar definition |

*Additional loci in this tree will be registered here as they are created.*

---

<!-- → ? -->
