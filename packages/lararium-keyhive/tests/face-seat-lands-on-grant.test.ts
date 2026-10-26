import { describe, expect, test } from "vitest";
import { FACE_GRANT_PREFIX, type FaceGrantRecord } from "../src/face-grant-record.js";
import { makeFaceSeat } from "../src/face-seat.js";

const group = "group";
const leasePrefix = "lease/group/";
const self = "abcd";
const title = `${FACE_GRANT_PREFIX}${group}/${self}`;
const grant = { sig: "signature", capEvents: [] } as unknown as FaceGrantRecord;
function fixture() {
  let records: { title: string; record: FaceGrantRecord }[] = [];
  let known = false;
  let lease = false;
  let ingests = 0;
  let lifts = 0;
  let verifies = 0;
  let failIngest = false;
  let failLift = false;
  let refuse = false;
  const seat = makeFaceSeat({
    group, leasePrefix, selfVerifyingKey: self, personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
    knowsAgent: async () => known,
    grants: async () => records,
    readLease: async () => lease ? { kind: "epoch", n: 0 } : { kind: "unavailable", why: "no layer" },
    verify: async () => { verifies++; return refuse ? { ok: false, reason: "refused" } : { ok: true }; },
    ingest: async () => { ingests++; if (failIngest) throw new Error("ingest"); known = true; },
    lift: async () => { lifts++; if (failLift) throw new Error("lift"); },
    log: () => {},
  });
  return {
    seat, arrive: () => { records = [{ title, record: grant }]; },
    leaseArrives: () => { lease = true; },
    failIngest: (value: boolean) => { failIngest = value; },
    failLift: (value: boolean) => { failLift = value; },
    refuse: () => { refuse = true; },
    counts: () => ({ ingests, lifts, verifies }),
    seated: () => known,
  };
}

describe("a causal face seat", () => {
  test("R1 grant arrival seats and lifts without a binding call; absent grant leaves the floor", async () => {
    const f = fixture(); f.leaseArrives();
    expect(await f.seat.run()).toBe(false);
    expect(f.counts().lifts).toBe(0);
    f.arrive(); f.seat.wake(); await f.seat.settled();
    expect(f.seated()).toBe(true);
    expect(f.counts()).toEqual({ ingests: 1, lifts: 1, verifies: 1 });
  });
  test("R2 a grant waits unjudged for the daemon lease layer", async () => {
    const f = fixture(); f.arrive();
    await f.seat.run(); expect(f.counts().verifies).toBe(0);
    f.leaseArrives(); f.seat.wake(); await f.seat.settled();
    expect(f.counts().ingests).toBe(1);
  });
  test("R2 a grant pending on an absent layer wakes on any daemon-layer change; with none pending an unrelated change runs no act", async () => {
    const idle = fixture(); idle.arrive(); idle.leaseArrives();
    idle.seat.daemonChanged("unrelated/title"); await idle.seat.settled();
    expect(idle.counts().verifies).toBe(0);
    const f = fixture(); f.arrive();
    await f.seat.run(); expect(f.counts().verifies).toBe(0);
    f.leaseArrives(); f.seat.daemonChanged("unrelated/title"); await f.seat.settled();
    expect(f.counts().ingests).toBe(1);
  });
  test("R3 duplicate pulses coalesce and a pulse during a pass yields one trailing pass", async () => {
    const f = fixture(); f.arrive(); f.leaseArrives();
    const running = f.seat.run();
    for (let i = 0; i < 8; i++) f.seat.wake();
    await running; await f.seat.settled();
    expect(f.counts()).toEqual({ ingests: 1, lifts: 1, verifies: 1 });
  });
  test("R4 an ingest fault leaves the signature open; a refusal judges once", async () => {
    const f = fixture(); f.arrive(); f.leaseArrives(); f.failIngest(true);
    await f.seat.run(); expect(f.seated()).toBe(false);
    f.failIngest(false); await f.seat.run();
    expect(f.counts().ingests).toBe(2);
    const refused = fixture(); refused.arrive(); refused.leaseArrives(); refused.refuse();
    await refused.seat.run(); await refused.seat.run();
    expect(refused.counts().verifies).toBe(1);
  });
  test("R5 a restart with the veil already seated lifts once and ingests nothing", async () => {
    let lifts = 0; let ingests = 0;
    const seat = makeFaceSeat({
      group, leasePrefix, selfVerifyingKey: self, personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
      knowsAgent: async () => true, grants: async () => [{ title, record: grant }], readLease: async () => ({ kind: "epoch", n: 0 }),
      verify: async () => ({ ok: true }), ingest: async () => { ingests++; }, lift: async () => { lifts++; }, log: () => {},
    });
    await seat.run(); seat.wake(); await seat.run();
    expect({ lifts, ingests }).toEqual({ lifts: 1, ingests: 0 });
  });
  test("R5 a lift fault retries on the next act without another ingest", async () => {
    const f = fixture(); f.arrive(); f.leaseArrives(); f.failLift(true);
    await f.seat.run(); f.failLift(false); await f.seat.run();
    expect(f.counts()).toEqual({ ingests: 1, lifts: 2, verifies: 1 });
  });
});

import { resolveOrMintBinding } from "../src/resolve-binding.js";

test("R6 mint settles a running seat before its read", async () => {
  const order: string[] = [];
  await resolveOrMintBinding({
    kind: "personal-binding", prefix: "binding", fingerprint: "fingerprint",
    recipeTrace: { wikiDocId: "wiki", libraryBagDocIds: [] }, mintedByHex: "vessel", personaGroupId: group,
    repo: { create: () => ({ url: "automerge:mint", documentId: "mint" }), flush: async () => {} },
    daemonStore: { get: async () => null, put: async () => {} } as never,
    keyhive: { registerBag: async () => ({ docId: "vessel-doc" }) } as never,
    faceDoor: { mint: async () => ({ docId: "face-doc" }), adopt: () => {} } as never,
    seatSettled: async () => { order.push("settled"); },
    faceSeated: async () => { order.push("seated"); return true; },
  });
  expect(order).toEqual(["settled", "seated"]);
});

test("R6 a lift inside the act completes while settlement points to that act", async () => {
  let seat!: ReturnType<typeof makeFaceSeat>;
  let known = true;
  seat = makeFaceSeat({
    group, leasePrefix, selfVerifyingKey: self, personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
    knowsAgent: async () => known, grants: async () => [], readLease: async () => ({ kind: "epoch", n: 0 }),
    verify: async () => ({ ok: true }), ingest: async () => { known = true; },
    lift: async () => { expect(await seat.seated()).toBe(true); }, log: () => {},
  });
  const seatSettled = () => seat.settled();
  expect(await seat.run()).toBe(true);
  await seatSettled();
});

test("R6 reuse of a vessel-only record reads the record and asks no seat; a face record still adopts", async () => {
  const asked: string[] = [];
  const adopted: string[] = [];
  const store = (reach: string) => ({
    get: async () => ({ tiddler: { title: "binding/fingerprint", text: `automerge:${reach}`, "face-reach": reach, "keyhive-doc-id": "doc" } }),
    put: async () => { throw new Error("reuse writes nothing"); },
  }) as never;
  const base = {
    kind: "personal-binding" as const, prefix: "binding", fingerprint: "fingerprint",
    recipeTrace: { wikiDocId: "wiki", libraryBagDocIds: [] }, mintedByHex: "vessel", personaGroupId: group,
    repo: { create: () => { throw new Error("reuse mints nothing"); }, flush: async () => {} },
    keyhive: {} as never, faceDoor: { mint: async () => { throw new Error("reuse mints nothing"); }, adopt: (url: string) => { adopted.push(url); } } as never,
    seatSettled: async () => { asked.push("settled"); },
    faceSeated: async () => { asked.push("seated"); return true; },
  };
  expect(await resolveOrMintBinding({ ...base, daemonStore: store("vessel-only") })).toEqual({ url: "automerge:vessel-only", minted: false });
  expect(asked).toEqual([]);
  expect(await resolveOrMintBinding({ ...base, daemonStore: store("face") })).toEqual({ url: "automerge:face", minted: false });
  expect(adopted).toEqual(["automerge:face"]);
  expect(asked).toEqual([]);
});

test("R6 the resolver's lift never waits on the seat act", async () => {
  const { makeSlotDocResolver } = await import("../src/slot-doc-resolver.js");
  let settledCalls = 0;
  const resolver = makeSlotDocResolver({
    repo: {} as never, daemonStore: {} as never, keyhive: {} as never, catalog: null, vesselDid: () => "did", mintedByHex: () => "vessel",
    personaGroupId: group, faceSeated: async () => false, faceDoor: {} as never,
    seatSettled: async () => { settledCalls++; await new Promise(() => {}); },
  });
  expect(await resolver.liftFloor()).toEqual({ moved: [], finished: [] });
  expect(settledCalls).toBe(0);
});
