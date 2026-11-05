/**
 * An act's receipt hold waits for the act's own writes to REST, never for a whole-drain target the Drain displaced. Three acts land
 * while the first target's receipt hangs: the whole-drain target the second act's dispatch asked for reads `superseded` (the Drain keeps
 * the oldest and the newest), and the hold must ask again, not release with an empty bag list — an empty list releases the receipt
 * capability at once, and the act's `applied` result would cross before its target rests.
 */
import { describe, expect, test } from "vitest";
import { type LarTiddlerRecord } from "@lararium/mesh";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { afterDispatch, arrived, ManualBoundary, openDraft, remote, saveSequence, shoreRig, turns, type Rig } from "./wiki-shore-rig.js";

const seedRecords = async (r: Rig, records: readonly Record<string, unknown>[]): Promise<void> => {
  const before = r.arrivals.length;
  for (const tiddler of records) await r.working.put({ tiddler } as LarTiddlerRecord, remote);
  await arrived(r, before, records.map((tiddler) => String(tiddler["title"])));
};

describe.skipIf(wikiSkip)(`an act's receipt hold under a displaced whole-drain target${skipNote}`, () => {
  test("RED: no hold releases EMPTY while its act's target stays owed — CONTROL: the first hold stays held, and after the receipt returns every hold names its bag", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const targets = [1, 2, 3].map((i) => `lar:///t/hold/displaced-${i}`);
    await seedRecords(r, targets.map((title) => ({ title, text: "landed" })));
    await r.adaptor.armSeedCheckpoint();
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const dones: Array<{ n: number; slots: readonly string[] | null }> = [];
    let begins = 0;
    r.adaptor.caps.receipt = {
      begin: () => { const me = ++begins; return { done: (slots: readonly string[] | null) => { dones.push({ n: me, slots }); } }; },
      held: () => null, idle: async () => {}, answer: () => false, stalledAsks: () => 0, close: () => {},
      ack: async () => { await held; },
    } as never;
    for (const [i, target] of targets.entries()) {
      const draft = openDraft(r, target, `v${i}`);
      await afterDispatch();
      saveSequence(r, draft);
      await afterDispatch();
      await turns(8);
    }
    const drain = (r.adaptor as unknown as { drain: { owes(t: string): boolean } }).drain;
    expect(begins, "control: three acts began a hold each").toBe(3);
    expect(targets.map((t) => drain.owes(t)), "control: every target still owes under the hung receipt").toEqual([true, true, true]);
    expect(dones, "no hold releases while its target is owed (an empty list would release the receipt at once)").toEqual([]);
    release();
    boundary.fire();
    await turns(96);
    expect(dones.map((d) => d.n).sort(), "every hold released once the receipts returned").toEqual([1, 2, 3]);
    for (const d of dones) expect(d.slots, `hold ${d.n} names the bag its act wrote`).not.toEqual([]);
    await r.stop();
  }, 60_000);
});
