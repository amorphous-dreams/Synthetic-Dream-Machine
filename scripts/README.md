# Scripts

## Validate Markdown Internal Links

Run:

```bash
./scripts/validate_md_internal_links.sh Synthetic_Dream_Machine_05_Gear_Index.md Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_03_OSR_Heritage_Trait.md
```

Behavior:
- Exit `0` when all in-file internal fragments resolve.
- Exit non-zero and print `file + line + fragment` when unresolved links exist.
- Validation uses heading auto-fragments and explicit `<a id="...">` targets.
