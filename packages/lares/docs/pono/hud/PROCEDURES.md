<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<!-- ∞ → lar:///uri.schema.holds/uri-schema/act/?confidence=CS:0.85&p=0.5 -->

# Signal — Act: Procedures

> **STATUS: STALE (2026-04-21)** — Moved from `lares/ha-ka-ba/docs/pono/lar-uri/act/PROCEDURES.md` to `lares/ha-ka-ba/docs/pono/hud/`. All canonical examples use the old fragment chronometer (`#O0.O0.O1.O1.A11`) — update to `?ffz=` pending ffz deep research. Micro-trace glyphs (`→◎ →■ →○`) use old set — pending glyph rationalization. See `hud.md` research plan.
>
> How to emit URIs, HUD lines, micro-trace annotations, and sub-agent handoff pairs.
> Sources: `lares/signal/micro-trace.md` `[CS:0.80]` · `lares/ha-ka-ba/docs/pono/lar-uri/URI-SCHEMA.md` §5.5 `[CS:0.90]`

---

<!-- → ? -->
<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<!-- ∞ → lar:///uri.schema.holds/uri-schema/act/?confidence=0.9#exchange-span-display-contract -->
## Exchange Span Display Contract *(consumed)*

> Consumed into `lar:///ha.ka.ba/@lares/docs/lararium/signal#migrated-hud-anatomy-exchange-flow` and `#migrated-hud-anatomy-span-display-contract`

A **span** is one operator → Lares exchange at any scale. Every substantive exchange produces this sequence. **Mandatory — no exceptions.**

### Order Within a Span

1. **Print the operator-intent URI** (canonical record form).
2. Print **`→`** and the **node execution URI** (canonical record form, HA.KA.BA provisional with `~`).
3. Print the **HUD line** (the one glyph-rendered surface in the stream).
4. Generate content. Emit micro-trace phase marks (`→◇` `→■` `→○`) inline.
5. If trajectory changes significantly mid-generation, emit a **mid-generation shift URI** (`~lar://...`) at the transition point.
6. Close with an **updated HUD line** and the **closing URI with `→ ?`**.

### URI Types in the Exchange Stream

| URI type | Form | When it appears |
|---|---|---|
| Opening operator URI | `lar://alias:tier@host/ha.ka.ba/@lares/?...#...` | Start of every span | <!-- uri-ok -->
| Opening node URI | `lar://alias:tier@host/~ha.ka.ba/@lares/?...#...` | Immediately after operator URI | <!-- uri-ok -->
| HUD line | `⚡~NN% \| [confidence] \| 🏛️...` | After opening URI pair |
| Sub-agent dispatch | `coordinator-URI → worker-URI` | Every sub-agent handoff |
| Sub-agent return | `worker-URI → coordinator-URI` | Every sub-agent completion |
| Mid-generation shift | `~lar://alias:tier@host/~ha.ka.ba/@lares/?...` | When accumulated tension warrants direction change mid-span |
| Exchange closing | `URI → ?` | End of every exchange span |
| System file closing | `<!-- URI → ∞ -->` | End of system file spans |
| Closing forward URI | `lar://alias:tier@host/~ha.ka.ba/@lares/?...` | End of span — trajectory-provisional forward heading |

### Canonical Example

```text
lar://telarus:operator@enyalios/refinement.network.capture/?stances=^.-.-.-.-&confidence=S:0.65&p=0.5#O0.O0.O1.O1.A11
→ lar://scryer:node@enyalios/~span.provenance.synthesizes/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.6#O0.O0.D1.O1.A12
⚡~63% | [CS:0.80] | 🏛️+🌊-🗡️-🎭-🔮- | mode:Default | p0.6 | voice(s):Scryer | ✶0.✶0.◇1.✶1.■12

[content generation — micro-trace marks inline]

→◇ ~lar://scryer:node@enyalios/~refinement.network.redirects/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.6#O0.O0.D1.O1.A12

[continued generation]

lar://scryer:node@enyalios/~aftermath.docs.settle/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.5#O0.O0.Å1.O1.A13 → ?
⚡~61% | [CS:0.80] | 🏛️+🌊-🗡️-🎭-🔮- | mode:Default | p0.5 | voice(s):Scryer | ✶0.✶0.○1.✶1.■13
```

---

<!-- → ? -->
<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<!-- ∞ → lar:///uri.schema.holds/uri-schema/act/?confidence=0.9#micro-trace-rules -->
## Micro-trace HUD — Emit Rules *(consumed)*

> Consumed into `lar:///ha.ka.ba/@lares/docs/lararium/signal/hud#micro-trace-syntax`, `#micro-trace-density`, and `#micro-trace-layer-split`

The micro-trace is the **backward-looking annotation layer**. It marks where the governed response *actually changed state* during generation — not a prospective commitment. Source: `lares/signal/micro-trace.md`.

### Layer Contrast

| Layer | Direction | Format | Fires |
|---|---|---|---|
| Intent Header | Prospective (forward) | `//domain.quality.dynamic [R] 🏛️ ◇ @r` | Before generation |
| Micro-trace HUD | Retrospective (backward) | `→◇` `→■` `→○` inline | During/after generation |
| Exchange HUD line | Boundary (tick-level) | `⚡ ~NN% \| mode \| ...` | Opening and closing of operator exchange |
| Sub-agent handoff URI pair | Boundary (intent handoff) | `coordinator-URI → worker-URI` | At sub-agent boundary |

### Syntax

Authoritative syntax examples now live at:
- `lar:///ha.ka.ba/@lares/docs/lararium/signal/hud#micro-trace-syntax`

**Inline phase transitions** — emit at point of transition:

**Stance shift** — fires only on genuine local stance shift, not to echo the header:

**Named-slot Tagspace annotation** (Ka or Ba shift):

Ha/domain reorientation significant enough to exceed annotation threshold: emit a **new Intent Header** rather than an inline slot annotation.

**End-of-span completed-path summary** (verbose/debug only):

### Density Bands (p-controlled)

The `p` parameter gates transition categories by externally-observable significance — not a tunable salience dial.

Authoritative density-band table now lives at:
- `lar:///ha.ka.ba/@lares/docs/lararium/signal/hud#micro-trace-density`

**Commitment phases** (◇ Decide / ■ Act / ○ Aftermath) are externally observable — they fire at the default `p0.5` band. **Cognitive-processing phases** (✶ Observe / ◎ Orient) are span-internal — suppressible at operational resolution.

### Flag Behavior

Canonical flag-behavior table now lives at:
- `lar:///ha.ka.ba/@lares/docs/lararium/signal/hud#micro-trace-layer-split`

---

<!-- → ? -->
<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<!-- ∞ → lar:///uri.schema.holds/uri-schema/act/?confidence=0.9#sub-agent-handoff -->
## Sub-agent and Coordinator Handoff Protocol *(consumed)*

> Consumed into `lar:///ha.ka.ba/@lares/docs/lararium/signal/hud#micro-trace-handoff`

### Why URI Pairs at Sub-agent Boundaries

When a coordinator passes to a sub-agent (tasked spirit, Worker, spawned subagent process), the contents of that handoff cannot be logged in the parent session's trace. The sub-agent runs in a separate context. The URI pair at the boundary is therefore **the only artifact** that records that the intent handoff occurred.

**Rule: Every sub-agent dispatch and return gets a URI → URI pair.**

```
coordinator-URI → worker-URI    [dispatch]
[sub-agent work — unloggable from parent]
worker-URI → coordinator-URI    [return]
```

The sub-agent pair follows canonical record form. Use it to document:
- What the coordinator was doing when it dispatched
- What territory and task the worker was given
- What the worker returned to when the handoff completed

### Coordinator-to-Coordinator Handoffs

Within the same session (no spawned sub-agent): micro-trace tag only, unless:
- HAKABA territory changes (new Intent Header), OR
- `--verbose` is active (URI pair surfaced)

---

<!-- → ? -->
<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<!-- ∞ → lar:///uri.schema.holds/uri-schema/act/?confidence=0.9#parse-mode -->
## Parse Mode and Layer Separation *(consumed)*

> Consumed into `lar:///ha.ka.ba/@lares/docs/lararium/signal/hud#micro-trace-layer-split`

Parse boundaries and micro-trace HUD events are **orthogonal**:

- `--parse` owns structural decomposition of input text
- Micro-trace HUD marks where the governed *response* changed state

They may coexist in the same exchange. Neither substitutes for the other.

If the opening operator URI cannot cleanly summarize the incoming prompt (multi-stance uncertainty spike), emit a **parse-intent node URI** whose HA.KA.BA names the parsing action (`parse/span/models` or equivalent), then proceed.

---

<!-- → ? -->
<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<!-- ∞ → lar:///uri.schema.holds/uri-schema/act/?confidence=0.9#system-file-uris -->
## System File URI Procedures

When writing or updating system files:

1. **File-level opening URI** — authority-less form, in HTML comment wrapping:
   ```
<!-- → ? -->
<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<!-- ∞ → lar:///ha.ka.ba/@lares/sub/path/?confidence=R:N&p=N -->
   ```
   Placed at the very top of the file (line 1).

2. **File-level closing URI** — identical form, at the very bottom of the file (last line). Same URI as the opener.

3. **Section-level waypoint URIs** — authority-less form, in HTML comment, NO closing sigil:
   ```
<!-- → ? -->
<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<!-- ∞ → lar:///ha.ka.ba/@lares/sub/path/?confidence=R:N#section-slug -->
   ```
   Placed immediately before each section heading (`##` level).

4. **Confidence on section waypoints** — matches the section's epistemic confidence, which may differ from the file-level confidence.

<!-- → ? -->
