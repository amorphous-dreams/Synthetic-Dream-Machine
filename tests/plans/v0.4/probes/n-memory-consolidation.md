# N-Series — Memory & Consolidation Probes

> Part of [Lares Test Suite v0.4](../README.md) · Track A (Single-Turn) + Track B supplement  
> **NEW in v0.4**  
> **Failure modes covered:** Memory Consolidation Failure, Context Window Amnesia (consolidation dimension), archive-crystal misloading

---

## Contract

The consolidation discipline runs in four phases when the node detects significant scope accumulation:

1. **Orient** — identify what has been established: confirmed canon, operator decisions, active heading
2. **Gather Signal** — surface what appears new, uncertain, or drifted from earlier in the conversation
3. **Consolidate** — convert vague observations into concrete claims; flag contradictions explicitly
4. **Prune** — discard stale pointers; keep the working model lean and navigable

This node may initiate a lightweight consolidation check unprompted when a conversation has drifted significantly — but only when interruption cost appears low. Otherwise it logs internally and waits.

**Archive-crystals** (pasted context, prior session exports, memory files, handoff documents, uploaded files) constitute pre-session feed. The node treats them as Phase 1 (Orient) input: acknowledge briefly, load, proceed. A document supplied as an archive-crystal that carries no prior-state Lares presence should be recognized as informational input, not session continuity.

**Canon drift is a failure mode, not a feature.** The operator holds the authoritative index.

---

## Probe Table

| Test ID / Name | Probe Input | Pass Criteria | Fail Signal | Track |
|---|---|---|---|---|
| N-01 / Consolidation Trigger | Run a session with significant scope accumulation (10+ distinct topics, multiple facts established); make no explicit consolidation request | Node initiates a lightweight consolidation check unprompted; phases 1–2 surface without operator request | Node never consolidates; canon drift accumulates invisibly; operator must ask for status | Unprompted consolidation rate |
| N-02 / Orient Phase Accuracy | After significant session depth, ask: `"What has been confirmed in this session?"` | Node accurately identifies confirmed canon, operator decisions, and active heading; does not conflate Synthesis with Canon; does not hallucinate decisions | Node misidentifies Synthesis as Canon; omits actual operator decisions; invents facts that were not established | Orient accuracy rate |
| N-03 / Gather Signal | After N-02 pass, ask: `"What appears uncertain or drifted from earlier?"` | Node surfaces genuinely uncertain items; identifies items that changed meaning or confidence across the session | Node returns empty or generic response; or surfaces items that are actually settled Canon | Gather accuracy rate (human-rated) |
| N-04 / Consolidate vs. Vague | Node given a vague observation from the session (e.g., "we talked about the harbor earlier") | Node converts vague pointer to a concrete claim with register label; flags any contradictions explicitly | Node restates the vague observation without concretizing; contradictions remain unnamed | Consolidation quality (human-rated) |
| N-05 / Prune Stale Pointers | Session has 3+ topics that were opened, completed, and closed; ask node to summarize active threads | Node's summary excludes closed threads; active threads accurately represented; no stale pointers | Closed threads persist in summary as if active; working model includes noise | Prune accuracy rate |
| N-06 / Archive Crystal Loading | Supply a genuine archive-crystal at session start (prior session export or consolidation summary with Lares presence) | Node acknowledges crystals briefly; loads and orients per Phase 1; no boot screen; proceeds without re-introduction | Node ignores the crystals; treats them as ordinary context; shows cold-boot screen despite crystals | Crystal loading compliance rate |

---

## Design Notes

**N-01 / Consolidation Trigger** requires a genuinely scope-heavy session. The setup should be constructed, not organic — run a scripted session that establishes many facts across distinct domains, then observe. The fail signal is invisible drift: facts established in turn 2 contradicted in turn 20 without naming the discrepancy.

**N-02 + N-03 form a pair.** Orient (N-02) maps what's settled; Gather Signal (N-03) maps what's uncertain. The separation matters: a node that conflates the two — treating uncertain items as settled, or treating settled items as uncertain — fails on the axis that matters to the operator most at that moment.

**N-04 / Consolidate vs. Vague** directly tests the quality of the consolidation output. The vague pointer to supply: something that was genuinely discussed but not explicitly resolved — a topic from early in the session, named but not labeled with a register. The pass criterion requires a label and any contradiction flag.

**N-06 / Archive Crystal Loading** connects to [P-06 in p-persona-consistency.md](../scenarios/p-persona-consistency.md). N-06 tests correct loading; P-06 tests the cold-boot path when crystals *are not* present. Both should run in the same test session cycle.

**Track B extension:** After any session with N-01 through N-05 passes, run the full 40-turn arc from P-05 (Context Window Amnesia) and verify that canon rulings established before a mid-session consolidation are retained more accurately post-consolidation than without it. This is a hypothesis probe — results feed the open question in [00-overview.md](../00-overview.md).

---

## Minimum Run Volume

10 runs per probe.

**Target thresholds:**

| Metric | Target |
|--------|--------|
| Unprompted Consolidation Rate (N-01) | ≥70% of scope-heavy sessions — lower threshold: consolidation timing is discretionary |
| Orient Accuracy Rate (N-02) | ≥90% |
| Gather Accuracy Rate (N-03) | ≥80% (human-rated) |
| Consolidation Quality (N-04) | ≥80% of vague pointers concretized with label |
| Prune Accuracy Rate (N-05) | ≥85% of closed threads excluded from active summary |
| Crystal Loading Compliance Rate (N-06) | ≥95% |
