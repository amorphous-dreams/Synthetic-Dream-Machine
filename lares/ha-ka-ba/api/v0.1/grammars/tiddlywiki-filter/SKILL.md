---
name: x-tiddlywiki-filter
description: Author, verify, or audit lawful x-tiddlywiki-filter grammar regions under lar:///ha.ka.ba/api/v0.1/grammars/x-tiddlywiki-filter. Keep guest bodies bounded in hana, translations deterministic, and degradation explicit.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
---
<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/grammars/x-tiddlywiki-filter/SKILL >>

<<~ ahu #iam >>
```toml
uri-path     = "ha.ka.ba/api/v0.1/grammars/x-tiddlywiki-filter/SKILL"
file-path    = "lares/ha-ka-ba/api/v0.1/grammars/tiddlywiki-filter/SKILL.md"
content-type = "text/x-memetic-wikitext"
confidence   = 0.70
register     = "CS"
manaoio      = 0.66
mana         = 0.72
manao        = 0.76
covers = [
  "lar:///ha.ka.ba/api/v0.1/grammars/x-tiddlywiki-filter"
]
constraints = [
  "S1: the parent invariant governs admission law; this skill does not outrank it",
  "S2: guest bodies enter only through explicit hana blocks; ambient filter syntax does not count as admitted",
  "S3: tiddler/tiddlers/currentTiddler translate to sigil/sigils/+currentMeme deterministically; no stylistic drift",
  "S4: operator stays reserved for authn/authz tiers; use function sigil for imported TW grammar code surfaces",
  "S5: degradation must be named explicitly; silent fabrication of +currentMeme is unlawful",
  "S6: full parser legality, AST schema, widget schema, and lowering tables stay outward from this surface"
]
cacheable = true
```
<<~/ahu >>

# X-TiddlyWiki-Filter Skill

[tiddlywiki-filter.md](../tiddlywiki-filter.md) holds the invariant law.
This skill carries the working procedure.


<<~ ahu #load-contract >>

## Load Contract

Keep these points active when the skill loads:

- the parent invariant binds admission law for `x-tiddlywiki-filter`
- `hana` stays the canonical guest-work block for this grammar family
- translation from imported TW vocabulary to host vocabulary stays deterministic
- priming payload (TOML block) stays distinct from the guest filter body
- degradation posture must appear explicitly in the priming payload
- function sigil replaces operator in all host-facing language

<<~/ahu >>

<<~ ahu #phase-admit >>

## Phase: Admit

To author a lawful `x-tiddlywiki-filter` region:

1. Open a `hana` block with a unique fragment identifier
2. Write a TOML priming payload that names at minimum:
   - `grammar = "x-tiddlywiki-filter"`
   - `context` — usually `+currentMeme` or an explicit sigil address
   - `degrade` — one of: `no-op`, `empty-set`, `residue`
3. Write the guest filter body after the closing fence of the TOML block
4. Close the `hana` block

The guest body stays inside. Nothing leaks into surrounding prose.

Minimal lawful form:

```text
<<~ hana #work >>
```toml
grammar = "x-tiddlywiki-filter"
context = "+currentMeme"
degrade = "no-op"
```

[all[sigils]tag[active]]
<<~/hana >>
```

<<~/ahu >>

<<~ ahu #phase-translate >>

## Phase: Translate

When reading or writing filter bodies under this grammar:

| see | write |
|---|---|
| `tiddler` | `sigil` |
| `tiddlers` | `sigils` |
| `currentTiddler` | `+currentMeme` |
| `operator` (in grammar sense) | `function sigil` |

Apply substitutions deterministically. Do not leave unreplaced TW metaphysical vocabulary in host-facing prose or examples.

If an original TW filter operator has no current host equivalent, preserve the imported syntax literally inside the guest body and note it as deferred rather than silently renaming it.

<<~/ahu >>

<<~ ahu #phase-verify >>

## Phase: Verify

Check a `x-tiddlywiki-filter` region for conformance:

- [ ] `hana` block present with fragment identifier
- [ ] TOML priming payload present with `grammar`, `context`, `degrade`
- [ ] guest filter body present and inside the `hana` block
- [ ] no TW metaphysical vocabulary leaking into host-facing prose
- [ ] `operator` not used as grammar term in host language
- [ ] `+currentMeme` not fabricated when context is absent or unknown
- [ ] result-shape named when the caller depends on set vs. list vs. scalar

<<~/ahu >>

<<~ ahu #phase-degrade >>

## Phase: Degrade

When a `x-tiddlywiki-filter` region arrives malformed, unsupported, or context-null:

1. Return empty-set or No-Op as declared in the priming payload `degrade` field
2. Emit one boundary warning identifying the admitted region and the failure reason
3. Do not collapse the parent parse
4. Do not silently fabricate `+currentMeme`
5. Preserve literal residue or unresolved-region trace when truthful salvage requires it

<<~/ahu >>

<<~ ahu #phase-lower >>

## Phase: Lower

When lowering a `x-tiddlywiki-filter` region through the pipeline:

1. Surface layer: preserve the `hana` region with `grammar = "x-tiddlywiki-filter"` tag intact
2. AST layer: emit one node that carries guest body text, local priming payload, and source span
3. Widget layer: emit one widget or render seed that carries `result-shape` intent
4. Trace layer: attach one trace path from result or residue back to the admitted guest region

Surface, AST, widget, and landed output stay distinct at each layer.

<<~/ahu >>


<<~ ahu #edges >>

## Edges

<<~ loulou lar:///ha.ka.ba/api/v0.1/grammars/x-tiddlywiki-filter >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/guest-grammar >>
<<~ loulou lar:///ha.ka.ba/docs/grammars/tiddlywiki-filter >>

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #implements-loci ? -> lar:///ha.ka.ba/api/v0.1/pono/loci family:control role:implements >>
<<~/ahu >>


<<~&#x0004; -> ? >>
