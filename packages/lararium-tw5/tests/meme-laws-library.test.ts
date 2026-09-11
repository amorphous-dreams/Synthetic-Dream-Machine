/**
 * THE LAWS RIDE THE PLUGIN — one library tiddler carries every pure law over meme text.
 *
 * A pure law (normalize · block check · carrier check · shape · edges · head · frame marks) reaches
 * every context the plugin reaches only if it packs INSIDE the plugin, and it stays one law only if
 * it packs ONCE: a consumer carrying its own inlined copy answers for a grammar the library has left.
 *
 * Two questions: does the packed plugin hold the library, and do its consumers REQUIRE it by URI
 * rather than carry a copy? The CONTROL: the library's own body holds the copy — exactly one.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { bootTestWiki, wikiSkip, skipNote, REPO } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import LARES_MEMETIC_WIKITEXT_PLUGIN from "../plugins/lares-memetic-wikitext.json" with { type: "json" };

const LAWS = "lar:///ha.ka.ba/lararium/tw5/modules/meme-laws";
const packed = JSON.parse((LARES_MEMETIC_WIKITEXT_PLUGIN as { text: string }).text).tiddlers as Record<string, Record<string, string>>;

describe("the meme laws pack as ONE library tiddler", () => {
  test("the packed plugin holds the library, module-type library", () => {
    expect(packed[LAWS]?.["module-type"]).toBe("library");
  });

  test("every consumer requires the library by URI; the one body holds the one copy", () => {
    const consumers = [
      "lar:///ha.ka.ba/lararium/tw5/modules/deserializer",
      "lar:///ha.ka.ba/lararium/tw5/modules/meme-markdown",
      "lar:///ha.ka.ba/lararium/tw5/modules/meme-face",
    ];
    for (const title of consumers) {
      expect(packed[title]?.["text"] ?? "", `${title} requires the laws by URI`).toContain(`require("${LAWS}")`);
    }
    for (const title of Object.keys(packed)) {
      if (title === LAWS || packed[title]!["type"] !== "application/javascript") continue;
      expect(packed[title]!["text"], `${title} carries no copy of verifyBcc`).not.toMatch(/function verifyBcc\(/);
    }
    // CONTROL: the copy lives in the library alone.
    expect(packed[LAWS]!["text"]).toMatch(/function verifyBcc\(/);
  });

  test("the deserializer packs ONCE too: the placement and the projection require it by URI", () => {
    const DESERIALIZER = "lar:///ha.ka.ba/lararium/tw5/modules/deserializer";
    for (const title of ["lar:///ha.ka.ba/lararium/tw5/modules/place-meme", "lar:///ha.ka.ba/lararium/tw5/modules/meme-project"]) {
      expect(packed[title]!["text"], `${title} requires the deserializer by URI`).toContain(`require("${DESERIALIZER}")`);
      expect(packed[title]!["text"], `${title} carries no copy of expandMemeRefs`).not.toMatch(/function expandMemeRefs\(/);
    }
    expect(packed[DESERIALIZER]!["text"]).toMatch(/function expandMemeRefs\(/);
  });
});

describe.skipIf(wikiSkip)(`a booted wiki executes the laws from the library${skipNote}`, () => {
  let engine: TW5Engine;
  beforeAll(async () => { engine = await bootTestWiki(); });

  test("the library exports the named laws and they answer over a real carrier", () => {
    const laws = (engine.$tw as unknown as { modules: { execute(title: string): Record<string, unknown> } }).modules.execute(LAWS);
    for (const name of ["normalizeMemeSource", "bccOf", "verifyBcc", "checkSpan", "readCarrierShape", "readCarrierEdges", "matchCarrierHead"]) {
      expect(typeof laws[name], name).toBe("function");
    }
    const src = readFileSync(path.join(REPO, "bags/lares/ha.ka.ba/lares/api/pono/ahu.mem"), "utf8");
    expect((laws["verifyBcc"] as (t: string) => string)(src)).toBe("ok");
    expect((laws["readCarrierShape"] as (t: string) => { kind: string })(src).kind).toBe("carrier");
  });
});
