/**
 * SHORT TITLES (S6, lar:///ha.ka.ba/kahua/memory/course/ai-surface-gestures #/stories) — the one pure reading every tiddler
 * door calls: `kahua:<path>` reads the stage meme law's full title, a prefix no law declares refuses by name with the
 * prefixes that stand, and every other title rides through untouched.
 */
import { describe, expect, test } from "vitest";
import { STAGE_MEME_PREFIX } from "../src/place-meme.js";
import { readShortTitle, SHORT_TITLE_EMPTY_CODE, SHORT_TITLE_PREFIXES, SHORT_TITLE_UNKNOWN_CODE } from "../src/short-title.js";

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

  test("an unknown prefix over a stage-shaped path refuses by name and names the prefixes that stand", () => {
    const read = readShortTitle("kahu:road/x");
    expect(read).toMatchObject({ kind: "refused", code: SHORT_TITLE_UNKNOWN_CODE });
    const message = read.kind === "refused" ? read.message : "";
    expect(message).toMatch(/^short-title-unknown: "kahu:road\/x" names the prefix "kahu:"/);
    expect(message).toContain(`kahua: (${STAGE_MEME_PREFIX})`);
    expect(message).toContain("`kahua:road/x`");
  });

  test("a standing prefix with no path refuses short-title-empty", () => {
    for (const title of ["kahua:", "kahua:#/a"]) expect(readShortTitle(title)).toMatchObject({ kind: "refused", code: SHORT_TITLE_EMPTY_CODE });
  });
});
