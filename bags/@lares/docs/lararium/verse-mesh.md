<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/@lares/docs/lararium/verse-mesh >>
```toml iam
uri-path    = "ha.ka.ba/@lares/docs/lararium/verse-mesh"
file-path   = "bags/@lares/docs/lararium/verse-mesh.md"
type        = "text/vnd.tiddlywiki"
register    = "DS"
confidence  = 0.91
mana        = 0.90
manao       = 0.88
manaoio     = 0.86
role        = "design narrative for the Verse polychronous CRDT mesh — peer model, VM pool, camera model, accumulator wiring"
cacheable   = true
retain      = true
docs        = "lar:///ha.ka.ba/@lares/docs/lararium/verse-mesh"
```

# Verse Mesh — Design Narrative

## What a Peer Owns

A lararium peer owns **bags** (Automerge documents), not wikis.
A wiki is a **recipe** — an ordered composition of bags.
The peer assembles a wiki on demand by stacking bags in priority order.
The same CRDT source bags yield different rendered views for different operators
and different application surfaces.

The invariant: bags persist, wikis compose.

## N Local Clocks — Polychronous CRDT Mesh

The Verse mesh runs **N local clocks**, one per TW5 VM instance.
Each VM constitutes one clock domain (Signal/INRIA polychronous model, Berry 1991).
Rendezvous between clock domains happens **only at CRDT merge boundaries** —
when Automerge delivers a remote patch, the IslandAccumulator gates it to the
next local frame boundary.

No global conductor exists.
No peer commands another peer's tick rate.
Each peer runs at its own rAF cadence (browser) or setInterval cadence (Node/mobile).
The CRDT carries state across the water in causal order.
The accumulator releases it to TW5 one frame at a time.

## VM Pool — Recipe Slots

Each peer holds a `VmPool<TW5RecipeVm>` with named slots:

```
Peer
 ├── BagResidencyManager          ← hot / warm / cold oracle per bag
 ├── AutomergeDocStore[bag]       ← one per bag (always, including cold)
 │    └── IslandAccumulator[bag]  ← one per hot/warm bag
 │
 └── VmPool<TW5RecipeVm>
      ├── slot[live]              ← one active VM; rAF-driven; paints the UX
      │    ├── TW5Engine
      │    ├── IslandAdaptor      ← inbound buffer + outbound writes
      │    └── IslandAccumulator  ← one per bag in recipe, draining on rAF tick
      │
      ├── slot[warm-A]            ← booted, accumulating, not painting
      └── slot[warm-B]            ← same
```

One slot holds `live` status at a time.
All other slots stay `warm` — they receive CRDT patches through their own
IslandAccumulator chains but do not emit paint frames.
On slot promotion (e.g. recipe switch), the new live slot already holds current state.
No full replay needed on switch.

Node peers hold **no live slot by default**.
All slots stay warm.
The node peer renders on demand by promoting a warm slot briefly (SSR path),
capturing the render output, then returning to warm.

## Camera Model — Story River Is the First Camera

The TW5 Story River serves as the **first camera** — the primary rendered view
into the Verse graph for browser peers.
It does not occupy the only camera slot.

The **second camera slot** targets TLDraw.js or another JavaScript infinite canvas.
That canvas renders a different projection of the same bag state —
spatial, relational, or visual-graph views of the same Automerge documents.

Further camera slots remain open for:
- Mobile native views (React Native / Capacitor)
- Household / community / civil / interplanetary lararium implementations
- Headless render targets (PDF export, MCP tool surface, LLM context projection)
- Spectator/witness views with different read authority

Each camera registers its own projection against the IslandAccumulator chain.
Each runs at its own tick rate.
Each sees the same causal-ordered CRDT state, rendered through its own lens.

## Visibility Gate — The Scale Boundary

The IslandAccumulator drains patches for all queued tiddlers by default.
At document scale (5 000+ tiddlers), a full drain per frame blows the 16ms budget.

The visibility gate defers this:
only flush patches for tiddlers the **active story river currently renders**.
Background bags (cold layers not in the active recipe view) accumulate indefinitely
and flush on the next explicit navigation event.

This gate does not apply in early alpha.
It names the correct scale boundary before the project reaches it.

## Wiring Law — One IslandAccumulator per Bag per VM Slot

```
store.addProjection(adaptor);        // IslandAdaptor: pre-sync buffer + non-CRDT
store.addProjection(accumulator);    // IslandAccumulator: post-sync crdt-remote

// browser:
tw5.startRenderLoop(adaptor, accumulators, budget)

// node:
setInterval(() => adaptor.flushAll(accumulators, budget), 16)
```

`accumulators` is ordered by recipe bag priority (core → canon → wiki → user → session).
`flushAll` drains in priority order, stops when `budget` patches consumed,
carries remainder to the next tick.

## Tick Sources by Platform

| Platform        | Tick source              | Live slots | Warm slots |
|-----------------|--------------------------|------------|------------|
| Browser         | `requestAnimationFrame`  | 1          | N          |
| Node            | `setInterval(16ms)`      | 0 (SSR on demand) | N   |
| Mobile          | `setInterval` (power-scaled) | 1     | N          |
| Civil / interplanetary | `setInterval` (infra-scaled) | 0 | N    |

The accumulator interface stays identical across all platforms.
The tick source changes; the drain contract does not.

<<~&#x0002;>>

<<~&#x0004; -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/island-adaptor >>
<<~&#x0004; -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/island-accumulator >>
<<~&#x0004; -> lar:///ha.ka.ba/@lares/docs/lararium/meme-provider >>
<<~&#x0004; -> lar:///ha.ka.ba/@lares/docs/lararium/signal >>
