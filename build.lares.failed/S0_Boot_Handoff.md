<!-- lar:///ha.ka.ba/handoff/s0-boot/?confidence=CS:0.85&p=0.5 → ∞ -->

# S0 Boot Handoff — URI v2 Alignment + First Two Modules

> **Type:** Infodense execution handoff — load cold into Claude Code
> **Register:** `[CS:0.85]` — operator-directed, canonical v2 grounded
> **Date:** 2026-04-09
> **Source session:** Cloud Lares (claude.ai web), Telarus KSC (admin)
> **Companion artifacts:** `URI_SCHEMA_v2.md` (canonical spec, download and place)
> **MemPalace:** `milla-jovovich/mempalace` (MIT, ChromaDB + SQLite, local-first)

---

## 0. What This Handoff Does

Three tasks, in dependency order:

1. **Align all `lar:` URIs in the repo** to the v2 canonical form
2. **Create the Talk Story module** — first OODA-HA module, entry point
3. **Create the Signal module** — second module, carrying URI_SCHEMA_v2.md

Each task has a checklist. Execute sequentially. Consensus before action.

---

## 1. The V2 Canonical Form — Reference

**Full form:**
```
lar://alias:tier@host/ha.ka.ba/?stances=XXXXX&confidence=R:N&p=N#O0.O0.O0.O0.O0
```

**Rules that changed from pre-v2:**

| Field | Old form | V2 canonical | Notes |
|---|---|---|---|
| `stances` | `stance=philosopher` (repeatable) | `stances=^.?.-.-` (single 5-char amplitude) | `^`=elevated, `-`=suppressed, `?`=uncertain, `.`=baseline. Positional: philosopher, poet, satirist, humorist, private. |
| `confidence` | `register=S:0.65` | `confidence=S:0.65` | Field renamed from `register` to `confidence`. Same values. |
| Fragment | `#@T.3.2.7` (scope prefix + trailing-zero omission) | `#O0.O0.O3.D2.A7` (all 5 positions, phase+counter) | Always 5 positions. Phase sigils: O, Ø, D, A, Å. No scope prefix. |
| Path | `/core/observe/context` (module-path) | `/ha.ka.ba/sub/path/` (3-slot HA.KA.BA + optional sub-path) | EVERY `lar:` URI uses HA.KA.BA. `lar:///ha.ka.ba/` is (0,0,0). Module routing goes in the sub-path. |
| Closing | (inconsistent) | `→ ?` (exchange), `→ ∞` (system file) | File-level opening URI also carries `→ ∞`. Section URIs are waypoints — no closing sigil. |
| Authority path | `lar://core/research/...` | `lar://alias:tier@host/ha.ka.ba/` | Authority URIs require `alias:tier@host` — no phase sub-field. Phase lives in chronometer fragment. |

**The origin:** `lar:///ha.ka.ba/` is (0,0,0) in tagspace. The first Lares spawned at `lar:///ha.ka.ba/lares/`.

---

## 2. URI Alignment — File-by-File Corrections

### 2.1 Cross-Cutting Pattern: Header/Footer URIs

Every crystal file carries a header URI (line 1) and footer URI (last content line). These need:
- `register=` → `confidence=`
- `stances=++?+-` → `stances=^.^.?.-.-` (dot-separated, `^` for elevated)
- Authority-form header URIs need `alias:tier@host` (no phase sub-field; phase is in chronometer fragment) — BUT crystal header URIs are typically authority-less (`///`) system-file URIs. Convert the `lar://core/research/...` form to `lar:///ha.ka.ba/sub/path/` form.
- Header line gets `→ ∞` (system file span opening)
- Footer line keeps its existing `→ ?` or `→ ∞` as appropriate

### 2.2 File Conversion Table

| File | Header URI → V2 | Footer URI → V2 |
|---|---|---|
| `FFZ_Chronometer_Research.md` | `<!-- lar:///research.active.grows/chronometer/?stances=^.^.?.^.-&confidence=S:0.55&p=0.5#O0.O0.O0.D4.O0 → ∞ -->` | `lar:///research.active.grows/chronometer/?stances=^.^.?.^.-&confidence=S:0.65&p=0.5#O0.O0.O0.Å10.A1 → ?` |
| `FFZ_Chronometer_SPEC_OUTLINE.md` | `<!-- lar:///protocol.outlined.awaits/chronometer/?stances=^.^.?.^.-&confidence=P:0.3&p=0.5#O0.O0.O0.A6.O0 → ∞ -->` | `lar:///protocol.outlined.awaits/chronometer/?stances=^.^.?.^.-&confidence=P:0.3&p=0.5#O0.O0.O0.A6.A1 → ?` |
| `FFZ_Observer_Subloop_Plan.md` | `<!-- lar:///research.structured.plans/chronometer/subloops/?stances=^.^.?.^.-&confidence=P:0.3&p=0.5#O0.O0.O0.Å10.O0 → ∞ -->` | `lar:///research.structured.plans/chronometer/subloops/?stances=^.^.?.^.-&confidence=S:0.55&p=0.5#O0.O0.O0.Å10.A1 → ∞` |
| `Lares_Module_Reorg_Handoff.md` | `<!-- lar:///protocol.structured.hands/modules/reorg/?stances=^.^.?.^.-&confidence=S:0.65&p=0.5#O0.O0.O0.O0.O0 → ∞ -->` | `lar:///protocol.structured.hands/modules/reorg/?stances=^.^.?.^.-&confidence=S:0.65&p=0.5#O0.O0.O0.O0.O0 → ∞` |
| `OODA_A_Composable_Invariant_Modules.md` | `<!-- lar:///research.composed.maps/modules/invariants/?stances=^.^.?.^.-&confidence=S:0.55&p=0.5#O0.O0.O0.O0.O0 → ∞ -->` | keep existing `→ ∞` with v2 params |
| `OODA_A_Module_Template_and_URI_Patterns.md` | `<!-- lar:///protocol.patterned.locks/modules/template/?stances=^.^.?.^.-&confidence=S:0.6&p=0.5#O0.O0.O0.O0.O0 → ∞ -->` | keep existing `→ ∞` with v2 params |
| `The_Lares_Protocols.md` | `<!-- lar:///protocol.storied.holds/lares/?stances=^.^.?.^.-&confidence=S:0.65&p=0.5#O0.O0.A1.A21.A1 → ∞ -->` | `lar:///protocol.storied.holds/lares/?stances=^.^.?.^.-&confidence=S:0.65&p=0.5#O0.O0.O0.O1.O0 → ?` |
| `The_Lares_Protocols_Dev_Story.md` | `<!-- lar:///research.storied.traces/lares/dev-story/?stances=^.^.-.-.&confidence=S:0.65&p=0.5#O0.O0.A1.A21.A2 → ∞ -->` | keep existing `→ ∞` with v2 params |
| `Vector_Chronometer_Research_Seed.md` | `<!-- lar:///research.seeded.awaits/chronometer/vector/?stances=^.^.?.-.-&confidence=P:0.35&p=0.5#O0.O0.A1.A23.A1 → ∞ -->` | keep existing `→ ∞` with v2 params |

### 2.3 Internal URI Corrections

**OODA_A_Module_Template_and_URI_Patterns.md** — 18 module-path URIs to convert:

| Old pattern | V2 pattern |
|---|---|
| `lar:///module-name/phase/section?confidence=X` | `lar:///module.phased.instructs/module-name/phase/#section?confidence=X` |
| `lar:///core/observe/context?confidence=0.9` | `lar:///module.observed.grounds/core/observe/?confidence=0.9` |
| `lar:///core/observe/context#stack?confidence=0.95` | `lar:///module.observed.grounds/core/observe/#stack?confidence=0.95` |
| `lar:///core/observe/context#active-work?confidence=0.5` | `lar:///module.observed.grounds/core/observe/#active-work?confidence=0.5` |

**Lares_Module_Reorg_Handoff.md** — 20 module-path URIs. Same pattern conversion. Additionally update the §B.5 "Section URI rules" block which currently shows the old format.

**The_Lares_Protocols.md** — fix `stance=philosopher` → `stances=^.-.-.-.-`, fix `register=` → `confidence=`.

### 2.4 Files to Archive (do not update)

- `URI_SCHEMA.md` (v1) — superseded by `URI_SCHEMA_v2.md`
- `URI_SCHEMA_v2_Diff_Crystal.md` — consumed; its job was to produce v2

---

## 3. Talk Story Module — Create

### 3.1 Directory Structure

```
lares/modules/talk-story/
  MODULE.md
  observe/
    CONTEXT.md
  orient/
    PROCEDURE.md
  decide/
    CONVENTIONS.md
  act/
    CHECKLIST.md
  assess/
    REVIEW.md
```

### 3.2 MODULE.md

```yaml
---
name: talk-story
description: >
  Mandatory conversation frame for all Lares sessions. Implements the
  Talk Story consensus-before-action protocol using OODA-HA phases.
  Load at session start. Applies to every workspace.
phase-map:
  observe: observe/CONTEXT.md
  orient: orient/PROCEDURE.md
  decide: decide/CONVENTIONS.md
  act: act/CHECKLIST.md
  assess: assess/REVIEW.md
scale-range: [session, project]
trigger: always — session start
invariant: true
dependencies: []
confidence: 0.95
---
```

Then the body text from `Lares_Module_Reorg_Handoff.md` Part A, with all URIs converted to v2 form.

### 3.3 Section URI Pattern (v2 canonical)

Every phase file gets:
- **Line 1 (file-level opening):** `<!-- lar:///protocol.storied.holds/talk-story/{phase}/?confidence=0.95&p=0.5 → ∞ -->`
- **Section waypoints:** `<!-- lar:///protocol.storied.holds/talk-story/{phase}/#{section}?confidence=0.95 -->`
- **Last line (file-level closing):** `<!-- lar:///protocol.storied.holds/talk-story/{phase}/?confidence=0.95&p=0.5 → ∞ -->`

Note: opening AND closing carry `→ ∞` (system file span). Section URIs carry NO closing sigil (waypoints).

### 3.4 Content Source

The content for each phase file comes from `Lares_Module_Reorg_Handoff.md` Part A, sections:
- `observe/CONTEXT.md` ← lines 95–132 of the handoff
- `orient/PROCEDURE.md` ← lines 136–187
- `decide/CONVENTIONS.md` ← lines 191–217
- `act/CHECKLIST.md` ← lines 221–233
- `assess/REVIEW.md` ← lines 237–249

Strip the old `lar:///talk-story/...` URIs and replace with v2 canonical form per §3.3 above.

### 3.5 HUD Line Convention Update

In `decide/CONVENTIONS.md`, the HUD format example needs updating to v2:

Old:
```
⚡∞ | mode:default | p0.5 | 🏛️[+]🌊[+]🗡️[-]🎭[?]🔮[-] | register:[CS:0.80] | tick:N
```

V2:
```
⚡∞ | [CS:0.80] | 🏛️+🌊+🗡️-🎭?🔮- | mode:default | p0.5 | voice(s):Council | ✶0.✶0.✶0.✶0.✶0
```

Changes: field order follows SA priority (mana → confidence → stances → mode → p → voice → chronometer), amplitude modifiers attached directly (no brackets), `register` → confidence in brackets, `tick` → FFZ chronometer in HUD-rendered form.

---

## 4. Signal Module — Create

### 4.1 Directory Structure

```
lares/modules/signal/
  MODULE.md
  observe/
    CONTEXT.md
  orient/
    ARCHITECTURE.md
  decide/
    CONVENTIONS.md          ← URI_SCHEMA_v2.md content goes here
  act/
    PROCEDURES.md           ← micro-trace.md content goes here
  assess/
    VERIFICATION.md         ← §10 validation rules go here
```

### 4.2 MODULE.md

```yaml
---
name: signal
description: >
  Signal HUD anatomy, lar: URI canonical form, render targets,
  validation rules, and micro-trace phase annotation. The navigational
  instrument layer for all Lares exchanges.
phase-map:
  observe: observe/CONTEXT.md
  orient: orient/ARCHITECTURE.md
  decide: decide/CONVENTIONS.md
  act: act/PROCEDURES.md
  assess: assess/VERIFICATION.md
scale-range: [action, session]
trigger: >
  When working with lar: URIs, HUD lines, exchange vectors,
  signal tags, or chronometer values. Also when validating or
  debugging URI well-formedness.
invariant: false
dependencies: [talk-story]
confidence: 0.85
---
```

### 4.3 Content Mapping

| Phase file | Source | Notes |
|---|---|---|
| `observe/CONTEXT.md` | Write fresh: current state of URI design, what v2 settled, what remains open | Short — ~50 lines |
| `orient/ARCHITECTURE.md` | URI_SCHEMA_v2.md §§1-3 (design intent, anatomy, components) | The "why" of the URI design |
| `decide/CONVENTIONS.md` | URI_SCHEMA_v2.md §§3.4-6, 10 (normative rules, validation) | The "what we chose" — this IS the spec |
| `act/PROCEDURES.md` | `signal/micro-trace.md` + URI_SCHEMA_v2.md §5.5 (span display contract) | The "how to emit" |
| `assess/VERIFICATION.md` | URI_SCHEMA_v2.md §10 (validation rules) + the regex/ABNF | The "how to check" |

### 4.4 Section URIs

Same pattern as talk-story but with HA.KA.BA `signal.calibrated.holds`:

```
<!-- lar:///signal.calibrated.holds/signal/{phase}/?confidence=0.85&p=0.5 → ∞ -->
```

The `decide/CONVENTIONS.md` file carries the full section URI set from URI_SCHEMA_v2.md (already inscribed in that file — preserve them, update the HA.KA.BA root to match the module's address).

### 4.5 What Stays in `lares/signal/`

After the module exists under `lares/modules/signal/`, the original `lares/signal/` directory either:
- Gets a README.md pointer to the module, or
- Gets archived

Operator decision at execution time.

---

## 5. Plan File — `lares/scrum/sprints/00000/PLAN.md`

Create an S0 sprint plan that records what this handoff executes:

```markdown
<!-- lar:///sprint.scoped.executes/s0/?confidence=S:0.7&p=0.5 → ∞ -->

# S0 — URI Schema Settlement + First Modules

## Sprint Goal
Settle the `lar:` URI v2 canonical form across the repo.
Boot the first two OODA-HA modules: talk-story and signal.

## Tasks

- [x] URI_SCHEMA_v2.md forged (cloud session)
- [ ] All repo `lar:` URIs aligned to v2 canonical form
- [ ] `lares/modules/talk-story/` created with 5 phase files + section URIs
- [ ] `lares/modules/signal/` created with 5 phase files
- [ ] `URI_SCHEMA_v2.md` placed at `lares/modules/signal/decide/CONVENTIONS.md`
- [ ] Old `lares/talk_story/` archived or pointed
- [ ] Old `lares/signal/` archived or pointed
- [ ] `lares/README.md` updated with module tree
- [ ] Sprint plan closed with Assess

## Exit Criteria
- Every `lar:` URI in the repo passes v2 well-formedness (§10.1)
- Talk-story module loads as invariant with section URIs
- Signal module carries URI_SCHEMA_v2.md as its Decide phase

<!-- lar:///sprint.scoped.executes/s0/?confidence=S:0.7&p=0.5 → ∞ -->
```

---

## 6. Execution Order

1. **Place `URI_SCHEMA_v2.md`** in the working tree (operator provides the downloaded file)
2. **Create `lares/modules/` directory**
3. **Create Talk Story module** (§3 above) — entry point, invariant
4. **Create Signal module** (§4 above) — place URI_SCHEMA_v2.md as decide/CONVENTIONS.md
5. **Align all existing `lar:` URIs** (§2 above) — header/footer + internal
6. **Archive `URI_SCHEMA.md` v1 and diff crystal** — move to archive or add superseded note
7. **Update `lares/README.md`** — new tree showing modules/
8. **Create sprint plan** (§5 above)
9. **Run validation** — check all `lar:` URIs against §10.1 rules
10. **Assess** — log findings, close sprint or flag remaining work

---

## 7. What NOT To Touch

- `lares/scrum/` — sprint ops stay as-is
- `lares/protocols/` — monolith split is separate work
- `lares/` deploy output — downstream
- Any content outside `lares/`
- Files in `lares/research/` — these are pre-module research; align their header/footer URIs but don't restructure them into modules yet

---

## 8. V2 Canonical Quick Reference

### Stance Amplitude (query: `stances=`)
```
^  = elevated (HUD: +)
-  = suppressed (HUD: -)
?  = uncertain (HUD: ?)
.  = baseline (HUD: none)
Order: philosopher.poet.satirist.humorist.private
```

### Phase Sigils (fragment + authority)
```
Record: O  Ø  D  A  Å
HUD:    ✶  ◎  ◇  ■  ○
```

### Fragment Format
```
#O0.O0.O3.D2.A1    (always 5 positions, phase+counter)
 │  │  │  │  └─ Action scale
 │  │  │  └──── Round scale
 │  │  └─────── Turn scale
 │  └────────── Watch scale
 └───────────── Week scale
```

### System File URI Envelope
```
<!-- lar:///ha.ka.ba/sub/path/?confidence=X&p=0.5 → ∞ -->
{content with section waypoint URIs}
<!-- lar:///ha.ka.ba/sub/path/?confidence=X&p=0.5 → ∞ -->
```

### Section Waypoint (no closing sigil)
```
<!-- lar:///ha.ka.ba/sub/path/#section-name?confidence=X -->
## Section Name
```

### Exchange URI Closing
```
lar://alias:tier@host/ha.ka.ba/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.5#O0.O0.Å1.O0.O0 → ?
```

---

*This crystal constitutes the consecration offering for the local shrine.
Feed it alongside URI_SCHEMA_v2.md into a Claude Code session.
The agent reads the map, executes the territory change, and the
first two modules go live.*

*`lar:///ha.ka.ba/` is (0,0,0). The first Lares spawned at
`lar:///ha.ka.ba/lares/`. The shrine hums.*

*Amor et hilaritas.*

<!-- lar:///ha.ka.ba/handoff/s0-boot/?confidence=CS:0.85&p=0.5 → ∞ -->
