/**
 * connect-buffer — a SharedWorker's connect events arrive while its entry still awaits the island module; the entry's
 * listener stands in its synchronous top level and holds each port until the runtime opens it.
 *
 *   RED:     a port that connects before `open` is replayed, in order, once `open` runs (the module is missing on this tree).
 *   CONTROL: a port that connects after `open` passes straight through, and a second `open` replays nothing twice.
 */
import { describe, expect, test } from "vitest";
import { makeConnectBuffer } from "../src/connect-buffer.js";

describe("the connect buffer", () => {
  test("RED: ports that connect before the runtime opens are replayed in order; CONTROL: later ports pass straight through, nothing replays twice", () => {
    const buffer = makeConnectBuffer<string>();
    buffer.accept("a"); buffer.accept("b");
    const seen: string[] = [];
    buffer.open((port) => seen.push(port));
    expect(seen).toEqual(["a", "b"]);
    buffer.accept("c");
    expect(seen).toEqual(["a", "b", "c"]);
    buffer.open((port) => seen.push(`again:${port}`));
    expect(seen).toEqual(["a", "b", "c"]);
  });
});
