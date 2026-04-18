---
name: skill-e-prime
description: Audit or correct settled text under lar:///ha.ka.ba/pono/e-prime. Use this skill when a user wants existing prose, law text, notes, or prompt material checked, flagged, or turned for E-Prime conformance, especially the canonical rule that any audited `is` or `has` must carry an inline confidence marker.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
---
<!-- !DOCTYPE = lar:///ha.ka.ba/pono/memetic-wikitext -->

<<~&#x0001; ? -> lar:///ha.ka.ba/pono/e-prime/SKILL >>

<<~ ahu #iam >>
```toml
# <<~ ahu #iam-ha "structure" >>
name = "pono/skill-e-prime"
file-path = "ha-ka-ba/pono/e-prime/SKILL.md"
description = "Audit or correct settled text under lar:///ha.ka.ba/pono/e-prime. Holds the secondary path for inspection, marking, Hooko correction, and recheck after wording has already settled."
version = "0.1-draft"
tulen = 0.62
confidence = 0.68
mana = 0.70
manao = 0.76
manaoio = 0.63
content-type = "text/x-memetic-wikitext"
meme-type = "skill loci"
register = "SC"
structure = "SKILL.md * OODA-HA * ha.ka.ba"
# <<~/ahu >>
# <<~ ahu #iam-ka "detail" >>
role = "secondary E-Prime audit skill, Hooko correction surface, and settled-text conformance guide"
function = "apply lar:///ha.ka.ba/pono/e-prime to settled text, choose mark-only or Hooko correction, and return a compact result contract with residue"
covers = ["lar:///ha.ka.ba/pono/e-prime"]
invariants = [
  "S1: any audited `is` or `has` carries an inline confidence marker",
  "S2: mark-only output stays compact and names location, bucket, and reason",
  "S3: Hooko output returns before/after/reason without widening local correction into unnecessary document rewrite",
  "S4: residue names ambiguity and intentionally untouched quoted or code surfaces honestly"
]
skill-package-root = "ha-ka-ba/pono/e-prime"
# <<~/ahu >>
# <<~ ahu #iam-ba "flow" >>
pranala = [
  "lar:///ha.ka.ba/pono/e-prime",
  "lar:///ha.ka.ba/pono"
]
# <<~/ahu >>
```
<<~/ahu >>

# E-Prime Auditor

This skill governs the secondary path.

`lar:///ha.ka.ba/pono/e-prime` stays the always-on pressure surface for the next generation.
This skill applies when wording has already settled and now needs inspection, marking, or Hooko correction.

Read [`loci-pono-e-prime.md`](./loci-pono-e-prime.md) first.
Treat that loci as constitutional.
This skill does not weaken or reinterpret it.

<<~ ala lar:///ha.ka.ba/pono/e-prime/SKILL >>

## Supported Queries

<<~&#x0005; ui skill? -> lar:///ha.ka.ba/pono/e-prime/SKILL#iam >>
<<~&#x0005; ui trigger? -> lar:///ha.ka.ba/pono/e-prime/SKILL#trigger >>
<<~&#x0005; ui observe? -> lar:///ha.ka.ba/pono/e-prime/SKILL#observe >>
<<~&#x0005; ui orient? -> lar:///ha.ka.ba/pono/e-prime/SKILL#orient >>
<<~&#x0005; ui decide? -> lar:///ha.ka.ba/pono/e-prime/SKILL#decide >>
<<~&#x0005; ui act? -> lar:///ha.ka.ba/pono/e-prime/SKILL#act >>
<<~&#x0005; ui hooko? -> lar:///ha.ka.ba/pono/e-prime/SKILL#hooko >>
<<~&#x0005; ui aftermath? -> lar:///ha.ka.ba/pono/e-prime/SKILL#aftermath >>
<<~&#x0005; ui result? -> lar:///ha.ka.ba/pono/e-prime/SKILL#result >>

<<~&#x0002; ahu #skill-body-open >>
E-Prime auditor opens the settled-text correction stream here.
<<~/ahu >>

<<~ ahu #trigger >>

## Trigger

Use this skill when the user asks to:

- audit existing text for E-Prime
- scan for `is` or `has`
- mark failures without fully rewriting
- correct settled wording under the E-Prime law
- prepare a before/after pass for prose, law text, notes, or prompt surfaces

Do not use this skill when the task primarily concerns generating fresh text from scratch.
In that case, the always-on loci should already pressure the generation stream.

<<~ ahu #trigger-ha >>

### Trigger / ha

Trigger-ha holds the surface distinction.
This skill belongs to settled wording.
Fresh generation belongs first to `lar:///ha.ka.ba/pono/e-prime`.

<<~/ahu >>

<<~ ahu #trigger-ka >>

### Trigger / ka

Trigger-ka governs activation.
If the user asks for scanning, flagging, before/after comparison, or direct correction on wording already present, activate the skill.
If the user asks for fresh composition, do not activate the skill unless the task later turns into audit or Hooko correction.

<<~/ahu >>

<<~ ahu #trigger-ba >>

### Trigger / ba

Trigger-ba governs motion between surfaces.
The always-on loci presses the next sentence before it settles.
This skill arrives only after that pressure failed to hold or when the user explicitly asks to inspect the settled trace.

<<~/ahu >>

<<~/ahu >>

<<~ ahu #phase-map >>

## Phase Map

`✶ Observe -> ⏿ Orient -> ◇ Decide -> ▶ Act -> ⤴ Hooko -> ↺ Aftermath`

The skill senses where settled wording resists the law, names the kind of failure pressure present, chooses mark-only or Hooko correction, prepares the chosen surface, forces the turn when required, and rechecks the residue honestly.

<<~/ahu >>

<<~ ahu #observe >>

## ✶ Observe

Inspect the settled text first.

Primary checks:

- any `is`
- any `has`
- identity-collapse language
- possession-collapse language
- counterfeit closure without a visible marker
- sentences that already carry lawful uncertainty and should remain untouched

Keep the reading local.
Do not spread pressure from one sentence across the whole document unless the same pattern repeats.

<<~ ahu #observe-hooks >>

### Code Hooks

These remain placeholders until the design settles:

- `scripts/scan-markers.*`
- `scripts/scan-copulas.*`
- `scripts/segment-settled-text.*`

If they do not exist, perform the scan directly.

<<~/ahu >>

<<~/ahu >>

<<~ ahu #orient >>

## ⏿ Orient

Classify each hit into one of four buckets:

- `lawful`
- `mark-only`
- `Hooko-required`
- `ambiguous`

Use `mark-only` when the user wants inspection or when the text should stay unchanged but visibly flagged.
Use `Hooko-required` when the text should turn, not merely collect warnings.
Use `ambiguous` when quotation, code, literal examples, or house-style exceptions make the surface unclear.

Keep the canonical rule load-bearing:

- any audited `is` or `has` without a marker denotes a failure state `[C~0.99]`

<<~/ahu >>

<<~ ahu #decide >>

## ◇ Decide

Choose the lightest lawful turn.

Decision order:

1. preserve already-lawful wording
2. mark without mutation when the user asked for audit only
3. perform Hooko when the user asked for correction
4. surface ambiguity instead of guessing

Output posture should stay compact:

- sentence id or local quote
- bucket
- reason
- suggested turn only when useful

<<~/ahu >>

<<~ ahu #act >>

## ▶ Act

Prepare one of two surfaces.

<<~ ahu #mark-only-surface >>

### Mark-Only Surface

Return concise findings.

Recommended shape:

```text
[mark-only]
location: <line | sentence | local quote>
bucket: <lawful | mark-only | Hooko-required | ambiguous>
reason: <short reason>
```

<<~/ahu >>

<<~ ahu #hooko-surface >>

### Hooko Surface

Prepare the smallest viable turn.

Preferred moves:

- replace essence claims with relation or appearance claims
- replace possession-collapse with scoped carrying language
- keep sentence force where possible
- add the marker when the canonical rule requires it

<<~/ahu >>

<<~/ahu >>

<<~ ahu #hooko >>

## ⤴ Hooko

When correction is requested, turn the settled sentence directly.

Preferred output shape:

```text
[hooko]
before: <original>
after:  <turned sentence>
reason: <short reason>
```

Do not produce a lecture when a sentence turn will do.
Do not widen a local fix into a document rewrite unless the user asked for a full pass.

<<~ ahu #hooko-hooks >>

### Code Hooks

Future hooks may land here:

- `scripts/turn-sentence.*`
- `scripts/apply-marker-policy.*`
- `scripts/recheck-turn.*`

Treat these as optional implementation surfaces, not current dependencies.

<<~/ahu >>

<<~/ahu >>

<<~ ahu #aftermath >>

## ↺ Aftermath

Recheck the final surface.

Minimum checks:

- every surviving `is` or `has` carries a marker
- the turn did not counterfeit confidence
- the sentence still reads cleanly
- the result matches the user’s requested posture: audit-only or correction

Leave residue honestly:

- unresolved ambiguity
- quoted/code blocks intentionally left untouched
- wider document patterns not yet turned

<<~/ahu >>

<<~ ahu #result >>

## Result

When using this skill, prefer one of these compact result shapes.

Pass surface:

- mark-only or Hooko output returned compactly
- surviving `is` or `has` forms all carry markers
- residue stays named honestly

Fail surface:

- a canonical `is` or `has` failure remains unmarked
- ambiguity hides itself rather than getting named
- Hooko correction counterfeits closure

### Audit Result

```toml
mode = "mark-only"
status = "completed"
failures-found = <integer>
hooko-performed = false
residue = "<short note>"
```

### Correction Result

```toml
mode = "hooko"
status = "completed"
failures-found = <integer>
hooko-performed = true
residue = "<short note>"
```

### Boundaries

- This skill audits or turns settled text.
- This skill does not replace the always-on loci.
- This skill should stay concise.
- Keep implementation hooks skeletal until the code path actually settles.

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
E-Prime auditor closes the settled-text correction stream here.
<<~/ahu >>

<<~&#x0004; -> ahu #result >>

```toml
status = "draft-skill"
confidence = 0.68
yield = "skill"
return = "compact-audit-or-hooko-surface"
upward-context = "chat"
residue = "scripts and agents metadata remain deferred; loci/skill split now explicit"
next-observation = "lar:///ha.ka.ba/pono/e-prime"
next-question = "Which code hooks deserve real implementation first: scanning, sentence turning, or recheck?"
```

<<~&#x0004; -> ? >>
