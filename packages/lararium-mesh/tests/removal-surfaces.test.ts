/**
 * A REMOVAL COUNTS AS A CHANGE.
 *
 * A hand's write that drops a field removes that field at the hand's base. Where a concurrent writer set
 * the same field after that base, Automerge keeps the set and records no conflict: the removal would
 * vanish without a word. The store keeps Automerge's merge live and SURFACES the hand's record, without
 * the field, as a parallel draft; nothing arbitrates.
 *
 * Controls: a removal no concurrent writer touched lands clean, and a removal both sides made lands clean.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { draftsOffLive, type ParallelDraftsChange } from "../src/parallel-drafts.js";
import type { ChangeOrigin } from "../src/tiddler-store.js";

const TITLE = "lar:///t/removal/field";
const hand: ChangeOrigin = { kind: "tw-local", instanceId: "hand-shore" };
const peer: ChangeOrigin = { kind: "crdt-remote", edgeIsland: "peer" };

function stage(): { store: AutomergeDocStore; seen: ParallelDraftsChange[] } {
  const repo = new Repo({ network: [] });
  const store = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), "bag-removal");
  const seen: ParallelDraftsChange[] = [];
  store.onParallelDrafts((change) => seen.push(change));
  return { store, seen };
}

describe("a removal against a concurrent edit surfaces", () => {
  test("the hand removes a field a concurrent writer set: the set stays live and the hand's record surfaces as a draft", async () => {
    const { store, seen } = stage();
    await store.put({ tiddler: { title: TITLE, text: "body", caption: "base caption", modifier: "Freyja" } }, peer);
    const base = store.headsNow()!;
    await store.put({ tiddler: { title: TITLE, text: "body", caption: "edited caption", modifier: "Referee" } }, peer);

    await store.put({ tiddler: { title: TITLE, text: "body", modifier: "Freyja" } }, hand, { base });

    const live = (await store.get(TITLE))!.tiddler;
    expect(live["caption"], "Automerge's merge stays live: the concurrent set stands").toBe("edited caption");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.title).toBe(TITLE);
    expect(seen[0]!.bag).toBe("bag-removal");
    const [draft] = seen[0]!.drafts;
    expect(seen[0]!.drafts).toHaveLength(1);
    expect(draft!.tiddler["draft.of"]).toBe(TITLE);
    expect(draft!.tiddler["draft.title"]).toBe(TITLE);
    expect(draft!.tiddler.title).toBe(`Draft of '${TITLE}' by Freyja`);
    expect(draft!.tiddler.text).toBe("body");
    expect("caption" in draft!.tiddler, "the hand's record stands without the field").toBe(false);
    expect(draft!.tiddler["lar-conflict-fields"]).toBe("caption");
    expect(draft!.tiddler["lar-conflict-removed"]).toBe("caption");
    expect(draft!.tiddler["lar-conflict-live"]).toBe("");
    expect(draftsOffLive(seen[0]!.drafts), "a reader keeps it: it carries a state the live record does not").toHaveLength(1);
  });

  test("the draft reaches its reader, and the reader settles, BEFORE the hand's change lands", async () => {
    const repo = new Repo({ network: [] });
    const store = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), "bag-removal");
    await store.put({ tiddler: { title: TITLE, text: "body", caption: "base caption" } }, peer);
    const base = store.headsNow()!;
    await store.put({ tiddler: { title: TITLE, text: "body", caption: "edited caption" } }, peer);
    const order: string[] = [];
    store.onParallelDrafts(async (change) => {
      // A reader that persists the draft takes host turns to do it; the store's write waits for it.
      await new Promise<void>((resolve) => setImmediate(resolve));
      order.push(`draft kept while the record reads "${String((await store.get(change.title))!.tiddler.text)}"`);
    });
    await store.put({ tiddler: { title: TITLE, text: "hand body" } }, hand, { base });
    order.push(`write returned with the record reading "${String((await store.get(TITLE))!.tiddler.text)}"`);
    // A vessel that stops between the two keeps the draft, which holds the hand's whole record.
    expect(order).toEqual([`draft kept while the record reads "body"`, `write returned with the record reading "hand body"`]);
  });

  test("CONTROL: a removal no concurrent writer touched lands clean", async () => {
    const { store, seen } = stage();
    await store.put({ tiddler: { title: TITLE, text: "body", caption: "base caption" } }, peer);
    const base = store.headsNow()!;
    // A concurrent edit of ANOTHER field: the removal still lands, and nothing surfaces.
    await store.put({ tiddler: { title: TITLE, text: "peer body", caption: "base caption" } }, peer);
    await store.put({ tiddler: { title: TITLE, text: "body" } }, hand, { base });
    const live = (await store.get(TITLE))!.tiddler;
    expect("caption" in live).toBe(false);
    expect(live.text).toBe("peer body");
    expect(seen).toEqual([]);
  });

  test("CONTROL: a removal both sides made lands clean", async () => {
    const { store, seen } = stage();
    await store.put({ tiddler: { title: TITLE, text: "body", caption: "base caption" } }, peer);
    const base = store.headsNow()!;
    await store.put({ tiddler: { title: TITLE, text: "body" } }, peer);
    await store.put({ tiddler: { title: TITLE, text: "hand body" } }, hand, { base });
    const live = (await store.get(TITLE))!.tiddler;
    expect("caption" in live).toBe(false);
    expect(seen).toEqual([]);
  });

  test("CONTROL: an unbased removal at the current heads lands clean", async () => {
    const { store, seen } = stage();
    await store.put({ tiddler: { title: TITLE, text: "body", caption: "base caption" } }, peer);
    await store.put({ tiddler: { title: TITLE, text: "body" } }, hand);
    expect("caption" in (await store.get(TITLE))!.tiddler).toBe(false);
    expect(seen).toEqual([]);
  });
});
