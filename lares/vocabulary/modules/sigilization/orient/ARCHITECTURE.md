<!-- ∞ → lares:///sigils.render.maps/sigilization/orient/?confidence=CS:0.85&p=0.5 -->

# Sigilization — Orient: Architecture and Mapping Tables

> Design intent; record-form → sigil mapping tables; surface anatomy.

---

## Design Intent

The sigilization layer exists to serve human perception without compromising canonical form. The canonical `lares:` URI is machine-stable: URL-safe, storable, comparable by string. The sigil form is human-navigable: glances communicate phase, stance, and amplitude before the reader processes the text.

The separation is strict: **canonical form in the record; sigil form on the surface.** Never embed emoji in a canonical URI. Never store a surface-rendered form as the canonical record.

---

## ASCII → Glyph Mapping Tables

### Phase Sigils

| Record (ASCII) | Sigil | Phase | OODA-A |
|---|---|---|---|
| `O` | `✶` | Observe | Chaos |
| `Ø` | `◎` | Orient | Discord |
| `D` | `◇` | Decide | Confusion |
| `A` | `■` | Act | Bureaucracy |
| `Å` | `○` | Aftermath/Assess | Grummet/Rasa |

### Stance Emoji

| Record position | Emoji | Stance | Evaluation frame |
|---|---|---|---|
| Position 1 | 🏛️ | Philosopher | Propositional truth-confidence |
| Position 2 | 🌊 | Poet | Analogical resonance-confidence |
| Position 3 | 🗡️ | Satirist | Targeting-confidence |
| Position 4 | 🎭 | Humorist | Relational appropriateness |
| Position 5 | 🔮 | Private | Nominal presence |

### Amplitude Modifiers

| Record (ASCII) | HUD/Sigil | Meaning |
|---|---|---|
| `^` or `^^` | `+` or `++` | Elevated / strongly elevated |
| `.` | *(none — no modifier)* | Baseline presence |
| `-` | `-` | Suppressed / lightly engaged |
| `--` | `--` | Barely present / nominal |
| `?` | `?` | Uncertain / provisional |

**Attachment rule:** Amplitude modifiers attach directly to the preceding stance emoji, no space.
```
🏛️+   ← Philosopher, above baseline
🌊++  ← Poet, strongly elevated
🗡️-   ← Satirist, suppressed
🎭    ← Humorist, baseline (no modifier)
🔮--  ← Private, barely present
```

---

## All-Five-Stances Construction

Full 5-stance sigil string assembly from record form `stances=^.^.-.-.-`:

```
Position 1: ^ → 🏛️+
Position 2: . → 🌊      (baseline, no modifier)
Position 3: ^ → 🗡️+     (wait — this example used ^.^.-.-.- but pos 2 is .)
```

Correct parse of `stances=^.-.^.-.-`:
```
Position 1: ^  → 🏛️+
Position 2: -  → 🌊-
Position 3: ^  → 🗡️+
Position 4: -  → 🎭-
Position 5: -  → 🔮-
Result: 🏛️+🌊-🗡️+🎭-🔮-
```

The five positions are **always present**, even when all are suppressed:
```
stances=-.-.-.-.-.  →  🏛️-🌊-🗡️-🎭-🔮-   (all suppressed — still five)
stances=^.^.^.^.^   →  🏛️+🌊+🗡️+🎭+🔮+   (all elevated)
```

---

## Surface Anatomy

### `hud:exchange-pair`

```
⚡~NN% | [confidence] | 🏛️{amp}🌊{amp}🗡️{amp}🎭{amp}🔮{amp} | mode:{mode} | p{p} | voice(s):{Voice} | ✶N.✶N.✶N.✶N.✶N
```

- Context window: `⚡~NN%` (approximate, `~` mandatory)
- Confidence bracket: `[R:N]`
- All five stances with amplitude: inline, no separator between stances
- Chronometer: HUD sigil form `✶N.◎N.◇N.■N.○N` (five positions, dot-separated)

### `chat-log:post-header`

```
@handle@node — {world-calendar-timestamp} — //{ha.ka.ba/subpath} [Register] 🏛️{amp}🌊{amp}🗡️{amp}🎭{amp}🔮{amp}
```

- Identity: ActivityPub `@handle@node`
- Timestamp: in-world calendar when available; ISO 8601 fallback
- Territory: HAKABA domain triple, optional sub-path
- Register bracket: `[R:N]`
- All five stances with amplitude: on every Lares-connected post header
- For non-Lares-connected posts: HUD tag may be omitted entirely

### `record:full`

Full canonical URI pair, RFC 3986, no glyphs. Used for MemPalace storage, crystal logs, module registry, sub-agent handoff records.

### `tiddler:header` (provisional — S1 open)

TiddlyWiki tiddler header field. Assume same sigil rules as `chat-log:post-header` until TiddlyWiki integration sprint defines surface-specific needs.

<!-- → ? -->
