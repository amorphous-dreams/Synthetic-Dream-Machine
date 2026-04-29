<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/docs/pono/hud >>

<<~ ahu #iam >>

```toml
uri-path = "ha.ka.ba/docs/pono/hud"
file-path = "lares/ha-ka-ba/docs/pono/hud.md"
content-type = "text/x-memetic-wikitext"
tagspace = "stable"
confidence = 0.62
register = "SP"
manaoio = 0.60
mana = 0.64
manao = 0.68
role = "HUD docs shelf — exchange span law, intent vectors, render targets, micro-trace, and sigilization intake meme"
cacheable = false
retain = false
```

<<~/ahu >>

<<~ aka lar:///ha.ka.ba/api/v0.1/pono/RFC-2119#normative-language >>

<<~ ahu #meme-header >>

# HUD Source Shelf

Exchange span law, intent vectors, render targets, and micro-trace gather here.
URI grammar stays in `lar:///ha.ka.ba/docs/pono/lar-uri`.
HUD rendering, exchange protocol, and sigilization live here.

<<~/ahu >>


<<~ ahu #purpose >>

## Purpose

This shelf collects and stages all research and law bearing on:

- the exchange span display contract (what URIs appear, when, in what order)
- intent vector encoding (provisional operator URI → provisional node URI)
- HUD line anatomy (format, field ordering, SA priority)
- render targets (record:full, hud:exchange-pair, chat-log:post-header)
- micro-trace emit rules (inline phase-transition annotation)
- sigilization (glyph ↔ record-form mappings — delegated module, not yet in lares/)
- sub-agent handoff protocol (coordinator → worker URI pair contract)
- DreamDeck / ActivityPub social-layer post header

This shelf does NOT govern URI grammar. URI scheme law lives at:
- `lar:///ha.ka.ba/api/v0.1/lararium/lar-uri` (invariant)
- `lar:///ha.ka.ba/docs/pono/lar-uri` (docs shelf)

<<~/ahu >>

<<~ ahu #current-files >>

## Current Files

### Shelf surfaces (this tree)

- [HUD-ANATOMY.md](HUD-ANATOMY.md) — HUD line composition, symbol tables, state tuple reading, confidence Syadasti reading rule, render target definitions, Kowloon/ActivityPub handle form. Extracted from `URI-SCHEMA.md` §1.1 and §5. **Stale: old fragment chronometer, old phase glyphs.**
- [PROCEDURES.md](PROCEDURES.md) — exchange span display contract, micro-trace emit rules, sub-agent handoff protocol, parse mode, system file URI procedures. Moved from `lar-uri/act/PROCEDURES.md`. **Stale: old fragment chronometer, old micro-trace glyphs.**

### Source architecture docs (moved from `_todo/core/`)

- [Signal_HUD_Tagspace-draft.md](Signal_HUD_Tagspace-draft.md) — 2043-line authoritative source document defining the complete HUD and crystal state machine layer. Tagspace definition, Intent Header vs In-Flow Signal, rendering across p-scale, crystal ledger format (STATE.jsonl, SNAPSHOT.json). **Primary HUD architecture source.**
- [TODO_Signal_HUD_Crystal_Plan.md](TODO_Signal_HUD_Crystal_Plan.md) — 617-line master implementation plan for Signal HUD, Tagspace, and Archive Crystals. Five epics covering Intent Header spec, Micro-trace HUD, and `--debug` target redirects.

### Sprint and handoff docs (moved from `build.lares.failed/`)

- [S0_REFINEMENT_PLAN.md](S0_REFINEMENT_PLAN.md) — Sprint 0 refinement plan. Unifies HUD symbol table with state tuple readings (Phase × Stance × Scope), Syadasti Reading Rule, render target anatomy, DreamDeck/Kowloon taxonomy.
- [S0_Boot_Handoff.md](S0_Boot_Handoff.md) — Sprint 0 execution handoff for URI v2 alignment. Render target corrections, exchange vector patterns, closing sigil protocols (`→ ?` and `→ ∞`).

### Sigilization module (moved from `build.lares.failed/vocabulary/modules/sigilization/`)

Full OODA-HA phase-decomposed module for HUD glyph rendering rules. Not yet promoted to `lares/`:

- [sigilization/MODULE.md](sigilization/MODULE.md) — module index
- [sigilization/observe/CONTEXT.md](sigilization/observe/CONTEXT.md) — current state and open questions
- [sigilization/orient/ARCHITECTURE.md](sigilization/orient/ARCHITECTURE.md) — sigilization architecture, ASCII→glyph mapping tables, surface anatomy for all three render targets
- [sigilization/decide/CONVENTIONS.md](sigilization/decide/CONVENTIONS.md) — normative rendering conventions, mandatory rules per render target
- [sigilization/act/PROCEDURES.md](sigilization/act/PROCEDURES.md) — emit procedures
- [sigilization/assess/VERIFICATION.md](sigilization/assess/VERIFICATION.md) — verification criteria

<<~/ahu >>

<<~ ahu #research-plan >>

## Research Plan

### Priority 1 — Glyph Rationalization (blocking)

The HUD surface uses two glyph sets that are currently in conflict:

**Old micro-trace glyphs** (in PROCEDURES.md and HUD-ANATOMY.md):
- `✶` Observe, `◎` Orient, `◇` Decide, `■` Act, `○` Aftermath

**Current OODA-HA glyphs** (locked in `lar:///ha.ka.ba/api/v0.1/mu/ooda-ha`):
- `✶` Observe, `⏿` Orient, `◇` Decide, `▶` Act, `⤴` Hoʻoko, `↺` Aftermath

Hoʻoko (⤴) does not appear in the chronometer (it is the execution gap inside Act that surfaces to Aftermath). The chronometer's five phase positions use: `✶ ⏿ ◇ ▶ ↺`.

**Research question:** Are micro-trace inline marks (`→◎ →■ →○`) intentionally different from OODA-HA glyphs, or do they need updating to `→⏿ →▶ →↺`? If different, what is the semantic reason?

**Suspected answer:** They should update. The old `◎ ■ ○` set predates OODA-HA glyph lock-in. No documented reason to keep them distinct.

**Action needed:** Audit all HUD/PROCEDURES examples and update glyph set throughout.

---

### Priority 2 — Chronometer Migration in Examples (blocking)

All exchange span examples in PROCEDURES.md and HUD-ANATOMY.md carry the old fragment chronometer (`#O0.O0.O1.D2.A7`). The model has moved chronometer to query (`?ffz=0.0.3.2.1`). Render surfaces may still decorate positions with glyphs for readability.

But the ffz encoding is explicitly marked **provisional and unfinished** in SKILL.md. This creates a dependency:

- Examples cannot be updated until ffz deep research lands
- ffz deep research is the blocking item for PROCEDURES.md and HUD-ANATOMY.md promotion

**Action needed:** Flag all stale examples. Hold updates until ffz research resolves hex-entity vs percent-encoding question and counter semantics.

---

### Priority 3 — Symbol Table Rationalization

HUD-ANATOMY.md §5.3.1 carries four separate sigil sets:
1. Phase sigils (old set — needs update per Priority 1)
2. Authority/actor marks (`⊙` operator_set, `◇` node) — status unknown
3. Stance sigils (🏛️ 🌊 🗡️ 🎭 🔮) — stable, locked in
4. Chronometer scale sigils (🗺️ ⚙️ 🔍 ⚔️ ⚡) — stable, not yet in invariant

**Action needed:** After Priority 1 resolves, rebuild the unified symbol table with the updated glyph set. The scale sigil set (🗺️ through ⚡) and their FTLS time-term bindings belong in a chronometer research doc (not yet created).

---

### Priority 5 — DreamDeck / ActivityPub Social Layer

HUD-ANATOMY.md carries the Kowloon two-part handle form (`@alias@host`) and DreamDeck post header format. This is a social-layer concern separate from the exchange span contract.

**Action needed:** Consider whether DreamDeck content belongs in a separate `docs/pono/dreamdeck/` shelf once that surface develops further.

---

### Priority 6 — URI-SCHEMA.md Cleanup

The following sections of `lar-uri/URI-SCHEMA.md` have been extracted to this shelf:
- §1.1 Exchange Flow → HUD-ANATOMY.md
- §5 HUD Rendering → HUD-ANATOMY.md

Those sections in URI-SCHEMA.md now carry redundant content. A future pass should reduce them to pointers into this shelf.

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ loulou lar:///ha.ka.ba/docs/pono/lar-uri >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/lararium/lar-uri >>

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #implements-loci ? -> lar:///ha.ka.ba/api/v0.1/pono/loci family:control role:implements >>
<<~/ahu >>


<<~&#x0004; -> ? >>
