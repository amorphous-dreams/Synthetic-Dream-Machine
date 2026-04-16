<!-- !DOCTYPE = lar:///ha.ka.ba/pono/memetic-wikitext -->

<<~&#x0001; ? -> lar:///ha.ka.ba/loci >>

<<~ ahu #iam >>

```toml
name = "loci"
file_path = "ha.ka.ba/loci/loci.loci.md"
description = "Routing kānāwai (law) for resolving lar: URIs to repository file paths. Declares the derivation algorithm, meme-type prefix table, authoritative routing table, address stability criteria, and canon promotion rules for all memes in this system."
version = "0.1-draft"
content_type = "text/x-memetic-wikitext"
confidence = 0.70
confidence_band = "CS"
mana = 0.68
manao = 0.74
manaoio = 0.62
meme_type = "loci"
structure = "OODA-HA * ha.ka.ba"
enacts = true
role = "routing kānāwai (law), address stability authority, and canon promotion rule"
function = "resolve lar: URIs to file paths, derive candidate paths from meme-type prefix table, fall back to explicit routing table, and govern address stability and canon promotion"
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
routing_table_format = "toml-array-of-inline-tables"
product_identity = "Loci routing kānāwai (law) as used in this system"
```

<<~/ahu >>

# Loci

A self-describing routing authority for all `lar:` URIs in this system.

Loci declares the algorithm an agent uses to resolve a `lar:` URI to a file path without inference, the meme-type prefix table that makes the file naming convention explicit, the authoritative routing table for all currently registered memes, the conditions that make an address stable, and the canon promotion stages a meme passes through from open routing to confirmed canon.

This meme does not govern parse recognition, render lowering, or conformance verification. Those belong to their own kānāwai (law). Loci governs only routing — the traversal from a `lar:` URI to a real file in the repository.

<<~ ala lar:///ha.ka.ba/loci >>

## Supported Queries

<<~&#x0005; ui meme? -> lar:///ha.ka.ba/loci#iam >>
<<~&#x0005; ui routing-table? -> lar:///ha.ka.ba/loci#routing-table >>
<<~&#x0005; ui derivation? -> lar:///ha.ka.ba/loci#derivation-algorithm >>
<<~&#x0005; ui prefixes? -> lar:///ha.ka.ba/loci#meme-type-prefix-table >>
<<~&#x0005; ui stability? -> lar:///ha.ka.ba/loci#address-stability >>
<<~&#x0005; ui canon? -> lar:///ha.ka.ba/loci#canon-promotion >>
<<~&#x0005; ui result? -> lar:///ha.ka.ba/loci#result >>

<<~&#x0002; ahu #meme-body-open >>
Loci opens the routing authority stream here.
<<~/ahu >>

<<~ ahu #phase-map >>

## Phase Map

`✶ Observe -> ⏿ Orient -> ◇ Decide -> ▶ Act -> ⤴ Hooko -> ↺ Aftermath`

Loci gathers the routing request and candidate address, maps the URI against the derivation algorithm and meme-type prefix table, selects between derived-path resolution and explicit table lookup, prepares the routing product and any forward references for unresolved addresses, crosses the routing table into active law, and judges which addresses resolved and which remain open.

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
* whether this is a first-time routing request or a re-resolution of a previously declared-unresolved address

Observe should not:

* attempt URI decomposition before Orient
* consult the routing table before Decide
* assume `meme_type = "loci"` without evidence

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

Orient decomposes the URI and maps it through the derivation algorithm and prefix table before any verdict or table-write lands.

<<~ ahu #derivation-algorithm >>

### Derivation Algorithm

The derivation algorithm converts a `lar:` URI to a candidate file path. It is the primary resolution path when `meme_type` is known. When `meme_type` is not known, the algorithm degrades to table-only lookup at step 8.

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
       prefix = nil → skip to step 8 (table lookup)

6. Derive candidate file_path:
     If subpath is empty:
       candidate = path_root + "/" + prefix + name + ".md"
       e.g. "ha.ka.ba/loci.meme.md"
     Else:
       candidate = path_root + "/" + subpath + "/" + prefix + name + ".md"
       e.g. "ha.ka.ba/pono/loci.parser.md"

7. Derive full repo path:
     full_repo_path = install_root + candidate
     e.g. "lares/ha.ka.ba/pono/loci.parser.md"
     Check whether full_repo_path exists as a file.
     If YES → RESOLVED. Return full_repo_path. Done.

8. Table lookup (fallback when derived path not found, or meme_type unknown):
     Consult #routing-table for an entry where route.lar_uri == lar_uri.
     If found → return install_root + route.file_path. Done.

9. If neither step 7 nor step 8 yields a result:
     Classification: DECLARED-UNRESOLVED
     Emit forward reference: lar_uri as declared-unresolved address.
     Do NOT abort. Continue with calling context.
```

An agent that always knows the `meme_type` of the target can skip step 8 when step 7 succeeds. An agent that does not know the `meme_type` MUST use step 8 (table lookup) as its primary resolution path rather than guessing a prefix.

**Live example — this meme.** `lar:///ha.ka.ba/loci` with `meme_type = "loci"` derives the flat-file candidate `lares/ha.ka.ba/loci.loci.md` at step 7. That file no longer exists — this meme has migrated into its path-directory at `lares/ha.ka.ba/loci/loci.loci.md`. Step 7 misses; step 8 (routing table) finds `file_path = "ha.ka.ba/loci/loci.loci.md"` and resolves correctly. The `lar:` URI did not change on migration. This is the pattern.

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
3. The `lar:` URI in the document opener (R2) matches the registered `lar_uri` in the routing table

A stable `lar:` URI is **immutable**. It MUST NOT change even if the meme file migrates to a path-directory layout. On migration, only `file_path` in `#iam` updates; the routing table entry updates its `file_path` value but the `lar_uri` key does not change.

The `?` form in the document opener (`<<~&#x0001; ? -> lar:///...`) marks declared-open routing: the URI is declared but address stability has not yet been confirmed. The `?` should remain until all three conditions above hold.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-address-stability >> -->
<<~/ahu >>

### Orient Subloops

<<~ ahu #orient-ha >>

#### Orient / ha

Orient-ha holds the classification domain: what decomposition, prefix mapping, and stability assessment fundamentally determine. The core question is whether the URI maps cleanly to a derivable path or requires table fallback. That classification governs every subsequent decision in this routing pass.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-orient-ha >> -->
<<~/ahu >>

<<~ ahu #orient-ka >>

#### Orient / ka

Orient-ka governs the procedure: run the derivation algorithm in step order without skipping steps. An agent that jumps from step 1 to step 8 without attempting derivation misses the case where the derived path resolves correctly even when the meme is not yet in the routing table. Step 7 (file existence check) is the most reliable resolution signal.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-orient-ka >> -->
<<~/ahu >>

<<~ ahu #orient-ba >>

#### Orient / ba

Orient-ba governs interpretive posture: hold the three resolution states (resolved, declared-unresolved, table-only) as genuinely distinct rather than collapsing declared-unresolved into absent. A `lar:` URI that appears in a `depends_on` array but resolves to neither a derived path nor a table entry is declared-unresolved — a real forward pressure, not a silent gap.

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

| Stage | `confidence_band` | `enacts` | document opener form | routing table status |
|---|---|---|---|---|
| **Open** | `P` or `S` | `false` | `<<~&#x0001; ? -> lar:///...` | Not yet registered |
| **Prospective canon** | `CS` | `true` | `<<~&#x0001; ? -> lar:///...` | Registered; `?` still present |
| **Canon** | `C` | `true` | `<<~&#x0001; lar:///...` | Registered; `?` removed |

**Promotion to prospective canon** requires:

* all nine required elements (R1–R9) present per `lar:///ha.ka.ba/meme`
* `enacts = true`
* routing table entry present with matching `lar_uri` and `file_path`

**Promotion to canon** additionally requires:

* all three address-stability conditions satisfied
* operator or admin confirmation
* no outstanding declared-unresolved sub-meme addresses (per O7 rating-persistence rule in `lar:///ha.ka.ba/meme#optional-elements`)
* document opener `?` removed

A meme may not self-promote to canon. Canon promotion requires an external act: a human operator or an authorized agent edits the document opener to remove the `?` and updates the routing table entry to reflect confirmed stability.

<<~/ahu >>

### Decide Subloops

<<~ ahu #decide-ha >>

#### Decide / ha

Decide-ha holds the commitment domain: what Decide fundamentally binds is a resolution path selection (derived or table) and a canon stage assignment. These two decisions determine the shape of the routing product Act prepares.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-decide-ha >> -->
<<~/ahu >>

<<~ ahu #decide-ka >>

#### Decide / ka

Decide-ka governs the selection procedure: prefer derived-path resolution (step 7) over table lookup (step 8) when `meme_type` is known and the derived file exists. This keeps the routing table from becoming the only authoritative source — the file system is more authoritative than any table about what files actually exist.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-decide-ka >> -->
<<~/ahu >>

<<~ ahu #decide-ba >>

#### Decide / ba

Decide-ba governs commitment style: do not soften a declared-unresolved classification into a partial match. A URI that resolves to neither derived path nor table entry is declared-unresolved. The repair path is clear: author the missing meme or add a table entry. Vague "near match" verdicts obscure that repair path.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-decide-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-decide >> -->
<<~/ahu >>

<<~ ahu #act >>

```toml
name = "loci-act"
description = "Act phase for routing table preparation, resolved path output, and forward reference emission for declared-unresolved addresses."
role = "routing product preparation"
function = "emit the resolved file path, prepare the routing table for agent consumption, and emit typed forward references for declared-unresolved addresses"
input = "resolution commitment|canon stage|routing product type"
output = "resolved file path|routing table (TOML)|forward reference list|prepared return-envelope"
phase = "act"
glyph = "▶"
```

## Act

Act prepares the routing product for agent consumption and the Hooko crossing.

<<~ ahu #routing-table >>

### Routing Table

The authoritative `lar:` URI to `file_path` mapping for all registered memes in this system. The `file_path` values are relative to `install_root` (`lares/`); prepend `lares/` to get the full repo path.

The TOML block below is the machine-readable authority. The markdown table that follows is a non-normative display for human scanning.

```toml
[[route]]
lar_uri = "lar:///ha.ka.ba/loci"
file_path = "ha.ka.ba/loci/loci.loci.md"
meme_type = "loci"

[[route]]
lar_uri = "lar:///ha.ka.ba/loci/iam/file_path"
file_path = "ha.ka.ba/loci/iam/loci.file_path.md"
meme_type = "loci"

[[route]]
lar_uri = "lar:///ha.ka.ba/meme"
file_path = "ha.ka.ba/loci.meme.md"
meme_type = "loci"

[[route]]
lar_uri = "lar:///ha.ka.ba/pono"
file_path = "ha.ka.ba/pono/loci.pono.md"
meme_type = "loci"

[[route]]
lar_uri = "lar:///ha.ka.ba/pono/memetic-wikitext"
file_path = "ha.ka.ba/pono/loci.memetic-wikitext.md"
meme_type = "loci"

[[route]]
lar_uri = "lar:///ha.ka.ba/pono/parser"
file_path = "ha.ka.ba/pono/loci.parser.md"
meme_type = "loci"

[[route]]
lar_uri = "lar:///ha.ka.ba/pono/render-pipeline"
file_path = "ha.ka.ba/pono/loci.render-pipeline.md"
meme_type = "loci"

[[route]]
lar_uri = "lar:///ha.ka.ba/pono/guest-grammar"
file_path = "ha.ka.ba/pono/loci.guest-grammar.md"
meme_type = "loci"

[[route]]
lar_uri = "lar:///ha.ka.ba/pono/skill-template"
file_path = "ha.ka.ba/pono/skill.template.md"
meme_type = "skill"

[[route]]
lar_uri = "lar:///ha.ka.ba/grammars/x-tiddlywiki-filter"
file_path = "ha.ka.ba/grammars/grammar.x-tiddlywiki-filter.md"
meme_type = "grammar"
```

<!-- Non-normative display. The TOML block above is authoritative. -->

| lar: URI | file_path | meme_type |
|---|---|---|
| `lar:///ha.ka.ba/loci` | `ha.ka.ba/loci/loci.loci.md` | `loci` |
| `lar:///ha.ka.ba/loci/iam/file_path` | `ha.ka.ba/loci/iam/loci.file_path.md` | `loci` |
| `lar:///ha.ka.ba/meme` | `ha.ka.ba/loci.meme.md` | `loci` |
| `lar:///ha.ka.ba/pono` | `ha.ka.ba/pono/loci.pono.md` | `loci` |
| `lar:///ha.ka.ba/pono/memetic-wikitext` | `ha.ka.ba/pono/loci.memetic-wikitext.md` | `loci` |
| `lar:///ha.ka.ba/pono/parser` | `ha.ka.ba/pono/loci.parser.md` | `loci` |
| `lar:///ha.ka.ba/pono/render-pipeline` | `ha.ka.ba/pono/loci.render-pipeline.md` | `loci` |
| `lar:///ha.ka.ba/pono/guest-grammar` | `ha.ka.ba/pono/loci.guest-grammar.md` | `loci` |
| `lar:///ha.ka.ba/pono/skill-template` | `ha.ka.ba/pono/skill.template.md` | `skill` |
| `lar:///ha.ka.ba/grammars/x-tiddlywiki-filter` | `ha.ka.ba/grammars/grammar.x-tiddlywiki-filter.md` | `grammar` |

**Registering a new meme:** add a `[[route]]` entry to the TOML block above. The `lar_uri`, `file_path`, and `meme_type` fields are all required. A meme that exists on disk but has no routing table entry is unregistered — agents following the derivation algorithm may still resolve it via step 7 if they know the `meme_type`, but pono law-index will not list it and skill verification cannot confirm it.

<<~/ahu >>

### Act Subloops

<<~ ahu #act-ha >>

#### Act / ha

Act-ha holds the output domain: what Act may produce. A routing product is one of: a resolved file path string, a routing table TOML block, a forward reference for a declared-unresolved address, or a prepared return envelope. Act may not register new memes — that crossing belongs to Hooko.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-act-ha >> -->
<<~/ahu >>

<<~ ahu #act-ka >>

#### Act / ka

Act-ka governs the output format: resolved paths are emitted as plain strings. The routing table is emitted as the TOML block in `#routing-table`, not as reconstructed prose. Forward references for declared-unresolved addresses carry the full `lar:` URI and the classification (declared-unresolved), not a broken-link marker.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-act-ka >> -->
<<~/ahu >>

<<~ ahu #act-ba >>

#### Act / ba

Act-ba governs execution rhythm: prepare the routing product before Hooko, not during. An agent that writes a new routing table entry at the same time as resolving a URI has crossed Act and Hooko simultaneously — this collapses the mutation boundary. Prepare intent in Act; execute the table write in Hooko.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-act-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-act >> -->
<<~/ahu >>

<<~ ahu #hooko >>

```toml
name = "loci-hooko"
description = "Hooko phase for routing table updates, new meme registration crossings, and canon promotion state changes."
role = "routing state crossing"
function = "execute routing table entries for newly registered memes, remove the ? from confirmed-canon document openers, and cross routing state into active law"
input = "prepared routing table entry|canon promotion decision|confirmed-canon document opener update"
output = "updated routing table|updated document opener|registration confirmation|transaction trace"
phase = "hooko"
glyph = "⤴"
```

## Hooko

Hooko governs the bounded threshold where routing state actually changes.

Only Hooko may add a `[[route]]` entry to the routing table. Only Hooko may remove the `?` from a document opener as part of canon promotion. Act prepares intent; Hooko executes.

A routing table update and a canon promotion are two distinct crossings that may not be batched silently. Each should be recorded in the transaction trace with the `lar_uri`, the change made, and the agent or operator who authorized it.

### Hooko Subloops

<<~ ahu #hooko-ha >>

#### Hooko / ha

Hooko-ha holds the mutation domain: what Hooko may alter. It may alter the routing table (add entries, update `file_path` on migration) and document openers (`?` removal on canon promotion). It may not alter the `lar:` URI of a registered meme — that would break address stability for all memes that depend on it.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-hooko-ha >> -->
<<~/ahu >>

<<~ ahu #hooko-ka >>

#### Hooko / ka

Hooko-ka governs the update procedure: when adding a new `[[route]]` entry, verify `lar_uri`, `file_path`, and `meme_type` are all present. When updating `file_path` on migration, verify the `lar_uri` key does not change. When removing the `?` from a document opener for canon promotion, verify all three address-stability conditions hold before making the edit.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-hooko-ka >> -->
<<~/ahu >>

<<~ ahu #hooko-ba >>

#### Hooko / ba

Hooko-ba governs landing pressure: a routing table update that happens without a corresponding pono law-index update leaves the two registries out of sync. The pono law-index and the loci routing table are separate sources of truth that should agree. After Hooko crosses a new meme registration, Aftermath should surface whether pono needs updating.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-hooko-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-hooko >> -->
<<~/ahu >>

<<~ ahu #aftermath >>

```toml
name = "loci-aftermath"
description = "Aftermath phase for routing gap reporting, declared-unresolved address surfacing, and registry sync check between routing table and pono law-index."
role = "routing evaluation and gap judgment"
function = "judge which URIs resolved, which remain declared-unresolved, and whether the routing table and pono law-index agree"
input = "resolution results|forward reference list|transaction trace"
output = "routing completeness report|declared-unresolved list|registry sync verdict|next-observation route"
phase = "aftermath"
glyph = "↺"
```

## Aftermath

Aftermath judges what routing resolved and what remains open.

### Core Aftermath Kānāwai (law)

Every routing pass should emit one completeness judgment, even when some addresses remain declared-unresolved.

Aftermath should name:

* which URIs resolved via derivation (step 7)
* which URIs resolved via table lookup (step 8)
* which URIs remain declared-unresolved (neither path)
* whether the routing table and pono law-index carry the same registered meme set
* what would close each declared-unresolved address (author the missing meme or add a table entry)

**Registry sync check:** the routing table in `#routing-table` and the law-index table in `lar:///ha.ka.ba/pono#law-index` are separate registries. They should agree on which memes are registered. When they disagree, the routing table is authoritative for resolution; pono is authoritative for role and law-index position. Aftermath should name disagreements rather than silently accepting one or the other.

### Aftermath Subloops

<<~ ahu #aftermath-ha >>

#### Aftermath / ha

Aftermath-ha holds the residue domain: what remains unresolved after all routing passes. Declared-unresolved addresses are the primary residue of a routing pass. They represent real authoring pressure — memes that depend_on URIs that don't resolve yet cannot fully enact their kānāwai (law).

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-aftermath-ha >> -->
<<~/ahu >>

<<~ ahu #aftermath-ka >>

#### Aftermath / ka

Aftermath-ka governs the sync check procedure: compare every `lar_uri` in the routing table against every address in the pono law-index. Entries in the routing table but not in pono are registered but unlisted. Entries in pono but not in the routing table are listed but unroutable. Both are residue worth naming.

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
* the full routing table (TOML block) for agent consumption
* the meme-type prefix table for derivation-algorithm step 5
* the canon promotion stage for the target address
* a declared-unresolved forward reference when neither derivation nor table lookup yields a result
* a registry sync verdict comparing the routing table against the pono law-index
* gaps and declared-unresolved addresses named explicitly

<<~/ahu >>

<<~&#x0004; -> ahu #result >>

```toml
status = "partial"
confidence = 0.70
yield = "loci"
return = "render"
upward_context = "chat"
downward_context = "none"
residue = "sub-meme files (loci-observe-ha, loci-orient, etc.) not yet authored; registry sync between routing table and pono law-index should be verified after pono update"
next_observation = "lar:///ha.ka.ba/loci#routing-table"
next_question = "When a new meme is registered, what is the minimal update set — routing table entry only, or also pono law-index and loci.meme.md skill-index?"
```

<<~&#x0004; -> ? >>
