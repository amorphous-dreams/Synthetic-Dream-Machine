# Hand-off Crystal — Lares Lararium Node Branch

> Forged: 2026-05-07
> Branch: `feature/lararium-node-3`
> Working tree: clean
> Last pulse: S5.6 Admin VM Lift complete — both TW5 VMs boot to `live`

---

## Bootstrap paste (drop in at next session start)

```text
Resume from packages/HANDOFF.md.
Branch: feature/lararium-node-3.
Active sprint completed: S5.6 Admin VM Lift (5-commit sub-arc A.1→A.5).
S5.5 / S5.7 / S5.6 all closed; S5.8 promotion ceremony next.
Architecture laws hold: causal-island, bag=Automerge-doc=sync-boundary,
canon-promotion requires active operator decision, TW5 VM primacy.
Memory: feedback_architecture_principles.md + feedback_web3_only_lares.md.
Do not re-decide: admin URI shape, bag-mirror config-as-meme, projection registry.
```

## What landed in this branch

| Sprint | Status | Punchline |
|---|---|---|
| S5.5 | ✅ | Causal correction — server finds, never seeds. Bootstrap plugin container. Content-equality guard. Revision-as-Date.now retired. |
| S5.7 | ✅ | Bag-aware `LarDiskProjector` (canon leak closed). Genesis walks all `packages/*/memes/`. `pnpm heleuma` audit/scaffold. `lares-chapel-perilous-opens` removed. |
| S5.6 | ✅ | Admin TW5 VM stood up. Admin doc at `lar:///ha.ka.ba/@lararium/@admin`. Bag-mirror configs read from admin tiddlers tagged `$:/tags/LarariumBagMirror`. |

## Architectural keystones to preserve

- **Bag = Automerge doc = sync boundary**. Each bag has its own URL, its own ingress trust gate (S7.4), independent federation surface. The "bag" word is reused from TW5 but means more than a TW5 bag — it's a CRDT sync unit.
- **Admin doc federates only to operator's own devices** via `cap=infrastructure` device delegations. Never reaches room peers. Two URIs, one doc: room URI `lar:///ha.ka.ba/@lararium/rooms/admin` (logical), bag URI `lar:///ha.ka.ba/@lararium/@admin` (the doc).
- **Canon-promotion law**: room edits land in `rooms/{slug}/` (gitignored). Promotion ceremony moves a tiddler from room bag → canonical bag, with the disk side effect of file move from `rooms/{slug}/` → `packages/`. The git diff IS the operator's signature on canon.
- **TW5 VM primacy**: if it can happen in the VM, it MUST happen in the VM. No direct Automerge writes for content tiddlers after boot.
- **Heleuma invariant**: every load-bearing source file (re-exported from `index.ts` or marked `@heleuma:required`) needs a self-describing meme at `lar:///ha.ka.ba/@{pkg-scope}/v{ver}/{slug}` whose `source-file` field anchors the off-bag artifact.

## Three immediate paths

### Path A — S5.8 Promotion Ceremony
**Substrate ready.** The admin VM exists; the bag mirror system is bag-aware; `rooms/{slug}/` lives gitignored.

Build a wiki widget + CLI that:
1. Reads any tiddler title — shows which bags currently hold it (recipe-presence display)
2. Operator picks target bag → handler calls `composite.put(record, { bag: targetBag, ... })`
3. Source bag tiddler gets tombstoned (the "shadow" disappears)
4. Disk side effect: file moves from `rooms/{slug}/...` to canonical mirror path
5. Promotion event written to admin session-event-log (audit trail)
6. Operator reviews + git commits

CLI form: `pnpm exec tsx packages/lararium-node/scripts/promote.ts <uri> --to <bag>`.
Wiki widget: button on tiddler view that calls into the same handler.

Authority gate: until S7 lands, "operator runs the node" is the gate. Leave room in the handler signature for `cap` checks at the right point so we don't refactor twice.

### Path B — S7.1 Device Delegations
Admin doc exists; device delegations have a home now. Build:
1. `buildDeviceDelegation()` / `verifyDeviceDelegation()` in `@lararium/core/capability.ts`
2. `init-lararium.ts` writes the node's own `cap=infrastructure` delegation as part of operator ceremony
3. Browser peer ceremony (later) writes its own `cap=social` delegation

The S7.4 ingress trust check that gates the admin doc's network sync waits on this.

### Path C — Heleuma Stub Authoring (deferred to next branch)
48 missing memes flagged. `pnpm heleuma --write` scaffolds templates; operator authors role/contract content (~2-4 hrs focused work). Defer to a separate "documentation pass" branch — best done after admin VM heleumas can be authored too.

Audit baseline at hand-off: 0 orphans, 0 drifted, 48 missing.

## Smoke-test recipe (verify branch state)

```sh
rm -rf packages/lararium-node/.lararium packages/lararium-node/genesis/social-bootstrap.json   # fresh slate
lares init                                          # seed all 4 docs (incl. admin)
cd packages/lararium-node && pnpm exec tsx src/main.ts   # boot → reaches "live" phase
# Expected output includes: "[lararium] admin: automerge:..."
# Expected output: "[lararium] no admin bag-mirror tiddlers found — using 3 programmatic defaults"
```

## Known open items (small, non-blocking)

- `ReactionEngine` import in main.ts is stubbed (lives in `lararium-core/maybe/kumu-device.ts`; awaits unparking). The "reaction" projection kind not registered.
- The `rooms/{slug}/` writeback writes hashes/IDs as filenames — not yet integrated with a file watcher inbound. Disk → CRDT direction not built yet (and intentionally absent — only outbound writes for now).
- `heleuma` script could usefully detect drift in `uri-path` field too (currently only checks `file-path`).

## Active memory pointers (claude memory system)

- `project_milestone_state.md` — keep current; update with S5.6 closure
- `project_async_causal_islands.md` — still load-bearing
- `feedback_architecture_principles.md` — never re-decide
- `feedback_web3_only_lares.md` — Kowloon stays external; never internalize web2 patterns

## Don't re-decide list

- Admin URI shape: room URI vs bag URI distinction is intentional
- Bag-mirror configs live in admin room (operator-private, federates to operator devices only)
- `MemeStoreDoc` reused for AdminDoc — semantic distinction in URI, not type
- `rooms/{slug}/` gitignored — promotion ceremony writes git-visible canon
- Per-package `memes/` is the canonical convention — no central `ha-ka-ba/` filesystem aggregator
- Chapel-perilous-opens removed; unstable URIs resolve as virtual until promoted to a stable @-scope

---

*The crystal holds.*
