# TODO: BECMI Spell Material Staging - Rules Cyclopedia

This staging document captures spell material and associated magical-context text from `TSR 1071 - The D&D Rules Cyclopedia.pdf`.

Rules for this artifact:
- Raw classic terminology is preserved.
- This is a staging artifact, not a final crosswalk.
- `pdftotext -layout -nodiag -nopgbrk` remains the primary extractor unless a section note says otherwise.
- Parser warnings from PDF extraction stderr were suppressed and are not part of this document.
- Section methods may mix anchored line slices, page-layout extraction, cropped columns, TSV reflow, and small curated stitching when that is necessary to preserve reading order.
- Cleanup is conservative: spacing, OCR scars, and broken line wraps may be normalized, but source terminology is not converted.

Source PDF:
- `TSR 1071 - The D&D Rules Cyclopedia.pdf`

## Table Check QA Pass

- Status: reviewed 2026-03-22
- Scope checked: clerical, magical, and druidic spell lists plus the later reconstructed spellcaster and scroll tables.
- Result: no blocking row/column defects found in the visible Rules Cyclopedia table and list regions.
### Chapter 3: Spells and Spellcasting

- Extraction note: hybrid RC extraction: pages 33-34 are split into labeled layout-column slices for readable setup prose and spell-list presentation, while pages 35-59 use TSV coordinate reflow with three reading-order columns to eliminate left/right interleave in spell descriptions.

```text
[RC page 33: prose and setup]
Saving Throws vs. Spells
  With many magic spells, a character can often
resist some of the spell's effects by making a
1d20 roll called a saving throw. A saving throw is
the number the character must roll equal to or
higher than to successfully "save against a spell."
Basically, if your character makes his saving
throw, he can either reduce the damage inflicted
by the spell or he can partially (or fully) resist the
spell's effects, depending on the individual
spell.
   If a character is allowed to make a saving
throw vs. the effects of a spell, the spell descrip-
tion will mention the fact. The spell description
also explains the effect of a successful save. You
can learn more about saving throws in Chapter 8
on page 109.

Reversible Spells

  Some spells can be cast "reversed," meaning
that they result in an effect opposite to the effect
normally described for the spell. For example,
when a cleric casts a reversed healing spell, it
harms the recipient.
  On the spell lists you'll find in this chapter,
any spell marked with an asterisk (*) may be re-
versed; the spell description will explain what
the reversed spell does if it is not self-evident. If
a spell name is not marked with an asterisk, the
spell is not reversible.
  Magic-users must memorize their spells in the
reversed form in order to use them reversed.
Clerics, on the other hand, will learn their spells
through meditation, and can decide during the
casting whether to cast them in proper or re-
versed form.

Multiple Spell Effects
  Some spells can be used to temporarily im-
prove a character's attack rolls, damage rolls, sav-
ing throws, and other abilities.
  As a general rule, casting the same spell twice
on someone doesn't do any good; the spells' ef-
fects do not combine, even if they were cast by
two different characters. For instance, two haste
spells (described further in this chapter) do not
combine to allow a target character to attack at
four times the normal rate; only the first haste
will take effect.
  Different spells, on the other hand, or the ef-
fects of spells and magical items, will usually
combine successfully. For example, a bless spell
gives a character a +1 to his attack roll; so does a
magical sword with a +1 bonus. If a character
with a magical sword +1 is blessed by a cleric,
the two bonuses combine and he has a + 2 add-
ed to his attack roll (in addition to normal
Strength bonuses).

 Clerical Spells

    Clerical spells tend to be less flashy than
 magic-user spells. Clerical magic primarily in-
 volves healing, divination of truth, protection
 from harm, and so forth. Seldom do you see cler-
 ical spells as forceful and dramatic as the magic-
 user's lightning bolt. On the other hand, clerics
 can fight well and don't need such spells.

[RC page 33: clerical and druidic spell lists]
 Clerical Spells List

        First Level                         Second Level                   Third Level
    1   Cure Light Wounds*                  Bless*                         Continual Light*
    2   Detect Evil                         Find Traps                     Cure Blindness
    3   Detect Magic                        Hold Person*                   Cure Disease*
    4   Light*                              Know Alignment*                Growth of Animal
    5   Protection from Evil                Resist Fire                    Locate Object
    6   Purify Food and Water               Silence 15' Radius             Remove Curse*
    7   Remove Fear*                        Snake Charm                    Speak with the Dead
    8   Resist Cold                         Speak with Animal              Striking

        Fourth Level                        Fifth Level                    Sixth Level
    1   Animate Dead                        Commune                        Aerial Servant
    2   Create Water                        Create Food                    Animate Objects
    3   Cure Serious Wounds*                Cure Critical Wounds           Barrier*
    4   Dispel Magic                        Dispel Evil                    Create Normal Animals
    5   Neutralize Poison*                  Insect Plague                  Cureall
    6   Protection from Evil 10' radius     Quest*                         Find the Path
    7   Speak with Plants                   Raise Dead*                    Speak with Monsters*
    8   Sticks to Snakes                    Truesight                      Word of Recall

        Seventh Level
    1   Earthquake
    2   Holy Word
    3   Raise Dead Fully*
    4   Restore*
    5   Survival
    6   Travel
    7   Wish
    8 Wizardry

  * Reversible Spell

 Druidic Spells List

        First Level                         Second Level                   Third Level
    1   Detect Danger                       Heat Metal                     Call Lightning
    2   Faerie Fire                         Obscure                        Hold Animal
    3   Locate                              Produce Fire                   Protection from Poison
    4   Predict Weather                     Warp Wood                      Water Breathing

        Fourth Level                        Fifth Level                     Sixth Level
    1   Control Temperature 10' radius      Anti-Plant Shell               Anti-Animal Shell
    2   Plant Door                          Control Winds                  Summon Weather
    3   Protection from Lightning           Dissolve                       Transport Through Plants
    4   Summon Animals                      Pass Plant                     Turn Wood

        Seventh Level
    1   Creeping Doom
    2   Metal to Wood
    3   Summon Elemental
    4   Weather Control

[RC page 33: learning spells]
Learning Spells
To learn a spell, the cleric meditates, petitioning the power he serves. The memory and details of the spells appear in the cleric's mind. The cleric may cast the spells at any time thereafter. The cleric will remember each spell until it is cast, even if it is not used for days or weeks.

As a player, all you need to do is choose whatever spells you want your character to have. This can only be done when the cleric has had a good night's sleep and immediately has a full hour when he does not have to do anything strenuous.

The cleric can meditate in a certain amount of noise: the sound of a camp readying itself in the morning, the normal bustling of a house or inn, even while people are trying to talk with him. He's not totally cut off from his surroundings, and can put up a hand or say a few words to forestall further interruption. But it's not possible for the cleric to meditate in the middle of a battle.

If the cleric learned spells on a previous day that he no longer wants to have available to him, he can opt to forget them and meditate on new spells.

[RC page 34: magical spell lists]

Magical Spells List

        First Level                   Second Level                  Third Level
    1    Analyze                     Continual Light*               Clairvoyance
   2    Charm Person                 Detect Evil                     Create Air
   3    Detect Magic                 Detect Invisible                Dispel Magic
   4    Floating Disc                Entangle                       Fireball
   5    Hold Portal                  ESP*                           Fly
   6    Light*                       Invisibility                    Haste*
   7    Magic Missile                Knock                           Hold Person*
   8    Protection from Evil         Levitate                       Infravision
   9    Read Languages               Locate Object                  Invisibility 10' Radius
  10    Read Magic                   Mirror Image                    Lightning Bolt
  11    Shield                       Phantasmal Force                Protection from Evil 10' Radius
  12    Sleep                        Web                            Protection from Normal Missiles
  13    Ventriloquism                Wizard Lock                     Water Breathing

        Fourth Level                 Fifth Level                     Sixth Level
   1    Charm Monster                Animate Dead                   Anti-Magic Shell
   2    Clothform                    Cloudkill                       Death Spell
   3    Confusion                    Conjure Elemental               Disintegrate
   4    Dimension Door               Contact Outer Plane             Geas*
   5    Growth of Plants*            Dissolve*                      Invisible Stalker
   6    Hallucinatory Terrain        Feeblemind                      Lower Water
   7    Ice Storm/Wall of Ice        Hold Monster*                   Move Earth
   8    Massmorph                    Magic Jar                       Projected Image
   9    Polymorph Other              Passwall                        Reincarnation
  10    Polymorph Self               Telekinesis                     Stone to Flesh*
  11    Remove Curse*                Teleport                        Stoneform
  12    Wall of Fire                 Wall of Stone                   Wall of Iron
  13    Wizard Eye                   Woodform                        Weather Control

        Seventh Level                Eighth Level                   Ninth Level
   1    Charm Plant                  Clone                          Contingency
   2    Create Normal Monsters       Create Magical Monsters         Create Any Monster
   3    Delayed Blast Fireball       Dance                           Gate*
   4    Ironform                     Explosive Cloud                Heal
   5    Lore                         Force Field                    Immunity
   6    Magic Door*                  Mass Charm*                    Maze
   7    Mass Invisibility*           Mind Barrier*                  Meteor Swarm
   8    Power Word Stun              Permanence                     Power Word Kill
   9    Reverse Gravity               Polymorph Any Object          Prismatic Wall
  10    Statue                       Power Word Blind                Shapechange
  11    Summon Object                Steelform                      Survival
  12    Sword                        Symbol                         Timestop
  13    Teleport any Object          Travel                          Wish

 * Reversible Spell

[RC page 34: clerical spellcasting guidance]

Number and Types of Spells
   The cleric may know at any one time the num-
ber of spells appropriate for his experience level,
as shown on the cleric's experience table in
Chapter 2.
   The cleric may know any clerical spell from the

list of clerical spells so long as he is of a high
enough experience level to know it and cast it,
and so long as the DM has not banned the use of
that particular spell in his campaign. The cleric
cannot learn a spell from either the druidic spells
list or the magical spells list.

Reversible Spells

  A cleric may reverse a spell simply by casting it
backward. The player simply says, "My cleric is
casting the spell in reverse."
  However, Lawful clerics prefer not to cast
spells in reversed form. They only cast the re-
versed forms in extreme life-or-death situations.

Chaotic clerics often use the reversed spells, and
only use the normal forms to benefit their
friends. Neutral clerics can choose to cast the
normal or the reversed forms.

List of Clerical Spells
  Following is a list of clerical spells and their
descriptions. They're divided up into spell levels
and set in alphabetical order. All spells marked
with an asterisk (*) can be cast in reversed form.

First Level Clerical Spells
Cure Light Wounds*
Range: Touch
Duration: Permanent
Effect: Any one living creature

   This spell either heals damage or removes pa-
ralysis. If used to heal, it can cure 2-7 (1d6 + 1)
points of damage. It cannot heal damage if used

[RC page 34: first clerical spell entries]
  to cure paralysis. The cleric may cast it on him-
  self if desired.
     This spell cannot increase a creature's total hit
  points above the original amount.
     When reversed, this spell, cause light wounds,
  causes 1d6 + 1 (2-7) points of damage to any
  creature or character touched (no saving throw is
  allowed). The cleric must make a normal attack
  roll to inflict this damage.

  Detect Evil
  Range: 120'
  Duration: 6 turns
  Effect: Everything within 120'

     When this spell is cast, the cleric will see evilly
  enchanted objects within 120' glow. It will also
  cause creatures that want to harm the cleric to
  glow when they are within range. The actual
  thoughts of the creatures cannot be heard. Re-
  member that a Chaotic alignment does not auto-
  matically mean Evil, although many Chaotic
  monsters have evil intentions. Traps and poison
  are neither good nor evil, merely dangerous; this
  spell does not reveal them.

  Detect Magic
  Range: 0
  Duration: 2 turns
  Effect: Everything within 60'

     When this spell is cast, the cleric will see a
  glow surround magical objects, creatures, and
  places within the spell's effect. The glow will not
  last very long; clerics should normally use the
  spell only when they want to know if particular
  objects already within sight are, in fact, magical.
  For example, a door may be held shut magically,
  a stranger might actually be an enchanted mon-
  ster, or a treasure might be enchanted.

  Light*
  Range: 120'
  Duration: 12 turns
  Effect: Volume of 30' diameter

     This spell creates a large ball of light, as if cast
  by a bright torch or lamp. If the spell is cast on
  an object (such as the cleric's weapon), the light
  will move with the object.
     If the spell is cast at a creature's eyes, the vic-
  tim must make a saving throw vs. spell. If he fails
  the saving throw, the victim will be blinded by
  the light for the duration of the spell, or until
  the spell effect is canceled.
     When reversed, this spell, darkness, creates a

  circle of darkness 30' in diameter. It will block all
  sight except infravision. Darkness will cancel a
  light spell if cast upon it, but may itself be can-
  celed by another light spell. If cast at an oppo-
  nent's eyes, darkness causes blindness for the
  duration of the spell or until canceled. If the tar-
  get makes a successful saving throw vs. spell, the
  spell misses.

  Protection from Evil
  Range: 0
  Duration: 12 turns
  Effect: The cleric only

     This spell creates an invisible magical barrier
  all around the cleric's body (less than an inch

away). While the spell lasts, characters and mon-
sters attacking the cleric are penalized by - 1 to
their attack rolls, and the cleric gains a + 1 bonus
to all saving throws.
In addition, enchanted creatures cannot even
touch the cleric! (An enchanted creature is one
that normal weapons will not affect, one which
only magical weapons can hit. A creature that
can only be hit by a silver weapon—a werewolf,
for example—is not an enchanted creature. Any
creature that is magically summoned or con-
trolled, such as a charmed character, is also con-
sidered to be an enchanted creature.) The barrier
thus completely protects the cleric from all melee
or hand-to-hand attacks from such creatures;
however, it cannot prevent attacks from missile
weapons. Enchanted creatures using missile
weapons still suffer the - 1 penalty to the attack
roll, but they can hit the cleric.
This spell will not affect a magic missile spell
used by magic-users.
If the cleric attacks an enchanted creature dur-
ing the spell's duration, the spell's effect changes
slightly. Enchanted creatures are then able to
touch the magic-user, but still suffer the attack
roll penalty; the penalty and the cleric's saving
throw adjustments still apply until the spell du-
ration ends.
Purify Food and Water
Range: 10'
Duration: Permanent
Effect: See below
This spell will make spoiled or poisoned food
and water safe and usable. It will purify one ra-
tion of preserved food (either iron or standard
rations)., or six waterskins of water, or enough
normal food to feed a dozen people. If cast at
mud, the spell will cause the dirt to settle, leav-
ing a pool of pure, clear water. The spell will not
affect any living creature.
Remove Fear*
Range: Touch
Duration: 2 turns
Effect: Any one living creature
When the cleric casts this spell and then
touches any living creature, the spell will calm
the creature and remove any fear. If the creature
has been affected by a fear spell or effect which
does not normally allow a saving throw, the re-
move fear spell can still be useful. If the cleric
casts the spell on someone afflicted by a magical
fear effect, the victim gets to make a saving
throw vs. spells, adding a bonus to the roll equal
to the cleric's level of experience (up to a maxi-
mum bonus of +6). If the saving throw is suc-
cessful, the victim's fear is negated. Regardless of
the cleric's level or any bonuses, a roll of 1 will
always fail.
The reversed form of the spell, cause fear, will
make any one creature flee for two turns. The
victim may make a saving throw vs. spells to
avoid the effect. This reversed spell has a range
of 120'.
Resist Cold
Range: 0
Duration: 6 turns
Effect: All creatures within 30'
When this spell is cast, all creatures within 30'
of the cleric can withstand freezing temperatures
without harm. In addition, those affected gain a
bonus of + 2 to all saving throws against cold at-
tacks. Furthermore, any damage from cold is re-
duced by 1 point per die of damage (but with a
minimum of 1 point of damage per die). The ef-
fect will move with the cleric.
Second Level Clerical Spells
Bless*
Range: 60'
Duration: 6 turns
Effect: All within a 20' square area
This spell improves the morale of friendly
creatures by +1 and gives the recipients a +1
bonus on all attack and damage rolls. It will only
affect creatures in a 20' X 20' area, and only
those who are not yet in melee.
When reversed, this spell, blight, places a - 1
penalty on enemies' morale, attack rolls, and
damage rolls. Each victim may make a saving
throw vs. spells to avoid the penalties.
Find Traps
Range: 0 (Cleric only)
Duration: 2 turns
Effect: Traps within 30' glow
This spell causes all mechanical and magical
traps to glow with a dull blue light when the
cleric comes within 30' of them. It does not re-
veal the types of traps, nor any method of re-
moving them. Note that an ambush is not a
trap, nor is a natural hazard, such as quicksand.
Hold Person*
Range: 180'
Duration: 9 turns
Effect: Paralyzes up to 4 creatures
The hold person spell will affect any human,
demihuman, or human-like creature (bugbear,
dryad, gnoll, hobgoblin, kobold, lizard man,
ogre, orc, nixie, pixie or sprite, for instance). It
will not affect the undead or creatures larger than
ogres. Each victim must make a saving throw vs.
spells or be paralyzed for nine turns. The spell
may be cast at a single person or at a group. If cast
at a single person, the victim suffers a — 2 penalty
to the saving throw. If cast at a group, it will affect
up to four persons (of the cleric's choice), but with
no penalty to their rolls. The paralysis may only be
removed by the reversed form of the spell, or by a
dispel magic spell.
The reverse of the spell, free person, removes
the paralysis of up to four victims of the normal
form of the spell (including hold person cast by a
magic-user or an elf). It has no other effect; it
does not, for instance, remove the effects of a
ghoul's paralysis ability.
Know Alignment*
Range: 0 (Cleric only)
Duration: 1 round
Effect: One creature within 10'
The caster of this spell may discover the align-
ment (Lawful, Neutral, or Chaotic) of any one
creature within 10'. The spell may also be used
to find the alignment of an enchanted item or
area (if any).
The reverse of the spell, confuse alignment,
lasts for one turn per level of the caster, and may
be cast on any one creature, by touch. No saving
throw is allowed. For as long as the spell lasts, a
cleric trying to identify the alignment of the re-
cipient by using the normal know alignment
spell will get a false answer. That same false an-
swer will be the result of any further attempts.
Resist Fire
Range: 30'
Duration: 2 turns
Effect: One living creature
For the duration of this spell, normal fire and
heat cannot harm the spell's recipient. The re-
cipient also gains a + 2 bonus on all saving
throws against magical fire (dragon's breath,
fireball, etc.). Furthermore, damage from such
fire is reduced by 1 point per die of damage
(though each die will inflict at least 1 point of
damage, regardless of adjustments). Red dragon
breath damage is reduced by 1 point per Hit Die
of the creature (again, to no less than 1 point of
damage per Hit Die).
Silence 15' Radius
Range: 180'
Duration: 12 turns
Effect: Sphere of silence 30' across
This spell makes the area of effect totally si-
lent. Conversation and spellcasting in this area
are impossible for the duration of the spell. This
spell does not prevent a person within the area
from hearing noises outside the area. If cast on a
creature, the victim must make a saving throw
vs. spells or the spell effects will move with the
creature. If the saving throw is successful, the
spell remains in the area in which it was cast, and
the victim may move out of the area.
Snake Charm
Range: 60'
Duration: 2-5 rounds or 2-5 turns
Effect: Charms 1 HD of snakes per level of the
caster
With this spell, a cleric may charm 1 Hit Die
of snakes for each level of experience he has, and
no saving throw is allowed. A 5th level cleric
could charm one 5 HD snake, five 1 HD snakes,
or any combination totalling 5 Hit Dice or less.
The snakes affected will rise up and sway, but
will not attack unless attacked themselves.
If the cleric uses the spell on snakes attacking
him, the spell's duration is 1d4 + 1 (2-5) rounds;
otherwise, it lasts 1d4 +1 (2-5) turns. When the
spell wears off, the snakes return to normal (but
with normal reactions; they will not be automat-
ically hostile).
Speak with Animals
Range: 0 (Cleric only)
Duration: 6 turns
Effect: Allows conversation within 30'
When casting this spell, the cleric must name
one type of animal (such as wolves). For the du-
ration of the spell, the cleric may speak with all
animals of that type if they are within 30'; the
effect moves with the caster.
The cleric can speak to any normal or giant
forms of the specific animal type named, but on-
ly to one type at a time. The caster may not use
this spell to speak to intelligent animals and
fantastic creatures.
The creatures spoken to usually have favorable
reactions ( + 2 bonus to the reaction roll), and
they can be talked into doing a favor for the cler-
ic if the reaction roll is high enough. The animal
must be able to understand the request and
must be able to perform it.
Third Level Clerical Spells
Continual Light*
Range: 120'
Duration: Permanent
Effect: Sphere of light 60' across
This spell creates light as bright as daylight in
a spherical volume of 30' radius. It lasts until a
dispel magic or continual darkness spell is cast
upon it. Creatures penalized in bright daylight
suffer the same penalties within this spell effect
(for example, goblins, which suffer a - 1 attack
roll penalty in daylight, suffer the same penalty
within the effect of continual light).
If the spell is cast on an opponent's eyes, the
victim must make a saving throw vs. spells or be
blinded until the effect is removed. This spell
may be cast in an area, upon an object, or on a
person or creature; it can also be cast directly on a
person's or creature's eyes, thus blinding him.
The reverse of this spell, continual darkness,
creates a completely dark volume of the same
size. Torches, lanterns, and even a light spell will
not affect it, and infravision cannot penetrate it.
A continual light spell will, however, cancel it. If
cast on a creature's eyes, the creature must make
a saving throw vs. spells or be blinded (with the
same effects as blindness from the normal con-
tinual light until the spell is removed.
Cure Blindness
Range: Touch
Duration: Permanent
Effect: One living creature
This spell will cure nearly any form of blind-
ness, including those caused by light or darkness
spells (whether normal or continual). It will not,
however, affect blindness caused by a curse.
Cure Disease*
Range: 30'
Duration: Permanent
Effect: One living creature within range
This spell will cure any living creature of one
disease, such as those caused by a mummy or
green slime. If cast by a cleric of llth level or
greater, this spell will also cure lycanthropy.
The reverse of this spell, cause disease, infects
the victim with a hideous wasting disease unless
he successfully makes a saving throw vs. spells. A
diseased victim has a -2 penalty on all attack
rolls. In addition, the victim's wounds cannot be
magically cured, and natural healing takes twice
as long as usual. The disease is fatal in 2dl2 (2-
24) days unless removed by a cure disease spell.
Growth of Animal
Range: 120'
Duration: 12 turns
Effect: Doubles the size of one animal
This spell doubles the size of one normal or
giant animal. The animal then has twice its nor-
mal strength and inflicts double its normal dam-
age. It may also carry twice its normal
encumbrance. This spell does not change an ani-
mal's behavior, armor class, or hit points, and
does not affect intelligent animal races or
fantastic creatures.
Locate Object
Range: 0 (Cleric only)
Duration: 6 turns
Effect: Detects one object within 120'
This spell allows the cleric to sense the direc-
tion of one known object. It gives no informa-
tion about distance. It can detect a common
object with only a partial description (such as
"stairs leading up") but it will only reveal the
direction to the closest such object. To find a spe-
cific object, the cleric must know exactly what
the object looks like (size, shape, color, etc.).
The spell will not locate a creature.
Remove Curse*
Range: Touch
Duration: Permanent
Effect: Removes any one curse
This spell removes one curse, whether on a
character, item, or area. Some curses—especially
those on magical items—may only be removed
for a short time, at the DM's discretion; such
curses would require a dispel evil spell for per-
manent removal (or possibly a remove curse cast
by a high level cleric or magic-user, again at
DM's discretion).
The reverse of this spell, curse, causes a mis-
fortune or penalty to affect the victim. Curses are
limited only by the caster's imagination, but if
an attempted curse is too powerful, it may return
to the caster (DM's discretion)! Safe limits to
curses may include: -4 penalty on attack rolls;
— 2 penalty on saving throws; prime requisite re-
duced to half normal; — 4 penalty on others' re-
action rolls to him. The victim may make a
saving throw vs. spells to avoid the curse.
Speak with the Dead
Range: 10'
Duration: 1 round per level of the cleric
Effect: Cleric may ask three questions
By means of this spell, a cleric may ask three
questions of a deceased spirit if the body is with-
in range.
A cleric of 6th or 7th level can contact recently
deceased spirits (those dead up to 4 days). Clerics
of levels 8-14 have slightly more power (contact-
ing spirits up to 4 months dead), and clerics of
levels 15-20 have even more (speaking with
corpses up to 4 years dead). No time limits apply
to clerics of 21st level or greater.
The spirit will always reply in a tongue known
to the cleric, but can only offer knowledge of
things up to the time of its death. If the spirit's
alignment is the same as the cleric's, it will pro-
vide clear and brief answers; however, if the
alignments differ, the spirit may reply in riddles.
Striking
Range: 30'
Duration: 1 turn
Effect: 1d6 bonus to damage on 1 weapon
This spell allows any one weapon to inflict 1d6
additional points of damage per attack (like a
magical staff of striking). The weapon will inflict
this extra damage with every successful blow for
as long as the spell lasts. This bonus does not ap-
ply to attack rolls, but only to damage rolls.
If the cleric casts this spell on a normal weap-
on, the weapon may then damage creatures
which are normally affected only by magic weap-
ons; the weapon will do 1d6 points of damage
per strike (regardless of the normal damage of
the weapon).
Fourth Level Clerical Spells
Animate Dead
Range: 60'
Duration: Permanent
Effect: Creates zombies or skeletons
This spell allows the caster to make animated,
enchanted skeletons or zombies from normal
skeletons or dead bodies within range. These an-
imated undead creatures will obey the cleric un-
til they are destroyed by another cleric or a dispel
magic spell.
For each experience level of the cleric, he may
animate one Hit Die of undead. A skeleton has
the same Hit Dice as the original creature, but a
zombie has one Hit Die more than the original.
Note that this doesn't count character experi-
ence levels as Hit Dice: For purposes of this spell,
all humans and demihumans are 1 HD crea-
tures, so the remains of a 9th level thief would
be animated as a zombie with 2 HD.
Animated creatures do not have any spells,
but are immune to sleep and charm effects and
poison. Lawful clerics must take care to use this
spell only for good purpose. Animating the dead
is usually a Chaotic act.
Create Water
Range: 10'
Duration: 6 turns
Effect: Creates one magical spring
With this spell, the cleric summons forth an
enchanted spring from the ground or a wall. The
spring will flow for an hour, creating enough wa-
ter for 12 men and their mounts (for that day,
about 50 gallons). For each of the cleric's experi-
ence levels above 8, water for twelve additional
men and mounts is created; thus a 10th level
cleric could create water for 36 men and horses.
The cleric doesn't have to create the maxi-
mum amount of water if he doesn't wish to. He
might wish to create a spring which will flow for
half an hour, or a few minutes; the player need
only tell the GM how many gallons he wants the
spell to create, up to the spell's maximum.
Cure Serious Wounds*
Range: Touch
Duration: Permanent
Effect: Any one living creature
This spell is similar to a cure light wounds
spell, but will cure one creature of 2d6 + 2 (4-14)
points of damage.
The reverse of this spell, cause serious
wounds, causes 2d6 + 2 points of damage to any
creature or character touched (no saving throw).
The caster must make a normal attack roll to suc-
cessfully cast the cause serious wounds spell.
Dispel Magic
Range: 120'
Duration: Permanent
Effect: Destroys spells in a 20' cube
This spell destroys other spell effects in a cubic
volume of 20' x 20' x 20'. It does not affect mag-
ical items. Spell effects created by a caster
(whether cleric, druid, magic-user, or elf) of a
level equal to or lower than the caster of the dis-
pel magic are automatically and immediately de-
stroyed. Spell effects created by a higher-level
caster might not be affected. The chance of fail-
ure is 5% per level of difference between the
casters. For example, a 7th level cleric trying to
dispel a web spell cast by a 9th level magic-user
would have a 10% chance of failure.
Dispel magic will not affect a magical item
(such as a scroll, a magical sword, etc.). How-
ever, it can dispel the effects of the magical item
when that item is used (for example, a spellcaster
can cast dispel magic on the victim of a ring of
human control and snap him out of that control,
or on a flaming weapon to douse the flame).
Neutralize Poison*
Range: Touch
Duration: Permanent
Effect: A creature, container, or object
This spell will make poison harmless either in
a creature, a container (such as a bottle), or on
one object (such as a chest). It will even revive a
victim slain by poison if cast within 10 rounds of
the poisoning!
The spell will affect any and all poisons
present at the time it is cast, but does not cure
any damage (and will thus not revive a poisoned
victim who has died of wounds).
The reverse of this spell, create poison, may be
cast, by touch, on a creature or container. A cler-
ic cannot cast it on any other object. A victim
must make a saving throw vs. poison or be im-
mediately slain by the poison. If cast on a con-
tainer, the spell poisons its contents; no saving
throw applies, even for magical containers or
contents (such as potions). (Of course, when
someone drinks those poisoned contents, he gets
a saving throw.) Using create poison, or poison-
ing in any case, is usually a Chaotic act.
Protection from Evil 10' Radius
Range: 0
Duration: 12 turns
Effect: Barrier 20' diameter
This spell creates an invisible magical barrier
all around the caster, extending for a 10' radius
in all directions. The spell serves as protection
from attacks by monsters of an alignment other
than the caster's. Each creature within the barri-
er gains a +1 to all saving throws, and all attacks
against those within are penalized by - 1 to the
attacker's attack roll while the spell lasts.
In addition, enchanted creatures cannot at-
tack those within the barrier in hand-to-hand
(melee) combat. (An enchanted creature is any
creature which is magically summoned or con-
trolled, such as a charmed character, or one that
is not harmed by normal weapons. A creature
that can be hit only by a silver weapon—a were-
wolf, for example—is not an enchanted crea-
ture.)
If anyone within the barrier attacks an en-
chanted creature, the barrier will no longer pre-
vent the creature from attacking hand-to-hand,
but the bonus to saving throws and penalty to
attack rolls will still apply.
Attackers, including enchanted creatures, can
attack people inside the barrier by using missile
or magical attacks. They do suffer the — 1 penal-
ty to attack rolls, but that is the only penalty
they suffer.
Speak with Plants
Range: 0 (Cleric only)
Duration: 3 turns
Effect: All plants within 30'
This spell enables the cleric to talk to plants as
though they are intelligent. The cleric may re-
quest a simple favor, and the plants will grant it
if it is within the plants' power to understand
and perform. This spell may be used to allow the
cleric and party to pass through otherwise im-
penetrable undergrowth. It will also allow the
cleric to communicate with plantlike monsters
(such as treants).
Sticks to Snakes
Range: 120'
Duration: 6 turns
Effect: Up to 16 sticks
This spell turns 2d8 sticks into snakes (de-
tailed below). The snakes may be poisonous
(50% chance per snake; the DM can roll 1d6 for
each snake; on a roll of 1-3, the snake is poison-
ous). They obey the cleric's commands, but will
turn back into sticks when slain or when the
spell's duration ends.
Snakes: NA 2d8 (2d8); AC 6, HD 1; AT 1
bite; Dmg 1d4; MV 90' (30'); Save Fl; ML 12;
TT Nil; AL Neutral; SA poison (50% chance
for each snake to be poisonous); XP 10 (non-
poisonous) or 13 (poisonous).
Fifth Level Clerical Spells
Commune
Range: 0 (Cleric only)
Duration: 3 turns
Effect: 3 questions
This spell allows the cleric to ask questions of
the greater powers (whatever forces of nature,
greater spirits, or legendary Immortals the DM
has created for this campaign world). The cleric
may ask three questions that can be answered
"yes" or "no."
A cleric may commune only once a week. If
the clerics in the campaign are using the spell too
often, the DM may wish to limit its use to once a
month. Once a year the cleric may ask twice the
normal number of questions. The DM might
wish to establish that this must occur on a day
which is significant to the greater powers being
questioned.
Create Food
Range: 10'
Duration: Permanent
Effect: Creates food for 12 or more
This spell creates enough normal food to feed
up to 12 men and their mounts for one day. For
every level of the cleric above 8th, the spell cre-
ates enough food for 12 additional men and
mounts. The cleric doesn't have to create the
maximum amount of food if he doesn't wish to;
he can create a lesser amount. Created food
spoils after 24 hours; therefore it is impossible to
lay in a big store of food created by this spell.
Cure Critical Wounds*
Range: Touch
Duration: Permanent
Effect: Any one living creature
This spell is similar to a cure light wounds
spell, but will cure one living creature of 3d6 + 3
(6-21) points of damage.
The reverse of this spell (cause critical wounds)
causes 3d6 + 3 (6-21) points of damage to any
living creature or character touched (no saving
throw). The caster must make a normal attack
roll to cause the critical wound.
Dispel Evil
Range: 30'
Duration: 1 turn
Effect: Enchanted or undead monsters or one
curse or charm
This spell may affect all undead and enchant-
ed (summoned, controlled, and animated) mon-
sters within range. It will destroy the monster
unless each victim makes a saving throw vs.
spells. If cast at only one creature, that creature
takes a —2 penalty to the saving throw. Any
creature from another plane is banished (forced
to return to its home plane) if it fails the saving
throw. Even if the victims successfully roll their
saving throws, they must flee the area, and will
stay away as long as the caster concentrates; the
caster cannot move while concentrating.
This spell will also remove the curse from any
one cursed item, or may be used to remove the
influence of any magical charm.
Insect Plague
Range: 480'
Duration: 1 day
Effect: Creates a swarm of 30' radius
This spell summons a vast swarm of insects.
The swarm obscures vision and drives off crea-
tures of less than 3 Hit Dice (no saving throw).
The swarm moves at up to 20' per round as di-
rected by the cleric while it is within range. The
caster must concentrate, without moving, to
control the swarm. If the caster is disturbed, the.
insects scatter and the spell ends. This spell only
works outdoors and above-ground.
Quest*
Range: 30'
Duration: Special
Effect: Compels one living creature
This spell forces the victim to perform some
special task or quest, as commanded by the cast-
er. The victim may make a saving throw vs.
spells; if he succeeds, the spell does not affect
him.
A typical task might involve slaying a certain
monster, rescuing a prisoner, obtaining a magi-
cal item for the caster, or going on a pilgrimage.
If the task is impossible or suicidal, the spell has
no effect. Once the task is completed, the spell
ends.
The spell forces the victim to undertake a task,
but doesn't force him to like it. Once the task is
accomplished, the victim might wish to exact re-
venge on the cleric, just depending on the cir-
cumstances of the adventure. Any victim
refusing to go on the quest is cursed until the
quest is continued. The type of curse is decided
by the DM, but may be double normal strength.
The reverse of this spell, remove quest, may
be used to dispel an unwanted quest or a quest-
related curse. The chance of success is 50%,
modified by 5 % for every level of the caster dif-
fers from the level of the caster of the first quest.
Thus, an 11th level cleric attempting to remove a
quest cast by a 13th level cleric has only a 40%
chance of success; a 36th level cleric attempting
to remove a quest cast by a 20th level cleric has a
130% chance (reduced to 99% to provide for a
1% chance of failure).
Raise Dead*
Range: 120'
Duration: Permanent
Effect: Body of one human or demihuman
By means of this spell, the cleric can raise any
human, dwarf, halfling, or elf from the dead.
The body must be present, and if part is missing,
the raised character will be disabled accordingly.
An 8th level cleric can raise a body that has
been dead for up to four days. For each level of
the cleric above 8th, add four days to this time.
Thus, a 10th level cleric can raise bodies that
have been dead for up to twelve days.
The recipient returns to life with 1 hit point,
and cannot fight, cast spells, use abilities, carry
heavy loads, or move at more than half speed.
These penalties will disappear after two full
weeks of complete bed rest, but the healing can-
not be speeded by magic.
The cleric may also cast this spell at any one
undead creature within range. The undead crea-
ture will be destroyed unless it makes a saving
throw vs. spells with a - 2 penalty. However, a
vampire which fails its saving throw is not de-
stroyed, merely forced to retreat to its coffin, in
gaseous form, as fast as possible. When cast at an
undead creature of more Hit Dice than a vam-
pire, this spell inflicts 3dl0 (3-30) points of
damage. The creature can make a saving throw
vs. spells to take half damage.
The reverse of this spell, finger of death, cre-
ates a death ray that will kill any one living crea-
ture within 60'. The victim may make a saving
throw vs. death ray to avoid the effect. A Lawful
cleric will only use finger of death in a life-or-
death situation. Finger of death will actually
cure 3d10 (3-30) points of damage for any un-
dead with 10 or more Hit Dice (phantom,
haunt, spirit, nightshade, or special).
Truesight
Range: 0 (cleric only)
Duration: 1 turn + 1 round per level of caster.
Effect: Reveals all things
When he casts this spell, the cleric is able to
see all things within 120'. The spell is quite pow-
erful; the cleric can clearly see all hidden, invisi-
ble, and ethereal objects and creatures as with
the magic-user detect invisible spell. In addi-
tion, any secret doors as well as things or crea-
tures not in their true form—whether
polymorphed, disguised, or otherwise—are seen
as they truly are, with no possibility of decep-
tion. Alignment is also "seen," as is experience
and power.
Sixth Level Clerical Spells
Aerial Servant
Range: 60'
Duration: 1 day per level of caster
Effect: Servant fetches one item or creature
An aerial servant is a very intelligent being
from the elemental plane. With this spell, the
cleric summons one of these beings, which ap-
pears immediately. The cleric must then describe
one creature or item and its location to the ser-
vant, or else it will depart. When it hears this
description and location, the aerial servant
leaves, trying to find the item or creature and
bring it to the cleric. The servant will take as
much time as needed, up to the limit of the du-
ration. If the spell's duration lapses before the
task is completed, even if the aerial servant is al-
ready bringing the target back to the caster, the
aerial servant has failed to accomplish its task.
See below for further details.
The aerial servant has 18 Strength, and can
carry up to 500 lbs (5,000 cn). It can become
ethereal at will, and thus can travel to most plac-
es easily. However, it cannot pass through a pro-
tection from evil spell effect.
If it cannot perform its duty within the dura-
tion of the spell, the servant becomes insane and
returns to attack the caster.
See Chapter 14 for a full description of the
aerial servant.
Animate Objects
Range: 60'
Duration: 6 turns
Effect: Causes objects to move
The cleric may use this spell to cause any non-
living, nonmagical objects to move and attack.
Magical objects are not affected. The spell can
animate any one object up to 400 lbs (4,000 cn)
(roughly the size of two men), or a number of
smaller objects whose total weight does not ex-
ceed 400 lbs.
The DM must decide on the movement rate,
number of attacks, damage, and other combat
details of the objects animated. As a guideline, a
man-sized statue might move at 30' per round,
attack once per round for 2d8 (2-16) points of
damage, and have an armor class of 1. A chair
might only be AC 6, but move at 180' per round
on its four legs, attacking twice per round for
1d4 points per attack. All objects have the same
chances to hit as the cleric animating them.
Barrier*
Range: 60'
Duration: 12 turns
Effect: Creates whirling hammers
This spell creates a magical barrier in an area
up to 30' in diameter and 30' high. The barrier is
a wall of whirling and dancing hammers, obvi-
ously dangerous to any who come in contact with
it. Any creature passing through the barrier
takes 7dl0 (7-70) points of damage from the
whirling hammers (no saving throw allowed).
This spell is often used to block an entrance or
passage.
The reverse of this spell (remove barrier) will
destroy any one barrier created by a cleric. It can
also be used to destroy a magic-user's wall of ice,
wall of fire, clothform, woodform, or wall of
stone spell effects. It will not affect the magic-
user spells wall of iron, stoneform, ironform or
steelform.
Create Normal Animals
Range: 30'
Duration: 10 turns
Effect: Creates 1-6 loyal animals
The cleric is able to create normal animals
from thin air with this spell. The animals will ap-
pear at a point chosen (within 30'), but may
thereafter be sent (by command) up to 240'
away, if desired. The animals created will under-
stand and obey the cleric at all times. They will
fight if so commanded, and will perform other
actions (carrying, watching, etc.) to the best of
their abilities. They are normal animals, and
may attack others unless their instructions are
carefully worded.
The cleric may choose the number of animals
created, but not the exact type; the DM should
decide, or even randomly determine, what sort
of animals appear. The spell will create one large
animal (elephant, hippopotamus, etc.), three
medium-sized animals (bear, great cat, etc.), or
six small animals (wolf, rock baboon, etc.). The
spell cannot create giant animals. The animals
disappear when slain or when the spell duration
ends.
Cureall
Range: Touch
Duration: Permanent
Effect: Cures anything
This spell is the most powerful of the healing
spells. When used to cure wounds, it cures near-
ly all damage, leaving the recipient with only
1d6 points of damage. (Restore the victim to full
starting hit points, then roll 1d6 and subtract
that amount from the victim's hit point total.)
The spell can remove a curse, neutralize a poi-
son, cure paralysis, cure a disease, cure blind-
ness, or even remove a feeblemind effect instead
of healing. However, it will cure one thing only;
if the recipient is suffering from two or more af-
flictions (such as wounds and a curse), the cleric
must name the ailment the spell is intended to
cure.
If cast on the recipient of a raise dead spell,
the cureall eliminates the need for two weeks of
bed rest; the recipient can immediately function
normally. This is the only form of magical curing
that will work on a newly-raised creature.
Find the Path
Range: 0 (Cleric only)
Duration: 6 turns + 1 turn per level of the caster
Effect: Shows the path to an area
When casting this spell, the cleric must name
a specific place, though it need not be a place he
has visited before. For the duration of the spell,
the cleric knows the direction to that place. In
addition, the cleric will magically gain any spe-
cial knowledge needed to get to the place; for
example, he would know the location of secret
doors, passwords, and so forth.
When the spell's duration runs out, the caster
only remembers the general direction to the
place. All other special information is forgotten.
The spell is instantly negated is the caster at-
tempts to write down, record, or disclose that
special knowledge to others. This spell is often
used to find a fast escape route.
Speak with Monsters*
Range: 0 (Cleric only)
Duration: 1 round per level of the cleric
Effect: Permits conversation with any monster
This spell gives the caster the power to ask
questions of any and all living and undead crea-
tures within 30'. Even unintelligent monsters
will understand and respond to the cleric. Those
spoken to will not attack the cleric while engaged
in conversation, but may defend themselves or
flee if attacked. The cleric may ask only one
question per round, and the spell lasts one
round per level of the caster.
The reverse of this spell, babble, has a 60'
range, a duration of 1 turn per level of the caster,
and affects one target within spell range. The
victim may make a saving throw vs. spells to
avoid the effect, but with a — 2 penalty to the
roll. If he fails the saving throw, the victim can-
not communicate with any other creature for the
duration of the spell. Even hand motions, writ-
ten notes, telepathy, and all other forms of com-
munication will seem garbled. This does not
interfere with the victim's spellcasting (if any),
but does prevent him from using any magical
items which are activated by command words—
the command words turn into gibberish.
Word of Recall
Range: 0 (Cleric only)
Duration: Instantaneous
Effect: Teleports the caster to sanctuary
Similar to a magic-user's teleport spell, this
spell carries the cleric and all equipment carried
(but no other creatures) to the cleric's home, re-
gardless of the distance. The cleric must have a
permanent home (such as a castle), and a medi-
tation room within that home; this room is the
destination when the spell is cast. During the
round in which this spell is cast, the cleric auto-
matically gains initiative unless surprised.
Seventh Level Clerical Spells
Earthquake
Range: 120 yards
Duration: 1 turn
Effect: Causes earth tremors
This powerful spell causes a section of earth to
shake, and opens large cracks in the ground. A
17th level caster can affect an area up to 60'
square, adding 5' to each dimension with each
experience level above 17th. For example, an
18th level cleric affects an area up to 65' square;
19th level, 70' square; and so forth.
Within the area of effect, all small dwellings
are reduced to rubble, and larger constructions
are cracked open. Earthen formations (hills,
cliffsides, etc.) form rockslides. Cracks in the
earth may open and engulf 1 creature in 6 (de-
termined randomly), crushing them (when the
die roll randomly determines that a character is
in danger of falling into a crack and being
crushed, the character gets a saving throw vs.
death to escape falling in).
Holy Word
Range: 0
Duration: Instantaneous
Effect: All creatures within 40'
This spell affects all creatures, friend or foe,
within a circular area of 40' radius, centered on
the caster. When the cleric casts this spell, all
creatures of alignments other than the cleric's are
affected as follows (no saving throw vs. spells al-
lowed):
Holy Word Effects
Up to 5th Level:
Killed
Level 6-8:
Stunned 2dl0 turns
Level 9-12:
Deafened 1d6 turns
Level 13 + :
Stunned 1d10 rounds
Any victim of 13th level (or Hit Dice) or high-
er, or any victim of the same alignment as the
caster, may make a saving throw vs. spells to
avoid all spell effects. This powerful spell cannot
be blocked by stone, nor by any other solid ma-
terial except lead. It can, however, be blocked by
an anti-magic shell.
Raise Dead Fully*
Range: 60'
Duration: Permanent
Effect: Raises any living creature
This spell is similar to the 5th level spell raise
dead, except that it can raise any living
creature—not just humans and demihumans.
Any human or demihuman recipient awakens
immediately, with full hit points, and is able to
fight, use abilities, spells known, etc., without
any penalties—except those penalties the crea-
ture already possessed at the time of death. For
example, a victim cursed or diseased at death
would still suffer the affliction when raised fully.
If any other living creature (other than a hu-
man or demihuman) is the recipient, the guide-
lines given in the raise dead spell apply
(including time limitations, rest needed, etc.).
A 17th level cleric can use this spell on a hu-
man or demihuman body that has been dead up
to 4 months; for each level of experience above
17th, this time increases 4 months. Thus, a 19th
level cleric could cast raise dead fully on a body
that has been dead up to 12 months.
The spell is fatal to undead. Cast on an un-
dead creature of 7 Hit Dice or less, the spell im-
mediately destroys the creature (no saving
throw). The spell forces an undead creature of 7
to 12 Hit Dice to make a saving throw vs. spells,
with a - 4 penalty to the roll; if the creature fails
the roll, it is destroyed. The spell inflicts 6dl0
(6-60) points of damage upon an undead mon-
ster of more than 12 Hit Dice, but the victim
may make a saving throw vs. spells to take half
damage.
The reverse of this spell (obliterate) will affect
a living creature just as the normal form affects
undead (destroy 7 Hit Dice or less, et al.). If cast
at an undead creature of any type, obliterate has
the same effect as a cureall would on a living
creature (curing all but 1d6 points of damage, or
curing blindness or feeblemind, etc.).
Restore*
Range: Touch
Duration: Permanent
Effect: Restores 1 level lost to energy drain
This spell restores one full level of energy (ex-
perience) to any victim who has lost a level be-
cause of energy drain (for instance, from a
vampire's attack). It does not restore more than
one level, nor does it add a level if no level has
been lost. Furthermore, the cleric casting this
spell loses one level of experience, as if struck by
a wight when the spell is cast; however, the cler-
ic's loss is not permanent, and the cleric need on-
ly rest for 2dl0 (2-20) days to regain the lost
experience.
The reverse of this spell, life drain, drains one
level of experience from the victim touched, just
like the touch of a wight or wraith. Casting the
reversed spell causes no experience level loss to
the cleric, nor does it require any rest afterward,
but it is a Chaotic act, avoided by Lawful clerics.
Survival
Range: Touch
Duration: One hour per level of the caster
Effect: Protects one creature against all non-
magical damage from the environment
This spell protects the recipient from adverse
conditions of all types, including normal heat or
cold, lack of air, and so forth. While die spell is in
effect, the caster needs no air, food, water, or sleep.
The spell does not protect against magical damage
of any type, attack damage, poisons, breath weap-
ons, or physical blows from creatures. It does pro-
tect against all damage caused by natural
conditions on other planes of existence.
For example, a cleric might use this spell: in a
desert or blizzard to prevent damage from the
natural conditions; underground or underwater,
enabling survival without air; in space, to magi-
cally survive in vacuum; or on the elemental
plane of Fire, to protect against conditional fire
damage.
Travel
Range: 0
Duration: One turn per level of the caster
Effect: Allows aerial or gaseous travel
This spell allows the cleric to move quickly
and freely, even between the planes of existence.
The caster (only) may fly in the same manner as
given by the magic-user's spell, at a rate of 360'
(120'). The cleric can also enter a nearby plane of
existence, simply by concentrating for one
round. He may enter a maximum of one plane
per turn.
The cleric may bring one other creature for
every five levels of experience (rounded down;
for example, a 29th level cleric could bring five
other creatures on the journey). To bring others,
he must touch them, or they must touch him,
while the spell is cast and the shift is made. Any
unwilling creature can make a saving throw vs.
spells to avoid the effect. The cleric must take
the others with him—he cannot send them
while remaining behind.
While this spell is in effect, the caster (only)
may assume gaseous form by concentrating for
one full round. (If he is interrupted, no change
occurs.) Unlike the potion effect, all equipment
carried also becomes part of the same gaseous
cloud. In this form, the caster may travel at dou-
ble the normal flying rate: 720' (240'). While
gaseous, the cleric cannot use items or cast spells,
but also cannot be damaged except by magic
(weapons or certain spells). Also, a gaseous being
cannot pass through a protection from evil spell
effect or an anti-magic shell.
Wish
Range: Special
Duration: Special
Effect: Special
A wish is the single most powerful spell a cler-
ic can have. It is never found on a scroll, but may
be placed elsewhere (in a ring, for example) in
rare cases. Only clerics of 36th level and with an
18 (or greater) Wisdom score may cast the wish
spell.
Wording the Wish: The player must say or
write the exact wish his character makes. The
wording is very important. The wish will usually
follow the literal wording, and whatever the in-
tentions of the cleric.
The DM should try to maintain game balance,
being neither too generous nor too stingy in de-
ciding the effects of a wish. Even a badly phrased
wish, made with good intentions, may have good
results. However, if the wish is greedy, or made
with malicious intent, the DM should make every
effort to distort the results of the spell so that the
caster does not profit from it. If necessary, the DM
can even disallow the wish; it would then have no
effect. Whenever a wish fails or is misinterpreted,
the DM should explain (after the game) the prob-
lem or flaw in the phrasing.
Here are some examples of faulty wishes:
"I wish that I knew everything about this
dungeon" could result in the character knowing
all for only a second, and then forgetting it.
"I wish for a million gold pieces" can be grant-
ed by having them land on the character (that's
100,000 pounds of gold!), and then vanish.
"I wish to immediately and permanently pos-
sess the gaze power of a basilisk while retaining
all of my own abilities and items" is a carefully
worded wish that's out of balance. Characters
able to use these high-level spells are already
quite powerful. This wish could result in the
character growing a basilisk head in addition to
the character's own head.
A wish cannot be used to gain either experi-
ence points or levels of experience.
Possible Effects: A properly worded wish can
substitute for any other magical spell of 8th level
or less, or any clerical or druidic spell of 6th level
or less, at the DM's discretion. This common use
of a wish is more likely to succeed with little
chance for error than other uses of the spell.
Otherwise, if the wish is used to harm another
creature, the victim may make a saving throw vs.
spells. If the save is successful, the victim takes
half the ill effects and the other half rebounds on
the caster (who may also save to avoid it, but
with a -4 penalty to the roll). If the wish will
inconvenience someone without harming him
(for example, by causing him to teleport into a
prison cell), the victim gets no saving throw.
A character can use a wish to gain treasure, up
to a maximum of 50,000 gold pieces per wish.
However, the caster loses 1 experience point per
gold piece value of treasure gained, and this loss
cannot be magically restored.
The cleric can use a wish to temporarily
change any one ability score to a minimum of 3
or maximum of 18. This effect lasts for only six
turns.
Wishes can also be used to permanently in-
crease ability scores, but the cost is very high:
You must cast as many wishes as the number of
the ability score desired. All the wishes must be
cast within a one-week period.
You may raise an ability score only one point
at a time. To raise your Strength from 15 to 16
takes 16 wishes. To then raise it to 17 will take an
additional 17 wishes. Wishes cannot perma-
nently lower ability scores.
A wish cannot raise the maximum experience
level for human characters; 36th level is an abso-
lute limit. However, one wish can allow demi-
humans to gain one additional Hit Die (for a
new maximum of 9 for halflings, 11 for elves,
and 13 for dwarves). This affects only hit points,
and does not change any other scores (such as at-
tack rolls, elves' number of spells, etc.).
A wish can change a demihuman to a human,
or the reverse. Such a change is permanent, and
the recipient does not become magical. Half-
lings and dwarves become fighters of the same
level. Elves become magic-users or fighters (but
not both), at the choice of the caster of the wish.
The changed character would then gain levels of
experience normally. A human changes to the
same level demihuman, but no higher than the
normal racial maximum.
If one character casts a wish to change an-
other's character class, the victim (at his option)
may make a saving throw vs. spells with a + 5
bonus to resist the change.
A wish can sometimes change the results of a
past occurrence. This is normally limited to
events of the previous day. A lost battle may be
won, or the losses may be made far less severe,
but impossible odds cannot be overcome com-
pletely. A death could be changed to a near-
death survival; a permanent loss could be made
temporary. The DM may wish to advise players
when their wishes exceed the limit of the spell's
power (or his patience).
Important Note: Whenever an effect is de-
scribed as being unchangeable "even with a
wish," that statement supersedes all others here.
Wishes can cause great problems if not han-
dled properly. The DM must see that wishes are
reasonably limited or the balance and enjoyment
of the game will be completely upset. The DM
should not allow wishes that alter the basics of
the game (such as a wish that dragons can't
breathe for damage). The more unreasonable
and greedy the wish is, the less likely that the
wish will become reality.
Wizardry
Range: 0 (cleric only)
Duration: One turn
Effect: Allows the use of one magic-user device
or scroll spell
The cleric using this spell gains the power to
use one item normally restricted to magic-users:
either a device (such as a wand) or a scroll con-
taining a 1st or 2nd level magic-user spell. (The
cleric cannot cast spells of 3rd or higher level,
even though they may be present on the scroll.)
This ability lasts for one turn, or until the scroll
or device is used.
The cleric magically gains knowledge of the
proper use of the item, as if the character were a
magic-user. For the duration and effect of the
magic-user spell, the caster is treated as the mini-
mum level necessary to cast the spell.
Druidic Spells
Druids can learn and cast any spell that a cleric
can—with the exception of spells that affect
alignments (such as protection from evil).
However, druids also have their own spells,
spells which clerics and magic-users cannot uti-
lize. The druid cannot cast more spells in a day
than a cleric, but he has the advantage of being
able to learn spells from two different sources,
his own list and the cleric's spell list.
Druidic spells tend to concern nature and the
natural order of life rather than combat or power
like many of the clerical and magical spells. Dru-
idic spells are also not reversible.
First Level Druidic Spells
Detect Danger
Range: 5' per level of the caster
Duration: One hour
Effect: Reveals hazards
This spell combines some effects of detect evil
and find traps. While it is functioning, the druid
can concentrate on places, objects, or creatures
within range. He needs a full round of concen-
tration to examine one square foot of area, one
creature, or one small object (a chest, weapon, or
smaller item). Larger objects require more time.
After he examines the thing, the druid will
know whether it is immediately dangerous, po-
tentially dangerous, or benign (all strictly from
the druid's point of view). Note that most crea-
tures are potentially dangerous. This spell will
detect poisons, while other spells may not.
The duration is a full hour when used in natu-
ral outdoor settings on the Prime Plane; else-
where, the duration is half normal (three turns).
Faerie Fire
Range: 60'
Duration: 1 round per level of caster
Effect: Illuminates creatures or objects
With this spell, the druid can outline one or
more creatures or objects with a pale, flickering,
greenish fire. The fire does not inflict any dam-
age. The objects or creatures need only be de-
tected in some way (such as by sight, or a detect
invisible spell) to be the object of this spell.
All attacks against the outlined creature or ob-
ject gain a +2 bonus to attack rolls. The druid
can outline one man-sized creature (about 12' of
fire) for each 5 levels of experience. Thus, at
20th level, 48' of fire can be produced (outlining
one dragon-sized creature, two horse-sized, or
four man-sized creatures).
Locate
Range: 0 (druid only)
Duration: 6 turns
Effect: Detects 1 animal or plant within 120'
This spell allows the druid to sense the direc-
tion of one known normal animal or plant. The
druid can locate (similar to the locate object
spell) any normal or giant-sized animal, but not
fantastic creatures, plant monsters, nor any in-
telligent creature or plant.
He must name the exact type of animal or
plant, but does not need to see the specific one
he wishes to locate. The animal or plant gets no
saving throw. (This spell is most often used to
find special rare plants.)
Predict Weather
Range: 0 (druid only)
Duration: 12 hours
Effect: Gives knowledge of coming weather
This spell enables the druid to learn the accu-
rate weather to come for the next 12 hours. It
affects an area 1 mile in diameter per level of the
druid; for example, a 20th level druid would
learn the weather within a 20 mile diameter (a
10 mile radius). The spell does not give the
druid any control over the weather; it merely
predicts what is to come.
Second Level Druidic Spells
Heat Metal
Range: 30'
Duration: 7 rounds
Effect: Warms one metal object
This spell causes one object to slowly heat and
then cool. It will affect one metal item weighing
up to one-half pound (5 cn) per level of the cast-
er. A 12th level druid, for example, can heat up
to 6 pounds (60 cn—a normal sword, for in-
stance), while a 20th level druid can heat 10
pounds (100 cn—for example, a two-handed
sword).
The heat causes no damage to magical items.
Normal weapons or other items may be severely
damaged, especially if made of both wood and
metal (as a normal lance), as the wood will burn
away at the point of contact with metal.
If the object is being held when heated, the
heat causes damage to the holder: 1 point of
damage during the first round, 2 points in the
second, 4 points in the third, 8 points in the
fourth, and then decreasing at the same rate (for
a total of 22 points of heat damage over seven
rounds). In the fourth round, the searing heat
will cause leather, wood, paper, and other flam-
mable objects in contact with the metal to catch
fire.
The holder gets no saving throw, but fire re-
sistance negates all damage. The character can
drop the item at any time, of course, and crea-
tures of low intelligence are 80% likely to do so
(check each round).
Once the spell has been cast, the druid no
longer needs to concentrate; the heating and
cooling proceed automatically. A dispel magic
can stop the effect, but normal means (immer-
sion in water, etc.) will not.
If the spell is used on an item imbedded in an
opponent (such as an arrow or dagger), the op-
ponent may remove the item but loses initiative
for that round (and takes the appropriate heat
damage for that round as well).
Heat damage disrupts concentration; the vic-
tim cannot cast spells during any round in which
he sustains damage from this spell.
Obscure
Range: 0 (druid only)
Duration: 1 turn per level of the caster
Effect: Creates a huge misty cloud
This spell causes a misty vapor to arise from
the ground around the druid, forming a huge
cloud. The cloud is 1' high per level of the druid,
and is 10' in diameter for each level. For exam-
ple, a 20th level druid could cast an obscure 20'
tall and 200' diameter (100' radius). The cloud
has no ill effects except to block vision.
The caster, and all creatures able to see invisi-
ble things, will be able to see dimly through the
cloud. All other creatures within the cloud will
be delayed and confused by the effect. While
within the cloud, these creatures are effectively
blind.
Produce Fire
Range: 0 (druid only)
Duration: 2 turns per level
Effect: Creates fire in hand
This spell causes a small flame to appear in the
druid's hand. It does not harm the caster in any
way, and sheds light as if a normal torch. The
flame can be used to ignite combustible materi-
als touched to it (a lantern, torch, oil, etc.) with-
out harming the magical flame. While holding
the flame, the caster can cause it to disappear
and reappear by concentration once per round,
until the duration ends. Other items may be
held and used in the hand while the fire is out. If
desired, the fire may be dropped or thrown to a
30' range, but disappears 1 round after leaving
the druid's hand. (Any fire it ignites during that
round remains burning.)
Warp Wood
Range: 240'
Duration: Permanent
Effect: Causes wooden weapons to bend
This spell causes one or more wooden weap-
ons to bend and (probably) become useless.
The spell will affect one arrow for each level of
the caster; treat a spear, javelin, or magical
wand as two arrows' worth, and any club, bow
or staff (magical or otherwise) as four. The spell
will not affect any wooden items other than
weapons. If a magical wooden item (such as
an enchanted staff) is the target, the wielder
may make a saving throw vs. spells to avoid the
effect. Items carried but not held get no saving
throw; magical items with "pluses" might not
be affected, at a 10% chance per "plus." (For
example, an arrow +1 would have a 10%
chance to be unaffected.)
Third Level Druidic Spells
Call Lightning
Range: 360'
Duration: 1 turn per level of the caster
Effect: Calls lightning bolts from a storm
This spell cannot be used unless a storm of
some (any) type is within range of the druid.
(This does not mean that he must be within the
spell's range of the storm cloud, but only that
the stormy weather be taking place within 360'
of him.)
If a storm is present, the druid may call 1
lightning bolt per turn (10 minutes) to strike at
any point within range. The lightning bolt de-
scends from the sky, hitting an area 20' across.
Each victim within that area takes 8d6 (8-48)
points of electrical damage, but may make a sav-
ing throw vs. spells to take half damage. The
druid need not call the lightning every turn un-
less desired; it remains available until the spell
duration (or the storm) ends.
Hold Animal
Range: 180'
Duration: 1 turn per level of the caster
Effect: Paralyzes several animals
This spell will affect any normal or giant-sized
animal, but will not affect any fantastic creature,
nor one of greater than animal intelligence (2).
Each victim must make a saving throw vs. spells
or be paralyzed for the duration of the spell.
The druid can affect 1 Hit Die of animals for
each level of experience, ignoring "pluses" to
Hit Dice. For example, a 20th level druid could
cast the spell at 10 giant toads (which have 2 + 2
Hit Dice each). Note that the spell can affect
summoned, conjured, or controlled animals.
Protection from Poison
Range: Touch
Duration: One turn per level of the caster
Effect: Gives one creature immunity to all poison
For the duration of this spell, the recipient is
completely immune to the effects of poisons of
all types, including gas traps and cloudkill spells.
This protection extends to items carried (thus
protecting against a spirit's poisonous presence,
for example). Furthermore, the recipient gains a
+ 4 bonus on saving throws vs. poisonous breath
weapons (such as green dragon breath), but not
petrification breath (such as a gorgon's).
Water Breathing
Range: 30'
Duration: 1 day
Effect: One air-breathing creature
This spell allows the recipient to breathe while
under water (at any depth). It does not affect
movement in any way, nor does it interfere with
the breathing of air.
Fourth Level Druidic Spells
Control Temperature 10' radius
Range: 0 (druid only)
Duration: 1 turn per level of the caster
Effect: Cools or warms air within 10'
This spell allows the druid to alter the temper-
ature within an area 20' across. The maximum
change is 50 degrees (Fahrenheit), either warmer
or cooler. The change occurs immediately, and
the effect moves with the druid. The druid may
change the temperature simply by concentrating
for 1 round, and the temperature will remain
changed as long as the spell lasts. The spell is
useful for resisting cold or heat so the caster may
survive temperature extremes.
Plant Door
Range: 0 (druid only)
Duration: 1 turn per level of the caster
Effect: Opens a path through growth
For the duration of this spell, no plants can
prevent the druid's passage, no matter how
dense. Even trees will bend or magically open to
allow the druid to pass. The druid can freely car-
ry equipment while moving through such barri-
ers, but no other creature can use the passage.
Note that a druid can hide inside a large tree
after casting this spell. The druid cannot see
what is happening while he is in the tree.
Protection from Lightning
Range: Touch
Duration: 1 turn per level of the caster
Effect: Protects against lightning attack
Any recipient of this spell is immune to a
given amount of electrical damage. The druid's
experience level determines the amount of dam-
age: for each level of experience, one die (1d6)
of damage is negated. Subtract the number of
dice from the number of dice of damage that
would be done to him.
Example: A 20th level druid casts this spell.
He is protected against 20d6 lightning damage.
For example, this would negate the effects of two
full call lightning attacks (of 8 dice each)on him,
plus half of a third (8 + 8 + 4 = 20). The third
call lightning inflicts 4d6 points of damage on
him (but he does get his saving throw against it),
and any subsequent call lightning attacks made
against him will do full damage.
Summon Animals
Range: 360'
Duration: 3 turns
Effect: Calls and befriends normal animals
With this spell, the druid can summon any or
all normal animals within range. Only normal,
nonmagical creatures of animal intelligence are
affected, including mammals, reptiles, amphib-
ians, etc. The spell does not affect insects, ar-
thropods, humans, and demihumans. The druid
may choose one or more known animals, may
call for specific types, or may summon every-
thing within range. The total Hit Dice of the an-
imals responding will equal the level of the
druid. Treat normal small creatures (frogs, mice,
squirrels, small birds, etc.) as 1/10 Hit Die each.
Animals affected will come at their fastest
movement rate, and will understand the druid's
speech while the spell is in effect. They will be-
friend and help the druid, to the limit of their
abilities. If harmed in any way, a summoned ani-
mal will normally flee, the spell broken for that
animal. However, if the druid is being attacked
when a summoned animal arrives, the animal
will immediately attack the opponent, fleeing
only if it fails a morale check.
This spell may also be used to calm hostile ani-
mals encountered while adventuring.
Fifth Level Druidic Spells
Anti-Plant Shell
Range: 0 (druid only)
Duration: 1 round per level of the druid
Effect: Personal barrier which blocks plants
This spell creates an invisible barrier around
the druid's body (less than an inch away). The
barrier stops all attacks by plants and plant-like
monsters, so that they can inflict no damage. If
the caster pushes through normal but dense
growth while protected, he will open a path that
others can pass through.
While protected, the druid cannot attack
plants except by spells; the plants are protected
from the druid's physical attacks, just as the
druid is protected from theirs.
Control Winds
Range: 10' radius per level of the caster
Duration: 1 turn per level of the caster
Effect: Calms or increases winds
With this spell, the druid can cause all the air
within range to behave as desired, either increas-
ing to gale force or slowing to a dead calm. The
druid must concentrate for one full turn of con-
centration (can't move or attack) to change the
wind completely (calm to gale, for example).
Any higher-level spellcaster using the same spell
can easily counter the spell. The effect moves
with the caster.
If the spell is cast against an air creature (such
as an elemental), the victim can make a saving
throw vs. spells. If the victim fails its roll, the
druid can slay or control the air creature by
proper use of the wind force. The creature will
only obey as long as the druid maintains concen-
tration and while the spell is active; if the druid's
concentration is broken or the spell's duration
lapses, the creature will attack the druid.
Dissolve
Range: 240'
Duration: 3-18 days
Effect: Liquefies 3,000 square feet
Nearly identical to the 5th level magic-user
spell of the same name, this effect changes a vol-
ume of soil or rock (but not a construction) to a
morass of mud. An area up to 10' deep or thick is
affected, and may have up to 3,000 square feet
of surface area. The druid may choose the exact
width and length (20' x 150', 30' x 100', etc.),
but the entire area of effect must be within 240'
of the caster. Creatures moving through the mud
are slowed to 10% of their normal movement
rate at best, and may become stuck (at the DM's
discretion, a victim must make saving throw vs.
spells to avoid becoming stuck).
Pass Plant
Range: 0 (druid only)
Duration: Instantaneous
Effect: Short-range teleportation
With this spell, the druid can enter one tree,
teleport, and immediately step out of another
tree of the same type. The trees must be large
enough to enclose the druid. The range a druid
can teleport varies by the type of tree, as follows.
600 yards
Oak
360 yards
Ash, Elm, Linden, Yew
240 yards
Evergreen trees
300 yards
Other trees
Sixth Level Druidic Spells
Anti-Animal Shell
Range: 0 (druid only)
Duration: 1 turn per level of the caster
Effect: Personal barrier that blocks animals
This spell creates an invisible barrier around
the druid's body (less than an inch away). The
barrier stops all attacks by animals, both normal
and giant-sized, as well as insects and all other
nonfantastic creatures of animal intelligence or
less (0-2). The druid cannot attack animals while
protected except by use of other spells; the ani-
mals are protected from the druid's physical at-
tacks, just as the druid is protected from theirs.
Summon Weather
Range: 5 miles or more
Duration: 6 turns per level
Effect: Brings weather to druid's area
When the druid casts this spell, some known
nearby weather condition is pulled to the druid's
location. The druid does not have control of the
weather, but merely summons it.
Only a druid of 25th level or greater may sum-
mon severe weather (hurricane, severe heat
wave, etc.). The range of summoning is 5 miles
at levels 12 to 15, adding 1 mile for each level of
the caster above 15th. (A 20th level druid could
summon weather from up to 10 miles away.)
Transport Through Plants
Range: Infinite
Duration: Instantaneous
Effect: Long-range teleportation
This spell may be used a maximum of once
per day. The druid must be near a plant (of any
size), and must choose either a general location
or a specific known plant elsewhere. After cast-
ing the spell, the druid magically enters the
nearby plant and steps out of a plant at the desti-
nation (if the druid could not specify the exact
plant, he appears from a plant determined ran-
domly by the DM). There is no limit to the
range, but the plants must both be living for the
spell to work, and must both be on the same
plane of existence. If either plant is dead, the
spell fails. Otherwise, the caster immediately re-
appears at the new location. The caster can trans-
port two additional willing creatures.
Turn Wood
Range: 30'
Duration: One turn per level of the druid
Effect: Pushes all wooden items away
This spell creates an invisible wave of force,
120' long and 60' tall. Its midpoint can be cre-
ated anywhere within 30' of the caster. This wave
of force then immediately moves in one horizon-
tal direction, as specified by the caster, at the
rate of 10' per round. If the druid desires, he can
stop the wave of force at any time, but cannot
thereafter move it again.
All wooden objects contacting or contacted by
the wave of force become stuck to it and move
with it. The wave of force continues moving un-
til it reaches the maximum range of 360 feet,
and stops there for the remainder of the spell du-
ration. The items caught are not harmed by the
effect, but wooden weapons (bows, crossbows,
most spears and javelins, etc.) and magical items
(wands, staves, etc.) cannot be used while
trapped in the effect.
Once created, the wave of force does not re-
quire concentration. However, the caster may
cause it to vanish before the duration ends by
concentrating for one round.
This spell has many useful applications during
mass combat (against a group of archers or siege
engines) and waterborne adventures (to move a
ship). It will move wooden objects which have
metal attachments (such as treasure chests).
However, it will not move permanent construc-
tions (such as buildings, including objects per-
manently attached to them such as doors) or
other secured objects (such as trees).
Seventh Level Druidic Spells
Creeping Doom
Range: 120'
Duration: 1 round per level of the caster
Effect: Creates a 20' x 20' insect horde
This spell magically creates a huge swarm of
1,000 creeping insects, appearing anywhere
within 120' of the druid (as chosen by the cast-
er). They fill an area at least 20' x 20', and can be
ordered to fill any area up to a maximum of
60' x 60'.
The creeping doom can move at up to 60'(20')
if the caster remains within 120' of any part of
the swarm. They vanish after the duration ends,
or whenever the druid is more than 120' away.
The insects always attack everyone and every-
thing in their path, inflicting 1 point of damage
per 10 insects, a total of 100 points per round to
each creature caught in the effect (no saving
throw). Normal attacks (such as fire) can damage
the horde slightly, but even a fireball spell will
only slay 100 of them (reducing the damage ac-
cordingly). The creeping doom can be destroyed
by a dispel magic spell (at normal chances for
success), but it can penetrate a protection from
evil effect, and can move over most obstacles at
the normal movement rate.
Metal to Wood
Range: 120'
Duration: Permanent
Effect: Changes metal into dead wood
This spell can be used to change any metal
item or items into wood. The spell can trans-
mute five pounds (50 cn weight) per level of the
caster. Any magical metal item is 90% resistant
to the magic. The effect is permanent, and the
affected metal cannot be changed back with a
dispel magic spell. Any armor changed to wood
falls off the wearer and any weapons affected
turn to nonmagical wooden clubs.
Summon Elemental
Range: 240'
Duration: 6 turns
Effect: Summons one 16 HD elemental
This spell allows the caster to summon any one
elemental per spell (see Chapter 14). The druid
may only summon one of each type of elemental
(air, earth, fire, water) in one day. The elemental
will understand the druid's spoken commands
and will perform any tasks within its power (car-
rying, attacking, etc.) as directed by the caster.
Unlike the magic-user's version of the spell,
the druid does not need to concentrate to control
the creature. The caster may send it back to its
own plane with a simple command, and some-
one else may send it back by the use of a dispel
magic or dispel evil spell.
Weather Control
Range: 0 (druid only)
Duration: Concentration
Effect: All weather within 240 yards
This spell allows the druid to create one spe-
cial weather condition in the surrounding area
(within a 240 yard radius). The caster may select
the weather condition. The spell only works out-
doors, and the weather will affect all creatures in
the area (including the caster). The effects last as
long as the caster concentrates, without moving;
if the caster is being moved (for example, aboard
a ship), the effect moves also. The spell's effects
vary, but the following results are typical:
Rain: -2 penalty to attack rolls applies to all
missile fire. After three turns, the ground be-
comes muddy, reducing movement to half the
normal rate.
Snow: Visibility (the distance a creature can
see) is reduced to 20'; movement is reduced to
half the normal rate. Rivers and streams may
freeze over. Mud remains after the snow thaws,
for the same movement penalty.
Fog: 20' visibility, half normal movement.
Those within the fog might become lost, moving
in the wrong direction.
Clear: This cancels bad weather (rain, snow,
fog) but not secondary effects (such as mud).
Intense Heat: Movement reduced to half nor-
mal. Excess water (from rain, snow, mud trans-
muted from rock, etc.) dries up.
High Winds: No missile fire or flying is possi-
ble. Movement reduced to half normal. At sea,
ships sailing with the wind move 50% faster. In
the desert, high winds create a sandstorm, for
half normal movement and 20' visibility.
Tornado: This creates a whirlwind under the
druid control, attacking and moving as if it was a
12 HD air elemental. At sea, treat the tornado as
a storm or gale.
Magical Spells
Casting Magical Spells
Spells used by magic-users and elves are some-
what different from those used by clerics and
druids, both in their effects and the ways they
are learned and used.
Spell Books
When a magic-user or elf begins play at first
level, he starts with a spell book, given to him by
his teacher. The spell book will contain two 1st
level spells. The Dungeon Master will tell you
what spells your character starts with.
The spell book is large and bulky, and cannot
be easily carried (about 2' square, 2-6 inches
thick, weighing at least 20 pounds). It will not
fit inside a normal sack of any size, but may be
carried in a backpack or saddlebag. All spell
books are written in magical words, and only
their owners may read them without using the
read magic spell (described later).
As previously discussed, the magic-user or elf
forgets each spell as he casts it. This is why he has
a spell book: He can memorize the spell again
later and have it available to him once more.
On the magic-user and elf experience tables,
the "Spells/Level" columns indicate how many
spells of each level the character can have memo-
rized at one time. This doesn't limit the number
of spells the character can have in his spell books.
For example, a fourth level magic-user can
memorize four spells—two 1st level and two 2nd
level. But his spell book might have more spells
written in it. He might have six 1st level spells
written in his book, for instance, and he might
have three 2nd level spells. He can still only
memorize two of each type in a day.
Learning New Spells
Every magic-user and elf was taught magic by
someone else—normally, by a nonplayer charac-
ter spellcaster of 7th experience level or higher.
Your campaign can assume that magic-user
and elf characters have such a teacher, whom
they visit and learn from whenever they're not
adventuring. The DM may wish to work this
NPC into a full-fledged character who can ap-
pear in adventures as a consultant or expert.
The PCs' teacher does not go on adventures—
not until the characters reach or exceed his expe-
rience level, and only then if the DM wishes him
to. Otherwise, the player characters would have
a very powerful ally along, one who would solve
most of their adventuring problems.
When the player character begins play, the
teacher gives him a spell book with two 1st level
spells in it. When the PC reaches 2nd level, the
teacher writes another 1st level spell in the book.
When the PC reaches 3rd level, the teacher will
write a 2nd level spell in his book, and when he
reaches 4th level the teacher will give him one
more 2nd level spell.
In many campaigns, that's the point at which
the teacher stops instructing the character. The
character has gone from apprentice to journey-
man, and now he must journey in order to learn
more of magic.
So, where can PCs learn more spells? They
have several options, and may explore any or all
of them during their careers.
Other Magic-Users: By ancient tradition—of
necessity and common sense—magic-users are
loathe to trade spells among themselves. Each
magic-user knows that he may become a very
powerful wizard some day . . . and that he may
end up being the enemy of another wizard of
similar power. No wizard wants to teach the oth-
er fellow magic that can kill him. This is some-
thing the DM should reinforce in his campaign:
If he finds characters casually trading spells from
their spell books, he should remind them of the
traditions of secrecy, of the good reasons for that
tradition, of the paranoia that infects the magic-
users' community, and so on. If they decline to
accept his recommendation, their characters may
pick up a reputation—as magic-users who can't
keep their trade secret. Other spellcasters, per-
haps even their old teachers, will refuse to teach
them and will take special pains to keep their
magic hidden from them. Higher-level magic-
users may even decide to steal or destroy the PCs'
spell books to teach them a lesson—forcing them
to work for many boring weeks or months to re-
construct them (see "Lost Spell Books," below).
But that's casual exchanges of spells. It's
known for magic-users to give spells to PCs in
more remarkable circumstances. For instance,
low-level spellcasters might do a great favor for a
high-level magician (save his child, undertake a
special quest for him and demonstrate remark-
able bravery while carrying it out, etc.). In such a
case, it is not necessarily inappropriate for the
NPC to reward the PC with a spell.
The Teacher: Once the player character reach-
es 4th experience level, his teacher doesn't have
to leave play entirely. The PC might be able to
visit and train with him from time to time, and
the teacher could continue to teach him spells.
But since the PC is a journeyman now, the teach-
er might also require him to undertake specific
tasks ("Now, I need you to take this flask to Es-
devius in far-off Parokaland . . . and don't let
the dragon get you.") in order to remain his stu-
dent. While the PC could continue learning
spells this way, the teacher should not be his only
source for new spells; he should be learning oth-
ers as he adventures.
Scrolls: One magical treasure sometimes
found in adventures is the magical scroll. Some
scrolls have magic-user spells written upon
them. A magic-user can use the scroll by casting
the spell from it—in which case the written spell
disappears as soon as it is cast. Or, he can transfer
it to his spell book (during this process, the spell
disappears from the scroll), and he will have
gained a new spell.
Enemy Magic-Users: Should the PCs encount-
er and defeat an enemy magic-user, the PC
magic-user might try to help himself to the ene-
my's spell book. The DM should make sure that
the spell book has many spells which are identi-
cal to those in the PC's spell book: Most magic-
users have many spells in common, especially the
lower-level spells. The PC should gain only one
or two new spells out of such an encounter. A
new spell is a rare find, and a spell book is an
even rarer treasure; the books are always well
hidden and protected. PCs using someone else's
spell book may find magical traps and curses
within before they find any new spells.
Higher-level Spells
A magic-user cannot put into his spell book a
spell of a higher-level than he can cast. In other
words, if he can't yet cast a 3rd level spell, he
certainly can't write one in his spell book.
Lost Spell Books
A magic-user or elf whose spell book is lost or
destroyed cannot regain spells until he replaces
the spell book. He can't just read from some-
body else's spell book. He can recreate the spells
from memory and research . . . but it takes a lot
of money and a lot of time.
The method, amount of time, and cost it
takes to recreate a spell book are for the DM to
decide. Here's a rough guideline: 1,000 gold
pieces and one week of study for each spell level
replaced. (For example, each 3rd level spell
would require 3,000 gp and three weeks to re-
construct). This reconstruction takes up all the
character's time, leaving none for adventuring.
A character can make a second spell book to
leave in a safe place in case his primary book is
destroyed. This doesn't take all the time and
money which reconstruction of spells requires; a
magic-user or elf could copy four spells a day
from his primary spell book to his "backup."
The Player Character's Spell Book
Both the player and the DM need to keep
track of exactly which spells are in a character's
spell book. Both people can keep track of which
spells the character has had access to; the player
can keep track of the ones the character acquires.
If ever there's a difference in the two spell lists,
the player should be able to remember where the
character acquired the extra spells; if the expla-
nation doesn't satisfy the DM, he's may remove
the spell from the character's spell book. Appen-
dix 3 provides a copyable spell book sheet, on
which players can keep the name and description
of all their characters' spells.
Reversible Spells
Unlike clerical spells, magical spells must be
memorized in their reversed form to be usable in
that form. The spellcaster must select the normal
or reversed form of the spell when he memorizes
the spell for the day. There's no problem to
memorizing a spell in reversed form; if the spell
can be reversed, the magic-user knows how to
memorize it that way.
Of course, a magic-user could memorize it
once in normal form and once in reversed form.
For example, if a spellcaster has a light spell in a
spell book, the character could memorize both
light and darkness for an adventure.
In the spell lists below, all spells which can be
reversed are marked with an asterisk (*).
First Level Magical Spells
Analyze
Range: 0 (touch only)
Duration: 1 round
Effect: Analyzes magic on one item
A spellcaster using this spell can handle one
item and learn the enchantment on it. Helms
must be put on the spellcaster's head, swords
held in his hand, bracelets put on his wrist, etc.
for this spell to work. Any consequences of this
action (for example, from cursed or booby-
trapped objects) fall upon the spellcaster,
though he gets his usual saving throws.
The spellcaster has a chance of 15 % plus 5 %
per experience level to determine one magical
characteristic of the item; if the item is non-
magical, his chance is to determine that fact.
The spell does not reveal much precise infor-
mation. It will characterize a weapon's pluses
(attack bonus) as "many" or "few," will esti-
mate the number of charges on an item within
25% of the actual number, etc.
Charm Person
Range: 120'
Duration: See below
Effect: One living person (see below)
This spell will only affect humans, demi-
humans, and certain other creatures. The victim
is allowed a saving throw vs. spells. If the saving
throw is successful, the spell has no effect. If it
fails, the victim will believe that the spellcaster is
its "best friend," and will try to defend the spell-
caster against any threat, whether real or imag-
ined. The victim is charmed.
As a general rule, the spell only affects crea-
tures which look similar to humans in various
ways—humans, demihumans, certain giant-
class creatures, etc. It will not affect animals,
magical creatures (such as living statues), un-
dead monsters, or human-like creatures larger
than ogres.
If the spellcaster can speak a language that the
charmed victim understands, the spellcaster may
give orders to the victim. These orders should
sound like suggestions, as if "just between
friends." The charmed victim will usually obey,
but the victim may resist orders that are contrary
to the victim's nature (alignment and habits)—
he doesn't need to roll anything to resist. A vic-
tim will refuse to obey if ordered to kill itself.
A charm may last for months. The victim may
make another saving throw every so often, de-
pending on its Intelligence score.
Charm Person Duration
If the Victim Has:
He Saves Every:
High Intelligence (13-18):
1 day
Average Intelligence (9-12):
1 week
Low Intelligence (3-8):
1 month
A more complex system for determining the
duration of a charm spell appears in Chapter 13,
on page 144.
A victim who is given conflicting orders and
impressions by his old adventuring friends and
his new "best friend" should react as any person
would in real life: with confusion. He will not
automatically assume that one party or the other
is lying . . . even if the player wants him to.
The charm is automatically broken if the spell-
caster attacks the victim, whether by spell or by
weapon. The victim will fight normally if at-
tacked by the spellcaster's allies.
Detect Magic
Range: 0
Duration: 2 turns
Effect: Everything within 60'
When he casts this spell, the spellcaster will
see a glow surround all magical objects, crea-
tures, and places which are visible and within
range of the spell. No saving throw is allowed.
Example: Shortly after casting this spell, a
magic-user walks into a room containing a door
locked by magic, a magical potion lying nearby,
and a treasure chest containing a magical wand.
All the magic will glow, but the spellcaster can
see only the door and potion; the light of the
glowing wand is hidden by the treasure chest.
Floating Disc
Range: 0
Duration: 6 turns
Effect: Disc remains within 6'
This spell creates an invisible magical horizon-
tal platform about the size and shape of a small
round shield. It can carry up to 5000 cn (500
pounds). It cannot be created in a place occupied
by a creature or object. The floating disc is cre-
ated at the height of the spellcaster's waist, and
will always remain at that height. It will auto-
matically follow the spellcaster at his current
movement rate, remaining within 6' of him at
all times. It can never be used as a weapon, be-
cause it has no solid existence and veers away
from anything it might run into. When the du-
ration ends, the floating disc will disappear, sud-
denly dropping anything upon it. No saving
throw is allowed.
Hold Portal
Range: 10'
Duration: 2-12 (2d6) turns
Effect: One door, gate, or similar portal
This spell will magically hold shut any
portal—for example, a door or gate. A knock
spell will open the hold portal. Any creature
three or more Hit Dice greater than the caster
(and characters three or more levels higher) may
break open a held portal in one round, but the
portal will relock if allowed to close within the
duration of the spell.
Example: Any 5th level character can break
through a hold portal spell cast by a 2nd level
spellcaster.
Light*
Range: 120'
Duration: 6 turns + 1 turn/level of the caster
Effect: Volume of 30' diameter
This spell creates a large ball of light, much
like a bright torchlight. If the spell is cast on an
object (such as a coin), the light will move with
the object. If cast at a creature's eyes, the crea-
ture must make a saving throw vs. spells. If he
fails the saving throw, the victim will be blinded
by the light until the duration ends (see page
150, for the effects of blindness). If he makes the
saving throw, the light appears in the air behind
the intended victim.
When reversed, this spell, darkness, creates a
circle of darkness 30' in diameter. It will block all
sight except infravision. Darkness will cancel a
light spell if cast upon it (but may itself be can-
celed by another light spell). If cast at an oppo-
nent's eyes, it will cause blindness until
canceled, or until the duration ends; as before,
the victim does get a saving throw.
Magic Missile
Range: 150'
Duration: 1 round
Effect: Creates 1 or more arrows
A magic missile is a glowing arrow, created
and shot by magic, which inflicts 1d6 + 1 (2-7)
points of damage to any creature it strikes. After
the spell is cast, the arrow appears next to the
spellcaster and hovers there (moving with him)
until the spellcaster causes it to shoot. When
shot, the magic missile will automatically hit any
one visible target the spellcaster specifies. The
magic missile actually has no solid form, and
cannot be touched. A magic missile never misses
its target and the target is not allowed a saving
throw.
For every 5 levels of experience of the caster,
two more missiles are created by the same spell.
Thus a 6th level spellcaster may create three mis-
siles. The spellcaster may shoot the missiles all at
one target or at different targets.
Protection from Evil
Range: 0
Duration: 6 turns
Effect: The spellcaster only
This spell creates an invisible magical barrier
all around the spellcaster's body (less than an
inch away). All attacks against the spellcaster are
penalized by — 1 to their attack rolls, and the
spellcaster gains a +1 bonus to all saving throws,
while the spell lasts.
In addition, enchanted creatures cannot at-
tack the spellcaster in hand-to-hand or melee
combat. (An enchanted creature is one that nor-
mal weapons cannot hurt; only magical weapons
can hit the creature. A creature that can be only
hit by a silver weapon—a werewolf, for
example—is not an enchanted creature. Any
creature that is magically summoned or con-
trolled, such as a charmed character, is also con-
sidered to be an enchanted creature.)
The barrier thus completely prevents all at-
tacks from those creatures unless they use missile
weapons; the barrier is no defense against mis-
siles, though the attackers still suffer the — 1 at-
tack roll penalties.
This spell will not affect a magic missile, ei-
ther incoming or outgoing. If the spellcaster at-
tacks (hand-to-hand) anything during the spell's
duration, the effect changes slightly. Enchanted
creatures are then able to touch the spellcaster,
but the attack roll and saving throw adjustments
still apply until the spell duration ends.
Read Languages
Range: 0
Duration: 2 turns
Effect: The spellcaster only
This spell will allow the spellcaster to read, not
speak, any unknown languages or codes, includ-
ing treasure maps, secret symbols, and so forth,
until the duration ends.
Read Magic
Range: 0
Duration: 1 turn
Effect: The spellcaster only
This spell will allow the spellcaster to read, not
speak, any magical words or runes, such as those
found on scrolls and other items. A spellcaster
cannot understand unfamiliar magic writings
without using this spell. However, once a spell-
caster reads a scroll or runes with this spell, he
can read or speak that magic later without using
a spell.
All spell books are written in magical words,
and only their owners may read them without
using this spell.
Shield
Range: 0
Duration: 2 turns
Effect: The spellcaster only
This spell creates a magical barrier all around
the spellcaster (less than an inch away). It moves
with the spellcaster. While the duration lasts,
the spellcaster has an AC of 2 against missiles,
and AC 4 against all other attacks.
If someone shoots a magic missile at a spell-
caster protected by this spell, the spellcaster may
make a saving throw vs. spells (one saving throw
per missile). If the saving throw is successful, the
magic missile has no effect; it hits the barrier and
evaporates.
Sleep
Range: 240'
Duration: 4d4 (4-16) turns
Effect: 2-16 Hit Dice of living creatures within a
40' square area
This spell will put creatures to sleep for up to
16 turns. It will only affect creatures with 4 + 1
Hit Dice or less—generally, small or man-sized
creatures. The spell will not affect creatures out-
side the 40' X 40' area which the player chooses
as the spell's target area. The spell will not work
against undead or very large creatures, such as
dragons.
When a character is first hit with a sleep spell,
falling or sagging to the ground will not wake
him up. However, characters affected by a sleep
spell are not in a deep sleep. Any sleeping char-
acter or creature will awaken if slapped, kicked,
or shaken.
Characters can kill a sleeping victim with a sin-
gle blow of any edged weapon, regardless of the
creature's hit points.
Your Dungeon Master will roll 2d8 to find the
total Hit Dice or experience levels of monsters af-
fected by the spell.
The victims get no saving throw against this
spell.
Ventriloquism
Range: 60'
Duration: 2 turns
Effect: One item or location
This spell will allow the spellcaster to make
the sound of his or her voice come from some-
where else, such as a statue, animal, a dark cor-
ner, and so forth. The "somewhere else" must
be within range of the spell.
Second Level Magical Spells
Continual Light*
Range: 120'
Duration: Permanent
Effect: Volume of 60' diameter
This spell creates a globe of light 60' across. It
is much brighter than a torch, but not as bright
as full daylight. It will continue to glow forever,
or until it is magically removed. It may be cast on
an object, just as the first level light spell. If cast
at a creature's eyes, the victim must make a sav-
ing throw vs. spells. If he fails the saving throw,
the victim is blinded—permanently, or until the
spell is dispelled. If he makes the saving throw,
the globe will still appear, but will remain in the
place it was cast, and the intended victim will
suffer no ill effects.
The reverse of this spell, continual darkness,
creates a volume of complete darkness in a 30'
radius. Torches, lanterns, and even a light spell
will not affect it, and infravision cannot pene-
trate it. If cast on a creature's eyes, the creature
must make a saving throw vs. spells or be blind-
ed until the spell is removed. A continual light
spell will cancel its effects.
Detect Evil
Range: 60'
Duration: 2 turns
Effect: Everything within 60'
When this spell is cast, the spellcaster will see
a glow surround all evilly-enchanted objects
within 60'. It will also cause creatures that want
to harm the spellcaster to glow when they are
within range. The spell, however, does not allow
the spellcaster to hear the actual thoughts of the
creatures.
Remember that Chaotic alignment is not au-
tomatically the same as evil, although many
Chaotic monsters have evil intentions. Traps and
poison are neither good nor evil, but merely
dangerous.
Detect Invisible
Range: 10' per level of the spellcaster
Duration: 6 turns
Effect: The spellcaster only
When this spell is cast, the spellcaster can see
all invisible creatures and objects within range.
The range is 10' for each level of the spellcaster.
For example, a 3rd level spellcaster can use this
spell to see invisible things within 30'.
Entangle
Range: 30'
Duration: 1 round per level
Effect: Controls ropes
This spell allows the spellcaster to use any
rope-like object of living or once-living material
(roots, vines, leather ropes, plant-fibre ropes,
etc.) to behave as he or she orders. About 50' of
normal 1/2" diameter vine plus 5' per level of the
caster can be affected.
The commands which can be given during an
entangle spell include: coil (form a neat stack),
coil and knot, loop, loop and knot, tie and knot,
and the reverses of all the above. The vine or
rope must be within 1' of any object it is to coil
around or tie up, so it must often be thrown at
the target. This spell is very useful in climbing
situations; a spellcaster can toss a rope up the
side of a wall or cliff and command it to loop and
knot itself around a projection at the height of
the throw. Coil and knot effectively ties up a vic-
tim.
A person or monster attacked by any use of
the spell may make a saving throw vs. spells to
avoid the effects of the entangle.
ESP*
Range: 60'
Duration: 12 turns
Effect: All thoughts in one direction
This spell will allow the spellcaster to "hear"
thoughts. The spellcaster must concentrate in
one direction for six rounds (one minute) to hear
the thoughts (if any) of a creature within range.
The spell allows the spellcaster to understand the
thoughts of any single living creature, regardless
of the language. The spell does not allow the
caster to hear the thoughts of undead creatures.
If more than one creature is within range and
in the direction the caster is concentrating, the
spellcaster will "hear" a confused jumble of
thoughts. The spellcaster can sort out the jumble
only by concentrating for an extra six rounds to
find a single creature.
ESP will not be hampered by any amount of
wood or liquid, and will penetrate as much as
two feet of rock, but a thin coating of lead will
block the spell. Targets can make a saving throw
vs. spell to avoid the spell effects.
The reverse of this spell, mindmask, may be
cast, by touch, on any one creature. The recipi-
ent is completely immune to ESP and all other
forms of mind-reading for the spell duration.
Invisibility
Range: 240'
Duration: Permanent until broken
Effect: One creature or object
This spell will make any one creature or object
invisible. When a creature becomes invisible, all
items that he carries and wears also become invis-
ible. Any invisible item becomes visible again
when it leaves the creature's possession
(dropped, set down, etc.). A light source (such
as a torch) may be made invisible, but the light
given off will always remain visible.
If the spellcaster makes an object invisible that
is not being carried or worn, it will become visi-
ble again when touched by any living creature.
An invisible creature will remain invisible until
he or she attacks or casts any spell.
Knock
Range: 60'
Duration: See below
Effect: One lock or bar
This spell will open any type of lock. This spell
will open any normal or magically locked door
(one affected by a hold portal or wizard lock
spell), and any secret door (but a secret door
must be found before it can be knocked open).
Any locking magic will remain, however, and
will take effect once again when the door is
closed. This spell will also unlock a gate, or un-
stick it if it is stuck, and will cause any treasure
chest to open easily. It will also cause a barred
door to open, magically forcing the bar to fall to
the floor. If a door is locked and barred, only one
type of lock will be opened.
Levitate
Range: 0
Duration: 6 turns + 1 turn/level of the caster
Effect: The spellcaster only
When this spell is cast, the spellcaster may
move up or down in the air without any support.
This spell does not, however, allow the spellcast-
er to move from side to side. For example, a
spellcaster could levitate to a ceiling, and then
could slowly move sideways by pushing and pull-
ing. His movement up or down is at the rate of
20' per round.
The spell cannot be cast on another person or
object. The spellcaster may carry a normal
amount of weight while levitating, up to 2,000
cn (200 lbs) in weight, possibly another man-
sized creature (if it isn't wearing metal armor).
Any creature smaller than man-sized can be car-
ried, unless heavily laden. No saving throw is al-
lowed.
Locate Object
Range: 60' + 10' per level of the spellcaster
Duration: 2 turns
Effect: One object within range
The spellcaster casts this spell to find an object
within the spell's range. For this spell to work,
the spellcaster must know exactly what the ob-
ject looks like. He can specify a common type of
object, such as "any flight of stairs," instead.
The spell will point to the nearest designated
object within range, giving the direction but not
the distance.
The spell's range increases as the spellcaster
gains levels of experience. For example, a 2nd
level spellcaster can locate objects up to 80'
away; a 3rd level spellcaster, up to 90'.
Mirror Image
Range: 0
Duration: 6 turns
Effect: The spellcaster only
With this spell, the spellcaster creates 1d4 (1-
4) additional images which look and act exactly
like him. The images appear and remain next to
(within 3' of) the spellcaster, moving if the spell-
caster moves, talking if the spellcaster talks, and
so forth. The spellcaster need not concentrate;
the images will remain until the duration ends,
or until they are hit.
The images are not real, and cannot actually
do anything. Any successful attack on the spell-
caster will strike an image instead, which will
merely cause that image to disappear (regardless
of the actual damage); this continues until all
the images are dispelled. (If the spellcaster is
caught in the effect of an area-type attack, such
as a fireball spell, all images will disappear and
the spellcaster will be affected by the spell.)
Phantasmal Force
Range: 240'
Duration: Concentration (see below)
Effect: A volume 20' x 20' x 20'
This spell creates or changes appearances of
everything within the area affected. The spell-
caster can create the illusion of something he or
she has seen. If not, the DM will give a bonus to
the saving throws of those trying to ignore the
spell's effects. If the spellcaster does not use this
spell to attack, the illusion created by this spell
will disappear when touched.
If the spellcaster uses the spell to create the il-
lusion of a monster, it will appear in every way to
be the monster in question. However, the mon-
ster is AC 9 and will disappear when hit.
If the spellcaster uses the spell to create an at-
tack (a phantasmal magic missile, collapsing
wall, etc.), the victim may make a saving throw
vs. spells; if he is successful, the victim is not af-
fected, and realizes that the attack is an illusion.
The phantasmal force will remain as long as
the spellcaster concentrates. If the spellcaster
moves, takes any damage, or fails any saving
throw, his concentration is broken and the phan-
tasm disappears.
This spell never inflicts any real damage.
Those "killed" by it will merely fall uncon-
scious, those "turned to stone" will be para-
lyzed, and so forth. The effects wear off in 1d4
turns. If the character does make his saving
throw to realize that the attack is an illusion, the
damage sustained disappears immediately.
Web
Range: 10'
Duration: 48 turns
Effect: A volume 10' x 10' x 10'
This spell creates a mass of sticky strands
which are difficult to destroy except with flame.
It usually blocks the area affected. Giants and
other creatures with great strength can break
through a web in 2 rounds. A human of Average
Strength (a score of 9-12) will take 2d4 (2-8)
turns to break through the web. Flames (from a
torch, for example) will destroy the web in 2
rounds, but all creatures within the web will be
burned for 1-6 (1d6) points of damage. Anyone
wearing gauntlets of ogre power (a magical trea-
sure) can break free of a web in 4 rounds.
Wizard Lock
Range: 10'
Duration: Permanent
Effect: One portal or lock
This spell is a more powerful version of a hold
portal spell. It will work on any lock, not merely
doors, and will last forever (or until magically
dispelled). However, a knock spell can open the
wizard lock.
The wizard who cast the wizard lock can easily
open the door he has enchanted, as can any
magic-using character or creature of three or
more levels (or Hit Dice) greater than the caster.
This sort of door-opening does not remove the
magic, and the magical lock will relock when al-
lowed to close (just as with the hold portal spell).
Third Level Magical Spells
Clairvoyance
Range: 60'
Duration: 12 turns
Effect: See through another's eyes
With this spell, the caster may see through the
eyes of any single creature in spell range.
"Seeing" through a creature's eyes takes one
full turn, after which the caster can change to an-
other creature, even one in another direction; he
does not have to cast the spell again to do so. Two
feet of rock or a thin coating of lead blocks the
effects of this spell. No saving throw is allowed.
Create Air
Range: Immediate area, 8,000 cu. ft.
Duration: 1 hour per level of caster
Effect: Provides breathable air
This spell provides breathable air, especially in
areas where otherwise there is none to be had. It
is cast on a volume of 8,000 cubic feet (such as a
20' x 20' x 20' room) and, while it is in effect,
everyone in that area has good air to breathe.
Customarily, it's used when dungeon explor-
ers are trapped where air is running out. When
cast in this fashion, the spell effect stays in one
place; it does not move with the caster.
However, it does not have to be cast in only
that way; it can be cast on enclosed vehicle inte-
riors (such as the below-deck areas of ships), liv-
ing creatures, or pieces of equipment. When it is
so cast, it will provide pressurized air for the du-
ration of the spell effect, and the spell will travel
with the vehicle on which it is cast.
The spell may be cast upon one person,
whereupon he can breathe normally. It's not the
same as water breathing, though—if he dives
underwater, he can still breathe, but great quan-
tities of air are always bubbling up from him,
making stealthy travel an impossibility.
The spell may be cast upon a specific piece of
equipment like a helmet, and whichever one
person wears it may breathe normally. If the hel-
met is not fully enclosed (i.e., airtight), air will
leak out from it under pressure; underwater this
makes stealthy movement impossible.
A flying creature on which this spell is cast can
not only breathe in hostile environments, it can
fly through airless void. This means that a
pegasus-rider could cast one spell on himself and
one on his pegasus, and then the two of them
could fly into the ether of outer space.
The spell does not protect people from the ef-
fects of poison gasses unless the gas in question is
a normal component of the atmosphere.
Dispel Magic
Range: 120'
Duration: Permanent
Effect: Destroys spells in a 20' cube
This spell destroys other spell effects in a cubic
volume of 20' x 20' x 20'. It does not affect mag-
ical items. Spell effects created by a caster
(whether cleric, druid, magic-user, or elf) of a
level equal to or lower than the spellcaster of the
dispel magic are automatically and immediately
destroyed. Spell effects created by a higher-level
spellcaster might not be affected. The chance of
failure is 5 % per level of difference between the
spellcasters. For example, a 7th level magic-user
trying to dispel a web spell cast by a 9th level
cleric would have a 10% chance of failure.
Dispel magic will not affect a magical item
(such as a scroll, a magical sword, etc.). How-
ever, it can dispel the effects of the magical item
when that item is used (a spellcaster can cast dis-
pel magic on the victim of a ring of human con-
trol and snap him out of that control).
Fireball
Range: 240'
Duration: Instantaneous
Effect: Explosion in a sphere 40' diameter
This spell creates a missile of fire that bursts
into a ball of fire with a 40' diameter (20' radius)
where it strikes a target. The fireball will cause
1d6 points of fire damage per level of the caster
to every creature in the area of effect.
Each victim may make a saving throw vs.
spells; if successful, the spell will only do half
damage. For example, a fireball cast by a 6th
level spellcaster will burst for 6d6 (6-36) points
of damage; characters who make their saving
throw vs. spell will take only half of the damage
rolled on the dice.
Fly
Range: Touch
Duration: 1d6 (1-6) turns + 1 turn per level of
the caster
Effect: One creature may fly
This spell allows the target it is cast upon (pos-
sibly the spellcaster himself) to fly. The recipient
can fly in any direction and at any speed up to
360' (120') by mere concentration. The recipient
may also stop and hover at any point (as a levi-
tate spell); this does not require concentration.
Haste*
Range: 240'
Duration: 3 turns
Effect: Up to 24 creatures move double speed
This spell allows up to 24 creatures in a 60' di-
ameter circle to perform actions at double speed
for half an hour (3 turns). Those affected may
move at up to twice normal speed and make
double the normal number of missile or hand-
to-hand attacks.
This spell does not affect the rate at which
magic works, so a hasted spellcaster can still not
cast more than one spell per round, and the use
of magical devices (such as wands) cannot be
speeded up.
The reverse of this spell, slow, will remove the
effects of a haste spell, or will cause the victims to
move and attack at half normal speed.
As with haste, the slow spell does not affect
spellcasting or the use of magical devices.
The victims may make a saving throw vs. spells
to avoid the effect.
Hold Person*
Range: 120'
Duration: 1 turn/level
Effect: Paralyzes up to 4 creatures
The hold person spell will affect any human,
demihuman, or human-like creature (bugbear,
dryad, gnoll, hobgoblin, kobold, lizard man,
ogre, orc, nixie, pixie or sprite, for instance). It
will not affect the undead or creatures larger
than ogres.
Each victim must make a saving throw vs.
spells or be paralyzed for nine turns. The spell
may be cast at a single person or at a group. If
cast at a single person, the victim suffers a — 2
penalty to the saving throw. If cast at a group, it
will affect up to four persons (of the cleric's
choice), but with no penalty to their rolls. The
paralysis may only be removed by the reversed
form of the spell, or by a dispel magic spell.
The reverse of the spell, free person, removes
the paralysis of up to four victims of the normal
form of the spell (including hold person cast by a
cleric). It has no other effect; e.g., it does not
remove the effects of a ghoul's paralysis ability.
Infravision
Range: Touch
Duration: 1 day
Effect: One living creature
This spell enables the recipient to see in the
dark, to a 60' range, with the same sort of vision
possessed by dwarves and elves.
Infravision is the ability to see heat (and the
lack of heat). Dwarves, elves, and casters of the
infravision spell have infravision in addition to
normal sight and can see 60' in the dark. Infra-
vision does not work in normal and magical
light. Fire and other heat sources can interfere
with infravision, just as a bright flash of light can
make normal vision go black for a short time.
With infravision, warm things appear red,
and cold things appear blue. For example, an
approaching creature could be seen as a red
shape, leaving faint reddish footprints. A cold
pool of water would seem a deep blue color.
Characters with infravision can even see items or
creatures which are the same temperature as the
surrounding air (such as a table or a skeleton), since
air flow will inevitably show the viewer their bor-
ders, outlining them in a faint lighter-blue tone.
Until they move, they will be very faint to the eye;
once they start moving, they become blurry but
very obvious light-blue figures.
Infravision isn't good enough to read by. A
character can use his infravision to recognize an
individual only if they are within 10' distance
unless the individual is very, very distinctive (for
example, 8' tall or walking with a crutch).
Invisibility 10' radius
Range: 120'
Duration: Permanent until broken
Effect: All creatures within 10'
This spell makes the recipient (and all others
within 10' at the time of the casting) invisible.
This is an area effect, and those who move fur-
ther than 10' from the recipient become visible.
They may not regain invisibility by returning to
the area. Otherwise, the invisibility is the same
as that bestowed by the spell invisibility. An in-
visible creature will remain invisible until he or
she attacks or casts any spell.
All items carried (whether by the recipient or
others within 10') also become invisible.
Lightning Bolt
Range: 180'
Duration: Instantaneous
Effect: Bolt 60' long, 5' wide
This spell creates a bolt of lightning, starting
up to 180' away from the caster and extending
60' in a straight line further away. All creatures
within the area of effect take 1d6 points of dam-
age per level of the spellcaster. (Thus a 6th level
elf would cast a lightning bolt doing 6d6 points
of damage.)
Each victim may make a saving throw vs.
spells; if successful, he takes only half damage.
If the lightning bolt strikes a solid surface
(such as a wall), it will bounce back toward the
caster until the total length of the bolt is 60'.
Protection from Evil 10' Radius
Range: 0
Duration: 12 turns
Effect: Barrier 20' diameter
This spell creates an invisible magical barrier
all around the caster, extending for a 10' radius
in all directions. The spell serves as protection
from attacks by monsters of an alignment other
than the caster's. Each creature within the barri-
er gains a +1 to all saving throws, and all attacks
against those within are penalized by - 1 to the
attacker's attack roll while the spell lasts.
In addition, enchanted creatures cannot at-
tack those within the barrier in hand-to-hand
(melee) combat. (An enchanted creature is any
creature which is magically summoned or con-
trolled, such as a charmed character, or one that
is not harmed by normal weapons. A creature
that can be hit only by a silver weapon—a were-
wolf, for example—is not an enchanted crea-
ture.)
If anyone within the barrier attacks an en-
chanted creature, the barrier will no longer pre-
vent the creature from attacking hand-to-hand,
but the bonus to saving throws and penalty to
attack rolls will still apply.
Attackers, including enchanted creatures, can
attack people inside the barrier by using missile
or magical attacks. They do suffer the — 1 penal-
ty to attack rolls, but that is the only penalty
they suffer.
Protection from Normal Missiles
Range: 30'
Duration: 12 turns
Effect: One creature
This spell gives the recipient complete protec-
tion from all small nonmagical missiles (such as
arrows, quarrels, thrown spears, etc.); the
ranged attacks simply miss. Large or magical at-
tacks, such as a catapult stone or a magic arrow,
are not affected.
The spellcaster can cast the spell on any one
creature within the spell's range.
Water Breathing
Range: 30'
Duration: 1 day (24 hours)
Effect: One air-breathing creature
This spell allows the recipient to breathe while
underwater (at any depth). It does not affect his
movement in any way, nor does it interfere with
the breathing of air if the recipient emerges from
the water.
Fourth Level Magical Spells
Charm Monster
Range: 120'
Duration: Special
Effect: One or more living creatures
This spell effect is identical to that of a charm
person spell, but will affect any creature except
an undead monster. If cast on victims with 3 Hit
Dice or less, the spell will charm 3d6 (3-18) vic-
tims. Otherwise, it will charm only one victim.
Each victim may make a saving throw vs. spells
to avoid the effects.
Clothform
Range: Touch
Duration: Permanent
Effect: Creates up to 30' x 30' cloth
This spell creates quantities of cloth up to
30'x30'. The cloth created by a single spell
must appear in one piece. Unlike many creation-
type spells, this one creates cloth that is non-
magical and cannot be dispelled.
If the campaign uses the optional general
skills and the caster has an appropriate Craft
skill, he may shape the cloth as he creates it. He
may thus create a tent, a sail, a single garment, a
drape, 60' of common rope, etc. If the campaign
doesn't use the skills rules, the character could
have been defined earlier as one who knows how
to work cloth in order for him to do this. Natu-
rally, unshaped cloth created by this spell can lat-
er be cut, sewn and otherwise fashioned into
such objects.
The cloth so created is much like undyed
linen—it's tough, serviceable, and unglamor-
ous. A caster can create his cloth with an unfin-
ished end, and later he or another caster can use
another clothform to create cloth joined to the
first on that edge—and there will be no seam or
weakness at the joining. This makes it a good
spell for creating rugged, dependable sails.
When created, the cloth extrudes from the
caster's hands and out along the ground. If there
are obstacles, it piles up against them but does
not shove them back. The spell may not be cast
to create a huge sheet which falls over a unit of
enemies, for instance. The cloth, when created,
may not be attached to anything except to an-
other expanse of clothform cloth, as described
above. The cloth cannot be cast in a space occu-
pied by another object.
In adventures, this spell is often used to make
quick shelters and to create rope.
Confusion
Range: 120'
Duration: 12 rounds
Effect: 3-18 creatures in an area 60' across
This spell will confuse its victims, affecting all
creatures within a 30' radius. Victims with less
than 2+1 Hit Dice are not allowed a saving
throw. Those with 2+1 or more Hit Dice must
make a saving throw vs. spells every round of the
spell's duration, if they remain in the area, or be
confused.
Confused creatures act randomly. The DM
should roll 2d6 each round to determine each
creature's action, using the following chart:
Confusion Results
2d6 Roll Result
Attack the spellcaster's party
2-5
6-8
Do nothing
9-12
Attack the creature's own party
Dimension Door
Range: 10'
Duration: 1 round
Effect: Safely transport one creature
This spell will transport one creature (either
the caster or a victim up to 10' from the caster) to
a place up to 360' away. The caster picks the de-
sired destination. If he does not know the loca-
tion, the caster may specify the direction and
distance of travel, but the distance cannot ex-
ceed a total of 360' (for example, 360' straight
up; or 200' west, 60' south, and 100' down).
If this would cause the recipient to arrive at a
location occupied by a solid object, the spell has
no effect.
An unwilling recipient may make a saving
throw vs. spells to avoid the effect.
Growth of Plants*
Range: 120'
Duration: Special
Effect: Enlarges 3000 square feet of plants
This spell causes normal brush or woods to be-
come thickly overgrown with vines, creepers,
thorns, and briars (or types of small plant-life
appropriate to the area). The spell affects an area
of up to 3,000 square feet (the caster chooses the
dimensions of the spell effect). The plants to be
affected must be entirely within the spell's
range.
The area affected by the spell is impassable to
all but giant-sized creatures. The effect lasts un-
til removed by the reversed form of the spell or
by a dispel magic spell.
The reverse of this spell, shrink plants, causes
all normal plants within the area of effect to
shrink and become passable. It may be used to
negate the effects of the normal spell. Shrink
plants will not affect plant-like monsters (such as
treants).
Hallucinatory Terrain
Range: 240'
Duration: Special
Effect: Changes or hides terrain in 240' radius
(or less)
This spell creates the illusion of a terrain fea-
ture, either indoors (such as a pit, stairs, etc.) or
outdoors (hill, swamp, grove of trees, etc.), pos-
sibly hiding a real feature. The caster could cre-
ate the illusion of solid ground over a series of
pits or quicksand pools, or he could create the
image of dense forest over his army's camp, etc.
The caster may choose to place his hallucinato-
ry terrain over a comparatively small area (for in-
stance, a throne room) or over a much larger one
(for example, a hill). If he chooses to cast the
spell on a larger terrain feature, the entire fea-
ture to be affected must be within the range of
the spell. (A hill with greater than a 480' diame-
ter would not be affected.)
The spell lasts until the illusion is touched by
an intelligent creature, or until dispelled.
Ice Storm/Wall of Ice
Range: 120'
Duration: Storm, 1 round; Wall, 12 turns
Effect: Storm in 20' x 20' x 20' volume; or Wall
of 1,200 square feet
This spell may be cast in either of two ways:
either as an icy blast, ice storm, or wall of ice.
An ice storm fills a 20' x 20' x 20' cube. If cast
in a smaller area, it will remain 20' long at most.
The storm inflicts 1d6 points of cold damage per
level of the caster to every creature in the area.
Each victim may make a saving throw vs. spells;
if he is successful, he takes only half damage.
Fire-type creatures (red dragons, flame salaman-
ders, etc.) have a — 4 penalty on their saving
throws, but cold-type creatures (frost giant, frost
salamander, etc.) are not affected by the spell.
A wall of ice is a thin vertical wall of any di-
mensions and shape determined by the spellcast-
er totalling 1,200 square feet or less (10' x 120',
30'x40', etc.). The wall is opaque and will
block sight. The wall must be cast to rest on the
ground or similar support, and cannot be cast in
a space occupied by another object.
Creatures of less than 4 Hit Dice or levels can-
not break through the wall. Creatures of 4 HD or
more levels can break through, but take 1d6
points of damage in the process. Fire-type crea-
tures each take twice the amount of damage
(2d6) while breaking through.
Massmorph
Range: 240'
Duration: See below
Effect: Causes illusion of trees within 240' range
This spell will affect up to 100 human or man-
sized creatures in a 240' diameter, making them
appear to be the trees of an orchard, dense
woods, or other large plant life appropriate to
the region. (Unless the campaign's deserts fea-
ture very large cactus, the spell won't work in the
desert.) Unwilling creatures are not affected.
Creatures larger than man-size (such as horses)
may be included, counting as two or three men
each. The illusion will hide the recipients from
creatures moving through the area affected.
The spell lasts until a dispel magic is cast on it
or until the caster decides to drop the illusion.
The appearance of each disguised creature re-
turns to normal if the creature moves out of the
affected area. However, movement within the
area does not destroy the illusion.
Polymorph Other
Range: 60'
Duration: Permanent until dispelled
Effect: Changes one living creature
This spell changes the victim into another liv-
ing creature. The new form may have no more
than twice as many Hit Dice as the original, or
the spell will fail. The victim's hit points remain
the same; an 8th level prince with 32 hit points
could end up as a frog with 32 hit points.
Unlike the polymorph self spell, the poly-
morph others spell actually turns the victim into
the new creature, giving him any and all special
abilities of the new form, plus its tendencies and
behavior. For example, a hobgoblin poly-
morphed into a mule will think and act like a
mule.
This spell cannot create a duplicate of a spe-
cific individual, only a race or monster type. For
example, a creature polymorphed into a 9th
level fighter will indeed become a human, but
not necessarily a fighter and no higher than 1st
level.
The victim of this spell may make a saving
throw vs. spells to avoid the effect. The effect
lasts until dispelled, or until the creature dies.
Polymorph Self
Range: 0 (Caster only)
Duration: 6 turns + 1 turn per level of the caster
Effect: Caster may change shapes
This spell allows the caster to change shape,
taking the physical form of another living crea-
ture. The Hit Dice of the new form must be
equal to or less than the Hit Dice of the caster, or
the spell will fail.
The caster's armor class, hit points, attack
rolls, and saving throws do not change, and he
does not gain special abilities (such as ghouls'
paralysis) or special immunities of the new form;
however, he does gain the natural physical abili-
ties of the new form. For example, a spellcaster
polymorphed into a frost giant has the strength
of a frost giant and the ability to hurl boulders,
but not immunity from cold. A spellcaster poly-
morphed into a dragon could fly but would not
be able to use any breath weapons or spells.
The spellcaster cannot cast spells while poly-
morphed into a different form. The spell lasts
for the listed duration, or until dispelled, or un-
til the caster is killed. This spell will not enable
the caster to take the form of a specific individ-
ual (see polymorph other).
Remove Curse*
Range: Touch
Duration: Permanent
Effect: Removes any one curse
This spell removes one curse, whether on a
character, item, or area. Some curses—especially
those on magical items—may only be temporari-
ly removed, at the DM's discretion, requiring a
clerical dispel evil spell for permanently remov-
ing the effects (or possibly a remove curse cast by
a high-level spellcaster).
The reverse of this spell, curse, causes a mis-
fortune or penalty to affect the recipient. Curses
are limited only by the caster's imagination, but
if an attempted curse is too powerful, it may re-
turn to the caster (DM's discretion)! Safe limits
to curses may include: - 4 penalty on attack
rolls; - 2 penalty to all saving throws; prime req-
uisite reduced to half normal. The victim may
make a saving throw vs. spells to avoid the curse.
Wall of Fire
Range: 60'
Duration: Concentration
Effect: Creates 1200 square feet of fire
This spell creates a thin vertical wall of fire of
any dimension and shape, determined by the
spellcaster, totalling 1,200 square feet (for exam-
ple, 10'x120', 20' x 60', 30'x40', etc.). The
wall is opaque and will block sight. The wall can-
not be cast is a space occupied by another object.
It lasts as long as the caster concentrates, without
moving, on it.
Creatures of less than 4 Hit Dice cannot break
through the wall. Creatures of 4 HD or more can
break through, but take 1d6 points of damage in
the process. Undead and cold-using creatures
(white dragons, frost giants, etc.) each take dou-
ble damage while breaking through.
Wizard Eye
Range: 240'
Duration: 6 turns
Effect: Creates movable invisible eye
This spell creates an invisible eye through
which the caster can see. It is the size of a real eye
and has infravision (60' range). The wizard eye
floats through the air at up to 120' per turn, but
will not go through solid objects nor move more
than 240' away from the caster. The spellcaster
must concentrate (without moving) to see
through the eye.
Fifth Level Magical Spells
Animate Dead
Range: 60'
Duration: Permanent
Effect: Creates zombies or skeletons
This spell allows the spellcaster to make ani-
mated, enchanted skeletons or zombies from
normal skeletons or dead bodies within range.
These animated undead creatures will obey the
cleric until they are destroyed by another cleric or
a dispel magic spell.
For each experience level of the cleric, he may
animate one Hit Die of undead. A skeleton has
the same Hit Dice as the original creature, but a
zombie has one Hit Die more than the original.
Note that this doesn't count character experi-
ence levels as Hit Dice: For purposes of this spell,
all humans and demihumans are 1 HD crea-
tures, so the remains of a 9th level thief would
be animated as a zombie with 2 HD.
Animated creatures do not have any spells.
but are immune to sleep and charm effects and
poison. Lawful clerics must take care to use this
spell only for good purpose. Animating the dead
is usually a Chaotic act.
Cloudkill
Range: 1'
Duration: 6 turns
Effect: Creates a moving poisonous cloud
This spell creates a circular cloud of poisonous
vapor, 30' across and 20' tall, which appears next
to the spellcaster. It moves away at the rate of 60'
(20' per round) in any one direction (with the
wind, if any; otherwise, in the direction chosen
by the caster). This cloud is heavier than air and
will sink when possible (going down holes, slid-
ing downhill, etc.). The cloud will evaporate if it
hits trees or thick vegetation. If cast in a small
area (such as in a 10' tall dungeon corridor), the
cloud may be of smaller than normal size.
All living creatures within the cloud take 1
point of damage per round. Any victim of less
than 5 Hit Dice must make a saving throw vs.
poison or be killed by the vapors.
Conjure Elemental
Range: 240'
Duration: Concentration
Effect: Summons one 16 HD elemental
This spell allows the caster to summon any one
elemental (AC -2, HD 16, Damage 3d8; see
the description of elementals in Chapter 14).
The caster can only summon one of each type of
elemental (earth, air, fire, water) in one day.
The elemental will perform any tasks within
its power (carrying, attacking, etc.) as long as the
caster maintains control by concentrating. The
caster cannot fight, cast other spells, or move
over half Normal Speed, else he will lose control
of the elemental. If he loses control, he cannot
regain it. An uncontrolled elemental will try to
slay its summoner, and may attack anyone in its
path while pursuing him.
The spell's caster may return a controlled ele-
mental to its home plane simply by concentra-
tion. A dispel magic or dispel evil spell can
return an uncontrolled elemental to its plane.
Contact Outer Plane
Range: 0 (spellcaster only)
Duration: See below
Effect: 3-12 questions may be answered
This spell allows the spellcaster to contact one
of the outer planes of existence to seek knowl-
edge from an Immortal creature—a powerful
magical being played by the DM. The wisest and
most powerful Immortals live on the most dis-
tant outer planes. However, mental contact with
an Immortal may cause a mortal to go insane.
The more distant the plane, the greater the
chance of a correct answer—but the greater the
chance of insanity as well.
The number of questions the spellcaster may
ask is equal to the "distance" to the outer plane.
"Distance" to any other plane of existence is
measured in the number of planes the character
would have to cross in order to visit that plane.
See the chart on page 264 to see where the vari-
ous planes of existence lie in relation to one an-
other. The "distance" between the Prime Plane
and the closest outer plane is 3—the Ethereal,
elemental, and Astral Planes lie "between"
them. There are many outer planes, many too
far removed to be affected by this spell.
The caster may choose the distance, up to the
maximum allowed. The DM checks the caster's
chance of insanity once, when the Immortal is
first contacted. If the caster is 21st level or
greater, the chance of insanity is reduced by 5 %
per level of the caster above 20.
Even if insanity does not result, the Immortal
may still not know the answer to the character's
questions, or may lie, at the DM's discretion. If
the DM does not wish just to decide whether the
Immortal knows or is lying, he can roll on the
chart below to determine this.
Contact Outer Plane
Distance &
Number of
Chance o f . .
Questions Insanity
Knowing
Lying*
50%
25%
5%
30%
45%
10%
40%
15%
35%
20%
40%
35%
30%
50%
25%
30%
60%
25%
70%
20%
35%
40%
80%
15%
90%
10%
45%
50%
95%
5%
* Or not knowing
The spellcaster can use this spell once a month
at most (or less often, at the DM's option). An
insane character recovers with rest, after a num-
ber of weeks of game time equal to the number
of the plane contacted.
Dissolve*
Range: 120'
Duration: 3-18 days
Effect: Liquifies 3000 square feet
This spell changes a volume of soil or rock (but
not a construction) to a morass of mud. An area
up to 10' deep or thick is affected, and may have
up to 3,000 square feet of surface area. The
magic-user may choose the exact width and
length (20' x 150', 30' x 100', etc.), but the en-
tire area of effect must be within 240' of the cast-
er. Creatures moving through the mud are
slowed to 10% of their normal movement rate at
best, and may become stuck (at the DM's discre-
tion, a victim must make saving throw vs. spells
to avoid becoming stuck).
The reverse of this spell (harden) will change
the same volume of mud to rock, but perma-
nently. A victim in the mud may make a saving
throw vs. spells to avoid being trapped in the
hardened mud.
Feeblemind
Range: 240'
Duration: Permanent until dispelled
Effect: Lowers Intelligence score to 2
This spell will only affect a magic-user, elf, or
a monster which can cast magical spells; it does
not affect those which cast only cleric or druid
spells.
It will make the victim helpless, unable to cast
spells or think clearly (as if the victim has an In-
telligence score of 2). The victim may make a
saving throw vs. spells to avoid the effect, but
with a -4 penalty to the roll.
The feeblemind lasts until removed by a dis-
pel magic spell (at normal chances for success) or
by a cleric's cureall spell.
Hold Monster*
Range: 120'
Duration: 6 turns + 1 turn per level of the caster
Effect: Paralyzes 1-4 creatures
This spell has an effect identical to that of a
hold person spell, but will affect any living crea-
ture. (It does not affect the undead.) Each victim
must make a saving throw vs. spells or be para-
lyzed. The spell may be cast at a single creature
or a group. If cast at a single creature, the victim
takes a - 2 penalty to his saving throw. If cast at
a group, it will affect 1d4 creatures (of the spell-
caster's choice, and within spell range), but with
no penalties to the saving throw.
The reverse of this spell, free monster, re-
moves the paralysis of up to four victims of hold
person or hold monster spells. It has no other ef-
fect.
Magic Jar
Range: 30'
Duration: See below
Effect: Take over one body
This spell causes the caster's body to fall into a
trance, while the caster's life force is placed in an
inanimate object (which is called a magic jar re-
gardless of its form; it does not have to be an ac-
tual jar) within range. From this object, the
caster's life force may attempt to take over any
one creature within 120' of the magic jar. If the
victim makes a successful saving throw vs. spells,
the attempt fails and the caster may not try to
take over that victim again for one turn. If the
victim fails the saving throw, the caster takes
over his body and the life force of the victim is
placed into the magic jar.
The caster may cause the body to perform any
normal actions, but not special abilities (similar
to a polymorph self effect). A dispel evil spell
will force the spellcaster's life force out of the vic-
tim's body and back into the magic jar. When
the spellcaster returns to his or her real body, the
victim's life force returns to his body and the
spell ends.
If the possessed body is destroyed, the victim's
life force dies, and the caster's life force returns
to the magic jar. From there the caster may try to
take over another body or return to the original
body.
If the magic jar is destroyed while the caster's
life force is within it, the caster is killed. If the
magic jar is destroyed while the caster's life force
is in a victim's body, the life force is stranded in
that body, and the life force of the body's origi-
nal owner is destroyed. If the caster's original
body is destroyed, his life force is stranded in the
magic jar until the caster can take over another
body!
The taking over of another body is a Chaotic
act.
Passwall
Range: 30'
Duration: 3 turns
Effect: Creates a hole 10' deep
This spell causes a hole 5' diameter, 10' deep
to appear in solid rock or stone only. The hole
may be horizontal or vertical.
The stone reappears at the end of the dura-
tion. If someone is still in the tunnel when the
stone reappears, he gets a saving throw vs. turn
to stone. If he succeeds, he is hurled out the
nearest end of the tunnel. If he fails, he is
trapped within the reappearing stone, and dies.
Telekinesis
Range: 120'
Duration: 6 rounds
Effect: 200 cn of weight per level of caster
This spell enables the spellcaster to move a
creature or object simply by concentrating. The
item may weigh up to 200 cn (20 lbs) per level of
the caster (a 10th level elf could move an object
weighing up to 2,000 cn, or 200 lbs). The caster
may move the object in any direction, at a rate of
up to 20' per round.
An unwilling victim may make a saving throw
vs. spells to avoid the effect. If he makes the roll,
he doesn't budge. If a target is being held by
someone, the holder can make a saving throw
with a — 2 penalty to retain the target item.
If the telekinesis grabs an object that is being
carried but not held in the hand, the owner may
grab for it as it is yanked away. To catch the de-
parting object, he must make a saving throw vs.
spells with a — 5 penalty.
The caster must concentrate while moving ob-
jects, and the objects will fall if the caster is dis-
turbed.
Teleport
Range: 10'
Duration: Instantaneous
Effect: Transports one creature with equipment
This spell instantly transports the spellcaster
or another recipient to any unoccupied destina-
tion on the same plane of existence. Distance
does not matter so long as the destination is on
the same plane. The recipient arrives at the des-
tination with all equipment he was carrying. An
unwilling victim can make a saving throw vs.
spell to avoid the spell effects.
The caster may not deliberately choose a desti-
nation he knows to be occupied by a solid object,
and he must choose to appear on a surface (such
as ground level or the top of a building); he can-
not choose to appear far up in the air.
Teleporting is dangerous; there is a chance the
teleporter will appear in a solid object. The tele-
porter's chance of arriving safely depends on how
carefully the caster has studied the area.
On the chart below, the DM determines how
well the caster knows the destination.
Teleport Chances
Knowledge of Destination
Result
Casual
General
Exact
01-50
01-80
Success
01-95
Too High
81-90
51-75
96-99
91-00
76-00
Too Low
"Casual Knowledge" means that the caster
has been there once or twice, or is visualizing the
aiming point from descriptions or magical
means. "General Knowledge" means the caster
has been to the area often, or has spent several
weeks studying the area magically (via crystal
ball, etc.). "Exact Knowledge" means the caster
has made a detailed personal study of the area.
Once the DM has determined how well the
character knows the destination, the DM rolls
d%. If the result is "Success," the teleporter ar-
rives exactly where the caster desired.
If the result is "Too High," the recipient ar-
rives 1d10 X 10' above the desired destination,
then falls, taking damage on impact (1d6 points
of damage per 10' fallen). (If he had already cast
a fly or levitate spell, or already had a flying de-
vice operating, he can avoid this damage.)
If the result is "Too Low," the recipient arrives
1d10 x 10' below the desired location. Any crea-
ture teleporting into a solid object is instantly
killed unless a vacant area (such as a cave or
dungeon) lies at that point (DM's discretion).
Wall of Stone
Range: 60'
Duration: Special
Effect: Creates 1000 cubic feet of stone
This spell creates a vertical stone wall exactly 2'
thick. The caster chooses the wall's dimensions
and shape, but its total area must be 500 square
feet or less (10' x 50', 20' x 25' , etc.), and the
entire wall must be within 60' of the caster.
The caster must create the wall where the wall
will rest on the ground or similar support, and
cannot create the wall in a space already occu-
pied by another object.
The wall lasts until it is dispelled or physically
broken.
If a wall of stone topples, it causes 10d10
points of damage to what it hits, and it shatters.
Woodform
Range: Touch
Duration: Permanent
Effect: Creates 1,000 cubic feet of wood
This spell creates a mass of wood equal to
1,000 cubic feet; it may be arranged in any fash-
ion the caster desires (10' x
10' x
10' block,
25'x 20'x 2' wall, etc.)
Casting time varies depending on the com-
plexity of the design. A simple wall and other
simple shapes take 1 round. A simple staircase
may take 10 rounds (1 turn). A complicated de-
sign which is supposed to adhere to very tight
specifications—such as the keel of a ship—could
take the maximum time allowable, 12 turns (2
hours) just to work up in rough form. When the
caster wants to try a complicated design, the DM
decides how long the casting will take.
The object must be created as a single piece,
with no moving parts. The original caster of the
spell may later cast woodform on an object he
has already created with the same spell, in order
to modify it for up to two hours. This is how
spellcaster artists often make fine woodcarvings,
for instance. When he is satisfied with his work,
he casts woodform on it one last time to "lock it
in place," and it may no longer be modified by
woodform spells.
The mass of wood must be created so as to rest
on the ground or similar support, and cannot be
cast in a space occupied by another object.
A caster can create his wood with one or more
rough sides, and later he or another caster can
use another woodform to create wood perfectly
joined to the first on that side—and there will be
no seam or weakness at the joining. This makes
it a good spell for creating strong ships and
wooden buildings.
The caster may decide what sort of wood is cre-
ated, within reason. The DM may refuse to allow
the caster to pick very expensive, exotic, or magi-
cal woods.
The wood created by this spell is not dispella-
ble; it lasts until broken through, burned, or de-
stroyed by spells like disintegrate.
The armor class and hit points of building ma-
terials are given in the Fortifications Table on
page 137. Based on those guidelines, a wall of
wood has an AC of -4(6) and 60 hit points per
1' thickness. Most building exterior walls would
be about 8" thick and have 40 hit points.
Sixth Level Magical Spells
Anti-Magic Shell
Range: 0 (Caster only)
Duration: 12 turns
Effect: Personal barrier which blocks magic
This spell creates an invisible barrier around
the spellcaster's body (less than an inch away).
The barrier stops all spells or spell effects, in-
cluding the caster's. The caster may destroy the
shell at will; otherwise, it lasts for the duration.
Except for a wish, no magic (including a dispel
magic spell) can cancel the barrier.
Death Spell
Range: 240'
Duration: Instantaneous
Effect: Slays 4d8 (4-32) Hit Dice of creatures
within a 60' x 60' x 60' area
This spell will affect 4d8 (4-32) Hit Dice of liv-
ing creatures within the given area. Normal
plants and insects are automatically slain, and
those with no hit points (normal insects, plants
smaller than shrub-sized, for instance) are not
counted in the total affected. Undead are not af-
fected, nor are creatures with 8 or more Hit Dice
(or levels of experience).
The lowest Hit Dice creatures are affected
first. Each victim must make a saving throw vs.
death ray or die.
Disintegrate
Range: 60'
Duration: Instantaneous
Effect: Destroys one creature or object
This spell causes one creature or nonmagical
object to crumble to dust. A victim may make a
saving throw vs. death ray to avoid the effect.
(The spell can disintegrate a dragon, a ship, or a
10' section of wall, for example.)
The spell does not affect magical items or spell
effects.
Geas*
Range: 30'
Duration: Until completed or removed
Effect: Compels one creature
This spell forces a victim either to perform or
avoid a stated action. For example, a character
may be geased to bring back an object for the
caster, to eat whenever the chance arises, or never
to reveal certain information. The action must
be possible and not directly fatal or else the geas
will return and affect the caster instead!
When the spell is first cast, the victim may
make a saving throw vs. spells to avoid the spell's
effect.
If the victim ignores the geas, penalties (de-
cided by the DM) are applied until the character
either obeys the geas or dies. Suitable penalties
include penalties in combat, lowered ability
scores, loss of spells, pain and weakness, and so
forth. Dispel magic and remove curse spells will
not affect a geas.
The geas makes the victim perform an action,
but does not make him think it is his own idea:
Once he finishes performing his task, he may de-
cide to exact revenge on the spellcaster.
The reverse of this spell, remove geas, will rid
a character of an unwanted geas and its effects.
However, if the caster is of a lower level than the
caster of the original geas, there is a chance of
failure (5% per level difference).
Invisible Stalker
Range: 0 (Caster only)
Duration: Until mission is accomplished
Effect: Summons one creature
This spell summons an invisible stalker (from
Chapter 14) which will perform one task for the
caster. The creature will serve the caster regard-
less of the time or distance involved, until the
task is completed or until the creature is slain. A
dispel evil spell will force the creature to return
to its home plane.
Lower Water
Range: 240'
Duration: 10 turns
Effect: Cuts depths to half normal
This spell causes a body of water to lower to
half its normal depth. It will affect an area up to
10,000 square feet (width and length). If cast on
a constantly-renewed source of water (such as a
river or ocean), it lowers that area of water for the
entire duration of the spell (or until it is dis-
pelled); surrounding water does not rush in until
the spell is ended. If cast around a boat or ship,
the vessel may become stuck.
At the end of the spell's duration, the sudden
rush of water filling the "hole" will sweep a
ship's deck clear of most items (and people who
fail their saving throws vs. spells) and cause
1d12 + 20 (21-32) points of hull damage.
This spell can turn a rampaging river into a
river which the heroes' party can ford, can cause
some pools to lower far enough for the adventur-
ers to see what's deeper in them, etc. If cast
around a boat or ship, this spell may cause the
bay or river to drop enough for the vessel to be-
come stuck.
Move Earth
Range: 240'
Duration: 6 turns
Effect: Moves soil
This spell causes soil (but not rock) to move.
The caster can use the spell to move earth hor-
izontally to make a hill, or vertically, to open a
large hole (one up to 240' deep, unless it reaches
solid rock). The spell moves the soil at up to 60'
per turn, and at the end of the spell duration,
the moved soil remains where it is put. This spell
is helpful for constructing castles.
Projected Image
Range: 240'
Duration: 6 turns
Effect: Creates one image
This spell creates an image of the caster up to
240' away; the image will last without concentra-
tion. The projected image cannot be distin-
guished from the original except by touch. Any
spell the spellcaster casts will seem to come from
the image, but the caster must still be able to see
the target.
Spells and missile attacks will not appear to af-
fect the image. If the image is touched or struck
by a hand-to-hand weapon, it disappears.
Reincarnation
Range: 10'
Duration: Permanent
Effect: Creates a new body
To cast this spell, the magic-user must have a
part (however small) of a dead body. The spell
magically creates a new body, and the life force
which was once in the dead body returns and in-
habits the new one. The DM can choose what
sort of body is created, or can refer to the tables
below to decide.
If the life force is reincarnated as a different
race, all details of the new race apply, instead of
the old. For example, a cleric reincarnated as an
elf is no longer a cleric, but is able to cast magic-
user spells and fight as an elf.
The victim's level of experience does not
change unless restricted by the maximum for
demihumans. If the victim is reincarnated in a
monster body, the victim's alignment helps de-
termine the type of monster which appears; a
character will not be reincarnated in the body of
a monster that cannot have his alignment. A
monster body may not gain levels of experience;
the character must play as the reincarnated crea-
ture, or retire from play, or (perhaps) be reincar-
nated again when slain.
Reincarnation Results
Type of Body Appearing (Roll 1d8)
1 Human
5 Elf
6 Halfling
2 Human
7 Original race
3 Human
8 Monster
4 Dwarf
(see below)
Type of Monster Body Appearing (Roll 1d6)
1d6 Lawful
Neutral
Chaotic
Ape, White Bugbear
1 Blink Dog
Bear*
2 Gnome
Gnoll
Kobold
3 Neanderthal Centaur
4 Owl, giant
Griffon
Manticore
Lizard Man Orc
5 Pegasus
Troglodyte
6 Treant
Pixie
* Any normal bear
The DM may add more monsters to the lists.
Such monsters should have 8 Hit Dice or less and
should be at least semi-intelligent.
Stone to Flesh*
Range: 120'
Duration: Permanent
Effect: One creature or object
This spell turns any one statue (or quantity of
stone up to 10' x 10' x 10') to flesh. It is usually
used to restore a character turned to stone (by
gorgon breath, for example).
The reverse of this spell, flesh to stone, will
turn one living creature, including all equip-
ment carried, to stone. The victim may make a
saving throw vs. turn to stone to avoid the effect.
Stoneform
Range: Touch
Duration: Permanent
Effect: Creates 1,000 cubic feet of stone
This spell creates a mass of stone equal to
1,000 cubic feet; it may be arranged in any fash-
ion the caster desires (10'x 10' x 10' block,
25'x 20'x 2'wall, etc.).
Casting time varies depending on the com-
plexity of the design. A simple wall and other
simple shapes take 1 round. A simple staircase
may take 10 rounds (1 turn). A complicated de-
sign meant to adhere to very tight
specifications—such as an ornate fountain or
statue—could take the maximum time allowa-
ble, 12 turns (2 hours), just to work up in rough
form. When the caster wants to try a compli-
cated or unusual design, the DM decides how
long the casting will take.
The object must be created as a single piece,
with no moving parts. The original caster of the
spell may later cast Stoneform on an object he
has already created with the same spell in order
to modify it for up to two hours. This is how
magic-user artists often make fine statues, for in-
stance. When he is satisfied with his work, the
magic-user casts Stoneform on it one last time to
"lock it in place," and it may no longer be modi-
fied by Stoneform spells.
The mass of stone must be created to rest on
the ground or similar support, and cannot be
cast in a space occupied by another object.
A caster can create his stone with one or more
rough sides, and later he or another caster can
use another Stoneform to create stone joined to
the first on that side—and there will be no seam
or weakness at the joining. This makes it a good
spell for creating strong walls and gigantic
buildings—colisea, palaces, etc.
The caster may decide what sort of stone is cre-
ated, within reason. The DM may refuse to allow
the caster to pick very expensive, exotic, or magi-
cal stones. Valuable jade, for instance, is an in-
appropriate choice. However, a caster can choose
such stones as clear lead crystal, and so make
thick, strong, perfect windows with this spell.
The stone is not dispellable; it lasts until bro-
ken or destroyed by spells like disintegrate.
The armor class and hit points of building ma-
terials are given on the Fortifications Table on
page 137. In general, from those guidelines,
stone walls have an AC of -4(6) and 100 hit
points per 1' thickness; doing 500 hit points of
damage to a 5' wall will definitely knock a hole
in it. Building exterior walls tend to be about 7"
thick and have 60 hit points.
Wall of Iron
Range: 120'
Duration: Permanent
Effect: Creates 500 square feet of iron
This spell creates a vertical wall of iron exactly
2' thick. The magic-user may choose any length
and width, but the total area must be 500 square
feet or less (10' x 50', 20' x 25' , etc.), and the
entire wall must be within 120' of the caster. The
caster must create the wall so it rests on the
ground or similar support. It cannot be cast in a
space occupied by another object. It lasts until
dispelled, disintegrated, or physically broken
(though it will resist all but giant-sized physical
attacks). Most other spell effects, including fire-
ball, lightning bolt, etc., have no effect on a wall
of iron. If the wall is made to topple, it causes
10d10 (10-100) points of damage to whatever it
hits, and shatters.
If the wall is attacked, it has a number of hit
points equal to the level of the caster. A rust
monster can destroy a wall of iron with a single
touch. Otherwise, the wall can only be damaged
by battering; see Chapter 9 (page 118) for more
on battering attacks.
Weather Control
Range: 0 (magic-user only)
Duration: Concentration
Effect: All weather within 240 yards
This spell allows the magic-user to create one
special weather condition in the surrounding ar-
ea (within a 240 yard radius). The spellcaster
may select the weather condition. The spell only
works outdoors, and the weather will affect all
creatures in the area (including the caster). The
effects last as long as the spellcaster concentrates,
without moving; if the caster is being moved (for
example, aboard a ship), the effect moves also.
The spell's effects vary, but the following results
are typical:
Rain: - 2 penalty to attack rolls applies to all
missile fire. After three turns, the ground be-
comes muddy, reducing movement to half the
normal rate.
Snow: Visibility (the distance a creature can
see) is reduced to 20'; movement is reduced to
half the normal rate. Rivers and streams may
freeze over. Mud remains after the snow thaws,
for the same movement penalty.
Fog: 20' visibility, half normal movement.
Those within the fog might become lost, moving
in the wrong direction.
Clear: This cancels bad weather (rain, snow,
fog) but not secondary effects (such as mud).
Intense Heat: Movement reduced to half nor-
mal. Excess water (from rain, snow, mud trans-
muted from rock, etc.) dries up.
High Winds: No missile fire or flying is possi-
ble. Movement reduced to half normal. At sea,
ships sailing with the wind move 50% faster. In
the desert, high winds create a sandstorm, for
half normal movement and 20' visibility.
Tornado: This creates a whirlwind under the
magic-user control, attacking and moving as if it
was a 12 HD air elemental. At sea, treat the tor-
nado as a storm or gale.
Seventh Level Magical Spells
Charm Plant
Range: 120'
Duration: 6 months (see below)
Effect: Charms one tree or more smaller plants
Similar to a charm person spell, this effect
causes one tree, six medium-sized bushes, 12
small shrubs, or 24 small plants to become
friends of the magic-user (no saving throw).
However, a plant-like monster (treant, shrieker,
etc.) may make a saving throw vs. spells to resist
the effect.
The charmed plants will understand and obey
all commands of the magic-user, as long as the
tasks are within their ability (including the en-
tangling of passers-by within range, but not in-
cluding movement, sensing alignment, etc.).
The plants will remain charmed for six months,
until the charm is dispelled, or until winter
(when they sleep). (This spell is quite useful
around a stronghold, both inside and out, espe-
cially when used after a 4th level growth of
plants spell, and possibly a permanence as well.)
Create Normal Monsters
Range: 30'
Duration: 1 turn
Effect: Creates 1 or more monsters
This spell causes monsters to appear out of
thin air. All monsters appearing will understand
and obey the caster's commands—fighting, car-
rying or fetching things, etc. They will faithfully
obey all commands to the best of their abilities.
Each monster will appear carrying its normal
weapons and wearing its normal armor (if any),
but arrives otherwise unequipped. At the end of
one turn, all the monsters created vanish back
into thin air, along with all their equipment. (If
a monster has dropped a weapon while fighting
and then vanishes, the weapon disappears, too.)
The total number of Hit Dice of monsters ap-
pearing is equal to the level of the magic-user
casting the spell. (If the spellcaster's level is not
an exact multiple of the monsters' Hit Dice,
drop all fractions). The magic-user may choose
the exact type of monsters created, but he must
select only monsters with no special abilities
(i.e., no asterisk next to the Hit Die number in
the monster explanation). This spell does not
create humans, demihumans, or undead. Crea-
tures of 1-1 Hit Dice are counted as 1 Hit Die;
creatures of 1/2 Hit Die or less are counted as 1/2
Hit Die each.
Example: With this spell, a 15th level caster
could summon 30 giant bats, rats, or kobolds
(1/2 Hit Die monsters); or 15 goblins, orcs, or
hobgoblins (1 Hit Die monsters); or 7 rock ba-
boons, gnolls, or lizard men (2 Hit Die mon-
sters); or 5 boars, draco lizards, or bugbears (3
Hit Die monsters); or 3 black bears, panthers, or
giant weasels (5 Hit Die monsters); and so forth.
Delayed Blast Fireball
Range: 240'
Duration: 0 to 60 rounds
Effect: Delayed blast fireball of 20' radius
As the name implies, this is a fireball spell
whose blast can be delayed; it behaves like a
time bomb. When he casts the spell, the magic-
user states the exact number of rounds of delay
(from 0 to 60) until the spell detonates. A small
rock, very similar in appearance to a valuable
gem, then shoots out toward the desired loca-
tion, and remains at that location until the
stated delay elapses. The "gem" may be picked
up, carried, and so forth.
When the stated duration ends, it explodes in
an effect identical to a normal fireball—a sud-
den instantaneous explosion inflicting 1d6
points of damage per level of the caster to all
within the area of effect (a sphere of 20' radius).
Each victim may make a saving throw vs. spells
to take half damage.
Once the spell has been cast, the explosion
cannot be hurried nor further delayed, except
with a wish. The "gem" created is pure magic,
not an actual object, and cannot be moved magi-
cally (by telekinesis, teleport, etc.); however, it
can be dispelled.
Ironform
Range: Touch
Duration: Permanent
Effect: Creates 500 square feet of iron
This spell creates a wall of iron 2" thick (or
less) with an area equal to 500 square feet; it may
be arranged in any fashion the caster desires
(10'x 50' wall, or 25' X 20' wall, etc.)
Casting time varies depending on the com-
plexity of the design. A simple wall and other
simple shapes take 1 round. A simple staircase
may take 10 rounds (1 turn). A complicated de-
sign which is supposed to adhere to very tight
specifications—such as a giant portcullis—could
take the maximum time allowable, 12 turns (2
hours) just to create in rough form. When the
caster wants to try a complicated or unusual de-
sign, the DM decides how long the casting will
take.
The object must be created as a single piece,
with no moving parts. The original caster of the
spell may later cast ironform on an object he has
already created with the same spell, in order to
modify it for up to two hours. This is how magic-
user artists often make fine iron statues, for in-
stance. When he is satisfied with his work, he
casts ironform on it one last time to "lock it in
place," and it may no longer be modified by
ironform spells.
The iron wall must be created to rest on the
ground or similar support, and cannot be cast in
a space occupied by another object. Unlike the
metal created by the wall of iron spell, it does
not have to be created in a vertical position.
A caster can create his iron with one or more
tough sides, and later he or another caster can
use another ironform to create iron joined to the
first on that side—and there will be no seam or
weakness at the joining. This makes it a good
spell for creating iron reinforcements for walls.
The iron so created is not dispellable; it lasts
until broken or destroyed by spells like disinte-
grate or creatures such as rust monsters.
The armor class and hit points of building ma-
terials are given in the Fortifications Table on
page 137. Following these general guidelines,
we find that an iron wall will have an AC of —
10(2) and about 15 hit points per 1" thickness.
Lore
Range: 0 (magic-user only)
Duration: Permanent
Effect: Reveals details of 1 item, place, or person
By means of this spell, the magic-user may
gain knowledge of one item, place, or person. If
the caster holds the item being studied, the spell
takes 1d4 turns to complete, and the magic-user
learns the item's name, method of operation and
command words (if any), and approximate num-
ber of charges (if any, within five of the correct
number).
If the item has more than one mode of opera-
tion, or more than one command word, only one
function will be revealed for each lore spell used,
and the spell will not even hint that the object
has any other functions.
If the spell is being used to investigate a place
or person, or an item which the caster is not
holding, the spell may take 1d100 days to com-
plete. A purely legendary topic should require
large amounts of time, and the information
gained may be in the form of a riddle or poem.
The Dungeon Master should reveal only general
details if the place is large, or if the person is of
great power.
Magic Door*
Range: 10'
Duration: 7 uses
Effect: Creates one passage
This spell may be cast on any wall, floor, ceil-
ing, or section of ground. It creates a magical,
invisible doorway that only the spellcaster may
use. It also creates a passage through up to 10' of
non-living solid material beyond the doorway it-
self. It cannot be created in a living object of any
kind. The door is undetectable except by a de-
tect magic spell, and cannot be destroyed except
by a dispel magic spell (at normal chances for
success).
The magic door lasts until dispelled, or until it
has been used seven times. Note that each one-
way passage through the door is counted as a
separate use.
The reverse of this spell, magic lock, is a pow-
erful version of the 2nd level wizard lock spell,
but cannot be affected by a knock spell or by the
effects of any magical item. The magic lock
causes any one portal to become totally impass-
able as long as the magic remains; only the spell-
caster can use the portal. The spell can affect an
empty 10' X 10' portal-like area (such as an emp-
ty doorway). The locked portal does not change
in appearance. As with a magic door, the en-
chantment remains until the portal has been
used seven times or until removed by a dispel
magic spell.
Mass Invisibility*
Range: 240'
Duration: Permanent until broken
Effect: Creatures or objects in 60' square area
This bestows invisibility (as the 2nd level
spell) on several creatures. All the recipients
must be within an area 60' square within 240' of
the magic-user. The spell will affect up to 6
dragon-sized creatures, or up to 300 man-sized
creatures. After the spell is cast, each creature
becomes invisible, along with all equipment it
carries (as per the invisibility spell, above). An
invisible creature will remain invisible until he or
she attacks or casts any spell.
The reverse of this spell, (appear), will cause
all invisible creatures and objects in a
20' x 20' x 20' volume to become visible. Crea-
tures on the Astral and Ethereal planes are not
within the area of effect; the spell cannot reach
across planar boundaries. All other forms of in-
visibility are affected, both magical and natural,
and all victims of this spell cannot become invisi-
ble again for one full turn.
Power Word Stun
Range: 120'
Duration: 2d6 or 1d6 turns
Effect: Stuns 1 creature of 70 hp or less
This lets the caster stun one victim within 120'
(no saving throw). A victim with 1-35 hit points
is stunned for 2d6 turns; a victim with 36-70 hit
points is stunned for 1d6 turns. No creature with
71 or greater hit points is affected.
Reverse Gravity
Range: 90'
Duration: 1/5 round (2 seconds)
Effect: Causes victims in a 30' cubic volume to
fall upward
This spell affects all creatures and objects
within a cubic volume 30'x 30'x 30', causing
them to "fall" in a direction opposite the nor-
mal gravity. In two seconds, creatures and objects
can "fall" a maximum of 65'. No saving throw is
allowed, and all victims hitting a ceiling or other
obstruction take 1d6 points of damage per 10'
"fallen." Note that after the two seconds have
elapsed, gravity returns to normal and all victims
will fall back to their original places, suffering
more falling damage. The DM should make a
morale check for each NPC victim of this spell.
Example: A magic-user casts this spell at a
group of approaching giants in a 40' tall room.
The giants "fall" to the ceiling and then back to
the floor, each taking a total of 8d6 points of
damage in the process: 4d6 from "falling" up
and hitting the ceiling, and another 4d6 from
falling back down to the floor.
Statue
Range: 0 (Magic-user only)
Duration: 2 turns per level of the caster
Effect: Allows caster to turn to stone
This allows the magic-user to change into a
statue, along with all nonliving equipment he
carries, up to once per round (to or from statue
form) for the duration of the spell. The caster
can concentrate on other spells while in statue form, though he can cast no new spells while in
this form. Although this spell does not give him
immunity to "turn to stone" effects (from a gor-
gon's attack), the caster may simply turn back to
normal one round after becoming petrified.
While in statue form, the magic-user is armor
class -4, but cannot move. He cannot be dam-
aged by cold or fire (whether normal or magical)
or by normal weapons. He does not breathe, and
is thus immune to all gas attacks, drowning, etc.
Magical weapons and other spells (such as light-
ning bolt) inflict normal damage on him. If a
fire or cold spell is cast at the magic-user while in
normal form, the character need only win initia-
tive (with a + 2 bonus) to turn into a statue be-
fore the attacking spell strikes.
Summon Object
Range: Infinite
Duration: Instantaneous
Effect: Retrieves one object from caster's home
By means of this spell, the magic-user can
cause one nonliving object to leave the spellcast-
er's home and appear in his hand. The object
must weigh no more than 500 cn (50 pounds),
and may be no bigger than a staff or small chest.
The spellcaster must be very familiar with the
item and its exact location, or the spell will not
work. The caster must also have prepared the
item beforehand by sprinkling it with a special
powder that costs 1,000 gold pieces per item pre-
pared; the powder becomes invisible and does
not interfere with the item in any way. The spell
cannot summon items that have not been pre-
pared in this fashion.
If the magic-user prepares a chest for use with
this spell, fills the chest with weapons and magi-
cal items, and then later tries to summon it to
him, the chest appears—empty. All its contents
stay behind, where the chest originally stood,
since they have not been magically prepared for
use with the spell, and since the spell can sum-
mon only one prepared object at a time.
If another being possesses the item summon-
ed, it will not appear, but the caster will know
approximately who and where the possessor is.
The magic-user may use this spell from any lo-
cation, even if the item summoned is on another
plane of existence.
Sword
Range: 30'
Duration: 1 round per level of the caster
Effect: Creates a magical sword
When this spell is cast, a glowing sword made
of magic, rather than metal, appears next to the
caster. The magic-user may cause it to attack any
creature within 30', simply by concentrating; the
sword flies to the target and attacks. If the cast-
er's concentration is broken, the sword merely
stops attacking. It remains in existence for one
round per level of the spellcaster.
The sword moves very quickly, attacking twice
per round and making its attack rolls at the cast-
er's level. Damage is the same as a two-handed
sword (1d10), but this magical creation is capa-
ble of hitting any target (even those hit only by
powerful magical weapons).
The sword cannot be destroyed before the du-
ration ends, except by a dispel magic spell effect
(at normal chances of success) or a wish.
Teleport Any Object
Range: Touch
Duration: Instantaneous
Effect: Causes 1 object to teleport
This spell is similar to the 5th level teleport
spell, but nonliving objects can be affected. Af-
ter casting this spell, the spellcaster may touch
one creature or object and cause it to teleport.
The normal chance of error apply (see the de-
scription of the teleport spell above) an object
appearing too high will fall and probably break,
while one appearing too low will be destroyed
instantly. If the spellcaster uses this spell to tele-
port himself, there is no chance for error. The
caster may not deliberately choose a destination
occupied by a solid object or in open air above
the ground.
The maximum weight affected is 500 cn (50
pounds) per level of the caster. If an object is a
solid part of a greater whole (such as a section of
wall), the spell will teleport a maximum of one
10' x 10' x 10' cube of material. If the caster is
trying to teleport a creature that weighs more
than the spell allows, the spell fails.
If another creature holds or carries the item
which the caster is trying to teleport, the creature
may make a saving throw vs. spells (with a —2
penalty). If the saving throw is successful, the
teleport fails.
If the caster touches another creature, the tar-
get creature may make a saving throw vs. spells
(if so desired) to avoid being teleported, but
with a -2 penalty to the roll.
Eighth Level Magical Spells
Clone
Range: 10'
Duration: Permanent
Effect: Grows one duplicate creature from a
piece of the original creature
A clone is an exact duplicate of another living
creature, grown from a piece of the original
through the use of this spell. The piece need not
be alive at the time the spell is cast.
A human or demihuman clone is rare and may
be very dangerous. A clone of any other living
creature is a more common thing called a simula-
crum. A character can have only one clone at a
time; attempts at making multiple clones of a
single character automatically fail. Undead and
constructs cannot be cloned, because they are
not living creatures. (You could clone someone
from flesh taken before that person became un-
dead, but he would not be subject to the effects
described below for situations where two exam-
ples of the same person exist.)
Human and demihuman clones: To create a
human or demihuman clone, this spell must be
cast on one pound of the person's flesh. This
spell requires the caster to use up other materials
costing 5,000 gold pieces per Hit Die of the orig-
inal. The clone awakens only when fully grown;
this takes one week per Hit Die of the clone.
When completed, the clone is not magical and
cannot be dispelled.
If the human or demihuman original is not
alive when the clone awakens, the clone has all
the features, statistics (abilities), and memories
possessed by the original at the time the flesh
was taken. This is a very important point. For ex-
ample, a 20th level magic-user might leave a
pound of flesh with a scroll of this spell, so that
he might be restored if lost; but if the character
gains another ten levels of experience and then
dies, the clone will be the younger, less-
experienced, 20th level form.
If a clone duplicates a person still living, or if
the original person regains life, a very hazardous
situation develops. Each form instantly becomes
aware of the other's existence. A partial mind-
link exists between them; each can feel the oth-
er's emotions (but no other thoughts). If either
one is damaged, the other takes the same dam-
age (but may make a saving throw vs. spells to
take half damage). This effect does not apply to
charm, sleep, cures, or other effects that do not
cause damage.
The clone is immediately obsessed with the
need to destroy its original and will do anything
to accomplish this. From the time a clone be-
comes aware of its original, it has one day per
level of its creator (i.e., the caster of the clone
spell) to kill the original.
Example: A 25th level fighter dies. His friend
the 34th level magic-user, who possesses a pound
of the fighter's flesh for this precise purpose,
clones him. Then someone else raises the fighter
from the dead. The clone becomes aware of his
original and is compelled to kill him. He has 34
days to do so—one day for every experience level
of his creator.
If the clone succeeds in killing its original, it
can continue with its life normally; but if it fails
and does not immediately die, it becomes in-
sane.
When a clone goes insane, the original crea-
ture permanently loses one point of Intelligence
and one point of Wisdom. The original may also
thereafter become insane (5% chance per day,
not cumulative). If this occurs, the victim and
the clone die one week later, both forever dead
and unrecoverable even with a wish.
Special Note: If the original and the clone are
kept on different planes of existence, no mind-
link occurs, and the clone is not compelled to kill
its original. No ill effects occur, and the two re-
main completely unaware of their situation. If
they ever occupy the same plane, the mind-link
occurs and cannot be broken thereafter except by
the destruction of the clone or its original.
Other clones: A clone of any other living crea-
ture (not a human or demihuman) is called a
simulacrum. One percent of the original's flesh
is needed, and the cost of other materials is 500
gold pieces per hit point of the original. As with
a normal clone, the time required to grow a sim-
ulacrum is one week per Hit Die of the original.
A simulacrum always obeys its creator (the
spellcaster). It understands all the languages
spoken by the caster. Within a range of 10' per
level of the caster, it can receive mental com-
mands if the creator concentrates on sending
them.
A simulacrum is an enchanted monster. It can
be blocked by a protection from evil spell and is
magical; a dispel magic spell can (subject to nor-
mal chances of failure for that spell) cause it to
vanish without a trace.
The simulacrum's alignment is the same as
that of the spellcaster, regardless of the original
creature's alignment. Its armor class, movement
rate, morale, and number of attacks are the same
as the original's.
A simulacrum has only 50% of the original's
Hit Dice, hit points, and damage per attack. The
DM rolls dl00 for each special ability; it is present
in the simulacrum if the result is 01-50. However,
a freshly grown simulacrum never has any of the
spells or spell-like abilities of the original.
If the original creature is alive, the simula-
crum does not grow beyond this point. If the
original creature dies (or is already dead), the
simulacrum continues to increase in abilities,
gaining an additional 5% per week to a maxi-
mum of 90% of the original's statistics. When
complete, the DM rolls again to see which spe-
cial abilities previously missing are gained, in-
cluding spells and spell-like abilities (using the
90% chance for each; all may be present).
Create Magical Monsters
Range: 60'
Duration: Two turns
Effect: Creates one or more monsters
This spell is similar to the 7th level create nor-
mal monsters spell, except that it can create
monsters with some special abilities (up to two
asterisks). The range and duration are double
those of the lesser spell. All other details are the
same: the creatures are chosen by the caster, ap-
pear out of thin air, and vanish at the end of the
spell duration.
The total number of Hit Dice of monsters ap-
pearing is equal to the level of the magic-user
casting the spell (again, dropping fractions if the
caster's level is not an exact multiple of the crea-
tures' Hit Dice). The spell does not create hu-
mans or demihumans, but can create undead.
Creatures of 1-1 Hit Die count as 1 Hit Die; crea-
tures of 1/2 Hit Die or less count as 1/2 Hit Die
each.
Special Note: This spell can create a construct
(as defined in Chapter 14) if the spellcaster uses
the materials normally required for the con-
struct's creation. Only one construct will appear,
regardless of the caster's Hit Dice; but it is per-
manent, and does not vanish at the end of the
spell duration—though it still may be dispelled
at normal chances of success. This construct may
have only two asterisks (special abilities) or less;
see Chapter 14 for lists of the known types of
constructs and the number of special abilities
they have. The cost of materials is a minimum of
5,000 gold pieces per asterisk (or more, depend-
ing on your campaign). Chapter 16 contains
more rules for enchanting magical items (includ-
ing constructs), and has suggestions regarding
nondispellable constructs.
Dance
Range: Touch
Duration: 3 or more rounds
Effect: Causes 1 victim to dance
This spell causes one victim to prance madly
about, performing a jig or other dance, for 3 or
more rounds. The magic-user must touch the
victim for the spell to take effect (a normal attack
roll). The victim gets no saving throw, and can-
not attack, use spells (or spell-like abilities), or
flee. While dancing, the victim suffers a — 4
penalty to his saving throws, and a +4 penalty
to his armor class.
The duration is three rounds for a caster of
18th to 20th level; four rounds for levels 21-24,
five rounds at levels 25-28, six rounds at levels
29-32, and seven rounds at levels 33-36.
Explosive Cloud
Range: 1'
Duration: 6 turns
Effect: Creates a moving poisonous cloud
This spell creates an effect which looks identi-
cal to the 5th level cloudkill spell (a 20' tall cloud
of greenish gas 30' in diameter appearing next to
the caster). The cloud is only mildly poisonous;
all victims within it must make a saving throw vs.
spells or be paralyzed that round. Each victim
within the cloud makes a new saving throw each
round.
The cloud is filled with sparkling lights (visi-
ble only to those within it), which are small ex-
plosions. Each round, all those within the cloud
take damage from the explosions, with no saving
throw allowed. This damage is 1 point for each
two levels of experience of the magic-user,
rounded down (9 points at 18th or 19th level, 10
points at 20th or 21st level, etc.). This explosive
damage will affect any creature, including those
immune to fire, gas, electricity, and other special
attacks.
Force Field
Range: 120'
Duration: 6 turns
Effect: Creates an invisible barrier
This spell creates an invisible, immovable bar-
rier or object of pure force. It has almost no
thickness, but cannot be broken or destroyed by
any means except a disintegrate spell or a wish;
even a dispel magic spell cannot affect it. A force
field's shape is limited to a sphere, hemisphere,
a flat surface, a cylinder, a square or rectangular
box with flat sides, or part of such a box. The
sphere's radius can be a maximum of 20'. The
flat surface or combinations thereof may be up
to 5,000 square feet in total area. The force field
cannot be irregular in shape, and its surface must
be perfectly smooth. It can be as small as the
caster desires.
The force field will not appear within any
solid or creature. Any part of it that would do so
will not appear, leaving a hole in the force
field—normally, a hole large enough for the vic-
tim to escape through. Furthermore, the edges
of the field are blunt and cannot cause damage
in any way. The force field will stay where it is
put until it disappears, and cannot be moved by
any means but a wish.
Creature(s) completely enclosed by a sealed
force field will not starve, suffer from lack of air,
or otherwise be harmed by the encasement. A
sealed force field magically preserves any within
it from natural death. This does not prevent
damage or death from attacks by others within
the force field.
Nothing can pass through a force field. Spells,
missiles, blows, breath weapons, and all other
attack forms merely bounce off it. However, a
teleport or dimension door spell can bypass it;
these spells allow the caster to travel into or out
of the field without harming the field. The force
field exists only on one plane of existence. Thus,
planar travel (via gate or other means) can also
bypass it.
Though most often used as a barrier or cage, a
force field can easily be used to create an invisi-
ble floor, stairway, chair, or other object. A force
field can be made permanent, but the perma-
nence spell is still subject to dispel magic, and if
removed, the force field disappears immediately.
Even if treated with a permanence spell, a force
field will always vanish if struck by a disintegrate
spell or wished away.
Mass Charm*
Range: 120'
Duration: Special (as charm person spell)
Effect: 30 Levels of creatures
This spell creates the same effect as a charm
person or charm monster spell, except that the
spell affects 30 levels (or Hit Dice) at once. Each
victim may make a saving throw vs. spells to
avoid the charm, but with a -2 penalty to the
roll. The spell will not affect a creature of 31 or
more levels or Hit Dice.
The duration of each charm is determined by
the victim's Intelligence (see charm person,
above). If the magic-user attacks one of the
charmed victims, only that one creature's charm
is automatically broken. Any other charmed
creatures seeing the attack may make another
saving throw, but other creatures' charms are not
affected.
The reverse of this spell, remove charm, will
unfailingly remove all charm effects within a
20' x 20' x 20' volume. It will also prevent any
object in that area from creating charm effects
for one turn.
Mind Barrier*
Range: 10'
Duration: 1 hour per level of the caster
Effect: Protects against mind-affecting spells and
items
This spell affects one creature; an unwilling
recipient may make a saving throw vs. spells to
avoid the effect.
The spell prevents any form of ESP, clairvoy-
ance, clairaudience, crystal ball gazing, or any
other form of mental influence or information
gathering (such as by a contact higher plane or
summon object) from working on the target
creature. The caster or recipient simply does not
exist for the purposes of those and similar spell
effects for the duration of the mind barrier spell.
In addition, the recipient gains a bonus of +8
to saving throws against mind-influencing at-
tacks, such as all forms of charm, illusion and
phantasms, feeblemind, and the like. (However,
a roll of 1 always fails the saving throw, regard-
less of adjustments.)
The reverse of this spell, open mind, causes
the victim touched to be vulnerable to all the
mind-influencing attacks given above. All the
victim's saving throws against such effects are pe-
nalized by - 8 for the duration of the spell. This
reversed spell must be cast by touch, requiring a
normal attack roll.
Permanence
Range: 10'
Duration: Permanent until dispelled
Effect: Causes one magical effect to become per-
manent
By means of this spell, the magic-user can
cause one other magic-user spell effect of 7th
level or less to become permanent. This spell will
not make permanent any spell which has an "in-
stantaneous" or "permanent" duration (such as
dispel magic, fireball, lightning bolt, etc.); cleri-
cal spells and 8th or 9th level magic-user spells
also cannot be made permanent.
The DM can declare that the permanence
spell will not work with any other specific spell.
Whenever a character wishes to cast the spell, the
DM should carefully consider whether perma-
nence will affect the other spell. Certain spell
combinations could seriously affect a campaign's
game balance, and the DM should carefully reg-
ulate all uses of this spell.
A permanence spell lasts until dispelled by a
dispel magic spell from either the caster or some
higher-level spellcaster (at normal chances for
success). When the permanence spell is dis-
pelled, the other spell effect vanishes immedi-
ately.
Except for weapons, an item can only receive
one permanence spell, and a creature can receive
two at most. If a permanence spell is cast on an
item or area that already has one in effect (or a
creature which already has two, or a weapon
which already has five), both permanence spells
automatically fail. A weapon may have up to five
permanent effects, but a 25% (noncumulative)
chance of failure applies to each permanence af-
ter the first. Furthermore, if the permanence
fails, it destroys the weapon completely.
Some spells used on a creature that are com-
monly made permanent are: detect magic, pro-
tection from evil, read languages, read magic,
detect invisible, and fly. Some spells commonly
made permanent on areas are light, phantasmal
force, confusion, and cloudkill.
A magic-user does not need a permanence
spell to make any permanent magical item. Us-
ing permanence to bind a spell to an object is not
the same as enchanting the object. Enchanted
objects are more durable and permanent than
objects which have merely had spells perma-
nently placed upon them.
Polymorph any Object
Range: 240'
Duration: See below
Effect: Changes form of one object or creature
This spell is similar to the 4th level polymorph
others spell, except that it will affect objects as
well as creatures. If the object is part of a greater
whole (such as a section of wall), the spell will
affect up to a 10' x 10' X 10' volume. A creature
may avoid the effects if it successfully makes a
saving throw vs. spells at a -4 penalty to
the roll.
The duration of the polymorph depends on
the degree of the change. There are three basic
kingdoms of all things—animal, vegetable, and
mineral. If an object is polymorphed to one of a
nearby kingdom (animal-vegetable, vegetable-
mineral) the spell's duration is one hour per level
of the caster. If the change is from animal to
mineral (or the reverse), it lasts for one turn per
level of the caster. If no change in kingdom oc-
curs (for example, if a creature is polymorphed
into some other creature), the change is perma-
nent until removed by a dispel magic spell (at
normal chances for success).
Note that creatures created by means of this
spell are not automatically friendly. A poly-
morph cannot affect a creature's age or hit
points. (See the 4th level polymorph self and
polymorph others spells for other guidelines.)
This spell will not affect a creature which has
more than 2 x the spellcaster's experience levels
in Hit Dice. For example, a 20th level magic-
user cannot affect a creature with 41 or more Hit
Dice.
Power Word Blind
Range: 120'
Duration: 1-4 days or 2-8 hours (see below)
Effect: Blinds 1 creature with 80 hit points or less
With this spell, the caster may blind one vic-
tim within 120' (no saving throw). A victim with
1-40 hit points is blinded for 1d4 days; one with
41-80 hit points is blinded for 2d4 hours. The
spell does not affect creatures with 81 or more hit
points.
A blinded victim suffers penalties of — 4 on all
saving throws and +4 on armor class. A cleric's
cure blindness or cureall spell will not remove
this blindness unless the cleric is of a level equal
to or higher than the caster of the power word
blind.
Steelform
Range: Touch
Duration: Permanent
Effect: Creates up to 500 square feet of steel
This spell is effectively identical to the 7th
level ironform spell. However, the material cre-
ated is of weapon-quality; a swordmaker with
this spell could cast the spell and create a finely-
crafted, high-quality sword in 12 turns (two
hours) or less.
Following the same general guidelines as iron-
form, a steel wall will have an AC of — 10(2) and
about 20 hit points per 1" thickness.
Symbol
Range: Touch
Duration: Permanent
Effect: Creates one magical rune
This spell creates a written magical drawing (a
"rune") of great power. There are six kinds of
symbols; the caster must select one when the
spell is memorized. The rune may be placed on
an object (such as a door or wall) or placed in
mid-air. The rune cannot move; if placed on a
creature or moving object, it will remain at that
point when the surface moves (possibly floating
in mid-air).
When any living creature passes over or
through the rune, or touches the object on which
the rune is inscribed, or (foolishly) reads the
rune, the rune's effect takes place immediately
(no saving throw).
There is one exception: a magic-user, and any
other creature which can normally cast magic-
user spells (high-level thieves with scrolls do not
count!), may make a saving throw vs. spells if he
merely reads or touches (rather than passes) the
symbol. If the saving throw is successful, the
symbol has no effect.
All symbols look similar to normal writings.
Six symbols and their effects are given below; the
DM may create others (such as polymorph, tele-
port, charm, geas, etc.).
Death: Slays any creature with 75 hit points or
less; does not affect a creature with 76 hit points
or more.
Discord: The victim attacks allies (if any) or is
otherwise confused (as the 4th level confusion
spell). The effect is permanent until removed by
a dispel magic spell (at normal chances for suc-
cess) or by a cleric's cureall spell.
Fear: The victim immediately runs away from
the symbol, at his Running Speed, for 30 rounds
(as the wand).
Insanity: The victim becomes insane, and can-
not attack, cast spells, or use special abilities or
items. The victim may walk, but must be care-
fully tended or may run away. This effect is per-
manent until removed by a dispel magic spell (at
normal chances for success) or by a cleric's cureall
spell.
Sleep: The victim falls asleep, and cannot be
awakened. The victim will wake normally in
1d10 + 10 (11-20) hours or if dispel magic is used
to negate it (at normal chances for success).
Stunning: Affects any creature with 150 or
fewer hit points. The victim is stunned for 2d6
turns (as the power word stun spell).
Travel
Range: 0 (caster only)
Duration: One turn per level of the caster
Effect: Allows aerial or gaseous travel
This spell allows the magic-user to move
quickly and freely, even between the planes of
existence. The caster (only) may fly in the same
manner as given by the magic-user's spell, at a
rate of 360' (120'). The caster can also enter a
nearby plane of existence, simply by concentrat-
ing for one round. He may enter a maximum of
one plane per turn.
The magic-user may bring one other creature
for every five levels of experience (rounded
down; for example, a 28th level magic-user
could bring five other creatures on the journey).
To bring others, he must touch them, or they
must touch him, while the spell is cast and the
shift is made. Any unwilling creature can make a
saving throw vs. spells to avoid the effect. The
caster must take the others with him—he cannot
send them while remaining behind.
While this spell is in effect, the magic-user
(only) may assume gaseous form by concentrat-
ing for one full round. (If he is interrupted, no
change occurs.) Unlike the potion effect, all
equipment carried also becomes part of the same
gaseous cloud. In this form, the caster may travel
at double the normal flying rate: 720' (240').
While gaseous, the magic-user cannot use items
or cast spells, but also cannot be damaged except
by magic (weapons or certain spells). Also, a gas-
eous being cannot pass through a protection
from evil spell effect or an anti-magic shell.
Ninth Level Magical Spells
Contingency
Range: Touch
Duration: Indefinite (see below)
Effect: Prepares one other spell
This powerful spell acts as a trigger for one
stated magic-user spell; this second spell must be
of 4th level or less that does not normally cause
damage.
While casting a contingency spell, the magic-
user must describe one situation and the spell
which is contingent upon it. When that situa-
tion next occurs, the contingent spell effect trig-
gers automatically and immediately, as if cast at
that time.
Examples of proper use:
"When I am touched or struck by any living
creature that is not a Lawful or Neutral cleric, ex-
cept for my friends Charlie McGonigle and Sally
Silvernose (contingency), then cast charm mon-
ster on the creature touching or striking me
(spell)."
"When I have eight hit points or less and am
about to be damaged (contingency), then cast
dimension door on myself to take me to a desti-
nation one inch above ground level directly up-
ward; or, if that is greater than 360' away, to the
furthest unoccupied area within range that I
have seen within the 12 hour period prior to the
existence of this contingency (spell effect)."
No item or creature can have more than one
contingency spell cast on it; not even a wish can
allow multiple applications. The contingency
described can be as detailed or as simple as de-
sired, but is somewhat limited in effect: It must
pertain to something within 120' of the trigger-
ing event. A contingency based on a far-off oc-
currence is beyond the spell's capacity. The
target and effect of the secondary spell must al-
ways be specified, and if any necessary details are
lacking, the secondary spell does not occur.
A contingency spell effect has no maximum
duration. It may remain for centuries before the
situation described comes to pass.
Create Any Monster
Range: 90'
Duration: 3 turns
Effect: Creates one or more monsters
This spell is similar to the 7th level spell create
normal monsters and the 8th level spell create
magical monsters, but with fewer limitations on
the types of creatures appearing.
The range and duration are triple those of the
7th level version. The spell cannot create hu-
mans and demihumans, but can create any other
creature, regardless of the number of special
abilities (asterisks). However, if the caster wants
to create a creature with three or more asterisks,
the caster must have carefully studied one (either
alive or dead) for at least one hour to be able to
create another with this spell. As with the lesser
spells, the maximum number of Hit Dice of
creatures is equal to the level of the caster.
To create a construct (as described in Chapter
14), the caster must obtain the proper materials
necessary to create the construct. The spell will
create only one construct, regardless of the cast-
er's Hit Dice; but it is permanent, and does not
vanish at the end of the spell duration. (How-
ever, a dispel magic spell, with normal chances
of success, can destroy this type of construct.)
As with the 8th level spell, the cost of materi-
als required to create a construct is a minimum
of 5,000 gold pieces per asterisk (or more, de-
pending on your campaign). If the construct has
four or more asterisks (such as a drolem), the cost
is doubled (or more; ask your DM). Chapter 16
contains more rules for enchanting magical
items (including constructs), and has suggestions
regarding nondispellable constructs.
Created monsters of all types can be blocked
by a protection from evil or anti-magic shell spell
effect.
Gate*
Range: 30'
Duration: 1d10 x 10 (1-100) turns or 1 turn
Effect: Opens a portal to another plane
When the magic-user casts this spell, he must
name one target: the Ethereal Plane, the Astral
Plane, one of the four elemental planes, or one
outer plane. He must also name a resident of
that plane, usually that of an Immortal, a ruler
of the plane. The spell opens a direct connection
to the other plane of existence.
A gate to an outer plane remains open for only
one turn. Any other gate remains open for
1d10 x 10 (1-100) turns, and there is a 10%
chance per turn that some other-planar creature
will wander through the gate while it is open.
A gate to an elemental plane actually creates a
vortex and a wormhole, and a wish may be used
to make them permanent. Planes, vortexes, and
wormholes are described in Chapter 18.
Contact with an outer plane is dangerous, and
the magic-user must know and speak the name
of the Immortal he wishes to contact. The Im-
mortal he calls will probably (95 % chance) arrive
in 1d6 rounds, but there is a 5% chance that
some other being from the outer planes will re-
spond. When the being arrives, it immediately
looks for the spellcaster.
If the caster does not have an excellent reason
for opening the gate, the being will probably de-
stroy the caster. Even if the caster provides an ex-
cellent reason, the being may merely leave
immediately, showing no interest. If the reason
is of supreme importance to the magic-user and
of some interest to the being (DM's discretion),
it may actually help for a short time.
The reverse of this spell, close gate, will close a
gate created by normal form of the spell. It can
also be used to close a permanent gate to a near-
by plane (such as an elemental vortex). But the
spell cannot affect an Immortal; it cannot, for
instance, make him leave if he chooses to stay.
Heal
Range: Touch (one creature)
Duration: Permanent
Effect: Cures anything
This spell's effect is identical to that of the 6th
level cleric spell cureall. When used to cure
wounds, it cures nearly all of the damage, leav-
ing only 1d6 points of damage remaining. It can
instead remove a curse, neutralize a poison, cure
a disease, cure blindness, or even remove a
feeblemind effect.
Immunity
Range: Touch (one creature)
Duration: One turn per level of the caster
Effect: Bestows immunity or resistance to some
spells and weapons
This spell gives the recipient total immunity
to all 1st-, 2nd-, and 3rd level spells. Further-
more, 4th- and 5th level spells have only half
normal effect, or one-quarter normal if the vic-
tim makes a successful saving throw. Any spell
effect that is quantifiable is reduced in effect;
these effects include reductions in duration, bo-
nuses, penalties, damage, etc. Round fractions
off in the recipient's favor.
The recipient is also completely immune to all
missiles (normal or magical), as well as normal
and silver weapons; he takes half damage from
magical hand-held weapons. This applies only to
weapons; claws, bites, breath weapons, and oth-
er natural attack forms are not blocked.
By concentrating, the recipient can drop the
protection, allowing spells (such as cure wounds)
to have normal effects for that round. If
dropped, the immunity is absent for one round
(including the protection from weapons), but re-
turns automatically at the end of the round.
A carefully worded wish spell can extend this
protection, giving immunity to 4th level spells
and + 1 weapons, and half normal effect from
5th and 6th level spells. No further improve-
ments are possible.
Maze
Range: 60'
Duration: See below (1d6 turns, 2d20 rounds,
2d4 rounds, or 1d4 rounds)
Effect: Traps one creature
This spell creates an indestructible maze in
the Astral Plane and places one victim into the
maze (he gets no saving throw). The intelligence
of the victim determines the time he needs to es-
cape the maze.
Maze Duration
Victim's
Time Required
To Escape
Intelligence
Non- to Low (1-8)
1d6 (1-6) turns
Average (9-12)
2d20 (2-40) rounds
2d4 (2-8) rounds
High (13-17)
1d4 (1-4) rounds
Genius (18 + )
When he escapes the maze, the victim returns
to the exact place from which he originally disap-
peared.
Meteor Swarm
Range: 240'
Duration: Instantaneous
Effect: Creates four or eight meteor-fireballs
This spell creates either 4 or 8 meteors (at the
caster's choice). Each meteor can be aimed at a
different target within range, but only one me-
teor can be aimed at any one creature. Each me-
teor slams into its target and explodes like a
fireball (affecting all creatures within a 20' radi-
us).
If the caster creates four meteors, each strikes
for 8d6 (8-48) points of damage and then ex-
plodes for 8d6 (8-48) points of fire damage. If

```

### Monster Spellcasters

- Extraction note: hybrid RC extraction: page 215 uses TSV coordinate reflow for prose, page 216 is rebuilt from separate coordinate-driven table, right-column spell-list, and left-column notes extracts, and page 217 returns to TSV reflow plus a preserved layout splice for the undead-control table.

```text
Monster Spellcasters
The use of magical spells is not limited to hu-
mans and elves. Many humanoid races have their
own magic-users, clerics, and even druids. A
nonhuman cleric or druid is known as a shaman,
and a nonhuman magic-user as a wokan. Sha-
mans and wokani do not know all the usual
spells. The spells they do know they often cast in
an unusual manner, involving dancing,
shouts and howls, and waving strange items.
The nonhuman spellcasters that are known
are listed below (under "Maximum Spellcaster
Ability"), along with the maximum levels at-
tainable by each. Some individuals may be
both classes (a shaman/wokan), but then the
maximum level for each class is then half what
is listed.
Note that most nonhumans in a tribe or lair
know nothing of magic, and may fear or distrust
it; only the rare shamans and wokani know how
to use it. These spellcasters often use their skills
to rise to positions of power within their tribes.
Only one nonhuman in 20 is a Spellcaster, and
many groups have no wokani, only a shaman.
The spells usable by shamans and wokani are
listed below (under "Spells Usable by Shamans"
and "Spells Usable by Wokani"). Shamans and
wokani do not know, and cannot learn, spells
other than these. Shamans and wokani cannot
read scrolls, but may use other magical items. A
shaman can use any clerical item; a wokan can
use any item usable by a magic-user.
A shaman or wokan normally has 3-8 hit
points per Hit Die (1d6 + 2 instead of 1d8), and
gains a + 1 hit point bonus per spellcaster expe-
rience level (even if the total exceeds the normal
maximum for the monster type).
Important Note: The table below, for the
most part, does not list monsters that can cast
spells as full members of the appropriate charac-
ter classes—for instance, men, liches, devilfish,
sphinxes, etc. Such creatures are not limited to
the spell lists for shamans and wokani.

Maximum Spellcaster Ability Table
Monster Type             Cleric   Druid    Magic-User  Notes
                         (Shaman) (Shaman) (Wokan)
Actaeon                           D8       W8          
Bugbear                  S6                W4          
Centaur                           D8       W8          
Cyclops                  S4                W2          
Djinni                   S4                W6          [a]
Djinni, Greater          S8                W12         [a]
Doppleganger             S6                W4          
Dragon                   S10                           [b]
Dryad                             D10      W4          [a]
Efreeti                  S6                W4          [a]
Efreeti, Greater         S12               W8          [a]
Faerie                            D4       M8          [a]
Giant, Cloud             S10               W10         
Giant, Frost             S8                W6          
Giant, Fire              S8                W6          
Giant, Hill              S8                W6          
Giant, Stone             S8                W6          
Giant, Storm             S10               W10         [a]
Gnoll                    S6                W4          
Gnome                    S12               W12         
Goblin                   S8                W6          
Gremlin                  S4                W8          
Harpy                    S6                W4          
Hobgoblin                S8                W6          
Kobold                   S6                W4          
Lizard Man               S6                W4          
Manscorpion              S13               W6          [c]
Medusa                   S8                W8          
Merman                   S8                W8          
Minotaur                 S4                W2          
Neanderthal              S4                W2          
Nixie                             D6       W4          [d]
Nuckalavee               S2                W4          [a]
Ogre                     S4                W2          [e]
Orc                      S6                W4          
Pixie                             D6       W4          
Sasquatch                         D4       W2          
Spider, Planar           S9                W9          
Sprite                            D6       W4          
Thoul                    S4                W4          
Treant                            D10                  [f]
Troglodyte               S4                W2          
Troll                    S4                W2          
Vampire                  S9                W9          [g]

Spells Usable by Shamans
 First Level Clerical Spells
 Cure Light Wounds* Light*
 Detect Magic       Protection from Evil

 Second Level Clerical Spells
 Bless*                Snake Charm
 Hold Person*          Speak with Animals

Third Level Clerical Spells
Continual Light*      Cure Disease*
Cure Blindness        Remove Curse*

 Fourth Level Clerical Spells
 Cure Serious            Neutralize Poison*
   Wounds*               Speak with Plants
 Dispel Magic

 Fifth Level Clerical Spells
 Create Food            Dispel Evil
 Cure Critical          Insect Plague
   Wounds

 Sixth Level Clerical Spells
 Cureall                Speak with Monsters*
 Find the Path          Word of Recall

 Druid Spells: All are usable

Spells Usable by Wokani
First Level Magical Spells
Detect Magic           Read Languages
Light                 Read Magic
Protection from Evil    Sleep

Second Level Magical Spells
Continual Light*    Invisibility
Detect Evil          Levitate
Detect Invisible     Web

Third Level Magical Spells
Clairvoyance             Fly
Dispel Magic             Lightning Bolt
Fireball                 Water Breathing

Fourth Level Magical Spells
Charm Monster        Massmorph
Growth of Plants*    Remove Curse*
Ice Storm / Wall      Wall of Fire

Fifth Level Magical Spells
Animate Dead          Hold Monster*
Cloudkill             Pass-Wall
Dissolve*             Wall of Stone

Sixth Level Magical Spells
Death Spell          Reincarnation
Move Earth            Stone to Flesh*
Projected Image       Wall of Iron

Notes:
[a] This monster's special spell-like abilities are not affected by the monster having spells.
[b] Some dragons use magic-user spells, but no single dragon can use both clerical and magic-user
spells,

[c] Manscorpion clerics have access to all clerical spells, and are actually clerics, not shamans.
[d] A nixie who learns spells of any type is counted as five nixies for purposes of the special nixie
charm effect.
[e] Some very rare and exceptionally intelligent ogres can rise to W12, but these types usually live
entirely separated from their normal kin.
[f] A treant who gains the use of druid spells may animate four trees instead of two.
[g] At the DM's discretion, a vampire spellcaster can be a full magic-user or cleric, not limited to
the shaman/wokan spell lists below.

For example, an ogre could learn magic as a
shaman up to 4th level (acting as a 4th level cleric) or as a wokan up to 2nd level (acting as a 2nd

level magic-user); or, he could learn both (acting
as a 2nd level cleric and a 1st level magic-user).

Special Monster Spellcasters
Lycanthropes
A lycanthrope may be a real magic-user, cleric,
or druid in human form. However, it may not
use any spells while in were-form and, when it
assumes were-form, most lose all memory of
spells learned, as if all the spells had been cast. A
devil swine spellcaster can cast three charm per-
son spells per day in either were or human form,
but can only cast other spells while in human
form. Devil swine will not forget spells while in
were-form: When they return to human form,
all their memorized spells are still with them.
Undead Spellcasters
A spellcaster slain by an undead may retain
the use of spells after returning as an undead.
Several undead Spellcasters are listed above and
in the main Monster List.
If a cleric becomes a mummy (through a proc-
ess known only to the ancient high priests of cer-
tain religions), the undead mummy may use
clerical spells to the full extent possessed in life,
and may control other undead as well (see Lieges
and Pawns). A mummy magic-user is limited to
3rd level ability, even if it had higher level spell
use in its previous life.
Undead Lieges and
Pawns
Under certain conditions, intelligent undead
creatures can try to control other undead. The
undead need not be a spellcaster to control other
undead creatures.
An undead creature being controlled by an-
other is a pawn. An undead controlling one or
more lesser undead is a liege. Skeletons and
zombies can only be pawns, but any other type
of undead can be either a liege or a pawn. Ran-
dom encounters with undead may occasionally
(10% chance) be with pawns controlled by a
greater undead creature.
A liege may control a number of undead
whose total Hit Dice are less than or equal to
twice the liege's Hit Dice. If an attempt by the
liege to control other undead would cause the to-

Undead Attempts to Control Other Undead Table
Hit Dice of Liege
Intended Pawn                  4            5-6        7-8        9-10         11-13        14-16        17-19     20-23        24-27       28-32        33 +
Skeleton                        7             5          3          C            C             C           C         C            C           C            C
Zombie                          9             7          5          3            C             C           C         C            C           C            C
Ghoul                          11            9           7          5            3             C           C         C            C           C            C
Wight                                       11           9          7             5            3           C          C           C           C            C
Wraith                                                  11          9            7             5            3         C           C           C            C
Mummy                                                              11            9             7            5         3           C           C            C
Spectre                                                                         11             9            7         5           3            C           C
Vampire (a)                                                                                   11           9          7            5           3           C
Vampire (b)                                                                                               11          9            7           5           3
Phantom                                                                                                              11            9           7           5
Haunt                                                                                                                             11           9            7
Spirit                                                                                                                                        11            9
Roll 2d6; if the result is the number needed (or higher), the liege has successfully taken control of the lesser undead.
C Control is automatic.
(a) Nonspell-using vampire of 7 or 8 Hit Dice.
(b) Vampire of 9 Hit Dice or any spell-using vampire

```

### Scrolls

- Extraction note: TSV coordinate reflow across the RC scroll section to remove three-column interleave while preserving bullet lists and long descriptions.

```text
Scrolls
A scroll is a piece of old paper or parchment
upon which a high-level magic-user, elf, or cleric
has written a magical formula. It is also possible
to generate maps via scrolls as noted on the Mag-
ical Item Subtable: 2. Scrolls; these maps are car-
tographic diagrams of a particular area (often
one where treasure is hidden or lost cities are to
be found).
Some guidelines regarding scrolls are given in
the following text.
Who Can Use: Only magic-users, elves, and
10th level (or higher-level) thieves can use magi-
cal scrolls; only clerics and druids can use clerical
scrolls; and only druids can use druidic scrolls.
Determining Contents: To determine what's
on a scroll, characters must have enough light to
read by. Magic-users and elves must use a read
magic spell to determine what's on a scroll;
thieves, clerics, and druids simply read their
scrolls. In any case, all characters must not read
the scroll aloud unless they also wish to cast the
spell at the same time as they figure out the kind
of spell.
Casting the Scroll Spell: To cast the spell on a
scroll, the character must be able to read the
scroll and must read it aloud. A scroll may only
be used once; the words disappear as they are
read aloud.
Protection Spells: Anyone who can read—not
just spellcasters—may use protection scrolls; the
protection spell disappears as it is read aloud.
Treasure Maps: Anyone who can read—not
just spellcasters—may understand treasure
maps; a character who cannot read may make an
Intelligence check to understand the map any-
way. Such maps do not disappear when read.
Scroll Descriptions
The scrolls listed in Magical Item Subtable: 2.
Scrolls, page 229, are described in the following
text.
Communication: This is actually two scrolls,
one stored inside the other. They are easily sepa-
rated. If a message is written on one scroll, it im-
mediately appears on the other. There is no limit
to the range, as long as both scrolls are on the
same plane of existence. The message may be up
to 100 words in length. If one message is erased,
the other disappears as well. Each message must
be erased before another can be written, and
there is a 5% chance (not cumulative) that any
erasing will destroy the magic of both scrolls.
Creation: The user of this valuable scroll may
draw a picture of any normal item up to
5' x 10' x 1' in size (though drawn much smaller)
and up to 5,000 cn weight. The item may then be
taken off the scroll and used! Magical items can-
not be created nor can any living things, but all
types of armor and weapons, for example, are
quite easily created. The item will vanish either on
command of the creator or after 24 hours. The
scroll can create one item per day only.
Cursed: Unfortunately, when any writing on a
cursed scroll is even seen, the victim is immedi-
ately cursed. No reading is necessary! The DM
must make up each scroll's curse. Examples of a
few common curses include the following:
• The reader turns into a frog (or some other
harmless animal).
• A wandering monster of the same level as
the reader appears and attacks the reader by
surprise (a free attack with bonuses).
• One magical item owned by the reader dis-
appears (the item is chosen or randomly de-
termined by the DM).
• The reader loses one level of experience, as
if struck by a wight. (The DM should roll
again for a first-level character to avoid un-
fair "instant death.")
• The reader's Prime Requisite must be re-
rolled.
• Future wounds will take twice as long to
heal, and healing spells will only restore half
normal amounts until the curse is lifted.
Only a remove curse spell (see Chapter 3) can
remove a curse of this nature. However, the DM
may allow the cursed character to be cured by a
high-level NPC cleric or magic-user, who will de-
mand that the character complete a special ad-
venture or perform a worthy but difficult task.
Delay: This is a scroll of one spell. When cast-
ing the spell from the scroll, the user states an
amount of delay from 0 to 12 rounds. There-
after, if the user carries the scroll, the user has
complete control of the spell when it occurs. If
the scroll is not carried by the user, the spell ef-
fect appears around the scroll itself, affecting the
nearest creature if a recipient is part of the spell
process. The spell does not affect the scroll, even
if it is a fire-type spell. For example, an elf reads
a delay lightning bolt scroll, delaying it 8
rounds, and then puts the scroll away. Eight
rounds later, when the lightning bolt actually
appears, the elf may choose the range and direc-
tion by mere concentration, as if casting the spell
at that time.
Equipment: This parchment is inscribed with
the names of six normal items (which the DM
selects or randomly determines, using the Ad-
venturing Gear Table from Chapter 4). When
any item's name is read aloud, the item appears
within 10' of the scroll; the name disappears.
The item will remain for 24 hours or until the
user commands it to vanish. The name reappears
on the scroll when the item vanishes. Any three
of the six items listed on the scroll can be created
each day.
Illumination: This scroll bears the drawing of
a flame. If the scroll is set afire, it will burn with
a clear light in a 60' radius, lasting for up to 6
hours per day. The burning does not harm the
scroll, but it is nevertheless "normal" fire (and
can be used to light torches, for example). The
flame cannot be extinguished except by water or
on command of the user; no wind, normal or
magical, can cause it to even flicker. This item
may already be lit when found.
Mages (spellcasters only): This scroll is blank;
it is used to identify magical effects. The user
may hold the scroll and command it to identify
any one chosen magical effect within 30'. The
name of the magical spell or effect then appears
on the scroll, along with the level of the caster of
the spell effect. The scroll will identify one magi-
cal effect per day.
Maps to Treasures (Normal, Magical, Com-
bined, or Special): Each map should be made in
advance by the DM. Such maps show a route to
the location of a treasure in a dungeon or a wilder-
ness area. The treasure is usually hidden or pro-
tected by monsters, traps, and/or magic. Based
on the type of treasure given, the DM should se-
lect a challenging monster (who has a similar trea-
sure type) and design the map and monster lair
accordingly. Note that the map may be partially
incorrect, omitting an important detail (such as
the type of monsters, dangerous traps, etc.) or giv-
ing some false information; however, the treasure
mentioned should actually be there. Sometimes
maps are only partially complete or are written in
the form of a riddle. And some can only be read
by a read languages spell.
Normal treasure contains coins and gems but
no magical items, while a magical treasure may
include some coins and a few gems of low value
in addition to magical items. A combined trea-
sure has coins, magical items, and valuable gems
or jewelry in roughly equal proportions. Special
treasure should contain at least one permanent
magical item, such as a staff or sword; these
items should be mentioned on the map.
Mapping: This scroll is blank. When held and
commanded to write, this scroll will draw a map
of an area chosen (that is, the DM accurately
draws the map for the players). The area must be
completely within 100' of the scroll, and it may
be up to 10,000 square feet in size. The scroll has
1 chance in 6 to detect secret doors, but it will
not draw what lies beyond them. The scroll func-
tions once per day.
Portals: This scroll creates a pass-wall effect,
identical to the magic-user spell. When placed
on a surface and commanded to function, the
scroll disappears and a 5'-diameter hole appears
that is up to 10' deep. The scroll does not affect
living or magical things. The hole will disappear
after 3 turns or when commanded by the reader
of the scroll. When the hole disappears, the
scroll reappears. The scroll may be used twice
each day.
Protection: A protection scroll may be read
and used by any character who can read the
Common language. When read, it creates a cir-
cle of protection 10' across that will move with
the reader at its center. It will prevent any of the
given creatures from entering this circle, but it
does not prevent spell or missile attacks from
those creatures. The circle will be broken if any-
one protected attacks one of the given creatures
in hand-to-hand combat.
Four types of protection scrolls are described
in the following text.
Protection from Elementals: This scroll creates
a circle of protection (10' radius) around the
reader. No elemental can attack those within the
circle unless attacked first in hand-to-hand com-
bat. Once attacked, an elemental may attack in
return. The effect lasts for 2 turns and moves
with the reader.
Protection from Lycanthropes: When read,
this scroll will protect all those within the circle
for 6 turns against a variable number of lycan-
thropes. The number of lycanthropes affected
varies according to their type, as follows.
Werebats, wererats, werefoxes
1d10 affected
Wereboars, werewolves
1d8 affected
Wereseals, weresharks
1d6 affected
Werebears, weretigers
1d4 affected
Devil swine
ld2 affected
Protection from Magic: This scroll creates a cir-
cle of protection (10' radius) around the reader.
No spells or spell effects (including those from
items) may enter or leave the circle. The effect
lasts for 1d4 turns, moves with the reader, and
may not be broken except by a wish.
Protection from Undead: When read, this
scroll will protect all those within the circle from
a variable number of undead for 6 turns. The
number of undead affected varies according to
their type, as follows.
Skeletons, zombies, ghouls
2dl2 affected
Wights, wraiths, mummies
2d6 affected
Specters (or larger monsters)
1d6 affected
Questioning: The user of this scroll may ask
questions of any nonliving nonmagical objects;
their answers will appear on the scroll. The scroll
will display up to three answers per day. The an-
swers will be given as if the objects were living
beings, but they will be limited to simple obser-
vations as if the objects could see, hear, and
smell. The scroll cannot be used to question liv-
ing or magical things.
Repetition: This scroll appears to be a normal
scroll of one spell, and the standard restrictions
apply to its use. However, 1 turn after the spell is
cast, the scroll creates the same spell effect a sec-
ond time, centered on the scroll or affecting the
nearest creature if a recipient is part of the spell
process. As with a normal spell scroll, any spell
cast from it is then gone; however, another spell
may be written on the scroll if it is of the same
level, and the repetition effect will again apply.
Seeing: This scroll is blank. When held and
commanded to write, it will draw pictures of crea-
tures within 100' in any area chosen by the user.
Up to four different types of creatures can be pic-
tured. The scroll will function once per day, re-
gardless of the number of creatures pictured.
Shelter: This scroll is inscribed with an elabo-
rate drawing of a 10'-square room, lit, with two
beds, a table and two chairs, food and drink for
two on the table, and a pair of normal swords on
the far wall, each hung over a shield. If the scroll
is hung on any vertical surface, the room pic-
tured may be entered and the items used. The
food and drink are pure and will nourish any liv-
ing thing. The swords and shields may be taken
down and used. However, none of the items can
be removed from the room.
If the scroll is taken down, the room cannot be
entered or left, but remains in existence on an-
other dimension. If any creatures are in the room
when the scroll is taken down, the air inside per-
mits survival for up to 24 hours. No creatures so
caught can escape by any means other than a
wish. The food and drink are replenished each
time the scroll is taken down. The room can be
created once per day and will remain for up to 12
hours per use; if not removed in that time, the
scroll will fall down by itself.
Spell Catching: This scroll is blank when
found. It may be used to "catch" a spell cast at
the user. It cannot catch spell-like effects, nor
can it catch device-produced effects (such as
from a wand), but a spell cast from a scroll can be
caught. There are four types of this scroll; roll 1d10 to determine the capacity.

Roll   Capacity
1-4    1st or 2nd level spells
5-7    1st to 4th level spells
8-9    1st to 6th level spells
10     1st to 8th level spells

The user of the scroll must hold it up, like a
shield; no other action is possible while using the
scroll. The user must then make a saving throw
vs. spells, with a +4 bonus to the roll; if success-
ful, the incoming spell has no effect and is in-
stead transferred to the scroll, appearing as a
normal scroll spell. The exact spell caught will
not be known until a read magic spell is used to
identify it.
The scroll can only hold one spell at a time; the
spell caught must either be used or copied into a
spell book (magic-user spells only) before the
scroll can catch another spell. Any type of spell
(magical, clerical, or druidic) can be caught as
long as the level does not exceed the scroll's capac-
ity. The scroll of spell catching cannot affect spells
of levels greater than the given capacity, and it can
catch a maximum of one spell per day.
Spells: Use Spell Scrolls in the magical item
subtable for scrolls to find the exact spell levels
or choose spells as appropriate. Spell scrolls are
good ways to introduce new spells in a cam-
paign, and they may thus be designed with the
characters' current spell books in mind. Note
that only druids can cast spells on druid scrolls,
though the spell name can be revealed by a read
magic spell.
Trapping: This scroll can create one trap. The
type of trap differs by the placement of the
scroll. The scroll is destroyed when the trap is
created. If placed on a floor, a hidden pit trap is
created; if on a ceiling, a falling block trap ap-
pears. On walls, a poison dart or gas trap will be
created. The exact trap is left for the DM's de-
sign. The trap created is quite real and is not illu-
sory or magical.
Truth: This scroll is blank when found. The
user may ask a question of any living being with-
in 30'; the complete and true answer appears on
the scroll, read from the victim's mind by a pow-
erful version of ESP. Note that the answer is true
only within the limits of the victim's knowledge.
The scroll will display one answer per day.

```

### Spell Research

- Extraction note: anchored TSV coordinate reflow from the actual RC spell-research page to replace the earlier mis-extracted line-range block.

```text
Spell Research
A cleric, magic-user, elf, or druid—even a pal-
adin or an avenger in rare instances—can try to
invent new spells and create new magical items
through research. These are difficult and lengthy
projects. For clerics and druids, substitute the
Wisdom scores for Intelligence scores in the pro-
cedures that follow.
Player Procedures
When a player wishes for his spellcasting char-
acter to create a new spell, he first informs his
DM of his desire. Then, following the format
shown in Chapter 3, he writes up his spell as he
envisions it working. He does not indicate its
spell level.
The DM then evaluates the spell as it is writ-
ten up, indicates which spell level he or she
thinks it should be, and suggests any changes
that the player must make to the spell write-up.
If the spell level chosen is higher than the high-
est level spell the spellcasting character can have,
the character cannot yet research and develop
the spell; he must either limit it further, until
the DM adjusts the spell level down to that
which the character could cast, or wait until the
character is of the appropriate level to cast the
spell he is creating.
When the player and the DM are satisfied
with the result, go to the following procedure.
Character Procedures
Spell research requires research materials,
components, time, and money. Once these re-
quirements are met, the character can roll for his
chance of success.
Research
To research a spell, a spellcaster must first have
access to a large library such as those that exist in
major cities or those that are in the possession of
powerful wizards or clerics.
The DM will have to decide whether a player
character's library is sufficient to the task—usually
it isn't until the spellcaster is at least 18th level or
is at least 9th level and has rigorously acquired
every spell book and magical research volume pos-
sible throughout his career. If the PC's library isn't
adequate, he'll have to get permission from a
school of magic, clerical order, or powerful wizard
or cleric in order to use a greater library.
Components
The spellcaster must then find components
for the development of the spell. These are up to
the DM to determine; on the average, the com-
ponent must come from a monster with HD at
least equal to the spell level (or of similar diffi-
culty to attain), and the monster must have some
appropriate relationship to the magic spell being
developed. For example, red dragon scales
would be appropriate for an explosive cloud,
fresh troll blood for a regeneration, etc.
The spellcaster must have these components
in hand before beginning spell research, and he
must go on an adventure to acquire them; he
can't just buy them from a greater wizard or cler-
ic. There are no limits to this process other than
the DM's and players' imaginations.
Time and Money
The spellcaster must then spend large
amounts of gold during the progress of his re-
search. The total cost of spell research comes to
1,000 gp x the spell level.
Research takes one week for the initial re-
search, plus one day per 1,000 gp spent. At the
end of this time, the DM will tell him to make
his chance of success roll.
If the spellcaster runs out of gold before it's
time for his chance of success roll, he may inter-
rupt his research, leave on an adventure to earn
more money, and come back later to resume his
research; he loses his initial week of research
(he'll have to spend another week to refamiliar-
ize himself with his work), but he doesn't lose
the money he's already spent; those gp are still
counted toward research cost.
Chances of Success
The chance of success to research a spell vary
depending on the spell level researched and
whether it is a new spell (not already appearing
on the campaign world) or a common one (a
spell that other spellcasters know, but which the
PC hasn't been able to learn from them and so is
developing independently).
For a common spell, add the magic-user's In-
telligence score to his experience level and multi-
ply the result by two. Then subtract 3 per spell
level being researched.
For a new spell, follow the same procedure,
except subtract 5 per spell level instead of 3. Re-
gardless of success chances, a roll of 95 or better
is an automatic failure. There is no automatic
success. The chance of success for researching
spells is as follows:
Common spell: ([Int + Lvl] x 2)-(3 *spell
level) = %
New spell: ([Int + Lvl] x 2)-(5 x spell level)
= %
For example, a 5th level cleric with a 15 Wis-
dom researches a common 1st level spell. He has
a ([ 15 + 5] x 2) - 3 = 37 % chance of success.
If the initial attempt is a failure, the character
must start over. However, if he tries again, his
next attempt will be at a +5 % chance of success.
That + 5 % is cumulative for each failure he has;
for example, if he fails three times, on his fourth
try he'll have + 1 5 % to his chance.
Dangers of Spell Research
The DM should be very careful when letting
players develop new spells. Those that have per-
manent effects and those that increase in power
with character level or have no saving throw can
lead to massive imbalances in a campaign. A DM
should severely limit or forbid any new spell that
could cause such an imbalance.
In most cases, even with spells the DM ap-
proves, consider any new spell introduced to be
"on probation." Test it in the campaign with the
understanding that it may be changed should it
prove hazardous to the campaign.
Experience from Spells
and Enchanted Items
At the DM's discretion, experience points can
be awarded for creating enchanted items and
magical vessels and for doing spell research—
such work does, after all, represent a great in-
vestment in time, money, and effort, which is
the essence of gaining experience. Note, how-
ever, that experience is only awarded for the first
time a character works on a specific type of item.
When a character creates a magical item or
piece of armor, he can get an XP award equal to
the number of gp spent on the item—if the en-
chantment was successful. If the enchantment
failed, he gets no experience from the project.
When a character creates an enchanted vessel,
home, or similar huge magical item, he gets an
XP award equal to 1/3 the gp spent on successful
enchantments going into the making of the
item. He gets nothing for failed enchantments.
For example, a team of magic-users working on
a flying war galley get the experience for the first
galley they successfully create, but not on subse-
quent ones of the same class; they'd get experi-
ence for the first flying castle they made, but not
on subsequent ones of the same approximate size.
These XP awards are divided evenly among all
spellcasters working on the enchanted item; this
is especially important to remember for enchant-
ed vessels, which generate a lot of XP but are
usually worked upon by numerous spellcasters.
Characters do not get experience for spells
that go into the making of the frame (such as
stoneform) or from the nonmagical fittings add-
ed to such vehicles.

```

### Index to Spells

- Extraction note: three-column extraction from the RC appendix index page using cropped per-column text to preserve alphabetical reading order.

```text
Index to Spells

This is an index of all spells appearing in this
Cyclopedia. The spells are arranged alphabetically, and each spell has a notation beside it in
parentheses. The letter in parentheses stands
for the type of spell it is (C = clerical, Dr =
druidic, MU = magical), and the number
stands for the spell level (1 = 1st level, etc.).
Therefore, a notation such as "(C 7)" would
mean "7th level clerical spell." Spells with multiple notations appear in different places in the
spell lists in Chapter 3.
aerial servant (C 6)
analyze (MU 1)
animate dead (C 4, MU 5)
animate objects (C 6)
anti-animal shell (Dr 6)
anti-plant shell (Dr 5)
anti-magic shell (MU 6)
appear: mass invisibility (reversed) (MU 7)
babble: speak with monsters (reversed) (C 6)
barrier (C 6)
bless (C 2)
blight: bless (reversed) (C 2)
call lightning (Dr 3)
cause critical wounds: cure critical wounds (reversed) (C 5)
cause disease: cure disease (reversed) (C 3)
cause fear: remove fear (reversed) (C 1)
cause light wounds: cure light wounds (reversed) (C 1)
cause serious wounds: cure serious wounds (reversed) (C 4)

charm monster (MU 4)
charm person (MU 1)
charm plant (MU 7)
clairvoyance (MU 3)
clone (MU 8)
close gate: gate (reversed) (MU 9)
clothform (MU 4)
cloudkill (MU 5)
commune (C 5)
confuse alignment: know alignment (reversed) (C 2)
confusion (MU 4)
conjure elemental (MU 5)
contact outer plane (MU 5)
contingency (MU 9)
continual darkness: continual light (reversed) (C 3, MU 2)
continual light (C 3, MU 2)
control temperature 10' radius (Dr 4)
control winds (Dr 5)
create air (MU 3)
create any monster (MU 9)
create food (C 5)
create magical monsters (MU 8)
create normal animals (C 6)
create normal monsters (MU 7)
create poison: neutralize poison (reversed) (C 4)
create water (C 4)
creeping doom (Dr 7)
cure blindness (C 3)
cure critical wounds (C 5)
cure disease (C 3)
cure light wounds (C 1)
cure serious wounds (C 4)
cureall (C 6)
curse: remove curse (reversed) (C 3, MU 4)
dance (MU 8)
darkness: light (reversed) (C 1, MU 1)
death spell (MU 6)
delayed blast fireball (MU 7)
detect danger (Dr 1)
detect evil (C 1, MU 2)
detect invisible (MU 2)
detect magic (C 1, MU 1)
dimension door (MU 4)
disintegrate (MU 6)
dispel evil (C 5)
dispel magic (C 4, MU 3)
dissolve (Dr 5, MU 5)
earthquake (C 7)
entangle (MU 2)
ESP (MU 2)
explosive cloud (MU 8)
faerie fire (Dr 1)
feeblemind (MU 5)
find the path (C 6)
find traps (C 2)
finger of death: raise dead (reversed) (C 5)
fireball (MU 3)
flesh to stone: stone to flesh (reversed) (MU 6)
floating disc (MU 1)
fly (MU 3)
force field (MU 8)
free monster: hold monster (reversed) (MU 5)
free person: hold person (reversed) (C 2, MU 3)
gate (MU 9)
geas (MU 6)
growth of animals (C 3)
growth of plants (MU 4)
hallucinatory terrain (MU 4)
harden: dissolve (reversed) (MU 5)
haste (MU 3)
heal (MU 9)
heat metal (Dr 2)
hold animal (Dr 3)
hold monster (MU 5)
hold person (C 2, MU 3)
hold portal (MU 1)
holy word (C 7)
ice storm (MU 4)
immunity (MU 9)
infravision (MU 3)
insect plague (C 5)
invisibility (MU 2)
invisibility 10' radius (MU 3)
invisible stalker (MU 6)
ironform (MU 7)
knock (MU 2)
know alignment (C 2)
levitate (MU 2)
life drain: restore (reversed) (C 7)
light (C 1, MU 1)
lightning bolt (MU 3)
locate (Dr 1)
locate object (C 3, MU 2)
lore (MU 7)
lower water (MU 6)
magic door (MU 7)
magic jar (MU 5)
magic lock: magic door (reversed) (MU 7)
magic missile (MU 1)
mass charm (MU 8)
mass invisibility (MU 7)
massmorph (MU 4)
maze (MU 9)
metal to wood (Dr 7)
meteor swarm (MU 9)
mind barrier (MU 8)
mindmask: ESP (reversed) (MU 2)
mirror image (MU 2)
move earth (MU 6)
neutralize poison (C 4)
obliterate: raise dead fully (reversed) (C 7)
obscure (Dr 2)
open mind: mind barrier (reversed) (MU 8)
pass plant (Dr 5)
passwall (MU 5)
permanence (MU 8)
phantasmal force (MU 2)
plant door (Dr 4)
polymorph any object (MU 8)
polymorph others (MU 4)
polymorph self (MU 4)
power word blind (MU 8)
power word kill (MU 9)
power word stun (MU 7)
predict weather (Dr 1)
prismatic wall (MU 9)
produce fire (Dr 2)
projected image (MU 6)
protection from evil (C 1, MU 1)
protection from evil 10' radius (C 4, MU 3)
protection from lightning (Dr 4)
protection from normal missiles (MU 3)
protection from poison (Dr 3)
purify food and water (C 1)
quest (C 5)
raise dead (C 5)
raise dead fully (C 7)
read languages (MU 1)
read magic (MU 1)
reincarnation (MU 6)
remove barrier: barrier (reversed) (C 6)
remove charm (MU 8)
remove curse (C 3, MU 4)
remove fear (C 1)
remove geas: geas (reversed) (MU 6)
remove quest: quest (reversed) (C 5)
resist cold (C 1)
resist fire (C 2)
restore (C 7)
reverse gravity (MU 7)
shapechange (MU 9)
shield (MU 1)
shrink plants: growth of plants (reversed) (MU 4)
silence 15' radius (C 2)
sleep (MU 1)
slow: haste (reversed) (MU 3)
snake charm (C 2)
speak with animal (C 2)
speak with monsters (C 6)
speak with plants (C 4)
speak with the dead (C 3)
statue (MU 7)
steelform (MU 8)
sticks to snakes (C 4)
stone to flesh (MU 6)
stoneform (MU 6)
striking (C 3)
summon animals (Dr 4)
summon elemental (Dr 7)
summon object (MU 7)
summon weather (Dr 6)
survival (C 7, MU 9)
sword (MU 7)
symbol (MU 8)
telekinesis (MU 5)
teleport (MU 5)
teleport any object (MU 7)
timestop (MU 9)
transport through plants (Dr 6)
travel (C 7)
travel (MU 8)
truesight (C 5)
turn wood (Dr 6)
ventriloquism (MU 1)
wall of ice: alternate form of ice storm (MU 4)
wall of fire (MU 4)
wall of iron (MU 6)
wall of stone (MU 5)
warp wood (Dr 2)
water breathing (Dr 3, MU 3)
weather control (Dr 7, MU 6)
web (MU 2)
wish (C 7, MU 9)
wizard eye (MU 4)
wizard lock (MU 2)
wizardry (C 7)
woodform (MU 5)
word of recall (C 6)

```

