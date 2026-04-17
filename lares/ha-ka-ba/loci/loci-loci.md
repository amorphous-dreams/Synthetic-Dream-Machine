<!-- !DOCTYPE = lar:///ha.ka.ba/pono/memetic-wikitext -->

<<~&#x0001; ? -> lar:///ha.ka.ba/loci >>

<<~ ahu #iam >>

```toml
# <<~ ahu #iam-ha "structure" >>
name = "loci"
file_path = "ha-ka-ba/loci/loci-loci.md"
description = "Loci kānāwai (law) for resolving `lar:` URI memes into explicit routing evidence and current `mana`, `manao`, and `manaoio` posture. Declares the derivation algorithm, the convention surfaces that make routing explicit, the conditions for high-mana `loci` memes, the promotion path from noise to data to meme to typed meme to canon typed meme, and the MCP-resolution research roadmap."
version = "0.1-draft"
tulen = 0.76
confidence = 0.74
mana = 0.74
manao = 0.84
manaoio = 0.66
content_type = "text/x-memetic-wikitext"
meme_type = "loci"
register = "CS"
structure = "OODA-HA * ha.ka.ba"
# <<~/ahu >>
# <<~ ahu #iam-ka "detail" >>
enacts = true
role = "loci-rating kānāwai (law), routing convention authority, address stability authority, canon promotion rule, and MCP-resolution roadmap"
function = "resolve a `lar:` URI meme into routing evidence and present `mana`, `manao`, and `manaoio` posture, while governing explicit convention, address stability, canon promotion, and MCP-resolution research"
install_root = "lares/"
path_root = "ha-ka-ba/"
mcp_resolution_status = "research-roadmap"
# <<~/ahu >>
# <<~ ahu #iam-ba "flow" >>
input = "lar: URI|routing query|meme_type|rating query|?"
output = "loci-rating-envelope(high manaoio^)|partial-loci-rating-envelope(mid manaoio-)|degraded-loci-rating-envelope(low manaoio_)|?(~manaoio?)"
depends_on = [
  "lar:///ha.ka.ba/pono/memetic-wikitext",
  "lar:///ha.ka.ba/meme"
]
# <<~/ahu >>
```

<<~/ahu >>

# Loci

<<~ ala lar:///ha.ka.ba/loci >>

A self-describing loci authority for `lar:` URI memes in this system.

Loci declares the ha.ka.ba an agent uses to resolve a `lar:` URI meme into a present set of `mana`, `manao`, and `manaoio` ratings, the ha.ka.ba which makes the convention explicit, the conditions that make a high-mana `loci` class meme, the canon promotion stages a meme passes through from noise to data to meme to typed meme to canon typed meme, and the current research roadmap toward live MCP-backed resolution.

## Promotion Path

The lifecycle of a carrier in this system follows five buckets, each marking a stronger kind of structure, meaning, and authority:

1. **Noise**: Raw, unstructured, or chaotic signal with no stable machine-usable structure yet.
2. **Data**: Structured language an AI can already find useful without the memetic wrappers.
3. **Meme**: Data with acquired memetic wrappers or boundary surfaces, able to travel as a contextual unit of meaning.
4. **Typed Meme**: A meme that declares and satisfies one or more meme types such as `loci`, `grammar`, `skill`, or `todo`.
5. **Canon Typed Meme**: A typed meme whose declared type bundle received external ratification as stable and authoritative.

**Transition Criteria:**
- *Noise → Data*: Structure or pattern becomes detectable, making the signal machine-usable.
- *Data → Meme*: Memetic wrappers or contextual boundaries appear, letting the data travel as a transmissible meaning-unit.
- *Meme → Typed Meme*: The meme declares and satisfies one or more type laws with explicit role, boundary, and evaluation surfaces.
- *Typed Meme → Canon Typed Meme*: The typed meme receives external ratification as canonical, reaching the highest authority and stability for the stable type claims it carries.

Types need not stay mutually exclusive. A carrier may carry `skill` and `loci`, or `grammar` and `loci`, at the same time. Where current `#iam` still uses a singular `meme_type` field, read it as the primary declared surface type rather than an exclusivity claim.

This five-bucket model replaces an older collapse of typed and canonical stages into the single word `loci`. `Loci` counts as one typed-meme branch, not the whole ladder. More specifically, `loci` names the stable-address type for carriers living under `lar:///ha.ka.ba/**`.

This meme does not govern parse recognition, render lowering, conformance verification, or raw `file_path` capture. Those belong to their own kānāwai (law). Detailed siting capture and agreement live at `lar:///ha.ka.ba/loci/iam/file_path`. Loci governs the routing-and-rating convention above those surfaces.

This file itself takes path-directory-sited `loci` meme form and therefore serves as a live specimen of the law it names: stable address, explicit convention, high-mana aspiration, and still-open MCP resolver backlog.

## Supported Queries

<<~&#x0005; ui meme? -> lar:///ha.ka.ba/loci#iam >>
<<~&#x0005; ui derivation? -> lar:///ha.ka.ba/loci#derivation-algorithm >>
<<~&#x0005; ui prefixes? -> lar:///ha.ka.ba/loci#meme-type-prefix-table >>
<<~&#x0005; ui convention? -> lar:///ha.ka.ba/loci#carrier-coherence >>
<<~&#x0005; ui stability? -> lar:///ha.ka.ba/loci#address-stability >>
<<~&#x0005; ui lifecycle? -> lar:///ha.ka.ba/loci#promotion-path >>
<<~&#x0005; ui ratings? -> lar:///ha.ka.ba/loci#rating-resolution >>
<<~&#x0005; ui high-rating? -> lar:///ha.ka.ba/loci#high-rating-loci >>
<<~&#x0005; ui canon? -> lar:///ha.ka.ba/loci#canon-promotion >>
<<~&#x0005; ui roadmap? -> lar:///ha.ka.ba/loci#mcp-resolution-roadmap >>
<<~&#x0005; ui result? -> lar:///ha.ka.ba/loci#result >>

<<~&#x0002; ahu #meme-body-open >>
Loci opens the routing-and-rating authority stream here.
<<~/ahu >>

<<~ ahu #phase-map >>

## Phase Map

`✶ Observe -> ⏿ Orient -> ◇ Decide -> ▶ Act -> ⤴ Hooko -> ↺ Aftermath`

Loci gathers the `lar:` URI meme and visible convention surfaces, maps the address through derivation and prefix law, classifies lifecycle stage and rating posture, prepares the current rating-and-routing product plus MCP-roadmap note, crosses any promotion or siting mutation into active law, and judges what resolved, what remains open, and what still belongs to research.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/phase-map >> -->
<<~/ahu >>

<<~ ahu #observe >>

```toml
name = "loci-observe"
description = "Observe phase for `lar:` URI meme intake, opener-form recognition, and explicit-convention capture."
role = "loci request intake"
function = "receive the `lar:` URI meme to assess, capture the opener form and any visible convention surfaces, and note whether the request comes with a known `meme_type` or prior rating context"
input = "lar: URI|routing query|?"
output = "captured lar: URI|opener form|visible convention surfaces|meme_type (if known)|routing request context"
phase = "observe"
glyph = "✶"
```

## Observe

Observe gathers the routing request before any derivation, rating, or promotion judgment begins.

Observe should detect:

* the full `lar:` URI string to resolve, exactly as presented
* whether the request context includes a known `meme_type`, prior rating posture, or prior promotion context for the target
* the document opener form of the target (if the target meme already sits in memory): `<<~&#x0001; ? -> ...` (declared-open, with unbound uncertainty still flowing through the address graph) or `<<~&#x0001; lar:///...` (confirmed canon)
* whether the target already exposes explicit loci convention surfaces: `#iam` rating cluster, `register`, prefix-table membership, promotion note, and roadmap note
* whether the request marks a first-time routing-and-rating pass or a re-resolution of a previously declared-unresolved address

Observe should not:

* attempt URI decomposition before Orient
* fabricate a resolution substrate not actually present
* infer high readiness or `meme_type = "loci"` without evidence

### Self-Observation

This file can observe itself lawfully: its opener declares `lar:///ha.ka.ba/loci`, its `#iam` block carries the five rating fields with `register = "CS"`, and its body declares derivation, promotion, and roadmap surfaces.

That bundle already forms a live loci specimen. The law does not speak only about remote targets; it stands inside its own convention surface.

### Dominant Resonance

Observe resonates with the carrier concern. It holds the raw routing request as presented, before any decomposition or classification begins.

### Observe Subloops

<<~ ahu #observe-ha >>

#### Observe / ha

Observe-ha holds the identity domain: what a loci request fundamentally names. A loci request combines a `lar:` URI with optional routing, rating, and lifecycle context. The URI alone does not exhaust the request. Context changes both the resolution path and the rating posture Orient can justify.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-observe-ha >> -->
<<~/ahu >>

<<~ ahu #observe-ka >>

#### Observe / ka

Observe-ka governs intake procedure: capture the URI string verbatim, capture any visible convention surfaces without normalizing them away, and note the absence of `meme_type` or promotion context explicitly because that absence matters later.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-observe-ka >> -->
<<~/ahu >>

<<~ ahu #observe-ba >>

#### Observe / ba

Observe-ba governs noticing posture: a routing request that arrives mid-parse differs from one that arrives at session load. Urgency and fallback tolerance differ. Observe should note the calling context without resolving it.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-observe-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-observe >> -->
<<~/ahu >>

<<~ ahu #orient >>

```toml
name = "loci-orient"
description = "Orient phase for URI decomposition, meme-type prefix mapping, derivation algorithm application, explicit-convention classification, and preliminary rating posture."
role = "routing and rating classification"
function = "decompose the `lar:` URI, apply the meme-type prefix table, run the derivation algorithm, classify the current convention as explicit or thin, and assess address stability plus preliminary rating posture"
input = "captured lar: URI|meme_type (if known)|routing request context"
output = "decomposed URI parts|derived candidate path|resolution classification|convention classification|stability assessment|rating posture"
phase = "orient"
glyph = "⏿"
```

## Orient

Orient decomposes the URI and maps it through the derivation algorithm and prefix table before any rating or promotion verdict lands.

<<~ ahu #derivation-algorithm >>

### Derivation Algorithm

The derivation algorithm converts a `lar:` URI to a candidate file path. It remains the only local resolution path this law currently guarantees.

```
Given: lar_uri (string), meme_type (string | unknown)

1. Strip scheme and authority:
     path_segment = lar_uri.removePrefix("lar:///")
     e.g. "lar:///ha.ka.ba/pono/parser" → "ha-ka-ba/pono/parser"

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
     When meme_type known:
       prefix = meme_type_prefix_table[meme_type]
       e.g. "loci" → "loci-"
     When meme_type unknown:
       prefix = nil → classification becomes DECLARED-UNRESOLVED
       emit note: "meme_type unknown; local derivation cannot continue"
       stop local resolution here

6. Derive candidate file_path:
     filename_stem = name.replace("_", "-")
     If subpath == "":
       candidate = path_root + "/" + prefix + filename_stem + ".md"
       e.g. "ha-ka-ba/loci-meme.md"   (pre-migration candidate for `lar:///ha.ka.ba/meme`)
     Else:
       candidate = path_root + "/" + subpath + "/" + prefix + filename_stem + ".md"
       e.g. "ha-ka-ba/pono/loci-parser.md"

7. Derive full repo path:
     full_repo_path = install_root + candidate
     e.g. "lares/ha-ka-ba/pono/loci-parser.md"
     Check whether full_repo_path exists as a file.
     If YES → RESOLVED. Return full_repo_path. Done.

8. If step 7 misses:
     Classification: DECLARED-UNRESOLVED
     Emit forward reference: lar_uri as declared-unresolved address.
     Emit note: "local derivation miss; carrier may use path-directory siting or require live resolver support"
     Do NOT abort. Continue with calling context.
```

An agent that always knows the `meme_type` of the target can use this algorithm directly. An agent that does not know the `meme_type` should not guess a prefix. It should surface unresolved state honestly or hand the request to a live resolver when one exists.

The algorithm does not by itself assign final ratings. It supplies the structural routing evidence that later sections convert into `mana`, `manao`, and `manaoio` posture.

### Live Self Examples

| target `lar:` URI | local derivation candidate | current local outcome | tension surfaced |
|---|---|---|---|
| `lar:///ha.ka.ba/loci` | `lares/ha-ka-ba/loci-loci.md` | derivation miss | this meme reads as path-directory-sited |
| `lar:///ha.ka.ba/meme` | `lares/ha-ka-ba/loci-meme.md` | derivation miss | generic meme law reads as path-directory-sited |
| `lar:///ha.ka.ba/alpha/test-prompt-00001` | `lares/ha-ka-ba/alpha/alpha-test-prompt-00001.md` | resolved | alpha carriers currently resolve as ordinary flat-file carriers under `ha-ka-ba/alpha/` |

These examples show the current routing state plainly: derivation alone falls short after migration for path-directory-sited loci carriers, while ordinary flat-file carriers still resolve locally.

<<~/ahu >>

<<~ ahu #meme-type-prefix-table >>

### Meme-Type Prefix Table

The prefix table fixes the inference gap. Before this table got declared, agents needed to guess the file prefix from context. This table turns the mapping into law, not heuristic.

| `meme_type` value | file prefix | example file | example lar: URI |
|---|---|---|---|
| `loci` | `loci-` | `loci-parser.md` | `lar:///ha.ka.ba/pono/parser` |
| `alpha` | `alpha-` | `alpha-test-prompt-00001.md` | `lar:///ha.ka.ba/alpha/test-prompt-00001` |
| `grammar` | `grammar-` | `grammar-x-tiddlywiki-filter.md` | `lar:///ha.ka.ba/grammars/x-tiddlywiki-filter` |
| `skill` | `skill-` | `skill-template.md` | `lar:///ha.ka.ba/pono/skill-template` |

When a new `meme_type` enters use, an entry MUST join this table before any file of that type joins the registry. A `meme_type` value with no entry in this table counts as an error in the meme definition, not a routing ambiguity.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-meme-type-prefix-table >> -->
<<~/ahu >>

<<~ ahu #address-stability >>

### Address Stability

A `lar:` URI counts as stable when all three conditions hold simultaneously:

1. `enacts = true` in the meme's `#iam` block
2. `register` falls in `CS` or `C`
3. The `lar:` URI in the document opener (R2) remains coherent with the meme's declared carrier identity and does not drift during migration or promotion

A stable `lar:` URI stays **immutable**. It MUST NOT change even if the carrier migrates to a path-directory layout. On migration, delegated siting evidence may update while the address named in the opener remains the same.

The `?` form in the document opener (`<<~&#x0001; ? -> lar:///...`) marks declared-open routing: the URI stands declared but address stability still lacks confirmation.

Here `?` should read as the graph's unbound uncertainty token at document time, not as filler punctuation.

The `?` should remain until all three conditions above hold.

That opener law differs from the meme footer law: even after opener `?` eventually gets removed at canon, a lawful meme may still discharge residual uncertainty outward through its footer `... -> ? >>`.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-address-stability >> -->
<<~/ahu >>

<<~ ahu #carrier-coherence >>

### Explicit Convention

A `loci` meme makes routing convention explicit when an agent can point to the surfaces that justify the current resolution and rating posture.

Current convention surfaces include:

1. the `lar:` URI in the document opener
2. the `#iam` rating cluster and `register`
3. the derivation algorithm and meme-type prefix table
4. the canon-promotion section and MCP-resolution roadmap

Detailed siting capture and `file_path` agreement sit delegated to `lar:///ha.ka.ba/loci/iam/file_path`. Loci may consume that evidence, but it does not restate the capture law here.

A high-rated loci meme keeps these surfaces mutually intelligible without forcing them to collapse into one string.

* the opener carries the stable address
* the rating cluster and `register` make current maturity explicit
* derivation behavior stays explainable, including honest misses
* the roadmap note keeps unresolved live-resolution tension visible

Flat-file siting offers the low-friction case: step 7 may resolve directly from derivation.

Path-directory siting offers the higher-energy case: step 7 may miss even while explicit convention still holds. That does not automatically count as a defect. Instead, it marks the present unresolved tension that future live resolution should absorb.

Convention fails when any of these contradictions appears:

* opener claims confirmed canon while address-stability conditions do not yet hold
* the meme presents high manifestation readiness while resolution still depends on hidden heuristics
* delegated siting evidence contradicts the declared address or promotion posture

A loci meme may carry rich prose and still remain transport-thin. Explicit convention therefore counts as a separate judgment from rhetorical quality.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-carrier-coherence >> -->
<<~/ahu >>

<<~ ahu #ala-depth-callouts >>

### ala Depth Callouts

When a closing `ala` appears inside an `ahu`, it declares an optional deeper loci-path, not a second spelling of the current block's own anchor.

Canonical forward/downward forms take path-shaped form:

```text
<<~ ala lar:///ha.ka.ba/[NAME]-[phase]-[subphase] >>
<<~ ala lar:///ha.ka.ba/[NAME]-[phase] >>
```

The non-canonical recursive form takes anchor-echo form:

```text
<<~ ala lar:///ha.ka.ba/[current-path]#[same-anchor] >>
```

That recursive form MUST NOT serve as a depth declaration. The enclosing `ahu #...` opener already names the local anchor, so the recursive closing `ala` contributes no new routing product, no child carrier, and no lawful forward pressure.

Use a closing `ala` only when a real child or phase-level carrier gets declared. Without deeper-carrier intent, omit the `ala` line entirely.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-ala-depth-callouts >> -->
<<~/ahu >>

### Orient Subloops

<<~ ahu #orient-ha >>

#### Orient / ha

Orient-ha holds the classification domain: what decomposition, prefix mapping, explicit convention, and stability assessment fundamentally determine. The core question asks whether the URI maps cleanly to a derivable local path, what that says about the current lifecycle stage, and whether the convention reads explicit enough to deserve high ratings.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-orient-ha >> -->
<<~/ahu >>

<<~ ahu #orient-ka >>

#### Orient / ka

Orient-ka governs the procedure: run the derivation algorithm in step order without skipping steps, then read the convention surfaces against the result. An agent that jumps prematurely from URI intake to vague unresolved status misses the case where the derived path resolves directly and therefore overstates the uncertainty.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-orient-ka >> -->
<<~/ahu >>

<<~ ahu #orient-ba >>

#### Orient / ba

Orient-ba governs interpretive posture: hold the two current resolution states (resolved, declared-unresolved) distinctly rather than collapsing declared-unresolved into absent. A `lar:` URI that appears in a `depends_on` array but resolves to no derived local path counts as declared-unresolved — a real forward pressure that lowers readiness and constrains promotion, not a silent gap.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-orient-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-orient >> -->
<<~/ahu >>

<<~ ahu #decide >>

```toml
name = "loci-decide"
description = "Decide phase for resolution posture selection, rating assignment, and canon promotion stage commitment."
role = "resolution and rating commitment"
function = "commit to one resolution posture, assign the current `mana`, `manao`, and `manaoio` posture, and fix the current lifecycle stage"
input = "decomposed URI parts|derived candidate path|resolution classification|convention classification|stability assessment|rating posture"
output = "resolution commitment|rating set|lifecycle stage|routing product type|normalization plan"
phase = "decide"
glyph = "◇"
```

## Decide

Decide commits to one resolution posture, one rating posture, and one canon-lifecycle stage for the target address.

<<~ ahu #canon-promotion >>


### Canon Promotion: The Five Buckets

Canon promotion now tracks how a `lar:` URI meme climbs from raw signal to stable loci authority through five explicit stages:

| Form                | Usual `register` band | Document opener form                  | Current reading                                                                  |
|---------------------|----------------------|---------------------------------------|----------------------------------------------------------------------------------|
| **Noise**           | none or `P`          | none, fragmentary, or `<<~&#x0001; ? -> lar:///...` | The URI appears as signal, but the convention stays too thin for trusted loci authority. |
| **Data**            | `P` or `PS`          | fragmentary, partial, or proto-meme   | Structure or pattern becomes detectable, making the signal machine-usable, but not yet memetic. |
| **Meme**            | `PS` or `S`          | `<<~&#x0001; ? -> lar:///...`           | A boot-legal meme declares the address and enough structure for rating. |
| **Typed Meme (`loci`)**       | `S` or `CS`          | `<<~&#x0001; ? -> lar:///...`           | The carrier satisfies the stable-address type under `lar:///ha.ka.ba/**`; explicit routing convention already surfaces or continues sharpening, and unresolved MCP tension may still remain. |
| **Canon Typed Meme (`loci`)** | `C`                  | `<<~&#x0001; lar:///...`                | Stability received external confirmation, a live resolution substrate operates, and opener uncertainty no longer appears. |

The full five-register rubric appears in `lar:///ha.ka.ba/meme#rating-targets`. Confidence scores, register labels, and promotion criteria sit governed there. Loci governs the routing, convention, and document-opener changes that accompany the climb from noise to data to meme to typed meme to canon typed meme.

**Movement from noise to data** requires:

* Detecting structure or pattern in the signal, making it machine-usable as data.

**Movement from data to meme** requires:

* Boot-legal meme structure
* A declared `lar:` address
* Enough explicit role and function to rate the carrier above raw data

**Movement from meme to typed meme (`loci`)** requires:

* The carrier lives under `lar:///ha.ka.ba/**` and declares stable-address intent
* One or more type laws remain active; `loci` may compose with other types rather than replacing them
* Enough explicit routing convention appears to evaluate the stable-address claim
* Truthful derivation behavior, including honest misses

Higher `CS` posture for a `loci` typed meme additionally expects:

* All nine required elements (R1–R9) present per `lar:///ha.ka.ba/meme`
* `enacts = true`
* Stable-address discipline strong enough to justify `CS`

**Promotion from typed meme (`loci`) to canon typed meme (`loci`)** additionally requires:

* All three address-stability conditions satisfied
* Operator or admin confirmation
* No outstanding declared-unresolved sub-meme addresses (per O7 rating-persistence rule in `lar:///ha.ka.ba/meme#optional-elements`)
* No recursive self-loop closers masquerading as sub-meme declarations
* A live MCP resolver or equivalent externally governed resolution substrate operates
* Document opener `?` removed

A meme may not self-promote to canon. Canon promotion requires an external act: a human operator or an authorized agent confirms stability, removes the `?` from the document opener, and does so only in the presence of a trustworthy resolution substrate.

<<~/ahu >>

<<~ ahu #rating-resolution >>

### Rating Resolution

Loci resolves a `lar:` URI meme to a rating set by reading routing evidence, declared role, and operational readiness together.

| field | rises when | falls when |
|---|---|---|
| `mana` | the URI decomposes cleanly, prefix mapping stays explicit, convention surfaces remain inspectable, and misses receive honest naming | mapping depends on guesses, hidden heuristics, or blurred unresolved state |
| `manao` | the meme clearly knows its loci role, names why the convention exists, and makes lifecycle posture explicit | purpose drifts, routing law mixes with unrelated concerns, or promotion posture stays vague |
| `manaoio` | local resolution repeats reliably now or a live resolver operates, operator crossings stay bounded, and backlog surfaces honestly | resolution depends on unstated manual recovery, promotion self-asserts, or the live-resolution gap stays hidden |

These read as loci-local layers atop the generic meme ratings at `lar:///ha.ka.ba/meme#rating-targets`. A local path hit may raise evidence, but it never overrides truthfulness about unresolved tension.

<<~/ahu >>

<<~ ahu #high-rating-loci >>

### High-Rating Loci Conditions

`lar:///ha.ka.ba/meme#rating-targets` governs the generic structural climb. Loci adds routing-and-convention predicates for memes whose carrier identity itself forms part of the law surface.

* high `mana` requires explicit routing convention, inspectable derivation steps, stable lifecycle naming, and honest unresolved-state handling
* high `manao` requires a carrier that clearly knows itself as loci law, states why the convention exists, and keeps enacted law separate from roadmap speculation
* high `manaoio` requires repeatable resolution posture, bounded operator crossings, and a truthful account of what currently stands enacted versus what still depends on MCP-backed resolution

This means a loci meme does not become high-rated merely by sounding complete. A highly rated loci meme must carry its address lawfully, survive migration lawfully, and remain rateable lawfully.

The reverse also holds true: flawless routing alone does not produce a high-rated loci meme. Structural depth, examples, research, and aftermath quality still come from the generic meme law.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-high-rating-loci >> -->
<<~/ahu >>

### Decide Subloops

<<~ ahu #decide-ha >>

#### Decide / ha

Decide-ha holds the commitment domain: what Decide fundamentally binds: a resolution posture, a rating set, and a canon-lifecycle stage assignment. These three decisions determine the shape of the product Act prepares.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-decide-ha >> -->
<<~/ahu >>

<<~ ahu #decide-ka >>

#### Decide / ka

Decide-ka governs the selection procedure: prefer derived-path resolution (step 7) when `meme_type` remains known and the derived file resolves. When step 7 misses, name unresolved state directly, lower readiness accordingly, and do not pretend a missing local resolver already resolves.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-decide-ka >> -->
<<~/ahu >>

<<~ ahu #decide-ba >>

#### Decide / ba

Decide-ba governs commitment style: do not soften a declared-unresolved classification into a partial match or overrate it into false readiness. A URI that resolves to no derived local path counts as declared-unresolved. Repair paths may take authorship, subtype clarification, or MCP-resolver research form. Vague "near match" verdicts obscure that repair path.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-decide-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-decide >> -->
<<~/ahu >>

<<~ ahu #act >>

```toml
name = "loci-act"
description = "Act phase for rating-envelope preparation, local resolution output, forward reference emission for declared-unresolved addresses, and MCP-resolution roadmap staging."
role = "rating and routing product preparation"
function = "emit the current rating set, any resolved carrier path, prepare the MCP-resolution roadmap note, and emit typed forward references for declared-unresolved addresses"
input = "resolution commitment|canon stage|routing product type"
output = "rating set|resolved carrier path|mcp-resolution roadmap note|forward reference list|prepared return-envelope"
phase = "act"
glyph = "▶"
```

## Act

Act prepares the current loci rating and routing product for agent consumption and the Hooko crossing.

<<~ ahu #mcp-resolution-roadmap >>

### MCP Resolution Roadmap

Current local law resolves only by derivation plus direct file existence. That suffices for flat-file siting and falls short for many path-directory carriers.

A live MCP server marks the current roadmap answer to that tension. The intended shape follows:

* the server exposes the `lar:` namespace directly as addressable content
* resolution occurs against live meme metadata rather than a handwritten registry
* path-directory migration stops functioning as a special failure case for local derivation-only agents
* agents can ask for one `lar:` URI and receive the current carrier without guessing file siting
* coherence between opener, delegated siting evidence, and resolver output becomes testable as a live system property

### Research Backlog

* define the minimal metadata the MCP server needs to expose for one meme
* decide whether `meme_type` remains a required caller hint or becomes discoverable from the server
* decide how path-directory carriers advertise canonical children and sidecars
* define failure surfaces for unresolved `lar:` URIs in a live resolver
* define how canon promotion depends on live resolver trust, uptime, and cache semantics

This still counts explicitly as research. No MCP resolver operates under this meme today.

<<~/ahu >>

### Act Subloops

<<~ ahu #act-ha >>

#### Act / ha

Act-ha holds the output domain: what Act may produce. A loci product may take one of these forms: a rating set, a resolved carrier path string, an MCP-roadmap note, a forward reference for a declared-unresolved address, or a prepared return envelope. Act may not enact a live resolver — that crossing belongs outside the current meme.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-act-ha >> -->
<<~/ahu >>

<<~ ahu #act-ka >>

#### Act / ka

Act-ka governs the output format: rating sets should emit explicitly, resolved paths should emit as plain strings, and the roadmap should appear as law text in `#mcp-resolution-roadmap`, not as a fake machine registry. Forward references for declared-unresolved addresses carry the full `lar:` URI and the classification (declared-unresolved), not a broken-link marker.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-act-ka >> -->
<<~/ahu >>

<<~ ahu #act-ba >>

#### Act / ba

Act-ba governs execution rhythm: prepare the routing product before Hooko, not during. An agent that claims to solve the open resolution tension by inventing a local registry crosses from law into fabrication. Prepare intent in Act; leave unresolved tension visible until a real resolver operates.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-act-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-act >> -->
<<~/ahu >>

<<~ ahu #hooko >>

```toml
name = "loci-hooko"
description = "Hooko phase for carrier mutation, promotion crossing, and any future live-resolver enactment not yet enacted here."
role = "routing state crossing"
function = "execute carrier mutations such as siting changes or delegated metadata updates, remove the ? from confirmed-canon document openers when justified, and name any future live-resolver crossing as external to this meme"
input = "prepared carrier mutation|canon promotion decision|confirmed-canon document opener update"
output = "updated carrier state|updated document opener|promotion confirmation|transaction trace"
phase = "hooko"
glyph = "⤴"
```

## Hooko

Hooko governs the bounded threshold where routing state actually changes.

Only Hooko may cross a real carrier mutation or remove the `?` from a document opener as part of canon promotion. Act prepares intent; Hooko executes.

A carrier mutation and a canon promotion mark two distinct crossings that may not batch silently. Each should enter the transaction trace with the `lar_uri`, the change made, and the agent or operator who authorized it.

### Self-Example Crossings

Two Hooko-class crossings matter in the current stack and already appear from this file:

* this meme's own migration into `ha-ka-ba/loci/loci-loci.md`
* the meme law's migration into `ha-ka-ba/meme/loci-meme.md`

In both cases, the stable thing remained the `lar:` address. The mutable thing remained the concrete file siting that needed to cross into law.

### Hooko Subloops

<<~ ahu #hooko-ha >>

#### Hooko / ha

Hooko-ha holds the mutation domain: what Hooko may alter. It may alter file siting, delegated siting metadata, and document openers (`?` removal on canon promotion). It may not alter the `lar:` URI of a stable meme — that would break address stability for all memes that depend on it.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-hooko-ha >> -->
<<~/ahu >>

<<~ ahu #hooko-ka >>

#### Hooko / ka

Hooko-ka governs the update procedure: when migration updates siting evidence, follow `lar:///ha.ka.ba/loci/iam/file_path` and verify the named `lar:` address does not change. When removing the `?` from a document opener for canon promotion, verify all three address-stability conditions hold before making the edit. A future live MCP resolver, if enacted, would form its own separate Hooko-class crossing and does not get performed by this meme today.

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
description = "Aftermath phase for routing gap reporting, rating review, explicit-convention judgment, and MCP-roadmap escalation."
role = "routing evaluation, rating review, and gap judgment"
function = "judge which URIs resolved, which remain declared-unresolved, what rating set current evidence supports, whether explicit convention holds, and whether MCP-roadmap research should advance"
input = "resolution results|forward reference list|transaction trace"
output = "routing-and-rating completeness report|declared-unresolved list|convention verdict|next-observation route"
phase = "aftermath"
glyph = "↺"
```

## Aftermath

Aftermath judges what routing resolved, what ratings appear justified, and what remains open.

### Core Aftermath Kānāwai (law)

Every routing pass should emit one completeness judgment, even when some addresses remain declared-unresolved.

Aftermath should name:

* which URIs resolved via derivation (step 7)
* which URIs remain declared-unresolved after local derivation
* what `mana`, `manao`, and `manaoio` posture currently appears justified
* whether explicit convention still holds
* what would close each declared-unresolved address now
* whether the remaining tension reads as ordinary authoring backlog or MCP-resolution research backlog

### Zooming Out

After one address resolves, loci should widen the frame from one successful walk to the health of the routing field as a whole.

The important upward question does not stop at "did this URI resolve?" but also asks "does the stack still describe itself coherently after recent migrations, and does the remaining gap now read as a research problem?"

### Aftermath Subloops

<<~ ahu #aftermath-ha >>

#### Aftermath / ha

Aftermath-ha holds the residue domain: what remains unresolved after all routing passes. Declared-unresolved addresses form the primary residue of a routing pass. They represent either real authoring pressure or a live-resolution problem that local derivation cannot presently solve.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-aftermath-ha >> -->
<<~/ahu >>

<<~ ahu #aftermath-ka >>

#### Aftermath / ka

Aftermath-ka governs the convention check procedure: compare opener address, declared convention surfaces, and any delegated siting evidence. If they agree, the carrier remains explicit even if local derivation still misses after migration. That miss should then surface as MCP-roadmap pressure, not as disguised corruption.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci-aftermath-ka >> -->
<<~/ahu >>

<<~ ahu #aftermath-ba >>

#### Aftermath / ba

Aftermath-ba governs landing quality: a routing aftermath that reports only "X URIs resolved" without naming the declared-unresolved ones hides the pressure that matters most. The declared-unresolved list does not count as noise — it carries the system's explicit demand for future authorship.

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

* a current `mana`, `manao`, and `manaoio` posture for the queried `lar:` URI meme
* a resolved carrier path for the queried `lar:` URI when local derivation succeeds
* the meme-type prefix table for derivation-algorithm step 5
* the MCP-resolution roadmap note
* the current canon-lifecycle stage for the target address
* a declared-unresolved forward reference when local derivation yields no result
* an explicit-convention verdict
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
residue = "path-directory carriers still exceed local derivation-only resolution; high `manaoio` remains capped until live MCP-backed resolution exists; sub-meme files (loci-observe-ha, loci-orient, etc.) not yet authored"
next_observation = "lar:///ha.ka.ba/loci#mcp-resolution-roadmap"
next_question = "What minimal live MCP server contract would resolve `lar:` URI memes to trustworthy ratings without a handwritten registry?"
```

<<~&#x0004; -> ? >>
