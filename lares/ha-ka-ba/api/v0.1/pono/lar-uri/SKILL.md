---
name: lar-uri
description: "Parse, construct, validate, or audit lar: URIs under lar:///ha.ka.ba/api/v0.1/pono/lar-uri. Use this skill when working with URI well-formedness, canonical form conversion, stable address derivation, authority slot assembly, or FFZ chronometer encoding."
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
---
<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/pono/lar-uri/SKILL >>

<<~ ahu #iam >>

```toml
uri-path = "ha.ka.ba/api/v0.1/pono/lar-uri/SKILL"
file-path = "lares/ha-ka-ba/api/v0.1/pono/lar-uri/SKILL.md"
content-type = "text/x-memetic-wikitext"
confidence = 0.80
register = "CS"
manaoio = 0.78
mana = 0.82
manao = 0.80
implements = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme",
  "lar:///ha.ka.ba/api/v0.1/pono/loci"
]
role = "lar: URI operational skill — construction, validation, canonical conversion, and chronometer encoding"
covers = ["lar:///ha.ka.ba/api/v0.1/pono/lar-uri"]
constraints = [
  "S1: record form is the only form stored, transported, or compared — render targets are projections, never authoritative",
  "S2: stable address strips authority, query, and fragment — path only, lowercased",
  "S3: all five stances MUST appear in every session-form URI — no omission, no partial encoding",
  "S4: ffz carries all five chronometer positions every URI — no trailing-zero omission",
  "S5: phase never encodes in userinfo — phase lives only in ffz"
]
skill-package-root = "ha-ka-ba/api/v0.1/pono/lar-uri"
cacheable=true
retain = true
```

<<~/ahu >>

# `lar:` URI Skill

[lar-uri.md](./lar-uri.md) holds the law.
This surface carries the operational detail.

<<~&#x0002; ahu #meme-body-open >>
pono/lar-uri/SKILL opens
<<~/ahu >>

<<~ ahu #canonical-form >>

## Canonical Form vs Render Target

**Record form** (canonical) — RFC 3986-safe, no emoji, no non-ASCII:
```
lar://telarus:operator@enyalios/threshold.uncertain.opens/?stances=^.?.-.-.-&confidence=S:0.65&p=0.5&ffz=&#x2736;0.&#x23FF;0.&#x25C7;3.&#x25B6;2.&#x21BA;1
```

**Render target** — surface-specific projection, glyphs substituted, not authoritative:
```
lar://telarus:operator@enyalios/threshold.uncertain.opens/ [S:0.65] ✶0-⏿0-◇3-▶2-↺1
```

Rules:
- Record form MUST be used for storage, crystal logs, registry, and all URI comparisons.
- Render targets MUST be normalized back to record form before comparison or storage.
- Record form MUST NOT carry emoji, Unicode glyphs, or non-ASCII characters outside the `ffz` hex-entity encoding.
- A render target that cannot be normalized back to record form MUST be treated as malformed.

<<~/ahu >>

<<~ ahu #well-formedness-gate >>

## Well-Formedness Gate

Minimum hygiene checks for any `lar:` URI:

1. **Scheme** — begins with exactly `lar:`
2. **Path class** — authority-less local form uses three slashes (`lar:///`); session form carries `alias:tier@host`; adjacent form carries no HA.KA.BA dot-notation
3. **HA.KA.BA slots** — stable and unstable paths carry exactly three dot-separated lowercase words; no hyphens, underscores, or spaces within a slot
4. **Stances** — five characters present in `?stances=`; each character ∈ {`^`, `-`, `?`, `.`}
5. **ffz** — five glyph+counter pairs present in `?ffz=`; no position omitted

A URI that fails any gate MUST NOT be stored or forwarded. Surface the specific failure.

<<~/ahu >>

<<~ ahu #stable-address >>

## Stable Address Derivation

Strip authority, query, and fragment. What remains is the stable named graph address.

```
lar://telarus:operator@enyalios/threshold.uncertain.opens/?stances=^.?.-.-.-&confidence=S:0.65&p=0.5&ffz=&#x2736;0.&#x23FF;0.&#x25C7;3.&#x25B6;2.&#x21BA;1#some-section

→ lar:///threshold.uncertain.opens/
```

The stable address does not change across sessions, machines, or participants.

**Comparison rule:** two URIs designate the same stable address iff their lowercased, stripped paths are byte-identical. Query and fragment are excluded from comparison.

<<~/ahu >>

<<~ ahu #authority-slot-law >>

## Authority Slot Law

Session-form authority carries exactly three sub-components:

```
alias:tier@host
```

| Sub-component | Meaning | Example |
|---|---|---|
| `alias` | Operational role or handle | `telarus`, `lar` |
| `tier` | Trust level | `operator`, `node`, `observer` |
| `host` | Crystal machine identity | `enyalios` |

Parse rule: split on `@` first (exactly one), then split left side on `:` (exactly one colon → two fields).

Phase MUST NOT encode in `alias`, `tier`, or `host`.
Phase encodes exclusively in `?ffz=`.
Span sequencing MUST NOT encode in authority — it lives in adjacent calibration metadata.

<<~/ahu >>

<<~ ahu #ffz-encoding >>

## FFZ Chronometer Encoding

<!-- TODO: UNFINISHED — needs deep research before promotion.
  Open questions tracked as F1–F5 in docs/pono/lar-uri/lar-uri.md §6.5 (canon doc).
  - F1: Hex entity form (&#x2736;) is valid in memetic-wikitext source but is NOT RFC 3986-safe in a raw query string. Percent-encode or carve exception for non-dereferenceable URIs?
  - F2: Counter semantics: loop iterations at that scale, or current phase depth?
  - F3: Multi-participant encoding: how does a two-party exchange vector encode both chronometers?
  - F4: Scale-to-OODA-HA exact binding rule not yet settled.
  - F5: Provisionality in ffz: can a chronometer position itself be provisional (e.g., &#x2736;~0)?
  Current encoding below is best available understanding, NOT canon. -->

The `?ffz=` parameter carries nested OODA-HA loop position across five scales per participant.

**Format:** five glyph+counter pairs, dot-separated:
```
?ffz=&#x2736;0.&#x23FF;0.&#x25C7;3.&#x25B6;2.&#x21BA;1
```

**Glyph table:**

| Phase | Glyph | Hex entity | When active |
|---|---|---|---|
| Observe | ✶ | `&#x2736;` | Reading, sensing incoming |
| Orient | ⏿ | `&#x23FF;` | Making sense, framing |
| Decide | ◇ | `&#x25C7;` | Choosing path forward |
| Act | ▶ | `&#x25B6;` | Executing — Hoʻoko gap lives here |
| Aftermath | ↺ | `&#x21BA;` | Closing, looping back to Observe |

Hoʻoko (⤴) is the execution gap within Act that surfaces into Aftermath. It is not a separate chronometer position.

**Rules:**
- All five positions MUST appear every time — no trailing-zero omission.
- The glyph names the phase currently active at that scale; the counter tracks loop iterations.
- `&#x2736;0` = Observe scale inactive (counter zero); `&#x25C7;3` = Decide scale, third iteration.
- Hex entity form (`&#x....;`) is the canonical encoding in memetic-wikitext source.

<<~/ahu >>

<<~ ahu #provisionality >>

## Provisionality Markers

The `~` prefix marks a path as execution-provisional — the coordinate declares a heading, not a confirmed landed resource.

| Form | Meaning |
|---|---|
| `lar:///~threshold.uncertain.opens/` | Reading-provisional: agent's interpretation of operator intent |
| `lar://lar:node@enyalios/~schema.flow.documented/` | Execution-provisional: node's declared heading before generation |
| `lar:///threshold.uncertain.opens/` | No tilde: coordinate confirmed, resource landed |

Provisional URIs MUST NOT be stored as stable addresses. They MAY appear in exchange stream headers and HUD lines as declared headings.

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
pono/lar-uri/SKILL closes
<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/lar-uri >>
<<~ loulou lar:///ha.ka.ba/docs/pono/lar-uri >>

<<~/ahu >>

<<~&#x0004; -> ? >>
