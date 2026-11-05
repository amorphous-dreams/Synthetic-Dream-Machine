/**
 * Open fields, over generated names: a wiki operator names a field anything and gives it any value, and the
 * house reads it back whole and shows it neutrally.
 *
 * L-open-1 · any field name and any value (string · number · list · inline table) survives a TOML parse unchanged
 * L-open-2 · the meta panel hides only the names its own tiers already show, so a generated name always lands in the raw tier
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import "./fixed-seed.js";
import { describe, expect } from "vitest";
import { fc, test } from "@fast-check/vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTaploFields } from "@lararium/tw5";

const HERE = dirname(fileURLToPath(import.meta.url));
const PANEL = join(HERE, "../../../../bags/lararium/ha.ka.ba/lararium/tw5/ui/meta-panel.mem");

const keyArb = fc.stringMatching(/^[a-z][a-z0-9]{0,9}$/);
const strArb = fc.stringMatching(/^[A-Za-z0-9 .,_-]{0,20}$/);
type Val = { kind: "str"; v: string } | { kind: "int"; v: number } | { kind: "list"; v: string[] } | { kind: "table"; sub: string; v: string };
const valArb: fc.Arbitrary<Val> = fc.oneof(
  strArb.map((v) => ({ kind: "str" as const, v })),
  fc.integer({ min: -1000, max: 1000 }).map((v) => ({ kind: "int" as const, v })),
  fc.array(strArb, { maxLength: 4 }).map((v) => ({ kind: "list" as const, v })),
  fc.tuple(keyArb, strArb).map(([sub, v]) => ({ kind: "table" as const, sub, v })),
);

const toToml = (k: string, x: Val): string =>
  x.kind === "str" ? `${k} = ${JSON.stringify(x.v)}`
  : x.kind === "int" ? `${k} = ${x.v}`
  : x.kind === "list" ? `${k} = [${x.v.map((s) => JSON.stringify(s)).join(", ")}]`
  : `${k} = { ${x.sub} = ${JSON.stringify(x.v)} }`;
const expected = (k: string, x: Val): Record<string, string | string[]> =>
  x.kind === "str" ? { [k]: x.v } : x.kind === "int" ? { [k]: String(x.v) } : x.kind === "list" ? { [k]: x.v } : { [`${k}-${x.sub}`]: x.v };

describe("open fields", () => {
  test.prop([fc.uniqueArray(fc.tuple(keyArb, valArb), { selector: ([k]) => k, maxLength: 8 })])(
    "L-open-1 · every generated field survives a TOML parse unchanged",
    (entries) => {
      const want = Object.assign({}, ...entries.map(([k, x]) => expected(k, x)));
      const got = parseTaploFields(entries.map(([k, x]) => toToml(k, x)).join("\n") + "\n");
      expect(got).toEqual(want);
    },
  );

  const panel = readFileSync(PANEL, "utf8");
  const hidden = [...(panel.match(/\[fields\[\][^"]*\]/)?.[0] ?? "").matchAll(/!match\[([^\]]+)\]/g)].map((m) => m[1]!);
  const listed = (name: string): string[] => [...panel.matchAll(new RegExp(`^${name} = \\[([^\\]]*)\\]`, "gm"))]
    .flatMap((m) => [...m[1]!.matchAll(/"([^"]+)"/g)].map((q) => q[1]!));
  const shownElsewhere = new Set([...listed("tier1"), ...listed("tier2"), ...listed("tier3"), ...listed("exclude")]);

  test("L-open-2 · the raw tier hides only names the panel's other tiers or plumbing already show", () => {
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.filter((h) => !shownElsewhere.has(h))).toEqual([]);
  });

  test.prop([keyArb])("L-open-2 · a generated name outside the declared tiers lands in the raw tier", (name) => {
    fc.pre(!shownElsewhere.has(name));
    expect(hidden).not.toContain(name);
  });
});
