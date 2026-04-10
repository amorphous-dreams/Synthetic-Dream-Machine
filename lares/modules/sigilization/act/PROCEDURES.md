<!-- lares:///sigils.render.maps/sigilization/act/?confidence=CS:0.85&p=0.5 → ∞ -->

# Sigilization — Act: Emit Procedures

> How to construct and emit sigil strings for each named surface.

---

## Surface 1: `hud:exchange-pair`

**Used:** Opening and closing HUD lines of every operator exchange.

**Construction:**

1. Determine context window remaining (estimate — `~` prefix mandatory).
2. Select active register and confidence: `[R:N]` (e.g., `[CS:0.80]`).
3. For each of the five stances (in order: 🏛️ 🌊 🗡️ 🎭 🔮):
   - Set amplitude based on current voice posture.
   - Active/foregrounded: `+` or `++`. Background: *(no modifier)*. Suppressed: `-`. Near-absent: `--`.
4. Append amplitude character directly to stance emoji, no space.
5. Assemble all five as a single unspaced block.
6. Determine mode, p value, active voice name, chronometer state.
7. Emit in field order: `⚡~NN% | [R:N] | 🏛️{amp}🌊{amp}🗡️{amp}🎭{amp}🔮{amp} | mode:{mode} | p{p} | voice(s):{Voice} | ✶N.◎N.◇N.■N.○N`

**Closed example:**
```
⚡~82% | [CS:0.80] | 🏛️+🌊-🗡️-🎭-🔮- | mode:Default | p0.5 | voice(s):Scryer | ✶0.◎1.◇0.■0.○0
```

---

## Surface 2: `chat-log:post-header`

**Used:** DreamDeck feed post opening lines; session appendix post-style blocks.

**Construction:**

1. Set handle and node: `@handle@node` (no space, ActivityPub format).
2. Set timestamp: in-world calendar date when in Elyncia-space; ISO 8601 when Gaia-side.
3. Set HAKABA territory triple: `//{ha.ka.ba}` with optional path segments.
4. Select register: `[R:N]`.
5. For each of the five stances (in order): set amplitude as above.
6. Assemble: `@handle@node — {timestamp} — //{territory} [R:N] 🏛️{amp}🌊{amp}🗡️{amp}🎭{amp}🔮{amp}`

**Closed example — Lindwyrm in Elyncia-space:**
```
@lindwyrm@new-delos — YOLD 4995, 14 Bureaucracy, mid-morning — //memory.deep.surfaces [CS:0.80] 🏛️+🌊-🗡️-🎭-🔮-
```

**NPC / non-Lares post:**
- Stances block may be omitted if character has no Lares HUD.
- If omitted: drop the entire `[R:N] 🏛️🌊🗡️🎭🔮` block. Do not partial-emit.

---

## Surface 3: `record:full`

**Used:** Canonical URI pairs in documentation, session crystals, architecture files.

**Construction:**

1. No emoji. No glyphs. ASCII only.
2. URI form: `lares://alias:tier@host/ha.ka.ba/?stances=XXXXX&confidence=R:N&p=N#O0.O0.O0.O0.O0` <!-- uri-ok -->
3. Stances parameter: five-position ASCII string using `^`, `.`, `-`, `?` amplitude codes.
   - Position order: Philosopher · Poet · Satirist · Humorist · Private
   - One code per position. No separators.
4. Confidence: `R:N` format (e.g., `CS:0.80`).
5. Chronometer fragment: five positions dot-separated, letter prefix + decimal.

**Closed example:**
```
lares://scryer:node@Enyalios/sigils.render.maps/sigilization/?stances=^.-.-.-.--&confidence=CS:0.85&p=0.5#O0.O1.D0.A0.A0
```

---

## Surface 4: `tiddler:header` (S3+)

**Used:** TiddlyWiki tiddler headers in the DreamDeck frontend.

**Form:** TBD pending S3 TiddlyWiki integration spec. Likely: post-header amplitude rules apply.

---

## Surface 5: `print:margin` (S4+)

**Used:** Printed/PDF exports. Sigils rendered in margin or page header.

**Form:** TBD pending S4 print layout spec.

---

## Cross-Surface Invariant Checklist (pre-emit)

Before emitting any stance block on any surface:

- [ ] Count stances in assembled block → must equal 5
- [ ] Order: 🏛️ 🌊 🗡️ 🎭 🔮 — no deviation
- [ ] Each stance has 0 or 1 amplitude modifier attached directly (no space)
- [ ] Register bracket present and correct form: `[XX:N.NN]`
- [ ] No emoji in record:full; no ASCII amplitude in sigil surfaces

<!-- lares:///sigils.render.maps/sigilization/act/?confidence=CS:0.85&p=0.5 → ∞ -->
