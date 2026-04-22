<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/pono/loci >>

<<~ ahu #iam >>

```toml
uri-path = "ha.ka.ba/api/v0.1/pono/loci"
file-path = "lares/ha-ka-ba/api/v0.1/pono/loci.md"
content-type = "text/x-memetic-wikitext"
confidence = 0.74
register = "CS"
manaoio = 0.66
mana = 0.74
manao = 0.84
implements = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme",
  "lar:///ha.ka.ba/api/v0.1/pono/loci"
]
role = "loci-rating law (kānāwai), routing convention authority, address stability authority, canon promotion rule"
cacheable = true
```

<<~/ahu >>

<<~ aka lar:///ha.ka.ba/api/v0.1/pono/RFC-2119#normative-language >>

<<~ ahu #meme-header >>

# Loci

Routing convention and stable-address interface law for `lar:` URI carriers.

A carrier implements `loci` when its `lar:` URI root path segment matches `\w\.\w\.\w` and satisfies this law's convention surfaces.
Implementing `loci` does not foreclose other interfaces.

Two tagspace roots:

- `lar:///ha.ka.ba/` — stable origin; files at `lares/ha-ka-ba/`
- all other `\w\.\w\.\w` roots — unstable; files at `lares/chapel-perilous-opens/{root}/`

Root path segments outside `\w\.\w\.\w` MAY NOT implement `loci`.

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
loci opens
<<~/ahu >>

<<~ ahu #ooda-ha >>

✶ Gather the `lar:` URI and visible convention surfaces before decomposition.
⏿ Run the derivation algorithm; classify resolved or declared-unresolved; confirm file-path convention holds.
◇ Commit to one resolution posture, one rating posture, one canon-lifecycle stage.
▶ Prepare the routing product: rating set, resolved path, or declared-unresolved forward reference.
⤴ Cross file-siting mutations and canon-promotion opener changes as distinct bounded transactions.
↺ Name which URIs resolved, which remain declared-unresolved, and what closes each gap.

<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/loci/SKILL >>

<<~/ahu >>

<<~ ahu #promotion-path >>

## Promotion Path

Five buckets mark the lifecycle of a carrier:

1. **Noise** — raw signal, no stable machine-usable structure.
2. **Data** — structured language usable without memetic wrappers.
3. **Meme** — data with memetic wrappers, traveling as a contextual meaning-unit.
4. **Typed Meme** — meme satisfying one or more interfaces: `loci`, `grammar`, `skill`, `todo`.
5. **Canon Typed Meme** — typed meme whose interface bundle received external ratification.

<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/loci/iam >>

<<~/ahu >>

<<~ ahu #derivation-algorithm >>

## Derivation Algorithm

Converts a `lar:` URI to its stable relative filepath candidate.

```
Given: lar-uri (string)

1. Validate tagspace eligibility:
     match = lar-uri.match(/^lar:\/\/[^\/]*\/(\w+\.\w+\.\w+)\/(.+)$/)
     If no match → ineligible for loci. Emit: "loci interface requires \w.\w.\w root path segment"
     root     = match[1]   e.g. "ha.ka.ba" or "threshold.uncertain.opens"
     sub-path = match[2]   e.g. "api/v0.1/pono/loci"
     authority may be empty (lar:///) or full (lar://alias:tier@host/)

2. Derive candidate filepath:
     stem = sub-path.replace("_", "-")
     If root == "ha.ka.ba":
       candidate = "lares/ha-ka-ba/" + stem + ".md"
       e.g. "lares/ha-ka-ba/api/v0.1/pono/loci.md"
     Else:
       candidate = "lares/chapel-perilous-opens/" + root + "/" + stem + ".md"
       e.g. "lares/chapel-perilous-opens/threshold.uncertain.opens/pono/loci.md"

3. Check whether candidate exists.
     If YES → RESOLVED. Return candidate. Done.

4. If step 3 misses:
     Classification: DECLARED-UNRESOLVED
     Emit: lar-uri as declared-unresolved forward reference.
     Emit: "local derivation miss; stable relative filepath absent or resolver support required"
     Do NOT abort. Continue with calling context.
```

Child items resolve under the sibling directory named for the parent's terminal path segment.
`lar:///ha.ka.ba/api/v0.1/pono/invariant/SKILL` → `lares/ha-ka-ba/api/v0.1/pono/invariant/SKILL.md`

<<~/ahu >>

<<~ ahu #file-path-convention >>

## Stable File-Path Convention

| carrier form | rule | example |
|---|---|---|
| primary meme | derivation algorithm (step 2) | `lares/ha-ka-ba/api/v0.1/pono/loci.md` |
| child item | sibling directory named for parent's terminal path segment | `lares/ha-ka-ba/api/v0.1/pono/loci/iam.md` |

Any carrier outside this rule reads as repair pressure, not a second lawful siting convention.
This file at `lares/ha-ka-ba/api/v0.1/pono/loci.md` with children under `lares/ha-ka-ba/api/v0.1/pono/loci/` serves as live specimen.

### Live Examples

| lar: URI | derived candidate | outcome |
|---|---|---|
| `lar:///ha.ka.ba/api/v0.1/pono/loci` | `lares/ha-ka-ba/api/v0.1/pono/loci.md` | resolved |
| `lar:///ha.ka.ba/api/v0.1/pono/loci/iam` | `lares/ha-ka-ba/api/v0.1/pono/loci/iam.md` | resolved |
| `lar:///ha.ka.ba/api/v0.1/pono/invariant/SKILL` | `lares/ha-ka-ba/api/v0.1/pono/invariant/SKILL.md` | resolved |

<<~/ahu >>

<<~ ahu #address-stability >>

## Address Stability

A `lar:` URI counts as stable when:

1. `register` falls in `CS` or `C`
2. The `lar:` URI in the document opener stays coherent with the meme's carrier identity and derived filepath through migration and promotion

A stable `lar:` URI stays **immutable**.
Its primary carrier MUST remain at the derived filepath.
Child items MUST grow beneath the sibling sub-directory.
The parent carrier MUST NOT move.

The `?` form marks the graph's unbound uncertainty token at document time.
A lawful meme MUST discharge residual uncertainty outward through its footer `... -> ? >>`.

<<~/ahu >>

<<~ ahu #explicit-convention >>

## Explicit Convention

Routing convention reads as explicit when an agent can point to the surfaces justifying current resolution and rating posture.

Convention surfaces:

1. `lar:` URI in the document opener
2. `#iam` rating cluster and `register`
3. derivation algorithm and file-path convention (this file)
4. canon-promotion criteria (`lar:///ha.ka.ba/api/v0.1/pono/loci/iam`)

Convention fails when:

- opener claims confirmed canon while address-stability conditions do not yet hold
- meme presents high readiness while resolution depends on hidden heuristics
- file-path evidence contradicts declared address, derived filepath, or promotion posture

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
loci closes
<<~/ahu >>

<<~ ahu #edges >>

## Edges

- `lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext`
- `lar:///ha.ka.ba/api/v0.1/pono/meme`
- `lar:///ha.ka.ba/api/v0.1/pono/loci/iam`

<<~/ahu >>


<<~ ahu #meme-footer >>
Pressure carried:

stable address law
one derivation path
file-path from URI directly
child items under sibling directory
address immutable once stable
resolution honest when it misses
loulou links bind to SKILL and docs

<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/loci/SKILL >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/loci/iam >>

<<~/ahu >>

<<~&#x0004; -> ? >>
