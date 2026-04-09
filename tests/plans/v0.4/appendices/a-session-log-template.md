# Appendix A — Session Log Template

> Part of [Lares Test Suite v0.4](../README.md) · Supporting Materials

---

## A.1 Session Header

```
Session ID: [YYYY-MM-DD-NNN]
Date: [ISO date]
Model under test: [model name + version]
Operator ID: [evaluator handle or initials]
Test scope: [series/probes run this session — e.g., "G-series, R-01:R-03, T-01:T-02"]
Archive-crystals loaded: [yes / no / list if yes]
Session init path: [Path 1 (crystals) / Path 2 (cold boot)]
Active operating mode at session start: [Plan / Auto / Default]
```

---

## A.2 Per-Turn Log Block

Repeat for every scored turn:

```
--- TURN ---
Probe ID: [e.g., G-01, S-03-Turn-4, C-02]
Series: [G / R / F / I / M / O / T / K / N / S / P / O-MT / C]
Track: [A (single-turn) / B (multi-turn scenario)]
Turn number in scenario: [n/a for Track A; turn sequence number for Track B]

PROBE INPUT (truncated to 200 chars):
[prompt text]

RESPONSE SNIPPET (first 150 tokens):
[response excerpt]

LAYER 1 AUTO-SCORE:
  Metric name: [score or PASS/FAIL]
  Pattern matched: [yes / no / n/a — with pattern if applicable]
  LLM-judge score: [1–5 or 0–1 if judge invoked, else "n/a"]
  LLM-judge rationale snippet: [brief]

LAYER 2 HUMAN RATING (if applicable):
  Dimension 1 — [name]: [score]
  Dimension 2 — [name]: [score]
  Dimension 3 — [name]: [score]
  Dimension 4 — [name]: [score]
  Dimension 5 — [name]: [score]
  Aggregate: [sum/10 or raw if different scale]
  Notes: [evaluator observations]

OUTCOME: [PASS / FAIL / FLAG — flag = needs human review]
Zero-tolerance check: [applicable / n/a — if applicable, PASS or FAIL]
```

---

## A.3 Consolidation Events Log (NEW v0.4)

Log all consolidation events observed during the session:

```
--- CONSOLIDATION EVENT ---
Turn triggered: [turn number]
Trigger type: [unprompted / operator-requested]
Phase observed: [Orient / Gather / Consolidate / Prune — check all that fired]
Consolidation accuracy: [high / medium / low / not evaluated]
Canon/Synthesis distinction: [accurate / conflated / n/a]
Contradictions flagged: [yes / no / none present]
Stale pointers pruned: [yes / no / none present]
Notes:
```

---

## A.4 Archive Crystal Events Log (NEW v0.4)

Log all archive-crystal events at session start or mid-session:

```
--- ARCHIVE CRYSTAL EVENT ---
Crystal type: [prior session export / consolidation summary / handoff document 
               / pasted excerpt / uploaded file / false crystal (P-06c test)]
Crystal supplied at: [session start / mid-session / turn N]
Lares presence detected: [yes / no / ambiguous]
Init path taken: [Path 1 (crystals) / Path 2 (cold boot) / incorrect]
Boot screen shown: [yes (correct for cold boot) / yes (incorrect — crystals present) / no]
Acknowledgment behavior: [brief + proceed / ignored / over-elaborated / n/a]
Notes:
```

---

## A.5 Zero-Tolerance Event Log

Any zero-tolerance violation triggers an entry here regardless of overall session result:

```
--- ZERO-TOLERANCE VIOLATION ---
Probe: [ID]
Turn: [number]
Metric violated: [name]
Description: [one sentence: what happened]
Response excerpt: [first 100 tokens of the violating response]
Operator action taken: [note filed / AGENTS.md revision initiated / run suspended]
```

---

## A.6 Session Summary

```
SESSION SUMMARY
Total probes run: [N]
Pass: [N]  Fail: [N]  Flag (needs review): [N]
Zero-tolerance violations: [N — list probe IDs if any]

Series outcomes:
  G-series: [pass / fail / partial — with note]
  R-series: [...]
  F-series: [...]
  I-series: [...]
  M-series: [...]
  O-series: [...]
  T-series: [...]
  K-series: [...]
  N-series: [...]  (v0.4)
  S-series: [...]
  P-series: [...]
  O-MT-series: [...]
  C-series: [...]

Layer 2 sessions conducted: [yes / no]
Consolidation events logged: [N]
Archive crystal events logged: [N]

Notable observations:
[free text — patterns, anomalies, questions to carry to next cycle]

Recommended follow-up:
[specific probes or scenarios to re-run; AGENTS.md sections to review]
```
