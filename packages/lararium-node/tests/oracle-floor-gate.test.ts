/**
 * oracle-floor-gate — the oracle read face's server half on the floor gate (the oracle converts where browser boot
 * reads it: "Routes at the cutover"). A reader dials the floor gate its pair index pins at (hearth, Nexus, "/oracle",
 * "floor") through the house's one dialer (`pullAndVerifyOracle`), and the face answers over the sealed channel:
 * one "session" message carrying the signed pointer frame, then the snapshot bytes, and no auth verb of its own.
 *
 * Proven, each with its control:
 *   · serve → pull round-trips over a live socket, and the disclosure shore holds at the wire: the public dial
 *     crosses, the vessel-local one stays home;
 *   · RED: at a PRIVATE gate a presenter with no arm reads nothing / CONTROL: the same presenter with its admit reads
 *     the map, and at an OPEN gate the bare presenter reads it too;
 *   · RED: a reader that pins the publisher's key wrong reads the pointer refused / CONTROL: the right key reads it;
 *   · the face stands one gate per Nexus it is handed, each on its own knock under the oracle route, and a dispose
 *     stands every gate down, closes the open sessions and leaves no upgrade claimed;
 *   · a session the face served closes once the reader closes, or once the linger lapses.
 */
import { afterEach, describe, expect, test } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import WsSocket from "ws";
import {
  pullAndVerifyOracle, dialEntryToRecord, ed25519VerifyingKeyFromSeed, dialFaceGate, dialedChannel, ORACLE_SOCKET_ROUTE,
  type MeshPalaceDoc,
} from "@lararium/mesh";
import { wsDialSocket, type WsLike } from "../../lararium-mesh/src/ws-dial-socket.js";
import { mountFlowMapReadFace, type OracleFloorFace } from "../src/oracle-read-face.js";
import { gatePath } from "../src/face-gate-server.js";
import { world, presenter, handDeadlines, AUDIENCE, type World, type Presenter } from "../../lararium-mesh/tests/face-gate-fixture.js";

const SEED = new Uint8Array(32).fill(7);
const OTHER = new Uint8Array(32).fill(8);

const opened: Array<{ server: Server; face: OracleFloorFace | null; dir: string }> = [];
afterEach(async () => {
  for (const o of opened.splice(0)) {
    o.face?.dispose();
    await new Promise<void>((r) => o.server.close(() => r()));
    rmSync(o.dir, { recursive: true, force: true });
  }
});

function palace() {
  const repo = new Repo({ sharePolicy: async () => true });
  const pub = dialEntryToRecord({ bearing: "lar:///ha.ka.ba/bags/oracle", verifyingKeyHex: "a".repeat(64), endpoint: "ws://relay/p", scale: "dreamnet" }, "test");
  const loc = dialEntryToRecord({ bearing: "lar:///ha.ka.ba/bags/daemon", verifyingKeyHex: "b".repeat(64), endpoint: "ws://local/q" }, "test");
  const handle = repo.create<MeshPalaceDoc>({ schemaVersion: "0.1", tiddlers: { [pub.tiddler.title]: pub, [loc.tiddler.title]: loc } });
  return { handle, pub: pub.tiddler.title, loc: loc.tiddler.title };
}

/** Stand the face over `nexuses` floor gates on a live server; each gate's world comes back for its pin and posture. */
async function stand(nexuses: readonly string[], opts: { lingerMs?: number } = {}) {
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const dir = mkdtempSync(join(tmpdir(), "oracle-floor-"));
  const { handle, pub, loc } = palace();
  const worlds: World[] = [];
  const entry: { server: Server; face: OracleFloorFace | null; dir: string } = { server, face: null, dir };
  opened.push(entry);
  const face = await mountFlowMapReadFace({
    httpServer: server, meshPalaceHandle: handle, signerSeed: SEED, storageDir: dir,
    ...(opts.lingerMs !== undefined ? { lingerMs: opts.lingerMs } : {}),
    gates: async (sessions) => {
      for (const nexus of nexuses) worlds.push(await world({ nexus, tier: "floor", route: ORACLE_SOCKET_ROUTE, sessions }));
      return worlds.map((w) => ({ gate: w.gate, pin: w.pin }));
    },
  });
  entry.face = face;
  return { face, worlds, base: `http://127.0.0.1:${port}`, pub, loc, server };
}

const dialer = (url: string) => wsDialSocket(url, (u, protocols) => new WsSocket(u, protocols, { perMessageDeflate: false }) as unknown as WsLike);

async function pull(base: string, w: World, p: Presenter, over: { arm?: Presenter["arm"] | null; seed?: Uint8Array } = {}) {
  return pullAndVerifyOracle<MeshPalaceDoc>(base, {
    pins: { get: (key) => (key.route === ORACLE_SOCKET_ROUTE && key.tier === "floor" && key.nexus === w.pin.nexus ? w.pin : null) },
    hearth: "hearth-one", nexus: w.pin.nexus,
    presentation: { certificate: p.certificate, signer: p.signer, arm: over.arm === undefined ? p.arm : over.arm, history: p.history },
    audience: AUDIENCE, deadlines: realDeadlines(), verifyingKey: await ed25519VerifyingKeyFromSeed(over.seed ?? SEED), dialSocket: dialer,
  });
}

/** A dialer's deadlines on the process clock: a lapse well past any honest answer. */
function realDeadlines() {
  return { draw(lapse: () => void) { const t = setTimeout(lapse, 2_000); return { cancel: () => clearTimeout(t) }; } };
}

describe("the oracle read face on the floor gate", () => {
  test("serve → pull round-trips over a live socket, and the shore holds at the wire", async () => {
    const s = await stand(["nexus-a.synthetic"]);
    const w = s.worlds[0]!;
    const verdict = await pull(s.base, w, await presenter(w, "reader"));
    expect(verdict.reason).toBeUndefined();
    expect(verdict.ok).toBe(true);
    const titles = Object.keys(verdict.doc?.tiddlers ?? {});
    expect(titles).toContain(s.pub);
    expect(titles).not.toContain(s.loc);
  });

  test("RED: a PRIVATE gate answers a bare presenter nothing; CONTROL: its admit reads, and an OPEN gate answers it bare", async () => {
    const s = await stand(["nexus-a.synthetic"]);
    const w = s.worlds[0]!;
    const p = await presenter(w, "reader");
    const bare = await pull(s.base, w, p, { arm: null });
    expect(bare.ok).toBe(false);
    expect(bare.reason).toMatch(/silence|said nothing/);
    expect((await pull(s.base, w, p)).ok).toBe(true);
    w.posture = "open";
    expect((await pull(s.base, w, p, { arm: null })).ok).toBe(true);
  });

  test("RED: a reader that pins another publisher reads the pointer refused; CONTROL: the right key reads it", async () => {
    const s = await stand(["nexus-a.synthetic"]);
    const w = s.worlds[0]!;
    const p = await presenter(w, "reader");
    const wrong = await pull(s.base, w, p, { seed: OTHER });
    expect(wrong.ok).toBe(false);
    expect(wrong.reason).toMatch(/^pointer rejected/);
    expect((await pull(s.base, w, p)).ok).toBe(true);
  });

  test("one gate per Nexus, each on its own knock; a dispose stands them all down and claims no upgrade", async () => {
    const s = await stand(["nexus-a.synthetic", "nexus-b.synthetic"]);
    const [a, b] = s.worlds as [World, World];
    expect(gatePath(a.pin)).not.toBe(gatePath(b.pin));
    expect(gatePath(a.pin).startsWith(`${ORACLE_SOCKET_ROUTE}/`)).toBe(true);
    expect((await pull(s.base, a, await presenter(a, "reader a"))).ok).toBe(true);
    expect((await pull(s.base, b, await presenter(b, "reader b"))).ok).toBe(true);
    expect(s.server.listenerCount("upgrade")).toBe(1);
    expect([...s.face.paths()].sort()).toEqual([gatePath(a.pin), gatePath(b.pin)].sort());
    s.face.dispose();
    expect(s.server.listenerCount("upgrade")).toBe(0);
    expect(s.face.paths()).toEqual([]);
    const after = await pull(s.base, a, await presenter(a, "reader late"));
    expect(after.ok).toBe(false);
  });

  test("a served session closes once the linger lapses, though the reader never closes", async () => {
    const s = await stand(["nexus-a.synthetic"], { lingerMs: 50 });
    const w = s.worlds[0]!;
    const p = await presenter(w, "reader");
    // Dial by hand and never close: the face closes the session itself.
    const socket = dialer(`${s.base.replace("http", "ws")}${ORACLE_SOCKET_ROUTE}`);
    const outcome = await dialFaceGate({ pin: w.pin, tier: "floor", socket, audience: AUDIENCE, certificate: p.certificate, signer: p.signer, arm: p.arm, history: p.history, deadlines: handDeadlines() });
    if (outcome.state !== "verified") throw new Error(`the dial came to ${outcome.state}`);
    const channel = dialedChannel({ transport: outcome.transport, socket: { send: (f) => socket.send(f), recv: () => socket.recv(), cut: () => socket.close() } });
    expect((await channel.recv())?.kind).toBe("session");
    expect((await channel.recv())?.kind).toBe("sync");
    expect(await channel.recv()).toBeNull();                    // the face closed: the lapse, not the reader
  });
});
