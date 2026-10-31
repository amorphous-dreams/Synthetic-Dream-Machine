/**
 * carried-nexus-posture — e2e (test-recut-road `T19`): a REAL vessel carries a Nexus beside its own, a stranger seats at
 * that carried Nexus's sync gate under an OPEN charter, and the charter then tightens.
 *
 * THE RIG (minimal, never a hand copy of the composer): the persona-ring e2e's founding, dispatcher and dial, plus one
 * partner charter whose roster seats a chair the founded face holds (a seat row stored under face 0 through the vessel's own
 * `storeSeatKey`, from a booked fixture seed the charter's genesis can sign with) beside two foreign keys. That seat makes the vessel count
 * the partner Nexus as carried (`carriedReadings`: a seated chair), so its sync gate stands at the boot's first sweep and its
 * posture rides the carried reading. The refold lever is the vessel's own `hostingDoor.rolled`, which runs the membership
 * refold a board write sets off.
 *
 *   T19-b RED: the carried charter tightens OPEN -> PRIVATE with a stranger seated; one refold; the stranger's socket stands
 *         past that refold (the drop sorted on the previous sweep's posture). CONTROL: before the flip the stranger seats,
 *         and a refold that reads nothing new keeps it.
 *
 * Opt-in: pnpm vitest run --config vitest.e2e.config.ts tests/e2e/carried-nexus-posture.test.ts
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, rmSync, existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer } from "ws";
import * as ed from "@noble/ed25519";
import { Repo } from "@automerge/automerge-repo";
import { DAEMON_BAG_ID, LarWSClientAdapter, hearthPinIndex, hex, type GateBundlePin, type NexusDoc } from "@lararium/mesh";
import { strangerFace, type CrossingFace } from "../../probes/crossing-synthetic-world.js";
import { heldCharter } from "../../../lararium-mesh/tests/charter-fixture.js";
import {
  runInit, runFoundTheFace, foundSeedCharter, openNodeVessel, larSealHome, writeNexusDoc,
  carriedCharterHome, seatFaceRoute, storeSeatKey,
} from "../../dist/src/index.js";
import { mountHttpFaceDispatcher } from "../../dist/src/http-face-dispatcher.js";
import { hearthSovereignPin } from "../../dist/src/hearth-sovereign-pin.js";
import type { NodeVesselResult } from "../../dist/src/open-node-vessel.js";
import { withLarRoot } from "../../../../tests/harness/with-lar-root.js";
import { direct } from "../direct-store.js";
import { TEST_CUSTODY, TEST_SLOT } from "../found-route.js";
seatFaceRoute(async () => [TEST_SLOT]);

const ROOT = join(tmpdir(), `lar-carried-posture-e2e-${Date.now()}`);
const STORAGE = join(ROOT, "data", "lares", "vessel");
const GENESIS = join(ROOT, "genesis");
const BUILT_GENESIS = join(new URL("../../", import.meta.url).pathname, "..", "..", "genesis");
if (!existsSync(join(BUILT_GENESIS, "seed.json"))) throw new Error(`[carried-nexus-posture] no hearth engine at ${BUILT_GENESIS}: run build:genesis first`);
mkdirSync(STORAGE, { recursive: true });
cpSync(BUILT_GENESIS, GENESIS, { recursive: true, filter: (src) => !src.endsWith("social-bootstrap.json") });

const turn = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** A stranger seated at a gate: its client, and whether the gate's side ever closed its socket. */
interface Seat { readonly client: LarWSClientAdapter; readonly repo: Repo; closed: boolean; seated: boolean }

function dial(url: string, pin: GateBundlePin, face: CrossingFace): Seat {
  const pins = hearthPinIndex();
  pins.put("hearth-carried", pin);
  const client = new LarWSClientAdapter({
    url, pins, hearth: "hearth-carried", nexus: pin.nexus, audience: DAEMON_BAG_ID,
    deadlines: { draw(lapse) { const t = setTimeout(lapse, 5_000); return { cancel: () => clearTimeout(t) }; } },
    presentation: { certificate: face.certificate, signer: face.signer, arm: face.arm, history: face.history },
    // One seat per dial: a closed socket stays closed for the test to read, never re-dialled under it.
    retryInterval: 600_000,
  });
  const seat: Seat = { client, repo: new Repo({ network: [client] }), closed: false, seated: false };
  client.on("peer-candidate", () => { seat.seated = true; });
  client.on("peer-disconnected", () => { seat.closed = true; });
  return seat;
}

describe("a carried Nexus's posture: a stranger seated under OPEN, the charter tightened", () => {
  let http: Server;
  let wss: WebSocketServer;
  let vessel: NodeVesselResult;
  let carriedAid: string;
  let partner: NexusDoc;
  let url: string;
  let pin: GateBundlePin;
  const charterAt = (federationPosture: "open" | "private"): NexusDoc => ({ ...partner, federationPosture });
  const writePartner = (posture: "open" | "private"): Promise<void> =>
    withLarRoot(ROOT, async () => { writeNexusDoc(carriedCharterHome(larSealHome(), carriedAid), charterAt(posture)); });

  beforeAll(async () => {
    await withLarRoot(ROOT, () => direct(runInit)({ storageDir: STORAGE, genesisDir: GENESIS, custody: TEST_CUSTODY, placeFoundingCard: { readBack: async () => {} } }));
    await withLarRoot(ROOT, () => foundSeedCharter({ name: "carrier", readBack: async () => {} }));
    await withLarRoot(ROOT, () => direct(runFoundTheFace)({ storageDir: STORAGE, genesisDir: GENESIS }));
    // THE PARTNER CHARTER seats a chair the founded face holds beside two foreign keys: the vessel holds a chair there.
    // The one-byte seeds stand booked in the charter fixture, so its genesis signs under this seat as under the others.
    const ownKey = (await withLarRoot(ROOT, () => storeSeatKey(0, new Uint8Array(32).fill(83)))).toLowerCase();
    const foreign = await Promise.all([81, 82].map((b) => ed.getPublicKeyAsync(new Uint8Array(32).fill(b)).then(hex)));
    const held = heldCharter({ keys: [ownKey, ...foreign], threshold: 2 });
    carriedAid = held.aid;
    partner = held.doc();
    await writePartner("open");

    http = createServer();
    const dispatcher = mountHttpFaceDispatcher(http);
    wss = new WebSocketServer({ noServer: true });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const port = (http.address() as AddressInfo).port;
    vessel = await withLarRoot(ROOT, () => openNodeVessel({ hostId: "lararium-node", wikiId: "lares", storageDir: STORAGE, genesisDir: GENESIS, wss, dispatcher }));
    pin = await withLarRoot(ROOT, async () => hearthSovereignPin(carriedAid));
    url = `ws://127.0.0.1:${port}${pin.route}`;
  }, 180_000);

  afterAll(async () => {
    try { await vessel?.teardown(); } catch { /* best-effort */ }
    await new Promise<void>((res) => wss?.close(() => http?.close(() => res())));
    try { rmSync(ROOT, { recursive: true, force: true }); } catch { /* best-effort */ }
  }, 60_000);

  /** Seat a fresh stranger at the carried gate; answers once the gate seated it, or throws by name. */
  async function seatStranger(label: string): Promise<Seat> {
    const seat = dial(url, pin, await strangerFace(carriedAid, label));
    for (let i = 0; i < 150 && !seat.seated; i++) await turn(100);
    if (!seat.seated) throw new Error(`[carried-nexus-posture] the carried gate never seated stranger ${label}`);
    return seat;
  }
  const leave = async (seat: Seat): Promise<void> => { seat.client.disconnect(); await seat.repo.shutdown(); };

  test("T19-b RED: a carried charter tightened to PRIVATE closes its seated stranger in that refold; CONTROL: an idle refold keeps it", async () => {
    const seat = await seatStranger("carried stranger");
    try {
      // CONTROL: a refold that reads nothing new keeps the seated stranger.
      await withLarRoot(ROOT, () => vessel.hostingDoor.rolled(carriedAid));
      await turn(2_000);
      expect(seat.closed, "an idle refold closed a stranger the OPEN charter still answers").toBe(false);
      // The charter tightens; ONE refold.
      await writePartner("private");
      await withLarRoot(ROOT, () => vessel.hostingDoor.rolled(carriedAid));
      for (let i = 0; i < 30 && !seat.closed; i++) await turn(100);
      const closedInThatRefold = seat.closed;
      // KNOWN POSITIVE: the vessel did read the tightening; a fresh stranger after that refold meets silence at the gate.
      const warned: string[] = [];
      const realWarn = console.warn;
      console.warn = (...a: unknown[]): void => { warned.push(a.map(String).join(" ")); realWarn(...a); };
      const late = dial(url, pin, await strangerFace(carriedAid, "late stranger"));
      try {
        for (let i = 0; i < 100 && !warned.some((l) => l.includes("fell silent: sorted-silent")); i++) await turn(100);
        expect(warned.some((l) => l.includes("fell silent: sorted-silent")), "the refold never read the carried charter PRIVATE").toBe(true);
        expect(late.seated).toBe(false);
      } finally { console.warn = realWarn; await leave(late); }
      expect(closedInThatRefold, "the stranger's socket outlived the refold that read its Nexus PRIVATE").toBe(true);
    } finally {
      await leave(seat);
      await writePartner("open");
    }
  }, 60_000);
});
