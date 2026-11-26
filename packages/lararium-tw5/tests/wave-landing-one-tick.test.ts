/**
 * THE LANDING QUEUE APPLIES A SLICE IN ONE SYNCHRONOUS RUN.
 *
 * A `SliceLander` splits each landing: `prepare` awaits, the `apply` it answers runs synchronously. The queue prepares
 * every change of a slice, then applies them all with no await between, so the wiki coalesces the slice into one change
 * dispatch. An apply that declines (a hand stands) lands through `landOne` after the run, in slice order, and every later
 * change of its title follows it there. The failed-item retry and its "a later change of the title superseded it" rule
 * hold across both halves.
 *
 * Control: a plain function lander lands one at a time, as before.
 */
import { describe, expect, test } from "vitest";
import type { LarTiddlerChange } from "@lararium/mesh/tiddler-store";
import { WaveLanding, type SliceLander } from "../src/wave-landing.js";

const change = (title: string, text = title): LarTiddlerChange => ({ title, record: { tiddler: { title, text } }, origin: { kind: "crdt-remote", edgeIsland: "peer" } });
const hostTurn = (): Promise<void> => new Promise<void>((resolve) => setImmediate(resolve));

interface Script {
  /** Titles whose apply declines (a standing hand). */
  readonly decline?: ReadonlySet<string>;
  /** Texts whose apply throws once. */
  readonly applyFails?: Set<string>;
  /** Texts whose prepare throws once. */
  readonly prepareFails?: Set<string>;
}

function lander(log: string[], script: Script = {}): SliceLander {
  return {
    async landOne(c) { await hostTurn(); log.push(`one:${String(c.record!.tiddler.text)}`); },
    async prepare(c) {
      const text = String(c.record!.tiddler.text);
      await hostTurn();
      if (script.prepareFails?.delete(text)) throw new Error(`prepare ${text}`);
      log.push(`prep:${text}`);
      return () => {
        if (script.decline?.has(c.title)) return false;
        if (script.applyFails?.delete(text)) throw new Error(`apply ${text}`);
        log.push(`apply:${text}`);
        return true;
      };
    },
  };
}

describe("the landing queue applies a slice in one synchronous run", () => {
  test("every change prepares first, then every change applies with no host turn between the applies", async () => {
    const log: string[] = [];
    // A run opens at an apply and closes at the next microtask: applies separated by any await open a run each.
    let runs = 0;
    let open = false;
    const base = lander(log);
    const watched: SliceLander = {
      landOne: base.landOne,
      async prepare(c) {
        const apply = await base.prepare(c);
        return () => {
          if (!open) { open = true; runs++; queueMicrotask(() => { open = false; }); }
          return apply();
        };
      },
    };
    const landing = new WaveLanding(watched, hostTurn);
    landing.enqueueFamily(["a", "b", "c"].map((t) => change(`lar:///t/tick/${t}`, t)));
    await landing.idle();
    expect(log).toEqual(["prep:a", "prep:b", "prep:c", "apply:a", "apply:b", "apply:c"]);
    expect(runs, "the three applies share one synchronous run").toBe(1);
  });

  test("a declined apply lands through landOne after the run, and a later change of its title follows it there in order", async () => {
    const log: string[] = [];
    const held = "lar:///t/tick/held";
    const landing = new WaveLanding(lander(log, { decline: new Set([held]) }), hostTurn);
    landing.enqueueFamily([change(held, "h1"), change("lar:///t/tick/x", "x"), change(held, "h2"), change("lar:///t/tick/y", "y")]);
    await landing.idle();
    expect(log.filter((line) => !line.startsWith("prep:"))).toEqual(["apply:x", "apply:y", "one:h1", "one:h2"]);
  });

  test("a failed apply retries through landOne unless a later change of its title landed in the slice; a failed prepare retries alike", async () => {
    const log: string[] = [];
    const t = "lar:///t/tick/t";
    const landing = new WaveLanding(lander(log, { applyFails: new Set(["t1", "lone"]), prepareFails: new Set(["p"]) }), hostTurn);
    landing.enqueueFamily([change(t, "t1"), change("lar:///t/tick/lone", "lone"), change(t, "t2"), change("lar:///t/tick/p", "p")]);
    await landing.idle();
    // t1 failed and t2 superseded it (no retry); "lone" and "p" retry through landOne, in slice order.
    expect(log.filter((line) => !line.startsWith("prep:"))).toEqual(["apply:t2", "one:lone", "one:p"]);
  });

  test("CONTROL: a plain function lander lands one change at a time", async () => {
    const log: string[] = [];
    const landing = new WaveLanding(async (c) => { await hostTurn(); log.push(String(c.record!.tiddler.text)); }, hostTurn);
    landing.enqueueFamily([change("lar:///t/tick/1", "1"), change("lar:///t/tick/2", "2")]);
    await landing.idle();
    expect(log).toEqual(["1", "2"]);
  });
});
