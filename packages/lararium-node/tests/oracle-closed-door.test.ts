/**
 * oracle-closed-door.test.ts — the herm oracle keeps silence (pronaos#/the-rung-ladder).
 *
 * The oracle face is no HTTP face: every HTTP path under it — the pointer it publishes, the snapshot it holds,
 * any method, any shape — draws THE closed door, byte for byte the answer a path no face claims draws. The
 * map crosses only the gated oracle socket, to a dialer that proved its key; a stranger who opens the socket
 * and proves nothing receives no frame of it. `/api/health` binds on a lararium alone: on a herm it is the
 * same closed door.
 */
import { afterEach, describe, expect, test } from "vitest";
import { createServer, request, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { pullAndVerifyOracle, ORACLE_SOCKET_ROUTE, ORACLE_POINTER_FRAME, knockPath, ed25519VerifyingKeyFromSeed, verifyAuthProof } from "@lararium/mesh";
import type { AuthVerifierShore } from "@lararium/mesh";
import { CLOSED_DOOR } from "../src/bulb-routes.js";
import { mountHttpFaceDispatcher } from "../src/http-face-dispatcher.js";
import { mountOracleReadFace } from "../src/oracle-read-face.js";
import { createReadinessState, mountReadinessFace } from "../src/readiness-face.js";
import { provingShore, readerIdentity, openSorter, privateSorter } from "./oracle-proof-fixture.js";

const SEED   = new Uint8Array(32).fill(7);
const READER = new Uint8Array(32).fill(9);

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

describe("the oracle face keeps silence", () => {
  test("every HTTP path under the oracle is the closed door; only a proven dialer on the knock reads the map", async () => {
    const server = createServer();
    const dispatcher = mountHttpFaceDispatcher(server);
    const storageDir = mkdtempSync(join(tmpdir(), "oracle-door-")); dirs.push(storageDir);
    const repo = new Repo({ sharePolicy: async () => true });
    const handle = repo.create<{ tiddlers: Record<string, unknown> }>({ tiddlers: { held: { text: "the map" } } });
    const face = await mountOracleReadFace({
      httpServer: server, oracleHandle: handle, signerSeed: SEED, storageDir, authShore: await provingShore(SEED), sort: openSorter, dispatcher,
    });
    const origin = await listen(server);
    const pin = await ed25519VerifyingKeyFromSeed(SEED);

    // CONTROL: a proven dialer reads the published pointer and the snapshot it names.
    const proven = await pullAndVerifyOracle(origin, { identity: await readerIdentity(READER), verifyingKey: pin });
    expect(proven.ok, proven.reason).toBe(true);
    const cid = proven.cid!;

    // CONTROL: the unclaimed path draws the one spelled door.
    const control = await ask(origin, "/no-face-claims-this");
    expect(control.status).toBe(CLOSED_DOOR.status);
    expect(control.body).toBe(CLOSED_DOOR.body);

    const probes: Array<[string, string]> = [
      ["/oracle/pointer",                "GET"],     // the pointer the face publishes
      [`/oracle/${cid}.bin`,             "GET"],     // the snapshot the face holds
      ["/oracle/pointer",                "POST"],    // a wrong method
      ["/oracle/pointer",                "OPTIONS"], // a preflight
      [`/oracle/${"0".repeat(64)}.bin`,  "GET"],     // a cid the face never held
      [ORACLE_SOCKET_ROUTE,              "GET"],     // the socket path, asked as a page
    ];
    for (const [path, method] of probes) {
      expect(await ask(origin, path, method), `${method} ${path}`).toEqual(control);
    }

    // A STRANGER without the knock reaches no socket at all: the bare route draws no upgrade, so no frame.
    const bare = new WebSocket(`${origin.replace("http", "ws")}${ORACLE_SOCKET_ROUTE}`);
    expect(await framesOf(bare)).toEqual([]);
    // One WITH the knock that proves nothing hears the challenge and then nothing: no refusal, no map frame.
    const knocker = new WebSocket(`${origin.replace("http", "ws")}${knockPath(pin, ORACLE_SOCKET_ROUTE)}`);
    knocker.onopen = () => knocker.send(JSON.stringify({ type: "lar:auth", contactCard: "x", nonce: "wrong" }));
    const knockerFrames = await framesOf(knocker, 12_000);
    expect(knockerFrames).toHaveLength(1);
    expect(knockerFrames[0]).toContain("lar:challenge");

    // A dialer whose proof does not hold its claimed key reads nothing either.
    const forged = { ...(await readerIdentity(READER)), sign: (await readerIdentity(SEED)).sign };
    const refused = await pullAndVerifyOracle(origin, { identity: forged, verifyingKey: pin });
    expect(refused.ok).toBe(false);
    expect(refused.pointer).toBeUndefined();

    face.dispose();
    dispatcher.dispose();
    await repo.shutdown();
  }, 30_000);

  test("RED: under PRIVATE a proven stranger reads no frame from the oracle socket; CONTROL: the operator's own key reads the map", async () => {
    const server = createServer();
    const dispatcher = mountHttpFaceDispatcher(server);
    const storageDir = mkdtempSync(join(tmpdir(), "oracle-private-")); dirs.push(storageDir);
    const repo = new Repo({ sharePolicy: async () => true });
    const handle = repo.create<{ tiddlers: Record<string, unknown> }>({ tiddlers: { held: { text: "the map" } } });
    const pin = await ed25519VerifyingKeyFromSeed(SEED);
    const OWN = new Uint8Array(32).fill(23);
    const ownKey = await ed25519VerifyingKeyFromSeed(OWN);
    // The worker's floor: every proof checked; the operator's own key is vouched same-operator, nothing else.
    const shore: AuthVerifierShore = {
      verify: async (cardBytes, bagUrl, _access, proof) => {
        const peerPubKey = new TextDecoder().decode(cardBytes);
        if (!proof) return { ok: false, reason: "V3 proof required" };
        const v = await verifyAuthProof({ nonce: proof.nonce, gatePubKey: pin, peerPubKey, aud: bagUrl, sig: proof.sig });
        if (!v.ok) return { ok: false };
        return { ok: true, identifier: peerPubKey, proofVerified: true, ...(peerPubKey === ownKey ? { peerClass: "same-operator" as const } : {}) };
      },
    };
    const face = await mountOracleReadFace({ httpServer: server, oracleHandle: handle, signerSeed: SEED, storageDir, authShore: shore, sort: privateSorter, dispatcher });
    const origin = await listen(server);

    const stranger = await pullAndVerifyOracle(origin, { identity: await readerIdentity(READER), verifyingKey: pin, frameTimeoutMs: 12_000 });
    expect(stranger.ok).toBe(false);
    expect(stranger.reason).toBe("gate refused: no answer");
    expect(stranger.pointer).toBeUndefined();

    const own = await pullAndVerifyOracle(origin, { identity: await readerIdentity(OWN), verifyingKey: pin });
    expect(own.ok, own.reason).toBe(true);

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
