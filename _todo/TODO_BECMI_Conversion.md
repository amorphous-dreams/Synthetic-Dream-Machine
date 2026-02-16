# TODO: BECMI -> SDM+ Conversion

## Purpose
- Build a repeatable rubric for converting BECMI/Rules Cyclopedia procedures into SDM+ canonical procedures.
- Use the BECMI ladder (Basic/Expert/Companion/Master/Immortal) as the organizing frame.
- Use SDM+FTLS/OGA/VLG/UVG material in this repo as the canonical SDM+ translation target.

## Source Priority and Intent Statement
Intent Statement: Align and curate BECMI/Rules Cyclopedia material into the SDM+ system reference documents. New material and refinements are triaged into either the SDM numbered chapters (room to add more) when clear patterns exist in the Source Priority documents, or into FTLS numbered chapters for net-new procedures and refinements. Elyncia and meta documents are not part of this source priority. The canonical source chosen should be reflected in the SDM numbered chapters. We will not convert 100% of BECMI material; the target is a spiritual successor.

As we proceed with the Alignment rating and QA confidence pass, we will plan where to edit the SDM or FTLS chapters to increase the ratings. SDM chapters capture procedures and verbatim text from the SDM+ books, while FTLS has net-new material.

Source Priority (highest to lowest):
1. Our Golden Age (canonical: spend XP for each attribute; level-packages are legacy shorthand).
2. Vastlands Guidebook.
3. Ultraviolet Grasslands.
4. All other SDM books.

## Alignment Constants (Later Passes)
- Character level scaling: `2` BECMI character levels = `1` SDM character Level.
- Spell-to-power scaling: `Spell Level x2 = SDM Power Level`; cantrips map to `Power Level 1`.

## Rubric Scale (0.0-1.0)

| Score | Meaning | Operational definition |
|---|---|---|
| 0.00 | Absent | No usable SDM+ equivalent procedure found. |
| 0.10-0.25 | Mentioned | Concept exists as lore/flavor only; no runnable loop. |
| 0.26-0.40 | Fragmentary | One-off rule or table exists, but missing key loop inputs/outputs. |
| 0.41-0.60 | Functional | Runnable at table in narrow scope; weak escalation or poor integration. |
| 0.61-0.80 | Strong | Repeatable procedure with clear cadence and costs; integrates with adjacent systems. |
| 0.81-0.95 | Canon-ready | Mature, reusable, and cross-linked; minor gaps in edge cases or tier escalation. |
| 0.96-1.00 | Canonical | Fully articulated ladder translation with robust procedures and handoff between scales. |

Scoring note: this document is now in **quality confidence reporting** mode. Legacy planning fields (`baseline`, `target`, `delta`) remain only as historical context; current pass results should be treated as quality assessments of runnable SDM+ procedures.

## Quality Confidence Method (Per Principle)
- Evaluate one principle at a time (`B01`, then `B02`, etc.) and produce a quality confidence score using the 0.0-1.0 rubric.
- Start with called-out SDM references in this file, then perform a repo-wide markdown sweep to capture reused system patterns.
- Treat each score as: "How confidently can this principle run today in SDM+ with minimal patching?"
- Record both positive evidence (existing procedures) and negative evidence (missing loops, placeholders, ambiguous wording).
- Explicitly track pattern consistency across scales (for example, save semantics vs general ability test semantics).

### Required Evidence for a Quality Confidence Score
- **Coverage evidence:** where the principle is directly implemented (rules text, tables, or procedures).
- **Behavior evidence:** how the loop actually resolves at the table (trigger -> cadence -> roll/test -> consequence -> escalation/reset).
- **Pattern evidence:** repeated design patterns used by Luka across books/scales.
- **Gap evidence:** placeholders, contradictory wording, or missing handoffs.
- **Confidence rationale:** short statement linking evidence quality to assigned score.

### Repo-Wide SDM+ Sweep Scope (for each principle)
- Core SDM: `Synthetic_Dream_Machine_01_Quickstart.md`, `Synthetic_Dream_Machine_02_Paths_Index.md`, `Synthetic_Dream_Machine_03_Traits_Index.md`, `Synthetic_Dream_Machine_04_Powers_Index.md`, `Synthetic_Dream_Machine_06_Campaign_Regions.md`, `Synthetic_Dream_Machine_05_Gear_Index.md#sdm-loot-and-treasure`.
- Canon source books: `Our_Golden_Age/Our_Golden_Age.md`, `Vastlands_Guidebook/Vastlands_Guidebook.md`, `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md`.
- FTLS stack: all `Flying_Triremes_and_Laser_Swords/*.md` (including spiritual-successor overlays like `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_09_Loot_and_Treasure.md`).
- Adjacent SDM ecosystem markdown (Elyncia, Magitecnica, ERK, TARDB) only if they materially reinforce or contradict the principle.

## First 3 Principles: Deep-Dive Plan

### Principle 1: `B01` Core Action Resolution and Target Numbers
- Goal: verify current SDM+ resolution semantics are coherent, explicit, and repeatable across all play scales.
- Start references: `Synthetic_Dream_Machine_01_Quickstart.md`, `Vastlands_Guidebook/Vastlands_Guidebook.md`, `Synthetic_Dream_Machine_02_Paths_Index.md`, `Synthetic_Dream_Machine_03_Traits_Index.md`.
- Pattern probes:
  - Save semantics versus non-save ability tests (for example, when to use `AUR/END vs 13` style saves versus other test styles).
  - TN vocabulary consistency (`difficulty`, `defense`, `ward`, opposed checks).
  - Whether class/path/trait modules alter core resolution cleanly or introduce hidden exceptions.
- Deliverable:
  - Quality confidence score for `B01`.
  - Evidence matrix (`where rule appears`, `how it resolves`, `edge-case behavior`).
  - Gap list with exact patch targets.

### Principle 2: `B02` Resource Pressure in Exploration
- Goal: measure whether attrition (inventory, burdens, consumables, load) is procedurally complete and cross-scale coherent.
- Start references: `Synthetic_Dream_Machine_01_Quickstart.md`, `Vastlands_Guidebook/Vastlands_Guidebook.md`, `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md`.
- Pattern probes:
  - How supply units and carry units translate (`wallet/stone/sack` style abstractions).
  - Depletion cadence linkage to travel/event cadence (turn/watch/week).
  - Interaction with salvage and cargo economics (`FTLS 04`, `FTLS 09` placeholder context).
- Deliverable:
  - Quality confidence score for `B02`.
  - Attrition loop diagram (`consume -> constrain -> consequence -> recovery`).
  - Missing pressure points and wording fixes.

### Principle 3: `B03` Encounter Pacing and Table Pressure
- Goal: test whether encounter pressure is reliable, scalable, and tuned for both expedition and operation play.
- Start references: `Synthetic_Dream_Machine_01_Quickstart.md`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md`, `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md`.
- Pattern probes:
  - Weekly encounter cadence (UVG/Quickstart) versus watch/turn pressure cadence (RSS `Encounter Die`, `Attention`).
  - Threshold/escalation/reset behavior and whether it is explicit.
  - Interaction with reaction/morale outcomes (`B04` adjacency) and stealth/noise signals.
- Deliverable:
  - Quality confidence score for `B03`.
  - Unified pressure-cadence comparison table.
  - Identified handoff ambiguities and proposal notes.

## Quality Confidence Reports (Completed Pass: `B01`-`B05`, `E01`-`E04`, `C01`-`C04`, `M01`-`M03`, `I01`-`I03`)

### `B01` Core Action Resolution and Target Numbers
- **Quality confidence score:** `0.86` (`Canon-ready`)
- **Source-priority re-rating note:** With `OGA > VLG > UVG` weighting, confidence is anchored by VLG's explicit core chassis and UVG corroboration; OGA mostly references this chassis rather than restating it in full.
- **BECMI/RC baseline anchor:** Basic/RC expect a stable "roll vs target," clear save logic, and consistent attack-vs-defense handling (`RC Ch. 8`, `RC Ch. 13`).
- **Coverage evidence (SDM+):**
  - Core TN ladder and roll formula are explicit and repeated in `Synthetic_Dream_Machine_01_Quickstart.md:15`, `Synthetic_Dream_Machine_01_Quickstart.md:587`, `Vastlands_Guidebook/Vastlands_Guidebook.md:1550`.
  - Save semantics are explicit (`save = 13`, sacrifice on exact 13, END/AUR emphasis) in `Synthetic_Dream_Machine_01_Quickstart.md:146`, `Vastlands_Guidebook/Vastlands_Guidebook.md:980`, `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:427`.
  - Defense/ward split is explicit in `Synthetic_Dream_Machine_01_Quickstart.md:113`, `Vastlands_Guidebook/Vastlands_Guidebook.md:1007`.
- **Behavior evidence (table loop):**
  - Trigger: risky action -> TN offered by referee.
  - Resolution: `d20 + ability + skill`, roll over TN (or over defense on attacks).
  - Consequence: success/failure, with separate save-only situations for blind-luck threats.
- **Pattern consistency findings:**
  - Luka's recurring pattern is stable: saves are special-case luck tests (`13` gate), while normal action tests use ability+skill.
  - Path/trait modules generally add modifiers rather than replacing core resolution.
- **Gaps lowering score:**
  - OGA does not currently provide a standalone, complete restatement of the core action/saving framework.
  - Cross-book shorthand differs (`Defense` baseline wording and option panels), which can obscure edge-case adjudication.
  - No single canonical "resolution exceptions index" that consolidates trait-level overrides across all books.
- **Patch focus:**
  1. Add one canonical "resolution hierarchy" panel (`Action Test` vs `Save` vs `Attack vs Defense`) in SDM core.
  2. Add a compact "known exceptions" appendix (trait/power language that overrides default roll semantics).

### `B02` Resource Pressure in Exploration
- **Quality confidence score:** `0.86` (`Canon-ready`)
- **Source-priority re-rating note:** Score increases slightly under source-priority weighting because OGA/VLG/UVG already provide a strong weekly attrition backbone without requiring FTLS-first assumptions.
- **BECMI/RC baseline anchor:** Basic/Expert/RC expect inventory pressure, supply depletion, encumbrance constraints, and consequences for overextension (`RC Ch. 4`, `RC Ch. 6`, `RC Ch. 16`).
- **Coverage evidence (SDM+):**
  - Inventory/burden core is explicit in `Synthetic_Dream_Machine_01_Quickstart.md:169`, `Vastlands_Guidebook/Vastlands_Guidebook.md:1099`.
  - Weekly caravan depletion and consequences (`1 sack/creature/week`, Rule of 3/7) are explicit in `Synthetic_Dream_Machine_01_Quickstart.md:427`, `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:10367`.
  - Resource-to-operation economy exists in FTLS RSS salvage/refine loop in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:460`.
  - Encounter/resource coupling option exists via overloaded encounter die in `Vastlands_Guidebook/Vastlands_Guidebook.md:2759`.
- **Behavior evidence (table loop):**
  - `consume (supplies/load)` -> `constrain (slot/burden/pace)` -> `consequence (misfortune, loss, affliction)` -> `recovery (rest, care, resupply, crafting/salvage)`.
- **Pattern consistency findings:**
  - Unit abstraction is highly consistent across SDM/UVG/FTLS (`sp/st/sk`, week-scale provisioning).
  - Pressure is intentionally multi-scale (week travel + watch operations), matching BECMI-style attrition at different zoom levels.
- **Gaps lowering score:**
  - Canonical loot-to-transport-to-liquidation chain is still fragmented across books; FTLS chapter 09 is placeholder-level and SDM-numbered consolidation is not yet complete.
  - Resource pressure rules are distributed across multiple books without a single canonical "attrition spine" page.
- **Patch focus:**
  1. Complete SDM06 <-> FTLS09 normalization for loot/transport/liquidation interfaces.
  2. Add one canonical attrition flowchart with explicit handoffs between travel week and site operations.

### `B03` Encounter Pacing and Table Pressure
- **Quality confidence score:** `0.88` (`Canon-ready`)
- **Source-priority re-rating note:** Confidence remains high from VLG/UVG weekly encounter and reaction cadence, but drops slightly because detailed operational escalation is concentrated in lower-priority FTLS procedures.
- **BECMI/RC baseline anchor:** Basic/RC expect recurring encounter rolls, reaction/morale pressure, and time-aware risk escalation (`RC Ch. 7`, `RC Ch. 8`).
- **Coverage evidence (SDM+):**
  - Week-scale encounter cadence is explicit in `Synthetic_Dream_Machine_01_Quickstart.md:485`, `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:10626`.
  - Reaction/morale ecosystem is explicit in `Vastlands_Guidebook/Vastlands_Guidebook.md:1901`, `Synthetic_Dream_Machine_01_Quickstart.md:716`.
  - Watch/turn operational escalation is explicit in FTLS RSS Encounter Die + Attention in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:331`.
  - Cooldown/reset logic is explicit (quiet/lay low/leave) in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:437`.
- **Behavior evidence (table loop):**
  - `time passes` -> `check encounter pressure` -> `resolve reaction/threat` -> `escalate or cool` -> `repeat at active timescale`.
- **Pattern consistency findings:**
  - Reused structure is clear: random/group roll procedures, non-combat-forward encounter framing, morale/reaction as pressure valves.
  - FTLS extends rather than replaces UVG/SDM weekly cadence; this is strong BECMI-to-SDM scaling behavior.
- **Gaps lowering score:**
  - Global trigger language for zoom shifts (week <-> watch/turn) is present but still partly advisory, not fully canonicalized as one universal switchboard rule.
  - Overloaded encounter die is optional in VLG, so resource-pressure coupling can vary by table.
- **Patch focus:**
  1. Add one canonical cadence switchboard table (when to stay week-scale vs when to drop to watch/turn).
  2. Add a default encounter-pressure profile that explicitly links weekly travel events with operational Attention states.

### `B04` Morale/Reaction/Chase over Pure Attrition
- **Quality confidence score:** `0.85` (`Canon-ready`)
- **Source-priority re-rating note:** VLG remains a strong canonical anchor for reaction/morale/chase; score is moderated because OGA contributes little direct procedural reinforcement at this layer.
- **BECMI/RC baseline anchor:** Basic/RC treat encounter resolution as more than hit-point depletion: reaction, morale breakpoints, retreat/chase outcomes (`RC Ch. 7`, `RC Ch. 8`).
- **Coverage evidence (SDM+):**
  - Reaction oracle is explicit and tabled in `Vastlands_Guidebook/Vastlands_Guidebook.md:1901`.
  - Morale procedure is explicit and tabled in `Vastlands_Guidebook/Vastlands_Guidebook.md:2236`, with UVG/Quickstart summaries in `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:10660`, `Synthetic_Dream_Machine_01_Quickstart.md:716`.
  - Chase/escape procedure is explicit in `Vastlands_Guidebook/Vastlands_Guidebook.md:2313`, with UVG/Quickstart shorthand in `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:10664`, `Synthetic_Dream_Machine_01_Quickstart.md:720`.
  - FTLS reuses reaction/distance approach as a cross-scale pattern in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:348`.
- **Behavior evidence (table loop):**
  - `encounter appears` -> `reaction check` -> `conflict or negotiation posture` -> `morale test when stakes turn` -> `retreat/surrender/pursuit` -> `chase/escape resolution`.
- **Pattern consistency findings:**
  - Non-combat outcome pressure is explicit and repeatable, not an afterthought.
  - Morale math (`3 + half level`, 2d6 test) is stable across SDM/UVG references.
- **Gaps lowering score:**
  - Chase model inconsistency: UVG/Quickstart present a symmetric “both parties roll” shorthand, while VLG defines a pursuer-driven group roll.
  - No single canonical one-page flow that chains reaction -> morale -> chase for all scales.
- **Patch focus:**
  1. Canonize one chase baseline model (either symmetric opposed roll or pursuer-only group roll) and mark the other as optional variant.
  2. Add a compact reaction/morale/chase handoff panel in SDM core for round-scale and week-scale play.

### `B05` Explicit Zoom Handoff Across Round -> Turn -> Watch -> Week
- **Quality confidence score:** `0.74` (`Strong`)
- **Source-priority re-rating note:** This principle depends most on FTLS for explicit switch rules; under `OGA > VLG > UVG` weighting, confidence drops because the highest-priority sources lack one canonical scale-handoff matrix.
- **BECMI/RC baseline anchor:** Basic/Expert/RC assume stable play at multiple time scales (combat rounds, exploration turns, travel-day/week cadence) with clear transitions (`RC Ch. 6`, `RC Ch. 7`, `RC Ch. 8`).
- **Coverage evidence (SDM+):**
  - Week-scale travel and action cadence is explicit in `Synthetic_Dream_Machine_01_Quickstart.md:421`, `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:10339`.
  - FTLS defines week/watch/turn explicitly and provides "lowest scale that matters" guidance in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:80`.
  - FTLS provides explicit scale-shift trigger from discovery-week to area operations watch/turn in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:301`.
  - Round/turn conflict cadence is explicit in `Vastlands_Guidebook/Vastlands_Guidebook.md:1925`.
  - Exploration-period resource cadence is explicit in `Vastlands_Guidebook/Vastlands_Guidebook.md:2751`.
  - Between-session weekly pressure cadence appears in OGA (`I.N.T.R.`) in `Our_Golden_Age/Our_Golden_Age.md:8775`.
- **Behavior evidence (table loop):**
  - `choose current scope` (usually week) -> `zoom in when immediate tactical/operational stakes appear` (watch/turn/round) -> `resolve high-resolution loop` -> `return to broader cadence` (watch->week or round->turn/week summary).
- **Pattern consistency findings:**
  - Reused SDM+ pattern: weekly caravan backbone plus temporary high-resolution inserts for site work and conflict.
  - "Use lowest scale that matters" appears as a repeated adjudication principle, especially in FTLS.
- **Gaps lowering score:**
  - No single SDM core "scale switchboard" in OGA/VLG/UVG that canonically states trigger, cadence, outputs, and return condition for every scale.
  - Terminology is not fully normalized across books (`turn`, `watch`, `exploration period`, and initiative variants), increasing referee interpretation load at handoff points.
- **Patch focus:**
  1. Add a canonical `Scale Handoff Matrix` (`round/turn/watch/week`) with explicit switch triggers and return conditions.
  2. Mark cadence variants (for example initiative/timekeeping variants) as optional profiles under one default SDM baseline.

### `E01` Wilderness as Primary Procedure Loop
- **Quality confidence score:** `0.82` (`Canon-ready`)
- **Source-priority re-rating note:** UVG/Quickstart contain a complete wilderness week loop; confidence stays high but is tempered because OGA/VLG reinforce parts of the loop more than they restate the full sequence.
- **BECMI/RC baseline anchor:** Expert/RC expect wilderness travel to run as a repeatable engine with procedure order, supply pressure, encounter cadence, and travel-time consequences (`RC Ch. 6`, `RC Ch. 7`).
- **Coverage evidence (SDM+):**
  - Canonical weekly travel loop is explicit in `Synthetic_Dream_Machine_01_Quickstart.md:421`, `Synthetic_Dream_Machine_01_Quickstart.md:427`, `Synthetic_Dream_Machine_01_Quickstart.md:529`.
  - UVG reinforcement is explicit in `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:10339`, `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:10367`.
  - OGA weekly voyage cadence and event pressure are explicit in `Our_Golden_Age/Our_Golden_Age.md:1153`, `Our_Golden_Age/Our_Golden_Age.md:1173`.
  - VLG supports time-cost pressure and travel-linked resource assumptions in `Vastlands_Guidebook/Vastlands_Guidebook.md:1666`, `Vastlands_Guidebook/Vastlands_Guidebook.md:2757`.
- **Behavior evidence (table loop):**
  - `set weekly state (traveling / wilderness / destination)` -> `spend supplies` -> `misfortune` -> `encounter` -> `rest` -> `tally days` -> `repeat/arrive`.
- **Pattern consistency findings:**
  - Luka reuses a weekly backbone where the caravan is the unit of play and time/resource loss is the main pacing pressure.
  - Weekly event insertions (UVG travel events and OGA voyage events) slot into the same cadence without breaking loop logic.
- **Gaps lowering score:**
  - Highest-priority sources do not yet provide one SDM-numbered, canonical wilderness loop page that merges UVG sequence + OGA ticket/event framing.
  - Terrain/season route exceptions and forced-march edge cases are still spread across books and examples.
- **Patch focus:**
  1. Add one canonical `Wilderness Week Procedure` in SDM core with strict step order and branch conditions.
  2. Add optional overlays (`Ticket Dice`, seasonal limits, convoy profile variants) as explicit modules, not implied assumptions.

### `E02` Discovery Generation and Mapping Workflow
- **Quality confidence score:** `0.78` (`Strong`)
- **Source-priority re-rating note:** Discovery generation is robust in UVG and expanded in FTLS, but confidence remains below canon-ready because OGA/VLG provide limited first-class discovery/mapping procedure coverage.
- **BECMI/RC baseline anchor:** Expert/RC expect exploration to generate navigable new content and update world knowledge through mapping and site procedures (`RC Ch. 7`, `RC Ch. 17`).
- **Coverage evidence (SDM+):**
  - Destination discovery action is explicit in `Synthetic_Dream_Machine_01_Quickstart.md:603`, `Synthetic_Dream_Machine_01_Quickstart.md:609`.
  - UVG map-use and map-update behavior is explicit in `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:530`, `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:537`.
  - UVG discovery generator depth is explicit in `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:9256`.
  - FTLS translates discoveries into Area/Node workflow with scale handoff in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:273`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:299`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:303`.
- **Behavior evidence (table loop):**
  - `arrive` -> `look for discoveries` -> `resolve result count` -> `place/map discoveries` -> `convert discovery to explorable area` -> `harvest intel/resources`.
- **Pattern consistency findings:**
  - Reused SDM+ pattern: map as living artifact plus procedural content discovery, then zoom from travel-scale discovery into operation-scale site play.
  - RSS node logic preserves BECMI-style "found content -> actionable sub-procedures" behavior.
- **Gaps lowering score:**
  - No single source-priority canonical format for discovery output fields (distance, direction, tags, stakes, yield, escalation).
  - Lost/reorientation and failed-search fallback procedures are implied rather than standardized across SDM chapters.
- **Patch focus:**
  1. Add one SDM-numbered `Discovery Record Template` (minimum required fields + map notation standard).
  2. Add explicit `Lost / Recovery / Reattempt` procedure so discovery flow stays runnable when searches fail or routes collapse.

### `E03` Camp/Destination Action Economy
- **Quality confidence score:** `0.84` (`Canon-ready`)
- **Source-priority re-rating note:** Confidence is high because the action menu is explicit in UVG/Quickstart and partially reinforced by OGA weekly ticket/destination structures, with FTLS extending options at operation scale.
- **BECMI/RC baseline anchor:** Expert play expects a clear non-combat action menu at camp/settlement scale with opportunity costs, skill checks, and follow-on consequences (`RC Ch. 6`, `RC Ch. 17`).
- **Coverage evidence (SDM+):**
  - Destination/camp action menu is explicit in `Synthetic_Dream_Machine_01_Quickstart.md:599`, with procedure outcomes from `Synthetic_Dream_Machine_01_Quickstart.md:609` through `Synthetic_Dream_Machine_01_Quickstart.md:745`.
  - UVG reinforcement is explicit in `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:10511`.
  - OGA destination-week economy support is explicit in `Our_Golden_Age/Our_Golden_Age.md:1149`, `Our_Golden_Age/Our_Golden_Age.md:1153`, `Our_Golden_Age/Our_Golden_Age.md:1173`.
  - FTLS extends action consequences via watch-scale operations in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:460`.
- **Behavior evidence (table loop):**
  - `weekly context` -> `each PC chooses destination/camp action` -> `resolve cost/time/roll` -> `apply new resources/intel/status` -> `return to travel or local operations`.
- **Pattern consistency findings:**
  - "One week, meaningful choice, explicit tradeoff" is highly consistent across travel, camp, destination, and downtime contexts.
  - Action economy ties directly into exploration pressure (supplies, discoveries, encounters, attention) instead of isolated minigames.
- **Gaps lowering score:**
  - Cross-source normalization for helper/retainer delegation and multi-PC parallel actions is still under-specified in one canonical panel.
  - OGA ticket-dice framing and UVG action-menu framing are compatible but not yet explicitly reconciled in SDM core text.
- **Patch focus:**
  1. Add one canonical `Destination/Camp Action Economy` panel (who acts, how often, delegation limits, stacking rules).
  2. Add a compatibility sidebar mapping `Ticket Dice` effects to destination/camp action outcomes.

### `E04` Time as Content (Distance, Delay, Attrition)
- **Quality confidence score:** `0.80` (`Strong`)
- **Source-priority re-rating note:** Time pressure is pervasive across OGA/VLG/UVG/FTLS, but confidence remains `Strong` rather than `Canon-ready` because timing semantics are distributed and not yet normalized into one shared SDM time kernel.
- **BECMI/RC baseline anchor:** Expert/RC assume time is a primary gameplay resource, driving movement rates, interruptions, encounter rolls, and attrition (`RC Ch. 6`, `RC Ch. 7`).
- **Coverage evidence (SDM+):**
  - Delay and day-tally logic in travel loop is explicit in `Synthetic_Dream_Machine_01_Quickstart.md:477`, `Synthetic_Dream_Machine_01_Quickstart.md:529`.
  - UVG map/time notation and discovery distance outputs are explicit in `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:537`, `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:9260`.
  - VLG time-as-resource pressure is explicit in `Vastlands_Guidebook/Vastlands_Guidebook.md:2753`, `Vastlands_Guidebook/Vastlands_Guidebook.md:2757`, `Vastlands_Guidebook/Vastlands_Guidebook.md:2761`.
  - FTLS scale and heat/cooldown timing behavior is explicit in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:85`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:439`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:447`.
  - OGA weekly event/interrupt cadence is explicit in `Our_Golden_Age/Our_Golden_Age.md:1173`, `Our_Golden_Age/Our_Golden_Age.md:8775`, `Our_Golden_Age/Our_Golden_Age.md:8784`.
- **Behavior evidence (table loop):**
  - `time unit advances` -> `resources/events/pressure trigger` -> `delay/attrition consequences apply` -> `scope may shift (turn/watch/week)` -> `calendar and world state move forward`.
- **Pattern consistency findings:**
  - Luka repeatedly uses time as the main cost currency (days, weeks, watches) rather than treating it as pure narration.
  - Attrition, encounter pressure, and world events are all time-indexed, enabling predictable escalation.
- **Gaps lowering score:**
  - No single canonical conversion matrix between `round/turn/watch/day/week` with default trigger frequencies and fallback guidance.
  - Terminology and pacing controls vary (`exploration period`, `watch`, `week`, event tally), increasing adjudication overhead.
- **Patch focus:**
  1. Add a canonical SDM `Time Kernel` page with default scales, trigger cadence, and conversion heuristics.
  2. Add one unified `Delay and Attrition Stack` that defines what happens when time slips (travel, operations, downtime, between-session play).

### `C01` Domain Economy and Estate Operations
- **Quality confidence score:** `0.84` (`Canon-ready`)
- **Source-priority re-rating note:** Confidence is anchored by OGA's explicit estate economy procedures; VLG/UVG are secondary support, while SDM Quickstart mostly points into OGA rather than restating a full domain turn.
- **BECMI/RC baseline anchor:** Companion/RC expect holdings to produce revenue, incur risk, and require periodic management decisions beyond expedition play (`RC Ch. 12`).
- **Coverage evidence (SDM+):**
  - Company-level economic scaffolding (expenses, assets, returns) is explicit in `Synthetic_Dream_Machine_01_Quickstart.md:410`, `Synthetic_Dream_Machine_01_Quickstart.md:413`.
  - Full estate scale/value/revenue ladder is explicit in `Our_Golden_Age/Our_Golden_Age.md:2588`, `Our_Golden_Age/Our_Golden_Age.md:2596`.
  - Property classes and investment/revenue models are explicit in `Our_Golden_Age/Our_Golden_Age.md:2610`, `Our_Golden_Age/Our_Golden_Age.md:2627`, `Our_Golden_Age/Our_Golden_Age.md:2651`.
  - Periodic estate outcome resolution is explicit in `Our_Golden_Age/Our_Golden_Age.md:2668`.
- **Behavior evidence (table loop):**
  - `hold property/investments` -> `pay/refit/expand` -> `run periodic estate result` -> `apply next-cycle revenue modifiers` -> `reinvest or absorb losses`.
- **Pattern consistency findings:**
  - Luka reuses recurring "weekly cashflow + long-cycle outcome roll" structure across labor, caravans, and estates.
  - Economy procedures are intentionally tied to world pressure (events, taxes, disruptions), not isolated accounting minigames.
- **Gaps lowering score:**
  - No single SDM-numbered canonical `Domain Turn` unifying weekly, seasonal, and annual checks under one default timing model.
  - Non-estate domain archetypes (guild network, civic ministry office, mercantile house, cult infrastructure) are not equally formalized with equivalent procedure blocks.
- **Patch focus:**
  1. Add canonical `Nexus/Domain Turn` cadence (`week -> season -> year`) with required checks and outputs.
  2. Add 3-4 domain archetype profiles that map the estate loop to non-landed institutions.

### `C02` Domain Pressure Events and Escalation Ladders
- **Quality confidence score:** `0.88` (`Canon-ready`)
- **Source-priority re-rating note:** OGA provides the strongest event-escalation engine in the source priority stack; SDM region tooling reinforces the same escalating event design language.
- **BECMI/RC baseline anchor:** Companion/RC domain play expects external pressures (disasters, politics, war, unrest) to emerge procedurally and escalate over time (`RC Ch. 12`, `RC Ch. 17`).
- **Coverage evidence (SDM+):**
  - INTR ladder and weekly trigger cadence are explicit in `Our_Golden_Age/Our_Golden_Age.md:8775`, `Our_Golden_Age/Our_Golden_Age.md:8784`.
  - Linked escalation logic across `Incident -> Nuisance -> Trouble -> Rupture` is explicit in `Our_Golden_Age/Our_Golden_Age.md:8806`, `Our_Golden_Age/Our_Golden_Age.md:8844`, `Our_Golden_Age/Our_Golden_Age.md:8866`, `Our_Golden_Age/Our_Golden_Age.md:8894`.
  - Region event design in SDM chapters preserves the same escalation grammar in `Synthetic_Dream_Machine_06_Campaign_Regions.md:31`, `Synthetic_Dream_Machine_06_Campaign_Regions.md:92`, `Synthetic_Dream_Machine_06_Campaign_Regions.md:304`.
- **Behavior evidence (table loop):**
  - `weekly check` -> `generate pressure tier` -> `apply local consequence` -> `chain/escalate when triggered` -> `force faction/domain response` -> `advance next week`.
- **Pattern consistency findings:**
  - Events are framed as pressure engines with clear escalation rails and explicit temporal triggers.
  - "Expected -> Surprising -> Error" and INTR share the same underlying escalation logic at different presentation scales.
- **Gaps lowering score:**
  - No unified cross-chapter mapping from INTR severity tiers to concrete domain stats (tax, unrest, infrastructure, legitimacy, faction standing).
  - Settlement-level event results are rich but need a canonical conversion into domain-track deltas to reduce referee interpretation load.
- **Patch focus:**
  1. Add an INTR-to-domain-impact conversion panel (`economy`, `order`, `infrastructure`, `faction heat`).
  2. Add default escalation clocks and recovery actions for domain administrators.

### `C03` Agent/Retainer Administration
- **Quality confidence score:** `0.72` (`Strong`)
- **Source-priority re-rating note:** Core ingredients exist across OGA and SDM/FTLS, but confidence is lower because there is no single canonical administration loop for hiring, pay, loyalty, delegation, and failure handling.
- **BECMI/RC baseline anchor:** Companion/RC expect retainers and agents to be managed procedurally (costs, reliability, delegation, consequences) rather than pure narrative handwaving (`RC Ch. 11`, `RC Ch. 12`).
- **Coverage evidence (SDM+):**
  - Baseline helper wage guidance is explicit in `Synthetic_Dream_Machine_01_Quickstart.md:419`.
  - Away-time delegation to agents is explicit in `Synthetic_Dream_Machine_01_Quickstart.md:825`.
  - Absent property requiring an agent is explicit in `Our_Golden_Age/Our_Golden_Age.md:2649`.
  - High-success estate outcome can generate a skilled loyal follower/agent in `Our_Golden_Age/Our_Golden_Age.md:2679`.
  - Crew pay/share distribution logic for operational teams is explicit in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:464`.
- **Behavior evidence (table loop):**
  - `hire/assign helper` -> `pay/compensate` -> `delegate task or absent-domain duty` -> `resolve outcomes/events` -> `adjust reliability/availability`.
- **Pattern consistency findings:**
  - Delegation and paid support are normalized as campaign tools, not edge-case exceptions.
  - Wage/share logic and follower generation recur, but at different scales and in disconnected procedure blocks.
- **Gaps lowering score:**
  - No canonical loyalty/reliability metric with trigger points for desertion, corruption, promotion, or crisis performance.
  - No unified delegated-roll procedure linking agent competence directly to domain/faction outcomes.
- **Patch focus:**
  1. Add one canonical `Agent/Retainer Block` (role, wage tier, reliability, authority, risk flags).
  2. Add delegated-resolution procedure with explicit failure externalities and improvement paths.

### `C04` Faction-Level Campaign Board Operations
- **Quality confidence score:** `0.85` (`Canon-ready`)
- **Source-priority re-rating note:** OGA's Nexus Grid provides a mature campaign-board engine; SDM region tooling reinforces faction/agent structuring but is lighter on live turn operations.
- **BECMI/RC baseline anchor:** Companion-level governance and strategic play require a stable campaign-board layer where offscreen actors move and pressure the PCs' holdings (`RC Ch. 12`, `RC Ch. 17`).
- **Coverage evidence (SDM+):**
  - Nexus Grid structure and node function are explicit in `Our_Golden_Age/Our_Golden_Age.md:8920`, `Our_Golden_Age/Our_Golden_Age.md:8924`.
  - Between-session node update procedure via events oracle is explicit in `Our_Golden_Age/Our_Golden_Age.md:8928`.
  - Faction influence balancing logic is explicit in `Our_Golden_Age/Our_Golden_Age.md:8930`.
  - Practical prep/play/after board operation loop is explicit in `Our_Golden_Age/Our_Golden_Age.md:8989`, `Our_Golden_Age/Our_Golden_Age.md:8991`, `Our_Golden_Age/Our_Golden_Age.md:8993`.
  - SDM campaign-region templates reinforce faction+agent board inputs in `Synthetic_Dream_Machine_06_Campaign_Regions.md:371`, `Synthetic_Dream_Machine_06_Campaign_Regions.md:373`.
- **Behavior evidence (table loop):**
  - `maintain node map` -> `run between-session event/oracle updates` -> `shift relationships/influence` -> `surface actionable fronts to next session`.
- **Pattern consistency findings:**
  - Board-state is treated as living campaign infrastructure, not static lore.
  - Repeated use of node relationships and faction pressure enables long-arc continuity with minimal prep overhead.
- **Gaps lowering score:**
  - No single standardized "Nexus update turn" checklist with mandatory step order and output record fields.
  - Resolution weighting (power asymmetry, PC intervention multipliers, uncertainty bands) remains partly ad hoc by referee interpretation.
- **Patch focus:**
  1. Add explicit `Nexus Grid Update Turn` sequence with required inputs/outputs.
  2. Add default weighting rules for conflict resolution between nodes/factions.

### `M01` Mass Conflict Abstraction and Command Play
- **Quality confidence score:** `0.76` (`Strong`)
- **Source-priority re-rating note:** The most complete mass-conflict loop is currently in FTLS (`08`), while OGA/VLG mostly provide compatible chassis pieces (morale, conflict cadence, command-adjacent war engines) rather than a single canonical master-tier war chapter.
- **BECMI/RC baseline anchor:** Master/RC warfare expects scalable conflict abstraction, commander influence, morale pressure, and clear action sequencing (`RC Ch. 9`).
- **Coverage evidence (SDM+):**
  - Unit-scale one-roll attack chassis and contributor damage model are explicit in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_08_Formations_and_Mass_Combat.md:14`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_08_Formations_and_Mass_Combat.md:20`.
  - DT/mitigation order and penetration logic are explicit in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_08_Formations_and_Mass_Combat.md:27`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_08_Formations_and_Mass_Combat.md:35`.
  - Commander/formation command-dice economy and reaction windows are explicit in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_08_Formations_and_Mass_Combat.md:48`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_08_Formations_and_Mass_Combat.md:64`.
  - Formation-level morale trigger is explicit in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_08_Formations_and_Mass_Combat.md:128`, with baseline morale frame in `Vastlands_Guidebook/Vastlands_Guidebook.md:2257`, `Vastlands_Guidebook/Vastlands_Guidebook.md:2289`.
- **Behavior evidence (table loop):**
  - `declare formation actions` -> `commander resolves unit attack(s)` -> `apply mitigation/DT` -> `spend command reactions` -> `trigger morale when thresholds hit` -> `reposition and repeat`.
- **Pattern consistency findings:**
  - Luka's usual "single core roll, then layered consequence handling" pattern is preserved at formation scale.
  - Command dice create a reusable tempo/countertempo loop similar to smaller-scale reaction economies.
- **Gaps lowering score:**
  - Ship/vehicle integration still includes explicit "design notes/future polish" markers in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_08_Formations_and_Mass_Combat.md:132`, so this layer is not fully canonized.
  - No source-priority SDM-numbered synthesis page yet maps `squad -> formation -> fleet` under one default procedure.
- **Patch focus:**
  1. Promote FTLS `08` formation core into an SDM-numbered canonical war-layer chapter with explicit defaults and optional modules.
  2. Finalize ship/fleet procedure as non-notes text and align morale/retreat outcomes with core SDM morale language.

### `M02` Siege Logic, Breach Tempo, and Operational Attrition
- **Quality confidence score:** `0.70` (`Strong`)
- **Source-priority re-rating note:** Siege-grade tempo control is robust in FTLS RSS and weakly reinforced by OGA/VLG; confidence is constrained because highest-priority books do not yet expose one explicit canonical siege procedure.
- **BECMI/RC baseline anchor:** Master/RC siege play expects breach logistics, defender response, escalating pressure, and time-costed attrition (`RC Ch. 8`, `RC Ch. 9`).
- **Coverage evidence (SDM+):**
  - Explicit scale handoff and operational cadence (`week/watch/turn`) are in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:87`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:303`.
  - Encounter-pressure cadence for infiltration/operations is explicit in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:333`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:338`.
  - Attention thresholds and escalation to alarm/emergency are explicit in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:356`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:364`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:419`.
  - Cooldown/recovery logic is explicit in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:441`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:448`.
  - Master-tier siege flavor reinforcement exists in OGA (`oldtech siege rods`) at `Our_Golden_Age/Our_Golden_Age.md:9640`.
- **Behavior evidence (table loop):**
  - `recon objective` -> `attempt breach/salvage/sabotage at watch scale` -> `tick attention and roll encounter pressure` -> `defender countermeasures escalate` -> `crew decides push/cool/withdraw` -> `resume or reset`.
- **Pattern consistency findings:**
  - The same SDM pressure grammar repeats cleanly: rising clock, trigger bands, forced tradeoff between speed and stealth.
  - Procedure supports both dungeon-like infiltration and larger ruin operations without changing core loop semantics.
- **Gaps lowering score:**
  - No single named `Siege-as-Dungeon` canonical chapter yet consolidates breach roles, supply handling, morale breaks, and retreat criteria.
  - Current siege implementation is distributed across RSS operational rules plus equipment/recipe fragments instead of one unified baseline.
- **Patch focus:**
  1. Author one canonical watch-based `Siege-as-Dungeon` sequence (`Approach -> Breach -> Hold -> Counter -> Withdraw/Consolidate`).
  2. Add default breach assets/counter-assets table linked to Attention bands and command/morale consequences.

### `M03` Epic System-Counterplay and Permission Economies
- **Quality confidence score:** `0.79` (`Strong`)
- **Source-priority re-rating note:** OGA and VLG contain strong permission/denial primitives (`Key and Lock`, wards, anti-magic tools), and SDM powers provide tactical counterplay; confidence is held below canon-ready because these pieces are spread across books without a single epic-tier counter-systems doctrine.
- **BECMI/RC baseline anchor:** Master/RC high-tier play expects anti-system tools (dispel/denial, artifact constraints, access conditions) that keep powerful options interactive (`RC Ch. 13`, `RC Ch. 15`).
- **Coverage evidence (SDM+):**
  - Campaign-level permission structure (`Key and Lock`) is explicit in `Our_Golden_Age/Our_Golden_Age.md:8941`, `Our_Golden_Age/Our_Golden_Age.md:8943`.
  - Access-control/keys/timing framing at high arcane-tech tiers is explicit in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:173`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:249`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:265`.
  - Tactical denial/counter kit exists via powers in `Synthetic_Dream_Machine_04_Powers_Index.md:474`, `Synthetic_Dream_Machine_04_Powers_Index.md:882`, `Synthetic_Dream_Machine_04_Powers_Index.md:1884`.
  - Wards and anti-magic infrastructure (including compatibility failure and anti-magic devices) are explicit in `Vastlands_Guidebook/Vastlands_Guidebook.md:3121`, `Vastlands_Guidebook/Vastlands_Guidebook.md:3156`, `Vastlands_Guidebook/Vastlands_Guidebook.md:3215`.
- **Behavior evidence (table loop):**
  - `identify hostile subsystem` -> `invoke key/lock or ward/counter power` -> `resolve denial/redirect/containment` -> `pay cost or suffer backlash` -> `secure access position for next exchange`.
- **Pattern consistency findings:**
  - Reused SDM+ pattern: power comes with a procedural gate (key, ward, permission, cost, risk) rather than unrestricted effect text.
  - Counterplay appears at multiple scales (scene powers, gear-based wards, campaign-board keys), which matches Master-to-Immortal escalation.
- **Gaps lowering score:**
  - No single canonical index defines when counter-systems are action-scale, watch-scale, or campaign-scale procedures.
  - Anti-magic/anti-tech/artifact denial interactions are present but fragmented, which increases adjudication variance.
- **Patch focus:**
  1. Add a canonical `Counter-Systems Doctrine` page mapping denial tools by scale (`scene`, `operation`, `campaign`).
  2. Add default conflict-order language for stacked counters (ward vs power vs key-lock effects) to reduce ruling drift.

### `I01` Cosmology as Playable Gameboard
- **Quality confidence score:** `0.82` (`Canon-ready`)
- **Source-priority re-rating note:** OGA is strong and explicit at this tier: it already frames cosmology as an actionable campaign control layer (`Omega`, `I.N.T.R.`, `Nexus Grid`), with FTLS adding compatible "immortals-as-infrastructure" framing.
- **BECMI/RC baseline anchor:** Immortal-tier play expects the cosmos itself to become the board of play while still giving referees concrete procedures (`RC Ch. 15`, `RC Ch. 18`).
- **Coverage evidence (SDM+):**
  - OGA explicitly defines a final arc toolset for campaign-scale play in `Our_Golden_Age/Our_Golden_Age.md:8636`, `Our_Golden_Age/Our_Golden_Age.md:8644`.
  - OGA `Nexus Grid` is explicitly a campaign control panel with between-session world motion in `Our_Golden_Age/Our_Golden_Age.md:8922`, `Our_Golden_Age/Our_Golden_Age.md:8928`.
  - OGA `Key and Lock` establishes cosmos-shifting levers tied to faction control in `Our_Golden_Age/Our_Golden_Age.md:8943`.
  - OGA frames major entities as cosmic levers (`Principality of the Cosmos`) in `Our_Golden_Age/Our_Golden_Age.md:9734`.
  - FTLS aligns immortals/gods to operating-substrate behavior in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_01_Title_Introduction.md:103`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_01_Title_Introduction.md:115`.
- **Behavior evidence (table loop):**
  - `maintain cosmic board (nodes + factions + levers)` -> `run between-session pressures` -> `surface playable fronts` -> `PC intervention shifts alignment and control` -> `advance Omega-adjacent arc state`.
- **Pattern consistency findings:**
  - SDM+ preserves Luka's repeated "board + oracle + fronts" pattern from human scale up to cosmic stakes.
  - Cosmology pressure is procedural and trackable, not purely lore exposition.
- **Gaps lowering score:**
  - No single SDM-numbered `Cosmology Board Turn` page yet consolidates Omega/Nexus/lever updates into one default checklist.
  - Trigger thresholds for when campaign events become "cosmic-board" events are still partly interpretive.
- **Patch focus:**
  1. Add a canonical `Cosmology Board Turn` (inputs, update order, outputs, fallout hooks).
  2. Add a default `Cosmic Lever Register` (Key/Lock equivalents, control states, escalation effects).

### `I02` Sphere-Like Factional Physics
- **Quality confidence score:** `0.68` (`Strong`)
- **Source-priority re-rating note:** OGA offers rich cosmological doctrine and factional metaphysics, while FTLS contributes procedural permission/keys logic; however, there is no explicit SDM+ "sphere-equivalent matrix" yet.
- **BECMI/RC baseline anchor:** Immortal-tier factional physics should define durable cosmic portfolios/constraints that alter what actions are possible and how conflicts resolve (`RC Ch. 15`, `RC Ch. 18`).
- **Coverage evidence (SDM+):**
  - Two-world cosmology (matter + mind) is explicit in `Our_Golden_Age/Our_Golden_Age.md:9200`.
  - Competing cosmological doctrines that drive factional action are explicit in `Our_Golden_Age/Our_Golden_Age.md:9204`, `Our_Golden_Age/Our_Golden_Age.md:9215`.
  - OGA defines immortal/cosmic actor class distinct from mortals in `Our_Golden_Age/Our_Golden_Age.md:9257`.
  - OGA `Unlords` are effectively portfolio-bearing cosmic principles in `Our_Golden_Age/Our_Golden_Age.md:9448`, `Our_Golden_Age/Our_Golden_Age.md:9452`.
  - Matter/mind translation framework establishes shared cosmic logic in `Our_Golden_Age/Our_Golden_Age.md:9496`.
  - FTLS provides procedure-facing permission physics (`keys/timing/permissions`) in `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:113`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:174`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md:259`.
- **Behavior evidence (table loop):**
  - `identify active metaphysical regime` -> `select aligned doctrine/faction/tool` -> `attempt intervention under permission constraints` -> `apply world-logic backlash or access gain` -> `shift factional-cosmic position`.
- **Pattern consistency findings:**
  - Reused SDM+ pattern: power is gated by position, permissions, and protocol compatibility.
  - "Alignment as operations constraint" appears across OGA doctrine and FTLS noospheric procedures.
- **Gaps lowering score:**
  - No canonical translation layer maps OGA cosmic actor sets into a stable SDM+ sphere-equivalent rules schema.
  - Terms (`gods`, `unlords`, `daemons`, `meta-factions`, `principality`) are rich but not normalized into one referee-facing mechanics index.
- **Patch focus:**
  1. Define `Sphere Equivalents` as explicit SDM+ portfolios (permission, prohibition, leverage, favored procedures).
  2. Add a compatibility matrix linking portfolio conflicts to concrete mechanical outcomes by scale.

### `I03` Endgame Continuity That Preserves Table Cadence
- **Quality confidence score:** `0.81` (`Canon-ready`)
- **Source-priority re-rating note:** OGA already provides strong session-to-campaign continuity scaffolding, with SDM region/event tooling and UVG world-shift warnings reinforcing how to escalate without losing procedural cadence.
- **BECMI/RC baseline anchor:** Immortal/endgame play should not dissolve procedure; it should preserve cadence while widening consequence horizon (`RC Ch. 15`, `RC Ch. 18`).
- **Coverage evidence (SDM+):**
  - OGA explicitly frames referee between-session continuity workflow in `Our_Golden_Age/Our_Golden_Age.md:8746`, `Our_Golden_Age/Our_Golden_Age.md:8767`.
  - OGA provides periodic interruption cadence (`once per week`) with escalation ladders in `Our_Golden_Age/Our_Golden_Age.md:8777`, `Our_Golden_Age/Our_Golden_Age.md:8784`.
  - OGA keeps Nexus updates tied to prep/play/after loops in `Our_Golden_Age/Our_Golden_Age.md:8989`, `Our_Golden_Age/Our_Golden_Age.md:8993`.
  - OGA frames end-arc outcomes as season/interlude/new-beginning tools in `Our_Golden_Age/Our_Golden_Age.md:8642`, `Our_Golden_Age/Our_Golden_Age.md:8644`.
  - SDM region toolkit retains escalation cadence language in `Synthetic_Dream_Machine_06_Campaign_Regions.md:31`, `Synthetic_Dream_Machine_06_Campaign_Regions.md:36`, `Synthetic_Dream_Machine_06_Campaign_Regions.md:109`.
  - UVG confirms world-changing discoveries should refactor campaign state (including potential new gods/heroes) in `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md:9335`.
- **Behavior evidence (table loop):**
  - `session play (human-scale fronts)` -> `between-session update (events + board)` -> `periodic escalation tier shifts` -> `inject endgame fallout into next actionable fronts` -> `repeat until arc pivot/new cycle`.
- **Pattern consistency findings:**
  - Luka's repeated cadence pattern holds: small-scale procedures continue even while macro stakes rise.
  - Endgame is treated as layered continuity, not a hard mode-switch into pure narrative.
- **Gaps lowering score:**
  - No canonical "arc transition packet" yet defines exactly what is preserved, reset, or transformed when a Jubilee-scale event resolves.
  - Hero-to-institution inheritance rules (what PCs keep/control across post-arc phase shifts) remain table-defined.
- **Patch focus:**
  1. Add an `Endgame Continuity Protocol` (phase thresholds, carryover assets, transformed assets, retired assets).
  2. Add an explicit `Post-Jubilee New Cycle` start procedure that feeds directly back into week-scale and node-scale play.

## Coherent Outline: Procedures, Principles, Sections

### 1) Core Engine and Table Pressure (Basic-focused)
- `B01` Core action resolution and target numbers.
- `B02` Resource pressure, encumbrance, consumables, and carry limits.
- `B03` Encounter pacing and pressure clocks.
- `B04` Reaction/morale/chase over pure attrition.
- `B05` Explicit zoom handoff across round -> turn -> watch -> week.
- Related procedure extensions: `Loot/treasure conversion`, `Treasure placement`, `Weapon/unarmed escalation`.

### 2) Expedition and World Navigation (Expert-focused)
- `E01` Wilderness as primary procedure loop.
- `E02` Discovery generation and mapping workflow.
- `E03` Camp/destination action economy.
- `E04` Time as content (distance, delay, attrition).
- Related procedure extensions: `Special movement obstacles`, `Area operations loop`, `Retainer/mercenary field utility`.

### 3) Domain, Governance, and Campaign Board (Companion-focused)
- `C01` Domain economy and estate operations.
- `C02` Domain pressure events and escalation ladders.
- `C03` Agent/retainer administration.
- `C04` Faction-level campaign board operations.
- Related procedure extensions: `Stronghold construction/infrastructure growth`, `Staff and delegation throughput`.

### 4) War Layer and Counter-Systems (Master-focused)
- `M01` Mass conflict abstraction and command play.
- `M02` Siege logic, breach tempo, and operational attrition.
- `M03` Epic-tier counter-systems, permission economies, anti-system play.
- Related procedure extensions: `Counter-magic and denial`, `Research/invention`, `Artifact lifecycle hooks`.

### 5) Cosmology and Post-Mortal Continuity (Immortal-focused)
- `I01` Cosmology as playable gameboard.
- `I02` Sphere-like factional physics.
- `I03` Endgame continuity that still preserves table cadence.
- Related procedure extensions: `Immortal rank progression`, `Home-plane development`, `multiversal campaign continuity`.

## Canonical SDM+ Base Surveyed (Condensed)
- Core resolution/combat/morale/chase: `Synthetic_Dream_Machine_01_Quickstart.md`, `Vastlands_Guidebook/Vastlands_Guidebook.md`.
- Path/trait chassis: `Synthetic_Dream_Machine_02_Paths_Index.md`, `Synthetic_Dream_Machine_03_Traits_Index.md`.
- Powers-as-spells conversion base: `Synthetic_Dream_Machine_04_Powers_Index.md`, `Vastlands_Guidebook/Vastlands_Guidebook.md`, `Our_Golden_Age/Our_Golden_Age.md`.
- Canonical treasure-generation consolidation: `Synthetic_Dream_Machine_05_Gear_Index.md#sdm-loot-and-treasure`.
- Expedition/discovery/salvage loops: `Synthetic_Dream_Machine_01_Quickstart.md`, `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md`.
- Domain/campaign board: `Our_Golden_Age/Our_Golden_Age.md`, `Synthetic_Dream_Machine_06_Campaign_Regions.md`.
- Mass combat/siege-adjacent: `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_08_Formations_and_Mass_Combat.md`, `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md`.
- Progression/economy/treasure: `Synthetic_Dream_Machine_01_Quickstart.md`, `Vastlands_Guidebook/Vastlands_Guidebook.md`, `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md`.

## Procedure Map (SDM+ Canon + RC Reinforcement)

| Procedure | Scale | Crosswalk ID(s) | BECMI Tier(s) | Extraction Cue (PDF pass) | Primary Coverage | Rules Cyclopedia Reinforcement |
|---|---|---|---|---|---|---|
| Core test and target-number chassis | Action/Round | `B01` | Basic | Core roll formula, difficulty bands, save target logic, opposed checks | `Synthetic_Dream_Machine_01_Quickstart.md` (`Typical Target Numbers`, `Roll Difficulties`)<br>`Vastlands_Guidebook/Vastlands_Guidebook.md` (`CORE MECHANICS`, `THE ROLL`) | `RC Ch. 8` p.102-107; `RC Ch. 13` p.143 |
| Conflict, morale, chase resolution | Round/Scene | `B04` | Basic | Initiative flow, reaction/morale triggers, retreat/chase outcomes | `Synthetic_Dream_Machine_01_Quickstart.md` (`Conflict and Combat`, `Morale`, `Chase`)<br>`Vastlands_Guidebook/Vastlands_Guidebook.md` (`CONFLICTS`, `MORALE`, `CHASE`) | `RC Ch. 7` p.93-99; `RC Ch. 8` p.102 |
| Paths/traits as class-package equivalents | Character/Advancement | `B01`, `M01` | Basic -> Master | Class identity, role packages, feature unlock ladders | `Synthetic_Dream_Machine_02_Paths_Index.md`<br>`Synthetic_Dream_Machine_03_Traits_Index.md`<br>`Vastlands_Guidebook/Vastlands_Guidebook.md` (`PATH`, `OTHER PATHS`) | `RC Ch. 2` p.13-31; `RC Ch. 5` p.75-86 |
| Powers as spell system (`Powers = Spells`) | Action/Scene | `B01`, `M03`, `I02` | Basic -> Immortal | Spell statline, casting cost, duration/range/target schema, overcharge risk/escalation | `Synthetic_Dream_Machine_04_Powers_Index.md` (`Power Template`, `Usage Notes`)<br>`Vastlands_Guidebook/Vastlands_Guidebook.md` (`USING POWERS`, `CORRUPTION`, `NEW POWERS`)<br>`Our_Golden_Age/Our_Golden_Age.md` (power modules) | `RC Ch. 3` p.32-61; `RC Ch. 13` p.143 |
| Inventory, burdens, and supply pressure | Turn/Week | `B02` | Basic -> Expert | Encumbrance abstractions, burden states, consumable depletion penalties | `Synthetic_Dream_Machine_01_Quickstart.md` (`HOW INVENTORY WORKS`, supplies)<br>`Vastlands_Guidebook/Vastlands_Guidebook.md` (`INVENTORY`, `BURDENS`)<br>`Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` | `RC Ch. 4` p.62-70; `RC Ch. 6` p.87-90 |
| Loot, salvage, and treasure conversion | Turn/Week/Campaign | `B02`, `E02`, `C01` | Basic -> Companion | Treasure generation/extraction, transport burden, conversion to cash/resources, downstream economy impact | `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md`<br>`Synthetic_Dream_Machine_01_Quickstart.md`<br>`Vastlands_Guidebook/Vastlands_Guidebook.md` | `RC Ch. 16` p.224-249; `RC Ch. 10` p.128 |
| Treasure placement and unguarded cache logic | Turn/Week | `B03`, `E02`, `C01` | Basic -> Companion | Unguarded treasure procedures, hoard placement logic, risk/reward by site pressure | `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md`<br>`Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md`<br>`Our_Golden_Age/Our_Golden_Age.md` | `RC Ch. 16` p.224-228; `RC Ch. 7` p.93-98 |
| Weekly caravan travel loop | Week | `E01` | Expert -> Companion | Step-by-step travel cycle: consume, misfortune, encounter, rest, progress | `Synthetic_Dream_Machine_01_Quickstart.md`<br>`Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` | `RC Ch. 6` p.88-90; `RC Ch. 7` p.91 |
| Destination/camp action economy | Week | `E03` | Expert | Allowed weekly action menu at destinations/camps; opportunity costs | `Synthetic_Dream_Machine_01_Quickstart.md`<br>`Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` | `RC Ch. 6` p.87-90; `RC Ch. 17` p.261 |
| Retainers, followers, and mercenary command loop | Week/Session | `E03`, `C03`, `M01` | Expert -> Master | Hiring, wages, loyalty/reliability, delegation and command consequences | `Synthetic_Dream_Machine_01_Quickstart.md`<br>`Our_Golden_Age/Our_Golden_Age.md`<br>`Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_08_Formations_and_Mass_Combat.md` | `RC Ch. 11` p.132; `RC Ch. 12` p.137-138 |
| Discovery generation and mapping | Week -> Day | `E02` | Expert | Discovery roll bands, mapping distance/direction, local intel generation | `Synthetic_Dream_Machine_01_Quickstart.md`<br>`Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md`<br>`Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md` | `RC Ch. 7` p.91-93; `RC Ch. 17` p.259-261 |
| Multi-scale handoff (week/watch/turn) | Week/Watch/Turn | `B05`, `E04` | Basic -> Expert | Rules for when to zoom in/out by timescale | `Synthetic_Dream_Machine_01_Quickstart.md`<br>`Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md` | `RC Ch. 6` p.87; `RC Ch. 7` p.91; `RC Ch. 8` p.102 |
| Special movement and traversal obstacles | Turn/Day/Week | `E01`, `E04`, `M02` | Expert -> Master | Climbing/swimming/terrain obstacles, forced-route delays, hazard exceptions | `Ultraviolet_Grasslands_and_the_Black_City_2e/Ultraviolet_Grasslands_and_the_Black_City_2e.md`<br>`Synthetic_Dream_Machine_01_Quickstart.md`<br>`Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md` | `RC Ch. 6` p.88-90; `RC Ch. 13` p.145 |
| Area operations loop (Recon -> Salvage -> Secrets -> Aftermath) | Watch/Turn | `E02`, `M02` | Expert -> Master | Procedure chain, costs, and post-action state updates | `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md` | `RC Ch. 7` p.91; `RC Ch. 16` p.228-249 |
| Encounter pressure and escalation clocks | Turn/Watch/Week | `B03`, `M02` | Basic -> Master | Encounter cadence, alarm thresholds, cooling/reset rules | `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md`<br>`Synthetic_Dream_Machine_01_Quickstart.md` | `RC Ch. 7` p.91-98; `RC Ch. 8` p.102 |
| Domain economy and estate operations | Week/Year | `C01` | Companion | Revenue vs expenses, maintenance tests, annual outcome tables | `Synthetic_Dream_Machine_01_Quickstart.md`<br>`Our_Golden_Age/Our_Golden_Age.md` | `RC Ch. 12` p.139-142 |
| Stronghold construction and infrastructure growth | Week/Season | `C01`, `C03`, `C04` | Companion -> Immortal | Build/expand strongholds, add facilities/staff, update campaign board | `Our_Golden_Age/Our_Golden_Age.md`<br>`Synthetic_Dream_Machine_06_Campaign_Regions.md`<br>`Synthetic_Dream_Machine_01_Quickstart.md` | `RC Ch. 12` p.135-139 |
| Agent/retainer administration | Week | `C03` | Companion | Wage tiers, delegated rolls, reliability modifiers, failure externalities | `Synthetic_Dream_Machine_01_Quickstart.md`<br>`Our_Golden_Age/Our_Golden_Age.md` | `RC Ch. 11` p.132; `RC Ch. 12` p.138 |
| Background world-pressure events | Week | `C02` | Companion -> Master | Event ladders, linked escalation, cascading consequences | `Synthetic_Dream_Machine_06_Campaign_Regions.md`<br>`Our_Golden_Age/Our_Golden_Age.md` | `RC Ch. 17` p.256-261; `RC Ch. 7` p.91-98 |
| Faction/campaign board operations | Session/Between-session | `C04` | Companion -> Immortal | Node-state updates, relationship shifts, offscreen movement | `Synthetic_Dream_Machine_06_Campaign_Regions.md`<br>`Our_Golden_Age/Our_Golden_Age.md` | `RC Ch. 12` p.135-142; `RC Ch. 17` p.256-259 |
| Region kit and event-table authoring | Region/Campaign | `E04`, `I03` | Expert -> Immortal | Region schema, travel tables, ambient/event generation formats | `Synthetic_Dream_Machine_06_Campaign_Regions.md`<br>`Our_Golden_Age/Our_Golden_Age.md` | `RC Ch. 17` p.256-261; `RC Appendix 1` p.268+ |
| Mass combat and command-layer play | Round/Formation turn | `M01` | Companion -> Master | Unit-scale abstraction, command economy, morale windows | `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_08_Formations_and_Mass_Combat.md`<br>`Vastlands_Guidebook/Vastlands_Guidebook.md` | `RC Ch. 9` p.117-121 |
| Weapon mastery and unarmed escalation | Round/Scene | `B04`, `M01` | Companion -> Master | Weapon proficiency tiers, special effects, unarmed procedures | `Vastlands_Guidebook/Vastlands_Guidebook.md`<br>`Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_08_Formations_and_Mass_Combat.md` | `RC Ch. 5` p.75-80; `RC Ch. 8` p.110-114 |
| Siege/infiltration tempo | Watch/Turn | `M02` | Master | Breach pressure, alarm progression, suppression/cooldown, attrition | `Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md` | `RC Ch. 8` p.115; `RC Ch. 9` p.122-126; `RC Ch. 4` p.72-74 |
| Epic system-counterplay and permission economies | Campaign/Arc | `M03`, `I02` | Master -> Immortal | Key/lock mechanics, access gating, anti-system control surfaces | `Synthetic_Dream_Machine_04_Powers_Index.md`<br>`Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md`<br>`Our_Golden_Age/Our_Golden_Age.md` | `RC Ch. 13` p.143, p.148; `RC Ch. 15` p.219 |
| Counter-magic and denial procedures | Action/Scene | `M03` | Master | Anti-magic zones, dispel/cancel interactions, suppression reliability | `Synthetic_Dream_Machine_04_Powers_Index.md`<br>`Vastlands_Guidebook/Vastlands_Guidebook.md` | `RC Ch. 13` p.143; `RC Ch. 18` p.264 |
| Spell/item/artifact research and invention loop | Week/Arc | `M03`, `I03` | Expert -> Immortal | Research cadence, cost/risk gates, prototypes, canonization | `Vastlands_Guidebook/Vastlands_Guidebook.md`<br>`Flying_Triremes_and_Laser_Swords/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md`<br>`Our_Golden_Age/Our_Golden_Age.md` | `RC Ch. 16` p.249-255 |
| Cosmology-as-gameboard and endgame continuity | Campaign/Meta-campaign | `I01`, `I03` | Immortal | World-state shocks, era transitions, long-horizon continuity tools | `Synthetic_Dream_Machine_06_Campaign_Regions.md`<br>`Our_Golden_Age/Our_Golden_Age.md` | `RC Ch. 18` p.263-265; `RC Ch. 15` p.219-222 |
| Immortal rank progression and home-plane development | Campaign/Meta-campaign | `I01`, `I03` | Immortal | Rank advancement milestones, home-plane growth effects, post-mortal continuity | `Synthetic_Dream_Machine_06_Campaign_Regions.md`<br>`Our_Golden_Age/Our_Golden_Age.md` | `RC Ch. 10` p.129; `RC Ch. 15` p.222 |
| XP investment and growth-through-play | Week/Campaign | `I03` | Basic -> Immortal | Advancement currencies and alternative growth channels | `Synthetic_Dream_Machine_01_Quickstart.md`<br>`Vastlands_Guidebook/Vastlands_Guidebook.md` | `RC Ch. 10` p.127-129; `RC Ch. 16` p.255 |

Rules Cyclopedia source anchor: `_becmi/TSR 1071 - The D&D Rules Cyclopedia.pdf`.

## Consolidated Quality Confidence Table (Live)

| ID | Ladder Tier | Principle (Short) | Quality Confidence | Rubric Band | Pass Status | Immediate Patch Focus |
|---|---|---|---|---|---|---|
| `B01` | Basic | Core action resolution and TNs | `0.86` | Canon-ready | Complete | Add canonical resolution hierarchy + exceptions index. |
| `B02` | Basic | Resource pressure | `0.86` | Canon-ready | Complete | Complete loot/transport/liquidation chain and attrition spine. |
| `B03` | Basic | Encounter pacing/pressure | `0.88` | Canon-ready | Complete | Canonical week <-> watch/turn cadence switchboard. |
| `B04` | Basic | Morale/reaction/chase | `0.85` | Canon-ready | Complete | Canonize chase model and add reaction->morale->chase handoff panel. |
| `B05` | Basic | Scale handoff | `0.74` | Strong | Complete | Add explicit `Week <-> Watch <-> Turn <-> Round` switch matrix. |
| `E01` | Expert | Wilderness primary loop | `0.82` | Canon-ready | Complete | Add one canonical `Wilderness Week Procedure` with strict order + optional overlays. |
| `E02` | Expert | Discovery generation/mapping | `0.78` | Strong | Complete | Add canonical discovery record template + lost/recovery fallback procedure. |
| `E03` | Expert | Camp/destination action economy | `0.84` | Canon-ready | Complete | Canonize destination/camp action economy and ticket-dice compatibility mapping. |
| `E04` | Expert | Time as content | `0.80` | Strong | Complete | Add SDM time-kernel + unified delay/attrition stack across scales. |
| `C01` | Companion | Domain economy and risk | `0.84` | Canon-ready | Complete | Canonical `Nexus/Domain Turn` cadence for week/season/year + domain archetypes. |
| `C02` | Companion | Domain pressure events | `0.88` | Canon-ready | Complete | Add INTR-to-domain-impact mapping and recovery actions by severity tier. |
| `C03` | Companion | Agent/retainer administration | `0.72` | Strong | Complete | Unified role/wage/reliability/delegated-resolution block. |
| `C04` | Companion | Faction campaign board | `0.85` | Canon-ready | Complete | Explicit `Nexus Grid Update Turn` checklist + node conflict weighting defaults. |
| `M01` | Master | Mass conflict abstraction | `0.76` | Strong | Complete | Promote FTLS `08` mass-conflict core into SDM canonical war-layer chapter + finalize ship/fleet procedures. |
| `M02` | Master | Siege logic and tempo | `0.70` | Strong | Complete | Author single watch-based `Siege-as-Dungeon` procedure with breach assets and escalation defaults. |
| `M03` | Master | Epic counter-systems | `0.79` | Strong | Complete | Add canonical counter-systems doctrine + stacked counter resolution order. |
| `I01` | Immortal | Cosmology as gameboard | `0.82` | Canon-ready | Complete | Add canonical `Cosmology Board Turn` + `Cosmic Lever Register`. |
| `I02` | Immortal | Sphere-like factional physics | `0.68` | Strong | Complete | Define SDM+ `Sphere Equivalents` schema + portfolio conflict compatibility matrix. |
| `I03` | Immortal | Endgame continuity | `0.81` | Canon-ready | Complete | Add explicit endgame continuity protocol + post-Jubilee new-cycle procedure. |

## Dedicated Loot & Treasure Pass Snapshot (`LT01`-`LT06`)

Source: `_todo/TODO_Loot_Treasure_Conversion.md`.

| ID | Principle | Quality Confidence | Rubric Band | Status |
|---|---|---|---|---|
| `LT01` | Treasure discovery/generation | `0.79` | Strong | Calibrated draft |
| `LT02` | Hoard composition/risk coupling | `0.78` | Strong | Calibrated draft |
| `LT03` | Transport burden/extraction throughput | `0.86` | Canon-ready | Baseline complete |
| `LT04` | Liquidation/fencing/time friction | `0.79` | Strong | Baseline complete |
| `LT05` | XP coupling + anti-exploit | `0.73` | Strong | Baseline complete |
| `LT06` | Campaign effects from treasure flow | `0.63` | Strong | Baseline complete |

## Next-Step Notes
- Completed quality-confidence passes: `B01`-`B05`, `E01`-`E04`, `C01`-`C04`, `M01`-`M03`, `I01`-`I03`.
- Dedicated loot/treasure pass executed and calibrated (`LT01`-`LT06`); SDM canonical chapter created as `Synthetic_Dream_Machine_05_Gear_Index.md#sdm-loot-and-treasure`, with FTLS 09 as BECMI spiritual-successor overlay.
- Highest-priority open Basic gaps from completed passes: `B05` scale-handoff matrix, `B02` loot/transport/liquidation chain, and `B04` chase-model canonicalization.
- Highest-priority open Expert gaps from completed passes: `E02` discovery record standardization, `E04` unified time kernel, and `E01` canonical wilderness-week page.
- Highest-priority open Companion gaps from completed passes: `C03` agent reliability/delegation canonicalization, `C01` unified domain cadence, and `C04` deterministic nexus-update sequence.
- Highest-priority open Master gaps from completed passes: canonical war-layer synthesis (`M01`), unified siege procedure (`M02`), and a scale-indexed counter-systems doctrine (`M03`).
- Highest-priority open Immortal gaps from completed passes: canonical cosmology-board turn (`I01`), sphere-equivalent normalization (`I02`), and post-Jubilee carryover rules (`I03`).
- Next scoring sequence: complete; move to remediation/spec pass on lowest-confidence principles (`I02`, `M02`, `C03`, `B05`).
- Endgame leverage after Immortal: bind `I03` carryover rules to `C04` Nexus updates so new cycles start with actionable fronts.

### Immediate Draft Targets
1. `Nexus Turn` skeleton (monthly/seasonal/annual cycle) tied to INTR + event triggers.
2. `Siege-as-Dungeon` watch procedure (breach/counter-breach/supply/morale/time).
3. `Sphere Equivalents` + Immortal continuity page (physics packages + board actions).
4. `SDM06 <-> FTLS09` final normalization pass (LT02 tie-break ordering + LT01 variance tuning) -> `_todo/TODO_Loot_Treasure_Conversion.md`.

## Extraction Queue from `_becmi/`
- `_becmi/TSR 1011B - Set 1 Basic Rules.pdf`
- `_becmi/TSR 1012B - Set 2 Expert Rules.pdf`
- `_becmi/TSR 1013 - Set 3 Companion Set.pdf`
- `_becmi/TSR 1021 - Set 4 Master Rules.pdf`
- `_becmi/TSR 1017 - Set 5 Immortals Rules.pdf`
- `_becmi/TSR 1071 - The D&D Rules Cyclopedia.pdf`

## TODO Checklist
- [ ] Add explicit BECMI procedure excerpts (short paraphrase + page refs) under each crosswalk ID.
- [x] Walk the BECMI set TOCs and add missing core procedures/principles to the survey tables.
- [x] Add Rules Cyclopedia (`TSR 1071`) conversion references for each procedure/principle row.
- [x] Replace legacy planning snapshot with quality-confidence scores, one principle at a time.
- [x] Complete quality-confidence deep dive for `B01` (core action resolution and TN semantics).
- [x] Complete quality-confidence deep dive for `B02` (resource pressure loop).
- [x] Complete quality-confidence deep dive for `B03` (encounter pacing and pressure clocks).
- [x] Complete quality-confidence deep dive for `B04` (morale/reaction/chase loop).
- [x] Complete quality-confidence deep dive for `B05` (scale handoff loop).
- [x] Add `Target Score` and `Delta` columns to the crosswalk after first extraction pass.
- [x] Complete Pass 1 (`TSR 1011B` Basic) evidence + confidence scoring for `B01`-`B05`.
- [x] Complete Pass 2 (`TSR 1012B` Expert) evidence + confidence scoring for `E01`-`E04`.
- [x] Complete Pass 3 (`TSR 1013` Companion) evidence + confidence scoring for `C01`-`C04`.
- [x] Complete Pass 4 (`TSR 1021` Master) evidence + confidence scoring for `M01`-`M03`.
- [x] Complete Pass 5 (`TSR 1017` Immortals) evidence + confidence scoring for `I01`-`I03`.
- [x] Create dedicated loot/treasure conversion planning document: `_todo/TODO_Loot_Treasure_Conversion.md`.
- [x] Start dedicated `Loot & Treasure` conversion implementation pass (`LT01-LT06` baseline + FTLS 09 draft procedures).
- [x] Execute dedicated `Loot & Treasure` conversion pass (treasure types/hoards, transport burden, liquidation, and XP/economy coupling).
- [x] Integrate dedicated loot/treasure pass results back into this master BECMI conversion report.
- [x] Create SDM-numbered canonical treasure chapter from existing SDM+/UVG/VLG/RSS procedures: `Synthetic_Dream_Machine_05_Gear_Index.md#sdm-loot-and-treasure`.
- [x] Set FTLS chapter 09 as BECMI spiritual-successor layer grounded on SDM canonical treasure chapter.
- [ ] Draft `Nexus Turn` skeleton (monthly/seasonal) linked to INTR + Events tables.
- [ ] Draft `Siege-as-Dungeon` procedure in FTLS format (watch-based).
- [ ] Draft `Immortal/Spheres in SDM+` reference page (factional physics + world-process play).
