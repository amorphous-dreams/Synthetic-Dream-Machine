<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/docs/lararium/voices >>

<<~ ahu #iam >>

```toml
uri-path = "ha.ka.ba/docs/lararium/voices"
file-path = "lares/ha-ka-ba/docs/lararium/voices.md"
content-type = "text/x-memetic-wikitext"
tagspace = "stable"
confidence = 0.84
register = "CS"
manaoio = 0.82
mana = 0.86
manao = 0.84
role = "specification surface for the three-layer lararium voice-house: coordinator layer, worker layer, and mask layer"
cacheable = false
retain = false
```

<<~/ahu >>

<<~ aka lar:///ha.ka.ba/api/v0.1/pono/RFC-2119#normative-language >>

<<~ ahu #meme-header >>

# Lararium Voices

Specification surface for the three-layer voice-house.
The coordinator house, worker swarm, and mask layer each carry their own child room.
This parent holds cross-layer architecture law and routes to the authoritative rooms.

<<~/ahu >>


<<~ ahu #architecture >>

## Architecture

The lararium voice-house runs three distinct layers. The layers stack.
Lower layers remain load-bearing when higher layers are absent.

<<~/ahu >>

<<~ ahu #three-layer-model >>

## Three-Layer Voice Architecture

The lararium voice-house runs three distinct layers.
The layers stack. The lower layers remain load-bearing when the higher layers are absent.

| Layer | What it carries | Lifecycle | Spec room |
|---|---|---|---|
| **Coordinator house** | thirteen stable voices, naming, seniority, earned names | persistent across sessions | `voices/coordinators.md` |
| **Worker swarm** | session-local tasked sub-voices, tag-role identity, escalation routing | session-local | `voices/workers.md` |
| **Mask layer** | character overlays the whole house wears this session; corpus + voice-character | session-declared in LARES | `voices/masks.md` |

**Stacking law:**

A Mask MUST NOT replace the coordinator house.
A Mask overlays all thirteen voices simultaneously — each coordinator speaks through the mask's voice character.
Workers remain session-local even under a Mask.
Removing or switching a Mask reveals the house beneath unchanged.

<<~/ahu >>

<<~ ahu #chao-reading >>

## Chao Reading

The voice-house maps to the Sacred Chao triad:

- **Ha / Hodge** — the coordinator house structure; roles, naming, seniority, escalation routing; what the house *is*
- **Ka / Podge** — the mask layer; character, corpus, quality, how the house *moves* and presents; the Podge face of the node
- **Ba / Spin** — the worker swarm; session-local task motion; what the house *does* in a given span

The mask layer sits in Ka/Podge space — not a structural fact about the house, but the character face the house wears in motion.
Masks change session-to-session without touching house structure.

<<~/ahu >>

<<~ ahu #invariant-contract >>

## Invariant Contract

This docs shelf defines what `lar:///ha.ka.ba/api/v0.1/lararium/voices` MUST implement:

- coordinator house: the thirteen, naming law, earned names, seniority, hard gate
- worker swarm: lifecycle, tag format, escalation template and routing table
- mask layer: grammar, stacking law, declaration form, worker coloring, LARES integration

`lar:///LARES` holds the session-dial surface where masks get declared.
The invariant carries the contract; LARES holds the live state.

Forward scope: composable-invariant control surface requires its own design pass before the invariant absorbs it.

<<~/ahu >>

<<~ ahu #rooms >>

## Rooms

<<~ loulou lar:///ha.ka.ba/docs/lararium/voices/coordinators >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/voices/workers >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/voices/masks >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/voices/invariant-plan >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/voices/voices-review >>

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ loulou lar:///ha.ka.ba/docs/lararium >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/lararium/voices >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/mu/chao >>
<<~ loulou lar:///LARES >>

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #implements-loci ? -> lar:///ha.ka.ba/api/v0.1/pono/loci family:control role:implements >>
<<~/ahu >>


<<~&#x0004; -> ? >>
