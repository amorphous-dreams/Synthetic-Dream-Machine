/**
 * gate-bundle — the keys one gate holds for ONE Nexus on ONE route: derived, never stored, and shared with
 * no other Nexus, route or root.
 *
 * Proven here, each with its control:
 *   · one root, one Nexus and one route derive one bundle, every time (a restart changes nothing);
 *   · two Nexuses on one vessel share no key, no digest and no knock; nor do two routes, nor two roots;
 *   · the derivation's recipe stands pinned against an independent computation, so the transport key and
 *     the signing key each derive under their own name;
 *   · the bundle asks its root for one registered child and nothing else, and refuses a root that answers
 *     anything but 32 bytes;
 *   · a pin reads under exact keys and one spelling, binds its digest, and refuses a weak key;
 *   · the signing key signs a gate's purposes alone, and a dropped bundle signs and answers nothing.
 */
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { describe, expect, test } from "vitest";
import { hex, hexToBytes, utf8Bytes } from "../src/crypto.js";
import {
  ALL_DOMAINS, GATE_BUNDLE_INFO, GATE_BUNDLE_PIN_DOMAIN, GATE_HANDSHAKE_DOMAIN, GATE_SIGNING_KEY_INFO,
  GATE_TRANSPORT_KEY_INFO, GATE_VERDICT_DOMAIN, SESSION_FINISH_DOMAIN,
} from "../src/domains.js";
import {
  GATE_BUNDLE_REFUSALS, GATE_SIGNING_PURPOSES, GateBundleRefused, deriveGateBundle, gateBundleDigest, gateFields,
  gateKnock, gatePrologue, readGateBundlePin, readGateSignature, type GateBundlePin, type GateBundleRoot,
} from "../src/gate-bundle.js";
import { knockSegment } from "../src/gate-knock.js";
import { NoiseHandshakeError, noiseInitiate, noiseKeyPair } from "../src/noise-ik.js";
import { IDENTITY_KEY } from "./ed25519-torsion.js";

/** A custody root's stand-in: HKDF under the domain, as the custody seat derives, with a log of what got asked. */
function rootOf(fill: number): GateBundleRoot & { readonly asked: string[] } {
  const bytes = new Uint8Array(32).fill(fill);
  const asked: string[] = [];
  return { asked, derive(domain) { asked.push(domain); return hkdf(sha256, bytes, new Uint8Array(0), utf8Bytes(domain), 32); } };
}

const AID_A = utf8Bytes("nexus-aaaaaaaaaaaaaaaa");
const AID_B = utf8Bytes("nexus-bbbbbbbbbbbbbbbb");
const own = (value: object, key: string): boolean => Object.hasOwn(value, key);

function pinOf(reading: ReturnType<typeof readGateBundlePin>): GateBundlePin {
  if (!("pin" in reading)) throw new Error(`the pin refused: ${reading.refusal}`);
  return reading.pin;
}

describe("the gate bundle derives, and never rests", () => {
  test("CONTROL: one root, one Nexus and one route derive one bundle across two derivations", () => {
    const first = deriveGateBundle(rootOf(7), AID_A, "/ws");
    const again = deriveGateBundle(rootOf(7), AID_A, "/ws");
    expect(again.pin).toEqual(first.pin);
    expect(again.digest).toBe(first.digest);
    expect(again.knock).toBe(first.knock);
    expect(first.pin.route).toBe("/ws");
    expect(first.pin.nexus).toBe(hex(AID_A));
  });

  test("RED: two Nexuses on one vessel share no gate key, no digest and no knock", () => {
    const root = rootOf(7);
    const a = deriveGateBundle(root, AID_A, "/ws");
    const b = deriveGateBundle(root, AID_B, "/ws");
    expect(a.pin.transportKey).not.toBe(b.pin.transportKey);
    expect(a.pin.signingKey).not.toBe(b.pin.signingKey);
    expect(a.digest).not.toBe(b.digest);
    expect(a.knock).not.toBe(b.knock);
    // No key of one bundle stands anywhere in the other: transport against signing too.
    const keys = [a.pin.transportKey, a.pin.signingKey, b.pin.transportKey, b.pin.signingKey];
    expect(new Set(keys).size).toBe(4);
  });

  test("RED: two routes of one Nexus share no key, and two roots share none", () => {
    const ws = deriveGateBundle(rootOf(7), AID_A, "/ws");
    const oracle = deriveGateBundle(rootOf(7), AID_A, "/oracle");
    const other = deriveGateBundle(rootOf(8), AID_A, "/ws");
    const keys = [ws, oracle, other].flatMap((bundle) => [bundle.pin.transportKey, bundle.pin.signingKey]);
    expect(new Set(keys).size).toBe(6);
    expect(new Set([ws.knock, oracle.knock, other.knock]).size).toBe(3);
  });

  test("the recipe stands pinned: each key derives under its own name, over the Nexus and the route, length-prefixed", () => {
    const root = rootOf(7);
    const bundle = deriveGateBundle(root, AID_A, "/ws");
    const seed = rootOf(7).derive(GATE_BUNDLE_INFO);
    const transportSecret = hkdf(sha256, seed, new Uint8Array(0), gateFields(GATE_TRANSPORT_KEY_INFO, AID_A, utf8Bytes("/ws")), 32);
    const signingSeed = hkdf(sha256, seed, new Uint8Array(0), gateFields(GATE_SIGNING_KEY_INFO, AID_A, utf8Bytes("/ws")), 32);
    expect(bundle.pin.transportKey).toBe(hex(x25519.getPublicKey(transportSecret)));
    expect(bundle.pin.signingKey).toBe(hex(ed25519.getPublicKey(signingSeed)));
    // CONTROL: the two names swapped derive two other keys, so each name carries its own separation.
    expect(bundle.pin.transportKey).not.toBe(hex(x25519.getPublicKey(signingSeed)));
    expect(bundle.pin.signingKey).not.toBe(hex(ed25519.getPublicKey(transportSecret)));
    // The fields encode under a four-byte length each: a byte moved from the Nexus into the route moves the key.
    const moved = deriveGateBundle(rootOf(7), utf8Bytes("nexus-aaaaaaaaaaaaaaaa/w"), "/s");
    expect(moved.pin.transportKey).not.toBe(bundle.pin.transportKey);
    expect(hex(gateFields("d", utf8Bytes("ab"), utf8Bytes("c")))).not.toBe(hex(gateFields("d", utf8Bytes("a"), utf8Bytes("bc"))));
  });

  test("the bundle asks its root for ONE registered child, and refuses a root that answers anything but 32 bytes", () => {
    const root = rootOf(7);
    deriveGateBundle(root, AID_A, "/ws");
    expect(root.asked).toEqual([GATE_BUNDLE_INFO]);
    for (const domain of [GATE_BUNDLE_INFO, GATE_TRANSPORT_KEY_INFO, GATE_SIGNING_KEY_INFO, GATE_BUNDLE_PIN_DOMAIN, GATE_HANDSHAKE_DOMAIN, GATE_VERDICT_DOMAIN]) {
      expect(ALL_DOMAINS, domain).toContain(domain);
    }
    for (const answer of [new Uint8Array(31), new Uint8Array(33), new Uint8Array(0), "00".repeat(32), null]) {
      expect(() => deriveGateBundle({ derive: () => answer as never }, AID_A, "/ws")).toThrow(GateBundleRefused);
    }
    expect(() => deriveGateBundle({ derive: () => { throw new Error("custody locked"); } }, AID_A, "/ws")).toThrow(/custody locked/);
    // CONTROL: a root that answers 32 bytes derives.
    expect(deriveGateBundle({ derive: () => new Uint8Array(32).fill(3) }, AID_A, "/ws").pin.route).toBe("/ws");
  });

  test("the Nexus rides as opaque bytes within a bound, and a route holds one spelling", () => {
    const root = rootOf(7);
    for (const aid of [new Uint8Array(0), new Uint8Array(257), "nexus-a" as never, null as never]) {
      expect(() => deriveGateBundle(root, aid, "/ws"), String(aid)).toThrow(GateBundleRefused);
    }
    for (const route of ["", "ws", "/ws/", "//ws", "/w s", "/ws?x", "/WS/../x", 7 as never]) {
      expect(() => deriveGateBundle(root, AID_A, route), String(route)).toThrow(GateBundleRefused);
    }
    // CONTROL: any bytes name a Nexus, a non-text identifier among them, and a nested route reads.
    expect(deriveGateBundle(root, Uint8Array.of(0, 255, 7), "/ws").pin.nexus).toBe("00ff07");
    expect(deriveGateBundle(root, AID_A, "/relay/membership").pin.route).toBe("/relay/membership");
  });

  test("every refusal carries a name from the table", () => {
    const thrown: string[] = [];
    for (const act of [
      () => deriveGateBundle({ derive: () => new Uint8Array(3) }, AID_A, "/ws"),
      () => deriveGateBundle(rootOf(1), new Uint8Array(0), "/ws"),
      () => deriveGateBundle(rootOf(1), AID_A, "ws"),
    ]) {
      try { act(); } catch (error) { thrown.push((error as GateBundleRefused).refusal); }
    }
    expect(thrown).toEqual(["root-astray", "nexus-malformed", "route-malformed"]);
    for (const name of thrown) expect(GATE_BUNDLE_REFUSALS).toContain(name);
  });
});

describe("the pin a dialer holds", () => {
  const bundle = deriveGateBundle(rootOf(7), AID_A, "/ws");

  test("CONTROL: a bundle's own pin reads, frozen, and binds its digest and its knock", () => {
    const pin = pinOf(readGateBundlePin({ ...bundle.pin }));
    expect(pin).toEqual(bundle.pin);
    expect(Object.isFrozen(pin)).toBe(true);
    expect(gateBundleDigest(pin)).toBe(bundle.digest);
    expect(gateKnock(pin)).toBe(bundle.knock);
    expect(gateKnock(pin)).toBe(knockSegment(bundle.digest, "/ws"));
    expect(hex(gatePrologue(pin))).toBe(hex(gateFields(GATE_HANDSHAKE_DOMAIN, hexToBytes(bundle.digest))));
  });

  test("RED: the digest binds every field: one decoded byte moved in any of the four moves it", () => {
    const flip = (value: string): string => {
      const bytes = hexToBytes(value);
      bytes[bytes.length - 1]! ^= 0x01;
      const moved = hex(bytes);
      expect(moved).not.toBe(value);                        // the encoding changed before the digest gets asked
      return moved;
    };
    const digests = new Set([gateBundleDigest(bundle.pin)]);
    digests.add(gateBundleDigest({ ...bundle.pin, nexus: flip(bundle.pin.nexus) }));
    digests.add(gateBundleDigest({ ...bundle.pin, route: "/wt" }));
    digests.add(gateBundleDigest({ ...bundle.pin, transportKey: flip(bundle.pin.transportKey) }));
    digests.add(gateBundleDigest({ ...bundle.pin, signingKey: flip(bundle.pin.signingKey) }));
    expect(digests.size).toBe(5);
    // The digest names its own purpose: it never equals a bare hash of the same fields.
    expect(bundle.digest).not.toBe(hex(sha256(gateFields("", hexToBytes(bundle.pin.nexus), utf8Bytes("/ws"), hexToBytes(bundle.pin.transportKey), hexToBytes(bundle.pin.signingKey)))));
  });

  test("RED: a pin reads under exact keys and one spelling, and refuses a weak key by name", () => {
    const refusal = (value: unknown): string => { const r = readGateBundlePin(value); return "refusal" in r ? r.refusal : "read"; };
    expect(refusal(bundle.pin)).toBe("read");                                              // CONTROL
    expect(refusal({ ...bundle.pin, vesselKey: "ab".repeat(32) })).toBe("pin-malformed");  // no field rides beside the four
    expect(refusal({ nexus: bundle.pin.nexus, route: "/ws", transportKey: bundle.pin.transportKey })).toBe("pin-malformed");
    expect(refusal(null)).toBe("pin-malformed");
    expect(refusal({ ...bundle.pin, nexus: bundle.pin.nexus.toUpperCase() })).toBe("nexus-malformed");
    expect(refusal({ ...bundle.pin, nexus: "" })).toBe("nexus-malformed");
    expect(refusal({ ...bundle.pin, route: "ws" })).toBe("route-malformed");
    expect(refusal({ ...bundle.pin, transportKey: bundle.pin.transportKey.toUpperCase() })).toBe("transport-key-refused");
    expect(refusal({ ...bundle.pin, transportKey: "00".repeat(32) })).toBe("transport-key-refused");   // a low-order point: every dial would share one secret
    expect(refusal({ ...bundle.pin, signingKey: IDENTITY_KEY })).toBe("signing-key-refused");
    expect(refusal({ ...bundle.pin, signingKey: "zz".repeat(32) })).toBe("signing-key-refused");
    expect(refusal({ ...bundle.pin, signingKey: bundle.pin.transportKey, transportKey: bundle.pin.signingKey })).not.toBe("read");
    expect(refusal(new Proxy({}, { ownKeys() { throw new Error("trap"); } }))).toBe("pin-malformed");
  });
});

describe("what the bundle's keys do", () => {
  test("the transport key answers a first flight written to its pin, and no other", () => {
    const bundle = deriveGateBundle(rootOf(7), AID_A, "/ws");
    const other = deriveGateBundle(rootOf(7), AID_B, "/ws");
    const dial = noiseInitiate({ prologue: gatePrologue(bundle.pin), s: noiseKeyPair(new Uint8Array(32).fill(41)), rs: hexToBytes(bundle.pin.transportKey) });
    const pending = bundle.respond(dial.message1);
    const { message2, transport } = pending.writeMessage2();
    expect(hex(dial.readMessage2(message2).transport.handshakeHash)).toBe(hex(transport.handshakeHash));   // CONTROL
    // RED: the same flight at another Nexus's gate on this vessel decrypts nothing.
    expect(() => other.respond(dial.message1)).toThrow(NoiseHandshakeError);
    // RED: a flight written to this gate's key under another Nexus's prologue decrypts nothing: the prologue binds the pin.
    const astray = noiseInitiate({ prologue: gatePrologue(other.pin), s: noiseKeyPair(new Uint8Array(32).fill(42)), rs: hexToBytes(bundle.pin.transportKey) });
    expect(() => bundle.respond(astray.message1)).toThrow(NoiseHandshakeError);
  });

  test("the signing key signs a gate's own purposes and nothing else", async () => {
    const bundle = deriveGateBundle(rootOf(7), AID_A, "/ws");
    const other = deriveGateBundle(rootOf(7), AID_B, "/ws");
    expect(GATE_SIGNING_PURPOSES).toEqual([GATE_VERDICT_DOMAIN]);
    const image = gateFields(GATE_VERDICT_DOMAIN, new Uint8Array(32).fill(1), hexToBytes(bundle.digest));
    const signature = await bundle.sign(image);
    expect(readGateSignature(bundle.pin, image, signature)).toBe(true);                    // CONTROL
    expect(readGateSignature(other.pin, image, signature)).toBe(false);                    // another Nexus's pin reads nothing
    const moved = Uint8Array.from(image); moved[moved.length - 1]! ^= 1;
    expect(hex(moved)).not.toBe(hex(image));
    expect(readGateSignature(bundle.pin, moved, signature)).toBe(false);
    // RED: an image that leads with another purpose, or with none, draws no signature.
    for (const foreign of [gateFields(SESSION_FINISH_DOMAIN, new Uint8Array(4)), new Uint8Array(40), utf8Bytes(GATE_VERDICT_DOMAIN), "x" as never]) {
      await expect(bundle.sign(foreign)).rejects.toBeInstanceOf(GateBundleRefused);
    }
    // A reader holds a signature to the same purposes: the gate's own key over a foreign image reads as no signature.
    const seed = rootOf(7).derive(GATE_BUNDLE_INFO);
    const signingSeed = hkdf(sha256, seed, new Uint8Array(0), gateFields(GATE_SIGNING_KEY_INFO, AID_A, utf8Bytes("/ws")), 32);
    const foreignImage = gateFields(SESSION_FINISH_DOMAIN, new Uint8Array(4));
    const underGateKey = ed25519.sign(foreignImage, signingSeed);
    expect(ed25519.verify(underGateKey, foreignImage, hexToBytes(bundle.pin.signingKey))).toBe(true);   // the setup took: the gate's key did sign it
    expect(readGateSignature(bundle.pin, foreignImage, underGateKey)).toBe(false);
  });

  test("a dropped bundle signs nothing and answers no flight; its pin stays readable", async () => {
    const bundle = deriveGateBundle(rootOf(7), AID_A, "/ws");
    const dial = noiseInitiate({ prologue: gatePrologue(bundle.pin), s: noiseKeyPair(new Uint8Array(32).fill(41)), rs: hexToBytes(bundle.pin.transportKey) });
    const image = gateFields(GATE_VERDICT_DOMAIN, new Uint8Array(32));
    await bundle.sign(image);                                                              // CONTROL: it signed while it stood
    bundle.drop();
    expect(bundle.dropped).toBe(true);
    await expect(bundle.sign(image)).rejects.toMatchObject({ refusal: "bundle-dropped" });
    expect(() => bundle.respond(dial.message1)).toThrow(GateBundleRefused);
    expect(pinOf(readGateBundlePin(bundle.pin)).signingKey).toBe(bundle.pin.signingKey);
  });

  test("a bundle exposes no secret: its own fields hold the pin, the digest, the knock and three doors", () => {
    const bundle = deriveGateBundle(rootOf(7), AID_A, "/ws");
    expect(Reflect.ownKeys(bundle).sort()).toEqual(["digest", "drop", "dropped", "knock", "pin", "respond", "sign"]);
    expect(own(bundle, "transport")).toBe(false);
    expect(JSON.stringify(bundle)).not.toMatch(/secret/i);
    expect(Object.isFrozen(bundle)).toBe(true);
  });
});
