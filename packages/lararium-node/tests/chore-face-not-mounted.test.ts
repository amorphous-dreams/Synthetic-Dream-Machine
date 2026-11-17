/**
 * NO SILENT STEWARD (keeper-and-hands#/the-direction, red test 1). The daemon island mounts one face (the daemon mount), so
 * a chore the daemon runs (a meme write, a projection, a promote, a sweep: anything it writes or signs) spends the mount's
 * authority. A session wearing another lent face that asks one refuses `chore-face-not-mounted`, naming both faces, and
 * nothing places; the AI seat naming another lent face on the maintenance frame refuses the same way. A chore asked under
 * the mount places and its answer carries the receipt mark (`ChoreReceiptMark`: the acting face, the asker's hand, its session).
 * Reads keep their path, and a place row acts as the place.
 */
import { controlStoreOf } from "@lararium/mesh";
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, emptyLarDoc, concludeVerb, wikiSlotUri, type LarDoc } from "@lararium/mesh";
import type { SessionFace } from "@lararium/mesh/session-contract";
import { makeUdsSeat, serveUdsFront, type UdsSessionDoor, type UdsSessionSigner } from "../src/uds-channel.js";
import { claimStore } from "../src/owned-store.js";

const face = (name: string): SessionFace => ({
  personaGroup: `group-${name}`, proofSubject: `proof-${name}`, admitRef: `admit-${name}`, causalRevision: `revision-${name}`,
  planes: { persona: `persona-${name}`, circles: `circles-${name}`, identities: `identities-${name}`, sessions: `sessions-${name}`, intents: `intents-${name}` },
});

class Peer {
  private buf = "";
  private readonly waiters: Array<(reply: Record<string, unknown>) => void> = [];
  constructor(readonly sock: Socket) {
    sock.setEncoding("utf8");
    sock.on("data", (chunk: string) => {
      this.buf += chunk;
      let nl: number;
      while ((nl = this.buf.indexOf("\n")) !== -1) {
        const reply = JSON.parse(this.buf.slice(0, nl)) as Record<string, unknown>;
        this.buf = this.buf.slice(nl + 1);
        this.waiters.shift()?.(reply);
      }
    });
  }
  ask(frame: Record<string, unknown>): Promise<Record<string, unknown>> {
    const reply = new Promise<Record<string, unknown>>((resolve) => this.waiters.push(resolve));
    this.sock.write(JSON.stringify(frame) + "\n");
    return reply;
  }
}

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const c of cleanups.splice(0).reverse()) await c(); });

/** A seat whose daemon mounts h0 and whose holder lends {h0, h1}; a session's `faceRef` (`h<N>`) names the face it wears. */
async function stand() {
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const workingHandle = repo.create<LarDoc>(emptyLarDoc());
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
  composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(workingHandle, wikiSlotUri("daemon", "working")), writable: true });
  const dir = mkdtempSync(join(tmpdir(), "uds-chore-face-"));
  const claim = await claimStore(dir, { holder: "vessel" });
  const door: UdsSessionDoor = { anchorNow: async () => ({ kind: "nexus", aid: "nexus-one.synthetic" }), open: async ({ faceRef }) => ({ ok: true, supply: {
    face: face(faceRef), ordinal: Number(faceRef.slice(1)), profile: "seat", presenter: `verified-${faceRef}`,
    anchor: { kind: "nexus", aid: "nexus-one.synthetic" }, mint: async () => ({ ok: true, signer: { drop() {} } as unknown as UdsSessionSigner }) } }) };
  const placed: Array<{ verb: string; requestId: string; ordinal?: number }> = [];
  const front = serveUdsFront({ claim });
  front.attach(makeUdsSeat({ controlHandle: daemonHandle, control: controlStoreOf(daemonHandle), claim, repo: { flush: (ids) => repo.flush(ids) }, sessions: door,
    switchActs: { write: async () => {} },
    wornOrdinal: () => 0,
    lentOrdinals: async () => [0, 1],
    placeVerb: (o) => {
      placed.push(o);
      const outcome = concludeVerb({ requestId: o.requestId, verb: o.verb, status: "done", cause: "test-worker",
        batchMode: "best-effort", results: { summary: { ok: true, output: { landed: true } } } });
      daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
    } }));
  const connect = async (): Promise<Peer> => {
    const sock = createConnection(claim.socketPath);
    await new Promise<void>((resolve, reject) => { sock.once("connect", resolve); sock.once("error", reject); });
    cleanups.push(() => { sock.destroy(); });
    return new Peer(sock);
  };
  const peer = await connect();
  cleanups.push(async () => { front.close(); await claim.release(); await repo.shutdown(); rmSync(dir, { recursive: true, force: true }); });
  const open = async (faceRef: string) => {
    const opened = await peer.ask({ op: "session:open", requestId: `open-${faceRef}`, faceRef, hand: "cli" });
    return { ownerEpoch: opened["ownerEpoch"], sessionId: opened["sessionId"], generation: opened["generation"], faceRef: opened["faceRef"] };
  };
  /** One maintenance-frame line on its own socket, as the MCP seat sends it. */
  const oneShot = async (frame: Record<string, unknown>) => (await connect()).ask(frame);
  return { peer, open, placed, oneShot };
}

const MEME = { recipe: "default", uri: "lar:///ha.ka.ba/kahua/memory/project/steward", text: "x" };

test("RED RT1: a session wearing h1 (lent h0, h1; mount h0) asking a meme write refuses chore-face-not-mounted naming both faces, and nothing places", async () => {
  const v = await stand();
  const env = await v.open("h1");
  const reply = await v.peer.ask({ op: "session:call", ...env, requestId: "put-h1", verb: "meme-put", args: MEME });
  expect(reply).toMatchObject({ kind: "session:refused", requestId: "put-h1", refusal: "chore-face-not-mounted" });
  expect(String(reply["message"])).toMatch(/h1/);
  expect(String(reply["message"])).toMatch(/h0/);
  expect(v.placed).toEqual([]);
});

test("RED RT1: a projection chore (sweep, promote, reconcile) from the h1 session refuses by the same name; nothing places", async () => {
  const v = await stand();
  const env = await v.open("h1");
  for (const verb of ["sweep", "promote", "reconcile", "tiddler-put"]) {
    expect(await v.peer.ask({ op: "session:call", ...env, requestId: `chore-${verb}`, verb, args: {} }), verb)
      .toMatchObject({ kind: "session:refused", refusal: "chore-face-not-mounted" });
  }
  expect(v.placed).toEqual([]);
});

test("RED RT1: the AI seat naming lent h1 on the maintenance frame for a meme write refuses chore-face-not-mounted naming both faces; nothing places", async () => {
  const v = await stand();
  const reply = await v.oneShot({ verb: "meme-put", args: { ...MEME, face: 1 }, requestedBy: "0xseat", seat: "ai" });
  expect(reply).toMatchObject({ status: "error", refusal: { reason: "chore-face-not-mounted" } });
  expect(String(reply["errorMessage"])).toMatch(/h1/);
  expect(String(reply["errorMessage"])).toMatch(/h0/);
  expect(v.placed).toEqual([]);
});

test("CONTROL: the same meme write from a session wearing h0 places, and its answer carries the mark naming h0 as acting", async () => {
  const v = await stand();
  const env = await v.open("h0");
  const reply = await v.peer.ask({ op: "session:call", ...env, requestId: "put-h0", verb: "meme-put", args: MEME });
  expect(reply).toMatchObject({ kind: "session:result", requestId: "put-h0", status: "done", chore: { acting: 0, asker: "cli", session: env.sessionId } });
  expect(v.placed.map((p) => [p.verb, p.ordinal])).toEqual([["meme-put", 0]]);
});

test("CONTROL: the AI seat's meme write naming no face, or naming the mount, places and its mark names h0 as acting", async () => {
  const v = await stand();
  const mark = { acting: 0, asker: "seat", session: null };
  expect(await v.oneShot({ verb: "meme-put", args: MEME, requestedBy: "0xseat", seat: "ai" })).toMatchObject({ status: "done", chore: mark });
  expect(await v.oneShot({ verb: "meme-put", args: { ...MEME, face: 0 }, requestedBy: "0xseat", seat: "ai" })).toMatchObject({ status: "done", chore: mark });
  expect(v.placed.map((p) => p.verb)).toEqual(["meme-put", "meme-put"]);
});

test("CONTROL: reads keep their path from the h1 session (a meme read, a recall), and a place row acts as the place", async () => {
  const v = await stand();
  const env = await v.open("h1");
  for (const verb of ["meme-get", "recall", "floor-status"]) {
    const reply = await v.peer.ask({ op: "session:call", ...env, requestId: `read-${verb}`, verb, args: {} });
    expect(reply, verb).toMatchObject({ kind: "session:result", status: "done" });
    expect(reply["chore"], verb).toBeUndefined();
  }
  expect(v.placed.map((p) => p.verb)).toEqual(["meme-get", "recall", "floor-status"]);
});
