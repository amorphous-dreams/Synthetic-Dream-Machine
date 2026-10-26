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
Loom merge. The standalone branch should be retired after ancestry
verification; branch deletion requires repository ref-delete capability.
