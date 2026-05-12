# Lares Handoff — Active Work Only

> Created: 2026-05-12
> Branch: `feature/lararium-node-3`
> Last sprint archive: `wikis/lares-history/last-sprint/`

## Bootstrap Paste

```text
Resume from packages/HANDOFF.md and packages/ROADMAP.md.
The bloated prior HANDOFF, SESSION, and ROADMAP moved to:
  wikis/lares-history/last-sprint/{HANDOFF,SESSION,ROADMAP}.md

Current baseline: quine/genesis, TW5 content-addressed core boot, admin VM,
command-tiddler CLI, Keyhive concap, bag residency, wiki composition,
plugin-tiddler boot, load-bearing sigil cascade path, save-side split,
recursive child co-promotion, and Node VM / worker-thread lift are treated as
landed unless tests prove drift.

Next work, in order:
1. Path K / F-arc: TW5 routing rules + 300–500ms debounce + projection auto-truncate.
2. Path L / S7.4: admin-doc ingress trust gate via Keyhive `cap=infrastructure`.
3. Path G.rest: port `lele`, `papalohe`, `pae` to the sigil cascade/template pattern.
4. Path R verification: complete/verify real worker-side changeset application,
   changed URI derivation, RE.onChangeset routing, and NodeVmManager integration tests.

Rules: preserve TW5 VM primacy, bag=Automerge-doc=sync-boundary, no HTTP/RPC
coordination surface, and explicit operator promotion for canon.
```

## What Changed This Turn

- Moved last-sprint archaeology out of `packages/`:
  - `wikis/lares-history/last-sprint/HANDOFF.md`
  - `wikis/lares-history/last-sprint/SESSION.md`
  - `wikis/lares-history/last-sprint/ROADMAP.md`
- Replaced `packages/HANDOFF.md` and `packages/ROADMAP.md` with compact active instruments.
- Did not create a new `packages/SESSION.md`; session chronicle now lives in the archive.

## Active Objective

Ship the next alpha stability layer for live wiki authoring and operator-device federation.

### Path K / F-arc — Next

Implement in the save/sync path:

- `$:/state/*` routes to projection.
- `Draft of *` routes to the per-wiki draft bag.
- Saves coalesce through a 300–500ms debounce.
- Projection layer can auto-truncate idle/noisy state.
- Parser/split behavior remains shared across disk sync, CRDT inbound, TW5 UX save, and disk export.

### Path L / S7.4 — Next

Implement the admin-doc trust gate:

- Require Keyhive proof for `cap=infrastructure` before accepting admin-doc ingress.
- Accept operator-owned devices; reject room peers and unknown peers.
- Keep the admin doc as the command-tiddler coordination surface.
- Add a positive and negative smoke.

### Path G.rest — Small Follow-Up

Port remaining sigils through the existing factory/template architecture:

- `lele`
- `papalohe`
- `pae`

Keep `kau` separate for now; prior docs mark it logic-heavy because placement/writeback/capability behavior does not fit the simple cascade factory.

### Path R — Verify Before Extending

The last-sprint docs contain both designed and landed worker-thread notes. Before coding, inspect current `node-vm-manager.ts`, `lar-wiki-worker.ts`, and tests.

Open checks:

- Does the Worker apply real Automerge changesets locally, or only receive URI placeholders?
- Does `routeChangeset()` derive added/deleted URI sets from real tiddler changes?
- Does `ReactionEngine.onChangeset()` run after TW5 state updates in the Worker?
- Do tests cover mount, route, event-forward, unmount, and snapshot capture?

If all are already true, mark Path R stabilization closed in ROADMAP instead of reworking it.

## Architecture Laws To Preserve

- **Bag = Automerge doc = sync boundary.**
- **TW5 VM primacy.** If logic can live in the VM, keep it there.
- **Command-tiddlers, not HTTP/RPC.** CLI and daemon coordinate through the admin doc.
- **Canon requires operator promotion.** Git diff remains the visible signature.
- **Admin doc stays infrastructure-only.** It federates to the operator's devices, not room peers.
- **Hot wiki = TW5 + RE together.** Synchronous tick semantics require co-location.

## Useful Smokes

```sh
# Quine / peer boot parity
pnpm --filter @lararium/tw5 build
pnpm --filter @lararium/node typecheck
pnpm --filter @lararium/node exec tsx scripts/test-quine.ts

# Daemon/CLI path
lares reset --force
lares serve
lares status
lares wiki list
lares promote lar:///definitely-not-real --to lar:///ha.ka.ba/@lares --yes
```

## Do Not Re-Decide

- `@lares/cli` remains its own package.
- `@keyhive/keyhive` / concap remains the capability substrate; do not pivot to UCAN.
- `lares promote` means explicit operator ceremony, not automatic sync.
- Canonical Lares system tiddlers use `lar:///` titles; drag-and-drop TW5 distribution may emit `$:/` compatibility titles.
- Remaining docs/history belong under `wikis/lares-history/`, not active package handoff files.
