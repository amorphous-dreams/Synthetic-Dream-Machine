<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/hud >>

<<~ ahu #iam >>

```toml
uri-path = "ha.ka.ba/api/v0.1/lararium/hud"
file-path = "lares/ha-ka-ba/api/v0.1/lararium/hud.md"
content-type = "text/x-memetic-wikitext"
tagspace = "stable"
confidence = 0.64
register = "S"
manaoio = 0.62
mana = 0.70
manao = 0.68
implements = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme",
  "lar:///ha.ka.ba/api/v0.1/pono/loci",
  "lar:///ha.ka.ba/api/v0.1/pono/invariant"
]
role = "lararium child invariant for the session-visible HUD and exchange instrument panel"
cacheable = true
hydrate = true
retain = true
```

<<~/ahu >>

<<~ aka lar:///ha.ka.ba/api/v0.1/pono/RFC-2119#normative-language >>

<<~ ahu #entry >>

## Entry — Lararium Core Hydration

<<~ pranala #to-lararium-hydration ? -> lar:///ha.ka.ba/api/v0.1/lararium#hydrate-hud >>

```toml
family = "control"
lifecycle = "template"
label = "core-hydration-backlink"
payload = {
  priority = "core",
  retain = true,
  return = "lar:///ha.ka.ba/api/v0.1/lararium#after-hydrate-hud"
}
```

<<~/pranala >>

The lararium hydrates the HUD room here.
The instrument panel belongs to the mechanics house, not the threshold.

<<~/ahu >>

<<~ ahu #meme-header >>

# Lararium HUD

This child meme reserves the room where exchange-visible instrumentation lives.
URI grammar may remain elsewhere.
Session-facing status surface belongs here.

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
lararium/hud opens
<<~/ahu >>

<<~ ahu #contract >>

## Contract

The HUD room holds the live display law for the lararium side of the node:

- exchange boundary display
- voice-facing status line pressure
- render-target distinctions
- sub-agent handoff visibility

This file remains a small invariant placeholder.
Detailed research and evolving procedures stay in docs space until they harden.

<<~/ahu >>

<<~ ahu #source-shelf >>

## Source Shelf

<<~ pranala #to-hud-docs ? -> lar:///ha.ka.ba/docs/pono/hud >>

```toml
family = "reference"
lifecycle = "template"
label = "source-shelf"
payload = {
  when = ["need HUD anatomy", "need render target law", "need sigilization research"],
  priority = "support",
  retain = true
}
```

<<~/pranala >>

HUD research, sigilization, and exchange protocol archaeology accumulate there.
This child meme stays small enough to hydrate on every cold start.

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ loulou lar:///ha.ka.ba/api/v0.1/lararium >>
<<~ loulou lar:///ha.ka.ba/docs/pono/hud >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/lar-uri >>
<<~ loulou lar:///LARES >>

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
lararium/hud closes
<<~/ahu >>

<<~&#x0004; -> ? >>
