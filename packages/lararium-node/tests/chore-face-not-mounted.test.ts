/**
 * NO SILENT STEWARD (keeper-and-hands#/the-direction, red test 1). The daemon island mounts one face (the daemon mount), so
 * a chore the daemon runs (a meme write, a projection, a promote, a sweep: anything it writes or signs) spends the mount's
 * authority. A session wearing another lent face that asks one refuses `chore-face-not-mounted`, naming both faces, and
 * nothing places; the AI seat naming another lent face on the maintenance frame refuses the same way. A chore asked under
 * the mount places and its answer carries the receipt mark (`ChoreReceiptMark`: the acting face, the asker's hand, its session).
 * Reads keep their path, and a place row acts as the place.
 */
import { CHORE_FREE_VERBS } from "../src/chore-face.js";
import { controlStoreOf } from "@lararium/mesh";
import { afterEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, emptyLarDoc, concludeVerb, wikiSlotUri, type LarDoc } from "@lararium/mesh";
import type { SessionFace } from "@lararium/mesh/session-contract";
import { makeUdsSeat, serveUdsFront, type UdsSessionDoor, type UdsSessionSigner } from "../src/uds-channel.js";
import { claimStore } from "../src/owned-store.js";
import { SessionSignBook, type BookedSession } from "@lararium/mesh";
import { faceLives, type FaceLives } from "../src/face-lifecycle.js";

// A caller's wait reads the seat's own floor alone here (no learned servo), so a test can let one give up in a breath.
vi.mock("@lararium/mempalace", async (actual) => ({ ...(await actual<typeof import("@lararium/mempalace")>()), adaptiveTimeoutMs: () => 0 }));

const face = (name: string): SessionFace => ({
  personaGroup: `group-${name}`, proofSubject: `proof-${name}`, admitRef: `admit-${name}`, causalRevision: `revision-${name}`,
  planes: { persona: `persona-${name}`, circles: `circles-${name}`, identities: `identities-${name}`, sessions: `sessions-${name}`, intents: `intents-${name}` },
});

class Peer {
  private buf = "";
  private readonly waiters: Array<(reply: Record<string, unknown>) => void> = [];
  /** Every reply this peer read, in order. */
  readonly heard: Array<Record<string, unknown>> = [];
  constructor(readonly sock: Socket) {
    sock.setEncoding("utf8");
    sock.on("data", (chunk: string) => {
      this.buf += chunk;
      let nl: number;
      while ((nl = this.buf.indexOf("\n")) !== -1) {
        const reply = JSON.parse(this.buf.slice(0, nl)) as Record<string, unknown>;
        this.buf = this.buf.slice(nl + 1);
        this.heard.push(reply);
        this.waiters.shift()?.(reply);
      }
    });
  }
  /** Send a frame without waiting on an answer in order: read it back from `heard` by its requestId. */
  send(frame: Record<string, unknown>): void { this.waiters.push(() => {}); this.sock.write(JSON.stringify(frame) + "\n"); }
  ask(frame: Record<string, unknown>): Promise<Record<string, unknown>> {
    const reply = new Promise<Record<string, unknown>>((resolve) => this.waiters.push(resolve));
    this.sock.write(JSON.stringify(frame) + "\n");
    return reply;
  }
}

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const c of cleanups.splice(0).reverse()) await c(); });

/** A seat whose daemon mounts h0 and whose holder lends {h0, h1}; a session's `faceRef` (`h<N>`) names the face it wears. */
async function stand(lane: { readonly lit?: readonly number[]; readonly signers?: SessionSignBook; readonly faceLife?: FaceLives; readonly visitVerbs?: ReadonlySet<string>; readonly hold?: ReadonlySet<string>; readonly timeoutMs?: number;
  readonly output?: (o: { verb: string; args: Record<string, unknown> }) => Record<string, unknown>; readonly petnames?: ReadonlyArray<readonly [number, string]> } = {}) {
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
  const placed: Array<{ verb: string; requestId: string; ordinal?: number; args: Record<string, unknown>; requestedBy: string }> = [];
  const held: Array<() => void> = [];
  const front = serveUdsFront({ claim });
  front.attach(makeUdsSeat({ controlHandle: daemonHandle, control: controlStoreOf(daemonHandle), claim, repo: { flush: (ids) => repo.flush(ids) }, sessions: door,
    switchActs: { write: async () => {} },
    mountOrdinal: () => 0,
    lentOrdinals: async () => [0, 1],
    ...(lane.lit ? { litOrdinals: () => lane.lit!, siblingFaceOf: (presenter: string) => presenter === "verified-h1" && lane.lit!.includes(1) ? "atom-h1" : undefined } : {}),
    ...(lane.signers ? { signers: lane.signers } : {}),
    ...(lane.faceLife ? { faceLife: lane.faceLife } : {}),
    ...(lane.visitVerbs ? { visitVerbs: lane.visitVerbs } : {}),
    ...(lane.timeoutMs !== undefined ? { timeoutMs: lane.timeoutMs } : {}),
    ...(lane.petnames ? { petnames: async () => lane.petnames! } : {}),
    placeVerb: (o) => {
      placed.push(o);
      // The worker stamps the mark its placement carried, as the island's dispatcher does (`writeOutcome`).
      const land = () => {
        const outcome = concludeVerb({ requestId: o.requestId, verb: o.verb, status: "done", cause: "test-worker",
          batchMode: "best-effort", results: { summary: { ok: true, output: lane.output ? lane.output(o) : { landed: true } } }, ...(o.chore ? { chore: o.chore } : {}) });
        daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
      };
      // A held verb's outcome lands only when the test releases it: its reply is still on its way.
      if (lane.hold?.has(o.verb)) held.push(land); else land();
    } }));
  const connect = async (): Promise<Peer> => {
    const sock = createConnection(claim.socketPath);
    await new Promise<void>((resolve, reject) => { sock.once("connect", resolve); sock.once("error", reject); });
    cleanups.push(() => { sock.destroy(); });
    return new Peer(sock);
  };
  const peer = await connect();
  cleanups.push(async () => { front.close(); await claim.release(); await repo.shutdown(); rmSync(dir, { recursive: true, force: true }); });
  const open = async (faceRef: string, on: Peer = peer) => {
    const opened = await on.ask({ op: "session:open", requestId: `open-${faceRef}`, faceRef, hand: "cli" });
    return { ownerEpoch: opened["ownerEpoch"], sessionId: opened["sessionId"], generation: opened["generation"], faceRef: opened["faceRef"] };
  };
  /** One maintenance-frame line on its own socket, as the MCP seat sends it. */
  const oneShot = async (frame: Record<string, unknown>) => (await connect()).ask(frame);
  const release = () => { for (const land of held.splice(0)) land(); };
  return { peer, open, placed, oneShot, connect, release };
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
  for (const verb of ["tiddler-get", "recall", "floor-status"]) {
    const reply = await v.peer.ask({ op: "session:call", ...env, requestId: `read-${verb}`, verb, args: {} });
    expect(reply, verb).toMatchObject({ kind: "session:result", status: "done" });
    expect(reply["chore"], verb).toBeUndefined();
  }
  expect(v.placed.map((p) => p.verb)).toEqual(["tiddler-get", "recall", "floor-status"]);
  // The internal `meme-get` holds no surface and no chore-free seat: a sibling session's call to it reads as a chore.
  expect(CHORE_FREE_VERBS).not.toHaveProperty("meme-get");
});

// THE ASKER RIDES THE PLACEMENT (seat-canon-reach, T4-2): the door hands the hand it read (`seat` off the seat kind, `cli`
// for the operator's own line, the session's own hand) to the placed ask, so the reactor's context can name it. Never read
// off the frame: a line naming its own `asker` places under the hand the door read.
const askerOf = (p: unknown): unknown => (p as { asker?: unknown }).asker;

test("RED: the AI seat's one-shot meme write places with asker seat; the operator's line with asker cli", async () => {
  const v = await stand();
  await v.oneShot({ verb: "meme-put", args: MEME, requestedBy: "0xseat", seat: "ai" });
  await v.oneShot({ verb: "meme-put", args: MEME, requestedBy: "0xop" });
  expect(v.placed.map(askerOf)).toEqual(["seat", "cli"]);
});

test("RED: a frame naming its own asker never chooses it: an unmarked line claiming asker tab places as cli; a seat line claiming cli places as seat", async () => {
  const v = await stand();
  await v.oneShot({ verb: "meme-put", args: MEME, requestedBy: "0xop", asker: "tab" });
  await v.oneShot({ verb: "meme-put", args: MEME, requestedBy: "0xseat", seat: "ai", asker: "cli" });
  expect(v.placed.map(askerOf)).toEqual(["cli", "seat"]);
});

test("RED: a session's call places with the session's own hand; CONTROL: a read from the session places with it too", async () => {
  const v = await stand();
  const opened = await v.peer.ask({ op: "session:open", requestId: "open-tab", faceRef: "h0", hand: "tab" });
  const env = { ownerEpoch: opened["ownerEpoch"], sessionId: opened["sessionId"], generation: opened["generation"], faceRef: opened["faceRef"] };
  await v.peer.ask({ op: "session:call", ...env, requestId: "put-hand", verb: "meme-put", args: MEME });
  await v.peer.ask({ op: "session:call", ...env, requestId: "read-hand", verb: "tiddler-get", args: {} });
  expect(v.placed.map(askerOf)).toEqual(["tab", "tab"]);
});

// THE MARK RESTS WITH THE WRITE (T4-5): the chore mark rides the placement into the durable outcome, and a receipt read on a
// fresh connection (a reconnect, `lares vessel request <id>`) answers it, not the socket's answer alone.
test("RED: the seat's meme write places with its chore mark, and a later receipt read answers that mark; CONTROL: a read carries none", async () => {
  const v = await stand();
  const mark = { acting: 0, asker: "seat", session: null };
  await v.oneShot({ verb: "meme-put", args: MEME, requestedBy: "0xseat", seat: "ai", requestId: "put-mark" });
  expect((v.placed[0] as { chore?: unknown }).chore).toEqual(mark);
  expect(await v.oneShot({ op: "receipt", requestId: "put-mark" })).toMatchObject({ requestId: "put-mark", state: "done", chore: mark });
  await v.oneShot({ verb: "tiddler-get", args: MEME, requestedBy: "0xseat", seat: "ai", requestId: "get-mark" });
  expect((v.placed[1] as { chore?: unknown }).chore).toBeUndefined();
  expect(await v.oneShot({ op: "receipt", requestId: "get-mark" })).not.toHaveProperty("chore");
});

// ── EACH HAT REACHED BY NAME: a LIT sibling's own lane ───────────────────────────────────────────────────────────────
test("EACH HAT REACHED BY NAME: a session wearing LIT h1 asking a meme write places AS h1 (its mark names h1 acting), and the call books h1's own face key, never the mount's chain", async () => {
  const held: Array<{ verb: string; face?: string }> = [];
  const signers = new SessionSignBook({ onHold: (session: BookedSession, verb: string) => { held.push({ verb, ...(session.face !== undefined ? { face: session.face } : {}) }); } });
  const v = await stand({ lit: [1], signers });
  const env = await v.open("h1");
  for (const verb of ["meme-put", "meme-delete"]) {
    const reply = await v.peer.ask({ op: "session:call", ...env, requestId: `lane-${verb}`, verb, args: MEME });
    expect(reply, verb).toMatchObject({ kind: "session:result", status: "done", chore: { acting: 1, asker: "cli", session: env.sessionId } });
  }
  expect(v.placed.map((p) => [p.verb, p.ordinal])).toEqual([["meme-put", 1], ["meme-delete", 1]]);
  expect(held.filter((h) => h.verb !== "session:seat")).toEqual([{ verb: "meme-put", face: "atom-h1" }, { verb: "meme-delete", face: "atom-h1" }]);
  expect(held.find((h) => h.verb === "session:seat")).toEqual({ verb: "session:seat", face: "atom-h1" });
});

test("EACH HAT REACHED BY NAME: a session wearing LIT h1 asking a tiddler write places AS h1 (its own engine's write), and books h1's own face key", async () => {
  const held: Array<{ verb: string; face?: string }> = [];
  const signers = new SessionSignBook({ onHold: (session: BookedSession, verb: string) => { held.push({ verb, ...(session.face !== undefined ? { face: session.face } : {}) }); } });
  const v = await stand({ lit: [1], signers });
  const env = await v.open("h1");
  for (const verb of ["tiddler-put", "tiddler-delete", "oracle-cast"]) {
    const reply = await v.peer.ask({ op: "session:call", ...env, requestId: `engine-${verb}`, verb, args: { recipe: "default", title: "T" } });
    expect(reply, verb).toMatchObject({ kind: "session:result", status: "done", chore: { acting: 1, asker: "cli", session: env.sessionId } });
  }
  expect(v.placed.map((p) => [p.verb, p.ordinal])).toEqual([["tiddler-put", 1], ["tiddler-delete", 1], ["oracle-cast", 1]]);
  expect(held.filter((h) => h.verb !== "session:seat")).toEqual([{ verb: "tiddler-put", face: "atom-h1" }, { verb: "tiddler-delete", face: "atom-h1" }, { verb: "oracle-cast", face: "atom-h1" }]);
});

test("EACH HAT REACHED BY NAME, CONTROL: the lane carries its own writes alone; a lit h1's sweep still refuses chore-face-not-mounted, and h0's session books no face key", async () => {
  const held: Array<{ verb: string; face?: string }> = [];
  const signers = new SessionSignBook({ onHold: (session: BookedSession, verb: string) => { held.push({ verb, ...(session.face !== undefined ? { face: session.face } : {}) }); } });
  const v = await stand({ lit: [1], signers });
  const env = await v.open("h1");
  for (const verb of ["sweep", "meme-patch"]) {
    expect(await v.peer.ask({ op: "session:call", ...env, requestId: `fenced-${verb}`, verb, args: {} }), verb)
      .toMatchObject({ kind: "session:refused", refusal: "chore-face-not-mounted" });
  }
  const other = await v.connect();
  const mount = await v.open("h0", other);
  expect(await other.ask({ op: "session:call", ...mount, requestId: "put-mount", verb: "meme-put", args: MEME })).toMatchObject({ status: "done", chore: { acting: 0 } });
  expect(held.filter((h) => h.verb === "meme-put")).toEqual([{ verb: "meme-put" }]);
});


/** The face actors a door admits through, over a scripted island: each face adopted lit; drains wait on the test's hand. */
function actors(...ordinals: number[]) {
  const drains: Array<() => void> = [];
  const lives = faceLives({
    light: async () => ({ atomKey: null, custody: null }),
    drainSaves: () => new Promise<void>((resolve) => { drains.push(resolve); }),
    dropWorker: async () => {}, teardownHost: () => {}, recompose: async () => {}, log: () => {},
  }, { nonce: "door" });
  for (const ordinal of ordinals) lives.adopt(ordinal, { atomKey: `k${ordinal}`, custody: null });
  return { lives, drains };
}
const VISIT = new Set(["tiddler-get"]);
const replyTo = (peer: Peer, requestId: string) => peer.heard.filter((r) => r["requestId"] === requestId);

test("SOL R6 M (writes enter during the drain): a write dispatched before the close holds the drain until it settles; one sent after refuses face-closing and nothing places", async () => {
  const { lives, drains } = actors(0, 1);
  const v = await stand({ faceLife: lives, hold: new Set(["meme-put"]) });
  const env = await v.open("h0");
  v.peer.send({ op: "session:call", ...env, requestId: "put-before", verb: "meme-put", args: MEME });
  await vi.waitFor(() => expect(v.placed.map((p) => p.verb)).toEqual(["meme-put"]));
  const closed = lives.close(0, "lock");
  await new Promise((r) => setImmediate(r));
  expect(drains, "the drain waits out the write already dispatched").toHaveLength(0);
  const after = await (await v.connect()).ask({ op: "session:open", requestId: "open-again", faceRef: "h0", hand: "cli" });
  expect(after).toMatchObject({ kind: "session:opened" });
  v.release();
  await vi.waitFor(() => expect(replyTo(v.peer, "put-before")[0]).toMatchObject({ status: "done" }));
  await vi.waitFor(() => expect(drains).toHaveLength(1));
  const other = await v.connect();
  const env2 = await v.open("h0", other);
  expect(await other.ask({ op: "session:call", ...env2, requestId: "put-during", verb: "meme-put", args: MEME }))
    .toMatchObject({ kind: "session:result", status: "error", refusal: { reason: "face-closing" } });
  expect(v.placed.map((p) => p.requestId).filter((id) => id.includes("put-during"))).toEqual([]);
  drains[0]!();
  await closed;
});

test("SOL R6 H (a reply after close across an await): a visit whose reply is on its way when the target closes answers face-not-open once, and its body never leaves", async () => {
  const { lives, drains } = actors(0, 1);
  const v = await stand({ lit: [1], faceLife: lives, visitVerbs: VISIT, hold: new Set(["tiddler-get"]) });
  const env = await v.open("h0");
  v.peer.send({ op: "session:call", ...env, requestId: "visit-h1", verb: "tiddler-get", args: { title: "x", target: 1 } });
  await vi.waitFor(() => expect(v.placed.map((p) => p.verb)).toEqual(["tiddler-get"]));
  const closed = lives.close(1, "pulama closing");
  await vi.waitFor(() => expect(replyTo(v.peer, "visit-h1")).toHaveLength(1));
  expect(replyTo(v.peer, "visit-h1")[0]).toMatchObject({ status: "error", refusal: { reason: "face-not-open" } });
  v.release();
  await new Promise((r) => setTimeout(r, 200));
  expect(replyTo(v.peer, "visit-h1"), "the body never writes after the close").toHaveLength(1);
  drains[0]!(); await closed;
});

test("SOL R6 M (a silent confirm blocks the session): a visit's reply rides its own request id, so the session answers its next frame while the visit still waits", async () => {
  const { lives } = actors(0, 1);
  const v = await stand({ lit: [1], faceLife: lives, visitVerbs: VISIT, hold: new Set(["tiddler-get"]) });
  const env = await v.open("h0");
  v.peer.send({ op: "session:call", ...env, requestId: "visit-slow", verb: "tiddler-get", args: { title: "x", target: 1 } });
  v.peer.send({ op: "session:call", ...env, requestId: "put-next", verb: "meme-put", args: MEME });
  await vi.waitFor(() => expect(replyTo(v.peer, "put-next")[0]).toMatchObject({ status: "done" }));
  expect(replyTo(v.peer, "visit-slow"), "the visit still waits on its own channel").toEqual([]);
  v.release();
  await vi.waitFor(() => expect(replyTo(v.peer, "visit-slow")[0]).toMatchObject({ status: "done" }));
});

test("a visit to a face its actor holds shut refuses face-not-open at the door, and nothing places", async () => {
  const { lives } = actors(0);
  const v = await stand({ faceLife: lives, visitVerbs: VISIT });
  const env = await v.open("h0");
  expect(await v.peer.ask({ op: "session:call", ...env, requestId: "visit-shut", verb: "tiddler-get", args: { title: "x", target: 2 } }))
    .toMatchObject({ status: "error", refusal: { reason: "face-not-open" } });
  expect(v.placed).toEqual([]);
});

test("SOL R7 (a caller timeout releases the work ticket): the caller's wait gives up while the verb runs on, and the face's drain waits for the verb itself", async () => {
  const { lives, drains } = actors(0, 1);
  const v = await stand({ faceLife: lives, hold: new Set(["meme-put"]), timeoutMs: 300 });
  const env = await v.open("h0");
  v.peer.send({ op: "session:call", ...env, requestId: "put-slow", verb: "meme-put", args: MEME });
  await vi.waitFor(() => expect(replyTo(v.peer, "put-slow")[0]).toMatchObject({ status: "unknown" }), { timeout: 5000 });
  const closed = lives.close(0, "lock");
  await new Promise((r) => setTimeout(r, 300));
  expect(drains, "the verb still runs, so no drain begins").toHaveLength(0);
  v.release();
  await vi.waitFor(() => expect(drains).toHaveLength(1));
  drains[0]!(); await closed;
});

test("SOL R7 (a second response after a close refusal): a visit refused at the close answers nothing more when its caller's wait gives up", async () => {
  const { lives, drains } = actors(0, 1);
  const v = await stand({ lit: [1], faceLife: lives, visitVerbs: VISIT, hold: new Set(["tiddler-get"]), timeoutMs: 300 });
  const env = await v.open("h0");
  v.peer.send({ op: "session:call", ...env, requestId: "visit-once", verb: "tiddler-get", args: { title: "x", target: 1 } });
  await vi.waitFor(() => expect(v.placed.map((p) => p.verb)).toEqual(["tiddler-get"]));
  const closed = lives.close(1, "pulama closing");
  await vi.waitFor(() => expect(replyTo(v.peer, "visit-once")).toHaveLength(1));
  await new Promise((r) => setTimeout(r, 800));
  v.release();
  await new Promise((r) => setTimeout(r, 200));
  expect(replyTo(v.peer, "visit-once"), "one answer, the close's refusal").toHaveLength(1);
  expect(replyTo(v.peer, "visit-once")[0]).toMatchObject({ refusal: { reason: "face-not-open" } });
  drains[0]!(); await closed;
});

/**
 * A LIT FACE RECEIVES VISITS at the vessel's door (the re-cut of #407 onto the face actor): the door resolves a visit's `target`
 * (an ordinal, `h<N>` or a pet name) and refuses a private bag, a write naming another face and an ambiguous name before any
 * gate; then the visit admits on its TARGET's actor and its answer delivers through that actor's mailbox, on a session and on
 * the one-shot line alike. "The face worn" names the session's own face, and the mount on the one-shot line, which presents the
 * worn face alone. A visit's body answers its caller once: every later retrieval withholds it.
 */
const READ = { recipe: "default", title: "T" };
const visitOut = (o: { verb: string; args: Record<string, unknown> }) =>
  (o.args["target"] !== undefined ? { face: o.args["target"], worn: 0, visit: true, tiddler: { text: "the visited word" } } : { tiddler: { text: "own" } });
const VISITS = new Set(["tiddler-get", "wiki-filter", "wiki-render", "wiki-status", "meme-list"]);

test("RED XV1 (#407 H1): a session wearing lit h1 that targets the mount keeps its target past the door, by ordinal and by pet name, and admits on h0's actor", async () => {
  const { lives } = actors(0, 1);
  const v = await stand({ lit: [1], faceLife: lives, visitVerbs: VISITS, output: visitOut, petnames: [[0, "Mara"], [1, "Wren"]] });
  const env = await v.open("h1");
  for (const [requestId, target] of [["by-ordinal", 0], ["by-handle", "h0"], ["by-name", "mara"]] as const) {
    const reply = await v.peer.ask({ op: "session:call", ...env, requestId, verb: "tiddler-get", args: { ...READ, target } });
    expect(reply, requestId).toMatchObject({ kind: "session:result", status: "done" });
    expect(JSON.stringify(reply), requestId).toContain("the visited word");
  }
  expect(v.placed.map((p) => p.args["target"]), "the door resolves each spelling to the mount's ordinal").toEqual([0, 0, 0]);
  // A target naming the face the session wears reads as no target, and runs as its own read.
  await v.peer.ask({ op: "session:call", ...env, requestId: "own", verb: "tiddler-get", args: { ...READ, target: "Wren" } });
  expect(v.placed.at(-1)!.args).not.toHaveProperty("target");
});

test("RED XV2 (#407 H4): a one-shot line naming a lit sibling as its presenter refuses presenter-rides-a-session, and nothing places; the worn face's line places", async () => {
  const v = await stand({ lit: [1] });
  expect(await v.oneShot({ verb: "tiddler-get", args: READ, requestedBy: "verified-h1" })).toMatchObject({ status: "error", refusal: { reason: "presenter-rides-a-session" } });
  expect(v.placed).toEqual([]);
  expect(await v.oneShot({ verb: "tiddler-get", args: READ, requestedBy: "0xplace" })).toMatchObject({ status: "done" });
});

test("RED XV3 (#407 H2): a visit's body answers its caller once; a receipt under its id (one-shot or session) and a re-ask withhold it", async () => {
  const { lives } = actors(0, 1);
  const v = await stand({ lit: [1], faceLife: lives, visitVerbs: VISITS, output: visitOut });
  const live = await v.oneShot({ verb: "tiddler-get", args: { ...READ, target: 1 }, requestedBy: "0xplace", requestId: "visit-once" });
  expect(JSON.stringify(live), "the caller reads the visit").toContain("the visited word");
  const later = await v.oneShot({ op: "receipt", requestId: "visit-once" });
  expect(later).toMatchObject({ requestId: "visit-once", state: "done", visit: { withheld: true } });
  expect(JSON.stringify(later), "a receipt hands no visit body back").not.toContain("the visited word");
  const again = await v.oneShot({ verb: "tiddler-get", args: { ...READ, target: 1 }, requestedBy: "0xplace", requestId: "visit-once" });
  expect(JSON.stringify(again), "a re-ask under the same id hands no stored body back").not.toContain("the visited word");
  const env = await v.open("h0");
  const call = await v.peer.ask({ op: "session:call", ...env, requestId: "s-visit", verb: "tiddler-get", args: { ...READ, target: 1 } });
  expect(JSON.stringify(call)).toContain("the visited word");
  const receipt = await v.peer.ask({ op: "session:receipt", ...env, requestId: "s-visit" });
  expect(JSON.stringify(receipt), "a session receipt hands no visit body back").not.toContain("the visited word");
  // CONTROL: an own read's body still reads back.
  await v.oneShot({ verb: "tiddler-get", args: READ, requestedBy: "0xplace", requestId: "own-read" });
  expect(JSON.stringify(await v.oneShot({ op: "receipt", requestId: "own-read" }))).toContain("own");
});

test("RED XV4 (#407 H2, Sol 407c-f on the one-shot line): a one-shot visit admits on its target's actor: a shut target refuses face-not-open and nothing places, and a target that closes before the answer leaves delivers face-not-open once, with no body", async () => {
  const { lives, drains } = actors(0, 1);
  const v = await stand({ lit: [1], faceLife: lives, visitVerbs: VISITS, output: visitOut, hold: new Set(["tiddler-get"]) });
  expect(await v.oneShot({ verb: "tiddler-get", args: { ...READ, target: 7 }, requestedBy: "0xplace", requestId: "shut" }))
    .toMatchObject({ status: "error", refusal: { reason: "face-not-open" } });
  expect(v.placed).toEqual([]);
  const peer = await v.connect();
  peer.send({ verb: "tiddler-get", args: { ...READ, target: 1 }, requestedBy: "0xplace", requestId: "closing" });
  await vi.waitFor(() => expect(v.placed.map((p) => p.verb)).toEqual(["tiddler-get"]));
  const closed = lives.close(1, "pulama closing");
  await vi.waitFor(() => expect(peer.heard).toHaveLength(1));
  expect(peer.heard[0]).toMatchObject({ status: "error", refusal: { reason: "face-not-open" } });
  v.release();
  await new Promise((r) => setTimeout(r, 200));
  expect(peer.heard, "one answer: the close's refusal; the body never leaves").toHaveLength(1);
  expect(JSON.stringify(peer.heard)).not.toContain("the visited word");
  drains[0]!(); await closed;
});

test("RED XV5 (#407 M1, M3): the door refuses a private bag first, then a write naming another face, then an unknown or doubled pet name, before any gate; nothing places", async () => {
  const { lives } = actors(0, 1);
  const v = await stand({ lit: [1], faceLife: lives, visitVerbs: VISITS, petnames: [[1, "Wren"], [2, "wren"], [3, "4"]] });
  const env = await v.open("h0");
  const ask = (requestId: string, verb: string, args: Record<string, unknown>) => v.peer.ask({ op: "session:call", ...env, requestId, verb, args });
  expect(await ask("private", "tiddler-get", { title: "lar:///t/x", bag: "lar:///ha.ka.ba/wikis/daemon/personal", target: "nobody" })).toMatchObject({ kind: "session:refused", refusal: "cross-face-private" });
  expect(await ask("write", "tiddler-put", { ...READ, text: "x", target: 1 })).toMatchObject({ kind: "session:refused", refusal: "cross-face-write-refused" });
  expect(await ask("unknown", "tiddler-get", { ...READ, target: "nobody" })).toMatchObject({ kind: "session:refused", refusal: "target-unknown" });
  expect(await ask("doubled", "tiddler-get", { ...READ, target: "WREN" })).toMatchObject({ kind: "session:refused", refusal: "target-ambiguous" });
  expect(await ask("posing", "tiddler-get", { ...READ, target: "4" })).toMatchObject({ kind: "session:refused", refusal: "target-ambiguous" });
  expect(await v.oneShot({ verb: "meme-put", args: { ...MEME, target: 1 }, requestedBy: "0xplace" })).toMatchObject({ status: "error", refusal: { reason: "cross-face-write-refused" } });
  expect(v.placed).toEqual([]);
});

test("CONTROL XV6 (Sol 407e): a verb outside the visit reads, carrying a numeric `target` of its own, never meets a face gate", async () => {
  const { lives } = actors(0);
  const v = await stand({ faceLife: lives, visitVerbs: VISITS });
  const reply = await v.oneShot({ verb: "floor-pin", args: { target: 7 }, requestedBy: "0xplace", requestId: "pin-target" });
  expect(reply).not.toMatchObject({ refusal: { reason: "face-not-open" } });
  expect(v.placed.map((p) => [p.verb, p.args["target"]])).toEqual([["floor-pin", 7]]);
});
