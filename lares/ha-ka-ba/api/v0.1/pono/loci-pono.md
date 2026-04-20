<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? --> lar:///ha.ka.ba/api/v0.1/pono >>

<<~ ahu #iam >>
```toml
# <<~ ahu #iam-ha "structure" >>
uri-path = "ha.ka.ba/api/v0.1/pono"
file-path = "lares/ha-ka-ba/api/v0.1/pono/loci-pono.md"
content-type = "text/x-memetic-wikitext"
manaoio = 0.60
confidence = 0.65
# <<~/ahu >>
# <<~ ahu #iam-ka "detail" >>
mana = 0.65
manao = 0.70
implements = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme",
  "lar:///ha.ka.ba/api/v0.1/pono/loci"
]
register = "CS"
role = "kānāwai (law) index, verification registry, and skill package host"
skill-package-root = "ha-ka-ba/api/v0.1/pono/skill-*.md"
# <<~/ahu >>
# <<~ ahu #iam-ba "flow" >>
# <<~/ahu >>
```
<<~/ahu >>

# Pono

A self-describing index of all memetic-wikitext kānāwai (law) memes.

Pono names, addresses, and relates every active kānāwai (law) in this system. It also hosts verification skills as `skill-*.md` packages under [lares/ha-ka-ba/api/v0.1/pono/](lares/ha-ka-ba/api/v0.1/pono/).

<<~&#x0002; ahu #meme-body-open >>
Pono opens the kānāwai (law) index stream here.
<<~/ahu >>

<<~ ahu #phase-map >>

## Phase Map

`✶ Observe --> ⏿ Orient --> ◇ Decide --> ▶ Act --> ⤴ Hoʻoko --> ↺ Aftermath`

Pono gathers the kānāwai (law) roster, maps roles and addresses, selects the right kānāwai (law) or skill for the query, prepares an index envelope, crosses the threshold, and judges completeness.

<<~/ahu >>

<<~ ahu #law-index >>

## Kānāwai (law) Index

Active kānāwai (law) memes registered under `lar:///ha.ka.ba/api/v0.1/`:

| Name | Address | Role |
|---|---|---|
| meme | `lar:///ha.ka.ba/api/v0.1/pono/meme` | canonical meme kānāwai (law), required/optional element authority, and rating-target authority |
| memetic-wikitext | `lar:///ha.ka.ba/api/v0.1/pono/boot-wikitext` | minimal viable boot grammar and sigil kānāwai (law) |
| parser | `lar:///ha.ka.ba/api/v0.1/pono/parser` | parsing, normalization, metadata fetch, parse aftermath |
| memetic-wikitext | `lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext` | surface grammar and sigil kānāwai (law) |
| render-pipeline | `lar:///ha.ka.ba/api/v0.1/pono/render-pipeline` | lowering, widget tree, render projection, trace continuity |
| guest-grammar | `lar:///ha.ka.ba/api/v0.1/pono/guest-grammar` | guest grammar admission kānāwai (law), hana worksite contract, host-guest ownership |
| RFC-219 | `lar:///ha.ka.ba/api/v0.1/pono/RFC-219` | shared normative vocabulary kānāwai (law), modal-force registry, and cross-meme reference point |
| x-tiddlywiki-filter | `lar:///ha.ka.ba/api/v0.1/grammars/x-tiddlywiki-filter` | first registered hana guest grammar |
| pono | `lar:///ha.ka.ba/api/v0.1/pono` | kānāwai (law) index and verification skill host |
| loci | `lar:///ha.ka.ba/api/v0.1/pono/loci` | lar: URI routing derivation algorithm, meme-type prefix table, carrier coherence, MCP-resolution roadmap, address stability, and canon promotion kānāwai (law) |
| iam | `lar:///ha.ka.ba/api/v0.1/pono/loci/iam` | root `#iam` metadata kānāwai (law), surviving field-set authority, and reduction charter |
| file-path | `lar:///ha.ka.ba/api/v0.1/pono/loci/iam/file-path` | `file-path` key kānāwai (law), form classifier, and URI-agreement procedure |
| loci/edge | `lar:///ha.ka.ba/api/v0.1/pono/loci/edge` | root edge kānāwai (law), family authority, lifecycle authority, and migration target beyond vague dependency claims |
| loci/edge/proposition | `lar:///ha.ka.ba/api/v0.1/pono/loci/edge/proposition` | semantic edge kānāwai (law), proposition authority, and ontology-link bridge |
| loci/edge/template | `lar:///ha.ka.ba/api/v0.1/pono/loci/edge/template` | template edge sigil kānāwai (law), slot-contract authority, and kahea binding authority |
| loci/edge/instance | `lar:///ha.ka.ba/api/v0.1/pono/loci/edge/instance` | concrete edge instance kānāwai (law), bound-object authority, and override discipline |
| loci/edge/control | `lar:///ha.ka.ba/api/v0.1/pono/loci/edge/control` | control-flow edge kānāwai (law), branch authority, and execution-order authority |
| loci/edge/debug | `lar:///ha.ka.ba/api/v0.1/pono/loci/edge/debug` | debug edge kānāwai (law), observation authority, and hidden-edge illumination authority |

The `loci/edge` branch now seeds explicit edge law under `lar:///ha.ka.ba/api/v0.1/pono/loci/edge`. This first wave covers root edge law, semantic proposition, template sigils, concrete instances, control flow, and debug illumination. Dataflow, message, constraint, and trace remain second-wave work.

The `guest-grammar` and `x-tiddlywiki-filter` kānāwai (law) memes carry a canonical host-facing term shift: `tiddler` → `meme`, `currentTiddler` → `+currentMeme`. Host-facing examples and law statements throughout the stack should reflect this shift. Imported lineage terms may appear only in visibly quoted prior-art notes.

A **loci meme** occupies the stable `lar:///ha.ka.ba/api/v0.1/*` tagspace with a locked address, a stable `lar:` URI. Loci memes carry four canonical rating fields in `#iam` — `manaoio`, `confidence`, `mana`, and `manao` — with `content-type` above `version`, `manaoio` and `confidence` kept in the structure ahu, `mana` and `manao` opened by the detail ahu after the close/reopen marker, and the adjacent `register` agent-operator surface-texture key immediately below `meme-type`. They reach prospective-canon status (`[CS]`) before an admin or operator may move them to `[C]` canon status. Other meme types may drift their path-root address (what3words-style path root section). The loci kānāwai (law) governs `lar:` URI routing derivation, carrier coherence, address stability, canon promotion, and the research roadmap toward live MCP-backed resolution.

**Lifecycle Note:** All meme law in this system now follows the five-bucket lifecycle: noise → data → meme → typed meme → canon typed meme. Here `data` names structured language an AI can use without the memetic wrappers. Types remain composable rather than mutually exclusive, and `loci` names the stable-address branch for carriers under `lar:///ha.ka.ba/api/v0.1/**`. See `lar:///ha.ka.ba/api/v0.1/pono/loci#promotion-path` and `lar:///ha.ka.ba/api/v0.1/pono/meme#rating-targets` for canonical lifecycle and rating details.

See `lar:///ha.ka.ba/api/v0.1/pono/loci#derivation-algorithm` for the current local path-derivation procedure and `lar:///ha.ka.ba/api/v0.1/pono/loci#mcp-resolution-roadmap` for the open resolver roadmap. See `lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext#meme-ratings` for the full ontological account of the four canonical rating fields plus `register` surface texture, and `lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext#meme-confidence` for the five-band confidence scale.

A kānāwai (law) meme counts as registered here when it depends on `lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext` and carries a stable address.

<<~ ahu #law-index-ha >>

#### Kānāwai (law) Index / ha

Kānāwai (law)-index-ha holds registry identity and membership criteria.

This subphase governs what makes a meme a kānāwai (law) and what earns a place in this index.

<<~/ahu >>

<<~ ahu #law-index-ka >>

#### Kānāwai (law) Index / ka

Kānāwai (law)-index-ka governs address stability, role precision, and dependency tracing.

This subphase keeps the index machine-readable without losing human legibility.

<<~/ahu >>

<<~/ahu >>

<<~ ahu #skill-index >>

## Skill Index

Verification skills live as `skill-*.md` packages under [lares/ha-ka-ba/api/v0.1/pono/](lares/ha-ka-ba/api/v0.1/pono/).

Each skill package verifies conformance of one or more kānāwai (law) memes.

| Skill File | Covers | Purpose |
|---|---|---|
| *(none yet)* | — | — |

A compliant skill package should declare which kānāwai (law) address it covers, what invariants it checks, and what a passing result looks like.

### Verification Backlog

First skill package candidates, in priority order:

* `hana` form legality — verify block-only constraint, payload-authority correctness for first fenced `toml` inside `hana`, and explicit closer matching through `<<~/hana >>`
* local degradation — verify no-op or empty-set return and boundary warning when `hana` guest work cannot run lawfully
* `+currentMeme` context handling — verify null-context case degrades truthfully rather than fabricating a result
* trace continuity — verify source span, AST node, widget node, and output or residue remain linked across guest work lowering
* anti-overload — verify root primitives remain distinct from guest work; `ahu`, `ala`, `aka`, `kahea`, `kapu`, `ui`, `hana`, and `?` do not acquire foreign roles through guest grammar admission
* term-shift alignment — verify host examples use `meme` instead of `tiddler` where the ontology already shifted
* term-shift alignment — verify host examples use `+currentMeme` instead of `currentTiddler` in all law statements and guest-work examples
* term-shift alignment — verify imported lineage phrases such as "Function Tiddlers" or `currentTiddler` appear only in visibly quoted prior-art notes rather than silently mixed into host law statements

<<~ ahu #skill-index-ha >>

#### Skill Index / ha

Skill-index-ha holds package identity and coverage scope.

This subphase governs what a skill package must declare for registration here.

<<~/ahu >>

<<~ ahu #skill-index-ka >>

#### Skill Index / ka

Skill-index-ka governs file naming, invariant declaration, and pass/fail surface.

This subphase keeps skill packages testable and auditable.

<<~/ahu >>

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
Pono closes the kānāwai (law) index stream here.
<<~/ahu >>

<<~ ahu #edges >>

## Edges

- `lar:///ha.ka.ba/api/v0.1/pono/boot-wikitext`

<<~/ahu >>


<<~&#x0004; --> ? >>
