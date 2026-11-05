import { describe, expect, test } from "vitest";
import { realPort, ofType, open } from "./record-port-real-rig.js";
import type { ReceiptCapability } from "../src/receipt.js";

const write = (txId: string) => ({ type: "port:write", portId: "p", txId, records: [{ title: "Edited", fields: { text: "body" } }] });
/** A receipt capability whose wait the test releases: the vessel's `receipt:issued` answer, played by hand. */
function receiptRig() {
  let release!: () => void;
  const parked = new Promise<void>(resolve => { release = resolve; });
  const begun: Array<readonly string[] | null> = [];
  const receipt: ReceiptCapability = {
    begin: () => ({ done: slots => { begun.push(slots); } }),
    held: () => parked, idle: () => parked, answer: () => false, stalledAsks: () => 0, close: () => {},
  };
  return { receipt, release, begun };
}

describe("a port write answers once its documents rest", () => {
  test("port:written waits for the receipt; CONTROL: with no receipt capability the write answers at once", async () => {
    const d = receiptRig();
    const held = await realPort({}, undefined, { receipt: d.receipt });
    await held.send({ ...open, edits: true });
    const sending = held.send(write("tx-1"));
    await sending;
    expect(d.begun).toHaveLength(1);                           // the write began a receipt hold in the turn of its dispatch
    expect(ofType(held.messages, "port:written")).toEqual([]);   // and its answer waits on the vessel's word
    d.release();
    await (await import("./record-port-real-rig.js")).pump();
    expect(ofType(held.messages, "port:written")).toHaveLength(1);
    await held.close();
    const plain = await realPort();
    await plain.send({ ...open, edits: true });
    await plain.send(write("tx-2"));
    expect(ofType(plain.messages, "port:written")).toHaveLength(1);
    await plain.close();
  });
});
