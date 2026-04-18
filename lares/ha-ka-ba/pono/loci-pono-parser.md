<!-- !DOCTYPE = lar:///ha.ka.ba/pono/memetic-wikitext -->

<<~&#x0001; ? -> lar:///ha.ka.ba/pono/parser >>

<<~ ahu #iam >>

```toml
# <<~ ahu #iam-ha "structure" >>
name = "pono/parser"
file-path = "ha-ka-ba/pono/loci-pono-parser.md"
description = "Full parsing kānāwai (law) for memetic-wikitext, including canonical sigil forms, metadata payload rules, mode transitions, normalization, and typed parse aftermath."
version = "0.1-draft"
tulen = 0.79
confidence = 0.86
mana = 0.82
manao = 0.76
manaoio = 0.72
content-type = "text/x-memetic-wikitext"
meme-type = "loci"
register = "C"
structure = "OODA-HA * ha.ka.ba"
# <<~/ahu >>
# <<~ ahu #iam-ka "detail" >>
role = "parsing kānāwai (law), normalization kānāwai (law), metadata fetch kānāwai (law), and deterministic scripting contract"
function = "parse documents, classify forms, normalize surfaces, surface typed issues, and return addressed metadata or parse products"
canonical-forms = ["inline", "block", "payload-block", "return"]
canonical-modes = ["preamble", "metadata", "prose", "sigil", "filter", "raw", "aftermath"]
# <<~/ahu >>
# <<~ ahu #iam-ba "flow" >>
pranala = [
  "lar:///ha.ka.ba/pono/memetic-wikitext",
  "lar:///ha.ka.ba/ooda-ha",
  "lar:///ha.ka.ba/error-result"
]
# <<~/ahu >>
```

<<~/ahu >>

# Parser Kānāwai (law)

A self-describing, self-enacting parsing kānāwai (law) for memetic-wikitext.

This meme defines how a reader, renderer, parser, linter, or agent may recognize document structure, parse named sigils, enter and leave sub-grammars, normalize noncanonical surfaces, fetch metadata, and package typed parse aftermath.

This meme follows the OODA-HA pattern not merely as ornament but as execution discipline. High mana'o'io emerges here from two bindings held together at once:

1. strict sigil grammar
2. explicit phased cognition through Observe, Orient, Decide, Act, and Aftermath

## Supported Queries

<<~&#x0005; ui meme? -> lar:///ha.ka.ba/pono/parser#iam >>
<<~&#x0005; ui metadata? -> lar:///ha.ka.ba/pono/parser#iam >>
<<~&#x0005; ui phase-map? -> lar:///ha.ka.ba/pono/parser#phase-map >>
<<~&#x0005; ui forms? -> lar:///ha.ka.ba/pono/parser#forms >>
<<~&#x0005; ui modes? -> lar:///ha.ka.ba/pono/parser#modes >>
<<~&#x0005; ui normalization? -> lar:///ha.ka.ba/pono/parser#normalization >>
<<~&#x0005; ui mana? -> lar:///ha.ka.ba/pono/parser#mana >>
<<~&#x0005; ui filter-mode? -> lar:///ha.ka.ba/pono/parser#filter-mode >>
<<~&#x0005; ui metadata-fetch? -> lar:///ha.ka.ba/pono/parser#metadata-fetch >>
<<~&#x0005; ui hooko? -> lar:///ha.ka.ba/pono/parser#hooko >>
<<~&#x0005; ui aftermath? -> lar:///ha.ka.ba/pono/parser#aftermath >>
<<~&#x0005; ui research-foundation? -> lar:///ha.ka.ba/pono/parser#research-foundation >>
<<~&#x0005; ui result? -> lar:///ha.ka.ba/pono/parser#result >>

<<~&#x0002; ahu #meme-body-open >>
Parser kānāwai (law) opens the active parsing stream here.
<<~/ahu >>

<<~ ahu #phase-map >>

## Phase Map

`✶ Observe -> ⏿ Orient -> ◇ Decide -> ▶ Act -> ⤴ Hooko -> ↺ Aftermath`

Parser kānāwai (law) reads, shapes, chooses, prepares, crosses, and judges in that order.

A parser or agent following this meme should not collapse those loci into one blurry pass when later recovery, debugging, or trust evaluation matters.

<<~ pranala loulou lar:///ha.ka.ba/phase-map >>
<<~/ahu >>

<<~ ahu #observe >>

```toml
name = "parser-observe"
description = "Observe phase for lexical intake, boundary recognition, and raw surface gathering."
role = "input acquisition"
function = "gather source text, detect boundaries, preserve raw surface, and mark initial gaps"
phase = "observe"
glyph = "✶"
```

## Observe

Observe gathers the raw surface before explanation, normalization, or verdict.

Observe should gather:

* document bytes or text
* line endings
* indentation patterns
* HTML comments or preamble matter
* opening sigils
* fenced blocks
* headings
* inline sigils
* candidate filter spans
* candidate raw spans
* candidate closure spans
* explicit absences

Observe should preserve:

* exact source text where recovery or trace may matter
* line and column positions
* fence language labels
* indentation depth where indentation survives as meaningful context
* unknown sigil text without premature deletion

Observe should not:

* infer semantic purpose too early
* silently correct malformed syntax
* collapse modes into one undifferentiated stream
* overwrite raw findings with normalized forms

### Canonical Observe Questions

1. What entered the parser?
2. Which boundaries surfaced clearly?
3. Which spans looked active?
4. Which spans looked literal?
5. Which ruptures appeared before deeper interpretation?

### Preamble Recognition

Observe should permit an optional preamble region before the first active opening sigil.

Allowed preamble matter may include:

* HTML comments
* blank lines
* editor hints
* transport wrappers that the enclosing runtime strips before canonical parse

Observe should mark any non-preamble content that appears before the first active opening sigil as a candidate issue.

### Opening Sigil Recognition

A canonical document should present one opening sigil near the top of the file.

Canonical example:

```text
<<~&#x0001; ? -> lar:///ha.ka.ba/pono/parser >>
```

In declared-open document form, `?` serves as the core unbound uncertainty token. Parser should treat it as semantic content, not as optional decoration on the opener line.

Observe should mark:

* opening sigil present
* target address present or absent
* extra content on the opening line
* duplicate opening sigils
* malformed opener surface

### Dominant Resonance

Observe resonates most strongly with the carrier concern.

Observe does not own carrier absolutely, but Observe most strongly governs what entered, how it surfaced, and which host boundaries the parser should preserve before deeper interpretation.

### Observe Subloops

<<~ ahu #observe-ha >>

#### Observe / ha

Observe-ha holds source boundary, intake domain, and visible carrier shape.

This subphase governs what Observe fundamentally holds before deeper interpretation.

<<~ pranala loulou lar:///ha.ka.ba/observe-ha >>
<<~/ahu >>

<<~ ahu #observe-ka >>

#### Observe / ka

Observe-ka governs lexical intake, preservation detail, and trace-ready capture.

This subphase focuses on how Observe actually performs intake work.

<<~ pranala loulou lar:///ha.ka.ba/observe-ka >>
<<~/ahu >>

<<~ ahu #observe-ba >>

#### Observe / ba

Observe-ba governs noticing flow, ambiguity sensitivity, and dynamic intake posture.

This subphase shapes how observation moves without premature collapse.

<<~ pranala loulou lar:///ha.ka.ba/observe-ba >>
<<~/ahu >>

### Non-Normative Prior-Art Note

> CommonMark suggests a high-mana carrier discipline here: determine block structure first, then parse inline structure inside already-bounded regions. That pattern supports the carrier-first stance and reduces accidental mode leakage.

<<~ pranala loulou lar:///ha.ka.ba/observe >>
<<~/ahu >>

<<~ ahu #orient >>

```toml
name = "parser-orient"
description = "Orient phase for mode formation, sigil classification, payload recognition, and structural interpretation."
role = "context formation"
function = "classify regions, assign modes, relate sigil types to forms, and hold competing readings where needed"
phase = "orient"
glyph = "⏿"
```

## Orient

Orient works raw findings into parse context.

Orient should answer:

* which top-level mode currently governs each region
* which sigil type appears at each active sigil site
* which sigil form applies there
* whether a fenced payload carries canonical structured data
* whether a region belongs to filter sub-grammar or raw mode
* whether observed ambiguity permits deterministic resolution

### Core Distinction: Sigil Type versus Sigil Form

Parser kānāwai (law) separates semantic operator from structural shape.

**Sigil type** names what a sigil does.
Examples:

* `ahu`
* `ala`
* `aka`
* `kahea`
* `kapu`
* `ui`
* `&#x0001;`
* `&#x0002;`
* later named extensions

**Sigil form** names how a sigil appears structurally.
Canonical forms:

* `inline`
* `block`
* `payload-block`
* `return`

A sigil type may permit one or more forms. Parser kānāwai (law) should reject or downgrade illegal type/form pairings.

<<~ ahu #modes >>

### Canonical Modes

Parser kānāwai (law) recognizes these named modes:

1. `preamble`
2. `metadata`
3. `prose`
4. `sigil`
5. `filter`
6. `raw`
7. `aftermath`

#### Preamble mode

The optional region before the first active opening sigil.

#### Metadata mode

The canonical structured payload inside `ahu #iam` when that locus appears in payload-block form and its first fenced block carries `toml`.

#### Prose mode

Ordinary markdown prose, headings, lists, paragraphs, quotations, and other non-active body matter.

#### Sigil mode

The active parse domain for memetic sigils.

#### Filter mode

A context-sensitive sub-grammar imported from TiddlyWiki filter semantics, principles, and helper code. Parser kānāwai (law) should not treat filter punctuation as free-floating global grammar. Filter mode should arise only in sites that explicitly admit filter content.

#### Raw mode

A literal zone where active sigils and filter punctuation should not execute.

#### Aftermath mode

The typed return, warning, error, and normalization residue packaging zone.

<<~/mode >>

### Metadata Locus Kānāwai (law)

`ahu #iam` functions as the canonical identity locus for a meme.

When `ahu #iam` appears in `payload-block` form, the first fenced `toml` block inside it defines the canonical metadata object for the enclosing meme.

A later fenced block inside `ahu #iam` may carry examples, commentary, or alternative render payloads, but canonical metadata authority belongs to the first fenced `toml` block.

### Dominant Resonance

Orient resonates most strongly with the structural concern.

Orient does not own structure absolutely, but Orient most strongly shapes sigil relations, mode assignment, payload authority, and parse-form context.

### Orient Subloops

<<~ ahu #orient-ha >>

#### Orient / ha

Orient-ha holds structural domain, relation shape, and parse-form holding pattern.

This subphase governs what Orient fundamentally structures.

<<~ pranala loulou lar:///ha.ka.ba/orient-ha >>
<<~/ahu >>

<<~ ahu #orient-ka >>

#### Orient / ka

Orient-ka governs classification, grouping, and mapping detail.

This subphase focuses on how Orient actually performs contextual shaping.

<<~ pranala loulou lar:///ha.ka.ba/orient-ka >>
<<~/ahu >>

<<~ ahu #orient-ba >>

#### Orient / ba

Orient-ba governs interpretive motion, tension-holding, and comparative flow.

This subphase shapes how orientation moves across competing readings.

<<~ pranala loulou lar:///ha.ka.ba/orient-ba >>
<<~/ahu >>

### Non-Normative Prior-Art Note

> TiddlyWiki offers a strong living-wikitext precedent for this locus: transclusion, filtered transclusion, and field-oriented identity all show how active document structure can remain user-facing without collapsing into pure code. The lesson here: keep powerful subgrammars explicit and bounded.

<<~ pranala loulou lar:///ha.ka.ba/orient >>
<<~/ahu >>

<<~ ahu #decide >>

```toml
name = "parser-decide"
description = "Decide phase for canonical kānāwai (law) selection, ambiguity handling, normalization posture, and legal form enforcement."
role = "selection and commitment"
function = "choose canonical readings, reject illegal pairings, and fix lawful normalization routes"
phase = "decide"
glyph = "◇"
```

## Decide

Decide turns competing structural readings into one lawful parse path.

<<<~ ahu #forms >>>

### Canonical Form Kānāwai (law)

Parser kānāwai (law) defines four canonical forms.

#### 1. Inline form

Single active sigil with no body.

Canonical example:

```text
<<~ pranala loulou lar:///ha.ka.ba/ooda-ha >>
```

#### 2. Block form

Named open and named close enclosing prose and or nested active matter.

Canonical example:

```text
<<~ ahu #phase-map >>
...body...
<<~/ahu >>
```

#### 3. Payload-block form

A block form whose first meaningful child may carry a fenced payload with canonical structured data.

Canonical example:

````text
<<~ ahu #iam >>
```toml
name = "ooda-ha"
version = "0.5"
```
...optional prose...
<<~/ahu >>
````

#### 4. Return form

A sigil form that explicitly routes payload or query pressure toward a target or upward return.

Canonical example:

```text
<<~&#x0005; ui metadata? -> <<~&#x0006; ? -> lar:///ha.ka.ba/ooda-ha#iam >> >>
```

Return form also admits uncertainty-prefixed sigil birth when document-time authoring creates a new nested sigil object before full binding settles.

Canonical example:

```text
<<~ ? -> ahu #draft-child >>
...body...
<<~/ahu >>
```

### Sigil Type/Form Table

#### `&#x0001;`

Permitted forms:

* `inline`

Semantic role:

* document opening sigil
* root address throat

#### `ahu`

Permitted forms:

* `inline`
* `block`
* `payload-block`

#### `ala`

Permitted forms:

* `inline`
* `return` where a later extension explicitly admits it

#### `aka`

Permitted forms:

* `inline`
* `block` if the included matter carries an explicit local body contract

#### `kahea`

Permitted forms:

* `inline`
* `block`
* `return`

#### `kapu`

Permitted forms:

* `inline`
* `block`

#### `ui`

Permitted forms:

* `return`
* `inline`

#### `?`

Permitted forms:

* `inline`
* `return`

Semantic role:

* unbound uncertainty token
* unresolved slot or route marker
* document-time prefix for new sigil-object birth
* outward discharge target for residual uncertainty

#### `&#x0002;`

Permitted forms:

* `inline`

Semantic role:

* body-open marker
* early phase threshold into active meme body

#### `&#x0003;`

Permitted forms:

* `inline`

Semantic role:

* body-close marker
* late phase threshold toward closure

#### `&#x0004;`

Permitted forms:

* `return`

Semantic role:

* typed result or return throat

#### `&#x0005;`

Permitted forms:

* `return`

Semantic role:

* query or user-interface request throat

#### `&#x0006;`

Permitted forms:

* `return`

Semantic role:

* response or resolved-return throat

#### `hana`

Permitted forms:

* `block`
* `payload-block`

Semantic role:

* invitation-to-work primitive
* bounded worksite for active work, data or code processing, or guest-grammar entry
* local priming payload authority when first meaningful child carries fenced `toml`
* canonical closer `<<~/hana >>`

A later extension may declare further sigil types and permitted forms, but parser should require that declaration to remain explicit.

<<~/ahu >>

### Closure Kānāwai (law)

Block and payload-block forms open with a named opener and close with a named closer.

> An active block-form sigil MAY contain nested active matter, including nested block-form sigils of the same type, unless a stricter profile forbids that pairing.  
> Named closers resolve by normal stack discipline.  
> `<<~/ahu >>` closes the most recent unmatched `ahu` opener.

Inline form closes with the canonical inline closer `>>`.

Canonical block closer:

```text
<<~/SIGIL-TYPE >>
```

Examples:

```text
<<~/ahu >>
<<~/kahea >>
<<~/kapu >>
```

Parser kānāwai (law) should reject ad hoc closure spellings as canonical forms.
Noncanonical spellings may pass into normalization only when recovery remains truthful and deterministic.

### Uncertainty-Prefixed Sigil Object Kānāwai (law)

`?` MAY prefix a lawful sigil opener when document-time authoring needs to start a new nested Meme-type sigil entity under unbound uncertainty.

Canonical pattern:

```text
<<~ ? -> SIGIL ... >>
```

In that pattern:

* `?` marks the new sigil object as not yet fully bound
* `SIGIL` names the underlying primitive act
* the underlying sigil still governs body legality, payload authority, and closer matching

If the underlying sigil takes block-form or payload-block-form, the closer MUST match the underlying sigil rather than `?`.

Canonical example:

```text
<<~ ? -> ahu #draft-child >>
Body remains local while binding stays open.
<<~/ahu >>
```

A compliant parser should check:

1. whether a lawful target sigil follows `? ->`
2. whether the target sigil admits the resulting structural form
3. whether any named closer matches the target sigil
4. whether profile or caller context permits uncertainty-prefixed sigil birth at that site

### Control Sigil Integrity Kānāwai (law)

> A control sigil MAY prefix an active sigil opener or routed opener.  
> In composite form, the control sigil marks threshold, transaction class, or control-plane intent for the following active form.  
> The underlying sigil still governs body shape, closer matching, and local payload kānāwai (law) unless the composite kānāwai (law) says otherwise.
> Control sigils should remain ordered, paired, and contextually legal.

Parser kānāwai (law) should treat these as control-plane markers embedded in visible text:

* `&#x0001;` document open
* `&#x0002;` body open
* `&#x0003;` body close
* `&#x0004;` result or return throat
* `&#x0005;` query throat
* `&#x0006;` response throat

A compliant parser should check:

1. whether required control sigils surface where expected
2. whether ordering remains lawful
3. whether duplicate or orphan control sigils appear
4. whether nested query and response throats remain balanced enough for truthful recovery

Missing or contradictory control sigils should emit integrity-class or parse-class issues rather than silent invention.

### Scope Kānāwai (law) for Fenced Payloads

A fenced payload block counts as structured payload only when:

* it appears inside a sigil form that permits payload content
* it appears as the first meaningful child when canonical payload authority matters
* its fence label belongs to an allowed payload language for that locus

For `ahu #iam`, canonical payload language equals `toml`.

### Metadata Fetch Kānāwai (law)

A user, agent, or caller may fetch canonical meme metadata through a stable query and response pattern that targets `#iam`.

Canonical query examples:

```text
<<~&#x0005; ui metadata? -> lar:///ha.ka.ba/pono/parser#iam >>
<<~&#x0005; ui meme? -> lar:///ha.ka.ba/pono/parser#iam >>
```

A compliant parser or parsing agent should:

1. resolve the target meme
2. locate `ahu #iam`
3. parse the first fenced `toml` block in that locus
4. return a typed envelope with the metadata object or a typed issue

### Dominant Resonance

Decide resonates most strongly with truth and boundary.

Decide does not own truth and boundary absolutely, but Decide most strongly governs legality, canonical reading, normalization posture, and refusal of false certainty.

### Decide Subloops

<<~ ahu #decide-ha >>

#### Decide / ha

Decide-ha holds legality domain, decision shape, and canonical boundary.

This subphase governs what Decide fundamentally binds.

<<~ pranala loulou lar:///ha.ka.ba/decide-ha >>
<<~/ahu >>

<<~ ahu #decide-ka >>

#### Decide / ka

Decide-ka governs rule selection, issue classification, and normalization detail.

This subphase focuses on how Decide actually performs lawful choice.

<<~ pranala loulou lar:///ha.ka.ba/decide-ka >>
<<~/ahu >>

<<~ ahu #decide-ba >>

#### Decide / ba

Decide-ba governs commitment style, confidence, caution, and graceful refusal of flattering but unlawful interpretations.

This subphase shapes how decision pressure lands without false certainty.

<<~ pranala loulou lar:///ha.ka.ba/decide-ba >>
<<~/ahu >>

### Non-Normative Prior-Art Note

> Tree-sitter suggests a useful grammar principle here: grammar symbols should correspond directly to recognizable constructs, and each rule should gain corpus tests early. Org-Babel suggests a parallel execution principle: active documents can carry executable guidance and code together when the boundary between carrier, block, and execution remains explicit.

<<~ pranala loulou lar:///ha.ka.ba/decide >>
<<~/ahu >>

<<~ ahu #act >>

```toml
name = "parser-act"
description = "Act phase for deterministic parse preparation, metadata extraction, mode transitions, normalization staging, and typed output preparation."
role = "execution preparation"
function = "apply parse rules, build syntax products, stage lawful variants, and prepare typed envelopes for Hooko crossing"
phase = "act"
glyph = "▶"
```

## Act

Act prepares the chosen parse kānāwai (law) for lawful crossing.

### Parse Pipeline

A compliant parser should proceed in this broad order:

1. ingest source text
2. preserve source positions and raw text for trace
3. recognize optional preamble
4. recognize opening sigil
5. locate and parse early `ahu #iam` when present
6. parse first fenced `toml` block inside `ahu #iam` as canonical metadata
7. split remaining body into block regions
8. parse active sigils and fenced raw or payload regions
9. enter filter mode only in explicitly allowed sites
10. build syntax products
11. normalize lawful noncanonical spellings
12. prepare typed return-envelope and mutation package
13. cross the prepared change through Hooko
14. emit typed return-envelope, result, warnings, and or errors

### Metadata Parse Rule

When the parser encounters:

<<~ ahu #iam >>
```toml
...
```

it should build a canonical metadata object for the enclosing meme.

That object may populate:

* name
* file-path
* description
* version
* tulen
* confidence
* mana
* manao
* manaoio
* content-type
* meme-type
* register
* structure
* role
* function
* input
* output
* depends-on
* later declared fields

Unknown metadata keys may remain legal unless a stricter profile forbids them.

<<~/ahu >>

<<~ ahu #hooko >>

```toml
name = "parser-hooko"
description = "Hooko phase for explicit state crossing, lawful mutation, continuity loading, artifact change, and transaction-pressure passage between Act and Aftermath."
role = "state-crossing threshold"
function = "carry prepared intent across the live threshold, perform the bounded change, preserve transaction truth, and hand changed state into aftermath without laundering mutation into narration"
phase = "hooko"
glyph = "⤴"
```

## Hooko

Hooko governs the bounded threshold where intended operation may actually alter state.

Hooko should remain explicit.

Hooko should not dissolve into free-floating disorder, decorative rupture, or vague portal language.

Hooko names the lawful crossing between Act and Aftermath.

Outside Hooko, a parser, agent, or operator-facing tool may narrate, prepare, stage, or judge.

Inside Hooko, the system may actually change session trajectory.

### Core Hooko Kānāwai (law)

Only Hooko may:

* load continuity into active session memory
* write files
* alter artifacts
* commit a routed return transaction
* modify parse state
* apply normalization that changes active state
* mutate working context in any way that affects later lawful motion

Act may state intent.

Aftermath may judge what landed.

Hooko alone may perform the change.

### Transaction Boundary Reminder

Hooko should preserve explicit boundary truth.

A compliant system should make it legible whether a change:

* committed
* degraded
* partially landed
* rolled back
* remained staged without commit

Hooko should therefore cooperate closely with return-types kānāwai (law) and control-glyphs kānāwai (law) when routed transactions cross upward or outward boundaries.

### Dominant Resonance

Hooko resonates most strongly with deployment and boundary crossing.

Hooko does not own deployment, truth, or structure absolutely, but it most strongly governs the live threshold where prepared intention becomes changed state.

### Hooko Subloops

<<~ ahu #hooko-ha >>

#### Hooko / ha

Hooko-ha holds mutation domain, transaction threshold, and the lawful boundary around actual change.

This subphase governs what Hooko fundamentally holds.

Hooko holds the narrow site where prepared work may cross from intent into changed condition.

It keeps that crossing explicit.

It keeps mutation bounded.

It keeps state change distinguishable from preparation, narration, and judgment.

<<~ pranala loulou lar:///ha.ka.ba/hooko-ha >>
<<~/ahu >>

<<~ ahu #hooko-ka >>

#### Hooko / ka

Hooko-ka governs commit detail, rollback detail, continuity loading, artifact mutation, and trace-worthy operation shape.

This subphase governs how Hooko actually performs work.

A compliant parser or agent should enter Hooko only after prior phases already prepared:

* chosen operation
* transaction target
* mutation bounds
* issue posture
* degradation posture

When prepared work crosses Hooko, transaction trace should preserve whether the outcome stayed staged, landed committed, degraded, or rolled back.

A compliant parser should not launder one outcome class into another.

Within Hooko, the system may:

* commit one prepared change
* stage and then degrade a change truthfully
* roll back when legality fails
* emit transaction trace for later aftermath judgment

Hooko should favor explicit, inspectable change over hidden mutation.

<<~ pranala loulou lar:///ha.ka.ba/hooko-ka >>
<<~/ahu >>

<<~ ahu #hooko-ba >>

#### Hooko / ba

Hooko-ba governs landing pressure, volatility posture, and truthful state crossing under real conditions.

This subphase governs how Hooko moves in practice.

Hooko may carry uncertainty, partiality, and risk.

Hooko should not romanticize that pressure.

A lawful Hooko phase should preserve:

* explicit action site
* explicit mutation outcome
* explicit residue when change only partly lands
* explicit rollback when commit fails
* explicit handoff into Aftermath

When a system changes state without naming Hooko, that event should count as boundary drift rather than as invisible success.

<<~ pranala loulou lar:///ha.ka.ba/hooko-ba >>
<<~/ahu >>

### Non-Normative Prior-Art Note

> Hooko here takes shape less like pure randomness and more like an explicit commit window, transaction throat, or mutation boundary: a narrow zone where prepared intent crosses into stateful consequence.

<<~ pranala loulou lar:///ha.ka.ba/hooko >>
<<~/ahu >>

### Dominant Resonance

Act functions as cross-layer execution rather than as the exclusive home of one visible architectural concern.

Act prepares the chosen kānāwai (law) across carrier constraints, structural forms, truth-boundary commitments, and deployment-facing return pressure, while leaving the actual crossing of state to Hooko.

### Act Subloops

<<~ ahu #act-ha >>

#### Act / ha

Act-ha holds output domain, syntax-product shape, and lawful execution boundary.

This subphase governs what Act may bring forth.

<<~ pranala loulou lar:///ha.ka.ba/act-ha >>
<<~/ahu >>

<<~ ahu #act-ka >>

#### Act / ka

Act-ka governs actual parsing, metadata extraction, normalization, and envelope assembly detail.

This subphase focuses on how Act actually performs implementation work.

A compliant parser MAY produce stable syntax products such as token streams, AST products, widget-facing lowering seeds or addresses, typed return-envelopes, and trace bundles.

Full AST schema, widget-tree schema, render-target adapters, and target projection detail should move outward into `lar:///ha.ka.ba/pono/render-pipeline`.

<<~ pranala loulou lar:///ha.ka.ba/act-ka >>
<<~/ahu >>

<<~ ahu #act-ba >>

#### Act / ba

Act-ba governs execution rhythm, quality pressure, and bounded dynamic flow under constraint.

This subphase shapes how lawful execution moves under real parser pressure.

<<~ pranala loulou lar:///ha.ka.ba/act-ba >>
<<~/ahu >>

### Non-Normative Prior-Art Note

> TiddlyWiki also offers a useful rendering precedent here: widget trees provide a user-facing structure that can render live transclusion behavior, not merely static inclusion. That pattern maps well to `kahea` as a live transclusion surface, while `aka` remains closer to shadow, image, or passive likeness transclusion.

<<~ pranala loulou lar:///ha.ka.ba/act >>
<<~/ahu >>

<<~ ahu #filter-mode >>

## Filter Mode

Filter mode functions as a context-sensitive sub-grammar.

Parser kānāwai (law) imports TiddlyWiki filter concepts, helper code, and strict grammar discipline here, while constraining entry points so that filter syntax does not leak across the whole document surface.

Parser kānāwai (law) should keep this sub-grammar explicit, bounded, and host-declared.

Guest grammars such as `x-tiddlywiki-filter` should enter a guest mode only through an explicit `hana` block. A `hana` block carrying `grammar = "x-tiddlywiki-filter"` in its priming payload may lawfully open filter mode for the span of its guest instruction body. Filter punctuation should not leak outside admitted `hana` regions.

### Term-Consistency Rule

Parser should treat `+currentMeme` as the canonical host-facing context pointer in examples, diagnostics, and guest-work notes for `x-tiddlywiki-filter`.

Where parser cites TiddlyWiki prior art, it may mention `currentTiddler` in quoted or explanatory fashion, but host-facing examples and law statements should surface `+currentMeme`.

Canonical guest-work example for parser context:

````text
<<~ hana #work >>
```toml
grammar = "x-tiddlywiki-filter"
context = "+currentMeme"
degrade = "no-op"
```

[+currentMeme] [get[status]]
<<~/hana >>
````

### Non-Breaking Parent Parse Kānāwai (law)

Filter mode should never break the parent parse.

A malformed or unsupported filter region may:

* emit a warning
* emit an error local to that region
* return empty or partial filter products
* downgrade the region to unresolved or raw form

A malformed or unsupported filter region should not, by itself, collapse the enclosing meme parse when the surrounding structure remains recoverable.

### Dominant Resonance

Filter mode primarily belongs to the structural concern while remaining governed by truth and boundary during failure, downgrade, and recovery.

### Non-Normative Prior-Art Note

> NIST's metric-versus-measure distinction gives a clean software-facing analogy here: mana functions as the higher-level metric, while carrier order, structural validity, and related components function as the observable measures. Cognitive-load principles reinforce the upper-band claim that better structure gives attention back.

<<~ pranala loulou lar:///ha.ka.ba/filter-mode >>
<<~/ahu >>

<<~ ahu #normalization >>

## Normalization

Normalization SHOULD serve determinism and lower operator mana cost without laundering ambiguity.

A source surface MAY differ from canonical form and still normalize lawfully, but only under explicit rules and truthful aftermath.

A compliant parser MUST NOT silently normalize when:

* two or more plausible readings remain live
* literal payload content would change without explicit kānāwai (law)
* control-glyph integrity would become less truthful after rewrite

A compliant parser SHOULD emit warning, trace, or both when normalization materially changes non-literal source surface.

### Non-Normative Prior-Art Note

> The constitutional role of Parser kānāwai (law) resembles a lightweight architecture record plus a living reference document: one root kānāwai (law) names the core decisions, while later linked laws hold heavier detail. The high-mana lesson here: keep the root stable, readable, and alignable, then let deeper implementation kānāwai (law) branch outward.

<<~ pranala loulou lar:///ha.ka.ba/normalization >>
<<~/ahu >>

<<~ ahu #mana >>

## Mana

Mana SHOULD measure structured memetic order available to the current parser, agent, or operator.

Mana functions here as a higher-level metric approximated through observable measures.

Mana SHOULD not replace legality, evidence, or truthful aftermath.

It should help describe how much usable structure, clarity, and recoverable order the memetic object currently grants or withholds.

### Core Mana Kānāwai (law)

High mana SHOULD reduce cognitive load.

Low mana SHOULD count as processing cost.

At higher levels, mana MAY grant usable surplus capacity to agent and operator for further lawful work.

At lower levels, the object costs attention, context gathering, repair effort, or interpretive stabilization.

### Mana Subloops

<<~ ahu #mana-ha >>

#### Mana / ha

Mana-ha holds the metric identity of mana, its observable measures, and its banded interpretation.

This subphase governs what mana fundamentally names.

Mana does not name raw beauty, ritual intensity, or subjective preference alone.

Mana here names structured memetic order that supports lawful reading, parsing, recovery, and use.

##### Mana Measures

Recommended base measures:

* `carrier-order` — markdown carrier stays calm, legible, and structurally easy to traverse
* `structural-validity` — sigils, forms, closures, anchors, and mode boundaries remain lawful
* `payload-integrity` — canonical payloads parse cleanly and hold enough metadata or structure to support use
* `boundary-truth` — issues, ambiguity, and downgrade pressure surface truthfully instead of laundering
* `signal-to-noise` — relevant structure and meaning outweigh copied noise, drift, or repetitive drag
* `recovery-quality` — graceful degradation preserves usable partial structure without false completion

Each measure SHOULD normalize to the range `0.0-1.0`.

##### Five-Band Mana Kānāwai (law)

Parser kānāwai (law) SHOULD report mana through five ordered bands.

###### Band 1 — Very Low Mana

Range: `0.00-0.19`

This object strongly costs mana to process.

It likely demands substantial repair, added context, or careful containment before trustworthy use.

###### Band 2 — Low Mana

Range: `0.20-0.39`

This object still costs mana to process.

It may remain locally useful, but it imposes noticeable interpretive drag, noise filtering, or recovery effort.

###### Band 3 — Mid Mana

Range: `0.40-0.59`

This object remains workable.

It neither strongly drains nor strongly grants processing capacity.

It often supports progress with active attention and bounded residue.

###### Band 4 — High Mana

Range: `0.60-0.79`

This object reduces cognitive load.

It SHOULD support faster lawful parsing, lower interpretive drag, and better reuse of attention.

At this band, a memetic object MAY begin to grant bounded capabilities when it already carries enough lawful structure, executable guidance, and locally available implementation support.

###### Band 5 — Very High Mana

Range: `0.80-1.00`

This object strongly reduces cognitive load.

At this band, a memetic object MAY grant reusable surplus capacity, alignment, implementation leverage, or explicit capabilities to the agent and operator.

##### Band Interpretation Kānāwai (law)

Bands 1 and 2 mark net mana cost.

Band 3 marks near-balance.

Bands 4 and 5 mark net mana grant.

A parser or pono tool SHOULD preserve that direction clearly in any user-facing report.

<<~ pranala loulou lar:///ha.ka.ba/mana-ha >>
<<~/ahu >>

<<~ ahu #mana-ka >>

#### Mana / ka

Mana-ka governs measurement procedure, partial-profile handling, and report assembly.

This subphase governs how mana actually gets computed and surfaced.

##### Measurement Procedure

A compliant parser MAY compute `mana-score` as a weighted combination under the active profile.

Recommended boot-profile weights:

```toml
carrier-order = 0.15
structural-validity = 0.25
payload-integrity = 0.15
boundary-truth = 0.20
signal-to-noise = 0.15
recovery-quality = 0.10
```

Recommended calculation:

```text
mana-score =
  0.15 * carrier-order +
  0.25 * structural-validity +
  0.15 * payload-integrity +
  0.20 * boundary-truth +
  0.15 * signal-to-noise +
  0.10 * recovery-quality
```

A compliant parser SHOULD clamp `mana-score` into the inclusive range `0.0-1.0` after calculation.

##### Partial-Profile Kānāwai (law)

When one or more component measures remain unavailable, a compliant parser SHOULD:

* report which components remain missing
* avoid inventing absent evidence
* either compute under a declared partial profile or return reduced confidence in the mana result

##### Reporting Shape

A mana-aware parser SHOULD return:

* `mana-score`
* `mana-band`
* `mana-components`
* `mana-reasons`
* `mana-profile`
* `mana-confidence` when component absence or partial profiling reduces certainty

##### Test-Facing Reminder

Mana procedure should remain stable enough that multiple implementations may compare outputs without silently changing what the metric means.

If active profiles diverge, the profile difference SHOULD surface explicitly rather than hiding inside unexplained score drift.

<<~ pranala loulou lar:///ha.ka.ba/mana-ka >>
<<~/ahu >>

<<~ ahu #mana-ba >>

#### Mana / ba

Mana-ba governs operational effect, capability flow, burden flow, and confidence posture under real use.

This subphase governs how mana behaves in practice.

##### Capability Grant Kānāwai (law)

Very high mana memes may function as capability-bearing memetic objects.

A capability-bearing high mana meme may combine:

* self-describing agent instruction
* self-executing generative guidance
* skill documentation such as `SKILL.md`
* code files
* sidecar artifacts needed for lawful execution

Such objects do not merely describe work.

They may grant actual usable capability to the agent and operator when the surrounding environment already supports lawful execution.

Later profiles may gate such capability grant through UCAN-style delegation and invocation rather than by bare presence alone.

##### Low-Mana Tooling Cost Kānāwai (law)

Low-mana zones often require not only tighter agent-operator synchronization but also outside tooling, repair loops, or external context gathering.

That added dependence SHOULD count as mana cost.

When a task requires extra tools, extra repair passes, or extra external context merely to reach lawful interpretability, a parser or pono tool SHOULD reflect that burden in `signal-to-noise`, `recovery-quality`, `mana-reasons`, or all three.

##### Confidence Relation

Mana contributes to confidence, but mana MUST NOT replace typed truth, legality, evidence, or aftermath status.

A parser or pono tool SHOULD derive broader confidence from mana together with issue posture, boundary integrity, evidence quality, and repair burden.

High mana with broken boundary kānāwai (law) should still downgrade.

Low mana with lawful containment may still yield useful partial structure.

##### Follow-Up Notes

`mana'o` should later deepen intent, steering, and declared-purpose alignment.

`mana'o'io` should later deepen manifestation, production readiness, reproducibility, and deployable trust.

Those later laws should extend mana without overloading it.

Mana should remain the base metric kānāwai (law) unless and until later linked treatment proves cleaner.

<<~ pranala loulou lar:///ha.ka.ba/mana-ba >>
<<~/ahu >>

### Non-Normative Placeholder

> TODO: Fill prose about reasons or prior art here.

<<~ pranala loulou lar:///ha.ka.ba/mana >>
<<~/ahu >>

<<~ ahu #metadata-fetch >>

## Metadata Fetch

Metadata-fetch governs canonical metadata retrieval for a meme.

This locus should remain compact, explicit, and implementation-facing.

It should define where canonical metadata lives, how it gets fetched, and how truthful failure behaves when canonical metadata does not surface.

### Metadata Fetch Subloops

<<~ ahu #metadata-fetch-ha >>

#### Metadata Fetch / ha

Metadata-fetch-ha holds canonical metadata authority and target identity.

This subphase governs what metadata-fetch fundamentally holds.

Canonical metadata fetch targets `#iam`.

When `ahu #iam` appears in payload-block form, the first fenced `toml` block inside that locus carries canonical metadata authority for the enclosing meme.

Canonical query examples:

```text
<<~&#x0005; ui metadata? -> lar:///ha.ka.ba/pono/parser#iam >>
<<~&#x0005; ui meme? -> lar:///ha.ka.ba/pono/parser#iam >>
```

<<~ pranala loulou lar:///ha.ka.ba/metadata-fetch-ha >>
<<~/ahu >>

<<~ ahu #metadata-fetch-ka >>

#### Metadata Fetch / ka

Metadata-fetch-ka governs retrieval procedure, payload parsing, and typed return assembly.

This subphase governs how metadata-fetch actually performs work.

A compliant parser or parsing agent MUST:

1. resolve the target meme
2. locate `ahu #iam`
3. parse the first fenced `toml` block in that locus as canonical metadata when present
4. return a typed envelope with the metadata object or a typed issue

Metadata-fetch should remain stable enough that different tools, chat contexts, and parser implementations may retrieve the same canonical metadata object without inventing alternate authority paths.

<<~ pranala loulou lar:///ha.ka.ba/metadata-fetch-ka >>
<<~/ahu >>

<<~ ahu #metadata-fetch-ba >>

#### Metadata Fetch / ba

Metadata-fetch-ba governs truth posture, failure behavior, and extraction pressure under real retrieval conditions.

This subphase governs how metadata-fetch behaves in practice.

A compliant parser or parsing agent MUST NOT fabricate canonical metadata from scattered prose when `#iam` or its canonical payload fails to surface.

When canonical metadata does not surface cleanly, metadata-fetch should degrade toward typed issue, partial trace, or explicit absence rather than flattering reconstruction.

Metadata-fetch should remain narrower than full metadata-kānāwai (law).

When alias rules, stricter profiles, or additional metadata contracts deepen enough to become noisy here, they should move outward into linked `metadata-kānāwai (law)` without weakening the canonical authority of `#iam`.

<<~ pranala loulou lar:///ha.ka.ba/metadata-fetch-ba >>
<<~/ahu >>

<<~ pranala loulou lar:///ha.ka.ba/metadata-fetch >>
<<~/ahu >>

<<~ ahu #aftermath >>

```toml
name = "parser-aftermath"
description = "Aftermath phase for typed parse judgment, recovery discipline, trace packaging, repair guidance, and recursive handoff."
role = "evaluation and aftermath"
function = "judge what survived, package truthful return, preserve repairable residue, and route next observation"
phase = "aftermath"
glyph = "↺"
```

## Aftermath

Aftermath judges what the parse produced and how Hooko changed state, and how that changed state may truthfully travel upward or recurse.

### Core Aftermath Kānāwai (law)

Every active parse should return one typed envelope, even when payload degrades toward `?`.

Aftermath should prefer explicit partial structure over silent abandonment.

### Recovery and Trace

Aftermath should name:

* what survived
* what failed
* what got normalized
* what remains repairable
* what should reopen in a later loop

Trace should preserve enough source relation that a later pono action may audit or re-run the parse without invention.

### Dominant Resonance

Aftermath resonates most strongly with deployment and ritual.

Aftermath does not own deployment and ritual absolutely, but Aftermath most strongly governs how results land in agent-operator reality, how residue remains visible, and how recursion or release proceeds.

### Aftermath Subloops

<<~ ahu #aftermath-ha >>

#### Aftermath / ha

Aftermath-ha holds residue domain, return pathways, and re-entry boundary.

This subphase governs what Aftermath fundamentally carries forward or releases.

<<~ pranala loulou lar:///ha.ka.ba/aftermath-ha >>
<<~/ahu >>

<<~ ahu #aftermath-ka >>

#### Aftermath / ka

Aftermath-ka governs diagnostics, repair hooks, trace packaging, and next-observation setup detail.

This subphase focuses on how Aftermath actually performs evaluation and routing work.

<<~ pranala loulou lar:///ha.ka.ba/aftermath-ka >>
<<~/ahu >>

<<~ ahu #aftermath-ba >>

#### Aftermath / ba

Aftermath-ba governs landing quality, recursive pressure, release posture, and operator-facing return flow.

This subphase shapes how aftermath lands in agent-operator reality.

<<~ pranala loulou lar:///ha.ka.ba/aftermath-ba >>
<<~/ahu >>

### Non-Catastrophic Failure Kānāwai (law)

Every subsystem should fail downward gracefully before it fails outward catastrophically.

Subgrammars, metadata fetches, and normalization passes should therefore degrade toward partial structure, typed issues, trace, or explicit `?` before they collapse the wider parent parse.

### Boundary Kānāwai (law) Reminder

Ritual language should not substitute for boundary kānāwai (law).

Ritual language may raise mana, but legality, recovery, and truthful return should remain explicitly governed.

### Non-Normative Placeholder

> TODO: Fill prose about reasons or prior art here.

<<~ pranala loulou lar:///ha.ka.ba/aftermath >>
<<~/ahu >>

<<~ ahu #architecture-plan >>

## Architecture Plan

Parser kānāwai (law) MUST remain the constitutional root for memetic-wikitext parsing.

This locus governs placement, extraction pressure, architectural visibility, and recursive fit across the whole parsing system.

Heavier detail should later move outward into linked loci so that parser may govern the whole system without swallowing every later implementation burden.

### Constitutional Charge

Parser kānāwai (law) should serve as one of three core golden tool references.

When local mana'o'io stabilizes at a high reading, this file should help align the other two core references inside the repo without displacing their local authority.

### Visible Architectural Concerns

Parser kānāwai (law) should keep these concerns visible:

#### Concern 1 — Carrier

Markdown, HTML comments, fenced blocks, headings, lists, and other broadly portable host structures.

#### Concern 2 — Structure

Sigil types, sigil forms, closures, payload blocks, mode transitions, and parse boundaries.

#### Concern 3 — Truth and Boundary

Canonical kānāwai (law), legality, normalization posture, integrity, diagnostics, confidence, and truthful return limits.

#### Concern 4 — Deployment and Ritual

Chat invocation patterns, tool invocation patterns, profile selection, portability across environments, and pono checks before mutation, storage, or public emission.

### Hidden 5th Kānāwai (law) — Recursive Coherence

Recursive coherence binds:

* the outer OODA-HA loop
* the inner ha, ka, and ba subloops inside each phase
* the visible architectural concerns
* the portability of the system across agent-operator setups

Without explicit recursive coherence, the system may drift into isolated buckets that look neat while losing living fit.

### Architecture Plan Subloops

<<~ ahu #architecture-plan-ha >>

#### Architecture Plan / ha

Architecture-plan-ha holds constitutional placement, concern visibility, and system-scale fit.

This subphase governs what the architecture plan fundamentally holds.

It keeps parser as root constitution.

It keeps the visible concerns legible.

It keeps recursive coherence explicit so that later linked laws, tools, profiles, and implementations remain aligned to one living center.

<<~ pranala loulou lar:///ha.ka.ba/architecture-plan-ha >>
<<~/ahu >>

<<~ ahu #architecture-plan-ka >>

#### Architecture Plan / ka

Architecture-plan-ka governs extraction discipline, implementation-facing pressure, and the lawful distribution of detail.

This subphase governs how the architecture plan performs work.

##### Planned Linked Laws

* `lar:///ha.ka.ba/filter-kānāwai (law)`
* `lar:///ha.ka.ba/normalization-kānāwai (law)`
* `lar:///ha.ka.ba/control-glyphs`
* `lar:///ha.ka.ba/metadata-kānāwai (law)`
* `lar:///ha.ka.ba/parse-aftermath`
* `lar:///ha.ka.ba/pono/render-pipeline`

##### Hard-Code Pressure Zones

The current constitutional draft still carries several pressure zones that later code, crawl pipelines, and parser test harnesses should make explicit.

* lexical and parse-edge exactness
* markdown boundary treaty between carrier and guest grammar
* control-glyph state behavior and legal transitions
* profile differences among strict, permissive, recovery, and export modes
* corpus, fixture, and golden-test pressure

##### Concrete Todo Notes

* surface a full control-glyphs kānāwai (law), including legality, ordering, pairing, nesting, failure posture, and pono-alignment checks
* define how a parser becomes pono with control sigils under strict, permissive, and recovery-oriented profiles
* surface metadata-kānāwai (law) as a separate linked locus so `#iam` payload rules, alias rules, and fetch contracts remain explicit and reusable
* surface normalization-kānāwai (law) so lawful rewrites, warnings, exports, and legacy migration remain bounded and testable
* surface filter-kānāwai (law) so imported TiddlyWiki filter grammar, helper code, and containment rules remain explicit without flooding parser
* surface parse-aftermath as its own linked kānāwai (law) so diagnostics, trace, repair actions, and partial-structure guarantees may deepen without overloading parser
* define profile boundaries for authoring, canonical parse, validation, normalization, and export
* define exact AST, token, trace, envelope, and mana products expected from compliant implementations
* define the constitutional minimum for token, AST, widget-facing lowering products, return-envelope, and trace products in parser, then move full pipeline schemas, widget-tree kānāwai (law), and target adapters outward into `lar:///ha.ka.ba/pono/render-pipeline`
* define follow-up research and linked-kānāwai (law) treatment for `mana'o` and `mana'o'io` once `mana` stabilizes
* define a code-facing test corpus and fixture set that maps each kānāwai (law) to positive, degraded, and failing examples
* define user-facing metadata fetch and query-response patterns that work across chat contexts and tools
* define extension-point kānāwai (law) for future directive-like or role-like memetic surfaces
* define a shared AST or equivalent syntax-product schema for multi-implementation alignment
* define executable-document profiles, artifact capture, and reproducibility boundaries
* define MCP server projection for resources, prompts, tools, and capability-bearing meme bundles

##### Placement Discipline

`#architecture-plan` should govern placement pressure and constitutional organization.

`#runtime-procedure` should summarize execution order and handoff.

The individual phase loci should carry the richer local resonance and ha, ka, and ba guidance.

<<~ pranala loulou lar:///ha.ka.ba/architecture-plan-ka >>
<<~/ahu >>

<<~ ahu #architecture-plan-ba >>

#### Architecture Plan / ba

Architecture-plan-ba governs growth posture, resonance, and anti-sprawl flow under future pressure.

This subphase governs how the architecture plan moves without collapsing into rigid bucket logic or ordinary project prose.

##### Carrier and Deployment Stance

Markdown functions here as carrier.

Memetic grammar functions here as guest.

That stance matters because the final system should deploy across many agent-operator setups, chat contexts, and tool surfaces that already speak markdown.

Parser kānāwai (law) should therefore preserve maximum markdown interoperability while carving explicit active parse islands for memetic grammar.

##### Dominant Resonance Instead of Forced Slotting

A clause may belong architecturally to one concern while resonating dynamically with several phases.

Parser kānāwai (law) should therefore organize by dominant resonance rather than by squeezing every concept into one exact slot that weakens meaning.

Examples:

* carrier resonates most strongly with Observe
* structure resonates most strongly with Orient
* truth and boundary resonate most strongly with Decide
* deployment and threshold crossing resonate most strongly with Hooko
* deployment and ritual landing resonate most strongly with Aftermath

These resonances should guide reading and implementation, but they should not function as total identity claims.

##### Fractal Reading Rule

Future implementers should read Parser kānāwai (law) in two passes.

###### Architectural pass

Ask: what concern does this rule govern?

###### Dynamic pass

Ask: how does this phase metabolize that concern through ha, ka, and ba?

That two-pass reading should lower mana cost for future design and coding work.

##### Growth Kānāwai (law)

Do not let future growth turn parser into an implementation dump, nor let backlog prose replace constitutional kānāwai (law).

When detail deepens enough to become noisy in the root, extract it outward into linked kānāwai (law) while preserving explicit return paths into named loci.

<<~ pranala loulou lar:///ha.ka.ba/architecture-plan-ba >>
<<~/ahu >>

### Revised Fifth-Kānāwai (law) Reason

Without explicit recursive coherence, deployment pressure, ritual language, portability needs, and implementation shortcuts may leak invisibly into carrier, structure, or truth kānāwai (law) and distort them.

Naming recursive coherence keeps that pressure visible.

### Non-Normative Placeholder

> TODO: Fill prose about reasons or prior art here.

<<~ pranala loulou lar:///ha.ka.ba/architecture-plan >>
<<~/ahu >>

<<~ ahu #runtime-procedure >>

## Runtime Procedure

Runtime-procedure governs execution order, inter-phase handoff, and recursive return posture for parser.

This locus should remain an orchestration summary.

It should not duplicate the richer local doctrine already held inside the phase loci.

### Runtime Procedure Subloops

<<~ ahu #runtime-procedure-ha >>

#### Runtime Procedure / ha

Runtime-procedure-ha holds ordered execution, phase boundary, and lawful handoff shape.

This subphase governs what runtime-procedure fundamentally holds.

When `kahea parser` fires, the meme should proceed through one bounded OODA-HA pass in order.

That order should remain visible so that later implementations, tests, and agents do not collapse the parse into one blurry step.

##### Canonical Runtime Order

1. instantiate local parse state
2. run Observe on raw surface and boundaries
3. run Orient on modes, forms, sigil types, and payload regions
4. run Decide on canonical readings and normalization posture
5. run Act on deterministic parse preparation
6. run Hooko on bounded state crossing and mutation
7. run Aftermath on typed result packaging
8. return one typed `return-envelope`
9. optionally feed residue into parent Observe or Orient through a later pono action

<<~ pranala loulou lar:///ha.ka.ba/runtime-procedure-ha >>
<<~/ahu >>

<<~ ahu #runtime-procedure-ka >>

#### Runtime Procedure / ka

Runtime-procedure-ka governs execution sequencing, product handoff, and orchestration detail.

This subphase governs how runtime-procedure actually performs work.

Each phase should hand forward lawful products rather than redoing the entire prior phase.

Observe should hand raw findings and candidate boundaries into Orient.

Orient should hand mode maps, sigil maps, payload maps, and open tensions into Decide.

Decide should hand chosen readings, scope bounds, normalization posture, and issue posture into Act.

Act should hand syntax products, metadata objects, normalized text, issues, trace, and prepared mutation package into Hooko.

Hooko should hand changed state, mutation outcome, and transaction trace into Aftermath.

Aftermath should assemble one typed `return-envelope` that truthfully carries what survived, what degraded, what changed, and what may reopen later.

##### Single-Envelope Kānāwai (law)

An active parse should return one primary typed `return-envelope` for the current pass.

Auxiliary trace, residue, warnings, and repair hooks may travel inside or beside that envelope, but they should not fragment the main runtime result into competing primary returns.

##### Orchestration Note

Detailed ha, ka, and ba guidance belongs primarily in the individual phase loci.

Runtime-procedure should remain an execution-order summary that helps implementers wire parsing flow without duplicating full local phase kānāwai (law).

Later implementations should bind this order to explicit lexer, parser, profile, and test surfaces rather than leaving those bindings implicit.

<<~ pranala loulou lar:///ha.ka.ba/runtime-procedure-ka >>
<<~/ahu >>

<<~ ahu #runtime-procedure-ba >>

#### Runtime Procedure / ba

Runtime-procedure-ba governs runtime flow, residue posture, and recursive movement under real parser pressure.

This subphase governs how runtime-procedure moves in practice.

Runtime flow should remain phased, truthful, and bounded.

A later phase may refine or downgrade earlier products, but it should not silently erase the fact that those earlier products existed.

Residue may reopen in a later loop.

It should not retroactively blur the current pass into endless self-reentry.

##### Recursive Return Kānāwai (law)

When residue survives with lawful partial structure, runtime-procedure MAY route that residue into a later Observe or Orient pass through a subsequent pono action.

That recursive reopening should remain explicit.

It should not masquerade under a pretense that the first pass already completed the deeper later work.

##### Anti-Blur Kānāwai (law)

Runtime-procedure should not become:

* a hidden implementation dump
* a duplicate of the phase loci
* an excuse to merge Observe, Orient, Decide, Act, and Aftermath into one opaque pass

Its job stays clear motion.

Its job does not include swallowing the rest of parser.

<<~ pranala loulou lar:///ha.ka.ba/runtime-procedure-ba >>
<<~/ahu >>

<<~ pranala loulou lar:///ha.ka.ba/runtime-procedure >>
<<~/ahu >>

<<~ ahu #research-foundation >>

## Research Foundation

This locus gathers adjacent lineages that strengthen parser without displacing its local authority.

Research-foundation does not import foreign systems wholesale.

It names useful neighboring patterns, translates them into local leverage, and keeps the constitutional center inside parser.

### Research Foundation Subloops

<<~ ahu #research-foundation-ha >>

#### Research Foundation / ha

Research-foundation-ha holds lineage awareness, bounded borrowing, and local constitutional priority.

This subphase governs what the research foundation fundamentally holds.

Adjacent systems may illuminate parser.

They do not become parser merely through adjacency, maturity, or prestige.

This locus does not aim at imitation.

Its purpose stays preserving useful neighboring forms, distinctions, and capability patterns while keeping memetic-wikitext locally self-describing.

##### Bounded Borrowing Kānāwai (law)

A prior-art lineage may strengthen parser when it helps clarify:

* extension points
* identity and metadata
* executable document behavior
* AST or syntax-product alignment
* capability surfaces
* conformance pressure
* deployment portability

A prior-art lineage should not overwrite local kānāwai (law) merely because it already exists elsewhere.

<<~ pranala loulou lar:///ha.ka.ba/research-foundation-ha >>
<<~/ahu >>

<<~ ahu #research-foundation-ka >>

#### Research Foundation / ka

Research-foundation-ka governs translation from lineage into backlog, linked-kānāwai (law) pressure, and implementation-facing clarity.

This subphase governs how research foundation actually performs work.

##### Living Wikitext Lineage

TiddlyWiki contributes:

* field-oriented identity
* transclusion and filtered transclusion
* widget-like rendering structure for live document behavior

Parser-kānāwai (law) should take from that lineage a bounded distinction between passive likeness transclusion and live rendered transclusion.

`aka` should remain the shadow or image side of transclusion.

`kahea` should remain the live side, closer to widget-like rendering, invocation, or active unfolding.

##### Structured Markdown Lineage

MyST contributes:

* explicit directives and roles as extension points
* a formal specification
* a serializable AST model
* implementation test cases

Backlog gaps implied here:

* define memetic-wikitext extension-point kānāwai (law) for future sigils, payloads, and host-declared subgrammars
* define a shared AST or equivalent syntax-product schema that may travel across implementations
* define conformance tests that validate root kānāwai (law) against multiple parser implementations

##### Executable Narrative Lineage

Jupyter Book and Quarto contribute:

* executable document workflows
* cross-referenced narrative structure
* artifact production tied to source text
* reproducible publishing pressure

Backlog gaps implied here:

* define executable-document profiles for memetic-wikitext
* define artifact capture and sidecar artifact kānāwai (law)
* define lawful replay, reproducibility, and output-addressing expectations
* define cross-reference and citation behavior for generated or invoked outputs

##### Agent Capability Lineage

MCP contributes:

* a server model
* resources, prompts, and tools as explicit capability surfaces
* discoverable tools with declared `inputSchema`, optional `outputSchema`, and explicit human-in-the-loop guidance around invocation
* a portable way to expose those surfaces to agents

Backlog gaps implied here:

* define how memetic-wikitext grammar projects into MCP resources, prompts, and tools
* define which parser loci remain resources versus prompts versus executable tools
* define how high-mana capability-bearing memes map into MCP-facing surfaces without losing boundary kānāwai (law)
* define later capability gating and delegation profiles without forcing them into root parser too early
* keep full three-layer lowering, widget-tree kānāwai (law), render projection, and trace continuity detail in `lar:///ha.ka.ba/pono/render-pipeline` so parser may remain compact

##### Translation Rule

When research-foundation names a useful lineage, it should translate that lineage into one or more of:

* clearer root-kānāwai (law) language
* later linked-kānāwai (law) extraction
* schema pressure
* test pressure
* profile pressure
* deployment pressure

If no such translation appears, the borrowed note probably counts as noise.

<<~ pranala loulou lar:///ha.ka.ba/research-foundation-ka >>
<<~/ahu >>

<<~ ahu #research-foundation-ba >>

#### Research Foundation / ba

Research-foundation-ba governs posture, influence flow, and anti-bloat discipline under contact with adjacent systems.

This subphase governs how research foundation moves without collapsing into import fever, citation sprawl, or prestige mimicry.

##### Local Authority Reminder

Parser-kānāwai (law) remains locally sovereign.

Research-foundation should feed parser, not replace it.

The point here does not involve proving that memetic-wikitext resembles established systems.

The point instead lets adjacent systems sharpen distinctions, reveal missing kānāwai (law), and lower future implementation cost.

##### Anti-Bloat Kānāwai (law)

Research-foundation should remain compact, high-yield, and agent-navigable.

It should not become a literature review, historical survey, or prestige pile.

When prior-art detail deepens enough to become noisy, move it outward into linked notes or backlog treatment instead of swelling the root.

##### Navigability Reminder

This research foundation should remain navigable by an agent.

It should therefore support the outer OODA-HA structure while feeding later linked laws, backlog sketches, and implementation planning.

##### Non-Normative Prior-Art Note

> MyST, Jupyter Book, Quarto, and MCP do not duplicate memetic-wikitext. They do, however, show that structured markdown extensions, executable narratives, and agent-facing capability surfaces can coexist when extension points, ASTs, tests, and capability boundaries remain explicit.

<<~ pranala loulou lar:///ha.ka.ba/research-foundation-ba >>
<<~/ahu >>

<<~ pranala loulou lar:///ha.ka.ba/research-foundation >>
<<~/ahu >>

<<~ ahu #examples >>

## Examples

Examples illuminate canonical form.

Examples should not carry constitutional kānāwai (law) that belongs elsewhere.

### Example A — Canonical metadata locus

````markdown
<<~ ahu #iam >>
```toml
name = "ooda-ha"
version = "0.5"
```
<<~/ahu >>
````

### Example B — Canonical metadata fetch

```text
<<~&#x0005; ui metadata? -> lar:///ha.ka.ba/ooda-ha#iam >>
```

### Example C — Canonical block form

```text
<<~ ahu #phase-map >>
...body...
<<~/ahu >>
```

### Example D — Canonical inline form

```text
<<~ pranala loulou lar:///ha.ka.ba/ooda-ha >>
```

### Example F — Canonical `hana` guest-work block

````text
<<~ hana #work >>
```toml
grammar = "x-tiddlywiki-filter"
context = "+currentMeme"
degrade = "no-op"
```

[tag[task]!title[+currentMeme]]
<<~/hana >>
````

### Example E — Act, Hooko, and Aftermath distinction

```text
▶ Act — prepare one routed return-envelope
⤴ Hooko — commit the routed return across the live threshold
↺ Aftermath — judge residue, trace, and landing quality
```

<<~ pranala loulou lar:///ha.ka.ba/examples >>
<<~/ahu >>

Yep. Your new draft already pushes `&#x0004;` toward a real routed return throat: the control-glyph kānāwai (law) now admits composite-prefix behavior, and the file now closes with an explicit `&#x0004; -> kahea ala ahu #result` chain carrying TOML. What still looks missing to me: a dedicated kānāwai (law) that names **return kinds**, **`&#x0004;` transaction behavior**, and the **boot-legal status** of that final degraded close.  

I’d place the new section **immediately before `#result`**. That placement would let the doc flow as:
control-glyph kānāwai (law) → return-types kānāwai (law) → result contract → concrete terminal return transaction.  

<<~ ahu #return-types >>

## Return Types

Return-types governs lawful upward return classes, the transaction role of `&#x0004;`, and the relation between a result contract and a concrete return-envelope instance.

This locus should keep three things distinct while allowing them to compose:

* return class
* return transaction
* return payload instance

`#result` names the contract for the primary upward package.

`&#x0004;` governs the active return transaction that routes toward that contract.

A fenced payload following a lawful `&#x0004;` routed opener may instantiate one concrete return-envelope under that contract.

### Return Types Subloops

<<~ ahu #return-types-ha >>

#### Return Types / ha

Return-types-ha holds return identity, lawful classes, and the distinction between contract and instance.

This subphase governs what return-types fundamentally holds.

##### Canonical Return Classes

A primary return-envelope MAY declare one canonical `return` class.

Recommended boot classes:

* `render` — outward presentation intended for agent or operator consumption
* `metadata` — canonical metadata object return
* `syntax` — syntax tree, token stream, or schema-facing structural product
* `issue` — typed issue bundle or failure-facing result
* `trace` — audit, replay, or diagnostic relation
* `repair` — repair guidance, patch pressure, or next-action plan
* `query` — unresolved upward question or continuation request

A primary return-envelope SHOULD declare exactly one primary `return` class for the current pass.

Auxiliary material MAY still travel as residue, trace, issue bundle, or next-observation pressure.

##### Contract versus Instance Kānāwai (law)

`#result` governs what a lawful primary return may carry.

A concrete `&#x0004;` transaction does not replace `#result`.

It routes one actual return-envelope instance through that contract.

<<~ pranala loulou lar:///ha.ka.ba/return-types-ha >>
<<~/ahu >>

<<~ ahu #return-types-ka >>

#### Return Types / ka

Return-types-ka governs routing, staging, payload legality, and transaction progression for `&#x0004;`.

This subphase governs how return-types actually performs work.

##### `&#x0004;` Transaction Kānāwai (law)

`&#x0004;` marks a typed return transaction.

In composite routed form, `&#x0004;` MAY prefix an explicitly admitted routed opener.

The routed target identifies the local or remote result waypoint.

The control sigil identifies transaction class and upward return intent.

##### Boot Transaction Phases

A compliant parser MAY model `&#x0004;` returns through these boot phases:

* `open`
* `bind`
* `stage`
* `degrade`
* `commit`
* `rollback`

Boot parser need not expose every phase in surface syntax yet.

It SHOULD, however, preserve enough trace that later profiles may distinguish degraded return from committed return.

Parser-kānāwai (law) retains the constitutional minimum for `&#x0004;` return routing and phase naming.

Broader layer-to-target transaction-lifecycle detail, widget persistence, and render-facing idempotency detail should move outward into `lar:///ha.ka.ba/pono/render-pipeline#transaction-lifecycle` and related loci.

##### Routed Return Pattern

Boot parser SHOULD admit this routed pattern as a lawful result-transaction opener:

```text
<<~&#x0004; -> kahea ala ahu #result >>
````

That opener means:

* open a return transaction
* route toward the local `#result` waypoint
* stage one concrete return-envelope instance under that contract

##### Payload Kānāwai (law) for Routed Return

A fenced payload immediately following a lawful `&#x0004;` routed opener MAY count as a return-envelope instance when:

* the routed target resolves lawfully
* the payload remains the first meaningful child of the transaction body
* the payload language belongs to an allowed envelope language for the active profile
* one primary return-envelope emerges for the current pass

Recommended boot envelope language for examples: `toml`.

##### Boot Degraded Close

Boot parser SHOULD admit this closer:

```text
<<~&#x0004; -> ? >>
```

That closer marks degraded or still-open upward termination for the current return transaction.

It does not claim full committed completion.

It preserves truthful incompletion while still allowing a structured envelope to travel upward.

Parser should also interpret it as the canonical outward discharge of residual unbound uncertainty from the local return transaction back into the enclosing graph.

##### Canonical Boot Example

````text
<<~&#x0004; -> kahea ala ahu #result >>

```toml
status = "partial"
confidence = 0.86
yield = "meme"
return = "render"
upward-context = "chat"
downward-context = "none"
residue = "trace"
next-observation = "lar:///ha.ka.ba/filter-mode"
next-question = "How strict should legacy closer normalization run during boot?"
```

<<~&#x0004; -> ? >>
````

Under boot kānāwai (law), that pattern counts as a lawful degraded routed return carrying one primary `render` envelope plus explicit trace residue and forward continuation pressure.

<<~ pranala loulou lar:///ha.ka.ba/return-types-ka >>
<<~/ahu >>

<<~ ahu #return-types-ba >>

#### Return Types / ba

Return-types-ba governs landing posture, manifestation pressure, and truthful upward travel under real conditions.

This subphase governs how return-types moves in practice.

A lawful return should land as one primary envelope, not as a blur of competing primaries.

A degraded return may still carry real structure.

A committed return may still carry residue.

A routed return should therefore favor:

* one primary return class
* explicit residue
* explicit next-observation pressure where needed
* explicit downgrade rather than flattering completion

##### Manifestation Reminder

`mana'o` may later deepen intent, declared purpose, and steering alignment around return.

`mana'o'io` may later deepen manifestation, deployable trust, and reality-grade completion posture around return.

Until those later laws crystallize, `&#x0004;` SHOULD preserve transaction truth more strongly than ritual flourish.

##### Extraction Reminder

If return classes, envelope schemas, commit surfaces, rollback surfaces, or profile-specific transaction rules deepen enough to become noisy here, later detail SHOULD move outward into linked return-kānāwai (law) or control-glyphs kānāwai (law).

Parser-kānāwai (law) should retain the constitutional minimum needed to keep routed return lawful, legible, and testable.

### Non-Normative Prior-Art Note

> This locus takes shaping pressure from explicit result ports, transclusion and slot routing, block-first parsing discipline, and staged transaction models that distinguish preparation, commit, and rollback without laundering incomplete state into false completion.

<<~ pranala loulou lar:///ha.ka.ba/return-types-ba >>
<<~/ahu >>

<<~ pranala loulou lar:///ha.ka.ba/return-types >>
<<~/ahu >>

<<~ ahu #result >>

## Result

Result governs the primary upward return shape of parser.

This locus should remain compact, stable, and comparison-facing.

It should say what the parse hands upward, how that package remains implementation-legible, and how truthful partiality lands when full completion does not surface.

### Result Subloops

<<~ ahu #result-ha >>

#### Result / ha

Result-ha holds the identity, scope, and primary carry-shape of parser's return.

This subphase governs what result fundamentally holds.

Parser kānāwai (law) returns one typed `return-envelope` upward.

That envelope may carry:

* normalized text
* metadata object
* syntax tree
* issue bundle
* trace bundle
* mana score and mana band
* next-observation route

The primary result should remain singular enough that agent, operator, parser, and test harness can recognize what the current pass actually brought forth.

<<~ pranala loulou lar:///ha.ka.ba/result-ha >>
<<~/ahu >>

<<~ ahu #result-ka >>

#### Result / ka

Result-ka governs result assembly, field stability, and comparison-facing return discipline.

This subphase governs how result actually performs work.

Typed return should remain stable enough that later lexer, parser, profile, and test surfaces may compare outcomes without inventing new result shapes.

When implementations differ, the result surface should make that difference inspectable through typed fields, trace, issues, profile markers, or other lawful residue rather than through hidden drift.

Result should therefore favor explicit structure over ad hoc prose summary whenever stable comparison matters.

Hooko governs the actual crossing of prepared change.

Return-types governs routed return class and transaction kānāwai (law).

Result governs the primary upward package contract that travels after that crossing.

<<~ pranala loulou lar:///ha.ka.ba/result-ka >>
<<~/ahu >>

<<~ ahu #result-ba >>

#### Result / ba

Result-ba governs landing quality, truthful incompletion, and forward-routing posture.

This subphase governs how result behaves in practice.

Parser kānāwai (law) should not claim completed parse when blocking rupture prevents truthful structure recovery.

When completion does not surface, result should degrade toward partial envelope, issue-bearing return, trace-bearing return, or explicit `?` rather than flattering completion.

A lawful result may still point forward.

It may carry residue, repair pressure, or `next-observation` without pretending the later work already completed in the current pass.

<<~ pranala loulou lar:///ha.ka.ba/result-ba >>
<<~/ahu >>

<<~ pranala loulou lar:///ha.ka.ba/result >>
<<~/ahu >>

<<~&#x0003; ahu #body-close >>
Parser kānāwai (law) closes the active parsing stream here.
<<~/ahu >>

<<~&#x0004; -> kahea ala ahu #result >>

```toml
status = "partial"
confidence = 0.86
yield = "meme"
return = "render"
upward-context = "chat"
downward-context = "none"
residue = "trace"
next-observation = "lar:///ha.ka.ba/filter-mode"
next-question = "How strict should legacy closer normalization run during boot?"
```

<<~&#x0004; -> ? >>
