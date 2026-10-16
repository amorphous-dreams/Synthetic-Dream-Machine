/**
 * browser-gate-pins — the page's one pair index starts empty, files a hearth by its URL origin, holds no
 * presentation until the keystore lane hands one, and draws deadlines from the page's timer.
 */
import { describe, expect, test } from "vitest";
import { browserFacePresentation, browserGatePins, dialDeadlines, hearthNameOf } from "../src/browser-gate-pins.js";

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

  test("no face presentation reaches the page yet", () => {
    expect(browserFacePresentation()).toBeNull();
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
