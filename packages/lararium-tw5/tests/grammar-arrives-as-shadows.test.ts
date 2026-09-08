/**
 * The grammar arrives as SHADOWS, and its reader must say so.
 *
 * ── THE FILTER THAT FOUND NOTHING ───────────────────────────────────────────────────────────────
 * Eighty-one tiddlers carry this grammar — every sigil's patterns, its kind, its aliases, its close
 * pattern, the families. They ride inside the plugin, which makes every one of them a SHADOW.
 *
 * TiddlyWiki's `[tag[…]]` reads the tiddler store and NOT the shadow store. So the loader's
 * `[tag[SharktoothSigil]]` matched zero tiddlers in every wiki that boots the grammar as a plugin —
 * which is every vessel — and `getGrammar()` handed back `null` from its own `sigils.length === 0`
 * guard, silently, forever. The hardcoded bootstrap scans carried the whole render.
 *
 * Nothing read red. The bootstrap list covers the boot-critical sigils by design, so a wiki with NO
 * grammar loaded renders `ahu`, `pranala` and `kahea` exactly like a wiki with all of it — and every
 * self-hosted extension beyond those three (closers, child slots, inline names, the vocabulary cid)
 * was simply absent, in the shape of a feature nobody had reached for yet.
 *
 * TiddlyWiki's core says the correct spelling out loud in its own global-import filter:
 * `[all[shadows+tiddlers]tag[$:/tags/Global]]`. Shadows FIRST, so a non-shadow override of the same
 * title wins — which is the ordering the vocabulary-cid already documented and could never get.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

const TAG = "lar:///ha.ka.ba/tags/SharktoothSigil";
/** The rendered `count[]` of a filter, as a number — read from the TEXT, never from the markup. */
const countOf = (e: TW5Engine, filter: string): number => {
  // `count[]` rides INSIDE the run — appended after the closing bracket it starts a second run and
  // renders nothing, which a caller reading a number would take for "the filter found none".
  const text = renderWikitext(e, `{{{ ${filter} }}}`).replace(/<[^>]*>/g, "").trim();
  return /^\d+$/.test(text) ? Number(text) : -1;
};

describe.skipIf(wikiSkip)(`the grammar's own tiddlers${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);

  test("CONTROL — the grammar rides as shadows, and the plain store holds none of it", () => {
    // If this ever reports a non-zero count, the grammar stopped being plugin-borne and the law
    // below tests nothing — the control fails first, and says which half moved.
    expect(countOf(e, `[tag[${TAG}]count[]]`), "the grammar left the plugin").toBe(0);
    expect(countOf(e, `[all[shadows+tiddlers]tag[${TAG}]count[]]`)).toBeGreaterThan(40);
  });

  test("★ every reader of the grammar tag reaches the shadow store ★", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const dir = new URL("../src/", import.meta.url).pathname;
    const offenders: string[] = [];
    const walk = (d: string): void => {
      for (const n of readdirSync(d, { withFileTypes: true })) {
        if (n.isDirectory()) { walk(`${d}${n.name}/`); continue; }
        // a generated blob carries the whole plugin as one string — it declares no filter of its own
        if (!n.name.endsWith(".ts") || n.name.endsWith(".generated.ts")) continue;
        for (const line of readFileSync(d + n.name, "utf8").split("\n")) {
          // a tag filter over the grammar tag that never names the shadow store reads an empty wiki
          if (/\[tag\[\$\{GRAMMAR_TAG\}\]\]|\[tag\[lar:\/\/\/ha\.ka\.ba\/tags\//.test(line)) {
            offenders.push(`${n.name}: ${line.trim()}`);
          }
        }
      }
    };
    walk(dir);
    expect(offenders, "a plugin-borne tiddler answers to `all[shadows+tiddlers]` and to nothing else")
      .toEqual([]);
  });
});
