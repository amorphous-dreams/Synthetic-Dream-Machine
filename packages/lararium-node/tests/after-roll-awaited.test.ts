/**
 * H2 — the after-roll refold is awaited, serialized and truthful, never fire-and-forget.
 *
 * G15: the chain stands in `src/after-roll-chain.ts` and these vectors RUN it (the order, the three-way `try` split
 * and the truthful return are also proved in `after-roll-chain.test.ts`); no assertion reads the vessel's source
 * shape for the chain itself. What stays a source fact is WIRING: the vessel builds its chain from the module, and
 * every caller awaits the answer.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createAfterRoll } from "../src/after-roll-chain.js";

const SRC = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");

describe("★ H2 — the roll answers Promise<boolean> from a pass that began AFTER it landed ★", () => {
  test("★ the answer arrives only after the refold finished — never fire-and-forget ★", async () => {
    let refolded = false;
    const roll = createAfterRoll({
      refoldAntigen: async () => { await Promise.resolve(); await Promise.resolve(); refolded = true; },
      refoldMembership: async () => {},
      reverdict: () => {},
      representIfMoved: async () => {},
      log: () => {},
    });
    const answer = await roll("nexus-a");
    expect(refolded, "the answer left before the refold ran: represented/refolded would read false").toBe(true);
    expect(answer).toBe(true);
  });

  test("★ SERIALIZED — a second roll waits on the running pass and runs its OWN full pass after ★", async () => {
    const events: string[] = [];
    let release!: () => void;
    const parked = new Promise<void>((r) => { release = r; });
    let n = 0;
    const roll = createAfterRoll({
      refoldAntigen: async () => { const me = ++n; events.push(`start${me}`); if (me === 1) await parked; events.push(`end${me}`); },
      refoldMembership: async () => {},
      reverdict: () => {},
      log: () => {},
    });
    const first = roll("a");
    const second = roll("a");
    release();
    await Promise.all([first, second]);
    expect(events).toEqual(["start1", "end1", "start2", "end2"]);
  });
});

describe("the vessel wires the module, and every caller AWAITS the answer", () => {
  test("the vessel builds its chain from the module and keeps no closure chain of its own", () => {
    expect(SRC).toMatch(/import \{ createAfterRoll \} from "\.\/after-roll-chain\.js";/);
    expect(SRC).toMatch(/createAfterRoll\(\{/);
    expect(SRC, "the chain variable moved into the module").not.toMatch(/let afterRollChain/);
    expect(SRC, "the void-IIFE pattern that made represented/refolded always read false must not return").not.toMatch(/void\s*\(\s*async\s*\(\)\s*=>\s*\{\s*try/);
  });

  test("the door table hands afterRoll straight to onRolled, and the one onReconnect site awaits it", () => {
    expect(SRC).toMatch(/onRolled:\s*afterRoll,/);
    const sites = SRC.match(/onReconnect:\s*async \(\) => \{ await afterRoll\(\); \},/g) ?? [];
    expect(sites.length).toBe(1);
    expect(SRC).not.toMatch(/onReconnect:\s*async \(\) => afterRoll\(\),/);
  });
});
