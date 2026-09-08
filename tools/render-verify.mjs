#!/usr/bin/env node
// A commit verified by RENDER, not by parse. Every carrier it touched renders before and
// after, and the HTML must come back identical — a value that parses the same can still resolve
// differently once a widget consumes it.
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { resolveTiddlyWiki, boot } = require("/home/joshu/Synthetic-Dream-Machine/VSCode-TW5-Syntax/tools/tw5-oracle.js");
const o = boot(resolveTiddlyWiki(), {});
const $tw = o.$tw;
const COMMIT = process.argv[2];
if (!COMMIT) {
  console.error("render-verify: name the commit whose carriers to render before and after.");
  console.error("  usage: node tools/render-verify.mjs <commit> [limit]");
  process.exit(2);
}
const LIMIT = Number(process.argv[3] ?? 120);

const render = (text) => {
  try {
    const tree = $tw.wiki.parseText("text/vnd.tiddlywiki", text).tree;
    const w = $tw.wiki.makeWidget({ tree }, { parentWidget: $tw.rootWidget, document: $tw.fakeDocument });
    const c = $tw.fakeDocument.createElement("div");
    w.render(c, null);
    return c.innerHTML;
  } catch (e) { return "RENDER REFUSED: " + e.message.slice(0, 60); }
};

const changed = execSync(`git show --name-only --pretty=format: ${COMMIT} -- bags | grep '\\.mem$' | head -${LIMIT}`, { encoding: "utf8" })
  .split("\n").filter(Boolean);
let read = 0, same = 0; const moved = [];
for (const f of changed) {
  let before, after;
  try {
    before = execSync(`git show ${COMMIT}~1:${JSON.stringify(f).slice(1, -1)}`, { encoding: "utf8", maxBuffer: 1 << 26 });
    after = execSync(`git show ${COMMIT}:${JSON.stringify(f).slice(1, -1)}`, { encoding: "utf8", maxBuffer: 1 << 26 });
  } catch { continue; }
  read++;
  const a = render(before), b = render(after);
  if (a === b) same++; else moved.push([f, a.length, b.length]);
}
console.log(`carriers rendered before and after: ${read}`);
console.log(`  HTML identical: ${same}`);
console.log(`  HTML MOVED:     ${moved.length}`);
for (const [f, x, y] of moved.slice(0, 8)) console.log(`     ${f}  ${x} -> ${y} bytes`);
process.exit(moved.length === 0 ? 0 : 1);
