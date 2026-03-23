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

## State of Play

- The six-book staged spell corpus is complete and remains the source of truth for this workspace.
- Phase 1 now carries the flat canonical catalog with cross-tradition `Class(es)/Spell-level` tags preserved where relevant.
- Phase 2 has been remapped into the SDM-first functional family taxonomy used for downstream Chapter 06 planning.
- The grouped-`partial` to flat-`undecided` sync backlog is cleared; current cleanup work is focused on grouped `custom` rows whose Phase 1 notes are still too thin to guide later drafting.
- Existing SDM variants are now being recorded as relationship notes rather than allowed to replace canonical spell recognizers.

## Forward Plan

1. Enrich Phase 1 notes for high-signal grouped `custom` rows so later Chapter 05/06 drafting is not forced to rediscover the same doctrine.
2. Continue the focused `undecided` cleanup passes on overlap-heavy lanes such as aquatic access, high-tier barriers, and plant/weather edge cases.
3. Add relationship notes for likely combined-power or overcharge families where multiple classic spells may collapse into one SDM power progression.
4. Keep the grouped family workspace and flat Phase 1 catalog in lockstep after every status or note promotion.
5. Keep the current family layer stable and solve new ambiguity with note quality, tags, and relationship guidance before considering any further regrouping.

## Reference Reuse Targets

- Reuse [Synthetic_Dream_Machine_04_Powers_Index.md](/home/joshu/Synthetic-Dream-Machine/Synthetic_Dream_Machine_04_Powers_Index.md) for power template shape, storage tags, and existing variant precedent.
- Reuse [Synthetic_Dream_Machine_05_Gear_Index.md](/home/joshu/Synthetic-Dream-Machine/Synthetic_Dream_Machine_05_Gear_Index.md) for ward mechanics, antimagic handling, spell-eater style item interfaces, and storage-facing gear language.
- Reuse [Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_10_Appendix_Null_Referee_Resources.md](/home/joshu/Synthetic-Dream-Machine/Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_10_Appendix_Null_Referee_Resources.md) for tag vocabulary that should inform grouped family heuristics and cross-labels.
- Reuse [Synthetic_Dream_Machine_01_Quickstart.md](/home/joshu/Synthetic-Dream-Machine/Synthetic_Dream_Machine_01_Quickstart.md) for burden, item, and broad powers-access assumptions when the mechanics-delta note needs a canonical anchor.
- Reuse [Synthetic_Dream_Machine_03_Traits_Index.md](/home/joshu/Synthetic-Dream-Machine/Synthetic_Dream_Machine_03_Traits_Index.md) when storage-form differences or bearer-access doctrine suggest trait-side handling such as `Power Scroller`.
- Reuse [Vastlands_Guidebook/Vastlands_Guidebook.md](/home/joshu/Synthetic-Dream-Machine/Vastlands_Guidebook/Vastlands_Guidebook.md) for `Albums of Power`, `Storing Powers`, `Activating Powers`, and `Proper Wizard` as the clearest non-slot precedent set for SDM family naming and power storage behavior.

## Canonical Name / Variant Doctrine

- The crosswalk is keyed by canonical OSR spell or effect name first.
- Existing entries in [Synthetic_Dream_Machine_04_Powers_Index.md](/home/joshu/Synthetic-Dream-Machine/Synthetic_Dream_Machine_04_Powers_Index.md) that clearly descend from classic spells should be treated as unique SDM variants, not as replacements for the canonical row key.
- Chapter 06 should normally list the canonical spell name, then note any existing stylized SDM variant with a `see` pointer.
- The default manuscript pattern is: canonical spell entry first, variant callout second. Example: `Magic Missile` with a note to see `Tragic Missile`.
- A canonical spell may have zero, one, or several existing SDM variants. Record them when they exist; do not force one variant to become the only canonical implementation.
- Existing variant powers are useful precedent for tone, presentation, and implementation direction, but they do not erase the need to preserve the classic recognizer/API surface.

Variant recording rule for this workspace:
- When a clear SDM variant already exists, record it in the row `Notes` field as `Existing SDM variant: <Power Name> (<source lane>)` until or unless the table grows a dedicated variant column.

## Verification Cadence

1. Re-run the flat-row versus grouped-family coverage check after any regrouping or row promotion and confirm there are no ungrouped Phase 1 keys.
2. Re-run the grouped-`partial` and grouped-`custom` spot checks whenever a focused cleanup pass lands so the flat catalog never drifts behind the grouped workspace.
3. Review ECM membership only when a row actually tests the boundary between generic defense and real counter-magitech behavior.
4. Keep the mechanics-delta note concise and stable so later executors do not silently reintroduce slot-era assumptions.

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
| Detect Evil / Know Alignment family | Sense Allegiance | medium-high | Reads a creature's ethics directly and can stun evil targets on contact. | Strong precedent for allegiance-reading and anti-evil detection lanes. |
| Invisibility / concealment family | Ecosphere Veil | medium-high | Makes creatures disregard the target; overcharge reaches effective invisibility and trace suppression. | Strong SDM-native concealment precedent, though it is built on disregard rather than simple optical hiding. |
| Polymorph Self / shapechange family | Skinshift | medium-high | Full body transformation into familiar beast forms with escalating size options. | Stronger and broader than `Alter Self`; likely useful when the transformation pass deepens. |
| Charm Person / Mass Charm family | Hero's Goldenmouth | medium | Crowd-facing charm through rhetoric and trust rather than direct domination. | Better treated as a social-compulsion cousin than a clean exact spell rename. |
| Obscuring mist / fog / concealment family | Yellow Cloud | medium | A 9m cube of sight-blocking dust plus an overcharged dust wall. | Good concealment / battlefield-obscuration precedent. |
| Detect sentience / aura-reading / ESP family | Yellow Foresight | medium | Scans a wide area for the number and general mood of sentients; overcharge nudges attitude. | Good precedent for mood-reading and population-sense divinations. |
| Regeneration / restoration family | Rehoryan's Progressive Restoration | medium-high | Rapid life recovery plus staged bodily repair and regrowth. | Strong precedent for higher-tier restoration/regeneration effects distinct from ordinary cure spells. |
| Cure disease / poison purge / organ repair family | Real-Time Rebuild | high | Explicit power settings flush toxins or afflictions, restore organs, regrow limbs, or rebuild bodies. | One of the strongest SDM precedents for bodily repair, poison purge, and major restoration notes. |
| Raise Dead / soul-return family | Recall Soul | medium-high | Calls back a soul as an ectoplasmic entity that can be captured or redirected into further procedures. | Useful ritual cousin when resurrection conversion needs explicit soul-handling rather than simple revival. |
| Haste / acceleration family | Nunka's Biophysical Overdrive | medium-high | Drives the target into short-term overperformance followed by exhaustion burdens. | Strong speed-boost precedent with explicitly SDM costs and aftermath. |
| Fire Ball / Fireball storage-delivery family | Gem Bomb | medium | Encodes an explosive forcefield into a gem, with overcharge exploding like a Fireball. | Good item-interface cousin for fireburst delivery and storage notes. |

## Active Phase Scope

## Phase 1 Catalog Workspace

Initial flat catalog seed for the full-spell pass. This section is intentionally source-lane oriented rather than family-oriented so uncatalogued names stay visible.

`Class(es)/Spell-level` uses RC shorthand: `C` = cleric, `Dr` = druid, `MU` = magic-user. Duplicate canonical rows keep the full cross-tradition class tags where relevant. Non-spell rows stay blank in this column.

Expert catalog dedupe note: when an Expert-era spell is shared across cleric and magic-user lists, keep one canonical row with full cross-tradition class tags to avoid note drift. Source-era spelling or capitalization variants may be retained only as alias language inside that single row's notes.

### Basic Cleric Foundations

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- | --- |
| Cure Light Wounds | C1 | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Foundational healing support. Existing SDM family variants: `Rehoryan's Progressive Restoration` and `Restorative Slumber`, which frame healing as regenerative or recuperative process rather than instant slot discharge. | partial |
| Detect Evil | C1, MU2 | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Basic cleric foundation spell. | partial |
| Detect Magic | C1, MU1 | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Shared cleric / magic-user recognizer. | direct |
| Light | C1, MU1 | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Shared cross-tradition light / darkness recognizer. | undecided |
| Protection from Evil | C1, MU1 | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Basic cleric defensive barrier spell. | partial |
| Purify Food and Water | C1 | Basic | Basic -> Spell Lists and Basic Spell Descriptions | spell | Basic purification and supply-safety support. Existing SDM family variant: `Process Food`, which turns unsafe or inedible organic matter into workable supplies; `Toxin Render` is a narrower waste-processing cousin rather than a straight purification duplicate. | partial |
| Remove Fear | C1 | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Basic cleric fear-removal spell; Expert adds reverse-effect handling. | undecided |
| Resist Cold | C1 | Basic | Basic -> Spell Lists and Basic Spell Descriptions | spell | Basic cleric resistance foundation. | undecided |

### Basic And Expert Arcane Foundations

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- | --- |
| Charm Person | MU1 | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Core low-tier social control spell. Existing SDM family variant: `Hero's Goldenmouth` (Our Golden Age), which reframes charm as persuasive social capture rather than hard domination. | partial |
| Continual Light | C3, MU2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Higher-tier light / darkness lane. | undecided |
| Detect Evil | C1, MU2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Needs care because classic BECMI intent/hostility reading is not identical to a clean moral-alignment scanner. | partial |
| Detect Invisible | MU2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Arcane perception / anti-concealment lane. Existing SDM family variant: `Eyes of Akaula`, which sees invisible, hidden, departed, and dead things. | partial |
| Dispel Magic | C4, MU3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Major countermagitech recognizer. The grouped ECM pass now treats this as a bespoke conversion anchor rather than an unresolved loose cousin. | custom |
| ESP | MU2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Thought-reading / awareness lane. Existing SDM family variant: `Yellow Foresight`, which reads sentient presence and general mood rather than exact thoughts. | partial |
| Fire Ball / Fireball | MU3 | Basic, Expert, Master, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Mixed staged-corpus spelling: B/X/Master use `Fire Ball`, while RC uses `Fireball`. Existing SDM variant: `Pyreball` (Vastlands / Apocrypha of the O.S.). Keep as a family anchor for the likely fireburst relationship ladder with `Delayed Blast Fireball` and `Meteor Swarm`, not as proof those later entries must stay separate powers. | partial |
| Floating Disc | MU1 | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Existing SDM variant: `Floating Disc` (UVG2e Spells). | direct |
| Fly | MU3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Core aerial movement recognizer. | direct |
| Hold Portal | MU1 | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Low-tier closure / access-control spell. Existing SDM family variant: `Knock / Lock`, whose overcharge explicitly flings a portal open or seals, welds, or fuses it shut. | partial |
| Invisibility | MU2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Core concealment baseline for personal stealth and line-of-sight disruption. Existing SDM family variants: `Ecosphere Veil` for disregard-based stealth and `Yellow Cloud` for visual obscuration. | partial |
| Invisibility 10' radius | MU3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Group concealment extension of the invisibility baseline. `Yellow Cloud` is the clearest existing Luka-style battlefield-scale concealment cousin. | partial |
| Knock | MU2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Existing SDM variant: `Knock / Lock` (UVG2e Spells). | partial |
| Levitate | MU2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Vertical movement recognizer. | direct |
| Light | C1, MU1 | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Arcane first-level light spell; shared with cleric lane. | undecided |
| Lightning Bolt | MU3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Core line-artillery recognizer. | undecided |
| Locate Object | C3, MU2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Arcane search / direction lane. | direct |
| Magic Missile | MU1 | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Existing SDM variant: `Tragic Missile` (Vastlands / Apocrypha of the O.S.). | partial |
| Mirror Image | MU2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Defensive illusion / misdirection lane. | undecided |
| Phantasmal Force | MU2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Core illusion-construction spell. | undecided |
| Protection from Evil | C1, MU1 | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Arcane defensive barrier; shared with cleric lane. | partial |
| Protection from Evil 10' Radius | C4, MU3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Group-radius extension of the protection boundary lane. Canonical Chapter 06 display form is `Protection from Evil 10' Radius`; lowercase `10' radius` is retained as a source alias recognizer. Keep as a partial family variant of `Protection from Evil`. | partial |
| Protection from Normal Missiles | MU3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Projectile-denial boundary lane for nonmagical missile vectors. Chapter 05 should treat this as an ward with explicit projectile-category exceptions rather than a generic defense bonus. | custom |
| Read Languages | MU1 | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Existing SDM family variant: `Anti-Babylon` (Eternal Return Key). | partial |
| Read Magic | MU1 | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Scrolls | spell | Core scroll / spellbook deciphering gate. | partial |
| Shield | MU1 | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Personal defense shell. | direct |
| Sleep | MU1 | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Core low-tier disable spell. | direct |
| Ventriloquism | MU1 | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Sound-projection and false-source deception utility. Primary grouped placement belongs with illusion/deception rather than passage control. | undecided |
| Water Breathing | Dr3, MU3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Aquatic adaptation/access lane that should be modeled as environment-interface doctrine (breath medium override plus pressure/exposure assumptions) rather than simple movement speed text. | custom |
| Web | MU2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Area restraint and denial spell. | direct |
| Wizard Lock | MU2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Arcane closure / keyed barrier lane. Existing SDM family variant: `Knock / Lock`, which already handles opening, locking, and forcibly sealing portals, including resistance from magical locks. | partial |

### Expert Cleric Expansions

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- | --- |
| Bless | C2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Morale and combat blessing lane. | undecided |
| Continual Light | C3, MU2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Clerical light / darkness lane as well as arcane one. | undecided |
| Cure Blindness | C3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Condition-removal lane for sensory impairment. Existing SDM family variants: `Real-Time Rebuild` for bodily restoration and `Restorative Slumber` for longer-form burden/attribute recovery. | partial |
| Cure Disease | C3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Disease-removal and anti-corruption-adjacent lane. Existing SDM family variant: `Real-Time Rebuild`, which explicitly flushes toxins or afflictions and restores damaged systems by power setting. | partial |
| Find Traps | C2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Detection and hazard-reading spell. | undecided |
| Growth of Animal | C3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Creature enhancement / scaling lane. | undecided |
| Hold Person | C2, MU3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Existing SDM variant: `Hlod Person` (Vastlands / Apocrypha of the O.S.). | direct |
| Know Alignment | C2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Alignment/intention interrogation lane used for truthfulness and affiliation reads. | partial |
| Locate Object | C3, MU2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Clerical object-direction lane. | direct |
| Remove Curse | C3, MU4 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Major curse-removal recognizer. | undecided |
| Resist Fire | C2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Fire resistance and mitigation lane. | direct |
| Silence 15' Radius | C2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Anti-speech and anti-spellcasting field lane; grouped ECM pass treats it as a partial noospheric-jamming / casting-denial cousin. | partial |
| Snake Charm | C2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Creature-specific charm/control spell. | undecided |
| Speak with Animals | C2 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Baseline non-human communication lane for ecology and scouting play. | partial |
| Speak with the Dead | C3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Strong family comparison point for `Speak With Husk`. | partial |
| Striking | C3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Weapon augmentation and combat support lane. Existing SDM family variant: `Imbue Edge`, which buffs an edged weapon's damage and lets it harm intangibles for the duration. | partial |
| Animate Dead | C4, MU5 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Clerical necromancy lane for corpse animation, control, and ongoing minion obedience; the same recognizer also appears in arcane spell lists. Keep as custom and treat existing SDM necromancy as relationship guidance into `Animate Corpse` and Undeath-facing doctrine rather than as a flat one-to-one export. | custom |
| Create Water | C4 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Expedition sustainment lane for liquid-resource generation. Existing SDM cousins in `Process Food` and broader survival wrappers support a supply-doctrine mapping without requiring a literal slot-era clone. | partial |
| Cure Serious Wounds | C4 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Mid-tier healing support. Existing SDM family variants: `Rehoryan's Progressive Restoration` and `Real-Time Rebuild`, which provide stronger repair and regrowth scaling. | partial |
| Dispel Magic | C4, MU3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Clerical countermagitech lane. The grouped ECM pass now treats this as a bespoke conversion anchor rather than an unresolved loose cousin. | custom |
| Neutralize Poison | C4 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Poison-cleansing and poison-creation lane. Existing SDM family variant: `Real-Time Rebuild`, which explicitly flushes toxins at lower power settings. | partial |

### Expert High-Tier Arcane Additions

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- | --- |
| Anti-Magic Shell | MU6 | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures | spell | Major counter-magic boundary recognizer. Treat as a bespoke ECM shell with explicit ingress/egress and suppression behavior at boundary edges, not as a generic resistance buff. | custom |
| Animate Dead | C4, MU5 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Existing SDM variant: `Animate Corpse` (UVG2e Spells), but the classic row still needs custom doctrine for command scope, persistence, and corpse-source handling. Treat this as a relationship note, not a replacement. | custom |
| Charm Monster | MU4 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Broad creature-charm lane. Existing SDM family variant: `Hero's Goldenmouth`, but only as a broad persuasive-capture cousin; the current corpus does not yet provide a clean nonhuman domination equivalent. | partial |
| Clairvoyance | MU3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Remote-sight lane. Existing SDM family variant: `Eyes of the Arrow` (Vastlands / The Viridian Practice), a projectile-bound remote sensor. | partial |
| Cloudkill | MU5 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | High-tier battlefield hazard / area denial lane. | undecided |
| Confusion | MU4 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Mind-disruption lane. | partial |
| Conjure Elemental | MU5 | Expert, Companion, Immortals, RC | Expert -> Clerical and Magic-User Spell Expansions; Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items | spell | Foundational elemental-calling recognizer with cross-book spell and item relevance. | partial |
| Death Spell | MU6 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | High-tier kill / sweep spell lane. | undecided |
| Dimension Door | MU4 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Short-range relocation entry that bridges tactical repositioning and teleport doctrine. | partial |
| Disintegrate | MU6 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Matter-destruction lane. | undecided |
| Geas | MU6 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Compulsion / binding lane. | undecided |
| Growth of Plants | MU4 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Terrain / vegetation alteration lane. Existing SDM family variant: `Green Haven`, which coerces vegetation into shelter and thorn barriers; it is a narrower plant-shaping cousin rather than a pure growth accelerator. | partial |
| Hallucinatory Terrain | MU4 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Large-scale illusion / terrain falsification lane. | undecided |
| Haste | MU3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Acceleration and combat-tempo support. Existing SDM family variant: `Nunka's Biophysical Overdrive`, which expresses haste-like speed and output boosts as metabolic overdrive with exhaustion burdens. Likely future relationship-group candidate for a single SDM power with Overcharge riders instead of multiple near-duplicate exports. | partial |
| Hold Monster | MU5 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Higher-tier restraint extension of the hold-family control recognizer. | partial |
| Ice Storm/Wall | MU4 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Hybrid artillery / wall-control lane. | undecided |
| Infravision | MU3 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Sensory enhancement lane. Existing SDM family variant: `Rehoryan's Prophetic Song`, which can grant night vision as a durable biomantic adaptation instead of temporary spell vision. | partial |
| Invisible Stalker | MU6 | Expert, Immortals, RC | Expert -> Clerical and Magic-User Spell Expansions; Immortals -> Section 3: Immortal Magic | spell | Precision servitor-calling lane for pursuit, scouting, and delegated action. | partial |
| Lower Water | MU6 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Hydrology-control and exposure-engineering lane. This should be a custom terrain/environment procedure for level shifting and basin manipulation rather than a simple movement rider. | custom |
| Magic Jar | MU5 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Existing SDM variant: `Magic Jar` (UVG2e Spells). | partial |
| Massmorph | MU4 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Group disguise / illusion-transformation lane. | undecided |
| Pass-Wall / Passwall | MU5 | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Mixed staged-corpus spelling: BECMI lanes often use `Pass-Wall`, while RC uses `Passwall`. Existing SDM family variant: `Linked Portals`, used here as a controlled passage-through-barriers cousin rather than a literal wall-phasing duplicate. | partial |
| Polymorph Other / Others | MU4 | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Mixed staged-corpus form: detailed spell headings use `Polymorph Other`, while some lists and references use `Polymorph Others`. | partial |
| Polymorph Self | MU4 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Existing SDM family variants: `Alter Self`, `Skinshift`. | partial |
| Projected Image | MU6 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Remote duplicate / projection lane. | undecided |
| Remove Curse | C3, MU4 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Arcane curse-removal lane. | undecided |
| Stone to Flesh | MU6 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Petrification-reversal lane. | undecided |
| Teleport | MU5 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Major transit spell; compare `Linked Portals` as a family cousin. | partial |
| Wall of Fire | MU4 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Barrier-plus-damage lane that bridges battlefield denial and direct harm. Treat as partial pending fire-family consolidation with existing fireburst descendants such as `Pyreball`. | partial |
| Wall of Stone | MU5 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Structural barrier/infrastructure creation lane. Keep as custom until Chapter 06 codifies persistent obstacle geometry, breach rules, and noncombat construction handling. | custom |
| Wizard Eye | MU4 | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Remote-sight scouting sensor that pairs cleanly with clairvoyance-like reveal procedures. | partial |

### Companion High-Level Cleric Additions

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- | --- |
| Aerial Servant | C6 | Companion | Companion -> High-Level Cleric Spell Material | spell | Summoned retrieval-agent procedure with logistics and custody implications. | partial |
| Animate Objects | C6 | Companion | Companion -> High-Level Cleric Spell Material | spell | Object animation lane. | partial |
| Barrier | C6 | Companion | Companion -> High-Level Cleric Spell Material | spell | High-tier warding and boundary-control spell that should help define Chapter 06 barrier taxonomy above simple protection buffs, especially exclusion and anti-passage behavior. | custom |
| Commune | C5 | Companion | Companion -> High-Level Cleric Spell Material | spell | Divine consultation and constrained-answer procedure for high-confidence guidance, likely better treated as bespoke oracle/contact doctrine than as ordinary divination throughput. | custom |
| Create Food | C5 | Companion | Companion -> High-Level Cleric Spell Material | spell | Supply-generation and survival support. Existing SDM family variant: `Process Food`, which converts raw matter into usable rations; `Green Haven` is a secondary expedition-sustainment cousin where the classic row is read as camp support rather than pure conjuration. | partial |
| Create Normal Animals | C6 | Companion | Companion -> High-Level Cleric Spell Material | spell | Creature-fabrication lane distinct from summoning. Use as the low-tier anchor of the creation bundle with explicit ecology/load constraints and encounter-pressure outputs. Existing SDM seed power: `Vegetable of Birth` (There A Red Door), which already models creature-seed gestation into full creature emergence. | custom |
| Cure Critical Wounds | C5 | Companion | Companion -> High-Level Cleric Spell Material | spell | Higher-tier healing upgrade. | direct |
| Cureall | C6 | Companion | Companion -> High-Level Cleric Spell Material | spell | Broad healing / cleanse package. | partial |
| Dispel Evil | C5 | Companion | Companion -> High-Level Cleric Spell Material | spell | Counterforce / banishment lane. | partial |
| Earthquake | C7 | Companion, Master | Companion -> High-Level Cleric Spell Material; Master -> Seventh-Level Cleric Spells | spell | High-tier terrain and structural disruption lane. | undecided |
| Find the Path | C6 | Companion | Companion -> High-Level Cleric Spell Material | spell | Navigation and route-certainty lane. | partial |
| Holy Word | C7 | Companion, Master | Companion -> High-Level Cleric Spell Material; Master -> Seventh-Level Cleric Spells | spell | High-tier word of power / banishment lane. Existing SDM family variant: `Sense Allegiance`, which provides the clearest current ethical-targeting plus stun/interdiction cousin, though it is much narrower than the full clerical word-of-power package. | partial |
| Insect Plague | C5 | Companion | Companion -> High-Level Cleric Spell Material | spell | Battlefield swarm / area-denial lane. | undecided |
| Quest | C5 | Companion | Companion -> High-Level Cleric Spell Material | spell | Compulsion / obligation lane that likely needs vow-binding or command-doctrine framing with explicit fulfillment and breach consequences, not just a flat charm/status export. | custom |
| Raise Dead | C5 | Companion | Companion -> High-Level Cleric Spell Material | spell | Companion lane for the classic recognizer before Master expansions. Existing SDM variant: `Raise Dead` (UVG2e Spells), with `Recall Soul` as a strong soul-return ritual cousin where the conversion wants explicit soul-handling. | partial |
| Raise Dead Fully | C7 | Companion, Master | Companion -> High-Level Cleric Spell Material; Master -> Seventh-Level Cleric Spells | spell | Higher-tier resurrection lane beyond basic revival, likely requiring bespoke life-restoration doctrine or ritual-grade threshold handling with explicit body-integrity and post-return consequences rather than a simple stronger `Raise Dead`. | custom |
| Restore | C7 | Companion, Master | Companion -> High-Level Cleric Spell Material; Master -> Seventh-Level Cleric Spells | spell | Restoration / anti-drain / recovery lane. | partial |
| Speak with Monsters | C6 | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Broad creature-negotiation lane beyond animal and plant channels. Existing SDM family variant: `Anti-Babylon` (Eternal Return Key), which generalizes communication across entities rather than preserving narrow species lanes. | partial |
| Truesight | C5 | Companion | Companion -> High-Level Cleric Spell Material | spell | Reveal-all / anti-concealment lane. | partial |
| Word of Recall | C6 | Companion | Companion -> High-Level Cleric Spell Material | spell | Return-to-sanctuary transit lane. | partial |

### Companion Druid Additions

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- | --- |
| Anti-Animal Shell | Dr6 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Creature-class exclusion boundary for fauna and beast-adjacent targets. Treat as boundary taxonomy doctrine (who is denied passage, what qualifies as target class) rather than ordinary protection math. | custom |
| Anti-Plant Shell | Dr5 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Vegetation-class exclusion boundary. This is a custom barrier-interface case for passage denial against plant entities/effects, not a generic resistance shell. | custom |
| Call Lightning | Dr3 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Druidic artillery recognizer. | undecided |
| Control Temperature 10' radius | Dr4 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Environmental control lane. | undecided |
| Control Winds | Dr5 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Directional weather-force control with direct movement, hazard, and projectile-pressure implications. Keep as custom environment-control doctrine pending full weather suite normalization. | custom |
| Creeping Doom | Dr7 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | High-tier swarm devastation lane. | undecided |
| Faerie Fire | Dr1 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Outlining / reveal lane. | undecided |
| Hold Animal | Dr3 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Beast-specific restraint lane. | undecided |
| Locate | Dr1 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Druidic animal / plant location lane. | undecided |
| Metal to Wood | Dr7 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Material transformation lane. | undecided |
| Obscure | Dr2 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Concealment / weather-obscuration lane. Existing SDM family variant: `Yellow Cloud`, which creates an opaque dust veil and can overcharge into an immobile wall of obscuring material. Primary placement belongs with terrain/environment because the effect works by materially altering battlefield atmosphere rather than pure false imagery. | partial |
| Pass Plant | Dr5 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Plant transit lane. Existing SDM family variant: `Linked Portals`, used here as a traversal cousin rather than a literal vegetation-only doorway. Primary placement stays with mobility because the row's job is passage, not plant reshaping. | partial |
| Plant Door | Dr4 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Vegetation access / doorway lane. Existing SDM family variant: `Linked Portals`, which is the closest current controlled-passage precedent even though the classical wrapper is plant-specific. | partial |
| Predict Weather | Dr1 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Forecast and horizon-reading lane. Treat as a custom environment-intelligence interface feeding travel and hazard-prep procedures rather than generic divination. | custom |
| Produce Fire | Dr2 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Portable flame / attack lane. | undecided |
| Protection from Lightning | Dr4 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Elemental defense lane. | undecided |
| Summon Weather | Dr6 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Weather-calling and macro-environment override lane. Keep as custom until weather-scale intensity, duration, and collateral doctrine are codified. | custom |
| Transport Through Plants | Dr6 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Plant-network transit lane. Existing SDM family variant: `Linked Portals`, which already expresses location-bridging as a distinct traversal procedure. | partial |
| Warp Wood | Dr2 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Wooden-structure deformation lane. | undecided |
| Water Breathing | Dr3, MU3 | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Druidic aquatic adaptation/access lane that should be modeled as environment-interface doctrine (breath medium override plus pressure/exposure assumptions). | custom |
| Weather Control | Dr7, MU6 | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic and Magical Spells Lists and Spell Descriptions | spell | High-tier weather command lane crossing druidic and arcane traditions. Keep as custom suite anchor for chapter-scale climate control, hazard shaping, and travel pressure. | custom |

### Master Cleric And Druid Additions

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- | --- |
| Detect Danger | Dr1 | Master | Master -> Druid Spell Material | spell | Hazard-sense hybrid lane combining detection and danger reading. Existing SDM family variant: `Yellow Foresight`, which scans a wide area for sentients and general mood. | partial |
| Dissolve | Dr5, MU5 | Master | Master -> Druid Spell Material | spell | Terrain-liquefaction lane; compare mud / stone transmutation effects. | undecided |
| Heat Metal | Dr2 | Master | Master -> Druid Spell Material | spell | Sustained heat / anti-armor / concentration-break lane. | undecided |
| Protection from Poison | Dr3 | Master | Master -> Druid Spell Material | spell | Poison immunity and anti-breath lane. Existing SDM family variant: `Real-Time Rebuild`, which is still a recovery-style toxin-handling cousin rather than true prophylactic immunity, so this remains only a partial match. | partial |
| Summon Animals | Dr4 | Master | Master -> Druid Spell Material | spell | Existing high-confidence family lane for druidic ally summoning. | partial |
| Summon Elemental | Dr7 | Master | Master -> Druid Spell Material | spell | Druidic elemental-calling lane complementary to Conjure Elemental. | partial |
| Survival | C7, MU9 | Master, RC | Master -> Seventh-Level Cleric Spells; RC -> Clerical and Magical Spell Descriptions | spell | Hazard-environment life support package for void, plane, and extreme condition play. | partial |
| Travel | C7, MU8 | Master, RC | Master -> Seventh-Level Cleric Spells; Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Clerical and Magical Spell Descriptions | spell | Composite traversal package combining flight, gaseous movement, and adjacent-plane transfer; probably needs Chapter 06 decomposition or a premium bundled mobility power with environment/survival riders instead of a flat one-to-one export. | custom |
| Turn Wood | Dr6 | Master | Master -> Druid Spell Material | spell | Wooden-object repulsion and vector-redirection lane. Treat as a custom material-interaction control effect with explicit category targeting and displacement behavior. | custom |
| Wish | C7, MU9 | Master, RC | Master -> Seventh-Level Cleric Spells; Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Clerical and Magical Spell Descriptions | spell | High-tier reality rewrite recognizer; existing SDM variant: `Big Wish`. Preserve `Wish` as the canonical heading and treat `Big Wish` as the tone-forward descendant, with later conversion likely framed as ritual-grade exception doctrine rather than an ordinary Chapter 06 export. | custom |
| Wizardry | C7 | Master | Master -> Seventh-Level Cleric Spells | spell | Cross-tradition item / scroll use bridge lane. | undecided |

### Master High-Tier Magic-User Additions

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- | --- |
| Clone | MU8 | Master | Master -> Eighth-Level Magic-User Spells | spell | Identity-duplication and backup-body procedure with delayed death-insurance implications, clearly beyond a simple one-power mapping and likely needing custom continuity/body-vault doctrine. | custom |
| Contingency | MU9 | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Conditional trigger/do-if framework for precommitted defensive or utility responses. Treat as custom meta-procedure because Chapter 06 needs explicit trigger grammar, stored payload scope, and precommit limits. | custom |
| Create Any Monster | MU9 | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Apex creature-fabrication endpoint with broadest taxonomy scope. Capstone of the creation bundle above normal and magical tiers; requires strict doctrine for command reliability, persistence failure modes, and campaign-scale ecosystem/faction impact. | custom |
| Create Magical Monsters | MU8 | Master | Master -> Eighth-Level Magic-User Spells | spell | High-tier magical-creature fabrication lane. Midpoint of the creation bundle between normal-monster and any-monster endpoints, with explicit complexity, special-ability budgeting, and control-burden escalation. | custom |
| Dance | MU8 | Master | Master -> Eighth-Level Magic-User Spells | spell | Forced-movement / compulsion lane. | undecided |
| Explosive Cloud | MU8 | Master | Master -> Eighth-Level Magic-User Spells | spell | High-tier area hazard lane. | undecided |
| Force Field | MU8 | Master | Master -> Eighth-Level Magic-User Spells | spell | Premium structural barrier lane and Chapter 05 interface anchor for layered ward persistence, directional blocking, and throughput exceptions. | custom |
| Gate | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Planar aperture and translocation endpoint for high-tier traversal and summoning crossover, likely a bespoke apex mobility/interface effect rather than a generic teleport derivative. | custom |
| Heal | MU9 | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Extreme recovery recognizer crossing clerical and arcane traditions at high tier, likely collapsing multiple cure/cleanse/restoration lanes into one bespoke capstone recovery procedure. | custom |
| Immunity | MU9 | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Apex blanket-protection lane spanning broad hazard categories. Keep as custom until Chapter 06 sets explicit immunity scope boundaries and exception taxonomy. | custom |
| Mass Charm | MU8 | Master | Master -> Eighth-Level Magic-User Spells | spell | Group compulsion / social-control lane. | undecided |
| Maze | MU9 | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Exile and battlefield-removal boundary effect. Keep as custom due its spatial-separation logic and return-condition doctrine requirements. | custom |
| Meteor Swarm | MU9 | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Extreme artillery recognizer and capstone of the fireburst relationship ladder above `Fire Ball / Fireball` and `Delayed Blast Fireball`. Keep as custom for Phase 1 because the current corpus does not justify a clean direct export, but note the likely future overcharge-family relationship. | custom |
| Mind Barrier | MU8 | Master | Master -> Eighth-Level Magic-User Spells | spell | High-tier noospheric defense lane for hostile mental influence suppression. Keep as custom until mental-defense tags and intrusion categories are normalized. | custom |
| Permanence | MU8 | Master | Master -> Eighth-Level Magic-User Spells | spell | Long-term enchantment anchoring and persistence-lock doctrine. Treat as custom because Chapter 06 must define what can be bound, maintenance costs/risks, and conditions for safe removal or collapse. | custom |
| Polymorph Any Object | MU8 | Master | Master -> Eighth-Level Magic-User Spells | spell | Extreme transmutation endpoint that extends polymorph doctrine beyond creature targets and should remain a custom ceiling case for later Chapter 06 handling. Treat this as a relationship note to the broader polymorph suite, not as evidence for a simple direct map. | custom |
| Power Word Blind | MU8 | Master | Master -> Eighth-Level Magic-User Spells | spell | Word-of-power debilitation lane. | undecided |
| Power Word Kill | MU9 | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Word-of-power execution lane. | undecided |
| Prismatic Wall | MU9 | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Complex high-tier barrier lane. The current SDM corpus does not provide a close named layered-spectrum wall analogue, so this likely needs bespoke high-tier barrier text rather than a borrowed family variant. | custom |
| Shapechange | MU9 | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Supreme self-transformation lane and ceiling case for self-directed form doctrine; compare `Skinshift` only as a distant family cousin. Keep as custom until Chapter 06 fixes duration, capability inheritance, and identity-stability policy. | custom |
| Symbol | MU8 | Master | Master -> Eighth-Level Magic-User Spells | spell | Sigil-triggered boundary hazard lane. Treat as a custom trigger-interface package (condition, payload, and reset doctrine) instead of a plain static trap export. | custom |
| Timestop | MU9 | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Temporal supremacy lane and action-economy exception effect. Keep as custom because it rewrites scene sequencing rather than merely granting speed, and should remain separate from the ordinary acceleration family unless later doctrine proves otherwise. | custom |

### Rules Cyclopedia Catch-Up And Spell Interface Effects

| Classic Name | Class(es)/Spell-level | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- | --- |
| Analyze | MU1 | RC | RC -> Magical Spells List and Spell Descriptions | spell | RC-first analysis and inspection recognizer that broadens low-tier magical diagnostics. | partial |
| Speak with Plants | C4 | RC | RC -> Clerical Spells List and Spell Descriptions | spell | Plant-sentience communication lane that completes the speak-with progression. Existing SDM family variant: `Anti-Babylon` (Eternal Return Key), which already covers communication with plants, animals, minerals, and data stores. | partial |
| Sticks to Snakes | C4 | RC | RC -> Clerical Spells List and Spell Descriptions | spell | Wood-to-serpent transformation and battlefield-weaponization lane. Keep as custom until material-to-creature conversion, obedience scope, and reversion/persistence rules are normalized. | custom |
| Entangle | MU2 | RC | RC -> Magical Spells List and Spell Descriptions | spell | RC arcane restraint and vegetation-control lane; notable as a non-druid entanglement entry. | partial |
| Create Air | MU3 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Environmental survival and sealed-space support lane for vacuum, underwater, or enclosed-hazard play; likely a bespoke sustainment wrapper unless folded into broader life-support doctrine. | custom |
| Clothform | MU4 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Soft-material transmutation lane; sibling to later form-spell entries. | undecided |
| Contact Outer Plane | MU5 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Dangerous intelligence-contact and revelation procedure that reaches across planar distance with explicit backlash risk; better treated as bespoke high-tier inquiry doctrine than generic divination. | custom |
| Feeblemind | MU5 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Severe cognition-destruction lane. | undecided |
| Move Earth | MU6 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Massive terrain repositioning and landscape engineering recognizer. Existing SDM family variant: `Dryland Sculpture`, which is a smaller-scale but high-confidence terrain-forming and infrastructure-shaping cousin rather than a direct mass-displacement duplicate. | partial |
| Reincarnation | MU6 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Death-reversal via a new body rather than simple revival, so it should stay distinct from the `Raise Dead` line and carry replacement-form consequences in any later conversion. | custom |
| Stoneform | MU6 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Stone transmutation lane within the broader form-spell suite. | undecided |
| Telekinesis | MU5 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Classic force-manipulation recognizer; compare `Objective Telekinesis` as a likely cousin. | partial |
| Wall of Iron | MU6 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Durable material barrier plus infrastructure fabrication lane. Keep as custom where chapter procedures need explicit creation-versus-obstruction handling for persistent iron mass. | custom |
| Woodform | MU5 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Wood transmutation lane paired with the other form spells. | undecided |
| Charm Plant | MU7 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Plant-specific command/control lane. Keep as custom until plant-agency and obedience boundaries are normalized against broader influence doctrine. | custom |
| Create Normal Monsters | MU7 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Mid-tier creature-fabrication lane below magical and any-monster endpoints. In the creation bundle, this is the first monster-grade step after `Create Normal Animals`, with bounded taxonomy and encounter-pressure outputs. | custom |
| Delayed Blast Fireball | MU7 | RC, Master | RC -> Magical Spells List and Spell Descriptions; Master -> Artifact Power Doctrine and Artifact Effect Procedures | spell | Timed artillery recognizer related to `Fire Ball / Fireball`. Treat as the middle rung in the likely fireburst relationship ladder rather than as proof of a mandatory standalone export. | partial |
| Ironform | MU7 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Metal transmutation and body-state lane within the form-spell suite. | undecided |
| Lore | MU7 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Deep-history and object-reading lane useful for premium information-retrieval tags. | partial |
| Magic Door | MU7 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Portal and egress manipulation lane with reversible entry-control logic. Existing SDM family variant: `Linked Portals`, which is the clearest current astral-bridge precedent for controlled passage and reversible entry. | partial |
| Mass Invisibility | MU7 | RC | RC -> Magical Spells List and Spell Descriptions | spell | High-tier crowd concealment lane above the 10-foot-radius variant. `Yellow Cloud` remains the strongest existing crowd-obscuration precedent in the current SDM corpus. | partial |
| Power Word Stun | MU7 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Word-of-power incapacitation lane between the blind and kill variants. | undecided |
| Reverse Gravity | MU7 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Battlefield-physics inversion and area-control exception effect, likely requiring custom environmental resolution language instead of ordinary force-attack mapping. | custom |
| Statue | MU7 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Self-concealment and false-object transformation lane. | undecided |
| Summon Object | MU7 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Remote retrieval and object-call lane. | partial |
| Sword | MU7 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Force-weapon and animated blade lane. | undecided |
| Teleport any Object | MU7 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Object-only transit lane adjacent to `Teleport`. | partial |
| Steelform | MU8 | RC | RC -> Magical Spells List and Spell Descriptions | spell | Advanced metal transmutation lane in the later form-spell suite. | undecided |
| Communication |  | RC | RC -> Scrolls | item-effect | Paired remote-writing scroll interface across any distance on the same plane. | partial |
| Creation |  | RC | RC -> Scrolls | item-effect | Scroll-generated temporary mundane item fabrication procedure. | custom |
| Delay |  | RC | RC -> Scrolls | item-effect | Scroll-carried delayed-release wrapper for one stored spell payload; Chapter 05 should model this as a trigger/interface note with deferred activation timing rather than as held slot-state. | custom |
| Equipment |  | RC | RC -> Scrolls | item-effect | Scroll that manifests from a fixed list of mundane adventuring gear. | custom |
| Illumination |  | RC | RC -> Scrolls | item-effect | Reusable flame-scroll utility for sustained light and fire-starting. | direct |
| Mages |  | RC | RC -> Scrolls | item-effect | Scroll-based nearby magic-effect identification; complements `Read Magic` rather than replacing it. | partial |
| Maps to Treasures / Treasure Maps |  | Basic, Expert, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | Treasure-location wrapper with normal, magical, combined, and special treasure lanes; niche but reusable lookup surface. | partial |
| Mapping |  | RC | RC -> Scrolls | item-effect | Scroll-generated area map with limited secret-door detection. | custom |
| Portals |  | RC | RC -> Scrolls | item-effect | Scroll-native reusable `Pass-Wall / Passwall` interface. | partial |
| Protection / Protection Scrolls |  | Basic, Expert, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | Generic moving circle-of-protection wrapper shared by the specific protection scroll variants. | partial |
| Protection from Elementals |  | RC | RC -> Scrolls | item-effect | Circle protection scroll keyed specifically to elementals. | partial |
| Protection from Lycanthropes |  | RC | RC -> Scrolls | item-effect | Circle protection scroll keyed to lycanthrope types by quantity band. | partial |
| Protection from Magic |  | RC | RC -> Scrolls | item-effect | Protection-scroll ECM ward that blocks spells and spell effects from crossing the boundary; useful as a Chapter 05 boundary-interface model for denial fields rather than generic resistance. | custom |
| Protection from Undead |  | RC | RC -> Scrolls | item-effect | Circle protection scroll keyed to undead by type and quantity. | partial |
| Questioning |  | RC | RC -> Scrolls | item-effect | Nonliving-object interrogation procedure. | partial |
| Repetition |  | RC | RC -> Scrolls | item-effect | Scroll wrapper that replays the same-level spell effect after one turn. | custom |
| Seeing |  | RC | RC -> Scrolls | item-effect | Scroll-based remote creature imaging procedure. | partial |
| Shelter |  | RC | RC -> Scrolls | item-effect | Pocket-room refuge scroll with supplies and extradimensional trapping edge cases. | custom |
| Spell Scrolls / Spells |  | Basic, Expert, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; Expert -> Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | Generic spell-scroll wrapper covering class restrictions, multi-spell payloads, and copy-versus-cast handling. | partial |
| Spell Catching |  | RC | RC -> Scrolls | item-effect | Catches one incoming spell into scroll capacity bands; strong Chapter 05/06 bridge case for hostile-power capture into storage media using explicit Power Level capacity rather than slot logic. | custom |
| Spell Storing |  | Expert, Companion | Expert -> Rings; Companion -> Ring Tables | item-effect | Ring-based spell payload storage and later discharge; should convert as an item-side power archive with Power Level capacity and release rules, not as prepared-slot retention, and it does not absorb attacks cast at the wearer. | custom |
| Trapping |  | RC | RC -> Scrolls | item-effect | Scroll-created physical trap keyed by placement surface. | custom |
| Truth |  | RC | RC -> Scrolls | item-effect | Living-mind question procedure via an enhanced ESP-like readout. | partial |
| Cursed / Cursed Scroll |  | Basic, RC | Basic -> Scrolls and Spell-Adjacent Treasure Text; RC -> Scrolls | item-effect | Immediate curse-on-sight scroll wrapper; niche but persistent enough to deserve a canonical lookup row. | custom |
| Ring of Elemental Adaptation |  | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings | item-effect | Elemental-environment survival and traversal interface; strong bridge to elemental-travel procedures. | partial |
| Ring of Holiness |  | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings | item-effect | Cleric/druid power-augmentation wrapper tied to ring use; later conversion should express this as eligibility, blessing-layer access, or reduced burden around holy/nature powers rather than extra slot grant. | custom |
| Ring of Life Protection |  | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings | item-effect | Anti-drain and life-threshold safeguard interface with finite depletion behavior; useful as a threshold-protection model distinct from ordinary healing because it prevents or defers loss rather than repairing it after the fact. | custom |
| Ring of Memory |  | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings | item-effect | Spell recall/recovery interface with clear Chapter 05/06 retention implications; likely better modeled as archive recall, refresh, or reduced-burden access than as literal memorization reset. | custom |
| Ring of Remedies |  | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings | item-effect | Bundled condition-repair and cleansing wrapper across multiple cure lanes; likely a reusable Chapter 05 model for one item exposing several tagged recovery functions instead of one-to-one spell copies. | custom |
| Ring of Spell Eating |  | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings | item-effect | Hostile spell-defense and absorption interface distinct from plain spell turning; a core Chapter 05 ECM item case for canceling or consuming incoming powers instead of merely reflecting them. | custom |
| Ring of Survival |  | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings | item-effect | Environmental hardening and hazard-resistance wrapper at item scale. | partial |
| Staff of Dispelling |  | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods | item-effect | Touch-based targeted dispel interface with special handling for potions, scrolls, and permanent items; likely a key Chapter 05 example for using `Level` as counterforce strength while preserving carrier-specific edge cases. | custom |
| Staff of the Druids |  | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods | item-effect | Druid power-augmentation and charge-linked upkeep interface; should convert as attuned access to druidic functions or bundled powers rather than as raw slot augmentation. | custom |
| Staff of an Element |  | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods | item-effect | Element-tuned summoning, negation, and planar operation interface; includes multi-element and elemental-power variants, so it is a strong Chapter 05 bundle case rather than a single-spell export. | custom |
| Staff of Harming |  | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods | item-effect | Reversed-healing harm wrapper with charge-costed curse-side effects. | custom |
| Rod of Health |  | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods | item-effect | Permanent healing and recovery interface at rod scale. | partial |
| Rod of the Wyrm |  | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods | item-effect | High-tier draconic transformation/summoning interface with alignment gating. | custom |
| Quill of Copying |  | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Miscellaneous Items | item-effect | Spell transcription and copy-risk procedure; strong Chapter 05/06 spell-handling bridge. | custom |
| Talisman of Elemental Travel |  | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Miscellaneous Items | item-effect | Elemental-plane transit and safety wrapper with lesser/greater variants; useful as a Chapter 05 model for travel interfaces that bundle adaptation, safe passage, and return logic. | custom |
| Slate of Identification |  | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Miscellaneous Items | item-effect | Item-identification procedure surface distinct from `Read Magic` and `Mages` scroll behavior. | partial |
| Artifact Activation |  | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Activation/discovery interface for artifact powers; supports staged unlock and control workflows. | custom |
| Artifact Charges And Recharge |  | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Artifact power-budget, charge-drain, and recharge-cycle doctrine for repeated effect use. | custom |
| Artifact Intelligence And Auto-Defense |  | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Rudimentary artifact agency and self-defense behavior when attacked or endangered. | custom |
| Artifact Handicaps And Penalties |  | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Core adverse-effect framework for mortal artifact users (permanent handicaps and temporary penalties). | custom |
| Attacking An Artifact |  | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Artifact durability, damage thresholds, power loss, and recall behavior under sustained attacks. | custom |
| Destruction Of An Artifact |  | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Permanent-destruction quest procedure and Immortal-response consequences. | custom |
| Creating Artifacts |  | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Artifact design workflow including magnitude, power limits, activation model, and adverse-effect selection. | custom |
| Immortal Magical Effect Index (S1-S4) |  | Immortals | Immortals -> Section 3: Immortal Magic -> General Notes, Charts S1-S4 | procedure | Reference-index procedure for mapping mortal and non-spell effects to Immortal power-cost handling. | custom |
| Immortal Caster Level Rule |  | Immortals | Immortals -> Section 3: Immortal Magic -> Caster Level | procedure | Sets effective caster level at 2 x HD for all created effects and dispel interactions. | custom |
| Immortal Range / Duration Scaling |  | Immortals | Immortals -> Section 3: Immortal Magic -> Changing Range and Duration | procedure | Cost-doubling framework for extending range, duration, and effect volume, including planar-path limits. | custom |
| Immortal Conjuring And Summoning Limits |  | Immortals | Immortals -> Section 3: Immortal Magic -> Conjuring and Summoning | procedure | Defines transplanar response requirements and sphere/element bias constraints on conjured or summoned entities. | custom |
| Immortal Damage Scaling And Averaging |  | Immortals | Immortals -> Section 3: Immortal Magic -> Damage | procedure | High-tier damage rule set using HD-based dice and optional average-damage method for faster resolution. | custom |
| Immortal Mental Effect Resolution |  | Immortals | Immortals -> Section 3: Immortal Magic -> Mental Effects | procedure | Non-magical recovery cadence for charmed/feebleminded Immortals via Intelligence checks plus save retries. | custom |
| Immortal Limits On Use |  | Immortals | Immortals -> Section 3: Immortal Magic -> Limits on Use | procedure | Action-economy and target-scope doctrine for created effects, including self-only effects delivered by touch. | custom |

## Provisional Family Workspace For Chapter 06

### SDM Family Doctrine For This Remap

- This pass is organizing import and conversion notes, not asserting literal one-to-one SDM powers yet.
- Canonical BECMI/RC names remain the lookup keys; SDM family labels only reorganize the grouped workspace for later conversion.
- For referee and dev readability, read each grouped heading as `Primary Family / Functional Subfamily / Functional Subfamily`. The first term is the stable bucket. The later terms are only navigation aids.
- Prefer a stable top-level family set for implementation work: `Battle and Force`, `Knowledge and Revelation`, `Defense and Boundaries`, `Countermagitech`, `Mobility and Access`, `Influence and Control`, `Veils and Illusions`, `Transformation and Fabrication`, `Terrain and Environment`, `Summons and Servitors`, `Communication and Inquiry`, `Restoration and Thresholds`, `Interfaces and Scrollcraft`, and `Meta-Doctrine and Exceptions`.
- Family assignment follows this order: primary theme/doctrine, then storage mode (`trait`, `item`, `burden`, `location`), then secondary tags such as `ward`, `healing`, `recon`, `summon`, `mobility`, `signal`, `artifact`, `curse`, and `reality`.
- Use tags and relationship notes for nuance; do not solve every ambiguity by minting new family headings.
- `magitech` and `fantascience` remain cross-cutting flavor and implementation tags, not primary family names.
- Vancian versus SDM delta to preserve during later conversion: powers persist after use, use costs Life rather than prepared slots, access is by acquisition rather than class list, and high-tier effects are gated by danger, corruption, rarity, or ritual burden rather than by daily slot scarcity.
- Source-era storage mechanics such as `Spell Storing` should be carried forward as conversion notes toward trait/item/burden interfaces, not reintroduced as prepared-slot subsystems.
- If a section is mostly about scroll wrappers, archive behavior, spell storage, or treasure-device operations, prefer `Interfaces and Scrollcraft` over forcing it into countermagitech.
- Related OSR spell ladders may collapse into one future SDM power with Overcharge riders rather than separate exports. Candidate relationship groups include `Fire Ball / Fireball` -> `Delayed Blast Fireball` -> `Meteor Swarm`, and `Haste` plus later acceleration variants.
- Ethereal Counter Magitech (ECM) remains a first-class concept inside `Countermagitech`. It covers suppression, negation, reflection, capture, cancellation, and noospheric interference rather than generic defense or generic cleansing.
- Use an `ecm` tag for rows that meet the thematic and mechanical criteria even when the row also belongs in another family such as barriers or weather.

### Borderline Family Notes

- `Countermagitech` versus `Interfaces and Scrollcraft`: use `Countermagitech` when the effect suppresses, catches, dispels, blocks, reflects, or jams hostile magic; use `Interfaces and Scrollcraft` when the row is mainly about storage, activation, copying, delayed release, or treasure-device handling.
- `Knowledge and Revelation` versus `Veils and Illusions`: anti-concealment lives under `Knowledge and Revelation`; concealment, disguise, proxy images, and false stimuli live under `Veils and Illusions`. Some pairs such as `Detect Invisible` and `Invisibility` are intentionally mirror cases across the boundary.
- `Restoration and Thresholds` versus `Transformation and Fabrication`: healing, cure, resurrection, and recovery stay in `Restoration and Thresholds`; regrowth, mutation, body editing, and form rewriting stay in `Transformation and Fabrication`. Biomantic rebuild powers may be cited in both notes, but should still get one primary placement.
- `Mobility and Access` versus `Defense and Boundaries`: passage, transit, relocation, and route certainty live under `Mobility and Access`; locks, wards, seals, exclusion zones, and persistent boundary control live under `Defense and Boundaries`.
- `Summons and Servitors` versus `Transformation and Fabrication`: called agents, servitors, elementals, and delegated entities live under `Summons and Servitors`; created or altered bodies, matter reshaping, and fabricated forms live under `Transformation and Fabrication`.
- `Support and Augmentation` versus `Terrain and Environment`: expedition sustainment, buffs, survival prep, and supply safety live under `Support and Augmentation`; macro weather, landscape, and infrastructure manipulation live under `Terrain and Environment`, even when the practical use is still camp support.
- `Communication and Inquiry` versus `Influence and Control`: asking, translating, consulting, and establishing a channel live under `Communication and Inquiry`; compelled obedience, rhetorical capture, banishing speech-acts, and command-binding live under `Influence and Control`, even when words are the delivery mechanism.
- `Veils and Illusions` versus `Terrain and Environment`: if the row mainly lies about the battlefield or denies sight without materially changing the world, keep it under `Veils and Illusions`; if it physically reshapes plants, stone, weather, or terrain, keep it under `Terrain and Environment`.

### Battle and Force / Artillery / Pressure

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Magic Missile | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Canonical Chapter 06 entry should remain `Magic Missile`. Existing SDM variant: `Tragic Missile` (Vastlands / Apocrypha of the O.S. lane in the Powers Index). | partial |
| Fire Ball / Fireball | Basic, Expert, Master, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Core artillery recognizer across mixed staged-corpus spellings. Existing SDM variant: `Pyreball` (Vastlands / Apocrypha of the O.S. lane in the Powers Index). | partial |
| Lightning Bolt | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Core line-artillery recognizer that should sit beside fireburst effects in the base attack family. | direct |
| Delayed Blast Fireball | RC, Master | RC -> Magical Spells List and Spell Descriptions; Master -> Artifact Power Doctrine and Artifact Effect Procedures | spell | Timed artillery variant of the fireburst family with explicit delay mechanics. | partial |
| Meteor Swarm | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Extreme area-artillery endpoint for high-tier offensive scaling doctrine. Treat as the current fireburst capstone and keep custom until Chapter 06 decides whether this remains a separate apex effect or an overcharge endpoint above `Fire Ball / Fireball` and `Delayed Blast Fireball`. | custom |

### Knowledge and Revelation / Detection / Perception

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Detect Magic | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Foundational magic-sense recognizer shared across cleric and magic-user lanes; likely a direct sensory/tagging power. | direct |
| Detect Evil | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Needs care because classic BECMI intent/hostility reading is not identical to a clean moral-alignment scanner. | partial |
| Read Languages | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Straight information-access utility. Existing SDM family variant: `Anti-Babylon` (Eternal Return Key lane in the Powers Index), which broadens the classic language bridge into universal communication. | partial |
| Locate Object | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Search-and-direction utility likely useful for Chapter 06 information/retrieval tags. | direct |
| Truesight | Companion | Companion -> High-Level Cleric Spell Material | spell | Strong full-spectrum perception package for invisibility/ethereal/hidden detection; likely needs a premium reveal tag set. | partial |
| Analyze | RC | RC -> Magical Spells List and Spell Descriptions | spell | RC-first analysis and inspection recognizer that broadens low-tier magical diagnostics. | partial |
| Wizard Eye | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Remote-sight scouting sensor that pairs cleanly with clairvoyance-like reveal procedures. | partial |
| Lore | RC | RC -> Magical Spells List and Spell Descriptions | spell | Deep-history and object-reading lane useful for premium information-retrieval tags. | partial |

### Defense and Boundaries / Wards / Barriers

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Protection from Evil | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Hybrid defensive buff plus contact ward against enchanted or summoned beings; not just a generic Defense bonus. | partial |
| Shield | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Clean self-defense shell; likely a direct defensive power template. | direct |
| Resist Fire | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Elemental mitigation template that likely maps cleanly to tagged resistance language. | direct |
| Barrier | Companion | Companion -> High-Level Cleric Spell Material | spell | High-level warding/boundary effect that should help define Chapter 06 barrier taxonomy above simple protection spells. | custom |
| Dispel Evil | Companion | Companion -> High-Level Cleric Spell Material | spell | Counterforce / banishment family member that overlaps with anti-hostile or anti-outsider doctrine rather than plain damage. | partial |
| Force Field | Master | Master -> Eighth-Level Magic-User Spells | spell | Premium barrier package that should inform upper-tier ward layering and persistence doctrine. | custom |
| Prismatic Wall | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Complex high-tier barrier lane. The current SDM corpus does not provide a close named layered-spectrum wall analogue, so this likely needs bespoke high-tier barrier text rather than a borrowed family variant. | custom |

### Countermagitech / Dispels / Suppression / Jamming

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Anti-Magic Shell | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Core anti-magic barrier recognizer spanning arcane and high-tier artifact-adjacent lanes. | custom |
| Protection from Magic | RC | RC -> Scrolls | item-effect | Protection-circle interface specifically blocking spells and spell effects across boundary edges. This is a clean ECM ward wrapper and a strong Chapter 05 model for denial fields rather than generic protection. | custom |
| Dispel Magic | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Major counterforce recognizer and one of the core canonical anchors for ECM scope. The grouped ECM pass now treats this as a bespoke conversion anchor rather than an unresolved loose cousin. | custom |
| Silence 15' Radius | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Anti-speech and anti-spellcasting field lane; useful where ECM overlaps with noospheric jamming and casting denial even though the current corpus lacks a clean silence-only named precedent. | partial |
| Spell Catching | RC | RC -> Scrolls | item-effect | Counter-capture wrapper for hostile spell energy routed into storage media; a core ECM reference case and strong bridge for Power Level-banded hostile capture. | custom |
| Ring of Spell Eating | Companion | Companion -> Treasure Tables and Item Procedures | item-effect | Ring-native spell absorption and denial interface; distinct from simple resistance tags and a direct ECM item case for consuming or canceling incoming powers rather than reflecting them. | custom |
| Staff of Dispelling | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods | item-effect | Charged dispel interface with special handling across temporary and permanent magic carriers; likely a key Chapter 05 example for `Level`-based counterforce with carrier-specific exceptions. | custom |

### Mobility and Access / Movement / Traversal

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Levitate | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Vertical movement utility; likely a direct map. | direct |
| Floating Disc | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Canonical spell name can stay unchanged while pointing to the existing stylized `Floating Disc` UVG variant in the Powers Index. | direct |
| Fly | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Core aerial mobility recognizer needed for personal-scale movement powers and item references. | direct |
| Find the Path | Companion | Companion -> High-Level Cleric Spell Material | spell | Navigation / routing procedure rather than pure movement; useful for Chapter 06 pathfinding and noosphere-guidance tags. | partial |
| Knock | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Canonical lock-opening entry should remain `Knock`; existing SDM variant: `Knock / Lock` (UVG2e spell lane in the Powers Index). | partial |
| Teleport | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Major transit power; likely direct at concept level but will need SDM range / mishap doctrine decisions. | partial |
| Word of Recall | Companion | Companion -> High-Level Cleric Spell Material | spell | Return-to-sanctuary extraction spell with strong campaign-loop implications; likely bridge-heavy rather than a generic teleport clone. | partial |
| Travel | Master, RC | Master -> Seventh-Level Cleric Spells; Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Clerical and Magical Spell Descriptions | spell | Composite package combining flight, planar transfer, and gaseous traversal; probably needs custom Chapter 06 decomposition or a premium bundled mobility power with environment/survival riders instead of a flat one-to-one export. | custom |
| Dimension Door | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Short-range relocation entry that bridges tactical repositioning and teleport doctrine. | partial |
| Pass-Wall / Passwall | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Access-through-barriers recognizer with mixed source and RC spelling forms. | partial |
| Magic Door | RC | RC -> Magical Spells List and Spell Descriptions | spell | Portal and egress manipulation lane. Existing SDM family variant: `Linked Portals`, which is the clearest current astral-bridge precedent for controlled passage and reversible entry. | partial |
| Pass Plant | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Plant transit lane. Existing SDM family variant: `Linked Portals`, used here as a traversal cousin rather than a literal vegetation-only doorway. Primary placement stays with mobility because the row's job is passage, not plant reshaping. | partial |
| Plant Door | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Vegetation access / doorway lane. Existing SDM family variant: `Linked Portals`, which is the closest current controlled-passage precedent even though the classical wrapper is plant-specific. | partial |
| Transport Through Plants | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Plant-network transit lane. Existing SDM family variant: `Linked Portals`, which already expresses location-bridging as a distinct traversal procedure. | partial |
| Water Breathing | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Druidic aquatic adaptation/access lane. Primary placement stays with mobility/access, but conversion should be treated as custom environment-interface doctrine (breath medium, pressure, and exposure assumptions), not a generic speed modifier. | custom |
| Gate | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Planar aperture and translocation endpoint for high-tier traversal and summoning crossover, likely a bespoke apex mobility/interface effect rather than a generic teleport derivative. | custom |
| Teleport any Object | RC | RC -> Magical Spells List and Spell Descriptions | spell | Object-only transit lane that should stay distinct from creature teleport effects. | partial |

### Influence and Control / Restraint / Compulsion

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Sleep | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Classic low-tier disable effect; likely a direct control template. | direct |
| Hold Person | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Straight restraint/paralysis recognizer already central to many fantasy power taxonomies. Existing SDM variant: `Hlod Person` (Vastlands / Apocrypha of the O.S. lane in the Powers Index). | direct |
| Web | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Area denial plus entanglement effect; likely direct. | direct |
| Confusion | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Mind-state disruption effect; needs a clean SDM status / control phrasing pass. | partial |
| Quest | Companion | Companion -> High-Level Cleric Spell Material | spell | Compulsion / obligation spell likely better treated as a vow-binding or command doctrine than a simple status effect. | custom |
| Dance | Master | Master -> Eighth-Level Magic-User Spells | spell | Forced-movement / compulsion lane. | undecided |
| Hold Monster | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Higher-tier restraint extension of the hold-family control recognizer. | partial |
| Mass Charm | Master | Master -> Eighth-Level Magic-User Spells | spell | Group-scale social compulsion package beyond single-target charm doctrine. | custom |
| Power Word Stun | RC | RC -> Magical Spells List and Spell Descriptions | spell | Word-of-power incapacitation lane bridging blind/kill style hard control effects. | custom |

### Veils and Illusions / Concealment / Deception

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Invisibility | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Core concealment baseline for personal stealth and line-of-sight disruption. Existing SDM family variants: `Ecosphere Veil` for disregard-based stealth and `Yellow Cloud` for visual obscuration. | partial |
| Invisibility 10' radius | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Group concealment extension of the invisibility baseline. `Yellow Cloud` is the clearest existing Luka-style battlefield-scale concealment cousin. | partial |
| Mass Invisibility | RC | RC -> Magical Spells List and Spell Descriptions | spell | High-tier crowd concealment lane above the 10-foot-radius variant. `Yellow Cloud` remains the strongest existing crowd-obscuration precedent in the current SDM corpus. | partial |
| Ventriloquism | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Sound-projection and false-source deception utility. Primary placement belongs with illusion/deception rather than passage control because the effect lies about presence/location instead of sealing an access point. | undecided |
| Mirror Image | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Defensive misdirection via decoy duplicates in direct-threat contexts. | undecided |
| Phantasmal Force | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Core constructed-illusion recognizer for scene-level false stimuli. | undecided |
| Projected Image | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Remote image/proxy presence lane for deception and diversion play. | undecided |
| Massmorph | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Group disguise or false-form presentation for coordinated infiltration. | undecided |
| Statue | RC | RC -> Magical Spells List and Spell Descriptions | spell | Self-concealment through object-form mimicry with strong ambush utility. | undecided |

### Transformation and Fabrication / Biomancy / Creation

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Polymorph Self | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Self-transformation recognizer; likely maps partially because SDM form-change limits still need explicit doctrine. Existing SDM family variant: `Alter Self` (UVG2e spell lane in the Powers Index). | partial |
| Polymorph Other / Others | Expert, Master, RC | Expert -> Clerical and Magic-User Spell Expansions; Master -> Artifact Power Doctrine and Artifact Effect Procedures; RC -> Magical Spells List and Spell Descriptions | spell | Offensive transformation version of the same family; staged sources use both singular and plural forms, so preserve both recognizers. | partial |
| Summon Animals | Master | Master -> Druid Spell Material | spell | Druidic ally-call effect with explicit HD budgeting; useful for summon scaling via SDM Level. | partial |
| Animate Objects | Companion | Companion -> High-Level Cleric Spell Material | spell | Object animation effect that likely maps, but may need gear/object-agent handling. | partial |
| Animate Dead | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Major doctrine carrier for minion control and undead creation; likely requires custom or tightly-scoped overlay language. Existing SDM variant: `Animate Corpse` (UVG2e spell lane in the Powers Index). Future pass should treat this as a relationship note into Undeath's Decrees rather than a flat one-power export. | custom |
| Clone | Master | Master -> Eighth-Level Magic-User Spells | spell | Identity-duplication / backup-body procedure, clearly beyond a simple direct powers mapping. | custom |
| Polymorph Any Object | Master | Master -> Eighth-Level Magic-User Spells | spell | Extreme transmutation endpoint that extends polymorph doctrine beyond creature targets. | custom |
| Shapechange | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Supreme self-transformation package and ceiling case for form-shift taxonomy. | custom |
| Reincarnation | RC | RC -> Magical Spells List and Spell Descriptions | spell | Death-reversal via body replacement that should stay distinct from raise-dead effects. | custom |

### Terrain and Environment / Weather / Infrastructure

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Lower Water | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Hydrology-control and exposure-engineering lane. Primary placement belongs with terrain/environment and should be treated as custom doctrine for level shifting and basin manipulation. | custom |
| Control Temperature 10' radius | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Environmental control lane. Primary placement belongs with terrain/environment rather than transformation, but the current SDM corpus still lacks a strong named microclimate-control cousin. | undecided |
| Control Winds | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Directional weather-force control with movement, hazard, and projectile-pressure implications. Keep as custom environment-control doctrine pending full weather suite normalization. | custom |
| Weather Control | Companion, Master, RC | Companion -> Druid Spell Material; Master -> Druid Spell Material; RC -> Druidic and Magical Spells Lists and Spell Descriptions | spell | High-tier weather command lane across druidic and arcane traditions. Keep as custom suite anchor for chapter-scale climate control, hazard shaping, and travel pressure. | custom |
| Earthquake | Companion, Master | Companion -> High-Level Cleric Spell Material; Master -> Seventh-Level Cleric Spells | spell | Large-scale terrain and structure disruption effect for macro encounter shifts. | undecided |
| Move Earth | RC | RC -> Magical Spells List and Spell Descriptions | spell | Massive terrain repositioning and landscape engineering recognizer. Existing SDM family variant: `Dryland Sculpture`, which is a smaller-scale but high-confidence terrain-forming and infrastructure-shaping cousin rather than a direct mass-displacement duplicate. | partial |
| Hallucinatory Terrain | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Terrain-level illusion masking and environmental deception package. | undecided |
| Obscure | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Concealment / weather-obscuration lane. Existing SDM family variant: `Yellow Cloud`, which creates an opaque dust veil and can overcharge into an immobile wall of obscuring material. Primary placement belongs with terrain/environment because the effect works by materially altering battlefield atmosphere rather than pure false imagery. | partial |
| Predict Weather | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Forecast and horizon-reading lane. Primary placement belongs with terrain/environment and should be treated as custom environment-intelligence doctrine for routing and hazard prep. | custom |
| Summon Weather | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Weather-calling and macro-environment override lane. Primary placement belongs with terrain/environment and should remain custom until intensity/duration/collateral doctrine is codified. | custom |
| Wall of Stone | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Rapid structural barrier creation for chokepoints and fortification. Keep as custom until Chapter 06 codifies persistent obstacle geometry, breach rules, and noncombat construction handling. | custom |
| Wall of Iron | RC | RC -> Magical Spells List and Spell Descriptions | spell | Durable metal wall creation for heavy-duty terrain shaping and denial. Keep as custom where procedures need explicit creation-versus-obstruction handling for persistent iron mass. | custom |

### Summons and Servitors / Calling / Fabrication

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Conjure Elemental | Expert, Companion, Immortals, RC | Expert -> Clerical and Magic-User Spell Expansions; Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items | spell | Foundational elemental-calling recognizer with cross-book spell and item relevance. | partial |
| Invisible Stalker | Expert, Immortals, RC | Expert -> Clerical and Magic-User Spell Expansions; Immortals -> Section 3: Immortal Magic | spell | Precision servitor-calling lane for pursuit, scouting, and delegated action. | partial |
| Aerial Servant | Companion | Companion -> High-Level Cleric Spell Material | spell | Summoned retrieval-agent procedure with logistics and custody implications. | partial |
| Summon Elemental | Master | Master -> Druid Spell Material | spell | Druidic elemental-calling lane complementary to Conjure Elemental. | partial |
| Summon Object | RC | RC -> Magical Spells List and Spell Descriptions | spell | Object-call retrieval effect that bridges summoning and transport procedure language. | partial |
| Create Normal Animals | Companion | Companion -> High-Level Cleric Spell Material | spell | Creature creation lane adjacent to summoning, useful for companion and ecology pressure. Bundle seed tier: `Vegetable of Birth` (There A Red Door) is the strongest current gestation precedent for controlled non-monstrous outputs. | custom |
| Create Normal Monsters | RC | RC -> Magical Spells List and Spell Descriptions | spell | Mid-tier monster fabrication lane below magical and any-monster creation tiers. First monster-grade rung in the bundle, with bounded taxonomy and encounter-pressure outputs. | custom |
| Create Magical Monsters | Master | Master -> Eighth-Level Magic-User Spells | spell | Magical creature fabrication lane with higher design complexity and power expectations. Mid bundle rung above normal monsters with explicit special-ability budgeting and higher control burden. | custom |
| Create Any Monster | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Extreme top-tier creature creation endpoint with broadest scope. Bundle capstone requiring strict doctrine for command reliability, persistence failure modes, and campaign-scale impact. | custom |

### Communication and Inquiry / Speech / Divination

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Speak with Animals | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Baseline non-human communication lane for ecology and scouting play. | partial |
| Speak with the Dead | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Corpse-interrogation lane with strong overlap to existing SDM husk-speaking precedents. | partial |
| Speak with Monsters | Companion, RC | Companion -> High-Level Cleric Spell Material; RC -> Clerical Spells List and Spell Descriptions | spell | Broad creature-negotiation lane beyond animal and plant channels. Existing SDM family variant: `Anti-Babylon` (Eternal Return Key), which generalizes communication across entities rather than preserving narrow species lanes. | partial |
| Speak with Plants | RC | RC -> Clerical Spells List and Spell Descriptions | spell | Plant-sentience communication lane that completes the speak-with progression. Existing SDM family variant: `Anti-Babylon` (Eternal Return Key), which already covers communication with plants, animals, minerals, and data stores. | partial |
| Commune | Companion | Companion -> High-Level Cleric Spell Material | spell | Divine consultation and constrained-answer procedure for high-confidence guidance, likely better treated as bespoke oracle/contact doctrine than as ordinary divination throughput. | custom |
| Know Alignment | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Alignment/intention interrogation lane used for truthfulness and affiliation reads. | partial |
| Questioning | RC | RC -> Scrolls | item-effect | Nonliving-object interrogation procedure useful for forensic and archive scenes. | partial |
| Truth | RC | RC -> Scrolls | item-effect | Living-mind questioning interface via enhanced mental-read procedure. | partial |

### Restoration and Thresholds / Healing / Resurrection

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Cure Critical Wounds | Companion | Companion -> High-Level Cleric Spell Material | spell | Straight higher-tier healing upgrade; likely direct. | direct |
| Cureall | Companion | Companion -> High-Level Cleric Spell Material | spell | Broad repair / cleanse package that may collapse several classic condition-removal channels into one SDM power pattern. | partial |
| Restore | Master | Master -> Seventh-Level Cleric Spells | spell | Recovery of drained or diminished capability is important for Chapter 06 recovery taxonomy, but the exact SDM equivalent still needs policy. | partial |
| Raise Dead Fully | Master | Master -> Seventh-Level Cleric Spells | spell | More than basic resurrection; likely needs custom life-restoration doctrine or a high-tier ritual framing with explicit threshold, body-integrity, and post-return handling rather than a simple stronger revival effect. | custom |
| Heal | Master, RC | Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Magical Spells List and Spell Descriptions | spell | Extreme recovery recognizer crossing clerical and arcane traditions at high tier, likely collapsing multiple cure/cleanse/restoration lanes into one bespoke capstone recovery procedure. | custom |
| Survival | Master, RC | Master -> Seventh-Level Cleric Spells; RC -> Clerical and Magical Spell Descriptions | spell | Hazard-environment life support package for void, plane, and extreme condition play. | partial |

### Interfaces and Scrollcraft / Spell Storage / Tooling

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Read Magic | Basic, Expert, RC | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions; RC -> Scrolls | spell | Decoding gate for scrolls and arcane writing; this family should group deciphering, storage, and transfer interfaces. | partial |
| Spell Storing | RC | RC -> Scrolls | item-effect | Source spell-retention wrapper. Keep the canonical key, but convert it as a trait/item power archive with Power Level capacity and later discharge rules rather than as prepared-slot retention. | custom |
| Spell Scrolls / Spells | Basic, Expert, RC | Basic -> Treasure and Magic Items; Expert -> Treasure and Magic Item Procedures; RC -> Scrolls | item-effect | Generic casting-from-scroll wrapper that must stay visible for Chapter 05/06 bridges. | partial |
| Protection / Protection Scrolls | Basic, Expert, RC | Basic -> Treasure and Magic Items; Expert -> Treasure and Magic Item Procedures; RC -> Scrolls | item-effect | Wrapper row for protection-scroll family where the payload references another spell recognizer. | partial |
| Cursed / Cursed Scroll | Basic, Expert, RC | Basic -> Treasure and Magic Items; Expert -> Treasure and Magic Item Procedures; RC -> Scrolls | item-effect | Failure-state wrapper that applies negative spell-like outcomes; useful as a generalized cursed-interface pattern. | partial |
| Maps to Treasures / Treasure Maps | Basic, Expert, RC | Basic -> Treasure and Magic Items; Expert -> Treasure and Magic Item Procedures; RC -> Scrolls | item-effect | Non-spell utility wrapper, but still an indexed magical information interface in treasure text. | custom |
| Quill of Copying | Companion | Companion -> Treasure Tables and Item Procedures | item-effect | Procedure for spell/text duplication with strong archive tooling implications. | custom |
| Slate of Identification | Companion | Companion -> Treasure Tables and Item Procedures | item-effect | Item-mediated identification interface that bridges detection and item-use doctrine. | partial |
| Communication | RC | RC -> Scrolls | item-effect | Paired remote-writing interface that functions as a distance-safe text channel on the same plane. | partial |
| Delay | RC | RC -> Scrolls | item-effect | Delayed-release wrapper for a stored spell payload, useful for trigger-based spell handling; Chapter 05 should treat this as deferred activation doctrine rather than slot hold-state. | custom |
| Mages | RC | RC -> Scrolls | item-effect | Scroll-based magic-effect detection that complements Read Magic without replacing it. | partial |
| Portals | RC | RC -> Scrolls | item-effect | Scroll-native pass-wall interface and compact access-control wrapper. | partial |
| Ring of Memory | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings | item-effect | Spell recall/recovery interface with clear Chapter 05/06 retention implications; likely better modeled as archive recall, refresh, or reduced-burden access than as literal memorization reset. | custom |

### Meta-Doctrine and Exceptions / Artifact Rules / Systems

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Artifact Activation Procedure | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Trigger and operation doctrine for artifact-grade effects; reusable as high-tier activation framing. | custom |
| Artifact Charges and Recharge | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Resource-economy scaffold for charge use, depletion, and recharge cycles. | custom |
| Artifact Intelligence and Auto-Defense | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Governs autonomous artifact behavior, resistance, and retaliatory logic. | custom |
| Artifact Handicaps and Penalties | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Drawback model for artifact use that should influence Chapter 06 risk/cost doctrine. | custom |
| Artifact Destruction Procedure | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | High-tier termination pathway for otherwise persistent artifact effects. | custom |
| Artifact Attack and Degradation | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Durability, threshold-loss, and recall behavior when artifacts are directly attacked. | custom |
| Artifact Creation Procedure | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Design-time artifact workflow covering power budgeting, activation mode, and adverse-effect loadout. | custom |
| Immortal Magical Effect Index (S1-S4) | Immortals | Immortals -> Section 3: Immortal Magic -> General Notes, Charts S1-S4 | procedure | Master index for mapping mortal and non-mortal effects to Immortal power-cost rules. | custom |
| Immortal Caster Level Rule | Immortals | Immortals -> Section 3: Immortal Magic -> Index to Magical Effects | procedure | Effective caster-level baseline for Immortal effect scaling (2x HD). | custom |
| Immortal Range / Duration Scaling | Immortals | Immortals -> Section 3: Immortal Magic -> Changing Range and Duration | procedure | Range and duration scaling doctrine for divine-tier spell-equivalent effects. | custom |
| Immortal Conjuring and Summoning Limits | Immortals | Immortals -> Section 3: Immortal Magic -> Conjuring and Summoning | procedure | Constraint doctrine for conjured allies and summoned entities at Immortal tier. | custom |
| Immortal Damage Scaling and Averaging | Immortals | Immortals -> Section 3: Immortal Magic -> Damage | procedure | HD-scaled damage expression plus average-damage fast-resolution option. | custom |
| Immortal Mental Effect Resolution | Immortals | Immortals -> Section 3: Immortal Magic -> Mental Effects | procedure | Recovery and save-cadence handling for charmed/feebleminded Immortals. | custom |
| Immortal Limits on Use | Immortals | Immortals -> Section 3: Immortal Magic -> Limits on Use | procedure | Action and scope constraints on active magical effects. | custom |

### Meta-Doctrine and Exceptions / Reality Rewrite / High-Tier

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Wish | Master, RC | Master -> Seventh-Level Cleric Spells; Master -> Eighth-Level and Ninth-Level Magic-User Spells; RC -> Clerical and Magical Spell Descriptions | spell | Canonical spell name should remain `Wish` even where the tone-forward SDM variant is `Big Wish` in the Powers Index. This is exactly the sort of high-recognizer / unique-variant pairing the crosswalk must preserve, with later conversion likely framed as a ritual-grade exception rather than a slot spell. | custom |
| Timestop | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Temporal exception effect and high-tier action-economy breaker. | custom |
| Reverse Gravity | RC | RC -> Magical Spells List and Spell Descriptions | spell | Battlefield-physics inversion that behaves as a rules exception rather than a standard force attack. | custom |
| Contingency | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Conditional trigger/do-if framework for precommitted reality edits and defensive reactions. | custom |

### Support and Augmentation / Blessing / Sustainment

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Bless | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Morale and combat blessing lane. | undecided |
| Continual Light | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Persistent light/darkness-management support effect. | undecided |
| Create Air | RC | RC -> Magical Spells List and Spell Descriptions | spell | Environmental survival and sealed-space support lane for vacuum, underwater, or enclosed-hazard play; likely a bespoke sustainment wrapper unless folded into broader life-support doctrine. | custom |
| Create Food | Companion | Companion -> High-Level Cleric Spell Material | spell | Supply-generation and survival support. Existing SDM family variant: `Process Food`, which converts raw matter into usable rations; `Green Haven` is a secondary expedition-sustainment cousin where the classic row is read as camp support rather than pure conjuration. | partial |
| Create Water | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Expedition sustainment lane for liquid-resource generation. Existing SDM cousins in `Process Food` and broader survival wrappers support a supply-doctrine mapping without requiring a literal slot-era clone. | partial |
| Cure Light Wounds | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Foundational healing support. Existing SDM family variants: `Rehoryan's Progressive Restoration` and `Restorative Slumber`, which frame healing as regenerative or recuperative process rather than instant slot discharge. | partial |
| Cure Serious Wounds | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Mid-tier healing support. Existing SDM family variants: `Rehoryan's Progressive Restoration` and `Real-Time Rebuild`, which provide stronger repair and regrowth scaling. | partial |
| Haste | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Acceleration and combat-tempo support. Existing SDM family variant: `Nunka's Biophysical Overdrive`, which expresses haste-like speed and output boosts as metabolic overdrive with exhaustion burdens. Likely future relationship-group candidate for a single SDM power with Overcharge riders instead of multiple near-duplicate exports. | partial |
| Illumination | RC | RC -> Scrolls | item-effect | Reusable flame-scroll utility for sustained light and fire-starting. | direct |
| Immunity | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Apex blanket-protection lane spanning broad hazard categories. Keep as custom until Chapter 06 sets explicit immunity scope boundaries and exception taxonomy. | custom |
| Light | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Shared cross-tradition light/darkness utility. | undecided |
| Purify Food and Water | Basic | Basic -> Spell Lists and Basic Spell Descriptions | spell | Basic purification and supply-safety support. Existing SDM family variant: `Process Food`, which turns unsafe or inedible organic matter into workable supplies; `Toxin Render` is a narrower waste-processing cousin rather than a straight purification duplicate. | partial |
| Remove Fear | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Fear-cleansing and morale stabilization support. | undecided |
| Resist Cold | Basic | Basic -> Spell Lists and Basic Spell Descriptions | spell | Foundational elemental protection support. | undecided |
| Ring of Holiness | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings | item-effect | Cleric/druid power-augmentation wrapper tied to ring use; later conversion should express this as eligibility, blessing-layer access, or reduced burden around holy/nature powers rather than extra slot grant. | custom |
| Ring of Life Protection | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings | item-effect | Anti-drain and life-threshold safeguard interface; useful as a threshold-protection model distinct from ordinary healing because it prevents or defers loss rather than repairing it after the fact. | custom |
| Ring of Remedies | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings | item-effect | Bundled condition-repair and cleansing wrapper; likely a reusable item model for one interface exposing several tagged recovery functions instead of one-to-one spell copies. | custom |
| Ring of Survival | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings | item-effect | Environmental hardening and hazard-resistance wrapper. | partial |
| Rod of Health | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods | item-effect | Permanent healing and recovery interface at rod scale. | partial |
| Striking | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Weapon augmentation and combat support lane. Existing SDM family variant: `Imbue Edge`, which buffs an edged weapon's damage and lets it harm intangibles for the duration. | partial |

### Purge and Safeguards / Recovery / Cleansing

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Cure Blindness | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Condition-removal lane for sensory impairment. Existing SDM family variants: `Real-Time Rebuild` for bodily restoration and `Restorative Slumber` for longer-form burden/attribute recovery. | partial |
| Cure Disease | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Disease-removal and anti-corruption-adjacent lane. Existing SDM family variant: `Real-Time Rebuild`, which explicitly flushes toxins or afflictions and restores damaged systems by power setting. | partial |
| Neutralize Poison | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Poison-cleansing and poison-creation lane. Existing SDM family variant: `Real-Time Rebuild`, which explicitly flushes toxins at lower power settings. | partial |
| Protection from Poison | Master | Master -> Druid Spell Material | spell | Poison immunity and anti-breath lane. Existing SDM family variant: `Real-Time Rebuild`, which is still a recovery-style toxin-handling cousin rather than true prophylactic immunity, so this remains only a partial match. | partial |
| Raise Dead | Companion | Companion -> High-Level Cleric Spell Material | spell | Companion lane for the classic recognizer before Master expansions. Existing SDM variant: `Raise Dead` (UVG2e Spells), with `Recall Soul` as a strong soul-return ritual cousin where the conversion wants explicit soul-handling. | partial |
| Remove Curse | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Major curse-removal recognizer. | undecided |

### Influence and Control / Charm / Binding

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Charm Monster | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Broad creature-charm lane. Existing SDM family variant: `Hero's Goldenmouth`, but only as a broad persuasive-capture cousin; the current corpus does not yet provide a clean nonhuman domination equivalent. | partial |
| Charm Person | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Core low-tier social control spell. Existing SDM family variant: `Hero's Goldenmouth` (Our Golden Age), which reframes charm as persuasive social capture rather than hard domination. | partial |
| Charm Plant | RC | RC -> Magical Spells List and Spell Descriptions | spell | Plant-specific command/control lane. Keep as custom until plant-agency and obedience boundaries are normalized against broader influence doctrine. | custom |
| Geas | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Compulsion / binding lane. | undecided |
| Holy Word | Companion, Master | Companion -> High-Level Cleric Spell Material; Master -> Seventh-Level Cleric Spells | spell | High-tier word of power / banishment lane. Existing SDM family variant: `Sense Allegiance`, which provides the clearest current ethical-targeting plus stun/interdiction cousin, though it is much narrower than the full clerical word-of-power package. | partial |
| Snake Charm | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Creature-specific charm/control spell. | undecided |

### Battle and Force / Hazards / Destruction

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Call Lightning | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Druidic artillery recognizer. | undecided |
| Cloudkill | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | High-tier battlefield hazard / area denial lane. | undecided |
| Death Spell | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | High-tier kill / sweep spell lane. | undecided |
| Disintegrate | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Matter-destruction lane. | undecided |
| Explosive Cloud | Master | Master -> Eighth-Level Magic-User Spells | spell | High-tier area hazard lane. | undecided |
| Ice Storm/Wall | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Hybrid artillery / wall-control lane. | undecided |
| Insect Plague | Companion | Companion -> High-Level Cleric Spell Material | spell | Battlefield swarm / area-denial lane. | undecided |
| Power Word Blind | Master | Master -> Eighth-Level Magic-User Spells | spell | Word-of-power debilitation lane. | undecided |
| Power Word Kill | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Word-of-power execution lane. | undecided |
| Sword | RC | RC -> Magical Spells List and Spell Descriptions | spell | Force-weapon and animated blade lane. | undecided |
| Wall of Fire | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Barrier-plus-damage lane. Keep relationship notes in mind with other escalating fireburst and fire-control effects for later Overcharge consolidation. Treat as partial pending fire-family consolidation with existing descendants such as `Pyreball`. | partial |

### Knowledge and Mind / Sensing / Counter-Sense

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Clairvoyance | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Remote-sight lane. Existing SDM family variant: `Eyes of the Arrow` (Vastlands / The Viridian Practice), a projectile-bound remote sensor. | partial |
| Detect Danger | Master | Master -> Druid Spell Material | spell | Hazard-sense hybrid lane combining detection and danger reading. Existing SDM family variant: `Yellow Foresight`, which scans a wide area for sentients and general mood. | partial |
| Detect Invisible | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Arcane perception / anti-concealment lane. Existing SDM family variant: `Eyes of Akaula`, which sees invisible, hidden, departed, and dead things. | partial |
| ESP | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Thought-reading / awareness lane. Existing SDM family variant: `Yellow Foresight`, which reads sentient presence and general mood rather than exact thoughts. | partial |
| Feeblemind | RC | RC -> Magical Spells List and Spell Descriptions | spell | Severe cognition-destruction lane. | undecided |
| Find Traps | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Detection and hazard-reading spell. | undecided |
| Infravision | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Sensory enhancement lane. Existing SDM family variant: `Rehoryan's Prophetic Song`, which can grant night vision as a durable biomantic adaptation instead of temporary spell vision. | partial |
| Locate | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Druidic animal / plant location lane. | undecided |
| Magic Jar | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Identity-transfer and mind-storage lane. | partial |
| Mind Barrier | Master | Master -> Eighth-Level Magic-User Spells | spell | High-tier noospheric defense lane for hostile mental influence suppression. Keep as custom until mental-defense tags and intrusion categories are normalized. | custom |

### Transformation and Fabrication / Nature / Material Shaping

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Anti-Animal Shell | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Creature-class exclusion boundary for fauna and beast-adjacent targets. Treat as custom boundary taxonomy doctrine (who is denied passage and what target classes qualify). | custom |
| Anti-Plant Shell | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Vegetation-class exclusion boundary. This is a custom barrier-interface case for passage denial against plant entities/effects, not a generic resistance shell. | custom |
| Clothform | RC | RC -> Magical Spells List and Spell Descriptions | spell | Soft-material transmutation lane. | undecided |
| Contact Outer Plane | RC | RC -> Magical Spells List and Spell Descriptions | spell | Dangerous intelligence-contact and revelation lane. | custom |
| Creeping Doom | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | High-tier swarm devastation lane. | undecided |
| Dissolve | Master | Master -> Druid Spell Material | spell | Terrain-liquefaction lane. | undecided |
| Entangle | RC | RC -> Magical Spells List and Spell Descriptions | spell | Arcane restraint and vegetation-control lane. | partial |
| Faerie Fire | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Outlining / reveal lane. | undecided |
| Growth of Animal | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Creature enhancement / scaling lane. | undecided |
| Growth of Plants | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Terrain / vegetation alteration lane. Existing SDM family variant: `Green Haven`, which coerces vegetation into shelter and thorn barriers; it is a narrower plant-shaping cousin rather than a pure growth accelerator. | partial |
| Heat Metal | Master | Master -> Druid Spell Material | spell | Sustained heat / anti-armor / concentration-break lane. | undecided |
| Hold Animal | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Beast-specific restraint lane. | undecided |
| Ironform | RC | RC -> Magical Spells List and Spell Descriptions | spell | Metal transmutation and body-state lane. | undecided |
| Metal to Wood | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Material transformation lane. | undecided |
| Produce Fire | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Portable flame / attack lane. | undecided |
| Protection from Lightning | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Elemental defense lane. | undecided |
| Steelform | RC | RC -> Magical Spells List and Spell Descriptions | spell | Advanced metal transmutation lane. | undecided |
| Sticks to Snakes | RC | RC -> Clerical Spells List and Spell Descriptions | spell | Wood-to-serpent transformation and battlefield-weaponization lane. Keep as custom until material-to-creature conversion, obedience scope, and reversion/persistence rules are normalized. | custom |
| Stone to Flesh | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Petrification-reversal lane. | undecided |
| Stoneform | RC | RC -> Magical Spells List and Spell Descriptions | spell | Stone transmutation lane within the broader form-spell suite. | undecided |
| Telekinesis | RC | RC -> Magical Spells List and Spell Descriptions | spell | Classic force-manipulation recognizer. | partial |
| Turn Wood | Master | Master -> Druid Spell Material | spell | Wooden-object repulsion and vector-redirection lane. Treat as a custom material-interaction control effect with explicit category targeting and displacement behavior. | custom |
| Warp Wood | Companion, Master | Companion -> Druid Spell Material; Master -> Druid Spell Material | spell | Wooden-structure deformation lane. | undecided |
| Woodform | RC | RC -> Magical Spells List and Spell Descriptions | spell | Wood transmutation lane paired with the other form spells. | undecided |

### Defense and Boundaries / Seals / Passage Control

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Hold Portal | Basic, Expert | Basic -> Spell Lists and Basic Spell Descriptions; Expert -> Clerical and Magic-User Spell Expansions | spell | Low-tier closure / access-control spell. Existing SDM family variant: `Knock / Lock`, whose overcharge explicitly flings a portal open or seals, welds, or fuses it shut. | partial |
| Maze | Master | Master -> Eighth-Level and Ninth-Level Magic-User Spells | spell | Exile and battlefield-removal boundary effect. Keep as custom due its spatial-separation logic and return-condition doctrine requirements. | custom |
| Permanence | Master | Master -> Eighth-Level Magic-User Spells | spell | Long-term enchantment anchoring and persistence-lock doctrine. Treat as custom because Chapter 06 must define bindability scope, upkeep risks, and safe unbinding conditions. | custom |
| Wizard Lock | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Arcane closure / keyed barrier lane. Existing SDM family variant: `Knock / Lock`, which already handles opening, locking, and forcibly sealing portals, including resistance from magical locks. | partial |

### Interfaces and Scrollcraft / Treasure / Utility Devices

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Creation | RC | RC -> Scrolls | item-effect | Scroll-generated temporary mundane item fabrication procedure. | custom |
| Equipment | RC | RC -> Scrolls | item-effect | Scroll that manifests from a fixed list of mundane adventuring gear. | custom |
| Mapping | RC | RC -> Scrolls | item-effect | Scroll-generated area map with limited secret-door detection. | custom |
| Protection from Elementals | RC | RC -> Scrolls | item-effect | Circle protection scroll keyed specifically to elementals. | partial |
| Protection from Evil 10' Radius | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Canonical grouped display form for the group-radius protection lane (clerical framing). Treat lowercase `10' radius` as a retained alias recognizer, not a separate doctrine island. | partial |
| Protection from Lycanthropes | RC | RC -> Scrolls | item-effect | Circle protection scroll keyed to lycanthrope types by quantity band. | partial |
| Protection from Normal Missiles | Expert | Expert -> Clerical and Magic-User Spell Expansions | spell | Projectile-denial boundary lane for nonmagical missile vectors. Chapter 05 should treat this as an interface-grade filtering ward with explicit projectile-category exceptions rather than a generic defense bonus. | custom |
| Protection from Undead | RC | RC -> Scrolls | item-effect | Circle protection scroll keyed to undead by type and quantity. | partial |
| Repetition | RC | RC -> Scrolls | item-effect | Scroll wrapper that replays the same-level spell effect after one turn; note for future conversion that this should become an SDM trigger/interface note, not a slot-replay rule. | custom |
| Ring of Elemental Adaptation | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Rings | item-effect | Elemental-environment survival and traversal interface. | partial |
| Rod of the Wyrm | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods | item-effect | High-tier draconic transformation/summoning interface. | custom |
| Seeing | RC | RC -> Scrolls | item-effect | Scroll-based remote creature imaging procedure. | partial |
| Shelter | RC | RC -> Scrolls | item-effect | Pocket-room refuge scroll with supplies and extradimensional trapping edge cases. | custom |
| Staff of Harming | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods | item-effect | Reversed-healing harm wrapper with charge-costed curse-side effects. | custom |
| Staff of an Element | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods | item-effect | Element-tuned summoning, negation, and planar operation interface; a strong bundle case rather than a single-spell export, especially when Chapter 05 needs one item to expose several element-keyed functions. | custom |
| Staff of the Druids | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Wands, Staves, and Rods | item-effect | Druid power-augmentation and charge-linked upkeep interface; should convert as attuned access to druidic functions or bundled powers rather than as raw slot augmentation. | custom |
| Symbol | Master | Master -> Eighth-Level Magic-User Spells | spell | Sigil-triggered boundary hazard lane. Treat as a custom trigger-interface package (condition, payload, and reset doctrine) instead of a plain static trap export. | custom |
| Talisman of Elemental Travel | Companion | Companion -> Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items -> Miscellaneous Items | item-effect | Elemental-plane transit and safety wrapper; useful as a Chapter 05 model for travel interfaces that bundle adaptation, safe passage, and return logic. | custom |
| Trapping | RC | RC -> Scrolls | item-effect | Scroll-created physical trap keyed by placement surface. | custom |
| Wizardry | Master | Master -> Seventh-Level Cleric Spells | spell | Cross-tradition item / scroll use bridge lane. | undecided |

### Meta-Doctrine and Exceptions / Artifact / Immortal Rules

| Classic Name | Source Book(s) | Staging Anchor / Section | Type | Notes | Mapping Status |
| --- | --- | --- | --- | --- | --- |
| Artifact Activation | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Activation/discovery interface for artifact powers. | custom |
| Artifact Charges And Recharge | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Artifact power-budget, charge-drain, and recharge-cycle doctrine. | custom |
| Artifact Handicaps And Penalties | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Core adverse-effect framework for mortal artifact users. | custom |
| Artifact Intelligence And Auto-Defense | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Rudimentary artifact agency and self-defense behavior. | custom |
| Attacking An Artifact | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Artifact durability, damage thresholds, power loss, and recall behavior under sustained attacks. | custom |
| Creating Artifacts | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Artifact design workflow including magnitude, power limits, activation model, and adverse-effect selection. | custom |
| Destruction Of An Artifact | Master | Master -> Artifact Power Doctrine and Artifact Effect Procedures | procedure | Permanent-destruction quest procedure and Immortal-response consequences. | custom |
| Immortal Conjuring And Summoning Limits | Immortals | Immortals -> Section 3: Immortal Magic -> Conjuring and Summoning | procedure | Defines transplanar response requirements and sphere/element bias constraints. | custom |
| Immortal Damage Scaling And Averaging | Immortals | Immortals -> Section 3: Immortal Magic -> Damage | procedure | High-tier damage rule set using HD-based dice and optional average-damage method for faster resolution. | custom |
| Immortal Limits On Use | Immortals | Immortals -> Section 3: Immortal Magic -> Limits on Use | procedure | Action-economy and target-scope doctrine for created effects. | custom |

## Family Coverage Audit

- Base-catalog SDM-family promotion is now complete: every flat row in the Phase 1 catalog appears in at least one grouped family section.
- Cross-family duplication is still allowed where it improves drafting clarity, but missing-family coverage is no longer the blocker.
- Future regrouping work should now focus on SDM family boundaries, relationship notes, Overcharge candidates, and variant tagging rather than raw promotion completeness.

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
- Tranche B/C now extends grouped Chapter 06-facing families across SDM-first lanes for detection, wards, movement, control, illusion, transformation, environment, summoning/calling, communication/interrogation, restoration, storage interfaces, and high-tier doctrine.
- Tranche B now also records the planning doctrine for existing Luka-style variants: canonical spell names remain the lookup surface, while stylized SDM powers are captured as named variants to point at.
- The grouped family layer should de-duplicate canonical rows whenever possible; use the most useful primary family and avoid repeating the same lookup row across multiple sections unless a cross-family repeat is truly necessary.
- `partial` is being used where the classic recognizer is clear but the SDM implementation will need storage, retention, trigger, bearer-language, or powers-taxonomy bridge text.
- `custom` is being used where the classic spell is really a bundled subsystem, ritual-grade exception, or doctrine carrier rather than a clean one-power export.
- This pass is writing notes for conversion, not final SDM powers. Where a classic row clearly wants to become a trait, item, burden, or location interface later, record that pressure in notes instead of forcing a premature one-power mapping.
- Overcharge relationships should be captured during later conversion passes whenever multiple classic rows obviously form one scaling family. Fireburst ladders, acceleration ladders, and related escalating artillery or control suites are the main candidates.
- When a classic family is likely to collapse into one SDM power progression, note whether higher riders may begin locked, corrupted, or encrypted and require RSS- or campaign-side work to unlock safely.
- ECM rows should continue to prefer negation, denial, capture, reflection, cancellation, and jamming language over broad defensive or restorative bucket sprawl.
- Existing SDM variants from UVG / VLG / OGA sources should be harvested systematically during the next passes, especially for high-signal canonical names that already have obvious descendants in the Powers Index.
- The staged corpus should now be expanded outward from this seed batch until Chapter 06 can treat the crosswalk as canonical spell-source infrastructure.
