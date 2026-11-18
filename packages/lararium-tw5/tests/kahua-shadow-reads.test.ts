/**
 * kahua-shadow-reads — the shadow check spends no stage read it can spare (P5: every landed title re-read the whole stage, three times).
 *
 * A winner at or below the kahua layer casts no shadow, so the check ends before any further read; a winner above it reads the kahua layer
 * ALONE (one `get`), never every layer; and the landing hands over the answer it already resolved, so the check never resolves the title again.
 * Every red pairs with a CONTROL that still stamps a real shadow.
 */
import { describe, expect, test } from "vitest";
import { KAHUA_BAG, type LarTiddlerRecord } from "@lararium/mesh";
import { kahuaShadowOf } from "../src/kahua-shadow.js";

const FLOOR = "floor-bag", WORKING = "working-bag";
const rec = (title: string, text: string): LarTiddlerRecord => ({ tiddler: { title, text } }) as LarTiddlerRecord;

function rig(held: { floor?: string; kahua?: string; working?: string }, title = "T") {
  const calls = { kahuaGets: 0, resolveLayered: 0, resolveAll: 0 };
  const order = [FLOOR, KAHUA_BAG, WORKING];
  const text: Record<string, string | undefined> = { [FLOOR]: held.floor, [KAHUA_BAG]: held.kahua, [WORKING]: held.working };
  const get = (bag: string) => async () => { if (bag === KAHUA_BAG) calls.kahuaGets += 1; return text[bag] === undefined ? null : rec(title, text[bag]!); };
  const store = {
    layerIndexOf: (bag: string) => order.indexOf(bag),
    storeForBag: (bag: string) => (order.includes(bag) ? ({ get: get(bag) } as never) : null),
    resolveLayered: async () => {
      calls.resolveLayered += 1;
      for (let i = order.length - 1; i >= 0; i--) { const t = text[order[i]!]; if (t !== undefined) return { bagId: order[i]!, record: rec(title, t) }; }
      return null;
    },
    resolveAll: async () => { calls.resolveAll += 1; return order.filter((b) => text[b] !== undefined).map((b) => ({ bagId: b, record: rec(title, text[b]!) })).reverse(); },
  };
  return { store, calls };
}

describe("the shadow check reads the stage only where a shadow can stand", () => {
  test("RED: a winner BELOW the kahua layer, handed over already resolved, costs no read at all; CONTROL: nothing is stamped", async () => {
    const { store, calls } = rig({ floor: "floor body" });
    const shadow = await kahuaShadowOf(store as never, "T", { bagId: FLOOR, record: rec("T", "floor body") });
    expect(shadow).toBeNull();
    expect(calls).toEqual({ kahuaGets: 0, resolveLayered: 0, resolveAll: 0 });
  });

  test("RED: a winner ABOVE the kahua layer reads the kahua layer alone, once, never every layer, and never resolves the title again", async () => {
    const { store, calls } = rig({ kahua: "shared body", working: "my local body" });
    const shadow = await kahuaShadowOf(store as never, "T", { bagId: WORKING, record: rec("T", "my local body") });
    expect(shadow).toEqual({ draftBag: WORKING, shared: "shared body" });
    expect(calls).toEqual({ kahuaGets: 1, resolveLayered: 0, resolveAll: 0 });
  });

  test("CONTROL: with no resolved answer handed over the check resolves for itself and reaches the same verdicts (equal bodies cast none)", async () => {
    const same = rig({ kahua: "same", working: "same" });
    expect(await kahuaShadowOf(same.store as never, "T")).toBeNull();
    const differs = rig({ kahua: "shared body", working: "mine" });
    expect(await kahuaShadowOf(differs.store as never, "T")).toEqual({ draftBag: WORKING, shared: "shared body" });
    const none = rig({ working: "mine" });
    expect(await kahuaShadowOf(none.store as never, "T"), "no kahua twin, no shadow").toBeNull();
  });
});
