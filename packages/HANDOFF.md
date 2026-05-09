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
S5.8 ✅ closed. S6 (BagResidencyManager) ✅ closed (C.1→C.6, C.5 deferred).
S7.1 (Capability layer via @keyhive/keyhive) ✅ closed (D.1→D.6).
Next paths: S7.4 (admin doc ingress trust gate), dreamdeck-app sprint
(picks up S6 C.5 same-machine peer consolidation), <$lar-promote> widget,
heleuma authoring, federated promotion.
Architecture laws hold: causal-island, bag=Automerge-doc=sync-boundary,
canon-promotion requires active operator decision, TW5 VM primacy,
web3-only — no HTTP/RPC for inter-process coordination, command-tiddlers
through admin doc instead.
Sync semantics for cap log: γ-with-operator-α-mirror (Beelay-aligned).
Memory: feedback_architecture_principles.md + feedback_web3_only_lares.md +
project_lares_cli_and_command_protocol.md +
project_capability_layer_design.md (NEW S7.1).
Do not re-decide: @lares/cli is its own package; command-tiddler split
contract (cmd/=signal, log/=durable record); attach-only CLI mode;
@keyhive/keyhive pinned at 0.0.0-alpha.56c; bag↔Keyhive Document 1:1;
two-tier policy (Keyhive crypto + ABILITY_LADDER caveats); DID via raw
bytes-hex (not idString); ContactCard via JSON; corpus-vs-engine package
category boundary.
```

## What landed in this branch

| Sprint | Status | Punchline |
|---|---|---|
| S5.5 | ✅ | Causal correction — server finds, never seeds. Bootstrap plugin container. Content-equality guard. Revision-as-Date.now retired. |
| S5.7 | ✅ | Bag-aware `LarDiskProjector` (canon leak closed). Genesis walks all `packages/*/memes/`. `lares heleuma` audit/scaffold. `lares-chapel-perilous-opens` removed. |
| S5.6 | ✅ | Admin TW5 VM stood up. Admin doc at `lar:///ha.ka.ba/@lararium/@admin`. Bag-mirror configs read from admin tiddlers tagged `$:/tags/LarariumBagMirror`. |
| S5.8 | ✅ | `@lares/cli` package + `lares` binary; command-tiddler CRDT protocol; TS dispatcher; promote/where/echo handlers; durable audit-event tiddlers. |
| S6 | ✅ | `BagResidencyManager` end-to-end: pinned/hot/cold tiers, LRU + idle sweeper + sync-state guard, register-cold for oracle stubs, composite-store hydrate-on-read, `lares status` residency line. C.5 same-machine peer consolidation deferred to the dreamdeck-app sprint. |
| S7.1 (D.1→D.6) | ✅ | @keyhive/keyhive (concap) integration complete. Operator-key bridge, AdminEventStore persistence, ctx.cap wired, promote-handler enforces. Operator identity and admin proof survive daemon restarts. |

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

### Path A — S7.4 Admin doc ingress trust gate
With S7.1 closed, the admin doc's WebSocket federation can gate on `cap=infrastructure` proofs. Before accepting an Automerge sync message touching the admin doc, the daemon verifies the peer holds a delegation rooted at the operator's identity. Pre-condition for federating between operator's own devices.

### Path B — Dreamdeck-app sprint (picks up S6.C.5)
Browser-side peer scaffold. Builds atop Path A's cap-gated admin doc to subscribe as the operator's own device. Same-machine peer consolidation lands here: tab joins the daemon's `/residency` endpoint (designed in HANDOFF; not yet built), treats the daemon as its primary handle source, skips materializing bags the daemon already has hot. tldraw multiplayer + TLDraw infinite canvas surfaces sit atop.

### Path C — `<$lar-promote>` action-widget
With promote handler enforcing real cap, the widget becomes a UI shim that writes the same command-tiddler the CLI does. Lives in admin VM. Adds the visual recipe-presence preview that the CLI prints textually.

### Path D — Heleuma Stub Authoring (still deferred)
50+ scaffolded memes carry TODO role/contract content. `lares heleuma --write` keeps the audit aligned. Defer to a focused documentation pass.

### Path E — Federated promotion
Operator-stated forward state: any room VM, any peer, gated by Keyhive cap chains. Promote-handler's `ctx.cap` already returns Keyhive verification; the `composite` reference generalizes from "room composite" to "requesting peer's composite + cap chain" when transports federate caps across peers.

## Smoke-test recipe (verify branch state)

```sh
# Fresh slate + boot
lares reset --force      # wipes .lararium + bootstrap, re-init
lares serve              # daemon foreground (alternate terminal)

# In another terminal — smoke negative path:
lares promote lar:///definitely-not-real --to lar:///ha.ka.ba/@lares --yes
# Expected: "tiddler not found in any bag: …"

# Verify cap-layer round-trip:
# Boot 1: clean .lararium → keyhive logs `did=0x…  admin-bag registered  self-admin=true`
#         Cap events accumulate as $:/tags/CapEvent tiddlers in admin doc.
# Boot 2 (kill + lares serve): keyhive logs `hydrated N cap events from admin doc`
#         followed by SAME did=0x… and self-admin=true. Identity persists.

# Verify S6 residency:
lares status            # includes "residency: N pinned · M/cap hot · K cold"
lares residency         # full snapshot
lares register-cold automerge:test  # marks URL as cold, no hydration

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
- **Command-tiddler split contract.** `cmd/<id>` = thin signal-tiddler (status state-machine ONLY, no result/error data). `log/<id>` = durable record (full result+audit). Dispatcher tombstones `cmd/<id>` after writing `log/<id>`. CLI polls `log/<id>` and never tombstones. Crash-safe.
- **Capability layer = @keyhive/keyhive (Ink & Switch concap, pre-alpha).** Bag URL ↔ Keyhive Document, 1:1. Two-tier policy: Keyhive provides the binary read/admin cryptographic gate; ABILITY_LADDER caveats live at the application layer (promote-handler etc.). Pinned to `0.0.0-alpha.56c`; upgrades = planned breaking changes.
- **Cap-log sync semantics: γ-with-operator-mirror.** Room peers hold the cap-subgraph for bags they're members of (Beelay's transitive-closure-rooted-at-doc rule). Operator devices hold the full cap log across all bags as a strict subset of γ. NOT (β) full-graph (leaks topology). NOT pure (α) operator-private (breaks revocation propagation).
- **DID encoding.** Use `whoami: IndividualId` + own bytes-to-hex. NOT `idString` — strips per-byte leading zeros, breaks DID round-trip.
- **ContactCard transport.** JSON via `toJson`/`fromJson`, wrap with TextEncoder. NOT bytes — alpha.56c doesn't expose `toBytes` for ContactCard.
- **Cap-event home: D4.a — inside the bag's own Automerge doc** (TW5-native, decided post-research). Title shape `lar:///{bag-uri}/cap/{event-id}`, tag `$:/tags/CapEvent` (sub-tags `.../Prekey`, `.../Cgka`, `.../Delegation`, `.../Revocation`). Reasons: bags are TW5 policy boundaries, not performance boundaries; cap events MUST share the bag's sync surface (peer with bag but not cap log can't validate writes); Automerge has no cross-doc atomicity; TW5's own pattern co-locates high-churn runtime metadata (history, state, drafts) with content via `$:/` + tag, not via separate bag. Companion-doc shape is reserved for future *performance* tuning if cap-event volume crosses a threshold.
- Chapel-perilous-opens removed; unstable URIs resolve as virtual until promoted to a stable @-scope
- Admin URI shape: room URI vs bag URI distinction is intentional
- Bag-mirror configs live in admin room (operator-private, federates to operator devices only)
- `MemeStoreDoc` reused for AdminDoc — semantic distinction in URI, not type
- `rooms/{slug}/` gitignored — promotion ceremony writes git-visible canon

---

*The crystal holds.*
