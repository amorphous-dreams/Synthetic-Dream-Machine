import { beforeAll, describe, expect, test } from "vitest";
import type { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

describe.skipIf(wikiSkip)(`lar references through the wiki filter${skipNote}`, () => {
  let engine: TW5Engine;
  const source = "lar:///ha.ka.ba/kahua/memory/state/source";
  const target = "lar:///ha.ka.ba/kahua/memory/state/target";
  beforeAll(async () => {
    engine = await bootTestWiki({ tiddlers: [{ title: source, text: `[[${target}]] See ${target}#/slot, <<~ go to=\`${target}\`>>` }] });
  }, 60_000);
  test("out retains fragments, trims punctuation, and reads links and sigils", () => {
    expect(engine.wiki.filterTiddlers(`[[${source}]lar-refs:out[]]`)).toEqual([target, `${target}#/slot`]);
  });
  test("in finds a prose reference to a root", () => {
    expect(engine.wiki.filterTiddlers(`[[${target}]lar-refs:in[]]`)).toContain(source);
  });
  test("code examples do not create edges; punctuation preserves address contents", () => {
    const title = "lar:///x.y.z/examples";
    engine.wiki.addTiddler({ title, text: "`lar:///x.y.z/inline`\n```text\nlar:///x.y.z/fenced\n```\nSee lar:///x.y.z/a(b). and 'lar:///x.y.z/don't'" });
    expect(engine.wiki.filterTiddlers(`[[${title}]lar-refs:out[]]`)).toEqual(["lar:///x.y.z/a(b)", "lar:///x.y.z/don't"]);
  });
  test("an unknown suffix refuses", () => {
    expect(() => engine.wiki.filterTiddlers(`[[${source}]lar-refs:unknown[]]`)).toThrow(/unknown suffix/);
  });
});
