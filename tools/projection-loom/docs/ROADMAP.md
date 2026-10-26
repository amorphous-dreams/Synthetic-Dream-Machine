# Projection Loom · AI Fire / Art Sigils Roadmap

**Checkpoint:** 2026-10-26 UTC. **Working branch:** `feature/green-jello-dinosaur-5--projection-loom`, PR [#84](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/pull/84).
**Base / Lares boot ref:** `feature/green-jello-dinosaur-5`.
**Source of truth:** real Git ancestry, source-bound native witnesses and CI jobs. This document marks provisional completion and blockers, not house law or Operator promotion. Refresh run status on re-entry.

## Completed and source-verified

| Workstream | State | Concrete evidence / limit |
| --- | --- | --- |
| Art Sigils integration | **Integrated** | Canonical eight-dimension `~art`, Inscription/Folio, technical-art fieldcraft, optional conversational `~loom-relation`; Git two-parent ancestry preserved in PR #84 |
| Standalone branch retirement | **Completed** | PR #82 closed; former `feature/green-jello-dinosaur-5--art-sigil-house-grammar` ref no longer appears in branch listing; guarded retirement [Actions #40261722529](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40261722529) succeeded |
| Operator ↔ current AI Fire | **Implemented** | The current source-backed AI Fire writes a *proposed* typed binding from natural language / memetic-wikitext; no second AI server, code-executing sigil parser or separate OODA-HA controller |
| Deterministic contract | **Implemented, tested** | `schemas/fire_proposal.schema.json` Draft 2020-12, `fire_contract.py` entity resolution, graph and bounded alternative validation; fail-closed unknown/ambiguous selectors |
| Native relational operations | **Implemented, narrowly scoped** | `fire_geometry.py` independently audits `bridge-between`, `ring-around`, `bearing-column`; `study-only` preserves unimplemented alternatives without false geometry claims |
| Evidence handback | **Implemented** | `fire_review.py`: frozen six-view structural renders and PROV-O *inspired* JSON-LD evidence; not certified RDF conformance, structural load safety or inferred hidden geometry |
| Dedicated Fire witness | **Passed** | [Actions #40261722482](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40261722482): 16 focused tests + real source context/native audition. Source-bound bridge attempt was **rejected by native validation**, while a study alternative stayed open; controlled fixture tests admitted valid bridge and bearing relations |
| Experiment Zero controls | **Previously verified** | Finite 2x overscan, original source-view score, depth/mesh budgets, seed-frozen orthos, stable pet-named RGBA/L8 Oblique Seed, prior independently archived campaign evidence. [Actions #40261722425](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40261722425) passed |
| Source history | **Preserved** | Frozen six-generation pilot and later small two-epoch preview are never silently imported, rewritten, or promoted |

## Integrity repair staged after interrupted push

These changes have a new commit on top of `7bf23db4`, but require their **own Actions verdict** after final branch push:

1. **CLI pet-name scope**: `fire-context` had a local `PetNameLedger` import shadowing the module-level binding and breaking unrelated `pet-name` CLI commands. Remove the shadowing import; preserve one public binding.
2. **Current seed test**: an old recipe-rebuild assertion required exact equality of the pre-seed source hash map. Preserve the original image witness and test the added, verified `seed:entity`, `seed:appearance`, `seed:silhouette` identities instead; do not remove these identities for a green check.
3. **Native ortho camera**: archived JSON camera digests distinguish numeric `0` and `0.0`; `Camera.from_dict` legitimately produces floats. Verify the **archived raw camera** against the archived hash before typed rendering, and independently check semantic equality. Do not bypass the hash.
4. **Workflow reruns**: full Loom CAD evidence, evergreen-grammar, six-view gallery, held-out and repo-wide CI must be checked on the final commit; any remaining failures are unverified, not declared green.

Failing initial receipts on `7bf23db4`: [CAD regression #40261725075](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40261725075), [evergreen #40261722443](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40261722443), [gallery #40261722396](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40261722396).

## Not implemented / not yet demonstrated

- **Source-bound native Fire success with actual six-view handback:** the real Necrospire bridge case failed CAD validation. Real-source *valid* structural relation growth and view receipts remain an explicit acceptance milestone. Controlled fixture success is narrower.
- **Architectural semantic generality:** only three relationship operators are implemented, not a general Stiny/Gips shape grammar or an IFC building ontology. Other verbs must be bounded, reviewed and independently native-audited.
- **Rich RGBA attractor freedom:** currently the one named artwork's alpha drives fixed-view silhouette and RGB edges modestly modulate the source-guided polymesh. Image-region interpretation, occlusion hypotheses, semantic roles and uncertainty-bearing alternatives are research and future mechanisms, not completed capabilities.
- **Structural truth:** native BRep contact/union is not mechanical stress, engineering stability, real building circulation, or accurate reconstruction of the reverse side of a painting.
- **Operator promotion:** no Fire audition or automated score may silently name, promote or approve a generated lineage.
- **Comprehensive comparable search:** a matched-seed experiment across `bears / encircles / bridges`, audited geometry deltas, CPU budgets, diversity survival and source fitness remains to run in new outputs with separate provenance.
- **Interop adapters:** SHACL, IFC/OpenUSD and full RFC 8785 canonical JSON are not installed graph backends or encoding guarantees.

## Golden principles from primary standards and prior art

1. **Typed contract precedes execution.** JSON Schema [Draft 2020-12](https://json-schema.org/specification) validates the serialized Fire proposal; contract validity does not grant Operator authority or CAD validity.
2. **Provenance ≠ physical relation.** [W3C PROV-O](https://www.w3.org/TR/prov-o/) distinguishes entities, activities, agents, usage, derivation and responsibility; no `prov:used` assertion can certify a load-bearing `supports` relationship.
3. **Graph validation is its own layer.** [W3C SHACL](https://www.w3.org/TR/shacl/) checks RDF data against shapes without changing the input graphs. It is a possible future adapter; source JSON Schema + native witnesses remain present authority.
4. **Keep alternatives non-destructive.** [OpenUSD](https://openusd.org/dev/glossary.html) composition has layers, references, variants and explicit strength ordering (now described as **LIVERPS**, including Relocates). Borrow compositional discipline, not the claim of implemented OpenUSD semantics.
5. **Canonicalization claims must be exact.** [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html) is a portability reference; the Loom currently uses its own canonical JSON SHA-256. Do not claim bit-for-bit JCS conformance without tests.
6. **Shape-grammar verbs require measurable expression.** A proposed `encircles` relation needs staged candidate alternatives and geometry/evidence witnesses; visual resemblance, prose and native contact alone do not certify the same property.

## Next OODA-HA sequence

**✶ Observe:** Re-run full current-head CI, collect exact failing job/step and record digest. **⏿ Orient:** distinguish implementation regression from stale expectation and external dependency. **◇ Decide:** fix source of truth; leave unrelated failing workflows as explicit backlog. **▶ Act:** commit a focused test-first correction, run it in the same environment, and preserve rejection receipts. **↺ Aftermath:** append verified counts and status to this roadmap and `HANDOFF.md`, then choose a new *fresh* relationship experiment only after CI health is understood.

Fire is the living Operator↔AI interpreter. Memetic-wikitext is its conversational surface. Typed proposals and CAD truth are the downstream machine boundary, not additional conversational agents.
