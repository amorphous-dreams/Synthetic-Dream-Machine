/**
 * uds-session-pipeline — frames on one session socket answer in the order they arrived, a close queues behind the call
 * in flight, and a socket that goes while its call runs ends its session without disturbing a sibling.
 */
import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, emptyLarDoc, concludeVerb, wikiSlotUri,
  type LarDoc } from "@lararium/mesh";
import type { SessionFace } from "@lararium/mesh/session-contract";
import { startUdsChannel, type UdsSessionDoor } from "../src/uds-channel.js";
import { claimStore } from "../src/owned-store.js";

/** The fixture door's mint: a signer the seat can drop, holding no key. */
const fixtureMint = async () => ({ ok: true as const, signer: { dropped: false, drop() { (this as { dropped: boolean }).dropped = true; } } });

const face = (name: string): SessionFace => ({
  personaGroup: `group-${name}`, proofSubject: `proof-${name}`, admitRef: `admit-${name}`,
  causalRevision: `revision-${name}`,
  planes: { persona: `persona-${name}`, circles: `circles-${name}`, identities: `identities-${name}`,
    sessions: `sessions-${name}`, intents: `intents-${name}` },
});

class Peer {
  private buf = "";
  private readonly replies: Array<Record<string, unknown>> = [];
  private readonly waiters: Array<(reply: Record<string, unknown>) => void> = [];
  private constructor(readonly sock: Socket) {
    sock.setEncoding("utf8");
    sock.on("data", (chunk: string) => {
      this.buf += chunk;
      let nl: number;
      while ((nl = this.buf.indexOf("\n")) !== -1) {
        const reply = JSON.parse(this.buf.slice(0, nl)) as Record<string, unknown>;
        this.buf = this.buf.slice(nl + 1);
        const waiter = this.waiters.shift();
        if (waiter) waiter(reply); else this.replies.push(reply);
      }
    });
  }
  static async connect(path: string): Promise<Peer> {
    const sock = createConnection(path);
    await new Promise<void>((resolve, reject) => { sock.once("connect", resolve); sock.once("error", reject); });
    return new Peer(sock);
  }
  next(): Promise<Record<string, unknown>> {
    const reply = this.replies.shift();
    return reply ? Promise.resolve(reply) : new Promise((resolve) => this.waiters.push(resolve));
  }
  send(frame: Record<string, unknown>): void { this.sock.write(JSON.stringify(frame) + "\n"); }
  ask(frame: Record<string, unknown>): Promise<Record<string, unknown>> { const reply = this.next(); this.send(frame); return reply; }
}

describe("UDS session socket, frames in flight", () => {
  test("pipelined frames answer in arrival order, a close queues behind the call, a vanished socket ends its session alone", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const workingHandle = repo.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
    composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(workingHandle, wikiSlotUri("daemon", "working")), writable: true });
    const dir = mkdtempSync(join(tmpdir(), "uds-session-pipeline-"));
    const claim = await claimStore(dir, { holder: "vessel" });
    const door: UdsSessionDoor = { anchorNow: async () => ({ kind: "place" as const, aid: "place-fixture" }), open: async ({ faceRef }) => ({ ok: true, supply: {
      face: face(faceRef), profile: "seat", presenter: `verified-${faceRef}`, anchor: { kind: "place" as const, aid: "place-fixture" }, mint: fixtureMint } }) };
    const placed: Array<{ verb: string; requestId: string; requestedBy: string; face?: string }> = [];
    let held: { requestId: string; requestedBy: string; face?: string; verb: string } | undefined;
    let markHeld: (() => void) | undefined;
    const heldStarted = new Promise<void>((resolve) => { markHeld = resolve; });
    const land = (o: { requestId: string; verb: string; requestedBy: string; face?: string }) => {
      const outcome = concludeVerb({ requestId: o.requestId, verb: o.verb, status: "done", requestedBy: o.requestedBy,
        ...(o.face !== undefined && { face: o.face }), cause: "test-worker", batchMode: "best-effort", results: { summary: { ok: true } } });
      daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
    };
    const channel = startUdsChannel({ daemonHandle, composite, claim, repo, sessions: door,
      placeVerb: (o) => {
        placed.push(o);
        if (o.verb === "hold") { held = o; markHeld?.(); return; }
        land(o);
      } });
    const a = await Peer.connect(claim.socketPath);
    const b = await Peer.connect(claim.socketPath);
    try {
      const openedA = await a.ask({ op: "session:open", requestId: "open-a", faceRef: "a", hand: "seat" });
      const openedB = await b.ask({ op: "session:open", requestId: "open-b", faceRef: "b", hand: "seat" });
      const envA = { ownerEpoch: openedA["ownerEpoch"], sessionId: openedA["sessionId"], generation: openedA["generation"], faceRef: openedA["faceRef"] };
      const envB = { ownerEpoch: openedB["ownerEpoch"], sessionId: openedB["sessionId"], generation: openedB["generation"], faceRef: openedB["faceRef"] };
      const call = (env: Record<string, unknown>, requestId: string, verb: string) =>
        ({ op: "session:call", ...env, requestId, verb, args: {} });

      // The second frame waits for the first's answer: nothing of it reaches the worker while the first holds.
      a.send(call(envA, "first", "hold"));
      a.send(call(envA, "second", "load"));
      a.send({ op: "session:close", ...envA });
      await heldStarted;
      expect(placed.map((p) => p.verb)).toEqual(["hold"]);
      // A sibling on another socket keeps acting while the first socket's call runs.
      expect(await b.ask(call(envB, "sibling", "load"))).toMatchObject({ kind: "session:result", requestId: "sibling", status: "done" });
      land(held!);
      expect(await a.next()).toMatchObject({ kind: "session:result", requestId: "first", status: "done" });
      expect(await a.next()).toMatchObject({ kind: "session:result", requestId: "second", status: "done" });
      expect(await a.next()).toMatchObject({ kind: "session:closed" });
      expect(placed.map((p) => p.verb)).toEqual(["hold", "load", "load"]);

      // A session closed on its socket opens nothing again: its envelope refuses on a fresh socket, by name.
      const c = await Peer.connect(claim.socketPath);
      await c.ask({ op: "session:open", requestId: "open-c", faceRef: "a", hand: "seat" });
      expect(await c.ask(call(envA, "after-close", "load"))).toMatchObject({ kind: "session:refused", refusal: "unknown-session" });
      c.sock.destroy();

      // A socket that goes while its call runs ends its session; its outcome still lands, and the sibling acts on.
      const d = await Peer.connect(claim.socketPath);
      const openedD = await d.ask({ op: "session:open", requestId: "open-d", faceRef: "d", hand: "seat" });
      const envD = { ownerEpoch: openedD["ownerEpoch"], sessionId: openedD["sessionId"], generation: openedD["generation"], faceRef: openedD["faceRef"] };
      const heldAgain = new Promise<void>((resolve) => { markHeld = resolve; });
      d.send(call(envD, "dropped", "hold"));
      await heldAgain;
      d.sock.destroy();
      land(held!);
      expect(await b.ask(call(envB, "sibling-2", "load"))).toMatchObject({ kind: "session:result", status: "done" });
      const e = await Peer.connect(claim.socketPath);
      await e.ask({ op: "session:open", requestId: "open-e", faceRef: "d", hand: "seat" });
      expect(await e.ask(call(envD, "after-drop", "load"))).toMatchObject({ kind: "session:refused", refusal: "unknown-session" });
      e.sock.destroy();
    } finally {
      a.sock.destroy(); b.sock.destroy(); channel.close(); await claim.release(); rmSync(dir, { recursive: true, force: true });
    }
  });
});
