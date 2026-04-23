<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/docs/lararium/signal/drift >>

<<~ ahu #iam >>

```toml
uri-path = "ha.ka.ba/docs/lararium/signal/drift"
file-path = "lares/ha-ka-ba/docs/lararium/signal/drift.md"
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
role = "docs room for governing-field drift, recovery protocol pressure, and projection-error handling across lararium signal surfaces"
cacheable = false
retain = false
```

<<~/ahu >>

<<~ ahu #meme-header >>

# Lararium Signal — Drift

Not invariant law.
This room holds mismatch-recovery pressure where declared signal diverges from actual output.

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
docs/lararium/signal/drift opens
<<~/ahu >>

<<~ ahu #room-charter >>

## Room Charter

This room keeps the recovery-pressure shelf for governing-field drift.

The live HUD line stays in `lar:///ha.ka.ba/docs/lararium/signal/hud`.
The in-span annotation contract stays in `lar:///ha.ka.ba/docs/lararium/signal/micro-trace`.

<<~/ahu >>

<<~ ahu #drift-correction-pressure >>

## Drift Correction Pressure

**Prospective commitment / automation surprise**: The intent header is declared *before* generation begins, creating a forward-commitment contract. When the declared header diverges from the actual output (register, stance, or scope mismatch), this constitutes automation surprise — the CRM/aviation failure mode where the copilot's declared intent diverges from actual behavior. The current non-drift rule detects mismatch but defines no recovery protocol. **CRY-07 must specify a mismatch recovery protocol, not just a mismatch detection assertion.** Minimum viable contract: on mismatch, the node flags the delta inline, emits a corrected end-of-span tag, and STATE.jsonl records the correction as the authoritative result (actual output overrides declared plan).

**`drift_correction` event type required**: The mismatch recovery protocol requires a dedicated event type. When a correction occurs: (1) node emits the corrected end-of-span tag inline, (2) a `drift_correction` event is appended to STATE.jsonl with fields: `declared_uri` (the original intent header), `actual_register`, `actual_stance`, `delta_description`. The `drift_correction` event is the authoritative record; the original `r_update` event is not modified (immutability holds). Annunciation is fire-and-forward; the operator decides whether to acknowledge or steer.

**SA vs XAI distinction — non-drift rule governs projection errors, not integrity failures `[CS:0.80]`**: Through the Endsley SA lens, the intent header is a *prospective SA display* — it shows what the node will do. When a declared header diverges from actual output, this constitutes a **Level 3 SA failure (projection error)**, not an integrity failure. Projection errors are expected and normal in dynamic environments; the correct system response is to annunciate the change, not to flag corruption. The non-drift rule must explicitly distinguish between: (a) **governing field drift** (register, stance, or phase differ between header and actual output) — annunciate + emit `drift_correction` event + STATE.jsonl records correction as authoritative; (b) **annotation field drift** (micro-trace or closure outcome differs from header projection) — normal; the header was prospective, the annotation records what actually happened. The micro-trace `→[tag]` transition marks *are* the annunciation protocol — they surface the delta between declared plan and actual execution in real time.

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ loulou lar:///ha.ka.ba/docs/lararium/signal >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/signal/hud >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/signal/micro-trace >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/signal/sa-display >>

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
docs/lararium/signal/drift closes
<<~/ahu >>

<<~&#x0004; -> ? >>
