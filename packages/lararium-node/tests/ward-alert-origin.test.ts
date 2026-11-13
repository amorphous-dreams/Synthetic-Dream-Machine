/**
 * ward-alert-origin — K19 slice 4, R3 (host half): the disk ward and the projection's Confluence are the island's
 * own host code, never content, so their `ward-alert` events carry the `channel` stamp the island sets itself
 * (house ruling 2026-10-29: origin comes from what the sender is; the bridge carries content alone otherwise).
 *
 * RED today: the projector callbacks post a bare `{verb: "ward-alert", requestedBy}` payload through the generic
 * bridge, with no origin, so they read exactly like a content summon.
 */
import { describe, expect, test } from "vitest";
import { hostEvent } from "../src/island-behaviors.js";

describe("R3: the island's host code stamps its own events channel", () => {
  test("RED: a ward event names channel; the payload rides unchanged beside it", () => {
    expect(typeof hostEvent, "the projector's five callbacks build their event through one door").toBe("function");
    const ev = hostEvent("lar:///ha.ka.ba/wikis/home", "disk-ward:refused", { verb: "ward-alert", requestedBy: "disk-ward", bagId: "lar:///b", uri: "lar:///u", reason: "r" });
    expect(ev).toEqual({
      type: "event", wikiUri: "lar:///ha.ka.ba/wikis/home", listenable: "disk-ward:refused",
      payload: { verb: "ward-alert", requestedBy: "disk-ward", bagId: "lar:///b", uri: "lar:///u", reason: "r", origin: "channel" },
    });
  });
  test("CONTROL: a payload that already names an origin cannot override the host stamp", () => {
    expect(hostEvent("lar:///w", "confluence:conflict", { verb: "ward-alert", origin: "surface" }).payload).toMatchObject({ origin: "channel" });
  });
});

describe("R3: the projector's bag-projected journal event is host code too (CI e2e, slice 4)", () => {
  test("RED: bagProjectedEvent names channel, so journal-append reaches the daemon local", async () => {
    const { bagProjectedEvent } = await import("../src/journal-append-gate.js");
    expect(bagProjectedEvent("lar:///w", { bagId: "lar:///b", path: "/x" }).payload).toMatchObject({ verb: "journal-append", origin: "channel" });
  });
});
