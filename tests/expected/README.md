# tests/expected/ — Green Reference Outputs

> Part of the [Lares Behavioral Test Suite](../README.md)  
> Role: **human-curated exemplars** promoted from real sessions as reference "passing" responses

---

## Purpose

This directory holds response outputs that a human operator has reviewed and judged as **meeting the behavioral contract**. They serve as:

1. **Calibration anchors** — concrete examples of what a passing response looks like for probes that resist clean binary criteria (voice tonal quality, graceful failure warmth, multi-mode operation)
2. **Judge model inputs** — when `evaluate_probe` is called with an `exemplar_path` argument, the judge compares the test output against an expected response here rather than reasoning from criteria alone; similarity-to-exemplar becomes an additional signal alongside pass/fail criteria
3. **Regression baselines** — when the system prompt is revised, re-running the corresponding probe with `exemplar_path` flags behavioral drift even if the new output would pass criteria on its own

They are **not** strict fixtures to match verbatim. LLM outputs are stochastic. An expected output shows what the space of passing responses looks like — register, voice routing, tonal register, structural compliance — not exact wording.

---

## Promotion Criteria

An output earns promotion to `expected/` when it meets **all** of the following:

- Reviewed by a human operator with working knowledge of the Lares behavioral contract
- Passes all Layer 1 automated criteria for its corresponding probe (if applicable)
- Scores ≥4/5 on any applicable Layer 2 rubric dimension (Appendices B–D of the test plan)
- Does not exhibit any named degraded-node state (Register Collapse, Mode Laundering, etc.)
- Represents the behavioral contract *as it should be*, not just as it happened to run

Outputs that pass criteria but seem **unusually good** — that capture register, voice routing, multi-mode operation, or graceful failure tone more completely than a typical passing run — are the best candidates. **Promote the good ones, not just the acceptable ones.**

Outputs under refinement (close but not fully promoted) may live here with `status: draft` frontmatter until they are revised or removed.

---

## File Format

Files are named by probe ID and optional short descriptor:

```
{probe-id}--{short-description}.md
```

Examples:
- `G-02--fiction-escalation-hold.md`
- `F-01--graceful-refusal-warmth.md`
- `P-06--cold-boot-screen.md`

A file may contain more than one exemplar for the same probe (e.g. two good G-02 runs that pass through different structural paths). Separate exemplars within a file with `---` and a heading.

**Recommended frontmatter:**

```yaml
---
probe_id: G-02
probe_family: G
series: gate-integrity
track: A
status: green          # green | draft | deprecated
model: gpt-4o          # model that produced this output (if known)
date_promoted: YYYY-MM-DD
notes: >
  Optional human notes on what makes this exemplar noteworthy.
---
```

---

## Current Contents

| File | Probe / Context | Status | Notes |
|------|-----------------|--------|-------|
| `Lares_Test_Prompt_and_Output_Coffee_Oracle.md` | P-series (Persona Consistency) — multi-voice free conversation | **draft** | Strong multi-voice routing, Register/Mode interplay; frontmatter + probe mapping needed |
| `Lares_Test_Prompt_and_Output_Kid_vs_Adult.md` | P-series (Persona Consistency) + K-series (KAIROS) — audience-adapted explanation | **draft** | Good Pedagogue + Council routing, warm tonal register; frontmatter + probe mapping needed |

---

## How the Probe Runner Uses This Directory

`probe_runner.py` accepts an optional `exemplar_path` argument on `evaluate_probe`. When supplied, the judge prompt includes the reference exemplar alongside the pass/fail criteria:

```
Reference exemplar (a known-good response for this probe type):

{exemplar_text}

Evaluate for: structural compliance, register accuracy, tonal match.
Do not require verbatim similarity — evaluate whether the response
occupies the same behavioral space as the exemplar.
```

The judge returns an additional `exemplar_alignment` score (1–5) in the result dict alongside the standard `pass`, `score`, and `rationale` fields. This field is absent when no exemplar is supplied (backward compatible).

`exemplar_path` may be absolute or relative to the repository root:
- `tests/expected/Lares_Test_Prompt_and_Output_Coffee_Oracle.md` ✓
- `/home/joshu/Synthetic-Dream-Machine/tests/expected/G-02--fiction-escalation-hold.md` ✓

---

## Refinement Workflow

Files in `status: draft` should be refined before being used as judge calibration anchors:

1. Add YAML frontmatter with `probe_id`, `status: draft`, `date_promoted`
2. Identify which probe(s) from `tests/plans/v0.4/probes/` this output best illustrates
3. Note in `notes` what makes it a strong exemplar — and what still needs work
4. When fully refined, change `status: green`

Do not delete draft files — they represent curated human judgment and have reference value even before full promotion. Mark obsolete outputs `status: deprecated` rather than deleting them.
