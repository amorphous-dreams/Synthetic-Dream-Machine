/**
 * The cascade probe — the composite store names the layer a title came from.
 *
 * `resolveTopmost` answers the winning (bagId, record); `resolveAll` answers every live manifestation,
 * highest layer first, so the entry beneath the winner reads as the shadowed record. A "local draft over
 * shared" shadow renders its diff from the pair, and a lift names its source bag from `bagId`.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage#/the-recipe
 */
import { describe, test, expect } from "vitest";
import { CompositeStore } from "../src/composite-store.js";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import type { ChangeOrigin } from "../src/tiddler-store.js";

const origin: ChangeOrigin = { kind: "canon-hydrate", receipt: "system" };
const rec = (title: string, text: string) => ({ tiddler: { title, text } });
const TOP = "lar:///ha.ka.ba/wikis/daemon/working";
const SHARED = "lar:///ha.ka.ba/bags/kahua";
const CANON = "lar:///ha.ka.ba/bags/lares";

async function stack() {
  const composite = new CompositeStore();
  const canon = new MemoryTiddlerStore();
  const shared = new MemoryTiddlerStore();
  const top = new MemoryTiddlerStore();
  composite.addLayer({ bagId: CANON, store: canon, writable: false });
  composite.addLayer({ bagId: SHARED, store: shared, writable: false });
  composite.addLayer({ bagId: TOP, store: top, writable: true, defaultWritable: true });
  await canon.put(rec("Floor", "canon"), origin);
  await canon.put(rec("Both", "canon-both"), origin);
  await shared.put(rec("Both", "shared-both"), origin);
  await shared.put(rec("Item", "shared-item"), origin);
  await top.put(rec("Item", "draft-item"), origin);
  return composite;
}

describe("the cascade names the layer a title came from", () => {
  test("resolveTopmost names the winning bag with its record", async () => {
    const c = await stack();
    expect(await c.resolveTopmost("Floor")).toMatchObject({ bagId: CANON, record: { tiddler: { text: "canon" } } });
    expect(await c.resolveTopmost("Both")).toMatchObject({ bagId: SHARED });
    expect(await c.resolveTopmost("Item")).toMatchObject({ bagId: TOP });
  });

  test("resolveAll names the draft and the item it covers, highest layer first", async () => {
    const c = await stack();
    const all = await c.resolveAll("Item");
    expect(all.map((e) => e.bagId)).toEqual([TOP, SHARED]);
    expect(all[0]!.record.tiddler.text).toBe("draft-item");
    expect(all[1]!.record.tiddler.text).toBe("shared-item");
    expect(await c.listBagsHolding("Both")).toEqual([SHARED, CANON]);
  });

  test("CONTROL: a title one layer holds names that layer alone and shadows nothing", async () => {
    const c = await stack();
    expect((await c.resolveAll("Floor")).map((e) => e.bagId)).toEqual([CANON]);
    expect(await c.resolveTopmost("Absent")).toBeNull();
  });
});
