<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///lararium-node/ROADMAP >>

<<~ ahu #iam >>

```toml
uri-path     = "lararium-node/ROADMAP"
file-path    = "lares/lararium-node/ROADMAP.md"
content-type = "text/x-memetic-wikitext"
tagspace     = "adjacent"
register     = "CS"
confidence   = 0.90
mana         = 0.88
manao        = 0.86
role         = "lararium-node milestone map and open pressure register"
cacheable    = true
retain       = true
```

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #m1-m9 >>

## Milestones M1–M9 (closed)

- **M1** — pnpm monorepo scaffolded; Python MCP ported to TypeScript; 19/19 parity tests pass
- **M2** — `@lararium/core` parser + AST (`MemeAstNode`, `WorksiteNode`, `ControlNode`, `TextNode`); 5 scope principles locked
- **M3** — Kowloon integration model: lararium node = Kowloon server, room = Group, Circles as visual graphs
- **M4** — Law of Fives invariant model: `LADDER_5` / `OODA_HA_5` const arrays; stances→tools mapping correct
- **M5** — `ReactionGraph` async-first; kumu = UEFN device type + TW5 widget type; TW5↔Verse pipeline defined
- **M6** — Automerge-repo peer sync; `/meme-sync` WS; receipt via HTML `<meta>` tag; `LarDiskSyncAdaptor` derives paths via `resolveLarUri()` (no stale index)
- **M7** — `LarariumPanel` (HUD chip + TW5 wiki panel merged); `⌘K` + `` ` `` hotkeys; shadow DOM mount survives open/close
- **M8** — Kumu defs as first-class memes (`$:/tags/LarariumKumu` + `kumu-name`); `KumuWidget` filter-queries wiki; `injectKumuDefs` pipeline tombstoned
- **M9** — Native TW5 filter operators (`edge:`, `toml:`, `all[memes]`); ahu typed child tiddlers (TOML fence → fields); server-is-peer confirmed; dead code removed

<<~/ahu >>

<<~ ahu #m10 >>

## M10 — Local-First TW5 VM (closed 2026-04-29)

Feature branch: `feature/lararium-node-3`

### Closed

- **Streams plugin** — sq/streams v1.2.24 vendored at `lar:///ha.ka.ba/api/v0.1/vendor/sq-streams`; Streams compat fields (`parent`, `stream-list`, `stream-type`) emitted alongside ahu fields from `splitCarrierToTiddlers`; vendor pipeline: `lares/ha-ka-ba/api/v0.1/tw5-plugins/*.json` → `generated-vendor-plugins.ts` → preloaded at boot
- **Mixed prose/children** — `generateParentText()` walks AST in document order after STX; emits `<$transclude tiddler="uri#slot" mode="block"/>` for WorksiteNodes and inline prose for TextNodes; interleaved content (daemon-in-the-walls pattern) preserved
- **Template rendering** — parent `text` is mixed wikitext (transcludes + prose); `carrier-text` field holds raw carrier for disk write-back; meme template tiddler preloaded
- **Peer-correct disk projector** — `LarDiskProjector` (was `LarDiskSyncAdaptor`) subscribes to Automerge store directly (not TW5 wiki events); receives ALL changes (local + remote peer) with `ChangeOrigin`; `writing` Set exposed for file watcher echo-loop guard
- **WorksiteWidget anchor** — pure structural anchor (`data-lar-slot` span, no `renderChildren`); template owns all slot content rendering; no double-render
- **Slot overlay UI** — `meme-view-children.md`: slot-name labels + inline-edit buttons; `meme-edit-children.md`: `$edit-text` per non-body slot; `ahu-breadcrumb.md`: parent link for child tiddlers; `ahu-styles.md`: stylesheet
- **TOML fence stripping** — leading ` ```toml ``` ` stripped from child display text in `splitCarrierToTiddlers`; metadata parsed into fields, not shown in body
- **`serializeCarrier` round-trip fix** — now prefers `carrier-text` field over `parent.text` (which is mixed wikitext)

### Invariants added in M10

- `carrier-text` field = raw on-disk carrier format; `parent.text` = TW5 VM wikitext; never conflated
- `LarDiskProjector` is a store subscriber, not a TW5SyncAdaptor; echo-loop prevented by `writing` Set
- WorksiteWidget renders no children; template owns slot content
- Streams compat fields emitted alongside ahu fields; both filter dialects work natively
- `serializeCarrier` reads `carrier-text` first, not `parent.text`

<<~/ahu >>

<<~ ahu #m11 >>

## M11 — Browser QA + e2e Gates (active)

**Goal:** first successful manual browser QA run + Playwright smoke test passing.

### P0 — Manual browser QA

Steps to validate:
1. `pnpm run dev` in `packages/lararium-node`
2. Open `http://localhost:PORT` in browser
3. Verify: `<meta name="lararium-receipt">` present, `openPhase === "live"`, BootSplash clears
4. Open `⌘K` panel — TW5 wiki loads, lar: memes visible
5. Navigate to a carrier meme with ahu slots — verify mixed prose + children render
6. Edit a slot inline — verify Automerge sync, no echo loop in server console
7. Verify no double-render of slot content

**Not yet completed.** All prior development has been unit-test-gated only.

### P1 — Playwright e2e smoke

```
packages/lararium-node/
  — separate playwright.config.ts from jest.config.cjs
  — pnpm script: "test:e2e": "playwright test"
  — smoke: server starts, meta tags present, BootSplash disappears
  — verify: lararium-receipt non-null, openPhase === "live", no console errors
```

### P2 — tw-filter.test.ts pre-existing failure

1 pre-existing failure: `[tag[lar:///...invariant]]` returns 0. Investigate: tag field type, URI encoding in TW5 tag index.

### P3 — CSS variable resolution

`ahu-styles.md` uses `<<colour primary>>` macros. Need a live TW5 palette loaded at boot (or replace with hard-coded values for now).

<<~/ahu >>

<<~ ahu #m12 >>

## M12 — Room Recipe Partitioning (future)

**Goal:** per-room Automerge docs; room recipe → filtered meme subset per client.

- All clients currently share one Automerge meme-store doc
- `/room/:roomId` HTTP routing exists; per-room recipe/doc is M12+
- Legacy `TLSocketRoom` + SQLite layout channel: retire or repurpose decision pending

<<~/ahu >>

<<~ ahu #m13 >>

## M13 — Chapel Perilous Draft Workflow (future)

**Goal:** operator draft → filter-lookup priority → `/admin/promote` ceremony.

- `chapel-perilous-opens/` draft directory (architecture defined, not coded)
- Filter-lookup priority: drafts shadow canon until promoted
- Promote ceremony: `/admin/promote` patches Automerge doc + writes disk atomically

<<~/ahu >>

<<~ ahu #m14 >>

## M14 — Source Meme Expansion (future)

- Priority source file list at 7 files (parser, ast, causal-island, live-protocol, lararium-tw5, LarariumPanel, LarariumShell)
- Expand as agent navigation matures
- Feed into agent OODA-HA loop: source memes visible from inside TW5 wiki panel

<<~/ahu >>

<<~ ahu #open-pressures >>

## Open Pressures (cross-milestone)

- **Track C** — `lararium-tw5.ts` at ~895 lines; split deferred. Extract: boot/mount surface | tiddler-store sync | kumu/filter into sibling modules
- **`templates/meme.md`** — preloaded but no longer used as `{{||template}}` delegate (superseded by `generateParentText`); repurpose or mark vestigial
- **Non-SOH `.md` files in templates/** — meme-action.md, meme-combat.md, etc. produce console warnings in `build:ui`; add exclusion list or convert to carriers
- **New slot creation UI** — no UX for adding new ahu slots inline (Streams-style Tab/Enter); design pending
- **Parent `carrier-text` staleness** — when child edited inline, parent tiddler's `carrier-text` in TW5 is stale until next Automerge resync; disk write-back correct (reads from disk), but TW5 VM holds stale copy

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #to-session ? -> lar:///SESSION family:relation role:companion >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
