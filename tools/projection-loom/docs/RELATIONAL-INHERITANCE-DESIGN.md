# Projection Loom · Design meme: heritable architectural relationships

**Status:** working design lock for the next YIN implementation wave, **not** a claim of implemented inheritance, independent safety certification, aesthetic selection, or Elyncia canon.  
**Evidence pin:** PR #84, `c342c8738f0a9c5e08f51965258f75e75e566443`, 2026-10-31. The four observed exact-head Actions runs (CAD/evidence PR + push, held-out witnesses, general CI) completed successfully. No claim follows for workflows absent from that observation or for future commits.  
**Research provenance:** branch-current [research register](research/register.md), [deep research VII](research/deep-research-vii.md), [Living Place](LIVING-PLACE.md), [relational identity](relational-identity.md), [research meme](../../../bags/lares/ha.ka.ba/lares/api/projection-loom-research.mem), and live code/tests. The separately launched new Deep Research report was not available to inspect when this design was recorded; incorporate it as attributed testimony when available, not retroactive proof.

## Bearing and source facts

Grow **a heritable relationship**, not an inherited screenshot, copied mesh, or free-floating assertion of connectivity. The operator-authored `SpatialIntent` remains the obligation; `PlaceGenome` supplies the constructive recipe; independently reimported STEP evidence supplies bounded geometric admission; the operator alone decides artistic acceptance and promotion. A derived route-family witness makes a native-admitted relationship legible across epochs without creating a second authoritative graph.

At the evidence pin, `place_three_hop.propose_three_hop_route` offers source-preserving `x-y-x` or `y-x-y` three-hop construction between original diagonal supports. `place_emitters._topology_birth` derives each such proposal **from the original source**, not from an admitted topology parent. The two-epoch campaign test proves an offer, one finite STEP attempt, deterministic replay, and a forged-ancestry refusal; it does **not** assert `topology_native_admitted > 0`, a distinct admitted child, or a child-to-parent family chain. `relational_emission_census` separates offered, attempted and admitted. Thus a three-epoch parent→child witness remains open, despite the observed exact-head green CI.

## Model comparison and working design locks

| Model | Useful prior-art rhyme | Failure if treated as the whole model | Decision |
| --- | --- | --- | --- |
| A. Copy an admitted generated route region | Typed graph closure; complete generated components | Transfers shape/parts, not demonstrated relationship reconstruction; risks orphaned edges and identity laundering | **Keep** for explicit recombination only; **reject** as the heredity proof |
| B. Inherit only the source `connect` obligation | Design by contract, constraint satisfaction | Every fresh solution would count as heredity without a parent-specific causal trace | **Keep** as immutable goal authority, not sufficient lineage |
| C. Derive a route-family witness from admitted genome + goal + STEP evidence | Attributed graph grammar, event-sourced projection, W3C PROV | A mutable second graph could diverge from geometry | **Lock** as read-only, recomputable witness; never a new genotype |
| D. Reconstruct a new route under B, constrained by C | Grammar rewrite with invariants, independent test oracle | Could fake novelty through renamed handles or unverified CAD | **Lock** as the vertical-slice implementation strategy |

The following decisions bind the proposed implementation wave; they do not promote Lares law or authorize o-takiage:

1. **One helm:** retain `place_campaign.OODAHAJournal`, existing offered frontier, finite per-epoch `exact_budget` and native audition scheduler. No parallel evolutionary controller, second budget, or versioned compatibility adapter.
2. **Source closure:** retain every original body/relation and the complete original goal set. A generated route region must close over all generated corners/decks and the original support anchors it references. Refuse half-relations, overwritten routes, conflicting producer claims and intrusion before CAD.
3. **Derived family, no new truth source:** derive a family descriptor only from a source-sealed `PlaceGenome`, selected original `connect` goal and independently admitted native workspace. Recompute on verification; never accept a caller-supplied family as proof.
4. **Inheritance must change something observable:** child must carry an explicit admitted parent identity, preserve original goal and source anchors, and produce a **different observed route** (ordered axes/waypoints, path graph or measured spatial layout), not merely different generated IDs or a copied STEP blob. Both parent and child require their own STEP/goal admission.
5. **Typed outcomes:** `construction-refused`, `proposal-deferred`, `native-rejected`, `native-admitted` and `not-auditioned` remain distinguishable; no refusal burns a fictitious STEP budget.
6. **Operator authority:** admission certifies bounded native geometric goals only. No automatic aesthetic winner, structural/load/accessibility certificate, pet-name, Elyncia promotion or PR merge.
7. **Ashes survive:** evidence and source stay immutable or append-only; design changes preserve prior reasoning by links and Git history, not recursive pasted copies in every living front. An actual `o-takiage` releases soft pet-name/evolutionary preference per [relational identity](relational-identity.md); code retirement or file deletion needs a separate explicit, path-specific operator authorization.

**Re-entry keys:** reopen C/D if native reimport cannot reconstruct the family without trusting emitter receipts; if source closure forces duplicate authoritative graphs; if a new evidence modality changes what counts as a route; or if measured children cannot differ without breaking original goals. Record dissent and counterexample before changing a lock.

## Minimal derived witness and replay contract

Proposed schema name `projection-loom/observed-route-family` (not yet implemented). Derive only from audited source + goal + native workspace:

```text
RouteFamilyWitness:
  original_genome_sha256, spatial_intent_sha256, goal_index, source_goal_sha256
  original_support_ids: [source_id, target_id]
  parent_candidate_id?, parent_genome_sha256?, parent_workspace_sha256?
  candidate_genome_sha256, candidate_workspace_sha256
  generated_body_ids, closed_relation_ids, ordered_support_to_support_chain
  observed_hop_count, observed_axes, observed_waypoints, measured_dimensions
  native_goal_receipt_sha256, source_seal_sha256
  schema, sha256 = canonical_json_sha256(body)
```

`source_goal_sha256` names the original goal's canonical identity, not a fresh goal authored by the emitter. `closed_relation_ids` must derive from stable typed relation descriptions and body IDs, never OpenCascade face indices. Workspace SHA-256 binds stored native evidence bytes; it cannot by itself certify geometric correctness. The verifier must reconstruct the source, candidate, route graph, STEP bodies, original goal assessment and canonical witness independently.

```python
def derive_family(original, spatial, admitted_genome, native_workspace, goal_index):
    require_original_connect_goal(spatial, goal_index)
    seal = seal_constructive_growth(original, admitted_genome)
    independently_verify_workspace(native_workspace, admitted_genome, spatial)
    graph = derive_typed_route_graph(admitted_genome)   # never persist as authority
    chain = unique_source_to_target_chain(graph, spatial.goals[goal_index])
    region = close_generated_region(chain, original, admitted_genome)
    require_no_orphans_no_source_rewrites(region, seal)
    return canonical_observed_witness(region, chain, native_workspace, seal)

def inherit_family(original, spatial, native_archive, epoch, slot, seed):
    eligible = admitted_parents_with_derived_family(native_archive)
    if not eligible: return ProposalDeferred("no native-admitted family parent")
    parent = deterministic_pick(eligible, seed, epoch, slot)
    child = reconstruct_from_source_and_family(
        original, spatial, parent.family, bounded_alternative_parameters(seed))
    if not child: return ConstructionRefused(attributed_reason)
    require_same_original_goals_and_anchors(child)
    require_distinct_observed_route_candidate(parent, child)
    return Proposal(child, parent_native_ids, native_audition_completed=False)
```

The emitter never writes `native-admitted`. Only the existing campaign spends one real STEP audition, reimports every required native body, assesses **all** original goals and archives a verified workspace. The family derives after admission. A derived child inherits a parent relationship as a *causal constructive constraint*; it does not inherit the parent's pass verdict.

## Scheduling without a second helm

Use the existing topology proposal seat (`epoch > 0`, `offspring >= 3`, index `offspring - 2`). At the first eligible epoch, offer a source-born topology. At later epochs, if a native-admitted family parent exists, offer **topology-inheritance** in that same seat; otherwise record why inheritance cannot run and either offer the bounded original-source topology or a clearly attributed mutation. Reuse `select_place_auditions` and `exact_budget`. Add typed census counts for source births vs inherited offers/attempts/admissions; do not relabel a de novo source birth as heredity. If a new emitter label enters the active schema, update producer, consumer, board, tests and independent verifier atomically; early alpha needs no legacy alias.

A useful controlled native study uses three or more epochs, `offspring=3`, `exact_budget=1` and an explicit topology preference. Epoch 0 must establish a source-sealed admitted basis; epoch 1 must obtain an actually native-admitted three-hop topology; epoch 2 must reconstruct from that specific parent, differ observably and earn independent native admission. If any stage fails, report the typed failure; never relax the assertions or substitute a proposal for an admitted parent.

## Proof obligations and adversarial gates

| Gate | Required acceptance | Negative counterexample |
| --- | --- | --- |
| Source / goals | Same original body/relation digest, all original goals evaluated | Mutate an original support; drop a `shelter` goal |
| Closure | Complete connected generated route region with named source anchors | Select one deck without corner support; introduce dangling endpoint |
| Family derivation | Native workspace reimport, unique chain, reproducible canonical descriptor | Forge family pattern, parent workspace SHA or source goal index |
| True heredity | Parent admitted in prior epoch, child differs in observed route and remains goal-valid | Copy parent's genome/STEP; rename only IDs; claim unadmitted parent |
| Budget | Per-epoch attempted ≤ exact budget; every actual attempt has STEP receipt | Count a source refusal as a STEP attempt; forge audition order |
| Replay | Independent `verify_place_campaign` regenerates offers, order, genomes, ancestry, native evidence and family | Tamper frontier, STEP, receipt, archive, code/source fingerprint |
| Operator | Board shows offered/attempted/admitted, ancestry and unresolved alternatives | Auto-pick winner or promote Elyncia canon |
| Integration | Exact-head CAD/evidence, held-out and repository CI; generalized OpenUSD/STEP/Blender when applicable | Borrow green from an older commit or unrun workflow |

Prefer a **matched counterfactual**: same source supports, same original goal, seed, exact native budget and evidence camera; compare a parent-conditioned child with a de novo source-born alternative. Report route family, axes, hop count, measured waypoint geometry, native goal result, rejected proposals, actual STEP attempts and lineage SHA identities. A successful pair proves bounded constructive inheritance under this fixture, not open-world architectural intelligence.

## Execution slices: one feature, one aftermath

**Slice 0 — Pin and inspect.** Read full boot from `feature/green-jello-dinosaur-5`; fetch live PR head, complete current research and exact-head Actions. Reconcile the separate Deep Research report when it becomes available, attributing each additional model claim. Preserve source hashes and test baseline.

**Slice 1 — Derive, do not invent.** Implement source-closed typed route graph extraction and observed family derivation from *admitted* native workspaces. Tests: multi-leg positive; missing anchor, broken edge, duplicate path, changed source and forged witness negatives. Avoid a new persistent graph authority.

**Slice 2 — Reconstruct heredity.** Add parent-conditioned three-hop alternative generation under the existing topology seat. Record parent genome/workspace/goal identities, bounded refusals, distinctness witness, and deferral. Keep the current deterministic original-source birth as fallback with honest label. Tests prove actual parent use, not only a counter.

**Slice 3 — Native vertical witness.** Run a controlled three-epoch source-fixed experiment with independent STEP import at each admitted epoch. Demand admitted topology parent → distinct admitted child → exact replay. If geometry blocks the experiment, retain the red witness and repair construction, never downgrade the gate.

**Slice 4 — Adversarial replay and review.** Tamper source, goal, frontier, family, ancestry, STEP, budget and candidate IDs; prove verifier refusal. Project family lineage, native counts and limits into the operator board without automatic selection.

**Slice 5 — Pono / consolidation.** Inspect code and docs for duplicated controllers, redundant compatibility paths, stale claims and historical nested-ashes inflation. Run all applicable exact-head CI; publish one verified handoff, refresh research register and `projection-loom-handoff.mem` with valid frame block check. Keep old reasoning in Git and explicit ashes carriers; do not destroy the evidence.

**Separate tracks (not gates for claiming bounded heredity):** (a) source-conditioned morphology must introduce measured image/DEM/point-cloud constraints only with frame, units and holdout evidence; test changed source → attributable changed geometry, and refuse uncalibrated metric claims; (b) real Unreal Editor must execute and independently verify an editor import/export or scene roundtrip in a genuine Editor environment, not a mock or USD file alone. Both remain open until their own receipts exist.

## Prior art: attractors, not borrowed certifications

- [Stiny & Gips, shape grammars](https://www.shapegrammar.org/ifip/SGBestPapers72.pdf): discrete relational production; transfer the *rule/constraint* rather than a finished silhouette.
- [Graph rewriting in engineering design](https://doi.org/10.3389/fbuil.2021.815153): typed rewriting and dangling-edge protection; a route's closure survives local edits.
- [ShapeAssembly](https://doi.org/10.1145/3414685.3417812), [Szalinski](https://doi.org/10.1145/3385412.3386012), [ShapeCoder](https://doi.org/10.1145/3592416): programs and reusable motifs; compress only after native evidence, never replace the source.
- [W3C PROV Primer](https://www.w3.org/TR/prov-primer/): entities, activities and derivations; a parent pointer records causation, not truth.
- [OpenUSD composition](https://openusd.org/25.11/glossary.html): compose heterogeneous scene evidence; USD remains interchange, not authoritative CAD genotype.
- [pyribs / quality-diversity](https://pyribs.org/): preserve distinct valid niches without making novelty outrank admission.
- [GTSAM factor-graph introduction](https://gtsam.org/tutorials/intro.html): separate measurement factors and latent variables; a camera cannot compensate silently for false geometry.
- [buildingSMART IFC openings](https://standards.buildingsmart.org/IFC/RELEASE/IFC4/FINAL/HTML/schema/ifcproductextension/lexical/ifcopeningelement.htm): opening semantics differ from actual traversable route proof.
- [Project relational identity and o-takiage](relational-identity.md): release soft affinity, not geometry, lineage, or audit.

These citations support the analogy and research direction; they do **not** claim those systems implement this exact Loom contract. Any external findings from the pending new Deep Research report must enter with separate provenance and changed-decision notes.

## After the fire

Keep the evergreen machina, active design, runbooks and tests readable. Let the **gut carry ashes** as the operator phrased it: operationally retain Git history, named historical witnesses and reversible archives; do not pretend this phrase authorizes deletion or changes the precise `o-takiage` semantics. A retirement proposal names exact paths/claims, migration target, counterexample coverage, rollback key and operator approval before any destructive action. A successful release leaves source, native evidence and historical receipts intact.
