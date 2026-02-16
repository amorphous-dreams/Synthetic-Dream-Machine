---
layout: gruv_book_page_adapter
title: 'Magitech and Fantascience'
published: true
---
# Magitech and Fantascience

## Magic Item Treasure Generation

Use this procedure whenever treasure generation indicates a magical item.

Legacy class-use markers from imported RC tables are not used in this chapter. Ignore `(C) (M) (S)`-style class gating.

Section order:
1. `Generation Flow`
2. `Use and Limits`
3. `Cursed Items`
4. `Weapon Branches`
5. `Magic-Item Market Procedure`
6. `Creation`
7. `Descriptive Extraction (RC Style Pass)`

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

| Armor Group | `1d100` -> AC Modifier |
|---|---|
| Banded/Scale/Leather | `01-70 +1`, `71-88 +2`, `89-96 +3`, `97-99 +4`, `00 +5` |
| Chain | `01-60 +1`, `61-81 +2`, `82-92 +3`, `93-98 +4`, `99-00 +5` |
| Plate/Suit | `01-50 +1`, `51-74 +2`, `75-88 +3`, `89-96 +4`, `97-00 +5` |
| Shield | `01-40 +1`, `41-67 +2`, `68-84 +3`, `85-94 +4`, `95-00 +5` |

3. Roll special-power chance by AC modifier:

| AC Modifier | Special-Power Chance |
|---|---:|
| `+1` | `10%` |
| `+2` | `15%` |
| `+3` | `20%` |
| `+4` | `25%` |
| `+5` | `30%` |

4. If special power applies, roll `1d12`:

| `1d12` | Special Power |
|---:|---|
| 1 | absorption |
| 2 | charm |
| 3 | cure wounds |
| 4 | electricity |
| 5 | energy drain |
| 6 | ethereality |
| 7 | fly |
| 8 | gaseous form |
| 9 | haste |
| 10 | invisibility |
| 11 | reflection |
| 12 | remove curse |

Missile Weapons/Missiles Microprocedure:
1. Roll `1d6` output:

| `1d6` | Output |
|---:|---|
| 1-3 | missile weapon |
| 4-6 | magical ammunition bundle |

2. Roll base bonus `1d6`:

| `1d6` | Base Bonus |
|---:|---|
| 1-3 | `+1` |
| 4 | `+2` |
| 5 | `+3` |
| 6 | `+4` |

3. Roll `1d6` additional-modifier chance: on `1`, roll one missile talent (`1d12`):

| `1d12` | Missile Talent |
|---:|---|
| 1 | biting |
| 2 | burning |
| 3 | climbing |
| 4 | curing |
| 5 | disguising |
| 6 | flying |
| 7 | homing |
| 8 | lightning |
| 9 | reflecting |
| 10 | seeking |
| 11 | speaking |
| 12 | stunning |

Swords Microprocedure:
1. Roll sword type `1d6`: `1` normal, `2` short, `3` broad, `4` bastard, `5` two-handed, `6` referee choice.
2. Roll base bonus `1d6`:

| `1d6` | Base Bonus |
|---:|---|
| 1-3 | `+1` |
| 4 | `+2` |
| 5 | `+3` |
| 6 | `+4` |

3. Roll `1d6` intelligence chance: on `1` sword is intelligent; roll communication, powers, and motive.
4. Roll `1d6` additional-modifier chance: on `1-2`, add opponent bonus or talent rider.

Miscellaneous Weapons Microprocedure:
1. Roll weapon class `1d6`: `1` blunt, `2` edged, `3` polearm, `4` thrown, `5` flexible, `6` referee choice.
2. Roll specific weapon type by class (axe, mace, spear, hammer, dagger, sling variant, and similar).
3. Roll base bonus `1d6`:

| `1d6` | Base Bonus |
|---:|---|
| 1-3 | `+1` |
| 4 | `+2` |
| 5 | `+3` |
| 6 | `+4` |

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

### 7. Descriptive Extraction (RC Style Pass)

This pass uses direct-source extraction cadence and wording. Any legacy class/user references in the extracted text are nostalgia-only notes and are not mechanical gating in FTLS.

#### Potion Descriptions
Potions. Some guidelines regarding potions are given in the following text.

Appearance: Potions are usually found in small glass vials. Each potion has a different smell and color—even two potions with the same effect appear completely different until used. A character sipping the potion (taking just a taste) will realize what the potion's effect is; the character can then label the potion and keep it for later use. Sipping a potion does not decrease the potion's effect or duration, although sipping a poisoned potion will cause the character to suffer the poison's effects.

Level of Effect: If the range of the potion's effect is not stated, treat it as if it were a spell cast by a 6th level spellcaster.

Duration: Unless stated otherwise, the effect of a potion lasts 7-12 turns. Roll 1d6 + 6 to determine the potion's duration. Only the DM should know the exact duration; he or she will roll for duration and keep track of it when a character uses a potion.

Dosage: Usually the entire contents of a vial is a single dose. The entire potion must be drunk for the potion to have the listed effect. If a potion does not follow this guideline, the text will inform the DM.

In Combat: Drinking a potion takes one round.

Multiple Potions: If a character drinks a potion while another potion is still in effect, that character will become sick and will be unable to do anything (no saving throw allowed) for three

turns (half an hour). Neither potion will have any further effect. Certain potions whose effects are permanent (for example, healing or longevity) do not count toward this restriction.

Control Potions: When using these potions, the user must see the victims to direct their actions. The controlled creatures cannot be forced to kill themselves. The character cannot perform any other actions while controlling others, and he may move at up to half normal speed only. A victim may make a saving throw vs. spells to avoid the control, but the user may repeat the attempt once per round, on any victim seen, until the potion's duration ends.

The potions listed in Magical Item Subtable: 1. Potions, page 229, are described in the following text.

Agility: The user's Dexterity score becomes 18, and the user immediately gains all applicable bonuses.

Animal Control: The user may control up to 3d6 Hit Dice of animals (normal or giant, but not fantastic or magical). When the control ends, the animals will be afraid and will leave the area if they can.

Antidote: The user becomes completely immune to certain poisons and gains a + 2 bonus to all saving throws vs. poison. The weakest type of antidote protects against the poison of all creatures with 3 Hit Dice or less; stronger antidotes counteract the poison of larger creatures. Poisons avoided during the duration of the potion (by successful saving throws) have no effect after the duration ends. Roll 1d10 to determine what types of poisons the antidote protects against.

| `1d10` | Antidote Coverage |
|---:|---|
| 1-4 | Poisons from 3-HD (or lesser) creatures |
| 5-7 | Poisons from 7-HD (or lesser) creatures* |
| 8-9 | Poisons from 15-HD (or lesser) creatures |
| 10 | All poisons |

* A potion of poison is normally treated as poison from a 7-HD monster.

The DM can adjust this option as necessary.

Blending: The user may change color at will to any color, pattern, or combination of colors. Only color can be altered, but all items carried are affected. The user hidden by this chameleonlike camouflage can rarely be detected (10% chance) unless the observer can detect invisible things or possesses truesight (as the cleric spell) or a similar ability.

Bug Repellent: "Bug" includes any form of arachnid (spider, tick, scorpion, etc.), insect (ant, beetle, fly, etc.), or chilopod (centipede, millipede, etc.). After using this potion, the user cannot be touched by any normal bug, and a giant-sized bug will ignore the user unless the bug makes a saving throw vs. spells. If the saving throw is successful, the potion does not affect the giant bug. The potion adds a +4 bonus to any saving throws allowed against magically summoned or controlled bugs.

Clairaudience: The user may listen to noises (including speech) in an area up to 60' away through the ears of a creature in that area.

Clairvoyance: The user may see an area up to 60' away through the eyes of a creature in that area.

Climbing: The user may climb sheer surfaces as if a spider, with only a 5 % chance of falling (checked per 100' of climbing, at least once per climb).

Defense: The user gains a bonus to armor class, which lasts for 1 turn only. Roll 1d10 to find the power of the potion.

| `1d10` | AC Bonus |
|---:|---:|
| 1-3 | +1 |
| 4-5 | +2 |
| 6-7 | +3 |
| 8-9 | +4 |
| 10 | +5 |

Delusion: The user will believe this potion to have the effect of any one other potion (roll again for the fake potion).

However, it has no real effect.

Diminution: Anyone taking this potion will immediately shrink to 6" in height. He can only attack creatures smaller than 1' for normal damage. The user can slip through small cracks and has a 90% chance of not being seen when standing still. This potion will cancel a potion of growth without ill effects.

Dragon Control: There are several different types of this potion, one corresponding to each dragon type. The user may control up to three small dragons at once, but the dragons do get saving throws. Large and huge dragons are not affected by these potions. The controlled dragons will do whatever is commanded of them except cast spells. They will be hostile when the control ends. Roll 1d20 to find the type of dragons affected.

| `1d20` | Dragon Type |
|---:|---|
| 1-5 | White (or Crystal) |
| 6-10 | Black (or Onyx) |
| 11-14 | Green (or Jade) |
| 15-17 | Blue (or Sapphire) |
| 18-19 | Red (or Ruby) |
| 20 | Gold (or Amber) |

The DM can roll 1d100 and on 01-30 the potion actually affects the gemstone dragon equivalent (crystal instead of white, onyx instead of black, etc.).

Dreamspeech: If the user speaks to one sleeping or paralyzed creature within 30', the creature will hear and silently answer as if awake. The user will hear the responses by ESP and will be able to understand the language used. The creature is not compelled to be truthful. Dead and undead creatures cannot be affected, but cursed sleeping victims are within the power of the potion. The effect lasts for 1 turn only, and it applies to only one sleeping or paralyzed creature.

Elasticity: The user may stretch his or her body, plus all equipment carried, to nearly any form—flat, long, etc.—to a maximum of 30' long or a minimum of 1" thick. Items carried cannot be used or dropped unless they are first returned to normal form. While in "stretched" form, the user cannot attack or cast spells, but he takes half damage from blunt weapons (mace, hammer, giant-thrown boulder, etc.).

The effect lasts for 1 turn only.

Elemental Form: There are four types of this potion: Air, Earth, Fire, and Water (equal chances for each). The user may change into the form of an elemental (of the appropriate type) and back to normal form as often as desired while the potion lasts. Each change of form takes 1 round. While in elemental form, no special immunities are gained, but the special attacks of each elemental are usable (see Chapter 14). Note that a protection from evil effect will not block a character using this potion. The user's armor class and hit points do not change.

The duration is 1 turn only.

ESP: This potion will have the same effect as the magic-user spell ESP. The user can "hear" the thoughts (if any) of any one creature within 60' by concentrating for one full round in one direction. The user can "hear" through 2' of rock, but a thin coating of lead will block the ESP.

Ethereality: The user can become ethereal once, at any time during the potion's duration, and may thereafter remain ethereal for up to 24 hours, returning to the Prime Plane at will. Once he has returned to the Prime Plane, the potion will not enable him to become ethereal again.

Fire Resistance: The user cannot be harmed by normal fire, and he gains a +2 bonus to all saving throws against fire attacks.

In addition, the user takes less damage from magical and dragon fire: - 1 point per die of damage (minimum of 1 point per die).

Flying: The user may fly at up to 120' per round without tiring (as the effects of the magic-user spell).

Fortitude: The user's Constitution score becomes 18, and the user immediately gains corresponding hit points (if any). Points of damage to the user are taken from the magically gained hit points first. Damage applied to the user's original hit points will remain after the duration ends until cured by the usual means.

Freedom: The user cannot be affected by paralysis of any sort nor by hold person or hold monster spells.

Gaseous Form: Upon drinking this potion, the user's body will take the form of a cloud of gas. Anything the user is carrying or wearing will fall through the gaseous body to land on the floor. The user will keep control over his body, and he can move through small holes in walls, chests, and so forth. A creature or character in gaseous form cannot attack, but he has an AC of — 2 and cannot be harmed by nonmagical weapons.

Giant Control: There are several different types of this potion, one for each type of giant. The user may control up to four giants at once, but each giant gets a saving throw. They will be hostile once the control ends. Roll 1d20 to find the type of giant affected.

| `1d20` | Giant Type |
|---:|---|
| 1-5 | Hill |
| 6-10 | Stone |
| 11-14 | Frost |
| 15-16 | Fire |
| 17 | Mountain |
| 18 | Sea |
| 19 | Cloud |
| 20 | Storm |

Giant Strength: The user gains the strength of a frost giant. However, the potion has no effect if a strength-adjusting magical item (such as gauntlets of ogre power) is worn. Otherwise, the user inflicts double normal damage with any weapon, and he may throw small boulders (ranges 60/130/200) for 3d6 points of damage.

Growth: This potion causes the user to grow twice normal size, temporarily increasing effective Strength, giving the ability to inflict double damage (twice the amount rolled) on any successful hit. The user's hit points, however, will not increase. This potion will cancel a potion of diminution without ill effects.

Healing: Like the clerical cure light wounds spell, drinking this potion will restore 1d6 + 1 (2-7) lost hit points or will cure paralysis for one creature.

Heroism: This potion has no effect on an elf, a cleric, magic-user, mystic, or thief. However, a fighter, dwarf, halfling, or normal man (or monster!) who drinks this potion gains the Hit Dice, hit points, and all abilities of a higher level character (or monster) as follows.

| Current Level | Effect |
|---|---|
| Normal man | Becomes a 4th level fighter |
| 1-3 | Gains 3 levels or Hit Dice |
| 4-7 | Gains 2 levels or Hit Dice |
| 8-10 | Gains 1 level or Hit Die |
| 11+ | No effect |

All wounds taken during the duration of the potion—including energy drains—are subtracted from the magically gained hit points and levels first.

Human Control: The user may control up to 6 Hit Dice of humans at once (normal men counting as 1/2 Hit Die each), similar to the effects of a charm person spell. The effect has a 60' range, and the charm lasts only as long as the potion's duration.

Invisibility: This potion will have the same effects as the magic-user spell invisibility. The potion will make the user invisible. When a

character becomes invisible, all the items (but not other creatures) carried and worn by the user also become invisible. Any invisible item will become visible again when it leaves the character's possession (set down, dropped, and so forth). The DM may allow players to divide a single potion of invisibility into as many as six sips, each of which works normally but lasts only one turn.

Invulnerability: The user's armor class and saving throws gain a bonus of 2 for the duration of the potion. If used more than once per week, the only effect is sickness.

Levitation: Drinking this potion will have the same effects as the magic-user spell levitation. The user may move up or down in the air without any support. This potion does not enable the user to move side-to-side. The user could, however, levitate to a ceiling and move sideways by pushing or pulling.

Motion up or down is at a rate of 60' per round.

Longevity: The user immediately becomes 10 years younger. The effect is permanent, does not wear off, and cannot be dispelled. This potion will have no effect on any creature forced to drink it. In addition, age cannot be reduced below 15 (or below midadolescence for creatures other than humans), and the change cannot adversely affect any ability scores or other abilities.

Luck: This potion makes the user lucky. The player of the character using this potion may choose the result of any one roll of his rather than rolling a random result (an attack or damage roll, saving throw, etc.). Other players' rolls cannot be affected, nor can the Dungeon Master's rolls be affected.

The effect lasts for 1 hour or until the luck is used.

Merging: The effect of this potion is quite unusual. The user can permit others to actually merge their forms with the user's, including all equipment carried, as if all were gaseous. A maximum of seven other creatures can merge with the user of the potion. The merging cannot be forced; the user can, at will, prevent anyone from merging. A creature merged with the user can leave the merger by merely stepping out. No creature merged with another (including the user) can attack or cast a spell, but he may speak. Damage to the user of the potion does not affect those merged.

Plant Control: The user may control all plants and plantlike creatures (including monsters) in a 30' x 30' area up to 60' away. Normal plants controlled may entangle victims in their area, but they cannot cause damage.

Poison: Poisons look like normal magical potions. A character who swallows any amount of this potion, even a sip, must make a saving throw vs. poison or die! The DM can choose to have the poison do a specific amount of damage instead as another option.

Polymorph Self: The user may change shape (as the magic-user spell) up to once per round until the potion wears off.

Sight: The user can detect invisible things (as

the magic-user spell) for 1 turn.

This will negate blindness for that time.

Speech: The user can understand any and all languages heard within 60' and can respond in the same tongues. A language must be heard to be used unless already known.

Speed: The user moves twice as fast, can attack twice per round, and performs other actions except spellcasting at twice normal speed.

Strength: The user's Strength score becomes 18, and the user immediately gains all applicable bonuses.

Super-Healing: This potion acts just like an application of a cleric's cure critical wounds spell (see Chapter 3 for details of this spell).

Swimming: The user may swim in any liquid at the rate of 180' per turn, even if encumbered. The user cannot sink (or even be pushed below the surface) unless the encumbrance is over 3,000 en. The ability to breathe water is not granted by this potion.

The effects last for 8 hours.

Treasure Finding: By concentrating, the user can detect the direction and distance (but not the amount) of the largest treasure within 360'.

Undead Control: The user may control up to 18 Hit Dice of undead monsters. The undead will be hostile when the control ends.

Water Breathing: The user can freely breathe either water or air (as the magic-user spell) for 4 hours.

#### Scroll Descriptions
Scrolls. A scroll is a piece of old paper or parchment upon which a high-level magic-user, elf, or cleric has written a magical formula.

It is also possible to generate maps via scrolls as noted on the Magical Item Subtable: 2. Scrolls; these maps are cartographic diagrams of a particular area (often one where treasure is hidden or lost cities are to be found). Some guidelines regarding scrolls are given in the following text.

Determining Contents: To determine what's on a scroll, characters must have enough light to read by. Magic-users and elves must use a read magic spell to determine what's on a scroll; thieves, clerics, and druids simply read their scrolls. In any case, all characters must not read the scroll aloud unless they also wish to cast the spell at the same time as they figure out the kind of spell.

Casting the Scroll Spell: To cast the spell on a scroll, the character must be able to read the scroll and must read it aloud. A scroll may only be used once; the words disappear as they are read aloud.

Protection Spells: Anyone who can read—not just spellcasters—may use protection scrolls; the protection spell disappears as it is read aloud.

Treasure Maps: Anyone who can read—not just spellcasters—may understand treasure maps; a character who cannot read may make an Intelligence check to understand the map anyway. Such maps do not disappear when read.

The scrolls listed in Magical Item Subtable: 2. Scrolls, page 229, are described in the following text.

Communication: This is actually two scrolls, one stored inside the other. They are easily separated. If a message is written on one scroll, it immediately appears on the other. There is no limit to the range, as long as both scrolls are on the same plane of existence. The message may be up to 100 words in length. If one message is erased, the other disappears as well. Each message must be erased before another can be written, and there is a 5% chance (not cumulative) that any erasing will destroy the magic of both scrolls.

Creation: The user of this valuable scroll may draw a picture of any normal item up to 5' x 10' x 1' in size (though drawn much smaller) and up to 5,000 cn weight. The item may then be taken off the scroll and used! Magical items cannot be created nor can any living things, but all types of armor and weapons, for example, are quite easily created. The item will vanish either on command of the creator or after 24 hours.

The scroll can create one item per day only.

Cursed: Unfortunately, when any writing on a cursed scroll is even seen, the victim is immediately cursed. No reading is necessary! The DM must make up each scroll's curse.

Examples of a few common curses include the following: • The reader turns into a frog (or some other harmless animal). • A wandering monster of the same level as the reader appears and attacks the reader by surprise (a free attack with bonuses). • One magical item owned by the reader disappears (the item is chosen or randomly determined by the DM). • The reader loses one level of experience, as if struck by a wight. (The DM should roll again for a first-level character to avoid unfair "instant death.") • The reader's Prime Requisite must be rerolled. • Future wounds will take twice as long to heal, and healing spells will only restore half normal amounts until the curse is lifted. Only a remove curse spell (see Chapter 3) can remove a curse of this nature. However, the DM may allow the cursed character to be cured by a high-level NPC cleric or magic-user, who will demand that the character complete a special adventure or perform a worthy but difficult task.

Delay: This is a scroll of one spell. When casting the spell from the scroll, the user states an amount of delay from 0 to 12 rounds. Thereafter, if the user carries the scroll, the user has complete control of the spell when it occurs. If the scroll is not carried by the user, the spell effect appears around the scroll itself, affecting the nearest creature if a recipient is part of the spell process. The spell does not affect the scroll, even if it is a fire-type spell. For example, an elf reads a delay lightning bolt scroll, delaying it 8 rounds, and then puts the scroll away. Eight rounds later, when the lightning bolt actually appears, the elf may choose the range and direction by mere concentration, as if casting the spell at that time.

Equipment: This parchment is inscribed with the names of six normal items (which the DM selects or randomly determines, using the Adventuring Gear Table from Chapter 4). When any item's name is read aloud, the item appears within 10' of the scroll; the name disappears. The item will remain for 24 hours or until the user commands it to vanish. The name reappears on the scroll when the item vanishes. Any three of the six items listed on the scroll can be created

each day.

Illumination: This scroll bears the drawing of a flame. If the scroll is set afire, it will burn with a clear light in a 60' radius, lasting for up to 6 hours per day. The burning does not harm the scroll, but it is nevertheless "normal" fire (and can be used to light torches, for example). The flame cannot be extinguished except by water or on command of the user; no wind, normal or magical, can cause it to even flicker. This item may already be lit when found.

Mages (spellcasters only): This scroll is blank; it is used to identify magical effects. The user may hold the scroll and command it to identify any one chosen magical effect within 30'. The name of the magical spell or effect then appears on the scroll, along with the level of the caster of the spell effect. The scroll will identify one magical effect per day.

Maps to Treasures (Normal, Magical, Combined, or Special): Each map should be made in advance by the DM. Such maps show a route to the location of a treasure in a dungeon or a wilderness area. The treasure is usually hidden or protected by monsters, traps, and/or magic. Based on the type of treasure given, the DM should select a challenging monster (who has a similar treasure type) and design the map and monster lair accordingly. Note that the map may be partially incorrect, omitting an important detail (such as the type of monsters, dangerous traps, etc.) or giving some false information; however, the treasure mentioned should actually be there. Sometimes maps are only partially complete or are written in the form of a riddle. And some can only be read

by a read languages spell. Normal treasure contains coins and gems but no magical items, while a magical treasure may

include some coins and a few gems of low value in addition to magical items. A combined treasure has coins, magical items, and valuable gems or jewelry in roughly equal proportions. Special treasure should contain at least one permanent magical item, such as a staff or sword; these items should be mentioned on the map.

Mapping: This scroll is blank. When held and commanded to write, this scroll will draw a map of an area chosen (that is, the DM accurately draws the map for the players). The area must be completely within 100' of the scroll, and it may be up to 10,000 square feet in size. The scroll has 1 chance in 6 to detect secret doors, but it will not draw what lies beyond them.

The scroll functions once per day.

Portals: This scroll creates a pass-wall effect, identical to the magic-user spell. When placed on a surface and commanded to function, the scroll disappears and a 5'-diameter hole appears that is up to 10' deep. The scroll does not affect living or magical things. The hole will disappear after 3 turns or when commanded by the reader of the scroll. When the hole disappears, the scroll reappears.

The scroll may be used twice each day.

Protection: A protection scroll may be read and used by any character who can read the Common language. When read, it creates a circle of protection 10' across that will move with the reader at its center. It will prevent any of the given creatures from entering this circle, but it does not prevent spell or missile attacks from those creatures. The circle will be broken if anyone protected attacks one of the given creatures in hand-to-hand combat. Four types of protection scrolls are described in the following text.

Protection from Elementals: This scroll creates a circle of protection (10' radius) around the reader. No elemental can attack those within the circle unless attacked first in hand-to-hand combat. Once attacked, an elemental may attack in return. The effect lasts for 2 turns and moves with the reader.

Protection from Lycanthropes: When read, this scroll will protect all those within the circle for 6 turns against a variable number of lycanthropes. The number of lycanthropes affected varies according to their type, as follows. Werebats, wererats, werefoxes Wereboars, werewolves Wereseals, weresharks Werebears, weretigers Devil swine

| Lycanthrope Type | Number Affected |
|---|---|
| Werebats, wererats, werefoxes | `1d10` affected |
| Wereboars, werewolves | `1d8` affected |
| Wereseals, weresharks | `1d6` affected |
| Werebears, weretigers | `1d4` affected |
| Devil swine | `1d2` affected |

Protection from Magic: This scroll creates a circle of protection (10' radius) around the reader. No spells or spell effects (including those from items) may enter or leave the circle. The effect lasts for 1d4 turns, moves with the reader, and may not be broken except by a wish.

Protection from Undead: When read, this scroll will protect all those within the circle from a variable number of undead for 6 turns. The number of undead affected varies according to their type, as follows. Skeletons, zombies, ghouls Wights, wraiths, mummies Specters (or larger monsters)

| Undead Type | Number Affected |
|---|---|
| Skeletons, zombies, ghouls | `2d12` affected |
| Wights, wraiths, mummies | `2d6` affected |
| Specters (or larger monsters) | `1d6` affected |

Questioning: The user of this scroll may ask questions of any nonliving nonmagical objects; their answers will appear on the scroll. The scroll will display up to three answers per day. The answers will be given as if the objects were living beings, but they will be limited to simple observations as if the objects could see, hear, and smell. The scroll cannot be used to question living or magical things.

Repetition: This scroll appears to be a normal scroll of one spell, and the standard restrictions apply to its use. However, 1 turn after the spell is cast, the scroll creates the same spell effect a second time, centered on the scroll or affecting the nearest creature if a recipient is part of the spell process. As with a normal spell scroll, any spell cast from it is then gone; however, another spell may be written on the scroll if it is of the same

level, and the repetition effect will again apply.

Seeing: This scroll is blank. When held and commanded to write, it will draw pictures of creatures within 100' in any area chosen by the user. Up to four different types of creatures can be pictured. The scroll will function once per day, regardless of the number of creatures pictured.

Shelter: This scroll is inscribed with an elaborate drawing of a 10'-square room, lit, with two beds, a table and two chairs, food and drink for two on the table, and a pair of normal swords on the far wall, each hung over a shield. If the scroll is hung on any vertical surface, the room pictured may be entered and the items used. The food and drink are pure and will nourish any living thing. The swords and shields may be taken

down and used. However, none of the items can be removed from the room. If the scroll is taken down, the room cannot be entered or left, but remains in existence on another dimension. If any creatures are in the room when the scroll is taken down, the air inside permits survival for up to 24 hours. No creatures so caught can escape by any means other than a wish. The food and drink are replenished each time the scroll is taken down. The room can be created once per day and will remain for up to 12 hours per use; if not removed in that time, the scroll will fall down by itself.

Spell Catching: This scroll is blank when found. It may be used to "catch" a spell cast at the user. It cannot catch spell-like effects, nor can it catch device-produced effects (such as from a wand), but a spell cast from a scroll can be caught. There are four types of this scroll; roll 1d10 to determine the capacity.

| `1d10` | Spell Capacity |
|---:|---|
| 1-4 | 1st or 2nd level spells |
| 5-7 | 1st to 4th level spells |
| 8-9 | 1st to 6th level spells |
| 10 | 1st to 8th level spells |

The user of the scroll must hold it up, like a shield; no other action is possible while using the scroll. The user must then make a saving throw vs. spells, with a +4 bonus to the roll; if successful, the incoming spell has no effect and is instead transferred to the scroll, appearing as a normal scroll spell. The exact spell caught will not be known until a read magic spell is used to identify it. The scroll can only hold one spell at a time; the spell caught must either be used or copied into a spell book (magic-user spells only) before the scroll can catch another spell. Any type of spell (magical, clerical, or druidic) can be caught as long as the level does not exceed the scroll's capacity. The scroll of spell catching cannot affect spells of levels greater than the given capacity, and it can catch a maximum of one spell per day.

Spells: Use Spell Scrolls in the magical item subtable for scrolls to find the exact spell levels or choose spells as appropriate. Spell scrolls are good ways to introduce new spells in a campaign, and they may thus be designed with the characters' current spell books in mind. Note that only druids can cast spells on druid scrolls, though the spell name can be revealed by a read magic spell.

Trapping: This scroll can create one trap. The type of trap differs by the placement of the scroll. The scroll is destroyed when the trap is created. If placed on a floor, a hidden pit trap is created; if on a ceiling, a falling block trap appears. On walls, a poison dart or gas trap will be created. The exact trap is left for the DM's design. The trap created is quite real and is not illusory or magical.

Truth: This scroll is blank when found. The user may ask a question of any living being within 30'; the complete and true answer appears on the scroll, read from the victim's mind by a powerful version of ESP. Note that the answer is true only within the limits of the victim's knowledge. The scroll will display one answer per day.

#### Wand Descriptions
A wand normally has 2d10 charges when found, and a staff 3d10; the DM rolls the number, keeps the result to themselves, and tracks the character's use of the wand or staff.

If desired, the DM may use a larger number of charges: 3d10 for a wand, 2d20 for a staff. Rods are permanent items that do not require charges. Each use of a power costs one charge unless noted otherwise. Each item may be used once per round at most.

The wands listed in Magical Item Subtable: 3. Wands, Staves, and Rods, page 229, are described in the following text.

Wand of Cold: This wand creates a cone of

cold, 60' long and 30' wide at the far end. All

within the cone take 6d6 points of cold damage, but they may make a saving throw vs. wands for half damage.

Wand of Enemy Detection: When a charge is used, this item will cause all enemies within 60' (even those hidden or invisible) to glow, as if on fire.

Wand of Fear: This wand creates a cone of fear, 60' long and 30' wide at the far end. All within the cone must make a saving throw vs. wands or run away from the user at three times their normal rate for 30 rounds.

Wand of Fireballs: This creates a fireball effect (as if using the magic-user spell) up to 240' away. All victims take 6d6 points of fire damage, but they may make a saving throw vs. wands for half damage.

Wand of Illusion: This creates a phantasmal force effect (as if using the magic-user spell). The user must concentrate on the illusion to maintain it, but he may walk at half normal movement rate while doing so.

Wand of Lightning Bolts: This creates a lightning bolt (as if using the magic-user spell), starting up to 240' away and 60' long from that point. The victims take 6d6 points of electrical damage, but they may make a saving throw vs.

wands for half damage.

Wand of Magic Detection: When a charge is used, this item will cause any magical item within 20' to glow. If the item cannot normally be seen (within a closed chest, for example), the glow will not be seen.

Wand of Metal Detection: This wand will

point toward any type of metal named if within

20' and if 1,000 cn or more in weight.

The user cannot detect the amount of metal.

Wand of Negation: This wand can be used to cancel the effects of one other wand or staff. If the other effect has a duration, the negation lasts for one round.

Wand of Paralyzation: This wand projects a

cone-shaped ray when a charge is used. The ray is 60' long and 30' wide at its end. Any creature

(as if using the magic-user spells). The user must state which effect is desired. An unwilling victim may make a saving throw vs. wands to avoid the effect.

Wand of Secret Door Detection: The user may

find any secret door within 20', using one charge

per secret door found.

Wand of Trap Detection: This wand will point at all traps within 20', one at a time, at a cost of one charge per trap found.

#### Staff Descriptions
The staves listed in Magical Item Subtable: 3. Wands, Staves, and Rods, page 229, are described in the following text.

Staff of Commanding: Traditionally associated with all spellcasters, this magical item has all the powers of the rings of animal, human, and plant control (see the individual descriptions under "Rings," below).

Staff of Dispelling: The touch of this item has the same effect as a dispel magic spell from a 15th level caster, but it will affect only the item

or magical effect touched. Any potion or scroll touched is completely destroyed, and any permanent magical item touched becomes nonmagical for 1d4 rounds (including armor and weapons). This effect may be permanently harmful to intelligent swords (DM's choice). Each use of the staff costs one charge.

This staff is usable by any character.

Staff of the Druids: A druid carrying this staff gains one extra spell of each spell level. The extra spells must be selected when the usual spells are acquired (usually during morning meditation). Each day's use of the staff uses one charge. The staff is a + 3 weapon as well, and it may be used as such (inflicting 1d6 + 3 points of damage per hit) without using any charges.

Staff of an Element:

| `1d100` | Staff Type |
|---:|---|
| 01-21 | Staff of Air |
| 22-42 | Staff of Earth |
| 43-63 | Staff of Fire |
| 64-84 | Staff of Water |
| 85-91 | Staff of Air and Water |
| 92-98 | Staff of Earth and Fire |
| 99-00 | Staff of Elemental Power |

Each staff is a staff +2 and may be used as one

without using any charges, striking for 1d6 + 2

points of damage. Staves of two elements gain all the powers of both staves, and the staff of elemental power has the powers of all four.

Each staff contains the following powers when used on the Prime Plane: • A +4 bonus to saving throws vs. attack forms based on that element. • Complete immunity to attacks by any elemental of that type. • The ability to summon one 8-Hit Dice elemental of that type per day (as the magic-user spell), each summoning costing one charge. • Certain spell-like effects, each costing one

charge per use. These created spell effects are treated as if cast by a 10th level spellcaster.

The effects are dependent on type of element as follows:

| Element | Spell-Like Effects |
|---|---|
| Air | `lightning bolt`, `cloudkill` |
| Earth | `web`, `wall of stone` |
| Fire | `fireball`, `wall of fire` |
| Water | `ice` (storm or wall) |

When used on the elemental plane of the corresponding type, the powers are quite different. As long as one or more charges remain in the staff, the powers granted to the holder are not the powers given above, but are rather the following powers:

• Immunity to damage from the plane itself,

with vision to 60' range. • Movement within the plane at the rate of 120 feet per turn (40'/round). • Communication ability with any resident of that plane. • A — 4 bonus to armor class if attacked by a resident of that plane. Note that these staves do not provide the ability to breathe on the plane; some other device or spell must also be used. However, when a staff is used along with a matching ring of elemental adaptation or talisman of elemental travel, all effects given above are extended to a 10' radius

around the user. Except for the staff of elemental power, each staff can be used to negate effects relating to

the element to which it is opposed (see the

Dominance-Opposition Table on page 264), at the cost of one charge if the effect was produced by the opposite staff or two charges if a normal spell was used. For example, a staff of air could be used to negate a wall of fire spell cast by any magic-user, at the cost of two charges. A summoned elemental may be sent back to its home plane with the same cost of charges (one if produced by the opposite staff, two if conjured by spell), but the elemental must be

touched by the staff (possibly requiring a normal attack roll). If a staff is ever taken to the plane it is opposed to, it immediately explodes, inflicting 20 points of electrical damage plus 1d8 points of damage per charge remaining in the staff. The explosion fills a sphere of 60' radius; all creatures within the effect may make a saving throw vs. spells with a - 4 penalty to the roll to take half damage. The wielder of the staff, however, gets no saving throw.

Staff of Harming: It inflicts 1d6 + 1 (2-7) points of damage to any creature touched by the staff (no saving throw); a normal attack roll may be required. This is in addition to normal weapon damage (1d6 points), if applicable. The staff of harming can also create the following effects, with the costs noted. Each effect is identical to the reversed form of a clerical spell. Note that the use of this staff is a Chaotic act. Cause blindness

| Effect | Charge Cost |
|---|---:|
| Cause blindness | 2 charges |
| Cause disease | 2 charges |
| Cause serious wounds | 3 charges |
| Create poison | 4 charges |

Staff of Healing: It may only be used once per day per person, but it will heal any number of persons once a day. It does not have or use charges for healing. As an option, the DM may add charges to the staff (in addition to its curing abilities) to create the following effects, at the cost of the charges indicated.

| Effect | Charge Cost |
|---|---:|
| Cure blindness | 1 charge |
| Cure disease | 1 charge |
| Cure serious wounds | 2 charges |
| Neutralize poison | 2 charges |

Staff of Power: This item can be used as a staff of striking and can also be used to create any of the following magic-user spell effects (each doing 8d6 points of damage): fireball, lightning bolt, and ice storm. It can also create a continual light effect or move 2,400 cn of weight by telekinesis, as the ring.

Snake Staff: Upon command, the staff turns into a snake and coils around the creature struck. The command may be spoken when the victim is hit. The victim is allowed to make a saving throw vs. spells to avoid the serpent's coil. Any man-sized or smaller victim will be held helpless for 1d4 turns (unless the snake is ordered by the owner to release the victim before that time). Larger creatures cannot be ensnared in the snake's coils. The snake's characteristics are as follows.

Snake: AC 5; HD 3; hp 20; MV 60' (20'); #AT 1 (special); Dmg Nil (special); Save C3; ML 12; XP6 When freed, the snake crawls back to its owner and becomes a staff once again. The snake is completely healed when it returns to staff form. If killed in snake form, it cannot return to staff form and it loses all magical properties. This item does not have or use charges. At the DM's option, the staff can be given charges. The user can spend charges to add bonuses to the snake's attack roll ( + 1 bonus per charge spent); up to five charges can be used in a single attack (for a + 5 bonus). A charge can also be used to cure the snake while it is in combat. The user casts a curing spell of any type and expends one charge to transfer the cure to the snake. The amount of curing is determined normally; no range limit applies.

Staff of Striking: Traditionally associated with all spellcasters, this weapon inflicts 2d6 (2-12) points of damage per charge if the hit is successful.

Only one charge may be used per strike.

Staff of Withering: One hit from this staff ages the victim 10 years. One or two hits will be fatal to most animals and harmful to many humans. Elves may ignore the first 200 years of aging, dwarves may ignore the first 50 years, and halflings may ignore the first 20 years.

Undead are not affected by this item.

Staff of Wizardry: staff of power, plus the magic-user spell effects of invisibility, passwall, web, and conjure elemental. It may also be used to create a whirlwind (as if from a djinni) or shoot a cone of paralyzation (as the

wand). In addition, the user may break the staff, which releases all of its power at once. This final strike is an explosion that inflicts 8 points of damage per charge remaining in the staff. All creatures within 30' (including the user!) take damage (but all may make a saving throw vs. staff for half damage).

#### Rod Descriptions
The rods listed in Magical Item Subtable: 3. Wands, Staves, and Rods, page 229, are described in the following text.

Rod of Cancellation: This rod is usable by any character. It will work only once, but it will drain any magical item it hits, making that item forever nonmagical. The target is treated as having an armor class of 9. The DM may adjust the armor class of an item if it is being used in combat (such as when trying to hit a sword). Intelligent magical swords and + 5 magical items may resist the effect of the rod if the user makes a saving throw vs. wands. This merely indicates successful resistance, and the rod still retains its power. A sword +5 with intelligence, for example, gains a +2 bonus to the saving throw.

Rod of Dominion: Traditionally associated with any character, this rod aids in ruling. If a ruler carries it on a tour throughout his or her dominion, the rod adds a bonus to all Confidence Level rolls, based on the percentage of residents viewing it (roll 1d100 for the result).

| `1d100` | Confidence Level Bonus |
|---:|---:|
| 01-50 | +10 |
| 51-75 | +20 |
| 76-90 | +30 |
| 91-99 | +40 |
| 00 | +50 |

When not on display, the rod must be kept in the ruler's stronghold. The effects last for three months, but the rod may be shown again to the populace as desired.

Rod of Health: Traditionally associated with clerics only, this rod has all the powers of a staff of healing, but without expending any charges. It can affect any one creature only once per day, regardless of the effect chosen.

Rod of Inertia: Only a dwarf, halfling, fighter, thief, or mystic may use this unusual item. It may be used as a spear +3 in all respects. On command of the user, it will stop wherever it is, and it cannot be moved by any means except a wish. A second command releases it. If the rod is in motion when stopped, it will continue its direction when released. For example, it may be thrown toward a door and commanded to stop, later released if an enemy enters so that the rod will continue toward the enemy (a normal attack roll is made). If the user falls, a command will stop the rod suddenly, and the user may hold onto the rod.

Rod of Parrying: This rod +5 can be used as a melee weapon, inflicting 1d8 + 5 (6-13) points of damage per hit (but no Strength bonus applies). It may also be used to parry attacks, if the user chooses this ability at the beginning of a round. When attacked in melee, the user's armor class gains a + 5 bonus while parrying; however, this does not apply to avoiding missile fire. While using the rod of parrying, no other action is possible except a Fighting Withdrawal maneuver (see Chapter 8). This rod is usable by any character.

Rod of Victory: Traditionally associated with any character, this rod makes the user lucky in war (when the War Machine mass combat system is used).

The following bonuses apply to that system:

| Context | Rod of Victory Bonus |
|---|---|
| Combat Results roll | `+25` (maximum total `100`) |
| Combat Results Table difference `101+` | Use result band `91-100` |

Rod of Weaponry: This rod + 5 is only usable by a dwarf, halfling, fighter, thief, or mystic. On command of the user, it will elongate and may be divided into two weapons of the same size, each + 2. Each of those may be similarly divided into two + 1 weapons. The rod cannot be divided accidentally, and it can be reassembled simply by placing the parts together. Each weapon, regardless of size, inflicts 1d6 points of damage per hit, plus magic bonuses (but not Strength bonuses).

Rod of the Wyrm: Traditionally associated with any character, there are three types of this rod; determine the type randomly or select one.

| `1d10` | Alignment | Dragon | AC | Breath(s) |
|---:|---|---|---:|---|
| 1-5 | Lawful | Gold | -2 | Fire/Gas |
| 6-8 | Neutral | Blue | 0 | Lightning |
| 9-10 | Chaotic | Black | 2 | Acid |

Each is a rod + 5 and each inflicts 1d8 + 5 (6-13) points of damage per hit (but without Strength bonuses). Once per day, the rod may be turned into a small dragon of the appropriate type. The created dragon has 30 hit points and can only be affected by magic (weapons, spells, etc.). It will understand and faithfully serve the user of the rod to the best of its ability; for example, it can act as messenger, steed, or guard. It will fight to the death unless commanded otherwise. The dragon knows no spells. It will return to rod form on command; if slain in dragon form, however, it cannot return to rod form and is forever destroyed. Spells and other magical forms of healing can be used to heal the creature, if desired, but not after it is killed. If a dragon is created by a user of a different alignment, the dragon will attack the user immediately, fighting to the death. When this occurs, it cannot be commanded to return to rod form.

#### Ring Descriptions
Rings. A magical ring must be worn on a finger or thumb to function. However, a ring may also be carried and then put on when needed. Only one magical ring can be worn per hand. If more than that are worn, the rings negate each other and none will function, with the exception of a ring of weakness. Any ring may be used by any character class.

The rings listed in Magical Item Subtable: 4. Rings, page 229, are described in the following text.

Animal Control: The wearer of this ring may command 1d6 normal animals (or one giant-sized). The animals are not allowed a saving throw to resist control. The ring will not control intelligent animal species or fantastic or magical

monsters. The wearer must be able to see the animals to control them. The control will last as long as the wearer concentrates on the animals and does not move or fight. When the wearer stops concentrating, the animals will be free to attack their controller or run away (roll reactions with a penalty of — 1 to the roll).

This ring can only be used once per turn.

Delusion: The wearer will believe this to be any one other ring (roll again for the imaginary type). However, it has no real effect. The wearer will not be convinced otherwise until a remove curse is used to dispel the enchantment.

Djinni Summoning: The wearer may summon one djinni to serve for up to one day. The djinni will only serve and obey the person wearing the ring at the time of its summoning.

The ring may be used only once per week.

Ear: This ring, worn on the ear as an earring, has no effect when worn. However, when removed and placed against any surface (a door, chest, etc.), the user may hear all noises occurring within 60' of the surface. Light breathing, heartbeats, and even faint breezes can be heard. The ring will function three times per day.

Elemental Adaptation: There are seven different types of this ring; roll 1d100 to determine the exact type or select one as appropriate.

| `1d100` | Type |
|---:|---|
| 01-21 | Air |
| 22-42 | Earth |
| 43-63 | Fire |
| 64-84 | Water |
| 85-91 | Air and Water |
| 92-98 | Earth and Fire |
| 99-00 | All elements |

The wearer of this ring can, when in the appropriate elemental plane, freely breathe and see through the gaseous element (the equivalent of air on the Prime Plane).

Fire Resistance: The wearer of this ring will not be harmed by normal fires, and he gains a bonus of + 2 on all saving throws vs. fire spells and vs. red dragon breath. In addition, the DM subtracts 1 point from each die of fire damage to the wearer (with a minimum damage of 1 point per die rolled to determine the damage).

Holiness: If the ring is worn while spells are gained (usually during morning meditation), the cleric gains one extra spell each of levels 1,2, and 3 as appropriate. (Extra spells apply only to spell levels obtainable. For example, a 5th level cleric would not gain any 3rd level spells.) If the ring is removed, the spells are forgotten (though this has no effect if the spells are already cast). In addition, a cleric (but not a druid) gains a +1 bonus to any rolls to turn undead, including the roll determining the Hit Dice of undead turned. The ring does not affect turn attempts not requiring a roll.

Human Control: This is the same effect as the potion of the same name. The effect lasts until canceled by the wearer of the ring, the ring is removed, or until a dispel magic spell removes the charm.

Invisibility: The wearer is invisible as long as the ring is worn. If the wearer attacks or casts spells, he or she will become visible. The wearer can only become invisible once per turn, but there is no duration to the invisibility; the wearer will stay invisible as long as he does not take off

the ring, attack someone, or cast spells.

Life Protection: This valuable ring will negate the effects of 1d6 energy drain attacks. If the wearer is struck by an energy-draining undead (or effect), charges are drained from the ring and no levels are lost. If a single blow drains more experience levels than there are charges remaining in the ring, the ring disintegrates; otherwise, it becomes a ring of protection +1 when all the charges are used.

Memory: It allows the wearer to recall any one spell cast. The wearer must decide, within 1 turn of casting a spell, to recall it; the memory then reappears and the spell is instantly "relearned." The ring can restore the memory of one spell per day.

Plant Control: This ring has the same effect as the potion of the same name, but only lasts as long as the wearer concentrates.

Protection +1, + 2, +3, or +4: This ring improves the wearer's armor class by 1, 2, 3, or 4, as listed. For example, a ring of protection +3 worn by a magic-user with no armor (AC 9) would give the magic-user an AC of 6 while he wears the ring. This item also adds its bonus to all of the wearer's saving throws; in the example here, the magic-user would get a +3 bonus to saving throws. A variation of this ring is the ring of protection + 1, 5' radius. This ring improves the wearer's armor class and saving throws by 1 (as a normal ring of protection +1), but the ring also gives the same bonus to all creatures within 5'— both friend and foe! No rings affecting an area are more powerful than + 1.

Quickness: Once each day, the wearer of this ring can move and attack at double normal rates for 1 turn. The effect is identical to the magic-user spell haste, but this effect can be produced by command, not by spellcasting.

Regeneration: The wearer regenerates lost hit points at the slow rate of 1 per turn. The ring also replaces lost limbs; a finger will regrow in 24 hours, and a whole limb can be replaced in one week. The ring will not function if the wearer's hit points drop to 0 or less.

Fire and acid damage cannot be regenerated.

Remedies: Once each day, this ring will produce one remedy—a cure blindness, cure disease, remove curse, or neutralize poison spell effect. Each effect is identical to the cleric spell of the same name and is treated as if cast by a 25th level cleric. The ring produces the effect desired when the wearer concentrates and touches the recipient.

Safety: The effect of this ring is similar to that of a potion of luck. If the ring's wearer fails a saving throw, his player may "change fate" by announcing that his saving throw was, in fact, successful. The ring will negate 1d4 failed saving throws and then disintegrate.

Seeing: Once each day, the wearer of this ring can see all things plainly, as if the cleric spell truesight were cast. The wearer need not be a spellcaster.

The effect lasts for 3 turns.

Spell Eating: Although this ring appears and functions as a ring of spell turning, it has an extra, detrimental effect if the user is a spellcaster. After the spellcaster has cast a spell while the ring is worn, the ring "eats" all the remaining spells memorized by the spellcaster. The ring cannot be removed after it has eaten the wearer's spells

(though spells can be restudied and safely cast) until a remove curse is applied by a 25th or higher level spellcaster. This remedy only permits the removal of the ring and does not affect its powers. A dispel evil cast by a 36th level caster will turn the ring into a normal ring of spell turning.

Spell Storing: When found, this ring has 1d6 spells stored within it. Those exact spells are the limit of the ring's powers and they cannot be changed. When the ring is put on, the wearer magically knows what spells are stored and how to use them. After a spell is used, it may be replaced by a spellcaster who must cast the replacement spell directly at the ring. The ring will not absorb spells thrown at the wearer. The spells in the ring have the duration, range, and effect equal to the lowest level needed to cast them. The DM should select the type of spells in the ring; about 20% of these rings typically contain clerical spells.

Spell Turning: This ring reflects 2d6 spells back to their casters (per day) so that the wearer is not affected by spell attacks. Only spells are reflected, not spell-like powers of monsters or spell-like effects from items. Once the ring's number of spells is reached, it becomes useless for the rest of the day.

Survival: The wearer can survive without air, food, or drink while the ring is worn by using the charges contained within it. The ring contains 1d100 + 100 (101-200) charges when found. By spending one charge, the user needs no food or drink for 24 hours. Survival without air requires one charge per hour. The ring turns black when five or fewer charges remain.

Telekinesis: The wearer may slowly move inanimate objects weighing up to 2,000 cn by concentration alone, up to a distance of 50'.

Truth: Three times per day, this ring allows the wearer to know whether a spoken statement is true or false. Note that if the person or creature uttering the statement believes it to be true, a "true" result will be obtained. By telepathy, the ring tells the wearer of its powers as soon as it is worn.

Truthfulness: This item claims to be a ring of truth when worn (as above), but actually it functions differently. When the wearer first tries to determine the truth of a statement, the statement will appear to be true—but thereafter, the wearer will be unable to lie. The wearer must provide full and completely true answers to any question asked of him so long as he wears the ring. He cannot remove the ring until a remove curse is applied by a 26th or higher level caster.

Truthlessness: This item also claims to be a ring of truth when worn, but it functions in a manner opposite that of a ring of truthfulness— that is, the wearer is unable to tell the truth and must lie at all times. The ring cannot be removed until a remove curse spell, cast by a 26th or higher level caster, is applied.

Water Walking: The wearer of this ring may walk on the surface of any body of water and will not sink.

Weakness: When this ring is put on, the wearer becomes weaker and his Strength score becomes 3 within 1d6 rounds. The wearer cannot take off this ring unless a remove curse spell is used. If more than one ring is worn per hand, this ring will still function despite the other rings' effects being canceled.

Wishes: A ring of wishes is an extremely powerful item. Wishes must be handled very carefully by the DM and the players alike. To find the number of wishes contained, roll 1d10.

| `1d10` | Wishes |
|---:|---:|
| 1-4 | 1 |
| 5-7 | 2 |
| 8-9 | 3 |
| 10 | 4 |

X-ray Vision: The wearer may see a distance of up to 30', even through a wall and into the space beyond, by standing still and concentrating. The effect may be blocked by gold or lead. The wearer can inspect one 10' x 10' area per use (which requires a full turn), and he will be able to see any traps or secret doors in the area examined. The ring allows the wearer to see through items less dense than stone (such as cloth, wood, or water) more easily, to a range of 60'. The ring may be used up to 1 turn per hour.

#### Miscellaneous Item Descriptions
Miscellaneous Magical Items. Each of the items listed in this section may be used by any character class and up to once per round, unless noted otherwise. Most of the given effects either work automatically or are activated by concentration alone. There is no limit to the many types of magical items possible; the devices and effects given here are a mere sampling. The DM may create others as desired, with nearly any powers as appropriate. However, when designing such items, keep the balance of the game in mind. If an item duplicates clerical powers, for example, it may cause clerics themselves to become less useful in the game. Keep such items rare and limit them by giving them expendable charges, lest they adversely affect the game.

The magical items listed in Magical Item Subtable: 5. Miscellaneous Items, page 229, are described in the following text.

Amulet of Protection from Crystal Balls and ESP: The wearer of this item is automatically protected from being spied on by anyone using a crystal ball or any type of ESP.

Bag of Devouring: This item looks like a normal small sack, but anything placed within it disappears. Anyone may reach in and find the contents by touch—if the contents are still there! If the contents are not removed within 1d6 + 1 (7-12) turns, they will be forever lost. The bag will not affect living creatures unless the entire creature is stuffed inside the bag. This is impossible to do except with very small creatures.

Bag of Holding: This bag looks like a normal small sack, but any items placed within it disappear. Anyone may reach in and find the contents by touch. The bag will actually hold treasures up to 10,000 cn in weight, but will only weigh 600 cn when full. An item to be placed inside the bag may be no larger than 10' x 5' x 3'. A larger item will not fit inside.

Boat, Undersea: This item appears identical to a standard riverboat (see Chapter 4) and can be used as one. As it is magical, however, its armor

class is 4 and it has 40 hull points. It is operated by a magical command word that its maker

knows; characters who find an undersea boat

may have to go on an adventure to discover the boat's command word. If the command word is known, no rowers or sailors are required. The boat will obey commands to start, stop, turn to port (left), turn to starboard (right), stop turning (while keeping the same speed), submerge, level off, and surface. When underwater, the

boat radiates a water breathing effect, protecting

all passengers and crew as long as they touch it.

The undersea boat can be fitted with grips so

that the passengers can avoid drifting away.

Note: The DM may wish to create similar magical boats that travel only on ice, sand, in the air, and so forth.

Boots of Levitation: The wearer may levitate (as if using the magic-user spell).

There is no limit to the duration.

Boots of Speed: The wearer may move as fast as a riding horse (240' [80']) for 12 hours, after which the wearer must rest for one full day.

Boots of Traveling and Leaping: The wearer needs no rest during normal movement. The wearer may also make mighty jumps, to a maximum height of 10' and a maximum length of 30'.

Bowl of Commanding Water Elementals: This item may be used only once per day. The bowl is 3' in diameter; it requires 1 turn to use. The bowl will summon a water elemental and will allow the user to control it, subject to normal rules for elemental control.

Brazier of Commanding Fire Elementals: This item may be used only once per day. It requires 1 turn to use and will summon a fire elemental that will allow the user to control it, subject to normal rules for elemental control.

Broom of Flying: When verbally commanded, the broom will carry its owner through the air at 240' per turn. One other person (or up to 2,000 cn of baggage) may also be carried, but the broom slows to 180' per turn.

Censer of Controlling Air Elementals: This item may be used only once per day and requires 1 turn to use. The censer will summon an air elemental and will allow the user to control it, subject to normal rules for elemental control.

Chime of Time: This simple metal stick is 3" long and made of a silvery metal. On command, it will keep track of time, chiming every hour on the hour—the chime can be heard by all within 60' (regardless of intervening walls, rock, etc.). If dampened by a silence, 15' radius spell, the chime will dispel the silence but be dampened to a 30-foot range for that turn. A second command will cause the chime to turn color. It will turn gold at one end, the color slowly spreading to the other end in an hour's time. A third command word causes the chime to stop ringing or to stop changing color—but not until 1 turn elapses after the command.

Crystal Ball: Its owner may look into it and see any place or object thought about as it exists at that time. It will work three times per day, and the image will last for 1 turn. Spells cannot be cast "through" the crystal ball. The more familiar the object or area to be seen, the clearer the picture will be.

Crystal Ball with Clairaudience: This works like a standard crystal ball, but with the added

power to listen to noises through the ears of a creature in the area viewed.

It is only usable by a magic-user.

Crystal Ball with ESP: This also works like a standard crystal ball, but with the added power to listen to the thoughts of a creature viewed.

It is only usable by a magic-user.

Displacer Cloak: This item warps light rays; the wearer is actually 5' away from the perceived location. The cloak gives a bonus of +2 to the wearer's saving throws vs. spell, wand/staff/rod, and turn to stone attacks. Hand-to-hand attacks on the wearer are penalized by — 2 on the attack rolls, and most missile fire will automatically miss.

Drums of Panic: These large kettle drums have no effect on any creatures within 10' of them. When used, however, all creatures 10'-240' away must make a saving throw vs. spell or run away from the user for 3 full turns. If the morale system is used, no saving throw is needed, but each creature must make a morale check instead, with a penalty of + 2 to the roll.

Efreeti Bottle: This item is a large, heavy sealed jug about 3' high. If the seal is broken and the stopper pulled, an efreeti will come forth to serve the opener once per day for 101 days (or until slain). The creature will return to its home (the fabled City of Brass) after its term of service is ended. It will serve no one but the person opening the bottle.

Egg of Wonder: This strange item is the size of a chicken's egg, but it may be of any color. An egg breaks when dropped or thrown (to 60' maximum range); in the following round, a creature emerges from it and grows to normal size, thereafter obeying the thrower of the egg to the best of its ability. (Note that the creature must be able to hear the user's commands.) The creature will disappear after one hour of existence or when slain. The creature appearing is never determined until the egg actually breaks; characters can never know what creature will appear beforehand. The DM may add other creatures, if desired. To determine the type of creature appearing, roll 1d12.

| `1d12` | Creature |
|---:|---|
| 1 | Baboon, rock |
| 2 | Bat, giant |
| 3 | Bear, black |
| 4 | Bear, grizzly |
| 5 | Boar |
| 6 | Cat, mountain lion |
| 7 | Cat, panther |
| 8 | Ferret, giant |
| 9 | Lizard, gecko |
| 10 | Lizard, draco |
| 11 | Snake, racer |
| 12 | Wolf, normal |

Elven Cloak: The wearer of this cloak is nearly invisible (roll 1d6; seen only on a 1). The wearer becomes visible when attacking or casting a spell, and he may not become invisible again for a full turn.

Elven Boots: The wearer of these boots may move with nearly complete silence (roll 1d10; heard only on a 1).

Flying Carpet: This item can carry one passenger at up to 300' per turn, two at 240' per turn, or three at 180' per turn. It will not carry more than three passengers and their equipment. As an option, the DM can say that the carpet will carry an encumbrance of 6,000 cn, but the

weight of the passengers will have to be calculated.

Gauntlets of Ogre Power: These gauntlets will give the wearer a Strength score of 18, gaining all normal bonuses. If the wearer is not using a weapon, he can strike with one fist each round, gaining a +3 on hit rolls, for 1d4 points of damage.

Girdle of Giant Strength: This item gives the wearer the same chances to hit as a hill giant. The wearer does double damage with whatever weapon he is using.

Helm of Alignment Changing: This item looks like a fancy helmet. When the helm is put on, it will immediately change the wearer's alignment (the DM should determine the new alignment randomly). This device can only be taken off by using a remove curse spell, but the wearer will resist seeking the removal. Once it is removed, however, the wearer's original alignment will return. As an option, the DM may allow the character to remove the helm by performing a special task or adventure.

Helm of Reading: The wearer is able to read any writing, regardless of the language or magical properties of the script. This does not allow characters to use spell scrolls unless they can do so normally. This helm is fragile, however, and will be destroyed if the wearer is killed. Any hit on the wearer might (10% chance) destroy the helm.

Helm of Telepathy: This item looks like a fancy helmet. The wearer of this helm may send messages, by mere thought, to any creature within 90'. The creature receiving the thought messages will understand them. (The creature may refuse to respond.) The wearer may also read the thoughts of a living creature within range. To make the

helm work, the wearer must concentrate on the creature, and he may not move or cast spells. If the creature fails a saving throw vs. spells (or permits the thought reading), the wearer will understand the creature's thoughts.

Helm of Teleportation: Traditionally associated with magic-users only, this helm allows the wearer to teleport (as the magic-user spell, including chances of error) himself or to attempt to teleport another creature or item. An unwilling victim can make a saving throw vs. spells to avoid the effect. After one use, the helm will no longer function. If a teleport spell is then cast upon it, the user can then teleport as often as desired, up to once per round, without using charges. However, whenever the helm is used to teleport another item or creature, it again becomes useless, requiring another teleport spell to reactivate it.

Horn of Blasting: This horn creates a cone of sound, 100' long and 20' wide at the far end, when blown. Victims within this area take 2d6 points of damage and must make a saving throw vs. spells or be deafened for one turn; constructions and ships take 1d8 points of damage.

The horn may be blown but once per turn.

Lamp, Hurricane: This item appears and functions as a lamp of long burning in all respects, but only after its storm has passed, as described hereafter. This lamp is always closed when found. When the shutters are opened, violent gusts of wind and rain come from the lamp, dousing the holder (who gets no saving throw) and all others within 30'. This "hurricane" lasts for 3 rounds; each victim must make a saving throw vs. spells, and all those failing are knocked over from the

winds. If this occurs, every item carried (excluding body clothing and/or armor but including caps, gloves, treasure, etc.) is blown about, landing scattered within 60'. A successful saving throw indicates that the victim has fallen to the ground in time, tightly grasping all items carried. The hurricane lamp may thereafter be used as a lamp of long burning for the remainder of the day. It resets its "hurricane" effect every 24 hours, which must again be triggered before the lamp can be of more beneficial use.

Lamp of Long Burning: This item is identical to a normal adventurer's lantern. It is made of metal, with a lower compartment for oil, a handle, and shutters around the body to protect the flame from wind. When filled with oil and lit as a normal lantern, it will burn and shed light without using oil. If the flame is ever doused by water, the lamp of long burning becomes nonmagical.

Medallion of ESP, 30' Range: This magical medallion is strung on a chain and worn around the neck. If the wearer concentrates for 1 round, he may read the thoughts of any one creature within 30'. The wearer may move normally but cannot fight or cast spells while concentrating. The DM must roll 1d6 each time this item is used; it will not work properly on a roll of 1. If a 1 occurs, the medallion will broadcast the thoughts of the user to everyone within 30'! The DM may allow a saving throw vs. spells to prevent the medallion from reading a creature's thoughts.

Medallion of ESP, 90' Range: This item is identical to the medallion of ESP, 30' range, except that it has a greater range.

Mirror of Life Trapping: This unique item stores man-size or smaller creatures for an indefinite period. Any such creature who looks into the mirror must make a saving throw vs. spells or be sucked into it (complete with all equipment and treasure!). The mirror can store up to 20 creatures; when it is full, no more can be trapped. Creatures trapped in the mirror do not age or need food or air, but they are completely powerless. Anyone can talk with the creatures trapped in the mirror (if they speak the same language). If the mirror is broken, all the creatures trapped within are immediately released. However, trapped individuals can be recovered without harming the mirror by using a wish.

Muzzle of Training: This item is a device of leather straps with metal buckles and may be fastened over the mouth of any animal or monster that has a bite attack. It will magically expand or contract to fit the creature, and the victim can breathe but cannot bite (or talk) while wearing the muzzle. The muzzle will lock in place with a command word (treat as a wizard lock by a 15th level caster) and will unlock and fall off with a second command.

The muzzle can be commanded as often as desired.

Nail, Finger: This item appears identical to the common iron nail of medieval carpentry, 1"-4" long and very crudely made. It may easily be overlooked if found with other construction materials unless a detect magic spell is used. If mistaken for a nail of pointing and commanded to function, the nail disappears. When the user next tries to avoid the attention of an enemy (by hiding, invisibility, etc.), the nail reappears as a large glowing finger, pointing at the character for 1d6 rounds. The finger nail may reappear during each similar attempt thereafter

(25% chance for each), but a remove curse will cause it to vanish forever.

Nail of Pointing: This item appears identical to a common carpentry nail. If its command word is known, the user may cause it to point at any nonmagical item named (door, stairway, gold piece, etc.); the nail then turns into a finger of bone and points toward the closest item of that type. It will continue to point at that item for 1 turn and then return to nail form. There is no limit to the range of the nail's detection, but it cannot detect living or undead creatures of any type, nor can it detect any magical item or spell effect. The nail of pointing will function once per day.

Ointment: This white creamy salve is found in

a small wooden box with a cotton swab. If all the salve found is rubbed on any part of the skin of the recipient, a magical effect is produced. All ointments look, smell, and taste the same. To determine the type found, roll 1d6 and consult the following. The DM may add other ointments as desired.

| `1d6` | Ointment Type | Effect |
|---:|---|---|
| 1 | Blessing | Recipient gains `-2` AC and `+2` to all saving throws for 1 turn. |
| 2 | Healing | Cures `2d6 + 2` points of damage. |
| 3 | Poison | Appears as blessing; recipient must save vs. poison with a `-2` penalty or die. |
| 4 | Scarring | Appears as healing; inflicts `2d6` severe burn damage (repair by soothing ointment, cureall, or wish). |
| 5 | Soothing | Cures all burn damage, magical or normal. |
| 6 | Tanning | Skin turns bright color (red/yellow/orange/blue/green/brown), fading in `1d4` months. |

Pouch of Security: This item is the size of a large sack (capacity 600 cn). Any attempt at stealing the pouch causes it to scream, "I am being stolen!" (in the Common tongue) repeatedly for one hour. Its cries can be heard to 120'. If its owner holds it and commands it to be quiet, it will obey, but it will repeat its cries if stolen again.

Quill of Copying: A quill is a large feather that can be dipped in ink and used as a writing implement. It will copy only one spell per week at most. The original scroll must be burned, and the ashes mixed with rare ink (of 1,000 gp cost). The quill is then placed on a blank scroll along with an inkwell containing the prepared ink. Upon command, the quill starts to write, creating two identical spells on the scroll instead of the single original. If the scroll burnt contains two or more spells, only one spell will be copied—either the lowest level spell or (if more than one are the lowest level) a randomly selected spell. The quill will not copy protection scrolls or any other writing except spell scrolls.

Unfortunately, there is a 25% chance per use that the quill will suddenly drain of ink, spoiling the entire scroll upon which it is writing. The blot thus created cannot be removed from the parchment by any means but a wish.

Rope of Climbing: This 50'-long, thin, strong rope will climb in any direction upon the command of the owner. It can fasten itself to any protruding surface and will support up to 10,000 cn of weight.

Scarab of Protection: This item automatically absorbs any curse (whether by spell, scroll, or other effect). It will also absorb a finger of death (a cleric's raise dead spell, reversed). The scarab will work 2d6 times before becoming worthless.

Slate of Identification: This valuable device, usable only by spellcasters, can identify magical items of most sorts. It is a piece of slate (stone) held firmly in an ornate wooden frame, usually about 3' square (though slates of many sizes are possible, both larger and smaller). The user holds the slate horizontally and places a magical item upon it. When the item is lifted off, the name of the item appears on the slate. If an item has command words, one will appear on the slate with each identification. The slate will only repeat itself when all the command words have been revealed. The slate is easily fooled by cursed items, however. And it cannot detect an item's number of charges or special ability. A potion of poison will be mistakenly identified as some other type. Any cursed item will be identified as a normal item. (These guidelines should be strictly followed, lest the mystery of such items found be ruined.) The slate may expend up to ten charges per day; items identified require the following numbers of charges per use.

| Item Class | Charges per Use |
|---|---:|
| Potion | 2 |
| Missile | 3 |
| Wand | 4 |
| Staff | 5 |
| Any permanent magical weapon | 6 |
| Armor or shield | 7 |
| Ring or rod | 8 |
| Minor miscellaneous item* | 10 |
| Major miscellaneous item* | Special |

* The DM's judgment is required as to the value and frequency of such items in the campaign. A "major" item might be identifiable, but only by making the slate useless for 1d4 days.

Stone of Controlling Earth Elementals: This item may be used only once per day. The stone is only 6" across, and it requires 1 turn to use. The stone will summon an earth elemental and will allow the user to control it, subject to normal rules for elemental control.

Talisman of Elemental Travel: There are five types of talismans. Roll 1d10 to determine the exact item found.

| `1d10` | Talisman Type |
|---:|---|
| 1-2 | Lesser Talisman of Air |
| 3-4 | Lesser Talisman of Earth |
| 5-6 | Lesser Talisman of Fire |
| 7-8 | Lesser Talisman of Water |
| 9-10 | Greater Talisman (all elements) |

Lesser Talisman: This item is a round amulet that may be found on a chain; there are corresponding types to each of the four elements. It is engraved with a triangle in the center and a symbol above it (one of the ten symbols of the elemental ranks). On the Prime Plane, the user may press the central symbol while casting a conjure

elemental spell; the talisman will reverse the effect, sending the wearer into the appropriate elemental plane. While wearing the talisman, the user can breathe elemental matter as if it were pure, clean air, and he gains in vision (normally 120'-1,200' range, depending on conditions).

Greater Talisman: This item is similar to a lesser talisman in powers, but applies to all the elemental planes. It is engraved with the four triangular symbols of the planes, meeting in the center. The ten symbols of all the elemental ranks are inscribed around the edge. If the proper command words are known, the wearer may also force an elemental being to obey instructions. This uses one charge; the talisman can expend up to ten charges per trip into an elemental plane.

Wheel of Floating: This item appears identical to a normal wagon wheel, but it enables any wagon upon which it is mounted to float on water. One wheel of floating allows a wagon to be towed across a river or stream, carrying up to 10,000 cn weight without sinking. Each additional wheel of floating allows 5,000 cn more

weight to be carried, to the normal maximum for the wagon of 25,000 cn. Swamp travel is also possible, but at a very slow movement rate unless some water-type draft animal is available.

A cursed wheel of floating will, when reaching the center of any river or stream, become stuck at that point and cannot be moved until a remove curse is applied by a 15th or higher level caster. This allows progress to continue, but the curse will return again at next use until the wheel is destroyed.

Wheel of Fortune: This strange device is 10' in diameter, mounted on a stand or wall fixture, and easily rotated. It is decorated with a blackand-white pattern of wedges, all intersecting at the center where a green arrow is mounted; the arrow does not turn with the wheel. Near the rim, each black wedge is adorned by a white skull and each white wedge by a red heart. If the wheel is spun (easily done by any creature of 3 Strength or greater), it rotates for 3 rounds and then comes to rest, with the green arrow pointing at one of the wedges (either black or white with equal chances for each). However, a charmed creature cannot move the wheel, and each user can spin the wheel only once per day. If the wheel has spun freely for the 3 rounds, not touched or interfered with in any way, a magical effect occurs, determined by the result of the spin. The wheel cannot be affected by magic of any kind, including telekinesis, and it cannot be damaged in any way. A wish used to affect the wheel will cause the wheel to vanish, regardless of the wish. The wheel cannot be moved except by a creature of 26 or more levels (or Hit Dice). The wheel weighs 20,000 cn. For each white or black wedge that appears, roll 1d6 and consult the following.

White Wedge:

| `1d6` | Result |
|---:|---|
| 1 | 1,000 gold pieces appear |
| 2 | 10 garnets appear |
| 3 | 1 brooch appears |
| 4 | 1 miscellaneous magical item appears |
| 5 | 1 ability score rises by 1 point (maximum score 18) |
| 6 | Prime Requisite or Constitution rises by 1 point (maximum score 18) |

Black Wedge:

| `1d6` | Result |
|---:|---|
| 1 | 1 ability score drops by 1 point (minimum score 3) |
| 2 | Prime Requisite drops by 1 point |
| 3 | Constitution drops by 1 point |
| 4 | Least valuable magical item carried disintegrates |
| 5 | All nonmagical items, except for normal clothing, disintegrate |
| 6 | Die (no saving throw) |

The DM may select or randomly determine the results of the spin. If desired, the wedges may be numbered from 1-20, 1-100, or some other conveniently determined number, and a chart may be made with more varied results.

Wheel, Square: This odd "wheel," the size of a normal wagon wheel, is useless on roads and other flat terrain because it is perfectly square. However, when mounted properly on a wagon, it magically allows movement through mountain and desert terrain where there is no road. A wagon with one square wheel can be pulled by two horses and can move at 20'/turn; with two wheels, 30'/turn; with three, 40'/turn; and with four, the normal rate of 60'/turn is possible.

#### Armor and Shields Descriptions
Armor and Shields.

To use the Magical Item Subtable: 6. Armor and Shields on page 230, roll 1d100 to determine the size of armor and check the appropriate column. Then roll 1d100 to determine type of armor (leather, banded, plate, etc.). If a result indicates a type of armor not used in a DM's campaign (for instance, some DMs don't allow suit armor), reroll for a new result. Using the appropriate column for the type of armor (or shield) identified on the Armor Class Modifier subtable, check for the AC modifier and subtract the bonus from the base AC rating for that type of armor. Also check for the chance of special powers on the same subtable. If the percentage listed or less is rolled for the special power, consult the Special Powers subtable. (Special powers are described below.) The base armor classes and the final AC ratings when modified by a magical bonus are outlined below. Keep in mind that a shield, is used, has its AC added to that of the character's armor.

| Armor Type | Base AC |
|---|---:|
| Leather | 7 |
| Scale mail | 6 |
| Chain mail | 5 |
| Banded mail | 4 |
| Plate mail | 3 |
| Suit armor | 0 |
| Shield | -1 |

| Armor Type | `+1` | `+2` | `+3` | `+4` | `+5` |
|---|---:|---:|---:|---:|---:|
| Leather | 6 | 5 | 4 | 3 | 2 |
| Scale mail | 5 | 4 | 3 | 2 | 1 |
| Chain mail | 4 | 3 | 2 | 1 | 0 |
| Banded mail | 3 | 2 | 1 | 0 | -1 |
| Plate mail | 2 | 1 | 0 | -1 | -2 |
| Suit armor | -1 | -2 | -3 | -4 | -5 |
| Shield | -2 | -3 | -4 | -5 | -6 |

For example, a fighter who came across chain mail +3 and exchanged her normal scale mail

(AC 6) for the new armor would now be AC 2. If she also happened upon a magical shield +2 and chose to use it, her armor class would become -1 (AC 2 + -3 = -1). The actual types of armor were described in Chapter 4. Magical versions are identical in class restrictions, and these restrictions must still be observed by characters. Note that armor and shields made for humans, dwarves, and elves are considered "normal-sized," while halfling equipment is counted as much smaller and giant equipment much larger. For instance, a halfling shield offers no protection to a normal-sized character, but a normal-sized shield may be used by anyone— including a halfling. And a giant-sized shield is considered double normal size for a + 2 bonus to armor class.

Cursed Armor and Shields. Armor and shields may be cursed. The DM should roll 1d8 when either is placed as treasure; a result of 1 indicates that the item is cursed. Cursed armor, when first worn, appears to be armor of the type originally rolled on the armor and shields subtable. When the character first goes into combat with monsters, however, the armor makes the character easier to hit by a penalty equal to the bonus rolled. Once it has revealed its true nature, the armor will not come off its wearer; someone will have to cast a remove curse to cancel the curse long enough for the character to remove the armor. Or a 36th level cleric can cast a remove curse to remove the curse permanently, and the wearer may then enjoy his magical armor with the proper benefits.

Special Power Descriptions. Armor and shields can have special powers that can be used once per day at most, unless noted otherwise. When both the armor and shield worn have special powers, only one effect can be produced per round at the user's choice unless noted otherwise in the description. Note that armor and shields that have special powers are usable by any class that can use armor and shields; there are no other restrictions.

The powers listed in the Special Powers subtable (in the Magical Item Subtable: 6. Armor and Shields, page 229) are described in the following text.

Absorption: If the user is hit by a blow that would cause an energy drain, the armor or shield absorbs the draining effect and only the normal damage affects the user. Each energy drain causes the loss of one AC bonus modifier from the armor or shield. When reduced to zero bonuses, the item crumbles to dust. (For instance, a shield +3 that has absorbed two energy drain attacks is now only a shield + 1. If it absorbs yet another energy drain, it is reduced to zero and disintegrates.) This special power is not under the control of the user; a character cannot choose to suffer the energy drain and leave the item intact. The normal limit of one use per day does not apply to this power.

Charm: When the user is hit by an opponent, the opponent must make a saving throw vs. spells or become charmed by the user of the special armor or shield (as the magic-user spell charm person or charm monster). If a hand-held

weapon is used in the attack, the opponent gains a +4 bonus to the saving throw. Only one victim can be charmed each day, but any number of saving throws may be made before the charm is successful.

Cure Wounds: The armor or shield can cure half of the damage the user has incurred, whatever that amount may be, once per day. It can only cure the user, not another creature, and it cannot affect poison, disease, or any other damage but wounds.

Electricity: The armor or shield can, on command of the user, become charged with magical electrical force. If the user is hit while "charged," the attacker takes 6d6 points of electrical damage. The attacker may make a saving throw vs. spells to take half damage; if a weapon is used in the attack, a +4 bonus to the saving throw applies. The armor or shield can be charged or neutralized as often as desired by using command words, but it can only cause damage ("discharge") once per day.

Energy Drain: The armor or shield can become "charged" on command (as described under the electricity special power), but instead of inflicting damage, it causes the loss of one of the opponent's levels or Hit Dice (as if a wight). The same saving throw as the electricity power applies (possibly with bonuses); if successful, the energy drain does not occur. The item can drain one level or Hit Die per day, but any number of saving throws may be made before this occurs.

Ethereality: The user may become ethereal on command and may remain ethereal for as long as desired. The user may return to the Prime Plane when a second command word is spoken.

Each command word may be used once per day.

Fly: When commanded, the armor or shield creates a fly spell effect on the user, which lasts for 12 turns. The user may then travel in the air at up to 360' per turn by mere concentration (as per the 3rd level magical spell).

Gaseous Form: This valuable armor or shield enables the user to turn into a cloud of gas (as the potion of gaseous form), including all equipment carried (unlike the potion). The user can remain gaseous for up to 6 turns and can return to normal form by mere concentration.

Haste: When commanded, the armor or shield creates a haste spell effect on the user, allowing double normal movement and number of attacks (as the 3rd level magic-user spell). The haste lasts for only 1 turn and is usable only once per day.

Invisibility: When commanded, the armor or shield makes the user invisible, as if the 2nd level magic-user spell were cast. In addition, the armor or shield can itself become invisible three times per day, on command of the user.

Reflection: If a light or continual light spell is cast at the user, the armor or shield will automatically reflect it back at the caster, who must make a saving throw vs. spells or be blinded (as given in the respective spell descriptions). The item will reflect up to three spells per day. In addition, when the user is in melee against a creature with a gaze attack, the chances of gaze reflection are the same as if a mirror were held but without the — 2 penalty to the user's attack rolls (which represents the awkwardness of holding the mirror and attempting to attack at the same time).

Remove Curse: This armor or shield cannot itself be cursed when found. When commanded, the item will create a remove curse spell effect on the user only as if a 36th level caster (automatically removing one curse).

Note: This item will function a total of three times, at a maximum rate of once per day. After its three charges are used, no other special abilities remain and it cannot be recharged; the item does remain magical, however, regardless of spent charges.

#### Missile Weapons and Missiles Descriptions
Missile Weapons and Missiles. A missile weapon is a weapon (bow, sling, etc.) that launches ammunition through the air, and a missile is the ammunition (arrow, stone, etc.) a missile weapon launches. All magical missile weapons have bonuses that give them additional pluses to both attack and damage rolls. Magical missiles (such as an arrow + 2) also have bonuses to both attack and damage rolls. As noted in the text on "Magical Weapon Subtables," page 228, there are two methods of randomly generating weapons. The first, recommended for character levels 1-10, is a single table. If the DM has decided to place a magical missile weapon or missile in a treasure hoard, he or she can simply roll 1d100 on the Magical Weapon Generation Table (page 230), find the result in the appropriate column, and place the item in the treasure. When stocking treasure troves with magical missile weapons and missiles for characters who are above level 10, the DM can use the same table—or he or she can use the more specific but more complex method of random treasure generation, the Random Missile Weapon and Missile Generation Checklist. Note that if both a missile and the missile weapon firing it have bonuses, the total of their bonuses and effects will apply in all cases. For example, a crossbow +2 shooting a quarrel +3 would have a + 5 chance of attack and would do + 5 of damage if the attack roll is successful. Likewise, normal arrows shot by a long bow +1 can harm gargoyles (which are damaged only by magic). A magical missile normally becomes nonmagical after one use, regardless of whether the attempt hits a target (its bonus to the attack roll disappears). However, if the missile has a talent, a missed shot will not destroy the magic unless noted otherwise in the following missile talent descriptions. Usually, if the missile is retrieved after a missed shot, it may be reused with its magical bonuses intact.

The talents listed in the Missile Talents subtable (in the Magical Item Subtable: 7. Missile Weapons and Missiles, page 230) are described in the following text.

Biting: When the missile hits, the talent turns it into a poisonous snake. In addition to normal damage, the victim must make a saving throw vs. poison or die (or, at the DM's choice, take extra damage; 2d6, 2d10, or 2d20 are recommended amounts).

Random Missile Weapon and Missile Generation Checklist 1.

Roll 1d100 on the Magical Item Subtable: 7. Missile Weapons and Missiles

(page 230) to determine the item. Note the weapon class. Missile weapons (such as bows and blowguns) are Class D, while missiles are Class A. (Weapon class is a measure of how difficult it is to construct weapons or ammunition; weapon classes are discussed in full under "Swords," below.) 2.

The Magical Item Subtable: 7.

Missile Weapons and Missiles is further divided into two subtables: Missile Weapons and Missiles. Once the specific type of magical item has been determined (long bow or quarrels, for example), the DM should check the appropriate subtable and note the following: • For missile weapons, the DM rolls 1d100 to find the magical bonus (to attack and damage rolls). He or she then rolls 1d4 and adds the die roll to the magical bonus—this result will indicate the range multiplier. (This is an additional bonus a missile weapon may have to extend its ranges; if a bonus is indicated, multiply the weapon's short, medium, and long ranges by the range multiplier—the results will be the magical weapon's true ranges.) Finally, the DM should roll against the percentage listed for the chance of an additional weapon modifier. (The chance listed to be checked is the one that corresponds with the magical bonus first rolled on this subtable.) If the roll is successful, he or she then goes to the Additional Weapon Modifiers Table on page 231 and applies the results. (Additional modifiers include bonuses against a specific opponent and weapon talents.) • For missiles, the DM rolls 1d100 to find the magical bonus (to attack and damage rolls). He or she then rolls the die indicated for the number of missiles found. Lastly, the DM rolls against the percentage listed for the chance of a missile talent.

If the roll is successful, the DM then rolls 1d100 on the Missile Talents subtable (part of the Magical Item Subtable: 7. Missile Weapons and Missiles) to find the missile's specific talent. (Talents are described below.)

Blinking: The missile with this talent will not hit any friend of the user, "blinking" in and out of existence until it reaches an enemy. (If the sight of the enemy is blocked by friends, a penalty may apply to the attack roll).

Charming: The victim hit must make a saving throw vs. spells or be charmed by the user (as the charm person or charm monster magic-user spell).

Climbing: This talent only functions if the missile is shot at an object. The missile securely fastens itself to any object hit and then creates a magical 50' rope, issuing from the spot hit. The rope will support any weight of climbers and will

disappear 1 turn later or upon command of the user. The missile cannot be moved after it hits, and it disappears when the rope does.

Curing: A missile with this talent is obviously blunt, inscribed with a holy symbol. When it hits a living creature, it does not inflict damage. Instead, it cures 2d6 points of damage plus 2 extra points for each magical bonus of the missile. For example, if a 5 is rolled for a curing arrow + 2, the total points of damage cured are 7.

Disarming: This talent will only function if the victim hit is holding a weapon or other item. The victim must make a saving throw vs. spells or drop the item. A dropped item may normally be recovered in 1 round (unless it falls into a pit or chasm, if someone else grabs it, etc.).

Dispelling: When a missile with this talent hits, it creates a dispel magic effect centered on the point of impact (a 20' cube) as if cast by a 15th level caster.

Flying: A missile with this talent can be shot at ranges five times greater than normal. If the missile weapon firing this missile is also magical and has an additional range multiplier, the effect is cumulative; multiply each maximum range by five. If the missile weapon is not magical, use the following maximum ranges.

| Missile Type | Short | Medium | Long |
|---|---:|---:|---:|
| Arrow, short bow | 250 | 500 | 750 |
| Arrow, long bow | 350 | 700 | 1,050 |
| Quarrel, light crossbow | 300 | 600 | 900 |
| Quarrel, heavy crossbow | 400 | 800 | 1,200 |
| Sling stone | 200 | 400 | 800 |

Lighting: The missile talent can create a light spell effect (30' diameter), either upon command or when it hits a target. If a creature is hit, the victim must make a saving throw vs. spells or be blinded by the light (as if the spell had been cast at its eyes). The missile disintegrates when the light is created.

Penetrating: A missile with this talent cannot be slowed by underbrush, webs (normal or magical), or other forms of cover. The victim's armor class is not modified by cover of any sort.

Refilling: This talent gives no special effects to a missile when shot. If left in a container with other missiles of the same type (that is, a refilling arrow with normal arrows or a refilling sling stone with normal sling stones), however, it will magically create 1d20 more missiles of the normal type each day.

Screaming: This talent's effect occurs when the missile is shot, even if it misses the target. As it travels through the air, the missile produces a loud cry, causing all within 30' of its path to check morale. If the morale check is failed, the victims will retreat in fear for 1d8 rounds.

Seeking: This talent will only function when the missile is shot at an object; it is not usable against creatures. It will automatically hit any one target object within range as long as a path of travel is clear. It may be used as a missile of disarming, if desired, or it can be used to sever a normal rope, pierce a sack, push a button, trigger a trap, etc. It will automatically miss any creature at which it is aimed.

Sinking: When shot at a water craft of any sort, a missile with this talent inflicts 1d10 + 10 (11-20) hull points of damage when it hits. (The armor class of the vessel is used, as if the shot were a ramming or catapult attack.)

Slaying: If the die rolls for a missile indicate

this talent, go to the Opponents subtable in the Additional Weapon Modifiers Table (page 231) and roll 1d100. The result indicates the missile talent's opponent. When that opponent is hit by this missile, the victim must make a saving throw vs. death ray or die.

Speaking: A missile with this talent will miss any creature at which it is shot. It is used for communication purposes only. The user may give the missile any message of 20 words or less and then shoot it, either naming a place within ten miles or aiming at a target. The missile will automatically land on the floor or ground in the target area and will repeat the message aloud twice.

Stunning: The victim hit by a missile with this talent must make a saving throw vs. spells or be stunned for 1d6 rounds.

Teleporting: A victim hit by a missile with this talent must make a saving throw vs. spells (at a + 2 bonus to the roll) or be teleported to a point 1d100 miles away, with the direction and distance determined randomly. Unlike the effect of the magic-user spell, the victim cannot arrive in the air or within a solid object.

Transporting: A victim hit by a missile with this talent must make a saving throw vs. spells or be sent to a point up to 360' away, as determined by the user of the missile. The effect is identical to the magic-user spell dimension door, and it cannot cause the victim to appear within a solid object.

Wounding: When a missile with the wounding talent strikes a target creature, it inflicts normal damage. In addition, however, it causes the loss of 1 hit point per round thereafter until magical curing is applied (a potion, cure spell of

any type, etc.). However, no undead creature or construct (golem, living statue, etc.) can be wounded with this talent, and such creatures suffer only the initial damage.

#### Sword Descriptions
Swords. A magical sword's bonus is added to both its attack rolls and damage rolls. Some swords also have an additional bonus that is used only when fighting a special type of opponent. Other swords may have bonuses or modifiers such as the ability to cast certain spell effects. The DM may wish to refer to such spells to find the exact effect. Note that each effect can only be used once per day and that no meditating is needed to gain the spellcasting ability.

As noted in the text on "Magical Weapon Subtables," page 228, there are two methods of randomly generating swords. The first, recommended for character levels 1-10, is a single table. If the DM has decided to place a magical sword in a treasure hoard, he or she can simply roll 1d100 on the Magical Weapon Generation Table (page 230), find the result in the appropriate column, and place the item in the treasure. When stocking treasure troves with magical swords for characters who are above level 10, the DM can use the same table—or he or she can use the more specific but more complex method of random sword generation, the Random Sword Generation Checklist.

Random Sword Generation Checklist:
1. Roll 1d100 on the Magical Item Subtable: 8. Swords (page 231) to determine the type of sword. Note the weapon class. Short and normal swords are Class C, while bastard and two-handed swords are Class D. (Weapon class is discussed in full below.)
2. Roll 1d100 again and check the appropriate weapon class column for the magical attack and damage bonus. Roll 1d100 against the percentage listed for the chance of an additional modifier; if the roll is successful, see the Additional Weapon Modifiers Table on page 231 and apply the results. (Additional modifiers include bonuses against a specific opponent and weapon talents.)
3. Since all magical swords have a chance of intelligence, check the Intelligence of Sword subtable (in the Magical Item Subtable: 8. Swords) by again rolling 1d100. The result will indicate the sword's intelligence (if any), method of communication (if any), languages known (if any), and number of powers (if any). (These abilities are explained below.)
4. If the sword is intelligent, determine alignment and ego as indicated in the text below under "Sword Alignment, Ego, and Control Checks." Also do a control check to see if the intelligent sword will control its user.
5. The powers available to a sword include primary powers, extraordinary powers, and the ability to read magic on command. If a primary or extraordinary power is indicated for a sword, go to the Primary and Extraordinary Powers subtable (in the Magical Item Subtable: 8. Swords) and roll 1d100 in the appropriate column. If more than one power was indicated, roll as necessary, ignoring any duplicate rolls except those that are allowed.

Weapon Class. Magical weapons typically must be made by a special procedure, usually performed by a magic-user or cleric working in conjunction with a blacksmith or armorer. Weapon class is a measure of the difficulty of that item's construction. The weapon tables give the weapon class for each weapon. Generally, Class A weapons are small and temporary magical items, the most frequently found; Class D weapons are the largest and rarest as they require the most work. At the DM's option, other new weapons may be invented. Each new weapon should be categorized as to one of the four weapon classes,

#### Additional Weapon Modifiers: Opponents

Use opponent categories from the source list: `bugs`, `constructs`, `dragonkind`, `enchanted monsters`, `giantkind`, `lycanthropes`, `planar monsters`, `regenerating monsters`, `reptiles and dinosaurs`, `spell-immune monsters`, `spellcasters`, `undead`, `water-breathing monsters`, and `weapon-using monsters`.

#### Additional Weapon Modifiers: Talents

Use talent categories from the source list: `breathing`, `charming`, `deceiving`, `defending`, `deflecting`, `draining`, `extinguishing`, `finding`, `flaming`, `flying`, `healing`, `hiding`, `holding`, `lighting`, `silencing`, `slicing`, `slowing`, `speeding`, `translating`, `watching`, and `wishing`.

Artifact rule:
- Artifacts are high-tier exceptions, not routine treasure.
- If introduced, treat them as campaign-shaping items with bespoke adjudication.

---

## Albums, Anchored Powers, Grimoires

“A spell is only half‑real until it has a spine and a cover.” — Anon. Archivist‑Daemon

### 1. What is a Grimoire?

A Grimoire is a physical (occasionally psychonoetic) artefact \- magitech+fantascience from the Long Long Ago that compresses, encrypts, and curates power patterns—the same formulae sold today as Albums of Power. Unlike a loose album, each Grimoire is self‑contained technology: open its cover (or socket it into your cortex) and you have a portable spell‑library.  
It occupies one inventory slot (usually physical; rare "glass‑mind wafers" take a Trait slot).

A Grimoire is Named: immune to the Curse of Iron and counts as a Named Item for narrative effects. While most Albums start as level 0 items, Grimoires often start at a higher level due to the secrets of their  construction.

### 2. Capacity & Slots

The Grimoire’s Level sets how many powers it can store (Capacity) and how many it can have active (Anchor Slots \= Level).

\> d20+Level on Album table VLG p106

When first created, roll d20 \+ Grimoire Lvl and consult Album Level / Price (VLG p106) to discover the maximum total spell levels it can archive.

#### 2.1 Anchored vs Astral Powers

Anchored slots hold Mods or Powers that are pre‑loaded into the Grimoire’s hardware—ready to use, just pay the price. Each occupies one Anchor Slot but no character inventory slots.

Astral copies are Powers inscribed in the user’s soul. Each uses one Trait inventory slot.

Capacity (max power): replicate & swap Powers in and out of Grimoire's Capacity to Anchor slots or character Trait slots. Move up to your own level in powers per attempt. Takes a ten minute meditation, or a move action \+ Aura save, failure: make a Danger Roll.

### 3. Levelling a Grimoire

A Grimoire may grow through play, just like a Hallmark (or Path Trait). On gaining a level, increase Capacity and Anchor Slots per the Hallmark rules.

* Daemon Experience – When the owner gains XP and dedicates it to the book, the Grimoire may level up (see Hallmark rules).  
* Deeds – Succeed at three significant tests where the Grimoire mattered (e.g. defeating a Flux anomaly with its powers) before one failure or a story‑driven time limit; on success, Level +1.

### 4. Mods & Hardware Upgrades

Mods are physical or code augments inserted into spare Anchor Slots. See Custom Combat Gear, Vastlands Guidebook p. 80, for general ideas.

\> Installation: spend a watch and succeed a d20 \+ Thought vs 13 test, or pay a Tech‑Lares €100.

Failed Installation tests force a Danger Roll.

**Grimoire mods:**

| Mod | Effect | Install Cost (refined stones) |
| --- | --- | --- |
| Flux‑Regulator | Reduce Life cost of powers by 1 (min 1) once per watch | 1 static, 1 active |
| Holo‑Indexer | Swap to or from Capacity, Astral, or Anchored as a free action 1/watch(4 hours) | 1 dynamic, active |
| Soul‑Parity Dweomer Key | Owner may cast an Anchored power when brought to 0 Life as a free action with price 0 (no overcharging, still risks defeat) | 2 dynamic |

### 5. Using a Grimoire in Play  

Load Powers during downtime or with 10 minutes of uninterrupted fiddling.

Casting: identical to normal power use; the Grimoire simply exempts the caster from occupying personal Trait/Physical slots for anchored spells.

\> Trade & Loot: A Grimoire sells for its Album base price × Lvl, plus €50 per Mod. Selling a used one? Begin haggling at 60% base price.

### Example Grimoires (`1d6`)

| Name & Format | Level / Anchor Slots | Capacity (lv) | Quirks |
| --- | --- | --- | --- |
| 1. Codex of the Sea‑Filk Apocalypse (knotted net record, mint) | 3 | 26 lv | Plays mournful surf‑guitar through any speaker within 30 ′ when opened. |
| 2. Heliophage Heart Glyphs (sun‑etched memory tattoo) | 1 | 12 lv | Glows amber when undead are within 60 ′; once each dawn, bearer may reduce the Life cost of a Light‑tagged power by 1, min 1. |
| 3. Lacrimae Machina Manual (compact phonograph) | 2 | 18 lv | When a power in this album is cast (anchored or trait), nearby machines briefly weep lubricant. This might trigger a Reaction roll. |
| 4. Null Priest Litany Disk (artificial mnemonic lotus) | 4 | 33 lv | Uncanny Dirge: After the bearer casts their first power each watch, an ethereal chorus swells; enemies within 30 ′ suffer −1 to all rolls until the end of the next round. |
| 5. Erebus Library Tile (tetragonal bone‑scales) | 2 | 17 lv | +2 on Lore checks about portals while carried. |
| 6. Quietus Memory Demi‑Tome (pale parchment codex) | 1 | 11 lv | If the bearer dies, the book captures the last minute of memories (usable once). |

### Grimoire Recipes

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
