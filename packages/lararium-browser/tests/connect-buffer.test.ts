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


test("RED: a replay failure reports the error and still serves the next port; CONTROL: a nonthrowing handler serves all in order", () => {
  // Round 3b adds the optional error callback; this type describes that contract ahead of the implementation.
  const makeBuffer = makeConnectBuffer as <T>(onError?: (error: unknown) => void) => ReturnType<typeof makeConnectBuffer<T>>;
  const control = makeBuffer<string>();
  const ordered: string[] = [];
  control.accept("a"); control.accept("b");
  control.open((port) => ordered.push(port));
  control.accept("c");
  expect(ordered).toEqual(["a", "b", "c"]);

  const errors: unknown[] = [], seen: string[] = [];
  const failure = new Error("first replay failed");
  const buffer = makeBuffer<string>((error) => errors.push(error));
  buffer.accept("a"); buffer.accept("b");
  buffer.open((port) => { seen.push(port); if (port === "a") throw failure; });
  expect(seen).toEqual(["a", "b"]);
  expect(errors).toEqual([failure]);
  buffer.accept("c");
  expect(seen).toEqual(["a", "b", "c"]);


});

test("RED: a failure after open reaches onError and later ports still pass", () => {
  const makeBuffer = makeConnectBuffer as <T>(onError?: (error: unknown) => void) => ReturnType<typeof makeConnectBuffer<T>>;
  const errors: unknown[] = [], seen: string[] = [], failure = new Error("live failure");
  const buffer = makeBuffer<string>((error) => errors.push(error));
  buffer.open((port) => { if (port === "a") throw failure; seen.push(port); });
  buffer.accept("a"); buffer.accept("b");
  expect(errors).toEqual([failure]);
  expect(seen).toEqual(["b"]);
});

describe("a SharedWorker with a late runtime", () => {
  test("RED (measured: a connect before a late listener is lost); CONTROL: the buffered entry greets a client that connected during its slow start", async () => {
    const worker = new SharedWorker(new URL("./fixtures/buffered-shared.worker.ts", import.meta.url), { type: "module", name: `buffered-${crypto.randomUUID()}` });
    const greeting = await new Promise<unknown>((resolve) => {
      worker.port.addEventListener("message", (event) => resolve(event.data), { once: true });
      worker.port.start();
    });
    expect(greeting).toEqual({ type: "ready" });
  }, 20_000);

  test("RED (the shim's dynamic import is the same gap); CONTROL: a shim entry that listens first greets a client that connected during the slow import", async () => {
    const worker = new SharedWorker(new URL("./fixtures/shim-shared.worker.ts", import.meta.url), { type: "module", name: `shim-${crypto.randomUUID()}` });
    const greeting = await new Promise<unknown>((resolve) => {
      worker.port.addEventListener("message", (event) => resolve(event.data), { once: true });
      worker.port.start();
    });
    expect(greeting).toEqual({ type: "ready" });
  }, 20_000);
});
