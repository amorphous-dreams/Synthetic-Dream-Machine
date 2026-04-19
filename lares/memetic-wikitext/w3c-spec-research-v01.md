# W3C and Adjacent Spec Research for Memetic Sigils v5

Status: [I:0.91] [S:0.93] [R:0.85] — rebuilt research note
for reviewer-facing hardening on 2026-04-12.
Scope: TiddlyWiki lineage, W3C syntax and document-model
discipline, IETF normative style, schema authority boundaries,
and agent protocol expectations most relevant to
`memetic_sigils_v4_draft.md`.

---

## 0. Confidence Field

This note now uses the same confidence logic as the current
memetic sigil draft, but applied to research quality rather than
runtime potency:

- **Intent confidence** `[I:0.0-1.0]`: how clear and justified the
  recommendation is
- **Structure confidence** `[S:0.0-1.0]`: how well the document is
  organized, sourced, and review-ready
- **Review confidence** `[R]`: `I x S`, interpreted as how safely
  this note can drive the `v5` rebuild

Current reading:

- `[I:0.91]` because the main recommendation is now stable across
  the source set: do not pose memetic sigils as HTML, ground them
  in TiddlyWiki lineage, and adopt XML/XHTML-style discipline for
  well-formedness and conformance
- `[S:0.93]` because the document is now organized by review seam
  rather than by source accumulation
- `[R:0.85]` because a few seams remain version-sensitive or local
  rather than inherited from a standards body

### 0.1 Where confidence is still lower

Residual uncertainty does not come from the core W3C story.
It comes from local extensions and moving adjacent ecosystems:

- TiddlyWiki `Functions` and prerelease run-prefix evolution are
  highly relevant, but some cited material sits on prerelease or
  recently added behavior
- MCP and OpenAPI version pages are live and may change after this
  pass
- the memetic sigil language still lacks its own canonical media
  type, so fragment semantics can only be recommended, not yet
  fully registered
- no standards body currently defines the memetic meaning of the
  local Devanagari authority layer, so those semantics must remain
  explicitly local

Interpretive rule:

- high confidence is appropriate where multiple official sources
  agree
- medium confidence is appropriate where the analogy is strong but
  still local
- low confidence is appropriate where the current draft relies on
  aspiration more than cited precedent

---

## 1. Research Objective

The purpose of this note is not to make memetic sigils look more
academic by adding more citations.

Its purpose is narrower and harder:

1. identify what existing standards and official docs actually
   support
2. identify where the current `v4` draft is already aligned with
   strong precedent
3. identify where the draft is still overclaiming, underspecified,
   or structurally vague
4. turn those findings into a rebuild plan for a `v5` spec that a
   W3C-style reviewer, protocol reviewer, or agent-systems
   implementer can audit without guessing

This pass therefore prefers:

- primary sources over secondary commentary
- direct claims over atmospheric analogy
- narrower correct statements over broader poetic ones

---

## 2. High-Confidence Verdict

Status: [I:0.95] [S:0.94] [R:0.89]

The strongest reviewer-facing position is now clear:

1. **Nearest live ancestor:** memetic sigils descend most directly
   from TiddlyWiki's transclusion runtime, not from HTML.
2. **Host-language claim:** memetic sigils SHOULD be described as a
   custom markup / transclusion language with its own grammar, not
   as an extension of ordinary HTML syntax.
3. **Structural discipline:** XML and XHTML provide the right model
   for well-formedness, nesting, closure, quoting, and conformance
   language.
4. **Fragment semantics:** W3C fragment guidance requires fragment
   meaning to be tied to a representation or media type, not just
   to a URI scheme.
5. **Normative style:** RFC 8174 plus W3C QA guidance supply the
   right discipline for `MUST`, `SHOULD`, `MAY`, conformance
   classes, and claims.
6. **Machine-readable artifacts:** JSON Schema and OpenAPI show the
   correct authority split: prose remains primary; schemas and
   validators are valuable but subordinate.
7. **Runtime rigor:** JSON-RPC and MCP show how to specify runtime
   packets, capability negotiation, consent, and safety without
   leaving behavior to folklore.

Short version:

- for lineage honesty: start from TiddlyWiki
- for syntax rigor: look more like XML/XHTML than HTML
- for fragment rigor: define a representation model
- for spec rigor: add conformance, terminology, grammar, and error
  handling
- for runtime rigor: define packet shapes, capability boundaries,
  and refusal/error behavior

---

## 3. Source Discipline and Version Notes

Status: [I:0.90] [S:0.94] [R:0.85]

This pass uses primary official sources only.

### 3.1 Source families used

- TiddlyWiki official stable docs, primarily v5.3.8 pages
- TiddlyWiki official prerelease docs where the feature itself is
  version-sensitive
- W3C Recommendations and Notes
- RFC Editor text for RFC 8174
- official JSON-RPC specification
- official TOML v1.0.0 specification
- official JSON Schema specification page
- official OpenAPI specification versions page
- official Model Context Protocol specification page

### 3.2 Version-sensitive facts verified in this pass

- TiddlyWiki procedures are documented as new in `v5.3.0`
- TiddlyWiki functions are documented on the prerelease site and
  marked new in `v5.3.0`
- TiddlyWiki prerelease docs show `:let` / `=>[run]` as new in
  `v5.4.0`
- OpenAPI official materials currently list `v3.2.0` as the
  latest published version, and the `v3.2.0` specification states
  that specification text wins over JSON Schema on disagreement
- the MCP specification page currently resolves to
  `2025-11-25` and labels that version as latest
- JSON Schema official release notes currently list `2020-12` as
  the most recent published draft, and the official specification
  page still presents the split between Core and Validation

### 3.3 Interpretation boundary

This note treats the following as strong evidence:

- direct wording from official standards and official TiddlyWiki
  docs
- stable versioned pages where available
- current official version indexes where the question is
  explicitly version-sensitive

This note does not treat as authoritative:

- forum explanations
- personal blog summaries
- secondary AI summaries

---

## 4. TiddlyWiki Lineage: What Is Actually Inherited

Status: [I:0.96] [S:0.95] [R:0.91]

This is the strongest section of the argument.
The source support here is direct.

### 4.1 Transclusion is the primary ancestry

Official TiddlyWiki material defines transclusion as a core means
of including one document fragment within another by reference.
At the WikiText surface:

- `{{Tiddler}}` transcludes a single tiddler
- `{{Tiddler!!field}}` transcludes a field
- `{{Target||Template}}` displays a tiddler through a template
- `{{||Template}}` displays a template without altering the
  current tiddler
- `{{{ [filter] }}}` generates/transcludes all items matched by a
  filter

Research consequence:

- memetic sigils should claim descent from **transclusive text
  composition**
- the best local analogue for `kahea` is not generic macro text
  substitution; it is TiddlyWiki's addressed transclusion surface

### 4.1.1 TiddlyWiki defines grammar operationally, not as one closed EBNF

This is an important precision point.

TiddlyWiki does define its language explicitly, but not primarily
by publishing one monolithic formal grammar file in the style of
XML, RDF, or PROV-N.

Instead, the official parser and developer documentation define
WikiText through an operational grammar model:

- the first stage of processing is a parser that transforms text
  into a parse-tree
- the core provides a **recursive descent WikiText parser**
- that parser loads its individual rules from separate
  `module-type: wikirule` modules
- wikirule modules are explicitly typed as `pragma`, `block`, or
  `inline`
- each rule module encapsulates the logic of an individual parsing
  rule
- rule modules provide matching and parse behavior through methods
  such as `findNextMatch()` and `parse()`

The public WikiText docs describe the same language from the user
side through parser modes:

- the parser has three modes: `pragma`, `block`, and `inline`
- different punctuation is recognized depending on the current
  mode
- the parser transitions between these modes based on the text it
  encounters
- transclusion, macro calls, widgets, and HTML tags can affect the
  active parse mode

Research consequence:

- TiddlyWiki's "grammar" is real, but it is **modular,
  mode-sensitive, and parser-defined**
- the language is specified by the interaction of parsing rules,
  not just by a static symbol table
- this is a very strong precedent for memetic sigils because your
  draft also has mode-like distinctions, layered constructs,
  callable objects, and a document-space to runtime-space lowering

The right lineage statement is therefore slightly sharper than the
earlier draft:

> Memetic Sigil Wikitext inherits not only TiddlyWiki's
> transclusion features, but also its style of language
> definition: a parseable text surface described through explicit
> parser phases, rule classes, and structural lowering into a
> runtime-interpretable tree.

What should not be claimed:

- do not say TiddlyWiki already gives you a complete reviewer-ready
  formal grammar in the W3C sense
- do not say TiddlyWiki has no explicit grammar

The accurate middle statement is:

- TiddlyWiki defines WikiText **explicitly and operationally**
  through parser architecture, parser modes, and rule modules
- memetic sigils can honestly claim that lineage while still
  needing a more formal reviewer-facing grammar of its own in `v5`

### 4.2 Templates are context-sensitive masks

The official template page gives the clearest bridge.
It states that `{{||A}}` applies template `A` to the current
tiddler, and that generic text references inside the template are
resolved against the target/current tiddler rather than the
template source. TiddlyWiki describes this as "applying a mask".

The developer documentation explains the same behavior more
operationally:

- a transclude widget includes another tiddler's content
- by default it does not change the current tiddler
- that non-switching behavior is what enables templates

Research consequence:

- the strongest bridge from TiddlyWiki into memetic sigils is
  **context-sensitive masked transclusion**
- this is a better foundation for your view/procedure/function
  story than the weaker phrase "macro syntax"

### 4.3 Generated widgets show the lowering model

The official "Transclusion in WikiText" page explicitly shows that
surface notation lowers into widgets:

- `{{MyTiddler||TemplateTitle}}` generates a `TiddlerWidget`
  containing a `TranscludeWidget`
- `{{{ [tag[mechanism]] }}}` generates a `ListWidget`
- `{{{ [tag[mechanism]]||TemplateTitle }}}` generates a
  `ListWidget` that applies a transclusion template for each match

Research consequence:

- this is a strong precedent for a two-stage model:
  document notation --> structural lowering --> runtime realization
- the current memetic sigil document-space / runtime-space split is
  therefore grounded, not invented from whole cloth

### 4.4 Hard vs soft transclusions map cleanly to edge visibility

TiddlyWiki now explicitly distinguishes hard and soft
transclusions:

- hard transclusions are detectable by superficial WikiText
  inspection
- soft transclusions can be hidden in transcluded text,
  procedures, variables, or dynamically generated transclude
  widgets
- transclusion-related filter operators do not detect soft cases

Research consequence:

- your visible vs latent meme-edge distinction has a direct
  TiddlyWiki precedent
- the spec should present this as an inherited runtime-analysis
  distinction, not as mystical metaphor

### 4.5 Recursion and self-reference are already a documented error seam

The official basic usage page states that `{{!!text}}` or `{{}}`
causes a "Recursive transclusion error in transclude widget"
because it attempts to include the current tiddler into itself.
The page also states that indirect cycles produce the same class
of failure.

Research consequence:

- memetic sigils should define direct and indirect recursion
  failures explicitly
- candidate local parallels include self-targeting `ahu`,
  recursive wrapper re-entry, and cyclic `kahea` graphs

### 4.6 Cascades are first-match rule stacks

The official cascade page is important because it states the
actual selection rule:

- cascades are a list of conditions evaluated in turn
- order comes from tagged-tiddler ordering
- each rule is a filter expression
- the input title and `currentTiddler` are set to the tiddler
  being considered
- empty results are ignored
- the first non-empty result becomes the cascade result

The same page also states that the core uses cascades to choose,
among other things:

- story template
- title template
- body template

Research consequence:

- your "choose a rendering mask by rule stack" intuition is
  directly TiddlyWiki-native
- `kahea --> filter://cascade...` is not an arbitrary detour; it is
  conceptually aligned with existing TiddlyWiki selection
  machinery

### 4.7 Filters are a pipeline algebra

The official filter syntax page states:

- a filter is a pipeline transforming an input to an output
- inputs and outputs are ordered sets of titles/fields
- filters are built from runs and steps
- runs are processed left to right

The filter parameter page sharpens the parameter model:

- hard parameters: `[]`
- indirect text-reference parameters: `{}`
- variable parameters: `<>`

The named run-prefix pages sharpen the execution model further:

- named run prefixes were introduced in `v5.1.23`
- they can appear in place of shortcut prefixes
- stable docs include `:filter`, `:map`, `:reduce`, `:sort`,
  `:cascade`
- within `:reduce`, `:sort`, `:map`, and `:filter`, the
  `currentTiddler` variable is rebound to the current item
- prerelease docs add `:let` / `=>[run]` as new in `v5.4.0`

Research consequence:

- TiddlyWiki is already a context-sensitive transformation
  language, not only a notation for selecting tiddlers
- the agentic-wikitext direction is therefore continuous with a
  live upstream trajectory

### 4.8 Procedures and functions make `<< >>` a callable layer

Official TiddlyWiki pages now support a stronger claim than older
macro language:

- procedures are named snippets of text, documented as new in
  `v5.3.0`
- procedures are called with `<<name ...>>`
- procedure-call shortcut syntax expands to `$transclude` with a
  `$variable` attribute
- functions are named snippets containing a filter expression
- functions can be called with `<<myfun ...>>`
- functions can be called with `[function[myfun],...]`
- functions whose names contain a period can be called as custom
  filter operators like `[my.fun[value]]`

Research consequence:

> The strongest TiddlyWiki bridge into memetic sigils is not
> "macro syntax". It is that TiddlyWiki already treats text as a
> parseable, callable, context-sensitive transclusion runtime.

### 4.9 What this means for the `v5` spec

The lineage claim for `v5` should now be explicit:

- transclusion from TiddlyWiki
- templated current-context masking from TiddlyWiki
- rule-based cascade selection from TiddlyWiki
- filter-pipeline semantics from TiddlyWiki
- callable `<< >>` objects from TiddlyWiki procedures/functions

Recommended sentence:

> Memetic Sigil Wikitext is a custom transclusive text-runtime
> language whose nearest live practical ancestor is TiddlyWiki.
> Its document form is parsed into a structural tree and then
> interpreted into runtime formations, analogous in spirit to
> TiddlyWiki's WikiText --> parse-tree --> widget-tree model.

### 4.10 Confidence boundary

One analogy should still be kept at medium confidence rather than
high:

- bare `kahea` as a direct analogue to TiddlyWiki transclusion is
  strong
- arrowed `kahea` as a direct analogue to a single TiddlyWiki
  feature is only medium confidence

Why:

- arrowed `kahea` currently bundles several ideas at once:
  template application, procedure call, function application, and
  cascade-driven realization
- TiddlyWiki clearly supports all of those pieces, but not under a
  single surface form identical to your arrow syntax

Recommendation:

- say "closest analogue" or "inherits from this family of
  operations"
- do not say "this is already TiddlyWiki syntax"

---

## 5. W3C Structural Model: What to Borrow

Status: [I:0.95] [S:0.93] [R:0.88]

W3C does not provide the memetic semantics.
What it provides is the review discipline.

### 5.1 XML gives the right design temperament

The XML 1.0 Recommendation states design goals that are directly
useful here:

- optional features should be kept to an absolute minimum
- documents should be human-legible and reasonably clear
- the design should be formal and concise

It also defines well-formedness in an implementation-relevant way:

- an XML document is well-formed if it matches the grammar and the
  well-formedness constraints
- violations of well-formedness constraints are fatal errors

Research consequence:

- the memetic sigil spec should inherit XML's seriousness about
  grammar, closure, and fatal malformedness
- "formal and concise" is a better north star than "ornate and
  suggestive" for the normative layer

### 5.2 XHTML gives the clearest structural checklist

XHTML 1.0 remains useful not because the language should become
XHTML, but because the document makes the migration from tolerant
HTML culture to strict XML culture concrete.

XHTML states:

- documents must be well-formed
- elements must nest properly
- non-empty elements require end tags
- attribute values must always be quoted
- element and attribute names use lower case in XHTML

Research consequence:

- the memetic sigil spec should adopt XHTML-style discipline for
  its own syntax even if the syntax is not XML
- the core lesson is not "be lowercase"
- the core lesson is "be explicit enough that overlap,
  untermination, and ambiguity are not normal"

### 5.3 Namespaces in XML should be treated as an analogy, not an identity

The Namespaces in XML Recommendation defines namespace behavior in
terms of:

- scoped declarations
- URI-bound namespace names
- local parts
- expanded names

Research consequence:

- if the draft uses the word "namespace" for the local Devanagari
  authority layer, it must not imply that those sigils are already
  XML namespace declarations
- XML namespaces are URI-bound expanded-name machinery
- the memetic layer is currently a local authority / qualification
  system inspired by namespace behavior, not the same thing

Recommended phrasing:

> The Devanagari namespace layer is local and specification-defined.
> It is analogous in purpose to namespace qualification, but it is
> not claimed to implement XML Namespaces semantics unless and
> until the specification defines URI-bound expanded-name behavior.

### 5.4 HTML is the wrong host model

The HTML syntax specification is useful for character references
and for understanding foreign-content parsing, but it is not the
right mental model for the memetic sigil grammar.

Why:

- HTML syntax is a parser-specific language with historical error
  recovery behavior
- it includes special handling for certain namespaced foreign
  attributes like `xml:lang`, `xmlns`, and `xmlns:xlink`
- that is not equivalent to general XML namespace-declaration
  semantics

Research consequence:

- the spec should not present memetic sigils as ordinary HTML
  syntax with exotic tags
- the cleaner claim is "custom markup language with XML/XHTML-like
  well-formedness discipline"

### 5.5 Character references: what is safe to inherit

HTML 5.1 states that:

- decimal numeric character references are `&#` + digits + `;`
- hexadecimal numeric character references are `&#x` + hex digits
  + `;`
- the semicolon is required in the syntax
- ambiguous ampersands and missing semicolons become parse-error
  territory

XML 1.0 likewise defines:

- `CharRef ::= '&#' [0-9]+ ';' | '&#x' [0-9a-fA-F]+ ';'`

Research consequence:

- the current preference for decimal NCRs in document-space
  examples is defensible
- the final spec should require semicolon-terminated NCR forms in
  normative examples
- the spec should distinguish clearly between:
  rendered glyph layer, NCR authoring layer, and raw Unicode
  storage layer

### 5.6 What not to borrow from W3C

W3C sources do **not** tell you:

- what a meme is
- what Mana means
- what `ahu` means
- how an arrowed `kahea` should execute
- what the Devanagari authority layer means

Research consequence:

- borrow W3C for structure and review method
- do not claim W3C authority for local symbolic semantics

### 5.7 Formal Grammar Notation: XML-style EBNF fits best

There is now enough precedent to make a confident notation
recommendation.

PROV-N is especially useful here because it is not merely a data
model document. It is a W3C notation spec for a human-readable,
machine-parseable syntax. The Recommendation states that:

- PROV-N is "defined through a formal grammar amenable to be used
  with parser generators"
- compliance can explicitly distinguish normative productions from
  informative convenience files
- the grammar is specified using a subset of EBNF as defined in
  XML notation

RDF 1.2 N-Triples shows the same family resemblance from another
angle:

- the specification uses XML-defined EBNF
- it pairs grammar productions with parsing and conformance
  sections
- it also publishes a separate text version of the grammar

RFC 5234 ABNF remains important, but its center of gravity is
different:

- ABNF is excellent for network protocols, byte-oriented lexical
  formats, and compact Internet-syntax descriptions
- ABNF rule naming, repetition, alternatives, and value ranges are
  ideal when the main problem is transport syntax
- ABNF is not the most natural match for a visibly nested,
  transclusive document language whose review audience is already
  primed by W3C grammar culture

Research consequence:

- the main memetic sigil language spec should use **XML-style
  EBNF** for its document grammar
- if a later profile needs stricter transport-level tokenization,
  line framing, or low-level interchange constraints, an **ABNF
  appendix or side artifact** may still be useful
- but ABNF should not displace EBNF as the primary reader-facing
  grammar notation

Specific recommendation for `v5`:

1. declare a `Grammar Notation` subsection near the front of the
   language definition
2. state that the grammar uses a subset of XML-style EBNF
3. mark productions in the main spec as normative
4. if a standalone grammar file is shipped, state whether it is
   normative or merely a convenience export
5. add a short terminal-literal table for critical sigil strings
   and NCR-sensitive delimiter characters

This choice has the highest Manaʻoʻiʻo for reviewer-facing work
because it aligns:

- with W3C notation practice
- with document-language readability
- with parser-generator friendliness
- with your existing need to distinguish syntax, processing model,
  and runtime semantics rather than collapsing them into one layer

---

## 6. Fragment Semantics and Representation Model

Status: [I:0.94] [S:0.92] [R:0.86]

This remains the highest-risk W3C review seam.

### 6.1 What the W3C fragment note actually says

The W3C fragment best-practices note states:

- fragment identifiers are interpreted based on the media type of
  the retrieved representation
- fragment identifier semantics are independent of the URI scheme
- individual media types may define their own fragment structures
  and restrictions

Research consequence:

- fragment semantics cannot be justified solely by saying
  `lar:///...#fragment`
- the spec must define fragment meaning for a specific
  representation

### 6.2 What the memetic sigil draft needs to say

The final spec needs an explicit sentence of the form:

> The fragment semantics defined here apply to the Memetic Sigil
> Wikitext representation defined by this specification.

Then it needs a local fragment grammar.

Candidate local split:

- string fragments target `ahu` identifiers
- fixed-slot die-face fragments target Chronometer state

### 6.3 Why the current draft still has medium risk

Current risk remains because:

- the language does not yet declare a canonical media type
- documents may appear in Markdown, plain text, generated HTML, or
  editor-local forms
- without a canonical representation statement, fragment semantics
  still look ad hoc to a W3C reviewer

### 6.4 Recommendation for `v5`

Add all four of these:

1. a representation statement
2. a fragment grammar
3. error handling for unresolved fragments
4. a distinction between canonical and convenience serializations

Low-ambiguity wording:

> Fragment identifiers are interpreted relative to the Memetic
> Sigil Wikitext representation. A string fragment identifies an
> `ahu` target within the addressed meme body. A Chronometer
> fragment identifies a five-slot phase/state address as defined in
> Section X. If the addressed representation is not Memetic Sigil
> Wikitext, these fragment semantics do not apply unless that
> representation explicitly adopts them.

---

## 7. Conformance Model and Normative Style

Status: [I:0.97] [S:0.94] [R:0.91]

This is the clearest spec-quality gap between the current draft
and a reviewer-ready `v5`.

### 7.1 What W3C QA guidance requires

The QA Framework specification guidelines state:

- a conformance clause is essential
- the conformance clause should be the root source for finding
  conformance-related information
- scope should be defined
- normative references should be listed clearly
- terms used in normative parts should be defined
- error handling should be defined
- wording for conformance claims should be provided

Research consequence:

- the current memetic sigil draft is still closer to a visionary
  draft than a conformance-grade specification
- that is fixable, but only by adding explicit spec structure

### 7.2 RFC 8174 discipline is the minimum bar

RFC 8174 states that the BCP 14 keywords are interpreted as such
only when they appear in all capitals.

Research consequence:

- the `v5` spec should include the standard BCP 14 boilerplate
- lowercase "must", "should", and "may" in descriptive sections
  should not carry normative force unless explicitly defined

### 7.3 Conformance classes the spec should define

Recommended classes of products:

1. **conforming document**
   A memetic sigil document that satisfies the local grammar and
   all applicable well-formedness constraints.
2. **conforming parser/processor**
   A processor that detects malformedness, exposes the required
   structure, and reports required errors.
3. **conforming runtime**
   A runtime that implements required evaluation, authority, and
   refusal behavior.
4. **conforming authoring tool**
   A tool that preserves canonical syntax and does not silently
   corrupt required structure.

If that is too broad for `v5`, reduce it.
But do not leave "what conforms?" unanswered.

### 7.4 Conformance claims should be templated

W3C QA guidance recommends providing wording for conformance
claims.

Recommended local template:

> On [date], [product name and version] claims conformance as a
> [conformance designation] to Memetic Sigil Wikitext
> Specification v0.5, available at [canonical URI].

### 7.5 Normative/informative separation should be explicit

The final spec should label:

- prose requirements as normative
- formal grammar as normative
- examples as informative unless marked otherwise
- schemas, validators, and lint rules as informative or
  subordinate normative adjuncts, with precedence stated

### 7.6 Error handling must become first-class

W3C QA guidance is direct here:
for a language, define what syntactic and semantic errors do to a
processor.

The memetic sigil spec therefore needs a real error-handling
section, not scattered mentions.

Minimum error classes:

- malformed sigil syntax
- illegal nesting / overlap
- duplicate or conflicting lifecycle markers
- unresolved `ahu`
- recursive `kahea`
- authority escalation attempts
- invalid fragment grammar
- invalid active target resolution

For each, define:

- detection point
- strict-mode behavior
- permissive-mode behavior if any
- whether processing may continue

---

## 8. Machine-Readable Artifacts and Authority Boundaries

Status: [I:0.92] [S:0.92] [R:0.85]

The current draft already leans toward stricter machine-readable
side artifacts.
That instinct is correct, but the authority hierarchy must be
stated.

### 8.1 TOML is a defensible metadata choice

The TOML v1.0.0 specification states that TOML aims to be:

- a minimal configuration format
- easy to read due to obvious semantics
- unambiguous in mapping to a hash table
- easy to parse in many languages
- UTF-8 encoded

Research consequence:

- preferring TOML over ad hoc JSON blobs for human-agent-readable
  metadata is reviewer-defensible
- the spec should define exactly where TOML is permitted and how it
  is delimited from surrounding document syntax

### 8.2 JSON Schema shows the right spec layering

The JSON Schema specification page states that the specification is
split into:

- Core
- Validation

and also publishes meta-schemas.

Research consequence:

- the memetic sigil family should be layered similarly:
  core syntax, validation/error rules, optional metadata
  vocabulary, optional runtime vocabulary

### 8.3 OpenAPI gives the cleanest authority rule

The OpenAPI `v3.2.0` specification states:

- schemas can catch many errors
- schemas are not guaranteed to catch all specification
  violations
- if schemas and specification text disagree, the specification
  text is presumed correct

Research consequence:

- if `v5` ships a grammar file, schemas, or validators, it must
  explicitly state precedence

Recommended local rule:

1. normative prose and normative grammar win
2. schemas and validators are subordinate
3. examples are informative

### 8.4 Recommended artifact set for `v5`

Minimum:

1. `memetic_sigils_v5.md`
2. `memetic_sigils_grammar.ebnf`
3. `memetic_sigils_examples.md`
4. `memetic_sigils_metadata_examples.toml`

Optional but high value:

5. machine validator or linter
6. implementation conformance checklist
7. fragment grammar appendix
8. transport-profile `.abnf` if later needed for low-level
   interchange or protocol framing

---

## 9. Runtime Object and Protocol Rigor

Status: [I:0.90] [S:0.90] [R:0.81]

This is where adjacent protocol culture matters more than W3C.

### 9.1 JSON-RPC shows compact protocol discipline

The official JSON-RPC 2.0 spec provides a strong model for:

- exact required members
- request vs notification distinction
- parameter structure rules
- response shape
- explicit error objects and codes

Research consequence:

- if memetic sigils produce or drive runtime packets, the spec
  should define them with comparable precision
- "packet-like" objects need named fields, required/optional
  status, and exact failure classes

### 9.2 MCP shows the current agent-protocol baseline

The current MCP specification page states:

- MCP uses JSON-RPC 2.0 messages
- it uses stateful connections
- it includes server and client capability negotiation
- servers may expose resources, prompts, and tools
- clients may expose sampling, roots, and elicitation
- the protocol has explicit security and trust/safety guidance

The same page also states strong safety principles around:

- explicit user consent and control
- data privacy
- tool safety
- sampling controls

Research consequence:

- any memetic sigil runtime section that can trigger tools,
  recursion, sampling, or external effects must include authority
  and consent language
- agentic specs are not only syntax specs

### 9.3 Recommended runtime object categories

If the spec moves beyond pure document syntax, define at least:

1. runtime formation object
2. active call object
3. refusal/error object
4. audit/trace object
5. capability advertisement object

For each:

- required fields
- optional fields
- lifecycle
- error conditions
- security considerations

### 9.4 What remains local rather than inherited

Neither JSON-RPC nor MCP tells you:

- how Mana is computed
- what authority attenuation means in the local glyph model
- how wrapper inheritance should behave

Research consequence:

- use protocol specs for rigor of definition
- do not pretend they already define your symbolic runtime

---

## 10. OODA, OODA-HA, and Historical Precision

Status: [I:0.88] [S:0.91] [R:0.80]

This remains an honesty seam rather than a W3C seam.

The safest reviewer-facing position is:

- Boyd's canonical loop is OODA
- the local runtime extension is OODA-HA
- Assess is a local addition for post-action evaluation and
  checkpointing

Why this matters:

- if the spec implies Boyd already defined Assess, a careful
  reviewer can dismiss the argument as historically sloppy
- if the spec states openly that Assess is a local extension, the
  move is defensible

Recommended wording:

> This specification uses Boyd's OODA cycle as a historical root
> and defines OODA-HA as a local extension for agentic runtimes.
> The Assess phase is not attributed to Boyd; it is added here to
> make explicit the feedback, validation, and scale-shift behavior
> required by tool-using, stateful systems.

---

## 11. Uncertainty Register

Status: [I:0.89] [S:0.94] [R:0.84]

This section exists so the final `v5` spec does not overclaim.

### 11.1 High-confidence claims

- TiddlyWiki is the nearest live practical ancestor
- XML/XHTML discipline is the best review model for structural
  well-formedness
- fragment semantics must be tied to a representation/media type
- conformance, terminology, references, and error handling must be
  explicit
- machine-readable schemas must not silently outrank prose

### 11.2 Medium-confidence claims

- arrowed `kahea` as a unified visible bridge across template,
  procedure, function, and cascade behavior
- the local namespace/authority layer as analogous in purpose to
  XML qualification
- the full mapping from document-space sigils to runtime packets
  unless the packet model is written down formally

### 11.3 Low-confidence or currently unsupported claims

- any claim that memetic sigils are "really HTML"
- any claim that the local namespace sigils already implement XML
  Namespaces semantics
- any claim that fragment semantics are self-justifying without a
  representation statement
- any claim that a poetic alias vocabulary can substitute for
  normative terminology

### 11.4 Version-sensitive caution

Pin versions where the argument depends on recent behavior:

- TiddlyWiki procedures/functions
- TiddlyWiki prerelease `:let`
- MCP latest-version pages
- OpenAPI latest-version pages

If `v5` depends on those behaviors, cite the version explicitly.

---

## 12. Concrete Rebuild Instructions for `v5`

Status: [I:0.96] [S:0.95] [R:0.91]

If the goal is a high-intent, high-structure `v5`, add these exact
sections in roughly this order:

### 12.1 Front matter

1. `Status of This Document`
2. `Scope`
3. `Conformance`
4. `Normative Keywords`
5. `Terminology`
6. `Normative References`
7. `Informative References`

### 12.2 Core language definition

8. `Document Model`
9. `Formal Grammar`
10. `Well-Formedness Rules`
11. `Processing Model`
12. `Transclusion and Call Semantics`
13. `Fragment Semantics`
14. `Serialization and Transport`

### 12.3 Runtime and safety

15. `Authority and Attenuation`
16. `Runtime Objects`
17. `Error Handling`
18. `Security Considerations`
19. `Evaluation and Stopping Conditions`

### 12.4 Machine-readable support

20. `Machine-Readable Artifacts`
21. `Examples`
22. `Conformance Claim Template`

### 12.5 Specific rules worth promoting from the current draft

These are already present in spirit and should become explicit
well-formedness or conformance rules:

- every open formation MUST have a matching close
- nested formations MUST be properly nested
- malformed overlap is an error
- `ahu` identifiers MUST be unique within their declared scope
- unresolved required `ahu` targets are errors in strict mode
- authority attenuation MUST be monotone inward
- active `kahea` target resolution failures MUST produce defined
  error behavior
- recursive inclusion/execution MUST be cycle-detected or
  depth-bounded

---

## 13. Wording Library for the Final Spec

Status: [I:0.93] [S:0.94] [R:0.87]

These sentences are intentionally plain.
They are designed to survive reviewer scrutiny.

### 13.1 Lineage statement

> Memetic Sigil Wikitext is a custom transclusive markup and
> text-runtime language whose nearest live practical ancestor is
> TiddlyWiki.

### 13.2 Non-HTML statement

> Memetic Sigil Wikitext is not the HTML syntax. Its grammar and
> fragment semantics are defined by this specification.

### 13.3 Structural-discipline statement

> The well-formedness model of this specification is informed by
> XML/XHTML discipline, including explicit closure, proper nesting,
> and fatal malformedness.

### 13.4 Fragment statement

> Fragment identifiers are interpreted relative to the Memetic
> Sigil Wikitext representation defined by this document.

### 13.5 Artifact-precedence statement

> In the event of disagreement between this specification's prose,
> formal grammar, and any machine-readable schema or validator, the
> normative prose and normative grammar take precedence unless this
> specification states otherwise.

### 13.6 Local-namespace caution

> The local namespace layer defined here is specification-local and
> is not claimed to implement XML Namespaces semantics unless
> explicitly stated for a future profile.

---

## 14. Source Notes

Primary source takeaways used in this rebuild:

- TiddlyWiki transclusion, template masking, widget lowering,
  recursion errors, parser architecture, parser modes, rule
  modules, hard/soft transclusions, cascades, filters, named run
  prefixes, procedures, and functions:
  https://tiddlywiki.com/static/Transclusion.html
  https://tiddlywiki.com/static/Transclusion%2520in%2520WikiText.html
  https://tiddlywiki.com/static/Transclusion%2520Basic%2520Usage.html
  https://tiddlywiki.com/static/Transclusion%2520with%2520Templates.html
  https://tiddlywiki.com/static/Hard%2520and%2520Soft%2520Transclusions.html
  https://tiddlywiki.com/static/WikiText%2520Parser%2520Modes.html
  https://tiddlywiki.com/static/WikiText%2520parser%2520mode%2520transitions.html
  https://tiddlywiki.com/dev/static/Transclusion%2520and%2520TextReference.html
  https://tiddlywiki.com/dev/static/Parser.html
  https://tiddlywiki.com/dev/static/WikiRuleModules.html
  https://tiddlywiki.com/dev/static/Widgets.html
  https://tiddlywiki.com/static/Cascades.html
  https://tiddlywiki.com/static/View%2520Template%2520Title%2520Cascade.html
  https://tiddlywiki.com/static/View%2520Template%2520Body%2520Cascade.html
  https://tiddlywiki.com/static/Filters.html
  https://tiddlywiki.com/static/Introduction%2520to%2520filter%2520notation.html
  https://tiddlywiki.com/static/Filter%2520Syntax.html
  https://tiddlywiki.com/static/Filter%2520Operators.html
  https://tiddlywiki.com/static/Filter%2520Parameter.html
  https://tiddlywiki.com/static/Named%2520Filter%2520Run%2520Prefix.html
  https://tiddlywiki.com/static/Filter%2520Filter%2520Run%2520Prefix.html
  https://tiddlywiki.com/static/Interchangeable%2520Filter%2520Run%2520Prefixes.html
  https://tiddlywiki.com/static/Procedures.html
  https://tiddlywiki.com/static/Procedure%2520Definitions.html
  https://tiddlywiki.com/static/Procedure%2520Calls.html
  https://tiddlywiki.com/static/function%2520Operator.html
  https://tiddlywiki.com/prerelease/static/Functions.html
  https://tiddlywiki.com/prerelease/static/Interchangeable%2520Filter%2520Run%2520Prefixes.html

- XML 1.0 gives the design goals and well-formedness/fatal-error
  model:
  https://www.w3.org/TR/xml/

- PROV-N gives a W3C precedent for a human-readable notation spec
  with normative productions, XML-style EBNF, and a media-type
  section:
  https://www.w3.org/TR/prov-n/

- RDF 1.2 N-Triples gives a current W3C precedent for pairing
  XML-style EBNF with conformance, parsing, and a separate grammar
  text artifact:
  https://www.w3.org/TR/rdf12-n-triples/

- Namespaces in XML gives the URI-bound expanded-name model:
  https://www.w3.org/TR/xml-names/

- XHTML 1.0 gives the sharpest structural checklist for explicit
  closure, proper nesting, quoting, and lower-case XML-style
  discipline:
  https://www.w3.org/TR/xhtml1/

- HTML 5.1 is useful for NCR syntax and ambiguous-ampersand parse
  behavior, but not as the host-language model:
  https://www.w3.org/TR/2017/REC-html51-20171003/syntax.html

- W3C fragment best practices make fragment semantics depend on
  representation/media type rather than URI scheme:
  https://www.w3.org/TR/fragid-best-practices/

- W3C QA Framework gives the conformance-clause, terminology,
  reference, claims, and error-handling checklist:
  https://www.w3.org/TR/qaframe-spec/

- RFC 8174 gives the modern uppercase-only rule for normative
  keywords:
  https://www.rfc-editor.org/rfc/rfc8174

- RFC 5234 gives the ABNF baseline for transport-oriented syntax
  specifications and is most useful here as a secondary grammar
  model, not the primary notation:
  https://www.rfc-editor.org/rfc/rfc5234

- JSON-RPC 2.0 gives compact protocol-object and error-structure
  discipline:
  https://www.jsonrpc.org/specification

- TOML v1.0.0 gives the most defensible human-readable strict
  metadata format for this project:
  https://toml.io/en/v1.0.0

- JSON Schema gives the Core/Validation split and meta-schema
  layering model:
  https://json-schema.org/specification

- OpenAPI gives the cleanest modern statement that schema support
  is valuable but subordinate to specification text on conflict:
  https://spec.openapis.org/oas/

- MCP gives the current baseline for JSON-RPC-based capability
  negotiation, stateful operation, and explicit trust/safety
  obligations for agent systems:
  https://modelcontextprotocol.io/specification/2025-11-25
