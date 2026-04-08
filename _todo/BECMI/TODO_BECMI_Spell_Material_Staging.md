# TODO: BECMI Spell Material Staging

This staging document is the clean downstream aggregation layer for Chapter 06 `osr:` imports.

Rules for this artifact:
- One canonical spell record per importable Chapter 06 spell.
- Witness text stays literal to the frozen upstream staging docs; no cross-source synthesis or normalization is introduced here.
- Witness order is deterministic: Men & Magic, Greyhawk, Holmes, OD&D Family, Basic, Expert, Companion, Master, Immortals, Rules Cyclopedia.
- The staged spell source docs remain the frozen upstream truth; this file is the primary downstream import source for Chapter 06.

Upstream source files:
- `_todo/BECMI/TODO_PRE_ADD_Spell_Staging.md`
- `_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Basic.md`
- `_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Expert.md`
- `_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Companion.md`
- `_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Master.md`
- `_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Immortals.md`
- `_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md`

## Cure Light Wounds

- canonical spell key: `Cure Light Wounds`
- Chapter 06 card heading: `Cure Light Wounds`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Cure Light Wounds`
- Chapter 06 card heading: `Cure Light Wounds`

```text
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
This spell will never increase a creature’s total hit points above the original
amount.
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Cure Light Wounds`
- Chapter 06 card heading: `Cure Light Wounds`

```text
Cure Light Wounds*
When reversed, this spell, cause light
wounds, causes 2-7 points of damage to any
creature or character touched (no Saving
Throw). The cleric must make a normal
Hit roll.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Cure Light Wounds`
- Chapter 06 card heading: `Cure Light Wounds`

```text
Cure Light Wounds*
Range: Touch
Duration: Permanent
Effect: Any one living creature

   This spell either heals damage or removes pa-
ralysis. If used to heal, it can cure 2-7 (1d6 + 1)
points of damage. It cannot heal damage if used
  to cure paralysis. The cleric may cast it on him-
  self if desired.
     This spell cannot increase a creature’s total hit
  points above the original amount.
     When reversed, this spell, cause light wounds,
  causes 1d6 + 1 (2-7) points of damage to any
  creature or character touched (no saving throw is
  allowed). The cleric must make a normal attack
  roll to inflict this damage.
```

## Detect Evil

- canonical spell key: `Detect Evil`
- Chapter 06 card heading: `Detect Evil`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Detect Evil`
- Chapter 06 card heading: `Detect Evil`

```text
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
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Detect Evil`
- Chapter 06 card heading: `Detect Evil`

```text
Detect Evil
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical and Magical Spells Lists and Spell Descriptions`
- canonical spell key: `Detect Evil`
- Chapter 06 card heading: `Detect Evil`

```text
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
```

## Detect Magic

- canonical spell key: `Detect Magic`
- Chapter 06 card heading: `Detect Magic`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Detect Magic`
- Chapter 06 card heading: `Detect Magic`

```text
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
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Detect Magic`
- Chapter 06 card heading: `Detect Magic`

```text
Detect Magic
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical and Magical Spells Lists and Spell Descriptions`
- canonical spell key: `Detect Magic`
- Chapter 06 card heading: `Detect Magic`

```text
  Detect Magic
  Range: 0
  Duration: 2 turns
  Effect: Everything within 60'

     When this spell is cast, the cleric will see a
  glow surround magical objects, creatures, and
  places within the spell’s effect. The glow will not
  last very long; clerics should normally use the
  spell only when they want to know if particular
  objects already within sight are, in fact, magical.
  For example, a door may be held shut magically,
  a stranger might actually be an enchanted mon-
  ster, or a treasure might be enchanted.
```

## Light

- canonical spell key: `Light`
- Chapter 06 card heading: `Light`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Light`
- Chapter 06 card heading: `Light`

```text
Light
Range: 120'
Duration: 12 turns
Effect: Volume of 30' diameter
This spell creates a large ball of light, as
if a bright torch were lit. If the spell is
cast on an object (such as the cleric’s
weapon), the light will move with the
object. If cast at a creature’s eyes, the
creature must make a Saving Throw. If
the Saving Throw is failed, the victim
will be blinded by the light until the
duration ends. A blinded creature may
not attack.
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Light`
- Chapter 06 card heading: `Light`

```text
Light*
When reversed, this spell, darkness, creates a
circle of darkness 30' in diameter. It will
block all sight except infravision. Darkness will
cancel a light spell if cast upon it, but may
itself be cancelled by another light spell. If
cast at an opponent’s eyes, it will cause blind-
ness until cancelled, or until the duration
ends. The target is allowed a Saving Throw
and if he succeeds, the spell misses.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical and Magical Spells Lists and Spell Descriptions`
- canonical spell key: `Light`
- Chapter 06 card heading: `Light`

```text
Light*
Range: 120'
Duration: 6 turns + 1 turn/level of the caster
Effect: Volume of 30' diameter
This spell creates a large ball of light, much
like a bright torchlight. If the spell is cast on an
object (such as a coin), the light will move with
the object. If cast at a creature’s eyes, the crea-
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
nent’s eyes, it will cause blindness until
canceled, or until the duration ends; as before,
the victim does get a saving throw.
```

## Protection from Evil

- canonical spell key: `Protection from Evil`
- Chapter 06 card heading: `Protection from Evil`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Protection from Evil`
- Chapter 06 card heading: `Protection from Evil`

```text
Protection from Evil
Range: 0
Duration: 6 turns
Effect: The magic-user only
This spell creates an invisible magical
barrier all around the magic-user’s body
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
thing during the spell’s duration, the
effect changes slightly. "Enchanted"
creatures are then able to touch the
magic-user, but the Hit roll and Saving
Throw adjustments still apply until the
spell duration ends.
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Protection from Evil`
- Chapter 06 card heading: `Protection from Evil`

```text
Protection from Evil
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical and Magical Spells Lists and Spell Descriptions`
- canonical spell key: `Protection from Evil`
- Chapter 06 card heading: `Protection from Evil`

```text
Protection from Evil
Range: 0
Duration: 6 turns
Effect: The spellcaster only
This spell creates an invisible magical barrier
all around the spellcaster’s body (less than an
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
tacks (hand-to-hand) anything during the spell’s
duration, the effect changes slightly. Enchanted
creatures are then able to touch the spellcaster,
but the attack roll and saving throw adjustments
still apply until the spell duration ends.
```

## Purify Food and Water

- canonical spell key: `Purify Food and Water`
- Chapter 06 card heading: `Purify Food and Water`
- expected witness lanes: `Basic`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Purify Food and Water`
- Chapter 06 card heading: `Purify Food and Water`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Purify Food and Water`
- Chapter 06 card heading: `Purify Food and Water`

```text
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
```

## Remove Fear

- canonical spell key: `Remove Fear`
- Chapter 06 card heading: `Remove Fear`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Remove Fear`
- Chapter 06 card heading: `Remove Fear`

```text
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
cleric’s Level of Experience, up to a
maximum bonus of + 6 . If the Saving
Throw is successful, the creature may
stop running. A roll of 1 will always fail.
This Saving Throw, with bonus, may be
made even if the fear was so powerful as
to allow no Saving Throw at first!
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Remove Fear`
- Chapter 06 card heading: `Remove Fear`

```text
Remove Fear*
When reversed, this spell, cause fear, will
make any one creature flee for two turns.
The victim may make a Saving Throw vs.
Spells to avoid the effect. This reversed
spell has a range of 120'.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Remove Fear`
- Chapter 06 card heading: `Remove Fear`

```text
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
to the cleric’s level of experience (up to a maxi-
mum bonus of +6). If the saving throw is suc-
cessful, the victim’s fear is negated. Regardless of
the cleric’s level or any bonuses, a roll of 1 will
always fail.
The reversed form of the spell, cause fear, will
make any one creature flee for two turns. The
victim may make a saving throw vs. spells to
avoid the effect. This reversed spell has a range
of 120'.
```

## Resist Cold

- canonical spell key: `Resist Cold`
- Chapter 06 card heading: `Resist Cold`
- expected witness lanes: `Basic`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Resist Cold`
- Chapter 06 card heading: `Resist Cold`

```text
Resist Cold
  Range: 0
  Duration: 6 turns
  Effect: All creatures within 30'

*Spell may be cast with reverse effects in D&D EXPERT Rules.

Magic-User Spells: First Level*
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Resist Cold`
- Chapter 06 card heading: `Resist Cold`

```text
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
```

## Charm Person

- canonical spell key: `Charm Person`
- Chapter 06 card heading: `Charm Person`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Charm Person`
- Chapter 06 card heading: `Charm Person`

```text
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
to the victim’s nature (alignment and
habits) may be resisted. A victim will
refuse to obey if ordered to kill itself.
A Charm may last for months. The
victim may make another Saving Throw
every day, week, or month, depending
on its Intelligence. If you are Charmed,
your DM will tell you when to make the
new Saving Throw.
The Charm is automatically broken if
the magic-user attacks the victim,
whether by spell or by weapon. The
victim will fight normally if attacked by
the magic-user’s allies.

[Basic DM section: Charm Person Spells — save frequency by Intelligence and shapechange break]
The victim may make a new Saving Throw to break the Charm after a duration
determined by the victim’s Intelligence:
  High intelligence:    1 day
  Average intelligence: 1 week
  Low intelligence:    1 month
The Charm is automatically broken when the victim assumes animal form (e.g.,
a charmed lycanthrope who shifts to animal form is no longer Charmed).
[Source: Basic Rules, DM section ~p.29, lines 5516–5545]
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Charm Person`
- Chapter 06 card heading: `Charm Person`

```text
Charm Person
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Charm Person`
- Chapter 06 card heading: `Charm Person`

```text
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
to the victim’s nature (alignment and habits)—
he doesn’t need to roll anything to resist. A vic-
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
tacked by the spellcaster’s allies.
```

## Fireball

- canonical spell key: `Fireball`
- Chapter 06 card heading: `Fireball`
- expected witness lanes: `Basic`, `Expert`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `4`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Higher Level Spells, Magic-User Spell Allocation, and Lost Spell Books`
- canonical spell key: `Fireball`
- Chapter 06 card heading: `Fireball`

```text
Fire Ball
Range: 240'
Duration: instantaneous
Effect: A spherical volume 40' across

This spell creates a missile of fire which explodes into a ball of fire of 20' radius when it reaches the desired range or strikes a target. The Fire Ball inflicts 1-6 (1d6) points of fire damage for each level of the spell caster. Each victim within the area of effect takes full damage unless a Saving Throw vs. Spells is made. Even if the Saving Throw is successful, the victims take half the rolled damage. For example, a Fire Ball cast by a 6th level magic-user explodes for 6-36 (6d6) points of damage. If the total roll is 24, all within the area who make their Saving Throws take 12 points of fire damage.
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Fireball`
- Chapter 06 card heading: `Fireball`

```text
Fire Ball
Range: 240’
Duration: Instantaneous
Effect: Explosion in a sphere 40’ diameter
This spell creates a missile of fire that
bursts into a ball of fire of 20’ radius when
it strikes a target. Thefire ball will cause 1-6
points of fire damage per level of the
caster to every creature in the area. Each
victim may make a Saving Throw vs.
Spells; if successful, the spell will only do
half damage. For example, afire ball cast by a
6th level magic-user will burst for 6-36
points of damage, or one half the total to
those making the Saving Throw.
Character Classes - Human
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Artifact Chapter Context and Witnesses`
- canonical spell key: `Fireball`
- Chapter 06 card heading: `Fireball`

```text
  55 Fire Ball (R 240', EF 20d6 D; X11)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Fireball`
- Chapter 06 card heading: `Fireball`

```text
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
```

## Floating Disc

- canonical spell key: `Floating Disc`
- Chapter 06 card heading: `Floating Disc`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Floating Disc`
- Chapter 06 card heading: `Floating Disc`

```text
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
created at the height of the magic-user’s
waist, and will always remain at that
height. It will automatically follow the
magic-user, remaining within 6' at all
times. It can never be used as a weapon,
because it has no solid existence and
moves slowly. When the duration ends,
the floating disc will disappear, suddenly
dropping anything upon it.
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Floating Disc`
- Chapter 06 card heading: `Floating Disc`

```text
Floating Disc
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Floating Disc`
- Chapter 06 card heading: `Floating Disc`

```text
Floating Disc
Range: 0
Duration: 6 turns
Effect: Disc remains within 6'
This spell creates an invisible magical horizon-
tal platform about the size and shape of a small
round shield. It can carry up to 5000 cn (500
pounds). It cannot be created in a place occupied
by a creature or object. The floating disc is cre-
ated at the height of the spellcaster’s waist, and
will always remain at that height. It will auto-
matically follow the spellcaster at his current
movement rate, remaining within 6' of him at
all times. It can never be used as a weapon, be-
cause it has no solid existence and veers away
from anything it might run into. When the du-
ration ends, the floating disc will disappear, sud-
denly dropping anything upon it. No saving
throw is allowed.
```

## Hold Portal

- canonical spell key: `Hold Portal`
- Chapter 06 card heading: `Hold Portal`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Hold Portal`
- Chapter 06 card heading: `Hold Portal`

```text
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
one round’s time, but the portal will
relock if allowed to close within the
duration of the spell.
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Hold Portal`
- Chapter 06 card heading: `Hold Portal`

```text
Hold Portal
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Hold Portal`
- Chapter 06 card heading: `Hold Portal`

```text
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
```

## Magic Missile

- canonical spell key: `Magic Missile`
- Chapter 06 card heading: `Magic Missile`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Magic Missile`
- Chapter 06 card heading: `Magic Missile`

```text
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
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Magic Missile`
- Chapter 06 card heading: `Magic Missile`

```text
Magic Missile
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Magic Missile`
- Chapter 06 card heading: `Magic Missile`

```text
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
```

## Read Languages

- canonical spell key: `Read Languages`
- Chapter 06 card heading: `Read Languages`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Read Languages`
- Chapter 06 card heading: `Read Languages`

```text
Read Languages
Range: 0
Duration: 2 turns
Effect: The magic-user only
This spell will allow the magic-user to
read, not speak, any unknown languages
or codes, including treasure maps, secret
symbols, and so forth, until the duration
ends.
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Read Languages`
- Chapter 06 card heading: `Read Languages`

```text
Read Languages
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Read Languages`
- Chapter 06 card heading: `Read Languages`

```text
Read Languages
Range: 0
Duration: 2 turns
Effect: The spellcaster only
This spell will allow the spellcaster to read, not
speak, any unknown languages or codes, includ-
ing treasure maps, secret symbols, and so forth,
until the duration ends.
```

## Read Magic

- canonical spell key: `Read Magic`
- Chapter 06 card heading: `Read Magic`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Read Magic`
- Chapter 06 card heading: `Read Magic`

```text
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
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Read Magic`
- Chapter 06 card heading: `Read Magic`

```text
Read Magic
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Scrolls`
- canonical spell key: `Read Magic`
- Chapter 06 card heading: `Read Magic`

```text
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
```

## Shield

- canonical spell key: `Shield`
- Chapter 06 card heading: `Shield Ward`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Shield`
- Chapter 06 card heading: `Shield Ward`

```text
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
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Shield`
- Chapter 06 card heading: `Shield Ward`

```text
Shield
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Shield`
- Chapter 06 card heading: `Shield Ward`

```text
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
```

## Sleep

- canonical spell key: `Sleep`
- Chapter 06 card heading: `Sleep`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Sleep`
- Chapter 06 card heading: `Sleep`

```text
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
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Sleep`
- Chapter 06 card heading: `Sleep`

```text
Sleep
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Sleep`
- Chapter 06 card heading: `Sleep`

```text
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
as the spell’s target area. The spell will not work
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
creature’s hit points.
Your Dungeon Master will roll 2d8 to find the
total Hit Dice or experience levels of monsters af-
fected by the spell.
The victims get no saving throw against this
spell.
```

## Ventriloquism

- canonical spell key: `Ventriloquism`
- Chapter 06 card heading: `Ventriloquism`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions`
- canonical spell key: `Ventriloquism`
- Chapter 06 card heading: `Ventriloquism`

```text
Ventriloquism
  Range: 60'
  Duration: 2 turns
  Effect: One item or location

Magic-User Spells: Second Level
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Ventriloquism`
- Chapter 06 card heading: `Ventriloquism`

```text
Ventriloquism
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Ventriloquism`
- Chapter 06 card heading: `Ventriloquism`

```text
Ventriloquism
Range: 60'
Duration: 2 turns
Effect: One item or location
This spell will allow the spellcaster to make
the sound of his or her voice come from some-
where else, such as a statue, animal, a dark cor-
ner, and so forth. The "somewhere else" must
be within range of the spell.
```

## Bless

- canonical spell key: `Bless`
- Chapter 06 card heading: `Bless`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Higher Level Spells, Magic-User Spell Allocation, and Lost Spell Books`
- canonical spell key: `Bless`
- Chapter 06 card heading: `Bless`

```text
Bless*
Range: Touch
Duration: 6 turns
Effect: All friends within 60'

This spell raises the morale of all friendly creatures in range by +1, and gives a bonus of +1 to all their Hit and Damage rolls. It only affects those not yet in battle.
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Bless`
- Chapter 06 card heading: `Bless`

```text
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
- 1 penalty on enemies’ morale, Hit rolls,
and damage rolls. Each victim may make a
Saving Throw vs. Spells to avoid the penal-
ties.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Bless`
- Chapter 06 card heading: `Bless`

```text
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
penalty on enemies’ morale, attack rolls, and
damage rolls. Each victim may make a saving
throw vs. spells to avoid the penalties.
```

## Continual Light

- canonical spell key: `Continual Light`
- Chapter 06 card heading: `Continual Light`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions -> Magic-User Spells: Second Level`
- canonical spell key: `Continual Light`
- Chapter 06 card heading: `Continual Light`

```text
Continual Light
Range: 120'
Duration: Permanent
Effect: Volume of 60' diameter
This spell creates a globe of light 60'
across. It is much brighter than a torch,
but not as bright as full daylight. It will
continue to glow forever, or until magically removed. It may be cast on an
object,just as the first level light spell. If
cast at a creature’s eyes, the victim must
make a Saving Throw vs. S,pells. If the
Saving Throw is failed, the victim is
blinded. If the Saving Throw is success-
ful, the globe will still appear, but will
remain in the place it was cast, and the
intended victim will suffer no ill effects.
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Continual Light`
- Chapter 06 card heading: `Continual Light`

```text
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
cast on an opponent’s eyes, the victim must
make a Saving Throw vs. Spells or be
blinded until the effect is removed. This
spell may be cast either in an area or upon
an object.
The reverse of this spell, continual dark-
ness, creates a completely dark volume of
the same size. Torches, lanterns, and even
a light spell will not affect it, and infravision
cannot penetrate it. If cast on a creature’s
eyes, the creature must make a Saving
Throw vs. Spells or be blinded until the
spell is removed.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical and Magical Spells Lists and Spell Descriptions`
- canonical spell key: `Continual Light`
- Chapter 06 card heading: `Continual Light`

```text
Continual Light*
Range: 120'
Duration: Permanent
Effect: Volume of 60' diameter
This spell creates a globe of light 60' across. It
is much brighter than a torch, but not as bright
as full daylight. It will continue to glow forever,
or until it is magically removed. It may be cast on
an object, just as the first level light spell. If cast
at a creature’s eyes, the victim must make a sav-
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
trate it. If cast on a creature’s eyes, the creature
must make a saving throw vs. spells or be blind-
ed until the spell is removed. A continual light
spell will cancel its effects.
```

## Continual Darkness

- canonical spell key: `Continual Darkness`
- Chapter 06 card heading: `Continual Darkness`
- expected witness lanes: `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `1`

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `RC: Reverse Spell Synthesized Notes`
- canonical spell key: `Continual Darkness`
- Chapter 06 card heading: `Continual Darkness`

```text
Continual Darkness
Range: 120'
Duration: Permanent
Effect: Volume of 60' diameter (30' radius)
[RC + Expert synthesis: reverse of continual light (C3/MU2); sources: Expert MU2 Spell Expansions, RC Clerical and Magical Spells List]
Continual darkness creates a completely dark volume of 60' diameter (30' radius). Torches, lanterns, and even a light spell will not affect it, and infravision cannot penetrate it. A continual light spell will cancel its effects. If cast directly on a creature’s eyes, the creature must make a saving throw vs. spells or be blinded until the spell is removed.
```

## Cure Blindness

- canonical spell key: `Cure Blindness`
- Chapter 06 card heading: `Cure Blindness`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Cure Blindness`
- Chapter 06 card heading: `Cure Blindness`

```text
Cure Blindness
Range: Touch
Duration: Permanent
Effect: One living creature
This spell will cure nearly any form of
blindness, including those caused by light
or darkness spells (whether normal or con-
tinual). It will not, however, affect blind-
ness caused by a curse.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Cure Blindness`
- Chapter 06 card heading: `Cure Blindness`

```text
Cure Blindness
Range: Touch
Duration: Permanent
Effect: One living creature
This spell will cure nearly any form of blind-
ness, including those caused by light or darkness
spells (whether normal or continual). It will not,
however, affect blindness caused by a curse.
```

## Cure Disease

- canonical spell key: `Cure Disease`
- Chapter 06 card heading: `Cure Disease`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Cure Disease`
- Chapter 06 card heading: `Cure Disease`

```text
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
on all Hit rolls. In addition, the victim’s
wounds cannot be magically cured; and
natural healing takes twice as long as usual.
The disease is fatal in 2-24 days unless re-
moved by a cure disease spell.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Cure Disease`
- Chapter 06 card heading: `Cure Disease`

```text
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
rolls. In addition, the victim’s wounds cannot be
magically cured, and natural healing takes twice
as long as usual. The disease is fatal in 2d12 (2-
24) days unless removed by a cure disease spell.
```

## Find Traps

- canonical spell key: `Find Traps`
- Chapter 06 card heading: `Find Traps`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Find Traps`
- Chapter 06 card heading: `Find Traps`

```text
Find Traps
Range: 0 (Cleric only)
Duration: 2 turns
Effect: Traps within 30' glow
This spell causes all traps to glow with a
dull blue light when the cleric comes within
30' of them. It does not reveal the types of
traps, nor any method of removing them.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Find Traps`
- Chapter 06 card heading: `Find Traps`

```text
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
```

## Animal Growth

- canonical spell key: `Animal Growth`
- Chapter 06 card heading: `Animal Growth`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Animal Growth`
- Chapter 06 card heading: `Animal Growth`

```text
Growth of Animal
Range: 120'
Duration: 12 turns
Effect: Doubles the size of one animal
This spell doubles the size of one normal
or giant animal. The animal then has twice
its normal strength and inflicts double nor-
mal damage. It may also carry twice its nor-
mal encumbrance. This spell does not
change an animal’s behavior. Armor Class,
or hit points, and does not affect intelligent
animal races or fantastic creatures.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Animal Growth`
- Chapter 06 card heading: `Animal Growth`

```text
Growth of Animal
Range: 120'
Duration: 12 turns
Effect: Doubles the size of one animal
This spell doubles the size of one normal or
giant animal. The animal then has twice its nor-
mal strength and inflicts double its normal dam-
age. It may also carry twice its normal
encumbrance. This spell does not change an ani-
mal’s behavior, armor class, or hit points, and
does not affect intelligent animal races or
fantastic creatures.
```

## Hold Person

- canonical spell key: `Hold Person`
- Chapter 06 card heading: `Hold Person`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Higher Level Spells, Magic-User Spell Allocation, and Lost Spell Books`
- canonical spell key: `Hold Person`
- Chapter 06 card heading: `Hold Person`

```text
Hold Person
Range: 180'
Duration: 9 turns
Effect: 1-4 persons (cleric’s choice)

This spell will affect any human, demi-human or human-like creature (such as bugbears, gnolls, gnomes, hobgoblins, kobolds, lizard men, ogres, orcs, pixies or sprites). It will not affect undead nor creatures of 5 Hit Dice or more. The victim(s) must make a Saving Throw vs. Spells or be paralyzed.

This spell may be cast either at a single creature or at a group. If cast at a single creature, that victim must make a Saving Throw vs. Spells with a -2 penalty to the die roll. If cast at a group, it may affect up to 4 creatures, but no penalties apply to the Saving Throws.
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Hold Person`
- Chapter 06 card heading: `Hold Person`

```text
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
the magic-user’s choice), but with no
penalty to their rolls.
The reverse of the spell, free person, re-
moves the paralysis of up to 4 victims of
the normal form of the spell (including
one cast by a cleric). It has no other effect.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical and Magical Spells Lists and Spell Descriptions`
- canonical spell key: `Hold Person`
- Chapter 06 card heading: `Hold Person`

```text
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
up to four persons (of the cleric’s choice), but with
no penalty to their rolls. The paralysis may only be
removed by the reversed form of the spell, or by a
dispel magic spell.
The reverse of the spell, free person, removes
the paralysis of up to four victims of the normal
form of the spell (including hold person cast by a
magic-user or an elf). It has no other effect; it
does not, for instance, remove the effects of a
ghoul’s paralysis ability.
```

## Know Alignment

- canonical spell key: `Know Alignment`
- Chapter 06 card heading: `Know Alignment`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Know Alignment`
- Chapter 06 card heading: `Know Alignment`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Know Alignment`
- Chapter 06 card heading: `Know Alignment`

```text
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
```

## Locate Object

- canonical spell key: `Locate Object`
- Chapter 06 card heading: `Locate Object`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions -> Magic-User Spells: Second Level`
- canonical spell key: `Locate Object`
- Chapter 06 card heading: `Locate Object`

```text
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
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Locate Object`
- Chapter 06 card heading: `Locate Object`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical and Magical Spells Lists and Spell Descriptions`
- canonical spell key: `Locate Object`
- Chapter 06 card heading: `Locate Object`

```text
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
```

## Remove Curse

- canonical spell key: `Remove Curse`
- Chapter 06 card heading: `Remove Curse`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Remove Curse`
- Chapter 06 card heading: `Remove Curse`

```text
Remove Curse*
Range: Touch
Duration: Permanent
Effect: Removes any one curse
This spell removes one curse, whether on a
character, item, or area. Some curses - es-
pecially those on magic items - may only
be temporarily removed, DM’s discretion,
requiring a clerical dispel evil spell for per-
manent effect (or possibly a remove curse
cast by a high level magic-user).
The reverse of this spell, curse, causes a
misfortune or penalty to affect the recip-
ient. Curses are limited only by the caster’s
imagination, but if an attempted curse is
too powerful, it may return to the caster
(DM’s discretion)! Safe limits to curses may
include: - 4 penalty on Hit rolls; - 2
penalty to all Saving Throws; prime requi-
site reduced to 1/2 normal. The victim may
make a Saving Throw vs. Spells to avoid
the curse.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical and Magical Spells Lists and Spell Descriptions`
- canonical spell key: `Remove Curse`
- Chapter 06 card heading: `Remove Curse`

```text
Remove Curse*
Range: Touch
Duration: Permanent
Effect: Removes any one curse
This spell removes one curse, whether on a
character, item, or area. Some curses—especially
those on magical items—may only be temporari-
ly removed, at the DM’s discretion, requiring a
clerical dispel evil spell for permanently remov-
ing the effects (or possibly a remove curse cast by
a high-level spellcaster).
The reverse of this spell, curse, causes a mis-
fortune or penalty to affect the recipient. Curses
are limited only by the caster’s imagination, but
if an attempted curse is too powerful, it may re-
turn to the caster (DM’s discretion)! Safe limits
to curses may include: - 4 penalty on attack
rolls; - 2 penalty to all saving throws; prime req-
uisite reduced to half normal. The victim may
make a saving throw vs. spells to avoid the curse.
```

## Resist Fire

- canonical spell key: `Resist Fire`
- Chapter 06 card heading: `Resist Fire`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Resist Fire`
- Chapter 06 card heading: `Resist Fire`

```text
Resist Fire
Range: 30'
Duration: 2 turns
Effect: One living creature
For the duration of this spell, the recipient
cannot be harmed by normal fire and heat.
The recipient also gains a +2 bonus on all
Saving Throws against magical fire
(dragon’s breath, fire ball, etc.). Further-
more, damage from such fire is reduced by
1 point per die of damage (though each die
will inflict at least 1 point of damage, re-
gardless of adjustments). Red dragon
breath damage is reduced by 1 point per
hit die of the creature (again to a minimum
of 1 point of damage per hit die).
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Resist Fire`
- Chapter 06 card heading: `Resist Fire`

```text
Resist Fire
Range: 30'
Duration: 2 turns
Effect: One living creature
For the duration of this spell, normal fire and
heat cannot harm the spell’s recipient. The re-
cipient also gains a + 2 bonus on all saving
throws against magical fire (dragon’s breath,
fireball, etc.). Furthermore, damage from such
fire is reduced by 1 point per die of damage
(though each die will inflict at least 1 point of
damage, regardless of adjustments). Red dragon
breath damage is reduced by 1 point per Hit Die
of the creature (again, to no less than 1 point of
damage per Hit Die).
```

## Silence 15' Radius

- canonical spell key: `Silence 15' Radius`
- Chapter 06 card heading: `Silence 15' Radius`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Higher Level Spells, Magic-User Spell Allocation, and Lost Spell Books`
- canonical spell key: `Silence 15' Radius`
- Chapter 06 card heading: `Silence 15' Radius`

```text
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
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Silence 15' Radius`
- Chapter 06 card heading: `Silence 15' Radius`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Silence 15' Radius`
- Chapter 06 card heading: `Silence 15' Radius`

```text
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
```

## Snake Charm

- canonical spell key: `Snake Charm`
- Chapter 06 card heading: `Snake Charm`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Snake Charm`
- Chapter 06 card heading: `Snake Charm`

```text
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
snakes, the spell’s duration is 2-5 rounds;
otherwise, it lasts 2-5 turns. When the spell
wears off, the snakes return to normal (but
with normal reactions, and will not be au-
tomatically hostile).
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Snake Charm`
- Chapter 06 card heading: `Snake Charm`

```text
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
him, the spell’s duration is 1d4 + 1 (2-5) rounds;
otherwise, it lasts 1d4 +1 (2-5) turns. When the
spell wears off, the snakes return to normal (but
with normal reactions; they will not be automat-
ically hostile).
```

## Speak with Animals

- canonical spell key: `Speak with Animals`
- Chapter 06 card heading: `Speak with Animals`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Speak with Animals`
- Chapter 06 card heading: `Speak with Animals`

```text
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
named. The creatures’ reactions are usu-
usually favorable (+2 bonus to reaction roll),
and they may be talked into doing a favor
for the cleric if the reaction is high enough.
The favor requested must be understood
by the animal, and must be possible for the
creature to perform.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Speak with Animals`
- Chapter 06 card heading: `Speak with Animals`

```text
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
```

## Speak with the Dead

- canonical spell key: `Speak with the Dead`
- Chapter 06 card heading: `Speak with the Dead`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Speak with the Dead`
- Chapter 06 card heading: `Speak with the Dead`

```text
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
its death. If the spirit’s alignment is the
same as the cleric’s, clear and brief answers
will be given; however, if the alignments
differ, the spirit may reply in riddles.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Speak with the Dead`
- Chapter 06 card heading: `Speak with the Dead`

```text
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
things up to the time of its death. If the spirit’s
alignment is the same as the cleric’s, it will pro-
vide clear and brief answers; however, if the
alignments differ, the spirit may reply in riddles.
```

## Speak with Plants

- canonical spell key: `Speak with Plants`
- Chapter 06 card heading: `Speak with Plants`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Speak with Plants`
- Chapter 06 card heading: `Speak with Plants`

```text
Speak with Plants
Range: 0 (Cleric only)
Duration: 3 turns
Effect: All plants within 30'
This spell enables the cleric to talk to plants
as if they were intelligent. A simple favor
may be requested, and will be granted if it
is within the plants’ power to understand
and perform. This spell may be used to
allow the cleric and party to pass through
otherwise impenetrable undergrowth. It
will also allow communication with plant-
like monsters (such as treants).
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Speak with Plants`
- Chapter 06 card heading: `Speak with Plants`

```text
Speak with Plants
Range: 0 (Cleric only)
Duration: 3 turns
Effect: All plants within 30'
This spell enables the cleric to talk to plants as
though they are intelligent. The cleric may re-
quest a simple favor, and the plants will grant it
if it is within the plants’ power to understand
and perform. This spell may be used to allow the
cleric and party to pass through otherwise im-
penetrable undergrowth. It will also allow the
cleric to communicate with plantlike monsters
(such as treants).
```

## Sticks to Snakes

- canonical spell key: `Sticks to Snakes`
- Chapter 06 card heading: `Sticks to Snakes`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Sticks to Snakes`
- Chapter 06 card heading: `Sticks to Snakes`

```text
Sticks to Snakes
Range: 120'
Duration: 6 turns
Effect: Up to 16 sticks
This spell turns 2-16 sticks into snakes (de-
tailed below). The snakes may be poi-
sonous (50% chance per snake). They obey
the cleric’s commands, but will turn back
into sticks when slain or when the duration
ends.
Snakes: Armor Class 6, Hit Dice 1, Move
90' (30'), Attacks 1, Damage 1-4, Save As:
Fighter 1, Alignment Neutral.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Sticks to Snakes`
- Chapter 06 card heading: `Sticks to Snakes`

```text
Sticks to Snakes
Range: 120'
Duration: 6 turns
Effect: Up to 16 sticks
This spell turns 2d8 sticks into snakes (de-
tailed below). The snakes may be poisonous
(50% chance per snake; the DM can roll 1d6 for
each snake; on a roll of 1-3, the snake is poison-
ous). They obey the cleric’s commands, but will
turn back into sticks when slain or when the
spell’s duration ends.
Snakes: NA 2d8 (2d8); AC 6, HD 1; AT 1
bite; Dmg 1d4; MV 90' (30'); Save Fl; ML 12;
TT Nil; AL Neutral; SA poison (50% chance
for each snake to be poisonous); XP 10 (non-
poisonous) or 13 (poisonous).
```

## Striking

- canonical spell key: `Striking`
- Chapter 06 card heading: `Striking`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Striking`
- Chapter 06 card heading: `Striking`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Striking`
- Chapter 06 card heading: `Striking`

```text
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
```

## Animate Dead

- canonical spell key: `Animate Dead`
- Chapter 06 card heading: `Animate Dead, aka Animate Corpse`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Animate Dead`
- Chapter 06 card heading: `Animate Dead, aka Animate Corpse`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical and Magical Spells Lists and Spell Descriptions`
- canonical spell key: `Animate Dead`
- Chapter 06 card heading: `Animate Dead, aka Animate Corpse`

```text
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
Note that this doesn’t count character experi-
ence levels as Hit Dice: For purposes of this spell,
all humans and demihumans are 1 HD crea-
tures, so the remains of a 9th level thief would
be animated as a zombie with 2 HD.
Animated creatures do not have any spells,
but are immune to sleep and charm effects and
poison. Lawful clerics must take care to use this
spell only for good purpose. Animating the dead
is usually a Chaotic act.
```

## Create Water

- canonical spell key: `Create Water`
- Chapter 06 card heading: `Create Water`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Create Water`
- Chapter 06 card heading: `Create Water`

```text
Create Water
Range: 10'
Duration: 6 turns
Effect: Creates one magical spring
With this spell, the cleric summons forth
an enchanted spring from the ground or a
wall. The spring will flow for an hour,
creating enough water for 12 men and
their mounts (for that day, about 50 gal-
lons). For each of the cleric’s levels above 8,
water for twelve additional men and
mounts is created.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Create Water`
- Chapter 06 card heading: `Create Water`

```text
Create Water
Range: 10'
Duration: 6 turns
Effect: Creates one magical spring
With this spell, the cleric summons forth an
enchanted spring from the ground or a wall. The
spring will flow for an hour, creating enough wa-
ter for 12 men and their mounts (for that day,
about 50 gallons). For each of the cleric’s experi-
ence levels above 8, water for twelve additional
men and mounts is created; thus a 10th level
cleric could create water for 36 men and horses.
The cleric doesn’t have to create the maxi-
mum amount of water if he doesn’t wish to. He
might wish to create a spring which will flow for
half an hour, or a few minutes; the player need
only tell the GM how many gallons he wants the
spell to create, up to the spell’s maximum.
```

## Cure Serious Wounds

- canonical spell key: `Cure Serious Wounds`
- Chapter 06 card heading: `Cure Serious Wounds`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Cure Serious Wounds`
- Chapter 06 card heading: `Cure Serious Wounds`

```text
Cure Serious Wounds"
Range: Touch
Duration: Permanent
Effect: Any one living creature
This spell is similar to a cure light wounds
spell, but will cure one creature of 4-14
points of damage (2d6+2).
The reverse of this spell, cause serious
wounds, causes 4-14 points of damage to
any creature or character touched (no Sav-
ing Throw). The caster must make a nor-
mal Hit roll to cause the serious wound.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Cure Serious Wounds`
- Chapter 06 card heading: `Cure Serious Wounds`

```text
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
```

## Dispel Magic

- canonical spell key: `Dispel Magic`
- Chapter 06 card heading: `Dispel Magic`
- expected witness lanes: `Basic`, `Expert`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `4`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions -> Magic-User Spells: Second Level`
- canonical spell key: `Dispel Magic`
- Chapter 06 card heading: `Dispel Magic`

```text
Dispel Magic
Range: 120'
Duration: permanent
Effect: A volume 20' x 20' x 20'

This spell will automatically destroy other spell effects within the given volume. It cannot affect magic items, but will remove any spell effect created by a magic-user, elf, or cleric of a level equal to lower than the spell caster. It may fail to remove magical effects created by a higher level caster. This chance of failure is 5% per level of difference between the spell casters. A monster’s level is its Hit Dice, ignoring any "plusses." For example, a 5th level elf trying to dispel a Charm Person cast by a 7th level magic-user has a 10% chance of failure.
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Dispel Magic`
- Chapter 06 card heading: `Dispel Magic`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `High-Level Procedure Notes`
- canonical spell key: `Dispel Magic`
- Chapter 06 card heading: `Dispel Magic`

```text
  55 Dispel Magic (R 120', EF 20' cube; X8)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical and Magical Spells Lists and Spell Descriptions`
- canonical spell key: `Dispel Magic`
- Chapter 06 card heading: `Dispel Magic`

```text
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
failure is 5% per level of difference between the
spellcasters. For example, a 7th level magic-user
trying to dispel a web spell cast by a 9th level
cleric would have a 10% chance of failure.
Dispel magic will not affect a magical item
(such as a scroll, a magical sword, etc.). How-
ever, it can dispel the effects of the magical item
when that item is used (a spellcaster can cast dis-
pel magic on the victim of a ring of human con-
trol and snap him out of that control).
```

## Neutralize Poison

- canonical spell key: `Neutralize Poison`
- Chapter 06 card heading: `Neutralize Poison`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Neutralize Poison`
- Chapter 06 card heading: `Neutralize Poison`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Neutralize Poison`
- Chapter 06 card heading: `Neutralize Poison`

```text
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
```

## Dancing Lights

- canonical spell key: `Dancing Lights`
- Chapter 06 card heading: `Dancing Lights`
- expected witness lanes: `Holmes`
- missing expected witness lanes: `none`
- witness count: `1`

### Witness: Holmes

- source lane: `Holmes`
- source label: `Holmes Basic`
- staging anchor / section: `hb-dancing-lights`
- canonical spell key: `Dancing Lights`
- Chapter 06 card heading: `Dancing Lights`

```text
Dancing Lights — Level: 1 ; Range: 1 20 feet; Duration, 2
turns
This spell creates from 1 -6 lantern-like lights which
give the appearance of the illumination carried by a
party of dungeon adventurers or a similar group. The
magic-user can cause them to move, even around cor-
ners, up to the maximum range of the spell. Once cast,
the magic-user need simply speak his desire, and the
lights follow instructions, so there is no need for con-
tinued concentration.
```

## Darkness

- canonical spell key: `Darkness`
- Chapter 06 card heading: `Darkness`
- expected witness lanes: `Greyhawk`, `Holmes`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Greyhawk

- source lane: `Greyhawk`
- source label: `Greyhawk`
- staging anchor / section: `gh-darkness`
- canonical spell key: `Darkness`
- Chapter 06 card heading: `Darkness`

```text
Darkness, 5' Radius: A spell which causes total darkness within the indicated area 
making even infravision useless. It can be countered by either a Dispell Magic or a Light 
spell. Duration: 6 turns. Range 12".
```

### Witness: Holmes

- source lane: `Holmes`
- source label: `Holmes Basic`
- staging anchor / section: `hb-darkness`
- canonical spell key: `Darkness`
- Chapter 06 card heading: `Darkness`

```text
Darkness — Level 2; Range: 1 20 feet; Duration: 6 turns
Causes total darkness in an area of 50 feet radius
in which even infravision is useless. It can be countered
by a dispel magic or a light spell. (Dispel magic is a
third level spell.)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `RC: Reverse Spell Synthesized Notes (synthesized from Expert Basic section and Expert MU1 Spell Expansions, within Light*`
- canonical spell key: `Darkness`
- Chapter 06 card heading: `Darkness`

```text
Darkness
Range: 120'
Duration: 6 turns
Effect: Circle of darkness 30' in diameter
[Expert synthesis: reverse of light (C1/MU1); sources: Expert Basic Section (within Cure Light Wounds/Light), Expert MU1 Spell Expansions (within Light*). Note: Expert text says "all sight except infravision"; Holmes Basic and Greyhawk both state infravision is useless inside darkness. Synthesized block adopts Holmes/Greyhawk reading: infravision provides no benefit inside this darkness.]
When reversed, light creates darkness: a circle of darkness 30' in diameter. It blocks all sight, including infravision. Darkness will cancel a light spell if cast upon it, but may itself be cancelled by another light spell. If cast at an opponent’s eyes, the target may make a saving throw vs. spells; on a failure, the target is blinded until the spell is cancelled or the duration ends.
```

## Detect Invisible

- canonical spell key: `Detect Invisible`
- Chapter 06 card heading: `Detect Invisible`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions -> Magic-User Spells: Second Level`
- canonical spell key: `Detect Invisible`
- Chapter 06 card heading: `Detect Invisible`

```text
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
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Detect Invisible`
- Chapter 06 card heading: `Detect Invisible`

```text
Detect Invisible
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Detect Invisible`
- Chapter 06 card heading: `Detect Invisible`

```text
Detect Invisible
Range: 10' per level of the spellcaster
Duration: 6 turns
Effect: The spellcaster only
When this spell is cast, the spellcaster can see
all invisible creatures and objects within range.
The range is 10' for each level of the spellcaster.
For example, a 3rd level spellcaster can use this
spell to see invisible things within 30'.
```

## ESP

- canonical spell key: `ESP`
- Chapter 06 card heading: `ESP`
- expected witness lanes: `OD&D Family`, `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `4`

### Witness: OD&D Family

- source lane: `OD&D Family`
- source label: `OD&D Family`
- staging anchor / section: `odnd-esp`
- canonical spell key: `ESP`
- Chapter 06 card heading: `ESP`

```text
ESP: A spell which allows the user to detect the thoughts (if any) of whatever lurks behind doors or in the darkness. It can penetrate solid rock up to about 2' in thickness, but a thin coating of lead will prevent its penetration. Duration: 12 turns. Range: 6"
```

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions -> Magic-User Spells: Second Level`
- canonical spell key: `ESP`
- Chapter 06 card heading: `ESP`

```text
ESP
Range: 60'
Duration: 12 turns
Effect: All thoughts in one direction
This spell will allow the magic-user to
"hear" thoughts. The magic-user must
concentrate in one direction for six
rounds (1 minute) to ESP the thoughts
of a creature within range (if any). Any
single living creature’s thoughts may be
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
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `ESP`
- Chapter 06 card heading: `ESP`

```text
ESP*
The reverse of this spell, mindmask, may be
cast, by touch, on any one creature. The
recipient is completely immune to ESP and
all other forms of mind reading for the
duration of the spell.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `ESP`
- Chapter 06 card heading: `ESP`

```text
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
```

## Enlargement

- canonical spell key: `Enlargement`
- Chapter 06 card heading: `Enlargement`
- expected witness lanes: `Holmes`
- missing expected witness lanes: `none`
- witness count: `1`

### Witness: Holmes

- source lane: `Holmes`
- source label: `Holmes Basic`
- staging anchor / section: `hb-enlargement`
- canonical spell key: `Enlargement`
- Chapter 06 card heading: `Enlargement`

```text
Enlargement — Level 1 ; Range: 30 feet; Duration: 1 +
level of spell caster in turns
This spell increases the size and mass of the object
upon which it is cast. It doubles the size of non-living
matter, and it increases the size of living matter by one-
half. Only one object or thing can be affected by the
spell, and the caster must be able to see or touch the
object or thing in order to make the spell work. Note it
will not add to the magical nature of any object, so a
potion enlarged will simply be a single potion with a
greater volume. It will, for example, make a door
stronger, however, as an enlargement spell will cause
it to be twice as thick. In cases where the object is very
large, the spell is limited by a volume equal to 1 2 cubic
feet/level of the spell caster, i.e. a 10th level magic-
user could enlarge an object up to 120 cubic feet in
volume.
```

## Fly

- canonical spell key: `Fly`
- Chapter 06 card heading: `Fly`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Higher Level Spells, Magic-User Spell Allocation, and Lost Spell Books`
- canonical spell key: `Fly`
- Chapter 06 card heading: `Fly`

```text
Fly
Range: Touch
Duration: 1d6 turns + 1 turn per level of the spell caster
Effect: Any one living creature

This spell allows the caster (or a person touched) to fly. The spell will permit movement in any direction and at any speed up to 120' per round. It will also allow the person to stop at any point (as a Levitate spell). The person the spell is cast on has control over the flying. The exact duration is not known to anyone but the Dungeon Master. For example, a 5th level elf may fly, using this spell, for 6-11 (1d6 + 5) turns.

Giving Magic-Users Spells

When a player starts a magic-user or elf character, the player will ask you what spells the character has in the spell book. The magic-user’s teacher is a higher level NPC magic-user, and the spells come from the teacher. The "spell book" assumed in the game can simply be a list of spells kept on the character sheet. You may play the role of the teacher if you wish, but this may also be assumed.

This system for spells allows you, the DM, to keep control of the spells used in the game. For example, you may wish to avoid Charm Person spells. You can avoid it simply by not giving it to the characters.

The first spell given should always be Read Magic. This allows the character to read scrolls found, and would be a basic part of the character’s training.

The second spell given to a beginning magic-user character should be fairly powerful. You should avoid giving Detect Magic, Light, or Protection From Evil as the second spell, as these are nearly the same as the cleric versions (easily acquired by a 2nd or higher level cleric).

You may give any "second spell" to a beginning elf character. The elf’s many talents keep that character class balanced with the others, whatever spells are known. The player of an elf can feel useful in many ways; the spell is an additional bonus, not the character’s only specialty. A magic-user character is different. The magic-user has only one specialty - spells - and suffers from low hit points, poor Armor Class, and severe weapon restrictions.

For magic-user characters, good "second spells" are Charm Person, Magic Missile, Sleep (all useful attack-type spells), and Shield (a valuable protection).
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Fly`
- Chapter 06 card heading: `Fly`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Fly`
- Chapter 06 card heading: `Fly`

```text
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
```

## Invisibility

- canonical spell key: `Invisibility`
- Chapter 06 card heading: `Invisibility`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions -> Magic-User Spells: Second Level`
- canonical spell key: `Invisibility`
- Chapter 06 card heading: `Invisibility`

```text
Invisibility
Range: 240'
Duration: Permanent until broken
Effect: One creature or object
This spell will make any one creature o r
object invisible. When a creature be-
comes invisible, all items carried and
worn also become invisible. Any invisible
item becomes visible again when it leaves
the creature’s possession (dropped, set
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
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Invisibility`
- Chapter 06 card heading: `Invisibility`

```text
Invisibility
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Invisibility`
- Chapter 06 card heading: `Invisibility`

```text
Invisibility
Range: 240'
Duration: Permanent until broken
Effect: One creature or object
This spell will make any one creature or object
invisible. When a creature becomes invisible, all
items that he carries and wears also become invis-
ible. Any invisible item becomes visible again
when it leaves the creature’s possession
(dropped, set down, etc.). A light source (such
as a torch) may be made invisible, but the light
given off will always remain visible.
If the spellcaster makes an object invisible that
is not being carried or worn, it will become visi-
ble again when touched by any living creature.
An invisible creature will remain invisible until
he or she attacks or casts any spell.
```

## Invisibility 10' Radius

- canonical spell key: `Invisibility 10' Radius`
- Chapter 06 card heading: `Invisibility 10' Radius`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Invisibility 10' Radius`
- Chapter 06 card heading: `Invisibility 10' Radius`

```text
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
stowed by the spell invisibility (Basic Player’s
Guide, page 41). All items carried (whether
by the recipient or others within 10') also
become invisible.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Invisibility 10' Radius`
- Chapter 06 card heading: `Invisibility 10' Radius`

```text
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
```

## Knock

- canonical spell key: `Knock`
- Chapter 06 card heading: `Knock`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions -> Magic-User Spells: Second Level`
- canonical spell key: `Knock`
- Chapter 06 card heading: `Knock`

```text
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
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Knock`
- Chapter 06 card heading: `Knock`

```text
Knock
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Knock`
- Chapter 06 card heading: `Knock`

```text
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
```

## Levitate

- canonical spell key: `Levitate`
- Chapter 06 card heading: `Levitate`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions -> Magic-User Spells: Second Level`
- canonical spell key: `Levitate`
- Chapter 06 card heading: `Levitate`

```text
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
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Levitate`
- Chapter 06 card heading: `Levitate`

```text
Levitate
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Levitate`
- Chapter 06 card heading: `Levitate`

```text
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
sized creature (if it isn’t wearing metal armor).
Any creature smaller than man-sized can be car-
ried, unless heavily laden. No saving throw is al-
lowed.
```

## Lightning Bolt

- canonical spell key: `Lightning Bolt`
- Chapter 06 card heading: `Lightning Bolt`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Lightning Bolt`
- Chapter 06 card heading: `Lightning Bolt`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Lightning Bolt`
- Chapter 06 card heading: `Lightning Bolt`

```text
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
```

## Mirror Image

- canonical spell key: `Mirror Image`
- Chapter 06 card heading: `Mirror Image`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions -> Magic-User Spells: Second Level`
- canonical spell key: `Mirror Image`
- Chapter 06 card heading: `Mirror Image`

```text
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
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Mirror Image`
- Chapter 06 card heading: `Mirror Image`

```text
Mirror Image
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Mirror Image`
- Chapter 06 card heading: `Mirror Image`

```text
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
```

## Phantasmal Force

- canonical spell key: `Phantasmal Force`
- Chapter 06 card heading: `Phantasmal Force`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions -> Magic-User Spells: Second Level`
- canonical spell key: `Phantasmal Force`
- Chapter 06 card heading: `Phantasmal Force`

```text
Phantasmal Force
Range: 240'
Duration: Concentration (see below)
Effect: A volume 2O’x2O’x20'
This spell creates or changes appearances within the area affected. The
magic-user should create the illusion of
something he or she has seen. If not, the
DM will give a bonus to Saving Throws
against the spell’s effects. If the magic-
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
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Phantasmal Force`
- Chapter 06 card heading: `Phantasmal Force`

```text
Phantasmal Force
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Phantasmal Force`
- Chapter 06 card heading: `Phantasmal Force`

```text
Phantasmal Force
Range: 240'
Duration: Concentration (see below)
Effect: A volume 20' x 20' x 20'
This spell creates or changes appearances of
everything within the area affected. The spell-
caster can create the illusion of something he or
she has seen. If not, the DM will give a bonus to
the saving throws of those trying to ignore the
spell’s effects. If the spellcaster does not use this
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
```

## Protection from Evil 10' Radius

- canonical spell key: `Protection from Evil 10' Radius`
- Chapter 06 card heading: `Protection from Evil 10' Radius`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Protection from Evil 10' Radius`
- Chapter 06 card heading: `Protection from Evil 10' Radius`

```text
Protection from Evil 10' Radius
Range: 0
Duration: 12 turns
Effect: Barrier 20' diameter
This spell creates an invisible magical bar-
rier all around the caster, extending 10' in
all directions. The spell serves as protec-
tion from "evil" attacks (attacks by mon-
sters of an alignment other than the
caster’s). Each creature within the barrier
gains a $1 to all Saving Throws, and all
attacks against those within are penalized
by -1 to the attacker’s Hit roll while the
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical and Magical Spells Lists and Spell Descriptions`
- canonical spell key: `Protection from Evil 10' Radius`
- Chapter 06 card heading: `Protection from Evil 10' Radius`

```text
Protection from Evil 10' Radius
Range: 0
Duration: 12 turns
Effect: Barrier 20' diameter
This spell creates an invisible magical barrier
all around the caster, extending for a 10' radius
in all directions. The spell serves as protection
from attacks by monsters of an alignment other
than the caster’s. Each creature within the barri-
er gains a +1 to all saving throws, and all attacks
against those within are penalized by - 1 to the
attacker’s attack roll while the spell lasts.
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
```

## Protection from Normal Missiles

- canonical spell key: `Protection from Normal Missiles`
- Chapter 06 card heading: `Protection from Normal Missiles`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Protection from Normal Missiles`
- Chapter 06 card heading: `Protection from Normal Missiles`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Protection from Normal Missiles`
- Chapter 06 card heading: `Protection from Normal Missiles`

```text
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
creature within the spell’s range.
```

## Water Breathing

- canonical spell key: `Water Breathing`
- Chapter 06 card heading: `Water Breathing`
- expected witness lanes: `Expert`, `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `4`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Water Breathing`
- Chapter 06 card heading: `Water Breathing`

```text
Water Breathing
Range: 30'
Duration: 1 day
Effect: One air-breathing creature
This spell allows the recipient to breathe
while under water (at any depth). It does
not affect movement in any way, nor does
it interfere with the breathing of air.
```

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Water Breathing`
- Chapter 06 card heading: `Water Breathing`

```text
Water Breathing
Range: 30'
Duration: 1 day
Effect: One air-breathing creature
This spell allows the recipient to breathe
while under water (at any depth). It does not
affect movement in any way, nor does it inter-
fere with the breathing of air.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Water Breathing`
- Chapter 06 card heading: `Water Breathing`

```text
   15 Water Breathing (R 30', DR 1 day; X12)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic and Magical Spells Lists and Spell Descriptions`
- canonical spell key: `Water Breathing`
- Chapter 06 card heading: `Water Breathing`

```text
Water Breathing
Range: 30'
Duration: 1 day
Effect: One air-breathing creature
This spell allows the recipient to breathe while
under water (at any depth). It does not affect
movement in any way, nor does it interfere with
the breathing of air.
```

## Web

- canonical spell key: `Web`
- Chapter 06 card heading: `Web`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions -> Magic-User Spells: Second Level`
- canonical spell key: `Web`
- Chapter 06 card heading: `Web`

```text
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
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Web`
- Chapter 06 card heading: `Web`

```text
Web
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Web`
- Chapter 06 card heading: `Web`

```text
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
```

## Wizard Lock

- canonical spell key: `Wizard Lock`
- Chapter 06 card heading: `Wizard Lock`
- expected witness lanes: `Basic`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Basic

- source lane: `Basic`
- source label: `Basic Rules`
- staging anchor / section: `Spell Lists and Basic Spell Descriptions -> Magic-User Spells: Second Level`
- canonical spell key: `Wizard Lock`
- Chapter 06 card heading: `Wizard Lock`

```text
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

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Wizard Lock`
- Chapter 06 card heading: `Wizard Lock`

```text
Wizard Lock
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Wizard Lock`
- Chapter 06 card heading: `Wizard Lock`

```text
Wizard Lock
Range: 10'
Duration: Permanent
Effect: One portal or lock
This spell is a more powerful version of a hold
portal spell. It will work on any lock, not merely
doors, and will last forever (or until magically
dispelled). However, a knock spell can open the
```

## Anti-Magic Shell

- canonical spell key: `Anti-Magic Shell`
- Chapter 06 card heading: `Anti-Magic Shell`
- expected witness lanes: `Expert`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Anti-Magic Shell`
- Chapter 06 card heading: `Anti-Magic Shell`

```text
Anti-Magic Shell
Range: 0 (Caster only)
Duration: 12 turns
Effect: Personal barrier which blocks
magic
This spell creates a n invisible barrier
around the magic-user’s body (less than an
inch away). The barrier stops all spells or
spell effects, including the caster’s. The
caster may destroy the shell at will; other-
wise, it lasts until the duration ends. Except
for a wish, no magical power (including a
dispel magic spell) can cancel the barrier.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Artifact Chapter Context and Witnesses`
- canonical spell key: `Anti-Magic Shell`
- Chapter 06 card heading: `Anti-Magic Shell`

```text
 75 Anti-Magic Shell (DR 12T; X15)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Anti-Magic Shell`
- Chapter 06 card heading: `Anti-Magic Shell`

```text
Anti-Magic Shell
Range: 0 (Caster only)
Duration: 12 turns
Effect: Personal barrier which blocks magic
This spell creates an invisible barrier around
the spellcaster’s body (less than an inch away).
The barrier stops all spells or spell effects, in-
cluding the caster’s. The caster may destroy the
shell at will; otherwise, it lasts for the duration.
Except for a wish, no magic (including a dispel
magic spell) can cancel the barrier.
```

## Audible Glamer

- canonical spell key: `Audible Glamer`
- Chapter 06 card heading: `Audible Glamer`
- expected witness lanes: `Holmes`
- missing expected witness lanes: `none`
- witness count: `1`

### Witness: Holmes

- source lane: `Holmes`
- source label: `Holmes Basic`
- staging anchor / section: `hb-audible-glamer`
- canonical spell key: `Audible Glamer`
- Chapter 06 card heading: `Audible Glamer`

```text
Audible Glamer — Level 2; Range: 240 feet; Duration:
2 turns
By means of this spell the magic-user is able to
create an auditory hallucination. The volume of sound
and the number of voices, calls, etc. is a direct function
of the level of the sender. At second level the caster
can, at best, make it seem as if 2-8 persons were con-
versing in normal tones. With each additional level
which the magic-user attains a like volume can be
added, i.e. at third level the caster could create the
sound of 4-16 persons moving and speaking normally,
or half that number shouting and fighting. For other
than human sounds simply judge by relative sound vol-
ume (a lion roaring would require a forth level casting,
but the sound of a giant snake approaching would
easily be accomplished by a second level magic-user).
```

## Charm Monster

- canonical spell key: `Charm Monster`
- Chapter 06 card heading: `Charm Monster`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Charm Monster`
- Chapter 06 card heading: `Charm Monster`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Charm Monster`
- Chapter 06 card heading: `Charm Monster`

```text
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
```

## Clairaudience

- canonical spell key: `Clairaudience`
- Chapter 06 card heading: `Clairaudience`
- expected witness lanes: `Men & Magic`, `Holmes`, `OD&D Family`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Men & Magic

- source lane: `Men & Magic`
- source label: `Men & Magic`
- staging anchor / section: `mm-clairaudience`
- canonical spell key: `Clairaudience`
- Chapter 06 card heading: `Clairaudience`

```text
Clairaudience: Same as Clairvoyance except it allows hearing rather than visualiza-
tion. This is one of the few spells which can be cast through a Crystal Ball (see
Volume II).
```

### Witness: Holmes

- source lane: `Holmes`
- source label: `Holmes Basic`
- staging anchor / section: `hb-clairaudience`
- canonical spell key: `Clairaudience`
- Chapter 06 card heading: `Clairaudience`

```text
Clairaudience: Same as Clairvoyance except it allows hearing rather than visualization. This is one of the few spells which can be cast through a Crystal Ball (see Volume II).
```

### Witness: OD&D Family

- source lane: `OD&D Family`
- source label: `OD&D Family`
- staging anchor / section: `odnd-clairaudience`
- canonical spell key: `Clairaudience`
- Chapter 06 card heading: `Clairaudience`

```text
Clairaudience: Same as Clairvoyance except it allows hearing rather than visualization. This is one of the few spells which can be cast through a Crystal Ball (see Volume II).
```

## Clairvoyance

- canonical spell key: `Clairvoyance`
- Chapter 06 card heading: `Clairvoyance`
- expected witness lanes: `OD&D Family`, `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: OD&D Family

- source lane: `OD&D Family`
- source label: `OD&D Family`
- staging anchor / section: `odnd-clairvoyance`
- canonical spell key: `Clairvoyance`
- Chapter 06 card heading: `Clairvoyance`

```text
Clairvoyance: Same as ESP spell except the spell user can visualize rather than merely pick up thoughts.
```

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Clairvoyance`
- Chapter 06 card heading: `Clairvoyance`

```text
Clairvoyance
Range: 60’
Duration: 12 turns
Effect: See through another’s eyes
With this spell, the caster may see an area
through the eyes of any single creature in
\
it. The creature must be in range, and in
the general direction chosen by the caster.
The effects of this spell may be blocked by
more than two feet of rock or a thin coat-
ing of lead. “Seeing” through a creature’s
eyes takes one full turn, after which the
caster can change to another creature, pos-
sibly in another area entirely.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Clairvoyance`
- Chapter 06 card heading: `Clairvoyance`

```text
Clairvoyance
Range: 60'
Duration: 12 turns
Effect: See through another’s eyes
With this spell, the caster may see through the
eyes of any single creature in spell range.
"Seeing" through a creature’s eyes takes one
full turn, after which the caster can change to an-
other creature, even one in another direction; he
does not have to cast the spell again to do so. Two
feet of rock or a thin coating of lead blocks the
effects of this spell. No saving throw is allowed.
```

## Cloudkill

- canonical spell key: `Cloudkill`
- Chapter 06 card heading: `Cloudkill`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Cloudkill`
- Chapter 06 card heading: `Cloudkill`

```text
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
other thick vegetation’. If cast in a small
area (such as in a 10' tall dungeon corri-
dor), the cloud may be of smaller than nor-
mal size.
All living creatures within the cloud take
1 point of damage per round. Any victim
of less than 5 Hit Dice must make a Saving
Throw vs. Poison or be killed by the va-
pors.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Cloudkill`
- Chapter 06 card heading: `Cloudkill`

```text
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
```

## Confusion

- canonical spell key: `Confusion`
- Chapter 06 card heading: `Confusion`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Confusion`
- Chapter 06 card heading: `Confusion`

```text
Confusion
Range: 120'
Duration: 12 rounds
Effect: 3-18 creatures in an area 60' across
This spell will confuse several creatures, af-
fecting all within a 30' radius. Victims with
less than 2+1 Hit Dice are not allowed a
Saving Throw. Those with 2+1 or more
Hit Dice must make a Saving Throw vs.
Spells every round of the spell’s duration,
if they remain in the area, or be confused.
Each confused creature acts randomly.
The DM should roll 2d6 each round to
determine each creature’s action, using the
following chart:
2-5 Attack the spell caster’s party
6-8 Do nothing
9-12 Attack the creature’s own party
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Confusion`
- Chapter 06 card heading: `Confusion`

```text
Confusion
Range: 120'
Duration: 12 rounds
Effect: 3-18 creatures in an area 60' across
This spell will confuse its victims, affecting all
creatures within a 30' radius. Victims with less
than 2+1 Hit Dice are not allowed a saving
throw. Those with 2+1 or more Hit Dice must
make a saving throw vs. spells every round of the
spell’s duration, if they remain in the area, or be
confused.
Confused creatures act randomly. The DM
should roll 2d6 each round to determine each
creature’s action, using the following chart:
Confusion Results
2d6 Roll Result
Attack the spellcaster’s party
2-5
6-8
Do nothing
9-12
Attack the creature’s own party
```

## Conjure Elemental

- canonical spell key: `Conjure Elemental`
- Chapter 06 card heading: `Conjure Elemental`
- expected witness lanes: `Expert`, `Companion`, `Immortals`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `4`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Conjure Elemental`
- Chapter 06 card heading: `Conjure Elemental`

```text
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
```

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items`
- canonical spell key: `Conjure Elemental`
- Chapter 06 card heading: `Conjure Elemental`

```text
Conjure Elemental
[Companion (MU5, pp.22-24): list-only; desc → RC]
```

### Witness: Immortals

- source lane: `Immortals`
- source label: `Immortals Set`
- staging anchor / section: `Section 3: Immortal Magic -> Explanation of Terms, Charts S1-S4 -> Conjure Elemental`
- canonical spell key: `Conjure Elemental`
- Chapter 06 card heading: `Conjure Elemental`

```text
Conjure Elemental: See General Notes (Conjuring and Summoning).
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Conjure Elemental`
- Chapter 06 card heading: `Conjure Elemental`

```text
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
The spell’s caster may return a controlled ele-
mental to its home plane simply by concentra-
tion. A dispel magic or dispel evil spell can
return an uncontrolled elemental to its plane.
```

## Death Spell

- canonical spell key: `Death Spell`
- Chapter 06 card heading: `Death Spell`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Death Spell`
- Chapter 06 card heading: `Death Spell`

```text
Death Spell
Range: 240'
Duration: Instantaneous
Effect: Slays 4-32 Hit Dice of creatures
within a 60' x 60' x 60' area
This spell will affect 4-32 Hit Dice of living
creatures within the given area. Normal
plants and insects are automatically slain,
and those with no hit points are not
counted in the total affected. Undead are
not affected, nor are creatures with 8 or
more Hit Dice (or levels of experience).
The lowest Hit Dice creatures are affected
first. Each victim must make a Saving
Throw vs. Death Ray or be slain.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Death Spell`
- Chapter 06 card heading: `Death Spell`

```text
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
```

## Dimension Door

- canonical spell key: `Dimension Door`
- Chapter 06 card heading: `Dimension Door`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Dimension Door`
- Chapter 06 card heading: `Dimension Door`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Dimension Door`
- Chapter 06 card heading: `Dimension Door`

```text
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
```

## Disintegrate

- canonical spell key: `Disintegrate`
- Chapter 06 card heading: `Disintegrate`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Disintegrate`
- Chapter 06 card heading: `Disintegrate`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Disintegrate`
- Chapter 06 card heading: `Disintegrate`

```text
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
```

## Geas

- canonical spell key: `Geas`
- Chapter 06 card heading: `Geas`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Geas`
- Chapter 06 card heading: `Geas`

```text
Geas
[Expert Set sourcing note (MU6): Expert Set (pages 13-18) includes Geas in the 6th level MU spell list only; no standalone description found in the Expert PDF. Description text in Rules Cyclopedia staging.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Geas`
- Chapter 06 card heading: `Geas`

```text
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
make a saving throw vs. spells to avoid the spell’s
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
```

## Growth of Plants

- canonical spell key: `Growth of Plants`
- Chapter 06 card heading: `Growth of Plants`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Growth of Plants`
- Chapter 06 card heading: `Growth of Plants`

```text
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
spell’s range. The affected area is impassa-
ble to all but giant-sized creatures. The
effect lasts until removed by the reverse or
by a dispel magic spell.
The reverse of this spell, shrink plants,
causes all normal plants within a similar
area of effect to shrink and become pass-
able. It may be used to negate the effects of
the normal spell. Shrink plants will not af-
fect plant-like monsters (such as treants).
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Growth of Plants`
- Chapter 06 card heading: `Growth of Plants`

```text
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
affected must be entirely within the spell’s
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
```

## Hallucinatory Terrain

- canonical spell key: `Hallucinatory Terrain`
- Chapter 06 card heading: `Hallucinatory Terrain`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Hallucinatory Terrain`
- Chapter 06 card heading: `Hallucinatory Terrain`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Hallucinatory Terrain`
- Chapter 06 card heading: `Hallucinatory Terrain`

```text
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
image of dense forest over his army’s camp, etc.
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
```

## Haste

- canonical spell key: `Haste`
- Chapter 06 card heading: `Haste`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Haste`
- Chapter 06 card heading: `Haste`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Haste`
- Chapter 06 card heading: `Haste`

```text
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
```

## Hold Monster

- canonical spell key: `Hold Monster`
- Chapter 06 card heading: `Hold Monster`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Hold Monster`
- Chapter 06 card heading: `Hold Monster`

```text
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
creatures (the magic-user’s choice), but
with no penalties.
The reverse of this spell, free monster re-
moves the paralysis of up to 4 victims of
hold person or hold monster spells. It has no
other effect.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Hold Monster`
- Chapter 06 card heading: `Hold Monster`

```text
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
caster’s choice, and within spell range), but with
no penalties to the saving throw.
The reverse of this spell, free monster, re-
moves the paralysis of up to four victims of hold
person or hold monster spells. It has no other ef-
fect.
```

## Ice Storm/Wall

- canonical spell key: `Ice Storm/Wall`
- Chapter 06 card heading: `Ice Storm/Wall`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Ice Storm/Wall`
- Chapter 06 card heading: `Ice Storm/Wall`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Ice Storm/Wall`
- Chapter 06 card heading: `Ice Storm/Wall`

```text
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
```

## Infravision

- canonical spell key: `Infravision`
- Chapter 06 card heading: `Infravision`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Infravision`
- Chapter 06 card heading: `Infravision`

```text
Infravision
Range: Touch
Duration: 1 day
Effect: One living creature
This spell enables the recipient to see in the
dark, to a 60' range. (See the D&D Basic
Set DM Rulebook, page 22, for notes on
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Infravision`
- Chapter 06 card heading: `Infravision`

```text
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
Infravision isn’t good enough to read by. A
character can use his infravision to recognize an
individual only if they are within 10' distance
unless the individual is very, very distinctive (for
example, 8' tall or walking with a crutch).
```

## Invisible Stalker

- canonical spell key: `Invisible Stalker`
- Chapter 06 card heading: `Invisible Stalker`
- expected witness lanes: `Expert`, `Immortals`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Invisible Stalker`
- Chapter 06 card heading: `Invisible Stalker`

```text
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
```

### Witness: Immortals

- source lane: `Immortals`
- source label: `Immortals Set`
- staging anchor / section: `Section 3: Immortal Magic -> Explanation of Terms, Charts S1-S4 -> Invisible Stalker`
- canonical spell key: `Invisible Stalker`
- Chapter 06 card heading: `Invisible Stalker`

```text
Invisible Stalker: See General Notes (Conjuring and Summoning).
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Invisible Stalker`
- Chapter 06 card heading: `Invisible Stalker`

```text
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
```

## Lower Water

- canonical spell key: `Lower Water`
- Chapter 06 card heading: `Lower Water`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Lower Water`
- Chapter 06 card heading: `Lower Water`

```text
Lower Water
Range: 240'
Duration: 10 turns
Effect: Cuts depth to 1/2 normal
This spell will affect an area up to 10,000
square feet, as noted above. If cast around
a boat or ship, the vessel may become
stuck. At the end of the duration, the sud-
den rush of water filling the "hole" will
sweep a ship’s deck clear of most items and
cause 21-32 ( l d 1 2 + 2 0 ) points of hull
damage.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Lower Water`
- Chapter 06 card heading: `Lower Water`

```text
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
At the end of the spell’s duration, the sudden
rush of water filling the "hole" will sweep a
ship’s deck clear of most items (and people who
fail their saving throws vs. spells) and cause
1d12 + 20 (21-32) points of hull damage.
This spell can turn a rampaging river into a
river which the heroes’ party can ford, can cause
some pools to lower far enough for the adventur-
ers to see what’s deeper in them, etc. If cast
around a boat or ship, this spell may cause the
bay or river to drop enough for the vessel to be-
come stuck.
```

## Magic Mouth

- canonical spell key: `Magic Mouth`
- Chapter 06 card heading: `Magic Mouth`
- expected witness lanes: `Greyhawk`, `Holmes`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Greyhawk

- source lane: `Greyhawk`
- source label: `Greyhawk`
- staging anchor / section: `gh-magic-mouth`
- canonical spell key: `Magic Mouth`
- Chapter 06 card heading: `Magic Mouth`

```text
Magic Mouth: A spell which resembles ventriliquism in that the sound issues from 
a chosen object, but there are differences. A mouth appears, or the mouth of the object 
moves in accordance with what is being said. The Magic Mouth can be ordered to speak 
upon certain conditions, i.e. if anyone comes within 10 of it, if a neutral person comes 
within 10', if Flubbit the Wizard comes within 10', and so on. The spell lasts until the 
message is given. The message cannot exceed twenty-five words.
```

### Witness: Holmes

- source lane: `Holmes`
- source label: `Holmes Basic`
- staging anchor / section: `hb-magic-mouth`
- canonical spell key: `Magic Mouth`
- Chapter 06 card heading: `Magic Mouth`

```text
Magic Mouth — Level 2; Range: 0 feet; Duration: in-
finite
Resembles ventriloquism in that sound issues from
a chosen object, but there are differences. A mouth ap-
pears, or the mouth of the object moves in accordance
with what is said. The magic mouth can be ordered to
speak under certain conditions, such as when anyone
comes within 1 0 feet, or when a specific person comes
within 10 feet, etc. The spell lasts until the message is
given. Message can not exceed 25 words.
```

## Magic Jar

- canonical spell key: `Magic Jar`
- Chapter 06 card heading: `Magic Jar`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Magic Jar`
- Chapter 06 card heading: `Magic Jar`

```text
Magic Jar
Range: 30'
Duration: See below
Effect: Possess one body
This spell causes the caster’s body to fall
into a trance, while the caster’s life force is
placed in an inanimate object (magic jar)
within range. From this object (a gem or
vial, for example), the caster’s life force
may attempt to possess any one creature
within 120' of the magic jar. If the victim
makes a successful Saving Throw vs. Spells,
the possession fails and the caster may not
try to possess that victim again for one
turn. If the victim fails the Saving Throw,
the creature’s body is possessed and is un-
der the caster’s control. The life force of
the possessed victim is placed into the magic
jar.
The caster may cause the body to per-
form any normal actions, but not special
abilities (similar to a polymorph self effect). A
dispel evil spell will force the magic-user’s
life force out of the possessed body and
back into the magic jar. When the magic-
user returns to his or her real body, the
spell ends.
If the possessed body is destroyed, the
victim’s life force dies, and the caster’s life
force returns to the magic jar . From there
the caster may try to possess another body
or return to the original body. If the magic
jar is destroyed while the caster’s life force
is within it, the caster is killed. If the magic
jar is destroyed while the caster’s life force
is in a possessed body, the life force is
stranded in that body. If the caster’s origi-
nal body is destroyed, his life force is
stranded in the magic jar until the caster
can possess another body! The possession
of another’s body is a Chaotic act.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Magic Jar`
- Chapter 06 card heading: `Magic Jar`

```text
Magic Jar
Range: 30'
Duration: See below
Effect: Take over one body
This spell causes the caster’s body to fall into a
trance, while the caster’s life force is placed in an
inanimate object (which is called a magic jar re-
gardless of its form; it does not have to be an ac-
tual jar) within range. From this object, the
caster’s life force may attempt to take over any
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
will force the spellcaster’s life force out of the vic-
tim’s body and back into the magic jar. When
the spellcaster returns to his or her real body, the
victim’s life force returns to his body and the
spell ends.
If the possessed body is destroyed, the victim’s
life force dies, and the caster’s life force returns
to the magic jar. From there the caster may try to
take over another body or return to the original
body.
If the magic jar is destroyed while the caster’s
life force is within it, the caster is killed. If the
magic jar is destroyed while the caster’s life force
is in a victim’s body, the life force is stranded in
that body, and the life force of the body’s origi-
nal owner is destroyed. If the caster’s original
body is destroyed, his life force is stranded in the
magic jar until the caster can take over another
body!
The taking over of another body is a Chaotic
act.
```

## Massmorph

- canonical spell key: `Massmorph`
- Chapter 06 card heading: `Massmorph`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Massmorph`
- Chapter 06 card heading: `Massmorph`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Massmorph`
- Chapter 06 card heading: `Massmorph`

```text
Massmorph
Range: 240'
Duration: See below
Effect: Causes illusion of trees within 240' range
This spell will affect up to 100 human or man-
sized creatures in a 240' diameter, making them
appear to be the trees of an orchard, dense
woods, or other large plant life appropriate to
the region. (Unless the campaign’s deserts fea-
ture very large cactus, the spell won’t work in the
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
```

## Passwall

- canonical spell key: `Passwall`
- Chapter 06 card heading: `Passwall`
- expected witness lanes: `Expert`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Passwall`
- Chapter 06 card heading: `Passwall`

```text
Pass-Wall
Range: 30'
Duration: 3 turns
Effect: Creates a hole 10' deep
This spell causes a hole 5' diameter, 10'
deep to appear in solid rock or stone only.
The stone reappears at the end of the du-
ration. The hole may be horizontal or ver-
tical.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Artifact Chapter Context and Witnesses`
- canonical spell key: `Passwall`
- Chapter 06 card heading: `Passwall`

```text
  45 Pass-Wall (R 60', DR 6T, EF 5' X 10';
     X15)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Passwall`
- Chapter 06 card heading: `Passwall`

```text
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
```

## Polymorph Others

- canonical spell key: `Polymorph Others`
- Chapter 06 card heading: `Polymorph Others`
- expected witness lanes: `Expert`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Polymorph Others`
- Chapter 06 card heading: `Polymorph Others`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Artifact Chapter Context and Witnesses`
- canonical spell key: `Polymorph Others`
- Chapter 06 card heading: `Polymorph Others`

```text
  45 Polymorph Other (R 60', up to 2x HD;
     X13)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Polymorph Others`
- Chapter 06 card heading: `Polymorph Others`

```text
Polymorph Other
Range: 60'
Duration: Permanent until dispelled
Effect: Changes one living creature
This spell changes the victim into another liv-
ing creature. The new form may have no more
than twice as many Hit Dice as the original, or
the spell will fail. The victim’s hit points remain
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
```

## Polymorph Self

- canonical spell key: `Polymorph Self`
- Chapter 06 card heading: `Polymorph Self`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Polymorph Self`
- Chapter 06 card heading: `Polymorph Self`

```text
Polymorph Self
Range: 0 (Caster only)
Duration: 6 turns + 1 turn per level of the
caster
Effect: Caster may change shapes
This spell allows the caster to change
shape, taking the physical form of another
living creature. The Hit Dice of the new
form must be equal to or less than the Hit
Dice of the caster. The caster’s Armor
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Polymorph Self`
- Chapter 06 card heading: `Polymorph Self`

```text
Polymorph Self
Range: 0 (Caster only)
Duration: 6 turns + 1 turn per level of the caster
Effect: Caster may change shapes
This spell allows the caster to change shape,
taking the physical form of another living crea-
ture. The Hit Dice of the new form must be
equal to or less than the Hit Dice of the caster, or
the spell will fail.
The caster’s armor class, hit points, attack
rolls, and saving throws do not change, and he
does not gain special abilities (such as ghouls’
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
```

## Projected Image

- canonical spell key: `Projected Image`
- Chapter 06 card heading: `Projected Image`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Projected Image`
- Chapter 06 card heading: `Projected Image`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Projected Image`
- Chapter 06 card heading: `Projected Image`

```text
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
```

## Pyrotechnics

- canonical spell key: `Pyrotechnics`
- Chapter 06 card heading: `Pyrotechnics`
- expected witness lanes: `Greyhawk`, `Holmes`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Greyhawk

- source lane: `Greyhawk`
- source label: `Greyhawk`
- staging anchor / section: `gh-pyrotechnics`
- canonical spell key: `Pyrotechnics`
- Chapter 06 card heading: `Pyrotechnics`

```text
Pyrotechnics: A multi-purpose spell which requires some form of fire (torch, 
brazier, bonfire, etc.) to make it work. When employing this spell the Magic-User can 
create either a great display of flashing, fiery lights and colors which resemble fireworks; 
or he can cause a great amount of smoke which will cover an area of not less than 20 
cubic feet. The overall effects of this spell depend on the size of the fire used to cause 

them, and when the spell is used the fire-source is extinguished. Duration: 6 turns. 
Range 24".
```

### Witness: Holmes

- source lane: `Holmes`
- source label: `Holmes Basic`
- staging anchor / section: `hb-pyrotechnics`
- canonical spell key: `Pyrotechnics`
- Chapter 06 card heading: `Pyrotechnics`

```text
Pyrotechnics — Level 2; Range: 240 feet; Duration: 6
turns
This spell requires some kind of real fire to work —
a torch, brazier, campfire, etc. It can create either a
great display of flashing fiery colors and lights resem-
bling fireworks or a great amount of thick smoke
covering an area of at least 20 cubic feet if a torch is the
source, for example. The effect depends on the size of
the fire used to cause it, and when the spell is used the
fire-source is extinguished.
```

## Ray of Enfeeblement

- canonical spell key: `Ray of Enfeeblement`
- Chapter 06 card heading: `Ray of Enfeeblement`
- expected witness lanes: `Holmes`
- missing expected witness lanes: `none`
- witness count: `1`

### Witness: Holmes

- source lane: `Holmes`
- source label: `Holmes Basic`
- staging anchor / section: `hb-ray-of-enfeeblement`
- canonical spell key: `Ray of Enfeeblement`
- Chapter 06 card heading: `Ray of Enfeeblement`

```text
Ray of Enfeeblement — Level 2; Range: 30 feet
When the magic-user employs this spell a thin
beam of coruscating grayish light springs from his
hand. The creature struck by this ray will lose 4 points of
strength for a number of melee rounds equal to the
level of the spell caster. If the intended victim makes its
saving throw against magic the ray does nothing to
him. Creatures who lose strength will do 25% less dam-
age than is indicated, per 4 points of strength lost, on
all attacks which involve physical force or contact, i.e.
striking, clawing, biting, squeezing, etc.
```

## Slow

- canonical spell key: `Slow`
- Chapter 06 card heading: `Slow`
- expected witness lanes: `Men & Magic`
- missing expected witness lanes: `none`
- witness count: `1`

### Witness: Men & Magic

- source lane: `Men & Magic`
- source label: `Men & Magic`
- staging anchor / section: `mm-slow`
- canonical spell key: `Slow`
- Chapter 06 card heading: `Slow`

```text
Slow Spell: A broad-area spell which effects up to 24 creatures in a maximum area
of 6" x 12". Duration: 3 turns. Range: 24".
```

## Stone to Flesh

- canonical spell key: `Stone to Flesh`
- Chapter 06 card heading: `Stone to Flesh`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Stone to Flesh`
- Chapter 06 card heading: `Stone to Flesh`

```text
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

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Stone to Flesh`
- Chapter 06 card heading: `Stone to Flesh`

```text
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
```

## Strength

- canonical spell key: `Strength`
- Chapter 06 card heading: `Strength`
- expected witness lanes: `Greyhawk`, `Holmes`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Greyhawk

- source lane: `Greyhawk`
- source label: `Greyhawk`
- staging anchor / section: `gh-strength`
- canonical spell key: `Strength`
- Chapter 06 card heading: `Strength`

```text
Strength: This spell increases a fighter’s strength by from 2-8 points (roll dice after 
spell is cast). It will also increase a cleric’s strength by from 1-6 points and a thief’s by 
from 1-4. When a fighter’s strength reaches 18 or higher due to this spell an additional 
determination of strength is to be made as already specified for strength of 18. Duration: 
8 game hours.
```

### Witness: Holmes

- source lane: `Holmes`
- source label: `Holmes Basic`
- staging anchor / section: `hb-strength`
- canonical spell key: `Strength`
- Chapter 06 card heading: `Strength`

```text
Strength — Level 2; Range: 0; Duration: 48 turns
This spell increases a fighter’s strength by 2-8
points, a thief’s by 1-6 points, or a cleric’s by 1-4.
```

## Teleport

- canonical spell key: `Teleport`
- Chapter 06 card heading: `Teleport`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Teleport`
- Chapter 06 card heading: `Teleport`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Teleport`
- Chapter 06 card heading: `Teleport`

```text
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
porter’s chance of arriving safely depends on how
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
dungeon) lies at that point (DM’s discretion).
```

## Wall of Fire

- canonical spell key: `Wall of Fire`
- Chapter 06 card heading: `Wall of Fire`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Wall of Fire`
- Chapter 06 card heading: `Wall of Fire`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Wall of Fire`
- Chapter 06 card heading: `Wall of Fire`

```text
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
```

## Wall of Stone

- canonical spell key: `Wall of Stone`
- Chapter 06 card heading: `Wall of Stone`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Wall of Stone`
- Chapter 06 card heading: `Wall of Stone`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Wall of Stone`
- Chapter 06 card heading: `Wall of Stone`

```text
Wall of Stone
Range: 60'
Duration: Special
Effect: Creates 1000 cubic feet of stone
This spell creates a vertical stone wall exactly 2'
thick. The caster chooses the wall’s dimensions
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
```

## Wizard Eye

- canonical spell key: `Wizard Eye`
- Chapter 06 card heading: `Wizard Eye`
- expected witness lanes: `Expert`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions`
- canonical spell key: `Wizard Eye`
- Chapter 06 card heading: `Wizard Eye`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Wizard Eye`
- Chapter 06 card heading: `Wizard Eye`

```text
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
```

## Aerial Servant

- canonical spell key: `Aerial Servant`
- Chapter 06 card heading: `Aerial Servant`
- expected witness lanes: `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Cleric Spells`
- canonical spell key: `Aerial Servant`
- Chapter 06 card heading: `Aerial Servant`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Aerial Servant`
- Chapter 06 card heading: `Aerial Servant`

```text
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
ration. If the spell’s duration lapses before the
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
```

## Animate Objects

- canonical spell key: `Animate Objects`
- Chapter 06 card heading: `Animate Objects`
- expected witness lanes: `Expert`, `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions -> Sixth-Level Clerical Spells`
- canonical spell key: `Animate Objects`
- Chapter 06 card heading: `Animate Objects`

```text
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
```

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Cleric Spells`
- canonical spell key: `Animate Objects`
- Chapter 06 card heading: `Animate Objects`

```text
Animate Objects
[Companion (Cl6, pp.13-14): list-only; desc → RC]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Animate Objects`
- Chapter 06 card heading: `Animate Objects`

```text
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
```

## Barrier

- canonical spell key: `Barrier`
- Chapter 06 card heading: `Barrier`
- expected witness lanes: `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Cleric Spells`
- canonical spell key: `Barrier`
- Chapter 06 card heading: `Barrier`

```text
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
user’s wall of ice, wall of fire, or wall of stone
spell effect. It will not affect a wall of iron.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Barrier`
- Chapter 06 card heading: `Barrier`

```text
Barrier*
Range: 60'
Duration: 12 turns
Effect: Creates whirling hammers
This spell creates a magical barrier in an area
up to 30' in diameter and 30' high. The barrier is
a wall of whirling and dancing hammers, obvi-
ously dangerous to any who come in contact with
it. Any creature passing through the barrier
takes 7d10 (7-70) points of damage from the
whirling hammers (no saving throw allowed).
This spell is often used to block an entrance or
passage.
The reverse of this spell (remove barrier) will
destroy any one barrier created by a cleric. It can
also be used to destroy a magic-user’s wall of ice,
wall of fire, clothform, woodform, or wall of
stone spell effects. It will not affect the magic-
user spells wall of iron, stoneform, ironform or
```

## Commune

- canonical spell key: `Commune`
- Chapter 06 card heading: `Commune`
- expected witness lanes: `Expert`, `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions -> Fifth-Level Clerical Spells`
- canonical spell key: `Commune`
- Chapter 06 card heading: `Commune`

```text
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
```

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Cleric Spells`
- canonical spell key: `Commune`
- Chapter 06 card heading: `Commune`

```text
Commune
[Companion (Cl5, pp.13-14): list-only; desc → RC]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Commune`
- Chapter 06 card heading: `Commune`

```text
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
```

## Create Food

- canonical spell key: `Create Food`
- Chapter 06 card heading: `Create Food`
- expected witness lanes: `Expert`, `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions -> Fifth-Level Clerical Spells`
- canonical spell key: `Create Food`
- Chapter 06 card heading: `Create Food`

```text
Create Food
Range: 10'
Duration: Permanent
Effect: Creates food for 12 or more
This spell creates enough food to feed 12
men and their mounts for one day. For
every level of the cleric above Sth, food for
12 additional men and mounts is created.
```

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Cleric Spells`
- canonical spell key: `Create Food`
- Chapter 06 card heading: `Create Food`

```text
Create Food
[Companion (Cl5, pp.13-14): list-only; desc → RC]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Create Food`
- Chapter 06 card heading: `Create Food`

```text
Create Food
Range: 10'
Duration: Permanent
Effect: Creates food for 12 or more
This spell creates enough normal food to feed
up to 12 men and their mounts for one day. For
every level of the cleric above 8th, the spell cre-
ates enough food for 12 additional men and
mounts. The cleric doesn’t have to create the
maximum amount of food if he doesn’t wish to;
he can create a lesser amount. Created food
spoils after 24 hours; therefore it is impossible to
lay in a big store of food created by this spell.
```

## Create Normal Animals

- canonical spell key: `Create Normal Animals`
- Chapter 06 card heading: `Create Normal Animals`
- expected witness lanes: `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Cleric Spells`
- canonical spell key: `Create Normal Animals`
- Chapter 06 card heading: `Create Normal Animals`

```text
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
ing, etc.) to the best of their abilities. They
are normal animals, and may attack others
unless their instructions are carefully
worded.
The cleric may choose the number of ani-
mals created, but not the exact type; the DM
should decide that (or randomly determine).
One large (elephant, hippopotamus, etc.), 3
medium-sized (bear, great cat, etc.), or 6
small (wolf, rock baboon, etc.) animals can
be created. "Giant" animals cannot be cre-
ated. The animals disappear when slain or
when the spell duration ends.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Create Normal Animals`
- Chapter 06 card heading: `Create Normal Animals`

```text
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
```

## Cure Critical Wounds

- canonical spell key: `Cure Critical Wounds`
- Chapter 06 card heading: `Cure Critical Wounds`
- expected witness lanes: `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Cleric Spells`
- canonical spell key: `Cure Critical Wounds`
- Chapter 06 card heading: `Cure Critical Wounds`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Cure Critical Wounds`
- Chapter 06 card heading: `Cure Critical Wounds`

```text
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
```

## Cureall

- canonical spell key: `Cureall`
- Chapter 06 card heading: `Cureall`
- expected witness lanes: `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Cleric Spells`
- canonical spell key: `Cureall`
- Chapter 06 card heading: `Cureall`

```text
Cureall
Range: Touch
Duration: Permanent
Effect: Cures anything
This spell is the most powerful of the healing
spells. When used to cure wounds, it cures
nearly all damage, leaving the recipient with
only 1-6 points of damage. It will remove a
curse, neutralize a poison, cure paralysis,
cure a disease, cure blindness, or even
remove a feeblemind effect. However, it will
cure one thing only; if the recipient is suffer-
ing from two or more afflictions (such as
wounds and a curse), the cleric must name
the one to be cured. If cast on the recipient of
a raise dead spell, the cureall eliminates the
need for 2 weeks of bed rest; the recipient can
immediately function normally.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Cureall`
- Chapter 06 card heading: `Cureall`

```text
Cureall
Range: Touch
Duration: Permanent
Effect: Cures anything
This spell is the most powerful of the healing
spells. When used to cure wounds, it cures near-
ly all damage, leaving the recipient with only
1d6 points of damage. (Restore the victim to full
starting hit points, then roll 1d6 and subtract
that amount from the victim’s hit point total.)
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
```

## Dispel Evil

- canonical spell key: `Dispel Evil`
- Chapter 06 card heading: `Dispel Evil`
- expected witness lanes: `Expert`, `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions -> Fifth-Level Clerical Spells`
- canonical spell key: `Dispel Evil`
- Chapter 06 card heading: `Dispel Evil`

```text
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
```

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Cleric Spells`
- canonical spell key: `Dispel Evil`
- Chapter 06 card heading: `Dispel Evil`

```text
Dispel Evil
[Companion (Cl5, pp.13-14): list-only; desc → RC]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Dispel Evil`
- Chapter 06 card heading: `Dispel Evil`

```text
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
```

## Earthquake

- canonical spell key: `Earthquake`
- Chapter 06 card heading: `Earthquake`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Cleric Spells`
- canonical spell key: `Earthquake`
- Chapter 06 card heading: `Earthquake`

```text
Earthquake
Range: 120 yards
Duration: 1 turn
Effect: Causes earth tremors
This powerful spell causes a section of earth
to shake, and opens large cracks in the
ground. A 17th level caster can affect an area
up to 60' square, adding 5' to each dimen-
sion with each level of experience thereafter.
For example, an 18th level cleric affects an
areaup to 65' square; lgthlevel, 70' square;
and so forth.
Within the area of effect, all small dwell-
ings are reduced to rubble, and larger con-
structions are cracked open. Earthen
formations (hills, cliffsides, etc.) form rock-
slides. Cracks in the earth may open and
engulf 1 creature in 6 (determined ran-
domly), crushing them.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Seventh-Level Cleric Spells`
- canonical spell key: `Earthquake`
- Chapter 06 card heading: `Earthquake`

```text
  90 Earthquake (R 120 yards, DR 1T, EF
      175' sq; C13)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Earthquake`
- Chapter 06 card heading: `Earthquake`

```text
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
```

## Find the Path

- canonical spell key: `Find the Path`
- Chapter 06 card heading: `Find the Path`
- expected witness lanes: `Expert`, `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions -> Sixth-Level Clerical Spells`
- canonical spell key: `Find the Path`
- Chapter 06 card heading: `Find the Path`

```text
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
```

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Cleric Spells`
- canonical spell key: `Find the Path`
- Chapter 06 card heading: `Find the Path`

```text
Find the Path
[Companion (Cl6, pp.13-14): list-only; desc → RC]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Find the Path`
- Chapter 06 card heading: `Find the Path`

```text
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
When the spell’s duration runs out, the caster
only remembers the general direction to the
place. All other special information is forgotten.
The spell is instantly negated is the caster at-
tempts to write down, record, or disclose that
special knowledge to others. This spell is often
used to find a fast escape route.
```

## Holy Word

- canonical spell key: `Holy Word`
- Chapter 06 card heading: `Holy Word`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Cleric Spells`
- canonical spell key: `Holy Word`
- Chapter 06 card heading: `Holy Word`

```text
Holy Word
Range: 0
Duration: Instantaneous
Effect: All creatures within 40'
This spell affects all creatures, friend or foe,
within a circular area of 40' radius, centered
on the caster. When the cleric casts this spell,
all creatures of alignments other than the
cleric’s are affected as follows:
up to 5th level: Killed
level 6-8: Stunned 2-20 turns
level 9-12: Deafened 1-6 turns
level 13.: Stunned 1-10 rounds
Any victim of 13 levels or more or of the same
alignment as the caster, may make a Saving
Throw vs. Spells to avoid the effect entirely.
This powerful spell cannot be blocked by
stone, nor by any other solid material except
lead. (It can be blocked by an antimagic
shell.)
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Seventh-Level Cleric Spells`
- canonical spell key: `Holy Word`
- Chapter 06 card heading: `Holy Word`

```text
Holy Word
[Master Set sourcing note (Cl7): Master Set lists this spell as a Companion cross-reference only (C13). No new description in Master Set. Description text in Companion staging -> High-Level Cleric, Druid, and Magic-User Spell Material.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Holy Word`
- Chapter 06 card heading: `Holy Word`

```text
Holy Word
Range: 0
Duration: Instantaneous
Effect: All creatures within 40'
This spell affects all creatures, friend or foe,
within a circular area of 40' radius, centered on
the caster. When the cleric casts this spell, all
creatures of alignments other than the cleric’s are
affected as follows (no saving throw vs. spells al-
lowed):
Holy Word Effects
Up to 5th Level:
Killed
Level 6-8:
Stunned 2d10 turns
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
```

## Insect Plague

- canonical spell key: `Insect Plague`
- Chapter 06 card heading: `Insect Plague`
- expected witness lanes: `Expert`, `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions -> Fifth-Level Clerical Spells`
- canonical spell key: `Insect Plague`
- Chapter 06 card heading: `Insect Plague`

```text
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
```

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Cleric Spells`
- canonical spell key: `Insect Plague`
- Chapter 06 card heading: `Insect Plague`

```text
Insect Plague
[Companion (Cl5, pp.13-14): list-only; desc → RC]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Insect Plague`
- Chapter 06 card heading: `Insect Plague`

```text
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
```

## Quest

- canonical spell key: `Quest`
- Chapter 06 card heading: `Quest`
- expected witness lanes: `Expert`, `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions -> Fifth-Level Clerical Spells`
- canonical spell key: `Quest`
- Chapter 06 card heading: `Quest`

```text
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
```

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Cleric Spells`
- canonical spell key: `Quest`
- Chapter 06 card heading: `Quest`

```text
Quest
[Companion (Cl5, pp.13-14): list-only; desc → RC]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Quest`
- Chapter 06 card heading: `Quest`

```text
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
but doesn’t force him to like it. Once the task is
accomplished, the victim might wish to exact re-
venge on the cleric, just depending on the cir-
cumstances of the adventure. Any victim
refusing to go on the quest is cursed until the
quest is continued. The type of curse is decided
by the DM, but may be double normal strength.
The reverse of this spell, remove quest, may
be used to dispel an unwanted quest or a quest-
related curse. The chance of success is 50%,
modified by 5% for every level of the caster dif-
fers from the level of the caster of the first quest.
Thus, an 11th level cleric attempting to remove a
quest cast by a 13th level cleric has only a 40%
chance of success; a 36th level cleric attempting
to remove a quest cast by a 20th level cleric has a
130% chance (reduced to 99% to provide for a
1% chance of failure).
```

## Raise Dead

- canonical spell key: `Raise Dead`
- Chapter 06 card heading: `Raise Dead`
- expected witness lanes: `Expert`, `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions -> Fifth-Level Clerical Spells`
- canonical spell key: `Raise Dead`
- Chapter 06 card heading: `Raise Dead`

```text
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
```

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Cleric Spells`
- canonical spell key: `Raise Dead`
- Chapter 06 card heading: `Raise Dead`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Raise Dead`
- Chapter 06 card heading: `Raise Dead`

```text
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
pire, this spell inflicts 3d10 (3-30) points of
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
```

## Finger of Death

- canonical spell key: `Finger of Death`
- Chapter 06 card heading: `Finger of Death`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Master Set spell list (R 60')`
- canonical spell key: `Finger of Death`
- Chapter 06 card heading: `Finger of Death`

```text
  50 Finger of Death* (R 60'; X9, C12)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `RC: Reverse Spell Synthesized Notes`
- canonical spell key: `Finger of Death`
- Chapter 06 card heading: `Finger of Death`

```text
Finger of Death
Range: 60'
Duration: Permanent
Effect: One living creature
[RC + Companion + Master synthesis: reverse of raise dead (C 5); sources: Companion p.12, RC Clerical Spells, Master spell list R 60' X9 C12]
Finger of death creates a death ray that will kill any one living creature within 60'. The victim may make a saving throw vs. death ray to avoid the effect. A Lawful cleric will only use finger of death in a life-or-death situation.
Finger of death will actually cure 3d10 (3-30) points of damage for any undead with 10 or more Hit Dice (phantom, haunt, spirit, nightshade, or special).
```

## Raise Dead Fully

- canonical spell key: `Raise Dead Fully`
- Chapter 06 card heading: `Raise Dead Fully`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Cleric Spells`
- canonical spell key: `Raise Dead Fully`
- Chapter 06 card heading: `Raise Dead Fully`

```text
Raise Dead Fully*
Range: 60'
Duration: Permanent
Effect: Raises any living creature
This spell is similar to the 5th level raise dead
spell, except that it can raise any living crea-
ture. Any human or demi-human recipient
awakens immediately, with no wounds (full
hit points), and is able to fight, use abilities,
spells known, etc., without any penalties-
except those existing at the time of death. For
example, a victim cursed or diseased at death
would still suffer the affliction when raised
fully. If any other living creature (other than
a human or demi-human) is the recipient, the
guidelines given in the raise dead spell apply
(including time limitations, rest needed,
etc.).
A 17th level cleric can use this spell on a
human or demi-human body that has been
dead up to 4 months; for each level of experi-
ence above 17th, 4 months are added to this
time. Thus, a 19th level cleric could cast raise
dead fully on a body that has been dead up to
12 months.
If cast at an Undead creature of 7 Hit Dice
or less, the creature is immediately destroyed
(no Saving Throw). An Undead creature of
7-12 Hit Dice must make a Saving Throw vs.
Spells, with a -4 penalty to the roll, or be
destroyed. An Undead of more than 12 Hit
Dice takes 6-60 (6d10) points of damage, but
may make a Saving Throw vs. Spells to take
1/2 damage.
The reverse of this spell (obliterate) will
affect a living creature just as the normal
form affects Undead (destroy 7 Hit Dice or
less, et al.). If cast at an Undead creature of
any type, obliterate has the same effect as a
cureall would on a living creature (curing all
but 1-6 points of damage, or curing blindness
or feeblemind, etc.).
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Seventh-Level Cleric Spells`
- canonical spell key: `Raise Dead Fully`
- Chapter 06 card heading: `Raise Dead Fully`

```text
   85 Raise Dead Fully (R 60', EF up to 8
      years dead; C13)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Raise Dead Fully`
- Chapter 06 card heading: `Raise Dead Fully`

```text
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
the roll, it is destroyed. The spell inflicts 6d10
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
```

## Restore

- canonical spell key: `Restore`
- Chapter 06 card heading: `Restore`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Cleric Spells`
- canonical spell key: `Restore`
- Chapter 06 card heading: `Restore`

```text
Restore *
Range: Touch
Duration: Permanent
Effect: Restores 1 Energy Drain
This spell will restore one full level of energy
(experience) to any victim who has lost a level
because of Energy Drain, whether by
Undead or some other attack form. It will not
restore more than one level, nor will it add a
level if none have been lost. Furthermore, the
casting of this spell causes the cleric to lose 1
level of experience, as if struck by a wight;
however, this effect is not permanent, and the
cleric may rest for 2-20 days to regain the
loss.
The reverse of this spell (life drain) will
drain one level of experience from the victim
touched, just as if touched by a wight or
wraith. The casting of this spell does not
cause any loss to the cleric, nor does it require
any rest, but it is a Chaotic act, avoided by
Lawful clerics.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Seventh-Level Cleric Spells`
- canonical spell key: `Restore`
- Chapter 06 card heading: `Restore`

```text
Restore
[Master Set sourcing note (Cl7): Master Set lists this spell as a Companion cross-reference only (C13). No new description in Master Set. Description text in Companion staging -> High-Level Cleric, Druid, and Magic-User Spell Material.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Restore`
- Chapter 06 card heading: `Restore`

```text
Restore*
Range: Touch
Duration: Permanent
Effect: Restores 1 level lost to energy drain
This spell restores one full level of energy (ex-
perience) to any victim who has lost a level be-
cause of energy drain (for instance, from a
vampire’s attack). It does not restore more than
one level, nor does it add a level if no level has
been lost. Furthermore, the cleric casting this
spell loses one level of experience, as if struck by
a wight when the spell is cast; however, the cler-
ic’s loss is not permanent, and the cleric need on-
ly rest for 2d10 (2-20) days to regain the lost
experience.
The reverse of this spell, life drain, drains one
level of experience from the victim touched, just
like the touch of a wight or wraith. Casting the
reversed spell causes no experience level loss to
the cleric, nor does it require any rest afterward,
but it is a Chaotic act, avoided by Lawful clerics.
```

## Speak with Monsters

- canonical spell key: `Speak with Monsters`
- Chapter 06 card heading: `Speak with Monsters`
- expected witness lanes: `Expert`, `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions -> Sixth-Level Clerical Spells`
- canonical spell key: `Speak with Monsters`
- Chapter 06 card heading: `Speak with Monsters`

```text
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
not interfere with the victim’s spell casting
(if any), but does prevent the use of many
magic items by turning the command
words to mere babbling.
```

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Cleric Spells`
- canonical spell key: `Speak with Monsters`
- Chapter 06 card heading: `Speak with Monsters`

```text
Speak with Monsters
[Companion (Cl6, pp.13-14): list-only; desc → RC]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Speak with Monsters`
- Chapter 06 card heading: `Speak with Monsters`

```text
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
interfere with the victim’s spellcasting (if any),
but does prevent him from using any magical
items which are activated by command words—
the command words turn into gibberish.
```

## Truesight

- canonical spell key: `Truesight`
- Chapter 06 card heading: `Truesight`
- expected witness lanes: `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Cleric Spells`
- canonical spell key: `Truesight`
- Chapter 06 card heading: `Truesight`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Truesight`
- Chapter 06 card heading: `Truesight`

```text
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
```

## Word of Recall

- canonical spell key: `Word of Recall`
- Chapter 06 card heading: `Word of Recall`
- expected witness lanes: `Expert`, `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Expert

- source lane: `Expert`
- source label: `Expert Set`
- staging anchor / section: `Clerical and Magic-User Spell Expansions -> Sixth-Level Clerical Spells`
- canonical spell key: `Word of Recall`
- Chapter 06 card heading: `Word of Recall`

```text
Word of Recall
Range: 0 (Cleric only)
Duration: Instantaneous
Effect: Teleports the caster to sanctuary
Similar to a magic-user’s teleport spell, this
spell carries the cleric and all equipment
carried (but no other creatures) to the
cleric’s home. The cleric must have a per-
manent home (such as a castle), and a med-
itation room within that home; this room is
the destination when the spell is cast. Dur-
ing the round in which this spell is cast, the
cleric automatically gains initiative unless
surprised.
```

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Cleric Spells`
- canonical spell key: `Word of Recall`
- Chapter 06 card heading: `Word of Recall`

```text
Word of Recall
[Companion (Cl6, pp.13-14): list-only; desc → RC]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Word of Recall`
- Chapter 06 card heading: `Word of Recall`

```text
Word of Recall
Range: 0 (Cleric only)
Duration: Instantaneous
Effect: Teleports the caster to sanctuary
Similar to a magic-user’s teleport spell, this
spell carries the cleric and all equipment carried
(but no other creatures) to the cleric’s home, re-
gardless of the distance. The cleric must have a
permanent home (such as a castle), and a medi-
tation room within that home; this room is the
destination when the spell is cast. During the
round in which this spell is cast, the cleric auto-
matically gains initiative unless surprised.
```

## Contact Outer Plane

- canonical spell key: `Contact Outer Plane`
- Chapter 06 card heading: `Contact Outer Plane`
- expected witness lanes: `Companion`, `Immortals`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Magic-User Spells`
- canonical spell key: `Contact Outer Plane`
- Chapter 06 card heading: `Contact Outer Plane`

```text
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
```

### Witness: Immortals

- source lane: `Immortals`
- source label: `Immortals Set`
- staging anchor / section: `Section 3: Immortal Magic -> Explanation of Terms, Charts S1-S4 -> Contact Outer Plane`
- canonical spell key: `Contact Outer Plane`
- Chapter 06 card heading: `Contact Outer Plane`

```text
Contact Outer Plane: This produces an
effect identical to that described for commune
in this section. No chance of insanity applies
to an Immortal character.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Contact Outer Plane`
- Chapter 06 card heading: `Contact Outer Plane`

```text
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
maximum allowed. The DM checks the caster’s
chance of insanity once, when the Immortal is
first contacted. If the caster is 21st level or
greater, the chance of insanity is reduced by 5%
per level of the caster above 20.
Even if insanity does not result, the Immortal
may still not know the answer to the character’s
questions, or may lie, at the DM’s discretion. If
the DM does not wish just to decide whether the
Immortal knows or is lying, he can roll on the
chart below to determine this.
```

## Charm Plant

- canonical spell key: `Charm Plant`
- Chapter 06 card heading: `Charm Plant`
- expected witness lanes: `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells`
- canonical spell key: `Charm Plant`
- Chapter 06 card heading: `Charm Plant`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Charm Plant`
- Chapter 06 card heading: `Charm Plant`

```text
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
```

## Create Normal Monsters

- canonical spell key: `Create Normal Monsters`
- Chapter 06 card heading: `Create Normal Monsters`
- expected witness lanes: `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells`
- canonical spell key: `Create Normal Monsters`
- Chapter 06 card heading: `Create Normal Monsters`

```text
Create Normal Monsters
Range: 30'
Duration: 1 turn
Effect: Creates 1 or more monsters
This spell causes monsters to appear out of
thin air. All monsters appearing will under-
stand and obey the caster’s commands-
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Create Normal Monsters`
- Chapter 06 card heading: `Create Normal Monsters`

```text
Create Normal Monsters
Range: 30'
Duration: 1 turn
Effect: Creates 1 or more monsters
This spell causes monsters to appear out of
thin air. All monsters appearing will understand
and obey the caster’s commands—fighting, car-
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
casting the spell. (If the spellcaster’s level is not
an exact multiple of the monsters’ Hit Dice,
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
```

## Summon Object

- canonical spell key: `Summon Object`
- Chapter 06 card heading: `Summon Object`
- expected witness lanes: `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells`
- canonical spell key: `Summon Object`
- Chapter 06 card heading: `Summon Object`

```text
Summon Object
Range: Infinite
Duration: Instantaneous
Effect: Retrieves 1 object from caster’s home
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Summon Object`
- Chapter 06 card heading: `Summon Object`

```text
Summon Object
Range: Infinite
Duration: Instantaneous
Effect: Retrieves one object from caster’s home
By means of this spell, the magic-user can
cause one nonliving object to leave the spellcast-
er’s home and appear in his hand. The object
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
```

## Sword

- canonical spell key: `Sword`
- Chapter 06 card heading: `Sword`
- expected witness lanes: `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells`
- canonical spell key: `Sword`
- Chapter 06 card heading: `Sword`

```text
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
at the caster’s level. Damage is the same as a
two-handed sword, but this magical creation
is capable of hitting any target (even those hit
only by powerful magic weapons). The sword
cannot be destroyed before the duration
ends, except by a dispel magic spell effect (at
normal chances for success).
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Sword`
- Chapter 06 card heading: `Sword`

```text
Sword
Range: 30'
Duration: 1 round per level of the caster
Effect: Creates a magical sword
When this spell is cast, a glowing sword made
of magic, rather than metal, appears next to the
caster. The magic-user may cause it to attack any
creature within 30', simply by concentrating; the
sword flies to the target and attacks. If the cast-
er’s concentration is broken, the sword merely
stops attacking. It remains in existence for one
round per level of the spellcaster.
The sword moves very quickly, attacking twice
per round and making its attack rolls at the cast-
er’s level. Damage is the same as a two-handed
sword (1d10), but this magical creation is capa-
ble of hitting any target (even those hit only by
powerful magical weapons).
The sword cannot be destroyed before the du-
ration ends, except by a dispel magic spell effect
(at normal chances of success) or a wish.
```

## Teleport any Object

- canonical spell key: `Teleport any Object`
- Chapter 06 card heading: `Teleport any Object`
- expected witness lanes: `Companion`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells`
- canonical spell key: `Teleport any Object`
- Chapter 06 card heading: `Teleport any Object`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Teleport any Object`
- Chapter 06 card heading: `Teleport any Object`

```text
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
```

## Anti-Animal Shell

- canonical spell key: `Anti-Animal Shell`
- Chapter 06 card heading: `Anti-Animal Shell`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Anti-Animal Shell`
- Chapter 06 card heading: `Anti-Animal Shell`

```text
Anti-Animal Shell
Range: 0 (druid only)
Duration: 1 turn per level of the caster
Effect: Personal barrier which blocks animals
This spell creates an invisible barrier around
the druid’s body (less than an inch away).
The barrier stops all attacks by animals, both
normal and giant-sized, as well as insects and
all other non-fantastic creatures of animal
intelligence or less. The druid cannot attack
animals while protected except by use of
magical spells; the animals are protected
from the druid’s physical attacks, just as the
druid is protected from theirs.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Anti-Animal Shell`
- Chapter 06 card heading: `Anti-Animal Shell`

```text
 45 Anti-Animal Shell (DR 40T; C16)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Anti-Animal Shell`
- Chapter 06 card heading: `Anti-Animal Shell`

```text
Anti-Animal Shell
Range: 0 (druid only)
Duration: 1 turn per level of the caster
Effect: Personal barrier that blocks animals
This spell creates an invisible barrier around
the druid’s body (less than an inch away). The
barrier stops all attacks by animals, both normal
and giant-sized, as well as insects and all other
nonfantastic creatures of animal intelligence or
less (0-2). The druid cannot attack animals while
protected except by use of other spells; the ani-
mals are protected from the druid’s physical at-
tacks, just as the druid is protected from theirs.
```

## Anti-Plant Shell

- canonical spell key: `Anti-Plant Shell`
- Chapter 06 card heading: `Anti-Plant Shell`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Anti-Plant Shell`
- Chapter 06 card heading: `Anti-Plant Shell`

```text
Anti-Plant Shell
Range: 0 (druid only)
Duration: 1 round per level of the druid
Effect: Personal barrier which blocks plants
This spell creates an invisible barrier around
the druid’s body (less than an inch away).
The barrier stops all attacks by plants and
plant-like monsters, so that they can inflict no
damage. If the caster pushes through normal
but dense growth while protected, an open-
ing will result, passable by others. While pro-
tected, the druid cannot attack plants except
by magic spells; the plants are protected from
the druid’s physical attacks, just as the druid
is protected from theirs.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Anti-Plant Shell`
- Chapter 06 card heading: `Anti-Plant Shell`

```text
 30 Anti-Plant Shell (DR 6T; C16)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Anti-Plant Shell`
- Chapter 06 card heading: `Anti-Plant Shell`

```text
Anti-Plant Shell
Range: 0 (druid only)
Duration: 1 round per level of the druid
Effect: Personal barrier which blocks plants
This spell creates an invisible barrier around
the druid’s body (less than an inch away). The
barrier stops all attacks by plants and plant-like
monsters, so that they can inflict no damage. If
the caster pushes through normal but dense
growth while protected, he will open a path that
others can pass through.
While protected, the druid cannot attack
plants except by spells; the plants are protected
from the druid’s physical attacks, just as the
druid is protected from theirs.
```

## Call Lightning

- canonical spell key: `Call Lightning`
- Chapter 06 card heading: `Call Lightning`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Call Lightning`
- Chapter 06 card heading: `Call Lightning`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Call Lightning`
- Chapter 06 card heading: `Call Lightning`

```text
Call Lightning
[Master Set sourcing note (D3): Master Set lists this spell as a Companion cross-reference only (C15). No new description in Master Set. Description text in Companion staging -> High-Level Cleric, Druid, and Magic-User Spell Material.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Call Lightning`
- Chapter 06 card heading: `Call Lightning`

```text
Call Lightning
Range: 360'
Duration: 1 turn per level of the caster
Effect: Calls lightning bolts from a storm
This spell cannot be used unless a storm of
some (any) type is within range of the druid.
(This does not mean that he must be within the
spell’s range of the storm cloud, but only that
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
```

## Control Temperature 10' Radius

- canonical spell key: `Control Temperature 10' Radius`
- Chapter 06 card heading: `Control Temperature 10' Radius`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Control Temperature 10' Radius`
- Chapter 06 card heading: `Control Temperature 10' Radius`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Control Temperature 10' Radius`
- Chapter 06 card heading: `Control Temperature 10' Radius`

```text
 35 Control Temperature 10' radius (DR
     40T, EF 50 degrees; C15)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Control Temperature 10' Radius`
- Chapter 06 card heading: `Control Temperature 10' Radius`

```text
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
```

## Control Winds

- canonical spell key: `Control Winds`
- Chapter 06 card heading: `Control Winds`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Control Winds`
- Chapter 06 card heading: `Control Winds`

```text
Control Winds
Range: 10' radius per level of the caster
Duration: 1 turn per level of the caster
Effect: Calms or increases winds
With this spell, the druid can cause all the air
within range to behave as desired, either
increasing to gale force or slowing to a dead
calm. One full turn of concentration (can’t
move or attack) is needed to change the wind
completely (calm to gale, for example). The
effect can be countered easily by any higher
level caster using the same spell. The effect
moves with the caster.
If used against an air creature (such as an
elemental), the victim may make a Saving
Throw vs. Spells. If this is failed, the druid
may slay or control the air creature by proper
use of the wind force. The creature will only
obey as long as concentration is maintained;
if concentration is broken, the creature will
attack (in a manner identical to elemental
control) .
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Control Winds`
- Chapter 06 card heading: `Control Winds`

```text
  30 Control Winds (DR 40T, EF 400'; C16)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Control Winds`
- Chapter 06 card heading: `Control Winds`

```text
Control Winds
Range: 10' radius per level of the caster
Duration: 1 turn per level of the caster
Effect: Calms or increases winds
With this spell, the druid can cause all the air
within range to behave as desired, either increas-
ing to gale force or slowing to a dead calm. The
druid must concentrate for one full turn of con-
centration (can’t move or attack) to change the
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
tration and while the spell is active; if the druid’s
concentration is broken or the spell’s duration
lapses, the creature will attack the druid.
```

## Creeping Doom

- canonical spell key: `Creeping Doom`
- Chapter 06 card heading: `Creeping Doom`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Creeping Doom`
- Chapter 06 card heading: `Creeping Doom`

```text
Creeping Doom
Range: 120'
Duration: 1 round per level of the caster
Effect: Creates a 20' x 20' insect horde
This spell magically creates a huge swarm of
1,000 creeping insects, appearing anywhere
within 120' of the druid (as chosen by the
caster). They fill an area 20' x 20' at least,
and can be ordered to fill any area up to 60'.
60' (at most).
The creeping doom can move at up to 60'/
turn (20 '/round) if the caster remains within
120' of any part of the swarm. They vanish
after the duration ends, or whenever the
druid is more than 120' from them.
The insects always attack everyone and
everything in their path, inflicting 1 point of
damage per 10 insects-a total of 100 points
per round per creature-to all within it (no
Saving Throw). Normal attacks (such as fire)
can damage the horde slightly, but even a
fireball spell will only slay 100 of them (reduc-
ing the damage accordingly). The creeping
doom can be destroyed by a dispel magic spell
(at normal chances for success), but it can
penetrate a protection from evil effect, and
can move over most obstacles at the normal
movement rate.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Creeping Doom`
- Chapter 06 card heading: `Creeping Doom`

```text
Creeping Doom
[Master Set sourcing note (D7): Master Set lists this spell as a Companion cross-reference only (C16). No new description in Master Set. Description text in Companion staging -> High-Level Cleric, Druid, and Magic-User Spell Material.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Creeping Doom`
- Chapter 06 card heading: `Creeping Doom`

```text
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
```

## Faerie Fire

- canonical spell key: `Faerie Fire`
- Chapter 06 card heading: `Faerie Fire`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Faerie Fire`
- Chapter 06 card heading: `Faerie Fire`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Faerie Fire`
- Chapter 06 card heading: `Faerie Fire`

```text
Faerie Fire
[Master Set sourcing note (D1): Master Set lists this spell as a Companion cross-reference only (C14). No new description in Master Set. Description text in Companion staging -> High-Level Cleric, Druid, and Magic-User Spell Material.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Faerie Fire`
- Chapter 06 card heading: `Faerie Fire`

```text
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
```

## Hold Animal

- canonical spell key: `Hold Animal`
- Chapter 06 card heading: `Hold Animal`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Hold Animal`
- Chapter 06 card heading: `Hold Animal`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Hold Animal`
- Chapter 06 card heading: `Hold Animal`

```text
   15 Hold Animal (R 180', DR 40T, EF one
      type, 4 cr; C15)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Hold Animal`
- Chapter 06 card heading: `Hold Animal`

```text
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
```

## Locate

- canonical spell key: `Locate`
- Chapter 06 card heading: `Locate`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Locate`
- Chapter 06 card heading: `Locate`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Locate`
- Chapter 06 card heading: `Locate`

```text
Locate
[Master Set sourcing note (D1): Master Set lists this spell as a Companion cross-reference only (C15). No new description in Master Set. Description text in Companion staging -> High-Level Cleric, Druid, and Magic-User Spell Material.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Locate`
- Chapter 06 card heading: `Locate`

```text
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
```

## Metal to Wood

- canonical spell key: `Metal to Wood`
- Chapter 06 card heading: `Metal to Wood`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Metal to Wood`
- Chapter 06 card heading: `Metal to Wood`

```text
Metal to Wood
Range: 120'
Duration: Permanent
Effect: Changes metal into dead wood
This spell can be used to change any metal
item or items into wood. The amount that
can be transmuted is 50 cn per level of the
caster. Any magical metal item is 90% resist-
ant to the magic. The effect is permanent,
and cannot be changed back with a dispel
magic spell.
Any armor changed to wood falls off the
wearer and any weapons affected turn to
non-m '-a1 wooden clubs.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Metal to Wood`
- Chapter 06 card heading: `Metal to Wood`

```text
  80 Metal to Wood (R 120', EF 2,000 cn;
     C16)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Metal to Wood`
- Chapter 06 card heading: `Metal to Wood`

```text
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
```

## Obscure

- canonical spell key: `Obscure`
- Chapter 06 card heading: `Obscure`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Obscure`
- Chapter 06 card heading: `Obscure`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Obscure`
- Chapter 06 card heading: `Obscure`

```text
  20 Obscure (DR 40T, EF 400 sq.ft./40' high;
      C15)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Obscure`
- Chapter 06 card heading: `Obscure`

```text
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
```

## Pass Plant

- canonical spell key: `Pass Plant`
- Chapter 06 card heading: `Pass Plant`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Pass Plant`
- Chapter 06 card heading: `Pass Plant`

```text
Pass Plant
Range: 0 (druid only)
Duration: Instantaneous
Effect: Short-range teleportation
With this spell, the druid can enter one tree,
teleport, and immediately step out of another
tree of the same type. The trees must be large
enough to enclose the druid. The range a
druid can teleport varies by the type of tree,
as follows.
Oak
600 yards
360 yards
Ash, Elm, Linden, Yew
Evergreen trees
240 yards
300 yards
Other trees
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Pass Plant`
- Chapter 06 card heading: `Pass Plant`

```text
   35 Pass Plant (EF 300-600 yards; C16)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Pass Plant`
- Chapter 06 card heading: `Pass Plant`

```text
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
```

## Plant Door

- canonical spell key: `Plant Door`
- Chapter 06 card heading: `Plant Door`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Plant Door`
- Chapter 06 card heading: `Plant Door`

```text
Plant Door
Range: 0 (druid only)
Duration: 1 turn per level of the caster
Effect: Opens a path through growth
For the duration of this spell, no plants can
prevent the druid’s passage, no matter how
dense. Even trees will bend or magically open
to allow the druid to pass. All equipment car-
ried can also be moved through such barriers,
but no other creature can use the passage.
Note that a druid can hide inside a large
tree after casting this spell. The druid cannot
see what is happening while he is in the tree.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Plant Door`
- Chapter 06 card heading: `Plant Door`

```text
Plant Door
[Master Set sourcing note (D4): Master Set lists this spell as a Companion cross-reference only (C15). No new description in Master Set. Description text in Companion staging -> High-Level Cleric, Druid, and Magic-User Spell Material.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Plant Door`
- Chapter 06 card heading: `Plant Door`

```text
Plant Door
Range: 0 (druid only)
Duration: 1 turn per level of the caster
Effect: Opens a path through growth
For the duration of this spell, no plants can
prevent the druid’s passage, no matter how
dense. Even trees will bend or magically open to
allow the druid to pass. The druid can freely car-
ry equipment while moving through such barri-
ers, but no other creature can use the passage.
Note that a druid can hide inside a large tree
after casting this spell. The druid cannot see
what is happening while he is in the tree.
```

## Predict Weather

- canonical spell key: `Predict Weather`
- Chapter 06 card heading: `Predict Weather`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Predict Weather`
- Chapter 06 card heading: `Predict Weather`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Predict Weather`
- Chapter 06 card heading: `Predict Weather`

```text
  10 Predict Weather (DR 12 hours, EF 40
      miles; C15)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Predict Weather`
- Chapter 06 card heading: `Predict Weather`

```text
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
```

## Produce Fire

- canonical spell key: `Produce Fire`
- Chapter 06 card heading: `Produce Fire`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Produce Fire`
- Chapter 06 card heading: `Produce Fire`

```text
Produce Fire
Range: 0 (druid only)
Duration: 2 turns per level
Effect: Creates fire in hand
This spell causes a small flame to appear in
the druid’s hand. It does not harm the caster
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
disappears 1 round after leaving the druid’s
hand.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Produce Fire`
- Chapter 06 card heading: `Produce Fire`

```text
Produce Fire
[Master Set sourcing note (D2): Master Set lists this spell as a Companion cross-reference only (C15). No new description in Master Set. Description text in Companion staging -> High-Level Cleric, Druid, and Magic-User Spell Material.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Produce Fire`
- Chapter 06 card heading: `Produce Fire`

```text
Produce Fire
Range: 0 (druid only)
Duration: 2 turns per level
Effect: Creates fire in hand
This spell causes a small flame to appear in the
druid’s hand. It does not harm the caster in any
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
the druid’s hand. (Any fire it ignites during that
round remains burning.)
```

## Protection from Lightning

- canonical spell key: `Protection from Lightning`
- Chapter 06 card heading: `Protection from Lightning`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Protection from Lightning`
- Chapter 06 card heading: `Protection from Lightning`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Protection from Lightning`
- Chapter 06 card heading: `Protection from Lightning`

```text
 40 Protection from Lightning (R Touch,
    DR 40T, EF 40 dice D; C15)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Protection from Lightning`
- Chapter 06 card heading: `Protection from Lightning`

```text
Protection from Lightning
Range: Touch
Duration: 1 turn per level of the caster
Effect: Protects against lightning attack
Any recipient of this spell is immune to a
given amount of electrical damage. The druid’s
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
```

## Summon Weather

- canonical spell key: `Summon Weather`
- Chapter 06 card heading: `Summon Weather`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Summon Weather`
- Chapter 06 card heading: `Summon Weather`

```text
Summon Weather
Range: 5 miles or more
Duration: 6 turns per level
Effect: Brings weather to druid’s area
When this spell is cast, some known nearby
weather is pulled to the druid’s location. The
druid does not have control of the weather,
but merely summons it.
Severe weather (hurricane, severe heat
wave, etc.) may only be summoned by a
druid of 25th level or greater. The range of
summoning is 5 miles at levels 12 to 15, add-
ing 1 mile for each level of the caster above
15th. (For example, a 20th level druid could
summon weather from up to 10 miles away.)
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Summon Weather`
- Chapter 06 card heading: `Summon Weather`

```text
  55 Summon Weather (DR 240T, EF 30
     miles; C16)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Summon Weather`
- Chapter 06 card heading: `Summon Weather`

```text
Summon Weather
Range: 5 miles or more
Duration: 6 turns per level
Effect: Brings weather to druid’s area
When the druid casts this spell, some known
nearby weather condition is pulled to the druid’s
location. The druid does not have control of the
weather, but merely summons it.
Only a druid of 25th level or greater may sum-
mon severe weather (hurricane, severe heat
wave, etc.). The range of summoning is 5 miles
at levels 12 to 15, adding 1 mile for each level of
the caster above 15th. (A 20th level druid could
summon weather from up to 10 miles away.)
```

## Transport Through Plants

- canonical spell key: `Transport Through Plants`
- Chapter 06 card heading: `Transport Through Plants`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Transport Through Plants`
- Chapter 06 card heading: `Transport Through Plants`

```text
Transport Through Plants
Range: Infinite
Duration: Instantaneous
Effect: Long-range teleportation
This spell may be used once per day at most.
The druid must be near a plant (of any size),
and must choose either a general location or a
specific known plant elsewhere. After casting
the spell, the druid magically enters the
nearby plant and steps out of a plant at the
destination (the exact plant determined ran-
domly if not specified). There is no limit to
the range, but the plants must both be living
for the spell to work, and must both be on the
same Plane of Existence. If either plant is
dead, the spell fails. Otherwise, the caster
immediately reappears at the new location.
The caster can transport 2 additional, will-
ing creatures.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Transport Through Plants`
- Chapter 06 card heading: `Transport Through Plants`

```text
   45 Transport Through Plants (EF +2 cr;
      C16)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Transport Through Plants`
- Chapter 06 card heading: `Transport Through Plants`

```text
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
```

## Warp Wood

- canonical spell key: `Warp Wood`
- Chapter 06 card heading: `Warp Wood`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Warp Wood`
- Chapter 06 card heading: `Warp Wood`

```text
Warp Wood
Range: 240'
Duration: Permanent
Effect: Causes wooden weapons to bend
This spell causes one or more wooden weap-
ons to bend and (probably) become useless.
The spell will affect one arrow for each level
of the caster; a spear, javelin, or magic wand
is treated as two arrows’ worth, and any club
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Warp Wood`
- Chapter 06 card heading: `Warp Wood`

```text
  15 Warp Wood(R240', EF40 arrows; C15)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Warp Wood`
- Chapter 06 card heading: `Warp Wood`

```text
Warp Wood
Range: 240'
Duration: Permanent
Effect: Causes wooden weapons to bend
This spell causes one or more wooden weap-
ons to bend and (probably) become useless.
The spell will affect one arrow for each level of
the caster; treat a spear, javelin, or magical
wand as two arrows’ worth, and any club, bow
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
```

## Weather Control

- canonical spell key: `Weather Control`
- Chapter 06 card heading: `Weather Control`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Weather Control`
- Chapter 06 card heading: `Weather Control`

```text
Weather Control
Range: 0 (magic-user only)
Duration: Concentration
Effect: All weather within 240 yards
This spell allows the magic-user to create one
special weather condition in the surrounding
area (within a 240 yard radius). The caster
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Weather Control`
- Chapter 06 card heading: `Weather Control`

```text
  80 Weather Control (DR Conc., EF 240
     yards; C16)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic and Magical Spells Lists and Spell Descriptions`
- canonical spell key: `Weather Control`
- Chapter 06 card heading: `Weather Control`

```text
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
The spell’s effects vary, but the following results
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
```

## Detect Danger

- canonical spell key: `Detect Danger`
- Chapter 06 card heading: `Detect Danger`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Detect Danger`
- Chapter 06 card heading: `Detect Danger`

```text
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
the druid’s point of view). Note that most
creatures are potentially dangerous. This
spell will detect poisons, while other spells
may not. The spell duration is a full hour
when used in natural outdoor settings on the
Prime Plane; elsewhere, the duration is half
normal (three turns).
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Detect Danger`
- Chapter 06 card heading: `Detect Danger`

```text
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
the druid’s point of view). Note that most crea-
tures are potentially dangerous. This spell will
detect poisons, while other spells may not.
The duration is a full hour when used in natu-
ral outdoor settings on the Prime Plane; else-
where, the duration is half normal (three turns).
```

## Dissolve

- canonical spell key: `Dissolve`
- Chapter 06 card heading: `Dissolve`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Magic-User Spells`
- canonical spell key: `Dissolve`
- Chapter 06 card heading: `Dissolve`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Dissolve`
- Chapter 06 card heading: `Dissolve`

```text
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
width and length (20' x 150', 30' x 100',
etc.), but the entire area of effect must be
within 240 feet of the caster. Creatures mov-
ing through the mud are slowed to 10% of
their normal movement rate at best, and may
become stuck.
The reverse of this spell, harden, changes
the same volume of mud to rock, but permanently. A victim in the mud may make a Sav-
ing Throw vs. Spells to avoid being trapped.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic and Magical Spells Lists and Spell Descriptions`
- canonical spell key: `Dissolve`
- Chapter 06 card heading: `Dissolve`

```text
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
rate at best, and may become stuck (at the DM’s
discretion, a victim must make saving throw vs.
spells to avoid becoming stuck).
```

## Heat Metal

- canonical spell key: `Heat Metal`
- Chapter 06 card heading: `Heat Metal`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Heat Metal`
- Chapter 06 card heading: `Heat Metal`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Heat Metal`
- Chapter 06 card heading: `Heat Metal`

```text
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
```

## Protection from Poison

- canonical spell key: `Protection from Poison`
- Chapter 06 card heading: `Protection from Poison`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Protection from Poison`
- Chapter 06 card heading: `Protection from Poison`

```text
Protection from Poison
Range: Touch
Duration: One turn per level of the caster
Effect: Gives one creature immunity to all
poison
For the duration of this spell, the recipient
is completely immune to the effects of poisons
of all types, including gas traps and cloudkill
spells. This protection extends to items car-
ried (thus protecting against a spirit’s poison-
ous presence, for example). Furthermore, the
recipient gains a +4 bonus on Saving
Throws vs. Poisonous Breath weapons (such
as green dragon breath) but not petrification
breath (such as a gorgon’s).
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Protection from Poison`
- Chapter 06 card heading: `Protection from Poison`

```text
Protection from Poison
Range: Touch
Duration: One turn per level of the caster
Effect: Gives one creature immunity to all poison
For the duration of this spell, the recipient is
completely immune to the effects of poisons of
all types, including gas traps and cloudkill spells.
This protection extends to items carried (thus
protecting against a spirit’s poisonous presence,
for example). Furthermore, the recipient gains a
+ 4 bonus on saving throws vs. poisonous breath
weapons (such as green dragon breath), but not
petrification breath (such as a gorgon’s).
```

## Summon Animals

- canonical spell key: `Summon Animals`
- Chapter 06 card heading: `Summon Animals`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Summon Animals`
- Chapter 06 card heading: `Summon Animals`

```text
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
druid’s speech while the spell is in effect.
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Summon Animals`
- Chapter 06 card heading: `Summon Animals`

```text
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
movement rate, and will understand the druid’s
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
```

## Summon Elemental

- canonical spell key: `Summon Elemental`
- Chapter 06 card heading: `Summon Elemental`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Summon Elemental`
- Chapter 06 card heading: `Summon Elemental`

```text
Summon Elemental
Range: 240 feet
Duration: 6 turns
Effect: Summons one 16 HD elemental
This spell allows the caster to summon any
one elemental per spell (see D&D Expert
Rulebook, page 49). Only one of each type of
elemental (air, earth, fire, water) may be
summoned in one day. The elemental will
understand the druid’s spoken commands
and will perform any tasks within its power
(carrying, attacking, etc.) as directed by the
caster. Unlike the magic-user spell, no con-
centration is needed to control the creature.
It may be sent back to its own plane on com-
mand of the caster, or by the use of a dispel
magic or dispel evil spell.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Summon Elemental`
- Chapter 06 card heading: `Summon Elemental`

```text
Summon Elemental
Range: 240'
Duration: 6 turns
Effect: Summons one 16 HD elemental
This spell allows the caster to summon any one
elemental per spell (see Chapter 14). The druid
may only summon one of each type of elemental
(air, earth, fire, water) in one day. The elemental
will understand the druid’s spoken commands
and will perform any tasks within its power (car-
rying, attacking, etc.) as directed by the caster.
Unlike the magic-user’s version of the spell,
the druid does not need to concentrate to control
the creature. The caster may send it back to its
own plane with a simple command, and some-
one else may send it back by the use of a dispel
magic or dispel evil spell.
```

## Survival

- canonical spell key: `Survival`
- Chapter 06 card heading: `Survival`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Seventh-Level Cleric Spells`
- canonical spell key: `Survival`
- Chapter 06 card heading: `Survival`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical and Magical Spell Descriptions`
- canonical spell key: `Survival`
- Chapter 06 card heading: `Survival`

```text
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
```

## Travel

- canonical spell key: `Travel`
- Chapter 06 card heading: `Travel`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level and Ninth-Level Magic-User Spells`
- canonical spell key: `Travel`
- Chapter 06 card heading: `Travel`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical and Magical Spell Descriptions`
- canonical spell key: `Travel`
- Chapter 06 card heading: `Travel`

```text
Travel
Range: 0
Duration: One turn per level of the caster
Effect: Allows aerial or gaseous travel
This spell allows the cleric to move quickly
and freely, even between the planes of existence.
The caster (only) may fly in the same manner as
given by the magic-user’s spell, at a rate of 360'
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
```

## Turn Wood

- canonical spell key: `Turn Wood`
- Chapter 06 card heading: `Turn Wood`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Druid Spell Material`
- canonical spell key: `Turn Wood`
- Chapter 06 card heading: `Turn Wood`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Druidic Spells List and Spell Descriptions`
- canonical spell key: `Turn Wood`
- Chapter 06 card heading: `Turn Wood`

```text
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
```

## Wish

- canonical spell key: `Wish`
- Chapter 06 card heading: `Wish`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level and Ninth-Level Magic-User Spells`
- canonical spell key: `Wish`
- Chapter 06 card heading: `Wish`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical and Magical Spell Descriptions`
- canonical spell key: `Wish`
- Chapter 06 card heading: `Wish`

```text
Wish
Range: Special
Duration: Special
Effect: Special

  A wish is the single most powerful sp
magic-user can have. It is never found
scroll, but may be placed elsewhere (in a
for example) in rare cases. Only magic-use
36th level and with an 18 (or greater) Wi
score may cast the wish spell.
   Wording the Wish: The player must sa
write the exact wish his character makes.
wording is very important. The wish will us
follow the literal wording, and whatever th
tentions of the magic-user.
  The DM should try to maintain game bala
being neither too generous nor too stingy i
ciding the effects of a wish. Even a badly ph
wish, made with good intentions, may
good results. However, if the wish is greed
made with malicious intent, the DM sh
make every effort to distort the results o
spell so that the caster does not profit from
necessary, the DM can even disallow the wi
would then have no effect. Whenever a wish
or is misinterpreted, the DM should explain
ter the game) the problem or flaw in the p
ing.
   Here are some examples of faulty wishes:
   "I wish that I knew everything about
dungeon" could result in the character kno
all for only a second, and then forgetting it
   "I wish for a million gold pieces" ca
granted by having them land on the char
(that’s 100,000 pounds of gold!), and then
ish.
   "I wish to immediately and permanently
sess the gaze power of a basilisk while reta
all of my own abilities and items" is a care
worded wish that’s out of balance. Chara
```

## Wizardry

- canonical spell key: `Wizardry`
- Chapter 06 card heading: `Wizardry`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Seventh-Level Cleric Spells`
- canonical spell key: `Wizardry`
- Chapter 06 card heading: `Wizardry`

```text
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Clerical Spells List and Spell Descriptions`
- canonical spell key: `Wizardry`
- Chapter 06 card heading: `Wizardry`

```text
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
his own list and the cleric’s spell list.
Druidic spells tend to concern nature and the
natural order of life rather than combat or power
like many of the clerical and magical spells. Dru-
idic spells are also not reversible.
```

## Clone

- canonical spell key: `Clone`
- Chapter 06 card heading: `Clone`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level Magic-User Spells`
- canonical spell key: `Clone`
- Chapter 06 card heading: `Clone`

```text
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
must be cast on one pound of the original’s
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
younger, less-experienced, 20th-level form.
If a clone duplicates a living person, or if
the dead original regains life, a very hazard-
ous situation develops. Each form instantly
becomes aware of the other’s existence. A
partial mind-link exists between them; each
can feel the other’s emotions (but no other
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
inal’s flesh is needed, and the cost of other
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
The simulacrum’s alignment is the same as
that of the spell caster, regardless of the origi-
nal’s alignment. Its Armor Class, movement
rate, morale, and number of attacks are the
same as the original’s.
A simulacrum has only 50% of the origi-
nal’s Hit Dice, hit points, and damage per
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
mum of 90% of the original’s statistics.
When complete, the DM rolls again to see
which special abilities previously missing are
gained, including spells and spell-like abilities (using the 90% chance for each; all may
be present).
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Clone`
- Chapter 06 card heading: `Clone`

```text
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
cast on one pound of the person’s flesh. This
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
aware of the other’s existence. A partial mind-
link exists between them; each can feel the oth-
er’s emotions (but no other thoughts). If either
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
of the fighter’s flesh for this precise purpose,
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
simulacrum. One percent of the original’s flesh
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
The simulacrum’s alignment is the same as
that of the spellcaster, regardless of the original
creature’s alignment. Its armor class, movement
rate, morale, and number of attacks are the same
as the original’s.
A simulacrum has only 50% of the original’s
Hit Dice, hit points, and damage per attack. The
DM rolls d100 for each special ability; it is present
in the simulacrum if the result is 01-50. However,
a freshly grown simulacrum never has any of the
spells or spell-like abilities of the original.
If the original creature is alive, the simula-
crum does not grow beyond this point. If the
original creature dies (or is already dead), the
simulacrum continues to increase in abilities,
gaining an additional 5% per week to a maxi-
mum of 90% of the original’s statistics. When
complete, the DM rolls again to see which spe-
cial abilities previously missing are gained, in-
cluding spells and spell-like abilities (using the
90% chance for each; all may be present).
```

## Contingency

- canonical spell key: `Contingency`
- Chapter 06 card heading: `Contingency`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level and Ninth-Level Magic-User Spells`
- canonical spell key: `Contingency`
- Chapter 06 card heading: `Contingency`

```text
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
on a far-off occurrence is beyond the spell’s
capacity. The target and effect of the second-
ary spell must always be specified, and if any
needed details are lacking, the secondary
spell does not occur.
A contingency spell effect has no maxi-
mum duration. It may remain for centuries
before the situation described comes to pass.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Contingency`
- Chapter 06 card heading: `Contingency`

```text
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
currence is beyond the spell’s capacity. The
target and effect of the secondary spell must al-
ways be specified, and if any necessary details are
lacking, the secondary spell does not occur.
A contingency spell effect has no maximum
duration. It may remain for centuries before the
situation described comes to pass.
```

## Create Any Monster

- canonical spell key: `Create Any Monster`
- Chapter 06 card heading: `Create Any Monster`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level and Ninth-Level Magic-User Spells`
- canonical spell key: `Create Any Monster`
- Chapter 06 card heading: `Create Any Monster`

```text
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
described in the Companion Set, DM’s
Book, page 21), the proper materials must be
used with this spell. Only one construct will
appear, regardless of the caster’s Hit Dice;
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

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Create Any Monster`
- Chapter 06 card heading: `Create Any Monster`

```text
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
er’s Hit Dice; but it is permanent, and does not
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
```

## Create Magical Monsters

- canonical spell key: `Create Magical Monsters`
- Chapter 06 card heading: `Create Magical Monsters`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level Magic-User Spells`
- canonical spell key: `Create Magical Monsters`
- Chapter 06 card heading: `Create Magical Monsters`

```text
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
The total number of Hit Dice of monsters
appearing is equal to the level of the magic-
user casting the spell. Humans and demi-
humans may not be created by this spell, but
undead are permitted. Creatures of 1-1 Hit Die are counted as 1 Hit Die; creatures of 1/2 Hit Die or less are counted as 1/2 Hit Die each.
Special Note: To create a construct (as
defined in the Companion Set DM’s Book,
page 21), the proper materials must be used
with this spell. Only one construct will
appear, regardless of the caster’s Hit Dice;
but it is permanent, and does not vanish at
the end of the spell duration. The construct,
however, may have only two asterisks (special
abilities) or less. The cost of materials is a
minimum of 5,000 gp per asterisk (or more,
depending on your campaign).
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Create Magical Monsters`
- Chapter 06 card heading: `Create Magical Monsters`

```text
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
caster’s level is not an exact multiple of the crea-
tures’ Hit Dice). The spell does not create hu-
mans or demihumans, but can create undead.
Creatures of 1-1 Hit Die count as 1 Hit Die; crea-
tures of 1/2 Hit Die or less count as 1/2 Hit Die
each.
Special Note: This spell can create a construct
(as defined in Chapter 14) if the spellcaster uses
the materials normally required for the con-
struct’s creation. Only one construct will appear,
regardless of the caster’s Hit Dice; but it is per-
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
```

## Dance

- canonical spell key: `Dance`
- Chapter 06 card heading: `Dance`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Eighth-Level Magic-User Spells`
- canonical spell key: `Dance`
- Chapter 06 card heading: `Dance`

```text
Dance
Range: Touch
Duration: 3 or more rounds
Effect: Causes 1 victim to dance
This spell causes one victim to prance madly
about, performing a jig or other dance, for 3
or more rounds. The victim gets no Saving
Throw, and cannot attack, use spells (or
spell-like abilities), or flee. While dancing, a
-4 penalty applies to the victim’s Saving
Throws, and a +4 penalty to Armor Class as
well.
The magic-user must touch the victim for
the spell to take effect (a normal Hit Roll).
The duration is 3 rounds for a caster of 18th-
20th level; 4 rounds for levels 21-24,5 rounds
at levels 25-28,6 rounds at levels 29-32, and 7
rounds at levels 33-36.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level Magic-User Spells`
- canonical spell key: `Dance`
- Chapter 06 card heading: `Dance`

```text
   75 Dance (R Touch, DR 8r, EF -4STIAC;
      C24)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Dance`
- Chapter 06 card heading: `Dance`

```text
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
```

## Explosive Cloud

- canonical spell key: `Explosive Cloud`
- Chapter 06 card heading: `Explosive Cloud`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Eighth-Level Magic-User Spells`
- canonical spell key: `Explosive Cloud`
- Chapter 06 card heading: `Explosive Cloud`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level Magic-User Spells`
- canonical spell key: `Explosive Cloud`
- Chapter 06 card heading: `Explosive Cloud`

```text
  75 Explosive Cloud (R 1', DR 6T, EF
       20' x 30' x 30', 20 hp/r; C24)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Explosive Cloud`
- Chapter 06 card heading: `Explosive Cloud`

```text
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
```

## Force Field

- canonical spell key: `Force Field`
- Chapter 06 card heading: `Force Field`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level Magic-User Spells`
- canonical spell key: `Force Field`
- Chapter 06 card heading: `Force Field`

```text
Force Field
Range: 120 feet
Duration: 6 turns
Effect: Creates an invisible barrier
This spell creates an invisible, immovable
barrier or object of pure force. It has almost
no thickness, but cannot be broken or
destroyed by any means except a disintegrate
spell or a wish; even a dispel magic cannot
affect it. A force field’s shape is limited to a
sphere, part of a sphere, a flat surface, a cyl-
inder, a square or rectangular box with flat
sides, or part of such a box. The sphere’s
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
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Force Field`
- Chapter 06 card heading: `Force Field`

```text
Force Field
Range: 120'
Duration: 6 turns
Effect: Creates an invisible barrier
This spell creates an invisible, immovable bar-
rier or object of pure force. It has almost no
thickness, but cannot be broken or destroyed by
any means except a disintegrate spell or a wish;
even a dispel magic spell cannot affect it. A force
field’s shape is limited to a sphere, hemisphere,
a flat surface, a cylinder, a square or rectangular
box with flat sides, or part of such a box. The
sphere’s radius can be a maximum of 20'. The
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
```

## Gate

- canonical spell key: `Gate`
- Chapter 06 card heading: `Gate`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Ninth-Level Magic-User Spells`
- canonical spell key: `Gate`
- Chapter 06 card heading: `Gate`

```text
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
explained in the Dungeon Master’s book.
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level and Ninth-Level Magic-User Spells`
- canonical spell key: `Gate`
- Chapter 06 card heading: `Gate`

```text
Gate
[Master Set sourcing note (MU9): Master Set lists this spell as a Companion cross-reference only (C26). No new description in Master Set. Description text in Companion staging -> High-Level Cleric, Druid, and Magic-User Spell Material.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Gate`
- Chapter 06 card heading: `Gate`

```text
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
mortal he calls will probably (95% chance) arrive
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
of some interest to the being (DM’s discretion),
it may actually help for a short time.
The reverse of this spell, close gate, will close a
gate created by normal form of the spell. It can
also be used to close a permanent gate to a near-
by plane (such as an elemental vortex). But the
spell cannot affect an Immortal; it cannot, for
instance, make him leave if he chooses to stay.
```

## Heal

- canonical spell key: `Heal`
- Chapter 06 card heading: `Heal`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level and Ninth-Level Magic-User Spells`
- canonical spell key: `Heal`
- Chapter 06 card heading: `Heal`

```text
Heal*
Range: Touch (one creature)
Duration: Permanent
Effect: Cures anything
This spell’s effect is identical to that of the
6th-level cleric spell cureall. When used to
cure wounds, it cures nearly all of the dam-
age, leaving only 1-6 points of damage
remaining. It will remove a curse, neutralize
a poison, cure a disease, cure blindness, or
even remove a feeblemind effect.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Heal`
- Chapter 06 card heading: `Heal`

```text
Heal
Range: Touch (one creature)
Duration: Permanent
Effect: Cures anything
This spell’s effect is identical to that of the 6th
level cleric spell cureall. When used to cure
wounds, it cures nearly all of the damage, leav-
ing only 1d6 points of damage remaining. It can
instead remove a curse, neutralize a poison, cure
a disease, cure blindness, or even remove a
feeblemind effect.
```

## Immunity

- canonical spell key: `Immunity`
- Chapter 06 card heading: `Immunity`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level and Ninth-Level Magic-User Spells`
- canonical spell key: `Immunity`
- Chapter 06 card heading: `Immunity`

```text
Immunity
Range: Touch (one creature)
Duration: One turn per level of the caster
Effect: Bestows immunity or resistance to
some spells and weapons
This spell gives the creature touched total
immunity to all 1st-, 2nd-, and 3rd-level
spells. Furthermore, 4th- and 5th-level spells
have only half normal effect, or one-quarter
normal if a saving throw applies and is suc-
cessful. Any effect that is quantifiable can be
reduced in this manner. These effects include
duration, bonuses, penalties, damage, etc. If
necessary, round numbers off in the recipi-
ent’s favor. For example, if the recipient were
the victim of a cause critical wounds cleric
spell, only 3-10 points of damage would
result.
The recipient is also completely immune to
all missiles (normal or magical), normal and
silver weapons, and takes half damage from
magical hand-held weapons. This applies
only to weapons; claws, bites, breath weap-
ons, and other natural attack forms are not
blocked.
By concentrating, the recipient can drop
the protection, allowing spells (such as cure
wounds) to have normal effects for that
round. If dropped, the immunity is totally
absent for that round (including the protec-
tion from weapons), but returns automati-
cally at the end of the round.
A carefully worded wish spell may extend
this protection, giving immunity to 4th level
spells and +1 weapons, and half normal
effect from 5th- and 6th-level spells. No fur-
ther improvement is possible.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Immunity`
- Chapter 06 card heading: `Immunity`

```text
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
off in the recipient’s favor.
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
```

## Mass Charm

- canonical spell key: `Mass Charm`
- Chapter 06 card heading: `Mass Charm`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Eighth-Level Magic-User Spells`
- canonical spell key: `Mass Charm`
- Chapter 06 card heading: `Mass Charm`

```text
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
by the victim’s intelligence (see the D&D
Basic DM Rulebook, page 14). If the magic-
user attacks one of the charmedvictims, only
that creature’s charm is automatically bro-
ken. Any other charmed creatures that see
the attack may make another Saving Throw,
but other creatures’ charms are not affected.
The reverse of this spell, remove charm,
will unfailingly remove all charm effects
within a 20'. 20'. 20' volume. It will also
prevent any object in that area from creating
charm effects for 1 turn.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level Magic-User Spells`
- canonical spell key: `Mass Charm`
- Chapter 06 card heading: `Mass Charm`

```text
   75 Mass Charm (R 120', EF 30HD, -2
      Save; C24)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Mass Charm`
- Chapter 06 card heading: `Mass Charm`

```text
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
the victim’s Intelligence (see charm person,
above). If the magic-user attacks one of the
charmed victims, only that one creature’s charm
is automatically broken. Any other charmed
creatures seeing the attack may make another
saving throw, but other creatures’ charms are not
affected.
The reverse of this spell, remove charm, will
unfailingly remove all charm effects within a
20' x 20' x 20' volume. It will also prevent any
object in that area from creating charm effects
for one turn.
```

## Maze

- canonical spell key: `Maze`
- Chapter 06 card heading: `Maze`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Ninth-Level Magic-User Spells`
- canonical spell key: `Maze`
- Chapter 06 card heading: `Maze`

```text
Maze
Range: 60'
Duration: See below (1-6 turns, 2-40 rounds,
2-8 rounds, or 1-4 rounds)
Effect: Traps 1 creature
This spell creates a maze in the Astral plane
and places one victim into the maze (no Sav-
ing Throw). The intelligence of the victim
determines the time needed to escape the
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level and Ninth-Level Magic-User Spells`
- canonical spell key: `Maze`
- Chapter 06 card heading: `Maze`

```text
  100 Maze (R 60', DR 6T to 4r; C26)
 A4. Miscellaneous Attack Forms
  cost
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Maze`
- Chapter 06 card heading: `Maze`

```text
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
Victim’s
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
```

## Meteor Swarm

- canonical spell key: `Meteor Swarm`
- Chapter 06 card heading: `Meteor Swarm`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Ninth-Level Magic-User Spells`
- canonical spell key: `Meteor Swarm`
- Chapter 06 card heading: `Meteor Swarm`

```text
Meteor Swarm
Range: 240'
Duration: Instantaneous
Effect: Creates 4 or 8 meteor-fireballs
This spell creates either 4 or 8 meteors (at the
caster’s choice). Each meteor can be aimed at
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level and Ninth-Level Magic-User Spells`
- canonical spell key: `Meteor Swarm`
- Chapter 06 card heading: `Meteor Swarm`

```text
 100 Meteor Swarm (R 240', EF 4 for
       8d6 +8d6 or 8 for 4d6 +4d6; C26)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Meteor Swarm`
- Chapter 06 card heading: `Meteor Swarm`

```text
Meteor Swarm
Range: 240'
Duration: Instantaneous
Effect: Creates four or eight meteor-fireballs
This spell creates either 4 or 8 meteors (at the
caster’s choice). Each meteor can be aimed at a
different target within range, but only one me-
teor can be aimed at any one creature. Each me-
teor slams into its target and explodes like a
fireball (affecting all creatures within a 20' radi-
us).
If the caster creates four meteors, each strikes
for 8d6 (8-48) points of damage and then ex-
plodes for 8d6 (8-48) points of fire damage. If
the caster creates eight smaller meteors,
strikes for 4d6 (4-24) points and then exp
for 4d6 more points of fire damage. Note t
the meteors are aimed accurately, a victim o
might find itself within overlapping blasts
thus take explosion damage multiple times
   The player rolls damage for each strike
blast separately. A meteor never misses its ta
   Any victim struck by a meteor takes
"strike" damage (no saving throw). Each v
within a blast radius may make a saving t
vs. spells to take only half of the given blast
age. Even fire-resistant and fire-using crea
are fully affected by strikes from a m
swarm, although they might be resistant t
fiery explosions. A separate saving throw
be made for each blast the character contac
```

## Mind Barrier

- canonical spell key: `Mind Barrier`
- Chapter 06 card heading: `Mind Barrier`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Eighth-Level Magic-User Spells`
- canonical spell key: `Mind Barrier`
- Chapter 06 card heading: `Mind Barrier`

```text
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
the victim’s Saving Throws against such
effects are penalized by -8 for the duration of
the spell. This reversed spell must be cast by
touch, requiring a normal Hit Roll.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level Magic-User Spells`
- canonical spell key: `Mind Barrier`
- Chapter 06 card heading: `Mind Barrier`

```text
  80 Mind Barrier (R 10', DR 48 hours, EF
      +8 ST; C24)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Mind Barrier`
- Chapter 06 card heading: `Mind Barrier`

```text
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
victim’s saving throws against such effects are pe-
nalized by - 8 for the duration of the spell. This
reversed spell must be cast by touch, requiring a
normal attack roll.
```

## Permanence

- canonical spell key: `Permanence`
- Chapter 06 card heading: `Permanence`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Eighth-Level Magic-User Spells`
- canonical spell key: `Permanence`
- Chapter 06 card heading: `Permanence`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level Magic-User Spells`
- canonical spell key: `Permanence`
- Chapter 06 card heading: `Permanence`

```text
Permanence
[Master Set sourcing note (MU8): Master Set lists this spell as a Companion cross-reference only (C25). No new description in Master Set. Description text in Companion staging -> High-Level Cleric, Druid, and Magic-User Spell Material.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Permanence`
- Chapter 06 card heading: `Permanence`

```text
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
combinations could seriously affect a campaign’s
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
```

## Polymorph Any Object

- canonical spell key: `Polymorph Any Object`
- Chapter 06 card heading: `Polymorph Any Object`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Eighth-Level Magic-User Spells`
- canonical spell key: `Polymorph Any Object`
- Chapter 06 card heading: `Polymorph Any Object`

```text
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
polymorph cannot affect a creature’s age or
hit points. (See the 4th level polymorph self
and polymorph other spells for other guide-
lines.)
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level Magic-User Spells`
- canonical spell key: `Polymorph Any Object`
- Chapter 06 card heading: `Polymorph Any Object`

```text
Polymorph Any Object
[Master Set sourcing note (MU8): Master Set lists this spell as a Companion cross-reference only (C25). No new description in Master Set. Description text in Companion staging -> High-Level Cleric, Druid, and Magic-User Spell Material.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Polymorph Any Object`
- Chapter 06 card heading: `Polymorph Any Object`

```text
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
mineral) the spell’s duration is one hour per level
of the caster. If the change is from animal to
mineral (or the reverse), it lasts for one turn per
level of the caster. If no change in kingdom oc-
curs (for example, if a creature is polymorphed
into some other creature), the change is perma-
nent until removed by a dispel magic spell (at
normal chances for success).
Note that creatures created by means of this
spell are not automatically friendly. A poly-
morph cannot affect a creature’s age or hit
points. (See the 4th level polymorph self and
polymorph others spells for other guidelines.)
This spell will not affect a creature which has
more than 2 x the spellcaster’s experience levels
in Hit Dice. For example, a 20th level magic-
user cannot affect a creature with 41 or more Hit
Dice.
```

## Power Word Blind

- canonical spell key: `Power Word Blind`
- Chapter 06 card heading: `Power Word Blind`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Eighth-Level Magic-User Spells`
- canonical spell key: `Power Word Blind`
- Chapter 06 card heading: `Power Word Blind`

```text
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
and +4 on Armor Class. A cleric’s cure blind-
ness or cureall spell will not remove this
blindness unless the cleric is of a level equal to
or higher than the caster of the power word
blind.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level Magic-User Spells`
- canonical spell key: `Power Word Blind`
- Chapter 06 card heading: `Power Word Blind`

```text
   85 Power Word Blind (R 120', DR up to 40
      hp = 4 days, up to 80 hp = 2d4 hrs;
      C25)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Power Word Blind`
- Chapter 06 card heading: `Power Word Blind`

```text
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
saving throws and +4 on armor class. A cleric’s
cure blindness or cureall spell will not remove
this blindness unless the cleric is of a level equal
to or higher than the caster of the power word
blind.
```

## Power Word Kill

- canonical spell key: `Power Word Kill`
- Chapter 06 card heading: `Power Word Kill`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Ninth-Level Magic-User Spells`
- canonical spell key: `Power Word Kill`
- Chapter 06 card heading: `Power Word Kill`

```text
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

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level and Ninth-Level Magic-User Spells`
- canonical spell key: `Power Word Kill`
- Chapter 06 card heading: `Power Word Kill`

```text
  85 Power Word Kill (R 120', EF kill 60
       hp, stun 61-100 hp, DR 4T; C26)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Power Word Kill`
- Chapter 06 card heading: `Power Word Kill`

```text
Power Word Kill
Range: 120'
Duration: Instantaneous
Effect: Slays or stuns one or more creatures
This spell enables the caster to affect one or
more victims within 120' (no saving throw). Ex-
ception: A magic-user, and any creature which
can cast magic-user spells, may make a saving
throw vs. spells to avoid this effect, with a -4
penalty to the roll.
A single victim with 1-60 hit points is auto-
matically slain; one with 61-100 hit points is
stunned (as power word stun) and unable to act
for 1d4 turns. No creature with 101 or more hit
points is affected.
The spell can also be used to slay up to five
victims if each has 20 hit points or less (again, no
saving throw).
```

## Prismatic Wall

- canonical spell key: `Prismatic Wall`
- Chapter 06 card heading: `Prismatic Wall`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level and Ninth-Level Magic-User Spells`
- canonical spell key: `Prismatic Wall`
- Chapter 06 card heading: `Prismatic Wall`

```text
Prismatic Wall
Range: 60 feet
Duration: 6 turns
Effect: Creates a multi-colored barrier
This spell creates a barrier of many colors
with a glittering appearance as if from light
through a prism. This wall is 2 inches thick,
with 1/8 inch between the colors. The effect
must be either a sphere with a radius of 10
feet, centered on the caster, or a flat surface
(vertical or horizontal) of up to 500 square
feet in area. Whatever its form, the prismatic
wall cannot be moved (even by a wish). The
caster may pass through it freely and
unharmed, with any items desired. All other
creatures and objects contacting or passing
through the prismatic wall are affected by the
magic, starting with the first color contacted.
A wish or rod of cancellation can remove
three colors, but no more. Any person with
an anti-magic shell (including the caster of
the prismatic wall) cannot pass through the
wall, but the attempt will not damage either
spell effect.
To break through a prismatic wall, the
magic remedies given (see below) must be
applied in the correct order. When successful,
each causes the appropriate color to disap-
pear from the effect. If a creature merely
charges into the prismatic wall, it takes 84
points of damage from the first three colors
(no saving throw), and then must make the
four saving throws required for the next four
colors. If it survives, the creature may have to
exit by passing through the colors again, in
reverse order.
The prismatic wall extends into the nearest
plane of existence (the Ether if cast on the
Prime Plane), appearing there as an inde-
structible solid wall. It thus cannot be
bypassed by planar or dimensional travel.
The colors and effects of a prismatic wall
are always the same; when created, the violet
side is always closest to the caster.
Red: Blocks all magical missiles; inflicts 12
points of damage. Negated by any magi-
cal cold.
Orange: Blocks all non-magical missiles;
inflicts 24 points of damage. Negated by
any magical lightning.
Yellow: Blocks all breath weapons; inflicts 48
points of damage. Negated by magic mis-
sile spell.
Green: Blocks all detection spell effects
(including crystal balls, ESP, etc.). Any-
one touching it must make a Saving
Throw vs. Poison or die. Negated by pass-
wall spell.
Blue: Blocks all poisons, gases, and gaze
attacks. Anyone touching it must make a
Saving Throw vs. Turn to Stone or be pet-
rified. Negated by disintegrate spell.
Indigo: Blocks all matter, living or other-
wise. Anyone touching it must make a
Saving Throw vs. Spells or be gated to a
random location in an Outer Plane, and
possibly (50%) forever lost. Negated by
dispel magic spell.
Violet: Blocks magic of all types. Anyone
touching it must make a Saving Throw vs.
Wands or be struck unconscious and
insane (curable only by a cureall spell or a
wish). Negated by continual light spell.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Prismatic Wall`
- Chapter 06 card heading: `Prismatic Wall`

```text
Prismatic Wall

Range: 60!

Duration: 6 turns

Effect: Creates a multi-colored barrier

This spell creates a barrier of many colors with
a glittering appearance as if from light shining
through a prism. This wall is 2" thick, with 1/8"
between the colors. The effect must be either a
sphere with a radius of 10', centered on the cast-
er, or a flat surface (vertical or horizontal) of up
to 500 square feet in area.

Whatever its form, the prismatic wall cannot
be moved (even by a wish). The caster may pass
through it freely and unharmed, with any items
he chooses to carry. All other creatures and ob-
jects contacting or passing through the prismatic
wall are affected by its magic, starting with the
first color they contact.

It takes powerful magic to break through the
wall. A wish spell or a rod ofcancellation will re-
move the three outermost remaining colors, but
that’s all.

To break through a prismatic wall, an attacker
must attack it with a specific sequence of spells.
Each spell will cancel one color of the prismatic
wall. These remedy spells, shown on the chart
below, must be cast in the correct order (first,
any magical cold to remove the red layer; then,
any magical lightning to remove the orange lay-
er; and so on). When cast successfully, each spell
causes the appropriate color to disappear from
the wall. When all layers are gone, so is the wall.

A person with an active anti-magic shell (in-
```

## Feeblemind

- canonical spell key: `Feeblemind`
- Chapter 06 card heading: `Feeblemind`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Magic-User Spells`
- canonical spell key: `Feeblemind`
- Chapter 06 card heading: `Feeblemind`

```text
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
cess) or by a cleric’s cureall spell.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Artifact Chapter Context and Witnesses`
- canonical spell key: `Feeblemind`
- Chapter 06 card heading: `Feeblemind`

```text
   40 Feeblemind (R 240', EF -4S?, INT 2;
      C20)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Feeblemind`
- Chapter 06 card heading: `Feeblemind`

```text
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
by a cleric’s cureall spell.
```

## Move Earth

- canonical spell key: `Move Earth`
- Chapter 06 card heading: `Move Earth`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Magic-User Spells`
- canonical spell key: `Move Earth`
- Chapter 06 card heading: `Move Earth`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Non-Human Spellcasters and Special Spellcaster Procedures`
- canonical spell key: `Move Earth`
- Chapter 06 card heading: `Move Earth`

```text
  50 Move Earth (R 240', DR 6T; C21)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Move Earth`
- Chapter 06 card heading: `Move Earth`

```text
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
```

## Reincarnation

- canonical spell key: `Reincarnation`
- Chapter 06 card heading: `Reincarnation`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Magic-User Spells`
- canonical spell key: `Reincarnation`
- Chapter 06 card heading: `Reincarnation`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Non-Human Spellcasters and Special Spellcaster Procedures`
- canonical spell key: `Reincarnation`
- Chapter 06 card heading: `Reincarnation`

```text
Reincarnation
[Master Set sourcing note (MU6): Master Set lists this spell as a Companion cross-reference only (C21). No new description in Master Set. Description text in Companion staging -> High-Level Cleric, Druid, and Magic-User Spell Material.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Reincarnation`
- Chapter 06 card heading: `Reincarnation`

```text
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
The victim’s level of experience does not
change unless restricted by the maximum for
demihumans. If the victim is reincarnated in a
monster body, the victim’s alignment helps de-
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
2 Human
3 Human
4 Dwarf
5 Elf
6 Halfling
7 Original race
8 Monster (see below)
Type of Monster Body Appearing (Roll 1d6)
1d6  Lawful          Neutral       Chaotic
1    Blink Dog       Ape, White    Bugbear
2    Gnome           Bear*         Gnoll
3    Neanderthal     Centaur       Kobold
4    Owl, giant      Griffon       Lizard Man
5    Pegasus         Manticore     Orc
6    Treant          Pixie         Troglodyte
* Any normal bear
The DM may add more monsters to the lists.
Such monsters should have 8 Hit Dice or less and
should be at least semi-intelligent.
```

## Telekinesis

- canonical spell key: `Telekinesis`
- Chapter 06 card heading: `Telekinesis`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Fifth-Level Magic-User Spells`
- canonical spell key: `Telekinesis`
- Chapter 06 card heading: `Telekinesis`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Artifact Chapter Context and Witnesses`
- canonical spell key: `Telekinesis`
- Chapter 06 card heading: `Telekinesis`

```text
   40 Telekinesis (R 120', DR 6r, EF 8000 cn,
      MV 20'/r; C20)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Telekinesis`
- Chapter 06 card heading: `Telekinesis`

```text
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
he doesn’t budge. If a target is being held by
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
```

## Wall of Iron

- canonical spell key: `Wall of Iron`
- Chapter 06 card heading: `Wall of Iron`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Sixth-Level Magic-User Spells`
- canonical spell key: `Wall of Iron`
- Chapter 06 card heading: `Wall of Iron`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Non-Human Spellcasters and Special Spellcaster Procedures`
- canonical spell key: `Wall of Iron`
- Chapter 06 card heading: `Wall of Iron`

```text
 50 Wall of Iron (R 120', EF 500 sq.ft.; C21)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Wall of Iron`
- Chapter 06 card heading: `Wall of Iron`

```text
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
```

## Lore

- canonical spell key: `Lore`
- Chapter 06 card heading: `Lore`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells`
- canonical spell key: `Lore`
- Chapter 06 card heading: `Lore`

```text
Lore
Range: 0 (magic-user only)
Duration: Permanent
Effect: Reveals details of 1 item, place, or
          person
By means of this spell, the magic-user may
gain knowledge of one item, place, or person.
If an item is held by the caster, the spell takes
1-4 turns to complete, and the magic-user
learns the item’s name, method of operation
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Artifact Chapter Context and Witnesses`
- canonical spell key: `Lore`
- Chapter 06 card heading: `Lore`

```text
   70 Lore (DR 1T or 1 day; C22)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Lore`
- Chapter 06 card heading: `Lore`

```text
Lore
Range: 0 (magic-user only)
Duration: Permanent
Effect: Reveals details of 1 item, place, or person
By means of this spell, the magic-user may
gain knowledge of one item, place, or person. If
the caster holds the item being studied, the spell
takes 1d4 turns to complete, and the magic-user
learns the item’s name, method of operation and
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
```

## Magic Door

- canonical spell key: `Magic Door`
- Chapter 06 card heading: `Magic Door`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells`
- canonical spell key: `Magic Door`
- Chapter 06 card heading: `Magic Door`

```text
Magic Door’
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
spell. The spell can affect an empty lO’x10'
portal-like area (such as an empty doorway).
The locked portal does not change in appear-
ance. As with a magic door, the enchantment
remains until the portal has been used 7 times
or until removed by a dispel magic spell.
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Artifact Chapter Context and Witnesses`
- canonical spell key: `Magic Door`
- Chapter 06 card heading: `Magic Door`

```text
  40 Magic Door (R 10', DR 7 uses; C22)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Magic Door`
- Chapter 06 card heading: `Magic Door`

```text
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
```

## Mass Invisibility

- canonical spell key: `Mass Invisibility`
- Chapter 06 card heading: `Mass Invisibility`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells`
- canonical spell key: `Mass Invisibility`
- Chapter 06 card heading: `Mass Invisibility`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Artifact Chapter Context and Witnesses`
- canonical spell key: `Mass Invisibility`
- Chapter 06 card heading: `Mass Invisibility`

```text
  60 Mass Invisibility (R 240', EF 60' sq, 300
     man-size; C22)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Mass Invisibility`
- Chapter 06 card heading: `Mass Invisibility`

```text
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
```

## Power Word Stun

- canonical spell key: `Power Word Stun`
- Chapter 06 card heading: `Power Word Stun`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells`
- canonical spell key: `Power Word Stun`
- Chapter 06 card heading: `Power Word Stun`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Artifact Chapter Context and Witnesses`
- canonical spell key: `Power Word Stun`
- Chapter 06 card heading: `Power Word Stun`

```text
   60 Power Word Stun (R 120', DR up to
      35hp = 12r, up to 70hp = 6r; C22)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Power Word Stun`
- Chapter 06 card heading: `Power Word Stun`

```text
Power Word Stun
Range: 120'
Duration: 2d6 or 1d6 turns
Effect: Stuns 1 creature of 70 hp or less
This lets the caster stun one victim within 120'
(no saving throw). A victim with 1-35 hit points
is stunned for 2d6 turns; a victim with 36-70 hit
points is stunned for 1d6 turns. No creature with
71 or greater hit points is affected.
```

## Reverse Gravity

- canonical spell key: `Reverse Gravity`
- Chapter 06 card heading: `Reverse Gravity`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells`
- canonical spell key: `Reverse Gravity`
- Chapter 06 card heading: `Reverse Gravity`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Artifact Chapter Context and Witnesses`
- canonical spell key: `Reverse Gravity`
- Chapter 06 card heading: `Reverse Gravity`

```text
  60 Reverse Gravity (R 90', EF 30' cube;
     C22)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Reverse Gravity`
- Chapter 06 card heading: `Reverse Gravity`

```text
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
```

## Statue

- canonical spell key: `Statue`
- Chapter 06 card heading: `Statue`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells`
- canonical spell key: `Statue`
- Chapter 06 card heading: `Statue`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Artifact Chapter Context and Witnesses`
- canonical spell key: `Statue`
- Chapter 06 card heading: `Statue`

```text
  70 Statue (DR 80T, EF +2 Init; C23)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Statue`
- Chapter 06 card heading: `Statue`

```text
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
gon’s attack), the caster may simply turn back to
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
```

## Shapechange

- canonical spell key: `Shapechange`
- Chapter 06 card heading: `Shapechange`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level and Ninth-Level Magic-User Spells`
- canonical spell key: `Shapechange`
- Chapter 06 card heading: `Shapechange`

```text
Shapechange
Range: 0 (caster only)
Duration: One turn per level of the caster
Effect: Caster may change form
This spell is similar to the 4th-level poly-
morph self spell, but is far more powerful.
The caster actually becomes another creature
or object in all respects except the mind, hit
points, and saving throws. Armor class, Hit
rolls, special attack forms, immunities, and
all other details are those of the form taken.
A magic-user cannot cast spells in any form
except that of a bipedal humanoid (demi-
human, goblin, ogre, giant, etc.). The caster
cannot take a unique form (such as that of a
specific character, Elemental Ruler, or Immor-
tal) and can gain the likeness but not the abilities of another character class. Any spells cast
in other forms must come from the magic-
user’s own memory. Inanimate forms are lim-
ited in size to a maximum of 1 foot tall per level
of the caster, and 100 cn weight per level.
Except for these limits, the caster can
become any creature or object that he or she
has ever seen. Imaginary or unfamiliar crea-
tures cannot be used; a ten-armed troll, for
example, is not allowed. Each change
requires a full round of concentration, but the
caster may change shape at will during the
spell’s duration.
Examples: The caster may become a huge
red dragon, a boulder, a chair, an elemental,
a gnat, a vampire, and so forth. The caster,
however, has the flaws of the new form as well
as its strengths. If, for example, the caster is
struck by a sword +2, +5 vs. dragons while
in dragon form, the +5 bonus applies.
This spell effect cannot be made perma-
nent and is subject to dispel magic. During
the spell duration, the caster cannot pass
through any protection from evil or anti-
magic shell spell effect.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Shapechange`
- Chapter 06 card heading: `Shapechange`

```text
Shapechange
Range: 0 (caster only)
Duration: One turn per level of the caster
Effect: Caster may change form
This spell is similar to the 4th level polymorph
self spell, but is far more powerful. The caster
actually becomes another creature or object in all
respects except the mind, hit points, and saving
throws. The caster takes his new armor class, at-
tack rolls, special attack forms, immunities, and
all other details from the form he has taken.
A magic-user cannot cast spells in any form ex-
cept that of a bipedal humanoid (demihuman,
goblin, ogre, giant, etc.). The caster cannot take
a completely unique form (such as that of a spe-
cific character, Elemental Ruler, or Immortal).
He can gain the likeness but not the abilities of
another character class. When wearing another
form, he can only cast spells from his own mem-
ory; he cannot cast from scrolls or his spell book.
He cannot assume huge inanimate forms; if he
tries to, the form will be a maximum of one foot
tall per experience level of the caster and 100 cn
weight per level.
Except for these limits, the caster can become
any creature or object that he or she has ever
seen. Imaginary or unfamiliar creatures cannot
be used; unless there are ten-armed trolls in your
campaign, for example, he cannot turn into one.
The caster may change shape at will during the
spell’s duration; each change requires a full
round of concentration.
Note that the caster does assume the flaws of
the new form as well as its strengths. If, for ex-
ample, the caster is struck by a sword +2, +5 vs.
dragons while in dragon form, the +5 bonus ap-
plies against his new form.
This spell effect cannot be made permanent and
is subject to dispel magic. During the spell dura-
tion, the caster cannot pass through any protec-
tion from evil or anti-magic shell spell effect.
```

## Symbol

- canonical spell key: `Symbol`
- Chapter 06 card heading: `Symbol`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Eighth-Level Magic-User Spells`
- canonical spell key: `Symbol`
- Chapter 06 card heading: `Symbol`

```text
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
reads the rune, the rune’s effect takes place
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
chances for success) or by a cleric’s cureall
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level Magic-User Spells`
- canonical spell key: `Symbol`
- Chapter 06 card heading: `Symbol`

```text
Symbol
[Master Set sourcing note (MU8): Master Set lists this spell as a Companion cross-reference only (C25). No new description in Master Set. Description text in Companion staging -> High-Level Cleric, Druid, and Magic-User Spell Material.]
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Symbol`
- Chapter 06 card heading: `Symbol`

```text
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
rune, the rune’s effect takes place immediately
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
cess) or by a cleric’s cureall spell.
Fear: The victim immediately runs away from
the symbol, at his Running Speed, for 30 rounds
(as the wand).
Insanity: The victim becomes insane, and can-
not attack, cast spells, or use special abilities or
items. The victim may walk, but must be care-
fully tended or may run away. This effect is per-
manent until removed by a dispel magic spell (at
normal chances for success) or by a cleric’s cureall
spell.
Sleep: The victim falls asleep, and cannot be
awakened. The victim will wake normally in
1d10 + 10 (11-20) hours or if dispel magic is used
to negate it (at normal chances for success).
Stunning: Affects any creature with 150 or
fewer hit points. The victim is stunned for 2d6
turns (as the power word stun spell).
```

## Timestop

- canonical spell key: `Timestop`
- Chapter 06 card heading: `Timestop`
- expected witness lanes: `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `2`

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Eighth-Level and Ninth-Level Magic-User Spells`
- canonical spell key: `Timestop`
- Chapter 06 card heading: `Timestop`

```text
Timestop
Range: 0 (caster only)
Duration: 2-5 rounds
Effect: Allows caster to act for 2-5 rounds
while everything else "stops"
To the caster, this spell seems to stop time.
It speeds the caster so greatly that all other
creatures seem frozen at normal speed, in
"normal time." From the caster’s point of
view, the effect lasts for 2-5 rounds. The
caster may perform one action during each of
these magical rounds.
Normal and magical fire, cold, gas, etc.
can still harm the caster. While the timestop is
in effect, however, other creatures are invul-
nerable to the caster’s attacks and spells.
Spells with durations other than "instantane-
ous" may be created and left to take effect
when time resumes. Note that no time
elapses while this spell is in effect; durations
of other spells cast start after the timestop
ends.
Items held by those in normal time cannot
be moved, but other items (including those
worn or carried by others) are not "stuck."
The caster is completely undetectable by
those in "normal time." However, the magic-
user cannot pass through a protection from
evil or anti-magic shell while under this
spell’s effect.
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Timestop`
- Chapter 06 card heading: `Timestop`

```text
Timestop
Range: 0 (caster only)
Duration: 2-5 rounds
Effect: Allows caster to act for 1d4 + 1 (2-5)
rounds while everything else "stops"
To the caster, this spell seems to stop time. It
speeds the caster so greatly that all other crea-
tures seem frozen at their normal speeds, in
"normal time." From the caster’s point of view,
the effect lasts for 1d4 + 1 (2-5) rounds. The cast-
er may perform one action during each of these
magical rounds.
Normal and magical fire, cold, gas, etc. can
still harm the caster. While the timestop is in ef-
fect, however, other creatures are invulnerable to
the caster’s attacks and spells. Spells with dura-
tions other than "instantaneous" may be cre-
ated and left to take effect when time resumes.
Note that no time elapses while this spell is in
effect; durations of other spells cast start after
the timestop ends.
The spellcaster cannot move items held by
those in "normal time," but can move other
items that are not "stuck," including those worn
or carried by others. The caster is completely un-
detectable by those in "normal time." However,
the magic-user cannot pass through a protection
from evil or anti-magic shell while under this
spell’s effect.
```

## Analyze

- canonical spell key: `Analyze`
- Chapter 06 card heading: `Analyze`
- expected witness lanes: `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `1`

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Analyze`
- Chapter 06 card heading: `Analyze`

```text
Analyze
Range: 0 (touch only)
Duration: 1 round
Effect: Analyzes magic on one item
A spellcaster using this spell can handle one
item and learn the enchantment on it. Helms
must be put on the spellcaster’s head, swords
held in his hand, bracelets put on his wrist, etc.
for this spell to work. Any consequences of this
action (for example, from cursed or booby-
trapped objects) fall upon the spellcaster,
though he gets his usual saving throws.
The spellcaster has a chance of 15% plus 5%
per experience level to determine one magical
characteristic of the item; if the item is non-
magical, his chance is to determine that fact.
The spell does not reveal much precise infor-
mation. It will characterize a weapon’s pluses
(attack bonus) as "many" or "few," will esti-
mate the number of charges on an item within
25% of the actual number, etc.
```

## Entangle

- canonical spell key: `Entangle`
- Chapter 06 card heading: `Entangle`
- expected witness lanes: `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `1`

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Entangle`
- Chapter 06 card heading: `Entangle`

```text
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
```

## Create Air

- canonical spell key: `Create Air`
- Chapter 06 card heading: `Create Air`
- expected witness lanes: `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `1`

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Create Air`
- Chapter 06 card heading: `Create Air`

```text
Create Air
Range: Immediate area, 8,000 cu. ft.
Duration: 1 hour per level of caster
Effect: Provides breathable air
This spell provides breathable air, especially in
areas where otherwise there is none to be had. It
is cast on a volume of 8,000 cubic feet (such as a
20' x 20' x 20' room) and, while it is in effect,
everyone in that area has good air to breathe.
Customarily, it’s used when dungeon explor-
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
whereupon he can breathe normally. It’s not the
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
```

## Clothform

- canonical spell key: `Clothform`
- Chapter 06 card heading: `Clothform`
- expected witness lanes: `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `1`

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Clothform`
- Chapter 06 card heading: `Clothform`

```text
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
doesn’t use the skills rules, the character could
have been defined earlier as one who knows how
to work cloth in order for him to do this. Natu-
rally, unshaped cloth created by this spell can lat-
er be cut, sewn and otherwise fashioned into
such objects.
The cloth so created is much like undyed
linen—it’s tough, serviceable, and unglamor-
ous. A caster can create his cloth with an unfin-
ished end, and later he or another caster can use
another clothform to create cloth joined to the
first on that edge—and there will be no seam or
weakness at the joining. This makes it a good
spell for creating rugged, dependable sails.
When created, the cloth extrudes from the
caster’s hands and out along the ground. If there
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
```

## Stoneform

- canonical spell key: `Stoneform`
- Chapter 06 card heading: `Stoneform`
- expected witness lanes: `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `1`

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Stoneform`
- Chapter 06 card heading: `Stoneform`

```text
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
```

## Woodform

- canonical spell key: `Woodform`
- Chapter 06 card heading: `Woodform`
- expected witness lanes: `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `1`

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Woodform`
- Chapter 06 card heading: `Woodform`

```text
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
```

## Delayed Blast Fireball

- canonical spell key: `Delayed Blast Fireball`
- Chapter 06 card heading: `Delayed Blast Fireball`
- expected witness lanes: `Companion`, `Master`, `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `3`

### Witness: Companion

- source lane: `Companion`
- source label: `Companion Set`
- staging anchor / section: `High-Level Cleric, Druid, and Magic-User Spell Material -> Seventh-Level Magic-User Spells`
- canonical spell key: `Delayed Blast Fireball`
- Chapter 06 card heading: `Delayed Blast Fireball`

```text
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
```

### Witness: Master

- source lane: `Master`
- source label: `Master Set`
- staging anchor / section: `Artifact Chapter Context and Witnesses`
- canonical spell key: `Delayed Blast Fireball`
- Chapter 06 card heading: `Delayed Blast Fireball`

```text
  65 Delayed Blast Fire Ball (R 240' , DR
       0-60r, EF 20d6 D; C22)
```

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Delayed Blast Fireball`
- Chapter 06 card heading: `Delayed Blast Fireball`

```text
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
```

## Ironform

- canonical spell key: `Ironform`
- Chapter 06 card heading: `Ironform`
- expected witness lanes: `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `1`

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Ironform`
- Chapter 06 card heading: `Ironform`

```text
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
```

## Steelform

- canonical spell key: `Steelform`
- Chapter 06 card heading: `Steelform`
- expected witness lanes: `Rules Cyclopedia`
- missing expected witness lanes: `none`
- witness count: `1`

### Witness: Rules Cyclopedia

- source lane: `Rules Cyclopedia`
- source label: `Rules Cyclopedia`
- staging anchor / section: `Magical Spells List and Spell Descriptions`
- canonical spell key: `Steelform`
- Chapter 06 card heading: `Steelform`

```text
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
```
