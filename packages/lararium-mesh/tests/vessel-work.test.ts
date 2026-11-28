import { describe, expect, test } from "vitest";
import { openVesselWork, islandWorkStore, serveVesselWork, type WorkSnapshotRest } from "../src/vessel-work.js";
import { bytesEqual } from "../src/crypto.js";
import { VESSEL_WORK_ID } from "../src/lar-uris.js";
import { SUMMONS_URI_PREFIX, EFFECT_URI_PREFIX } from "../src/verb-tiddler.js";

const origin = { kind: "lares-verb", requestId: "work-test" } as const;
const row = (title: string, text = "payload") => ({ tiddler: { title, text }, meta: {} });
function rest() {
  let bytes: Uint8Array | null = null, fail = false, replacements = 0;
  const store: WorkSnapshotRest = { read: async () => bytes, replace: async (next, previous) => {
    if (fail) throw new Error("replacement refused");
    if ((bytes === null) !== (previous === null) || (bytes && previous && !bytesEqual(bytes, previous))) throw new Error("concurrent replacement");
    bytes = next.slice(); replacements++;
  } };
  return { store, bytes: () => bytes, fail: (v: boolean) => { fail = v; }, replacements: () => replacements };
}

describe("durable vessel work", () => {
  test("pending payload and completed effect keys recover from bytes; completion removes the queue row without tombstones", async () => {
    const r = rest(), first = await openVesselWork(r.store);
    const pending = row(`${SUMMONS_URI_PREFIX}request-1`), effect = row(`${EFFECT_URI_PREFIX}effect-1`, "request-1");
    await first.store.put(pending, origin);
    const restarted = await openVesselWork(r.store);
    expect(await restarted.store.get(pending.tiddler.title)).toEqual(pending);
    await restarted.store.writeFamily([effect], [pending.tiddler.title], origin);
    const again = await openVesselWork(r.store);
    expect(await again.store.listVisible()).toEqual([effect.tiddler.title]);
    expect(await again.store.get(effect.tiddler.title)).toEqual(effect);
    expect(new TextDecoder().decode(r.bytes()!)).not.toContain(pending.tiddler.title);
    expect(new TextDecoder().decode(r.bytes()!)).not.toContain("deleted");
    expect((await again.checkpoint()).docUrl).toBe(VESSEL_WORK_ID);
  });
  test("a failed durable replacement publishes no row or notification and restart reads the preceding snapshot", async () => {
    const r = rest(), work = await openVesselWork(r.store), first = row("first");
    await work.store.put(first, origin);
    const notifications: unknown[] = []; work.store.subscribe(change => notifications.push(change));
    r.fail(true);
    await expect(work.store.put(row("unacknowledged"), origin)).rejects.toThrow("replacement refused");
    await expect(work.flush()).rejects.toThrow("replacement refused");
    expect(await work.store.get("unacknowledged")).toBeNull();
    expect(notifications).toEqual([]);
    expect(await (await openVesselWork(r.store)).store.listVisible()).toEqual(["first"]);
    r.fail(false); await work.store.put(row("retry"), origin); await work.flush();
  });
  test("unchanged writes replace no bytes; stale owners cannot overwrite a committed snapshot", async () => {
    const r = rest(), a = await openVesselWork(r.store), b = await openVesselWork(r.store);
    const record = row("one"); await a.store.put(record, origin); await a.store.put(record, origin);
    expect(r.replacements()).toBe(1);
    await expect(b.store.put(row("other"), origin)).rejects.toThrow("concurrent replacement");
    expect(await (await openVesselWork(r.store)).store.listVisible()).toEqual(["one"]);
  });
  test("the daemon capability acknowledges the vessel replacement and reads its same rows", async () => {
    const r = rest(), work = await openVesselWork(r.store);
    const host = new Set<(raw: unknown) => void>(), island = new Set<(raw: unknown) => void>();
    const stop = serveVesselWork({ post: msg => { for (const fn of island) fn(msg); }, listen: fn => { host.add(fn); return () => { host.delete(fn); }; } }, work);
    const proxy = islandWorkStore({ post: msg => { for (const fn of host) fn(msg); }, listen: fn => { island.add(fn); return () => { island.delete(fn); }; } });
    try {
      const record = row("through-port"); await proxy.store.put(record, origin);
      expect(await work.store.get(record.tiddler.title)).toEqual(record);
      expect(await proxy.store.get(record.tiddler.title)).toEqual(record);
      expect(r.replacements()).toBe(1);
    } finally { proxy.close(); stop(); }
  });
});
