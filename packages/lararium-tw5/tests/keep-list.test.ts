/**
 * keep-list — a face's keep list reads and writes as a filter of wiki slugs in its own daemon wiki.
 *
 * RED FIRST, written unrun. The record names what a lit face keeps warm; the vessel's one keep-warm cap grants or refuses each.
 */
import { describe, test, expect } from "vitest";
import { KEEP_LIST_TITLE, keepListFilter, keepListWith, keepListWithout, readKeepList } from "../src/keep-list.js";

const rec = (text?: string) => ({ tiddler: { title: KEEP_LIST_TITLE, ...(text === undefined ? {} : { text }) } });

describe("a face's keep list", () => {
  test("a record reads back its slugs in the order named, each once", () => {
    expect(readKeepList(rec("[[notes]] [[ember-hall]] [[notes]]"))).toEqual(["notes", "ember-hall"]);
  });

  test("bare slugs read the same as bracketed ones", () => {
    expect(readKeepList(rec("notes ember-hall"))).toEqual(["notes", "ember-hall"]);
  });

  test("CONTROL: no record, no text and blank text read as an empty list", () => {
    expect(readKeepList(null)).toEqual([]);
    expect(readKeepList(rec())).toEqual([]);
    expect(readKeepList(rec("  "))).toEqual([]);
  });

  test("the filter a list writes reads back as the same list", () => {
    const slugs = ["notes", "ember-hall", "works"];
    expect(readKeepList(rec(keepListFilter(slugs)))).toEqual(slugs);
    expect(keepListFilter([])).toBe("");
  });

  test("adding a kept slug twice and removing an absent one move nothing", () => {
    expect(keepListWith(["a"], "a")).toEqual(["a"]);
    expect(keepListWith(["a"], "b")).toEqual(["a", "b"]);
    expect(keepListWithout(["a", "b"], "a")).toEqual(["b"]);
    expect(keepListWithout(["a"], "z")).toEqual(["a"]);
  });
});
