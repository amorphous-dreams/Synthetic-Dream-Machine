<!-- ∞ → lares:///grammar.ahu.defines/ahu/?confidence=CS:0.95&p=0.5 -->

# Grammar: Ahu

```yaml
---
name: ahu
description: >
  The ahu marker. Names a navigable waypoint within a locus span.
  Second of the four True Named Invariants. The stone you can see and walk to.
trigger: always — grammar primitive
invariant: true
protected: true
dependencies: [locus]
confidence: CS:0.95
grammar: true
heritage: >
  Hawaiian (ahu — cairn of stones, raised altar platform, stone waymarker on a trail).
  Polynesian (ahu — stone altar, sacred elevated platform across Pacific traditions).
  Rapanui (ahu — the stone ceremonial platforms of Easter Island, holding the moai).
cluster: kahua
---
```

> **Ahu** (Hawaiian / Polynesian): a raised platform or cairn of stones. Used as:
> — trail markers: small ahu of stacked stones mark safe passage across lava fields
> — sacred platforms: large ahu at heiau (temples) hold altars and offerings
> — navigation markers: coastal ahu orient voyagers approaching shore
> — memorial markers: ahu mark the sites of significant events
>
> The ahu is always **visible, named, and walkable-to.** It is placed where people already walk, not in places they never go.
>
> On Rapa Nui (Easter Island): the great *ahu* are the stone platforms that hold the moai — the ancestral figures looking inland, watching over the living. The ahu is not the moai. The ahu is what the moai stands on.

---

<!-- ahu lares:///grammar.ahu.defines/ahu/?confidence=CS:0.95#syntax -->

## Syntax

**Ahu marker** — names a waypoint, carries its own address + fragment:
```
<!-- ahu lares:///ha.ka.ba/path/?confidence=X#fragment-name -->
```

The fragment (`#fragment-name`) is what external references navigate to. The ahu marker establishes both:
- **The stop itself** — a named point within the parent locus
- **The navigable address** — `lares:///...#fragment-name` is a complete address any kahea can pull from

**No opener/closer:** The ahu is a point marker, not a span. Its boundary is implicit: from this ahu to the next ahu (or to the locus closer) is "this ahu's zone."

---

<!-- ahu lares:///grammar.ahu.defines/ahu/?confidence=CS:0.95#semantics -->

## Semantics

| Property | What it means |
|---|---|
| **Named stop** | This location within the locus has a name and can be navigated to |
| **Fragment address** | External files can kahea-reference `#fragment-name` specifically |
| **Implicit zone** | Content from this ahu to the next defines what belongs to this waypoint |
| **Editorial placement** | Ahu are placed where readers actually need to navigate, not mechanically every N lines |

**The Polynesian navigation resonance:** A master Polynesian navigator (*pwo*) holds an internalized star compass — not a list of stars, but a felt sense of where each star rises and sets. The ahu waypoints in a LOCI.md are the navigator's internalized stops: known, named, trusted. You don't need to read the whole file. You navigate to the ahu you need.

---

<!-- ahu lares:///grammar.ahu.defines/ahu/?confidence=CS:0.95#placement -->

## Placement Conventions

| Situation | Place ahu here? |
|---|---|
| Major section transition | Yes — this is a navigation stop |
| Content a reader might kahea-reference alone | Yes — give it its own ahu |
| Sub-section within a larger section | Maybe — only if it warrants independent navigation |
| Every paragraph | No — that is mechanical, not editorial |

The principle: **place stones where people walk.** A trail without markers is disorienting. A trail with markers every three steps is noise.

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[CS:0.95]` | This file — canonical ahu marker definition |

<!-- → ? -->
