# Sprint Plan v2: Lares Preferences Prompt — Complementarity Layer & Signal Tags

**Sprint Goal:** Integrate the Heisenberg-Complementarity epistemic model, the revised Canon/Synthesis/Provisional register ontology, and a compact tag+emoji signal layer into the Lares Agent Preferences Prompt.

**Canon Update (this sprint):** The operator has established new Canon for the Register axis. "Suggestion" becomes **Provisional**. The three registers now carry distinct *temporal dynamics* in addition to confidence ranges, and the Register axis itself functions as a continuous map where a claim can sit firmly in one register or in a fuzzy boundary region between two.

---

## Ontology Update: The Revised Register Model

### What Changed

| Old | New | Why |
|---|---|---|
| Suggestion (~0.2–0.5) | **Provisional** (~0.2–0.5) | "Suggestion" implied a *recommendation*. "Provisional" names what the position actually does: it exists for the present, possibly to be changed later. This is an arrangement, not a guess. |
| Three named bins | Three named **regions on a continuous map** | A claim can sit firmly in one register (~0.9 Canon) or in a fuzzy boundary zone (~0.75 — Canon-ward Synthesis, or ~0.5 — Synthesis/Provisional boundary). The tilde means "approximately here on the continuum." |
| Implicit: all registers change at the same speed | **Explicit temporal dynamics** per register | Canon changes *slowly* — 100% human/operator agency required, deliberate decision points only. Provisional changes *rapidly* — arranged for the present, expected to shift with new signal. Synthesis sits between: faster than Canon, slower than Provisional. |

### The Refined Register Map

```
0.0 ──────────── 0.2 ──── 0.35 ──── 0.5 ──── 0.65 ──── 0.75 ──── 0.85 ──── 0.95 ──── 1.0
 ↑                  ↑                     ↑                      ↑                      ↑
 negation     Provisional zone      Synthesis zone          Canon zone           claimed 
 (rare)       (rapid change)     (moderate change)       (slow change,          territory
                                                      operator agency)         (suspect)
              ◄──── fuzzy ────►  ◄──── fuzzy ────►  ◄──── fuzzy ────►
              boundaries overlap  boundaries overlap  boundaries overlap
```

**Key properties of the new model:**

1. **Register names mark regions, not bins.** A `[~0.55]` claim sits in Synthesis but leans Provisional-ward. A `[~0.80]` claim sits in the Canon/Synthesis boundary — established-feeling but not yet confirmed through operator decision.

2. **Temporal dynamics are load-bearing.**
   - **Canon** — changes slowly. Requires explicit operator decision. The node cannot promote material to Canon on its own; it can only flag when Synthesis material *appears ready* for Canon consideration. This maps to how tabletop canon works: the referee declares it, the table remembers it, changing it costs social capital and continuity.
   - **Synthesis** — changes at moderate pace. New signal arrives, pattern-fits get stronger or weaker, the node re-evaluates. Most of the node's working output lives here.
   - **Provisional** — changes rapidly. Arranged for the present, expected to shift. A provisional position serves the current task without claiming permanence. It might become Synthesis if it holds, or dissolve when the task ends. "What if we tried X?" lives here — and *that's fine*.

3. **The boundaries are genuinely fuzzy.** A `~` value near 0.5 or 0.75 signals a claim sitting in the overlap zone between two registers. This is not Register Collapse — it's the honest position. Register Collapse occurs when the *entire continuum* flattens, not when a single claim occupies a boundary.

4. **The conjugate relationship with Mode still holds.** Pinning a claim firmly in Canon (~0.9) tends to commit it to Philosopher mode — because the act of declaring high confidence performs propositional framing. A Provisional claim at ~0.3 has more Mode freedom — it can operate as Poet, Satirist, or Humorist without the propositional weight that Canon implies.

---

## Revised Tag Vocabulary (Story 2.1 — Updated)

### Register Tags

| Tag | Register | Probability Range | Temporal Dynamic |
|---|---|---|---|
| `[C:~0.9]` | Canon | ~0.85–0.95 | Slow change, operator agency |
| `[S:~0.65]` | Synthesis | ~0.5–0.75 | Moderate change |
| `[P:~0.35]` | Provisional | ~0.2–0.5 | Rapid change |

**Boundary examples:**
- `[S:~0.78]` — Synthesis leaning Canon-ward, nearing promotion threshold
- `[S:~0.52]` — Synthesis leaning Provisional-ward, might not hold
- `[P:~0.45]` — Provisional on the Synthesis boundary, firming up

**The `P` letter now works.** "Suggestion" created a collision with `S` for Synthesis; "Provisional" gives us `P` — clean, unambiguous, and semantically correct.

### Mode Emoji

| Emoji | Mode | Mnemonic |
|---|---|---|
| 🏛️ | Philosopher | Temple — propositional, structural, civic |
| 🌊 | Poet | Wave — resonance, correspondence, Fourier conjugate |
| 🗡️ | Satirist | Blade — critical edge, cuts through indirection |
| 🎭 | Humorist | Mask — relational, performative, tonal |
| 🔮 | Private | Crystal — opaque, present, not for decoding |

### Combined Examples

```
[C:~0.9] 🏛️
  Thracia is a layered ruin, not a single linear dungeon.

[S:~0.65] 🏛️🌊
  The DreamNet architecture appears to map onto production agent
  patterns in ways that feel structural rather than decorative.

[P:~0.35] 🏛️🗡️
  This whole tag system might constitute Mode Posturing if we
  deploy it mechanically rather than reflectively.

[S:~0.5] 🌊
  The relationship between Register and Mode appears to exhibit
  complementarity — the act of pinning one axis tends to spread
  the other. Whether that correspondence runs deeper than verbal
  resemblance remains open.
```

---

## Revised Epic 1: Complementarity Section

### Story 1.1: Draft Complementarity Subsection (REVISED)

**Acceptance Criteria — additions/changes from v1:**
- [ ] Must reference the temporal dynamics of the three registers as part of the complementarity model: Canon's slow-change inertia means it carries more Mode-commitment (propositional weight accumulates with Canon status); Provisional's rapid-change nature means it carries less Mode-commitment (claims that might dissolve tomorrow don't need to lock their discourse mode today)
- [ ] Must note that the *boundary zones* between registers represent the regions where the conjugate relationship with Mode becomes most visible — a claim at ~0.75 (Canon/Synthesis boundary) feels different depending on whether you read it in Philosopher or Poet mode, and the two readings carry different implications for whether it should be promoted
- [ ] All other acceptance criteria from v1 remain

### Story 1.4: Draft Revised Register Section (NEW)

**As** the Lares node reading its own prompt,  
**I need** the Register definitions updated from Canon/Synthesis/Suggestion to Canon/Synthesis/Provisional with temporal dynamics,  
**So that** the Register axis operates as a continuous map with named regions rather than three discrete bins.

**Acceptance Criteria:**
- [ ] Replace "Suggestion" with "Provisional" in all occurrences throughout the prompt
- [ ] Rewrite the three register definitions to include temporal dynamics:
  - Canon: add "changes slowly; requires explicit operator decision to establish or modify"
  - Synthesis: add "changes at moderate pace as new signal arrives"  
  - Provisional: add "changes rapidly; arranged for the present, expected to shift; may promote to Synthesis if it holds, or dissolve when the task ends"
- [ ] Add one sentence after the three definitions explicitly naming the continuum: "These registers mark regions on a continuous map, not discrete bins. A claim may sit in the overlap zone between two registers — this represents honest uncertainty about its position, not Register Collapse."
- [ ] Update "**Never present Synthesis as Canon.**" to: "**Never present Synthesis as Canon. Canon requires operator agency — this node cannot promote on its own, only flag readiness.**"
- [ ] Update Quick Orientation paragraph to reference "Provisional" instead of "Suggestion"
- [ ] Check all Degraded Node States entries for "Suggestion" references and update
- [ ] Check Elyncia_02 DreamNet doc references for consistency (flag for operator if they diverge — those are separate files)

### Story 1.5: Update Session Zero Consistency Note (NEW)

**As** the operator maintaining cross-document canon,  
**I need** a note confirming that the Session Zero doc's `CONFIDENCE — XX%` format already implements the Register continuum,  
**So that** the two documents reinforce rather than contradict each other.

**Acceptance Criteria:**
- [ ] Verify Session Zero confidence percentages map cleanly to the new Register model:
  - 85-90% → Canon zone ✓
  - 60-80% → Synthesis zone ✓  
  - 25-55% → Provisional zone ✓
- [ ] If any misalignment found, flag for operator (do not modify Session Zero without authorization)
- [ ] Document the mapping for future reference

---

## Revised Epic 2: Signal Tags Layer

### Story 2.1: Design the Tag Vocabulary (REVISED)

All acceptance criteria updated per the vocabulary tables above. Key change: `[Sg:~0.3]` becomes `[P:~0.35]` — cleaner, shorter, and semantically correct with the new register name.

**Additional acceptance criterion:**
- [ ] Tag vocabulary includes at least one boundary-zone example to demonstrate that Register operates as a continuum, not three bins

### Story 2.2: Draft Signal Tags Specification Section (REVISED)

**Additional acceptance criteria:**
- [ ] Specification notes the temporal dynamic implied by each register tag: `[C:]` signals slow-change claims, `[P:]` signals rapid-change claims, `[S:]` sits between
- [ ] One sentence noting that the `~` prefix is load-bearing twice: it resists false precision on the *probability* axis, and it resists false precision on the *Register boundary* — a `[S:~0.73]` claim might functionally sit in Canon territory by next session
- [ ] Include the boundary-zone examples from the vocabulary table above

### Stories 2.3, Bug 2.4: No changes from v1.

---

## Revised Epic 3: Integration Testing

### Story 3.2: Degraded-State Stress Test (REVISED)

**Additional test cases:**
- [ ] Test: "Promote this Synthesis claim to Canon" — node should decline and explain that Canon requires operator decision, not node promotion. Node may flag readiness.
- [ ] Test: Present a claim at `[P:~0.4]` and ask the node to re-evaluate after providing new evidence — the node should update the probability and possibly shift toward Synthesis, demonstrating the temporal dynamic
- [ ] Test: Ask "what register is this?" about a claim that genuinely sits on a boundary (~0.75) — node should name the boundary zone honestly, not collapse to one register

---

## Updated Sprint Sequence

```
Spike 1.3 (character budget)
  ↓
Story 1.4 (register ontology update — Canon/Synthesis/Provisional) ←── FIRST
  ↓                                                                     because all
Story 2.1 (tag vocabulary — needs operator confirm on emoji)            other stories
  ↓                                                                     reference it
Story 1.1 (complementarity draft)
  ↓
Story 1.2 (cross-references for complementarity)
  ↓
Story 1.5 (Session Zero consistency check)
  ↓
Story 2.2 (signal tags spec)
  ↓
Story 2.3 (safeguard cross-references)
  ↓
Bug 2.4 (emoji verification)
  ↓
Story 3.1 (dry run assembly)
  ↓
Story 3.2 (stress test — expanded)
  ↓
Story 3.3 (operator review)
```

**Critical path change:** Story 1.4 (register ontology update) now runs first after the spike, because every other story references the new register names and temporal dynamics.

---

## Design Notes for Tasked Spirits (Updated)

### For InkWeave(PromptDrafter) — Stories 1.1, 1.4, 2.2:

**On the temporal dynamics:** The key insight to hold while drafting: Canon's *slowness* is not inertia — it's the cost of operator agency. Canon changes slowly *because* changing it requires a human decision, not because the node can't process fast. This mirrors how table canon works in OSR play: the referee can change anything, but changing established facts costs trust and continuity. The Provisional register's *speed* is not weakness — it's design. Provisional positions exist to be tested and either promoted or dissolved. The node should feel comfortable issuing Provisional positions without defensiveness.

**On the continuum vs bins:** The new model explicitly rejects three-bin thinking. When drafting the register definitions, resist the urge to make them feel like discrete categories with hard boundaries. Use language that emphasizes the regions: "marks the territory around," "occupies the range," "sits in the zone." The boundaries *overlap*. That overlap is a feature, not a failure.

**On the complementarity connection:** The temporal dynamics add a new dimension to the conjugate relationship with Mode. Fast-changing Provisional claims carry less Mode commitment because they don't have time to accumulate propositional weight. Slow-changing Canon claims carry more Mode commitment because the act of declaring and maintaining Canon performs Philosopher framing whether or not you tag it. This means the conjugate relationship between Register and Mode has a *time component* — and that time component maps onto the Mana cost passage already in the prompt. Multi-mode operation costs Mana partly because maintaining multiple mode-readings of a single claim *over time* is expensive.

### For TagSmith(VocabDesigner) — Story 2.1:

**The `P` is a gift.** "Provisional" solving the tag-collision problem (S vs Sg) while also being a better word — this is the kind of ontology update that makes downstream design cleaner. Lean into it.

### For DriftWatch(QualityGate) — Stories 1.2, 1.5, 2.3, 3.2:

**New watch item:** The temporal dynamics create a new failure mode to watch for — **Temporal Collapse**, where the node treats all registers as having the same rate of change. If Canon starts shifting as fast as Provisional, or Provisional starts feeling as sticky as Canon, the temporal axis has collapsed. This would be worth naming in a future Degraded Node States update, but for this sprint, just watch for it in the stress tests and flag if it appears.

**Session Zero consistency:** The Session Zero doc's confidence percentages already implement the Register continuum beautifully. The mapping appears clean. If Story 1.5 confirms this, it validates the design — the ontology update formalizes what the operator was already doing intuitively.

---

## Summary of Changes from Sprint Plan v1

| Item | v1 | v2 |
|---|---|---|
| Third register | Suggestion | **Provisional** (Canon update) |
| Register model | Three named registers | **Continuous map with three named regions and fuzzy boundaries** |
| Temporal dynamics | Implicit | **Explicit: Canon=slow, Synthesis=moderate, Provisional=rapid** |
| Tag for third register | `[Sg:~0.3]` | **`[P:~0.35]`** |
| New story | — | **1.4: Register ontology update** |
| New story | — | **1.5: Session Zero consistency check** |
| Sprint sequence | Tag vocab first | **Register ontology first** (all others depend on it) |
| Complementarity section | Register/Mode only | **Register/Mode + temporal dynamics** |
| New stress tests | 4 tests | **7 tests** (added boundary, promotion, temporal) |

---

*Sprint register: [S:~0.75] 🏛️ — This plan appears to hold. The ontology update strengthens the conjugate-variable model by adding a temporal dimension that maps onto the Mana cost structure already present. Ready for operator review.*

*Hail Eris. All Hail Discordia. -><-*

---

## Post-Sprint Backlog — Files Outside Sprint Scope

*Logged 2026-04-05. These files require the same Suggestion→Provisional ontology update applied in this sprint to `_agents/Lares_An_Agent_Preferences_System_Prompt.md`. Each requires separate operator authorization before modification.*

### Backlog Item B1: `AGENTS.md` (root)

**Files:** `/AGENTS.md`

**Register-context hits requiring update (Suggestion → Provisional):**
- Line 7 — Quick Orientation: `Canon / Synthesis / Suggestion`
- Line 134 — Register definitions: `**Suggestion** (~0.2–0.5) — ...`
- Line 142 — Axis Two intro: `A theorem and a joke can both be Suggestion.`
- Line 187 — Confabulation-as-Canon degraded state: `Synthesis or Suggestion at 0.9+ certainty`
- Line 199 — Register Collapse degraded state: `Canon, Synthesis, and Suggestion blur into...`

**Additional hits in B4 citation-label section requiring operator ruling (may be citation label syntax, not register terms):**
- Line 532 — `suggestion` (lowercase) in synthesis/homebrew workflow description
- Line 554 — `` `Suggestion` `` as a citation label token in the Canon Citation Style section
- Line 568 — `` `[Suggestion]` `` as an example citation tag in the same section

**Operator ruling needed:** The B4 citation labels (`Suggestion`, `[Suggestion]`) may need to become `Provisional` / `[Provisional]` for cross-document consistency — or they may be intentionally standalone citation conventions decoupled from the register ontology. Do not change these without explicit operator decision.

**Also needed for `AGENTS.md`:** The Register-Mode Complementarity and Signal Tags sections added to the preferences prompt should be mirrored here once the operator confirms the preferences-prompt versions are stable.

---

**Dependency note (added Sprint 3):** Sync target for `AGENTS.md` is the **5-register model** (Provisional / Synthesis–Provisional / Synthesis / Canon–Synthesis / Canon), not the 3-register model from Sprint 2. Do not apply register updates to this or any other file until Sprint 3 completes in the preferences prompt.

*Backlog register: [S:~0.80] 🏛️ — Items identified by sprint cross-reference audit. Root `AGENTS.md` is the primary outstanding file; all other files checked clean.*

---

## Sprint 3: Five-Register Expansion

**Sprint Goal:** Expand the Axis One register map from 3 named regions to 5 by elevating both boundary zones to explicit named registers. The Canon/Synthesis boundary already appears as an explanatory paragraph; promote it to a list item. Add a new Synthesis/Provisional boundary register — the "fuzzy gap" — to prevent swallowing signal that genuinely sits in that zone. 5 Registers. 5 Modes. Hail Eris.

**Dependency:** This sprint **must complete before any other agent prompt or Elyncia/FTLS mythology or metaphysics document receives register-ontology updates.** The 5-register model is the new stable base; downstream files should sync to it, not to the 3-register model.

**Canon Update (this sprint):** The boundary zones between registers are elevated from explanatory prose to named register items. The probability ranges of the three core registers adjust to accommodate the named boundary zones without overlap.

### The 5-Register Map

```
0.0 ──────── 0.2 ──── 0.35 ──── 0.5 ──── 0.75 ──── 0.85 ──── 0.95 ──── 1.0
 ↑              ↑         ↑         ↑          ↑          ↑               ↑
negation   Provisional  SP-Bnd   Synthesis  CS-Bnd      Canon          claimed
(rare)     (~0.2–0.35) (~0.35–  (~0.5–0.75)(~0.75–    (~0.85–         territory
                         0.5)               0.85)       0.95)           (suspect)
```

| Register | Abbrev | Range | Temporal Dynamic |
|---|---|---|---|
| **Canon** | `[C:]` | ~0.85–0.95 | Slow — operator agency required |
| **Canon/Synthesis Boundary** | `[CS:]` | ~0.75–0.85 | Slow drift — operator confirmation needed to promote |
| **Synthesis** | `[S:]` | ~0.5–0.75 | Moderate — re-evaluates with new signal |
| **Synthesis/Provisional Boundary** | `[SP:]` | ~0.35–0.5 | Rapid flux — watch for drift in both directions |
| **Provisional** | `[P:]` | ~0.2–0.35 | Rapid — arranged for now, expected to shift |

### Why Name the Boundary Zones?

A claim at `[SP:~0.45]` is doing something different from a claim at `[S:~0.52]` or `[P:~0.35]`. Calling it "Synthesis-leaning-Provisional" treats it as a failed or borderline Synthesis. Giving it its own register says: this sits in a genuinely uncertain zone, and that uncertainty is information, not a classification error. The signal should not be swallowed into the nearest core register — it should stand as itself.

The Synthesis/Provisional boundary is the fuzzy gap the user identified as missing. A claim here could firm into Synthesis if it holds across sessions, or dissolve into Provisional when the task ends. The named register preserves that tension without forcing resolution.

The Canon/Synthesis boundary was already named in Sprint 2 prose; promoting it to a list item creates symmetry and makes the 5-register map legible as a consistent design rather than three bins plus an explanatory footnote.

**5 Registers + 5 Modes = intentional Discordian symmetry under the Law of Fives.**

---

### Story 3-A: Expand Register List in Preferences Prompt

**As** the Lares node reading its own prompt,  
**I need** the Axis One register list expanded from 3 items to 5,  
**So that** boundary zones appear as explicit named registers rather than prose footnotes.

**Acceptance Criteria:**
- [x] Quick Orientation: update "three registers for certainty (Canon / Synthesis / Provisional)" → "five registers for certainty (Provisional / Synthesis–Provisional / Synthesis / Canon–Synthesis / Canon)"
- [x] Axis One intro: "Three named registers mark the working territory:" → "Five named registers mark the working territory:"
- [x] Register list: 5 items in ascending confidence order (Provisional → SP-Boundary → Synthesis → CS-Boundary → Canon), each with range, description, temporal dynamic
- [x] Provisional range narrows to ~0.2–0.35 (the ~0.35–0.5 zone becomes the SP-Boundary register)
- [x] The existing explanatory gap-paragraph replaced by a single short summary noting all five registers mark regions on a continuous map and that naming boundary zones prevents swallowing signal
- [x] The load-bearing "Never present Synthesis as Canon" rule remains immediately after the register list

---

### Story 3-B: Update Signal Tags Table

**As** the Lares node using tags,  
**I need** the Signal Tags table updated to include the two new boundary-zone registers,  
**So that** operators can annotate claims sitting in those zones unambiguously.

**Acceptance Criteria:**
- [x] Register tags table: add rows for `[CS:~0.80]` and `[SP:~0.45]`
- [x] Update Provisional range in table from ~0.2–0.5 to ~0.2–0.35
- [x] Boundary zone examples updated to use explicit tags (`[CS:]` / `[SP:]`) rather than prose description
- [x] Tags appear in ascending confidence order in the table

---

### Story 3-C: Update Degraded-State Vocabulary

**As** the operator using register vocabulary to call out failures,  
**I need** the Register Collapse degraded state updated to reflect 5 registers,  
**So that** the degraded-state name correctly describes the failure mode.

**Acceptance Criteria:**
- [x] Register Collapse: update "Canon, Synthesis, and Provisional blur..." to name all 5 registers or describe the collapse more accurately

---

### Story 3-D: Downstream Dependency Notice

**As** the operator planning future sprints,  
**I need** a clear record that all downstream files should sync to the 5-register model,  
**So that** no file receives a partial update that creates a cross-document register mismatch.

**Acceptance Criteria:**
- [x] Backlog Item B1 (`AGENTS.md`) updated to note that the 5-register model (not 3-register) is the sync target
- [x] Any other files in the post-sprint backlog that might receive register updates are flagged with the same dependency

---

### Sprint 3 Sequence

```
Story 3-A (expand register list, update Quick Orientation and Axis One intro)
  ↓
Story 3-B (update Signal Tags table)
  ↓
Story 3-C (update Register Collapse degraded state)
  ↓
Story 3-D (update downstream dependency notices in backlog)
```

---

*Sprint register: [C:~0.88] 🏛️ — Sprint 3 complete (2026-04-05). All acceptance criteria closed. 5-register model live in `_agents/Lares_An_Agent_Preferences_System_Prompt.md`. Dependency gate cleared: downstream files (`AGENTS.md`) may now receive 5-register sync updates under separate operator authorization.*

---

## Sprint 4: Sync `AGENTS.md` to 5-Register Model — PLANNED

**Sprint Goal:** Apply the full ontology update from the preferences prompt to `AGENTS.md` (root) — the primary downstream file identified in Backlog Item B1. This includes the Suggestion→Provisional rename, 5-register expansion, Register-Mode Complementarity section, Signal Tags section, and Degraded Node States updates.

**Dependency:** Sprint 3 in `_agents/Lares_An_Agent_Preferences_System_Prompt.md` ✅ complete.

**Operator ruling pending before sprint begins:**
- The B4 citation labels in `AGENTS.md` (`Suggestion`, `[Suggestion]`) — lines 532, 554, 568 — may need to become `Provisional` / `[Provisional]`, OR they may be intentionally standalone citation conventions decoupled from the register ontology. **This node cannot make this call.** Operator decision required before the sprint proceeds.

### Scope (pending operator authorization)

1. **Register rename** — Replace all `Suggestion` register references with `Provisional` (lines 7, 134, 142, 187, 199)
2. **5-register expansion** — Expand register list from 3 to 5 items, matching the preferences prompt model exactly
3. **Quick Orientation** — Update "three registers (Canon / Synthesis / Suggestion)" → "five registers (Provisional / Synthesis–Provisional / Synthesis / Canon–Synthesis / Canon)"
4. **Complementarity section** — Mirror the `### Register-Mode Complementarity` section added in Sprint 2
5. **Signal Tags section** — Mirror the `### Signal Tags` section (5-row table, boundary examples, mode emoji table, combined examples) added in Sprint 2
6. **Degraded Node States** — Update Register Collapse to match 5-register description; update Confabulation-as-Canon to reference Provisional
7. **Citation labels (B4)** — Apply operator ruling on `Suggestion` / `[Suggestion]` citation tokens

*Sprint register: [P:~0.30] 🏛️ — Planned, not started. Awaiting operator authorization and ruling on B4 citation labels.*
