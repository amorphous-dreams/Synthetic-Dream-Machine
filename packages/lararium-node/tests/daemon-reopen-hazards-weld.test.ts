/**
 * daemon-reopen-hazards-weld — every long-lived consumer of the daemon VM reaches the live island across a restart (a source weld).
 *
 * The survey (daemon-survey/luna-1) found captures that outlive a swap. The node vessel holds the facade, so a `daemonVm` capture
 * reaches the live island; what the facade cannot cure alone is (a) an ask in flight, (b) the seat settler's single `workerEa`
 * wait, (c) a fire-and-forget place from the worker-event bus that lands mid-swap. Each gets its door here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const SRC = readFileSync(join(__dirname, "..", "src", "open-node-vessel.ts"), "utf8");

describe("the node vessel's long-lived daemon consumers", () => {
  test("every host ask (seat-duty, store-door, three memory asks) builds through islandAsk; none keeps a raw VM or its own placeVerb lambda", () => {
    expect((SRC.match(/islandAsk\(daemonHolder\)\(/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(SRC).not.toMatch(/placeVerb: \(o\) => vm\.placeVerb\(\{ \.\.\.o, origin: "channel" \}\)/);
    expect(SRC).not.toMatch(/const vm = daemonVm;/);
  });

  test("the seat settler settles against the new island after a restart", () => {
    expect(SRC).toMatch(/daemonHolder\.onRestarted\(\(\) => \{[^}]*daemonVm\.workerEa\.then\(\(\) => seatSettler\.onFold\(\)/);
  });

  test("a worker event that lands mid-swap drops by name and never throws into the bus", () => {
    const sub = SRC.slice(SRC.indexOf("const subscribeWorkerEventsToDaemon"));
    expect(sub.slice(0, 900)).toMatch(/catch \(err\) \{ if \(!\(err instanceof DaemonRestarting\)\) throw err;/);
  });

  test("CONTROL: the instrument reads a missing door as red", () => {
    expect("const vm = daemonVm;").toMatch(/const vm = daemonVm;/);
  });
});
