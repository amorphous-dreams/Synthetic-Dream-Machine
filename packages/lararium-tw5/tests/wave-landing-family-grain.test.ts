/**
 * THE LANDING QUEUE NEVER CUTS A FAMILY.
 *
 * `WaveLanding.enqueueFamily` queues the envelopes of whole store changes as one grain. A slice gathers
 * whole families up to the quota and hands the host a turn only between slices; a family larger than the
 * quota lands whole in a slice of its own.
 *
 * Control: the same envelopes queued one by one (each a family of one) cut at the quota.
 */
import { describe, expect, test } from "vitest";
import type { LarTiddlerChange } from "@lararium/mesh";
import { WaveLanding } from "../src/wave-landing.js";

const change = (title: string): LarTiddlerChange => ({ title, record: { tiddler: { title, text: title } }, origin: { kind: "crdt-remote", edgeIsland: "peer" } });
const family = (root: string, size: number): LarTiddlerChange[] => Array.from({ length: size }, (_, i) => change(i === 0 ? root : `${root}#/c${i}`));

/** Land everything; answer the titles landed between each pair of host turns. */
async function slicesOf(feed: (landing: WaveLanding) => void): Promise<string[][]> {
  const slices: string[][] = [[]];
  const landing = new WaveLanding(
    async (c) => { slices.at(-1)!.push(c.title); },
    async () => { if (slices.at(-1)!.length > 0) slices.push([]); await new Promise<void>((resolve) => setImmediate(resolve)); },
  );
  feed(landing);
  await landing.idle();
  return slices.filter((s) => s.length > 0);
}

describe("the landing queue never cuts a family", () => {
  test("families that fit the quota together share a slice; the next family opens the next slice whole", async () => {
    const a = family("lar:///t/grain/a", 150), b = family("lar:///t/grain/b", 40), c = family("lar:///t/grain/c", 30);
    const slices = await slicesOf((landing) => { landing.enqueueFamily(a); landing.enqueueFamily(b); landing.enqueueFamily(c); });
    expect(slices.map((s) => s.length)).toEqual([190, 30]);
    expect(slices[0]).toEqual([...a, ...b].map((x) => x.title));
    expect(slices[1]).toEqual(c.map((x) => x.title));
  });

  test("a family larger than the quota lands whole in one slice", async () => {
    const big = family("lar:///t/grain/big", WaveLanding.QUOTA + 50);
    const after = family("lar:///t/grain/after", 3);
    const slices = await slicesOf((landing) => { landing.enqueueFamily(big); landing.enqueueFamily(after); });
    expect(slices.map((s) => s.length)).toEqual([WaveLanding.QUOTA + 50, 3]);
  });

  test("CONTROL: the same envelopes as families of one cut at the quota", async () => {
    const big = family("lar:///t/grain/loose", WaveLanding.QUOTA + 50);
    const slices = await slicesOf((landing) => { for (const c of big) landing.enqueue(c); });
    expect(slices.map((s) => s.length)).toEqual([WaveLanding.QUOTA, 50]);
    expect(await slicesOf((landing) => { landing.enqueueFamily([]); })).toEqual([]);
  });
});
