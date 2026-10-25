/**
 * A reader that landed a document's state at some heads asks whether those heads cover the changes a gesture
 * named (the settle word follows landed heads through the wiki's view, road row G36). `coversHeads(have,
 * named)` answers true where the named changes sit in the causal past of `have`.
 *
 * Red first: a store with no `coversHeads` cannot answer. Controls: the same heads cover themselves, a later
 * state covers an earlier one, an earlier state never covers a later one, heads the document never saw never
 * cover.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import type { ChangeOrigin } from "../src/tiddler-store.js";

const origin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: "covers-heads" };

describe("AutomergeDocStore.coversHeads", () => {
  test("heads cover their own past and never their future", async () => {
    const repo = new Repo({ network: [] });
    const store = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), "lar:///ha.ka.ba/bags/covers-heads");
    const title = "lar:///t/covers-heads/one";
    await store.put({ tiddler: { title, text: "one" } }, origin);
    const first = store.headsNow()!;
    await store.put({ tiddler: { title, text: "two" } }, origin);
    const second = store.headsNow()!;
    expect(store.coversHeads(first, first)).toBe(true);
    expect(store.coversHeads(second, first), "a later state covers an earlier one").toBe(true);
    expect(store.coversHeads(first, second), "an earlier state never covers a later one").toBe(false);
    expect(store.coversHeads(second, ["f".repeat(64)]), "heads the document never saw cover nothing").toBe(false);
    expect(store.coversHeads(["f".repeat(64)], first), "a state the document never held covers nothing").toBe(false);
    expect(store.holdsHeads(second), "the replica holds the heads it wrote").toBe(true);
    expect(store.holdsHeads(["f".repeat(64)]), "and not heads it never saw").toBe(false);
    await repo.shutdown();
  });
});
