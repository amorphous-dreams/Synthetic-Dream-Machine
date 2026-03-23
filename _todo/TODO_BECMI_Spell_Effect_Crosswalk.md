# TODO: BECMI Spell / Effect Crosswalk

This document is the downstream handoff artifact for the completed BECMI spell-material staging corpus.

Purpose:
- track classic spell and effect names across the staged core books
- build the full canonical spell crosswalk from the staged corpus
- support FTLS Chapter 06 powers drafting as the next major downstream consumer
- support the broader `F2: Spells -> Powers` conversion pass

Source corpus:
- `_todo/TODO_BECMI_Spell_Material_Staging_Basic.md`
- `_todo/TODO_BECMI_Spell_Material_Staging_Expert.md`
- `_todo/TODO_BECMI_Spell_Material_Staging_Companion.md`
- `_todo/TODO_BECMI_Spell_Material_Staging_Master.md`
- `_todo/TODO_BECMI_Spell_Material_Staging_Immortals.md`
- `_todo/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md`

Rules for this artifact:
- This is a crosswalk workspace, not a source-text staging file.
- Use the staged corpus as the source of truth; do not copy from PDFs ad hoc.
- Preserve classic names as lookup keys.
- Do not convert terminology to SDM terms until a mapping decision is recorded.
- Preserve classic OSR spell names as the primary Chapter 06 headings and lookup surface even when an SDM-native variant already exists.
- Creature-specific spellcaster scans remain out of scope unless they are required to clarify the spell corpus itself.

## Canonical Name / Variant Doctrine

- The crosswalk is keyed by canonical OSR spell or effect name first.
- Existing entries in [Synthetic_Dream_Machine_04_Powers_Index.md](/home/joshu/Synthetic-Dream-Machine/Synthetic_Dream_Machine_04_Powers_Index.md) that clearly descend from classic spells should be treated as unique SDM variants, not as replacements for the canonical row key.
- Chapter 06 should normally list the canonical spell name, then note any existing stylized SDM variant with a `see` pointer.
- The default manuscript pattern is: canonical spell entry first, variant callout second. Example: `Magic Missile` with a note to see `Tragic Missile`.
- A canonical spell may have zero, one, or several existing SDM variants. Record them when they exist; do not force one variant to become the only canonical implementation.
- Existing variant powers are useful precedent for tone, presentation, and implementation direction, but they do not erase the need to preserve the classic recognizer/API surface.

Variant recording rule for this workspace:
- When a clear SDM variant already exists, record it in the row `Notes` field as `Existing SDM variant: <Power Name> (<source lane>)` until or unless the table grows a dedicated variant column.

## Existing Variant Inventory

Starter batch of already-identified Luka-style descendants or family variants from the Powers Index.

| Canonical Key | Existing SDM Variant | Relation | Powers Index Source Lane | Planning Use |
| --- | --- | --- | --- | --- |
| Magic Missile | Tragic Missile | close descendant | Vastlands / Apocrypha of the O.S. | Keep `Magic Missile` as the Chapter 06 heading; add `see Tragic Missile`. |
| Floating Disc | Floating Disc | direct stylized rendition | UVG2e Spells | Canonical entry can point directly to the existing variant without renaming the recognizer. |
| Knock | Knock / Lock | broadened descendant | UVG2e Spells | Treat `Knock` as canonical and note the lock/unlock SDM variant alongside it. |
| Hold Person | Hlod Person | playful descendant | Vastlands / Apocrypha of the O.S. | Preserve the canonical restraint spell name and use the Luka version as a named variant. |
| Animate Dead | Animate Corpse | close descendant | UVG2e Spells | Use the canonical necromancy key while treating the UVG rite as a specific implementation path. |
| Raise Dead | Raise Dead | dark exact-name rendition | UVG2e Spells | Same recognizer, but the UVG rendering is an undead/parody-of-life implementation rather than a clean restoration effect. |
| Magic Jar | Magic Jar | exact-name rendition | UVG2e Spells | Strong direct precedent for identity-transfer / crystal mind-storage handling in Chapter 06. |
| Read Languages / language-bridge family | Anti-Babylon | family variant | Eternal Return Key | Useful for language, communication, and universal-translation families without collapsing them into one exact spell name. |
| Fire Ball / Fireball | Pyreball | close descendant | Vastlands / Apocrypha of the O.S. | Preserve both staged-corpus spellings while pointing to the existing Luka-style fireburst variant. |
| Polymorph Self / Alter Self family | Alter Self | family variant | UVG2e Spells | Useful precedent for self-directed transformation even when the canonical BECMI keys remain separate. |
| Wish | Big Wish | stylized high-tier descendant | Vastlands / Apocrypha of the O.S. | Preserve `Wish` as the canonical heading and treat `Big Wish` as a distinctive SDM presentation. |

## Likely Further Candidates From Powers Index Compare Pass

Validated candidates from a broader compare pass. These are promising enough to track, but should not all be promoted to row-level `Existing SDM variant` notes without a spell-by-spell decision.

| Canonical Spell / Family | Powers Index Entry | Confidence | Why It Looks Relevant | Likely Use |
| --- | --- | --- | --- | --- |
| Truesight / True Seeing family | Eyes of Akaula | medium-high | Sees invisible, hidden, departed, and dead things for a day; strong reveal/divination package. | Good precedent for premium perception and anti-concealment powers. |
| Wizard Eye / Clairvoyance family | Eyes of the Arrow | medium-high | Binds awareness to a projectile to create a mobile remote sensor. | Good precedent for remote-sight and scouting powers. |
| Teleportation / portal family | Linked Portals | medium | Two linked astral hoops move creatures and objects through connected space rather than instant self-relocation. | Better treated as a portal/travel family cousin than a direct `Teleport` replacement. |
| Telekinesis / mage-hand family | Objective Telekinesis | medium-high | Creates an ectoplasmic hand that manipulates and crushes nearby objects. | Good precedent for low-tier force-manipulation powers. |
| Speak With Dead family | Speak With Husk | high | Corpse answers three questions; overcharge allows fuller conversation. | Strong candidate for eventual row-level variant handling. |
| Polymorph Self / shapechange family | Skinshift | medium-high | Full body transformation into familiar beast forms with escalating size options. | Stronger and broader than `Alter Self`; likely useful when the transformation pass deepens. |
| Charm Person / Mass Charm family | Hero's Goldenmouth | medium | Crowd-facing charm through rhetoric and trust rather than direct domination. | Better treated as a social-compulsion cousin than a clean exact spell rename. |
| Obscuring mist / fog / concealment family | Yellow Cloud | medium | A 9m cube of sight-blocking dust plus an overcharged dust wall. | Good concealment / battlefield-obscuration precedent. |
| Detect sentience / aura-reading / ESP family | Yellow Foresight | medium | Scans a wide area for the number and general mood of sentients; overcharge nudges attitude. | Good precedent for mood-reading and population-sense divinations. |
| Regeneration / restoration family | Rehoryan's Progressive Restoration | medium-high | Rapid life recovery plus staged bodily repair and regrowth. | Strong precedent for higher-tier restoration/regeneration effects distinct from ordinary cure spells. |

## Active Phase Scope

- Full staged spell corpus first
- all classic spell and effect names that will feed Chapter 06 powers work
- spellcasting doctrine and support procedures where the effect is procedural rather than just a title
- Chapter 05-relevant names remain important, but they are now a subset of the broader Chapter 06-facing pass

Examples:
- `Dispel Magic`
- `Remove Curse`
- `Spell Catching`
- `Spell Storing`
- `Conjure Elemental`
- `Invisible Stalker`
- `Anti-Magic Shell`

## Suggested Row Fields

Use one row per classic spell or effect name, with these fields:

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Example | RC, Expert | `Chapter 3` / `Spell Research` | spell / effect / item-effect | short source-use note | direct / partial / custom / undecided |

## Mapping Status Vocabulary

- `direct`: likely maps cleanly to an existing SDM/FTLS power or procedure
- `partial`: partly maps, but still needs bridge text or interpretation
- `custom`: likely needs new SDM-compatible power text or item-specific handling
- `undecided`: not reviewed yet

## Immediate Next Work

- close the remaining niche Phase 1 catalog gaps, especially named scroll wrappers, support procedures, and cross-book lookup variants
- run one more pass on the non-RC staging books for spell-adjacent item and procedure coverage now that RC no longer appears to be the blocking source
- complete the catalog before treating family grouping as the main organizing layer
- after the catalog pass is stable, split the full list into useful Chapter 06 families and shared power-pattern clusters
- record existing SDM Powers Index variants alongside canonical names wherever Luka has already produced a UVG / VLG / OGA-style descendant
- run a second dedicated variant-identification pass after the catalog is broader, so effect cousins can be compared against the fuller canonical list instead of a partial slice
- defer final SDM wording until the powers pass begins, but do record mapping status and pattern notes as the corpus grows

## Phase Order

1. Full spell catalog first
2. Family split second
3. Variant identification pass after the broader catalog exists

## Phase 1: Full Spell Catalog First

Build the crosswalk outward as a comprehensive canonical spell catalog before relying on family buckets as the primary shape of the document.

Catalog rules for this phase:
- one row per canonical spell or reusable spell-effect name
- preserve classic spell names as the row key
- include at least one staged source anchor per row
- use the `Notes` field for implementation observations and any already-known SDM variant pointer
- do not let family grouping hide uncatalogued spell names

Recommended catalog lanes:
- Basic cleric and magic-user foundations
- Expert cleric and magic-user expansions
- Companion high-level cleric and druid additions
- Master druid, cleric, and magic-user high-tier additions
- Rules Cyclopedia catch-up and consolidated duplicates
- reusable item-effect or scroll-native spell behaviors that matter for Chapter 06 or Chapter 05 bridges

Catalog completion target:
- the crosswalk should be able to answer `is spell X in scope, and where is its staged anchor?` before the family split becomes the main drafting surface

### Remaining Book Pass Plan

- Basic and Expert treasure-text pass:
	- confirm generic wrapper rows for spell scrolls, protection scrolls, cursed scrolls, and treasure maps
	- review wand, staff, and rod operation text for reusable spell-interface procedures rather than one-off item names
- Companion treasure and scroll pass:
	- verify the RC-style named scroll suite against Companion treasure descriptions
	- harvest Companion-only staff, rod, ring, quill-copying, and elemental-travel procedures that matter for Chapter 05 or Chapter 06 bridges
- Master artifact and cross-tradition pass:
	- review artifact power doctrine and artifact effect procedures for bundled spell recognizers, item-use bridges, and high-tier reusable procedures
	- decide which artifact-side effects deserve canonical crosswalk rows versus deferred bundle notes
- Immortals magical-effects pass:
	- audit the Immortals magical-effect index and section notes as a completeness check on mortal spell recognizers already in scope
	- separately track any non-mortal magical effects that should become Chapter 06 precedent notes rather than canonical spell rows

## Phase 2: Family Split

Once the fuller catalog exists, split the rows into working families that help Chapter 06 drafting.

Likely family buckets:
- attack / force / artillery
- detection / information / revelation
- wards / barriers / counterforce
- movement / access / traversal
- control / restraint / compulsion
- transformation / summoning / creation
- restoration / repair / resurrection
- storage / spell-handling / item-interface effects
- high-tier exception / reality rewrite

Family grouping is a drafting aid, not a replacement for the canonical catalog.

## Phase 3: Variant Identification Pass

After the full catalog and first family split exist, run another deliberate variant-identification pass against the SDM Powers Index.

Goals of that pass:
- promote the strongest candidate analogs to explicit `Existing SDM variant` notes
- distinguish exact-name renditions, close descendants, broadened descendants, and looser family cousins
- avoid forcing premature matches while the canonical spell list is still incomplete
- identify where Chapter 06 should use direct `see` notes versus broader `family precedent` references

## Phase 1 Catalog Workspace

Initial flat catalog seed for the full-spell pass. This section is intentionally source-lane oriented rather than family-oriented so uncatalogued names stay visible.

### Basic Cleric Foundations

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Cure Light Wounds | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Basic cleric foundation spell; Expert adds reverse-effect handling. | undecided |
| Detect Evil | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Basic cleric foundation spell. | partial |
| Detect Magic | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Shared cleric / magic-user recognizer. | direct |
| Light | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Shared cross-tradition light / darkness recognizer. | undecided |
| Protection from Evil | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Basic cleric defensive barrier spell. | partial |
| Purify Food and Water | Basic | Basic -> Spell Lists and Basic Spell Descriptions | spell | Basic cleric utility / purification foundation. | undecided |
| Remove Fear | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Basic cleric fear-removal spell; Expert adds reverse-effect handling. | undecided |
| Resist Cold | Basic | Basic -> Spell Lists and Basic Spell Descriptions | spell | Basic cleric resistance foundation. | undecided |

### Basic And Expert Arcane Foundations

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Charm Person | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Core low-tier social control spell. | undecided |
| Continual Light | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Higher-tier light / darkness lane. | undecided |
| Detect Evil | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Arcane second-level detect / alignment-adjacent lane. | undecided |
| Detect Invisible | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Arcane perception / anti-concealment lane. | undecided |
| Dispel Magic | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Major counterforce recognizer. | undecided |
| ESP | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Thought-reading / awareness lane. | undecided |
| Fire Ball / Fireball | Basic, Expert, Master, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Mixed staged-corpus spelling: B/X/Master use `Fire Ball`, while RC uses `Fireball`. Existing SDM variant: `Pyreball` (Vastlands / Apocrypha of the O.S.). | partial |
| Floating Disc | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Existing SDM variant: `Floating Disc` (UVG2e Spells). | direct |
| Fly | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Core aerial movement recognizer. | direct |
| Hold Portal | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Low-tier closure / access-control spell. | undecided |
| Invisibility | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Core concealment lane. | undecided |
| Invisibility 10' radius | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Group concealment variant. | undecided |
| Knock | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Existing SDM variant: `Knock / Lock` (UVG2e Spells). | partial |
| Levitate | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Vertical movement recognizer. | direct |
| Light | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Arcane first-level light spell; shared with cleric lane. | undecided |
| Lightning Bolt | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Core line-artillery recognizer. | undecided |
| Locate Object | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Arcane search / direction lane. | direct |
| Magic Missile | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Existing SDM variant: `Tragic Missile` (Vastlands / Apocrypha of the O.S.). | partial |
| Mirror Image | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Defensive illusion / misdirection lane. | undecided |
| Phantasmal Force | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Core illusion-construction spell. | undecided |
| Protection from Evil | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Arcane defensive barrier; shared with cleric lane. | partial |
| Protection from Evil 10' radius | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Group barrier version of the same defensive lane. | undecided |
| Protection from Normal Missiles | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Projectile-defense lane. | undecided |
| Read Languages | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Existing SDM family variant: `Anti-Babylon` (Eternal Return Key). | partial |
| Read Magic | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Scrolls | spell | Core scroll / spellbook deciphering gate. | partial |
| Shield | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Personal defense shell. | direct |
| Sleep | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Core low-tier disable spell. | direct |
| Ventriloquism | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Sound-projection / deception utility. | undecided |
| Water Breathing | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Aquatic access / traversal lane. | undecided |
| Web | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Area restraint and denial spell. | direct |
| Wizard Lock | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Arcane closure / keyed barrier lane. | undecided |

### Expert Cleric Expansions

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Bless | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Morale and combat blessing lane. | undecided |
| Continual Light | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Clerical light / darkness lane as well as arcane one. | undecided |
| Cure Blindness | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Condition-removal lane. | undecided |
| Cure Disease | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Disease-removal and anti-corruption-adjacent lane. | undecided |
| Find Traps | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Detection and hazard-reading spell. | undecided |
| Growth of Animal | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Creature enhancement / scaling lane. | undecided |
| Hold Person | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Existing SDM variant: `Hlod Person` (Vastlands / Apocrypha of the O.S.). | direct |
| Know Alignment | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Alignment-reading / false-alignment lane. | undecided |
| Locate Object | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Clerical object-direction lane. | direct |
| Remove Curse | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Major curse-removal recognizer. | undecided |
| Resist Fire | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Fire resistance and mitigation lane. | direct |
| Silence 15' Radius | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Anti-speech / anti-spellcasting field lane. | undecided |
| Snake Charm | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Creature-specific charm/control spell. | undecided |
| Speak with Animals | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Animal communication lane. | undecided |
| Speak with the Dead | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Strong family comparison point for `Speak With Husk`. | partial |
| Striking | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Weapon augmentation lane. | undecided |
| Animate Dead | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Clerical necromancy lane; same recognizer also appears in arcane spell lists. | custom |
| Create Water | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Conjured supply / survival utility. | undecided |
| Cure Serious Wounds | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Mid-tier healing upgrade. | undecided |
| Dispel Magic | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Clerical counterforce lane. | undecided |
| Neutralize Poison | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Poison-cleansing and poison-creation lane. | undecided |
| Protection from Evil 10' Radius | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Group barrier spell in clerical lane. | undecided |

### Expert High-Tier Arcane Additions

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Anti-Magic Shell | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures | spell | Major counter-magic barrier recognizer. | undecided |
| Animate Dead | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Existing SDM variant: `Animate Corpse` (UVG2e Spells). | custom |
| Charm Monster | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Broad creature-charm lane. | undecided |
| Clairvoyance | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Remote-sight lane; compare `Eyes of the Arrow`. | undecided |
| Cloudkill | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | High-tier battlefield hazard / area denial lane. | undecided |
| Confusion | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Mind-disruption lane. | partial |
| Conjure Elemental | Expert, Companion, Immortals, RC | Expert -> Clerical and Magic-User Spell Expansions; Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items | spell | Summoning recognizer with item and later-book relevance. | undecided |
| Death Spell | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | High-tier kill / sweep spell lane. | undecided |
| Dimension Door | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Short-range transit / relocation lane. | undecided |
| Disintegrate | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Matter-destruction lane. | undecided |
| Geas | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Compulsion / binding lane. | undecided |
| Growth of Plants | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Terrain / vegetation alteration lane. | undecided |
| Hallucinatory Terrain | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Large-scale illusion / terrain falsification lane. | undecided |
| Haste | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Speed / acceleration lane. | undecided |
| Hold Monster | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Higher-tier restraint lane. | undecided |
| Ice Storm/Wall | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Hybrid artillery / wall-control lane. | undecided |
| Infravision | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Sensory enhancement lane. | undecided |
| Invisible Stalker | Expert, Immortals, RC | Expert -> Clerical and Magic-User Spell Expansions; Immortals -> Section 3: Immortal Magic | spell | Summoned service / tracking entity recognizer. | undecided |
| Lower Water | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Water-control / environmental manipulation lane. | undecided |
| Magic Jar | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Existing SDM variant: `Magic Jar` (UVG2e Spells). | partial |
| Massmorph | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Group disguise / illusion-transformation lane. | undecided |
| Pass-Wall / Passwall | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Mixed staged-corpus spelling: BECMI lanes often use `Pass-Wall`, while RC uses `Passwall`. | undecided |
| Polymorph Other / Others | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Mixed staged-corpus form: detailed spell headings use `Polymorph Other`, while some lists and references use `Polymorph Others`. | partial |
| Polymorph Self | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Existing SDM family variants: `Alter Self`, `Skinshift`. | partial |
| Projected Image | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Remote duplicate / projection lane. | undecided |
| Remove Curse | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Arcane curse-removal lane. | undecided |
| Stone to Flesh | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Petrification-reversal lane. | undecided |
| Teleport | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Major transit spell; compare `Linked Portals` as a family cousin. | partial |
| Wall of Fire | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Barrier-plus-damage lane. | undecided |
| Wall of Stone | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Structural conjuration / barrier lane. | undecided |
| Wizard Eye | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Remote-sight lane; compare `Eyes of the Arrow`. | undecided |

### Companion High-Level Cleric Additions

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Aerial Servant | Companion | Companion -> High-Level Cleric Spell Material | spell | Summoned fetch-servant and retrieval lane. | undecided |
| Animate Objects | Companion | Companion -> High-Level Cleric Spell Material | spell | Object animation lane. | partial |
| Barrier | Companion | Companion -> High-Level Cleric Spell Material | spell | Major clerical barrier / anti-wall lane. | custom |
| Commune | Companion | Companion -> High-Level Cleric Spell Material | spell | Divine consultation / information lane. | undecided |
| Create Food | Companion | Companion -> High-Level Cleric Spell Material | spell | Supply-generation and survival lane. | undecided |
| Create Normal Animals | Companion | Companion -> High-Level Cleric Spell Material | spell | Creature-creation lane distinct from summoning. | undecided |
| Cure Critical Wounds | Companion | Companion -> High-Level Cleric Spell Material | spell | Higher-tier healing upgrade. | direct |
| Cureall | Companion | Companion -> High-Level Cleric Spell Material | spell | Broad healing / cleanse package. | partial |
| Dispel Evil | Companion | Companion -> High-Level Cleric Spell Material | spell | Counterforce / banishment lane. | partial |
| Earthquake | Companion, Master | Companion -> High-Level Cleric Spell Material; Master -> Seventh-Level Cleric Spells | spell | High-tier terrain and structural disruption lane. | undecided |
| Find the Path | Companion | Companion -> High-Level Cleric Spell Material | spell | Navigation and route-certainty lane. | partial |
| Holy Word | Companion, Master | Companion -> High-Level Cleric Spell Material; Master -> Seventh-Level Cleric Spells | spell | High-tier word of power / banishment lane. | undecided |
| Insect Plague | Companion | Companion -> High-Level Cleric Spell Material | spell | Battlefield swarm / area-denial lane. | undecided |
| Quest | Companion | Companion -> High-Level Cleric Spell Material | spell | Compulsion / obligation lane. | custom |
| Raise Dead | Companion | Companion -> High-Level Cleric Spell Material | spell | Companion lane for the classic recognizer before Master expansions. | undecided |
| Raise Dead Fully | Companion, Master | Companion -> High-Level Cleric Spell Material; Master -> Seventh-Level Cleric Spells | spell | Higher-tier resurrection lane. | custom |
| Restore | Companion, Master | Companion -> High-Level Cleric Spell Material; Master -> Seventh-Level Cleric Spells | spell | Restoration / anti-drain / recovery lane. | partial |
| Speak with Monsters | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Monster-communication lane. | undecided |
| Truesight | Companion | Companion -> High-Level Cleric Spell Material | spell | Reveal-all / anti-concealment lane. | partial |
| Word of Recall | Companion | Companion -> High-Level Cleric Spell Material | spell | Return-to-sanctuary transit lane. | partial |

### Companion Druid Additions

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Anti-Animal Shell | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Creature-specific exclusion barrier lane. | undecided |
| Anti-Plant Shell | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Vegetation-specific exclusion barrier lane. | undecided |
| Call Lightning | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Druidic artillery recognizer. | undecided |
| Control Temperature 10' radius | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Environmental control lane. | undecided |
| Control Winds | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Weather and movement-control lane. | undecided |
| Creeping Doom | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | High-tier swarm devastation lane. | undecided |
| Faerie Fire | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Outlining / reveal lane. | undecided |
| Hold Animal | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Beast-specific restraint lane. | undecided |
| Locate | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Druidic animal / plant location lane. | undecided |
| Metal to Wood | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Material transformation lane. | undecided |
| Obscure | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Concealment / weather-obscuration lane. | undecided |
| Pass Plant | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Plant transit lane. | undecided |
| Plant Door | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Vegetation access / doorway lane. | undecided |
| Predict Weather | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Forecast / divination lane. | undecided |
| Produce Fire | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Portable flame / attack lane. | undecided |
| Protection from Lightning | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Elemental defense lane. | undecided |
| Summon Weather | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Weather-calling lane. | undecided |
| Transport Through Plants | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Plant-network transit lane. | undecided |
| Warp Wood | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Wooden-structure deformation lane. | undecided |
| Water Breathing | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Druidic aquatic-access lane. | undecided |
| Weather Control | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic and Magical Spells Lists and Spell Descriptions | spell | High-tier weather command lane crossing druid and arcane lanes in RC. | undecided |

### Master Cleric And Druid Additions

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Detect Danger | Master | Master -> Druid Spell Material | spell | Hazard-sense hybrid lane combining detection and danger reading. | undecided |
| Dissolve | Master | Master -> Druid Spell Material | spell | Terrain-liquefaction lane; compare mud / stone transmutation effects. | undecided |
| Heat Metal | Master | Master -> Druid Spell Material | spell | Sustained heat / anti-armor / concentration-break lane. | undecided |
| Protection from Poison | Master | Master -> Druid Spell Material | spell | Poison immunity and anti-breath lane. | undecided |
| Summon Animals | Master | Master -> Druid Spell Material | spell | Existing high-confidence family lane for druidic ally summoning. | partial |
| Summon Elemental | Master | Master -> Druid Spell Material | spell | Druidic elemental summoning recognizer. | undecided |
| Survival | Master, RC | Master -> Seventh-Level Cleric Spells; RC -> Clerical and Magical Spell Descriptions | spell | Environmental survival and vacuum / plane-hazard protection lane; RC also gives it a magic-user lane. | undecided |
| Travel | Master, RC | Master -> Seventh-Level Cleric Spells; Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Clerical and Magical Spell Descriptions | spell | Composite fly / planar-transfer / gaseous-travel lane; RC confirms cross-tradition use. | custom |
| Turn Wood | Master | Master -> Druid Spell Material | spell | Wooden-object repulsion and battlefield-control lane. | undecided |
| Wish | Master, RC | Master -> Seventh-Level Cleric Spells; Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Clerical and Magical Spell Descriptions | spell | High-tier reality rewrite recognizer; existing SDM variant: `Big Wish`. | custom |
| Wizardry | Master | Master -> Seventh-Level Cleric Spells | spell | Cross-tradition item / scroll use bridge lane. | undecided |

### Master High-Tier Magic-User Additions

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Clone | Master | Master -> Eighth-Level Magic-User Spells | spell | Identity-duplication and backup-body lane. | custom |
| Contingency | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Conditional trigger / prepared response lane. | undecided |
| Create Any Monster | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Extreme creature-creation lane. | undecided |
| Create Magical Monsters | Master | Master -> Eighth-Level Magic-User Spells | spell | Magical-creature fabrication lane. | undecided |
| Dance | Master | Master -> Eighth-Level Magic-User Spells | spell | Forced-movement / compulsion lane. | undecided |
| Explosive Cloud | Master | Master -> Eighth-Level Magic-User Spells | spell | High-tier area hazard lane. | undecided |
| Force Field | Master | Master -> Eighth-Level Magic-User Spells | spell | Premium protective barrier lane. | undecided |
| Gate | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Planar opening / summoning / transit lane. | undecided |
| Heal | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Extreme restoration lane crossing into clerical territory. | undecided |
| Immunity | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | High-tier protection lane. | undecided |
| Mass Charm | Master | Master -> Eighth-Level Magic-User Spells | spell | Group compulsion / social-control lane. | undecided |
| Maze | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Exile / battlefield removal lane. | undecided |
| Meteor Swarm | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Extreme artillery recognizer. | undecided |
| Mind Barrier | Master | Master -> Eighth-Level Magic-User Spells | spell | Mental protection lane. | undecided |
| Permanence | Master | Master -> Eighth-Level Magic-User Spells | spell | Long-term enchantment anchoring lane. | undecided |
| Polymorph Any Object | Master | Master -> Eighth-Level Magic-User Spells | spell | Extreme transmutation lane. | undecided |
| Power Word Blind | Master | Master -> Eighth-Level Magic-User Spells | spell | Word-of-power debilitation lane. | undecided |
| Power Word Kill | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Word-of-power execution lane. | undecided |
| Prismatic Wall | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Complex high-tier barrier lane. | undecided |
| Shapechange | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Supreme self-transformation lane; compare `Skinshift` as family cousin. | undecided |
| Symbol | Master | Master -> Eighth-Level Magic-User Spells | spell | Sigil-trigger and warding lane. | undecided |
| Timestop | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Temporal supremacy lane. | undecided |

### Rules Cyclopedia Catch-Up And Spell Interface Effects

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Analyze | RC | RC -> Magical Spells List and Spell Descriptions | spell | RC first-level magical analysis and inspection recognizer absent from earlier B/X lanes. | undecided |
| Speak with Plants | RC | RC -> Clerical Spells List and Spell Descriptions | spell | Clerical plant-communication lane that rounds out the speak-with progression. | undecided |
| Sticks to Snakes | RC | RC -> Clerical Spells List and Spell Descriptions | spell | Wood-to-serpent transformation and battlefield-weaponization lane. | custom |
| Entangle | RC | RC -> Magical Spells List and Spell Descriptions | spell | RC arcane restraint and vegetation-control lane; notable as a non-druid entanglement entry. | partial |
| Create Air | RC | RC -> Magical Spells List and Spell Descriptions | spell | Environmental survival and sealed-space support lane. | custom |
| Clothform | RC | RC -> Magical Spells List and Spell Descriptions | spell | Soft-material transmutation lane; sibling to later form-spell entries. | undecided |
| Contact Outer Plane | RC | RC -> Magical Spells List and Spell Descriptions | spell | Dangerous intelligence-contact and revelation lane. | custom |
| Feeblemind | RC | RC -> Magical Spells List and Spell Descriptions | spell | Severe cognition-destruction lane. | undecided |
| Move Earth | RC | RC -> Magical Spells List and Spell Descriptions | spell | Large-scale terrain movement recognizer. | undecided |
| Reincarnation | RC | RC -> Magical Spells List and Spell Descriptions | spell | Death-reversal via a new body; distinct from the `Raise Dead` line. | custom |
| Stoneform | RC | RC -> Magical Spells List and Spell Descriptions | spell | Stone transmutation lane within the broader form-spell suite. | undecided |
| Telekinesis | RC | RC -> Magical Spells List and Spell Descriptions | spell | Classic force-manipulation recognizer; compare `Objective Telekinesis` as a likely cousin. | partial |
| Wall of Iron | RC | RC -> Magical Spells List and Spell Descriptions | spell | Durable material barrier and creation lane. | undecided |
| Woodform | RC | RC -> Magical Spells List and Spell Descriptions | spell | Wood transmutation lane paired with the other form spells. | undecided |
| Charm Plant | RC | RC -> Magical Spells List and Spell Descriptions | spell | Plant-specific charm and control lane. | undecided |
| Create Normal Monsters | RC | RC -> Magical Spells List and Spell Descriptions | spell | Monster-creation lane below `Create Magical Monsters` and `Create Any Monster`. | undecided |
| Delayed Blast Fireball | RC, Master | RC -> Magical Spells List and Spell Descriptions; Master -> Artifact Power Doctrine and Artifact Effect Procedures | spell | Timed artillery recognizer related to `Fire Ball / Fireball`. | partial |
| Ironform | RC | RC -> Magical Spells List and Spell Descriptions | spell | Metal transmutation and body-state lane within the form-spell suite. | undecided |
| Lore | RC | RC -> Magical Spells List and Spell Descriptions | spell | Deep-history and object-reading information lane. | undecided |
| Magic Door | RC | RC -> Magical Spells List and Spell Descriptions | spell | Portal and egress manipulation lane with reversible entry-control logic. | undecided |
| Mass Invisibility | RC | RC -> Magical Spells List and Spell Descriptions | spell | Group concealment lane above `Invisibility 10' radius`. | undecided |
| Power Word Stun | RC | RC -> Magical Spells List and Spell Descriptions | spell | Word-of-power incapacitation lane between the blind and kill variants. | undecided |
| Reverse Gravity | RC | RC -> Magical Spells List and Spell Descriptions | spell | Battlefield inversion and area-control lane. | custom |
| Statue | RC | RC -> Magical Spells List and Spell Descriptions | spell | Self-concealment and false-object transformation lane. | undecided |
| Summon Object | RC | RC -> Magical Spells List and Spell Descriptions | spell | Remote retrieval and object-call lane. | partial |
| Sword | RC | RC -> Magical Spells List and Spell Descriptions | spell | Force-weapon and animated blade lane. | undecided |
| Teleport any Object | RC | RC -> Magical Spells List and Spell Descriptions | spell | Object-only transit lane adjacent to `Teleport`. | partial |
| Steelform | RC | RC -> Magical Spells List and Spell Descriptions | spell | Advanced metal transmutation lane in the later form-spell suite. | undecided |
| Communication | RC | RC -> Scrolls | item-effect | Paired remote-writing scroll interface across any distance on the same plane. | partial |
| Creation | RC | RC -> Scrolls | item-effect | Scroll-generated temporary mundane item fabrication procedure. | custom |
| Delay | RC | RC -> Scrolls | item-effect | Scroll-carried delayed-release casting wrapper for one stored spell. | custom |
| Equipment | RC | RC -> Scrolls | item-effect | Scroll that manifests from a fixed list of mundane adventuring gear. | custom |
| Illumination | RC | RC -> Scrolls | item-effect | Reusable flame-scroll utility for sustained light and fire-starting. | direct |
| Mages | RC | RC -> Scrolls | item-effect | Scroll-based nearby magic-effect identification; complements `Read Magic` rather than replacing it. | partial |
| Maps to Treasures / Treasure Maps | Basic, Expert, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | Treasure-location wrapper with normal, magical, combined, and special treasure lanes; niche but reusable lookup surface. | partial |
| Mapping | RC | RC -> Scrolls | item-effect | Scroll-generated area map with limited secret-door detection. | custom |
| Portals | RC | RC -> Scrolls | item-effect | Scroll-native reusable `Pass-Wall / Passwall` interface. | partial |
| Protection / Protection Scrolls | Basic, Expert, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | Generic moving circle-of-protection wrapper shared by the specific protection scroll variants. | partial |
| Protection from Elementals | RC | RC -> Scrolls | item-effect | Circle protection scroll keyed specifically to elementals. | partial |
| Protection from Lycanthropes | RC | RC -> Scrolls | item-effect | Circle protection scroll keyed to lycanthrope types by quantity band. | partial |
| Protection from Magic | RC | RC -> Scrolls | item-effect | Protection-scroll circle that blocks spells and spell effects from crossing the boundary. | custom |
| Protection from Undead | RC | RC -> Scrolls | item-effect | Circle protection scroll keyed to undead by type and quantity. | partial |
| Questioning | RC | RC -> Scrolls | item-effect | Nonliving-object interrogation procedure. | partial |
| Repetition | RC | RC -> Scrolls | item-effect | Scroll wrapper that replays the same-level spell effect after one turn. | custom |
| Seeing | RC | RC -> Scrolls | item-effect | Scroll-based remote creature imaging procedure. | partial |
| Shelter | RC | RC -> Scrolls | item-effect | Pocket-room refuge scroll with supplies and extradimensional trapping edge cases. | custom |
| Spell Scrolls / Spells | Basic, Expert, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | Generic spell-scroll wrapper covering class restrictions, multi-spell payloads, and copy-versus-cast handling. | partial |
| Spell Catching | RC | RC -> Scrolls | item-effect | Catches one incoming spell into scroll capacity bands; explicit Chapter 05 and Chapter 06 bridge behavior. | custom |
| Spell Storing | Expert, Companion | Expert -> Rings; Companion -> Ring Tables | item-effect | Ring-based spell payload storage and later discharge; does not absorb attacks cast at the wearer. | custom |
| Trapping | RC | RC -> Scrolls | item-effect | Scroll-created physical trap keyed by placement surface. | custom |
| Truth | RC | RC -> Scrolls | item-effect | Living-mind question procedure via an enhanced ESP-like readout. | partial |
| Cursed / Cursed Scroll | Basic, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | Immediate curse-on-sight scroll wrapper; niche but persistent enough to deserve a canonical lookup row. | custom |

## Provisional Family Workspace For Chapter 06

### Attack / Force / Battle Magic

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Magic Missile | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Canonical Chapter 06 entry should remain `Magic Missile`. Existing SDM variant: `Tragic Missile` (Vastlands / Apocrypha of the O.S. lane in the Powers Index). | partial |
| Fire Ball / Fireball | Basic, Expert, Master, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Core artillery recognizer across mixed staged-corpus spellings. Existing SDM variant: `Pyreball` (Vastlands / Apocrypha of the O.S. lane in the Powers Index). | partial |

### Detection / Information / Perception

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Detect Magic | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Foundational magic-sense recognizer shared across cleric and magic-user lanes; likely a direct sensory/tagging power. | direct |
| Detect Evil | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Needs care because classic BECMI intent/hostility reading is not identical to a clean moral-alignment scanner. | partial |
| Read Magic | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Scrolls | spell | Core deciphering gate for arcane scroll and spell-book use; likely maps to archive/decoding procedure language as much as to a standalone power. | partial |
| Read Languages | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Straight information-access utility. Existing SDM family variant: `Anti-Babylon` (Eternal Return Key lane in the Powers Index), which broadens the classic language bridge into universal communication. | partial |
| Locate Object | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Search-and-direction utility likely useful for Chapter 06 information/retrieval tags. | direct |
| Truesight | Companion | Companion -> High-Level Cleric Spell Material | spell | Strong full-spectrum perception package for invisibility/ethereal/hidden detection; likely needs a premium reveal tag set. | partial |

### Wards / Barriers / Counterforce

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Protection from Evil | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Hybrid defensive buff plus contact ward against enchanted or summoned beings; not just a generic Defense bonus. | partial |
| Shield | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Clean self-defense shell; likely a direct defensive power template. | direct |
| Resist Fire | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Elemental mitigation template that likely maps cleanly to tagged resistance language. | direct |
| Barrier | Companion | Companion -> High-Level Cleric Spell Material | spell | High-level warding/boundary effect that should help define Chapter 06 barrier taxonomy above simple protection spells. | custom |
| Dispel Evil | Companion | Companion -> High-Level Cleric Spell Material | spell | Counterforce / banishment family member that overlaps with anti-hostile or anti-outsider doctrine rather than plain damage. | partial |

### Movement / Access / Traversal

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Levitate | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Vertical movement utility; likely a direct map. | direct |
| Floating Disc | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Canonical spell name can stay unchanged while pointing to the existing stylized `Floating Disc` UVG variant in the Powers Index. | direct |
| Fly | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Core aerial mobility recognizer needed for personal-scale movement powers and item references. | direct |
| Find the Path | Companion | Companion -> High-Level Cleric Spell Material | spell | Navigation / routing procedure rather than pure movement; useful for Chapter 06 pathfinding and noosphere-guidance tags. | partial |
| Knock | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Canonical lock-opening entry should remain `Knock`; existing SDM variant: `Knock / Lock` (UVG2e spell lane in the Powers Index). | partial |
| Teleport | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Major transit power; likely direct at concept level but will need SDM range / mishap doctrine decisions. | partial |
| Word of Recall | Companion | Companion -> High-Level Cleric Spell Material | spell | Return-to-sanctuary extraction spell with strong campaign-loop implications; likely bridge-heavy rather than a generic teleport clone. | partial |
| Travel | Master, RC | Master -> Seventh-Level Cleric Spells; Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Clerical and Magical Spell Descriptions | spell | Composite package combining flight, planar transfer, and gaseous traversal; probably needs custom Chapter 06 decomposition or a premium bundled power. | custom |

### Control / Restraint / Compulsion

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Sleep | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Classic low-tier disable effect; likely a direct control template. | direct |
| Hold Person | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Straight restraint/paralysis recognizer already central to many fantasy power taxonomies. Existing SDM variant: `Hlod Person` (Vastlands / Apocrypha of the O.S. lane in the Powers Index). | direct |
| Web | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Area denial plus entanglement effect; likely direct. | direct |
| Confusion | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Mind-state disruption effect; needs a clean SDM status / control phrasing pass. | partial |
| Quest | Companion | Companion -> High-Level Cleric Spell Material | spell | Compulsion / obligation spell likely better treated as a vow-binding or command doctrine than a simple status effect. | custom |

### Transformation / Summoning / Creation

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Polymorph Self | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Self-transformation recognizer; likely maps partially because SDM form-change limits still need explicit doctrine. Existing SDM family variant: `Alter Self` (UVG2e spell lane in the Powers Index). | partial |
| Polymorph Other / Others | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Offensive transformation version of the same family; staged sources use both singular and plural forms, so preserve both recognizers. | partial |
| Summon Animals | Master | Master -> Druid Spell Material | spell | Druidic ally-call effect with explicit HD budgeting; useful for summon scaling via SDM Level. | partial |
| Animate Objects | Companion | Companion -> High-Level Cleric Spell Material | spell | Object animation effect that likely maps, but may need gear/object-agent handling. | partial |
| Animate Dead | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Major doctrine carrier for minion control and undead creation; likely requires custom or tightly-scoped overlay language. Existing SDM variant: `Animate Corpse` (UVG2e spell lane in the Powers Index). | custom |
| Clone | Master | Master -> Eighth-Level Magic-User Spells | spell | Identity-duplication / backup-body procedure, clearly beyond a simple direct powers mapping. | custom |

### Restoration / Condition Repair / Life Threshold

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Cure Critical Wounds | Companion | Companion -> High-Level Cleric Spell Material | spell | Straight higher-tier healing upgrade; likely direct. | direct |
| Cureall | Companion | Companion -> High-Level Cleric Spell Material | spell | Broad repair / cleanse package that may collapse several classic condition-removal channels into one SDM power pattern. | partial |
| Restore | Master | Master -> Seventh-Level Cleric Spells | spell | Recovery of drained or diminished capability is important for Chapter 06 recovery taxonomy, but the exact SDM equivalent still needs policy. | partial |
| Raise Dead Fully | Master | Master -> Seventh-Level Cleric Spells | spell | More than basic resurrection; likely needs custom life-restoration doctrine or a high-tier ritual framing. | custom |

### High-Tier Exception / Reality Rewrite

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Wish | Master, RC | Master -> Seventh-Level Cleric Spells; Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Clerical and Magical Spell Descriptions | spell | Canonical spell name should remain `Wish` even where the tone-forward SDM variant is `Big Wish` in the Powers Index. This is exactly the sort of high-recognizer / unique-variant pairing the crosswalk must preserve. | custom |

## Deferred Bundle Notes

- Staff of Power bundle to resolve in the next pass:
	- `Fire Ball / Fireball`
	- `Lightning Bolt`
	- `Ice Storm`
	- `Continual Light`
	- `Telekinesis`
- Staff of Wizardry bundle to resolve in the next pass:
	- `Invisibility`
	- `Pass-Wall / Passwall`
	- `Web`
	- `Conjure Elemental`
	- whirlwind / cone of paralyzation riders
- Staff of Elemental Power still needs a dedicated bridge note pass for effect naming and elemental counter-negation phrasing.

## Implementation Notes

- This seed batch remains valid, but it is now only the first slice of a larger full-spell crosswalk.
- Tranche B adds the first grouped Chapter 06-facing families: detection, wards, movement, control, transformation, summoning, and restoration.
- Tranche B now also records the planning doctrine for existing Luka-style variants: canonical spell names remain the lookup surface, while stylized SDM powers are captured as named variants to point at.
- `partial` is being used where the classic recognizer is clear but the SDM implementation will need storage, retention, trigger, bearer-language, or powers-taxonomy bridge text.
- `custom` is being used where the classic spell is really a bundled subsystem, ritual-grade exception, or doctrine carrier rather than a clean one-power export.
- Existing SDM variants from UVG / VLG / OGA sources should be harvested systematically during the next passes, especially for high-signal canonical names that already have obvious descendants in the Powers Index.
- The staged corpus should now be expanded outward from this seed batch until Chapter 06 can treat the crosswalk as canonical spell-source infrastructure.
