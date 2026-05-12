# Lares Active Roadmap — Outstanding Work Only

> Created: 2026-05-12
> Branch: `feature/lararium-node-3`
> Archive source: `wikis/lares-history/last-sprint/{HANDOFF,SESSION,ROADMAP}.md`

This roadmap intentionally drops sprint archaeology. The last-sprint documents remain in history; this file carries only open work and ordering pressure.

## Current Baseline

The branch already holds the quine/core work: content-addressed genesis + TW5 core boot, admin VM, command-tiddler CLI, Keyhive concap gate, bag residency, wiki composition, plugin-tiddler boot, sigil cascade architecture for the load-bearing sigils, save-side splitting, recursive child co-promotion, and the first Node VM / worker-thread lift.

Do not re-open those arcs unless a test proves drift.

## Active Priority Order

| Priority | Path | Status | Outcome |
|---|---|---|---|
| 1 | **K / F-arc** | ⬜ Next | TW5 save routing, debounce, and projection hygiene for sustained editing. |
| 2 | **L / S7.4** | ⬜ Next | Admin-doc ingress trust gate: only operator-owned devices with `cap=infrastructure` may federate the admin doc. |
| 3 | **G.rest** | ⬜ Small | Port remaining sigils (`lele`, `papalohe`, `pae`) to the wikirule + cascade + template pattern. Keep `kau` separate unless its logic shape changes. |
| 4 | **R** | ⧾ Designed / verify current code | Finish ReactionEngine wiring where worker-side changeset application, changed-URI derivation, and `RE.onChangeset` still lack real integration or tests. |
| 5 | **N** | ⬜ UI shim | `<$lar-promote>` action-widget writes the same command-tiddler as CLI promote. |
| 6 | **O** | ⬜ Corpus hygiene | Author scaffolded heleuma stubs; keep `lares heleuma --write` aligned; design federated promotion ceremony. |

## Path K — TW5 Routing, Debounce, Projection Hygiene

Goal: make live wiki authoring safe under sustained operator editing.

- [ ] Route `$:/state/*` writes to the projection layer, not durable canon/draft layers.
- [ ] Route `Draft of *` tiddlers to the per-wiki draft bag.
- [ ] Add Yjs-style 300–500ms capture debounce in `MemeSyncAdaptor` / save path.
- [ ] Add idle auto-truncate for noisy projection state.
- [ ] Keep disk sync, CRDT inbound, TW5 UX save, and disk export on the same parser/split law.

## Path L — Admin Doc Ingress Trust Gate

Goal: let the operator's own devices federate infrastructure state without exposing the admin doc to room peers.

- [ ] Gate admin-doc WebSocket ingress on Keyhive `cap=infrastructure` proof.
- [ ] Keep admin doc federation restricted to operator devices.
- [ ] Preserve command-tiddler flow: CLI/daemon coordination still rides the admin doc, not HTTP/RPC.
- [ ] Add negative smoke: non-infrastructure peer cannot sync admin state.

## Path G.rest — Remaining Sigils

Goal: complete the non-load-bearing sigil surface without growing bespoke parser logic.

- [ ] `lele` — flow/movement sigil; choose fragment-render vs child ownership.
- [ ] `papalohe` — listening/perception sigil; choose template contract.
- [ ] `pae` — phase/OODA-HA/LADDER sigil; choose template contract.
- [ ] Leave `kau` out of the factory path unless its Keyhive/writeback behavior becomes declarative enough.

## Path R — ReactionEngine Completion

Goal: one reactive wiki tick per hot-tier wiki, Verse-compatible enough for alpha.

Invariants:

1. TW5Engine and ReactionEngine co-locate in the same hot-tier Worker.
2. MemeSyncAdaptor applies a changeset first; RE runs second against current TW5 state.
3. RE writes through the composite store, never directly through `docHandle.change()`.
4. Device graph derives from wiki tiddlers/pranala edges.
5. Cold-tier slots have no RE.

Outstanding verification / work:

- [ ] Confirm whether worker-side changeset application now runs against a local Automerge replica or still only sends placeholder URI sets.
- [ ] Derive changed URI sets from real changesets and feed them into `ReactionEngine.onChangeset`.
- [ ] Expand NodeVmManager integration tests: `mountWiki → routeChangeset → event forwarding → unmountWiki`.
- [ ] Verify teardown snapshot captures heads + tiddlers atomically.
- [ ] Keep piscina only for stateless parse work (`deserializeCarrier` / grammar-pure `parseMeme`), not stateful hot wikis.

## Near-Future Product / UX Paths

| Path | Status | Trigger |
|---|---|---|
| **M / Dreamdeck-app sprint** | ⬜ Queued | After admin ingress gate; picks up same-machine peer consolidation deferred from S6.C.5. |
| **S9 / lararium-browser** | ⬜ Queued | Full browser peer: Automerge, IndexedDB, presence, optional OPFS. |
| **S10 / dreamdeck-tldraw** | ⬜ Queued | tldraw shapes as `lar://` resource containers; edge types first-class. |
| **S11 / dreamdeck-app** | ⬜ Queued | React shell; TW5 + canvas composition; no protocol logic in app layer. |
| **W / CodeMirror 6 + Lezer + LSP** | ⬜ Downstream | Only after CLI/live wiki authoring stabilizes. |

## Deferred / Research Shelf

- Kowloon Bridge: `KowloonOutbox` draft queue + `KowloonInbox` feed mirror; `elyncia.app` deployment.
- Seitan token circle invites.
- Federated promotion conflict handling between lararia.
- Subduction evaluation for lararium↔lararium federation once browser peer exists.
- Speculative RE execution, rollback, and metered/gas execution.
- Wikifier polish: DOCTYPE comment and dash-table round-trip diffs.

## Small Open Items

- `heleuma` drift detection should include `uri-path`, not only `file-path`.
- Command-tiddler tombstone currently happens client-side; decide whether dispatcher should auto-tombstone after audit write.
- Cosmetic legacy names remain in a few logs/strings (`room` vs `wiki`).
- Some generated/source-file memes still need human-authored content beyond scaffolds.
