# TODO: BECMI -> SDM+ Conversion Master

## Intent
Track BECMI/RC conversion work as optional overlays on top of the consolidated SDM base model.

Base model (locked):
- Core rules: `Synthetic_Dream_Machine_01_Quickstart.md`
- Gear/item/vehicle catalogs: `Synthetic_Dream_Machine_05_Gear_Index.md`

## Conversion Policy
- BECMI/RC procedures are compatibility overlays, not replacements for canonical SDM baseline.
- Any overlay must declare:
  - what baseline step it modifies,
  - whether it is optional,
  - how to disable it cleanly.

## Conversion Goals
1. Preserve recognizable BECMI/RC procedure identity where it improves play clarity.
2. Express converted procedures in SDM-native units, cadence, and chapter anchors.
3. Keep SDM baseline stable while allowing optional compatibility overlays.
4. Maintain runnable table-facing loops, not only conceptual crosswalk notes.
5. Minimize adjudication drift across sessions and referees.

## Conversion Standards
- Canon first:
  - Quickstart/Gear canon is the baseline; overlays must not redefine core rules.
- Procedure shape preservation:
  - Keep trigger -> procedure -> output -> consequence structure explicit.
- Unit consistency:
  - Use canonical SDM value/carry units unless an overlay explicitly states a conversion mode.
- Reversibility:
  - Every overlay can be disabled without breaking baseline procedures.
- Traceability:
  - Each conversion note should reference its canonical SDM destination anchor.

## Alignment Constants (Locked)
- Character level scaling: `2` BECMI character levels = `1` SDM character Level.
- Spell-to-power scaling: `Spell Level x2 = SDM Power Level`; cantrips map to `Power Level 1`.

## Other Pass

## Active Linked TODOs
- Loot/Treasure stabilized plan:
  - `_todo/TODO_Loot_Treasure_Conversion.md`
- Magitech Chapter 05 alignment:
  - `_todo/TODO_Magitech_Fantascience_Chapter05.md`
- SDM consolidation master:
  - `_todo/TODO_SDM_Gear_Index_Master.md`

## Active Queue
1. Re-validate overlay assumptions against current Quickstart/Gear canon.
2. Keep overlay docs free of core-rules duplication.
3. Maintain short crosswalk notes from RC terms to SDM anchors.

## Activities Checklist
- [ ] Build/refresh BECMI -> SDM crosswalk index by subsystem (`B/E/C/M/I` lanes).
- [ ] Add short procedure excerpts (paraphrase + source refs) for each active overlay lane.
- [ ] Draft `Siege-as-Dungeon` procedure in FTLS format (watch-based).
- [ ] Draft `Immortal/Spheres in SDM+` reference page (factional physics + world-process play).
- [ ] Reconcile `I03` carryover rules with `C04` nexus update procedure.
- [ ] Validate each overlay against current Quickstart/Gear anchors.
- [ ] Mark each overlay as optional/default-off/default-on explicitly.
- [ ] Add disable-path note for each overlay (how to revert to pure SDM baseline).
- [ ] Run at least one table-walkthrough per overlay family (discovery, combat, economy, progression).
- [ ] Record identified drift/ambiguity points and patch target TODOs.
- [ ] Sync accepted overlay decisions into linked TODOs (`Loot`, `Magitech`, `SDM consolidation master`).

## Future TODO Passes

### F1: Magic Items -> Magitech and Fantascience
- [ ] Build family-by-family crosswalk (`RC/BECMI magic item families` -> `SDM magitech/fantascience lanes`).
- [ ] Keep procedure conversion separate from terminology conversion (mechanics first, naming pass second).
- [ ] Route converted generation flow to Chapter 05 canonical anchors.
- [ ] Define compatibility tags for legacy behaviors where direct SDM mappings are partial.
- [ ] Validate loot handoff integrity (`treasure yield -> item generation -> use/constraints`).
- [ ] Add acceptance test set:
  - permanent item path,
  - consumable/charged item path,
  - cursed/complication-bearing item path.

### F2: Spells -> Powers
- [ ] Build spell-pattern crosswalk into SDM Powers taxonomy.
- [ ] Apply locked scaling constants (`Spell Level x2 = SDM Power Level`; cantrip floor).
- [ ] Define conversion rules for range/duration/targeting in SDM procedure language.
- [ ] Define fallback policy for unmatched spells (`direct map`, `partial map`, `custom power required`).
- [ ] Route outputs to canonical powers destinations and quick-reference anchors.
- [ ] Add validation scenario set:
  - direct attack/control,
  - utility/exploration,
  - summon/transform/exception cases.
  

### Other Passes
- `C03` Agent/retainer reliability + delegation canonicalization.
- `B05` Unified zoom handoff matrix (round/turn/watch/week/month).
- `I02` Sphere-like factional physics normalization.
- `M02` Siege logic canonicalization.

## Future Pass Standards
- Future passes must not redefine Quickstart core mechanics.
- Future passes must preserve optional-overlay toggles and disable paths.
- Future pass outputs must include explicit canonical SDM anchor references.

## Done Criteria
- Overlay work references canonical SDM anchors, not legacy chapter structures.
- Overlay toggles are explicit and local (no global ambiguity).
- Loot/magic-item overlays remain compatible with consolidated Quickstart+Gear model.
