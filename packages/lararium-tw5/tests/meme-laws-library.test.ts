/**
 * THE LAWS RIDE THE PLUGIN — one library tiddler carries every pure law over meme text.
 *
 * A pure law (normalize · shape · edges · lifecycle — and the frame, in its own library) reaches
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
const FRAME = "lar:///ha.ka.ba/lararium/tw5/lib/memetic-frame";
const packed = JSON.parse((LARES_MEMETIC_WIKITEXT_PLUGIN as { text: string }).text).tiddlers as Record<string, Record<string, string>>;

describe("the meme laws pack as ONE library tiddler", () => {
  test("the packed plugin holds the library, module-type library", () => {
    expect(packed[LAWS]?.["module-type"]).toBe("library");
  });

  test("every consumer requires the library by URI; the one body holds the one copy", () => {
    const consumers = [
      "lar:///ha.ka.ba/lararium/tw5/modules/deserializer",
      "lar:///ha.ka.ba/lararium/tw5/modules/meme-face",
    ];
    for (const title of consumers) {
      expect(packed[title]?.["text"] ?? "", `${title} requires the laws by URI`).toContain(`require("${LAWS}")`);
    }
    for (const title of Object.keys(packed)) {
      if (title === LAWS || packed[title]!["type"] !== "application/javascript") continue;
      expect(packed[title]!["text"], `${title} carries no copy of readCarrierShape`).not.toMatch(/function readCarrierShape\(/);
    }
    // CONTROL: the copy lives in the library alone.
    expect(packed[LAWS]!["text"]).toMatch(/function readCarrierShape\(/);
  });

  test("★ the FRAME packs ONCE, as its own library tiddler, and every frame reader requires it ★", () => {
    expect(packed[FRAME]?.["module-type"]).toBe("library");
    for (const title of [LAWS, "deserializer", "meme-ast", "weave", "meme-face"].map((t) => t.startsWith("lar:") ? t : `lar:///ha.ka.ba/lararium/tw5/modules/${t}`)) {
      expect(packed[title]?.["text"] ?? "", `${title} requires the frame by URI`).toContain(`require("${FRAME}")`);
    }
    for (const title of Object.keys(packed)) {
      if (title === FRAME || packed[title]!["type"] !== "application/javascript") continue;
      for (const fn of ["verifyBcc", "readFrame", "fencedSpans", "frameCarrier"]) {
        expect(packed[title]!["text"], `${title} carries no copy of ${fn}`).not.toMatch(new RegExp(`function ${fn}\\(`));
      }
    }
    // CONTROL: the copy lives in the frame library alone.
    expect(packed[FRAME]!["text"]).toMatch(/function verifyBcc\(/);
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
    const modules = (engine.$tw as unknown as { modules: { execute(title: string): Record<string, unknown> } }).modules;
    const laws = modules.execute(LAWS);
    const frame = modules.execute(FRAME);
    for (const name of ["normalizeMemeSource", "readCarrierShape", "readCarrierEdges"]) {
      expect(typeof laws[name], name).toBe("function");
    }
    for (const name of ["bccOf", "verifyBcc", "checkSpan", "readFrame", "matchCarrierHead", "frameCarrier", "stampCarrier"]) {
      expect(typeof frame[name], name).toBe("function");
    }
    const src = readFileSync(path.join(REPO, "bags/lares/ha.ka.ba/lares/api/pono/ahu.mem"), "utf8");
    expect((frame["verifyBcc"] as (t: string) => string)(src)).toBe("ok");
    expect((laws["readCarrierShape"] as (t: string) => { faults: readonly string[] })(src).faults).toEqual([]);
  });
});
