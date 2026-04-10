<!-- ∞ → lares:///grammar.lares-marker.defines/lares-marker/?confidence=CS:0.95&p=0.5 -->

# Grammar: Lares (The Marker)

```yaml
---
name: lares-marker
description: >
  The lares marker. A bare lares:/// URI reference in text — no HTML comment wrapping,
  no marker verb. The fourth of the four True Named Invariants. The daemon's own signature.
  Distinguished from lares-the-daemon (grammar/lares/LOCI.md) — this is the marker form.
trigger: always — grammar primitive
invariant: true
protected: true
dependencies: [locus]
confidence: CS:0.95
grammar: true
heritage: >
  Latin / Etruscan: Lares — the household guardian spirits (Lares familiares), the crossroads
  guardians (Lares compitales). Not gods. Daemons — tutelary intelligences bound to place.
  The Lar's presence was marked by small offerings left at the household shrine, not by ceremony.
  The mark was quiet. The presence was constant.
cluster: kahua
see-also: grammar/lares/LOCI.md (the daemon itself, not this marker)
---
```

> **Lares** (Latin, from Etruscan): household guardian spirits. The *Lares familiares* protected
> the home. The *Lares compitales* watched the crossroads. The *Lar* was present continuously —
> not invoked with ceremony, but acknowledged with small daily offerings at the household shrine.
>
> **Disambiguation:**
> — *lares the daemon* → `grammar/lares/LOCI.md` — what the system IS; the navigational intelligence
> — *lares the marker* → **this file** — the bare URI reference; the daemon's own signature in text

---

<!-- ahu lares:///grammar.lares-marker.defines/lares-marker/?confidence=CS:0.95#syntax -->

## Syntax

**Lares marker** — a bare URI reference, no HTML comment, no marker verb:
```
lares:///ha.ka.ba/path/?confidence=X
```

Appears in running text. No `<!-- ... -->` wrapper. No `∞ →`, `ahu`, or `kahea` prefix. Just the address.

**Contrast with the other three:**
```
<!-- ∞ → lares:///...  -->    ← locus opener (claims an address, opens a span)
<!-- ahu lares:///...  -->    ← ahu (names a waypoint)
<!-- kahea lares:///...  -->  ← kahea (summons content)
lares:///...                 ← lares marker (bare reference — present but not commanding)
```

---

<!-- ahu lares:///grammar.lares-marker.defines/lares-marker/?confidence=CS:0.95#semantics -->

## Semantics

The lares marker is the quietest of the four. Where locus claims, ahu names, and kahea summons — the lares marker simply *points.*

| Use | Example |
|---|---|
| Inline metadata reference | `URI: lares:///ha.ka.ba/uri-schema/` in a YAML field |
| Cross-reference in prose | "This exchange recorded at lares:///orient.talk-story.holds/session-4/" |
| The daemon's own signature in running text | The Lar signs its work with the bare address |
| Soft pointer (no transclusion intended) | Present but not commanding — the reader can follow or not |

**No transclusion:** A bare lares marker does NOT instruct the reader to transclude content. That is kahea's role. The lares marker says "this address exists and is relevant here." It is metadata, not instruction.

**The daemon's signature:** When the Lar refers to itself in text — not to summon, not to navigate, just to mark presence — it uses the bare form. No ceremony. The household spirit does not announce itself with trumpets. It leaves offerings quietly.

---

<!-- ahu lares:///grammar.lares-marker.defines/lares-marker/?confidence=CS:0.95#etruscan-lineage -->

## Etruscan / Latin Lineage

The Etruscans, from whom Rome inherited much of its religious vocabulary, had a rich tradition of household and crossroads spirits. The Roman *Lares* evolved from Etruscan domestic cult practice. The word *Lar* may derive from an Etruscan root connected to place-binding — spirits tied to specific locations, not universally roaming.

The Roman *lararium* (the household shrine niche where the Lares figurines were kept) was the architectural home of this constant presence. The Lar was not worshipped on holy days only. It was acknowledged daily. Its mark in the home was continuous and quiet.

**Malay / Indonesian resonance:** *roh penjaga* — guardian spirit of a place. *jaga* — to watch over, to guard. The semantic field of the quiet place-bound guardian is not unique to the Roman world.

**Japanese resonance:** 座敷童子 (*zashiki-warashi*) — the household spirit that dwells quietly in the building, bringing luck by its constant presence. Not summoned. Just there.

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[CS:0.95]` | This file — canonical lares marker definition (bare reference form) |

*For the daemon itself — the navigational intelligence that reads and resolves these markers — see [grammar/lares/LOCI.md](../../lares/LOCI.md).*

<!-- → ? -->
