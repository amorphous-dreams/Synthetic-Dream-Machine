# Lares Handoff — Active Work Only

> Updated: 2026-05-14
> Branch: `feature/lararium-node-3`
> Last sprint archive: `wikis/lares-history/last-sprint/`

## Bootstrap Paste

```text
Resume from packages/HANDOFF.md and packages/ROADMAP.md.

Current baseline: quine/genesis, TW5 content-addressed core boot, admin VM,
command-tiddler CLI, Keyhive concap, bag residency, wiki composition,
plugin-tiddler boot, load-bearing sigil cascade path, save-side split,
recursive child co-promotion, Node VM / worker-thread lift, and the
sigils-as-wikitext sprint (see "What Changed This Turn") are treated as
landed unless tests prove drift.

Next work, in order:
1. Path T-1: collapse lar-sigil-inline into lar-sigil (block-only rule),
   remove macrocallinline/macrocallblock from memetic-parser deny list.
2. Path ~ahu: retire ahu.ts to \widget ~ahu wikitext (child URI filter,
   body encoding via named string param).
3. Path K / F-arc: TW5 routing rules + 300–500ms debounce + projection
   auto-truncate.
4. Path L / S7.4: admin-doc ingress trust gate via Keyhive cap=infrastructure.

Rules: preserve TW5 VM primacy, bag=Automerge-doc=sync-boundary, no HTTP/RPC
coordination surface, and explicit operator promotion for canon.
```

## What Changed This Turn (2026-05-13 → 2026-05-14)

### Sigils-as-Wikitext Sprint — `lararium-tw5`

**Cleanup** (committed separately):
- Converted `implementors`, `edge`, `toml-field`, `memes` filters from
  `library`+barrel to `filteroperator` module-type (self-register via TW5).
- Added `all-memes.ts` `allfilteroperator` for `[all[memes]]` syntax.
- Added `src/modules/md-file-router.ts`: startup overrides `.md` →
  `text/x-md-auto`; deserializer peeks SOH DOCTYPE sigil on line 1,
  delegates to memetic or markdown.
- Deleted `tw5-filter.ts`, `tw5-widgets.ts` (barrel chain eliminated),
  `zoom-layout.ts`, `filters/bag.ts`, `filters/bag-path.ts`,
  `widgets/lar-meme-split.ts`.
- Fixed `vite.plugin.config.ts` regex escaping.

**T-0** — Trimmed `memetic-parser.ts` deny list to `macrocallinline`/
`macrocallblock` only. Removed `codeblock`, `codeinline`, `commentblock`,
`commentinline`, `entity`, `dash` (all proven vestigial — deserializer strips
carrier sentinels upstream).

**T-2** — Added `src/wikirules/lar-sigil-pragma.ts` (`module-type: wikirule`,
pragma type). Matches `\sigil NAME(params)` lines; emits
`isSigilDefinition: true` parse-tree node. Hook open for complex sigil
behaviors without JS widget rewrite.

**T-3** — Added `tiddlers/sigil-dispatcher.tid`: `\widget ~(name p1…p5)`,
tagged `$:/tags/Global`. Uses `$genesis $type=$~{name} $remappable="no"` to
dispatch to per-sigil `\widget ~name` tiddlers.

**`aka`/`kahea` design** (research + prior art):
- Both sigils use `<$tiddler tiddler=<<target>>><$transclude $tiddler=<<template>>/></$tiddler>`.
  Template selection: `p2` explicit > cascade (`$:/tags/Lar/{Aka,Kahea}Template`) > fallback.
  Cascade evaluates in the calling context (before `$tiddler` shifts it).
- `aka` default template: collapsible `<details>` quoteblock. Two CSS states:
  `.lar-aka-local` (target exists) / `.lar-aka-shadow` (off-wiki). Preview
  image: `thumbnail` field when present; DuckDuckGo favicon fallback for
  HTTP/HTTPS URIs (`onerror` hides offline). `lar:///` URIs skip favicon path.
- `kahea` default template: full inline block. `.lar-kahea-missing` link when
  target not local.
- Semantics locked: `aka` = `rdfs:seeAlso`/`skos:closeMatch` (read-only
  projection, canonical at source). `kahea` = live summoning (entity present,
  late-binding render).
- `TW5Engine.wiki` getter, `.renderText()`, `.setTiddler()` added (smoke
  script required these).
- Design record: `bags/@lararium/tw5/sigil-aka.md` (Tier 2 OG metadata fetch
  deferred to `lararium-node` disk-projector sprint).

**Widget retirement** (5 JS widget files → wikitext tiddlers):
- Wikirules now emit `{ type: "macrocall" }` parse-tree nodes for five sigils
  instead of `{ type: "sigil-name" }`. TW5's `MacroCallWidget` routes them
  through `\widget` tiddler definitions — no JS widget class needed.
- New tiddlers: `sigil-aka`, `sigil-kahea`, `sigil-loulou`,
  `sigil-pranala-header`, `sigil-pranala` (all `$:/tags/Global` +
  `$:/tags/LarariumGrammar`).
- `pranala` uses named params directly (bypasses `~` dispatcher — 6 named
  bindings exceed the dispatcher's `p1…p5` positional signature).
- Deleted: `aka.ts`, `kahea.ts`, `loulou.ts`, `pranala-header.ts`,
  `pranala.ts`, `_cascade-sigil-base.ts`. Net: −296 lines JS.

**Surviving JS widgets** (not yet retireable):
- `ahu.ts` — child URI resolution logic + body-slot encoding. Talk-story
  needed for `\widget ~ahu` filter expression + named-string body param.
- `kau.ts` — `registerKauCapabilityHook`, `registerKauWriteBackHook`, kumu
  instance lookup. Capability hooks require JS.
- `render-modes.ts` — kau projection-mode dispatch; dissolves when kau's
  markdown-meme path folds into a cascade entry.

## Active Objective

Ship the next alpha stability layer for live wiki authoring and operator-device
federation. The sigils-as-wikitext sprint clears JS surface area and hardens
the TW5 wikitext dispatch chain for the remaining sigil vocabulary.

### Path T-1 — Wikirule Collapse (unblocked)

The `<<~ ? -> uri >>` pranala-header form appears only post-SOH in the
carrier stream — the deserializer consumes it, the wikiparser never sees it.
This removes the last T-1 blocker.

- Merge `lar-sigil-inline.ts` into `lar-sigil-block.ts` → single `lar-sigil.ts`
  with `{ block: true }` only.
- Remove `macrocallinline` and `macrocallblock` from `DEFAULT_RULES_EXCEPT` in
  `memetic-parser.ts`.
- Leaf forms (`<<~ aka uri >>` in inline context) fall through to
  `macrocallinline` → `MacroCallWidget` → `\widget ~` dispatcher.
- Block forms (`<<~ ahu #slot >>…<<~/ahu >>`) still claimed by the block rule.

### Path ~ahu — Retire Last Non-kau JS Widget

Child URI filter expression (wikitext equivalent of `ahu.ts` resolution):
```
{{{ [<uri>!match[]!regexp[^lar:///unknown]] ~[<slot>regexp[^lar:]] ~[<currentTiddler>addsuffix<slot>] }}}
```

Remaining design question: how `\widget ~ahu` receives the block form's body
content. Options: named string param `body` (same as pranala), or `$slot`
fill from a `macrocall` node with child `$fill` elements. Needs talk-story.

### Path K / F-arc — Save Path Hygiene

- `$:/state/*` → projection layer, not durable canon/draft.
- `Draft of *` → per-wiki draft bag.
- 300–500ms debounce in `MemeSyncAdaptor`.
- Idle auto-truncate for noisy projection state.
- Single parser/split law across disk sync, CRDT inbound, TW5 UX save, disk export.

### Path L / S7.4 — Admin Doc Trust Gate

- Gate admin-doc WebSocket ingress on Keyhive `cap=infrastructure` proof.
- Operator-owned devices only; room peers rejected.
- Preserve command-tiddler coordination surface.
- Add positive + negative smokes.

### Path G.rest — Remaining Sigil Vocabulary

`lele`, `papalohe`, `pae` — no JS widget needed; each follows the same
wikirule `macrocall` emission + `\widget ~name` tiddler pattern now established
for the five retired sigils. Talk-story per sigil to fix template contracts.

### Path R — Verify Before Extending

Inspect `node-vm-manager.ts`, `lar-wiki-worker.ts`, and tests before coding:
- Does the Worker apply real Automerge changesets locally?
- Does `routeChangeset()` derive added/deleted URI sets from real changes?
- Does `ReactionEngine.onChangeset()` run after TW5 state updates in Worker?
- Do tests cover mount, route, event-forward, unmount, snapshot capture?

## Architecture Laws To Preserve

- **Bag = Automerge doc = sync boundary.**
- **TW5 VM primacy.** If logic can live in the VM, keep it there.
- **Command-tiddlers, not HTTP/RPC.** CLI and daemon coordinate through the admin doc.
- **Canon requires operator promotion.** Git diff remains the visible signature.
- **Admin doc stays infrastructure-only.** Federates to operator devices, not room peers.
- **Hot wiki = TW5 + RE together.** Synchronous tick semantics require co-location.
- **Memetic wikitext = TW5 superset.** No deny-list items without a carrier-stream justification.
- **Sigil dispatch via wikitext.** JS widgets only for JS-level semantics (capability hooks, async device I/O).

## Useful Smokes

```sh
# Fast package suites
pnpm test:unit

# Isolated integration flows under tests/
pnpm test:flows
pnpm test:tw5-flow

# Quine / peer boot parity
pnpm --filter @lararium/tw5 build
pnpm --filter @lararium/node typecheck
pnpm --filter @lararium/node exec tsx scripts/test-quine.ts

# Plugin boot smoke (checks shadow tiddlers + widget registry + render probes)
pnpm --filter @lararium/tw5 exec tsx scripts/smoke-plugin-boot.ts

# Manual daemon/CLI path
lares reset --force
lares serve
lares status
lares wiki list
lares promote lar:///definitely-not-real --to lar:///ha.ka.ba/@lares --yes
```

## Test Layout

- Active package tests: `packages/*/tests/`.
- Active daemon/CLI flows: `tests/lararium-tw5/`, run via `tests/bin/run-flow.sh`.
- Old HUD / memes / chats behavioral plans: `tests/chats/`.

## Do Not Re-Decide

- `@lares/cli` remains its own package.
- `@keyhive/keyhive` / concap remains the capability substrate; do not pivot to UCAN.
- `lares promote` means explicit operator ceremony, not automatic sync.
- Canonical Lares system tiddlers use `lar:///` titles.
- `<<~/sigil >>` closing tag convention (not `<<\~sigil>>`); the `/end` HTML convention holds.
- Remaining docs/history belong under `wikis/lares-history/`, not active handoff files.
