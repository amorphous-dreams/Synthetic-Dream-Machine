/**
 * herm-answers-the-knock.test.ts — a herm's floor gate answers as the Nexus that carries it, and the next hop reads its map
 * by presenting its own carriage contract (house readings "The herm's gate posture" and "The faceless reader", 2026-10-16).
 *
 * THE READING THIS REPLACES. A herm once read OPEN by class: "it answers any proven peer that knocked, and only a peer
 * handed the key can knock". That made the pin a bearer secret: a scraper the pin leaked to, presenting a self-made face no
 * Nexus admits, read the crossroads' map. A herm now stands a gate only where a quorum counted its `carry`
 * (`gateNexuses`), and there it reads that Nexus's own charter: PRIVATE unless the charter says OPEN.
 *
 * Proven over a real oracle face on its floor gate, sorting with the vessel's real sorter at the posture a herm reads:
 *   · the herm→herm FLOW-map pull answers at a PRIVATE Nexus: the next hop presents its own key and the quorum's counted
 *     carry act over it (the place arm), and reads the map, verified;
 *   · RED: a stranger who holds the pin and presents a proven face with no arm meets silence and learns no pointer;
 *   · RED: a place the Nexus never carried (no contract) meets silence;
 *   · a stranger without the knock path reaches no socket at all: the bare route draws no upgrade, so no frame;
 *   · CONTROL: where the carrying Nexus's charter reads OPEN, the same arm-less stranger reads the map — the Nexus's choice;
 *   · the reader itself: a herm and a lararium both read the charter, fail-closed.
 */
import { afterEach, describe, expect, test } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { ORACLE_SOCKET_ROUTE, emptyFoundingCharterDoc, exportOracleSnapshot, type FederationPosture, type NexusDoc } from "@lararium/mesh";
import { mountHttpFaceDispatcher } from "../src/http-face-dispatcher.js";
import { mountOracleReadFace, type OracleFloorFace } from "../src/oracle-read-face.js";
import { makeGateSorter, ownPlacePosture } from "../src/socket-sorter.js";
import { floorGates, place, presenter, pullFloor, pullFloorAsPlace, type World } from "./oracle-floor-rig.js";

const SEED = new Uint8Array(32).fill(17);
const CHARTER: NexusDoc = { ...emptyFoundingCharterDoc(), threshold: 1, sealEpochCid: `nexus-${"a".repeat(64)}`, federationPosture: "private" };

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

/** Stand a herm's oracle face whose floor gate sorts with the vessel's real sorter, at the posture the carrying charter gives. */
async function stand(posture: FederationPosture): Promise<{ origin: string; world: World }> {
  const server = createServer();
  servers.push(server);
  const dispatcher = mountHttpFaceDispatcher(server);
  const storageDir = mkdtempSync(join(tmpdir(), "herm-knock-")); dirs.push(storageDir);
  const repo = new Repo({ sharePolicy: async () => true }); repos.push(repo);
  const handle = repo.create<{ tiddlers: Record<string, unknown> }>({ tiddlers: { dial: { text: "node/alpha" } } });
  const rig = floorGates(["nexus-a.synthetic"]);
  const face = await mountOracleReadFace({ httpServer: server, oracleHandle: handle, signerSeed: SEED, storageDir, gates: rig.gates, dispatcher, exportSnapshot: (doc) => exportOracleSnapshot(doc as never) });
  faces.push(face);
  // The vessel's real sorter, reading the posture the herm reads at a carried Nexus: that Nexus's own charter.
  const sorter = makeGateSorter({ posture: () => ownPlacePosture("herm", { ...CHARTER, federationPosture: posture }) });
  const world = rig.worlds[0]!;
  world.sorterAnswer = (input) => sorter.sort(input);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`, world };
}

describe("a herm's floor gate answers as the Nexus that carries it", () => {
  test("the herm→herm FLOW-map pull answers at a PRIVATE Nexus: the next hop presents its carriage contract and reads the map", async () => {
    const herm = await stand("private");
    const pulled = await pullFloorAsPlace(herm.origin, herm.world, await place(herm.world, "next hop"), { publisherSeed: SEED });
    expect(pulled.ok, pulled.reason).toBe(true);
  }, 30_000);

  test("RED: a stranger who holds the pin and presents an arm-less face meets silence and learns no pointer", async () => {
    const herm = await stand("private");
    const pulled = await pullFloor(herm.origin, herm.world, await presenter(herm.world, "scraper"), { arm: null, publisherSeed: SEED, deadlineMs: 1_500 });
    expect(pulled.ok).toBe(false);
    expect(pulled.pointer).toBeUndefined();
  }, 30_000);

  test("RED: a place the Nexus never carried, presenting no contract, meets silence", async () => {
    const herm = await stand("private");
    const pulled = await pullFloorAsPlace(herm.origin, herm.world, await place(herm.world, "uncarried"), { arm: null, publisherSeed: SEED, deadlineMs: 1_500 });
    expect(pulled.ok).toBe(false);
    expect(pulled.pointer).toBeUndefined();
  }, 30_000);

  test("a stranger without the knock path reaches no socket: the bare route draws no upgrade", async () => {
    const herm = await stand("private");
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

  test("CONTROL: where the carrying Nexus's charter reads OPEN, the same arm-less stranger reads the map", async () => {
    const herm = await stand("open");
    const pulled = await pullFloor(herm.origin, herm.world, await presenter(herm.world, "scraper"), { arm: null, publisherSeed: SEED });
    expect(pulled.ok, pulled.reason).toBe(true);
  }, 30_000);

  test("the one reader: a herm and a lararium both read the charter, and an absent one fails closed", () => {
    expect(ownPlacePosture("herm", null)).toBe("private");
    expect(ownPlacePosture("herm", CHARTER)).toBe("private");
    expect(ownPlacePosture("herm", { ...CHARTER, federationPosture: "open" })).toBe("open");
    expect(ownPlacePosture("lararium", null)).toBe("private");
    expect(ownPlacePosture("lararium", CHARTER)).toBe("private");
    expect(ownPlacePosture("lararium", { ...CHARTER, federationPosture: "open" })).toBe("open");
  });
});
