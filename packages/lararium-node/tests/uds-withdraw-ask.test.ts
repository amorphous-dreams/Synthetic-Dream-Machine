/**
 * uds-withdraw-ask — A CALLER THAT LEAVES A HELD ASK WITHDRAWS IT (lar:///engine.filter.watches, comms-ux-enacts landing 16).
 *
 * A held handler (a watch) stops only where the island hears that its caller left: a socket that closes while the dispatched ask
 * still runs, or a cancel under the ask's id (`session:cancel`), tells the vessel's seat, which hands the island the ask's id
 * (`withdrawAsk`, the `daemon:withdraw-verb` message); the island removes the ask's invocation and the dispatcher aborts the
 * handler's signal. Only a HELD ask withdraws: a write runs on past its caller's hang-up. The island half reads in `packages/lararium-tw5/tests/withdraw-placed-ask.test.ts`; this file reads the seat.
 */
import { describe, expect, test } from "vitest";
import { controlStoreOf } from "@lararium/mesh/control-home";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { concludeVerb } from "@lararium/mesh/verb-tiddler";
import { faceScopedId } from "@lararium/mesh/face-scoped-id";
import type { SessionFace } from "@lararium/mesh/session-contract";
import { heldAsk, makeUdsSeat, serveUdsFront, type UdsSessionDoor } from "../src/uds-channel.js";
import { claimStore } from "../src/owned-store.js";

const fixtureMint = async () => ({ ok: true as const, signer: { dropped: false, drop() { (this as { dropped: boolean }).dropped = true; },
  certificate: null, sign: async () => ({ refusal: "test-signs-nothing" }) } });

const face = (name: string): SessionFace => ({ personaGroup: `group-${name}`, proofSubject: `proof-${name}`,
  admitRef: `admit-${name}`, causalRevision: `revision-${name}`,
  planes: { persona: `persona-${name}`, circles: `circles-${name}`, identities: `identities-${name}`,
    sessions: `sessions-${name}`, intents: `intents-${name}` } });

class Peer {
  private buf = "";
  private replies: Array<Record<string, unknown>> = [];
  private waits: Array<(value: Record<string, unknown>) => void> = [];
  private constructor(readonly socket: Socket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      this.buf += chunk;
      let end: number;
      while ((end = this.buf.indexOf("\n")) >= 0) {
        const answer = JSON.parse(this.buf.slice(0, end)) as Record<string, unknown>;
        this.buf = this.buf.slice(end + 1);
        const next = this.waits.shift();
        if (next) next(answer); else this.replies.push(answer);
      }
    });
  }
  static async connect(path: string): Promise<Peer> {
    const socket = createConnection(path);
    await new Promise<void>((resolve, reject) => { socket.once("connect", resolve); socket.once("error", reject); });
    return new Peer(socket);
  }
  ask(frame: Record<string, unknown>): Promise<Record<string, unknown>> {
    const next = this.replies.shift();
    const answer = next ? Promise.resolve(next) : new Promise<Record<string, unknown>>((resolve) => this.waits.push(resolve));
    this.socket.write(JSON.stringify(frame) + "\n");
    return answer;
  }
  destroy(): void { this.socket.destroy(); }
}

/** A seat over a fixture door whose `hold` verb never concludes until the test lands its outcome, and whose `withdrawAsk` records. */
async function rig() {
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const dir = mkdtempSync(join(tmpdir(), "uds-withdraw-ask-"));
  const claim = await claimStore(dir, { holder: "vessel" });
  const door: UdsSessionDoor = { anchorNow: async () => ({ kind: "place" as const, aid: "place-fixture", head: "place-head" }), open: async ({ faceRef }) => ({ ok: true, supply: {
    face: face(faceRef), ordinal: 0, profile: "seat", presenter: `verified-${faceRef}`, anchor: { kind: "place" as const, aid: "place-fixture", head: "place-head" }, caps: ["filter-watch", "tiddler-put"], mint: fixtureMint } }) };
  const placed = new Map<string, { requestId: string; verb: string; face?: string }>();
  const placedWaits = new Map<string, () => void>();
  const withdrawn: string[] = [];
  const withdrawWaits: Array<() => void> = [];
  const front = serveUdsFront({ claim });
  front.attach(makeUdsSeat({ controlHandle: daemonHandle, control: controlStoreOf(daemonHandle), claim, repo, sessions: door,
    placeVerb: (o) => { placed.set(o.requestId, o); placedWaits.get(o.requestId)?.(); },
    withdrawAsk: (requestId) => { withdrawn.push(requestId); for (const wake of withdrawWaits.splice(0)) wake(); } }));
  const peers: Peer[] = [];
  const open = async (name: string) => {
    const peer = await Peer.connect(claim.socketPath);
    peers.push(peer);
    const opened = await peer.ask({ op: "session:open", requestId: `open-${name}-${peers.length}`, faceRef: name, hand: "seat" });
    return { peer, env: { ownerEpoch: opened.ownerEpoch, sessionId: opened.sessionId, generation: opened.generation, faceRef: opened.faceRef } };
  };
  const placedOnce = (requestId: string): Promise<void> => new Promise((resolve) => { if (placed.has(requestId)) resolve(); else placedWaits.set(requestId, resolve); });
  const withdrawnOnce = (): Promise<void> => new Promise((resolve) => { if (withdrawn.length > 0) resolve(); else withdrawWaits.push(resolve); });
  /** Land the held ask's outcome, as the island does when its handler settles. */
  const land = (requestId: string): void => {
    const held = placed.get(requestId)!;
    const outcome = concludeVerb({ requestId: held.requestId, verb: held.verb, status: "done", ...(held.face !== undefined && { face: held.face }),
      cause: "test-worker", batchMode: "best-effort", results: { summary: { ok: true } } });
    daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
  };
  const close = async (): Promise<void> => {
    for (const peer of peers) peer.destroy();
    front.close();
    await claim.release();
    rmSync(dir, { recursive: true, force: true });
  };
  /** A raw `{op:"cancel"}` line on a socket of its own, answered by the vessel's receipt. */
  const rawCancel = async (requestId: string): Promise<void> => {
    const peer = await Peer.connect(claim.socketPath);
    peers.push(peer);
    await peer.ask({ op: "cancel", requestId });
  };
  return { open, placedOnce, withdrawnOnce, withdrawn, land, close, rawCancel };
}

describe("a caller that leaves a held ask withdraws it", () => {
  test("RED: only an ask that holds reads as held: a watch, a call naming the watch, a waiting events read; never a write", () => {
    expect(heldAsk("filter-watch", { filter: "[tag[x]]" })).toBe(true);
    expect(heldAsk("call", { verb: "watch", params: {} })).toBe(true);
    expect(heldAsk("call", { verb: "lar:///engine.filter.watches", params: {} })).toBe(true);
    expect(heldAsk("call", { sigil: "<<~ watch filter=`[tag[x]]`>>" })).toBe(true);
    expect(heldAsk("events", { wait: true })).toBe(true);
    expect(heldAsk("events", {})).toBe(false);
    expect(heldAsk("call", { verb: "put", params: {} })).toBe(false);
    expect(heldAsk("call", { sigil: "<<~ put title=`watch`>>" })).toBe(false);
    expect(heldAsk("tiddler-put", { title: "x" })).toBe(false);
  });

  test("CONTROL: a write whose socket closes mid-ask withdraws nothing; its outcome stays owed", async () => {
    const r = await rig();
    try {
      const line = await r.open("a");
      void line.peer.ask({ op: "session:call", ...line.env, requestId: "write-1", verb: "tiddler-put", args: { title: "x" } });
      await r.placedOnce(faceScopedId("proof-a", "write-1"));
      line.peer.destroy();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(r.withdrawn).toEqual([]);
    } finally { await r.close(); }
  });

  test("CONTROL: a raw cancel rides its own socket, which placed no ask, and withdraws nothing", async () => {
    const r = await rig();
    try {
      const line = await r.open("a");
      void line.peer.ask({ op: "session:call", ...line.env, requestId: "watch-4", verb: "filter-watch", args: { filter: "[tag[x]]" } });
      const scoped = faceScopedId("proof-a", "watch-4");
      await r.placedOnce(scoped);
      await r.rawCancel(scoped);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(r.withdrawn).toEqual([]);
    } finally { await r.close(); }
  });

  test("RED: a socket that closes while its ask runs hands the island the ask's id", async () => {
    const r = await rig();
    try {
      const line = await r.open("a");
      void line.peer.ask({ op: "session:call", ...line.env, requestId: "watch-1", verb: "filter-watch", args: { filter: "[tag[x]]" } });
      const scoped = faceScopedId("proof-a", "watch-1");
      await r.placedOnce(scoped);
      expect(r.withdrawn).toEqual([]);
      line.peer.destroy();
      await r.withdrawnOnce();
      expect(r.withdrawn).toEqual([scoped]);
    } finally { await r.close(); }
  });

  test("RED: a cancel under the ask's id, from another session of the same face, hands the island the ask's id", async () => {
    const r = await rig();
    try {
      const line = await r.open("a");
      void line.peer.ask({ op: "session:call", ...line.env, requestId: "watch-2", verb: "filter-watch", args: { filter: "[tag[x]]" } });
      const scoped = faceScopedId("proof-a", "watch-2");
      await r.placedOnce(scoped);
      const other = await r.open("a");
      await other.peer.ask({ op: "session:cancel", ...other.env, requestId: "watch-2" });
      await r.withdrawnOnce();
      expect(r.withdrawn).toEqual([scoped]);
    } finally { await r.close(); }
  });

  test("CONTROL: an ask that answers before its socket closes withdraws nothing", async () => {
    const r = await rig();
    try {
      const line = await r.open("a");
      const answered = line.peer.ask({ op: "session:call", ...line.env, requestId: "watch-3", verb: "filter-watch", args: { filter: "[tag[x]]" } });
      const scoped = faceScopedId("proof-a", "watch-3");
      await r.placedOnce(scoped);
      r.land(scoped);
      expect(await answered).toMatchObject({ kind: "session:result", requestId: "watch-3", status: "done" });
      line.peer.destroy();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(r.withdrawn).toEqual([]);
    } finally { await r.close(); }
  });
});
