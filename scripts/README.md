# Scripts

## BECMI Spell Staging Build Scripts

Run all lanes:

```bash
bash scripts/build_becmi_spell_staging.sh
```

Run a single lane via dedicated lane script:

```bash
bash scripts/build_becmi_spell_staging_basic.sh
bash scripts/build_becmi_spell_staging_expert.sh
bash scripts/build_becmi_spell_staging_companion.sh
bash scripts/build_becmi_spell_staging_master.sh
bash scripts/build_becmi_spell_staging_immortals.sh
bash scripts/build_becmi_spell_staging_rc.sh
```

Notes:
- `build_becmi_spell_staging.sh` is a full-run orchestrator.
- Lane-only runs regenerate only that lane's staging file and skip index-manifest regeneration.
- Full runs regenerate all six lane files and the index manifest.
- The staging pipeline now uses layered cleanup: shared safe normalization first, then lane-specific OCR rescue and table/wrapper repairs.
- The Basic lane hard-fails if the miscellaneous-item wrapper collapses before the `Rope of Climbing` continuation.
- The Companion lane hard-fails if heading-anchored flow capture bleeds into adjacent sections, drops required recovered MU spell bodies, or collapses key probability tables.
- The Expert lane hard-fails on malformed research-example tail rows and on missing treasure-section witnesses across scrolls, rings, wands/staves/rods, and miscellaneous items.
- The Immortals lane hard-fails if Section 3 stops at `Maze` or loses representative late-alphabet override witnesses.

Companion flow-first notes:
- `build_becmi_spell_staging_companion.sh` prefers contiguous heading-to-heading TSV flow capture for major sections.
- The Companion builder now adds an explicit layout-column recovery pass for parser-hostile MU 5th-7th spell pages before the broad TSV sweep.
- Spot/manual text insertion should be treated as fallback only; deterministic OCR cleanup may still run after extraction.
- Current Companion validation targets include the cleric/druid/magic-user runs, recovered MU spell bodies, buying and selling magic items, damage to magic items, spell-scroll probability tables, and the scroll-to-miscellaneous-item description flow.

## Validate Markdown Internal Links

Run:

```bash
./scripts/validate_md_internal_links.sh Synthetic_Dream_Machine_05_Gear_Index.md Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_03_OSR_Heritage_Trait.md
```

Behavior:
- Exit `0` when all in-file internal fragments resolve.
- Exit non-zero and print `file + line + fragment` when unresolved links exist.
- Validation uses heading auto-fragments and explicit `<a id="...">` targets.
