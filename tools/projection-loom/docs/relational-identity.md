# Relational identity, emergence and o-takiage

## Three different things

1. **Construction handles** let a builder refer to nodes while growing. Anonymous
   handles such as `~p-0003` change when a builder inserts or reorders siblings;
   they are not universal identities and never become user-facing pet-names.
2. **Relational witnesses** describe a node's material/void role, parent
   relationships, declared `#has/<capability>` observations, and optional stable
   rule `slot`. No OpenCascade face index, mesh vertex, or Boolean-output edge
   number holds a permanent identity.
3. **Pet-name claims** link a label to a unique selector and a set of desired
   `#has` propositions. They live in a separate ledger supplied as input on
   future runs; they do not rename source geometry or freeze a model.

`#has/bridge` means the builder has supplied an observable descriptor. It does
**not** grant executable authority, guarantee geometry, certify physical strength,
or impose a hard constraint. New capabilities can appear without waiting for a
name. An explicitly slotted rule may retain a candidate across rearrangement,
while an un-slotted anonymous entity reconciles only when its role, capabilities,
and parent context identify exactly one new occurrence.

## Emergence and location names

`SolidAssembly.spawn(...)` and `spawn_void(...)` return temporary construction
handles. Children may attach to those handles, forming arbitrarily deep unnamed
branches. Authors may provide a semantic `slot` for a repeating construction
rule, without providing a pet-name. This helps discriminate twins and survives
moderate geometric mutation.

`RelationWitness` records the construction graph after growth, and all production
exports emit `relations.json`. `discover` validates the CAD and void model first,
then writes a witness. `pet-name --mode entity` names one unique relational
selector. `pet-name --mode location` names a **dynamic set** of descendants
under a chosen root. `--member-has` may select only capable members; otherwise
all descendants belong. No member needs its own label. `--has` describes soft
capability expectations for the whole location.

A binding resolves as `matched`, `missing`, `ambiguous`, or `drifted`. If two
anonymous forms answer the same selector, the Loom refuses to guess, and
pet-naming that indistinguishable selector requires a stable rule slot first.
A slot may identify a construct whose parental relation changes; the receipt
then reports `drifted`, rather than silently certifying the old relation.

## O-takiage releases a hold, not a body

The name **o-takiage** borrows a metaphor from Japanese rites for respectfully
returning used charms. Here it names a software operation, not an enactment of
that religious rite. It retires a *soft evolutionary preference*:

- `o-takiage --name "A Bridge with Opinions"` releases that label's active
  preference. History, geometry, witnesses, and previous alias claims remain.
- `o-takiage --branch '~p-0003' --witness ...` releases claims rooted in that
  branch. A named surrounding location persists, but excludes the released
  branch from its affinity calculations and relaxes capabilities carried only
  by that branch. Its other descendants remain free to grow and persist.
- A released name may later be reused as a **new claim revision**, never as
  a rewrite of the earlier receipt.

None of these actions relaxes CAD fusion, structural contact tests, void route
validation, or fixed evidence camera rules. For ambiguous branch selectors,
assign a stable construction slot before committing the release.

## Soft retention and open-ended slack

A missing active pet-name incurs a small bounded fitness cost (at most 0.08
across all claims); lost capabilities and relationship drift also contribute.
This encourages reappearance but never disqualifies a structurally valid
construction. O-takiage removes those preferences immediately.

The evolutionary selector reserves a fraction of valid survivors for distinct
construction phenotypes, described by counts of capabilities, roles and
parent/child relations; it does **not** reward unvalidated geometry. The reserve
only fills when meaningful differences exist. A fixed builder without alternate
rules cannot magically invent novel operations; subject builders provide that
space. The `examples/emergent/` project demonstrates parameter-gated anonymous
forks and voids.

## Persistence, causality, and boundaries

The ledger stores an ordered, local sequence of pet-name and release events.
JSON saves use atomic replacement and reject known stale writers. This provides
local optimistic conflict detection, not multiwriter synchronization or a global
clock. Keep the ledger alongside a project's genomes and supply it explicitly
using `--identity-ledger` for evolutionary runs or exported receipts.

A future distributed merge requires separate causal ancestry and conflict
resolution; this implementation does not infer a global `now`. Location names
scope the ledger so unrelated worlds cannot accidentally share a pet-name.

## Prior art and pattern integrity

- Joel Lehman and Kenneth O. Stanley (2011), novelty search and deceptive
  objectives: https://doi.org/10.1162/EVCO_a_00025
- Procedural building grammar and graph rewriting, reusable transformations:
  https://www.sciencedirect.com/science/article/pii/S0097849319301311
- Stable graph identity in evolving data: https://www.mdpi.com/3042-9021/1/1/3
- Tsubaki Grand Shrine's description of ritual return of amulets:
  https://www.tsubakishrine.org/omamori/omamori.html
