# SDM Trait Template

*(Canonical, tag-forward, Markdown-friendly. This section defines the **schema only**. It contains no rules text, examples, or setting-specific guidance.)*

```text
title: <Trait Name>

text:
  <Full canonical trait text, including the bolded title and all rules text, but excluding any numeric list index.>
tags:
  [trait]
  [type:<background|path|corruption|power|mutation|prosthetic|skillpack|other>]
  [path:<Wizard|Fighter|Traveler|…>]        # if applicable
  [pathIndex:<0-6>]                         # if listed in a path table
  [corruption:<mild|moderate|severe>]       # if applicable
  [affects:<attack|defense|save|reaction|inventory|actions|powers|social|…>]
  [uses:<heroDie|life|abilityPoint|item|…>] # resource hooks, if any
  [frequency:<once|per-round|per-scene|…>]  # if relevant
  [inventory:<slot|free|modifies|…>]        # if it alters slot rules
  [source:Vastlands_Guidebook]
  [page:<##>]
  [ref:<stable-id>]
```

---

# All SDM Traits

*(Initial scope: **Vastlands Guidebook only**. This section enumerates canonical traits. Abstract traits describe procedures rather than listing every possible instance.)*

## Background Traits

### Background

```text
title: Background

text:
  **Background.** A Background is an abstract trait representing who you were before (and partly during) your adventures: your origins, professions, social roles, motives, secrets, and formative experiences. In the Vastlands, a Background is intentionally broad and is meant to anchor fictional positioning rather than provide narrow mechanical bonuses.

  Backgrounds are generated procedurally using tables in the Vastlands Guidebook—combining elements such as origin, profession, role, motive, and secret—or agreed upon by the player and referee, and interpreted flexibly at the table.

  Player-facing: Your Background establishes your character’s routine competence and fictional positioning. It tells everyone what kinds of things your character should reasonably know, recognize, or attempt without special justification. When an action clearly falls within your Background and nothing unusual is at stake, the referee may treat it as routine: waiving the roll, lowering the target number, or granting narrative permission outright.

  Referee-facing: Backgrounds should be read generously and used to move play forward. They are permission structures, not straightjackets. When in doubt, let the Background open doors, reveal information, or justify competence rather than restrict action.
tags:
  [trait]
  [type:background]
  [source:Vastlands_Guidebook]
  [page:14]
```

#### Example Backgrounds (Vastlands-style)

- **Wizard of the Dark Electronic Arts, Scholar of the Never-Ended War**
- **Wide-Ranging Merchant and Caravan Trickster with a Coin in Every Sock**
- **Exiled Blue Lands Caravan Guard with a Corrupted Bloodline Secret**
- **Clone-Born Court Servant from a Minor Noble House Who Knows Too Much**

#### Randomly Rolled Backgrounds (Traditional Generator)

*(Procedure followed: roll d40 on the Traditional Background Generator; read across Flavor → Role 1 → Role 2 → Task → Spin.)*

- **Purple Land Therapist–Barista Who Makes Coffee and Makes Peace**
- **Moon Bio‑Mechanic Who Modifies and Creates Living Things**
- **Dead God Scholar of Long Ago Exploring the False Past of Lost Times**

---

## Core Path Traits

### Wizard Path

*(Core Path; titles and metadata captured. Rules text intentionally omitted pending verified transcription.)*

```text
title: Wizard
text:
  **Wizard.** You call yourself a magus, maker, or mechanic. You are skilled at casting spells (using oldtech powers). Perhaps you just know how to read the manuals of Long Ago and the Zero-One codes?
tags:
  [trait]
  [type:path]
  [path:Wizard]
  [pathIndex:0]
  [affects:powers]
  [source:Vastlands_Guidebook]
  [page:16]
```

```text
title: Burner
text:
  **Burner.** Once per turn, you can spend an ability point to overcharge a power, regardless of its cost.
tags:
  [trait]
  [type:path]
  [path:Wizard]
  [pathIndex:1]
  [affects:powers]
  [uses:abilityPoint]
  [frequency:per-turn]
  [source:Vastlands_Guidebook]
  [page:16]
```

```text
title: Chronic
text:
  **Chronic.** Spend a hero die to use a second power this round.
tags:
  [trait]
  [type:path]
  [path:Wizard]
  [pathIndex:2]
  [affects:powers]
  [uses:heroDie]
  [frequency:per-round]
  [source:Vastlands_Guidebook]
  [page:16]
```

```text
title: Exuberant
text:
  **Exuberant.** Each of your life points is worth double when paying for powers.
tags:
  [trait]
  [type:path]
  [path:Wizard]
  [pathIndex:3]
  [affects:powers]
  [source:Vastlands_Guidebook]
  [page:16]
```

```text
title: Mind Palace
text:
  **Mind Palace.** Memorize a number of powers equal to your level for free, ignoring inventory. Draw the memory palace on the back of your character sheet.
tags:
  [trait]
  [type:path]
  [path:Wizard]
  [pathIndex:4]
  [affects:powers]
  [inventory:free]
  [source:Vastlands_Guidebook]
  [page:16]
```

```text
title: Oblique Reality
text:
  **Oblique Reality.** Spend one life or one hero die to deflect a power targeting you (or an adjacent target) to the left or the right (or up or down).
tags:
  [trait]
  [type:path]
  [path:Wizard]
  [pathIndex:5]
  [affects:powers]
  [uses:life]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:16]
```

```text
title: Recast
text:
  **Recast.** When your power fails or a target makes its save, you can use the power again for free. Once. Recharge your recast with a hero die.
tags:
  [trait]
  [type:path]
  [path:Wizard]
  [pathIndex:6]
  [affects:powers]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:16]
```

### Traveler Path

```text
title: Traveler
text:
  **Traveler.** You call yourself a vagabond, a wanderer, the wind. You are skilled at managing a caravan, navigating with maps and stars and waypoints, making and concealing camps, finding water and food, and the etiquette of the vast open lands. You wield the marching staff and the dagger and the traditional rifle.
tags:
  [trait]
  [type:path]
  [path:Traveler]
  [pathIndex:0]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Escapist
text:
  **Escapist.** You’re skilled at being lucky. That’s a +3 bonus to all saves.
tags:
  [trait]
  [type:path]
  [path:Traveler]
  [pathIndex:1]
  [affects:save]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Friends
text:
  **Friends.** You can have a number of pets or sidekicks equal to your level who don’t take up the usual inventory slot. Draw a separate box to list your friends on your character sheet.
tags:
  [trait]
  [type:path]
  [path:Traveler]
  [pathIndex:2]
  [affects:inventory]
  [inventory:free]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Hunter
text:
  **Hunter.** Track, trap, and shoot game with bow, rifle, and javelin. Hide in the wilds, move unseen. When you shoot from ambush, your critical hits deal triple instead of double damage. Expert: x4; master: x5.
tags:
  [trait]
  [type:path]
  [path:Traveler]
  [pathIndex:3]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Pleasant
text:
  **Pleasant.** Charming conversation and an easy demeanor. You get people to like you. That’s +2 to reaction rolls. Expert: +4; master: +6.
tags:
  [trait]
  [type:path]
  [path:Traveler]
  [pathIndex:4]
  [affects:social]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Pocketmaster
text:
  **Pocketmaster.** Conceal a number of small objects equal to your level for free, ignoring inventory. A knife is small.
tags:
  [trait]
  [type:path]
  [path:Traveler]
  [pathIndex:5]
  [affects:inventory]
  [inventory:free]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Swift
text:
  **Swift.** Once per turn, spend one life or one hero die to get one extra action this round.
tags:
  [trait]
  [type:path]
  [path:Traveler]
  [pathIndex:6]
  [affects:actions]
  [uses:life]
  [uses:heroDie]
  [frequency:per-turn]
  [source:Vastlands_Guidebook]
  [page:17]
```

### Fighter Path

```text
title: Fighter
text:
  **Fighter.** You call yourself a warden, warrior, or weaponmaster. You are skilled at using traditional weapons and armors; from knife to sword, blaster to rifle, chitin shield to buffer harness. Also, you are skilled at defense. That’s a +3 bonus to defense and attack. Expert: +6; master: +9.
tags:
  [trait]
  [type:path]
  [path:Fighter]
  [pathIndex:0]
  [affects:attack]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Armiger
text:
  **Armiger.** Carry a number of weapons equal to your level for free, ignoring inventory. Draw a weapons box on the back of your character sheet.
tags:
  [trait]
  [type:path]
  [path:Fighter]
  [pathIndex:1]
  [affects:inventory]
  [inventory:free]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Defender
text:
  **Defender.** You’re skilled at physical defense and all kinds of defensive equipment. Also, even if unarmored, gain a +3 armor bonus. Expert: +6 armor; master: +9 armor.
tags:
  [trait]
  [type:path]
  [path:Fighter]
  [pathIndex:2]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Grit
text:
  **Grit.** Gain 1 life per level and advantage when you roll endurance.
tags:
  [trait]
  [type:path]
  [path:Fighter]
  [pathIndex:3]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Irresistible
text:
  **Irresistible.** Every round you deal damage equal to your level to one foe you attacked, whether your attack roll hit or missed.
tags:
  [trait]
  [type:path]
  [path:Fighter]
  [pathIndex:4]
  [affects:attack]
  [frequency:per-round]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Second Chance
text:
  **Second Chance.** When you would fall to 0 life, you fall to 1 life instead. Once. Recharge second chance with a hero die.
tags:
  [trait]
  [type:path]
  [path:Fighter]
  [pathIndex:5]
  [affects:life]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Terrifying
text:
  **Terrifying.** You’re skilled at frightening people. That’s also a +2 bonus when breaking your foes’ morale. Expert: +4; master: +6.
tags:
  [trait]
  [type:path]
  [path:Fighter]
  [pathIndex:6]
  [affects:social]
  [source:Vastlands_Guidebook]
  [page:17]
```

---

## Other Path Traits

- *Barbarian, Bluelander, Bourgeois, Golem, Greenlander, Holy Fool, Manager,
  Noble, Noömagus, Orangelander, Purplelander, Redlander, Scion, Servant,
  Skeleton, Soldier, Tourist, Trickster, Weapon, Yellowlander*

### Barbarian Path

```text
title: Barbarian
text:
  **Barbarian.** You're an outlander or outsider, skilled with dead weapons and armors, free of oldtech or fantascience. Bone or iron, hide or gun. Also, you can hide, survive, and thrive in ruinland or waste land, dusty steppe or rugged mountain.
tags:
  [trait]
  [type:path]
  [path:Barbarian]
  [pathIndex:0]
  [affects:attack]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:116]
```

```text
title: Antimagus
text:
  **Antimagus.** Your very blood rebels against the false gods' trickery. Gain 2 life per level, but the price you pay for oldtech and fantascience spells is doubled.
tags:
  [trait]
  [type:path]
  [path:Barbarian]
  [pathIndex:1]
  [affects:life]
  [affects:powers]
  [source:Vastlands_Guidebook]
  [page:117]
```

```text
title: Blood Clad
text:
  **Blood Clad.** Gain a blood die when you are injured. Spend a blood die to absorb 1d6 damage or increase your damage by 1d6. You can store a number of blood dice equal to your level. Healing, resting, or a hot bath remove your blood dice.
tags:
  [trait]
  [type:path]
  [path:Barbarian]
  [pathIndex:2]
  [affects:attack]
  [affects:defense]
  [uses:bloodDie]
  [source:Vastlands_Guidebook]
  [page:117]
```

```text
title: Culling
text:
  **Culling.** When you take out an enemy, you get an immediate free action. The referee may cap the number of free actions, if they get out of hand.
tags:
  [trait]
  [type:path]
  [path:Barbarian]
  [pathIndex:3]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:117]
```

```text
title: Feral
text:
  **Feral.** You are not soft like civilization's worms. Your honed intuition protects you from harm. Add aura to your saves and your life total.
tags:
  [trait]
  [type:path]
  [path:Barbarian]
  [pathIndex:4]
  [affects:save]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:117]
```

```text
title: Lost Songs
text:
  **Lost Songs.** Your haunting songs of human resilience inspire your allies and frighten your foes. Spend 1 charisma, hero die, or blood die to grant a 1d8 bonus or penalty to a roll.
tags:
  [trait]
  [type:path]
  [path:Barbarian]
  [pathIndex:5]
  [affects:actions]
  [uses:abilityPoint]
  [uses:heroDie]
  [uses:bloodDie]
  [source:Vastlands_Guidebook]
  [page:117]
```

```text
title: Wild Survivor
text:
  **Wild Survivor.** Forged in the harsh wilderness, you're skilled at guerrilla tactics and using the environment as a weapon. Given several minutes, you can always improvise a d10 weapon from sticks and stones and robot bones. With more time, you can make traps: deadfalls, pits, snares, and more.
tags:
  [trait]
  [type:path]
  [path:Barbarian]
  [pathIndex:6]
  [affects:attack]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:117]
```

### Bluelander Path

```text
title: Bluelander
text:
  **Bluelander.** Child of war and strange gods and ruined land. Skilled on a boat and in a mountain, laced with fungal and bacterial tech. Wield the fisher spear, knife, net, and climbing hook. Also, if you suffer corruption, you can reroll the result.
tags:
  [trait]
  [type:path]
  [path:Bluelander]
  [pathIndex:0]
  [affects:attack]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:118]
```

```text
title: Boatmaster
text:
  **Boatmaster.** You handle boats superlatively. You can fit an extra number of sacks equal to your level on a boat (but not more than double its capacity).
tags:
  [trait]
  [type:path]
  [path:Bluelander]
  [pathIndex:1]
  [affects:inventory]
  [source:Vastlands_Guidebook]
  [page:119]
```

```text
title: Cheesemaker
text:
  **Cheesemaker.** You are a member of the secret dairy society. Talk to molds, yeasts, and bacteria. Little lifeforms bend to your will. Spend 1 life to convert 1 st of biomatter into edible “cheese” overnight.
tags:
  [trait]
  [type:path]
  [path:Bluelander]
  [pathIndex:2]
  [affects:actions]
  [uses:life]
  [source:Vastlands_Guidebook]
  [page:119]
```

```text
title: Oppressed Faith
text:
  **Oppressed Faith.** That you must hide your faith proves its power. It teaches stealth and a guarded tongue. You may publicly invoke one god, while using the power of another.
tags:
  [trait]
  [type:path]
  [path:Bluelander]
  [pathIndex:3]
  [affects:powers]
  [source:Vastlands_Guidebook]
  [page:119]
```

```text
title: Reanimator
text:
  **Reanimator.** Not only learned in the hidden scriptures, you carry sparks of the Once-Living God within you. Spend 1 life to reanimate a hound-sized beast for an hour, more for larger creatures.
tags:
  [trait]
  [type:path]
  [path:Bluelander]
  [pathIndex:4]
  [affects:powers]
  [uses:life]
  [source:Vastlands_Guidebook]
  [page:119]
```

```text
title: Spelunker
text:
  **Spelunker.** Growing up in a mountain drilling, you’ve ventured into deep places. Climbed, rappelled, dived, camped, foraged, marked, and mapped them. Also, gain a bonus when fighting in tight places.
tags:
  [trait]
  [type:path]
  [path:Bluelander]
  [pathIndex:5]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:119]
```

```text
title: Sporemark
text:
  **Sporemark.** The mycelium is within you. You hear the all-fungus. Talk to trees and soil and rotting things. If injuries reduce you to 0 life, spending a day buried in living soil restores you to full health.
tags:
  [trait]
  [type:path]
  [path:Bluelander]
  [pathIndex:6]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:119]
```

### Bourgeois Path

```text
title: Bourgeois
text:
  **Bourgeois.** Citizen creator or conniving climber? Use the tools of civil society: the market in stocks, the hand invisible, the law of bureaucracy, the greased palm effective. Wield stick and sword, pistol and oldtech hand weapon. Also, spend a hero die to convince an official you know your stuff.
tags:
  [trait]
  [type:path]
  [path:Bourgeois]
  [pathIndex:0]
  [affects:attack]
  [affects:social]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:120]
```

```text
title: Double-Platinum Deathless Backup
text:
  **Double-Platinum Deathless Backup.** You've got two soul jewels. One is in an egg in a duck in a hare in a secret pleasure vault on a private island. Hah!
tags:
  [trait]
  [type:path]
  [path:Bourgeois]
  [pathIndex:1]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:121]
```

```text
title: Enterprising
text:
  **Enterprising.** Somehow, you always earn 20% more. It's uncanny. You also know how to set up and shuffle tax-deductible shell charity companies.
tags:
  [trait]
  [type:path]
  [path:Bourgeois]
  [pathIndex:2]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:121]
```

```text
title: Expensive Training
text:
  **Expensive Training.** You had the best trainer, and now you're an expert at one trait, like fencing or vigilante boxing. Once per year, you can spend €1,000 and roll thought. Success: immediately increase a trait's skill (e.g. from skilled to expert).
tags:
  [trait]
  [type:path]
  [path:Bourgeois]
  [pathIndex:3]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:121]
```

```text
title: Legal Immunity
text:
  **Legal Immunity.** Your patrician status buys you many perks: free parking, priority access, open doors, and more. Once per session, you can spend a hero die to make cops and judges look away.
tags:
  [trait]
  [type:path]
  [path:Bourgeois]
  [pathIndex:4]
  [affects:social]
  [uses:heroDie]
  [frequency:per-session]
  [source:Vastlands_Guidebook]
  [page:121]
```

```text
title: Old Money
text:
  **Old Money.** Progenitor refuses to drop their banking and industrial concerns from their cold, undead, reincarnated grasp. Still, you have your name and allowance. Trust fund gives you €25/wk.
tags:
  [trait]
  [type:path]
  [path:Bourgeois]
  [pathIndex:5]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:121]
```

```text
title: Urbane
text:
  **Urbane.** You can go anywhere and talk to anyone in a city. Spend 1 life and there's a secret through-alley, hidden cafe, or safe class-locked portal.
tags:
  [trait]
  [type:path]
  [path:Bourgeois]
  [pathIndex:6]
  [affects:social]
  [uses:life]
  [source:Vastlands_Guidebook]
  [page:121]
```

### Golem Path

```text
title: Golem
text:
  **Golem.** You have made, remade, and unmade yourself. You have a timelost civilian profession, such as tea protocollier or soothstrologist. You become skilled (+3 bonus) in any activity you closely observe for a day, encoding it as a skill lemma stored in an inventory slot. You cannot improve a skill lemma. Removing it takes 10 minutes.
tags:
  [trait]
  [type:path]
  [path:Golem]
  [pathIndex:0]
  [affects:actions]
  [inventory:slot]
  [source:Vastlands_Guidebook]
  [page:122]
```

```text
title: Hardened
text:
  **Hardened.** You're good at avoiding effects that would stun, paralyze, or otherwise incapacitate you. Also, resistant to electromagnificent radiation.
tags:
  [trait]
  [type:path]
  [path:Golem]
  [pathIndex:1]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:123]
```

```text
title: Powered
text:
  **Powered.** You don't need to eat. An omni-battery is all you need. Also, you can jump-start machinery with a spark from your finger.
tags:
  [trait]
  [type:path]
  [path:Golem]
  [pathIndex:2]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:123]
```

```text
title: Synthetic Soul
text:
  **Synthetic Soul.** You have an artificial soul and a backup of your soul on a cassette. You can rewrite the soul as needed. This is really great if you need to modify your biopneumometric identity.
tags:
  [trait]
  [type:path]
  [path:Golem]
  [pathIndex:3]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:123]
```

```text
title: Undying Synthetic
text:
  **Undying Synthetic.** You will not die. But your body decays. Fortunately you know how to repair and replace yourself. Though you've forgotten much, you retain a profound, if eclectic, oral history.
tags:
  [trait]
  [type:path]
  [path:Golem]
  [pathIndex:4]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:123]
```

```text
title: Ur-War Program
text:
  **Ur-War Program.** The legacy of the eternal war is coded within you. Increase your agility by 1 and your unarmed damage dice by one step.
tags:
  [trait]
  [type:path]
  [path:Golem]
  [pathIndex:5]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:123]
```

```text
title: Very Strong
text:
  **Very Strong.** Increase your strength by 2. Ignore normal human limits.
tags:
  [trait]
  [type:path]
  [path:Golem]
  [pathIndex:6]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:123]
```

### Greenlander Path

```text
title: Greenlander
text:
  **Greenlander.** You are the child of industry. Skilled at using civilian oldtech magics and fantascience, commanding golems, controlling vehicles, and supplicating at the temples. You wield oldtech guns and traditional voidship weapons.
tags:
  [trait]
  [type:path]
  [path:Greenlander]
  [pathIndex:0]
  [affects:attack]
  [affects:powers]
  [source:Vastlands_Guidebook]
  [page:124]
```

```text
title: Country Squire
text:
  **Country Squire.** You make money the proper way: resource concessions in the vastlands and the ruinlands. A remote rural estate gives you €15/wk and all the spite olives you can spit.
tags:
  [trait]
  [type:path]
  [path:Greenlander]
  [pathIndex:1]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:125]
```

```text
title: Deeply Embodied
text:
  **Deeply Embodied.** You are deeply encoded in your physical form and can use your strength ability for oldtech magics and endurance for fantascience.
tags:
  [trait]
  [type:path]
  [path:Greenlander]
  [pathIndex:2]
  [affects:powers]
  [source:Vastlands_Guidebook]
  [page:125]
```

```text
title: Informant
text:
  **Informant.** You had the great honor of becoming an unofficial Inquisition agent. You receive €5/wk, and once per session you can spend a hero die to have a misdemeanor overlooked. Sometimes the Inquisition asks for a small favor.
tags:
  [trait]
  [type:path]
  [path:Greenlander]
  [pathIndex:3]
  [affects:social]
  [uses:heroDie]
  [frequency:per-session]
  [source:Vastlands_Guidebook]
  [page:125]
```

```text
title: Metropolitan
text:
  **Metropolitan.** Your civic sense lets you unerringly travel a city's secret ways, and you know how to tap civil nutrient and energy flows for free. Your innate sense of superiority grants you ward +1.
tags:
  [trait]
  [type:path]
  [path:Greenlander]
  [pathIndex:4]
  [affects:actions]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:125]
```

```text
title: Mossblood
text:
  **Mossblood.** Your slowfolk ancestors adapted to the city's hunger by learning to feed on light and rain, mineral and plant-stolen nutrient. You can speak to the plants through their local noöspheres.
tags:
  [trait]
  [type:path]
  [path:Greenlander]
  [pathIndex:5]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:125]
```

```text
title: Soiltwined
text:
  **Soiltwined.** Sprung from the soil itself, you are an ur-peasant, one with this Given World. Barefoot on bare ground, you are wiser and stronger, adding your endurance to thought and strength rolls.
tags:
  [trait]
  [type:path]
  [path:Greenlander]
  [pathIndex:6]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:125]
```

### Holy Fool Path

```text
title: Holy Fool
text:
  **Holy Fool.** You call yourself a prophet, your birth machine calls you a very naughty human. You read dreams, listen to stars, sing to the sea. Also, when you have no relevant skill, you can spend 1 life or ability point to get +1d6 to a single roll.
tags:
  [trait]
  [type:path]
  [path:Holy Fool]
  [pathIndex:0]
  [affects:actions]
  [uses:life]
  [uses:abilityPoint]
  [source:Vastlands_Guidebook]
  [page:126]
```

```text
title: Abandoned
text:
  **Abandoned.** When your fellow villagers went for reprocessing and repair, you remained in the rotting house shells. Old things, dead things, still talk to you. Spend 1 life to talk to any dead thing.
tags:
  [trait]
  [type:path]
  [path:Holy Fool]
  [pathIndex:1]
  [affects:actions]
  [uses:life]
  [source:Vastlands_Guidebook]
  [page:127]
```

```text
title: Blessed
text:
  **Blessed.** When only luck will do, you have an advantage. That's also a bonus to all saves.
tags:
  [trait]
  [type:path]
  [path:Holy Fool]
  [pathIndex:2]
  [affects:save]
  [source:Vastlands_Guidebook]
  [page:127]
```

```text
title: Holy Diver
text:
  **Holy Diver.** Too long you swam in the noösphere, hunting the marrow of forgotten knowledge. At last, the noösphere stared back into you and reworked your mind. You have an intuitive grasp of dreamwalking and dream portals. Spend 1 life to read where a portal leads.
tags:
  [trait]
  [type:path]
  [path:Holy Fool]
  [pathIndex:3]
  [affects:actions]
  [uses:life]
  [source:Vastlands_Guidebook]
  [page:127]
```

```text
title: Phylake’s Child
text:
  **Phylake’s Child.** They say your parent was a witch who seduced a holy guardian—an angel-demon called a phylake by scholars. Daemons talk to you and see you as one of their own.
tags:
  [trait]
  [type:path]
  [path:Holy Fool]
  [pathIndex:4]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:127]
```

```text
title: Soothsayer
text:
  **Soothsayer.** When no one else in a village can read, your interpretation of divine dreams from the ambient hum of the noötrees is invaluable. Grove, glade, mushroom and slime talk to you. Spend 1 life to talk to them.
tags:
  [trait]
  [type:path]
  [path:Holy Fool]
  [pathIndex:5]
  [affects:actions]
  [uses:life]
  [source:Vastlands_Guidebook]
  [page:127]
```

```text
title: Wanderer
text:
  **Wanderer.** One day you walked away from your life. Road years have hardened your feet and softened your heart. Increase your endurance and aura by 1.
tags:
  [trait]
  [type:path]
  [path:Holy Fool]
  [pathIndex:6]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:127]
```

### Manager Path

```text
title: Manager
text:
  **Manager.** An avatar of law, order, and procedure. You navigate forms and traditions, temples and bureaus. You wield the uniform, armor, and tools of your guild. Also, you can spend 1 life to detect if a creature is lying or not (90% accurate).
tags:
  [trait]
  [type:path]
  [path:Manager]
  [pathIndex:0]
  [affects:actions]
  [uses:life]
  [source:Vastlands_Guidebook]
  [page:128]
```

```text
title: Competent Appearance
text:
  **Competent Appearance.** You always appear competent when appearing to do something that could appear to be your job.
tags:
  [trait]
  [type:path]
  [path:Manager]
  [pathIndex:1]
  [affects:social]
  [source:Vastlands_Guidebook]
  [page:129]
```

```text
title: Social Survivor
text:
  **Social Survivor.** Trained to intuit what others want, you can spend 1 life to improve a reaction result.
tags:
  [trait]
  [type:path]
  [path:Manager]
  [pathIndex:2]
  [affects:social]
  [uses:life]
  [source:Vastlands_Guidebook]
  [page:129]
```

```text
title: Inquisition Agent
text:
  **Inquisition Agent.** The Human Authority does not have a secret police force. Such suggestions are illegal. You are certainly not skilled with interrogation techniques, nor possess a license to kill.
tags:
  [trait]
  [type:path]
  [path:Manager]
  [pathIndex:3]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:129]
```

```text
title: Motivational
text:
  **Motivational.** Spend a hero die to encourage a human resource to do what you want. They can refuse, but it costs them 1d6 + level life.
tags:
  [trait]
  [type:path]
  [path:Manager]
  [pathIndex:4]
  [affects:social]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:129]
```

```text
title: Noösphere Priest
text:
  **Noösphere Priest.** You are trained to interface with the noösphere and program its peripherals for maximum user satisfaction. Also, gain a bonus when making sacrifices to the digital gods.
tags:
  [trait]
  [type:path]
  [path:Manager]
  [pathIndex:5]
  [affects:powers]
  [source:Vastlands_Guidebook]
  [page:129]
```

```text
title: Numbers Maximization Official
text:
  **Numbers Maximization Official.** You mastered the popular human game of “numbers go up.” Spend 1 life to add 1d6 to a roll, but the result is your chance of a critical failure on your next roll.
tags:
  [trait]
  [type:path]
  [path:Manager]
  [pathIndex:6]
  [affects:actions]
  [uses:life]
  [source:Vastlands_Guidebook]
  [page:129]
```

### Noble Path

```text
title: Noble
text:
  **Noble.** You were born better. You don’t need to do anything, you just have to be. You are skilled with prestigious weapons and armors, rich with oldtech, imbued with fantascience. Also, spend a hero die to make lower class human see things your way.
tags:
  [trait]
  [type:path]
  [path:Noble]
  [pathIndex:0]
  [affects:attack]
  [affects:social]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:130]
```

```text
title: Hexer Meritocrat
text:
  **Hexer Meritocrat.** Your merit remains superlative. When skilled, your bonus is +4, when expert +8, when a master +12.
tags:
  [trait]
  [type:path]
  [path:Noble]
  [pathIndex:1]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:131]
```

```text
title: Knight Reflexes
text:
  **Knight Reflexes.** Overclocked nerves and glands let you spend life to increase your initiative (1-for-1). Also, gain +1 agility.
tags:
  [trait]
  [type:path]
  [path:Noble]
  [pathIndex:2]
  [affects:actions]
  [uses:life]
  [source:Vastlands_Guidebook]
  [page:131]
```

```text
title: Dissipated
text:
  **Dissipated.** Chemical cocktails drive you, but without them you are weak and wan. Spend €5 x level per week to gain +2 strength and agility. Without: suffer -2 strength and endurance.
tags:
  [trait]
  [type:path]
  [path:Noble]
  [pathIndex:3]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:131]
```

```text
title: Divine Blood
text:
  **Divine Blood.** Little source code machines sing in your veins. Your cost to activate oldtech devices or powers is reduced by 2 (minimum of 1).
tags:
  [trait]
  [type:path]
  [path:Noble]
  [pathIndex:4]
  [affects:powers]
  [source:Vastlands_Guidebook]
  [page:131]
```

```text
title: Sculpted Beauty
text:
  **Sculpted Beauty.** Beyond the germline, you exude synthetic glamour. Gain +2 charisma.
tags:
  [trait]
  [type:path]
  [path:Noble]
  [pathIndex:5]
  [affects:social]
  [source:Vastlands_Guidebook]
  [page:131]
```

```text
title: Perfected Germline
text:
  **Perfected Germline.** Taller and healthier than other humans, you are immune to all diseases and free of all flaws. Allegedly.
tags:
  [trait]
  [type:path]
  [path:Noble]
  [pathIndex:6]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:131]
```

### Noömagus Path

```text
title: Noömagus
text:
  **Noömagus.** You call yourself a neon knight. Rejoice in memetic rituals and wield the powers electric, luminous and daemonic. Use synthetic and luminous weapons. Also, spend a hero die to remember a fact about any unknown item you hold.
tags:
  [trait]
  [type:path]
  [path:Noömagus]
  [pathIndex:0]
  [affects:powers]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:132]
```

```text
title: Cosmic Qanat
text:
  **Cosmic Qanat.** See the lines of cosmic force flowing through the world. Use all powers as though you were 2 levels higher. Reduces risk of corruption!
tags:
  [trait]
  [type:path]
  [path:Noömagus]
  [pathIndex:1]
  [affects:powers]
  [source:Vastlands_Guidebook]
  [page:133]
```

```text
title: Hackmagic
text:
  **Hackmagic.** Hack and modify active powers and oldtech effects. If you recognize a power (a thought test suffices) and it is equal or lower than your level, you can spend its price (in life or hero dice) to wrest control of it for one round. The Cosmic Qanat's increased level applies to the Hackmagic trait.
tags:
  [trait]
  [type:path]
  [path:Noömagus]
  [pathIndex:2]
  [affects:powers]
  [uses:life]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:133]
```

```text
title: Noösphere Native
text:
  **Noösphere Native.** You were born in a generation hooked to the noösphere. You can access and use it, but you also add your skill bonus to all defenses in the noösphere... and against daemons in general.
tags:
  [trait]
  [type:path]
  [path:Noömagus]
  [pathIndex:3]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:133]
```

```text
title: Power Scroller
text:
  **Power Scroller.** You're great at scrolls. You can take a power, prime it, and bind it to a physical object like a business card or napkin with locking glyphs. The scroll is imbued with your life force until someone activates it with the trigger word of your choice. You can spend a hero die to reduce the cost of a power imbued in a scroll by that amount (minimum 1). You can recover imbued life after the scroll is discharged.
tags:
  [trait]
  [type:path]
  [path:Noömagus]
  [pathIndex:4]
  [affects:powers]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:133]
```

```text
title: Soul Fuel
text:
  **Soul Fuel.** Find the _ka_ in all things. Use a nearby friend’s life force to fuel your powers. Also, spend a hero die and 1d4 life to recharge an omnibattery.
tags:
  [trait]
  [type:path]
  [path:Noömagus]
  [pathIndex:5]
  [affects:powers]
  [uses:life]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:133]
```

```text
title: Veteran of the Psychic Wars
text:
  **Veteran of the Psychic Wars.** You fought in the mind-stealer wars with lazgun and vibro machete. Add your bonus to saves against enchantments and mind control. Also, take half damage from ordinary mental blows, but double from mental critical hits.
tags:
  [trait]
  [type:path]
  [path:Noömagus]
  [pathIndex:6]
  [affects:save]
  [source:Vastlands_Guidebook]
  [page:133]
```

### Orangelander Path

```text
title: Orangelander
text:
  **Orangelander.** You should consider yourself happy. Show off your games, arts, musics, and sports. Wield the racket, stick, hunting bow, and death polo lance. Also, spend a hero die to halt nearby undead.
tags:
  [trait]
  [type:path]
  [path:Orangelander]
  [pathIndex:0]
  [affects:attack]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:134]
```

```text
title: Cad
text:
  **Cad.** You are definitely not a cat. Sleek fur protects you from the rays of the harsh suns and the cold of the thin upper air. Your two secondary arms let you carry more ready items.
tags:
  [trait]
  [type:path]
  [path:Orangelander]
  [pathIndex:1]
  [affects:inventory]
  [source:Vastlands_Guidebook]
  [page:135]
```

```text
title: Citizen Living
text:
  **Citizen Living.** Bred to hedonism and maximum pleasure, you are the soul of every party, the wit of every conversation, the glutton of every delight. Gain +1 charisma and endurance.
tags:
  [trait]
  [type:path]
  [path:Orangelander]
  [pathIndex:2]
  [affects:life]
  [affects:social]
  [source:Vastlands_Guidebook]
  [page:135]
```

```text
title: Citizen Maintainer
text:
  **Citizen Maintainer.** Skilled at maintaining the citizens dead. Repair and improve the undead, converse with them, know their ways and needs. Also, a bonus to saves vs all undead special attacks.
tags:
  [trait]
  [type:path]
  [path:Orangelander]
  [pathIndex:3]
  [affects:actions]
  [affects:save]
  [source:Vastlands_Guidebook]
  [page:135]
```

```text
title: Ducky
text:
  **Ducky.** As an underclass minority you know how to fight with concealed weapons and maneuver with ossified bureaucracies. Also, once per day, spend a hero die to 'remember' a reliable local creche clan member who could help you, for a price.
tags:
  [trait]
  [type:path]
  [path:Orangelander]
  [pathIndex:4]
  [affects:actions]
  [uses:heroDie]
  [frequency:per-day]
  [source:Vastlands_Guidebook]
  [page:135]
```

```text
title: Orange Half-Ling
text:
  **Orange Half-Ling.** Your small size reduces your needs and extends your life. You need only a quarter as much food, water, and drink as the average human. Also, gain +1 agility (to a maximum of 6).
tags:
  [trait]
  [type:path]
  [path:Orangelander]
  [pathIndex:5]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:135]
```

```text
title: Unfred
text:
  **Unfred.** Your ancestors rebuilt their brains. You look human, but are immune to human-control effects and your mind counts as alien. Gain +1 endurance.
tags:
  [trait]
  [type:path]
  [path:Orangelander]
  [pathIndex:6]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:135]
```

### Purplelander Path

```text
title: Purplelander
text:
  **Purplelander.** You are a sufficiently advanced magical creation to pass as human. Skilled with telemental and mathempsychic machineries. Wield the tools of the recovered steppes, from bolter to pick. Also, you count as post-human, granting you a +3 bonus against effects that target humans.
tags:
  [trait]
  [type:path]
  [path:Purplelander]
  [pathIndex:0]
  [affects:attack]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:136]
```

```text
title: Arboreal
text:
  **Arboreal.** Your phenotype is adapted to life in the trees—or the bioducts of a megastructure. Climb, swing, and jump like a gibbon. Gain +1 strength.
tags:
  [trait]
  [type:path]
  [path:Purplelander]
  [pathIndex:1]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:137]
```

```text
title: Colonist
text:
  **Colonist.** You come from one of the old A.N.T. settler groups, designed as a colony organism. Designate up to five other creatures as members of your hexad. Each gains temporary life equal to your level if they spend the night in your vicinity. Gain +1 charisma.
tags:
  [trait]
  [type:path]
  [path:Purplelander]
  [pathIndex:2]
  [affects:life]
  [affects:social]
  [source:Vastlands_Guidebook]
  [page:137]
```

```text
title: Human Library
text:
  **Human Library.** A field of Long Long Ago knowledge is stored in your mind. You can only access it subconsciously. Gain +1 thought.
tags:
  [trait]
  [type:path]
  [path:Purplelander]
  [pathIndex:3]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:137]
```

```text
title: Kaffetropist
text:
  **Kaffetropist.** You metabolize caffeine into other useful drugs. Drinking a coffee can put you to sleep, wake you up, purge you of other toxins (lose 1d3 life throwing up), or give you visions (gain ward +5 but your motor skills are impaired).
tags:
  [trait]
  [type:path]
  [path:Purplelander]
  [pathIndex:4]
  [affects:life]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:137]
```

```text
title: Pet Sidekick
text:
  **Pet Sidekick.** You treat the pet as your master. They are the same level as you. You can swap roles, making the pet the PC (generate its ability scores normally). You grasp the thoughts and emotions of creatures similar to the pet. Gain +1 aura.
tags:
  [trait]
  [type:path]
  [path:Purplelander]
  [pathIndex:5]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:137]
```

```text
title: Telempath
text:
  **Telempath.** You can mentally transmit general warnings, feelings, and impressions to other creatures over a middling distance. Gain +1 ward.
tags:
  [trait]
  [type:path]
  [path:Purplelander]
  [pathIndex:6]
  [affects:actions]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:137]
```

### Redlander Path

```text
title: Redlander
text:
  **Redlander.** You are a free, refined, distilled human. Build bunkers, cultivate vines, and seal your mind to lies. Wield divine liberation weapons: cannon and chainsaw, hammer and sickle. Also, armor you wear grants an additional +1 defense per stone.
tags:
  [trait]
  [type:path]
  [path:Redlander]
  [pathIndex:0]
  [affects:attack]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:138]
```

```text
title: Hexad Member
text:
  **Hexad Member.** You belong to a self-help society and know its glyphs and protocols. Your source code has been modified to give you access to its self- defense arsenal. Once per day, spend 1 charisma to find a contact in an industrial district.
tags:
  [trait]
  [type:path]
  [path:Redlander]
  [pathIndex:1]
  [affects:social]
  [uses:abilityPoint]
  [frequency:per-day]
  [source:Vastlands_Guidebook]
  [page:139]
```

```text
title: Falscher
text:
  **Falscher.** You are a false human, grown from seed in an illegal, off-grid factory. This trait gives you false childhood memories and a random occupation that is (roll d6): (1–3) hopelessly outdated, (4–5) surprisingly mundane, (6) terrifying and alien. You have no soul (_ka_) and are immune to mental damage.
tags:
  [trait]
  [type:path]
  [path:Redlander]
  [pathIndex:2]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:139]
```

```text
title: Ruster
text:
  **Ruster.** Almost barbarous in your ability to live off the land, away from the oldtech factories and fabricators. You know how to scavenge food and equipment from wastelands, ruinlands, and another strange post-builder ecosystem of your choice. You are skilled with the bolter, the net, the hook, the army knife, and the camouflage suit.
tags:
  [trait]
  [type:path]
  [path:Redlander]
  [pathIndex:3]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:139]
```

```text
title: Vampire
text:
  **Vampire.** Drain the life force of other creatures to fuel your own powers and abilities. Your target must be willing or immobile. You drain 1 point of life per minute. Draw a "borrowed life" box on your character sheet. Store an amount equal to your own life.
tags:
  [trait]
  [type:path]
  [path:Redlander]
  [pathIndex:4]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:139]
```

```text
title: Vintner
text:
  **Vintner.** Your ancestors modified themselves to survive off-grid, drawing sustenance from the gods' unholy neoflora. You are immune to plant toxins. Drinking a shot of pure ethanol grants you 1 temporary life (up to your level plus endurance). Alcohol is not a plant toxin.
tags:
  [trait]
  [type:path]
  [path:Redlander]
  [pathIndex:5]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:139]
```

```text
title: Werker
text:
  **Werker.** Your ancestors were bioengineered to maintain the builders' machinery. You have an intuitive understanding of oldtech devices and processes. Spend 1 life to interface with a device and ascertain if it can be fixed and, at least roughly, how.
tags:
  [trait]
  [type:path]
  [path:Redlander]
  [pathIndex:6]
  [affects:powers]
  [uses:life]
  [source:Vastlands_Guidebook]
  [page:139]
```

### Scion Path

```text
title: Scion
text:
  **Scion.** You are the child of a divine ancestor. Your blood holds skills and keys to divine powers, ancient customs, and buildertech devices. Spend 1 life to dive into ancestral memories for a fact about the Long Long Ago. Also, spend a hero die to boost an ability score by 1d6 for about an hour.
tags:
  [trait]
  [type:path]
  [path:Scion]
  [pathIndex:0]
  [affects:powers]
  [uses:life]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:140]
```

```text
title: Dreamwalker
text:
  **Dreamwalker.** When you enter the noösphere, you take your body along, leaving nothing but an aroma of almonds in the hylosphere. Gain +1 endurance.
tags:
  [trait]
  [type:path]
  [path:Scion]
  [pathIndex:1]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:141]
```

```text
title: Faceless
text:
  **Faceless.** You have no face and must consciously choose a face each day. When unconscious, your face melts away to reveal a smooth ovoid.
tags:
  [trait]
  [type:path]
  [path:Scion]
  [pathIndex:2]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:141]
```

```text
title: Of-World
text:
  **Of-World.** Your essence is entwined with the source code of the world. Spend 1 hero die to merge with stone or tree or pond or cloud for a few hours.
tags:
  [trait]
  [type:path]
  [path:Scion]
  [pathIndex:3]
  [affects:powers]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:141]
```

```text
title: Perfect
text:
  **Perfect.** Your form is perfect and unchanging, unlike the malleable body natural to humans. Your perfection intimidates and attracts alike. You cannot be corrupted or bio-modified. Gain +1 charisma.
tags:
  [trait]
  [type:path]
  [path:Scion]
  [pathIndex:4]
  [affects:social]
  [source:Vastlands_Guidebook]
  [page:141]
```

```text
title: Subconscious Decay
text:
  **Subconscious Decay.** When you are unconscious or asleep, your physical form rapidly decays. It reconstitutes when you wake. Gain +1 aura.
tags:
  [trait]
  [type:path]
  [path:Scion]
  [pathIndex:5]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:141]
```

```text
title: Superuser
text:
  **Superuser.** You can activate any oldtech or fantascience as a free action—even if you do not have a relevant skill or it is somehow bio- or spirit-locked. The effects may still corrupt you, however.
tags:
  [trait]
  [type:path]
  [path:Scion]
  [pathIndex:6]
  [affects:powers]
  [source:Vastlands_Guidebook]
  [page:141]
```

### Servant Path

```text
title: Servant
text:
  **Servant.** You were born, or made, to serve. You are skilled in a blue collar trade, but also in relations, deceptions, and flatteries. You gain +1 life per point of endurance. Also, spend a hero die to make the higher classes overlook or underestimate you.
tags:
  [trait]
  [type:path]
  [path:Servant]
  [pathIndex:0]
  [affects:life]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:142]
```

```text
title: Grounded
text:
  **Grounded.** A solid life has left you able to shrug off the slings and arrows of outrageous misfortune. Gain +1 aura or thought. Also, remove 1 additional mental burden when you rest.
tags:
  [trait]
  [type:path]
  [path:Servant]
  [pathIndex:1]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:143]
```

```text
title: Housemaker
text:
  **Housemaker.** Nothing makes humans happier than nests. Thus humans make their own homes: building, wiring, plumbing, repairing. Spend a hero die to find a useful air duct or sewer connection between two rooms or adjacent buildings.
tags:
  [trait]
  [type:path]
  [path:Servant]
  [pathIndex:2]
  [affects:actions]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:143]
```

```text
title: Resourceful
text:
  **Resourceful.** A lifetime in the shadows has taught you how to borrow and misappropriate with aplomb. When visiting a building for the first time, you can spend 1 life to walk away with a useful item.
tags:
  [trait]
  [type:path]
  [path:Servant]
  [pathIndex:3]
  [affects:inventory]
  [uses:life]
  [source:Vastlands_Guidebook]
  [page:143]
```

```text
title: Shopstaff
text:
  **Shopstaff.** Grown and bred to a service role, you make people feel comfortable around you. Spend 1 charisma to make a human more friendly (a hostile foe calms down, a surly fellow becomes helpful).
tags:
  [trait]
  [type:path]
  [path:Servant]
  [pathIndex:4]
  [affects:social]
  [uses:abilityPoint]
  [source:Vastlands_Guidebook]
  [page:143]
```

```text
title: Strong
text:
  **Strong.** A life of labor and the good diet provided by the establishment has given you a powerful physique. Gain +2 strength or endurance.
tags:
  [trait]
  [type:path]
  [path:Servant]
  [pathIndex:5]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:143]
```

```text
title: Tough
text:
  **Tough.** Your hard life means you can take more punishment than most humans. Each day, you wake up with 1d6 + level temporary punishment points. These absorb physical damage, but cannot fuel powers or traits.
tags:
  [trait]
  [type:path]
  [path:Servant]
  [pathIndex:6]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:143]
```

### Skeleton Path

```text
title: Skeleton
text:
  **Skeleton.** You were dead. Now you are un. A dread force animates you. You need no food, water, air or sleep. You speak, though you have no larynx. You take minimum damage from piercing attacks and half from slashing, but double from blunt. Also, you are skilled in a timelost weapon.
tags:
  [trait]
  [type:path]
  [path:Skeleton]
  [pathIndex:0]
  [affects:defense]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:144]
```

```text
title: Glowing Skeleton
text:
  **Glowing Skeleton.** Cast of your heavy boots of lead, your rubbered suit, your hazard gloves. Let them see your radioactive bones. You are resistant to radiant damage and corruption. When unclothed, adjacent creatures lose life equal to your level each round.
tags:
  [trait]
  [type:path]
  [path:Skeleton]
  [pathIndex:1]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:145]
```

```text
title: My Bones Engraved
text:
  **My Bones Engraved.** You spoke to the keeper of thoughts, who gave you a magic chisel to engrave your bones. Gain five bone inventory slots for powers on your arms, legs, and skull. Engraving a power takes a day. Replacing an engraved power permanently reduces your endurance by 1 unless you also ritually replace your bones (ouch).
tags:
  [trait]
  [type:path]
  [path:Skeleton]
  [pathIndex:2]
  [affects:inventory]
  [inventory:slot]
  [source:Vastlands_Guidebook]
  [page:145]
```

```text
title: Void Ward
text:
  **Void Ward.** The emptiness of your soul protects you. Add aura to your defense.
tags:
  [trait]
  [type:path]
  [path:Skeleton]
  [pathIndex:3]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:145]
```

```text
title: From Dust, Returning
text:
  **From Dust, Returning.** Your link to the world is stronger than ever. Even if crushed to dust, when your remains taste a sprinkle of (roll d6): (1) holy water, (2) blood, (3) wine, (4) tomato soup, (5) milk, or (6) nectar, your body reforms itself in a week.
tags:
  [trait]
  [type:path]
  [path:Skeleton]
  [pathIndex:4]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:145]
```

```text
title: Cold New Flesh
text:
  **Cold New Flesh.** Your flesh is as semi-precious stone. You gain +1 natural defense, and by drinking fresh blood you transfer life from a willing creature to yourself. A bit like, er, a vampire?
tags:
  [trait]
  [type:path]
  [path:Skeleton]
  [pathIndex:5]
  [affects:defense]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:145]
```

```text
title: Soul Thief
text:
  **Soul Thief.** When a nearby creature is reduced to 0 life, you can steal a little of its soul and gain 1d4 life. This reduces one of its other attributes to 0.
tags:
  [trait]
  [type:path]
  [path:Skeleton]
  [pathIndex:6]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:145]
```

### Soldier Path

```text
title: Soldier
text:
  **Soldier.** You served in the not-wars at the edge of time. You know the weapons and armors of regulation; wandgun and shield, blade and combat suit. You gain +2 defense (+4 at expert, +6 at master). Also, when an ally stands next to you, they add your charisma to their defense score.
tags:
  [trait]
  [type:path]
  [path:Soldier]
  [pathIndex:0]
  [affects:attack]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:146]
```

```text
title: Armorborn
text:
  **Armorborn.** Any armor you wear occupies no inventory space. Armor gives you a defense bonus equal to its size in stones.
tags:
  [trait]
  [type:path]
  [path:Soldier]
  [pathIndex:1]
  [affects:defense]
  [inventory:free]
  [source:Vastlands_Guidebook]
  [page:147]
```

```text
title: Blastermaster
text:
  **Blastermaster.** You are skilled with the blasters, wands, rods, and rifles of ancient thunder infantry. Add your skill bonus to damage; reload as a free action. Also, if you take an action to steady your aim, increase your critical range and multiplier by 1.
tags:
  [trait]
  [type:path]
  [path:Soldier]
  [pathIndex:2]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:147]
```

```text
title: Devastator
text:
  **Devastator.** Once per round, when you strike a foe lower level than yourself, you can drop them to 0 life instead of rolling damage.
tags:
  [trait]
  [type:path]
  [path:Soldier]
  [pathIndex:3]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:147]
```

```text
title: Rationalised
text:
  **Rationalised.** Hard-wired panic immunity. Add your strength or endurance to your ward score.
tags:
  [trait]
  [type:path]
  [path:Soldier]
  [pathIndex:4]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:147]
```

```text
title: Slayer
text:
  **Slayer.** Once per round, double your attack and damage modifiers against a foe of your level or higher.
tags:
  [trait]
  [type:path]
  [path:Soldier]
  [pathIndex:5]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:147]
```

```text
title: Wired
text:
  **Wired.** Your body is modified to secrete uppers and downers on demand. As a free action, spend 1 life to get a +2 bonus on initiative rolls, 2 life to gain a bonus action, or 3 life to recover an ability point.
tags:
  [trait]
  [type:path]
  [path:Soldier]
  [pathIndex:6]
  [affects:actions]
  [uses:life]
  [source:Vastlands_Guidebook]
  [page:147]
```

### Tourist Path

```text
title: Tourist
text:
  **Tourist.** You are not from around here. Stumble into places you shouldn’t be. Visit sights meant to be hidden. By accident, of course. Wield the book, stick, and umbrella. Also, spend a hero die to enter a sealed or locked place.
tags:
  [trait]
  [type:path]
  [path:Tourist]
  [pathIndex:0]
  [affects:actions]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:148]
```

```text
title: Personal Daimon
text:
  **Personal Daimon.** Nimbic essence of a goldenager from the farthest times, where future and past meet. It knows strange histories and, once per session, lets you narrate a surprise twist or discovery ("there was an extra battery in the empty suitcase!"). The referee has a soft veto if something is far too silly.
tags:
  [trait]
  [type:path]
  [path:Tourist]
  [pathIndex:1]
  [affects:actions]
  [frequency:per-session]
  [source:Vastlands_Guidebook]
  [page:149]
```

```text
title: Clueless Outsider
text:
  **Clueless Outsider.** Caught red-handed? Trespassing? Spend a hero die, and you're let off with a warning and an indulgent grin.
tags:
  [trait]
  [type:path]
  [path:Tourist]
  [pathIndex:2]
  [affects:social]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:149]
```

```text
title: Fortunate One
text:
  **Fortunate One.** When you roll a natural 1, roll again. Or, accept the natural 1 and save a reroll for later in the session. The reroll occupies an inventory slot.
tags:
  [trait]
  [type:path]
  [path:Tourist]
  [pathIndex:3]
  [affects:actions]
  [inventory:slot]
  [source:Vastlands_Guidebook]
  [page:149]
```

```text
title: Underestimated
text:
  **Underestimated.** Nobody ever targets you first. Folks are always surprised by your first attack.
tags:
  [trait]
  [type:path]
  [path:Tourist]
  [pathIndex:4]
  [affects:defense]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:149]
```

```text
title: Intestinal Fortitude
text:
  **Intestinal Fortitude.** Once per session, restore one attribute completely. Right now. Just like that. Also, once per session, you can spend a hero die to overcome an ingested poison or a fear effect.
tags:
  [trait]
  [type:path]
  [path:Tourist]
  [pathIndex:5]
  [affects:actions]
  [uses:heroDie]
  [frequency:per-session]
  [source:Vastlands_Guidebook]
  [page:149]
```

```text
title: Hashtag Blessed
text:
  **Hashtag Blessed.** Every time you visit a new place, gain a tourist die. It works like a hero die. You can hold a number equal to your charisma.
tags:
  [trait]
  [type:path]
  [path:Tourist]
  [pathIndex:6]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:149]
```

### Trickster Path

```text
title: Trickster
text:
  **Trickster.** Call yourself wind, dawn, and sun. Practice linguistic tricks, technomagical illusions, and gymnosophic techniques. Spend a hero die and someone you tricked thinks you helped them.
tags:
  [trait]
  [type:path]
  [path:Trickster]
  [pathIndex:0]
  [affects:actions]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:150]
```

```text
title: Backstabber
text:
  **Backstabber.** Wield knives and pistols. Deal double damage when a target doesn’t expect your attack.
tags:
  [trait]
  [type:path]
  [path:Trickster]
  [pathIndex:1]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:151]
```

```text
title: Expert Friends
text:
  **Expert Friends.** You know where to find skilled help and how to inspire people. Each pet or sidekick is an expert at one thing. That’s a +6 bonus.
tags:
  [trait]
  [type:path]
  [path:Trickster]
  [pathIndex:2]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:151]
```

```text
title: Fake Out
text:
  **Fake Out.** You know how to hide and lie low when needed. Reduced to 0 life? Spend a hero die, and that last blow didn’t connect.
tags:
  [trait]
  [type:path]
  [path:Trickster]
  [pathIndex:3]
  [affects:life]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:151]
```

```text
title: Pickpocket
text:
  **Pickpocket.** Skilled at sneaky stealing. Failed your roll? Save and no one noticed.
tags:
  [trait]
  [type:path]
  [path:Trickster]
  [pathIndex:4]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:151]
```

```text
title: Bystander
text:
  **Bystander.** You’re good at looking innocent and harmless. Also, reduce damage from all area effects by your level. So, by 6 at level 6.
tags:
  [trait]
  [type:path]
  [path:Trickster]
  [pathIndex:5]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:151]
```

```text
title: Silver-Tongued
text:
  **Silver-Tongued.** You could (and do) talk the scales off a dragon. Spend a hero die and a creature believes you, no roll required.
tags:
  [trait]
  [type:path]
  [path:Trickster]
  [pathIndex:6]
  [affects:social]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:151]
```

### Weapon Path

```text
title: Weapon
text:
  **Weapon.** You were made. You know that. You did not awake to consciousness. You are not even sure if you are conscious. Before, there was nothing. No you. No world. Now you see the world. You respond to stimuli. You effect your will upon the cosmos. Who made you? God? Demon? Wizard? Accident? You simply feel their mark upon you. Maker.
tags:
  [trait]
  [type:path]
  [path:Weapon]
  [pathIndex:0]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:152]
```

```text
title: Cleanser
text:
  **Cleanser.** Spend 1 charisma or 1d6 life to end another power or enchantment. Poof, it’s gone. Also, you can spend a hero die to instantly cleanse a small area: a stagnant pool of bacteria, a kitchen of dirty dishes, a bedroom of smelly socks, a car of dust, or a shrine of unholy curses and graffiti.
tags:
  [trait]
  [type:path]
  [path:Weapon]
  [pathIndex:1]
  [affects:powers]
  [uses:abilityPoint]
  [uses:life]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:153]
```

```text
title: Curse-Blessed
text:
  **Curse-Blessed.** A thinking creature (animal or person) cannot throw you away without your permission. They own you now, and that means you belong to them. Forever and ever, until you let them go. Or someone removes your curse... er... blessing... somehow. It’s best to keep your bearer happy, so they don’t try to have you removed. Maybe a few lies about their destiny? Also, you can communicate with any creature that is touching you telepathically and exude a mild mental sedative, which keeps them pliant and helpful in ordinary circumstances.
tags:
  [trait]
  [type:path]
  [path:Weapon]
  [pathIndex:2]
  [affects:social]
  [source:Vastlands_Guidebook]
  [page:153]
```

```text
title: Death Hunger
text:
  **Death Hunger.** You know everything about disassembling mortals. Also, track the enemies you kill in a battle. Every enemy killed gives you a cumulative +1 to attack rolls until the end of the battle. After the first kill, you growl and roar until the killing stops. Expert: the bonus is +2 per kill. Master: +3.
tags:
  [trait]
  [type:path]
  [path:Weapon]
  [pathIndex:3]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:153]
```

```text
title: Demolisher
text:
  **Demolisher.** Your critical hits are stronger (e.g., x2 becomes x3). Also, when you strike an object up to the size of a compact car, you can spend 1 strength or endurance to simply demolish it. Doors burst open, brick walls explode, wooden walls shatter into kindling, straw huts go flying, small golems crumple. You can also use this ability to turn a regular hit into a critical hit, or to double a critical hit. As a weapon (without strength or endurance), simply use your bearer’s abilities as fuel for your fury.
tags:
  [trait]
  [type:path]
  [path:Weapon]
  [pathIndex:4]
  [affects:attack]
  [uses:abilityPoint]
  [source:Vastlands_Guidebook]
  [page:153]
```

```text
title: Fatespun
text:
  **Fatespun.** You are a magic item and any form of magic detection shows as much. You are incredibly durable for an object. Indeed, truly destroying you requires a quest: a special ritual, a special place, and a special time. Write the quest down, if you like. If you are physically destroyed (by running out of life, for example) or thrown away (e.g. into a lake, a deep ocean, a void portal) you reappear somewhere, close to your bearer or close to a potential new bearer, at a narratively opportune time (or in 2d4 weeks).
tags:
  [trait]
  [type:path]
  [path:Weapon]
  [pathIndex:5]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:153]
```

```text
title: I Am Legion
text:
  **I Am Legion.** You know everything about armies. Also, track the enemies you kill in a battle. Every enemy killed gives you a cumulative bonus of +1 damage until the end of the battle. After the first kill, blood gushes from you until the killing stops. Expert: the bonus is +2 per kill. Master: +3.
tags:
  [trait]
  [type:path]
  [path:Weapon]
  [pathIndex:6]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:153]
```

```text
title: Burglar
text:
  **Burglar.** You were always so good at breaking into and out of places, disarming locks and traps, and moving very quietly. You were the perfect person to save your weapon (your master) from its prison... er... treasure chamber. Also, spend a hero die to immediately find a hidden safe or lever.
tags:
  [trait]
  [type:path]
  [path:Bearer]
  [pathIndex:1]
  [affects:actions]
  [uses:heroDie]
  [source:Vastlands_Guidebook]
  [page:157]
```

```text
title: Doombringer
text:
  **Doombringer.** Yours is the grim hand of fate. When you strike a creature that is lower level than your weapon (your master), it is immediately defeated, no damage roll required.
tags:
  [trait]
  [type:path]
  [path:Bearer]
  [pathIndex:2]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:157]
```

```text
title: Fighting Woman or Man
text:
  **Fighting Woman or Man.** You are skilled with your weapon (your master) and weapons like it. Once per round, as a single action, you can attack a number of adjacent level 0–1 foes equal to your level.
tags:
  [trait]
  [type:path]
  [path:Bearer]
  [pathIndex:3]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:157]
```

```text
title: Loyal
text:
  **Loyal.** You never betray your friends (or master), and would suffer torture and tribulation for them without fear. Once per scene, when you sacrifice your own best interests to prove your loyalty, you immediately gain a hero die. Also, gain +1 ward.
tags:
  [trait]
  [type:path]
  [path:Bearer]
  [pathIndex:4]
  [affects:social]
  [uses:heroDie]
  [frequency:per-scene]
  [source:Vastlands_Guidebook]
  [page:157]
```

```text
title: Revenant-in-Waiting
text:
  **Revenant-in-Waiting.** When you die, your weapon (your master) may choose to revive you by reducing one of your ability scores by 1. Each time you return, you are a little less human, a little more dead. When all your scores are reduced to 0, you are your weapon's shambling corpse slave.
tags:
  [trait]
  [type:path]
  [path:Bearer]
  [pathIndex:5]
  [affects:life]
  [source:Vastlands_Guidebook]
  [page:157]
```

```text
title: Shackleminded
text:
  **Shackleminded.** Your brain has been augmented with glyph-scribed nails and holy wires immunizing you against mental attacks, psychic effects, and individual initiative. Gain +2 ward and +1 endurance, but lose -1 thought.
tags:
  [trait]
  [type:path]
  [path:Bearer]
  [pathIndex:6]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:157]
```

### Yellowlander Path

```text
title: Yellowlander
text:
  **Yellowlander.** You are a merchant, a maintainer, a mercenary. Bargain and appraise, repair and juryrig, extort and betray. Wield bow and spear, bola, lasso and garotte. Also, spend an ability point to run away from a fight safely.
tags:
  [trait]
  [type:path]
  [path:Yellowlander]
  [pathIndex:0]
  [affects:actions]
  [uses:abilityPoint]
  [source:Vastlands_Guidebook]
  [page:158]
```

```text
title: Diesel Dwarf
text:
  **Diesel Dwarf.** Your ancestors were adapted to serve the gods as wasteland refiners, recycling Long Long Ago corpse deposits for a brighter future. Besides a natural engineering, driving, and drilling affinity, you can replace your food needs with petroleum products for up to a month. Gain 1 agility.
tags:
  [trait]
  [type:path]
  [path:Yellowlander]
  [pathIndex:1]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:159]
```

```text
title: Dust Rat
text:
  **Dust Rat.** Adapted to the dry land, you require half as much water as a normal human. Gain 1 endurance. Also, you know your way around arid biomes.
tags:
  [trait]
  [type:path]
  [path:Yellowlander]
  [pathIndex:2]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:159]
```

```text
title: Rancher
text:
  **Rancher.** You know how to keep herds well-oiled and charged, manage shepherds and dogs, ride solar steeds, spot water holes, and rustle burden beasts. Gain 1 strength or charisma.
tags:
  [trait]
  [type:path]
  [path:Yellowlander]
  [pathIndex:3]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:159]
```

```text
title: Ruderalist
text:
  **Ruderalist.** Garden in the oldtech ruins, distinguish holograms from hollow eaters, and navigate the dangers of oldtech by intuition and tradition. Wield electric and magnetic weapons. Gain 1 thought.
tags:
  [trait]
  [type:path]
  [path:Yellowlander]
  [pathIndex:4]
  [affects:actions]
  [source:Vastlands_Guidebook]
  [page:159]
```

```text
title: Saffron Eater
text:
  **Saffron Eater.** Long exposure to exotic poisons and potions has turned your skin bright yellow and made you resistant to most toxins. Gain 1 aura and a bonus to avoid becoming addicted.
tags:
  [trait]
  [type:path]
  [path:Yellowlander]
  [pathIndex:5]
  [affects:defense]
  [source:Vastlands_Guidebook]
  [page:159]
```

```text
title: Thorny
text:
  **Thorny.** Your skin is leathery and covered in spiny growths. You require half as much water as a normal human and gain +1 natural armor. Deal double damage when grappling.
tags:
  [trait]
  [type:path]
  [path:Yellowlander]
  [pathIndex:6]
  [affects:defense]
  [affects:attack]
  [source:Vastlands_Guidebook]
  [page:159]
```

---

## Traits of the Vastlands

*(Non-abstract, enumerated traits primarily used for NPCs, creatures,
 factions, and synthesized entities. These traits follow the same canonical
 template as Path traits but are not restricted to player characters.)*

- *NPC Traits from **NPCs of the Vastlands** and related sections
  (starting p.167), pending enumeration*

---

## Corruption Traits

*(Abstract trait category; individual corruptions are generated procedurally.)*

- *Mild Corruption Traits (table-based)*
- *Moderate Corruption Traits (table-based)*
- *Severe Corruption Traits (table-based)*

---

## Power-as-Trait References

*(Abstract trait category; individual powers are defined elsewhere.)*

- *Powers that explicitly occupy trait slots (to be cross-linked later)*
