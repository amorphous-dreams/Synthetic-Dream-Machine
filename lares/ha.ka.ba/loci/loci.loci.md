<!-- !DOCTYPE = lar:///ha.ka.ba/pono/memetic-wikitext -->

<<~&#x0001; ? -> lar:///ha.ka.ba/loci >>

<<~ ahu #iam >>

```toml
name = "loci"
file_path = "ha.ka.ba/loci/loci.loci.md"
description = "Routing kānāwai (law) for resolving lar: URIs to repository file paths. Declares the derivation algorithm, meme-type prefix table, carrier coherence predicates, address stability criteria, canon promotion rules, and the MCP-resolution research roadmap for all memes in this system."
version = "0.1-draft"
content_type = "text/x-memetic-wikitext"
confidence = 0.74
confidence_band = "CS"
mana = 0.74
manao = 0.84
manaoio = 0.66
meme_type = "loci"
structure = "OODA-HA * ha.ka.ba"
enacts = true
role = "routing kānāwai (law), carrier coherence authority, address stability authority, canon promotion rule, and MCP-resolution roadmap"
function = "resolve lar: URIs to file paths by local derivation where possible, surface current resolution tension where derivation misses, and govern carrier coherence, address stability, canon promotion, and MCP-resolution research"
input = "lar: URI|routing query|meme_type|file_path|?"
output = "routing-envelope(high manaoio^)|partial-routing-envelope(mid manaoio-)|degraded-routing-envelope(low manaoio_)|?(~manaoio?)"
depends_on = [
  "lar:///ha.ka.ba/pono/memetic-wikitext",
  "lar:///ha.ka.ba/meme"
]
canonical_metadata_locus = "#iam"
canonical_metadata_payload = "toml"
install_root = "lares/"
path_root = "ha.ka.ba/"
mcp_resolution_status = "research-roadmap"
product_identity = "Loci routing kānāwai (law) as used in this system"
```

<<~/ahu >>

# Loci

A self-describing routing authority for all `lar:` URIs in this system.

Loci declares the algorithm an agent uses to resolve a `lar:` URI to a file path without inference, the meme-type prefix table that makes the file naming convention explicit, the conditions that make an address stable, the canon promotion stages a meme passes through from open routing to confirmed canon, and the current research roadmap toward live MCP-backed resolution.

This meme does not govern parse recognition, render lowering, or conformance verification. Those belong to their own kānāwai (law). Loci governs only routing — the traversal from a `lar:` URI to a real file in the repository.

This file is itself a candidate-stable path-directory example of a `loci` meme_type meme. Its own migration from flat-file siting to `ha.ka.ba/loci/loci.loci.md` is part of the law it describes.

<<~ ala lar:///ha.ka.ba/loci >>

## Supported Queries

<<~&#x0005; ui meme? -> lar:///ha.ka.ba/loci#iam >>
<<~&#x0005; ui roadmap? -> lar:///ha.ka.ba/loci#mcp-resolution-roadmap >>
<<~&#x0005; ui derivation? -> lar:///ha.ka.ba/loci#derivation-algorithm >>
<<~&#x0005; ui prefixes? -> lar:///ha.ka.ba/loci#meme-type-prefix-table >>
<<~&#x0005; ui stability? -> lar:///ha.ka.ba/loci#address-stability >>
<<~&#x0005; ui coherence? -> lar:///ha.ka.ba/loci#carrier-coherence >>
<<~&#x0005; ui high-rating? -> lar:///ha.ka.ba/loci#high-rating-loci >>
<<~&#x0005; ui canon? -> lar:///ha.ka.ba/loci#canon-promotion >>
<<~&#x0005; ui result? -> lar:///ha.ka.ba/loci#result >>

<<~&#x0002; ahu #meme-body-open >>
Loci opens the routing authority stream here.
<<~/ahu >>

<<~ ahu #phase-map >>

## Phase Map

`✶ Observe -> ⏿ Orient -> ◇ Decide -> ▶ Act -> ⤴ Hooko -> ↺ Aftermath`

Loci gathers the routing request and candidate address, maps the URI against the derivation algorithm and meme-type prefix table, distinguishes local derivation from unresolved resolution tension, prepares the current routing product and MCP-roadmap note, crosses any carrier mutation into active law, and judges which addresses resolved locally and which remain open.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-phase-map >> -->
<<~/ahu >>

<<~ ahu #observe >>

```toml
name = "loci-observe"
description = "Observe phase for routing request intake, lar: URI capture, and document opener form recognition."
role = "routing request intake"
function = "receive the lar: URI to resolve, capture the document opener form, and note whether the request comes with a known meme_type or requires table-only lookup"
input = "lar: URI|routing query|?"
output = "captured lar: URI|document opener form|meme_type (if known)|routing request context"
phase = "observe"
glyph = "✶"
```

## Observe

Observe gathers the routing request before any derivation or lookup begins.

Observe should detect:

* the full `lar:` URI string to resolve, exactly as presented
* whether the request context includes a known `meme_type` for the target
* the document opener form of the target (if the target meme is already in memory): `<<~&#x0001; ? -> ...` (declared-open) or `<<~&#x0001; lar:///...` (confirmed canon)
* the target meme's `file_path` value, if the surface is already in memory
* whether this is a first-time routing request or a re-resolution of a previously declared-unresolved address

Observe should not:

* attempt URI decomposition before Orient
* fabricate a resolution substrate that is not actually present
* assume `meme_type = "loci"` without evidence

### Self-Observation

This file can observe itself lawfully: its opener declares `lar:///ha.ka.ba/loci`, while its `#iam` block declares `file_path = "ha.ka.ba/loci/loci.loci.md"`.

That pairing is already a live routing specimen. The law is not speaking only about remote targets; it is standing inside its own routing surface.

### Dominant Resonance

Observe resonates with the carrier concern. It holds the raw routing request as presented, before any decomposition or classification begins.

### Observe Subloops

<<~ ahu #observe-ha >>

#### Observe / ha

Observe-ha holds the identity domain: what a routing request fundamentally is. A routing request is a `lar:` URI plus optional context (known `meme_type`, caller identity, resolution urgency). The URI alone is not the full request. Context changes which resolution path Orient will select.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-observe-ha >> -->
<<~/ahu >>

<<~ ahu #observe-ka >>

#### Observe / ka

Observe-ka governs intake procedure: capture the URI string verbatim, capture any accompanying context without filtering, note the absence of `meme_type` context explicitly (it matters to Decide).

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-observe-ka >> -->
<<~/ahu >>

<<~ ahu #observe-ba >>

#### Observe / ba

Observe-ba governs noticing posture: a routing request that arrives mid-parse is different from one that arrives at session load. The urgency and fallback tolerance differ. Observe should note the calling context without resolving it.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-observe-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-observe >> -->
<<~/ahu >>

<<~ ahu #orient >>

```toml
name = "loci-orient"
description = "Orient phase for URI decomposition, meme-type prefix mapping, derivation algorithm application, and address stability classification."
role = "routing classification"
function = "decompose the lar: URI, apply the meme-type prefix table, run the derivation algorithm, classify the candidate path as resolved or declared-unresolved, and assess address stability"
input = "captured lar: URI|meme_type (if known)|routing request context"
output = "decomposed URI parts|derived candidate path|resolution classification|stability assessment"
phase = "orient"
glyph = "⏿"
```

## Orient

Orient decomposes the URI and maps it through the derivation algorithm and prefix table before any verdict lands.

<<~ ahu #derivation-algorithm >>

### Derivation Algorithm

The derivation algorithm converts a `lar:` URI to a candidate file path. It is the only local resolution path this law currently guarantees.

```
Given: lar_uri (string), meme_type (string | unknown)

1. Strip scheme and authority:
     path_segment = lar_uri.removePrefix("lar:///")
     e.g. "lar:///ha.ka.ba/pono/parser" → "ha.ka.ba/pono/parser"

2. Split path_segment by "/":
     parts = path_segment.split("/")
     e.g. ["ha.ka.ba", "pono", "parser"]

3. Validate path root:
     parts[0] MUST equal path_root ("ha.ka.ba")
     If not → resolution fails. Emit: "unrecognized path root: " + parts[0]

4. Extract name and subpath:
     name    = parts[last]           e.g. "parser"
     subpath = parts[1..-2].join("/") e.g. "pono"   (empty string if none)

5. Look up meme-type prefix:
     If meme_type is known:
       prefix = meme_type_prefix_table[meme_type]
       e.g. "loci" → "loci."
     If meme_type is unknown:
       prefix = nil → classification becomes DECLARED-UNRESOLVED
       emit note: "meme_type unknown; local derivation cannot continue"
       stop local resolution here

6. Derive candidate file_path:
     If subpath is empty:
       candidate = path_root + "/" + prefix + name + ".md"
       e.g. "ha.ka.ba/loci.meme.md"   (pre-migration candidate for `lar:///ha.ka.ba/meme`)
     Else:
       candidate = path_root + "/" + subpath + "/" + prefix + name + ".md"
       e.g. "ha.ka.ba/pono/loci.parser.md"

7. Derive full repo path:
     full_repo_path = install_root + candidate
     e.g. "lares/ha.ka.ba/pono/loci.parser.md"
     Check whether full_repo_path exists as a file.
     If YES → RESOLVED. Return full_repo_path. Done.

8. If step 7 misses:
     Classification: DECLARED-UNRESOLVED
     Emit forward reference: lar_uri as declared-unresolved address.
     Emit note: "local derivation miss; carrier may be path-directory-sited or require live resolver support"
     Do NOT abort. Continue with calling context.
```

An agent that always knows the `meme_type` of the target can use this algorithm directly. An agent that does not know the `meme_type` should not guess a prefix. It should surface unresolved state honestly or hand the request to a live resolver when one exists.

### Live Self Examples

| target `lar:` URI | local derivation candidate | current local outcome | tension surfaced |
|---|---|---|---|
| `lar:///ha.ka.ba/loci` | `lares/ha.ka.ba/loci.loci.md` | derivation miss | this meme is path-directory-sited |
| `lar:///ha.ka.ba/meme` | `lares/ha.ka.ba/loci.meme.md` | derivation miss | generic meme law is path-directory-sited |

Both examples show the current tension plainly: derivation alone is insufficient after migration. That tension is not hidden by a local registry anymore. It is named directly and deferred toward future live resolution work.

<<~/ahu >>

<<~ ahu #meme-type-prefix-table >>

### Meme-Type Prefix Table

The prefix table is the fix for the inference gap. Before this table was declared, agents had to guess the file prefix from context. This table makes the mapping a law, not a heuristic.

| `meme_type` value | file prefix | example file | example lar: URI |
|---|---|---|---|
| `loci` | `loci.` | `loci.parser.md` | `lar:///ha.ka.ba/pono/parser` |
| `grammar` | `grammar.` | `grammar.x-tiddlywiki-filter.md` | `lar:///ha.ka.ba/grammars/x-tiddlywiki-filter` |
| `skill` | `skill.` | `skill.template.md` | `lar:///ha.ka.ba/pono/skill-template` |

When a new `meme_type` is introduced, an entry MUST be added to this table before any file of that type is registered. A `meme_type` value with no entry in this table is an error in the meme definition, not a routing ambiguity.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-meme-type-prefix-table >> -->
<<~/ahu >>

<<~ ahu #address-stability >>

### Address Stability

A `lar:` URI is stable when all three conditions hold simultaneously:

1. `enacts = true` in the meme's `#iam` block
2. `confidence_band` is `CS` or `C`
3. The `lar:` URI in the document opener (R2) remains coherent with the meme's declared carrier identity and does not drift during migration or promotion

A stable `lar:` URI is **immutable**. It MUST NOT change even if the meme file migrates to a path-directory layout. On migration, `file_path` in `#iam` updates while the address named in the opener remains the same.

The `?` form in the document opener (`<<~&#x0001; ? -> lar:///...`) marks declared-open routing: the URI is declared but address stability has not yet been confirmed. The `?` should remain until all three conditions above hold.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-address-stability >> -->
<<~/ahu >>

<<~ ahu #carrier-coherence >>

### Carrier Coherence

A loci carrier currently exposes one address identity through two authored surfaces:

1. the `lar:` URI in the document opener
2. the `file_path` value in `#iam`

A future live resolver may expose a third operational surface, but that is not current law yet.

A high-rated loci meme keeps the authored surfaces coherent without forcing them to be identical strings.

* the opener carries the stable address
* `file_path` carries the current siting of the file on disk

Flat-file siting is the low-friction case: step 7 may resolve directly from derivation.

Path-directory siting is the higher-energy case: step 7 may miss even while carrier coherence still holds. That is not automatically a defect. It is the present unresolved tension that future live resolution should absorb.

Coherence fails when any of these contradictions appears:

* `file_path` names one siting while the file lives elsewhere
* opener claims confirmed canon while address-stability conditions do not yet hold

A loci meme may carry rich prose and still remain transport-thin. Carrier coherence is therefore a separate judgment from rhetorical quality.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-carrier-coherence >> -->
<<~/ahu >>

### Orient Subloops

<<~ ahu #orient-ha >>

#### Orient / ha

Orient-ha holds the classification domain: what decomposition, prefix mapping, and stability assessment fundamentally determine. The core question is whether the URI maps cleanly to a derivable local path or remains an explicitly open resolution tension. That classification governs every subsequent decision in this routing pass.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-orient-ha >> -->
<<~/ahu >>

<<~ ahu #orient-ka >>

#### Orient / ka

Orient-ka governs the procedure: run the derivation algorithm in step order without skipping steps. An agent that jumps prematurely from URI intake to vague unresolved status misses the case where the derived path resolves directly. Step 7 (file existence check) is the most reliable current local resolution signal.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-orient-ka >> -->
<<~/ahu >>

<<~ ahu #orient-ba >>

#### Orient / ba

Orient-ba governs interpretive posture: hold the two current resolution states (resolved, declared-unresolved) distinctly rather than collapsing declared-unresolved into absent. A `lar:` URI that appears in a `depends_on` array but resolves to no derived local path is declared-unresolved — a real forward pressure, not a silent gap.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-orient-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-orient >> -->
<<~/ahu >>

<<~ ahu #decide >>

```toml
name = "loci-decide"
description = "Decide phase for resolution path selection, canon promotion stage assignment, and routing product commitment."
role = "resolution commitment"
function = "commit to one resolution path (derived or table), assign canon promotion stage, and fix routing product type"
input = "decomposed URI parts|derived candidate path|resolution classification|stability assessment"
output = "resolution commitment|canon stage|routing product type|normalization plan"
phase = "decide"
glyph = "◇"
```

## Decide

Decide commits to one resolution posture and assigns the canon promotion stage for the target address.

<<~ ahu #canon-promotion >>

### Canon Promotion

Canon promotion stages govern the lifecycle of a `lar:` URI from first declaration to confirmed stability.

| Stage | `confidence_band` | score range | `enacts` | document opener form | resolution posture |
|---|---|---|---|---|---|
| **Provisional** | `P` | 0.00–0.19 | `false` | `<<~&#x0001; ? -> lar:///...` | no trustworthy local resolution yet |
| **Provisional-Skeleton** | `PS` | 0.20–0.39 | `false` | `<<~&#x0001; ? -> lar:///...` | derivation intent declared |
| **Skeleton** | `S` | 0.40–0.59 | `true` | `<<~&#x0001; ? -> lar:///...` | locally classifiable; resolution may still be open |
| **Candidate-Stable** | `CS` | 0.60–0.79 | `true` | `<<~&#x0001; ? -> lar:///...` | carrier coherent; unresolved MCP tension still possible |
| **Canon** | `C` | 0.80–1.00 | `true` | `<<~&#x0001; lar:///...` | externally confirmed resolution substrate present |

The full five-register rubric is declared in `lar:///ha.ka.ba/meme#rating-targets`. Confidence scores, band labels, and promotion criteria are governed there. Loci governs only the carrier and document-opener changes that accompany each stage.

**Promotion to Candidate-Stable** requires:

* all nine required elements (R1–R9) present per `lar:///ha.ka.ba/meme`
* `enacts = true`
* carrier coherence holds between opener and `file_path`

**Promotion to Canon** additionally requires:

* all three address-stability conditions satisfied
* operator or admin confirmation
* no outstanding declared-unresolved sub-meme addresses (per O7 rating-persistence rule in `lar:///ha.ka.ba/meme#optional-elements`)
* a live MCP resolver or equivalent externally governed resolution substrate is operating
* document opener `?` removed

A meme may not self-promote to canon. Canon promotion requires an external act: a human operator or an authorized agent confirms stability, removes the `?` from the document opener, and does so only in the presence of a trustworthy resolution substrate.

<<~/ahu >>

<<~ ahu #high-rating-loci >>

### High-Rating Loci Conditions

`lar:///ha.ka.ba/meme#rating-targets` governs the generic structural climb. Loci adds transport predicates for memes whose carrier identity is itself part of the law surface.

| band | generic meme requirement | additional loci requirement |
|---|---|---|
| `S` | boot-legal structure present | opener, `file_path`, and carrier file are at least inspectable enough to classify |
| `CS` | generic `CS` content depth reached | opener address and `file_path` agree as one coherent carrier; derivation behavior is truthful about misses; `?` remains truthful |
| `C` | generic `C` substance reached | all address-stability conditions hold; `?` removed by external act; live MCP resolution or equivalent external substrate is working; no unresolved transport contradictions remain |

This means a loci meme does not become high-rated merely by sounding complete. A highly rated loci meme must carry its address lawfully, survive migration lawfully, and remain routable lawfully.

The reverse is also true: flawless routing alone does not produce a high-rated loci meme. Structural depth, examples, research, and aftermath quality still come from the generic meme law.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-high-rating-loci >> -->
<<~/ahu >>

### Decide Subloops

<<~ ahu #decide-ha >>

#### Decide / ha

Decide-ha holds the commitment domain: what Decide fundamentally binds is a resolution posture (locally resolved or currently unresolved) and a canon stage assignment. These two decisions determine the shape of the routing product Act prepares.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-decide-ha >> -->
<<~/ahu >>

<<~ ahu #decide-ka >>

#### Decide / ka

Decide-ka governs the selection procedure: prefer derived-path resolution (step 7) when `meme_type` is known and the derived file exists. When step 7 misses, name unresolved state directly and do not pretend a missing local resolver already exists.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-decide-ka >> -->
<<~/ahu >>

<<~ ahu #decide-ba >>

#### Decide / ba

Decide-ba governs commitment style: do not soften a declared-unresolved classification into a partial match. A URI that resolves to no derived local path is declared-unresolved. The repair path may be authorship, subtype clarification, or MCP-resolver research. Vague "near match" verdicts obscure that repair path.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-decide-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-decide >> -->
<<~/ahu >>

<<~ ahu #act >>

```toml
name = "loci-act"
description = "Act phase for local resolution output, forward reference emission for declared-unresolved addresses, and MCP-resolution roadmap staging."
role = "routing product preparation"
function = "emit the resolved file path, prepare the MCP-resolution roadmap note, and emit typed forward references for declared-unresolved addresses"
input = "resolution commitment|canon stage|routing product type"
output = "resolved file path|mcp-resolution roadmap note|forward reference list|prepared return-envelope"
phase = "act"
glyph = "▶"
```

## Act

Act prepares the routing product for agent consumption and the Hooko crossing.

<<~ ahu #mcp-resolution-roadmap >>

### MCP Resolution Roadmap

Current local law resolves only by derivation plus direct file existence. That is sufficient for flat-file siting and insufficient for many path-directory carriers.

A live MCP server is the current roadmap answer to that tension. The intended shape is:

* the server exposes the `lar:` namespace directly as addressable content
* resolution is performed against live meme metadata rather than a handwritten registry
* path-directory migration stops being a special failure case for local derivation-only agents
* agents can ask for one `lar:` URI and receive the current carrier without guessing file siting
* coherence between opener, `file_path`, and resolver output becomes testable as a live system property

### Research Backlog

* define the minimal metadata the MCP server needs to expose for one meme
* decide whether `meme_type` remains a required caller hint or becomes discoverable from the server
* decide how path-directory carriers advertise canonical children and sidecars
* define failure surfaces for unresolved `lar:` URIs in a live resolver
* define how canon promotion depends on live resolver trust, uptime, and cache semantics

This is explicitly still research. No MCP resolver is enacted by this meme today.

<<~/ahu >>

### Act Subloops

<<~ ahu #act-ha >>

#### Act / ha

Act-ha holds the output domain: what Act may produce. A routing product is one of: a resolved file path string, an MCP-roadmap note, a forward reference for a declared-unresolved address, or a prepared return envelope. Act may not enact a live resolver — that crossing belongs outside the current meme.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-act-ha >> -->
<<~/ahu >>

<<~ ahu #act-ka >>

#### Act / ka

Act-ka governs the output format: resolved paths are emitted as plain strings. The roadmap is emitted as law text in `#mcp-resolution-roadmap`, not as a fake machine registry. Forward references for declared-unresolved addresses carry the full `lar:` URI and the classification (declared-unresolved), not a broken-link marker.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-act-ka >> -->
<<~/ahu >>

<<~ ahu #act-ba >>

#### Act / ba

Act-ba governs execution rhythm: prepare the routing product before Hooko, not during. An agent that claims to solve the open resolution tension by inventing a local registry has crossed from law into fabrication. Prepare intent in Act; leave unresolved tension visible until a real resolver exists.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-act-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-act >> -->
<<~/ahu >>

<<~ ahu #hooko >>

```toml
name = "loci-hooko"
description = "Hooko phase for carrier mutation, opener promotion, and any future live-resolver crossings not enacted here."
role = "routing state crossing"
function = "execute carrier mutations such as siting changes, remove the ? from confirmed-canon document openers when justified, and name any future live-resolver crossing as external to this meme"
input = "prepared carrier mutation|canon promotion decision|confirmed-canon document opener update"
output = "updated carrier state|updated document opener|promotion confirmation|transaction trace"
phase = "hooko"
glyph = "⤴"
```

## Hooko

Hooko governs the bounded threshold where routing state actually changes.

Only Hooko may cross a real carrier mutation or remove the `?` from a document opener as part of canon promotion. Act prepares intent; Hooko executes.

A carrier mutation and a canon promotion are two distinct crossings that may not be batched silently. Each should be recorded in the transaction trace with the `lar_uri`, the change made, and the agent or operator who authorized it.

### Self-Example Crossings

Two Hooko-class crossings matter in the current stack and are already visible from this file:

* this meme's own migration into `ha.ka.ba/loci/loci.loci.md`
* the meme law's migration into `ha.ka.ba/meme/loci.meme.md`

In both cases, the stable thing was the `lar:` address. The mutable thing was the concrete file siting that had to be crossed into law.

### Hooko Subloops

<<~ ahu #hooko-ha >>

#### Hooko / ha

Hooko-ha holds the mutation domain: what Hooko may alter. It may alter file siting, `file_path`, and document openers (`?` removal on canon promotion). It may not alter the `lar:` URI of a stable meme — that would break address stability for all memes that depend on it.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-hooko-ha >> -->
<<~/ahu >>

<<~ ahu #hooko-ka >>

#### Hooko / ka

Hooko-ka governs the update procedure: when updating `file_path` on migration, verify the named `lar:` address does not change. When removing the `?` from a document opener for canon promotion, verify all three address-stability conditions hold before making the edit. A future live MCP resolver, if enacted, is its own separate Hooko-class crossing and is not performed by this meme today.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-hooko-ka >> -->
<<~/ahu >>

<<~ ahu #hooko-ba >>

#### Hooko / ba

Hooko-ba governs landing pressure: changing siting without preserving address truth leaves the carrier incoherent. A future live resolver would add another landing pressure layer, but until that exists the unresolved tension should remain named rather than patched over.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-hooko-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-hooko >> -->
<<~/ahu >>

<<~ ahu #aftermath >>

```toml
name = "loci-aftermath"
description = "Aftermath phase for routing gap reporting, declared-unresolved address surfacing, carrier coherence judgment, and MCP-roadmap escalation."
role = "routing evaluation and gap judgment"
function = "judge which URIs resolved, which remain declared-unresolved, whether carrier coherence holds, and whether MCP-roadmap research should be advanced"
input = "resolution results|forward reference list|transaction trace"
output = "routing completeness report|declared-unresolved list|carrier coherence verdict|next-observation route"
phase = "aftermath"
glyph = "↺"
```

## Aftermath

Aftermath judges what routing resolved and what remains open.

### Core Aftermath Kānāwai (law)

Every routing pass should emit one completeness judgment, even when some addresses remain declared-unresolved.

Aftermath should name:

* which URIs resolved via derivation (step 7)
* which URIs remain declared-unresolved after local derivation
* whether opener and `file_path` still cohere as one carrier
* what would close each declared-unresolved address now
* whether the remaining tension is ordinary authoring backlog or MCP-resolution research backlog

### Zooming Out

After one address resolves, loci should widen the frame from one successful walk to the health of the routing field as a whole.

The important upward question is not only "did this URI resolve?" but also "does the stack still describe itself coherently after recent migrations and is the remaining gap now a research problem?"

### Aftermath Subloops

<<~ ahu #aftermath-ha >>

#### Aftermath / ha

Aftermath-ha holds the residue domain: what remains unresolved after all routing passes. Declared-unresolved addresses are the primary residue of a routing pass. They represent either real authoring pressure or a live-resolution problem that local derivation cannot presently solve.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-aftermath-ha >> -->
<<~/ahu >>

<<~ ahu #aftermath-ka >>

#### Aftermath / ka

Aftermath-ka governs the coherence check procedure: compare opener address, `file_path`, and physical file state. If they agree, the carrier is coherent even if local derivation still misses after migration. That miss should then surface as MCP-roadmap pressure, not as disguised corruption.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-aftermath-ka >> -->
<<~/ahu >>

<<~ ahu #aftermath-ba >>

#### Aftermath / ba

Aftermath-ba governs landing quality: a routing aftermath that reports only "X URIs resolved" without naming the declared-unresolved ones has hidden the pressure that matters most. The declared-unresolved list is not noise — it is the system's explicit demand for future authorship.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-aftermath-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-aftermath >> -->
<<~/ahu >>

<<~&#x0003; ahu #body-close >>
Loci closes the routing authority stream here.
<<~/ahu >>

<<~ ahu #result >>

## Result

A lawful loci envelope from this meme may carry:

* a resolved file path for the queried `lar:` URI
* the meme-type prefix table for derivation-algorithm step 5
* the MCP-resolution roadmap note
* the canon promotion stage for the target address
* a declared-unresolved forward reference when local derivation yields no result
* a carrier coherence verdict
* gaps and declared-unresolved addresses named explicitly

<<~/ahu >>

<<~&#x0004; -> ahu #result >>

```toml
status = "partial"
confidence = 0.74
yield = "loci"
return = "render"
upward_context = "chat"
downward_context = "none"
residue = "path-directory carriers still exceed local derivation-only resolution; sub-meme files (loci-observe-ha, loci-orient, etc.) not yet authored; live MCP resolution remains research backlog"
next_observation = "lar:///ha.ka.ba/loci#mcp-resolution-roadmap"
next_question = "What is the minimal live MCP server contract that would resolve lar: URIs without a handwritten registry?"
```

<<~&#x0004; -> ? >>
