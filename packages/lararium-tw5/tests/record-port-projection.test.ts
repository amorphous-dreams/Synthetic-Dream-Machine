import { describe, expect, it } from "vitest";
import { applyLoad, load, localFilter, projectRecord, shapeId } from "../src/record-port-projection.js";

describe("record projection", () => {
  const record = { title: "Ordinary", seq: 7, fields: { text: "body", tags: ["x"], modified: "m", type: "text/plain", caption: "c", custom: "yes" } };
  it("port-skinny-then-load", () => {
    const skinny = projectRecord(record, { width: "skinny" });
    expect(skinny.fields).not.toHaveProperty("text");
    expect(skinny.omitted).toContain("text");
    expect(applyLoad(skinny, load(record, ["text"])).fields.text).toBe("body");
  });
  it("port-storylist-stays-local with ordinary and full-width controls", () => {
    expect(localFilter("$:/StoryList")).toBe(true);
    expect(localFilter("$:/HistoryList")).toBe(true);
    for (const root of ["state", "temp", "status"]) expect(localFilter(`$:/${root}/x`)).toBe(true);
    expect(localFilter("$:/info/browser/x")).toBe(true);
    expect(localFilter("Ordinary")).toBe(false);
    expect(projectRecord(record, { width: "full" }).fields).toEqual(record.fields);
  });
  it("port-skinny-omitted-vs-deleted", () => {
    const skinny = projectRecord(record, { width: "skinny" });
    expect(skinny.omitted).toContain("custom");
    expect(skinny.omitted).not.toContain("deletedField");
    expect(skinny.fields).not.toHaveProperty("deletedField");
  });
  it("port-load-stale-never-overwrites", () => {
    const held = projectRecord({ ...record, seq: 8, fields: { text: "new" } }, { width: "full" });
    expect(applyLoad(held, load(record, ["text"]))).toBe(held);
  });
  it("shapeId changes with width and localFilter", () => {
    const full = shapeId({ width: "full", localFilter: ["a"] });
    expect(full).not.toBe(shapeId({ width: "skinny", localFilter: ["a"] }));
    expect(full).not.toBe(shapeId({ width: "full", localFilter: ["b"] }));
    expect(full).toBe(shapeId({ localFilter: ["a"], width: "full" }));
  });
});
