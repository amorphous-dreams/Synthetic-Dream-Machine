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
});
