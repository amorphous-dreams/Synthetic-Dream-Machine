/**
 * A SLICE LANDS IN ONE WIKI TICK.
 *
 * The shore lands a slice of changes by preparing every change first (the composition read awaits) and then applying them
 * all in one synchronous run, so TiddlyWiki coalesces the slice into ONE `change` dispatch. Each dispatch re-runs the
 * wiki's trackers, which rebuild the tag index the adds just cleared; a dispatch per tiddler costs O(N²) across a bulk
 * feed (the browser vessel's boot: ~5,800 tiddlers per worker). The composition read here takes a real host turn, as a
 * worker's store does, so a landing that applied between reads would dispatch once per tiddler.
 *
 * A hand typed while the slice prepares still leaves ahead of the wave: the apply reads the hand afresh, never the
 * standing value the prepare saw.
 *
 * Real TiddlyWiki, real Automerge layers, a real `CompositeStore`.
 */
import { describe, expect, test, vi } from "vitest";
import type { LarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import { shoreRig, workingBag, remote, turns, arrived, storeText, type Rig } from "./wiki-shore-rig.js";
import { wikiSkip, skipNote } from "./test-wiki.js";

/** Every composition read takes a host turn before it answers (TiddlyWiki's node `nextTick` runs inside that turn). */
function slowReads(r: Rig, during?: (title: string) => void): void {
  const resolve = r.composite.resolveLayered.bind(r.composite);
  vi.spyOn(r.composite, "resolveLayered").mockImplementation(async (title) => {
    const answer = await resolve(title);
    during?.(title);
    await new Promise<void>((done) => setImmediate(done));
    return answer;
  });
}

/** Count the wiki's `change` dispatches that name any of `titles`. */
function dispatchesOf(r: Rig, titles: readonly string[]): () => number {
  const watched = new Set(titles);
  let count = 0;
  r.wiki.addEventListener("change", (changes) => {
    if (Object.keys(changes as Record<string, unknown>).some((title) => watched.has(title))) count++;
  });
  return () => count;
}

/** The provider's gate flushes a redelivery by its max wait (120 ms); the margin covers a loaded host. */
const REDELIVERY_SETTLES_MS = 400;

const records = (prefix: string, n: number): LarTiddlerRecord[] =>
  Array.from({ length: n }, (_, i) => ({ tiddler: { title: `${prefix}/${i}`, text: `body ${i}`, tags: "SliceTag" } }));

describe.skipIf(wikiSkip)(`a slice lands in one wiki tick${skipNote}`, () => {
  test("a family of 150 changes lands every record in ONE change dispatch, though each composition read takes a host turn", async () => {
    const r = await shoreRig();
    await r.adaptor.armSeedCheckpoint();
    slowReads(r);
    const family = records("lar:///t/slice-one-tick", 150);
    const titles = family.map((record) => record.tiddler.title);
    const seen = dispatchesOf(r, titles);
    const slices: number[] = [];
    r.adaptor.onSliceLanded((rows) => { slices.push(rows); });
    const before = r.arrivals.length;
    await r.working.writeFamily(family, [], remote, { bag: workingBag });
    await arrived(r, before, titles);
    // The store fires the family at once, then its own change event re-delivers it through the provider's gate (40 ms
    // debounce, 120 ms max wait). Wait the gate out so both arrivals stand before anything counts, under load or idle.
    await new Promise<void>((done) => setTimeout(done, REDELIVERY_SETTLES_MS));
    await r.adaptor.landingIdle();
    await turns(2);
    expect(titles.filter((title) => r.wiki.getTiddler(title)?.fields.text === undefined), "every record lands").toEqual([]);
    expect(titles.map((title) => r.adaptor.ledger.landedOf(title)?.bag), "the ledger names each record's layer").toEqual(titles.map(() => workingBag));
    expect(r.wiki.filterTiddlers("[tag[SliceTag]]"), "the tag index answers the whole slice").toHaveLength(150);
    // Every slice carries the whole family (a slice never cuts it): the fired family, and its redelivery when that rides a
    // slice of its own. The redelivery carries the values already standing, so it applies nothing and dispatches nothing.
    expect(slices.length, "the family rides a slice, its redelivery at most one more").toBeGreaterThanOrEqual(1);
    expect(slices.length, "the family rides a slice, its redelivery at most one more").toBeLessThanOrEqual(2);
    expect(slices, "a slice never cuts the family").toEqual(slices.map(() => 150));
    // ONE dispatch lands the 150, never one per tiddler (150 before the cure).
    expect(seen(), "one dispatch for the family, never one per tiddler").toBe(1);
    expect(r.adaptor.pendingTitles(), "a landed wave leaves no hand owed").toEqual([]);
    await r.stop();
  }, 120_000);

  test("a hand typed while the slice prepares survives the wave and leaves for the store; the rest of the slice lands", async () => {
    const r = await shoreRig();
    const x = "lar:///t/slice-one-tick/hand";
    await r.working.put({ tiddler: { title: x, text: "landed" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    expect(r.wiki.getTiddler(x)?.fields.text).toBe("landed");
    const rest = records("lar:///t/slice-one-tick/rest", 40);
    const last = rest.at(-1)!.tiddler.title;
    let typed = false;
    const after: unknown[] = [];
    r.wiki.addEventListener("change", (changes) => {
      if (typed && x in (changes as Record<string, unknown>)) after.push(r.wiki.getTiddler(x)?.fields.text);
    });
    // X prepares first; the hand arrives while the LAST change of the slice prepares, long after X's composition read.
    slowReads(r, (title) => {
      if (title !== last || typed) return;
      typed = true;
      r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(x)!.fields, { text: "typed" }));
    });
    const family = [{ tiddler: { title: x, text: "wave" } }, ...rest];
    const titles = family.map((record) => record.tiddler.title);
    const before = r.arrivals.length;
    await r.working.writeFamily(family, [], remote, { bag: workingBag });
    await arrived(r, before, titles);
    await r.adaptor.landingIdle();
    await r.adaptor.handsRested();
    expect(typed, "the hand arrived mid-prepare").toBe(true);
    expect(r.wiki.getTiddler(x)?.fields.text, "the stale prepared wave never lands over the hand").toBe("typed");
    expect(storeText(r, workingBag, x), "the hand left for the store").toBe("typed");
    expect(after.filter((text) => text !== "typed"), "no dispatch after the hand ever showed the wave over it").toEqual([]);
    expect(rest.filter((record) => r.wiki.getTiddler(record.tiddler.title)?.fields.text !== record.tiddler.text), "the rest of the slice lands").toEqual([]);
    await r.stop();
  }, 120_000);
});
