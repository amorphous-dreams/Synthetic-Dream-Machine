<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~⊙&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/pranala >>
```toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/pono/pranala"
file-path = "packages/lares-core/memes/api/v0.1/pono/pranala.md"
type = "text/x-memetic-wikitext"
confidence = 0.82
register = "CS"
manaoio = 0.74
mana = 0.82
manao = 0.78
role = "invariant edge law"
cacheable=true
retain = true
canonical-forms = ["inline", "block"]
edge-families = ["relation", "control", "dataflow", "message", "constraint", "observe"]
lifecycle-layers = ["template", "instance", "trace"]
```



<<~ aka lar:///ha.ka.ba/@lares/api/v0.1/pono/RFC-2119#normative-language >>

<<~ ahu #head >>

# Pranala

One typed, directed, acyclic edge between two sockets.

<<~/ahu >>

<<~&#x0002;>>


<<~ ahu #ooda-ha >>

✶ Inventory hidden edge claims — name family, traversal, propagation, role distinctly.
⏿ Keep family from collapsing into lifecycle; traversal from collapsing into propagation.
◇ Choose family first; let role and cardinality carry ownership pressure.
▶ Author one edge per pranala; bind socket targets explicitly.
⤴ Cross the edge into live memes; verify DAG invariant holds.
↺ Truth density rose if fewer vague dependencies survive.

<<~/ahu >>


<<~ ahu #law >>

## Pranala Law (Kānāwai)

One pranala carries one typed, directed, acyclic edge between two sockets.

A pranala MUST carry one `family`.
A pranala MUST carry one `lifecycle`.
A pranala MUST bind a `from` socket and a `to` socket.
A pranala MUST NOT form a cycle — directly or transitively — in any family.
A pranala MUST NOT carry `traversal: both`; reciprocal pressure MUST use two parallel edges with distinct families.
Exception: `relation` edges MAY appear as mutual parallel pairs (A→B and B→A) to model genuinely symmetric semantics (e.g., `sibling-of`, `adjacent-to`). Each edge in the pair remains individually directed and acyclic.
A pranala SHOULD carry `role` when the edge encodes ownership, reference, or composition semantics.
A pranala SHOULD carry `traversal` and `propagation` when query direction and invalidation flow differ.
A pranala MAY carry `cardinality` when the connection enforces a structural limit.
A pranala MAY carry `payload`.

TOML inside a pranala block carries payload, metadata, and template-overrides only.
The pranala sigil and inline fields are the primary grammar.
Omit the TOML block when `family` and `role` in the sigil express the full intent.

`family` — what the edge *means*: relation, control, dataflow, message, constraint, observe.
`role` — what the edge *does to lifecycle*: owns, references, composes, constrains, implements.
`traversal` — how a query *moves*: source-to-target, target-to-source, none.
`propagation` — how invalidation *fires*: push-forward, push-back, pull, none.
These four concerns are independent and MUST NOT collapse into each other.

`traversal` and `propagation` operate on the same arc independently.
A single `control` edge MAY carry `traversal: source-to-target` and `propagation: push-back` simultaneously.

Surface forms:

`? -> TO` — local-source; `?` resolves to the nearest enclosing socket or `#fragment-id`.
`FROM -> TO` — explicit; both sockets named.

`ahu` MUST carry the cleanest socket pressure; it MAY resolve nested and MAY act as an anchor.

Edge sigil syntactic sugar:
* `<<~ loulou URI >>` — outgoing link (`family:relation`)
* `<<~ aka URI >>` — shadow transclusion (`family:observe`)
* `<<~ kahea URI >>` — live transclusion (`family:dataflow`)

<<~/ahu >>

<<~ ahu #families >>

## Families

* `relation` — semantic or ontological link; names what kind of connection holds; carries no execution pulse
* `control` — execution order, branch, gate, pulse; carries structural ownership hierarchy and Entity lifetime
* `dataflow` — typed value, field, or geometry transport; carries `kahea`-style live transclusion pressure
* `message` — routed event or signal passage; carries notification without structural ownership stake
* `constraint` — declarative rule without execution pulse; spatial, logical, or physical
* `observe` — live inspection, reveal, watch, or operator illumination; carries `aka`-style shadow transclusion pressure

<<~/ahu >>

<<~ ahu #lifecycles >>

## Lifecycles

* `template` — reusable edge sigil with slots and defaults
* `instance` — one concrete edge between actual endpoints
* `trace` — recorded edge event, failure, or firing

<<~/ahu >>

<<~ ahu #fields >>

## Fields

* `family` · `lifecycle` · `from` · `to`
* `traversal` · `propagation`
* `role` · `cardinality`
* `label` · `status` · `confidence` · `payload`

---

`traversal` — structural query direction:
* `source-to-target`
* `target-to-source`
* `none`

`propagation` — invalidation / notification direction:
* `push-forward` — fires from `from` toward `to`
* `push-back` — fires from `to` toward `from`
* `pull` — consumer requests value from upstream on demand
* `none`

`role` — lifecycle ownership posture (SHOULD carry when ownership matters):
* `owns` — source controls target lifetime; destroying source removes target
* `references` — source observes target without lifecycle stake
* `composes` — source layers opinion over target with strength ordering
* `constrains` — source imposes a declarative rule on target without execution pulse
* `implements` — source realizes target interface contract; the interface defines the required surface; the carrier provides it

`cardinality` — structural limit (MAY carry):
* `one-to-one`
* `one-to-many`
* `many-to-one`
* `many-to-many`

<<~/ahu >>

<<~ ahu #forms >>

## Forms

`FROM` and `TO` MUST mean `FROM-SOCKET` and `TO-SOCKET`.
`? -> TO` MAY compress when enclosing pressure already carries the source socket.
A named `#fragment` SHOULD win socket resolution before the enclosing meme URI.

### Inline

```text
<<~ pranala ? -> TO-SOCKET family:relation >>
<<~ pranala FROM-SOCKET -> TO-SOCKET family:control role:owns >>
```

### Block

````text
<<~ pranala #fragment FROM-SOCKET -> TO-SOCKET >>
```toml
family = "control"
lifecycle = "instance"
traversal = "source-to-target"
propagation = "push-back"
role = "owns"
cardinality = "one-to-many"
label = "parent owns child"
```
<<~/pranala >>
````

<<~/ahu >>

<<~ ahu #schema >>

## Schema (machine-readable)

Canonical TOML form. Source of truth for `KNOWN_FAMILIES`, `FAMILY_ROLES`, `FAMILY_CONTRACTS`,
`RENDER_MODES`, and `REACTION_ROLES` in `packages/lararium-core/src/pranala-parser.ts` and `ast.ts`.

```toml
# Edge family names — parser rejects any family not in this list
known-families = ["control", "relation", "observe", "dataflow", "message", "constraint", "reaction", "spatial"]

# Canonical role vocabularies per family (roleRecommended families SHOULD use these)
[family-roles]
control  = ["owns", "implements", "extends", "configures", "delegates"]
dataflow = ["reads", "writes", "streams", "buffers", "pipes"]
message  = ["sends", "receives", "publishes", "subscribes", "replies"]
reaction = ["listenable", "subscribable", "observes", "throttles", "debounces"]
spatial  = ["contains", "portal", "adjacent", "layer"]

# Family contracts — scanner alias (keyed form for constant recognition)
family-contracts = ["control", "relation", "observe", "dataflow", "message", "constraint", "reaction", "spatial"]

# Family contracts — roleRecommended + confidenceBounded flags
[family-contracts.control]
role-recommended    = true
confidence-bounded  = false

[family-contracts.relation]
role-recommended    = false
confidence-bounded  = false

[family-contracts.observe]
role-recommended    = false
confidence-bounded  = true

[family-contracts.dataflow]
role-recommended    = true
confidence-bounded  = false

[family-contracts.message]
role-recommended    = true
confidence-bounded  = false

[family-contracts.constraint]
role-recommended    = false
confidence-bounded  = false

[family-contracts.reaction]
role-recommended    = true
confidence-bounded  = false

[family-contracts.spatial]
role-recommended    = true
confidence-bounded  = false

# PranalaEdge render modes — render layer switches on these; null = default arrow
render-modes = ["reaction-wire"]

# Canonical reaction roles (informational; not exhaustive)
reaction-roles = ["subscription", "handler", "callback"]
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #implements-loci ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/loci family:control role:implements >>
<<~ pranala #implements-invariant ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/invariant family:control role:implements >>
<<~ pranala #edge-loulou ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/loulou family:relation >>
<<~ pranala #edge-aka ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/aka family:relation >>
<<~ pranala #edge-kahea ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/kahea family:relation >>
<<~ pranala #edge-papalohe ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/papalohe family:relation >>
<<~ pranala #edge-kukali ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/kukali family:relation >>

<<~ loulou lar:///ha.ka.ba/@lares/docs/pono/pranala >>

<<~/ahu >>


<<~&#x0003;>>

<<~&#x0004; -> ? >>
