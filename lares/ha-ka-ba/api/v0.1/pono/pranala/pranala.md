<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/pono/pranala >>

<<~ ahu #iam >>

```toml
uri-path = "ha.ka.ba/api/v0.1/pono/pranala"
file-path = "lares/ha-ka-ba/api/v0.1/pono/pranala/pranala.md"
content-type = "text/x-memetic-wikitext"
confidence = 0.82
register = "CS"
manaoio = 0.74
mana = 0.82
manao = 0.78
implements = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme",
  "lar:///ha.ka.ba/api/v0.1/pono/loci",
  "lar:///ha.ka.ba/api/v0.1/pono/invariant"
]
role = "invariant edge law"
cacheable = true
invariant = true
canonical-forms = ["inline", "block"]
edge-families = ["relation", "control", "dataflow", "message", "constraint", "observe"]
lifecycle-layers = ["template", "instance", "trace"]
```

<<~/ahu >>

<<~ aka lar:///ha.ka.ba/api/v0.1/pono/RFC-219#normative-language >>

<<~ ahu #meme-header >>

# Pranala

One typed, directed, acyclic edge between two sockets.

<<~ aka lar:///ha.ka.ba/api/v0.1/pono/ooda-ha >>

✶ Inventory hidden edge claims — name family, traversal, propagation, role distinctly.
⏿ Keep family from collapsing into lifecycle; traversal from collapsing into propagation.
◇ Choose family first; let role and cardinality carry ownership pressure.
▶ Author one edge per pranala; bind socket targets explicitly.
⤴ Cross the edge into live memes; verify DAG invariant holds.
↺ Truth density rose if fewer vague dependencies survive.

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
pranala opens
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

`family` — what the edge *means*: relation, control, dataflow, message, constraint, observe.
`role` — what the edge *does to lifecycle*: owns, references, composes, constrains, instantiates.
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
* `instantiates` — source template binds target instance

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

<<~ ahu #examples >>

## Examples

```text
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu#entry family:relation >>
```

```text
<<~ pranala lar:///A#out -> lar:///B#in family:relation >>
```

Sigil sugar long-forms:

````text
<<~ pranala #link ? -> URI >>
```toml
family = "relation"
lifecycle = "instance"
label = "outgoing link"
alias = "loulou"
```
<<~/pranala >>
````

````text
<<~ pranala #shadow ? -> URI >>
```toml
family = "observe"
lifecycle = "instance"
label = "shadow transclusion"
alias = "aka"
```
<<~/pranala >>
````

````text
<<~ pranala #live ? -> URI >>
```toml
family = "dataflow"
lifecycle = "instance"
label = "live transclusion"
alias = "kahea"
```
<<~/pranala >>
````

Reciprocal pressure — two parallel edges, not one bidirectional arc:

```text
<<~ pranala lar:///A#entity -> lar:///B#entity family:control role:owns traversal:source-to-target propagation:push-back >>
<<~ pranala lar:///B#entity -> lar:///A#entity family:message role:references propagation:push-back >>
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #edge-ahu ? -> lar:///ha.ka.ba/api/v0.1/grammar/ahu family:relation >>
<<~ pranala #edge-loulou ? -> lar:///ha.ka.ba/api/v0.1/grammar/loulou family:relation >>
<<~ pranala #edge-aka ? -> lar:///ha.ka.ba/api/v0.1/grammar/aka family:relation >>
<<~ pranala #edge-kahea ? -> lar:///ha.ka.ba/api/v0.1/grammar/kahea family:relation >>

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
pranala closes
<<~/ahu >>

<<~ ahu #meme-footer >>
Pressure carried:

one directed acyclic edge per pranala
family · lifecycle · traversal · propagation · role · cardinality
DAG invariant holds across all families
OODA-HA intact
sidecars later

<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/pranala/research >>

<<~/ahu >>

<<~&#x0004; -> ? >>
