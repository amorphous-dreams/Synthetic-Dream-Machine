import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { bootTestWiki, REPO, skipNote, wikiSkip } from "./test-wiki.js";

describe.skipIf(wikiSkip)(`wave crest source window${skipNote}`, () => {
  test("transclusion renders the source as literal code", async () => {
    const tid = readFileSync(`${REPO}/packages/lararium-tw5/tiddlers/wave-crest-source.tid`, "utf8");
    const [head, ...body] = tid.split("\n\n");
    const title = head!.match(/^title: (.+)$/m)![1]!;
    const type = head!.match(/^type: (.+)$/m)![1]!;
    const engine = await bootTestWiki({ tiddlers: [
      { title, type, text: body.join("\n\n") },
      { title: "probe", type: "text/vnd.tiddlywiki", text: `<$transclude $tiddler="${title}"/>` },
    ] });
    const html = engine.wiki.renderTiddler("text/html", "probe");
    expect(html).toContain("<pre><code>");
    expect(html).toContain("// &gt;0 = too slow");
    expect(html).toContain("`WaveLanding`");
    expect(html).not.toContain("<em>");
  });
});
