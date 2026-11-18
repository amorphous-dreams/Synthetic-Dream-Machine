# Packages Workspace Map

Short orientation for humans and agents reviewing `packages/`.

## Source of truth

- `packages/AGENTS.md` carries package-boundary law.
- `bags/lares/ha.ka.ba/lares/docs/stable-founding-road.mem` carries the road: rulings, the leaps, and the owed rows.
- `bags/lares/ha.ka.ba/lares/docs/pono/controller-handoff.mem` carries session state: what stands on which branch, and what runs.
- `packages/.shelf/` keeps earlier planning torches as archive.
- `lar:///ha.ka.ba/lararium/api/mempalace-integration` carries the current
  guest-comparator and Python-library boundary; the Sensorium's design of
  record lives at `lar:///ha.ka.ba/lares/api/pono/sensorium-machina`.
- Source lives under each package's `src/`.
- Unit tests live under each package's `tests/`.
- Cross-package and daemon/CLI integration flows live under repo-root `tests/`.

## Generated and review-noisy paths

Treat these as build artifacts unless the task explicitly targets generators,
bundles, or release packaging:

- `packages/*/dist*/`
- `packages/lararium-tw5/src/plugin-tiddler.generated.ts`
- `packages/lararium-tw5/tw5-core/`
- repo-root `genesis/` (the baked seed and CAS; a controller re-bake moves it)

Prefer reviewing the generator or source module first, then rebuild.

## Current architectural pressure

- TW5 VM primacy: memetic wikitext has a host wiki context. Do not parse through
  an arbitrary global/pinned VM when a specific wiki context owns the import.
- Tiddlers are the CRDT atoms. A bag is an Automerge document containing
  tiddlers; a wiki is a TW5 VM view over a recipe of those bags.
- Integration tests should prove import/decompose/promote behavior through real
  VM and daemon surfaces. Package unit tests should keep narrow shores fast.
- Sync, VM pooling, and multi-wiki/shared-bag behavior remain active design
  pressure. Harden tests before large refactors.
