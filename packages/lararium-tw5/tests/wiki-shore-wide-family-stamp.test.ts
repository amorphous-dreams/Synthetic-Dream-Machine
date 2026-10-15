/**
 * A WIDE REMOTE FAMILY LANDS STAMPED.
 *
 * A store change that touches many titles once rode a bulk path that enqueued each title with no bag, so
 * the wiki held those tiddlers with no `$origin-bag` stamp and the landed ledger with no bag. Every
 * envelope now carries its bag and heads, whatever the family's width (`automerge-doc-store` builds each,
 * `island-adaptor` lands each through `_landOne`). This vector pins that: one peer change of fourteen
 * titles, merged from another Repo, lands every title stamped with the bag it came from.
 *
 * Control: a narrow family of two lands stamped the same way, so the width alone decides nothing.
 */
import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";
import { AutomergeDocStore, type LarDoc, type LarTiddlerRecord } from "@lararium/mesh";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { arrived, ManualTimers, Repo, shoreRig, workingBag, type Rig } from "./wiki-shore-rig.js";

const automerge = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge") as {
  save(doc: unknown): Uint8Array;
};

/** One peer change carrying `count` titles, merged into the shore's handle for `bag`. */
async function peerFamily(r: Rig, bag: string, prefix: string, count: number): Promise<string[]> {
  const peerRepo = new Repo({ network: [] });
  const peerHandle = peerRepo.import<LarDoc>(automerge.save(r.handles[bag]!.doc()));
  const peer = new AutomergeDocStore(peerHandle, bag);
  const records: LarTiddlerRecord[] = Array.from({ length: count }, (_, i) => ({ tiddler: { title: `${prefix}/${i}`, text: `member ${i}` } }));
  await peer.writeFamily(records, [], { kind: "crdt-remote", edgeIsland: `peer-of-${r.instanceId}` });
  const before = r.arrivals.length;
  r.handles[bag]!.merge(peerHandle);
  const titles = records.map((record) => record.tiddler.title as string);
  await arrived(r, before, titles);
  await r.adaptor.landingIdle();
  await peerRepo.shutdown();
  return titles;
}

describe.skipIf(wikiSkip)(`a wide remote family lands stamped${skipNote}`, () => {
  test("one peer change of fourteen titles lands every title with its bag stamp — CONTROL: a family of two", async () => {
    const r = await shoreRig({ timers: new ManualTimers() });
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();

    const wide = await peerFamily(r, workingBag, "lar:///t/wide", 14);
    expect(wide.length).toBeGreaterThanOrEqual(10);
    for (const title of wide) {
      expect(r.wiki.getTiddler(title)?.fields.text, `${title} landed`).toBe(`member ${title.split("/").pop()}`);
      expect(r.wiki.getTiddler(title)?.fields["$origin-bag"], `${title} carries its bag stamp`).toBe(workingBag);
    }

    const narrow = await peerFamily(r, workingBag, "lar:///t/narrow", 2);
    for (const title of narrow) expect(r.wiki.getTiddler(title)?.fields["$origin-bag"]).toBe(workingBag);
    await r.stop();
  }, 120_000);
});
