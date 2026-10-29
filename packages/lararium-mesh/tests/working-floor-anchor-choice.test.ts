import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { workingFloorAnchorOf } from "../src/wiki-recipe.js";

const hasPrivateKey = (source: string) => /workingFloorAnchorOf\s*\(\s*\{[^}]*\bprivateNexusKey\s*:/.test(source);

test("the working floor chooses a place before a private nexus", () => {
  expect(workingFloorAnchorOf({ place: "place", privateNexusKey: "key" })).toEqual({ kind: "place", aid: "place" });
  expect(workingFloorAnchorOf({ privateNexusKey: "key" })).toEqual({ kind: "private-nexus", key: "key" });
  expect(workingFloorAnchorOf({})).toBeUndefined();
});

test("the node supplies no private nexus key", () => {
  expect(hasPrivateKey("workingFloorAnchorOf({ place: p, privateNexusKey: k })")).toBe(true);
  const source = readFileSync(new URL("../../lararium-node/src/open-node-vessel.ts", import.meta.url), "utf8");
  expect(source).toMatch(/workingFloorAnchorOf\s*\(/);
  expect(hasPrivateKey(source)).toBe(false);
});
