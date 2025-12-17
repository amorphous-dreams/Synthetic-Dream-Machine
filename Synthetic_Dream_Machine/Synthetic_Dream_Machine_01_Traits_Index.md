# SDM Trait Template

*(Canonical, tag-forward, Markdown-friendly. This section defines the **schema only**. It contains no rules text, examples, or setting-specific guidance.)*

```text
title: <Trait Name>

text:
  <Full canonical trait text, including the bolded title and all rules text,
   but excluding any numeric list index.>

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
  **Background.** A Background is an abstract trait representing who you were
  before (and partly during) your adventures: your origins, professions,
  social roles, motives, secrets, and formative experiences. In the Vastlands,
  a Background is intentionally broad and is meant to anchor fictional
  positioning rather than provide narrow mechanical bonuses.

  Backgrounds are generated procedurally using tables in the Vastlands
  Guidebook—combining elements such as origin, profession, role, motive,
  and secret—or agreed upon by the player and referee, and interpreted
  flexibly at the table.

  Player-facing: Your Background establishes your character’s routine
  competence and fictional positioning. It tells everyone what kinds of
  things your character should reasonably know, recognize, or attempt
  without special justification. When an action clearly falls within your
  Background and nothing unusual is at stake, the referee may treat it as
  routine: waiving the roll, lowering the target number, or granting
  narrative permission outright.

  Referee-facing: Backgrounds should be read generously and used to move
  play forward. They are permission structures, not straightjackets. When
  in doubt, let the Background open doors, reveal information, or justify
  competence rather than restrict action.

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
tags:
  [trait]
  [type:path]
  [path:Wizard]
  [pathIndex:0]
  [source:Vastlands_Guidebook]
  [page:16]
```

```text
title: Burner
text:
tags:
  [trait]
  [type:path]
  [path:Wizard]
  [pathIndex:1]
  [source:Vastlands_Guidebook]
  [page:16]
```

```text
title: Chronic
text:
tags:
  [trait]
  [type:path]
  [path:Wizard]
  [pathIndex:2]
  [source:Vastlands_Guidebook]
  [page:16]
```

```text
title: Exuberant
text:
tags:
  [trait]
  [type:path]
  [path:Wizard]
  [pathIndex:3]
  [source:Vastlands_Guidebook]
  [page:16]
```

```text
title: Mind Palace
text:
tags:
  [trait]
  [type:path]
  [path:Wizard]
  [pathIndex:4]
  [source:Vastlands_Guidebook]
  [page:16]
```

```text
title: Oblique Reality
text:
tags:
  [trait]
  [type:path]
  [path:Wizard]
  [pathIndex:5]
  [source:Vastlands_Guidebook]
  [page:16]
```

```text
title: Recast
text:
tags:
  [trait]
  [type:path]
  [path:Wizard]
  [pathIndex:6]
  [source:Vastlands_Guidebook]
  [page:16]
```

### Traveler Path

```text
title: Traveler
text:
tags:
  [trait]
  [type:path]
  [path:Traveler]
  [pathIndex:0]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Escapist
text:
tags:
  [trait]
  [type:path]
  [path:Traveler]
  [pathIndex:1]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Friends
text:
tags:
  [trait]
  [type:path]
  [path:Traveler]
  [pathIndex:2]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Hunter
text:
tags:
  [trait]
  [type:path]
  [path:Traveler]
  [pathIndex:3]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Pleasant
text:
tags:
  [trait]
  [type:path]
  [path:Traveler]
  [pathIndex:4]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Pocketmaster
text:
tags:
  [trait]
  [type:path]
  [path:Traveler]
  [pathIndex:5]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Swift
text:
tags:
  [trait]
  [type:path]
  [path:Traveler]
  [pathIndex:6]
  [source:Vastlands_Guidebook]
  [page:17]
```

### Fighter Path

```text
title: Fighter
text:
tags:
  [trait]
  [type:path]
  [path:Fighter]
  [pathIndex:0]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Armored
text:
tags:
  [trait]
  [type:path]
  [path:Fighter]
  [pathIndex:1]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Cleave
text:
tags:
  [trait]
  [type:path]
  [path:Fighter]
  [pathIndex:2]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Duelist
text:
tags:
  [trait]
  [type:path]
  [path:Fighter]
  [pathIndex:3]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Formation
text:
tags:
  [trait]
  [type:path]
  [path:Fighter]
  [pathIndex:4]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Leader
text:
tags:
  [trait]
  [type:path]
  [path:Fighter]
  [pathIndex:5]
  [source:Vastlands_Guidebook]
  [page:17]
```

```text
title: Shieldbearer
text:
tags:
  [trait]
  [type:path]
  [path:Fighter]
  [pathIndex:6]
  [source:Vastlands_Guidebook]
  [page:17]
```

---

## Other Path Traits

- *Barbarian, Bluelander, Bourgeois, Golem, Greenlander, Holy Fool, Manager,
  Noble, Noömagus, Orangelander, Purplelander, Redlander, Scion, Servant,
  Skeleton, Soldier, Tourist, Trickster, Weapon, Yellowlander*

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

