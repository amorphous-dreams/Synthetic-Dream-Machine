/**
 * grammar-heads — THE ONE PLACE THAT ANSWERS WHICH HEADS THE GRAMMAR KNOWS.
 *
 * ── FOUR READERS, FOUR SPELLINGS ────────────────────────────────────────────────────────────────
 * `carrier-head` collapsed nine spellings of the framing bearing; `sigil-attrs` five of the parameter
 * question; `carrier-files` twenty-three of "what is the corpus". This answers the fourth and last:
 * WHICH HEADS CAN A `<<~ …>>` CALL WEAR? Four readers each rebuilt it — two inside the VM off the
 * tag, one off the packed plugin's tiddler titles, one off `ls tiddlers/sigil-*.tid`.
 *
 * ── A HEAD IS WHAT A CALL WEARS, NEVER A FILENAME ───────────────────────────────────────────────
 * Read off the filename, the shelf reports EIGHTY-SEVEN heads. Read off the patterns a call must
 * match, it reports SEVENTY-FOUR. `sigil-frame-etx`, `sigil-dispatcher` and the family indexes name
 * tiddlers no `<<~ …>>` call ever spells, and a reader counting files swears them into the grammar.
 * Measured: the first census this house took of the harvester's coverage reported 87 for that reason.
 *
 * ── THE VM BREATHES, OR THE PLUGIN ANSWERS — AND NEVER A THIRD DOOR ─────────────────────────────
 * RULED: a reader reaches the tag inside the VM wherever a wiki holds the grammar. ONE fallback
 * stands beside it, for a reader whose wiki holds no grammar — a witness booting vanilla TiddlyWiki
 * as its parse oracle, or a turn capture running while no daemon breathes. That fallback FAILS
 * GRACEFULLY: a plugin it cannot read yields an empty set, never a throw, because a capture that
 * cannot name the grammar must still record the turn.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { TW5Engine } from "../src/tw5-vm.js";
import { grammarHeads, grammarHeadsFromPlugin } from "../src/grammar-heads.js";
import { bootTestWiki, CORE_PATH, wikiSkip, skipNote } from "./test-wiki.js";
import PLUGIN from "../plugins/lares-memetic-wikitext.json" with { type: "json" };

describe.skipIf(wikiSkip)(`grammar-heads — one door, two ways in${skipNote}`, () => {
  let withGrammar: TW5Engine;
  let bare: TW5Engine;
  beforeAll(async () => {
    withGrammar = await bootTestWiki();
    bare = new TW5Engine();
    await bare.boot(new Uint8Array(readFileSync(CORE_PATH)));
  }, 60_000);

  test("CONTROL — a wiki holding the grammar finds heads", () => {
    expect(grammarHeads(withGrammar.wiki).size).toBeGreaterThan(40);
  });

  test("★ a head reads off the PATTERN, never the filename ★", () => {
    const heads = grammarHeads(withGrammar.wiki);
    // Every one of these names a tiddler; none names a head a call can wear.
    for (const notAHead of ["frame-etx", "frame-soh", "dispatcher", "toml"]) {
      expect(heads.has(notAHead), `${notAHead} names a tiddler, never a <<~ …>> head`).toBe(false);
    }
    for (const head of ["has", "scale", "stage", "ahu", "loulou"]) {
      expect(heads.has(head), `${head} names a head a call wears`).toBe(true);
    }
  });

  test("★ THE ONE FALLBACK reads the same grammar as the VM ★", () => {
    const fromVm = [...grammarHeads(withGrammar.wiki)].sort();
    const fromPlugin = [...grammarHeadsFromPlugin(PLUGIN as never)].sort();
    expect(fromPlugin, "the two doors disagree — a reader picks its answer by which it opened").toEqual(fromVm);
  });

  test("★ a wiki holding no grammar answers EMPTY, and never throws ★", () => {
    expect(() => grammarHeads(bare.wiki)).not.toThrow();
    expect(grammarHeads(bare.wiki).size).toBe(0);
  });

  test("★ and so does a plugin the fallback cannot read — a capture still records its turn ★", () => {
    for (const junk of [null, undefined, {}, { text: "not json" }, { text: '{"tiddlers":null}' }]) {
      expect(() => grammarHeadsFromPlugin(junk as never), `threw on ${JSON.stringify(junk)}`).not.toThrow();
      expect(grammarHeadsFromPlugin(junk as never).size).toBe(0);
    }
  });
});
