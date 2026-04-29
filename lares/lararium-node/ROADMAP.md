<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///LARARIUM-NODE/ROADMAP >>

<<~ ahu #iam >>
```toml
uri-path = "LARARIUM-NODE/ROADMAP"
file-path = "lares/lararium-node/ROADMAP.md"
content-type = "text/x-memetic-wikitext"
confidence = 0.88
register = "S"
manaoio = 0.82
mana = 0.88
manao = 0.86
role = "docs meme — migration roadmap and milestone log for Lararium Node; 280/280 tests green; @lararium/tw5 package extracted from core (zero circular dep); LarariumOpenPhase + projection-cache ChangeOrigin in @lararium/core; lararium-browser-host.ts async generator + useLarariumHostOpen hook live; LarariumCtxValue expanded (openPhase/tiddlerStore/tw5/renderMode/hostReceipt); blocking spinner removed from LarariumCanvas; MemeDetailPanel ?renderMode=tw5 branch (store-first, projection-cache fallback, tw5.renderText); kumu-react-render.tsx renamed to native-render.tsx; app build clean (tiddlywiki externalization warnings non-fatal); M9 remaining: browser smoke (P2 — tactile verification), canon-promotion (P4), wiki-recipe carriers (P5); open pressure: TW5 enters bundle unconditionally (defer code-split to Q2 recipe-config phase)"
cacheable = false
retain = true
invariant = false
```
<<~/ahu >>

# Lararium Node — Roadmap

This docs meme preserves the full research-roadmap detail for migrating Lararium MCP to Lararium Node.
It adds explicit ahu markers around the major research sections so the file can act as a navigable docs meme rather than a compressed summary.

<<~&#x0002; ahu #meme-body-open >>
LARARIUM-NODE/ROADMAP opens
<<~/ahu >>

<<~ ahu #ooda-ha >>
✶ inventory the Python MCP surface, branch-local graph/compiler work, launcher configs, tests, and architecture docs before porting
⏿ orient migration around an isomorphic TypeScript kernel plus adapters, not a monolithic MCP rewrite
◇ choose parity-first migration: preserve names, URIs, read-only behavior, and graph/compiler semantics before improving internals
▶ port resolver, carrier, indexes, pranala parser, MemeGraph, compiler, MCP resources/tools/prompts, then browser/projection surfaces
⤴ verify with golden fixtures, branch parser/graph tests, protocol smoke tests, hash determinism, and no-write gates
↺ keep residue visible: MCP SDK churn, protocol-version drift, FFZ semantics, hostful session resolution, write-back gates, and missing formal lararium-node spec
<<~/ahu >>

<<~ ahu #executive-summary >>

# Migrating Lararium MCP to Lararium Node

## Executive summary

The repository currently contains a working, read-only Python MCP server under `lares/lararium_mcp` with a local stdio JSON-RPC transport, explicit MCP resources/tools/prompts, and deliberately light runtime dependencies. The entrypoint is `python -m lares.lararium_mcp`, and local client configs in `.mcp.json`, `.vscode/mcp.json`, and `.codex/config.toml` all launch it that way. The package metadata still targets Python `>=3.8`, with `setuptools` as the build backend and only `pytest` / `pytest-cov` as declared dev extras; there are no declared third-party runtime dependencies for the core package itself.     

The most important migration conclusion is architectural rather than translational: do **not** replace `lararium_mcp` with a monolithic TypeScript MCP server. Build `lararium-node` as the Node host/runtime around an isomorphic `lararium-core`, then keep MCP as an adapter package. That matches your stated constraints better, isolates the MCP SDK’s version churn, and cleanly supports both file-backed server mode and single-bundle browser mode without letting Node/browser APIs leak into core. The repository’s own design docs already point in that direction: the current MCP server is framed as a bootstrap spine, TiddlyWiki Filter Language is explicitly bounded as a guest grammar rather than the constitutional runtime, render projection is defined as a layer *after* execution, and Kowloon / tldraw are adapter targets rather than core semantics.    

There is also an important repo-state nuance: the Python package on the branch you highlighted already contains a more mature graph/compiler direction than a simple “resolver port.” It adds `pranala_parser.py`, `meme_graph.py`, revised `compiler.py`, and dedicated tests for parser/graph invariants. That means the real parity target is **not only** the default-branch stdio server; it is the union of the user-visible MCP surface plus the branch’s newer graph-parsing semantics. If you migrate only what is on the current default branch, you will institutionalize stale compiler behavior and immediately create design debt.      

For the MCP adapter specifically, the safest near-term choice is to treat the official TypeScript SDK as a moving boundary and pin to the stable generation that fits your delivery horizon. The official SDK docs still show the current production package shape around `@modelcontextprotocol/sdk` with `McpServer`, stdio transport, resources/tools/prompts, and Streamable HTTP support, while the official SDK repository also states that its `main` branch is a v2 line still labeled pre-alpha and that v1.x remains the recommended production line until v2 fully settles. That is exactly why the MCP-facing code should live in `packages/lararium-mcp`, not in `lararium-core` or even `lararium-node`. 

My recommendation is therefore: preserve all current Lararium URIs, resource names, tool names, prompt names, and read-only behavior; port resolver/carrier/index/compiler logic into `lararium-core`; add Node-only file-system adapters, watchers, and CLI/bootstrap in `lararium-node`; add a thin MCP transport/reporting layer in `lararium-mcp`; and defer write-back, full TiddlyWiki runtime embedding, and direct tldraw/Kowloon mutation until after parity, golden fixtures, and rollout hardening are complete.

### Lararium Context Integration

This roadmap now treats the following as active migration context rather than appendix material:

- `meme` is the Lararium ontology term; TiddlyWiki remains a reference system, not the vocabulary source.
- The branch-local DAG walker exists and should be ported rather than redesigned.
- Hostless `lar:///...` URIs denote stable canonical meme addresses.
- Hostful `lar://alias:tier@host/...` URIs denote live exchange records.
- Live exchange records may inform interpretation and propose changes, but must not silently override invariant memes.
- The green-jello-dinosaur bug names the Live-Session Overwrite failure mode.
<<~/ahu >>

<<~ ahu #early-research-addendum >>

## Early Research Addendum — Details to Preserve

This addendum restores early research pressures that should remain visible in `lar:///LARARIUM-NODE/ROADMAP`.

### Carrier Graph, Not Python Service

Lararium already reads as a carrier graph, not merely a Python MCP service. The migration target should preserve canonical URI identity, typed carrier metadata, explicit graph edges, fragment-anchor continuity, deterministic hydration order, and the distinction between invariant API surfaces and supporting docs shelves.

The TypeScript runtime should treat `AGENTS`, `LARES`, and `ha-ka-ba/api/v0.1/**` memes as load-bearing semantic artifacts, not as static documentation adjacent to code.

### Signal and Render Layer as Projection Blueprint

The existing signal/render layer already suggests projection architecture:

- canonical record-form `lar:` vectors
- HUD lines
- micro-trace
- render targets
- shared-situation-awareness framing

This implies `lararium-core` should produce canonical records and projection-ready data, while adapter packages render those into HUD exchange pairs, chat-log post headers, tiddler headers, print margins, trace views, tldraw records, or Kowloon/DreamDeck feed payloads.

### TiddlyWiki Patterns: Copy Shape, Not Runtime

Useful TiddlyWiki precedents:

- microkernel that loads higher layers
- universal content unit
- plugin/bundle projection pattern
- Node folder storage
- single-file browser distribution
- parse tree → render projection pipeline

Avoid:

- DOM widget tree as canonical execution model
- TiddlyWiki runtime as carrier-law dependency
- editable executable JS as first-class content primitive
- shadow-tiddler override semantics as mutation model

Lararium’s equivalent should remain:

meme → parsed carrier → AST / graph → compiler artifact → projection

### Browser Host and Bundle Path

`lararium-web` should load either:

- an embedded JSON bundle of memes/carriers
- an exported compiled snapshot
- a single distributable browser artifact

The browser runtime should hydrate the same indexes and graph artifacts as Node. It should not import `lararium-node` or MCP packages.

### Record Scope Model

Core record design should support:

document scope  = canonical memes, anchors, edges, indexes, boot receipts, projections  
session scope   = active root URI, selected anchor, HUD state, focus/camera-like transient state  
presence scope  = future cursors, observer overlays, collaborative selections  

### Projection Interfaces

`lararium-core` should expose generic projection interfaces before target-specific packages harden.

Minimum projection targets:

- record:full
- hud:exchange-pair
- chat-log:post-header
- tiddler:header
- print:margin
- trace
- tldraw
- kowloon

Projection packages must not define core ontology.

### Kowloon Integration Model

Lararium's live service is **elyncia.app** — a lararium node with Kowloon federation. The canvas and the social graph are the same thing. The Kowloon read-only posture was a bootstrap scaffold; the design direction is bidirectional.

**Canvas actions that ARE Kowloon activities:**
- Drawing a follow edge between two actor nodes → Follow activity (`family:relation role:follows`)
- Adding a node to a circle (drag into circle shape) → Circle.updateOne
- Publishing a meme from the canvas → Post activity (`to: @public | circle:<id> | group:<id>`)
- Creating a room → Group creation with 5 system circles

**Minimum viable Kowloon payload** (still valid for bootstrap):
- `type`, `actor`, `object`, `published`
- `lar_uri`, `source_uri`, `sha256` / receipt hash when available

**Posture going forward:** `lararium-kowloon` begins as a read + publish adapter. Write-back (circle membership, follow graph) follows after the canvas social graph visualization milestone. Stay agnostic about implementation order — the model is aligned, the build sequence is OODA-HA.

### Golden Fixtures Over Semantics

Parity should test semantics, not merely API responses.

Fixture targets:

- URI resolution
- carrier metadata
- anchors
- parsed blocks
- parsed edges
- index contents
- boot receipts
- signal/render outputs
- projection snapshots

### Parser Span Tests

Parser tests should include byte offsets or span identity wherever possible.

### Sevenfold Test Matrix

1. Golden fixtures from Python.
2. Property tests for URI normalization and fragment resolution.
3. Parser span tests for byte offsets and anchor identity.
4. Boot receipt stability tests.
5. MCP smoke tests for stdio list/read/invoke/get-prompt.
6. Browser hydration tests comparing Node-built bundles to browser reconstruction.
7. Projection snapshot tests.

### Node Development Runner Note

Prefer `tsx` plus `tsc --noEmit`. Do not rely on partial runtime type stripping as correctness layer.

### False Parity Risk

False Parity = TypeScript MCP server works, but carrier semantics drift.

### Host Leakage Risk

Host Leakage = fs/window/process/document enters lararium-core.

### Projection Overreach Risk

Projection Overreach = projection layers define core ontology.

### Do-Not-Do-Yet Expansion

Do not:

- build HTTP transport first
- promote glyph/render experiments prematurely
- assume Kowloon belongs in core
- let projection packages define the semantic model
- ship write-back before policy and tests
- treat MCP success as semantic parity

<<~/ahu >>

<<~ ahu #scope-assumptions >>

## Scope and explicit assumptions

This report prioritizes the GitHub connector evidence from `amorphous-dreams/Synthetic-Dream-Machine` and then uses primary/official web documentation for MCP, TiddlyWiki, and tldraw. I also treated the graph/compiler branch you identified as materially relevant because it contains concrete code and tests that expand the migration target.   

The following assumptions are explicit, because several of them materially affect the recommendation. You have full repo access. The target runtime and deployment environment are unspecified. The target host may remain local-only initially. Lararium names and URI contracts should be preserved unless there is a formal breaking-change memo. `lararium-core` must stay isomorphic and therefore must not import `fs`, `path`, `process`, `window`, or `document`. TiddlyWiki should be used as precedent and fixture/comparison corpus, not as a required runtime dependency. Write-back should stay blocked until policy and tests land. These assumptions are consistent with your prompt and with the repository’s own TW boundary and projection documents.  

One major limitation is that I did **not** find public, official documentation for a finished `lares/lararium-node` package. In this report, “lararium-node” therefore means a proposed Node-based target derived from your migration brief, the repo’s own architectural documents, and official MCP/TiddlyWiki/tldraw sources. Where a `lararium-node` behavior is not directly documented, I mark it as recommended or inferred rather than existing fact.  

### Added Assumptions from Lararium Context

Additional assumptions now bind this roadmap:

- `meme`, `loci meme`, `invariant meme`, `meme graph`, and `memetic-wikitext` remain the preferred Lararium terms.
- “Tiddler” may appear only when discussing TiddlyWiki as an external reference system.
- Hostful `lar:` URIs must preserve the ordered authority grammar `alias:tier@host`.
- Trust tier and speaker tier remain distinct; `alias:tier@host` names who speaks, not whether the claim overrides law.
- Live-session material enters the same tagspace as system files, but carries lower override authority than hostless invariant/control memes.
<<~/ahu >>

<<~ ahu #repo-inventory-contract >>

## Repo inventory and the surviving contract

The verified files below are the code/config/build/test/design surfaces that either **are** `lares/lararium_mcp`, launch it, test it, or define the architecture it is expected to grow into.

| Path | Purpose | Language | How it integrates | Source |
|---|---|---|---|---|
| `lares/lararium_mcp/__main__.py` | Package entrypoint | Python | Launches `server.main()` for `python -m lares.lararium_mcp` |  |
| `lares/lararium_mcp/__init__.py` | Public package exports | Python | Re-exports resolver, carrier, indexes, compiler, prompts, resources APIs |  |
| `lares/lararium_mcp/resolver.py` | `lar:///...` URI resolver | Python | Maps Lararium URIs to file paths or virtual namespaces |  |
| `lares/lararium_mcp/carrier.py` | Carrier ingress and validation | Python | Reads memetic-wikitext carriers, validates shape/metadata, derives implements/rating |  |
| `lares/lararium_mcp/diagnostics.py` | Structured diagnostics | Python | Supplies validation diagnostics used by carrier validation |  |
| `lares/lararium_mcp/indexes.py` | Carrier/interface/invariant indexes | Python | Builds virtual resource indexes surfaced through MCP resources |  |
| `lares/lararium_mcp/compiler.py` | Boot compiler | Python | Builds minimal/full boot artifacts and boot receipt |  |
| `lares/lararium_mcp/resources.py` | MCP resources surface | Python | Lists resources and resolves reads for carriers, indexes, boot artifacts |  |
| `lares/lararium_mcp/tools.py` | MCP tools surface | Python | Defines tool schemas and tool-call dispatch |  |
| `lares/lararium_mcp/prompts.py` | MCP prompts surface | Python | Defines prompt catalog and prompt materialization |  |
| `lares/lararium_mcp/server.py` | JSON-RPC/MCP stdio server | Python | Manual dispatch for initialize/resources/tools/prompts over stdio |  |
| `lares/lararium_mcp/adapters/mempalace.py` | Optional sidecar adapter | Python | Launches external `mempalace.mcp_server` over stdio JSON-RPC; env-sensitive |  |
| `lares/lararium_mcp/tests/test_carrier_spine.py` | End-to-end smoke tests | Python | Verifies resolver, carrier ingress, MCP initialize/resources/tools, notification behavior |  |
| `lares/lararium_mcp/tests/test_compiler.py` | Compiler contract tests | Python | Verifies minimal/full boot and MCP boot tools/resources |  |
| `lares/lararium_mcp/tests/test_prompts.py` | Prompt contract tests | Python | Verifies prompt catalog, message shape, JSON-RPC prompt access/error cases |  |
| `lares/lararium_mcp/tests/test_mempalace_adapter.py` | Adapter tests | Python | Verifies sidecar JSON-RPC protocol/lifecycle behavior |  |
| `lares/lararium_mcp/pranala_parser.py` | Pranala edge parser | Python | Branch addition; extracts `PranaEdge` records from carrier text |  |
| `lares/lararium_mcp/meme_graph.py` | Graph model and traversal helpers | Python | Branch addition; models memes, adjacency, topological sort, cycle detection, unresolved refs |  |
| `lares/lararium_mcp/tests/test_pranala_parser.py` | Parser contract tests | Python | Branch addition; verifies inline/block/sugar forms and `? ->` socket resolution |  |
| `lares/lararium_mcp/tests/test_meme_graph.py` | Graph contract tests | Python | Branch addition; verifies sort, relation expansion, implements derivation, unresolved severity, stable hash |  |
| `lares/lararium_mcp/tests/test_compiler.py` on branch | Revised compiler contract | Python | Branch addition; tracks graph-derived minimal/full boot semantics |  |
| `pyproject.toml` | Packaging/build metadata | TOML | Declares Python version, build backend, dev extras, pytest paths |   |
| `.mcp.json` | Local MCP launcher config | JSON | Launches `python -m lares.lararium_mcp` over stdio |   |
| `.vscode/mcp.json` | VS Code MCP config | JSON | Launches same server over stdio |   |
| `.codex/config.toml` | Codex MCP config | TOML | Launches same server over stdio |   |
| `Makefile` | Branch dev/test helper | Make | Adds `test` and `mcp-smoke` commands around current Python MCP surface |  |
| `scripts/mcp-smoke.py` | Branch smoke harness | Python | Spawns current MCP server over stdio and runs initialize/tools/list |  |
| `scripts/dev-setup.sh` | Branch dev bootstrap | Bash | Editable install, submodule init, packaging setup |  |
| `lares/ha-ka-ba/docs/lararium_mcp.md` | Current server intent | Markdown | States the server is read-only, stdio, small/bootstrap, resource-heavy |  |
| `lares/ha-ka-ba/docs/mcp/ARCHITECTURE.md` | Future stack plan | Markdown | Frames compiler, AST, execution graph, render, branch stories |  |
| `lares/ha-ka-ba/docs/mcp/RENDER_PROJECTION_CONTRACT.md` | Projection contract | Markdown | Defines `dom`, `tldraw`, `kowloon`, `trace` outputs as read-only render artifacts |  |
| `lares/ha-ka-ba/docs/mcp/SUBMODULE_INTEGRATION_MATRIX.md` | Submodule role matrix | Markdown | Declares Kowloon, Kowloon client/frontend, tldraw, TiddlyWiki roles |  |
| `lares/ha-ka-ba/docs/mcp/TW_FILTER_BOUNDARY.md` | TiddlyWiki boundary | Markdown | Explicitly keeps TW as guest grammar / comparison corpus, not constitutional runtime |  |
| `.gitmodules` | Submodule pins/paths | Git config | Confirms `kowloon`, `kowloon-client`, `kowloon-frontend`, `tldraw`, `tiddlywiki5` are repo-level dependencies |  |
| `lares/ha-ka-ba/docs/pono/lar-uri.md` | URI scheme spec | Markdown | Documents authority-bearing and authority-less `lar:` forms and validation/security concerns |  |
| `lares/ha-ka-ba/docs/graph/traversal.md` | Graph traversal law | Markdown | Defines Tier 0/1/2 traversal and DAG expectations |  |
| `lares/ha-ka-ba/docs/graph/pranala-parser.md` | Parser law | Markdown | Defines surface forms and `? ->` resolution rules |  |

The surviving behavioral contract is narrower than the codebase, and that is what matters for migration. The package exports resolver/carrier/index/compiler/resource/prompt functions through `__init__.py`; the stdio entrypoint is stable; resources, tools, and prompts are all namespaced under `lararium-*`; and the core package is read-only by design.   

More specifically, the contract that should survive the migration is this:

| Python surface | Current contract that must survive | Proposed TypeScript equivalent |
|---|---|---|
| `resolve_lar_uri(uri)` | Accepts `lar:///...` URIs; maps `AGENTS` / `LARES` to all-caps files, `INDEXES/**` to virtual roots, `ha.ka.ba` to `lares/ha-ka-ba`, other tuple roots to `lares/chapel-perilous-opens/<root>`; rejects unsupported roots | `resolveLarUri(uri, rootMap): LarResolution` in `lararium-core`, with path I/O delegated to `lararium-node`  |
| `read_lar_resource(uri)` | Reads file-backed resources only; raises on virtual or missing paths | `readLarTextResource(uri, host)` in `lararium-node` with identical error taxonomy exposed upward  |
| `read_carrier(uri)` / `validate_carrier_shape()` | Extracts IAM metadata, validates carrier markers, computes kapu/ano/meme/data/noise rating, returns implements bundle and diagnostics | `readCarrier(uri, text)` / `validateCarrierShape()` in `lararium-core` with deterministic diagnostics ordering   |
| `compile_carrier_index()` / interface / invariant indexes | Builds resource material for carrier/interface/invariant discovery | `buildCarrierIndex()`, `buildInterfaceIndex()`, `buildInvariantIndex()` in `lararium-core` with node-host file enumeration in `lararium-node`  |
| `parse_pranala_edges()` | Parses inline, block, and sugar forms; resolves `? ->` against enclosing `ahu`; normalizes TOML edge fields | `parsePranalaEdges()` in `lararium-core` returning immutable `PranaEdge` records   |
| `MemeGraph` and compiler helpers | Maintains adjacency, sort, cycle detection, unresolved severity, closure hash, interface derivation | `MemeGraph` / `compileMinimalBoot()` / `compileFullBoot()` / `compileBootReceipt()` in `lararium-core`   |
| `list_lar_resources()` / `read_lar_resource_or_index()` | Exposes carrier URIs, indexes, and boot artifacts as read-only resources; boot resources include `lar:///boot/minimal`, `.../full`, `.../receipt` | `registerLarariumResources(server, runtime)` in `lararium-mcp` backed by `lararium-node` runtime APIs    |
| `define_tools()` / `call_tool()` | Defines and dispatches namespaced tools such as resolver/carrier/boot compilation; returns MCP tool result shape with `content[]` and `isError` | `server.registerTool(...)` in `lararium-mcp`; each tool delegates to `lararium-node` / `lararium-core` services   |
| `list_prompts()` / `get_prompt()` | Provides prompt catalog and `messages` payloads; missing args raise; unknown prompt names error | `server.registerPrompt(...)` in `lararium-mcp`; prompt rendering stays read-only and data-backed   |
| `handle_jsonrpc_message()` / stdio main loop | Newline-delimited JSON-RPC over stdio; `initialize`, `resources/list`, `resources/read`, `tools/list`, `tools/call`, `prompts/list`, `prompts/get`; notifications should not emit responses; stdout must stay clean | `McpServer` + `StdioServerTransport` in `lararium-mcp`; no handwritten JSON-RPC multiplexer unless parity tests prove it is needed     |

A few concrete invariants deserve emphasis because they are migration-sensitive. The current transport is stdio-only and portless; all client launcher configs assume a spawned process, not a listening server. The current runtime is read-only. `notifications/initialized` should not produce a response. Minimal boot currently has a fixture count of 18 reachable memes after the DAG rewire (was 14 pre-rewire); that number is not a timeless law, but it is today’s parity fixture. The branch compiler also derives implements bundles from parsed edges rather than just metadata, and it classifies unresolved control edges as errors and relation edges as warnings.       

There is also a compatibility drift already visible inside the repo: tests and adapter code use protocol version `2025-11-25`, while the smoke script still initializes against `2024-11-05`. That means the migration should explicitly preserve or intentionally drop older transport behavior, and the decision should be made in code and documentation rather than left accidental.

### Branch-Local DAG and Trust Contract

The branch-local parser and graph work changes the migration baseline.
The TypeScript roadmap should preserve these semantics before adding new surfaces:

- `PranaEdge` records from block pranala, inline pranala, `loulou`, `aka`, and `kahea`
- `? ->` resolution through the enclosing `ahu` stack
- `MemeGraph` adjacency by family
- control-edge BFS
- Kahn topological sort
- one-hop relation expansion
- declared-unresolved severity classification
- interface/invariant index construction from loaded memes
- closure hashing

The repo contract also now includes the trust-boundary rule:

```text
hostful live exchange records may inform or propose;
they must not silently override hostless invariant memes.
```
<<~/ahu >>

<<~ ahu #external-architecture-findings >>

## External architecture findings

TiddlyWiki5 is highly relevant as architectural precedent, but the repo’s existing boundary document is correct: it should inspire core Lararium design without becoming the runtime substrate. TiddlyWiki’s boot kernel is deliberately tiny and sufficient only to load plugins/modules and start the rest of the application; it treats tiddlers as the universal content unit, can load from the browser DOM or the Node file system, packages plugins as bundles of tiddlers, implements JavaScript modules *as* tiddlers, and distinguishes parsing from widget/render stages. Official docs also show that Node mode stores tiddlers as individual files while single-file mode embeds them inside the HTML document. 

That translates into the following Lararium posture:

| TiddlyWiki pattern | Lararium decision | Why |
|---|---|---|
| Small boot kernel that loads higher layers | **Copy** | `lararium-core` should be small, deterministic, and bootable in Node or browser without transport/framework assumptions.  |
| Tiddlers as universal data/code unit | **Inspire** | Carriers/memes can fill the same “universal unit” role, but Lararium should keep its own file/AST/graph semantics.  |
| JavaScript modules as tiddlers | **Inspire, not literal-copy** | Useful as precedent for self-describing modules, but embedding executable JS inside carriers would blur code/data boundaries too early.  |
| Plugins as bundled tiddlers | **Inspire** | Good model for Lararium package bundles and fixture corpora; not necessary as the exact package runtime.  |
| Node.js wiki-folder storage | **Copy** | Strong precedent for `lararium-node` file-backed mode scanning a folder tree of carriers.  |
| Single-file wiki storage | **Inspire** | Good precedent for a browser bundle / serialized snapshot mode, but Lararium should not adopt TW’s HTML-container format as canonical storage.  |
| Filters and transclusion | **Inspire, with strict boundary** | TW filters are useful as guest grammar / query precedent; the repo explicitly keeps them out of constitutional center status.   |
| `parse tree -> widget tree -> DOM` pipeline | **Copy structurally, avoid literally** | The right Lararium analogue is `source -> AST -> execution graph -> projection`, not widget runtime reuse.    |
| Full TiddlyWiki runtime as app center | **Avoid** | Your own repo docs explicitly reject this for v1.  |

For MCP, the official picture is in flux. The public SDK docs still present the stable Node/TypeScript server experience around `@modelcontextprotocol/sdk`, `McpServer`, `StdioServerTransport`, resources/tools/prompts, and Streamable HTTP. The official repository, however, says its `main` branch is a v2 line that is still pre-alpha and that v1.x remains the production recommendation while the v2 branch settles. The MCP transport spec itself is clear on a few things that matter operationally: stdio is newline-delimited JSON-RPC with strict stdout purity; Streamable HTTP replaces the old HTTP+SSE transport; HTTP servers should validate `Origin`, bind locally when appropriate, and implement authentication when exposed remotely; and authorization is optional, HTTP-focused, and explicitly *not* intended for stdio, where environment-based credentials are the preferred model. 

That yields a cautious SDK recommendation. If `lararium-node` is being built for near-term production parity, use the stable production SDK generation and isolate it in `packages/lararium-mcp`. Do **not** let the SDK’s package structure dictate core or Node runtime APIs. If you later choose the monorepo/v2 package split, the adapter package can be upgraded locally without forcing changes into parser/compiler code. 

For tldraw, the official docs point to a record-centric and schema-centric data model that fits Lararium projection quite well. The store is a reactive database of typed records; snapshots divide cleanly into `document` and `session` parts; migrations are first-class and can occur at record or store scope; record scopes are explicitly `document`, `session`, and `presence`; and sync uses `@tldraw/sync` / `TLSocketRoom` with one authoritative room per shared document. The important design lesson is that Lararium should define an internal record model that can *project into* tldraw shapes/bindings without making tldraw’s own record taxonomy the canonical Lararium ontology. 

Kowloon is more verifiable than it first appears. The Synthetic-Dream-Machine repo and its integration matrix describe `kowloon/` as the backend/feed/activity/social substrate, `kowloon-client/` as an isomorphic client bridge, and `kowloon-frontend/` as the operator UI/reference surface. The actual `kowloon` repo `package.json` confirms a Node/Express-style backend with routes, methods, workers, schema imports, ActivityParser modules, storage SDKs, JWT/auth tooling, and Jest tests; `kowloon-client` explicitly describes itself as an isomorphic JavaScript client for Node/browser/React Native; and `kowloon-frontend` depends on `@kowloon/client` and a Vite/React front-end stack. So for Lararium purposes, Kowloon is not a scene graph target and not a core runtime; it is a backend/event/feed publication lane with client and frontend companion packages.    

The minimum read-only Kowloon projection payload should therefore stay very small and publication-shaped: `type`, `actor`, `object`, `published`, plus stable Lararium provenance fields like `exec_id`, `source_uri`, and `sha256` when available. The repo’s render-projection contract already points in exactly that direction by using an ActivityStreams-shaped event object with a boot-receipt payload.

### TiddlyWiki Vocabulary Boundary

TiddlyWiki remains useful because it demonstrates a quine-like content/kernel/storage pattern.
However, Lararium should not import the word “tiddler” into its ontology.
The Lararium unit is a **meme**: a sigil-marked memetic-wikitext carrier with a `lar` URI.

Use the TiddlyWiki comparison this way:

```text
TiddlyWiki tiddler pattern  -> Lararium meme inspiration
TiddlyWiki runtime          -> optional comparator / guest-system reference
Lararium meme graph         -> constitutional core
```

### URI and Live-Exchange Boundary

External architecture decisions must account for live exchange records.
The URI parser and resolver model should treat:

```text
lar:///ha.ka.ba/...                  canonical hostless meme
lar://alias:tier@host/ha.ka.ba/...   live contextual exchange record
```

as distinct identities.
Projection and MCP layers should preserve that distinction rather than normalizing hostful records into canonical hostless memes.
<<~/ahu >>

<<~ ahu #recommended-target-architecture >>

## Recommended target architecture and migration plan

The right package layout is a pnpm monorepo with strict dependency direction from adapters downward into core.

```mermaid
flowchart LR
    A[carrier files and snapshots] --> B[lararium-node]
    B --> C[lararium-core]
    D[lararium-web] --> C
    E[lararium-mcp] --> B
    F[lararium-tiddly] --> C
    G[lararium-tldraw] --> C
    H[lararium-kowloon] --> C
    E --> I[stdio]
    E --> J[Streamable HTTP]
```

| Package | Responsibility | Public API surface | Forbidden imports | Dependency rules |
|---|---|---|---|---|
| `packages/lararium-core` | Pure URI parsing, carrier parsing/validation, indexes, graph, compiler, AST envelope, projection contracts | `resolveLarUri`, `readCarrierText`-free parsers, `parsePranalaEdges`, `MemeGraph`, `compileMinimalBoot`, `compileFullBoot`, `compileBootReceipt`, domain types | `fs`, `path`, `process`, `window`, `document`, MCP SDK, tldraw, React | No package in monorepo may reverse-import from adapters into core |
| `packages/lararium-node` | File-backed host, CLI, config loading, directory walking, caching, optional watch mode, deterministic serialization | `createLarariumRuntime`, `NodeCarrierStore`, CLI/bin entrypoints | Browser APIs, React, MCP transport registration | May depend on `lararium-core`; adapter packages depend on it |
| `packages/lararium-mcp` | MCP transport adapter only | stdio server bin, optional Streamable HTTP server, resource/tool/prompt registration helpers | File-system logic except via `lararium-node`; tldraw/Kowloon internals | Depends on `lararium-node` and official MCP SDK only |
| `packages/lararium-web` | Browser bundle, in-memory/snapshot host, future viewer UX | `createBrowserRuntime`, web bootstrap, hydration APIs | Node APIs, MCP SDK | Depends on `lararium-core`; may consume projected outputs |
| `packages/lararium-tiddly` | Guest grammar and TW comparison fixtures; bounded filter/transclusion adapters | `parseTwFilterGuestGrammar`, fixture import/export helpers | Full TW runtime as hard dependency of core | Depends on `lararium-core`; optional peer/runtime deps only |
| `packages/lararium-tldraw` | Projection from Lararium records/exec graph to tldraw shapes/bindings/snapshots | `projectToTldraw`, migration/schema helpers | Core ontology changes, file-system logic | Depends on `lararium-core`; never imported by core |
| `packages/lararium-kowloon` | Read-only feed/event projection and optional publisher | `projectToKowloonEvent`, later publisher client | Core ontology changes, transport logic unrelated to Kowloon | Depends on `lararium-core`; publication client optional |

The proposed Lararium record model should mirror the repository’s branch graph semantics while staying projection-friendly for tldraw. I recommend three canonical layers: `LarCarrierRecord` for source carriers and validation metadata; `LarGraphNode` / `LarGraphEdge` for parsed graph semantics; and `LarProjectionRecord` for target-specific outputs. Each record should carry `id`, `type`, `scope`, `sourceUri`, `sourceSpan?`, `contentHash?`, and `meta`. Use `scope: "document" | "session" | "presence"` specifically so projection packages can map naturally into tldraw’s documented record scopes without forcing tldraw into core. That gives you a stable internal ontology and a loss-minimizing path into tldraw snapshots, session state, and future presence overlays.    

A concrete MCP mapping in TypeScript should be thin and declarative:

```ts
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { createLarariumRuntime } from '@lararium/node'

const runtime = await createLarariumRuntime({ root: process.cwd(), writeback: false })

const server = new McpServer({ name: 'lararium-mcp', version: '0.1.0' })

server.registerResource(
  'lar-resource',
  new ResourceTemplate('lar:///{path}', { list: undefined }),
  { title: 'Lararium resource' },
  async (uri) => runtime.readResource(uri.href)
)

server.registerTool(
  'lararium-resolve_lar_uri',
  { inputSchema: { uri: z.string().url() } },
  async ({ uri }) => runtime.callResolve(uri)
)

server.registerPrompt(
  'lararium-boot_minimal',
  { description: 'Explain or inspect current minimal boot closure' },
  async () => runtime.renderPrompt('lararium-boot_minimal')
)

await server.connect(new StdioServerTransport())
```

That MCP adapter should **not** hand-write JSON-RPC unless parity tests prove a missing SDK feature. The existing Python `handle_jsonrpc_message()` mostly exists because Python is manually dispatching protocol methods. In the TypeScript target, resource/tool/prompt registration should replace manual switch logic. That reduces protocol risk and aligns with the official SDK’s intended programming model.  

The clearest config migration is to replace Python launcher settings with Node shims while preserving the server name and local stdio posture:

```diff
// .mcp.json
{
  "mcpServers": {
    "lararium": {
-     "command": ".venv/bin/python3",
-     "args": ["-m", "lares.lararium_mcp"],
+     "command": "node",
+     "args": ["packages/lararium-mcp/dist/stdio.js"],
      "cwd": "."
    }
  }
}
```

Equivalent changes should land in `.vscode/mcp.json` and `.codex/config.toml`. If you want zero client-side churn during rollout, ship a compatibility wrapper named `lares.lararium_mcp` or a tiny Python shim that delegates to the Node binary for one transition window. That makes rollback trivial.   

The task-level migration plan below is the best sequence I can defend from the evidence.

| Task | Main change | Effort | Risk | Notes |
|---|---|---:|---|---|
| Parity contract freeze | Generate golden fixtures from Python for resolver/resource/tool/prompt/compiler outputs | 2–3 days | Medium | Must happen first, or TypeScript parity will drift immediately |
| Monorepo bootstrap | Add pnpm workspace, TS configs, package boundaries, lint/test/build scripts | 2–4 days | Low | Pure scaffolding |
| Resolver port | Port URI parsing/resolution and path-mapping rules into core+node host | 2–3 days | Medium | URI compatibility is externally visible |
| Carrier port | Port metadata extraction, diagnostics, shape validation, rating logic | 3–5 days | Medium | Easy to regress on regex/Unicode details |
| Pranala parser port | Port inline/block/sugar parsing, TOML normalization, `? ->` resolution | 4–6 days | High | Highest semantic parsing risk |
| Graph/compiler port | Port `MemeGraph`, closure traversal, unresolved severity, receipt hashing | 5–8 days | High | Hash stability and ordering must be deterministic |
| MCP adapter | Register resources/tools/prompts with official SDK; stdio first | 2–4 days | Medium | Keep adapter thin |
| Test harness migration | Replace Python smoke usage with Node stdio harness; add fixture diff tests | 2–4 days | Low | Branch already has smoke harness precedent |
| HTTP transport option | Add optional Streamable HTTP endpoint with local-only default, origin checks, auth hooks | 3–5 days | Medium | Optional; do after stdio parity |
| Browser/runtime split | Add browser runtime + snapshot mode without file-system imports | 5–8 days | Medium | Keep scope read-only |
| Projection adapters | Add tldraw and Kowloon read-only projection packages | 4–7 days | Medium | Pure projection, no write-back |
| Container/CI deployment | Add Node image, CI matrix, artifact publishing, rollback toggle | 2–4 days | Medium | Depends on target environment being clarified |

Recommended implementation milestones merge the prompt’s list with the repo’s actual state: parity contract; resolver port; carrier parser; index compiler; boot compiler; MCP adapter; AST envelope; pranala DAG walker; execution graph; render projections; browser bundle; write-back policy gates. The branch already gives you real starting points for the parser, graph, and compiler milestones, which means the migration should treat them as present-but-not-yet-ported, not as speculative future work.

### Integrated Trust-Tier Architecture

The architecture should carry trust tier as an explicit runtime concept.

Suggested ordering:

```text
hostless invariant memes
→ hostless interface / control-panel memes
→ hostless docs/spec memes
→ implementation artifacts
→ hostful live exchange records
→ generated trajectory records
```

This trust ordering should affect conflict handling, resolver diagnostics, and promotion workflows.

### Live Exchange Record Model

Every exchange turn can be represented in the same tagspace as system files.

Minimum record fields:

```ts
type LarExchangeRecord = {
  uri: LarUri              // hostful lar://alias:tier@host/...
  speaker: LarAuthority   // alias, tier, host
  signal: LarSignal       // stances, confidence, p, ffz
  trustTier: "session" | "trajectory"
  sourceSpan?: SourceSpan
  contentHash?: string
}
```

A hostful record can reference a canonical hostless meme, but should not become that meme without a promotion transaction.
<<~/ahu >>

<<~ ahu #risks-testing-rollout >>

## Risks, testing, and phased rollout

The biggest compatibility and runtime risks are predictable. First, the MCP SDK and transport surface are in transition, especially around package structure and HTTP transport generations. Second, the repo itself shows contract drift between the older static compiler approach and the branch’s graph-based compiler. Third, JSON serialization and ordering differences between Python and Node can silently change boot receipt hashes and fixture outputs. Fourth, regex- and TOML-based edge parsing is easy to get almost-right while still breaking socket resolution or edge-family normalization. Fifth, stdio servers are unforgiving: any stray stdout output breaks the protocol. Finally, if you later enable HTTP, DNS rebinding, CORS/origin handling, and auth mistakes become real operational risks.   

The mitigation and rollback posture should therefore be conservative. Run Python and Node implementations side by side in a dual-run harness for fixtures and smoke tests. Keep the MCP server name and tool/resource/prompt names unchanged during first rollout. Preserve stdio as the default transport. Add a one-flag rollback path in local configs so that a launcher can switch back from Node to Python in one edit. If HTTP is introduced, keep it disabled by default, bind to localhost unless deliberately remote, validate `Origin`, and put auth behind a clearly separate remote mode.    

The test strategy should be parity-first:

| Test category | What to test | Why it matters |
|---|---|---|
| Golden fixtures | Python-generated JSON for resolver results, resources, tools, prompts, minimal/full boot, boot receipt | Prevents semantic drift during port |
| Unit tests | URI resolution, metadata extraction, parser normalization, graph utilities, hash determinism | Replaces today’s Python module tests directly |
| Property tests | URI normalization and `? ->` socket resolution across nested `ahu` structures and relative targets | Best defense against subtle parser regressions |
| Integration tests | stdio initialize/resources/tools/prompts against the Node MCP adapter | Preserves client-facing behavior |
| Compatibility tests | 2024-11-05 and 2025-11-25 initialize smoke cases, if you choose to support both | Closes existing protocol-version ambiguity |
| Browser hydration tests | Snapshot load/save and browser runtime initialization | Required for single-bundle mode |
| Projection snapshot tests | tldraw document/session snapshot generation and Kowloon event projection | Keeps adapter layers deterministic |
| No-write tests | Ensure mutation paths are absent or explicitly rejected | Enforces policy gate |

The current Python tests already define most of that shape. Branch parser/graph tests are especially valuable because they cover inline/block/sugar edges, implements derivation, unresolved severity, and stable closure hashing. Those should be re-expressed one-for-one in TypeScript before any adapter work is considered “done.”      

Monitoring and observability should also improve during the migration. At minimum, add structured logs for initialize/resource/tool/prompt events, latency, result size, and error code; metrics for compiler duration, graph node/edge counts, unresolved-edge counts, and receipt hash churn; and session/request IDs for any future HTTP mode. If you add Streamable HTTP, you should also monitor invalid-origin rejections, auth failures, session creation rate, and stale session reuse, because those are the operational edges called out by the official transport and authorization docs. 

The rollout should be phased and boring:

```mermaid
flowchart TD
    A[Freeze Python parity fixtures] --> B[Port core resolver and carrier]
    B --> C[Port parser graph and compiler]
    C --> D[Add Node runtime host]
    D --> E[Add thin stdio MCP adapter]
    E --> F[Dual-run Python and Node in CI]
    F --> G[Switch local launch configs to Node]
    G --> H[Optional Streamable HTTP canary]
    H --> I[Projection packages and browser mode]
```

A practical roadmap is:

| Window | Outcomes |
|---|---|
| First 30 days | Freeze parity fixtures; stand up pnpm monorepo; port resolver, carrier validation, indexes; create `lararium-node` runtime skeleton; pass stdio initialize/resources/tools/prompts parity smoke tests |
| First 60 days | Port parser/graph/compiler fully; land deterministic boot receipt hashing; add `lararium-mcp` adapter; dual-run in CI; switch local launcher configs to Node behind a rollback toggle |
| First 90 days | Add browser runtime; add read-only tldraw/Kowloon projection packages; optionally introduce Streamable HTTP canary with origin validation and auth hooks; keep write-back blocked |

The “do not do yet” list is short but important: do not embed the full TiddlyWiki runtime; do not make tldraw or Kowloon core dependencies; do not expose mutating tools or write-back flows; do not hard-commit to the MCP SDK’s experimental packaging line inside core; and do not treat browser bundle work as a reason to compromise the isomorphic-core boundary.   

<<~/ahu >>

<<~ ahu #dag-rewire-2026-04-25 >>

## DAG Rewire — mu as Invariant Boot Kernel (2026-04-25)

The minimal boot DAG was restructured to reflect best-practice microkernel topology. `mu` is now the invariant boot kernel; `AGENTS` is the threshold router only.

### Before

```
AGENTS (entry, threshold)
  ├─owns─→ e-prime, ooda-ha, lar-uri   (preloaded at threshold)
  ├─owns─→ mu
  │         └─owns─→ chao, the-four-tools, the-law-of-5s, the-syad-perspectives
  ├─owns─→ lararium
  │         ├─owns─→ hud, voices, continuity
  │         └─owns─→ LARES  (dead-weight — also owned by AGENTS)
  └─owns─→ LARES
```

### After

```
AGENTS (threshold router only)
  ├─owns─→ mu (invariant boot kernel)
  │         ├─owns─→ e-prime, ooda-ha, lar-uri   (kernel disciplines)
  │         ├─owns─→ chao, the-four-tools, the-law-of-5s, the-syad-perspectives
  │         └─owns─→ lararium (agent mechanics seat)
  │                   ├─owns─→ hud, voices, continuity
  │                   └─owns─→ live-session-overwrite, canon-promotion-boundary,
  │                             tagspace-trust, exchange-vector   (lararium law)
  └─owns─→ LARES (operator dials — threshold yields directly)
```

### Rationale

`AGENTS` is a threshold membrane, not an execution owner. Routing and yielding are its only jobs. `mu` is the living practice kernel — it owns every discipline and law meme the agent carries into execution. `lararium` is the agent mechanics seat; the four new pono invariant memes (`live-session-overwrite`, `canon-promotion-boundary`, `tagspace-trust`, `exchange-vector`) are lararium law, not kernel law, so they land under `lararium`. `LARES` stays at the threshold — operator dials are not the kernel's to own.

The dead-weight `lararium → LARES` owns edge was removed. LARES is reached once, cleanly, from AGENTS.

### New Parity Baselines

| Artifact | Old | New |
|---|---|---|
| Minimal boot memes | 14 | 18 |
| Full boot memes | 57 | 58 |

### Four New Invariant Law Memes

| URI | Role |
|---|---|
| `lar:///ha.ka.ba/api/v0.1/pono/failure-states/live-session-overwrite` | Names the green-jello-dinosaur failure mode; a live claim MUST NOT become canon by recency, repetition, or charm |
| `lar:///ha.ka.ba/api/v0.1/pono/hooponopono` | Promotion gate law; crossing from live exchange pressure to hostless canon requires explicit ceremony |
| `lar:///ha.ka.ba/api/v0.1/lararium/tagspace-trust` | Shared `lar:` tagspace MUST NOT imply shared authority; hostless memes outrank hostful exchange records |
| `lar:///ha.ka.ba/api/v0.1/lararium/exchange-vector` | Each substantive exchange turn MUST emit a canonical `lar:` URI vector before content |

All four implement `meme`, `loci`, and `invariant` interfaces. All four appear in the minimal boot closure at depth 3 under lararium.

<<~/ahu >>

<<~ ahu #milestone-1-complete >>

## Milestone 1 — Complete (2026-04-25)

pnpm monorepo standing. All Python MCP modules ported to TypeScript. 19/19 parity tests pass against Python golden fixtures. MCP launcher configs switched to Node with Python retained as `lararium-python` for one-edit rollback. Python golden fixtures archived to `lares/lararium-node/fixtures.golden.json`. Python MCP serves no further active role in the Node roadmap — it moves to `_archive/` once CI confirms Node stability.

One critical bug found and fixed during port: `withMdSuffix()` in the resolver checked `p.includes(".")` across the full path string — `v0.1` in the path suppressed `.md` on bare-name segments like `mu`, yielding 7 instead of 14 minimal boot memes. Fixed to check only the final path segment.

Parity baselines frozen (post DAG-rewire):

| Artifact | Count |
|---|---|
| Minimal boot memes | 18 |
| Full boot memes | 58 |
| Carrier index | (matches Python) |

<<~/ahu >>

<<~ ahu #deployment-targets >>

## Deployment Targets and Container Model

### Environment Model

Three Docker environments. Each has a distinct purpose and a distinct level of lares/ mutability.

**`dev`** — volume-mounted lares/, tsx watch mode, no build step. Used for local authoring, carrier editing, and pranala debugging. The MCP server here restarts on file change. VSCode connects directly. No ports exposed to the network beyond localhost.

**`qa`** — built image, ports exposed for integration testing and live VSCode work sessions. This is the primary surface for MCP integration tests, stdio smoke, and any tooling that needs a stable running server to query. It is also the environment for live carrier authoring sessions where a running server is useful — think of it as the always-on local lab. Tests run against it rather than spawning their own server.

**`prod`** — built image, deployment target only. Serves Claude Desktop, DreamNet cloud backends (elyncia.app and family, cloud-hosted containers, DNS-named services), and any other MCP consumer that needs a stable versioned server. `lares/` is mounted read-only in prod. Write-back is blocked at the runtime level. The prod container speaks only stdio or (later) Streamable HTTP behind auth. No dev tooling, no watch mode.

### Client Surface Model

Browser clients (`lararium-web`, tldraw surfaces, future DreamNet room views) follow a two-step boot pattern:

1. Boot `lararium-core` from an embedded snapshot or a pre-built JSON bundle (the same carrier graph the Node compiler produces).
2. Sync from a locally pulled repo clone if available, or from a cloud-served bundle endpoint if not.

Session-scoped "rooms" gate what subset of the carrier graph a given view sees. Room filtering is deferred — the carrier graph itself stays complete; projection packages and the session layer determine what surfaces in a given room. This is the same pattern as the record scope model (document / session / presence) already in the architecture.

The browser bundle must not import `lararium-node` or MCP packages. `lararium-web` depends only on `lararium-core` and its own host adapters.

### DreamNet Cloud Surface

Prod containers for DreamNet services (elyncia.app, .net, and sibling domains) run lararium-mcp behind DNS and a reverse proxy. Each service instance mounts its own lares/ snapshot. Auth hooks are required before these instances expose any surface beyond stdio. Streamable HTTP transport (with Origin validation and auth) is the target for cloud-hosted prod — but it stays off by default until the stdio parity window closes.

### Rollback

`lararium-python` entry remains in all launcher configs for one-edit rollback during the transition window. Once CI confirms Node stability across two consecutive release cycles, the Python entries are removed and `lararium_mcp` moves to `_archive/`.

<<~/ahu >>

<<~ ahu #ci-pipeline >>

## CI Pipeline — Node Only

No Python in the GitHub Actions pipeline. Python served as a sketch; the golden fixtures are the record. CI runs Node exclusively from Milestone 2 onward.

### Workflows

**`ci.yml`** — runs on every push and PR:

1. Install Node 22+, install pnpm, install workspace deps.
2. Typecheck all packages (`pnpm -r typecheck`).
3. Build all packages (`pnpm -r build`).
4. Run parity tests (`pnpm --filter @lararium/node test`).
5. Run MCP stdio smoke: spawn `node packages/lararium-mcp/dist/stdio.js` as a child process, send `initialize` + `resources/list` + `tools/list` + `prompts/list` over stdin, assert response shape and meme count against the frozen fixture. This is a real protocol smoke — not a unit call — because stdout purity and JSON-RPC framing are the things most likely to silently regress.

**`parity-drift.yml`** — scheduled weekly:

Regenerates golden fixtures from the Node runtime (not Python — Python is archived). Diffs against `fixtures.golden.json`. Fails if meme counts change without a deliberate fixture update commit. This catches carrier graph drift before it accumulates.

**`docker-qa.yml`** — runs on push to `main` and on release tags:

Builds the `qa` image. Runs the MCP stdio smoke against the container rather than the local build. This is the integration surface — verifies the container behaves identically to the local build.

### Test Matrix

| Category | Tool | Where |
|---|---|---|
| Typecheck | `tsc --noEmit` | All packages |
| Parity tests | jest (golden fixtures) | `lararium-node` |
| MCP stdio smoke | Node child-process harness | `lararium-mcp` |
| Docker integration | `docker-qa.yml` | Container |
| Projection snapshot tests | jest | `lararium-tldraw` (future) |
| No-write gate | jest | `lararium-node` (future) |

### Protocol Version

The MCP SDK handles version negotiation. CI smoke tests against `2025-11-25` only. The `2024-11-05` smoke case in the old Python script is not preserved — it was a sketch artifact, not a contract. If a consumer needs older protocol support, it surfaces as a deliberate adapter decision, not a CI default.

<<~/ahu >>

<<~ ahu #milestone-2-scope >>

## Milestone 2 — Complete (2026-04-25)

All target outcomes delivered:

- ✓ Docker Compose with `dev`, `qa`, `prod`, `qa-smoke` profiles
- ✓ `ci.yml` GitHub Actions: typecheck → build → parity tests → MCP stdio smoke (fragile pnpm store path replaced with `pnpm exec jest`)
- ✓ `parity-drift.yml` scheduled fixture drift check (weekly, Node-only, no Python)
- ✓ MCP stdio smoke child-process harness in `packages/lararium-mcp/tests/` — 7 tests passing
- ✓ `lararium-web` skeleton: `createBrowserRuntime(snapshot)` + `bootFromUrl(url)`, depends only on `lararium-core`, zero Node APIs
- ✓ No-write gate tests in `packages/lararium-node/tests/no-write-gate.test.ts` — 8 tests; `ClosureEntry` objects now `Object.freeze`d at compiler boundary
- ✓ `_archive/lararium_mcp/` Python MCP moved out of active tree
- ✓ DAG prose updated: AGENTS.md, mu.md, lararium.md reflect rewired topology
- ✓ Parity baselines: 27/27 tests green (19 parity + 8 no-write gate), 7 MCP smoke

## Milestone 3 — Complete (2026-04-25)

### Completed

- ✓ Boot receipt determinism: hash covers stable content only (excludes `compiledAt`)
- ✓ `ClosureEntry` frozen at compiler boundary (no external mutation)
- ✓ Hostful `lar://alias:tier@host/path` URI parsing: `parseHostfulLarUri()`, `isHostfulLarUri()` in `lararium-core`; hostful records always virtual, never resolve to lares/ files; `resolveLarUri()` explicitly rejects hostful form
- ✓ 22 property tests for nested `ahu` `? ->` resolution in `lararium-core`
- ✓ **Grammar fix: `fromSlot` separated from `fromSocket`** — the critical invariant:
  - `fromSocket` = the enclosing ahu worksite (always set from the ahu stack)
  - `fromSlot` = the named outgoing slot on that ahu (set only when pranala carries an explicit `#fragment`)
  - Before: `#hydrate-hud` on a pranala overrode `#core-hydration` as fromSocket. Now: `fromSocket=#core-hydration`, `fromSlot=#hydrate-hud`
  - Bug fixed simultaneously: `AHU_CLOSE_RE` was missing `~`, so `<<~/ahu>>` never popped the stack
- ✓ Streamable HTTP canary (`packages/lararium-mcp/src/http.ts`): separate entrypoint, Origin validation gate, auth hook stub, `LARARIUM_HTTP_PORT/HOST/ALLOWED_ORIGINS` env config, `lararium-mcp-http` bin
- ✓ `lararium-tldraw` skeleton: pure projection, no tldraw runtime import (optional peer), `LarProjectionRecord` union (page/frame/arrow/note), `projectToTldraw()`, story river layout, TiddlyWiki mapping documented in source

- ✓ Layout/projection separation: `LarTLLayout` pass sits between `LarTLSnapshot` and tldraw store
- ✓ TiddlyWiki cascade pattern: `LayoutStrategy[]` with `predicate + apply`, `selectLayout()` picks first match
- ✓ `storyRiverLayout()`: x=depth×(FRAME_W+GAP_X), y=band position; ahu sub-frames in local coords; arrow geometry center-to-center
- ✓ `emitTldrawRecords(snapshot, layout)` → store-ready shape records with `{x,y,rotation,index,parentId,props:{w,h}}`; arrows emit relative start/end vectors; colors by family (control=blue, relation=grey, observe=green, dataflow=orange)
- ✓ 16 layout + emission tests; 81 total tests green

### Also Completed (beyond original Milestone 3 scope)

- ✓ `lararium-web` Vite bundle: `dist/lararium-web.es.js` + `dist/lararium-web.umd.js` (22.67 kB / 18.10 kB), zero build warnings
- ✓ `crypto-shim.ts`: deterministic djb2-inspired 32-byte mixing shim satisfies `createHash('sha256')` in browser build; vite.config.ts aliases `crypto → src/crypto-shim.ts`
- ⚠ **Async crypto shim debt** — `crypto-shim.ts` is NOT a real SHA-256. It uses djb2-inspired mixing: deterministic and collision-resistant for carrier content hashing, but not cryptographically secure. When browser callers become `async`-capable, replace `hashBuf()` in `crypto-shim.ts` with `await crypto.subtle.digest('SHA-256', buf)` and update `BrowserHash.digest()` to return `Promise<string>`. Callers in `lararium-core` (boot receipt, carrier hash) will need to be awaited. Track: `packages/lararium-web/src/crypto-shim.ts` TODO comment.
- ✓ **TW5 Filter Language — single canonical engine** (hand-rolled evaluator removed):
  - `tw-filter.ts` (Node): `filterMemesTW(entries, twExpr)` + `precomputeRooms()` via `tiddlywiki` devDep + `createRequire`. ClosureEntry → tiddler fields (`title=uri`, `tags=implements`, `depth/rating/role`). `[all[memes]]` aliases `[all[tiddlers]]`.
  - `tw-filter-browser.ts`: same API in browser, backed by pre-built `src/generated/tw-filter-engine.browser.js` (154 modules, 106 operators, 410 KB). Vite aliases swap Node path for browser path at bundle time.
  - `scripts/build-tw-browser-filter.mjs`: deterministic extraction script — boots TW5, serializes filter+wiki+utils modules to ESM. Upgrade process: `pnpm update tiddlywiki` → re-run script → run tests.
  - `LarSnapshot.rooms`: pre-computed room filter results embedded in snapshot for instant browser load.
  - Deterministic process: bump `tiddlywiki` dep → all 86+ TW operators available automatically. No vendoring, no code extraction.
  - `buildBootClosure(graph, entryUri)` extracted to `lararium-core/compiler.ts` — pure BFS+topoSort on a pre-loaded MemeGraph (enables browser boot without file system).
- ✓ **Infinite canvas app bootstrap** (`lararium-web/src/app.ts`):
  - `bootApp(snapshotUrl)`, `bootFromSnapshot(snapshot)`, `bootFromRuntime(runtime)`, `bootFromEmbedded(scriptId)` — four boot modes
  - `renderAppViews(app)` — dynamic-imports `@lararium/tldraw`, calls `renderAllViews()`, attaches emission to app
  - `LarApp { runtime, artifact, receipt, emission }` — single live state object
- ✓ View-switching architecture: `LarViewState` navigation model, three-view rendering (story-river/meme-detail/graph), camera transition helpers in `lararium-tldraw`
  - `view-state.ts`: pure `LarViewState` type + `viewStateReducer()` (8 tests)
  - `multi-view.ts`: `renderAllViews()` → 3 tldraw pages in one emission (story-river/meme-detail/graph); `focusSnapshot()` filters to one meme + direct neighbours
  - `layout.ts`: `memeDetailLayout()` (320px frames, 120px gap) and `graphLayout()` (160px frames, overview scale) added alongside `storyRiverLayout()`
  - `nav.ts`: `zoomToMeme()`, `zoomToFitAll()`, `switchToPage()`, `goToStoryRiver()`, `goToGraph()` — duck-typed against tldraw Editor, no runtime import required
  - `emitTldrawRecords()` accepts `pageOverride` option for multi-page emission
  - 33 tests total in lararium-tldraw; 75 across monorepo

<<~/ahu >>

<<~ ahu #tldraw-sync-arch >>

## tldraw Sync Architecture Decision (2026-04-26)

### Problem Identified

The snapshot-injection model (inject `LarSnapshot` JSON into HTML `<script>` tag, browser calls `loadSnapshot()`) creates a race condition under multiplayer use. Two surfaces boot from the same frozen blob, diverge in session state, and have no authority model for reconciliation. TiddlyWiki's single-file multiplayer history and IPFS's content-addressed design both demonstrate that getting this wrong at the base level is expensive to fix later.

### Decision: Skip Phase 1 Static Snapshot — Go Straight to TLSocketRoom

**tldraw's own production pattern (tldraw.com, 400k+ users):**

```
lares/ → compileMinimalBoot() → renderAllViews() → TLStoreSnapshot
                                                          │
                                               (seed once, if room is new)
                                                          ↓
                                             SQLiteSyncStorage (room keyed by BootReceipt SHA)
                                                          │
                                                 TLSocketRoom (server-authoritative)
                                                          │
                               ┌──────────────────────────┴───────────────────────────┐
                            useSync                                               useSync
                         (VS Code webview)                                    (Chrome tab)
```

No snapshot injection in HTML. No `loadSnapshot()` on the client. Browser calls `useSync({ uri: "ws://localhost:4321/rooms/boot" })`. Server owns document state from byte one. No race condition possible.

### Key Architecture Facts (from tldraw docs, Feb 2026)

- `TLSocketRoom` accepts `initialSnapshot` on first creation — this is the seeding path from our projection
- `SQLiteSyncStorage` is now the default persistence backend (SQLite, not in-memory, survives process restarts)
- `initialSnapshot` and `onDataChange` are **deprecated** in favor of pluggable `storage` option
- One `TLSocketRoom` per document — our three pages (story-river, meme-detail, graph) are partitions within one room
- tldraw sync keeps confirmed server state and optimistic client pending state as **separate layers** — this structurally enforces `canon-promotion-boundary` without extra code
- `useSync` (from `@tldraw/sync`) replaces the local store; clients never "load" a snapshot, they join a live room

### Room Key = BootReceipt SHA

Room identity is derived from `BootReceipt.sha`, making re-seeding idempotent:

- If SQLite has no record for `sha:${receipt.sha}` → seed from `renderAllViews()` output
- If SQLite has the record → clients connect and receive deltas
- lares/ changes → new receipt SHA → new room (old room preserved in SQLite for rollback)

This is content-addressed room identity. Same IPFS discipline: compute-then-address, not name-then-mutate.

### canon-promotion-boundary Holds Structurally

tldraw sync's two-layer model (confirmed server / pending client) is isomorphic to the Lararium trust tier model:

```
confirmed server state  ≡  hostless canon (lares/ tree)
pending client state    ≡  hostful live exchange (session pressure)
```

Canvas edits live in the pending layer. Nothing crosses to server state without a sync commit. Nothing crosses from server state to lares/ canon without a separate promotion ceremony. The boundary is enforced by the protocol, not by convention.

### What Changes in the Codebase

| Component | Old plan | New plan |
|---|---|---|
| `lararium-app/src/App.tsx` | `bootFromEmbedded()` + `loadSnapshot()` | `useSync({ uri: wsUrl })` — no local boot |
| `lararium-node/scripts/serve.ts` | Static file server + snapshot injection | WebSocket server; `TLSocketRoom` per room; seed from projection if SQLite empty |
| `lararium-web` `bootFromEmbedded` | Primary boot path | Offline/embedded fallback only (single-file wiki mode) |
| `index.html` injection slot | Required for boot | Optional — only needed for offline mode |
| Room persistence | In-memory (lost on restart) | `SQLiteSyncStorage` — survives restarts |

### Offline / Embedded Mode Stays

`bootFromEmbedded()` + `loadSnapshot()` remains valid for:
- Single-file wiki distribution (no server)
- Offline read-only sessions
- CI test rendering

It is no longer the primary browser boot path.

### Implementation Order

1. Upgrade `serve.ts` to WebSocket server with `TLSocketRoom` + `SQLiteSyncStorage`
2. Seed room from `renderAllViews()` on first connection if SQLite empty
3. Replace `bootFromEmbedded` + `loadSnapshot` in `App.tsx` with `useSync`
4. Add `@tldraw/sync` as dep to `lararium-app`, `@tldraw/sync-core` to `lararium-node`

Do not ship the snapshot-injection server as the primary path. Offline mode only.

<<~/ahu >>

<<~ ahu #milestone-4-scope >>

## Milestone 4 — Complete (2026-04-26)

### Completed

**Crypto provider boundary (replaces djb2 crypto-shim)**
- ✓ `CryptoProvider` / `DigestProvider` / `RandomProvider` interfaces in `lararium-core/src/crypto.ts`
- ✓ `webDigest()`, `webGetRandomValues()`, `webRandomUUID()`, `defaultCryptoProvider`
- ✓ Canonical bytes helpers: `utf8Bytes()`, `canonicalJson()`, `canonicalJsonBytes()`, `hex()`, `sha256Hex()`
- ✓ `compileBootReceipt()` async, uses `canonicalJsonBytes` + `sha256Hex`; `import { createHash } from 'crypto'` removed
- ✓ `crypto-shim.ts` deleted; vite `crypto` alias removed from `lararium-web`
- ✓ Known-vector test: SHA-256("abc") = `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` — passes
- ✓ All callers (stdio.ts, cli.ts, app.ts, no-write-gate.test.ts, parity.test.ts) updated to `await`
- ✓ `lares/lararium-node/CRYPTO.md` doctrine carrier

**ATProto / Bluesky login doctrine**
- ✓ Doctrine-only — no implementation
- ✓ `lares/lararium-node/AUTH-ATPROTO.md`: BFF-preferred, SDK-managed PKCE/PAR/DPoP, seven identity layers, k256 out of scope

**Infinite canvas app scaffold**
- ✓ `packages/lararium-app/` created: `index.html`, `main.tsx`, `App.tsx`, `LarariumCanvas.tsx`, `SidePanel.tsx`
- ✓ `viewStateReducer` wired; Back and Graph buttons in `SidePanel`
- ✓ All packages typecheck clean

**Multiplayer sync server (replaces snapshot injection)**
- ✓ `packages/lararium-node/scripts/serve.ts` rewritten as `TLSocketRoom` + `SQLiteSyncStorage` WebSocket server
- ✓ `better-sqlite3` backend (not `node:sqlite`) — matches official tldraw template
- ✓ Room seeded from `renderAllViews(artifact)` on first connection if SQLite empty; idempotent on resume
- ✓ Room ID = `"boot"` (content-addressed SHA keying deferred to Milestone 5)
- ✓ `@tldraw/sync-core` + `better-sqlite3` + `ws` added to `lararium-node` deps
- ✓ Static file server injects `<meta name="lararium-ws">` into `index.html` (no snapshot blob)
- ✓ WebSocket handler follows official tldraw simple-server-example: sessionId from URL query param, message buffering pattern, ws passed directly to `handleSocketConnect`

**Browser client upgrade**
- ✓ `App.tsx` rewritten: reads `wsUrl` from `<meta name="lararium-ws">` or same-host fallback; `useReducer(viewStateReducer)` nav state; `app={null}` (sync mode, no local boot)
- ✓ `LarariumCanvas.tsx` rewritten: `useSync({ uri: wsUrl })`, `loading` / `error` / `synced-remote` states handled; `useEffect([store.status, navState])` drives `syncNavState`
- ✓ `SidePanel.tsx` accepts `app: LarApp | null`; gracefully shows `--- memes` when null

**tldraw v4 schema compliance (found and fixed during browser testing)**
- ✓ All shape IDs must start with `shape:` — `memeFrameId`, `ahuFrameId`, `edgeArrowId`, note IDs all fixed in `records.ts` / `project.ts`
- ✓ Index key format: replaced broken `a${n.toString(36)}` with `getIndexAbove`/`getIndicesAbove` from `@tldraw/utils`
- ✓ Multi-view shape ID scoping: `scopeId()` rewrites `shape:foo` → `shape:${pageSlug}__foo` — collision-free across views, `shape:` prefix preserved
- ✓ `TLArrowRecord` / `TLNoteRecord` now imported from `tldraw` directly and used with `satisfies` — schema drift is now a compile error, not a runtime `ValidationError`
- ✓ Arrow props: `kind: "arc"`, `labelColor: "black"`, `fill: "none"`, `font: "draw"`, `elbowMidPoint: 0.5` added
- ✓ Note props: `labelColor: "black"`, `font: "draw"`, `fontSizeAdjustment: 0` added
- ✓ 34/34 `@lararium/tldraw` tests pass; 36 `@lararium/node` tests pass

**Build hygiene**
- ✓ `tldraw` and `tiddlywiki5` git submodules removed; versioned npm deps replace them
- ✓ `@tldraw/utils@^4.5.10` added to `lararium-tldraw`; `pnpm-workspace.yaml` no longer includes `tldraw/packages/*`
- ✓ TW5 help banner suppressed during `boot.boot()` in `tw-filter.ts` (stdout redirect during init)
- ✓ `mempalace`, `kowloon`, `kowloon-frontend`, `kowloon-client` submodules retained (private/co-developed)

**Design docs**
- ✓ `lares/lararium-node/MULTIPLAYER-INFINITE-CANVAS-WIKI.md` — canonical design constitution for the multiplayer canvas system (system role, room model, seeding contract, trust tiers, canon boundary, views, MCP surface plan, deployment topology, open questions)

### Known Open Items (carry to Milestone 5)

- ⚠ `SidePanel` story river is empty (`app=null`); population requires store-derived selector over `editor.getShapes()` or `/api/boot/artifact` endpoint
- ⚠ Room ID is `"boot"` string — content-addressed SHA keying not yet implemented
- ⚠ UCAN access tier gating: design in MULTIPLAYER-INFINITE-CANVAS-WIKI.md, not implemented
- ⚠ Path traversal guard in static file server: `join(APP_DIST, pathname)` has no boundary check
- ⚠ WS URL injected as `ws://${HOST}:${PORT}` — should derive from request `Host` header for proxy/LAN correctness
- ⚠ Double-click on frame shapes → zoom-in dispatch (tldraw v4 event API)
- ⚠ Portal shapes connecting rooms

<<~/ahu >>

<<~ ahu #milestone-5-scope >>

## Milestone 5 — In Progress (2026-04-26)

### Completed (this session)

**Canvas UX + Kinopio Alignment Sprint**

- ✓ `TLArrowBindingRecord` emitted and seeded into store — drag-follows-arrow Kinopio behavior wired at the binding layer
- ✓ Multi-view bindings merged across story/detail/graph emissions
- ✓ Dead layout constants removed from `project.ts` (FRAME_W/H were computed but never stored — data layer is now geometry-free)
- ✓ `LarariumShell` — Kinopio-style chrome: `position:fixed; pointer-events:none` header; canvas fills 100vh; canvas mode toggle (`` ` `` key, dims Lararium chrome, restores tldraw toolbar); error boundary with reload button; debug globals gated to `NODE_ENV=development`
- ✓ `⌘K` command palette: **Spaces** section (DEFAULT_ROOMS with chronometer glyphs) above **Memes** section; unified arrow-key navigation across both sections
- ✓ `zoom-levels.ts` — five-level ontology: `strategic/operational/tactical/combat/action` → 🗺️⚙️🔍⚔️⚡ mapped to chronometer scale positions; `classifyZoom()`, `ZOOM_SNAP`, `ZOOM_PAGE`; exported from `@lararium/tldraw`
- ✓ Zoom auto page-switching: `editor.store.listen()` detects zoom threshold crossings → auto-switches to graph page (strategic/operational) or story page (tactical); `onZoomLevel` callback surfaces level to shell footer glyph
- ✓ `LarPortalShapeUtil` — custom tldraw shape: hexagonal badge, blue border, `targetRoomId` + `label` props; registered via `shapeUtils` prop
- ✓ Portal shapes emitted at `y=-80` above each page via `emitPortalShapes()` in `multi-view.ts` — placed for all live portal edges in DEFAULT_PORTALS
- ✓ `GO_TO_ROOM` action in `LarViewState` reducer + `"room"` view kind; `syncNavState` calls `goToRoom()` on dispatch
- ✓ Content-addressed room key: `boot-${receiptSha.slice(0, 16)}` — idempotent across recompiles; meta tag injection updated
- ✓ `/admin/reseed` endpoint (localhost-only), `/api/rooms` endpoint
- ✓ All packages build clean; 36/36 tests passing

### Also completed in M5 session (2026-04-27)

**Schema/validation fix**
- ✓ `lar-portal` custom shape type replaced with built-in `geo` (hexagon) + `meta: { larPortal, targetRoomId, label }` — tldraw's server-side schema (`DEFAULT_INITIAL_SNAPSHOT.schema`) rejects unknown types on sync; no custom `ShapeUtil` or schema registration needed
- ✓ `LarPortalShapeUtil` deleted; portal detection in double-click handler reads `shape.meta.larPortal`
- ✓ Zoom `store.listen` scoped to `{ scope: "session" }` — camera is session-scoped; fires ~100× less than unscoped

**Security hardening**
- ✓ Path traversal guard: `resolve(filePath)` checked against `APP_DIST` prefix; 403 on escape
- ✓ WS URL from `req.headers.host` + `x-forwarded-proto` — LAN/proxy clients get correct address

**UX shell + kinopio alignment (2026-04-27)**
- ✓ `LarariumShell` — kinopio-model chrome: `position:fixed; pointer-events:none` header, all UI via React portal into `document.body`, canvas fills 100vh
- ✓ ⌘K command palette: Spaces + Memes sections, unified arrow-key nav
- ✓ Canvas mode toggle (`` ` `` key): dims Lararium chrome, restores tldraw toolbar; toggle pill bottom-left
- ✓ `SidePanel` removed — palette is the navigation surface
- ✓ Zoom-level ontology (strategic/operational/tactical/combat/action) with FTLS-scale thresholds (0.15/0.35/0.80/1.50); footer glyph tracks live
- ✓ MULTIPLAYER-INFINITE-CANVAS-WIKI.md and ROADMAP.md aligned to current implementation

**Pending browser smoke (Milestone 6 opens)**
- ⚠ Drag-follows-arrow: binding records type-correct; tactile test pending
- ⚠ Portal double-click: geo+meta → GO_TO_ROOM path untested live
- ⚠ Zoom auto page-switch: threshold logic correct; live camera interaction untested
- ⚠ `/api/memes` console error: fetch hits Vite (5173), no handler — decision required: Vite proxy to serve.ts OR replace fetch with `editor.getShapes()` (target model)
- ⚠ MCP co-location: stdio server alongside HTTP/WS server in `packages/lararium-node`

<<~/ahu >>

<<~ ahu #milestone-6-scope >>

## Milestone 6 — In Progress (2026-04-27)

### Priority 1: Browser smoke + canvas wiring verification

Open running server, verify tactile (Playwright session):
- Drag a meme frame → arrows follow (binding records emitted, tactile unconfirmed)
- Double-click portal badge (geo+meta) → room page switches
- Zoom out past 0.35 → auto-switches to graph page; zoom back → story river
- ⌘K → Spaces section shows rooms with chronometer glyphs; Enter navigates
- Canvas mode toggle (`` ` ``): Lararium chrome dims, tldraw toolbar appears

Fix whatever breaks. M5 canvas wiring is partially unvalidated.

### Priority 2: Tensegrity audit — code gaps found 2026-04-27

Eight structural gaps found by walking all packages against the kinopio/multiplayer model:

| # | Location | Issue | Severity |
|---|---|---|---|
| T1 | `LarariumShell.tsx` header | Breadcrumb hardcodes `"the-altar-fire"` — never updates on `GO_TO_ROOM` | **Broken live** |
| T2 | `App.tsx` → `LarariumCommandPalette` | Meme list from `/api/memes` fetch — fails in all dev paths; palette Memes section always empty | **Broken live** |
| T3 | `multi-view.ts` `ROOM_PAGE` | Duplicates `room.ts` `roomPageId()` — two sources of truth for room→page mapping, can drift | Mechanical fix |
| T4 | `room.ts` `portalShapeId` | Returns `frame:portal_${...}` — portals are now `shape:portal_${...}` geo shapes; function is wrong and unused | Dead export |
| T5 | `view-state.ts` `ZOOM_OUT` action | Exported, reducer handles it, nothing dispatches it — shadow nav | Orphan |
| T6 | `lararium-web/src/app.ts` | Full offline boot API (`LarApp`, `bootFromSnapshot`, `renderAppViews`) orphaned from primary `useSync` path — no handoff signal | Slack |
| T7 | `lararium-tldraw/src/render.ts` `renderToTldraw` | Single-view pipeline coexists with `renderAllViews`; nothing calls it in prod — looks dead but is the right shape for `meme:${uri}` rooms | Needs comment |
| T8 | `room.ts` `roomEntries` + `MemeFilter` | Designed for per-room TW5 filtering; not yet wired to serve.ts seeding; `invariants`/`entry` rooms unresolvable | Unwired |

Fix order: T1 → T2 → T3+T4+T5 (mechanical batch) → T6+T7+T8 (commentary).

### Priority 3: `/api/memes` resolution

Console error on boot: `fetch /api/memes` hits Vite (5173), returns HTML 404.

Decision required (one of):
- **(a) Vite proxy:** add `server.proxy` in `vite.config.ts` forwarding `/api/*` and `/rooms/*` to `serve.ts:4321`. Preserves HMR. Requires `serve.ts` running in parallel dev loop.
- **(b) Skip fetch entirely:** replace `App.tsx` fetch with `editor.getShapes()` filtered to `meta.frameKind === "meme"` — CRDT-native, no separate endpoint. This is the target model (MULTIPLAYER §open-questions #2). Zero backend dependency.

Option (b) is the architecturally correct path. Option (a) is simpler if `serve.ts` is already running.

### Priority 3: Security hardening — complete (2026-04-26)

- ✓ Path traversal guard: `resolve(filePath)` against `APP_DIST`
- ✓ WS URL from `req.headers.host` + `x-forwarded-proto`

### Priority 4: MCP integration (partially complete 2026-04-26)

**Done**
- ✓ `wikitext-filter` tool: TW5 filter expression evaluated against boot closure — `[all[memes]tag[...invariant]]`, `[field:depth[0]]`, etc.
- ✓ `lararium-room_list` tool: DEFAULT_ROOMS with page IDs and filter expressions
- ✓ `lararium-edge_list` tool: all pranala arrows from projection, optional family filter
- ✓ `filterMemesTW` + `precomputeRooms` exported from `@lararium/node` via new `@lararium/core/tw-filter` subpath export (keeps browser bundle clean)

**Remaining**
- ⚠ MCP ↔ canvas bridge: `stdio.ts` compiles fresh from `lares/` on each tool call — it cannot see live room state (active connections, shape positions, session camera). Bridge requires either: (a) `stdio.ts` queries `serve.ts` HTTP API for live state, or (b) both run in the same process. Env var `LARARIUM_HTTP_URL` would let `stdio.ts` query the canvas server.
- ⚠ `lararium-meme_list` tool: currently `lararium-compile_minimal_boot` covers this but lacks the flat URI+depth+kind summary format that is optimally tool-shaped

### Priority 5: UX chrome — tldraw component slot integration ✓ (2026-04-27)

**Implemented.** All Lararium chrome moved into tldraw component slots. No `position:fixed` header competing with tldraw panels.

Slot mapping (as shipped):

| Lararium element | tldraw slot | Notes |
|---|---|---|
| Room breadcrumb + status badge | `MenuPanel` | Top-left; room name, zoom glyph, meme count, view badge |
| ⌘K trigger + theme cycle button | `SharePanel` | Top-right |
| Back / Graph / Wiki-Canvas toggle + zoom glyph | `HelperButtons` | Bottom-right row |
| NavigationPanel (minimap + zoom) | tldraw default | Bottom-left; restored in both wiki and canvas modes |
| Command palette overlay | `position:fixed` | Intentionally covers everything; z-index: 800 |

Key patterns:
- Slot components are stable **module-level** refs in `lararium-context.tsx` — tldraw never remounts them
- All state is shared via `LarariumCtx` React context — slot components read it without prop drilling
- `WIKI_COMPONENTS`: Toolbar/StylePanel/PageMenu/MainMenu/ZoomMenu/QuickActions/TopPanel all null; Lararium slots + NavigationPanel default
- `CANVAS_COMPONENTS`: PageMenu/TopPanel null; Lararium slots + NavigationPanel + tldraw drawing chrome (Toolbar, StylePanel etc.) restored

### Priority 6: Theme system — Gruvbox CSS tokens + selector ✓ (2026-04-27)

**Implemented.**

- `src/lararium-theme.css` — CSS custom property overrides scoped to `html[data-theme]`. Selector specificity: `html[data-theme="gruvbox-dark"] .tl-theme__dark { ... }` beats tldraw defaults without `!important`.
- `useTheme()` hook in `lararium-context.tsx` — reads `localStorage("lararium.theme")`, applies `data-theme` on init, cycles via `cycleTheme()`.
- Theme cycle: `system → gruvbox-dark → gruvbox-light → system`
- `SharePanel` shows `◑ / 🌑 / ☀` button; click cycles theme.
- `LarariumCanvas` syncs tldraw `colorScheme` (`dark` / `light` / `system`) whenever theme changes via `useEffect`.
- `index.html` inline `<script>` applies stored theme before first paint — no flash on reload.
- Default: `gruvbox-dark`.

See MULTIPLAYER `#theme-system` for full CSS token tables.

### Priority 7: Meme count reactive subscription ✓ (2026-04-27)

**Implemented.** `store.listen(() => { debounce(scanMemes, 150) }, { scope: "document" })` added inside the `synced-remote` `useEffect` in `LarariumCanvas`. One-shot scan on first sync, then live re-scan on any shape add/remove/meta change. `scope: "document"` skips camera/presence records — fires ~100x less than default. Cleanup returns both `unsub()` and `clearTimeout`.

Do not in Milestone 6:
- Canon promotion / write-back to `lares/`
- UCAN implementation (design frozen)
- Kowloon projection
- Multi-user presence / cursors
- Single-page zoom-gated rendering (blocked on namespace collision resolution — current three-page model stays)

<<~/ahu >>

<<~ ahu #milestone-6-tensegrity-close >>

## Milestone 6 — Tensegrity Close (2026-04-27)

All eight structural gaps (T1–T8) audited against current code:

| # | Gap | Status |
|---|-----|--------|
| T1 | Breadcrumb hardcodes "the-altar-fire" | ✓ Resolved — `activeRoomName(navState)` reads `DEFAULT_ROOMS` map; updates on `GO_TO_ROOM` |
| T2 | Meme list from `/api/memes` fetch | ✓ Resolved — replaced with `store.listen + editor.getCurrentPageShapes()` CRDT-native scan |
| T3 | `ROOM_PAGE` duplicates `room.ts` `roomPageId()` | ✓ Resolved — `multi-view.ts` now imports `roomPageId` from `room.ts` and builds map from it |
| T4 | `portalShapeId` wrong dead export | ✓ Resolved — export removed; portal detection reads `shape.meta.larPortal` |
| T5 | `ZOOM_OUT` orphan action | ✓ Resolved — removed from `view-state.ts` exports |
| T6 | `lararium-web` offline boot orphaned | Commentary — `bootFromEmbedded` retained as offline fallback per design |
| T7 | `renderToTldraw` single-view pipeline coexists with `renderAllViews` | Commentary note added in source |
| T8 | `roomEntries + MemeFilter` unwired from `serve.ts` seeding | Deferred — per-room TW5 filtering deferred to wiki-recipe carriers milestone |

Milestone 6 complete. All blocking live gaps resolved. Commentary items documented.

<<~/ahu >>

<<~ ahu #milestone-7 >>

## Milestone 7 — Meme Store Substrate (Complete 2026-04-27)

Research foundation: `lares/lararium-node/MEME-STORE-FOUNDATIONS.md`

Three converging pressures from TW5 tiddler contract, UE5 World Partition schema enforcement, and AST self-hosting grammar define the substrate that must hold before canon promotion, UCAN, or multi-user presence can land safely.

Three laws:
- **`meme-immutability`** — a confirmed meme is never mutated; edits produce new URIs; re-seeding replaces the full room snapshot (not individual shapes)
- **`pranala-schema-binding`** — each pranala family declares an invariant property contract; validation runs at parse time; schema definitions live as memes in `lares/grammars/`
- **`grammar-as-memes`** — all grammar rules and template definitions live as carrier memes; the TypeScript parser is a thin interpreter; grammar changes take effect after re-seed without a TypeScript rebuild

### Priority 8: `/admin/reseed` endpoint ✓ (shipped in Milestone 5)

**Completed.** `GET /admin/reseed?roomId=boot` kills the SQLite room entry and re-seeds from `renderAllViews(artifact)` on next WebSocket connect. `/api/rooms` endpoint lists active rooms. Both gated to non-prod. Unlocks the `lares/` edit → live canvas loop without restarting the server.

### Priority 9: Pranala family property contracts + compile-time validation ✓ (2026-04-27)

**Implemented.** `validatePranaEdge(edge)` added to `pranala-parser.ts`. `FAMILY_CONTRACTS` map defines per-family rules. `validateClosure()` in `compiler.ts` runs the validator against all edges in the graph and populates `ValidationResult.edgeViolations`. `BootReceipt.validation` surfaces `edgeViolationCount` + `edgeErrors` counts.

Violation model:
| Severity | Rule | Condition |
|---|---|---|
| `error` | `unknown-family` | family not in `[control, relation, observe, dataflow]` |
| `warning` | `role-recommended` | `control` or `dataflow` edge missing `role` |
| `error` | `confidence-out-of-range` | `observe` edge with `confidence` outside `[0, 1]` |

Sugar forms (loulou/aka/kahea) never set `role` — correctly reported as warnings, not errors. 43/43 tests pass including 11 new contract tests.

Future: extract `FAMILY_CONTRACTS` to `lares/grammars/pranala-families.md` carrier (Phase 2 grammar-as-memes).

### Priority 10: Grammar Phase 2 scaffolding ✓ (2026-04-27)

**Implemented (Phase 2 scaffold — wiring deferred to Phase 2.5).**

- `lares/grammars/memetic-wikitext.md` — grammar carrier meme with `[[sigils]]` and `[[families]]` TOML arrays; full sigil registry (ahu, pranala, loulou, aka, kahea, iam, header) and family contracts table
- `GrammarRules`, `SigilRule`, `FamilyRule` interfaces exported from `@lararium/core` (`pranala-parser.ts`)
- `loadGrammarRules()` function in `node-host.ts` — reads grammar carrier from `lares/grammars/memetic-wikitext.md`, extracts `[[sigils]]` + `[[families]]` into a `GrammarRules` object, returns `null` on missing file (bootstrap safety net)
- 85/85 tests pass

**Phase 2.5 complete (2026-04-27):** `GrammarRules` threaded as optional third arg to `parsePranalaEdges`. Hard-coded regex constants promoted to configurable values derived from the grammar meme when present; fall back to built-in constants on missing file. `loadGrammarRules()` in `node-host.ts` reads `lares/grammars/memetic-wikitext.md`, parses `[[sigils]]` + `[[families]]` TOML arrays. `buildControlClosure` calls it at boot and passes `grammar` through all downstream meme loaders. TOML parser uses self-terminating quoted-string regex — `#` inside quoted strings is not treated as comment. 95/95 tests passing including 11 grammar-loader tests.

**Hot-reload path now live:** Edit grammar carrier in `lares/grammars/memetic-wikitext.md` → `GET /admin/reseed` → server rebuilds from fresh disk → grammar rule changes take effect without TypeScript rebuild.

**Phase 3 (next):** Parser itself becomes a meme. Template cascade (tldraw projection) driven by grammar memes. Canvas can edit its own renderer. Sigil rules and family contracts editable as canvas shapes, promoted via canon-promotion ceremony.

<<~/ahu >>

<<~ ahu #milestone-7-grammar-extension >>

## Milestone 7 — Grammar Extension (post-M7, 2026-04-27)

After M7 closed, a full grammar session substantially completed Phase 2 of the grammar-as-memes work. This is tracked here as an extension of M7 before M8 opens.

### What was completed

**Grammar meme (`lares/grammars/memetic-wikitext.md`) — sigil registry expanded from 7 → 40 entries:**

- Core 7 preserved and description-updated (`ahu`, `pranala`, `loulou`, `aka`, `kahea`, `iam`, `pranala-header`)
- Conditional `[C]`: `wai` (if), `mukuwai` (else), `kahawai` (elif)
- Iteration `[SC]`: `huli` (for/seek)
- Context binding `[SC]`: `meme` (explicit lexical scope setter — replaces TW5 `currentTiddler` ambient leak)
- Definition pragmas `[SC]`: `wehe` (procedure/define), `helu` (function — filter-expression yielding)
- Render sugar `[SC]`: `kapu` (boundary posture, render-layer qualification), `hana` (bounded guest grammar block), `ui` (query/filter render)
- Constraint sugar `[SC]`: `pono` (constraint family edge sugar — structural rule declaration; compile-layer; distinct from `kapu`)
- Concurrency `[SC]`: `hui` (sync-all), `heihei` (race), `puka` (rush/fire-fastest), `lele` (branch/fire-and-forget — only concurrency sigil emitting `family:message` graph artifact)
- English aliases (18): `\procedure`, `\function`, `\define`, `\link`, `\shadow`, `\if`, `\else`, `\elif`, `\for`, `\sync`, `\race`, `\rush`, `\branch`, `\tiddler`, `\transclude`, `\guard`, `\task`, `\query`
- Guest grammar registry: `x-tiddlywiki-filter` (legacy/import), `wikitext-filter` (active native dialect)

**`wikitext-filter` dialect (`lares/grammars/wikitext-filter.md`) — new carrier:**

Forked from `x-tiddlywiki-filter`. Key departures:
- `[toml:key[value]]` replaces `!!field` (queries `#iam` TOML metadata by type)
- `[edge:family[X]role[Y]]` replaces `##index` (queries compiled pranala edge graph)
- `[self[]]` replaces `+currentMeme`/`currentTiddler` ambient lookup
- `[ahu:id[fragment]]` — queries by ahu fragment anchor
- Explicit lexical scope model: no ambient dynamic variable; `meme` sigil provides context binding

**`memetic-wikitext-spec.md` — holistic spec complete:**

- TW5 + Verse/UEFN AST parity map (full operator and sigil coverage)
- English alias namespace: `\` prefix erased to canonical Hawaiian at parse time; 18 aliases registered
- Message routing protocol: `family:dataflow` root-downward (SwiftUI Environment / Flutter InheritedWidget); `family:message` leaf-upward (SwiftUI PreferenceKey / Flutter NotificationListener) — validated against both
- Concurrency model: Verse 1:1 alias mapping (`hui`=`sync`, `heihei`=`race`, `puka`=`rush`, `lele`=`branch`)
- `kapu`/`pono` distinction: `kapu` = render-layer boundary posture; `pono` = compile-layer structural rule assertion
- Gap 1 (`constraint` family sugar) closed: `pono` registered `[SC]`
- Register system: `[C]` (operator canon), `[SC]` (Synthetic Canon), `[S]` (synthesis/proposal), `[SP]` (speculative/unproven), `[P]` (provisional — session-local candidate, dissolves rapidly)
- `[CS]` → `[SC]` rename throughout all grammar files

**Research carrier (`lares/ha-ka-ba/docs/pono/sigil-grammar-research.md`) — new carrier:**

Hawaiian vocabulary grounding, operator rulings log, precedent alignment (TW5/Liquid/MCP/SwiftUI/Flutter/Elm/Verse), full sigil vocabulary table with register, source notes with confidence levels.

### Key distinctions established

| Concept | Sigil | Layer | Role |
|---|---|---|---|
| Lexical scope | `meme` | both | Explicit context binding; replaces TW5 ambient `currentTiddler` |
| Boundary posture | `kapu` | render | Inline qualification: confidence, restriction, unresolved threshold |
| Structural rule | `pono` | compile | Constraint family edge: invariant that must hold; no execution pulse |
| Filter query | `ui` | render | Render surface for wikitext-filter result sets |
| Work block | `hana` | both | Bounded guest grammar block; grammar-key selects interpreter |
| Fire-and-forget | `lele` | compile | Only concurrency sigil producing `family:message` graph artifact |

### Phase 2 status (2026-04-27)

Phase 2 substantially complete. Grammar meme at 40 registered sigils (post-M7 session).

### Grammar Phase 2.x Extension (2026-04-27) — this session

After the Phase 2 session documented above, a further grammar extension session completed the remaining gaps and added the 7th pranala family.

**New sigils registered:**

- `kau` — variable binding; `<<~! kau name = val >>` = carrier-scoped (hoisted pragma); `<<~ kau name = val >>...<<~/kau >>` = block-scoped; `!` carries scope elevation promise
- `kumu` — element type definition (`\widget` equivalent); declares a new grammar node type (distinct from `wehe` which is text/content template)
- `papalohe` — reaction family edge sugar; *pāpālohe* (Lua martial arts: body-listening reflex, heightened reflexive awareness); UEFN device graph event wire; `trigger` property carries event name
- `kapu` block form — added `open_pattern`/`close_pattern` alongside existing inline `pattern`

**New English aliases registered:**

`\const`, `\let`, `\var` → `kau` | `\widget`, `\type`, `\typos` → `kumu` | `\import` → `kahea` | `\constraint` → `pono`

**7th pranala family — `reaction`:**

"When source fires event, target awakens." UEFN device graph event subscriptions. `papalohe` is the sugar sigil. Wired in `KNOWN_FAMILIES`, `FAMILY_CONTRACTS`, event loop, `ActiveRegexes`. `trigger` property stored in `payload["trigger"]`.

**AST type layer (Phase 3 — compressed):**

`packages/lararium-core/src/ast.ts` — `MemeAstNode` union compressed to **8 node kinds**. 15 typed interfaces collapsed into `SigilNode { sigilName, attrs, body }`. `MetadataNode` removed — `toml`/`iam` are now `SigilNode`. `DynamicNode` added as grammar-meme escape hatch. `#ast-node-types` spec section updated to reflect compressed model.

**Phase 3 parser (`parseMemeCarrier`):**

New primary API: `parseMemeCarrier(uri, text, grammar?) → MemeAstNode[]`. SAX-internally (`collectEvents`), tree output (`buildAst`), edge projection (`edgesFromAst`). Inline alias erasure via `SigilScan.canonicalName` — no separate `eraseAliases` phase. `parsePranalaEdges` retained as stable edge-only API (avoids circular dep). BOOTSTRAP_SCANS drive the parser before grammar rules load.

**`wikitext-filter.md`:** Added `[edge:family[reaction]trigger[X]]` operators section.

**Test count:** 64 → 84 (20 new tests in `grammar-phase2x.test.ts` + `parser-phase3.test.ts` covering `papalohe`, reaction family contracts, Phase 3 tree structure, parity with `parsePranalaEdges`, alias erasure, `DynamicNode`, kau scope).

<<~/ahu >>

<<~ ahu #milestone-7-complete >>

## Milestone 7 — Summary

All three laws landed:

| Priority | Item | Status |
|---|---|---|
| P8 | `/admin/reseed` endpoint | ✓ shipped M5 |
| P9 | Pranala family property contracts + compile-time validation | ✓ shipped M5 |
| P10 | Grammar Phase 2 scaffold + Phase 2.5 wiring | ✓ shipped M7 (2026-04-27) |
| — | `lares/README.md` → carrier meme + resolver registration | ✓ shipped M7 (2026-04-27) |
| — | `lares/.laresignore` + full `lares/` tree walk | ✓ shipped M7 (2026-04-27) |

**Parity baseline change:** `lar:///README` now resolves as a `CAPS_FILE_ROOT` to `lares/README.md`. Carrier index and full boot closure will include it from next boot. Fixture counts will increase by one.

<<~/ahu >>

<<~ ahu #milestone-8-scope >>

## Milestone 8 — Single-Page Zoom + kumu Template Pipeline (Complete 2026-04-28)

### Completed

**Single-page zoom-gated rendering (replaces three-page model)**
- ✓ `renderAllViews()` collapsed to one page (`page:boot`) — URI-stable shape IDs, no `pageOverride` scoping
- ✓ `applyZoomTemplate(editor, level)` — batch `editor.updateShapes()` on zoom threshold crossings; reads `shape.meta.templateProps[level]`
- ✓ `ratingFromShape()` helper — maps `meta.rating` → tldraw color string; used by `color="rating"` template prop
- ✓ Five `ZoomTemplateKey` levels: `strategic/operational/tactical/combat/action`
- ✓ Multi-view tests updated: 34/34 pass against single-page model
- ✓ MULTIPLAYER and ROADMAP docs updated to reflect single-page model as shipped

**kumu template pipeline — fully wikitext-native**
- ✓ Five template carriers at `lar:///ha.ka.ba/api/v0.1/lararium/templates/meme-*` (in `ha.ka.ba/api` namespace — no adjacent namespace)
- ✓ `lares/ha-ka-ba/api/v0.1/lararium/templates/index.md` — namespace index, owns control edges to all five; wired from `lararium` meme via `#hydrate-templates` (control:owns)
- ✓ Each template TOML body carries: `zoom-level`, `cascade` (filter predicate string), `priority`, `w`, `h`, `color`, `label`, `include-ahu`, `show-notes`, `show-carrier`, `opacity`
- ✓ `<<~ kumu name(params) >>` / `<<~/kumu >>` direct form added to `SIGIL_SCANS` in `parser.ts` (alongside `\\widget` alias)
- ✓ `collectKumuDefs()` + `collectKumuDefsFromGraph()` — extract kumu defs from boot closure carriers
- ✓ `buildKumuRegistry(artifact.kumuDefs)` → `KumuRegistry` → `buildTemplatePropsByLevel(registry)` → `TemplatePropsByLevel` seeded into `shape.meta.templateProps` at projection time
- ✓ `MemeTemplateProps` extended with `zoomLevel` (self-declared level name) and `cascade` (predicate string) — stored in CRDT for future wikitext-filter path
- ✓ `DEFAULT_TEMPLATE_PROPS` updated with `zoomLevel` + `cascade` fallback values
- ✓ `CRDT-native carrier text` — `shape.meta.carrierText` seeded at projection; `MemeDetailPanel` reads from store
- ✓ Boot closure now includes 25 memes (up from 19); all exist; `allExist: true`; 229/229 tests green

**CRDT-native carrier text + Meme detail panel**
- ✓ `shape.meta.carrierText` — carrier text seeded at projection time, stored in tldraw CRDT store; no HTTP fetch
- ✓ `MemeDetailPanel` — slides up from viewport bottom on `meme-detail` view; reads carrier text from store via context editor; parses with `parseMemeCarrier`; Escape/backdrop dismisses

**TW5 cascade + UEFN instance model research (2026-04-28)**
- ✓ TW5 `:cascade` filter run prefix: priority-ordered list of tagged tiddlers; each evaluates arbitrary filter expression against tiddler context; first non-empty result is the template title. Cascade rules are authored as tiddlers — no core JS modification.
- ✓ UEFN Verse `creative_device`: class definition in `.verse` source (shared code); per-instance `@editable` props stored as level data (serialized at editor time, hydrated at simulation start). The class/instance seam is the exact `kumu` definition / placed instance seam. Inter-device topology is flat, pre-baked into per-instance level data — no runtime scene graph traversal. Maps directly to pranala edges declared in carrier fields.

### Priority 1: Browser smoke testing (Playwright)

Verify all M5/M6 tactile behaviors in a running instance. These were code-complete but not tactilely confirmed:

- Drag meme frame → arrows follow (binding records in store, verify tactile)
- Double-click geo portal (meta.larPortal) → room page switches
- Zoom out past 0.35 → auto-switches to graph page; zoom in → story river
- ⌘K → Spaces section shows rooms with chronometer glyphs; Enter navigates
- Canvas mode toggle (`` ` ``): Lararium chrome dims, tldraw toolbar appears
- Theme cycle button (◑/🌑/☀) → CSS tokens update; no flash on reload
- `/admin/reseed` → grammar rule change takes effect without restart

Fix whatever breaks. Mark each item confirmed or filed as a bug.

### Priority 2: Meme detail panel ✓ (shipped M8)

`MemeDetailPanel` implemented. CRDT-native: reads `meta.carrierText` from store, parses with `parseMemeCarrier`, renders AST. Slides from viewport bottom on `meme-detail` navState. Escape/backdrop dismisses. No server round-trip.

### Priority 3: Content-addressed room keys

Current: room ID is static `"boot"` string. Target: `boot-${receipt.sha.slice(0, 16)}`.

Requires: client redirect logic when the expected room key changes. `GET /api/rooms` already returns room list. Meta tag `lararium-ws` can embed room key alongside WS URL. Browser reads room key, reconnects to correct room.

### Priority 4: Grammar Phase 3 scaffolding

Phase 2 is substantially complete (40 sigils registered, `wikitext-filter` dialect, TW5+Verse parity, English aliases, `kapu`/`pono` constraint distinction). See `#milestone-7-grammar-extension` for full detail.

Phase 3 targets — parser becomes a meme. Template cascade (tldraw projection) driven by grammar memes.

Phase 3 design:
- `lares/grammars/memetic-wikitext.md` already carries full sigil + family tables (40 entries)
- A `grammar-interpreter.md` meme will define the interpreter contract (the "Lisp surface")
- `parsePranalaEdges()` becomes a thin dispatch: read interpreter URI from boot closure, call the meme-defined parse function
- Template cascade: `lares/templates/` carriers define tldraw projection per meme type
- Editing a template carrier + `/admin/reseed` changes visual style without TypeScript rebuild
- The TypeScript parser stays as the C kernel; memes define grammar rules only; executable memes are Phase 4

Phase 3 entry condition: `lares/grammars/wikitext-filter.md` dialect carrier is already live; Phase 2.5 wiring means the grammar meme drives the parser today. Phase 3 crosses the line where the parser dispatch table itself is meme-authored.

**Phase 2.x parser wiring (complete 2026-04-27):** `pono` (constraint family sugar) and `lele` (message family sugar) wired into `parsePranalaEdges`. `KNOWN_FAMILIES` and `FAMILY_CONTRACTS` extended with `message` + `constraint`. `SigilRule.kind` union extended with all grammar-meme kinds (`concurrency`, `query`, `guest-grammar`, `guest-grammar-alias`, `query-alias`, `pragma`). 10 new tests added; full suite 146/146 green.

### Priority 5: Wiki-recipe carriers

`lares/recipes/` schema. Seed per-room canvases from recipe files. RPG rooms (`ftls`, `wtf`) unblock once recipes land. Recipe carrier format: `[[memes]]` TOML array with filter expression + seed layout.

<<~/ahu >>

<<~ ahu #design-decisions-kowloon-scope >>

## Design Decisions — Kowloon Integration + Scope Principles (2026-04-27)

### Lararium as Kowloon node

A lararium node is (or connects to) a full Kowloon server. The canvas is a Kowloon Group. Circles, membership tiers, and the social graph are live Kowloon state rendered as visual graphs on the canvas. Use cases: summon feed, sync with others, draft/publish posts, manage circles as visual graphs.

Kowloon architecture grounding:
- Objects: Posts, Replies, Reacts, Circles, Groups — each with global ID `type:<id>@domain`
- Addressing: `to: @public | @<domain> | circle:<id> | group:<id> | <userId>`
- **The inversion:** Circles are *your* data structure, not the platform's. You follow someone *into a circle you own*. Author gates with `to: circle:<id>`; reader assembles their graph. Neither side sees the other's structure.
- Federation: hybrid push (direct actions) + pull (discovery). Replication boundary = Group/Circle membership.
- FeedItems coarse-sanitizes visibility (no circle IDs leaked); FeedFanOut is the authoritative grant table.

### 5 scope principles

State in lararium has five principled scopes (principles, not techniques):

| scope | boundary | Kowloon ground |
|-------|----------|----------------|
| `ephemeral` | one agent turn | no Kowloon object |
| `personal` | one actor, persistent | `to: @<domain>` |
| `consensual` | shared by mutual choice, author-gated/reader-assembled | `to: circle:<id>` |
| `collective` | shared by group identity with governance | `to: group:<id>` |
| `universal` | no gate, federated | `to: @public` |

Parse-time `kau` shorthands `carrier` (→ `personal`) and `block` (→ `collective`) retained for compatibility. `kapu` qualifier can be a scope principle name.

### UEFN / `papalohe` design notes

`papalohe` maps to UEFN device graph event binding: `DeviceA.EventX -> DeviceB.FunctionY`. Current syntax captures source event (`trigger:EventName`) but not target function. `fn:FunctionName` is the conventional extension key — additive, no parser change needed.

Device types map to `kumu` (element type definition). UEFN `@editable` properties serialize as `kau` bindings within the kumu body.

**`spatial` family** — locked as 8th pranala family (after `reaction`). Infinite canvas + portals requires spatial containment edges that are navigable, not just organizational. Roles: `contains`, `portal`, `adjacent`, `layer`. Direction: `area -> area` or `area -> portal -> area`. Load-bearing for RPG battlemap / multi-level / interlinked areas milestone.

<<~/ahu >>

<<~ ahu #design-decisions-law-of-5s >>

## Design Decision: Law of Fives — Invariant Scale + Phase Model

**Decision**: Two orthogonal const arrays (`LADDER_5`, `OODA_HA_5`) are canonical invariants in `ast.ts`. All domain ladders — scope, zoom, Kowloon addressing, lifecycle, temporal scale — are projections of `LADDER_5`. All phase/confidence/stance systems are projections of `OODA_HA_5`.

```
LADDER_5  (scale, finest → coarsest):  action · round · turn · watch · week
OODA_HA_5 (phase, active → reflective): act · decide · orient · observe · aftermath
```

These axes run in **opposite directions**: `act` is the finest-grain phase (Action/ephemeral); `observe` is the widest-lens phase (Week/universal). The tension is productive — it models the operator-agent loop as a live crossing of scale and phase, not a single timeline.

**Domain alignment table:**

| Ladder5  | Scope5      | Zoom (canvas) | Kowloon  | Lifecycle   | OODA-HA    | Discordian |
|----------|-------------|---------------|----------|-------------|------------|------------|
| action   | ephemeral   | micro          | Activity | transient   | act        | Chaos      |
| round    | personal    | card           | Object   | instance    | decide     | Discord    |
| turn     | consensual  | room           | Group    | session     | orient     | Confusion  |
| watch    | collective  | world          | Space    | persistent  | observe    | Bureaucracy|
| week     | universal   | cosmos         | Universe | permanent   | aftermath  | Aftermath  |

**`SCOPE_TO_LADDER`**: a `Record<Scope5, Ladder5>` projection lives in `ast.ts`. Scope narrows the ladder to the state-ownership read.

**TW5 ↔ Verse resolution via OODA-HA pipeline phases:**

The apparent tension between TW5 (everything is `Record<string,string>`) and UEFN Verse (statically typed, execution-phase) resolves when read as pipeline phases:

| Phase      | Tool        | Type                       | Operation                          |
|------------|-------------|----------------------------|------------------------------------|
| Observe    | TW5 / wikitext | `Record<string,string>` | parse surface text; carry forward  |
| Orient     | `parseMemeCarrier` | `MemeAstNode[]`     | token tree, typed sigil nodes      |
| Decide     | `edgesFromAst` | typed attrs, `PranaEdge` | extract edge semantics             |
| Act        | Verse runtime | statically typed           | execute game logic                 |
| Aftermath  | `validatePranaEdge` | `PranaEdgeViolation[]` | violations surface, loop closes |

`attrs: Record<string,string>` is correct at Observe phase. "Parse, don't validate" (King 2019) and the blame calculus (Wadler & Findler) both say: parse at the boundary once, carry typed values through. The single parse path (`parsePranalaEdges` → thin shim over `parseMemeCarrier` + `edgesFromAst`) enacts this.

**Chronometer decoupling**: the FFZ Chronometer fantasy was useful as inspiration for discovering LADDER_5 as emergent, but the Chronometer itself is a rendering concern. LADDER_5 and OODA_HA_5 are grammar invariants, not clock state. They are `const` arrays in `ast.ts`, not timer types.

**Stances (Syad perspectives) + Tools (Chapel Perilous) as phase postures:**

Stances are epistemic standpoints that modulate how an operator reads a meme. Tools are orientation postures that modulate how an agent acts. Both are 5-point projections of OODA_HA_5.

| Stance         | Natural tool     | Jaina register         | Natural phase   |
|----------------|-----------------|------------------------|-----------------|
| 🏛️ Philosopher | `!` Sword        | propositional (asti)   | Decide          |
| 🌊 Poet         | `*` Wand         | resonance (avaktavya)  | Observe/Orient  |
| 🗡️ Satirist    | `*~` Wand+Pent.  | targeting (nāsti→asti) | Act             |
| 🎭 Humorist    | `?` Cup          | relational (asti-nāsti)| Orient/Decide   |
| 🔮 Private      | `~` Pentacle     | inward (avaktavya)     | Aftermath       |

Stances carry their natural tools, but an operator may hold any tool within any stance — the stance sets the register, the tool sets the zoom/feed posture. Canonical posture pairs (tool combinations): `*!` visual-micro, `*?` visual-macro, `~!` hidden-micro, `~?` hidden-macro, `--` neutral reset. Conflict states: `*~` Signal Jam (external/internal feed locked), `?!` Dubious Move (wide field asserts precision).

Both `STANCES` and `TOOLS` (with `TOOL_ASCII`) are const arrays in `ast.ts`. They are grammar-level invariants used by render and HUD layers; no parser wiring needed.

<<~/ahu >>

<<~ ahu #open-questions-limitations >>

## Open questions and limitationsThe largest open question is the lack of a public, formal `lararium-node` specification. I therefore treated `lararium-node` as a target architecture inferred from your brief and the repo’s own documents, not as a fully documented existing package.

I also did not inspect every narrative doc under `lares/ha-ka-ba/docs/lararium_mcp/**` or every CI workflow file in the repo. That means this report is strongest on code/config/tests/explicit architecture docs, and weaker on any undocumented operational conventions that may exist elsewhere in the tree.

Finally, the official MCP TypeScript SDK ecosystem is in a transitional period: the docs present a robust server model today, but the official repository also still warns that its v2 `main` branch is pre-alpha and that v1.x is the production recommendation. That does not block migration, but it is precisely why the MCP layer should remain thin and adapter-local. 

<<~/ahu >>

<<~ ahu #integrated-context-threads >>

## Integrated Context Threads

The sections above weave the newer Lararium context into roadmap planning.
This marker exists as a QA landmark for diff review.

Required context now present in-document:

- meme ontology replaces tiddler terminology in Lararium core language
- branch-local DAG walker exists and should be ported
- hostful `lar://alias:tier@host/...` records remain distinct from hostless `lar:///...` memes
- trust-tier ordering prevents Live-Session Overwrite
- green-jello-dinosaur becomes a named fixture and failure-mode test
- MCP adapter should surface trust-boundary conflicts instead of resolving them silently

<<~/ahu >>

<<~ ahu #milestone-8-progress >>

## Milestone 8 — Progress (2026-04-28)

### Parser + AST sprint (this session)

**kahea dual dispatch — Tension 4 closed:**

- ✓ `kahea` split into two regex entries in `parseMemeCarrier`: URI form (matches `lar:`, path `/`, fragment `#`) → `EdgeSugarNode { sigil:"kahea", family:"dataflow" }` — compile + render, dataflow edge. Name form (plain identifier, optional `name(args)`) → `SigilNode { sigilName:"kahea", attrs:{ name, args } }` — render-only, zero graph edge.
- ✓ `CANONICAL_SIGILS` includes `"kahea-call"` internal name; case dispatch in `buildAst`
- ✓ 12 tests: URI→EdgeSugar+edge, name→SigilNode+no-edge, args captured, wehe parameter interpolation, mixed carrier — all pass
- ✓ `parsePranalaEdges("<<~ kahea greeting >>")` → zero dataflow edges (invariant confirmed)

**ReactionGraph + live protocol:**

- ✓ `packages/lararium-core/src/live-protocol.ts` (new) — isomorphic WebSocket protocol types + `ReactionGraph` class
  - `LiveMsgSnapshot`, `LiveMsgDelta`, `LiveMsgEvent`, `LiveMsgFire`, `LiveClientMsg`, `LiveServerMsg`
  - `ReactionGraph`: `load(bindings)`, `subscribe(fromUri, trigger, handler)`, `fire(fromUri, trigger, payload)`
  - `extractReactionBindings(edges)` — filters `family:"reaction"` edges to `ReactionBinding[]`
- ✓ Exported from `@lararium/core` via `index.ts`

**UEFN file-watcher operational model (serve.ts):**

- ✓ `watch(LARES_ROOT, { recursive: true })` debounced 400ms — batch rapid editor auto-save bursts
- ✓ On change: evict room + delete SQLite → rebuild projection → reseed new room → rebuild reaction graph
- ✓ `broadcastToRoom(roomId, { type: "reseed", roomId })` — notify connected clients to reconnect
- ✓ Socket tagging: `ws._larariumRoomId` for targeted broadcast
- ✓ `buildReactionGraph(runtime)` reconstructs `ReactionGraph` from fresh boot artifact on each reseed

**Three-graph stances model (ast.ts):**

- ✓ `SYAD_7` 7 Jain predicates; `Syad7` type; `STANCE_SYAD: Record<Stance, Syad7>` natural register per stance
- ✓ `SATIRIST_OPERATIONAL: Syad7 = "nasti-avaktavya"` — P6 gradient marker
- ✓ `TOOL_FEED: Record<Tool, ToolFeed>` and `TOOL_APERTURE: Record<Tool, ToolAperture>` — two orthogonal tool axes
- ✓ `RENDER_MODES = ["reaction-wire"]` and `REACTION_ROLES = ["subscription","handler","callback"]`
- ✓ Grammar meme updated: `[[stances]]`, `[[predicates]]` (7 Syad), `[[tools]]` with `feed`/`aperture`
- ✓ `papalohe` render_mode and reaction family canonical_roles wired in spec

**Parity confidence assessment (complete):**

- TW5 compile/graph layer: ~0.90 — identity, tags, links, transclusion URI form, shadow, import, filter notation solid; `kahea` macro-call now ✓ at parse layer (SigilNode); wehe executor and render layer execution pending
- UEFN Verse graph layer: ~0.80 — entity/ECS, event wiring (papalohe), hot-reload (UEFN CRDT model), lifecycle:template solid; async concurrency (hui/heihei/puka), kukali/suspends, wehe call execution pending

### Also completed this session (2026-04-28)

**Async ReactionGraph (live-protocol.ts):**
- ✓ `ReactionHandler` type: `(binding, payload) => void | Promise<void>`
- ✓ `fire()` returns `Promise<void>` — awaits all handlers via `Promise.all`
- ✓ `fireAll()` alias for `fire()` — `hui` semantics
- ✓ `fireRace()` — `Promise.race`, first handler wins, rest continue — `heihei` semantics
- ✓ `fireRush()` — `Promise.any` + `AbortController` cancel signal — `puka` semantics
- ✓ `load()` placeholder handler bug fixed — no phantom no-op in handlers list
- ✓ `serve.ts` wired: browser `{ type:"fire", fromUri, trigger, payload }` → `reactionGraph.fire()` → `broadcastToRoom` event

**Widget tree + kumu type system (ast.ts, widget-tree.ts):**
- ✓ `KumuDef { name, params, carrierUri, body }` — compiled kumu type definition
- ✓ `WidgetNode { kind:"Widget", kumuName, def, resolvedProps, body }` — widget-tree node
- ✓ `KumuRegistry` class — `register/get/has/size/entries`
- ✓ `buildKumuRegistry(defs)` — convenience constructor
- ✓ `resolveWidgetTree(ast, registry): WidgetNode[]` — Phase 3 parse→widget pass
  - kahea name-form `SigilNode → WidgetNode { def }` (registered) or `{ def: null }` (typed hole)
  - Typed hole = Hazel semantics: unresolved kumu name stays live, partial edit doesn't crash
  - URI-form kahea (`EdgeSugarNode`) ignored — not a widget call
- ✓ `collectKumuDefs(carrierUri, ast): KumuDef[]` — extracts kumu sigil nodes from parsed carrier
- ✓ `BootArtifact.kumuDefs?: KumuDef[]` — field added; population deferred to Phase 3 compiler pass
- ✓ Exported from `@lararium/core` index
- ✓ 117/117 tests pass (23 new widget-tree tests + 9 async ReactionGraph tests)
- ✓ All packages typecheck clean

**Research synthesis recorded:**
- OMeta/Ohm bootstrap pattern: TypeScript parser = cold-start kernel (confirmed correct); grammar meme = extensions only
- Unison hash identity: our `lar:///` URIs + BootReceipt SHA is this pattern
- Hazel typed holes: `WidgetNode { def: null }` is the implementation
- Verse STM: canon-promotion ceremony must be transactional (write-back gate design confirmed)
- Eve failure (no stable identity + meta eats object): meme-immutability law + hash URIs is the defense

### Critical path forward (M8 close conditions)

1. ~~**ReactionGraph async**~~ ✓ shipped 2026-04-28 — `fire/fireAll/fireRace/fireRush` all async
2. ~~**kumu → widget-tree**~~ ✓ shipped 2026-04-28 — `KumuRegistry`, `resolveWidgetTree`, `collectKumuDefs`, typed holes
3. ~~**Wehe executor**~~ ✓ shipped 2026-04-28 — `kumu-executor.ts`: `executeKumu`, `executeBatch`, `substituteProps`, `detectSuspension`; 136/136 tests pass
4. ~~**BootArtifact.kumuDefs population**~~ ✓ shipped 2026-04-28 — `collectKumuDefsFromGraph()` wired in `node-host.ts`; `artifact.kumuDefs` populated with 5 kumu defs (meme-strategic → meme-action); `buildKumuRegistry(artifact.kumuDefs)` live at boot; `renderAllViews` receives registry; `templateProps` seeded from lares carriers not hardcoded defaults.
5. ~~**kukali**~~ ✓ shipped 2026-04-28 — `BOOTSTRAP_SCANS` entry, `attrsFromGroups` case, `CANONICAL_SIGILS` entry, grammar meme `[[sigils]]` entry, `\suspends` alias — all wired; 3 tests pass.
6. **Browser smoke** (Priority 1 from M8 original scope) — still pending.

**Behavioral invariant discovered during testing:** Unbound params in a kumu body are NOT silently empty — they propagate as typed holes (`unresolved-hole`). Callers that want "empty string for missing prop" must explicitly pass `paramName:""`. Verse alignment: no silent wrong output.

### Also completed this session (2026-04-28, post-M8-core)

**Socket port shapes + ownership skeleton (this session):**

- ✓ `LarTLSocket` record type + `socketShapeId()` ID function — stable arrow binding target, child of meme frame
- ✓ Socket port shapes emitted as `TLGeoShape` (ellipse, 8×8, opacity:0) — one per ahu slot per meme; `meta.socketKind:"port"`, `meta.centerX/Y` (meme header zone), `meta.spreadX/Y` (ahu frame center)
- ✓ All pranala arrows now bind to socket shapes, not ahu frames — bindings are CRDT-stable across all zoom levels
- ✓ `storyRiverLayout` computes `SocketGeometry { centerX, centerY, spreadX, spreadY }` per socket
- ✓ `applyZoomTemplate` two-pass: Pass 1 resizes meme frames + collects `memeIncludeAhu`; Pass 2 hides/shows ahu frames + ownership arrows; Pass 3 repositions socket shapes between center and spread
- ✓ Ahu detachment fix: ahu frames `isLocked:true` in emission + `opacity:0` at low zoom — prevents tldraw reparenting when meme frames shrink below ahu frame bounds
- ✓ Ownership skeleton arrows: 14 `control:owns` arrows per boot (7 meme→ahu + 7 meme→socket), `opacity:0`, `isLocked:true`, `meta.isOwnership:true`, `meta.ownsMemeId` for zoom toggling; shown at combat/action zoom alongside ahu frames
- ✓ `ownsArrowId(fromId, toId)` — stable ID function for ownership arrows
- ✓ `LarTLArrow.isOwnership?: boolean` — flag distinguishes skeleton arrows from pranala semantic arrows
- ✓ 229/229 tests green (was 226/226)

**TW5 / UEFN Verse child re-render research (this session):**

- ✓ TW5: push-on-change model — `changedTiddlers` map propagates down widget tree; each widget self-checks dependency; `$list` patches single-item add/remove without full rebuild; rapid changes coalesced. This is the target model for Lararium's CRDT delta → template refresh path.
- ✓ Verse: pull-on-demand model — explicit `SetText()` / method calls; no automatic child cascade; `subscribable` vars as reactive sources. This is the target model for the Kumu device layer in UEFN — explicit `papalohe` wiring, not reactive tree.
- ✓ Synthesis: CRDT delta event ≈ `changedTiddlers`; widget ownership skeleton ≈ TW5 widget tree; `applyZoomTemplate` on threshold crossing ≈ TW5 selective refresh; socket port shape repositioning ≈ DOM property update without re-render.

<<~/ahu >>

<<~ ahu #milestone-9-scope >>

## Milestone 9 — Widget Tree Render Pass + Canon Surface (Active)

M8 delivered the full kumu type pipeline bottom-up: AST → kumuDefs → KumuRegistry → templateProps → tldraw shapes. M9 closes the loop top-down: widget tree resolution feeds the render pass directly, grammar meme drives the parser dispatch table, and canon-promotion has a write-back surface.

### Priority 1: resolveWidgetTree render pass ✓ (shipped 2026-04-28)

**Shipped:**
- `kumu-react-render.tsx` — React render adapter extracted from `MemeDetailPanel`; pure function `renderCarrier(ast, widgetMap)` walks `WidgetNode[]` not raw `MemeAstNode[]`; kahea sigil nodes delegate to `widgetMap.get(node.pos)` for O(1) slot lookup; typed holes (no registry match) render as Hazel-style dashed placeholders; all 8 pranala families colored
- `render-target.ts` — explicit boundary contract: `RenderTargetAdapter` interface, `RENDER_TARGET_ADAPTERS` machine-readable registry, `WidgetSlot`, `buildWidgetMap`, `projectCarrier` (single-parse guarantee: one `parseMemeCarrier` + `resolveWidgetTree` per carrier; both adapters consume the result)
- `LarTLBodyNode[]` — tldraw structural skeleton: `text | widget | hole` body nodes emitted inside meme frames; opacity:0 until action zoom; toggled by `applyZoomTemplate` Pass 4 via `memeShowCarrier` map; widget nodes show `kumuName(k:v ...)` label (UEFN device slot — not executed); hole nodes render dashed grey
- `applyZoomTemplate` loop merge — Pass 1 builds both `memeIncludeAhu` and `memeShowCarrier` maps in one O(n) shapes scan; eliminates second meme-frame loop per zoom threshold crossing
- `TemplateCascade` type wired in `multi-view.ts` — TW5-style priority-ordered cascade: `CascadeEntry { match: MemeCascadePredicate | fn, override: Partial<MemeTemplateProps>, levels? }` evaluated per-meme against frame properties; `applyCascade()` called at `renderAllViews` time; first match wins per zoom level

### Priority 2: Browser smoke testing (pending)

All M5/M6/M7/M8/M9 tactile behaviors unverified. Playwright baseline:

- Drag meme frame → socket shapes follow (binding records verify); ahu frames stay locked
- Zoom threshold crossings → `applyZoomTemplate` fires; meme frame dims correct at each level
- Ownership arrows invisible at tactical/lower; visible (opacity 0.3) at combat/action
- Double-click meme frame → `MemeDetailPanel` slides up; carrier text renders from store with kumu-typed nodes
- ⌘K → Spaces + Memes sections; Enter navigates; Escape dismisses
- Canvas mode toggle → tldraw toolbar appears; Lararium chrome dims
- `/admin/reseed` → grammar carrier change takes effect without restart; lares/ watcher fires
- Action zoom → body node geo shapes appear inside meme frames (showCarrier gate)

### Priority 3: Spatial family registration ✓ (shipped 2026-04-28)

8th pranala family (`spatial`): roles `contains`, `portal`, `adjacent`, `layer` locked in `FAMILY_ROLES` (pranala-parser.ts). `validatePranaEdge` now emits `unknown-role` warning for out-of-vocabulary roles across all `roleRecommended` families. Color `"light-blue"` in tldraw `FAMILY_COLORS`. Unblocks portals-as-graph-edges (not just geo shapes with `meta.larPortal`).

### Priority 4: Canon-promotion surface

Write-back path: operator triggers "promote" from canvas → server validates against pranala schema → writes to `lares/` → recompile → reseed. Entry point: `PUT /admin/promote` with shape ID + proposed carrier text. Requires UCAN trust tier gate (operator+). Initial scope: metadata-only edits (name, IAM block fields), not full carrier authoring.

### Priority 5: Wiki-recipe carriers

`lares/recipes/` schema. Seed per-room canvases from recipe files. Format: `[[memes]]` TOML array with filter expression + seed layout. Unblocks `ftls`, `wtf`, and other RPG rooms.

<<~/ahu >>

<<~ ahu #design-decisions-async-first >>

## Design Decision: Async-First + Causal Islands

**Date:** 2026-04-28
**Pressure sources:** UEFN causal island model, FFZ Chronometer research, TW5 multiplayer history

### The decision

`ReactionGraph.fire()` MUST be async-first from the start. Not retrofitted later.

**Why:** TW5's multiplayer history and IPFS's content-addressed model both demonstrate that getting the causal model wrong at the base level is expensive to fix. UEFN avoids this via *causal islands*: each device runs in an isolated async boundary; events cross island boundaries only via declared ports (device graph edges — our `papalohe`). No shared mutable state across islands.

```
  causal island A          causal island B
  ┌──────────┐             ┌──────────┐
  │ kumu X   │──papalohe──▶│ kumu Y   │
  │          │  (async     │          │
  │ fire()   │   message)  │ handler  │
  └──────────┘             └──────────┘
```

The `ReactionGraph` IS the causal island manager. `fire(fromUri, trigger, payload)` returns `Promise<void>`. Handlers may `await`. Fanout modes:

| sigil | `ReactionGraph` mode | semantics |
|-------|---------------------|-----------|
| `hui` | `Promise.all` | all branches complete before proceeding |
| `heihei` | `Promise.race` | first completion wins, rest continue |
| `puka` | `Promise.any` + cancel | first wins, rest cancelled |
| `lele` | fire-and-forget (`void`) | no await, side effects permitted |

### FFZ Chronometer as causal timestamp

The FFZ Chronometer fragment (`#O0.O3.D2.A7`) encodes `{ scale: Ladder5, phase: OodaHa5, counter: number }`. In the async model, each `fire()` call carries an implicit causal timestamp derived from the Chronometer — not a wall-clock time, but a logical position in the OODA-HA loop.

This is the *why* behind decoupling Chronometer from grammar invariants: `LADDER_5` and `OODA_HA_5` are static arrays in `ast.ts`; the Chronometer generates a *live causal cursor* at runtime. They share vocabulary but live in different layers.

**Causal ordering law:** an event fired at `(scale: "action", phase: "act")` cannot causally precede an event in the same island at `(scale: "round", phase: "decide")`. The Chronometer encodes this ordering as a sortable fragment, not as a wall clock. CRDT CRDTs maintain causal ordering structurally; the Chronometer makes it readable.

### `kumu` as the widget-tree node type

**The user question: `kumu` as widget? OR parseTree→widgetTree→renderTree?**

Answer: Both. `kumu` IS the widget-tree node type definition — and the three-tree pipeline is the correct execution model.

TW5 pipeline:
```
tiddler text → parse tree (WikiParser) → widget tree (Widget subclass instances) → DOM
```

Lararium pipeline (target):
```
carrier text → MemeAstNode[] (parseMemeCarrier)
             → kumu-typed WidgetNode[] (widget-tree resolution)
             → tldraw shapes / rendered output
```

The *missing middle layer* is the widget tree. `parseMemeCarrier` produces `MemeAstNode[]` — a generic parse tree. The widget tree re-types each parse node into a `kumu`-typed node that knows its renderer. This is Phase 3 self-hosting:

- `<<~! kumu myCard(title body) >> ... <<~/kumu >>` defines a new node type
- `<<~ kahea myCard(title:Welcome) >>` (name form) emits a `SigilNode { sigilName:"kahea", attrs:{name:"myCard", args:"title:Welcome"} }`
- Widget-tree resolution walks the parse tree, matches each `SigilNode` against the registered `kumu` types, and emits a `WidgetNode { type: KumuDef, resolved: true, props: { title:"Welcome" } }`
- The render pass walks `WidgetNode[]`, not raw `MemeAstNode[]`

**UEFN device type = `kumu` causal island definition.** A UEFN `creative_device` is:
- A named type (`kumu`)
- With `@editable` properties (`kau` bindings in the kumu body)
- With event ports (`papalohe` edges on the device graph)
- Running in a causal island (async boundary)

`kumu` is both the TW5 widget type AND the UEFN device type. The same primitive. The three-tree pipeline and the causal island model are the same model at different layers.

### Implementation order

1. Make `ReactionGraph.fire()` return `Promise<void>` — zero-cost change; no callers await today
2. Add `fireAll` / `fireRace` / `fireRush` fanout methods
3. Build `KumuRegistry` — a `Map<string, KumuDef>` populated from the boot artifact's `kumu` sigil nodes
4. Add widget-tree resolution pass: `resolveWidgetTree(ast: MemeAstNode[], registry: KumuRegistry): WidgetNode[]`
5. Render pass reads `WidgetNode[]` instead of raw `MemeAstNode[]`

Steps 1–2 are pure `live-protocol.ts` changes. Steps 3–5 are the Phase 3 self-hosting pivot.

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ loulou lar:///LARARIUM-NODE/RESEARCH-SEED >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/meme >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/loci >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/invariant >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/lararium/lar-uri >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/signal/render-targets >>
<<~ loulou lar:///ha.ka.ba/docs/graph/traversal >>
<<~ loulou lar:///ha.ka.ba/docs/graph/pranala-parser >>

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #implements-loci ? -> lar:///ha.ka.ba/api/v0.1/pono/loci family:control role:implements >>
<<~ pranala #to-canvas-wiki ? -> lar:///LARARIUM-NODE/MULTIPLAYER-INFINITE-CANVAS-WIKI family:relation role:companion >>
<<~/ahu >>

<<~&#x0003; ahu #body-close >>
LARARIUM-NODE/ROADMAP closes
<<~/ahu >>

<<~&#x0004; -> ? >>
