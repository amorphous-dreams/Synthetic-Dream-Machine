# TODO: BECMI Spell Material Staging - Master

This staging document captures spell material and associated magical-context text from `TSR 1021 - Set 4 Master Rules.pdf`.

Rules for this artifact:
- Raw classic terminology is preserved.
- This is a staging artifact, not a final crosswalk.
- `pdftotext -layout -nodiag -nopgbrk` remains the primary extractor unless a section note says otherwise.
- Parser warnings from PDF extraction stderr were suppressed and are not part of this document.
- Section methods may mix anchored line slices, page-layout extraction, cropped columns, TSV reflow, and small curated stitching when that is necessary to preserve reading order.
- Cleanup is conservative: spacing, OCR scars, and broken line wraps may be normalized, but source terminology is not converted.

Source PDF:
- `TSR 1021 - Set 4 Master Rules.pdf`

## Table Check QA Pass

- Status: reviewed 2026-03-22
- Scope checked: cleric and magic-user experience tables, saving throw matrices, turning tables, and artifact power tables.
- Result: the top cleric and magic-user matrices are now reconstructed into readable text tables, and no blocking row/column defects remain in the reviewed Master table regions.
### Master Cleric, Druid, and Magic-User Spell Material

- Extraction note: section-aware Master spell extraction using anchored TSV reflow across the actual cleric, druid, and magic-user pages instead of one broad line-range block. The section is split into cleric, druid, and magic-user sub-blocks so high-level spell lists and descriptions remain attached to the right class pages.

```text
[Master pages 5-6: cleric spell material]
Cleric
All rules on spell casting are given in the
D&D Basic and Expert sets.
Any spell marked with an asterisk (*) may
be reversed, as given in the spell description.
Any reversible cleric spell may be reversed
during the casting and need not be memo-
rized in reversed form.
Each spell in the list below is followed by a
reference to the full text of the spell. C =
D&D Companion Set Players Manual
(page number for the 1984 edition).

CLERIC EXPERIENCE TABLE
Spells by Spell Level

Level  XP         1  2  3  4  5  6  7
26     1,900,000  8  7  7  6  6  5  5
27     2,000,000  8  8  7  6  6  6  5
28     2,100,000  8  8  7  7  7  6  5
29     2,200,000  8  8  7  7  7  6  6
30     2,300,000  8  8  8  7  7  7  6
31     2,400,000  8  8  8  8  8  7  6
32     2,500,000  9  8  8  8  8  7  7
33     2,600,000  9  9  8  8  8  8  7
34     2,700,000  9  9  9  8  8  8  8
35     2,800,000  9  9  9  9  9  8  8
36     2,900,000  9  9  9  9  9  9  9

Hit points: +1 per level, with no Constitution effect.

CLERIC SAVING THROW TABLE

Category               25-28  29-32  33-36
Death Ray or Poison    3      2      2
Magic Wands            4      3      2
Paralysis or Stone     4      3      2
Dragon Breath          4      3      2
Rod, Staff, or Spell   4      3      2

CLERIC TURNING UNDEAD TABLE

Undead      25-28  29-32  33-36
Skeleton    D#     D#     D#
Zombie      D+     D#     D#
Ghoul       D+     D+     D#
Wight       D+     D+     D+
Wraith      D+     D+     D+
Mummy       D+     D+     D+
Spectre     D      D+     D+
Vampire     D      D      D
Phantom     D      D      D
Haunt       D      D      D
Spirit      D      D      D
Nightshade  D      D      D
Lich        T      T      T
Special     T      T      T

T   automatic Turn, 2d6 Hit Dice of undead
D   automatic Destroy, 2d6 Hit Dice
D+  automatic Destroy, 3d6 Hit Dice
D#  automatic Destroy, 4d6 Hit Dice

SEVENTH-LEVEL CLERIC SPELLS
1. Earthquake (C13)
2. Holy Word (C13)
3. Raise Dead Fully* (C13)
4. Restore* (C13)
5. Survival (described below)
6. Travel (described below)
7. Wish (page 4)
8. Wizardry (page 4)
Survival
Range: Touch
Duration: One hour per level of the caster
Effect: Protects one creature against all non-
magical damage from the environment
Characters - Cleric
This spell protects the recipient from
adverse conditions of all types, including nor-
mal heat or cold, lack of air, and so forth.
While the spell is in effect, the caster needs no
air, food, water, or sleep. The spell does not
protect against magical damage of any type,
breath weapons, or blows from creatures. It
does protect against all damage caused by
natural conditions on other planes of exist-
ence. Examples: A cleric might use this spell
in a desert or blizzard, preventing any dam-
age from the natural conditions; under-
ground or underwater, enabling survival
without air; or in space, to magically survive
in vacuum.
Travel
Range: 0
Duration: One turn per level of the caster
Effect: Allows aerial or gaseous travel
This spell allows the cleric to move quickly
and freely, even between the planes of existence.
The caster (only) may fly in the same manner as
given by the magic-user spell, with a movement
rate of 360 feet (120 feet).
The cleric can also enter a nearby plane of
existence, simply by concentrating for one
round. A maximum of one plane per turn may
be entered. If desired, the cleric may bring one
other creature for each five levels of experience
(rounded down; for example, a 29th-level cleric
could bring five other creatures on the journey).
All others to be affected must be touching or
touched by the cleric while the spell is cast and
the shift is made. Any unwilling creature may
make a Saving Throw vs. Spells to avoid the
effect. The cleric must take the others, and can-
not send them while remaining behind.
While this spell is in effect, the caster (only)
may assume gaseous form by concentrating for
one full round. (If interrupted, no change
occurs.) Unlike the potion effect, all equipment
carried also becomes part of the same gaseous
cloud. In this form, the caster may travel at
double the normal flying rate: 720 feet per turn
(240 feet per round). While gaseous, the cleric
cannot use items or cast spells, but also cannot
be damaged except by magic (weapons or cer-
tain spells). Also, a gaseous being cannot pass
through a protection from evil spell effect or an
anti-magic shell.

[Master pages 6-7: druid spell material]
Characters - Cleric, Druid
Wish
Range: Special
Duration: Special
Effect: Special
A wish spell is usable only by a cleric of
36th- (maximum) level with 18 (or greater)
Wisdom.
A wish is the single most powerful spell a
cleric can have. It is never found on a scroll,
but may be placed elsewhere (in a ring, for
example) in rare cases.
Extensive guidelines for wishes are given
on page 10, with the magic-user spell descrip-
tion.
Wizardry
Range: 0 (cleric only)
Duration: One turn
Effect: Allows the use of one magic-user
scroll spell or one device
By using this spell, the cleric gains the
power to use one item normally restricted to
magic-users: either a device (such as a wand)
or a scroll containing a 1st- or 2nd-level
magic-user spell. (Spells of 3rd or higher level
cannot be cast, though they may be present
on the scroll.) This ability lasts for one turn,
or until the scroll or device is used. The cleric
magically gains knowledge of the proper use
of the item, as if the character were a magic-
user. For the duration and effect of the magic-
user spell, the level of caster is treated as the
minimum necessary for the casting of the
spell.
Druid
FIRST-LEVEL DRUID SPELLS
1. Detect Danger (described below)
2. Faerie Fire (C14)
3. Locate ((215)
4. Predict Weather (C15)
SECOND-LEVEL DRUID SPELLS
1. Heat Metal (described below)
2. Obscure (C15)
3. Produce Fire ((215)
4. Warp Wood (C15)
THIRD-LEVEL DRUID SPELLS
1. Call Lightning ((215)
2. Hold Animal (C15)
3. Protection from Poison (page 5)
4. Water Breathing (C15)
FOURTH-LEVEL DRUID SPELLS
1. Control Temperature 10' radius (C15)
2. Plant Door ((215)
3. Protection from Lightning ((215)
4. Summon Animals (page 5)
FIFTH-LEVEL DRUID SPELLS
1. Anti-Plant Shell (C16)
2. Control Winds (C16)
3. Dissolve (page 5)
4. Pass Plant ((216)
SIXTH-LEVEL DRUID SPELLS
1 . Anti-Animal Shell (C16)
2. Summon Weather ((216)
3. Transport Through Plants (C16)
4. Turn Wood (page 5)
SEVENTH-LEVEL DRUID SPELLS
1. Creeping Doom (C16)
2. Metal to Wood (C16)
3. Summon Elemental (page 5)
4. Weather Control ((216)
First-Level Druid Spell
Detect Danger
Range: 5 feet per level of the caster
Duration: One hour
Effect: Reveals hazards
This spell combines some effects of detect
evil and find traps. While it is functioning,
the druid can concentrate on places, objects,
or creatures within range. A full round of
concentration is needed to examine one
square foot of area, one creature, or one small
object (a chest, weapon, or smaller item).
Larger objects require more time. After
examining the thing, the druid will know
whether it is immediately dangerous, poten-
tially dangerous, or benign (all strictly from
the druid's point of view). Note that most
creatures are potentially dangerous. This
spell will detect poisons, while other spells
may not. The spell duration is a full hour
when used in natural outdoor settings on the
Prime Plane; elsewhere, the duration is half
normal (three turns).
Second-Level Druid Spell
Heat Metal
Range: 30 feet
Duration: 7 rounds
Effect: Warms one metal object
This spell causes one object to slowly heat
and then cool. It will affect one metal item
weighing up to 5 cn per level of the caster. A
12th-level druid, for example, can heat a nor-
mal sword, but a 20th-level druid can heat a
two-handed sword, and a 36th-level druid, a
lance.
The heat causes no damage to magical
items. Normal weapons or other items may
be severely damaged, especially if made of
wood and metal (as a normal lance), as the
wood will burn away.
If the object is held, the heat causes dam-
age to the holder: one point during the first
round, 2 in the second, 4 in the third, 8 in the
fourth, and then decreasing at the same rate
(for a total of 22 points of heat damage over
seven rounds.) No saving throw is allowed,
but fire resistance negates all damage. The
item may be dropped at any time, of course,
and creatures of low intelligence are 80%
likely to do so (check each round). In the
fourth round, the searing heat will cause
leather, wood, paper, and other flammable
objects in contact with the metal to catch fire.
Once the spell has been cast, no concentra-
tion is needed; the heating and cooling pro-
ceed automatically. A dispel magic can stop
the effect, but normal means (immersion in
water, etc.) will not.
If used on an item imbedded in an oppo-
nent (such as an arrow or dagger), the crea-
ture may remove the item but loses initiative
for that round (and takes the appropriate heat
damage as well). Note that heat damage dis-
rupts concentration; the victim cannot cast
spells during any round in which damage is
inflicted by this spell.
Third-Level Druid Spell
Protection from Poison
Range: Touch
Duration: One turn per level of the caster
Effect: Gives one creature immunity to all
poison
For the duration of this spell, the recipient
is completely immune to the effects of poisons
of all types, including gas traps and cloudkill
spells. This protection extends to items car-
ried (thus protecting against a spirit's poison-
ous presence, for example). Furthermore, the
recipient gains a + 4 bonus on Saving
Throws vs. Poisonous Breath weapons (such
as green dragon breath) but not petrification
breath (such as a gorgon's).
Fourth-Level Druid Spell
Summon Animals
Range: 360 feet
Duration: 3 turns
Effect: Calls and befriends normal animals
With this spell, the druid can summon any
or all normal animals within range. Only
normal, non-magical creatures of animal
intelligence are affected, excluding insects,
arthropods, humans, and demi-humans but
including mammals, reptiles, amphibians,
etc. The druid may choose one or more
known animals, may call for specific types, or
may summon everything within range. The
total Hit Dice of the animals responding will
equal the level of the druid. Treat normal
small creatures (frogs, mice, squirrels, small
birds, etc.) as l/io Hit Die each.
Animals affected will come at their fastest
movement rate, and will understand the
druid's speech while the spell is in effect.
They will be friends of and will help the
druid, to the limit of their abilities. If harmed
in any way, a summoned animal will nor-
mally flee, the spell broken for that animal.
However, if the druid is being attacked when
a summoned animal arrives, the animal will
immediately attack the opponent, fleeing
only if a Morale Check is failed.
This spell may be used to calm hostile ani-
mals encountered while adventuring.
Fifth-Level Druid Spell
Dissolve*
Range: 240 feet
Duration: 3-18 days
Effect: Liquefies 3,000 square feet
Nearly identical to the magic-user spell,
this effect changes a volume of soil or rock
(but not a construction) to a morass of mud.
An area up to 10 feet deep or thick is affected,
and may have up to 3,000 square feet of sur-
face area. The druid may choose the exact
width and length (20' x 150', 30' x loo',
etc.), but the entire area of effect must be
within 240 feet of the caster. Creatures mov-
ing through the mud are slowed to 10% of
their normal movement rate at best, and may
become stuck.
The reverse of this spell, harden, changes
the same volume of mud to rock, but permanently. A victim in the mud may make a Sav-
ing Throw vs. Spells to avoid being trapped.
Sixth-Level Druid Spell
Turn Wood
Range: 30 feet
Duration: One turn per level of the druid
Effect: Pushes all wooden items away
This spell creates an invisible wave of force,
120 feet long and 60 feet tall. Its midpoint can
be created anywhere within 30 feet of the caster.
This wave of force then immediately moves in
one horizontal direction, as specified by the
caster, at the rate of 10 feet per round. If
desired, the force wall can be stopped at any
time, but cannot thereafter be moved.
all wooden objects contacting or contacted
by the wave of force become stuck to it and
move with it. The wave of force continues mov-
ing until the maximum range (360 feet) is
reached, and stops there for the remainder of
the spell duration. The items caught are not
harmed by the effect, but wooden weapons
(bows, crossbows, most spears and javelins,
etc.) and magic items (wands, staves, etc.) can-
not be used while trapped in the effect.
Once created, the wave of force does not
require concentration. However, the caster
may cause it to vanish before the duration
ends by concentrating for one round.
This spell has many useful applications
during mass combat (against a group of
Characters - Druid
archers) and waterborne adventures (to move
a ship). However, it will not move permanent
constructions (such as buildings) or other
secured objects (such as trees).
Seventh-Level Druid Spell
Summon Elemental
Range: 240 feet
Duration: 6 turns
Effect: Summons one 16 H D elemental
This spell allows the caster to summon any
one elemental per spell (see D&D Expert
Rulebook, page 49). Only one of each type of
elemental (air, earth, fire, water) may be
summoned in one day. The elemental will
understand the druid's spoken commands
and will perform any tasks within its power
(carrying, attacking, etc.) as directed by the
caster. Unlike the magic-user spell, no con-
centration is needed to control the creature.
It may be sent back to its own plane on com-
mand of the caster, or by the use of a dispel
magic or dispel evil spell.

[Master pages 8-10: magic-user spell material]
Magic-user
All details on spell casting are given in the
D&D Basic and Expert sets. Any spell
marked with an asterisk (*) may be reversed,
as given in the spell description. All reversible
magic-user spells must be memorized in
reversed form to be used.
C = D&D Companion Set Players Manual
(page number for the 1984 edition).

MAGIC-USER SAVING THROW TABLE

Category                    25-27  28-30  31-33  34-36
Death Ray or Poison         4      3      3      2
Magic Wands                4      4      3      2
Paralysis or Turn to Stone 5      4      3      2
Dragon Breath              4      3      2      2
Rod, Staff, or Spell       5      4      3      2

Special Note: Any damage-causing spell can produce a maximum of 20 dice (of whatever type is applicable) of damage.

MAGIC-USER EXPERIENCE TABLE
Spells by Spell Level

Level  XP         1  2  3  4  5  6  7  8  9
26     2,850,000  7  7  7  6  6  5  5  4  3
27     3,000,000  7  7  7  6  6  5  5  5  4
28     3,150,000  8  8  7  6  6  6  6  5  4
29     3,300,000  8  8  7  7  7  6  6  5  5
30     3,450,000  8  8  8  7  7  7  6  6  5
31     3,600,000  8  8  8  7  7  7  7  6  6
32     3,750,000  9  8  8  8  8  7  7  7  6
33     3,900,000  9  9  9  8  8  8  7  7  7
34     4,050,000  9  9  9  9  8  8  8  8  7
35     4,200,000  9  9  9  9  9  9  8  8  8
36     4,350,000  9  9  9  9  9  9  9  9  9

Hit points: +1 per level, with no Constitution effect.

EIGHTH-LEVEL MAGIC-USER SPELLS
1. Clone (described below)
2. Create Magical Monsters (page 7)
3. Dance (C24)
4. Explosive Cloud (C24)
5. Force Field (page 8)
6. Mass Charm* (C24)
7. Mind Barrier* (C24)
8. Permanence (C25)
9. Polymorph Any Object (C25)
10. Power Word Blind (C25)
11. Symbol (C25)
12. Travel (page 8)

NINTH-LEVEL MAGIC-USER SPELLS
1. Contingency (page 8)
2. Create Any Monster (page 8)
3. Gate* (C26)
4. Heal (page 9)
5. Immunity (page 9)
6. Maze (C26)
7. Meteor Swarm (C26)
8. Power Word Kill (C26)
9. Prismatic Wall (page 9)
10. Shapechange (page 9)
11. Timestop (page 10)
12. Wish (page 10)
Clone
Range: 10 feet
Duration: Permanent
Effect: Grows one duplicate creature from a
piece of the original creature
A clone is an exact duplicate of another liv-
ing creature, grown from a piece of the origi-
nal by using this spell. The piece need not be
alive at the time the spell is cast.
A human or demi-human clone is rare and
may be very dangerous. A clone of any other
living creature is a more common thing called
a simulacrum. A character can have only one
clone at a time; attempts at making multiple
clones of a single character automatically fail.
Undead and constructs cannot be cloned,
because they are not living creatures.
Human and demi-human clones: To cre-
ate a human or demi-human clone, this spell
must be cast on one pound of the original's
flesh. The cost of other materials used in
making the clone is 5,000 gp per Hit Die of
the original. The clone awakens only when
fully grown; this takes one week per Hit Die
of the original. When completed, the clone is
not magical and cannot be dispelled.
If the human or demi-human original is not
alive when the clone awakens, the clone has all
the features, statistics (abilities), and memo-
ries possessed by the original at the time the
flesh was taken. This is a very important
point. For example, a 20th-level magic-user
might leave a pound of flesh with a scroll of this
spell, so that he might be restored if lost; but if
the character gains another ten levels of expe-
rience and then dies, the clone will be the
younger, less-experienced, 20th- level form.
If a clone duplicates a living person, or if
the dead original regains life, a very hazard-
ous situation develops. Each form instantly
becomes aware of the other's existence. A
partial mind-link exists between them; each
can feel the other's emotions (but no other
thoughts). If either form is damaged, the
other takes the same damage (but may make
a Saving Throw vs. Spells to take half dam-
age). This effect does not apply to charm,
sleep, cures, or other effects that do not cause
damage. The clone is immediately obsessed
with the need to destroy its original and will
do anything to accomplish this. From the
time a clone becomes aware of its original, it
has one day per level of its creator (the caster
of the clone spell) to succeed. If it succeeds, it
lives in peace; but if it fails, it becomes
insane.
When a clone goes insane, the original
creature permanently loses one point of Intel-
ligence and one point of Wisdom. The origi-
nal may also thereafter become insane (5%
chance per day, not cumulative). If this
occurs, the victim and the clone die one week
later, both forever dead and unrecoverable
even with a wish.
Special Note: If the original and the clone
are kept on different planes of existence, no
mind-link occurs, and the two preceding par-
agraphs do not apply. No ill effects occur, and
the two remain completely unaware of their
situation. If they ever occupy the same plane,
the mind-link occurs and cannot be broken
thereafter except by the destruction of the
clone or its original.
Other clones: A clone of any other living
creature (not a human or demi-human) is
called a simulacrum. One percent of the orig-
inal's flesh is needed, and the cost of other
materials is 500 gp per hit point of the origi-
nal. As with a normal clone, the time
required to grow a simulacrum is one week
per Hit Die of the original.
A simulacrum always obeys its creator (the
spell caster). It understands all the languages
spoken by the caster. Within a range of 10 feet
per level of the caster, it can receive mental
commands if the creator concentrates on
sending them. A simulacrum is an enchanted
monster. It can be blocked by a protection
from evil spell and is magical; a dispel magic
spell can (subject to chances of failure) cause
it to vanish without a trace.
The simulacrum's alignment is the same as
that of the spell caster, regardless of the origi-
nal's alignment. Its Armor Class, movement
rate, morale, and number of attacks are the
same as the original's.
A simulacrum has only 50% of the origi-
nal's Hit Dice, hit points, and damage per
attack. The DM rolls dlOO for each special
ability; it is present in the simulacrum if the
result is 01-50. However, a freshly grown
simulacrum never has any of the spells or
spell-like abilities of the original.
If the original creature is alive, the simula-
crum does not grow beyond this point. If the
original creature dies (or is already dead), the
simulacrum continues to increase in abilities,
gaining an additional 5 % per week to a maxi-
mum of 90% of the original's statistics.
When complete, the DM rolls again to see
which special abilities previously missing are
gained, including spells and spell-like abilities (using the 90% chance for each; all may
be present).
Create Magical Monsters
Range: 60 feet
Duration: 2 turns
Effect: Creates one or more monsters
This spell is similar to the 7th-level create
normal monsters spell, except that monsters
with some special abilities (up to two aster-
isks) can be created. The range and duration
are double those of the lesser spell. All other
details are the same: the creatures are chosen
by the caster, appear out of thin air, and
vanish at the end of the spell duration.
Characters - Magic-User
The total number of Hit Dice of monsters
appearing is equal to the level of the magic-
user casting the spell. Humans and demi-
humans may not be created by this spell, but
undead are permitted. Creatures of 1-1 Hit Die are counted as 1 Hit Die; creatures of 1/2 Hit Die or less are counted as 1/2 Hit Die each.
Special Note: To create a construct (as
defined in the Companion Set DM's Book,
page 21), the proper materials must be used
with this spell. Only one construct will
appear, regardless of the caster's Hit Dice;
but it is permanent, and does not vanish at
the end of the spell duration. The construct,
however, may have only two asterisks (special
abilities) or less. The cost of materials is a
minimum of 5,000 gp per asterisk (or more,
depending on your campaign).
Characters - Magic-User
Force Field
Range: 120 feet
Duration: 6 turns
Effect: Creates an invisible barrier
This spell creates an invisible, immovable
barrier or object of pure force. It has almost
no thickness, but cannot be broken or
destroyed by any means except a disintegrate
spell or a wish; even a dispel magic cannot
affect it. A force field's shape is limited to a
sphere, part of a sphere, a flat surface, a cyl-
inder, a square or rectangular box with flat
sides, or part of such a box. The sphere's
radius can be a maximum of 20 feet. The flat
surface or combinations thereof may be up to
5,000 square feet in total area. The fbrce field
cannot be irregular in shape, and its surface
must be perfectly smooth. There is no mini-
mum size.
The force field will not appear within any
solid or creature. Any part of it that would do
so will not appear, leaving a hole in the force
field. Furthermore, the edges of the field are
blunt and cannot cause damage in any way.
The force field will stay where it is put until it
disappears, and cannot be moved by any
means but a wish.
Any creature(s) completely enclosed by a
sealed force field will not starve, suffer from
lack of air, or otherwise be harmed by the
encasement. A sealed force field magically
preserves any within it from natural death.
This does not prevent damage or death from
attacks by others within the force field.
Nothing can pass through a force field.
Spells, missiles, blows, breath weapons, and
all other attack forms will merely bounce off
when contacting it. However, a teleport or
dimension door spell effect can bypass it;
these spells ailow the caster to step out of nor-
mal existence, re-entering elsewhere. The
force field exists only on one plane of exist-
ence. Thus, planar travel (via gate or other
means) can also bypass it.
Though most often used as a barrier or
cage, a force field can easily be used to create
an invisible floor, stairway, chair, or other
object. A force fieldcan be made permanent,
but the permanence spell effect is still subject
to dispel magic, and if removed, the force
field disappears immediately. Despite perma-
nence, a force field will always vanish if
struck by a disintegrate spell effect or wished
away.
Travel
Range: 0 (caster only)
Duration: One turn per level of the caster
Effect: Allows aerial or gaseous travel
This spell allows the magic-user to move
quickly and freely, even between the planes of
existence.
The caster (only) may fly in the same man-
ner as given by the magic-user spell, with a
movement rate of 360 feet (120 feet), and
may also enter a nearby plane of existence by
concentrating for one round. A maximum of
one plane per turn may be entered. The
caster may bring one other creature for each
five levels of experience. See the cleric travel
spell.
While this spell is in effect, the caster may
assume gaseous form by concentrating for
one full round. (If interrupted, no change
occurs.) Unlike the potion effect, all equip-
ment carried also becomes part of the same
gaseous cloud. In this form, the caster may
travel at double the normal flying rate: 720
feet per turn (240 feet per round).
While gaseous, the magic-user cannot use
items or cast spells, but also cannot be dam-
aged except by magic (weapons or certain
spells). Also, a gaseous being cannot pass
through a protection from evil spell effect or
an anti-magic shell.
Ninth-Level Magic-User Spells
Contingency
Range: Touch
Duration: Indefinite (see below)
Effect: Prepares one other spell
This powerful spell acts as a trigger for one
stated magic-user spell of 4th level or less that
does not normally cause damage. While cast-
ing a contingency spell, the magic-user must
describe one situation. When that situation
next occurs, the second spell effect stated
appears automatically and immediately, as if
cast at that time.
Examples of proper use:
"When I am touched or struck by any liv-
ing creature that is not a Lawful or Neutral
cleric, except for my friends Charlie
McGonigle and Sally Silvernose (contin-
gency), then charm monster on the creature
touching or striking me (spell effect)."
"When I have eight hit points or less and
am in a dungeon about to be damaged (con-
tingency), then dimension door on myself to
a destination 1 inch above ground level
directly upward or, if that is greater than 360
feet away, to the farthest unoccupied area
within range that I have seen within the 12
hour period prior to the existence of this con-
tingency (spell effect)."
Any item or creature can have one contin-
gency spell at most; not even a wish can allow
multiple applications. The contingency
described can be as detailed or as simple as
desired, but is somewhat limited in effect: it
must relate to something within 120 feet of
the trigger occurrence. A contingency based
on a far-off occurrence is beyond the spell's
capacity. The target and effect of the second-
ary spell must always be specified, and if any
needed details are lacking, the secondary
spell does not occur.
A contingency spell effect has no maxi-
mum duration. It may remain for centuries
before the situation described comes to pass.
Create Any Monster
Range: 90 feet
Duration: 3 turns
Effect: Creates one or more monsters
This spell is similar to the 7th-level spell
create normal monsters and the 8th-level
spell create magical monsters, but with fewer
limitations on the types of creatures appear-
ing. The range and duration are triple those
of the 7th-level version. Humans and demi-
humans cannot be created, but any other
creature is possible, regardless of the number
of special abilities (asterisks). However, if a
creature with three or more asterisks is
desired, the caster must have carefully stud-
ied one (either alive or dead) for at least one
hour to be able to create another with this
spell. As with the lesser spells, the maximum
number of Hit Dice of creatures is equal to
the level of the caster.
Special Note: To create a construct (as
described in the Companion Set, DM's
Book, page 21), the proper materials must be
used with this spell. Only one construct will
appear, regardless of the caster's Hit Dice;
but it is permanent, and does not vanish at
the end of the spell duration. As with the 8th-
level spell, the cost of materials is a minimum
of 5,000 gp per asterisk (or more, depending
on your campaign). If the construct has four
or more asterisks (such as a drolem), the cost
is doubled (or more; ask your DM).
Created monsters of all types can be
blocked by a protection from evil or anti-
magic shell spell effect.

```

### Non-Human Spellcasters and Special Spellcaster Procedures

- Extraction note: section-aware Master extraction using anchored TSV reflow across the actual Spell Casters (Non-Human), special monster spellcaster, undead spellcaster, and undead-control pages instead of the earlier broad procedures slice.

```text
Spell Casters (Non-Human)

A non-human cleric or druid is known as a
shaman, and a non-human magic-user as a
wicca. Shamans and wiccas do not know all
the usual spells. The spells they do know are
often cast in an unusual manner, involving
dancing, shouts and howls, and waving
strange items.
The non-human spell casters that are
known are listed below, along with the maxi-
mum levels attainable by each. Some individ-
uals may be both classes a shaman/wicca),
but the maximum level for each class is then
1/2 normal. Note that most non-humans in a
tribe or lair know nothing of magic and may
fear or distrust it. Spell casters often use their
skills to rise to positions of power within their
tribes. Only one non-human in 20 is a spell
caster, and many groups have only a shaman.
The spells usable by shamans and wiccas
are listed below. Other spells are not under-
stood by these casters and are never usable.
Shamans and wiccas cannot read scrolls, but
may use other magical items. A shaman can
use any clerical item; a wicca can use any
item usable by a magic-user.
A shaman or wicca normally has 3-8 hit
points per Hit Die (ld6 + 2 instead of ld8),
and gains a + 1 hit point bonus per experi-
ence level (even if the total exceeds the nor-
mal maximum for the monster type).
Abbreviations: S = Shaman (cleric spells
only); D = Shaman with druid spell use; W
= Wicca (magic-user spells only). The num-
ber following the S, D, or W is the maximum
level attainable. The letter and number in
parentheses is the D&D@ set and page num-
ber of the monster's description: B = Basic;
X = Expert; C = Companion.
Bugbear (B27): S6, W4
Centaur (X47): D8, W8
Cyclops (X47): S4, W2
Dolphin (C29): S10, W6
Doppleganger (B28): S6, W4
Dragon a (B28-29, C29-31): S10
Dryad (X48): D10, W4
Giant, Cloud (X50): S10, W10
Giant, Storm (X50): S10, W10
Giant, Hill (X50): S8, W6
Giant, Stone (X50): S8, W6
Giant, Frost (X50): S8, W6
Giant, Fire (X50): S8, W6
Gnoll (B30): S6, W4
Gnome (B30): S12, W12
Goblin (B31): S8, W6
Harpy (B31): S6, W4
Hobgoblin (B31): S8, W6
Kobold (B32): S6, W4
Lizard Man (B33): S6, W4
Manscorpion (C34): S13, W6
Medusa (B34): S8, W8
Merman (X54): S8, W8
Minotaur (B34): S4, W2
Neanderthal (Caveman, B34): S4, W2
Nixie (X54): D6, W4
Ogre (B35): S4, W2
Orc (B35): S6, W4
Pixie (B35): D6, W4
Sprite (B38): D6, W4
Treant (X56): D10
Troglodyte (B38): S4, W2
Troll (X56): S4, W2
Notes:
a) Some dragons use magic-user spells, but
no single dragon can use both clerical and
magic-user spells.
b) A dryad's charm person ability is not
affected by the gaining of additional druid
spells.
c) If a storm giant learns to use magic-user
spells, its ability to cast lightning bolts is
not affected.
d) Manscorpion clerics have access to all
clerical spells, and are actually clerics, not
shamans.
e) A nixie who learns spells of any type is
counted as five nixies for purposes of the
special nixie charm effect.
f ) Some very rare and exceptionally intelli-
gent ogres can rise to W12, but these types
usually live entirely separated from their
normal kin.
g) A treant who gains the use of druid spells
may animate four trees instead of two.
Spells Usable by Shamans
First Level Clerical Spells
Cure Light Wounds* (B26, X5)
Detect Magic (B26)
Light* (B26, X5)
Protection from Evil (B27)
Second Level Clerical Spells
Bless* (X5)
Hold Person* (X5)
Snake Charm (X6)
Speak with Animals (X6)
Third Level Clerical Spells
Continual Light * (X6)
Cure Blindness (X6)
Cure Disease* (X6)
Remove Curse* (X6)
Fourth Level Clerical Spells
Cure Serious Wounds* (X7)
Dispel Magic (X8)
Neutralize poison* (X8)
Speak with Plants (X8)
Fifth Level Clerical Spells
Create Food (X8)
Cure Critical Wounds (C 12)
Dispel Evil (X8)
Insect Plague (X8)
Sixth Level Clerical Spells
Cureall (C 13)
Find the Path (C9)
Speak with Monsters* (X9)
Word of Recall (X9)
Druid Spells: All are usable
Spells Usable by Wiccas
First Level Magic-User Spells
Detect Magic (B39)
Light (B40)
Protection from Evil (B40)
Read Languages (B40)
Read Magic (B40)
Sleep (B40)
Second Level Magic-User Spells
Continual Light* (B41, X11)
Detect Evil (B41)
Detect Invisible (B41)
Invisibility (B41)
Levitate (B42)
Web (B42)
Third Level Magic-User Spells
Clairvoyance (X11)
Dispel Magic (X11)
Fire Ball (X11)
Fly (X12)
Lightning Bolt (X12)
Water Breathing (X12)
Fourth Level Magic-User Spells
Charm Monster (X13)
Growth of Plants* (X13)
Ice Storm/Wall (X13)
Massmorph (X13)
Remove Curse* (X14)
Wall of Fire (X14)
Fifth Level Magic-User Spells
Animate Dead (X14)
Cloudkill (X14)
Dissolve* (X20)
Hold Monster* (X15)
Pass-Wall (X15)
Wall of Stone (X15)
Sixth Level Magic-User Spells
Death Spell (X16)
Move Earth (C21)
Projected Image (X16)
Reincarnation (C21)
Stone to Flesh* (X16)
Wall of Iron (C21)
*reversible spell
Special Monster Spellcasters
Lycanthropes: Wererat, Werewolf, Were-
boar, Weretiger, Werebear (B33-34); Devil
Swine (X48)
A lycanthrope may be a real magic-user,
cleric, or druid in human form. However, it
may not use any spells while in were-form and,
when it assumes were-form, loses all memory of
spells learned as if all the spells had been cast. A
devil swine spell caster can cast three charm
person spells per day in either were or human
form, but can only cast other spells while in
human form. Devil swine will not forget spells
while in were-form.
Undead Spellcasters
A spell caster slain by an undead may
retain the use of spells after returning as an
undead. See below for more details.
If a cleric becomes a mummy (through a
process known only to the ancient high
priests of certain religions), the undead
mummy may use clerical spells to the full
extent possessed in life and may control other
undead as well (see Lieges and Pawns). A
mummy magic-user is limited to 3rd-level
ability, even if it had higher-level spell use in
its previous life.
Undead Lieges and Pawns
U n d e r certain conditions, intelligent
undead creatures can try to control other
undead. The undead need not be a spell
caster to control other undead creatures. An
undead creature being controlled by another
is a Pawn. An undead controlling one or
more lesser undead is a Liege. Skeletons and
zombies can only be Pawns, but any other
type of undead can be either a Liege or a
Pawn. Random encounters with undead may
occasionally (10% chance) be with Pawns
controlled by a greater undead.
A Liege may control a number of undead
whose total Hit Dice are less than or equal to
twice the Liege's Hit Dice. If an attempt by
the Liege to control other undead would
cause the total to exceed this amount, the
attempt automatically fails.
When a lich or other undead spell caster
seeks to control other undead, its caster level
is used instead of its Hit Dice. Like a magic-
user, a lich is far more powerful than its Hit
Dice indicate.
If an undead tries to control a potential
Pawn, the subject may have no more than 1/2
the Hit Dice of the Liege (this does not apply
in certain situations, see below). If the subject
is already controlled by any means, the
undead attempting control instantly recog-
nizes this fact. It may still attempt control,
but with a -4 penalty to the roll.
If one undead tries to control another, find
the Hit Dice of the would-be Liege and poten-
tial Pawn on the chart on page 23 and roll 2d6.
If the number is equal to or greater than the
number given, the attempt succeeds and the
undead subject becomes the Pawn of the con-
troller. Any total of 2 or less (possible if the roll is
penalized) always indicates failure.
If the undead attempting control was once
a spell-using character and can now use spells
as it did in life, a + 2 bonus applies to all die
rolls for control.
During melee, an attempt to gain control is
considered a combat action.
If an undead creates another of the same
type by slaying a living creature, the new
undead is automatically a Pawn of the slayer.
Spectres, vampires, wights, and wraiths are
the only undead with this ability. This may
force the creator to release other existing
Pawns; if so, the Pawns with the highest Hit
Dice are released first.
If an undead can call or summon others,
those responding are automatically its Pawns
unless the new Hit Dice total would exceed
the limits given above, or unless the Liege
allows them to retain free will.
Duration of Control
At moonrise on the night of the full moon,
all Pawns are freed from control and cannot
be controlled again until the following dawn.
Thus, the maximum duration of undead con-
trol is about 4 weeks. A Liege may release
control of its Pawns at any time.
Benefits to a Liege
A Liege is telepathically linked to its Pawns
and can see and hear through their eyes and
ears whenever it chooses. This communica-
tion is at will and need not be continuous.
Control of a Pawn is total, even to the point
that it will obey suicidal orders. Pawns obey
withouthesitation. The maximum range of
control is 24 miles (one outdoor map hex) per
Hit Die of the Liege.
If a Pawn fails a Morale check and flees
from combat, the Liege may stop the Pawn
and force it back into melee. This can be the
only action the Liege takes during that melee
round. The Pawn will miss at least one full
round of attacks.

UNDEAD ATTEMPTS TO CONTROL OTHER UNDEAD
Pawn          4   5-6  7-8  9-10  11-13  14-16  17-19  20-23  24-27  28-32  33+
Skeleton      7   5    3    C     C      C      C      C      C      C      C
Zombie        9   7    5    3     C      C      C      C      C      C      C
Ghoul         11  9    7    5     3      C      C      C      C      C      C
Wight             11   9    7     5      3      C      C      C      C      C
Wraith                  11   9     7      5      3      C      C      C      C
Mummy                        11    9      7      5      3      C      C      C
Spectre                             11     9      7      5      3      C      C
Vampire (a)                               11     9      7      5      3      C
Vampire (b)                                      11     9      7      5      3
Phantom                                                11     9      7      5
Haunt                                                         11     9      7
Spirit                                                               11     9
(a) Non-spell-using vampire of 7 or 8 Hit Dice
(b) Vampire of 9 Hit Dice, or any spell-using vampire
Number: Roll needed (or higher), on 2d6, for the Liege to successfully take control of the lesser undead
C: Control is automatic

A Liege can create a chain of control by
instructing its Pawns to become Lieges too.
For example, a spectre could control up to 12
wights, who could each control up to six skeletons. Direct communication and control
does not extend through a chain of control,
but only to a Liege's personal Pawns.
Any Liege may coordinate the attacks of its
Pawns in a well-organized fashion. A Liege at
the top of a chain of control which consists of
10 or more undead (counting the entire
chain) may be considered the leader of an
undead army. When applying the War
Machine mass combat system (DM Companion, pp. 12-17), note the following details
for calculating the force's BFR:

a. Leadership Factor: Treat the Liege's Wisdom as equal to its Intelligence, and treat
Charisma as 18. (see the Intelligence section.)
b. Experience Factor: Treat each controlled
Liege as an officer.
c. Training Factor: Automatic maximum
d. Equipment Factor: Assume normal weapons
e. Special Troop Factor: Carefully review the
percentage of the force that has two or more
asterisks listed with its Hit Dice.

Turning Controlled Undead

When a character tries to turn Pawns, the attempt is checked as if against the Liege. If the attempt fails, the Pawns are completely unaffected, even if they would normally be Turned or Destroyed by the result.

If the Turn succeeds, the control link is broken, but there is no other effect. A second attempt at
Turning the same group must be made for the
former Pawns to be Turned with normal
chances and results.

Energy Drainers
Spectre (X56), Vampire (X57), Wight
(B39), Wraith (X57)
Whenever an energy-draining undead
slays a victim, the victim later rises as an
undead of the same type, under the control of
the slayer. In this case, the Armor Class and
Hit Dice of the victim become those of the
standard undead form, but the hit points are
one-half of those possessed in life. (Note that
such a victim does not rise immediately, but
usually after a period of 24-72 hours, or as
given in each monster description.)
If the Liege undead is slain after the victim
has risen as a Pawn, the victim becomes free-willed and gains 1 hp per hour until reaching
the full number of hit points possessed in life.
If the original undead is slain before its victim can rise as an undead, the victim becomes
a free-willed undead instead of a Pawn. In
this case, the new undead creature has all the
hit points of the original living victim (not one-half), and has the same Hit Dice as well. Its Armor Class and movement rate change to match the new undead form. Such details of these created undead may thus vary widely
from the standard monster descriptions.
Note that Hit Dice, not levels of experience,
remain the same.
If the victim was a cleric or magic-user in
life, spells are usable only when free will is
obtained. An undead cleric must still meditate to gain spells, and an undead magic-user
must still keep a spell book to memorize
spells. Those clerics who were druids in life
revert to normal cleric status in un-death.
If a cleric (or paladin or avenger) gains a T
or D result when attempting to Turn an
undead spell caster, the undead may make a
Saving Throw vs. Spells to avoid the effect
entirely. If successful, the Turn attempt is
ignored, and is not counted as a failure. Further attempts at Turning the same creature
may be made by the same cleric.
Any undead spell caster may be recovered
and restored to normal life after it has been
slain in undead form. The remains must be
treated with a remove curse spell from a 26th
or higher-level cleric, followed by cureall and
raise dead (or raise dead fully) spells, in that
order.

```

### Artifact Power Doctrine and Artifact Effect Procedures

- Extraction note: final targeted Master addition from the actual artifact-doctrine pages, capturing artifact purpose, activation, power limits, recharging, intelligence, adverse effects, attack/destruction rules, and power-category guidance that Immortals explicitly relies on for non-spell magical effects. The named-artifact catalog is intentionally excluded.

```text
[Master artifact pages 45-47: doctrine overview and creation rules]
This section introduces the greatest and most
powerful of all magic items, the Artifact.
An artifact is the creation of an Immortal
and contains a concentration of that Immortal's personal power. The magical might of an
artifact is legendary. It is able to recreate
magical effects of spells and other magic
items, without exhausting its power. Indeed,
artifacts are capable of regenerating any
power they expend given sufficient time.
Each artifact is unique or part of a unique
set, as no two artifacts can create the same
combination of effects. Artifacts are only
rarely encountered and are often the object of
astounding quests for glory and honor. Nothing regarding an artifact happens by chance,
for the destiny of each device is carefully
planned and controlled by the Immortals.

Using Artifacts in the Game
What purpose do artifacts serve in the
game? A quest for an artifact can provide a
long range goal for high level characters, providing months of adventuring. A powerful
artifact can be both a real challenge to control
and a highly prized reward for high level
characters. Quests to find an ancient artifact
to defeat pawns of the Dark Immortals, or to
destroy a dark artifact can lead to the creation
of epic sagas for your advanced players.

The Purpose of Artifacts

Artifacts are the creations of Immortals
who sacrifice a part of their personal Power,
to create these tools which may be used to further their masters' goals. The Immortal
crafts an artifact to fulfill a specific purpose
that will help gain more power for the
Immortal and supports the goals of the
Immortal's Sphere of Power. These may be
as simple as battling enemies of the Sphere to
subtly undermining an entire nation's might.
An artifact, though created by an Immortal may be used by mortals either directly or
indirectly in service to the spheres of the
Immortals. However, because of the unmanageable nature of Immortal Power, mortals
will suffer a chance of adverse effects when
using an artifact.
Artifacts may have different levels of
power based on the amount an Immortal is
willing to invest. This magnitude of power
falls into four levels: Minor, Lesser, Greater,
and Major. Minor artifacts are the ones most
commonly created, for they cost the least.
The number of magical effects and adversities of an artifact is directly linked to the magnitude of an artifact. Refer to Table 1 under
Creating Artifacts for full details.

Artifacts in the Game
Finding an Artifact
The appearance of an artifact in a campaign should never be abrupt, nor random.
Artifacts are tools of the Immortals and their
destiny and use is carefully planned. Foreshadow the introduction of an artifact
through legends and rumors the characters
learn or overhear. An Immortal might use
subtle manipulation to bring the existence of
the artifact to the characters' attention. Only
introduce an artifact if it serves a greater
game goal.
An artifact should only be found after a
long, trial-filled quest. A character should
have to find and follow the winding trail of
the artifact through history. Artifacts are
never easily found or acquired, for they are
often protected by a mighty guardian or by
terrible trials and mystery.
An artifact may be used by intelligent creatures of any level. However, the value of an
artifact will vary because of the level of the
mortal. Low-level creatures will find themselves not really in control of the artifact. Midlevel mortals will find an artifact desirable
because of the power it promises, but hard
pressed by the adverse effects. High level
beings will often seek out an artifact in an
effort to right a wrong, destroy an evil item,
or to do honor to an Immortal.
Activating an Artifact
Artifacts may assume many guises and
even once found may not work until a specific
action is performed. The action required to
activate an artifact's innate powers may be
the performance of a special ritual, the occurrence of a specific event, or some action that
must be taken with the item itself.
The specific means to activate an artifact
may be learned through legend or magical
research and may result in further adventures.
Merely possessing an artifact is not enough
to gain its benefits. A character must also
learn how to control each of its powers. Discovering what powers an artifact has and how
to control the effects should be a gradual
process. Powers and their controls may be
discovered using methods similar to those for
activation.
Try to maintain the mystery of the artifact
by describing effects, rather than naming
them and by keeping their methods of control
uncertain. This will contribute much to the
flavor of the game.
If specific methods are not described for
activation or discovery of the powers, the

The item should activate when picked up, and
once the possessor proves his worth, it should

communicate its powers telepathically.

  Artifact Powers

   Artifacts are beyond mortal powers and

are treated as if 40th level for purposes of

determining magical effects. Unlike standard

magical items, artifacts may make saving

throws versus various attacks as if a 36th level

fighter.

   An artifact may have several powers, but

the total cost of the powers may not exceed

the Power Level of the item as defined by its

magnitude. Each effect may be used as often

as desired. But each use drains a number of

charges equal to the cost of the power used.

The number of charges available at full

capacity equals the Power Level. An artifact

may recharge itself; the rate of recharging

depends on the magnitude of the artifact. If

charges drop below 10, no power may be

used until the item is sufficiently recharged.

   If an artifact is used to harm another arti-

fact, it is treated as if attacking as a 40 H D

monster, Armor Class -20. Only enchanted
weapons with + 5 bonus or greater and other

artifacts may damage an artifact. All attacks

against an artifact only cause the minimum

amount of damage possible based on the

attack. Artifacts possess a number of hit

points equal to their Power Level.
   Damage to an artifact may only be

repaired by its Immortal creator.

  Intelligence of an Artifact

   An artifact is made of the five components

of power-matter, energy, time, entropy, and

thought. All artifacts possess a rudimentary
intelligence. This level of intelligence is very

restricted, and an artifact can respond to only

  a limited number of situations. An artifact

does not have analytical intelligence, reason,
nor the ability to learn. It can only respond to

personal danger and present situations in

regard to its purpose.

   If an artifact is personally attacked, it

defends itself using its powers. An artifact

does not use attacks that might cause it fur-

ther damage, but it does not account for its

wielder's frailties. If the attack is an area

effect at close range, the user may suffer dam-

age.

Adverse Effects

  Because of the presence of "entropy" in

the components of an artifact, all artifacts

have bad side effects that may occur when-

ever a mortal uses an artifact. Immortals are

not affected by these adversities. Adverse

effects appear spontaneously, and are not
chosen by the Immortal creating the artifact.
These side effects may occur by chance or
whenever a certain action is performed.
Details on adverse effects are given under
Creating Artifacts.
   There are two types of adverse effects that
every artifact possesses; handicaps and pen-
alties.
   Handicaps are permanent effects that may
not be negated as long as a user retains pos-
session of an artifact. Handicaps occur when
a specified action takes place or else, when a
power is first used. A handicap may occur
additional times for cumulative effects,
whenever the artifact's charges are allowed to
reach 0.
   Once an artifact is no longer possessed, all
handicaps begin to wear off. It vanishes com-
pletely after a period of time defined by the
magnitude of the artifact.
   Minor artifact       30 days
   Lesser artifact      60 days
   Greater artifact     120 days
   Major artifact       240 days
Handicaps wear off only if the artifact is
abandoned or lost by the user.
   Penalties are temporary effects that may be
negated by magical means while the artifact
is possessed. Penalties may occur by chance
or when a specified action takes place, usually
the use of a power.
   The standard chance that a penalty occurs
is equal to the cost of the power being used
minus 10. If this number or less is rolled on
d100, a penalty occurs. When chance dictates
the occurrence of a penalty, the DM should
choose from the list of artifact penalties.

Attacking an Artifact
   Artifacts, like Immortals, are nearly indestructable. However, an artifact's physical
form may be destroyed causing the artifact's
essence to return to the Immortal creator for
placement in a new vessel. This effectively
removes an artifact from play for a time.
   To attack an artifact, note the natural abilities listed for AC, hit points, etc. When an
artifact is damaged it will defend itself, sensing which powers will be the most effective
attack. If no attack powers remain, the artifact may randomly use any A1 attack with a
cost of 35 or less.
   Loss of hit points does not affect the ability
of an artifact to recharge (charges and hit
points are separate though they both equal
the total Power Level number). Damage may
only be repaired by the Immortal creator.

   Once an artifact is damaged 10% or more

it always defends itself when it is attacked.

This may become dangerous for the user.
   When it becomes 40% damaged, an artifact begins to lose powers starting with those
of lowest cost. Additional powers are lost for
every additional 10% of damage it suffers.
   When an artifact is 80% damaged or
more, there is a chance that the Immortal will
recall the artifact: 1 in 6 at 80%; 2 in 6 at
90%. An artifact automatically returns to the
creator when it is 100% damaged.
   Destroying an artifact's physical vessel
may bring the attention of an Immortal to a
character and the Immortal may attempt to
exact a pennance through subtle manipula-
tions of NPCs. But 80% of the time an
  Immortal creator is not overly concerned
about the damage to the artifact unless his
attention is already directed at the character.

Destruction of an Artifact
   At times characters may seek to permanently destroy an artifact. This is done to
remove a dark artifact from the hands of evil,
or to bring honor to or impress a specific
Immortal of a conflicting Sphere of Power.
   To permanently destroy an artifact, a special method, unique to each artifact, must be
employed. This method must be extremely
difficult and require the use of legendary
might-such as to crush it on the World
Anvil, or to cause it to be devoured by an
Immortal Dragon. This method may be discovered through a lengthy quest or very
expensive research. Legends about the item
may hint at how it may be destroyed.
   An artifact cannot defend itself until it is
attacked, and thus can rarely prevent its
destruction. An Immortal creator on the
other hand would attempt through mortal
agents to thwart its destruction once he discovered the intent, as the artifact is a piece of
  the Immortal's power. If the artifact is
  destroyed, the Immortal creator will become
the destroyer's foe and may attempt to cause
him ill through future manipulations. An
Immortal from another sphere of power who
benefits from the destruction of the artifact
may be petitioned to intervene at the price of
a personal quest. If the DM allows a character to so gain an Immortal's intervention, the
thwarted Immortal may only send one catastrophe against the character. After that the
Immortal creator may not directly act against
the destroyer.

Creating Artifacts

The following is a list of elements to consider

when creating an artifact. Artifacts should be

 designed and used with great care, as too fre-
 quent an appearance, use or lack of control of
 artifacts, swiftly turns them into only power-
 ful toys.

    Player Description: Create the legend of
 the artifact, complete with rumors and clues
 about the whereabouts, uses and ill effects of
 the artifact. (Books on lore, legend and
 myths, as well as fiction may be used for
   inspiration.)
    DM Notes: Define the exact physical form
 of the artifact. Also determine the Immortal
 creator and the purpose of the artifact.
    Magnitude: Select the magnitude of the item
   to be created. This will define the maximum
 Power Level possible and range of powers.
    Limits of Power: Once the magnitude is
 known, review the maximum number of
 powers available in each power category on
 Table 1.
    Sphere: Define the Immortal creator and
 his Sphere of Power. This will help strengthen
 the purpose and provide guidelines as to the
 types of powers that might be chosen.
    Powers: Select powers based on the pur-
 pose and sphere of the artifact. Power cost
 should not exceed the total Power Level, nor
 should the maximum powers per category be
 exceeded. You may, however, choose fewer
 powers and a lower Power Level than the
 maximum.
    Activation: Decide the methods of activa-
 tion and also other methods for discovering
 powers.
    Use of Powers: Define how the user sum-
 mons forth the powers and whether the arti-
 fact produces the effect or if it is granted to
 the user to invoke.
    Handicaps: Determine permanent ad-
 verse effects and the conditions for their
     appearance.
      Penalties: Determine temporary setbacks
   and the conditions or chances for their
 appearance.

 At the end of this section are several pregen-
 erated artifacts for use in D&D campaigns.
 These samples provide a model for generat-
   ing your own new artifacts. At the end of each
 artifact, the reference source for the artifact is
 listed as well as suggestions of where you
 might look for other ideas.
    When deciding on the Immortal creator
 and his Sphere of Power, refer to the Proce-
 dures section on Immortals to review the
 goals of each sphere. Then when selecting
 powers, the purpose provides a logic for the

 ones chosen. An artifact for the Sphere of

 Energy would use fire and energy attacks and

defenses, teleportation, and possibly many
transforming energy powers

Physical Vessels
   Almost anything may be used as a vessel
for an artifact, but most often items of endur-
ing materials are used. An artifact may even
be another magic item, but then is usually a
weapon or armor. When using a magic item
as the vessel, do not roll randomly on the
treasure tables, but rather make a logical
selection. Do not choose a powerful magic
item as the vessel for an artifact. Any special
abilities of the magic item do not count
against the Power Level total.

Selecting Adverse Effects
   Select effects that will not interfere with the
purpose or function of the artifact. Where possible, select effects that will actually further the

goals of the sphere. Do not choose effects that

negate one of the artifact's powers.

   You may choose to modify the severity of the

effects based on the magnitude of the artifact.

Using the Power Tables
   The following are tables for use when cre-

ating new artifacts for your own campaign.
These tables were also used to create the sam-

ple artifacts listed hereafter. Their special

powers are defined here.

   To create a new artifact, choose the magni-
tude of the artifact to be created and consult

Table 1. The DM may select Powers based on
their power point cost up to the maximum

power investment. The total power of the
artifact cannot exceed the magnitude level,

but may be less. If the total power is less than

the maximum, the actual power invested is
the total number of power points available
when fully charged.
   Powers selected may not exceed the maxi-

mum number of powers for each category,

but an artifact need not have powers from
each category.

   Table 2, Artifact Powers, is divided into
four categories, each further subdivided into

general types. The four categories are:
Attacks against another, Information &

Movement, Transformations, and Defenses.
Preceding each ability is a number; this num-
ber is used both as the power investment cost
 and the number of power points subtracted

whenever the ability is used.
    Following each power's name are abbrevi-

 ations of the range, duration, effect and book

 reference, if a spell. In some cases, the effect
 of a power is too complex to abbreviate and

 the reference should be reviewed for details.
 Effect also may be used to list area of effect.

 Each power only functions for a limited dura-
 tion where noted.
    Note that range, duration and area of
 effect may vary from the original spell; check
 the table first.
    Abbreviations used include:
 atk     = attack
 B       = Basic Players Book
 C       = Companion Players Book
 cn      = coin; unit of encumbrance
 cr      = creature
 C R = Combat Result for War Machine
 C R T = Combat Result Table for War
               Machine
 Conc = Effect is only maintained as long as
               user concentrates on it and is not
               disturbed or damaged
 dia        diameter
 D          damage
 DR         Duration
 EF         Effect; Area of Effect

 HD         Hit Dice

 L          Level; experience or spell

 MV         Movement rate

 M          Master Players Book
 obj        Object

 r          round
 R          Range

 rad        radius
  Save      Saving throw vs the effect

 ST         Saving throws of a specific category

               as a result of the effect

 T          Turn
 Touch = Attacker must touch target

 X       = Expert Rule Book

 I       = per

  *      = spell has reverse effect

             TABLE 1:
     GENERAL CHARACTERISTICS

                     Magnitude of Artifact

                 Minor Lesser GreaterMajor

   Maximum
      Power

   Investment      100         250   500   750

   Maximum
    Number
   of Powers          8         11    14    17

   Maximum
      Types

    of Powers

 A. Attacks           2         3     4      4
 B. Info+Move         1         2     3      4

 C . Transforms       2          2    3      4
 D. Defenses          3          4    4      5

  Recharging
     Rate
  PPperhour      30      60      120    180
  PPperturn       5      10       20     30

  Adverse Effects
    Handicaps *       1       2    3     4
    Penalties * *     1       3     5    8
   ' O r 1 handicap + 1       per 200 power
     invested, round down.
 * * Or 1 penalty per 100     power invested,
     round up.

      TABLE 2: ARTIFACT POWERS
    A. Attack Forms
    A1. Direct Physical Attacks

 cost
   10 Cause Wounds, Light* (EF 7 hp; X5)
   15 Magic Missile (EF 5 missiles, ld6 + 1
       D each; B40)

   35 Bearhug (DR 1T)

   25 Cause Disease*(R 30'; X6)

   30 Cause Wounds, Serious* (EF 14 hp;

       X7)
   35 Cause Wounds, Critical* (EF 21 hp;

       C12)
   40 Create Poison * (R Touch; X8)

   40 Dispel Evil (R 30', DR 1T; X8)
   45 Cloudkill (R 1', DR 6T, EF 1 pth, 5 HD or less Save vs. Poison, 30' x 20'; X14)

   45 Ice, Storm (R 120', EF 20d6 D, 20'
       cube; X13)

   50 Death Spell (R 240', EF 32 H D in 60'

       cube, to H D 7 + ; X16)

   50 Finger of Death* (R 60'; X9, C12)

   50 Poison gas breath (DR 3r, EF 20'
        cube)
   55 Fire Ball (R 240', EF 20d6 D; X11)
   55 Ice Breath (EF 30' x 10' D = hp)
   60 Fire Breath (EF 30' x 10' D = hp)
   60 Lightning Bolt (R 180', EF 20d6 D,

        60' x 5'; X12)

   65 Acid Breath (EF 30' X 5')
   65 Delayed Blast Fire Ball (R 240' , DR

        0-60r, EF 20d6 D; C22)
   70 Life Drain* (R Touch; EF drains 1 level; C13)
   75 Explosive Cloud (R 1', DR 6T, EF
        20' x 30' x 30', 20 hp/r; C24)

   80 Disintegrate (R 60', EF 1 cr; X16)
   85 Power Word Kill (R 120', EF kill 60
        hp, stun 61-100 hp, DR 4T; C26)

   90 Obliterate* (R 60', EF kill 7 HD; to

        12 HD ST at -4, 12+ HD 6d10; C13)
  100 Meteor Swarm (R 240', EF 4 for

        8d6 + 8d6 or 8 for 4d6 + 4d6; C26)

[Master artifact pages 48-54: power tables and artifact effect descriptions]

[Master artifact page 48]

A2. Direct Mental Attacks
 cost
   10 Cause Fear* (R 120', DR 2T; X5)
   15 Sleep (R 240', DR 20T, EF up to 20
      HD, 40' sq; B40)
  20 Charm Person (R 120'; B39)
  25 Confusion (R 120', DR 12r, EF up to 18
      cr in 30' rad; X13)
  30 Charm Monster (R 120', EF 1 at 3 HD or 1 at 3+ HD; X13)
  30 Calm Others (R 120', EF up to 40 HD)
  35 Control Plants (R all in 30' x 30', DR
      20T; X16)
   40 Feeblemind (R 240', EF -4S?, INT 2;
      C20)
   45 Charm Plant (R 120', DR 3 mon, EF 1/
      6/12/24 plants; C21)
   50 Geas Another (R 30'; X16)
   60 Control Animals (DR 20T, EF up to 40
      HD, 20 cr)
   70 Control Lesser Undead (DR 20T, EF up
      to 7 HD, 20 HD, 10 cr)
   75 Mass Charm (R 120', EF 30HD, -2
      Save; C24)
   80 Open Mind* (R Touch, EF -8 ST; C24)
   85 Control Giants (DR 20T, EF one type, 4 cr)
   90 Control Greater Undead (DR 20T, EF
      any, 40 HD, 20 cr)
   95 Control Dragons (DR 20T, EF one type,
      3 Small or 1 Large)
  100 Control Humans (DR 20T, EF up to 7
      HD, 40 HD total, 20 cr)
A3. Attacks that Stop or Slow
 cost
   10 Web (R 10'cu, DR 48T; B42)
   15 Hold Animal (R 180', DR 40T, EF one
      type, 4 cr; C15)
   20 Hold Person (R 120', DR 40T, EF up to
      4 cr; X12)
   25 Slow* (R 240', DR 3T, EF up to 24 cr,
      30' radius; X12)
   35 Hold Monster (R 120', DR 46T, EF up
      to 4 cr; X15)
   45 Turn Wood (R 30', DR 40T, EF 120' X
      60'; M5)
   50 Flesh to Stone* (R 120', EF 1 cr or 10'
      cube; X16)
   60 Power Word Stun (R 120', DR up to
      35hp = 12r, up to 70hp = 6r; C22)
   75 Dance (R Touch, DR 8r, EF -4STIAC;
      C24)
   85 Power Word Blind (R 120', DR up to 40
      hp = 4 days, up to 80 hp = 2d4 hrs;
      C25)
  100 Life Trapping
  100 Maze (R 60', DR 6T to 4r; C26)
 A4. Miscellaneous Attack Forms
  cost
   10 Blight' (R 60', DR 6T, EF 20' sq, -1
       ML/Hit/Dmg; X5)

  15 Darkness*(R 120', DR 46T, EF 30' dia;
     X11)
 20 Light* (R 120', DR 46T, EF 30' dia; B40)
 20 Set normal Trap, 50% (DR 6T)
 20 Turn Undead as Cleric L6 (DR 1T)
 25 Curse* (R Touch; EF limited, see X14)
 25 Disarm Attack (DR 6T)
  30 Continual Darkness* (R 120', EF 30'
     rad; X6)
  30 Pick Pockets, 50% (DR 6T)
  40 Set normal Trap, 70% (DR 6T)
  40 Silence 15' radius (R 180', DR 12T; X6)
  45 Polymorph Other (R 60', up to 2x HD;
     X13)
  45 Turn Undead as Cleric L12 (DR 2T)
  50 Babble* (R 60', DR 40T; X9)
  55 Dispel Magic (R 120', EF 20' cube; X8)
  55 Pick Pockets, 75% (DR 6T)
  60 Appear* (R 240', DR 1T, EF 20' cube; C22)
  65 Set normal Trap, 90% (DR 6T)
  70 Turn Undead as Cleric L24 (DR 3T)
  75 Polymorph Any Object (R 240', DR 40-240T, EF 10' cube; C25)
  80 Pick Pockets, 100% (DR 6T)
  90 Anti-Magic Ray (DR 1T, EF 100%)
  95 Turn Undead as Cleric L36 (DR 3T)
 100 Blasting (EF 60' x 20', 2d6 + deafen)
A5. Bonuses to attacks
 cost
  10 Bless (R 60', DR 6T, EF 20' sq, +1 ML/Hit/Dmg; X5)
   15 Weapon damage bonus + 2 (DR 1T)
  20 Hit rolls bonus + 2 (DR 1T)
  20 Turn undead bonus + 2 to roll, + 1d6
      HD (DR 1T)
  25 Leap to 30', + 2 Hit roll bonus (DR 1T)
  25 Weapon damage bonus + 3 (DR 1T)
   25 Weapon strength bonus + 1 (DR 1T)
   30 Hit rolls bonus + 3 (DR 1T)
   30 Spell damage bonus, + 1/die (DR 1 spell)
   30 Striking (R 30', DR 1T, EF +1d6 D; X7)
   35 Weapon damage bonus + 4 (DR 1T)
   40 Hit rolls bonus + 4 (DR 1T)
   40 Turn undead bonus + 4 to roll, + 2d6
      HD (DR 1T)
   40 Weapon strength bonus + 2 (DR 1T)
   45 Weapon damage bonus + 5 (DR 1T)
   50 Hit rolls bonus + 5 (DR 1T)
   50 Leap to 60', + 4 Hit roll bonus (DR 1T)
   55 Spell damage bonus, + 2/die (DR 1 spell)
   55 Weapon strength bonus + 3 (DR 1T)
   60 Hit rolls bonus + 6 (DR 1T)
   60 Turn Undead bonus +6 to roll, +3d6 HD (DR 1T)
   70 Double weapon damage (DR 1T)
   70 Weapon strength bonus + 4 (DR 1T)
   75 Leap to 90', + 6 Hit roll bonus (DR 1T)
   80 Spell damage bonus, + 3/die (DR 1 spell)
   85 Smash attack (DR 1T)

  85 Weapon strength bonus + 5 (DR 1T)
  90 Triple weapon damage (DR 1T)
 100 Spell damage bonus, + 4/die (DR 1 spell)
B. Information & Movement
B1. Aids to Normal Senses
 cost
  10 Detect New Construction (R 60', DR
      36T)
  10 Read Languages (DR 6T; B40)
  10 Read Magic (DR 3T; B40)
  10 Timekeeping (DR to 24 hours from 1
      mark)
   15 Detect Slopes (R 30', DR 36T)
   15 Speak with Animals (R 30', DR 6T; X6)
  20 Infravision (R Touch, DR 1 day, EF see 60'; X12)
  25 Hear Noise, 50% (DR 12T)
  25 Speak with the Dead (R 30', EF 3 questions; X7)
  30 Speak with Plants (R 30', DR 3T; X8)
  30 Tracking (DR 6 hours, EF 90% outdoor,
      50% indoor)
   35 Find Secret Doors (R 10', DR 6T)
   40 Communication (DR 6T)
   50 Hear Noise, 90% (DR 24T)
   50 Lie Detection (R 120', DR 3T)
   60 Speak with Monsters (DR 6T; X9)
   70 Tracking (DR 6 hours, EF 90% anywhere)
   75 Hear Noise, 140% (DR 36T)
   80 X-Ray Vision (R 30', DR 1T)
B2. Additional Senses
 cost
  10 Find Traps, 50% (DR 6T)
  10 Predict Weather (DR 12 hours, EF 40
      miles; C15)
   15 Detect Magic (DR 6T, EF R 60'; B39)
   15 Detect Evil (DR 6T, EF R 60'; B41)
  20 Find Traps, 60% (DR 6T)
  20 Know Alignment (DR 1r, EF R 30; X5)
  20 Locate Object (DR 6T, EF 120'; X6)
  25 Clairvoyance (R 60', DR 12T; X11)
  25 ESP (R 60', DR 12T; B41)
  30 Find Traps, 70% (DR 6T)
  30 Wizard Eye (R 240', DR 6T, MV 120';
      X14)
   35 Find Traps (DR 2T, EF 30' ; X5)
  35 Detect Invisible (R 400', DR 6T; B41)
   40 Detect Danger (R 200' , DR 6T; M4)
   40 Find Traps, 80% (DR 6T)
   45 Choose Best Option (R 1T, EF 1 choice)
   50 Find Traps, 90% (DR 6T)
   50 Truesight (DR 5T, EF 120'; C12)
   55 Mapmaking (DR 1T, EF Sense 60'
      range)
   60 Find Traps, 100% (DR 6T)
   60 Treasure Finding (DR 6T, EF 400')
   70 Find Traps, 110% (DR 6T)
   70 Lore (DR 1T or 1 day; C22)
   80 Find the Path (DR 46T; X9)

[Master artifact page 49]
B3. Aids to Movement
 cost
  10 Climb Walls, 70% (DR 12T)
  15 Levitate (DR 46T; B41)
  15 Tree movement (DR 12T)
  20 Climb Walls, 80% (DR 12T)
  20 Plant Door (DR 40T; C15)
  25 Climb Walls, 90% (DR 12T)
  25 Dimension Door (R 10', DR 1r, EF
      360'; X13)
  25 Fly (DR 40 + ld6T, MV 360'; X12)
  30 Gaseous Form (DR 3T)
  30 Haste (R 240', DR 3T, EF 24 cr in 60';
      X12)
   35 Move Silently, 50% (DR 6T)
   35 Pass Plant (EF 300-600 yards; C16)
  35 Web movement (DR 12T)
   40 Climb Walls, 100% (DR 12T)
   40 Telekinesis (R 120', DR 6r, EF 8000 cn,
      MV 20'/r; C20)
   45 Transport Through Plants (EF + 2 cr;
      C16)
   50 Teleport (R 10'; X15)
   55 Climb Walls, 110% (DR 12T)
   55 Move Silently, 70% (DR 6T)
   60 Burrowing (DR 6T, MV lo', 30', or
      60 ')
   65 Plane Travel (self only, 1 shift)
   70 Climb Walls, 120% (DR 12T)
   75 Move Silently, 90% (DR 6T)
   80 Travel (DR 40T, MV 360'/720'gaseous;
      M8)
   85 Teleport any Object (EF 1 cr/obj/10' cube or self safe, -2 save other; C24)
   90 Word of Recall (X9)
B4. Aids to Offset Encumbrance
 Cost
  10 Container, to 5,000 cn (DR 6 hours)
  10 Floating Disc(DR 6T, EF 5,000 cn; B39)
  15 Buoyancy, to 10,000 cn (DR 6T)
  20 Container, to 10,000 cn (DR 6 hours)
  30 Container, to 15,000 cn (DR 6 hours)
  30 Buoyancy, to 20,000 cn (DR 12T)
  40 Container, to 20,000 cn (DR 6 hours)
  45 Buoyancy, to 40,000 cn (DR 18T)
  50 Container, to 25,000 cn (DR 6 hours)
  60 Container, to 30,000 cn (DR 6 hours)
  60 Buoyancy, to 80,000 cn (DR 24T)
  70 Container, to 35,000 cn (DR 6 hours)
  75 Buoyancy, any weight (DR 36T)
  80 Container, to 40,000 cn (DR 6 hours)
  90 Container, to 50,000 cn (DR 6 hours)
 C. Transformations
 C1.Creations and Summonings
  Cost
   15 Produce Fire (DR 2T; C15)
   20 Create Water (R DR 6T, EF 50 gallons;
       X7)
   30 Summon Animals (R 360', DR 3T; M5)
   35 Create Food (R l o ' , EF 400 men

      + mounts; X8)
  40 Create Normal Animals (R 30', DR
     10T, EF 1-6 cr; C12)
  45 Create Normal Monsters (R 30', DR
     2T, EF 40 HD total; C22)
  50 Animate Dead (R 60', EF 40 HD; X14)
  60 Animate Objects (R 60', DR 6T, EF
     4,000 cn; X9)
  70 Sword (R 30', DR 40r, EF as 2-Handed, 2 at/r; C24)
  75 Create normal objects (EF up to 1,000 cn; C24)
  80 Clone (R 10'; M6)
  90 Create Magical Monsters (R 60', DR
     3T, EF 40 HD total; M7)
 100 Create Any Monster (R 90', DR 4T, EF 40 HD; M8)
C2. Static Changes
Cost
 10 Purify Food and Water (R 10', EF 6
     waterskins or 12 food; B27)
  10 Repair normal objects (EF up to 1,000
     cn)
  15 Change Odors (EF 30' cube)
  15 Change Tastes (EF 40 meals or 20 cu.ft.)
 20 Hold Portal (DR 12T; B39)
 30 Remove Traps, 50% (DR 6T)
 30 Wizard Lock (R 10'; B42)
 35 Create magic aura (R 120', DR 3T, EF
     40' cube)
  40 Magic Door (R 10', DR 7 uses; C22)
  40 Repair temporary magical object (1 obj)
  50 Rulership (EF + 10 to + 50 Confidence)
  60 Magic Lock*(R 10', DR 7 uses, EF 10'
     sq; C22)
  60 Remove Traps, 75% (DR 6T)
  70 Remove Barrier*(R 60'; C12)
  70 Repair permanent magical object (1 obj)
  75 Victory (EF +25 CR Roll, on C R T
     worst 91-100)
  80 Metal to Wood (R 120', EF 2,000 cn;
     C16)
  85 Close Gate*(R 30'; C26)
  90 Permanence (R 10'; C25)
  90 Remove Traps, 100% (DR 6T)
  95 Gate (R 30', DR 1T or d%T; C26)
 100 Timestop (DR 1 + ld4r; M10)
C3. Dynamic Changes
 cost
  10 Open Locks, 60% (DR 6T)
  15 Warp Wood(R240', EF40 arrows; C15)
  20 Growth of Animal(R 120', DR 12T, EF
      2x; X6)
  20 Knock (R 60'; B41)
  25 Growth of Plants (R 120', EF 3,000
      sq.ft.; X13)
  25 Heat Metal (R 30', DR 7r; M4)
  25 Open Locks, 70% (DR 6T)
  25 ShrinkPlants*(R 120', EF 3,000 sq.ft.;
      X13)
  30 Control Winds (DR 40T, EF 400'; C16)

 30 Harden* (R 120', EF 3,000 sq.ft. X
     10'; C20)
 35 Control Temperature 10' radius (DR
     40T, EF 50 degrees; C15)
 35 Dissolve (R 120', DR 3-18 days, EF
     3,000 sq.ft. x 10'; C20)
  40 Lower Water (R 240', DR 10T, EF 1/2
     height; X16)
  40 Open Locks, 80% (DR 6T)
  45 Pass-Wall (R 60', DR 6T, EF 5' X 10';
     X15)
  50 Move Earth (R 240', DR 6T; C21)
  55 Open Locks, 90% (DR 6T)
  55 Summon Weather (DR 240T, EF 30
     miles; C16)
  60 Reverse Gravity (R 90', EF 30' cube;
     C22)
  70 Open Locks, 100% (DR 6T)
  80 Weather Control (DR Conc., EF 240
     yards; C16)
  85 Open Locks, 110% (DR 6T)
  90 Earthquake (R 120 yards, DR 1T, EF
      175' sq; C13)
  95 Open Locks, 120% (DR 6T)
 100 Wish (M10)
D. Defenses
D1. Cures
 Cost
   10 Remove Fear (DR 3T, EF +6 Save;
      B27)
   15 Cure Wounds (EF 7 hp; B26)
  20 Cure Blindness (R Touch; X6)
  20 Cure Disease (R 30'; X6)
  25 Free Person* (R 120', EF up to 4 cr;
      X12)
  25 Cure Wounds, Serious (EF 14 hp; X7)
   30 Neutralize Poison (R Touch; X8)
   35 Cure Wounds, Critical (EF 21 hp; C12)
   40 Free Monster* (R 120', EF up to 4 cr;
      X15)
   45 Remove Geas* (R 30'; X16)
   50 Stone to Flesh (R 120', EF 10' cube;
      X16)
   60 Raise Dead (R 120', EF 132 days dead;
      X9, C12)
   65 Remove Charm* (R 120', EF up to
      20' cube: C24)
   70 Remove Curse (R Touch; X14)
   85 Raise Dead Fully (R 60', EF up to 8
      years dead; C13)
   95 Regeneration (EF 3 hp/r for 1T)
  100 Heal (R Touch; M9)
  100 Automatic Healing (Self only)

[Master artifact page 50]
D2. Personal Bonuses
 cost
   10 Memorize + 1 bonus spell level
   20 AC bonus -2 (DR 6T)
   20 Ability Score bonus (DR 6T, EF 1 ran-
        dom score)
   20 Memorize + 2 bonus spell levels
   25 Parry (DR 6T)
   25 Saving Throws bonus + 2 (DR 6T)
   30 Hit points bonus + 1 per Hit Die (DR 1T)
   30 Memorize + 3 bonus spell levels
   35 Dodge normal missiles (DR 1T, EF Save
        vs. wands)
   35 Size Control (DR 6T, 3" to 18')
   40 Ability Score bonus (DR 6T, EF 2 ran-
        dom scores)
   40 AC bonus -4 (DR 6T)
   40 Memorize + 4 bonus spell levels
   45 Elasticity (DR 12T, EF 1/2 Dmg blunt
        weapons)
   50 Dodge any missiles (DR 1T, EF Save vs.
        Wands)
   50 Memorize + 5 bonus spell levels
   50 Saving Throws bonus + 4 (DR 6T)
   60 Ability Score bonus (DR 6T, EF 3 ran-
        dom scores)
   60 AC bonus -6 (DR 6T)
   60 Hit points bonus + 2 per Hit Die (DR
        6T)
   60 Memorize + 6 spell bonus levels
   65 Dodge directional attacks (DR 1T, EF
        Save vs. Wands)
   65 Polymorph Self (DR 46T; X14)
   70 Memorize + 7 bonus spell levels
   75 Saving Throws bonus + 6 (DR 6T)
   80 Ability Scores bonus (DR 6T, EF 4 ran-
        dom scores)
   80 AC bonus -8 (DR 6T)
   80 Memorize + 8 bonus spell levels
   85 Inertia control (DR 4 hours, 1 obj)
   90 Hit points bonus + 3 per Hit Die (DR 1T)
   90 Memorize + 9 bonus spell levels
  100 Ability Scores bonus (DR 6T, EF all
        scores)
  100 AC bonus -10 (DR 6T)
  100 Memorize + 10 bonus spell levels
  100 Shapechange (DR 40T, EF any cr or obj
        40'/4,000 cn; M9)
D3. Personal Protections
 cost
   10 Shield (DR 6T; B40)
   15 Anti-Magic 10% (DR 6T)
   15 Mindmask (R Touch, DR 12T; X11)
   15 Water Breathing (R 30', DR 1 day; X12)
   20 Invisibility (B41)
   20 Immune to Disease (R Touch, DR 18T)
   25 Invisibility 10' radius (R 120'; X12)
   30 Immune to Paralysis (R Touch, DR 6T)
   30 Security (EF Trap 5 items, alarm only)
   35 Anti-Magic 20% (DR 6T)

  40 Immune to Poison (DR 18T, EF self
     only)
  50 Immune to Aging attacks (R Touch, DR 18T)
  55 Anti-Magic 30% (DR 6T)
  60 Mass Invisibility (R 240', EF 60' sq, 300
     man-size; C22)
  65 Survival (DR 48 hours; M3)
  70 Statue (DR 80T, EF + 2 Init; C23)
  75 Anti-Magic 40% (DR 6T)
  80 Immune to Energy Drain (R Touch, DR
     6T)
  80 Mind Barrier (R 10', DR 48 hours, EF
      + 8 ST; C24)
  85 Protection from Magical Detection (DR
     6T, EF self + items)
  95 Anti-Magic 50% (DR 6T)
 100 Luck (DR 1T, EF Choose result of 1 roll)
 100 Immunity (DR 40T, EF blocks L1-3
     spells and half effect of magic weapons +
     L4, L5; M9)
 100 Immune to Breath Weapons (R Touch,
     DR 1T)
D4. Misdirection
 cost
  10 Ventriloquism (R 90', DR 3T; B40)
  15 Confuse Alignment* (R Touch, DR 40T;
      X5)
  20 Obscure (DR 40T, EF 400 sq.ft./40' high;
      C15)
  25 Mirror Image (DR 6T, EF 5 false images;
      B42)
  30 Hide in Shadows, 30% (DR 6T)
  30 Massmorph (R 240', EF 100 man-size;
      X13)
  35 Hallucinatory Terrain (R 240'; X13)
  40 Merging (DR 18T, EF 7 cr)
  45 Hide in Shadows, 50% (DR 6T)
  50 Phantasmal Force (R 240', EF 40' cube;
      B42)
  60 Hide in Shadows, 70% (DR 6T)
   70 Projected Image (R 240', DR 6T; X16)
  90 Blend with surroundings (DR 6T)
D5. Barriers
 cost
   10 Resist Cold (DR 12T, EF +2 ST, -l/die
       D, 30'; B27)
   10 Protection from Evil (DR 6T; B40)
   15 Resist Fire (DR 6T, EF +2 ST, -1/die D;
       X5)
   20 Protection from Normal Missiles (R 30',
       DR 12T; X12)
   20 Protection from some creatures (DR 6T,
        EF up to 5 HD)
   25 Protection from Evil 10' Radius (DR
        12T, EF + 1 ST; X8)
   25 Bug Repellant (DR 40T, + 4 ST)
   25 Ice, Wall (R 120', DR 12T, EF 1200
        sq.ft.; X13)
   25 Wall of Fire (R 60', DR Conc., EF 1200
        sq.ft.; X14)

 30 Anti-Plant Shell (DR 6T; C16)
 30 Protection from Poison (R Touch, DR
    40T, EF + 4 vs. breath; M5)
 35 Wall of Stone (R 60', EF 1,000 cu.ft.;
    X15)
 35 Shelter
 40 Protection from Lightning (R Touch,
    DR 40T, EF 40 dice D; C15)
 40 Protection from many creatures (DR 6T,
    EF up to 15 HD)
 45 Anti-Animal Shell (DR 40T; C16)
 50 Wall of Iron (R 120', EF 500 sq.ft.; C21)
 60 Protection from most creatures (DR 6T,
    EF up to 15 HD)
 70 Barrier (R 60', DR 12T, EF 7-70 D;
    C12)
 75 Anti-Magic Shell (DR 12T; X15)
 80 Force Field (R 120', DR 6T, EF 5,000 sq.ft.; M8)
 85 Protection from all creatures (DR 6T)
100 Prismatic Wall (R 60', DR 6T, EF
    10' radius or 500 sq.ft.; M9)

[Master artifact page 51]
Explanations of Powers
The following are definitions of the new special abilities, listed in alphabetical order.
   Spell effects: Any entry on the charts in
italic type is a standard spell effect. A page
reference is given for each. Some spell details
are also given, in abbreviated form, for your
convenience.
   Spells and common abilities are not
explained in the following list.

   Ability Score Bonus: One or more of the
user's ability scores immediately increases to
maximum (18), and remains there for 1 hour.
The user immediately gains all benefits
derived thereby. The ability scores affected
are determined randomly (roll ld6).
   Acid Breath: The user may exhale a
breath weapon of acid in a line up to 30 feet
long and 5 feet across, which inflicts a num-
ber of points of damage equal to one-half the
current hit points of the user (rounded
down). Each victim may make a Saving
Throw vs. Dragon Breath to take 1/2 dam-
age. The acid evaporates within 1 round.
The Power Point cost is used for each breath.
   Anti-Magic: Temporary magical effects
may be negated when within 5 feet of the
user; the chance of failure is the percentage
given. Permanent magic is not affected. Each
magical effect or item is checked separately. If
magic is negated it will remain inactive for 1
turn after it leaves the Anti-Magic area.
   Anti-Magic Ray: This effect is similar to
that of the central eye of a beholder. The user
may produce a silvery ray of light up to 60
feet long and 10 feet across. By concentrat-
ing, the user may maintain the ray for up to 1
turn. This ray causes all magic within it to
become deactivated. Magic items and effects
return to normal when the ray is no longer
upon them.
   Armor Class Bonus: The user gains the
given bonus to his or her Armor Class rating.
   Automatic Healing: A cureall effect (iden-
tical to the 6th level cleric spell) can be pro-
duced on command. The artifact will cure
damage, poison, disease, paralysis, a curse,
blindness, or feeblemind. The artifact must
be physically touching the user for this effect
to be produced. The artifact can be set to
respond automatically for 1 turn if the user's
hit points reach 0.
   Bearhug: This effect lasts for 1 turn. The
user may attack any opponent of approxi-
mately the same or smaller size by using two
arms instead of a weapon or spell. Both hands
must be empty. If a Hit roll succeeds, the
attacker may squeeze for 2-16 points of dam-

age, and may hold on. Any victim held may
make a Saving Throw vs. Death Ray to
escape the grip; the attacker may automati-
cally squeeze causing 2-16 points of damage
each round held.
   Blasting: The user may cause the artifact
to produce a loud trumpeting which lasts for
1 round. The blast is a cone 60 feet long and
20 feet wide at its end. Each victim within the
area takes 2-12 points of damage, and must
make a Saving Throw vs. Spells or be deaf-
ened for one turn.
   Blend with Surroundings: The user and
his equipment may change color and pattern
to match his or her surroundings. While thus
hidden, the user is completely undetectable
except by magical means or physical touch.
   Bug Repellant: As with the potion, "Bug"
includes any form of arachnid, insect, or chi-
lopod. The user cannot be touched by any
normal bug, and a giant-sized bug will ignore
the user unless it makes a Saving Throw vs.
Spells. The effect also bestows a + 4 bonus to
all Saving Throws against magically sum-
moned or controlled bugs.
   Buoyancy: This effect prevents the user
from sinking unless encumbered to more
than the amount given. This power does not
give the user the ability to move freely
through sinking terrains. The user may also
cause any item or items touched to share the
buoyancy, thus supporting a sailing vessel
that would otherwise sink. If the user begins
to sink, one or more items may be released
from the effect.
   Burrowing: The user may quickly dig
through earthen material with bare hands.
Movement through loose earth or sand is 60
feet per round; through dense hard-packed
earth, 30 feet per round; and through solid
rock, 10 feet per round. Metal cannot be pen-
etrated. A tunnel will remain after the bur-
rowing.
   Calm Others: The user may affect up to 40
Hit Dice of creatures within 120 feet with this
magical calm. No saving throw applies; the
DM makes an immediate Monster Reaction
roll for the creatures with the usual 2d6 but
applying a + 4 bonus to the roll.
   Change Odors: The user may cause the
odors in the volume of a 30 foot cube to
change to whatever scents are desired. Poison
cannot be created. The change is permanent.
   Change Tastes: The user may cause the
tastes of a quantity of food or liquid to change
to any taste desired. Poison cannot be
affected, and the food or liquid is not actually
changed in any way. The effect can change up
to 20 cubic feet. The change is permanent.
   Choose Best Option: The user may think

of two or more possible actions at a decision
point, and ask the artifact to choose the one
which will probably be best for the user. The
answer is revealed telepathically. The user
may define "best" in terms of a goal, such as
safety, speed, etc. Without a specific defini-
tion, the artifact will interpret "best" as
being most likely to achieve or fu rther its own
purpose. The artifact will only consider possi-
bilities up to 1 turn in the future, utterly
ignoring possible consequences beyond that
point. The artifact never reveals details, nor
can it consider or offer an option that is not
specifically presented to it.
   Climb Walls: See "Thief Ability"

   Communication: The user may concen-
trate on any one living or undead creature,
and that individual is instantly aware of
desire for communication. The individual
may accept or deny the contact. If accepted,
the user and the individual may converse tel-
epathically for up to 1 turn, regardless of
their locations, and even if on different planes
of existence. If the target creature denies the
contact, the user is thereafter unable to make
such contact with that individual for 24
hours. The point cost applies per hour, not
per attempt.
   Container: An artifact with this power can-
not have life trapping or shelter powers. The
artifact will act similar to a bag of holding.
However, the artifact also can "store" any
object in the possession of the user when a
command is spoken, teleporting the object
into the artifact. Creatures cannot be stored,
nor can an item being touched by any other
creature. The containment power lasts for 6
hours, but may be extended (at further cost in
Power). Any or all items may be released on
command of the user (only). All items con-
tained when the duration expires are
instantly disintegrated (no saving throw).
   Control (Animal, Dragon, Giant, Hu-
man, Plant, Undead): These effects are simi-
lar to those of the potions of the same names,
but the duration is 20 Turns. The user must
see the victims to control their actions. The
controlled creatures cannot be forced to kill
themselves. The user cannot fight or cast
spells while controlling others, but may move
at up to 1/2 normal rate. Each victim may
make a Saving Throw vs. Spells to avoid the
control, but the user may repeat the attempt
once per round until the effect's duration
ends. Limits:
Animals: Up to 40 Hit Dice of normal or
    giant-sized animals, but not fantastic or
    magical creatures; up to 20 individuals.

[Master artifact page 52]

Giants: One type only; up to 4 giants.
Humans: Only affects those of 7 Hit Dice or
    less; up to 40 Hit Dice, up to 20 persons
    (Normal Men 1/2 H D each).
Plants: All plants in a 30'x 30' area.
Undead, Lesser: Only those of 9 Hit Dice or
    less; up to 20 Hit Dice, up to 10 individ-
    uals.
Undead, Greater: Any undead; up to 40 Hit
    Dice, up to 20 individuals.
   Create Magical Aura: The user may cause
all creatures and objects within an area to
radiate light when a detect magic spell is used
within range. A volume 40 cubic feet can be
affected.
   Create Normal Objects: The user may cre-
ate one normal, non-magical, non-living
object that has a weight of 1,000 cn or less.
The user must have previously seen the
object to create it with this power. An equal
weight of any other solid material must be
used in the creation process. Treasure may
not be created.
   Detect New Construction: This effect is
identical to the ability possessed by all
dwarves, but is 100% successful. The user
may detect all signs of new construction
within 100 square feet in 1 round.
   Detect Slopes: It is identical to the ability
possessed by all dwarves, but is 100% suc-
cessful. The user may detect all sloping sur-
faces within 100 square feet in 1 round.
   Disarming attack: This effect can be used
only against a weapon-using opponent. To
disarm, the user makes a normal Hit roll. If
the attack hits, no damage is inflicted. The
victim must roll ld20, subtracts any of his or
her Dexterity bonuses, but adds any of the
attacker's Dexterity bonuses. If the modified
result is greater than the victim's Dexterity,
the victim is disarmed. For weapon-using
monsters, assume a Dexterity of 11.
   Dodge normal missiles: This effect allows
the use to dodge any missile fired or thrown
weapons. If any such attack would hit, the
user may make a Saving Throw vs. Wands to
dodge the missile. Once the user dodges, he
or she can take no further actions that round.
A maximum of 6 missiles per round can be
dodged. If more than six missiles will hit the
user in a round, the user may choose the mis-
siles he or she wishes to dodge.
   Dodge any missiles: This effect is identical
to dodge normal missiles, except that missiles
of any sort can be dodged, including siege
engine missiles, and even missiles from a
magic missile spell.
   Dodge directional attacks: If attacked with
any missile, ray, beam, cone-line-shaped
attack (including breath weapons), and if

physical evasion is at all possible, the user
may dodge the attack, avoiding 100% of the
effect, by making a successful Saving Throw
vs. Wands. A maximum of one missile or
effect per round can be dodged. If dodging is
physically impossible in the situation, a nor-
mal saving throw (if applicable) can still be
made.
   Elasticity: This effect is identical to the
potion of the same name. The user may
stretch his or her body, plus all equipment
carried, to any form up to 30 feet long or 1
inch thick. While stretched, the user cannot
attack or cast spells, but only takes 1/2 dam-
age from blunt weapons (boulders, mace,
etc.).
   Find Secret Doors: The user will automat-
ically find any secret doors present when
searching an area.
   Find Traps: See "Thief Ability"
   Fire breath: The user may exhale a breath
weapon of fire in a cone up to 30 feet long and
10 feet across, which inflicts a number of
points of damage equal to one-half the cur-
rent hit points of the user (rounded down).
Each victim may make a Saving Throw vs.
Dragon Breath to take 1/2 damage. The
power point cost is applied per breath.
   Gaseous Form: By concentrating, the user
and all equipment carried can become gas-
eous. While gaseous, the user may move 360
feet per turn. The effect lasts for 3 turns, and
cannot end sooner except by dispel magic. It
can, however, be extended while the user and
artifact are still in gaseous form (assuming
that Power remains to do so).
   Hear Noise: See "Thief Ability"
   Hide in Shadows: See "Thief Ability"
   Hit points bonus: This effect lasts for 1
turn or until damage is taken which negates
its effects. The user immediately gains the
given number of additional hit points per Hit
Die. Damage to the user is subtracted from
the magical hit points first.
   Ice breath: The user may exhale a breath
weapon of icy cold in a cone up to 30 feet long
and 10 feet across, which inflicts a number of
points of damage equal to one-half the cur-
rent hit points of the user (rounded down).
Each victim may make a Saving Throw vs.
Dragon Breath to take 1/2 damage. The
power point cost is used for each breath.
   Immune to Aging: The user is immune to
any attack form that causes aging or wither-
ing for the duration.
   Immune to Breath Weapons: The user
cannot be affected by any type of breath
weapon for the duration.
   Immune to Disease: The recipient cannot
be diseased by any means for the duration.

   Immune to Energy Drain: The recipient
cannot lose levels or hit dice due to energy
drain for the duration. Physical damage from
such attacks is handled normally.
   Immune to Paralysis: The recipient is
immune to all forms of paralysis, including
hold person spells for the duration.
   Immune to Poison: The user (only) cannot
take damage nor be slain by poison of any
sort, whether natural or magical. The poison
simply does not enter the user's system.
   Inertia control: The user may command
any object carried to "stop." The item com-
manded then stops, wherever it is, and can-
not be moved by any means, even a wish. A
second command releases the stopped object.
If the object is in motion when stopped, it
resumes its motion (with full previous inertia)
when released.
   Leap: The user may magically leap up to
the maximum range given. If attacking an
opponent at the conclusion of the leap, apply
the given bonus to the Hit roll.
   Lie Detection: The user may concentrate
on one creature within 120 feet, and can
sense whether that creature is intentionally
lying. The creature need not be speaking to
the user.
   Life Trapping: An artifact with this power
cannot have container or shelter powers. If
the user touches another creature with the
artifact while saying the proper command
word, the victim must make a Saving Throw
vs. Spells or be sucked into the artifact, com-
plete with equipment. The artifact can store
only one creature; if one is already within, it
is ejected and replaced by the new victim.
The victim will survive and will not age for as
long as the entrapment lasts. The victim can-
not be seen or heard, but telepathy or ESP
can make communication possible.
   Luck: This effect lasts for 1 turn (or until
used), and is identical to that of the potion of
the same name. The player of the character
using the artifact may choose the result of any
one of his or her die rolls, instead of rolling a
random result. Other players' rolls cannot be
affected, nor can rolls made by the DM , and
a roll already made cannot be changed.
   Mapmaking: The artifact controls the
user's hands. The map drawn will cover all
designated areas within 60 feet. All physical
features (such as secret and trap doors) are
noted on the map, but not magic, creatures,
or treasure.
   Memorize bonus Spell levels: If a spell
caster, the user may activate this power and
then gain the additional number of spell
levels given for one use. Any number of spells

[Master artifact page 53]
       e acquired, if their total levels is within
       )nus limit, but the bonuses cannot be
       o increase the level of other spells mem-
        , nor can a spell be learned if the caster
       tot know the spell.
       rging: This effect is identical to that of
the potion of the same name. A maximum of
7 other creatures can, with the permission of
the user, merge their forms with that of the
user. They may emerge and re-merge as often
as the user will permit.
   Move Silently: See "Thief Ability"
   Open Locks: See "Thief Ability"
   Parry: The user may, in any melee round,
block incoming attacks. All those in hand-to-
hand combat with the user suffer a -4penalty
to their Hit rolls. This does not apply to
device-hurled missiles (such as arrows), but it
does apply to thrown missiles.
   Pick Pockets: See "Thief Ability"
   Plane Travel: The user and all equipment
carried may move from one plane of exist-
ence to any adjacent plane. No other creature
can be affected.
   Poison gas breath: The user may exhale a
breath weapon of poison gas in a cloud up to a
20 feet square. Each victim within the cloud
must make a Saving Throw vs. Dragon
Breath or die. The user is not affected by the
cloud. The cloud remains in place for 3 full
rounds unless moved or dispersed by magical
wind. The power point cost is used for each
breath.
   Protection from all creatures: The user
cannot be physically touched by any crea-
ture. Claw and bite attacks are completely
blocked. Weapon, spell, or other attacks not
involving physical contact are not affected.
   Protection from Magical Detection: The
user and all items carried cannot be detected
by magical means, and will not glow if within
range of a detect magic.
   Protection from many creatures: The
effect is identical to protection from all crea-
tures, except that only creatures of 10 Hit
Dice or less are blocked.
   Protection from most creatures: This effect
is identical to protection from all creatures,
except that only creatures of 15 Hit Dice or
less are blocked.
   Protection from some creatures: This
effect is identical to protection from all crea-
tures, except that only creatures of 5 Hit Dice
or less are blocked.
   Regeneration: For 1 turn the user regains
hit points lost to damage at the rate of 3 points
per round. The regeneration will not occur if
the user's hit points reach 0 or less.
   Remove Traps: See "Thief Ability"
   Repair Normal Objects: The user may

permanently repair all scars and damage in
one or more normal items, restoring them to
new condition. Pieces broken off an item
must be held to their original positions to be
restored. Any number of items weighing a
total of up to 1,000 cn can be repaired, but an
item larger than 1,000 cn cannot be affected.
The repair does not remain magical.
   Repair Temporary Magical Object: The
user may permanently repair all scars and
damage (including complete breaks) in any
one temporary magic item, such as a wand
partially damaged by acid or fire. Pieces bro-
ken off an item must be held to their original
positions to be restored. A permanent item
(such as a magical sword or shield) cannot be
affected.
   Repair Permanent Magical Object: This
power is identical to repair temporary magic
item (above), except that any magic item
made by a mortal can be repaired. The repair
is permanent. This will not repair artifacts.
   Rulership: This effect is identical to that of
a rod ofruling. If the user carries the artifact
throughout his or her dominion, it adds a
bonus to all Confidence checks, based on the
percentage of residents seeing it:
   1-50% + 1 0       91-99%             + 40
   51-75% + 2 0 100%                    + 50
   76-90% + 3 0
   The power cost applies for one dominion.
   Saving Throws bonus: The user gains the
given bonus to all saving throw rolls. Despite
this bonus, a "natural" roll of 1 always indi-
cates failure.
   Security: This effect is similar to that of the
pouch ofsecurity The user may protect up to
5 items owned with a trap. If any trapped
item is removed from the user's possession
without permission, the item screams "I am
being stolen!" repeatedly for 1 hour. Its cries
can be heard to 120'. The user may silence
the cries on command.
   Set normal Trap: If the proper materials
are available, the user may set one small, nor-
mal trap of a type removable by a thief.
Three types of traps may be set: traps that
cause one to six dice of damage; traps that
entangle a victim; and combination traps
that entangle and cause one to three dice of
damage. If a percentage is given for this abil-
ity, that is the chance that the trap will func-
tion as intended. If it malfunctions, it cannot
be triggered, and can be removed by any
thief (no roll required).
   Shelter: An artifact with this power cannot
also have container or life trapping powers.
The user may enter and depart from the artifact as often as desired. While within it, the
user does not age, and needs no sustenance.

The effect is similar to life trapping, but
under the complete control of the user (who
may sleep, meditate, etc. while within). The
artifact can only contain one creature, the
user, and no other power can force entry. The
power point cost activates the shelter feature
for 24 hours. If the duration ends while the
artifact is occupied, the user is ejected; but
the power may be extended at any time, even
while occupied, with cumulative effect.
   Size control: The user may shrink or
enlarge to any size from 3 inches to 18 feet
tall, along with all equipment carried, as
often as desired. Treat the same as Changing
Monsters, but modification because of size
can range from -6 to - 1 fro smaller, to + 1 to
 + 6 if larger.
   Smash attack: If the user decides to Smash
with a weapon, he or she automatically loses
initiative, and accepts a -3 penalty to the Hit
roll. If the attack hits, the user's Strength
score is added to the damage, plus standard
bonuses (if applicable).
   Spell damage bonus: This effect adds a
bonus per die of damage caused.
   Thief Ability (Climb Walls, Find Traps,
Hear Noise, Hide in Shadow, Move Silently,
Open Locks, Pick Pockets, or Remove
Traps): Each of these is identical to the stand-
ard thief ability. The user may activate the
power and use it as if a thief for the given
duration of the effect.
     Climb Walls applies to any steep sur-
  face, such as a sheer cliff, corridor wall,
  etc. The chance is checked once for
  every 100' of climbing. The rate of
  climbing is 2 to 20 feet per round, vary-
  ing because of the sheerness of the sur-
  face, available niches and cracks, etc.
     Hear Noise: If the attempt succeeds,
  the user can pick out individual voices or
  sounds up to 120 feet away, or half that if
  there is an intervening barrier (door,
  curtain, etc.)
     Hide in Shadow always seems suc-
  cessful, but only the DM knows for sure.
  The user may move while remaining in
  shadow, but cannot remain hidden
  while attacking.
     Move Silently always seems success-
  ful, to the individual, but only the DM
  knows for sure.
     Open Locks: This may only be tried
  once per lock, but no Thieves' Tools are
  needed. Special difficult locks may
  reduce the chance of success by - l o % , -
  20%, -30%, -40%, or -50%.
     Pick Pockets: Note that 5 % is sub-
  tracted for each level or Hit Die of the
  victim.

[Master artifact page 54]

     Remove Traps: If failure is indicated,
  the trap is triggered.
   Timekeeping: The artifact may be told to
"mark," and will keep perfect time from that
point for up to 24 hours. The user may there-
after ask for the time, and will become magi-
cally aware of the exact length oftime that has
passed since the mark. The artifact can keep
track of up to 3 separate "marks" simultane-
ously. The Power cost applies for each mark.
   Tracking: The user may follow tracks of
any one creature if not greater than 24 hours
old. Different percentage chances of success
are given for outdoor and indoor settings.
The chance of success should be checked
every 1/2 mile of tracking outdoors, or cvrry
240 feet of tracking indoors This magical
tracking is unaffected by weather, obstacles,
or any deliberate obscurement of the traces.
   Treasure Finding: The user may concen-
trate and sense the direction of the larqest
treasure (but not necessarily the most valu-
able) within 400 feet.
   Tree Movement: T h r user may swing
through the trees, as if an agile monkey, at
full normal rate (modified by encumbrance).
   Turn Undead: This is identical to the
standard Cleric ability.
   Turn Undead bonus: If the user can Turn
undead monsters by any means, a bonus
applies to both the initial die roll (if any) and
to the number of Hit Dice Turned or
Destroyed if the attempt succeeds. These
bonuses do not change "T" or "D" results.
   Victory: This effect is identical to that of a
rod of victory The user is lucky in war; apply
the following details to the War Machine
mass combat system. The artifact power may
be expended only once, at any time during
the battle, to produce effect.
1. + 25 bonus to the Combat Results roll.
2. When using the Combat Results Table, if
    the difference in totals is 101 or more in
    favor of the user's opponents, use the
    result for "91-100," limiting the number
    of casualties.
   Weapon damage bonus: for 1 turn. If the
bonus is "double" or "triple," modify the
result of the die roll before adding other
bonuses.
   Weapon strength bonus: The user adds the
number given to the weapon strength (magi-
cal plusses) of any weapon used Normal
weapons are simply treated as if enchanted,
with strength equal to the number aiven.
This bonus is added to both Hit and damage
rolls.
   Web Movement: The user may move
through webs as if a spider at full normal rate
(modified by encumbrance) Webs will not

stick to the user or any items carried.
   X-Ray Vision: This effect may only be
used once per hour at most. The user may see
through any material except metal to a range
of 30 feet. The user may examine up to 400
square feet in 1 turn.

     TABLE 3: ADVERSE EFFECTS
Select Handicaps and Penalties from the fol-
lowing lists. Those selected, though definitely
adverse to the user of the artifact, should nev-
ertheless further the artifact's goals in some
way, or be otherwise consistent with the artifact's Sphere.
   No saving throws apply unless noted in the
description. Remember that Handicaps are
permanent effects, Penalties can be dispelled.
   Whenever an effect specifies a change of
the user's mental state (including new
desires, mental aberrations, or even posses-
sion by another being), privately explain the
situation to the player, and ask that he or she
continue to play the character, incorporating
the change. O r else make the character an
NPC: (temporarily or permanently, as
needed), and play it yourself.
   The following effects are often described as
general principles, ideas for your further
development. More specific details may be
added by the DM. You might apply a penalty
to Hit rolls only when the character uses a
specific type of weapon. A spell loss or modi-
fication might apply only to one spell or a
type of spell. The "loss of 5 spell levels" could
be applied to any spells, to 1st level spells
only, or to defense spells only.
   The DM may cause a Handicap or Penalty
to be triggered only by a future random or
specified event. This "trigger" could be
nearly anything-the use of a certain power
of artifact, or at random only at a given place
or time, and so forth. Change any and all of
these effects as desired, and add new ones.

3A. SUITABLE FOR HANDICAPS
    ONLY
   Doom (Major artifact only): When Doom
strikes, the character is permanently
removed from the game. Alternately, it may
remove the character until a number of
wishes are used to effect his or her return, or
until other PCs journey to an Outer Plane.
   Doom may take many forms, but none are
escapable. The character's body might or
might not vanish in the process, and the same
applies to equipment. If the body remains,
another life might occupy it, possibly at the
same instant that Doom strikes the character.
Such a life force might be peaceful, hostile,

sneaky and vengeful, or indifferent.
   Lameness: The wielder loses the full use of
one limb and either attacks as half level with
that limb or can move only at half speed.
   Magic error (not for Sphere of Energy): A
chance of error applies whenever the user
casts a magical spell or uses any magical
device requiring a command word. The
chance of error may be from 10% to 8 0 % ,
varying by the magnitude of the artifact. If
magic error occurs, the memory of the spell
or charge(s) from the device is lost. Either
nothing or a spectacular misfire may occur.
   Operating Costs: The user loses a percent-
age of all treasure owned, magically con-
sumed by the artifact for power. The treasure
(including magic items, dominion resources,
etc.) cannot be recovered or protected. The
percentage of assets destroyed may be as low
as 1% or as high as 50%, and the costs may
apply whenever used, to a specific power, or
merely when the artifact is first used.
   Recharging Costs: The artifact does not
recharge itself automatically, but must be
"fed" a source of power. The power source
could be a specific type of treasure or magic
item, any treasure, one or more creatures,
etc.
   Sentience: The artifact is an Immortal
being, or contains one. The being revolts
when a specified or random event occurs. It
then either takes over control of the user for
4-24 days, slays the user, or takes the user
away to serve for a period of time.

3B. SUITABLE FOR PENALTIES ONLY
   Die: The user is immediately reduced to 0
hit points or less.
   Forgetfulness: The user immediately for-
gets one or more spells previously memo-
rized, as if they had been cast. The number of
spells or spell levels affected varies by the
magnitude of the artifact.
   Gaseous Form: The user, but not his
equipment, involuntarily assumes gaseous
form, and cannot perform any action but
movement until restored to normal form.
   Life Trap: The user is immediately sucked
into the artifact, along with all equipment
carried, and some other being (often
extremely dangerous and hostile) is simulta-
neously released. The user cannot be freed
until someone else discovers how to activate
the Life Trapping (or triggers it acciden-
tally.).
   Mania: The user becomes obsessed with
doing something (such as eating ants or fly-
ing) or with going somewhere or seeing some-
thing and will pursue the activity maniacally.

```

