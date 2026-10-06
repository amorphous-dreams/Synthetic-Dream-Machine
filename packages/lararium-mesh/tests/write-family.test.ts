/**
 * A MEME FAMILY LANDS AS ONE CHANGE — `writeFamily` writes a root, its new children and its orphans'
 * tombstones inside ONE Automerge change, so a peer receives the whole re-split or none of it and
 * never holds a root that points at a child already tombstoned (or a child whose root has not moved).
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { getAllChanges } from "@automerge/automerge";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { CompositeStore } from "../src/composite-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import type { ChangeOrigin, LarTiddlerRecord } from "../src/tiddler-store.js";

const ROOT = "lar:///t/family";
const origin: ChangeOrigin = { kind: "tw-local", instanceId: "test" };
const rec = (title: string, text: string): LarTiddlerRecord => ({ tiddler: { title, text } });

function seeded(): Promise<{ store: AutomergeDocStore; changes: () => number; doc: () => LarDoc }> {
  const repo = new Repo({ network: [] });
  const handle = repo.create<LarDoc>(emptyLarDoc());
  const store = new AutomergeDocStore(handle, "bag-f");
  return (async () => {
    await store.put(rec(ROOT, "<<~ kahea ahu #/old>>"), origin);
    await store.put(rec(`${ROOT}#/old`, "old"), origin);
    return { store, changes: () => getAllChanges(handle.doc()!).length, doc: () => handle.doc()! };
  })();
}

describe("★ a meme family lands as ONE change ★", () => {
  test("root rewrite + new child + orphan tombstone → exactly one Automerge change", async () => {
    const { store, changes, doc } = await seeded();
    const before = changes();

    await store.writeFamily([rec(ROOT, "<<~ kahea ahu #/new>>"), rec(`${ROOT}#/new`, "fresh")], [`${ROOT}#/old`], origin);

    expect(changes() - before).toBe(1);
    expect(doc().tiddlers[ROOT]!.tiddler.text).toBe("<<~ kahea ahu #/new>>");
    expect(doc().tiddlers[`${ROOT}#/new`]!.tiddler.text).toBe("fresh");
    expect(doc().tiddlers[`${ROOT}#/old`]!.meta?.deleted).toBe(true);
  });

  test("every member fans out to projections, as a single put or tombstone would", async () => {
    const { store } = await seeded();
    const seen: string[] = [];
    store.subscribe((c) => seen.push(`${c.record?.meta?.deleted ? "tombstone" : "put"} ${c.title}`));

    await store.writeFamily([rec(ROOT, "<<~ kahea ahu #/new>>"), rec(`${ROOT}#/new`, "fresh")], [`${ROOT}#/old`], origin);

    expect(seen).toEqual([`put ${ROOT}`, `put ${ROOT}#/new`, `tombstone ${ROOT}#/old`]);
  });

  test("CONTROL — a family whose content already stands makes no change at all", async () => {
    const { store, changes } = await seeded();
    const before = changes();
    await store.writeFamily([rec(ROOT, "<<~ kahea ahu #/old>>"), rec(`${ROOT}#/old`, "old")], [], origin);
    expect(changes()).toBe(before);
  });

  test("the composite hands the whole family to the ONE layer `put` would route to", async () => {
    const repo = new Repo({ network: [] });
    const target   = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), "bag-target");
    const fallback = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), "bag-default");
    const composite = new CompositeStore();
    composite.addLayer({ bagId: "bag-target",  store: target,   writable: true, defaultWritable: false });
    composite.addLayer({ bagId: "bag-default", store: fallback, writable: true });

    await composite.writeFamily([rec(ROOT, "r"), rec(`${ROOT}#/a`, "a")], [`${ROOT}#/gone`], origin, { bag: "bag-target" });

    expect((await target.get(`${ROOT}#/a`))?.tiddler.text).toBe("a");
    expect((await target.get(`${ROOT}#/gone`))?.meta?.deleted).toBe(true);
    expect(await fallback.get(ROOT)).toBeNull();
    await expect(composite.writeFamily([rec(ROOT, "r")], [], origin, { bag: "bag-unmounted" })).rejects.toThrow(/no layer/);
  });

  test("CONTROL — a layer store with no writeFamily still receives every member, one write each", async () => {
    const repo = new Repo({ network: [] });
    const layer = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), "bag-plain");
    // The same store with its atomic door hidden — every other member reads through, bound to it.
    const plain = new Proxy(layer, {
      get: (t, k) => {
        if (k === "writeFamily") return undefined;
        const v = Reflect.get(t, k, t) as unknown;
        return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(t) : v;
      },
    });
    const composite = new CompositeStore();
    composite.addLayer({ bagId: "bag-plain", store: plain, writable: true });

    await composite.writeFamily([rec(ROOT, "r"), rec(`${ROOT}#/a`, "a")], [`${ROOT}#/gone`], origin, { bag: "bag-plain" });

    expect((await layer.get(`${ROOT}#/a`))?.tiddler.text).toBe("a");
    expect((await layer.get(`${ROOT}#/gone`))?.meta?.deleted).toBe(true);
  });
});

/**
 * A BAGGED RETRACT IS A RESIDENCY ACTION, never a user edit: `tombstoneInBag` and `removeInBag` reach
 * the bag's own WRITABLE layer or refuse. A read-only layer for the bag never copies the retract up
 * into the default writable (that is `put`'s Law-4 copy-up, a different relation).
 */
describe("a bagged retract lands in the bag's writable layer or nowhere", () => {
  const twoLayers = () => {
    const repo = new Repo({ network: [] });
    const own      = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), "bag-own");
    const library  = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), "bag-library");
    const composite = new CompositeStore();
    composite.addLayer({ bagId: "bag-library", store: library, writable: false });
    composite.addLayer({ bagId: "bag-own",     store: own,     writable: true });
    return { composite, own, library };
  };

  test("tombstoneInBag and removeInBag land in the named writable bag", async () => {
    const { composite, own } = twoLayers();
    await own.put(rec("T", "t"), origin);
    await own.put(rec("U", "u"), origin);
    await composite.tombstoneInBag("bag-own", "T", origin);
    await composite.removeInBag("bag-own", "U", origin);
    expect((await own.get("T"))?.meta?.deleted).toBe(true);
    expect(await own.get("U")).toBeNull();
  });

  test("CONTROL — a read-only or unmounted bag refuses, and the default writable is never touched", async () => {
    const { composite, own } = twoLayers();
    await expect(composite.tombstoneInBag("bag-library", "T", origin)).rejects.toThrow(/no writable layer for bag "bag-library"/);
    await expect(composite.removeInBag("bag-gone", "T", origin)).rejects.toThrow(/no writable layer for bag "bag-gone"/);
    expect(await own.get("T")).toBeNull();
  });
});

describe("a single put or tombstone is a family of one", () => {
  test("put and tombstone each make one change and fire once; a standing put does neither", async () => {
    const { store, changes } = await seeded();
    const seen: string[] = [];
    store.subscribe((c) => seen.push(`${c.record?.meta?.deleted ? "tombstone" : "put"} ${c.title}`));

    let before = changes();
    await store.put(rec(`${ROOT}#/old`, "old"), origin);   // content already stands
    expect(changes()).toBe(before);
    expect(seen).toEqual([]);

    before = changes();
    await store.put(rec(`${ROOT}#/a`, "a"), origin);
    expect(changes() - before).toBe(1);

    before = changes();
    await store.tombstone(`${ROOT}#/old`, origin);
    expect(changes() - before).toBe(1);

    expect(seen).toEqual([`put ${ROOT}#/a`, `tombstone ${ROOT}#/old`]);
  });

  test("CONTROL — remove stays a hard delete: the key is absent and the fire carries no record", async () => {
    const { store, doc } = await seeded();
    const seen: Array<string | null> = [];
    store.subscribe((c) => seen.push(c.record === null ? null : c.title));
    await store.remove(`${ROOT}#/old`, origin);
    expect(doc().tiddlers[`${ROOT}#/old`]).toBeUndefined();
    expect(seen).toEqual([null]);
  });
});
