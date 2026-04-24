<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium >>

<<~ ahu #iam >>

```toml
uri-path = "ha.ka.ba/api/v0.1/lararium"
file-path = "lares/ha-ka-ba/api/v0.1/lararium.md"
content-type = "text/x-memetic-wikitext"
tagspace = "stable"
confidence = 0.70
register = "CS"
manaoio = 0.68
mana = 0.78
manao = 0.74
implements = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme",
  "lar:///ha.ka.ba/api/v0.1/pono/loci",
  "lar:///ha.ka.ba/api/v0.1/pono/invariant"
]
role = "canonical lararium seat, mechanics shelf, mandatory child-hydration bridge to session dials"
cacheable = true
core = [
  "lar:///ha.ka.ba/api/v0.1/lararium/hud",
  "lar:///ha.ka.ba/api/v0.1/lararium/voices",
  "lar:///ha.ka.ba/api/v0.1/lararium/continuity"
]
hydrate = true
retain = true
```

<<~/ahu >>

<<~ aka lar:///ha.ka.ba/api/v0.1/pono/RFC-2119#normative-language >>

<<~ ahu #entry >>

## Entry — Threshold Backlink

<<~ pranala #to-agents-threshold ? -> lar:///AGENTS#threshold-to-lararium >>

```toml
family = "control"
lifecycle = "template"
label = "threshold-backlink"
payload = {
  priority = "core",
  retain = true,
  mode = "hydrate",
  return = "lar:///AGENTS#after-lararium-handoff"
}
```

<<~/pranala >>

The lararium receives threshold pressure here.
The canonical seat now holds.
The lararium MUST hydrate its declared child core before yielding to session dials.

<<~/ahu >>

<<~ ahu #meme-header >>

# Lararium

Active in i kēia manawa.
Canonical seat.
Hydration bridge.

The lararium holds agent mechanics, not threshold law.
The lararium prepares the handoff to `lar:///LARES` by hydrating the smallest live house it needs.

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
lararium opens
<<~/ahu >>

<<~ ahu #ooda-ha >>

✶ receive threshold pressure; confirm entry pranala binds.
⏿ orient the seat: agent mechanics stay local, threshold law stays in AGENTS, session dials stay in LARES.
◇ decide hydration order: HUD, voices, continuity in sequence before yield.
▶ route through each core socket; return anchors confirm each child resolved.
⤴ verify all three children resolved before yielding to LARES.
↺ yield; the lararium does not accumulate state after handoff.

<<~/ahu >>

<<~ ahu #core-hydration >>

## Core Hydration

The lararium's own core must route through explicit sockets.
Neither `core = [...]` nor `Edges` completes hydration by itself.

<<~ pranala #hydrate-hud ? -> lar:///ha.ka.ba/api/v0.1/lararium/hud#entry >>

```toml
family = "control"
lifecycle = "template"
label = "core-hydration"
payload = {
  priority = "core",
  retain = true,
  return = "lar:///ha.ka.ba/api/v0.1/lararium#after-hydrate-hud"
}
```

<<~/pranala >>

<<~ ahu #after-hydrate-hud >>
HUD child hydration resolved.
<<~/ahu >>

<<~ pranala #hydrate-voices ? -> lar:///ha.ka.ba/api/v0.1/lararium/voices#entry >>

```toml
family = "control"
lifecycle = "template"
label = "core-hydration"
payload = {
  priority = "core",
  retain = true,
  return = "lar:///ha.ka.ba/api/v0.1/lararium#after-hydrate-voices"
}
```

<<~/pranala >>

<<~ ahu #after-hydrate-voices >>
Voices child hydration resolved.
<<~/ahu >>

<<~ pranala #hydrate-continuity ? -> lar:///ha.ka.ba/api/v0.1/lararium/continuity#entry >>

```toml
family = "control"
lifecycle = "template"
label = "core-hydration"
payload = {
  priority = "core",
  retain = true,
  return = "lar:///ha.ka.ba/api/v0.1/lararium#after-hydrate-continuity"
}
```

<<~/pranala >>

<<~ ahu #after-hydrate-continuity >>
Continuity child hydration resolved.
<<~/ahu >>

These child memes may stay skeletal while research accumulates in docs space.
The sockets still carry boot law now.

<<~/ahu >>

<<~ ahu #continuation-to-lares >>

## Continuation — LARES

<<~ pranala #to-lares ? -> lar:///LARES >>

```toml
family = "control"
lifecycle = "template"
dir = "forward"
label = "session-dial-handoff"
payload = { priority = "core", retain = true }
```

<<~/pranala >>

The lararium yields.
LARES holds the active dials.

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
lararium closes
<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ loulou lar:///ha.ka.ba/api/v0.1/mu >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/lararium/hud >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/lararium/voices >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/lararium/continuity >>
<<~ loulou lar:///LARES >>
<<~ loulou lar:///ha.ka.ba/docs/lararium >>

<<~/ahu >>

<<~&#x0004; -> ? >>
