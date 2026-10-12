import { describe, expect, test } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, NoWorkingLayerRefusal, summon, wikiSlotUri } from "@lararium/mesh";
import { heedSummons } from "../src/verb-summons.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";

describe("summons consumption follows the source layer", () => {
  test("a missing working default refuses the tombstone without invoking", async () => {
    const daemonBag = new MemoryTiddlerStore(DAEMON_BAG_ID);
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: daemonBag, writable: true, defaultWritable: false });
    const request = summon({ verb: "nexus-kapae", args: {}, requestedBy: "did:key:caller", requestId: "no-working-summons" });
    await expect(heedSummons({ title: request.tiddler.title, record: request, origin: { kind: "test" }, bag: DAEMON_BAG_ID }, {
      daemon: composite,
      isInFlight: () => false,
      placeVerb: () => { throw new Error("summons dispatched without a working layer"); },
    })).rejects.toBeInstanceOf(NoWorkingLayerRefusal);
    expect(await daemonBag.get(request.tiddler.title)).toBeNull();
  });

  test("working summons is tombstoned there and a restarted relay sees no live request", async () => {
    const daemonBag = new MemoryTiddlerStore(DAEMON_BAG_ID);
    const workingBag = new MemoryTiddlerStore(wikiSlotUri("daemon", "working"));
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: daemonBag, writable: true, defaultWritable: false });
    composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: workingBag, writable: true });
    const request = summon({ verb: "nexus-kapae", args: {}, requestedBy: "did:key:caller", requestId: "working-summons" });
    await composite.put(request, { kind: "test" });
    let invoked = 0;
    await heedSummons({ title: request.tiddler.title, record: request, origin: { kind: "test" }, bag: wikiSlotUri("daemon", "working") }, {
      daemon: composite,
      isInFlight: () => false,
      placeVerb: () => { invoked++; },
    });

    expect(invoked).toBe(1);
    expect((await workingBag.get(request.tiddler.title))?.meta?.deleted).toBe(true);
    expect(await daemonBag.get(request.tiddler.title)).toBeNull();

    const daemonRequest = summon({ verb: "nexus-kapae", args: {}, requestedBy: "did:key:caller", requestId: "daemon-summons" });
    await composite.put(daemonRequest, { kind: "test" }, { bag: DAEMON_BAG_ID });
    await heedSummons({ title: daemonRequest.tiddler.title, record: daemonRequest, origin: { kind: "test" }, bag: DAEMON_BAG_ID }, {
      daemon: composite,
      isInFlight: () => false,
      placeVerb: () => { invoked++; },
    });
    expect(invoked).toBe(2);
    expect((await daemonBag.get(daemonRequest.tiddler.title))?.meta?.deleted).toBe(true);

    const restarted = new CompositeStore();
    restarted.addLayer({ bagId: DAEMON_BAG_ID, store: daemonBag, writable: true, defaultWritable: false });
    restarted.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: workingBag, writable: true });
    const replay = await restarted.resolveTopmost(request.tiddler.title);
    expect(replay).toBeNull();
    expect(await restarted.resolveTopmost(daemonRequest.tiddler.title)).toBeNull();
    if (replay) await heedSummons({ title: request.tiddler.title, record: replay.record, origin: { kind: "test" }, bag: replay.bagId }, {
      daemon: restarted,
      isInFlight: () => false,
      placeVerb: () => { invoked++; },
    });
    expect(invoked).toBe(2);
  });
});
