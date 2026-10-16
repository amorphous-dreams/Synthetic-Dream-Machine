/**
 * The browser files its OWN hearth's pins off what the root-signed fleet-join answer carried (house ruling "The admit's gate pin",
 * carrier (b)), so the oracle read at its own hearth finds the floor pin before any crossing.
 *
 *   O1  CONTROL: the sovereign pin and the oracle's floor pin file under the relay's hearth; the read's key (the relay's
 *       name, the Nexus `oracleNexusFor` names, the oracle route, floor tier) finds the floor pin
 *   O2  RED: a floor pin at another Nexus, or a carried "floor" pin at sovereign tier, files nothing
 *   O3  RED: no sovereign pin, or no relay, files nothing (a floor pin hangs off the hearth the page dials)
 *   O4  RED: a hearth the page holds no relation with reads pin-absent: the read names no Nexus there (ruling: narrowing)
 */
import { describe, expect, test } from "vitest";
import {
  ORACLE_SOCKET_ROUTE, custodyRootDoor, deriveGateBundle, floorGateRoot, floorKeyDoor, floorRoute, sovereignGateRoot, sovereignRoute,
  type GateBundlePin,
} from "@lararium/mesh";
import { browserGatePins, fileOwnHearthPins, hearthNameOf, oracleNexusFor } from "../src/browser-gate-pins.js";

const RELAY = "ws://hearth.synthetic:7777/ws";
const BASE = "http://hearth.synthetic:7777";
const sovAt = (aid: string): GateBundlePin => {
  const b = deriveGateBundle(sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(3) })), new TextEncoder().encode(aid), sovereignRoute("/ws"));
  try { return b.pin; } finally { b.drop(); }
};
const floorAt = (aid: string, route = ORACLE_SOCKET_ROUTE): GateBundlePin => {
  const b = deriveGateBundle(floorGateRoot(floorKeyDoor({ derive: () => new Uint8Array(32).fill(8) })), new TextEncoder().encode(aid), floorRoute(route));
  try { return b.pin; } finally { b.drop(); }
};
const SOV = sovAt("nexus-a");
const ORACLE = floorAt("nexus-a");
const readKey = (base = BASE) => {
  const nexus = oracleNexusFor(base, { relayUrl: RELAY, nexus: SOV.nexus });
  return nexus === null ? null : { hearth: hearthNameOf(RELAY), nexus, route: ORACLE_SOCKET_ROUTE, tier: "floor" as const };
};

describe("fileOwnHearthPins", () => {
  test("O1 CONTROL: the oracle read at the page's own hearth finds the carried floor pin", () => {
    const pins = browserGatePins();
    expect(fileOwnHearthPins(pins, RELAY, { hearthGatePin: SOV, hearthFloorPins: [ORACLE] })).toBe(2);
    expect(pins.get(readKey()!)).toEqual(ORACLE);
    expect(pins.get({ hearth: hearthNameOf(RELAY), nexus: SOV.nexus, route: "/ws", tier: "sovereign" })).toEqual(SOV);
  });

  test("O2 RED: a floor pin at another Nexus, or a sovereign pin carried as floor, files nothing", () => {
    const pins = browserGatePins();
    expect(fileOwnHearthPins(pins, RELAY, { hearthGatePin: SOV, hearthFloorPins: [floorAt("nexus-b")] })).toBe(1);
    expect(pins.size).toBe(1);
    const again = browserGatePins();
    expect(fileOwnHearthPins(again, RELAY, { hearthGatePin: SOV, hearthFloorPins: [{ ...sovAt("nexus-a"), route: ORACLE_SOCKET_ROUTE }] })).toBe(1);
    expect(again.get(readKey()!)).toBeNull();
    expect(again.size).toBe(1);
  });

  test("O3 RED: no sovereign pin, or no relay, files nothing", () => {
    const pins = browserGatePins();
    expect(fileOwnHearthPins(pins, RELAY, { hearthGatePin: null, hearthFloorPins: [ORACLE] })).toBe(0);
    expect(fileOwnHearthPins(pins, null, { hearthGatePin: SOV, hearthFloorPins: [ORACLE] })).toBe(0);
    expect(pins.size).toBe(0);
  });

  test("O4 RED: another hearth names no Nexus to read under: pin-absent, by ruling", () => {
    const pins = browserGatePins();
    fileOwnHearthPins(pins, RELAY, { hearthGatePin: SOV, hearthFloorPins: [ORACLE] });
    expect(readKey("http://elsewhere.synthetic:7777")).toBeNull();
  });
});
