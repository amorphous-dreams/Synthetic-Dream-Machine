/**
 * daemon-auth-gate.test.ts — Path L auth gate smoke tests.
 *
 * Tests the pre-Automerge lar:challenge / lar:auth / lar:auth-ok wire exchange
 * using a real WebSocket server, raw WebSocket client connections, and a stub
 * AuthVerifierShore. No Automerge-repo, no TW5, no filesystem.
 *
 * Post Stage 1 the host holds no keyhive — the gate arms with an AuthVerifierShore
 * that proxies to the daemon island, which does receiveContactCard + verify
 * in-worker and returns the verdict plus the peer's Identifier hex.
 *
 * Gate: lar:///ha.ka.ba/lararium/node/daemon-auth-gate
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createServer }                               from "node:http";
import { WebSocketServer, WebSocket }                 from "ws";
import { DaemonAuthGate, type GateKey }              from "../src/daemon-auth-gate.js";
import type { AuthVerifierShore, AuthProofWire }       from "@lararium/mesh";
import {
  isLarChallengeMsg, isLarAuthOkMsg, isLarAuthDeniedMsg,
  mkLarAuth, verifyAuthOk, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed,
} from "@lararium/mesh";

// The gate's own key — the verifying key it advertises and the signer of every verdict.
const AUD        = "lar:///ha.ka.ba/bags/daemon";
const GATE_SEED  = new Uint8Array(32).fill(61);
const GATE: GateKey = { pubKey: await ed25519VerifyingKeyFromSeed(GATE_SEED), sign: ed25519SignerFromSeed(GATE_SEED) };
// The leaf's own fresh nonce, which a signed verdict commits to.
const LEAF_NONCE = "ef".repeat(32);

// ── Stub AuthVerifierShore ─────────────────────────────────────────────────────

type StubVerifyResult = { ok: true; peerClass?: "same-operator" | "cross-operator" } | { ok: false; reason: string };

// Mirrors the daemon island's verify-proxy: an `ok` verdict carries the peer's
// Identifier hex (receiveContactCard's id), which the gate keys its sharePolicy
// map on, PLUS the self-slot PeerClass the keyholder vouches; a denial carries
// only the reason.
function makeStubShore(opts: {
  receiveResult: { id: string };
  verifyResult:  StubVerifyResult;
}): AuthVerifierShore {
  return {
    async verify() {
      return opts.verifyResult.ok
        ? { ok: true, identifier: opts.receiveResult.id, ...(opts.verifyResult.peerClass ? { peerClass: opts.verifyResult.peerClass } : {}) }
        : { ok: false, reason: opts.verifyResult.reason };
    },
  };
}

// Capturing shore — records the proof + access the gate relays, so we can assert
// the V3 plumbing (gate forwards {nonce, sig, ts} to the keyholder worker).
function makeCapturingShore(id = "0xaabbcc"): {
  shore: AuthVerifierShore;
  calls: Array<{ bagUrl: string; access: string; proof?: AuthProofWire; edge?: unknown }>;
} {
  const calls: Array<{ bagUrl: string; access: string; proof?: AuthProofWire; edge?: unknown }> = [];
  return {
    calls,
    shore: {
      async verify(_cardBytes, bagUrl, access, proof, edge) {
        calls.push({ bagUrl, access, ...(proof ? { proof } : {}), ...(edge ? { edge } : {}) });
        return { ok: true, identifier: id };
      },
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeServer(): Promise<{ wss: WebSocketServer; port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const http = createServer();
    const wss  = new WebSocketServer({ server: http });
    http.listen(0, "127.0.0.1", () => {
      const addr = http.address();
      if (!addr || typeof addr === "string") { reject(new Error("bad address")); return; }
      resolve({
        wss,
        port: addr.port,
        close: () => new Promise<void>((res) => {
          wss.close(() => http.close(() => res()));
        }),
      });
    });
  });
}

// BufferedSocket wraps a WebSocket and eagerly buffers every incoming message
// from the moment of connection. On loopback the server can send the challenge
// in the same TCP segment as the HTTP 101 upgrade, so a plain `ws.once("message")`
// registered after `await connect()` would miss it. The buffer drains on each
// `nextMessage()` call, preserving delivery order.
class BufferedSocket {
  readonly ws: WebSocket;
  private readonly _buf: unknown[] = [];
  private readonly _waiters: Array<(v: unknown) => void> = [];

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on("message", (data: Buffer | string) => {
      const msg = JSON.parse(data.toString());
      const waiter = this._waiters.shift();
      if (waiter) { waiter(msg); }
      else        { this._buf.push(msg); }
    });
  }

  nextMessage(): Promise<unknown> {
    if (this._buf.length > 0) return Promise.resolve(this._buf.shift()!);
    return new Promise((res) => this._waiters.push(res));
  }

  send(data: string): void { this.ws.send(data); }
  close(): void { this.ws.close(); }
  terminate(): void { (this.ws as unknown as { terminate(): void }).terminate(); }

  once(event: "close", handler: (code: number, reason: Buffer) => void): void {
    this.ws.once(event as "close", handler);
  }
}

function connect(port: number): Promise<BufferedSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const buf = new BufferedSocket(ws);
    ws.once("open",  () => resolve(buf));
    ws.once("error", reject);
  });
}

function nextMessage(s: BufferedSocket): Promise<unknown> {
  return s.nextMessage();
}

function nextClose(s: BufferedSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    s.once("close", (code, reason) => resolve({ code, reason: reason.toString() }));
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DaemonAuthGate — pre-sync auth exchange", () => {
  let serverInfo: Awaited<ReturnType<typeof makeServer>>;
  let gate: DaemonAuthGate;

  beforeEach(async () => {
    serverInfo = await makeServer();
    gate = new DaemonAuthGate(serverInfo.wss);
  });

  afterEach(async () => {
    await serverInfo.close();
  });

  test("disarmed gate rejects connection with 4503", async () => {
    const ws = await connect(serverInfo.port);
    // Gate is not armed — no challenge is sent; socket closes immediately with 4503.
    const { code } = await nextClose(ws);
    expect(code).toBe(4503);
  });

  test("armed gate sends lar:challenge on connect", async () => {
    gate.arm(makeStubShore({
      receiveResult: { id: "0xaabbcc" },
      verifyResult:  { ok: true },
    }), AUD, GATE);

    const ws  = await connect(serverInfo.port);
    const msg = await nextMessage(ws);

    expect(isLarChallengeMsg(msg)).toBe(true);
    expect(typeof (msg as { nonce: string }).nonce).toBe("string");
    expect((msg as { nonce: string }).nonce).toHaveLength(64); // 32 bytes hex

    ws.close();
  });

  test("valid auth → lar:auth-ok; gate emits connection to adapter", async () => {
    const connectionSeen = new Promise<void>((resolve) => {
      gate.once("connection", () => resolve());
    });

    gate.arm(makeStubShore({
      receiveResult: { id: "0xaabbcc" },
      verifyResult:  { ok: true },
    }), AUD, GATE);

    const ws      = await connect(serverInfo.port);
    const chal    = await nextMessage(ws) as { nonce: string };
    expect(isLarChallengeMsg(chal)).toBe(true);

    ws.send(JSON.stringify(mkLarAuth("valid-card-json", chal.nonce, "stub-sig", LEAF_NONCE)));
    const response = await nextMessage(ws);
    expect(isLarAuthOkMsg(response)).toBe(true);

    await connectionSeen;

    // socket is in clients set after auth
    expect(gate.clients.size).toBe(1);

    ws.close();
  });

  test("a same-operator verdict surfaces via getClassForSocket (the self-slot signal reaches the sharePolicy)", async () => {
    const connectionSeen = new Promise<void>((resolve) => gate.once("connection", () => resolve()));
    gate.arm(makeStubShore({ receiveResult: { id: "0xaabbcc" }, verifyResult: { ok: true, peerClass: "same-operator" } }), AUD, GATE);

    const ws   = await connect(serverInfo.port);
    const chal = await nextMessage(ws) as { nonce: string };
    ws.send(JSON.stringify(mkLarAuth("valid-card-json", chal.nonce, "stub-sig", LEAF_NONCE)));
    await nextMessage(ws);          // auth-ok
    await connectionSeen;

    const admitted = [...gate.clients][0]!;
    expect(gate.getClassForSocket(admitted)).toBe("same-operator");
    ws.close();
  });

  test("a verdict with NO peerClass surfaces undefined (fail-closed → cross-operator at the sharePolicy)", async () => {
    const connectionSeen = new Promise<void>((resolve) => gate.once("connection", () => resolve()));
    gate.arm(makeStubShore({ receiveResult: { id: "0xaabbcc" }, verifyResult: { ok: true } }), AUD, GATE);

    const ws   = await connect(serverInfo.port);
    const chal = await nextMessage(ws) as { nonce: string };
    ws.send(JSON.stringify(mkLarAuth("valid-card-json", chal.nonce, "stub-sig", LEAF_NONCE)));
    await nextMessage(ws);          // auth-ok
    await connectionSeen;

    const admitted = [...gate.clients][0]!;
    expect(gate.getClassForSocket(admitted)).toBeUndefined();
    ws.close();
  });

  test("insufficient capability → lar:auth-denied + close(4003)", async () => {
    gate.arm(makeStubShore({
      receiveResult: { id: "0xaabbcc" },
      verifyResult:  { ok: false, reason: "no admin grant" },
    }), AUD, GATE);

    const ws    = await connect(serverInfo.port);
    const chal  = await nextMessage(ws) as { nonce: string };

    ws.send(JSON.stringify(mkLarAuth("card", chal.nonce, "sig", LEAF_NONCE)));

    const denied = await nextMessage(ws);
    expect(isLarAuthDeniedMsg(denied)).toBe(true);
    expect((denied as { reason: string }).reason).toContain("no admin grant");

    const { code } = await nextClose(ws);
    expect(code).toBe(4003);
  });

  test("wrong nonce → lar:auth-denied + close(4003)", async () => {
    gate.arm(makeStubShore({
      receiveResult: { id: "0xaabbcc" },
      verifyResult:  { ok: true },
    }), AUD, GATE);

    const ws = await connect(serverInfo.port);
    await nextMessage(ws); // consume challenge

    ws.send(JSON.stringify(mkLarAuth("card", "wrong-nonce", "sig", LEAF_NONCE)));

    const denied = await nextMessage(ws);
    expect(isLarAuthDeniedMsg(denied)).toBe(true);

    const { code } = await nextClose(ws);
    expect(code).toBe(4003);
  });

  test("sending non-auth message → lar:auth-denied + close(4003)", async () => {
    gate.arm(makeStubShore({
      receiveResult: { id: "0xaabbcc" },
      verifyResult:  { ok: true },
    }), AUD, GATE);

    const ws = await connect(serverInfo.port);
    await nextMessage(ws); // consume challenge

    ws.send(JSON.stringify({ type: "join", senderId: "peer-x" })); // automerge message

    const denied = await nextMessage(ws);
    expect(isLarAuthDeniedMsg(denied)).toBe(true);

    const { code } = await nextClose(ws);
    expect(code).toBe(4003);
  });

  test("V3: armed with a gatePubKey, the challenge advertises it (gate-binding)", async () => {
    const { shore } = makeCapturingShore();
    gate.arm(shore, AUD, GATE);

    const ws  = await connect(serverInfo.port);
    const msg = await nextMessage(ws) as { nonce: string; gatePubKey?: string };

    expect(isLarChallengeMsg(msg)).toBe(true);
    expect(msg.gatePubKey).toBe(GATE.pubKey);

    ws.close();
  });

  test("V3: a lar:auth with a sig relays the proof {nonce, sig} to the shore", async () => {
    const { shore, calls } = makeCapturingShore();
    gate.arm(shore, AUD, GATE);

    const ws   = await connect(serverInfo.port);
    const chal = await nextMessage(ws) as { nonce: string };

    ws.send(JSON.stringify(mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE)));
    await nextMessage(ws); // auth-ok

    expect(calls).toHaveLength(1);
    expect(calls[0]!.proof).toEqual({ nonce: chal.nonce, sig: "ab".repeat(64) });

    ws.close();
  });

  test("V3: a lar:auth with an empty sig relays NO proof (the worker refuses an unproven peer)", async () => {
    const { shore, calls } = makeCapturingShore();
    gate.arm(shore, AUD, GATE);

    const ws   = await connect(serverInfo.port);
    const chal = await nextMessage(ws) as { nonce: string };

    ws.send(JSON.stringify(mkLarAuth("card", chal.nonce, "", LEAF_NONCE)));
    await nextMessage(ws); // auth-ok

    expect(calls).toHaveLength(1);
    expect(calls[0]!.proof).toBeUndefined();

    ws.close();
  });

  test("clients set decrements when authenticated connection closes", async () => {
    gate.arm(makeStubShore({
      receiveResult: { id: "0xaabbcc" },
      verifyResult:  { ok: true },
    }), AUD, GATE);

    const ws   = await connect(serverInfo.port);
    const chal = await nextMessage(ws) as { nonce: string };
    ws.send(JSON.stringify(mkLarAuth("card", chal.nonce, "sig", LEAF_NONCE)));
    await nextMessage(ws); // auth-ok

    expect(gate.clients.size).toBe(1);

    // terminate() is a forced close that fires the server-side "close" event
    // synchronously without waiting for a graceful handshake.
    ws.terminate();
    await new Promise<void>((r) => setTimeout(r, 50));
    expect(gate.clients.size).toBe(0);
  });

  // ── THE GATE SIGNS ITS VERDICT — authentication runs both ways on the one socket ─────────────────────────
  test("the lar:auth-ok carries the gate key's signature over both nonces, the leaf's key and the audience", async () => {
    const leafKey = "ab".repeat(32);
    const { shore } = makeCapturingShore(`prefix:${leafKey}`);
    gate.arm(shore, AUD, GATE);
    const ws   = await connect(serverInfo.port);
    const chal = await nextMessage(ws) as { nonce: string };
    ws.send(JSON.stringify(mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE)));
    const ok = await nextMessage(ws) as { type: string; sig: string };
    expect(isLarAuthOkMsg(ok)).toBe(true);
    const parts = { nonce: chal.nonce, leafNonce: LEAF_NONCE, gatePubKey: GATE.pubKey, peerPubKey: leafKey, aud: AUD };
    expect(await verifyAuthOk({ ...parts, sig: ok.sig })).toBe(true);                                  // control
    // Each bound value moves it: another leaf nonce, another leaf or another gate key reads false.
    expect(await verifyAuthOk({ ...parts, leafNonce: "00".repeat(32), sig: ok.sig })).toBe(false);
    expect(await verifyAuthOk({ ...parts, peerPubKey: "cd".repeat(32), sig: ok.sig })).toBe(false);
    expect(await verifyAuthOk({ ...parts, gatePubKey: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(62)), sig: ok.sig })).toBe(false);
    ws.close();
  });

  test("a lar:auth with no leaf nonce is denied 4003 — a verdict needs the leaf's own freshness to commit to", async () => {
    const { shore, calls } = makeCapturingShore();
    gate.arm(shore, AUD, GATE);
    const ws   = await connect(serverInfo.port);
    const chal = await nextMessage(ws) as { nonce: string };
    const closed = nextClose(ws);
    const { leafNonce: _drop, ...noLeafNonce } = mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE);
    ws.send(JSON.stringify(noLeafNonce));
    expect(isLarAuthDeniedMsg(await nextMessage(ws))).toBe(true);
    expect((await closed).code).toBe(4003);
    expect(calls).toHaveLength(0);
  });

  test("RED: a session message on a socket the gate has not admitted reaches no session listener", async () => {
    const { shore, calls } = makeCapturingShore();
    gate.arm(shore, AUD, GATE);
    let heard = 0;
    gate.onSession(() => { heard += 1; });
    const ws   = await connect(serverInfo.port);
    await nextMessage(ws);                                                  // the challenge
    const closed = nextClose(ws);
    ws.send(JSON.stringify({ type: "lar:session", kind: "ask", body: 1 }));
    expect(isLarAuthDeniedMsg(await nextMessage(ws))).toBe(true);
    expect((await closed).code).toBe(4003);
    expect(heard).toBe(0);
    expect(calls).toHaveLength(0);
    expect(gate.sendSession(ws.ws as unknown as Parameters<typeof gate.sendSession>[0], "x", 1)).toBe(false);
  });

  test("CONTROL: on an admitted socket a session message reaches the listener, and the gate answers on it", async () => {
    const { shore } = makeCapturingShore("prefix:" + "ab".repeat(32));
    gate.arm(shore, AUD, GATE);
    const heard: unknown[] = [];
    gate.onSession((socket, msg) => { heard.push(msg.body); gate.sendSession(socket, "answer", msg.body); });
    const ws   = await connect(serverInfo.port);
    const chal = await nextMessage(ws) as { nonce: string };
    ws.send(JSON.stringify(mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE)));
    expect(isLarAuthOkMsg(await nextMessage(ws))).toBe(true);
    ws.send(JSON.stringify({ type: "lar:session", kind: "ask", body: { n: 1 } }));
    expect(await nextMessage(ws)).toEqual({ type: "lar:session", kind: "answer", body: { n: 1 } });
    expect(heard).toEqual([{ n: 1 }]);
    ws.close();
  });

  // ── THE PRESENTATION — the presented admit, recorded per socket, deciding nothing ──────────────────────────
  // The gate keeps what the peer presented, untrusted, for a later reader. The CONTRACT slot is retired: a
  // vessel that presents a leaf to a Nexus presents no root-signed edge to it on any socket (Q1, strict).
  const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");

  async function presentation() {
    const { buildDeviceDelegation, signCarriageContract, signCarriageQuorum, carriageEntryActCid } = await import("@lararium/mesh");
    const ed = await import("@noble/ed25519");
    const signerOf = (seed: Uint8Array) => async (bytes: Uint8Array) => toHex(await ed.signAsync(bytes, seed));
    const rootSeed  = new Uint8Array(32).fill(21);
    const nym       = toHex(await ed.getPublicKeyAsync(rootSeed));
    const vesselKey = toHex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(22)));
    const rootEdge = await buildDeviceDelegation({
      personaRootSeed: rootSeed, deviceVerifyingKey: vesselKey, hearthTrueName: "",
      boundEpoch: 0,
    });
    const kahu = await Promise.all([1, 2].map(async (n) => {
      const seed = new Uint8Array(32).fill(n);
      return { signer: toHex(await ed.getPublicKeyAsync(seed)), sign: signerOf(seed) };
    }));
    const consent = await signCarriageContract(nym, "epoch-cid", signerOf(rootSeed));
    const first  = await signCarriageQuorum({ nym, action: "admit", parents: [], sealEpochCid: "epoch-cid" }, kahu, consent);
    const revoke = await signCarriageQuorum({ nym, action: "revoke", parents: [carriageEntryActCid(first)], sealEpochCid: "epoch-cid" }, kahu);
    const admit  = await signCarriageQuorum({ nym, action: "admit", parents: [carriageEntryActCid(revoke)], sealEpochCid: "epoch-cid" }, kahu, consent);
    return { vesselKey, rootEdge, presentedAdmit: { admit, lineage: [first, revoke] } };
  }

  test("a presented admit round-trips byte-identical into the gate's per-socket record, beside the challenge the gate issued", async () => {
    const { vesselKey, presentedAdmit } = await presentation();
    const proven = { ...presentedAdmit, leafProof: "cd".repeat(64) };      // shape only — the SEAT verifies it
    const { shore, calls } = makeCapturingShore(`prefix:${vesselKey}`);
    gate.arm(shore, AUD, GATE);
    const admitted = new Promise<WebSocket>((res) => gate.once("connection", (s: WebSocket) => res(s)));

    const ws   = await connect(serverInfo.port);
    const chal = await nextMessage(ws) as { nonce: string };
    ws.send(JSON.stringify({ ...mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE), presentedAdmit: proven }));
    expect(isLarAuthOkMsg(await nextMessage(ws))).toBe(true);
    const serverSocket = await admitted;

    expect(calls).toHaveLength(1);
    expect(calls[0]!.edge).toBeUndefined();                                  // CONTROL: the fleet slot sees nothing
    const kept = gate.getPresentationForSocket(serverSocket);
    expect(JSON.stringify(kept?.presentedAdmit)).toBe(JSON.stringify(proven));
    expect(Object.keys(kept ?? {})).toEqual(["presentedAdmit"]);
    // THE GATE RECORDS WHAT IT ISSUED — the nonce and gate key the seat reads the leaf proof against.
    expect(gate.getChallengeForSocket(serverSocket)).toEqual({ nonce: chal.nonce, gatePubKey: GATE.pubKey });
    expect(gate.getIdentifierForSocket(serverSocket)).toBe(`prefix:${vesselKey}`);
    expect(gate.getClassForSocket(serverSocket)).toBeUndefined();            // the presentation lifts no class
    ws.close();
  });

  test("ONE SOCKET, ONE FACE — a presented admit beside a root-signed fleet edge is denied 4003, and the shore is never asked", async () => {
    const { rootEdge, presentedAdmit } = await presentation();
    const { shore, calls } = makeCapturingShore();
    gate.arm(shore, AUD, GATE);
    let admittedAny = false;
    gate.once("connection", () => { admittedAny = true; });
    const ws   = await connect(serverInfo.port);
    const chal = await nextMessage(ws) as { nonce: string };
    const closed = nextClose(ws);
    ws.send(JSON.stringify({ ...mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE), edge: rootEdge, presentedAdmit }));
    expect(isLarAuthDeniedMsg(await nextMessage(ws))).toBe(true);
    expect((await closed).code).toBe(4003);
    expect(calls).toHaveLength(0);
    expect(admittedAny).toBe(false);
  });

  test("the CONTRACT slot is retired — a lar:auth carrying `contractEdge` is denied 4003, and the shore is never asked", async () => {
    const { rootEdge } = await presentation();
    const { shore, calls } = makeCapturingShore();
    gate.arm(shore, AUD, GATE);
    let admittedAny = false;
    gate.once("connection", () => { admittedAny = true; });
    const ws   = await connect(serverInfo.port);
    const chal = await nextMessage(ws) as { nonce: string };
    const closed = nextClose(ws);
    ws.send(JSON.stringify({ ...mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE), contractEdge: rootEdge }));
    expect(isLarAuthDeniedMsg(await nextMessage(ws))).toBe(true);
    expect((await closed).code).toBe(4003);
    expect(calls).toHaveLength(0);
    expect(admittedAny).toBe(false);
  });

  test("CONTROL: the ContactCard alone admits at the floor, with no presentation kept beside the challenge", async () => {
    const { vesselKey } = await presentation();
    const { shore } = makeCapturingShore(`prefix:${vesselKey}`);
    gate.arm(shore, AUD, GATE);
    const admitted = new Promise<WebSocket>((res) => gate.once("connection", (s: WebSocket) => res(s)));
    const ws   = await connect(serverInfo.port);
    const chal = await nextMessage(ws) as { nonce: string };
    ws.send(JSON.stringify({ ...mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE) }));
    expect(isLarAuthOkMsg(await nextMessage(ws))).toBe(true);
    const serverSocket = await admitted;
    expect(gate.getPresentationForSocket(serverSocket)).toBeUndefined();
    expect(gate.getChallengeForSocket(serverSocket)?.nonce).toBe(chal.nonce);
    ws.close();
  });

  test("a malformed presented admit is denied like any malformed lar:auth — 4003, and the shore is never asked", async () => {
    const { presentedAdmit } = await presentation();
    const { shore, calls } = makeCapturingShore();
    gate.arm(shore, AUD, GATE);
    let admittedAny = false;
    gate.once("connection", () => { admittedAny = true; });

    const ws   = await connect(serverInfo.port);
    const chal = await nextMessage(ws) as { nonce: string };
    const closed = nextClose(ws);
    const bad = { ...presentedAdmit, lineage: [{ ...presentedAdmit.lineage[0]!, nym: "ab".repeat(32) }] }; // a lineage act for ANOTHER nym
    ws.send(JSON.stringify({ ...mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE), presentedAdmit: bad }));
    const denied = await nextMessage(ws);
    expect(isLarAuthDeniedMsg(denied)).toBe(true);
    expect((denied as { reason: string }).reason).toBe("expected lar:auth message");
    expect((await closed).code).toBe(4003);
    expect(calls).toHaveLength(0);
    expect(admittedAny).toBe(false);
  });

  test("CONTROL: a peer presenting nothing admits at the floor exactly as before, with no presentation kept", async () => {
    const { shore, calls } = makeCapturingShore("prefix:" + "ab".repeat(32));
    gate.arm(shore, AUD, GATE);
    const admitted = new Promise<WebSocket>((res) => gate.once("connection", (s: WebSocket) => res(s)));
    const ws   = await connect(serverInfo.port);
    const chal = await nextMessage(ws) as { nonce: string };
    ws.send(JSON.stringify({ ...mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE) }));
    expect(isLarAuthOkMsg(await nextMessage(ws))).toBe(true);
    const serverSocket = await admitted;
    expect(calls).toHaveLength(1);
    expect(calls[0]!.edge).toBeUndefined();
    expect(gate.getPresentationForSocket(serverSocket)).toBeUndefined();
    expect(gate.getIdentifierForSocket(serverSocket)).toBe("prefix:" + "ab".repeat(32));
    ws.close();
  });

  test("CONTROL: the presentation decides nothing — a shore denial still denies a well-presented peer", async () => {
    const { presentedAdmit } = await presentation();
    gate.arm(makeStubShore({ receiveResult: { id: "0xaabbcc" }, verifyResult: { ok: false, reason: "insufficient capability" } }), AUD, GATE);
    const ws   = await connect(serverInfo.port);
    const chal = await nextMessage(ws) as { nonce: string };
    const closed = nextClose(ws);
    ws.send(JSON.stringify({ ...mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE), presentedAdmit }));
    expect(isLarAuthDeniedMsg(await nextMessage(ws))).toBe(true);
    expect((await closed).code).toBe(4003);
    expect(gate.clients.size).toBe(0);
  });
});
