/**
 * oracle-floor-resweep — the oracle face's floor gates follow the Nexuses this vessel stands in, at every refold, as the
 * sync gates do (`mountFlowReadFace`'s `gates.onMoved`).
 *
 * A carry-take on a running herm lands a carrier seal the gate sweep then reads: the floor gate for that Nexus must
 * stand without a restart, and an uncarry must stand it down. The face once called its gates once, at mount.
 *
 * Proven:
 *   · RED: a Nexus read after the mount stands its floor gate once the gate source says it moved, on its own knock /
 *     CONTROL: the gate already standing stays the same gate;
 *   · RED: a Nexus no longer read stands its gate down, and its knock is claimed no more;
 *   · a dispose stops following: a move after it stands nothing;
 *   · the vessel's floor gate source tells the face, from the membership refold.
 */
import { afterEach, describe, expect, test } from "vitest";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Duplex } from "node:stream";
import { Repo } from "@automerge/automerge-repo";
import { ORACLE_SOCKET_ROUTE, type GateSessionTable, type MeshPalaceDoc } from "@lararium/mesh";
import { mountFlowMapReadFace, type FlowFloorFace, type OracleFloorGate } from "../src/flow-read-face.js";
import { gatePath } from "../src/face-gate-server.js";
import type { HttpFaceDispatcher } from "../src/http-face-dispatcher.js";
import { world, type World } from "../../lararium-mesh/tests/face-gate-fixture.js";

const SEED = new Uint8Array(32).fill(7);
const SRC = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");

const opened: Array<{ server: Server; face: FlowFloorFace | null; dir: string }> = [];
afterEach(async () => {
  for (const o of opened.splice(0)) {
    o.face?.dispose();
    await new Promise<void>((r) => o.server.close(() => r()));
    rmSync(o.dir, { recursive: true, force: true });
  }
});

/** A dispatcher that records what is registered on it, as the vessel's own does. */
function recordingDispatcher(): HttpFaceDispatcher & { readonly paths: Set<string> } {
  const paths = new Set<string>();
  return {
    paths,
    registerUpgrade(entry: { name: string; path: string; handle: (req: IncomingMessage, socket: Duplex, head: Buffer) => void }) {
      paths.add(entry.path);
      return () => { paths.delete(entry.path); };
    },
  } as unknown as HttpFaceDispatcher & { readonly paths: Set<string> };
}

/** Stand the face over a gate source whose Nexus list a suite moves; `moved()` tells the face as the vessel does. */
async function stand(initial: readonly string[]) {
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const dir = mkdtempSync(join(tmpdir(), "oracle-resweep-"));
  const repo = new Repo({ sharePolicy: async () => true });
  const handle = repo.create<MeshPalaceDoc>({ schemaVersion: "0.1", tiddlers: {} });
  const entry: { server: Server; face: FlowFloorFace | null; dir: string } = { server, face: null, dir };
  opened.push(entry);
  let nexuses = [...initial];
  const worlds = new Map<string, World>();
  const listeners = new Set<() => void>();
  const gates = Object.assign(async (sessions: GateSessionTable): Promise<readonly OracleFloorGate[]> => {
    const out: OracleFloorGate[] = [];
    for (const nexus of nexuses) {
      const w = await world({ nexus, tier: "floor", route: ORACLE_SOCKET_ROUTE, sessions });
      worlds.set(nexus, w);
      out.push({ gate: w.gate, pin: w.pin });
    }
    return out;
  }, { onMoved: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } });
  const dispatcher = recordingDispatcher();
  const face = await mountFlowMapReadFace({ httpServer: server, meshPalaceHandle: handle, signerSeed: SEED, storageDir: dir, gates, dispatcher });
  entry.face = face;
  return {
    face, dispatcher, worlds, listeners,
    async move(next: readonly string[]) {
      nexuses = [...next];
      for (const l of [...listeners]) l();
      // The face sweeps on its own turn; wait until its paths settle.
      for (let i = 0; i < 100; i++) await new Promise((r) => setTimeout(r, 10));
    },
  };
}

describe("the oracle face's floor gates follow the refold", () => {
  test("RED: a Nexus read after the mount stands its gate; RED: one no longer read stands down; CONTROL: a standing gate stays", async () => {
    const r = await stand(["nexus-a.synthetic"]);
    const a = gatePath(r.worlds.get("nexus-a.synthetic")!.pin);
    expect(r.face.paths()).toEqual([a]);

    await r.move(["nexus-a.synthetic", "nexus-b.synthetic"]);
    const b = gatePath(r.worlds.get("nexus-b.synthetic")!.pin);
    expect([...r.face.paths()].sort()).toEqual([a, b].sort());                         // RED: B stands
    expect(r.dispatcher.paths.has(b)).toBe(true);
    expect(r.dispatcher.paths.has(a)).toBe(true);                                        // CONTROL: A stays

    await r.move(["nexus-b.synthetic"]);
    expect(r.face.paths()).toEqual([b]);                                                 // RED: A stands down
    expect(r.dispatcher.paths.has(a)).toBe(false);
  });

  test("a dispose stops following: a move after it stands nothing", async () => {
    const r = await stand(["nexus-a.synthetic"]);
    expect(r.listeners.size).toBe(1);
    r.face.dispose();
    expect(r.listeners.size).toBe(0);
    await r.move(["nexus-a.synthetic", "nexus-b.synthetic"]);
    expect(r.face.paths()).toEqual([]);
  });

  test("the vessel's floor gate source tells the face from the membership refold", () => {
    expect(SRC).toMatch(/floorGatesMoved\(\)/);
    expect(SRC).toMatch(/onMoved:/);
  });
});
