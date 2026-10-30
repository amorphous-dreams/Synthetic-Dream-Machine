/**
 * move-promotes-the-layer — A TITLE-LESS MOVE PROMOTES THE WHOLE WORKING LAYER INTO CANON (walk W3, ruled by Lares
 * 2026-10-29 from W27: "a write lands on a working layer, and canon takes it by promotion", and the `load-into-canon`
 * refusal, which names exactly `MOVE --from wikis/<slug>/working --to bags/<slug>` with no title).
 *
 * A titled MOVE carries one family (the root, `root#…`, `root/…`). A seed that LOADs a holding onto a wiki's working
 * layer cannot name what landed: the island's answer rides bounded past the outcome cap, and a memetic carrier's
 * record takes its name from its head, never its path (measured on the fresh-root walk). So the promotion is ONE act:
 * a MOVE naming the two bags and no title moves every live title the working layer holds, lands each in canon first,
 * then retracts each from the layer (the same land-then-remove order a titled MOVE keeps), and answers how many moved.
 *
 *   L1  RED: a MOVE with `from-bag`, `to-bag` and no `title` moves every live title (four, across three families)
 *       into canon and leaves the layer holding none; the answer names the layer and the count.
 *   L2  a dry run of the layer MOVE projects every title and commits nothing.
 *   L3  a layer MOVE onto its own bag refuses by name; an empty layer answers zero and moves nothing.
 *   L4  CONTROL: a titled MOVE moves one family alone and the other families stay on the layer.
 *   L5  a write that lands on the layer after its record's landing stays there (the next promotion carries it), however
 *       the writes interleave: the layer's record leaves only while it still holds the fields that landed.
 *   L6  a delete that lands after the landing stands on the layer; the MOVE removes no tombstone.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "./wiki-shore-rig.js";
import { AutomergeDocStore, CompositeStore, emptyLarDoc, type Verb } from "@lararium/mesh";
import { makeActionReactorFor } from "../src/action-handler.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const canonBag = "lar:///ha.ka.ba/bags/probe";
const workingBag = "lar:///ha.ka.ba/wikis/probe/working";
const live = (title: string) => ({ tiddler: { title, text: `text of ${title}` }, meta: { changeId: `change:${title}` } });
const hand = { kind: "tw-local", instanceId: "test" } as const;
const TWO = "lar:///ha.ka.ba/other/two";
const FAMILIES = ["lar:///ha.ka.ba/bags/probe", "lar:///ha.ka.ba/bags/probe#/$postamble", "lar:///ha.ka.ba/probe/docs/one", "lar:///ha.ka.ba/other/two"];

async function rig(titles: readonly string[] = FAMILIES) {
  const repo = new Repo({ network: [] });
  const stores = new Map<string, AutomergeDocStore>();
  const composite = new CompositeStore();
  for (const bag of [canonBag, workingBag]) {
    const store = new AutomergeDocStore(repo.create(emptyLarDoc()), bag);
    stores.set(bag, store);
    composite.addLayer({ bagId: bag, store, writable: true, defaultWritable: bag === workingBag });
  }
  for (const t of titles) await stores.get(workingBag)!.put(live(t), hand);
  const reactor = makeActionReactorFor("MOVE", { composite });
  const run = async (args: Record<string, unknown>) => {
    const invocation = { requestId: "move-request", title: "move", action: "MOVE", args: {}, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "2026-10-29" } as unknown as Verb;
    const ctx = { daemon: composite, invocation, cap: async () => ({ ok: true }) } as unknown as VerbContext;
    return reactor({ "from-bag": workingBag, "to-bag": canonBag, "change-id": "promote", ...args }, ctx);
  };
  const holds = async (bag: string): Promise<string[]> => {
    const out: string[] = [];
    for (const t of titles) if ((await stores.get(bag)!.get(t)) !== null) out.push(t);
    return out;
  };
  return { stores, composite, run, holds };
}

describe("a title-less MOVE promotes the whole working layer", () => {
  test("L1 — every live title moves into canon in one act, and the layer holds none after", async () => {
    const r = await rig();
    const result = await r.run({});
    expect(result).toMatchObject({ verb: "MOVE", fromBag: workingBag, toBag: canonBag, moved: 4 });
    expect(result).not.toHaveProperty("title");
    expect(await r.holds(canonBag)).toEqual(FAMILIES);
    expect(await r.holds(workingBag)).toEqual([]);
    for (const t of FAMILIES) {
      expect(await r.stores.get(canonBag)!.get(t)).toMatchObject({ tiddler: { text: `text of ${t}` }, meta: { changeId: `change:${t}` } });
      expect(await r.composite.resolveLayered(t)).toMatchObject({ bagId: canonBag });
    }
  });

  test("L2 — a dry run projects every title and commits nothing", async () => {
    const r = await rig();
    const preview = await r.run({ "dry-run": true }) as { dryRun: boolean; wouldLand: string[] };
    expect(preview.dryRun).toBe(true);
    // The projection names every title and the two residency ledger rows (one per bag) the act would write.
    expect([...preview.wouldLand].filter((t) => !/\/ledger\/residency\//.test(t)).sort()).toEqual([...FAMILIES].sort());
    expect(await r.holds(canonBag)).toEqual([]);
    expect(await r.holds(workingBag)).toEqual(FAMILIES);
  });

  test("L3 — a layer MOVE onto its own bag refuses by name; an empty layer answers zero", async () => {
    const r = await rig();
    await expect(r.run({ "to-bag": workingBag })).rejects.toThrow(/--from and --to both name .*a move needs two bags/);
    expect(await r.holds(workingBag)).toEqual(FAMILIES);
    const empty = await rig([]);
    expect(await empty.run({})).toMatchObject({ moved: 0 });
  });

  /** THE INTERLEAVED WRITER: each time the layer MOVE lands "two" in canon (up to `times`), another hand writes onto the working layer. */
  const interleave = (r: Awaited<ReturnType<typeof rig>>, write: (n: number) => Promise<void>, times: number) => {
    const target = r.stores.get(canonBag)!;
    const put = target.put.bind(target);
    let n = 0;
    (target as unknown as { put: typeof put }).put = async (record, origin) => {
      await put(record, origin);
      if (n < times && record.tiddler.title === TWO) await write(++n);
    };
    return () => n;
  };

  test("L5 — a write that lands on the layer after its record's landing is never lost: the newest resolves on top", async () => {
    const r = await rig();
    const source = r.stores.get(workingBag)!;
    let newest = "";
    const writes = interleave(r, async (n) => {
      newest = `text of two, write ${n}`;
      await source.put({ tiddler: { title: TWO, text: newest }, meta: { changeId: `change:two-${n}` } }, hand);
    }, 2);
    const result = await r.run({});
    expect(writes()).toBeGreaterThanOrEqual(1);
    expect((await r.composite.resolveLayered(TWO))?.record.tiddler.text, "the newest write resolves").toBe(newest);
    expect((await source.get(TWO))?.tiddler.text, "the layer keeps the record that moved since its landing").toBe(newest);
    expect(result).toMatchObject({ moved: 3, kept: 1 });
    expect(await r.holds(canonBag)).toEqual(FAMILIES);
  });

  test("L6 — a delete that lands on the layer after its record's landing stands: the MOVE never removes the tombstone", async () => {
    const r = await rig();
    const source = r.stores.get(workingBag)!;
    interleave(r, async () => { await source.tombstone(TWO, hand); }, 1);
    const result = await r.run({});
    expect((await source.get(TWO))?.meta?.deleted, "the tombstone stands on the layer").toBe(true);
    expect(result).toMatchObject({ moved: 3, kept: 1 });
  });

  test("L4 — CONTROL: a titled MOVE moves one family alone; the other families stay on the layer", async () => {
    const r = await rig();
    const result = await r.run({ title: "lar:///ha.ka.ba/bags/probe" });
    expect(result).toMatchObject({ title: "lar:///ha.ka.ba/bags/probe", moved: 2 });
    expect(await r.holds(canonBag)).toEqual(["lar:///ha.ka.ba/bags/probe", "lar:///ha.ka.ba/bags/probe#/$postamble"]);
    expect(await r.holds(workingBag)).toEqual(["lar:///ha.ka.ba/probe/docs/one", "lar:///ha.ka.ba/other/two"]);
  });
});
