/**
 * security-class — RED FIRST (written, never run by its author). The wiki's matcher names which of a diff's paths the
 * security class holds; the host (tools/bench-gate.mjs) reads the git diff and develop's list, the wiki answers.
 * CONTROL rows stand beside each RED so a matcher that names everything or nothing reads red here.
 */
import { readFileSync } from "node:fs";
import { describe, test, expect, beforeAll } from "vitest";
import { globToRegExp, readSecurityClass, securityClassPaths } from "../src/filters/security-class.js";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

const LIST = { paths: ["tools/ci-verdict.mjs", ".github/**", "**/package.json", "tools/*witness*", "packages/lararium-keyhive/**"], tokens: ["custody", "Gate"] };

describe("security-class — the pure matcher", () => {
  test("RED: a glob path, a recursive glob, a root `**/` file and a star-within-a-segment name are held; CONTROL: a plain source path is not", () => {
    const hit = securityClassPaths(["tools/ci-verdict.mjs", ".github/workflows/ci.yml", "package.json", "packages/a/package.json", "tools/x-witness.sh", "packages/lararium-keyhive/src/a.ts", "packages/a/src/plain.ts"], LIST);
    expect(hit).toEqual(["tools/ci-verdict.mjs", ".github/workflows/ci.yml", "package.json", "packages/a/package.json", "tools/x-witness.sh", "packages/lararium-keyhive/src/a.ts"]);
  });

  test("RED: a token word holds anywhere in the path, case-folded; CONTROL: a near miss stands clear", () => {
    expect(securityClassPaths(["docs/Custody-notes.md", "src/GATEway.ts", "src/gat.ts"], LIST)).toEqual(["docs/Custody-notes.md", "src/GATEway.ts"]);
  });

  test("`*` stops at `/`, `?` holds one char, a dot stands for itself", () => {
    expect(globToRegExp("tools/*witness*").test("tools/sub/a-witness")).toBe(false);
    expect(globToRegExp("a?c").test("abc")).toBe(true);
    expect(globToRegExp("a?c").test("a/c")).toBe(false);
    expect(globToRegExp("a.json").test("aXjson")).toBe(false);
  });

  test("a path repeats once; the order stays the diff's; an empty diff names nothing", () => {
    expect(securityClassPaths([".npmrc", "x/custody", ".npmrc"], { paths: [".npmrc"], tokens: ["custody"] })).toEqual([".npmrc", "x/custody"]);
    expect(securityClassPaths([], LIST)).toEqual([]);
  });

  test("RED: a malformed list throws (an empty answer would read as a clean diff); CONTROL: a well-formed one reads", () => {
    expect(() => readSecurityClass({ paths: "x", tokens: [] })).toThrow(/paths/);
    expect(() => readSecurityClass({ paths: [], tokens: [""] })).toThrow(/tokens/);
    expect(() => readSecurityClass(null)).toThrow(/object/);
    expect(readSecurityClass(LIST)).toEqual(LIST);
  });

  test("the live list: its own path and the keyhive tree fall in the class", () => {
    const live = readSecurityClass(JSON.parse(readFileSync(new URL("../../../tools/security-class-paths.json", import.meta.url), "utf8")));
    expect(securityClassPaths(["tools/security-class-paths.json", "packages/lararium-keyhive/x.ts", "packages/lararium-tw5/src/plain.ts"], live)).toEqual(["tools/security-class-paths.json", "packages/lararium-keyhive/x.ts"]);
  });
});

describe.skipIf(wikiSkip)(`security-class — through the wiki's filter parser${skipNote}`, () => {
  let engine: TW5Engine;
  beforeAll(async () => { engine = await bootTestWiki(); }, 60_000);
  const via = (paths: string[], list = LIST): string[] =>
    engine.$tw.wiki.filterTiddlers(`${paths.map((p) => `[[${p}]]`).join(" ")} +[security-class[${encodeURIComponent(JSON.stringify(list))}]]`) as string[];

  test("RED: the operator registers and answers the held paths; CONTROL: a clean diff answers none", () => {
    expect(via([".github/a.yml", "src/plain.ts"])).toEqual([".github/a.yml"]);
    expect(via(["src/plain.ts"])).toEqual([]);
  });

  test("RED: a list the operand cannot parse refuses by throwing", () => {
    expect(() => engine.$tw.wiki.filterTiddlers("[[a]] +[security-class[%7Bnope]]")).toThrow(/security-class/);
  });
});
