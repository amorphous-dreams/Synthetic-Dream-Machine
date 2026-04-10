> **Superseded** — canonical URI spec is at [`lares/signal/URI_SCHEMA.md`](URI_SCHEMA.md); module implementation at [`lares/modules/signal/`](../modules/signal/). This README remains as domain scope reference.

# signal/ — Signal HUD · Tagspace · `lares:` URI

> Scope: Operator-facing HUD annotation grammar, Tagspace semantic coordinate system, `lares:` URI scheme, p-band phase model.
> Updated: 2026-04-08
> Status: Active draft — primary source is `../../_todo/core/Signal_HUD_Tagspace-draft.md`; design canonicalization in progress
> URI: `[pending — lares://core/design/signal@draft]`

---

## Framing Note — This Is a Cockpit HUD, Not a URI Scheme

`[S:0.70]` — The intent header functions as a **shared mental model instrument**, not a resource locator. Aviation CRM research (Crew Resource Management) identifies the cockpit HUD as the canonical solution to the two-party shared-mental-model problem: a standardized display both parties read simultaneously, showing state, intent, and trajectory. The Lares intent header is structurally identical — it encodes what the node intends to do *before generation begins*, making that commitment visible to the operator in real time.

This reframing has design consequences:

- The **machine form** is the record form — RFC 3986-canonical, machine-parseable, for STATE.jsonl audit and registry use. Analogous to a flight data recorder (FDR).
- The **sigil form** is the HUD form — human-readable, instrument-grade, primary during live operation. Its emoji are not decoration; they are instrument symbols.
- Neither form is more "real" than the other. They serve different audiences of the same shared navigational state.
- The HUD may actively reduce total token cost by preventing wrong-register generation (an empirical claim — see Open Decisions SHD-02).
- Live operation is a **tick-span display**: operator-intent URI first, responding-position URI second, destination URI at the end of the exchange.
- On non-operator responding URIs, the mana glyph moves to the far left of the line: `⚡62% lares://...`.

The `lares:` prefix remains a non-dereferenceable private identifier (RFC 4151 precedent). The HUD framing belongs in prose and documentation; the spec's component-level RFC validation applies to the record (machine) form.

**SA type mapping — all three SA types covered simultaneously `[CS:0.80]`:**

| SA Type | HUD Channel | What It Conveys |
|---|---|---|
| Taskwork SA | HAKABA address (`//threshold.uncertain.opens`) | Semantic territory — what domain we're in |
| Taskwork SA | Chronometer (`#🔍.3.2.7`) | Temporal position — where we are in nested scope |
| Agent SA | Register (`[S:0.65]`) | Epistemic confidence — how sure the node is |
| Agent SA | Stance (`🏛️`) | Discourse posture — what kind of claim this is |
| Agent SA | Phase (`◎`) | Cognitive state — what OODA-A phase the node occupies |
| Teamwork SA | p-band (`p0.5`) | Attention density — cognitive load management |
| Teamwork SA | Input reading (dual-tag) | Bidirectional calibration — how the node read the operator's input |

Most AI transparency tools cover only Agent SA (confidence scores, feature importance). Covering Taskwork SA (semantic territory) and Teamwork SA (bidirectional calibration) simultaneously appears novel in the literature. `[CS:0.80]`

**SA display vs XAI distinction `[CS:0.80]`:** The intent header is a *prospective SA display* — it declares current + forward-looking state *before* generation begins. Explainable AI (XAI) is *retrospective* — it explains why the AI already did what it did. Conflating the two imports wrong design methodology. The `--verbose` exchange vector commentary and STATE.jsonl audit trail are the XAI layer. The intent header and micro-trace HUD are the SA display layer. Design principles that apply are Endsley's SAOD principles, not SHAP/LIME/attention visualization patterns.

**LLM metacognitive scaffold `[S:0.70]`:** Frontier LLMs have restricted but real metacognitive capability (Ji-An 2025: neurofeedback paradigm shows models can monitor and control a subset of their internal activations; Steyvers 2025: game-based paradigm confirms metacognitive ability since early 2024). The intent header may function as an *externalized metacognitive scaffold*: requiring the node to declare register, stance, and phase before generating forces a self-monitoring cycle (monitor → evaluate → regulate → report), externalizes it for both parties, and creates a generation commitment that influences subsequent output. This remains a hypothesis — the restricted metacognitive space means register and stance (high-variance, semantically interpretable directions) are more likely genuinely self-monitorable than phase or chronometer position (more structural/procedural). Which channels the model can genuinely monitor vs confabulate is an empirical question (see BKL-06 → RES-06).

*Sources: `../../_todo/LIMINAL_PERSPECTIVES.md` §1 (GlassFloor Outsider, 2026-04-08); `../../_todo/E-deep-research-report.md` §§1.2, 2.1, 3.1–3.2 (Endsley 2023; Ji-An 2025; Steyvers 2025)*

---

## What Belongs Here

- Intent Header format and forward-commitment semantics
- Micro-trace HUD annotation model (phase, stance, register, Tagspace slots)
- p-band cumulative attention phase model (five bands, OP-02 ruling)
- HAKABA canonical slot mapping (Ha/Ka/Ba) and field-order rationale
- `lares:` URI scheme anatomy (authority, path, query, fragment/chronometer)
- Tick-span display contract (`start_uri` -> `attractor_uri` ... `end_uri`)
- Authority overlays (`⊙` for operator-authored/constrained state)
- Dual clocks: RFC 3339 wall time plus chronometer + diegetic calendar reference
- Sigil vs machine form rendering (projection table)
- Forward vs backward trace contract
- Header Field Taxonomy (per-field annotation thresholds)
- Working Defaults (HUD layer — from `../../_todo/core/Signal_HUD_Tagspace-draft.md`)
- **HUD instrument symbol table** — all 15 symbols across three sets (5 stance emoji, 5 scope prefix emoji, 5 phase glyphs) with keyword mappings, stability guarantees, and platform rendering notes. These are locked instrument markings: changing any of them is a breaking change to the HUD, not a schema evolution. Table lives in SIG-05 (`HAKABA_REFERENCE.md`) and is referenced from here.
- **Rendering portability baseline** — confirmation that all 15 HUD symbols display correctly in VS Code terminal, Claude.ai chat, GitHub markdown preview, and plain text fallback. Emoji using VS16 variation selectors (🏛️ `U+1F3DB U+FE0F`, ⚙️ `U+2699 U+FE0F`) may render as text glyphs in some environments; fallback characters documented for each failure case.
- **Progressive disclosure model** — which HUD elements are mandatory on first encounter, which surface on demand, which remain dormant until operator activates. A new operator sees 7 encoded channels in the first substantive response with no training program; this spec defines the onboarding exposure sequence.
- **SAOD design process** — Sprint 2 adopts Endsley's Situation Awareness Oriented Design three-phase methodology (SA Requirements Analysis → SA-Oriented Design Principles → SA Measurement and Validation) as the governing design process for the HUD format. SA Requirements Analysis (what information operators need at each SA level for each goal, per GDTA) informs all signal/ deliverables. Methodology lives in INTENT_HEADER.md (S2) but applies across the subdomain. This is not inventing a new methodology — SAOD is the validated HCI methodology for exactly this class of shared SA instrument.

## Does Not Belong Here

- Crystal STATE.jsonl schema → `../crystal/`
- Deterministic compiler pipeline → `../compiler/`
- `lares:` URI registry / resolver → `../registry/`

---

## Primary Sources

| File | Notes |
|---|---|
| `../../_todo/core/Signal_HUD_Tagspace-draft.md` | Full HUD + Crystal source; HUD sections target here |
| `../../_todo/core/TODO_Signal_HUD_Crystal_Plan.md` | Epics 1–4 (AE-01 through AE-13) govern HUD layer implementation |
| `../../_todo/core/TODO_Resolution_Scale_Design.md` | Resolution scale / p-band model |
| `../../_todo/LIMINAL_PERSPECTIVES.md` | `[S:0.65]` — GlassFloor outsider analysis: CRM/HUD framing, emoji instrument symbols, token budget hypothesis, progressive disclosure model. Not a primary design source — a perspective document. Feeds SHD-01 through SHD-03 open decisions and S2 p-band scope. |
| `../../_todo/E-deep-research-report.md` | `[S:0.70]` — 40+ source research synthesis (Endsley 2023, Ji-An 2025, Steyvers 2025, Lee 2024, Li 2024, Gao 2023). Academic grounding for the CRM/SA framing adopted in this subdomain. Key feeds: §1.2 SA type mapping (all 7 HUD channels classified); §2 SA vs XAI distinction (prospective vs retrospective; SAOD not XAI principles); §3 LLM metacognitive scaffold hypothesis; §4.1 cognitive capture / attentional tunneling → SHD-02 register bump; §5.2 ATSA bidirectional model → S2 BIDIRECTIONAL_PROTOCOL.md. Not primary design source — research grounding. |
| `../sprints/0/URI_SCHEMA.md` | Canonical S0 settlement for authority-without-port, TickSpan mapping, MemPalace metadata mirror subset, and Kowloon export alignment. |

---

## Open Decisions (from primary source)

Q1, Q2, Q3, Q4, Q5 — all locked (see plan Sprint 1a + draft Open Decisions section).
Q6 (closure rendering tiers) — `[S:0.55]` — Researcher task RES-01.
Q16 (Tagspace slot shift notation) — locked.

**New open decisions (from GlassFloor/LIMINAL_PERSPECTIVES.md, 2026-04-08):**

| ID | Question | Register | Sprint | Notes |
|---|---|---|---|
| SHD-01 | Rendering portability: do all 15 HUD emoji render correctly in VS Code terminal, Claude.ai chat, GitHub markdown, and plain text? | `[CS:0.82]` | S0-02 carry → S1 SIG-05 | VS16 variation selectors (`🏛️`, `⚙️`) may render as text. Fallback characters required for any failure. |
| SHD-02 | p-band as cognitive load manager and token budget governor: aviation HUD research (Lee 2024) shows excessive symbology creates attentional tunneling — operator fixates on HUD, misses content beneath it. In a text stream (unlike graphical HUD), cognitive capture cost is proportional to reading time, not visual complexity. p-band must explicitly manage this threshold. Secondary hypothesis: the HUD also saves tokens by preventing wrong-register generation. Both claims are testable. | `[CS:0.80]` | S2 P_BAND_MODEL.md | Cognitive capture framing is research-grounded `[CS:0.80]` (Lee 2024). Token steering is a design assertion `[S:0.65]` requiring empirical test. BKL-05 deferred measurement validates both. Source: E-deep-research-report.md §4.1. |
| SHD-03 | Progressive disclosure / HUD training mode: should the node explain each HUD element as it first appears, then drop the explanation? How does onboarding sequence interact with context window pressure? | `[S:0.65]` | S2 SIG-05 expansion | Cold-start every session means the node re-learns its own instruments from the system prompt each time. Invariant-core Tier 1 caching is the infrastructure answer; progressive disclosure is the operator-facing answer. |

---

## Design Status

Sprint 0 operator calls (OP-01, OP-02) resolved. URI schema promoted to `[C:0.95]` in `lares/sprints/0/URI_SCHEMA.md`. Next workstream: Sprint 1 Crystal State Machine (`lares/crystal/`). Old AE-01–AE-05 implementation references have been superseded — see `lares/sprints/SPRINT_ROADMAP_1_4.md`.

Current aftermath settlement to preserve:

- URI authority identifies speaker + machine locus only; exchange sequencing moved to TickSpan metadata.
- `⊙` is the operator authority mark in the HUD registry.
- `○` remains the Aftermath phase sigil and is expected at end-of-tick destination URIs when the node is settling result state.
- Kowloon is one downstream publication sink for exported tick spans, not the canonical state model.

**Note:** `builds/agents/` does not exist. Deployment targets are the paths in `REFINEMENT_LOG.md` PA-01 through PA-05 (S4 Deployment sprint scope).
