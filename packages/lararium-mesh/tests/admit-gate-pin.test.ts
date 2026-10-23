/**
 * admit-gate-pin — the pin shape an admit carries, and the index a dial files it in.
 *
 * Proven here, each with its control:
 *   · a sovereign pin on the sovereign sync route for the named Nexus reads; the other tier, the other route
 *     and the other Nexus each refuse by name, and the gate-bundle refusals pass through unchanged;
 *   · today's shape (one 64-hex string) and nonsense refuse;
 *   · the admit's digest is the pin's gate-bundle digest, frozen against a fixed root;
 *   · the index files pins by (hearth, Nexus, route, tier), keeps pairs apart, and moves no held pin.
 */
import { describe, expect, test } from "vitest";
import { hex, utf8Bytes } from "../src/crypto.js";
import {
  ADMIT_GATE_PIN_REFUSALS, SOVEREIGN_SYNC_ROUTE, admitGatePinDigest, dialPinKeyOf, hearthPinIndex, readAdmitGatePin, readAdmitGatePinAt,
} from "../src/admit-gate-pin.js";
import {
  GATE_BUNDLE_REFUSALS, custodyRootDoor, deriveGateBundle, floorGateRoot, floorKeyDoor, floorRoute, gateBundleDigest,
  sovereignGateRoot, sovereignRoute, type GateBundlePin,
} from "../src/gate-bundle.js";

const door = { derive: () => new Uint8Array(32).fill(7) };
const sov = () => sovereignGateRoot(custodyRootDoor(door));
const flo = () => floorGateRoot(floorKeyDoor(door));
const sovPin = (nexus: string, path = "/ws"): GateBundlePin => deriveGateBundle(sov(), utf8Bytes(nexus), sovereignRoute(path)).pin;
const floPin = (nexus: string, path = "/announce"): GateBundlePin => deriveGateBundle(flo(), utf8Bytes(nexus), floorRoute(path)).pin;
const refusalOf = (v: unknown, expect_?: { nexus?: string }): string | null => {
  const r = readAdmitGatePin(v, expect_);
  return "refusal" in r ? r.refusal : null;
};

const PIN_A = sovPin("nexus-a.synthetic");
/** Frozen: admitGatePinDigest over the sovereign /ws pin of nexus-a.synthetic under the fill-7 custody root. */
const FROZEN_DIGEST = "49ab1b909ba4f3b43b8296d70ed608f322dcbf3c822ffd88f4633d7c0ddf8562";

describe("the admit's pin", () => {
  test("CONTROL: a derived sovereign pin on /ws for its Nexus reads, with and without the expectation", () => {
    expect(SOVEREIGN_SYNC_ROUTE).toBe("/ws");
    for (const expected of [undefined, { nexus: "nexus-a.synthetic" }, {}]) {
      const r = readAdmitGatePin({ ...PIN_A }, expected);
      expect("pin" in r && r.pin).toEqual(PIN_A);
    }
  });
  test("the digest is gateBundleDigest of the pin, frozen", () => {
    expect(admitGatePinDigest(PIN_A)).toBe(gateBundleDigest(PIN_A));
    expect(admitGatePinDigest(PIN_A)).toBe(FROZEN_DIGEST);
  });
  test("RED: a floor-tier pin refuses pin-other-tier", () => {
    expect(refusalOf({ ...floPin("nexus-a.synthetic", "/ws") })).toBe("pin-other-tier");
  });
  test("RED: a sovereign pin on /flow refuses pin-other-route", () => {
    expect(refusalOf({ ...sovPin("nexus-a.synthetic", "/flow") })).toBe("pin-other-route");
  });
  test("RED: a pin for nexus-b read with expect nexus-a refuses pin-other-nexus; CONTROL: nexus-b expected reads", () => {
    const b = sovPin("nexus-b.synthetic");
    expect(refusalOf({ ...b }, { nexus: "nexus-a.synthetic" })).toBe("pin-other-nexus");
    expect(refusalOf({ ...b }, { nexus: "nexus-b.synthetic" })).toBeNull();
    expect(hex(utf8Bytes("nexus-b.synthetic"))).toBe(b.nexus);
  });
  test("the gate-bundle refusals pass through", () => {
    expect(refusalOf({ ...PIN_A, transportKey: "00".repeat(32) })).toBe("transport-key-refused");
    expect(refusalOf({ ...PIN_A, transportKey: "zz" })).toBe("transport-key-refused");
    expect(refusalOf({ ...PIN_A, extra: 1 })).toBe("pin-malformed");
    expect(refusalOf({ ...PIN_A, tier: "other" })).toBe("tier-malformed");
    expect(refusalOf({ ...PIN_A, route: "ws" })).toBe("route-malformed");
    expect(refusalOf({ ...PIN_A, nexus: "XY" })).toBe("nexus-malformed");
    expect(refusalOf({ ...PIN_A, signingKey: "zz" })).toBe("signing-key-refused");
    // A signing key spelled as the transport key reads as no pin.
    expect(refusalOf({ ...PIN_A, signingKey: PIN_A.transportKey })).not.toBeNull();
  });
  test("nonsense refuses, today's 64-hex shape included", () => {
    for (const v of [null, undefined, 7, "a".repeat(64), [], {}, [PIN_A]]) expect(refusalOf(v)).toBe("pin-malformed");
  });
  test("the refusal list spreads the whole gate-bundle vocabulary, then the three of its own", () => {
    expect(ADMIT_GATE_PIN_REFUSALS).toEqual([...GATE_BUNDLE_REFUSALS, "pin-other-tier", "pin-other-route", "pin-other-nexus"]);
  });
});

describe("the pair index", () => {
  const A = "nexus-a.synthetic", B = "nexus-b.synthetic";
  test("two hearths x two Nexuses keep four separate pins; forHearth answers only its own pair", () => {
    const ix = hearthPinIndex();
    const pins = new Map<string, GateBundlePin>();
    for (const h of ["hearth-1", "hearth-2"]) for (const n of [A, B]) {
      // the same Nexus pin files under two hearths: the hearth is part of the key
      const p = sovPin(n, `/ws`);
      pins.set(`${h}|${n}`, p);
      expect(ix.put(h, { ...p })).toBe(true);
    }
    expect(ix.size).toBe(4);
    for (const h of ["hearth-1", "hearth-2"]) for (const n of [A, B]) {
      const got = ix.forHearth(h, n);
      expect(got).toEqual([pins.get(`${h}|${n}`)]);
      expect(ix.get(dialPinKeyOf(h, got[0]!))).toEqual(got[0]);
    }
    expect(ix.forHearth("hearth-3", A)).toEqual([]);
  });
  test("a second, different pin under a held key refuses and the first stays; the same pin twice is idempotent", () => {
    const ix = hearthPinIndex();
    const first = sovPin(A);
    const other = { ...first, signingKey: sovPin(B).signingKey };
    expect(ix.put("h", first)).toBe(true);
    expect(ix.put("h", { ...first })).toBe(true);
    expect(ix.size).toBe(1);
    expect(ix.put("h", other)).toBe(false);
    expect(ix.get(dialPinKeyOf("h", first))).toEqual(first);
    expect(ix.size).toBe(1);
  });
  test("a floor pin on /announce and the sovereign /ws pin both file and read back under separate keys", () => {
    const ix = hearthPinIndex();
    const s = sovPin(A), f = floPin(A);
    expect(ix.put("h", s)).toBe(true);
    expect(ix.put("h", f)).toBe(true);
    expect(ix.size).toBe(2);
    expect(ix.get(dialPinKeyOf("h", s))).toEqual(s);
    expect(ix.get(dialPinKeyOf("h", f))).toEqual(f);
    expect(dialPinKeyOf("h", f)).toEqual({ hearth: "h", nexus: f.nexus, route: "/announce", tier: "floor" });
    expect(ix.forHearth("h", A)).toHaveLength(2);
    expect(ix.forHearth("h", B)).toEqual([]);
  });
  test("a pin that fails its read, or an empty or newline-bearing hearth, stores nothing", () => {
    const ix = hearthPinIndex();
    const p = sovPin(A);
    expect(ix.put("h", { ...p, extra: 1 })).toBe(false);
    expect(ix.put("h", "a".repeat(64))).toBe(false);
    expect(ix.put("", p)).toBe(false);
    expect(ix.put("h\n1", p)).toBe(false);
    expect(ix.size).toBe(0);
    expect(ix.get({ hearth: "h", nexus: p.nexus, route: p.route, tier: p.tier })).toBeNull();
    expect("replace" in ix).toBe(false);
  });
  test("two routes under one hearth, Nexus and tier keep two keys", () => {
    const ix = hearthPinIndex();
    const flow = floPin(A, "/flow"), announce = floPin(A, "/announce");
    expect(ix.put("h", flow)).toBe(true);
    expect(ix.put("h", announce)).toBe(true);
    expect(ix.size).toBe(2);
    expect(ix.get(dialPinKeyOf("h", flow))).toEqual(flow);
    expect(ix.get(dialPinKeyOf("h", announce))).toEqual(announce);
  });
  test("the same route and Nexus under another tier keeps another key", () => {
    const ix = hearthPinIndex();
    expect(ix.put("h", sovPin(A, "/x"))).toBe(true);
    expect(ix.put("h", floPin(A, "/x"))).toBe(true);
    expect(ix.size).toBe(2);
  });
});

describe("the Nexus is required where an admit is read", () => {
  test("CONTROL: readAdmitGatePinAt reads the pin of the Nexus it names", () => {
    const r = readAdmitGatePinAt({ ...PIN_A }, "nexus-a.synthetic");
    expect("pin" in r && r.pin).toEqual(PIN_A);
  });
  test("RED: another Nexus refuses pin-other-nexus, and so does a missing or empty one (the optional reader would read any)", () => {
    const refusal = (nexus: unknown) => { const r = readAdmitGatePinAt({ ...PIN_A }, nexus as string); return "refusal" in r ? r.refusal : null; };
    expect(refusal("nexus-b.synthetic")).toBe("pin-other-nexus");
    for (const missing of [undefined, null, "", 7]) expect(refusal(missing), String(missing)).toBe("pin-other-nexus");
    expect(refusalOf({ ...PIN_A }, { nexus: undefined })).toBeNull();
  });
  test("the other refusals still stand, in the same order", () => {
    const r = readAdmitGatePinAt({ ...floPin("nexus-a.synthetic", "/ws") }, "nexus-a.synthetic");
    expect("refusal" in r && r.refusal).toBe("pin-other-tier");
  });
});

describe("one spelling of the Nexus per door", () => {
  test("CONTROL: get takes the pin's hex; forHearth takes the AID text", () => {
    const ix = hearthPinIndex();
    ix.put("h", PIN_A);
    expect(ix.get(dialPinKeyOf("h", PIN_A))).toEqual(PIN_A);
    expect(ix.forHearth("h", "nexus-a.synthetic")).toEqual([PIN_A]);
  });
  test("RED: get with the AID text refuses loudly instead of missing", () => {
    const ix = hearthPinIndex();
    ix.put("h", PIN_A);
    expect(() => ix.get({ hearth: "h", nexus: "nexus-a.synthetic", route: PIN_A.route, tier: PIN_A.tier })).toThrow(TypeError);
  });
  test("RED: forHearth with the hex form refuses loudly instead of answering nothing", () => {
    const ix = hearthPinIndex();
    ix.put("h", PIN_A);
    expect(() => ix.forHearth("h", PIN_A.nexus)).toThrow(TypeError);
  });
});
