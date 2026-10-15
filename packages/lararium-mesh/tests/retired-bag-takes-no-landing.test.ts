/**
 * retired-bag-takes-no-landing — a bag DROP retired takes no landing through the composite's write door.
 *
 * The residency verbs refuse a retired destination at the action gate (`action-handler.ts`). A wiki
 * island's save, its delete and the shore's `remove` reach a bag through the composite instead
 * (`CompositeStore.put` · `writeFamily` · `tombstone` · `remove`), and nothing there read the marker DROP
 * leaves. Each of those writes now reads the target layer's own retirement marker first and refuses by
 * name (`VerbRefusal`, `bag-retired`), landing nothing. The bag's own residency ledger stays writable, so
 * the record that retires it can land; a copy-up out of a retired read-only layer lands in the working
 * layer, which never held the marker.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { CompositeStore } from "../src/composite-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { buildEffectRecordTiddler, effectRecordUri, RETIRED_EVENT_ID } from "../src/effect-record.js";
import { isVerbRefusal } from "../src/verb-refusal.js";
import type { ChangeOrigin, LarTiddlerRecord } from "../src/tiddler-store.js";

const BAG = "lar:///ha.ka.ba/bags/retiring";
const OTHER = "lar:///ha.ka.ba/bags/standing";
const origin: ChangeOrigin = { kind: "tw-local", instanceId: "test" };
const rec = (title: string, text: string): LarTiddlerRecord => ({ tiddler: { title, text } });

const marker = (bag: string): LarTiddlerRecord => buildEffectRecordTiddler({
  eventId: RETIRED_EVENT_ID, archivalVerb: "disposition", actionVerb: "DROP", requestId: "req-drop",
  bag, actor: "did:test", timestamp: "0", disposition: "bag-retired",
});

async function stand(retired: boolean) {
  const repo = new Repo({ network: [] });
  const store = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), BAG);
  const other = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), OTHER);
  await store.put(rec("lar:///t/kept", "kept"), origin);
  if (retired) await store.put(marker(BAG), { kind: "lares-verb", requestId: "req-drop" } as ChangeOrigin);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: OTHER, store: other, writable: true, defaultWritable: false });
  composite.addLayer({ bagId: BAG, store, writable: true });
  return { composite, store, other };
}

async function refusal(p: Promise<unknown>): Promise<unknown> {
  try { await p; } catch (err) { return err; }
  return null;
}

describe("★ a retired bag takes no landing through the composite ★", () => {
  test("setup: the marker stands in the retired bag's own doc", async () => {
    const { store } = await stand(true);
    expect((await store.get(effectRecordUri(BAG, RETIRED_EVENT_ID)))?.tiddler["disposition"]).toBe("bag-retired");
  });

  test("RED: a family write naming the retired bag refuses `bag-retired` and lands nothing", async () => {
    const { composite, store } = await stand(true);
    const err = await refusal(composite.writeFamily([rec("lar:///t/new", "new")], ["lar:///t/kept"], origin, { bag: BAG }));
    expect(isVerbRefusal(err)).toBe(true);
    expect((err as { reason: string }).reason).toBe("bag-retired");
    expect(String((err as Error).message)).toContain(BAG);
    expect(await store.get("lar:///t/new")).toBeNull();
    expect((await store.get("lar:///t/kept"))?.meta?.deleted).toBeFalsy();
  });

  test("RED: a bagless save, delete and remove into a retired working layer refuse, and land nothing", async () => {
    const { composite, store } = await stand(true);
    for (const write of [
      composite.put(rec("lar:///t/new", "new"), origin),
      composite.tombstone("lar:///t/kept", origin),
      composite.remove("lar:///t/kept", origin),
    ]) {
      const err = await refusal(write);
      expect(isVerbRefusal(err) && (err as { reason: string }).reason).toBe("bag-retired");
    }
    expect(await store.get("lar:///t/new")).toBeNull();
    expect((await store.get("lar:///t/kept"))?.meta?.deleted).toBeFalsy();
  });

  test("CONTROL: the same writes into a bag no DROP retired land", async () => {
    const { composite, store } = await stand(false);
    await composite.writeFamily([rec("lar:///t/new", "new")], [], origin, { bag: BAG });
    await composite.tombstone("lar:///t/kept", origin);
    expect((await store.get("lar:///t/new"))?.tiddler["text"]).toBe("new");
    expect((await store.get("lar:///t/kept"))?.meta?.deleted).toBe(true);
  });

  test("CONTROL: another bag beside a retired one takes its write; the retired bag's own ledger still takes a record", async () => {
    const { composite, other, store } = await stand(true);
    await composite.writeFamily([rec("lar:///t/beside", "beside")], [], origin, { bag: OTHER });
    expect((await other.get("lar:///t/beside"))?.tiddler["text"]).toBe("beside");
    const second = buildEffectRecordTiddler({
      eventId: "evt-2", archivalVerb: "disposition", actionVerb: "DROP", requestId: "req-2",
      bag: BAG, actor: "did:test", timestamp: "0", disposition: "bag-retired",
    });
    await composite.put(second, origin, { bag: BAG });
    expect((await store.get(effectRecordUri(BAG, "evt-2")))?.tiddler["request-id"]).toBe("req-2");
  });

  test("RED (review): nothing through the door lifts a retirement, and no nested title rides as a ledger record", async () => {
    const { composite, store } = await stand(true);
    const markerTitle = effectRecordUri(BAG, RETIRED_EVENT_ID);
    for (const write of [
      composite.removeInBag(BAG, markerTitle, origin),
      composite.tombstoneInBag(BAG, markerTitle, origin),
      composite.writeFamily([], [markerTitle], origin, { bag: BAG }),
      composite.put({ tiddler: { title: markerTitle, text: "overwritten" } }, origin, { bag: BAG }),
      composite.writeFamily([rec(`${BAG}/ledger/residency/fake/content`, "smuggled")], [], origin, { bag: BAG }),
      composite.writeFamily([rec(effectRecordUri(BAG, "evt-3"), "rides"), rec("lar:///t/plain", "plain")], [], origin, { bag: BAG }),
    ]) {
      const err = await refusal(write);
      expect(isVerbRefusal(err) && (err as { reason: string }).reason).toBe("bag-retired");
    }
    expect((await store.get(markerTitle))?.tiddler["disposition"]).toBe("bag-retired");
    // An audit record that stands takes no overwrite and no deleting put.
    const audit = effectRecordUri(BAG, "evt-audit");
    await store.put(rec(audit, "audit"), origin);
    for (const write of [
      composite.put(rec(audit, "rewritten"), origin, { bag: BAG }),
      composite.put({ tiddler: { title: effectRecordUri(BAG, "evt-gone"), text: "x" }, meta: { deleted: true } } as LarTiddlerRecord, origin, { bag: BAG }),
    ]) {
      const err = await refusal(write);
      expect(isVerbRefusal(err) && (err as { reason: string }).reason).toBe("bag-retired");
    }
    expect((await store.get(audit))?.tiddler["text"]).toBe("audit");
    expect(await store.get(`${BAG}/ledger/residency/fake/content`)).toBeNull();
    expect(await store.get("lar:///t/plain")).toBeNull();
  });

  test("the door reads a synchronous layer with no await: the layer's write begins inside the call", async () => {
    const { composite, store } = await stand(false);
    const calls: string[] = [];
    const write = store.writeFamily.bind(store);
    store.writeFamily = ((...args: Parameters<typeof write>) => { calls.push("writeFamily"); return write(...args); }) as typeof store.writeFamily;
    const pending = composite.writeFamily([rec("lar:///t/sync", "sync")], [], origin, { bag: BAG });
    expect(calls).toEqual(["writeFamily"]);
    await pending;
  });

  test("CONTROL: a record at this bag's marker title that names another bag retires nothing here", async () => {
    const { composite, store } = await stand(false);
    const foreign = marker(OTHER);
    await store.put({ ...foreign, tiddler: { ...foreign.tiddler, title: effectRecordUri(BAG, RETIRED_EVENT_ID) } }, origin);
    expect((await store.get(effectRecordUri(BAG, RETIRED_EVENT_ID)))?.tiddler["bag"]).toBe(OTHER);
    await composite.put(rec("lar:///t/new", "new"), origin);
    expect((await store.get("lar:///t/new"))?.tiddler["text"]).toBe("new");
  });

  test("CONTROL: a marker another bag's ledger names retires nothing here", async () => {
    const { composite, store } = await stand(false);
    await store.put(marker(OTHER), origin);
    await composite.put(rec("lar:///t/new", "new"), origin);
    expect((await store.get("lar:///t/new"))?.tiddler["text"]).toBe("new");
  });
});
