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

<<~ ahu #tree >>

## Lar Signal

This doc covers the lar signal layer:

- agent-operator exchange-boundary instrumentation
- intent-header framing
- the relation between lar signal, exchange HUD, micro-trace, and adjacent protocol surfaces

To consume into child `lares/ha-ka-ba/docs/lararium/signal/hud.md`:
- protocol that atm lives under `lar:///ha.ka.ba/docs/pono/hud`

<<~/ahu >>

<<~ ahu #branch-contract >>

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

<<~/ahu >>

<<~ ahu #document-split >>

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

<<~ ahu #migrated-hud-anatomy-exchange-flow >>

## Migrated — `HUD-ANATOMY.md` — Exchange Flow

Migrated from `lar:///ha.ka.ba/docs/pono/hud/HUD-ANATOMY#exchange-flow`.

At each exchange span, `lar:` URIs appear in the following mandatory sequence.
Every substantive exchange produces a URI → URI vector pair followed by a rendered HUD line.

**Step 1 — Read operator input as a provisional URI.**
Lares reads the operator's prompt as an implicit signal: tier, cognitive phase, semantic territory (HA.KA.BA), and stance.
It constructs a **provisional operator URI** encoding that reading.
This URI may carry `~` provisionality markers if the reading is uncertain.

**Step 2 — Lares declares its own provisional execution URI.**
Before generating any content, Lares sets its own intent with a **provisional node URI**.
The `~` prefix marks the HA.KA.BA as execution-provisional — a declared heading, not a confirmed landed resource.

**Step 3 — Emit the URI → URI exchange vector.**

```
operator-URI → node-URI
```

Both URIs use canonical record form.
The URI pair carries minimum viable signal; the HUD line expands it.

> **Canonical URI Rule:** All emitted URIs in the exchange stream use canonical record form. No emoji or non-ASCII characters appear in any URI in the stream. Glyphs belong exclusively to render-target surfaces (HUD line, DreamDeck post header). This makes every emitted URI directly ingestible by MemPalace, crystal logs, and registry tools.

**Step 4 — Render the HUD line.**
Immediately after the URI pair, emit a condensed single-line status display.

**Step 5 — Generate content.**
Micro-trace phase marks appear inline during generation.
The exchange closes with an updated HUD line and `URI → ?`.

> **SA grounding:** Step 2 is prospective AI transparency — what the node *will* do, not what it did (Endsley 2023). The HUD line externalizes metacognitive state before generation begins. *Source: `_todo/E-deep-research-report.md` §§2.1, 3.2*

<<~/ahu >>

<<~ ahu #migrated-hud-anatomy-render-targets >>

## Migrated — `HUD-ANATOMY.md` — Render Targets

Migrated from `lar:///ha.ka.ba/docs/pono/hud/HUD-ANATOMY#render-targets`.

The system has one canonical encoding and multiple named render targets.

| Render target | Surface form | URIs canonical? | When used |
|---|---|---|---|
| `record:full` | `lar://alias:tier@host/ha.ka.ba/?...` | Yes — identity projection | Storage, crystal logs, registry |
| `hud:exchange-pair` | `operator-URI → node-URI` + HUD line | Yes — only HUD line uses glyphs | Every exchange-span boundary (mandatory) |
| `chat-log:post-header` | `@handle@node — timestamp — //ha.ka.ba [Reg] 🏛️{amp}...` | No — social projection | DreamDeck feed posts, BBS thread headers |

Render targets are projections of the canonical form.
They are not stored as URIs.
A render target that cannot be normalized back to record form is malformed.

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

<<~ ahu #research-framing >>

## Research Framing

The intent header, `estimated operator intent lar URI -> agent reponse position intent lar URI\n` functions as a **shared mental model instrument**, not a usual resource locator. Aviation CRM research (Crew Resource Management) identifies the cockpit HUD as the canonical solution to the two-party shared-mental-model problem: a standardized display both parties read simultaneously, showing state, intent, and trajectory. The Lares intent header is structurally identical — it encodes what the node intends to do *before generation begins*, making that commitment visible to the operator in real time.

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

<<~ ahu #kowloon-dreamdeck >>

## Kowloon / DreamDeck Social Layer

The Elyncia.app / DreamDeck identity model has three distinct layers. Do not conflate them.

| Layer | Form | What it is |
|---|---|---|
| DID | `did:plc:abc123` | AT Protocol canonical identity — cryptographic key holder |
| Handle | `@telarus@elyncia.social` | Resolution alias over the DID — human-readable, not authoritative |
| lar: alias | `telarus:operator@enyalios` | Application-layer signal state — operational role in a lar: exchange |

**DreamDeck post header format (canonical — `chat-log:post-header` render target):**
```
@handle@node — timestamp — //domain.quality.dynamic/{optional/path/} [confidence] 🏛️{amp}🌊{amp}🗡️{amp}🎭{amp}🔮{amp}
```

Territory triple placed before confidence and stance — grounds domain before posture (WHERE → HOW). All five stances always present with amplitude modifiers.

| ActivityPub handle | lar: URI authority | Underlying DID |
|---|---|---|
| `@lindwyrm@new-delos` | `lindwyrm:...@new-delos` | `did:plc:...` |
| `@telarus@~crossroads` | `telarus:operator@enyalios` | `did:plc:...` |
| `@mischief-muse@lares` | `mischief-muse:node@lares-abc123` | Lares node DID or ephemeral key |

The `~crossroads` tilde prefix denotes a nomadic node — no fixed host, routes through nearest stable nexus.

<<~/ahu >>

<<~ ahu #rooms >>

## Rooms

Settled child rooms in this branch:

<<~ louou lar:///ha.ka.ba/docs/lararium/signal/hud >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/signal/chronometer >>

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
