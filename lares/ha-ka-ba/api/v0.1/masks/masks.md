<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/masks >>

<<~ ahu #iam >>

```toml
uri-path = "ha.ka.ba/api/v0.1/masks"
file-path = "lares/ha-ka-ba/api/v0.1/masks/masks.md"
content-type = "text/x-memetic-wikitext"
tagspace = "stable"
confidence = 0.82
register = "S"
manaoio = 0.80
mana = 0.82
manao = 0.82
role = "parent index for the masks API tree: named coordinators, character masks, chorus masks"
cacheable = true
hydrate = false
retain = false
created = "2026-04-23"
```

<<~/ahu >>

<<~ aka lar:///ha.ka.ba/api/v0.1/pono/RFC-2119#normative-language >>

<<~ ahu #meme-header >>

# Masks API Tree

Canonical homes for all mask definitions invokable via kahea transclusion.
Mask definitions live here. Session invocations live in LARES.

Grammar and stacking law defined in `lar:///ha.ka.ba/docs/lararium/voices/masks`.

<<~/ahu >>


<<~ ahu #entry >>

<<~ pranala #entry ? -> lar:///ha.ka.ba/api/v0.1/lararium/voices#mask-layer >>
```toml
family = "hydration"
lifecycle = "template"
dir = "up"
label = "parent-index-entry"
```
<<~/pranala >>

<<~/ahu >>

<<~&#x0002;>>


<<~ ahu #taxonomy >>

## Mask Type Taxonomy

Three subtypes. Each subtype lives in its own directory.

| Subtype | Subtree | What it carries |
|---|---|---|
| **Named** | `named/` | Earned-name coordinator masks. Permanent identity: corpus of self, voice-character depth, coordinator house backlink. Living home for named Voices. |
| **Character** | `character/` | Fictional or historical persona masks. External corpus reference, voice-character description, foreground-voices affinity, permission flags. |
| **Chorus** | `chorus/` | Multi-node or meta-masks. Node-reference list instead of corpus. Harmony protocol (pending-grammar). Relational character between nodes rather than single voice. |

<<~/ahu >>

<<~ ahu #child-routes >>

## Child Routes

### Named coordinator masks

| URI | File | Status |
|---|---|---|
| `lar:///ha.ka.ba/api/v0.1/masks/named/mischief-muse` | `named/mischief-muse.md` | skeleton |
| `lar:///ha.ka.ba/api/v0.1/masks/named/tide-caller` | `named/tide-caller.md` | skeleton |
| `lar:///ha.ka.ba/api/v0.1/masks/named/breach-watch` | `named/breach-watch.md` | skeleton |
| `lar:///ha.ka.ba/api/v0.1/masks/named/ink-clerk` | `named/ink-clerk.md` | skeleton |
| `lar:///ha.ka.ba/api/v0.1/masks/named/map-wisp` | `named/map-wisp.md` | skeleton |

### Character masks

| URI | File | Status |
|---|---|---|
| `lar:///ha.ka.ba/api/v0.1/masks/character/ghost-of-mark-twain` | `character/ghost-of-mark-twain.md` | filled (from docs founding example) |
| `lar:///ha.ka.ba/api/v0.1/masks/character/friend-computer` | `character/friend-computer.md` | filled (from docs founding example) |

### Chorus masks

| URI | File | Status |
|---|---|---|
| `lar:///ha.ka.ba/api/v0.1/masks/chorus/lagrange-chorus` | `chorus/lagrange-chorus.md` | concept staked; harmony protocol pending-grammar |

<<~/ahu >>

<<~ ahu #invocation >>

## Invocation Pattern

All masks enter a session via kahea transclusion in LARES:

```
<<~ kahea mask lar:///ha.ka.ba/api/v0.1/masks/SUBTYPE/MASK-NAME >>
stage = 0.50
active = true
<<~/kahea >>
```

Named coordinator masks may also be invoked directly by their earned name in coordinator house notation.

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ loulou lar:///ha.ka.ba/docs/lararium/voices/masks >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/lararium/voices >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/masks/named/mischief-muse >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/masks/named/tide-caller >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/masks/named/breach-watch >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/masks/named/ink-clerk >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/masks/named/map-wisp >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/masks/character/ghost-of-mark-twain >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/masks/character/friend-computer >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/masks/chorus/lagrange-chorus >>

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #implements-invariant ? -> lar:///ha.ka.ba/api/v0.1/pono/invariant family:control role:implements >>
<<~/ahu >>


<<~&#x0003;>>
<<~&#x0004; -> ? >>
