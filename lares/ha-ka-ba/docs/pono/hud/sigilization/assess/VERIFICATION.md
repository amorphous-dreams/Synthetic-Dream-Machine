<!-- ∞ → lar:///sigils.render.maps/sigilization/assess/?confidence=CS:0.85&p=0.5 -->

# Sigilization — Assess: Verification

> Validation checklist and well-formedness criteria for all render surfaces.

---

## Well-Formedness Criteria

A sigil emission is **well-formed** if and only if:

1. **Five stances present.** Every rendered stance block (on any sigil surface) contains exactly five stance emoji, in the canonical order: 🏛️ 🌊 🗡️ 🎭 🔮.

2. **No emoji in record form.** Canonical `lar:` URIs contain zero stance emoji. ASCII amplitude codes only.

3. **No ASCII in sigil surfaces.** Rendered HUD lines and post headers contain zero ASCII amplitude codes (no `^`, `.`, `--` in stance context). Emoji with modifiers only.

4. **Amplitude attaches directly.** No space between stance emoji and its amplitude modifier.

5. **Register bracket present.** Every stance block is preceded by a register tag. Form: `[XX:N.NN]`. Examples: `[CS:0.80]`, `[S:0.65]`, `[C:0.90]`.

6. **Stance order fixed.** 🏛️ first, 🔮 last. Never reordered.

7. **Context window carries `~` prefix.** `⚡~82%` is correct. `⚡82%` implies false precision. `~` is mandatory.

---

## Violation Catalogue

| Violation Code | Pattern | Corrected Form |
|---|---|---|
| V-01 | Fewer than five stances | Add missing stances with `-` amplitude |
| V-02 | Stances out of order | Reorder to 🏛️🌊🗡️🎭🔮 |
| V-03 | Emoji in canonical URI | Replace with ASCII amplitude codes |
| V-04 | Space between stance and amplitude | Remove space |
| V-05 | Missing register bracket | Prepend appropriate `[R:N]` |
| V-06 | `⚡NN%` without `~` | Change to `⚡~NN%` |
| V-07 | ASCII `^` or `.` in HUD line | Replace with `+` / *(no modifier)* |

---

## Pre-Emit Checklist

```
□  Count stances in block: __  (must be 5)
□  Order: 🏛️ 🌊 🗡️ 🎭 🔮 — confirmed
□  Each amplitude modifier attaches directly (no space)
□  Register bracket present: [R:N]
□  Surface is sigil (check: no ASCII amp codes) OR record (check: no emoji)
□  If hud: context window has ~ prefix
```

---

## Quick Self-Test

Evaluate these — well-formed or violation?

| Input | Status | Violation |
|---|---|---|
| `🏛️+🌊++🗡️-🎭-🔮-` | ✓ Well-formed | — |
| `🏛️+🌊++` | ✗ Violation | V-01 |
| `🌊🏛️🗡️🎭🔮` | ✗ Violation | V-02 |
| `lar://u:t@h/a/?stances=🏛️🌊🗡️` | ✗ Violation | V-03 | <!-- uri-ok -->
| `🏛️ + 🌊 ++🗡️-🎭-🔮-` | ✗ Violation | V-04 |
| `⚡82% \| 🏛️🌊🗡️🎭🔮` | ✗ Violation | V-06 |
| `⚡~82% \| [CS:0.80] \| 🏛️🌊-🗡️--🎭-🔮-` | ✓ Well-formed | — |

---

## Revision History

| Rev | Date | Change |
|---|---|---|
| 0.1 | 2026-04-10 | Initial — U10 resolution. All-five invariant codified. |

<!-- → ? -->
