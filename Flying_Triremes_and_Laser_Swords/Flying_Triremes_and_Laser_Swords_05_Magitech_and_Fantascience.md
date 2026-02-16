---
layout: gruv_book_page_adapter
title: 'Magitech and Fantascience'
published: true
---
# Magitech and Fantascience

## Magic Item Treasure Generation

Use this procedure whenever treasure generation indicates a magical item.

Legacy class-use markers from imported RC tables are not used in this chapter. Ignore `(C) (M) (S)`-style class gating.

Legacy naming rule (current pass):
- Keep recognizable RC item names, terms, and etymological language as written.
- Do not rename rolled items into SDM-native labels in this pass.
- SDM references are used as behavior anchors and close-match notes, not as replacement names.

### 1. Generation Flow

Use this procedure when Chapter 09 calls for relic/magic yield resolution.

Magic Item Yield Table (`d100`):

| d100 | Yield Class (RC term, SDM alias) | SDM+ Link / Note |
|---:|---|---|
| 01-25 | Potions (potion/oil/elixir) | consumables in [VLG](../Vastlands_Guidebook/Vastlands_Guidebook.md) |
| 26-37 | Scrolls (scroll/formula/map) | documents and powers in [SDM 04](../Synthetic_Dream_Machine_04_Powers_Index.md) |
| 38-46 | Wands / Staves / Rods (wand/staff/rod-equivalent) | charged relic tool, limited uses |
| 47-52 | Rings (ring/amulet/charm) | wearable relic with one defining effect |
| 53-62 | Miscellaneous Items (utility relic/oddity) | use [VLG d50 Strange Item](../Vastlands_Guidebook/Vastlands_Guidebook.md#page_0022) where suitable |
| 63-72 | Armor / Shields (armor/ward item) | defensive relic with cost or condition |
| 73-83 | Missile Weapons / Missiles (missile weapon/missile relic) | ranged relic output; set ammo behavior by source |
| 84-92 | Swords (sword relic) | martial relic, often claim-bearing |
| 93-00 | Miscellaneous Weapons (miscellaneous weapon relic) | unusual weapon profile; on unstable fiction, add `[wanted]` or `[taboo]` |

Strange item source pointers:
- [VLG: One Strange Item (d50)](../Vastlands_Guidebook/Vastlands_Guidebook.md#page_0022) and [VLG: Selling Your Strange Item](../Vastlands_Guidebook/Vastlands_Guidebook.md#selling-your-strange-item).  
- [UVG: 100 Strange Items (d100)](../Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md#page_0196).  

When treasure yields a magical item, run this sequence:

1. Roll `1d100` on `Magic Item Yield Table`.
2. Roll on the matching subtable (or weapon branch table) to determine the exact item.
3. Resolve item behavior with the rules below (`Use and Limits`, `Cursed Items`, and `Weapon Branches`).
4. Record output fields: `tags`, `bulk`, `usage`, `risk`.

Table-use rule: if any random result would cause clear campaign problems, reroll or choose a different result.

Output defaults by family:

| Family | Default Tags | Default Bulk | Usage Flag | Risk Note |
|---|---|---:|---|---|
| Potions | `[consumable] [arcane] [perishable]` | `1 sp` | `consumable` | `stable` |
| Scrolls | `[intel] [arcane] [copyable]` | `1 sp` | `consumable` | `temperamental` |
| Wands/Staves/Rods | `[relic] [tool] [charged]` | `1 st` | `charged` | `temperamental` |
| Rings | `[relic] [wearable] [status]` | `1 sp` | `equipped` | `stable` |
| Miscellaneous Items | `[relic] [oddity] [utility]` | `1 sp` | `equipped` | `temperamental` |
| Armor/Shields | `[relic] [armor] [ward]` | `1 st` | `equipped` | `stable` |
| Missile Weapons/Missiles | `[relic] [weapon] [ranged]` | `1 st` | `equipped` | `stable` |
| Swords | `[relic] [weapon] [claim]` | `1 st` | `equipped` | `stable` |
| Miscellaneous Weapons | `[relic] [weapon] [odd-profile]` | `1 st` | `equipped` | `temperamental` |

#### Family Resolver Tropes (RC Extraction Pass)

Use these as recognizable resolver cues when expanding each family into full subtables.

| Family | Resolver Cadence (procedure) | RC-Recognizable Tropes to Preserve |
|---|---|---|
| Potions | Roll potion result; if a special result appears, roll special potion power and apply duration logic. | Includes control-style potions, opposite/incompatible interactions, and side-effect risk on mixed use. |
| Scrolls | Roll scroll form first, then resolve embedded effect set (message, map, spell, ward, trap, curse). | Scrolls are usually consumed on use; cursed or trapped scripts can trigger immediately on read. |
| Wands/Staves/Rods | Roll item kind, then roll effect; set charges by kind when not explicitly stated. | Wands and staves are charge-driven; rods are usually persistent tools with no charge track. |
| Rings | Roll ring type directly from ring subtable. | High-impact outliers (for example spell storing or wish-tier rings) use control-valve review before placement. |
| Miscellaneous Items | Roll item directly from broad miscellany table, then apply any internal charge/use rule on that item. | Largest family; includes utility oddities, command-word devices, and campaign-warping curios. |
| Armor/Shields | Roll armor size/type, then roll magical modifier and special-power chance. | Uses AC-modifier progression and a separate special-power branch when triggered. |
| Missile Weapons/Missiles | Roll whether weapon or ammunition, then roll base magical bonus and any additional modifier chance. | Ammunition can appear in bundles; extra modifier logic mirrors other weapon branches. |
| Swords | Roll sword type and base bonus, then check for intelligence and extra modifiers. | Intelligence track includes communication/languages/powers; opponent/talent riders remain a distinct branch. |
| Miscellaneous Weapons | Roll weapon class and weapon type, then roll bonus and optional additional modifier. | Uses shared additional-modifier logic (opponent bonus or talent branch) with non-sword weapon forms. |

#### Resolver Microtables (Pass 1A)

These condensed tables are for at-table generation speed in this pass. Keep classic item naming. Full subtable expansion remains a later extraction step.

Potions Microtable (`1d20`):

| d20 | Potion Result (classic term) | Resolver Note |
|---:|---|---|
| 1 | Healing | Restore HP per system healing baseline. |
| 2 | Extra-Healing | Stronger healing tier than standard Healing. |
| 3 | Heroism | Temporary combat potency increase. |
| 4 | Giant Strength | Temporary strength increase; track damage/force effects. |
| 5 | Growth | Increase size and melee effect profile. |
| 6 | Diminution | Reduce size; apply movement and visibility implications. |
| 7 | Levitation | Vertical movement control only unless otherwise noted. |
| 8 | Invisibility | User and gear become unseen until broken by effect text. |
| 9 | Polymorph Self | Temporary form change with referee-approved capability limits. |
| 10 | Speed | Increased movement and action tempo for stated duration. |
| 11 | Flying | True movement in 3D space; enforce maneuver constraints. |
| 12 | Water Breathing | Breathing capability shift for submerged operation. |
| 13 | Treasure Finding | Directional sensing toward treasure concentrations. |
| 14 | Clairaudience | Remote hearing through line-of-effect limits. |
| 15 | Clairvoyance | Remote viewing through line-of-effect limits. |
| 16 | Human Control | Control/charm effect against human targets by HD threshold. |
| 17 | Dragon Control | Control/charm effect against dragon targets by size/HD threshold. |
| 18 | Undead Control | Control effect against undead targets by HD threshold. |
| 19 | Poison | Harmful potion; save and onset follow poison procedure. |
| 20 | Special Potion | Roll `1d6`: `1-2` unusual utility, `3-4` volatile side effect, `5` cursed inversion, `6` referee choice. |

Scrolls Microtable (`1d20`):

| d20 | Scroll Result (classic term) | Resolver Note |
|---:|---|---|
| 1-8 | Spell Scroll | Roll `1d6` spells: `1-3` one spell, `4-5` two spells, `6` three spells; choose from campaign spell list without class gating. |
| 9-10 | Protection Scroll | Set protection target (creature type, element, or magic-effect category) and boundary rules. |
| 11 | Cursed Scroll | Trigger curse on read unless identified and countered first. |
| 12 | Map to Treasure Type | Map points to one treasure category/location type. |
| 13 | Treasure Map | Map points to specific hidden cache, lair, or vault route. |
| 14 | Communication | One-use message script or delayed reading message. |
| 15 | Illumination | Area-light script with duration and reveal utility. |
| 16 | Trapping | Scripted trigger hazard keyed to a condition or location. |
| 17 | Repeating | Repeat-cast script; apply explicit repeat constraints. |
| 18 | Shelter | Temporary safe-room or barrier effect script. |
| 19 | Travel | Teleport/translation/travel effect with destination constraints. |
| 20 | Questing or Portals | Assign binding objective script or portal-opening sequence. |

Wands, Staves, and Rods Microtable (`1d20`):

| d20 | Result (classic term) | Resolver Note |
|---:|---|---|
| 1 | Wand of Enemy Detection | Detection arc; blocked by insulation limits. |
| 2 | Wand of Magic Detection | Detect active magic and enchanted objects in range. |
| 3 | Wand of Fireballs | Charged area-damage effect; apply blast hazards. |
| 4 | Wand of Lightning Bolts | Charged line effect; include rebound risk in tight spaces. |
| 5 | Wand of Cold | Charged cold-projection effect. |
| 6 | Wand of Fear | Morale and control pressure effect. |
| 7 | Wand of Illusion | Creates sensory falsehoods; resolve disbelief normally. |
| 8 | Wand of Paralysation | Control/lockdown effect against target save. |
| 9 | Wand of Polymorphing | Forced form-change effect with duration handling. |
| 10 | Wand of Negation | Suppression/counter effect vs magical activity. |
| 11 | Staff of Healing | Recovery staff with charge spend per use. |
| 12 | Staff of Striking | Damage staff; charge can amplify melee output. |
| 13 | Staff of Wizardry | Multi-effect staff; roll or choose effect per activation. |
| 14 | Staff of Power | High-tier multi-effect staff; apply backlash risk on overload. |
| 15 | Staff of Commanding | Creature-control and command-effect profile. |
| 16 | Staff of Withering | Debilitating touch/strike effects. |
| 17 | Rod of Cancellation | Nullifies enchanted effects/items on contact resolution. |
| 18 | Rod of Inertia | Dampens force and momentum effects in local resolution. |
| 19 | Rod of Weaponry | Generates or channels weapon-form magical force. |
| 20 | Rod of the Wyrm | High-tier draconic rod profile; referee oversight recommended. |

Wand/Staff/Rod charge rule:
- If charges are not listed: wand `3d10`, staff `2d20`, rod no charge track unless item text says otherwise.

Rings Microtable (`1d20`):

| d20 | Ring Result (classic term) | Resolver Note |
|---:|---|---|
| 1 | Ring of Animal Control | Control branch keyed to beasts by HD threshold. |
| 2 | Ring of Delusion | Cursed/misleading ring; identification may misreport function. |
| 3 | Ring of Djinni Summoning | Summon/command negotiation with high fallout risk. |
| 4 | Ring of Fire Resistance | Fire/heat protection with clear immunity boundary. |
| 5 | Ring of Human Control | Control branch keyed to humans by HD threshold. |
| 6 | Ring of Invisibility | Ongoing invisibility while worn and maintained. |
| 7 | Ring of Protection +1 | Defensive modifier ring. |
| 8 | Ring of Protection +2 | Defensive modifier ring. |
| 9 | Ring of Protection +3 | Defensive modifier ring. |
| 10 | Ring of Regeneration | Gradual recovery effect with timing cadence. |
| 11 | Ring of Spell Storing | Stores castable spell payloads for later release. |
| 12 | Ring of Spell Turning | Reflect/turn incoming spell effects by limit. |
| 13 | Ring of Telekinesis | Sustained force-manipulation profile. |
| 14 | Ring of Truth | Truth-binding or lie-exposure interaction. |
| 15 | Ring of Water Walking | Surface movement over liquid surfaces. |
| 16 | Ring of Weakness | Cursed weakening effect while worn. |
| 17 | Ring of Wishes | High-tier outlier; apply control-valve review before placement. |
| 18 | Ring of X-Ray Vision | Penetrating sight with strain/limit handling. |
| 19 | Ring of Truthfulness | Enforces truth-speaking pressure while active. |
| 20 | Ring of Truthlessness | Enforces false-speech pressure while active. |

Miscellaneous Items Microtable (`1d20`):

| d20 | Item Result (classic term) | Resolver Note |
|---:|---|---|
| 1 | Bag of Holding | Capacity expansion with container-risk handling. |
| 2 | Boots of Levitation | Vertical movement utility item. |
| 3 | Boots of Speed | Movement-rate spike for limited duration. |
| 4 | Broom of Flying | Vehicle-like aerial movement profile. |
| 5 | Cloak of Displacement | Defensive misdirection effect. |
| 6 | Crystal Ball | Scrying/remote observation item with usage limits. |
| 7 | Crystal Ball with ESP | Scrying plus thought-sense rider. |
| 8 | Efreeti Bottle | Summon/binding negotiation item with volatility risk. |
| 9 | Gauntlets of Ogre Power | Strength enhancement while worn. |
| 10 | Helm of Telepathy | Mind-link and thought-read branch effects. |
| 11 | Helm of Teleportation | Teleport effect with destination risk. |
| 12 | Lyre of Building | Structural shaping/protection performance effect. |
| 13 | Medallion of ESP | Thought-detection band with range limits. |
| 14 | Mirror of Life Trapping | Capture/reflection hazard item. |
| 15 | Rope of Climbing | Commanded movement utility. |
| 16 | Scarab of Protection | Defensive anti-magic or anti-curse charge item. |
| 17 | Wings of Flying | Wearable flight effect. |
| 18 | Amulet of Proof Against Detection and Location | Anti-scrying and anti-location ward item. |
| 19 | Manual/Tome (attribute gain) | Read-and-train advancement item with one-use limit. |
| 20 | Cursed Miscellaneous Item | Roll cursed effect and bind trigger condition. |

Armor/Shields Microprocedure:
1. Roll item form by source cadence: choose armor group (`Banded/Scale/Leather`, `Chain`, `Plate/Suit`, `Shield`) or a combined shield form.
2. Roll `1d100` for AC modifier by group:
   - `Banded/Scale/Leather`: `01-70 +1`, `71-88 +2`, `89-96 +3`, `97-99 +4`, `00 +5`
   - `Chain`: `01-60 +1`, `61-81 +2`, `82-92 +3`, `93-98 +4`, `99-00 +5`
   - `Plate/Suit`: `01-50 +1`, `51-74 +2`, `75-88 +3`, `89-96 +4`, `97-00 +5`
   - `Shield`: `01-40 +1`, `41-67 +2`, `68-84 +3`, `85-94 +4`, `95-00 +5`
3. Roll special-power chance by AC modifier:
   - `+1` `10%`
   - `+2` `15%`
   - `+3` `20%`
   - `+4` `25%`
   - `+5` `30%`
4. If special power applies, roll `1d12`:
   `1` absorption, `2` charm, `3` cure wounds, `4` electricity, `5` energy drain, `6` ethereality, `7` fly, `8` gaseous form, `9` haste, `10` invisibility, `11` reflection, `12` remove curse.

Missile Weapons/Missiles Microprocedure:
1. Roll `1d6` output: `1-3` missile weapon, `4-6` magical ammunition bundle.
2. Roll base bonus `1d6`: `1-3` `+1`, `4` `+2`, `5` `+3`, `6` `+4`.
3. Roll `1d6` additional-modifier chance: on `1` roll one missile talent (`1d12`):
   `1` biting, `2` burning, `3` climbing, `4` curing, `5` disguising, `6` flying, `7` homing, `8` lightning, `9` reflecting, `10` seeking, `11` speaking, `12` stunning.

Swords Microprocedure:
1. Roll sword type `1d6`: `1` normal, `2` short, `3` broad, `4` bastard, `5` two-handed, `6` referee choice.
2. Roll base bonus `1d6`: `1-3` `+1`, `4` `+2`, `5` `+3`, `6` `+4`.
3. Roll `1d6` intelligence chance: on `1` sword is intelligent; roll communication, powers, and motive.
4. Roll `1d6` additional-modifier chance: on `1-2`, add opponent bonus or talent rider.

Miscellaneous Weapons Microprocedure:
1. Roll weapon class `1d6`: `1` blunt, `2` edged, `3` polearm, `4` thrown, `5` flexible, `6` referee choice.
2. Roll specific weapon type by class (axe, mace, spear, hammer, dagger, sling variant, and similar).
3. Roll base bonus `1d6`: `1-3` `+1`, `4` `+2`, `5` `+3`, `6` `+4`.
4. Roll `1d6` additional-modifier chance: on `1`, add opponent bonus or a weapon talent rider.

Weapon Secondary Resolvers (RC Extraction Pass):

Additional Weapon Modifier Table (`1d100`):

| d100 | Additional Modifier | Resolver Note |
|---:|---|---|
| 01-33 | `+1` extra vs opponent | Use for miscellaneous-weapon cadence. |
| 34-57 | `+2` extra vs opponent | Use for miscellaneous-weapon cadence. |
| 58-73 | `+3` extra vs opponent | Use for miscellaneous-weapon cadence. |
| 74-82 | `+4` extra vs opponent | Use for miscellaneous-weapon cadence. |
| 83-85 | `+5` extra vs opponent | Use for miscellaneous-weapon cadence. |
| 86-00 | Talent | Roll on Talents table. |

Sword-only adjustment:
- For swords, use source-weighted sword bands: `01-29 +1 vs opponent`, `30-50 +2`, `51-64 +3`, `65-72 +4`, `73-75 +5`, `76-00 talent`.

Opponents Table (`1d100`):

| d100 | Opponent Category |
|---:|---|
| 01-06 | Bugs |
| 07-09 | Constructs |
| 10-15 | Dragonkind |
| 16-24 | Enchanted monsters |
| 25-36 | Giantkind |
| 37-48 | Lycanthropes |
| 49-52 | Planar monsters |
| 53-58 | Regenerating monsters |
| 59-67 | Reptiles and dinosaurs |
| 68-70 | Spell-immune monsters |
| 71-76 | Spellcasters |
| 77-88 | Undead |
| 89-94 | Water-breathing monsters |
| 95-00 | Weapon-using monsters |

Talents Table (`1d100`):

| d100 | Talent | Resolver Note |
|---:|---|---|
| 01-05 | Breathing | Enables breathing adaptation for hostile environments. |
| 06-12 | Charming | Adds influence pressure in social or combat contact. |
| 13-16 | Deceiving | Supports disguise/false signal behavior. |
| 17-23 | Defending | Defensive rider against incoming attacks/projectiles. |
| 24-25 | Deflecting | Deflection-focused defense rider. |
| 26-27 | Draining | On hit, drains vitality or power by a small step. |
| 28-32 | Extinguishing | Suppresses fire/light effects on impact. |
| 33-38 | Finding | Guidance toward keyed targets, places, or tracks. |
| 39-43 | Flaming | Adds fire rider to successful hits. |
| 44-46 | Flying | Weapon can return/hover/move under command. |
| 47-54 | Healing | Limited restorative pulse when trigger condition is met. |
| 55-59 | Hiding | Improves concealment/anti-detection while carried. |
| 60-65 | Holding | Briefly restrains or fixes target in place on trigger. |
| 66-73 | Lighting | Adds light/electric style rider on impact. |
| 74-79 | Silencing | Dampens sound/spell voice components in local area. |
| 80-81 | Slicing | Adds cutting-pressure rider effect. |
| 82-85 | Slowing | Reduces target speed/action tempo on trigger. |
| 86-89 | Speeding | Increases user tempo while wielded. |
| 90-94 | Translating | Enables language translation or script decoding. |
| 95-99 | Watching | Persistent vigilance/sensing rider. |
| 00 | Wishing | Wish-tier outlier; referee oversight required. |

Intelligent Sword Track (condensed):
1. Check intelligence: roll `1d6`; on `1`, sword is intelligent.
2. Roll `1d6` INT band:
   - `1-2` low cunning
   - `3-4` alert and strategic
   - `5` very intelligent
   - `6` exceptional intellect
3. Roll communication mode `1d6`: empathy, speech, telepathy, runic dream, emotional surge, audible voice.
4. Roll powers `1d6`: `1-3` one power, `4-5` two powers, `6` three powers.
5. Roll motive/alignment tension: if wielder goals oppose sword motive, require contest checks for command authority.

Description Procedures (RC Cadence, condensed):

Potion description procedure:
1. Determine physical cue (color, clarity, odor, container marks). Cue is suggestive, not definitive.
2. If a potion is being tested rather than fully consumed: with an appropriate skill, a tiny sip identifies the effect; otherwise, give a partial hint only.
3. A full dose is normally one use; effect begins immediately unless the potion states delayed onset.
4. If duration is unstated, use chapter default duration; if permanent, record that explicitly.
5. If a second incompatible potion is consumed while one is active, apply sickness/inactivity as listed in `Use and Limits`.
6. For control-type potions, cap affected targets by HD/size band and preserve insulation/line-of-effect limits where relevant.

Scroll description procedure:
1. Determine scroll form (spell, protection, map/message, special script, cursed).
2. Reading a scroll requires focused reading; interruption voids that reading attempt for the round.
3. Spell scrolls are consumed on successful cast release unless a repeating rule says otherwise.
4. Protection scrolls must define target category, boundary shape, and duration at activation.
5. Cursed scrolls trigger on read unless identified and countered first; resolve through cursed-item loop.
6. Map/message scrolls must define exact payload (location, route, warning, or code phrase) at generation time.

Wand/Staff/Rod description procedure:
1. Determine exact item and charge state (or non-charge state for persistent rods).
2. Activation requires item in hand and an explicit activation act (word, gesture, strike, or command mode).
3. Default charge spend is one per activation unless the item text lists a different cost.
4. If charges are unknown, track privately and reveal only through use/testing.
5. When charges reach zero, item becomes inert until restored by explicit campaign method.

Ring and miscellaneous handling notes:
- Rings: worn items with persistent or triggered effects; if multiple rings conflict, strongest effect applies and weaker is suppressed.
- Miscellaneous items: always record trigger mode (`worn`, `held`, `command`, `placed`) to prevent ambiguity at table.

#### Descriptive Extraction (RC Style Pass)

These sections retain the classic item names, order, and adjudication cadence. This pass stays intentionally close to RC-era phrasing and procedure sequence, while remaining a non-verbatim rules adaptation for FTLS.

##### Potion Descriptions

Potions are ordinarily found in small glass vials and may differ in color, thickness, smell, and clarity. These outward signs are unreliable for true identification, and two potions with very different appearances may produce similar results. A sip test can give a useful clue if the imbiber has an appropriate skill; otherwise it gives only an uncertain hint. Unless a potion says otherwise, use the default item constants in this chapter for range and duration. One complete vial is usually one dose; drinking in combat takes one round. When two potions are consumed and their effects conflict, the user becomes sick and unable to act for three turns. Control potions follow the classic concentration model: while the drinker directs controlled targets, the drinker takes no unrelated actions.

Names retained are `Healing`, `Extra-Healing`, `Heroism`, `Giant Strength`, `Growth`, `Diminution`, `Levitation`, `Invisibility`, `Polymorph Self`, `Speed`, `Flying`, `Water Breathing`, `Treasure Finding`, `Clairaudience`, `Clairvoyance`, `Human Control`, `Dragon Control`, `Undead Control`, `Poison`, and `Special Potion`. Resolve them by classic family behavior: restorative draughts heal immediately; movement draughts alter pace, form, or travel mode; control draughts affect bounded categories and HD ranges; sense draughts extend perception; and volatile draughts can invert expected results or impose harmful side effects.

##### Scroll Descriptions

Scroll procedure begins with form and intent. Decide whether the parchment is a spell text, protective circle, map or message, repeating script, trapping script, shelter script, travel script, portal/quest script, or cursed script. Reading requires concentration and clear performance of the written method; interruption spoils that reading for the round. Spell scrolls are generally consumed when the magic is released. Protective and special scrolls require exact declaration of target class, area shape, and activation timing when read. Maps and communication scripts must be concrete enough to use at the table, not abstract flavor. Cursed scripts follow the normal cursed-item loop and are triggered by reading unless identified and countered in advance.

Forms retained are `Spell Scroll`, `Protection Scroll`, `Cursed Scroll`, `Map to Treasure Type`, `Treasure Map`, `Communication`, `Illumination`, `Trapping`, `Repeating`, `Shelter`, `Travel`, and `Questing or Portals`. Their procedures should be run in that classic order: determine form, read/trigger method, area/target limits, duration, and consumption state.

##### Wand Descriptions

Wands are slender command items, usually of wood or crystal, built for repeated but finite use. They must be held and pointed or otherwise aimed to direct effect. If charge state is not known to players, track it privately and reveal depletion through use. The user announces intent and target, then expends charges as required by the wand text (defaulting to this chapter's wand charge model when unspecified). Keep the classic wand families intact: detection, projection, control, fear/disruption, and negation effects.

Names retained are `Wand of Enemy Detection`, `Wand of Magic Detection`, `Wand of Fireballs`, `Wand of Lightning Bolts`, `Wand of Cold`, `Wand of Fear`, `Wand of Illusion`, `Wand of Paralysation`, `Wand of Polymorphing`, and `Wand of Negation`.

##### Staff Descriptions

Staves are larger command items with broader powers and heavier impact than most wands. They are still finite unless the staff text says otherwise, and many effects require explicit command words, contact strikes, or declared target sets. Record charge cost per function and note any backlash or danger clauses for overextension. Staff routines should preserve the classic pattern of restorative effects, combat strikes, command effects, and multi-function high-magic utility.

Names retained are `Staff of Healing`, `Staff of Striking`, `Staff of Wizardry`, `Staff of Power`, `Staff of Commanding`, and `Staff of Withering`.

##### Rod Descriptions

Rods are short, heavy command instruments associated with strong singular effects. In procedure, treat them as high-leverage tools that are often persistent or repeatable, unless a rod text introduces limits. Their adjudication should be deliberate: define trigger, range, and resistance handling before play. Rod results often shift encounters sharply, so keep tone checks explicit during generation.

Names retained are `Rod of Cancellation`, `Rod of Inertia`, `Rod of Weaponry`, and `Rod of the Wyrm`.

##### Ring Descriptions

Rings function when worn and usually remain active as continuous, passive, or command-trigger effects. The referee should record whether a ring is always-on or requires an explicit act each round. If ring effects overlap or conflict, apply the stronger effect and suppress weaker overlap for that interval. Keep both beneficial and harmful lines in circulation so ring generation remains uncertain and interesting.

Names retained are `Ring of Animal Control`, `Ring of Delusion`, `Ring of Djinni Summoning`, `Ring of Fire Resistance`, `Ring of Human Control`, `Ring of Invisibility`, `Ring of Protection +1`, `Ring of Protection +2`, `Ring of Protection +3`, `Ring of Regeneration`, `Ring of Spell Storing`, `Ring of Spell Turning`, `Ring of Telekinesis`, `Ring of Truth`, `Ring of Water Walking`, `Ring of Weakness`, `Ring of Wishes`, `Ring of X-Ray Vision`, `Ring of Truthfulness`, and `Ring of Truthlessness`.

##### Miscellaneous Item Descriptions

Miscellaneous items are intentionally broad and irregular. For each result, define physical form, trigger mode (`worn`, `held`, `command`, `placed`), activation constraints, and one sentence on consequence if misused. This category should preserve the old rhythm of utility wonders, odd devices, mobility gear, protective charms, and dangerous curios. Cursed variants belong here as well, and should be generated openly enough to play but hidden enough to preserve discovery.

Names retained are `Bag of Holding`, `Boots of Levitation`, `Boots of Speed`, `Broom of Flying`, `Cloak of Displacement`, `Crystal Ball`, `Crystal Ball with ESP`, `Efreeti Bottle`, `Gauntlets of Ogre Power`, `Helm of Telepathy`, `Helm of Teleportation`, `Lyre of Building`, `Medallion of ESP`, `Mirror of Life Trapping`, `Rope of Climbing`, `Scarab of Protection`, `Wings of Flying`, `Amulet of Proof Against Detection and Location`, `Manual/Tome (attribute gain)`, and `Cursed Miscellaneous Item`.

##### Armor and Shields Descriptions

Armor and shields use the classic two-stage process: first determine armor type and protective modifier, then check for special power chance and resolve that power if indicated. The modifier is the baseline protection; special powers are an added branch, not a replacement. Once generated, record whether power is passive, triggered, or command-based so in-play timing is clear.

Special powers retained are `Absorption`, `Charm`, `Cure Wounds`, `Electricity`, `Energy Drain`, `Ethereality`, `Fly`, `Gaseous Form`, `Haste`, `Invisibility`, `Reflection`, and `Remove Curse`.

##### Missile Weapons and Missiles Descriptions

Missile results preserve the classic split between launchers and ammunition, with separate procedures for base bonus, additional modifier chance, and talent assignment. Resolve item form first, then bonus band, then check for extra properties. Ammunition bundles should have count and recovery assumptions written at generation time so their value and longevity are clear in play.

Talents retained are `Biting`, `Blinking`, `Charming`, `Climbing`, `Curing`, `Disarming`, `Dispelling`, `Flying`, `Lighting`, `Penetrating`, `Refilling`, `Screaming`, `Seeking`, `Sinking`, `Slaying`, `Speaking`, `Stunning`, `Teleporting`, `Transporting`, and `Wounding`.

##### Sword Descriptions

Sword generation keeps the classic branch structure: determine sword type and magical bonus, roll for additional modifiers, then test for intelligence and communication level. Intelligent swords use the familiar communication bands `Nil`, `Empathy`, and `Speech`, then branch into primary and extraordinary powers. If a sword is intelligent, record purpose and personality cues immediately so it can act as a presence in play rather than a static bonus item.

Primary powers retained are `Detect Evil (Good)`, `Detect Gems`, `Detect Magic`, `Detect Metal`, `Detect Shifting Walls and Rooms`, `Detect Sloping Passages`, `Find Secret Doors`, `Find Traps`, and `See Invisible`. Extraordinary powers retained are `Clairaudience`, `Clairvoyance`, `ESP`, `Extra Damage`, `Flying`, `Healing`, `Illusion`, `Levitation`, `Telekinesis`, `Telepathy`, `Teleportation`, and `X-Ray Vision`.

##### Additional Weapon Modifiers: Opponents

Opponent categories are preserved as classic target bands for additional weapon bonuses. These are resolved after base weapon bonus and before talent handling, and should be read as specific prey profiles rather than universal damage increases.

Categories retained are `Bugs`, `Constructs`, `Dragonkind`, `Enchanted Monsters`, `Giantkind`, `Lycanthropes`, `Planar Monsters`, `Regenerating Monsters`, `Reptiles and Dinosaurs`, `Spell-Immune Monsters`, `Spellcasters`, `Undead`, `Water-Breathing Monsters`, and `Weapon-Using Monsters`.

##### Additional Weapon Modifiers: Talents

Talent categories remain in their classic form and are resolved as secondary behavior lines attached to the weapon result. Treat talents as operational hooks for encounter play, not only flavor labels.

Talents retained are `Breathing`, `Charming`, `Deceiving`, `Defending`, `Deflecting`, `Draining`, `Extinguishing`, `Finding`, `Flaming`, `Flying`, `Healing`, `Hiding`, `Holding`, `Lighting`, `Silencing`, `Slicing`, `Slowing`, `Speeding`, `Translating`, `Watching`, and `Wishing`.

Artifact rule:
- Artifacts are high-tier exceptions, not routine treasure.
- If introduced, treat them as campaign-shaping items with bespoke adjudication.

### 2. Use and Limits

Item model:
- **Temporary items:** consumed on use or exhausted by charges.
- **Permanent items:** continuously effective when properly worn or wielded.

Identification:
- Items are usually identified by testing them in play.
- Testing may trigger poison, curse, or hostile side effects.

Activation and handling:
- A ring must be worn, a shield must be carried, and other gear must be used in its proper manner.
- Protective worn items are normally active while worn.
- For temporary effects that are not consumed immediately, the user must hold the item and concentrate.
- While concentrating on such an item, the user cannot cast spells or take other actions in that round.
- Item activation resolves in the round's magic/items timing.
- Charge counts are unknown until spent through use or scanned with a Power.

Default effect constants:
- If range or duration is not stated, treat the effect as `6th-level` caster output.
- If temporary duration is not stated, use `1d6 + 6` turns unless the item text says otherwise.

Insulation limit:
- Detection/control effects can be blocked by lead sheet, metal about `1'` thick, or stone about `10'` thick.

Potion timing:
- Drinking a potion in combat takes one round.
- If a second incompatible potion is taken while another is active, the user is sick and inactive for 3 turns.

### 3. Cursed Items

Any treasure result may be cursed.

Cursed-item procedure:
1. Determine whether the item carries a curse when identified or activated.
2. Apply the curse as soon as its trigger condition is met (wear, wield, read, drink, activate).
3. A remove-curse effect may suppress a curse briefly (`1d20` rounds).
4. Permanent removal requires stronger magic (typically high-level caster support), high-tier ritual work, quest service, or equivalent campaign effort.
5. Record cursed output as `risk note: unstable`; add `[wanted]` or `[taboo]` where fallout follows.

Curses may invert bonuses, bind equipment, force compulsive behavior, or impose escalating narrative costs.

### 4. Weapon Branches

Use one of two methods.

Simple method (recommended for lower-power generation):
1. Roll `1d6` for branch:
   - `1-2` missile weapon or missile
   - `3-4` sword
   - `5-6` miscellaneous weapon
2. Roll `1d100` on the selected branch list.
3. Apply base magical bonus and listed rider effects.

Detailed method (for higher-power or more specific generation):
1. Roll weapon family and class band.
2. Roll magical bonus band (`+1` to `+5`).
3. Roll additional-modifier chance.
4. If successful, roll secondary modifier type:
   - extra bonus vs opponent category
   - talent/power branch
5. For swords, roll intelligence/power track when indicated by the result.

Class-only locks from legacy subtables are ignored in this chapter.

### 5. Magic-Item Market Procedure

This section handles magical item trade only. Use Chapter 09 for general loot cash-out procedures.

Market loop:
1. Declare sale path: patron broker, faction buyer, collector circuit, or private auction.
2. Run buyer search as an active process, not an automatic transaction.
3. Resolve offer quality against item risk, notoriety, and urgency.
4. On refusal, convert outcome to obligation, favor debt, or delayed sale queue.

Default assumption: many magical items are traded for favors, leverage, or access before straight cash.

### 6. Creation

Prerequisites:
- Creator is normally `level 9+`.
- Creator must know the relevant effect.
- Creator must work with a suitable specialist/crafter.
- Rare components are required for each major effect track.

Chance of success:
- Roll once per effect track:
  - `((INT or WIS) + level) x 2 - (3 x spell level) = success %`
- Failure consumes the attempt's time and material commitment.

Time and cost:
- Base creation time is `1 week + 1 day per 1,000 gp` equivalent cost (rounded up).
- Work must be continuous; long interruptions spoil progress.
- Cost includes base object, enchantment materials, specialist labor, and rare components.

Armor/weapon baseline formulas:
- Armor initial enchantment cost:
  - `(nonmagical gp x enc) / 3`, rounded up to nearest `10`.
- Weapon initial enchantment cost:
  - `(nonmagical gp x enc) x 5`, rounded up to nearest `10`.
- Additional bonus tiers multiply initial enchantment cost.

Creation output record:
- `Item: ... / Tags: ... / Bulk: ... / Usage: equipped|consumable|charged|unstable / Risk: stable|temperamental|unstable`

---

# Albums, Anchored Powers, Grimoires

“A spell is only half‑real until it has a spine and a cover.” — Anon. Archivist‑Daemon

## 1\. What is a Grimoire?

A Grimoire is a physical (occasionally psychonoetic) artefact \- magitech+fantascience from the Long Long Ago that compresses, encrypts, and curates power patterns—the same formulae sold today as Albums of Power. Unlike a loose album, each Grimoire is self‑contained technology: open its cover (or socket it into your cortex) and you have a portable spell‑library.  
It occupies one inventory slot (usually physical; rare "glass‑mind wafers" take a Trait slot).

A Grimoire is Named: immune to the Curse of Iron and counts as a Named Item for narrative effects. While most Albums start as level 0 items, Grimoires often start at a higher level due to the secrets of their  construction.

## 2\. Capacity & Slots

The Grimoire’s Level sets how many powers it can store (Capacity) and how many it can have active (Anchor Slots \= Level).

\> d20+Level on Album table VLG p106

When first created, roll d20 \+ Grimoire Lvl and consult Album Level / Price (VLG p106) to discover the maximum total spell levels it can archive.

## 2.1 Anchored vs Astral Powers

Anchored slots hold Mods or Powers that are pre‑loaded into the Grimoire’s hardware—ready to use, just pay the price. Each occupies one Anchor Slot but no character inventory slots.

Astral copies are Powers inscribed in the user’s soul. Each uses one Trait inventory slot.

Capacity (max power): replicate & swap Powers in and out of Grimoire's Capacity to Anchor slots or character Trait slots. Move up to your own level in powers per attempt. Takes a ten minute meditation, or a move action \+ Aura save, failure: make a Danger Roll.

## 3\. Levelling a Grimoire

A Grimoire may grow through play, just like a Hallmark (or Path Trait). On gaining a level, increase Capacity and Anchor Slots per the Hallmark rules.

* Daemon Experience – When the owner gains XP and dedicates it to the book, the Grimoire may level up (see Hallmark rules).  
* Deeds – Succeed at three significant tests where the Grimoire mattered (e.g. defeating a Flux anomaly with its powers) before one failure or a story‑driven time limit; on success, Level +1.

## 4\. Mods & Hardware Upgrades

Mods are physical or code augments inserted into spare Anchor Slots. See Custom Combat Gear, Vastlands Guidebook p. 80, for general ideas.

\> Installation: spend a watch and succeed a d20 \+ Thought vs 13 test, or pay a Tech‑Lares €100.

Failed Installation tests force a Danger Roll.

**Grimoire mods:**

| Mod | Effect | Install Cost (refined stones) |
| --- | --- | --- |
| Flux‑Regulator | Reduce Life cost of powers by 1 (min 1) once per watch | 1 static, 1 active |
| Holo‑Indexer | Swap to or from Capacity, Astral, or Anchored as a free action 1/watch(4 hours) | 1 dynamic, active |
| Soul‑Parity Dweomer Key | Owner may cast an Anchored power when brought to 0 Life as a free action with price 0 (no overcharging, still risks defeat) | 2 dynamic |

## 5\. Using a Grimoire in Play  

Load Powers during downtime or with 10 minutes of uninterrupted fiddling.

Casting: identical to normal power use; the Grimoire simply exempts the caster from occupying personal Trait/Physical slots for anchored spells.

\> Trade & Loot: A Grimoire sells for its Album base price × Lvl, plus €50 per Mod. Selling a used one? Begin haggling at 60% base price.

## \*\*Example Grimoires (1d6):\*\*

| Name & Format | Level / Anchor Slots | Capacity (lv) | Quirks |
| --- | --- | --- | --- |
| 1. Codex of the Sea‑Filk Apocalypse (knotted net record, mint) | 3 | 26 lv | Plays mournful surf‑guitar through any speaker within 30 ′ when opened. |
| 2. Heliophage Heart Glyphs (sun‑etched memory tattoo) | 1 | 12 lv | Glows amber when undead are within 60 ′; once each dawn, bearer may reduce the Life cost of a Light‑tagged power by 1, min 1. |
| 3. Lacrimae Machina Manual (compact phonograph) | 2 | 18 lv | When a power in this album is cast (anchored or trait), nearby machines briefly weep lubricant. This might trigger a Reaction roll. |
| 4. Null Priest Litany Disk (artificial mnemonic lotus) | 4 | 33 lv | Uncanny Dirge: After the bearer casts their first power each watch, an ethereal chorus swells; enemies within 30 ′ suffer −1 to all rolls until the end of the next round. |
| 5. Erebus Library Tile (tetragonal bone‑scales) | 2 | 17 lv | +2 on Lore checks about portals while carried. |
| 6. Quietus Memory Demi‑Tome (pale parchment codex) | 1 | 11 lv | If the bearer dies, the book captures the last minute of memories (usable once). |

## Grimoire Recipes

Recipe: Orichalcum Codex of the Sea‑Filk Apocalypse (Lvl 3)  
Ingredients: 2 st static \- \[orichalcum\] sheets, 2 st active \- stabilised \[echo\] crystals, 3 st dynamic \- \[dream\] loop-seeds

Process: Forge sheets into “surfer‑shell” plates (PAT 13); inlay echo crystals while chanting sea‑filk songs (ARC 15).  
Time Cost: 3 watches.  
Hazard: Discordant ear‑worms, Aura Save or make a Danger Roll.

Recipe: Quietus Memory Demi‑Tome (Lvl 1)  
Ingredients: 1 st static \- bleached \[vellum\] sheets, 1 st active \- amber stasis \[wax\], 2 st dynamic \- distilled \[oblivion\] motes  
Process: Inscribe mnemonic sigils in ghost‑ink (d20 \+ Thought vs 13); press pages in stasis wax beneath a waning moon (d20 \+ Aura vs 13).  
Time Cost: 1 watch (4 hours) in shadow and moonlight.  
Hazard: Echo feedback — roll CHA 12 or gain a Fleeting Memory burden.
