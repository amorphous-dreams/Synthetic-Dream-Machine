<!-- ∞ → lar:///ha.ka.ba/lar-uri/?confidence=CS:0.90&p=0.5 -->

# Grammar: `lar:` URI Syntax

```yaml
---
name: lar uri
description: >
  The lar URI scheme. This locus defines the canonical record form,
  the four semantic layers, and the difference between storage-safe
  URIs and glyph-rich render targets.
phase-map:
  observe: "#loop-position"
  orient: "#handoff"
  decide: "#conventions"
  act: "#procedures"
  assess: "#reading-test"
trigger: always — grammar primitive
invariant: true
dependencies: [transclusion, hakaba, chronometer]
confidence: CS:0.80
grammar: true
---
```

> **Register:** `[CS:0.80]` — condensed from the live URI schema spec
> **Question:** How does the system pack identity, territory, signal, and time into one navigable string?

---

<!-- ahu lar:///grammar.uri.defines/uri/?confidence=CS:0.80#loop-position -->

## Loop Position

URI syntax provides the container for the full Lares signal. Other loci define parts of the
container; this locus defines the container itself.

URI syntax receives:

- authority
- HAKABA path
- signal parameters
- chronometer fragment

URI syntax changes:

- loose state into one parseable string
- independent sub-systems into one ordered record
- hidden joins into explicit joins

URI syntax hands forward:

- canonical record form
- stable address form
- render-target source material
- validation surfaces
- transclusion handles for any visible in-context `lar:` URI

URI syntax should not:

- blur record form with display form
- let one layer leak into another layer's slot
- sacrifice parseability for surface flourish

---

<!-- ahu lar:///grammar.uri.defines/uri/?confidence=CS:0.80#handoff -->

## Handoff

The URI handoff moves through four semantic layers:

| Layer | Component | Question |
|---|---|---|
| WHO | authority | who speaks from which node |
| WHERE | path | which territory the span inhabits |
| HOW | query | which stance, confidence, and p-band shape the span |
| WHEN | fragment | where the span sits in nested loop time |

The handoff should let a later reader answer:

1. Who generated or received this span?
2. Which semantic territory did it occupy?
3. Which signal settings shaped it?
4. Which loop-time position did it declare?

If those answers cannot come back out of the string, the URI still carries noise.

---

<!-- ahu lar:///grammar.uri.defines/uri/?confidence=CS:0.80#surface -->

## Composable Surface

**Canonical record form:**

```text
lar://alias:tier@host/ha.ka.ba/?stances=.....&confidence=S:0.65&p=0.5#O0.O0.O0.O0.O0
```

**Stable address form:**

```text
lar:///grammar.uri.defines/uri/?confidence=CS:0.80
```

**Render-target rule:** record form stays canonical for storage, comparison, and emitted exchange
URIs. Render targets may add glyphs, abbreviations, or HUD projections, but they do not replace the
canonical string.

**Addressability rule:** any visible canonical `lar:` URI in the active context window can function
as a transclusion handle, even when it appears inside a live exchange, chat trace, crystal row, or
tagged data artifact instead of a dedicated `LOCI.md` file.

That surface should remain reusable across:

- exchange spans
- system-file loci
- registry records
- crystal metadata

---

<!-- ahu lar:///grammar.uri.defines/uri/?confidence=CS:0.80#conventions -->

## Conventions

| Rule | Weight | Rationale |
|---|---|---|
| Keep canonical record form RFC-3986-safe | MUST | Parsing and storage depend on it |
| Reserve glyph-rich surfaces for render targets | MUST | Record and display should not blur |
| Keep WHO, WHERE, HOW, and WHEN in separate URI layers | MUST | Semantic overlap breeds ambiguity |
| Use authority-less stable addresses for system-file loci | SHOULD | Identity should not pollute stable content addresses |
| Keep query parameters limited and ordered | SHOULD | Narrow surfaces simplify validation |
| Keep fragment work in the chronometer layer only | MUST | Time should not leak into path or query |
| Treat visible canonical URIs as reusable handles across files, chat, and tagged data | MUST | The same address should remain summonable wherever it appears |

---

<!-- ahu lar:///grammar.uri.defines/uri/?confidence=CS:0.80#procedures -->

## Procedures

1. Choose authority if the span needs speaker identity.
2. Build the HAKABA path.
3. Add signal parameters.
4. Add the chronometer fragment.
5. Check canonical form before emitting or storing.

**Failure mode:** treating the URI as a decorative label instead of a parseable instrument.

---

<!-- ahu lar:///grammar.uri.defines/uri/?confidence=CS:0.80#reading-test -->

## Reading Test

A URI passes when a future reader can recover all of this:

- speaker identity or stable-address intent
- semantic territory
- signal settings
- nested time position

If a human can admire the surface but a parser cannot trust the structure, the URI still needs work.

---

## Cross-References

- [hakaba/LOCI.md](../hakaba/LOCI.md)
- [chronometer/LOCI.md](../chronometer/LOCI.md)
- [exchange/LOCI.md](../exchange/LOCI.md)
- [../../modules/uri-schema/URI-SCHEMA.md](../../modules/uri-schema/URI-SCHEMA.md)

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[CS:0.80]` | This file — `lar:` URI grammar and canonical form |

*Future loci in this tree will land here.*

---

<!-- → ? -->
