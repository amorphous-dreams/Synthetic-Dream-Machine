/**
 * remove-only-keeps-a-conflict — a conditional remove never retracts a value it cannot see.
 *
 * A promotion's retract removes a title only while it still holds the record that landed (`LarRemoveOptions.only`).
 * Automerge keeps every concurrent write of a title: the visible value is one of them, and the rest stand as conflicts
 * the next write settles. A title whose visible fields equal the landed record but which holds a concurrent value
 * stays, so the concurrent value is never removed unlanded; the title leaves at the pass after a write settles it.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/automerge-doc-store
 */
import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";

const T = "lar:///ha.ka.ba/probe/conflicted";
const hand = { kind: "tw-local", instanceId: "test" } as const;
const rec = (text: string) => ({ tiddler: { title: T, text }, meta: {} });

describe("a conditional remove over a conflicted title", () => {
  const twoHands = async () => {
    const repo = new Repo({ network: [] });
    const here = repo.create<LarDoc>(emptyLarDoc());
    const store = new AutomergeDocStore(here, "lar:///ha.ka.ba/wikis/probe/working");
    return { repo, here, store, other: (h: ReturnType<typeof repo.clone<LarDoc>>) => new AutomergeDocStore(h, "lar:///ha.ka.ba/wikis/probe/working") };
  };

  test("a field written concurrently stays; CONTROL: once a write settles the field, the conditional remove takes the title", async () => {
    const { repo, here, store, other } = await twoHands();
    await store.put(rec("v0"), hand);
    const there = repo.clone<LarDoc>(here);
    await store.put(rec("v1"), hand);
    await other(there).put(rec("v2"), hand);
    here.merge(there);
    expect(store.parallelDrafts(T).length, "the merge holds a concurrent value").toBeGreaterThan(0);
    await store.remove(T, hand, { only: (await store.get(T))! });
    expect(await store.get(T), "the title holding a concurrent value stays").not.toBeNull();

    await store.put(rec("settled"), hand);
    expect(store.parallelDrafts(T)).toHaveLength(0);
    await store.remove(T, hand, { only: (await store.get(T))! });
    expect(await store.get(T)).toBeNull();
  });

  test("a title two hands created concurrently stays under a conditional remove", async () => {
    const { repo, here, store, other } = await twoHands();
    const there = repo.clone<LarDoc>(here);
    await store.put(rec("v1"), hand);
    await other(there).put(rec("v2"), hand);
    here.merge(there);
    await store.remove(T, hand, { only: (await store.get(T))! });
    expect(await store.get(T)).not.toBeNull();
  });
});
