# TODO: BECMI Spell Extraction Spot Check

This report compares the original staging extractor against a cleaner variant before adopting it as the default pipeline.

Comparison:
- Baseline: `pdftotext -layout`
- Clean: `pdftotext -layout -nodiag -nopgbrk`

Evaluation goals:
- reduce page-break formfeed noise
- preserve spell/material searchability
- keep section headings and key spell terms readable
- avoid forcing OCR on PDFs that already contain usable text layers
- spot-check the Companion lane’s flow-first heading-to-heading extraction helpers on high-value sections

Note:
- `ocrmypdf` is available locally, but these PDFs already expose searchable text. This pass therefore treats OCR as a fallback for future problem PDFs, not as the default path.
## TSR 1011B - Set 1 Basic Rules

- Source PDF: `TSR 1011B - Set 1 Basic Rules.pdf`
- Baseline extractor: `pdftotext -layout`
- Clean extractor: `pdftotext -layout -nodiag -nopgbrk`
- Formfeed count: baseline `120`, clean `0`
- Target hit count: baseline `12`, clean `12`
- Assessment: Searchable spell material is preserved. The clean extractor removes page-break formfeeds but does not fix source-text corruption such as split glyphs in older spell tables.

### Clean Sample

```text
 Backpack                   Iron rations      Tinder box          Small metal mirror         2 small sacks             2 large sacks
 6 tinder box torches        Rope (50')        1 waterskin (full)     1 wineskin (full)       See page 43 for special abilities and
 2 waterskins (full)       2 small sacks       2 small sacks             2 large sacks     full class description.
 2 large sacks                                  Spell Book: Read Magic, Sleep
  See page 24 for special abilities and         See page 37 for special abilities and
full class description.                      full class description.

Dwarf                                        Elf                                           Halfling
16 Strength ( + 2 bonus on Hit rolls,        16 Strength ( + 2 bonus on Hit rolls,         16 Strength ( + 2 bonus on Hit rolls,
   damage rolls, and opening doors)             damage rolls, and opening doors)              damage rolls, and opening doors)
 7 Intelligence                               9 Intelligence                               11 Intelligence
11 Wisdom                                     7 Wisdom ( - 1 penalty on Saving             14 Wisdom ( + 1 bonus o n Saving
14 Dexterity ( + 1 bonus to missile fire        Throws vs. magic)                             Throws vs. magic)
   Hit rolls, - 1 Armor Class bonus)         14 Dexterity ( + 1 bonus to missile fire       9 Dexterity

```

## TSR 1012B - Set 2 Expert Rules

- Source PDF: `TSR 1012B - Set 2 Expert Rules.pdf`
- Baseline extractor: `pdftotext -layout`
- Clean extractor: `pdftotext -layout -nodiag -nopgbrk`
- Formfeed count: baseline `106`, clean `0`
- Target hit count: baseline `12`, clean `12`
- Assessment: The clean extractor preserves Expert spell list/search terms while cutting page-break noise. Embedded source OCR-style damage remains in places, but not enough to block staging use.

### Clean Sample

```text
                                                        1. Continual Light*                                  1. Animate Dead
not fit the character's Alignment or beliefs,           2. Cure Blindness                                    2. Create Water
the cleric may be punished by the church                3. Cure Disease*                                     3 . Cure Serious Wounds*
- or even greater powers. This punish-                  4.Growth of Animals                                  4. Dispel Magic
ment could, for example, be a penalty on                5. Locate Object                                     5. Neutralize Poison*
Hit rolls, a dangerous quest that must be               6. Remove Curse*                                     6. Protection from Evil 10'radius
completed, or even a lack of spells. Your               7. Speak with the Dead                               7. Speak with Plants
DM will tell you what the character must                8. Striking                                          8. Sticks to Snakes
do to recover good standing.
                                                      F I l T H LEVEL CLERIC SPELLS                        SIXTH LEVEL CLERIC SPELLS
   When a cleric reaches Name level, a cas-              1. Commune                                          1. Animate Objects
tle may be built. If the cleric has never been          2. Create Food                                       2. Find the Path
punished for misbehavior, the cleric's                  3 . Dispel Evil                                      3. Speak with Monsters*
church may help with the cost. Some fol-                4.Insect Plague                                      4.Word of Recall

```

## TSR 1013 - Set 3 Companion Set

- Source PDF: `TSR 1013 - Set 3 Companion Set.pdf`
- Baseline extractor: `pdftotext -layout`
- Clean extractor: `pdftotext -layout -nodiag -nopgbrk`
- Formfeed count: baseline `104`, clean `0`
- Target hit count: baseline `4`, clean `4`
- Assessment: Companion spell references survive the clean pass and remain searchable. Noise reduction is mostly structural here rather than lexical.

### Clean Sample

```text
   derstandings at a future time.                   living creature or character touched (no Sav-
   neutral cleric may choose either of the          ing Throw). The caster must make a normal
options above, or (if desired) may choose to        Hit roll to cause the critical wound.
live and travel in the wilderness, becoming         Raise Dead*
familiar with nature and the ways of the ani-
mals. After 1-4 months of study and medita-           When cast at an Undead creature of more
tion, the cleric becomes a druid, and may           Hit Dice than a vampire, this spell inflicts 3-
learn new spells (see page 14).                     30 (3d10) points of damage. The victim may
   The life of a druid is far different from any-   make a Saving Throw vs. Spells to take 1/2
thing the cleric has ever known. It is a diffi-     damage.
cult path, but can be very rewarding.                 The reverse, finger o f death, will actually      can carry up to 5,000 cn. It can become ethe-
                                                    cure 3-30 points of damage for any Undead           real at will, and thus can travel to most places
Spells                                              with 10 or more Hit Dice (phantom, haunt,           easily. However, it cannot pass a protection
   All rules on spell casting are given in the      spirit, nightshade, or special).                    from evil spell effect. If it cannot perform its

```

## TSR 1021 - Set 4 Master Rules

- Source PDF: `TSR 1021 - Set 4 Master Rules.pdf`
- Baseline extractor: `pdftotext -layout`
- Clean extractor: `pdftotext -layout -nodiag -nopgbrk`
- Formfeed count: baseline `104`, clean `0`
- Target hit count: baseline `173`, clean `173`
- Assessment: Master remains extractable with the clean flags, with the main benefit again being page-break suppression rather than word recovery.

### Clean Sample

```text
destined to be. Then, in the Companion Set,           The Master Players' Book completes the           tions to help a D M with his record keeping.
you climbed to the pinnacle of success and         listing of skills and abilities for all character   The section on modifying encounters and
founded kingdoms, conquering the wild              classes. Especially noteworthy are the many         monsters to meet the DM's goals includes a
lands and battling barbarian hordes. Now, in       new high-level spells, including the most           short method for determining the balance
the Master Set, you can soar across the sky        potent spell known to man, the wish.                and challenge of an encounter. Expanded
and into the pages of legend.                         Then there are several new optional sys-         experience awards are provided for use with
    These books are written for the experi-        tems offered, including Weapon Mastery and          higher-level monsters. Also introduced are
enced D&D@ player. Begin by reading the            Siege Warfare. In Weapon Mastery, charac-           rules for non-human spell casters and undead
Master Players' Book, which expands on the         ters may specialize in the use of certain weap-     command to make the monsters more of a
known abilities of characters, before turning      ons and become more skilled with them,              challenge. Suggestions are given for convert-
to the Dungeon Master's Book. These rules          causing more damage, gaining defense                ing a new monster, the mystic, into a charac-
are written to maintain balanced play at high      bonuses and the skill to perform special            ter class if the D M desires. And finally, the
level. If you discover a contradiction between     maneuvers. The polearm weapon category               awesome Immortals are introduced, with
this set and previous sets, the rules given here   has been subdivided into several new weap-           information for how characters may set out

```

## TSR 1017 - Set 5 Immortals Rules

- Source PDF: `TSR 1017 - Set 5 Immortals Rules.pdf`
- Baseline extractor: `pdftotext -layout`
- Clean extractor: `pdftotext -layout -nodiag -nopgbrk`
- Formfeed count: baseline `100`, clean `0`
- Target hit count: baseline `15`, clean `15`
- Assessment: Immortals extracts cleanly enough that OCR is not warranted. Key spell names remain intact under the cleaner flags.

### Clean Sample

```text
Dice or less).                                                                                        during the duration of the effect.
                                                    when used to find the seventh dimension, or
Delayed Blast Fire Ball: See General Notes          the hiding place of the Old Ones, this effect
                                                                                                      Lightning Bolt: See General Notes (Dam-
(Damage).                                           leads in a random direction.
                                                                                                      age).
Dimension Door: An Immortal may use                 Fireball: See General Notes (Damage).
                                                                                                      Lore: If cast by an Immortal, the effect
this effect normally or may reverse this effect,
                                                    Geas: See Quest.                                  requires only 1-4 rounds or 1-100 turns,
dimension window, to change his or her
                                                                                                      instead of the same numbers of turns or days
dimensional perspective to any other possible       Haste: This affects the physical form only. It
                                                                                                      given in the spell description.

```

## TSR 1071 - The D&D Rules Cyclopedia

- Source PDF: `TSR 1071 - The D&D Rules Cyclopedia.pdf`
- Baseline extractor: `pdftotext -layout`
- Clean extractor: `pdftotext -layout -nodiag -nopgbrk`
- Formfeed count: baseline `305`, clean `0`
- Target hit count: baseline `41`, clean `41`
- Assessment: The clean extractor is the right default for the RC PDF: it preserves the late-book spell-context sections while dropping page-break clutter from the staging output.

### Clean Sample

```text
 Creating Characters . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 145               Making Magical Items . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 250
 Damage to Magical Items . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 145                     Making Magical Constructs . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 253
 Demihuman Clan Relics . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 145                     Making Huge Magical Items . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 254
 Doors . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 147       Spell Research . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 255
 Equipment Not Listed . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 147                    Experience From Spells and Enchanted Items . . . . . . . . . . . . . . . . . 255
 Haste Spell . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 147       Chapter 17: Campaigning . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 256
 Listening . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 147       Campaign Tone and Goals . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 256
 Magic-User Spell Choice . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 147                   Player Character Goals . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 256
 Mapping . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 148         Designing the Setting . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 256
 Multiple Characters . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 148               Adapting the Game to the Setting . . . . . . . . . . . . . . . . . . . . . . . . . . 259
 New Items and Monsters . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 148                      Designing Adventures and Dungeons . . . . . . . . . . . . . . . . . . . . . . . . 259
 Overusing Dice . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 148              Running Adventures . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 261
 Reality Shifts . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 148        Chapter 18: The Planes of Existence . . . . . . . . . . . . . . . . . . . . . . . . . . . 263
 Record Keeping . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 148              Arrangement of the Planes . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 263

```

## Companion flow check: Damage To Magic Items

- Source PDF: `TSR 1013 - Set 3 Companion Set.pdf`
- Flow extractor: `render_tsv_cols_pages_anchored_until`
- Page span: `59-60`
- Start anchor: `Damage To Magic Items`
- Stop anchor: `Demi-Human Crafts`
- Validation status: `pass`
- Assessment: The flow-first helper should recover the complete damage-to-magic-items procedure without bleeding into the following demi-human craft section.

### Flow Sample

```text
Damage To Magic Items
Any item may be damaged by rough treat-
ment. Armor and weapons, however, are
made to withstand a considerable amount of
punishment.
The D M should decide whether an item
might be damaged, based on the item and the
type of attack and then would make an Item
Damage roll.
Some breath weapons (acid, fire, cold)
should require such checks. If the user makes
his Saving Throw against the breath, bonuses
can be applied to the item's roll.
Long falls (1 00 ' or more) should require
checks. Pools of acid, rockslides, and other
cases of extreme damage should require
checks for items carried. A scroll normally
need not be checked except against fire dam-
age; you may also include water damage, if
desired.
Procedures
To check for damage to items, roll ld4 or
ld6 (using ld6 if the chance of damage is
high). If the result is greater than the item's
Strength (number of “plusses”), the item is
damaged. Items without plusses may be
given ratings for this purpose. Consider:
any potion or scroll as a + I item;
any wand or staff as a +2
and all permanent items (such as rods,
rings, and miscellaneous items) as +3.
This roll may be modified; for example, if
a character is hit by a rockslide, Dexterity
adjustments could be applied to the rolls. If a
character tries to break something, Strength
adjustments could be applied. No adjustment
should be greater than +2. However, adjust-
ments to the chance of survival can be any
number of subtractions from the roll. A
potion bottle dropped from a tabletop might
require a check for breakage, but with a -2
adjustment (thus, only a roll of 4 indicating
breakage).
If an item is damaged, it may either be par-
tially damaged or completely destroyed. For
items with magical bonuses, one or more
points may be lost, because of damage,
(DM's choice). Potions, scrolls, and rings
should be completely destroyed by any severe
damage.

```

## Companion flow check: Buying And Selling Magic Items

- Source PDF: `TSR 1013 - Set 3 Companion Set.pdf`
- Flow extractor: `render_tsv_cols_pages_anchored_until`
- Page span: `64-65`
- Start anchor: `B. Buying and Selling Magic Items`
- Stop anchor: `Planning and Placing Treasure`
- Validation status: `pass`
- Assessment: The flow-first helper should recover the full buying/selling procedure and keep the price table attached while stopping before treasure-planning bleed.

### Flow Sample

```text
B. Buying and Selling Magic Items
At some point in your game, the characters
will probably find a magic item that they can-
not use or do not want. They may then try to
sell the item for cash.
This forces you, the Dungeon Master, to
decide two things: whether magic items can
be bought or sold, and where this would
occur.
In a world full of magic, this sort of busi-
ness should exist in some form. But it can eas-
ily get out of control; many items are cursed
or otherwise dangerous. Spells may be used
to create “fakes” (such as a light spell cast on
a normal sword or gem). Any business deal-
ing with magic items should, logically, have
magical means of detecting, and identifying
the worth of the items, and connections with
authorities to be sure that an item is legally
salable, and not stolen. Protection is also
extremely important; a powerful Magic-user
should not be able to loot the local magic
shop.
Thus, the recommended place for this sort
of business is the Magic-user's Guild. The
“shop” should be lined with lead (blocking
most magical effects), and heavily safe-
guarded with magical traps. Apprentices
might be constantly on watch for magical vis-
itors (possibly polymorphed spell effects,
invisible things, and so forth. An invisible
stalker might automatically appear if any
attempt at theft occurs. You may design such
a place to be as tightly secure as you wish. Try
to foresee the possible attempts at deception
and theft, and create means to counter them.
You must also decide on the prices to be
offered for items brought in, the items being
offered for sale, and their prices. Many items
might have limited availability; a powerful
wand would not be freely sold to Chaotics.
You can assume that all powerful items
would be sold to powerful persons. A church
would certainly buy any staff of curing that
appears; rulers are always interested in buy-
ing potions, scrolls, and other items usable by
all classes. Miscellaneous Magic Items would
be extremely rare, and much in demand.
Of all the magic items, potions are the easi-
est to make, and thus the most commonly
found; some might be for sale. Healing and
super-healing potions are those most often
sought by adventurers; other types might be
available as well.
If you wish to have magic items available
for purchase, the following prices are recom-
mended. They are designed for higher level
characters, and for sales in a large city. Fewer
items should be available, and for higher
prices, in smaller places. Items not listed
should not be sold. Note that these are the
prices to be paid by PCs to buy items, not the
prices offered if some are brought in for sale.
ONS
MAGIC ITEM PRICE SUGGES'
Armor
10,000 to 150,000
P
Misc. Item
5,000 to 750,000
P
5,000 to 250,000
Misc. Weapon
P
1,000 to 50,000
Missile
P
Missile Device 10,000 to 250,000
P
Potion

```

## Companion flow check: Scrolls Through Miscellaneous Items

- Source PDF: `TSR 1013 - Set 3 Companion Set.pdf`
- Flow extractor: `render_tsv_cols_pages_anchored_until`
- Page span: `86-91`
- Start anchor: `6. Scrolls`
- Stop anchor: `10. Armor and Shields`
- Validation status: `pass`
- Assessment: The flow-first helper should preserve the spell-catching capacity table and contiguous item-description run without spilling into armor/shield rules.

### Flow Sample

```text
6. Scrolls
Communication: This is actually two
scrolls, one stored inside the other. They are
easily separated. If a message is written on
one scroll, it immediately appears on the
other. There is no limit to the range, as long
as both scrolls are on the same Plane of Exist-
ence. The message may be up to 100 words in
length. If one message is erased, the other
disappears as well. Each message must be
erased before another can be written, and
there is a 5% chance (not cumulative) that
any erasing will destroy the magic of both
scrolls.
Creation: The user of this valuable scroll
may draw a picture of any normal item, up to
5'xlO'xl' in size (though drawn much
smaller), and up to 5,000 cn weight. The item
may then be taken off the scroll and used!
Magic items cannot be created, nor can any
living things, but all types of armor and
weapons (for example) are quite easily cre-
ated. The item will vanish on command of
the creator, or after 24 hours. The scroll can
create one item per day at most.
Curse: The curses given in the D&D
Basic Set are sufficiently nasty for this scroll.
You need not increase their power for higher
level characters.
Delay: This is a scroll of one spell. When
casting the spell from the scroll, the user
states an amount of delay from 0 to 12
rounds. Thereafter, if the user carries the
scroll, the user has complete control of the
spell when it occurs. If the scroll is not carried
by the user, the spell effect appears around
the scroll itself, affecting the nearest creature
if a recipient is required. The spell cannot
affect the scroll, even i f it is a fire-type spell.
For example, an elf reads a delay lightning
bolt scroll, delaying it 8 rounds, and then
puts the scroll away. Eight rounds later, when
the lightning bolt actually appears, the elf
may choose the range and direction by mere
concentration, as if casting the spell at that
time.
Equipment: This parchment is inscribed
with the names of 6 normal items (which the
DM selects or randomly determines, using
the standard equipment list). When any
item's name is read aloud, the item appears
within 10' of the scroll, and the name disap-
pears. The item will remain for 24 hours, or
until the user commands it to vanish. The
name reappears on the scroll when the item
vanishes. Any 3 of the 6 items can be created
each day.
Illumination: This scroll bears the draw-
ing of a flame. If the scroll is set afire, it will
burn with a clear light in a 60' radius, lasting
for up to 6 hours per day. The burning does
not harm the scroll, but is nevertheless “nor-
mal” fire (and can be used to light torches,
for example). The flame cannot be extin-
guished except by water or on command of
the user; any wind, normal or magical, can-
not even cause it to flicker. This item may
already be lit when found.
Mages (spell caster only): This scroll is
blank; it is used to identify magical effects.
The user may hold the scroll and command it
to identify any one chosen magical effect
within 30 ' . The name of the magic spell or
effect then appears on the scroll, along with
the level of the caster of the spell effect. The
scroll will identify one magical effect per day.
Map: Treasure Maps are described in the
D&D Expert Set. Based on the type of trea-
sure given, the DM should select a challeng-
ing monster with a similar treasure type, and

```

## Companion flow check: Demi-Human Crafts

- Source PDF: `TSR 1013 - Set 3 Companion Set.pdf`
- Flow extractor: `render_tsv_col_pages_anchored_until`
- Page span: `59-61`
- Column: `3`
- Start anchor: `Demi-Human Crafts`
- Stop anchor: `Hit Points Maximum`
- Validation status: `pass`
- Assessment: The right-column TSV helper should recover the full demi-human crafting section while stopping before the Hit Points Maximum section.

### Flow Sample

```text
Demi-Human Crafts
The rules which follow are for D M and NPC
use only; no player character can participate
in the construction of these famous, but
incredibly rare items. You may place one or
more of these in a campaign, but very few
should exist, if at all. Each requires centuries
of work to create, and should be treated with
appropriate awe and respect by the demi-
human clan involved.
Details on rewards for the recovery of lost
or stolen clan devices are given in each char-
acter class description.
Dwarf: By using the Forge of Power, the
Keeper, Clanmaster, and several dwarven
blacksmiths (all of maximum level) can work
together to construct a dwarven lens-a sheet
of pure gold, gently hammered out to perfect
paper-thin texture. This is a long task; it
must be worked slowly and carefully, and
requires centuries to complete (800-1,000
years). The completed lens is a 10' diameter
disk, mounted in a ring of pure gemstone,
and is used only to create oil of darkness.
The lens actually concentrates and distills
darkness itself to form the oil, and can only
create one ounce per year if left in complete
darkness throughout the year; any light will
spoil the entire hatch.
Oil of darkness, in turn, is used to make
rockships, famous but extremely rare magi-
Hit points for demi-humans are limited by
their maximum levels (halflings 8, elves 10,
dwarves 12). Halflings and elves use ld6 per
level, dwarves ld8; thus, with 18 Constitu-
tion, the most possible hit points for maxi-
mum level demi-humans are:
Dice Con. L 10- Maximum
RollsBonus 12
Total
~~
~
~~
~
+9
72
27
108
Dwarf
54
27
+2
83
Elf
-
48
24
72
Halfling
Note that a halfling can have about halfas many hit
points as a fighter; that a dwarf can be as tough as a
36th level cleric; and that elves and magic-users
have similar numbers of hit points at maximum
level.
Poison
Poison is a dangerous tool. If characters are
permitted to use poison, monsters should be
able to do the same. And there are far more
monsters than characters.. .
A potion is the most common form of poi-
son. Its effects when used on blowgun darts
(see Players Book, page 3) are recommended
as a maximum for use on any weapon.
any weapon.
You may wish to make poisons of lesser
power available, lacking the strength to kill,
but able to paralyze, intoxicate, sleep, andlor
inflict slight damage.
Many natural plants are mildly poisonous,
and saps or boiled leaves could yield poisons

```

## Companion flow check: Poison

- Source PDF: `TSR 1013 - Set 3 Companion Set.pdf`
- Flow extractor: `render_tsv_col_pages_anchored_until`
- Page span: `60-61`
- Column: `3`
- Start anchor: `Poison`
- Stop anchor: `Hit Roll Charts`
- Validation status: `pass`
- Assessment: The right-column TSV helper should recover the poison procedure while stopping before the Hit Roll Charts section.

### Flow Sample

```text
Poison
Poison is a dangerous tool. If characters are
permitted to use poison, monsters should be
able to do the same. And there are far more
monsters than characters.. .
A potion is the most common form of poi-
son. Its effects when used on blowgun darts
(see Players Book, page 3) are recommended
as a maximum for use on any weapon.
any weapon.
You may wish to make poisons of lesser
power available, lacking the strength to kill,
but able to paralyze, intoxicate, sleep, andlor
inflict slight damage.
Many natural plants are mildly poisonous,
and saps or boiled leaves could yield poisons
usable on weapons. However, poison prepa-
ration is not common knowledge, and the
danger of error is high (including the acciden-
tal poisoning of the maker).
The poison used by poisonous monsters
comes from poison sacs or glands within the
creature's body. After defeating a poisonous
monster, some of the characters in your game
may try to get and use the poison.
The following method of controlling this
unsavory practice is recommended. Monster
poison should only remain potent while in the
creature, becoming useless 1-10 rounds after
exposure to air. Only a specially prepared
potion ofpoison can last for a longer period.
An intact poison sac (a rare thing after a
swordfight!) should remain useful for only 1-
10 rounds per Hit Die of the monster. Unpre-
pared (non-potion) poison placed on a
weapon becomes non-poisonous after 1-10
rounds of exposure to air.
The poisonous touch of certain powerful
Undead creatures (spirit in this set) cannot be
collected or used.
The use of poison is evil, and may cause
alignment problems. Local and regional laws
may punish poisoners.

```

## Companion flow check: Magic-Item Tables

- Source PDF: `TSR 1013 - Set 3 Companion Set.pdf`
- Flow extractor: `render_layout_pages_anchored_until`
- Page span: `81-84`
- Start anchor: `3b. Types of Jewelry`
- Stop anchor: `10. Armor or Shield`
- Validation status: `pass`
- Assessment: The layout-anchored helper should recover the 81-84 magic-item table run without falling back to pasted witness text.

### Flow Sample

```text
  3b. Types of Jewelry                  5. Potion                                 6. Scroll

         TYPES OF JEWELRY                     d%         Type of Potion               d%      Type of Scroll
            Value (in gp)
                                             01-02       Agility                     0 1-03   Communication
  100-3,000               15,000-              03        Animal Control              04-05    Creation
    ldlO    4,000-10,000  50,000
                                             04-06      Antidote                     06- 13   Curse (occurs when read; B)*
  Common     Uncommon      Rare
                                             07-08       Blending                      14     Delay (S)
 1 Anklet   Armband         Amulet           09- 10     Bug Repellant                15-17    Equipment
 2 Beads    Belt            Crown
                                             11-12                                   18-19    Illumination
                                                        Clairaudience
 3 Bracelet Collar          Diadem
                                             13-14      Clairvoyance                 20-21    Mages (S)
 4 Brooch Earring           Medallion
 5 Buckle Four-leaf         Orb              15-16      Climbing                     22-25    Map to Normal treasure (B)'
             Clover                          17-18      Defense                      26-28    Map to magical treasure (B)*
 6 Cameo Heart              Ring             19-20      Diminution B)                29-30    Map to combined treasure (X)'
 7 Chain    Leaf            Scarab          2 1-24      Delusion (X)                   31     Map to special treasure (X)'
 8 Clasp    Necklace        Scepter           25        Dragon Control               32-34    Mapping
 9 Locket Pendant           Talisman        26-27       Dreamspeech                  35-36    Portals
10 Pin      Rabbit's Foot   Tiara             28        Elasticity                   37-42    Protection from Elementals (X)
                                            29-30       Elemental form               43-50    Protection from Lycanthropes (B)
                                            31-32       ESP (B)                      51-54    Protection from Magic (X)
                                              33        Ethereality                  55-61    Protection from Undead (B)
                                            34-36       Fire Resistance (X)          62-63    Questioning
                                            37-39       Flying (X)                    64      Repetition (S)
                                            40-41       Fortitude                    65-66    Seeing
                                              42        Freedom                      67-68    Shelter
                                              97        Treasure Finding (X)         69-7 1   Spell Catching
                                            43-45       Gaseous Form (B)             72-96    Spells (see be!ow)*
                                              46        Giant Control (X)'           97-98    Trapping
                                            47-49       Giant Strength (X)           99-00    Truth
                                            50-51       Growth (B)
                                                                                  * More information is given in this set
                                            52-57       Healing (B)
                                            58-60       Heroism (X)
                                              61        Human Control (X)
                                            62-64       Invisibility (B)
                                                                                             SPELL SCROLLS
                                            65-66       Invulnerability (X)
                                                                                   6a. Typeof         6b. Level of
                                            67-68       Levitation (B)
                                                                                      Scroll              Spell
                                            69-70       Longevity (X)*
                                                                                                 Cleric
4. All Magic Items                            71        Luck
                                                                                                   or             Spell
                                              72        Merging
                                                                                  d%    Type     Druid M-U Level
                                            73-74       Plant Control (X)
           MAGIC ITEM TYPE                  75-77       Poison (B)                01-70    Magic-
    d%       Use Table:
                                            78-80       Polymorph Self (X)                 User        01-34     01-28      1
   01-25      5. Potion                     81-82       Sight                     71-95    Cleric      35-58     29-49      2
   26-37      6. Scroll                     83-84.      Speech                    96-00    Druid       59-76     50-64      3
   38-46      7. Wand, Staff, or Rod
                                            85-88       Speed (X)                                      77-88     65-75      4
   47-52      8. Ring
                                            89-90       Strength                                       89-95     76-84      5
   53-62      9. Misc. Magic Item

```

