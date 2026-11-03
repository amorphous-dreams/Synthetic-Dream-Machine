/**
 * A PAIRED control sigil renders its BODY by its filter. `<<~ wai filter=`…`>>body<<~/wai>>` rode the
 * `sigil=` param for its branch, so a paired call with no `sigil=` rendered nothing whatever the filter
 * said and the body vanished: the documented form (wai.mem #/syntax) swallowed its content.
 *
 * RED: a matching filter shows the body (wai, its English mirror if, and the kahawai rung inside a wai).
 * CONTROL: a filter yielding nothing hides the body, and the `sigil=` branch form keeps working.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

describe.skipIf(wikiSkip)(`a paired control sigil renders its body${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki({ tiddlers: [{ title: "x", text: "here" }] }); }, 60_000);

  test.each(["wai", "if"])("RED: %s shows its body when the filter matches", (head) => {
    expect(renderWikitext(e, `<<~ ${head} filter=\`[[1]match[1]]\`>>BODY-SHOWN<<~/${head}>>`)).toContain("BODY-SHOWN");
  });

  test.each(["wai", "if"])("CONTROL: %s hides its body when the filter yields nothing", (head) => {
    expect(renderWikitext(e, `<<~ ${head} filter=\`[[1]match[2]]\`>>BODY-SHOWN<<~/${head}>>`)).not.toContain("BODY-SHOWN");
  });

  test("RED: the cascade shows the first matching rung's body", () => {
    const out = renderWikitext(e, "<<~ wai filter=`[[1]match[2]]`>>FIRST<<~ kahawai filter=`[[1]match[1]]`>>SECOND<<~ mukuwai>>DEFAULT<<~/wai>>");
    expect(out).toContain("SECOND");
    expect(out).not.toContain("FIRST");
    expect(out).not.toContain("DEFAULT");
  });

  test("CONTROL: the sigil= branch form still renders its branch", () => {
    expect(renderWikitext(e, "\\procedure ~shown() BRANCH-SHOWN\n<<~ wai filter=`[[1]match[1]]` sigil=`shown`>>")).toContain("BRANCH-SHOWN");
  });
});
