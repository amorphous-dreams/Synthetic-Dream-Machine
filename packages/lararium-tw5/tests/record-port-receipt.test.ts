import { describe, expect, test } from "vitest";
import { realPort, ofType, open } from "./record-port-real-rig.js";
import type { ReceiptCapability } from "../src/receipt.js";

const write = (txId: string) => ({ type: "port:write", portId: "p", txId, records: [{ title: "Edited", fields: { text: "body" } }] });
/** A receipt capability whose wait the test releases: the vessel's `receipt:issued` answer, played by hand. */
function receiptRig(verdict = true) {
  let release!: () => void;
  const parked = new Promise<void>(resolve => { release = resolve; });
  const begun: Array<readonly string[] | null> = [];
  const named: string[] = [];
  const receipt = {
    begin: () => ({ done: (slots: readonly string[] | null, end?: { titles?: readonly string[] }) => {
      begun.push(slots); named.push(...(end?.titles ?? []));
      return parked.then(() => verdict);
    } }),
    held: () => parked.then(() => verdict), idle: () => parked, answer: () => false, stalledAsks: () => 0, close: () => {},
  } as unknown as ReceiptCapability;
  return { receipt, release, begun, named };
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

  test("F2: a port write whose receipt the vessel refuses answers refused by name and leaves the ledger, so its retry writes afresh — CONTROL: the issued write above answers applied", async () => {
    const d = receiptRig(false);
    const held = await realPort({}, undefined, { receipt: d.receipt });
    await held.send({ ...open, edits: true });
    await held.send(write("tx-r"));
    expect(d.named, "the write's titles ride its hold").toEqual(["Edited"]);
    d.release();
    await (await import("./record-port-real-rig.js")).pump();
    const [answer] = ofType(held.messages, "port:written") as Array<{ status: string; reason?: string }>;
    expect(answer).toMatchObject({ status: "refused", reason: "receipt-refused" });
    await held.send(write("tx-r"));
    await (await import("./record-port-real-rig.js")).pump();
    expect(d.begun.filter((slots) => slots !== null), "the retry wrote again and asked a second receipt").toHaveLength(2);
    await held.close();
  });
});
