/**
 * nexus-standing.test.ts — THE PUBLIC BOARD KEYS ON THE NEXUS, NEVER ON THE VESSEL.
 *
 * The measured story the red names: an operator marks a bag PUBLIC on their laptop and their always-on Herm
 * never serves it. The laptop announced onto `crossroadsDocUrl(laptop.vesselKey)`; the Herm folded
 * `crossroadsDocUrl(herm.vesselKey)` and read `0 PUBLIC book(s)`. Two vessels in ONE Nexus, TWO disjoint
 * boards, and no error anywhere — on a lone vessel the two keys coincide, so the defect hides in a fleet of
 * one and stands structural in a confederation.
 *
 * The cure derives every per-Nexus board from `nexusIdentity` — the island's own name, which belongs to no
 * vessel. This file holds the BOARD-side law; `nexus-identity.test.ts` holds the scope-side ranking.
 *
 * ── THE OPERATOR'S NULL RULING (2026-09-13), enacted here as three states, not two ───────────────
 *   ① NO nexus → the vessel's own key, read as a PRIVATE NEXUS OF ONE. A stated fact, not a fallback:
 *     standing a hearth up and connecting it later is a first-class flow, so this is stage one of an
 *     ordinary lifecycle. It serves nobody and nobody reads its board, which stays coherent.
 *   ② nexus READABLE → the nexus-keyed board.
 *   ③ nexus KNOWN and UNREADABLE (partition · torn charter · sync gap) → NO scope, and the caller REFUSES.
 *     Collapsing ③ into ① inverts it: a vessel that WAS serving a realm's public books would silently
 *     start serving its own private board, believing it published while its peers watched it vanish.
 *     "No nexus" STATES a fact; "nexus unreadable" LOSES one — the null-as-default inversion exactly, and
 *     `hearths.mem` #/crossings already records this tree being bitten by this very reader (//the torn
 *     charter//: `readNexusDoc` answers null for both, and a re-seat re-genesised a rotated chain).
 *
 * THE GRADIENT RATCHETS ON INTENT: a vessel CLIMBS it by an act and never DESCENDS it by a failure.
 */
import { describe, test, expect } from "vitest";
import { nexusIdentity, nexusScopeOrThrow, nexusScopeMoved } from "../src/nexus-identity.js";
import { crossroadsDocUrl, whoBoardDocUrl, personaKelBoardDocUrl, kapaeAntigenDocUrl } from "../src/deterministic-doc.js";

const GENESIS = `epoch0-${"9e".repeat(32)}`;     // ONE charter, held alike by every member
const OTHER   = `epoch0-${"1d".repeat(32)}`;     // a DIFFERENT Nexus
const LAPTOP  = "bb".repeat(32);                 // the keeping hearth's own vessel key
const HERM    = "cc".repeat(32);                 // the always-on carrier's own vessel key
const ANCHOR  = "aa".repeat(32);                 // a hearth's gate key, as a leaf passes it back

const boardsFor = (scope: string): readonly string[] => [
  crossroadsDocUrl(scope), whoBoardDocUrl(scope), personaKelBoardDocUrl(scope), kapaeAntigenDocUrl(scope),
];

describe("★ two vessels sharing one Nexus resolve the SAME public boards ★", () => {
  test("a keeping hearth and its Herm, holding ONE charter, compute ONE crossroads board", () => {
    const laptop = nexusIdentity({ genesisEpochCid: GENESIS, charterStands: true, ownVesselKey: LAPTOP });
    const herm   = nexusIdentity({ genesisEpochCid: GENESIS, charterStands: true, ownVesselKey: HERM });
    expect(laptop.kind).toBe("charter");
    expect(herm.kind).toBe("charter");
    // THE MEASURED FAILURE, inverted: the announce and the fold now name ONE address.
    expect(crossroadsDocUrl(nexusScopeOrThrow(herm))).toBe(crossroadsDocUrl(nexusScopeOrThrow(laptop)));
  });

  test("EVERY per-Nexus board meets, not the crossroads alone — the grain error stood in five places at once", () => {
    const laptop = nexusScopeOrThrow(nexusIdentity({ genesisEpochCid: GENESIS, charterStands: true, ownVesselKey: LAPTOP }));
    const herm   = nexusScopeOrThrow(nexusIdentity({ genesisEpochCid: GENESIS, charterStands: true, ownVesselKey: HERM }));
    expect(boardsFor(herm)).toEqual(boardsFor(laptop));
  });

  test("the board names NO vessel — neither member's key appears in the address either derives", () => {
    const scope = nexusScopeOrThrow(nexusIdentity({ genesisEpochCid: GENESIS, charterStands: true, ownVesselKey: LAPTOP }));
    expect(scope).not.toContain(LAPTOP);
    expect(scope).not.toContain(HERM);
    expect(scope).toBe(GENESIS);
  });

  test("a leaf that dials the hearth lands on the hearth's board — the anchor route reaches the same law", () => {
    const leaf = nexusIdentity({ anchorGateKey: ANCHOR, anchorStands: true, ownVesselKey: LAPTOP });
    expect(nexusScopeOrThrow(leaf)).toBe(ANCHOR);
    const hearth = nexusIdentity({ ownVesselKey: ANCHOR });   // the hearth alone, its own key naming its island
    expect(boardsFor(nexusScopeOrThrow(leaf))).toEqual(boardsFor(nexusScopeOrThrow(hearth)));
  });
});

describe("CONTROL — the separation the cure must not dissolve", () => {
  test("two vessels under DIFFERENT Nexuses resolve DIFFERENT boards", () => {
    const mine   = nexusScopeOrThrow(nexusIdentity({ genesisEpochCid: GENESIS, charterStands: true, ownVesselKey: LAPTOP }));
    const theirs = nexusScopeOrThrow(nexusIdentity({ genesisEpochCid: OTHER,   charterStands: true, ownVesselKey: HERM }));
    expect(theirs).not.toBe(mine);
    boardsFor(mine).forEach((url, i) => expect(boardsFor(theirs)[i]).not.toBe(url));
  });

  test("two vessels each standing in NO Nexus keep their OWN separate boards — a private nexus of one shards per vessel", () => {
    const a = nexusScopeOrThrow(nexusIdentity({ ownVesselKey: LAPTOP }));
    const b = nexusScopeOrThrow(nexusIdentity({ ownVesselKey: HERM }));
    expect(crossroadsDocUrl(b)).not.toBe(crossroadsDocUrl(a));
  });
});

describe("THE NULL RULING — three states, and ① and ③ must DIFFER", () => {
  test("① NO nexus STATES a fact: a private nexus of one, keyed on its own vessel key", () => {
    const s = nexusIdentity({ ownVesselKey: LAPTOP });
    expect(s.kind).toBe("own");
    expect(nexusScopeOrThrow(s)).toBe(LAPTOP);
    expect(s.shared).toBe(false);
    expect(s.reading).toMatch(/private nexus of one/i);
    // and it reads as a LIFECYCLE STAGE, never as a failure — connecting later is a first-class flow
    expect(s.reading).toMatch(/nothing failed|first-class|stage one/i);
  });

  test("③ a charter that STANDS and reads unreadable LOSES a fact — it names NO scope", () => {
    // The `hearths.mem` #/crossings shape: the record is present on disk, the reader answers nothing.
    const s = nexusIdentity({ genesisEpochCid: null, charterStands: true, ownVesselKey: LAPTOP });
    expect(s.kind).toBe("torn");
    expect(s.scope).toBeUndefined();
  });

  test("③ a MALFORMED genesis is torn too — garbage names no island, and a board keyed by it mints clean and empty", () => {
    for (const bad of ["nope", "epoch0-", "9e".repeat(12), `${GENESIS}ff`, "EPOCH1-" + "9e".repeat(32)]) {
      const s = nexusIdentity({ genesisEpochCid: bad, charterStands: true, ownVesselKey: LAPTOP });
      expect(s.kind, `a malformed genesis ${JSON.stringify(bad)} must not read as a standing`).toBe("torn");
      expect(s.scope).toBeUndefined();
    }
  });

  test("★ ① AND ③ DIFFER — this is the whole ruling, and one assertion holds it ★", () => {
    const noNexus   = nexusIdentity({ ownVesselKey: LAPTOP });
    const unreadable = nexusIdentity({ genesisEpochCid: null, charterStands: true, ownVesselKey: LAPTOP });
    expect(noNexus.kind).not.toBe(unreadable.kind);
    expect(unreadable.scope).not.toBe(noNexus.scope);
  });

  test("③ REFUSES rather than descending — a serving vessel never falls to its own board on an accident", () => {
    const s = nexusIdentity({ genesisEpochCid: "torn", charterStands: true, ownVesselKey: LAPTOP });
    expect(() => nexusScopeOrThrow(s)).toThrow(/torn/i);
    // THE INVERSION, named: the refusal must never quietly hand back the vessel's own key.
    try { nexusScopeOrThrow(s); } catch (e) { expect(String(e)).not.toContain(LAPTOP); }
  });

  test("③ covers the ANCHOR half too — an admission record standing over an unreadable key names no island", () => {
    for (const at of [
      { anchorGateKey: null,     anchorStands: true },
      { anchorGateKey: "",       anchorStands: true },
      { anchorGateKey: "not-hex" },
      { anchorGateKey: "aa" },
    ]) {
      expect(nexusIdentity({ ...at, ownVesselKey: LAPTOP }).kind).toBe("torn");
    }
  });

  test("the scope is case-stable, so one island never reads as two boards", () => {
    const upper = nexusIdentity({ genesisEpochCid: GENESIS.toUpperCase(), charterStands: true, ownVesselKey: LAPTOP });
    expect(nexusScopeOrThrow(upper)).toBe(GENESIS);
  });
});

describe("CONNECTING MOVES THE BOARD — the migration debt, named so no caller reads the resolver as one", () => {
  test("climbing from a private nexus of one to a seated charter RE-KEYS every board", () => {
    const before = nexusIdentity({ ownVesselKey: LAPTOP });
    const after  = nexusIdentity({ genesisEpochCid: GENESIS, charterStands: true, ownVesselKey: LAPTOP });
    expect(nexusScopeMoved(before, after)).toBe(true);
    // Nothing carries across: the old board keeps every announce, the new one mints blank.
    expect(crossroadsDocUrl(nexusScopeOrThrow(after))).not.toBe(crossroadsDocUrl(nexusScopeOrThrow(before)));
  });

  test("a TORN reading is not a move — a partition must never read as a departure", () => {
    const before = nexusIdentity({ genesisEpochCid: GENESIS, charterStands: true, ownVesselKey: LAPTOP });
    const torn   = nexusIdentity({ genesisEpochCid: null,    charterStands: true, ownVesselKey: LAPTOP });
    expect(nexusScopeMoved(before, torn)).toBe(false);
  });
});
