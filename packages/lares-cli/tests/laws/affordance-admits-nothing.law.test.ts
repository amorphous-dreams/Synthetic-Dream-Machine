/**
 * W8 · NO DOOR ADMITS ON A CARRIER (DAM law 1: tags gather, ocaps authorize; lar:///ha.ka.ba/lares/api/pono/affordance#/head).
 *
 * Inputs: every source file that reads the affordance pack or the carrier reader. The pack may feed WORDS alone (help lines,
 * a brief, a tool description); no admission branch may read a pack or carrier field (`gate`, `signs`, a tag) to admit, refuse
 * or route. So the CLI's pack readers stand in three word functions (`helpLines`, `packedBrief`, `packedAccount`), and the in-VM face never names
 * a `gate` row in code. The seat's twin rides `test_affordance_skin.py`. Control: a planted admission branch reads red.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../../src");
const TW5 = resolve(HERE, "../../../lararium-tw5/src");

function* walk(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.name.endsWith(".ts")) yield full;
  }
}

const code = (text: string): string => text.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

/** The CLI files that import the pack, and the functions that call into it. */
const PACK_IMPORT = /from\s+"@lararium\/tw5\/affordance-pack"/;
const PACK_CALL = /\b(packDoor|packRoute|packRender|packTool|packDoors|affordancePack)\(/g;
const ALLOWED: Readonly<Record<string, readonly string[]>> = { "command-help.ts": ["helpLines"], "bin/lares.ts": ["packedBrief", "packedAccount"] };

/** Every pack call in one file that stands outside the functions allowed to feed words. */
function strayCalls(rel: string, text: string): string[] {
  const body = code(text);
  const allowed = ALLOWED[rel] ?? [];
  const out: string[] = [];
  for (const m of body.matchAll(PACK_CALL)) {
    const before = body.slice(0, m.index);
    const fn = [...before.matchAll(/function\s+(\w+)\s*\(/g)].at(-1)?.[1];
    if (!fn || !allowed.includes(fn)) out.push(`${rel}: ${m[1]}( outside ${allowed.join(" / ") || "any allowed function"}`);
  }
  return out;
}

/** An admission branch on a carrier's testimony: an `if`/ternary reading a `gate` or `signs` field off a row or the pack. */
const ADMITS = /(if\s*\(|\?)[^;\n]*\b(row|rows|carrier|pack|r)\b[^;\n]*\[\s*["'](gate|signs)["']\s*\]/;

describe("W8 · no door admits on a carrier", () => {
  test("★ the CLI reads the pack for words alone, in helpLines, packedBrief and packedAccount ★", () => {
    const stray: string[] = [];
    const importers: string[] = [];
    for (const f of walk(SRC)) {
      const text = readFileSync(f, "utf8");
      if (!PACK_IMPORT.test(text)) continue;
      const rel = relative(SRC, f);
      importers.push(rel);
      stray.push(...strayCalls(rel, text));
    }
    expect(importers.sort()).toEqual(Object.keys(ALLOWED).sort());
    expect(stray).toEqual([]);
  });

  test("★ the in-VM face and the reader branch on no gate row ★", () => {
    const files = [...walk(TW5)].filter((f) => /affordance-|afford-face|filters\/afford/.test(f));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((f) => ADMITS.test(code(readFileSync(f, "utf8")))).map((f) => relative(TW5, f))).toEqual([]);
  });

  test("CONTROL: a planted admission branch, and a planted pack read outside the word functions, both read red", () => {
    expect(ADMITS.test(`if (row["gate"] === "hand") return refuse();`)).toBe(true);
    expect(strayCalls("bin/lares.ts", `function admit(a) { return packDoor(a) !== undefined; }`)).toHaveLength(1);
    expect(strayCalls("bin/lares.ts", `function packedBrief(d) { return packDoor(d)?.brief; }`)).toEqual([]);
  });
});
