/**
 * THE WATCHER TOMBSTONES NOTHING BY ITSELF, AND NO CLOCK DECIDES.
 *
 * A vanished file may name a delete, a branch switch, a checkout or a slip, and no span of waiting tells
 * them apart. `pairedDeletions` is the one decision the watcher's drain makes over its vanished set: an
 * address rides a wave only as a RENAME'S SOURCE, paired by content, one vanished address to one arrived
 * file. Every other vanished address rides nowhere, however long it has stood vanished.
 *
 * Controls: an ambiguous pair on either side sends nothing; the source file reads no timer and no
 * deletion fraction.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { pairedDeletions } from "../src/commands/watch.js";

const vanished = (rows: Array<[string, string]>) => new Map(rows.map(([uri, syncedHash]) => [uri, { syncedHash, file: `/disk/${uri.split("/").pop()}.mem` }]));

describe("pairedDeletions — content pairs, and nothing else rides", () => {
  test("a vanished address with no arrival of its content rides nowhere", () => {
    expect(pairedDeletions(vanished([["lar:///x/a", "h-a"], ["lar:///x/b", "h-b"]]), [])).toEqual([]);
    expect(pairedDeletions(vanished([["lar:///x/a", "h-a"]]), [{ diskHash: "h-other" }])).toEqual([]);
  });

  test("one vanished address and one arrived file sharing a hash ride together, with the path the watcher saw leave", () => {
    expect(pairedDeletions(vanished([["lar:///x/a", "h-a"], ["lar:///x/b", "h-b"]]), [{ diskHash: "h-a" }, { diskHash: "h-new" }]))
      .toEqual([{ uri: "lar:///x/a", syncedHash: "h-a", file: "/disk/a.mem" }]);
  });

  test("CONTROL: two arrivals of one content, or two vanished addresses holding it, pair with nothing", () => {
    expect(pairedDeletions(vanished([["lar:///x/a", "h-a"]]), [{ diskHash: "h-a" }, { diskHash: "h-a" }])).toEqual([]);
    expect(pairedDeletions(vanished([["lar:///x/a", "h-a"], ["lar:///x/twin", "h-a"]]), [{ diskHash: "h-a" }])).toEqual([]);
  });

  test("a mass vanish sends no deletion at all", () => {
    const many = vanished(Array.from({ length: 500 }, (_, i) => [`lar:///x/c${i}`, `h-${i}`] as [string, string]));
    expect(pairedDeletions(many, [{ diskHash: "h-unrelated" }])).toEqual([]);
  });
});

describe("the watcher's source holds no clock over a vanish and no fraction", () => {
  const src = readFileSync(new URL("../src/commands/watch.ts", import.meta.url), "utf8")
    .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  test("no grace, no fraction, no monotonic or wall reading", () => {
    expect(src).not.toMatch(/delete-grace|delete-fraction|massDeleteFraction|performance\.now|Date\.now\(\)\s*-/);
    // The two timers that stand pace an edit's settle and the backend self-test; neither reads a vanish.
    expect(src.match(/setTimeout\(/g) ?? []).toHaveLength(2);
  });
});
