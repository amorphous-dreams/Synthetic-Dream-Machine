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

## Validate Markdown Internal Links

Run:

```bash
./scripts/validate_md_internal_links.sh Synthetic_Dream_Machine_05_Gear_Index.md Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_03_OSR_Heritage_Trait.md
```

Behavior:
- Exit `0` when all in-file internal fragments resolve.
- Exit non-zero and print `file + line + fragment` when unresolved links exist.
- Validation uses heading auto-fragments and explicit `<a id="...">` targets.
