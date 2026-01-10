# TODO: SDM Trait Index QA & Expansion

## QA Existing Vastlands Guidebook Traits
1. Compare each trait listed in `Synthetic_Dream_Machine/Synthetic_Dream_Machine_01_Traits_Index.md` against its source entry in the Vastlands Guidebook Markdown (e.g., `Vastlands_Guidebook/Vastlands_Guidebook_06_Other_Paths_114-159.md`).
2. Confirm the `text:` block is verbatim, adjusting only for formatting/markup guidance already agreed (no trimming of rules content unless canon says otherwise).
3. Reconcile `tags:` and `meta:` so every `path`, `type`, `affects`, and `source` entry matches the original book; duplicate `source` entries if a trait appears in multiple books.
4. Flag any traits that diverge intentionally (flavor updates, errata, FTLS overrides) with a short note in `meta.usage.note` noting the change reason.
5. Reformat each `meta:` block to the new `source`/`usage` structure as you QA it so the schema is consistent across entries.

## Crawl FLTS Paths for Updates
1. Systematically work through `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_03_FTLS_Paths.md` and copy the latest trait text and context into the SDM Trait Index entry for each updated path.
2. Where a trait builds on an earlier Vastlands entry (e.g., Vampire), append the FTLS source under `meta.source` and add a `usage` note about how it extends/updates the earlier version.
3. Capture any new tags introduced by the FTLS chapter and surface them in the `tags:` block of the corresponding SDM entry.
4. Document the crawl progress (chapter sections done/pending) at the end of this TODO, so future passes can resume easily.

- **Vampire (Redlander path)** – Update `text:` to FTLS version with Expert/Master upgrades describing faster drain and a Level-based Life cap; Ensure `meta.source` lists both sources when the trait pulls from multiple books even though the latest text is FTLS-driven.

## QA Log

- **Background (abstract trait)** – Confirmed the Background summary matches the canonical text in `Vastlands_Guidebook_02_Character_Creation_10-35.md` (pp.14-15); reformatted the `meta` block to the new `source`/`usage` layout while keeping the note about anchoring fictional positioning.
- **Wizard (core path start)** – Verified the SDM entry matches the Vastlands Guidebook Path of the Wizard 0 trait on p.16 (`Vastlands_Guidebook_02_Character_Creation_10-35.md`), including the same wording about being a magus/maker/mechanic and powers/methods. Tags (`[type:path]`, `[path:Wizard]`, `[affects:powers]`) already match, and `meta` is now reformatted into the new `source`/`usage` structure with the path index preserved.
- **Burner (Wizard path 1)** – Confirmed the `text:` block matches the Vastlands Guidebook page 16 entry for Wizard trait 1 and converted the `meta` block to the new template so it lists the path slot index and Vastlands source cleanly.
- **Chronic (Wizard path 2)** – Verified the SDM text matches the Vastlands Guidebook’s Wizard trait 2 and reformatted `meta` to the `source`/`usage` layout, keeping the Vastlands page and the Wizard path slot index.
- **Exuberant (Wizard path 3)** – Confirmed the text matches the Vastlands listing and updated the `meta` block to the compact `source`/`usage` structure referencing page 16 and index 3.
- **Mind Palace (Wizard path 4)** – Checked the SDM wording against the Vastlands list and rewrote `meta` as `source`/`usage` with index 4.
- **Oblique Reality (Wizard path 5)** – Verified the text matches the source and updated `meta` to the new template with index 5.
- **Recast (Wizard path 6)** – Double-checked the entry and converted its `meta` block to the `source`/`usage` structure that references the Vastlands source and path index 6.
- **Traveler (Traveler path 0)** – Verified the canonical text matches the Vastlands Guidebook p.17 Traveler trait and rewrote `meta` to the new `source`/`usage` layout (page 17 + index 0).
- **Escapist (Traveler path 1)** – Confirmed the save bonus text matches the source and updated `meta` to the compact schema referencing the same Vastlands page with index 1.
- **Friends (Traveler path 2)** – Checked the text about pets/sidekicks and converted `meta` to `source`/`usage` with page 17 and index 2.
- **Hunter (Traveler path 3)** – Confirmed the text matches the source (ambush triple crits) and updated `meta` to the new structure with index 3.
- **Pleasant (Traveler path 4)** – Verified the reaction bonus text and switched `meta` to the `source`/`usage` block referencing page 17 and index 4.
- **Pocketmaster (Traveler path 5)** – Confirmed the concealed objects text matches the source and converted `meta` to the new format with index 5.
- **Swift (Traveler path 6)** – Checked the action-grant text and rewrote `meta` to the new schema with page 17 and index 6.
- **Fighter (Fighter path 0)** – Verified the text matches the Vastlands Guidebook p.17 Fighter trait and converted `meta` into the `source`/`usage` layout with index 0.
- **Armiger (Fighter path 1)** – Confirmed the weapon-carry text and reformatted `meta` to record the Vastlands source plus path index 1.
- **Defender (Fighter path 2)** – Checked the defense bonus wording and updated its `meta` block to the compact schema with index 2.
- **Grit (Fighter path 3)** – Matched the life/endurances text, then rewrote `meta` to the new structure referencing page 17 index 3.
- **Irresistible (Fighter path 4)** – Verified the damage-every-round description and aligned `meta` with the new `source`/`usage` template for index 4.
- **Second Chance (Fighter path 5)** – Confirmed the resurrection text and recorded the Vastlands source plus index 5 in the refreshed metadata.
- **Terrifying (Fighter path 6)** – Ensured the social/terror bonus text matches the book and updated `meta` to the new layout with index 6.
- **Barbarian (Barbarian path 0)** – Confirmed the path introduction matches the Vastlands Guidebook text (pp.116) and reformatted `meta` to the new `source`/`usage` block referencing page 116 with index 0.
- **Antimagus (Barbarian path 1)** – Verified the doubled life cost/oldtech penalty text and converted `meta` to the `source`/`usage` structure with page 117 and index 1.
- **Blood Clad (Barbarian path 2)** – Checked the blood die storage text and rewrote `meta` for page 117 index 2.
- **Culling (Barbarian path 3)** – Confirmed the free-action drain text and set `meta` to the new schema referencing page 117 index 3.
- **Feral (Barbarian path 4)** – Verified the aura bonus wording and updated `meta` to page 117 index 4.
- **Lost Songs (Barbarian path 5)** – Double-checked the musical buffs text and formatted `meta` for page 117 index 5.
- **Wild Survivor (Barbarian path 6)** – Ensured the improvised gear text matches the source and recorded the Vastlands page plus index 6 in the new metadata block.
- **Bluelander (Bluelander path 0)** – Confirmed the path overview matches the Vastlands Guidebook p.118 description and left the `meta.source`/`usage` structure pointing to page 118 index 0.
- **Boatmaster (Bluelander path 1)** – Verified the text about handling boats and extra sacks mirrors the p.119 trait entry, and the tags plus `meta` follow the canonical structure for index 1.
- **Cheesemaker (Bluelander path 2)** – Checked the dairy-society power wording against the p.119 source and kept the new metadata/cohort tags aligned with the original ability.
- **Oppressed Faith (Bluelander path 3)** – Matched the stealth-and-faith description with the page 119 entry and confirmed the tagging plus `meta` fields match the canonical phrasing.
- **Reanimator (Bluelander path 4)** – Ensured the life-to-reanimate wording is identical to the Vastlands text (p.119) and that the tags/`usage` metadata reference index 4.
- **Spelunker (Bluelander path 5)** – Confirmed the tight-place bonus description matches p.119 and that the trait keeps the canonical tags and new metadata schema for index 5.
- **Sporemark (Bluelander path 6)** – Verified the fungal-regeneration language aligns with the book (p.119) and left the `meta`/tags in the new structure for index 6.
- **Bourgeois (Bourgeois path 0)** – Verified the path description exactly matches Vastlands p.120 and the `meta.source`/`usage` schema remains correctly pointed at index 0 for the path entry.
- **Double-Platinum Deathless Backup (Bourgeois path 1)** – Checked the soul-jewel text against the p.121 trait list and kept the original tags plus new metadata for index 1.
- **Enterprising (Bourgeois path 2)** – Confirmed the earnings/tax shell description matches the p.121 entry and the tags/meta reflect the canonical field info.
- **Expensive Training (Bourgeois path 3)** – Matched the trainer/€1,000 roll text to p.121 and preserved the canonical tags/`usage` metadata with index 3.
- **Legal Immunity (Bourgeois path 4)** – Verified the patron perks and hero die usage match p.121, keeping the tags and metadata consistent for index 4.
- **Old Money (Bourgeois path 5)** – Ensured the trust-fund wording is identical to p.121 and retained the tags/`meta` at index 5.
- **Urbane (Bourgeois path 6)** – Confirmed the secret alley/life cost text mirrors p.121 and kept the tagging and new metadata schema for index 6.
- **Golem (Golem path 0)** – Confirmed the self-remaking skill lemma description matches Vastlands p.122 and that the `meta`/tag block stays aligned with page 122/index 0.
- **Hardened (Golem path 1)** – Verified the stun/paralysis resistance and radiation note is identical to p.123’s trait text while `meta` references index 1.
- **Powered (Golem path 2)** – Checked the omni-battery backup/auto-start text and confirmed tags plus the new `source`/`usage` layout reference page 123 index 2.
- **Synthetic Soul (Golem path 3)** – Ensured the artificial soul/cassette rewrite wording mirrors p.123 and the metadata block points to index 3.
- **Undying Synthetic (Golem path 4)** – Matched the immortal-but-decaying description to p.123 and kept the tags/`meta` for index 4 correct.
- **Ur-War Program (Golem path 5)** – Confirmed the agility/unarmed damage increase text matches the canonical entry and `meta` references index 5.
- **Very Strong (Golem path 6)** – Verified the +2 strength/limit-ignoring description matches page 123 and the metadata/tags remain accurate for index 6.
- **Greenlander (Greenlander path 0)** – Confirmed the industrial/oldtech/fantascience pitch matches Vastlands p.124 and kept `meta.source`/`usage` tied to index 0.
- **Country Squire (Greenlander path 1)** – Verified the rural-resource economy/€15 text equals the p.125 trait list and left tags/`meta` pointing to index 1.
- **Deeply Embodied (Greenlander path 2)** – Checked the strength-for-magic wording against p.125 and kept the canonical tags plus `meta` index 2.
- **Informant (Greenlander path 3)** – Ensured the €5/week hero die override text mirrors p.125 and `meta` references index 3.
- **Metropolitan (Greenlander path 4)** – Confirmed the civic travel+ward bonus text matches p.125 and `meta` ties to index 4.
- **Mossblood (Greenlander path 5)** – Matched the plant-noösphere connection description to p.125 and left tags/`meta` for index 5 intact.
- **Soiltwined (Greenlander path 6)** – Verified the ur-peasant endurance-bonus wording equals p.125 and kept the metadata at index 6 unchanged.
- **Holy Fool (Holy Fool path 0)** – Confirmed the saintly prophet description matches Vastlands p.126 and the `meta.source`/`usage` block stays tied to index 0.
- **Abandoned (Holy Fool path 1)** – Verified the rotting-house spirit-talk ability text equals p.127 and ensured tags/`meta` point to index 1.
- **Blessed (Holy Fool path 2)** – Checked the luck/buff text against p.127 and kept the `meta` and tags aligned with index 2.
- **Holy Diver (Holy Fool path 3)** – Confirmed the dreamwalking portal wording matches p.127 and the canonical metadata references index 3.
- **Phylake’s Child (Holy Fool path 4)** – Matched the daemon-favoring family lore with p.127 and left `meta`/tags at index 4.
- **Soothsayer (Holy Fool path 5)** – Verified the divine dream interpretation text equals p.127 and kept the metadata referencing index 5.
- **Wanderer (Holy Fool path 6)** – Ensured the road-ward increase matches p.127 and that `meta` remains tied to index 6.
- **Manager (Manager path 0)** – Confirmed the administrator narrative matches Vastlands p.128 and left `meta.source`/`usage` at index 0.
- **Competent Appearance (Manager path 1)** – Verified the always-competent text matches p.129 and kept the metadata/tags linked to index 1.
- **Social Survivor (Manager path 2)** – Checked the life-for-reaction bonus wording against p.129 and left `meta` at index 2.
- **Inquisition Agent (Manager path 3)** – Matched the humorous denial text to p.129 and retained the canonical metadata for index 3.
- **Motivational (Manager path 4)** – Confirmed the hero-die encouragement and life cost match p.129 while `meta` references index 4.
- **Noösphere Priest (Manager path 5)** – Ensured the noösphere programming and sacrifice bonus description equals p.129 and `meta` stays at index 5.
- **Numbers Maximization Official (Manager path 6)** – Verified the life-for-roll text matches p.129 and left the metadata/tags tied to index 6.
- **Noble (Noble path 0)** – Confirmed the born-better prestige summary matches Vastlands p.130 and `meta.source`/`usage` still points at index 0.
- **Hexer Meritocrat (Noble path 1)** – Verified the merit-bonus numbers line matches p.131 and kept metadata/tags tied to index 1.
- **Knight Reflexes (Noble path 2)** – Confirmed the life-for-initiative text plus agility bump equals p.131 and `meta` references index 2.
- **Dissipated (Noble path 3)** – Matched the chemical cocktail/€5×level description with p.131 and kept metadata for index 3 intact.
- **Divine Blood (Noble path 4)** – Checked the source-code machines lowering costs matches p.131 and `meta` stays at index 4.
- **Sculpted Beauty (Noble path 5)** – Verified the synthetic glamour +2 charisma line equals p.131 and `meta` remains at index 5.
- **Perfected Germline (Noble path 6)** – Ensured the immunity/flawless text matches p.131 and `meta` references index 6.
- **Noömagus (Noömagus path 0)** – Confirmed the neon knight path summary matches Vastlands p.132 and `meta.source`/`usage` stays tied to index 0.
- **Cosmic Qanat (Noömagus path 1)** – Verified the power-level/risk reduction text matches p.133 and the metadata references index 1.
- **Hackmagic (Noömagus path 2)** – Checked the power-hacking wording plus Cosmic Qanat synergy equals p.133 and kept `meta` index 2.
- **Noösphere Native (Noömagus path 3)** – Ensured the noösphere defense bonus text matches p.133 and metadata points to index 3.
- **Power Scroller (Noömagus path 4)** – Confirmed the scroll-imbuing narrative and hero die cost align with p.133 and `meta` references index 4.
- **Soul Fuel (Noömagus path 5)** – Matched the life-force recharge description with p.133 and left `meta` at index 5.
- **Veteran of the Psychic Wars (Noömagus path 6)** – Verified the enchantment save bonus and mind-blow damage text equals p.133 and `meta` remains on index 6.
- **Orangelander (Orangelander path 0)** – Confirmed the celebratory path description equals Vastlands p.134 and `meta.source`/`usage` stays tied to index 0.
- **Cad (Orangelander path 1)** – Verified the cat-arm branch text matches p.135 and `meta` references index 1.
- **Citizen Living (Orangelander path 2)** – Confirmed the joy+stats entry equals p.135 and `meta` points to index 2.
- **Citizen Maintainer (Orangelander path 3)** – Ensured the undead-maintenance save bonus text matches p.135 and `meta` references index 3.
- **Ducky (Orangelander path 4)** – Matched the hero-die daily ally description to p.135 and left `meta` tied to index 4.
- **Orange Half-Ling (Orangelander path 5)** – Verified the small-size/resource text plus agility bonus matches p.135 and `meta` remains at index 5.
- **Unfred (Orangelander path 6)** – Confirmed the mind-control immunity/endurance buff text matches p.135 and `meta` refers to index 6.
- **Purplelander (Purplelander path 0)** – Confirmed the advanced magical creation overview matches Vastlands p.136 and the metadata tags still reference index 0.
- **Arboreal (Purplelander path 1)** – Verified the tree/bioduct climbing +1 strength text equals p.137 and `meta` references index 1.
- **Colonist (Purplelander path 2)** – Checked the hexad temporary-life and charisma line matches p.137 while tags/`meta` stay tied to index 2.
- **Human Library (Purplelander path 3)** – Matched the Long Long Ago knowledge/ +1 thought wording to p.137 and kept metadata at index 3.
- **Kaffetropist (Purplelander path 4)** – Ensured the caffeine/metabolize description matches p.137 and the tags/`meta` still point to index 4.
- **Pet Sidekick (Purplelander path 5)** – Confirmed the pet-master swap text plus +1 aura equals p.137 and metadata references index 5.
- **Telempath (Purplelander path 6)** – Verified the warning transmission +1 ward line matches p.137 and `meta` references index 6.
- **Redlander (Redlander path 0)** – Confirmed the bunker/vine/armor bonus description matches Vastlands p.138 and `meta.source`/`usage` remains tied to index 0.
- **Hexad Member (Redlander path 1)** – Verified the self-help glyph/contact trait text equals p.139 and `meta` references index 1.
- **Falscher (Redlander path 2)** – Checked the false-child/mental immunity wording to p.139 and the metadata stays at index 2.
- **Ruster (Redlander path 3)** – Matched the wasteland scavenging/super ammo description with p.139 and `meta` references index 3.
- **Vampire (Redlander path 4)** – Confirmed the life-drain narrative matches p.139 while the `meta.source` includes both Vastlands and FTLS notes (page 126 of FTLS Paths) and `usage` references index 4 with the FTLS extension note.
- **Vintner (Redlander path 5)** – Verified the plant-immunity/ethanol temporary life text matches p.139 and `meta` stays tied to index 5.
- **Werker (Redlander path 6)** – Ensured the builder-tech interface/backstage sense description equals p.139 and `meta` references index 6.
- **Scion (Scion path 0)** – Confirmed the divine-child overview matches Vastlands p.140 and metadata stays tied to index 0 with life/heroDie uses noted.
- **Dreamwalker (Scion path 1)** – Verified the noösphere endurance bonus text equals p.140‑141 and `meta` references index 1.
- **Faceless (Scion path 2)** – Confirmed the face-choice description matches p.141 and metadata links to index 2.
- **Of-World (Scion path 3)** – Checked the hero-die merge-with-elements wording vs p.141 and kept `meta` at index 3.
- **Perfect (Scion path 4)** – Matched the perfection/bio-mod immunity text to p.141 with metadata referencing index 4.
- **Subconscious Decay (Scion path 5)** – Ensured the sleep-decay/reconstitute aura bonus text equals p.141 and `meta` stays at index 5.
- **Superuser (Scion path 6)** – Verified the free action activation description matches p.141 and `meta` links to index 6.
- **Servant (Servant path 0)** – Confirmed the blue-collar plus hero-die overlook text matches Vastlands p.142 and `meta` stays tied to index 0.
- **Grounded (Servant path 1)** – Verified the aura/thought bonus and extra mental burden removal text equals p.143 and `meta` references index 1.
- **Housemaker (Servant path 2)** – Checked the hero-die duct/sewer connection wording against p.143 and kept `meta` at index 2.
- **Resourceful (Servant path 3)** – Matched the life-to-steal item text to p.143 and kept `meta` referencing index 3.
- **Shopstaff (Servant path 4)** – Ensured the charisma-for-friendly text matches p.143 and `meta` sits on index 4.
- **Strong (Servant path 5)** – Confirmed the labor-strength/endurance boost matches p.143 and `meta` points at index 5.
- **Tough (Servant path 6)** – Verified the daily temporary punishment points description equals p.143 and `meta` references index 6.
- **Skeleton (Skeleton path 0)** – Confirmed the dead-turned-un description matches Vastlands p.144 and `meta` stays tied to index 0.
- **Glowing Skeleton (Skeleton path 1)** – Verified the radioactive resistance text equals p.145 and `meta` references index 1.
- **My Bones Engraved (Skeleton path 2)** – Matched the bone-inventory slot write-up to p.145 and `meta` points at index 2.
- **Void Ward (Skeleton path 3)** – Ensured the aura defense text matches p.145 and `meta` stays at index 3.
- **From Dust, Returning (Skeleton path 4)** – Checked the sprinkle-of-fluids reform text against p.145 and kept `meta` referencing index 4.
- **Cold New Flesh (Skeleton path 5)** – Confirmed the semi-precious defense/blood transfer wording equals p.145 and `meta` remains tied to index 5.
- **Soul Thief (Skeleton path 6)** – Verified the soul-steal/four-life trade text matches p.145 and `meta` references index 6.
- **Soldier (Soldier path 0)** – Confirmed the not-war veteran defense/ally charisma boost description matches Vastlands p.146 and `meta` stays tied to index 0.
- **Armorborn (Soldier path 1)** – Verified the armor-free inventory and stone bonus wording equals p.147 and `meta` references index 1.
- **Blastermaster (Soldier path 2)** – Checked the ranged skill bonus plus critical improvements text matches p.147 and `meta` holds index 2.
- **Devastator (Soldier path 3)** – Matched the once-per-round drop-to-zero ability with p.147 and kept `meta` tied to index 3.
- **Rationalised (Soldier path 4)** – Ensured the panic immunity and ward addition description equals p.147 and `meta` references index 4.
- **Slayer (Soldier path 5)** – Confirmed the doubled attack/damage versus equal-or-higher foes wording equals p.147 and `meta` points to index 5.
- **Wired (Soldier path 6)** – Verified the life-to-initiative/bonus action/ability text matches p.147 and `meta` stays tied to index 6.
