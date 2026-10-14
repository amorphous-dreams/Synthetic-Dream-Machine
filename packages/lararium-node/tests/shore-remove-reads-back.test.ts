/**
 * `remove` READS BACK. A person answers a pending removal with `lares shore remove`; the projector hands the
 * carrier to the wiki shore's own delete door (`removeCarrier`). The door's word proves nothing by itself:
 * a tombstone the store refused, or a bag beneath that still answers, leaves the carrier in the wiki's
 * resolved view. So the answer reads the view back, through the reconcile, and names a carrier the view
 * still holds as left, still pending.
 *
 * The real projector runs over a scratch mirror and a stub wiki.
 * Control: a door that does remove the carrier answers it done, and it pends no more.
 *
 * A remove with no wiki view to read back refuses by name and calls no door (F5.1); a carrier a bag beneath now
 * answers leaves this bag's pending set and reads `unshadowed`, naming that bag, since the meme still stands (F5.2).
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
async function stand(door: "removes" | "refused" | "beneath" | "bare") {
  root = mkdtempSync(join(tmpdir(), "lar-remove-back-"));
  const live = new Map([[URI, BAG]]);
  const asked: string[] = [];
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot: root }],
    carrierFileFn: async () => ({ ext: MEME_EXT, body: `title: ${URI}\n\nTHE RECORDS\n`, encoding: "utf8" }),
    syncedTree: new SyncedTree(join(root, ".projection", "synced-tree")),
    // The door answers either way; only the view says whether the carrier left.
    // "beneath": the tombstone lands, and a bag beneath answers the carrier now.
    removeCarrier: (uri) => { asked.push(uri); if (door === "removes") live.delete(uri); if (door === "beneath") live.set(uri, "a-bag-beneath"); if (door === "bare") live.set(uri, null as unknown as string); },
  });
  projector.start({ $tw: { wiki: {
    getTiddler: (title: string) => (live.has(title) ? { fields: { title, ...(live.get(title) !== null ? { "$origin-bag": live.get(title) } : {}) } } : undefined),
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

  test("a carrier the view now resolves from a bag beneath leaves this bag's pending set, and the answer says the meme still stands there", async () => {
    const s = await stand("beneath");
    expect(await answerShore(s.projector, { op: "remove", uris: [URI] })).toMatchObject({
      ok: true, done: [], doneCount: 0, left: [], unshadowed: [{ uri: URI, bag: "a-bag-beneath" }], unshadowedCount: 1,
    });
    expect(s.projector.pendingRemovals()).toEqual([]);
  });

  test("a tiddler the view still shows with no origin has not left it: it stays pending, never done", async () => {
    const s = await stand("bare");
    expect(await answerShore(s.projector, { op: "remove", uris: [URI] })).toMatchObject({ ok: true, done: [], left: [URI] });
    expect(s.projector.pendingRemovals().map((p) => p.uri)).toEqual([URI]);
  });

  test("CONTROL: a carrier that left the view reads done and names nothing unshadowed", async () => {
    const s = await stand("removes");
    const answered = await answerShore(s.projector, { op: "remove", uris: [URI] });
    expect(answered).not.toHaveProperty("unshadowed");
  });

  test("a remove with no wiki view to read back refuses by name, calls no door, and leaves the carrier pending", async () => {
    const s = await stand("removes");
    (s.projector as unknown as { _tw5: unknown })._tw5 = null;
    expect(await answerShore(s.projector, { op: "remove", uris: [URI] })).toMatchObject({ ok: false, refusal: "no-wiki-view" });
    expect(s.asked).toEqual([]);
    expect(s.projector.pendingRemovals().map((p) => p.uri)).toEqual([URI]);
  });
});
