import { describe, expect, test } from "vitest";
import { FACE_GRANT_PREFIX, type FaceGrantRecord } from "../src/face-grant-record.js";
import { makeFaceSeat, makeGroupDocListener, type GroupDocHandle } from "../src/face-seat.js";

const group = "group";
const self = "abcd";
const title = `${FACE_GRANT_PREFIX}${group}/${self}`;
const FOUNDER = "f0".repeat(32);
const grant = { sig: "signature", capEvents: [], founderEdge: { deviceVerifyingKey: FOUNDER } } as unknown as FaceGrantRecord;
function fixture() {
  let records: { title: string; record: FaceGrantRecord }[] = [];
  let known = false;
  let standing: "clear" | "aside" | "unknown" = "unknown";
  let pendingOnce = false;
  const asked: string[] = [];
  const read: string[] = [];
  let ingests = 0;
  let lifts = 0;
  let verifies = 0;
  let failIngest = false;
  let failLift = false;
  let skipLift = 0;
  let arrival: Promise<unknown> | undefined;
  let refuse = false;
  const logs: string[] = [];
  const seat = makeFaceSeat({
    group, selfVerifyingKey: self, personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
    knowsAgent: async () => known,
    grants: async () => records,
    founderStanding: async (key) => { asked.push(key); return standing; },
    // Models the verifier's founder law: the reading it is handed for the founder's key decides, a set-aside founder refuses.
    verify: async (_record, context) => {
      verifies++;
      const reading = context.dyad?.(FOUNDER);
      read.push(`${reading}|${context.dyad?.("someone-else")}`);
      if (pendingOnce) { pendingOnce = false; return { ok: false, reason: "founder persona-KEL proof unavailable", pending: true }; }
      if (reading === "aside") return { ok: false, reason: "founder device set aside" };
      if (reading === "unknown") return { ok: false, reason: "founder dyad standing unknown", pending: true };
      return refuse ? { ok: false, reason: "refused" } : { ok: true };
    },
    ingest: async () => { ingests++; if (failIngest) throw new Error("ingest"); known = true; },
    lift: async () => { lifts++; if (failLift) throw new Error("lift"); return { skipped: skipLift, ...(arrival ? { arrivals: [arrival] } : {}) }; },
    log: (message) => { logs.push(message); },
  });
  return {
    logs, seat, arrive: () => { records = [{ title, record: grant }]; },
    standingArrives: () => { standing = "clear"; },
    founderAside: () => { standing = "aside"; },
    pendingOnce: () => { pendingOnce = true; },
    asked: () => asked, read: () => read,
    failIngest: (value: boolean) => { failIngest = value; },
    failLift: (value: boolean) => { failLift = value; },
    skipLift: (count: number) => { skipLift = count; },
    arrival: (p: Promise<unknown> | undefined) => { arrival = p; },
    refuse: () => { refuse = true; },
    counts: () => ({ ingests, lifts, verifies }),
    seated: () => known,
  };
}

describe("a causal face seat", () => {
  test("a held fork surfaces even when founder standing is unknown; CONTROL: an unforked grant waits", async () => {
    const run = async (fork: boolean) => {
      const logs: string[] = [];
      let ingests = 0;
      const seat = makeFaceSeat({
        group, selfVerifyingKey: self, personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
        knowsAgent: async () => false, grants: async () => [{ title, record: grant }], founderStanding: async () => "unknown",
        verify: async (_record, context) => fork
          ? { ok: false, reason: "founder lineage forked: test" }
          : context.dyad?.(FOUNDER) === "unknown"
            ? { ok: false, reason: "founder dyad standing unknown", pending: true }
            : { ok: true },
        ingest: async () => { ingests++; }, lift: async () => {}, log: (message) => { logs.push(message); },
      });
      await seat.run();
      return { logs, ingests };
    };
    const control = await run(false);
    expect(control.logs.join("\n")).toMatch(/pending .*dyad standing unknown/);
    expect(control.ingests).toBe(0);
    const fork = await run(true);
    expect(fork.logs.join("\n")).toMatch(/REFUSED .*founder lineage forked/);
    expect(fork.ingests).toBe(0);
  });
  test("unknown standing still withholds when a supplied verifier accepts", async () => {
    let ingests = 0;
    const seat = makeFaceSeat({
      group, selfVerifyingKey: self, personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
      knowsAgent: async () => false, grants: async () => [{ title, record: grant }], founderStanding: async () => "unknown",
      verify: async () => ({ ok: true }), ingest: async () => { ingests++; }, lift: async () => {}, log: () => {},
    });
    await seat.run();
    expect(ingests).toBe(0);
  });
  test("aside standing still withholds when a supplied verifier accepts", async () => {
    let ingests = 0;
    const seat = makeFaceSeat({
      group, selfVerifyingKey: self, personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
      knowsAgent: async () => false, grants: async () => [{ title, record: grant }], founderStanding: async () => "aside",
      verify: async () => ({ ok: true }), ingest: async () => { ingests++; }, lift: async () => {}, log: () => {},
    });
    await seat.run();
    expect(ingests).toBe(0);
  });
  test("R1 grant arrival seats and lifts without a binding call; absent grant leaves the floor", async () => {
    const f = fixture(); f.standingArrives();
    expect(await f.seat.run()).toBe(false);
    expect(f.counts().lifts).toBe(0);
    f.arrive(); f.seat.wake(); await f.seat.settled();
    expect(f.seated()).toBe(true);
    expect(f.counts()).toEqual({ ingests: 1, lifts: 1, verifies: 1 });
  });
  test("O3 a lift that SKIPPED a silent floor record never latches: the next pass lifts again, and a clean lift latches (CONTROL)", async () => {
    const f = fixture(); f.standingArrives(); f.arrive(); f.skipLift(1);
    await f.seat.run(); await f.seat.settled();
    expect(f.counts().lifts).toBe(1);
    f.seat.wake(); await f.seat.settled();
    expect(f.counts().lifts, "the skipped record gets a second pass").toBe(2);
    f.skipLift(0);
    f.seat.wake(); await f.seat.settled();
    expect(f.counts().lifts).toBe(3);
    f.seat.wake(); await f.seat.settled();
    expect(f.counts().lifts, "a clean lift latches").toBe(3);
  });
  test("O3 the skipped floor document's own ARRIVAL wakes the seat: the lift runs again with no other wake", async () => {
    const f = fixture(); f.standingArrives(); f.arrive();
    let arrive!: () => void; f.arrival(new Promise<void>((resolve) => { arrive = resolve; })); f.skipLift(1);
    await f.seat.run(); await f.seat.settled();
    expect(f.counts().lifts).toBe(1);
    f.skipLift(0); f.arrival(undefined);
    arrive();                                         // the silent document answers
    await new Promise((r) => setImmediate(r)); await f.seat.settled();
    expect(f.counts().lifts, "the arrival alone drew the second pass").toBe(2);
  });
  test("R2 a grant waits unjudged while its founder's standing reads unknown", async () => {
    const f = fixture(); f.arrive();
    await f.seat.run(); expect(f.counts().verifies).toBe(1);
    f.standingArrives(); f.seat.wake(); await f.seat.settled();
    expect(f.counts().ingests).toBe(1);
  });
  test("R2 a grant pending on its founder's standing wakes on any daemon-layer change; with none pending an unrelated change runs no act", async () => {
    const idle = fixture(); idle.arrive(); idle.standingArrives();
    idle.seat.daemonChanged("unrelated/title"); await idle.seat.settled();
    expect(idle.counts().verifies).toBe(0);
    const f = fixture(); f.arrive();
    await f.seat.run(); expect(f.counts().verifies).toBe(1);
    f.standingArrives(); f.seat.daemonChanged("unrelated/title"); await f.seat.settled();
    expect(f.counts().ingests).toBe(1);
  });
  test("R7 the seat asks the FOUNDER's standing and hands the verify that reading alone; any other key reads unknown", async () => {
    const f = fixture(); f.arrive(); f.standingArrives();
    await f.seat.run(); await f.seat.settled();
    expect(f.asked()).toEqual([FOUNDER]);
    expect(f.read()).toEqual(["clear|unknown"]);
    expect(f.counts().ingests).toBe(1);
  });
  test("R8 a set-aside founder's grant remains refused on retries; CONTROL: a standing founder's seats", async () => {
    const f = fixture(); f.arrive(); f.founderAside();
    await f.seat.run(); f.seat.wake(); await f.seat.settled(); await f.seat.run();
    expect(f.counts()).toEqual({ ingests: 0, lifts: 0, verifies: 3 });
    expect(f.seated()).toBe(false);
    expect(f.logs.some((m) => /REFUSED .*founder device set aside/.test(m))).toBe(true);
    const control = fixture(); control.arrive(); control.standingArrives();
    await control.seat.run(); await control.seat.settled();
    expect(control.seated()).toBe(true);
  });
  test("R9 a pending verdict (proof not yet held) never memoizes: the next pass takes the grant once the proof stands", async () => {
    const f = fixture(); f.arrive(); f.standingArrives(); f.pendingOnce();
    await f.seat.run(); await f.seat.settled();
    expect(f.counts()).toEqual({ ingests: 0, lifts: 0, verifies: 1 });
    expect(f.logs.some((m) => /grant pending .*persona-KEL proof unavailable/.test(m))).toBe(true);
    f.seat.daemonChanged("any/title"); await f.seat.settled();
    expect(f.counts()).toEqual({ ingests: 1, lifts: 1, verifies: 2 });
  });
  test("a founder lift retries the same set-aside grant on a daemon change; CONTROL: an unchanged aside never seats", async () => {
    const f = fixture(); f.arrive(); f.founderAside();
    await f.seat.run();
    expect(f.seated()).toBe(false);
    f.seat.daemonChanged("edge/unchanged"); await f.seat.settled();
    expect(f.seated()).toBe(false);
    expect(f.counts().ingests).toBe(0);
    f.standingArrives();
    f.seat.daemonChanged("edge/lift"); await f.seat.settled();
    expect(f.seated()).toBe(true);
    expect(f.counts().ingests).toBe(1);
  });
  test("a proof change during a standing read gets a trailing pass; CONTROL: unchanged aside never seats", async () => {
    const exercise = async (lift: boolean) => {
      let answer: "aside" | "clear" = "aside", reads = 0, ingests = 0, known = false;
      let release!: () => void, started!: () => void;
      const blocked = new Promise<void>((resolve) => { release = resolve; });
      const reading = new Promise<void>((resolve) => { started = resolve; });
      const seat = makeFaceSeat({
        group, selfVerifyingKey: self, personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
        knowsAgent: async () => known, grants: async () => [{ title, record: grant }],
        founderStanding: async () => { const snapshot = answer; if (++reads === 1) { started(); await blocked; } return snapshot; },
        verify: async (_record, ctx) => ctx.dyad?.(FOUNDER) === "aside"
          ? { ok: false, reason: "founder device set aside" } : { ok: true },
        ingest: async () => { ingests++; known = true; }, lift: async () => {}, log: () => {},
      });
      const running = seat.run(); await reading;
      if (lift) answer = "clear";
      seat.daemonChanged("edge/change"); release(); await running;
      return { reads, ingests };
    };
    expect(await exercise(true)).toEqual({ reads: 2, ingests: 1 });
    expect(await exercise(false)).toEqual({ reads: 2, ingests: 0 });
  });
  test("R3 duplicate pulses coalesce and a pulse during a pass yields one trailing pass", async () => {
    const f = fixture(); f.arrive(); f.standingArrives();
    const running = f.seat.run();
    for (let i = 0; i < 8; i++) f.seat.wake();
    await running; await f.seat.settled();
    expect(f.counts()).toEqual({ ingests: 1, lifts: 1, verifies: 1 });
  });
  test("R4 an ingest fault leaves the signature open; a refusal judges once", async () => {
    const f = fixture(); f.arrive(); f.standingArrives(); f.failIngest(true);
    await f.seat.run(); expect(f.seated()).toBe(false);
    f.failIngest(false); await f.seat.run();
    expect(f.counts().ingests).toBe(2);
    const refused = fixture(); refused.arrive(); refused.standingArrives(); refused.refuse();
    await refused.seat.run(); await refused.seat.run();
    expect(refused.counts().verifies).toBe(1);
  });
  test("R5 a restart with the veil already seated lifts once and ingests nothing", async () => {
    let lifts = 0; let ingests = 0;
    const seat = makeFaceSeat({
      group, selfVerifyingKey: self, personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
      knowsAgent: async () => true, grants: async () => [{ title, record: grant }], founderStanding: async () => "clear",
      verify: async () => ({ ok: true }), ingest: async () => { ingests++; }, lift: async () => { lifts++; }, log: () => {},
    });
    await seat.run(); seat.wake(); await seat.run();
    expect({ lifts, ingests }).toEqual({ lifts: 1, ingests: 0 });
  });
  test("R5 a lift fault retries on the next act without another ingest", async () => {
    const f = fixture(); f.arrive(); f.standingArrives(); f.failLift(true);
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
    group, selfVerifyingKey: self, personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
    knowsAgent: async () => known, grants: async () => [], founderStanding: async () => "clear",
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
  expect(await resolver.liftFloor()).toEqual({ moved: [], finished: [], skipped: [], skippedDocs: [] });
  expect(settledCalls).toBe(0);
});

describe("the seat speaks its states", () => {
  test("S1 an unseated pass logs the pinned line once; two identical passes log one; no grant moves no binding", async () => {
    const f = fixture(); f.standingArrives();
    await f.seat.run(); await f.seat.run(); f.seat.wake(); await f.seat.settled();
    expect(f.logs.filter(l => l.includes("pinned, not yet seated"))).toHaveLength(1);
    expect(f.logs.some(l => l.includes("grant record taken"))).toBe(false);
  });
  test("S2 a landed ingest logs the taken line with its counts and SEATED, and no pinned line", async () => {
    const f = fixture(); f.standingArrives();
    await f.seat.run(); f.arrive(); await f.seat.run();
    const taken = f.logs.filter(l => l.includes("grant record taken"));
    expect(taken).toHaveLength(1);
    expect(taken[0]).toMatch(/grant record taken from the PersonaGroup plane \(0 cap events, 0 chunks re-sealed\) — face SEATED/);
    await f.seat.run();
    expect(f.logs.filter(l => l.includes("grant record taken"))).toHaveLength(1);
  });
  test("S3 a seated boot logs neither line", async () => {
    const logs: string[] = [];
    const seat = makeFaceSeat({
      group, selfVerifyingKey: self, personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
      knowsAgent: async () => true, grants: async () => [], founderStanding: async () => "clear",
      verify: async () => ({ ok: true }), ingest: async () => {}, lift: async () => {}, log: (m) => { logs.push(m); },
    });
    await seat.run();
    expect(logs).toEqual([]);
  });
  test("S4 an ingest that leaves the face unseated logs the still-unseated taken line once", async () => {
    const logs: string[] = [];
    const seat = makeFaceSeat({
      group, selfVerifyingKey: self, personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
      knowsAgent: async () => false, grants: async () => [{ title, record: grant }], founderStanding: async () => "clear",
      verify: async () => ({ ok: true }), ingest: async () => {}, lift: async () => {}, log: (m) => { logs.push(m); },
    });
    await seat.run(); await seat.run();
    expect(logs.filter(l => l.includes("still unseated after ingest"))).toHaveLength(1);
    expect(logs.some(l => l.includes("pinned, not yet seated"))).toBe(false);
  });
});

function listenerFixture(opts: { urlAtBoot: boolean }) {
  let url: string | null = opts.urlAtBoot ? "automerge:group" : null;
  const logs: string[] = [];
  let catalogChange: (() => void) | null = null;
  let subscriptions = 0; let unsubscribes = 0;
  let opens = 0; let failOpen = false; let wakes = 0;
  let docListener: ((p: { patches?: { path: (string | number)[] }[] }) => void) | null = null;
  const handle: GroupDocHandle = {
    on: (_e, l) => { docListener = l as never; },
    off: () => { docListener = null; },
    titles: () => [],
  };
  const listener = makeGroupDocListener({
    group, selfVerifyingKey: self,
    urlOf: async () => url,
    open: async () => { opens++; if (failOpen) throw new Error("not ready"); return handle; },
    subscribeCatalog: async (onChange) => { subscriptions++; catalogChange = onChange; return () => { unsubscribes++; catalogChange = null; }; },
    wake: () => { wakes++; },
    log: (m) => { logs.push(m); },
  });
  const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));
  return {
    listener, logs, settle, handle,
    learn: () => { url = "automerge:group"; catalogChange?.(); },
    failOpen: (v: boolean) => { failOpen = v; },
    counts: () => ({ opens, wakes, subscriptions, unsubscribes }),
    hasDocListener: () => docListener !== null,
    fireDoc: (t: string) => docListener?.({ patches: [{ path: ["tiddlers", t] }] }),
  };
}

describe("the group document listener never gives up silently", () => {
  test("L1 a URL that arrives after boot still attaches once and wakes the act", async () => {
    const f = listenerFixture({ urlAtBoot: false });
    await f.listener.attempt();
    expect(f.listener.attached()).toBe(false);
    expect(f.logs.filter(l => l.includes("URL stands unknown"))).toHaveLength(1);
    await f.listener.attempt();
    expect(f.logs.filter(l => l.includes("URL stands unknown"))).toHaveLength(1);
    f.learn(); await f.settle();
    expect(f.listener.attached()).toBe(true);
    expect(f.counts()).toMatchObject({ opens: 1, wakes: 1, unsubscribes: 1 });
    f.fireDoc(title); expect(f.counts().wakes).toBe(2);
    f.fireDoc("unrelated"); expect(f.counts().wakes).toBe(2);
  });
  test("L1 CONTROL a URL present at boot attaches once, not twice, whatever pulses follow", async () => {
    const f = listenerFixture({ urlAtBoot: true });
    await f.listener.attempt(); await f.listener.attempt();
    await f.listener.attempt();
    expect(f.counts()).toMatchObject({ opens: 1, wakes: 1 });
    expect(f.logs).toEqual([]);
  });
  test("L2 a rejected open logs by name and the next causal change attaches", async () => {
    const f = listenerFixture({ urlAtBoot: true }); f.failOpen(true);
    await f.listener.attempt();
    expect(f.logs.some(l => l.includes("face grant arrival unavailable"))).toBe(true);
    expect(f.listener.attached()).toBe(false);
    f.failOpen(false); await f.listener.attempt();
    expect(f.listener.attached()).toBe(true);
    expect(f.counts().opens).toBe(2);
  });
  test("L3 stop detaches the document listener and ends the catalog watch", async () => {
    const f = listenerFixture({ urlAtBoot: true });
    await f.listener.attempt(); f.listener.stop();
    expect(f.hasDocListener()).toBe(false);
    const g = listenerFixture({ urlAtBoot: false });
    await g.listener.attempt(); g.listener.stop(); g.learn(); await g.settle();
    expect(g.counts().opens).toBe(0);
  });
});

describe("the lift stands off the ea path (Sol/P5: the seated verdict gates the bindings, the lift's wait never does)", () => {
  function seatWith(lift: () => Promise<void>) {
    let known = true, lifts = 0;
    const logs: string[] = [];
    const seat = makeFaceSeat({
      group, selfVerifyingKey: self, personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
      knowsAgent: async () => known, grants: async () => [], founderStanding: async () => "clear",
      verify: async () => ({ ok: true }), ingest: async () => {}, lift: async () => { lifts++; await lift(); }, log: (m) => { logs.push(m); },
    });
    return { seat, logs, lifts: () => lifts };
  }
  test("RED: a lift that never answers does not hold `run()` or `settled()`; CONTROL: the lift was still asked, once", async () => {
    const { seat, lifts } = seatWith(() => new Promise<never>(() => {}));
    expect(await seat.run(), "the seated verdict returns").toBe(true);
    await seat.settled();
    expect(lifts(), "the lift began").toBe(1);
  }, 5_000);
  test("RED: a lift that faults after the verdict is named and retried by the next pass; CONTROL: a lift that succeeds is not asked twice", async () => {
    let fail = true;
    const { seat, logs, lifts } = seatWith(async () => { if (fail) throw new Error("lift"); });
    expect(await seat.run()).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(logs.join("\n")).toContain("face lift faulted");
    fail = false;
    expect(await seat.run()).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(lifts()).toBe(2);
    expect(await seat.run()).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(lifts(), "a lifted seat is not lifted again").toBe(2);
  });
});
