import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, emptyLarDoc, concludeVerb, wikiSlotUri,
  type LarDoc, type SessionFace } from "@lararium/mesh";
import { startUdsChannel, type UdsSessionDoor } from "../src/uds-channel.js";
import { claimStore } from "../src/owned-store.js";

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
  ask(frame: Record<string, unknown>): Promise<Record<string, unknown>> {
    const reply = this.next();
    this.sock.write(JSON.stringify(frame) + "\n");
    return reply;
  }
  end(): void { this.sock.end(); }
}

describe("UDS session socket", () => {
  test("binding and face refusals leave both sessions acting; the worker sees the supplier's presenter", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const workingHandle = repo.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
    composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(workingHandle, wikiSlotUri("daemon", "working")), writable: true });
    const dir = mkdtempSync(join(tmpdir(), "uds-session-"));
    const claim = await claimStore(dir, { holder: "vessel" });
    const placed: Array<{ requestedBy: string; face?: string; requestId: string }> = [];
    const door: UdsSessionDoor = { open: async ({ faceRef }) => ({ ok: true, supply: {
      face: face(faceRef === "hint-b" ? "b" : "a"), profile: "seat", presenter: `verified-${faceRef}`, caps: ["load"],
    } }) };
    const start = (sessions?: UdsSessionDoor) => startUdsChannel({
      daemonHandle, composite, claim, repo, ...(sessions && { sessions }),
      placeVerb: (o) => {
        placed.push(o);
        const outcome = concludeVerb({ requestId: o.requestId, verb: o.verb, status: "done",
          requestedBy: o.requestedBy, cause: "test-worker", batchMode: "best-effort", results: { summary: { ok: true } } });
        daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
      },
    });
    const channel = start(door);
    const a = await Peer.connect(claim.socketPath);
    const b = await Peer.connect(claim.socketPath);
    try {
      const openedA = await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" });
      const openedB = await b.ask({ op: "session:open", requestId: "open-b", faceRef: "hint-b", hand: "seat" });
      expect(openedA).toMatchObject({ kind: "session:opened", faceRef: "proof-a", generation: 0, caps: ["load"] });
      expect(openedB).toMatchObject({ kind: "session:opened", faceRef: "proof-b" });
      expect(await a.ask({ op: "session:open", requestId: "open-again", faceRef: "hint-b", hand: "seat" }))
        .toMatchObject({ kind: "session:refused", refusal: "binding-already-bound" });
      const envA = { ownerEpoch: openedA["ownerEpoch"], sessionId: openedA["sessionId"],
        generation: openedA["generation"], faceRef: openedA["faceRef"] };
      const envB = { ownerEpoch: openedB["ownerEpoch"], sessionId: openedB["sessionId"],
        generation: openedB["generation"], faceRef: openedB["faceRef"] };
      const call = (env: Record<string, unknown>, requestId: string) =>
        ({ op: "session:call", ...env, requestId, verb: "load", args: {}, requestedBy: "forged-other-face" });
      const before = placed.length;
      expect(await b.ask(call(envA, "copied"))).toMatchObject({ kind: "session:refused", refusal: "unbound-session" });
      expect(await a.ask(call({ ...envA, faceRef: "proof-b" }, "wrong"))).toMatchObject({ kind: "session:refused", refusal: "wrong-face" });
      expect(await a.ask(call({ ...envA, generation: 1 }, "stale"))).toMatchObject({ kind: "session:refused", refusal: "stale-generation" });
      expect(placed).toHaveLength(before);
      expect(await a.ask(call(envA, "good-a"))).toMatchObject({ kind: "session:result", status: "done" });
      expect(placed.at(-1)).toMatchObject({ requestedBy: "verified-hint-a", face: "proof-a" });
      expect(await b.ask(call(envB, "good-b"))).toMatchObject({ kind: "session:result", status: "done" });
      expect(placed.at(-1)).toMatchObject({ requestedBy: "verified-hint-b", face: "proof-b" });
      const maintenance = await Peer.connect(claim.socketPath);
      expect(await maintenance.ask({ verb: "load", args: {}, requestedBy: "maintenance", requestId: "one-shot" })).toMatchObject({ status: "done" });
      maintenance.end();
      expect(await a.ask({ op: "session:close", ...envA })).toMatchObject({ kind: "session:closed" });
      expect(await b.ask({ op: "session:close", ...envB })).toMatchObject({ kind: "session:closed" });
    } finally {
      a.end(); b.end(); channel.close(); await claim.release(); rmSync(dir, { recursive: true, force: true });
    }
  });
  test("a session open with no supplier refuses by name", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const workingHandle = repo.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
    composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(workingHandle, wikiSlotUri("daemon", "working")), writable: true });
    const dir = mkdtempSync(join(tmpdir(), "uds-no-door-"));
    const claim = await claimStore(dir, { holder: "vessel" });
    const channel = startUdsChannel({ daemonHandle, composite, claim, repo, placeVerb: () => { throw new Error("no verb should run"); } });
    const peer = await Peer.connect(claim.socketPath);
    try {
      expect(await peer.ask({ op: "session:open", requestId: "no-door", faceRef: "hint-a", hand: "seat" }))
        .toMatchObject({ kind: "session:refused", requestId: "no-door", refusal: "no-session-door" });
    } finally {
      peer.end(); channel.close(); await claim.release(); rmSync(dir, { recursive: true, force: true });
    }
  });

});
