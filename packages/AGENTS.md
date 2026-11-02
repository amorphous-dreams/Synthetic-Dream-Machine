<<^ code=`&#x0001;` from=`?` to=`lar:///packages/AGENTS`>>

<<~ ahu slot=`#meta`>>

```toml
uri-path     = "packages/AGENTS"
content-type = "text/memetic-wikitext+tiddlywiki"
l-space      = "adjacent"
manaoio      = 16
mana         = 18
manao        = 17
role         = "package workspace navigation shore for coding agents"
cacheable    = true
hydrate      = true
retain       = true
```

<<~/ahu>>

<<~ ahu slot=`#ooda-ha`>>
✶ scan the operator ask, changed files, open tabs, and package boundary.
⏿ orient the task against the spine: mesh contracts, TW5 VM, node host, browser vessel, caps, operator CLI.
◇ choose the smallest package surface that can carry the change without crossing canon by accident.
▶ edit tests and source together; prefer narrow shores over broad rewrites.
⤴ run typecheck, focused tests, and build when the shore touches generated or bundled code.
↺ report receipts: files touched, commands run, friction found, next loop.
<<~/ahu>>

<<^ code=`&#x0002;`>>

<<~ ahu slot=`#network-topology`>>

## Network Topology (canonical)

**Lararium** — an operator-held DreamNet peer whose device-and-context composes the persona and document-owning capability stack. A Node-surface or Web-surface assembly can carry that stack; package or process names never confer it. A persona-less assembly can instead hold the Herm floor. Lararia, Herms, and other named-capability peers meet across explicit crossings without a client/server rank.

**Nexus** — a confederated mesh of Lararia sharing a stable internal sync network. Named by community + place (e.g. "Floating Library of Mu, PNW Branch"). The Nexus keypair carries the confederation.

**DreamNet** — the overall super-mesh of all Nexuses: allied, neutral, and oppositional. Opposition lives by design. Cross-Nexus connections travel through explicit brokers and tolerate degraded state.

Within-Nexus sync = Automerge CRDT (reliable). Cross-Nexus = explicit treaty, wild-magic-zone hops (unreliable).

<<~/ahu>>

<<~ ahu slot=`#package-map`>>

## Package Map (active)

Eight packages carry the stack. Each owns one boundary; cross-cutting work travels through the contracts in `@lararium/mesh`.

**This map names boundaries, never files.** A file inventory here rots the moment the tree moves, and a stale inventory misleads worse than none — read the package's own `src/` for what lives in it.

`@lararium/mesh` carries contracts and graph law. Keep this package TW5-neutral, browser-neutral, and Node-neutral. Shared types, `lar:` URI resolution, capability schemas, the Automerge/composite store law, residency tiers, recipes, causal-island + island-protocol, and the session gradient parser live here. Mesh owns the island `Repo` factory (`makeIslandRepo`); the vessel-opening packages (`node`, `browser`) construct the vessel's own `Repo`. `@lararium/tw5` and `@lares/cli` hold **zero** `@automerge` dependencies — keep it that way.

`@lararium/tw5` carries TiddlyWiki runtime integration: the TW5 VM surface, the island layer, the memetic-wikitext machinery, the verb pipeline, TW5-side stores, and the TW5 wikirules/macros/modules/filters. Holds zero `@automerge` dependencies. Treat disk projection as Node-shaped even when the barrel export exposes it.

`@lararium/node` carries Node-surface capability atoms: local process boot, island plumbing, bag-path + residency law, boot artifacts, the wiki composition family, disk projection, the UDS verb-channel, relay ingress, and the flow read-face. A Node-surface assembly can compose a persona-bearing Lararium stack or a persona-less Herm stack; its process name does not decide that. The runtime **finds**; it never seeds social state. No truth lives on the main thread: every authoritative engine and store runs in a worker; the main-thread mirror (DreamDOM D3) is unprivileged: it holds no keys and no truth, boots only through one private door that takes the D2 port binding, and is fed by that port alone.

### Pronaos arrival/bootstrap projection (P0 inventory)

The Pronaos carries one local Herm/Lararium composition's finite first face. It may expose an exact index,
worker/assets, optional install manifest, `genesis/seed.json`, and seed-named genesis CAS members. This remains a
capability projection, never a third vessel kind or peer rank. The same Node assembly may carry it beside
relay and Herm read-face capabilities, or an operator may place a separately attributable carrier around it without
changing the peer's cap stack.

| Route class | Projection | Must refuse |
|---|---|---|
| `/`, exact `/assets/<name>`, optional `/manifest.webmanifest` | Prepared Web arrival bytes | Unlisted assets, broad filesystem roots, SPA fallback |
| `/genesis/seed.json` | Exact startup seed | Wrong bytes, mutation, private replacement |
| `/genesis/cas/<cid>` | Exact seed-named genesis member | Non-seed CIDs, wrong bytes, traversal, guesses |

### Herm public read faces (P0 inventory)

The Herm floor may carry public read faces separately from the Pronaos arrival projection. These faces publish
bounded, read-only material under their own route owners:

| Route class | Projection | Must refuse |
|---|---|---|
| `/bulb/manifest`, `/bulb/<cid>.bin` | Held, all-public bootstrap snapshot | CIDs outside the held bulb; `/bulb/pointer` is retired |
| `/cas/<cid>` | Bytes named by a `public`-tier pointer in the Herm's own or declared realm books | Private/contract/undeclared pointers, missing bytes, guesses |
| FLOW/flow read face | Read-only public snapshot and FLOW-map disclosure | Generic private bag or persona-document access |

The future Librarium's public books, images, media, and deliberately offered editions remain a separate projection
concern. None of these Herm read faces turns a house-held `library:` collection into a public shelf by implication.

### Sealed Herm carriage (P0 inventory)

The relay crossing carries sealed envelopes between explicit peers. It grants carriage and no plaintext sight,
document authority, or route-derived admission. Relay carriage remains orthogonal to both Pronaos delivery and Herm
public read faces.

Across all three boundaries, byte identity, HTTP cache class, freshness observation, and authority remain separate.
A CID or hash makes wrong bytes detectable; it never infers `immutable`, `revalidate`, or `no-store`. Each route/read
face declares its delivery class. A cache hit never grants identity, membership, read scope, document authority,
admission, or merge authority. The `/cas` gate remains derived from current public references and declared tiers;
missing or disallowed material draws the same named refusal as an unknown public CID. The focused Herm re-share and
realm-public controls remain the source-backed red/green witness for the Herm read-face boundary.

`@lararium/browser` carries browser-native capability atoms that parallel the shared keel through WebSocket egress, IndexedDB, WebCrypto, Workers, and `__stubs__` for browser-incompatible dependencies. It cooperates with `@lararium/web` inside one Web-surface device/context assembly. That assembly remains a DreamNet peer across a real island boundary; browser inability to accept inbound sockets names a substrate constraint, not reduced authority. No React, no canvas.

`@lararium/web` carries Web-surface capability atoms: Vite, page DOM, worker URLs, admission carriers, web projection adapters, and an optional public `@flow` read. Together with `@lararium/browser`, it composes the local Web device/context assembly; that peer can carry a Lararium stack when its persona and document-owning capabilities stand. Its origin may come from localhost, LAN, or a public host; static byte distribution supplies a projection capability and never an authority. Reserve `@lararium/app` for a later generic application-surface composition after materially different vessel surfaces prove a shared contract.

`@lararium/keyhive` carries the capability layer — a pre-alpha integration of `@keyhive/keyhive` WASM bindings. One Keyhive Doc = one bag (1:1). Keyhive's four native grades read `relay` < `read` < `edit` < `admin`; the provider's gate stays binary (`read` or `admin`), and the wider access axis lives as a model at `lar:///ha.ka.ba/lares/api/pono/causal-islands`. Cap-event home and γ-with-operator-α-mirror sync stay in design flux — touch with care.

`@lararium/mempalace` resolves the pinned Python library and its holders for sovereign Sensoriums, and keeps the separate upstream `~/.mempalace` installation reachable as a guest comparator by deliberate operator act. `@lararium/sensorium` carries the Python perception machina and capture scripts. The guest never owns the lararium's memory Sensorium, and neither store federates. See `lar:///ha.ka.ba/lararium/api/mempalace-integration` and `lar:///ha.ka.ba/lares/api/pono/sensorium-machina`.

`@lares/cli` carries the operator-facing surface: the `lares` binary, arg parsing, process spawn, the socket invoker, the harness-wiring on `wake`, and the verb family in `commands/`. The CLI carries no protocol logic and **no transport of its own beyond one socket** — every verb dispatches to `@lararium/node` handlers through the daemon's UDS verb-channel (`verb-call.runVerb` → `local-connector.invokeLocal` → `<dataDir>/lares.sock`); an absent socket raises `DaemonUnreachable`, never a fallback. WS lives at the daemon's relay, for genuine remote peers; the CLI holds no Automerge dependency at all.

<<~/ahu>>

<<~ ahu slot=`#spine`>>

## Quine-Wiki Spine

Canon starts in `bags/` carriers. Package code materializes those carriers into records, projections, tiddlers, and receipts.

Primary flow:

```text
bags/ carriers (memetic-wikitext)
  -> @lararium/mesh parser/compiler/indexes/projection-registry
  -> LarTiddlerStore records  +  AutomergeDocStore composite
  -> MemeProvider projections
  -> @lararium/tw5 island-kernel → wiki + carrier children
  -> verb-vm dispatch (TW5-native nalu)
  -> operator surface (@lares/cli) | browser vessel (@lararium/browser) | node host (@lararium/node)
```

Reverse flow needs care:

```text
TW5 child edit
  -> outbound-bridge.ts → IslandAdaptor.saveTiddler/deleteTiddler
  -> parent carrier reconstruction (memetic-parser + grammar-cache)
  -> bag CRDT record
  -> projection fan-out + ReactionGraph dispatch
```

Residency transitions travel through the ACTION verb surface (`ADD`, `COPY`, `MOVE`, `CLEAR`, `DROP`, `LOAD`) governed by the [Residency Model Epic](EPIC-RESIDENCY-MODEL.md). The `lares act` CLI carries the operator surface; no `promote` shim exists. Do not let live wiki edits write `bags/` directly — operators land bag content through ACTION verbs.

<<~/ahu>>

<<~ ahu slot=`#boot-sequence`>>

## Boot Sequence — three causal moments

The Node-surface assembly treats build, init, and runtime as strictly separated authorship moments. Browser and Web assemblies carry corresponding founding and runtime paths under their own substrate capabilities. No moment reaches into another's authority.

```text
Build time    scripts/build-genesis-island.ts    content inputs → genesis/seed.json + cas/<cid> (the CAS inventory derives strictly from the seed; deterministic Automerge bytes are a verification witness)
Init time     lares vessel found  (was scripts/init-lararium.ts)    social Tiga + identity ceremony → genesis/social-bootstrap.json
Runtime       openNodeVessel  /  openBrowserVessel          finds docs, wires layers; never authors social state
```

`genesis/social-bootstrap.json` materializes as a TW5 plugin container tagged `$:/tags/LarariumBootstrap`. The `lararium-bootstrap-sync` startup module promotes the container after the syncer initializes, so the bundle syncs as one package and individual user overrides remain editable.

### Admin VM (landed)

Admin state lives in its own Automerge doc at `lar:///ha.ka.ba/bags/admin` (bag URI; aligned to the bag-tag rule in [lar-uri.md](../bags/lares/ha.ka.ba/lares/api/pono/lar-uri.md)). The logical room presents at `lar:///ha.ka.ba/lararium/rooms/admin` (room URI). Two URIs, one doc — the bag-as-doc invariant gives admin its own sync boundary. The admin VM hosts itself through `open-admin-vm` (node) and `open-browser-admin-vm` (browser); bag-mirror configs ride as `$:/tags/LarariumBagMirror` tiddlers inside admin.

Operator-private to one node, federated to the operator's own devices via `cap=admin` device delegations through `@lararium/keyhive`.

### Browser three-tier genesis (landed)

`browser-genesis` mirrors the node three-tier model (pinned / hot / cold) into IndexedDB. The browser vessel earns the same gates A/B/C as node and the `workerEa` admin gate sits in front of the admin VM.

### Projection registry

Projections register as kinds with `LarProjectionRegistry`. The node-scoped `disk-projector` kind lives in `@lararium/node`. Configs ride as admin-room tiddlers tagged `$:/tags/LarariumProjection`.

<<~/ahu>>

<<~ ahu slot=`#boundary-law`>>

## Boundary Law

**Core MUST NOT import** TW5, React, filesystem APIs, DOM APIs, or Automerge runtime objects. `@lararium/mesh` stays neutral.

**Browser code SHOULD NOT** import Node-shaped disk paths. If `fs`, `path`, `vm`, or Node crypto enter a browser bundle, surface the shore. Use the `@lararium/browser/__stubs__` pattern for browser-incompatible deps.

**Namespace boundary.** `@lararium/*` = runtime stack (mesh, tw5, node, browser, web, keyhive, mempalace). `@lararium/app` remains reserved for a later generic application surface. `@lares/*` = operator-facing surface (cli). `@dreamdeck/*` = canvas layer (none active yet). Do not cross these on convenience.

**TW5 derived child tiddlers SHOULD** roundtrip through parent carriers without losing decorators, sigils, TOML, or sibling slots. Any fallback reconstruction counts as a ka spot until a test covers it.

**Session-local tiddlers stay local.** `$:/temp/*`, `Draft of *`, cursors, focus state, and private overlays MUST NOT reach shared room state.

**Capability layer is the only authority gate.** Do not invent ad-hoc auth checks; route through `@lararium/keyhive` or the `admin-auth-gate` in `@lararium/node`.

**Bag URI law.** Bag tags occupy `child[1]` only. Do not promote a `child[N]` sigil to bag identity. See [lar-uri.md](../bags/lares/ha.ka.ba/lares/api/pono/lar-uri.md).

<<~/ahu>>

<<~ ahu slot=`#test-routes`>>

## Test Routes

Use the smallest receipt first.

Whole-workspace typecheck:

```sh
pnpm -r --filter './packages/**' typecheck
```

Focused package tests (ten packages ship vitest configs today; these four commands cover the core surfaces):

```sh
pnpm --filter @lararium/mesh test
pnpm --filter @lararium/tw5 test
pnpm --filter @lararium/node test
pnpm --filter @lararium/browser test
```

`@lararium/keyhive` and `@lares/cli` also carry test scripts; run their focused tests from their package directories.

TW5 fixture and sigil-alignment routes:

```sh
pnpm test:tw5-fixture
pnpm test:sigil-alignment
pnpm test:tw5-flow         # placeholder — residency-action flow scripts pending
pnpm test:flows            # top-level integration flows
```

Build all package outputs when generated files, barrels, bundle shores, TW5 vendor assets, or web integration change:

```sh
pnpm -r --filter './packages/**' build
```

`@lararium/tw5` build is the heavy one (vendor + plugin-tiddler + tsc + sync-heleuma). Expect minutes per iteration.

If sandboxing blocks `tsx` IPC under `/tmp`, request escalation and rerun the same build command.

<<~/ahu>>

<<~ ahu slot=`#friction-watch`>>

## Friction Watch

Watch these current weak spots:

* **Automerge-repo API law.** The workspace pins `@automerge/automerge-repo` and its four adapters at `2.6.0-alpha.5` and `@automerge/automerge` at `3.5.0` (one engine, by the `pnpm-workspace.yaml` override). `repo.find()` rejects on unavailable: catch it, or wait through `findWhenReady`; `allowableStates` has no effect and `isUnavailable()` always answers false. `shutdown()` flushes and swallows a save failure, so a caller that must see one awaits `flush()` first. The NodeFS adapter's in-flight holding is private; `DurableNodeFSStorageAdapter` keeps its own.
* **Keyhive pre-alpha.** `@keyhive/keyhive@0.3.0-alpha.1`, unaudited, never a security boundary. Archives and events carry no format tag and do not open across versions (`probes/archive-across-versions.ts`), so a version move re-founds every vessel holding keyhive state. Cap-event home and γ-with-operator-α-mirror sync stay in design flux.
* **Browser worker bridge.** The former frozen-bundle M3 fixture no longer measures the runtime; the current worker bridge resolves browser modules through the TW5 module table. Keep browser-worker changes covered by the live bridge and C4 controls rather than reviving a checked-in bundle.
* **`child[1]` bag URI law.** Sigils above `child[1]` MUST NOT carry bag tags. Treat any violation as a structural error.
* **`@lararium/tw5` barrel** can expose Node-shaped disk/TW5 boot imports to browser bundles. Audit barrel changes against the browser build.
* **Child-carrier reconstruction** produces lossy fallback paths when surgical slot replacement misses. Tests cover the happy paths; the fallback path lacks coverage.
* **Automerge `whenReady()` and true initial peer replay** completion may not mean the same thing.
* **Generated files** in `@lararium/tw5/src/generated-*` come from `scripts/`; do not hand-edit unless you intend to replace the generator output.
* **`pnpm-workspace.yaml` globs `packages/*`.** A directory added there without a `package.json` and source will surface install errors.
* **Open IDE tabs** may name stale files; trust filesystem scans over editor ghosts.
* **mempalace stays vendored.** Integration behavior belongs in `@lararium/mempalace` and `@lararium/sensorium`; the operator-raised guest comparator keeps `hooks.auto_save=false`. A bulk capture must keep stable source identity and replay receipts; a changed `source_file` can duplicate existing drawers. The pinned submodule now follows clean upstream `develop` on local branch `dev/sdm-upstream-base`; the old integration branch is preserved for reference. Upstream hook scripts carry no Lararium pause checks.

<<~/ahu>>

<<~ ahu slot=`#edit-discipline`>>

## Edit Discipline

Prefer one shore per loop. Patch the package that owns the behavior. Add or update a test near the owner package. Keep canon, room, user, and session layers distinct in names and code paths.

Before changing a public export, check browser and node consumers (and `@lares/cli`, which depends on both `@lararium/mesh` and `@lararium/node`). Before changing parser or carrier grammar, check `bags/lares/ha.ka.ba/lares/api/pono/`, `bags/lares/ha.ka.ba/lares/docs/pono/`, and core parser tests. Before changing TW5 sync, check echo-loop guards and draft guards.

Documentation memes go to `bags/` as `.md` files. `.tid` files live in TW5 packages and carry runtime widget / procedure code only.

When reporting back, use OODA-HA receipts: observe facts, orient boundary, decide shore, act summary, ho'oko commands, aftermath risks.

<<~/ahu>>

<<~ ahu slot=`#edges`>>

## Edges

<<~ pranala slot=`#implements-meme` from=`?` to=`lar:///ha.ka.ba/lares/api/pono/meme` family=`control` role=`implements`>>
<<~ pranala slot=`#implements-invariant` from=`?` to=`lar:///ha.ka.ba/lares/api/pono/invariant` family=`control` role=`implements`>>
<<~ pranala slot=`#implements-lar-uri` from=`?` to=`lar:///ha.ka.ba/lares/api/pono/lar-uri` family=`control` role=`implements`>>
<<~ pranala slot=`#implements-parser` from=`?` to=`lar:///ha.ka.ba/lares/api/pono/parser` family=`control` role=`implements`>>
<<~ pranala slot=`#implements-render-pipeline` from=`?` to=`lar:///ha.ka.ba/lares/api/pono/render-pipeline` family=`control` role=`implements`>>
<<~ pranala slot=`#to-root-agents` from=`?` to=`lar:///AGENTS` family=`control` role=`adjacent`>>
<<~ pranala slot=`#to-lares-agents` from=`?` to=`lar:///ha.ka.ba/lares/AGENTS` family=`control` role=`adjacent`>>
<<~ pranala slot=`#to-lares` from=`?` to=`lar:///LARES` family=`control` role=`adjacent`>>
<<~ pranala slot=`#to-voices` from=`?` to=`lar:///ha.ka.ba/lares/api/voices` family=`reference` role=`governs`>>
<<~ pranala slot=`#to-meme-provider` from=`?` to=`lar:///ha.ka.ba/lares/docs/lararium/meme-provider` family=`reference` role=`describes`>>
<<~ pranala slot=`#to-dreamnet` from=`?` to=`lar:///ha.ka.ba/lares/docs/mesh/dreamnet-architecture` family=`reference` role=`describes`>>
<<~ pranala slot=`#to-mempalace-integration` from=`?` to=`lar:///ha.ka.ba/lararium/api/mempalace-integration` family=`reference` role=`describes`>>

<<~/ahu>>

<<^ code=`&#x0003;` bcc=`ni:///sha-256;bBV5ibMx0JHY3A4m9esrQ8GIpgJpZVqFZZ4DP8J2PhM`>>

<<^ code=`&#x0004;` to=`?`>>
