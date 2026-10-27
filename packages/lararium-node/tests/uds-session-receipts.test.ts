import { describe, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, emptyLarDoc, concludeVerb, buildReceiptFact,
  faceScopedId, validateDurabilityReceipt, wikiSlotUri, type LarDoc } from "@lararium/mesh";
import type { SessionFace } from "@lararium/mesh/session-contract";
import { makeUdsSeat, serveUdsFront, type UdsSessionDoor } from "../src/uds-channel.js";
import { claimStore } from "../src/owned-store.js";

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

describe("face bound session receipts", () => {
  test("cross face reads and cancels reveal nothing; same ids and effect keys remain separate", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const originalFlush = repo.flush.bind(repo);
    let holdDurable = false;
    let releaseDurable: (() => void) | undefined;
    let markDurableEntered: (() => void) | undefined;
    const durableEntered = new Promise<void>((resolve) => { markDurableEntered = resolve; });
    const flush = vi.spyOn(repo, "flush").mockImplementation(async (documents) => {
      if (holdDurable && documents?.includes(daemonHandle.documentId)) {
        markDurableEntered?.();
        await new Promise<void>((resolve) => { releaseDurable = resolve; });
      }
      return originalFlush(documents);
    });
    const workingHandle = repo.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
    composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(workingHandle, wikiSlotUri("daemon", "working")), writable: true });
    const dir = mkdtempSync(join(tmpdir(), "uds-session-receipts-"));
    let claim = await claimStore(dir, { holder: "vessel" });
    const door: UdsSessionDoor = { open: async ({ faceRef }) => ({ ok: true, supply: {
      face: face(faceRef), profile: "seat", presenter: `verified-${faceRef}`, caps: ["load"] } }) };
    const placed: Array<{ requestId: string; requestedBy: string; face?: string; effectKey?: string }> = [];
    const effects = new Map<string, string>();
    let releaseHold: (() => void) | undefined;
    const holdStarted = new Promise<void>((resolve) => { releaseHold = resolve; });
    let held: { requestId: string; verb: string; requestedBy: string; face?: string } | undefined;
    const seat = () => makeUdsSeat({ daemonHandle, composite, claim, repo, sessions: door,
      placeVerb: (o) => {
        placed.push(o);
        if (o.verb === "hold") { held = o; releaseHold?.(); return; }
        const prior = o.effectKey === undefined ? undefined : effects.get(o.effectKey);
        if (o.effectKey && !prior) effects.set(o.effectKey, o.requestId);
        const outcome = concludeVerb({ requestId: o.requestId, verb: o.verb, status: "done",
          ...(o.face !== undefined && { face: o.face }),
          requestedBy: o.requestedBy, cause: "test-worker", batchMode: "best-effort",
          results: { summary: { ok: true, output: { args: o.args, ...(prior && { prior }) } } } });
        daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
      } });
    let front = serveUdsFront({ claim });
    front.attach(seat());
    const peers: Peer[] = [];
    const open = async (name: string) => {
      const peer = await Peer.connect(claim.socketPath);
      peers.push(peer);
      const opened = await peer.ask({ op: "session:open", requestId: `open-${name}`, faceRef: name, hand: "seat" });
      const env = { ownerEpoch: opened.ownerEpoch, sessionId: opened.sessionId,
        generation: opened.generation, faceRef: opened.faceRef };
      return { peer, env };
    };
    try {
      const a = await open("a");
      const b = await open("b");
      const call = (env: Record<string, unknown>, requestId: string, args: Record<string, unknown>, effectKey?: string) =>
        ({ op: "session:call", ...env, requestId, verb: "load", args, requestedBy: "verified-a", ...(effectKey && { effectKey }) });
      const ask = (peer: Peer, env: Record<string, unknown>, op: string, requestId: string) =>
        peer.ask({ op, ...env, requestId });
      const before = flush.mock.calls.length;
      holdDurable = true;
      let replyWritten = false;
      const firstReply = a.peer.ask(call(a.env, "a-only", { from: "a" }, "same-effect"))
        .then((answer) => { replyWritten = true; return answer; });
      await durableEntered;
      expect(replyWritten).toBe(false);
      holdDurable = false;
      releaseDurable?.();
      const resultA = await firstReply;
      expect(resultA).toMatchObject({ kind: "session:result", requestId: "a-only", status: "done" });
      expect(flush.mock.calls.length).toBeGreaterThan(before);
      expect(validateDurabilityReceipt(resultA.durable)).not.toBeNull();
      expect((resultA.durable as { heads: string[] }).heads).toEqual(daemonHandle.heads());
      expect((resultA.durable as { ownerEpoch: string }).ownerEpoch).toBe(a.env.ownerEpoch);
      expect(await ask(b.peer, b.env, "session:receipt", "a-only")).toMatchObject({ receipt: { state: "unknown", face: "proof-b" } });
      expect(await ask(b.peer, b.env, "session:cancel", "a-only")).toMatchObject({ receipt: { state: "abandoned" } });
      expect(await ask(a.peer, a.env, "session:receipt", "a-only")).toMatchObject({ receipt: { state: "done", face: "proof-a" } });
      expect(placed[0]).toMatchObject({ requestedBy: "verified-a", face: "proof-a", requestId: faceScopedId("proof-a", "a-only") });
      expect(await a.peer.ask(call(a.env, "shared-id", { from: "a" }))).toMatchObject({ status: "done" });
      expect(await b.peer.ask(call(b.env, "shared-id", { from: "b" }, "same-effect")))
        .toMatchObject({ status: "done", results: { summary: { output: { args: { from: "b" } } } } });
      expect(await ask(a.peer, a.env, "session:receipt", "shared-id")).toMatchObject({ receipt: { state: "done", face: "proof-a" } });
      expect(await ask(b.peer, b.env, "session:receipt", "shared-id")).toMatchObject({ receipt: { state: "done", face: "proof-b" } });
      expect(placed[2]).toMatchObject({ requestedBy: "verified-b", face: "proof-b", effectKey: faceScopedId("proof-b", "same-effect") });
      expect(await b.peer.ask(call(b.env, "b-only", { from: "b" }))).toMatchObject({ status: "done" });
      expect(await ask(a.peer, a.env, "session:receipt", "b-only")).toMatchObject({ receipt: { state: "unknown" } });
      expect(placed.at(-1)).toMatchObject({ requestedBy: "verified-b", face: "proof-b" });
      expect(await a.peer.ask(call(a.env, "next-a", { from: "a" }, "same-effect")))
        .toMatchObject({ status: "done", results: { summary: { output: { prior: faceScopedId("proof-a", "a-only") } } } });
      expect(await ask(a.peer, a.env, "session:receipt", "next-a")).toMatchObject({ receipt: { state: "done" } });
      const leaver = await open("a");
      void leaver.peer.ask({ op: "session:call", ...leaver.env, requestId: "held", verb: "hold", args: {} });
      await holdStarted;
      leaver.peer.destroy();
      const sameFaceReader = await open("a");
      const inFlight = await ask(sameFaceReader.peer, sameFaceReader.env, "session:receipt", "held");
      expect(inFlight).toMatchObject({ receipt: { state: "pending" } });
      expect((inFlight.receipt as { position: { durable?: unknown } }).position.durable).toBeUndefined();
      const landed = concludeVerb({ requestId: held!.requestId, verb: held!.verb, status: "done",
        ...(held!.face !== undefined && { face: held!.face }), requestedBy: held!.requestedBy,
        cause: "test-worker", batchMode: "best-effort", results: { summary: { ok: true } } });
      daemonHandle.change((doc) => { doc.tiddlers[landed.tiddler.title] = landed as unknown as LarDoc["tiddlers"][string]; });
      expect(await ask(sameFaceReader.peer, sameFaceReader.env, "session:receipt", "held"))
        .toMatchObject({ receipt: { state: "done" } });
      const pending = await ask(a.peer, a.env, "session:receipt", "never-seen");
      expect((pending.receipt as { position: { durable?: unknown } }).position.durable).toBeUndefined();
      const later = await open("a");
      expect(await ask(later.peer, later.env, "session:receipt", "a-only")).toMatchObject({ receipt: { state: "done" } });
      await composite.put(buildReceiptFact({ requestId: faceScopedId("proof-a", "unlanded"), state: "committed",
        inputDigest: "digest", bootEpoch: claim.bootEpoch, seq: 1000, face: "proof-a", action: "hold" }),
        { kind: "lares-verb", requestId: "unlanded" });
      await repo.flush();
      const priorBootEpoch = claim.bootEpoch;
      await front.detach();
      front.close();
      await claim.release();
      claim = await claimStore(dir, { holder: "vessel" });
      front = serveUdsFront({ claim });
      front.attach(seat());
      const restarted = await open("a");
      expect(await ask(restarted.peer, restarted.env, "session:receipt", "a-only"))
        .toMatchObject({ receipt: { state: "done", position: { durable: { docUrl: daemonHandle.url } } } });
      expect(await ask(restarted.peer, restarted.env, "session:receipt", "unlanded"))
        .toMatchObject({ receipt: { state: "interrupted", position: { bootEpoch: priorBootEpoch } } });
    } finally {
      for (const peer of peers) peer.destroy();
      front.close();
      await claim.release();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
