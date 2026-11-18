# Frozen DreamDOM witnesses

`worlds/pono-small.json` supplies one small, named wiki. `filter-cts-sections/` holds the authored filters in five dialect tables: `preserved` (stock operators and composition), `added` (Lararium operators), `deprecated` (compatibility forms retained for observation), `fault` (malformed or refused expressions), and `context` (filters that read `currentTiddler`). The generator boots the pinned TW5 engine, records each parse tree and result or fault in `filter-cts/<section>.json`, and assembles `filter-cts.json`. Each row names its source filter, world, context, tags, engine `since`, and host binding. `reviewed` marks a human read of the frozen answer; `strange` carries a one-line `why` for an answer that invites a second look.

The parse tree carries the normative filter witness. Camera goldens in `cameras/` carry the second layer: one specimen per root template and serialiser. `html` compares exactly after the declared normaliser (CRLF to LF, then trim at both ends); `text` compares exactly. A missing camera has its own refusal witness.

## Hosts

- ''Node'' runs `tests/filter-cts.test.ts` and `tests/camera-goldens.test.ts` over the pinned engine (`bootTestWiki`); both read each case through `tests/filter-cts-run.ts`, the one reader the generator also calls.
- ''Chromium'' runs `tests/filter-cts-chromium.e2e.test.ts`: the frozen world built as a stock single-file wiki with the committed standalone plugin, every case evaluated in the page through TW5's own fake widget. A case marked `host-bound` reads the engine's own store (boot tiddlers, shadows, plugin titles), which differs between the two hosts by build, so Chromium compares only the world's own titles for it; every other case compares whole.
- ''quickjs-ng'' stays owed by name: it stands nowhere in the tree, and this suite claims no pass there.

One host difference this suite surfaced: the standalone plugin registers under `$:/plugins/lares/memetic-wikitext`, where the Node boot names it `lar:///ha.ka.ba/lararium/plugins/lares/memetic-wikitext`, so `[all[memes]]` answers nothing in a single-file wiki.

## Engine bump

Pin the intended TW5 engine release, run `scripts/build-filter-cts.ts` over the same world and source sections, and diff all five section JSON files plus the assembled file and camera goldens. Read changed parse trees first, then changed results, faults, and camera bytes. Mark an observed surprise `strange` with one line of `why`; accept an intentional change through review and freeze the new files. A drifting digest names a disagreement for review, never an automatic content edit.
