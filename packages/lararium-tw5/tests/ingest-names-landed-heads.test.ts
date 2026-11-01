/**
 * THE INGEST VERB NAMES THE HEADS IT LANDED, AND THE SHORE FOLLOWS THEM (road row G36).
 *
 * An `ingest` row carries the causal heads of the target bag's document after the carrier's records landed
 * (`heads`), where the store keeps history. The wiki's shore keeps the heads of the last change it landed per
 * bag, and answers `landedCovers(bag, heads)`: true once every named change sits in the causal past of what it
 * landed. The settle word reads both: the island names the heads, the shore says when the view holds them.
 *
 * Red first: with no `heads` on the row and no `landedCovers`, a settle word can follow nothing but the hash.
 * Controls: a store with no history names none; a bag the shore landed nothing of covers nothing; heads of a
 * write the shore has not landed yet cover nothing.
 */
import { describe, expect, test, vi } from "vitest";
import { AutomergeDocStore, CompositeStore, emptyLarDoc, type Verb } from "@lararium/mesh";
import { makeActionReactorFor } from "../src/action-handler.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { Repo, shoreRig, turns, workingBag, personalBag, remote } from "./wiki-shore-rig.js";

const URI = "lar:///t.ingest.heads/one";
const BAG = "lar:///ha.ka.ba/bags/ingest-heads";
const meme = (prose: string): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
  "```toml meta\nuri-path = \"t.ingest.heads/one\"\n```\n\n" +
  `${prose}\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

async function ingest(composite: CompositeStore, text: string): Promise<Array<Record<string, unknown>>> {
  const invocation = { requestId: "ingest-heads", title: "ingest", action: "INGEST", args: {}, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "2026-10-25" } as unknown as Verb;
  const ctx = { daemon: composite, invocation, cap: async () => ({ ok: true }) } as unknown as VerbContext;
  const result = await makeActionReactorFor("INGEST", { composite })(
    { "source-uri": "file:///staged/one.mem", "to-bag": BAG, "change-id": "chg-heads-1", carriers: [{ uri: URI, text, diskHash: "sha256:00", syncedHash: null }] }, ctx,
  ) as Record<string, unknown>;
  return result["carriers"] as Array<Record<string, unknown>>;
}

describe("the ingest row names the heads it landed", () => {
  test("a CRDT-backed bag: the row names heads the document holds at the carrier's landing, and a second landing moves them", async () => {
    const repo = new Repo({ network: [] });
    const store = new AutomergeDocStore(repo.create(emptyLarDoc()), BAG);
    const composite = new CompositeStore();
    composite.addLayer({ bagId: BAG, store, writable: true, defaultWritable: true });
    const [first] = await ingest(composite, meme("the first prose"));
    expect(first).toMatchObject({ uri: URI, decision: "ingest" });
    // The gesture's residency ledger lands in the same document after the carrier, so the document's heads
    // move past the row's; the row names the change that carried the records, and the document covers it.
    expect(first!["heads"]).toHaveLength(1);
    expect(store.coversHeads([...store.headsNow()!], first!["heads"] as string[])).toBe(true);
    const [second] = await ingest(composite, meme("the second prose"));
    expect(second!["decision"]).toBe("ingest");
    expect(second!["heads"]).not.toEqual(first!["heads"]);
    expect(store.coversHeads(second!["heads"] as string[], first!["heads"] as string[]), "the later landing covers the earlier").toBe(true);
    expect(store.coversHeads(first!["heads"] as string[], second!["heads"] as string[]), "the earlier never covers the later").toBe(false);
    await repo.shutdown();
  });

  test("CONTROL: a store with no causal history names no heads", async () => {
    const composite = new CompositeStore();
    composite.addLayer({ bagId: BAG, store: new MemoryTiddlerStore(), writable: true, defaultWritable: true });
    const [row] = await ingest(composite, meme("the prose"));
    expect(row!["decision"]).toBe("ingest");
    expect(row).not.toHaveProperty("heads");
  });
});

describe("landing stays cheap", () => {
  test("a bulk landing asks the store for no causal comparison: the comparison waits for a settle word's look", async () => {
    // A corpus LOAD lands thousands of changes. A comparison per landing (`getChangesSince` over a growing
    // document) outlasted the LOAD verb's own budget on the shard runners ("wiki:place-verb timeout").
    const r = await shoreRig();
    try {
      const covers = vi.spyOn(r.working, "coversHeads");
      for (let i = 0; i < 40; i++) await r.working.put({ tiddler: { title: `lar:///t.ingest.heads/bulk-${i}`, text: `bulk ${i}` } }, remote);
      await turns(48);
      await r.adaptor.landingIdle();
      expect(r.wiki.getTiddler("lar:///t.ingest.heads/bulk-39"), "the landing ran").toBeDefined();
      expect(covers, "landing asked for no causal comparison").not.toHaveBeenCalled();
      expect(r.adaptor.landedCovers(workingBag, [...r.working.headsNow()!])).toBe(true);
      expect(covers, "the look asks once").toHaveBeenCalledTimes(1);
    } finally { await r.stop(); }
  });
});

describe("the shore answers whether it landed the named heads", () => {
  test("heads of a landed change are covered; heads of a write not yet landed are not; a bag never landed covers nothing", async () => {
    const r = await shoreRig();
    try {
      const title = "lar:///t.ingest.heads/landed";
      await r.working.put({ tiddler: { title, text: "one" } }, remote);
      await turns(24);
      const landedAt = [...r.working.headsNow()!];
      expect(r.adaptor.landedCovers(workingBag, landedAt), "the change the shore landed").toBe(true);
      expect(r.adaptor.landedCovers(personalBag, landedAt), "a bag the shore landed nothing of").toBe(false);
      // A later write: its heads cover the earlier ones, and the shore lands it in its turn.
      const lead = [...r.working.headsNow()!];
      await r.working.put({ tiddler: { title, text: "two" } }, remote);
      const ahead = [...r.working.headsNow()!];
      expect(ahead).not.toEqual(lead);
      await turns(24);
      expect(r.adaptor.landedCovers(workingBag, ahead), "the later change lands in its turn").toBe(true);
      expect(r.adaptor.landedCovers(workingBag, ["f".repeat(64)]), "heads the document never held").toBe(false);
    } finally { await r.stop(); }
  });
});
