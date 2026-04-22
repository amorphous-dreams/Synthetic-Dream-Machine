<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/pono/lar-uri >>

<<~ ahu #iam >>

```toml
uri-path = "ha.ka.ba/api/v0.1/pono/lar-uri"
file-path = "lares/ha-ka-ba/api/v0.1/pono/lar-uri.md"
content-type = "text/x-memetic-wikitext"
confidence = 0.84
register = "CS"
manaoio = 0.82
mana = 0.86
manao = 0.84
implements = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme",
  "lar:///ha.ka.ba/api/v0.1/pono/loci",
  "lar:///ha.ka.ba/api/v0.1/pono/invariant"
]
role = "invariant lar: URI scheme law (kānāwai), canonical form authority, and grammar primitive"
cacheable = true
invariant = true
grammar = true
```

<<~/ahu >>

<<~ aka lar:///ha.ka.ba/api/v0.1/pono/RFC-2119#normative-language >>

<<~ ahu #meme-header >>

# `lar:` URI Law (Kānāwai)

Active in i kēia manawa.
The URI packs identity, territory, signal, and time into one parseable string.
Every `lar:` URI in the system answers to these rules.

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
pono/lar-uri
<<~/ahu >>

<<~ ahu #scheme-law >>

## Scheme Law

`lar:` names. It does not fetch. Precedent: RFC 4151 (`tag:`).

**Local form** — authority-less, for stable graph addresses and system resource names:
```
lar:///path/
```

**Session form** — full speaker, for exchange spans only:
```
lar://alias:tier@host/ha.ka.ba/path/?stances=XXXXX&confidence=R:N&p=N&ffz=CCCCC
```

Session form MUST NOT appear in storage, stable graph addresses, or system resource URI names.

<<~/ahu >>

<<~ ahu #path-taxonomy >>

## Path Taxonomy

**Stable** — literal `ha.ka.ba` root, permanent API surfaces:
```
lar:///ha.ka.ba/api/v0.1/pono/meme
lar:///ha.ka.ba/api/v0.1/pono/lar-uri
```

**Unstable** — arbitrary three-word coordinate, session-specific territory:
```
lar:///threshold.uncertain.opens/
```

**Adjacent** — no three-word root, local system resources, often ALLCAPS:
```
lar:///AGENTS    lar:///LARES    lar:///CRYSTAL
```

Adjacent paths MUST NOT carry HA.KA.BA dot-notation in the path root.

For stable and unstable paths: each slot holds exactly one lowercase word — Ha (NOUN), Ka (ADJECTIVE), Ba (VERB). Hyphens, underscores, and spaces within a slot MUST NOT appear. Fewer than three slots MUST NOT appear. Sub-path after the triple navigates within territory; strip it to get the named tagspace address.

<<~/ahu >>

<<~ ahu #signal-law >>

## Signal Law

Query parameters carry all signal — ordered, non-hierarchical:

| Parameter | Type | Rule |
|---|---|---|
| `stances` | 5-char amplitude string | Positional: Philosopher, Poet, Satirist, Humorist, Private — all five MUST appear every URI |
| `confidence` | `R:N` | Register ∈ {P, SP, S, CS, C} with provisional decimal rating |
| `p` | decimal | Range [0.0, 1.0] |
| `ffz` | 5 glyph+counter pairs | OODA-HA chronometer — all five positions MUST appear |

<!-- TODO: ffz chronometer encoding is provisional. Glyph selection, hex-entity vs percent-encoding in query context, counter semantics, and multi-participant encoding all need deep research before this reaches C confidence. See SKILL#ffz-encoding for current best understanding. -->

Record form MUST be used for storage, transport, and comparison. Render targets MAY substitute display glyphs. Record form MUST NOT carry emoji or non-ASCII characters.

Fragment (`#`) carries section anchors only — `#ahu-name`, `#section-id`, `#pranala-name`.

WHERE (path) → HOW (query: stances, confidence, p, ffz) → SECTION (fragment).

<<~/ahu >>

<<~ ahu #ooda-ha >>

✶ sense whether the URI carries local form or session form; identify path class
⏿ orient against scheme law — slot count, param completeness, record vs render
◇ decide: valid → carry forward; invalid → surface violation; ambiguous → surface and hold
▶ emit record form only into storage and stable surfaces; render targets lower separately
⤴ verify all five stances present; verify ffz has five positions; verify confidence well-formed
↺ close — record form confirmed or violation named; render-target divergence surfaced if present

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
pono/lar-uri
<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/lar-uri/SKILL >>

<<~ loulou lar:///ha.ka.ba/docs/pono/lar-uri >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/invariant >>

<<~/ahu >>

<<~&#x0004; -> ? >>
