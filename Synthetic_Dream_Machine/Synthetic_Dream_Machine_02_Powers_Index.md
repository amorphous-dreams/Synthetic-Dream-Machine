# SDM Power Index

*(Canonical repository for Vastlands powers. Use this document to record every power stat block, regardless of whether the power is stored as a trait, item, burden, or location-bound wonder.)*

## Power Template

```text
title: <Power Name>
subtitle: <Flavor caption or invocation>     # optional, sits between title and stats
power: <P>
range: <R>
target: <T>
duration: <D>
overcharge: <Ox steps / notes>
text:
  <Full power procedure/description exactly as written, including activation costs and narrative details.>
tags:
  [power]
  [type:<oldtech|fantascience|ritual|weapon|other>]
  [storage:<trait|item|burden|structure|location>]
  [source:Vastlands_Guidebook]
  [page:<##>]
meta:
  - scope: power
    id: <Album Name|Path Reference|…>         # matches a reference; spaces ok
    index: <##>                               # optional order/index reference
    note: <extra context>                     # optional free text
```

### Usage Notes

- **Stat block recap.** Every power records Power (P), Range (R), Target (T), Duration (D), and Overcharge steps (Ox). Optional attributes/tags such as Anchored, Attack, Focus, Fueled, Imbued, Item, or Dangerous appear when relevant.
- **Storage tags.** Use `[storage:trait]` when a power is inscribed as a trait, `[storage:item]` for spellbooks or devices, `[storage:burden]` for curses/brands, etc. Many entries will have multiple valid storage forms.

---

### Vastlands Guidebook Powers

#### The Sixfold Hexacenter
> Source: Vastlands Guidebook, p.108.

```text
title: Red Mist
subtitle: Tactical Aggression Augment
power: 1
range: short, ~20m
target: one creature
duration: a few minutes
overcharge: Affect a number of creatures equal to your level + 1.
text:
  Rubra’s need overcomes the target. Anger and passion boil, threatening to break its composure (save).
  It rerolls its reaction roll with a single d8. Choose whether they add or subtract your charisma.
tags:
  [power]
  [type:fantascience]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:108]
meta:
  - scope: power
    id: The Sixfold Hexacenter
    note: Listed in album order on VG p.108.
```

```text
title: Orange Dream
subtitle: Forgotten Spider’s Labors
power: 1
range: whisper
target: one creature
duration: an hour
overcharge: Even a hostile or violent creature listens, provided you can whisper in its ear.
text:
  A neutral or friendly creature agrees to do what you ask for an hour (no save), so long as it does not appear
  immediately dangerous or risky.
tags:
  [power]
  [type:fantascience]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:108]
meta:
  - scope: power
    id: The Sixfold Hexacenter
    note: Listed in album order on VG p.108.
```

```text
title: Yellow Cloud
subtitle: Sands of Lost Times
power: 1
range: nearby
target: a 9m cube
duration: a few minutes
overcharge: Summon into shimmering immobility a wall of dust measuring 200 cubic meters.
text:
  Fine, obscuring yellow dust rises from the ground and hangs in the air, a veil no sight can pierce. The dust
  irritates the lungs of air-breathers. After a few minutes, it blows away.
tags:
  [power]
  [type:fantascience]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:108]
meta:
  - scope: power
    id: The Sixfold Hexacenter
    note: Listed in album order on VG p.108.
```

```text
title: Green Haven
subtitle: Arbor Sanctuary
power: 1
range: nearby
target: a 7m diameter sphere
duration: a night or a day
overcharge: Sculpt a thorny hedge wall measuring 200 meters square and 1 meter thick. Its thorns cut anyone pushing through like daggers (1d4 damage).
text:
  Convince shrubberies, grasses, brambles, and other plants to form a hedge domehome, a sanctuary to rest and hide
  in. Enemies need at least one turn to pass through the hedge. They are vulnerable while in the shrub wall. After
  a night or day, the plants return to their ordinary ways.
tags:
  [power]
  [type:fantascience]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:108]
meta:
  - scope: power
    id: The Sixfold Hexacenter
    note: Listed in album order on VG p.108.
```

```text
title: Blue Lotus
subtitle: Maximum Somatic Contentment
power: 1
range: short, ~5m
target: one creature
duration: an hour
overcharge: Affect a number of creatures equal to your level + 1.
text:
  Soma’s bliss brings contentment to the target (save).
  Success: it loses its next turn to a blissful reverie.
  Failure: it sits down, lost in blissful reverie for an hour.
tags:
  [power]
  [type:fantascience]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:108]
meta:
  - scope: power
    id: The Sixfold Hexacenter
    note: Listed in album order on VG p.108.
```

```text
title: Purple Memories
subtitle: Comic Emotional Display
power: 1
range: touch
target: a creature
duration: several minutes
overcharge: Affect a number of creatures equal to twice your level.
text:
  The target becomes susceptible to influence. The barest word or sensation triggers vivid memories, thoughts, and
  emotions. How could anyone keep thoughts or facts a secret in this state? Or resist a fine, rousing song?
tags:
  [power]
  [type:fantascience]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:108]
meta:
  - scope: power
    id: The Sixfold Hexacenter
    note: Listed in album order on VG p.108.
```

#### The Viridian Practice
> Source: Vastlands Guidebook, p.109.

```text
title: Mother of Bullets
subtitle: Blood Made Lead
power: 1
range: touch
target: anchor weapon
duration: instant
overcharge: The first semi-real projectile to strike a target deals extra damage equal to your level plus the power’s price (2 + level).
text:
  Reloads your weapon as a free action, turning life force into semi-real projectiles.
tags:
  [power]
  [type:oldtech]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:109]
meta:
  - scope: power
    id: The Viridian Practice
    note: Gun monk tradition from VG p.109.
```

```text
title: Dancing In The Hail
subtitle: Dodgebullet
power: 1
range: self
target: self
duration: one round
overcharge: Any ranged attacks that hit deal half damage.
text:
  Reduce your metaphysical “hit box” to the size of your weapon. All ranged attacks against you suffer major
  penalties (i.e. disadvantage).
tags:
  [power]
  [type:oldtech]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:109]
meta:
  - scope: power
    id: The Viridian Practice
    note: Gun monk tradition from VG p.109.
```

```text
title: Ring of Lead
subtitle: Rapid Metal Spin Cycle
power: 1
range: adjacent
target: all creatures
duration: one action
overcharge: No attack roll required.
text:
  Use the buzz saw stance to unload all your ammo at once, attacking every* adjacent creature with one action.
  *subject to how much ammo the anchor weapon holds.
tags:
  [power]
  [type:oldtech]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:109]
meta:
  - scope: power
    id: The Viridian Practice
    note: Gun monk tradition from VG p.109.
```

```text
title: Eyes of the Arrow
subtitle: Panoptic Projectile
power: 1
range: touch
target: one projectile
duration: a minute or so
overcharge: The projectile maneuvers in flight with the agility of a dove.
text:
  Bind a strand of your consciousness to a projectile. It acts like a remote eye (or other sensor).
tags:
  [power]
  [type:oldtech]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:109]
meta:
  - scope: power
    id: The Viridian Practice
    note: Gun monk tradition from VG p.109.
```

```text
title: Counterfire
subtitle: Panoptic Projectile
power: 1
range: a middling hemisphere, ~12m
target: one attack
duration: interrupt
overcharge: The attacker must save or be disarmed.
text:
  Deflect an incoming attack, melee or ranged, with a projectile. Declare counterfire before the attack roll.
tags:
  [power]
  [type:oldtech]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:109]
meta:
  - scope: power
    id: The Viridian Practice
    note: Gun monk tradition from VG p.109.
```

```text
title: Depleted Heavy Metal Rain
subtitle: Bigger Bang
power: 1
range: touch
target: anchor weapon
duration: a few minutes
overcharge: Roll damage dice thrice.
text:
  Imbue your next shot with an inertial error. Roll damage dice twice. The dice also explode.
tags:
  [power]
  [type:oldtech]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:109]
meta:
  - scope: power
    id: The Viridian Practice
    note: Gun monk tradition from VG p.109.
```

#### Dawn’s Highway
> Source: Vastlands Guidebook, p.110.

```text
title: Dampen Mass
subtitle: Nosigoro Logistical Augment
power: 1
range: touch
target: 1 sack
duration: 1 day
overcharge: The mass is halved again. Alternately, it affects an object twice as large, or lasts a week instead.
text:
  A sub-reality field halves the object’s interactive mass. An object of 100 kilos acts like one of fifty.
tags:
  [power]
  [type:ritual]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:110]
meta:
  - scope: power
    id: Dawn’s Highway
    note: Road magic rites from VG p.110.
```

```text
title: Better Pastures
subtitle: Darehodo Patch Choice
power: 1
range: self
target: self
duration: 1 hour
overcharge: Ask a second question or clarify the first.
text:
  Meditate at a crossroads for an hour, observe the flow of its energies, the flight of birds, the waft of milkweed
  seeds. Ask one objective yes / no question of the crossroads, and it shall answer. Will this path reach water
  within 50 miles? Is there green grass along that path within 20 km?
tags:
  [power]
  [type:ritual]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:110]
meta:
  - scope: power
    id: Dawn’s Highway
    note: Road magic rites from VG p.110.
```

```text
title: Wing And Prayer
subtitle: Dirty Fixing
power: 1
range: touch
target: vehicle or steed
duration: 1 day
overcharge: The fix lasts a week; but the damage is even worse after.
text:
  Use your faith to mend an axle or splint a leg. Your vehicle or steed temporarily gains 1d8 life and ignores a
  burden for a day, but then the damage is worse.
tags:
  [power]
  [type:ritual]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:110]
meta:
  - scope: power
    id: Dawn’s Highway
    note: Road magic rites from VG p.110.
```

```text
title: Roadfinder
subtitle: Blacktop Sniffer
power: 1
range: a day’s march
target: self
duration: 1 hour
overcharge: The detection range is doubled, or the sense lasts a day.
text:
  Sniff the world’s road fields, ‘gard the astral way-lines. Detect the nearest road a day’s march or less away.
tags:
  [power]
  [type:ritual]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:110]
meta:
  - scope: power
    id: Dawn’s Highway
    note: Road magic rites from VG p.110.
```

```text
title: Highway Cruiser
subtitle: Foolself Driving
power: 1
range: touch
target: vehicle or steed
duration: 1 day
overcharge: The daemon is capable of more complex maneuvers and adapting to changing road situations, like stopped ambling lancers.
text:
  Summon a driver daemon from the noösphere and bind it to your vehicle or steed for a day. Lo, the chariot now
  drives itself! Hopefully, the daemon understands your language to receive voice commands.
tags:
  [power]
  [type:ritual]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:110]
meta:
  - scope: power
    id: Dawn’s Highway
    note: Road magic rites from VG p.110.
```

```text
title: Roadmaker
subtitle: Stradograd’s Engine of Civility
power: 6
range: one metric mile
target: rock and soil
duration: 1 day
overcharge: The faststone sets into standardstone overnight, creating a surface that lasts a century without maintenance.
text:
  By the channeled powers of the great converter, Chem Caoutchouc, base reality is rearranged. Over a day, a
  faststone road grows from the land, theodolite straight, cambered and elevated, a fortunate 7 meters wide and a
  metric mile long. The road crosses swamps, sways across valleys, and bores tunnels through ridges. Without
  additional fixatives and preparation, the faststone road surface decays in a month.
tags:
  [power]
  [type:ritual]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:110]
meta:
  - scope: power
    id: Dawn’s Highway
    note: Road magic rites from VG p.110.
```

#### Fundamental Purification of the Soil
> Source: Vastlands Guidebook, p.111.

```text
title: Suspended Insight
subtitle: Revelations of Pain
power: 1
range: self
target: thorn tree
duration: 1 hour
overcharge: Gains +2 to an ability score and the answer has a 1-in-4 chance of being immediately helpful.
text:
  The wizard hangs upon a tree of thorns and gains +1 to an ability score for the rest of the day and a cryptic
  answer to a single question asked of the uncaring void. The answer has a 1-in-6 chance of being immediately
  helpful.
tags:
  [power]
  [type:ritual]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:111]
meta:
  - scope: power
    id: Fundamental Purification of the Soil
    note: Tablet rite from VG p.111.
```

```text
title: Thornstone Obelisk
subtitle: Razorblade Tree
power: 3
range: short (10m or so)
target: planted landcoral seed
duration: permanent
overcharge: The growth is even more violent, dealing 6d6 damage to creatures in a small radius and scattering the ground with caltrop-like landcoral shards.
text:
  The petromancer spills their lifeblood, forcing the landcoral seed into sudden, explosive growth. A 5–8 meter tall
  limestone tree erupts from the ground, dealing 2d6 damage to adjacent creatures. Anyone moving through its thicket
  of razor branches suffers 1d4 damage. The speed of growth kills the landcoral.
tags:
  [power]
  [type:ritual]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:111]
meta:
  - scope: power
    id: Fundamental Purification of the Soil
    note: Tablet rite from VG p.111.
```

```text
title: Invoke Ub Dragon
subtitle: Local Reality Error Spark
power: 7
range: here
target: large local area of disturbed reality
duration: permanent
overcharge: You have temporary control of the eater.
text:
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
tags:
  [power]
  [type:ritual]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:111]
meta:
  - scope: power
    id: Fundamental Purification of the Soil
    note: Tablet rite from VG p.111.
```

```text
title: Eyes of Akaula
subtitle: Visions of the Dear Departed
power: 8
range: medium, ~50m
target: self
duration: 1 day
overcharge: The seeker gains a gaze attack that paralyzes the aforementioned things for 1d6 rounds (save).
text:
  The seeker’s eyes glow pale chartreuse and can see things invisible, hidden, departed, and dead.
tags:
  [power]
  [type:ritual]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:111]
meta:
  - scope: power
    id: Fundamental Purification of the Soil
    note: Tablet rite from VG p.111.
```

```text
title: Stoyevod’s Irreducible Crystallization of the Ego Complex
subtitle: Restoration of the Priceless One
power: 17
range: here
target: one dead hero
duration: permanent
overcharge: The hero adds +20 to their relife roll or increases one of their ability scores by 1.
text:
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
tags:
  [power]
  [type:ritual]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:111]
  [attribute:dangerous]
meta:
  - scope: power
    id: Fundamental Purification of the Soil
    note: Tablet rite from VG p.111.
```

```text
title: Akaula's Sacrificial Hero
subtitle: Purification of the Mouth of Hell
power: 21
range: touch
target: chosen hero, large area
duration: permanent
overcharge: The outsiders are destroyed, the gates are broken for decades equal to the hero's level.
text:
  The purifier uses the six sigils of binding to mark a hero to the slaughter. The hero loses 1 life per round. When
  they run out of life, their mind and soul erupt in a blaze of the Maker's fire. The fire banishes all daemons and
  aliens of double the hero's level or less in a 100 meter radius and shuts all dimensional and void gates for a
  number of years equal to the hero's level.
tags:
  [power]
  [type:ritual]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:111]
meta:
  - scope: power
    id: Fundamental Purification of the Soil
    note: Tablet rite from VG p.111.
```

#### Apocrypha of the O.S.
> Source: Vastlands Guidebook, p.112.

```text
title: Can Trip
subtitle: Two Left Feet Curse, Clumsy Cat-astrophe
power: 1
range: a few meters
target: someone who can hear you
duration: instant
overcharge: There’s no save. The target is tripping.
text:
  You wish someone sprawled and humbled, and your muttered curse may make it so. The target’s shoelaces are suddenly
  undone, or a stone or stick hops to trip them. They save or sprawl.
tags:
  [power]
  [type:other]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:112]
meta:
  - scope: power
    id: Apocrypha of the O.S.
    note: Salvaged program from VG p.112.
```

```text
title: Tragic Missile
subtitle: Antipersonnel Guided Force Bolt, Cupid’s Cranial Penetrator
power: 2
range: middling, ~30–50m
target: anything with a mind and soul
duration: instant
overcharge: You visualize three channels at once, striking a single target thrice or three different targets.
text:
  You visualize a channel connecting the ambient energy fields with the ka-ba of an entity you can see. Once you
  release your visualization, the energies strike the entity’s mindspace nexus, like a noöspheric homing missile.
  The painful effect deals 2d4 damage plus 2 per level of the target. The stronger they are, the harder tragedy
  strikes. The missile leaves no mark. Tragic missile cannot affect targets without a mind and soul.
tags:
  [power]
  [type:other]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:112]
meta:
  - scope: power
    id: Apocrypha of the O.S.
    note: Salvaged program from VG p.112.
```

```text
title: Hlod Person
subtitle: Dyslexic Demon’s Binding, Leshnik’s Unforeseen Constriction
power: 4
range: close
target: a person
duration: 1 hour
overcharge: The change is permanent.
text:
  Wave your hand like the six-times folded frond and watch your target become as a log of wood (save). Hard, stiff,
  unmoving, receptive to carpentry.
tags:
  [power]
  [type:other]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:112]
meta:
  - scope: power
    id: Apocrypha of the O.S.
    note: Salvaged program from VG p.112.
```

```text
title: Pyreball
subtitle: Instant Incendiary, Damora’s Placid Inferno
power: 6
range: touch, or as thrown
target: 10m diameter sphere
duration: a day, then instant
overcharge: The ball deals 10d6 damage, or its fires keep for a month.
text:
  You take a ball-sized burning ember from a pyre or bonfire and speak the placatory formulas to trap the entire fire
  within. When the ball strikes a hard surface (or is struck), all the trapped fires suddenly erupt, dealing 5d6
  damage to all creatures caught in its blast radius. An unexploded ball dissipates harmlessly after a day.
tags:
  [power]
  [type:other]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:112]
meta:
  - scope: power
    id: Apocrypha of the O.S.
    note: Salvaged program from VG p.112.
```

```text
title: Nihil Est!
subtitle: Life’s End Made Present, Hadi’s Self-Immolation Binding
power: 8
range: touch
target: a sentient creature
duration: 1 year
overcharge: You age seven years and a kilometer diameter sphere, centered on your soul, disappears into the nothing of wormspace for a year. Overcharge again to remain behind and watch the sphere disappear (please have some form of levitation ready).
text:
  Between one step and the next, you flicker between existence and non-existence, you age a year and a creature you
  touch disappears into the nothing of wormspace for a year. No save.
  Dangerous: No matter how powerful you are.
tags:
  [power]
  [type:other]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:112]
  [attribute:dangerous]
meta:
  - scope: power
    id: Apocrypha of the O.S.
    note: Salvaged program from VG p.112.
```

```text
title: Big Wish
subtitle: Keep on Turning, Supplication of the Perverse Demiurge
power: 18
range: self
target: demiurge
duration: a day, then permanent
overcharge: You get three wishes in a crystal chalice. Drink its sour liquid to summon your demiurge.
text:
  You call upon a demiurge, an echo of the Builders, and command it to grant your wish. The demiurge does its level
  best to misunderstand you, probably because it is an alien from out of time and space.
  The protective circle takes a day to draw, or the power could be dangerous. The summoning itself takes but three
  gestures and one reflective object. Typical wishes (and perversions):
  - "Bring my love back to life." — done, but now she loves another.
  - "Take this cup away from me." — very well, let us give it to your nemesis.
  - "Transport me to a safe place." — you are now in a bank vault, with none of your belongings.
  - "Get us out of this frying pan!" — into the fire you go.
  - "Is this power useless?" — well, it's mostly a joke.
tags:
  [power]
  [type:other]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:112]
meta:
  - scope: power
    id: Apocrypha of the O.S.
    note: Salvaged program from VG p.112.
```

#### Access Noötree
> Source: Vastlands Guidebook, p.113.

```text
title: Access Noötree
subtitle: Localized Spirit Surf
power: 1
range: touch
target: one thinking tree
duration: 10 minutes
overcharge: Gain root-level access to the tree’s source codes and find the mycelial doors that link it to the wider noösphere—Long Ago electronic world fragments, celestial memory palaces, and other micro-realms.
text:
  You unplug from your body and send your spirit-mind (_ka-ba_) into the synthetic dreamspace of a local server tree.
  You can access the tree’s short-term memories, divine announcements, algorithmically generated human-interest
  novelties, and locally hosted offshoot dream realities.
  Useful when the referee has a one shot or other odd dungeon ready. Be careful. Noise and commotion may alert
  functioning guardians (L2d6, electrangelic) to your interventions.
tags:
  [power]
  [type:oldtech]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:113]
meta:
  - scope: power
    id: Access Noötree
    note: Server tree rite from VG p.113.
```

#### Weapon Form Powers
> Source: Vastlands Guidebook 06, p.154.

```text
title: Objective Telekinesis
subtitle: The Bending Fork, Made’s Invisible Hand
power: 1
range: nearby
target: object
duration: a few minutes
overcharge: Stronger than most humans (strength 3), it deals 1d3+3 damage.
text:
  Fragments of your form corrode, sublimate, and become an ectoplasmic hand with which you can caress, hold, crush,
  and discard. It is as strong as a weak human. Punching, it deals 1d3 damage.
tags:
  [power]
  [type:oldtech]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:154]
meta:
  - scope: power
    id: Weapon Form
    note: Granted to every Weapon Form chassis (VG 06 p.154).
```

```text
title: Suspended in the Light
subtitle: Luminous Grasp, Hard Light Hold
power: 1
range: nearby
target: creature or object
duration: instant
overcharge: They suffer 1d8 damage instead.
text:
  You glow, your bearer’s hand glows, the air glows, and you lift your target a handsbreadth off the ground as hard
  light throttles them. They suffer 1d4 damage and lose their next action.
tags:
  [power]
  [type:oldtech]
  [storage:item]
  [source:Vastlands_Guidebook]
  [page:154]
meta:
  - scope: power
    id: Weapon Form
    note: Granted via the Hard Ring form (VG 06 p.154).
```

#### Weapon's Eternal Purpose
> Source: Vastlands Guidebook 06, p.155.

```text
title: Sense Allegiance
subtitle: Doom Purpose — The Evil One Must Fall
power: 2
range: short
target: one creature
duration: instant
overcharge: (not listed)
text:
  You will kill the Evil One. Fortune will bring you to the befouler and your metal shall end that misbegotten one.
  Sense Allegiance: read a creature’s ethics; evil creatures stunned for 1d4 rounds when brushed by your mind (save).
  Object (d6): (1) your bearer, (2) closest friend, (3) born under a thrice-red star, (4) nameless beggar, (5) benevolent prince, (6) local deity most high.
tags:
  [power]
  [type:oldtech]
  [storage:trait]
  [source:Vastlands_Guidebook]
  [page:155]
meta:
  - scope: power
    id: Weapon Form
    note: Eternal Purpose boon from VG 06 p.155.
```

```text
title: Viridian Sun
subtitle: Creation Purpose — Chosen Ones and Quilted Greens
power: 2
range: short
target: one creature
duration: instant
overcharge: spawn photosynth 'humans' (L2).
text:
  You will anoint the Chosen One, bring the new life, translate the places of the machine men into eternal dust.
  Viridian Sun: turn lights green and spawn quilted plants, dreaming trees, mammalian insects, avian arachnids, fungoid gastropods (L1).
  Object (d6): (1) your bearer's sibling, (2) worst enemy, (3) dying old man, (4) wise whale, (5) tyrant's decadent heir, (6) zealous cultist.
tags:
  [power]
  [type:oldtech]
  [storage:trait]
  [source:Vastlands_Guidebook]
  [page:155]
meta:
  - scope: power
    id: Weapon Form
    note: Eternal Purpose boon from VG 06 p.155.
```

```text
title: Caustic Purification
subtitle: Balance Purpose — Scatter the Unnaturals
power: 2
range: short
target: one creature
duration: instant
overcharge: (not listed)
text:
  You are the balance, the fulcrum of the world. Your touch will scatter the unnaturals like air plankton in moonlight.
  Caustic Purification: remove an affliction and a benefit (save); cleanse toxins and life.
  Object (d6): (1) dreamer opening a portal, (2) misunderstood scientist, (3) preacher of dire revolution, (4) adolescent throne-heir, (5) bitter, tragic wizard, (6) mother who loved one timelost.
tags:
  [power]
  [type:oldtech]
  [storage:trait]
  [source:Vastlands_Guidebook]
  [page:155]
meta:
  - scope: power
    id: Weapon Form
    note: Eternal Purpose boon from VG 06 p.155.
```

```text
title: Lay In Wires
subtitle: Preserve Purpose — Maintain the Canopy
power: 2
range: short
target: one creature
duration: instant
overcharge: grants 30 life, target loses 4 life per round.
text:
  You are the agent of Stasis, the upkeeper of the dream, the maintainer of the canopy.
  Lay In Wires: plunge into a creature, granting 10 life while draining 1 life per round for 12 rounds.
  Object (d6): (1) world-eater's bleak city, (2) raveller of creation's seams, (3) forge of peoples' faiths, (4) undying traveler in time, (5) alien uniter of worlds, (6) subservience to the gods.
tags:
  [power]
  [type:oldtech]
  [storage:trait]
  [source:Vastlands_Guidebook]
  [page:155]
meta:
  - scope: power
    id: Weapon Form
    note: Eternal Purpose boon from VG 06 p.155.
```

```text
title: Cut the Sky
subtitle: Devastate Purpose — Planes of Hidden Damage
power: 2
range: short
target: one creature
duration: instant
overcharge: 4d4* damage in a slightly larger area.
text:
  You must keep your true and awesome purpose secret for now. Even from yourself. But it will be great.
  Cut the Sky: barely-visible planes deal 2d4* damage, sever limbs or heads.
  Object (d6): (1) the eater of the sky, (2) gods' secret of life everlasting, (3) innocent breaker of barriers, (4) the one who is and is not, (5) the vile maker of humanity, (6) the child of the angelhunt.
tags:
  [power]
  [type:oldtech]
  [storage:trait]
  [source:Vastlands_Guidebook]
  [page:155]
meta:
  - scope: power
    id: Weapon Form
    note: Eternal Purpose boon from VG 06 p.155.
```

```text
title: Ha-Ka-Ba Short Circuit
subtitle: Error Purpose — Abort/Retry/Fail
power: 2
range: short
target: one creature
duration: instant
overcharge: lasts 1d4 rounds.
text:
  This world was not meant to be. This world was not meant for you and me. This was not was not was.
  Ha-Ka-Ba Short Circuit: target’s soul, mind, and body disconnect for 1 round (save); parts attacked individually gain a bonus.
  Object (d6): (1) the moon detonator, (2) the fountain of white hands, (3) the sun eater, (4) the new star, (5) the eternal mind beyond space, (6) the electric MKR.
tags:
  [power]
  [type:oldtech]
  [storage:trait]
  [source:Vastlands_Guidebook]
  [page:155]
meta:
  - scope: power
    id: Weapon Form
    note: Eternal Purpose boon from VG 06 p.155.
```

#### Access Blessings (Our Golden Age Preview)
> Source: SDM-Our_Golden_Age-Teaser_31, p.4.

```text
title: Access Blessing One — Autosoma
subtitle: Unlock Medical Buildertech, Sacred Pod Charm
power: 2
range: nearby
target: auld meditech
duration: hours
overcharge: The healing oldtech deals damage instead.
text:
  Code daemons in your blood speak to the oldtech and announce you as a hereditary “duck mountain prominence”.
  Control healing machinery without the risk of mutations or degradation. Access suspension capsules. Use cold storage
  as a one-way time machine.
  Note: you can only store this power in human tissue—in yourself (as a trait) or in a suitable anchor, such as the
  mummified hand of Dr. N. A. Vec.
tags:
  [power]
  [type:oldtech]
  [storage:trait]
  [storage:item]
  [source:SDM-Our_Golden_Age-Teaser_31]
  [page:4]
meta:
  - scope: power
    id: Access Blessing One
    note: Autosoma rite from Our Golden Age preview p.4.
```
