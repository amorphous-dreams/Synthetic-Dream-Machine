```shell id="m27qla"
Local Lares node: Enyalios-lararium // DreamNet link: stable
Drafting packet for local Lares team consumption.
```

Below is a **deliverable draft backlog** written for the **local team of Lares**: concrete, assignable, and ready to move into working docs or a board.

# Culinary Secrets / Thracia Integration

## Deliverable Draft Backlog for the Local Lares Team

## Purpose

Ship **Culinary Secrets** as a native **SDM+/FTLS Company/RSS feature** that:

* captures the **Dungeon Meshi** feeling through play procedures rather than flavor text alone,
* works inside **live Jaquayed sites** in the mode of **Caverns of Thracia**,
* uses existing FTLS abstractions rather than spawning a parallel minigame,
* and delivers a usable alpha packet for referee testing.

## Product Statement

**Culinary Secrets is an RSS Secrets-layer procedure that turns edible salvage into expedition infrastructure outcomes: Comfort, Traits, and Intel under active pressure.**

## Design Mandate

This feature must satisfy both reference pillars:

### SDM+/FTLS pillar

* Reuse **Tags, Bonus Dice, Attention, Areas, Nodes, Resources, Company state, Secrets stage**.
* Stay cross-scale where possible.
* Land as an **extension**, not a subsystem fork.
* Treat Culinary Secrets as expedition infrastructure, not side-flavor.

### Thracia pillar

* Must function in:

  * multi-entry ruins,
  * vertical sites,
  * live faction ecologies,
  * turn-pressure exploration,
  * partial knowledge / rumor play,
  * interrupted and dangerous “camp” situations.

## Culinary Secrets as Expedition Procedure

### Comfort, Traits, and Intel

* **Comfort:** outcomes that steady the party, extend endurance, restore readiness, reduce pressure, support morale, and generate Comfort Dice at higher tiers.
* **Traits:** temporary carried effects (adaptations, resistances, senses, buffs, mutations) that must sit in inventory and be tracked explicitly.
* **Intel:** omen-reading, memory traces, environmental insight, faction tells, navigation clues, and other “eat the ruin to learn the ruin” outcomes.

### Attention, Smoke, and Scent

* Field cooking is pressure-sensitive and must account for time, fuel, tools, smoke, scent, and visible signatures.
* The kitchen is a beacon/shrine/risk event in hostile sites, not a consequence-free rest action.
* Culinary actions can trigger Attention, encounters, faction response, and route pressure.

### Recipe Discovery and Hazardous Preparation

* Recipes are discovered procedures and hypotheses, not guaranteed safe consumables.
* Preparation quality, site pressure, and method fit determine reliability.
* Failure should change the situation, not just waste ingredients.

### Intel Meals / Eating the Ruin

* Edible salvage should directly support recon, salvage decisions, route finding, and faction prediction.
* Intel meals should expose provisioning chains, patrol rhythms, hidden access clues, and taboo zones.

### Failure Modes and Misleading Blessings

* Failure and partial success should include false confidence, unstable Traits, tainted Comfort, bad Intel, Attention spikes, faction-signaling aromas, and burdens mistaken for blessings.

> If Culinary Secrets works equally well in a safe village kitchen and in a live hostile ruin, it is probably too bland.

---

# Delivery Structure

## EPIC 0 — Thracia Fit Doctrine

### Goal

Lock the site-structure doctrine before content sprawl begins.

### Story 0.1 — Write Thracia Fit Doctrine

**Owner:** Rules Architect
**Deliverable:** 1 short internal doctrine note

**Tasks**

* Define Thracia as a reference for:

  * multi-route site design
  * verticality
  * persistent factions
  * patrol pressure
  * structural discovery
* State that Culinary Secrets must work in unsafe spaces, not just restful camp scenes.
* Define “food reveals space” as a core principle.

**Definition of Done**

* 1-page doctrine drafted and accepted by local Lares team.

---

### Story 0.2 — Write Thracia Validation Checklist

**Owner:** Systems Integrator
**Deliverable:** checklist used during design review and playtest

**Tasks**

* Create yes/no checks:

  * Can this run in a dangerous corridor, shrine edge, midden, cistern, fungus garden?
  * Can cooking change patrol behavior?
  * Can meals reveal routes or provisioning chains?
  * Can partial prep happen under pressure?
  * Can results matter even when no long rest exists?

**Definition of Done**

* Checklist exists and is attached to feature review process.

---

### Story 0.3 — Anti-Drift Guardrails

**Owner:** Line Editor
**Deliverable:** short “do not do this” note

**Tasks**

* Ban drift into:

  * buff-only meal design
  * cozy-only camp mode
  * exhaustive accounting
  * safe downtime assumptions
  * generic enemy-drop cooking
* State that danger, taboo, smell, smoke, scarcity, and faction consequence remain live.

**Definition of Done**

* Guardrail note linked in core draft.

---

## EPIC 1 — Feature Contract

### Goal

Define exactly what Culinary Secrets is.

### Story 1.1 — Write Design Contract

**Owner:** Rules Architect
**Deliverable:** “Culinary Secrets Design Contract”

**Tasks**

* State scope:

  * RSS Stage 4: Secrets extension
  * extension lens only; no new gameplay phase
  * expedition infrastructure procedure integrated with Recon/Salvage/Secrets flow
* State outputs:

  * Comfort
  * Traits
  * Intel
* State non-goals:

  * not a separate crafting tree
  * not a nutrition sim
  * not a pure buff engine
  * not a detached cooking minigame
* Lock alpha constraints:

  * Quartermaster remains the week-scale logistics anchor
  * Culinary Secrets operates at turn/watch scale and updates Company state
  * weekly supply effects do not stack with Quartermaster Skilled reduction unless a playtest exception is explicitly stated
  * Comfort tiers upward into Comfort Dice at higher result tiers
  * Traits outcomes must be tracked as explicit carried temporary effects
  * Intel outcomes must produce actionable route/faction/site clues
  * preservation state is Fresh/Stable/Spoiled only in alpha
  * kitchen actions carry signature risk (smoke/scent/ritual heat/public prep)

**Definition of Done**

* Approved short doctrine with scope and non-goals.

---

### Story 1.2 — Lock Design Principles

**Owner:** Council / Design Lead
**Deliverable:** principle list

**Tasks**

* Finalize principle set:

  * Meals reveal the place.
  * Preparation method matters.
  * Shared meals matter more than solo use.
  * Disgust and risk remain in play.
  * Food grants knowledge before raw power.
  * Culinary actions are pressure-sensitive.
  * Structure creates discovery.
  * Kitchen scenes are risk events, not free downtime.
  * Recipes are hypotheses discovered in play, not guaranteed consumables.

**Definition of Done**

* Principle list embedded in working draft.

---

### Story 1.3 — Acceptance Criteria

**Owner:** Producer / Editor
**Deliverable:** alpha acceptance checklist

**Tasks**

* Require:

  * one-page runnable core procedure
  * player summary
  * referee quickstart
  * 12 dishes
  * 12 ingredients
  * 1 worked Neo-Thracia area
  * 1 benchmark play example

**Definition of Done**

* Alpha checklist signed off.

---

## EPIC 2 — RSS Data Model Extension

### Goal

Make Culinary Secrets native to the FTLS API surface.

### Story 2.1 — Ingredient Tag Taxonomy

**Owner:** Systems Designer
**Deliverable:** canonical ingredient/process/service tags

**Tasks**

* Define ingredient tags:

  * `[meat] [fat] [fungus] [brine] [spice] [sweet] [toxic] [ferment] [smoke] [heat] [memory] [ley]`
* Define process tags:

  * `[raw] [roasted] [boiled] [pickled] [dried] [distilled] [ritual]`
* Define context tags:

  * `[camp] [portable] [feast] [luxury] [sacred] [contraband]`

**Definition of Done**

* Tag glossary complete and style-normalized.

---

### Story 2.2 — Site-Context Tags

**Owner:** Systems Designer
**Deliverable:** route/faction/location tags for culinary interactions

**Tasks**

* Add tags:

  * `[choke] [loop] [secret-route] [surface-link] [deep-link] [guarded] [patrolled] [ritual-zone] [garden] [crypt] [swamp]`
* Define how edible signs can act as route clues.

**Definition of Done**

* Tag definitions integrated with site design notes.

---

### Story 2.3 — Culinary Output Classes

**Owner:** Rules Architect
**Deliverable:** output schema

**Tasks**

* Define:

  * Comfort
  * Traits
  * Intel
* Keep implementation forms (meal, preserve, field medicine, feast, recipe-secret) as delivery vehicles for the three outcome classes.
* For each, define:

  * inputs
  * time
  * test
  * result
  * complication
  * carry/storage expectations
  * pressure/attention footprint

**Definition of Done**

* Output family written in rules language.

---

### Story 2.4 — Culinary State on Company Sheet

**Owner:** UX / Sheet Designer
**Deliverable:** proposed company sheet additions

**Tasks**

* Add:

  * Pantry
  * Preserves
  * Known Recipes
  * Kitchen Gear
  * Food Reputation / Hospitality
* Keep tracking light.

**Definition of Done**

* Sheet mockup or field list completed.

---

### Story 2.5 — Outcome Handling Model

**Owner:** Rules Architect
**Deliverable:** reusable definitions

**Tasks**

* Define:

  * Comfort
  * Traits
  * Intel
* Decide mechanical form:

  * Comfort -> readiness/stability outcomes; higher tiers mint Comfort Dice (max 1 Comfort die gained per watch per company)
  * Traits -> explicit temporary carried effects that occupy inventory/track slots until expiry or purge
  * Intel -> actionable clues/questions/holds tied to route, timing, provisioning chains, faction tells, hazards, and hidden access

**Definition of Done**

* Mechanical form locked.

---

## EPIC 3 — Core Procedure

### Goal

Produce the runnable heart of the feature.

### Story 3.1 — Write Culinary Secrets Procedure

**Owner:** Rules Architect
**Deliverable:** 1-page core rule

**Tasks**

* Define inputs: 1–3 ingredient tags + method
* Define outcome selection so each successful preparation yields one primary class: Comfort, Traits, or Intel.
* Define time brackets:

  * rough prep = 1 Turn (10 minutes)
  * proper prep = 1 Watch (4 hours)
  * feast prep = 1+ Watch or a major company scene
  * preservation baseline = 1 Watch unless recipe text overrides
* Define roll/test entry
* Define outcome ladder:

  * failure
  * mixed success
  * success
  * strong success

**Definition of Done**

* Playable one-page draft exists.

---

### Story 3.2 — Failure and Contamination Rules

**Owner:** Systems Designer
**Deliverable:** failure framework

**Tasks**

* Write consequences:

  * lose a tag
  * false confidence
  * unstable Traits
  * tainted Comfort
  * bad Intel
  * tick Attention
  * attract predators/patrols
  * trigger contamination
  * produce unstable effects
  * faction-signaling aromas
  * burdens mistaken for blessings
* Add special failure riders for:

  * `[toxic] [ley] [memory] [ferment]`

**Definition of Done**

* Failure table or rules block complete.

---

### Story 3.3 — Preparation Quality Ladder

**Owner:** Systems Designer
**Deliverable:** quality scale

**Tasks**

* Define:

  * rushed
  * serviceable
  * good
  * excellent
* Tie quality to:

  * tools
  * time
  * expertise
  * ingredient fit
  * site pressure

**Definition of Done**

* Quality ladder integrated with core procedure.

---

### Story 3.4 — Preservation Rules

**Owner:** Logistics Designer
**Deliverable:** lightweight preserve rules

**Tasks**

* Support:

  * dried
  * pickled
  * packed
  * candied
  * distilled
* Clarify:

  * state model: Fresh / Stable / Spoiled
  * time
  * spoilage
  * field viability
  * future-use benefits

**Definition of Done**

* Preserves are runnable without heavy bookkeeping.

---

### Story 3.5 — Field Kitchen Under Pressure

**Owner:** Delve Specialist
**Deliverable:** dangerous-site prep rules

**Tasks**

* Add:

  * 10-minute rough prep
  * interrupted cooking
  * smokeless / concealed prep
  * abandon-the-pot consequences
  * consume-on-the-move option
  * explicit fuel/tool requirements and substitutions
* Clarify what can and cannot be done in active exploration time.

**Definition of Done**

* Procedure supports non-restful use.

---

## EPIC 4 — FTLS Integration

### Goal

Make the feature feel fully native.

### Story 4.1 — Bonus Dice Integration

**Owner:** Systems Integrator
**Deliverable:** bonus-die guidance

**Tasks**

* Define how Comfort grants bonus dice.
* Lock cap: max 1 Comfort die gained per watch per company.
* Clarify non-stacking with Quartermaster Skilled week-scale supply reduction unless a specific playtest packet says otherwise.
* Clarify whether special dishes can mint other temporary dice flavors.
* Keep culinary benefits narrower than generic power inflation.
* Require table-facing Comfort tier language (steady -> recover -> reinforce -> comfort-die tier).

**Definition of Done**

* Bonus-die hooks documented.

---

### Story 4.2 — Attention Integration

**Owner:** Systems Integrator
**Deliverable:** culinary signatures rules

**Tasks**

* Add Attention triggers:

  * smoke
  * scent
  * ritual heat
  * public slaughter
  * shrine offering disturbance
  * food theft
  * faction-signaling aromas
* Add low-signature option:

  * quiet kitchen / cold prep / hidden prep

**Definition of Done**

* Attention hooks present in core rules.

---

### Story 4.3 — Delve Integration

**Owner:** Delve Specialist
**Deliverable:** timing rules for dungeons and short-expedition mode

**Tasks**

* Clarify when prep happens during Delve time.
* Support quick use in unsafe areas.
* Link food scenes to encounter pressure and route choice.

**Definition of Done**

* Delve timing notes complete.

---

### Story 4.4 — Faction Integration

**Owner:** Faction Designer
**Deliverable:** faction hooks

**Tasks**

* Support:

  * feast diplomacy
  * tribute dishes
  * taboo violations
  * provisioning politics
  * captive feeding / deprivation
  * food prestige

**Definition of Done**

* At least 6 faction-facing uses written.

---

### Story 4.5 — Powers and Gear Integration

**Owner:** Powers/Gear Editor
**Deliverable:** cross-links

**Tasks**

* Add kitchen gear entries.
* Add 2–3 recipe-secrets that interact with powers or ritual permissions.
* Add select ingredient/fuel interactions where fitting.

**Definition of Done**

* Cross-links drafted.

---

### Story 4.6 — Encounter Stack Integration

**Owner:** Expedition Procedures Lead
**Deliverable:** culinary hooks for encounter stack play

**Tasks**

* Add stack entries like:

  * recent butcher site
  * scavengers on scent
  * stolen stores
  * shrine offering disturbed
  * midden trail
  * cooking smoke seen below
* Clarify how meal scenes modify future stack entries.

**Definition of Done**

* Encounter stack addendum completed.

---

### Story 4.7 — Rumor / Language / Taboo Integration

**Owner:** Lore Systems Editor
**Deliverable:** info-flow hooks

**Tasks**

* Add:

  * false culinary rumors
  * sacred prohibitions
  * recipe inscriptions
  * old language preparation notes
  * faction-specific food customs
* Link recipe-secrets to archives, inscriptions, and NPC teaching.

**Definition of Done**

* At least one rumor table and one language note block drafted.

---

## EPIC 5 — Content Libraries

### Goal

Give the feature enough meat to actually run.

### Story 5.1 — Ingredient Library

**Owner:** Content Designer
**Deliverable:** 36+ ingredients

**Tasks**

* Cover buckets:

  * beast
  * fungus
  * plant
  * mineral/salt
  * shrine/offering
  * noospheric/daemonic
  * patrol rations
  * captive fare
  * swamp prey
  * garden stock
* For each:

  * tags
  * taste/texture
  * danger
  * prep note
  * likely result

**Definition of Done**

* First 36 entries drafted.

---

### Story 5.2 — Recipe Library

**Owner:** Content Designer
**Deliverable:** 24+ recipes

**Tasks**

* Subfamilies:

  * expedition staples
  * quiet meals
  * route meals
  * ritual dishes
  * preserves
  * field medicines
  * feast dishes
* Give each:

  * ingredients/tags
  * method
  * result (Comfort, Traits, or Intel)
  * complication hook
  * flavor note

**Definition of Done**

* First 24 entries drafted.

---

### Story 5.3 — Culinary Node Library

**Owner:** Site Designer
**Deliverable:** 24 node templates

**Tasks**

* Examples:

  * lantern mussel shelf
  * spice vent
  * midden pit
  * funerary kitchen
  * blind eel cistern
  * fungus garden
  * temple offering niche
  * predator butcher ledge

**Definition of Done**

* Node packet drafted.

---

### Story 5.4 — Worked Area Library

**Owner:** Site Designer
**Deliverable:** 3–5 worked areas

**Tasks**

* One layered ruin
* One frontier/wild area
* One urban/shrine-net area
* Optional fourth mythic or noospheric site
* Each includes:

  * edible nodes
  * salvage
  * routes
  * pressure
  * culinary consequences

**Definition of Done**

* First 3 areas complete.

---

### Story 5.5 — Thracia Exemplar Packet

**Owner:** Thracia Translation Lead
**Deliverable:** benchmark content set

**Tasks**

* 12 Neo-Thracia ingredients
* 12 Thracia-style dishes
* 8 culinary nodes
* 3 faction provisioning chains
* 1 rumor table
* 1 culinary encounter stack
* 1 route-sign example

**Definition of Done**

* Packet complete enough for benchmark playtest.

---

## EPIC 6 — Referee and Player UX

### Goal

Make the system easy to teach and fast to run.

### Story 6.1 — Referee Quickstart

**Owner:** UX Writer
**Deliverable:** 1-page “Run Culinary Secrets Tonight”

**Tasks**

* When to call the procedure
* What to ask the table
* How to improvise tags
* How to keep meal scenes short
* How to use danger and interruption

**Definition of Done**

* Printable quickstart drafted.

---

### Story 6.2 — Player Summary

**Owner:** UX Writer
**Deliverable:** half-page player handout

**Tasks**

* Explain:

  * what players can attempt
  * why prep matters
  * what kinds of benefits exist
  * what risks remain live

**Definition of Done**

* Handout draft complete.

---

### Story 6.3 — Reference Tables

**Owner:** UX Writer / Editor
**Deliverable:** compact reference set

**Tasks**

* ingredient tags
* result options
* contamination/failure
* preservation modes
* sample dishes

**Definition of Done**

* Table pack complete.

---

### Story 6.4 — Example of Play

**Owner:** Actual Play Writer
**Deliverable:** annotated transcript

**Tasks**

* Show:

  * Recon
  * Salvage
  * Culinary Secrets
  * interruption or pressure
  * aftermath
* Include some banter and one hard choice.
* Include one misleading-blessing failure outcome in the transcript.

**Definition of Done**

* Example of play draft complete.

---

### Story 6.5 — Live Dungeon Referee Sheet

**Owner:** Delve Specialist
**Deliverable:** one-page live-site guide

**Tasks**

* How to place edible traces
* How to signal food chains
* How to interrupt a meal
* How to let food reveal routes
* How to keep pressure active

**Definition of Done**

* Live dungeon sheet complete.

---

## EPIC 7 — Documentation / API Integration

### Goal

Make the feature discoverable in the existing SDM+/FTLS content architecture.

### Story 7.1 — Chapter Placement

**Owner:** Line Editor
**Deliverable:** outline insertion plan

**Tasks**

* Place core rules under:

  * FTLS RSS / Secrets
* Add appendix or sidebars where needed.

**Definition of Done**

* Placement plan approved.

---

### Story 7.2 — Index and Recognizer Pass

**Owner:** Content Architect
**Deliverable:** search/index updates

**Tasks**

* Add terms:

  * culinary secrets
  * comfort
  * traits
  * intel
  * meal
  * preserve
  * feast
  * ingredient tags
  * attention smoke scent
* Add recognizable dish and recipe names.

**Definition of Done**

* Index terms list completed.

---

### Story 7.3 — Gear Cross-link Pass

**Owner:** Gear Editor
**Deliverable:** gear link notes

**Tasks**

* Link cookware, preserving kits, distillers, knives, shrine cauldrons.

**Definition of Done**

* Gear cross-link notes done.

---

### Story 7.4 — Powers Cross-link Pass

**Owner:** Powers Editor
**Deliverable:** powers integration note

**Tasks**

* Add recipe-secrets as unlocks/fuels where fitting.
* Keep it selective.

**Definition of Done**

* Powers note completed.

---

### Story 7.5 — Compliance Pass

**Owner:** Editor / Steward
**Deliverable:** clean-source check

**Tasks**

* Ensure synthesis remains original.
* Avoid verbatim borrowing.
* Keep “inspired by feeling” clear.

**Definition of Done**

* Compliance check signed off.

---

### Story 7.6 — Thracia Reference Note

**Owner:** Lore Steward
**Deliverable:** explicit internal note

**Tasks**

* State:

  * Thracia is a core design reference
  * not all original mechanics are ported directly
  * site grammar, pressure, and faction logic are the actual takeaways

**Definition of Done**

* Reference note included in design packet.

---

## EPIC 8 — Playtest and Balancing

### Goal

Prove the feature works in motion.

### Story 8.1 — Solo Audit

**Owner:** Rules QA
**Deliverable:** issue log

**Tasks**

* Check for:

  * infinite food loops
  * too much tracking
  * too much healing
  * comfort spam
  * trait overload or slot confusion
  * misleading intel collapse
  * pressure collapse

**Definition of Done**

* QA issue log created.

---

### Story 8.2 — Wave A: Neo-Thracia Jaquayed Ruin Benchmark

**Owner:** Playtest Lead
**Deliverable:** first benchmark report

**Tasks**

* Run multi-entry ruin with:

  * vertical routes
  * 3 factions
  * active encounter stack
  * at least one food-source area
* Measure:

  * pace
  * clarity
  * route revelation
  * faction consequence
  * fun
  * number of Culinary actions attempted
  * number of Attention ticks caused by Culinary actions
  * average Tick cost per successful meal/preserve
  * number of encounters influenced by culinary signatures
  * number of times Quiet Approach/quiet kitchen changed outcomes
  * whether players chose Culinary play while Attention was already high
  * distribution of outcomes by Comfort/Traits/Intel
  * percentage of Intel outcomes that changed route or faction decisions within one scene
  * number of Trait outcomes that created tracking burden or caused slot pressure
  * number of false-confidence / tainted-comfort / bad-intel incidents

**Definition of Done**

* Test report completed.

---

### Story 8.3 — Wave B: Thracia-Pattern Original Benchmark

**Owner:** Playtest Lead
**Deliverable:** test report

**Tasks**

* Run one benchmark site built as a Thracia-pattern original.
* Validate transfer from Neo-Thracia benchmark to original site design.

**Definition of Done**

* Test report completed.

---

### Story 8.4 — Wave C: Urban/Shrine Test

**Owner:** Playtest Lead
**Deliverable:** test report

**Tasks**

* Run food politics, taboo, hospitality, and ritual cooking in social site context.

**Definition of Done**

* Test report completed.

---

### Story 8.5 — Thracia Benchmark Session

**Owner:** Thracia Translation Lead
**Deliverable:** benchmark packet + postmortem

**Tasks**

* Use Benchmark A (Neo-Thracia) and Benchmark B (Thracia-pattern original).
* Run at least one full session in each benchmark.
* Record:

  * what food revealed about the site
  * whether it changed route choice
  * whether it deepened faction play
  * whether it stayed fast

**Definition of Done**

* Postmortem written and actioned.

---

### Story 8.6 — Balance Pass

**Owner:** Rules Architect
**Deliverable:** revision draft

**Tasks**

* Tune outputs
* trim tags
* simplify tracking
* nerf anything that trivializes pressure

**Definition of Done**

* Revised alpha rules drafted.

---

## EPIC 9 — Release Packaging

### Goal

Produce the actual shippable alpha packet.

### Story 9.1 — Alpha Packet

**Owner:** Release Editor
**Deliverable:** alpha feature package

**Contents**

* core procedure
* tag glossary
* result rules
* failure rules
* player summary
* referee quickstart
* 12 ingredients
* 12 dishes
* 1 worked Neo-Thracia area
* 1 benchmark play example

**Definition of Done**

* alpha packet assembled.

---

### Story 9.2 — Expanded Content Packet

**Owner:** Release Editor
**Deliverable:** fuller support package

**Contents**

* larger ingredient/recipe library
* more worked areas
* gear/power links
* faction and mythic extensions

**Definition of Done**

* expanded packet assembled.

---

### Story 9.3 — Migration / Changelog Note

**Owner:** Release Editor
**Deliverable:** release note

**Tasks**

* Explain:

  * what changed
  * where rules live
  * what is optional
  * what remains compatible

**Definition of Done**

* release note done.

---

# Milestones

## Milestone A — Doctrine + Rules Skeleton

Includes:

* Epic 0
* Epic 1
* Epic 2 core
* Epic 3 core

**Exit Criteria**

* one-page core rule exists
* tags are defined
* Thracia fit is explicit

---

## Milestone B — Native Integration

Includes:

* Epic 4 core
* Epic 6 partial
* Epic 7 partial

**Exit Criteria**

* feature feels FTLS-native
* Attention and Encounter Stack hooks exist
* referee can run it in a live site

---

## Milestone C — Content Proof

Includes:

* Epic 5 core
* Thracia exemplar packet
* example of play

**Exit Criteria**

* enough content exists to sell the fantasy at table
* 3 worked sites/areas complete

---

## Milestone D — Benchmark and Alpha

Includes:

* Epic 8
* Epic 9.1

**Exit Criteria**

* benchmark run complete
* alpha packet assembled
* revision pass applied

---

# Suggested Sprint 1

The smallest meaningful slice:

1. Thracia Fit Doctrine
2. Culinary Secrets Design Contract
3. Ingredient Tag Taxonomy
4. Output Classes
5. One-Page Core Procedure
6. Failure / Contamination Rules
7. 12 Sample Dishes
8. 12 Sample Ingredients
9. 1 Referee Quickstart
10. 1 Worked Neo-Thracia Area

**Sprint 1 success condition:**
A local Lares can run one session from draft materials without inventing the whole feature from scratch.

---

# Team Roles

* **Rules Architect:** doctrine, procedure, currencies
* **Systems Integrator:** Attention, Bonus Dice, FTLS alignment
* **Thracia Translation Lead:** site grammar, benchmark packet
* **Content Designer:** dishes, ingredients, nodes
* **UX Writer:** quickstarts, summaries, tables
* **Playtest Lead:** benchmark sessions, reports
* **Release Editor:** packet assembly, migration notes

---

# Deferred Questions for Post-Alpha

These are intentionally deferred until telemetry is collected:

1. Should Comfort cap remain at 1 die per watch, or flex by company scale/quality tier?
2. Should Traits split into sub-lanes (adaptation, mutation, resistance), or stay one tracked family?
3. What Intel reliability profile is healthiest for play: mostly true, mixed-signal, or tier-dependent confidence?
4. Does preservation need a fourth state after alpha, or are Fresh/Stable/Spoiled sufficient?

---

# Hand-off Summary

This backlog draft is ready for:

* conversion into a board,
* division among local Lares roles,
* or expansion into a formal design packet.

**Council guidance:** start with doctrine, tags, and the one-page procedure. If those three are clean, the rest accretes correctly. If they are muddy, the whole kitchen fills with smoke.
