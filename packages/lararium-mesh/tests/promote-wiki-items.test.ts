/**
 * promote-wiki-items — the items a non-daemon wiki holds, for the promotion door: read off the wiki's own bags (its canon bag and its
 * working and draft slots) through the catalog's pointers, never another wiki's.
 *
 * Platform-blind. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import {
  makeIslandRepo, materializeSharedLarDoc, storedLarRecord, wikiBagUri, wikiSlotUri, type LarDoc,
} from "../src/index.js";
import { generateAutomergeUrl } from "@automerge/automerge-repo";
import { promoteWikiItems } from "../src/promote-wiki-items.js";

async function world() {
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const urlOf = () => generateAutomergeUrl();
  const [canonUrl, workingUrl, otherUrl] = [urlOf(), urlOf(), urlOf()];
  const canon = await materializeSharedLarDoc(repo, canonUrl, "t:canon");
  const working = await materializeSharedLarDoc(repo, workingUrl, "t:working");
  const other = await materializeSharedLarDoc(repo, otherUrl, "t:other");
  canon.change((d: LarDoc) => { (d.tiddlers as Record<string, unknown>)["rites/a"] = storedLarRecord("rites/a", { text: "exports.startup = function(){}", "module-type": "startup", type: "application/javascript" }, "t"); });
  working.change((d: LarDoc) => { (d.tiddlers as Record<string, unknown>)["notes/b"] = storedLarRecord("notes/b", { text: "words", type: "text/vnd.tiddlywiki" }, "t"); });
  other.change((d: LarDoc) => { (d.tiddlers as Record<string, unknown>)["rites/foreign"] = storedLarRecord("rites/foreign", { text: "x", "module-type": "startup" }, "t"); });
  const catalog = { tiddlers: {
    [wikiBagUri("garden")]: storedLarRecord(wikiBagUri("garden"), { text: canonUrl }, "t"),
    [wikiSlotUri("garden", "working")]: storedLarRecord(wikiSlotUri("garden", "working"), { text: workingUrl }, "t"),
    [wikiBagUri("other")]: storedLarRecord(wikiBagUri("other"), { text: otherUrl }, "t"),
  } } as unknown as LarDoc;
  return promoteWikiItems({ repo, catalog: () => catalog });
}

describe("a wiki's own items", () => {
  test("RED: the garden's canon and working bags answer their tiddlers with title, text and the remaining fields; CONTROL: another wiki's bag never answers here", async () => {
    const items = await (await world())("garden");
    expect(items.map((i) => i.title).sort()).toEqual(["notes/b", "rites/a"]);
    const rite = items.find((i) => i.title === "rites/a")!;
    expect(rite.text).toBe("exports.startup = function(){}");
    expect(rite.fields).toEqual({ "module-type": "startup", type: "application/javascript" });
    expect(items.some((i) => i.title === "rites/foreign")).toBe(false);
  });

  test("RED: a wiki the catalog does not name, or whose pointer holds no doc, answers nothing and throws nothing; CONTROL: a named wiki answers", async () => {
    const items = await world();
    expect(await items("no-such-wiki")).toEqual([]);
    expect((await items("other")).map((i) => i.title)).toEqual(["rites/foreign"]);
  });
});
