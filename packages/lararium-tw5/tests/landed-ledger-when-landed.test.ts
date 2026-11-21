/**
 * LandedLedger.whenLanded — the landing as an event, where the wiki-shore tests polled the ledger in 5 ms turns
 * under a 2 s cap. No fake timers: the "too late" moment belongs to the test, carried as a promise.
 */
import { describe, expect, it } from "vitest";
import { LandedLedger, LandedNeverError, type LandedEntry } from "../src/landed-ledger.js";

const turns = async (n: number): Promise<void> => { for (let i = 0; i < n; i++) await new Promise<void>((resolve) => setImmediate(resolve)); };
const entry = (bag: string, heads: string[] = ["h1"]): LandedEntry => ({ tiddler: { title: "x" }, bag, heads });

describe("LandedLedger.whenLanded", () => {
  it("RED: a landing held past the old poll's cap still resolves the waiter", async () => {
    const ledger = new LandedLedger();
    const landed = ledger.whenLanded("x", (e) => e.bag === "working");
    await turns(60); // past the 20-turn poll cap the control below keeps
    ledger.set("x", entry("working"));
    await expect(landed).resolves.toMatchObject({ bag: "working" });
  });

  it("CONTROL: the poll form with a 20-turn cap misses the same held landing", async () => {
    const ledger = new LandedLedger();
    const landing = turns(60).then(() => ledger.set("x", entry("working")));
    let polls = 0;
    for (; polls < 20 && ledger.landedOf("x")?.bag !== "working"; polls++) await turns(1);
    expect(ledger.landedOf("x")?.bag, "the poll gave up before the landing").toBeUndefined();
    await landing;
  });

  it("an entry already satisfying the predicate resolves at once", async () => {
    const ledger = new LandedLedger();
    ledger.set("x", entry("canon"));
    await expect(ledger.whenLanded("x")).resolves.toMatchObject({ bag: "canon" });
  });

  it("a set that fails the predicate leaves the waiter pending until one satisfies it", async () => {
    const ledger = new LandedLedger();
    const landed = ledger.whenLanded("x", (e) => e.bag === "working");
    ledger.set("x", entry("canon"));
    await turns(4);
    ledger.set("x", entry("working"));
    await expect(landed).resolves.toMatchObject({ bag: "working" });
  });

  it("CONTROL: a title that never lands refuses by name when the deadline settles", async () => {
    const ledger = new LandedLedger();
    const deadline = turns(10);
    const landed = ledger.whenLanded("never", undefined, deadline);
    await expect(landed).rejects.toBeInstanceOf(LandedNeverError);
    await expect(landed).rejects.toThrow(/never/);
  });

  it("clear() rejects pending waiters by name", async () => {
    const ledger = new LandedLedger();
    const landed = ledger.whenLanded("x");
    ledger.clear();
    await expect(landed).rejects.toBeInstanceOf(LandedNeverError);
    await expect(landed).rejects.toThrow(/cleared/);
  });

  it("a landing after the deadline leaves the settled waiter refused, and later sets raise nothing", async () => {
    const ledger = new LandedLedger();
    const landed = ledger.whenLanded("x", undefined, turns(2));
    await expect(landed).rejects.toBeInstanceOf(LandedNeverError);
    expect(() => ledger.set("x", entry("working"))).not.toThrow();
  });
});
