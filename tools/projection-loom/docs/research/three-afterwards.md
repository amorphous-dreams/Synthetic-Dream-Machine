# Projection Loom — three completed widening aftermaths

These reviews follow the operator's evergreen instruction: retain historical
research as testimony, keep active tests about the **current** construction
contract, refactor comments toward actual evidence, and reject ungrounded claims.

## ↺ 1 · Narrow aperture — one witness, one measurable claim

**Observed:** the old evidence envelope recorded declared DEM/registration
metadata without performing source-native sampling or producing a transform.
The distinction between native relative heights and certified absolute elevation
required explicit guarding. A manually supplied coordinate array could claim a
survey without demonstrating its independent source.

**Enacted:** `geospatial.py` now reads actual GeoTIFF CRS, transform, valid-data
mask, nodata and native samples, with streaming blocks to bound raster memory.
It keeps native unknown-height-datum sampling but forbids unsupported datum
changes. `registration3d.py` separates provisional manually supplied landmark
fits from hash-checked CSV control observations with held-out validation.
`surface_witness.py` reads actual XYZ/OBJ sources as non-genotype evidence.

**Tests:** 7 focused survey tests plus 3 surface-witness tests passed. Source
mutation, projected-meter coordinate conversion, null pixels, wrong control
poses and unregistered sample scale each have an explicit failure case.

**Comment law:** avoid "survey proved", "altitude repaired" or "3D scene
reconstructed" where the code only read metadata or compared sampled points.
The source's declared vertical datum does not acquire independent survey
certification by parsing the raster.

## ↺ 2 · Architectural aperture — entities enact relations

**Observed:** continuous parameter mutation could not generate a new branch
unless a builder already declared that possibility. The LocationStack held
hypothesis relationships but no transactional typed rewrite entrypoint.

**Enacted:** `grammar.py` interprets root, attached box, beam and negative box
operators with bounded expressions and conditional branches; new nameless
material and void handles preserve relational witnesses, not permanent mesh
identity. `rewriting.py` enacts proposed-only graph changes with full
containment/dangling-edge checks and source-attestation protection. It returns
both snapshots and an explicit before/after receipt.

**Tests:** 7 focused construction/rewriting tests passed. Branch thresholds
actually change valid CAD topology; invalid contacts fail CAD audits; proposal
cycles, dangling relationships, fake witnessed claims and removal of source-
attested entities reject before committing any location revision.

**Comment law:** a graph rewrite proposes architecture; only a fresh positive-
material and void audit can promote the corresponding CAD construction.
O-takiage releases a soft identity hold, **not** the entire evidenced entity.

## ↺ 3 · Location aperture — orchestrate without claiming a global now

**Observed:** previous run loops optimized one genome in one continuous space,
without a source/code-bound resumable scheduler, a separate operational-error
class, or guaranteed attention to alternate emitters. Preview losses could
conceal variations if they alone determined which candidates received exact CAD
checks.

**Enacted:** `epochs.py` coordinates deterministic Sobol/local/topology
proposals, reserve seats for distinct methods when budgets allow, and checkpoint
complete identities: project and active module hashes, sources, seed, budgets,
proposals and output receipts. Fast preview orders compute, never admits a
construction. A full CAD/void gate precedes source-based scoring and archival.
Provisional/verified status stays explicit; missing metrics cannot quietly
produce a zero; programming/scoring exceptions produce an `error` receipt,
not a CAD rejection. The CLI supplies `wide-epoch`, `inspect-dem` and
`register-control` without a compatibility path for stale models.

**Tests:** the full active suite passed **119/119**, including the subject-
neutral grammar construction, two-epoch resumable CLI smoke, source mutation,
checkpoint tampering, explicit evidence-status and per-emitter novelty scheduling.
The pilot remains small; these tests demonstrate internal consistency and
repeatability, **not** convergence to Necrospire artwork or metric real-world
reconstruction.

**Comment law:** keep a per-body exact validity gate, a per-source witness
boundary, and a scene-level relational archive. Document when a measurement
remains provisional, absent or sampled. No source becomes a new observation
solely because a previous epoch rendered it.

## Joint evergreen ruling

Retain three different active registers: measured **source** testimony,
**proposed** constructions and graph relations, and **validated** CAD bodies.
Preserve possible but nameless alternatives; pet-name through unique relations;
release retention through o-takiage while keeping the old receipts. Permit
multiple unrelated bodies in a named location. Do not make a single glossy
image, a single fitness scalar, or an exchange format stand for the world.

**Outstanding disciplines:** true SfM and image-pose recovery; verified height
changes across datums; direct IFC/CityGML/OpenUSD interchange; exact point-to-BRep
and hidden-line comparison; constructive macro induction; multiwriter causal
ledger merge; operator-blind diversity evaluation at large budgets. These remain
research, not silent features.

## Distinguish machine control from our development Aftermath

These three historical Aftermath reviews examined **our work** at widening
apertures; they do not represent three automatic features of the machine.
The later [executable OODA-HA controller](../ooda-ha-procedural.md) deliberately
adopts the same five-phase grammar as a *separate* runtime discipline over
location, epoch and candidate actions. Its own Aftermath phase yields
selectable audited previews, lineage receipts and operator intervention. It
does not exempt us from independently reviewing code, tests and memetic laws.
