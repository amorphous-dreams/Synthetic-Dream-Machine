/**
 * session-sign-two-vessels — e2e: a REAL herm (`openNodeHerm`) and a REAL lifted vessel (`openNodeVessel`) stand in ONE
 * process, each on its own scratch LAR_ROOT, and the capability record composes floor first with the lift on top.
 *
 *   S1  the lift's record carries `sessionSign` and reaches its OWN book; the herm's record carries none and its
 *       daemon `session:sign` ask refuses by name (`signer-unavailable`), though both stand in the same process.
 *   S2  two vessels never share a signer: a call booked on the lift's book signs on the lift; the herm answers the same
 *       ask id with a refusal, and dropping the lift leaves the herm's record bare.
 *   S3  a lift whose composition refuses AFTER the keel (the floor porch route already owned) seats no sign door and drains
 *       every role cap; the refused boot frees its store, so the same storage opens again (CONTROL).
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
vi.mock("../../dist/src/vessel-island-pool.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../dist/src/vessel-island-pool.js")>();
  class CapturingPool extends actual.VesselIslandPool {
    constructor(options: ConstructorParameters<typeof actual.VesselIslandPool>[0]) { super(options); captured.push(options.caps); }
  }
  return { ...actual, VesselIslandPool: CapturingPool };
});

const { runInit, runFoundTheFace, foundSeedCharter, openNodeVessel, openNodeHerm, seatFaceRoute } = await import("../../dist/src/index.js");
const { mountHttpFaceDispatcher } = await import("../../dist/src/http-face-dispatcher.js");
const { answerSessionSign } = await import("../../dist/src/worker-handle.js");
const { withLarRoot } = await import("../../../../tests/harness/with-lar-root.js");
const { direct } = await import("../direct-store.js");
const { TEST_CUSTODY, TEST_SLOT } = await import("../found-route.js");
seatFaceRoute(async () => [TEST_SLOT]);

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
    await Promise.all([wssLift, wssHerm].map((w) => new Promise<void>((res) => w?.close(() => res()))));
    await Promise.all([httpLift, httpHerm].map((h) => new Promise<void>((res) => (h ? h.close(() => res()) : res()))));
    try { rmSync(BASE, { recursive: true, force: true }); } catch { /* best-effort */ }
  }, 60_000);

  test("S3 — a lift refused AFTER its keel (the floor porch route owned) seats no sign door; the same storage then opens (CONTROL)", async () => {
    captured.length = 0;
    const squatter = dispLift.register({ name: "squatter", routeKeys: ["floor:/floor/"], owns: () => false, handle: () => {} });
    await expect(openLift()).rejects.toThrow(/route key already owned: floor:\/floor\//);
    // The pool stood (the keel composed) with the door seated; the refusal then unseated it and drained the role caps.
    expect(captured.length).toBeGreaterThan(0);
    for (const caps of captured) expect(caps.sessionSign).toBeUndefined();
    squatter();
    captured.length = 0;
    const again = await openLift();
    try {
      expect(again.islandCaps.sessionSign).toBeTypeOf("function");
    } finally { await again.teardown(); }
    expect(again.islandCaps.sessionSign).toBeUndefined();
  }, 240_000);

  test("S1/S2 — the herm's daemon session:sign refuses by name; the lift's reaches its own book; two vessels share no signer", async () => {
    const lift = await openLift();
    const herm = await withLarRoot(HERM.root, () => openNodeHerm({ hostId: "lares-viales", wikiId: "lares", storageDir: storageOf(HERM.root), genesisDir: genesisOf(HERM.root), wss: wssHerm, httpServer: httpHerm, dispatcher: dispHerm }));
    try {
      expect(lift.islandCaps.sessionSign).toBeTypeOf("function");
      expect(herm.islandCaps.sessionSign).toBeUndefined();
      expect(lift.islandCaps.sessionSign).not.toBe(herm.islandCaps.sessionSign);

      // A call booked on the lift's own book. A PLACE-anchored session answers `session-anchor-place` from the book itself,
      // which no bare "no door" refusal can say: the lift reaches its book, the herm (same ask id) draws the bare refusal.
      const release = lift.sessionSigns.hold("call-1", "sealed-seal", {
        anchor: { kind: "place", aid: "place-one", head: "head-one" }, subject: "subject-1",
        signer: { certificate: {}, async sign() { throw new Error("a place session signs nothing"); } } as never,
      });
      try {
        expect(await answerSessionSign(lift.islandCaps, ask("l1", "sign"))).toEqual({ type: "session:signed", requestId: "l1", refusal: "session-anchor-place" });
        expect(await answerSessionSign(herm.islandCaps, ask("h1"))).toEqual({ type: "session:signed", requestId: "h1", refusal: "signer-unavailable" });
        expect(await answerSessionSign(herm.islandCaps, ask("h2", "sign"))).toEqual({ type: "session:signed", requestId: "h2", refusal: "signer-unavailable" });
        // The herm result carries no book at all: nothing a booking on the lift could reach.
        expect("sessionSigns" in herm).toBe(false);
      } finally { release(); }
    } finally {
      await lift.teardown();
      // Dropping the lift leaves the herm's record exactly as it was: bare of a signer.
      expect(lift.islandCaps.sessionSign).toBeUndefined();
      expect(herm.islandCaps.sessionSign).toBeUndefined();
      await herm.teardown();
    }
  }, 300_000);
});
