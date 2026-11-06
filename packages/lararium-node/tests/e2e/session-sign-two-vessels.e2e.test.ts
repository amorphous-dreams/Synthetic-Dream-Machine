/**
 * session-sign-two-vessels — e2e: a REAL herm (`openNodeHerm`) and a REAL lifted vessel (`openNodeVessel`) stand in ONE
 * process, each on its own scratch LAR_ROOT, and the capability record composes floor first with the lift on top.
 *
 *   S1  each `session:sign` ask goes THROUGH the vessel's real daemon island worker (the message path `attachSessionSignDoor` serves,
 *       entered on the worker the pool spawned): the herm's daemon draws `signer-unavailable`, the lift's reaches its OWN book.
 *       Unplug the daemon-to-record wiring and both go silent, so the test fails.
 *   S2  two vessels never share a signer: a call booked on the lift's book answers on the lift's daemon alone; both records end bare
 *       after their own teardown.
 *   S3  a lift whose composition refuses AFTER the keel (the floor porch route already owned) seats no sign door and drains
 *       EVERY role cap it built (counted through the who-face cap); the refused boot frees its store, so the same storage opens
 *       again (CONTROL).
 *
 * Opt-in: pnpm vitest run --config vitest.e2e.config.ts tests/e2e/session-sign-two-vessels.e2e.test.ts
 * (inside the bwrap PID namespace, per the lane law).
 */
import { describe, test, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdirSync, rmSync, existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer, type Server } from "node:http";
import { WebSocketServer } from "ws";
import type { CapabilityRecord } from "@lararium/mesh";

const captured: CapabilityRecord[] = [];
const seen = vi.hoisted(() => ({
  workers: [] as Array<{ url: string; worker: { emit(ev: string, ...a: unknown[]): boolean }; posted: Array<Record<string, unknown>> }>,
  role: { built: 0, disposed: 0 },
}));
vi.mock("worker_threads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("worker_threads")>();
  class RecordingWorker extends actual.Worker {
    constructor(...args: ConstructorParameters<typeof actual.Worker>) {
      super(...args);
      const entry = { url: String(args[0]), worker: this as never, posted: [] as Array<Record<string, unknown>> };
      seen.workers.push(entry);
      const post = this.postMessage.bind(this) as (m: unknown, t?: never) => void;
      (this as { postMessage: unknown }).postMessage = (m: Record<string, unknown>, t?: never) => { entry.posted.push(m); post(m, t); };
    }
  }
  return { ...actual, Worker: RecordingWorker };
});
vi.mock("@lararium/mesh", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lararium/mesh")>();
  // Count the role caps a lift builds and disposes: the who-face cap stands as a role cap that carries a disposer.
  return { ...actual, whoFaceCap: (deps: Parameters<typeof actual.whoFaceCap>[0]) => {
    const cap = actual.whoFaceCap(deps);
    return { ...cap, build: async (resolve: never) => { const c = await (cap.build as (r: never) => Promise<unknown>)(resolve); seen.role.built++; return c; }, dispose: () => { seen.role.disposed++; } };
  } };
});
vi.mock("../../dist/src/vessel-island-pool.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../dist/src/vessel-island-pool.js")>();
  class CapturingPool extends actual.VesselIslandPool {
    constructor(options: ConstructorParameters<typeof actual.VesselIslandPool>[0]) { super(options); captured.push(options.caps); }
  }
  return { ...actual, VesselIslandPool: CapturingPool };
});

const { runInit, runFoundTheFace, foundSeedCharter, openNodeVessel, openNodeHerm, seatFaceRoute, seatWardGatherer } = await import("../../dist/src/index.js");
const { mountHttpFaceDispatcher } = await import("../../dist/src/http-face-dispatcher.js");
const { withLarRoot } = await import("../../../../tests/harness/with-lar-root.js");
const { direct } = await import("../direct-store.js");
const { TEST_CUSTODY, TEST_SLOT } = await import("../found-route.js");
seatFaceRoute(async () => [TEST_SLOT]);
// A root act this suite drives with no ward route asks its "person", who answers the same test route (seat-harness#/the-ward).
seatWardGatherer(async () => TEST_SLOT.pins.flatMap((pin) => (pin.kind === "passphrase" ? [{ kind: "passphrase" as const, passphrase: pin.passphrase }] : [])));

const BASE = join(tmpdir(), `lar-session-sign-two-${Date.now()}`);
const LIFT = { root: join(BASE, "lift") };
const HERM = { root: join(BASE, "herm") };
const storageOf = (root: string): string => join(root, "data", "lares", "vessel");
const genesisOf = (root: string): string => join(root, "genesis");
const BUILT_GENESIS = join(new URL("../../", import.meta.url).pathname, "..", "..", "genesis");
if (!existsSync(join(BUILT_GENESIS, "seed.json"))) throw new Error(`[session-sign-two-vessels] no hearth engine at ${BUILT_GENESIS}: run build:genesis first`);
for (const r of [LIFT.root, HERM.root]) {
  mkdirSync(storageOf(r), { recursive: true });
  cpSync(BUILT_GENESIS, genesisOf(r), { recursive: true, filter: (src) => !src.endsWith("social-bootstrap.json") });
}

const ask = (requestId: string, op: "read" | "sign" = "read") =>
  ({ requestId, op, ask: "call-1", verb: "sealed-seal", ...(op === "sign" ? { payload: new Uint8Array([1, 2, 3]) } : {}) });

/** The first DAEMON island worker spawned since `mark` (a count of workers seen before the open). */
const daemonWorkerSince = (mark: number) => {
  const found = seen.workers.slice(mark).find((w) => /node-daemon-island/.test(w.url));
  if (!found) throw new Error("[session-sign-two-vessels] the open spawned no daemon island worker");
  return found;
};
/** Post one `session:sign` ask INTO a daemon worker as its island would, and await the vessel's reply on the same request id. */
async function askThroughDaemon(entry: ReturnType<typeof daemonWorkerSince>, msg: Record<string, unknown>): Promise<Record<string, unknown>> {
  entry.worker.emit("message", { type: "session:sign", ...msg });
  for (let i = 0; i < 500; i++) {
    const reply = entry.posted.find((m) => m["type"] === "session:signed" && m["requestId"] === msg["requestId"]);
    if (reply) return reply;
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`[session-sign-two-vessels] the daemon island answered no session:sign ask ${String(msg["requestId"])}`);
}

describe("the herm floor and the lifted vessel in one process", () => {
  let httpLift: Server, httpHerm: Server;
  let wssLift: WebSocketServer, wssHerm: WebSocketServer;
  let dispLift: ReturnType<typeof mountHttpFaceDispatcher>, dispHerm: ReturnType<typeof mountHttpFaceDispatcher>;
  const openLift = () => withLarRoot(LIFT.root, () => openNodeVessel({ hostId: "lararium-node", wikiId: "lares", storageDir: storageOf(LIFT.root), genesisDir: genesisOf(LIFT.root), wss: wssLift, dispatcher: dispLift }));

  beforeAll(async () => {
    await withLarRoot(LIFT.root, () => direct(runInit)({ storageDir: storageOf(LIFT.root), genesisDir: genesisOf(LIFT.root), custody: TEST_CUSTODY, placeFoundingCard: { readBack: async () => {} } }));
    await withLarRoot(LIFT.root, () => foundSeedCharter({ name: "lift", readBack: async () => {} }));
    await withLarRoot(LIFT.root, () => direct(runFoundTheFace)({ storageDir: storageOf(LIFT.root), genesisDir: genesisOf(LIFT.root) }));
    await withLarRoot(HERM.root, () => direct(runInit)({ storageDir: storageOf(HERM.root), genesisDir: genesisOf(HERM.root), custody: TEST_CUSTODY, placeFoundingCard: { readBack: async () => {} } }));
    httpLift = createServer(); httpHerm = createServer();
    dispLift = mountHttpFaceDispatcher(httpLift); dispHerm = mountHttpFaceDispatcher(httpHerm);
    wssLift = new WebSocketServer({ noServer: true }); wssHerm = new WebSocketServer({ noServer: true });
    await Promise.all([httpLift, httpHerm].map((h) => new Promise<void>((res) => h.listen(0, "127.0.0.1", res))));
  }, 240_000);

  afterAll(async () => {
    await Promise.all([wssLift, wssHerm].map((w) => new Promise<void>((res) => (w ? w.close(() => res()) : res()))));
    await Promise.all([httpLift, httpHerm].map((h) => new Promise<void>((res) => (h ? h.close(() => res()) : res()))));
    try { rmSync(BASE, { recursive: true, force: true }); } catch { /* best-effort */ }
  }, 60_000);

  test("S3 — a lift refused AFTER its keel (the floor porch route owned) seats no sign door and drains every role cap; the same storage then opens (CONTROL)", async () => {
    captured.length = 0; seen.role.built = 0; seen.role.disposed = 0;
    const squatter = dispLift.register({ name: "squatter", routeKeys: ["floor:/floor/"], owns: () => false, handle: () => {} });
    await expect(openLift()).rejects.toThrow(/route key already owned: floor:\/floor\//);
    // The pool stood (the keel composed) with the door seated; the refusal then unseated it AND disposed every role cap it built.
    expect(captured.length).toBeGreaterThan(0);
    for (const caps of captured) expect(caps.sessionSign).toBeUndefined();
    expect(seen.role.built, "the keel built the who-face role cap before the refusal").toBeGreaterThan(0);
    expect(seen.role.disposed, "the refusal disposed every role cap it built").toBe(seen.role.built);
    squatter();
    captured.length = 0; seen.role.built = 0; seen.role.disposed = 0;
    const again = await openLift();
    try {
      expect(again.islandCaps.sessionSign).toBeTypeOf("function");
      expect(seen.role.disposed).toBe(0);
    } finally { await again.teardown(); }
    expect(again.islandCaps.sessionSign).toBeUndefined();
    expect(seen.role.disposed, "teardown disposes the same role caps").toBe(seen.role.built);
  }, 240_000);

  test("S1/S2 — each vessel's REAL daemon island: the herm's session:sign draws signer-unavailable, the lift's reaches its own book", async () => {
    const liftMark = seen.workers.length;
    const lift = await openLift();
    const hermMark = seen.workers.length;
    const herm = await withLarRoot(HERM.root, () => openNodeHerm({ hostId: "lares-viales", wikiId: "lares", storageDir: storageOf(HERM.root), genesisDir: genesisOf(HERM.root), wss: wssHerm, httpServer: httpHerm, dispatcher: dispHerm }));
    try {
      const liftDaemon = daemonWorkerSince(liftMark), hermDaemon = daemonWorkerSince(hermMark);
      expect(liftDaemon).not.toBe(hermDaemon);
      expect(lift.islandCaps.sessionSign).toBeTypeOf("function");
      expect(herm.islandCaps.sessionSign).toBeUndefined();

      // A call booked on the lift's own book. A PLACE-anchored session answers `session-anchor-place` from the book itself,
      // which no bare "no door" refusal can say: the lift's daemon reaches its book, the herm's (same ask id) draws the bare refusal.
      const release = lift.sessionSigns.hold("call-1", "sealed-seal", {
        anchor: { kind: "place", aid: "place-one", head: "head-one" }, subject: "subject-1",
        signer: { certificate: {}, async sign() { throw new Error("a place session signs nothing"); } } as never,
      });
      try {
        expect(await askThroughDaemon(liftDaemon, ask("l1", "sign"))).toEqual({ type: "session:signed", requestId: "l1", refusal: "session-anchor-place" });
        expect(await askThroughDaemon(hermDaemon, ask("h1"))).toEqual({ type: "session:signed", requestId: "h1", refusal: "signer-unavailable" });
        expect(await askThroughDaemon(hermDaemon, ask("h2", "sign"))).toEqual({ type: "session:signed", requestId: "h2", refusal: "signer-unavailable" });
        // The herm result carries no book at all: nothing a booking on the lift could reach.
        expect("sessionSigns" in herm).toBe(false);
      } finally { release(); }
    } finally {
      await lift.teardown();
      expect(lift.islandCaps.sessionSign).toBeUndefined();
      // Dropping the lift leaves the herm's record exactly as it was, and the herm's own teardown leaves it bare still.
      expect(herm.islandCaps.sessionSign).toBeUndefined();
      await herm.teardown();
      expect(herm.islandCaps.sessionSign).toBeUndefined();
    }
  }, 300_000);
});
