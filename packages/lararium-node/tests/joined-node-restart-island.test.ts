/**
 * A JOINED NODE'S ISLAND RESTS APART FROM ITS DIAL: a restart reads the board its landing seeded.
 *
 * `fleet join land` seats the joinee's persona-KEL chain on `admittedJoineeIsland(payload)` and the boot resolves
 * `nodeNexusIsland` off the bootstrap. The two agree only where the bootstrap keeps what the payload carried. The island
 * rode INSIDE the dial pin, and an answer that names no sync url (`"syncUrl": null`, a hearth that printed no `--sync-url`)
 * packed no pin at all: the landing seeded the charter's board, and every later boot read the vessel's own.
 *
 *   NR1  RED      a charter answer with no sync url: the restart reads the island the landing seeded.
 *   NR2  RED      an anchor answer with no sync url: the restart reads the gate key's island, as the landing did.
 *   NR3  RED      a root holder that stood no gate, under a charter: the restart reads the charter's island.
 *   NR4  CONTROL  an answer that names its dial reads as it did, island and dial both.
 *   NR5  CONTROL  a vessel that founded its own face holds no island pin and stands on its own key.
 *   NR6  CONTROL  fail-closed stays: a torn island half names no island and no dial.
 */
import { describe, expect, test } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HEARTH_ISLAND_KIND_TIDDLER, hearthDialTiddlers, readHearthDialPin, readHearthIslandPin } from "../src/hearth-dial-pin.js";
import { admittedJoineeIsland, nodeNexusIsland } from "../src/nexus-standing.js";

const JOINEE  = "a1".repeat(32);
const GATE    = "cd".repeat(32);
const CHARTER = `nexus-${"e7".repeat(32)}`;

/** A joinee's home: a bootstrap holding `tiddlers`, and a seal home that seats no charter of its own. */
function joineeHome(tiddlers: Record<string, unknown>): { bootstrapPath: string; sealHome: string } {
  const dir = mkdtempSync(join(tmpdir(), "lares-joined-restart-"));
  const bootstrapPath = join(dir, "social-bootstrap.json");
  writeFileSync(bootstrapPath, JSON.stringify({ title: "$:/plugins/lares/bootstrap", text: JSON.stringify({ tiddlers }) }));
  return { bootstrapPath, sealHome: join(dir, "seal") };
}
/** The island a restart resolves over what the landing packed. */
const restartIsland = (tiddlers: Record<string, unknown>): string => nodeNexusIsland({ ownVesselKey: JOINEE, ...joineeHome(tiddlers) });

describe("a joined node's island rests apart from its dial", () => {
  test("NR1 RED a charter answer with no sync url: the restart reads the island the landing seeded", () => {
    const landing = admittedJoineeIsland({ hearthGatePubKey: GATE, hearthIslandKind: "charter", hearthIslandScope: CHARTER, ownVesselKey: JOINEE });
    expect(landing).toBe(CHARTER);
    expect(restartIsland(hearthDialTiddlers(null, GATE, { kind: "charter", scope: CHARTER }))).toBe(landing);
  });

  test("NR2 RED an anchor answer with no sync url: the restart reads the gate key's island", () => {
    const landing = admittedJoineeIsland({ hearthGatePubKey: GATE, hearthIslandKind: "anchor", hearthIslandScope: GATE, ownVesselKey: JOINEE });
    expect(landing).toBe(GATE);
    expect(restartIsland(hearthDialTiddlers(null, GATE, { kind: "anchor", scope: GATE }))).toBe(landing);
  });

  test("NR3 RED a root holder that stood no gate, under a charter: the restart reads the charter's island", () => {
    const landing = admittedJoineeIsland({ hearthGatePubKey: null, hearthIslandKind: "charter", hearthIslandScope: CHARTER, ownVesselKey: JOINEE });
    expect(landing).toBe(CHARTER);
    expect(restartIsland(hearthDialTiddlers(null, null, { kind: "charter", scope: CHARTER }))).toBe(landing);
  });

  test("NR4 CONTROL an answer that names its dial reads as it did, island and dial both", () => {
    const packed = hearthDialTiddlers("wss://hearth.example/ws", GATE, { kind: "charter", scope: CHARTER });
    const home = joineeHome(packed);
    expect(readHearthDialPin(home.bootstrapPath)).toEqual({ syncUrl: "wss://hearth.example/ws", gatePubKey: GATE, islandKind: "charter", islandScope: CHARTER });
    expect(nodeNexusIsland({ ownVesselKey: JOINEE, ...home })).toBe(CHARTER);
    // No sync url names no dial: the island rests, and nothing dials.
    const undialled = joineeHome(hearthDialTiddlers(null, GATE, { kind: "charter", scope: CHARTER }));
    expect(readHearthDialPin(undialled.bootstrapPath), "an answer with no sync url pins no dial").toBeNull();
    expect(readHearthIslandPin(undialled.bootstrapPath)).toEqual({ gatePubKey: GATE, islandKind: "charter", islandScope: CHARTER });
  });

  test("NR5 CONTROL a vessel that founded its own face holds no island pin and stands on its own key", () => {
    expect(hearthDialTiddlers(null, null)).toEqual({});
    const home = joineeHome({});
    expect(readHearthIslandPin(home.bootstrapPath)).toBeNull();
    expect(nodeNexusIsland({ ownVesselKey: JOINEE, ...home })).toBe(JOINEE);
  });

  test("NR6 CONTROL a torn island half names no island and no dial", () => {
    const torn = { ...hearthDialTiddlers("wss://hearth.example/ws", GATE), [HEARTH_ISLAND_KIND_TIDDLER]: { title: HEARTH_ISLAND_KIND_TIDDLER, text: "charter", kind: "hearth-door" } };
    const home = joineeHome(torn);
    expect(readHearthIslandPin(home.bootstrapPath)).toBeNull();
    expect(readHearthDialPin(home.bootstrapPath)).toBeNull();
  });
});
