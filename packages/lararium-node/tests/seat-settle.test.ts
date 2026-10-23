/**
 * seat-settle — a fold of the fleet's edge board sets off the key side's answer, with no person typing a verb.
 *
 * The first block drives the settler over a REAL scratch vessel: a real Repo, a real fleet edge board, a real
 * edge shadow ring whose `onRefold` calls the settler, the real facts and marks functions, and a key shore that
 * stands in for the daemon island (it signs each roll under the vessel's own key, as the island does).
 *
 *   S1  RED: a raise lands on the board and gets counted. With no settler wired to the fold, no roll happens: the
 *       ledger marks nothing and the ring's own reading holds the raise as owed (today's vessel, until a person
 *       runs `lares edge settle`).
 *       GREEN: with the settler on the ring's fold, the same raise gets its roll and its mark with no call
 *       from outside, and the ring reads the mark.
 *   S2  ONCE: a second board move (a lift, then a second raise) answers the new raise alone; the first raise's
 *       cid never reaches the key shore's plan again as owed.
 *   S3  NO AUTHORITY: a raise the key shore answers `no-authority` keeps its roll in the ledger, stays owed, and
 *       gets tried again at the next fold; when the shore then sees the seat leave, the raise reads as answered.
 *   S4  a shadow over this vessel's own edge places nothing.
 *
 * The second block drives the settler's own rules over stand-in deps:
 *   U1  no fold, no settle: with no `onFold` call nothing runs.           U2  nothing owed places nothing.
 *   U3  a fold that lands while a settle runs sets off exactly one more.  U4  a fault leaves the next fold free.
 *   U5  an island that did not run marks nothing.                         U6  a disposed settler starts nothing.
 *   U7  AN ISLAND THAT NEVER ANSWERS HOLDS NOTHING BACK: one fold behind a waiting ask queues one more settle; a
 *       second fold abandons the ask, and the settle that follows plans from the facts again and lands.
 *   U8  a composition that leaves while the island answers marks nothing.
 *
 * The third block drives `askIslandVerb`: the outcome on the daemon's document answers the ask (A1), an error
 * outcome rejects by the island's words (A2), an outcome that already stands answers with no placement (A3),
 * and an abandoned ask rejects by name and stops listening (A4).
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import {
  concludeVerb, deviceEdgeId, ed25519SignerFromSeed, edgeLedgerDocUrl, emptyLarDoc, keptSeatRolls, materializeSharedLarDoc,
  raisesSeenThrough, signSeatRoll, type LarDoc, type SeatRoll,
} from "@lararium/mesh";
import {
  generateOrLoadPersonaGroupRoot, generateOrLoadVesselIdentity, loadPersonaGroupRootVerifyingKey, loadVesselSigningSeed,
  loadVesselVerifyingKey,
} from "../src/node-vessel-identity.js";
import { runEdgeKapae } from "../src/commands/edge-kapae-cmd.js";
import { runEdgeSeatFacts, runEdgeSeatMarks, type EdgeSeatFacts } from "../src/commands/edge-seats.js";
import { makeEdgeShadowRing, type EdgeShadowFold } from "../src/edge-shadow-ring.js";
import { makeSeatSettler, raisesOwed, type SeatDutiesAnswer, type SeatSettler } from "../src/seat-settle.js";
import { IslandAskAbandoned, IslandVerbRefused, askIslandVerb } from "../src/island-verb-ask.js";
import { larSealHome } from "../src/vessel-paths.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { atomKeyOf, atomSeedOf, seedFaceAtom, wornAtomKey } from "./atom-fixture.js";
import { seedFleet } from "./fleet-seed-fixture.js";

const bare = (key: string): string => key.trim().toLowerCase().replace(/^0x/, "");

describe("a fold of the fleet's board settles the key side", () => {
  let custody: SeatedScratchCustody;
  let repo: Repo;
  let fleetRoot: string;
  let vesselKey: string;
  /** How the stand-in key shore answers a seat: it saw the seat leave, or it holds no hand over it. */
  let how: "revoked" | "no-authority";
  /** Every plan the key shore got asked: the raises its facts carried as not yet rolled. */
  let asked: string[][];
  let logs: string[];

  beforeEach(async () => {
    custody = await seatScratchCustody("seat-settle");
    await generateOrLoadVesselIdentity();
    await generateOrLoadPersonaGroupRoot(0);
    await seedFaceAtom(0);
    repo = new Repo({});
    await seedFleet(0, { repo });
    fleetRoot = bare((await loadPersonaGroupRootVerifyingKey(0))!);
    vesselKey = bare((await atomKeyOf()));
    how = "revoked";
    asked = [];
    logs = [];
    waiting = [];
    reported = new Set();
  });
  afterEach(async () => { await repo.shutdown().catch(() => {}); await custody.drop(); });

  /** The daemon island's part: answer each raise the facts carry as unrolled with one signed roll per edge. */
  const keyShore = async (facts: Pick<EdgeSeatFacts, "fleetRoot" | "acts" | "rolled">): Promise<SeatDutiesAnswer> => {
    const rolled = new Set(facts.rolled);
    const byEdge = new Map<string, string[]>();
    for (const act of facts.acts) {
      if (!act.raised || rolled.has(act.actCid)) continue;
      byEdge.set(act.edgeId, [...(byEdge.get(act.edgeId) ?? []), act.actCid]);
    }
    asked.push([...byEdge.values()].flat().sort());
    const sign = ed25519SignerFromSeed(await atomSeedOf());
    const rolls = [];
    for (const [edgeId, raiseCids] of byEdge) {
      const roll: SeatRoll = { kind: "seat-roll", scope: facts.fleetRoot, edgeId, raiseCids, how };
      rolls.push(await signSeatRoll(roll, sign));
    }
    return { ran: true, outcomes: rolls.map(() => ({ did: how })), rolls };
  };

  /**
   * THE HANDSHAKE WITH THE RING. `reported` holds each raise a fold the ring REPORTED (its fold callback ran, so
   * the settler heard of it) has read; a waiter for a raise wakes from that callback and from nowhere else.
   */
  let reported = new Set<string>();
  let waiting: Array<{ readonly cid: string; readonly wake: () => void }> = [];
  const report = (ring: { fold(): EdgeShadowFold | null }): void => {
    for (const r of ring.fold()?.fleets.find((f) => f.fleetRoot === fleetRoot)?.readings.values() ?? []) for (const cid of r.raiseCids) reported.add(cid);
    waiting = waiting.filter((w) => { if (!reported.has(w.cid)) return true; w.wake(); return false; });
  };

  /** A ring over the scratch vessel, with a settler on its fold when `wired`. */
  const stand = async (wired: boolean) => {
    let settler: SeatSettler | null = null;
    const ring = makeEdgeShadowRing({
      repo, vesselKey: () => vesselKey, sealHome: larSealHome(),
      fleetRoots: () => [fleetRoot], vesselKeyOfPeer: () => null, realmNymOfPeer: () => null,
      onRefold: () => { settler?.onFold(); report(ring); },
    });
    reported = new Set();
    if (wired) {
      settler = makeSeatSettler({
        wornFleetRoot: () => fleetRoot,
        fold: () => ring.fold(),
        facts: async (root) => (await runEdgeSeatFacts({ repo, fleetRoot: root })).fleets[0] ?? null,
        answer: (facts) => ({ answer: keyShore(facts), abandon: () => {} }),
        mark: (root, rolls) => runEdgeSeatMarks({ repo, fleetRoot: root, rolls }),
        afterMarks: async () => { await ring.refold(); },
        onLog: (line) => logs.push(line),
      });
    }
    await ring.refold();
    return { ring, settler };
  };
  const ledger = async () => (await materializeSharedLarDoc(repo, edgeLedgerDocUrl(vesselKey), "ledger:edge")).doc();
  const raise = async (device: string, raised = true) => (await runEdgeKapae({ repo, sealHome: larSealHome(), device, raised })).actCid;
  /** Resolves once a fold the board's own move set off reads the raise: the ring's fold callback wakes it. */
  const foldReads = (_ring: unknown, cid: string): Promise<void> =>
    new Promise<void>((done) => { if (reported.has(cid)) done(); else waiting.push({ cid, wake: done }); });

  test("S1 — a counted raise gets no roll until a person settles; with the settler on the fold it gets one by itself", async () => {
    const device = "ab".repeat(32);
    // RED (today's vessel): the ring folds, the raise counts, and nothing answers it.
    const unwired = await stand(false);
    const first = await raise(device);
    await foldReads(unwired.ring, first);
    expect(raisesOwed(unwired.ring.fold(), fleetRoot)).toEqual({ owed: [first], selfAside: false });
    expect([...raisesSeenThrough(await ledger(), fleetRoot)]).toEqual([]);
    expect(asked).toEqual([]);
    unwired.ring.dispose();

    // GREEN: the same board, a settler on the fold. A second raise moves the board; the fold answers BOTH.
    const wired = await stand(true);
    const second = await raise("cd".repeat(32));
    await foldReads(wired.ring, second);
    await wired.settler!.idle();
    expect(asked).toEqual([[first, second].sort()]);
    expect([...raisesSeenThrough(await ledger(), fleetRoot)].sort()).toEqual([first, second].sort());
    expect(keptSeatRolls(await ledger(), fleetRoot).map((r) => r.how)).toEqual(["revoked", "revoked"]);
    // The ring read the marks: no raise stays owed, and a gate reads the seat as rolled.
    expect(raisesOwed(wired.ring.fold(), fleetRoot)).toEqual({ owed: [], selfAside: false });
    expect(logs.some((l) => l.includes("2 raise(s) owed, 2 marked"))).toBe(true);
    wired.ring.dispose();
  });

  test("S2 — a vessel answers each counted raise once: a later fold plans the new raise alone", async () => {
    const wired = await stand(true);
    const first = await raise("ab".repeat(32));
    await foldReads(wired.ring, first);
    await wired.settler!.idle();
    await raise("ab".repeat(32), false);                                   // a lift: the board moves, nothing new owed
    const second = await raise("ef".repeat(32));
    await foldReads(wired.ring, second);
    await wired.settler!.idle();
    expect(asked.flat().filter((cid) => cid === first).length).toBe(1);
    expect(asked[asked.length - 1]).toEqual([second]);
    expect([...raisesSeenThrough(await ledger(), fleetRoot)].sort()).toEqual([first, second].sort());
    wired.ring.dispose();
  });

  test("S3 — no revoke authority keeps the roll, stays owed, and gets tried again at the next fold", async () => {
    how = "no-authority";
    const wired = await stand(true);
    const held = await raise("ab".repeat(32));
    await foldReads(wired.ring, held);
    await wired.settler!.idle();
    expect(keptSeatRolls(await ledger(), fleetRoot).map((r) => r.how)).toEqual(["no-authority"]);   // the roll stays kept
    expect([...raisesSeenThrough(await ledger(), fleetRoot)]).toEqual([]);                            // and the raise owed
    expect(raisesOwed(wired.ring.fold(), fleetRoot)!.owed).toEqual([held]);
    const tries = asked.length;
    // No fold, no retry: nothing spins between folds.
    await new Promise<void>((r) => setImmediate(r));
    await wired.settler!.idle();
    expect(asked.length).toBe(tries);
    // The next fold tries again; the seat's own hand answered meanwhile, so this vessel sees the seat leave.
    how = "revoked";
    const other = await raise("cd".repeat(32));
    await foldReads(wired.ring, other);
    await wired.settler!.idle();
    expect(asked[asked.length - 1]).toEqual([held, other].sort());
    expect([...raisesSeenThrough(await ledger(), fleetRoot)].sort()).toEqual([held, other].sort());
    wired.ring.dispose();
  });

  test("S4 — a shadow over this vessel's own edge places nothing", async () => {
    const wired = await stand(true);
    const own = await raise(vesselKey);
    await foldReads(wired.ring, own);
    await wired.settler!.idle();
    expect(wired.ring.fold()!.fleets[0]!.readings.get(deviceEdgeId(fleetRoot, vesselKey))?.stands).toBe(true);
    expect(asked).toEqual([]);
    expect([...raisesSeenThrough(await ledger(), fleetRoot)]).toEqual([]);
    wired.ring.dispose();
  });
});

describe("the settler's own rules", () => {
  const ROOT = "aa".repeat(32);
  const foldOwing = (cids: string[], rolled: string[] = [], selfAside = false): EdgeShadowFold => ({
    realms: [],
    fleets: [{ fleetRoot: ROOT, selfAside, rolled: new Set(rolled), readings: new Map([["edge-1", { stands: true, raiseCids: cids } as never]]) }],
  });
  /** Resolves once the settler has placed its ask: the harness's own `answer` port says so. */
  const asked = (h: { readonly placed: Promise<void> }): Promise<void> => h.placed;
  const harness = (over: Partial<Parameters<typeof makeSeatSettler>[0]> = {}) => {
    const calls: string[] = [];
    let place!: () => void;
    const placed = new Promise<void>((r) => { place = r; });
    const base = {
      wornFleetRoot: () => ROOT,
      fold: () => foldOwing(["r1"]),
      facts: async () => { calls.push("facts"); return { fleetRoot: ROOT, acts: [], rolled: [], edges: [], selfAside: false }; },
      answer: () => ({ answer: (async () => { calls.push("answer"); return { ran: true, outcomes: [{ did: "revoked" }], rolls: [{ a: 1 }] }; })(), abandon: () => {} }),
      mark: async () => { calls.push("mark"); return { marked: ["r1"] }; },
      afterMarks: async () => { calls.push("after"); },
      onLog: (line: string) => calls.push(`log:${line}`),
      ...over,
    } as Parameters<typeof makeSeatSettler>[0];
    const settler = makeSeatSettler({ ...base, answer: (facts) => { const ask = base.answer(facts); place(); return ask; } });
    return { calls, settler, placed };
  };

  test("U1 — no fold, no settle", async () => {
    const h = harness();
    await h.settler.idle();
    expect(h.calls).toEqual([]);
    h.settler.onFold();                                                    // control: a fold runs the three steps in order
    await h.settler.idle();
    expect(h.calls.filter((c) => !c.startsWith("log:"))).toEqual(["facts", "answer", "mark", "after"]);
  });

  test("U2 — nothing owed, a dark reading, no worn fleet and a fleet the fold never read each place nothing", async () => {
    for (const over of [
      { fold: () => foldOwing(["r1"], ["r1"]) }, { fold: () => null }, { wornFleetRoot: () => null }, { wornFleetRoot: () => "bb".repeat(32) },
      { fold: () => foldOwing(["r1"], [], true) },
    ]) {
      const h = harness(over);
      h.settler.onFold();
      await h.settler.idle();
      expect(h.calls).toEqual([]);
    }
  });

  test("U3 — a fold that lands while a settle runs sets off exactly one more", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let answers = 0;
    let abandoned = 0;
    const h = harness({ answer: () => ({ answer: (async () => { answers += 1; if (answers === 1) await gate; return { ran: true, rolls: [] }; })(), abandon: () => { abandoned += 1; } }) });
    h.settler.onFold();
    await asked(h);
    h.settler.onFold();                                                    // one fold meets the waiting ask: it queues, and abandons nothing
    expect(abandoned).toBe(0);
    release();
    await h.settler.idle();
    expect(answers).toBe(2);
  });

  test("U4 — a settle that faults names itself and leaves the next fold free", async () => {
    let fault = true;
    const h = harness({ answer: () => ({ answer: (async () => { if (fault) throw new Error("the island left"); return { ran: true, rolls: [] }; })(), abandon: () => {} }) });
    h.settler.onFold();
    await h.settler.idle();
    expect(h.calls.some((c) => c.startsWith("log:a settle faulted") && c.includes("the island left"))).toBe(true);
    expect(h.calls).not.toContain("mark");
    fault = false;
    h.settler.onFold();
    await h.settler.idle();
    expect(h.calls.filter((c) => c === "facts").length).toBe(2);
  });

  test("U5 — an island that did not run marks nothing and says why", async () => {
    const h = harness({ answer: () => ({ answer: Promise.resolve({ ran: false, reason: "no veil identity stands" }), abandon: () => {} }) });
    h.settler.onFold();
    await h.settler.idle();
    expect(h.calls).not.toContain("mark");
    expect(h.calls.some((c) => c.includes("no veil identity stands"))).toBe(true);
  });

  test("U6 — a disposed settler starts nothing", async () => {
    const h = harness();
    h.settler.dispose();
    h.settler.onFold();
    await h.settler.idle();
    expect(h.calls).toEqual([]);
  });

  test("U7 — a second fold abandons an ask the island never answered, and the next settle lands", async () => {
    let asks = 0;
    const h = harness({ answer: () => {
      asks += 1;
      if (asks > 1) return { answer: Promise.resolve({ ran: true, outcomes: [{ did: "revoked" }], rolls: [{ a: 1 }] }), abandon: () => {} };
      // The first ask never answers: only its abandon settles it, as the island ask does.
      let stop!: (e: Error) => void;
      const never = new Promise<never>((_, reject) => { stop = reject; });
      return { answer: never, abandon: () => stop(new Error("the ask ended before the island answered")) };
    } });
    h.settler.onFold();
    await asked(h);
    h.settler.onFold();                                                    // the first fold behind it waits
    await new Promise<void>((r) => setImmediate(r));
    expect(asks).toBe(1);
    expect(h.calls).not.toContain("mark");
    h.settler.onFold();                                                    // the second fold stops the wait
    await h.settler.idle();
    expect(asks).toBe(2);
    expect(h.calls.filter((c) => c === "mark").length).toBe(1);            // the settle that followed landed its marks
    expect(h.calls.some((c) => c.startsWith("log:a settle faulted") && c.includes("before the island answered"))).toBe(true);
  });

  test("U8 — a composition that leaves while the island answers marks nothing", async () => {
    let answer!: (a: { ran: boolean; rolls: unknown[] }) => void;
    const h = harness({ answer: () => ({ answer: new Promise((resolve) => { answer = resolve; }), abandon: () => {} }) });
    h.settler.onFold();
    await asked(h);
    h.settler.dispose();
    answer({ ran: true, rolls: [{ a: 1 }] });                              // the island's answer lands after the teardown began
    await h.settler.idle();
    expect(h.calls).not.toContain("mark");
    expect(h.calls).not.toContain("after");
  });
});

describe("the main thread asks its island a verb", () => {
  const stand = () => {
    const repo = new Repo({});
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const placed: Array<{ verb: string; requestId: string }> = [];
    let onPlace: () => void = () => {};
    const placedOnce = new Promise<void>((r) => { onPlace = r; });
    const conclude = (requestId: string, status: "done" | "error", output: Record<string, unknown>, errorMessage?: string): void => {
      const outcome = concludeVerb({
        requestId, verb: "seat-duties", status, requestedBy: "vessel", cause: "test-island", batchMode: "best-effort",
        results: { summary: { ok: status === "done", output } }, ...(errorMessage !== undefined ? { errorMessage } : {}),
      });
      daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
    };
    return { daemonHandle, placed, placedOnce, conclude, place: (o: { verb: string; requestId: string }) => { placed.push({ verb: o.verb, requestId: o.requestId }); onPlace(); } };
  };

  test("A1 — the outcome on the daemon's document answers the ask", async () => {
    const s = stand();
    const ask = askIslandVerb({ daemonHandle: s.daemonHandle, placeVerb: s.place, verb: "seat-duties", args: { facts: {} }, requestedBy: "vessel", requestId: "ask-1" });
    await s.placedOnce;                                                    // the ask read the document first, then placed
    expect(s.placed).toEqual([{ verb: "seat-duties", requestId: "ask-1" }]);
    s.conclude("another-request", "done", { ran: false });                 // control: another request's outcome answers nothing
    s.conclude("ask-1", "done", { ran: true, rolls: [1, 2] });
    expect(await ask.answer).toEqual({ ran: true, rolls: [1, 2] });
  });

  test("A2 — an error outcome rejects by the island's own words", async () => {
    const s = stand();
    const ask = askIslandVerb({ daemonHandle: s.daemonHandle, placeVerb: s.place, verb: "seat-duties", args: {}, requestedBy: "vessel", requestId: "ask-2" });
    await s.placedOnce;
    s.conclude("ask-2", "error", {}, "this vessel carries no device edge of its own");
    const refused = await ask.answer.catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(IslandVerbRefused);
    expect((refused as Error).message).toBe("this vessel carries no device edge of its own");
  });

  test("A3 — an outcome that already stands answers with no placement", async () => {
    const s = stand();
    s.conclude("ask-3", "done", { ran: true });
    const ask = askIslandVerb({ daemonHandle: s.daemonHandle, placeVerb: s.place, verb: "seat-duties", args: {}, requestedBy: "vessel", requestId: "ask-3" });
    expect(await ask.answer).toEqual({ ran: true });
    expect(s.placed).toEqual([]);
  });

  test("A4 — an abandoned ask rejects by name and stops listening", async () => {
    const s = stand();
    // A first ask stands the document's one store door; every later ask shares it and adds its own listener alone.
    const first = askIslandVerb({ daemonHandle: s.daemonHandle, placeVerb: s.place, verb: "seat-duties", args: {}, requestedBy: "vessel", requestId: "ask-4a" });
    first.abandon();
    await expect(first.answer).rejects.toBeInstanceOf(IslandAskAbandoned);
    const before = s.daemonHandle.listenerCount("change");
    const ask = askIslandVerb({ daemonHandle: s.daemonHandle, placeVerb: s.place, verb: "seat-duties", args: {}, requestedBy: "vessel", requestId: "ask-4" });
    expect(s.daemonHandle.listenerCount("change")).toBe(before + 1);        // control: the ask listens while it waits
    ask.abandon();
    await expect(ask.answer).rejects.toBeInstanceOf(IslandAskAbandoned);
    expect(s.daemonHandle.listenerCount("change")).toBe(before);            // and no ask leaves a listener behind
    s.conclude("ask-4", "done", { ran: true });                            // a late outcome moves nothing
  });
});
