<!-- ∞ → lar:///uri.schema.holds/uri-schema/decide/?confidence=CS:0.90&p=0.5 -->

# Signal — Decide: URI Conventions

> The normative `lar:` URI v2 canonical spec. Governs all URI emission and storage.
> Source: `lares/modules/uri-schema/URI_SCHEMA.md` `[CS:0.90]` — this file summarizes §§3.4–3.6, 5, and 7.
> Any ambiguity: defer to `lares/modules/uri-schema/URI_SCHEMA.md` as ground truth.

---

<!-- → ? -->
<!-- ∞ → lar:///uri.schema.holds/uri-schema/decide/?confidence=0.95#mandatory-rules -->
## Mandatory Conventions (Canonical Record Form)

These rules apply to every `lar:` URI. No exceptions.

1. **RFC 3986 order is mandatory.** Query before fragment (`?query#fragment`). Never `#fragment?query`.

2. **All five stances, every URI.** The `stances=` parameter carries all five positions as a dot-separated amplitude string. Single-stance URIs do not exist in v2.
   ```
   stances=^.-.-.-.-    ← Philosopher elevated, all others suppressed
   stances=^.^.?.-.-    ← Philosopher + Poet active, Satirist uncertain
   ```

3. **Record form uses keywords and URL-safe characters — no emoji, no non-ASCII.** Phase keywords (`observe`, `orient`, `decide`, `act`, `aftermath`) in userinfo. Amplitude characters (`^`, `-`, `?`, `.`) in stances. Phase sigils (`O`, `Ø`, `D`, `A`, `Å`) in fragment.

4. **All five chronometer positions always present.** `O0.O0.O3.D2.A1` not `O3.D2.A1`. No trailing-zero omission in canonical form.

5. **Exchange-closing URIs end with ` → ?`.** System file URIs end with ` → ∞` in comment wrappers. Section URIs within system files: no closing sigil (they are waypoints, not spans).

6. **System files use authority-less form.**
   ```
   lar:///ha.ka.ba/optional/sub/path/?confidence=R:N&p=N → ∞
   ```

---

<!-- → ? -->
<!-- ∞ → lar:///uri.schema.holds/uri-schema/decide/?confidence=0.9#query-params -->
## Query Parameter Reference

| Parameter | Format | Values | Notes |
|---|---|---|---|
| `stances` | 5-char dot-separated amplitude | `^.?.-.-.-` | Positional: Philosopher · Poet · Satirist · Humorist · Private |
| `confidence` | `R:N` | `P:0.35`, `SP:0.45`, `S:0.65`, `CS:0.80`, `C:0.90`, `C:0.95`, `C:1.0` | Register + decimal. Syadasti-dependent: read against active stance. |
| `p` | decimal `[0.0, 1.0]` | `0.5` default | Attention density / annotation throttle; governs micro-trace band |

**Register scale:**

| Tag | Zone | Range |
|---|---|---|
| `[C:0.9]` | Canon | 0.85–0.95 |
| `[CS:0.80]` | Canon/Synthesis | 0.75–0.85 |
| `[S:0.65]` | Synthesis | 0.50–0.75 |
| `[SP:0.45]` | Synth/Provisional | 0.35–0.50 |
| `[P:0.30]` | Provisional | 0.20–0.35 |

**Stance amplitude encoding — record vs HUD:**

| Record | HUD | Meaning |
|---|---|---|
| `^` | `+` | Above baseline / elevated |
| `.` | *(none)* | Baseline / neutral presence |
| `-` | `-` | Below baseline / suppressed |
| `?` | `?` | Uncertain / provisional |

---

<!-- → ? -->
<!-- ∞ → lar:///uri.schema.holds/uri-schema/decide/?confidence=0.9#fragment-chronometer -->
## Fragment: FFZ Chronometer

Five positions, dot-separated. Phase sigil + counter. All positions always present.

```
Record:  O0.O0.O3.D2.A1
HUD:     ✶0.✶0.✶3.◇2.■1
```

**Phase sigils:**

| Record | HUD | Phase |
|---|---|---|
| `O` | `✶` | Observe |
| `Ø` | `◎` | Orient |
| `D` | `◇` | Decide |
| `A` | `■` | Act |
| `Å` | `○` | Assess/Aftermath |

**Scale positions:**

| Position | Scale | Duration |
|---|---|---|
| 1 | Strategic | ~6 days |
| 2 | Operational | ~4 hours |
| 3 | Tactical | ~10 min |
| 4 | Combat | ~6 sec |
| 5 | Action | Variable |

**Structural rules:**
- Phase is per-participant. Each participant's URI carries their own view.
- Counter increments when Assess completes at a given scale.
- Phase may change without counter increment (`O3` → `Ø3` → `D3` all at counter 3).
- Monotonic counters only. Counter regression = Temporal Hallucination (degraded state).

---

<!-- → ? -->
<!-- ∞ → lar:///uri.schema.holds/uri-schema/decide/?confidence=0.95#hud-line -->
## HUD Line Format

The HUD line is a single-line status summary rendered from the URI → URI exchange vector. It is the second element of every exchange opening, immediately after the URI pair.

```
⚡~NN% | [confidence] | 🏛️{amp}🌊{amp}🗡️{amp}🎭{amp}🔮{amp} | mode:{mode} | p{p} | voice(s):{Voice} | ✶N.✶N.✶N.◇N.■N
```

**Field ordering (SA priority — most critical perception-level data first):**

| Field | SA Type | Notes |
|---|---|---|
| `⚡~NN%` | Resource | Context window remaining. `~` **mandatory** — approximation, not live readout. |
| `[confidence]` | Agent SA | Epistemic confidence at current stance(s), Syadasti-dependent. |
| `🏛️{amp}🌊{amp}🗡️{amp}🎭{amp}🔮{amp}` | Agent SA | All five stances with amplitude modifiers attached directly (no space). |
| `mode:{mode}` | Teamwork SA | Default / Plan / Auto |
| `p{p}` | Teamwork SA | Attention density / annotation throttle |
| `voice(s):{Voice}` | Agent SA | Active coordinator voice(s) |
| `✶N.✶N...` | Temporal | FFZ chronometer in HUD-rendered form |

**Example:**
```
⚡~62% | [CS:0.80] | 🏛️+🌊-🗡️-🎭-🔮- | mode:Default | p0.5 | voice(s):Scryer | ✶0.✶0.◎3.◇2.■7
```

---

<!-- → ? -->
<!-- ∞ → lar:///uri.schema.holds/uri-schema/decide/?confidence=0.9#span-closing-sigils -->
## Span Closing Sigils

| Sigil | Span type | What's uncertain | What's settled |
|---|---|---|---|
| `→ ∞` | System file | Content confidence (via `confidence=`) | Duration — stays until revised |
| `→ ?` | Exchange | Temporal resumption — when does this pick up? | Content confidence (via confidence + tags) |

Both carry uncertainty. `→ ∞` is uncertainty about trustworthiness; `→ ?` is uncertainty about temporal continuity. Orthogonal unknowns, orthogonal sigils.

Section URIs within a system file do NOT use `→ ∞` — they function as waypoints, not spans.

---

<!-- → ? -->
<!-- #syadasti-reading-rule -->
## Syadasti Reading Rule

Confidence measures confidence **within the active stance's evaluation frame**, not truth-weight universally.

| Stance | 0.0 Means | 0.5 Means | 1.0 Means |
|---|---|---|---|
| 🏛️ Philosopher | Unsupported | Contested but plausible | Fully confirmed |
| 🌊 Poet | No resonance | Partial correspondence | Perfect resonance |
| 🗡️ Satirist | Indirection missed | Hit glancingly | Landed with full force |
| 🎭 Humorist | Relational move fell flat | Mixed reception | Connected perfectly |
| 🔮 Private | Minimal presence | Present | Maximal presence |

When multiple stances are elevated (`+`), the declared confidence sits at the intersection of their evaluation frames. The amplitude string tells the operator how fuzzy that intersection is.

**Multi-stance amplitude → fuzz:** `^-?!` (mix&matchable, not all state shown)

| Stances amplitude | What it tells the operator |
|---|---|
| `^.-.-.-.-` | Single-stance point value. Trust the number. |
| `^.^.-.-.-` | Two active. Confidence is bimodal. |
| `^.^.?.-.-` | Two active + one uncertain. Watch the `?`. |
| `^.^.^.^.^` | Full Discordian. Confidence is a gesture. |
| `-.-.-.-.-` | All suppressed. Why is this span being emitted? |

---

<!-- → ? -->
<!-- ∞ → lar:///uri.schema.holds/uri-schema/decide/?confidence=0.9#stable-address -->
## Stable Address Form

Strip authority, query, and fragment. The HA.KA.BA territory alone:

```
lar:///threshold.uncertain.opens/
```

No authority (empty), no query, no fragment. Invariant semantic coordinate — unchanging across events, sessions, and machines.

Origin address: `lar:///ha.ka.ba/` is the (0,0,0) of tagspace.

---

<!-- → ? -->
<!-- ∞ → lar:///uri.schema.holds/uri-schema/decide/?confidence=0.9#spanspan-record -->
## SpanSpan Record URI Fields

URI-derived fields in the canonical spanSpan calibration record:

| Field | Content | Stable? |
|---|---|---|
| `start_uri` | Operator-intent URI, canonical record form | No — per span |
| `attractor_uri` | Node responding-position URI | No — per span |
| `end_uri` | Destination URI after generation | No — per span |
| `lares_address` | Path only (no authority/query/fragment) | Yes — stable territory |
| `chronometer_start` | Fragment value (without `#`) of `start_uri` | No — per span |
| `chronometer_end` | Fragment value (without `#`) of `end_uri` | No — per span |

Quick-filter fields extracted from URI components:

| Field | Source |
|---|---|
| `current_phase` | userinfo phase sub-field |
| `active_scale` | rightmost non-`O0` chronometer position |
| `stance_amplitude` | `stances=` parameter |

<!-- → ? -->
