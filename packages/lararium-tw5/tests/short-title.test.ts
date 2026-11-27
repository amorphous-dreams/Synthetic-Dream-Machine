/**
 * SHORT TITLES (S6, lar:///ha.ka.ba/kahua/memory/course/ai-surface-gestures #/stories) — the one pure reading every tiddler
 * door calls: `kahua:<path>` reads the stage meme law's full title, and every other title rides through untouched, a prefix
 * no law declares included; its not-found hint names the prefixes that stand.
 */
import { describe, expect, test } from "vitest";
import { STAGE_MEME_PREFIX } from "../src/place-meme.js";
import { readShortTitle, shortTitleHint, SHORT_TITLE_EMPTY_CODE, SHORT_TITLE_PREFIXES } from "../src/short-title.js";

describe("readShortTitle", () => {
  test("the closed set derives from the stage meme law: `kahua` names STAGE_MEME_PREFIX and nothing else stands", () => {
    expect(SHORT_TITLE_PREFIXES).toEqual({ kahua: STAGE_MEME_PREFIX });
    expect(Object.isFrozen(SHORT_TITLE_PREFIXES)).toBe(true);
  });

  test("`kahua:<path>` reads the full stage title, a slot fragment riding along", () => {
    expect(readShortTitle("kahua:road/x")).toEqual({ kind: "expanded", prefix: "kahua", title: "lar:///ha.ka.ba/kahua/memory/road/x" });
    expect(readShortTitle("kahua:state/handoff#/entry")).toMatchObject({ kind: "expanded", title: "lar:///ha.ka.ba/kahua/memory/state/handoff#/entry" });
    expect(readShortTitle("kahua:familiar/lares-alpha")).toMatchObject({ title: `${STAGE_MEME_PREFIX}familiar/lares-alpha` });
  });

  test("CONTROL: a full address, a system title, a plain title and a colon that names no stage path ride through as named", () => {
    for (const title of ["lar:///ha.ka.ba/kahua/memory/road/x", "$:/config/lares/ProjectionFilter", "Note 01", "Note: draft", "did:key:z6MkExample", "urn:uuid:1234", "https://example.org/a", "ni:///sha-256;abc"]) {
      expect(readShortTitle(title)).toEqual({ kind: "full", title });
    }
  });

  test("a title stays a title: an unknown prefix rides through as named, and its hint names the prefixes that stand", () => {
    for (const title of ["kahu:road/x", "todo:buy-milk"]) expect(readShortTitle(title)).toEqual({ kind: "full", title });
    const hint = shortTitleHint("kahu:road/x") ?? "";
    expect(hint).toContain(`kahua: → ${STAGE_MEME_PREFIX}`);
    expect(hint).toContain(`\`kahua:road/x\` reads \`${STAGE_MEME_PREFIX}road/x\``);
    expect(shortTitleHint("todo:buy-milk")).toContain("kahua: →");
  });

  test("CONTROL: no hint for a standing prefix, a full address, a plain title or a colon before no stage path", () => {
    for (const title of ["kahua:road/x", "lar:///ha.ka.ba/kahua/memory/road/x", "Note 01", "did:key:z6MkExample", "Note: draft"]) expect(shortTitleHint(title)).toBeNull();
  });

  test("a standing prefix with no path refuses short-title-empty", () => {
    for (const title of ["kahua:", "kahua:#/a"]) expect(readShortTitle(title)).toMatchObject({ kind: "refused", code: SHORT_TITLE_EMPTY_CODE });
  });
});
