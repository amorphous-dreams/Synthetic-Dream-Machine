# TODO: BECMI Spell Material Staging - Immortals

This staging document captures spell material and associated magical-context text from `TSR 1017 - Set 5 Immortals Rules.pdf`.

Rules for this artifact:
- Raw classic terminology is preserved.
- This is a staging artifact, not a final crosswalk.
- `pdftotext -layout -nodiag -nopgbrk` remains the primary extractor unless a section note says otherwise.
- Parser warnings from PDF extraction stderr were suppressed and are not part of this document.
- Section methods may mix anchored line slices, page-layout extraction, cropped columns, TSV reflow, and small curated stitching when that is necessary to preserve reading order.
- Cleanup is conservative: spacing, OCR scars, and broken line wraps may be normalized, but source terminology is not converted.

Source PDF:
- `TSR 1017 - Set 5 Immortals Rules.pdf`

## Audit Rubric

- Coverage: the staged block should account for the claimed source section without silently dropping major witnesses.
- Reading order: columns, tables, and continuation text should preserve source order rather than left/right interleave.
- Continuation: multi-page and multi-column blocks should retain start, middle, and end states without orphaned fragments.
- Table/list survivability: representative table rows and list entries should remain readable and attached to the correct headings.
- Manual-reconstruction burden: curated or stitched text should be minimized, reproducible, and explicitly validated when unavoidable.

### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context

- Extraction note: flow-first Immortals extraction built from heading-anchored page-column reads for the specific Section 1-2 doctrine needed downstream: XP-to-PP conversion, permanent-vs-current PP bookkeeping, rank/level frame, GT advancement costs, sphere selection frame, and planar-bias regeneration context.

```text
Section 1: Changes

The most basic and far-reaching change in
the existing game system involves the character's current Experience Points. The XP total
is converted to Power Points, which affect
other game mechanics.
Get your character records sheet(s) and a
fresh piece of paper. Don't discard the old
character sheet when you're done; you'll
need many of the details later.
Experience Points
In mortal life, experience is a measure of success and power. It continues to be a primary
goal of the character, even in Immortality.
Start by converting the total XP earned in
mortal life to a new figure, Power Points
(PP). Each 10,000 XP are worth 1 PP,
rounded up.
A typical starting Immortal (Initiate) has
between 300 and 500 PP. Magic-users usually
start with the most Power Points, and clerics
usually start with the least. Demi-humans
may have any amount, but usually start with
less than 400 PP.
A character's PP total determines his status
in the hierarchy of the Immortals. Gains in
status bring gains of Hit Dice, hit points,
abilities, influence, and responsibility.
An Immortal character gains PP (usually
just called Power) for learning, working, and
performing deeds, just as in mortal life.
Power may also be gained as gifts from other
Immortals, and as bonuses for advancement.
Power awards may be small in comparison to
XP. Ten or twenty PP are sizeable amounts,
especially to a starting Temporal. Remember
that each Power Point represents 10,000
mortal experience points!
But in addition to their typical function as
a record of experience, Power Points are also
actively used in play. They are expended by
Immortals in creating various effects, magical and not. This is a basic change in game
mechanics, and affects all games involving
Immortals. A major goal of all characters is to
gain more Power, and to translate that into
more abilities and influence.
Power is temporarily expended in producing magical effects, moving or changing elemental material, and attacking. Power is
permanently expended in raising ability
scores, creating permanent non-magical
effects, and many special actions. Temporary
Power expenditures return (regenerate) automatically at a rate determined by the character's rank; permanent expenditures do not.
Record your PP total in two places on the
character sheet. Write one figure in the usual
place for XP, to keep track of the total earned
to date—the permanent PP total. Write the

total in another place as well, someplace
where it can be frequently changed, and use
this one to keep track of the character's current (variable) Power. When PP are spent for
temporary effects, or regenerated afterward,
modify only the current total. Modify both
Power totals only if PP are permanently
expended or if new Power is received.
If the Immortal's permanent Power total
ever reaches zero, the Immortal's life force is
extinguished. In mortal play hit points are
the measure of life force. (See Names, page
3.)

higher ranks of Immortals in ascending order
of Power are Celestial, Empyreal, Eternal,
and Hierarch.
Level is still used to describe an amount of
progress within each rank, again using experience (now counted in Power Points) as the
yardstick. Table 1 gives the various level and
rank titles and their corresponding Power
Point values.
                 Power        Maximum
                  Cost         Ability
   Rank         Per Point      Score
   Temporal       10 PP           25
   Celestial      20 PP           50
   Empyreal       40 PP           75
   Eternal        80 PP           100
   Hierarch       160 PP
      As one requirement for gaining each next
   higher rank, all three scores of an Immortal's
   Greater Talent must be raised to the maximum. If the character's total GT is not at its
   maximum, he or she is not eligible to
   advance. See Rank Advancement for more
   details.
      Any number of points may be "purchased" at any time if sufficient power is
   available. A character cannot voluntarily
   expend Power Points if that action would
   reduce his or her total Power to less than the
   minimum for the rank as given on Table 1.
Example: A character recently achieved
   the rank of Celestial in the Sphere of Time.
   Her Wisdom, Strength, and Charisma scores
   are now 25 each, and she has 1,080 PP. To
   raise each ability score to 50 (needed for
   Empyreal), she must spend 1,500 Power
   Points to gain 75 ability score points in
   exchange. However, at this time she can only
   expend 20 PP, for one ability score point,
   since the expense of the second point would
   reduce her Power total to 1,040, ten less than
   the minimum for Novice Celestial.

Section 2: New Characters Information

Spheres
Some time ago, you chose one of four routes
to Immortality, and your character followed
that route to a successful result. Each route
corresponds to one of the four Spheres, and
each Sphere gives bonuses to certain mortal
classes, as follows:
Route
Sphere
Dynast
Time
Hero
Thought
Paragon
Energy
Matter
Polymath
Whatever route your character took, you
may choose any one Sphere now. Before you
do so, you may examine the powers, goals,
and other details of all the Spheres as
described in this book. Though your choice
will probably be the Sphere corresponding to
the route followed, you can change, and the
only cost is that your character cannot qualify
for certain future bonuses. Immortals are free
to change Spheres at any time, but suffer
such extreme penalties (in effect starting
completely over) that they rarely do so after
passing Initiate level.

Bias
The relation between any Immortal and any
Plane of Existence can be described as the
"bias" of the Plane—hostile, neutral, or
friendly. Whatever an Immortal's location, the
rate of regeneration of the Immortal's Power,
hit point, and ability score losses are determined
by the bias of the Plane or Dimension of that
location. An Immortal who exists on several
planes at once (commonly on the Home Plane
and one or more others) must apply the least
favorable bias that applies.
   The rate of regeneration is 1 point per
round on a friendly plane, 1 point per turn on
a neutral plane, and 1 point per day on a hos-
tile plane. Regeneration affects all losses
simultaneously (including all six ability
scores). Each score continues regenerating
until it reaches its normal total.

Power Point Recovery
Immortal Power Points regenerate automatically, at a rate determined by the relationship between an Immortal and his environment, called the planar or local bias.
(See Bias.) The regeneration requires no concentration or expenditure.
When on a "friendly" plane of existence,
Power regenerates at the rate of 1 point per
round. When on a "neutral" plane of existence, the rate is 1 point per turn (10 minutes).
When on a "hostile" plane, the rate is 1 point
per day.
Physical Recovery
An Immortal's physical form automatically regenerates all losses of ability score
points and hit points. The rate is the same as
the Immortal's regeneration of Power Points,
as determined by planar or local bias.
The cost of faster regeneration is 100 PP.
This expenditure doubles the base rate for 6
hours (36 turns). A like increase in rate and
duration (not an additional doubling) can be
obtained for each expenditure. Example: A
4th level Eternal on a plane with neutral bias
wants to increase his regeneration rate to 4
points per turn for 12 hours. This requires
three increases, all applied twice (once for
each 6-hour increase), for a total cost of 600
PP.
An Immortal may expend Power to repair
any physical form used. Standard magical
cure spells may be created and applied as
desired. Remember that A-M should be vol-
untarily dropped if a risk of magic failure is to
be avoided. Power may also be used to hasten
the natural regeneration process for hit points
and ability scores. This does not affect the
rate of Power regeneration.
Natural or enhanced regeneration affects
current totals at all times, and is cumulative
with magical effects. Ability score losses are
often most easily countered by applying mag-
ical ability score increases. As the ability
scores then regenerate, the augmented ability
scores likewise increase. The same phenomenon occurs when hit points are magically
augmented. However, regeneration can
never cause a score to exceed normal maximum if no magical augmentation has been
applied.

```

### Section 3: Immortal Magic

- Extraction note: whole-section TSV and layout extraction were audited first, but chart-heavy page 18-21 reads still collide across columns and tables. This block therefore uses documented page-column slice fallback to preserve readable doctrine flow, with downstream validation for continuations, table structure, and Section 4 bleed.

```text
Section 3: Immortal Magic

An Immortal can recreate cleric, druid, and
magic-user spell effects of all types and levels
by expending Power Points. Other magical
effects which do not correspond to mortal
spells may also be created. Immortal Spells
are never gained through meditation or
study; spell effects are created only by
expending Power.
   Any one Immortal can create a maximum
of one magical effect per round. (A timestop
spell actually creates multiple rounds of time
for the user. Refer to the spell description for
details.) From 1 to 160 PP may be expended
in doing so. The exact cost is determined by
the spell and by the Sphere of the Immortal
producing it.
   Every mortal magic spell is associated with
one of four Spheres of Power. None are specifically associated with the Sphere of
Entropy, though many do unavoidably aid
entropy in some way. All other magical effects
likewise correspond to individual Spheres.
   The Index to Magical Effects lists all the
possible magical effects in alphabetical order
and gives the Sphere for each. For details on
the magical effect, refer to the detailed list for
the corresponding Sphere (charts S1-S4).
Your DM should classify all other spells
developed in the campaign according to the
guidelines given (see Adding Spells) and add
them to the index and charts.
   Only about 25% (or less) of the magical
effects listed have good melee applications.
Plan ahead to avoid delays in play by reviewing the possibilities and pre-calculating costs
of those effects your character will probably
use.

Power Cost
The actual PP cost of creating any magical
effect is calculated by multiplying the base
Power cost by a factor. This multiplier translates the effects of dominance and opposition
into specific increases in Power costs. The
spell level and/or details of the effect determine the base Power cost, from 1 to 20 PP.
The multiplier is 1, 2, 4, or 8.
   Imagine the four Spheres to be on a circular     path      representing      elemental
dominance—Earth over Air over Water over
Fire over Earth. (This is diagrammed in the
D&D Companion Set, DMC page 20.) The
base cost applies when the magic is within the
character's Sphere. The base cost doubles for
each step along this circular path. The resulting factors are given in the following table.
You may wish to draw the circular path on
your character sheet, as it affects many
aspects of play.
     Sphere Factors for Magical Effects
 Sphere of       Sphere of Magical Effect
 Immortal       Matter Energy Time Thought
 Matter           1      8      4      2
 Energy           2      1      8      4
 Time             4      2      1      8
 Thought          8      4      2      1

Example: An Immortal of Matter can expend
 16 PP to create any one of the following magical effects:
                                    Base
                       Sphere       Cost Factor
 Force Field          Matter        16     1
 Continual Light      Energy         8     2
 Hold Person          Time           4     4
 Remove Fear          Thought        2     8

 Durations of Effects
 Whenever a fixed duration of any length is
 given for a magical effect, an Immortal may
 extend the effect for the same amount of time
 by expending half the base Power cost.
Example: An Immortal of Thought expends
 16 PP (base cost 2, factor 8) to create a web
 which lasts for 8 hours, but he may extend
 that to 24 hours by expending only 2 additional PP (each 8-hour extension costing half
 the base cost, or 1 Power Point apiece).

Limits on Use
Magic of any origin, mortal or Immortal, has
no effect on an incorporeal being. Magical
effects created by mortals have no effect on
Immortals in any form. Magical effects created by Immortals have standard effects on
other Immortals—subject to Anti-Magic
effects (q.v.), and with certain changes logical for Immortal application.
An Immortal may apply magical effects to
his or her physical form, or may apply them
to some other creature or object. Any effect previously limited to "self" can be delivered by touch to any creature when produced by an Immortal. Immortal power expands the
scope of many such effects.
During any one round, an Immortal may
take one physical action per natural attack
form or one magical action, but not both.
"Action" in this usage refers to any physical
attacks, defense, or miscellaneous physical or
magical effect. Multiple physical attacks are
possible if the Immortal form possesses several natural methods of attack (eg. a bear can
claw twice, bite, and maybe hug in the same
round).
Caster Level
The character's effective level for all purposes
is twice the number of Hit Dice. This effective level is used in place of caster level in all
applications, even though the spell effects are
created, not cast.
Example: A Novice Celestial (HD 25) polymorphs an obnoxious human into a dinner
plate. This radical change lasts for 1 turn per
level of the caster, or 50 turns in this case. A
36th level mortal magic-user who attempts to
dispel the magic is the Celestial's inferior by 14
levels, and therefore has a 70% chance of failure (5% per level difference) in the attempt.

General Notes, Charts
S1-S4
Using the Charts
An Index to Magical Effects that may be created by Immortal use of Power Charts S1-S4
are located in the Reference Guide, located in
the back of this booklet.
A page reference and base PP cost are
given for each spell and non-spell magical
effect, along with ranges and durations for
easy reference. The abbreviations used to
note in which rule set the effect is explained
are: B = Basic, X = Expert, C = Companion, and M = Masters. The effects of most
spells are obvious from their names. Review
any that you are not familiar with; these are
valuable tools in play.
Most non-spell magical effects are
described in the Artifact power descriptions
of the D&D Master Set (DMR pages 51 -54).
Some not contained therein are merely
extrapolations of those given, and need no
additional explanation.

Changing Range and Duration
An Immortal may increase the range of a
magical effect by doubling the cost. The
amount of increase is equal to the original
range. Duration may be increased in the
same manner. The doubling of cost is cumulative; for example, an effect with triple normal range and triple normal duration thus
costs 16 times as much as the unmodified
effect. If the duration is given as instantaneous or permanent, it cannot be changed. If
the range is zero, that likewise cannot be
increased. Range applies to a distance within
a single plane unless the spell or effect
description specifies otherwise. Such effects
cannot be sent across a planar boundary
except by an existing path (such as a wormhole or gate).

The volume of an effect may also be
changed in this way, but the process may
involve a calculation more complex than simple multiplication. To double the volume of a
cone or sphere, for example, the formula for
calculating its volume must first be found.
(Consult a text on solid geometry.) Simply
doubling one dimension of the volume often
more than doubles the total volume.

Conjuring and Summoning
Whenever a magical effect summons a creature, the victim must be able to respond using
its normal type of movement. Thus, transplanar summoning is only effective if the victim can cross planar boundaries, or if
preceded by a gate or similar effect to enable
such movement.
Conjuring refers to a magical effect that
actually creates a creature. In such cases the
life force involved might be summoned, but is
automatically drawn into the form created
(possibly across planar boundaries).
Conjuring and/or summoning will not
work if the creature involved is composed of a
single elemental material or devoted to a single Sphere against which local or planar bias
is hostile. Example: An Immortal of
Thought cannot conjure a fire elemental on
his Home Plane, because his element (air) is
opposed to fire, and his plane thus has hostile
bias against fire and Energy. Similarly, the
same Immortal may open a gate to a nearby
Outer Plane and try to summon some flickers
known to be therein, but these creatures (of
the Sphere of Energy) will not respond unless
they freely choose to do so.

Damage
The damage produced by any single magical
effect cast by an Immortal (including fire
ball, lightning bolt, etc.) is 1d6 per Hit Die
(not level) of the Immortal creating it. Thus,
the most powerful fire ball known, created by
a Hierarch (HD 45), inflicts 45-270 points of
damage.
For any effect involving large numbers of
dice, the DM may wish to use the average
damage instead of random rolls. This speeds
play greatly, requiring only one simple multiplication instead of much dice rolling. Any
reasonable variation of this method, such as
adding or subtracting a fixed or random
amount to represent the normal variance of a
random total, is also encouraged. In the
example given above, the fire ball would be
quickly found to inflict 158 points of damage
by using the average of 3.5 points per die. It
might be modified slightly by using 2d20-20, a range of -18 to +20.
A new rule is used when determining damage caused by a magical effect. If bonuses or
penalties apply to damage rolls, these modifiers will not change the number beyond the
maximum or minimum on the die used.
Thus, a bonus of + 1 on 1d6 results in rolls of
2, 3, 4, 5, 6, and 6.
If bonuses or penalties apply to damage
rolls, do not simply apply the bonus to the
average per die. That would ignore the fact
that the modified result per die cannot exceed
the maximum possible result. With a fire
ball, for example, a + 1 bonus per die cannot
cause the result of any one of the dice used to
exceed six.
The averages for most common types of
dice and for bonuses or penalties of -3 to + 3
are given below. To calculate the averages for
other dice, or for modifications outside that
range, apply the following guidelines.
The average roll for a given type of die is
                            Average Results of Common Dice Rolls
       Type
      of Die          -3           -2           -1
         1d4          1.0        1.25         1.75
         1d6         1.5         2.0        2.667
         1d8        2.25       2.875        3.625
       1d10          3.1          3.8         4.6
       1d12          4.0         4.75       5.583

found by finding the total of all possible
results and dividing by the number of results.
Apply modifiers (if any) to each result before
finding the average. Example: On 1d6, the
results (1, 2, 3, 4, 5, 6) average 3.5 per die.
With a + 1 bonus, the results (2, 3, 4, 5, 6, 6)
average 4.3 per die (26 divided by 6).

Mental Effects
The descriptions for some spells that affect
the mind may specify that the effects are
permanent—that is, of infinite duration until
cured or dispelled in some way. These notes
apply only to mortals. An Immortal victim
may be able to defeat the effect by sheer concentration as explained below. The victim
cannot, however, cure himself by magical
means. Immortals who fall victim to mental
effects are usually cured quickly by allies, at
relatively minor Power Point expenditure.
But this might not occur, and might be
impossible because of 100% A-M.
If the Immortal victim's A-M does not
negate the attack, and if the saving throw vs.
Mental Attack is failed, even an Immortal
mind can fall victim to charm, feeblemind,
and other effects. The victim's Intelligence
score determines the frequency of any
attempts to non-magically conquer or defeat
the effect. This frequency is identical to that
given in the D&D Master Set (MDM page
16) in reference to charm effects. The chart
below adds to that earlier one, and covers the
span of Immortal ability scores.
When a new check is allowed, the player
makes a standard Intelligence check, comparing an unmodified roll of 1d100 to the
character's Intelligence score before being
affected by the spell. If that check succeeds, a
new saving throw may be attempted. The
effect vanishes without magical curing only if
the saving throw succeeds. The effect
remains if either the check or the saving
throw is failed.
Immortals with 76 or greater Intelligence
may check once at the start of each round,
and again at the midpoint of the round.
Immortals with 91 or greater Intelligence
need not make the ability score check at all.

Common Dice Rolls
Modifier
         0             +1         +2           +3
       2.5           3.25        3.75          4.0
       3.5          4.333         5.0          5.5
       4.5          5.375       6.125         6.75
       5.5             6.4        7.2          7.9
       6.5          7.416        8.25          9.0
         Durations of Mental Effects
      Intelligence           Check again after
          13-15                           3 days
         16-17                         24 hours
            18                           8 hours
              19                            3 hours
             20                              1 hour
            21-22                1 turn (60 rounds)
            23-25                       30 rounds
            26-29                       15 rounds
            30-34                        8 rounds
           35-40                          4 rounds
            41-50                        2 rounds
            51-75                         1 round
            76-90                      2/1 round
           91-100            2/1 round, save only
Undead Curing
Any magical effect that would cure damage
when applied to an undead creature (such as
cause wounds, finger of death, etc.) has the
same curative effect when used on any creature of the Sphere of Entropy. (Immortal
creatures cannot, however, be Turned.)

Explanation of Terms,
Charts S1-S4
Ability score bonuses: An Immortal may
increase one or several ability scores by a simple Power Point expenditure. The standard
duration of any such effect is 1 hour (6 turns).
Mortal ability scores cannot exceed 18, and
any increase in excess of this is discarded.
Immortal ability scores cannot exceed 100,
but normal rank limits may be ignored for
this temporary effect.
   The listed PP cost raises the ability score(s)
involved by 4 points. However, a larger
increase may be achieved by expending more
Power Points. For example, an increase of 40
points can be created as one action (though at
10 times the base cost). As with other magical
effects, this action may only occur during the
"magic spells and items" phase of the melee
round. It is subject to A-M, and may be
removed by dispel magic. Magical ability
score increases cannot be made permanent.
   No factor ever increases the base PP cost of
creating ability score bonuses, and hence
these effects are listed for all four Spheres.
When a bonus refers to "GT," any of the ability score(s) of the Immortal's Greater Talent
can be affected. "IT" refers to all the Lesser
Talents.
Example: An Immortal of Time (whose
Greater Talents are Wisdom, Strength, and
Charisma) wants to temporarily increase her
Charisma by 20 points, so that her Aura will
have greater power. She must expend 20 PP
to produce this effect, multiplying the 4 PP
base expenditure 5 times. If she instead
wishes to increase her Intelligence by 20
points using the Raise all Lesser Talents
effect, she must expend 80 PP (base cost 16
PP, again multiplied times 5), which raises
the other two Lesser Talents as well. The best
way for her to achieve both these goals at once
would be to raise all the ability scores by 20
points (at a total cost of 100 PP), as that
method raises all the Greater Talents instead
of merely Charisma.
Aerial Servant: See General Notes (Conjuring and Summoning).
Anti-Magic: When this category of non-spell magic (of the Sphere of Time) is created and used on any creature which already has
an A-M percentage, the figures are cumulative. For example, a Celestial of Thought (A-M 60%) who wants 100% A-M for an hour
may acquire the 40% increase in A-M (base
cost 15), which is ruled by Time (Sphere factor x 2), by expending 30 PP. The magically
added A-M cannot be dispelled by itself nor
by the innate A-M.
   Anti-Magic can disrupt any type of magic
use, whether mortal spellcasting or Immortal
Power expenditure. Anti-Magic has no effect
on Power combat, Aura, or other non-magical
effects.
Anti-Magic Ray: Unlike standard A-M
effects, this does not deactivate magic for a
full turn. Magical effects and temporary
magical items do not work while within the
ray, but return to normal at the instant the
ray is no longer upon them.
Automatic Healing: See Cureall.
Bearhug: If an Immortal's form has more
than two arms, any two may be employed in
using this effect.
Blasting: It is very important to remember
that in the D&D game, sound may exist
where air does not. Though speech is normally created by manipulating air, effects of
this type work magically, and can only be
blocked by magical silence.
Bug Repellant: The DM may expand the
definition to include local varieties of "bugs,"
even though such may be totally unlike those
of the Prime Plane. However, no creature of 3
or greater Intelligence can be classified as a
bug.
Buoyancy: This effect is useless in places
where "sinking" (i.e. gravitational orientation) is unknown. Such places are common in
the Elemental Plane of Water, for example,
where large water globes are common. The
DM may freely apply this effect to areas
where any type of sinking (or even falling!)
could occur, regardless of the elemental or
other material involved.
Calm Others: If cast by an Immortal, this
effect can remove fear or agitation from a
number of Hit Dice of creatures equal to
twice the Immortal's Hit Dice.
Choose Best Option: This magic has no effect when used by a Hierarch. If used by any other Immortal, this effect telepathically links the character with the Hierarch of his or her Sphere. It is thus best used sparingly, if at all. The Hierarch acts in the same way as would an artifact with this power, considering only those parts of a problem which are specifically presented.
Clairvoyance: When used to see an area
through the eyes of an Immortal, the victim
senses the presence of (but absolutely no
details about) the "eavesdropper."
Clone: An Immortal cannot be cloned. This
effect can be used only on mortals.
Commune: This establishes instant contact
with one Immortal of any Sphere. When this
is used by an Immortal player character,
detailed communication is possible, not
merely the "yes or no" question format given
in the spell description. If a specific Immortal
is named, that individual is contacted if available, or otherwise another of the same Sphere
and of comparable rank. Even if available, an
Immortal may refuse contact (but the PP cost
must still be paid). Any Immortal contacted
by commune automatically knows the caller's
identity (by common name, never truename)
and status, including the exact rank if Immortal.
Confusion: See General Notes (Mental
Effects).
Conjure Elemental: See General Notes (Conjuring and Summoning).
Contact Outer Plane: This produces an
effect identical to that described for commune
in this section. No chance of insanity applies
to an Immortal character.
Container: This effect can only be placed on
an inanimate non-living object of 1 or more
cubic feet in volume.
Contingency: If cast by an Immortal, this
effect can trigger a spell effect of up to 5th
level (one higher than the mortal version). It
cannot trigger a non-spell magical effect.
Create Normal Objects: Immortals may use
this effect to create non-magical objects of
value (including treasure). However, treasures created must be simple non-crafted
objects, such as raw uncut gemstones. From
the Immortal perspective, material wealth is
irrelevant except when bargaining with mortals.
Create Water: This spell has normal (though
startling) effect when used in an environment
which lacks a ground-like surface. The spring
can be summoned forth from any solid non-living object of 1,000 or more cubic feet in
volume.
Creeping Doom: The magically created
swarm always consists of tiny insects native to
the plane of the caster, which might be
instantly slain by certain environmental
effects.

Cureall: This effect can cure a maximum of
6 hit points per level of the caster. It can thus
cure a maximum of 216 points of damage if
cast by a mortal (36th level), or 540 points if
created by a Hierarch (HD 45, caster level
90).
Curse: If cast by an Immortal, a curse can
have up to double normal effect.
Death Spell: If cast by an Immortal, this can
affect double the given amount of creatures
(8-64 Hit Dice, affecting creatures of 15 Hit
Dice or less).
Delayed Blast Fire Ball: See General Notes (Damage).
Dimension Door: An Immortal may use
this effect normally or may reverse this effect,
dimension window, to change his or her
dimensional perspective to any other possible
for the location, viewing other dimensions.
When used in this way, the effect does not
cause physical movement.
Disintegrate: In addition to the usual defenses (A-M and saving throw), this effect
may be partially resisted by an Immortal victim. The victim must make a standard
(unmodified) Constitution check. If successful, the effect causes damage equal to half the
Immortal's normal (undamaged) hit point
total, but does not produce full disintegration. The disintegration of a form has no
effect on the Immortal's life force, though it
does cause incorporeality.
Dispel Evil: If used against an Immortal,
this has no effect unless the victim is the sole
target, and even then allows the usual saving
throw and A-M resistance. Even if successful,
the effect merely causes the Immortal to
return to his or her Home Plane, and the
Immortal may leave the next round after
arriving here.
Earthquake: The exact amount of crushing
damage inflicted upon a creature engulfed by
a crack is 101-200 points of damage
(1d100 + 100) per round.
Elasticity: The size limits mentioned in the
description apply to mortal humanoids. An
Immortal may stretch the form used up to 5
times normal height, with a minimum of 5%
of normal thickness. The benefit of taking
only half damage from blunt weapons applies
also to a punch attack and other modes of
unarmed combat.
Explosive Cloud: Though no saving throw
applies to mortals, Immortals may make the
usual saving throw vs. Physical Attack to
reduce the damage by half.
Feeblemind: See General Notes (Mental Effects).
Find the Path: This spell functions properly
only within a single plane of existence. It
might malfunction partially or totally if the
path leads across planar boundaries. The
DM may decide the specific result—whether
the spell seems to have no effect or the path
suddenly stops or proceeds in the wrong
direction. It is highly erratic and often misleading or useless when insufficient details of
the destination are known. For example,
when used to find the seventh dimension, or
the hiding place of the Old Ones, this effect
leads in a random direction.
Fireball: See General Notes (Damage).
Geas: See Quest.
Haste: This affects the physical form only. It
does not affect the rate of Power use of any
type, nor of any type of regeneration.
Heal: See Cureall.
Hold Monster: This can affect any living
mortal creature, but has no effect on Immortals of any sort.
Hold Person: Immortals of any sort are not
affected by this magic, even if they were
"persons" (by the spell description) in mortal
life.
Insanity: See General Notes (Mental Effects).
Insect Swarm: The insects are summoned,
not conjured, and must thus be able to reach
the caster by using their normal form of
movement. If preceded by a gate spell or similar effect, the insects may indeed be summoned from another plane or dimension.
Invisible Stalker: See General Notes (Conjuring and Summoning).
Levitate: In environments lacking gravitational orientation, the direction of movement
may be freely selected. The movement rate is
still very slow in comparison to fly and other
effects, but may be useful in some situations.
If an Immortal applies this effect to another
creature, the creator of the effect may retain
control of the movement, or may give control
to the recipient. Control passes with the
touch required to bestow the effect. If
retained, control cannot be given at a later
time. When this effect is used as a form of
attack, to restrict or force movement with the
creator retaining control, the victim may save
vs. Spell when touched to avoid the effect. If
the victim saves, the magic vanishes.
Life Trapping: This effect can only be
placed on an inanimate non-living object of 1
or more cubic feet in volume.
Light: When an Immortal is blinded by this
effect, the Immortal's form is affected normally. This does not prevent Aura or Power
use, and if the Immortal leaves the body, the
incorporeal character is not blinded. The
blindness affects only the material form.
Each round an Immortal's A-M may be used
to try to negate the effect. But the character
will become blinded if the A-M is lowered
during the duration of the effect.
Lightning Bolt: See General Notes (Damage).
Lore: If cast by an Immortal, the effect
requires only 1-4 rounds or 1-100 turns,
instead of the same numbers of turns or days
given in the spell description.
Lower Water: The maximum depth of the
"hole" in the water is 500 feet. If cast by an
Immortal, this effect can be used to create a
similar hole in solid ice. In this case, only half
normal effect is gained (depth to 3/4 normal,
to a maximum of 250 feet).
Magic Jar: An Immortal may dispense with
the need for a container for the life force,
being able to exist as an incorporeal.
Mass Charm: If the effect is cast by an
Immortal, the maximum number of Hit Dice
or levels of creatures affected is equal to the
Immortal's caster level, equal to double his or
her Hit Dice.
Massmorph: Immortals experienced in
environments other than that of the Prime
Plane may choose to create the illusion of
some plant life other than trees.
Maze: This has no effect whatsoever if used
on the Astral Plane. An Immortal who
entraps a creature by this effect may follow it
to the astral maze (using standard movement
procedures and costs) and automatically find
the victim in 1 round. The Immortal may
pull the victim out of the maze, into the wide
expanses of the Astral Plane, by scoring a
normal Hit roll and pulling the victim along.
If this occurs, the victim does not reappear at
the point of disappearance, instead remaining on the Astral Plane.
If the victim of this effect is Immortal, he or she may leave the maze in 1 round, and then move freely as desired. The Immortal need not then return to the point of disappearance.
The returning effect of the spell is automatic if the Immortal simply waits for the effect to end (a maximum of 4 rounds after it began).
Memorize Bonus Spell Levels: This has no
effect on any creature who creates magica
effects by Power use, rather than by spellcast-
ing.
Meteor Swarm: This effect is commonly
used by Immortals. The DM may choose to
use the results of only one roll (of 4d6 or 8d6)
to all four or eight meteors, to speed play. An
acceptable alternative is to use average dam
age in all cases, perhaps rolling randomly
only if the damage needed to slay an oppo-
nent is close to that average.
Mirror Image: The creator of the effect (and
the recipient, if the effect is bestowed by
touch) can always tell which of the images are
illusory and which is the real creature.
Parry: Unlike the standard fighter tactic
this has effect even if the user is unarmed.
Pass-Wall: Any dense non-living inanimate
matter can be affected if this magic is cast by
an Immortal. Though this can never in itsel
inflict damage, this may cause a collapse o
surrounding matter and the collapse may
have damaging effects. The chance of col-
lapse is equal to the percentage of the sup
porting base material removed by this effect
   This distinctive effect actually moves the
matter involved into an opposite dimensional
orientation. It remains in the same location
but appears to change into air because of the
dimensional displacement. Were it to actu-
ally move, an inrush of air or other nearby
material would accompany the effect—which
it does not.
Plane Travel: This only affects the user and
any non-living inanimate equipment carried
If all members of a group simultaneously
plane travel to a predetermined destination
all starting from the same general location
they will appear in the same positions relative
to each other. This applies even if severa
plane travels are required to reach the fina
destination. However, any member of such a
group may, simply by concentrating slightly
in the process of moving, arrive up to 24
miles (1 outdoor map hex) distant from the
others for each planar boundary crossed.
Polymorph Other: Although this magic ha
normal effect on Immortals, this spell doe
not erase memory in any way, but merely
produces tendencies that match the new
form. It does not impair Power use in any
way.
Power Words (stun, blind, kill):         If any
such magic is cast by an Immortal, the range
duration, and all limits on creatures affected
are doubled.

Produce Fire: This will not work when local
or planar bias is hostile toward Energy or
fire.
Protection From all Creatures: The unlim-
ited effect applies to mortals only. This effect
does not normally block any Immortal crea-
ture. However, an Immortal may expend
double the standard PP cost to create a simi-
lar effect that blocks both mortal and Immor-
tal creatures for the same duration.
Quest: Since this effect can be removed sim-
ply by the reversed spell effect, this is rela-
tively inefficient when used on any Immortal.
Raise Dead (and Raise Dead Fully): This
has no effect if applied to the slain material
form used by an Immortal.
Regeneration: This effect is the same as that
described for Artifacts, but only restores lost
hit points and damaged flesh, not Power or
Abilities.
Reincarnation:    This has no effect on the
slain material form used by an Immortal.
Remove Barrier*: If cast by an Immortal,
this effect will remove even a wall of iron.
Remove Curse: This is ineffective if the cre-
ator or caster of the curse has (or had) a
greater number of Hit Dice than the creator
of this effect. If several Immortals work
together to remove a curse, their effective
level is equal to the total of their Hit Dice.
Repair (normal object, magical object):
This has no effect on any creature, living or
otherwise.
Reverse Gravity: This has absolutely no
effect if the local environment has no gravity.
Note also that falling may occur at much
slower rates in conditions of less than normal
gravity.
Shapechange: This has very nearly the same
effect as the spell. However, the maximum
size change is one hundredfold in each
dimension. For example, a typical mortal
human could become a creature up to 600
feet tall, if any such creature were seen first
(as limited by the spell description). Thus,
even Immortals cannot shapechange into
huge creatures like the draeden or megaliths.
   Immortal magic use is not dependent on
any characteristics such as form, movement,
or sound, being instead a purely mental func-
tion. The spellcasting restriction given in the
shapechange spell description thus does not
apply to any being, Immortal or otherwise
who uses Power to create magical effects.
Shelter: This effect can only be placed on an
inanimate non-living object of 1 or more
cubic feet in volume.
Size Control: The size limits mentioned in
the description apply to mortal humanoids.
An Immortal may enlarge his or her form to a
maximum of 3 times normal height, or shrink
to a minimum of 5% normal. The user's
attacks and damage therefore may be signifi-
cantly affected and the DM's judgment is
required.
Speak With Monsters: If any creator of this
effect (mortal or Immortal) attacks the recipi-
ent while conversing, the effect ends immedi-
ately.
Spell Damage Bonus:       See General Notes
(Damage).
Statue: The AC -4 given for the statue form
supercedes the character's Armor Class, for
better or worse.
Striking: This effect is limited in application
to non-living objects, and cannot be used to
give damage bonuses to the attacks of any
type of creature (including those of the non-
living variety, such as golems).
Summon Animals: If this effect is used in a
plane other than the Prime, the DM should
determine the local equivalents of the animals
that can be affected.
Summon Elemental: See General Notes
(Conjuring and Summoning).
Symbol: All Immortals are treated as magic
users for this effect, and may save to avoid the
effects. Furthermore, an Immortal may
make a saving throw even when merely pass-
ing the symbol.
Teleport: This effect cannot be used to cross
planar boundaries, nor to change one's
dimensional orientation. It merely enables
movement in the fourth dimension (referring
to standard orientation), literally bypassing
any amount of three-dimensional distance.
Thief Ability: These effects are often useless
to Immortals, but are frequently used on fol-
lowers or other allies.
Timestop: Power combat occurs in literally
no time at all, and is unaffected by this
magic. See Power combat for procedural
notes on this topic.
Tracking: The variance in percentage by
locality (indoor, outdoor) applies only to mor-
tals. An Immortal uses the "indoor" percent-
age when trying to track in any environment
in which some elemental material exists,
whatever the type. The "outdoor" percent-
age is used when tracking in non-elemental

environments of all sorts, including the Ethe-
real and Astral Planes and even vacuum. An
Immortal may follow a creature's traces
across planar and dimensional boundaries
but at only half the listed "outdoor" chance
of success.
Truesight: This effect also reveals the exac
Hit Dice of those seen, but never an exac
Power total (permanent or temporary).
Turn Undead: An Immortal with this magical ability may Turn undead creatures by ges-
turing, and needs no holy symbol. An
Immortal can Turn twice as many undead as
a mortal cleric, affecting 4-24 Hit Dice pe
attempt. The level at which an Immorta
Turns undead is based on the effect chosen
and power spent. An Immortal who was a
cleric in mortal life retains his inherent Turn-
ing ability at the level he gained as a mortal.
A complete chart is given below.
   Although Immortal creatures of Entropy
can be cured as if undead, they cannot be
Turned, and cannot be controlled as Pawns.
They may, however, act as Lieges. Proce-
dures for handling undead Lieges and Pawns
are described in the D&D Master Set, MDM
pages 22-23.
   Any non-undead follower of an Immortal
of Entropy can be Turned as a "special." For
example, this applies to various followers of
the demon rulers. This affects only creatures
who voluntarily ally with these Immortals
and not to those who are duped, charmed, or
otherwise manipulated. It also does not apply
to creatures who are created by magical
means.

Explanation
11, 9, or 7: Total dice roll (on 2d6) needed
   for successful Turn
T: Automatic Turn, 4d6 Hit Dice of undead
   (2d6 for mortals)
D: Automatic Destroy, 4d6 Hit Dice of
   undead (2d6 for mortals)
D +: Automatic Destroy, 6d6 Hit Dice o
   undead (3d6 for mortals)
D#: Automatic Destroy, 8d6 Hit Dice o
   undead (4d6 for mortals)
Weapon Bonus: This effect can only be
applied to an inanimate, non-living object.
Weather Control: The DM may modify this
effect for local weather effects as well as gen-
eral environmental conditions. An Immorta
may thus cause spectacular weather changes
as well as create small personal rain clouds
and such.
                                       Turn Undead

Undead            1         2          3     4
Skeleton           7        T T     D
Zombie            9         7          T T
Ghoul             11        9          7     T
Wight                       11         9      7
Wraith                                 11    9
Mummy                                        11
Spectre
Vampire
Phantom
Haunt
Spirit
Nightshade
Lich

Undead                       15-16          17-20
Skeleton                         D+          D+
Zombie                           D+          D+
Ghoul                            D+          D+
Wight                            D D+
Wraith                           D D
Mummy                            D D
Spectre                           D D
Vampire                           D D
Phantom                           D D
Haunt                             T D
Spirit                            T T
Nightshade                         7             T
Lich                              9              7
Special                           11             9

Web: The time required to break free of the
web varies by Strength as follows.
     Strength                   Time required
     0                          Spell duration
     1-3                          5-30 turns
     4-8                          3-18 turns
     9-12                          2-8 turns
     13-15                         1-4 turns
                                 5-30 rounds
     18                            4 rounds
    19-20                          3 rounds
    21-23                          2 rounds
    24-27                           1 round
    28-32                         1/2 round
    33-100                         Instantly
Wish: All restrictions given in the spell
description still firmly apply. If a wish is used
to reproduce a spell effect (limited to one of
8th level or less), multiply the PP cost of the
wish by the Sphere factor of the resulting
(All cleric levels)
    Cleric Level
5        6      7         8    9-10 11-12 13-14
D D      D D      D D+      D+
D D      D D      D D       D+
T D      D D      D D       D
T T      D D      D D        D
7        T T         D D     D D
9         7     T T      D D        D
11       9       7        T T     D D
         11     9         7      T T        D
                11        9      7     T T
                          11    9       7         T
                                11     9          7
                                       11         9
        Cleric Level
     21-24      25-28          29-32        33-36
      D+            D#          D#           D#
      D+            D+          D#           D#
      D+            D+          D+           D#
      D+            D+          D+           D+
      D+            D+          D+           D+
       D D+          D+           D+
       D D         D+           D+
       D D         D+           D+
       D D          D D+
       D D          D D
       D D          D D
       T D          D D
       T T          T T
        7             T T            T
     effect. Factors are cumulative. Without this
     restriction, those of the Sphere of Thought
     have a distinct advantage over all other
     Spheres.
       A wish cannot affect any creature's perma-
     nent PP total. It can be used to restore a tem-
     porary PP loss, but to a maximum of 20
     points. It is thus at least as costly as the
     expenditure, and a useless tactic unless
     employed to aid another creature.
     Word of Recall: An Immortal may have
     multiple "permanent homes," to a maximum
     of one for each Project. However, this effect
     does not enable instantaneous transplanar
     travel to such a place unless the movement is
     away from the Prime Plane (e.g. Prime to
     Elemental or Elemental to Outer).

