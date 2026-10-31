# Projection Loom · Current Fire / relational grammar

The **current AI Fire backed by source** is the only Operator-facing
interpretation layer. There is no separate "semantic LLM server", parser
that executes memetic-wikitext, or independent OODA controller. Fire reads
the Art Sigil / Folio and source receipts, interprets ambiguities with the
Operator, and AUTHORS a bounded JSON proposal. Deterministic Loom tools
validate and resolve that proposal against actual source witnesses.

## House language and separation of authorities

Canonical [Art Sigils](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/tree/feature/green-jello-dinosaur-5--projection-loom/bags/lares/ha.ka.ba/lares/api/art-sigils)
preserves its eight artistic dimensions and Folio procedures. The Loom
extension `~loom-relation` is an **optional conversational scope**, never
executable CAD. Sources and model-control settings stay outside its image-
facing invocation.

Borrowed foundations:
- [Stiny/Gips shape grammar tradition](https://journals.sagepub.com/doi/full/10.1177/14780771221089882):
  symbols and conditional production rules, not only continuous parametric loci.
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/):
  finite, strict typed proposal syntax; no arbitrary execution, no permissive extras.
- [W3C PROV-O](https://www.w3.org/TR/prov-o/):
  distinguish entity, activity and agent, and derivation from asserted physical relation.
- [NetworkX DAG](https://networkx.org/documentation/stable/reference/algorithms/dag.html):
  execution dependencies must be acyclic; architectural relations may cycle.
- [W3C SHACL](https://www.w3.org/TR/shacl/) and
  [OpenUSD composition](https://github.com/PixarAnimationStudios/OpenUSD/blob/dev/docs/intro.rst):
  concept references for validated graphs and non-destructive alternatives,
  **not** claimed in-memory formats or installed execution engines.
- [RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html):
  shared hash portability principle. The Loom currently uses its *existing*
  `canonical_json_sha256` encoder and does **not** claim byte-identical RFC
  8785 serialization. Do not silently relabel its digests as JCS.

## The four operational boundaries

**1. Fire context.** With a source-bound project/recipe, inspect real
semantic entities (stable relational selectors) and the current source seed:

```sh
cd tools/projection-loom
python -m projection_loom fire-context \
  --project examples/necrospire/project_alpha.json \
  --capability-recipe examples/necrospire/hybrid/recipe_alpha.json \
  --out out/fire-context.json
```

A member selected by pet-name requires an existing Operator-held ledger
(`--identity-ledger`). No AI-generated pet-name is itself authorization.

**2. Fire inscription / proposal.** The Operator and the current Fire may
write natural language and `<<~ art ...>>`, then the Fire writes a **separate**
structured JSON file, conforming to
`schemas/fire_proposal.schema.json`, with `source` equal to
`fire-context.json.source`, current witness selectors, one-to-eight
alternatives and `intent.state="proposed"`. The Inscription and Folio
are passive strings to the compiler: even malicious-looking text never
executes as program code.

**3. Deterministic audition.** A native CAD project/recipe can produce
bounded geometry for implemented relations:

```sh
python -m projection_loom fire-audition \
  --project examples/necrospire/project_alpha.json \
  --capability-recipe examples/necrospire/hybrid/recipe_alpha.json \
  --proposal out/fire-proposal.json \
  --out out/fire-audition.json
```

`bridge-between` makes a native beam spanning two resolved material
solids. `bearing-column` proposes a vertical contact member only when
there is horizontal overlap. `ring-around` proposes four native
materials around the chosen target. Each alternative is *independently*
staged and audited; any invalid contacts, void failures or over-budget
members are rejected with an attributed reason. `study-only` holds
unimplemented artistic alternatives safely open. These operations prove
CAD contact and connected union, **not** true load-bearing capacity,
circulation, natural-language semantics or historical reconstruction.

**4. Evidence handback.** Only valid alternatives may be re-grown and
rendered under shared seed-frozen cameras:

```sh
python -m projection_loom fire-review \
  --project examples/necrospire/project_alpha.json \
  --capability-recipe examples/necrospire/hybrid/recipe_alpha.json \
  --receipt out/fire-audition.json \
  --out out/fire-review
```

The review writes an actual six-view native structural board, a verified
summary and small PROV-O JSON-LD provenance export. The operator can
compare returned forms without receiving a hidden scalar "winner".
All paths are new immutable outputs; use a new path per proposal. The
independent OODA-HA helm owns any later generation/selection campaign.

## Golden principles and limits

- **One pet-named source entity** may have correlated alpha and RGBA
  channels; these are not two independent measurements.
- **Art, proposal, compiled plan, native construction, review and Operator
  choice** remain separately attributable records.
- **No automatic language execution or silent entity selection.**
  Ambiguous names and selectors cause explicit rejection.
- **No mutation on failed construction** and finite bounds before costly CAD.
- **No unearned proof:** connected material is not engineering stability;
  camera appearance is not a measured reverse elevation.
- **Alternatives remain live.** Native rejections stay witnessed, and
  selection remains Operator-held.
- **Generation remains OODA-HA**; Fire is the conversation and source-backed
  proposal author, never a parallel evolutionary controller.

The historical six-generation Necrospire pilot and two-epoch preview
lineages are excluded from the new rule ancestry. The pre-existing
Art Sigils branch commits are preserved as the second parent of the
Loom merge. The Art Sigils standalone branch **was retired** after ancestry verification;
[PR #82](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/pull/82)
is closed, and the guarded branch-retirement workflow passed. Its source
history remains in the two-parent Loom merge. See [live Roadmap](ROADMAP.md)
for the current verified / unfinished Fire capabilities and CI boundary.

## Research bearing · standards are adapters, not authority substitutions

As of 2026-10-26, [OpenUSD's glossary](https://openusd.org/dev/glossary.html)
documents **LIVERPS** strength ordering, including relocates; the older
LIVRPS shorthand may occur in previous notes. Our inspiration is
non-destructive opinion composition, *not* a claim that the Loom executes
OpenUSD layering. [SHACL](https://www.w3.org/TR/shacl/) validates RDF data
graphs against shapes without mutating those inputs; Fire proposals are
currently validated as JSON Schema 2020-12, with separate native audits.
PROV-O's entity/activity/agent attribution remains about provenance,
not physical load or architectural support. Any future mapping requires its
own correctness/round-trip tests and independent authority.



## Paired Fire expression study

The single-source Necrospire fixture (`examples/necrospire/fire_study.py`) consumes
an actual `fire-context` receipt and writes a bounded typed proposal. It does not
interpret Art Sigils or create an independent agent. The native Fire audit then
tries two independently staged `bears` contacts and holds a `study-only`
interpretation alongside them. Source-bound selectors and digest validation
remain mandatory. The fixture asserts no artistic or engineering truth.

For native-admitted alternatives, `fire-review` now writes:
- `fire_native_orthos.png`: source baseline + each alternative, six seed-frozen views.
- `fire_native_differences.png`: the same source/candidate paired silhouettes;
  cyan pixels appeared, coral disappeared, grey persisted.
- `summary.json`: signed source audit, paired mask digests, occupied/appeared/
  disappeared/shared pixel counts, view IoU, and per-view expression witnesses.

A native-valid alternative whose difference counts vanish remains native-valid,
but the result does not pretend the candidate looks architecturally distinct.
All evidence belongs to the single original RGB/alpha seed's causal island.


## Native-carved Fire cohort witness · current wave

The first Fire six-view comparison rendered individual component meshes even though the actual produced source is the joined, void-carved BRep. Fire review now renders both source and each admitted alternative via `tessellate(union=True)`, so all six views derive from the native-authoritative carved material rather than uncarved independent parts. The source-frozen camera contract remains unchanged. Fire cohort now verifies 2–16 paired native audition/orthographic handbacks (including each document, per-alternative digest, image bytes, camera baseline, seed/recipe/genome/implementation identity, and silhouette arithmetic), then records source-relative and off-oblique expression, duplicate geometry, and duplicate six-view silhouettes without ranking, breeding or promoting anything. The CLI `fire-cohort` writes an immutable checksum-bound census; the two-probe CI uses it rather than an unverified ad-hoc summary. Negative tests refuse mutated geometry receipts, source drift, camera drift, image changes and inconsistent pixel counts. Any real-source evaluation awaits same-head CI; previous proxy results are not native Loom generations.


### Native cohort truth-scopes clarified

A relational witness names topology/semantic slot identity, not exact BRep shape. The cohort therefore reports `unique_topology_witnesses` and `topology_duplicate_of`, alongside distinct measured added-volume values and independent six-view silhouette fingerprints. Do not interpret relation-witness uniqueness as geometric shape uniqueness, nor a distinct volume as a complete geometric fingerprint.

## Hephaestian place and passage witness · new enacted capability

**Projection Loom** remains the Operator's pet-name, understood as an
architectural/location Loom among the possible **Looms of Hephaestus**.
This interpretation does not rename an existing entity or promote a new canon.

Shapely is a direct dependency for sampled plan analysis. The read-only
`place-review` CLI reconstructs native-audited Fire alternatives from
their source genome and signed receipt, checks their native union and
semantic witnesses, then reports exact native-material differences,
declared room/doorway graph routes, and Shapely XY material/void
sections at bounded elevations. The rasterized sections are *cell-center
samples*: their approximate clearance-core areas do not certify
walkability, load, hidden source architecture, or continuous route width.
Circulation hops derive from audited VoidAssembly overlaps; NetworkX
does not substitute for CAD.

The Fire grammar adds a bounded `skirts/skirting-court` U-shaped
open-front relation. Only separately native-admitted alternatives enter
review. No pet-name, Art Sigil executor, second service, or second
OODA-HA scheduler follows from that relation.

Hypothesis supplies targeted bounded invariants. TopologicPy is an
explicit `topology-study` optional dependency, with an isolated
read-only TGraph void-link comparison pilot. Pyribs is an explicit
`quality-study` optional dependency used solely to inspect already
admitted candidates; its scheduler and emitters are not installed in
the active generation flow. build123d, COMPAS, IfcOpenShell and
Ladybug Tools remain under research-only hold rather than redundant
execution authorities. Future architectural inheritance and multi-image
reference experiments require their own attributed evidence.

Python distribution metadata retains the packaging-required numeric
field as an inert `0`; no application release ladder is implied.
Pinned third-party CI constraints serve reproducible dependency
resolution, not a Loom project version ontology.

Sources: Shapely/GEOS docs, Hypothesis docs, TopologicPy TGraph docs,
pyribs GridArchive API, Stiny/Gips shape grammar, Hillier/Hanson
spatial syntax and Alexander's generative systems. The read-only
TopologicPy pilot may require its own backend; it is never a hard
dependency of core source-bound CI.

### Native place witness truth scopes

place-review reports exact carved native material addition/removal separately
from pre-carve shell union volume, alongside approximate sampled XY sections.
An empty sampled cell cannot certify an accessible route or safe clearance.
TopologicPy and pyribs pilots require explicit optional installation and
flags (--topology-pilot and --quality-pilot). Neither can grant promotion.


### Recompilation before visual evidence

The fixed-view Fire review and place review recompile each native-admitted
rule's deterministic operations from the source-bound plan and original
assembly. Altered rule steps, a changed source genome checksum, missing
source identity or a discrepant part count cannot pass by matching only a
topology witness and a union volume. Planar evidence remains approximation;
the only structural truth stays native BRep/void audit.
