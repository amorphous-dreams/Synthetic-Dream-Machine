# TODO: BECMI Spell Material Staging - Companion

This staging document captures spell material and associated magical-context text from `TSR 1013 - Set 3 Companion Set.pdf`.

Rules for this artifact:
- Raw classic terminology is preserved.
- This is a staging artifact, not a final crosswalk.
- `pdftotext -layout -nodiag -nopgbrk` remains the primary extractor unless a section note says otherwise.
- Parser warnings from PDF extraction stderr were suppressed and are not part of this document.
- Section methods may mix anchored line slices, page-layout extraction, cropped columns, TSV reflow, and small curated stitching when that is necessary to preserve reading order.
- Cleanup is conservative: spacing, OCR scars, and broken line wraps may be normalized, but source terminology is not converted.

Source PDF:
- `TSR 1013 - Set 3 Companion Set.pdf`

## Audit Rubric

- Coverage: the staged block should account for the claimed source section without silently dropping major witnesses.
- Reading order: columns, tables, and continuation text should preserve source order rather than left/right interleave.
- Continuation: multi-page and multi-column blocks should retain start, middle, and end states without orphaned fragments.
- Table/list survivability: representative table rows and list entries should remain readable and attached to the correct headings.
- Manual-reconstruction burden: curated or stitched text should be minimized, reproducible, and explicitly validated when unavoidable.

### High-Level Cleric, Druid, and Magic-User Spell Material

- Extraction note: section-aware Companion spell extraction using TSV coordinate reflow on the actual cleric, druid, and magic-user class pages, split so each spell block starts at its real section heading instead of earlier class spill.

```text
[Companion pages 13-14: high-level cleric spell material]
FIFTH LEVEL CLERIC SPELLS
1. Commune
2. Create Food
3. Cure Critical Wounds*
4. Dispel Evil
5. Insect Plague
6. Quest*
7. Raise Dead*
8. Truesight
SIXTH LEVEL CLERIC SPELLS
1. Aerial Servant
2. Animate Objects
3. Barrier*
4. Create Normal Animals
5. Cureall
6. Find the Path
7. Speak with Monsters*
8. Word of Recall
SEVENTH LEVEL CLERIC SPELLS
1. Earthquake
2. Holy Word
3. Raise Dead Fully*
4. Restore*
Fifth Level Cleric Spells
Cure Critical Wounds*
Range: Touch
Duration: Permanent
Effect: Any one living creature
This spell is similar to a cure light wounds
spell, but will cure one living creature of 6-21
(3d6+3) points of damage.
The reverse of this spell (cause critical
wounds) causes 6-21 points of damage to any
living creature or character touched (no Sav-
ing Throw). The caster must make a normal
Hit roll to cause the critical wound.
Raise Dead*
When cast at an Undead creature of more
Hit Dice than a vampire, this spell inflicts 3-
30 (3d10) points of damage. The victim may
make a Saving Throw vs. Spells to take 1/2
damage.
The reverse, finger of death, will actually
cure 3-30 points of damage for any Undead
with 10 or more Hit Dice (phantom, haunt,
spirit, nightshade, or special).
Truesight
Range: 0 (cleric only)
Duration: 1 turn + 1 round per level of caster
Effect: Reveals all things
When this spell is cast, the cleric is able to
clearly see all things within 120'. The spell is
quite powerful; the cleric can see all hidden,
invisible, and ethereal objects and creatures,
as with the magic-user detect invisible spell
(including secret doors). In addition, any
things or creatures not in their true form-
whether polymorphed, disguised, or other-
wise-are seen as they truly are, with no
possibility of deception. Alignment is also
"seen," as is experience and power (level or
Hit Dice).
Sixth Level Cleric Spells
Aerial Servant
Range: 60'
Duration: 1 day per level of caster
Effect: Servant fetches one item or creature
An aerial servant is a very intelligent human-
oid being from the Ethereal Plane. With this
spell, the cleric summons one of these beings,
which appears immediately. The cleric must
then describe one creature or item to the ser-
vant, or else it will depart. The approximate
location of the target must also be named.
When it hears this description and location,
the servant leaves, trying to find the item or
creature and bring it to the cleric. The ser-
vant will take as much time as needed, up to
the limit of the duration.
The aerial servant has 18 Strength, and
can carry up to 5,000 cn. It can become ethe-
real at will, and thus can travel to most places
easily. However, it cannot pass a protection
from evil spell effect. If it cannot perform its
duty within the duration of the spell, the ser-
vant becomes insane and returns to attack the
caster.
Barrier*
Range: 60'
Duration: 12 turns
Effect: Creates whirling hammers
This spell creates a magical barrier in an area
up to 30' in diameter and 30' high. The bar-
rier is a wall of whirling and dancing ham-
mers, obviously dangerous. Any creature
passing through the barrier takes 7-70 points
of damage from the whirling hammers (no
Saving Throw). This spell is often used to
block an entrance or passage.
The reverse of this spell (remove barrier)
will destroy any one barrier created by a
cleric. It can also be used to destroy a magic-
user's wall of ice, wall of fire, or wall of stone
spell effect. It will not affect a wall of iron.
Create Normal Animals
Range: 30'
Duration: 10 turns
Effect: Creates 1-6 loyal animals
The cleric is able to create normal animals
from thin air with this spell. The animals will
appear at a point chosen (within 30'), but
may thereafter be sent (by command) up to
240' away, if desired. The animals created
will understand and obey the cleric at all
times. They will fight if so commanded, and
will perform other actions (carrying, watch-

[Companion pages 15-17: druid transition, philosophy, and spell material]
Druid
A Neutral cleric of 9th level or greater may
choose to study nature instead of remaining
among "civilized" areas. This type of cleric is
called a druid. The cleric must find and live
in a woodland home, meditating for 1-4
months. During that time, the cleric is found,
tested, and taught by a higher level druid
(usually 25th level or greater), and then joins
the realm of the druids.
A druid is pure Neutral, never Lawful or
Chaotic. The druid's way of life is devoted to
the balance of all things, and the study of nat-
ure. Any change of alignment results in the
loss of all druid benefits (given below) until
Neutral alignment is restored.
The main differences between a druid and
a normal cleric are:
1 . A druid cannot cast any spell that affects
good or evil (personal or ranged protec-
tion from evil or dispel evil).
2. New spells only for druids may be cast.
The total number of spells that may be
cast in one day does not change, but a
druid may select from both the cleric and
druid lists.
3. A druid must live in a woodland home,
rather than in a town or city.
4. A druid may not wear metal armor of any
type, nor use metal items. Leather is the
only possible armor for druids, and while
a shield may be used, it must be made
entirely of wood. The standard weapon
restrictions for clerics apply to druids, and
they may only use wooden weapons (a
specially made wooden hammer, wooden
staff, etc.).
5. There are only nine* druids of 30th level,
and lesser numbers of each higher level.
When the character gains enough XP to
reach 30th level, one of the Nine must be
found and fought by unarmed combat. If
the character loses, 30th level is not gained
(but a new challenge may be issued every
3 months). Details on this combat, and
the higher ranks of the druid realm, are
given in the D&D Master Set.
*For large-scale campaigns, limits might
only apply per continent (DM's choice).
Druid Philosophy
A druid character studies life itself-the
balance of Nature and all living things. Druid
items and equipment are all made of items
that were once alive (leather, wood, etc.).
"Dead" things that have never been alive are
repulsive to the druid; the character simply
won't want to use or touch them. However,
the character should not object if others use
"dead" things. Thus, a druid can be a chal-
lenging character to play, but the role can be
very entertaining.
The great enemies of all druids are the
Undead. Druids have no power to "Turn
Undead" and may contact town churches if
Undead threaten their realms.
Every druid lives in, protects, and tends a
section of woodlands. Druids do not think of
themselves as owners, but rather as care-
takers. Nearly every tree in every woodland
is cared for by a druid. Although minor dam-
age to the woods is a fact oflife, deliberate evil
destruction of trees or nature is often pun-
ished by druids. Even Chaotic monsters
know this, and avoid harming things of the
woods lest they incur the wrath of the local
druid.
The DM and players should be sure not to
abuse this role; druids are not all-powerful,
and believe in the balance of all things. For
example, a party foraging for food would not
be attacked by a druid unless they killed more
animals than they could eat.
The battles of Law and Chaos are not the
affairs of the druids, and they may simply
watch such encounters from afar, helping nei-
ther side. When characters perform good
deeds in the woodlands, such as curing
wounded animals, this does not make the
druid automatically friendly. However,
assistance in fighting a huge disaster-such
as a magical storm or major forest fire-could
earn the gratitude and help of a druid.
Spells
The following druid spells may be learned
and cast along with normal cleric spells. The
total number of spells usable in one day does
not change from those of a cleric; the charac-
ter may select freely from both lists, except
for spells that affect Good or Evil.
Druid spells are not reversible.
FIRST LEVEL DRUID SPELLS
1 . Faerie Fire
2. Locate
3. Predict Weather
SECOND LEVEL DRUID SPELLS
1 . Obscure
2. Produce Fire
3 . Warp Wood
THIRD LEVEL DRUID SPELLS
1 . Call Lightning
2. Hold Animal
3. Water Breathing
FOURTH LEVEL DRUID SPELLS
1 . Control Temperature 10' radius
2. Plant Door
3. Protection from Lightning
FIFTH LEVEL DRUID SPELLS
1. Anti-Plant Shell
2. Control Winds
3. Pass Plant
SIXTH LEVEL DRUID SPELLS
1 . Anti-Animal Shell
2. Transport Through Plants
3. Summon Weather
SEVENTH LEVEL DRUID SPELLS
1 . Creeping Doom
2. Metal to Wood
3. Weather Control
First Level Druid Spells
Faerie Fire
Range: 60'
Duration: 1 round per level of caster
Effect: Illuminates creatures or objects
With this spell, the druid can outline one or
more creatures or objects with a pale, flicker-
ing greenish fire. The fire does not inflict any
damage. The objects or creatures need only
be detected in some way (such as by detect
magic) to be the object of this spell.
All attacks against the outlined creature or
object gain a +2 bonus to Hit rolls, as it is
more easily seen.
The druid can outline 1 man-sized crea-
ture (about 12 feet of fire) for each 5 levels of
experience. Thus, at 20th level, 48' of fire
can be produced (outlining one dragon-sized
creature, 2 horse-sized, or 4 man-sized crea-
tures).
Locate
Range: 0 (druid only)
Duration: 6 turns
Effect: Detects 1 animal or plant within 120
feet
This spell allows the druid to sense the direc-
tion of one known normal animal or plant.
The druid can locate (similar to the locate
object spell) any normal or giant-sized ani-
mal, but not fantastic creatures, plant mon-
sters, nor any intelligent creature or plant.
He must name the exact type of animal or
plant, but does not need to see the specific
one he wishes to locate. The animal or plant
gets no Saving Throw. (This spell is most
often used to find special plants.)
Predict Weather
Range: 0 (druid only)
Duration: 12 hours
Effect: Gives knowledge of coming weather
This spell enables the druid to learn the accu-
rate weather to come for the next 12 hours. It
affects an area 1 mile in diameter per level of
the druid; for example, a 20th level druid
would learn the weather within a 10 mile
radius. The spell does not give any control
over the weather, merely predicting what is to
come.
Second Level Druid Spells
Obscure
Range: 0 (druid only)
Duration: 1 turn per level of the caster
Effect: Creates a huge misty cloud
This spell causes a misty vapor to arise from
the ground around the druid, forming a huge
cloud. The cloud is 1 ' high per level of the
druid, and is 10' across for each level. For
example, a 20th level druid would cast an
obscure 20' tall and 100' radius. The cloud
has no ill effects except to block vision. The
caster, and all creatures able to see invisible
things, will be able to dimly see through the
cloud. All other creatures within the cloud
will be delayed and confused by the effect.
Produce Fire
Range: 0 (druid only)
Duration: 2 turns per level
Effect: Creates fire in hand
This spell causes a small flame to appear in
the druid's hand. It does not harm the caster
in any way, and sheds light as if a normal
torch. The flame can be used to ignite com-
bustible materials touched (lantern, torch,
oil, etc.) without harming the magical flame.
While holding the flame, the caster can cause
it to disappear and reappear by concentration
once per round, until the duration ends.
Other items may be held and used in the
hand while the fire is out. If desired, the fire
may be dropped or thrown to 30' range, but
disappears 1 round after leaving the druid's
hand.
Warp Wood
Range: 240'
Duration: Permanent
Effect: Causes wooden weapons to bend
This spell causes one or more wooden weap-
ons to bend and (probably) become useless.
The spell will affect one arrow for each level
of the caster; a spear, javelin, or magic wand
is treated as two arrows' worth, and any club
or staff (magical or otherwise) as four. The
spell will not affect any wooden items other
than weapons. If a magical wooden item is
the target (such as a staff, the wielder may
make a Saving Throw vs. Spells to avoid the
effect. Items carried but not held get no Sav-
ing Throw; magical items with "plusses"
might not be affected, at a 10% chance per
"plus." (For example, an arrow +1 would
have a 10% chance of being unaffected.)
Third Level Druid Spells
Call Lightning
Range: 360'
Duration: 1 turn per level of the caster
Effect: Calls lightning bolts from a storm
This spell cannot be used unless a storm of
some (any) type is within range of the druid.
If a storm is present, the druid may call 1
lightning bolt per turn (10 minutes) to strike
at any point within range. The lightning bolt
descends from the sky, hitting an area 20'
across. Each victim within that area takes 8-
48 (8d6) points of electrical damage, but may
make a Saving Throw vs. Spells to take 1/2
damage. The druid need not call the light-
ning every turn unless desired; it remains
available until the spell duration (or the
storm) ends.
Hold Animal
Range: 180'
Duration: 1 turn per level of the caster
Effect: Paralyzes several animals
This spell will affect any normal or giant-
sized animal, but will not affect any fantastic
creature, nor one of greater than animal
intelligence. Each victim must make a Saving
Throw vs. Spells or be paralyzed for 6 turns.
The druid can affect 1 Hit Die of animals for
each level of experience, ignoring "plusses"
to Hit Dice. For example, a 20th level druid
could cast the spell at 10 giant toads (2.2 Hit
Dice each). Note that the spell can affect sum-
moned, conjured, or controlled animals.
Water Breathing
Range: 30'
Duration: 1 day
Effect: One air-breathing creature
This spell allows the recipient to breathe
while under water (at any depth). It does not
affect movement in any way, nor does it inter-
fere with the breathing of air.
Fourth Level Druid Spells
Control Temperature 10 ' radius
Range: 0 (druid only)
Duration: 1 turn per level of the caster
Effect: Cools or warms air within 10'
This spell allows the druid to alter the tem-
perature within an area 20' across. The max-
imum change is 50 degrees (Fahrenheit),
either warmer or cooler. The change occurs
immediately, and the effect moves with the
druid. The temperature may be changed by
mere concentration for 1 round, as long as
the spell lasts.
The spell is useful for resisting cold or heat
so the caster may survive any temperature
extremes.
Plant Door
Range: 0 (druid only)
Duration: 1 turn per level of the caster
Effect: Opens a path through growth
For the duration of this spell, no plants can
prevent the druid's passage, no matter how
dense. Even trees will bend or magically open
to allow the druid to pass. All equipment car-
ried can also be moved through such barriers,
but no other creature can use the passage.
Note that a druid can hide inside a large
tree after casting this spell. The druid cannot
see what is happening while he is in the tree.
Protection from Lightning
Range: Touch
Duration: 1 turn per level of the caster
Effect: Protects against electrical attack
Any recipient of this spell is immune to a
given amount of electrical damage. The exact
amount is determined by the level of the
druid: for each level of experience, one Die of
damage is negated. Thus, a 20th level druid
could be protected against 2 full call lightning
attacks (of 8 dice each), plus half of a third.
Any electrical attacks partially negated are
handled normally for the remaining damage;
in the example above, the druid would take 4-
24 points of damage, or 2-12 points if the Saving Throw were made.

[Companion pages 22-24: layout-column recovery for fifth- through seventh-level magic-user spell bodies]
    Fifth Level Magic-user Spells
    Contact Outer Plane
    Range: 0 (magic-user only)
    Duration: See below
    Effect: 3-12 questions may be answered
    This spell allows the magic-user to contact
    one of the Outer Planes of Existence to seek
    knowledge from an Immortal creature
    (played by the DM). The wisest and most
    powerful Immortals live on the most distant
    Outer Planes. However, mental contact with
    an Immortal may cause a mortal to go
    insane. The more distant the plane, the
    greater the chance of a correct answer-but
    the greater the chance of Insanity as well.
       The number of questions the magic-user
    may ask is equal to the distance* to the Outer
    plane. The caster may choose the distance,
    up to the maximum allowed. The chance of
    insanity is checked once, when the Immortal
    is first contacted. If the caster is 21st level or
    greater, the chance of insanity is reduced by
    5 % per level of the caster above 20. If insan-
    ity does not result, the Immortal may still not
    know the answer, or may lie. The chances of
    knowing and lying are checked for each ques-
    tion.

    Distance and
    Number of Questions   Chance of Insanity   Knowing   Lying

         3           5%           25 %          50 %
         4           10            30            45
         5           15           35            40
         6           20           40            35
         7           25           50            30
         8           30           60            25
         9           35            70           20
         10          40            80           15
         11          45            90           10
         12          50            95            5
Move Earth
Range: 240'
Duration: 6 turns
Effect: Moves soil
This spell causes soil (but not rock) to move.
It may be used to move earth horizontally to
make a hill, or vertically, to open a large hole.
The hole may be up to 240 ' deep, unless solid
rock is reached. The soil may be moved at up
to 60' per turn, and at the end of the spell
duration, the moved soil remains where it is
put. The spell is helpful for constructing cas-
tles.
Reincarnation
Range: 10'
Duration: Permanent
Effect: Creates a new body
To cast this spell, the magic-user must have
part of the dead body, however small that part
may be. When the spell is cast, a new body
magically appears, and the life force which
was once in the dead body returns and
inhabits the new one. The DM refers to the
tables below to find the form of the new body.
   If the life force is reincarnated as a different
race, all details of the new race apply, instead
of the old. For example, a cleric reincarnated
as an elf is no longer a cleric, but is able to
cast magic-user spells and fight as an elf.

Wall of Iron
Range: 120'
Duration: Permanent
Effect: Creates 500 square feet of iron
This spell creates a vertical wall of iron
exactly 2 " thick. The magic-user may choose
any length and width, but the total area must
be 500 square feet or less (10'~50',20'~25',
etc.), and the entire wall must be within 120'
of the caster. The caster must create the wall
so it rests on the ground or similar support. It
cannot be cast in a space occupied by another
object. It lasts until dispelled, disintegrated,
or physically broken (though it will resist all
but giant-sized physical attacks). Most other
spell effects, including fire ball, lightning
bolt, etc., have no effect on a wall of iron. If
the wall is made to topple, it causes 10-100
points of damage and shatters.
   If the wall is attacked, it has a number of
"hit points" equal to the level of the caster.
The wall can only be damaged by battering.
Giants inflict 1 point of battering damage per
blow, and certain other creatures might dam-
age it in other ways; a rust monster can
destroy a wall of iron with a single touch.)
Weather Control
Range: 0 (magic-user only)
Duration: Concentration
Effect: All weather within 240 yards
This spell allows the magic-user to create one
special weather condition in the surrounding
area (within a 240 yard radius). The caster
Seventh Level Magic-user Spells
Charm Plant
Range: 120'
Duration: 3 months
Effect: Charms 1 tree or more smaller plants
Similar to a charm person spell, this effect
causes 1 tree, 6 medium-sized bushes, 12
small shrubs, or 24 small plants to become
friends of the magic-user (no Saving Throw).
However, a plant-like monster (treant,
shrieker, etc.) may make a Saving Throw vs.
Spells to resist the effect.
   The charmed plants will understand and
obey all commands of the magic-user, as long
as the tasks are within their ability (including
the entangling of passers-by within range,
but not including movement, sensing align-
ment, etc.). The plants will remain charmed
for 6 months, until the charm is dispelled, or
until winter (when they sleep). (This spell is
quite useful around a stronghold, both inside

Create Normal Monsters
Range: 30'
Duration: 1 turn
Effect: Creates 1 or more monsters
This spell causes monsters to appear out of
thin air. All monsters appearing will under-
stand and obey the caster's commands-
fighting, carrying or fetching things, etc.
They will faithfully obey all commands to the
best of their abilities. Each monster will
appear carrying its normal weapons and
wearing its normal armor (if any), but other-
wise unequipped. At the end of 1 turn, all the
monsters created vanish back into thin air,
along with all their equipment.
   The total number of Hit Dice of monsters
appearing is equal to the level of the magic-
user casting the spell (with fractions
dropped). The magic-user may choose the
exact type of monsters created, selecting any
monster with no special abilities (;.e., no
asterisk next to the Hit Dice number in the
monster explanation). Humans, demi-
humans, and Undead cannot be created by
this spell. Creatures of 1-1 Hit Dice are
counted as 1 Hit Die; creatures of 1/2 Hit Die
or less are counted as 1/2 Hit Die each.
   For example, with this spell, a 15th level
caster could summon 30 giant bats, rats, or
kobolds; or 15 goblins, orcs, or hobgoblins;
or 7 rock baboons, gnolls, or lizard men; or 5
boars, draco lizards, or bugbears; or 3 black
bears, panthers, or giant weasels; and so
forth.
Delayed Blast Fire Ball
Range: 240'
Duration: 0 to 60 rounds
Effect: Delayed blast fireball, sphere of 20'
         radius
As the name implies, this is a fire ball spell
whose blast can be delayed. The magic-user
must state the exact number of rounds delay
(from 0 to 60) when the spell is cast. A small
rock, very similar in appearance to a valuable
gem, then shoots out toward the desired loca-
tion, and remains until the stated delay
elapses. The "gem" may be picked up, car-
ried, and so forth. When the stated duration
ends, an effect identical to a normal fire ball is
produced-a      sudden instantaneous explo-
sion inflicting 1-6 points of damage per level
of the caster to all within the area of effect (a
sphere of 20' radius). Each victim may make
a Saving Throw vs. Spells to take 1/2 dam-
age.
   Once the spell has been cast, the explosion
cannot be hurried nor further delayed, except

Lore
Range: 0 (magic-user only)
Duration: Permanent
Effect: Reveals details of 1 item, place, or
          person
By means of this spell, the magic-user may
gain knowledge of one item, place, or person.
If an item is held by the caster, the spell takes
1-4 turns to complete, and the magic-user
learns the item's name, method of operation
and command words (if any), and approxi-
mate number of charges (if any, within 5 of
the correct number). If the item has more
than one mode of operation, or more than
one command word, only one function will
be revealed for each lore spell used, without a
clue to others.
   If a place or person is being investigated or
if the item is not held, the spell may take 1-
100 days to complete, depending on the num-
ber of details already known. (The DM may
reveal only general details if the place is large,
or if the person is of great power.) A purely
legendary topic should require large amounts
of time, and the information gained may be
in the form of a riddle or poem.
Magic Door'
Range: 10'
Duration: 7 uses
Effect: Creates one passage
This spell may be cast on any wall, floor, ceil-
ing, or section of ground. It creates a magi-
cal, invisible doorway that only the spell
caster may use. It also creates a passage
through up to 10' of non-living solid material
beyond the doorway itself. It cannot be cre-
ated in aliving object of any kind. The door is
undetectable except by a detect magic spell,
and cannot be destroyed except by a dispel
magic spell (at normal chances for success).
   The magic door lasts until dispelled, or
until it has been used 7 times. Note that each
passage through the door is a separate use.
   The reverse of this spell (magic lock) is a
powerful version of the 2nd level wizard lock
spell, but cannot be affected by a knock spell,
nor by the effects of any magic item. The
magic lock causes any one portal to become
totally impassable as long as the magic
remains, usable only by the caster of the
spell. The spell can affect an empty lO'x10'
portal-like area (such as an empty doorway).
The locked portal does not change in appear-
ance. As with a magic door, the enchantment
remains until the portal has been used 7 times
or until removed by a dispel magic spell.
[Companion pages 22-28: magic-user 5th-9th level spell material]
FIFTH LEVEL MAGIC-USER SPELLS
1. Animate Dead
2. Cloudkill
3. Conjure Elemental
4. Contact Outer Plane
5. Dissolve*
6. Feeblemind
7. Hold Monster*
8. Magic Jar
9. Pass-Wall
10. Telekinesis
11. Teleport
12. Wall of Stone
SIXTH LEVEL MAGIC-USER SPELLS
1. Anti-Magic Shell
2. Death Spell
3. Disintegrate
4. Geas*
5. Invisible Stalker
6. Lower Water
7 . Move Earth
8. Projected Image
9. Reincarnation
10. Stone to Flesh*
11. Wall of Iron
12. Weather Control
SEVENTH LEVEL
MAGIC-USER SPELLS
1. Charm Plant
2. Create Normal Monsters
3. Delayed Blast Fire Ball
4. Lore
5. Magic Door*
6. Mass Invisibility*
7. Power Word Stun
8. Reverse Gravity
9. Statue
10. Summon Object
11. Sword
12. Teleport any Object
EIGHTH LEVEL
MAGIC-USER SPELLS
1. Dance
2. Explosive Cloud
3. Mass Charm*
4. Mind Barrier*
5. Permanence
6. Polymorph any Object
7. Power Word Blind
8. Symbol
NINTH LEVEL MAGIC-USER SPELLS
1. Gate*
2. Maze
3. Meteor Swarm
4. Power Word Kill
Fifth Level Magic-user Spells
Contact Outer Plane
Range: 0 (magic-user only)
Duration: See below
Effect: 3-12 questions may be answered
This spell allows the magic-user to contact
one of the Outer Planes of Existence to seek
knowledge from an Immortal creature
(played by the DM). The wisest and most
powerful Immortals live on the most distant
Outer Planes. However, mental contact with
an Immortal may cause a mortal to go
insane. The more distant the plane, the
greater the chance of a correct answer-but
the greater the chance of Insanity as well.
The number of questions the magic-user
may ask is equal to the distance* to the Outer
plane. The caster may choose the distance,
up to the maximum allowed. The chance of
insanity is checked once, when the Immortal
is first contacted. If the caster is 21st level or
greater, the chance of insanity is reduced by
5 % per level of the caster above 20. If insan-
ity does not result, the Immortal may still not
know the answer, or may lie. The chances of
knowing and lying are checked for each ques-
tion.
Distance and
..
Chance of.
Number of
Questions Insanity Knowing
Lying
25 %
50 %
5%
This spell may be used once a month at most
(or less often, at the DM's option). An insane
character recovers with rest, after a number
of weeks of game time equal to the number of
the plane contacted.
* The "distance" to any other plane of
existence is the number of planes that would
be crossed if that plane were visited. The
"distance" between the Prime Plane and the
closest outer plane is 3, as the ethereal, ele-
mental, and astral planes lie "between"
them. There are many Outer Planes, but
most are too far removed to be affected by
this spell.
Dissolve*
Range: 120'
Duration: 3-18 days
Effect: Liquifies 3000 square feet
This spell changes a volume of rock to a
morass of mud. An area 10' deep or thick is
affected, and may be up to 3,000 square feet
in surface area. The victim may get mired
and become unable to move. The magic-user
may choose the exact width and length (20'.
150', 30'. 100', etc.), but the entire area of
effect must be within 120' of the caster. Crea-
tures entering the mud are slowed to 10% of
their normal movement rate at best, and may
become stuck.
The reverse of this spell (harden) will
change the same volume of mud to rock, but
permanently. A victim in the mud may make
a Saving Throw vs. Spells to avoid being
trapped.
Feeblemind
Range: 240'
Duration: Permanent until dispelled
Effect: Lowers Intelligence score to 2
This spell will only affect a magic-user, elf, or
spell-casting monster. It will make the victim
helpless, unable to cast spells or think clearly
(as if having an Intelligence score of 2). The
victim may make a Saving Throw vs. Spells
to avoid the effect, but with a -4 penalty to the
roll. The feeblemind lasts until removed by a
dispel magic spell (at normal chances for suc-
cess) or by a cleric's cureall spell.
Telekinesis
Range: 120'
Duration: 6 rounds
Effect: 200 cn of weight per level of caster
This spell enables the magic-user to move a
creature or object simply by concentrating.
The item may weigh up to 200 cn per level of
the caster (a 10th level elf could move an
object weighing up to 2,000 cn). The caster
may move the object in any direction, at a
rate of up to 20' per round.
An unwilling victim may make a Saving
Throw vs. Spells to avoid the effect. If a tar-
get is held by someone, the holder gets a Sav-
ing Throw with a -2 penalty. If the object is
carried but not held, the owner may grab for
the departing object, making a Saving Throw
with a -5 penalty. The caster must concen-
trate while moving objects, and the objects
will fall if disturbed.
If a wall of stone topples, it causes 10-100
points of damage and shatters.
Sixth Level Magic-user Spells
Move Earth
Range: 240'
Duration: 6 turns
Effect: Moves soil
This spell causes soil (but not rock) to move.
It may be used to move earth horizontally to
make a hill, or vertically, to open a large hole.
The hole may be up to 240 ' deep, unless solid
rock is reached. The soil may be moved at up
to 60' per turn, and at the end of the spell
duration, the moved soil remains where it is
put. The spell is helpful for constructing cas-
tles.
Reincarnation
Range: 10'
Duration: Permanent
Effect: Creates a new body
To cast this spell, the magic-user must have
part of the dead body, however small that part
may be. When the spell is cast, a new body
magically appears, and the life force which
was once in the dead body returns and
inhabits the new one. The DM refers to the
tables below to find the form of the new body.
If the life force is reincarnated as a different
race, all details of the new race apply, instead
of the old. For example, a cleric reincarnated
as an elf is no longer a cleric, but is able to
cast magic-user spells and fight as an elf.
The level of experience does not change
unless restricted by the maximum for demi-
humans. If a monster body appears, the type
of monster is based on the alignment of the
life force. A monster body may not gain levels
of experience; the character must play as
reincarnated or retire from play.
1 Human
(1d8)
5 Elf
6 Halfling
2 Human
7 Original race
3 Human
8 Monster
4 Dwarf
(use table below)
MONSTERS
1d6 Lawful
Neutral
Chaotic
Ape, White Bugbear
Blink Dog
Bear*
Gnoll
Gnome
Centaur
Kobold
Neanderthal
Griffon
Manticore
Owl, giant
Lizard Man Orc
Pegasus
Pixie
Troglodyte
Treant
*Any normal bear
(The DM may add more monsters to the lists. Such
monsters should have 8 Hit Dice or less and should
be at least semi-intelligent.)
Wall of Iron
Range: 120'
Duration: Permanent
Effect: Creates 500 square feet of iron
This spell creates a vertical wall of iron
exactly 2 " thick. The magic-user may choose
any length and width, but the total area must
be 500 square feet or less (10'~50', 20'~25',
etc.), and the entire wall must be within 120'
of the caster. The caster must create the wall
so it rests on the ground or similar support. It
cannot be cast in a space occupied by another
object. It lasts until dispelled, disintegrated,
or physically broken (though it will resist all
but giant-sized physical attacks). Most other
spell effects, including fire ball, lightning
bolt, etc., have no effect on a wall of iron. If
the wall is made to topple, it causes 10-100
points of damage and shatters.
If the wall is attacked, it has a number of
"hit points" equal to the level of the caster.
The wall can only be damaged by battering.
Giants inflict 1 point of battering damage per
blow, and certain other creatures might dam-
age it in other ways; a rust monster can
destroy a wall of iron with a single touch.)
Weather Control
Range: 0 (magic-user only)
Duration: Concentration
Effect: All weather within 240 yards
This spell allows the magic-user to create one
special weather condition in the surrounding
area (within a 240 yard radius). The caster
may select the weather condition. The spell
only works outdoors, and the weather will
affect all creatures in the area (including the
caster). The effects last as long as the caster
concentrates, without moving; if the caster is
being moved (for example, aboard a ship),
the effect moves also. The effects vary, but the
following results are typical:
Rain: -2 penalty to Hit rolls applies to all
missile fire. After three turns, the ground
becomes muddy, reducing movement to 1/2
the normal rate.
Snow: visibility (the distance a creature
can see) is reduced to 20'; movement is
reduced to 1/2 the normal rate. Rivers and
streams may freeze over. Mud remains after
the snow thaws, for the same movement pen-
alty.
Fog: 20' visibility, 1/2 normal movement.
Those within the fog might become lost,
moving in the wrong direction.
Clear: This cancels bad weather (rain,
snow, fog) but not secondary effects (such as
mud).
Intense Heat: Movement reduced to 1/2
normal. Excess water (from rain, snow, mud
transmuted from rock, etc.) dries up.
High Winds: No missile fire or flying is
possible. Movement reduced to 1/2 normal.
At sea, ships sailing with the wind move 50%
faster. In the desert, high winds create a sand-
storm, for 1/2 normal movement and 20 ' vis-
ibility.
Tornado: This creates a whirlwind under
the magic-user's control, attacking and mov-
ing as if a 12 HD Air Elemental. At sea, treat
the tornado as a "storm or gale".
Seventh Level Magic-user Spells
Charm Plant
Range: 120'
Duration: 3 months
Effect: Charms 1 tree or more smaller plants
Similar to a charm person spell, this effect
causes 1 tree, 6 medium-sized bushes, 12
small shrubs, or 24 small plants to become
friends of the magic-user (no Saving Throw).
However, a plant-like monster (treant,
shrieker, etc.) may make a Saving Throw vs.
Spells to resist the effect.
The charmed plants will understand and
obey all commands of the magic-user, as long
as the tasks are within their ability (including
the entangling of passers-by within range,
but not including movement, sensing align-
ment, etc.). The plants will remain charmed
for 6 months, until the charm is dispelled, or
until winter (when they sleep). (This spell is
quite useful around a stronghold, both inside
and out, especially when used after a 4th level
growth ofplants spell, and possibly a perma-
nent spell as well.)
Create Normal Monsters
Range: 30'
Duration: 1 turn
Effect: Creates 1 or more monsters
This spell causes monsters to appear out of
thin air. All monsters appearing will under-
stand and obey the caster's commands-
fighting, carrying or fetching things, etc.
They will faithfully obey all commands to the
best of their abilities. Each monster will
appear carrying its normal weapons and
wearing its normal armor (if any), but other-
wise unequipped. At the end of 1 turn, all the
monsters created vanish back into thin air,
along with all their equipment.
The total number of Hit Dice of monsters
appearing is equal to the level of the magic-
user casting the spell (with fractions
dropped). The magic-user may choose the
exact type of monsters created, selecting any
monster with no special abilities (;.e., no
asterisk next to the Hit Dice number in the
monster explanation). Humans, demi-
humans, and Undead cannot be created by
this spell. Creatures of 1-1 Hit Dice are
counted as 1 Hit Die; creatures of 1/2 Hit Die
or less are counted as 1/2 Hit Die each.
For example, with this spell, a 15th level
caster could summon 30 giant bats, rats, or
kobolds; or 15 goblins, orcs, or hobgoblins;
or 7 rock baboons, gnolls, or lizard men; or 5
boars, draco lizards, or bugbears; or 3 black
bears, panthers, or giant weasels; and so
forth.
Delayed Blast Fire Ball
Range: 240'
Duration: 0 to 60 rounds
Effect: Delayed blast fireball, sphere of 20'
radius
As the name implies, this is a fire ball spell
whose blast can be delayed. The magic-user
must state the exact number of rounds delay
(from 0 to 60) when the spell is cast. A small
rock, very similar in appearance to a valuable
gem, then shoots out toward the desired loca-
tion, and remains until the stated delay
elapses. The "gem" may be picked up, car-
ried, and so forth. When the stated duration
ends, an effect identical to a normal fire ball is
produced-a
sudden instantaneous explo-
sion inflicting 1-6 points of damage per level
of the caster to all within the area of effect (a
sphere of 20' radius). Each victim may make
a Saving Throw vs. Spells to take 1/2 dam-
age.
Once the spell has been cast, the explosion
cannot be hurried nor further delayed, except
with a wish. The "gem" created is pure
magic, not an actual object, and cannot be
moved magically (by telekinesis, teleport,
etc.), though it can be dispelled.
Lore
Range: 0 (magic-user only)
Duration: Permanent
Effect: Reveals details of 1 item, place, or
person
By means of this spell, the magic-user may
gain knowledge of one item, place, or person.
If an item is held by the caster, the spell takes
1-4 turns to complete, and the magic-user
learns the item's name, method of operation
and command words (if any), and approxi-
mate number of charges (if any, within 5 of
the correct number). If the item has more
than one mode of operation, or more than
one command word, only one function will
be revealed for each lore spell used, without a
clue to others.
If a place or person is being investigated or
if the item is not held, the spell may take 1-
100 days to complete, depending on the num-
ber of details already known. (The DM may
reveal only general details if the place is large,
or if the person is of great power.) A purely
legendary topic should require large amounts
of time, and the information gained may be
in the form of a riddle or poem.
Magic Door'
Range: 10'
Duration: 7 uses
Effect: Creates one passage
This spell may be cast on any wall, floor, ceil-
ing, or section of ground. It creates a magi-
cal, invisible doorway that only the spell
caster may use. It also creates a passage
through up to 10' of non-living solid material
beyond the doorway itself. It cannot be cre-
ated in aliving object of any kind. The door is
undetectable except by a detect magic spell,
and cannot be destroyed except by a dispel
magic spell (at normal chances for success).
The magic door lasts until dispelled, or
until it has been used 7 times. Note that each
passage through the door is a separate use.
The reverse of this spell (magic lock) is a
powerful version of the 2nd level wizard lock
spell, but cannot be affected by a knock spell,
nor by the effects of any magic item. The
magic lock causes any one portal to become
totally impassable as long as the magic
remains, usable only by the caster of the
spell. The spell can affect an empty lO'x10'
portal-like area (such as an empty doorway).
The locked portal does not change in appear-
ance. As with a magic door, the enchantment
remains until the portal has been used 7 times
or until removed by a dispel magic spell.
Mass Invisibility*
Range: 240'
Duration: Permanent until broken
Effect: Many creatures or objects
This bestows invisibility (as the 2nd level
spell) on several creatures. All the recipients
must be within an area 60' square within
240' of the magic-user. The spell will affect
up to 6 dragon-sized creatures, or up to 300
man-sized creatures (treating one horse as 2
men). After the spell is cast, each creature
becomes invisible, along with all equipment
carried (as explained in the Basic Set Players
Guide, page 41).
The reverse of this spell (appear), will
cause all invisible creatures and objects in a
20'. 20'. 20' volume to become visible.
Creatures on astral and ethereal Planes are
not within the area of effect; the spell cannot
reach across planar boundaries. All other
forms of invisibility are affected, both magi-
cal and natural, and all victims of this spell
cannot become invisible again for 1 turn.
Power Word Stun
Range: 120'
Duration: 2-12 or 1-6 turns
Effect: Stuns 1 creature with 70 hit points or
less
This spell enables the caster to stun one vic-
tim within 120' (no Saving Throw). A victim
with 1-35 hit points is stunned for 2-12
rounds; one with 36-70 hit points is stunned
for 1-6 rounds. Any creature with 71 or more
hit points cannot be affected. A stunned vic-
tim is unable to attack or cast spells, and suf-
fers a -4 penalty on all Saving Throws for the
duration of the stun.
Reverse Gravity
Range: 90'
Duration: 1/5 round (2 seconds)
Effect: Causes victims in a 30' cubic volume
to fall upward
This spell affects all creatures and objects
within acubicvolume 30'. 30'. 30', causing
them to "fall" in a direction opposite normal
gravity. In 115 round, creatures and objects
can fall about 65 feet. No Saving Throw is
allowed, and all victims hitting a ceiling or
other obstruction take 1-6 points of damage
per 10 feet fallen. Note that after the 1/5
round duration ends, gravity returns to nor-
mal, and all victims will fall back to their orig-
inal places, suffering more falling damage. A
Morale check must be made for each victim
of this spell. For example, a magic-user casts
this spell at a group of approaching giants in a
40' tall room. The giants "fall" to the ceiling
and then back to the floor, each taking a total
of 8-48 points of damage in the process.
Statue
Range: 0 (magic-user only)
Duration: 2 turns per level of the caster
Effect: Allows the caster to turn to stone
This spell allows the magic-user to change
into a statue, along with all non-living equip-
ment carried, up to once per round (to or
from statue form) for the duration of the
spell. The caster can concentrate on other
spells while in statue form. Although this
spell does not give immunity to Turn to Stone
effects (from the attack of a gorgon, for exam-
ple), the caster may simply turn back to nor-
mal form one round after becoming petrified.
While in statue form, the magic-user is
Armor Class -4, but cannot move. The statue
cannot be damaged by cold or fire (whether
normal or magical), or by normal weapons.
The statue need not breathe, and is thus
immune to all gas attacks, drowning, etc.
Magical weapons and other spells (such as
lightning bolt) can inflict normal damage. If
a fire or cold spell is cast at the magic-user
while in normal form, the character need
only win the initiative (through the standard
roll) to turn into a statue before the attacking
spell strikes. The caster receives +2 to initia-
tive when changing form.
Summon Object
Range: Infinite
Duration: Instantaneous
Effect: Retrieves 1 object from caster's home
By means of this spell, the magic-user can
cause one non-living object to leave his or her
home and appear in hand. The object must
weigh no more than 500 cn, and may be no
bigger than a staff or small chest. The caster
must be very familiar with the item and its
exact location, or the spell will not work.
Each item must be prepared beforehand by
sprinkling it with a special powder that costs
1,000 gp per item prepared; the powder
becomes invisible, and does not interfere
with the item in any way. Unprepared items
cannot be summoned by this spell.
If another being possesses the item sum-
moned, the item will not appear, but the
caster will know approximately who and
where the possessor is.
The magic-user may use this spell from
any location, even if the item summoned is
on another Plane of Existence.
Sword
Range: 30'
Duration: 1 round per level of the caster
Effect: Creates a magical sword
When this spell is cast, a glowing sword made
of magic, rather than metal, appears next to
the caster. The magic-user may cause it to
attack any creature within 30', simply by
concentrating. If concentration is broken, the
sword merely stops attacking; it remains in
existence for 1 round per level of the magic-
user. The sword moves very quickly, attack-
ing twice per round, and Hit Rolls are made
at the caster's level. Damage is the same as a
two-handed sword, but this magical creation
is capable of hitting any target (even those hit
only by powerful magic weapons). The sword
cannot be destroyed before the duration
ends, except by a dispel magic spell effect (at
normal chances for success).
Teleport any Object
Range: Touch
Duration: Instantaneous
Effect: Causes 1 object to teleport
This spell is similar to the 5th level teleport
spell, but non-living objects can be affected.
After casting this spell, the magic-user may
touch one creature or object and cause it to
teleport. The normal chances of error apply;
an object appearing too high will fall (and
probably break), and one appearing too low
will disintegrate. The destination may not
deliberately be one occupied by a solid object
or above ground.
The maximum weight affected is 500 cn
per level of the caster. If an object is a solid
part of a greater whole (such as a section of
wall), one 10'. 10'. 10' cube of material (at
most) will be teleported. If another creature
possesses the item touched, (whether held or
merely carried), the creature may make a
Saving Throw vs. Spells (with a -2 penalty); if
successful, the teleport fails.
If the caster uses this spell to teleport him-
self, there is no chance of error. If the caster
touches another creature, it may make a Sav-
ing Throw vs. Spells (if desired) to avoid
being teleported, but with a -2 penalty to the
roll.
Eighth Level Magic-user Spells
Dance
Range: Touch
Duration: 3 or more rounds
Effect: Causes 1 victim to dance
This spell causes one victim to prance madly
about, performing a jig or other dance, for 3
or more rounds. The victim gets no Saving
Throw, and cannot attack, use spells (or
spell-like abilities), or flee. While dancing, a
-4 penalty applies to the victim's Saving
Throws, and a +4 penalty to Armor Class as
well.
The magic-user must touch the victim for
the spell to take effect (a normal Hit Roll).
The duration is 3 rounds for a caster of 18th-
20th level; 4 rounds for levels 21-24,5 rounds
at levels 25-28,6 rounds at levels 29-32, and 7
rounds at levels 33-36.
Explosive Cloud
Range: 1'
Duration: 6 turns
Effect: Creates a moving poisonous cloud
This spell creates an effect which appears the
same as the 5th level cloudkill spell (a 20' tall
cloud of greenish gas 30' in diameter appear-
ing next to the caster). The cloud is only
mildly poisonous; all victims within it must
make a Saving Throw vs. Spells or be para-
lyzed that round. Each victim within the
cloud makes a new Saving Throw each
round.
The cloud is filled with sparkling lights
(visible only to those within it), which are
small explosions. Each round, all those
within the cloud take damage from the explo-
sions, with no Saving Throw allowed. This
damage is 1 point for each 2 levels of experi-
ence of the magic-user, rounding down (9
points at 18th or 19th level, 10 points at 20th
or 21st level, etc.). This explosive damage
will affect any creature, including those
immune to fire, gas, electricity, and other
special attacks.
Mass Charm*
Range: 120'
Duration: Special (as charm person spell)
Effect: 30 Levels of creatures
This spell creates the same effect as a charm
person or charm monster spell, except that 30
levels (or Hit Dice) of victims can be affected
at once. Each victim may make a Saving
Throw vs. Spells to avoid the charm, but with
a -2 penalty to the roll. The spell will not
affect a creature of 31 or more levels or Hit
Dice.
The duration of each charm is determined
by the victim's intelligence (see the D&D
Basic DM Rulebook, page 14). If the magic-
user attacks one of the charmedvictims, only
that creature's charm is automatically bro-
ken. Any other charmed creatures that see
the attack may make another Saving Throw,
but other creatures' charms are not affected.
The reverse of this spell, remove charm,
will unfailingly remove all charm effects
within a 20'. 20'. 20' volume. It will also
prevent any object in that area from creating
charm effects for 1 turn.
Mind Barrier*
Range: 10'
Duration: 1 hour per level of the caster
Effect: Protects against mind-affecting spells
and items
This spell affects one creature; an unwilling
recipient may make a Saving Throw vs.
Spells to avoid the effect.
The spell prevents any form of ESe Clair-
voyance, Clairaudience, crystal ball gazing,
or any other form of mental influence or
information gathering (such as by a contact
higher plane or summon object) from work-
ing properly. The caster or recipient simply
does not exist for the purposes of those and
similar spell effects.
In addition, the recipient gains a bonus of
+8 to Saving Throws against mind-influenc-
ing attacks, such as all forms of charm, illu-
sion and phantasms, feeblemind, and the
like. (However, a roll of 1 always fails the
Saving Throw, regardless of adjustments.)
The reverse of this spell (open mind) will
cause the victim touched to be vulnerable to
the mind-influencing attacks given above. All
the victim's Saving Throws against such
effects are penalized by -8 for the duration of
the spell. This reversed spell must be cast by
touch, requiring a normal Hit Roll.
Permanence
Range: 10'
Duration: Permanent until dispelled
Effect: Causes 1 magical effect to become
permanent
By means of this spell, the magic-user can
cause one other magic-user spell effect of 7th
level or less to become permanent. No spell
with an "Instantaneous" or "Permanent"
duration (such as dispel magic, fire ball,
lightning bolt, etc.) can be made permanent.
Cleric spells cannot be made permanent, nor
can an 8th or 9th level magic-user spell.
The DM must carefully consider other
spells, and may wish to restrict the use of the
permanence spell for reasons of game bal-
ance. A permanence spell lasts until dispelled
by a dispel magic spell from the caster or from
some higher level spell caster (at normal
chances for success). When the permanence
spell is dispelled, the other spell effect van-
ishes immediately.
Except for weapons, an item can only
receive one permanence spell, and a creature
can receive two at most. If a permanence
spell is cast on an item or area which already
has one (or a creature which already has two),
both permanence spells are immediately
negated, along with the spells previously
made permanent. A weapon may have up to
5 permanent effects, but a 25 % chance of fail-
ure applies to each permanence after the first.
Furthermore, if the permanence fails, it
destroys the weapon completely.
Some spells used on a creature that are
commonly made permanent are: detect
magic, protection from evil, read languages,
read magic, detect invisible, and fly. Some
spells commonly made permanent on areas
are light, phantasmal force, confusion, and
cloudkill.
A magic-user needs a permanence spell to
make any permanent magic item (such as a
sword, shield, or non-charged miscellaneous
item). It is not needed for magic wands,
potions, and other temporary magic items.
Polymorph any Object
Range: 240'
Duration: See below
Effect: Changes form of 1 object or creature
This spell is similar to the 4th level poly-
morph other spell, except that an object can
be affected. If the object is part of a greater
whole (such as a section ofwall), up to a 10'.
10'. 10' volume can be polymorphed. A
creature may avoid the effects if a Saving
Throw vs. Spells is made, but with a -4 pen-
alty to the roll.
The duration of the polymorph depends on
the degree of the change. There are three
basic "kingdoms" of all things-animal, veg-
etable, and mineral. If an object is poly-
morphed to one of a "nearby" kingdom
(animal-vegetable, vegetable-mineral) the
duration is 1 hour per level of the caster. If the
change is from animal to mineral (or the
reverse), it lasts for 1 turn per level of the
caster. If no change in kingdom occurs (for
example, if a creature is polymorphed into
some other creature), the change is perma-
nent until removed by a dispel magic spell (at
normal chances for success).
Note that creatures created by means of
this spell are not automatically friendly. A
polymorph cannot affect a creature's age or
hit points. (See the 4th level polymorph self
and polymorph other spells for other guide-
lines.)
Power Word Blind
Range: 120'
Duration: 1-4 days or 2-8 hours (see below)
Effect: Blinds 1 creature with 80 hit points or
less
With this spell, the caster may blind one vic-
tim within 120' (no Saving Throw). A victim
with 1-40 hit points is blinded for 1-4 days;
one with 41-80 hit points is blinded for 2-8
hours. Any creature with 81 or more hit
points cannot be affected. A blinded victim
suffers penalties of -4 on all Saving Throws
and +4 on Armor Class. A cleric's cure blind-
ness or cureall spell will not remove this
blindness unless the cleric is of a level equal to
or higher than the caster of the power word
blind.
Symbol
Range: Touch
Duration: Permanent
Effect: Creates 1 magical rune
This spell creates a written magical drawing
(a "rune") of great power. There are 6 kinds
of symbols; the caster must select one when
the spell is memorized. The rune may be
placed on an object (such as a door or wall) or
placed in mid-air. The rune cannot move; if
placed on a creature or moving object, it will
remain at that point when the surface moves
(possibly floating in mid-air).
When any living creature passes over or
through the rune, or touches the object on
which the rune is inscribed, or (foolishly)
reads the rune, the rune's effect takes place
immediately (no Saving Throw).
There is one exception: a magic-user, and
any other creature which can cast magic-user
spells, may make a Saving Throw vs. Spells if
the symbol is merely read or touched (rather
than passed). If the Saving Throw is success-
ful, the symbol has no effect on that creature.
All symbols look similar to normal writ-
ings. Six symbols and their effects are given
below; the DM may create others (such as
polymorph, teleport, charm, geas, etc.).
Death: Slays any creature with 75 hit
points or less; does not affect a creature with
76 hit points or more.
Discord: The victim attacks allies (if any)
or is otherwise confused (as the 4th level con-
fusion spell). The effect is permanent until
removed by a dispel magic spell (at normal
chances for success) or by a cleric's cureall
spell.
Fear: The victim immediately runs away
from the symbol, at 3 times normal move-
ment rate, for 30 rounds (as the wand).
Insanity: The victim becomes insane,
and cannot attack, cast spells, or use special
abilities or items. The victim may walk, but
must be carefully tended or may run away.
This effect is permanent until removed (see
Discord, above).
Sleep: The victim falls asleep, and cannot
be awakened. The victim will wake normally
in 11-20 hours or if a dispel magic spell is
used to negate it (at normal chances for suc-
cess).
Stunning: Affects any creature with 150
hit points or less. The victim is stunned for 2-
12 turns (as the power word stun spell).
Ninth Level Magic-user Spells
Gate*
Range: 30'
Duration: 1-100 turns or 1 turn
Effect: Opens a portal to another plane
When the magic-user casts this spell, he must
name one target: the Ethereal Plane, the
Astral Plane, one of the four Elemental
Planes, or one Outer Plane (for which the
name of a resident of the Plane must also be
spoken, usually that of an Immortal, a ruler
of the outer Planes). These Planes are
explained in the Dungeon Master's book.
The spell opens a direct connection to the
other Plane of Existence.
A gate to an Outer Plane remains open for
only 1 turn. Any other gate remains open for
1-100 random turns, and there is a 10%
chance per turn that some other-planar crea-
ture will wander through the gate. A gate to
an Elemental Plane actually creates a vortex
and a wormhole, and a wish may be used to
make them permanent.
Contact with an Outer Plane is dangerous,
and the magic-user must know and speak the
name of the Immortal he wishes to contact.
The Immortal he calls will probably (95%
chance) arrive in 1-6 rounds, but there is a
5% chance that some other being from the
Outer Planes will respond. When the being
arrives, it immediately looks for the spell
caster. If the caster does not have an excellent
reason for opening the gate, the being will
probably destroy the caster. Even if the caster
gives an important reason, the being may
merely leave immediately, showing no inter-
est. Occasionally, if the reason is of supreme
importance to the magic-user and of some
interest to the being, it may actually help for a
short time.
The reverse of this spell, close gate, will
destroy the effect of the normal form of the
spell (but cannot affect an Immortal). It can
also be used to close a permanent gate to a
nearby Plane (such as an elemental vortex).
Maze
Range: 60'
Duration: See below (1-6 turns, 2-40 rounds,
2-8 rounds, or 1-4 rounds)
Effect: Traps 1 creature
This spell creates a maze in the Astral plane
and places one victim into the maze (no Sav-
ing Throw). The intelligence of the victim
determines the time needed to escape the
maze:
Animal or Low (1-8) 1-6 turns
Average (9-12)
2-40 rounds
High (13-17)
2-8 rounds
Genius (1 8+)
1-4 rounds
The victim returns to the point of disappear-
ance when he escapes the maze.
Meteor Swarm
Range: 240'
Duration: Instantaneous
Effect: Creates 4 or 8 meteor-fireballs
This spell creates either 4 or 8 meteors (at the
caster's choice). Each meteor can be aimed at
a different target within range, but one and
only one meteor can be aimed at any one
creature. Each meteor slams into its target
&
and then explodes as if a fire ball (affecting all
creatures within a 20' radius).
If 4 meteors are created, each strikes for 8-
48 points of damage and then explodes for 8-
48 points of fire damage (8d6). If 8 smaller
meteors are used, each strikes for 4-24 points
and explodes for the same amount (4d6).
Note that if the meteors are thrown properly,
one creature or area may be affected by mul-
tiple blasts.
The player rolls damage for each strike and
blast separately, and makes a separate Saving
Throw for each fire ballblast. A meteor never
misses.
Any victim struck by a meteor takes full
"strike" damage (no Saving Throw). Each
victim within a blast may make a Saving
Throw vs. Spells to take only 1/2 of the given
"fire" damage. Even fire-resistant and fire-
using creatures are fully affected by meteor
strikes, although they might be resistant to
the fiery explosions.
Power Word Kill
Range: 120'
Duration: Instantaneous
Effect: Slays or stuns 1 or more creatures
This spell enables the caster to affect one or
more victims within 120' (no Saving
Throw). Exception: a magic-user, and any
creature which can cast magic-user spells,
may make a Saving Throw vs. Spells to avoid
this effect, but with a -4 penalty to the roll.
A single victim with 1-60 hit points is auto-
matically slain; one with 61-100 hit points is
stunned (as power word stun) and unable to
act for 1-4 turns. Any creature with 101 or
more hit points cannot be affected.
The spell can also be used to slay up to 5
victims if each has 20 hit points or less (again,
no Saving Throw).

```

### Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items

- Extraction note: Companion treasure extraction split by content type: flow-first TSV reflow for buying/selling, item damage, and the scroll-through-miscellaneous-item prose descriptions; readable sequential formatting for the dense item tables; deterministic post-cleanup is limited to stable OCR and page-header repair after capture.

```text
[Companion procedures: buying and selling magic items]
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
to create "fakes" (such as a light spell cast on
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
"shop" should be lined with lead (blocking
most magical effects), and heavily safe-
guarded with magical traps. Apprentices
might be constantly on watch for magical vis-
itors (possibly polymorphed spell effects,
invisible things, and so forth). An invisible
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
MAGIC ITEM PRICE SUGGESTIONS
Armor           10,000 to 150,000 gp
Misc. Item       5,000 to 750,000 gp
Misc. Weapon     5,000 to 250,000 gp
Missile          1,000 to  50,000 gp
Missile Device  10,000 to 250,000 gp
Potion           1,000 to  10,000 gp
Ring            10,000 to 250,000 gp
Rod             25,000 to 500,000 gp
Scroll           5,000 to  75,000 gp
Shield           5,000 to 100,000 gp
Staff           15,000 to 300,000 gp
Sword            5,000 to 500,000 gp
Wand             5,000 to 150,000 gp
The most common problem you must face is
what to offer adventurers to purchase items
they bring in and wish to sell. Because of
taxes, operating expenses, the lower value of
"used goods," cost of identifying items, and
so forth, you could offer 10-30% of the values
given above. You may modify this by the
Charisma of the seller, adding or subtracting
5 % for each point of adjustment.
For example, a character with 18 Cha-
risma gains a +2 bonus to reactions, and could
thus "barter" the offered price upward by
10%. The transaction can be assumed, or
may be role-played. You may also wish to cre-
ate local laws that strictly prohibit the sale of
magic except by and to authorized dealers,
enforced by both the Guild and the highest
authorities.
Remember that these are only guidelines.
Whatever system you use, try to be consist-
ent. You may wish to make a list of the vari-
ous items, their selling prices (if available),
and the prices offered for them. Notices
might be posted, offering rewards for the dis-
covery of certain items - giving the charac-
ters goals for adventuring.
Experience Points: You may choose to
award XP for cash gained through the sale of
magic items. Beware, however, for a rare
item may bring vast amounts of unearned
experience, and upset the balance of your
game. You may choose instead to award a set
XP value for each item, regardless of the cash
acquired through its sale. This is recom-
mended; regardless of the laws, items will
occasionally be sold to characters (either PCs
or NPCs), who may pay more than the Guild
amounts. Whichever you choose, the details
should be added to your price list.
.

[Companion procedures: damage to magic items]
Damage To Magic Items
Any item may be damaged by rough treat-
ment. Armor and weapons, however, are
made to withstand a considerable amount of
punishment.
The DM should decide whether an item
might be damaged, based on the item and the
type of attack, and then make an Item
Damage roll.
Some breath weapons (acid, fire, cold)
should require such checks. If the user makes
his Saving Throw against the breath, bonuses
can be applied to the item's roll.
Long falls (100' or more) should require
checks. Pools of acid, rockslides, and other
cases of extreme damage should require
checks for items carried. A scroll normally
need not be checked except against fire dam-
age; you may also include water damage, if
desired.
To check for damage to items, roll 1d4 or
1d6 (using 1d6 if the chance of damage is
high). If the result is greater than the item's
Strength (number of "plusses"), the item is
damaged. Items without plusses may be
given ratings for this purpose. Consider:
any potion or scroll as a +1 item;
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

[Companion treasure tables: magic-item tables]
3b. Types of Jewelry
Value (in gp): Common 100-3,000; Uncommon 4,000-10,000; Rare 15,000-50,000

Roll  Common         Uncommon       Rare
1     Anklet         Armband        Amulet
2     Beads          Belt           Crown
3     Bracelet       Collar         Diadem
4     Brooch         Earring        Medallion
5     Buckle         Four-leaf Clover Orb
6     Cameo          Heart          Ring
7     Chain          Leaf           Scarab
8     Clasp          Necklace       Scepter
9     Locket         Pendant        Talisman
10    Pin            Rabbit's Foot  Tiara

5. Potion

d%     Type of Potion
01-02  Agility
03     Animal Control
04-06  Antidote
07-08  Blending
09-10  Bug Repellant
11-12  Clairaudience
13-14  Clairvoyance
15-16  Climbing
17-18  Defense
19-20  Diminution (B)
21-24  Delusion (X)
25     Dragon Control
26-27  Dreamspeech
28     Elasticity
29-30  Elemental Form
31-32  ESP (B)
33     Ethereality
34-36  Fire Resistance (X)
37-39  Flying (X)
40-41  Fortitude
42     Freedom
43-45  Gaseous Form (B)
46     Giant Control (X)
47-49  Giant Strength (X)
50-51  Growth (B)
52-57  Healing (B)
58-60  Heroism (X)
61     Human Control (X)
62-64  Invisibility (B)
65-66  Invulnerability (X)
67-68  Levitation (B)
69-70  Longevity (X)
71     Luck
72     Merging
73-74  Plant Control (X)
75-77  Poison (B)
78-80  Polymorph Self (X)
81-82  Sight
83-84  Speech
85-88  Speed (X)
89-90  Strength
91-93  Super-healing
94-96  Swimming
97     Treasure Finding (X)
98     Undead Control (X)
99-00  Water Breathing

6. Scroll

d%     Type of Scroll
01-03  Communication
04-05  Creation
06-13  Curse (occurs when read; B)*
14     Delay (S)
15-17  Equipment
18-19  Illumination
20-21  Mages (S)
22-25  Map to Normal treasure (B)'
26-28  Map to magical treasure (B)*
29-30  Map to combined treasure (X)'
31     Map to special treasure (X)'
32-34  Mapping
35-36  Portals
37-42  Protection from Elementals (X)
43-50  Protection from Lycanthropes (B)
51-54  Protection from Magic (X)
55-61  Protection from Undead (B)
62-63  Questioning
64     Repetition (S)
65-66  Seeing
67-68  Shelter
69-71  Spell Catching
72-96  Spells (see below)*
97-98  Trapping
99-00  Truth

* More information is given in this set.

4. All Magic Items

d%     Use Table
01-25  5. Potion
26-37  6. Scroll
38-46  7. Wand, Staff, or Rod
47-52  8. Ring
53-62  9. Misc. Magic Item
63-72  10. Armor or Shield
73-83  11. Missile or Device
84-92  12. Sword
93-00  13. Misc. Weapon

SPELL SCROLLS

6a. Type of Scroll

d%     Type
01-70  Magic-User
71-95  Cleric
96-00  Druid

6b. Level of Spell

Spell Level  Cleric or Druid  Magic-User
1            01-34            01-28
2            35-58            29-49
3            59-76            50-64
4            77-88            65-75
5            89-95            76-84
6            96-99            85-91
7            00               92-96
8            --               97-99
9            --               00

Roll for only one type per scroll; then find the level of each spell separately.

7. Wand, Staff, or Rod

d%     Type of Wand, Staff, or Rod
01-05  Wand of Cold (M) (X)
06-10  Wand of Enemy Detection (M) (B)
11-14  Wand of Fear (M) (X)
15-19  Wand of Fire Balls (M) (X)
20-23  Wand of Illusion (M) (X)
24-28  Wand of Lightning Bolts (M) (X)
29-33  Wand of Magic Detection (M) (B)
34-38  Wand of Metal Detection (M) (X)
39-42  Wand of Negation (M) (X)
43-47  Wand of Paralyzation (M) (B)
48-52  Wand of Polymorphing (M) (X)
53-56  Wand of Secret Door Detection (M) (X)
57-60  Wand of Trap Detection (M) (X)
61     Staff of Commanding (S) (X)
62-63  Staff of Dispelling
64-66  Staff of the Druids (DR)
67-69  Staff of an Element (M)
70-71  Staff of Harming (C)
72-78  Staff of Healing (C) (B)
79     Staff of Power (M) (X)
80-82  Snake Staff (C) (B)
83-85  Staff of Striking (S) (X)
86-87  Staff of Withering (C) (X)
88     Staff of Wizardry (M) (X)
89-90  Rod of Cancellation (B)
91     Rod of Dominion
92     Rod of Health (C)
93-94  Rod of Inertia (N)
95     Rod of Parrying
96     Rod of Victory
97-99  Rod of Weaponry
00     Rod of the Wyrm

Charges:
Wand   3-30 (3d10)
Staff  2-40 (2d20)
Rod    no charges

8. Ring

d%     Type of Ring
01-02  Animal Control (B)
03-08  Delusion (X)
09     Djinni Summoning (X)
10-13  Ear Ring
14-17  Elemental Adaptation
18-23  Fire Resistance (B)
24-26  Holiness (C)
27     Human Control (X)
28-32  Invisibility (B)
33-35  Life Protection
36-38  Memory (S)
39-40  Plant Control (X)
41-45  Protection, +1
46-48  Protection, +2
49-50  Protection, +3
51     Protection, +4
52-55  Quickness
56     Regeneration (X)
57-59  Remedies
60-61  Safety
62-64  Seeing
65-67  Spell Eating
68-69  Spell Storing (X)
70-71  Spell Turning (X)
72-75  Survival
76-77  Telekinesis (X)
78-81  Truth
82-84  Truthfulness
85-86  Truthlessness
87-91  Water Walking (B)
92-96  Weakness (B)
97-98  Wishes
99-00  X-Ray Vision (X)

9. Miscellaneous Items

d%     Type of Miscellaneous Item
01-02  Amulet of Protection from Crystal Balls and ESP (X)
03-04  Bag of Devouring (B)
05-09  Bag of Holding (B)
10-12  Boat, Undersea
13-14  Boots of Levitation (X)
15-17  Boots of Speed (X)
18-19  Boots of Traveling and Leaping (X)
20     Bowl of Commanding Water Elementals (X)
21     Brazier of Commanding Fire Elementals (X)
22-23  Broom of Flying (X)
24     Censer of Controlling Air Elementals (X)
25-27  Chime of Time
28-29  Crystal Ball (M) (B)
30     Crystal Ball with Clairaudience (M) (X)
31     Crystal Ball with ESP (M) (X)
32-33  Displacer Cloak (X)
34     Drums of Panic (X)
35     Efreeti Bottle (X)
36-38  Eggs of Wonder
39-40  Elven Cloak (B)
41-42  Elven Boots (B)
43     Flying Carpet (X)
44-45  Gauntlets of Ogre Power (B)
46-47  Girdle of Giant Strength (X)
48-49  Helm of Alignment Changing (B)
50-51  Helm of Reading (X)
52     Helm of Telepathy (B)
53     Helm of Teleportation (M) (X)
54     Horn of Blasting (X)
55-57  Lamp of Long Burning
58-59  Lamp, Hurricane
60-61  Medallion of ESP, 30' range (B)
62     Medallion of ESP, 90' range (X)
63     Mirror of Life Trapping (X)
64-66  Muzzle of Training
67-68  Nail, Finger
69-71  Nail of Pointing
72-76  Ointment
77-79  Pouch of Security
80-82  Quill of Copying (S)
83-86  Rope of Climbing (B)
87-88  Scarab of Protection (X)
89-91  Slate of Identification (S)
92     Stone of Controlling Earth Elementals (X)
93-94  Talisman of Elemental Travel
95-97  Wheel of Floating
98     Wheel of Fortune
99-00  Wheel, Square

[Companion treasure descriptions: scrolls, wands/staves/rods, rings, and miscellaneous items]
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
5'x10'x1' in size (though drawn much
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
affect the scroll, even if it is a fire-type spell.
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
not harm the scroll, but is nevertheless "nor-
mal" fire (and can be used to light torches,
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
design the Map and monster lair accordingly.
Note that the Map may be partially incorrect,
omitting an important detail (such as the type
of monsters, dangerous traps, etc.) or giving
some false information; however, the treasure
mentioned should actually be there.
Mapping: This scroll is blank. When held
and commanded to write, this scroll will draw
a map of an area chosen. The area must be
completely within 100' of the scroll, and may
be up to 10,000 square feet in size. The scroll
will function once per day.
Portals: This scroll creates a pass-wall
effect, identical to the magic-user spell.
When placed on a surface and commanded to
function, the scroll disappears, and a 5'
diameter hole appears, up to 10' deep. Liv-
ing or magical things cannot be affected. The
hole will disappear after 3 turns or when com-
manded by the reader of the scroll. When the
hole disappears, the scroll reappears. The
scroll may be used twice each day.
Questioning: The user of this scroll may
ask questions of any non-living non-magical
objects; their answers will appear on the
scroll. The scroll will display up to 3 answers
per day. The answers will be given as if the
objects were living beings, but limited to sim-
ple observations, as if the objects could see,
hear, and smell. The scroll cannot be used to
question living or magical things.
Repetition: This scroll appears to be a
normal scroll of 1 spell, and the standard
restrictions apply to its use. However, 1 turn
after the spell is cast, the scroll creates the
same spell effect a second time, centered on
the scroll or affecting the nearest creature if a
recipient is required. As with a normal spell
scroll, any spell cast from it is then gone;
however, another spell may be written on the
scroll if it is of the same level, and the repeti-
tion effect will again apply.
Seeing: This scroll is blank. When held
and commanded to write, it will draw pic-
tures of creatures within 100', in any area
chosen by the user. Up to 4 different types of
creatures can be pictured. The scroll will
function once per day, regardless of the num-
ber of creatures pictured.
Shelter: This scroll is inscribed with an
elaborate drawing of a 10' square lit room
with two beds, a table and two chairs, food
and drink for 2 on the table, and a pair of nor-
mal swords on the far wall, each hung over a
shield. If the scroll is hung on any vertical
surface, the room pictured may be entered,
and the items used. The food and drink are
pure and will nourish any living thing. The
swords and shields may be taken down and
used. However, none of the items can be
removed from the room.
If the scroll is taken down, the room cannot
be entered or left, but remains in existence on
another dimension (not another Plane). If
any creatures are in the room when the scroll
is taken down, the air inside permits survival
for up to 24 hours. Any creatures so caught
cannot escape by any means other than a
wish. The food and drink are replenished
each time the scroll is taken down. The room
can be created once per day, but will remain
for up to 12 hours per use; if not removed in
that time, the scroll will fall down by itself.
Spell Catching: This scroll is blank when
found. It may be used to "catch" a spell cast
at the user. It cannot catch spell-like effects,
nor device-produced effects (such as from a
wand), but a spell cast from a scroll can be
caught. There are four types of this scroll; roll 1d10 to determine the capacity:

Roll   Capacity
1-4    1st or 2nd level spells
5-7    1st to 4th level spells
8-9    1st to 6th level spells
10     1st to 8th level spells
The user of the scroll must hold it up, like a
shield; no other action is possible while using
the scroll. The user must then make a Saving
Throw vs. Spells, with a +4 bonus to the roll;
if successful, the incoming spell has no effect,
and is instead transferred to the scroll,
appearing as a normal scroll spell. The exact
spell caught will not be known until a read
magic spell is used to identify it.
The scroll can only hold one spell at a time;
the spell caught must either be used or copied
into a spell book (magic-user spells only)
before the scroll can catch another spell. Any
type of spell (cleric, druid, or magic-user) can
be caught, as long as the level does not exceed
the scroll's capacity. The scroll of spell catch-
ing cannot affect spells of levels greater than
the given capacity, and it can catch a maxi-
mum of one spell per day.
Spells: Use Tables 6a and 6b to find the
exact spell levels, or choose the spells if you
wish. Spell scrolls are good ways to introduce
new spells in the campaign, and may thus be
designed with the characters' current spell
books in mind. Only druids can cast spells on
druid scrolls, though the spell name can be
revealed by a read magic spell.
Trapping: This scroll can create one trap.
The type of trap differs by the placement of
the scroll. The scroll is destroyed when the
trap is created. If placed on a floor, a hidden
Pit trap is created; if on a ceiling, a Falling
Block trap appears. Otherwise, a Poison Dart
or Gas trap will be created. The exact trap is
left for the DM's design. The trap created is
quite real, and not illusory or magical.
Truth: This scroll is blank when found.
The user may ask a question of any living
being within 30'; the complete and true
answer appears on the scroll, read from the
victim's mind by a powerful version of ESP.
Note that the answer is true only within the
limits of the victim's knowledge. The scroll
will display 1 answer per day.
7. Wands, Staves, and Rods
All notes given in the D&D Expert Sets still
apply. If desired, the DM may use a larger
number of charges: 3-30 (3d10) for a wand,
2-40 (2d20) for a staff. Rods are permanent
items, and do not have nor use any charges.
Staff of Dispelling: The touch of this item
has the same effect as a dispel magic spell
from a 15th level caster, but will affect only
the item or magical effect touched. Any
potion or scroll touched is completely
destroyed, and any permanent magic item
touched becomes non-magical for 1-4 rounds
(including armor and weapons). This may be
permanently harmful to intelligent swords
(DM's choice). Each use of the staff costs 1
charge.
Staff of the Druids: Any druid carrying
this staff gains one extra spell of each spell
level. The extra spells must be selected when
the usual spells are acquired (usually during
morning meditation). Each day's use of the
staff uses 1 charge. The staff is a +3 weapon
as well, and may be used as one (inflicting 4-9
points of damage per hit) without using any
charges.
Staff of a n Element: There are seven
types of these staves; roll d % to determine the
exact type found:
01-21
Staff of Air
22-42
Staff of Earth
43-63
Staff of Fire
64-84
Staff of Water
85-91
Staff of Air and Water
Staff of Earth and Fire
92-98
99-00
Staff of Elemental Power
Each staff is a staff +2, and may be used as
one without using any charges, striking for 3-
8 points of damage. Staves of two Elements
gain all the powers of both staves, and the
staff of elemental power has the powers of all
four.
Each staff bestows the following powers
when used on the Prime Material Plane:
+4 bonus to Saving Throws vs. attack
forms based on that Element
Complete immunity to attacks by any Ele-
mental of that type
Summon one 8 Hit Dice Elemental of that
type per day (as the magic-user spell),
each summoning costing 1 charge
Spell-like effects, each costing 1 charge
per use:
Air: lightning bolt, cloudkill
Earth: web, wall of stone
Fire: fire ball, wall of fire
Water: ice (storm or wall)
Web is described in the Basic Set; all others
are described in the Expert Set. All created
spell effects are treated as if cast by a 10th
level caster.
When used on the Elemental Plane of the
corresponding type, the powers are quite dif-
ferent. Instead of the Powers given above, the
following Powers are bestowed by the holder,
as long as one or more charges remain in the
staff:
1. Immunity to damage from the Plane
itself, and vision to 60' range
2. Movement within the Plane at the rate of
120 feet per turn (60'/round)
3. Communication ability with any resident
of that Plane
4. If attacked by a resident of the Plane, -4
bonus to Armor Class
Note that the staff does not itself provide the
ability to breathe on the Plane; some other
device or spell must also be used. However,
when a staff is used along with a matching
ring of elemental adaptation or talisman of
elemental travel, all effects given above are
extended to a 10' radius around the user.
Except for the staff of elemental power,
each staff can be used to negate effects relat-
ing to its Opposition (see page 20), at the cost
of 1 charge if the effect was produced by the
opposite staff, or 2 charges if a normal spell
was used. For example, a staff of air could be
used to negate a wall of fire cast by any
magic-user, at the cost of 2 charges.
A summoned Elemental may be sent back
to its home Plane, with the same cost of
charges (1 if produced by the opposite staff, 2
if conjured by spell), but the Elemental must
be touched by the staff (possibly requiring a
normal Hit roll).
If a staff is ever taken to the Plane of its
Opposition, it immediately explodes, inflict-
ing 20 points of electrical damage plus 1-8
points per charge remaining in the Staff. The
explosion fills a sphere of 60' radius; all crea-
tures within the effect may make a Saving
Throw vs. Spells with a -4 penalty to the roll
to take 1/2 damage. The wielder of the staff,
however, gets no Saving Throw.
Staff of Harming: This item functions
similarly to a reversed staff of healing, but at
the cost of 1 charge per creature harmed. It
inflicts 2-7 points of damage if touched to any
creature (no Saving Throw); a normal Hit
roll may be required. This is in addition to
normal weapon damage (1-6 points), if appli-
cable. The staff can also create the following
effects, with the costs noted. Each effect is
identical to the reversed form of a cleric spell.
Note that the use of this staff is a Chaotic act.
cause blindness
2 charges
2 charges
cause disease
cause serious wounds
3 charges
create poison
4 charges
Staff of Healing: In addition to the cur-
ing abilities given in the D&D Basic Set (2-7
points per touch), charges may be used to cre-
ate the following effects:
1 charge
cure blindness
cure disease
1 charge
2 charges
cure serious wounds
2 charges
neutralize poison
Snake Staff: In addition to the powers
given in the D&D Basic Set, charges may also
be used, in either of two ways. Up to 5
charges may be spent in any round to add
bonuses to the snake's Hit roll (+1 bonus per
charge spent). A charge may also be spent to
cure the snake while it is in combat. The user
casts a curing spell (any), and spends one
charge to transfer the cure to the snake. The
amount of curing is determined normally; no
range limit applies.
Rod of Cancellation: Any intelligent
magic sword, and any +5 item may resist the
effect if the user makes a Saving Throw vs.
Wands. This merely indicates successful
resistance, and the Rod then remains useful.
A sword +5 with intelligence gains a +2 bonus
to the Saving Throw.
Rod of Ruling: This item aids in ruler-
ship. If a ruler carries it throughout his or her
dominion, it adds a bonus to all Confidence
Level rolls, based on the percentage of resi-
dents viewing it:
1-50%
+10
91-99%
+40
+20
51-75%
100%
+50
76-90%
+30
When not on display, it must be kept in the
ruler's stronghold. The effects last for 3
months, but may be re-shown as desired.
Rod of Health (cleric only): This item has
all the powers of a staff of healing, but with-
out expending any charges. It can affect any
one creature only once per day, whatever the
effect.
Rod of Inertia: Only a dwarf, halfling,
fighter, or thief may use this unusual item. It
may be used as a spear +3 in all respects. O n
command of the user, it will stop, wherever it
is, and cannot be moved by any means except
a wish. A second command releases it. If the
Rod is in motion when stopped, it will con-
tinue its direction when released. For exam-
ple, it may be thrown toward a door and
commanded to stop, later released if an
enemy enters (a normal Hit roll is made). If
the user falls, a command will stop the Rod
suddenly, and the user may hold onto it.
Rod of Parrying: This rod +5 can be used
as a melee weapon, inflicting 6-13 (1d8+5)
points of damage per hit (but no Strength
bonus applies). It may also be used to parry
attacks, if the user chooses this ability at the
beginning of a round. When attacked in
melee, the user's Armor Class gains a +5
bonus while parrying; however, this does not
apply to missile fire. While parrying, no
other action is possible except a fighting with-
drawal (see Basic Set, page 60).
Rod of Victory: This item makes the user
lucky in war (when the "War Machine" mass
combat system is used; see page 16). The fol-
lowing bonuses apply to that system:
1. A +25 bonus applies to the Combat.
Results roll (to a maximum total of 100).
2. O n the Combat Results Table, if the dif-
ference in overall totals is 101 or more, the
result for "91-100" is used, limiting the
number of casualties.
Rod of Weaponry: This rod +5 is only
usable by a dwarf, halfling, fighter, or thief.
O n command of the user, it will elongate, and
may be divided into two weapons of the same
size, each +2. Each of those may be similarly
divided into two + 1 weapons. The rod cannot
be divided accidentally, and can be reassem-
bled simply by placing the parts together.
Each weapon, regardless of size, inflicts 1-6
points of damage per hit, plus magic bonuses
(but not Strength bonuses).
Rod of the Wyrm: There are three types
of this Rod; roll 1d10 to determine the type,
or select one:
1d10 Alignment Dragon
AC Breath(s)
-2 Fire/Gas
1-5 Lawful
Gold
0 Lightning
6-8 Neutral
Blue
9-10 Chaotic
Black
2 Acid
Each is a rod +4, and inflicts 6-13 (1d8+5)
points of damage per hit (but without
Strength bonuses). Once per day, the rod
may be turned into a small dragon of the
appropriate type. The created dragon has 30
hit points, and can only be affected by magic
(weapons, spells, etc.). It will understand and
faithfully serve the user of the rod to the best
of its ability; it can act as messenger, steed, or
guard, for example. It will fight to the death
unless commanded otherwise. It knows no
spells. The dragon will return to rod form on
command; if slain in dragon form, however,
it will not return to rod form, and is forever
destroyed. Spells can be used to heal the crea-
ture, if desired (as can other magical forms of
curing).
If any dragon is created by a user of a dif-
ferent Alignment, the dragon will attack the
user immediately, fighting to the death.
When this occurs, it cannot be commanded
to return to rod form.
8. Rings
All guidelines and restrictions on rings given
in the D&D Expert Set still apply.
Ear Ring: This ring has no effect when
worn. When removed and placed against any
surface (a door, chest, etc.), the user may
hear any and all noises occurring within 60 '
of the door. Light breathing, heartbeats, and
even faint breezes can be heard. The ring will
function 3 times per day.
Elemental Adaptation: There are 7 dif-
ferent types of this ring; roll d % to determine
the exact type, or select one:
01-21
Air
Air and Water
85-91
22-42
Earth 92-98
Earth and Fire
43-63
Fire
99-00
All Elements
64-84
Water
The wearer of this ring can, when in the
appropriate Elemental Plane, freely breathe
and see through the gaseous element (the
equivalent of air on the Prime Plane).
Holiness: This ring is only usable by a
cleric or druid. If the ring is worn while spells
are gained (usually during morning medita-
tion), the cleric gains one extra spell of Levels
1, 2, and 3. (Extra spells apply only to spell
levels obtainable. For example, a 5th level
cleric would not gain any 3rd level spells.) If
the ring is removed, the spells are forgotten
(though this has no effect if the spells are
already cast). In addition, a cleric (but not a
druid) gains a +1 bonus to any Turn Undead
rolls made, including the roll determining the
Hit Dice of Undead Turned. The ring does
not affect Turn attempts not requiring a roll.
Life Protection: This valuable ring will
negate the effects of 1-6 Energy Drain
attacks. If the wearer is struck by an Energy
Draining Undead (or effect), charges are
drained from the ring, and no levels are lost.
If a single blow drains more Levels than there
are charges remaining, the ring disintegrates;
otherwise, it becomes a ring of protection +1
when all the charges are used.
Memory: This ring can only be used by a
spell caster. It allows the wearer to recall any
one spell cast. The wearer must decide,
within 1 turn of casting a spell, to recall it; the
memory then reappears, and the spell is
instantly "relearned." The ring can restore
the memory of one spell per day.
Protection (+1, +2, +3, or +4): These rings
are identical to those described in the D&D
Basic and Expert Sets. The bonus applies
both to Armor Class and Saving Throws. A
ring +1 may have an area effect, as described
in the D&D Expert Set; however, only 10%
of all rings +1 have this power, and no more
powerful ring can affect an area.
Quickness: Once each day, the wearer of
this ring can move and attack at double nor-
mal rates for 1 turn. The effect is identical to
the magic-user spell haste, but can be pro-
duced by command, not spell casting.
Remedies: Once each day, this ring will
produce one remedy-a cure blindness, cure
disease, remove curse, or neutralize poison
spell effect. Each effect is identical to the
cleric spell of the same name, and is treated as
if cast by a 25th level cleric. The ring pro-
duces the effect desired when the wearer con-
centrates and touches the recipient.
Safety: The effect of this ring is similar to
that of a potion ofluck. If any Saving Throw
is failed, the player of the character wearing
the ring may "change fate" by announcing
that his Saving Throw was successful! The
ring will negate 1-4 failed Saving Throws,
and then disintegrate.
Seeing: Once each day, the wearer of this
ring can see all things plainly for 3 turns, as if
the cleric spell truesight were cast. The
wearer need not be a spell caster.
Spell Eating: This ring appears and func-
tions as a ring of spell turning, with one extra
effect if the user is a spell caster. After one
spell is cast while the ring is worn, the ring
"eats" all the remaining spells memorized.
The ring cannot be removed after it has eaten
spells (though spells can be restudied, and
safely cast) until a remove curse is applied by
a 25th or higher level caster. This remedy
only permits the removal of the ring, and
does not affect its powers. A dispel evil cast by
a 36th level caster will turn the ring into a
normal ring of spell turning.
Survival: The wearer can survive without
air, food, or drink while the ring is worn, by
using charges contained within it. The ring
contains 101-200 (d%+100) charges when
found. By spending one charge, the user
needs no food or drink for 24 hours. Survival
without air requires 1 charge per hour. The
ring turns black when 5 or fewer charges
remain.
Truth: Three times per day, this item
allows the wearer to know whether a spoken
statement is true or false. If the person or
creature uttering the statement believes it to
be true, a "True" result will be obtained. By
telepathy, the ring tells the wearer of its
powers as soon as it is worn.
Truthfulness: This item claims to be a
ring of truth when worn, but actually func-
tions differently. When the wearer first tries
to determine the truth of a statement, the
statement will appear to be true-but there-
after, the wearer will be unable to lie. Full and
completely true answers to any question must
be given as long as the ring is worn. It cannot
be removed until a remove curse is applied by
a 26th or higher level caster.
Truthlessness: This item claims to be a
ring of truth when worn, but functions in a
manner opposite that of a ring of truthful-
ness-the wearer is unable to tell the truth,
lying at all times. It cannot be removed until
a remove curse spell, cast by a 26th or higher
level caster, is applied.
Wishes: This item is identical to that
described in the D&D Expert Set, except that
to find the number of wishes contained, roll
1d10: 1-4 = 1; 5-7 = 2; 8-9 = 3; 10 = 4.
9. Miscellaneous Items
There is no limit to the many types of items
possible; the devices and effects given here
are a mere sampling. You may create others if
desired, with nearly any powers. However,
when designing such items, keep the balance
of the game in mind. If an item duplicates
cleric powers, for example, it may cause cler-
ics to become less useful in the game. Keep
such items rare, and limit them by the use of
expendable charges, lest they adversely affect
your game.
Boat, Undersea: This item appears iden-
tical to a standard riverboat (Expert Set, page
43), and can be used as one. As it is magical,
however, its Armor Class is 4, and it has 40
hull points. No rowers or sailors are required,
if the command words are known. It will obey
commands to start, stop, turn to port (left),
turn to starboard (right), stop turning (while
keeping the same speed), submerge, level off,
and surface. When underwater, the boat
radiates a water breathing effect, protecting
all passengers and crew as long as they touch
it. The undersea boat can be fitted with grips
so that the passengers can avoid drifting
away.
(The DM may wish to create magical boats
which travel only on ice, sand, in the air, and
so forth.)
Chime of Time: This simple metal stick is
3 inches long, made of a silvery metal. O n
command, it will keep track of time, chiming
every hour on the hour-but the chime can
be heard by all within 60' (regardless of
intervening walls, rock, etc.). If dampened
by a silence 15' radius spell, the chime will
dispel the silence but be damped to 30 ' range
for that turn. A second command will cause it
to turn color: the chime then turns gold at one
end, the color slowly spreading to the other
end in the hour's time. A third command
word causes the chime to stop ringing-but
no; until 1 turn elapses after the command.
Eggs of Wonder: These strange items are
the size of chicken eggs, but may be of any
color. An egg breaks when dropped or thrown
(to 60' maximum range); in the following
round, a creature emerges from it and grows
to normal size, thereafter obeying the
thrower of the egg to the best of its ability.
(Note that the creature must be able to hear
the user's commands.) The creature will dis-
appear after 1 hour of existence, or when
slain. To determine the type of creature
appearing, roll 1d12; the Basic Set contains
all the needed descriptions. The creature
appearing is never determined until the egg
breaks. The DM may add other creatures.
1 baboon, rock
7 cat, panther
2 bat, giant
8 ferret, giant
3 bear, black
9 lizard, gecko
4 bear, grizzly
10 lizard, draco
5 boar
11 snake, racer
6 cat, mountain lion 12 wolf, normal
Lamp of Long Burning: This item is
identical to a normal adventurer's lantern. It
is made of metal, with a lower compartment
for oil, a handle, and shutters around the
body to protect the flame from wind. When
filled with oil and lit, as a normal lantern, it
will burn and shed light without using any
oil. If the flame is ever doused by water, the
lamp becomes non-magical.
Lamp, Hurricane: This item appears
and functions as a lamp of long burning in all
respects, but only after its storm has passed,
as described hereafter.
It is always closed when found. When the
shutters are opened, violent gusts ofwind and
rain come from the lamp, dousing the holder
(who gets no Saving Throw) and all others
within 30'. This "hurricane" lasts for 3
rounds; each victim must make a Saving
Throw vs. Spells, and all those failing are
knocked over from the winds. If this occurs,
every item carried (except for body clothing
and/or armor, but including caps, gloves,
treasure, etc.) is blown about, landing scat-
tered within 60'. A successful Saving Throw
indicates that the victim has fallen to the
ground in time, tightly grasping all items car-
ried. The hurricane lamp may thereafter be
used as a lamp of long burning for the
remainder of the day. It resets its Hurricane
every 24 hours, which must again be trig-
gered before the lamp can be of other use.
Muzzle of Training: This item is a device
of leather straps with metal buckles, and may
be fastened over the mouth of any animal or
monster with a bite attack. It will magically
expand or contract to fit the creature, and the
victim can breathe, but cannot bite (or talk)
while wearing the muzzle. The muzzle will
lock in place with a command word (treat as a
wizard lock by a 15th level caster), and will
unlock and fall off with a second command.
The muzzle can be commanded as often as
desired.
Nail, Finger: This item appears identical
to the common iron nail of medieval carpen-
try, 1-4 inches long and very crudely made. It
may easily be overlooked if found with other
construction materials, unless a detect magic
spell is used. When commanded to function,
it disappears. When the user next tries to
avoid the attention of an enemy (by hiding,
invisibility, etc.), the nail reappears as a large
glowing finger, pointing at the character for
1-6 rounds. The finger nail may reappear
during each similar attempt thereafter (25 %
chance for each), but a remove curse will
cause it to vanish forever.
Nail of Pointing: This item appears iden-
tical to a common carpentry nail. If the com-
mand word is known, the user may cause it to
point at any non-magical item named (door,
stairway, gold piece, etc.); the nail then turns
into a finger of bones, and points toward the
closest item of that type. It will continue to
point at that item for 1 turn, and then returns
to nail form. There is no limit to the range of
the nail's detection, but it cannot detect living
or Undead creatures of any type, nor any
magical item or spell effect. The nail ofpoint-
ing will function once per day.
Ointment: This white creamy salve is
found in a small wooden box with a cotton
swab. If the entire contents of the box are
rubbed on any part of the skin of the recipi-
ent, a magical effect is produced. All oint-
ments look, smell, and taste the same.
To determine the type found, roll 1d6:
1. Blessing: This salve gives the recipient a
-2 bonus to Armor Class and a +2 bonus to
all Saving Throws for 1 turn.
2. Healing: This salve cures 4-14 points of
damage.
3. Poison: This salve seems to be ointment
of blessing, but forces the recipient to
make a Saving Throw vs. Poison, with a
-2 penalty to the roll, or die.
4. Scarring: This salve seems to be oint-
ment of healing, but instead inflicts 2-12
points of severe burn damage, which can
only be repaired by ointment of soothing,
a cureall spell, or a wish.
5. Soothing: This salve cures the recipient
of all burn damage, whatever the amount,
and whether magical or normal.
6. Tanning: This salve causes all the recipi-
ent's skin to turn a bright color. The
effect cannot be removed, but will gradu-
ally wear off in 1-4 months.
Pouch of Security: This item is the size of
a large sack (capacity 600 cn). Any attempt at
stealing the Pouch causes it to scream "I am
being stolen!" (in the Common tongue)
repeatedly for one hour. Its cries can be heard
to 120 I . If its owner holds it and commands it
to be quiet, it will obey, but will repeat its
cries if stolen again.
Quill of Copying: A quill is a large
feather which can be dipped in ink and used
as a writing implement. This quill may be
commanded to copy any spell on a scroll. It
will copy only one spell per week at most. The
original scroll must be burned, and the ashes
mixed with rare ink (of 1,000 gp cost). The
quill is then placed on a blank scroll, along
with an inkwell containing the prepared ink.
Upon command, the quill starts to write, cre-
ating two identical spells on the scroll instead
of the single original. If the scroll burnt con-
tains two or more spells, only one spell will be
copied, either the lowest level spell or (if both
are the same level) a randomly selected spell.
The quill will not copy protection scrolls, nor
any other writing except spell scrolls.
Unfortunately, there is a 25% chance per
use that the quill will blot, spoiling the entire
scroll upon which it is writing. The blot can-
not be removed from the parchment by any
means but a wish.
Slate of Identification (spell caster only):
This valuable device can identify magic items
of most sorts. It is a piece of slate (stone) held
firmly in an ornate wooden frame, usually
about 3 feet square (though slates of many
sizes are possible, both larger and smaller).
The user holds the slate horizontally and
places a magic item upon it. When the item is
lifted off, the name of the item appears on the
slate. If an item has command words, one will
appear on the slate with each identification.
The slate will only repeat itself when all the
command words have been revealed.
The slate is easily fooled by cursed or oth-
erwise unuseful items. It cannot detect a
number of charges or a special ability. A
potion ofpoison will be mistakenly identified
as some other type. Any cursed item will be
identified as a normal item. (These guide-
lines should be strictly followed, lest the mys-
tery of such items found be ruined.)
The slate may expend up to 10 charges per
day; items require the following numbers of
charges per use.
Temporary magic items:
Potion:
Missile:
Wand:
Staff:
Permanent magic items:
Any permanent magic weapon:
Armor or Shield:
Ring or Rod:
*Minor miscellaneous item:
*Major miscellaneous item:
Special
* The DMIS judgment is required as to the value
and frequency of such items in the campaign. A
"major" item might be identifiable, but only by
making the slate useless for 1-4 days.
Talisman of Elemental Travel: There
are 5 types of talismans. Roll id10 to deter-
mine the exact item found:
1-2
Lesser Talisman of Air
3-4
Lesser Talisman of Earth
5-6
Lesser Talisman of Fire
7-8
Lesser Talisman of Water
9-10
Greater Talisman (all Elements)
Lesser Talisman: This item is an engraved
round amulet, and may be found on a chain.
It is engraved with a triangle in the center,
and a symbol above it (one of the 10 symbols
of the Elemental ranks). O n the Prime Plane,
the user may press the central symbol while
casting a conjure elemental spell; the talis-
man will reverse the effect, sending the
wearer into the appropriate Elemental Plane.
While wearing the talisman, the user can
breathe Elemental matter as if it were pure,
clean air, and gains vision (normally 120'-
1200' range, depending on conditions).
Greater Talisman: This item is similar to a
lesser talisman in powers, but applies to all
the Elemental Planes. It is engraved with the
four triangle symbols of the Planes, meeting
in the center. The 10 symbols of all the Ele-
mental ranks are inscribed around the edge.
If the proper command words are known, the
wearer may also force an Elemental being to
obey instructions. This uses one charge, and
the talisman can expend up to 10 charges per
trip into an Elemental Plane.
Wheel of Floating: This item appears
identical to a normal wagon wheel, but
enables any wagon upon which it is mounted
to float on water. One wheel offloatingallows
a wagon to be towed across a river or stream,
carrying up to 10,000 cn weight without sink-
ing. Each additional wheel allows 5,000 cn
more weight to be carried, to the normal
maximum for the wagon of 25,000 cn.
Swamp travel is also possible, but at very
slow movement rate unless some water-type
draft animal is available.
A cursed wheel of floating will, when
reaching the center of any river or stream,
become stuck at that point, and cannot be
moved until a remove curse is applied by a
15th or higher level caster. This allows pro-
gress to continue, but the curse will remain
until the wheel is destroyed.
~~
Wheel of Fortune: This strange device is
10' in diameter, mounted on a stand or wall
fixture and easily rotated. It is decorated with
a black and white pattern of wedges, all inter-
secting at the center, where a green arrow is
mounted; the arrow does not turn with the
wheel. Near the rim, each black wedge is
adorned by a white skull, and each white
wedge by a red heart. If the wheel is spun
(easily done by any creature of 3 Strength or
more), it rotates for 3 rounds and then comes
to rest, with the green arrow pointing at one
of the wedges, either black or white (at equal
chances for each). However, a charmed crea-
ture cannot move the wheel, and any one
user can spin the wheel only once per day.
If the wheel has spun freely for the 3
rounds, not touched or interfered with in any
way, a magical effect occurs, determined by
the result of the spin. The wheel cannot be
affected by magic of any kind, including tele-
kinesis, and cannot be damaged in any way!
Any wish used to affect the wheel will cause
the wheel to vanish, whatever the wish. The
wheel cannot be moved except by a creature
of 26 or more levels (or hit dice). The wheel
weighs 20,000 cn.
White Wedge (roll 1d6):
1. Gold pieces (1,000) appear.
2. Gems (10 garnets) appear.
3. Jewelry (1 brooch) appears.
4. One misc. magic item appears.
5. One ability score rises by 1 point (maxi-
mum score 18).
6. Prime Requisite or Constitution rises by 1
point (maximum score 18).
Black Wedge (roll 1d6):
1. One ability score drops by 1 point (mini-
mum score 3).
2. Prime Requisite drops by 1 point.
3. Constitution drops by 1 point.
4. Least valuable magic item carried disinte-
grates.
5. All non-magical items, except for normal
clothing, disintegrate.
6. Die (no Saving Throw).
The DM may select or randomly determine
the results of the spin. If desired, the wedges
may be numbered from 1-20 or 1-100, and a
chart may be made with more results.
Wheel, Square: This odd "wheel," the
size of a normal wagon wheel, is useless on
roads and other flat terrain, as it is perfectly
square. However, when mounted properly
on a wagon, it magically allows movement
through mountain and desert terrain where
there is no road. A wagon with one square
wheel can be pulled by 2 horses and moves at
20'/turn; with two wheels, 30'1turn; with
three, 40'/turn; and with four, the normal
rate of 60'/turn is possible.

```

### Companion: Weapon Talent Spell-Activation Mechanics (item-monster)

- Extraction note: Companion weapon talent table (lines 6628–6653); column-flow OCR with left/right column interleave. Talents using spell-activation parameters captured verbatim. General Note preamble included for context. Slowing talent's "no Saving Throw" is mechanically distinct from the base Slow spell.

```text
[Companion weapon talents: spell-activation parameters — lines 6628–6653]
Talents (Table 14c)
   General Note: All Talents may be used
only once per day unless noted otherwise.
Talents which duplicate spell effects are not
actual spells, and require no verbal casting
nor concentration. The use of a Talent occurs
in the magic spells and items phase of a com-
bat round.

   Breathing: The weapon can create either
one water breathing spell effect per day, or
one air breathing effect per day. Air breath-
ing supplies the user (only) with pure air for 1
turn, and can be used to counter the effects of
airlessness, poisoned air (such as a gas trap),
and so forth; however, it cannot negate the
effects of any breath weapon.
   Charming: The weapon can create one
charm person spell effect per day, to 120'
range (as the 1st level magic-user spell).
       Finding: The weapon can create one
locate object spell effect per day, to 120'
range (as the 2nd level magic-user spell).
       Slowing: When a successful hit is made,
the weapon can cause the opponent struck to
become slowed (as the reverse of the 3rd level
magic-user spell haste) for 1 turn (no Saving
Throw). The user may decide whether or not
to use this effect after the swing hits.
   Speeding: The weapon will, on com-
mand, create a haste spell effect on the user
(only). The user may then move at double
normal speed, and attack twice per round, for
1 turn (similar to the 3rd level magic-user
spell).
[Source: Companion Rules, weapon talent descriptions, lines 6628–6653]
```

### Demi-Human Crafts and Poison

- Extraction note: flow-first Companion procedures extraction using right-column TSV reflow for the Demi-Human Crafts and Poison sections, explicitly skipping the Hit Points Maximum section between them.

```text
[Companion procedures: demi-human crafts]
Demi-Human Crafts
The rules which follow are for DM and NPC
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

[Companion procedures: poison]
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

### Companion: List-Only Spell Sourcing Notes

- Extraction note: The following Companion Set spells (pages 13-17 for cleric/druid, pages 22-24 for magic-user) appear in spell level lists only. The Companion Set PDF includes no standalone description text for these entries; descriptions are in the Rules Cyclopedia staging. These note blocks serve as explicit Companion lane provenance markers for the multi-witness builder.

```text
Commune
[Companion (Cl5, pp.13-14): list-only; desc → RC]

Create Food
[Companion (Cl5, pp.13-14): list-only; desc → RC]

Dispel Evil
[Companion (Cl5, pp.13-14): list-only; desc → RC]

Insect Plague
[Companion (Cl5, pp.13-14): list-only; desc → RC]

Quest
[Companion (Cl5, pp.13-14): list-only; desc → RC]

Animate Objects
[Companion (Cl6, pp.13-14): list-only; desc → RC]

Cureall
[Companion (Cl6, pp.13-14): list-only; desc → RC]

Find the Path
[Companion (Cl6, pp.13-14): list-only; desc → RC]

Speak with Monsters
[Companion (Cl6, pp.13-14): list-only; desc → RC]

Word of Recall
[Companion (Cl6, pp.13-14): list-only; desc → RC]

Earthquake
[Companion (Cl7, pp.13-14): list-only; desc → RC]

Holy Word
[Companion (Cl7, pp.13-14): list-only; desc → RC]

Raise Dead Fully
[Companion (Cl7, pp.13-14): list-only; desc → RC]

Restore
[Companion (Cl7, pp.13-14): list-only; desc → RC]

Anti-Plant Shell
[Companion (D5, pp.15-17): list-only; desc → RC]

Control Winds
[Companion (D5, pp.15-17): list-only; desc → RC]

Pass Plant
[Companion (D5, pp.15-17): list-only; desc → RC]

Anti-Animal Shell
[Companion (D6, pp.15-17): list-only; desc → RC]

Transport Through Plants
[Companion (D6, pp.15-17): list-only; desc → RC]

Summon Weather
[Companion (D6, pp.15-17): list-only; desc → RC]

Creeping Doom
[Companion (D7, pp.15-17): list-only; desc → RC]

Metal to Wood
[Companion (D7, pp.15-17): list-only; desc → RC]

Conjure Elemental
[Companion (MU5, pp.22-24): list-only; desc → RC]

```


## Spell Lists Appendix

- Note: these are raw numbered spell lists from the Companion Set. They are appendix-only  14 the per-spell description extraction above is the authoritative witness source. Multi.py strips this section before scanning for spell witnesses.

### Companion: Cleric Spell Lists (pages 13-14)

- Extraction note: TSV column reflow of Companion cleric 5th-7th level spell list pages.

```text
FIFTH LEVEL CLERIC SPELLS
1. Commune
2. Create Food
3. Cure Critical Wounds*
4. Dispel Evil
5. Insect Plague
6. Quest*
7. Raise Dead*
8. Truesight
SIXTH LEVEL CLERIC SPELLS
1. Aerial Servant
2. Animate Objects
3. Barrier*
4. Create Normal Animals
5. Cureall
6. Find the Path
7. Speak with Monsters*
8. Word of Recall
SEVENTH LEVEL CLERIC SPELLS
1. Earthquake
2. Holy Word
3. Raise Dead Fully*
4. Restore*

```

### Companion: Magic-User Spell Lists (pages 22-24)

- Extraction note: TSV column reflow of Companion magic-user 5th-9th level spell lists (pages 22-24). Column reflow orders left columns (numbered index lists) before middle/right columns (descriptions); smart filter strips descriptions.

```text
FIFTH LEVEL MAGIC-USER SPELLS
1. Animate Dead
2. Cloudkill
3. Conjure Elemental
4. Contact Outer Plane
5. Dissolve*
6. Feeblemind
7. Hold Monster*
8. Magic Jar
9. Pass-Wall
10. Telekinesis
11. Teleport
12. Wall of Stone
SIXTH LEVEL MAGIC-USER SPELLS
1. Anti-Magic Shell
2. Death Spell
3. Disintegrate
4. Geas*
5. Invisible Stalker
6. Lower Water
7 . Move Earth
8. Projected Image
9. Reincarnation
10. Stone to Flesh*
11. Wall of Iron
12. Weather Control
SEVENTH LEVEL
MAGIC-USER SPELLS
1. Charm Plant
2. Create Normal Monsters
3. Delayed Blast Fire Ball
4. Lore
5. Magic Door*
6. Mass Invisibility*
7. Power Word Stun
8. Reverse Gravity
9. Statue
10. Summon Object
11. Sword
12. Teleport any Object
EIGHTH LEVEL
MAGIC-USER SPELLS
1. Dance
2. Explosive Cloud
3. Mass Charm*
4. Mind Barrier*
5. Permanence
6. Polymorph any Object
7. Power Word Blind
8. Symbol
NINTH LEVEL MAGIC-USER SPELLS
1. Gate*
2. Maze
3. Meteor Swarm
4. Power Word Kill

```

