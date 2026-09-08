/**
 * sigil-alignment — every sigil in this corpus reaches TiddlyWiki's procedure-call parser INTACT.
 *
 * ── THE LAW ──────────────────────────────────────────────────────────────────────────────────────
 * `param-name ":" value` is call syntax. A URI scheme spells with exactly the characters a parameter
 * name admits, so an unquoted `lar:///x` standing in a POSITIONAL slot binds a parameter named `lar`
 * and the positional receives nothing. Measured against TiddlyWiki 5.5.0:
 *
 *   <<~ loulou lar:///x>>     positional [0="loulou"]              named [lar="///x"]
 *   <<~ loulou "lar:///x">>   positional [0="loulou", 1="lar:///x"]
 *
 * `\widget ~loulou(p1:"" p2:"")` takes p1 POSITIONALLY, so the bare form cannot fill it.
 *
 * ── WHY THIS TEST WALKS THE CORPUS RATHER THAN A FIXTURE ─────────────────────────────────────────
 * A fixture pins the GRAMMAR; only the CORPUS pins the reader. This law is about what 700 carriers
 * actually write, and a fixture would have gone green while 2985 sites stood.
 *
 * It re-runs idempotently: it reads the tree, holds no state, and names every offender.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { schemeShapedPositionals, readSigilAttrs, sigilAttrValue, lostPositionals } from "../src/sigil-attrs.js";

/**
 * DECLARED EXEMPTIONS, each with the reason it stands. A list that only shrinks.
 *
 * A prose-bearing sigil carrying free PROSE puts a wikilink and a bold run inside a call body. TiddlyWiki
 * binds a phantom parameter off that prose, and quoting the address would break the wikilink that
 * already reads — so the cure is not a quote. Aligning prose-bearing sigils is a separate ruling.
 */
const PROSE_BEARING = [
  { file: "lararium/api/living-grammar-palace.mem", since: "2026-09-07" },
  { file: "lararium/mesh/ffz-clock.mem", since: "2026-09-07" },
  { file: "lares/api/memetic-wikitext-sensorium.mem", since: "2026-09-07" },
];

const REPO = join(new URL("..", import.meta.url).pathname, "../..");

/** Every carrier the corpus stands, read once. */
function carriers(): Array<{ rel: string; text: string }> {
  return execSync('git ls-files "bags/**/*.mem"', { cwd: REPO, encoding: "utf8" })
    .split("\n").filter(Boolean)
    .map((rel) => ({ rel, text: readFileSync(join(REPO, rel), "utf8") }));
}

describe("★ the alignment law, over the whole corpus ★", () => {
  const all = carriers();

  test("the corpus presents carriers", () => {
    // THE FLOOR IS THE INSTRUMENT. A walker that stopped seeing its subject would report the
    // cleanest run it has ever produced.
    expect(all.length).toBeGreaterThan(400);
  });

  test("★ no positional argument is lost to a scheme ★", () => {
    const offenders: string[] = [];
    let sites = 0, prose = 0;
    for (const { rel, text } of all) {
      if (PROSE_BEARING.some((e) => rel.endsWith(e.file))) { prose++; continue; }
      // The shore answers the corpus-level question, fences and all — a fenced sigil opens nothing.
      for (const lost of lostPositionals(text)) {
        sites += lost.values.length;
        if (offenders.length < 12) offenders.push(`${rel}  ${lost.sigil.slice(0, 84)}`);
      }
    }
    expect(sites, `${sites} positional(s) reach a phantom parameter instead of their slot ` +
      `(${prose} prose-bearing carriers held out; fenced sigils open nothing):\n  ` +
      offenders.join("\n  ")).toBe(0);
  });
});

describe("the law, stated on its own", () => {
  test("★ a quoted positional carrying a colon survives ★", () => {
    expect(schemeShapedPositionals(' loulou "lar:///ha.ka.ba/x"')).toEqual([]);
  });

  test("★ an unquoted one does not ★", () => {
    expect(schemeShapedPositionals(" loulou lar:///ha.ka.ba/x")).toEqual(["lar:///ha.ka.ba/x"]);
  });

  test("CONTROL — a positional with no colon needs nothing", () => {
    expect(schemeShapedPositionals(" ahu #/orient/ha-fields")).toEqual([]);
  });

  test("CONTROL — a NAMED parameter may carry any colon it likes", () => {
    // `to=lar:///d` fills a name; the colon inside its value separates nothing.
    expect(schemeShapedPositionals(" pranala #x from=? -> to=lar:///d family=code")).toEqual([]);
    expect(sigilAttrValue(" pranala #x from=? -> to=lar:///d", "to")).toBe("lar:///d");
  });

  test("CONTROL — the bearing arrow is not a positional", () => {
    expect(schemeShapedPositionals(" lares aim from=lar:///a -> to=lar:///b")).toEqual([]);
  });

  test("CONTROL — a typed value is left exactly as it stands", () => {
    expect(readSigilAttrs("season name=<<name>>")[0]!.kind).toBe("macro");
    expect(schemeShapedPositionals("season name=<<name>>")).toEqual([]);
  });
});
