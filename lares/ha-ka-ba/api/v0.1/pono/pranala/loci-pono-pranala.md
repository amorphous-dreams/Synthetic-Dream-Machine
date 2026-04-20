<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/pono/pranala >>

<<~ ahu #iam >>

```toml
uri-path = "ha.ka.ba/api/v0.1/pono/pranala"
file-path = "lares/ha-ka-ba/api/v0.1/pono/pranala/loci-pono-pranala.md"
content-type = "text/x-memetic-wikitext"
manaoio = 0.68
confidence = 0.72
mana = 0.72
manao = 0.72
implements = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme",
  "lar:///ha.ka.ba/api/v0.1/pono/loci"
]
register = "CS"
role = "invariant edge law"
canonical-forms = ["inline", "block", "payload-block"]
edge-families = ["relation", "control", "dataflow", "message", "constraint", "debug"]
lifecycle-layers = ["template", "instance", "trace"]
```

<<~/ahu >>

<<~ aka lar:///ha.ka.ba/api/v0.1/pono/RFC-219#normative-language >>

# Pranala

Edge pressure, not explanation.

✶ Inventory hidden edge claims — name family, traversal, propagation, role distinctly.
⏿ Keep family from collapsing into lifecycle; keep traversal from collapsing into propagation.
◇ Choose family first; let role and cardinality carry ownership pressure.
▶ Author one edge per pranala; bind socket targets explicitly.
⤴ Cross the edge into live memes; verify DAG invariant holds.
↺ Truth density rose if fewer vague dependencies survive.

<<~&#x0002; ahu #meme-body-open >>
pranala opens
<<~/ahu >>

<<~ ahu #law >>

## Pranala Law (Kānāwai)

One pranala carries one edge.

A pranala MUST carry one primary `family`.
A pranala MUST carry one `lifecycle`.
A pranala MUST connect sockets.
A pranala MUST NOT collapse into vague dependency.
A pranala SHOULD carry `#fragment` when fragment pressure helps.
A pranala SHOULD carry `role` when lifecycle ownership matters.
A pranala MAY carry `cardinality` when structural limits must hold.
A pranala MAY carry `payload`.

Canonical local-source form:

`? -> TO`

Lawful explicit form:

`FROM -> TO`

`? -> TO` SHOULD resolve `?` to the nearest enclosing socket.
A named enclosing `#fragment-id` SHOULD win first.
Otherwise `?` SHOULD land on the enclosing meme URI.

Valid socket targets:

* `lar://[HOST?]/...`
* `lar://[HOST?]/...#fragment`

Named `ahu` worksites SHOULD carry socket pressure first.
Any wrapping sigil, including the whole meme, MAY expose a default socket.

Fragment pressure SHOULD stay term-aligned across sigils as `#fragment`.
Human-readable text MAY still travel in `label`.

Hawaiian short-invocation surfaces MUST carry pranala pressure.

Socket: `ahu` MUST carry the cleanest socket pressure. Ahu MAY resolve in a nested structure. Ahu MAY serve as an html style `anchor` entity.

Edge sigil syntactic sugar:
* `<<~ loulou URI >>` MAY represent an HTML style outgoing link
* `<<~ aka URI >>` MAY represent a "shadow" transclusion — invoking the image/text context
* `<<~ kahea URI >>` MAY represent a "live" transclusion — invoking the widget/rendered context

Family carries edge meaning.
Lifecycle carries `template`, `instance`, or `trace` pressure.

Family MUST NOT collapse into lifecycle.
Lifecycle MUST NOT collapse into status.
Traversal MUST NOT collapse into propagation.

<<~/ahu >>

<<~ ahu #dag-invariant >>

## DAG Invariant

Structural families MUST NOT form cycles.

A pranala in `control`, `dataflow`, or `constraint` family MUST point from source to target without returning, directly or transitively, to the source.

`traversal: both` is not a legal value.
Reciprocal pressure SHOULD use two parallel edges with distinct families.

Example: a parent-owns-child `control` edge forward plus a child-notifies-parent `message` edge back — two edges, not one bidirectional edge.

High-performance scene graph engines (OpenUSD, OpenExec, Maya parallel eval, UEFN) enforce this invariant. Cycles break transform propagation, invalidation scheduling, and parallel evaluation.

<<~/ahu >>

<<~ ahu #families >>

## Families

* `relation` — semantic or ontological link; says what kind of connection holds
* `control` — execution order, branch, gate, pulse; carries structural ownership hierarchy
* `dataflow` — typed value, field, or geometry-like transport
* `message` — event or routed message passage
* `constraint` — declarative rule without execution pulse; spatial or logical
* `debug` — observation, reveal, watch, or operator illumination

<<~/ahu >>

<<~ ahu #lifecycles >>

## Lifecycles

* `template` — reusable edge sigil with slots and defaults
* `instance` — one concrete edge between actual endpoints
* `trace` — recorded edge event, failure, or firing

<<~/ahu >>

<<~ ahu #fields >>

## Fields

Shared fields:

* `family`
* `lifecycle`
* `from`
* `to`
* `traversal`
* `propagation`
* `role`
* `cardinality`
* `label`
* `status`
* `confidence`
* `payload`

Canonical `traversal` values:

* `source-to-target` — structural query or render moves from `from` toward `to`
* `target-to-source` — structural query moves from `to` toward `from`
* `none` — direction adds no structural gain

Canonical `propagation` values:

* `push-forward` — invalidation or notification pushes from `from` toward `to`
* `push-back` — invalidation or notification pushes from `to` toward `from` (dirty propagation)
* `pull` — consumer requests value from upstream on demand
* `none` — no propagation pressure

`traversal` and `propagation` are independent. A forward-traversal edge MAY carry push-back propagation (e.g., transform hierarchy reads top-down; dirty flags push bottom-up).

Canonical `role` values (SHOULD carry when lifecycle ownership matters):

* `owns` — source controls target lifecycle; destruction propagates
* `references` — source observes target without structural dependency
* `composes` — source layers opinion over target (composition arc posture)
* `constrains` — source imposes declarative rule on target
* `instantiates` — source template binds target instance

Canonical `cardinality` values (MAY carry when structural limits must hold):

* `one-to-one`
* `one-to-many`
* `many-to-one`
* `many-to-many`

<<~/ahu >>

<<~ ahu #forms >>

## Forms

Socket pressure:

* `FROM` and `TO` in surface form MUST mean `FROM-SOCKET` and `TO-SOCKET`
* `? -> TO` MAY compress `FROM-SOCKET -> TO-SOCKET` when current enclosing pressure already carries the source socket
* named `ahu` targets SHOULD carry socket pressure first
* any sigil with a clear URI fragment `#fragment` MAY serve as a socket
* a whole meme addressed by `lar:///...` MAY carry default socket pressure when no narrower socket appears

### Inline

```text
<<~ pranala ? -> TO-SOCKET family:relation >>
<<~ pranala FROM-SOCKET -> TO-SOCKET family:relation >>
```

Inline form SHOULD carry quick-edge pressure.

### Block

Block form SHOULD carry richer local edge data.

````text
<<~ pranala #fragment ? -> TO-SOCKET >>
```toml
family = "control"
lifecycle = "instance"
traversal = "source-to-target"
propagation = "push-back"
role = "owns"
label = "human readable"
```
<<~/pranala >>
````

````text
<<~ pranala #fragment FROM-SOCKET -> TO-SOCKET >>
```toml
family = "control"
lifecycle = "instance"
traversal = "source-to-target"
label = "human readable"
```
<<~/pranala >>
````

Block form MUST carry richer local edge data as a TOML payload.

<<~/ahu >>

<<~ ahu #examples >>

## Examples

```text
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu#entry family:relation >>
```

Long-form equivalents for edge sigil sugar:

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
family = "debug"
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

Ownership edge (parent controls child lifecycle):

````text
<<~ pranala #scene-parent lar:///A#entity -> lar:///B#entity >>
```toml
family = "control"
lifecycle = "instance"
traversal = "source-to-target"
propagation = "push-back"
role = "owns"
cardinality = "one-to-many"
label = "owns"
```
<<~/pranala >>
````

Reciprocal pressure using parallel edges (not `traversal: both`):

```text
<<~ pranala lar:///A#entity -> lar:///B#entity family:control role:owns traversal:source-to-target >>
<<~ pranala lar:///B#entity -> lar:///A#entity family:message role:references propagation:push-back >>
```

```text
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/pono/parser#forms family:relation label:"forms" >>
```

```text
<<~ pranala lar:///A#out -> lar:///B#in family:relation >>
```

<<~/ahu >>

<<~ ahu #research-foundation >>

## Research Foundation

* [OpenUSD LIVERPS strength ordering](https://docs.nvidia.com/learn-openusd/latest/creating-composition-arcs/strength-ordering/what-is-liverps.html) — composition arcs as role-typed edges; `role:composes` lineage
* [OpenUSD Glossary](https://openusd.org/release/glossary.html) — Attributes vs Relationships; ownership via UsdStage
* [OpenExec System Design](https://openusd.org/dev/api/page__execution__system__design.html) — DAG computation network; traversal vs invalidation as distinct edge pressures
* [Introduction to OpenExec](https://openusd.org/release/intro_to_openexec.html) — push invalidation and pull evaluation on the same structural edge; `propagation` field lineage
* [Using Parallel Maya 2026](https://damassets.autodesk.net/content/dam/autodesk/www/html/using-parallel-maya/2026/UsingParallelMaya.pdf) — push dirty propagation vs pull evaluation; forward scheduling model
* [UEFN Scene Graph](https://www.fortnite.com/news/scene-graph-is-now-available-as-an-experimental-feature-in-unreal-editor-for-fortnite) — entity owns children; one component per type; `role:owns`, `cardinality` lineage
* [LearnOpenGL Scene Graph](https://learnopengl.com/Guest-Articles/2021/Scene/Scene-Graph) — transform hierarchy as strict DAG; cycle prohibition
* [Graphviz `dir`](https://graphviz.org/docs/attrs/dir/) — prior source of `dir` field; render metadata only; replaced by `traversal`

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

<<~&#x0004; -> ? >>
