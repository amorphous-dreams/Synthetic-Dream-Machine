# Current Epic — Lararium Genesis Artifact + Protocol Stack

> Updated: 2026-05-05
> Branch: feature/lararium-node-3
> Sprints 0–4: ✅ Complete
> Active sprint: S5 — Quine Round-Trip Verification
> Designed sprints: S6 (SessionEventLog), S7 (Circles + Identities capability layer)

---

## North Star

> The genesis artifact functions as the quine seed. Any peer (node, browser, worker) clones from it. No disk reads at runtime. The build step forms the only seam between disk projections and the CRDT mind.
>
> Every peer establishes WHO it is (IdentitiesDoc), WHAT CIRCLES it belongs to (CirclesDoc), and WHAT IT IS DOING NOW (SessionsDoc) — all without a central server. Social graph control inverts: circles are owned by their center, not by the platform.

---

## Grounding Principles — Web3 + Local-First Research

### The Seven Local-First Ideals (Ink & Switch, 2019)

| Ideal | Lararium mapping |
|---|---|
| No spinners | All reads/writes hit the local Automerge doc first |
| Cross-device | CRDT merge across peers via automerge-repo sync |
| Network optional | Offline edits survive; merge on reconnect |
| Seamless collaboration | Automerge convergence; no server arbitration |
| The long now | `lar://` URIs are content-derived, not server-derived |
| Security by default | Blobs and tiddlers never leave device unencrypted |
| Ultimate ownership | Deleting an account does not destroy a room doc |

**Web3 smell test**: if a design requires a privileged server to write the first byte, it violates Ideals 5 and 7.

### Automerge Genesis Pattern

`Automerge.save(doc)` returns a deterministic `Uint8Array` encoding full document history. Same logical content → same bytes.

```ts
// build-time
const bytes = Automerge.save(genesisDoc)
fs.writeFileSync("genesis/island.bin", bytes)

// runtime — bytes baked into bundle via esbuild binary loader
import genesisBytes from "./genesis/island.bin"  // Uint8Array, no fs
const handle = await repo.import(genesisBytes)
```

### Social Graph Inversion (Kowloon / jzellis model)

Circles are owned by their center, not by the platform. The user's keypair is the root of authority for who is in their circles. A nexus node routes and relays but cannot forge circle membership. System circles (authorization tiers) are founded by the nexus admin key; user circles are founded by the user's key. These are structurally identical — only the trust root differs.

See: `packages/lares-core/lararium-research/PROTOCOL-STACK-IDENTITY-CIRCLES-SESSIONS.md`

### TiddlyWiki Quine Seed

`genesis/island.bin` = TiddlyWiki's `empty.html`:
- Deterministic build-time output
- Contains engine tiddlers, grammar meme, default bags + recipes, blob descriptors
- Every peer boots from it; CRDT sync carries forward
- Quine closure: boot vm → `renderTiddler` → source file → hash match

---

## Sprint Status

### S0 — Web2 Pono Audit ✅ Complete

Deleted all `reconcile*` functions, `seed-grammar-tiddler.ts`, runtime disk-read patterns. Placed `// SPRINT-2` markers. Hardened `globalThis.$tw` typing. Added `RecipeTiddler.plugins` for vendor opt-in.

### S1 — Constitutional Invariants ✅ Complete

- `grammar-invariants.ts` Invariant 3: grammar meme travels in genesis artifact
- `system-invariants.ts`: `SYSTEM_LAWS`, `GENESIS_INVARIANTS`, `PEER_INVARIANTS`, `CODEC_EXCEPTIONS`

### S2 — Genesis Artifact Build Script ✅ Complete

`packages/lararium-node/scripts/build-genesis-island.ts` — deterministic build via content-hash actor ID + `time: 0` on all changes. Produces `genesis/island.bin` (932 KB, 4 blobs, 13 tiddlers) + `genesis/island.sha256`.

Key fix: `Automerge.from()` ignores `time` option internally — replaced with `Automerge.init({ actor }) + change({ time: 0 }, fn)` pattern.

### S3 — Runtime Genesis Loader ✅ Complete

`packages/lararium-node/src/genesis-island.ts`:
- `loadGenesisIsland(repo)` — reads `genesis/island.bin` via `readFileSync`, smoke-verifies, `repo.import(bytes)` + `whenReady()`
- `reconcileIslandFromGenesis(handle, genesisHandle)` — diffs live doc CID against genesis; merges net-new content
- `reconcileWellKnownTiddlers(...)` — writes oracle tiddlers (runtime-assigned Automerge URLs)
- `seedLaresDoc`, `seedIdentitiesDoc`, `seedCirclesDoc`, `seedSessionsDoc` — satellite doc seeders

### S4 — Peer Factory Rewrites ✅ Complete

`openNodeLarPeer` rewritten: uses `loadGenesisIsland()`, removes `seedLarariumDoc` disk-walk body, removes `// SPRINT-2` placeholders. `lararium-island.ts` deleted entirely (147 → 0 lines). All satellite doc seeders moved to `genesis-island.ts`.

### S5 — Quine Round-Trip Verification 🔴 Active

**Goal:** The engine that boots the system lives inside the system it boots.

**Tasks:**
- [ ] Ensure all `@lararium/tw5` vite outputs write `.tw5.cjs` format
- [ ] Wire every `.tw5.cjs` plugin blob into `build-genesis-island.ts`
- [ ] Boot a node peer from genesis; render grammar meme via TW5 vm
- [ ] Verify rendered output hash matches source tiddler hash (`pnpm test:quine`)
- [ ] Write genesis CID as self-ref tiddler `$:/lararium/genesis-cid` into island doc

**Exit criteria:** `pnpm test:quine` passes. No external file read required after `genesis.bin` is loaded.

### S6 — SessionEventLog ⬜ Designed

**Goal:** Wire per-session append-only event log; adopt `docHandle.broadcast()` for presence.

**Tasks:**
- [ ] Add `eventLogUrl: string` and `eventLogHeads: string[]` to `SessionTiddler` interface in `social-doc.ts`
- [ ] Add `SessionEventLog` doc type + `SessionEvent` entry type in `social-doc.ts`
- [ ] Add `seedSessionEventLog(repo, sessionId)` in `genesis-island.ts`
- [ ] Update `capabilityToken` field semantics: store UCAN root hash (not the token)
- [ ] Document `broadcast()` usage pattern for ephemeral presence in session-opening code path

**Key insight from research:** `docHandle.broadcast()` (automerge-repo `EphemeralMessage`) is the correct primitive for presence — NOT a separate persisted doc. Direct equivalent to Yjs awareness. Never touches `NodeFSStorageAdapter`.

### S7 — Circles + Identities Capability Layer ⬜ Designed (design doc only)

**Goal:** IdentitiesDoc and CirclesDoc acquire real protocol integrity via capability delegation chain.

**Design decisions (from research):**
- `IdentitiesDoc`: Keyhive person-as-group model; each person = a group of their device `did:key`s; delegation chain proves "Device B is also me"
- `CirclesDoc`: Keyhive convergent capabilities + Seitan token invitations (@localfirst/auth); nexus admin = founding key for system circles; users = founding key for personal circles
- ERA paper (arXiv:2601.22963): epoch-resolved arbitration for concurrent admin revocations
- `IdentityTiddler.verifyingKey` and `CircleTiddler.encryptedShareHint` already present as forward-compatible hooks

**Tasks (requires design doc before code):**
- [ ] Write `packages/lares-core/lararium-research/CAPABILITY-LAYER.md` design doc
- [ ] Implement device delegation chain tiddlers in `IdentitiesDoc`
- [ ] Implement Seitan token invite flow for `CirclesDoc`
- [ ] Introduce capability verification: any peer verifies "Device X speaks as Identity Y at level Z" serverlessly

**References:** `packages/lares-core/lararium-research/PROTOCOL-STACK-IDENTITY-CIRCLES-SESSIONS.md`

---

## Current 6-Doc Model

### Content Tiga (ha-ka-ba)

| Slot | Doc | URI | Role |
|---|---|---|---|
| ha | `LarariumDoc` | `lar:///ha.ka.ba/@lararium` | System island — genesis artifact |
| ka | `CatalogDoc` | `lar:///ha.ka.ba/@catalog` | Corpus/room index |
| ba | `MemeStoreDoc` | `lar:///ha.ka.ba/@lares` | Personal workspace |

### Social Tiga (ha-ka-ba)

| Slot | Doc | URI | Role |
|---|---|---|---|
| ha | `IdentitiesDoc` | `lar:///ha.ka.ba/@identities` | Principal records — device keys, delegation proofs |
| ka | `CirclesDoc` | `lar:///ha.ka.ba/@circles` | Circles — collective authority, Keyhive capabilities |
| ba | `SessionsDoc` | `lar:///ha.ka.ba/@sessions` | Session registry + per-session EventLog refs |

Dynamic child docs (not root-tiga slots):
- `SessionEventLog` — one per session, `AutomergeUrl` stored in session tiddler

Ephemeral channel (not a doc):
- `docHandle.broadcast()` — presence/cursor/turn-order; never persisted

---

## Cross-Sprint Dependencies

```
S0 Cleanup ✅
  └── S1 Invariants ✅
        └── S2 Build-Time Genesis ✅
              ├── S3 Runtime Loader ✅
              │     └── S4 Peer Factories ✅
              │           └── S5 Quine Closure 🔴 ← HERE
              │                 └── S6 SessionEventLog ⬜
              │                       └── S7 Capability Layer ⬜
              └── (S3 and S4 unlocked together after S2)
```

---

## Key Sources

- [Keyhive notebook — Ink & Switch](https://www.inkandswitch.com/keyhive/notebook/)
- [UCAN specification](https://ucan.xyz/specification/)
- [ERA paper — duelling admins (arXiv:2601.22963)](https://arxiv.org/abs/2601.22963)
- [@localfirst/auth — Seitan token invitations](https://github.com/local-first-web/auth)
- [automerge-repo EphemeralMessage](https://automerge.org/docs/reference/repositories/ephemeral/)
- [Automerge getHeads / view() / history](https://www.mintlify.com/automerge/automerge/advanced/viewing-history)
- [Kowloon by jzellis](https://github.com/jzellis/kowloon/)
- [Local-First Software essay — Ink & Switch](https://www.inkandswitch.com/essay/local-first/)
- [Automerge storage compaction](https://patternist.xyz/posts/concurrent-compaction-in-automerge-repo/)
- [Protocol Stack design doc](./lares/lararium-research/PROTOCOL-STACK-IDENTITY-CIRCLES-SESSIONS.md)
