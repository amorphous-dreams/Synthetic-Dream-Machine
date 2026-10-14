import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { claimStore } from "../src/owned-store.js";
import { makeUdsSeat, serveUdsFront, startUdsChannel, type UdsSeat } from "../src/uds-channel.js";
import { Repo } from "@automerge/automerge-repo";
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
    const front = serveUdsFront({ claim });
    const a: unknown[] = [], b: unknown[] = [];
    front.attach(seenSeat(a));
    const first = dial(claim.socketPath, { verb: "first" });
    await first.sent;
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(a).toEqual([{ verb: "first" }]);
    await front.detach();
    const parked = dial(claim.socketPath, { verb: "parked" });
    await parked.sent;
    await noBytes(parked);
    front.attach(seenSeat(b));
    await new Promise((resolve) => setTimeout(resolve, 10));
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
    const front = serveUdsFront({ claim });
    const closed = dial(claim.socketPath, { n: 1 });
    await closed.sent;
    await noBytes(closed);
    closed.sock.destroy();
    const live = dial(claim.socketPath, { n: 2 });
    await live.sent;
    await noBytes(live);
    const seen: unknown[] = [];
    front.attach(seenSeat(seen));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen).toEqual([{ n: 2 }]);
    front.close();
    await claim.release();
  });

  test("R3: hold limit refuses the oldest caller and keeps the remaining queue", async () => {
    const claim = await setup();
    const front = serveUdsFront({ claim, holdLimit: 2 });
    const callers = [1, 2, 3].map((n) => dial(claim.socketPath, { n }));
    await Promise.all(callers.map((c) => c.sent));
    await new Promise((resolve) => setTimeout(resolve, 20));
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
    const front = serveUdsFront({ claim, onFrame: (frame) => (frame as { consume?: boolean }).consume === true });
    front.attach(seenSeat(passed));
    const consumed = dial(claim.socketPath, { consume: true });
    await consumed.sent;
    const forwarded = dial(claim.socketPath, { consume: false });
    await forwarded.sent;
    await new Promise((resolve) => setTimeout(resolve, 20));
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
