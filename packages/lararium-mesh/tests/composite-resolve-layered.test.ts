/**
 * resolveLayered: the composition's record for a title, a tombstone included, with the bag and heads it was
 * read at. A tombstone in a higher layer shadows a live record below; with no shadow the lower record answers;
 * a headed layer answers with the heads its record was read at.
 */
import { describe, expect, test, vi } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { CompositeStore } from "../src/composite-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import type { ChangeOrigin, LarTiddlerRecord, LarTiddlerStore } from "../src/tiddler-store.js";

const LOW = "lar:///ha.ka.ba/bags/canon";
const HIGH = "lar:///ha.ka.ba/bags/working";
const origin: ChangeOrigin = { kind: "canon-hydrate", receipt: "test" };

describe("CompositeStore.resolveLayered", () => {
  test("an upper layer that holds no entry costs one map lookup: no heads read, no view", async () => {
    const repo = new Repo({ network: [] });
    const composite = new CompositeStore();
    const handles = Array.from({ length: 5 }, () => repo.create<LarDoc>(emptyLarDoc()));
    const layers = handles.map((handle, i) => new AutomergeDocStore(handle, `layer-${i}`));
    layers.forEach((store, i) => composite.addLayer({ bagId: `layer-${i}`, store, writable: i === 4, defaultWritable: i === 4 }));
    await layers[0]!.put({ tiddler: { title: "held-below", text: "lower" } }, origin);
    const views = handles.map((handle) => vi.spyOn(handle, "view"));
    const headsNow = layers.map((store) => vi.spyOn(store, "headsNow"));
    const getAt = layers.map((store) => vi.spyOn(store, "getAt"));
    const resolved = await composite.resolveLayered("held-below");
    expect(resolved).toMatchObject({ bagId: "layer-0" });
    expect(resolved?.record.tiddler.text).toBe("lower");
    expect(views.map((spy) => spy.mock.calls.length)).toEqual([0, 0, 0, 0, 0]);
    expect(headsNow.map((spy) => spy.mock.calls.length)).toEqual([0, 0, 0, 0, 0]);
    expect(getAt.map((spy) => spy.mock.calls.length)).toEqual([0, 0, 0, 0, 0]);
    // An empty layer answers absence alone; the layer that holds the record answers its heads with it.
    expect(layers.slice(1).map((store) => store.readNow("held-below"))).toEqual([{ record: null }, { record: null }, { record: null }, { record: null }]);
    headsNow[0]!.mockRestore();
    expect(resolved?.heads).toEqual(layers[0]!.headsNow());
    await repo.shutdown();
  });

  test("the composition answers the state that stands at the call, and an upper record or tombstone takes precedence with its own heads", async () => {
    const repo = new Repo({ network: [] });
    const composite = new CompositeStore();
    const layers = Array.from({ length: 5 }, (_, i) => new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), `layer-${i}`));
    layers.forEach((store, i) => composite.addLayer({ bagId: `layer-${i}`, store, writable: i === 4, defaultWritable: i === 4 }));
    await layers[0]!.put({ tiddler: { title: "snapshot", text: "lower" } }, origin);
    // The answer is computed before the call's first await: a write that follows in the same turn is not in it.
    const pending = composite.resolveLayered("snapshot");
    const written = layers[4]!.put({ tiddler: { title: "snapshot", text: "upper" } }, origin);
    expect((await pending)?.record.tiddler.text).toBe("lower");
    await written;
    const live = await composite.resolveLayered("snapshot");
    expect(live).toMatchObject({ bagId: "layer-4", heads: layers[4]!.headsNow() });
    expect(live?.record.tiddler.text).toBe("upper");
    await layers[4]!.tombstone("snapshot", origin);
    const tombstone = await composite.resolveLayered("snapshot");
    expect(tombstone?.bagId).toBe("layer-4");
    expect(tombstone?.record.meta?.deleted).toBe(true);
    expect(tombstone?.heads).toEqual(layers[4]!.headsNow());
    await repo.shutdown();
  });

  test("a higher tombstone answers over a live lower record, with the heads it was read at; without it the lower record answers; an unheld title answers null", async () => {
    const repo = new Repo({ network: [] });
    const composite = new CompositeStore();
    const low = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), LOW);
    const high = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), HIGH);
    composite.addLayer({ bagId: LOW, store: low, writable: false });
    composite.addLayer({ bagId: HIGH, store: high, writable: true });
    await low.put({ tiddler: { title: "shadowed", text: "canon" } }, origin);
    await low.put({ tiddler: { title: "plain", text: "canon" } }, origin);
    await high.tombstone("shadowed", origin);

    const shadowed = await composite.resolveLayered("shadowed");
    expect(shadowed?.bagId).toBe(HIGH);
    expect(shadowed?.record.meta?.deleted).toBe(true);
    expect(shadowed?.heads).toEqual(high.headsNow());
    const plain = await composite.resolveLayered("plain");
    expect(plain?.bagId).toBe(LOW);
    expect(plain?.record.tiddler.text).toBe("canon");
    expect(plain?.heads).toEqual(low.headsNow());
    expect(await composite.resolveLayered("nothing")).toBeNull();
    await repo.shutdown();
  });

  test("no layer read waits on another: a record that lands in a lower layer right after the call stays out of the answer", async () => {
    const repo = new Repo({ network: [] });
    const composite = new CompositeStore();
    const lowHandle = repo.create<LarDoc>(emptyLarDoc());
    const highHandle = repo.create<LarDoc>(emptyLarDoc());
    composite.addLayer({ bagId: LOW, store: new AutomergeDocStore(lowHandle, LOW), writable: true, defaultWritable: false });
    composite.addLayer({ bagId: HIGH, store: new AutomergeDocStore(highHandle, HIGH), writable: true });
    // The walk reads top-down. A wait between its layer reads would let this lower-layer record, written in
    // the same turn as the call, reach the answer; the composition's state at the call holds no record.
    const asked = composite.resolveLayered("lands-below-after-the-call");
    lowHandle.change((doc) => { doc.tiddlers["lands-below-after-the-call"] = { tiddler: { title: "lands-below-after-the-call", text: "late" } }; });
    expect(await asked, "the answer reads the state that stood at the call").toBeNull();
    // CONTROL: a call made after the write answers the record.
    expect((await composite.resolveLayered("lands-below-after-the-call"))?.record.tiddler.text).toBe("late");
    await repo.shutdown();
  });

  test("a generic layer without readNow resolves through its awaited get", async () => {
    const record: LarTiddlerRecord = { tiddler: { title: "generic", text: "generic value" } };
    const store: LarTiddlerStore = {
      listVisible: async () => ["generic"],
      get: async () => record,
      put: async () => {},
      tombstone: async () => {},
      remove: async () => {},
      subscribe: () => () => {},
    };
    const composite = new CompositeStore();
    composite.addLayer({ bagId: "generic", store, writable: true });
    expect(await composite.resolveLayered("generic")).toMatchObject({ bagId: "generic", record });
  });
});
