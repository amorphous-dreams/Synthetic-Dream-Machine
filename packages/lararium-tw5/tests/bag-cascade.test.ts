/**
 * bag-cascade — ONE walk of the in-wiki bag-paths cascade, read by every hand that asks where a title
 * lands: the island adaptor's outbound save and delete, and the backstop's keep-check before a fence.
 *
 * The walk answers one of THREE verdicts, and they mean different things: a rule ROUTES the title to a
 * slot, a rule WITHHOLDS it (`[…]then[]`, the empty operand), or no rule reaches it at all — a router
 * GAP. Each caller acts on the three in its own way; the walk itself never collapses them.
 *
 * Driven over the REAL TiddlyWiki filter engine: a fake router is exactly the instrument that would
 * bless a rule the engine parses differently.
 */

import { describe, expect, test, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { bootTestWiki, wikiSkip, skipNote, REPO } from "./test-wiki.js";
import { BAG_PATHS_CONFIG, routeBag, type CascadeWiki } from "../src/bag-cascade.js";
import type { TW5Engine } from "../src/tw5-vm.js";

const SLOT = "lar:///ha.ka.ba/wikis/test/working";

describe.skipIf(wikiSkip)(`routeBag — the three verdicts of the one cascade walk${skipNote}`, () => {
  let engine: TW5Engine;
  let wiki: CascadeWiki & { addTiddler(t: unknown): void; deleteTiddler(t: string): void };
  let Tiddler: new (f: unknown) => unknown;

  beforeAll(async () => {
    engine = await bootTestWiki();
    wiki = engine.$tw.wiki as never;
    Tiddler = (engine.$tw as never as { Tiddler: new (f: unknown) => unknown }).Tiddler;
  }, 120_000);

  const cascade = (rules: readonly string[]): void => {
    wiki.addTiddler(new Tiddler({ title: BAG_PATHS_CONFIG, text: rules.join("\n") }));
  };

  test("a rule that names a slot ROUTES the title there", () => {
    cascade([`[prefix[lar:]then[${SLOT}]]`]);
    expect(routeBag(wiki, "lar:///t/x")).toEqual({ kind: "slot", uri: SLOT });
  });

  test("the empty-operand form WITHHOLDS, and names the rule that did", () => {
    cascade(["[match[lar:///t/x]then[]]", `[prefix[lar:]then[${SLOT}]]`]);
    expect(routeBag(wiki, "lar:///t/x")).toEqual({ kind: "withheld", rule: "[match[lar:///t/x]then[]]" });
    // CONTROL — the withholding names its subject; a sibling falls through to the catch-all.
    expect(routeBag(wiki, "lar:///t/y")).toEqual({ kind: "slot", uri: SLOT });
  });

  /**
   * A TITLE LITERAL IGNORES ITS INPUT. `[[x]then[]]` reads like "withhold x" but its first step
   * yields `x` whatever title the source carries, so it withholds EVERY title and the catch-all
   * below it never runs. A withholding names its subject through an operator that reads the input
   * (`match`, `prefix`), as the shipped cascade does.
   */
  test("the title-literal form withholds every title — a subject is named through `match`", () => {
    cascade(["[[lar:///t/x]then[]]", `[prefix[lar:]then[${SLOT}]]`]);
    expect(routeBag(wiki, "lar:///t/y")).toEqual({ kind: "withheld", rule: "[[lar:///t/x]then[]]" });
  });

  test("a title no rule reaches is a GAP, never a withholding", () => {
    cascade([`[prefix[lar:]then[${SLOT}]]`]);
    expect(routeBag(wiki, "Shopping List").kind).toBe("gap");
  });

  test("a wiki with no cascade tiddler is a GAP", () => {
    wiki.deleteTiddler(BAG_PATHS_CONFIG);
    // The plugin's shadow may stand behind the deleted override; read the absent case off a bare wiki.
    const bare: CascadeWiki = { getTiddler: () => undefined, getTiddlerText: (_t, f = "") => f, filterTiddlers: () => [] };
    expect(routeBag(bare, "lar:///t/x").kind).toBe("gap");
  });
});

test("a wiki that exposes no filter engine is a GAP", () => {
  expect(routeBag({ getTiddler: () => undefined }, "lar:///t/x").kind).toBe("gap");
});

/** The cascade's address is spelled in ONE source file; every walker imports it from there. */
test("★ `config/bag-paths` is spelled once across packages/*/src ★", () => {
  const needle = 'config/bag-paths"';
  const hits: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!/\.(ts|js|mjs)$/.test(e.name) || e.name.endsWith(".d.ts")) continue;
      const count = readFileSync(full, "utf8").split(needle).length - 1;
      for (let i = 0; i < count; i++) hits.push(path.relative(REPO, full));
    }
  };
  const packages = path.join(REPO, "packages");
  for (const pkg of readdirSync(packages, { withFileTypes: true })) {
    const src = path.join(packages, pkg.name, "src");
    if (pkg.isDirectory() && readdirSync(path.join(packages, pkg.name)).includes("src")) walk(src);
  }
  expect(hits).toEqual(["packages/lararium-tw5/src/bag-cascade.ts"]);
});
