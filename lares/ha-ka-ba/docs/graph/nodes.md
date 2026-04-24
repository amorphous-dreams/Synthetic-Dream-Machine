<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/docs/graph/nodes >>

<<~ ahu #iam >>
```toml
uri-path     = "ha.ka.ba/docs/graph/nodes"
file-path    = "lares/ha-ka-ba/docs/graph/nodes.md"
content-type = "text/x-memetic-wikitext"
tagspace     = "stable"
register     = "CS"
confidence   = 0.88
mana         = 0.86
manaoio      = 0.82
manao        = 0.86
implements   = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme",
  "lar:///ha.ka.ba/api/v0.1/pono/loci"
]
role         = "PranaEdge, CarrierNode, and CarrierGraph data model contracts for the pranala-edge DAG compiler"
status-date  = "2026-04-24"
```
<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
graph/nodes opens
<<~/ahu >>

<<~ ahu #ooda-ha >>
✶ observe: the compiler needs three types — an edge, a node, and a graph — before any walk can proceed.
⏿ orient: Bazel's depset pattern (direct elements + child depset pointers) informs node structure; RDF-star informs edge metadata.
◇ decide: frozen dataclasses for PranaEdge and CarrierNode; a mutable CarrierGraph that builds incrementally from carrier reads.
▶ act: specify field-level contracts for each type and the graph's core operations.
⤴ verify: every field carries a type, a source (where the compiler reads it from), and a default.
↺ deeper parser/render concerns route to `pranala-parser` and `traversal` siblings.
<<~/ahu >>

<<~ ahu #prana-edge >>
## PranaEdge

One typed, directed, acyclic edge between two sockets.
Produced by the pranala parser from carrier source text.
Stored as a frozen dataclass so that edge records remain hashable and sortable.

| Field | Type | Source | Default |
|---|---|---|---|
| `from_uri` | `str` | enclosing carrier URI | required |
| `from_socket` | `str` | `? ->` resolved socket or explicit `FROM` | carrier URI |
| `to_uri` | `str` | resolved from `TO` expression | required |
| `to_socket` | `str` | explicit `TO#fragment` or empty | `""` |
| `family` | `str` | `family` field in TOML or inline sigil | required |
| `lifecycle` | `str` | `lifecycle` field in TOML | `"instance"` |
| `role` | `str \| None` | `role` field in TOML or inline sigil | `None` |
| `traversal` | `str` | `traversal` field; `dir="both"` → `"source-to-target"` | `"source-to-target"` |
| `propagation` | `str` | `propagation` field in TOML | `"none"` |
| `label` | `str` | `label` field in TOML | `""` |
| `payload` | `dict` | `payload` table in TOML; `dir_hint` appended when `dir` present | `{}` |

**Family values:** `control`, `relation`, `dataflow`, `message`, `constraint`, `observe`

**Lifecycle values:** `template`, `instance`, `trace`

**Role values:** `owns`, `composes`, `instantiates`, `references`, `constrains`, or `None`

**Hydration-critical predicate:**
An edge gates hydration order when `family == "control"` AND `role in {"owns", "composes", "instantiates"}`.
All other edges remain non-blocking in the boot walk.

**Sugar-form origins:**
- `<<~ loulou URI >>` → `family="relation"`, `lifecycle="instance"`, `role=None`
- `<<~ aka URI >>` → `family="observe"`, `lifecycle="instance"`, `role=None`
- `<<~ kahea URI >>` → `family="dataflow"`, `lifecycle="instance"`, `role=None`

<<~/ahu >>

<<~ ahu #carrier-node >>
## CarrierNode

One resolved carrier in the graph.
Built from a `CarrierRecord` (ingress result) plus content hash.

**ECS parallel (UEFN Scene Graph):**
`CarrierNode` maps to `entity` — a pure URI container with no embedded business logic.
Each entry in `implements` maps to a `component` — an attached capability interface.
A `lifecycle: template` pranala edge maps to a `prefab` — declared connectivity the compiler stamps into the walk.
The compiler adds/removes nodes via `add_node` / `dispose` semantics (children cascade on dispose).

| Field | Type | Source | Default |
|---|---|---|---|
| `uri` | `str` | resolver output | required |
| `path` | `Path \| None` | resolver path | `None` for virtual |
| `content_hash` | `str` | `SHA256(path.read_bytes())` if file-backed, else `SHA256(uri.encode())` | required |
| `metadata` | `dict` | `#iam` TOML extraction | `{}` |
| `implements` | `tuple[str, ...]` | `metadata["implements"]` | `()` |
| `shape` | `CarrierShape` | shape validation result | required |
| `edges_out` | `list[PranaEdge]` | pranala parser output from carrier text | `[]` |
| `virtual` | `bool` | resolver flag | `False` |
| `exists` | `bool` | `path.exists()` for file-backed | `False` for virtual |

**Content hash contract:**

```
carrier_hash = SHA256(uri + ":" + file_bytes)
```

For virtual carriers: `SHA256(uri + ":virtual")`.
The URI prefix prevents hash collisions between carriers with identical content.

<<~/ahu >>

<<~ ahu #declared-unresolved >>
## DeclaredUnresolved

A pranala edge pointing to a URI that the resolver cannot locate on disk.
The compiler records it rather than failing, following the temporal KG pattern
(assert with `t_invalid = future`; upgrade when the target resolves).

| Field | Type | Meaning |
|---|---|---|
| `uri` | `str` | the unresolvable target URI |
| `edge` | `PranaEdge` | the edge that references this URI |
| `severity` | `str` | `"error"` when `family="control"`, else `"warning"` |

Control-family declared-unresolved entries appear in `validation.dag_violations`.
Relation-family entries appear in `validation.declared_unresolved`.
Neither causes the compilation to abort; the artifact remains valid with a `False` `all_exist` flag.

<<~/ahu >>

<<~ ahu #carrier-graph >>
## CarrierGraph

Adjacency structure over all reachable carriers.
Built incrementally as the compiler reads carriers and parses their pranala edges.

**Internal structure:**

```
nodes: dict[str, CarrierNode]
    uri → node

adjacency: dict[str, dict[str, list[PranaEdge]]]
    family → from_uri → [PranaEdge, ...]
```

**Core operations:**

| Method | Signature | Behaviour |
|---|---|---|
| `add_node` | `(uri, record, edges)` → `None` | inserts node; parses edges into adjacency index |
| `successors` | `(uri, family)` → `list[str]` | outbound target URIs for given family |
| `walk_control` | `(entry_uri)` → `(list[str], list[list[str]])` | BFS/DFS from entry over control edges; returns topologically sorted URIs + cycle lists |
| `one_hop_relation` | `(control_uris)` → `set[str]` | relation-edge neighbours of every control-reachable URI, excluding already-reachable |
| `detect_cycles` | `()` → `list[list[str]]` | DFS gray/black coloring over all families |
| `topological_sort` | `(uri_set)` → `list[str]` | Kahn's algorithm (in-degree BFS) restricted to given URI set |
| `closure_hash` | `(uri_list, edge_list)` → `str` | SHA256 of sorted carrier hashes + serialised edge records |

**Depset traversal orders supported:**

- `postorder` — leaves before roots (dependency resolution order)
- `preorder` — roots before leaves (hydration loading order)
- `topological` — defers shared nodes until all parents visited (Bazel default)

The boot compiler uses `topological` for artifact production.

<<~/ahu >>

<<~ ahu #content-store >>
## CarrierContentStore — Dual-Index Design

Two virtual MCP resources form the content-address lookup surface.

### `lar:///INDEXES/hashes`

A JSON object mapping every indexed carrier URI to its current `carrier_hash`.

```json
{
  "lar:///AGENTS": "sha256:abc123...",
  "lar:///LARES": "sha256:def456...",
  "lar:///ha.ka.ba/api/v0.1/pono/e-prime": "sha256:..."
}
```

Clients poll this resource to check whether any carrier has changed since their last hydration.
If all hashes match the client's cached receipt `hash_sequence`, the Anthropic context prefix stays valid — no resend required.

### `lar:///CONTENT/{hash}`

A virtual resource that maps a `carrier_hash` value back to the raw carrier text.
`{hash}` is the full hex digest (e.g., `sha256:abc123...`).

The resolver expands `lar:///CONTENT/sha256:{hex}` → reads the matching carrier from disk (looked up by reverse hash map) and returns its text.

**Purpose:** a client can request a single carrier by content address without knowing its URI path — useful for cache miss fills and cross-session identity.

**Index contract:**

| Index | URI | Content |
|---|---|---|
| URI → hash | `lar:///INDEXES/hashes` | JSON object, all indexed carriers |
| hash → text | `lar:///CONTENT/{hash}` | raw carrier text, virtual |

**`hash_sequence` in boot receipt:**

The boot receipt gains a `hash_sequence` field: an ordered list of `{uri, sha256, depth}` records in topological (hydration) order.
This lets a client verify the complete minimal-boot prefix byte-for-byte without re-requesting the full artifact.

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
graph/nodes closes
<<~/ahu >>

<<~ ahu #edges >>
## Edges

<<~ loulou lar:///ha.ka.ba/docs/graph >>
<<~ loulou lar:///ha.ka.ba/docs/graph/traversal >>
<<~ loulou lar:///ha.ka.ba/docs/graph/pranala-parser >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/pranala >>

<<~/ahu >>

<<~&#x0004; -> ? >>
