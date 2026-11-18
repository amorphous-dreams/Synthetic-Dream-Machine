import { describe, expect, test } from "vitest";
import { CompositeStore, CONTROL_HOME_ID, DAEMON_BAG_ID, NoWorkingLayerRefusal, SUMMONS_URI_PREFIX, summon } from "@lararium/mesh";
import { heedSummons } from "../src/verb-summons.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";

describe("a summons rests in the control document and leaves it on consumption", () => {
  test("the summons title names the control home, never the daemon bag", () => {
    const request = summon({ verb: "nexus-kapae", args: {}, requestedBy: "did:key:caller", requestId: "titled" });
    expect(request.tiddler.title.startsWith(`${CONTROL_HOME_ID}/summons/`)).toBe(true);
    expect(SUMMONS_URI_PREFIX.startsWith(DAEMON_BAG_ID)).toBe(false);
  });

  test("a store standing no control home refuses the tombstone without invoking", async () => {
    const daemonBag = new MemoryTiddlerStore(DAEMON_BAG_ID);
    const notControl = new CompositeStore();
    notControl.addLayer({ bagId: DAEMON_BAG_ID, store: daemonBag, writable: true, defaultWritable: true });
    const request = summon({ verb: "nexus-kapae", args: {}, requestedBy: "did:key:caller", requestId: "no-control-summons" });
    await expect(heedSummons({ title: request.tiddler.title, record: request, origin: { kind: "test" }, bag: DAEMON_BAG_ID }, {
      control: notControl,
      isInFlight: () => false,
      placeVerb: () => { throw new Error("summons dispatched without a control home"); },
    })).rejects.toBeInstanceOf(NoWorkingLayerRefusal);
    expect(await daemonBag.get(request.tiddler.title)).toBeNull();
  });

  test("a control summons is tombstoned there and a restarted relay sees no live request", async () => {
    const controlBag = new MemoryTiddlerStore(CONTROL_HOME_ID);
    const control = new CompositeStore();
    control.addLayer({ bagId: CONTROL_HOME_ID, store: controlBag, writable: true, defaultWritable: true });
    const request = summon({ verb: "nexus-kapae", args: {}, requestedBy: "did:key:caller", requestId: "control-summons" });
    await control.put(request, { kind: "test" });
    let invoked = 0;
    await heedSummons({ title: request.tiddler.title, record: request, origin: { kind: "test" }, bag: CONTROL_HOME_ID }, {
      control,
      isInFlight: () => false,
      placeVerb: () => { invoked++; },
    });
    expect(invoked).toBe(1);
    expect((await controlBag.get(request.tiddler.title))?.meta?.deleted).toBe(true);

    const restarted = new CompositeStore();
    restarted.addLayer({ bagId: CONTROL_HOME_ID, store: controlBag, writable: true, defaultWritable: true });
    expect(await restarted.resolveTopmost(request.tiddler.title)).toBeNull();
  });
});
