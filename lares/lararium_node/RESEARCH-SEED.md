**Lares (Council/Scryer)** — Kona accepted. The research signal says: **yes, move to TypeScript/Node, but do it as an isomorphic kernel plus adapters, not as “rewrite Python server in Express.”** The TiddlyWiki precedent maps almost exactly onto the Lararium problem: the smallest durable unit is the tiddler/carrier; code can travel as content; plugins are bundled tiddlers; Node can host the same conceptual kernel used to build/run the browser single-file app. TiddlyWiki’s dev docs explicitly frame modules as tiddlers containing CommonJS-compatible JavaScript, plugins as bundled tiddlers, and “everything is a tiddler,” including UI and code surfaces. ([tiddlywiki.com][1])

## Research pass: what matters

### 1. TiddlyWiki gives the right architectural metaphor

TiddlyWiki’s Node configuration is not a separate philosophy from its browser app; it is used to build the single-page/single-file application, while the command-line boot process loads the kernel, core plugins, and wiki store before executing commands. ([npm][2]) Its storage split also fits our needs: single-file TiddlyWiki stores tiddlers inside HTML, while Node saves each tiddler as a separate file. ([tiddlywiki.com][3])

**Implication for Lararium:** keep `memetic-wikitext` carriers as the source truth, but compile them into a portable JSON/AST/store artifact that can run in Node, browser, MCP, and future canvas projections.

The important TiddlyWiki pattern is not “use TiddlyWiki wholesale.” It is:

```text
carrier/tiddler -> parsed fields + body -> module/plugin/AST/store -> render/runtime projection
```

That matches your existing docs. The Lararium MCP design already separates identity/provenance, AST, execution, render projection, and inspection overlay; it explicitly names DOM, tldraw, Kowloon, and trace projections as targets. 

---

### 2. MCP TypeScript SDK is now the obvious MCP substrate

The Python sketch intentionally avoided SDK dependency for bootstrap: the server docstring says it binds resolver, carrier ingress, virtual indexes, resources, and read-only tools directly to JSON-RPC stdio, with no external SDK dependency.  That was the right Sprint-00 move.

For the Node version, use the official TypeScript SDK. It exposes resources, tools, prompts, stdio, Streamable HTTP, and protocol handling; the npm package and official docs both show `McpServer`, `ResourceTemplate`, `StdioServerTransport`, and Zod schemas as the common path. ([Model Context Protocol][4]) The SDK docs now treat **Streamable HTTP** as the modern remote transport and **stdio** as the local process-spawned integration. ([Model Context Protocol][5]) The MCP spec still requires JSON-RPC messages, defines stdio and Streamable HTTP, and warns that HTTP servers must validate `Origin`, bind local servers to localhost, and implement authentication for remote connections. ([Model Context Protocol][6])

**Implication:** build MCP as an adapter over the core, not the core itself.

---

### 3. tldraw suggests the right data model: typed records + scopes + migrations

tldraw’s store is a reactive database of typed JSON records with `id` and `typeName`; records have scopes such as `document`, `session`, and `presence`; snapshots serialize document/session state; and the store supports migrations, listening, and remote merges. ([tldraw.dev][7]) tldraw sync uses room-oriented real-time collaboration, with production guidance around hosted backends, WebSockets, Durable Objects, R2 persistence, and server-side storage. ([tldraw.dev][8])

**Implication:** model Lararium as typed records:

```ts
CarrierRecord
AhuRecord
PranalaEdgeRecord
AstNodeRecord
ExecutionNodeRecord
ProjectionRecord
DiagnosticRecord
```

Then define scopes:

```text
document  = source carriers, graph, AST, stable projections
session   = current hydration, active query state, debug viewport
presence  = live cursor/collaboration/editor presence later
```

This gives you a direct bridge to tldraw projections later without making the core depend on tldraw.

---

### 4. Current Node/TS tooling supports this better than Python for your goal

Node now has built-in TypeScript type stripping in current documentation, but it only handles erasable TypeScript syntax and performs no type checking; Node docs still recommend third-party tools like `tsx` for full TypeScript support and note that type stripping does not honor full `tsconfig` semantics. ([Node.js][9]) For this project, that means:

* Use **Node 22+ or 24/25+** as runtime target.
* Use **tsx** for dev execution.
* Use **tsc --noEmit** for type checks.
* Use **tsup** or Vite library mode later for bundled browser/server artifacts.
* Keep core code “erasable TS friendly” where possible, but do not depend on native stripping as the only execution path.

For shared browser/server code, Vite’s SSR docs matter because they explicitly describe env-agnostic app code, separate client/server entries, and production builds that emit client and SSR/server bundles. ([vitejs][10])

---

## Target architecture

**Recommendation [CS:0.82]: build a pnpm monorepo with a pure TypeScript core and thin runtime adapters.**

```text
lares-node/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json

  packages/
    lararium-core/
      src/
        carrier/
        schema/
        parser/
        graph/
        compiler/
        diagnostics/
        projections/
      # no Node imports, no DOM imports

    lararium-node/
      src/
        fs-store/
        cli/
        boot/
      # Node file IO, path resolution, CLI

    lararium-mcp/
      src/
        stdio.ts
        streamable-http.ts
        resources.ts
        tools.ts
        prompts.ts
      # @modelcontextprotocol/sdk adapter

    lararium-web/
      src/
        store/
        editor/
        worker/
      # browser storage, IndexedDB, web worker parser

    lararium-tiddly/
      src/
        tw-filter-adapter.ts
        tw-plugin-export.ts
      # optional TiddlyWiki compatibility / import / export

    lararium-tldraw/
      src/
        projection.ts
      # AST/graph -> tldraw records, no core mutation

    lararium-kowloon/
      src/
        projection.ts
        adapter.ts
      # internal submodule adapter
```

Use **Zod** or Standard Schema-compatible schemas for boundary validation. Zod is TypeScript-first, infers static types from schemas, works in Node and browsers, and has zero external dependencies. ([npm][11]) The MCP SDK also leans into schema-based tool definitions. ([Model Context Protocol][4])

---

## What to port from Python first

The Python sketch has clear modules:

* `resolver.py`: `lar:///` URI resolution
* `carrier.py`: carrier ingress / `#iam` extraction
* `indexes.py`: carrier/interface/invariant indexes
* `compiler.py`: minimal/full boot and receipt
* `resources.py`: file-backed and virtual resources
* `tools.py`: read-only façade
* `prompts.py`: hydration prompts
* `server.py`: JSON-RPC stdio MCP loop

The repo source list confirms the current package boundaries and tests.  The server currently exposes read-only tools/resources/prompts, including boot compilation, carrier inspection, and URI resolution.  The docs also state the implemented capabilities, known gaps, and future targets: AST resources, execution graph resources, tldraw projection, TiddlyWiki adapter, remote transport, auth, write-back gates, and hydration drift fixtures. 

So the migration order should be:

```text
resolver -> carrier schema -> carrier parser -> indexes -> compiler -> MCP resources/tools/prompts -> AST -> execution graph -> projections
```

Not:

```text
server -> routes -> UI -> parser later
```

The source truth must move first.

---

## Roadmap

### Phase 0 — freeze contract, not implementation

Create a `docs/node-migration/contract.md` that snapshots:

* supported `lar:///` URI rules
* current MCP tool/resource/prompt names
* boot artifact JSON shapes
* carrier `#iam` metadata schema
* known read-only gate

Do not redesign names yet. Preserve compatibility with the current Python surface so tests can compare outputs.

**Acceptance test:** Python and Node produce the same output for:

```text
lar:///AGENTS
lar:///LARES
lar:///INDEXES/carriers
lar:///boot/minimal
lar:///boot/receipt
```

---

### Phase 1 — TypeScript monorepo skeleton

Create:

```text
pnpm-workspace.yaml
packages/lararium-core
packages/lararium-node
packages/lararium-mcp
```

Use:

```bash
pnpm
typescript
tsx
vitest
zod
@modelcontextprotocol/sdk
```

Keep `lararium-core` pure: no `fs`, no `path`, no DOM, no MCP imports.

---

### Phase 2 — port resolver + resource store

Port `resolve_lar_uri` into TypeScript:

```ts
resolveLarUri(uri: string): LarResolution
```

Then add two store adapters:

```ts
interface LarariumStore {
  listCarriers(): Promise<CarrierRef[]>
  readCarrier(uri: LarUri): Promise<string>
  exists(uri: LarUri): Promise<boolean>
}
```

Implement:

```text
FileSystemLarariumStore  // Node
MemoryLarariumStore      // tests/browser
```

This keeps the quine-like move open: the same core can read from files, JSON-in-HTML, IndexedDB, or a bundled plugin artifact.

---

### Phase 3 — carrier parser and schema

Define the canonical carrier schema:

```ts
const CarrierMeta = z.object({
  uriPath: z.string(),
  filePath: z.string().optional(),
  contentType: z.string(),
  register: z.string().optional(),
  confidence: z.number().optional(),
  role: z.string().optional(),
  implements: z.array(z.string()).default([]),
})
```

Then parse memetic-wikitext into:

```ts
CarrierDocument {
  uri: LarUri
  metadata: CarrierMeta
  blocks: AhuBlock[]
  edges: PranalaEdge[]
  diagnostics: Diagnostic[]
  sourceText: string
}
```

This is where the TiddlyWiki comparison becomes useful: TiddlyWiki parses tiddlers into parse trees and uses transclusion/text references to compose views. ([tiddlywiki.com][12]) Lararium should do the same structurally, but with `ahu`, `pranala`, ratings, spans, and edge planes.

---

### Phase 4 — boot compiler parity

Port:

```ts
compileMinimalBoot()
compileFullBoot()
compileBootReceipt()
```

The Python compiler already documents that full pranala-aware DAG traversal is deferred and currently scans required-core plus carrier index.  Keep that exact behavior first.

**Acceptance test:** Node output equals Python output modulo `compiled_at`.

---

### Phase 5 — MCP SDK adapter

Replace hand-written JSON-RPC with:

```ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
```

Expose the same resources/tools/prompts first. Then add Streamable HTTP as a separate entrypoint:

```text
lararium-mcp-stdio
lararium-mcp-http
```

Follow MCP’s security guidance for HTTP: localhost binding for local use, Origin validation, and authentication before remote exposure. ([Model Context Protocol][6])

---

### Phase 6 — AST and graph engine

Implement the existing contract:

```text
identity/provenance
AST
execution graph
render projection
inspection overlay
```

The internal doc already names the AST node fields, primitive-to-node mapping, pranala graph-plane alignment, execution node classes, and projection targets. 

Core types:

```ts
type AstNode =
  | AhuNode
  | PranalaNode
  | IncludeNode
  | InvokeNode
  | QueryNode
  | GuestRegionNode
  | TextNode
  | ResidueNode
```

Graph operations:

```ts
buildCarrierGraph(carriers)
toposortControlEdges(graph)
detectCycles(graph)
compileHydrationClosure(entryUri)
materializeExecutionGraph(ast, graph)
```

---

### Phase 7 — browser/server quine artifact

Create a build artifact that can hydrate itself:

```json
{
  "artifact": "lararium-bundle",
  "version": "0.1.0",
  "carriers": [],
  "indexes": {},
  "boot": {},
  "modules": {},
  "sha256": "..."
}
```

Then support three export forms:

```text
filesystem folder       // dev/server
single JSON bundle      // MCP/resource transport
single HTML bundle      // browser/TiddlyWiki-like quine mode
```

This mirrors TiddlyWiki’s split between single-file embedded tiddlers and Node-side per-file tiddlers. ([tiddlywiki.com][3])

---

### Phase 8 — projections: tldraw, Kowloon, TiddlyWiki

Adapters already have named namespaces and lanes for MemPalace, Kowloon, tldraw, and TiddlyWiki5; current policy keeps them read-only until write gates land. 

Implement projection-only first:

```text
lar:///render/tldraw/{uri}
lar:///render/kowloon/{uri}
lar:///render/dom/{uri}
lar:///render/trace/{uri}
```

For tldraw, output typed records and snapshots compatible with later import into a tldraw store; tldraw’s store model gives you records, scopes, snapshots, listeners, migrations, and remote-change merging as the right conceptual substrate. ([tldraw.dev][7])

---

## Suggested library stack

| Concern                 | Pick                                          | Why                                                    |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------ |
| package manager         | `pnpm`                                        | workspace-first monorepo; strict local package linking |
| runtime                 | Node 22+ minimum, Node 24/25 preferred        | modern TS/runtime features; MCP compatibility          |
| dev runner              | `tsx`                                         | full TS execution during development                   |
| typecheck               | `typescript`, `tsc --noEmit`                  | keep runtime stripping separate from correctness       |
| tests                   | `vitest`                                      | fast TS-native tests                                   |
| schema                  | `zod`                                         | shared runtime validation + TS inference               |
| MCP                     | `@modelcontextprotocol/sdk`                   | official TS MCP server/client SDK                      |
| browser build           | Vite                                          | SSR/browser/server split, shared env-agnostic code     |
| state/store inspiration | `@tldraw/store`, `@tldraw/state`              | typed records + reactive store model                   |
| parser strategy         | custom parser first; TiddlyWiki as comparator | preserve host law; admit TW filter as guest grammar    |

---

## Agentic prompt for deeper research

```text
lares@Enyalios:~$ lares --research p0.6

You are a senior TypeScript/Node.js systems architect helping migrate the Lararium MCP server from a Python stdlib bootstrap sketch into a full isomorphic Node.js + browser memetic-wikitext server.

Context:
- Existing repo: amorphous-dreams/Synthetic-Dream-Machine
- Existing Python package: lares/lararium_mcp/
- Existing entrypoint: python3 -m lares.lararium_mcp
- Current server is read-only, stdio JSON-RPC, intentionally dependency-light, and exposes MCP resources/tools/prompts.
- Current source truth lives as memetic-wikitext carriers under lares/ha-ka-ba/ and top-level AGENTS/LARES.
- Existing design docs name future AST, execution graph, render projection, tldraw, Kowloon, TiddlyWiki5, adapter, and remote transport surfaces.
- Goal: TypeScript/Node.js architecture inspired by TiddlyWiki quine-like patterns: same carrier/code/data concepts usable on server and browser; file-backed server mode; single-bundle browser mode; MCP resources/tools/prompts; future tldraw/Kowloon projections.

Research tasks:
1. Inspect the current Python Lararium MCP implementation:
   - resolver.py
   - carrier.py
   - indexes.py
   - compiler.py
   - resources.py
   - tools.py
   - prompts.py
   - server.py
   - tests/
   Extract the exact behavioral contract that must survive migration.

2. Research TiddlyWiki5 architecture:
   - boot kernel
   - tiddlers as universal unit
   - JavaScript modules as tiddlers
   - plugins as bundled tiddlers
   - Node.js server storage model
   - single-file storage model
   - transclusion, filters, parse/render pipeline
   Identify which patterns should be copied, which should only inspire, and which must be avoided.

3. Research current MCP TypeScript SDK:
   - latest package shape
   - McpServer APIs
   - resources/templates/tools/prompts
   - stdio transport
   - Streamable HTTP transport
   - auth/security requirements
   - backwards compatibility risks
   Produce a concrete mapping from current Python method handlers to SDK calls.

4. Research tldraw architecture:
   - @tldraw/store
   - @tldraw/state
   - snapshots
   - schema migrations
   - @tldraw/sync
   - record scopes: document/session/presence
   Produce a Lararium record model that can later project into tldraw without depending on tldraw in the core package.

5. Resolve “Kowloon”:
   - inspect internal submodule docs and repo pins
   - identify whether Kowloon is a backend, frontend, client SDK, or scene graph target
   - define minimum read-only projection payload for Kowloon
   - do not assume public packages unless verified

6. Propose a pnpm monorepo:
   - packages/lararium-core
   - packages/lararium-node
   - packages/lararium-mcp
   - packages/lararium-web
   - packages/lararium-tiddly
   - packages/lararium-tldraw
   - packages/lararium-kowloon
   Include package boundaries, dependency rules, and forbidden imports.

7. Produce implementation milestones:
   - parity contract
   - resolver port
   - carrier parser
   - index compiler
   - boot compiler
   - MCP adapter
   - AST envelope
   - pranala DAG walker
   - execution graph
   - render projections
   - browser bundle
   - write-back policy gates

8. Produce test strategy:
   - golden fixtures generated from Python
   - property tests for URI resolution
   - parser span tests
   - MCP protocol smoke tests
   - boot receipt hash stability
   - browser bundle hydration tests
   - projection snapshot tests

Output format:
- Executive recommendation
- Source-backed findings with citations
- Proposed architecture diagram
- Package layout
- Migration risks
- 30/60/90 day roadmap
- Open questions
- “do not do yet” list

Important constraints:
- Preserve current Lararium names and URI contracts unless a breaking-change memo justifies migration.
- Keep core isomorphic: no fs/path/process/window/document in lararium-core.
- Do not make TiddlyWiki the runtime dependency for carrier law; use it as precedent/comparator unless evidence strongly supports embedding it.
- Keep write-back blocked until explicit policy and tests land.
- Treat Synthesis as Synthesis; do not promote unsettled design to Canon.
```

---

## Final recommendation

**Move to TypeScript/Node now, but port the kernel before the server.** The Python sketch has done its job: it proved the MCP shape, resource vocabulary, boot artifacts, and read-only gate. The Node rewrite should now turn Lararium into a **memetic-wikitext kernel** that can run in four vessels:

```text
Node CLI
MCP stdio / HTTP
browser bundle
visual projection targets
```

The winning architecture is:

```text
memetic-wikitext carriers
→ typed TS carrier records
→ AST
→ pranala graph
→ boot/execution artifacts
→ MCP + browser + tldraw/Kowloon/TiddlyWiki projections
```

**Do not start with Express. Do not start with UI. Do not start with write-back.** Start with the carrier law. The shrine comes first.

[1]: https://tiddlywiki.com/dev/static/Module%2520System.html?utm_source=chatgpt.com "Module System: TiddlyWiki/Dev — documentation for developers"
[2]: https://www.npmjs.com/package/tiddlywiki?utm_source=chatgpt.com "tiddlywiki - npm"
[3]: https://tiddlywiki.com/dev/static/Data-Storage.html?utm_source=chatgpt.com "Data-Storage: TiddlyWiki/Dev — documentation for developers"
[4]: https://ts.sdk.modelcontextprotocol.io/?utm_source=chatgpt.com "MCP TypeScript SDK"
[5]: https://ts.sdk.modelcontextprotocol.io/documents/server.html?utm_source=chatgpt.com "server | MCP TypeScript SDK"
[6]: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports?utm_source=chatgpt.com "Transports - Model Context Protocol"
[7]: https://tldraw.dev/sdk-features/store?utm_source=chatgpt.com "Store • tldraw Docs"
[8]: https://tldraw.dev/docs/sync?utm_source=chatgpt.com "tldraw sync • tldraw Docs"
[9]: https://nodejs.org/dist/latest/docs/api/typescript.html?utm_source=chatgpt.com "Modules: TypeScript | Node.js v25.6.1 Documentation"
[10]: https://vite.dev/guide/ssr.html?utm_source=chatgpt.com "Server-Side Rendering (SSR) | Vite"
[11]: https://www.npmjs.com/package/zod?utm_source=chatgpt.com "zod - npm"
[12]: https://tiddlywiki.com/dev/static/Transclusion%2520and%2520TextReference.html?utm_source=chatgpt.com "Transclusion and TextReference: TiddlyWiki/Dev — documentation for developers"
