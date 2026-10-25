# Oblique Seed — one pet-named source entity, two channels

**Pet-name:** Necrospire's First Glimpse
**Stable slot:** `oblique-seed`
**Source:** `examples/necrospire/seed_oblique.json`

The original 1024×1536 RGBA oblique and separately stored 8-bit
oblique alpha depict **one artwork**. They are not independent
photographs, surveys, two separate creatures, or separate voting attractors.
The manifest verifies both exact file digests, declared image modes, dimensions
and per-pixel equality of the RGBA alpha channel and L8 source silhouette.

The source binds as `@seed/oblique-seed`, a relational entity under the one
Necrospire location. The Operator authorized the pet-name role; the initial
working name here reads **Necrospire's First Glimpse**. It remains a soft
pet-name claim in the event-sourced ledger, never a hard naming of imported
mesh triangles or a structural constraint. The existing location pet-name
`Necrospire: A Crystal Bearing a Fortress` remains distinct.

## Capability and OODA-HA path

- The project declares the seed manifest in `seed_entity`; the calibrated
  reference points to its L8 alpha channel. Project, recipe, and controller
  source identities include the seed digest plus both image digests.
- The live recipe carries an explicit `seed.oblique` / `seed-cue` capability
  which precedes and supplies the `cad-polymesh` children. That step produces
  a bounded typed signal receipt, **not** CAD.
- Alpha governs source-view silhouette fitness and the existing bounded
  silhouette-guided mesh nudging. RGBA carries an edge field conditioned on
  the same alpha; it may slightly modulate derived polygon-surface sculpting
  only when a `guide` locus turns on. It never alters base BRep or claims
  survey registration.
- Other operators can read `BuildContext.seed_entity.mask(size)`,
  `appearance_edges(size)` and `cue(size)`, explicitly depend upon the
  stable `seed.oblique` step, and record their usage. No global hidden
  source pixels or implicit second source score.
- Every new OODA-HA journal obtains a source-bound identity and the
  seed's soft pet-name claim. Re-entry verifies the existing ledger instead
  of silently changing its initial claim. Finalist manifestations retain
  the source-seed receipt, linked to the same content-addressed entity.
- The seed's name, channel digests, evidence status and relationship survive
  new generations. Operator attention masks remain a separate, attributed
  annotation mechanism, not independently observed source images.

Do not rewrite the frozen historical six-generation pilot or retroactively
relabel the already completed fresh lineages. New runs receive the new source
contract, and old archived outputs retain their original experimental identity.

The full source-bound, native proof runs in
`.github/workflows/necrospire-source-seed.yml`.
