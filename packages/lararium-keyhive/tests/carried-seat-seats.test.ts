/**
 * carried-seat-seats — the joined leaf's seat, composed as the daemon composes it: `makeFaceSeat` over the grant port that
 * reads the carried grant in the vessel's own secret home before the face's persona plane (`seatGrantsReader`), where the
 * plane reads unavailable (a leaf with no road never holds it).
 *
 *   C1  a joined leaf that holds no carried grant stays pinned, and the unavailable plane names its fault; with the grant
 *       kept, the next wake seats it and runs the Lift once.
 *   C2  a replay: keeping the same grant again leaves one record, and a reboot already seated lifts once and ingests nothing.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/device-capabilities-2026#/device-seats
 */
import { describe, expect, test } from "vitest";
import { tiddlerText, type DeviceDelegationTiddler, type DocHandle, type LarDoc } from "@lararium/mesh";
import { keepCarriedSeatGrant, seatGrantsReader, type FleetSeatGrant } from "../src/carried-seat.js";
import { faceGrantTitle, type FaceGrantRecord } from "../src/face-grant-record.js";
import { makeFaceSeat } from "../src/face-seat.js";

const GROUP = "0xb7f1c2a9d4e60381";
const DEVICE = "aa".repeat(32);
const FOUNDER = "f0".repeat(32);

/** The vessel's secret home over plain memory: the handle the land writes through, and the store the seat reads. */
function secretHome() {
  const doc = { tiddlers: {} } as unknown as LarDoc;
  const handle = { change: (fn: (d: LarDoc) => void) => fn(doc), doc: () => doc } as unknown as DocHandle<LarDoc>;
  const store = {
    listVisible: async () => Object.keys(doc.tiddlers),
    get: async (title: string) => { const text = tiddlerText(doc.tiddlers[title]); return typeof text === "string" ? { tiddler: { text } } : null; },
  };
  return { handle, store, titles: () => Object.keys(doc.tiddlers) };
}
const grant: FleetSeatGrant = { kind: "fleet-seat-grant", personaGroup: GROUP, title: faceGrantTitle(GROUP, DEVICE),
  record: { kind: "face-join-grant", groupId: GROUP, joineeAgentIdHex: DEVICE, founderCard: "{}", capEvents: ["AAAA"], reKeyed: true, serial: 1, reSealed: [],
    founderEdge: { deviceVerifyingKey: FOUNDER } as DeviceDelegationTiddler, sig: "ab".repeat(64) } satisfies FaceGrantRecord };

/** One boot of the joined leaf's seat: the daemon's composition, its plane unreachable, its verifier passing a founder that stands. */
function boot(home: ReturnType<typeof secretHome>, seatedAlready = false) {
  let known = seatedAlready;
  const counts = { ingests: 0, lifts: 0 };
  const logs: string[] = [];
  const seat = makeFaceSeat({
    group: GROUP, selfVerifyingKey: DEVICE, personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
    knowsAgent: async () => known,
    grants: seatGrantsReader({ carried: home.store, group: GROUP, deviceKey: DEVICE,
      plane: async () => { throw new Error("[document-unavailable] the persona plane was reported unavailable by every reachable peer"); } }),
    founderStanding: async () => "clear",
    verify: async (record) => (record === undefined ? { ok: false, reason: "no record" } : { ok: true }),
    ingest: async () => { counts.ingests++; known = true; },
    lift: async () => { counts.lifts++; return { skipped: 0 }; },
    log: (message) => { logs.push(message); },
  });
  return { seat, counts, logs, seated: () => known };
}

describe("the joined leaf's seat reads its carried grant, roadless", () => {
  test("C1 — RED: no carried grant stays pinned; a kept grant seats on the next wake and lifts once", async () => {
    const home = secretHome();
    const b = boot(home);
    expect(await b.seat.run()).toBe(false);
    await b.seat.settled();
    expect(b.seated(), "no grant: the face stays pinned").toBe(false);
    expect(b.counts).toEqual({ ingests: 0, lifts: 0 });
    keepCarriedSeatGrant(home.handle, grant);
    b.seat.wake(); await b.seat.settled();
    expect(b.seated(), "the carried grant seats it with the plane unreachable").toBe(true);
    expect(b.counts).toEqual({ ingests: 1, lifts: 1 });
    expect(b.logs.some((m) => /SEATED/.test(m))).toBe(true);
  });

  test("C2 — a replayed keep leaves one record, and a reboot already seated lifts once and ingests nothing", async () => {
    const home = secretHome();
    keepCarriedSeatGrant(home.handle, grant);
    keepCarriedSeatGrant(home.handle, JSON.parse(JSON.stringify(grant)) as FleetSeatGrant);
    expect(home.titles()).toEqual([grant.title]);
    const first = boot(home);
    await first.seat.run(); await first.seat.settled();
    expect(first.counts).toEqual({ ingests: 1, lifts: 1 });
    const again = boot(home, true);
    await again.seat.run(); again.seat.wake(); await again.seat.run();
    expect(again.counts, "a seated reboot ingests nothing and lifts once").toEqual({ ingests: 0, lifts: 1 });
  });
});
