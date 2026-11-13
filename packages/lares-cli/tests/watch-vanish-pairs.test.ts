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
import { confirmedRenames, pairedDeletions } from "../src/commands/watch.js";

const arrived = (...hashes: string[]) => hashes.map((diskHash) => ({ diskHash, status: "new" }));

const vanished = (rows: Array<[string, string]>) => new Map(rows.map(([uri, syncedHash]) => [uri, { syncedHash, file: `/disk/${uri.split("/").pop()}.mem` }]));

describe("pairedDeletions — content pairs, and nothing else rides", () => {




  test("a source leaves the vanished set only where the island's summary names its re-link", () => {
    expect([...confirmedRenames({ renames: [{ fromUri: "lar:///x/a", toUri: "lar:///x/b" }], absent: [], declined: [] })]).toEqual(["lar:///x/a"]);
    // CONTROL: a summary that declined the pair, one naming no rename and no summary at all confirm nothing.
    expect([...confirmedRenames({ renames: [], absent: [], declined: ["lar:///x/a"] })]).toEqual([]);
    expect([...confirmedRenames({ renames: [], absent: ["lar:///x/a"], declined: [] })]).toEqual([]);
    expect([...confirmedRenames(undefined)]).toEqual([]);
  });

});

describe("the watcher's source holds no clock over a vanish and no fraction", () => {
  const src = readFileSync(new URL("../src/commands/watch.ts", import.meta.url), "utf8")
    .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  test("★ every wave the watcher settles rides unattended: no person stands behind it ★", () => {
    const sends = src.match(/settleIngest\(\{[^}]*\}/g) ?? [];
    expect(sends.length).toBeGreaterThan(0);
    for (const call of sends) expect(call).toMatch(/unattended: true/);
  });
  test("★ a carrier that stood off goes to the vessel's shore, where its alert rises ★", () => {
    expect(src).toMatch(/for \(const c of settled\.conflicts\) unsensed\.add\(c\.uri\)/);
  });
  test("no grace, no fraction, no monotonic or wall reading", () => {
    expect(src).not.toMatch(/delete-grace|delete-fraction|massDeleteFraction|performance\.now|Date\.now\(\)\s*-/);
    // The two timers that stand pace an edit's settle and the backend self-test; neither reads a vanish.
    expect(src.match(/setTimeout\(/g) ?? []).toHaveLength(2);
  });
});
