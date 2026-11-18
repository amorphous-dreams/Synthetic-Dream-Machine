import { describe, expect, test } from "vitest";
import { deriveGateBundle, sovereignGateRoot, custodyRootDoor, floorGateRoot, floorKeyDoor, sovereignRoute, floorRoute } from "../src/gate-bundle.js";
import { utf8Bytes } from "../src/crypto.js";
import { dialIntentRelay, encodeIntentRelayResult, encodeIntentRelaySubmit, readIntentRelayResult, readIntentRelaySubmit, INTENT_RELAY_ROUTE, INTENT_RELAY_MAX_PLAINTEXT_BYTES } from "../src/intent-relay-door.js";
import { wire } from "./face-gate-fixture.js";
import type { SignedIntentEntry } from "../src/intent-entry.js";

const entry = { body: { entry: "intent" } } as unknown as SignedIntentEntry;
const root = sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(7) }));
const bundle = () => deriveGateBundle(root, utf8Bytes("group"), sovereignRoute(INTENT_RELAY_ROUTE));

describe("the relay's one sealed exchange", () => {
  test("RED: extra key, non-object, BOM, and oversized submit refuse; CONTROL: canonical submit and result round trip", () => {
    const encoded = encodeIntentRelaySubmit(entry);
    expect(readIntentRelaySubmit(encoded)).toEqual({ ok: true, entry });
    for (const value of ['{"submit":{},"other":0}', "[]", "\ufeff" + new TextDecoder().decode(encoded), "{" + " ".repeat(INTENT_RELAY_MAX_PLAINTEXT_BYTES) + "}"]) {
      expect(readIntentRelaySubmit(utf8Bytes(value))).toEqual({ ok: false });
    }
    expect(readIntentRelayResult(encodeIntentRelayResult({ status: "duplicate", receipt: { cid: "x" } }))).toEqual({ status: "duplicate", receipt: { cid: "x" } });
    expect(readIntentRelayResult(utf8Bytes('{"result":{"status":"refused","refusal":"invented"}}'))).toBeNull();
  });

  test("RED: floor and foreign-route pins draw silence without opening; CONTROL: the relay pin reads admitted", async () => {
    const b = bundle();
    const good = wire();
    void good.accepted.then(async (socket) => {
      const flight = b.respond(socket.flight.message1);
      const second = flight.writeMessage2();
      socket.send(second.message2);
      const frame = await socket.recv();
      if (frame) {
        expect(readIntentRelaySubmit(second.transport.receive.open(frame))).toEqual({ ok: true, entry });
        socket.send(second.transport.send.seal(encodeIntentRelayResult({ status: "admitted", receipt: { cid: "ok" } })));
      }
    });
    expect(await dialIntentRelay({ pin: b.pin, socket: good.dial, entry })).toEqual({ status: "admitted", receipt: { cid: "ok" } });
    const floor = deriveGateBundle(floorGateRoot(floorKeyDoor({ derive: () => new Uint8Array(32).fill(8) })), utf8Bytes("group"), floorRoute(INTENT_RELAY_ROUTE));
    const foreign = deriveGateBundle(root, utf8Bytes("group"), sovereignRoute("/ws/other"));
    for (const pin of [floor.pin, foreign.pin]) {
      let opened = false;
      const socket = { open: async () => { opened = true; }, send: () => {}, recv: async () => null, close: () => {} };
      expect(await dialIntentRelay({ pin, socket, entry })).toEqual({ status: "silence" });
      expect(opened).toBe(false);
    }
    b.drop(); floor.drop(); foreign.drop();
  });
});
