# Lares Handoff — Active Work Only

> Updated: 2026-05-14
> Branch: `feature/lararium-node-3`
> Last sprint archive: `wikis/lares-history/last-sprint/`

## Bootstrap Paste

```text
Resume from packages/HANDOFF.md and packages/ROADMAP.md.

Current baseline: quine/genesis, TW5 content-addressed core boot, admin VM,
command-tiddler CLI, Keyhive concap, bag residency, wiki composition,
plugin-tiddler boot, sigil cascade architecture, save-side split, recursive
child co-promotion, Node VM / worker-thread lift, full sigils-as-wikitext
sprint including T-1 wikirule collapse, URI fragment resolution on all 5 sigil
tiddlers, and deserializer root-iam fix + build pipeline clear-before-rebuild
(see "What Changed This Turn") are treated as landed unless tests prove drift.

Next work, in order:
1. Path ~ahu: retire ahu.ts to \widget ~ahu wikitext (child URI filter,
   body encoding via named string param — talk-story needed).
2. Path K / F-arc: TW5 routing rules + 300–500ms debounce + projection
   auto-truncate.
3. Path L / S7.4: admin-doc ingress trust gate via Keyhive cap=infrastructure.

Rules: preserve TW5 VM primacy, bag=Automerge-doc=sync-boundary, no HTTP/RPC
coordination surface, and explicit operator promotion for canon.
```

## What Changed This Turn (2026-05-14)

### Sigils-as-Wikitext Sprint + Hardening — `lararium-tw5`

**Previously landed (prior turn):** filter self-registration, md-file-router,
memetic-parser deny-list trim (T-0), `\sigil` pragma stub (T-2), `\widget ~`
dispatcher (T-3), `~aka`/`~kahea`/`~loulou`/`~pranala-header`/`~pranala`
wikitext tiddlers, 5 JS widgets retired.

**T-1 — Wikirule Collapse (landed this turn):**
- Merged `lar-sigil-inline.ts` + `lar-sigil-block.ts` → `lar-sigil.ts`.
  Single rule, `types = { block: true, inline: true }`. `findNextMatch` claims
  block container forms (ahu, pranala-block, generic-block) when a closer
  follows; leaf forms return `undefined` and fall through to `macrocallinline`.
- `DEFAULT_RULES_EXCEPT` cleared to `new Set<string>()` — no macrocall rules
  blocked; leaf sigils route through `MacroCallWidget` → `\widget ~` naturally.
- Deleted `lar-sigil-block.ts`, `lar-sigil-inline.ts`.

**URI fragment resolution (landed this turn):**
- All 5 sigil tiddlers (`sigil-aka`, `sigil-kahea`, `sigil-loulou`,
  `sigil-pranala-header`, `sigil-pranala`) now apply
  `[<p1>regexp[^#]] → [<p1>addprefix<currentTiddler>]` before using the URI
  in `<$tiddler>` or `<$let>`. Absolute URIs pass through unchanged.

**Deserializer root-iam fix (landed this turn):**
- `memeticWikitextDeserializer` was treating iam blocks nested inside top-level
  ahu slots as root-level iam, corrupting `preIamContent` / `postIamContent`.
- Fix: limit `extractRootTomlWithPos` search to the region before the first
  top-level ahu block (`findTopLevelAhuBlocks()[0].openStart`).
- Verified: direct TS source test returns 3 tiddlers (root, `#parent`,
  `#parent/child`) with correct fields.

**Build pipeline fix (landed this turn):**
- `vite.plugin.config.ts`: `buildPluginCjsTiddlers()` now calls
  `rmSync(outDir)` + `mkdirSync(outDir)` before the Vite build loop.
  Stale `.js` artifacts (e.g. deleted `lar-sigil-block.js`,
  `lar-sigil-inline.js`) no longer survive into the TW5 CLI pack step.
- `plugin-tiddler.generated.ts` now contains the root-iam fix. Build produces
  56 inner tiddlers; 3/3 active Jest suites pass (42/42 tests).

**Surviving JS widgets** (not yet retireable):
- `kau.ts` — capability hooks + UUID write-back require JS.
- `render-modes.ts` — dissolves when kau markdown-meme path folds into cascade.

**Retired this turn (2026-05-14):**
- `ahu.ts` → `sigil-ahu.tid` (`\widget ~ahu` + `\procedure ~kahea~ahu`).
  `lar-sigil.ts` now emits `~kahea~ahu` macrocall for all ahu forms.
  Decompose path (`splitRecursive`) confirmed already correct.
  Pattern for future child-slot sigils: `~kahea~<sigilName>(slot:"" uri:"" p1:"")` → delegates to `~<sigilName>`.

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

## Downstream Parking Lot — Lararium TW5 `$:/` Namespace Retirement

> Added: 2026-05-14
> Status: parked downstream; do not block current Vite/plugin build tightening.

Policy direction: **our owned tiddlers SHALL live in `lar:///` space** (hosted or
hostless). `$:/` remains acceptable only when addressing TW5 core/system
contracts that TW5 itself owns.

### Actual owned `$:/` title found

Generated compatibility artifact only:

- `packages/lararium-tw5/dist-plugin/lares-memetic-wikitext.tid`
  - `title: $:/plugins/lares/memetic-wikitext`
  - Canonical artifact remains `lar:///plugins/lares/memetic-wikitext`.
  - Decision needed: keep as explicitly non-canonical vanilla TW5 drag/drop
    export, or remove the `$:/plugins/...` variant entirely.

### Owned `$:/` tag/config/state references to migrate

These are not source tiddler titles today, but they are Lararium-owned namespace
surface and should move to `lar:///...` contracts in a later pass:

- `$:/tags/LarariumGrammar`
- `$:/tags/LarariumKumu`
- `$:/tags/Lar/AhuTemplate`
- `$:/tags/Lar/AkaTemplate`
- `$:/tags/Lar/KaheaTemplate`
- `$:/tags/Lar/LoulouTemplate`
- `$:/tags/Lar/PranalaTemplate`
- `$:/tags/Lar/PranalaHeaderTemplate`
- `$:/config/Lar/MemeticRulesExcept`
- `$:/config/Lar/AhuTemplate/...`
- `$:/lararium/parse-warning/...`
- `$:/lararium/parse-warnings`
- `$:/lararium/boot-splash/active`

### TW5-owned `$:/` references that may remain

- `$:/core/...`
- `$:/tags/Global`
- `$:/palette`
- `$:/temp/*`
- `$:/StoryList`
- `$:/HistoryList`
- `$:/state/*`
- `$:/core/templates/exporters/JsonFile`

Migration warning: changing tags/config names affects filters, cascade lookup,
grammar invalidation, parser config, parse-warning routing, and boot-splash UI.
Treat this as a coordinated namespace migration with smokes, not a search/replace.
