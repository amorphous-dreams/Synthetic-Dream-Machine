import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { claimStore } from "../src/owned-store.js";
import { makeUdsSeat, serveUdsFront, startUdsChannel, type UdsSeat } from "../src/uds-channel.js";
import { Repo } from "@automerge/automerge-repo";
import { arrival, type Arrival } from "../../lararium-mesh/tests/handshake.js";
import { emptyLarDoc, AutomergeDocStore, CompositeStore, wikiSlotUri, DAEMON_BAG_ID, OUTCOME_URI_PREFIX, type LarDoc } from "@lararium/mesh";

const dirs: string[] = [];
const sockets: Socket[] = [];
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "uds-front-"));
  dirs.push(dir);
  return claimStore(dir, { holder: "vessel" });
}
function dial(path: string, frame: unknown): Promise<{ sock: Socket; read: () => string; sent: Promise<void> }> {
  const sock = createConnection(path);
  sockets.push(sock);
  sock.setEncoding("utf8");
  let data = "";
  sock.on("data", (chunk: string) => { data += chunk; });
  const sent = new Promise<void>((resolve, reject) => {
    sock.once("connect", () => { sock.write(JSON.stringify(frame) + "\n", (err) => err ? reject(err) : resolve()); });
    sock.once("error", reject);
  });
  return { sock, read: () => data, sent };
}
/**
 * The front's own word for each frame it reads (`onFrame`, called before a frame reaches a seat or the hold, with
 * the front's side of the caller's socket). `read` resolves when the front has read that frame, and `gone` when
 * the front's socket for it has closed: the ear's close listener stands before the front's own, so the front has
 * dropped a held caller by the time `gone` answers. No pause stands in for "the frame reached the front".
 */
function frameEar(): { onFrame: (parsed: unknown, sock: Socket) => boolean; read: (frame: unknown) => Promise<void>; gone: (frame: unknown) => Promise<void> } {
  const words = new Map<string, { read: Arrival<void>; gone: Arrival<void> }>();
  const of = (frame: unknown) => {
    const key = JSON.stringify(frame);
    let word = words.get(key);
    if (!word) {
      word = { read: arrival<void>(`the front reading the frame ${key}`), gone: arrival<void>(`the front's socket for the frame ${key} closing`) };
      words.set(key, word);
    }
    return word;
  };
  return {
    onFrame: (parsed, sock) => { const word = of(parsed); sock.once("close", () => { word.gone.arrive(); }); word.read.arrive(); return false; },
    read: (frame) => of(frame).read.arrived,
    gone: (frame) => of(frame).gone.arrived,
  };
}
function seenSeat(seen: unknown[]): UdsSeat {
  return { handle: (parsed) => { seen.push(parsed); }, close: () => {} };
}
async function noBytes(client: ReturnType<typeof dial>) {
  await new Promise((resolve) => setTimeout(resolve, 25));
  expect(client.read()).toBe("");
  expect(client.sock.destroyed).toBe(false);
}
afterEach(() => {
  for (const sock of sockets.splice(0)) sock.destroy();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("uds front", () => {
  test("R1: seats hand frames across detach; start channel remains a working control", async () => {
    const claim = await setup();
    const ear = frameEar();
    const front = serveUdsFront({ claim, onFrame: ear.onFrame });
    const a: unknown[] = [], b: unknown[] = [];
    front.attach(seenSeat(a));
    const first = dial(claim.socketPath, { verb: "first" });
    await first.sent;
    await ear.read({ verb: "first" });             // the front read it, and hands a frame on in that same step
    expect(a).toEqual([{ verb: "first" }]);
    await front.detach();
    const parked = dial(claim.socketPath, { verb: "parked" });
    await parked.sent;
    await ear.read({ verb: "parked" });            // the front holds it: no seat stands
    await noBytes(parked);
    front.attach(seenSeat(b));                     // a seat takes every held frame as it attaches
    expect(b).toEqual([{ verb: "parked" }]);
    expect(a).toEqual([{ verb: "first" }]);
    front.close();
    await claim.release();

    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle, DAEMON_BAG_ID), writable: true, defaultWritable: false });
    composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), wikiSlotUri("daemon", "working")), writable: true });
    const ctlClaim = await setup();
    const channel = startUdsChannel({ daemonHandle, composite, placeVerb: (o) => {
      daemonHandle.change((doc) => { doc.tiddlers[`${OUTCOME_URI_PREFIX}${o.requestId}`] = { tiddler: { status: "done", requestId: o.requestId }, meta: {} } as never; });
    }, claim: ctlClaim, repo });
    const result = dial(ctlClaim.socketPath, { verb: "ok", requestedBy: "did:key:test", requestId: "front-control" });
    await result.sent;
    await new Promise((resolve) => result.sock.once("data", resolve));
    expect(result.read()).toContain('"status":"done"');
    channel.close();
    await ctlClaim.release();
  });

  test("R2: closed parked callers are discarded and connected callers replay", async () => {
    const claim = await setup();
    const ear = frameEar();
    const front = serveUdsFront({ claim, onFrame: ear.onFrame });
    const closed = dial(claim.socketPath, { n: 1 });
    await closed.sent;
    await ear.read({ n: 1 });                      // held
    await noBytes(closed);
    closed.sock.destroy();
    await ear.gone({ n: 1 });                      // the front met the hang-up and dropped the held caller
    const live = dial(claim.socketPath, { n: 2 });
    await live.sent;
    await ear.read({ n: 2 });
    await noBytes(live);
    const seen: unknown[] = [];
    front.attach(seenSeat(seen));
    expect(seen).toEqual([{ n: 2 }]);
    front.close();
    await claim.release();
  });

  test("R3: hold limit refuses the oldest caller and keeps the remaining queue", async () => {
    const claim = await setup();
    const ear = frameEar();
    const front = serveUdsFront({ claim, holdLimit: 2, onFrame: ear.onFrame });
    // One caller at a time, each read by the front before the next dials: caller 1 stands oldest because the
    // front read it first, never because three dials happened to land in the order they started.
    const callers: Array<ReturnType<typeof dial>> = [];
    for (const n of [1, 2, 3]) {
      const caller = dial(claim.socketPath, { n });
      callers.push(caller);
      await caller.sent;
      await ear.read({ n });
    }
    // The third frame pushed the hold past its limit; the refusal travels back on the oldest caller's own socket.
    if (callers[0]!.read() === "") await new Promise((resolve) => callers[0]!.sock.once("data", resolve));
    expect(callers[0]!.read()).toContain('"reason":"recomposing"');
    expect(callers[1]!.read()).toBe("");
    expect(callers[2]!.read()).toBe("");
    const seen: unknown[] = [];
    front.attach(seenSeat(seen));
    expect(seen).toEqual([{ n: 2 }, { n: 3 }]);
    front.close();
    await claim.release();
  });

  test("R4: onFrame consumes before the seat only when it returns true", async () => {
    const claim = await setup();
    const passed: unknown[] = [];
    const ear = frameEar();
    const front = serveUdsFront({ claim, onFrame: (frame, sock) => { ear.onFrame(frame, sock); return (frame as { consume?: boolean }).consume === true; } });
    front.attach(seenSeat(passed));
    const consumed = dial(claim.socketPath, { consume: true });
    await consumed.sent;
    await ear.read({ consume: true });
    const forwarded = dial(claim.socketPath, { consume: false });
    await forwarded.sent;
    await ear.read({ consume: false });            // both frames passed `onFrame`; the seat holds what it let through
    expect(passed).toEqual([{ consume: false }]);
    front.close();
    await claim.release();
  });

  // A SEAT DRAINS BEFORE IT LEAVES. A frame already handed to a seat finishes against that seat's own ledger and
  // worker: `detach` resolves only once its answer leaves, so the composition beneath never tears down under it.
  test("R5: detach waits for a frame the seat already holds; an idle seat detaches at once", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle, DAEMON_BAG_ID), writable: true, defaultWritable: false });
    composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), wikiSlotUri("daemon", "working")), writable: true });
    const claim = await setup();
    const front = serveUdsFront({ claim });
    let land: (() => void) | null = null;
    const placed = new Promise<void>((resolve) => {
      front.attach(makeUdsSeat({ daemonHandle, composite, claim, repo, placeVerb: (o) => {
        land = () => daemonHandle.change((doc) => { doc.tiddlers[`${OUTCOME_URI_PREFIX}${o.requestId}`] = { tiddler: { status: "done", requestId: o.requestId }, meta: {} } as never; });
        resolve();
      } }));
    });
    const caller = dial(claim.socketPath, { verb: "slow", requestedBy: "did:key:test", requestId: "front-drain" });
    await caller.sent;
    await placed;                                  // the seat dispatched; the outcome has not landed
    let detached = false;
    const leaving = front.detach().then(() => { detached = true; });
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(detached, "the seat still holds an unanswered frame").toBe(false);
    expect(caller.read()).toBe("");
    land!();                                       // the worker's outcome lands; the seat answers and drains
    await leaving;
    expect(detached).toBe(true);
    if (!caller.read().includes("\n")) await new Promise((resolve) => caller.sock.once("data", resolve));
    expect(JSON.parse(caller.read().trim())).toMatchObject({ status: "done", requestId: "front-drain" });
    // CONTROL: a seat holding nothing detaches at once.
    front.attach(seenSeat([]));
    await front.detach();
    front.close();
    await claim.release();
  });

  test("★ a seat waits out a cancel whose caller hung up: detach resolves only once the cancel's write ended ★", async () => {
    for (const hold of [true, false]) {
      const repo = new Repo({ sharePolicy: async () => true });
      const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
      const composite = new CompositeStore();
      composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle, DAEMON_BAG_ID), writable: true, defaultWritable: false });
      composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), wikiSlotUri("daemon", "working")), writable: true });
      const claim = await setup();
      const front = serveUdsFront({ claim });
      // The handshake: the cancel's own flush tells the test it began, and ends when the test says so.
      let began!: () => void, release!: () => void;
      const flushBegan = new Promise<void>((r) => { began = r; });
      const gate = new Promise<void>((r) => { release = r; });
      front.attach(makeUdsSeat({ daemonHandle, composite, placeVerb: () => {}, claim, repo: { flush: async () => { began(); if (hold) await gate; } } }));
      const caller = dial(claim.socketPath, { op: "cancel", requestId: `front-cancel-${hold}` });
      await caller.sent;
      await flushBegan;
      if (hold) {
        caller.sock.destroy();
        await new Promise<void>((r) => setImmediate(() => setImmediate(r)));   // the seat meets the caller's close
      }
      let detached = false;
      const leaving = front.detach().then(() => { detached = true; });
      await new Promise<void>((r) => setImmediate(() => setImmediate(r)));
      // CONTROL (hold false): with the write ended and its answer written, the seat leaves at once.
      if (hold) { expect(detached).toBe(false); release(); }
      await leaving;
      expect(detached).toBe(true);
      front.close();
      await claim.release();
      await repo.shutdown();
    }
  });
});
