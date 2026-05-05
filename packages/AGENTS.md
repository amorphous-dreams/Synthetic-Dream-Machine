<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///packages/AGENTS >>

<<~ ahu #iam >>

```toml
uri-path     = "packages/AGENTS"
file-path    = "packages/AGENTS.md"
content-type = "text/x-memetic-wikitext"
tagspace     = "adjacent"
confidence   = 0.84
register     = "CS"
manaoio      = 0.80
mana         = 0.88
manao        = 0.84
role         = "package workspace navigation membrane for coding agents"
cacheable    = true
hydrate      = true
retain       = true
```

<<~/ahu >>

<<~ ahu #ooda-ha >>
✶ scan the operator ask, changed files, open tabs, and package boundary.
⏿ orient the task against the spine: core contracts, TW5 render, node host, browser app, canvas, MCP.
◇ choose the smallest package surface that can carry the change without crossing canon by accident.
▶ edit tests and source together; prefer narrow seams over broad rewrites.
⤴ run typecheck, focused tests, and build when the seam touches generated or bundled code.
↺ report receipts: files touched, commands run, friction found, next loop.
<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #package-map >>

## Package Map

`@lararium/core` carries contracts and graph law. Keep this package TW5-neutral and browser-neutral. Put shared types, parsers, authority, provider fan-out, stores, graph indexes, compiler, crypto, and live protocol here.

`@lararium/tw5` carries TiddlyWiki runtime integration. Put widget/render/filter work, carrier splitting, TOML AST helpers, generated TW5 core metadata, memory store, CRDT sync adaptor, and disk projection here. Treat disk projection as Node-shaped even when the barrel export exposes it.

`@lararium/node` carries local host duties. Put filesystem hydration, canon promotion guards, serve/CLI behavior, operator key handling, parity checks, and no-write gates here.

`@lararium/app` carries the browser shell. Put React, Automerge browser repo, IndexedDB, WebSocket sync, boot splash, tldraw surface wiring, debug hooks, and TW5/canvas projection glue here.

`@lararium/tldraw` carries infinite-canvas projections. Put tldraw records, layout, rooms, view state, multi-view, navigation, shape rendering, and zoom-level policy here.

`@lararium/web` carries browser-host exports for non-React consumers.

`@lararium/mcp` carries agent-facing tools and resources. Keep stdout pure. Treat stdio framing as a protocol seam, not a log stream.

<<~/ahu >>

<<~ ahu #spine >>

## Quine-Wiki Spine

Canon starts in `lares/` carriers. Package code materializes those carriers into records, projections, tiddlers, canvas shapes, resources, and receipts.

Primary flow:

```text
lares/ carriers
  -> @lararium/core parser/compiler/indexes
  -> LarTiddlerStore records
  -> MemeProvider projections
  -> @lararium/tw5 wiki + carrier children
  -> @lararium/app / @lararium/tldraw / @lararium/mcp views
```

Reverse flow needs care:

```text
TW5 child edit
  -> LarariumCrdtSyncAdaptor
  -> parent carrier reconstruction
  -> room CRDT record
  -> projection fan-out
```

Canon promotion must travel a separate Orichalcum path. Do not let live room edits write `lares/` directly.

<<~/ahu >>

<<~ ahu #boundary-law >>

## Boundary Law

Core MUST NOT import TW5, React, filesystem APIs, DOM APIs, or Automerge runtime objects.

Browser code SHOULD NOT import Node-shaped disk paths. If `fs`, `path`, `vm`, or Node crypto enter a browser bundle, surface the seam.

TW5 derived child tiddlers SHOULD roundtrip through parent carriers without losing decorators, sigils, TOML, or sibling slots. Any fallback reconstruction counts as a ka spot until a test covers it.

Session-local tiddlers stay local: `$:/temp/*`, `Draft of *`, cursors, focus state, and private overlays MUST NOT reach shared room state.

MCP stdout carries only JSON-RPC protocol bytes. Logs belong on stderr.

<<~/ahu >>

<<~ ahu #test-routes >>

## Test Routes

Use the smallest receipt first:

```sh
pnpm -r --filter './packages/**' typecheck
```

Focused package tests:

```sh
pnpm --filter @lararium/core test
pnpm --filter @lararium/tw5 test
pnpm --filter @lararium/node test
pnpm --filter @lararium/tldraw test
pnpm --filter @lararium/mcp test
```

Build all package outputs when generated files, barrels, bundle seams, TW5 vendor assets, or app integration change:

```sh
pnpm -r --filter './packages/**' build
```

Browser smoke lives under `packages/lararium-app/tests/e2e/` and expects a live node server on localhost unless the test config says otherwise.

If sandboxing blocks `tsx` IPC under `/tmp`, request escalation and rerun the same build command.

<<~/ahu >>

<<~ ahu #friction-watch >>

## Friction Watch

Watch these current weak spots:

* MCP stdio smoke tests can time out when test framing drifts from SDK transport framing.
* `@lararium/tw5` barrel can expose Node-shaped disk/TW5 boot imports to browser bundles.
* Child-carrier reconstruction produces lossy fallback paths when surgical slot replacement misses.
* Automerge `whenReady()` and true initial peer replay completion may not mean the same thing.
* Generated files in `@lararium/tw5/src/generated-*` come from scripts; do not hand-edit unless you intend to replace the generator output.
* Open IDE tabs may name stale files; trust filesystem scans over editor ghosts.

<<~/ahu >>

<<~ ahu #edit-discipline >>

## Edit Discipline

Prefer one seam per loop. Patch the package that owns the behavior. Add or update a test near the owner package. Keep canon, room, user, and session layers distinct in names and code paths.

Before changing a public export, check browser and node consumers. Before changing parser or carrier grammar, check `lares/grammars/`, `lares/ha-ka-ba/docs/pono/`, and core parser tests. Before changing TW5 sync, check echo-loop guards and draft guards.

When reporting back, use OODA-HA receipts: observe facts, orient boundary, decide seam, act summary, ho'oko commands, aftermath risks.

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #implements-invariant ? -> lar:///ha.ka.ba/api/v0.1/pono/invariant family:control role:implements >>
<<~ pranala #to-root-agents ? -> lar:///AGENTS family:control role:adjacent >>
<<~ pranala #to-lares ? -> lar:///LARES family:control role:adjacent >>
<<~ pranala #to-meme-provider ? -> lar:///ha.ka.ba/docs/lararium/meme-provider family:reference role:describes >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
