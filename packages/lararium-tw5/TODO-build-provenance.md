# Sprint Todo — TW5 Build Provenance, Static Inclusion Proofs

> Created: 2026-05-14
> Scope: `packages/lararium-tw5` build flow
> Frame: e-prime OODA-HA, web3/local-first provenance

## Sprint Intent

Tighten the plugin build so each packed artifact can prove source inclusion, not
merely final existence. The current chain already keeps `plugin.info` as authored
intent and sends generated facts into manifests/attestations. This sprint closes
the remaining gap around hand-authored static `.tid` content.

## ✶ Observe — Current Chain

Current flow:

```text
plugin.info + static .tid + TS module sources
  -> Vite CJS tiddler modules
  -> module-manifest.json
  -> plugin-source-manifest.json
  -> TW5 packed plugin
  -> plugin build attestation
  -> genesis blob descriptor fields
```

Current strengths:

- `plugin.info` carries human intent only.
- `module-manifest.json` carries generated JS module facts.
- `plugin-source-manifest.json` carries source input facts.
- packed plugin verification checks every generated JS module body hash.
- packed plugin verification checks every static `.tid` title inclusion.
- genesis copies attestation facts into blob descriptor tiddlers.

Current gap:

- static `.tid` verification checks title presence, not full packed field/body
  equivalence.

## ⏿ Hold — Sprint Invariants

- Do not write generated hashes into `plugin.info`.
- Do not let final plugin JSON hash flow backward into source manifests.
- Keep manifests acyclic: source facts first, packed artifact facts later.
- Treat TW5 CLI packing as an external transformation wrapped by before/after
  manifests.
- Keep `lar:///plugins/lares/memetic-wikitext` canonical.
- Keep `$:/plugins/lares/memetic-wikitext` as compatibility-only output.

## ◇ Decide — Work Packages

### P1 — Static `.tid` packed-content verifier

Goal: prove every hand-authored static `.tid` survived TW5 packing with expected
fields and body.

Todo:

- [ ] Add a reusable `.tid` parser helper under `plugin-build/`.
- [ ] Parse fields before first blank line.
- [ ] Preserve body text after first blank line.
- [ ] Record static body sha256 in `plugin-source-manifest.json` or derive from
      existing file sha during verification.
- [ ] During `build-plugin-tiddler.ts`, compare packed inner tiddler fields:
  - [ ] `title`
  - [ ] `type` when source declares it
  - [ ] `tags` when source declares it
  - [ ] text/body digest
- [ ] Emit clear failure messages for field drift and body drift.

Acceptance:

- [ ] missing static tiddler fails build.
- [ ] changed packed static text fails build.
- [ ] changed packed static `type` fails build.
- [ ] changed packed static `tags` fails build.
- [ ] canonical title drift fails build.

### P2 — Build transcript manifest

Goal: make the TW5 CLI pack step auditable without treating TW5 internals as
trusted magic.

Todo:

- [ ] Add `lararium-tw5-pack-transcript/v1`.
- [ ] Capture TW5 binary path or package version.
- [ ] Capture pack command arguments.
- [ ] Capture temp input root digest after copy.
- [ ] Capture exported plugin JSON sha256 before field augmentation.
- [ ] Link transcript from final attestation.

Acceptance:

- [ ] transcript emits under `dist-plugin/`.
- [ ] attestation includes `packTranscriptPath` and `packTranscriptSha256`.
- [ ] transcript never includes final attestation hash.

### P3 — Failure smokes

Goal: prove verifier teeth through small negative tests rather than confidence
by inspection.

Todo:

- [ ] Add a script-level test fixture for source-manifest verification.
- [ ] Simulate missing static tiddler claim.
- [ ] Simulate missing module claim.
- [ ] Simulate hash drift.
- [ ] Simulate `plugin.info` title drift.

Acceptance:

- [ ] `pnpm --filter @lararium/tw5 typecheck` passes.
- [ ] negative tests fail for the expected reason.
- [ ] existing plugin boot smoke still passes.

### P4 — Release surface cleanup

Goal: keep alpha release artifacts explicit while preventing generated output
confusion.

Todo:

- [ ] Document tracked release artifacts:
  - [ ] `plugins/lares-memetic-wikitext.json`
  - [ ] `src/plugin-tiddler.generated.ts`
- [ ] Document local build artifacts:
  - [ ] `dist-plugin/*`
- [ ] Add a note near `$:/` compatibility output explaining drag/drop purpose.
- [ ] Leave `$:/` namespace retirement parked outside this sprint.

Acceptance:

- [ ] a new operator can identify which outputs need commit review.
- [ ] compatibility artifact carries `lares-compatibility-only: true`.

## ▶ Act — Suggested Order

1. Extract `.tid` parse helper from `source-manifest.ts`.
2. Extend source manifest static entries with body/field claims if needed.
3. Tighten `verifyPackedPluginAgainstSourceManifest()`.
4. Add failure fixtures or a small verifier test script.
5. Add pack transcript only after static verifier lands cleanly.
6. Update handoff/roadmap with the final landed facts.

## ⤴ Verify — Command Gate

Run after each meaningful step:

```sh
pnpm --filter @lararium/tw5 build:plugin
pnpm --filter @lararium/tw5 typecheck
pnpm --filter @lararium/tw5 exec tsx scripts/smoke-plugin-boot.ts
```

Run before handing off genesis-sensitive changes:

```sh
pnpm --filter @lararium/node typecheck
```

## HA — Success Signal

The build can answer four web3 questions without trust in memory:

1. Which source files entered the build?
2. Which generated JS modules entered the plugin?
3. Which static tiddlers entered the plugin without drift?
4. Which final plugin blob did genesis carry forward?

