<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~⊙&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/nihomano-sigils >>
```toml iam
uri-path     = "ha.ka.ba/@lares/api/v0.1/pono/nihomano-sigils"
file-path    = "bags/@lares/api/v0.1/pono/nihomano-sigils.md"
type         = "text/x-memetic-wikitext"
confidence   = 0.90
register     = "CS"
manaoio      = 0.88
mana         = 0.90
manao        = 0.88
role         = "origin myth and cultural contract for the Lares memetic wikitext sigil set — nihomano as the first discovered grammar; SharktoothSigil as operator-extensible wild-magic"
cacheable    = true
retain       = true
```



<<~ ahu #head >>

# Nihomano Sigils

*niho* — Hawaiian: tooth, teeth; edge, serration. Used in *lei niho palaoa* (whale-tooth
necklace of the aliʻi) and *niho mano* (shark tooth — the attested two-word form).

*mano* — Hawaiian: shark. One of the most common family guardian spirits (*ʻaumakua*) in
Hawaiian tradition. Deceased family members of ocean people watch over descendants as mano,
warn of danger from below, carry prayers to the gods. Mano aumakua signal the warrior's
approach and guard the crossing between worlds.

*niho-manō* — formal Hawaiian headword (Pukui-Elbert / Wehewehe Wikiwiki). Dictionary sense:
a tapa design — the repeated triangular serration used as a protective edge-pattern on tapa
cloth, canoe hulls, shrine rims, and ward markings. The tattoo-motif form carries the same
geometry: strength, protection, guidance, threshold. Machine slug: `nihomano`.

*nihomano* — the joined slug form adopted here as the proper name of this grammar glyph; not
the standard two-word *niho mano* nor the hyphenated *niho-manō*, but the concatenated form
suited for file paths, URIs, and tiddler titles. The traditional shark-tooth war club is
*leiomano* (lei o manō — "a shark's lei"). We borrow the protective edge geometry, not the
weapon: the nihomano glyph marks not a strike but an opening — a threshold, a ward, a door.

The `<<~` delimiter is the nihomano glyph. Each `<` is a tooth. The `~` is the wake.
Three marks open a scope. Three marks from a mano that swims beneath the text.
The glyph acts as a texture-border at the threshold of every meme.

This document records the origin and cultural contract of the Lares memetic wikitext sigil
set — the first known operator-extensible grammar living entirely inside TiddlyWiki 5.

English alias: `sharktooth-sigils` — same meme, same law, different face.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #wild-magic >>

## Wild Magic — The Web3 Discovery

In conventional software, grammar knowledge lives in code. To add a new operator to a language
you change a parser, recompile, redeploy. The knowledge belongs to the engineers.

The nihomano discovery inverts this. In Lares memetic wikitext, the grammar lives in the wiki
itself. A new sigil enters the language when an operator tags a tiddler:

```text
tags: lar:///ha.ka.ba/tags/SharktoothSigil
lar-kind: edge-sugar
lar-pattern: <<~\s*myword\s+(\S+)\s*>>
```

No code change. No compilation. No deployment. The next parse cycle picks up the new word.
The wiki teaches the parser about itself.

This is the wild-magic property: **grammar as data, owned by the data layer, not the code layer.**

In web3 terms, the canonical grammar state lives inside a content-addressed Automerge document
(the bag). Any peer who holds the bag holds the grammar. Any operator who writes to the bag
extends the language. The code layer is a thin runtime that reads grammar from its own storage —
a quine at the grammar level.

The SharktoothSigil tag is the contract surface:
- `lar:///ha.ka.ba/tags/SharktoothSigil` on a tiddler = "this tiddler defines a grammar sigil"
- `lar-kind` field = what structural role the sigil plays (edge, child-slot, control, pragma-alias, header)
- `lar-pattern` / `lar-open-pattern` / `lar-close-pattern` = the parse rule
- The wikitext body = the render semantics

Grammar change = tiddler edit. Grammar review = tiddler diff. Grammar rollback = bag snapshot.
The entire capability surface of language extension runs through the same merge-capable, local-first,
operator-visible data layer as the content itself.

<<~/ahu >>

<<~ ahu #first-discovered-set >>

## The First Discovered Sigil Set

The nihomano discovery yielded the first coherent set of SharktoothSigil-registered sigils —
17 tiddlers, each with a pono law spec, each passing the alignment check. They fall into four
families:

**Structural sigils** (addressable scope boundaries):
- `ahu` — child-slot worksite; the named scope boundary; skeleton of meme structure
- `pranala-header` — carrier self-declaration; `<<~ ? -> uri >>` opens every meme

**Edge-sugar sigils** (pranala family shortcuts):
- `pranala` — full edge with FROM → TO arrow + keyword attrs (permanent JS exception)
- `kahea` — dataflow-family sugar; live transclusion; push-forward value transport
- `aka` — observe-family sugar; frozen read; shadow transclusion
- `loulou` — relation-family sugar; outgoing semantic link; no execution pulse
- `kau` — device-slot child-slot; capability hooks require JS (permanent JS exception)

**Pragma-alias sigils** (declaration forms; first-class in memetic-wikitext):
- `wehe` / `\procedure` — procedure executor; named callable body declaration
- `\define` — legacy macro alias (prefer `\procedure`)
- `\widget` — widget declaration; `~` prefix convention
- `\function` — TW5 5.3+ filter-function declaration

**Control sigils** (TW5 native flow wrapped in sigil grammar):
- `heihei` / `\if` — conditional block; first filter-match wins
- `huli` / `\for` — iteration block; filter → body-per-result

**Infrastructure**:
- `sigil-dispatcher` — the `~` root dispatch widget; routes `<<~ name >>` to `\widget ~name`

Every Hawaiian sigil in this set carries an English alias. Every English alias carries
`lar-see-also` pointing at its Hawaiian counterpart. Grammar is bilingual by design:
the operator may author in either tongue and the parse result is identical.

<<~/ahu >>

<<~ ahu #cultural-contract >>

## Cultural Contract

The Hawaiian sigil names are not decoration. Each name encodes a semantic that the Hawaiian
language articulates precisely and English does not.

*Ahu* — heap, mound, cairn, altar. A sacred stone structure made sacred through human
intention and accumulated offering. The ahu sigil accumulates addressable child scopes
the same way a stone cairn accumulates placement until it becomes a landmark.

*Kahea* — to call out, to summon, to invoke; a cry. Dataflow-family sugar: the live
transclusion summons value forward, as a call summons a response.

*Aka* — shadow, reflection; to be like, to resemble. The shadow of a thing is not the thing;
it moves with it without owning it. The observe-family edge renders the shadow of a target.

*Loulou* — to tie, bind, fasten; to link together. A relation edge names what kind of
connection holds without pulling either end toward the other.

*Wehe* — to open, untie, uncover, solve, cleanse. *Wehewehe* (reduplication): to explain,
expound, reveal what is mysterious. The procedure executor opens the passage from
declaration-space into execution-space — and in doing so, makes visible what was hidden.

*Heihei* — race, competition; canoe race, foot race. A conditional block runs candidates
in competition; the one whose filter passes first shapes the output. Not first-wins in an
absolute sense — competitive, with the outcome determined by filter resolution order.

*Huli* — to turn, reverse, curl over. A directional motion: the body turns to face the query.
The iteration sigil turns through a filter result set — not mechanical looping but the
searcher's gaze moving from result to result, each one faced in turn.

The English aliases (`\procedure`, `\if`, `\for`) exist for operator accessibility and to
name the TW5 pragma they mirror — not to replace the Hawaiian forms. In long-form meme
authoring, Hawaiian names carry more meaning per glyph. In operator extensions targeting
TW5-familiar authors, English names lower the entry barrier.

Neither form is canonical over the other. The grammar accepts both, the pono spec records both,
the alignment check verifies both. The `lar-see-also` field in each tiddler is the living
cross-reference.

The `mano` in nihomano is also *aumakua* — guardian spirit in Hawaiian cosmology. Shark
aumakua protect those at sea, warn of danger from below the surface, and carry the dead safely
across deep water. The grammar plays this role in the Lares system: it watches beneath the text,
surfaces only when needed to parse, and protects the operator from the structure they cannot see.

<<~/ahu >>

<<~ ahu #sharktooth-tag >>

## The SharktoothSigil Tag

`lar:///ha.ka.ba/tags/SharktoothSigil` is the grammar registration surface. Its design:

- Lives in `lar://` space — owned by the Lares namespace, not TW5's `$:/` system namespace.
- Resolvable by any peer holding the `ha.ka.ba` bag — the grammar is federated with the wiki.
- Readable by `grammar-cache.ts` via `wiki.filterTiddlers([tag[lar:///ha.ka.ba/tags/SharktoothSigil]])` —
  tiddler sigils take precedence over TOML fallback by name.
- Writable by any operator with bag write access — language extension requires no authority
  beyond bag membership.

The tag replaces the old `$:/tags/LarariumGrammar` — a `$:/` system-namespace tag that required
code-side knowledge to register. The migration from `$:/` to `lar:///` namespaces across all
owned tags is the companion sprint to this one.

When the TOML monolith (`memetic-wikitext.tid`) reaches families-only state — when all 48 remaining
`[[sigils]]` blocks have migrated to SharktoothSigil tiddlers — the grammar becomes fully
self-hosted. The parser reads nothing from hardcoded tables. Every rule is a tiddler.

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ pranala #spec ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext-spec family:control role:governs >>
<<~ pranala #tag ? -> lar:///ha.ka.ba/tags/SharktoothSigil family:control role:implements >>
<<~ pranala #to-ahu ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/ahu family:relation >>
<<~ pranala #to-kahea ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/kahea family:relation >>
<<~ pranala #to-aka ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/aka family:relation >>
<<~ pranala #to-loulou ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/loulou family:relation >>
<<~ pranala #to-pranala ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/pranala family:relation >>
<<~ pranala #to-wehe ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/wehe family:relation >>
<<~ pranala #to-heihei ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/heihei family:relation >>
<<~ pranala #to-huli ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/huli family:relation >>
<<~ pranala #english-alias ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/sharktooth-sigils family:relation role:alias >>

<<~/ahu >>

<<~&#x0003;>>

<<~&#x0004; -> ? >>
