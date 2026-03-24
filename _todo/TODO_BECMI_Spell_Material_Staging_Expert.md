# TODO: BECMI Spell Material Staging - Expert

This staging document captures spell material and associated magical-context text from `TSR 1012B - Set 2 Expert Rules.pdf`.

Rules for this artifact:
- Raw classic terminology is preserved.
- This is a staging artifact, not a final crosswalk.
- `pdftotext -layout -nodiag -nopgbrk` remains the primary extractor unless a section note says otherwise.
- Parser warnings from PDF extraction stderr were suppressed and are not part of this document.
- Section methods may mix anchored line slices, page-layout extraction, cropped columns, TSV reflow, and small curated stitching when that is necessary to preserve reading order.
- Cleanup is conservative: spacing, OCR scars, and broken line wraps may be normalized, but source terminology is not converted.

Source PDF:
- `TSR 1012B - Set 2 Expert Rules.pdf`

## Table Check QA Pass

- Status: reviewed 2026-03-22; confidence survey updated 2026-03-23
- Scope checked: leveled spell lists, spell-expansion sections, and structured spell-property blocks.
- Result: no blocking row/column defects found in the visible Expert table and list regions.

- Capture confidence: **0.89**
- Coverage note: Core Expert cleric and magic-user spell expansions, research, and lost-book procedures are staged cleanly. The miscellaneous magic-item run is intentionally selective rather than exhaustive, with RC acting as the canonical item-property backstop for omitted non-spell-adjacent entries.
- ToC cross-check: Expert CONTENTS review found the spell sections and research/lost-book procedures accounted for. The remaining omission is partial coverage of the page 65 miscellaneous magic-item list.
- Gap priority: MEDIUM-LOW — remaining gap is secondary item-catalog completeness, not core spell procedure coverage.
### Clerical and Magic-User Spell Expansions

- Extraction note: stitched Expert spell extraction: clerical spell pages 7-11 and magic-user spell pages 13-18 use separate TSV coordinate reflow passes so the real spell sections stay in source order and the intervening fighter/thief class tables are excluded.

```text
[Expert pages 7-11: clerical spell expansions]
First Level Clerical Spells
The following first level clerical spells may
be reversed. Ranges, durations, Saving
Throws, and areas of effect are unchanged
from Basic unless noted.
Cure Light Wounds*
When reversed, this spell, cause light
wounds, causes 2-7 points of damage to any
creature or character touched (no Saving
Throw). The cleric must make a normal
Hit roll.
Light*
When reversed, this spell, darkness, creates a
circle of darkness 30' in diameter. It will
block all sight except infravision. Darkness will
cancel a light spell if cast upon it, but may
itself be cancelled by another light spell. If
cast at an opponent's eyes, it will cause blind-
ness until cancelled, or until the duration
ends. The target is allowed a Saving Throw
and if he succeeds, the spell misses.
Remove Fear*
When reversed, this spell, cause fear, will
make any one creature flee for two turns.
The victim may make a Saving Throw vs.
Spells to avoid the effect. This reversed
spell has a range of 120'.
Second Level Clerical Spells
Bless*
Range: 60'
Duration: 6 turns
Effect: All within a 20' square area
This spell improves the morale of friendly
creatures by +1 and gives the recipients a
+1 bonus on all Hit and damage rolls. It will
only affect creatures in a 20' x 20' area, and
only those who are not yet in melee.
When reversed, this spell, blight, places a
- 1 penalty on enemies' morale, Hit rolls,
and damage rolls. Each victim may make a
Saving Throw vs. Spells to avoid the penal-
ties.
Find Traps
Range: 0 (Cleric only)
Duration: 2 turns
Effect: Traps within 30' glow
This spell causes all traps to glow with a
dull blue light when the cleric comes within
30' of them. It does not reveal the types of
traps, nor any method of removing them.
Hold Person*
Range: 180'
Duration: 9 turns
Effect: Paralyzes up to 4 creatures
The hold person spell will affect any human,
demi-human, or human-like creature
(bugbear, dryad, gnoll, gnome, hobgoblin,
kobold, lizard man, ogre, orc, nixie, pixie
or sprite). It will not affect the undead or
creatures larger than ogres. Each victim
must make a Saving Throw vs. Spells or be
paralyzed for 9 turns. The spell may be
cast at a single person or at a group. If cast
at a single person, a - 2 penalty applies to
the Saving Throw. If cast at a group, it will
affect up to 4 persons (at the cleric's
choice), but with no penalty to their rolls.
The paralysis may only be removed by the
reverse spell, or by a dispel magic spell.
The reverse of the spell, free person, re-
moves the paralysis of up to 4 victims of
the normal form of the spell (including
one cast by a magic-user or elf). It has no
other effect.
Know Alignment*
Range: 0 (Cleric only)
Duration: 1 round
Effect: One creature within 10'
The caster of this spell may discover the
alignment (Lawful, Neutral, or Chaotic) of
any one creature within 10'. The spell may
also be used to find the alignment of an
enchanted item or area (if any; for exam-
ple, of a magic sword or temple).
The reverse of the spell, confuse alignment
lasts for 1 turn per level of the caster, and
may be cast on any one creature, by touch.
No Saving Throw is allowed. For as long as
the spell lasts, any cleric trying to find the
alignment of the recipient by way of the
normal form of the spell will get a false
answer. That same false answer will be the
result of any further attempts.
Resist Fire
Range: 30'
Duration: 2 turns
Effect: One living creature
For the duration of this spell, the recipient
cannot be harmed by normal fire and heat.
The recipient also gains a +2 bonus on all
Saving Throws against magical fire
(dragon's breath, fire ball, etc.). Further-
more, damage from such fire is reduced by
1 point per die of damage (though each die
will inflict at least 1 point of damage, re-
gardless of adjustments). Red dragon
breath damage is reduced by 1 point per
hit die of the creature (again to a minimum
of 1 point of damage per hit die).
Silence 15' Radius
Range: 180'
Duration: 12 turns
Effect: Sphere of silence 30' across
This spell makes the area of effect totally
silent. Conversation and spells in this area
are impossible for the duration of the spell.
This spell does not prevent a person within
the area from hearing noises made outside
the area. If cast on a creature, the victim
must make a Saving Throw vs. Spells or
the spell effect will move with the creature.
If the Saving Throw is successful, the spell
remains in the area in which it was cast,
and the victim may move out of the area.
Snake Charm
Range: 60'
Duration: 2-5 rounds or 2-5 turns
Effect: Charms 1 HD of snakes per level of
the caster
A cleric may charm 1 Hit Die of snakes for
each level of experience with this spell, and
no Saving Throw is allowed. A 5th level
cleric could charm one 5 HD snake, five 1
HD snakes, or any combination totalling 5
Hit Dice or less. The snakes affected will
rise up and sway, but will not attack unless
attacked themselves. If used on attacking
snakes, the spell's duration is 2-5 rounds;
otherwise, it lasts 2-5 turns. When the spell
wears off, the snakes return to normal (but
with normal reactions, and will not be au-
tomatically hostile).
Speak with Animals
Range: 0 (Cleric only)
Duration: 6 turns
Effect: Allows conversation within 30'
When this spell is cast, the cleric must
name one type of animal (such as "normal
bats," "wolves," etc.). For the duration of
the spell, the cleric may speak with all ani-
mals of that type if they are within 30'; the
effect moves with the caster. Any normal
or giant forms of animals (including mam-
mals, insects, birds, etc.) may be spoken to,
but intelligent animals and fantastic crea-
tures are not affected. When there exist
both normal and giant forms, only one
type (either normal or giant) may be
named. The creatures' reactions are usu-
usually favorable (+2 bonus to reaction roll),
and they may be talked into doing a favor
for the cleric if the reaction is high enough.
The favor requested must be understood
by the animal, and must be possible for the
creature to perform.
Third Level Clerical Spells
Continual Light*
Range: 120'
Duration: Permanent
Effect: Sphere of light 60' across
This spell creates light as bright as daylight
in a spherical volume of 30' radius. It lasts
until a dispel magic or continual darkness spell
is cast upon it. Creatures penalized in
bright daylight (such as goblins) suffer the
same penalties within this spell effect. If
cast on an opponent's eyes, the victim must
make a Saving Throw vs. Spells or be
blinded until the effect is removed. This
spell may be cast either in an area or upon
an object.
The reverse of this spell, continual dark-
ness, creates a completely dark volume of
the same size. Torches, lanterns, and even
a light spell will not affect it, and infravision
cannot penetrate it. If cast on a creature's
eyes, the creature must make a Saving
Throw vs. Spells or be blinded until the
spell is removed.
Cure Blindness
Range: Touch
Duration: Permanent
Effect: One living creature
This spell will cure nearly any form of
blindness, including those caused by light
or darkness spells (whether normal or con-
tinual). It will not, however, affect blind-
ness caused by a curse.
Cure Disease*
Range: 30'
Duration: Permanent
Effect: One living creature within range
This spell will cure any living creature of
one disease, such as those caused by a
mummy or green slime. If cast by a cleric
of 11th level or greater, this spell will cure
lycanthropy.
The reverse of this spell, cause disease, in-
fects the victim with a hideous wasting dis-
ease unless a Saving Throw vs. Spells is
made. A diseased victim has a - 2 penalty
on all Hit rolls. In addition, the victim's
wounds cannot be magically cured; and
natural healing takes twice as long as usual.
The disease is fatal in 2-24 days unless re-
moved by a cure disease spell.
Growth of Animal
Range: 120'
Duration: 12 turns
Effect: Doubles the size of one animal
This spell doubles the size of one normal
or giant animal. The animal then has twice
its normal strength and inflicts double nor-
mal damage. It may also carry twice its nor-
mal encumbrance. This spell does not
change an animal's behavior. Armor Class,
or hit points, and does not affect intelligent
animal races or fantastic creatures.
Locate Object
Range: 0 (Cleric only)
Duration: 6 turns
Effect: Detects one object within 120'
This spell allows the cleric to sense the di-
rection of one known object. It gives no
information about distance. A common ob-
ject (such as "stairs leading up") can be de-
tected; otherwise, the cleric must know ex-
actly what the object looks like (size, shape,
color, etc.). The spell will not locate a crea-
ture.
Remove Curse"
Range: Touch
Duration: Permanent
Effect: Removes any one curse
This spell removes one curse, whether on a
character, item, or area. Some curses - es-
pecially those on magic items - may only
be temporarily removed for a short time,
DM's discretion, requiring a dispel evil spell
for permanent effect (or possibly a remove
curse cast by a high level cleric or magic-
user).
The reverse of this spell, curse, causes a
misfortune or penalty to affect the victim.
Curses are limited only by the caster's
imagination, but if an attempted curse is
too powerful, it may return to the caster
(DM's discretion)! Safe limits to curses may
include: - 4 penalty on Hit rolls; - 2
penalty on Saving Throws; prime requisite
reduced to 1/2 normal. The victim may
make a Saving Throw vs. Spells to avoid
the curse.
Speak with the Dead
Range: 10'
Duration: 1 round per level of the cleric
Effect: Cleric may ask 3 questions
By means of this spell, a cleric may ask 3
questions of a deceased spirit if the body is
within range. A cleric of up to 7th level
may only contact spirits recently dead (up
to 4 days). Clerics of level 8-14 have slightly
more power (up to 4 months dead), level
15-20 even more (up to 4 years dead). No
time limits apply to clerics of 21st level or
greater. The spirit will always reply in a
tongue known to the cleric, but can only
offer knowledge of things up to the time of
its death. If the spirit's alignment is the
same as the cleric's, clear and brief answers
will be given; however, if the alignments
differ, the spirit may reply in riddles.
Striking
Range: 30'
Duration: 1 turn
Effect: 1d6 bonus to damage on 1 weapon
This spell allows any one weapon to inflict
1-6 additional points of damage per attack
(like a magical staff of striking). The
weapon will inflict this extra damage for as
long as the spell lasts. The bonus does not
apply to Hit rolls. If cast on a normal
weapon, creatures affected only by magic
weapons may be hit, for 1-6 points of
damage per strike (regardless of the
weapon; only the magical damage applies
in such cases).
Fourth Level Clerical Spells
Animate Dead
Range: 60'
Duration: Permanent
Effect: Creates zombies or skeletons
This spell allows the caster to make ani-
mated, enchanted skeletons or zombies
from normal skeletons or dead bodies
within range. These animated undead
creatures will obey the cleric until they are
destroyed by another cleric or a dispel magic
spell. For each level of the cleric, one Hit
Die of undead may be animated. A skel-
eton has the same Hit Dice as the original
creature, but a zombie has one Hit Die
more than the original. Character levels
are not counted (the remains of a 9th level
thief would be animated as a zombie with 2
HD). Animated creatures do not have any
spells, but are immune to sleep and charm
effects and poison.
lawful clerics must take care to use this
spell only for good purpose. Animating
the dead is usually a Chaotic act.
Create Water
Range: 10'
Duration: 6 turns
Effect: Creates one magical spring
With this spell, the cleric summons forth
an enchanted spring from the ground or a
wall. The spring will flow for an hour,
creating enough water for 12 men and
their mounts (for that day, about 50 gal-
lons). For each of the cleric's levels above 8,
water for twelve additional men and
mounts is created.
Cure Serious Wounds"
Range: Touch
Duration: Permanent
Effect: Any one living creature
This spell is similar to a cure light wounds
spell, but will cure one creature of 4-14
+
points of damage (2d6 2).
The reverse of this spell, cause serious
wounds, causes 4-14 points of damage to
any creature or character touched (no Sav-
ing Throw). The caster must make a nor-
mal Hit roll to cause the serious wound.
Dispel Magic
Range: 120'
Duration: Permanent
Effect: Destroys spells in a 20' cube
This spell destroys other spell effects in a
cubic volume of 20' x 20' x 20'. It does not
affect magic items. Spell effects created by
a caster (whether cleric, magic-user, or elf)
of a level equal to or lower than the caster
of the dispel magic are automatically and im-
mediately destroyed. Spell effects created
by a higher level caster might not be af-
fected. The chance of failure is 5% per
level of difference between the casters. For
example, a 7th level cleric trying to dispel a
web spell cast by a 9th level magic-user
would have a 10% chance of failure.
Neutralize Poison*
Range: Touch
Duration: Permanent
Effect: A creature, container, or object
This spell will make poison harmless either
in a creature, a container (such as a bottle),
or on one object (such as a chest). It will
even revive a victim slain by poison if cast
within 10 rounds of the poisoning! The
spell will affect any and all poisons present
at the time it is cast, but does not cure any
damage (and will thus not revive a poi-
soned victim who has died of wounds).
The reverse of this spell, create poison,
may be cast, by touch, on a creature or
container. It cannot be cast on any other
object. A victim must make a Saving
Throw vs. Poison or be immediately slain
by the poison. If cast on a container, the
contents become poisoned; no Saving
Throw applies, even for magical containers
or contents (such as potions). Poisoning is
usually a Chaotic act.
Protection from Evil 10' Radius
Range: 0
Duration: 12 turns
Effect: Barrier 20' diameter
This spell creates an invisible magical bar-
rier all around the caster, extending 10' in
all directions. The spell serves as protec-
tion from "evil" attacks (attacks by mon-
sters of an alignment other than the
caster's). Each creature within the barrier
gains a $1 to all Saving Throws, and all
attacks against those within are penalized
by -1 to the attacker's Hit roll while the
spell lasts.
In addition, "enchanted creatures can-
not attack those within the barrier hand-to-
hand. Enchanted creatures can attack with
missile or magical attacks however. An "en-
chanted" creature is any creature that is
magically summoned, animated or controlled
(as with a charm spell) or can only be hit by
a magical weapon. Creatures that can be
hit by silver weapons are not enchanted.
If anyone within the barrier attacks an
enchanted creature, the barrier will no
longer prevent the creature from attacking
hand-to-hand, but the bonus to Saving
Throws and penalty to Hit rolls will still
apply.
Speak with Plants
Range: 0 (Cleric only)
Duration: 3 turns
Effect: All plants within 30'
This spell enables the cleric to talk to plants
as if they were intelligent. A simple favor
may be requested, and will be granted if it
is within the plants' power to understand
and perform. This spell may be used to
allow the cleric and party to pass through
otherwise impenetrable undergrowth. It
will also allow communication with plant-
like monsters (such as treants).
Sticks to Snakes
Range: 120'
Duration: 6 turns
Effect: Up to 16 sticks
This spell turns 2-16 sticks into snakes (de-
tailed below). The snakes may be poi-
sonous (50% chance per snake). They obey
the cleric's commands, but will turn back
into sticks when slain or when the duration
ends.
Snakes: Armor Class 6, Hit Dice 1, Move
90' (30'), Attacks 1, Damage 1-4, Save As:
Fighter 1, Alignment Neutral.
Fifth Level Clerical Spells
Commune
Range: 0 (Cleric only)
Duration: 3 turns
Effect: 3 questions
This spell allows the cleric to ask questions
of the greater powers (the DM, mythologi-
cal deities, etc.). The cleric may ask three
questions that can be answered yes or no.
However, a cleric may commune only once a
week. If this spell is used too often, the DM
may wish to limit its use to once a month.
Once a year the cleric may ask twice the
normal number of questions.
Create Food
Range: 10'
Duration: Permanent
Effect: Creates food for 12 or more
This spell creates enough food to feed 12
men and their mounts for one day. For
every level of the cleric above Sth, food for
12 additional men and mounts is created.
Dispel Evil
Range: 30'
Duration: 1 turn
Effect: Enchanted or undead monsters or
one Curse or Charm
This spell may affect all undead and en-
chanted (summoned, controlled, and ani-
mated) monsters within range. It will de-
stroy the monster unless each victim makes
a Saving Throw vs. Spells. If cast at only
one creature, a - 2 penalty applies to the
Saving Throw. Any creature from another
plane is Banished (forced to return to its
home plane) if the Saving Throw is failed.
Even if the Saving Throw is successful, the
victims must flee the area, and will stay
away as long as the caster concentrates
(without moving).
This spell will also remove the curse
from any one cursed item, or may be used
to remove any magical charm.
Insect Plague
Range: 480'
Duration: 1 day
Effect: Creates a swarm of 30' radius
This spell summons a vast swarm of in-
sects. The swarm obscures vision and
drives off creatures of less than 3 Hit Dice
(no Saving Throw). The swarm moves at
up to 20' per round as directed by the
cleric while it is within range. The caster
must concentrate, without moving, to con-
trol the swarm. If the caster is disturbed,
the insects scatter and the spell ends. This
spell only works outdoors and above-
ground.
Quest*
Range: 30'
Duration: Special
Effect: Compels one living creature
This spell forces the recipient to perform
some special task or quest, as commanded
by the caster. The victim may make a Sav-
ing Throw vs. Spells to avoid the effect. A
typical task might include slaying a certain
monster, rescuing a prisoner, obtaining a
magic item for the caster, or going on a
pilgrimage. If the task is impossible or sui-
cidal, the spell has no effect. Once the task
is completed, the spell ends. Any victim re-
fusing to go on the quest is cursed until the
quest is continued. The type of curse is de-
cided by the DM, but may be double nor-
mal strength.
The reverse of this spell, remove quest,
may be used to dispel an unwanted quest or
a quest-related curse. The chance of success
is 50%, reduced by 5% for every level of
the caster below that of the caster of the
quest (an 11th level cleric attempting to re-
move a quest from a 13th level cleric has a
40% chance of success).
Raise Dead*
Range: 120'
Duration: Permanent
Effect: Body of one human or
demi-human
By means of this spell, the cleric can raise
any human, dwarf, halfling, or elf from
the dead. The body must be present, and if
part is missing, the raised character may be
disabled in some way. An 8th level cleric
can raise a body that has been dead for up
to four days. For each level of the cleric
above Sth, four days are added to this time.
Thus, a 10th level cleric can raise bodies
that have been dead for up to twelve days.
The recipient becomes alive with 1 hit
point, and cannot fight, cast spells, use abil-
ities, carry heavy loads, or move more than
half speed. These penalties will disappear
after 2 full weeks of complete bed rest, but
the healing cannot be speeded by magic.
This spell may also be cast at any one
undead creature within range. The crea-
ture will be slain unless it makes a Saving
Throw vs. Spells with a - 2 penalty. How-
ever, a vampire thus affected is only forced
to retreat to its coffin, in gaseous form, to
rest.
The reverse of this spel1,finger of death,
creates a death ray that will kill any one
living creature within 60'. The victim may
make a Saving Throw vs. Death Ray to
avoid the effect. A Lawful cleric will only
use finger .f death in a life-or-death situa-
tion.
Sixth Level Clerical Spells
Animate Objects
Range: 60'
Duration: 6 turns (1 hour)
Effect: Causes objects to move (see below)
The cleric may use this spell to cause any
non-living, non-magical objects to move
and attack. Magical objects are not af-
fected. Any one object up to 4,000 cn
weight may be animated (roughly the size
of two men), or smaller objects whose total
weight does not exceed 4,000 cn. The DM
must decide on the movement rate, num-
ber of attacks, damage, and other combat
details of the objects animated. As a guide-
line, a man-sized statue might have a 3"
movement rate, attack once per round for
2-16 points of damage, and have an Armor
Class of 1. A chair might only be AC 6, but
move at 180' per round on its four legs,
attacking twice per round for 1-4 points
per attack. All objects have the same
chances to hit as the cleric animating them.
Find the Path
Range: 0 (Cleric only)
Duration: 6 turns + 1 turn per level of the
caster
Effect: Shows the path to an area
When this spell is cast, the cleric must
name a specific place, though it need not
have been visited before. For the duration
of the spell, the cleric will know the di-
rection to that place. In addition, any spe-
cial knowledge needed to get to the place
will also be gained; for example, locations
of secret doors become known, passwords,
and so forth. This spell is often used to
find a fast escape route.
Speak with Monsters*
Range: 0 (Cleric only)
Duration: 1 round per level of the cleric
Effect: Permits conversation with any
monster
This spell gives the caster the power to ask
questions of any and all living and undead
creatures within 30'. Even unintelligent
monsters will understand and respond to
the cleric. Those spoken to will not attack
the cleric while engaged in conversation,
but may defend themselves if attacked.
Only one question per round may be
asked, and the spell lasts 1 round per level
of the caster.
The reverse of this spell, babble, has a 60'
range, and a duration of 1 turn per level of
the caster. The victim may make a Saving
Throw vs. Spells to avoid the effect, but
with a - 2 penalty to the roll. If the Saving
Throw is failed, the victim cannot be un-
derstood by any other creature for the du-
ration of the spell. Even hand motions,
written notes, and all other forms of com-
munication will seem garbled. This does
not interfere with the victim's spell casting
(if any), but does prevent the use of many
magic items by turning the command
words to mere babbling.
Word of Recall
Range: 0 (Cleric only)
Duration: Instantaneous
Effect: Teleports the caster to sanctuary
Similar to a magic-user's teleport spell, this
spell carries the cleric and all equipment
carried (but no other creatures) to the
cleric's home. The cleric must have a per-
manent home (such as a castle), and a med-
itation room within that home; this room is
the destination when the spell is cast. Dur-
ing the round in which this spell is cast, the
cleric automatically gains initiative unless
surprised.

[Expert pages 13-18: magic-user spell expansions]
FIRST LEVEL MAGIC-USER SPELLS
1. Charm Person
2. Detect Magic
3. Floating Disc
4. Hold Portal
5. Light*
6. Magic Missile
7. Protection from Evil
8. Read Languages
9. Read Magic
10. Shield
11. Sleep
12. Ventriloquism

SECOND LEVEL MAGIC-USER SPELLS
1. Continual Light*
2. Detect Evil
3. Detect Invisible
4. ESP*
5. Invisibility
6. Knock
7. Levitate
8. Locate Object
9. Mirror Image
10. Phantasmal Force
11. Web
12. Wizard Lock

THIRD LEVEL MAGIC-USER SPELLS
1. Clairvoyance
2. Dispel Magic
3. Fire Ball
4. Fly
5. Haste*
6. Hold Person*
7. Infravision
8. Invisibility 10' radius
9. Lightning Bolt
10. Protection from Evil 10' radius
11. Protection from Normal Missiles
12. Water Breathing

FOURTH LEVEL MAGIC-USER SPELLS
1. Charm Monster
2. Confusion
3. Dimension Door
4. Growth of Plants*
5. Hallucinatory Terrain
6. Ice Storm/Wall
7. Massmorph
8. Polymorph Others
9. Polymorph Self
10. Remove Curse*
11. Wall of Fire
12. Wizard Eye

FIFTH LEVEL MAGIC-USER SPELLS
1. Animate Dead
2. Cloudkill
3. Conjure Elemental
4. Hold Monster*
5. Magic Jar
6. Pass-Wall
7. Teleport
8. Wall of Stone

SIXTH LEVEL MAGIC-USER SPELLS
1. Anti-Magic Shell
2. Death Spell
3. Disintegrate
4. Geas*
5. Invisible Stalker
6. Lower Water
7. Projected Image
8. Stone to Flesh*

*Spell may be cast with reverse effect.

The following first and second level spells
may be reversed; Ranges, durations, Sav-
ing Throws, and areas of effect will remain
unchanged unless specified.

First Level Magic-user Spells

Light*
When reversed, this spell, darkness, creates
a circle of darkness 30' in diameter. It will
block all sight except infravision. Darkness
will cancel a light spell if cast upon it (but
may itself be cancelled by another light
spell). If cast at an opponent's eyes, it will
cause blindness until cancelled, or until the
duration ends.

Second Level Magic-user Spells

Continual Light*
The reverse of this spell, continual darkness,
creates a completely dark volume of 30'
radius. Torches, lanterns, and even a light
spell will not affect it, and infravision can-
not penetrate it. If cast on a creature's eyes,
the creature must make a Saving Throw vs.
Spells or be blinded until the spell is re-
moved. A continual light spell will cancel its
effects.

Fly
Range: Touch
Duration: 1-6 turns + 1 turn per level of
the caster
Effect: One creature may fly
This spell allows the recipient (possibly the
caster) to fly. The spell will permit move-
ment in any direction and at any speed up
to 360' per turn (120' per round) by mere
concentration. The recipient may also stop
and hover at any point (as a levitate spell),
which does not require concentration.
Haste*
Range: 240'
Duration: 3 turns
Effect: Up to 24 creatures move double
speed
This spell allows up to 24 creatures in a 60'
diameter circle to perform actions at dou-
ble speed for a half hour. Those affected
may move at up to twice normal speed and
make double the normal number of missile
or hand-to-hand attacks. This spell does
not affect the rate at which magic works, so
the casting of spells and the use of devices
(such as wands) cannot be speeded up.
The reverse of this spell, slow, will re-
move the effects of a haste spell, or will
cause the victims to move and attack at half
normal speed for the duration of the spell.
As with haste, spell casting is not affected.
The victims may make a Saving Throw vs.
Spells to avoid the effect.
Hold Person*
Range: 120'
Duration: 1 turn/level
Effect: Paralyzes up to 4 creatures
This spell will affect human, demi-human,
and human-like creatures (bugbear, dryad,
gnoll, gnome, hobgoblin, kobold, lizard
man, ogre, orc, nixie, pixie or sprite). It
will not affect the undead or creatures
larger than ogres. Each victim must make a
Saving Throw vs. Spells or be paralyzed.
The spell may be cast at a single person or
at a group. If cast at a single person, a - 2
penalty applies to the Saving Throw. If cast
at a group, it will affect up to 4 persons (at
the magic-user's choice), but with no
penalty to their rolls.
The reverse of the spell, free person, re-
moves the paralysis of up to 4 victims of
the normal form of the spell (including
one cast by a cleric). It has no other effect.
Infravision
Range: Touch
Duration: 1 day
Effect: One living creature
This spell enables the recipient to see in the
dark, to a 60' range. (See the D&D Basic
Set DM Rulebook, page 22, for notes on
Infravision.)
Invisibility 10' radius
Range: 120'
Duration: Permanent until broken
Effect: All creatures within 10'
This spell makes the recipient and all oth-
ers within 10' (at the time of the casting)
invisible. This is an area effect, and those
who move further than 10' from the recip-
ient become visible. They may not regain
invisibility by returning to the area. Other-
wise, the invisibility is the same as that be-
stowed by the spell invisibility (Basic Player's
Guide, page 41). All items carried (whether
by the recipient or others within 10') also
become invisible.
Lightning Bolt
Range: 180'
Duration: Instantaneous
Effect: Bolt 60' long, 5' wide
This spell creates a bolt of lightning, start-
ing up to 180' away from the caster and
extending 60' further away. All creatures
within the area of effect take 1-6 points of
damage per level of the spell caster. Each
victim may make a Saving Throw vs.
Spells; if successful, only half damage is
taken. If the lightning bolt strikes a solid sur-
face (such as a wall), it will bounce back
toward the caster until the total length of
the bolt is 60'.
Protection from Evil 10' Radius
Range: 0
Duration: 12 turns
Effect: Barrier 20' diameter
This spell creates an invisible magical bar-
rier all around the caster, extending 10' in
all directions. The spell serves as protec-
tion from "evil" attacks (attacks by mon-
sters of an alignment other than the
caster's). Each creature within the barrier
gains a +1 to all Saving Throws, and all
attacks against those within are penalized
by -1 to the attacker's Hit roll while the
spell lasts.
In addition, "enchanted" creatures can-
not attack those within the barrier hand-to-
hand. Enchanted creatures can attack with
missile or magical attacks however. An "en-
chanted" creature is any creature that is
magically summoned, animated or controlled
(as with a charm spell) or can only be hit by
a magical weapon. Creatures that can be
hit by silver weapons are not enchanted.
If anyone within the barrier attacks an
enchanted creature, the barrier will no
longer prevent the creature from attacking
hand-to-hand, but the bonus to Saving
Throws and penalty to Hit rolls will still
apply.
Protection from Normal Missiles
Range: 30'
Duration: 12 turns
Effect: One creature
This spell gives complete protection from
all small non-magical missiles, causing
them to miss. Thus, a catapult stone or a
magic arrow would not be affected. Any
one creature within range may be the re-
cipient.
Water Breathing
Range: 30'
Duration: 1 day
Effect: One air-breathing creature
This spell allows the recipient to breathe
while under water (at any depth). It does
not affect movement in any way, nor does
it interfere with the breathing of air.
Fourth Level Magic-user Spells
Charm Monster
Range: 120'
Duration: Special
Effect: One or more living creatures
This spell effect is identical to that of a
charm person spell, but any creature except
an undead may be affected. If the victims
have 3 Hit Dice or less, 3-18 may be
charmed. Otherwise, only one monster will
be affected. Each victim may make a Sav-
ing Throw vs. Spells to avoid the effects.
Confusion
Range: 120'
Duration: 12 rounds
Effect: 3-18 creatures in an area 60' across
This spell will confuse several creatures, af-
fecting all within a 30' radius. Victims with
less than 2+1 Hit Dice are not allowed a
Saving Throw. Those with 2+1 or more
Hit Dice must make a Saving Throw vs.
Spells every round of the spell's duration,
if they remain in the area, or be confused.
Each confused creature acts randomly.
The DM should roll 2d6 each round to
determine each creature's action, using the
following chart:
2-5 Attack the spell caster's party
6-8 Do nothing
9-12 Attack the creature's own party
Dimension Door
Range: 10'
Duration: 1 round
Effect: Safely transports one creature
This spell will transport one creature up to
10' from the caster, to a place up to 360'
away. The caster picks the desired destina-
tion. If the location is not known, distances
not exceeding a total of 360' may be given
(for example, 200' west, 60' south, 100'
down). If this would cause the recipient to
arrive at a location occupied by a solid ob-
ject, the spell has no effect. An unwilling
recipient may make a Saving Throw vs.
Spells to avoid the effect.
Growth of Plants*
Range: 120'
Duration: Special
Effect: Enlarges 3000 square feet of plants
This spell causes normal brush or woods to
become thickly overgrown with vines,
creepers, thorns, briars. An area of up to
3000 square feet may be affected (the di-
mensions chosen by the caster). The plants
to be affected must be entirely within the
spell's range. The affected area is impassa-
ble to all but giant-sized creatures. The
effect lasts until removed by the reverse or
by a dispel magic spell.
The reverse of this spell, shrink plants,
causes all normal plants within a similar
area of effect to shrink and become pass-
able. It may be used to negate the effects of
the normal spell. Shrink plants will not af-
fect plant-like monsters (such as treants).
Hallucinatory Terrain
Range: 240'
Duration: Special
Effect: Changes or hides terrain
This spell creates the illusion of a "terrain
feature," either indoors (such as a pit,
stairs, etc.) or outdoors (hill, swamp, grove
of trees, etc.), possibly hiding a real fea-
ture. The entire terrain feature must be
within the range of the spell. The spell lasts
until the illusion is touched by an intel-
ligent creature, or until dispelled.
Ice Storm/Wall
Range: 120'
Duration: Storm 1 round or Wall 12 turns
Effect: Storm in 20' x 20' x 20' volume or
wall of 1200 square feet
This spell may be cast in either of two ways:
either as an icy blast, ice storm, or a wall of
ice.
An ice storm fills a 20' x 20' x 20' cube. If
cast in a smaller area, it will remain 20'
long at most. The storm inflicts 1-6 points
of cold damage per level of the caster to
every creature in the area. Each victim may
make a Saving Throw vs. Spells; if success-
ful, the spell only does half damage. Fire-
type creatures (red dragon, flame sala-
mander, etc.) have a - 4 penalty on their
Saving Throws, but cold-type creatures
(frost giant, frost salamander, etc.) are not
affected by the spell.
A wall of ice is a thin vertical wall of any
dimensions and shape determined by the
magic-user totalling 1200 square feet (such
as 10' x 120', 20' x 60', 30' x 40', etc.). The
wall is opaque and will block sight. Crea-
tures of less than 4 Hit Dice cannot break
through the wall. Creatures of 4 HD or
more can break through, but take 1-6
points of damage in the process. Fire-type
creatures each take twice the amount of damage
 (2-12) while breaking
through. The wall must be cast to rest on
the ground or similar support, and cannot
be cast in a space occupied by another ob-
ject.
Massmorph
Range: 240'
Duration: See below
Effect: Causes illusion of trees
This spell will affect up to 100 human or
man-sized creatures in a 240' diameter,
making them appear to be the trees of an
orchard or dense woods. Unwilling crea-
tures are not affected. Creatures larger
than man-size (such as horses) may be in-
cluded, counting them as 2 or 3 men each.
The illusion will even hide the recipients
from creatures moving through the area
affected. The spell lasts until a dispel magic
is cast on it or until the caster decides to
drop the illusion. The appearance of each
disguised creature returns to normal if the
creature moves out of the affected area.
However, movement within the area does
not destroy the illusion.
Polymorph Other
Range: 60'
Duration: Permanent until dispelled
Effect: Changes one living creature
This spell changes the victim into another
living creature. The new form may have
no more than twice as many Hit Dice as the
original, or the spell will fail. The number
of hit points remains the same. Unlike the
polymorph self spell, the recipient actually
becomes the new creature, gaining any and
all special abilities of the new form, plus its
tendencies and behavior. For example, a
hobgoblin polymorphed into a mule will
think and act like a mule.
This spell cannot create a duplicate of a
specific individual, only a race or monster
type. For example, a creature polymorphed
into a "9th level fighter" will indeed be-
come a human, but not necessarily a
fighter and no higher than 1st level.
The victim of this spell may make a Sav-
ing Throw vs. Spells to avoid the effect.
The effect lasts until dispelled, or until the
creature dies.
Polymorph Self
Range: 0 (Caster only)
Duration: 6 turns + 1 turn per level of the
caster
Effect: Caster may change shapes
This spell allows the caster to change
shape, taking the physical form of another
living creature. The Hit Dice of the new
form must be equal to or less than the Hit
Dice of the caster. The caster's Armor
Class, hit points, Hit rolls, and Saving
Throws do not change. Special abilities
and special immunities of the new form
are not gained, but physical abilities are ac-
quired. For example, a magic-user poly-
morphed into a frost giant has the strength
of a frost giant and the ability to hurl boul-
ders, but not immunity from cold. A
magic-user polymorphed into a dragon
could fly but would not be able to use any
breath weapons or spells.
Spells cannot be cast while polymorphed
into a different form. The spell lasts for the
given duration, or until dispelled, or until
the caster is killed. This spell will not en-
able the caster to take the form of a specific
individual (see polymorph other).
Remove Curse*
Range: Touch
Duration: Permanent
Effect: Removes any one curse
This spell removes one curse, whether on a
character, item, or area. Some curses - es-
pecially those on magic items - may only
be temporarily removed, DM's discretion,
requiring a clerical dispel evil spell for per-
manent effect (or possibly a remove curse
cast by a high level magic-user).
The reverse of this spell, curse, causes a
misfortune or penalty to affect the recip-
ient. Curses are limited only by the caster's
imagination, but if an attempted curse is
too powerful, it may return to the caster
(DM's discretion)! Safe limits to curses may
include: - 4 penalty on Hit rolls; - 2
penalty to all Saving Throws; prime requi-
site reduced to 1/2 normal. The victim may
make a Saving Throw vs. Spells to avoid
the curse.
Wall of Fire
Range: 60'
Duration: Concentration
Effect: Creates 1200 square feet of fire
This spell creates a thin vertical wall of fire
of any dimensions and shape, determined
by the magic-user, totalling 1,200 square
feet (for example, 10' x 120', 20' x 60', 30'
x 40', etc.). The wall is opaque and will
block sight. Creatures of less than 4 Hit
Dice cannot break through the wall. Crea-
tures of 4 HD or more can break through,
but take 1-6 points of damage in the proc-
ess. Undead and cold-using creatures
(white dragons, frost giants, etc.) each take
double damage while breaking through.
The wall cannot be cast in a space occupied
by another object. It lasts as long as the
caster concentrates on it, without moving.
Wizard Eye
Range: 240'
Duration: 6 turns
Effect: Creates movable invisible eye
This spell creates an invisible eye through
which the caster can see. It is the size of a
real eye and has infravision (60' range).
The wizard eye floats through the air at up
to 120' per turn, but will not go through
solid objects nor move more than 240'
away from the caster. The magic-user must
concentrate to see through the eye.
Fifth Level Magic-user Spells
Animate Dead
Range: 60'
Duration: permanent
Effect: Creates zombies or skeletons
This spell allows the caster to make ani-
mated skeletons or zombies from normal
skeletons or dead bodies within range.
These animated undead creatures will
obey the magic-user until they are de-
stroyed by a cleric or a dispel magic spell.
For each level of the magic-user, one Hit
Die of undead may be animated. A skel-
eton has the same Hit Dice as the original
creature, but a zombie has one Hit Die
more than the original. Character levels
are not counted (the remains of a 9th level
thief would be animated as a zombie with 2
HD). Animated creatures do not have any
spells, but are immune to sleep and charm
effects and poison.
Cloudkill
Range: 1'
Duration: 6 turns
Effect: Creates a moving poison cloud
This spell creates a circular cloud of poi-
sonous vapor, 30' across and 20' tall, which
appears next to the magic-user. It moves
away at the rate of 60' per turn (20' per
round) in any one direction (with the wind,
if any; otherwise, in the direction chosen
by the caster). This cloud is heavier than
air and will sink when possible (going
down holes, sliding downhill, etc.). The
cloud will be destroyed if it hits trees or
other thick vegetation'. If cast in a small
area (such as in a 10' tall dungeon corri-
dor), the cloud may be of smaller than nor-
mal size.
All living creatures within the cloud take
1 point of damage per round. Any victim
of less than 5 Hit Dice must make a Saving
Throw vs. Poison or be killed by the va-
pors.
Conjure Elemental
Range: 240'
Duration: Concentration
Effect: Summons one 16 HD elemental
This spell allows the caster to summon any
one elemental (AC: - 2, HD: 16, Damage:
3-24; see page 49). Only one of each type
of elemental (earth, air, fire, water) may be
summoned in one day. The elemental will
perform any tasks within its power (carry-
ing, attacking, etc.) as long as the caster
maintains control by concentrating. The
caster cannot fight, cast other spells, or
move over half normal speed, or the con-
trol is lost. If control is lost, it cannot be
regained. An uncontrolled elemental will
try to slay its summoner, and may attack
anyone in its path while pursuing him. A
controlled elemental may be returned to its
home plane simply by concentration. An
uncontrolled elemental may also be sent
back by the use of a dispel magic or dispel evil
spell.
Hold Monster*
Range: 120'
Duration: 6 turns + 1 turn per level of the
caster
Effect: Paralyzes 1-4 creatures
This spell has an effect identical to that of a
hold person spell, but will affect any living
creature (not undead). Each victim must
make a Saving Throw vs. Spells or be pa-
ralyzed. The spell may be cast at a single
creature or a group. If cast at a single crea-
ture, a - 2 penalty applies to the Saving
Throw. If cast at a group, it will affect 1-4
creatures (the magic-user's choice), but
with no penalties.
The reverse of this spell, free monster re-
moves the paralysis of up to 4 victims of
hold person or hold monster spells. It has no
other effect.
Magic Jar
Range: 30'
Duration: See below
Effect: Possess one body
This spell causes the caster's body to fall
into a trance, while the caster's life force is
placed in an inanimate object (magic jar)
within range. From this object (a gem or
vial, for example), the caster's life force
may attempt to possess any one creature
within 120' of the magic jar. If the victim
makes a successful Saving Throw vs. Spells,
the possession fails and the caster may not
try to possess that victim again for one
turn. If the victim fails the Saving Throw,
the creature's body is possessed and is un-
der the caster's control. The life force of
the possessed victim is placed into the magic
jar.
The caster may cause the body to per-
form any normal actions, but not special
abilities (similar to a polymorph self effect). A
dispel evil spell will force the magic-user's
life force out of the possessed body and
back into the magic jar. When the magic-
user returns to his or her real body, the
spell ends.
If the possessed body is destroyed, the
victim's life force dies, and the caster's life
force returns to the magic jar . From there
the caster may try to possess another body
or return to the original body. If the magic
jar is destroyed while the caster's life force
is within it, the caster is killed. If the magic
jar is destroyed while the caster's life force
is in a possessed body, the life force is
stranded in that body. If the caster's origi-
nal body is destroyed, his life force is
stranded in the magic jar until the caster
can possess another body! The possession
of another's body is a Chaotic act.
Pass-Wall
Range: 30'
Duration: 3 turns
Effect: Creates a hole 10' deep
This spell causes a hole 5' diameter, 10'
deep to appear in solid rock or stone only.
The stone reappears at the end of the du-
ration. The hole may be horizontal or ver-
tical.
Teleport
Range: 10'
Duration: Instantaneous
Effect: Transports one creature with all
equipment
This spell instantly transports the magic-
user or other recipient to any unoccupied
ground-level destination on the same
plane of existence! An unwilling victim
may make a Saving Throw vs. Spells to
avoid the effect. The recipient arrives at
the destination with all equipment carried.
The destination may not deliberately be
one known to be occupied by a solid object,
or above ground level. The chance of ar-
riving safely depends on how carefully the
caster has studied the area. Any creature
teleporting into a solid object is instantly
killed.
Knowledge of Destination
Result
Casual
General
Exact
01-95
Success
01-80
01-50
96-99
Too High
51-75
81-90
TooLow
91-00
76-00
"Casual Knowledge" means that the caster
has been there once or twice, or is visualiz-
ing the aiming point from descriptions or
magical means. General knowledge means
the caster has been to the area often, or has
spent several weeks studying the area magically (via crystal ball, etc.). Exact knowledge
means the caster has made a highly de-
tailed personal study of the landing point.
For each teleport, the DM rolls d%. If the
result is other than "Success," the recipient
arrives 10-100 (1d10x10) feet above or be-
low the desired destination. If "Too High,"
the recipient falls, taking damage on im-
pact (1-6 points of damage per 10' fallen).
If the result is "Too Low," death occurs
unless a vacant area (such as a cave or dun-
geon) lies conveniently at that point.
Wall of Stone
Range: 60'
Duration: Special
Effect: Creates 1000 cubic feet of stone
This spell creates a vertical stone wall ex-
actly 2' thick. Any dimensions and shape
may be chosen by the caster, but the total
area must be 500 square feet or less (10' x
50', 20' x 25', etc.), and the entire wall
must be within 60' of the caster. The wall
must be created so as to rest on the ground
or similar support, and cannot be cast in a
space occupied by another object. It lasts
until dispelled or physically broken.
Sixth Level Magic-user Spells
Anti-Magic Shell
Range: 0 (Caster only)
Duration: 12 turns
Effect: Personal barrier which blocks
magic
This spell creates a n invisible barrier
around the magic-user's body (less than an
inch away). The barrier stops all spells or
spell effects, including the caster's. The
caster may destroy the shell at will; other-
wise, it lasts until the duration ends. Except
for a wish, no magical power (including a
dispel magic spell) can cancel the barrier.
Death Spell
Range: 240'
Duration: Instantaneous
Effect: Slays 4-32 Hit Dice of creatures
within a 60' x 60' x 60' area
This spell will affect 4-32 Hit Dice of living
creatures within the given area. Normal
plants and insects are automatically slain,
a n d those with no hit points are not
counted in the total affected. Undead are
not affected, nor are creatures with 8 or
more Hit Dice (or levels of experience).
The lowest Hit Dice creatures are affected
first. Each victim must make a Saving
Throw vs. Death Ray or be slain.
Disintegrate
Range: 60'
Duration: Instantaneous
Effect: Destroys one creature or object
This spell causes one creature or non-mag-
ical object to crumble to dust. A victim may
make a Saving Throw vs. Death Ray to
avoid the effect. (Examples: A dragon, a
ship, or a 10' section of wall may be disinte-
grated.) The spell does not affect magic
items or spell effects.
geas
Range: 30'
Duration: Until completed or removed
Effect: Compels one creature
This spell forces a victim either to perform
or avoid a stated action. For example, a char-
acter may be geased to bring back an object
for the caster; to eat whenever the chance
arises; or to never reveal certain informa-
tion. The action must be possible and not
directly fatal or else the gem will return and
affect the caster instead! The victim may
make a Saving Throw vs. Spells to avoid
the effect. If the victim ignores the gem,
penalties (decided by the DM) are applied
until the character either obeys the geas or
dies. Suitable penalties include minuses in
combat, lowered ability scores, loss of
spells, pain and weakness, and so forth.
Dispel m
ag c
i and remove curse spells will not
affect a geas.
The reverse of this spell, remove gem, will
rid a character of an unwanted geas and its
effects. However, if the caster is a lower
level than the caster of the original gem,
there is a chance of failure (5% per level
difference).
Invisible Stalker
Range: 0 (Caster only)
Duration: Until mission is accomplished
Effect: Summons one creature .
This spell summons an invisible stalker
(page 52), which will perform one task for
the caster. The creature will serve whatever
the time or distance involved, until the task
is completed or until the creature is slain. A
dispel evil spell will force the creature to re-
turn to its home plane.
Lower Water
Range: 240'
Duration: 10 turns
Effect: Cuts depth to 1/2 normal
This spell will affect an area up to 10,000
square feet, as noted above. If cast around
a boat or ship, the vessel may become
stuck. At the end of the duration, the sud-
den rush of water filling the "hole" will
sweep a ship's deck clear of most items and
cause 21-32 ( l d 1 2 + 2 0 ) points of hull
damage.
Projected Image
Range: 240'
Duration: 6 turns
Effect: Creates one image
This spell creates an image of the caster up
to 240' away which will last without con-
centration. The projected image cannot be
distinguished from the original except by
touch. Any spell cast will seem to come
from the image, but the caster must still be
able to see the target. Spells and missile
attacks will seem to have no effect on the
image. If touched or struck by a hand-to-
hand weapon, the image disappears.
Stone to Flesh*
Range: 120'
Duration: Permanent
Effect: One creature or object
This spell turns any one statue (or quantity
of stone up to 10' x 10' x 10') to flesh. It is
usually used to restore a character turned
to stone (by gorgon breath, for example).
The reverse of this spel1,flesh to stone, will
turn one living creature, including all
equipment carried, to stone. The victim
may make a Saving Throw vs. Turn to
Stone to avoid the effect.

```

### Research and Lost Spell Books

- Extraction note: curated Expert reconstruction from pages 27-28, replacing the contaminated line-range slice with the actual research procedures, item-creation examples, and lost spell-book recovery guidance.

```text
[Expert pages 27-28: Research and Lost Spell Books]
Research (Magic Spells and Items)

A cleric, magic-user, or elf may try to invent new spells and create new magical items through research. These are difficult and lengthy projects. The DM should be very careful when letting the players develop new spells and new magic. Permanent effects, unlimited uses, and effects that increase with level or have no Saving Throw can lead to severe imbalance. In most cases, a new design should be tested for a time with the understanding that changes may be made later if necessary.

Spells: Research requires both time and money. The player should have a firm idea of the spell desired. The new spell must be written out and given to the DM, who decides whether it is possible, what level it should be, and what changes are needed for play balance. A character may only research spells of levels equal to those which can already be cast. Spell research costs 1,000 gp and 2 weeks of time per spell level.

Magic Items: A spell caster may not create magic items until reaching 9th level or greater. A cleric may only make items usable by clerics, and a magic-user or elf may only make items usable by that class.

To create a magic item, the spell caster must first gather rare materials from which the item will be made. The DM should decide what is necessary. A scroll might require special parchment and a different formula of ink for each spell effect. Weapons might require rare metals, powdered gems forged into the metal, or the blood or skins of creatures to be specially affected by the weapon. These materials should be difficult to obtain, and the spell caster will often have to adventure to acquire them, for there are no magic shops.

The spell caster must then spend time and money fashioning the item and enchanting it. The spell caster may not go adventuring during the time it takes to create a magic item.

If an item duplicates a spell effect, the cost is usually 500 gp and 1 week of time per spell level. There is always at least a 15% chance that magical research or production will fail. This check is made after the time and money are spent.

The DM may limit or forbid the production of certain powerful items by requiring very rare substances for production. They could be hard to find, very costly, time-consuming, or require a special adventure.

Examples

Item                     Cost       Time
Scroll: magic missile
  (x2)                   1,000 gp   2 weeks
Potion of healing          500 gp   1 week
Fire ball wand
  (20 charges)          30,000 gp   17 weeks
20 arrows +1            10,000 gp   1 month
Plate mail +1           10,000 gp   6 months
Crystal ball            30,000 gp   6 months
Ring of x-ray vision   100,000 gp   12 months
Ring of spell storing   10,000 gp   1 month per spell level

Spell Books, Lost

A magic-user or elf whose spell book is lost or destroyed cannot regain spells until it is replaced. The method, time, and cost are left to the DM to decide. A rough guideline is 1,000 gp and 1 week of study for each spell level replaced. Replacing a 3rd level spell would therefore require 3,000 gp and 3 weeks. This should require all the character's time, leaving none for adventuring.

```

### Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text

- Extraction note: curated Expert reconstruction from treasure pages 60-65, combining cursed-item doctrine, general magic-item operation notes, scroll procedures, ring procedures, wand/staff/rod procedures, and selected miscellaneous magic items with strong spell-adjacent relevance.

```text
[Expert pages 60-65: scrolls, rings, wands, staves, rods, and miscellaneous magic items]
Cursed Items

Any magical treasure can be cursed when found. A curse can be removed for a short time, 1-20 rounds, by a remove curse spell, or permanently removed by the same spell from a high level cleric or magic-user, at the DM's choice. A cleric's dispel evil spell should remove nearly all curses, except perhaps those bestowed by very powerful spell casters or items.

The curse on an item may have nearly any effect imaginable. A sword +2 might be cursed to act as a sword -2, penalizing the Hit roll, and a shield +3 could likewise penalize Armor Class by 3. Items could work normally but with side effects, causing the wielder to argue, sneeze, drop other items, slowly lose strength, and so forth.

Magic Item Notes

If the range or duration of a magic item is not given, treat it the same as a magic spell from a 6th level spell caster.

The following notations may appear on Expert magic-item charts:
- (B) described in the D&D Basic Set
- (c) usable only by a cleric
- (m) usable only by a magic-user or elf
- (s) usable only by a spell caster: cleric, magic-user, or elf

Several items can detect, control, or otherwise perform actions within a given range. Any of these actions can be blocked by a thin sheet of lead, 1' of any other metal, or 10' of stone.

e. Scrolls

To use a scroll, there must be enough light to read by, and the scroll must be read aloud. A scroll, or for spell scrolls each spell, may only be used once, as the words disappear when read. Only magic-users and elves may use magic-user scrolls, and a read magic spell must be used first to discover the contents of each scroll. Only clerics may use clerical spell scrolls, but they need no magical aid to discover the contents. Anyone may use protection scrolls and treasure maps.

Spells: A scroll of spells may only be used by the character class matching the spells on the scroll. The type of spells, cleric or magic-user, the exact spells themselves, and the level of each spell may be selected or determined randomly.

Protection Scrolls: A protection scroll may be read by any character who can read the Common language.

Protection from Elementals: This scroll creates a circle of protection, 10' radius, around the reader. No elemental can attack those within the circle unless attacked first in hand-to-hand combat. Once attacked, an elemental may attack in return. The effect lasts 2 turns and moves with the reader.

Protection from Magic: This scroll creates a circle of protection, 10' radius, around the reader. No spells or spell effects, including those from items, may enter or leave the circle. The effect lasts 1-4 turns, moves with the reader, and may not be broken except by a magical wish.

Treasure Maps: Each map shows a route to the location of a treasure in a dungeon or wilderness area. The treasure is usually hidden or protected by monsters, traps, or magic. A normal treasure contains no magic items. A magical treasure may include some coins and a few gems of low value. A combined treasure has both magic and valuable gems or jewelry, and a special treasure should mention at least one permanent item, such as a Staff or Sword.

f. Rings

The ring must be worn on a hand to have its effect, but may be carried and put on when desired. Any ring may be used once per round unless noted otherwise. No more than 2 magic rings may be worn at the same time.

Delusion: The wearer believes this to be any one other ring, but it has no real effect. The wearer will not be convinced otherwise until a remove curse spell is used.

Djinni Summoning: The wearer may summon one djinni to serve for up to one day. The ring may be used once per week at most.

Human Control: This is the same effect as the potion of the same name. The effect lasts until cancelled by the wearer, until the ring is removed, or until a dispel magic spell removes the charm.

Plant Control: This has the same effect as the potion of the same name, but only lasts as long as the wearer concentrates.

Protection +1, 5' radius: This improves the wearer's Armor Class and Saving Throws by 1, and gives the same bonus to all creatures within 5', both friend and foe.

Regeneration: The wearer regenerates lost hit points at the rate of 1 per turn and may regrow lost limbs. The ring will not function if the wearer's hit points drop to 0 or less. Fire and acid damage cannot be regenerated.

Spell Storing: When found, this ring has 1-6 spells stored within it. Those exact spells are the limit of the ring's powers and cannot be changed. After a spell is used, it may be replaced by a spell caster who must cast the replacement spell directly at the ring. The ring does not absorb spells thrown at the wearer. The spells have the duration, range, and effect equal to the lowest level needed to cast them.

Spell Turning: This ring reflects 2-12 spells back to their casters. Only spells are reflected, not spell-like monster powers or spell-like item effects.

Telekinesis: The wearer may move up to 2,000 cn of weight by concentration alone.

Wishes: A ring of wishes is an extremely powerful item and should be handled with great care by both DM and players.

X-ray Vision: The wearer may see up to 30' through a wall and into the space beyond by standing still and concentrating. The effect may be blocked by gold or lead. One 10' x 10' area may be inspected per use, requiring one full turn.

g. Wands, Staves, and Rods

A rod may be used by any character class, but a staff can only be used by a spell caster, sometimes restricted to a specific type, and a wand can only be used by a magic-user or elf. A wand normally has 2-20 charges when found, and a staff 3-30. Each use of a power costs 1 charge unless noted otherwise. Each item may be used once per round at most.

Staff of Commanding (s): This item has all the powers of the rings of animal, human, and plant control.

Staff of Power (m): This item can be used as a staff of striking and can also create fire ball, lightning bolt, and ice storm effects, each doing 8-48 points of damage. It can also create a continual light effect or move 2,400 cn of weight by telekinesis.

Staff of Striking (s): This weapon inflicts 2-12 points of damage per charge if the hit is successful. Only one charge may be used per strike.

Staff of Withering (c): One hit from this item ages the victim 10 years. One or two hits are fatal to most animals and harmful to many humans. Elves may ignore the first 200 years of aging, dwarves the first 50 years, and halflings the first 20 years. Undead are not affected.

Staff of Wizardry (m): This staff +1 has all the powers of a Staff of Power, plus invisibility, passwall, web, and conjure elemental. It may also create a whirlwind, shoot a cone of paralyzation, or be broken to release all of its power in an explosion. The final strike inflicts 8 points of damage per remaining charge to all creatures within 30', including the user, though a Saving Throw vs. Staff is allowed for half damage.

Wand of Cold: This creates a cone of cold 60' long and 30' wide at the far end. All within the cone take 6-36 points of cold damage, but may make a Saving Throw vs. Wands for half damage.

Wand of Fear: This creates a cone of fear 60' long and 30' wide at the far end. All within the cone must make a Saving Throw vs. Wands or run away from the user for 30 rounds at 3 times the normal rate.

Wand of Fire Balls: This creates a fire ball effect up to 240' away. All victims take 6-36 points of fire damage, but may make a Saving Throw vs. Wands for half damage.

Wand of Illusion: This creates a phantasmal force effect. The user must concentrate on the illusion to maintain it, but may walk at half normal movement rate while doing so.

Wand of Lightning Bolts: This creates a lightning bolt starting up to 240' away and 60' long from that point. Victims take 6-36 points of electrical damage, but may make a Saving Throw vs. Wands for half damage.

Wand of Metal Detection: This points toward any named type of metal within 20' if at least 1,000 cn is present.

Wand of Negation: This cancels the effects of one other wand or staff. If the other effect has a duration, the negation lasts for one round.

Wand of Polymorphing: This creates either a polymorph self or polymorph other effect. An unwilling victim may make a Saving Throw vs. Wands to avoid the effect.

Wand of Secret Door Detection: The user may find any secret door within 20', using one charge per secret door found.

Wand of Trap Detection: This points at all traps within 20', one at a time, at a cost of 1 charge per trap.

h. Miscellaneous Magic Items

Each of these items may be used by any character class, and up to once per round unless noted otherwise. Most effects either work automatically or are activated by concentration alone.

Amulet vs. Crystal Balls and ESP: The wearer is automatically protected from being spied on by anyone using a crystal ball or any type of ESP.

Boots of Levitation: The wearer may levitate as if using the magic-user spell, with no duration limit.

Boots of Speed: The wearer may move as fast as a riding horse for 12 hours, after which the wearer must rest for one full day.

Boots of Traveling and Leaping: The wearer needs no rest during normal movement and may jump up to 10' high and 30' long.

Broom of Flying: This carries its owner through the air at 240' per turn. One other person or up to 2,000 cn of baggage may also be carried, reducing speed to 180' per turn.

Crystal Ball with Clairaudience: This works like a standard crystal ball, but also allows listening through the ears of a creature in the viewed area.

Crystal Ball with ESP: This works like a standard crystal ball, but also allows listening to the thoughts of a creature viewed.

Displacer Cloak: This warps light rays so the wearer is actually 5' away from the visible location. Hand-to-hand attacks are penalized by -2 and most missile fire automatically misses.

Drums of Panic: Creatures 10'-240' away must make a Saving Throw vs. Spells or run away from the user for 30 rounds. If the morale system is used, each creature instead makes a morale check with a +2 penalty to the roll.

Efreeti Bottle: When opened, this releases an efreeti that serves the opener once per day for 101 days or until slain.

Elemental Devices: Bowl, Brazier, Censer, or Stone. Each may be used once per day, takes 1 turn to use, summons a device elemental of the appropriate type, and allows the user to control it subject to normal elemental-control rules.

Flying Carpet: This carries one passenger at 100' per round, two at 80', or three at 60'. It will not carry more than 3 passengers and their equipment.

Girdle of Giant Strength: This gives the wearer the same chances to hit as a hill giant and 2-16 points of damage per hit.

Helm of Reading Languages and Magic: The wearer may read any writing regardless of language or magical properties. It does not allow use of spell scrolls unless the character can do so normally. The helm is fragile and may be destroyed if the wearer is killed or struck.

Helm of Teleportation (m): The wearer may teleport, including the normal chances of error, or may try to teleport another creature or item. After one use the helm no longer functions until a teleport spell is cast upon it, after which the user may teleport once per round until teleporting another item or creature.

Horn of Blasting: This creates a cone of sound 100' long and 20' wide at the far end. Victims take 2-12 points of damage and must make a Saving Throw vs. Spells or be deafened for one turn.

Medallion of ESP (90'): This allows the user to listen to another's thoughts to a range of 90'.

Mirror of Life Trapping: Any man-size or smaller creature looking into the mirror must make a Saving Throw vs. Spells or be sucked into it with all equipment. The mirror may store up to 20 creatures.

Scarab of Protection: This automatically absorbs any curse and will also absorb a finger of death. It works 2-12 times before becoming worthless.

```

