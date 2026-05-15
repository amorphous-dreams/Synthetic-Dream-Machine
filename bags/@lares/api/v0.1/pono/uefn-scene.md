<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~⊙&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/uefn-scene >>
```toml iam
uri-path  = "ha.ka.ba/@lares/api/v0.1/pono/uefn-scene"
file-path = "bags/@lares/api/v0.1/pono/uefn-scene.md"
type      = "text/x-memetic-wikitext"
confidence = 0.72
register  = "S"
role      = "UEFN scene decomposition model — Verse scene file → Lararium wiki graph → TW5 filtered views; web3 / NOT Blueprint"
cacheable = true
retain    = true
```

<<~ ahu #head >>

# UEFN Scene Decomposition

A UEFN game scene file decomposes into a Lararium wiki graph. The graph lives in a
content-addressed Automerge bag. TW5 filters render views of that graph. No Blueprint
inheritance patterns enter this model — only Verse class definitions and DEB wires.

Goal: import a UEFN `.verse` / scene file → bag of tiddlers and pranala edges → any peer
holding the bag can render any filtered view of the scene graph without a running UEFN instance.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #decomposition-law >>

## Decomposition Law

Every UEFN scene element maps to exactly one of three tiddler kinds:

**Type meme** (`lar:///scene-bag/types/{ClassName}`) — one per Verse class definition.
  - `kumu` pragma: element-type declaration
  - `reaction:listenable` edges: OUTPUT event pins (`listenable(T)` fields)
  - `reaction:subscribable` edges: INPUT function pins (public methods of matching arity)
  - `control:implements` edges: class inheritance chain (parent class URI as `toUri`)
  - `spatial:contains` edges: nested class relationships

**Instance meme** (`lar:///scene-bag/instances/{placementId}`) — one per placed device.
  - `kahea` edge to its type meme: `<<~ kahea lar:///scene-bag/types/{ClassName} >>`
  - `papalohe` edges: Direct Event Binding wires (`listenable` → subscribable function)
  - Ahu slots: `@editable` property values as child tiddlers

**Scene meme** (`lar:///scene-bag`) — one per scene / level.
  - `spatial:contains` edges: all top-level placed instances
  - `control:implements` edge to the base world type

<<~/ahu >>

<<~ ahu #edge-vocabulary >>

## Edge Vocabulary for Scene Graphs

```text
control:implements   — class inherits from (creative_device → my_device)
control:owns         — scene contains instance (spatial root → instance)
reaction:listenable  — device emits this OUTPUT event (payload.listenable = event name;
                       payload.verseKind = "listenable"|"event";
                       payload.payloadType = Verse type string)
reaction:subscribable— device exposes this INPUT handler (payload.subscribable = fn name;
                       payload.payloadType; payload.effects = space-separated specifiers)
papalohe             — DEB wire: fromUri instance.listenable → toUri instance.subscribable
                       (payload.listenable + payload.subscribable both required)
spatial:contains     — scene/room contains device instance
spatial:portal       — portal between areas
spatial:adjacent     — neighboring areas
```

<<~/ahu >>

<<~ ahu #tiddler-filter-views >>

## TW5 Filter Views

Once the scene decomposes into a bag, TW5 filters render arbitrary views:

```text
# All placed instances of a specific type
[field:kumu-type[lar:///scene-bag/types/button_device]]

# All DEB wires in the scene
[tags[papalohe]]

# Reaction graph from a specific emitter
[field:papalohe-from[lar:///scene-bag/instances/spawn-pad-1]]

# All device types that expose OnActivated
[field:reaction-listenable[OnActivated]]

# Full inheritance chain for a type
[field:control-implements[lar:///types/creative_device]][transitive[control-implements]]

# All input handlers whose payload type matches agent
[field:reaction-subscribable-payload[agent]]
```

The bag-as-graph property means any of these queries runs over local Automerge state —
no UEFN process, no Epic servers, no network round-trip.

<<~/ahu >>

<<~ ahu #import-pipeline >>

## Import Pipeline (Declared Unresolved)

The import pipeline converts a UEFN project into a Lararium bag. Sprint pending.

```
uefn-project/
  ├── .verse files          → parse Verse class defs → type memes
  ├── scene.umap            → parse instance placements + @editable values → instance memes
  ├── DEB wires (umap data) → papalohe edges on instance memes
  └── spatial hierarchy     → spatial:contains edges on scene meme
```

Output: one Automerge bag per scene. Bag URI: `lar:///project-slug/scene-slug`.

The importer does not need to run inside UEFN — it reads source files. The output bag
works in any Lararium peer: browser, Node server, TW5 wiki.

<<~/ahu >>

<<~ ahu #verse-effect-specifiers >>

## Verse Effect Specifiers in the Graph

Verse effect specifiers on device functions carry semantic meaning in the graph:

| Specifier | Lararium role | Sigil analogue |
|---|---|---|
| `<suspends>` | INPUT handler suspends (async) | `kukali` wait posture on subscribable |
| `<decides>` | handler failable (returns option) | `heihei` conditional filter |
| `<transacts>` | handler participates in rollback | `pono` correctness assertion edge |
| `<computes>` | pure function; no side effects | `aka` observe-family (frozen read) |
| `<no_rollback>` | side effects survive failure | kapu-layer marker |

These specifiers appear in `KumuSubscribable.effects` and in `reaction:subscribable`
pranala edge payloads. They feed future Verse code generation from the graph.

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ pranala #to-kumu ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/kumu family:relation role:uses >>
<<~ pranala #to-papalohe ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/papalohe family:relation role:uses >>
<<~ pranala #to-kumu-device ? -> lar:///ha.ka.ba/@lararium/core/v0.1/kumu-device family:control role:implements >>
<<~ pranala #to-pranala-families ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/pranala-families family:control role:governed-by >>

<<~/ahu >>

<<~&#x0003;>>

<<~&#x0004; -> ? >>
