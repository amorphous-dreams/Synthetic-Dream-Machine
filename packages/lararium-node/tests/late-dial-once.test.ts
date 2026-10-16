/**
 * late-dial-once — the late dial stands ONE client adapter, however many asks race it (`lateDialOnce`,
 * open-node-vessel.ts).
 *
 * A board change (`liveBoardOpener`'s change hook) and the after-roll chain both call `representIfMoved` unserialized,
 * and an `admit-take` on a running vessel fires both. The dial's choice awaits before it stands, so each ask that read
 * "no dial" stood its own adapter, and the vessel stopped only the last one it kept.
 *
 * Proven:
 *   · RED: two asks racing one unstood dial stand it once / CONTROL: an ask after it stood stands nothing more;
 *   · RED: an ask after the vessel stood down stands nothing, and a stand in flight when it stands down reads `live`
 *     false after its await;
 *   · a stand that throws frees the flight: the next ask tries again;
 *   · the vessel's `representIfMoved` stands its late dial through this one helper.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { lateDialOnce } from "../src/open-node-vessel.js";

const SRC = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");

function rig() {
  let stood = 0;
  let down = false;
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const lives: boolean[] = [];
  const ask = lateDialOnce({
    standing: () => stood > 0,
    tornDown: () => down,
    stand: async (live) => { await gate; lives.push(live()); if (live()) stood++; },
  });
  return { ask, release, stood: () => stood, standDown: () => { down = true; }, lives };
}

describe("the late dial stands one adapter", () => {
  test("RED: two racing asks stand the dial once; CONTROL: an ask after it stood stands nothing more", async () => {
    const r = rig();
    const one = r.ask(), two = r.ask();
    r.release();
    await Promise.all([one, two]);
    expect(r.stood()).toBe(1);
    await r.ask();
    expect(r.stood()).toBe(1);
  });

  test("RED: an ask after the stand-down stands nothing; a stand in flight at the stand-down reads live false", async () => {
    const r = rig();
    const inFlight = r.ask();
    r.standDown();
    r.release();
    await inFlight;
    expect(r.lives).toEqual([false]);
    expect(r.stood()).toBe(0);
    await r.ask();
    expect(r.lives).toEqual([false]);
  });

  test("a stand that throws frees the flight for the next ask", async () => {
    let calls = 0;
    const ask = lateDialOnce({ standing: () => false, tornDown: () => false, stand: async () => { calls++; if (calls === 1) throw new Error("no pin yet"); } });
    await expect(ask()).rejects.toThrow("no pin yet");
    await ask();
    expect(calls).toBe(2);
  });

  test("the vessel's representIfMoved stands its late dial through lateDialOnce", () => {
    expect(SRC).toMatch(/representIfMoved = lateDialOnce\(\{/);
  });
});
