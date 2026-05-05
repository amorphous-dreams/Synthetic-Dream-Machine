# Current Epic — Lararium Genesis Artifact

> Updated: 2026-05-04
> Branch: feature/lararium-node-3
> Sprint 0: ✅ Complete — see SESSION.md for what changed
> Active sprint: S1 — Constitutional Invariants + Demolition

---

## North Star

> The genesis artifact IS the quine seed. Any peer (node, browser, worker) clones from it. No disk reads at runtime. The build step is the only seam between disk projections and the CRDT mind.

---

## Grounding Principles — Web3 + Local-First Research

### The Seven Local-First Ideals (Ink & Switch, 2019)

The Lararium architecture maps directly onto the Ink & Switch seven ideals:

| Ideal | Lararium mapping |
|---|---|
| No spinners | All reads/writes hit the local Automerge doc first |
| Cross-device | CRDT merge across peers via automerge-repo sync |
| Network optional | Offline edits survive; merge on reconnect |
| Seamless collaboration | Automerge convergence; no server arbitration |
| The long now | `lar://` URIs are content-derived, not server-derived |
| Security by default | Blobs and tiddlers never leave device unencrypted |
| Ultimate ownership | Deleting an account does not destroy a room doc |

**Web3 smell test**: if a design requires a privileged server to write the first byte, it violates Ideals 5 and 7. Every `seedFrom*` runtime function that reads disk on boot fails this test.

### Automerge Genesis Pattern

`Automerge.save(doc)` returns a deterministic `Uint8Array` encoding full document history. The same logical content always produces the same bytes. This means:

- A genesis document built at **build time** can be saved to bytes and embedded in the bundle as a typed constant.
- At **runtime**, `Automerge.load(genesisBytes)` hydrates the full doc — zero disk I/O, zero network.
- The `automerge:<base58>` DocUrl that automerge-repo assigns after `repo.import(bytes)` is a content-addressed stable room identifier — analogous to an IPFS CID or a Ceramic stream ID.

```ts
// build-time
const bytes = Automerge.save(genesisDoc)
fs.writeFileSync("genesis/island.bin", bytes)

// runtime — bytes baked into bundle via esbuild binary loader
import genesisBytes from "./genesis/island.bin"  // Uint8Array, no fs
const handle = await repo.import(genesisBytes)
```

### Content-Addressed Distribution (IPFS/IPLD CAR Pattern)

A CAR (Content Addressable aRchive) file packages an IPLD DAG as a portable binary with:
- Each block keyed by its CID (SHA2-256 + multicodec)
- A root CID list declaring entry points
- Full self-verifiability — unpack, hash, confirm roots

The genesis artifact can optionally be distributed as a `.car` file for cold peer-to-peer seeding. Any peer that receives the CID can verify authenticity without trusting the transport.

```ts
import { CarReader } from "@ipld/car"
const reader = await CarReader.fromBytes(carBytes)
for await (const { cid, bytes } of reader.blocks()) {
  // verify cid matches bytes, then ingest
}
```

**Lararium genesis CID**: computed from the Automerge binary bytes using `multiformats`. Stored as a self-ref tiddler field in the island doc (`$:/lararium/genesis-cid`). `reconcileIslandFromGenesis` compares live doc's stored CID against the package CID to decide whether to merge.

### TiddlyWiki as Prior Art — The Quine Seed

TiddlyWiki's `empty.html` is the canonical quine-genesis prior art:

- **Single-file completeness**: the HTML contains the engine, all system tiddlers, and the save mechanism.
- **Quine property**: saving the wiki outputs a new file that is itself a valid TiddlyWiki. The tool to build itself lives inside the artifact it builds.
- **Genesis semantics**: `empty.html` is the zero-content seed. Every user's wiki is a fork of that seed. The seed is immutable; forks diverge from it.
- **No server needed**: download, open in browser, write, save. The save mechanism writes a new quine.

**Lararium's `genesis/island.bin` = `empty.html`**:
- Deterministic build-time output.
- Contains engine tiddlers, grammar meme, default bags + recipes, blob descriptors.
- Every peer boots from it; CRDT sync carries forward from there.
- The system can regenerate its own genesis: boot a vm from the artifact → `renderTiddler` → source file. That is the quine closure.

### Peer-Symmetric Architecture (Willow + Hypercore + Automerge-Repo)

Three converging patterns from the peer-symmetric space:

**Automerge-repo (production, Trellis/PushPin pattern)**:
- Peer A creates the root doc, gets its DocUrl.
- Shares DocUrl out-of-band (URL hash, config file, oracle tiddler).
- Peer B calls `repo.find(docUrl)` — sync protocol fetches missing changes from any connected adapter.
- Neither peer is privileged. The node peer writing `catalog-url` is an infrastructure codec exception, not a seeding authority.

**Willow Protocol** (earthstar-project, TypeScript):
> "Content-addressed data excels at immutability and global connectivity. Willow embraces mutability, locality, and structure. They complement each other."

This is the exact layering Lararium uses: IPLD/CID for the genesis artifact (immutable seed), Automerge for live doc state (mutable CRDT).

**Ceramic Network** (IPLD + DID-based mutable streams):
Ceramic's stream ID = CID of the genesis event. The stream identifier is content-addressed and verifiable without a server. Lararium's room DocUrl plays the same role.

### Build-Time Seeding Pattern

The general principle used across the ecosystem (WASM embedding, service workers, Vite asset inlining):

1. **Build-time script** creates the artifact, writes bytes to disk.
2. **Bundler loader** (`esbuild binary`, `vite ?raw`, `vite ?url`) inlines bytes into the JS bundle.
3. **Runtime** imports a typed constant — zero fs calls, zero network.
4. **CI verification** reruns the build script, compares CIDs. Deterministic = reproducible.

This pattern eliminates the class of `reconcile*IfChanged` functions entirely. There is nothing to reconcile at runtime because the genesis bytes are immutable — any "update" is a new genesis build.

---

## Implementation Checklist (Lararium-Specific)

| Step | Tool | Output |
|---|---|---|
| Build-time genesis creation | `automerge.from()` + `automerge.save()` | `genesis/island.bin` |
| CID computation | `multiformats` SHA2-256 | `genesis/island.sha256` |
| Embed in bundle | esbuild `loader: { ".bin": "binary" }` | `Uint8Array` constant |
| Boot from constant | `Automerge.load(GENESIS_BYTES)` | `DocHandle<LarariumDoc>` |
| DocUrl as room address | `repo.import(bytes)` → `handle.url` | `automerge:<base58>` |
| CAR file (optional) | `@ipld/car` | `genesis/island.car` |
| Quine property | boot tiddlers → `renderTiddler` → diff source | round-trip hash match |
| Peer equality | all peers `repo.import(genesisBytes)` | no privileged seeder |

---

## Five-Sprint Plan

### Sprint 0 — Web2 Pono Audit ✅ Complete

Deleted all `reconcile*` functions, `seed-grammar-tiddler.ts`, and all runtime disk-read patterns. Placed `// SPRINT-2` markers. Hardened `globalThis.$tw` typing. Added `RecipeTiddler.plugins` for vendor opt-in.

See SESSION.md for full change list.

---

### Sprint 1 — Constitutional Invariants + Final Demolition 🔄 Active

**Delete:**
- `buildLaresPluginBlob()` runtime body in `lararium-island.ts` — moves entirely to build script
- Any remaining stub calls that reference deleted seed functions

**Rewrite:**
- `grammar-invariants.ts` Invariant 3: "grammar meme travels in the genesis artifact; no peer reads grammar from disk at runtime"
- Create `packages/lararium-core/src/system-invariants.ts`:
  - `SYSTEM_LAWS` — five architecture laws as runtime-assertable constants
  - `GENESIS_INVARIANTS` — genesis artifact is canonical origin; all peers boot from it
  - `PEER_INVARIANTS` — peer-symmetric: no peer holds seeding authority at runtime
  - `CODEC_EXCEPTIONS` — named list of deliberate codec-layer exceptions (`catalog-url`, `BOOTSTRAP_SCANS`)

**Gate:** TypeScript compiles clean; island doc with no grammar tiddler emits a warning, not a crash.

---

### Sprint 2 — Genesis Artifact Build Script 🔒

**New file:** `packages/lararium-node/scripts/build-genesis-island.ts`

Build sequence:
1. Boot a Seed VM (same path as current `buildLaresPluginBlob`)
2. Walk `tw5MemesRoot` — deserialize all `.md` meme carriers via `seedVm.deserializeCarrier()`
3. Grammar meme travels as an ordinary tiddler — no special path
4. Pack deserialized tiddlers into `$:/plugins/lararium/lares` JSON plugin tiddler
5. Read TW5 core JS blob + vendored plugin blobs from `tw5PluginsRoot`
6. Create `Repo` + `DocHandle<LarariumDoc>` — write all blobs + tiddlers using existing seeding helpers
7. Serialize via `Automerge.save()` → write `genesis/island.bin` + `genesis/island.sha256`
8. Compute CID via `multiformats` → write to `genesis/island.cid`

Build order in `package.json`:
```
vite:tiddlers → write-tiddler-memes → build-genesis-island
```

**Gate:** `genesis/island.bin` exists; two consecutive identical-source builds produce identical `genesis/island.cid`; `Automerge.load(bytes)` can read the grammar tiddler back out.

---

### Sprint 3 — `loadGenesisIsland()` Runtime 🔒

**New file:** `packages/lararium-node/src/genesis-island.ts`

```ts
export async function loadGenesisIsland(repo: Repo): Promise<DocHandle<LarariumDoc>>
```

- Imports `genesis/island.bin` as `Uint8Array` via esbuild binary loader (zero fs read)
- Calls `repo.import(genesisBytes)` — Automerge built-in doc import from saved binary
- Returns live `DocHandle` with all blobs + tiddlers

```ts
export async function reconcileIslandFromGenesis(
  handle: DocHandle<LarariumDoc>,
  genesisHandle: DocHandle<LarariumDoc>
): Promise<void>
```

- Reads `$:/lararium/genesis-cid` from live island doc
- Compares against package `GENESIS_CID` constant
- If changed, merges genesis handle into live doc (net-new content only)
- Replaces all three `reconcile*` placeholders from Sprint 0

**Gate:** `loadGenesisIsland` returns a handle with `handle.doc()?.tiddlers?.[GRAMMAR_MEME_URI]?.text` non-null.

---

### Sprint 4 — Peer Factory Rewrites 🔒

**`openNodeLarPeer`:**
- Replace `seedLarariumDoc(repo, catalogUrl)` with `loadGenesisIsland(repo)` + oracle tiddler writes
- Replace `// SPRINT-2: reconcileIslandFromGenesis(...)` stubs with real calls
- Node peer becomes peer-symmetric: same genesis bytes as any other peer
- `seedLarariumDoc` disappears entirely if no callers remain

**`openBrowserLarPeer`:**
- Add `loadGenesisIsland` as fallback when no island URL is discoverable
- Browser already receives blobs via Automerge sync — this closes the cold-start gap

**Gate:** Both peers boot cleanly from genesis bytes; no `readdir` / `readFile` in the production hot path (only `catalog-url` disk write remains — named codec exception).

---

### Sprint 5 — Quine Closure + CJS Integration 🔒

**CJS module tiddlers in genesis:**
- `write-tiddler-memes.ts` splices `dist-widgets/{name}.tw5.js` CJS bodies into meme `.md` as `module-text` fields
- `build-genesis-island.ts` deserializes those `.md` files — CJS module tiddlers land in lares plugin blob
- At vm boot, TW5's module system loads them via `require()` (CJS exports visible; no IIFE wrapper shadowing)
- Verify: `tw5.filterTiddlers("[[$:/plugins/lararium/widgets/ahu]]")` returns the widget tiddler

**Quine round-trip test (`pnpm test:quine`):**
1. Boot a vm from `genesis/island.bin`
2. `renderTiddler(GRAMMAR_MEME_URI, "lar:///ha.ka.ba/@lares/templates/carrier-render")` → temp file
3. Diff output against `lares/grammars/memetic-wikitext.md` — must match (modulo whitespace normalization)
4. Store genesis CID as `$:/lararium/genesis-cid` self-ref tiddler in the island doc

**Gate:** Quine round-trip test passes. No runtime disk reads in either peer factory except `catalog-url`. Genesis CID stored as self-ref tiddler. System can describe and regenerate itself.

---

## Cross-Sprint Dependencies

```
S0 Cleanup (done)
  └── S1 Invariants + Demolition
        └── S2 Build-Time Genesis Script
              ├── S3 Runtime Loader (loadGenesisIsland)
              │     └── S4 Peer Factory Rewrites
              │           └── S5 Quine Closure
              └── (S3 and S4 unlock together after S2)
```

**Critical path:** S1 → S2 → S3/S4 parallel → S5.

---

## Key Sources

- [Local-first software: You own your data, in spite of the cloud](https://www.inkandswitch.com/essay/local-first/) — Ink & Switch, 2019
- [Automerge save/load API](https://automerge.org/automerge/api-docs/js/functions/save.html)
- [Automerge Repo — DocHandle and DocUrl](https://automerge.org/automerge-repo/classes/_automerge_automerge-repo.DocHandle.html)
- [IPLD CAR file spec (CARv1)](https://ipld.io/specs/transport/car/carv1/)
- [ipld/js-car — TypeScript implementation](https://github.com/ipld/js-car)
- [TiddlyWiki Quine documentation](https://tiddlywiki.com/static/Quine.html)
- [Willow Protocol](https://willowprotocol.org/) — peer-symmetric mutable + immutable layering
- [Ceramic Network — genesis CID / stream ID pattern](https://developers.ceramic.network/docs/introduction/intro)
- [awesome-local-first](https://github.com/schickling/awesome-local-first)
