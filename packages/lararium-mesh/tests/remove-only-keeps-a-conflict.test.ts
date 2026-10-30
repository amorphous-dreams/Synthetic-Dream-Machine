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
  test("a title holding a concurrent value stays; CONTROL: the same title with no concurrent value leaves", async () => {
    const repo = new Repo({ network: [] });
    const here = repo.create<LarDoc>(emptyLarDoc());
    const there = repo.clone<LarDoc>(here);
    const store = new AutomergeDocStore(here, "lar:///ha.ka.ba/wikis/probe/working");
    await store.put(rec("v1"), hand);
    await new AutomergeDocStore(there, "lar:///ha.ka.ba/wikis/probe/working").put(rec("v2"), hand);
    here.merge(there);
    const visible = (await store.get(T))!;
    await store.remove(T, hand, { only: visible });
    expect(await store.get(T), "the title holding a concurrent value stays").not.toBeNull();

    // CONTROL: a write settles the conflict; the conditional remove of what is now visible takes the title.
    await store.put(rec("settled"), hand);
    await store.remove(T, hand, { only: (await store.get(T))! });
    expect(await store.get(T)).toBeNull();
  });
});
