# TODO: Loot & Treasure Conversion (Stabilized Plan)

## Intent
Build a stable loot/treasure conversion layer on top of the consolidated SDM base:
- Core mechanics source: `Synthetic_Dream_Machine_01_Quickstart.md`
- Gear/equipment catalogs source: `Synthetic_Dream_Machine_05_Gear_Index.md`

This TODO defines acceptance criteria, implementation sequence, and validation gates for loot/treasure conversion work.

## Canonical Inputs (Locked)
- Core mechanics and procedure cadence: `Synthetic_Dream_Machine_01_Quickstart.md`
- Gear/items/vehicles tables and trade-goods catalogs: `Synthetic_Dream_Machine_05_Gear_Index.md`
- Conversion context and overlays: BECMI/RC material as optional overlays, not base assumptions.

## Acceptance Criteria

### A. Procedure Integrity
- Loot loop is explicit and runnable end-to-end:
  - discovery -> valuation -> bulk/carry pressure -> transport risk -> liquidation.
- Market/liquidation procedures reference Quickstart caravan/trade canon (no conflicting duplicate procedure blocks).
- Item-category handling routes to Gear tables where relevant.

### B. Unit and Economy Consistency
- Value and carry units are consistent with Quickstart/Gear canonical units.
- Conversion assumptions are explicit when RC/BECMI overlays are enabled.
- No mixed-scale ambiguity in cash/value examples.

### C. Scope Boundaries
- Tax/domain governance mechanics are excluded from loot conversion baseline.
- Magic-item generation remains in Chapter 05 magitech lane; loot chapter uses handoff references.
- Core system rules are not redefined in loot docs.

### D. Navigation and Link Health
- All loot conversion references to Quickstart/Gear anchors resolve.
- No stale links to retired anchors/superseded chapter names.

### E. Playtest Readiness
- At least one runnable example each for:
  - lightweight haul,
  - high-bulk haul,
  - difficult liquidation.
- Referee can run loop without consulting external TODO text.

## Implementation Plan
1. Baseline alignment pass
- map each loot rule block to Quickstart/Gear canonical anchors.
- remove/replace conflicting duplicates with pointer references.

2. Conversion overlay pass
- reintroduce optional RC/BECMI overlays only where they add value and do not conflict with canonical base.
- mark each overlay as optional and independent.

3. Calibration pass
- validate value pressure and carry pressure with short scenario runs.
- adjust only overlay knobs; do not drift canonical base rules.

4. Finalization
- acceptance checklist sign-off.
- lock baseline and move future changes to explicit enhancement queue.

## Validation Checklist
- [ ] End-to-end loot loop is present and internally consistent.
- [ ] Every procedure reference points to canonical Quickstart/Gear anchors.
- [ ] No tax/domain baseline mechanics in loot conversion.
- [ ] No duplicate core mechanics copied from Quickstart.
- [ ] Example scenarios run cleanly with no missing rule step.

## Out of Scope
- Full domain play economics.
- Replacing canonical OGA/VLG/UVG mechanics with new synthetic systems.
- Broad rebalancing outside explicit overlay parameters.
