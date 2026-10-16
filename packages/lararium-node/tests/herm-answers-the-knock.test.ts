/**
 * herm-answers-the-knock.test.ts — A HERM ANSWERS THE KNOCK (operator ruling: siege-resilience "A HERM ANSWERS THE KNOCK";
 * stable-founding-road "A herm answers the knock"). A charterless herm answers ANY proven peer that knocked (`ownPlacePosture`):
 * a waystone by class, never a broken lararium. Only a peer handed the gate key can compute the knock path, and a bare
 * route draws no upgrade; that silence is the knock. WHERE a herm stands a gate stays the other half of the lane ("an
 * explicit Nexus opens the herm relay"): only at a Nexus whose quorum counted its `carry`.
 *
 * Proven over a real oracle face on its floor gate, sorting with the vessel's real sorter at the posture a herm reads:
 *   · THE RULING: a proven NON-MEMBER stranger who knocked (a face no Nexus admits, no arm) reads the map, verified;
 *   · a carried next hop presenting its own carriage contract (the place arm) reads the map too;
 *   · a proven PLACE with no arm (a crossroads no quorum carried) reads it: proven is the whole test;
 *   · RED: a stranger without the knock path reaches no socket at all: the bare route draws no upgrade, so no frame;
 *   · RED: a stranger holding the pin of a gate at ANOTHER Nexus knocks on a path this gate never derived: no upgrade, no frame;
 *   · CONTROL: a LARARIUM's gate at a PRIVATE charter meets the same arm-less stranger with silence (the charter decides);
 *   · the one reader: a herm reads OPEN with or without a charter; a lararium reads its charter and fails closed.
 */
import { afterEach, describe, expect, test } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { ORACLE_SOCKET_ROUTE, emptyFoundingCharterDoc, exportOracleSnapshot, type NexusDoc } from "@lararium/mesh";
import { mountHttpFaceDispatcher } from "../src/http-face-dispatcher.js";
import { mountOracleReadFace, type OracleFloorFace } from "../src/oracle-read-face.js";
import { makeGateSorter, ownPlacePosture, type PlaceClass } from "../src/socket-sorter.js";
import { floorGates, place, presenter, pullFloor, pullFloorAsPlace, type World } from "./oracle-floor-rig.js";

const SEED = new Uint8Array(32).fill(17);
const PRIVATE_CHARTER: NexusDoc = { ...emptyFoundingCharterDoc(), threshold: 1, sealEpochCid: `nexus-${"a".repeat(64)}`, federationPosture: "private" };

const servers: Server[] = [];
const dirs: string[] = [];
const repos: Repo[] = [];
const faces: OracleFloorFace[] = [];
afterEach(async () => {
  for (const f of faces.splice(0)) f.dispose();
  for (const s of servers.splice(0)) await new Promise<void>((r) => s.close(() => r()));
  for (const r of repos.splice(0)) await r.shutdown().catch(() => {});
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Stand an oracle face whose floor gate sorts with the vessel's real sorter, at the posture `placeClass` reads over `charter`. */
async function stand(placeClass: PlaceClass, charter: NexusDoc | null, nexus = "nexus-a.synthetic"): Promise<{ origin: string; world: World }> {
  const server = createServer();
  servers.push(server);
  const dispatcher = mountHttpFaceDispatcher(server);
  const storageDir = mkdtempSync(join(tmpdir(), "herm-knock-")); dirs.push(storageDir);
  const repo = new Repo({ sharePolicy: async () => true }); repos.push(repo);
  const handle = repo.create<{ tiddlers: Record<string, unknown> }>({ tiddlers: { dial: { text: "node/alpha" } } });
  const rig = floorGates([nexus]);
  const face = await mountOracleReadFace({ httpServer: server, oracleHandle: handle, signerSeed: SEED, storageDir, gates: rig.gates, dispatcher, exportSnapshot: (doc) => exportOracleSnapshot(doc as never) });
  faces.push(face);
  // The vessel's real sorter over the vessel's one posture reader.
  const sorter = makeGateSorter({ posture: () => ownPlacePosture(placeClass, charter) });
  const world = rig.worlds[0]!;
  world.sorterAnswer = (input) => sorter.sort(input);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`, world };
}

describe("a herm answers the knock", () => {
  test("THE RULING: a proven non-member stranger who knocked reads the map, verified", async () => {
    const herm = await stand("herm", null);
    const pulled = await pullFloor(herm.origin, herm.world, await presenter(herm.world, "stranger"), { arm: null, publisherSeed: SEED });
    expect(pulled.ok, pulled.reason).toBe(true);
    expect(pulled.pointer?.pub).toBeDefined();
  }, 30_000);

  test("a carried next hop presenting its carriage contract reads the map", async () => {
    const herm = await stand("herm", null);
    const pulled = await pullFloorAsPlace(herm.origin, herm.world, await place(herm.world, "next hop"), { publisherSeed: SEED });
    expect(pulled.ok, pulled.reason).toBe(true);
  }, 30_000);

  test("a proven place with no arm (a crossroads no quorum carried) reads it: proven is the whole test", async () => {
    const herm = await stand("herm", null);
    const pulled = await pullFloorAsPlace(herm.origin, herm.world, await place(herm.world, "uncarried"), { arm: null, publisherSeed: SEED });
    expect(pulled.ok, pulled.reason).toBe(true);
  }, 30_000);

  test("RED: a stranger without the knock path reaches no socket: the bare route draws no upgrade", async () => {
    const herm = await stand("herm", null);
    const bare = new WebSocket(`${herm.origin.replace("http", "ws")}${ORACLE_SOCKET_ROUTE}`);
    const frames: string[] = [];
    bare.onmessage = (e) => frames.push(String(e.data));
    const closed = await new Promise<boolean>((resolve) => {
      bare.onclose = () => resolve(true);
      bare.onerror = () => resolve(true);
      setTimeout(() => resolve(false), 5_000);
    });
    expect(closed).toBe(true);
    expect(frames).toEqual([]);
  }, 30_000);

  test("RED: a stranger holding the pin of a gate at ANOTHER Nexus knocks on a path this gate never derived: no upgrade, no frame", async () => {
    const herm = await stand("herm", null);
    const other = await stand("herm", null, "nexus-b.synthetic");     // a gate at another Nexus: its pin's knock names no path here
    const pulled = await pullFloor(herm.origin, other.world, await presenter(other.world, "stranger"), { arm: null, publisherSeed: SEED, deadlineMs: 1_500 });
    expect(pulled.ok).toBe(false);
    expect(pulled.pointer).toBeUndefined();
  }, 30_000);

  test("CONTROL: a lararium's gate at a PRIVATE charter meets the same arm-less stranger with silence", async () => {
    const hearth = await stand("lararium", PRIVATE_CHARTER);
    const pulled = await pullFloor(hearth.origin, hearth.world, await presenter(hearth.world, "stranger"), { arm: null, publisherSeed: SEED, deadlineMs: 1_500 });
    expect(pulled.ok).toBe(false);
    expect(pulled.pointer).toBeUndefined();
  }, 30_000);

  test("the one reader: a herm reads OPEN by class; a lararium reads its charter and an absent one fails closed", () => {
    expect(ownPlacePosture("herm", null)).toBe("open");
    expect(ownPlacePosture("herm", PRIVATE_CHARTER)).toBe("open");
    expect(ownPlacePosture("lararium", null)).toBe("private");
    expect(ownPlacePosture("lararium", PRIVATE_CHARTER)).toBe("private");
    expect(ownPlacePosture("lararium", { ...PRIVATE_CHARTER, federationPosture: "open" })).toBe("open");
  });
});
