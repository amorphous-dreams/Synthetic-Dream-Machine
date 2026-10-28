import { placeSignerFromSeed } from "@lararium/mesh";
/**
 * flow-map-read-face — a Herm serves its FLOW-map to a proven peer over its floor-gated flow socket. The serve →
 * pull → verify round trip and the disclosure shore at the wire (only the coarse public projection crosses; the
 * vessel-local dial-records never leave) are proven beside the gate in flow-floor-gate.test; what this suite
 * keeps is the durable lineage: a restart re-serves the exact pointer it published, then makes a causal child on
 * change.
 * Canon: lar:///ha.ka.ba/lararium/mesh/vessel-caps#/lares-viales
 */
import { describe, test, expect } from "vitest";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { exportFlowSnapshot, type MeshPalaceDoc } from "@lararium/mesh";
import { mountFlowReadFace } from "../src/flow-read-face.js";
import { floorGates, presenter, pullFloor } from "./flow-floor-rig.js";
import { arrival, type Arrival } from "../../lararium-mesh/tests/handshake.js";

const SEED = new Uint8Array(32).fill(7); // a fixed, valid ed25519 seed (deterministic)

describe("the FLOW-map read-face — a Herm serves the public projection, shore at the wire", () => {
  test("restart re-serves the exact durable pointer, then makes a causal child on change", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const handle = repo.create<MeshPalaceDoc>({ schemaVersion: "0.1", tiddlers: {} });
    const server = createServer();
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;
    const storageDir = mkdtempSync(join(tmpdir(), "herm-flowmap-restart-"));
    const base = `http://127.0.0.1:${port}`;
    // The gates survive the restart: a Herm's floor pin is its bundle's, not the process's.
    const rig = floorGates(["nexus-a.synthetic"], { posture: "open" });
    const mount = () => mountFlowReadFace({
      httpServer: server, oracleHandle: handle, signer: placeSignerFromSeed(SEED), storageDir, gates: rig.gates, exportSnapshot: (doc) => exportFlowSnapshot(doc as never),
      ...(onLog ? { onLog } : {}),
    });
    let onLog: ((line: string) => void) | null = null;
    const pointerAt = async (): Promise<{ actCid: string; parents: readonly string[] }> => {
      const w = rig.worlds[rig.worlds.length - 1]!;
      const r = await pullFloor(base, w, await presenter(w, "reader"), { arm: null, publisherSeed: SEED });
      if (!r.pointer) throw new Error(`no pointer: ${r.reason}`);
      return r.pointer;
    };

    const first = await mount();
    const p1 = await pointerAt();
    first.dispose();
    // The face's own line for "a new act stands" carries the wait: it says it after the pointer moved and rests.
    let reissued: Arrival<void> | null = null;
    onLog = (line) => { if (/^flow read-face: act=/.test(line)) reissued?.arrive(); };
    const second = await mount();
    const p1Restart = await pointerAt();
    expect(p1Restart).toEqual(p1);

    reissued = arrival<void>("the read face saying a new act stands (its \"flow read-face: act=\" line)");
    handle.change((d) => { d.tiddlers["new"] = { public: true } as never; });
    await reissued.arrived;
    const p2 = await pointerAt();
    expect(p2.actCid).not.toBe(p1.actCid);
    expect(p2.parents).toEqual([p1.actCid]);

    second.dispose();
    await new Promise<void>((r) => server.close(() => r()));
  }, 30_000);
});
