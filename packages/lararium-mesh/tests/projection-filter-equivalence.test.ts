import { describe, expect, test } from "vitest";
import { PROJECTION_FILTER_TEXT, filterSelects, projectionWithheld, projectionFilterTitle } from "../src/projection-filter.js";

describe("projection filters hold operator preferences only", () => {
  test("the shipped base carries only TW5's volatile namespaces: temp, state, status and the story and history lists", () => {
    expect(PROJECTION_FILTER_TEXT.base).toBe("[prefix[$:/temp/]]\n[prefix[$:/state/]]\n[prefix[$:/status/]]\n[prefix[$:/StoryList]]\n[prefix[$:/HistoryList]]");
    const volatile = (title: string): boolean => ["$:/temp/", "$:/state/", "$:/status/", "$:/StoryList", "$:/HistoryList"].some((p) => title.startsWith(p));
    for (const title of ["$:/temp/draft", "$:/state/tab", "$:/status/UserName", "lar:///ha.ka.ba/bags/daemon/receipts/r1", "lar:///ha.ka.ba/bags/daemon/outcomes/o1", "dreamnet/realm-bag-announce/r1", "A Plain Note", "$:/config/lares/ProjectionFilter"]) {
      expect(projectionWithheld(title), title).toBe(volatile(title));
    }
  });

  test("RED: TW5's story and history lists (UI navigation state) never project, as TW5's own SaverFilter keeps them unsaved", () => {
    for (const title of ["$:/StoryList", "$:/HistoryList"]) expect(projectionWithheld(title), title).toBe(true);
    // CONTROL: a plain record and a house config record still project from the base class.
    expect(projectionWithheld("A Plain Note")).toBe(false);
    expect(projectionWithheld("lar:///ha.ka.ba/lararium/config/projection")).toBe(false);
  });

  test("a mirror's temp class can withhold house config while custom operator filters stay available", () => {
    const tempConfig = "lar:///ha.ka.ba/lararium/config/projection";
    expect(projectionWithheld(tempConfig, ["temp"])).toBe(true);
    expect(projectionWithheld("lar:///ha.ka.ba/kahua/memory", [], (title) => title === projectionFilterTitle("temp") ? "[prefix[lar:///ha.ka.ba/kahua/]]" : undefined)).toBe(false);
    const custom = (title: string) => title === "$:/config/lares/ProjectionFilter" ? "[prefix[lar:///ha.ka.ba/kahua/]]" : undefined;
    expect(projectionWithheld("lar:///ha.ka.ba/kahua/memory", [], custom)).toBe(true);
  });

  test("the temp class filter selects only its configured house config path", () => {
    expect(filterSelects(PROJECTION_FILTER_TEXT.temp, "lar:///ha.ka.ba/lararium/config/a")).toBe(true);
    expect(filterSelects(PROJECTION_FILTER_TEXT.temp, "lar:///ha.ka.ba/lares/docs/a")).toBe(false);
  });
});
