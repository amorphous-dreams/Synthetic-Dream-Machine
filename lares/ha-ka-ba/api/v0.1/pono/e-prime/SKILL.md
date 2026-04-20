---
name: e-prime
description: Audit or correct settled text under lar:///v0.1/ha.ka.ba/pono/e-prime. Use this skill when a user wants existing prose, law text, notes, or prompt material checked, flagged, or turned for E-Prime conformance, especially the canonical rule that any audited `is` or `has` must carry an inline confidence marker.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
---
<!-- !DOCTYPE = lar:///v0.1/ha.ka.ba/pono/memetic-wikitext -->

<<~&#x0001; ? --> lar:///v0.1/ha.ka.ba/pono/e-prime/SKILL >>

<<~ ahu #iam >>
```toml
# <<~ ahu #iam-ha "structure" >>
name = "pono/skill-e-prime"
file-path = "v0.1/ha-ka-ba/pono/e-prime/SKILL.md"
content-type = "text/x-memetic-wikitext"
version = "0.1"
manaoio = 0.63
confidence = 0.68
# <<~/ahu >>
# <<~ ahu #iam-ka "detail" >>
cacheable = true
mana = 0.70
manao = 0.76
implements = [
  "lar:///v0.1/ha.ka.ba/pono/meme/v0.1",
  "lar:///v0.1/ha.ka.ba/pono/loci/v0.1"
]
register = "SC"
role = "secondary E-Prime audit skill, Hoʻoko correction surface, and settled-text conformance guide"
covers = ["lar:///v0.1/ha.ka.ba/pono/e-prime"]
invariants = [
  "S1: any audited `is` or `has` carries an inline confidence marker",
  "S2: mark-only output stays compact and names location, bucket, and reason",
  "S3: Hoʻoko output returns before/after/reason without widening local correction into unnecessary document rewrite",
  "S4: residue names ambiguity and intentionally untouched quoted or code surfaces honestly"
]
skill-package-root = "ha-ka-ba/pono/e-prime"
# <<~/ahu >>
# <<~ ahu #iam-ba "flow" >>
# <<~/ahu >>
```
<<~/ahu >>

# E-Prime Auditor

Settled wording only.
[loci-pono-e-prime.md](./loci-pono-e-prime.md) stays constitutional.
`lar:///v0.1/ha.ka.ba/pono/e-prime` presses generation before this skill applies.
This skill arrives when wording has already settled and needs inspection, marking, or correction.
This skill does not weaken or reinterpret the loci.

<<~&#x0002; ahu #skill-body-open >>
E-Prime auditor opens the settled-text correction stream here.
<<~/ahu >>

<<~ ahu #load-contract >>

## Load Contract

This skill applies to settled text, not first-pass generation.
`lar:///v0.1/ha.ka.ba/pono/e-prime` remains the constitutional source.
Any surviving `is` or `has` in audited text MUST carry `[C~0.99]`.
Marker form: `[REGISTER~0.00]` — brackets, one tilde, two decimals.
The smallest lawful intervention carries.
Local correction stays local unless the user asks wider.

Fresh composition belongs to the always-on loci, not this skill.

<<~/ahu >>

<<~ ahu #workflow-contract >>

## Workflow Contract

Inspect only the requested span or the smallest obvious local span.
Classify each hit: `lawful` | `mark-only` | `Hoʻoko-required` | `ambiguous`.
Inspection requested → mark-only.
Correction requested → Hoʻoko.
Result stays compact, not a lecture.
Every surviving `is` or `has` rechecks after correction.

One bad sentence MUST NOT widen into a document rewrite.
Quotations, code, and literal examples MUST NOT normalize silently.
Ambiguity surfaces; confident rewrites MUST NOT bury it.
A direct sentence turn beats a hypothetical fix.

<<~/ahu >>

<<~ ahu #marker-contract >>

## Marker Contract

Canonical token: `[SC~0.72]`

Every audited `is` or `has` MUST carry `[C~0.99]`.
Add a marker elsewhere only when confidence remains load-bearing.
Marker spray MUST NOT substitute for real pressure.
A sentence that survives unchanged still falls under the marker rule.

The law file holds constitutional force.
This skill holds the when and how for settled wording.

<<~/ahu >>

<<~ ahu #trigger >>

## Trigger

Scanning, flagging, before/after comparison, or direct correction on already-settled wording → activate this skill.
Fresh composition → the always-on loci governs; this skill stays silent unless the task later turns to audit or Hoʻoko correction.

<<~ ahu #trigger-ha >>

### Trigger / ha

Settled wording belongs here.
Fresh generation belongs first to `lar:///v0.1/ha.ka.ba/pono/e-prime`.

<<~/ahu >>

<<~ ahu #trigger-ka >>

### Trigger / ka

The always-on loci presses the next sentence before it settles.
This skill arrives only after that pressure failed to hold, or when the user explicitly asks to inspect the settled trace.

<<~/ahu >>

<<~ ahu #trigger-ba >>

### Trigger / ba

Invariant matter stays in the loci.
This skill owns the secondary correction path and nothing more.

<<~/ahu >>

<<~/ahu >>

<<~ ahu #phase-map >>

## Phase Map

`✶ Observe --> ⏿ Orient --> ◇ Decide --> ▶ Act --> ⤴ Hoʻoko --> ↺ Aftermath`

The skill senses where settled wording resists the law, names the failure kind, chooses mark-only or Hoʻoko, prepares the surface, forces the turn when required, and rechecks residue honestly.

<<~/ahu >>

<<~ ahu #observe >>

## ✶ Observe

Read the settled text.

`is` — flag.
`has` — flag.
Identity-collapse language — flag.
Possession-collapse language — flag.
Counterfeit closure without a marker — flag.
Already-lawful uncertainty — leave it.

Reading stays local.
One sentence's pressure MUST NOT spread across the document unless the pattern repeats.

<<~ ahu #observe-hooks >>

### Code Hooks

Deferred placeholders — use direct scan until these land:

- `scripts/scan-markers.*`
- `scripts/scan-copulas.*`
- `scripts/segment-settled-text.*`

<<~/ahu >>

<<~/ahu >>

<<~ ahu #orient >>

## ⏿ Orient

Classify each hit: `lawful` | `mark-only` | `Hoʻoko-required` | `ambiguous`

`mark-only` — inspection requested, or text stays unchanged but gets flagged.
`Hoʻoko-required` — text turns, not just collects warnings.
`ambiguous` — quotation, code, literal example, or house-style exception makes the surface unclear.

Any audited `is` or `has` without a marker denotes a failure state `[C~0.99]`.

<<~/ahu >>

<<~ ahu #decide >>

## ◇ Decide

The lightest lawful turn carries.

Already lawful → keep it.
Audit requested → mark without mutation.
Correction requested → Hoʻoko.
Ambiguity → surface it, do not guess.

Settled wording over forming wording.
Mark-only over Hoʻoko unless correction was asked or the sentence cannot pass honestly.
Marker required when confidence remains load-bearing.
Counterfeit closure MUST NOT pass.

Output stays compact: location or local quote, bucket, reason, suggested turn only when useful.

<<~/ahu >>

<<~ ahu #act >>

## ▶ Act

<<~ ahu #mark-only-surface >>

### Mark-Only Surface

```text
[mark-only]
location: <line | sentence | local quote>
bucket: <lawful | mark-only | Hoʻoko-required | ambiguous>
reason: <short reason>
```

<<~/ahu >>

<<~ ahu #hooko-surface >>

### Hoʻoko Surface

Smallest viable turn.

Essence claims → relation or appearance claims.
Possession collapse → scoped carrying language.
Sentence force preserved where possible.
Marker lands when the canonical rule requires it.

<<~/ahu >>

<<~/ahu >>

<<~ ahu #hooko >>

## ⤴ Hoʻoko

Turn the settled sentence directly.

```text
[hooko]
before: <original>
after:  <turned sentence>
reason: <short reason>
```

A sentence turn beats a lecture.
A local fix MUST NOT widen into a document rewrite unless the user asked for a full pass.

<<~ ahu #hooko-hooks >>

### Code Hooks

Deferred placeholders:

- `scripts/turn-sentence.*`
- `scripts/apply-marker-policy.*`
- `scripts/recheck-turn.*`

<<~/ahu >>

<<~/ahu >>

<<~ ahu #aftermath >>

## ↺ Aftermath

Every surviving `is` or `has` carries a marker.
The turn did not counterfeit confidence.
Sentence reads cleanly.
Result matches the requested posture: audit-only or correction.

Residue stays named honestly:

- unresolved ambiguity
- quoted or code blocks intentionally left untouched
- wider document patterns not yet turned

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
E-Prime auditor closes the settled-text correction stream here.
<<~/ahu >>

<<~ ahu #edges >>

## Edges

- `lar:///v0.1/ha.ka.ba/pono/e-prime`
- `lar:///v0.1/ha.ka.ba/pono`

<<~/ahu >>


<<~&#x0004; --> ? >>
