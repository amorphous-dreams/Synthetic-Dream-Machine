# Lares Handoff — Active Work Only

> Updated: 2026-05-15 (turn 6)
> Branch: `feature/lararium-node-4`
> Last sprint archive: `wikis/lares-history/last-sprint/`

## Bootstrap Paste

```text
Resume from packages/HANDOFF.md and packages/ROADMAP.md.

Current baseline: quine/genesis, TW5 content-addressed core boot, admin VM,
command-tiddler CLI, Keyhive concap, bag residency, wiki composition,
plugin-tiddler boot, sigil cascade architecture, save-side split, recursive
child co-promotion, Node VM / worker-thread lift, full sigils-as-wikitext
sprint (T-1 wikirule collapse, URI fragment resolution, ahu.ts retirement,
deserializer root-iam fix, build pipeline clear-before-rebuild),
SharktoothSigil grammar inversion + aka/kahea mode= collapse sprint,
lar:-URI namespace + mode= retirement + English alias sigil sprint,
concurrency sigil cluster + grammar self-hosting + kumu-device UEFN alignment
sprint, AND the kau.ts → TW5-native wikitext migration (kau.ts + render-modes.ts
deleted; \widget ~kau + template cascade in sigil-kau.tid; zero JS sigil widgets
remain) are treated as landed unless tests prove drift.

Next work, in order:
1. UEFN scene importer — .verse class defs + .umap instance placements + DEB
   wires → Automerge bag of tiddlers + pranala edges. Spec: bags/@lares/api/v0.1/pono/uefn-scene.md.
2. Path K / F-arc: TW5 routing rules + 300–500ms debounce + projection
   auto-truncate.
3. Path L / S7.4: admin-doc ingress trust gate via Keyhive cap=infrastructure.

Rules: preserve TW5 VM primacy, bag=Automerge-doc=sync-boundary, no HTTP/RPC
coordination surface, and explicit operator promotion for canon. Web3 only —
no web2 models/code/flows in Lares stack.
```

## What Changed This Turn (2026-05-15 turn 6)

### kau.ts → TW5-Native Wikitext Migration

**No JS sigil widgets remain in the plugin.**

- `packages/lararium-tw5/src/widgets/kau.ts` — deleted. Was 150-line JS widget class (placement/invocation render, render-mode dispatch, Keyhive stubs).
- `packages/lararium-tw5/src/widgets/render-modes.ts` — deleted. Was `dispatchSlotRenderMode()` helper; comment on it said "dissolves when kau markdown-meme path folds into cascade." Dissolved.

**New TW5-native tiddlers (`packages/lararium-tw5/tiddlers/`):**
- `sigil-kau.tid` — rewritten: `\widget ~kau(p1:"")` with `p1` parse (fragment/name/props via `<$set>` conditionals), template cascade dispatch, placement vs invocation branching. Plus `\procedure ~kahea~kau` and `\procedure ~aka~kau` mirroring sigil-ahu.tid exactly.
- `kau-template-html.tid` — HTML render: placement gets `<div class="lar-kau lar-kau-place">`, invocation gets `<div class="lar-kau lar-kau-invoke">`. Hole slot when def missing.
- `kau-cascade-html.tid` — cascade config tagged `lar:///ha.ka.ba/tags/kau-template`.
- `kau-template-markdown-meme.tid` — `<<~ kahea kau {{!!slot}} >>` (same pattern as ahu).
- `kau-cascade-markdown-meme.tid` — `list-before` ordered, `lar-export-scope` conditioned.

**Keyhive stubs** (`registerKauCapabilityHook`, `registerKauWriteBackHook`) dissolved with no replacement. When Keyhive WASM lands, these surface as TW5 action tiddlers consistent with TW5 VM primacy — not JS module hooks.

**Architecture law now fully holds:** "Sigil dispatch via wikitext. JS widgets only for JS-level semantics (capability hooks, async device I/O)." No sigil has JS-level semantics today, so the plugin carries zero JS sigil widgets.

**Updated docs:** `bags/@lares/api/v0.1/pono/kau.md`, `bags/@lararium/tw5/widgets/kau.md`, `memetic-wikitext.tid` render-modes note, `lar-sigil-shared.ts` comment, ROADMAP.

**Build:** typecheck clean; 16 Vite modules (was 17); 114 inner tiddlers; 38 shadow tiddlers in smoke; all probes pass.

---

## What Changed This Turn (2026-05-15 turn 5)

### Concurrency Sigil Cluster + Grammar Self-Hosting + kumu-device UEFN Alignment

**New pono specs (bags/@lares/api/v0.1/pono/):**
- `hui.md` — await-all sync (`sync`); MUST spawn all, MUST NOT resume until all complete.
- `holo.md` — cancelling race (`race`); first wins, all losers cancel immediately.
  English alias: `\race`. Distinct from `puka/\rush` (no-cancel).
- `uefn-scene.md` — architecture spec: 3 tiddler kinds (type meme, instance meme, scene meme)
  + edge vocabulary + TW5 filter views + Verse effect specifier → sigil mapping.
  Import pipeline declared unresolved (pending sprint).

**New/updated SharktoothSigil tiddlers (packages/lararium-tw5/tiddlers/):**
- `sigil-lele.tid` — detached spawn; `lar-kind: concurrency`; Verse `spawn`.
- `sigil-hui.tid` — await-all; `lar-kind: concurrency`; Verse `sync`.
- `sigil-puka.tid` — first-wins no-cancel; `lar-kind: concurrency`; Verse `rush`. Comment corrected.
- `sigil-holo.tid` — NEW; cancelling race; `lar-kind: concurrency`; Verse `race`.
- `sigil-race.tid` — NEW; `lar-kind: concurrency-alias`; `lar-alias-for: holo` (corrected from puka).
- `sigil-rush.tid` — `lar-kind: concurrency-alias`; `lar-alias-for: puka`.
- `sigil-sync.tid` — `lar-kind: concurrency-alias`; `lar-alias-for: hui`.
- 8 `sigil-family-*.tid` — `lar-kind: family`; tiddlerizes all 8 edge-family contracts.

**Grammar self-hosting complete (memetic-wikitext.tid):**
- Removed 6 concurrency `[[sigils]]` TOML blocks (lele, hui, puka, \sync, \race, \rush).
- Removed entire `[[families]]` TOML fence (8 family definitions).
- Final state: 1 `[[sigils]]` block (the permanent `toml` data fence). 0 `[[families]]` blocks.
- Wild-magic property holds: grammar = SharktoothSigil tiddlers only.

**`grammar-cache.ts` — `FamilyRule` tiddlerization:**
- `familyFromFields()` derives `FamilyRule` from `lar-kind: family` tiddlers.
- `sigilFromFields()` short-circuits on `lar-kind === "family"`.
- `buildGrammarFromWiki()` partitions tiddlers into sigils and families; merges with TOML fallback.

**`kumu-device.ts` — UEFN 5.6+ alignment:**
- `KumuListenable.verseKind?: "listenable" | "event"` — `event(T)` vs `listenable(T)` distinction.
- `KumuListenable.payloadType?: string` — Verse type string for the event payload.
- `KumuSubscribable.payloadType?: string` — payload type for DEB wiring.
- `KumuSubscribable.effects?: readonly string[]` — Verse effect specifiers (`<suspends>`, `<decides>`, etc.).
- Doc comment corrected: `using { /Path }` = module import, not trait composition.

**`scanner.ts` yin pass + concurrency additions:**
- `wai` BOOTSTRAP_SCANS removed (retired sigil). `\if → heihei` canonicalName corrected.
- `hui`, `holo`, `puka` open/close scans added to BOOTSTRAP_SCANS.

**`builder.ts` yin pass:**
- `case "wai"` removed; `case "heihei"` and `case "kahawai"` handle conditional filter extraction.

**`pranala-families.md` — back-edges added:**
- 8 `<<~ pranala #tiddler-sigil-family-{name} >>` edges to all family tiddlers.

**Build:** All tests pass. Grammar fully self-hosted in SharktoothSigil tiddlers.

**Verse doc URI (from internal research):**
- `dev.epicgames.com/documentation/en-us/fortnite` — UEFN/Verse official docs root.

---

## What Changed This Turn (2026-05-14 turn 4)

### lar: URI Namespace Migration + mode= Retirement + English Alias Sigils — `lararium-tw5`

**mode= retired from all sigil procedures:**
- `~kahea(p1 p2)` — KaheaTemplate cascade only; no mode param.
- `~aka(p1 p2)` — own AkaTemplate cascade; no delegation to ~kahea with mode="shadow".
  ~aka's render posture difference lives in the template cascade, not in sigil dispatch.
- `~ahu(slot uri p1)` — AhuTemplate cascade only; no mode param.
- `~aka~ahu(slot uri p1)` — own AkaTemplate cascade for child-slot projection; own implementation.
- `~(name p1 p2 p3 p4 p5)` dispatcher — mode param removed; threads only p1-p5.
- `~kahea~ahu(slot uri p1)` — passes through to ~ahu without mode.

**lar: URI tag migration (owned namespace, not TW5 core contracts):**
- `$:/tags/Lar/AhuTemplate` → `lar:///ha.ka.ba/tags/ahu-template`
- `$:/tags/Lar/AkaTemplate` → `lar:///ha.ka.ba/tags/aka-template`
- `$:/tags/Lar/KaheaTemplate` → `lar:///ha.ka.ba/tags/kahea-template`
- `$:/tags/Lar/LoulouTemplate` → `lar:///ha.ka.ba/tags/loulou-template`
- `$:/tags/Lar/PranalaTemplate` → `lar:///ha.ka.ba/tags/pranala-template`
- `$:/tags/Lar/PranalaHeaderTemplate` → `lar:///ha.ka.ba/tags/pranala-header-template`
- `$:/tags/LarariumGrammar` removed from `memetic-wikitext.tid` tags (superseded by SharktoothSigil)
- `$:/tags/LarariumKumu` → `lar:///ha.ka.ba/tags/kumu` (kau.ts)
- `$:/config/Lar/MemeticRulesExcept` → `lar:///ha.ka.ba/config/memetic-rules-except` (memetic-parser.ts)
- All cascade tiddlers (`*-cascade-*.tid`) tags fields updated.

**English alias sigil tiddlers (new; SharktoothSigil-tagged):**
- `sigil-procedure.tid` — `lar-kind: pragma-alias`, `lar-alias-for: \procedure`; with cross-ref to `wehe`
- `sigil-define.tid` — `lar-kind: pragma-alias`, `lar-alias-for: \define`; deprecated in favour of \procedure
- `sigil-widget.tid` — `lar-kind: pragma-alias`, `lar-alias-for: \widget`
- `sigil-function.tid` — `lar-kind: pragma-alias`, `lar-alias-for: \function`
- `sigil-if.tid` — `lar-kind: control`; `\procedure ~\if` body uses TW5 `<%if filter%>...<%endif%>`
- `sigil-for.tid` — `lar-kind: control`; `\procedure ~\for` body wraps `<$list filter=...>`
- All carry `lar-alias-for` cross-refs to the Hawaiian equivalents (wehe, huli, etc.) where applicable.

**Build:** 42/42 + 39/39 tests pass. Smoke clean. 33 shadow tiddlers.

---

## What Changed This Turn (2026-05-14 turn 3)

### SharktoothSigil Grammar Inversion + aka/kahea Collapse — `lararium-tw5`

**Grammar inversion — `grammar-cache.ts` radical rewrite:**
- Canonical grammar tag: `lar:///ha.ka.ba/tags/SharktoothSigil` (replaces
  `$:/tags/LarariumGrammar` as grammar registration signal).
- `getGrammar()` now reads sigils from all `[tag[lar:///ha.ka.ba/tags/SharktoothSigil]]`
  tiddlers via their `lar-*` fields (`lar-kind`, `lar-pattern`, `lar-open-pattern`,
  `lar-close-pattern`, `lar-alias-for`, `lar-default-family`, `lar-layer`, etc.).
- TOML monolith (`memetic-wikitext.tid`) supplies families + unmigrated sigil fallback.
  Tiddler sigils take precedence by name. Each migrated sigil's TOML block becomes dead
  code removable in the next pass.
- Change listener watches `SharktoothSigil`-tagged tiddler changes AND `GRAMMAR_MEME_URI`.
- New pattern: adding a sigil to the wiki = tagging a tiddler. No code change required.

**`aka`/`kahea` semantic collapse via `mode=`:**
- `~kahea(p1 p2 mode:"live")` — unified transclusion widget; `mode="shadow"` picks
  `AkaTemplate` cascade instead of `KaheaTemplate`. One widget, two rendering postures.
- `~aka(p1 p2)` — collapsed to pure delegate: `<$transclude $variable="~kahea" mode="shadow"/>`.
  No duplicate implementation. Projection boundary = `mode` param, not parallel procedures.
- `~ahu(slot uri p1 mode:"live")` — `mode` threads to template tag:
  `mode="live"` → `AhuTemplate`, `mode="shadow"` → `AkaTemplate`.
- `~kahea~ahu(slot uri p1 mode:"live")` — passes `mode` to `~ahu`.
- `~aka~ahu(slot uri p1)` — delegates to `~kahea~ahu(mode="shadow")`. Freeze semantics
  now live in the template cascade, not in duplicate procedure stubs.
- `~` dispatcher gains `mode:"live"` param — threads through to all compound sigil procedures.
- **`mode=` aligns with pranala sugar:** `~aka` ≡ `pranala family:observe` (frozen read);
  `~kahea` ≡ `pranala family:dataflow` (live push). The `mode` param is the short-form
  for pranala `family:` in transclusion space.

**`BLOCK_CLOSERS` + `GRAMMAR_NAME_MAP` cleanup:**
- `BLOCK_CLOSERS` shrunk from 20 → 3 entries: `{ahu, pranala, kahea}` (boot-critical only).
  All other block sigil closers load from grammar via `buildClosers()` + `closePatternToTag()`.
- `GRAMMAR_NAME_MAP` retired. `sigil-kahea.tid` merges both leaf and block forms under one
  canonical name `"kahea"` — no TOML naming seam needed.
- `CompoundSigilMatch.slotType` renamed → `closeKey`; compound forms carry `word1` (e.g.
  `"kahea"`) as the closer lookup key — fixes `<<~ kahea ahu #slot >>body<<~/kahea >>` block detection.
- `closePatternToTag()` added: converts TOML regex `close_pattern` strings to literal
  `indexOf` tags for `findCloseEnd`.

**SharktoothSigil tiddler migrations (7 sigils):**
- `sigil-ahu.tid` — `lar-kind: child-slot` + `lar-open/close-pattern`; `mode` param added.
- `sigil-kahea.tid` — `lar-kind: edge-sugar` + merged block pattern fields; `mode` param.
- `sigil-aka.tid` — `lar-kind: edge-sugar` + `lar-alias-for: kahea`; collapsed to delegate.
- `sigil-loulou.tid` — `lar-kind: edge-sugar` + `lar-pattern`.
- `sigil-pranala.tid` — `lar-kind: edge` + `lar-inline/block-pattern`.
- `sigil-pranala-header.tid` — `lar-kind: header` + `lar-pattern`.
- `sigil-kau.tid` — NEW; `lar-kind: child-slot` + `lar-pattern`; no wikitext body yet
  (kau.ts still JS widget at this turn); restores `kau` child-slot detection after grammar loads. (Fully migrated in turn 6.)

**`memetic-wikitext.tid` shrink:**
- 7 `[[sigils]]` blocks removed (ahu, pranala, loulou, aka, kahea-block, kahea URI form,
  pranala-header). 46665 → 42091 chars. 48 TOML sigil blocks remain; each migrates to a
  SharktoothSigil tiddler in Path G.SharktoothSigil.

**Build:** 42/42 tests pass. Smoke clean. 33 shadow tiddlers. No regressions.

---

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

**Retired this turn (2026-05-14):**
- `ahu.ts` → `sigil-ahu.tid` (`\widget ~ahu` + `\procedure ~kahea~ahu`).
  `lar-sigil.ts` now emits `~kahea~ahu` macrocall for all ahu forms.
  Decompose path (`splitRecursive`) confirmed already correct.
  Pattern for future child-slot sigils: `~kahea~<sigilName>(slot:"" uri:"" p1:"")` → delegates to `~<sigilName>`.

## Active Objective

Ship the next alpha stability layer for live wiki authoring and operator-device
federation. The sigils-as-wikitext sprint clears JS surface area and hardens
the TW5 wikitext dispatch chain for the remaining sigil vocabulary.

### Path T-1 / ~ahu — Done

`lar-sigil.ts` now owns the collapsed block+inline wikirule. `ahu.ts` has been
retired to `sigil-ahu.tid`; the boot smoke checks the wikitext sigil tiddler
and leaves rendered sigil behavior to integration flow tests.

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

### Path G.SharktoothSigil — Remaining Sigil Vocabulary

48 TOML `[[sigils]]` blocks remain in `memetic-wikitext.tid`. Each migrates
to a SharktoothSigil tiddler (`lar-*` fields + `\widget` wikitext body). When
all migrate, the TOML shrinks to families-only and the grammar monolith dissolves.

Migration order by operator impact (see ROADMAP for talk-story per category):
1. Block-container sigils with `close_pattern` (wehe, meme, hui, heihei, wai, huli, puka)
2. Scope/binding sigils (\let, \var, \const, waiho)
3. Concurrency sigils (\sync, \race, \rush)
4. OODA-HA narrative sigils (lele, papalohe, pae) — Path G.rest renamed into this arc
5. Control/conditional sigils (\if, \else, \elif, \for) — wikitext \procedure bodies
6. Pragma/declaration sigils (\procedure, \define, \widget, \type) — TW5 shadow forms
7. Remaining edge/data/device sigils (kumu, \widget, toml, etc.)

`mode=` aligns across all: live = current rendering posture, shadow = frozen/projection.
Any sigil with a shadow template variant gets `aka`-style behavior automatically.

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
- **Sigil dispatch via wikitext.** All sigil widgets live as TW5 `\widget` tiddlers. JS widgets only for JS-level semantics (async device I/O, future Keyhive WASM hooks).

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

# Plugin boot smoke (checks shadow tiddlers + JS widget registry + deserializer probes)
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

- `$:/tags/LarariumGrammar` ← **superceded by `lar:///ha.ka.ba/tags/SharktoothSigil`** (grammar-cache.ts rewritten); retire from all remaining tiddlers in the namespace migration pass
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
