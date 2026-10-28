import { placeSignerFromSeed } from "@lararium/mesh";
/**
 * flow-closed-door.test.ts — the herm flow keeps silence (pronaos#/the-rung-ladder).
 *
 * The flow face is no HTTP face: every HTTP path under it — the pointer it publishes, the snapshot it holds,
 * any method, any shape — draws THE closed door, byte for byte the answer a path no face claims draws. The
 * map crosses only the floor-gated flow socket, to a dialer the gate sorted; a stranger who opens the socket
 * and proves nothing receives no frame of it. `/api/health` binds on a lararium alone: on a herm it is the
 * same closed door.
 */
import { afterEach, describe, expect, test } from "vitest";
import { createServer, request, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { exportFlowSnapshot, FLOW_SOCKET_ROUTE } from "@lararium/mesh";
import { CLOSED_DOOR } from "../src/bulb-routes.js";
import { mountHttpFaceDispatcher } from "../src/http-face-dispatcher.js";
import { mountFlowReadFace } from "../src/flow-read-face.js";
import { gatePath } from "../src/face-gate-server.js";
import { createReadinessState, mountReadinessFace } from "../src/readiness-face.js";
import { floorGates, presenter, pullFloor } from "./flow-floor-rig.js";

const SEED   = new Uint8Array(32).fill(7);

/** One answer as a stranger sees it: status, every header but the date, and the body bytes. */
interface Answer { readonly status: number; readonly headers: readonly string[]; readonly body: string }

function ask(origin: string, path: string, method = "GET"): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const req = request(`${origin}${path}`, { method, headers: { connection: "close" } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const headers: string[] = [];
        for (let i = 0; i < res.rawHeaders.length; i += 2) {
          if (res.rawHeaders[i]!.toLowerCase() === "date") continue;
          headers.push(`${res.rawHeaders[i]!.toLowerCase()}: ${res.rawHeaders[i + 1]}`);
        }
        resolve({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks).toString("utf8") });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

/** Every frame a socket receives until it closes (or the wait runs out), as text or a byte count. */
function framesOf(ws: WebSocket, ms = 2_000): Promise<string[]> {
  return new Promise((resolve) => {
    const seen: string[] = [];
    const done = (): void => { clearTimeout(timer); resolve(seen); };
    const timer = setTimeout(done, ms);
    ws.binaryType = "arraybuffer";
    ws.onmessage = (e) => { seen.push(typeof e.data === "string" ? e.data : `<${(e.data as ArrayBuffer).byteLength} bytes>`); };
    ws.onclose = done;
    ws.onerror = done;
  });
}

const servers: Server[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) await new Promise<void>((r) => s.close(() => r()));
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

async function listen(server: Server): Promise<string> {
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

describe("the flow face keeps silence", () => {
  test("every HTTP path under the flow is the closed door; only a presenter the floor gate sorts reads the map", async () => {
    const server = createServer();
    const dispatcher = mountHttpFaceDispatcher(server);
    const storageDir = mkdtempSync(join(tmpdir(), "flow-door-")); dirs.push(storageDir);
    const repo = new Repo({ sharePolicy: async () => true });
    const handle = repo.create<{ tiddlers: Record<string, unknown> }>({ tiddlers: { held: { text: "the map" } } });
    const rig = floorGates(["nexus-a.synthetic"], { posture: "open" });
    const face = await mountFlowReadFace({
      httpServer: server, oracleHandle: handle, signer: placeSignerFromSeed(SEED), storageDir, gates: rig.gates, dispatcher, exportSnapshot: (doc) => exportFlowSnapshot(doc as never),
    });
    const origin = await listen(server);
    const w = rig.worlds[0]!;

    // CONTROL: a presenter the gate sorts reads the published pointer and the snapshot it names.
    const proven = await pullFloor(origin, w, await presenter(w, "reader"), { arm: null, publisherSeed: SEED });
    expect(proven.ok, proven.reason).toBe(true);
    const cid = proven.cid!;

    // CONTROL: the unclaimed path draws the one spelled door.
    const control = await ask(origin, "/no-face-claims-this");
    expect(control.status).toBe(CLOSED_DOOR.status);
    expect(control.body).toBe(CLOSED_DOOR.body);

    const probes: Array<[string, string]> = [
      ["/flow/pointer",                "GET"],     // the pointer the face publishes
      [`/flow/${cid}.bin`,             "GET"],     // the snapshot the face holds
      ["/flow/pointer",                "POST"],    // a wrong method
      ["/flow/pointer",                "OPTIONS"], // a preflight
      [`/flow/${"0".repeat(64)}.bin`,  "GET"],     // a cid the face never held
      [FLOW_SOCKET_ROUTE,              "GET"],     // the socket path, asked as a page
      [gatePath(w.pin),                  "GET"],     // the gate's own knock path, asked as a page
    ];
    for (const [path, method] of probes) {
      expect(await ask(origin, path, method), `${method} ${path}`).toEqual(control);
    }

    // A STRANGER without the knock reaches no socket at all: the bare route draws no upgrade, so no frame.
    const bare = new WebSocket(`${origin.replace("http", "ws")}${FLOW_SOCKET_ROUTE}`);
    expect(await framesOf(bare)).toEqual([]);
    // One WITH the knock that sends no honest first flight hears NOTHING: no opening, no refusal, no map frame.
    const knocker = new WebSocket(`${origin.replace("http", "ws")}${gatePath(w.pin)}`);
    knocker.binaryType = "arraybuffer";
    knocker.onopen = () => knocker.send(new Uint8Array(48).fill(7));
    expect(await framesOf(knocker, 4_000)).toEqual([]);

    face.dispose();
    dispatcher.dispose();
    await repo.shutdown();
  }, 30_000);

  test("RED: under PRIVATE a presenter with no arm reads nothing from the flow socket; CONTROL: its admit reads the map", async () => {
    const server = createServer();
    const dispatcher = mountHttpFaceDispatcher(server);
    const storageDir = mkdtempSync(join(tmpdir(), "flow-private-")); dirs.push(storageDir);
    const repo = new Repo({ sharePolicy: async () => true });
    const handle = repo.create<{ tiddlers: Record<string, unknown> }>({ tiddlers: { held: { text: "the map" } } });
    const rig = floorGates(["nexus-a.synthetic"]);            // a PRIVATE Nexus: the world's default posture
    const face = await mountFlowReadFace({ httpServer: server, oracleHandle: handle, signer: placeSignerFromSeed(SEED), storageDir, gates: rig.gates, dispatcher, exportSnapshot: (doc) => exportFlowSnapshot(doc as never) });
    const origin = await listen(server);
    const w = rig.worlds[0]!;
    const p = await presenter(w, "reader");

    const stranger = await pullFloor(origin, w, p, { arm: null, publisherSeed: SEED });
    expect(stranger.ok).toBe(false);
    expect(stranger.reason).toMatch(/silence|said nothing/);
    expect(stranger.pointer).toBeUndefined();

    const admitted = await pullFloor(origin, w, p, { publisherSeed: SEED });
    expect(admitted.ok, admitted.reason).toBe(true);

    face.dispose();
    dispatcher.dispose();
    await repo.shutdown();
  }, 30_000);

  test("/api/health on a herm is the closed door; on a lararium it answers", async () => {
    const hermServer = createServer();
    const hermDispatcher = mountHttpFaceDispatcher(hermServer);
    const herm = mountReadinessFace({ httpServer: hermServer, state: createReadinessState(), standing: "herm", dispatcher: hermDispatcher });
    const hermOrigin = await listen(hermServer);
    const control = await ask(hermOrigin, "/no-face-claims-this");
    expect(await ask(hermOrigin, "/api/health")).toEqual(control);
    expect(await ask(hermOrigin, "/api/health", "HEAD")).toEqual(await ask(hermOrigin, "/no-face-claims-this", "HEAD"));

    // CONTROL: the same mount on a lararium answers its readiness.
    const houseServer = createServer();
    const houseDispatcher = mountHttpFaceDispatcher(houseServer);
    const house = mountReadinessFace({ httpServer: houseServer, state: createReadinessState(), standing: "lararium", dispatcher: houseDispatcher });
    const houseOrigin = await listen(houseServer);
    const health = await ask(houseOrigin, "/api/health");
    expect(health.status).toBe(503);
    expect(JSON.parse(health.body)).toEqual({ status: "starting" });

    herm.dispose(); house.dispose();
    hermDispatcher.dispose(); houseDispatcher.dispose();
  });
});
