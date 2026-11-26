/**
 * pulama-first-stand — a vessel standing by its pūlama dials BEFORE it composes, so a session the pūlama serves composes the
 * vessel ONCE. A floor composition that stood first would open the Repo, the catalog, the Nexus island and the genesis only to
 * tear down for the sovereign composition that opens them again (the warm restand, plan/vessel-runs-cool step 7).
 *
 *   F1  RED: a session served composes once, sovereign; no floor composes before it or after it;
 *   F2  CONTROL: a pūlama that serves no session composes the floor, once;
 *   F3  a composition the vessel refuses over its session leaves the floor its own fallback stood, and asks no second one;
 *   F4  a pūlama silent past the dial's bound composes the floor meanwhile, and the dial, once it lands, composes over it;
 *   F5  CONTROL: the bound firing over a dial that already asked for its composition asks no floor (a floor asked then
 *       would tear the sovereign composition down);
 *   F6  a floor that refuses while the pūlama stays silent ends the first stand, as a refused floor ends every boot;
 *   F7  a recompose that throws under the dial leaves no composition, so the floor composes;
 *   WELD: `main` stands a pūlama's vessel through this one function, on its one recomposition chain.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { PulamaHolder } from "../src/pulama-holder.js";
import { pulamaStandBy, standFirstByPulama } from "../src/pulama-seat.js";

/** A holder whose pūlama answers each dial as `serve` says: a session, a refusal by name, or silence until `land` runs. */
function fakeHolder(serve: "session" | "refuses" | "silent"): PulamaHolder & { land(): void } {
  let open = false;
  let land: () => void = () => {};
  const landed = new Promise<void>((resolve) => { land = resolve; });
  const h = {
    land: () => land(),
    onClosed: () => () => {},
    isUnlocked: () => open,
    unlock: async () => {
      if (serve === "refuses") throw Object.assign(new Error("pulama-image-unadmitted"), { reading: "pulama-image-unadmitted" });
      if (serve === "silent") await landed;
      open = true;
      return { reading: "opens", slot: "pulama" };
    },
    lock: async () => { open = false; },
    lends: () => [0],
    worn: () => undefined,
    waiting: () => [],
    waits: () => (open ? null : "pulama-image-unadmitted"),
    landRite: async () => { throw Object.assign(new Error("rite-not-begun"), { reading: "rite-not-begun" }); },
  };
  return h as unknown as PulamaHolder & { land(): void };
}

/**
 * A vessel's recomposition chain, as `main` holds it: one composition at a time, each asked on the chain, and the standing read
 * off what composed last. `refuse` stands the sovereign composition's own floor fallback; `throws` makes it throw with nothing
 * standing; `floorRefuses` makes the floor itself refuse.
 */
function vessel(serve: "session" | "refuses" | "silent", over: { refuse?: boolean; throws?: boolean; floorRefuses?: boolean } = {}) {
  const composed: string[] = [];
  const logs: string[] = [];
  let asks = 0;
  let standing: string | null = null;
  let chain: Promise<unknown> = Promise.resolve();
  const recompose = (sovereign: boolean): Promise<{ standing: string; refused?: string }> => {
    asks += 1;
    const run = chain.then(async () => {
      standing = null;
      if (sovereign && over.throws === true) { composed.push("sovereign-threw"); throw new Error("the teardown faulted"); }
      if (!sovereign && over.floorRefuses === true) { composed.push("floor-refused"); throw new Error("the floor refused"); }
      if (sovereign && over.refuse === true) { composed.push("sovereign-refused→floor"); standing = "herm"; return { standing, refused: "outside-the-lei: …" }; }
      composed.push(sovereign ? "sovereign" : "floor");
      standing = sovereign ? "hearth" : "herm";
      return { standing };
    });
    chain = run.catch(() => undefined);
    return run;
  };
  const holder = fakeHolder(serve);
  const by = pulamaStandBy({ holder, recompose, onLog: (line) => logs.push(line) });
  let fire: () => void = () => {};
  let stopped = false;
  const first = () => standFirstByPulama({
    dial: () => by.dial(),
    floor: () => recompose(false),
    asked: () => asks > 0,
    stands: () => standing !== null,
    onLog: (line) => logs.push(line),
    silenceMs: 5_000,
    after: (fn) => { fire = () => { if (!stopped) fn(); }; return () => { stopped = true; }; },
  });
  return { composed, logs, holder, first, fire: () => fire(), standing: () => standing, recompose };
}

/** Let every settled promise run its continuations. */
const settle = async (): Promise<void> => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };

describe("the first stand dials before it composes", () => {
  test("F1 RED: a session the pūlama serves composes the vessel once, sovereign, with no floor composition beside it", async () => {
    const v = vessel("session");
    expect(await v.first()).toEqual({ session: true, waits: null });
    expect(v.composed).toEqual(["sovereign"]);
    expect(v.standing()).toBe("hearth");
  });

  test("F2 CONTROL: a pūlama that serves no session composes the floor, once, and names its refusal", async () => {
    const v = vessel("refuses");
    expect(await v.first()).toEqual({ session: false, waits: "pulama-image-unadmitted" });
    expect(v.composed).toEqual(["floor"]);
    expect(v.standing()).toBe("herm");
    expect(v.logs.some((line) => line.includes("pulama-image-unadmitted"))).toBe(true);
  });

  test("F3: a composition refused over the session leaves the floor its own fallback stood, and the first stand asks no second floor", async () => {
    const v = vessel("session", { refuse: true });
    expect(await v.first()).toEqual({ session: false, waits: "composition-refused", refused: "outside-the-lei: …" });
    expect(v.composed).toEqual(["sovereign-refused→floor"]);
    expect(v.standing()).toBe("herm");
    expect(v.holder.isUnlocked()).toBe(false);
  });

  test("F4: a pūlama silent past the bound composes the floor meanwhile, and the dial that lands later composes over it", async () => {
    const v = vessel("silent");
    const first = v.first();
    await settle();
    expect(v.composed).toEqual([]);
    v.fire();
    await settle();
    expect(v.composed).toEqual(["floor"]);
    expect(v.standing()).toBe("herm");
    expect(v.logs.some((line) => line.includes("no answer within 5000ms"))).toBe(true);
    v.holder.land();
    expect(await first).toEqual({ session: true, waits: null });
    expect(v.composed).toEqual(["floor", "sovereign"]);
    expect(v.standing()).toBe("hearth");
  });

  test("F5 CONTROL: the bound firing over a dial that already asked for its composition asks no floor", async () => {
    // The dial holds the chain (its composition runs) when the bound fires: a floor asked then would queue behind the
    // sovereign composition and tear it down.
    let asks = 0, stands = false;
    let release: () => void = () => {};
    const composing = new Promise<void>((resolve) => { release = resolve; });
    let fire: () => void = () => {};
    const floors: string[] = [];
    const first = standFirstByPulama({
      dial: async () => { asks += 1; await composing; stands = true; return { session: true, waits: null }; },
      floor: async () => { floors.push("floor"); },
      asked: () => asks > 0,
      stands: () => stands,
      onLog: () => {},
      after: (fn) => { fire = fn; return () => {}; },
    });
    await settle();
    fire();
    release();
    expect(await first).toEqual({ session: true, waits: null });
    expect(floors).toEqual([]);
  });

  test("F6: a floor that refuses while the pūlama stays silent ends the first stand", async () => {
    const v = vessel("silent", { floorRefuses: true });
    const first = v.first();
    await settle();
    v.fire();
    await expect(first).rejects.toThrow("the floor refused");
    expect(v.composed).toEqual(["floor-refused"]);
  });

  test("F7: a recompose that throws under the dial leaves nothing standing, so the floor composes", async () => {
    const v = vessel("session", { throws: true });
    const by = await v.first();
    expect(by.session).toBe(false);
    expect(v.composed).toEqual(["sovereign-threw", "floor"]);
    expect(v.standing()).toBe("herm");
  });

  test("WELD: main stands a pūlama's vessel through the first stand, its floor asked on the one recomposition chain", () => {
    const source = readFileSync(join(import.meta.dirname, "..", "src", "main.ts"), "utf8");
    expect(source).toContain("await standFirstByPulama({");
    expect(source).toContain("floor: () => recompose(false),");
    expect(source).toContain("asked: () => composeAsks > 0,");
    // The vessel that names no pūlama composes its floor first, as it always did.
    expect(source).toContain("composition = (await composeOrFloor(null)).stood;");
  });
});
