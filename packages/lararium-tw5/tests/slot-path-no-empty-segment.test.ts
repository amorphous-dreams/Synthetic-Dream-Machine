/**
 * A SLOT PATH CARRIES NO EMPTY SEGMENT. A rooted slot opened INSIDE a parent resolves against its
 * parent the way `href="/child"` resolves under a base — one `/` between segments, never two. The
 * split (the deserializer) and the recompose (`expandMemeRefs`) both read titles through the one
 * minter, so the deserializer's titles witness the law for both ends.
 */
import { describe, test, expect } from "vitest";
import { memeticWikitextDeserializer } from "../src/deserializer.js";

const URI = "lar:///t/x";

/** A framed meme with one parent slot holding one child slot, the two opened as given. */
const nested = (parent: string, child: string): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n` +
  `<<~ ahu ${parent}>>\n\nouter\n\n<<~ ahu ${child}>>\n\ninner\n\n<<~/ahu>>\n\n<<~/ahu>>\n\n` +
  `<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

const fragments = (text: string): string[] =>
  memeticWikitextDeserializer(text, { title: URI }).map((r) => String(r.title).split("#")[1] ?? "").filter(Boolean);

describe("★ the deserializer mints no // title ★", () => {
  test("★ a rooted child under a rooted parent joins with ONE slash ★", () => {
    expect(fragments(nested("#/parent", "#/child"))).toContain("/parent/child");
  });
  // ONE SLOT, ONE ADDRESS (src/deserializer.ts:415) — the scanner admits the rooted spelling only.
  // An unrooted `#parent` opens no slot at all, so it mints no title and nests nothing beneath it;
  // its body text is scanned at the ENCLOSING level, where the rooted `#/child` floats to the root.
  test("an unrooted parent opens no slot — a rooted child beneath it floats to the root", () => {
    const found = fragments(nested("#parent", "#/child"));
    expect(found).toContain("/child");
    expect(found).not.toContain("/parent/child");
  });
  test("CONTROL: two unrooted opens mint no slot at either depth", () => {
    expect(fragments(nested("#parent", "#child"))).toEqual([]);
  });
  test("an operator-authored path under a rooted parent keeps its segments, still one slash", () => {
    expect(fragments(nested("#/a", "#/b/c"))).toContain("/a/b/c");
  });
  test("no fragment anywhere carries an empty segment", () => {
    for (const f of [fragments(nested("#/parent", "#/child")), fragments(nested("#/a", "#/b/c"))].flat()) {
      expect(f.includes("//")).toBe(false);
    }
  });
});
