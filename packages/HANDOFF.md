# Hand-off Crystal — Lares Lararium Node Branch

> Forged: 2026-05-07
> Last update: 2026-05-08 — S5.8 Promotion Ceremony closed; lares CLI lives
> Branch: `feature/lararium-node-3`
> Working tree: dirty (smoke residue under packages/lararium-node/.lararium)
> Last pulse: 6-commit B-arc landed — `lares` CLI + command-tiddler protocol + promote handler

---

## Bootstrap paste (drop in at next session start)

```text
Resume from packages/HANDOFF.md.
Branch: feature/lararium-node-3.
Active sprint completed: S5.8 Promotion Ceremony (6-commit B-arc B.1→B.6).
S5.5 / S5.6 / S5.7 / S5.8 all closed; S7.1 device delegations next.
Architecture laws hold: causal-island, bag=Automerge-doc=sync-boundary,
canon-promotion requires active operator decision, TW5 VM primacy,
web3-only — no HTTP/RPC for inter-process coordination, command-tiddlers
through admin doc instead.
Memory: feedback_architecture_principles.md + feedback_web3_only_lares.md +
project_lares_cli_and_command_protocol.md (NEW).
Do not re-decide: @lares/cli is its own package; command-tiddler URIs
live under lar:///ha.ka.ba/@lararium/@admin/cmd/<requestId>; audit events
under .../@admin/log/<requestId>; promote handler is TS not widget;
attach-only CLI mode (daemon must run); ABILITY_LADDER "promote" gates
the future federated promotion path.
```

## What landed in this branch

| Sprint | Status | Punchline |
|---|---|---|
| S5.5 | ✅ | Causal correction — server finds, never seeds. Bootstrap plugin container. Content-equality guard. Revision-as-Date.now retired. |
| S5.7 | ✅ | Bag-aware `LarDiskProjector` (canon leak closed). Genesis walks all `packages/*/memes/`. `lares heleuma` audit/scaffold. `lares-chapel-perilous-opens` removed. |
| S5.6 | ✅ | Admin TW5 VM stood up. Admin doc at `lar:///ha.ka.ba/@lararium/@admin`. Bag-mirror configs read from admin tiddlers tagged `$:/tags/LarariumBagMirror`. |
| S5.8 | ✅ | `@lares/cli` package + `lares` binary; command-tiddler CRDT protocol; TS dispatcher; promote/where/echo handlers; durable audit-event tiddlers. |

## S5.8 sub-arc — what each commit landed

| # | sha | Punchline |
|---|---|---|
| B.1 | `47d72020` | `@lares/cli` package scaffold. `bin/lares.ts` dispatcher + parse-args. `lares init` ports old `init-lararium.ts` via new `runInit()`. |
| B.2 | `50a9c5be` | Full taxonomy port: `lares` covers status, serve, dev, reset, fresh, build-genesis, test-quine, heleuma. Old pnpm scripts removed (operator chose immediate replacement). Init path-bug fixed. |
| B.3 | `b564ef0c` | Command-tiddler protocol: title `lar:///ha.ka.ba/@lararium/@admin/cmd/<requestId>`, tag `$:/tags/LaresCommand`. TS `CommandDispatcher` + `CommandHandlerRegistry` mounted alongside admin VM. Echo handler for smoke. |
| B.4 | `1681e83f` | Promote handler (TS, factory closing over room composite). `tombstoneInBag()`, `hasWritableBag()` on CompositeStore. Durable audit-event tiddlers under `@admin/log/<requestId>`. Tagged `$:/tags/LaresCommandEvent`. |
| B.5 | `1ff23ede` | `lares promote` CLI: WS attach to daemon as Automerge-repo peer; recipe-presence preview via `where` handler; confirmation prompt; full polled round-trip + tombstone. |
| B.6 | _(this commit)_ | Full smoke proven (where round-trip via CLI). HANDOFF + memory updates. Serve-cwd bug fix folded in. |

## Architectural keystones to preserve

- **Bag = Automerge doc = sync boundary**. Each bag has its own URL, its own ingress trust gate (S7.4), independent federation surface.
- **Admin doc federates only to operator's own devices** via `cap=infrastructure` device delegations. Never reaches room peers.
- **Canon-promotion law**: room edits land in `rooms/{slug}/` (gitignored). Promotion ceremony moves a tiddler from room bag → canonical bag; disk side effect = file move from `rooms/{slug}/` → `packages/`. Git diff IS the operator's signature on canon.
- **TW5 VM primacy**: if it can happen in the VM, it MUST happen in the VM.
- **Web3-only inter-process coordination**: NO HTTP/RPC dispatch surface. CLI ↔ daemon ride command-tiddlers in the admin doc, transported by the existing Automerge-repo WebSocket sync.
- **Heleuma invariant**: every load-bearing source file (re-exported from `index.ts` or marked `@heleuma:required`) needs a self-describing meme at `lar:///ha.ka.ba/@{pkg-scope}/v{ver}/{slug}` whose `source-file` field anchors the off-bag artifact.

## Command-tiddler protocol — quick reference

- **Command URI:**  `lar:///ha.ka.ba/@lararium/@admin/cmd/<requestId>`  tag `$:/tags/LaresCommand`
- **Audit URI:**    `lar:///ha.ka.ba/@lararium/@admin/log/<requestId>`  tag `$:/tags/LaresCommandEvent`
- **Lifecycle:** CLI writes pending → dispatcher transitions running → done|error → CLI tombstones command-tiddler. Audit event survives.
- **Handlers today:** `echo` (admin composite), `promote` (room composite), `where` (room composite, recipe-presence).
- **Forward generalization:** when UEFN-Verse ReactionEngine lands, this dispatcher pattern federates across causal-island bounds; command-tiddlers become one shape of reaction trigger among many. Comments inline in command-dispatcher.ts and promote-handler.ts.

## Three immediate paths

### Path A — S7.1 Device Delegations
Admin doc exists; command-tiddler protocol exists; ctx.cap stays null until this lands.

1. `buildDeviceDelegation()` / `verifyDeviceDelegation()` in `@lararium/core/capability.ts`
2. `runInit()` writes the node's own `cap=infrastructure` delegation as part of operator ceremony
3. Browser peer ceremony writes its own `cap=social` delegation
4. The S7.4 ingress trust check that gates the admin doc's network sync waits on this.
5. Promote handler updates: actually verifyCapability("promote", toBag) before any write.

### Path B — `<$lar-promote>` action-widget
With promote handler live as a TS dispatch target, this widget is now just a UI shim that writes the same command-tiddler the CLI does. Lives in admin VM (or any room VM, gated by cap once Path A lands). Adds the visual recipe-presence preview that the CLI prints textually.

### Path C — Heleuma Stub Authoring (still deferred)
48 missing memes flagged + 2 new ones from `@lares/cli`. `lares heleuma --write` scaffolds templates. Defer to a focused documentation pass.

### Path D — Federated promotion (eventual)
Operator-stated forward state: any room VM should let any user/operator promote, gated by UCAN-style capability proofs. Promote-handler signature already supports this — the `composite` reference generalizes from "room composite" to "requesting peer's composite + cap chain".

## Smoke-test recipe (verify branch state)

```sh
# Fresh slate + boot
lares reset --force      # wipes .lararium + bootstrap, re-init
lares serve              # daemon foreground (alternate terminal)

# In another terminal — smoke negative path:
lares promote lar:///definitely-not-real --to lar:///ha.ka.ba/@lares --yes
# Expected: "tiddler not found in any bag: …"

# Smoke `lares status`:
lares status
# Expected:  bootstrap: present | storage: N files, X KiB | port 8080: in use

# Real promote (operator: pick a tiddler that lives in a room bag):
lares promote <uri> --to <target-bag>
# Walks: where preview → confirmation → promote → audit URI printed
```

## Known open items (small, non-blocking)

- `ReactionEngine` import in main.ts is stubbed (lives in `lararium-core/maybe/kumu-device.ts`; awaits unparking). The "reaction" projection kind not registered.
- `rooms/{slug}/` writeback writes hashes/IDs as filenames — not yet integrated with a file watcher inbound. Disk → CRDT direction not built yet (intentionally absent — only outbound writes for now).
- `heleuma` script could usefully detect drift in `uri-path` field too (currently only checks `file-path`).
- Command-tiddler tombstone happens client-side (CLI), so an ephemeral CLI crash leaves the cmd/ namespace dirty. Mitigation: dispatcher could auto-tombstone after audit-event write (decision deferred — operator may want command-tiddlers to remain visible as in-flight signals).
- `lares heleuma` flags 2 missing memes for `@lares/cli` source files (lares.ts, parse-args.ts) — lands in Path C.
- Some legacy daemon log noise: `TimeoutNegativeWarning` from Automerge repo on attach. Cosmetic.

## Active memory pointers (claude memory system)

- `project_milestone_state.md` — keep current; update with S5.8 closure
- `project_lares_cli_and_command_protocol.md` — NEW, captures CLI conventions + protocol shape
- `project_async_causal_islands.md` — still load-bearing
- `feedback_architecture_principles.md` — never re-decide
- `feedback_web3_only_lares.md` — Kowloon stays external; never internalize web2 patterns
- `feedback_communication_rules.md` — e-prime + OODA-HA structure for prose

## Don't re-decide list

- `@lares/cli` is its own package (NOT part of `@lararium/node`)
- Command-tiddler URI shape: `cmd/<id>` for transient, `log/<id>` for durable audit
- Tag `$:/tags/LaresCommand` is vm-side metadata; lar: title is load-bearing
- Promote = TS handler; widget is a future UI shim that writes the same command-tiddler
- Attach-only CLI mode (daemon must run); ephemeral in-process boot deferred
- Recipe-presence preview before promote prompt is required UX
- ULID-style request id: millis-base32 + 8 random base32; sortable, monotonic
- Per-package `memes/` is the canonical convention — no central `ha-ka-ba/` filesystem aggregator
- **Corpus-vs-engine package category.** Corpus packages (`@lares/lares`, `elyncia`, `ftls`, `sdm`, `wtf`) hold tiddler-package projections in `memes/`; their root JS is at most a 5-line path helper, NOT a TS pipeline. Engine packages (`@lararium/*`, `@lares/cli`) run `src/` + `dist/` + `tsc`. The asymmetry encodes architecture-principle 5: meme files are render projections, code is code-as-projection. Do not migrate corpus index.js to TS.
- Chapel-perilous-opens removed; unstable URIs resolve as virtual until promoted to a stable @-scope
- Admin URI shape: room URI vs bag URI distinction is intentional
- Bag-mirror configs live in admin room (operator-private, federates to operator devices only)
- `MemeStoreDoc` reused for AdminDoc — semantic distinction in URI, not type
- `rooms/{slug}/` gitignored — promotion ceremony writes git-visible canon

---

*The crystal holds.*
