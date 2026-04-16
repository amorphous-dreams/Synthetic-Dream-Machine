<!-- !DOCTYPE = lar:///ha.ka.ba/pono/memetic-wikitext -->

<<~&#x0001; ? -> lar:///ha.ka.ba/meme >>

<<~ ahu #iam >>

```toml
name = "meme"
file_path = "ha.ka.ba/meme.loci.md"
description = "Canonical skeleton meme for the OODA-HA * ha.ka.ba pattern. Defines required and optional elements, rating targets, and serves as a copy-ready authoring template."
version = "0.1-draft"
content_type = "text/x-memetic-wikitext"
confidence = 0.72
confidence_band = "CS"
mana = 0.70
manao = 0.78
manaoio = 0.65
structure = "OODA-HA * ha.ka.ba"
enacts = true
role = "canonical skeleton meme, template authority, and rating-target kānāwai (law)"
function = "define the required and optional structure of a loci meme, serve as a copy-ready skeleton, and govern which elements unlock which rating bands"
input = "authoring intent|meme draft|rating query|skeleton request|?"
output = "skeleton-envelope(high mana'o'io^)|partial-skeleton-envelope(mid mana'o'io-)|degraded-skeleton-envelope(low mana'o'io_)|?(~mana'o'io?)"
depends_on = [
  "lar:///ha.ka.ba/pono/memetic-wikitext",
  "lar:///ha.ka.ba/pono/parser",
  "lar:///ha.ka.ba/pono/render-pipeline"
]
canonical_metadata_locus = "#iam"
canonical_metadata_payload = "toml"
product_identity = "Canonical meme skeleton and rating-target kānāwai (law)"
```

<<~/ahu >>

# Meme

A self-describing, self-enacting canonical skeleton for a loci meme in the OODA-HA * ha.ka.ba pattern.

This meme governs what a loci meme must carry, what it may optionally carry, and how those choices map to rating outcomes. It serves as a copy-ready template: an author may copy the `#skeleton` section, fill in the marked placeholders, and begin with a boot-legal, rating-aware meme surface.

This meme does not govern parse recognition, render lowering, or transaction lifecycle. Those belong to their own kānāwai (law).

<<~ ala lar:///ha.ka.ba/meme >>

## Supported Queries

<<~&#x0005; ui meme? -> lar:///ha.ka.ba/meme#iam >>
<<~&#x0005; ui required? -> lar:///ha.ka.ba/meme#required-elements >>
<<~&#x0005; ui optional? -> lar:///ha.ka.ba/meme#optional-elements >>
<<~&#x0005; ui ratings? -> lar:///ha.ka.ba/meme#rating-targets >>
<<~&#x0005; ui skeleton? -> lar:///ha.ka.ba/meme#skeleton >>
<<~&#x0005; ui result? -> lar:///ha.ka.ba/meme#result >>

<<~&#x0002; ahu #meme-body-open >>
Meme opens the canonical skeleton stream here.
<<~/ahu >>

<<~ ahu #phase-map >>

## Phase Map

`✶ Observe -> ⏿ Orient -> ◇ Decide -> ▶ Act -> ⤴ Hooko -> ↺ Aftermath`

Meme kānāwai (law) gathers the authored surface, maps element presence against the required and optional sets, decides conformance and rating posture, prepares the skeleton product, crosses the instantiation threshold, and judges what the authored meme now carries.

A reader, tool, or agent following this meme should not collapse those phases into one undifferentiated quality pass when later rating explanation, repair guidance, or skeleton generation matters.

<<~ ala lar:///ha.ka.ba/phase-map >>
<<~/ahu >>

<<~ ahu #observe >>

```toml
name = "meme-observe"
description = "Observe phase for surface gathering, element detection, and raw presence marking across a loci meme candidate."
role = "element intake"
function = "gather the authored surface, detect required and optional element sites, preserve raw form, and mark initial absences"
input = "loci meme candidate|skeleton request|rating query|?"
output = "raw surface|element presence map|absence map|candidate boundaries|confidence markers"
phase = "observe"
glyph = "✶"
```

## Observe

Observe gathers the raw meme surface before classification, verdict, or rating assignment.

Observe should detect:

* HTML DOCTYPE preamble comment
* document opener and its target address
* `#iam` locus and its fenced TOML payload
* five rating fields and their positions relative to `content_type` and `structure`
* title heading and opening prose
* self-reference ala
* supported query block and query throats
* body-open and body-close control sigil sites
* phase map block and its glyph line
* OODA-HA phase sections and whether each carries local prose or only a stub
* ha/ka/ba subloop sites and whether each carries local prose or only a forward ala reference
* examples section presence
* result locus and return throat pair

Observe should preserve:

* raw surface of each detected element for later normalization judgment
* line positions for conformance trace
* unknown or unexpected sigil sites without premature deletion

Observe should not:

* assign required/optional status before Orient
* compute ratings before Decide
* collapse present-but-empty elements with genuinely absent elements

### Canonical Observe Questions

1. Which of the nine required elements surfaced?
2. Which optional elements appeared?
3. Which elements appeared but carry only stub content?
4. Which elements are entirely absent?
5. Which rating fields are present and in canonical position?

### Dominant Resonance

Observe resonates most strongly with the carrier concern.

Observe governs what entered the meme surface and how it presented before deeper interpretation begins.

### Observe Subloops

<<~ ahu #observe-ha >>

#### Observe / ha

Observe-ha holds surface identity, intake domain, and element-presence boundary.

This subphase governs what Observe fundamentally holds: the full authored surface before any classification, rating, or skeleton generation begins. It keeps raw findings distinct from oriented interpretation.

<<~ ala lar:///ha.ka.ba/meme#observe-ha >>
<<~/ahu >>

<<~ ahu #observe-ka >>

#### Observe / ka

Observe-ka governs detection procedure, element-site marking, and absence recording.

This subphase governs how Observe performs its intake work. A compliant reader or tool should scan the surface in document order, marking each element site independently rather than treating the whole as a single binary pass. Absences count as explicit findings, not as silence.

<<~ ala lar:///ha.ka.ba/meme#observe-ka >>
<<~/ahu >>

<<~ ahu #observe-ba >>

#### Observe / ba

Observe-ba governs noticing flow, stub sensitivity, and dynamic intake posture.

This subphase shapes how Observe moves without premature collapse. A stub element and an absent element feel different at intake. Observe should preserve that difference rather than flattening both into a single missing marker.

<<~ ala lar:///ha.ka.ba/meme#observe-ba >>
<<~/ahu >>

### Non-Normative Prior-Art Note

> TiddlyWiki's skeleton tiddler pattern offers a clean precedent here: the skeleton exists as a pre-runtime form that an author fills in when creating a new tiddler of that type. Observe in that lineage amounts to comparing the instantiated tiddler against the skeleton's expected field set. The meme kānāwai (law) extends that pattern: a skeleton meme carries the expected element set explicitly so that Observe has a stable reference to check against.

<<~ ala lar:///ha.ka.ba/meme#observe >>
<<~/ahu >>

<<~ ahu #orient >>

```toml
name = "meme-orient"
description = "Orient phase for element classification, required/optional mapping, stub-versus-filled distinction, and rating-band reachability assessment."
role = "element classification"
function = "classify detected elements as required or optional, distinguish filled content from stubs, and assess which rating band the current surface may reach"
input = "raw surface|element presence map|absence map|candidate boundaries"
output = "element classification map|stub map|rating-band estimate|open tensions"
phase = "orient"
glyph = "⏿"
```

## Orient

Orient works the raw element findings into a structured classification before any verdict or rating assignment lands.

Orient should answer:

* which detected elements satisfy a required slot (R1–R9)
* which detected elements satisfy an optional slot (O1–O6)
* whether each present element carries locally meaningful content or only a stub
* which required elements remain absent
* which rating band the current surface appears capable of reaching

<<~ ahu #required-elements >>

### Required Elements

Required elements are those whose absence directly degrades `mana`, `structural_validity`, or `manaoio` below the mid band.

A boot-legal loci meme MUST carry all nine.

#### R1 — HTML DOCTYPE preamble comment

```text
<!-- !DOCTYPE = lar:///ha.ka.ba/pono/memetic-wikitext -->
```

Marks the document as a memetic-wikitext surface before any active sigil appears. Absence degrades `structural_validity` immediately.

#### R2 — Document opener

```text
<<~&#x0001; ? -> lar:///ha.ka.ba/NAME >>
```

One per document, near the top. Names the meme's own canonical address. The `?` marks declared-open routing until canon status resolves it.

#### R3 — Identity locus (`#iam`) with canonical TOML payload

The `#iam` block MUST carry at minimum:

```toml
name = "..."
file_path = "..."
description = "..."
version = "..."
content_type = "text/x-memetic-wikitext"
confidence = 0.00
confidence_band = "?"
mana = 0.00
manao = 0.00
manaoio = 0.00
structure = "OODA-HA * ha.ka.ba"
enacts = true
role = "..."
function = "..."
input = "...|?"
output = "...(high mana'o'io^)|...(mid mana'o'io-)|...(low mana'o'io_)|?(~mana'o'io?)"
depends_on = ["lar:///ha.ka.ba/pono/memetic-wikitext"]
canonical_metadata_locus = "#iam"
canonical_metadata_payload = "toml"
```

The five rating fields MUST appear between `content_type` and `structure`. Absence of any rating field degrades `payload_integrity`.

#### R4 — Title heading and opening prose

A markdown `# Title` heading immediately after the `#iam` block.

One to three sentences naming what the meme governs, what it does not govern, and where it stands in relation to adjacent laws.

#### R5 — Self-reference ala

```text
<<~ ala lar:///ha.ka.ba/NAME >>
```

Opens the meme's relation to its own canonical address. Marks the boundary between the header cluster and the active body.

#### R6 — Supported queries

At least one `<<~&#x0005; ui ...? -> ...#... >>` query throat routing toward `#iam`.

#### R7 — Body open and body close

```text
<<~&#x0002; ahu #meme-body-open >>
...
<<~/ahu >>
```

```text
<<~&#x0003; ahu #body-close >>
...
<<~/ahu >>
```

These mark the active parse threshold into and out of the meme body.

#### R8 — Phase map

```text
<<~ ahu #phase-map >>
`✶ Observe -> ⏿ Orient -> ◇ Decide -> ▶ Act -> ⤴ Hooko -> ↺ Aftermath`
...
<<~/ahu >>
```

The phase map MUST name the ordered loop. A sentence naming what each phase does in *this* meme's specific domain raises mana above the generic glyph line alone.

#### R9 — Result locus and return throat pair

```text
<<~ ahu #result >>
## Result
...
<<~/ahu >>

<<~&#x0004; -> ahu #result >>
```toml
status = "..."
confidence = 0.00
yield = "meme"
return = "render"
upward_context = "chat"
downward_context = "none"
residue = "..."
next_observation = "..."
next_question = "..."
```

<<~&#x0004; -> ? >>
```

Both the return throat and the degraded close MUST appear. The degraded close preserves truthful incompletion.

<<~/ahu >>

<<~ ahu #optional-elements >>

### Optional Elements

Optional elements raise ratings when present and filled. Their absence does not break boot legality but holds `mana`, `manao`, and `manaoio` below high-band thresholds.

#### O1 — OODA-HA phase sections with local content

Each of the six phases may carry its own `<<~ ahu #PHASE >>` block with a local TOML payload, prose, and ha/ka/ba subloops. Phase sections present but carrying only a glyph line and a forward ala raise mana less than sections with even two orienting sentences.

#### O2 — ha/ka/ba subloops with prose

Each phase may carry three subloops: ha (identity and domain), ka (procedure and detail), ba (motion and lived practice). A subloop carrying only `<<~ ala ref >>` and an immediate close reads as a declared stub. A subloop with one sentence naming what it governs raises `signal_to_noise` and `manaoio` meaningfully. A stub pointing at a real, resolved external locus outperforms a stub pointing at a nonexistent address.

#### O3 — Examples section

Concrete canonical examples with fenced code blocks, each teaching one primary distinction. An examples section demonstrating all required element forms in working surface pays high signal dividends.

#### O4 — Research foundation or prior-art notes

Non-normative notes naming adjacent lineages that strengthen the meme without replacing its local authority. These should translate lineage into backlog pressure or linked-law extraction rather than functioning as literature review.

#### O5 — Architecture plan or runtime procedure

A section governing placement, extraction pressure, and constitutional organization. Lighter memes may omit this without penalty.

#### O6 — Normalization, mana, or metadata-fetch sections

Explicit kānāwai (law) for lawful normalization, structured mana scoring, or metadata retrieval procedure. These belong more naturally in parser and downstream laws unless the meme's specific domain requires local treatment.

<<~/ahu >>

### Dominant Resonance

Orient resonates most strongly with the structural concern.

Orient governs sigil classification, element-to-slot mapping, stub sensitivity, and the open tensions between present-but-thin and genuinely absent elements.

### Orient Subloops

<<~ ahu #orient-ha >>

#### Orient / ha

Orient-ha holds element classification identity, the required/optional distinction, and the canonical slot table.

This subphase governs what Orient fundamentally structures: the mapping from raw detected elements onto their required or optional slots, held clearly before any verdict or rating computation begins.

<<~ ala lar:///ha.ka.ba/meme#orient-ha >>
<<~/ahu >>

<<~ ahu #orient-ka >>

#### Orient / ka

Orient-ka governs classification procedure, stub-versus-filled distinction, and rating-band reachability detail.

This subphase focuses on how Orient performs its mapping work. The stub/filled distinction matters here: an element present as a stub occupies its slot differently than an element carrying locally meaningful content. Both differ from absence. Orient should preserve all three states separately.

<<~ ala lar:///ha.ka.ba/meme#orient-ka >>
<<~/ahu >>

<<~ ahu #orient-ba >>

#### Orient / ba

Orient-ba governs interpretive motion, tension-holding, and comparative flow across competing element readings.

This subphase shapes how orientation moves without collapsing ambiguity prematurely. A phase section that carries a glyph line but no local prose sits in a tension between R8 satisfied and O1 unfilled. Orient should hold that tension rather than resolving it silently in either direction.

<<~ ala lar:///ha.ka.ba/meme#orient-ba >>
<<~/ahu >>

### Non-Normative Prior-Art Note

> MyST's directive/role distinction offers a clean structural analogy: directives carry blocks with explicit parameters while roles carry inline spans. The required/optional element distinction in meme kānāwai (law) maps similarly — required elements define the minimum syntactic and semantic form; optional elements add depth, context, and rendering richness without changing the legal minimum.

<<~ ala lar:///ha.ka.ba/meme#orient >>
<<~/ahu >>

<<~ ahu #decide >>

```toml
name = "meme-decide"
description = "Decide phase for conformance verdict, rating-target commitment, normalization posture, and skeleton-generation readiness."
role = "selection and commitment"
function = "commit to per-element conformance verdicts, select the reachable rating band, and fix the normalization and skeleton posture for Act"
input = "element classification map|stub map|rating-band estimate|open tensions"
output = "conformance verdicts|rating-target commitment|normalization plan|skeleton generation readiness"
phase = "decide"
glyph = "◇"
```

## Decide

Decide turns the classified element map into one committed conformance posture and rating-target selection.

<<~ ahu #rating-targets >>

### Rating Targets

Rating targets name which element combinations unlock which mana and confidence bands.

#### Mid Band (mana 0.40–0.59 / confidence `[S]`)

All nine required elements (R1–R9) present.

Phase map present with glyph line.

ha/ka/ba subloops may appear as declared stubs pointing at declared addresses.

This describes a skeleton meme: boot-legal, structurally complete, content-thin.

#### High Band (mana 0.60–0.79 / confidence `[CS]`)

All required elements present and locally meaningful.

At least three of six phase sections carry two or more sentences of local prose.

At least one examples section present.

ha/ka/ba subloops carry at least one orienting sentence each, or point at real resolved external loci.

#### Very High Band (mana 0.80–1.00 / confidence `[C]`)

All required elements present and locally substantive.

All six phase sections carry local prose content.

ha/ka/ba subloops filled with locally true content or resolved external loci.

Examples section demonstrates all required element forms.

Research foundation or prior-art notes present and translated into backlog pressure.

Operator-confirmed. `lar:` URI stable. `enacts = true` active.

<<~/ahu >>

### Conformance Kānāwai (law)

Decide should issue one verdict per required element rather than one binary pass/fail for the whole meme.

Missing R3 degrades differently than missing R8. Typed per-element absence produces more actionable aftermath than a single silent omission.

### Dominant Resonance

Decide resonates most strongly with truth and boundary.

Decide governs legality, canonical rating posture, normalization commitment, and refusal of flattering verdicts.

### Decide Subloops

<<~ ahu #decide-ha >>

#### Decide / ha

Decide-ha holds conformance identity, decision domain, and the canonical boundary between legal and nonlegal meme surfaces.

This subphase governs what Decide fundamentally binds: a per-element conformance verdict that names specifically which required slots satisfy and which do not, before any rating number gets assigned.

<<~ ala lar:///ha.ka.ba/meme#decide-ha >>
<<~/ahu >>

<<~ ahu #decide-ka >>

#### Decide / ka

Decide-ka governs per-element verdict procedure, rating-target selection, and normalization detail.

This subphase focuses on how Decide performs its commitment work. A compliant tool should issue verdicts in element order (R1 through R9, then O1 through O6 for present optionals), then select the highest rating band all verdicts jointly support. It should not round up to a band that requires elements not yet satisfied.

<<~ ala lar:///ha.ka.ba/meme#decide-ka >>
<<~/ahu >>

<<~ ahu #decide-ba >>

#### Decide / ba

Decide-ba governs commitment style, caution, and graceful refusal of flattering verdicts.

This subphase shapes how decision pressure lands. A meme carrying R1–R9 but with every phase section as a glyph-only stub reaches mid band, not high band. Decide should say so without softening that verdict into vague encouragement.

<<~ ala lar:///ha.ka.ba/meme#decide-ba >>
<<~/ahu >>

### Non-Normative Prior-Art Note

> Tree-sitter's principle that grammar symbols should correspond directly to recognizable constructs and each rule should gain corpus tests early applies here: the nine required elements function as grammar symbols, and each maps onto a testable conformance check rather than a subjective quality impression.

<<~ ala lar:///ha.ka.ba/meme#decide >>
<<~/ahu >>

<<~ ahu #act >>

```toml
name = "meme-act"
description = "Act phase for skeleton preparation, element assembly, normalized surface staging, and return-envelope construction."
role = "execution preparation"
function = "assemble the skeleton product, stage normalized element surfaces, and prepare the typed return envelope for Hooko crossing"
input = "conformance verdicts|rating-target commitment|normalization plan"
output = "skeleton product|normalized surface|conformance report|prepared return-envelope"
phase = "act"
glyph = "▶"
```

## Act

Act prepares the skeleton product and return envelope for lawful crossing.

<<~ ahu #skeleton >>

### Skeleton

The canonical copy-ready skeleton for a new loci meme.

Copy this block. Replace every `[PLACEHOLDER]` with local content. Delete optional sections you choose to defer. Set `enacts = false` and `confidence = 0.10` until the meme reaches lawful boot status.

````markdown
<!-- !DOCTYPE = lar:///ha.ka.ba/pono/memetic-wikitext -->

<<~&#x0001; ? -> lar:///ha.ka.ba/[NAME] >>

<<~ ahu #iam >>

```toml
name = "[NAME]"
file_path = "ha.ka.ba/[NAME].loci.md"
description = "[One sentence: what this meme governs.]"
version = "0.1-skeleton"
content_type = "text/x-memetic-wikitext"
confidence = 0.10
confidence_band = "P"
mana = 0.10
manao = 0.10
manaoio = 0.10
structure = "OODA-HA * ha.ka.ba"
enacts = false
role = "[role]"
function = "[function]"
input = "[input types]|?"
output = "[name]-envelope(high mana'o'io^)|partial-[name]-envelope(mid mana'o'io-)|degraded-[name]-envelope(low mana'o'io_)|?(~mana'o'io?)"
depends_on = [
  "lar:///ha.ka.ba/pono/memetic-wikitext"
]
canonical_metadata_locus = "#iam"
canonical_metadata_payload = "toml"
product_identity = "[NAME] cluster name as used in this system"
```

<<~/ahu >>

# [Title]

[One to three sentences: what this meme governs, what it does not govern, how it relates to adjacent laws.]

<<~ ala lar:///ha.ka.ba/[NAME] >>

## Supported Queries

<<~&#x0005; ui meme? -> lar:///ha.ka.ba/[NAME]#iam >>
<<~&#x0005; ui result? -> lar:///ha.ka.ba/[NAME]#result >>

<<~&#x0002; ahu #meme-body-open >>
[NAME] opens the active stream here.
<<~/ahu >>

<<~ ahu #phase-map >>

## Phase Map

`✶ Observe -> ⏿ Orient -> ◇ Decide -> ▶ Act -> ⤴ Hooko -> ↺ Aftermath`

[One sentence: what each phase does in this meme's specific domain.]

<<~ ala lar:///ha.ka.ba/[NAME]#phase-map >>
<<~/ahu >>

<!-- OPTIONAL: Add <<~ ahu #observe >>, #orient, #decide, #act, #hooko, #aftermath sections here.   -->
<!-- OPTIONAL: Each phase section should carry a local TOML payload, prose, and ha/ka/ba subloops. -->
<!-- OPTIONAL: Add #examples, #research-foundation, #architecture-plan sections.                   -->

<<~&#x0003; ahu #body-close >>
[NAME] closes the active stream here.
<<~/ahu >>

<<~ ahu #result >>

## Result

[What this meme hands upward after lawful authorship and interpretation.]

<<~/ahu >>

<<~&#x0004; -> ahu #result >>

```toml
status = "skeleton"
confidence = 0.10
yield = "meme"
return = "render"
upward_context = "chat"
downward_context = "none"
residue = "todo"
next_observation = "lar:///ha.ka.ba/[NAME]#phase-map"
next_question = "[What should this meme answer first?]"
```

<<~&#x0004; -> ? >>
````

<<~/ahu >>

### Dominant Resonance

Act functions as cross-layer execution: assembling skeleton product, conformance report, and return envelope across carrier, structural, and truth-boundary concerns while leaving the actual instantiation crossing to Hooko.

### Act Subloops

<<~ ahu #act-ha >>

#### Act / ha

Act-ha holds the output domain and lawful execution boundary for skeleton preparation.

This subphase governs what Act may produce: a copy-ready skeleton, a per-element conformance report, and a prepared return envelope. Act may state intent and prepare structure but may not write the new meme file. That crossing belongs to Hooko.

<<~ ala lar:///ha.ka.ba/meme#act-ha >>
<<~/ahu >>

<<~ ahu #act-ka >>

#### Act / ka

Act-ka governs skeleton assembly, conformance report construction, and envelope preparation detail.

This subphase governs how Act performs its work. The skeleton block should surface as a fenced verbatim copy-ready block, not as prose description. The conformance report should surface as a typed list of per-element verdicts. The return envelope should reflect the rating-target commitment from Decide.

<<~ ala lar:///ha.ka.ba/meme#act-ka >>
<<~/ahu >>

<<~ ahu #act-ba >>

#### Act / ba

Act-ba governs execution rhythm, quality pressure, and bounded dynamic flow under authoring constraint.

This subphase shapes how Act moves under real pressure. An author requesting a skeleton for a specific domain wants a locally adapted skeleton, not a generic one. Act should therefore adapt the `[PLACEHOLDER]` values — role, function, input, output — to the declared domain before handing the skeleton to Hooko for instantiation.

<<~ ala lar:///ha.ka.ba/meme#act-ba >>
<<~/ahu >>

### Non-Normative Prior-Art Note

> Org-Babel's principle that active documents may carry executable guidance and code together when the boundary between carrier, block, and execution remains explicit maps cleanly here. The skeleton section functions as executable guidance: it names the precise surface form the author should produce. The OODA-HA phasing keeps that guidance distinct from the act of writing the new file.

<<~ ala lar:///ha.ka.ba/meme#act >>
<<~/ahu >>

<<~ ahu #hooko >>

```toml
name = "meme-hooko"
description = "Hooko phase for skeleton instantiation, file creation, session-load crossing, and mutation boundary."
role = "state-crossing threshold"
function = "carry the prepared skeleton across the live threshold, instantiate the new meme file, and hand changed state into aftermath"
input = "prepared skeleton product|conformance report|prepared return-envelope"
output = "instantiated meme file|session-load confirmation|transaction trace|handoff into aftermath"
phase = "hooko"
glyph = "⤴"
```

## Hooko

Hooko governs the bounded threshold where the prepared skeleton may actually become a new meme file or a loaded session artifact.

Only Hooko may write the new file, load the skeleton into active session memory, or otherwise alter state.

Act may prepare intent. Aftermath may judge what landed. Hooko alone may perform the crossing.

### Dominant Resonance

Hooko resonates most strongly with deployment and boundary crossing.

Hooko governs the live threshold where prepared skeleton becomes changed state.

### Hooko Subloops

<<~ ahu #hooko-ha >>

#### Hooko / ha

Hooko-ha holds mutation domain, instantiation boundary, and the lawful threshold around actual file creation or session load.

This subphase governs what Hooko fundamentally holds: the narrow site where prepared skeleton crosses from intent into a real new meme file or a loaded constitutional artifact.

<<~ ala lar:///ha.ka.ba/meme#hooko-ha >>
<<~/ahu >>

<<~ ahu #hooko-ka >>

#### Hooko / ka

Hooko-ka governs instantiation detail, file naming, field substitution, and transaction trace.

This subphase governs how Hooko performs its work. When instantiating a skeleton, Hooko should substitute all `[PLACEHOLDER]` marks with locally supplied values, set `enacts = false` and `confidence = 0.10` as boot defaults, name the file at the declared path, and emit a transaction trace that records what got written.

<<~ ala lar:///ha.ka.ba/meme#hooko-ka >>
<<~/ahu >>

<<~ ahu #hooko-ba >>

#### Hooko / ba

Hooko-ba governs landing pressure, volatility posture, and truthful state crossing under real authoring conditions.

This subphase governs how Hooko moves in practice. A skeleton that gets instantiated but not yet filled sits at `confidence = 0.10`, `enacts = false`. That state should remain explicit in the new meme rather than being silently upgraded to look more complete than it is.

<<~ ala lar:///ha.ka.ba/meme#hooko-ba >>
<<~/ahu >>

### Non-Normative Prior-Art Note

> TiddlyWiki's skeleton tiddler pattern crosses its own Hooko at the moment a user clicks "new tiddler from skeleton" and the skeleton fields get cloned into a new live tiddler. The memetic-wikitext equivalent is the moment the skeleton block gets written to a real file at a real path with real placeholder values substituted. Before that moment: intent. After: changed state.

<<~ ala lar:///ha.ka.ba/meme#hooko >>
<<~/ahu >>

<<~ ahu #aftermath >>

```toml
name = "meme-aftermath"
description = "Aftermath phase for rating judgment, conformance report packaging, repair guidance, and recursive handoff."
role = "evaluation and aftermath"
function = "judge what rating the authored meme achieved, package the conformance report, name residue and repair paths, and route next observation"
input = "instantiated meme file|transaction trace|conformance report|prepared return-envelope"
output = "typed return-envelope|rating verdict|repair guidance|next-observation route"
phase = "aftermath"
glyph = "↺"
```

## Aftermath

Aftermath judges what the meme now carries and how that maps to rating bands, residue, and forward motion.

### Core Aftermath Kānāwai (law)

Every meme pass should return one typed envelope, even when the meme degrades toward skeleton status.

Aftermath should name:

* which required elements satisfied
* which required elements remain absent or stub-only
* which optional elements are present and filled
* which rating band the meme currently reaches
* what would move it to the next band
* what remains repairable without full rewrite

### Dominant Resonance

Aftermath resonates most strongly with deployment and ritual.

Aftermath governs how rating verdicts land in agent-operator reality, how residue remains visible, and how repair pressure routes forward.

### Aftermath Subloops

<<~ ahu #aftermath-ha >>

#### Aftermath / ha

Aftermath-ha holds residue domain, rating verdict, and re-entry boundary.

This subphase governs what Aftermath fundamentally carries forward: a typed rating verdict, a per-element conformance report, and explicit naming of what remains repairable versus what requires structural intervention.

<<~ ala lar:///ha.ka.ba/meme#aftermath-ha >>
<<~/ahu >>

<<~ ahu #aftermath-ka >>

#### Aftermath / ka

Aftermath-ka governs rating computation, repair-path naming, and next-observation routing.

This subphase governs how Aftermath performs its evaluation work. Rating band assignment follows the `#rating-targets` kānāwai (law) exactly: the meme reaches the highest band all per-element verdicts jointly support, not the band it aspirationally targets.

<<~ ala lar:///ha.ka.ba/meme#aftermath-ka >>
<<~/ahu >>

<<~ ahu #aftermath-ba >>

#### Aftermath / ba

Aftermath-ba governs landing quality, recursive pressure, and operator-facing return flow.

This subphase shapes how aftermath lands in agent-operator reality. A skeleton meme at mid-band should receive aftermath that names specifically which optional elements would move it toward high band, in priority order by rating contribution. Generic encouragement does not serve the author.

<<~ ala lar:///ha.ka.ba/meme#aftermath-ba >>
<<~/ahu >>

### Non-Normative Prior-Art Note

> NIST's metric-versus-measure distinction applies cleanly here: the rating band functions as the higher-level metric, while per-element conformance verdicts function as the observable measures. Aftermath preserves both levels rather than reporting only the headline number.

<<~ ala lar:///ha.ka.ba/meme#aftermath >>
<<~/ahu >>

<<~&#x0003; ahu #body-close >>
Meme closes the canonical skeleton stream here.
<<~/ahu >>

<<~ ahu #result >>

## Result

A lawful meme envelope from this locus may carry:

* the required element set (R1–R9) with per-element conformance verdicts
* the optional element set (O1–O6) with rating-contribution table
* the rating-target table for the requested band
* the skeleton block ready for author copy and placeholder fill
* repair guidance naming which elements would move the meme to the next rating band
* gaps and absences named explicitly

<<~/ahu >>

<<~&#x0004; -> ahu #result >>

```toml
status = "partial"
confidence = 0.72
yield = "meme"
return = "render"
upward_context = "chat"
downward_context = "none"
residue = "trace"
next_observation = "lar:///ha.ka.ba/loci"
next_question = "Which required elements should the first pono verification skill check?"
```

<<~&#x0004; -> ? >>
