---
layout: gruv_book_page_adapter
title: 'SDM Gear Index'
published: true
---
# SDM Gear Index

This chapter consolidates SDM gear references and extraction work across primary SDM books.

## Canon Boundary

Source-priority anchors for this chapter:

1. `Our_Golden_Age/Our_Golden_Age.md`
2. `Vastlands_Guidebook/Vastlands_Guidebook.md`
3. `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md`
4. `Eternal_Return_Key/Eternal_Return_Key.md`
5. Other Luka Rejec markdown sources in this repo

## Source Map

- Base-seed for gear structure and units: `Vastlands_Guidebook/Vastlands_Guidebook.md`
- Cross-book expansion layers: `UVG`, `OGA`, `ERK`, and other Luka-authored markdown sources

## Gear Category Index

- General gear and kits
- Armors and weapons
- Vehicles, mounts, cargo, and carry systems
- Services and market interfaces
- Implants/prosthetics and special item classes

## Verbatim Extraction Appendix (Working)

This appendix is the staging area for verbatim extraction and source-tagged mapping.

<a id="sdm-loot-and-treasure"></a>
## Loot and Treasure (Merged from Legacy SDM 06)


This chapter consolidates existing loot and treasure procedures from SDM+ source texts into one canonical reference. Use this chapter as the SDM canonical baseline for treasure handling.

## Canon Boundary

Source-priority anchors for this chapter:

1. `Our_Golden_Age/Our_Golden_Age.md`
2. `Vastlands_Guidebook/Vastlands_Guidebook.md`
3. `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md`
4. `Synthetic_Dream_Machine_01_Quickstart.md`
5. `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md`

## Core Units and Currency (Canonical)

| Unit | Equals | Note |
| --- | --- | --- |
| `1 sk` | `10 st = 100 sp` | Standard cargo lot |
| `1 st` | `10 sp` | Standard item-scale bulk |
| `1 sp` | `25 cash` | Small-item baseline |
| `1 cash (€)` | day wage baseline | Money unit |

Coin and money handling baseline:

- `250 cash = 1 st` for the bulk of coin-like items (inventory space).
- Wallet-level currency is usually treated as carried clothing unless bulk conversion matters.

BECMI alignment note for conversion passes:

- `1 cash (€) = 1 silver`.

## Existing SDM+ Treasure and Economy Context

This chapter does not invent a new treasure economy. It consolidates patterns already present in SDM+ books.

- **[Vastlands Guidebook (VLG)](Vastlands_Guidebook/Vastlands_Guidebook.md):** establishes the item/cargo money chassis (`sk/st/sp/cash`, `250 cash = 1 st`) (`HOW ITEMS WORK`), supports quick-cash sale behavior, and defines treasure-linked XP options (`Scavengers`, `Pícaros`) plus treasure-as-hallmark progression context (`EARNING EXPERIENCE`, hallmark/item sections).
- **[Our Golden Age (OGA)](Our_Golden_Age/Our_Golden_Age.md):** reinforces treasure as campaign fuel (`treasures sold for profit`), uses carousing as a money sink, and expands economy pressure into estate/investment operations, taxation friction, and recurring event escalation (`I.N.T.R.` / `Expected -> Surprising -> Error` patterns).
- **[Ultraviolet Grasslands (UVG)](Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md):** provides direct treasure handling procedures (`Trade & Goods`): valuation by rough estimate/Charisma/`d00`, treasure weight scaling (`Treasure Is Heavy`), hacking up treasure for immediate extraction (`So Hack It Up`), and canonical market research + haggling tables.
- **[SDM Quickstart](Synthetic_Dream_Machine_01_Quickstart.md):** repeats the core inventory, burden, and currency handling needed to keep treasure transport and load pressure consistent at table speed (`HOW INVENTORY WORKS`).
- **[RSS (FTLS 04)](Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md):** extends treasure-facing trade semantics for refined salvage (`Trading Salvaged Resources`) and provides the canonical extension basis for `Tag / Rarity Adjustment` and `Bulk Contracts`.

## Canonical Treasure Resolution Loop

Run this loop regardless of which generation mode produced the lot.

1. **Generate or identify lot**
- Use existing source outputs: listed site treasure, random small treasure, salvage-triggered finds, or event/complication treasure.

2. **Assign tags**
- Minimum one economic tag and one risk tag.
- Common tags: `[cash]`, `[trade]`, `[curio]`, `[relic]`, `[illegal]`, `[hot]`, `[wanted]`, `[intel]`.

3. **Normalize bulk**
- Convert all outcomes to `sp/st/sk`.
- Apply coin bulk conversion (`250 cash = 1 st`) where relevant.

4. **Set value**
- Use listed value from source text, or
- Use rough estimate / Charisma test / flat `d00` valuation.

5. **Liquidate or retain**
- Resolve local demand/supply and haggling.
- Convert to cash, favors, contracts, debt relief, or strategic assets.

6. **Apply pressure and fallout**
- Illegal/hot lots raise heat.
- Large lots can trigger event escalation in region/domain tracks.

## Value and Bulk Modifiers from Existing Text

Use the following existing modifiers before final sale:

1. Any time a treasure or item is described with fancy words, add a sack to its size for every relevant word. Add sacks for heavy materials, fine workmanship, intricate mechanics, and cyclopean architecture.
2. A smart (philistine) hero can hack out `1d6 + Level` percent of a treasure's value in one turn. This reduces the value of the rest of the work by `10x` that amount in percent.
3. If you run out of regular inventory slots for traits or items, store the excess among burdens. Each burden imposes `-1` to all rolls. At `20` burdens, you can move or speak slowly and carefully, but cannot take almost any other actions.

Source references:

- `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` (`Trade & Goods` -> `Treasure Is Heavy`, `So Hack It Up`).
- `Synthetic_Dream_Machine_01_Quickstart.md` (`HOW INVENTORY WORKS` -> `Burdens`, `Item and Trait Overflow`).
- `Vastlands_Guidebook/Vastlands_Guidebook.md` (`HOW ITEMS WORK`, `Burdens`, `Item and Trait Overflow`).

## Market Research and Liquidation

Use the existing SDM+ market chain:

1. **Base value by lot type and area context.**

2. **Market Research Procedure (local demand/supply):**  
   Yes. The characters can perform market research.
   Provenance: `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` (`Trade & Goods` -> `Market Research`).
   - **1 day:** character finds out the price of a trade good in an adjacent destination.  
   - **1 week:** character finds out the price of a trade good in a chain of three adjacent linked destinations.
   For each destination, make a market roll:

    | d20 | Price Factor | Notes |
    |---:|---:|:---|
    | 1 | 0 | It's taboo. Nobody talks about it. Like it doesn't exist. There certainly isn't a local morality cult that murders dealers. |
    | 2 | 0 | No demand or brainwashing? They don't want it at all. |
    | 3-6 | 0.5 | Low demand. |
    | 7-12 | 1 | Normal market. |
    | 13 | 1 | Depressed market. Haggling checks at a disadvantage. |
    | 14-15 | 2 | Popular but illegal. Stiff penalties for captured dealers. |
    | 16-17 | 2 | High demand. |
    | 18 | 3 | Market bubble! 1 in 6 chance per caravan visit that the market has collapsed (roll 1d10 on this table). |
    | 19 | 4 | The motherload! You're really in business now. 1 in 6 chance per caravan visit that the market has readjusted (roll again on this table). |
    | 20 | 1 | Source! They make the trade good here. Buyers make haggling checks at an advantage, sellers at a disadvantage. |

3. **Deal Procedure (haggling/terms):**  
   When characters arrive at a destination they can negotiate a deal.
   Provenance: `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` (`Trade & Goods` -> `Buying and Selling the Goods`, `Haggling Table`).
   - **1 day:** character finds a merchant and negotiates a deal. Roll on the haggling table.  
   - **1 week:** character schmoozes, boozes and wines for `1d6 x 100` cash, then has advantage on the haggling roll.  
   - **Selling:** multiply the price by the haggling factor.  
   - **Buying:** divide the price by the haggling factor.

    | d20 | Factor | Interesting Note |
    |---:|---:|:---|
    | 1 | 0 | Local authorities (or thugs?) confiscate the goods! |
    | 2-5 | 0.5 | Ripped off! Was it knives in the milk or the fine print? |
    | 6-13 | 1 | A fair and reasonable sale. |
    | 14-17 | 1.2 | A solid, profitable sale. |
    | 18-19 | 1.5 | A good trade. Anyone should be proud. |
    | 20+ | 3 | This might be almost too good. Perhaps it wouldn't hurt to quickly skip town now... |

4. **Tag / Rarity Adjustment (RSS-derived canonical extension):**  
   Provenance: [FTLS 04](Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md) (`Trading Salvaged Resources`).
   Common tags: no change.  
   In-demand, rare, or dangerous tags (e.g., [active], [void], region-critical): `+25%` to `+100%`.  
   Tainted, illegal, oversupplied, or taboo goods: `-25%` to `-100%` (including no legal market).

5. **Bulk Contracts (10+ sk) (RSS-derived canonical extension):**  
   Provenance: [FTLS 04](Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md) (`Trading Salvaged Resources`).
   Organizations usually negotiate contracts as cash, access, or rare rewards. Bonus Die trinkets may be included as part of the package.

## XP Coupling Profiles (Canonical Options)

- **[VLG](Vastlands_Guidebook/Vastlands_Guidebook.md) (`EARNING EXPERIENCE`):**  
  > "e. **Scavengers.** Earn 1 xp per €1 of treasure recovered from an ancient ruin."  
  > "f. **Pícaros.** Earn 1d6 × 100 xp after spending that much cash carousing for a week and risking strange setbacks."

- **[SDM Quickstart](Synthetic_Dream_Machine_01_Quickstart.md) (`Carousing`, sourced from [UVG 2e](Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md)):**  
  > "Any PC. Spend a week & €1d6\*x100, then gain that many XP & roll. Can't pay = [-] on roll. \*exploding"
  Referee note: resolve the outcome on the referenced UVG `d20` carousing table (`Fun, Fun, Fun`).

- **[SDM Quickstart](Synthetic_Dream_Machine_01_Quickstart.md), [OGA](Our_Golden_Age/Our_Golden_Age.md):**  
  > "...treasures sold for profit..."  
  > "Once per settlement, the PCs can fritter away their treasures on a week of tourism and debauchery. After, perhaps, they earn some experience."

1. **`Scavengers` profile:** `1 xp per 1 cash (€)` from treasure recovered from dangerous sites (VLG direct text).  
2. **`Carousing sink` profile:** convert cash to xp through weekly carousing risk rolls (VLG + SDM Quickstart direct text).  
3. **`Realized value` profile:** award treasure xp after monetization step (sale, contract, or equivalent conversion), grounded by "treasures sold for profit" and OGA’s settlement spending cadence.

### Anti-Abuse Baseline

1. No double counting the same lot across salvage, sale, and reinvestment.
2. No recursive xp from controlled buy-resell loops.
3. Unverified provenance can be awarded at reduced value until confirmed.

## Campaign-Scale Fallout Interface

Tie large treasure movement to campaign pressure systems.

- At notable haul thresholds, trigger region/domain events.
- Use `Expected -> Surprising -> Error` escalation grammar for treasure shock consequences.
- Treat tax claims, rival interception, permit crackdowns, and market distortion as default fallout vectors.

## Relationship to FTLS 09

- This chapter is the SDM canonical base.
- [FTLS 09](Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_09_Loot_and_Treasure.md) is the BECMI spiritual-successor implementation layer.
- New material may add stronger procedural scaffolding, but should not contradict this chapter's units, value/bulk normalization, or market/pressure interfaces.

## Reference Pointers

- `Synthetic_Dream_Machine_01_Quickstart.md` (`HOW INVENTORY WORKS`, cash and size units, advancement framing)
- `Vastlands_Guidebook/Vastlands_Guidebook.md` (`Scavengers`, `Picaros`, item/treasure handling)
- `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` (site treasure values/sacks, valuation guidance, random treasures, treasure extraction behavior)
- [FTLS 04](Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md) (salvage -> market chain, tag/market/haggling procedures)
- [FTLS 09](Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_09_Loot_and_Treasure.md) (BECMI spiritual-successor layer)
