/**
 * flow-read-client NEVER THROWS — its contract reads `{ ok: false, reason }` for every failure, so a caller that
 * awaits it plainly is never torn by a throw from the pin index or the dial.
 *
 *   T1  RED: a pin index that throws (the Nexus spelled as the AID text) answers ok:false by name
 *   T2  RED: a dial socket that throws as it is drawn answers ok:false by name
 *   T3  RED: a malformed base URL answers ok:false by name
 *   T4  RED: the pin stands at ANOTHER Nexus: a read at a Nexus the index holds no pin for answers pin-absent, and an
 *       index that hands back a pin standing at another Nexus than the one asked answers pin-other-nexus; neither draws
 *       a dial socket
 */
import { describe, expect, test } from "vitest";
import { hearthPinIndex } from "../src/admit-gate-pin.js";
import { hex, utf8Bytes } from "../src/crypto.js";
import { ORACLE_SOCKET_ROUTE, pullAndVerifyFlow } from "../src/flow-read-client.js";
import { AUDIENCE, handDeadlines, presenter, world } from "./face-gate-fixture.js";

async function base() {
  const w = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE });
  const p = await presenter(w, "oracle reader");
  const pins = hearthPinIndex();
  pins.put("hearth-1", w.pin);
  return {
    pins, hearth: "hearth-1", nexus: w.pin.nexus, audience: AUDIENCE, deadlines: handDeadlines(), verifyingKey: "ab".repeat(32),
    presentation: { certificate: p.certificate, signer: p.signer, arm: p.arm, history: p.history },
  };
}

describe("pullAndVerifyFlow never throws", () => {
  test("T1 RED: a throwing pin index reads ok:false", async () => {
    const opts = await base();
    const res = await pullAndVerifyFlow("http://peer", { ...opts, nexus: "nexus-as-aid-text" });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/pin-unreadable/);
  });
  test("T2 RED: a dial socket that throws as it is drawn reads ok:false", async () => {
    const opts = await base();
    const res = await pullAndVerifyFlow("http://peer", { ...opts, dialSocket: () => { throw new Error("no socket"); } });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/dial failed/);
  });
  test("T3 RED: a malformed base URL reads ok:false", async () => {
    const opts = await base();
    const res = await pullAndVerifyFlow("not a url", opts);
    expect(res.ok).toBe(false);
  });
  test("T4 RED: a pin standing at another Nexus reads ok:false, and no dial socket is drawn", async () => {
    const opts = await base();
    let drawn = 0;
    const dialSocket = () => { drawn += 1; throw new Error("never drawn"); };
    const elsewhere = hex(utf8Bytes("nexus-b.elsewhere"));
    const absent = await pullAndVerifyFlow("http://peer", { ...opts, nexus: elsewhere, dialSocket });
    expect(absent).toMatchObject({ ok: false });
    expect(absent.reason).toMatch(/pin-absent/);
    // An index that answers the key with the pin it holds at another Nexus.
    const held = opts.pins.get({ hearth: opts.hearth, nexus: opts.nexus, route: ORACLE_SOCKET_ROUTE, tier: "floor" })!;
    const lying = { get: () => held };
    const other = await pullAndVerifyFlow("http://peer", { ...opts, pins: lying as never, nexus: elsewhere, dialSocket });
    expect(other).toMatchObject({ ok: false });
    expect(other.reason).toMatch(/pin-other-nexus/);
    expect(drawn).toBe(0);
  });
});
