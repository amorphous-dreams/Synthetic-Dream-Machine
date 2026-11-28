import { describe, expect, test } from "vitest";
import { CompositeStore, NoWorkingLayerRefusal } from "@lararium/mesh/composite-store";
import { VESSEL_STATE_ID, DAEMON_BAG_ID } from "@lararium/mesh/lar-uris";
import { SUMMONS_URI_PREFIX, summon } from "@lararium/mesh/verb-tiddler";
import { heedSummons } from "../src/verb-summons.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";

describe("a summons rests in the state document and leaves it on consumption", () => {
  test("the summons title names the state home, never the daemon bag", () => {
    const request = summon({ verb: "nexus-kapae", args: {}, requestedBy: "did:key:caller", requestId: "titled" });
    expect(request.tiddler.title.startsWith(`${VESSEL_STATE_ID}/summons/`)).toBe(true);
    expect(SUMMONS_URI_PREFIX.startsWith(DAEMON_BAG_ID)).toBe(false);
  });

  test("a store standing no state home refuses the tombstone without invoking", async () => {
    const daemonBag = new MemoryTiddlerStore(DAEMON_BAG_ID);
    const notControl = new CompositeStore();
    notControl.addLayer({ bagId: DAEMON_BAG_ID, store: daemonBag, writable: true, defaultWritable: true });
    const request = summon({ verb: "nexus-kapae", args: {}, requestedBy: "did:key:caller", requestId: "no-state-summons" });
    await expect(heedSummons({ title: request.tiddler.title, record: request, origin: { kind: "test" }, bag: DAEMON_BAG_ID }, {
      state: notControl,
      isInFlight: () => false,
      placeVerb: () => { throw new Error("summons dispatched without a state home"); },
    })).rejects.toBeInstanceOf(NoWorkingLayerRefusal);
    expect(await daemonBag.get(request.tiddler.title)).toBeNull();
  });

  test("a state summons is tombstoned there and a restarted relay sees no live request", async () => {
    const controlBag = new MemoryTiddlerStore(VESSEL_STATE_ID);
    const state = new CompositeStore();
    state.addLayer({ bagId: VESSEL_STATE_ID, store: controlBag, writable: true, defaultWritable: true });
    const request = summon({ verb: "nexus-kapae", args: {}, requestedBy: "did:key:caller", requestId: "state-summons" });
    await state.put(request, { kind: "test" });
    let invoked = 0;
    await heedSummons({ title: request.tiddler.title, record: request, origin: { kind: "test" }, bag: VESSEL_STATE_ID }, {
      state,
      isInFlight: () => false,
      placeVerb: () => { invoked++; },
    });
    expect(invoked).toBe(1);
    expect((await controlBag.get(request.tiddler.title))?.meta?.deleted).toBe(true);

    const restarted = new CompositeStore();
    restarted.addLayer({ bagId: VESSEL_STATE_ID, store: controlBag, writable: true, defaultWritable: true });
    expect(await restarted.resolveTopmost(request.tiddler.title)).toBeNull();
  });
});
