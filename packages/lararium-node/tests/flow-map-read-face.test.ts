/**
 * flow-map-read-face — a Herm serves its FLOW-map to a proven peer over its gated oracle socket, and the
 * disclosure shore holds AT THE WIRE: only the coarse public projection crosses; the private territory
 * (vessel-local dial-records) never leaves. Proves prove → serve → pull → verify end-to-end on localhost,
 * and witnesses the shore export variant.
 * Canon: lar:///ha.ka.ba/lararium/mesh/vessel-caps#/lares-viales
 */

import { describe, test, expect } from "vitest";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import {
  pullAndVerifyOracle, dialEntryToRecord,
  type MeshPalaceDoc,
} from "@lararium/mesh";
import { mountFlowMapReadFace, mountOracleReadFace } from "../src/oracle-read-face.js";
import { provingShore, readerIdentity, openSorter } from "./oracle-proof-fixture.js";
import { ed25519VerifyingKeyFromSeed } from "@lararium/mesh";

const SEED = new Uint8Array(32).fill(7); // a fixed, valid ed25519 seed (deterministic)
const READER = new Uint8Array(32).fill(9);

describe("the FLOW-map read-face — a Herm serves the public projection, shore at the wire", () => {
  test("serve → pull round-trips, and the shore drops the private territory", async () => {
    const repo = new Repo({ sharePolicy: async () => true });

    // a mesh-palace doc: one PUBLIC dial (dreamnet scale, crosses) + one vessel-LOCAL dial (no scale, stays).
    const pub = dialEntryToRecord(
      { bearing: "lar:///ha.ka.ba/bags/oracle", verifyingKeyHex: "a".repeat(64), endpoint: "ws://relay/p", scale: "dreamnet" }, "test");
    const loc = dialEntryToRecord(
      { bearing: "lar:///ha.ka.ba/bags/daemon", verifyingKeyHex: "b".repeat(64), endpoint: "ws://local/q" }, "test");
    const handle = repo.create<MeshPalaceDoc>({
      schemaVersion: "0.1",
      tiddlers: { [pub.tiddler.title]: pub, [loc.tiddler.title]: loc },
    });

    const server = createServer();
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;
    const storageDir = mkdtempSync(join(tmpdir(), "herm-flowmap-"));

    const face = await mountFlowMapReadFace({ httpServer: server, meshPalaceHandle: handle, signerSeed: SEED, storageDir, authShore: await provingShore(SEED), sort: openSorter });

    // a peer proves at the gate, then pulls + verifies (pointer signature · hash · lineage).
    const verdict = await pullAndVerifyOracle<MeshPalaceDoc>(`http://127.0.0.1:${port}`, { identity: await readerIdentity(READER), verifyingKey: await ed25519VerifyingKeyFromSeed(SEED) });
    expect(verdict.ok).toBe(true);

    const titles = Object.keys(verdict.doc?.tiddlers ?? {});
    expect(titles).toContain(pub.tiddler.title);     // the public dial crossed the wire
    expect(titles).not.toContain(loc.tiddler.title); // the private territory stayed home

    face.dispose();
    await new Promise<void>((r) => server.close(() => r()));
  });

  test("restart re-serves the exact durable pointer, then makes a causal child on change", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const handle = repo.create<MeshPalaceDoc>({ schemaVersion: "0.1", tiddlers: {} });
    const server = createServer();
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;
    const storageDir = mkdtempSync(join(tmpdir(), "herm-flowmap-restart-"));
    const url = `http://127.0.0.1:${port}`;
    const authShore = await provingShore(SEED);
    const identity = await readerIdentity(READER);
    const pointerAt = async (): Promise<{ actCid: string; parents: readonly string[] }> => {
      const r = await pullAndVerifyOracle(url, { identity, verifyingKey: await ed25519VerifyingKeyFromSeed(SEED) });
      if (!r.pointer) throw new Error(`no pointer: ${r.reason}`);
      return r.pointer;
    };

    const first = await mountOracleReadFace({ httpServer: server, oracleHandle: handle, signerSeed: SEED, storageDir, authShore, sort: openSorter });
    const p1 = await pointerAt();
    first.dispose();
    const second = await mountOracleReadFace({ httpServer: server, oracleHandle: handle, signerSeed: SEED, storageDir, authShore, sort: openSorter });
    const p1Restart = await pointerAt();
    expect(p1Restart).toEqual(p1);

    handle.change((d) => { d.tiddlers["new"] = { public: true }; });
    let p2 = p1Restart;
    for (let i = 0; i < 20 && p2.actCid === p1.actCid; i++) {
      await new Promise((r) => setTimeout(r, 10));
      p2 = await pointerAt();
    }
    expect(p2.actCid).not.toBe(p1.actCid);
    expect(p2.parents).toEqual([p1.actCid]);

    second.dispose();
    await new Promise<void>((r) => server.close(() => r()));
  });
});
