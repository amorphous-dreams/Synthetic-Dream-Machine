/**
 * SOURCE-SHAPE PIN. The kernel's teardown delivers the wiki's queued `change` dispatch to the shore before it
 * unhooks the bridge, so a hand typed in the same tick as teardown reaches `stop()` as a marked title. The pin
 * reads the kernel source and asserts the order of the three steps; it does not stand the kernel.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("kernel teardown order", () => {
  test("the wiki's queued dispatch is awaited before the bridge unhooks and the adaptor stops", () => {
    const source = readFileSync(new URL("../src/sovereign-kernel.ts", import.meta.url), "utf8");
    const body = source.slice(source.indexOf("async function _handleTeardown"));
    const deliver = body.indexOf("await _adaptor.awaitWikiDispatch()");
    const unhook = body.indexOf("_bridgeUnsub?.()");
    const stop = body.indexOf("await _adaptor.stop()");
    expect(deliver).toBeGreaterThan(-1);
    expect(deliver).toBeLessThan(unhook);
    expect(unhook).toBeLessThan(stop);
  });

  test("the adaptor drains before the receipt capability closes normally", () => {
    const source = readFileSync(new URL("../src/sovereign-kernel.ts", import.meta.url), "utf8");
    const body = source.slice(source.indexOf("async function _handleTeardown"));
    const close = body.indexOf("receipt?.close()");
    const stop = body.indexOf("await _adaptor.stop()");
    expect(close).toBeGreaterThan(-1);
    expect(stop).toBeGreaterThan(-1);
    expect(stop).toBeLessThan(close);
  });
});
