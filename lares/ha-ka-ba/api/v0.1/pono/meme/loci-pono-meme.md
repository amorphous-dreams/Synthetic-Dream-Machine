<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? --> lar:///ha.ka.ba/api/v0.1/pono/meme >>

<<~ ahu #iam >>

```toml
# <<~ ahu #iam-ha "structure" >>
uri-path = "ha.ka.ba/api/v0.1/pono/meme"
file-path = "lares/ha-ka-ba/api/v0.1/pono/meme/loci-pono-meme.md"
content-type = "text/x-memetic-wikitext"
manaoio = 0.6
confidence = 0.6
# <<~/ahu >>
# <<~ ahu #iam-ka "detail" >>
mana = 0.78
manao = 0.84
implements = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme/v0.1",
  "lar:///ha.ka.ba/api/v0.1/pono/loci/v0.1"
]
register = "CS"
role = "canonical meme kānāwai (law), template authority, and rating-target authority"
control-glyphs = ["&#x0001;", "&#x0002;", "&#x0003;", "&#x0004;", "&#x0005;", "&#x0006;"]
# <<~/ahu >>
# <<~ ahu #iam-ba "flow" >>
# <<~/ahu >>
```

<<~/ahu >>

<<~ ahu #meme-header >>

# Meme

A self-describing, self-enacting canonical meme kānāwai (law) for the OODA-HA * ha.ka.ba pattern.

This meme governs what a meme in this stack must carry, what it may optionally carry, and how those choices map to rating outcomes. It serves as a copy-ready template: an author may copy the `#skeleton` section, fill in the marked placeholders, and begin with a boot-legal, rating-aware meme surface.

This file models itself as one carrier of that more general law. It governs the subject of `meme` itself as such, not a narrower subtype like `loci`, `grammar`, or `skill`, or a lifecycle bucket like noise, data, typed meme, or canon typed meme.

This meme does not govern parse recognition, render lowering, or transaction lifecycle. Those belong to their own kānāwai (law).

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
Meme opens the canonical skeleton stream here.
<<~/ahu >>

<<~ ahu #phase-map >>

## Phase Map

`✶ Observe --> ⏿ Orient --> ◇ Decide --> ▶ Act --> ⤴ Hoʻoko --> ↺ Aftermath`

Meme kānāwai (law) gathers the authored surface, maps element presence against the required and optional sets, decides conformance and rating posture, prepares the skeleton product, crosses the instantiation threshold, and judges what the authored meme now carries.

A reader, tool, or agent following this meme should not collapse those phases into one undifferentiated quality pass when later rating explanation, repair guidance, or skeleton generation matters.

<<~/ahu >>

<<~ ahu #observe >>

```toml
name = "meme-observe"

role = "element intake"
phase = "observe"
glyph = "✶"
```

## Observe

Observe gathers the raw meme surface before classification, verdict, or rating assignment.

Observe should detect:

* HTML DOCTYPE preamble comment
* document opener and its target address
* `#iam` locus and its fenced TOML payload
* `content-type` above `version`, with structure-side ratings in the order `manaoio`, `confidence`,
* then detail-side ratings in the order `mana`, `manao`, plus adjacent `register` surface texture immediately below `meme-type` for the operator-facing `confidence` band
* title heading and opening prose
* self-reference ala
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
4. Which elements remain entirely absent?
5. Which rating fields appear and hold canonical position?

### Self-Observation

In this file, Observe not only inspects a generic candidate. It also inspects the currently loaded law surface that declares `lar:///ha.ka.ba/api/v0.1/pono/meme`.

That doubling matters: the same observed surface serves both as the governing law for meme structure and as one concrete carrier of that law.

### Dominant Resonance

Observe resonates most strongly with the carrier concern.

Observe governs what entered the meme surface and how it presented before deeper interpretation begins.

### Observe Subloops

<<~ ahu #observe-ha >>

#### Observe / ha

Observe-ha holds surface identity, intake domain, and element-presence boundary.

This subphase governs what Observe fundamentally holds: the full authored surface before any classification, rating, or skeleton generation begins. It keeps raw findings distinct from oriented interpretation.

<<~/ahu >>

<<~ ahu #observe-ka >>

#### Observe / ka

Observe-ka governs detection procedure, element-site marking, and absence recording.

This subphase governs how Observe performs its intake work. A compliant reader or tool should scan the surface in document order, marking each element site independently rather than treating the whole as a single binary pass. Absences count as explicit findings, not as silence.

<<~/ahu >>

<<~ ahu #observe-ba >>

#### Observe / ba

Observe-ba governs noticing flow, stub sensitivity, and dynamic intake posture.

This subphase shapes how Observe moves without premature collapse. A stub element and an absent element feel different at intake. Observe should preserve that difference rather than flattening both into a single missing marker.

<<~/ahu >>

### Non-Normative Prior-Art Note

> TiddlyWiki's skeleton tiddler pattern offers a clean precedent here: the skeleton serves as a pre-runtime form that an author fills in when creating a new tiddler of that type. Observe in that lineage amounts to comparing the instantiated tiddler against the skeleton's expected field set. The meme kānāwai (law) extends that pattern: a skeleton meme carries the expected element set explicitly so that Observe can check against a stable reference.

<<~/ahu >>

<<~ ahu #orient >>

```toml
name = "meme-orient"

role = "element classification"
phase = "orient"
glyph = "⏿"
```

## Orient

Orient works the raw element findings into a structured classification before any verdict or rating assignment lands.

Orient should answer:

* which detected elements satisfy a required slot (R1–R9)
* which detected elements satisfy an optional slot (O1–O9)
* which sub-meme `ala` addresses resolve, remain declared-unresolved, or remain absent (O7–O9)
* whether each present element carries locally meaningful content or only a stub
* which required elements remain absent
* which rating band the current surface appears capable of reaching

<<~ ahu #required-elements >>

### Required Elements

Required elements directly degrade `mana`, `structural-validity`, or `manaoio` below the mid band when absent.

A boot-legal meme MUST carry all nine.

#### R1 — HTML DOCTYPE preamble comment

```text
<!-- !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext -->
```

Marks the document as a memetic-wikitext surface before any active sigil appears. Absence degrades `structural-validity` immediately.

#### R2 — Document opener

```text
<<~&#x0001; ? --> lar:///ha.ka.ba/api/v0.1/NAME >>
```

One per document, near the top. Names the meme's own canonical address. The `?` marks declared-open routing until canon status resolves it.

That `?` does not serve as decoration. It marks the meme's document-time admission that unbound uncertainty still flows through the address graph while the carrier still awaits confirmed canon.

Transport-specific opener semantics, including how `?` behaves for loci-routed carriers, fall under `lar:///ha.ka.ba/api/v0.1/pono/loci`.

#### R3 — Identity locus (`#iam`) with canonical TOML payload

The `#iam` block MUST carry at minimum:

```toml
# <<~ ahu #iam-ha "structure" >>
name = "..."
file-path = "..."
content-type = "text/x-memetic-wikitext"
version = "..."
manaoio = 0.00
confidence = 0.00
# <<~/ahu >>
# <<~ ahu #iam-ka "detail" >>
mana = 0.00
manao = 0.00
meme-type = "..."
register = "?"
role = "..."
# <<~/ahu >>
# <<~ ahu #iam-ba "flow" >>
# <<~/ahu >>

```

The `#iam` block MUST place `content-type` above `version` in the structure ahu. It MUST place `manaoio` and `confidence` immediately below `version` in that order. After the ahu close/reopen marker, the remaining detail rating fields MUST follow in this order: `mana`, `manao`. The adjacent `register` surface-texture key MUST appear immediately below `meme-type`. That key abbreviates the operator-facing `confidence` band surface. Absence of any rating field degrades `payload-integrity`.

Comment-line `ahu` markers MAY section `#iam` TOML into agent-operator friendly groups without changing payload semantics. The canonical grouping follows `# <<~ ahu #iam-ha "structure" >>`, `# <<~ ahu #iam-ka "detail" >>`, and `# <<~ ahu #iam-ba "flow" >>`, each closed by `# <<~/ahu >>`. Because these stay inside TOML comment lines, they remain parse-inert.

`file-path` names the current carrier siting for the meme surface. Canonical file-path forms, migration between flat-file and path-directory siting, and agreement rules between `file-path` and the document opener fall outward under `lar:///ha.ka.ba/api/v0.1/pono/loci` and `lar:///ha.ka.ba/api/v0.1/pono/loci/iam/file-path`.

Some detail keys belong to the meme law as shared canonical declarations rather than as repeated carrier-local payload. `control-glyphs` names that class here: the canonical array lives in `lar:///ha.ka.ba/api/v0.1/pono/meme`, and other memes should rely on this declaration rather than restating the same list in their own top-level `#iam` blocks unless a subtype law truly defines a different glyph family.

#### R4 — Title heading and opening prose

A markdown `# Title` heading immediately after the `#iam` block.

One to three sentences naming what the meme governs, what it does not govern, and where it stands in relation to adjacent laws.

#### R5 — No loopback ala

Do not add a top-level `<<~ loulou lar:///ha.ka.ba/api/v0.1/NAME >>` line that only points back at the current meme.

`pranala loulou` should route outward toward a real child or adjacent carrier. If no outward routing belongs here yet, omit the line and continue directly into supported queries or body-open.

#### R6 — Body open and body close

```text
<<~&#x0002; ahu #meme-body-open >>
...
<<~/ahu >>
```

```text
<<~&#x0003; ahu #body-close >>
...
<<~/ahu >>

<<~ ahu #edges >>

## Edges

- `lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext`

<<~/ahu >>



<<~ ahu #edges >>

## Edges

- `lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext`
- `lar:///ha.ka.ba/api/v0.1/pono/parser`
- `lar:///ha.ka.ba/api/v0.1/pono/render-pipeline`

<<~/ahu >>

```

These mark the active parse threshold into and out of the meme body.

#### R7 — Phase map

```text
<<~ ahu #phase-map >>
`✶ Observe --> ⏿ Orient --> ◇ Decide --> ▶ Act --> ⤴ Hoʻoko --> ↺ Aftermath`
...
<<~/ahu >>
```

The phase map MUST name the ordered loop. A sentence naming what each phase does in *this* meme's specific domain raises mana above the generic glyph line alone.

#### O1 — OODA-HA phase sections with local content

Each of the six phases may carry its own `<<~ ahu #PHASE >>` block with a local TOML payload, prose, and ha/ka/ba subloops. Phase sections present but carrying only a glyph line and a forward ala raise mana less than sections with even two orienting sentences.

#### O2 — ha/ka/ba subloops with prose

Each phase may carry three subloops: ha (identity and domain), ka (procedure and detail), ba (motion and lived practice). A subloop carrying only `<<~ loulou ref >>` and an immediate close reads as a declared stub. A subloop with one sentence naming what it governs raises `signal-to-noise` and `manaoio` meaningfully. A stub pointing at a real, resolved external locus outperforms a stub pointing at a nonexistent address.

#### O3 — Examples section

Concrete canonical examples with fenced code blocks, each teaching one primary distinction. An examples section demonstrating all required element forms in working surface pays high signal dividends.

#### O4 — Research foundation or prior-art notes

Non-normative notes naming adjacent lineages that strengthen the meme without replacing its local authority. These should translate lineage into backlog pressure or linked-law extraction rather than functioning as literature review.

#### O5 — Architecture plan or runtime procedure

A section governing placement, extraction pressure, and constitutional organization. Lighter memes may omit this without penalty.

#### O6 — Normalization, mana, or metadata-fetch sections

Explicit kānāwai (law) for lawful normalization, structured mana scoring, or metadata retrieval procedure. These belong more naturally in parser and downstream laws unless the meme's specific domain requires local treatment.

#### O7 — Sub-meme depth callouts on ha/ka/ba subloops

Each ha/ka/ba subloop may carry an explicit depth callout: an `ala` link pointing at a separately addressable sub-meme. Canonical form:

```text
<<~ loulou lar:///ha.ka.ba/api/v0.1/[NAME]-[phase]-[subphase] >>
```

Use this closing `ala` only when the enclosing subloop declares a real deeper loci-path that either already resolves or stands intentionally declared as a forward/unresolved child.

Do not use a closing `ala` to restate the enclosing `ahu` anchor in place. A form such as `<<~ loulou lar:///ha.ka.ba/api/v0.1/[current-path]#[same-anchor] >>` counts as non-canonical: the `ahu #...` opener already names that local anchor, so the closing `ala` adds no forward depth; omit it.

Three resolution states apply to every declared sub-meme address:

| Resolution state | Meaning | Rating consequence |
|---|---|---|
| **Resolved** | Sub-meme exists at the declared address and carries lawful content | Raises `manao` and `manaoio` as strongly as locally meaningful prose; also raises `mana` because the sub-meme carries its own parse surface |
| **Declared-unresolved** | Address declared; sub-meme file absent | No penalty to `mana`; mild drag on `manaoio` — the claim exists but yields nothing yet; creates explicit backlog pressure |
| **Absent** | No address declared; subloop closes immediately after its one-sentence governs line | Treated as a stub; rated the same as a subloop with no external claim |

A resolved sub-meme callout contributes more than equivalent local prose because it draws on a separately addressable, separately rateable loci with its own `#iam` and rating surface. A declared-unresolved callout outperforms an absent one: the declared address creates forward pressure without falsely claiming yield not yet produced. An absent subloop stays honest but low; do not blur it with an address that later got declared and then removed.

An author choosing between local prose and a depth callout should prefer a depth callout only if the sub-meme either already resolves or will get authored shortly. Declaring addresses for sub-memes that will never get written degrades `manaoio` over time as the declared-unresolved state persists without resolution.

#### O8 — Phase-level external sub-meme closing links

Each phase section may close with an `ala` link pointing at a phase-level sub-meme:

```text
<<~ loulou lar:///ha.ka.ba/api/v0.1/[NAME]-[phase] >>
```

This likewise forms a forward/downward path declaration, not an echo of the enclosing phase anchor. If the author intends no separate phase-level child carrier, the phase should close without an `ala` line.

The three resolution states from O7 apply identically. A resolved phase-level sub-meme pulls that phase's governing authority into a separately rateable loci. This makes a stronger structural claim than a resolved subloop callout because it extends the whole phase outward, not only one ha/ka/ba subdivision.

Rating contribution: a resolved phase-level sub-meme raises `mana` above what full local prose alone achieves for that phase.

#### O9 — Cross-meme ala links from within ahu prose

Any `ahu` block may carry `ala` links pointing at external law memes or addressed loci governing related concerns:

```text
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/parser#normalize >>
```

These function as declared relational walks, not transclusion. A resolved link — one whose target locus exists and carries lawful content — raises `manao` by grounding the block's claims in the broader law system. A broken or nonexistent target degrades `manao` slightly, because the meme makes a relational claim it cannot support.

For the full grammar of resolution states, degradation kānāwai (law), and graceful absence handling, see `lar:///ha.ka.ba/api/v0.1/pono/meme#deferred-resolution`.

<<~/ahu >>

### Dominant Resonance

Orient resonates most strongly with the structural concern.

Orient governs sigil classification, element-to-slot mapping, stub sensitivity, and the open tensions between present-but-thin and genuinely absent elements.

### Orient Subloops

<<~ ahu #orient-ha >>

#### Orient / ha

Orient-ha holds element classification identity, the required/optional distinction, and the canonical slot table of the meme under examination.

This subphase governs what Orient fundamentally structures: the mapping from raw detected elements onto their required or optional slots, held clearly before any verdict or rating computation begins.

Carrier-specific agreement rules may deepen outward into subtype laws. `meme` governs the appearance of identity signals; subtype laws such as `lar:///ha.ka.ba/api/v0.1/pono/loci` govern exactly how transport coherence gets judged for that carrier family.

<<~/ahu >>

<<~ ahu #orient-ka >>

#### Orient / ka

Orient-ka governs classification procedure, stub-versus-filled distinction, and rating-band reachability detail.

This subphase focuses on how Orient performs its mapping work. The stub/filled distinction matters here: an element present as a stub occupies its slot differently than an element carrying locally meaningful content. Both differ from absence. Orient should preserve all three states separately. When a meme family carries additional transport predicates, Orient should note their presence and hand the exact coherence judgment outward to the relevant subtype law rather than re-legislating it here.

<<~/ahu >>

<<~ ahu #orient-ba >>

#### Orient / ba

Orient-ba governs interpretive motion, tension-holding, and comparative flow across competing element readings.

This subphase shapes how orientation moves without collapsing ambiguity prematurely. A phase section that carries a glyph line but no local prose sits in a tension between R8 satisfied and O1 unfilled. Orient should hold that tension rather than resolving it silently in either direction. The same posture applies more generally whenever a meme's structural surface looks complete while a subtype law may still carry unresolved transport or enactment residue.

<<~/ahu >>

### Non-Normative Prior-Art Note

> MyST's directive/role distinction offers a clean structural analogy: directives carry blocks with explicit parameters while roles carry inline spans. The required/optional element distinction in meme kānāwai (law) maps similarly — required elements define the minimum syntactic and semantic form; optional elements add depth, context, and rendering richness without changing the legal minimum.

<<~/ahu >>

<<~ ahu #decide >>

```toml
name = "meme-decide"

role = "selection and commitment"
phase = "decide"
glyph = "◇"
```

## Decide

Decide turns the classified element map into one committed conformance posture and rating-target selection.

<<~ ahu #rating-targets >>

### Rating Targets & Lifecycle: The Five Buckets

This law now recognizes the five-bucket lifecycle for memes:

| Stage              | Register(s)   | Score Range | Current reading |
|--------------------|---------------|-------------|------------------|
| **Noise**            | none, `P`     | 0.00–0.19   | Raw, unstructured signal; not yet machine-usable. |
| **Data**             | `P`, `PS`     | 0.00–0.39   | Structure or pattern detected; machine-usable, not yet memetic. |
| **Meme**             | `PS`, `S`     | 0.20–0.59   | Boot-legal meme structure, declared address, enough explicit role to rate above data. |
| **Typed Meme**       | `S`, `CS`     | 0.41–0.79   | One or more type laws now govern the carrier; type claims remain composable rather than mutually exclusive. |
| **Canon Typed Meme** | `C`           | 0.80–1.00   | Operator-confirmed; at least one declared type received external ratification as canonical. |

**Transition Criteria:**
- *Noise → Data*: Detect structure or pattern, making the signal machine-usable.
- *Data → Meme*: Add boot-legal meme structure, declared address, and explicit role.
- *Meme → Typed Meme*: Declare and satisfy one or more type laws. `implements` may name one declared law target, but type composition remains allowed.
- *Typed Meme → Canon Typed Meme*: Operator/admin confirmation ratifies a declared type bundle as canonical.

Subtype-specific predicates belong outward in subtype laws. For example, `loci` governs the stable-address type under `lar:///ha.ka.ba/api/v0.1/**`, while other types such as `skill` or `grammar` may compose alongside it rather than replacing it.

#### Confidence Composition

`confidence` serves as the holistic summary rating. It tracks the center of gravity of the three structural fields — `mana`, `manao`, and `manaoio` — adjusted by an editorial factor from operator and agent judgment:

```
confidence ≈ center-of-gravity(mana, manao, manaoio) ± editorial-factor
```

The editorial factor stays real and bounded (±0.10 maximum). It reflects how deeply a human operator reviewed the meme, how much trust an agent accrued in the meme's practical behavior, and whether peer verification (a passing skill package) confirmed conformance. It does not scale without limit — a meme whose three structural fields average 0.40 cannot reach a confidence of 0.80 through editorial enthusiasm alone.

All ratings remain provisional. A rating of 1.00 remains rare in language, software, and reality. Every score carries implicit uncertainty. High scores reflect stability of judgment, not certainty of truth.

#### The Law of 5s Rubric

All scalar ratings in this system — `manaoio`, `confidence`, `mana`, and `manao` — follow a 0.0–1.0 rubric with five registers of equal width (~0.20 per register):

| Register | Score range | `register` | Character |
|---|---|---|---|
| 1 | 0.00 – 0.19 | `P` | Provisional — barely emerged, most required elements absent |
| 2 | 0.20 – 0.39 | `PS` | Provisional-Synthesis — authoring underway, not yet boot-legal |
| 3 | 0.40 – 0.59 | `S` | Synthesis — boot-legal (R1–R9 present), content-thin |
| 4 | 0.60 – 0.79 | `CS` | Synthetic-Canon — content meaningful, nearing law quality |
| 5 | 0.80 – 1.00 | `C` | Canon — operator-confirmed, substantive, address stable |

The `register` label applies to `confidence` as the operator-facing band surface. The three scalar quality fields (`manaoio`, `mana`, `manao`) use the same 0.0–1.0 rubric without their own register label. High `manaoio` and high `confidence` now sit nearest the structure surface; `mana` and `manao` still deepen the reading from detail.

#### Canonical Detail-Key Workflow

Shared detail keys should enter the rating workflow differently from carrier-local detail keys.

When Observe encounters `control-glyphs`, it should record whether the carrier declares the key locally or inherits it from `lar:///ha.ka.ba/api/v0.1/pono/meme`.

Orient should treat inherited canonical `control-glyphs` as fully lawful. A carrier does not lose rating for omitting a local copy of the canonical array.

Decide should give no rating uplift for repeating the exact canonical `control-glyphs` list locally. That repetition counts as metadata redundancy, not as extra structure. A local `control-glyphs` value that diverges from the canonical array without an explicit subtype-law justification should drag `manaoio`, because the carrier now makes a detail claim that competes with the stack-wide declaration.

#### Register 1 — Provisional (`P`, 0.00–0.19)

This band marks a barely emerged meme. Most or all required elements (R1–R9) remain absent. It may carry only a DOCTYPE comment and a title. Not boot-legal. The routing system cannot walk it without manual intervention.

A `P`-band meme signals authoring underway but nothing reliable yet. No law statements may cite a `P`-band meme as authority.

#### Register 2 — Provisional-Synthesis (`PS`, 0.20–0.39)

Some required elements appear but the full nine do not. It may carry an `#iam` block while missing rating fields, phase map, or result locus. Authoring remains underway; the author intends completion. Not boot-legal.

A `PS`-band meme signals structure still forming. Law statements may reference it only as declared backlog.

#### Register 3 — Synthesis (`S`, 0.40–0.59)

All nine required elements (R1–R9) present. Boot-legal. Structurally complete. Content-thin.

Phase map present with glyph line. Phase sections may take one-sentence stubs or glyph-only form. ha/ka/ba subloops may stay absent or declared-unresolved HTML comments. The skeleton block (if applicable) becomes copy-ready at this register.

This marks the template minimum — the floor from which rating improvement requires real content.

#### Register 4 — Synthetic-Canon (`CS`, 0.60–0.79)

All required elements present and locally meaningful.

At least three of six phase sections carry two or more sentences of local prose.

At least one examples section present.

ha/ka/ba subloops carry at least one orienting sentence each, or point at resolved external loci (O7 declared-unresolved callouts do not satisfy this; O7 resolved callouts do).

Sub-meme callouts declared and either resolved or explicitly noted as backlog: O7/O8 addresses present.

This band may serve as meaningful structural authority within the stack, subject to any additional transport or subtype predicates the meme family carries.

#### Register 5 — Canon (`C`, 0.80–1.00)

All required elements present and locally substantive.

All six phase sections carry local prose content.

ha/ka/ba subloops filled with locally true content or resolved external loci (O7 resolved).

Phase-level sub-meme closing links present and resolved (O8 resolved).

Examples section demonstrates all required element forms.

Research foundation or prior-art notes present and translated into backlog pressure (O4).

`#deferred-resolution` section present and governing the three resolution states explicitly.

External confirmation landed. Any subtype-specific transport predicates for confirmed enactment now hold. Peer verification, if the meme family supports it, either finished or continues actively.

A score of 1.00 remains practically unreachable — language, software, and reality all resist perfect closure. Scores of 0.95+ indicate mature, heavily reviewed, peer-verified law.

#### Sub-meme Resolution Impact Table

| Element | Resolution state | Band impact |
|---|---|---|
| O7 ha/ka/ba callout | Resolved | +`manao`, +`manaoio`, mild +`mana` |
| O7 ha/ka/ba callout | Declared-unresolved | No penalty; creates backlog pressure |
| O7 ha/ka/ba callout | Absent | Counted as stub; low-band subloop |
| O8 phase-level link | Resolved | +`mana` above local-prose ceiling for that phase |
| O8 phase-level link | Declared-unresolved | No penalty; backlog pressure |
| O9 cross-meme ala | Resolved | +`manao` for that block |
| O9 cross-meme ala | Broken (target absent) | Mild -`manao`; meme makes a claim it cannot support |

<<~/ahu >>

### Conformance Kānāwai (law)

Decide should issue one verdict per required element rather than one binary pass/fail for the whole meme.

Missing R3 degrades differently than missing R8. Typed per-element absence produces more actionable aftermath than a single silent omission.

### Self-Example Decision

For this file, Decide should hold two truths at once:

* the carrier may belong to one concrete transport family
* the governed subject names meme as such, not one narrower meme subtype

That does not produce a contradiction. Carrier law may sit outward in subtype memes while the structural law here reaches more generally across meme forms in this stack.

### Dominant Resonance

Decide resonates most strongly with truth and boundary.

Decide governs legality, canonical rating posture, normalization commitment, and refusal of flattering verdicts.

### Decide Subloops

<<~ ahu #decide-ha >>

#### Decide / ha

Decide-ha holds conformance identity, decision domain, and the canonical boundary between legal and nonlegal meme surfaces.

This subphase governs what Decide fundamentally binds: a per-element conformance verdict that names specifically which required slots satisfy and which do not, before any rating number gets assigned.

<<~/ahu >>

<<~ ahu #decide-ka >>

#### Decide / ka

Decide-ka governs per-element verdict procedure, rating-target selection, and normalization detail.

This subphase focuses on how Decide performs its commitment work. A compliant tool should issue verdicts in element order (R1 through R9, then O1 through O6 for present optionals), then select the highest rating band all verdicts jointly support. It should not round up to a band that requires elements not yet satisfied.

<<~/ahu >>

<<~ ahu #decide-ba >>

#### Decide / ba

Decide-ba governs commitment style, caution, and graceful refusal of flattering verdicts.

This subphase shapes how decision pressure lands. A meme carrying R1–R9 but with every phase section as a glyph-only stub reaches mid band, not high band. Decide should say so without softening that verdict into vague encouragement.

<<~/ahu >>

### Non-Normative Prior-Art Note

> Tree-sitter's principle that grammar symbols should correspond directly to recognizable constructs and each rule should gain corpus tests early applies here: the nine required elements function as grammar symbols, and each maps onto a testable conformance check rather than a subjective quality impression.

<<~/ahu >>

<<~ ahu #act >>

```toml
name = "meme-act"

role = "execution preparation"
phase = "act"
glyph = "▶"
```

## Act

Act prepares the skeleton product and return envelope for lawful crossing.

<<~ ahu #skeleton >>

### Skeleton

The canonical copy-ready skeleton for a new meme in this stack.

Copy this block. Replace every `[PLACEHOLDER]` with local content. Delete optional sections you choose to defer. Set `confidence = 0.10`.

````markdown
<!-- !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext -->

<<~&#x0001; ? --> lar:///ha.ka.ba/api/v0.1/[NAME] >>

<<~ ahu #iam >>

```toml
# <<~ ahu #iam-ha "structure" >>
name = "[NAME]"
file-path = "lares/ha-ka-ba/api/v0.1/[MEME-TYPE]-[NAME].md"
content-type = "text/x-memetic-wikitext"
version = "0.1-skeleton"
manaoio = 0.10
confidence = 0.10
# <<~/ahu >>
# <<~ ahu #iam-ka "detail" >>
mana = 0.10
manao = 0.10
meme-type = "[meme-type]"
register = "P"
role = "[role]"
# <<~/ahu >>
# <<~ ahu #iam-ba "flow" >>
# <<~/ahu >>

```

<<~/ahu >>

# [Title]

[One to three sentences: what this meme governs, what it does not govern, how it relates to adjacent laws.]

<<~&#x0002; ahu #meme-body-open >>
[NAME] opens the active stream here.
<<~/ahu >>

<<~ ahu #phase-map >>

## Phase Map

`✶ Observe --> ⏿ Orient --> ◇ Decide --> ▶ Act --> ⤴ Hoʻoko --> ↺ Aftermath`

[One sentence: what each phase does in this meme's specific domain.]

<<~/ahu >>

<!-- OPTIONAL: Add <<~ ahu #observe >>, #orient, #decide, #act, #hooko, #aftermath sections here.        -->
<!-- OPTIONAL: Each phase section should carry a local TOML payload, prose, and ha/ka/ba subloops.        -->
<!-- OPTIONAL: Do not close an ahu with <<~ loulou lar:///ha.ka.ba/api/v0.1/[NAME]#[same-anchor] >>.                  -->
<!-- OPTIONAL: Each ha/ka/ba subloop may close with a depth callout (O7):                                 -->
<!--   <<~ loulou lar:///ha.ka.ba/api/v0.1/[NAME]-observe-ha >>                                                       -->
<!--   Resolved callout = sub-meme exists, raises manao+manaoio.                                          -->
<!--   Declared-unresolved = address declared, file absent, creates backlog. No mana penalty.             -->
<!--   Absent = no address declared, subloop counts as stub.                                              -->
<!-- OPTIONAL: Each phase section may close with a phase-level sub-meme link (O8):                        -->
<!--   <<~ loulou lar:///ha.ka.ba/api/v0.1/[NAME]-observe >>                                                          -->
<!--   Resolved = raises mana above local-prose ceiling for that phase.                                   -->
<!-- OPTIONAL: Add #examples, #deferred-resolution, #research-foundation, #architecture-plan sections.    -->

<<~&#x0003; ahu #body-close >>
[NAME] closes the active stream here.
<<~/ahu >>

<<~ ahu #edges >>

## Edges

- `lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext`

<<~/ahu >>


<<~&#x0004; --> ? >>

````

<<~/ahu >>

### Dominant Resonance

Act functions as cross-layer execution: assembling skeleton product, conformance report, and return envelope across carrier, structural, and truth-boundary concerns while leaving the actual instantiation crossing to Hoʻoko.

### Act Subloops

<<~ ahu #act-ha >>

#### Act / ha

Act-ha holds the output domain and lawful execution boundary for skeleton preparation.

This subphase governs what Act may produce: a copy-ready skeleton, a per-element conformance report, and a prepared return envelope. Act may state intent and prepare structure but may not write the new meme file. That crossing belongs to Hoʻoko.

<<~/ahu >>

<<~ ahu #act-ka >>

#### Act / ka

Act-ka governs skeleton assembly, conformance report construction, and envelope preparation detail.

This subphase governs how Act performs its work. The skeleton block should surface as a fenced verbatim copy-ready block, not as prose description. The conformance report should surface as a typed list of per-element verdicts. The return envelope should reflect the rating-target commitment from Decide.

<<~/ahu >>

<<~ ahu #act-ba >>

#### Act / ba

Act-ba governs execution rhythm, quality pressure, and bounded dynamic flow under authoring constraint.

This subphase shapes how Act moves under real pressure. An author requesting a skeleton for a specific domain wants a locally adapted skeleton, not a generic one. Act should therefore adapt the `[PLACEHOLDER]` values — role, function, input, output — to the declared domain before handing the skeleton to Hoʻoko for instantiation.

<<~/ahu >>

### Non-Normative Prior-Art Note

> Org-Babel's principle that active documents may carry executable guidance and code together when the boundary between carrier, block, and execution remains explicit maps cleanly here. The skeleton section functions as executable guidance: it names the precise surface form the author should produce. The OODA-HA phasing keeps that guidance distinct from the act of writing the new file.

<<~/ahu >>

<<~ ahu #hooko >>

```toml
name = "meme-hooko"

role = "state-crossing threshold"
phase = "hooko"
glyph = "⤴"
```

## Hoʻoko

Hoʻoko governs the bounded threshold where the prepared skeleton may actually become a new meme file or a loaded session artifact.

Only Hoʻoko may write the new file, load the skeleton into active session memory, or otherwise alter state.

Act may prepare intent. Aftermath may judge what landed. Hoʻoko alone may perform the crossing.

### Self-Example Crossing

This file still demonstrates that preparation and crossing remain distinct. The exact transport details of its current siting, route continuity, and migration history fall outward under `lar:///ha.ka.ba/api/v0.1/pono/loci`.

What remains local here: the more general threshold law. Preparation may happen anywhere upstream, but the moment a meme surface actually crosses into changed state belongs in Hoʻoko.

### Dominant Resonance

Hoʻoko resonates most strongly with deployment and boundary crossing.

Hoʻoko governs the live threshold where prepared skeleton becomes changed state.

### Hoʻoko Subloops

<<~ ahu #hooko-ha >>

#### Hoʻoko / ha

Hoʻoko-ha holds mutation domain, instantiation boundary, and the lawful threshold around actual file creation or session load.

This subphase governs what Hoʻoko fundamentally holds: the narrow site where prepared skeleton crosses from intent into a real new meme file or a loaded constitutional artifact.

<<~/ahu >>

<<~ ahu #hooko-ka >>

#### Hoʻoko / ka

Hoʻoko-ka governs instantiation detail, file naming, field substitution, and transaction trace.

This subphase governs how Hoʻoko performs its work. When instantiating a skeleton, Hoʻoko should substitute all `[PLACEHOLDER]` marks with locally supplied values, set `confidence = 0.10` as the boot default, name the file at the declared path, and emit a transaction trace that records what got written.

<<~/ahu >>

<<~ ahu #hooko-ba >>

#### Hoʻoko / ba

Hoʻoko-ba governs landing pressure, volatility posture, and truthful state crossing under real authoring conditions.

This subphase governs how Hoʻoko moves in practice. A skeleton that gets instantiated but not yet filled sits at `confidence = 0.10`. That state should remain explicit in the new meme rather than silently upgrading it to look more complete than it currently reads.

<<~/ahu >>

### Non-Normative Prior-Art Note

> TiddlyWiki's skeleton tiddler pattern crosses its own Hoʻoko at the moment a user clicks "new tiddler from skeleton" and the skeleton fields clone into a new live tiddler. The memetic-wikitext equivalent arrives at the moment the skeleton block gets written to a real file at a real path with real placeholder values substituted. Before that moment: intent. After: changed state.

<<~/ahu >>

<<~ ahu #aftermath >>

```toml
name = "meme-aftermath"

role = "evaluation and aftermath"
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
* which optional elements appear and carry filled content
* which rating band the meme currently reaches
* what would move it to the next band
* what remains repairable without full rewrite

### Zooming Out

Coming back up for air from meme law means widening from one evaluated surface into the stack that carries it.

Aftermath should therefore return not only the local rating verdict, but also the next outward frame: which adjacent transport law, resolver roadmap, or concrete meme family now most needs alignment with the generic meme law.

### Dominant Resonance

Aftermath resonates most strongly with deployment and ritual.

Aftermath governs how rating verdicts land in agent-operator reality, how residue remains visible, and how repair pressure routes forward.

### Aftermath Subloops

<<~ ahu #aftermath-ha >>

#### Aftermath / ha

Aftermath-ha holds residue domain, rating verdict, and re-entry boundary.

This subphase governs what Aftermath fundamentally carries forward: a typed rating verdict, a per-element conformance report, and explicit naming of what remains repairable versus what requires structural intervention.

<<~/ahu >>

<<~ ahu #aftermath-ka >>

#### Aftermath / ka

Aftermath-ka governs rating computation, repair-path naming, and next-observation routing.

This subphase governs how Aftermath performs its evaluation work. Rating band assignment follows the `#rating-targets` kānāwai (law) exactly: the meme reaches the highest band all per-element verdicts jointly support, not the band it aspirationally targets.

<<~/ahu >>

<<~ ahu #aftermath-ba >>

#### Aftermath / ba

Aftermath-ba governs landing quality, recursive pressure, and operator-facing return flow.

This subphase shapes how aftermath lands in agent-operator reality. A skeleton meme at mid-band should receive aftermath that names specifically which optional elements would move it toward high band, in priority order by rating contribution. Generic encouragement does not serve the author.

<<~/ahu >>

### Non-Normative Prior-Art Note

> NIST's metric-versus-measure distinction applies cleanly here: the rating band functions as the higher-level metric, while per-element conformance verdicts function as the observable measures. Aftermath preserves both levels rather than reporting only the headline number.

<<~/ahu >>

<<~ ahu #deferred-resolution >>

## Deferred Resolution

Deferred resolution governs how a meme author or reader should treat `ala` links pointing at sub-memes that may or may not exist at parse time.

### The Three Resolution States

**Resolved**: the sub-meme exists at the declared address and carries lawful content. The walker or reader may traverse it and receive real yield. Rating consequence: full contribution as described in O7–O9 above.

**Declared-unresolved**: the address gets declared in an `ala` link, but no file or meme resolves there yet. The link does not break in intent — it names a site of future authorship. The parser or reader should degrade gracefully: emit the declared address as a forward reference, flag it as unresolved without aborting, and continue. Rating consequence: no `mana` penalty; mild drag on `manaoio` because the intent exceeds the current yield.

**Absent**: no address declared. The subloop or phase section closes without any `ala` link. No external claim resolves outward. The element counts as a stub for rating purposes. This remains honest. Absent differs from declared-unresolved in exactly one way: declared-unresolved creates backlog pressure that absent does not.

### When to Declare Depth

Declare a closing `ala` only when the block names a deeper child path such as `lar:///ha.ka.ba/api/v0.1/[NAME]-[phase]-[subphase]` or `lar:///ha.ka.ba/api/v0.1/[NAME]-[phase]`.

If the author intends no deeper child, omit the `ala` line entirely.

If the only available meaning reads "this block names `#foo`," do not add `<<~ loulou lar:///ha.ka.ba/api/v0.1/[current-path]#foo >>`; the `ahu #foo` opener already carries that identity.

### ala versus aka

`ala` governs **walking**: following a declared path to a separately addressable loci if and when it resolves. It does not inline content. Walking may wait until the reader or agent explicitly follows the link.

`aka` governs **passive transclusion**: pulling named content into the current render inline. An `aka` that points at a nonexistent address degrades harder than an `ala` that does the same, because `aka` makes a render-time claim that the content will appear here.

A sub-meme depth callout should always use `ala`, not `aka`, when the sub-meme may not yet resolve. `aka` stays reserved for content known to resolve at render time.

### Graceful Degradation Kānāwai (law)

A parser or reader encountering a declared-unresolved `ala` address SHALL:

1. Emit the declared address as a forward reference in the walk trace.
2. Log or surface the unresolved address as a named gap, not as an error.
3. Continue parsing the current meme without aborting.
4. Preserve the declared address in the conformance report so that Aftermath may surface it as residue.

A parser or reader encountering a broken `ala` toward a locus that once resolved but later got removed should surface the difference between declared-unresolved (never written) and retracted (written and removed). These take different repair paths.

### Rating Persistence

A declared-unresolved sub-meme callout does not degrade the host meme's `mana` at assessment time. However, if the declared address remains unresolved past the meme reaching `[CS]` confidence band, the outstanding forward reference creates explicit pressure toward authoring or retraction before the meme may reach `[C]` canon status.

Authors should not accumulate declared-unresolved addresses as a way to inflate apparent depth without yield. Operators and reviewers may audit the ratio of declared-unresolved to resolved callouts as a quality signal.

<<~ ahu #deferred-resolution-ha >>

#### Deferred Resolution / ha

Deferred-resolution-ha holds the identity domain: what deferred resolution fundamentally governs and what the three resolution states distinctly mean.

The core claim: resolution state does not reduce to a binary. A declared-unresolved address remains categorically distinct from both a resolved one and an absent one. Flattening these into a binary present/absent collapses information the system needs to score and route forward pressure.

<<~/ahu >>

<<~ ahu #deferred-resolution-ka >>

#### Deferred Resolution / ka

Deferred-resolution-ka governs detection procedure and graceful degradation detail.

A compliant parser scans `ala` links in document order, attempts resolution, classifies each result into one of the three states, and surfaces the classification without collapsing it. The degradation kānāwai (law) above names the exact behavior required at each state boundary.

<<~/ahu >>

<<~ ahu #deferred-resolution-ba >>

#### Deferred Resolution / ba

Deferred-resolution-ba governs authoring posture: how an author should hold declared-unresolved addresses in practice.

Declare addresses intentionally. Retract addresses honestly when the sub-meme will not get written. Prefer a truthfully absent subloop over a declared address that will never resolve. Prefer a resolved depth callout over local prose whenever the sub-meme already resolves.

<<~/ahu >>

<<~/ahu >>

<<~ ahu #research-foundation >>

## Research Foundation

Non-normative prior-art survey for deferred loading and graceful degradation in live document and wiki contexts.

Each entry names the lineage, its core principle, and what backlog pressure or extraction it creates toward this law.

---

**XInclude (`xi:fallback`)** — W3C XML Inclusions define `<xi:include>` with an explicit `<xi:fallback>` child element. When the included document fails to resolve, the fallback content renders instead of aborting. Core principle: *caller declares both the happy path and the degraded path explicitly.* Extraction pressure: meme `ala` links could carry an optional inline fallback render target when the addressed sub-meme stays absent.

**TiddlyWiki lazy loading and missing-tiddler indicator** — TiddlyWiki separates tiddler existence from tiddler content availability. A reference to a missing tiddler renders as a distinctively styled link (conventionally red or dashed) rather than as an error. Core principle: *broken references count as a first-class display state, not a fault condition.* Extraction pressure: declared-unresolved `ala` addresses should surface with a distinct visual or textual marker in rendered output so authors can see gaps without reading raw source.

**CommonMark link reference degradation** — A CommonMark link reference definition that gets referenced but not defined renders the full bracket text as literal. The document does not abort; the reference degrades gracefully. Core principle: *the absence of a definition marks a recoverable parse state.* Extraction pressure: declared-unresolved sub-meme addresses should produce a parseable, quotable surface (the address itself) rather than nothing.

**HTML `loading="lazy"` and Intersection Observer** — Browsers defer image and iframe fetch until the element nears the viewport. Core principle: *load on demand, not on parse.* Extraction pressure: sub-meme content might get walked on agent demand rather than at initial parse, reducing load for large meme graphs. The three resolution states apply equally whether loading eagerly or lazily.

**Service Worker stale-while-revalidate** — A Service Worker may serve stale cached content immediately while fetching a fresh version in the background. Core principle: *availability and freshness stay separable concerns; stale may outrank absent.* Extraction pressure: a cached prior rendering of a sub-meme may serve as declared-unresolved fallback content while the current sub-meme gets reauthored or refetched.

**Org-mode `#+INCLUDE`** — Org-mode's include directive fails hard when the target file stays absent (export errors). Its lack of graceful degradation serves as the negative prior art here: it shows why a law governing the three resolution states remains necessary rather than relying on include-or-abort semantics.

**Quarto cross-references** — Quarto's `@ref` cross-reference syntax produces a broken-reference warning with the raw label string rendered in the document rather than aborting the build. Core principle: *cross-references degrade to their own declared label rather than producing silence.* Extraction pressure: the declared address itself counts as a valid degraded rendering.

**Roam Research block references** — Roam's block reference system (`((block-uid))`) renders a live transclusion when the block resolves and a broken reference indicator when it does not. Users can see which references remain unresolved without editing raw source. Core principle: *the reference graph counts as a live first-class artifact, not just a navigation convenience.* Extraction pressure: the memetic-wikitext `ala` / `aka` walk graph should stay inspectable as a first-class product of the meme store, with resolution states queryable.

**ESM dynamic `import()`** — JavaScript's dynamic import returns a Promise that rejects if the module fails to resolve at resolution time. Core principle: *deferred resolution surfaces at call time, not at parse time.* Extraction pressure: `ala` walking can follow the same pattern — the walk gets attempted at agent-traversal time, and the three resolution states get determined then, not during initial document parse.

### Backlog from Research Foundation

* Define a standard rendered marker for declared-unresolved `ala` addresses (extracts from TiddlyWiki missing-tiddler pattern).
* Define an optional inline fallback block for `ala` addresses, analogous to `xi:fallback` (future grammar addition).
* Specify that the meme-store walk graph should remain inspectable as a queryable artifact (extracts from Roam Research principle).
* Specify that sub-meme walking occurs at agent-traversal time, not initial parse (extracts from ESM dynamic import pattern).
* Add explicit kānāwai (law) to guest-grammar for how hana guest grammars should handle deferred resolution within guest work.

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
Meme closes the canonical skeleton stream here.
<<~/ahu >>

<<~&#x0004; --> ? >>
