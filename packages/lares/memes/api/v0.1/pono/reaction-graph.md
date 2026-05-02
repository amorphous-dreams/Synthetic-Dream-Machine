<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/reaction-graph >>
```toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/pono/reaction-graph"
file-path = "packages/lares/memes/api/v0.1/pono/reaction-graph.md"
type = "text/x-memetic-wikitext"
tagspace     = "invariant"
confidence   = 0.84
register     = "CS"
manaoio      = 0.82
mana         = 0.86
manao        = 0.84
role          = "invariant interface: in-memory reaction graph — subscribe, fire, load, UEFN dispatch semantics"
cacheable     = true
retain        = true
invariant     = true
source-file   = "packages/lararium-core/src/reaction-graph.ts"
source-symbol = "ReactionGraph RENDER_MODES REACTION_ROLES"
```



<<~ ahu #head >>

# Reaction Graph

Isomorphic in-memory reaction dispatch layer — runs on server and client.
Routes (fromUri, listenable) → (toUri, subscribable) bindings; wired and subscribed; UEFN dispatch semantics.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #ooda-ha >>

✶ read the incoming binding set — fromUri, listenable, toUri, subscribable, source (wired|subscribed)
⏿ orient dispatch mode: fireSync for view-layer; fire/fireAll for async; fireRace/fireRush reserved
◇ load() replaces full set; updateUri() updates one meme's bindings; occupied handler slots survive
▶ route fire call through (fromUri, listenable) → handlers; await or sync per mode
⤴ subscribeOnce bridges to kukali; subscribeByFn wires view-layer actions by name not source
↺ confirm handler slots occupied; kukali suspensions preserved across wiki-change reloads

<<~/ahu >>

<<~ ahu #law >>

## Law

The ReactionGraph is the live reaction dispatch layer.
It is isomorphic (no Node or browser APIs) and runs on both server and client.
It carries static bindings (declared in carrier pranala edges) and dynamic subscriptions (runtime).

A reaction binding is a (fromUri, listenable) → (toUri, subscribable) routing rule.
`fromUri` is the meme that fires. `listenable` is the event name (UEFN OUTPUT pin). `subscribable` is the handler label (UEFN INPUT pin).

The graph is the Tier 0 dispatch surface — all kumu event crossings route through it.

<<~/ahu >>


<<~ ahu #binding-shape >>

## Binding Shape

```toml
fromUri      = "lar:/// source meme URI"
toUri        = "lar:/// target meme URI"
listenable   = "event name (UEFN OUTPUT pin), or null for wildcard"
subscribable = "handler label (subscribeByFn key, UEFN INPUT pin), or null"
role         = "pranala edge role, or null"
source       = "wired | subscribed"
```

`wired` bindings are declared in carrier text as pranala edges with `family:reaction`.
`subscribed` bindings are established at runtime via `subscribe()`.

<<~/ahu >>

<<~ ahu #dispatch-modes >>

## Dispatch Modes

Four fire semantics — all run per (fromUri, trigger):

```
fire / fireAll   — hui: wait for all handlers to complete (async)
fireSync         — UEFN fidelity: synchronous tick dispatch, subscription order
fireRace         — heihei: first handler to settle wins; all continue
fireRush         — puka: first to resolve wins; others receive AbortSignal
```

`fireSync` is the default for view-layer reactions (navigation, zoom, relay).
`fire` / `fireAll` for async workflows (store operations, TW5 hydration).
`fireRace` / `fireRush` reserved for competitive dispatch (future: multi-realm routing).

<<~/ahu >>

<<~ ahu #subscription-api >>

## Subscription API

```
load(bindings)                        — replace full binding set; preserve handler slots
updateUri(uri, bindings)              — incremental update for one meme's bindings
removeUri(uri)                        — remove all bindings for a deleted meme
subscribe(fromUri, listenable, handler) → unsub   — per-(fromUri,listenable) handler
subscribeByFn(fnName, handler) → unsub             — handler for ALL bindings with subscribable=fnName
subscribeOnce(fromUri, listenable) → Promise + cancel()  — kukali bridge primitive
```

`subscribeByFn` is the preferred wiring point for view-layer actions.
Register once; automatically handles bindings that arrive after boot via `updateUri()`.
Equivalent to subscribing to a UEFN Relay device by name rather than by source.

`subscribeOnce` bridges to the `kukali` posture (Verse `suspends` analogue).
The returned Promise resolves when the listenable fires once; `cancel()` rejects it.

<<~/ahu >>

<<~ ahu #update-invariant >>

## Update Invariant

`load()` and `updateUri()` preserve occupied handler slots across binding rebuilds.
A handler registered via `subscribe()` or `subscribeOnce()` survives graph reloads
as long as the (fromUri, listenable) key still exists in the incoming binding set.
Unoccupied slots for removed bindings are dropped; occupied slots are kept.

This preserves in-flight kukali suspensions across TW5 wiki-change events.

<<~/ahu >>


<<~ ahu #schema >>

## Schema (machine-readable)

```toml
# Render modes — canonical values for PranalaEdge.renderMode
# Source: RENDER_MODES in packages/lararium-core/src/ast.ts
render-modes = ["papalohe"]
# papalohe: listenable label at source (OUTPUT pin), subscribable label at target (INPUT pin)

# Canonical roles for reaction family edges
# Source: REACTION_ROLES in packages/lararium-core/src/ast.ts
reaction-roles = ["listenable", "subscribable", "observes", "throttles", "debounces"]
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #implements-invariant ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/invariant family:control role:implements >>
<<~ pranala #tier0-dispatch ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/federated-causal-islands family:control role:implements >>
<<~ pranala #depends-pranala ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/pranala family:control role:depends >>
<<~ pranala #to-papalohe ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/papalohe family:dataflow role:reads >>
<<~ pranala #to-kukali ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/kukali family:dataflow role:reads >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
