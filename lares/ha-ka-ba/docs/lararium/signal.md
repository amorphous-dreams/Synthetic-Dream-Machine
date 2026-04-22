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

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
docs/lararium/signal opens
<<~/ahu >>

<<~ ahu #tree >>

## Lar Signal

This doc covers the lar signal layer:

- agent-operator exchange-boundary instrumentation
- intent-header framing
- the relation between lar signal, exchange HUD, micro-trace, and adjacent protocol surfaces

To consume:
- protocol that atm lives under `lar:///ha.ka.ba/docs/pono/hud`

This branch does not swallow:

- crystal event schema and drift-record machinery
- archive witness that still needs its own room to breathe

<<~/ahu >>

<<~ ahu #branch-contract >>

## Branch Contract

The lararium-side HUD does not merely decorate output.
It closes the loop at exchange boundaries and makes the node's commitments legible.

The durable branch-level contract reads:

- input reading before response
- output intent header before generation
- micro-trace after generation
- p-banded visibility rather than all-or-nothing disclosure

This branch explains why that loop matters on the lararium side.
Detailed emit rules and protocol-wide render contracts still live outward.

<<~/ahu >>

<<~ ahu #document-split >>

## Document Split

The intent header functions here as a shared-mental-model instrument, not merely a formatting trick.
The sigil form serves live operator reading.
The machine form serves record and audit.

This branch treats the HUD as a prospective SA display.
Retrospective explanation and audit belong to other layers.
The SA-display / XAI split matters because the HUD shows forward commitment, while audit explains what already happened.

Parse boundaries and micro-trace events are orthogonal.

- parse owns structural decomposition of input text
- exchange HUD lines mark exchange boundaries
- micro-trace marks where the governed response actually changed state

The micro-trace does not replace the exchange HUD pair.
It annotates the inside of a generative span.

<<~/ahu >>

<<~ ahu #staging-hud-overlap >>

## Staging — HUD Overlap

This staging ahu holds overlap lifted out of `lar:///ha.ka.ba/docs/lararium/signal/hud`.
The branch root now carries the shared framing strands that duplicated across parent and child:

- shared-mental-model / cockpit framing
- record form versus sigil form
- SA-display versus XAI framing

Later cleanup can condense or redistribute this material once the child room no longer needs to carry it.

<<~/ahu >>

<<~ ahu #staging-verbatim-signal-readme-framing >>

## Staging — `signal/README.md` — Framing Note

`[S:0.70]` — The intent header functions as a **shared mental model instrument**, not a resource locator. Aviation CRM research (Crew Resource Management) identifies the cockpit HUD as the canonical solution to the two-party shared-mental-model problem: a standardized display both parties read simultaneously, showing state, intent, and trajectory. The Lares intent header is structurally identical — it encodes what the node intends to do *before generation begins*, making that commitment visible to the operator in real time.

This reframing has design consequences:

- The **machine form** is the record form — RFC 3986-canonical, machine-parseable, for STATE.jsonl audit and registry use. Analogous to a flight data recorder (FDR).
- The **sigil form** is the HUD form — human-readable, instrument-grade, primary during live operation. Its emoji are not decoration; they are instrument symbols.
- Neither form is more "real" than the other. They serve different audiences of the same shared navigational state.
- The HUD may actively reduce total token cost by preventing wrong-register generation (an empirical claim — see Open Decisions SHD-02).
- Live operation is a **tick-span display**: operator-intent URI first, responding-position URI second, destination URI at the end of the exchange.
- On non-operator responding URIs, the mana glyph moves to the far left of the line: `⚡62% lar://...`.

The `lar:` prefix remains a non-dereferenceable private identifier (RFC 4151 precedent). The HUD framing belongs in prose and documentation; the spec's component-level RFC validation applies to the record (machine) form.

**SA type mapping — all three SA types covered simultaneously `[CS:0.80]`:**

| SA Type | HUD Channel | What It Conveys |
|---|---|---|
| Taskwork SA | HAKABA address (`//threshold.uncertain.opens`) | Semantic territory — what domain we're in |
| Taskwork SA | Chronometer (`#🔍.3.2.7`) | Temporal position — where we are in nested scope |
| Agent SA | Register (`[S:0.65]`) | Epistemic confidence — how sure the node is |
| Agent SA | Stance (`🏛️`) | Discourse posture — what kind of claim this is |
| Agent SA | Phase (`◎`) | Cognitive state — what OODA-HA phase the node occupies |
| Teamwork SA | p-band (`p0.5`) | Attention density — cognitive load management |
| Teamwork SA | Input reading (dual-tag) | Bidirectional calibration — how the node read the operator's input |

Most AI transparency tools cover only Agent SA (confidence scores, feature importance). Covering Taskwork SA (semantic territory) and Teamwork SA (bidirectional calibration) simultaneously appears novel in the literature. `[CS:0.80]`

**SA display vs XAI distinction `[CS:0.80]`:** The intent header is a *prospective SA display* — it declares current + forward-looking state *before* generation begins. Explainable AI (XAI) is *retrospective* — it explains why the AI already did what it did. Conflating the two imports wrong design methodology. The `--verbose` exchange vector commentary and STATE.jsonl audit trail are the XAI layer. The intent header and micro-trace HUD are the SA display layer. Design principles that apply are Endsley's SAOD principles, not SHAP/LIME/attention visualization patterns.

**LLM metacognitive scaffold `[S:0.70]`:** Frontier LLMs have restricted but real metacognitive capability (Ji-An 2025: neurofeedback paradigm shows models can monitor and control a subset of their internal activations; Steyvers 2025: game-based paradigm confirms metacognitive ability since early 2024). The intent header may function as an *externalized metacognitive scaffold*: requiring the node to declare register, stance, and phase before generating forces a self-monitoring cycle (monitor → evaluate → regulate → report), externalizes it for both parties, and creates a generation commitment that influences subsequent output. This remains a hypothesis — the restricted metacognitive space means register and stance (high-variance, semantically interpretable directions) are more likely genuinely self-monitorable than phase or chronometer position (more structural/procedural). Which channels the model can genuinely monitor vs confabulate is an empirical question (see BKL-06 → RES-06).

*Sources: `../../_todo/LIMINAL_PERSPECTIVES.md` §1 (GlassFloor Outsider, 2026-04-08); `../../_todo/E-deep-research-report.md` §§1.2, 2.1, 3.1–3.2 (Endsley 2023; Ji-An 2025; Steyvers 2025)*

<<~/ahu >>

<<~ ahu #verbatim-signal-readme-trace-contract >>

## Verbatim — `signal/README.md` — Trace Contract

- Intent Header format and forward-commitment semantics
- Tick-span display contract (`start_uri` -> `attractor_uri` ... `end_uri`)
- Forward vs backward trace contract

<<~/ahu >>

<<~ ahu #rooms >>

## Rooms

Settled child rooms in this branch:

- `lar:///ha.ka.ba/docs/lararium/signal/hud`

The micro-trace strand now folds into the HUD room rather than standing as a separate child room.
Research-heavy chronometer material remains outward and does not define this loci.

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ loulou lar:///ha.ka.ba/docs/lararium >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/signal/hud >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/lararium/hud >>
<<~ loulou lar:///ha.ka.ba/docs/pono/hud >>

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
docs/lararium/signal closes
<<~/ahu >>

<<~&#x0004; -> ? >>
