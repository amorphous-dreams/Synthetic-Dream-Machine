/**
 * face-lane — EACH HAT REACHED BY NAME on the daemon island: a store verb from a LIT sibling face's session runs on that
 * face's own lane (its own document, as the lit set resolves it for that face), and its answer names the face; a verb from
 * the mounted face runs as before and names the mounted face; a presenter neither mounted nor lit refuses `face-not-open`;
 * a sibling's container naming anything but its own lane refuses `face-lane-holds-its-own`.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { describe, expect, it } from "vitest";
import { faceLaneReactor, FACE_LANE_VERBS } from "../src/face-lane.js";

const MOUNT = "a".repeat(64), SIB = "b".repeat(64), SHUT = "c".repeat(64);
const LANE = "lar:///ha.ka.ba/bags/daemon-rel-b";
const laneStore = { documentId: "doc-b" };

function rig() {
  const ran: string[] = [];
  const ports = {
    mountedKey: () => MOUNT,
    mountedOrdinal: () => 0,
    lit: (key: string) => (key === SIB ? { handleIndex: 1 } : null),
    target: async (face: number, bag: string) => (face === 1 && bag === LANE ? { store: laneStore as never, owner: 1 } : bag === LANE ? { store: laneStore as never, owner: 2 } : null),
  };
  const reactor = faceLaneReactor("meme-put",
    async () => { ran.push("mounted"); return { decision: "ingest", bag: "lar:///ha.ka.ba/wikis/daemon/working" }; },
    (lane) => async () => { ran.push(`lane:${lane.bag}:${(lane.store as unknown as { documentId: string }).documentId}`); return { decision: "ingest", bag: lane.bag }; },
    ports);
  const ctx = (presenter?: string) => ({ ...(presenter !== undefined ? { presenter } : {}), local: true }) as never;
  return { reactor, ran, ctx };
}

describe("each hat reached by name: the island's per-face lane", () => {
  it("the lane carries the meme verbs", () => {
    expect([...FACE_LANE_VERBS].sort()).toEqual(["meme-delete", "meme-get", "meme-list", "meme-put"]);
  });

  it("LIT SIBLING: its put runs on its own lane (its own document) and the answer names its face", async () => {
    const r = rig();
    const out = await r.reactor({ uri: "lar:///t/x", bag: LANE, text: "t" }, r.ctx(`0x${SIB}`));
    expect(out).toEqual({ decision: "ingest", bag: LANE, face: 1 });
    expect(r.ran).toEqual([`lane:${LANE}:doc-b`]);
  });

  it("MOUNTED: its put runs as before and the answer names the mounted face; no presenter reads as the mount", async () => {
    const r = rig();
    expect(await r.reactor({ uri: "lar:///t/x", recipe: "default", text: "t" }, r.ctx(`0x${MOUNT}`))).toMatchObject({ face: 0 });
    expect(await r.reactor({ uri: "lar:///t/x", recipe: "default", text: "t" }, r.ctx())).toMatchObject({ face: 0 });
    expect(r.ran).toEqual(["mounted", "mounted"]);
  });

  it("SHUT: a presenter neither mounted nor lit refuses face-not-open, and nothing runs", async () => {
    const r = rig();
    await expect(r.reactor({ uri: "lar:///t/x", bag: LANE, text: "t" }, r.ctx(`0x${SHUT}`))).rejects.toMatchObject({ reason: "face-not-open" });
    expect(r.ran).toEqual([]);
  });

  it("ITS OWN LANE ALONE: a sibling naming a recipe, another bag, or a lane another face owns refuses face-lane-holds-its-own", async () => {
    const r = rig();
    for (const args of [{ recipe: "default" }, { bag: "lar:///ha.ka.ba/bags/daemon-rel-a" }, { bag: LANE, realm: "r" }]) {
      await expect(r.reactor({ uri: "lar:///t/x", text: "t", ...args }, r.ctx(`0x${SIB}`)), JSON.stringify(args)).rejects.toMatchObject({ reason: "face-lane-holds-its-own" });
    }
    const other = faceLaneReactor("meme-put", async () => ({}), () => async () => ({}), {
      mountedKey: () => MOUNT, mountedOrdinal: () => 0, lit: () => ({ handleIndex: 1 }),
      target: async () => ({ store: laneStore as never, owner: 2 }),
    });
    await expect(other({ uri: "lar:///t/x", bag: LANE, text: "t" }, r.ctx(`0x${SIB}`))).rejects.toMatchObject({ reason: "face-lane-holds-its-own" });
    expect(r.ran).toEqual([]);
  });
});
