/**
 * lar-ws-client-adapter.test.ts — V3 peer transport integration.
 *
 * Stands a raw WebSocket "gate" (no full daemon): it issues lar:challenge,
 * verifies the relayed proof with the REAL verifyAuthProof, answers lar:auth-ok,
 * then watches for the Automerge join frame. The LarWSClientAdapter drives the
 * peer half with a light leaf identity (real Ed25519 keypair + ed25519SignerFromSeed).
 *
 * This exercises V3 C end to end at the wire: open socket → runPeerHandshake (JSON)
 * → gate verifies the gate-bound proof → auth-ok → hand the SAME socket to Automerge
 * (the binary join frame proves the handoff). No TW5/keyhive daemon required.
 *
 * The wire LarAuthMsg carries no peerPubKey (a real gate derives it from the
 * ContactCard via keyhive.receiveContactCard); the mock gate has no keyhive, so the
 * test passes the leaf's known verifying key to the gate out of band — standing in
 * for that derivation.
 */

import { describe, test, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { randomBytes, generateKeyPairSync } from "node:crypto";
import { WebSocketServer, type WebSocket as WsSocket } from "ws";
import {
  verifyAuthProof, ed25519SignerFromSeed, authOkBytes, knockPath,
  mkLarChallenge, mkLarAuthOk, isLarAuthMsg,
} from "@lararium/mesh";
import type { PeerId } from "@automerge/automerge-repo";
import { LarWSClientAdapter } from "@lararium/mesh";
import type { LeafIdentity } from "../src/leaf-identity.js";

const AUD = "lar:///ha.ka.ba/bags/daemon";

// Generate an Ed25519 keypair via node:crypto (the node-vessel-identity pattern): returns
// the raw 32-byte seed (for ed25519SignerFromSeed) + the verifying-key hex.
function genKey(): { seed: Uint8Array; pub: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pub  = Buffer.from((publicKey.export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
  const seed = new Uint8Array(Buffer.from((privateKey.export({ format: "jwk" }) as { d: string }).d, "base64url"));
  SEED_OF.set(pub, seed);
  return { seed, pub };
}
const SEED_OF = new Map<string, Uint8Array>();
/** The gate's verdict, signed by the gate's own key over this exchange — the only pass a leaf reads. */
async function signedOk(gatePubKey: string, nonce: string, leafNonce: string, peerPubKey: string) {
  return mkLarAuthOk(await ed25519SignerFromSeed(SEED_OF.get(gatePubKey)!)(authOkBytes({ nonce, leafNonce, gatePubKey, peerPubKey, aud: AUD })));
}

interface GateProbe {
  port:        number;
  /** The upgrade path the leaf dialed. */
  dialedPath:  Promise<string>;
  authVerdict: Promise<{ ok: boolean; reason?: string }>;
  handoffSeen: Promise<boolean>;
  close:       () => Promise<void>;
}

// A raw WS gate: challenge → verify the relayed proof against the gate's OWN key
// and the leaf's known key → auth-ok|denied, then await the Automerge join (binary).
function makeGate(opts: { gatePubKey: string; peerPubKey: string; accept?: boolean }): Promise<GateProbe> {
  const accept = opts.accept ?? true;
  return new Promise((resolve) => {
    const http: Server = createServer();
    const wss = new WebSocketServer({ server: http });
    let resolveAuth!: (v: { ok: boolean; reason?: string }) => void;
    let resolveHandoff!: (v: boolean) => void;
    let resolvePath!: (v: string) => void;
    const dialedPath = new Promise<string>((r) => { resolvePath = r; });
    const authVerdict = new Promise<{ ok: boolean; reason?: string }>((r) => { resolveAuth = r; });
    const handoffSeen = new Promise<boolean>((r) => { resolveHandoff = r; });

    wss.on("connection", (ws: WsSocket, req: { url?: string }) => {
      resolvePath(req.url ?? "");
      const nonce = randomBytes(32).toString("hex");
      ws.send(JSON.stringify(mkLarChallenge(nonce)));
      ws.on("message", (data: Buffer, isBinary: boolean) => {
        if (isBinary) { resolveHandoff(true); return; } // the Automerge join — handoff happened
        let parsed: unknown;
        try { parsed = JSON.parse(data.toString("utf8")); } catch { return; }
        if (!isLarAuthMsg(parsed)) return;
        void verifyAuthProof({
          nonce, gatePubKey: opts.gatePubKey, peerPubKey: opts.peerPubKey,
          aud: AUD, sig: parsed.sig,
        }).then(async (v) => {
          resolveAuth(v);
          if (accept && v.ok) ws.send(JSON.stringify(await signedOk(opts.gatePubKey, nonce, parsed.leafNonce, opts.peerPubKey)));
          else ws.terminate();                                            // a refusal is silence, then the cut
        });
      });
    });

    http.listen(0, "127.0.0.1", () => {
      const addr = http.address();
      if (!addr || typeof addr === "string") throw new Error("bad address");
      resolve({
        port: addr.port, authVerdict, handoffSeen, dialedPath,
        close: () => new Promise<void>((res) => wss.close(() => http.close(() => res()))),
      });
    });
  });
}

function makeLeaf(): { identity: LeafIdentity; pub: string } {
  const { seed, pub } = genKey();
  return {
    pub,
    identity: { contactCard: JSON.stringify({ peerPubKey: pub }), peerPubKey: pub, sign: ed25519SignerFromSeed(seed) },
  };
}

describe("LarWSClientAdapter — V3 peer transport handshake", () => {
  let gate: GateProbe | null = null;
  let adapter: LarWSClientAdapter | null = null;

  afterEach(async () => {
    try { adapter?.disconnect(); } catch { /* not connected */ }
    adapter = null;
    await gate?.close();
    gate = null;
  });

  test("opens socket → signs gate-bound proof → auth-ok → hands off to Automerge", async () => {
    const gatePub = genKey().pub;
    const { identity, pub } = makeLeaf();
    gate = await makeGate({ gatePubKey: gatePub, peerPubKey: pub, accept: true });

    adapter = new LarWSClientAdapter({
      url: `ws://127.0.0.1:${gate.port}`, identity, aud: AUD, gatePubKey: gatePub,
    });
    adapter.connect("smoke-peer" as PeerId);

    expect((await gate.authVerdict).ok).toBe(true);
    expect(await gate.handoffSeen).toBe(true); // the Automerge join arrived post-auth
    expect(await gate.dialedPath).toBe(knockPath(gatePub, "/"));   // the leaf dialed the knock its pin derives
  });

  test("a denied auth never reaches the Automerge handoff", async () => {
    const gatePub = genKey().pub;
    const { identity, pub } = makeLeaf();
    gate = await makeGate({ gatePubKey: gatePub, peerPubKey: pub, accept: false });

    adapter = new LarWSClientAdapter({
      url: `ws://127.0.0.1:${gate.port}`, identity, aud: AUD, gatePubKey: gatePub,
    });
    adapter.connect("smoke-peer" as PeerId);

    await gate.authVerdict; // a genuine proof verified ok, but the gate replies denied
    const handoff = await Promise.race([
      gate.handoffSeen,
      new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 300)),
    ]);
    expect(handoff).toBe("timeout"); // no Automerge join after a denial
  });
});

// ── RE-PRESENTATION AFTER ANERGY — a new identity restores the reconnect loop, not one dial ───────────────────
// The gate below scripts each connection by its ordinal: deny, accept, and drop the accepted socket once after
// the Automerge handoff. It counts every socket the adapter opens, so a dial that never comes reads as a count
// that never moves.

interface ScriptedGate {
  port:        number;
  connections: () => number;
  /** Resolves once the gate has seen `n` connections, or with false after `ms`. */
  until:       (n: number, ms: number) => Promise<boolean>;
  close:       () => Promise<void>;
}

function makeScriptedGate(opts: {
  gatePubKey: string;
  accept:     (ordinal: number) => boolean;
  dropAfterHandoff: (ordinal: number) => boolean;
}): Promise<ScriptedGate> {
  return new Promise((resolve) => {
    const http: Server = createServer();
    const wss = new WebSocketServer({ server: http });
    let count = 0;
    const waiters: Array<{ n: number; done: (v: boolean) => void }> = [];
    wss.on("connection", (ws: WsSocket) => {
      count += 1;
      const ordinal = count;
      for (const w of waiters.splice(0)) { if (count >= w.n) w.done(true); else waiters.push(w); }
      const nonce = randomBytes(32).toString("hex");
      ws.send(JSON.stringify(mkLarChallenge(nonce)));
      let dropped = false;
      ws.on("message", (data: Buffer, isBinary: boolean) => {
        if (isBinary) {
          if (!dropped && opts.dropAfterHandoff(ordinal)) { dropped = true; ws.close(1001, "gate drops the socket once"); }
          return;
        }
        let parsed: unknown;
        try { parsed = JSON.parse(data.toString("utf8")); } catch { return; }
        if (!isLarAuthMsg(parsed)) return;
        const auth = parsed;
        if (!opts.accept(ordinal)) { ws.terminate(); return; }          // a refusal is silence, then the cut
        const peerPubKey = (JSON.parse(auth.contactCard) as { peerPubKey: string }).peerPubKey;
        void signedOk(opts.gatePubKey, nonce, auth.leafNonce, peerPubKey).then((ok) => ws.send(JSON.stringify(ok)));
      });
    });
    http.listen(0, "127.0.0.1", () => {
      const addr = http.address();
      if (!addr || typeof addr === "string") throw new Error("bad address");
      resolve({
        port: addr.port,
        connections: () => count,
        until: (n, ms) => count >= n ? Promise.resolve(true) : new Promise<boolean>((done) => {
          const w = { n, done };
          waiters.push(w);
          setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) waiters.splice(i, 1); done(false); }, ms);
        }),
        close: () => new Promise<void>((res) => {
          for (const c of wss.clients) c.terminate();
          wss.close(() => http.close(() => res()));
        }),
      });
    });
  });
}

describe("LarWSClientAdapter — re-presentation after anergy restores the reconnect loop", () => {
  let gate: ScriptedGate | null = null;
  let adapter: LarWSClientAdapter | null = null;
  const RETRY_MS = 50;

  afterEach(async () => {
    try { adapter?.disconnect(); } catch { /* not connected */ }
    adapter = null;
    await gate?.close();
    gate = null;
  });

  test("★ anergize, re-present with a new identity, the gate drops the socket once → the adapter re-dials on its own ★", async () => {
    const gatePub = genKey().pub;
    gate = await makeScriptedGate({ gatePubKey: gatePub, accept: (n) => n >= 2, dropAfterHandoff: (n) => n === 2 });
    const first = makeLeaf();
    adapter = new LarWSClientAdapter({
      url: `ws://127.0.0.1:${gate.port}`, identity: first.identity, aud: AUD, gatePubKey: gatePub, retryInterval: RETRY_MS,
    });
    adapter.connect("anergy-peer" as PeerId);
    // ① denied → ANERGIZED, and the door stays shut across several retry intervals.
    const anergized = await (async () => {
      for (let i = 0; i < 100 && !adapter!.anergized; i++) await new Promise((r) => setTimeout(r, 10));
      return adapter!.anergized;
    })();
    expect(anergized).toBe("no answer");
    // ② re-present under a new identity (a presentable admit appeared) → the second socket, accepted.
    adapter.represent(makeLeaf().identity);
    expect(await gate.until(2, 2_000)).toBe(true);
    expect(adapter.anergized).toBeNull();
    // ③ the gate drops that socket once; the parent's reconnect path dials a third socket with no further call.
    expect(await gate.until(3, 2_000)).toBe(true);
  });

  test("CONTROL: an anergized adapter given NO new identity stays down", async () => {
    const gatePub = genKey().pub;
    gate = await makeScriptedGate({ gatePubKey: gatePub, accept: () => false, dropAfterHandoff: () => false });
    const leaf = makeLeaf();
    adapter = new LarWSClientAdapter({
      url: `ws://127.0.0.1:${gate.port}`, identity: leaf.identity, aud: AUD, gatePubKey: gatePub, retryInterval: RETRY_MS,
    });
    adapter.connect("anergy-peer" as PeerId);
    expect(await gate.until(2, RETRY_MS * 12)).toBe(false);                  // a dozen retry intervals, one socket
    expect(gate.connections()).toBe(1);
    expect(adapter.anergized).toBe("no answer");
  });

  test("CONTROL: a socket cut BEFORE any challenge is a transport fault — the adapter re-dials and never anergizes", async () => {
    const http: Server = createServer();
    const wss = new WebSocketServer({ server: http });
    let count = 0;
    wss.on("connection", (ws: WsSocket) => { count += 1; ws.terminate(); });       // a gate not yet armed: no challenge
    await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
    const port = (http.address() as { port: number }).port;
    const gatePub = genKey().pub;
    adapter = new LarWSClientAdapter({ url: `ws://127.0.0.1:${port}`, identity: makeLeaf().identity, aud: AUD, gatePubKey: gatePub, retryInterval: RETRY_MS });
    adapter.connect("transport-peer" as PeerId);
    for (let i = 0; i < 200 && count < 3; i++) await new Promise((r) => setTimeout(r, 10));
    expect(count).toBeGreaterThanOrEqual(3);
    expect(adapter.anergized).toBeNull();
    adapter.disconnect();
    adapter = null;
    for (const c of wss.clients) c.terminate();
    await new Promise<void>((r) => wss.close(() => http.close(() => r())));
  });
});
