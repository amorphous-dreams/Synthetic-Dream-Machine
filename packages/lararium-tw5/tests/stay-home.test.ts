/**
 * stay-home — ONE predicate names the titles no door reads or writes, and every door reads it (re-read #444): the tiddler door's
 * gate and view, and the internal meme reads. A second spelling would drift the day one of them moved.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { staysHome } from "../src/stay-home.js";

describe("the one stay-home predicate", () => {
  test("RED: temp, state, the volatile VM plane, control and secret homes and cap/** stay home; a plain title and a lar: meme leave", () => {
    for (const title of ["$:/temp/lares/alert/x", "$:/state/popup/y", "lar:///lararium.local.vm/verbs/r1"]) expect(staysHome(title), title).toBe(true);
    for (const title of ["Note 01", "lar:///ha.ka.ba/lares/api/pono/meme"]) expect(staysHome(title), title).toBe(false);
  });

  test("RED: the tiddler door and the meme door read it, and neither keeps a copy of its own", () => {
    for (const file of ["tiddler-verbs.ts", "meme-verbs.ts"]) {
      const src = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
      expect(src, file).toMatch(/from "\.\/stay-home\.js"/);
      expect(src, file).not.toMatch(/offerWithheldTitle\(title\) \|\| localFilter\(title\)/);
    }
  });
});
