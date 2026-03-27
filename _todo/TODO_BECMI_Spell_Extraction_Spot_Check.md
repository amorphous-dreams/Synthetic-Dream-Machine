# TODO: BECMI Spell Extraction Spot Check

This report reflects the current split staging layout and the current corpus-closeout state across all six core books.

Current artifact layout:
- `_todo/TODO_BECMI_Spell_Material_Staging.md` is now a manifest/index only.
- Each source book now has its own staging file:
  - `_todo/TODO_BECMI_Spell_Material_Staging_Basic.md`
  - `_todo/TODO_BECMI_Spell_Material_Staging_Expert.md`
  - `_todo/TODO_BECMI_Spell_Material_Staging_Companion.md`
  - `_todo/TODO_BECMI_Spell_Material_Staging_Master.md`
  - `_todo/TODO_BECMI_Spell_Material_Staging_Immortals.md`
  - `_todo/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md`
- Each per-book staging file now includes a `Table Check QA Pass` section near the top so table/list validation can be tracked during later cleanup rounds.

## Final Sweep Categories

- Included in the final closeout sweep:
  - artifact / immortal-power doctrine
  - magic operation doctrine
  - spell lifecycle procedures
  - magic interpretation meta
- Explicitly excluded for now:
  - creature scans
  - monster spellcaster rosters as a dedicated corpus
  - bestiary-focused magical doctrine not needed for spell or item curation

## Final Sweep Results

- Freeze state:
  - the six per-book staging files are approved and frozen for the current extraction milestone
  - this report now serves as the final corpus-closeout assessment

- Fresh re-rating method:
  - confidence was re-scored from scratch against the frozen staging artifacts instead of inheriting the earlier lane notes
  - the same rubric was used for every lane:
    - structural coverage of the intended spell + magic-item curation scope
    - section-boundary fidelity and reading-order stability
    - table/list usability in the reviewed dense regions
    - residual OCR or layout noise severity after generator-side cleanup

- Corpus QA checks rerun for freeze:
  - the known broad OCR-regression families were re-scanned: `100k`, `100t`, `f100r`, `b100d`, `100p`, broad `IO'` damage, literal `\n`, and stray post-asterisk glyph debris
  - current result: no broad regression-family hits remain in the frozen staged corpus
  - table-check sections in all six staging files still support the earlier conclusion that no blocking row/column defects remain in the reviewed dense regions
  - remaining defects are local texture only: line-wrap roughness, ordinary hyphenation, and some layout-density scars in the heaviest treasure, artifact, and chart sections

## Final Confidence Re-Rating - 2026-03-26

These scores reflect the current frozen corpus only. They are not inherited from the 2026-03-23 survey.

### Final Ratings by Lane

- **B: 0.93**
  - rationale: Basic cleanly stages the player spell run, the DM higher-level spell guidance, lost spell-book material, and the scroll/ring/item-operation wrapper pages; the Turning Undead and spell-list regions remain table-stable
  - residual risk: minor TSV/OCR texture in the description pages, but no sign of a structural scope miss inside the Basic lane
- **E: 0.90**
  - rationale: Expert retains complete spell-expansion coverage, research and lost-book procedures, and the full miscellaneous magic-item list with no visible structural contamination from the intervening class-table pages
  - residual risk: Expert still carries the highest small-scale normalization tax of the non-chart lanes, so confidence stays solid but slightly below Basic and Companion
- **C: 0.92**
  - rationale: Companion now holds the full intended spell lane for this scope, including cleric, druid, and the restored magic-user 5th-9th level run, plus the spell-adjacent treasure and item-operation material
  - residual risk: the treasure-heavy sections remain the noisiest Companion region, but the tables are readable and the earlier scope gap is closed
- **M: 0.95**
  - rationale: Master is now structurally complete for the targeted scope: class spell material, non-human spellcaster procedures, anti-magic/dispel doctrine, artifact procedures, named artifacts, and the post-catalog appendix are all present in one frozen lane
  - residual risk: artifact-table density and some lexical scars remain, but the remaining issues are readability texture rather than source-evidence risk
- **I: 0.95**
  - rationale: Immortals keeps the cleanest scope boundary of the set: Sections 1-2 provide the PP interpretation frame and Section 3 provides the actual immortal-magic corpus, with the chart-heavy regions remaining readable enough for downstream use
  - residual risk: chart density is still visually heavy, but there is no current evidence of a missing section within the intended Immortals scope
- **RC: 0.95**
  - rationale: Rules Cyclopedia now covers the full intended procedure and reference layer for this corpus: spell descriptions, monster spellcasters, scrolls, research, item enchantment, constructs, the Chapter 16 item-description catalog, and the spell index anchors
  - residual risk: RC remains large and heterogeneous, so localized texture persists, but the current frozen file reads as source-complete for the intended lane scope

### Final Confidence Set

- Highest-confidence lanes: `M`, `I`, and `RC` at **0.95**
- Strong but slightly noisier lanes: `B` at **0.93** and `C` at **0.92**
- Lowest but still approved lane: `E` at **0.90** because its remaining defects are mostly normalization and readability friction, not coverage failure

## Final Corpus Judgment

- extraction is functionally complete for the targeted spell + magic-item curation scope
- no structural unstaged section remains priority-queued inside the approved scope
- the corpus is stable enough to support downstream crosswalk and patterning work without reopening extraction
- if a future problem is found, it should be treated as a concrete defect against a frozen artifact, not as an invitation to restart broad exploratory extraction

## Freeze Notes

- Artifact layout:
  - `_todo/TODO_BECMI_Spell_Material_Staging.md` remains a manifest/index only
  - the canonical frozen artifacts are:
    - `_todo/TODO_BECMI_Spell_Material_Staging_Basic.md`
    - `_todo/TODO_BECMI_Spell_Material_Staging_Expert.md`
    - `_todo/TODO_BECMI_Spell_Material_Staging_Companion.md`
    - `_todo/TODO_BECMI_Spell_Material_Staging_Master.md`
    - `_todo/TODO_BECMI_Spell_Material_Staging_Immortals.md`
    - `_todo/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md`
- Reproducibility:
  - `scripts/build_becmi_spell_staging.sh` remains the canonical generation path for the frozen staging corpus
- Downstream use:
  - later work should proceed in crosswalk, indexing, or interpretation artifacts rather than reopening the staging files unless a specific verifiable defect is discovered
