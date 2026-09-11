/**
 * A SLOT PATH CARRIES NO EMPTY SEGMENT. A rooted slot opened INSIDE a parent resolves against its
 * parent the way `href="/child"` resolves under a base — one `/` between segments, never two. The
 * split (the deserializer) and the recompose (`expandMemeRefs`) both read titles through the one
 * minter, so the deserializer's titles witness the law for both ends.
 */
import { describe, test, expect } from "vitest";
import { deserializeCarrier } from "../src/deserializer.js";

const URI = "lar:///t/x";

/** A framed meme with one parent slot holding one child slot, the two opened as given. */
const nested = (parent: string, child: string): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n` +
  `<<~ ahu ${parent}>>\n\nouter\n\n<<~ ahu ${child}>>\n\ninner\n\n<<~/ahu>>\n\n<<~/ahu>>\n\n` +
  `<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

const fragments = (text: string): string[] =>
  deserializeCarrier(text, { title: URI }).records.map((r) => String(r.title).split("#")[1] ?? "").filter(Boolean);

describe("★ the deserializer mints no // title ★", () => {
  test("★ a rooted child under a rooted parent joins with ONE slash ★", () => {
    expect(fragments(nested("#/parent", "#/child"))).toContain("/parent/child");
  });
  test("a rooted child under an unrooted parent joins the same way", () => {
    expect(fragments(nested("#parent", "#/child"))).toContain("/parent/child");
  });
  test("CONTROL: the unrooted nesting stands as it did", () => {
    expect(fragments(nested("#parent", "#child"))).toContain("/parent/child");
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
