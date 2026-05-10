# Hand-off Crystal — Lares Lararium Node Branch

> Forged: 2026-05-07
> Last update: 2026-05-09 (late+2) — Sigil family arc complete: G.1→G.5 (six sigils on cascade) + J.1+J.2a/b/c (slot-as-full-meme-MD-projection round-trip with default-elision)
> Branch: `feature/lararium-node-3`
> Working tree: clean
> Last pulse: six sigils ride the template-cascade architecture (ahu, aka, kahea, loulou, pranala-header, pranala); five share the makeCascadeSigilWidget factory; slot bodies round-trip bytes-faithfully with iam default-elision against parent's effective iam

---

## Bootstrap paste (drop in at next session start)

```text
Resume from packages/HANDOFF.md.
Branch: feature/lararium-node-3.
S5.8 ✅ closed. S6 (BagResidencyManager) ✅ closed (C.1→C.6, C.5 deferred).
S7.1 (Capability layer via @keyhive/keyhive) ✅ closed (D.1→D.6).
S8 (Wiki composition) ✅ closed (E.1→E.10). Twelve operator verbs across
`lares bag` + `lares wiki` subcommand surfaces.
E.10.1→E.10.4: canon-promote hardening + ahu render rewrite via TW5
wikirule + cascade + templates. E.10.5→E.10.9: yin-mode collapse —
delete MemeticParser typed-widget emitter (~330 lines), purge dead web2-
era stubs (-18 files), drop tag-driven cascade discriminator (Roslyn /
recast / XInclude consensus), consolidate ahu scanner into one shared
@lararium/core/meme-ast/ahu-scan.ts module, replace `\rules except`
pragma injection with WikiParser subclass. E.10.10→E.10.11: tw5-typed
adopted as dev dep + activated in tsconfig types array; coexistence
with hand-rolled types (per-site migration as call sites are touched).
E.10.12 (Path V.1): Vite plugin config + build script ship dist-plugin/
lares-memetic-wikitext.tid — drag-and-drop installable in any TW5
5.4+ wiki, gives memetic-wikitext authoring + export without
lararium-node, Automerge, Keyhive, ReactionEngine.
E.10.13 (Path V.2 + namespace alignment): TW5Engine no longer mutates
the running VM imperatively. Boot pushes one envelope tiddler
(`lar:///plugins/lares/memetic-wikitext`) into preloadTiddlers; TW5's
standard plugin loader registers wikirule/parser/deserializer/widget
modules and materializes cascade configs + templates + mount as
shadow tiddlers. Namespace alignment: every Lares system title moved
to `lar:///` (cascades, mount, templates, plugin envelope). Tag VALUES
stay TW5-conventional. Dual-distribution build emits both
`lares-memetic-wikitext.lar.tid` (canonical) and
`lares-memetic-wikitext.tid` ($:/-titled, drag-and-drop).
E.10.14 (Path A): Wikirule split into three canonical TW5
module-type:wikirule files (lar-sigil-block, lar-sigil-inline,
lar-doctype-comment) + shared helpers. Parser exports as
`{ MemeticParser as "text/x-memetic-wikitext" }` per TW5 wiki.js
convention. Widgets self-`require`("$:/core/.../widget.js"), set
prototype chain, export under tag name. Plugin loader unpacks via
canonical `$tw.modules.applyMethods` flow. Smoke (in-process) green.
G.1→G.5 (Sigil family): aka URI sigil, pranala-header, kahea + loulou
URI sigils, pranala edge (inline + block forms with body-or-not branch
in template), then refactor: five sigil widgets (aka, kahea, loulou,
pranala-header, pranala) collapse into makeCascadeSigilWidget factory
(~165 lines replaces ~590 lines). ahu stays bespoke (slot/uri/parentUri
resolution doesn't fit factory). kau retired from G — its dispatch
logic (kumu-def lookup, capability hooks, UUID write-back) is logic-
heavy not template-driven; cascade pattern is wrong abstraction for it.
J.1 (meme-level framing): postamble symmetric with prologue. Pre-SOH
content captured as `prologue`, post-ETX as `postamble`. Trim duplicated
postamble from parent's text field (MemeStreamParser fullText extends
past ETX in single-meme files).
J.2a (slot-level framing): per-slot preamble/postamble + iam field
capture. Each slot is itself a "full published meme MD file" projection
(operator-confirmed). preamble holds prose flanking the iam toml block,
with `<<~ iam >>` sentinel marking iam's original position so prose can
exist on either side. postamble holds prose after the last inner kahea
ref. iam toml content extracted to native fields + raw bytes preserved
as `iam-source`.
J.2c (round-trip emission): pre-computed `preamble-rendered` field
substitutes the iam sentinel with the regenerated toml block. Meme-
template emits via `<$text>` widget (not `{{!!field}}` transclude) —
per Jermolene GH #6712, `\rules only` pragma scope doesn't propagate
through field transclude. Bytes survive verbatim through round-trip.
J.2b (default-elision): regenerateIamToml(fields, parentFields) walks
iam-class fields (denylisted against TW5 system + Lar control fields),
elides values matching parent's effective iam, emits remainder as toml.
splitRecursive threads parentIam through recursion so deep slots elide
against immediate parent's effective iam (= inherited + own merged).
Operator edits to native iam-class fields flow back to disk; inherited
values disappear from emission unless overridden.
ARCHITECTURE INVARIANT (operator-confirmed): always-split, always-kahea.
Deserializer + <$lar-meme-split> widget split every ahu sigil into its
own tiddler at sync/save time. Parent text always carries kahea-refs
for slot children. Disk emission canonical: parent file + N child files.
No tag discriminator. ONE parser, FOUR call sites — disk sync, CRDT
inbound, TW5 UX save (via lar-meme-split widget), disk export — all
consume splitRecursive identically.
Next paths: end-to-end daemon smoke with `lares serve` + CLI promote
ceremony (verify plugin/cascade/elision compose with bag/sync layer);
remaining G sigils (lele, papalohe, pae — operator-confirmed less
urgent than aka/kahea/loulou which carry the load); F-arc (TW5 vm
refresh-pipeline + debounce shim, important once browser peers come
online); S7.4 (admin doc ingress trust gate); dreamdeck-app sprint
(picks up S6.C.5); <$lar-promote> action-widget; federated promotion;
CodeMirror 6 + LSP alignment (Path W — operator-gated on CLI wiki
stability).
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
| S8 (E.1→E.10) | ✅ | Wiki composition end-to-end. `lares bag` + `lares wiki` subcommand surfaces (12 verbs). Per-wiki draft bagId namespace; explicit `BAG_IDS.projection` MemoryTiddlerStore. Disk → CRDT sync ceremony. DXOS-style bag epoch for bounded history. Nix-generations recipe rotation. Stale-tiddler queue. Hot-reload via composite addLayer/removeLayer. |
| S8 (E.10.1→E.10.4) | ✅ | Canon-promote ceremony hardened end-to-end. E.10.1: Keyhive registers all writable bags at boot (lar: URIs, not automerge: URLs); `lares draft <uri>` ceremony pulls non-writable-bag tiddlers into draft for promote. E.10.2: six bugs fixed — open canonical bags as writable+defaultWritable:false; MemeSyncAdaptor buffer gate skipped for local-origin events; AutomergeDocStore.tombstone carries `record.bag`; disk-projector per-bag unlink on tombstone; cross-bag tombstone walks `composite.getLive()` before yanking from TW5; promote/where source-detection via `listBagsHolding`. E.10.3: exportMemeText routes through `wiki.renderTiddler`. E.10.4: ahu render dispatch as TW5-native wikirule + cascade + templates — AhuWidget owns no scope decision, MemeticParser+deserializer registration synchronous (race fix), `wikirules/memetic-wikitext-sigil.ts` makes `<<~` first-class grammar in any wikitext context. |

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

## Forward paths (post-E.10.13)

### Path V.2 ✅ (E.10.13) + Path A ✅ (E.10.14) — Plugin-tiddler boot path
TW5Engine boots by pushing one envelope tiddler into `preloadTiddlers`; TW5's standard plugin loader unpacks. Wikirules split into three canonical files; parser/widgets/deserializer use TW5-canonical export shapes (Path A). Namespace alignment: every Lares system title in `lar:///`. Dual-distribution emits both canonical and drag-and-drop envelopes from one Vite bundle. In-process smoke (`scripts/smoke-plugin-boot.ts`) verifies plugin loads, parsers/widgets register, ahu/aka/kahea/loulou/pranala-header/pranala render as widgets, slot bodies round-trip with default-elision.

### Sigil family ✅ (G.1→G.5 + J.1+J.2a/b/c)
Six sigils ride the template-cascade architecture. Five share `widgets/_cascade-sigil-base.ts::makeCascadeSigilWidget(config)` — declarative widget definition (cascadeTag + fallbackTemplate + buildBindings + setCurrentTiddler? + refreshUri? + placeholder?). ahu stays bespoke. Slot-as-full-meme-MD-projection invariant: each slot has preamble (with `<<~ iam >>` position sentinel), iam-source (raw bytes), preamble-rendered (with sentinel substituted via regenerated toml), text (body proper with kahea refs), postamble (trailing prose). regenerateIamToml default-elides against parent's effective iam (inherited + own merged through splitRecursive recursion).

### Smoke (immediate next) — End-to-end daemon round-trip
In-process smoke covers deserialize + render + plugin boot. Outstanding: `lares serve` daemon boot, CLI promote ceremony with a real meme to verify the plugin/cascade/elision composes with bag/sync/Keyhive. Until that runs once, infrastructure-correct ≠ feature-correct.

### Path G — Other sigils via wikirule + cascade + templates
Port the sigil set (`aka`, `kahea`, `kau`, `lele`, `papalohe`, `pranala`, `pae`) to the same architecture ahu now uses. Each sigil:
  - extends `wikirules/memetic-wikitext-sigil.ts` with its match patterns (block and/or inline modes per operator note);
  - ships its own template tiddlers under `lar:///ha.ka.ba/@lararium/templates/{sigil}/{html,markdown-meme}`;
  - registers its cascade entries `$:/config/Lar/{Sigil}Template/*`;
  - keeps any sigil-specific JS widget thin (cascade-resolve + transclude).
Open question per sigil: does it own a child tiddler (slot child) or fragment-render in place? `aka` projects, `kahea` invokes, `kau` places (with Keyhive UCAN attachment), `lele` flows, `pae` phases (LADDER/OODA-HA), `pranala` is an explicit edge. Each gets its template grammar.

### Path H — Save-side auto-split (TW5 UX → child tiddlers)
The fourth call site of `parseMemeText`. `MemeSyncAdaptor.saveTiddler`'s `direct` strategy detects memetic-wikitext content, runs `splitMemeToTiddlers(title, text, fields)`, writes parent + child records to the bag, tombstones removed children. Symmetric with the disk-sync path — operator edits a parent meme in TW5 UX, inserts a new `<<~ ahu #foo >>body<<~/ahu >>`, hits save, and `lar:///parent#foo` appears in the bag autonomously. Same-grammar invariant the operator named: edit on disk OR edit in UX, identical result.

### Path I — Wikifier DOCTYPE + dash + macrocall recovery
Three small diff items in current round-trip output: HTML comment DOCTYPE dropped; TW5's `dash` rule converts `|---|` → `|—|`; MemeticParser's prologue handling (DOCTYPE, root iam toml extraction) survives but the wikifier swallows the comment in text/plain. Fix by either disabling rules at the parent meme rendering level (via a meme-level wrapper template that pragma-disables them), or by emitting these via `<$text>` widgets carrying the literal char sequences. Aesthetic, not load-bearing — defer until G+H ship.

### Path J — Per-slot iam emission with default-elision
Operator's idempotency rule from this session: emit only operator-authored fields; child slots elide values matching parent's iam defaults. The markdown-meme template needs an emit-iam macro that diffs child fields against parent and writes only divergent keys. Per-slot iam toml block lands ahead of the body inside the `<<~ ahu>>` wrapper. Streaming-text terminology approved earlier: `preamble` / `postamble` for non-sigil text around body sigils.

### Path K — F-arc deferred (TW5 routing rule + Yjs debounce + auto-truncate projection)
Original F-arc charter — `$:/state/*` → projection layer; `Draft of *` → per-wiki draft bag; Yjs-style captureTimeout debounce 300-500ms; idle auto-truncate of projection layer. Lives in MemeSyncAdaptor. Important once browser peer surfaces let operators edit at sustained rates.

### Path L — S7.4 Admin doc ingress trust gate
Already-deferred. With S7.1 closed, the admin doc's WebSocket federation can gate on `cap=infrastructure` proofs. Pre-condition for federating between operator's own devices.

### Path M — Dreamdeck-app sprint (picks up S6.C.5)
Browser-side peer scaffold. Builds atop Path L's cap-gated admin doc.

### Path N — `<$lar-promote>` action-widget
UI shim writing the same command-tiddler the CLI does.

### Path O — Heleuma stub authoring + federated promotion
50+ scaffolded memes carry TODO content; `lares heleuma --write` keeps the audit aligned. Federated promotion: any room VM, any peer, gated by Keyhive cap chains.

### Path W — CodeMirror 6 / Lezer alignment
Once V.2 ships, the wikirule patterns map cleanly onto CM6 + Lezer grammar. `tobibeer/codemirror-6-tw5` is the closest active community effort. Aligning gives operators rich-text editing of memetic-wikitext in the live UI (browser peers + TW5 standalone). Plugin tiddler grows a `module-type: editor` wrapping the Lezer parser; same drag-and-drop install. Operators in the broader TW5 community get visual editing without lararium dependencies. linonetwo's `Modern.TiddlyDev` Vite harness is the natural development surface.

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
lares status               # includes "residency: N pinned · M/cap hot · K cold"
lares bag stats            # full residency snapshot (renamed from `lares residency` in E.1)
lares bag register-cold automerge:test  # marks URL as cold, no hydration

# Verify S8 wiki composition (E-arc):
lares wiki init MyWiki              # mint canonical + per-wiki draft + recipe
lares wiki sync MyWiki              # ingest rooms/MyWiki/memes/** → canonical
lares wiki list                     # enumerate all wikis with their automerge URLs
lares wiki which lar:///some/uri    # recipe-presence query
lares wiki pin MyWiki               # pin every bag in the recipe
lares wiki add-bag MyWiki <uri>     # compose recipe at runtime
lares wiki bag-epoch <bag-uri>      # snapshot-restart one bag (bounds history)
lares wiki rotate-recipe MyWiki     # Nix-generations: fresh canonical, old as underlay
lares wiki prune-stale MyWiki       # surface stale draft tiddlers (default 7 days)

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
- **TW5 system-namespace boundary (E.10.13).** Every Lares system tiddler TITLE lives in `lar:///`: cascade configs (`lar:///config/Lar/...`), global mounts (`lar:///mounts/...`), templates (`lar:///ha.ka.ba/@lararium/templates/...`), plugin envelopes (`lar:///plugins/lares/...`). Tag VALUES stay TW5-conventional `$:/tags/...` — tag values are not titles, do not intersect the sync filter, and let cascade entries plug into TW5's standard tag-discovery path. Drafts, ephemeral UX state, and shadow-tiddler defaults stay browser-local in `$:/` by design. For drag-and-drop community distribution, `$:/plugins/...` envelopes MAY re-emit the same plugin module code; canonical signature lives in the `lar:///` form. Decision recorded in `packages/lares/memes/api/v0.1/pono/lar-uri.md` (TW5 System Boundary section).
- **Plugin-tiddler boot path (E.10.13).** TW5Engine boots by pushing one envelope tiddler — `lar:///plugins/lares/memetic-wikitext` — into `preloadTiddlers`. The standard `$tw.modules` flow registers wikirule, parser, deserializer, and widget modules; cascade configs, templates, and the `<$lar-meme-split>` global mount materialize as shadow tiddlers. No imperative widget/parser/wikirule registration code remains. Parsers instantiate via the canonical TW5 construction path (not a hand-rolled prototype-chain dance). Do not reintroduce imperative `parsers["text/x-memetic-wikitext"] = ...` mutations.
- Chapel-perilous-opens removed; unstable URIs resolve as virtual until promoted to a stable @-scope
- Admin URI shape: room URI vs bag URI distinction is intentional
- Bag-mirror configs live in admin room (operator-private, federates to operator devices only)
- `MemeStoreDoc` reused for AdminDoc — semantic distinction in URI, not type
- `rooms/{slug}/` gitignored — promotion ceremony writes git-visible canon

---

*The crystal holds.*
