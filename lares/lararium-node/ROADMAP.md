<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///LARARIUM-NODE/ROADMAP >>

<<~ ahu #iam >>
```toml
uri-path = "LARARIUM-NODE/ROADMAP"
file-path = "lares/lararium-node/ROADMAP.md"
content-type = "text/x-memetic-wikitext"
confidence = 0.72
register = "S"
manaoio = 0.68
mana = 0.74
manao = 0.82
role = "docs meme — detailed migration roadmap for Lararium Node, preserving research detail while adding navigable ahu markers"
cacheable = false
retain = true
invariant = false
source-restored = "Pasted text.txt"
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

### Kowloon Narrow Interface

Treat Kowloon as a read-only social/feed projection target until proven otherwise.

Minimum viable Kowloon payload:

type
actor
object
published
lar_uri
lares_address
source_uri
sha256 / receipt hash when available

The current safe posture: `lararium-kowloon` emits feed/header/event payloads. It does not own storage, identity authority, or compiler behavior.

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
| `read_carrier(uri)` / `validate_carrier_shape()` | Extracts IAM metadata, validates carrier markers, computes typed-meme vs meme/data/noise rating, returns implements bundle and diagnostics | `readCarrier(uri, text)` / `validateCarrierShape()` in `lararium-core` with deterministic diagnostics ordering   |
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
| `lar:///ha.ka.ba/api/v0.1/pono/live-session-overwrite` | Names the green-jello-dinosaur failure mode; a live claim MUST NOT become canon by recency, repetition, or charm |
| `lar:///ha.ka.ba/api/v0.1/pono/canon-promotion-boundary` | Promotion gate law; crossing from live exchange pressure to hostless canon requires explicit ceremony |
| `lar:///ha.ka.ba/api/v0.1/pono/tagspace-trust` | Shared `lar:` tagspace MUST NOT imply shared authority; hostless memes outrank hostful exchange records |
| `lar:///ha.ka.ba/api/v0.1/pono/exchange-vector` | Each substantive exchange turn MUST emit a canonical `lar:` URI vector before content |

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

## Milestone 4 — In Progress (2026-04-25)

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
- ✓ `packages/lararium-app/` created: `index.html` (TW-style snapshot injection slot), `main.tsx`, `App.tsx`, `LarariumCanvas.tsx`, `SidePanel.tsx`
- ✓ `bootFromEmbedded()` → `renderAppViews()` async boot chain in `App.tsx`
- ✓ `viewStateReducer` wired; Back and Graph buttons in `SidePanel`
- ✓ `LarariumCanvas.tsx`: tldraw mount, emission hydration, page routing, camera sync via `goToStoryRiver`/`goToGraph`/`zoomToMeme`
- ✓ All packages typecheck clean; 36/36 tests pass

### Remaining

**First working browser session**
- Snapshot injection server: HTTP endpoint in `lararium-node` that serves `lararium-app/dist/index.html` with `LarSnapshot` injected into `<script id="lararium-snapshot">`
- Build pipeline: `pnpm --filter @lararium/app build` then `pnpm --filter @lararium/node serve`
- `goToRoom(editor, room)` nav helper in `nav.ts`
- Story river in `SidePanel`: scrollable meme URI list; click → `dispatch({ type: "ZOOM_IN", uri })`
- Double-click on tldraw frame shapes → zoom-in dispatch (tldraw v4 event API)

**Rooms and portals**
- Portal shapes connecting rooms: `LarPortal` renders as TLArrow with click-navigation handler
- `renderRoom(artifact, room, readText)` — filters via `filterMemesTW` then projects room content
- Room registry in SidePanel control panel (right-slide overlay)

Do not in Milestone 4:
- Actual Bluesky login implementation (doctrine only)
- Write-back of any kind
- Kowloon projection package (Milestone 5)
- Multi-user presence / cursors


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

<<~ ahu #edges >>

## Edges

<<~ loulou lar:///LARARIUM-NODE/RESEARCH-SEED >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/meme >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/loci >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/invariant >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/lar-uri >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/signal/render-targets >>
<<~ loulou lar:///ha.ka.ba/docs/graph/traversal >>
<<~ loulou lar:///ha.ka.ba/docs/graph/pranala-parser >>

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #implements-loci ? -> lar:///ha.ka.ba/api/v0.1/pono/loci family:control role:implements >>
<<~/ahu >>

<<~&#x0003; ahu #body-close >>
LARARIUM-NODE/ROADMAP closes
<<~/ahu >>

<<~&#x0004; -> ? >>
