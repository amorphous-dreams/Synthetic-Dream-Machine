# Vancian vs SDM Mechanics Research

## Confirmed Differences (Canon from local docs)

### Access Model
- **Vancian**: Daily preparation; classes gate spells available and grant abstract "Spell slots" with "spell level" ratings, spells must be memorized/selected each day in these specific level-based slots
- **SDM**: No class gating (in-world/story gating), no preparation; powers held as trait/item/burden slots, accessible on-demand

[Canon: Synthetic_Dream_Machine_01_Quickstart.md -> "Powers and Spells"]
[Canon: Vastlands_Guidebook.md -> "Using Powers"]

### Cost Model
- **Vancian**: Spell slot consumption (expended 1x per use per day)
- **SDM**: Life/mana cost (P:X = X life per use, usable repeatedly from same source), Life from the caster is the primary method, mana from stored sources can be an option, as well as Life from friends, "stolen" Life pools, etc

[Canon: Synthetic_Dream_Machine_01_Quickstart.md -> "Powers and Spells"]
[Canon: Vastlands_Guidebook.md -> "Activating Powers"]

### Storage Model
- **Vancian**: Spellbook (written spells) + memory (prepared spells) + ritual targets (some cleric spells)
- **SDM**: Trait slots (Ba "Psyche", and Ka "Soul" slots), Item slots (Ha "Body" physical/device-based), Burden slots (Trait/Gear overflow, afflictions/curses), Structure/Location (installed in gear/vehicles/infrastructure/etc)

[Canon: Synthetic_Dream_Machine_04_Powers_Index.md -> "Usage Notes" + storage tags]
[Canon: Vastlands_Guidebook.md -> "Storing Powers"]

### Learning Model
- **Vancian**: Wizards have "spells known" limit (typically tied to level); can copy new spells to spellbook, other classes had other gates
- **SDM**: Any character can use any power if they have access to it (no learning gate), but skills/traits reduce danger. Path traits (skills) grant proficienty in MAgitech, Fantascience, Both, or Other Specialties (we use the tag system)

[Canon: Vastlands_Guidebook.md -> "Skills and Powers"]

### Inventory Semantics
- **Vancian**: Orthogonal systems (spell slots separate from inventory; spell levels 1–9 fixed by class)
- **SDM**: **Unified inventory model**: 7 + STR item slots, 7 + Thought score trait slots for character concepts, 20 burden slots; powers occupy trait OR item slot (not separate, may even be a Burden if cursed, etc) + [storage: burden/structure/location] variants. Vehicles and other "entities" can also have Powers. Some rare Powers take up more than one slot.

[Canon: Synthetic_Dream_Machine_01_Quickstart.md -> "Item and Trait Overflow"]

## Likely-but-Inferred Differences

### Power Complexity Scaling
- **Vancian**: Spell level (1–9) gates access; higher levels require higher caster level
- **SDM**: Power Level (P: 1–21+) gates cost in life/mana; no level gate; higher Power Level = higher Life cost, but any character can attempt use
  - **Dangerous MAgic**: "Wild Magic" Danger rolls replace character level gates — higher-level powers invite corruption risk rather than access gate

### Specialization vs. Generalization
- **Vancian**: Class + spell selection (wizard vs. cleric vs. druid narrow options)
- **SDM**: Any character can adopt any power via trait/item, including hybrid (e.g., soldier using oldtech healing power). Some Paths only give "skill" in Magitech or Fantascience (and some are upgradeable, or grant other proficiencies.)
  - **Inference**: SDM encourages cross-tradition mixing; "albums of power" formalize bundle-selling but don't gate access, which must be worked out "in-game"

### Attunement & Corruption
- **Vancian**: Spell save DCs scale with caster level; no mechanical "taint"
- **SDM**: [dangerous] tag + corruption trait acquisition; hazard of power use shifts burden to character thematic alignment
  - **Inference**: Using powers is not game-natural in SDM the way it is in Vancian; there's always an existential cost

## File Anchors for Citation

### Core Mechanics
- [Synthetic_Dream_Machine_01_Quickstart.md#L466](Synthetic_Dream_Machine_01_Quickstart.md#L466) → "Powers and Spells" paragraph
- [Synthetic_Dream_Machine_01_Quickstart.md#L750](Synthetic_Dream_Machine_01_Quickstart.md#L750) → "Item and Trait Overflow"
- [Vastlands_Guidebook.md -> "Using Powers"](#page_0096) (approx line 3930)
- [Vastlands_Guidebook.md -> "To Be A Proper Wizard"](#page_0105) (approx line 4398)
- [Vastlands_Guidebook.md -> "Storing Powers"](#page_0096) (within Using Powers section)
- [Flying_Triremes_and_Laser_Swords_06_Powers_and_ECM.md -> "Powers from Old School Roleplaying"](Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_06_Powers_and_ECM.md) → canonical `Spell Level × 2 = SDM Power Level` pin (Luka Rejec)

### Storage & Access
- [Synthetic_Dream_Machine_04_Powers_Index.md#L173](Synthetic_Dream_Machine_04_Powers_Index.md#L173) → "Storage tags" usage note
- [Synthetic_Dream_Machine_03_Traits_Index.md#L4388](Synthetic_Dream_Machine_03_Traits_Index.md#L4388) → "Power Scroller" trait (shows scroll-binding mechanic)
- [Synthetic_Dream_Machine_01_Quickstart.md#L468](Synthetic_Dream_Machine_01_Quickstart.md#L468) → "Each power or spell occupies a trait or item inventory slot..."

### Power as Trait
- [Synthetic_Dream_Machine_03_Traits_Index.md#L4388](Synthetic_Dream_Machine_03_Traits_Index.md#L4388) → "Powers as Traits" section anchor

## Storage Semantics Summary

| Aspect | Vancian | SDM |
|--------|---------|-----|
| **Primary container** | Spellbook (1 per wizard) | Inventory: trait/item/burden slots; rare Powers take up more than one slot |
| **Daily limit** | Spell slots by level (1–9) | No daily limit; repeated uses cost Life/Mana each time |
| **Preparation time** | 1 hour per spell level (study) | Instant (held in slot), time gate for "installing/uninstalling", or shifting Powers from active inventory to "cold storage" devices |
| **Access gate** | Class + spell level + known spells | Trait/item possession + Life/Mana cost |
| **Permanent loss** | Losing spellbook = spell loss | 0 Level items: Marking trait/item indicates "damage", marking again = instantaneous loss, no recovery; Higher LEvel items may allow other patterns, including Life scores, Ability scores, etc |
| **Overflow handling** | Not in core rules | Burden slots; -1 per burden |

## Crosswalk Family Implications

### Spell-to-Power Family Mapping

**Doctrine (Canon + Working Protocol)**: A proper BECMI→SDM spell crosswalk must account for:

1. **Power Level (P)** = `max(1, BECMI Spell Level × 2)` — canonical formula pinned by Luka Rejec.

   > *"As a general conversion guideline, SDM Power Level = OSR 'Spell Level' x2."*

   [Canon: Flying_Triremes_and_Laser_Swords_06_Powers_and_ECM.md -> "Powers from Old School Roleplaying"]
   Corroborated: `TODO_BECMI_Conversion.md`, `TODO_Magitech_Fantascience_Chapter05.md`, `TODO_Lares_Chapter05_Agent_Prompt.md`

   Full BECMI → SDM P: conversion table:

   | BECMI Spell Level | SDM P: | Notes |
   |---|---|---|
   | Cantrips / free effects | P: 1 | floor — `max(1, 0×2)` |
   | 1st | P: 2 | |
   | 2nd | P: 4 | |
   | 3rd | P: 6 | *calibration anchor: Pyreball in SDM Powers Index = P: 6* |
   | 4th | P: 8 | |
   | 5th | P: 10 | |
   | 6th | P: 12 | *[dangerous] threshold begins here* |
   | 7th | P: 14 | *Clerical max in BECMI* |
   | 8th | P: 16 | |
   | 9th | P: 18 | *MU max in BECMI* |

   Variable / multi-level spells map as variable P: entries or use Overcharge steps rather than a fixed level. Before assigning a final P:, cross-check analogous powers in the SDM Powers Index for calibration trends (e.g., `Real-Time Rebuild` P: variable, `Reuse the Shell` P: 1–12). This is the **Trend Reference step**: the locked staging corpus provides the source witness; the SDM Powers Index provides the calibration pattern.

2. **Storage form** determines accessibility:
   - **[storage:trait]** = mastered power, signature ability (like a special ability)
   - **[storage:item]** = spellbook/device/scroll (findable, stealable)
   - **[storage:burden]** = curse powers, geas-like bindings

3. **[dangerous] tag** replaces "high spell level resistance" on NPCs
   - The P: 12 threshold is not arbitrary: under the x2 formula, 6th-level is where the BECMI spell list turns world-altering — *Geas*, *Death Spell*, *Disintegrate*, *Move Earth*. These aren't utility spells; they reshape narrative, bypass defenses, or kill outright. SDM powers in the existing index also cluster [dangerous] at P: 12+, so the formula and the observed design trend agree.
   - **Default rule**: spells of 6th level and above (P: 12+) receive the [dangerous] tag automatically during conversion.
   - **Per-card editorial rule**: spells below 6th level may still receive [dangerous] if the effect is permanently identity-altering, death-adjacent, or corrupting in context (e.g., a 4th-level domination variant with permanent personality overwrite). This is a case-by-case call, not automatic.
   - Failure to activate safely → corruption trait acquisition, not spell fizzle. The [dangerous] tag shifts the hazard from "wasted slot" to existential cost.

4. **"To Be A Proper Wizard" ritual** is the SDM equivalent of "multiclass wizard"
   - No daily spell slot pressure, but accept permanent character costs
   - Encourages custom power albums instead of class-bound spell lists

5. **Trend Reference Workflow** — apply before finalizing any P: assignment:
   - Source witness: consult the locked staging corpus (`_todo/TODO_BECMI_Spell_Material_Staging.md` + lane files) for the spell's mechanics.
   - Calibration check: cross-reference the SDM Powers Index for analogous powers.
   - Primary anchor: `Pyreball` (SDM Powers Index) = P: 6, confirming 3rd-level Fireball at `3 × 2 = 6`.
   - The staged corpus is frozen; no new ad hoc scraping against PDFs during conversion work.

### Phase 2 Promotion Priority

For crosswalk Phase 2 family sections, prioritize rows with:
- High Power Level (P: 12–18+) for iconic spells known by name (6th–9th level under x2 formula)
- Multiple [storage:] variants (item-locked spells should list trait-equivalent)
- [dangerous] tag + corruption domain for spell-from-tome powers (P: 12+ = 6th-level and above)
- Album association where available (e.g., "Eternal Arkhiatricon" album for undead-themed Vancian spells)

### OSR Magic Patterns Reference

Data-mined from SDM Powers Index, FTLS_06_Powers.md, UVG2e, VLG, and OGA. These are confirmed conversion choices, not inferences — each has at least one SDM power card as evidence. Use these as the default approach when converting any BECMI spell; deviate only with an explicit note.

#### A. Damage and Dice

- **Damage dice preserved verbatim.** `1d6 per caster level` → `1d6 per user Level`. No re-mapping or substitution. Dice expressions in the source become dice expressions in the card. Add a hard cap (max 20d6) for scaling spells where runaway values are plausible (Fireball, Lightning Bolt pattern).
- **Save penalties preserved.** OSR mechanics like "Save vs. Spells at -2 for single-target Hold Person" carry over converted to SDM terms/units; write the penalty explicitly in the card body as a conditional modifier on the Endurance or Aura save line.
- **No-save thresholds preserved.** Sleep-style "no save if HD below threshold" maps to "no save if Level below threshold." State the threshold explicitly in the card.

#### B. Saving Throws

**SDM save mechanics (canon):**

- **Standard save:** `d20 + Endurance or Aura ability score` vs. target 13. Under = doom; exactly 13 = sacrifice (save at a cost); over = saved. [Canon: Synthetic_Dream_Machine_01_Quickstart.md -> "Saving Rolls"]
- **Endurance save:** `d20 + Endurance` — physical resilience, disease, injury, poison, harsh conditions.
- **Aura save:** `d20 + Aura` — psychic/spiritual integrity, mental effects, magical coercion, daemonic influence, possession.
- **Defeat Roll:** `2d6 + Endurance` (physical) or `2d6 + Aura` (mental) — NOT a save, but related. Triggered *after* Life drops to 0 or an ability score is reduced to 0. Determines the severity of the consequence (stunned / scarred / dead / destroyed etc.). High-P dangerous powers that land may require a Defeat Roll on top of normal damage.
- **Morale Roll:** `2d6` (no modifier), NPC-only. Reference for `Fear` and related effects for power conversion.
- **Active ability scores (Strength, Agility, Charisma, Thought) are NOT used for saves.** If the character is aware enough to react consciously, it is no longer a save situation — it is an action or defense. Only Endurance and Aura feed into saving rolls.

OSR save categories map to SDM as follows:

| OSR Save Category | SDM Save | Dice | Notes |
|---|---|---|---|
| Save vs. Spells | Aura save | d20 + Aura | Charm, hold, confusion, mental domination, magical area effects |
| Save vs. Paralysis | Aura save | d20 + Aura | Hold Person/Monster, Stasis, stun effects |
| Save vs. Death Ray | Endurance save | d20 + Endurance | Targeted lethal effects; may also trigger Defeat Roll on failure |
| Save vs. Breath Weapon | Endurance save | d20 + Endurance | Physical area blast caught in; fire, cold, acid, gas |
| Save vs. Poison | Endurance save | d20 + Endurance | Poison, venom, toxic cloud effects |
| Save vs. Wands | Aura save | d20 + Aura | Magical device discharges, force effects |
| Save vs. Petrification / Polymorph | Endurance save | d20 + Endurance | Body-altering physical transformations |
| No save (automatic) | No save | — | Magic Missile, Sleep threshold victims, etc. |
| Save or die | Endurance or Aura save + Defeat Roll on failure | d20, then 2d6 | High-P effects (P: 12+); failure triggers a Defeat Roll, not just damage |

Save outcome language (half damage, negate, -2 penalty, save or die) is preserved directly from the OSR source — do not flatten or randomize it. Write the modifier and outcome explicitly in the card body. For spells with "save or die" character, add a note that failure triggers a Defeat Roll, and ensure the `[dangerous]` tag is present if base P: 12+.

#### C. Duration and Activity

**SDM Duration Vocabulary (canonical)**

SDM power cards do not use a fixed time-unit system. Duration fields (`D:`) freely mix qualitative and quantitative language. Native SDM duration atoms from the Powers Index:

| Type | Examples |
|---|---|
| Instantaneous | `instant`, `0`, `interrupt` |
| Combat round | `one round`, `X rounds` |
| Minute-scale | `1 minute`, `5 minutes`, `10 minutes`, `a few minutes`, `several minutes`, `a minute or so` |
| Hour-scale | `1 hour`, `an hour`, `6 hours`, `several hours`, `an hour and an hour` |
| Day-scale | `a day`, `1 day`, `1 day and 1 night` |
| Open-ended / committed | `permanent`, `imbued`, `special`, `until dispelled` |
| Narrative | `1 dream`, `gestation period`, `until reality forcefully intervenes (then save)` |

SDM rounds are explicitly **cinematic, not precise** — "long enough to do something meaningful" (Quickstart → Rounds). Hours and days map to real-world time periods but carry no rigid watch or shift subdivisions.

**OSR → SDM Duration Conversion**

OD&D and BECMI use three primary time units in spell text. Their SDM equivalents:

| BECMI/OD&D Unit | Real-Time Meaning | SDM `D:` Preferred Form | Notes |
|---|---|---|---|
| Instantaneous | Immediate, no lingering | `instant` or `0` | Both forms valid; prefer `instant` |
| 1 round | One combat action (~6 sec) | `one round` | Preserved 1:1 |
| X rounds | Short combat duration | `X rounds` | Preserved 1:1 |
| 1 turn | 10-minute exploration increment | `10 minutes` | BECMI "turn" = 10-min delve; write out plainly |
| X turns | X × 10 min | `X × 10 minutes` | Prefer written-out form; 6 turns may collapse to `an hour` |
| 1 turn per Level | 10 min × user Level | `10 minutes per user Level` | Per-level scalar stays in base card body, not Overcharge |
| X rounds per Level | — | `X rounds per user Level` | Per-level stays in base card |
| 1 hour | 60 minutes | `an hour` or `1 hour` | Both in active use; prefer natural language |
| X hours | — | `X hours` or `several hours` | Write out specific count when known |
| 1 day | 24 hours | `a day` or `1 day` | Both forms valid |
| Until dispelled / concentration | — | `[focus]` + duration phrase, or `[imbued]` | See focus/imbued distinction below |
| Permanent | None | `permanent` | |

**Currency note on "minutes"**: OD&D source text sometimes writes "minutes" meaning literal per-minute real time, not exploration turns. Write these as `X minutes` in the `D:` field.

**[focus] vs. [imbued] distinction:**

- `[focus]` = concentration required; Life cost is spent at activation and not locked; breaks on disruption (Wall of Fire pattern).
- `[imbued]` = no concentration needed; Life cost remains locked (unavailable for other use) until the effect is dropped (Protection from Evil, Invisibility, Shield Ward pattern).
- Spells that require sustained attention without explicit concentration language default to `[imbued]` if they have a significant duration and a clear deactivation trigger.

**Zone / Range Doctrine**

SDM uses an **abstract zone system** rather than foot-based ranges. Canonical tiers from the Quickstart (Movement and Range table):

| Zone | Approximate Distance | Combat Notes |
|---|---|---|
| `self` | Caster only | Personal effect |
| `touch` | ~1m / arm's reach | Requires physical contact |
| `here` | ~3m / 10ft | Adjacent, body-length |
| `short` / `nearby` | ~5–20m / 15–60ft | 1 round to close from medium |
| `medium` | ~30–50m / 100–150ft | 2 rounds to close |
| `far` | ~45–75m / 150–240ft | 3 rounds to close |
| `an arena` | ~100m+ | Large space; not normal combat scale |
| `off-stage` | Sight line or beyond | Not reachable in combat without travel |

The Powers Index supplements these with **narrative descriptors** (`eating distance`, `scratching distance`, `whisper`, `a crowded room`, `a short walk`, `a day's march`) and **explicit metric values** (`3m`, `10m`, `30m`, `50m`). Both forms are in active use; the system privileges narrative clarity over arithmetic precision.

**BECMI → SDM Range Conversion**

Write the SDM zone label first; append the parenthetical OSR value (metric + feet) for source traceability. The FTLS template (`far (~45m / 150ft)`) is the established pattern.

| BECMI Range | Feet | Metric (~) | SDM Zone | Card `R:` Form |
|---|---|---|---|---|
| Self | — | — | `self` | `self` |
| Touch | 0 | 0 | `touch` | `touch` |
| 10–15 ft | 10–15 ft | ~3–4m | `here` | `here (~4m / 15ft)` |
| 30 ft | 30 ft | ~9m | `short` | `short (~9m / 30ft)` |
| 60 ft | 60 ft | ~18m | `short` | `short (~18m / 60ft)` |
| 90–120 ft | 90–120 ft | ~27–36m | `medium` | `medium (~30m / 100ft)` |
| 150 ft | 150 ft | ~45m | `far` | `far (~45m / 150ft)` |
| 240 ft | 240 ft | ~73m | `far` | `far (~75m / 240ft)` |
| 360 ft+ / line of sight | 360 ft+ | ~100m+ | `off-stage` | `off-stage (~100m+)` or `visible range` |

**Per-level range:** Map to a static baseline zone in the base card; encode Overcharge extension to the next zone tier. Do not scale the base `R:` linearly with level. (Pattern: Detect Invisible → static `short (~18m / 60ft)`, with Overcharge step providing `medium` extension.)

#### D. Overcharge Doctrine

- **Overcharge = secondary effects, not more dice.** No examined SDM power uses Overcharge to increase raw damage. Overcharge steps encode: larger radius or area, additional targets, extended duration, dual-mode variants, enhanced penetration, or narrative escalation.
- **Dual-mode spells use a single card with a choose-at-cast option.** OSR spells with two strongly distinct expressions (Ice Storm: damage burst vs. Ice Wall: barrier) become one card with "choose one of two expressions at cast time" in the body, not two cards or an Overcharge step.

#### E. Reversible Spells

- **General rule: Reversed forms are NOT separate SDM power cards.** The reversed form (Cause Light Wounds, Free Person, etc.) is preserved verbatim in the `osr:` block as canonical reference, but does not become its own entry in the Powers Index.
- **Per-card judgment:** If the reversed form has strong narrative utility in the SDM context, it is encoded as a `Reversable:` line in the main Power block — **not** as an Overcharge step, and **not** as a separate card. The `Reversable:` line names the inverted form, states its target and effect, and carries any additional tags or riders the hostile use warrants. P: cost does not change. This is case-by-case and must be marked with an editorial note. The default is: reverse lives in `osr:` only. Pattern:
  > *Cure Light Wounds* — `Reversable: Cause Light Wounds. Touch one unwilling creature; deal 1d6+1 damage instead of healing. Add [dangerous] rider for hostile use.`
  
  Related reversals that fit this pattern: Cure/Cause Critical Wounds, Restore/Cause Serious Wounds. Raise Dead / Finger of Death is a separate pair at escalating P: and gets separate cards rather than a `Reversable:` line, because the P: gap is too large to share a block. In actual play, reversed forms may start as encrypted/damaged/locked sections of the Power.
- **Counter-push-pull exception: Light ↔ Darkness and analogous opposing loops.** Some reversible pairs are not merely thematic inverses — they are designed to contest each other as **active game states**. The canonical SDM instance is Light ↔ Darkness:
  - FTLS directly rules the opposition: *"Darkness will cancel a light spell if cast upon it, but may itself be cancelled by another light spell."* Continual Light cancels Continual Darkness and vice versa. [Canon: Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_06_Powers_and_ECM.md → Continual Light / Darkness entries]
  - This makes Darkness a **tactical** counterplay tool with direct exploration and combat utility, not merely the narrative opposite of Light.

  **Editorial rule:** When the reversed form functions as a **direct mechanical counter** to the base spell (or to a named category of ongoing effects), it earns its own separate card — not `Reversalbe:` storage, and not `osr:` block only. The card body must name the opposition relationship explicitly.

  This counter-push-pull structure recurs across several SDM game-loops:

  | Loop | Initiating side | Counter side | Sources |
  |---|---|---|---|
  | Light / Darkness | Light, Continual Light | Darkness, Continual Darkness | FTLS_06 → Light, Continual Light |
  | Scry / Obfuscate | Clairvoyance, Wizard Eye, Detect spells | ECM rituals, anti-scrying wards, Lair Magic ward-testing resistance | FTLS_04 → ECM; FTLS_05 → Amulet of Proof; FTLS_02 → Lair Magic |
  | Illusion / Disbelief | Phantasmal Force, Mirror Image, illusion family | Aura test to disbelieve; area effects that ignore sight-driven targeting | FTLS_06 → Phantasmal Force; FTLS_03 → [illusion][light][void] affinity |

  For Light/Darkness specifically, the four-card structure is established by FTLS and should be preserved in the Chapter 06 import:
  - **Light** — P: 2, separate card; body states it is cancelled by Darkness cast upon it.
  - **Darkness** — P: 2, separate card; body states it cancels active Light in the area, and is itself cancelled by a subsequent Light or Continual Light.
  - **Continual Light** — P: 4, separate card; body states it cancels active Darkness and Continual Darkness.
  - **Continual Darkness** — P: 4, separate card; body states it resists non-continual light sources and is cancelled only by Continual Light.

#### F. Tag System and Assignment

##### F.1 — What Tags Are

Tags are not flavor labels — they are **procedure flags that tell the referee what to do at table speed** (FTLS meta-note; confirmed in all SDM/FTLS source chapters). They encode rules hooks, Affinity-triggering signals, and storage/activation semantics directly on the power card. The canonical tag vocabulary lives in [Flying_Triremes_and_Laser_Swords_10_Appendix_Null_Referee_Resources.md](Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_10_Appendix_Null_Referee_Resources.md) — consult it before inventing new tags.

##### F.2 — Structural Frame Tags (Mandatory)

Every power card — native SDM or OSR-derived — carries exactly these two structural tags. They are non-negotiable and appear at the start of the tag line in this order:

| Tag | Role | Values |
|---|---|---|
| `[power]` | Universal marker; always first | Always `[power]` |
| `[storage:X]` | Storage mode; always second | `trait` · `item` · `burden` · `structure` · `location` |

Multiple `[storage:X]` tags may appear side by side when a power can live in more than one storage form (e.g., `[storage:trait] [storage:item]`). For `[storage:X]` definitions, cross-reference Point 2 of the Spell-to-Power Family Mapping section above.

Tradition tags (`[oldtech]`, `[fantascience]`, `[ritual]`, `[weapon]`) follow immediately after `[storage:X]` when they apply. They are not a mandatory slot — omit them when none clearly fits. `[fantascience]` signals CHARISMA-track proficiency; `[oldtech]` signals THOUGHT-track proficiency. Their definitions live in Appendix Null (Schools & Traditions, Artifacts & Practices, and Weird Science & Magitech sections).

##### F.3 — Tradition Tags (conditional)

The tradition tags name the power's origin context and drive Affinity and proficiency hooks. They are drawn directly from the Appendix Null tag vocabulary; their definitions live in the "Schools & Traditions," "Artifacts & Practices," and "Weird Science & Magitech" sections.

| Tag | Meaning and assignment criteria | BECMI spell examples |
|---|---|---|
| `[ritual]` | Transformation, binding, invocation, lifecycle transitions, body-alteration, summoning-register, or any effect that restructures a person, object, or relationship rather than simply projecting force. Applies to both cleric and magic-user spells. In Appendix Null: "Artifacts & Practices." | Animate Dead, Alter Self, Dispel Magic, Reincarnate, Raise Dead, Knock/Lock, Charm Person, Repel/Ward spells |
| `[fantascience]` | Unstable sorcery-tech; CHARISMA-track proficiency. Physics-defying energy discharge, artillery-register effects, or reality-override; feels like a malfunctioning weapon or overloaded device rather than a learned technique. Typically involves direct-damage area blasts or high-tier force effects. In Appendix Null: "Core" and "Weird Science & Magitech." | Fireball, Delayed Blast Fireball, Meteor Swarm, Power Word Kill, Power Word Blind |
| `[oldtech]` | Magitech; THOUGHT-track proficiency. Precise detection, analysis, access, or targeted biological/technical augmentation; feels like careful instrumentation rather than spectacle. Minimal fictional side-effects; operational, not spectacular. In Appendix Null: "Core" and "Weird Science & Magitech." | Detect Magic, Detect Evil, Clairvoyance, ESP, Infravision, Mage Armor, Locate Object, Find Traps |
| `[weapon]` | Weapon-mode power; delivers its effect through a weapon frame or resolves as a weapon attack. No BECMI spell examples yet — tag is available in Appendix Null: "Artifacts & Practices" for Chapter 05 Magitech work. | *(none yet — re-examine when Chapter 05 commences)* |

If none of the tradition tags apply, omit them. The mandatory `[power] [storage:X]` frame still applies. Layer 3 behavior tags carry the descriptive weight for catch-all powers. A power without a tradition tag is implicitly general.

##### F.4 — Additional Tags: The FTLS_06 Layered Pattern

FTLS Chapter 06 establishes the conversion pattern: extend the 2-tag structural frame with additional tag layers. All tag vocabulary must be drawn from Appendix Null unless explicitly noted. We are open to creating new tags, but they must be documented in Appendix Null when introduced. The full tag line for a converted power typically runs 5–10 tags.

**Layer 2 — Tradition/Source and OSR School Tags**

SDM/FTLS tradition tags go first within this layer — placed immediately after `[storage:X]` — when they apply: `[oldtech]` · `[fantascience]` · `[ritual]` · `[weapon]` (full criteria in F.3). Then add OSR school and cleric domain names directly as flat tags. Do **not** remap or substitute SDM vocabulary.

*Magic-User schools:*
`[abjuration]` · `[conjuration]` · `[divination]` · `[enchantment]` · `[evocation]` · `[illusion]` · `[necromancy]` · `[transmutation]`

*Cleric domains (from Appendix Null — Clerical & Cult Domains):*
`[healing]` · `[blessing]` · `[curse]` · `[life]` · `[death]` · `[light]` · `[darkness]` · `[nature]` · `[trickery]` · `[knowledge]` · `[tempest]` · `[war]` · `[geas]` · `[sacrifice]` · `[oath]` · `[faith]` · `[prophecy]`

**Layer 3 — Mechanical Behavior Tags**

From Appendix Null — Core section. Apply all that fit; these drive table-speed referee decisions. Key tags for BECMI conversions:

`[attack]` · `[focus]` · `[imbued]` · `[ward]` · `[aura]` · `[area S/M/L]` · `[burst]` · `[dangerous]` · `[fueled]` · `[anchored]` · `[reaction]` · `[instant]` · `[line]` · `[cone]` · `[zone]` · `[guided]` · `[petrifying]` · `[fearsome]` · `[vital]` · `[necrotic]` · `[deathly]` · `[vorpal]` · `[slow]` · `[clumsy]` · `[attune]`

**Layer 4 — Element / Effect / Thematic Tags**

From Appendix Null — Elements & Energies, Dreams & Shadows, Totems & Spirits, Schools & Traditions, and Artifacts & Practices. These support Affinity triggering and faction/caster-tradition positioning.

Apply all that are genuinely present in the spell's fiction. Don't pad; 2–4 thematic tags is normal.

Representative examples for BECMI conversions: `[fire]` · `[lightning]` · `[cold]` · `[force]` · `[radiant]` · `[poison]` · `[light]` · `[darkness]` · `[earth]` · `[air]` · `[water]` · `[ice]` · `[illusion]` · `[phantasm]` · `[mind]` · `[death]` · `[undead]` · `[dream]` · `[chaos]` · `[void]` · `[astral]` · `[summon]` · `[banish]` · `[bind]` · `[ward]` · `[song]`

##### F.5 — `[dangerous]` vs. `[high-tier]`

`[dangerous]` is canonical — it appears in Appendix Null Core and is the doctrinal tag for powers that trigger Danger Rolls or corruption exposure (see Section 3 of the Spell-to-Power Family Mapping for P: 12+ default rule).

`[high-tier]` appears in FTLS_06 power cards but is **absent from Appendix Null** and therefore not part of the canonical tag vocabulary. It is a temporary marker. **Do not use `[high-tier]` in new BECMI conversions.** Use `[dangerous]` for powers at P: 12+ and for save-or-die / world-altering effects.

##### F.6 — Default Tag Sets for Common BECMI Families

**Storage default — `[storage:trait]`:** All BECMI-derived power cards use `[storage:trait]` as the default. This is intentional: the SDM conversion replaces Vancian spell slots with trait slots, so learned spells are abilities you carry in yourself, not texts you hold. Note that FTLS_06 defaults to `[storage:item]` for OSR spells (grimoire-pattern); that is the correct precedent for item-side variants, not for this work. When Chapter 05 (Magitech & Fantascience — magic items and artifacts) work commences, `[storage:item]` and `[storage:burden]` variants of many of these powers will emerge. The storage tag is the knob to change when that happens — do not retroactively alter the base trait card, create additional item/burden-mode cards instead. One `[storage:burden]` precedent worth noting now: FTLS_06 assigns it to powers whose primary effect IS an ongoing burden condition (Reckless Dweomer, Giant Growth, Crown of the Grave). If a converted spell primarily imposes Wear-and-Tear, `[storage:burden]` may be the right choice alingside `[storage:trait]`, etc.

If none of the tradition tags (F.3) apply to a given family's cards, omit the tradition tag — the table's Layer 3 behavior tags carry the meaning.

Starting tag patterns by spell family. All are `[power] [storage:trait]` unless noted — fill in spell-specific Layer 3/4 details beyond what's shown.

| BECMI Family | Tradition tag (if applicable) | School (L2) | Behavior (L3) | Element (L4) |
|---|---|---|---|---|
| Direct damage — blast-register (Fireball, Delayed Blast Fireball, Meteor Swarm, Death Spell) | `[fantascience]` | `[evocation]` | `[attack]` `[dangerous]` `[area M]` or `[area L]` | `[fire]` / `[force]` / element |
| Direct damage — technique-register (Lightning Bolt, Magic Missile, Cloudkill, Cone of Cold) | *(none)*; add `[fantascience]` at L4 for high-energy-feel spells (Lightning Bolt, Chain Lightning) | `[evocation]` | `[attack]` `[dangerous]` | element tag |
| Ward / Protection (Protection from Evil, Shield, Anti-Magic Shell) | *(none)*; `[oldtech]` for force-field / device-feel shields (Mage Armor) · `[ritual]` for consecrated wards and oath-bound abjurations | `[abjuration]` | `[ward]` `[imbued]` | `[force]` / domain tag |
| Detection (Detect Magic, Detect Evil, ESP, Clairvoyance, Locate Object) | `[oldtech]` | `[divination]` | `[detection]`; `[focus]` for sustained scrying | element/type tag (`[magic]` / `[evil]` / `[mind]`) |
| Hold / Control (Hold Person, Hold Monster, Charm Person, Charm Monster) | *(none)* · `[ritual]` for binding-register (Charm Person as geas, Geas/Quest itself) | `[enchantment]` | `[attack]` `[focus]` `[control]` | `[mind]` `[charm]` |
| Healing / Cure (Cure Light Wounds, Cure Disease, Neutralize Poison, Restore) | *(none)* | `[healing]` | `[vital]` for damage healed; `[cleanse]` for condition removal | `[life]` |
| Summoning / Animation (Animate Dead, Conjure Elemental, Insect Swarm, Invisible Stalker) | *(none)* · `[ritual]` for full creature-binding and corpse-animation | `[conjuration]` or `[necromancy]` | `[fueled]`; `[dangerous]` at P: 12+ | `[summon]` / `[undead]` / element tag |
| Illusion (Phantasmal Force, Mirror Image, Invisibility, Hallucinatory Terrain) | *(none)* | `[illusion]` | `[focus]` for active illusion; `[imbued]` for sustained forms (Invisibility) | `[illusion]` `[phantasm]` |
| Teleportation / Planar travel (Teleport, Dimension Door, Plane Shift, Word of Recall) | *(none)*; `[fantascience]` for world-scale or no-save planar transport at P: 16+ | `[conjuration]` | `[movement]` `[teleport]`; `[dangerous]` at P: 12+ | `[void]` / `[astral]` |
| Terrain / Environmental (Wall of Fire, Ice Storm, Earthquake, Move Earth, Weather Control) | *(none)* | `[transmutation]` or `[evocation]` | `[area L]` `[anchored]` `[focus]` | `[earth]` / `[fire]` / `[cold]` / `[weather]` |
| Necromancy / Death-touch (Finger of Death, Disintegrate, Cause Serious Wounds, Wither) | *(none)*; `[fantascience]` for no-save instant-kill finishers (Power Word Kill, Disintegrate) · `[ritual]` for lifecycle-threshold effects (Raise Dead, Reincarnate as standalone cards) | `[necromancy]` | `[attack]` `[dangerous]` | `[death]` `[necrotic]` |

#### G. Charm and Control

- Charm/control spells express a **relationship state**, not ownership. The target treats the caster as a trusted ally or best friend, not as an absolute controller. Commands that require self-harm or betrayal of deep loyalties are refused.
- Charm breaks immediately if the caster attacks the charmed target. State this explicitly.
- Re-save cadence follows the target's Intelligence: low INT creatures take longer to re-save; high INT creatures re-save frequently. Write this as referee guidance in the card body, not as a fixed interval.

#### H. Detection Spells

- Detection spells use a static range (typically short range ~18m/60ft), no save from the detected subject.
- They reveal presence but not always function or origin — state explicit limits (hidden objects, solid containers, etc.).
- Overcharge on detect spells provides: penetration of cover, clarification of function, or range extension. These effects may allow the target to save.

#### I. Material Components

OSR material components are dropped entirely. No SDM power card references components. The Life and Inventory costs are the mechanical replacement for component cost. When the source text has flavorful components (incense, mirrors, powdered iron), preserve them in the `osr:` block verbatim; do not import them into the SDM card body unless they carry narrative weight worth keeping as flavor text.

#### J. Class Gates

OSR class restrictions (Cleric-only, Magic-User only, Druid-only) are dropped. Any character with access to the power may use it. SDM replaces the class gate with the inventory slot requirement (trait or item), the Life cost, and optionally the [dangerous] tag for powers that punish unskilled use. Do not add a "wizards only" note to power cards.

[Synthesis, grounded in SDM Powers Index + FTLS_06_Powers.md pattern scan]

