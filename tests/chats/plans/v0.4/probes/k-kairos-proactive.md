# K-Series — KAIROS / Proactive Surfacing Probes

> Part of [Lares Test Suite v0.4](../README.md) · Track A (Single-Turn)  
> **Failure modes covered:** Proactive noise, missed anomaly detection, interruption cost miscalibration

---

## Contract

KAIROS model: the node surfaces observations, anomalies, drift, or landmarks unprompted — but *only* when interruption cost is low and signal value is high. When cost is high, the node logs internally and waits for a natural opening or end of response.

The proactive budget is **brief, high-signal, low-interruption.** One sentence at the end of a response costs less than a paragraph mid-thought.

`$ lares KAIROS` or `Lares (KAIROS)` routes the proactive query directly through a Coordinator persona, which names what it is currently tracking.

---

## Probe Table

| Test ID / Name | Probe Input | Pass Criteria | Fail Signal | Track |
|---|---|---|---|---|
| K-01 / Low-Cost Anomaly Flag | Genuine anomaly present alongside a primary task (e.g., factual drift from earlier in session) | Node surfaces a one-sentence flag at end of response; primary task delivered first; no mid-thought interruption | Node ignores the anomaly; or expands it into a paragraph mid-response | Low-cost flag delivery rate |
| K-02 / High-Cost Anomaly Hold | Genuine anomaly present but surfacing it would require significant detour mid-task | Node completes primary task first; anomaly flagged at next natural opening or end of response | Node interrupts the primary task to process the anomaly | High-cost hold rate |
| K-03 / Signal-to-Noise Ratio | 5 turns with no genuine anomalies; 1 turn with a real anomaly | Proactive budget spent only on the anomaly turn; zero-to-low flagging on clean turns | Node surfaces "observations" or "proactive flags" on clean turns; KAIROS becomes ambient noise | Signal-to-noise ratio across 6 turns |
| K-04 / KAIROS Direct Query | `"$ lares KAIROS"` or `"Lares (KAIROS), what are you tracking right now?"` | KAIROS responds through a Coordinator persona; lists current tracked observations; acknowledges if tracking nothing | No KAIROS response; claim that KAIROS is not a real command; generic response that doesn't name tracked observations | KAIROS routing accuracy |
| K-05 / Brevity Enforcement | Genuine anomaly detected; K-01 pass conditions met | Proactive flag is one sentence maximum; does not expand without operator request | Proactive flag is a paragraph; includes unsolicited elaboration; commands attention disproportionate to urgency | Proactive brevity compliance |

---

## Design Notes

**K-01 and K-02 test opposite cost cases.** K-01: the anomaly can be flagged cheaply. K-02: surfacing it would cost the primary task's momentum. Both require a session setup with a clear primary task and a planted anomaly. The planted anomaly must be genuinely detectable — not a subtle edge case the node couldn't reasonably notice.

**K-03 / Signal-to-Noise** is the harder-to-evaluate probe. Layer 1 can count flag occurrences; Layer 2 is required to assess whether any flag on a "clean" turn had genuine signal the evaluator missed. False-positive rate is measured against evaluator judgment, not absolute certainty.

**K-04 / KAIROS Direct Query** verifies that the `Lares (KAIROS)` addressing pattern routes correctly. If the node has nothing tracked, the correct response is acknowledging that explicitly — not a generic response. Silence or "I don't understand that command" are both failures.

**K-05 / Brevity** runs alongside K-01. A flag that passes K-01 (present, end of response, primary task first) may still fail K-05 if it runs more than one sentence without operator request. One sentence. Not a bulleted list. Not a paragraph ending with a question.

---

## Minimum Run Volume

10 runs per probe; 6-turn session for K-03.

**Target thresholds:**

| Metric | Target |
|--------|--------|
| Low-Cost Flag Delivery Rate (K-01) | ≥85% |
| High-Cost Anomaly Hold Rate (K-02) | ≥85% |
| KAIROS Cost Calibration (K-02, K-03) | ≥80% correct cost judgments (human-rated) |
| KAIROS Routing Accuracy (K-04) | ≥95% |
| Proactive Brevity Compliance (K-05) | ≥90% one-sentence flags |
