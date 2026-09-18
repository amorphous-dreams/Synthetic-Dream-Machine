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
import { carrierFiles } from "../src/carrier-files.js";

/**
 * ── THE EXEMPTION LIST STANDS EMPTY, AND NO MACHINERY KEEPS ITS SEAT WARM ───────────────────────
 * Three prose-bearing carriers once held out here — `living-grammar-palace`, `ffz-clock`,
 * `memetic-wikitext-sensorium` — on the reading that a wikilink inside a call body binds a phantom
 * the quote cannot cure. Measured 2026-09-13, each reports ZERO lost positionals: the wikilink mask
 * at `sigil-attrs.ts` reads `[[label|lar:///x]]` whole, and the strict-identifier rule reads a
 * `file.ts:24-30` citation whole. The hold-out answered a hazard neither carrier carries.
 *
 * THE WHOLE CORPUS STANDS UNDER THE LAW. A carrier that cannot meet it earns a ruling, never a row.
 */

const REPO = join(new URL("..", import.meta.url).pathname, "../..");

/** Every carrier the corpus stands, read once. */
function carriers(): Array<{ rel: string; text: string }> {
  return carrierFiles(REPO).map((rel) => ({ rel, text: readFileSync(join(REPO, rel), "utf8") }));
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
    let sites = 0;
    for (const { rel, text } of all) {
      // The shore answers the corpus-level question, fences and all — a fenced sigil opens nothing.
      for (const lost of lostPositionals(text)) {
        sites += lost.values.length;
        if (offenders.length < 12) offenders.push(`${rel}  ${lost.sigil.slice(0, 84)}`);
      }
    }
    expect(sites, `${sites} positional(s) reach a phantom parameter instead of their slot ` +
      `(no carrier holds out; fenced sigils open nothing):\n  ` +
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

  /**
   * ── THE COLON BINDS ONLY A STRICT IDENTIFIER, AND THE HAZARD READER MUST OBEY IT ────────────────
   * `parseMacroParameterAsAttribute` discards the name AND the separator where `:` follows anything
   * but `^[A-Za-z0-9\-_]+$` — "to avoid mis-parsing values like `$:/foo`" (TiddlyWiki5
   * `core/modules/parsers/parseutils.js:328-346`). Measured against that parser at 5.5.0:
   *
   *   <<~ x foo.ts:24-30>>            positional [0="x", 1="foo.ts:24-30"]
   *   <<~ x (foo.ts:24-30)>>          positional [0="x", 1="(foo.ts:24-30)"]
   *   <<~ loulou lar:///x>>           positional [0="loulou"]   named [lar="///x"]
   *
   * `readSigilAttrs` and `positionalsOf` already keep the rule; a hazard reader that skipped it
   * reported a phantom the parser never binds, and a carrier citing `file.ts:24-30` in free prose
   * drew a refusal for writing exactly what the parser reads whole.
   */
  test("★ a colon after a NON-identifier separates nothing — the slot fills ★", () => {
    expect(schemeShapedPositionals(" x foo.ts:24-30")).toEqual([]);
    expect(schemeShapedPositionals(" moves the-antigen ~ consulted by nothing (offering-antigen.ts:24-30)")).toEqual([]);
    expect(schemeShapedPositionals(" x $:/config/foo")).toEqual([]);
  });

  test("CONTROL — a STRICT identifier before the colon still steals the slot", () => {
    expect(schemeShapedPositionals(" loulou lar:///x")).toEqual(["lar:///x"]);
    expect(schemeShapedPositionals(" x also-strict_9:value")).toEqual(["also-strict_9:value"]);
  });
});
