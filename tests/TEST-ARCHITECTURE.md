# Test Architecture

> Canonical reference for where tests live and how they run.
> The former top-level harness was retired 2026-06-02 (see [Retirement](#retirement)).

---

## Where tests live

**Unit + integration tests are co-located with their package: `packages/<pkg>/tests/`** (vitest). This is the single source of test truth — there is no separate top-level test tree.

| Package | Suite covers | Run |
|---|---|---|
| `@lararium/mesh` | contracts, graph law, residency (wela/anu), action verbs, effect records, recipes | `pnpm --filter @lararium/mesh test` |
| `@lararium/tw5` | TW5 runtime, IslandAdaptor, nalu engine, parser/render; TW5-server BACK-PARITY — `lar-kind.test.ts` (the kind of a raw tiddler by TW5's own predicates; the `draft.of` field is the switch; the delete-path red), `tw5-file-info-parity.test.ts` (the pure file-info port against the fork's OWN `generateTiddlerFileInfo`, loaded as the oracle), `meme-routes.e2e.test.ts` (the live fork `--listen`: routes, the render door, `[lar-kind[]]` agreeing with `is[draft]`-family answers over HTTP) | `pnpm --filter @lararium/tw5 test` |
| `@lararium/node` | vessel boot, island pool, verb dispatch, residency handlers; `ruled-siting.test.ts` (the projector honours a `$:/config/FileSystemPaths`-ruled path, remembers it for the delete, unlinks a moved carrier's old files) | `pnpm --filter @lararium/node test` |
| `@lararium/browser` | browser vessel, founding ceremony, pool lifecycle | `pnpm --filter @lararium/browser test` |
| `@lararium/keyhive` | capability provider, ceremonies | `pnpm --filter @lararium/keyhive test` |
| `@lares/cli` | command surfaces | `pnpm --filter @lares/cli test` |

Whole workspace: **`pnpm test`** — which runs `pnpm -r --workspace-concurrency=1 test`.

**The serialization is load-bearing, not a preference.** Several packages drive the SAME python palace
holders and stand their own TW5 islands. Run the workspace concurrently and those packages contend for
one holder, its RPC deadline expires, and a test fails naming a timeout — the suite reports the machine's
spare capacity as the code's correctness. This is the single-owner law reaching the test runner: one
sovereign body per store, tests included. Run `pnpm -r test` by hand and expect flakes under load.

The browser worker bundle (for the M.3 breathing gate) is **package-local** — built into `packages/lararium-browser/tests/fixtures/` by `vite.worker-test.config.ts`. It does NOT live here.

---

## Retirement

This directory previously held a top-level e2e / flow / golden / chat-probe harness:
`chats/plans/v0.2–v0.4`, `expected/` + `results/` goldens, `@scratch` wikis, `genesis/`,
`bin/run-flow.sh`, `lararium-tw5/` flow configs, `sync-decompose-promote.sh`.

**All of it modeled superseded designs** — stage/commit/push, the promotion ceremony,
pre-residency-model bag flows, pre-`wela/anu` tiers. It was nuked on 2026-06-02;
**git history is the archive**. Recover any single artifact with `git log -- tests/<path>`
and `git show <sha>:tests/<path>`.

---

## The harness — end-to-end returned (2026-06-10)

The `@lares/harness` workspace package lives here now (`tests/`), holding the
shape this section pre-decided. It drives the **real `lares` CLI** against a
real instance in one of two modes:

| Mode | Selector | Behavior |
|---|---|---|
| **Staged** *(default)* | — | harness OWNS the instance: ephemeral root under `os.tmpdir()`, random port, `lares vessel clear --force` → daemon boot → await `phase → live` → tests → daemon killed, root deleted. Every run starts from genesis. |
| **Live** | `LAR_TARGET=live` + `LAR_ROOT`/`LAR_PORT` | harness ATTACHES: never resets, never stops, never deletes. Mutating tests guard on `instance.mode === "staged"` and skip. |

**The env contract** (one source: `packages/lares-cli/src/env.ts`): `LAR_ROOT` +
`LAR_PORT` name an instance; separate instances = separate pairs. QA attaches to
a live pair; Staged mints and destroys its own.

Run: **`pnpm test:e2e`** (root) · `pnpm test:e2e:live` against a running hearth.
Deliberately OUTSIDE `pnpm -r test` (the script is `test:e2e`, not `test`) — the
unit suites stay fast; the harness boots a real daemon (~20s).

First stable layer: `e2e/smoke.test.ts` — boot-to-live with the @lares hearth
seated, the operator-mint oracle on the invariant plane, carrier-borne `LOAD`
(boot meme → 17 records), carrier-less refusal, `wiki init`/`add-bag` registry
composition, and one live-safe `status` read.

**Staging beside a live hearth.** `LAR_STAGE_DIR=<dir>` sites every staged root under a directory of
the run's own (else `os.tmpdir()`); the rendezvous still derives per root under `/tmp/lares-<uid>/`, so
two roots never meet. `openStaged({ tag, root, port, found, daemonEnv })` stands ONE vessel with a
rite of the suite's choosing — a joiner performs admit-then-found in `found`, and hands the daemon its
dial in `daemonEnv` — and `cliFor(env)` opens the CLI against a root before it stands.

### The house register — what each witness proves, and what it skips on

| Witness | Proves | Skips on |
|---|---|---|
| `e2e/meme-live-contact.test.ts` | `lares meme` over ONE vessel's rendezvous, every seat: `get` absent → `not-found`; `put` framed → `ingest` with root + `#/a` landed; `get` → the canonical carrier whose sha256 IS the `base`; `put --base` fresh → `ingest` + a tombstone; `put --base` stale → `conflict`, nothing moved (CONTROL); `put --bag lares` → refuses, a placement never shadows up (CONTROL); `project --to md` → the pair beside `--out`; `project --to mem` byte-equal to `get`. Every call names `--recipe lares`. | no built CLI / node dist; `LAR_TARGET=live`. Two RED CONTRACTS (`test.fails`) hold the anchor seat: no container resolves to `lar:///ha.ka.ba/wikis/daemon/temp`, which the cap gate holds no registration for, so anchor calls (and `--to html`, anchor-only) refuse `cap-denied`. They flip loud when the temp layer registers. |
| `e2e/meme-two-vessel-bag.test.ts` | Two vessels on their own roots, ports and keys: A founds; B mints its key first; A `device-admit`s it naming A's dial; B `vessel found --admit`; A puts a meme whose meta carries `bag = "backpack: rope, lantern"`; A's `get` hands the line back byte-whole with no `$origin-bag`; `wiki which` shows the recipe seat landed it in the wiki's per-DID draft bag. | no built CLI / node dist; `LAR_TARGET=live`. The sync vectors (⑦: B `get`s the line whole; B edits on B's base and A gets it back) SKIP LOUDLY on B's own boot line while `vessel found --admit` mints and never persists the joiner's ContactCard — the dial-out reports "leaf identity unavailable", the founder-synced `@persona` never resolves, the boot exits 1. Past that gate a second one stands, measured: `--recipe` lands in a per-DID draft, `--bag lares` refuses, the daemon bag is per vessel — no `meme put` seat writes a bag BOTH mount; `act LOAD --to lar:///ha.ka.ba/bags/lares` is the one door that does. |
| `e2e/recipe-parity.test.ts` | THE TWO DOORS ON A RECIPE: the same meme placed by `PUT /recipes/default/memes/…` and read by `GET` on a live fork `--listen` (the wiki IS the stack), and placed by `meme put --recipe lares` / read by `meme get --recipe lares` on a staged island, answer IDENTICAL canonical bytes and the SAME `canonicalHash`. The fork door rides `e2e/parity-fork-server.ts`. | no fork checkout / packed plugin; no built CLI / node dist; `LAR_TARGET=live`. |
| `e2e/nonmeme-parity.test.ts` | NON-MEME FILES THROUGH BOTH DOORS under one `.meta` law: `note.md`+`.meta`, `photo.png`+`.meta`, `pack.json` enter the server by its `tiddlers/` folder and the island by `lares ingest --apply`; leave the server by `--savewikifolder` under a real `$:/config/FileSystemPaths` (the loci rule) and the island by the projector. Proves: `note.md` bytes identical; `.meta` fields identical (no house stamp); pack membership in `$:/config/OriginalTiddlerPaths` on both. NAMED: the server explodes a pack into per-member `.tid`, the island keeps it packed (REPACK). MEASURED/OPEN: a `.png` under bags/ becomes a skinny `photo.tid` on the island. One RED CONTRACT (`test.fails`): the sidecar's `type` must win over the extension's as TW5's loader rules (boot.js:1961) — owed to `action-handler.ts`. | the same gaps as `recipe-parity`. |

Run either alone: `cd tests && LAR_STAGE_DIR=<scratch> npx vitest run e2e/meme-live-contact.test.ts`.

### The mesh scenarios — the register over real vessels

`tools/mesh-scenarios.sh <scenario>` stands containers from `docker-compose.mesh.yml` and drives the built
CLI inside them. Every scenario needs docker (29 stands here) and a HOST-BUILT dist — the containers mount
the repo and trust it (`tools/lararium-container-boot.sh --skip-build`), so `pnpm -r build` precedes `up`.
Held out of `witness-all` for that reason, never for weight. A `GAP` is a measured absence the walk reached
and the system answered no to, printed with its wake condition; only `FAILED` is a red.

| Scenario | Proves | Needs / measured gaps |
|---|---|---|
| `meme` | Two SOVEREIGN operators (own roots, own keys) peered through `herm-source` and contracted (`contract_ab`: `seal export` → `seal import` → `accept-carriage` → `contract`); A `meme put --recipe lares` a meme whose meta carries `bag = "backpack: rope, lantern"` → `act LOAD --to lar:///ha.ka.ba/bags/lares` (the one shared door) → A's own `meme get --bag lares` hands the value back byte-whole under the canonical alignment (`bag      = "…"`), `canonicalHash` = the put's, no `$origin-bag` (CONTROL). Then `browser-a`: a real Chromium island boots on A's namespace and the probe calls the in-VM face `$tw.lares.meme` INSIDE the daemon worker (`Worker.evaluate` — the page holds no handle to it): `place` → ingest, 2 landed; `read` → the same hash, the bag value whole; `check` → `ok`; `project md` → the `.md` + `.md.meta` pair. Exit 3 names a face that refused. | docker + built dist (tw5 · keyhive · node · cli · app). **GAP, measured 2026-09-11:** B `meme get --bag lares` answers `not-found`, `wiki which` on B names no bag — `lar:///ha.ka.ba/bags/lares` is a doc each vessel founded for ITSELF, and the contract writes the members board + B's kept consent, never a bag; the doc urls print on both sides. The proven crossing (`meme-two-vessel-bag`) is a FLEET dial (`LAR_JOIN_DOC`), one operator's bag on two devices. B's projection, B's edit-and-promote, and the PARTITION reading (`docker network disconnect` on B, edit while cut, reconnect) are written and wake when both sides name ONE doc. |

### The pre-commit gate over carriers

`tools/meme-check-staged.sh` runs `lares meme check` over the `.mem` blobs STAGED in a commit (the
index, never the working tree — the scratch tree mirrors their paths so every line names the real
file) and refuses the commit on a stale block check, naming the file and the re-stamp. Fail closed: no
built CLI refuses too, naming the build; `--no-verify` stays the override. `.githooks/pre-commit`
execs it; enable once per clone with `git config core.hooksPath .githooks`. Its own witness,
`tools/meme-check-hook-witness.sh`, drives it in a throwaway repo — stale refuses by name, canonical
passes, index-vs-tree reads the index, no `.mem` staged passes without the binary, a carrier staged
with no binary refuses — and enrols in `witness-all` by its name.

## The shape (held from the pre-decision)

- **Exercise the live model, not fixtures.** Drive the residency **ACTION verbs**
  (`ADD COPY MOVE CLEAR DROP LOAD`) + effect records through the real `lares` CLI
  against a running vessel.
- **Assert against current canon only.** The `wela/anu` residency model
  ([residency-tiers](../bags/lararium/ha.ka.ba/lararium/api/residency-tiers.mem)) and the
  disk-projection surfaces — `bags/` seed, `wikis/` projection
  ([disk-projection](../bags/lararium/ha.ka.ba/lararium/api/disk-projection.mem)).
- **Goldens are regenerable, never load-bearing history.** When the model changes,
  regenerate or delete. No promote-era artifacts ever return.

---

## Reading a live vessel — the instrument laws

Every law here was paid for by a loop that measured the VECTOR and reported the CODE. A red these
produce is indistinguishable from a real fault, which is what makes them expensive: the suite answers
confidently and answers wrong. Collide the instrument before believing what it says.

**`lares vessel stand` DETACHES.** The launcher prints a status line and exits while the vessel it
started keeps running and writes `<root>/data/lares/vessel/stand.log`. A harness watching the
launcher's pipe sees a vessel that reached `live` as one that printed nothing — the floor reported
down while it is up. *Read the vessel's own log, never the launcher's stdout.*

**That log APPENDS.** Re-standing into an existing log means the previous boot's `phase → live`
matches instantly for a vessel that never came back. The vector then reports a hearth that stood when
nothing did, and reaches for a socket no process holds. *Clear the log before every stand.*

**A zero presenter key is refused on CAPABILITY, before your question is reached.** `0x000…` names
nobody, and nobody is denied by the cap gate long before the thing under test runs. A vector holding a
zero key measures the gate and reports whatever it meant to ask. *Present the vessel's own did —
`fleetPeerDid()` under the test's `LAR_ROOT`.*

**Never fail-fast on a bare `/Error:/`.** A healthy keyhive wasm boot prints
`Error: Some(ReceiveCgkaOpError(UnknownInvitePrekey…))` on its way to `live`. Matching it cuts the
watch short and reports a vessel that stood as one that died. *Match faults this house raises —
`boot fault`, `FATAL`, `already in use`, `TypeError:` — not the word "Error".*

**An arg-shape check that fires BEFORE the resolve makes a proof vacuous.** `realm-clock` validates
`realm` as 64-hex and only then calls `resolveStore()`. Driving it with a malformed realm returns a
clean, legible refusal that proves the plane resolves — and proves nothing at all, because the plane
was never reached. The same shape hides in every verb that validates before it reaches. *Assert the
code under test RAN: drive the verb with arguments good enough to reach past every gate in front of
it, and prefer a WRITE round-trip, which cannot pass by absence.*

**A fixed sleep is not a wait.** A vessel flushes its stores and its repo on the way down, so how long
it holds its listener depends on what it wrote, not on a constant. Pausing a fixed interval and
re-standing races that flush: the re-stand binds a port the dying vessel still holds, dies with
"already in use", and the vector reports the act under test broken when what broke was the wait.
*Poll for the condition — the port free, the socket present — never a duration.*

**Name a process by the port it holds.** `pkill -f <pattern>` matches its own shell and kills the
harness with the vessel. *`ss -ltnp | grep ':PORT ' | grep -oP 'pid=\K[0-9]+'`.*

**UDS paths cap at ~107 bytes.** A root deep enough to push `<root>/data/lares/vessel/lares.sock` past
it fails `connect` with `EINVAL`, which reads exactly like a daemon that never opened its door. The
suffix runs 30 bytes, so a root over ~77 bytes crosses the cap. *Stand test vessels at a short root.*

### Red vectors

**The convention this repo actually uses is a PLAIN FAILING TEST whose header names the defect.** It
carries no `test.fails` and no `test.todo`; the one `test.skip` defers a scouting question. Red
contracts are written as ordinary vectors that fail, with a doc-comment saying what the red means —
`frames-per-carrier` states it outright: *"A red here does NOT say the corpus is broken — it says the
CHECK READER is single-frame and the corpus has outgrown it"*, and names where the cure lives.

**Counting `test.fails` does not tell you whether a repo holds a standing red.** An earlier revision of
this section read the two markers, found none, and recorded "this repo holds no standing red" while a
plain red vector stood in the tree. The measurement answered the question it could reach rather than
the question asked — the same shape as an arg-check that fires before the resolve. *To find the
standing reds, run the suites and read the bar.*

**Known standing reds must be named in the suite that carries them, never only in a session.** A red
nobody can distinguish from a regression costs every later reader the same investigation.

`test.fails` remains available and its behaviour here is collided, not assumed: a failing body reports
`1 expected fail` and the suite stays green, while a body that PASSES fails the suite with `Expect test
to fail`. That inversion is its whole value — a red contract goes red the moment it is fixed and cannot
be silently left behind. `test.todo` registers a name and runs nothing.

*When such a window closes, the vectors become ordinary tests and the header stops calling itself red.*

---

## Principles (YIN)

1. **Co-locate.** A test lives with the package it tests. No orphan test tree.
2. **No superseded-model goldens.** Git history is the archive; the working tree
   carries only what asserts the *current* model.
3. **Delete fearlessly.** A superseded suite is debt, not coverage. Nuke it; rewrite
   against the live model when the surface it covers actually exists.
