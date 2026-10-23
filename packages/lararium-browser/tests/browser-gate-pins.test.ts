/**
 * browser-gate-pins — the page's one pair index starts empty, files a hearth by its URL origin, files a floor card's
 * flow pin at the floor tier alone, and draws deadlines from the page's timer.
 */
import { describe, expect, test } from "vitest";
import { deriveGateBundle, floorGateRoot, floorKeyDoor, floorRoute, hex, type GateBundlePin } from "@lararium/mesh";
import { browserGatePins, dialDeadlines, fileFloorCardPin, hearthNameOf } from "../src/browser-gate-pins.js";

const NEXUS = hex(new TextEncoder().encode("nexus-floor"));
const flowPin = (fill: number): GateBundlePin => {
  const b = deriveGateBundle(floorGateRoot(floorKeyDoor({ derive: () => new Uint8Array(32).fill(fill) })), new TextEncoder().encode("nexus-floor"), floorRoute("/flow"));
  try { return b.pin; } finally { b.drop(); }
};

describe("the browser gate pins", () => {
  test("the index is empty: a HEX64 gate key cannot stand for a full pin", () => {
    const pins = browserGatePins();
    expect(pins.get({ hearth: "http://node:8080", nexus: "ab".repeat(16), route: "/ws", tier: "sovereign" })).toBeNull();
  });

  test("each boot makes its own index", () => {
    expect(browserGatePins()).not.toBe(browserGatePins());
  });

  test("a hearth is filed by its URL origin, whatever path the dial rides", () => {
    expect(hearthNameOf("ws://node:8080/ws")).toBe("ws://node:8080");
    expect(hearthNameOf("not a url\n")).toBe("not a url");
  });

  test("a floor card files the flow's floor pin under the relay's name, at the floor tier alone", () => {
    const pins = browserGatePins();
    const pin = flowPin(3);
    expect(fileFloorCardPin(pins, "ws://node:8080/ws", { pin, publisher: "ab".repeat(32) })).toBe(true);
    expect(pins.get({ hearth: "ws://node:8080", nexus: NEXUS, route: "/flow", tier: "floor" })).toEqual(pin);
    expect(pins.get({ hearth: "ws://node:8080", nexus: NEXUS, route: "/ws", tier: "sovereign" })).toBeNull();
  });

  test("a card names no pin without a relay, and a pin the index already holds stands", () => {
    const pins = browserGatePins();
    expect(fileFloorCardPin(pins, undefined, { pin: flowPin(3), publisher: "ab".repeat(32) })).toBe(false);
    expect(pins.size).toBe(0);
    pins.put("ws://node:8080", flowPin(4));
    expect(fileFloorCardPin(pins, "ws://node:8080/ws", { pin: flowPin(3), publisher: "ab".repeat(32) })).toBe(false);
    expect(pins.get({ hearth: "ws://node:8080", nexus: NEXUS, route: "/flow", tier: "floor" })).toEqual(flowPin(4));
  });

  test("a drawn deadline lapses once, and a cancelled one never does", async () => {
    const source = dialDeadlines(1);
    let lapses = 0;
    const lapsed = new Promise<void>((resolve) => { source.draw(() => { lapses += 1; resolve(); }); });
    source.draw(() => { lapses += 100; }).cancel();
    await lapsed;
    expect(lapses).toBe(1);
  });
});
