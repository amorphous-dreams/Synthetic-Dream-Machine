/** A wiki island cannot read the daemon island's fleet board. */
import { describe, expect, test, vi } from "vitest";
import { refuseBrowserDyadAsks } from "../src/browser-dyad-door.js";

describe("the wiki island's dyad refusal", () => {
  test("asks answer aside and warn once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const replies: unknown[] = [];
    let listen: ((message: unknown) => void) | undefined;
    const stop = refuseBrowserDyadAsks({
      post: (message) => { replies.push(message); },
      listen: (callback) => { listen = callback; return () => { listen = undefined; }; },
    });
    try {
      listen?.({ type: "dyad:ask", requestId: "one" });
      listen?.({ type: "dyad:ask", requestId: "two" });
      expect(replies).toEqual([
        { type: "dyad:read", requestId: "one", standing: "aside" },
        { type: "dyad:read", requestId: "two", standing: "aside" },
      ]);
      expect(warn.mock.calls.filter((call) => String(call[0]).includes("DyadDoorRefused"))).toHaveLength(1);
    } finally { stop(); warn.mockRestore(); }
  });
});
