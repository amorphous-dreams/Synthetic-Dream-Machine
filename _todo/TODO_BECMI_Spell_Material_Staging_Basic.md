# TODO: BECMI Spell Material Staging - Basic

This staging document captures spell material and associated magical-context text from `TSR 1011B - Set 1 Basic Rules.pdf`.

Rules for this artifact:
- Raw classic terminology is preserved.
- This is a staging artifact, not a final crosswalk.
- `pdftotext -layout -nodiag -nopgbrk` remains the primary extractor unless a section note says otherwise.
- Parser warnings from PDF extraction stderr were suppressed and are not part of this document.
- Section methods may mix anchored line slices, page-layout extraction, cropped columns, TSV reflow, and small curated stitching when that is necessary to preserve reading order.
- Cleanup is conservative: spacing, OCR scars, and broken line wraps may be normalized, but source terminology is not converted.

Source PDF:
- `TSR 1011B - Set 1 Basic Rules.pdf`

## Audit Rubric

- Coverage: the staged block should account for the claimed source section without silently dropping major witnesses.
- Reading order: columns, tables, and continuation text should preserve source order rather than left/right interleave.
- Continuation: multi-page and multi-column blocks should retain start, middle, and end states without orphaned fragments.
- Table/list survivability: representative table rows and list entries should remain readable and attached to the correct headings.
- Manual-reconstruction burden: curated or stitched text should be minimized, reproducible, and explicitly validated when unavoidable.

## Table Check QA Pass

- Status: reviewed 2026-03-27 during direct PDF audit and validator uplift
- Scope checked: Turning Undead table, spell-list setup, clerical and magic-user spell-description runs, DM higher-level spell guidance, lost spell-book doctrine, and item-operation / scroll wrapper sections.
- Result: direct PDF audit plus the expanded Basic validator found no blocking coverage, ordering, or wrapper-continuation defect in the staged Basic lane.

- Capture confidence: **0.93**
- Coverage note: Player spell content, DM higher-level spell guidance, lost spell books, and scroll/ring/item-operation procedures remain source-grounded under direct audit. The lane is still held below 0.95 by recurring OCR texture and a few fallback-heavy wrapper sections, not by a current source-evidence gap.
- ToC cross-check: Basic spell and treasure sections remain fully accounted for in staging, including player spell pages, DM higher-level spell guidance, and the treasure/magic-item wrapper pages.
- Gap priority: LOW — validation now covers spell-list continuity, higher-level guidance ordering, and the treasure wrapper flow; remaining work is cleanup and extraction hardening, not missing section coverage.
### Cleric Rules, Turning, and First-Level Spell Procedures

- Extraction note: page-aware Basic extraction from the actual cleric special-abilities page, split by column so Turning Undead procedure, the undead table, and spellcasting guidance stay in readable source order.

```text
[Basic page 25: special-abilities prose]
Special Abilities
A cleric has two Special Abilities: Turn-
ing Undead monsters and casting Cleric
Spells.
1. Turning Undead
A cleric has the power to force away cer-
tain monsters called the "Undead" (skel-
etons, zombies, ghouls, wights, and
other more powerful types). No other
class has any special effect on the Un-
dead. This special ability is called "Turn-
ing" the Undead monsters.
When a cleric encounters an Undead
monster, the cleric may either attack it
normally (with a weapon or spell), or try
to Turn it. The cleric cannot both attack
and Turn Undead in one round.
When you want your cleric to try to
Turn Undead, just tell your Dungeon
Master ''I'll Turn the Undead."
The Undead monsters are not auto-
matically Turned by the cleric. When the
encounter occurs, the player must refer
to the Cleric Turning Undead Table to
find the effect the cleric has.
Using the Cleric Turning
Undead Table:
When the cleric encounters an Undead
monster, find the cleric's Level of Experi-
ence on the left side of the chart. Then
read across to the column under the name
of the Undead monster, and apply the re-
sults immediately. If the attempt succeeds,
one or more of the Undead monsters will
retreat, but may soon return.
Explanation of Results
7, 9 or 11: Whenever a number is
given, the cleric has a chance to Turn
the Undead monsters. The player
rolls 2d6 (two six-sided dice). If the
total is equal to or greater than the
number given, the attempt at Turn-
ing Undead is successful. A cleric's
chances improve as more Levels of
Experience are earned.
T: The attempt at Turning the Undead
automatically succeeds.
N: No Effect. The cleric cannot Turn
that type of undead.

CLERIC TURNING UNDEAD TABLE
Cleric Level   Skeleton   Zombie   Ghoul   Wight
1              7          9        11      N
2              T          7        9       11
3              T          T        7       9

Success: If the attempt at Turning Un-
dead succeeds, the Dungeon Master will
roll 2d6 to determine the number of Hit
Dice of Undead monsters that t u r n
away. You might not Turn all the mon-
sters encountered, but if you succeed in
Turning, at least one will be affected. A
Turned monster will not touch the cleric
and will flee as far from him as possible.
2. Clerical Spells
When a cleric reaches the 2nd Level of
Experience (having earned 1500 XP or
more), the cleric can use spells.
Learning Spells:
To learn a spell, the cleric meditates. The
memory and details of the spells appear in
the cleric's mind. The spells may be cast at
any time thereafter. The cleric will remem-
ber each spell until it is cast, even if it is not
used for days or weeks.
As a player, all you need to d o is
choose whatever spells you want your
character to have. This can only be done
at the start of an adventure. You may
choose any of the spells described here-
after. You may not choose any magic-
user spells; they are a different type.
A 2nd Level cleric can cast one spell
per adventure. A 3rd Level cleric can
cast two spells per adventure.
In more advanced games, adventures
may la-st more than a day. In such cases,
a cleric can gain spells each morning, if
completely rested. Any and all spells
may be changed at this time, if desired.
Casting Spells:
In the game, when you want your char-
acter to cast a spell, just tell your Dun-
geon Master. The DM may ask for some
details; for example, some spells are cast
at a target, and you must tell the DM
what the target is. The player does not
have to learn any special words. For ex-
ample: "I'm casting a Cure Light Wounds
on Ruggin, the dwarf."
When the cleric casts a spell, the mem-
ory of that spell is forgotten. -Imagine
that your cleric's memory is like a black-
board. The knowledge of the spells ap-
pear on it, but each spell is erased as it is
cast. If your character knows two of the
same spells and casts one, the other still
remains to be used.
The character must be able to gesture
and speak normally to cast a spell. While
casting a spell, the cleric must stand and
concentrate. Spells cannot be cast while the
character is walking or running. If the
cleric is disturbed while casting a spell, the
spell will be ruined, and will still be
"erased," just as if it had been cast.
Spells must be cast one at a time. If the
character wants to cast more than one (for
example, two Cure Light Wounds spells
just after a battle), the fastest they can be
cast is one each round.
Types of Spells:
Some spells have an instant effect. For
example, a Cure Light Wounds spell in-
stantly cures damage. Other spells may
be different; the cleric may cast a spell to
gain special abilities for a short time, or
give those abilities to a friend. For exam-
ple, a Remove Fear spell helps the recip-
ient (the creature upon whom the spell is
cast) to resist fear caused by magical
effects or spells.
Saving Throws versus spells:
Some spells only have full effect if the
victim fails a Saving Throw vs. Spells. If
a Saving Throw is allowed, it is men-
tioned in the spell description.

```

### Spell Lists and Basic Spell Descriptions

- Extraction note: iterative Basic extraction: the page 35 spell-list page is rebuilt as a curated readable list from the source page, the clerical description pages use TSV column reflow, and the magic-user spell-book plus spell-description pages now use page-aware TSV reflow instead of the earlier anchored text slice.

```text
[Basic page 35: curated spell-list page]
Cleric Spells: First Level

Cure Light Wounds*
  Range: Touch
  Duration: Permanent
  Effect: Any one living creature

Detect Evil
  Range: 120'
  Duration: 6 turns
  Effect: Everything within 120'

Detect Magic
  Range: 60'
  Duration: 2 turns
  Effect: Everything within 60'

Light*
  Range: 120'
  Duration: 12 turns
  Effect: Volume of 30' diameter

Protection from Evil
  Range: 0
  Duration: 12 turns
  Effect: The cleric only

Purify Food and Water
  Range: 10'
  Duration: Permanent
  Effect: 1 ration or 6 waterskins

Remove Fear*
  Range: Touch
  Duration: 2 turns
  Effect: Any one living creature

Resist Cold
  Range: 0
  Duration: 6 turns
  Effect: All creatures within 30'

*Spell may be cast with reverse effects in D&D EXPERT Rules.

Magic-User Spells: First Level*

Charm Person
  Range: 120'
  Duration: See below
  Effect: One living "person"

Detect Magic
  Range: 60'
  Duration: 2 turns
  Effect: Everything within 60'

Floating Disc
  Range: 0
  Duration: 6 turns
  Effect: Disc remains within 6'

Hold Portal
  Range: 10'
  Duration: 2-12 (2d6) turns
  Effect: One door, gate, or similar portal

Light
  Range: 120'
  Duration: 6 turns + 1 turn per Level of the magic-user
  Effect: Volume of 30' diameter

Magic Missile
  Range: 150'
  Duration: 1 round
  Effect: Creates 1 or more arrows

Protection from Evil
  Range: 0
  Duration: 6 turns
  Effect: The magic-user only

Read Languages
  Range: 0
  Duration: 2 turns
  Effect: The magic-user only

Read Magic
  Range: 0
  Duration: 1 turn
  Effect: The magic-user only

Shield
  Range: 0
  Duration: 2 turns
  Effect: The magic-user only

Sleep
  Range: 240'
  Duration: 4-16 (4d4) turns
  Effect: 2-16 Hit Dice of living creatures within a 40' square area

Ventriloquism
  Range: 60'
  Duration: 2 turns
  Effect: One item or location

Magic-User Spells: Second Level

Continual Light
  Range: 120'
  Duration: Permanent
  Effect: Volume of 60' diameter

Detect Evil
  Range: 60'
  Duration: 2 turns
  Effect: Everything within 60'

Detect Invisible
  Range: 10' per Level of the magic-user
  Duration: 6 turns
  Effect: The magic-user only

ESP
  Range: 60'
  Duration: 12 turns
  Effect: All thoughts in one direction

Invisibility
  Range: 240'
  Duration: Permanent until broken
  Effect: One creature or object

Knock
  Range: 60'
  Duration: See below
  Effect: One lock or bar

Levitate
  Range: 0
  Duration: 6 turns + 1 turn per Level of the magic-user
  Effect: The magic-user only

Locate Object
  Range: 60' + 10' per Level of the magic-user
  Duration: 2 turns
  Effect: One object within range

Mirror Image
  Range: 0
  Duration: 6 turns
  Effect: The magic-user only

Phantasmal Force
  Range: 240'
  Duration: Concentration
  Effect: A volume 20' x 20' x 20'

Web
  Range: 10'
  Duration: 48 turns
  Effect: A volume 10' x 10' x 10'

Wizard Lock
  Range: 10'
  Duration: Permanent
  Effect: One portal or lock

[Basic pages 26-27: TSV column-reflowed clerical spell descriptions]
Clerical Spell Explanations:
Each spell has a listed Range, Duration,
and Effect.
Range: The character should be sure
that the target is within range before
casting the spell. If the description says
"Range: 0," the spell may only be used
by the cleric, and cannot be cast on
others. If "Range: Touch" is given, the
spell can be placed on any creature the
cleric touches - including the cleric
himself (or herself, as the case may be).
Duration is given either in rounds (of 10
seconds each) or turns (of 10 minutes
each). If the description says "Duration:
Permanent," then the spell has an in-
stant and permanent effect that does not
go away after a given duration.
Effect of the spell gives either the num-
ber of creatures or objects affected, or
an area or volume of space. If an area is
given, it is measured in square feet (a flat
area). If a 3-dimensional volume is af-
fected, it is either a round "ball" with a
given diameter, or a square or rectangu-
lar "box" of a given size; both are mea-
sured in feet.
Spell Power:
When a cleric reaches 4th level, more
powerful spells can be cast. These are
given in the D&D EXPERT Set. The
power of a spell is described in a way
similar to the power of a character.
Spells of the lowest level of power are
called "First Level" spells. The D&D
EXPERT Set describes spells of the Sec-
ond, Third, Fourth, and Fifth level.
Sixth and Seventh level spells are de-
scribed in the D&D COMPANION Set.
Clerical Spell Descriptions
FIRST LEVEL CLERIC SPELLS
1. Cure Light Wounds*
2. Detect Evil*
3. Detect Magic
4. Light*
5. Protection From Evil
6. Purify Food and Water
7. Remove Fear*
8. Resist Cold
*These spells may be "reversed" (that is,
learned and cast with an effect exactly
opposite from the original) in the D&D
EXPERT Set. A cleric must reach the
Fourth Level of Experience before
learning how to reverse spell effects.
Cure Light Wounds*
Range: Touch
Duration: Permanent
Effect: Any one living creature
This spell will either heal damage or
remove paralysis. If used to heal, it will
cure 2-7 ( 1d6 + 1) points of damage. It
will not heal any damage if used to cure
paralysis. The cleric may cast it on him-
self (or herself if desired.
This spell will never increase a creature's total hit points above the original
amount.
Detect Evil
Range: 120'
Duration: 6 turns
Effect: Everything within 120'
When this spell is cast, the cleric will see
evilly enchanted objects within 120'
glow. It will also cause creatures that
want to harm the cleric to glow when
they are within range. The actual
thoughts of the creatures cannot be
heard. Remember that "Chaotic" does
not automatically mean Evil, although
many Chaotic monsters have evil inten-
tions. Traps and poison are neither good
nor evil, merely dangerous.
Detect Magic
Range: 0
Duration: 2 turns
Effect: Everything within 60'
When this spell is cast, the cleric will see
magical objects, creatures, and places
within range glow. It will not last very
long, and should be saved until the cleric
wants to see if something found during
an adventure is, in fact, magical. For
example, a door may be held shut magically, or a treasure found might be
enchanted; in either case, the magic
item, creature, or effect will glow when it
is within the effect.
Light
Range: 120'
Duration: 12 turns
Effect: Volume of 30' diameter
This spell creates a large ball of light, as
if a bright torch were lit. If the spell is
cast on an object (such as the cleric's
weapon), the light will move with the
object. If cast at a creature's eyes, the
creature must make a Saving Throw. If
the Saving Throw is failed, the victim
will be blinded by the light until the
duration ends. A blinded creature may
not attack.
Protection from Evil
Range: 0
Duration: 12 turns
Effect: The cleric only
This spell creates an invisible magical
barrier all around the cleric's body (less
than an inch away). All attacks against
the cleric are penalized by - 1 to their
+
Hit rolls, and the cleric gains a 1 bonus
to all Saving Throws, while the spell
lasts.
In addition, "enchanted" creatures
cannot even touch the cleric! If a magic
weapon is needed to hit a creature, that
creature is called "enchanted." However,
a creature that can be hit by a silver
weapon - a lycanthrope (were-crea-
ture), for example - is not an "en-
chanted" creature. Any creature which is
magically summoned or controlled (such
as a Charmed character) is also consid-
ered to be an "enchanted" creature. The
barrier thus completely prevents all at-
tacks from those creatures unless they
use missile weapons.
This spell will not affect a Magic
Missile (magic-user's) spell. If the cleric
attacks anything during the spell's dura-
tion, the effect changes slightly. "En-
chanted" creatures are then able to
touch the magic-user, but the Hit roll
and Saving Throw adjustments still ap-
ply until the spell duration ends.
Purify Food and Water
Range: 10'
Duration: Permanent
Effect: See below
This spell will make spoiled or poisoned
food and water safe and usable. It will
purify one ration of food (either Iron or
Standard rations), or 6 waterskins of
water, or enough normal food to feed a
dozen people. I f cast at mud, the spell
will cause the dirt to settle, leaving a pool
of pure, clear water. The spell will not
affect any living creature.
Remove Fear*
Range: Touch
Duration: 2 turns
Effect: Any one living creature
When the cleric casts this spell and then
touches any living creature, the spell will
calm the creature and remove any fear.
If the creature is running away due to
magically created fear, the creature may
make another Saving Throw vs. spells,
adding a bonus to the roll equal to the
cleric's Level of Experience, up to a
maximum bonus of + 6 . If the Saving
Throw is successful, the creature may
stop running. A roll of 1 will always fail.
This Saving Throw, with bonus, may be
made even if the fear was so powerful as
to allow no Saving Throw at first!
Resist Cold
Range: 0
Duration: 6 turns
Effect: All creatures within 30'
When this spell is cast, all creatures
within 30' of the cleric can withstand
freezing temperatures without harm. In
addition, those affected gain a bonus of
+ 2 to all Saving Throws against cold
attacks. Furthermore, any damage from
cold is reduced by - 1 per die of damage
(but with a minimum of 1 point of
damage per die). The effect will move
with the cleric.

[Basic pages 38-42: TSV column-reflowed magic-user spell books and descriptions]
Spell Books:
Your Medium (1st Level magic-user)
starts with a spell book, containing two
First Level spells. Your Dungeon Master
will tell you what spells your character
starts with. The spell book is a large
bulky thing, and cannot be easily car-
ried. A spell book is about 2 feet square,
2-6 inches thick, and weighs at least 20
pounds. It will not fit inside a normal
sack of any size, but may be carried in a
backpack or saddlebag.
When your character becomes a Seer,
you will add another First Level spell to
the book; again, your DM will tell you
which spell. Upon reaching 3rd Level of
Experience, a Second Level spell will be
gained. When the 4th Level of Experi-
ence is reached, another Second Level
spell is added to the book. (Magic-users
of levels 4-14 are explained in the D&D
EXPERT Set.)
Assume that your character is given
these additional spells by a teacher, a
powerful magic-user of 7th Level or
greater. All magic-users of less than that
level must have teachers. These teachers
never go on adventures with characters.
They will not affect most games.
Different magic-users often have dif-
ferent spells in their books. For example,
you might start with the Read Magic
and Sleep spells, and find another
magic-user who knows Read Magic and
Magic Missile. But magic-users never
trade spells, nor d o they ever allow
anyone (except their teachers) to read
their spell books. The risk of losing the
book or having it damaged, is too great.
If a magic-user's book is lost, the charac-
ter cannot memorize any spells to cast!
One magical treasure which may be
found during an adventure is a magic
scroll. Some scrolls contain magic-user
spells. If a new spell is found on a scroll, it
may be added to the magic-user's book -
but this can only be done once for each
scroll spell, and uses up the scroll in the
process. If the spell is of too high a level to
be cast, it cannot be put into the book.
A spell on a scroll may be saved, to be
put into a book at a future time. It may
also be carried during adventures, to be
cast as needed. Any magic-user can cast
a spell found on a scroll as if it were
memorized, regardless of the level of the
spell. If the spell is cast, it disappears
from the scroll.
You, the player, need only keep a list
of which of the many spells are in your
character's book. Keep the list on your
character sheet, under "Special Abili-
ties." Scrolls are magic items, listed on
the back of the character sheet.
Learning Spells:
To learn a spell, the magic-user must be
completely rested. A good night's sleep
is enough. The character then gets out
the spell book and studies the spells to be
used, which takes an hour or less. The
character is then ready for adventure,
and is able to cast the spell or spells
studied.
A Medium can cast one spell per ad-
venture. A Seer can cast two First Level
spells per adventure. A Conjurer can
cast 3 spells per adventure, two of the
First Level of Power and one of the
Second Level.
In more advanced games, adventures
may last more than a day. In such cases,
a magic-user can study spells each morn-
ing, if completely rested. A mule should
be brought along on long adventures, to
carry the spell book along with normal
equipment. But beware! If the book is
lost, the character is in big trouble. If
that happens, ask your Dungeon Master
what you should do.
Don't confuse the spells memorized
with spells in a book! Your magic-user
character will eventually have many
spells in a spell book, but can still only
memorize a few each day.
Casting Spells:
In the game, when you want your char-
acter to cast a spell, just tell your Dun-
geon Master.
When the magic-user casts a spell, the
memory of that spell is forgotten. Imag-
ine that the magic-user's memory is like
a blackboard. When studying, the char-
acter "writes spells on the blackboard,"
but each spell is "erased" as it is cast. If
your character has studied a spell twice
and casts one, the other still remains to
be used.
The character must be able to gesture
and speak without interruption to cast a
spell. While casting a spell, the magic-
user must concentrate, and may not
move. A spell cannot be cast while the
character is walking or running. If the
magic-user is disturbed while casting a
spell, the spell will be ruined, and will
still be "erased," just as if it had been
cast.
Types of Spells:
Most spells have an effect that lasts for a
given time. For example, a Magic Missile
spell creates a glowing arrow that follows
the magic-user around, either until it is
shot or until a turn passes (10 minutes).
However, some higher level spells may
have "instant" duration. A Fire Ball spell
creates a n explosion which causes
damage. The damage remains until
cured, but the spell itself only lasts part
of a second, much less than a round.
Saving throws vs. Spells:
Many spells only have full effect if the
victim fails a Saving Throw (vs. spells). If
a Saving Throw is allowed, it is men-
tioned in the spell description.
Magic-user Spells:
Each spell has a given Range, Duration,
and Effect.
Range: The character should be sure,
before casting the spell, that the target is
within range. If the description says
"Range: 0," the spell may only be used
by the magic-user, and cannot be cast on
others. If "Range: Touch" is given, the
spell can be placed on any creature the
magic-user touches - including the
magic-user himself (or herself, as the
case may be).
Duration is given either in rounds (of 10
seconds each) or turns (of 10 minutes
each). If the description says "Duration:
Permanent," then the spell has an in-
stant and permanent effect that does not
go away after a given duration.
Effect of the spell gives either the num-
ber of creatures or objects affected, o r
an area or volume of space. If an area is
given, it is measured in square feet (a flat
area). If a 3-dimensional volume is af-
fected, it is either a round "ball" with a
given diameter, or a square or rectangu-
lar "box" of a given size; both are mea-
sured in feet.
Magical Spell Descriptions
FIRST LEVEL MAGIC-USER SPELLS
1. Charm Person
2. Detect Magic
3. Floating Disc
4. Hold Portal
5 . Light
6. Magic Missile
7. Protection from Evil
8. Read Languages
9. Read Magic
10. Shield
11. Sleep
12. Ventriloquism
Charm Person
Range: 120'
Duration: See below
Effect: One living "person" (see below)
This spell will only affect humans, demi-
humans, and certain other creatures.
The victim is allowed a Saving Throw vs.
Spells. If the Saving Throw is successful,
the spell has no effect. If it is failed, the
victim will believe that the magic-user is
its "best friend," and will try to defend
the magic-user against any threat,
whether real or imagined. The victim is
"Charmed."
As a general rule, the "persons" af-
fected by this spell are all creatures
which look similar to humans in various
ways. It will not affect animals, magical
creatures (such as living statues), o r
human-like creatures larger than ogres.
You will learn, through trial and error,
which monsters can be charmed.
If the magic-user can speak a lan-
guage that the Charmed victim under-
stands, the magic-user may give orders
to the victim. These orders should
sound like suggestions, as if ' ) u t be-
tween friends." These orders will usually
be obeyed, but orders that are contrary
to the victim's nature (alignment and
habits) may be resisted. A victim will
refuse to obey if ordered to kill itself.
A Charm may last for months. The
victim may make another Saving Throw
every day, week, or month, depending
on its Intelligence. If you are Charmed,
your DM will tell you when to make the
new Saving Throw.
The Charm is automatically broken if
t h e magic-user attacks t h e victim,
whether by spell or by weapon. The
victim will fight normally if attacked by
the magic-user's allies.
Detect Magic
Range: 0
Duration: 2 turns
Effect: Everything within 60'
When this spell is cast, the magic-user
will see all magical objects, creatures,
and places within range glow. This effect
will not last very long, and should be
saved until the magic-user wants to see if
something found during an adventure
is, in fact, magical. Example: Shortly
after casting this spell, a magic-user
walks into a room containing a door
locked by magic, a magical potion laying
nearby, and a treasure chest containing a
magic wand. All the magic will glow, but
only the door and potion will be seen;
the light of the glowing wand is hidden
by the treasure chest.
Floating Disc
Range: 0
Duration: 6 turns
Effect: Disc remains within 6'
This spell creates an invisible magical
horizontal platform about the size and
shape of a small round shield. It can
carry up to 5000 cn (500 pounds). It
cannot be created in a place occupied by
a creature or object. The floating disc is
created at the height of the magic-user's
waist, and will always remain at that
height. It will automatically follow the
magic-user, remaining within 6' at all
times. It can never be used as a weapon,
because it has no solid existence and
moves slowly. When the duration ends,
the floating disc will disappear, suddenly
dropping anything upon it.
Hold Portal
Range: 10'
Duration: 2-12 (2d6) turns
Effect: One door, gate, or similar
portal
This spell will magically hold shut any
"portal" - for example, a door or gate.
A Knock spell will open the Hold Por-
tal. Any creature 3 or more hit dice
greater than the caster (including char-
acters) may break open a held portal in
one round's time, but the portal will
relock if allowed to close within the
duration of the spell.
Light
Range: 120'
Duration: 6 turns + 1 turn per Level of
the magic-user
Effect: Volume of 30' diameter
This spell creates a large ball of light, as
if a bright torch were lit. If the spell is
cast on an object (such as a coin), the
light will move with the object. If cast at
a creature's eyes, the creature must
make a Saving Throw. If the Saving
Throw is failed, the victim will be
blinded by the light until the duration
ends. A blinded creature may not attack.
If the Saving Throw is successful, the
Light appears in the air behind the
intended victim.
Magic Missile
Range: 150'
Duration: 1 round
Effect: Creates 1 or more arrows
A Magic Missile is a glowing arrow,
created and shot by magic, which inflicts
2-7 ( 1d6 + 1) points of damage to any
creature it strikes. After the spell is cast,
the arrow appears next to the magic-
user and hovers there until the magic-
user causes it to shoot. When shot, it will
automatically hit any visible target. It will
move with the magic-user until shot or
until the duration ends. The Magic Mis-
sile actually has no solid form, and
cannot be touched. A Magic Missile
never misses its target and the target is
not allowed a Saving Throw.
For every 5 levels of experience of the
caster, two more missiles are created by
the same spell. Thus a 6th Level Magic-
user may create three missiles. The mis-
siles may be shot at different targets.
Protection from Evil
Range: 0
Duration: 6 turns
Effect: The magic-user only
This spell creates an invisible magical
barrier all around the magic-user's body
(less than an inch away). All attacks
against the magic-user are penalized by
- 1 to their Hit rolls, and the magic-user
gains a +1 bonus to all Saving Throws,
while the spell lasts.
In addition, "enchanted" creatures
cannot even touch the magic-user! If a
magic weapon is needed to hit a crea-
ture, that creature is called "enchanted."
However, a creature that can be hit by a
silver weapon - a lycanthrope (were-
creature), for example - is not an "en-
chanted" creature. The barrier thus
completely prevents all from attacks
from those creatures unless they use
missile weapons.
This spell will not affect a Magic Mis-
sile spell. If the Magic-user attacks any-
thing during the spell's duration, the
effect changes slightly. "Enchanted"
creatures are then able to touch the
magic-user, but the Hit roll and Saving
Throw adjustments still apply until the
spell duration ends.
Read Languages
Range: 0
Duration: 2 turns
Effect: The magic-user only
This spell will allow the magic-user to
read, not speak, any unknown languages
or codes, including treasure maps, secret
symbols, and so forth, until the duration
ends.
Read Magic
Range: 0
Duration: 1 turn
Effect: The magic-user only
This spell will allow the magic-user to
read, not speak, any magical words or
runes, such as those found on magic
scrolls and other items. Unfamiliar
magic writings cannot be understood
without using this spell. However, once a
magic-user reads a scroll or runes with
this spell, that magic can be read or
spoken later (without) using a spell. All
spell books are written in magical words,
and only their owners may read them
without using this spell.
Shield
Range: 0
Duration: 2 turns
Effect: The magic-user only
This spell creates a magical barrier all
around the magic-user (less than an inch
away). It moves with the magic-user.
While the duration lasts, the magic-user
becomes Armor Class 2 against missiles,
and AC 4 against all other attacks.
If a Magic.Missile is shot at a magic-
user protected by this spell, the magic-
user may make a Saving Throw VS.
Spells (one Saving Throw per missile). If
successful, the Magic Missile will have
no effect.
Sleep
Range: 240'
Duration: 4-16 (4d4) turns
Effect: 2-16 Hit Dice of living creatures
within a 40' square area
This spell will put creatures to sleep for
up to 16 turns. It will only affect creatures with 4+1 Hit Dice or less - gener-
ally, small or man-sized creatures. All the
creatures to be affected must be within a
40' x 40' area. The spell will not work
against Undead or very large creatures,
such as dragons. Any sleeping creature
can be awakened by force (such as a slap
or kick). A sleeping creature may be
killed with a single blow of any edged
weapon, regardless of its hit points.
Your Dungeon Master will roll to find
the total Hit Dice of monsters affected,
using 2d8. The victims get no Saving
Throw.
Ventriloquism
Range: 60'
Duration: 2 turns
Effect: One item or location
This spell will allow the magic-user to
make the sound of his or her voice to
come from somewhere else, such as a
statue, animal, dark corner, and so forth.
Continual Light
Range: 120'
Duration: Permanent
Effect: Volume of 60' diameter
This spell creates a globe of light 60'
across. It is much brighter than a torch,
but not as bright as full daylight. It will
continue to glow forever, or until magically removed. It may be cast on an
object,just as the first level light spell. If
cast at a creature's eyes, the victim must
make a Saving Throw vs. S,pells. If the
Saving Throw is failed, the victim is
blinded. If the Saving Throw is success-
ful, the globe will still appear, but will
remain in the place it was cast, and the
intended victim will suffer no ill effects.
Detect Evil
Range: 60'
Duration: 2 turns
Effect: Everything within 60'
When this spell is cast, the magic-user
will see all evilly enchanted objects
within 60' glow. It will also cause crea-
tures that want to harm the magic-user
to glow when they are within range. The
actual thoughts of the creatures cannot
be heard. Remember that "Chaotic"
does not automatically mean Evil, al-
though many Chaotic monsters have evil
intentions. Traps and poison are neither
good nor evil, merely dangerous.
Invisibility
Range: 240'
Duration: Permanent until broken
Effect: One creature or object
This spell will make any one creature o r
object invisible. When a creature be-
comes invisible, all items carried and
worn also become invisible. Any invisible
item becomes visible again when it leaves
the creature's possession (dropped, set
down, etc.). If the magic-user makes an
object invisible that is not being carried
or worn, it will become visible again
when touched by any living creature. An
invisible creature will remain invisible
until he or she attacks or casts any spell.
A light source (such as a torch) may be
made invisible, but the light given off
will always remain visible.
SECOND LEVEL
MAGIC-USER SPELLS
1. Continual Light
2. Detect Evil
3 . Detect Invisible
4. ESP
5. Invisibility
6. Knock
7. Levitate
8. Locate Object
9. Mirror Image
10. Phantasmal Force
11. Web
12. Wizard Lock
ESP
Range: 60'
Duration: 12 turns
Effect: All thoughts in one direction
This spell will allow the magic-user to
"hear" thoughts. The magic-user must
concentrate in one direction for six
rounds (1 minute) to ESP the thoughts
of a creature within range (if any). Any
single living creature's thoughts may be
understood, regardless of the language.
The thoughts (if any) of Undead crea-
tures cannot be "heard" with this spell.
If more than one creature is within
range and in the direction concentrated
on, the magic-user will "hear" a con-
fused jumble of thoughts. The magic-
user may only sort out the jumble by
concentrating for an extra six rounds to
find a single creature. The ESP will not
be hampered by any amount of wood or
liquid, and will penetrate as much as 2
feet of rock, but a thin coating of lead
will block the spell.
Detect Invisible
Range: 10' per Level of the Magic-user
Duration: 6 turns
Effect: The magic-user only
When this spell is cast, the magic-user
can see all invisible creatures and objects
within range. The range is 10' for each
level of the magic-user. For example, a
Conjurer can use this spell to see invisi-
ble things within 30'.
Knock
Range: 60'
Duration: See below
Effect: One lock or bar
This spell will open any type of lock.
Any normal or magically locked door
(by a Hold Portal or Wizard Lock spell),
and any secret door, may be opened
when found (but a secret door must be
found before it can be Knocked open).
Any locking magic will remain, however,
and will take affect once again when the
door is closed. This spell will also cause a
gate to open, even if stuck, and will
cause any treasure chest to open easily. It
will also cause a barred door to open,
magically forcing the bar to fall to the
floor. If a door is locked and barred, both
will be opened.
Levitate
Range: 0
Duration: 6 turns + 1 turn per Level of
the magic-user
Effect: The magic-user only
When this spell is cast, the magic-user
may move up or down in the air without
any support. This spell does not, how-
ever, allow the magic-user to move from
side to side. For example, a magic-user
could levitate to a ceiling, and then could
move sideways by pushing and pulling.
Motion up or down is at the rate of 20'
per round. The spell cannot be cast on
another person or object. The magic-
user may carry a normal amount of
weight while levitating, possibly another
man-sized creature if not in metal ar-
mor. Any creature smaller than man-size
can be carried, unless similarly heavily
laden.
Locate Object
+
Range: 60'
10' per Level of the
magic-user
Duration: 2 turns
Effect: One object within range
For this spell to be effective in finding an
object, the magic-user must know ex-
actly what the object looks like. A com-
mon type of object, such as a flight of
stairs, can also be detected by this spell.
The spell will point to the nearest de-
sired object within range, giving the
direction but not the distance. The range
increases as the magic-user gains Levels
of experience. For example, a Seer can
locate objects up to 80' away; a Conjurer,
up to 90'.
Mirror Image
Range: 0
Duration: 6 turns
Effect: The magic-user only
With this spell, the magic-user creates
1-4 (1d4) additional images which look
and act exactly the same as the magic-
user. The images appear and remain
next to the magic-user, moving if the
magic-user moves, talking if the magic-
user talks, and so forth. The magic-
user need not concentrate; the images
will remain until the duration ends, or
until hit. The images are not real, and
cannot actually d o anything. Any suc-
cessful attack on the magic-user will
strike an image instead, which will
merely cause that image to disappear
(regardless of the actual damage).
Phantasmal Force
Range: 240'
Duration: Concentration (see below)
Effect: A volume 2O'x2O'x20'
This spell creates or changes appearances within the area affected. The
magic-user should create the illusion of
something he or she has seen. If not, the
DM will give a bonus to Saving Throws
against the spell's effects. If the magic-
user does not use this spell to attack, the
illusion will disappear when touched. If
the spell is used to "create" a monster, it
will be AC 9 and will disappear when hit.
If the spell is used as an attack (a phan-
tasmal magic missile, collapsing wall,
etc.), the victim may make a Saving
Throw vs. Spells; if successful, the victim
is not affected, and realizes that the
attack is an illusion. The phantasmal
force will remain as long as the magic-
user concentrates. If the magic-user
moves, takes any damage, or fails any
Saving Throw, the concentration is bro-
ken and the phantasm disappears.
This spell never inflicts any real
damage! Those "killed" by it will merely
fall unconscious, those "turned to stone"
will be paralyzed, and so forth. The
effects wear off in 1-4 (1d4) turns.
Web
Range: 10'
Duration: 48 turns
Effect: A volume 10' x 10' x 10'
This spell creates a mass of sticky strands
which are difficult to destroy except with
flame. It usually blocks the area affected.
Giants and other creatures with great
strength can break through a web in 2
rounds. A human of average Strength (a
score of 9-12) will take 2-8 (2d4) turns to
break through the web. Flames (from a
torch, for example) will destroy the web
in 2 rounds, but all creatures within the
web will be burned for 1-6 (1d6) points
of damage. Anyone wearing Gauntlets
of Ogre Power (a magical treasure) can
break free of a web in 4 rounds.
Wizard Lock
Range: 10'
Duration: Permanent
Effect: One portal or lock
This spell is a more powerful version of
a Hold Portal spell. It will work on any
lock, not merely doors, and will last
forever (or until magically dispelled).
However, a Knock spell can be used to
open the Wizard Lock. A wizard locked
door may be opened easily by the magic-
user casting the Wizard Lock, and also
by any magic-using character or crea-
ture of 3 or more Levels (or Hit Dice)
greater than the caster. Any such open-
ing does not remove the magic, and the
lock will relock when allowed to close
(just as the Hold Portal spell).

```

### Higher Level Spells, Magic-User Spell Allocation, and Lost Spell Books

- Extraction note: anchored TSV extraction from DM pages for higher-level cleric/magic-user procedures and spell-allocation doctrine, with curated fallback when anchor quality drops below required section coverage.

```text
[Basic DM page 17: Higher Level Spells]
Higher Level Spells

The following spells are only for the DM's use when developing NPCs of an experience level higher than 3rd. The spells given are not the only spells of these higher levels. A full list of higher level spells is given in the D&D EXPERT Set. For now, the DM should use these as the only higher level spells available to NPCs.

Higher level spell casters will never go on adventures with player characters. They may be encountered as part of an NPC party, but make very dangerous enemies, and should rarely be used.

These spells might also be found on magical scrolls (treasure). The DM should be very careful when allowing this, as lower level characters should not become as powerful as these spells permit.

HIGH LEVEL CLERICS

Level   Spells
4       2 First level, 1 Second level
5       2 First level, 2 Second level

Second Level Cleric Spells
1. Bless*
2. Hold Person
3. Silence 15' radius

Explanation of Second Level Clerical Spells

Bless*
Range: Touch
Duration: 6 turns
Effect: All friends within 60'

This spell raises the morale of all friendly creatures in range by +1, and gives a bonus of +1 to all their Hit and Damage rolls. It only affects those not yet in battle.

Hold Person
Range: 180'
Duration: 9 turns
Effect: 1-4 persons (cleric's choice)

This spell will affect any human, demi-human or human-like creature (such as bugbears, gnolls, gnomes, hobgoblins, kobolds, lizard men, ogres, orcs, pixies or sprites). It will not affect undead nor creatures of 5 Hit Dice or more. The victim(s) must make a Saving Throw vs. Spells or be paralyzed.

This spell may be cast either at a single creature or at a group. If cast at a single creature, that victim must make a Saving Throw vs. Spells with a -2 penalty to the die roll. If cast at a group, it may affect up to 4 creatures, but no penalties apply to the Saving Throws.

Silence 15' Radius
Range: 180'
Duration: 12 turns
Effect: A spherical volume 30' across

This spell will make the given area totally quiet. Conversation and spells in this area will be prevented for the duration of the spell. This spell does not prevent a person within the area from hearing noises made outside the area. If cast at a creature, the victim must make a Saving Throw vs. Spells, or the silence will move along with the victim. If the Saving Throw is successful, the spell will remain in the area to which it was cast, and the intended victim may move away from it.

HIGH LEVEL MAGIC-USERS AND ELVES

Level   Spells
4       2 First Level, 2 Second Level
5       2 First Level, 2 Second Level, 1 Third Level
6       2 First Level, 2 Second Level, 2 Third Level

Third Level Magic-user Spells
1. Dispel Magic
2. Fire Ball
3. Fly

[Basic DM page 18: Third Level Magic-user Spells and spell assignment guidance]
Dispel Magic
Range: 120'
Duration: permanent
Effect: A volume 20' x 20' x 20'

This spell will automatically destroy other spell effects within the given volume. It cannot affect magic items, but will remove any spell effect created by a magic-user, elf, or cleric of a level equal to lower than the spell caster. It may fail to remove magical effects created by a higher level caster. This chance of failure is 5% per level of difference between the spell casters. A monster's level is its Hit Dice, ignoring any "plusses." For example, a 5th level elf trying to dispel a Charm Person cast by a 7th level magic-user has a 10% chance of failure.

Fire Ball
Range: 240'
Duration: instantaneous
Effect: A spherical volume 40' across

This spell creates a missile of fire which explodes into a ball of fire of 20' radius when it reaches the desired range or strikes a target. The Fire Ball inflicts 1-6 (1d6) points of fire damage for each level of the spell caster. Each victim within the area of effect takes full damage unless a Saving Throw vs. Spells is made. Even if the Saving Throw is successful, the victims take half the rolled damage. For example, a Fire Ball cast by a 6th level magic-user explodes for 6-36 (6d6) points of damage. If the total roll is 24, all within the area who make their Saving Throws take 12 points of fire damage.

Fly
Range: Touch
Duration: 1d6 turns + 1 turn per level of the spell caster
Effect: Any one living creature

This spell allows the caster (or a person touched) to fly. The spell will permit movement in any direction and at any speed up to 120' per round. It will also allow the person to stop at any point (as a Levitate spell). The person the spell is cast on has control over the flying. The exact duration is not known to anyone but the Dungeon Master. For example, a 5th level elf may fly, using this spell, for 6-11 (1d6 + 5) turns.

Giving Magic-Users Spells

When a player starts a magic-user or elf character, the player will ask you what spells the character has in the spell book. The magic-user's teacher is a higher level NPC magic-user, and the spells come from the teacher. The "spell book" assumed in the game can simply be a list of spells kept on the character sheet. You may play the role of the teacher if you wish, but this may also be assumed.

This system for spells allows you, the DM, to keep control of the spells used in the game. For example, you may wish to avoid Charm Person spells. You can avoid it simply by not giving it to the characters.

The first spell given should always be Read Magic. This allows the character to read scrolls found, and would be a basic part of the character's training.

The second spell given to a beginning magic-user character should be fairly powerful. You should avoid giving Detect Magic, Light, or Protection From Evil as the second spell, as these are nearly the same as the cleric versions (easily acquired by a 2nd or higher level cleric).

You may give any "second spell" to a beginning elf character. The elf's many talents keep that character class balanced with the others, whatever spells are known. The player of an elf can feel useful in many ways; the spell is an additional bonus, not the character's only specialty. A magic-user character is different. The magic-user has only one specialty - spells - and suffers from low hit points, poor Armor Class, and severe weapon restrictions.

For magic-user characters, good "second spells" are Charm Person, Magic Missile, Sleep (all useful attack-type spells), and Shield (a valuable protection).

[Basic player page 38: spell books and lost spell books]
Spell Books

Different magic-users often have different spells in their books. For example, you might start with the Read Magic and Sleep spells, and find another magic-user who knows Read Magic and Magic Missile. But magic-users never trade spells, nor do they ever allow anyone (except their teachers) to read their spell books. The risk of losing the book or having it damaged is too great.

If a magic-user's book is lost, the character cannot memorize any spells to cast.

One magical treasure which may be found during an adventure is a magic scroll. Some scrolls contain magic-user spells. If a new spell is found on a scroll, it may be added to the magic-user's book, but this can only be done once for each scroll spell, and uses up the scroll in the process. If the spell is of too high a level to be cast, it cannot be put into the book.

A spell on a scroll may be saved, to be put into a book at a future time. It may also be carried during adventures, to be cast as needed. Any magic-user can cast a spell found on a scroll as if it were memorized, regardless of the level of the spell. If the spell is cast, it disappears from the scroll.

```

### Magic Item Identification, Use Model, and Charge Doctrine

- Extraction note: anchored TSV extraction from Basic treasure explanatory text covering identification procedure, permanent-vs-temporary typing, concentration-based item use constraints, and non-recharge charge behavior.

```text
Identifying Magic Items
The only way to identify exactly what an
item does is by testing it (trying on the ring,
sipping the potion, etc.). If a retainer does
this testing, the retainer will expect to keep
the item. A high level NPC magic-user may
be asked to identify an item, but will want
money or a service in advance and may
take several weeks (game time, not real
time) to do it.
Types of Magic Items
There are two basic types of magic items:
Permanent items, which are not used up
(such as swords and armor), and Tempo-
rary items, which are used either once
(such as potions) or one "charge" at a time
(such as wands).
.
Using Magic Items
Any magic item must be properly used to
have any effect. A magic shield will have no
effect unless it is carried normally; a ring
must be worn on a finger to get the magical
effect.
Some Permanent items are simply for
protection. No concentration is required to
use these items. Magic weapons also func-
tion automatically.
All Temporary items are either con-
sumed (by drinking or eating) or used by
concentrating. If not consumed, the item
must be held while the user concentrates.
While using the item, the user may not
move, cast a spell, or take any other action
during that round.
Charges in Magic Items
Many Temporary items have a limited
number of charges (uses). When the last
charge is used, the item is no longer magi-
cal. It is not possible to find out how many
charges an item has, and such items cannot
be recharged.
Magic Item Descriptions:

Additional Consumables

Holy Water: This is water specially prepared by a cleric for use against undead creatures. It can be used by any character. Holy Water must be kept in small, specially prepared glass bottles known as vials for it to remain Holy. The effect of one vial of Holy Water on an undead creature is 1-8 points of damage. To cause damage, it must successfully strike the target, thus breaking the vial. It may either be thrown using missile fire rules or used in hand-to-hand combat using normal combat rules.

```

### Magical Weapons, Armor, and Cursed Item Doctrine

- Extraction note: anchored TSV extraction from treasure pages for cursed-weapon behavior, magical armor table interpretation, and cursed-armor handling prior to the scroll and ring catalog.

```text
A cursed sword will cause the player to
subtract one from all Hit Rolls and Damage
Rolls when using that weapon, instead of
giving a bonus. Once a cursed sword is
used in battle, it may not be thrown away.
If it is stolen or sold, the character is cursed
with the desire to get it back. The character
will always use that weapon when in battle.
(DM, tell the player that this is what the
character wants - and no arguments!)
Only a high level NPC magic-user or cleric
can help a character be rid of the curse.
After the curse is removed, the sword will
become a "normal" magic sword, of what-
ever type was rolled.
b. Other Weapons
As with magic swords, the "plus" number is
added to both Hit Rolls and Damage Rolls.
And as with swords, any item may be cursed,
though there is less chance with other weap
ons. Roll 1d20; if the result is 1-2, the item is
cursed. The curse is handled in the same
manner as a cursed sword.
Normal weapon restrictions apply. Since
a magic-user cannot use a sling, a magic-
user cannot use a magical sling, either.
c. Armor
Armor comes in many shapes and sizes.
The better the armor, the lower your AC
number. Magical armor and shields can
lower the AC number even further.
MAGICAL ARMOR TABLE
Type of
Normal magical Encumbrance
KC
armor
Adiustment
AC
+ 100 cn
Leather
+250 cn
Chain mail
+300 cn
Plate mail
*
*
Shield
none
Explanation of Magical Armor Table:
"Normal AC" is the AC of a character
wearing normal armor of the type given.
"Magical AC" is the AC of a character
wearing magical armor of the type given.
"Encumbrance Adjustment" is the
added amount that a character can carry
when wearing magical armor of the type
given. In other words, magical chain mail
weighs 250 cn less than non-magical chain
mail armor.
A shield + 1 would lower the AC num-
ber one more. For example, a fighter in
normal chain mail and shield would be AC
4. If a set of magical chain mail and shield
+
were found (both l), the AC would drop
1 for the armor and 1 more for the shield,
for a total of AC 2. If a + 2 shield were
used, the AC number would drop 1 more,
for a total of AC 1.
Cursed Armor: Armor and shields may be
cursed! You should roll 1d8 when either is
placed as treasure; a result of 1 indicates
that the item is cursed. Handle cursed
armor in the same manner as cursed
swords. Cursed armor makes a character
+
easier to hit by 1.
You may either select the size of the
armor found (most is human-sized) or
determine it randomly.
d. Potions
Potions are usually found in small glass
vials, similar to Holy Water. Each potion
has a different smell and taste - even two
potions with the same effect! Unless stated
otherwise, the effect of a potion lasts 7-12
turns. Only you, the DM, should know the
exact duration, and you should keep track
of it when the potion is used. The entire
potion must be drunk to have this effect. A
potion may be sipped to discover its type
and then used later. Drinking a potion
takes one round. Sipping a potion does not
decrease its effect or duration.
If a character drinks a potion while
another potion is still in effect, that charac-
ter will become sick and will be unable to
do anything (no saving throw) for 3 turns
(1/2 hour) and neither potion will have any
further effect. A potion of healing has no
duration (for this calculation). Each type of
potion is described below:
Diminution: Anyone taking this potion
will immediately shrink to 6 in height, and
can do no damage when physically attack-
ing a creature larger than 1'. The user can
slip through small cracks and has a 90%
chance of not being seen when standing
still. This potion will negate a potion of
growth.
ESP This potion will have the same effect
as the magic-user spell ESP. The user may
"hear" the thoughts (if any) of one creature
within 60' by concentrating for one full
turn in one direction. The user may "hear"
through 2 feet of rock, but a thin coating
of lead will block the ESP. Refer to the
magic-user spell (PLAYERS MANUAL,
page 41) for more information.
Gaseous Form: Upon drinking this potion,
the user's body will take the form of a cloud
of gas. Anything the user is carrying or
wearing will fall through the gaseous body
to land on the floor. The user will keep
control over his or her body, and can move
through small holes in walls, chests, and so
forth. Any creature or character in gaseous
form cannot attack, but has an AC of - 2
and cannot be harmed by non-magical
weapons.
Treasure
Growth: This potion causes the user to
grow to twice normal size, temporarily
increasing Strength and giving the ability
to inflict double damage (twice the amount
rolled) on any successful hit. The user's hit
points, however, will not increase. This
potion will negate a potion of diminution.
Healing: Like the clerical cure light
wounds s ell, drinking this potion will
restore 2-y lost hit points or will cure
paralysis for one creature.
Invisibility: This potion will have the same
effects as the magic-user spell invisibility.
The potion will make the user invisible.
When a character becomes invisible, all the
items (but not other creatures) carried and
worn by that character also become invisi-
ble. Any invisible item will become visible
once again when it leaves the character's
possession (is set down, dropped, and so
forth). See the magic-user spell (page 41) of
the PLAYERS' MANUAL) for more infor-
mation. The DM may allow players to
drink small amounts of this potion 6 times,
each drink being effective but only for 1
turn.
Levitation: Drinking this potion will have
the same effects as the magic-user spell
levitation. The user may move up or down
in the air without any support. This potion
does not enable the user to move side-to-
side. The user could, however, levitate to a
ceiling and move sideways by pushing or
pulling. Motion up or down is at a rate of
60' per round. See the magic-user spell
(page 41 of the PLAYERS MANUAL) for
more information.
Poison: Poisons look like n ormal magic
potions. If any amount of t his potion is
swallowed, even a sip, the usc :r must make
a Saving Throw vs. Poison or die! (If you
wish, you may decide that th le poison will
do a set amount of damage if the Saving
Throw is failed.)

```

### Scrolls and Spell-Adjacent Treasure Text

- Extraction note: anchored TSV extraction from treasure pages for scroll/ring/item-operation doctrine, with curated fallback to preserve section completeness if extraction anchors degrade.

```text
e. Scrolls
A scroll is a piece of old pay ier or parch-
ment upon which a high levc :1 magic-user,
elf or cleric has written a ma5 $tal formula.
To use a scroll, there must be enough light
to read by, and the scroll r nust be read
aloud. A scroll can only be used once, for
the words will fade from thc 3 scroll when
they are read aloud. A spell SI croll can only
be read by a magic-user, I Elf, or cleric
(depending on the type of spell), but a
Protection Scroll or a Treasur e Map can be
read by anyone.
Treasure
Spell Scroll: These scrolls may have 1,2, or
3 spells written on them. If more than one
spell is written on a scroll, only the spell
cast will disappear when read. Spell scrolls
may have either magic-user or cleric spells
on them. To find the type, roll 1d4:
TYPE OF SPELL ON SCROLL
Die
roll
type
Cleric spell
2-4
Magic-user spell
Magic-user spells are written in a magical
language and cannot be read until a Read
Magic spell (PLAYERS' MANUAL, page
40) is used to read it. Cleric scrolls are
written in the Common tongue but only a
cleric will understand how to use the spells.
Magic-users and elves cannot use cleric
scrolls, nor can clerics read magic-user
scrolls.
You may either choose the spells on a
Scroll or determine them randomly. If you
wish to choose them randomly, roll Id6 for
each spell and use the chart below to find
the spell level. Then roll to determine the
exact spell, using the spell lists (PLAYERS'
MANUAL, page 35, or page 17 of this
booklet for 3rd level spells).
LEVEL OF SPELL ON SCROLL
~
Die
Roll
Level
1-3
1st level
2nd level
4-5
3rd level
Cursed Scroll: Unfortunately, when any
writing on a cursed scroll is even seen, the
victim is immediately cursed. No reading is
necessary! You, the DM, must make up
each curse. Examples of a few common
curses are:
The reader turns into a frog (or some
other harmless animal).
A wandering monster of the same level
as the reader appears and attacks the
reader by surprise (a free attack with
bonuses).
One magic item owned by the reader
disappears (the item is chosen or ran-
domly determined by the DM).
The reader loses one level of experi-
ence, as if struck by a wight. (You
should roll again for a first level charac-
ter, to avoid unfair "instant death.")
5. The reader's Prime Requisite must be
rerolled.
6. Wounds will take twice as long to heal,
and healing spells only restore half nor-
mal amounts.
Only a Remove Curse spell (see the D&D
EXPERT SET) can remove a curse of this
nature. However, you may allow the cursed
character to be cured by a high level NPC
cleric or magic-user, who will demand that
the character complete a special adventure
or perform a worthy but difficult task.
Protection Scroll: A protection scroll may
be read and used by any class. When read,
it creates a circle of protection 10' across
which will move with the reader at its
center. It will prevent any of the given
creatures from entering this circle, but
does not prevent spell or missile attacks
from those creatures. The circle will be
broken if anyone protected attacks one of
the given creatures in hand-to-hand com-
bat.
Protection from Lycanthropes: When read, this
scroll will protect all those within the circle
from a variable number of lycanthropes
for 6 turns. The number of lycanthropes
affected varies according to their type, as
follows:
1-10 affected
Wererats:
Werewolves, wereboars:
1-8 affected
Weretigers, werebears:
1-4 affected
Protection f r m Undead: When read, this
scroll will protect all those within the circle
from a variable number of undead for 6
turns. The number of undead affected
varies according to their type, as follows:
Skeletons, zombies,
or ghouls:
2-24 affected
Wights, wraiths,
or mummies:
2-12 affected
Spectres (or larger):
1-6 affected
Treasure Map: A treasure map should be
made by the DM in advance, and should
show the location of some treasure hoard
in a dungeon. The DM may choose any
combination of treasures to equal the total
value given. These treasures should be
guarded by monsters. Sometimes maps are
only partially complete, or are written in
the form of riddles, and can only be read
by using a Read Languages spell.
f. Rings
A magical ring must be worn on a finger or
thumb to be used. A ring may also be
carried and put on when desired. Only one
magic ring can be worn on each hand. If
more than that are worn, none of the rings
will function, with the exception of a ring of
weakness (see below). Any ring may be used
by any character class.
Animal Control: The wearer of this ring
may command 1-6 normal animals (or 1
giant-sized). The animals are not allowed a
Saving Throw. The ring will not control
intelligent animal races or fantastic or mag-
ical monsters. The wearer must be able to
see the animals to control them. The con-
trol will last as long as the wearer concen-
trates on the animals and does not move or
fight. When the wearer stops concentrat-
ing, the animals will be free to attack their
controller or run away (roll reactions with a
penalty of -1 on the roll). This ring can
only be used once per turn.
Fire Resistance: The wearer of this ring
will not be harmed by normal fires, and
+
gains a bonus of 2 on all Saving Throws
vs. Fire Spells and vs. Red Dragon breath.
In addition, the DM must subtract 1 point
from each die of fire damage to the wearer
(with a minimum damage of 1 point per
die rolled to determine the damage).
Invisibility: The wearer is invisible as long
as the ring is worn. If the wearer attacks or
casts spells, he or she will become visible.
The wearer can only become invisible once
per turn.
Protection +1: This ring improves the
wearer's Armor Class by 1. For example, a
magic-user with no armor (AC 9) would be
AC 8 when wearing the ring. This item
also adds a bonus of $1 to all of the
wearer's Saving Throw rolls.
Water Walking: The wearer of this ring
may walk on the surface of any body of
water, and will not sink.
Weakness: When this ring is put on, the
wearer becomes weaker, and his or her
Strength score becomes 3 within 1-6
rounds. The wearer cannot take off this
ring (unless a Remove Curse spell is used,
as explained in the D&D EXPERT rules).
g. Wands, Staves, and Rods
A wand is a thin smooth stick about 18
inches long. A rod is similar, but 3 feet
long; and a staff is 2 inches thick and about
6 feet long. In D&D BASIC rules, wands
may only be used by magic-users and elves,
and staves may only be used by clerics.
(More of these items, with different
charges and usable by different classes, are
given in the EXPERT Set.) A wand con-
tains 1-10 charges when found. Each item is
described below:
Wand of Enemy Detection: When a
charge is used, this item will cause all
enemies within 60' (even those hidden or
invisible) to glow, as if on fire.
Wand of Magic Detection: When a charge
is used, this item will cause any magic item
within 20' to glow. If the item cannot
normally be seen (within a closed chest, for
example), the glow will not be seen.
Wand of Paralyzation: This wand projects
a cone-shaped ray when a charge is used.
The ray is 60' long and 30' wide at its end.
Any creature struck by the ray must make
a Saving Throw vs. Wands or be paralyzed
for 6 turns.
Staff of Healing: This item will heal 2-7
points of damage per use. It may only be
used once per day on each person, but will
heal any number of persons once a day. It
does not have nor use any charges.
Snake Staff: This magical staff is a Staff
$1, and will inflict 2-7 points of damage
per hit.
Upon command, it turns into a snake
(AC 5 , Hit Dice 3, hit points 20, Movement
60' per turn, 20' per round) and coils
around the creature struck. The command
may be spoken when the victim is hit. The
victim is allowed to make a Saving Throw
vs. Spells to avoid the serpent's coil. Any
man-sized or smaller victim will be held
helpless for 1-4 turns (unless the snake is
ordered by the owner to release the victim
before that time). Larger creatures cannot
be "coiled."
When freed, the snake crawls back to its
owner and becomes a staff once again. The
snake is completely healed when it turns
into a staff. If killed in snake form, it will
not return to staff form and loses all magi-
cal properties. This item does not have nor
use any charges.
Rod of Cancellation: This rod is usable by
any character. It will only work once, but
will drain any magic item it hits, making
that item forever non-magical. The target
is treated as having an Armor Class of 9.
The DM may adjust the Armor Class of an
item if it is being used in combat (such as
when trying to hit a sword).
h. Miscellaneous Magic Items
Each of these items is special, and is fully
described below.
Bag of Devouring: This item looks like a
normal small sack, but anything placed
within it disappears. Anyone may reach in
and find the contents by touch - if the
contents are still there! If the contents are
not removed witin 7-12 turns, they will be
forever lost. The bag will not affect living
creatures unless the entire creature is
stuffed inside the bag. This is impossible to
do except with very small creatures.
Bag of Holding: This item looks like a
normal small sack, but anything placed
within it disappears. Anyone may reach in
and find the contents by touch. The bag
will actually hold treasures up to 10,000 cn
in weight, but will only weigh 600 cn when
full. An item to be placed inside the bag
may be no larger than 10' x 5' x 3'. A
larger item will not fit inside.
Crystal Ball: This item can only be used by
an elf or magic-user. Its owner may look
into it and see any place or object thought
of. It will work 3 times per day, and the
image will only last for 1 turn. Spells cannot
be cast "through" the crystal ball. The
more familiar the object or area to be seen,
the clearer the picture will be.
Elven Cloak: The wearer of this cloak is
nearly invisible (roll 1d6; seen only on a 1).
Treasure
The wearer becomes visible when attack-
ing or casting a spell, and may not become
invisible again for a full turn.
Elven Boots: The wearer of these boots
may move with nearly complete silence
(roll 1d10; only heard on a 1).
Gauntlets of Ogre Power: These gauntlets
will give the wearer a Strength score of 18,
gaining all normal bonuses. If a weapon is
not used in combat, the wearer may strike
with one fist each round, for 1-4 points of
damage and gaining a + 3 on Hit Rolls
(only).
Helm of Alignment Changing: This item
looks like a fancy helmet. When the helm is
put on, it will immediately change the
wearer's alignment (the DM should deter-
mine the new alignment randomly). This
device may only be taken off by using a
Remove Curse spell, and the wearer will
resist the removal. Once removed, the
wearer's original alignment will return.
The DM may allow the character to re-
move it by performing a special task or
adventure.
Helm of Telepathy: This item looks like a
fancy helmet. The wearer of this helm may
send messages, by mere thought, to any
creature within 90'. The creature receiving
the thought messages will understand
them. (The creature may refuse to re-
spond.) The wearer may also read the
thoughts of a living creature within range.
To make the helm work, the wearer must
concentrate on the creature, and may not
move or cast spells. If the creature fails'a
Saving Throw vs. spells (or permits the
thought reading), the wearer will under-
stand the creature's thoughts.
Medallion of ESP: This magical medallion
is strung on a chain to be worn around the
neck. If the wearer concentrates for 1
round, he or she may read the thoughts of
any one creature within 30'. The wearer
may move normally but cannot fight nor
cast spells while concentrating. The DM
must roll 1d6 each time this item is used; it
will not work properly on a roll of 1. If this
occurs, it hill broadcast the thoughts of the
user to everyone within 30'! The DM may
allow a Saving Throw vs. Spells to prevent
the medallion from reading a creature's
thoughts.
Rope of Climbing: This 50' long, thin,

```

