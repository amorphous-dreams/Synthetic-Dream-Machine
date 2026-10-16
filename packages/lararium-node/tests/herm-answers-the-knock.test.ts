/**
 * herm-answers-the-knock.test.ts — a charterless herm is a WAYSTONE, never a broken lararium: it answers any proven
 * peer that knocked with its gate key, and only a peer handed that key can knock.
 *
 * A herm holds no charter by class. Read as a lararium's absent charter it folded PRIVATE, and every herm sorted
 * the pinned FLOW-map pull of the next hop to silence — the docker mesh stood dark. `ownPlacePosture` is the one
 * reader: a lararium reads its charter (absent → PRIVATE); a herm answers the knock.
 *
 * Proven, over a real oracle face on its floor gate, sorting with the vessel's real sorter:
 *   · RED: a pinned herm→herm FLOW-map pull answers — the next hop, a proven key presenting nothing, reads the map;
 *   · a stranger without the knock path reaches no socket at all: the bare route draws no upgrade, so no frame;
 *   · CONTROL: a PRIVATE lararium — no charter, so PRIVATE — still silences the same unknown proven key;
 *   · the reader itself: a herm reads OPEN whatever its charter says; a lararium reads its charter, fail-closed.
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
import { floorGates, presenter, pullFloor, type World } from "./oracle-floor-rig.js";

const SEED = new Uint8Array(32).fill(17);

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

/** Stand an oracle face whose floor gate sorts with the vessel's real sorter as a `placeClass` holding no charter. */
async function stand(placeClass: PlaceClass): Promise<{ origin: string; world: World }> {
  const server = createServer();
  servers.push(server);
  const dispatcher = mountHttpFaceDispatcher(server);
  const storageDir = mkdtempSync(join(tmpdir(), "herm-knock-")); dirs.push(storageDir);
  const repo = new Repo({ sharePolicy: async () => true }); repos.push(repo);
  const handle = repo.create<{ tiddlers: Record<string, unknown> }>({ tiddlers: { dial: { text: "node/alpha" } } });
  const rig = floorGates(["nexus-a.synthetic"]);
  const face = await mountOracleReadFace({ httpServer: server, oracleHandle: handle, signerSeed: SEED, storageDir, gates: rig.gates, dispatcher, exportSnapshot: (doc) => exportOracleSnapshot(doc as never) });
  faces.push(face);
  // The vessel's real sorter, reading the posture its place class gives it: the gate's own rule is set aside.
  const sorter = makeGateSorter({ posture: () => ownPlacePosture(placeClass, null) });
  const world = rig.worlds[0]!;
  world.sorterAnswer = (input) => sorter.sort(input);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`, world };
}

describe("a herm answers the knock", () => {
  test("RED: a pinned herm→herm FLOW-map pull answers — the next hop, proven and presenting nothing, reads the map", async () => {
    const herm = await stand("herm");
    const pulled = await pullFloor(herm.origin, herm.world, await presenter(herm.world, "next hop"), { arm: null, publisherSeed: SEED });
    expect(pulled.ok, pulled.reason).toBe(true);
  }, 30_000);

  test("a stranger without the knock path reaches no socket: the bare route draws no upgrade", async () => {
    const herm = await stand("herm");
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

  test("CONTROL: a PRIVATE lararium still silences the same unknown proven key", async () => {
    const hearth = await stand("lararium");
    const pulled = await pullFloor(hearth.origin, hearth.world, await presenter(hearth.world, "next hop"), { arm: null, publisherSeed: SEED });
    expect(pulled.ok).toBe(false);
    expect(pulled.pointer).toBeUndefined();
  }, 30_000);

  test("the one reader: a herm reads OPEN by class; a lararium reads its charter and fails closed", () => {
    const privateCharter: NexusDoc = { ...emptyFoundingCharterDoc(), threshold: 1, sealEpochCid: `nexus-${"a".repeat(64)}`, federationPosture: "private" };
    expect(ownPlacePosture("herm", null)).toBe("open");
    expect(ownPlacePosture("herm", privateCharter)).toBe("open");
    expect(ownPlacePosture("lararium", null)).toBe("private");
    expect(ownPlacePosture("lararium", privateCharter)).toBe("private");
    expect(ownPlacePosture("lararium", { ...privateCharter, federationPosture: "open" })).toBe("open");
  });
});
