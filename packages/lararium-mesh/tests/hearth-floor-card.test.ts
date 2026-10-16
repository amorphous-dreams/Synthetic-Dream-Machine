/**
 * hearth-floor-pins, THE FLOOR CARD (carrier (c)): the oracle's floor pin and the snapshot's publisher key, carried by
 * the person's own hand in a device's arrival URL.
 *
 *   C1  CONTROL: a card reads back whole: the floor pin on the oracle route and the publisher key
 *   C2  a sovereign pin, a floor pin on another route, or a torn pin reads no card
 *   C3  a publisher that is no Ed25519 key, a stray field or a torn carriage reads no card
 */
import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { hex, utf8Bytes, base64UrlEncode } from "../src/crypto.js";
import { custodyRootDoor, deriveGateBundle, floorGateRoot, floorKeyDoor, floorRoute, sovereignGateRoot, sovereignRoute, type GateBundlePin } from "../src/gate-bundle.js";
import { hearthFloorCardText, readHearthFloorCard } from "../src/hearth-floor-pins.js";

const NEXUS = "nexus-floor-card";
const floorPin = (route = "/oracle"): GateBundlePin => {
  const b = deriveGateBundle(floorGateRoot(floorKeyDoor({ derive: () => new Uint8Array(32).fill(5) })), utf8Bytes(NEXUS), floorRoute(route));
  try { return b.pin; } finally { b.drop(); }
};
const sovereignPin = (): GateBundlePin => {
  const b = deriveGateBundle(sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(6) })), utf8Bytes(NEXUS), sovereignRoute("/ws"));
  try { return b.pin; } finally { b.drop(); }
};
const PUBLISHER = hex(ed25519.getPublicKey(new Uint8Array(32).fill(7)));
const carried = (value: unknown): string => base64UrlEncode(utf8Bytes(JSON.stringify(value)));

describe("the floor card", () => {
  it("C1 — CONTROL: a card reads back whole", () => {
    const pin = floorPin();
    const card = readHearthFloorCard(hearthFloorCardText({ pin, publisher: PUBLISHER }));
    expect(card).toEqual({ pin, publisher: PUBLISHER });
    expect(hearthFloorCardText({ pin, publisher: PUBLISHER })).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("C2 — a sovereign pin, another floor route, or a torn pin reads no card", () => {
    expect(readHearthFloorCard(carried({ pin: sovereignPin(), publisher: PUBLISHER }))).toBeNull();
    expect(readHearthFloorCard(carried({ pin: floorPin("/shelf"), publisher: PUBLISHER }))).toBeNull();
    expect(readHearthFloorCard(carried({ pin: { ...floorPin(), transportKey: "00".repeat(32) }, publisher: PUBLISHER }))).toBeNull();
  });

  it("C3 — a publisher that is no key, a stray field or a torn carriage reads no card", () => {
    expect(readHearthFloorCard(carried({ pin: floorPin(), publisher: "zz".repeat(32) }))).toBeNull();
    expect(readHearthFloorCard(carried({ pin: floorPin(), publisher: PUBLISHER, gate: PUBLISHER }))).toBeNull();
    expect(readHearthFloorCard(hearthFloorCardText({ pin: floorPin(), publisher: PUBLISHER }).slice(0, 40))).toBeNull();
    expect(readHearthFloorCard("not a card!")).toBeNull();
    expect(readHearthFloorCard(undefined)).toBeNull();
  });
});
