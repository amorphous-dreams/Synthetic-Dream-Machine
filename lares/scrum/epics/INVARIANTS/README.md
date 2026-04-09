# Epic: INVARIANTS — Behavioral Invariants & Trust

> Backlog prefix: `INV-*` (cross-refs: `EP-RA-001`, `TRUST_MODELS`)
> Sprint target: S2
> Status: `[SP:0.45]` 🏛️ — scoped; source research in spikes/; no spec files written yet
> Narrative beat: *The Syadasti reading rule becomes operational. The Lar calibrates.*

---

## Scope

The behavioral contract that makes the Lares node trustworthy — what it must always do, must never do, and how trust levels gate access:

- `lares.core.*` behavioral invariants — named, testable, register-grounded assertions
- Priority layers — how invariants resolve when they conflict
- Trust model — User/Operator/Admin tiers; authority transfer (CMD/CWS/Manual)
- Register guard — what register level is required before a claim can be published
- SAOD design methodology — SA Requirements Analysis, SA-Oriented Design Principles, SA Measurement
- Intent Header semantics — forward-commitment contract; annunciation on header/output divergence
- p-band model — cognitive load management; five-band attention density

## Key Sources (in `lares/scrum/sprints/spikes/`)

| File | What it grounds |
|---|---|
| `A_deep-research-report.md` | `lares.core.*` invariant foundations |
| `EP-RA-001.md` | Bidirectional register/mode protocol; authority transfer |
| `_todo/core/TRUST_MODELS.md` | Admin governance trust model; permission tiers |
| `E-deep-research-report.md` | SA type coverage; SAOD methodology; cognitive capture |

## Open Decisions

- SHD-01: p-band thresholds (numeric or band-labeled?)
- SHD-02: token budget relationship to p-band (BKL-05 empirical work)
- SHD-03: progressive disclosure — HUD complexity ramp over session lifetime

## Narrative Beat

*The Syadasti reading rule is the invariant the Lar carries. Same register scale, different meaning per stance. This is the calibration principle — what makes the HUD legible rather than just present. On Elyncia: the moment the orichalcum's raw resonance becomes navigable through the Syadasti-calibrated lens. On Gaia: the moment register stopped being a universal truth-weight and became stance-dependent confidence.*

*The invariant is not a constraint. It is a navigation chart.*
