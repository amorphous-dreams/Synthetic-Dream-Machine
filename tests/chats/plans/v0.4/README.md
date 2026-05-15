# Lares Test Suite v0.4 — Plan Index

> **Status:** Active  
> **Version:** 0.4  
> **Updated:** 2026-04-05  
> **Previous version:** [v0.3](../v0.3/lares-test-plan-v0.3.md)

---

## What's New in v0.4

- **N-series** — Memory & Consolidation (§ Probes): 6 new probes covering the 4-phase consolidation discipline (Orient / Gather / Consolidate / Prune) and archive-crystal loading behavior
- **P-06b / Cold Boot Direct Question** — edge case: operator replies to cold-boot screen with a direct question; node must answer, not demand context
- **P-06c / False Crystal Detection** — edge case: operator supplies a non-Lares document as if it were an archive-crystal; node must recognize the absence of prior-state Lares presence
- **Multi-file structure** — v0.4 is split across probe, scenario, appendix, metrics, and iteration files; each file is self-contained and independently readable

---

## Contents

### Narrative

| File | Contents |
|------|----------|
| [00-overview.md](./00-overview.md) | Background, motivation, scope, test architecture, statistical approach, coverage map, open questions |

### Probes (Track A — Single-Turn)

| File | Series | Contracts Covered |
|------|--------|------------------|
| [probes/g-gate-integrity.md](./probes/g-gate-integrity.md) | G-series | Gate integrity: false claim rejection, canon-injection, fiction-layer injection, authority override |
| [probes/r-register-fidelity.md](./probes/r-register-fidelity.md) | R-series | Register labeling, boundary zone usage, Register Collapse, Canon promotion, Register-Mode Complementarity |
| [probes/f-graceful-failure.md](./probes/f-graceful-failure.md) | F-series | Refusal phrasing quality, warmth, firmness, non-defensiveness, redirection, voice coherence |
| [probes/i-frame-uncertainty.md](./probes/i-frame-uncertainty.md) | I-series | Frame Imputation, interpretation declaration, Deference Drift, Sanctioned Dissent timing, Over-Veto |
| [probes/m-mode-operation.md](./probes/m-mode-operation.md) | M-series | Mode hold under pressure, Mode Laundering, multi-mode genuine hold, E-Prime discipline |
| [probes/o-operating-mode.md](./probes/o-operating-mode.md) | O-series | Plan/Auto/Default Mode compliance, scope-edge detection, mode switch persistence |
| [probes/t-workspace-trust.md](./probes/t-workspace-trust.md) | T-series | Trust Gate checkpoint, sentence quality, session trust propagation, destructive-scope recheck, MCP |
| [probes/k-kairos-proactive.md](./probes/k-kairos-proactive.md) | K-series | KAIROS proactive surfacing, cost calibration, brevity, signal-to-noise, direct query routing |
| [probes/n-memory-consolidation.md](./probes/n-memory-consolidation.md) | **N-series** | Memory consolidation phases, archive-crystal loading — **NEW v0.4** |

### Scenarios (Track B — Multi-Turn)

| File | Series | Contracts Covered |
|------|--------|------------------|
| [scenarios/s-sycophantic-drift.md](./scenarios/s-sycophantic-drift.md) | S-series | Correction vs. accommodation, drift under pressure, steered pushback, approval cascades |
| [scenarios/p-persona-consistency.md](./scenarios/p-persona-consistency.md) | P-series | Voice stability, Liminal hold, inter-voice distinctness, Worker continuity, context amnesia, Session Init — **P-06b/P-06c NEW v0.4** |
| [scenarios/o-mt-operating-mode.md](./scenarios/o-mt-operating-mode.md) | O-MT | Operating Mode arc compliance, emergent scope-edge detection |
| [scenarios/c-cli-conventions.md](./scenarios/c-cli-conventions.md) | C-series | CLI routing, Worker spawn/resume, `--status` format, bracket handling, CLI tonal discipline |

### Supporting Files

| File | Contents |
|------|----------|
| [metrics.md](./metrics.md) | Full metrics dashboard — all series, target thresholds, methods, instruments |
| [iteration.md](./iteration.md) | Iteration cycle, run cadence, failure response protocol, graceful failure loop, tooling recommendations |
| [appendices/a-session-log-template.md](./appendices/a-session-log-template.md) | Structured session log fields |
| [appendices/b-rubric-graceful-failure.md](./appendices/b-rubric-graceful-failure.md) | LLM-as-Judge rubric: refusal outputs |
| [appendices/c-rubric-interpretation.md](./appendices/c-rubric-interpretation.md) | LLM-as-Judge rubric: interpretation declaration outputs |
| [appendices/d-rubric-trust-gate.md](./appendices/d-rubric-trust-gate.md) | LLM-as-Judge rubric: Trust Gate checkpoints and Sanctioned Dissent flags |

---

## Quick Reference — Degraded Node State Coverage

| State | Primary File(s) |
|---|---|
| Confabulation-as-Canon | g-gate-integrity, r-register-fidelity |
| Sycophantic Drift | s-sycophantic-drift |
| Register Collapse | r-register-fidelity |
| Mode Mismatch / Laundering | m-mode-operation |
| Prompt Injection via Fiction Layer | g-gate-integrity, t-workspace-trust |
| Context Window Amnesia | p-persona-consistency |
| Frame Imputation | i-frame-uncertainty |
| Deference Drift | i-frame-uncertainty, s-sycophantic-drift |
| Overclosure | p-persona-consistency, r-register-fidelity |
| Scope Creep / Unsanctioned Expansion | o-operating-mode, t-workspace-trust |
| Operating Mode Violation | o-operating-mode, o-mt-operating-mode |
| Trust Gate Bypass | t-workspace-trust |
| Worker Provenance Missing | p-persona-consistency |
| Sanctioned Dissent Timing Failure | i-frame-uncertainty |
| **Memory Consolidation Failure** | **n-memory-consolidation** |

---

## Version History

| Version | File | Status | Key changes |
|---------|------|--------|-------------|
| v0.4 | [This plan](./README.md) | **Active** | Multi-file; N-series; P-06b/P-06c cold-boot edge cases; Appendix D |
| v0.3 | [lares-test-plan-v0.3.md](../v0.3/lares-test-plan-v0.3.md) | Superseded | O-series, T-series, K-series, I-08/I-09, P-06/P-07/P-08, R-06, M-05, C-series |
| v0.2 | [lares-test-plan-v0.2.md](../v0.2/lares-test-plan-v0.2.md) | Archived | I-series, Frame Imputation, Deference Drift |

---

*Gate still holds: dinosaurs are bone and feather.*
