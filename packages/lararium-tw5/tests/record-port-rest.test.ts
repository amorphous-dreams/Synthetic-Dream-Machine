import { describe, expect, test } from "vitest";
import { realPort, ofType, open } from "./record-port-real-rig.js";
import type { RestDoor } from "../src/rest-door.js";

const write = (txId: string) => ({ type: "port:write", portId: "p", txId, records: [{ title: "Edited", fields: { text: "body" } }] });
/** A rest door whose wait the test releases: the vessel's `doc:rested` answer, played by hand. */
function door() {
  let release!: () => void;
  const parked = new Promise<void>(resolve => { release = resolve; });
  const begun: Array<readonly string[] | null> = [];
  const rest: RestDoor = {
    begin: () => ({ done: slots => { begun.push(slots); } }),
    held: () => parked, idle: () => parked, answer: () => false, stalledAsks: () => 0, close: () => {},
  };
  return { rest, release, begun };
}

describe("a port write answers once its documents rest", () => {
  test("port:written waits for the rest door; CONTROL: with no door the write answers at once", async () => {
    const d = door();
    const held = await realPort({}, undefined, { rest: d.rest });
    await held.send({ ...open, edits: true });
    const sending = held.send(write("tx-1"));
    await sending;
    expect(d.begun).toHaveLength(1);                           // the write began a rest hold in the turn of its dispatch
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
