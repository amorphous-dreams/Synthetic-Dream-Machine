import { describe, expect, test } from "vitest";
import { deriveGateBundle, sovereignGateRoot, custodyRootDoor, sovereignRoute, utf8Bytes, dialIntentRelay, INTENT_RELAY_ROUTE, type SignedIntentEntry } from "@lararium/mesh";
import { makeIntentRelayGate } from "../src/intent-relay-door.js";
import { wire, handDeadlines } from "../../lararium-mesh/tests/face-gate-fixture.js";
import { gatePrologue } from "../../lararium-mesh/src/gate-bundle.js";
import { hexToBytes } from "../../lararium-mesh/src/crypto.js";
import { noiseInitiate, noiseKeyPair } from "../../lararium-mesh/src/noise-ik.js";

const entry = { body: { entry: "intent" } } as unknown as SignedIntentEntry;
const group = "a".repeat(64);
const root = sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(9) }));
const bundle = () => deriveGateBundle(root, utf8Bytes(group), sovereignRoute(INTENT_RELAY_ROUTE));

describe("the relay gate", () => {
  test("RED: a ring shut after standing draws silence; CONTROL: the same pin answers admitted while on", async () => {
    const b = bundle();
    let on = true;
    const deadlines = handDeadlines();
    const gate = makeIntentRelayGate({ bundle: b, group, ring: { admits: async () => on }, admit: async () => ({ status: "admitted", receipt: { ok: true } }), deadlines });
    const control = wire();
    void control.accepted.then((socket) => gate.accept(socket));
    expect(await dialIntentRelay({ pin: b.pin, socket: control.dial, entry })).toEqual({ status: "admitted", receipt: { ok: true } });
    on = false;
    const red = wire();
    void red.accepted.then((socket) => gate.accept(socket));
    const response = dialIntentRelay({ pin: b.pin, socket: red.dial, entry });
    await red.accepted;
    await Promise.resolve(); await Promise.resolve();
    deadlines.fire();
    expect(await response).toEqual({ status: "silence" });
    expect(gate.pending).toBe(0);
    b.drop();
  });

  test("RED: a pending admit settles at the deadline; CONTROL: a resolved admit answers refused by name", async () => {
    const b = bundle();
    const deadlines = handDeadlines();
    let entered!: () => void;
    const inAdmit = new Promise<void>((resolve) => { entered = resolve; });
    const gate = makeIntentRelayGate({ bundle: b, group, ring: { admits: async () => true }, admit: async () => { entered(); return new Promise(() => {}); }, deadlines });
    const w = wire();
    let outcome: ReturnType<typeof gate.accept> | undefined;
    void w.accepted.then((socket) => { outcome = gate.accept(socket); });
    const dial = dialIntentRelay({ pin: b.pin, socket: w.dial, entry });
    await inAdmit;
    expect(gate.pending).toBe(1);
    deadlines.fire();
    expect(await outcome).toEqual({ outcome: "silence", reason: "deadline-before-answer" });
    expect(gate.pending).toBe(0);
    expect(await dial).toEqual({ status: "silence" });
    const control = makeIntentRelayGate({ bundle: b, group, ring: { admits: async () => true }, admit: async () => ({ status: "refused", refusal: "entry-refused" }), deadlines: handDeadlines() });
    const c = wire(); void c.accepted.then((socket) => control.accept(socket));
    expect(await dialIntentRelay({ pin: b.pin, socket: c.dial, entry })).toEqual({ status: "refused", refusal: "entry-refused" });
    b.drop();
  });

  test("RED: a foreign face or sync route cannot decrypt at this path; CONTROL: this face's pin answers", async () => {
    const b = bundle();
    const gate = makeIntentRelayGate({ bundle: b, group, ring: { admits: async () => true }, admit: async () => ({ status: "admitted", receipt: {} }), deadlines: handDeadlines() });
    const control = wire(); void control.accepted.then((socket) => gate.accept(socket));
    expect((await dialIntentRelay({ pin: b.pin, socket: control.dial, entry })).status).toBe("admitted");
    const foreign = [
      deriveGateBundle(root, utf8Bytes("c".repeat(64)), sovereignRoute(INTENT_RELAY_ROUTE)),
      deriveGateBundle(root, utf8Bytes(group), sovereignRoute("/ws")),
    ];
    for (const other of foreign) {
      const secret = new Uint8Array(32).fill(3);
      const pair = noiseKeyPair(secret);
      const initiated = noiseInitiate({ prologue: gatePrologue(other.pin), s: pair, rs: hexToBytes(other.pin.transportKey) });
      const wirePair = wire();
      wirePair.dial.open({ knock: b.knock, message1: initiated.message1 });
      expect(await gate.accept(await wirePair.accepted)).toEqual({ outcome: "silence", reason: "flight-undecrypted" });
      pair.secretKey.fill(0); secret.fill(0); other.drop();
    }
    b.drop();
  });
});
