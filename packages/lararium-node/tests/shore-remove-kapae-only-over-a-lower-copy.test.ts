/**
 * `lares shore remove` RETRACTS TO ABSENT; ONLY A LOWER COPY RAISES A KĀPAE (lar:///ha.ka.ba/lares/api/pono/kapae#/disk-sense).
 *
 * The operator's report: removing a pending carrier whose canon file a commit burned raised a kāpae over a title no other
 * layer held, and its shadow file landed in the WORKBENCH's mirror (`wikis/lares/…/active-wiki.kapae`) for a record of a
 * canon bag. The remove rode the browser's delete, which tombstones a canon-landed title in the working layer above it.
 *
 * The real projector stands over three mirrored layers of one composition, bottom to top: a lower canon bag, the bag
 * whose mirror lost its file, and the working layer. The shore's remove door rides as the island wires it
 * (`shore-remove-door.ts`); the stub wiki reads the composition's live view.
 *
 *   · with no lower copy: the record leaves its own bag, no tombstone rises, and no `.kapae` lands anywhere;
 *   · with a lower copy: the remove refuses `remove-raises-kapae` naming that layer and runs nothing, the pending row
 *     names it, and under the person's approval the kāpae rises in the record's OWN bag, its shadow in that bag's
 *     own mirror, never the working layer's.
 */
import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import type { ChangeOrigin } from "@lararium/mesh/tiddler-store";
import type { TW5Engine } from "@lararium/tw5";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree } from "../src/synced-tree.js";
import { answerShore } from "../src/shore-verb.js";
import { layersBeneathOf, removeInOwnLayer } from "../src/shore-remove-door.js";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const LOW = "lar:///ha.ka.ba/bags/lares";
const OWN = "lar:///ha.ka.ba/bags/lararium";
const WORKING = "lar:///ha.ka.ba/wikis/lares/working";
const URI = "lar:///ha.ka.ba/lararium/tw5/active-wiki";
const REL = URI.slice("lar:///".length);
const origin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: OWN };

/** One pending carrier of OWN; `lower` puts a copy of its title in the canon bag beneath. */
async function stand(lower: boolean) {
  root = mkdtempSync(join(tmpdir(), "lar-shore-remove-kapae-"));
  const dirs = { low: join(root, "bags", "lares"), own: join(root, "bags", "lararium"), working: join(root, "wikis", "lares") };
  const stores = { low: new MemoryTiddlerStore(LOW), own: new MemoryTiddlerStore(OWN), working: new MemoryTiddlerStore(WORKING) };
  const composite = new CompositeStore();
  composite.addLayer({ bagId: LOW, store: stores.low, writable: false });
  composite.addLayer({ bagId: OWN, store: stores.own, writable: false });
  composite.addLayer({ bagId: WORKING, store: stores.working, writable: true });
  await stores.own.put({ tiddler: { title: URI, text: "own copy" } }, origin);
  if (lower) await stores.low.put({ tiddler: { title: URI, text: "lower copy" } }, origin);
  // THE VIEW: the composition's live answer, stamped with the bag that answers it.
  const view = new Map<string, string>([[URI, OWN]]);
  const syncView = async (uri: string): Promise<void> => {
    const live = await composite.getLive(uri);
    const holding = live === null ? [] : await composite.listBagsHolding(uri);
    if (holding.length === 0) view.delete(uri); else view.set(uri, holding[0]!);
  };
  const door = removeInOwnLayer(composite, { kind: "lares-verb", requestId: "shore-remove-probe" });
  const asked: Array<{ uri: string; bagId: string }> = [];
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: LOW, mirrorRoot: dirs.low }, { bagId: OWN, mirrorRoot: dirs.own }, { bagId: WORKING, mirrorRoot: dirs.working }],
    carrierFileFn: async (uri) => (view.has(uri) ? { ext: MEME_EXT, body: `title: ${uri}\n\nTHE RECORDS\n`, encoding: "utf8" } : null),
    syncedTree: new SyncedTree(join(root, ".projection", "synced-tree")),
    recoveryStore: (bagId) => composite.storeForBag(bagId),
    bagsHolding: (uri) => composite.listBagsHolding(uri),
    topRecordFn: (uri) => composite.get(uri),
    layersBeneath: layersBeneathOf(composite),
    removeCarrier: async (uri, bagId) => { asked.push({ uri, bagId }); await door(uri, bagId); await syncView(uri); },
  });
  projector.start({ $tw: { wiki: {
    getTiddler: (title: string) => (view.has(title) ? { fields: { title, "$origin-bag": view.get(title) } } : undefined),
    allTitles: () => [...view.keys()],
    addEventListener: () => {}, removeEventListener: () => {},
  } } } as unknown as TW5Engine);
  await projector.idle();
  const file = join(dirs.own, `${REL}${MEME_EXT}`);
  expect(existsSync(file)).toBe(true);
  // A COMMIT BURNS THE CANON FILE: the record stays in its bag, and the carrier pends.
  rmSync(file);
  expect((await answerShore(projector, { op: "list" }))["pendingCount"]).toBe(1);
  const settle = async (): Promise<void> => { await (projector as unknown as { reconcile(t: string): Promise<void> }).reconcile(URI); await projector.idle(); };
  const shadowIn = (dir: string): string => join(dir, `${REL}.kapae`);
  return { projector, stores, dirs, asked, settle, shadowIn };
}

describe("a shore remove retracts to absent, and raises a kāpae only over a lower copy", () => {
  test("★ no lower copy: the record leaves its own bag, no tombstone rises, and no shadow file lands in any mirror ★", async () => {
    const s = await stand(false);
    const listed = await answerShore(s.projector, { op: "list" });
    expect((listed["pending"] as Array<Record<string, unknown>>)[0]).not.toHaveProperty("beneath");

    const answer = await answerShore(s.projector, { op: "remove", uris: [URI] });
    expect(answer).toMatchObject({ ok: true, done: [URI], left: [] });
    expect(answer).not.toHaveProperty("raised");
    expect(s.asked).toEqual([{ uri: URI, bagId: OWN }]);
    await s.settle();

    expect(await s.stores.own.get(URI), "the record retracts to absent: no tombstone stands in its bag").toBeNull();
    expect(await s.stores.working.get(URI), "nothing lands in the working layer").toBeNull();
    for (const dir of Object.values(s.dirs)) expect(existsSync(s.shadowIn(dir)), `no shadow under ${dir}`).toBe(false);
    expect(s.projector.pendingRemovals()).toEqual([]);
  });

  test("★ a lower copy: the remove refuses by name, names the layer, and runs nothing until the person approves ★", async () => {
    const s = await stand(true);
    const listed = await answerShore(s.projector, { op: "list" });
    expect((listed["pending"] as Array<Record<string, unknown>>)[0]).toMatchObject({ uri: URI, bagId: OWN, beneath: [LOW] });

    const refused = await answerShore(s.projector, { op: "remove", uris: [URI] });
    expect(refused).toMatchObject({ ok: false, refusal: "remove-raises-kapae", raising: [{ uri: URI, beneath: [LOW] }] });
    expect(String(refused["why"])).toContain(`a lower layer (${LOW}) holds ${URI}`);
    expect(s.asked, "no door opens without the approval").toEqual([]);
    expect((await s.stores.own.get(URI))?.tiddler.text).toBe("own copy");
    expect(s.projector.pendingRemovals().map((p) => p.uri)).toEqual([URI]);
  });

  test("★ approved over a lower copy: the kāpae rises in the record's own bag, and its shadow sits in that bag's own mirror ★", async () => {
    const s = await stand(true);
    const answer = await answerShore(s.projector, { op: "remove", uris: [URI], kapae: true });
    expect(answer).toMatchObject({ ok: true, done: [URI], raised: [{ uri: URI, beneath: [LOW] }], raisedCount: 1 });
    await s.settle();

    expect((await s.stores.own.get(URI))?.meta?.deleted, "the kāpae stands in the record's own bag").toBe(true);
    expect(await s.stores.working.get(URI), "the working layer takes no tombstone").toBeNull();
    expect((await s.stores.low.get(URI))?.tiddler.text, "the lower copy stays in its bag, shadowed").toBe("lower copy");
    expect(JSON.parse(readFileSync(s.shadowIn(s.dirs.own), "utf8"))).toEqual({ title: URI, kapae: "raised" });
    expect(existsSync(s.shadowIn(s.dirs.working)), "no shadow in the workbench mirror").toBe(false);
    expect(existsSync(s.shadowIn(s.dirs.low))).toBe(false);
  });
});
