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
 6 tinder box torches        Rope (50‘)        1 waterskin (full)     1 wineskin (full)       See page 43 for special abilities and
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
not fit the character’s Alignment or beliefs,           2. Cure Blindness                                    2. Create Water
the cleric may be punished by the church                3. Cure Disease*                                     3 . Cure Serious Wounds*
- or even greater powers. This punish-                  4.Growth of Animals                                  4. Dispel Magic
ment could, for example, be a penalty on                5. Locate Object                                     5. Neutralize Poison*
Hit rolls, a dangerous quest that must be               6. Remove Curse*                                     6. Protection from Evil 10’radius
completed, or even a lack of spells. Your               7. Speak with the Dead                               7. Speak with Plants
DM will tell you what the character must                8. Striking                                          8. Sticks to Snakes
do to recover good standing.
                                                      F I l T H LEVEL CLERIC SPELLS                        SIXTH LEVEL CLERIC SPELLS
   When a cleric reaches Name level, a cas-              1. Commune                                          1. Animate Objects
tle may be built. If the cleric has never been          2. Create Food                                       2. Find the Path
punished for misbehavior, the cleric’s                  3 . Dispel Evil                                      3. Speak with Monsters*
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
destined to be. Then, in the Companion Set,           The Master Players’ Book completes the           tions to help a D M with his record keeping.
you climbed to the pinnacle of success and         listing of skills and abilities for all character   The section on modifying encounters and
founded kingdoms, conquering the wild              classes. Especially noteworthy are the many         monsters to meet the DM’s goals includes a
lands and battling barbarian hordes. Now, in       new high-level spells, including the most           short method for determining the balance
the Master Set, you can soar across the sky        potent spell known to man, the wish.                and challenge of an encounter. Expanded
and into the pages of legend.                         Then there are several new optional sys-         experience awards are provided for use with
    These books are written for the experi-        tems offered, including Weapon Mastery and          higher-level monsters. Also introduced are
enced D&D@ player. Begin by reading the            Siege Warfare. In Weapon Mastery, charac-           rules for non-human spell casters and undead
Master Players’ Book, which expands on the         ters may specialize in the use of certain weap-     command to make the monsters more of a
known abilities of characters, before turning      ons and become more skilled with them,              challenge. Suggestions are given for convert-
to the Dungeon Master’s Book. These rules          causing more damage, gaining defense                ing a new monster, the mystic, into a charac-
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

