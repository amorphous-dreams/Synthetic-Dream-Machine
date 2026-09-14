/**
 * nexus-island-climb — the migration SOURCES a climb reads, derived from the resolver's own ordering.
 *
 * `nexusScopeMoved` names the debt: connecting MOVES every per-Nexus board and nothing carries across.
 * One of the boards it moves is the one the Binding Gate walks, and that gate refuses the boot rather
 * than degrading — so a vessel that seats a charter a week after founding never boots again.
 *
 * Carrying a chain up the gradient needs to know WHICH lower island to read it off. A hand-written list
 * of "the own-key board, and maybe the anchor" is the enumeration a later term escapes silently, so
 * `nexusIslandsBelow` re-runs the resolver with each higher term WITHHELD and reads the lower islands
 * back out of it. The ordering stays stated once, in `nexusIdentity`.
 *
 * THE LAW UNDER TEST — the gradient ratchets on INTENT. The sources run CLIMB-ONLY: a vessel standing at
 * a SHARED island reads its own private board as a source, and a vessel standing at its OWN island reads
 * NOTHING. A bidirectional carry would let a vanished charter — a failure, never an act — walk a serving
 * vessel back onto its private board and call the boot a success.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/nexus-identity
 */
import { describe, test, expect } from "vitest";
import { nexusIdentity, nexusIslandsBelow, nexusScopeOrThrow } from "../src/nexus-identity.js";

const OWN     = "a".repeat(64);
const ANCHOR  = "b".repeat(64);
const GENESIS = `epoch0-${"c".repeat(64)}`;
const OTHER   = `epoch0-${"d".repeat(64)}`;

describe("nexusIslandsBelow — the climb's migration sources", () => {
  test("a CHARTER island reads the anchor it dialled, then its own key — high to low", () => {
    const at = { genesisEpochCid: GENESIS, charterStands: true, anchorGateKey: ANCHOR, ownVesselKey: OWN };
    expect(nexusIdentity(at).kind).toBe("charter");
    // The order matters: the chain rode the most recent lower island, so that one gets asked first.
    expect(nexusIslandsBelow(at)).toEqual([ANCHOR, OWN]);
  });

  test("a CHARTER island with no anchor reads its own key alone — the ordinary found-then-connect walk", () => {
    const at = { genesisEpochCid: GENESIS, charterStands: true, ownVesselKey: OWN };
    expect(nexusIslandsBelow(at)).toEqual([OWN]);
  });

  test("an ANCHOR island reads its own key — a leaf that dialled after standing alone", () => {
    const at = { anchorGateKey: ANCHOR, ownVesselKey: OWN };
    expect(nexusIdentity(at).kind).toBe("anchor");
    expect(nexusIslandsBelow(at)).toEqual([OWN]);
  });

  test("an EXPLICIT island reads charter, anchor and own beneath it", () => {
    const at = { explicitScope: OTHER, genesisEpochCid: GENESIS, charterStands: true,
                 anchorGateKey: ANCHOR, ownVesselKey: OWN };
    expect(nexusIslandsBelow(at)).toEqual([GENESIS, ANCHOR, OWN]);
  });

  // ── THE GRADIENT LAW: climb-only ──────────────────────────────────────────────────────────────
  test("an OWN island reads NOTHING below it — a vessel never descends by a carry", () => {
    const at = { ownVesselKey: OWN };
    expect(nexusIdentity(at).kind).toBe("own");
    expect(nexusIslandsBelow(at)).toEqual([]);
  });

  test("a TORN standing reads NOTHING — it names no island, so nothing may be carried onto one", () => {
    const at = { genesisEpochCid: "not-an-epoch", charterStands: true, ownVesselKey: OWN };
    expect(nexusIdentity(at).kind).toBe("torn");
    expect(() => nexusScopeOrThrow(nexusIdentity(at))).toThrow(/torn/i);
    expect(nexusIslandsBelow(at)).toEqual([]);
  });

  test("a charter that STANDS and reads nothing at all is TORN, not a descent — the unreadable-charter cure", () => {
    // `charterStands` reports PRESENCE apart from READABILITY: a half-written seat carries no genesis.
    const at = { charterStands: true, ownVesselKey: OWN };
    expect(nexusIdentity(at).kind).toBe("torn");
    expect(nexusIslandsBelow(at)).toEqual([]);
  });

  test("the current island never appears among its own sources", () => {
    for (const at of [
      { genesisEpochCid: GENESIS, charterStands: true, anchorGateKey: ANCHOR, ownVesselKey: OWN },
      { anchorGateKey: ANCHOR, ownVesselKey: OWN },
      { explicitScope: OTHER, genesisEpochCid: GENESIS, charterStands: true, ownVesselKey: OWN },
    ]) {
      const here = nexusIdentity(at);
      expect(here.kind).not.toBe("torn");
      expect(nexusIslandsBelow(at)).not.toContain((here as { scope: string }).scope);
    }
  });

  test("a vessel whose anchor key IS its own key names one source, never two", () => {
    // The anchor and own readings collapse to one island; the source list carries it once.
    const at = { genesisEpochCid: GENESIS, charterStands: true, anchorGateKey: OWN, ownVesselKey: OWN };
    expect(nexusIslandsBelow(at)).toEqual([OWN]);
  });
});
