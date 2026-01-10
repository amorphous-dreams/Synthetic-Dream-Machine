# QA Summary

- Confirmed all paths and trait entries from `Vastlands_Guidebook_06_Other_Paths_114-159.md` (Wizard through Yellowlander plus Weapon/Bearer) match the `Synthetic_Dream_Machine_01_Traits_Index.md` wording, tags, and the new `meta.source`/`usage` schema (no additional edits were required beyond verification).

# TODO: SDM Trait Index QA & Expansion

## Crawl FLTS Paths for Updates
1. Systematically work through `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_03_FTLS_Paths.md` and copy the latest trait text and context into the holding file  `Synthetic_Dream_Machine/FTLS-Scraped-Traits.md`.
2. Where a trait builds on an earlier Vastlands entry (e.g., Vampire), append the FTLS source under `meta.source` and add a `usage` note about how it extends/updates the earlier version.
3. Capture any new tags introduced by the FTLS chapter and surface them in the `tags:` block of the corresponding SDM entry.
4. Document the crawl progress (chapter sections done/pending) at the end of this TODO, so future passes can resume easily.
Example:
- **Vampire (Redlander path)** – Update `text:` to FTLS version with Expert/Master upgrades describing faster drain and a Level-based Life cap; Ensure `meta` lists both sources when the trait pulls from multiple books even though the latest text is FTLS-driven.

## Crawl Progress
- FTLS Paths scraped into `Synthetic_Dream_Machine/FTLS-Scraped-Traits.md`: Commander, Revenant, Spirit, Vampire, Wild Mage.

