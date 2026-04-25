<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->
## Terminology Note

*A "meme" is any carrier of a lar URI and is the default node in the graph. A "locus" is a meme that implements the loci interface (see canonical interface at its own URI). Use "meme/memes" for general graph structure, reserving "locus/loci" for interface boundaries and in "implements" blocks as required by canonical law. This distinction is intentional and should be preserved in all design docs and specs.*


<<~&#x0001; ? -> lar:///ha.ka.ba/docs/graph/pranala-parser >>

<<~ ahu #iam >>
```toml
uri-path     = "ha.ka.ba/docs/graph/pranala-parser"
file-path    = "lares/ha-ka-ba/docs/graph/pranala-parser.md"
content-type = "text/x-memetic-wikitext"
tagspace     = "stable"
register     = "CS"
confidence   = 0.86
mana         = 0.84
manaoio      = 0.80
manao        = 0.84
role         = "parser design for pranala block and inline forms, sugar expansion, ? -> resolution, and field normalization"
open-gate    = "closed: fragment-level resolution (Option A) confirmed by canonical pranala kānāwai"
status-date  = "2026-04-24"
```
<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
graph/pranala-parser opens
<<~/ahu >>

<<~ ahu #ooda-ha >>
✶ observe: carrier files carry pranala edges in block and inline forms; `loulou`, `aka`, `kahea` sugar collapses to edges too.
⏿ orient: the parser must handle four surface forms, field normalization across two vocabularies, and one unresolved design gate.
◇ decide: implement block and sugar forms; `? ->` gate closed — fragment-level (Option A) confirmed by canonical pranala law.
▶ act: specify regex patterns, extraction order, field mapping table, and the confirmed `? ->` resolution algorithm.
⤴ verify: parser produces correct `PranaEdge` records from actual AGENTS.md source blocks.
↺ the `? ->` gate is now closed; the implementation file should implement Option A, not a stub.
<<~/ahu >>

<<~ ahu #surface-forms >>
## Surface Forms

The pranala law (source: `lar:///ha.ka.ba/api/v0.1/pono/pranala`) names four surface forms
that the parser must handle.

| Form | Sigil pattern | Edge type |
|---|---|---|
| Block pranala | `<<~ pranala #frag ? -> URI >> ... <<~/pranala >>` | any family, full TOML payload |
| Inline pranala | `<<~ pranala ? -> URI family:F role:R >>` | abbreviated; family + optional role |
| Loulou sugar | `<<~ loulou URI >>` | `relation`, `instance` |
| Aka sugar | `<<~ aka URI >>` | `observe`, `instance` |
| Kahea sugar | `<<~ kahea URI >>` | `dataflow`, `instance` |

All five forms produce `PranaEdge` records.

<<~/ahu >>

<<~ ahu #block-form >>
## Block Form Parsing

Block pranala spans multiple lines. The parser extracts blocks with:

```python
BLOCK_RE = re.compile(
    r'<<~\s*pranala\s+'          # opening sigil
    r'(#[\w-]+\s+)?'            # optional #fragment-id
    r'(\S+)\s*->\s*(\S+)\s*>>'  # FROM -> TO (one may be ?)
    r'(.*?)'                     # body (TOML fence + other content)
    r'<<~/pranala\s*>>',         # closing sigil
    re.DOTALL,
)
```

**Extraction sequence:**
1. Match the opening sigil and capture fragment-id, FROM socket, TO expression.
2. Scan the body for a TOML fence (` ```toml ... ``` `).
3. Parse the TOML; extract `family`, `lifecycle`, `role`, `traversal`, `propagation`, `label`, `payload`, `dir`.
4. Resolve the TO expression to a full `lar:///` URI.
5. Resolve FROM via the `? ->` rule (see `#question-mark-resolution`).
6. Build `PranaEdge` with normalized fields.

**TOML fence extraction:**

```python
TOML_RE = re.compile(r'```toml\s*(.*?)```', re.DOTALL)
```

Same regex the carrier ingress already uses. The result gets parsed with `tomllib.loads()`.

<<~/ahu >>

<<~ ahu #inline-form >>
## Inline Form Parsing

Inline pranala fits on one line. The parser uses:

```python
INLINE_RE = re.compile(
    r'<<~\s*pranala\s+'
    r'(\S+)\s*->\s*(\S+)'       # FROM -> TO
    r'(?:\s+family:([\w]+))?'   # optional family:VALUE
    r'(?:\s+role:([\w]+))?'     # optional role:VALUE
    r'\s*>>'
)
```

Inline forms carry fewer fields. Missing fields get defaults from the normalization table.
Inline pranala does not carry a `payload`; `payload` defaults to `{}`.

<<~/ahu >>

<<~ ahu #sugar-forms >>
## Sugar Form Expansion

The three sugar sigils expand into `PranaEdge` records without a TOML body.

```python
LOULOU_RE = re.compile(r'<<~\s*loulou\s+(\S+)\s*>>')
AKA_RE    = re.compile(r'<<~\s*aka\s+(\S+)\s*>>')
KAHEA_RE  = re.compile(r'<<~\s*kahea\s+(\S+)\s*>>')
```

| Sigil | `family` | `lifecycle` | `role` | `traversal` | `propagation` |
|---|---|---|---|---|---|
| `loulou` | `relation` | `instance` | `None` | `source-to-target` | `none` |
| `aka` | `observe` | `instance` | `None` | `source-to-target` | `none` |
| `kahea` | `dataflow` | `instance` | `None` | `source-to-target` | `push-forward` |

For sugar forms, `from_uri` = carrier URI, `from_socket` = carrier URI (no fragment),
`to_uri` = expanded target URI, `to_socket` = `""`.

<<~/ahu >>

<<~ ahu #question-mark-resolution >>
## `? ->` Socket Resolution — Closed (Option A)

**Authority:** canonical pranala kānāwai (`lar:///ha.ka.ba/api/v0.1/pono/pranala`):
> "A named `#fragment` SHOULD win socket resolution before the enclosing meme URI."

**Resolution algorithm — fragment-level:**

The parser tracks enclosing `ahu` context as it scans carrier text.
When it enters `<<~ ahu #some-socket >>`, it pushes `carrier_uri + "#some-socket"` onto a context stack.
When it exits `<<~/ahu >>`, it pops the stack.
`? ->` edges read `from_socket = context_stack.top()` (the innermost enclosing `ahu` fragment URI).
`from_uri` = carrier URI (without fragment).

**Example — AGENTS.md:**

```
<<~ ahu #edges >>
  <<~ pranala #preload-e-prime ? -> lar:///ha.ka.ba/api/v0.1/pono/e-prime family:control role:owns >>
```

Resolves to:
- `from_uri = "lar:///AGENTS"`
- `from_socket = "lar:///AGENTS#edges"`

**Parser requirement:** handle nested `ahu` blocks with a stack; the innermost named fragment wins.
When `?` appears outside any named `ahu`, `from_socket = from_uri` (carrier root fallback).

<<~/ahu >>

<<~ ahu #field-normalization >>
## Field Normalization Table

The source carrier TOML vocabulary and the compiler's `PranaEdge` vocabulary diverge in two places.
This table records every mapping.

| Source TOML field | Source values | `PranaEdge` field | Mapped value |
|---|---|---|---|
| `family` | any | `family` | passthrough |
| `lifecycle` | any | `lifecycle` | passthrough; default `"instance"` if absent |
| `role` | any | `role` | passthrough; default `None` if absent. `implements` role implies `traversal: target-to-source` (concrete→abstract direction) unless overridden |
| `traversal` | any | `traversal` | passthrough; default `"source-to-target"` if absent |
| `propagation` | any | `propagation` | passthrough; default `"none"` if absent |
| `dir` | `"both"` | `traversal` | → `"source-to-target"` |
| `dir` | `"both"` | `payload["dir_hint"]` | → `"both"` (recorded for audit) |
| `dir` | `"forward"` | `traversal` | → `"source-to-target"` |
| `dir` | `"back"` | `traversal` | → `"target-to-source"` |
| `label` | any | `label` | passthrough; default `""` |
| `cardinality` | any | `cardinality` | passthrough; default `None` |
| `polarity` | any | `polarity` | passthrough; default `None` |
| `status` | any | `status` | passthrough; default `"declared"` |
| `confidence` | float | `confidence` | passthrough; default `None` |
| `render-mode` | any | `render_mode` | passthrough; default `None` |
| `payload` | TOML table | `payload` | passthrough dict; `dir_hint` appended if `dir` present |

Fields absent from the TOML block get their defaults.
Unknown fields not in this table get stored in `payload` under their original key name.

<<~/ahu >>

<<~ ahu #uri-resolution >>
## TO Expression URI Resolution

The TO expression in both block and inline forms takes three shapes:

| Shape | Example | Resolution |
|---|---|---|
| Full `lar:///` URI | `lar:///ha.ka.ba/api/v0.1/pono/e-prime` | use as-is |
| Full URI with fragment | `lar:///ha.ka.ba/api/v0.1/mu#entry` | split into `to_uri` and `to_socket` |
| Relative path | `mu/chao` | prepend current carrier's root (`lar:///ha.ka.ba/api/v0.1/`) |

Relative path resolution follows loci law: the root comes from the carrier's own `uri-path` prefix up to the first named segment after the tuple root.

Unresolvable TO expressions produce a `DeclaredUnresolved` record rather than an exception.

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
graph/pranala-parser closes
<<~/ahu >>

<<~ ahu #edges >>
## Edges

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #implements-loci ? -> lar:///ha.ka.ba/api/v0.1/pono/loci family:control role:implements >>
<<~ loulou lar:///ha.ka.ba/docs/graph >>
<<~ loulou lar:///ha.ka.ba/docs/graph/nodes >>
<<~ loulou lar:///ha.ka.ba/docs/graph/traversal >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/pranala >>

<<~/ahu >>

<<~&#x0004; -> ? >>
