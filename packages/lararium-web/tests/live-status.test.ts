import { describe, expect, test } from "vitest";
import { connectionPresentation, defaultReadFace, resolveRelayUrl } from "../src/live-status.js";

describe("served-origin crossing", () => {
  test("the read face carries the page origin including its actual port", () => {
    expect(defaultReadFace({ origin: "http://localhost:5417" })).toBe("http://localhost:5417");
  });

  test("a pinned same-origin node derives the matching websocket URL", () => {
    expect(resolveRelayUrl(
      { protocol: "https:", host: "lararium.example:5441" },
      new URLSearchParams("gate=abc"),
    )).toBe("wss://lararium.example:5441/ws");
  });

  test("explicit crossing routes stay explicit and no gate means no dial", () => {
    const location = { protocol: "http:", host: "localhost:5417" };
    expect(resolveRelayUrl(location, new URLSearchParams("relay=ws%3A%2F%2Fnode%3A5440%2Fws&gate=abc")))
      .toBe("ws://node:5440/ws");
    expect(resolveRelayUrl(location, new URLSearchParams("relay=ws%3A%2F%2Fnode%3A5440%2Fws")))
      .toBe("ws://node:5440/ws");
    expect(resolveRelayUrl(location, new URLSearchParams())).toBeUndefined();
  });

  test("connection state names local, refusal and the authenticated peer", () => {
    expect(connectionPresentation({ status: "local" }).mode).toContain("local");
    expect(connectionPresentation({ status: "refused", gatePubKey: "abc", reason: "wrong pin" }).connection)
      .toContain("wrong pin");
    expect(connectionPresentation({ status: "connected", peer: { gatePubKey: "abc" } }).mode)
      .toContain("abc");
  });

  test("a blocked crossing keeps the capability reason visible", () => {
    expect(connectionPresentation({
      status: "blocked",
      gatePubKey: "gate-1",
      reason: "no social contact card is available for the pinned relay crossing",
    })).toEqual({
      connection: "blocked — no social contact card is available for the pinned relay crossing",
      mode: "crossing to gate-1 is blocked",
      tone: "warn",
    });
  });

  test("a failed initial dial names a local unreachable gate, while a lost session names disconnection", () => {
    const lost = { status: "disconnected", gatePubKey: "gate-1" } as const;
    expect(connectionPresentation(lost)).toMatchObject({
      connection: "gate-unreachable — gate-1",
      tone: "warn",
    });
    expect(connectionPresentation(lost, true)).toMatchObject({
      connection: "disconnected from gate-1",
      tone: "warn",
    });
  });
});
