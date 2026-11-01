/**
 * The control sigils evaluate their FILTER, never its text. `<%if [<filter>]%>` yields the filter STRING
 * as its one result, so every non-blank filter read true and the branch rendered whatever the filter said
 * (train security read, INFO: sigil-wai.tid:22). `[subfilter<filter>]` runs the filter.
 *
 * The branch a control sigil renders rides its `sigil` param (the sigil it dispatches), so each case
 * names a local procedure the branch would show.
 *
 * RED: a filter yielding nothing (`[[x]is[missing]]` over a wiki holding x, `[[1]match[2]]`) renders no
 * branch, for wai, its English mirror if, and the kahawai rung. CONTROL: a matching filter renders it.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

const SHOWN = "\\procedure ~shown() BRANCH-SHOWN\n";
const HEADS = ["wai", "if", "kahawai"];
const call = (head: string, filter: string) => `${SHOWN}<<~ ${head} filter=\`${filter}\` sigil=\`shown\`>>`;

describe.skipIf(wikiSkip)(`the control sigils run their filter${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki({ tiddlers: [{ title: "x", text: "here" }] }); }, 60_000);

  test.each(HEADS)("RED: %s renders nothing when its filter yields nothing", (head) => {
    expect(renderWikitext(e, call(head, "[[x]is[missing]]"))).not.toContain("BRANCH-SHOWN");
    expect(renderWikitext(e, call(head, "[[1]match[2]]"))).not.toContain("BRANCH-SHOWN");
  });

  test.each(HEADS)("CONTROL: %s renders its branch when its filter matches", (head) => {
    expect(renderWikitext(e, call(head, "[[x]!is[missing]]"))).toContain("BRANCH-SHOWN");
    expect(renderWikitext(e, call(head, "[[1]match[1]]"))).toContain("BRANCH-SHOWN");
  });
});
