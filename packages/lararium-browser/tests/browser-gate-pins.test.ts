/**
 * browser-gate-pins — the page's one pair index starts empty, files a hearth by its URL origin, files a floor card's
 * flow pin CLAIM at the floor tier alone and against an anchor conveyed apart from the card, and draws deadlines from the
 * page's timer.
 */
import { describe, expect, test } from "vitest";
import { deriveGateBundle, floorGateRoot, floorKeyDoor, floorRoute, hex, type GateBundlePin } from "@lararium/mesh";
import { browserGatePins, dialDeadlines, fileFloorCard, hearthNameOf } from "../src/browser-gate-pins.js";
import { claimAt, floorPinFor, foundPlace, headOf, rotatePlace, type TestPlace } from "../../lararium-mesh/tests/place-claim-fixture.js";

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

  const NEXUS_NAME = "nexus-floor";
  const cardOf = async (place: TestPlace, fill: number) => ({ claim: await claimAt(place, floorPinFor(NEXUS_NAME, "/flow", fill)), kel: place.chain });

  test("an anchored floor card files the flow's claimed pin under the relay's name, at the floor tier alone", async () => {
    const pins = browserGatePins();
    const place = foundPlace(1);
    const card = await cardOf(place, 3);
    expect(fileFloorCard(pins, "ws://node:8080/ws", card, { aid: place.aid, via: "genesis" })).toMatchObject({ filed: true, moved: "first", publisher: headOf(place).signerKey });
    expect(pins.get({ hearth: "ws://node:8080", nexus: NEXUS, route: "/flow", tier: "floor" })).toEqual(flowPin(3));
    expect(pins.get({ hearth: "ws://node:8080", nexus: NEXUS, route: "/ws", tier: "sovereign" })).toBeNull();
  });

  test("RED: a card with no anchor, another place's anchor or no relay files nothing", async () => {
    const pins = browserGatePins();
    const place = foundPlace(1), other = foundPlace(2);
    const card = await cardOf(place, 3);
    expect(fileFloorCard(pins, "ws://node:8080/ws", card, null)).toEqual({ filed: false, refusal: "place-unanchored" });
    expect(fileFloorCard(pins, "ws://node:8080/ws", card, { aid: other.aid, via: "transfer" })).toEqual({ filed: false, refusal: "place-unanchored" });
    expect(fileFloorCard(pins, undefined, card, { aid: place.aid, via: "transfer" })).toMatchObject({ filed: false });
    expect(pins.size).toBe(0);
  });

  test("a card at a newer head replaces the pin; a card at an older head refuses and the newer pin stands", async () => {
    const pins = browserGatePins();
    const p0 = foundPlace(1), p1 = rotatePlace(p0);
    const anchor = { aid: p0.aid, via: "admit" as const };
    fileFloorCard(pins, "ws://node:8080/ws", await cardOf(p0, 3), anchor);
    expect(fileFloorCard(pins, "ws://node:8080/ws", await cardOf(p1, 4), anchor)).toMatchObject({ filed: true, moved: "replaced" });
    expect(fileFloorCard(pins, "ws://node:8080/ws", await cardOf(p0, 3), anchor)).toMatchObject({ filed: false, refusal: "rollback" });
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
