/**
 * `remove` READS BACK. A person answers a pending removal with `lares shore remove`; the projector hands the
 * carrier to the wiki shore's own delete door (`removeCarrier`). The door's word proves nothing by itself:
 * a tombstone the store refused, or a bag beneath that still answers, leaves the carrier in the wiki's
 * resolved view. So the answer reads the view back, through the reconcile, and names a carrier the view
 * still holds as left, still pending.
 *
 * The real projector runs over a scratch mirror and a stub wiki.
 * Control: a door that does remove the carrier answers it done, and it pends no more.
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree } from "../src/synced-tree.js";
import { answerShore } from "../src/shore-verb.js";
import type { TW5Engine } from "@lararium/tw5";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lares";
const URI = "lar:///ha.ka.ba/probe/remove-reads-back";

/** A projector over one pending carrier, with a delete door that removes the carrier from the view or not. */
async function stand(door: "removes" | "refused" | "beneath") {
  root = mkdtempSync(join(tmpdir(), "lar-remove-back-"));
  const live = new Map([[URI, BAG]]);
  const asked: string[] = [];
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot: root }],
    carrierFileFn: async () => ({ ext: MEME_EXT, body: `title: ${URI}\n\nTHE RECORDS\n`, encoding: "utf8" }),
    syncedTree: new SyncedTree(join(root, ".projection", "synced-tree")),
    // The door answers either way; only the view says whether the carrier left.
    // "beneath": the tombstone lands, and a bag beneath answers the carrier now.
    removeCarrier: (uri) => { asked.push(uri); if (door === "removes") live.delete(uri); if (door === "beneath") live.set(uri, "a-bag-beneath"); },
  });
  projector.start({ $tw: { wiki: {
    getTiddler: (title: string) => (live.has(title) ? { fields: { title, "$origin-bag": live.get(title) } } : undefined),
    allTitles: () => [...live.keys()],
    addEventListener: () => {}, removeEventListener: () => {},
  } } } as unknown as TW5Engine);
  await projector.idle();
  const file = join(root, `${URI.slice("lar:///".length)}${MEME_EXT}`);
  rmSync(file);
  expect((await answerShore(projector, { op: "list" }))["pendingCount"]).toBe(1);
  return { projector, asked, file };
}

describe("remove reads back that the carrier left the wiki's resolved view", () => {
  test("a door that answers yet leaves the carrier in the view: the answer names it left, and it stays pending", async () => {
    const s = await stand("refused");
    expect(await answerShore(s.projector, { op: "remove", uris: [URI] })).toMatchObject({ ok: true, done: [], doneCount: 0, left: [URI], leftCount: 1 });
    expect(s.asked).toEqual([URI]);
    expect(s.projector.pendingRemovals().map((p) => p.uri)).toEqual([URI]);
    expect(existsSync(s.file)).toBe(false);
  });

  test("CONTROL: a door that removes the carrier: the answer names it done, and nothing pends", async () => {
    const s = await stand("removes");
    expect(await answerShore(s.projector, { op: "remove", uris: [URI] })).toMatchObject({ ok: true, done: [URI], left: [] });
    expect(s.projector.pendingRemovals()).toEqual([]);
    expect(existsSync(s.file)).toBe(false);
  });

  test("a carrier the view now resolves from a bag beneath leaves this bag's pending set: this mirror projects it no more", async () => {
    const s = await stand("beneath");
    expect(await answerShore(s.projector, { op: "remove", uris: [URI] })).toMatchObject({ ok: true, done: [URI], left: [] });
    expect(s.projector.pendingRemovals()).toEqual([]);
  });
});
