/**
 * window-lend-reads — THE SCOPED WINDOW LEND ANSWERS PLATFORM READS, IN A REAL BROWSER.
 *
 * TW5's bundled crypto seeds its generator from `window.crypto.getRandomValues` while the core blob evaluates,
 * through the lend the host bridge hands it. A browser's platform accessors (`crypto`, `performance`) answer
 * only to the real global: read with a proxy as the receiver they throw "Illegal invocation", the crypto
 * module catches that, and its generator stands unseeded. The lend names the real global on every read.
 */
import { describe, expect, test } from "vitest";
import { makeScopedWindowLend } from "../../lararium-tw5/src/tw5-host-bridge.js";

describe("the scoped window lend reads platform accessors", () => {
  test("crypto and performance answer through the lend", () => {
    const lend = makeScopedWindowLend(() => {});
    const drawn = new Uint32Array(8);
    (lend["crypto"] as Crypto).getRandomValues(drawn);
    expect(drawn.some((word) => word !== 0)).toBe(true);
    expect(typeof (lend["performance"] as Performance).now()).toBe("number");
  });

  test("CONTROL: a proxy that passes itself as the receiver draws the browser's Illegal invocation", () => {
    const bare = new Proxy(globalThis as unknown as Record<string, unknown>, {});
    expect(() => bare["crypto"]).toThrow(/Illegal invocation/);
  });

  test("the lend still refuses a write by name", () => {
    const lend = makeScopedWindowLend(() => {});
    expect(() => { lend["larProbe"] = 1; }).toThrow(/CapabilityRefused: window\.larProbe \(write\)/);
    expect("larProbe" in globalThis).toBe(false);
  });
});
