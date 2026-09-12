/**
 * THE THREE STATES OF AN EMPTY BODY — unresolved · arriving · empty.
 *
 * A section with nothing under it says the same nothing for three different facts, and two of the
 * syncer's open seams are exactly that ambiguity wearing two causes:
 *
 *   (c′) a lone member deleted — the root's `<<~ kahea ahu #/b>>` stands and no record answers it.
 *        The house rules SCAR, MARKED: the call stays (`deserializer.ts:1013`, never invented bytes)
 *        and the render says it is dead. Keep the pointer, mark it dead.
 *   (d′) a group arriving by poll — `getSkinnyTiddlers` lands every member skinny in one batch and
 *        `LoadTiddlerTask` fattens them one at a time (`syncer.js:654-696` · `:440`), so for N round
 *        trips a record STANDS at the child's address and holds no text.
 *
 * An arriving child HAS a record; a dead one does not. So one template tells them apart, and the two
 * leans land together or not at all — which is why they are one step.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

const PARENT = "lar:///test/render";

describe.skipIf(wikiSkip)(`an ahu slot names which nothing it holds${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);

  /**
   * Render the parent's call to `#/b` with the child's record in one of the three states.
   *
   * The call reads its child's address off `currentTiddler`, and a bare `renderTiddler` applies no
   * template and so sets none — the address would resolve to the bare `#/b` and every state would
   * read unresolved. `<$tiddler>` supplies what a real view template supplies.
   */
  const callWith = (child: Record<string, string> | null): string => {
    if (child) e.setTiddler(child);
    return renderWikitext(e, `<$tiddler tiddler="${PARENT}">\n\n<<~ kahea ahu #/b>>\n\n</$tiddler>`, PARENT);
  };

  test("UNRESOLVED · no record stands at the child's address — the mark says the pointer is dead", () => {
    const html = callWith(null);
    expect(html).toContain("lar-ahu");
    expect(html).toContain("unresolved");
    expect(html).not.toContain("arriving");
  });

  test("ARRIVING · a record stands and holds no `text` field — the cord, for the poll's own window", () => {
    const html = callWith({ title: `${PARENT}#/b`, type: "text/memetic-wikitext+tiddlywiki", $slot: "#/b" });
    expect(html).toContain("arriving");
    expect(html).not.toContain("unresolved");
  });

  test("EMPTY · a record stands with an empty `text` — the author wrote nothing, and that is a fact too", () => {
    const html = callWith({ title: `${PARENT}#/b`, type: "text/memetic-wikitext+tiddlywiki", $slot: "#/b", text: "" });
    expect(html).toContain("empty");
    expect(html).not.toContain("unresolved");
    expect(html).not.toContain("arriving");
  });

  test("CONTROL · a filled child renders its body and claims none of the three marks", () => {
    const html = callWith({ title: `${PARENT}#/b`, type: "text/memetic-wikitext+tiddlywiki", $slot: "#/b", text: "! the body" });
    expect(html).toContain("the body");
    expect(html).toContain("filled");
    for (const mark of ["unresolved", "arriving", ">empty<"]) expect(html).not.toContain(mark);
  });

  test("CONTROL · the slot's own frame still reaches the page in every state — nothing vanishes", () => {
    for (const child of [null, { title: `${PARENT}#/b`, text: "x" }]) {
      const html = callWith(child as Record<string, string> | null);
      expect(html, "an ahu rendering nothing has lost its slot").not.toBe("");
      expect(html).toContain("lar-ahu");
    }
  });
});
