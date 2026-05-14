# Lares Active Roadmap — Outstanding Work Only

> Updated: 2026-05-14 (turn 2)
> Branch: `feature/lararium-node-3`
> Archive source: `wikis/lares-history/last-sprint/{HANDOFF,SESSION,ROADMAP}.md`

This roadmap drops sprint archaeology. Last-sprint documents remain in history;
this file carries only open work and ordering pressure.

## Current Baseline

The branch holds: quine/core, content-addressed genesis + TW5 core boot, admin
VM, command-tiddler CLI, Keyhive concap gate, bag residency, wiki composition,
plugin-tiddler boot, sigil cascade architecture for load-bearing sigils,
save-side splitting, recursive child co-promotion, Node VM / worker-thread lift,
the sigils-as-wikitext sprint (filter self-registration, md-file-router,
memetic-parser deny-list trim, `\sigil` pragma stub, `\widget ~` dispatcher,
`~aka`/`~kahea`/`~loulou`/`~pranala-header`/`~pranala` wikitext tiddlers,
5 JS widgets retired, wikirules emit macrocall nodes), **and** T-1 wikirule
collapse (`lar-sigil.ts` single rule, deny list cleared), URI fragment
resolution on all 5 sigil tiddlers, deserializer root-iam fix, and
build pipeline clear-before-rebuild.

Do not re-open those arcs unless a test proves drift.

## Active Priority Order

| Priority | Path | Status | Outcome |
|---|---|---|---|
| — | **T-1** | ✅ Done | `lar-sigil.ts` single rule; deny list cleared; stale build artifacts purged. |
| 1 | **~ahu** | ⬜ Talk-story needed | Retire `ahu.ts` to `\widget ~ahu` wikitext; child URI as filter expression; body encoding design. |
| 2 | **K / F-arc** | ⬜ Next | TW5 save routing, debounce, projection hygiene for sustained editing. |
| 3 | **L / S7.4** | ⬜ Next | Admin-doc ingress trust gate: operator devices with `cap=infrastructure` only. |
| 4 | **G.rest** | ⬜ Small | `lele`, `papalohe`, `pae` → `macrocall` emission + `\widget ~name` tiddlers. Talk-story per sigil. |
| 5 | **R** | ⧾ Verify first | ReactionEngine wiring: changeset application, changed-URI derivation, `RE.onChangeset`, integration tests. |
| 6 | **N** | ⬜ UI shim | `<$lar-promote>` action-widget writes the same command-tiddler as CLI promote. |
| 7 | **O** | ⬜ Corpus hygiene | Author scaffolded heleuma stubs; keep `lares heleuma --write` aligned. |

## Test Flow Harness

- `pnpm test:unit` — package-local Jest suites.
- `pnpm test:flows` — top-level isolated integration flows.
- `pnpm test:tw5-flow` — direct TW5 sync/decompose/promote flow.
- `pnpm --filter @lararium/tw5 exec tsx scripts/smoke-plugin-boot.ts` — plugin
  boot smoke (shadow tiddlers + widget registry + render probes).

## Path ~ahu — Retire Last Non-kau JS Widget

Goal: `ahu.ts` → `\widget ~ahu` wikitext tiddler.

Child URI resolution as a TW5 filter:
```
{{{ [<uri>!match[]!regexp[^lar:///unknown]] ~[<slot>regexp[^lar:]] ~[<currentTiddler>addsuffix<slot>] }}}
```

Open design question: body encoding for the block form. Options:
- Named string param `body=""` (same as pranala). Block rule emits
  `macrocall $variable="~ahu" slot=… uri=… body=<body-text>`. Wikitext
  template renders `<<body>>` directly. Simplest path.
- `$slot`/`$fill` in the macrocall children. Richer (allows wikitext in body),
  but TW5 `MacroCallWidget` fill support needs verification for `\widget`.

- [ ] Talk-story: confirm body-as-named-param vs body-as-fill.
- [ ] Create `tiddlers/sigil-ahu.tid` with `\widget ~ahu(slot uri body template)`.
- [ ] Update `lar-sigil-block.ts` (or `lar-sigil.ts` after T-1): ahu block form
      emits `macrocall $variable="~ahu"`.
- [ ] Delete `ahu.ts`.
- [ ] Update smoke: `ahu` moves from JS widget list to shadow tiddler list.

## Path K — TW5 Routing, Debounce, Projection Hygiene

Goal: live wiki authoring safe under sustained operator editing.

- [ ] Route `$:/state/*` writes to the projection layer, not durable canon/draft.
- [ ] Route `Draft of *` tiddlers to the per-wiki draft bag.
- [ ] Add 300–500ms capture debounce in `MemeSyncAdaptor` / save path.
- [ ] Add idle auto-truncate for noisy projection state.
- [ ] Keep disk sync, CRDT inbound, TW5 UX save, and disk export on the same
      parser/split law.

## Path L — Admin Doc Ingress Trust Gate

Goal: operator devices federate infrastructure state; room peers cannot.

- [ ] Gate admin-doc WebSocket ingress on Keyhive `cap=infrastructure` proof.
- [ ] Operator devices only; room peers rejected.
- [ ] Preserve command-tiddler coordination surface.
- [ ] Negative smoke: non-infrastructure peer cannot sync admin state.

## Path G.rest — Remaining Sigil Vocabulary

Goal: complete the public sigil surface without growing bespoke parser logic.
All three follow the established pattern: wikirule emits `macrocall`, `\widget ~name`
tiddler handles rendering, cascade tag controls template selection.

- [ ] `lele` — flow/movement sigil. Talk-story: fragment-render vs child ownership.
- [ ] `papalohe` — listening/perception sigil. Talk-story: template contract.
- [ ] `pae` — phase/OODA-HA/LADDER sigil. Talk-story: template contract.
- [ ] `kau` invocation path (no fragment, no UUID) — talk-story: may be
      wikitext-eligible; placement path (capability gate) stays JS.

## Path R — ReactionEngine Completion

Goal: one reactive wiki tick per hot-tier wiki, Verse-compatible for alpha.

Invariants:
1. TW5Engine and ReactionEngine co-locate in the same hot-tier Worker.
2. MemeSyncAdaptor applies changeset first; RE runs second.
3. RE writes through composite store, never directly through `docHandle.change()`.
4. Device graph derives from wiki tiddlers/pranala edges.
5. Cold-tier slots have no RE.

- [ ] Confirm worker-side changeset application (local Automerge replica vs placeholder URIs).
- [ ] Derive changed URI sets from real changesets → `ReactionEngine.onChangeset`.
- [ ] Expand NodeVmManager integration tests: mount → route → event-forward → unmount.
- [ ] Verify teardown snapshot captures heads + tiddlers atomically.
- [ ] Keep piscina only for stateless parse work; stateful hot wikis stay in dedicated Workers.

## Near-Future Product / UX Paths

| Path | Status | Trigger |
|---|---|---|
| **Tier 2 aka preview** | ⬜ Deferred | Node-side OG metadata fetch → `thumbnail`/`og-title`/`og-description` fields. Home: `disk-projector.ts` or `og-metadata-fetcher.ts`. Design record at `bags/@lararium/tw5/sigil-aka.md`. |
| **M / Dreamdeck-app** | ⬜ Queued | After admin ingress gate; picks up same-machine peer consolidation deferred from S6.C.5. |
| **S9 / lararium-browser** | ⬜ Queued | Full browser peer: Automerge, IndexedDB, presence, optional OPFS. |
| **S10 / dreamdeck-tldraw** | ⬜ Queued | tldraw shapes as `lar://` resource containers; edge types first-class. |
| **S11 / dreamdeck-app** | ⬜ Queued | React shell; TW5 + canvas composition; no protocol logic in app layer. |
| **W / CodeMirror 6 + Lezer + LSP** | ⬜ Downstream | After CLI/live wiki authoring stabilizes. |

## Deferred / Research Shelf

- Kowloon Bridge: `KowloonOutbox` draft queue + `KowloonInbox` feed mirror; `elyncia.app` deployment.
- Seitan token circle invites.
- Federated promotion conflict handling between lararia.
- Subduction evaluation for lararium↔lararium federation once browser peer exists.
- Speculative RE execution, rollback, metered/gas execution.
- Wikifier polish: DOCTYPE comment and dash-table round-trip diffs.
- `\sigil` pragma full implementation (parameter schema, pattern, close-pattern, handler field).
- `\widget ~kau` placement path design (Keyhive UCAN resource + UUID write-back boundary).

## Small Open Items

- `heleuma` drift detection should include `uri-path`, not only `file-path`.
- Command-tiddler tombstone happens client-side; decide whether dispatcher should auto-tombstone after audit write.
- Cosmetic legacy names in a few logs/strings (`room` vs `wiki`).
- Some generated/source-file memes still need human-authored content beyond scaffolds.
- `aka`/`kahea` markdown-meme cascade entries: ship `aka-cascade-markdown-meme.tid` and `kahea-cascade-markdown-meme.tid` with appropriate disk-export templates.
