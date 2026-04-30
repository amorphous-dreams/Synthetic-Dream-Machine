<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/pono/reaction-graph >>

<<~ ahu #iam >>

```toml
uri-path     = "ha.ka.ba/api/v0.1/pono/reaction-graph"
file-path    = "lares/ha-ka-ba/api/v0.1/pono/reaction-graph.md"
content-type = "text/x-memetic-wikitext"
tagspace     = "invariant"
confidence   = 0.84
register     = "CS"
manaoio      = 0.82
mana         = 0.86
manao        = 0.84
role         = "invariant interface: in-memory reaction graph — subscribe, fire, load, UEFN dispatch semantics"
cacheable    = true
retain       = true
invariant    = true
```

<<~/ahu >>


<<~ ahu #law >>

## Law

The ReactionGraph is the live reaction dispatch layer.
It is isomorphic (no Node or browser APIs) and runs on both server and client.
It carries static bindings (declared in carrier pranala edges) and dynamic subscriptions (runtime).

A reaction binding is a (fromUri, trigger) → (toUri, fn) routing rule.
`fromUri` is the meme that fires. `trigger` is the event name. `fn` is the handler label.

The graph is the Tier 0 dispatch surface — all kumu event crossings route through it.

<<~/ahu >>

<<~&#x0002;>>


<<~ ahu #binding-shape >>

## Binding Shape

```toml
fromUri  = "lar:/// source meme URI"
toUri    = "lar:/// target meme URI"
trigger  = "event name, or null for wildcard"
fn       = "handler label (subscribeByFn key), or null"
role     = "pranala edge role, or null"
source   = "static | dynamic"
```

`static` bindings are declared in carrier text as pranala edges with `family:reaction`.
`dynamic` bindings are established at runtime via `subscribe()`.

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
load(bindings)              — replace full binding set; preserve handler slots
updateUri(uri, bindings)    — incremental update for one meme's bindings
removeUri(uri)              — remove all bindings for a deleted meme
subscribe(fromUri, trigger, handler) → unsub   — per-(fromUri,trigger) handler
subscribeByFn(fnName, handler) → unsub         — handler for ALL bindings with fn=fnName
subscribeOnce(fromUri, trigger) → Promise + cancel()  — kukali bridge primitive
```

`subscribeByFn` is the preferred wiring point for view-layer actions.
Register once; automatically handles bindings that arrive after boot via `updateUri()`.
Equivalent to subscribing to a UEFN Relay device by name rather than by source.

`subscribeOnce` bridges to the `kukali` posture (Verse `suspends` analogue).
The returned Promise resolves when the trigger fires once; `cancel()` rejects it.

<<~/ahu >>

<<~ ahu #update-invariant >>

## Update Invariant

`load()` and `updateUri()` preserve occupied handler slots across binding rebuilds.
A handler registered via `subscribe()` or `subscribeOnce()` survives graph reloads
as long as the (fromUri, trigger) key still exists in the incoming binding set.
Unoccupied slots for removed bindings are dropped; occupied slots are kept.

This preserves in-flight kukali suspensions across TW5 wiki-change events.

<<~/ahu >>


<<~ ahu #edges >>

<<~ pranala #implements-invariant ? -> lar:///ha.ka.ba/api/v0.1/pono/invariant family:control role:implements >>
<<~ pranala #tier0-dispatch ? -> lar:///ha.ka.ba/api/v0.1/pono/federated-causal-islands family:control role:implements >>
<<~ pranala #depends-pranala ? -> lar:///ha.ka.ba/api/v0.1/pono/pranala family:control role:depends >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
