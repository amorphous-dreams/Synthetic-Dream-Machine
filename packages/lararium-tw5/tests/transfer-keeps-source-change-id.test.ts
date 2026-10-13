/**
 * A TRANSFER KEEPS THE SOURCE RECORD'S CHANGE-ID.
 *
 * A record's `changeId` names a title's lineage: "same change, different bag". ADD, COPY and a live MOVE
 * carry the source record's id onto the destination record; the gesture's own id rides the receipt and the
 * effect record, where the act itself gets named. A source that carries no id takes the gesture's.
 *
 * Control: the gesture's id stands in the effect record of the destination bag, and never on the record.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "./wiki-shore-rig.js";
import { AutomergeDocStore, CompositeStore, emptyLarDoc, isEffectRecordUri, type Verb } from "@lararium/mesh";
import { makeActionReactorFor } from "../src/action-handler.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const A = "lar:///test/change-id/a";
const B = "lar:///test/change-id/b";
const hand = { kind: "tw-local", instanceId: "test" } as const;

async function rig() {
  const repo = new Repo({ network: [] });
  const stores = new Map<string, AutomergeDocStore>();
  const composite = new CompositeStore();
  for (const bag of [A, B]) {
    const store = new AutomergeDocStore(repo.create(emptyLarDoc()), bag);
    stores.set(bag, store);
    composite.addLayer({ bagId: bag, store, writable: true, defaultWritable: bag === A });
  }
  const run = async (verb: "ADD" | "COPY" | "MOVE", title: string, gesture: string) => {
    const invocation = { requestId: `req-${gesture}`, title: verb, action: verb, args: {}, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "2026-10-12" } as unknown as Verb;
    const ctx = { daemon: composite, invocation, cap: async () => ({ ok: true }) } as unknown as VerbContext;
    return makeActionReactorFor(verb, { composite })({ title, "from-bag": A, "to-bag": B, "change-id": gesture }, ctx);
  };
  const effects = async (bag: string): Promise<Array<Record<string, unknown>>> => {
    const store = stores.get(bag)!;
    const out: Array<Record<string, unknown>> = [];
    for (const title of await store.listVisible()) if (isEffectRecordUri(title)) out.push((await store.get(title))!.tiddler as Record<string, unknown>);
    return out;
  };
  return { repo, stores, run, effects };
}

describe("a transfer keeps the source record's change-id", () => {
  for (const verb of ["ADD", "COPY", "MOVE"] as const) {
    test(`${verb} lands the source's id on the destination and names the gesture in the effect record`, async () => {
      const r = await rig();
      try {
        await r.stores.get(A)!.put({ tiddler: { title: "T", text: "body" }, meta: { changeId: "lineage-of-T" } }, hand);
        const receipt = await r.run(verb, "T", `gesture-${verb}`);
        const landed = await r.stores.get(B)!.get("T");
        expect(landed?.tiddler.text).toBe("body");
        expect(landed?.meta?.changeId, "the record keeps its lineage").toBe("lineage-of-T");
        expect(receipt["changeId"], "the receipt names the gesture").toBe(`gesture-${verb}`);
        const effect = (await r.effects(B)).find((e) => JSON.stringify(e).includes(`gesture-${verb}`));
        expect(effect, "CONTROL: the destination's effect record names the gesture").toBeDefined();
      } finally { await r.repo.shutdown(); }
    });
  }

  test("a source that carries no id takes the gesture's", async () => {
    const r = await rig();
    try {
      await r.stores.get(A)!.put({ tiddler: { title: "U", text: "body" } }, hand);
      await r.run("COPY", "U", "gesture-first");
      expect((await r.stores.get(B)!.get("U"))?.meta?.changeId).toBe("gesture-first");
    } finally { await r.repo.shutdown(); }
  });
});
