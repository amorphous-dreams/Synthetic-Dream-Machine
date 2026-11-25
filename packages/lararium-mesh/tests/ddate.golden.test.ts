/**
 * ddate golden — the core answers what the host's `ddate` answered, row for row.
 *
 * `fixtures/ddate-golden.json` holds one capture of the host's own binary (Ubuntu ddate 0.2.2): every day of ten
 * years under a field-by-field format, every day of the leap year under the St. Tib's span and the holyday words,
 * every ordinal of a season, the BCE reading, X-Day's neighbourhood, and the refusals. The test reads the capture;
 * it never runs the binary.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { X_DAY_GREGORIAN, daysUntilXDay, readDdate } from "../src/ddate.js";
import type { EntropyDoor } from "../src/entropy-door.js";

type Row = readonly [readonly string[], number, string];
const golden = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/ddate-golden.json", import.meta.url)), "utf8")) as { source: string; rows: Row[]; xrows: [[number, number, number], number][] };

/** Whole days between two calendar dates by the platform's own proleptic Gregorian arithmetic: an oracle apart from the core. */
function exactDaysBetween(from: { year: number; month: number; day: number }, to: { year: number; month: number; day: number }): number {
  const at = (d: { year: number; month: number; day: number }): number => new Date(0).setUTCFullYear(d.year, d.month - 1, d.day);
  return Math.round((at(to) - at(from)) / 86_400_000);
}

/** A door a golden format never draws from: a draw here means the format named `%.`. */
const SHUT: EntropyDoor = { source: "test:shut", fill: () => { throw new Error("a golden row drew entropy"); } };
const TODAY = { year: 2026, month: 11, day: 20 };

describe("ddate golden — the host's capture", () => {
  test("the capture names its source and holds its rows", () => {
    expect(golden.source).toMatch(/^ddate 0\.2\.2/);
    expect(golden.rows.length).toBeGreaterThan(5000);
  });

  test("every captured row reads the same in the core", () => {
    const wrong: string[] = [];
    for (const [argv, status, out] of golden.rows) {
      const got = readDdate(argv, TODAY, SHUT);
      const want = status === 0 ? `ok ${out}` : status === 1 ? "usage" : "invalid";
      const have = got.kind === "ok" ? `ok ${got.text}` : got.kind;
      if (have !== want) wrong.push(`${JSON.stringify(argv)}: host ${JSON.stringify(want)}, core ${JSON.stringify(have)}`);
    }
    expect(wrong.slice(0, 20)).toEqual([]);
  });

  test("%X counts exact days to X-Day, and equals the host's count wherever the host's own count runs exact", () => {
    expect(golden.xrows.length).toBeGreaterThan(100);
    const wrong: string[] = [];
    let hostEqual = 0;
    let hostHigh = 0;
    for (const [[day, month, year], host] of golden.xrows) {
      const date = { year, month, day };
      const core = daysUntilXDay(date);
      const exact = exactDaysBetween(date, X_DAY_GREGORIAN);
      if (core !== exact) wrong.push(`${day}/${month}/${year}: core ${core}, exact ${exact}`);
      if (host === core) hostEqual += 1;
      else if (host === core + 1) hostHigh += 1;
      else wrong.push(`${day}/${month}/${year}: host ${host}, core ${core}`);
      if (year >= 8655 && year <= 8664 && host !== core) wrong.push(`${day}/${month}/${year}: the host's exact window reads ${host}, core ${core}`);
    }
    expect(wrong.slice(0, 20)).toEqual([]);
    // The host runs one day high where its leap-day approximation misses; the core never does. Both kinds stand in the capture.
    expect(hostEqual).toBeGreaterThan(70);
    expect(hostHigh).toBeGreaterThan(20);
  });
});
