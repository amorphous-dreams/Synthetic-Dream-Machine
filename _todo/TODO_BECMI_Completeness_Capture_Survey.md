# EPIC: Completeness Capture — Cross-Corpus Spell Text Survey

**Status:** COMPLETE — All Stories done (2026-04-03)  
**Date opened:** 2026-04-03  
**Branch:** feature/osr-power-text

---

## Purpose

Verify by direct PDF search that every rules-bearing mention of each canonical spell name in all 6 BECMI/RC source books has been captured in the staged corpus — surfacing anything the section-scoped extraction approach missed.

The existing staging scripts extract by *section*: they know where the spell description chapters are and pull those blocks. But BECMI/RC contains spell-relevant rules text scattered across DM procedure chapters, monster entries, magic item descriptions, combat and anti-magic procedure chapters, and adventure support appendices. None of these were targeted by the original extraction. Some is incidental flavor; some carries genuine rules mechanics — and we currently don't know which without looking.

**Known unknown unknowns already in evidence:**
- RC Ch.13 "Charm Person Spells" — full DM-facing duration rules with save-frequency table by Intelligence
- RC "Sleep and Unconsciousness" — procedure note that could extend the Sleep power card
- RC Wand of Fireballs item entry — activation mechanics referencing Fireball by name
- RC Master anti-magic and area-spell procedure sections — reference ≥15 spell names with new mechanics
- Immortals PP-damage scaling section — references several offensive spells with Immortal-tier scaling

---

## Scope

| In scope | Out of scope |
| --- | --- |
| 6 BECMI/RC PDFs: Basic, Expert, Companion, Master, Immortals, RC | Men & Magic, Greyhawk, Holmes, OD&D Family (no staging infrastructure) |
| All 196 spell recognizer rows marked `✓` in crosswalk | 4 Master-only artifact procedures |
| Standalone reversals: Finger of Death, Darkness, Continual Darkness (search by own name) | Purely incidental mentions: NPC loadout lists, treasure table rows with no rules text |
| All known aliases: Fire Ball / Fireball, Pass-Wall / Passwall, Polymorph Others / Other, etc. | Creature-specific spellcaster scan lines (e.g. "casts as MU8") |

## Hit Classification Tiers

| Tier | Description | Action |
| --- | --- | --- |
| `toc` | Dotted-line table of contents / index page entry | Auto-skip |
| `spell-list` | Multi-column spell list row | Auto-skip |
| `primary` | Main spell description block (already staged) | Auto-skip |
| `cross-ref` | "Can be removed by X" / "immune to X" in another spell body — no new mechanic | Flag only if new rule present |
| `rules-note` | Standalone DM procedure section adding mechanics, save tables, duration rules, class interactions | **Capture candidate** |
| `item-monster` | Monster immunity/ability or item activation with new spell behavior | **High-value capture candidate** |

---

## Stories and Sub-Tasks

### Story 1 — Extraction Infrastructure ✓ DONE

**Goal:** Build search-ready full-corpus text extractions of all 6 BECMI/RC PDFs and validate they are searchable.

**Acceptance:** All 6 extraction files exist in `_becmi/extractions/`, each returns hits for at least 5 known spell names, word counts are within expected range per book.

| Sub-task | Tasked Spirit | Status | Notes |
| --- | --- | --- | --- |
| 1a. Extract all 6 PDFs to `_becmi/extractions/` using `pdftotext -layout` | `CorpusBuild(Extractor)` | ✓ | Names: `basic_full.txt`, `expert_full.txt`, `companion_full.txt`, `master_full.txt`, `immortals_full.txt`, `rc_full.txt` |
| 1b. Post-extraction sanity check: verify line counts, confirm 10 known spell names resolve per file, flag PDF-quality issues | `CorpusCheck(Validator)` | ✓ | Python spot-check script |
| 1c. Document known extraction artifacts (multi-column interleave, truncated lines, soft-hyphen breaks) as filter notes | `ArtifactLog(Annotator)` | ✓ | Written to `scripts/survey_spell_completeness.py` docstring |

---

### Story 2 — Survey Script and Classification Engine ✓ DONE

**Goal:** Write `scripts/survey_spell_completeness.py` — searches the corpus extractions × canonical spell names × existing staging content, outputs a structured hit report with auto-classification.

**Acceptance:** Script runs cleanly on all 6 books; ToC/index noise auto-classified; primary-block hits identified and skipped; residual output is triageable by a human.

| Sub-task | Tasked Spirit | Status | Notes |
| --- | --- | --- | --- |
| 2a. Core search loop: for each spell name + aliases × each source file, find all line-number hits with ±6 line context window | `ScanRig(Builder)` | ✓ | Reuse `norm`, `spell_aliases` from `build_becmi_spell_staging_multi.py` |
| 2b. Noise filters: auto-classify ToC lines, spell-list table rows, index page hits | `NoiseCut(Classifier)` | ✓ | Regex + heuristic classifiers on context window |
| 2c. Already-staged filter: test whether hit context overlaps text already in the individual lane staging files | `StagedCheck(Deduper)` | ✓ | Sliding-window text match against `_todo/TODO_BECMI_Spell_Material_Staging_*.md` |
| 2d. Alias + fuzzy-match: Fire Ball/Fireball, Pass-Wall/Passwall, standalone reversals (Finger of Death, Darkness, Continual Darkness) | `AliasMap(Resolver)` | ✓ | Extends existing `spell_aliases` dict; records match form in hit report |
| 2e. Output: Markdown table hit report; columns: Spell \| Source Book \| Line # \| Auto-Class \| Context Preview \| Staging Match \| Decision; `check`/`write` modes; `--spell`, `--book`, `--min-class`, `--module` flags | `HitLog(Reporter)` | ✓ | `--write` outputs to `_todo/TODO_Completeness_Survey_Hits.md` |

---

### Story 3 — Survey Run: Basic + Expert ✓ DONE

**Goal:** Run the survey over Basic and Expert; classify all residual hits as `captured`, `incidental`, or `new-rule-gap`.

**Scale estimate:** ~35 spells across B/E; expected residual hits post-noise-cut: ~10–25 total.

| Sub-task | Tasked Spirit | Status | Notes |
| --- | --- | --- | --- |
| 3a. Run `survey_spell_completeness.py --book basic,expert --min-class cross-ref` | `BECMIScan_BE(Scanner)` | ✓ | 670 hits; noise-cut to ~25 residual |
| 3b. Triage all residual B/E hits; classify; annotate Decision column | `BETriage_BE(Triager)` | ✓ | 1 `new-rule-gap` identified (Basic Charm Person DM procedure); remainder incidental |
| 3c. For any `new-rule-gap` hits: identify staging file target, section anchor, draft staging text block | `BEDraft_BE(Drafter)` | ✓ | Staged to `TODO_BECMI_Spell_Material_Staging_Basic.md` — Intelligence save-frequency table (High=1 day / Average=1 week / Low=1 month) + shapechange auto-break; source `basic_full.txt` L5516–5545. Operator-approved. |

---

### Story 4 — Survey Run: Companion + Master ✓ DONE

**Goal:** Run the survey over Companion and Master; classify all residual hits.

**Scale estimate:** ~80 spells across C/M; expected residual hits: ~30–60. Master anti-magic chapter alone references ≥15 spell names.

| Sub-task | Tasked Spirit | Status | Notes |
| --- | --- | --- | --- |
| 4a. Run `survey_spell_completeness.py --book companion,master --min-class cross-ref` | `BECMIScan_CM(Scanner)` | ✓ | 657 hits |
| 4b. Triage all residual C/M hits | `BETriage_CM(Triager)` | ✓ | 1 `new-rule-gap` identified: Companion Weapon Talent table (item-monster tier). Master anti-magic/procedure hits classified incidental (already staged in prior pass). |
| 4c. For any `new-rule-gap` hits: draft staging text blocks | `BEDraft_CM(Drafter)` | ✓ | Staged to `TODO_BECMI_Spell_Material_Staging_Companion.md` — 5-talent verbatim block (Breathing, Charming, Finding, Slowing [no Save], Speeding); source `companion_full.txt` L6628–6653. Operator-approved. |

---

### Story 5 — Survey Run: Immortals + RC ✓ DONE

**Goal:** Run the survey over Immortals and RC; classify all residual hits.

**Scale estimate:** RC has 20,841 lines; Dispel Magic alone has 49 hits. Residual RC hits post-noise-cut: ~60–120. Immortals: ~20–35. This is the longest triage session.

**Known high-priority RC targets:**
- Ch.13 "Charm Person Spells" subsection (Duration by Intelligence table + DM procedure)
- "Sleep and Unconsciousness" section
- Wand of Fireballs item entry (new activation mechanics)
- Master anti-magic and area-spell procedure sections (reference ≥15 spell names)
- Immortals PP-damage scaling section (references several offensive spells)

| Sub-task | Tasked Spirit | Status | Notes |
| --- | --- | --- | --- |
| 5a. Run `survey_spell_completeness.py --book rc --min-class cross-ref` | `RCScan(Scanner)` | ✓ | 1,007 hits |
| 5b. Triage RC residual hits in module batches | `RCTriage(Triager)` | ✓ | 73 residual hits classified; all incidental. RC Dispel Magic / Enchanted Vessel procedure (L18814–18833) identified as genuine gap but backlisted to `_todo/TODO_Magitech_Fantascience_Chapter05.md` (B1) — belongs to future Magic Items/Artifacts Epic. |
| 5c. Run `survey_spell_completeness.py --book immortals --min-class cross-ref` | `ImmScan(Scanner)` | ✓ | 474 hits |
| 5d. Triage Immortals residual hits | `ImmTriage(Triager)` | ✓ | 66 residual hits classified; all incidental (Immortal power lists, PP framing noise). 0 new-rule-gaps. |
| 5e. Cross-book dedup: RC hits duplicating earlier-lane staged content → `cross-book-dupe` not `new-rule-gap` | `XBookDedup(Deduper)` | ✓ | Performed inline during triage; no cross-book dupes requiring new classification. |

---

### Story 6 — Gap Remediation and Pipeline Re-verification ✓ DONE

**Goal:** For all confirmed `new-rule-gap` hits from Stories 3–5, update staging files, rebuild the pipeline, confirm 196/196 with new witness text correctly loaded.

**Result:** 2 net new staging items from Stories 3–4 (Basic Charm Person DM procedure; Companion Weapon Talent 5-talent block). Terms scan (Story 5 extension) found 0 additional new-rule-gaps. Pipeline rebuilt and verified clean.

| Sub-task | Tasked Spirit | Status | Notes |
| --- | --- | --- | --- |
| 6a. Consolidate all `new-rule-gap` hits into ranked remediation backlog | `GapMap(Assessor)` | ✓ | 2 items: Basic Charm Person DM procedure (L5516–5545); Companion Weapon Talent 5-talent block (L6628–6653). Both already staged during Stories 3–4. |
| 6b. Update staging lane files: add confirmed gap text as sub-blocks | `StagePatch(Patcher)` | ✓ | Applied during Stories 3–4 with operator approval. Verbatim-only discipline enforced. |
| 6c. Update crosswalk anchors for any new staging sub-sections | `AnchorSync(Lorekeeper)` | ✓ | No new crosswalk anchor rows required; both items attache to existing spell rows in their lanes. |
| 6d. Rebuild pipeline: `build_becmi_spell_staging_multi.py write` → `import_ch06_osr.py write` → verify 196/196, drift: no | `PipelineVerify(Verifier)` | ✓ | `drift: no`; `crosswalk statuses: {'yes': 196}` |
| 6e. Re-run `audit_crosswalk_source_completeness.py`; confirm 0 candidates | `AuditFinal(Auditor)` | ✓ | Total candidates: 0. Epic closed. |

---

## Cross-Cutting Concerns

### What counts as "relevant"

A hit is a **capture candidate** if it:
- Adds a save modifier, duration table, caster-level scaling rule, or interaction mechanic not in the primary description
- Describes a monster's or item's behavior that modifies how the spell functions when cast
- Provides a procedure rule governing how the spell interacts with another rule system (anti-magic, dispel, overcharge, etc.)

A hit is **incidental** if it:
- Lists the spell name in a lookup table with no additional text
- Says only "can be dispelled by Dispel Magic" / "immune to Sleep" without adding new mechanics
- Appears purely in flavor description of an adventure site or NPC

### Alias and fuzzy-match precedents

- `Fire Ball` and `Fireball` — match both; one crosswalk row
- `Finger of Death` — reverse of Raise Dead; hits classify against Raise Dead staging row
- `Darkness` and `Continual Darkness` — reverse synthetics; new-rule hits attach to Light / Continual Light row respectively, or create a reverse note
- `Charm Person` vs. `Charm Monster` — must disambiguate; context window handles most cases

### Session pacing

- Stories 1 + 2: one focused implementation session (infrastructure + script)
- Stories 3–5: one triage session per book-pair, 1–2 hours each
- Story 6: runs in batches after each triage session, or as a final cleanup pass

---

## Extraction Files Registry

| Book | PDF | Extraction Path | Line Count | Status |
| --- | --- | --- | --- | --- |
| Basic | `_becmi/TSR 1011B - Set 1 Basic Rules.pdf` | `_becmi/extractions/basic_full.txt` | 8,314 | ✓ verified 2026-04-03 |
| Expert | `_becmi/TSR 1012B - Set 2 Expert Rules.pdf` | `_becmi/extractions/expert_full.txt` | 6,202 | ✓ verified 2026-04-03 |
| Companion | `_becmi/TSR 1013 - Set 3 Companion Set.pdf` | `_becmi/extractions/companion_full.txt` | 7,132 | ✓ verified 2026-04-03 |
| Master | `_becmi/TSR 1021 - Set 4 Master Rules.pdf` | `_becmi/extractions/master_full.txt` | 7,813 | ✓ verified 2026-04-03 |
| Immortals | `_becmi/TSR 1017 - Set 5 Immortals Rules.pdf` | `_becmi/extractions/immortals_full.txt` | 7,384 | ✓ verified 2026-04-03 |
| RC | `_becmi/TSR 1071 - The D&D Rules Cyclopedia.pdf` | `_becmi/extractions/rc_full.txt` | 20,841 | ✓ verified 2026-04-03 |

---

## Hit Report

Active hit report: `_todo/TODO_Completeness_Survey_Hits.md` (created by `survey_spell_completeness.py --write`)

---

## Remediation Backlog

*(Populated during Story 6a — closed 2026-04-03)*

### Net staged items (approved)
1. **Basic — Charm Person DM Procedure** (`TODO_BECMI_Spell_Material_Staging_Basic.md`): Intelligence-based save-frequency table (High=1 day / Average=1 week / Low=1 month) + shapechange auto-break. Source: `basic_full.txt` L5516–5545.
2. **Companion — Weapon Talent 5-talent block** (`TODO_BECMI_Spell_Material_Staging_Companion.md`): Verbatim OCR, `companion_full.txt` L6628–6653. Talents: Breathing (Water Breathing / Air Breathing 1/day), Charming (charm person 1/day 120'), Finding (locate object 1/day 120'), Slowing (reverse Haste 1 turn, **no Save**), Speeding (haste 1 turn on user).

### Deferred / out of scope
- **RC Dispel Magic / Enchanted Vessel procedure** (`rc_full.txt` L18814–18833): backlisted to `_todo/TODO_Magitech_Fantascience_Chapter05.md` (B1). Belongs to future Magic Items/Artifacts full-text Epic.

### Terms scan results (2026-04-03)
- Ran `--terms 'anti-magic,magical nature,enchanted,dweomer,permanent magic,temporary magic,spell effect,magical effect,metaphysical,astral,ethereal,Power Points,mana'` across all 6 books; 288 hits total at `rules-note` minimum.
- **0 new-rule-gaps found** for the spell completeness survey. All hits classified as: already staged, cross-book-dupe, creature-stat-block incidental, or future-Epic scope.
- RC Planes chapters (L19400+) and vessel enchantment content (Ch.16) identified as primary targets for the planned future metaphysics/world-ontology terms Epic.
