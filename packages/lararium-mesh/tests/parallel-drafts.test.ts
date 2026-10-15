/**
 * TALK-STORY CONFLICT SURFACING — a concurrent edit SURFACES as attributed parallel drafts.
 *
 * `put` merges a record field by field, so two actors who set one field concurrently resolve by
 * Automerge's deterministic last-writer-wins. The CRDT may pick which value READS live; it must never
 * let the other value vanish. The store reads `getConflicts` on every field a record merge assigns and
 * answers each concurrent value as a TW5 draft (`Draft of '<title>' by <who>`, `draft.of`), attributed
 * to the actor that wrote it — the live value stays live, the losers stay reachable, nothing decides.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import type { DocHandle } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import type { ChangeOrigin, LarTiddlerRecord } from "../src/tiddler-store.js";
import { draftsOffLive, type ParallelDraftsChange } from "../src/parallel-drafts.js";

const TITLE = "lar:///t/story";
const origin: ChangeOrigin = { kind: "tw-local", instanceId: "test" };

const rec = (text: string, modifier: string, modified = "20261005000000000"): LarTiddlerRecord =>
  ({ tiddler: { title: TITLE, text, modifier, modified } });

/** Two peers on one history: B is a clone of A, so each writes under its own actor. */
function twoPeers(): { a: AutomergeDocStore; b: AutomergeDocStore; ha: DocHandle<LarDoc>; hb: DocHandle<LarDoc> } {
  const repo = new Repo({ network: [] });
  const ha = repo.create<LarDoc>(emptyLarDoc());
  const hb = repo.clone(ha);
  return { a: new AutomergeDocStore(ha, "bag-a"), b: new AutomergeDocStore(hb, "bag-a"), ha, hb };
}

describe("★ a concurrent edit surfaces as attributed parallel drafts ★", () => {
  test("two actors set one field concurrently: after the merge BOTH values stay reachable, attributed", async () => {
    const { a, b, ha, hb } = twoPeers();
    await a.put(rec("base", "Root"), origin);
    hb.merge(ha);

    const seen: ParallelDraftsChange[] = [];
    a.onParallelDrafts((c) => seen.push(c));

    await a.put(rec("from Alice", "Alice", "20261005000000001"), origin);
    await b.put(rec("from Bob", "Bob", "20261005000000002"), origin);
    ha.merge(hb);

    const live = (await a.get(TITLE))!.tiddler.text;
    expect(["from Alice", "from Bob"]).toContain(live);

    const drafts = a.parallelDrafts(TITLE);
    expect(drafts.map((d) => d.tiddler.title).sort()).toEqual([
      `Draft of '${TITLE}' by Alice`,
      `Draft of '${TITLE}' by Bob`,
    ]);
    const byWho = Object.fromEntries(drafts.map((d) => [String(d.tiddler.modifier), d.tiddler]));
    expect(byWho["Alice"]!.text).toBe("from Alice");
    expect(byWho["Bob"]!.text).toBe("from Bob");
    for (const d of drafts) {
      expect(d.tiddler["draft.of"]).toBe(TITLE);
      expect(d.tiddler["draft.title"]).toBe(TITLE);
      expect(String(d.tiddler["lar-conflict-actor"])).toMatch(/^[0-9a-f]+$/);
      expect(String(d.tiddler["lar-conflict-fields"]).split(" ")).toEqual(expect.arrayContaining(["text", "modifier"]));
    }
    // Exactly one draft's `text` reads live; the other is the loser, kept. (Each key resolves on its
    // own, so `lar-conflict-live` names the fields per draft rather than one winner per record.)
    const liveFieldsOf = (d: LarTiddlerRecord) => String(d.tiddler["lar-conflict-live"]).split(" ");
    expect(drafts.filter((d) => liveFieldsOf(d).includes("text")).map((d) => d.tiddler.text)).toEqual([live]);
    expect(drafts[0]!.tiddler["lar-conflict-actor"]).not.toBe(drafts[1]!.tiddler["lar-conflict-actor"]);

    // The merge raised the surface once, naming this bag and title.
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.at(-1)!.title).toBe(TITLE);
    expect(seen.at(-1)!.bag).toBe("bag-a");
    expect(seen.at(-1)!.drafts).toHaveLength(2);
  });

  test("a concurrent CREATE of one title surfaces both whole records as drafts", async () => {
    const { a, b, ha, hb } = twoPeers();
    await a.put(rec("Alice's first", "Alice"), origin);
    await b.put(rec("Bob's first", "Bob"), origin);
    ha.merge(hb);
    const drafts = a.parallelDrafts(TITLE);
    expect(drafts.map((d) => d.tiddler.text).sort()).toEqual(["Alice's first", "Bob's first"]);
    expect(drafts.every((d) => String(d.tiddler["lar-conflict-fields"]) === "*")).toBe(true);
  });

  test("the live writer re-saving its own value does not erase the loser", async () => {
    const { a, b, ha, hb } = twoPeers();
    await a.put(rec("base", "Root"), origin);
    hb.merge(ha);
    await a.put(rec("from Alice", "Alice", "20261005000000001"), origin);
    await b.put(rec("from Bob", "Bob", "20261005000000002"), origin);
    ha.merge(hb);
    const live = (await a.get(TITLE))!.tiddler;

    // A save that moves only `modified` re-sends every other field unchanged.
    await a.put({ tiddler: { ...live, modified: "20261005000000009" } }, origin);
    const texts = a.parallelDrafts(TITLE).map((d) => d.tiddler.text).sort();
    expect(texts).toEqual(["from Alice", "from Bob"]);
  });

  test("CONTROL — a non-concurrent overwrite surfaces no draft", async () => {
    const { a, b, ha, hb } = twoPeers();
    await a.put(rec("base", "Root"), origin);
    hb.merge(ha);
    const seen: ParallelDraftsChange[] = [];
    a.onParallelDrafts((c) => seen.push(c));

    await a.put(rec("from Alice", "Alice", "20261005000000001"), origin);
    hb.merge(ha);                       // Bob sees Alice's edit first …
    await b.put(rec("from Bob", "Bob", "20261005000000002"), origin);
    ha.merge(hb);                       // … so his overwrite follows it causally.

    expect((await a.get(TITLE))!.tiddler.text).toBe("from Bob");
    expect(a.parallelDrafts(TITLE)).toEqual([]);
    expect(seen).toEqual([]);
  });

  test("a projection that reads drafts hears the store's surfacing through `addProjection`; `draftsOffLive` keeps only the loser", async () => {
    const { a, b, ha, hb } = twoPeers();
    await a.put(rec("base", "Root"), origin);
    hb.merge(ha);
    const heard: ParallelDraftsChange[] = [];
    const off = a.addProjection({ onUriChanged: () => {}, onParallelDrafts: (c: ParallelDraftsChange) => { heard.push(c); } } as never);

    await a.put(rec("from Alice", "Alice", "20261005000000001"), origin);
    await b.put(rec("from Bob", "Bob", "20261005000000002"), origin);
    ha.merge(hb);
    expect(heard.length).toBeGreaterThan(0);
    const live = (await a.get(TITLE))!.tiddler;
    const kept = draftsOffLive(heard.at(-1)!.drafts);
    // The `text` loser is always kept; last-writer-wins resolves each key on its own, so in a mosaic
    // the other actor's draft carries an off-live value too — and every kept draft carries one.
    expect(kept.map((d) => d.tiddler.text)).toContain(live.text === "from Alice" ? "from Bob" : "from Alice");
    for (const d of kept) {
      const fields = String(d.tiddler["lar-conflict-fields"]).split(" ");
      expect(fields.some((f) => d.tiddler[f] !== live[f])).toBe(true);
    }
    const dropped = heard.at(-1)!.drafts.filter((d) => !kept.includes(d));
    for (const d of dropped) {
      for (const f of String(d.tiddler["lar-conflict-fields"]).split(" ")) expect(d.tiddler[f]).toBe(live[f]);
    }

    // The unsubscribe the projection holds silences its draft hearing too.
    off();
    const before = heard.length;
    await a.put(rec("Alice again", "Alice", "20261005000000003"), origin);
    await b.put(rec("Bob again", "Bob", "20261005000000004"), origin);
    ha.merge(hb);
    expect(heard.length).toBe(before);
  });

  test("CONTROL — a plain projection (no draft reader) registers exactly as before", async () => {
    const { a } = twoPeers();
    const seen: string[] = [];
    const off = a.addProjection({ onUriChanged: (c) => { seen.push(c.title); } });
    await a.put(rec("base", "Root"), origin);
    expect(seen).toContain(TITLE);
    off();
  });
});
