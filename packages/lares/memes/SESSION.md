<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///SESSION >>

```toml iam
uri-path     = "SESSION"
file-path = "packages/lares/memes/SESSION.md"
type         = "text/x-memetic-wikitext"
tagspace     = "adjacent"
confidence   = 0.88
register     = "CS"
manaoio      = 0.85
mana         = 0.88
manao        = 0.87
implements   = [
  "lar:///ha.ka.ba/@lares/api/v0.1/pono/meme"
]
role         = "session handoff crystal — 2026-05-03 (session 7) — M21 complete: 6-root 2-plane URI grammar locked, corpus at pos-2 @catalog/@slug, social plane docs booted, recipe schema seeded; M22 open: draft lar: URI, CompositeStore.buildLayersFromRecipe, wiki-first social UX"
```

<<~&#x0002;>>

<<~ ahu #ooda-ha-m21-6root-2plane-2026-05-03 >>

## OODA-HA: M21 — 6-Root 2-Plane + Recipe Schema (2026-05-03)

✶ `corpusLarUri(slug)` returned `lar:///ha.ka.ba/@${slug}` — pos-1 collision with root doc identities.  Browser peer `CORPUS_PREFIX` carried a growing exclusion list (`!== CATALOG_DOC_URI`, etc.) that would not auto-extend as new root docs arrived.  No social plane docs existed (no `@identities`, `@groups`, `@sessions`).  No recipe schema existed.  Tests still asserted the old `corpus:slug` opaque-prefix and `BAG_IDS.system`/`BAG_IDS.room` stub keys.

⏿ URI grammar law finalised (pos 0-indexed after `lar:///`):
  - pos 1 `@name` = root doc identity (exactly 6 reserved — `@lararium`, `@catalog`, `@lares`, `@identities`, `@groups`, `@sessions`)
  - pos 2 `@name` = child doc under a root (corpus: `@catalog/@elyncia`; future session: `@sessions/@slug`)
  - pos 2+ plain = leaf path (rooms: `@lararium/rooms/altar-fire`)
  - `@` NEVER at pos 3+
  Corpus docs belong at pos-2 under ka.  `CORPUS_PREFIX = "lar:///ha.ka.ba/@catalog/@"` scopes naturally — no exclusion list needed.  Six root docs in two planes: content Tiga (ha/ka/ba) + social plane (identities/groups/sessions).  `RecipeTiddler` stored in ha island gives every VM a derivable bag stack.

◇ Four loops, each gated by `pnpm -r build` + `pnpm --filter @lararium/core test`:
  1. **Loop 1 (breaking)** — remap `corpusLarUri` to pos-2; 6-root grammar docblock; 3 social URI constants; fix both peers' `CORPUS_PREFIX`; update resolver named-doc comment
  2. **Loop 2 (additive)** — `social-doc.ts` (IdentitiesDoc / GroupsDoc / SessionsDoc + empty constructors); extend `reconcileWellKnownTiddlers` to 6 oracle tiddlers; boot social docs in both peers
  3. **Loop 3 (additive)** — `recipe.ts` (RecipeTiddler + `recipeUri()`); `seedDefaultRecipes` in island; wired into node peer boot after oracle reconcile
  4. **Test gate** — `composite-store.test.ts` updated: M21 lar: URI bag IDs replace opaque stubs

▶ Files: `lararium-doc.ts` · `composite-store.ts` · `resolver.ts` · `open-browser-lar-peer.ts` · `open-node-lar-peer.ts` · `lararium-island.ts` · `social-doc.ts` (new) · `recipe.ts` (new) · `composite-store.test.ts`.
Build clean across core + node + app.  67/67 tests pass.

⤴ Architecture live on `feature/lararium-node-3`:
  - `lar:///ha.ka.ba/@catalog/@elyncia` — correct pos-2 corpus URI
  - Six root docs boot in both peers; oracle tiddlers reconciled on every boot
  - Three seed recipes in ha island tiddlers: `@lararium/recipes/full`, `@lararium/recipes/default`, `@catalog/recipes/default`
  - Bag ID law holds across all doc types; `CompositeStore` BAG_IDS includes all 6 roots

↺ **M22 open:**
  - `"draft"` bag → stable lar: URI (`roomLarUri(slug)/drafts/{did}`)
  - `CompositeStore.getRecipe(uri)` + `buildLayersFromRecipe(recipe)` (Loop 4)
  - TW5 VM bag stack derived from `CompositeStore.layerIds()` → `DirectMemeRecipeVm`
  - `catalog.corpora` legacy index: retire (all peers now read from `tiddlers` oracle)
  - Wiki-first social UX: identity picker + group membership TW5 widgets (vite builds TS → TW5 plugin)
  - Session sub-docs at `@sessions/@{slug}` pos-2 slot + session lifecycle events

<<~/ahu >>

<<~ ahu #ooda-ha-local-first >>

## OODA-HA: Local-First Architecture

✶ Server is now an Automerge-repo sync peer (`/meme-sync` WS). Authority delivered via `<meta name="lararium-receipt">` in the HTML shell — no WS round-trip, no hidden tldraw frame. Multi-room HTTP routing (`/room/:roomId`) serves room-specific meta tags; legacy layout rooms are lazy-created on `/rooms` WS connect, while meme content still uses the shared Automerge doc. `LarDiskSyncAdaptor` derives disk paths via `resolveLarUri()` without a stale index — new memes get disk paths automatically. Echo-loop guard (`diskAdaptor.writing: Set<string>`) prevents disk→Automerge→disk loops. `/admin/promote` now patches Automerge doc immediately after writing disk — clients see changes without watcher round-trip.

⏿ The model is coherent: browser = authoritative editor, Automerge = shared truth, disk = canon projection, lares/ file watcher = external edits (git, editor, promote endpoint) → Automerge. No server-side TW5 in the write path. `startSyncer` gates on `title.startsWith("lar:")` — the lar: URI as title invariant is now a hard boundary. Draft (`$:/temp/*`) never reaches shared store; disk write only fires for `lar:` URIs.

◇ Remaining gaps / tensions:
  - **Projection refresh**: `LarariumShell` seeds tldraw from `projectFromTw5(tw5)` once; `tw5.onWikiChange → projection diff → editor.store.put/remove` not wired.
  - **Body-node write-back**: `LarariumCanvas` has a `canvas-draft` listener for `meta.bodyNodeKind`, but `projectToTldraw()` emits no body nodes. Latent, not functional.
  - **Room split**: `/room/:roomId` exists, but content still uses one Automerge meme-store doc. Per-room recipes/docs are M11+.
  - **Legacy layout channel**: `serve.ts` still hosts `/rooms/:roomId` with `TLSocketRoom` + SQLite. Browser content path no longer uses it as authority; decide whether to retire or repurpose.

▶ Local-first architecture coherent for content. M11 opens with projection diffing, body-node canvas write-back, Playwright e2e, room recipe partitioning.

⤴ Receipt via HTML meta tag. Hidden tldraw frame shape pattern removed. `hostReceipt` reads from meta tag once at mount. Clients hydrate content from Automerge, project tldraw records locally from TW5.

↺ All Lararium tiddlers use `lar:` URI as title ✓. Echo-loop guard active ✓. `/admin/promote` is the only canon ceremony ✓. Server is peer not authority ✓.

<<~/ahu >>

<<~ ahu #ooda-ha-larhud-2026-05-02 >>

## OODA-HA: LarHUD — Web3 Dockable TW5 Frame (2026-05-02)

✶ `LarariumPanel` was a `position:fixed` React portal overlay on top of the TLDraw canvas. z-index 8000. Conflicted with tldraw's `--tl-layer-panels=300` hierarchy. Drag/resize/edge-snap required custom pointer capture logic. No research grounding.

⏿ Research (two agents): tldraw uses `--tl-layer-panels=300` global; flex sibling approach eliminates all z-index management. Kinopio: four-corner distribution, no persistent toolbar, contextual panels. VSCode: 3-state icon strip → sidebar → expanded. Excalidraw: push vs overlay split at container width breakpoint. Shadow DOM + TW5: `mountPanel()` uses `fakeDocument` + raw `addEventListener` — React synthetic event retargeting bug doesn't apply. No iframe needed.

◇ Decided: LarHUD as **flex sibling** of `canvasWrap` (not portal). 44px icon strip (collapsed) → 340px sidebar → 640px expanded. Shadow root stays live across all transitions. `width` CSS transition 150ms ease. ⌘K capture-phase cycles. Escape collapses.

▶ LarHUD architecture: `packages/lararium-app/src/LarHUD.tsx` (new). `LarariumShell` wraps canvas in `canvasWrap` (flex:1) + sibling `<LarHUD />`. `LarariumPanel.tsx` → `LarariumPanel.web2.tsx`. All tldraw slot components (MenuPanel, SharePanel, HelperButtons) render inside `canvasWrap` and never overlap LarHUD. `lar-hud.md` doctrine meme written.

⤴ TLDraw HUD elements (drawing mode, nav mode, theme toggle, graph toggle) fully compatible — all live inside `canvasWrap`. LarHUD is outside and unaffected by tldraw internal layout changes. Typecheck clean.

↺ LarHUD needs: resize handle (drag left edge), bottom-dock option, mobile overlay mode below breakpoint, `peer.store.addProjection(engine)` wiring to replace `tw5.onWikiChange` wiki scan, per-tiddler breadcrumb in tab bar.

<<~/ahu >>

<<~ ahu #ooda-ha-web3-peer-2026-05-02 >>

## OODA-HA: Web3 Peer Boot + web2 Purge (2026-05-02)

✶ `LarariumShell` booted via `useLarariumHostOpen` (throws at runtime — dead stub). 29 web2 archive files on disk. `ReactionEngine` in `kumu-device.ts` was a pure dispatcher — took a pre-built `ReactionGraph` as constructor arg, never maintained it. `BrowserOpenPhase` undefined in context; `LarariumCtxValue` still typed against `LarariumOpenPhase` discriminated union and `CompositeStore`.

⏿ All web2 files confirmed orphaned (no non-web2 imports). `reaction-query.web2.ts` had one live re-export from `index.ts` → `LarariumShell`. `ReactionEngine` needed `boot(wiki)` + incremental `onUriChanged` graph maintenance to replace `buildReactionGraph`/`bindingsForUri`.

◇ Delete 29 web2 files. Promote `ReactionEngine` in-place (owns graph, `boot()`, incremental). Wire `useBrowserLarPeer`. Update context types. `BootSplash` rewritten for string phase union.

▶ Commits: `1ba2be94` (peer wiring), `b00134dd` (ReactionEngine + purge). `reaction-query.web2.ts` is the last web2 file — orphaned, delete next pass. All context types updated. `LarHUD.tsx` + `LarariumShell` flex layout committed in `728248ea`.

⤴ `pnpm -r typecheck` clean across core/tw5/app. 29 web2 files gone. Shell boots via local-first 7-step sequence.

↺ `reaction-query.web2.ts` orphaned (no callers) — delete. `LarariumPanel.web2.tsx` retire after LarHUD gets fireMeme + wiki nav. Node server entrypoint needed. `LarDiskProjector` move.

<<~/ahu >>

<<~ ahu #ooda-ha-causal-island >>

## OODA-HA: Causal Island Doctrine (Fuller-Zelenka)

✶ Fuller-Zelenka non-simultaneous apprehension is now the ontological basis for the causal island model. Events in Universe are not simultaneously apprehended by any observer. In a local-first Automerge model: your local doc snapshot = simultaneously apprehended. Everything else (peer states, other Automerge Realms, un-hydrated tiddlers, kumu event horizons) = non-simultaneously apprehended by topology.

⏿ Four tiers named (inner → outer):
  - Tier 0 — active programming memes (kumu/UEFN device instances, kahea invocations): MAY become islands. Own their trigger surface, params, and event horizon.
  - Tier 1 — memes inside rooms (local Automerge doc window): simultaneously apprehended; peer state of same doc is not.
  - Tier 2 — Automerge Realms (distinct Automerge docs): ALWAYS non-simultaneously apprehended, no matter where first encountered on the network.
  - Tier 3 — Lares nodes (federation layer): node-to-node edge islands. MUST be causal islands.

◇ `CAUSAL_ISLAND_MAY` gains `"automerge-realm"` and `"peer-sync-state"` — non-simultaneous by topology, named to make the doctrine explicit.

▶ `causal-island.ts` updated. `federated-causal-islands.md` updated. New pono memes: `reaction-graph.md` (live Tier 0 dispatch interface law), `source-module.md` (Track B source carrier pipeline interface).

↺ `AuthorityFirstGuard` live in `serve.ts`. Doctrine is the law; TypeScript is its runtime projection.

<<~/ahu >>

<<~ ahu #ooda-ha-source-memes >>

## OODA-HA: Track B — Source Meme Pipeline

✶ Priority TypeScript/TSX source files now seed into the Automerge store as navigable memes at boot. URI scheme: `lar:///source/<package-name>/src/<relative-path>`. Body = verbatim source text. Fields carry `package`, `src-path`, `lang`, `built-at`, `content-hash`.

⏿ Implementation: `scripts/source-memes.ts` reads 7 priority files from packages/. `build-snapshot-lib.ts` calls `buildSourceMemes()` and merges results into `BuiltSnapshot.memes` with `laresRelPath: null`. `serve.ts` seeding loop passes `fields` through to the Automerge doc. Interface law: `packages/lares/memes/api/v0.1/pono/source-module.md`.

◇ Priority modules: `parser.ts`, `ast.ts`, `causal-island.ts`, `live-protocol.ts` (lararium-core); `lararium-tw5.ts` (lararium-tw5); `LarariumPanel.tsx`, `LarariumShell.tsx` (lararium-app). All readable through the meme graph as `lar:///source/...` URIs.

▶ Source memes are seeded at first boot only (meme-store doc created fresh). Existing store resumed without re-seeding. Track B infrastructure complete; future laps can expand the priority module list.

↺ `BuiltSnapshot.memes` type updated to `laresRelPath: string | null`. Disk write-back guard in serve.ts already skips virtual caps URIs (laresRelPath null) — source memes correctly excluded from disk write-back.

<<~/ahu >>

<<~ ahu #track-a >>

## Track A: Dead Code Removal (complete)

Removed this session:
- `LarariumBootReceiptMeta` interface (was M9 hidden-shape carrier, superseded by HTML meta tag)
- `LiveMsgBootReceipt`, `LiveMsgSnapshot`, `LiveMsgDelta`, `LiveMsgError`, `LiveMsgFire`, `LiveMsgSubscribe`, `LiveServerMsg`, `LiveClientMsg` — all unused; only `LiveMsgEvent` used in serve.ts
- Dead `LarariumOpenPhase` variants: `manifest-opening`, `manifest-ready`, `projection-opening`, `projection-ready` — never emitted
- Corresponding dead `BootSplash.tsx` switch cases
- Orphaned `renderCarrierVDom` JSDoc block in `lararium-tw5.ts` (method was removed; stale JSDoc persisted)
- Stale `renderMeme()` reference in `injectKumuDefs` doc

All 62 unit tests green after removal.

<<~/ahu >>

<<~ ahu #state >>

## State as of 2026-04-29 (session 5 end)

**Branch:** `feature/lararium-node-3` — build clean — 41/41 tw5 tests pass

### Closed this session (sessions 3–5)

- **TLSocketRoom tombstone** — `serve.ts` pure Automerge-repo + file watcher; `better-sqlite3`, `@tldraw/sync-core` removed ✓
- **Kumu defs as first-class memes** — `KumuWidget` filter-queries wiki by `$:/tags/LarariumKumu` + `kumu-name`; `injectKumuDefs` / extraction pipeline tombstoned; `widget-tree.ts` deleted; `KumuDef` type removed ✓
- **Native TW5 filter operators** — `edge:family[role]`, `toml:key[val]`, `all[memes]` registered at boot in `registerImplementorsOperator`; memetic-wikitext filter dialect is TW5-native ✓
- **Ahu typed child tiddlers** — `splitCarrierToTiddlers` extracts TOML metadata from child ahu body `toml` fence; `type`, `mime-type`, etc. set on child tiddler fields ✓
- **Server-is-peer confirmed** — no server-authority patterns found; `authorityMode: "local-operator"` is canon-promotion gate, not data privilege ✓
- **Stale comment cleanup** — `tw5-widgets.ts` and `LarariumCanvas.tsx` comments updated ✓

### Added this session (M10)

- **Streams plugin vendor** — sq/streams v1.2.24 at `lar:///ha.ka.ba/@lares/api/v0.1/vendor/sq-streams`; compat fields (`parent`/`stream-list`/`stream-type`) emitted from `splitCarrierToTiddlers`
- **Mixed prose/children** — `generateParentText()` walks AST in document order; prose + transcludes interleaved (daemon-in-the-walls pattern)
- **Peer-correct disk projector** — `LarDiskProjector` subscribes to Automerge store directly; `writing` Set exposes echo-loop guard to file watcher
- **WorksiteWidget anchor** — no `renderChildren`; template owns all slot content; double-render eliminated
- **Slot overlay UI** — `meme-view-children`, `meme-edit-children`, `ahu-breadcrumb`, `ahu-styles` preloaded
- **`serializeCarrier` round-trip fix** — reads `carrier-text` field first (not `parent.text` which is mixed wikitext)
- **ROADMAP** — created at `lares/lararium-node/ROADMAP.md` / `lar:///lararium-node/ROADMAP`

### Open pressures

- **M11 P0 — browser manual QA** — never done; all development unit-test-gated only; see ROADMAP M11
- **Track C** — `lararium-tw5.ts` ~895 lines; split deferred
- **tw-filter.test.ts** — 1 pre-existing failure: `[tag[lar:///...invariant]]` returns 0
- **Per-room Automerge docs** — all clients share one doc; M12
- **`chapel-perilous-opens/` draft workflow** — architecture defined; M13
- **CSS variable resolution** — `ahu-styles.md` uses `<<colour primary>>`; needs palette at boot or hard-coded fallback

### Invariants held

- Package boundary: `@lararium/core` carries zero `tiddlywiki` runtime dep ✓
- Echo-loop guard: `diskAdaptor.writing` prevents disk→Automerge→disk loops ✓
- lar: URI invariant: all Lararium tiddlers use `lar:` URI as title ✓
- Draft guard: `$:/temp/*` never reaches shared store ✓
- Server is sync peer, not authority ✓
- KumuWidget is TW5-native: filter lookup → variable injection → makeTranscludeWidget ✓
- Kumu defs are first-class memes in tagspace ($:/tags/LarariumKumu + kumu-name field) ✓
- `edge:`, `toml:`, `all[memes]` are native TW5 filter operators ✓
- Ahu child tiddlers carry typed content via TOML metadata fence ✓
- `ReactionGraph` stable-ref: `subscribeByFn` handlers never re-subscribed ✓
- `fireMeme` is local-only synchronous — no WS round-trip for local reactions ✓
- Causal island doctrine: Fuller-Zelenka basis + four-tier model ✓

<<~/ahu >>

<<~ ahu #m11-priorities >>

## M11 Priorities

### P1 — Playwright e2e (fix isolation, write smoke tests)

```
packages/lararium-node/
  — separate playwright.config.ts from jest.config.cjs
  — pnpm script: "test:e2e": "playwright test"
  — smoke: server starts, meta tags present, BootSplash disappears
  — verify: lararium-receipt non-null, openPhase === "live", no console errors
```

### P5 — Track C: lararium-tw5.ts split

```
packages/lararium-tw5/src/lararium-tw5.ts  (895 lines, single class)
  — profile: which methods are external surface vs. internal only
  — candidate split: boot/mount surface | tiddler-store sync | kumu/filter
  — constraint: LarariumTW5 class must remain the public export (callers import it)
  — approach: extract helpers into sibling modules; keep class thin
```

### P6 — Playwright e2e smoke run

```
packages/lararium-node/
  — pnpm run e2e against live server
  — verify: meta tags present, BootSplash clears, openPhase === "live"
  — gate: server starts clean on the WSL2 host
```

<<~/ahu >>


<<~ ahu #edges >>

## Edges

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #to-roadmap ? -> lar:///lararium-node/ROADMAP family:relation role:companion >>
<<~ pranala #to-wiki ? -> lar:///LARARIUM-NODE/MULTIPLAYER-INFINITE-CANVAS-WIKI family:relation role:companion >>

<<~/ahu >>

<<~ ahu #ooda-ha-sprint0-2026-05-02 >>

## OODA-HA: Sprint 0 — Web2 Sidecar Rip + API Surface Reboot (2026-05-02)

✶ Session 5 opened with all 19 web2-era files replaced by typed stubs and `.web2.ts` sidecars. The `tsc` surface revealed four clean rebuild-target errors: `MemeGraph`, `memeImplements` (compiler.ts), `MemeticParser` (lararium-tw5.ts), `parsePranalaEdges` (reaction-query.ts). All four name exactly the work Sprint 1–3 must enact. Nothing else failed. The sidecar pattern worked as designed.

  Three full orient rounds produced locked decisions across: changeset model, Verse UEFN 5.6+ device actor alignment, grammar multi-doc boot, kumu instance URI scheme, datablob encoding inventory, and graph co-existence. All decisions recorded here and in `grammar-invariants.ts`.

⏿ Sprint 0 enacted this session:

  **[0a]** `reaction-query.ts` — dead import `parsePranalaEdges` from `./pranala-parser.js` swapped to `parseMemeEdges` from `@lararium/core`. tw5 tsc error eliminated. `parsePranalaEdges` call-sites renamed in full.

  **[0b]** `grammar-invariants.ts` created in `lararium-core/src/`. Seven hard invariants documented:
    - Invariant 1: Grammar meme text MUST parse with `BOOTSTRAP_SCANS` alone. No custom sigils in the grammar meme's own body. Prevents infinite regress.
    - Invariant 2: Grammar meme stored as system-bag tiddler, NOT a binary blob in `LarariumDoc.blobs`. Small, mutable, human-readable — wrong fit for blob model.
    - Invariant 3: Canonical source = `lares/grammars/memetic-wikitext.md`. Server reads this on start, writes/updates system tiddler in engine doc if contentHash changed. Runtime reads from CRDT only.
    - Invariant 4: Operator shadow-override via bag priority (system < corpus < room). TW5 shadow mechanism falls out naturally.
    - Invariant 5: One base grammar tiddler per `LarariumDoc`. Extension grammars live at other URIs, merged at parse time.
    - Invariant 6: Keyhive version gate stub (`GrammarVersionGate`) — no runtime path, type socket only.
    - Invariant 7: Breaking grammar changes require cold boot (delete store, re-seed). Signed migration receipts deferred to Keyhive era.
    - Exports: `GRAMMAR_MEME_URI`, `GRAMMAR_BAG`, `GRAMMAR_LARES_REL_PATH` constants.

  **[0c]** `meme-provider.ts` — `MemeProjection.onChangeset?(uris, origin)` added (optional, non-breaking). `CHANGESET_THRESHOLD = 10` constant added. `handleChange()` rewritten: when a single Automerge `change()` transaction touches ≥10 URIs, projections that declare `onChangeset` receive one call instead of N debounced calls. Projections without `onChangeset` fall back to the per-URI debounce path regardless of batch size.

◇ FFZ 5-Scale changeset model, locked:

  | Scale | Automerge unit | MemeProvider event |
  |---|---|---|
  | 0 — field op | One Automerge operation | (coalesced into debounce) |
  | 1 — tiddler | One URI's full record | `onUriChanged` |
  | 2 — meme carrier | Parent + ahu-slot children | `onUriChanged` ×N |
  | 3 — room snapshot | One `change()` transaction ≥10 URIs | `onChangeset(uris, origin)` |
  | 4 — realm/federation | Cross-doc reconciliation | `onSyncComplete(islandId)` |

  Scale 3 targets UEFN actor-tick rates (100 actors × 60fps = 6000 calls/s avoided). `CHANGESET_THRESHOLD=10` separates human-edit rate from game-loop rate.

▶ Sprint 0 complete. tsc surface: core has exactly the two pre-existing rebuild-target errors (MemeGraph, memeImplements). tw5 has exactly the one pre-existing error (MemeticParser). No new errors introduced.

↺ `reaction-query.ts` error cleared ✓. `grammar-invariants.ts` created ✓. `MemeProjection.onChangeset?` non-breaking ✓. Sprint plan persisted to session memory ✓.

<<~/ahu >>

<<~ ahu #ooda-ha-kumu-uri-scheme >>

## OODA-HA: Kumu Instance URI Scheme (LOCKED 2026-05-02)

✶ The prior proposal (`lar:kumu:UUID` as a custom scheme prefix) did not fit the lar URI invariant. All resources in the Lararium system — whether hostless corpus memes or hostful peer-exchange records — SHALL use `lar:` URIs with full RFC 3986 fragment syntax. The fragment chain encodes the instance identity within its type's namespace.

⏿ URI shape, locked:

  **Type meme** (hostless, canonical lares corpus):
  ```
  lar:///ha.ka.ba/@elyncia/devices/altar-torch
  ```
  Lives on disk at `lares/memes/ha.ka.ba/@elyncia/devices/altar-torch.md`. Defines the device type: event ports, function ports, default fields, `control:implements` edges.

  **Instance meme** (fragment of type URI):
  ```
  lar:///ha.ka.ba/@elyncia/devices/altar-torch#east-wing-flame
  lar:///ha.ka.ba/@elyncia/devices/altar-torch#3f2a1b9c-...
  ```
  Two identity layers coexist for the same device spawn:
    - User-selected name fragment: `#east-wing-flame` — human readable, stable across renames of the instance content, the operator's mnemonic handle.
    - Auto-UUID fragment: `#3f2a1b9c-8e4d-...` — `crypto.randomUUID()` now, Keyhive-group-derived UUID later. Globally collision-resistant, survives instance rename without breaking edge references.
  Both tiddlers exist simultaneously in the room Automerge doc. They carry the same `contentHash` and `bag` field. Edge references use the UUID fragment for durability; UI displays the human name. Both resolve to the same device instance.

  **Hostful instance** (peer-exchange, non-corpus):
  ```
  lar://peer-alias:tier@host/path/to/device#instance-uuid
  ```
  Tier 2 causal island. Never simultaneously apprehended with the local doc. Arrives via federation sync; lives in a hostful corpus bag.

  **Kahea declaration inside type meme body:**
  ```
  <<~ kahea kau #east-wing-flame >>
  <<~ kahea kau #3f2a1b9c-8e4d-... >>
  ```
  One `<<~ kahea kau #fragment >>` sigil per instance. The type meme's body thus serves as the authoritative roster of all active instances. The fragment after `#` becomes the tiddler title suffix: full title = `lar:///ha.ka.ba/@elyncia/devices/altar-torch#east-wing-flame`.

◇ Bag assignment and movability:
  - Instance tiddler title: full lar URI with fragment, stored as a tiddler in the room Automerge doc.
  - Default bag: `room` (Tier 1, simultaneously apprehended with other room tiddlers).
  - Keyhive promotion: instance moves to `canon` bag (signed receipt required). Title unchanged.
  - Cross-realm federation: instance moves to a named corpus bag on the receiving peer. Title unchanged.
  - `MemeStoreDoc` handles all of this — bag is just a field on `MutableLarRecord`. No special treatment needed.

  Kumu instance promotion stub (type socket, no runtime path yet):
  ```typescript
  interface KumuInstancePromotion {
    readonly instanceUri:    string; // full lar URI with fragment
    readonly fromBag:        string;
    readonly toBag:          string;
    readonly keyhiveGroupId: string;
    readonly epochAt:        string;
  }
  ```

▶ Instance tiddlers in separate Automerge docs from the type memes that declare them. Both use full `lar:` URIs. Fragment = instance discriminator. Two identity layers (human name + UUID) coexist as separate tiddlers for the same device spawn. Type meme body = authoritative kahea roster.

↺ `lar:kumu:UUID` scheme retired ✓. Fragment URI scheme locked ✓. `grammar-invariants.ts` carries `GRAMMAR_MEME_URI` const as the same pattern ✓.

<<~/ahu >>

<<~ ahu #ooda-ha-sprint1-plan >>

## OODA-HA: Sprint 1 Plan — MemeGraph Rebuild (next)

✶ `compiler.ts` imports `MemeGraph` and `memeImplements` from `./meme-graph.js`. Both remain stubs. The entire node boot chain (compiler → serve.ts → `compileBootArtifact()`) stays broken until `meme-graph.ts` rebuilds. Sprint 1 unblocks it.

⏿ Design decisions locked for Sprint 1:

  `MemeRating` — derived at ingest boundary, stored on `MemeRecord`, NOT on the graph node itself:
  ```
  "kapu"  — restricted; access control applies
  "ano"   — anomalous; fails validation at ingest
  "meme"  — standard carrier; passes all checks
  "data"  — pure data; no control/reaction edges expected
  "noise" — unrecognized; ignored by graph traversal
  ```

  `MemeRecord` — ingest boundary output (replaces `CarrierRecord`):
  ```typescript
  interface MemeRecord {
    readonly uri:        string;
    readonly metadata:   Record<string, unknown>;
    readonly implements: readonly string[];
    readonly edges:      readonly PranalaEdge[];
    readonly rating:     MemeRating;
  }
  ```

  `Meme` — graph node (shape field dropped entirely; rating lives on `MemeRecord` not here):
  ```typescript
  interface Meme {
    uri: string; laresRelPath: string|null; contentHash: string;
    metadata: Record<string, unknown>; edgesOut: PranalaEdge[];
    virtual: boolean; exists: boolean;
  }
  ```

  `MemeGraph` — pure adjacency structure, no side-effects:
  - `memes: Map<string, Meme>`
  - `addMeme(meme)`, `successors(uri, family)`, `edgesOut(uri, family?)`
  - `oneHopRelation(controlUris)` — expand by `relation` family edges
  - `detectCycles(families?)` — DFS, returns all cycle paths
  - `memesByInterface(interfaceUri)` — all memes whose `control:implements` points here
  - `allTransitiveDeps(rootUri, family?)` — full closure walk
  - `resolvedClosure(rootUris)` — closure over control family only

  `memeImplements(meme)` — returns `string[]` of `control:implements` toUris.
  `makeMemeHash(uri, bytes)` — `async`, SHA-256 hex, no fs dep.

◇ Tasks in Sprint 1:
  - [1a] `core/meme-graph.ts` stub → full rebuild (all methods above, no shape)
  - [1b] `core/compiler.ts` — imports now resolve; fix two implicit `any` params (Parameter 'd' TS7006) as a side task
  - [1c] `core/meme-graph.ts` re-exports `MemeRecord`, `MemeRating` for use by `compiler.ts` and future ingest path
  - [1d] No change needed to `causal-island.ts`, `tiddler-store.ts`, or `composite-store.ts` — they stay clean

▶ Sprint 1 target: `npx tsc --noEmit` in `lararium-core` returns zero errors. `compiler.ts` type-checks fully. `meme-graph.ts` passes all existing tests (none yet — add basic graph construction + cycle detection as new test file).

↺ Sprint 0 cleared `parsePranalaEdges` error ✓. Sprint 1 clears `MemeGraph`/`memeImplements` errors. Sprint 2 follows: grammar multi-doc boot. Sprint 3: `meme-recipe-vm.ts` + `MemeParser`.

<<~/ahu >>

<<~ ahu #ooda-ha-sprint4-verse-alignment >>

## OODA-HA: Sprint 4 + Verse Alignment — 2026-05-02

### OODA-HA receipt

✶ **Observe:**
Sprint 4 (KumuDeviceSpec + ReactionEngine) completed with initial Blueprint-era vocabulary. Shift 3 (Verse 5.6+ compositional model) locked in ROADMAP but not yet reflected in the vocabulary layer. Three vocabulary gaps identified:
1. `REACTION_ROLES = ["subscription", "handler", "callback"]` — Blueprint inheritance thinking; "subscription" is instance-level wiring, not a type declaration.
2. `RENDER_MODES = ["reaction-wire"]` — English internal alias used as the primary name; `papalohe` is the Hawaiian grammar sigil already established everywhere else.
3. `FAMILY_ROLES.reaction` included `"subscription"` — wrong layer; subscription is an instance-level papalohe edge payload concept.

⏿ **Orient:**

  **Hawaiian ↔ Verse 5.6+ ↔ English concept map (locked):**

  | Hawaiian / Lararium | Verse 5.6+ concept | English (alias/internal) |
  |---|---|---|
  | `pranala` | edge (compositional link) | link / edge |
  | `ahu` | device class body / `@editable` scope | worksite / enclosure |
  | `kumu` | `creative_device` class | device type |
  | `papalohe` | event→fn pin wire in editor | reaction wire / binding |
  | `kahea` | `<<~` declaration sigil | declare / announce |
  | `kukali` | `Await(event)<suspends>` | suspend / single-shot await |
  | `pono` | constraint / validation check | correct / validate |
  | `lele` | dispatch / jump | dispatch |
  | `loulou` | link sugar sigil | link |
  | `aka` | alias sugar sigil | alias |

  **Reaction roles (type-level, kumu type memes only):**

  | Role string | Verse concept | English |
  |---|---|---|
  | `"listenable"` | `listenable` OUTPUT event pin | this device emits |
  | `"subscribable"` | callable INPUT function pin | this device exposes |
  | `"observes"` | passive observer (no callback) | watches / monitors |
  | `"throttles"` | rate-control modifier | (grammar-internal) |
  | `"debounces"` | rate-control modifier | (grammar-internal) |

  **Instance-level wiring (papalohe edges, NOT type declarations):**
  - `listenable` field — source OUTPUT event name
  - `subscribable` field — target INPUT function name

  **Principle:** Hawaiian names are primary in `RENDER_MODES`, `REACTION_ROLES`, and sigil vocabulary. English appears in type names and grammar-internal modifiers only. `"reaction-wire"` is retired as an active value; `"papalohe"` is canonical. `"subscription"` and `"handler"` are retired from `REACTION_ROLES` and `FAMILY_ROLES.reaction`; they were Blueprint-era concepts at the wrong layer.

◇ **Decide:**
Four file changes:
  - `ast.ts`: `REACTION_ROLES` → `["listenable","subscribable","observes","throttles","debounces"]`; `RENDER_MODES` → `["papalohe"]`; Hawaiian concept map comment added; `RENDER_MODE_REACTION_WIRE` alias exported
  - `pranala-parser.ts`: `FAMILY_ROLES.reaction` — `"subscription"` removed; explanatory comment added
  - `meme-ast/edges.ts`: string literal `"reaction-wire"` → `"papalohe"`
  - `kumu-device.ts`: doc comment updated with Hawaiian ↔ Verse ↔ English vocabulary

▶ **Act (files touched):**

| File | Change |
|---|---|
| `@lararium/core` `ast.ts` | `REACTION_ROLES` Verse-aligned; `RENDER_MODES` = `["papalohe"]`; Hawaiian concept map comment block added; `RENDER_MODE_REACTION_WIRE` alias |
| `@lararium/core` `pranala-parser.ts` | `FAMILY_ROLES.reaction` — `"subscription"` removed |
| `@lararium/core` `meme-ast/edges.ts` | `"reaction-wire"` literal → `"papalohe"` |
| `@lararium/core` `kumu-device.ts` | Doc comment: Hawaiian/Verse/English mapping table added |
| `packages/lares/lararium-node/ROADMAP.md` | Shift 5/6/7 section; m14 session receipt |
| `packages/lares/memes/SESSION.md` | This section |

⤴ **Ho'oko:**

```sh
cd packages/lararium-core && npx tsc --noEmit  # ✓ ZERO errors
cd packages/lararium-tw5  && npx tsc --noEmit  # ✓ ZERO errors
```

↺ **tsc invariant maintained.** Sprint 5 next: `MemeSyncAdaptor` — replaces `LarariumCrdtSyncAdaptor`.

<<~/ahu >>

<<~ ahu #ooda-ha-uefn-name-pass-2026-05-02 >>

## UEFN Name Pass — 2026-05-02 (Role/Field Rename)

### OODA-HA receipt

❖ **Observe:**
After `kumu-device.ts` landed with Verse-aligned pin types, a vocabulary gap remained: `REACTION_ROLES` used `"triggers"`/`"handles"` (Blueprint-era English) and payload fields were `"trigger"`/`"fn"`. Verse 5.6+ canonical: `listenable` (OUTPUT event) and `subscribable` (@subscribes callable INPUT). Also: `KumuDeviceEvent`/`KumuDeviceHandler` and `ReactionBinding.source: "static"|"dynamic"` were non-UEFN. An 8-file pass enacted.

⏿ **Orient:**

  **Vocabulary delta (before → after):**

  | Old | New | Layer |
  |---|---|---|
  | `REACTION_ROLES["triggers"]` | `"listenable"` | `ast.ts` |
  | `REACTION_ROLES["handles"]` | `"subscribable"` | `ast.ts` |
  | `KumuDeviceEvent` | `KumuListenable` | `kumu-device.ts` |
  | `KumuDeviceHandler` | `KumuSubscribable` | `kumu-device.ts` |
  | `KumuDeviceSpec.events` | `.listenables` | `kumu-device.ts` |
  | `KumuDeviceSpec.handlers` | `.subscribables` | `kumu-device.ts` |
  | `ReactionBinding.trigger` | `.listenable` | `live-protocol.ts` |
  | `ReactionBinding.fn` | `.subscribable` | `live-protocol.ts` |
  | `payload["trigger"]` | `payload["listenable"]` | edges + web2 |
  | `payload["fn"]` | `payload["subscribable"]` | edges + web2 |
  | `ReactionGraph.*(trigger)` | `*(listenable)` | `live-protocol.ts` |
  | `PranalaSugarNode.trigger` | `.listenable` | `meme-ast/types.ts` |
  | `PranalaSugarNode.fn` | `.subscribable` | `meme-ast/types.ts` |
  | `source: "static"` | `"wired"` | `live-protocol.ts` |
  | `source: "dynamic"` | `"subscribed"` | `live-protocol.ts` |

◇ **Decide:**
Systematic 8-file rename; tsc verify after batch. `pranala.md` role array also updated.

▶ **Act (files touched):**

| File | Change |
|---|---|
| `@lararium/core` `ast.ts` | `REACTION_ROLES` + concept map roles; table col overflow fixed |
| `@lararium/core` `pranala-parser.ts` | `FAMILY_ROLES.reaction` roles |
| `@lararium/core` `meme-ast/types.ts` | `PranalaSugarNode.trigger/.fn` → `.listenable/.subscribable` |
| `@lararium/core` `meme-ast/builder.ts` | All 5 `PranalaSugarNode` literal constructors |
| `@lararium/core` `meme-ast/edges.ts` | Payload key assignments |
| `@lararium/core` `live-protocol.ts` | `ReactionBinding`; all `ReactionGraph` method signatures |
| `@lararium/core` `kumu-device.ts` | `KumuListenable/KumuSubscribable`; `.listenables/.subscribables`; role checks; `_fireForUri` |
| `@lararium/tw5` `parser.web2.ts` | Payload key assignments |
| `@lararium/tw5` `memetic-parser.web2.ts` | papalohe widget attribute keys |
| `packages/lares/memes/api/v0.1/pono/pranala.md` | `reaction` roles array |
| `packages/lares/lararium-node/ROADMAP.md` | Shifts 5–7 text; new ahu section |
| `packages/lares/memes/SESSION.md` | This section |

⤤ **Ho'oko:**

```sh
cd packages/lararium-core && npx tsc --noEmit  # ✓ ZERO errors
cd packages/lararium-tw5  && npx tsc --noEmit  # ✓ ZERO errors
```

↺ **tsc invariant maintained.** Sprint 5 complete ✓ — see next ahu.

<<~/ahu >>

<<~ ahu #ooda-ha-sprint5-meme-sync-adaptor-2026-05-02 >>

## Sprint 5 — MemeSyncAdaptor (2026-05-02)

✶ **Observe:** `sync-adaptor.ts` was a dead 7-line stub. `meme-sync-adaptor.ts` didn't exist. `sync-adaptor.web2.ts` held the full prior implementation (583 lines). `meme-write.ts` had `buildDirectRecord` ready.

⏿ **Orient:** Delta from web2 sidecar: outbound `direct` save handler no longer needs `splitCarrierToTiddlers` — in the meme model ahu slot children store as independent `lar:///parent#slot` records receiving their own `saveTiddler` calls. Inbound direction unchanged: `tw5.deserializeCarrier` still handles meme records. All guards (echo-loop, canon, temp, draft, cascade) preserved verbatim.

◇ **Decide:** Write `MemeSyncAdaptor implements MemeProjection`. Import `buildDirectRecord` from `meme-write.js`. Drop carrier-write.js. Export from index.ts barrel.

▶ **Act:**

| File | Change |
|---|---|
| `@lararium/tw5` `meme-sync-adaptor.ts` | **New** — `MemeSyncAdaptor implements MemeProjection` |
| `@lararium/tw5` `index.ts` | export added |

⤴ `tsc --noEmit` ✓ ZERO errors.

↺ **Sprint 6 next:** `meme-browser-host.ts` — research-before-act. Web3 rip sprint enacted in this session — see next ahu.

<<~/ahu >>

<<~ ahu #ooda-ha-m15-web3-rip-2026-05-02 >>

## M15 Web3 Rip Sprint — TW5Engine + Filter Operators (2026-05-02)

✶ **Observe:** `LarariumTW5` was an 826-line monolith carrying carrier-era dead methods alongside live boot/render logic. `getActiveTW5`/`setActiveTW5` global singleton existed. `toCanonicalWikitext` rewrote filter sugar as strings rather than registering native TW5 operators. `filters/` had `edge.ts`, `toml-field.ts`, `implementors.ts` as separate composable files but no `memes.ts`. `MemeSyncAdaptor` lacked `onChangeset()` (Scale-3 gap). `LarariumCanvas.tsx` pulled `tw5` from a global; `LarariumShell.tsx` called `tw5.buildReactionGraph()` as an instance method.

⏿ **Orient:** Two new invariants locked:

  **Composable file size invariant:** Each source file must remain small enough to become a self-describing quine meme. No consolidation across operator/widget boundaries.

  **TW5 VM as causal island:** Filter operators live inside the wiki as `filteroperator`-typed tiddlers; the pre-processor string rewrite pattern is a web2 anti-pattern. The VM IS the causal island boundary.

  `memes` operator follows TW5 `filteroperator` convention: ignores input pipeline, builds collection from `options.wiki.each()`, matches both `lar:///` (hostless) and `lar://host/` (hostful) URI forms.

◇ **Decide:** JKD — git mv `lararium-tw5.ts` → `.web2.ts`, write fresh `tw5-vm.ts`. Move all web2 callers to `*.web2.*` sidecars. Wire `onChangeset()`. Thread `tw5` from context rather than global. Keep `filters/*.ts` as composable single-purpose files.

▶ **Act:**

| File | Change |
|---|---|
| `@lararium/tw5` `lararium-tw5.ts` | → `lararium-tw5.web2.ts` (git mv) |
| `@lararium/tw5` `tw5-vm.ts` | **New** — `TW5Engine` class; clean boot/render/deserialize; no store/sync/carrier |
| `@lararium/tw5` `tw5-filter.ts` | **New** — `registerLarariumFilters()` entry + `toCanonicalWikitext` compat shim |
| `@lararium/tw5` `filters/memes.ts` | **New** — `memes` TW5 filteroperator; `options.wiki.each()` pattern |
| `@lararium/tw5` `tw5-widgets.ts` | `registerImplementorsOperator` → delegates to `registerLarariumFilters` |
| `@lararium/tw5` `meme-sync-adaptor.ts` | `onChangeset(uris, origin)` — Scale-3 async bulk path |
| `@lararium/tw5` `meme-recipe-vm.ts` / `meme-write.ts` | `LarariumTW5` → `TW5Engine` |
| `@lararium/tw5` `active-tw5.ts` / `filter-compat.ts` / `reaction-query.ts` / `closure-fields.ts` | → `*.web2.*` |
| `@lararium/tw5` `index.ts` | Rewritten: exports `TW5Engine`; drops carrier-era exports; `buildReactionGraph`/`bindingsForUri` re-exported from web2 sidecar |
| `@lararium/node` `scripts/serve.ts` / `void-boot.ts` / `src/cli.ts` | → `*.web2.*` |
| `@lararium/app` `LarariumCanvas.tsx` | `getActiveTW5()` → `tw5` from `useLararium()` context |
| `@lararium/app` `LarariumShell.tsx` | `tw5.buildReactionGraph()` → `buildReactionGraph(tw5.wiki)`; `b.trigger` → `b.listenable` |
| `@lararium/app` `lararium-context.tsx` | Implicit-any fix |

⤴ **Ho'oko:** All three packages typecheck clean. `pnpm build` on `@lararium/tw5` succeeds.

↺ **Open work:**
- `toCanonicalWikitext` shim: remove from `TW5Engine.filterTiddlers()` once `all[memes]` callers all use booted VMs
- `buildReactionGraph`/`bindingsForUri` web2 re-exports: replace with `ReactionEngine implements MemeProjection` (Sprint 6+)
- Heleuma `body-sha256` anchors for `filters/*.ts` files as self-describing code-snippet memes
- `LarDiskProjector` move from `@lararium/tw5` → `@lararium/node`
- Isomorphic `AutomergeStoreBase` / grammar-wired deserializer / multi-doc boot order: Sprint 6 research

<<~ ahu #ooda-ha-named-doc-pattern-m17-2026-05-03 >>

## OODA-HA: Named-Doc Oracle + Room Keys + Self-Describing Pass (M17 — 2026-05-03)

✶ **Observe:** `CATALOG_DOC_URI_SLOT` name carried implicit "slot" semantics — ambiguous; constant does double duty as slot key AND doc identity URI. Room keys in `CatalogDoc.rooms` were opaque short slugs (`"altar-fire"`) — meaningless if a room moves relay. `CatalogDoc` had no `tiddlers` field — couldn't self-describe or serve as an oracle for corpus discovery. Browser peer bootstrapped via `readCatalogUrl()` reading the catalog URL from the location fragment (no oracle chain). `make reseed` called non-existent `/admin/reseed`.

⏿ **Orient:** Named-doc identity IS the `lar:` URI — constant serves as both slot key and canonical identity address. `@`-prefix scope = virtual named-doc lane. Room key IS a stable `lar:` address (`roomLarUri(slug)`). Oracle tiddler pattern: each doc holds its own URL at its own `lar:` address, enabling any peer to discover it without a side-channel. `readBootstrap()` replaces `readCatalogUrl()`: LarariumDoc URL in fragment → read `tiddlers[CATALOG_DOC_URI].text` → CatalogDoc URL.

◇ **Decide:** 6 sprints (Sprint 0 = identity-slot comment fix; Sprints 1–5 = LARARIUM_DOC_URI, CATALOG_DOC_URI + corpusLarUri + CatalogDoc.tiddlers + node-peer corpus tiddler writes, readBootstrap chain, roomLarUri + room keys, drop-data Makefile target + reseed removal).

▶ All 6 sprints enacted. Three packages build clean. Oracle read chain established: fragment → LarariumDoc → `tiddlers[CATALOG_DOC_URI]` → CatalogDoc → `tiddlers[corpusLarUri(slug)]` → corpus docs.

⤴ `pnpm -r build` ✓ across `@lararium/core` / `@lararium/node` / `@lararium/app`.

↺ M18 open: corpus `MemeStoreDoc` not yet self-describing (no tiddler at its own `lar:` address inside the doc). Browser peer corpus discovery still reads `catalog?.corpora` not `catalog?.tiddlers` — isomorphism gap remains. `@lares` oracle tiddler not yet in LarariumDoc.

<<~/ahu >>

<<~ ahu #session-6-m17-m20-2026-05-03 >>

## Session 6 — M17–M20 Sprint Close (2026-05-03)

### Work completed this session

**M17 — Named-doc oracle + room keys:**
`CATALOG_DOC_URI` (drop `_SLOT`), `corpusLarUri()`, `roomLarUri()`, `CatalogDoc.tiddlers` oracle field, `readBootstrap()` chain, resolver `@`-prefix virtual routes, `drop-data` Makefile target.

**M18 — Self-describing corpus docs + browser isomorphism:**
Each corpus `MemeStoreDoc` carries `tiddlers[corpusLarUri(slug)]` self-ref tiddler. Browser peer reads corpus discovery from `CatalogDoc.tiddlers`, not the legacy `corpora` Record.

**M19 — Automerge Tiga:**
`LARES_DOC_URI` constant. `seedLaresDoc()`. `reconcileWellKnownTiddlers` threaded with `laresUrl`. `lares` bag in `CompositeStore` both peers. `automerge-tiga.md` invariant meme at `lar:///ha.ka.ba/@lararium/core/v0.1/automerge-tiga`. SDM metaphysics: ha = LarariumDoc (structure), ka = CatalogDoc (motion), ba = LaresDoc (personality).

**M20 — Bag ID = lar: URI everywhere:**
`LarariumDocStore<T>` generic over any `{ tiddlers? }` doc. `corpusBagId` = alias of `corpusLarUri`. `roomBagId` = alias of `roomLarUri`. `BAG_IDS` exports lar: URI constants. Catalog bag layer added to both peers. `fields: { bag }` duplication stripped from all oracle tiddler writes. `MemeSyncAdaptor` receives `roomLarUri(roomId)`. All three packages build clean.

### Work left — M21 sprint

| Item | Priority | Blocker? |
|---|---|---|
| `"draft"` bag lar: URI | high | structural completeness |
| Room self-ref tiddler | high | pattern parity |
| `catalog.corpora` Record retirement | medium | dual source-of-truth |
| Connect screen (`readBootstrap() === null`) | high | user-facing cold boot |
| `meme-provider.ts` hardcoded `"room"` bag | medium | needs roomId context |
| Web2 cleanup (`reaction-query.web2.ts`, `LarariumPanel.web2.tsx`) | low | dead code |
| `LarDiskProjector` migration | low | independent |

### Project OODA-HA — higher zoom

✶ **Observe:** M17–M20 completed the identity layer. Every Automerge doc has a stable `lar:` URI = CompositeStore bag ID = `bag` field on every tiddler it owns. The oracle chain is complete: fragment → ha → ka → ba → corpus leaves → room leaf. Three packages build clean.

⏿ **Orient:** Three zoom levels remain. Zoom 1 (cleanup, M21): `"draft"` URI, room self-ref, catalog.corpora retirement, connect screen. Zoom 2 (architecture, Phase 4): TW5 VM recipe derived dynamically from `CompositeStore.layerIds()` — makes the wiki a direct projection of the Automerge topology; unlocks room-switching, federation bag injection, Keyhive derivation. Zoom 3 (federation, Phase 5): Keyhive group-identity integration; Tiga = root group; corpus URIs = Keyhive document identifiers.

◇ **Decide:** M21 = cleanup sprint (no design questions, execute fast). Connect screen = M22 (user-facing gate). Phase 4 spike (TW5 recipe from topology) starts in M22 or M23. Phase 5 (Keyhive) follows Phase 4.

▶ **Phase boundary:** M17–M20 closes Phase 3 (identity + oracle layer). M21 opens Phase 4 (TW5 recipe from topology).

⤴ Build status: `@lararium/core` ✓ `@lararium/node` ✓ `@lararium/app` ✓

↺ Residue carried: isomorphic `AutomergeStoreBase`, grammar-wired deserializer, browser Playwright QA, `LarDiskProjector` migration.

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #to-roadmap ? -> lar:///lararium-node/ROADMAP family:relation role:companion >>
<<~ pranala #to-wiki ? -> lar:///LARARIUM-NODE/MULTIPLAYER-INFINITE-CANVAS-WIKI family:relation role:companion >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
