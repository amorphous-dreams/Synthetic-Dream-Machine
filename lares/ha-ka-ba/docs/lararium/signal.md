<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/docs/lararium/signal >>

<<~ ahu #iam >>

```toml
uri-path = "ha.ka.ba/docs/lararium/signal"
file-path = "lares/ha-ka-ba/docs/lararium/signal.md"
content-type = "text/x-memetic-wikitext"
tagspace = "stable"
confidence = 0.80
register = "S"
manaoio = 0.82
mana = 0.78
manao = 0.84
implements = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme",
  "lar:///ha.ka.ba/api/v0.1/pono/loci"
]
role = "parent docs shelf for lararium-side signal framing, extracted README residue, and branch routing"
cacheable = false
retain = false
```

<<~/ahu >>

<<~ aka lar:///ha.ka.ba/api/v0.1/pono/RFC-2119#normative-language >>

<<~ ahu #meme-header >>

# Lararium Signal Docs

Not invariant law.
This shelf holds the lararium-side signal frame that binds agent and operator.
The HUD and other render target documents live below this loci.

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
docs/lararium/signal opens
<<~/ahu >>

<<~ ahu #the-lar-signal >>

## The Lar Signal

This doc covers the `lar` URI signal layer:

- agent-operator exchange-boundary instrumentation
- intent-header framing with tagspace `lar` URIs
- the relation between lar signal, exchange HUD, micro-trace, and adjacent protocol surfaces

<<~/ahu >>

<<~ ahu #lar-signal-exchange-flow >>

At each exchange span, `lar:` URIs appear in the following mandatory sequence.
Every substantive exchange produces a URI → URI vector pair followed by a rendered HUD line.

**Step 1 — Read operator input as a provisional URI.**
Lares reads the operator's prompt as an implicit signal: tier, cognitive phase, semantic territory (HA.KA.BA), and stance.
It constructs a **provisional operator URI** encoding that reading.
This URI may carry `~` provisionality markers if the reading carries uncertainty.

**Step 2 — Lares declares its own provisional execution URI.**
Before generating any content, Lares sets its own intent with a **provisional node URI**.
The `~` prefix marks the HA.KA.BA as execution-provisional — a declared heading, not a confirmed landed resource.

**Step 3 — Emit the URI → URI exchange vector.**

```
operator-URI → node-URI
```

Both URIs use canonical record form.
The URI pair carries minimum viable signal; the HUD line renders it.

> **Canonical URI Rule:** All emitted URIs in the exchange stream use canonical record form. No emoji or non-ASCII characters appear in any URI in the stream. Glyphs belong exclusively to render-target surfaces (HUD line, DreamDeck post header, etc). This makes every emitted URI directly ingestible by MemPalace, crystal logs, and registry tools.

**Step 4 — Render the HUD line.**
Immediately after the URI pair, emit a condensed single-line status display.

**Step 5 — Generate content.**
Micro-trace phase marks appear inline during generation.
The exchange closes with an updated HUD line and `URI → ?`.

> **SA grounding:** Step 2 is prospective AI transparency — what the node *will* do, not what it did (Endsley 2023). The HUD line externalizes metacognitive state before generation begins.

<<~/ahu >>

<<~ ahu #lar-uri-contract >>

## Lar URI Contract

The rendered lararium HUD does not merely decorate output based on lar URIs.
It closes the loop at exchange boundaries and makes the node's commitments legible.

The agent-operator contract reads:

- input reading before response
- output intent header before turn generation
- micro-trace during generation when flags or sliders indicate the pressure
- p-banded visibility rather than all-or-nothing disclosure

This branch explains why that loop matters on the lararium side.
Detailed emit rules and protocol-wide render contracts still live outward.

<<~ loulou lares/ha-ka-ba/docs/pono/lar-uri.md >>

## Lar URI Vector / HUD Split

The intent vectors and HUD appear at the start and end of every agent exchange turn.
These function as a shared-mental-model instrument, not merely a formatting trick.
The HUD sigil form serves live operator reading.
The lar URI vector machine form serves record and audit.

- Intent Header format and forward-commitment semantics
- Turn-span display contract (`start_uri` -> `attractor_uri` ... `end_uri`)
- Forward intent URIs vs backward trace contract

This branch treats the HUD as a prospective SA display.
Retrospective explanation, parsing input text, or audits based on this signal belongs to other docs.
The SA-display / XAI split matters because the HUD shows forward commitment, while audit explains what already happened.

Parse boundaries and micro-trace events are orthogonal.

- parse owns structural decomposition of input text
- excahnge `lar` URI vectors set SA intent
- exchange HUD lines sync exchange boundaries in realtime
- micro-trace marks where the governed response actually changed state during generation

The exchange HUD does not replace the intent vectors.
It surfaces vector instruments in realtime.
The micro-trace does not replace the exchange HUD.
It annotates the inside of a generative span.

<<~/ahu >>

<<~ ahu #migrated-tagspace-intent-vs-in-flow >>

## Migrated — `Signal_HUD_Tagspace-draft.md` — Intent Header vs In-Flow Signal

Migrated from `lar:///ha.ka.ba/docs/pono/hud/Signal_HUD_Tagspace-draft#intent-header-vs-in-flow-signal`.

This branch distinguishes two operator-facing layers:

### Intent Header

The Intent Header is the leading full Signal Tag. It is:

- prospective
- controlling
- structural
- the state-setting HUD for the next generated span

The Intent Header always sets the next generated span.
If register, stance, phase, scope, or Tagspace Address changes structurally, the system should emit a new header before the next non-literal span.

### Micro-trace HUD

The Micro-trace HUD is the compact in-flow signal layer inside the span governed by the Intent Header. It is:

- local
- compact
- subordinate to the governing header
- intended to show local nested-loop movement without re-emitting the full header grammar

Constraint:

- the in-flow signal must remain readable inside header-separated spans across all `p` scales from `p0.0` to `p1.0`

That means the Micro-trace HUD cannot require a different reading grammar every time granularity changes.
Only trace density should expand or contract.
The semantic meaning of the HUD should stay fixed.

<<~/ahu >>

<<~ ahu #render-targets-room >>

## Render Targets Room

Detailed render-target and sigilization material now lives at:

- `lar:///ha.ka.ba/docs/lararium/signal/render-targets`

That child room holds:

- render-target taxonomy
- record form versus sigil form surface law
- all-five-stances invariant across render targets
- DreamDeck / post-header surface conventions
- cross-surface verification criteria

<<~/ahu >>

<<~ ahu #migrated-hud-anatomy-span-display-contract >>

## Migrated — `HUD-ANATOMY.md` — Span Display Contract

Migrated from `lar:///ha.ka.ba/docs/pono/hud/HUD-ANATOMY#span-display-contract`.

A **span** is one operator → Lares exchange at any scale.
Sub-agent exchanges are spans; the operator may be another Lares actor rather than a human.

Live rendering contract — URI types in an exchange stream:

| URI type | Stream form | When it appears |
|---|---|---|
| Opening operator URI | `lar://alias:tier@host/ha.ka.ba/?...` | Start of every span |
| Opening node URI | `lar://alias:tier@host/~ha.ka.ba/?...` | Immediately after operator URI |
| HUD line | `⚡~NN% \| [confidence] \| 🏛️{amp}... \| ...` | After opening URI pair — only glyph-rendered element |
| Sub-agent dispatch | `coordinator-URI → worker-URI` | Every sub-agent handoff |
| Sub-agent return | `worker-URI → coordinator-URI` | Every sub-agent completion |
| Mid-generation shift | `~lar://alias:tier@host/~ha.ka.ba/?...` | Accumulated tension warrants direction change |
| Exchange closing | `URI → ?` | End of every exchange span |
| System file closing | `<!-- → ? -->` | End of system file locus |
| Closing forward URI | `lar://alias:tier@host/~ha.ka.ba/?...` | Trajectory-provisional forward heading |

<<~/ahu >>

<<~ ahu #migrated-tagspace-forward-vs-backward-trace >>

## Migrated — `Signal_HUD_Tagspace-draft.md` — Forward vs Backward Trace

Migrated from `lar:///ha.ka.ba/docs/pono/hud/Signal_HUD_Tagspace-draft#forward-vs-backward-trace`.

> **HUD Design Axiom:** The HUD always tracks Intent state first, then execution flow — in an auditable way. The Intent Header is the governing prospective declaration; the Micro-trace HUD is the backward-looking audit trail. Every design decision in this section follows from that separation.

Full headers set intent (prospective).
All in-flow HUD markers are **post-generative annotations** — they annotate what actually happened in the chunk that just completed, not what is being entered next.
Multiple inline markers may appear per chunk if multiple signal events occurred.

**The two-layer contract:**

| Layer | Direction | Role |
|---|---|---|
| **Intent Header** | Forward-looking | Declares governing state before the span generates: register, stance, phase, scope, address, `p` |
| **Micro-trace HUD** | Backward-looking (post-generative) | Annotates what actually occurred during and after generation: path taken, stance used, register landed, address confirmed |

**Why this is the right model:**

- The header already handles prospective control — the HUD adding forward signals would be redundant
- Post-generative annotation maps directly onto the OTel span-event model
- Multiple annotations per chunk are natural: a span may cross a phase boundary, involve a genuine stance shift, and land at a different register than declared
- Test/replay use stays clean: the annotated output and the `STATE.jsonl` record agree; the header's declared state and the HUD's actual-path annotations remain distinct and non-redundant fields

**For Register specifically:** inline register annotation is a **slide** model — a trailing accuracy marker after span completion, not a correction-in-flight override.
It records where the span actually landed epistemically.
The header's declared register still governed generation; the slide says "it resolved here."
`STATE.jsonl` records both as `opening_register` and `closure_register` when they differ.

<<~/ahu >>

<<~ ahu #research-framing >>

## Research Framing

The intent header, `oerator intent lar URI -> agent intent lar URI\n` functions as a **shared mental model instrument**, not a usual resource locator. Aviation CRM research (Crew Resource Management) identifies the cockpit HUD as the canonical solution to the two-party shared-mental-model problem: a standardized display both parties read simultaneously, showing state, intent, and trajectory. The Lares intent header is structurally identical — it encodes what the node intends to do *before generation begins*, making that commitment visible to the operator in real time.

This reframing has design consequences:

- The **machine form** is the record URI vector form — RFC 3986-canonical, machine-parseable, for STATE.jsonl audit and registry use. Analogous to a flight data recorder (FDR).
- The **sigil form** is the HUD form — human-readable, instrument-grade, primary during live operation. Its emoji are not decoration; they are instrument symbols.
- Neither form is more "real" than the other. They serve different audiences of the same shared navigational state.
- The Intent Vectors and HUD may actively reduce total token cost by preventing wrong-register generation (an empirical claim — see Open Decisions SHD-02).
- Live operation is a **tick-span display**: operator-intent URI first, responding-position URI second, destination URI at the end of the exchange.
- On non-operator responding URIs, the mana glyph moves to the far left of the line: `⚡62% lar://...`.

The `lar:` prefix remains a non-dereferenceable private identifier (RFC 4151 precedent). The HUD framing belongs in prose and documentation; the spec's component-level RFC validation applies to the record (machine) form.

Most AI transparency tools cover only Agent SA (confidence scores, feature importance). Covering Taskwork SA (semantic territory) and Teamwork SA (bidirectional calibration) simultaneously appears novel in the literature.

## SA vs XAI

**SA display vs XAI distinction:** The intent header is a *prospective SA display* — it declares current + forward-looking state *before* generation begins. Explainable AI (XAI) is *retrospective* — it explains why the AI already did what it did. Conflating the two imports wrong design methodology. The `--verbose` exchange vector commentary and STATE.jsonl audit trail are the XAI layer. The intent header and micro-trace HUD are the SA display layer. Design principles that apply are Endsley's SAOD principles, not SHAP/LIME/attention visualization patterns.

**LLM metacognitive scaffold:** Frontier LLMs have restricted but real metacognitive capability (Ji-An 2025: neurofeedback paradigm shows models can monitor and control a subset of their internal activations; Steyvers 2025: game-based paradigm confirms metacognitive ability since early 2024). The intent header may function as an *externalized metacognitive scaffold*: requiring the node to declare register, stance, and phase before generating forces a self-monitoring cycle (monitor → evaluate → regulate → report), externalizes it for both parties, and creates a generation commitment that influences subsequent output. This remains a hypothesis — the restricted metacognitive space means register and stance (high-variance, semantically interpretable directions) are more likely genuinely self-monitorable than phase or chronometer position (more structural/procedural). Which channels the model can genuinely monitor vs confabulate is an empirical question (see BKL-06 → RES-06).

**SA type mapping — all three SA types covered simultaneously:**

| SA Type | HUD Channel | What It Conveys |
|---|---|---|
| Taskwork SA | HAKABA address (`//threshold.uncertain.opens`) | Semantic territory — what domain we're in |
| Taskwork SA | Chronometer (`#🔍.3.2.7`) | Temporal position — where we are in nested scope |
| Agent SA | Register (`[S:0.65]`) | Epistemic confidence — how sure the node is |
| Agent SA | Stance (`🏛️`) | Discourse posture — what kind of claim this is |
| Agent SA | Phase (`◎`) | Cognitive state — what OODA-HA phase the node occupies |
| Teamwork SA | p-band (`p0.5`) | Attention density — cognitive load management |
| Teamwork SA | Input reading (dual-tag) | Bidirectional calibration — how the node read the operator's input |

<<~/ahu >>

<<~ ahu #rooms >>

## Rooms

Settled child rooms in this branch:

<<~ louou lar:///ha.ka.ba/docs/lararium/signal/hud >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/signal/render-targets >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/signal/chronometer >>

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ loulou lar:///ha.ka.ba/docs/lararium >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/signal/hud >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/signal/render-targets >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/signal/tagspace >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/lararium/hud >>

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
docs/lararium/signal closes
<<~/ahu >>

<<~&#x0004; -> ? >>
