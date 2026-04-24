<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/docs/graph >>

<<~ ahu #iam >>
```toml
uri-path     = "ha.ka.ba/docs/graph"
file-path    = "lares/ha-ka-ba/docs/graph.md"
content-type = "text/x-memetic-wikitext"
tagspace     = "stable"
register     = "CS"
confidence   = 0.88
mana         = 0.86
manaoio      = 0.82
manao        = 0.86
implements   = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme",
  "lar:///ha.ka.ba/api/v0.1/pono/loci",
  "lar:///ha.ka.ba/api/v0.1/pono/invariant"
]
role         = "spine for the pranala-edge DAG graph redesign — research synthesis, committed decisions, child locus map"
research-sources = [
  "Bazel depsets and Skyframe (Google 2024)",
  "Buck2 architecture (Meta 2024)",
  "Nix derivations and lazy evaluation",
  "Graphiti temporal knowledge graph (Zep 2025, arXiv:2501.13956)",
  "TerminusDB append-only delta model",
  "UEFN Scene Graph ECS model (entity/component/prefab, Fortnite dev 2025)",
  "Anthropic context engineering (2025)",
  "Context7 / Upstash (2025)"
]
status-date  = "2026-04-24"
```
<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
graph opens
<<~/ahu >>

<<~ ahu #ooda-ha >>
✶ observe: static `_SOCKET`/`_DEPTH` maps and carrier-index scans stand in for a real graph walk.
⏿ orient: build-system depsets, temporal KG bi-temporal edges, and UEFN ECS plane separation each name the same missing structure.
◇ decide: three-tier traversal model, content-addressed artifacts, pranala parser over actual carrier text.
▶ act: write child loci for node schema, traversal rules, parser design, and artifact contract.
⤴ verify: Tier 0 declared-core and Tier 1 graph walk converge on the same 14 loci before proceeding.
↺ surface one open question — `? ->` socket resolution depth — before implementing the parser.
<<~/ahu >>

<<~ ahu #core-proposition >>
## Core Proposition

The pranala-edge DAG replaces static enumeration as the source of truth for boot closure.

Three structural claims drive the redesign:

1. **Build-system pattern.** Bazel and Buck2 separate the dependency graph (targets), the action graph (operations), and the evaluation graph (state). Lararium needs the same separation: a carrier graph (loci + typed edges), a compilation graph (operations over carriers), and an artifact graph (content-addressed outputs). Conflating them into one flat list produces the current stub.

2. **Temporal KG pattern.** Graphiti's bi-temporal four-timestamp model and TerminusDB's append-only delta encoding show that declared-unresolved forward references belong in the graph as valid entries, not as errors. A boot walk discovers them and classifies them by severity rather than failing.

3. **ECS plane pattern.** UEFN's Scene Graph separates `entity` (pure container, no data), `component` (attached capability, owns data and logic), and `prefab` (reusable template, stamps instances). Lararium maps exactly: `CarrierNode` is the entity (URI + path, no business logic), the `implements` bundle is the component list (each interface URI is an attached capability), and `lifecycle: template` pranala edges are prefabs (declared intent that the compiler stamps into the walk). Pranala families form separate graph planes, each traversed by its own rules. Collapsing them into one walk loses the plane distinctions.

4. **Dual-index content addressing.** TiddlyWiki maintains multiple parallel indexes over the same tiddler corpus. `lar:///INDEXES/hashes` (URI → SHA256 map, lightweight poll) and `lar:///CONTENT/{hash}` (hash → carrier text, virtual resource) implement the same pattern. The boot receipt's `sha256` field becomes a stable Anthropic prompt cache key: a client that holds a matching receipt need not resend carrier text.

<<~/ahu >>

<<~ ahu #decisions >>
## Committed Design Decisions

The following decisions closed during the OODA-HA planning session on 2026-04-24.
They do not require further operator input.

| Decision | Rationale |
|---|---|
| `lifecycle: template` edges count as traversable | Templates declare intended connectivity. The static compiler walks declared intent; the `template/instance/trace` distinction matters for execution runtime, not hydration compilation. Bazel BUILD declarations drive the build graph before any runtime runs. |
| `dir = "both"` maps to `traversal: source-to-target` | "Both" means both carriers declare awareness of the edge — not that the walker traverses both directions. The walker goes source → target. `dir` becomes metadata recorded in `PranaEdge.payload` as `dir_hint`. |
| `payload.continue/backlink` records as metadata, not walk directives | The static compiler produces loci sets and ordered lists; it does not execute coroutines. `payload.continue` annotates where the calling carrier expects to resume — recorded in edge payload for the boot receipt, honored by a future execution-graph compiler. |
| Tier 0 declared-core stays as fast-path validation | `#iam.required-core` gives a pre-computed "what should appear in minimal boot" check. The pranala walk produces the source-of-truth set; the declared list cross-validates it. Mismatches surface in the receipt as a `declared_vs_walked` diffset. |
| Content-addressed artifacts via SHA256(carrier bytes + edge records) | Deterministic ordering of carrier bytes plus sorted edge records produces a stable hash. This makes boot receipts valid Anthropic prompt cache keys: identical source files always produce identical receipt hashes. |
| Declared-unresolved forward refs stay in the graph | `family: control` unresolved targets surface as `dag_violations` (boot-critical errors). `family: relation` unresolved targets surface as `declared_unresolved` warnings. Neither causes compilation to fail. |

<<~/ahu >>

<<~ ahu #open-question >>
## Open Question — `? ->` Socket Resolution Depth

One design question remains open before the pranala parser can implement `? ->` resolution.

In AGENTS.md each pranala block appears inside a named `ahu` block:

```
<<~ ahu #required-preload-e-prime >>
  <<~ pranala #preload-e-prime ? -> lar:///ha.ka.ba/api/v0.1/pono/e-prime >>
  ...
  <<~/pranala >>
<<~/ahu >>
```

The `?` in `? -> TARGET` resolves to "the nearest enclosing socket or `#fragment-id`."

**Option A — Fragment-level resolution:**
`? ->` resolves to `lar:///AGENTS#required-preload-e-prime` (the enclosing `ahu` socket).
Produces richer edge records with specific socket-level provenance.
Matches how the hydration sockets table documents the boot sequence.
Requires the parser to track enclosing `ahu` fragment context during scan.

**Option B — Carrier-level resolution:**
`? ->` resolves to `lar:///AGENTS` (the carrier URI).
Simpler implementation; from-socket becomes the carrier root.
Loses sub-carrier socket granularity in edge records.

**Operator gate:** the parser implementation in `graph/pranala-parser` awaits this call.
All other child loci in this graph cluster may land without it.

<<~/ahu >>

<<~ ahu #child-loci >>
## Child Loci

| Locus | Role |
|---|---|
| `lar:///ha.ka.ba/docs/graph/nodes` | `PranaEdge`, `CarrierNode`, and `CarrierGraph` data model contracts |
| `lar:///ha.ka.ba/docs/graph/traversal` | three-tier walk rules, DFS cycle detection, Kahn topological sort, declared-unresolved handling |
| `lar:///ha.ka.ba/docs/graph/pranala-parser` | block form, inline form, sugar expansion, `? ->` resolution, field normalization |
| `lar:///ha.ka.ba/docs/graph/artifacts` | content-addressed SHA256 scheme, three artifact classes, compaction rules |

<<~/ahu >>

<<~ ahu #implementation-phases >>
## Implementation Phases

| Phase | New file | Key deliverable |
|---|---|---|
| 1 | `lares/lararium_mcp/graph.py` | `PranaEdge`, `CarrierNode`, `CarrierGraph` with BFS/DFS/topo-sort |
| 1 | `lares/lararium_mcp/tests/test_graph.py` | synthetic graph fixtures, cycle detection, topo sort tests |
| 2 | `lares/lararium_mcp/pranala_parser.py` | block + inline + sugar parser, field normalization |
| 2 | `lares/lararium_mcp/tests/test_pranala_parser.py` | AGENTS.md block fixtures, `? ->` resolution |
| 3 | `lares/lararium_mcp/compiler.py` (rewrite) | Tier 0/1/2 walk, live `pranala_edges`, `interface_index`, content hash |
| 3 | updated `test_compiler.py` | `test_tier0_tier1_convergence`, `test_full_boot_has_edges`, `test_receipt_deterministic` |
| 4 | `lares/ha-ka-ba/docs/graph/**` | this carrier cluster (plan → loci) |

Phase 2 awaits the `? ->` resolution call.
Phases 1, 3, and 4 may proceed independently.

<<~/ahu >>

<<~ ahu #validation-markers >>
## Validation Markers

| Marker | Test or check |
|---|---|
| Cycle detection fires on a synthetic cycle | `test_graph.py::test_cycle_detection` |
| Topological sort places parents before children | `test_graph.py::test_topological_sort` |
| Parser extracts family/role from AGENTS.md pranala blocks | `test_pranala_parser.py::test_agents_blocks` |
| `? ->` resolves correctly per chosen option | `test_pranala_parser.py::test_question_mark_resolution` |
| Tier 0 and Tier 1 agree on AGENTS minimal boot (14 loci) | `test_compiler.py::test_tier0_tier1_convergence` |
| `compile_full_boot` returns non-empty `pranala_edges` | `test_compiler.py::test_full_boot_has_edges` |
| Boot receipt hash matches across repeated compilations | `test_compiler.py::test_receipt_deterministic` |
| Declared-unresolved relation edge does not fail compilation | `test_compiler.py::test_forward_ref_survives` |

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
graph closes
<<~/ahu >>

<<~ ahu #edges >>
## Edges

<<~ loulou lar:///ha.ka.ba/docs/graph/nodes >>
<<~ loulou lar:///ha.ka.ba/docs/graph/traversal >>
<<~ loulou lar:///ha.ka.ba/docs/graph/pranala-parser >>
<<~ loulou lar:///ha.ka.ba/docs/graph/artifacts >>
<<~ loulou lar:///ha.ka.ba/docs/lararium_mcp/hydration >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/pranala >>

<<~/ahu >>

<<~&#x0004; -> ? >>
