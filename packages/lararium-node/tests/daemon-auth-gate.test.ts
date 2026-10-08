/**
 * daemon-auth-gate.test.ts — the ONE gate: challenge, proof, sort, then a signed verdict or NOTHING.
 *
 * A real WebSocket server, raw WebSocket clients and stub shores and sorters; no Automerge-repo, no TW5, no
 * filesystem. Proven here:
 *   · SILENCE — every refusal cause (a gate not armed, a malformed lar:auth, a nonce mismatch, a bad proof, a
 *     PRIVATE stranger, a sorter fault) reads byte-identical on the wire: the challenge at most, then no frame
 *     and no close frame (code 1006), cut at a deadline drawn AT ACCEPT in [T, 2T);
 *   · CONTROL — a sorted socket gets the gate key's signed verdict and outlives 2T;
 *   · the challenge names no gate key; the V3 proof relays {nonce, sig};
 *   · the SORTER runs before the verdict, sees what the socket presented beside the challenge the gate issued,
 *     and its class and standing ride the admitted socket; a refold's `drop` cuts an admitted socket silently;
 *   · ONE SOCKET, ONE FACE and the retired contract slot are refused before the shore is asked;
 *   · THE KNOCK — through the vessel's dispatcher, an upgrade on the bare route or on another key's knock is
 *     destroyed with no HTTP 101; the gate's own knock upgrades.
 *
 * Gate: lar:///ha.ka.ba/lararium/node/daemon-auth-gate
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server }                 from "node:http";
import { WebSocketServer, WebSocket }                 from "ws";
import {
  DaemonAuthGate, type GateKey, type SocketSorter, type SortInput,
} from "../src/daemon-auth-gate.js";
import { mountHttpFaceDispatcher } from "../src/http-face-dispatcher.js";
import type { AuthVerifierShore, AuthProofWire }       from "@lararium/mesh";
import {
  isLarChallengeMsg, isLarAuthOkMsg, knockPath,
  mkLarAuth, verifyAuthOk, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed,
} from "@lararium/mesh";

const AUD        = "lar:///ha.ka.ba/bags/daemon";
const GATE_SEED  = new Uint8Array(32).fill(61);
const GATE: GateKey = { pubKey: await ed25519VerifyingKeyFromSeed(GATE_SEED), sign: ed25519SignerFromSeed(GATE_SEED) };
const LEAF_NONCE = "ef".repeat(32);
/** The deadline base this suite's gates draw from: every refused socket is cut in [T, 2T). */
const T = 200;

// ── shores and sorters ──────────────────────────────────────────────────────────────────────────────

function capturingShore(id = "prefix:" + "ab".repeat(32), verdict: { ok: boolean; peerClass?: "same-operator"; reason?: string } = { ok: true }): {
  shore: AuthVerifierShore;
  calls: Array<{ bagUrl: string; access: string; proof?: AuthProofWire; edge?: unknown }>;
} {
  const calls: Array<{ bagUrl: string; access: string; proof?: AuthProofWire; edge?: unknown }> = [];
  return {
    calls,
    shore: {
      async verify(_cardBytes, bagUrl, access, proof, edge) {
        calls.push({ bagUrl, access, ...(proof ? { proof } : {}), ...(edge ? { edge } : {}) });
        return verdict.ok
          ? { ok: true, identifier: id, ...(verdict.peerClass ? { peerClass: verdict.peerClass } : {}) }
          : { ok: false, reason: verdict.reason ?? "refused" };
      },
    },
  };
}

/** A sorter that records what it saw and answers `verdict` (null → silence). */
function recordingSorter(verdict: Awaited<ReturnType<SocketSorter>>): { sort: SocketSorter; seen: SortInput[] } {
  const seen: SortInput[] = [];
  return { seen, sort: async (input) => { seen.push(input); return verdict; } };
}
const admitStranger: SocketSorter = async () => ({ class: "stranger" });
const silence: SocketSorter = async () => null;

// ── wire helpers ────────────────────────────────────────────────────────────────────────────────────

function makeServer(): Promise<{ wss: WebSocketServer; port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const http = createServer();
    const wss  = new WebSocketServer({ server: http });
    http.listen(0, "127.0.0.1", () => {
      const addr = http.address();
      if (!addr || typeof addr === "string") { reject(new Error("bad address")); return; }
      resolve({ wss, port: addr.port, close: () => new Promise<void>((res) => { wss.close(() => http.close(() => res())); }) });
    });
  });
}

/** A dialed socket that records every frame, the close code and reason, and when it ended (ms after open). */
class Dial {
  readonly frames: string[] = [];
  private readonly waiters: Array<(v: unknown) => void> = [];
  private readonly buffered: unknown[] = [];
  readonly openedAt: number;
  readonly ended: Promise<{ code: number; reason: string; ms: number }>;

  constructor(readonly ws: WebSocket) {
    this.openedAt = Date.now();
    ws.on("message", (data: Buffer) => {
      const text = data.toString();
      this.frames.push(text);
      const msg = JSON.parse(text) as unknown;
      const w = this.waiters.shift();
      if (w) w(msg); else this.buffered.push(msg);
    });
    this.ended = new Promise((res) => ws.once("close", (code: number, reason: Buffer) => res({ code, reason: reason.toString(), ms: Date.now() - this.openedAt })));
  }

  next(): Promise<unknown> {
    if (this.buffered.length) return Promise.resolve(this.buffered.shift());
    return new Promise((r) => this.waiters.push(r));
  }
  send(v: unknown): void { this.ws.send(typeof v === "string" ? v : JSON.stringify(v)); }
}

function dial(port: number, path = ""): Promise<Dial> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    const d = new Dial(ws);
    ws.once("open", () => resolve(d));
    ws.once("error", reject);
  });
}

/** The silent end every refusal draws: no frame past `framesBefore`, no close frame, cut in [T, 2T). */
async function expectSilentEnd(d: Dial, framesBefore: number): Promise<void> {
  const end = await d.ended;
  expect(d.frames.length, `a refused socket heard ${d.frames.slice(framesBefore).join(" | ")}`).toBe(framesBefore);
  expect(end.code).toBe(1006);                  // no close frame crossed: the gate terminated
  expect(end.reason).toBe("");
  expect(end.ms).toBeGreaterThanOrEqual(T - 20);
  expect(end.ms).toBeLessThan(2 * T + 250);
}

describe("DaemonAuthGate — a signed verdict, or nothing", () => {
  let server: Awaited<ReturnType<typeof makeServer>>;
  let gate: DaemonAuthGate;

  beforeEach(async () => {
    server = await makeServer();
    gate = new DaemonAuthGate(server.wss, { authTimeoutMs: T, onRefuse: () => {} });
  });
  afterEach(async () => { await server.close(); });

  test("RED: a gate not yet armed says nothing at all and cuts the socket at its deadline", async () => {
    const d = await dial(server.port);
    await expectSilentEnd(d, 0);
  });

  test("the challenge names no gate key — the dialer already pins it", async () => {
    gate.arm(capturingShore().shore, AUD, GATE, admitStranger);
    const d = await dial(server.port);
    const chal = await d.next() as Record<string, unknown>;
    expect(isLarChallengeMsg(chal)).toBe(true);
    expect(Object.keys(chal).sort()).toEqual(["nonce", "type"]);
    expect((chal["nonce"] as string)).toHaveLength(64);
    d.ws.close();
  });

  test("CONTROL: a sorted socket gets the gate key's signed verdict, carries its class, and outlives 2T", async () => {
    const leafKey = "ab".repeat(32);
    const { shore } = capturingShore(`prefix:${leafKey}`, { ok: true, peerClass: "same-operator" });
    const { sort, seen } = recordingSorter({ class: "same-operator" });
    gate.arm(shore, AUD, GATE, sort);
    const admitted = new Promise<WebSocket>((res) => gate.once("connection", (s: WebSocket) => res(s)));
    const d = await dial(server.port);
    const chal = await d.next() as { nonce: string };
    d.send(mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE));
    const ok = await d.next() as { sig: string };
    expect(isLarAuthOkMsg(ok)).toBe(true);
    const parts = { nonce: chal.nonce, leafNonce: LEAF_NONCE, gatePubKey: GATE.pubKey, peerPubKey: leafKey, aud: AUD };
    expect(await verifyAuthOk({ ...parts, sig: ok.sig })).toBe(true);
    expect(await verifyAuthOk({ ...parts, leafNonce: "00".repeat(32), sig: ok.sig })).toBe(false);
    const socket = await admitted;
    expect(gate.getClassForSocket(socket)).toBe("same-operator");
    expect(seen[0]).toMatchObject({ sameOperator: true, vesselKey: leafKey, challenge: { nonce: chal.nonce, gatePubKey: GATE.pubKey } });
    await new Promise((r) => setTimeout(r, 2 * T + 100));
    expect(d.ws.readyState).toBe(WebSocket.OPEN);
    d.ws.close();
  });

  test("RED: a PRIVATE stranger hears the challenge and then NOTHING — no verdict, no close frame", async () => {
    gate.arm(capturingShore().shore, AUD, GATE, silence);
    const d = await dial(server.port);
    const chal = await d.next() as { nonce: string };
    d.send(mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE));
    await expectSilentEnd(d, 1);
    expect(gate.clients.size).toBe(0);
  });

  test("RED: every refusal cause is byte-identical on the wire", async () => {
    const causes: Array<{ name: string; shore: AuthVerifierShore; sort: SocketSorter; auth: (nonce: string) => unknown }> = [
      { name: "stranger under PRIVATE", shore: capturingShore().shore, sort: silence, auth: (n) => mkLarAuth("card", n, "ab".repeat(64), LEAF_NONCE) },
      { name: "bad proof",              shore: capturingShore("x", { ok: false, reason: "V3 proof rejected" }).shore, sort: admitStranger, auth: (n) => mkLarAuth("card", n, "ab".repeat(64), LEAF_NONCE) },
      { name: "nonce mismatch",         shore: capturingShore().shore, sort: admitStranger, auth: () => mkLarAuth("card", "wrong", "ab".repeat(64), LEAF_NONCE) },
      { name: "not a lar:auth",         shore: capturingShore().shore, sort: admitStranger, auth: () => ({ type: "join", senderId: "x" }) },
      { name: "sorter fault",           shore: capturingShore().shore, sort: async () => { throw new Error("boom"); }, auth: (n) => mkLarAuth("card", n, "ab".repeat(64), LEAF_NONCE) },
    ];
    const wires: string[] = [];
    for (const cause of causes) {
      const local = await makeServer();
      const g = new DaemonAuthGate(local.wss, { authTimeoutMs: T, onRefuse: () => {} });
      g.arm(cause.shore, AUD, GATE, cause.sort);
      const d = await dial(local.port);
      const chal = await d.next() as { nonce: string };
      d.send(cause.auth(chal.nonce));
      await expectSilentEnd(d, 1);
      const end = await d.ended;
      // The wire shape, with the per-socket nonce masked: the only thing a refused dialer ever holds.
      wires.push(JSON.stringify({ frames: d.frames.map((f) => f.replace(chal.nonce, "N")), code: end.code, reason: end.reason }));
      await local.close();
    }
    expect(new Set(wires).size, wires.join("\n")).toBe(1);
  });

  test("RED: the deadline is drawn at accept — a silent dialer and a bad proof end inside the same window", async () => {
    gate.arm(capturingShore("x", { ok: false }).shore, AUD, GATE, admitStranger);
    const quiet = await dial(server.port);
    await quiet.next();
    const bad = await dial(server.port);
    const chal = await bad.next() as { nonce: string };
    bad.send(mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE));
    await expectSilentEnd(quiet, 1);
    await expectSilentEnd(bad, 1);
  });

  test("V3: the gate relays the proof {nonce, sig}; an empty sig relays none", async () => {
    const { shore, calls } = capturingShore();
    gate.arm(shore, AUD, GATE, admitStranger);
    const d = await dial(server.port);
    const chal = await d.next() as { nonce: string };
    d.send(mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE));
    expect(isLarAuthOkMsg(await d.next())).toBe(true);
    expect(calls[0]!.proof).toEqual({ nonce: chal.nonce, sig: "ab".repeat(64) });
    d.ws.close();
    const e = await dial(server.port);
    const chal2 = await e.next() as { nonce: string };
    e.send(mkLarAuth("card", chal2.nonce, "", LEAF_NONCE));
    expect(isLarAuthOkMsg(await e.next())).toBe(true);
    expect(calls[1]!.proof).toBeUndefined();
    e.ws.close();
  });

  test("the sorter sees what the socket presented; its class and standing ride the admitted socket", async () => {
    const presented = { kind: "admit", admit: await anAdmit(), lineage: [], leafProof: "cd".repeat(64) };
    const { sort, seen } = recordingSorter({ class: "contracted", standing: { nym: "aa".repeat(32), aid: "n-aid" } });
    gate.arm(capturingShore().shore, AUD, GATE, sort);
    const admitted = new Promise<WebSocket>((res) => gate.once("connection", (s: WebSocket) => res(s)));
    const d = await dial(server.port);
    const chal = await d.next() as { nonce: string };
    d.send({ ...mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE), presented });
    expect(isLarAuthOkMsg(await d.next())).toBe(true);
    const socket = await admitted;
    expect(JSON.stringify(seen[0]!.presented)).toBe(JSON.stringify(presented));
    expect(gate.getClassForSocket(socket)).toBe("contracted");
    expect(gate.getStandingForSocket(socket)).toEqual({ nym: "aa".repeat(32), aid: "n-aid" });
    expect(gate.getChallengeForSocket(socket)).toEqual({ nonce: chal.nonce, gatePubKey: GATE.pubKey });
    d.ws.close();
  });

  test("session frames the sorter hands back follow the verdict on the same socket", async () => {
    gate.arm(capturingShore().shore, AUD, GATE, async () => ({ class: "walker", push: [{ kind: "hosting/grant", body: { g: 1 } }] }));
    const d = await dial(server.port);
    const chal = await d.next() as { nonce: string };
    d.send(mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE));
    expect(isLarAuthOkMsg(await d.next())).toBe(true);
    expect(await d.next()).toEqual({ type: "lar:session", kind: "hosting/grant", body: { g: 1 } });
    d.ws.close();
  });

  test("ONE SOCKET, ONE FACE: a presentation beside the fleet edge, or the retired contract slot, is silence — the shore never asked", async () => {
    for (const extra of [{ edge: { kind: "x" }, presented: { kind: "admit", admit: await anAdmit(), lineage: [] } }, { contractEdge: { kind: "x" } }, { presentedAdmit: { admit: await anAdmit(), lineage: [] } }]) {
      const { shore, calls } = capturingShore();
      const local = await makeServer();
      const g = new DaemonAuthGate(local.wss, { authTimeoutMs: T, onRefuse: () => {} });
      g.arm(shore, AUD, GATE, admitStranger);
      const d = await dial(local.port);
      const chal = await d.next() as { nonce: string };
      d.send({ ...mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE), ...extra });
      await expectSilentEnd(d, 1);
      expect(calls).toHaveLength(0);
      await local.close();
    }
  });

  test("RED: a session message on a socket the gate has not admitted reaches no listener", async () => {
    gate.arm(capturingShore().shore, AUD, GATE, admitStranger);
    let heard = 0;
    gate.onSession(() => { heard += 1; });
    const d = await dial(server.port);
    await d.next();
    d.send({ type: "lar:session", kind: "ask", body: 1 });
    await expectSilentEnd(d, 1);
    expect(heard).toBe(0);
  });

  test("CONTROL: on an admitted socket a session message reaches the listener, and the gate answers on it", async () => {
    gate.arm(capturingShore().shore, AUD, GATE, admitStranger);
    gate.onSession((socket, msg) => { gate.sendSession(socket, "answer", msg.body); });
    const d = await dial(server.port);
    const chal = await d.next() as { nonce: string };
    d.send(mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE));
    expect(isLarAuthOkMsg(await d.next())).toBe(true);
    d.send({ type: "lar:session", kind: "ask", body: { n: 1 } });
    expect(await d.next()).toEqual({ type: "lar:session", kind: "answer", body: { n: 1 } });
    d.ws.close();
  });

  test("a refold's drop cuts an admitted socket with no close frame", async () => {
    gate.arm(capturingShore().shore, AUD, GATE, admitStranger);
    const admitted = new Promise<WebSocket>((res) => gate.once("connection", (s: WebSocket) => res(s)));
    const d = await dial(server.port);
    const chal = await d.next() as { nonce: string };
    d.send(mkLarAuth("card", chal.nonce, "ab".repeat(64), LEAF_NONCE));
    expect(isLarAuthOkMsg(await d.next())).toBe(true);
    gate.drop(await admitted);
    const end = await d.ended;
    expect(end.code).toBe(1006);
    expect(gate.clients.size).toBe(0);
  });

  test("the sorter is required — `arm` takes it as its fourth argument", () => {
    expect(DaemonAuthGate.prototype.arm.length).toBe(4);
  });
});

describe("THE KNOCK — no HTTP 101 off the gate's own path", () => {
  let http: Server;
  let port: number;
  let gate: DaemonAuthGate;

  beforeEach(async () => {
    http = createServer();
    const dispatcher = mountHttpFaceDispatcher(http);
    const wss = new WebSocketServer({ noServer: true });
    gate = new DaemonAuthGate(wss as never, { authTimeoutMs: T, onRefuse: () => {} });
    gate.arm(capturingShore().shore, AUD, GATE, admitStranger);
    dispatcher.registerUpgrade({
      name: "relay", path: gate.upgradePath("/ws")!,
      handle: (req, socket, head) => wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req)),
    });
    await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
    port = (http.address() as { port: number }).port;
  });
  afterEach(async () => { await new Promise<void>((r) => http.close(() => r())); });

  /** Ask for an upgrade on `path` and report whether a 101 came back. */
  const upgraded = (path: string): Promise<boolean> => new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    ws.once("open", () => { ws.close(); resolve(true); });
    ws.once("unexpected-response", () => resolve(false));
    ws.once("error", () => resolve(false));
  });

  test("RED: the bare route and another key's knock draw no 101", async () => {
    expect(await upgraded("/ws")).toBe(false);
    expect(await upgraded(knockPath("cd".repeat(32), "/ws"))).toBe(false);
  });

  test("CONTROL: the gate's own knock upgrades and speaks the challenge", async () => {
    expect(gate.upgradePath("/ws")).toBe(knockPath(GATE.pubKey, "/ws"));
    expect(await upgraded(knockPath(GATE.pubKey, "/ws"))).toBe(true);
  });
});

/** A structurally well-formed admit act (signatures are the sorter's to read, never the gate's). */
async function anAdmit() {
  const { signCarriageContract, signCarriageQuorum } = await import("@lararium/mesh");
  const ed = await import("@noble/ed25519");
  const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
  const signerOf = (seed: Uint8Array) => async (bytes: Uint8Array) => toHex(await ed.signAsync(bytes, seed));
  const rootSeed = new Uint8Array(32).fill(21);
  const nym = toHex(await ed.getPublicKeyAsync(rootSeed));
  const kahu = await Promise.all([1, 2].map(async (n) => {
    const seed = new Uint8Array(32).fill(n);
    return { signer: toHex(await ed.getPublicKeyAsync(seed)), sign: signerOf(seed) };
  }));
  const consent = await signCarriageContract(nym, "epoch-cid", signerOf(rootSeed));
  return signCarriageQuorum({ nym, action: "admit", parents: [], sealEpochCid: "epoch-cid" }, kahu, consent);
}
