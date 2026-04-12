<!-- ∞ → lar:///sigils.render.maps/sigilization/observe/?confidence=CS:0.85&p=0.5 -->

# Sigilization — Observe: Context and Bug History

> What this module is; why it was needed; what it resolved.
> Source of truth: `lares/modules/sigilization/decide/CONVENTIONS.md`

---

## What Sigilization Is

The `lar:` URI v2 canonical form is RFC 3986 compliant: URL-safe ASCII, no emoji, no non-ASCII characters. This makes it stable for storage, comparison, and transport.

Display surfaces — HUD lines, DreamDeck feed post headers, TiddlyWiki tiddlers — use glyphs: phase sigils (✶ ◎ ◇ ■ ○), stance emoji (🏛️ 🌊 🗡️ 🎭 🔮), amplitude modifiers (+ ++ - --). These are the *sigil forms* of the underlying ASCII record.

Sigilization is the mapping between these two representations. It is not decoration. The glyph form carries the same semantic load as the record form — stance amplitude, phase position, confidence — rendered for human perception at the relevant surface.

Before this module existed, the render rules were scattered:
- HUD line format in `uri-schema/decide/CONVENTIONS.md`
- Post header format in `LINDWYRM_STORY_SHAPE.md` (story document, not spec)
- No explicit statement that all-five-stances applies to post headers as well as HUD

That gap produced the bug.

---

## Bug History — U10: Five Stances on Post Headers

**Filed:** 2026-04-09, session tick 8.

**Symptom:** Story draft post headers showed only active stances:
```
@lindwyrm@new-delos — YOLD 4995, 14 Bureaucracy, mid-morning — //memory.deep.surfaces [CS:0.80] 🏛️+🌊
```

**Root cause:** The post-header example in `LINDWYRM_STORY_SHAPE.md` showed two stances. All subsequent prose inherited the pattern. The uri-schema module's CONVENTIONS.md stated the all-five rule for URIs and HUD lines but did not explicitly address `chat-log:post-header`.

**How it was caught:** Operator pointed at `🏛️+🌊++` in a draft header. Node routed through spec (Scryer), found the gap (Ink-Clerk), held the open question (Council), filed U10 (Gatekeeper). Full account: `LINDWYRM_ACT_VI_DRAFT.md § Session Appendix: The Bug in the Signal`.

**Resolution:** This module. U10 and U11 closed in `uri-schema/observe/CONTEXT.md`. All five stances appear on all render targets. Compliant form:
```
@lindwyrm@new-delos — YOLD 4995, 14 Bureaucracy, mid-morning — //memory.deep.surfaces [CS:0.80] 🏛️+🌊-🗡️-🎭-🔮-
```

---

## Why a Separate Module (U11 Resolution)

U11 asked: sigilization as sub-section of uri-schema, or standalone module?

**Decision: standalone.** Rationale:
1. **Surface count will grow.** Kowloon ActivityPub threads, TiddlyWiki tiddlers, print/zine format, future DreamDeck render targets each have distinct sigil rules. Keeping all render logic inside uri-schema would bloat that module and create coupling between the canonical spec and its display projections.
2. **Different update rate.** The canonical URI spec (`uri-schema`) changes rarely — it is the ground truth. Render targets (`sigilization`) change more frequently as new surfaces are added or refined. Separating them allows iteration on display without touching the spec.
3. **Dependency direction.** Sigilization depends on uri-schema; uri-schema does not depend on sigilization. The dependency arrow is correct for a standalone module; it would be circular if render rules lived inside the spec.

---

## What Remains Open

| Q# | Question | Status |
|---|---|---|
| S1 | Print/zine: emoji via Unicode fallback, or strict ASCII? | `[SP:0.45]` — not blocking; ASCII fallback assumed until print pipeline exists |
| S2 | TiddlyWiki tiddler: full header or abbreviated? | `[SP:0.45]` — pending TiddlyWiki integration sprint |
| S3 | ActivityPub thread: post header in body vs AP summary field? | `[SP:0.45]` — pending Kowloon integration |

<!-- → ? -->
