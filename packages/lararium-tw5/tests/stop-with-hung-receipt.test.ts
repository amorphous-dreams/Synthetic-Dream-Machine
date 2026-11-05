/**
 * A flight hung on a receipt a quiet, connected peer never answers ends when the receipt capability closes: the shore's stop() then
 * returns, the title stays unsaved (never acked), and no timer decided anything. The kernel closes the capability BEFORE it stops the
 * adaptor (kernel-teardown-order pins the order).
 */
import { describe, expect, test } from "vitest";
import { makeReceiptCapability } from "../src/receipt.js";
import { ManualBoundary, shoreRig, turns } from "./wiki-shore-rig.js";

describe("stop() over a hung receipt", () => {
  test("CONTROL: the quiet peer holds the flight and stop() stays pending; closing the capability ends both, the write refused", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const title = "lar:///t/receipt/quiet-peer";
    let asks = 0;
    const receipt = makeReceiptCapability({
      post: () => { asks++; },                         // the peer stays connected and silent: no receipt:issued ever returns
      handles: () => new Map(Object.entries(r.handles)) as never,
    });
    r.adaptor.caps.receipt = receipt as never;
    r.adaptor.receiptRequired = true;
    const save = r.adaptor.saveTiddler({ fields: { title, text: "edit" } });
    const refused = save.then(() => "acked", (error: Error) => error.message);
    boundary.fire();
    await turns(32);
    expect(asks, "control: the receipt ask went out and no answer returns").toBeGreaterThan(0);
    let stopped = false;
    const stopping = r.adaptor.stop().then(() => { stopped = true; });
    await turns(32);
    expect(stopped, "control: stop() waits on the hung flight").toBe(false);
    receipt.close();
    await stopping;
    expect(stopped).toBe(true);
    expect(await refused, "a closed capability gives no ack").not.toBe("acked");
    
  }, 60_000);
});
