/**
 * island-event-ask — K19 slice 4, R3: the main thread's island-event bridge reads an ask's origin from what the
 * ISLAND stamped, and never from anything content can write (house ruling 2026-10-29).
 *
 * An island event's top-level payload is built by island code: the reaction router stamps `content` or `surface`,
 * and the island's own host code (the disk ward, the projection's Confluence) stamps `channel`. Content reaches the
 * payload only through `verb`, `listenable` and the `verb-args` JSON, so an `origin` inside the args never counts.
 *
 * RED today: the node and browser bridges each read `{verb, args, requestedBy}` inline and carry no origin at all,
 * so every bridged ask lands local.
 */
import { describe, expect, test } from "vitest";
import { islandEventAsk, LARES_VERB_ARGS_WIRE_FIELD } from "@lararium/mesh";

describe("R3: the island-event bridge carries the island's stamp", () => {
  test("RED: the island's stamp rides through; an absent or unknown stamp reads content", () => {
    expect(typeof islandEventAsk, "both bridges read one function").toBe("function");
    expect(islandEventAsk("place", { verb: "pin", origin: "surface" })).toMatchObject({ verb: "pin", origin: "surface" });
    expect(islandEventAsk("disk-ward:refused", { verb: "ward-alert", requestedBy: "disk-ward", origin: "channel" })).toMatchObject({ verb: "ward-alert", origin: "channel", requestedBy: "disk-ward" });
    expect(islandEventAsk("place", { verb: "pin" })).toMatchObject({ verb: "pin", origin: "content" });
    expect(islandEventAsk("place", { verb: "pin", origin: "admin" })).toMatchObject({ origin: "content" });
  });

  test("RED: an origin carried inside the summon's own args never sets the ask's origin", () => {
    const ask = islandEventAsk("place", { verb: "pin", [LARES_VERB_ARGS_WIRE_FIELD]: JSON.stringify({ origin: "channel", bag: "lar:///b" }) });
    expect(ask).toMatchObject({ verb: "pin", origin: "content", args: { origin: "channel", bag: "lar:///b" } });
  });

  test("CONTROL: an event that names no verb asks nothing; the claim falls back to the listenable", () => {
    expect(islandEventAsk("place", { uri: "lar:///x" })).toBeNull();
    expect(islandEventAsk("place", { verb: "pin", origin: "content" })).toMatchObject({ requestedBy: "place", listenable: "place" });
  });
});
