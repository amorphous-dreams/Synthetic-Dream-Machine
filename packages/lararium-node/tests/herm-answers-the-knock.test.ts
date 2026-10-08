/**
 * herm-answers-the-knock.test.ts — a charterless herm is a WAYSTONE, never a broken lararium: it answers any proven
 * peer that knocked with its gate key, and only a peer handed that key can knock.
 *
 * A herm holds no charter by class. Read as a lararium's absent charter it folded PRIVATE, and every herm sorted
 * the pinned FLOW-map pull of the next hop to silence — the docker mesh stood dark. `ownPlacePosture` is the one
 * reader: a lararium reads its charter (absent → PRIVATE); a herm answers the knock.
 *
 * Proven, over a real oracle face armed with the vessel's real sorter:
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
import { pullAndVerifyOracle, ORACLE_SOCKET_ROUTE, ed25519VerifyingKeyFromSeed, NEXUS_DOC_DOMAIN, type NexusDoc } from "@lararium/mesh";
import { mountHttpFaceDispatcher } from "../src/http-face-dispatcher.js";
import { mountOracleReadFace } from "../src/oracle-read-face.js";
import { makeSocketSorter, ownPlacePosture, type PlaceClass } from "../src/socket-sorter.js";
import { provingShore, readerIdentity } from "./oracle-proof-fixture.js";

const SEED = new Uint8Array(32).fill(17);
const NEXT_HOP = new Uint8Array(32).fill(19);

const servers: Server[] = [];
const dirs: string[] = [];
const repos: Repo[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) await new Promise<void>((r) => s.close(() => r()));
  for (const r of repos.splice(0)) await r.shutdown().catch(() => {});
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Stand an oracle face whose gate sorts with the vessel's real sorter as a `placeClass` holding no charter. */
async function stand(placeClass: PlaceClass): Promise<{ origin: string; pin: string; dispose: () => void }> {
  const server = createServer();
  servers.push(server);
  const dispatcher = mountHttpFaceDispatcher(server);
  const storageDir = mkdtempSync(join(tmpdir(), "herm-knock-")); dirs.push(storageDir);
  const repo = new Repo({ sharePolicy: async () => true }); repos.push(repo);
  const handle = repo.create<{ tiddlers: Record<string, unknown> }>({ tiddlers: { dial: { text: "node/alpha" } } });
  const sort = makeSocketSorter({
    readings: async () => [], carrier: () => false,
    primaryPosture: () => ownPlacePosture(placeClass, null),
  });
  const face = await mountOracleReadFace({ httpServer: server, oracleHandle: handle, signerSeed: SEED, storageDir, authShore: await provingShore(SEED), sort, dispatcher });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return { origin, pin: await ed25519VerifyingKeyFromSeed(SEED), dispose: () => { face.dispose(); dispatcher.dispose(); } };
}

describe("a herm answers the knock", () => {
  test("RED: a pinned herm→herm FLOW-map pull answers — the next hop, proven and presenting nothing, reads the map", async () => {
    const herm = await stand("herm");
    const pulled = await pullAndVerifyOracle(herm.origin, { identity: await readerIdentity(NEXT_HOP), verifyingKey: herm.pin });
    expect(pulled.ok, pulled.reason).toBe(true);
    herm.dispose();
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
    herm.dispose();
  }, 30_000);

  test("CONTROL: a PRIVATE lararium still silences the same unknown proven key", async () => {
    const hearth = await stand("lararium");
    const pulled = await pullAndVerifyOracle(hearth.origin, { identity: await readerIdentity(NEXT_HOP), verifyingKey: hearth.pin, frameTimeoutMs: 8_000 });
    expect(pulled.ok).toBe(false);
    expect(pulled.pointer).toBeUndefined();
    hearth.dispose();
  }, 30_000);

  test("the one reader: a herm reads OPEN by class; a lararium reads its charter and fails closed", () => {
    const privateCharter: NexusDoc = { kind: NEXUS_DOC_DOMAIN, threshold: 1, sealEpochCid: `epoch0-${"a".repeat(64)}`, kahu: [], federationPosture: "private" };
    expect(ownPlacePosture("herm", null)).toBe("open");
    expect(ownPlacePosture("herm", privateCharter)).toBe("open");
    expect(ownPlacePosture("lararium", null)).toBe("private");
    expect(ownPlacePosture("lararium", privateCharter)).toBe("private");
    expect(ownPlacePosture("lararium", { ...privateCharter, federationPosture: "open" })).toBe("open");
  });
});
