/**
 * browser-relay-pin.test.ts — a browser vessel dials a relay only under the gate key it pinned, and says so
 * aloud when it holds none: it never falls back to its own key and dials a path no gate claims.
 */
import { describe, test, expect } from "vitest";
import { LarWSClientAdapter, knockPath } from "@lararium/mesh";
import { relayPinFor } from "../src/browser-relay-pin.js";

const NODE_GATE = "ab".repeat(32);

describe("the relay pin", () => {
  test("RED: a relay URL with no gate key is refused aloud — no dial, a reason naming the missing pin", () => {
    const pin = relayPinFor("ws://node:8080/ws", undefined);
    expect(pin.dial).toBe(false);
    expect(pin.dial ? "" : pin.reason).toMatch(/no gate key pinned/);
    expect(relayPinFor("ws://node:8080/ws", "not-a-key").dial).toBe(false);
  });

  test("CONTROL: no relay URL is a pure local boot — no dial, nothing to say", () => {
    expect(relayPinFor(undefined, undefined)).toEqual({ dial: false, reason: null });
  });

  test("CONTROL: a pinned node key dials the knock that key derives", () => {
    const pin = relayPinFor("ws://node:8080/ws", NODE_GATE.toUpperCase());
    expect(pin).toEqual({ dial: true, gatePubKey: NODE_GATE });
    const adapter = new LarWSClientAdapter({
      url: "ws://node:8080/ws", aud: "lar:///x", gatePubKey: (pin as { gatePubKey: string }).gatePubKey,
      identity: { contactCard: "{}", peerPubKey: "cd".repeat(32), sign: async () => "00".repeat(64) },
    });
    expect(new URL(adapter.url).pathname).toBe(knockPath(NODE_GATE, "/ws"));
  });
});
