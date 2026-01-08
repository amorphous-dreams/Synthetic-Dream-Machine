
# SDM Power Index

*(Canonical repository for Vastlands powers. Use this document to record every power stat block, regardless of whether the power is stored as a trait, item, burden, or location-bound wonder.)*

## Power Template

```text
#### <Power Name>

- subtitle: <Flavor caption or invocation>     # optional, sits between title and stats
- power: <P>
- range: <R>
- target: <T>
- duration: <D>
- overcharge: <Ox steps / notes>

> text:

  <Full power procedure/description exactly as written, including activation costs and narrative details.>

> tags:

  [power]
  [type:<oldtech|fantascience|ritual|weapon|other>]
  [storage:<trait|item|burden|structure|location>]

> meta:

  - scope: power
    id: <Album Name|Path Reference|…>         # matches a reference; spaces ok
    index: <##>                               # optional order/index reference
    note: <extra context>                     # optional free text

  - scope: source
    source: <BookName>
    page: <##>
```
### Usage Notes

- **Stat block recap.** Every power records Power (P), Range (R), Target (T), Duration (D), and Overcharge steps (Ox). Optional attributes/tags such as Anchored, Attack, Focus, Fueled, Imbued, Item, or Dangerous appear when relevant.
- **Storage tags.** Use `[storage:trait]` when a power is inscribed as a trait, `[storage:item]` for spellbooks or devices, `[storage:burden]` for curses/brands, etc. Many entries will have multiple valid storage forms.

<hr/>

## Vastlands Guidebook Powers

### The Sixfold Hexacenter
> Source: Vastlands Guidebook, p.108.

<hr/>

#### Red Mist

- subtitle: Tactical Aggression Augment
- power: 1
- range: short, ~20m
- target: one creature
- duration: a few minutes
- overcharge: Affect a number of creatures equal to your level + 1.

> text:

  Rubra’s need overcomes the target. Anger and passion boil, threatening to break its composure (save).
  It rerolls its reaction roll with a single d8. Choose whether they add or subtract your charisma.

> tags:

  [power]
  [type:fantascience]
  [storage:item]

> meta:

  - scope: power
    id: The Sixfold Hexacenter
    note: Listed in album order on VG p.108.

  - scope: source
    source: Vastlands_Guidebook
    page: 108

  - scope: source
    source: Magitecnica_Codex_1
    page: 20
<hr/>

#### Orange Dream

- subtitle: Forgotten Spider’s Labors
- power: 1
- range: whisper
- target: one creature
- duration: an hour
- overcharge: Even a hostile or violent creature listens, provided you can whisper in its ear.

> text:

  A neutral or friendly creature agrees to do what you ask for an hour (no save), so long as it does not appear
  immediately dangerous or risky.

> tags:

  [power]
  [type:fantascience]
  [storage:item]

> meta:

  - scope: power
    id: The Sixfold Hexacenter
    note: Listed in album order on VG p.108.

  - scope: source
    source: Vastlands_Guidebook
    page: 108

  - scope: source
    source: Magitecnica_Codex_1
    page: 20
<hr/>

#### Yellow Cloud

- subtitle: Sands of Lost Times
- power: 1
- range: nearby
- target: a 9m cube
- duration: a few minutes
- overcharge: Summon into shimmering immobility a wall of dust measuring 200 cubic meters.

> text:

  Fine, obscuring yellow dust rises from the ground and hangs in the air, a veil no sight can pierce. The dust
  irritates the lungs of air-breathers. After a few minutes, it blows away.

> tags:

  [power]
  [type:fantascience]
  [storage:item]

> meta:

  - scope: power
    id: The Sixfold Hexacenter
    note: Listed in album order on VG p.108.

  - scope: source
    source: Vastlands_Guidebook
    page: 108

  - scope: source
    source: Magitecnica_Codex_1
    page: 20
<hr/>

#### Green Haven

- subtitle: Arbor Sanctuary
- power: 1
- range: nearby
- target: a 7m diameter sphere
- duration: a night or a day
- overcharge: Sculpt a thorny hedge wall measuring 200 meters square and 1 meter thick. Its thorns cut anyone pushing through like daggers (1d4 damage).

> text:

  Convince shrubberies, grasses, brambles, and other plants to form a hedge domehome, a sanctuary to rest and hide
  in. Enemies need at least one turn to pass through the hedge. They are vulnerable while in the shrub wall. After
  a night or day, the plants return to their ordinary ways.

> tags:

  [power]
  [type:fantascience]
  [storage:item]

> meta:

  - scope: power
    id: The Sixfold Hexacenter
    note: Listed in album order on VG p.108.

  - scope: source
    source: Vastlands_Guidebook
    page: 108

  - scope: source
    source: Magitecnica_Codex_1
    page: 20
<hr/>

#### Blue Lotus

- subtitle: Maximum Somatic Contentment
- power: 1
- range: short, ~5m
- target: one creature
- duration: an hour
- overcharge: Affect a number of creatures equal to your level + 1.

> text:

  Soma’s bliss brings contentment to the target (save).
  Success: it loses its next turn to a blissful reverie.
  Failure: it sits down, lost in blissful reverie for an hour.

> tags:

  [power]
  [type:fantascience]
  [storage:item]

> meta:

  - scope: power
    id: The Sixfold Hexacenter
    note: Listed in album order on VG p.108.

  - scope: source
    source: Vastlands_Guidebook
    page: 108

  - scope: source
    source: Magitecnica_Codex_1
    page: 20
<hr/>

#### Purple Memories

- subtitle: Comic Emotional Display
- power: 1
- range: touch
- target: a creature
- duration: several minutes
- overcharge: Affect a number of creatures equal to twice your level.

> text:

  The target becomes susceptible to influence. The barest word or sensation triggers vivid memories, thoughts, and
  emotions. How could anyone keep thoughts or facts a secret in this state? Or resist a fine, rousing song?

> tags:

  [power]
  [type:fantascience]
  [storage:item]

> meta:

  - scope: power
    id: The Sixfold Hexacenter
    note: Listed in album order on VG p.108.

  - scope: source
    source: Vastlands_Guidebook
    page: 108

  - scope: source
    source: Magitecnica_Codex_1
    page: 20
### The Viridian Practice
> Source: Vastlands Guidebook, p.109.

<hr/>

#### Mother of Bullets

- subtitle: Blood Made Lead
- power: 1
- range: touch
- target: anchor weapon
- duration: instant
- overcharge: The first semi-real projectile to strike a target deals extra damage equal to your level plus the power’s price (2 + level).

> text:

  Reloads your weapon as a free action, turning life force into semi-real projectiles.

> tags:

  [power]
  [type:oldtech]
  [storage:item]

> meta:

  - scope: power
    id: The Viridian Practice
    note: Gun monk tradition from VG p.109.

  - scope: source
    source: Vastlands_Guidebook
    page: 109

  - scope: source
    source: Magitecnica_Codex_1
    page: 24
<hr/>

#### Dancing In The Hail

- subtitle: Dodgebullet
- power: 1
- range: self
- target: self
- duration: one round
- overcharge: Any ranged attacks that hit deal half damage.

> text:

  Reduce your metaphysical “hit box” to the size of your weapon. All ranged attacks against you suffer major
  penalties (i.e. disadvantage).

> tags:

  [power]
  [type:oldtech]
  [storage:item]

> meta:

  - scope: power
    id: The Viridian Practice
    note: Gun monk tradition from VG p.109.

  - scope: source
    source: Vastlands_Guidebook
    page: 109

  - scope: source
    source: Magitecnica_Codex_1
    page: 24
<hr/>

#### Ring of Lead

- subtitle: Rapid Metal Spin Cycle
- power: 1
- range: adjacent
- target: all creatures
- duration: one action
- overcharge: No attack roll required.

> text:

  Use the buzz saw stance to unload all your ammo at once, attacking every* adjacent creature with one action.
  *subject to how much ammo the anchor weapon holds.

> tags:

  [power]
  [type:oldtech]
  [storage:item]

> meta:

  - scope: power
    id: The Viridian Practice
    note: Gun monk tradition from VG p.109.

  - scope: source
    source: Vastlands_Guidebook
    page: 109

  - scope: source
    source: Magitecnica_Codex_1
    page: 24
<hr/>

#### Eyes of the Arrow

- subtitle: Panoptic Projectile
- power: 1
- range: touch
- target: one projectile
- duration: a minute or so
- overcharge: The projectile maneuvers in flight with the agility of a dove.

> text:

  Bind a strand of your consciousness to a projectile. It acts like a remote eye (or other sensor).

> tags:

  [power]
  [type:oldtech]
  [storage:item]

> meta:

  - scope: power
    id: The Viridian Practice
    note: Gun monk tradition from VG p.109.

  - scope: source
    source: Vastlands_Guidebook
    page: 109

  - scope: source
    source: Magitecnica_Codex_1
    page: 24
<hr/>

#### Counterfire

- subtitle: Panoptic Projectile
- power: 1
- range: a middling hemisphere, ~12m
- target: one attack
- duration: interrupt
- overcharge: The attacker must save or be disarmed.

> text:

  Deflect an incoming attack, melee or ranged, with a projectile. Declare counterfire before the attack roll.

> tags:

  [power]
  [type:oldtech]
  [storage:item]

> meta:

  - scope: power
    id: The Viridian Practice
    note: Gun monk tradition from VG p.109.

  - scope: source
    source: Vastlands_Guidebook
    page: 109

  - scope: source
    source: Magitecnica_Codex_1
    page: 24
<hr/>

#### Depleted Heavy Metal Rain

- subtitle: Bigger Bang
- power: 1
- range: touch
- target: anchor weapon
- duration: a few minutes
- overcharge: Roll damage dice thrice.

> text:

  Imbue your next shot with an inertial error. Roll damage dice twice. The dice also explode.

> tags:

  [power]
  [type:oldtech]
  [storage:item]

> meta:

  - scope: power
    id: The Viridian Practice
    note: Gun monk tradition from VG p.109.

  - scope: source
    source: Vastlands_Guidebook
    page: 109

  - scope: source
    source: Magitecnica_Codex_1
    page: 24
### Dawn’s Highway
> Source: Vastlands Guidebook, p.110.

<hr/>

#### Dampen Mass

- subtitle: Nosigoro Logistical Augment
- power: 1
- range: touch
- target: 1 sack
- duration: 1 day
- overcharge: The mass is halved again. Alternately, it affects an object twice as large, or lasts a week instead.

> text:

  A sub-reality field halves the object’s interactive mass. An object of 100 kilos acts like one of fifty.

> tags:

  [power]
  [type:ritual]
  [storage:item]

> meta:

  - scope: power
    id: Dawn’s Highway
    note: Road magic rites from VG p.110.

  - scope: source
    source: Vastlands_Guidebook
    page: 110

  - scope: source
    source: Magitecnica_Codex_1
    page: 22
<hr/>

#### Better Pastures

- subtitle: Darehodo Patch Choice
- power: 1
- range: self
- target: self
- duration: 1 hour
- overcharge: Ask a second question or clarify the first.

> text:

  Meditate at a crossroads for an hour, observe the flow of its energies, the flight of birds, the waft of milkweed
  seeds. Ask one objective yes / no question of the crossroads, and it shall answer. Will this path reach water
  within 50 miles? Is there green grass along that path within 20 km?

> tags:

  [power]
  [type:ritual]
  [storage:item]

> meta:

  - scope: power
    id: Dawn’s Highway
    note: Road magic rites from VG p.110.

  - scope: source
    source: Vastlands_Guidebook
    page: 110

  - scope: source
    source: Magitecnica_Codex_1
    page: 22
<hr/>

#### Wing And Prayer

- subtitle: Dirty Fixing
- power: 1
- range: touch
- target: vehicle or steed
- duration: 1 day
- overcharge: The fix lasts a week; but the damage is even worse after.

> text:

  Use your faith to mend an axle or splint a leg. Your vehicle or steed temporarily gains 1d8 life and ignores a
  burden for a day, but then the damage is worse.

> tags:

  [power]
  [type:ritual]
  [storage:item]

> meta:

  - scope: power
    id: Dawn’s Highway
    note: Road magic rites from VG p.110.

  - scope: source
    source: Vastlands_Guidebook
    page: 110

  - scope: source
    source: Magitecnica_Codex_1
    page: 22
<hr/>

#### Roadfinder

- subtitle: Blacktop Sniffer
- power: 1
- range: a day’s march
- target: self
- duration: 1 hour
- overcharge: The detection range is doubled, or the sense lasts a day.

> text:

  Sniff the world’s road fields, ‘gard the astral way-lines. Detect the nearest road a day’s march or less away.

> tags:

  [power]
  [type:ritual]
  [storage:item]

> meta:

  - scope: power
    id: Dawn’s Highway
    note: Road magic rites from VG p.110.

  - scope: source
    source: Vastlands_Guidebook
    page: 110

  - scope: source
    source: Magitecnica_Codex_1
    page: 22
<hr/>

#### Highway Cruiser

- subtitle: Foolself Driving
- power: 1
- range: touch
- target: vehicle or steed
- duration: 1 day
- overcharge: The daemon is capable of more complex maneuvers and adapting to changing road situations, like stopped ambling lancers.

> text:

  Summon a driver daemon from the noösphere and bind it to your vehicle or steed for a day. Lo, the chariot now
  drives itself! Hopefully, the daemon understands your language to receive voice commands.

> tags:

  [power]
  [type:ritual]
  [storage:item]

> meta:

  - scope: power
    id: Dawn’s Highway
    note: Road magic rites from VG p.110.

  - scope: source
    source: Vastlands_Guidebook
    page: 110

  - scope: source
    source: Magitecnica_Codex_1
    page: 22
<hr/>

#### Roadmaker

- subtitle: Stradograd’s Engine of Civility
- power: 6
- range: one metric mile
- target: rock and soil
- duration: 1 day
- overcharge: The faststone sets into standardstone overnight, creating a surface that lasts a century without maintenance.

> text:

  By the channeled powers of the great converter, Chem Caoutchouc, base reality is rearranged. Over a day, a
  faststone road grows from the land, theodolite straight, cambered and elevated, a fortunate 7 meters wide and a
  metric mile long. The road crosses swamps, sways across valleys, and bores tunnels through ridges. Without
  additional fixatives and preparation, the faststone road surface decays in a month.

> tags:

  [power]
  [type:ritual]
  [storage:item]

> meta:

  - scope: power
    id: Dawn’s Highway
    note: Road magic rites from VG p.110.

  - scope: source
    source: Vastlands_Guidebook
    page: 110

  - scope: source
    source: Magitecnica_Codex_1
    page: 22
### Fundamental Purification of the Soil
> Source: Vastlands Guidebook, p.111.

<hr/>

#### Suspended Insight

- subtitle: Revelations of Pain
- power: 1
- range: self
- target: thorn tree
- duration: 1 hour
- overcharge: Gains +2 to an ability score and the answer has a 1-in-4 chance of being immediately helpful.

> text:

  The wizard hangs upon a tree of thorns and gains +1 to an ability score for the rest of the day and a cryptic
  answer to a single question asked of the uncaring void. The answer has a 1-in-6 chance of being immediately
  helpful.

> tags:

  [power]
  [type:ritual]
  [storage:item]

> meta:

  - scope: power
    id: Fundamental Purification of the Soil
    note: Tablet rite from VG p.111.

  - scope: source
    source: Vastlands_Guidebook
    page: 111
<hr/>

#### Thornstone Obelisk

- subtitle: Razorblade Tree
- power: 3
- range: short (10m or so)
- target: planted landcoral seed
- duration: permanent
- overcharge: The growth is even more violent, dealing 6d6 damage to creatures in a small radius and scattering the ground with caltrop-like landcoral shards.

> text:

  The petromancer spills their lifeblood, forcing the landcoral seed into sudden, explosive growth. A 5–8 meter tall
  limestone tree erupts from the ground, dealing 2d6 damage to adjacent creatures. Anyone moving through its thicket
  of razor branches suffers 1d4 damage. The speed of growth kills the landcoral.

> tags:

  [power]
  [type:ritual]
  [storage:item]

> meta:

  - scope: power
    id: Fundamental Purification of the Soil
    note: Tablet rite from VG p.111.

  - scope: source
    source: Vastlands_Guidebook
    page: 111

  - scope: source
    source: Magitecnica_Codex_1
    page: 5
<hr/>

#### Invoke Ub Dragon

- subtitle: Local Reality Error Spark
- power: 7
- range: here
- target: large local area of disturbed reality
- duration: permanent
- overcharge: You have temporary control of the eater.

> text:

  The summoner invokes the Ub code and condenses accumulated magitechnical disturbance into an eater. Its power
  depends on the level of disturbance (decided by the referee or a d10 roll). After the eater emerges, the local
  disturbance reduces one step; stuckforces loosen, energy snarls fade, radiation ghosts dim.
  | d10 | Disturbance  | Eater Invoked | Level |
  | --- | --- | --- | --- |
  | <1 | undisturbed | **sparkly air plankton** | L0 (harmless) |
  | 1–3 | barely disturbed | **purifier slime** | L1d4 (caustic) |
  | 4–7 | temporal static | **destruction lizard** | L2d4 (armored) |
  | 8–9 | spatial scarring | **flaming leaper** | L2d6 (thorned) |
  | 10+ | reality fracture | **blade harvester** | L3d4+2 (winged) |

> tags:

  [power]
  [type:ritual]
  [storage:item]

> meta:

  - scope: power
    id: Fundamental Purification of the Soil
    note: Tablet rite from VG p.111.

  - scope: source
    source: Vastlands_Guidebook
    page: 111
<hr/>

#### Eyes of Akaula

- subtitle: Visions of the Dear Departed
- power: 8
- range: medium, ~50m
- target: self
- duration: 1 day
- overcharge: The seeker gains a gaze attack that paralyzes the aforementioned things for 1d6 rounds (save).

> text:

  The seeker’s eyes glow pale chartreuse and can see things invisible, hidden, departed, and dead.

> tags:

  [power]
  [type:ritual]
  [storage:item]

> meta:

  - scope: power
    id: Fundamental Purification of the Soil
    note: Tablet rite from VG p.111.

  - scope: source
    source: Vastlands_Guidebook
    page: 111
<hr/>

#### Stoyevod’s Irreducible Crystallization of the Ego Complex

- subtitle: Restoration of the Priceless One
- power: 17
- range: here
- target: one dead hero
- duration: permanent
- overcharge: The hero adds +20 to their relife roll or increases one of their ability scores by 1.

> text:

  This deeply immoral ritual tears a departed psyche from the All-Mind's cosmic consciousness. It steals the forgiven
  soul from the All-Fire of Creation-PreservationDestruction. It undoes the body's decay into the All Green of
  Life-Death-Rebirth.
  In a rapturous whirlwind, the hero is recreated from sacred fire and holy breath and perfect soil. They make their
  relife roll with advantage. All this ritual requires is the loving sacrifice of another human, and one more for
  each level of the hero.
  Dangerous: The sacrificial specialist will probably be corrupted by this spell.
  > _In the Year of the Lambent Fox the Chosen One fell before her time and the people of the Milkweed faced certain
  doom. Stoyevod the Practitioner sacrificed 9 of his clone brothers and sisters to return the Chosen One and resume
  the Good and Proper Path of the Milkweed._

> tags:

  [power]
  [type:ritual]
  [storage:item]
  [attribute:dangerous]

> meta:

  - scope: power
    id: Fundamental Purification of the Soil
    note: Tablet rite from VG p.111.

  - scope: source
    source: Vastlands_Guidebook
    page: 111
<hr/>

#### Akaula's Sacrificial Hero

- subtitle: Purification of the Mouth of Hell
- power: 21
- range: touch
- target: chosen hero, large area
- duration: permanent
- overcharge: The outsiders are destroyed, the gates are broken for decades equal to the hero's level.

> text:

  The purifier uses the six sigils of binding to mark a hero to the slaughter. The hero loses 1 life per round. When
  they run out of life, their mind and soul erupt in a blaze of the Maker's fire. The fire banishes all daemons and
  aliens of double the hero's level or less in a 100 meter radius and shuts all dimensional and void gates for a
  number of years equal to the hero's level.

> tags:

  [power]
  [type:ritual]
  [storage:item]

> meta:

  - scope: power
    id: Fundamental Purification of the Soil
    note: Tablet rite from VG p.111.

  - scope: source
    source: Vastlands_Guidebook
    page: 111
### Apocrypha of the O.S.
> Source: Vastlands Guidebook, p.112.

<hr/>

#### Can Trip

- subtitle: Two Left Feet Curse, Clumsy Cat-astrophe
- power: 1
- range: a few meters
- target: someone who can hear you
- duration: instant
- overcharge: There’s no save. The target is tripping.

> text:

  You wish someone sprawled and humbled, and your muttered curse may make it so. The target’s shoelaces are suddenly
  undone, or a stone or stick hops to trip them. They save or sprawl.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: Apocrypha of the O.S.
    note: Salvaged program from VG p.112.

  - scope: source
    source: Vastlands_Guidebook
    page: 112

  - scope: source
    source: Magitecnica_Codex_1
    page: 25
<hr/>

#### Tragic Missile

- subtitle: Antipersonnel Guided Force Bolt, Cupid’s Cranial Penetrator
- power: 2
- range: middling, ~30–50m
- target: anything with a mind and soul
- duration: instant
- overcharge: You visualize three channels at once, striking a single target thrice or three different targets.

> text:

  You visualize a channel connecting the ambient energy fields with the ka-ba of an entity you can see. Once you
  release your visualization, the energies strike the entity’s mindspace nexus, like a noöspheric homing missile.
  The painful effect deals 2d4 damage plus 2 per level of the target. The stronger they are, the harder tragedy
  strikes. The missile leaves no mark. Tragic missile cannot affect targets without a mind and soul.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: Apocrypha of the O.S.
    note: Salvaged program from VG p.112.

  - scope: source
    source: Vastlands_Guidebook
    page: 112

  - scope: source
    source: Magitecnica_Codex_1
    page: 25
<hr/>

#### Hlod Person

- subtitle: Dyslexic Demon’s Binding, Leshnik’s Unforeseen Constriction
- power: 4
- range: close
- target: a person
- duration: 1 hour
- overcharge: The change is permanent.

> text:

  Wave your hand like the six-times folded frond and watch your target become as a log of wood (save). Hard, stiff,
  unmoving, receptive to carpentry.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: Apocrypha of the O.S.
    note: Salvaged program from VG p.112.

  - scope: source
    source: Vastlands_Guidebook
    page: 112

  - scope: source
    source: Magitecnica_Codex_1
    page: 25
<hr/>

#### Pyreball

- subtitle: Instant Incendiary, Damora’s Placid Inferno
- power: 6
- range: touch, or as thrown
- target: 10m diameter sphere
- duration: a day, then instant
- overcharge: The ball deals 10d6 damage, or its fires keep for a month.

> text:

  You take a ball-sized burning ember from a pyre or bonfire and speak the placatory formulas to trap the entire fire
  within. When the ball strikes a hard surface (or is struck), all the trapped fires suddenly erupt, dealing 5d6
  damage to all creatures caught in its blast radius. An unexploded ball dissipates harmlessly after a day.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: Apocrypha of the O.S.
    note: Salvaged program from VG p.112.

  - scope: source
    source: Vastlands_Guidebook
    page: 112

  - scope: source
    source: Magitecnica_Codex_1
    page: 25
<hr/>

#### Nihil Est!

- subtitle: Life’s End Made Present, Hadi’s Self-Immolation Binding
- power: 8
- range: touch
- target: a sentient creature
- duration: 1 year
- overcharge: You age seven years and a kilometer diameter sphere, centered on your soul, disappears into the nothing of wormspace for a year. Overcharge again to remain behind and watch the sphere disappear (please have some form of levitation ready).

> text:

  Between one step and the next, you flicker between existence and non-existence, you age a year and a creature you
  touch disappears into the nothing of wormspace for a year. No save.
  Dangerous: No matter how powerful you are.

> tags:

  [power]
  [type:other]
  [storage:item]
  [attribute:dangerous]

> meta:

  - scope: power
    id: Apocrypha of the O.S.
    note: Salvaged program from VG p.112.

  - scope: source
    source: Vastlands_Guidebook
    page: 112

  - scope: source
    source: Magitecnica_Codex_1
    page: 25
<hr/>

#### Big Wish

- subtitle: Keep on Turning, Supplication of the Perverse Demiurge
- power: 18
- range: self
- target: demiurge
- duration: a day, then permanent
- overcharge: You get three wishes in a crystal chalice. Drink its sour liquid to summon your demiurge.

> text:

  You call upon a demiurge, an echo of the Builders, and command it to grant your wish. The demiurge does its level
  best to misunderstand you, probably because it is an alien from out of time and space.
  The protective circle takes a day to draw, or the power could be dangerous. The summoning itself takes but three
  gestures and one reflective object. Typical wishes (and perversions):
  - "Bring my love back to life." — done, but now she loves another.
  - "Take this cup away from me." — very well, let us give it to your nemesis.
  - "Transport me to a safe place." — you are now in a bank vault, with none of your belongings.
  - "Get us out of this frying pan!" — into the fire you go.
  - "Is this power useless?" — well, it's mostly a joke.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: Apocrypha of the O.S.
    note: Salvaged program from VG p.112.

  - scope: source
    source: Vastlands_Guidebook
    page: 112

  - scope: source
    source: Magitecnica_Codex_1
    page: 25
### Access Noötree
> Source: Vastlands Guidebook, p.113.

<hr/>

#### Access Noötree

- subtitle: Localized Spirit Surf
- power: 1
- range: touch
- target: one thinking tree
- duration: 10 minutes
- overcharge: Gain root-level access to the tree’s source codes and find the mycelial doors that link it to the wider noösphere—Long Ago electronic world fragments, celestial memory palaces, and other micro-realms.

> text:

  You unplug from your body and send your spirit-mind (_ka-ba_) into the synthetic dreamspace of a local server tree.
  You can access the tree’s short-term memories, divine announcements, algorithmically generated human-interest
  novelties, and locally hosted offshoot dream realities.
  Useful when the referee has a one shot or other odd dungeon ready. Be careful. Noise and commotion may alert
  functioning guardians (L2d6, electrangelic) to your interventions.

> tags:

  [power]
  [type:oldtech]
  [storage:item]

> meta:

  - scope: power
    id: Access Noötree
    note: Server tree rite from VG p.113.

  - scope: source
    source: Vastlands_Guidebook
    page: 113
### Weapon Form Powers
> Source: Vastlands Guidebook 06, p.154.

<hr/>

#### Objective Telekinesis

- subtitle: The Bending Fork, Made’s Invisible Hand
- power: 1
- range: nearby
- target: object
- duration: a few minutes
- overcharge: Stronger than most humans (strength 3), it deals 1d3+3 damage.

> text:

  Fragments of your form corrode, sublimate, and become an ectoplasmic hand with which you can caress, hold, crush,
  and discard. It is as strong as a weak human. Punching, it deals 1d3 damage.

> tags:

  [power]
  [type:oldtech]
  [storage:item]

> meta:

  - scope: power
    id: Weapon Form
    note: Granted to every Weapon Form chassis (VG 06 p.154).

  - scope: source
    source: Vastlands_Guidebook
    page: 154
<hr/>

#### Suspended in the Light

- subtitle: Luminous Grasp, Hard Light Hold
- power: 1
- range: nearby
- target: creature or object
- duration: instant
- overcharge: They suffer 1d8 damage instead.

> text:

  You glow, your bearer’s hand glows, the air glows, and you lift your target a handsbreadth off the ground as hard
  light throttles them. They suffer 1d4 damage and lose their next action.

> tags:

  [power]
  [type:oldtech]
  [storage:item]

> meta:

  - scope: power
    id: Weapon Form
    note: Granted via the Hard Ring form (VG 06 p.154).

  - scope: source
    source: Vastlands_Guidebook
    page: 154
### Weapon's Eternal Purpose
> Source: Vastlands Guidebook 06, p.155.

<hr/>

#### Sense Allegiance

- subtitle: Doom Purpose — The Evil One Must Fall
- power: 2
- range: short
- target: one creature
- duration: instant
- overcharge: (not listed)

> text:

  You will kill the Evil One. Fortune will bring you to the befouler and your metal shall end that misbegotten one.
  Sense Allegiance: read a creature’s ethics; evil creatures stunned for 1d4 rounds when brushed by your mind (save).
  Object (d6): (1) your bearer, (2) closest friend, (3) born under a thrice-red star, (4) nameless beggar, (5) benevolent prince, (6) local deity most high.

> tags:

  [power]
  [type:oldtech]
  [storage:trait]

> meta:

  - scope: power
    id: Weapon Form
    note: Eternal Purpose boon from VG 06 p.155.

  - scope: source
    source: Vastlands_Guidebook
    page: 155
<hr/>

#### Viridian Sun

- subtitle: Creation Purpose — Chosen Ones and Quilted Greens
- power: 2
- range: short
- target: one creature
- duration: instant
- overcharge: spawn photosynth 'humans' (L2).

> text:

  You will anoint the Chosen One, bring the new life, translate the places of the machine men into eternal dust.
  Viridian Sun: turn lights green and spawn quilted plants, dreaming trees, mammalian insects, avian arachnids, fungoid gastropods (L1).
  Object (d6): (1) your bearer's sibling, (2) worst enemy, (3) dying old man, (4) wise whale, (5) tyrant's decadent heir, (6) zealous cultist.

> tags:

  [power]
  [type:oldtech]
  [storage:trait]

> meta:

  - scope: power
    id: Weapon Form
    note: Eternal Purpose boon from VG 06 p.155.

  - scope: source
    source: Vastlands_Guidebook
    page: 155
<hr/>

#### Caustic Purification

- subtitle: Balance Purpose — Scatter the Unnaturals
- power: 2
- range: short
- target: one creature
- duration: instant
- overcharge: (not listed)

> text:

  You are the balance, the fulcrum of the world. Your touch will scatter the unnaturals like air plankton in moonlight.
  Caustic Purification: remove an affliction and a benefit (save); cleanse toxins and life.
  Object (d6): (1) dreamer opening a portal, (2) misunderstood scientist, (3) preacher of dire revolution, (4) adolescent throne-heir, (5) bitter, tragic wizard, (6) mother who loved one timelost.

> tags:

  [power]
  [type:oldtech]
  [storage:trait]

> meta:

  - scope: power
    id: Weapon Form
    note: Eternal Purpose boon from VG 06 p.155.

  - scope: source
    source: Vastlands_Guidebook
    page: 155
<hr/>

#### Lay In Wires

- subtitle: Preserve Purpose — Maintain the Canopy
- power: 2
- range: short
- target: one creature
- duration: instant
- overcharge: grants 30 life, target loses 4 life per round.

> text:

  You are the agent of Stasis, the upkeeper of the dream, the maintainer of the canopy.
  Lay In Wires: plunge into a creature, granting 10 life while draining 1 life per round for 12 rounds.
  Object (d6): (1) world-eater's bleak city, (2) raveller of creation's seams, (3) forge of peoples' faiths, (4) undying traveler in time, (5) alien uniter of worlds, (6) subservience to the gods.

> tags:

  [power]
  [type:oldtech]
  [storage:trait]

> meta:

  - scope: power
    id: Weapon Form
    note: Eternal Purpose boon from VG 06 p.155.

  - scope: source
    source: Vastlands_Guidebook
    page: 155
<hr/>

#### Cut the Sky

- subtitle: Devastate Purpose — Planes of Hidden Damage
- power: 2
- range: short
- target: one creature
- duration: instant
- overcharge: 4d4* damage in a slightly larger area.

> text:

  You must keep your true and awesome purpose secret for now. Even from yourself. But it will be great.
  Cut the Sky: barely-visible planes deal 2d4* damage, sever limbs or heads.
  Object (d6): (1) the eater of the sky, (2) gods' secret of life everlasting, (3) innocent breaker of barriers, (4) the one who is and is not, (5) the vile maker of humanity, (6) the child of the angelhunt.

> tags:

  [power]
  [type:oldtech]
  [storage:trait]

> meta:

  - scope: power
    id: Weapon Form
    note: Eternal Purpose boon from VG 06 p.155.

  - scope: source
    source: Vastlands_Guidebook
    page: 155
<hr/>

#### Ha-Ka-Ba Short Circuit

- subtitle: Error Purpose — Abort/Retry/Fail
- power: 2
- range: short
- target: one creature
- duration: instant
- overcharge: lasts 1d4 rounds.

> text:

  This world was not meant to be. This world was not meant for you and me. This was not was not was.
  Ha-Ka-Ba Short Circuit: target’s soul, mind, and body disconnect for 1 round (save); parts attacked individually gain a bonus.
  Object (d6): (1) the moon detonator, (2) the fountain of white hands, (3) the sun eater, (4) the new star, (5) the eternal mind beyond space, (6) the electric MKR.

> tags:

  [power]
  [type:oldtech]
  [storage:trait]

> meta:

  - scope: power
    id: Weapon Form
    note: Eternal Purpose boon from VG 06 p.155.

  - scope: source
    source: Vastlands_Guidebook
    page: 155
### Access Blessings (Our Golden Age Preview)
> Source: SDM-Our_Golden_Age-Teaser_31, p.4.

<hr/>

#### Access Blessing One — Autosoma

- subtitle: Unlock Medical Buildertech, Sacred Pod Charm
- power: 2
- range: nearby
- target: auld meditech
- duration: hours
- overcharge: The healing oldtech deals damage instead.

> text:

  Code daemons in your blood speak to the oldtech and announce you as a hereditary “duck mountain prominence”.
  Control healing machinery without the risk of mutations or degradation. Access suspension capsules. Use cold storage
  as a one-way time machine.
  Note: you can only store this power in human tissue—in yourself (as a trait) or in a suitable anchor, such as the
  mummified hand of Dr. N. A. Vec.

> tags:

  [power]
  [type:oldtech]
  [storage:trait]
  [storage:item]

> meta:

  - scope: power
    id: Access Blessing One
    note: Autosoma rite from Our Golden Age preview p.4.

  - scope: source
    source: SDM-Our_Golden_Age-Teaser_31
    page: 4

<hr/>

## Magitecnica Codex 2 Powers

### ARKHIATRY CLASSICS
> Source: Magitecnica Codex 2, p.34.

<hr/>

#### ANNE ASTEC

- subtitle: Iatric Priest Painkiller
- power: 2
- range: touch
- target: 1 creature
- duration: a day
- overcharge: It lasts a week.

> text:

  You overridea creature's pain response, providing relief from pain and burdens. Wait, did the scribe mishear "anesthetic"?

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: ARKHIATRY CLASSICS
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 37
<hr/>

#### BURDEN SHARE

- subtitle: Sanator's Empathy Ritual
- power: 2
- range: touch
- target: 2 creatures
- duration: several hours
- overcharge: The ritual takes several minutes, but inflicts 1d4 damage to each of the parties.

> text:

  You tap into a creature's essence and transfer one of its burdens—fatigue, injury, anxiety, or some other affliction—to another creature. During transfer it transforms into a spiritual stone, a healer's burden. It feels heavy and annoying within the receiver’s soul, but causes no permanent damage and dissipates normally with rest.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: ARKHIATRY CLASSICS
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 37
<hr/>

#### METEMPSYCHOSIS

- subtitle: Serapefti's Ka-Ba Translation
- power: 6
- range: touch
- target: 1 patient and 1 host
- duration: 1 day and night
- overcharge: Attempt to overwrite the mind of a non-compliant host.

> text:

  You transfer a patient's essence into a new physical host. A perfect replica of the original body is ideal, but alternate hosts such as crude golems, animals, crystals and even vats of memory liquid can suffice. Changing forms may result in temporary psychophysical stress.
  
  
  
  **Patient Host Compatibility** Some complex transfers require a psychemantic or medimagical roll. If the host is non-compliant, roll twice and take the worse result (disadvantage). If the host is dead, the roll is more difficult.
  
  **Similarity** **Effect** Identical no roll required Relative, Friend easy roll Same Species moderate roll Similar Lifeform hard roll (dog, cat, etc.) Alien Lifeform extreme roll (shrubbery, slime mold, alien) Essence Jewel moderate roll Golem, Crude extreme roll (clay, stone, bone) Golem, Polished hard roll (servos, porcelain, and crystal brain) Mundane Object extreme roll, disadvantage (sword, anvil, pot)
  
  **Result** **Effect** nat. 1 Patient’s essence lost or replaced with a similar daemon! fail Transfer fails. Both targets exposed to moderate corruption. success Transfer succeeds. Host essence destroyed. nat. 20 Excellent transfer. Patient can choose to retain one of the host’s traits or skills.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: ARKHIATRY CLASSICS
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 38
<hr/>

#### OPEN PERSON

- subtitle: Hsu Doru's Preparatory Ritual
- power: 6
- range: touch
- target: 1 standard humanTM
- duration: 1 hour
- overcharge: : The individual organs are unraveled and suspended in a protective ectoplasm. Activity in this state may be lethal (save or die). Treatments are trivial, medical spell prices are quartered.

> text:

  You activate a person’s standard humanTM construction seams® to painlessly unfold them like a flower for easier medical treatment. An open person may seriously injure themselves if not careful (3d6 damage per action). Treatments on an open person are significantly easier, the price of biomantic and medical powers used on them is halved.
  
  _Note_ : an unattended open person automatically reseals after 1 hour.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: ARKHIATRY CLASSICS
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 39
<hr/>

#### PARASOMA TRANSFERENCE

- subtitle: Hsu Doru's Life Shunt
- power: 2
- range: touch
- target: 2 creatures
- duration: instant
- overcharge: : Amplification restores an additional 1d4 life per point transferred.

> text:

  You manipulate the underlying energy patterns to transfer life from one creature to another, or directly from your own reserves.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: ARKHIATRY CLASSICS
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 39
<hr/>

#### PRIMARY DESENESCENCE

- subtitle: Wissa's Fountain of YouthificationTM
- power: 6
- range: touch
- target: 1 creature
- duration: a week
- overcharge: : Restore a creature to its state of six years earlier.

> text:

  You restore a creature to its biological state of a year earlier, while preserving most of its current memories.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: ARKHIATRY CLASSICS
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 39
<hr/>

#### REAL-TIME REBUILD

- subtitle: Zdarovar's Rapid Healing
- power: variable
- range: touch
- target: 1 creature
- duration: minutes
- overcharge: : The healing process is accelerated to just a few seconds, but this doubles the pain experienced by the target.

> text:

  You invoke the oneiroi Quiscus and Sanatus to reach into a creature's essence and replace damaged code with a pristine version. This painful process deals damage equal to its power.
  
  **Power Settings:** P2 remove cosmetic blemishes P4 flush toxins or afflictions P6 restore a damaged organ to factory settings P10 regrow a limb P16 regrow a head or torso P25 rebuild a whole body from dust and fragments

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: ARKHIATRY CLASSICS
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 40
<hr/>

#### RESTORATIVE SLUMBER

- subtitle: Medeorite's Healing Dream Ritual
- power: 2
- range: touch
- target: 1 creature
- duration: 3 days and nights
- overcharge: : Restore an additional attribute or lift a second burden. Alternatively, reduce the duration of the slumber three-fold.

> text:

  Your dream-form leads the patient into a deep, healing sleep. While asleep, they appear lifeless. After the spell concludes they awake rejuvenated, with one attribute restored or one burden lifted.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: ARKHIATRY CLASSICS
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 40
<hr/>

### NUNKA’S AUTOMORPH
> Source: Magitecnica Codex 2, p.28.

<hr/>

#### NUNKA’S WEAPON MORPH

- subtitle: Biocombat Implementation
- power: 2
- range: touch
- target: one creature
- duration: permanent
- overcharge: The weapons erupt instantly in a traumatic burst dealing 1d6 damage.

> text:

  You coerce a creature's biology to express natural weapons like claws, spikes, horns, or venom. The manifestation depends on the creature's size and form. The modification occupies an inventory slot. The transformation requires 1 day.
  
  
  _Note:_ Multiple uses on a single individual are dangerous.
  
  `⚔︎`
  
  **Common Natural Weapons**
  
  **Form** **Weapon** Cat-sized 1d4 damage Dog-sized 1d6 damage Human-sized 1d8 damage Horse-sized 1d12 damage Elephant-sized 2d10 damage Painful venom 1 agility damage and save or lose round. Paralytic venom each round, save or lose action. After 3 failed saves, paralyzed for an hour. After 3 successes, shake it off. Necrotic venom lose use of 1 limb for an hour, then 1d6 damage and save or limb starts to decay.
  
  `⚔︎`

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: NUNKA’S AUTOMORPH
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 29
<hr/>

#### NUNKA’S EPIDERMAL SCULPT

- subtitle: Biodefense Integration
- power: 2
- range: touch
- target: one creature
- duration: permanent
- overcharge: The growths develop instantly, dealing 1d6 damage.

> text:

  You reshape a creature’s skin and other external tissues. The modification occupies an inventory slot. The transformation requires 1 day.
  
  
  _Note:_ Multiple uses on a single individual are dangerous.
  
  `⚔︎`
  
  **Epidermal Effects**
  
  Some complex sculpts require a biomantic roll.
  
  **Sculpt** **Effect** Leathery Hide armor +2 Fur, Feather or Fat Insulation cold resistant Sweat or Radiators heat resistant
  
  Scales armor +3, reduced water loss, (moderate) Armored Nodules armor +5, agility -1, (moderate) Armored Plates armor +8, agility -3, (hard) Rejuvenated look a decade younger Soft Skin armor -2, look younger, (moderate) Squishy armor -5, agility +2, (hard) Vesicles store liquids or gases, agility -1 Spines attackers suffer 1d4 damage in close combat Lethal Spines attackers suffer 1d8 damage in close combat, agility -1, (hard) Webbing / Gliding Surfaces movement bonus, agility -1, (moderate) Transparent creepy Glowing like a bioluminescent candle, (easy) Camouflage bonus to hide, conceal, (easy) Slippery bonus to grapple, escape, (easy)
  
  **Result** **Effect**

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: NUNKA’S AUTOMORPH
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 30
<hr/>

#### NUNKA’S BIOPHYSICAL OVERDRIVE

- subtitle: Radical Metabolic Manipulation
- power: 1
- range: touch
- target: one creature
- duration: 10 minutes
- overcharge: The target gains an additional 6 points to assign to strength, endurance, agility, attack, and defense as it sees fit. When the overdrive fades, besides the exhaustion the target also suffers 1d8 damage.

> text:

  You coerce the target into a fight or flight overdrive, boosting its physical abilities past their safe limits. The target gains +2 strength, endurance, and agility. It can lift more, leap farther, punch harder. When the overdrive fades, it gains 6 exhaustion burdens. These fade at a rate of one per hour.
  
  
  **Again (x4):** The target gains 6 more points to assign. When the overdrive fades, besides the exhaustion and damage, the target must save or die.
  
  `⚔︎`

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: NUNKA’S AUTOMORPH
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 32
<hr/>

#### NUNKA’S SPITTING SYMBIOTE

- subtitle: Integrated Biological Warfare
- power: 4
- range: touch
- target: one creature
- duration: permanent
- overcharge: a perfected integration means the symbiote regrows after a single full round if the host spends 1d4 life.

> text:

  You craft a custom symbiote that integrates into the target’s digestive tract. The crafting takes a day, the painless embedding another 8 hours. The symbiote occupies one inventory slot.
  
  On command, the host can vomit forth part of the organism as a weapon, either directly at an enemy or onto terrain as a trap.
  
  Symbiote options include: 1. Caustic Slime Worm. Short range. 2d6 acid damage in a small radius. Save for half.
  
  2. Writhing Thornstar. Short range. Entangling thorns in a small radius. Anyone passing through quickly suffers 1d6* damage. 3. Necrotic Fungaloid. Short range. Spore sac deals 1d8 damage on impact or when triggered on. Target must save or suffer 1d6 endurance damage as its lungs are attacked. 4. Snapping Moraykin. Close. Additional bite attack deals 1d6* damage. Automatically strikes enemies who are not expecting the host’s mouth to fold open and release a biting second mouth. 5. Green Grappler. Close. Tentacles grapple a target and make it very hard to pull away. 6. Sonic Hive. Short range. Hundreds of stinging insects pour forward, confusing, harassing, annoying. 7. Stunfish. Short range. A pulsating aerial jellyfish that wafts with the air currents. If struck, it detonates in a spectacular shockwave of light and electromagnetic radiation. Creatures near the jellyfish must save or are blinded and stunned for a few rounds. 8. Glue Cucumber. Short range. Spray of gooey yellow proteins glues the target to the surface. Hard save to break free.
  
  After attacking, the symbiote must regrow before it can be used again. This happens naturally in 1 week or more quickly, in an hour or so, if the host spends 1d4 life.
  
  
  `⚔︎`

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: NUNKA’S AUTOMORPH
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 33
<hr/>

### REHORYAN’S BLOOD CANTICLE
> Source: Magitecnica Codex 2, p.19.

<hr/>

#### REHORYAN’S VITAL SYMPHONY

- subtitle: Somatic Insight Probe, Bodyreading
- power: 1
- range: touch
- target: one creature
- duration: ten minutes
- overcharge: The attunement takes mere seconds. Or: you may listen for the biohistory of a dead organism or part thereof.

> text:

  You attune to a living organism, hearing the biohistory in its cells. After 10 minutes of contact, you may ask the referee three questions about the creature's medical history and status.
  
  
  ❂

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: REHORYAN’S BLOOD CANTICLE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 19
<hr/>

#### REHORYAN’S VIVID REGRESSION

- subtitle: Bioatavistic Reformulation
- power: 4
- range: touch
- target: one creature
- duration: permanent
- overcharge: The spell is not dangerous to the target, it suffers no stress damage, and it gets a bonus to save its original traits.

> text:

  You taste a creature's flesh or blood, unlocking genetic memories of its evolutionary past. Over the next hour you regress it to an ancestral form with gentle song. This is dangerous for the target and it suffers 1d8* damage from severe stress.
  
  First, add 1d3 to one ability of choice, then subtract 1d3 from a different random ability.
  
  Next, the target saves. If it fails, it loses a random trait.
  
  Finally, the target gains a primitive trait such as a prehensile tail, gripping feet, powerful fangs, curly fur, clawed fingers, or brachiating arms.
  
  
  _Note:_ Using this power on the same creature multiple times is very dangerous, with a large chance of creating a malevolent ooze.
  
  ❂

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: REHORYAN’S BLOOD CANTICLE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 20
<hr/>

#### REHORYAN’S PROGRESSIVE RESTORATION

- subtitle: Automedical Self Repair
- power: 2
- range: touch
- target: one creature
- duration: 10 rounds
- overcharge: Regenerate for 10 more rounds.

> text:

  Your touch instructs an organism to start swiftly repairing itself. The target regenerates 1 life point per round. As the regeneration proceeds, wounds knit, broken bones set, and missing bits regrow. Injured areas remain tender and fragile for a week.
  
  _(rounds)_ **Life** **Repair** 3 Open wounds knit, bleeding stops. 7 Broken bones set. Medical roll to set them _well_ .
  
  10 Fingertips, earlobes, nose tips grow back.
  
  
  _(rounds)_ **Life** **Repair** 13 Torn ligaments regrow, joints function again. 17 Partially destroyed organs self-repair. 20 Fingers, ears, noses, tongues, toes, eyes grow back.
  
  _Note:_ this power does not cure illnesses or conditions.
  
  ❂

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: REHORYAN’S BLOOD CANTICLE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 21
<hr/>

#### REHORYAN’S PROPHETIC SONG

- subtitle: Purposeful Biotic Evolution
- power: 5
- range: touch
- target: one creature
- duration: permanent
- overcharge: Disabled for this power by order Magenta-cantaloupe-3.

> text:

  After drinking a sample of the target’s spinal fluid, you may chant viridian rituals into its flesh, forcing a rapid evolution. This is dangerous for the target. After 1 day of troubled sleep it permanently gains either:
  
  New Trait:
  
  1. night vision 2. tremorsense
  
  3. intuitive mechanical repair aptitude 4. limited telepathy 5. hard vacuum resistance (survive 3 minutes with no ill effects) 6. radiation resistance or other similar evolved trait
  
  Eugenic Inheritance: +2 to one ability (not exceeding the normal maximum).
  
  
  _Note:_ Using this power on the same creature twice is very dangerous and may transform it into an acidic gelatinomorph.
  
  ❂

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: REHORYAN’S BLOOD CANTICLE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 22
<hr/>

#### REHORYAN’S PROPHETIC SONG 2

- subtitle: More Purposeful Biotic Evolution, Rehoryan’s Illegal Power
- power: 11
- range: touch
- target: one creature
- duration: permanent
- overcharge: 

> text:

  _This off-label power is not included in normal Rehoryan albums. This power can only be used on a creature that has already heard Rehoryan’s Prophetic Song, also known as Song 1._
  
  
  After eating a sample of the [missing], you may chant obsidian rituals into its vitals, encouraging a perfect evolution. This is very dangerous for the target. After 1 day of gentle sleep it permanently gains either:
  
  Far Evolved Trait: 1. gravistatic organ (can levitate in place) 2. televisual abilities (can see through another creature’s eyes) 3. photovitalic skin (meets 50% of nutritional needs) 4. improved bioluminescence (display 700 ads on your skin!) 5. incredible heat/cold tolerance 6. radiation immunity or other similar evolved trait
  
  Improved Eugenic: +3 to one ability (even above the normal maximum).
  
  _Note:_ Using this power on the same creature twice is very dangerous and has a 90% chance of turning it into a carnivorous polymorph or mimic.
  
  ❂

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: REHORYAN’S BLOOD CANTICLE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 23
<hr/>

### SIATO RUNO’S XENON GENESIS
> Source: Magitecnica Codex 2, p.24.

<hr/>

#### RUNO’S BIOCATALYSIS

- subtitle: Biotemporal Manipulation
- power: 1
- range: touch
- target: one human’s worth of living organisms
- duration: an hour
- overcharge: Make the process 100 times faster or slower. Dangerous for the target.

> text:

  You alter the speed of a chosen biological process in the target, accelerating or retarding it as much as 10-fold. Processes include growth, gestation, decay, metabolism, disease progression, etc.
  
  
  **Again (x4):** Make the process 1,000 times faster or slower. Very dangerous for the target.
  
  ☗

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: SIATO RUNO’S XENON GENESIS
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 24
<hr/>

#### RUNO’S PARTHENOGENIC CRADLE

- subtitle: Synthetic Egg System
- power: 3
- range: touch
- target: one “egg” mass
- duration: gestation period
- overcharge: The gestation is 10 times faster than normal. Dangerous for the subject.

> text:

  You sculpt a viable egg and artificial uterus from biomatter. Using somatic manipulation, you spark parthenogenic development within the cradle. The egg gestates to term as normally required by the subject species.
  
  
  **Again (x4):** The gestation is 100 times faster than normal. Very dangerous for the subject.
  
  _Note:_ A tissue sample of the subject species is recommended for successful parthenogenesis.
  
  _Warning:_ Once hatched, the bodies and consciousness of new organisms may display unpredictable aberrations from the forced growth. Siato Runo LLC is not liable for any teratogenous disasters caused by careless parthenogenesis.
  
  ☗

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: SIATO RUNO’S XENON GENESIS
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 25
<hr/>

#### RUNO’S PARTHENOGENIC POUCH

- subtitle: Synthetic Marsupilism
- power: 4
- range: touch
- target: one creature
- duration: permanent
- overcharge: Sculpt three pouches occupying two slots. Dangerous for the subject.

> text:

  You sculpt a viable marsupial pouch and womb structure within a creature's body, enabling it to gestate and carry an embryo to term. The pouch permanently occupies one slot.
  
  _Note:_ Larger species may require larger pouches. Using this power on the same creature twice is very dangerous.
  
  
  _Synergy:_ Combine with _Runo’s Parthenogenic Cradle_ to quickly produce clone-broods on the hoof! Popular with nomadic biomancers.
  
  ☗

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: SIATO RUNO’S XENON GENESIS
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 26
<hr/>

#### RUNO’S ONTOGENIC EDITOR

- subtitle: Germline Modifier
- power: 4
- range: touch
- target: one embryo or egg
- duration: permanent
- overcharge: The organism is altered to twice (or half) the normal extreme of the species. So, twice or half the size, for example. This is dangerous for the organism.

> text:

  You stretch a tendril of focused aura into an unborn organism to manipulate its developmental pathway, altering it to reach the upper or lower extremes of the species range in one aspect. The effect unfolds through the creature’s gestation and maturation.
  
  
  ☗
  
  **Generic Aspects**
  
  **Aspect** **Effect** 1. Size Increase or decrease final growth size. 2. Lifespan Extend or reduce natural lifespan. 3. Maturation Accelerate or slow developmental progression. 4. Physical Alter attributes like strength, durability, speed. 5. Senses Enhance sensory acuity, reduce sensory vulnerability. 6. Adaptations Resistance to hazards, camouflage. 7. Cognitive Expand intelligence, reasoning, special talents. 8. Behavior Adjust sociability, docility, initiative, drive, curiosity. 9. Morphology Appendages, bone structures, fur, feathers. 10. Metabolism Increase or reduce metabolic rates.
  
  ☗

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: SIATO RUNO’S XENON GENESIS
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 27
<hr/>

### THE AWAKENED SPHERE
> Source: Magitecnica Codex 2, p.41.

<hr/>

#### EATEGRATE

- subtitle: Simple Assimilator
- power: 2
- range: eating distance
- target: self
- duration: imbued
- overcharge: : You can manifest a semi-magical trait, like the breath of a dragon or the death glare of a unicorn.

> text:

  You eat part of a creature you are familiar with to temporarily manifest one of its natural traits. A nail clipping or some fur will suffice.
  
  Each manifested trait occupies an inventory slot somewhere in your body as a 1 stone mass, but it doesn’t otherwise interfere with you and is painlessly reabsorbed when you deactivate the power.
  
  Traits may include:
  
  1. Features like the mane of a lion, the pebbly skin of a snake or the cute ears of a bunny.
  
  2. Senses like the smell of a shark or the hearing of an elf.
  
  3. Aptitudes like the brachiation of an ape, the flight of an albatross or the leap of a kangaroo.
  
  _Note:_ if you consume a pound of _living_ flesh (1d6 damage), the cost of using the power is halved. However, consuming living flesh is kind of a horrible thing to do and would mark you out as a ghoul. Eating a symbolic representation, like cookies baked in the shape of a skunk to get its ... aroma ... instead doubles the power cost. But is much nicer.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: THE AWAKENED SPHERE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 45
<hr/>

#### BLOODSONG

- subtitle: Bioactive Communion
- power: 2
- range: touch
- target: 2 creatures
- duration: imbued
- overcharge: : You forge a link between two very different creatures, such as between a dog or a crab and a hydra or a medusa.

> text:

  You forge an tele-empathic link between two similar creatures, such as between two mammals or two avian dinosaurs, by exchanging vital animalcules. They can now concentrate to communicate telepathically over significant distances.
  
  The life force of one of the target creatures imbues the power. If this creature is not the power user, it is paid in addition to the activation cost.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: THE AWAKENED SPHERE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 46
<hr/>

#### MANYBODIED

- subtitle: Bioactive Fusion
- power: 2
- range: psychosurgical range
- target: 1 creature
- duration: imbue
- overcharge: : You attempt to inject your mind into a larger creature, such as a man or mammoth.

> text:

  You inject your mind into a creature, such as a cat or capybara, turning it into a drone under your telepathic control. Accessing a drone’s sensory experiences, memories, or skills requires conscious effort and concentration.
  
  Your control is anchored in a metaphysical anchor occupying an inventory slot. Dropping or dissolving the anchor ends the fusion, releasing the target.
  
  
  _Note:_ Dominating a creature whose mental attributes exceed your own is dangerous—it may take control of you instead! At the referee’s discretion, very alien creatures may be harder to control.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: THE AWAKENED SPHERE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 47
<hr/>

#### SKINSHIFT

- subtitle: Formal Translation
- power: 4
- range: touch
- target: self
- duration: imbued
- overcharge: : Shift into much smaller (shrew-sized) or larger (mammothsized) forms.

> text:

  You adopt the physical form of a roughly human-sized creature (say dogsized to horse-sized) you are familiar with and whose symbolic representation you own. This could be a tiger tattoo or a dodo doll. The transformation takes several minutes.
  
  Your physical abilities and traits transform to match the target. You lose access to traits that do not work in the new form. For example, a hog cannot speak, so neither can you if you shift into a hog.
  
  You stay in your adopted form as long as you imbue it with your vital essence. Warning: occupying a strange skin can be dangerous, shifting your mind (after days) or even trapping your form (after weeks).
  
  _Note:_ if you are carrying the prepared skin of your chosen form, the power cost is halved and the transformation takes mere seconds.
  
  
  **Again (x4)** : Into any form, from a mite to a mighty airwhale.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: THE AWAKENED SPHERE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 48
<hr/>

#### SKINSPLIT

- subtitle: Colony Translation
- power: 6
- range: touch
- target: self
- duration: imbued
- overcharge: : Shift into a dangerous colony organism with special attacks.

> text:

  Your skin splits and you collapse into a colony organism, such as a hive of bees, a nest of naked mole rats, or a swarm of spiders. You must be familiar with the species and own a suitable symbolic representation. The transformation takes several minutes.
  
  You gain the physical abilities and traits of the colony organism and lose access to traits that do not work in this form. So long as 10% of the colony survives, you can return to your normal form without harm. If less of the colony survives, you may lose traits and memories.
  
  You stay in your adopted form as long as you imbue it with your vital essence. Warning: occupying a strange skin can be dangerous, shifting your mind (after days) or even trapping your form (after weeks).
  
  _Note:_ if you are carrying a preserved colony or hive, halve the power cost and transform in mere seconds.
  
  
  
  **Example Dangerous Colonies:** Venomous Spiders. Paralyze a creature with your attack. The first save is easy enough, but each successful attack adds a cumulative penalty.
  
  Telepathic Feral Hogs. Become six hogs. Each deals 1d4 damage. As a pack, they get a trample or overrun attack. Also, telepathic.
  
  Carnivorous Slime Molds. Deal 1d4 physical ability damage per round. Heal by consuming flesh.
  
  Strangling Vines. Creep through the forest, crawl through the undergrowth, entangle (save) then choke (save).

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: THE AWAKENED SPHERE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 49
<hr/>

#### SKINWYRD

- subtitle: Subconscious Translation
- power: 1
- range: self
- target: self
- duration: special
- overcharge: : You retain some control of the skinwyrd, including the ability to deactivate the power by making a successful save.

> text:

  You give free reign to the darkest parts of yourself, transforming into a ravening aberrant horror born of your subconscious. You lose the ability to use powers or your higher mental faculties, but your strength, endurance, and melee attack all increase depending on your aura score:
  
  **Aura** **Effect** ≤0 +4+level str and end, 2d8 melee attack 1 +3+level str and end, 1d12 melee attack 2 +2+level str and end, 1d10 melee attack 3 +1+level str and end, 1d8 melee attack 4 +level str and end, 1d6 melee attack 5≤ Skinwyrd does not activate as normal, instead it explodes in a single burst that deals 1d6 psychic bliss damage to each adjacent creature. Any creature that takes 1 damage is stunned with immaculate joy for 1 round. Any creature reduced to 0 life by this damage falls asleep and awakens later unharmed.
  
  You cannot end skinwyrd normally. Each round in the skinwyrd, you lose 1 life. When you reach 0 life, you fall unconscious and revert to your normal form. When you awake, you regain 1d6 life.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: THE AWAKENED SPHERE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 50
<hr/>

#### ECOSPHERE ATTUNEMENT

- subtitle: Biodetector
- power: 1
- range: touch
- target: 1 creature
- duration: imbue
- overcharge: : Double the attunement range and intuit current and past events from traces of feeding, bleeding, and dying.

> text:

  You open your mind to the living patterns nearby. This expands your sensory repertoire and enhances your awareness.
  
  Gain a bonus to detecting hidden or invisible creatures, avoiding surprises or ambushes, and tracking recent biological activity.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: THE AWAKENED SPHERE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 51
<hr/>

#### ECOSPHERE VEIL

- subtitle: Biojammer
- power: 2
- range: touch
- target: 1 creature
- duration: imbue
- overcharge: : You are effectively invisible and undetectable within the environment, passing without sound or trace. Alternatively, you are completely unmissable.

> text:

  You align your essence with the local ecosphere. Creatures unconsciously disregard your presence, facilitating stealth. _Alternatively_, you can make yourself stand out sharply, possibly distracting from other activities or gaining a social bonus like a peacock in full display.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: THE AWAKENED SPHERE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 51
<hr/>

#### ECOSPHERE IMMERSION

- subtitle: Biomelt
- power: 5
- range: 0
- target: self or 1 creature
- duration: 1 day and 1 night
- overcharge: : Persist as motes in the wind and microbes in the soil for up to 1 week before full reconstitution. Each day counts as a week’s rest. At the end of the week, save or permanently replace one of your traits with a deep panpsychic connection to the local ecology: the glen, dale, vale, grove, stream, lake, bay, or what have you. You may choose to fail this save.

> text:

  The ecosphere consumes you. The living creatures of the area eat your body and your mind and personality travel unseen in the movement of birds and beetles, the sigh of grass and the creak of trees. When the spell ends, your body reconstitutes from dead organic matter over about a day.
  
  Over the day spent in the ecosphere you gain a deep awareness of the local area and heal one burden or affliction as though you had a weeklong rest. You regain no life during your time in the circle of life.
  
  This power is dangerous for creatures other than yourself and costs double if cast on an unwilling target.
  
  
  
  **Ecoentheosis (trait)**
  
  - You are in mystic union with the local ecology. You can communicate
  
  with any animal or plant or fungus or stranger living thing in the area and metaphysically feel through the many senses of the creatures there. You feel the swing of a woodsman’s axe, the joy of Spring’s blossoming, the tramping of an army, and the fall of a great oak.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: THE AWAKENED SPHERE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 52
<hr/>

### USHA’S WILD RIDE
> Source: Magitecnica Codex 2, p.9.

<hr/>

#### USHA’S HORRORSHOW INFESTATION

- subtitle: Biotic Corruption Augment, Cancer Bomb
- power: 4
- range: spitting distance
- target: one creature
- duration: a few minutes
- overcharge: the target automatically fails its save and immediately suffers 4d6 damage as the infestation erupts and begin attacking. If target dies, a fully-grown flesh horror (L6, 54 life) bursts from the corpse in 1d4 rounds. It is under nobody’s control.

> text:

  You spit a corrosive bio-daemon that begins to rewrite the target’s genetic code. It writhes and twists, losing one turn, then saves.
  
  _Success:_ it suffers 4d6 damage as its body voids benign alien tumors.
  
  _Failure:_ it suffers 2d6* damage as four hooked limbs of muscle and keratin erupt from its skin. Each limb (L4, 8 life) attacks the nearest creature or the target for 1d6 damage per hit. After a few minutes, the infestation loses coherence and the limbs collapse into sticky goo.
  
  _Extract:_ ripping the infestation out is tough and deals another 2d6* damage to the target. The creature (L4) continues to attack mindlessly.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: USHA’S WILD RIDE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 9
<hr/>

#### USHA’S CHAOS TRIGGER

- subtitle: Biotic Manipulation Augment, Mutation Bomb
- power: 3
- range: scratching distance
- target: one creature
- duration: 1d4 rounds
- overcharge: You get to choose the mutation. Dangerous.

> text:

  You speak to the target's genetic code, triggering unpredictable mutation. It suffers 1d6 damage per round for 1d4 rounds as flesh and bone warp and change. After, the target gains a random mutation that fills one of its slots. An unwilling target saves to avoid the mutation. Roll 1d6:
  
  1. Roll on the Regular Exposure corruption table 2. Roll on the Mild Exposure corruption table 3. Regression. Prehensile tail, gripping feet, powerful fangs, curly fur, clawed fingers, or brachiating arms. 4. Extra Sensory Organ. Electric sense, magnetic sense, canine smell, feline hearing, serpentine taste, or the ability to see dead people. 5. External Changes. Armored hide (+2 defense), bioluminescence, rudimentary gills (longer dives), arm feathers (glide), hooves, or rubber skin (electric and radiation resistance). 6. Internal Changes. Acidic blood, venomous saliva, super-liver (break down toxins), regenerating sticky entangling intestines (sea cucumber style), second heart, or nauseating cloud organ.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: USHA’S WILD RIDE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 11
<hr/>

#### USHA’S UPLIFT

- subtitle: Biotic Enhancement Augment, Value Added Operation
- power: 2
- range: tickling distance
- target: one creature less smart than yourself
- duration: permanent
- overcharge: Its intelligence increases another step (+2 thought). Overcharge again (x4): Another step (+3 thought).

> text:

  You manipulate the target’s genetic material, increasing its intelligence over several days. If it has a thought score, this increases by 1.
  
  _Note:_ Very dangerous for the target. Usually only works once per target.

  **The Ladder of Sentience**
  
  Incomprehensible mess of gore, ropes of keratin, legs of gristle, limbs of thorn. If it infects enough humans it may become cunning, even wise.
  
  **Tho Example Creatures** -8 algae, moss, bacterium -7 amoeba, fungus, slime mold, tree -5 anemone, jellyfish, earthworm -4 crab, fish, insect, spider -3 insect colony, frog, salamander -2 mammal, reptile, bird -1 ape, corvid, dolphin, troglodyte 0 basic human
  
  
  **Love Your Maker**
  
  Perhaps the creature is pleased with its new situation?
  
  **d20** **Creature’s Response** 1 Outwardly pleased, secretly plots to overthrow its creator. 2–7 Brutally depressed by realization of its own mortality.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: USHA’S WILD RIDE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 12
<hr/>

#### USHA’S CHIMERA SPLICE

- subtitle: Biotic Fusion Augment, Meltflesh Hyperblot
- power: 4
- range: scalpel distance
- target: two creatures
- duration: permanent
- overcharge: The chimera gains an additional trait from each original creature.

> text:

  You splice two creatures into a single chimeric organism.
  
  _Note:_ Both targets save. Unconscious targets do not save. Both targets must fail their saves for the power to work. Remember, hero dice can boost save targets ...
  
  The hybrid retains the attributes of your choice (level, life points, ability scores, defenses, etc.). The new creature also has one trait from each of the originals (e.g. venom, vintner, flight, farrier, poison breath, apothecary).
  
  The painful splicing deals 4d8 damage to the new chimera. This cannot reduce it below 1 life.
  
  
  
  **What of its Mind**
  
  Before there were two minds, now there is one. Which is it?
  
  **d20** **Creature’s Response** ≤3 A new mind, a melding of both that went before. And it hates you. 4–7 A dominant mind and a subordinate mind and they both hate you. 8–10 Two minds, howling at each other. This will be complicated. 11–14 One mind remains and it hates you. 15–19 One mind remains, confused, with no memory of what happened. 20≤ Both minds are obliterated. A pliant shell for you to command!

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: USHA’S WILD RIDE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 14
<hr/>

#### USHA’S XENOGRAFT

- subtitle: Biotic Integration Augment, Meetmeat
- power: 6
- range: bonesaw range
- target: one creature
- duration: permanent
- overcharge: The procedure takes less than an hour. It is very dangerous for the experimental subject.

> text:

  You surgically graft a new anatomy and associated trait into the target creature. You must have the relevant anatomy on hand to attempt a graft. The procedure takes a day and is dangerous to the target. Make a biomantic, medical, or other relevant test to integrate the xenograft:
  
  **Roll** **Effect** ≤1 Catastrophe. Patient suffers severe corruption, then dies. 2–5 Severe corruption exposure, 6d6 damage, new trait occupies 2 slots. 6–10 Regular corruption exposure, 4d6 damage, new trait occupies 2 slots. 11–15 Mild corruption exposure, 2d6 damage, new trait occupies 1 slot. 16–19 2d6 damage, new trait occupies 1 slot. 20≤ New trait occupies 1 slot.
  
  The patient can use the xenograft once they have healed from the procedure.
  
  
  
  **Recorded Xenografts** The following xenografts were seen by the cleanup crew after the Green Powder Island incident of —X4. 1. Ghula Musculature. Lifted from a warc semi-living phenotype (strain U-572). Boost strength and endurance by 1d4 each, reduce charisma and aura by 1d3 each, gain a 1d6 bite attack. 2. Airbeast Boneframe. Aeorilth and honeycomb structures reduce weight by 25% and boost agility by 2. 3. Scalamander Wetware. Gill structures and webbing double swimming speed and increase dive length ten-fold. Reduce charisma by 1d2.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: USHA’S WILD RIDE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 15
<hr/>

#### USHA’S REPLICATOR STRAND

- subtitle: Biotic Growth Augment, Root Meatmaker
- power: 1
- range: touch
- target: one pound of biomatter
- duration: permanent
- overcharge: Watch a stone’s worth of tissue grow to sack-sized in one hour. The growth deals 4d4 damage to a living creature that fails its save. Cutting away the area deals 1d8 damage.

> text:

  Touch a tissue and watch it balloon fourteen-fold over an hour (from soap-sized to 1 stone).
  
  _Save:_ if the tissue is part of an aware creature, the creature saves. If the save fails, the growth deals 2d4* damage over one hour. Cutting away the affected area deals 1d6 damage, the cutaway continues to grow.
  
  _Note:_ the growth does not produce high quality tissue. Grown meat is spongy and tough, expanded ivory is brittle and gnarled, extended hair is flakey and hard. It’s just ... bigger.

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: USHA’S WILD RIDE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 17
<hr/>

#### USHA’S SWIFT REBUILD

- subtitle: Biotic Regeneration Augment, Systemic Limb Back Trigger
- power: 3
- range: touch
- target: one limb
- duration: permanent
- overcharge: Regrow a critical organ or bodily system, like the digestive or circulatory system. These cannot be safely removed.

> text:

  Regrow a non-critical destroyed tissue, limb or organ. Takes one hour. Please remove* damaged parts before regrowth for safety.
  
  
  **Again (x4):** Regrow a body from a single limb or organ. Memories will not be restored.
  
  
  **[optional] Surgihackery**
  
  Removing a damaged tissue, limb or organ in the field, without a proper facility, deals 20 damage to the targ ... er ... patient. Reduce this amount by the result of a medical, biomantic, veterinary, or other relevant roll.
  
  
  **Unsafe Rebuilding**
  
  Didn’t remove the damaged part first? Make a biomantic, medical, or other relevant roll.
  
  **Effect** ≤1 Roll on the Severe Exposure corruption table. Then the target dies. 2–11 Roll on the Moderate Exposure corruption table. 12–19 Roll on the Mild Exposure corruption table. 20≤ Everything went well! Huzzah!

> tags:

  [power]
  [type:other]
  [storage:item]

> meta:

  - scope: power
    id: USHA’S WILD RIDE
    note: Magitecnica Codex 2 (Biomancy)

  - scope: source
    source: Magitecnica_Codex_2
    page: 18
<hr/>
