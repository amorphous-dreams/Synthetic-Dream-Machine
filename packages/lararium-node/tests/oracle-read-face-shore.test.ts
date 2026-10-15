/**
 * oracle-read-face-shore — the oracle read-face serves the genesis-named FLOOR and nothing else: the
 * titles and blob rows the seed names, at their live values, as ONE change with no history. A vessel's
 * private keys and the values they superseded never reach a proven dialer.
 * Canon: lar:///ha.ka.ba/lares/api/pono/lararium-identity#/the-oracle-plane
 */
import { afterEach, describe, expect, test } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as A from "@automerge/automerge";
import { Repo, type DocHandle } from "@automerge/automerge-repo";
import {
  pullAndVerifyOracle, ed25519VerifyingKeyFromSeed, materializeGenesisDoc, snapshotPublicOracle,
  type GenesisSeed, type LarDoc,
} from "@lararium/mesh";
import { mountOracleReadFace } from "../src/oracle-read-face.js";
import { provingShore, readerIdentity, openSorter } from "./oracle-proof-fixture.js";

const SEED   = new Uint8Array(32).fill(7);
const READER = new Uint8Array(32).fill(9);
const SEED_CID = "5".repeat(64);

const GENESIS = {
  format: "lararium-genesis-seed/v1", actorSeed: "ab".repeat(16),
  blobs: { "lar:///core": { id: "core", version: "1", sha256: "c".repeat(64), mimeType: "application/javascript" } },
  tiddlers: {
    "lar:///seeded": { tiddler: { title: "lar:///seeded", text: "seed value" } },
    "lar:///seeded-two": { tiddler: { title: "lar:///seeded-two", text: "second" } },
  },
} as unknown as GenesisSeed;

const servers: Server[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) await new Promise<void>((r) => s.close(() => r()));
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** The vessel's oracle doc: the materialized seed, then the vessel's own private writes over it. */
function liveOracle(repo: Repo): DocHandle<LarDoc> {
  const handle = repo.import<LarDoc>(materializeGenesisDoc(GENESIS));
  handle.change((d) => {
    const t = (d as unknown as { tiddlers: Record<string, unknown> }).tiddlers;
    t["bags/catalog"] = { tiddler: { text: "private-catalog-url" } };
    t["bags/daemon"] = { tiddler: { text: "private-daemon-url" } };
    t["lar:///ha.ka.ba/lares/bags/identities-abc123"] = { tiddler: { text: "private-face-plane" } };
    t["bags/realm/steward-nym"] = { tiddler: { text: "private-steward" } };
  });
  handle.change((d) => {
    (d as unknown as { tiddlers: Record<string, { tiddler: { text: string } }> }).tiddlers["bags/catalog"]!.tiddler.text = "SUPERSEDED-PRIVATE-BYTES";
  });
  return handle;
}

async function pullFloor(mount: (args: Parameters<typeof mountOracleReadFace>[0]) => Promise<{ dispose: () => void }>) {
  const repo = new Repo({ sharePolicy: async () => true });
  const handle = liveOracle(repo);
  const server = createServer();
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const storageDir = mkdtempSync(join(tmpdir(), "oracle-shore-")); dirs.push(storageDir);
  const logs: string[] = [];
  const face = await mount({
    httpServer: server, oracleHandle: handle as DocHandle<unknown>, signerSeed: SEED, storageDir,
    authShore: await provingShore(SEED), sort: openSorter, onLog: (l) => logs.push(l),
    exportSnapshot: undefined as never,
  });
  const pulled = await pullAndVerifyOracle<{ tiddlers: Record<string, unknown> }>(origin, {
    identity: await readerIdentity(READER), verifyingKey: await ed25519VerifyingKeyFromSeed(SEED),
  });
  face.dispose();
  return { pulled, logs };
}

/** What main.ts mounts: the seed's floor, exported through the shore. */
const mountAsMain: Parameters<typeof pullFloor>[0] = (a) =>
  mountOracleReadFace({ ...a, exportSnapshot: (doc) => snapshotPublicOracle(doc as LarDoc, GENESIS, SEED_CID) });

describe("the oracle read-face serves the genesis floor alone", () => {
  test("the pulled doc holds exactly the seed's keys, one change, and no superseded bytes", async () => {
    const { pulled } = await pullFloor(mountAsMain);
    expect(pulled.ok, pulled.reason).toBe(true);
    const doc = pulled.doc!;
    expect(Object.keys(doc.tiddlers).sort()).toEqual(Object.keys(GENESIS.tiddlers).sort());
    expect(A.getAllChanges(doc as never).length).toBe(1);
    const wire = Buffer.from(A.save(doc as never)).toString("latin1");
    expect(wire).not.toContain("SUPERSEDED-PRIVATE-BYTES");
    expect(wire).not.toContain("private-daemon-url");
  });

  test("the mount logs the seed cid beside the snapshot cid", async () => {
    const { logs } = await pullFloor(mountAsMain);
    expect(logs.some((l) => l.includes(`seed=${SEED_CID.slice(0, 12)}`) && l.includes("cid="))).toBe(true);
  });

  test("a mount holding no exportSnapshot refuses; no raw document serves by omission", async () => {
    await expect(pullFloor((a) => mountOracleReadFace({ ...a, exportSnapshot: undefined as never }))).rejects.toThrow(/exportSnapshot/);
  });
});
