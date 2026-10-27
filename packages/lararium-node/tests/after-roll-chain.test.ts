/**
 * G15 — the after-roll chain runs as a MODULE (`src/after-roll-chain.ts`), and its queue is BOUNDED by a causal rule.
 *
 * The chain used to live as a closure inside `openNodeVessel`, so its proof read source shape. It now stands alone:
 * these vectors RUN it. Three groups —
 *   · ORDER (the CONTROL): the stage order, the three-way `try` split and the truthful return hold exactly as the
 *     closure held them;
 *   · THE BOUND: a storm of rolls across several holders completes in a bounded count of passes, one holder at a
 *     time, with no overlap and no starved holder — the rule counts passes and queues per holder, never a clock;
 *   · NO CLOCK: a wall clock and every timer throw for the length of the storm.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { createAfterRoll, type AfterRollStages } from "../src/after-roll-chain.js";

type Trace = string[];

function stagesOf(trace: Trace, over: Partial<AfterRollStages> = {}): AfterRollStages {
  return {
    landOwedHostingActs: async () => { trace.push("land"); },
    refoldAntigen: async () => { trace.push("antigen"); },
    refoldMembership: async () => { trace.push("membership"); },
    refreshRealmPlane: async () => { trace.push("realm"); },
    refoldEdgeShadows: async () => { trace.push("edge"); },
    reverdict: () => { trace.push("reverdict"); },
    representIfMoved: async () => { trace.push("represent"); },
    log: (line) => { trace.push(`log:${line}`); },
    ...over,
  };
}

const ORDER = ["land", "antigen", "membership", "realm", "edge", "reverdict", "represent"];

describe("★ the chain stands as a module — the present ordering holds (CONTROL) ★", () => {
  test("a single roll runs the stages in the house order and answers true", async () => {
    const trace: Trace = [];
    const roll = createAfterRoll(stagesOf(trace));
    expect(await roll("nexus-a")).toBe(true);
    expect(trace).toEqual(ORDER);
  });

  test("a roll with no holder runs the same single pass", async () => {
    const trace: Trace = [];
    const roll = createAfterRoll(stagesOf(trace));
    expect(await roll()).toBe(true);
    expect(trace).toEqual(ORDER);
  });

  test("★ a fault in the realm plane never skips reverdict or representIfMoved (the three-way split) ★", async () => {
    const trace: Trace = [];
    const roll = createAfterRoll(stagesOf(trace, { refreshRealmPlane: async () => { throw new Error("realm boom"); } }));
    expect(await roll()).toBe(true);
    expect(trace).toEqual(["land", "antigen", "membership", "log:after-roll refold failed (realm plane): realm boom", "edge", "reverdict", "represent"]);
  });

  test("a fault in the antigen stage skips membership alone and the later stages still run", async () => {
    const trace: Trace = [];
    const roll = createAfterRoll(stagesOf(trace, { refoldAntigen: async () => { throw new Error("antigen boom"); } }));
    expect(await roll()).toBe(true);
    expect(trace).toEqual(["land", "log:after-roll refold failed (antigen/membership): antigen boom", "realm", "edge", "reverdict", "represent"]);
  });

  test("a fault in an edge-shadow refold is logged and the pass still answers true", async () => {
    const trace: Trace = [];
    const roll = createAfterRoll(stagesOf(trace, { refoldEdgeShadows: async () => { throw new Error("edge boom"); } }));
    expect(await roll()).toBe(true);
    expect(trace).toContain("log:after-roll refold failed (edge shadows): edge boom");
    expect(trace.slice(-2)).toEqual(["reverdict", "represent"]);
  });

  test("★ the return answers ONE question — representIfMoved ran without throwing ★", async () => {
    const trace: Trace = [];
    const roll = createAfterRoll(stagesOf(trace, { representIfMoved: async () => { throw new Error("present boom"); } }));
    expect(await roll()).toBe(false);
    expect(trace.at(-1)).toBe("log:after-roll refold failed (re-present): present boom");
  });

  test("absent stages (a vessel with no realm plane, no edge shadows, no presenter) are skipped, never required", async () => {
    const trace: Trace = [];
    const roll = createAfterRoll({ refoldAntigen: async () => { trace.push("antigen"); }, refoldMembership: async () => { trace.push("membership"); }, reverdict: () => { trace.push("reverdict"); }, log: () => {} });
    expect(await roll("h")).toBe(true);
    expect(trace).toEqual(["antigen", "membership", "reverdict"]);
  });

  test("a throw out of landOwedHostingActs rejects THAT roll's caller and leaves the queue serving the next", async () => {
    const trace: Trace = [];
    let first = true;
    const roll = createAfterRoll(stagesOf(trace, { landOwedHostingActs: async () => { if (first) { first = false; throw new Error("land boom"); } trace.push("land"); } }));
    await expect(roll("a")).rejects.toThrow("land boom");
    expect(await roll("a")).toBe(true);
    expect(trace).toEqual(ORDER);
  });
});

/** A gate the test opens by hand: a stage that parks on it lets rolls land MID-PASS, deterministically. */
function gate(): { wait: Promise<void>; open: () => void } {
  let open!: () => void;
  const wait = new Promise<void>((r) => { open = r; });
  return { wait, open };
}

/** Let microtasks run until `n` gates stand (a pass reaches its parking stage a few ticks after the roll). */
async function standing(gates: unknown[], n: number): Promise<void> {
  for (let i = 0; i < 200 && gates.length < n; i++) await Promise.resolve();
  expect(gates.length).toBe(n);
}

describe("★ the bound — a roll storm completes in bounded passes, one holder at a time ★", () => {
  afterEach(() => vi.restoreAllMocks());

  /** A pass instrument: counts passes per holder, and reads overlap off an in-flight gauge. */
  function instrument(parkOn?: () => Promise<void>) {
    const passes: string[] = [];
    let inFlight = 0, maxInFlight = 0;
    let current = "";
    const stages = (): AfterRollStages => ({
      refoldAntigen: async () => {
        inFlight += 1; maxInFlight = Math.max(maxInFlight, inFlight);
        passes.push(current);
        if (parkOn) await parkOn();
        await Promise.resolve();
        inFlight -= 1;
      },
      refoldMembership: async () => {},
      reverdict: () => {},
      log: () => {},
    });
    return { passes, stages, setCurrent: (h: string) => { current = h; }, maxInFlight: () => maxInFlight };
  }

  test("★ RED: 60 rolls over 4 holders land in at most holders+1 passes, never two at once, every roll answered ★", async () => {
    const g = gate();
    const inst = instrument(() => g.wait);
    const holders = ["h0", "h1", "h2", "h3"];
    // `current` is read by the antigen stage to name which holder's pass runs; the chain names it by the head of its queue.
    const roll = createAfterRoll({ ...inst.stages(), onPass: (holder) => inst.setCurrent(holder ?? "") });
    const answers: Promise<boolean>[] = [];
    for (let i = 0; i < 60; i++) answers.push(roll(holders[i % holders.length]));
    g.open();
    const settled = await Promise.all(answers);
    expect(settled.every((a) => a === true)).toBe(true);
    expect(inst.maxInFlight()).toBe(1);
    expect(inst.passes.length).toBeLessThanOrEqual(holders.length + 1);
    for (const h of holders) expect(inst.passes, `holder ${h} must stand served`).toContain(h);
  });

  test("★ KNOWN POSITIVE for the pass counter — the retired one-pass-per-roll chain trips the same bound ★", async () => {
    const g = gate();
    const inst = instrument(() => g.wait);
    const stages = inst.stages();
    // The retired shape: every roll appends its OWN full pass to one promise chain.
    let chain: Promise<unknown> = Promise.resolve();
    const legacy = (holder: string): Promise<unknown> => { chain = chain.then(async () => { inst.setCurrent(holder); await stages.refoldAntigen(); }); return chain; };
    const answers = Array.from({ length: 60 }, (_, i) => legacy(`h${i % 4}`));
    g.open();
    await Promise.all(answers);
    expect(inst.passes.length, "the instrument must SEE the unbounded count, or a green bound proves nothing").toBe(60);
    expect(inst.passes.length).toBeGreaterThan(4 + 1);
  });

  test("★ RED: no starved holder — holder a's endless rolls re-queue BEHIND b and c, never ahead of them ★", async () => {
    const gates: ReturnType<typeof gate>[] = [];
    const inst = instrument(() => { const g = gate(); gates.push(g); return g.wait; });
    const roll = createAfterRoll({ ...inst.stages(), onPass: (holder) => inst.setCurrent(holder ?? "") });
    const a1 = roll("a");                    // a's pass starts and parks
    const a2 = roll("a");                    // lands mid-pass: queues a's NEXT pass
    const b = roll("b");
    const c = roll("c");
    await standing(gates, 1); gates[0]!.open(); await a1;
    await standing(gates, 2);                       // a's second pass runs (it queued first)
    const a3 = roll("a");                    // a rolls AGAIN mid-pass: its third pass queues behind b and c
    gates[1]!.open(); await a2;
    await standing(gates, 3); gates[2]!.open(); await b;
    await standing(gates, 4); gates[3]!.open(); await c;
    await standing(gates, 5); gates[4]!.open(); await a3;
    expect(inst.passes).toEqual(["a", "a", "b", "c", "a"]);
    expect(inst.maxInFlight()).toBe(1);
  });

  test("★ RED: rolls landing mid-pass for ONE holder fold into ONE following pass, not one pass each ★", async () => {
    const gates: ReturnType<typeof gate>[] = [];
    const inst = instrument(() => { const g = gate(); gates.push(g); return g.wait; });
    const roll = createAfterRoll({ ...inst.stages(), onPass: (holder) => inst.setCurrent(holder ?? "") });
    const first = roll("a");
    const more = Array.from({ length: 25 }, () => roll("a"));
    await standing(gates, 1); gates[0]!.open();
    await first;
    await standing(gates, 2); gates[1]!.open();
    await Promise.all(more);
    expect(inst.passes).toEqual(["a", "a"]);
  });

  test("★ a roll that lands mid-pass still gets a FULL pass after (never answered by the pass already running) ★", async () => {
    const gates: ReturnType<typeof gate>[] = [];
    const inst = instrument(() => { const g = gate(); gates.push(g); return g.wait; });
    const roll = createAfterRoll({ ...inst.stages(), onPass: (holder) => inst.setCurrent(holder ?? "") });
    let lateDone = false;
    const first = roll("a");
    const late = roll("a").then((v) => { lateDone = true; return v; });
    await standing(gates, 1); gates[0]!.open();
    await first;
    expect(lateDone).toBe(false);
    await standing(gates, 2); gates[1]!.open();
    expect(await late).toBe(true);
    expect(inst.passes.length).toBe(2);
  });

  test("CONTROL: a single roll runs exactly one pass", async () => {
    const inst = instrument();
    const roll = createAfterRoll({ ...inst.stages(), onPass: (holder) => inst.setCurrent(holder ?? "") });
    expect(await roll("solo")).toBe(true);
    expect(inst.passes).toEqual(["solo"]);
  });

  test("a pass whose representIfMoved answers false answers false to ITS waiters only", async () => {
    const gates: ReturnType<typeof gate>[] = [];
    let n = 0;
    const roll = createAfterRoll({
      refoldAntigen: async () => { const g = gate(); gates.push(g); await g.wait; },
      refoldMembership: async () => {},
      reverdict: () => {},
      representIfMoved: async () => { n += 1; if (n === 1) throw new Error("first present fails"); },
      log: () => {},
    });
    const first = roll("a");
    const second = roll("a");
    await standing(gates, 1); gates[0]!.open();
    expect(await first).toBe(false);
    await standing(gates, 2); gates[1]!.open();
    expect(await second).toBe(true);
  });

  test("★ NO CLOCK — a throwing clock spy and throwing timers prove no wall clock decides the storm ★", async () => {
    const boom = () => { throw new Error("a clock was read"); };
    vi.spyOn(Date, "now").mockImplementation(boom);
    vi.spyOn(performance, "now").mockImplementation(boom);
    vi.spyOn(globalThis, "setTimeout").mockImplementation(boom as never);
    vi.spyOn(globalThis, "setInterval").mockImplementation(boom as never);
    const inst = instrument();
    const roll = createAfterRoll({ ...inst.stages(), onPass: (holder) => inst.setCurrent(holder ?? "") });
    const answers = Array.from({ length: 30 }, (_, i) => roll(`h${i % 3}`));
    expect((await Promise.all(answers)).every(Boolean)).toBe(true);
    expect(inst.maxInFlight()).toBe(1);
  });

  test("★ KNOWN POSITIVE for the clock spy — the spy throws when a timer IS asked ★", () => {
    vi.spyOn(globalThis, "setTimeout").mockImplementation((() => { throw new Error("a clock was read"); }) as never);
    expect(() => setTimeout(() => {}, 0)).toThrow("a clock was read");
  });

  test("the module's own source names no clock and no timer", () => {
    const src = readFileSync(new URL("../src/after-roll-chain.ts", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/Date\.now|performance\.now|setTimeout|setInterval|new Date\(/);
  });
});
