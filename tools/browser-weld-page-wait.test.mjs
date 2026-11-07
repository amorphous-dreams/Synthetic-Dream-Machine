/**
 * browser-weld page waits — every weld wait ends on the page's own event or a named LIVENESS bound (clock-sweep land
 * read: W2's `{ timeout: 0 }` projection wait and the `unknown` render-id witness hung on a page alive and silent).
 * A fake page stands in for Playwright's: no browser, no web surface.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { awaitPage, waitForWitness } from "./browser-weld/page-wait.mjs";

/** A fake page: `waitForFunction` answers what `answer(call)` gives (a value, or never), honouring its timeout. */
function fakePage(answer) {
  const listeners = { pageerror: new Set(), console: new Set() };
  let calls = 0;
  return {
    calls: () => calls,
    on: (ev, fn) => listeners[ev].add(fn),
    off: (ev, fn) => listeners[ev].delete(fn),
    fire: (ev, arg) => { for (const fn of [...listeners[ev]]) fn(arg); },
    listening: (ev) => listeners[ev].size,
    waitForFunction: (_fn, arg, { timeout }) => new Promise((resolve, reject) => {
      const n = calls++;
      const value = answer(n, arg);
      if (value !== undefined) { setTimeout(() => resolve({ jsonValue: async () => value }), value?.delay ?? 0); return; }
      if (timeout > 0) setTimeout(() => { const e = new Error(`page.waitForFunction: Timeout ${timeout}ms exceeded.`); e.name = "TimeoutError"; reject(e); }, timeout);
    }),
  };
}

test("RED: a page alive and silent ends the projection wait as a named LIVENESS refusal", async () => {
  const page = fakePage(() => undefined);
  const out = await awaitPage(page, () => false, undefined, { livenessMs: 50, what: "the projection's first frame" });
  assert.match(out.refused, /^LIVENESS: the projection's first frame/);
  assert.equal(page.listening("pageerror"), 0);
});

test("CONTROL: the page's verdict ends the wait with its value; a page error ends it at once by name", async () => {
  assert.deepEqual(await awaitPage(fakePage(() => ({ done: "<p data-lar-rid>" })), () => false, undefined, { livenessMs: 50, what: "x" }), { value: "<p data-lar-rid>" });
  const page = fakePage(() => undefined);
  const waiting = awaitPage(page, () => false, undefined, { livenessMs: 200, what: "x" });
  page.fire("pageerror", new Error("boom"));
  assert.deepEqual(await waiting, { refused: "pageerror: boom" });
});

test("CONTROL: a boot advancing through its phases renews the bound past it; a stall after the last phase refuses", async () => {
  // three phases 30 ms apart under a 50 ms bound (90 ms in all), then arrival
  const advancing = fakePage((n, { seen }) => n < 3 ? { progress: n + 1, delay: 30 } : { done: "arrived", delay: 30 });
  assert.deepEqual(await awaitPage(advancing, () => false, undefined, { livenessMs: 50, what: "the vessel boot" }), { value: "arrived" });
  const stalls = fakePage((n) => n < 2 ? { progress: n + 1, delay: 10 } : undefined);
  assert.match((await awaitPage(stalls, () => false, undefined, { livenessMs: 50, what: "the vessel boot" })).refused, /^LIVENESS: the vessel boot/);
});

test("RED: the unknown render-id witness on a page that never answers ends false at its LIVENESS bound, named", async () => {
  const lines = [];
  const page = fakePage(() => undefined);
  const t0 = performance.now();
  assert.equal(await waitForWitness(page, "unknown", 0, "rid", undefined, { livenessMs: 50, log: (l) => lines.push(l) }), false);
  assert.ok(performance.now() - t0 < 2_000);
  assert.match(lines.join("\n"), /LIVENESS: the unknown witness/);
});

test("CONTROL: an answered witness reads true before its bound", async () => {
  const lines = [];
  assert.equal(await waitForWitness(fakePage(() => ({ arrived: true })), "unknown", 0, "rid", undefined, { livenessMs: 5_000, log: (l) => lines.push(l) }), true);
  assert.deepEqual(lines, []);
});
