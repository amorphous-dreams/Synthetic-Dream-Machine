/**
 * A read at the document's own heads answers from the standing document.
 *
 * `DocHandle.view(heads)` materialises the whole document at those heads, a cost that grows with the
 * document, and the Repo keeps a view only while something references it. The wiki shore reads one record
 * per landed wave at the layer's current heads, and a hand's write names the base it builds on, most often
 * the current heads. Both therefore read the standing document and build no view; a view is built for heads
 * that lie in the document's past, and only there.
 */
import { describe, expect, test, vi } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import type { ChangeOrigin } from "../src/tiddler-store.js";

const BAG = "lar:///ha.ka.ba/bags/reads-standing";
const origin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: "reads-standing" };

async function rig() {
  const repo = new Repo({ network: [] });
  const handle = repo.create<LarDoc>(emptyLarDoc());
  const store = new AutomergeDocStore(handle, BAG);
  const views = vi.spyOn(handle, "view");
  return { repo, handle, store, views };
}

describe("AutomergeDocStore reads the standing document at its own heads", () => {
  test("a bulk landing reads each record at the current heads and builds no view", async () => {
    const r = await rig();
    const read: Array<string | undefined> = [];
    for (let i = 0; i < 60; i++) {
      const title = `lar:///t/reads-standing/${i}`;
      await r.store.put({ tiddler: { title, text: `body ${i}` } }, origin);
      read.push(r.store.getAt(title, r.store.headsNow()!)?.tiddler.text as string | undefined);
    }
    expect(read).toEqual(Array.from({ length: 60 }, (_, i) => `body ${i}`));
    expect(r.views).toHaveBeenCalledTimes(0);
    await r.repo.shutdown();
  });

  test("a write whose base names the current heads builds no view and lands as a plain change", async () => {
    const r = await rig();
    const title = "lar:///t/reads-standing/based";
    await r.store.put({ tiddler: { title, text: "one" } }, origin);
    const base = r.store.headsNow()!;
    await r.store.put({ tiddler: { title, text: "two" } }, origin, { base });
    expect(r.views).toHaveBeenCalledTimes(0);
    expect((await r.store.get(title))?.tiddler.text).toBe("two");
    await r.repo.shutdown();
  });

  test("control: heads in the document's past answer the record as it stood there, through one view", async () => {
    const r = await rig();
    const title = "lar:///t/reads-standing/past";
    await r.store.put({ tiddler: { title, text: "then" } }, origin);
    const past = r.store.headsNow()!;
    await r.store.put({ tiddler: { title, text: "now" } }, origin);
    expect(r.store.getAt(title, past)?.tiddler.text).toBe("then");
    expect(r.views).toHaveBeenCalledTimes(1);
    expect(r.store.getAt(title, r.store.headsNow()!)?.tiddler.text).toBe("now");
    expect(r.views).toHaveBeenCalledTimes(1);
    await r.repo.shutdown();
  });

  test("control: a write based on past heads reads its base through a view and keeps both values as a conflict", async () => {
    const r = await rig();
    const title = "lar:///t/reads-standing/stale-base";
    await r.store.put({ tiddler: { title, text: "base" } }, origin);
    const past = r.store.headsNow()!;
    await r.store.put({ tiddler: { title, text: "theirs" } }, origin);
    await r.store.put({ tiddler: { title, text: "mine" } }, origin, { base: past });
    expect(r.views.mock.calls.length).toBeGreaterThanOrEqual(1);
    const heads = r.store.headsNow()!;
    expect(heads.length).toBe(2);
    await r.repo.shutdown();
  });
});
