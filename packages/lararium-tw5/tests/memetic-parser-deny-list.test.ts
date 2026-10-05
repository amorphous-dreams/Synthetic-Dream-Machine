/**
 * THE DENY-LIST FILTERS RULE CLASSES BEFORE THE PARSE, NOT RULE INSTANCES AFTER IT.
 *
 * `lar:///ha.ka.ba/config/memetic-rules-except` names wikitext rules that a memetic-typed parse must
 * never run. The deny-list config removes those rule classes from the class map before any rule of a
 * memetic-typed parse instantiates, so a denied rule never matches — scoping every parse of a
 * memetic-typed tiddler, whether transcluded or not. The SHARED `WikiParser.prototype.*RuleClasses`
 * maps that every `text/vnd.tiddlywiki` parse also reads stay untouched: a `text/vnd.tiddlywiki`
 * parse is unaffected by this suite.
 */
import { describe, test, expect, afterEach } from "vitest";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";

const MEMETIC_TYPE = "text/memetic-wikitext+tiddlywiki";
const CONFIG_TIDDLER = "lar:///ha.ka.ba/config/memetic-rules-except";

interface TreeNode {
  type?: string;
  tag?: string;
  children?: TreeNode[];
  [key: string]: unknown;
}

/** Depth-first search over a TW5 parse tree for a node the predicate accepts. */
function findNode(tree: TreeNode[] | undefined, predicate: (n: TreeNode) => boolean): TreeNode | undefined {
  for (const node of tree ?? []) {
    if (predicate(node)) return node;
    const found = findNode(node.children, predicate);
    if (found) return found;
  }
  return undefined;
}

function hasStrong(tree: TreeNode[] | undefined): boolean {
  return !!findNode(tree, (n) => n.type === "element" && n.tag === "strong");
}

function hasCodeblock(tree: TreeNode[] | undefined): boolean {
  return !!findNode(tree, (n) => n.type === "codeblock");
}

describe(`the memetic deny-list filters rule classes before the parse${skipNote}`, () => {
  let engine: TW5Engine | undefined;

  afterEach(() => {
    engine = undefined;
  });

  test.skipIf(wikiSkip)("★ CONTROL: with no deny-list configured, bold and dash fire normally ★", async () => {
    engine = await bootTestWiki();
    const boldTree = (engine.wiki.parseText(MEMETIC_TYPE, "''bold''", {}) as { tree: TreeNode[] }).tree;
    expect(hasStrong(boldTree)).toBe(true);
    const dashTree = (engine.wiki.parseText(MEMETIC_TYPE, "en -- dash", {}) as { tree: TreeNode[] }).tree;
    expect(findNode(dashTree, (n) => n.type === "entity" && n.entity === "&ndash;")).toBeTruthy();
  });

  test.skipIf(wikiSkip)("★ RED: denying `bold` stops `''…''` from becoming a <strong> — the quotes survive as text ★", async () => {
    engine = await bootTestWiki();
    engine.setTiddler({ title: CONFIG_TIDDLER, text: "bold" });
    const tree = (engine.wiki.parseText(MEMETIC_TYPE, "''bold''", {}) as { tree: TreeNode[] }).tree;
    expect(hasStrong(tree)).toBe(false);
    expect(findNode(tree, (n) => n.type === "text" && typeof n.text === "string" && n.text.includes("''"))).toBeTruthy();
  });

  test.skipIf(wikiSkip)("★ ISOLATION: the denial never leaks onto `text/vnd.tiddlywiki` — the shared prototype maps stand ★", async () => {
    engine = await bootTestWiki();
    engine.setTiddler({ title: CONFIG_TIDDLER, text: "bold" });
    // Force the memetic parse first, so a prototype-mutating filter would have already run.
    engine.wiki.parseText(MEMETIC_TYPE, "''bold''", {});
    const stdTree = (engine.wiki.parseText("text/vnd.tiddlywiki", "''bold''", {}) as { tree: TreeNode[] }).tree;
    expect(hasStrong(stdTree)).toBe(true);
  });

  test.skipIf(wikiSkip)("★ a denied block rule (`codeblock`) stops a fence from becoming a $codeblock node ★", async () => {
    engine = await bootTestWiki();
    engine.setTiddler({ title: CONFIG_TIDDLER, text: "codeblock" });
    const text = "```\nraw fence\n```";
    const tree = (engine.wiki.parseText(MEMETIC_TYPE, text, {}) as { tree: TreeNode[] }).tree;
    expect(hasCodeblock(tree)).toBe(false);
  });
});
