/**
 * merge-guard — a direct `handle.merge(other)` runs the prototype-key door on both sides.
 *
 * `wait-handle.ts` (a late remote merging into the fallback handle) and `genesis-intake.ts` (the live genesis handle merging
 * the incoming one) merged two documents with no assertion on the result. `mergeGuarded` refuses a hostile SOURCE by name
 * before the merge, so the target never takes the bytes, and asserts the MERGED result after, since a merge result's view can
 * hide the key. Reds: a hostile source refuses and leaves the target untouched; both call sites merge through the guard.
 * CONTROLS: a clean source merges; the call sites still wait, and a clean late remote still merges.
 */
import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { applyChanges, change, getAllChanges, init, save } from "@automerge/automerge";
import { readFileSync } from "node:fs";
import { makeIslandRepo } from "../src/index.js";
import { mergeGuarded } from "../src/prototype-key-shore.js";
import { isVerbRefusal } from "../src/verb-refusal.js";

type Doc = { tiddlers: Record<string, unknown> };
const hostileBytes = (): Uint8Array => {
  const doc = change(init<Doc>(), (d) => { d.tiddlers = { ZZZZZZZZZ: { "lar:///phantom": { tiddler: { title: "p" } } }, real: { tiddler: { title: "real" } } }; });
  let b = Buffer.from(getAllChanges(doc)[0]!);
  b = Buffer.from(b.toString("latin1").split("ZZZZZZZZZ").join("__proto__"), "latin1");
  createHash("sha256").update(b.subarray(8)).digest().copy(b, 4, 0, 4);
  return save(applyChanges(init<Doc>(), [new Uint8Array(b)])[0]);
};
const cleanBytes = (): Uint8Array => save(change(init<Doc>(), (d) => { d.tiddlers = { other: { tiddler: { title: "o" } } }; }));
const repo = () => makeIslandRepo({ syncPort: new MessageChannel().port1 });

describe("mergeGuarded", () => {
  test("RED: a hostile source refuses by name before the merge and the target stays untouched", () => {
    const r = repo();
    const target = r.import<Doc>(cleanBytes()), source = r.import<Doc>(hostileBytes());
    const before = Object.keys(target.doc().tiddlers);
    let caught: unknown;
    try { mergeGuarded(target, source, "probe"); } catch (e) { caught = e; }
    expect(isVerbRefusal(caught)).toBe(true);
    expect((caught as { reason: string }).reason).toBe("prototype-key");
    expect(Object.keys(target.doc().tiddlers)).toEqual(before);
  });
  test("CONTROL: a clean source merges", () => {
    const r = repo();
    const target = r.import<Doc>(cleanBytes());
    const source = r.clone(target);
    source.change((d) => { d.tiddlers["second"] = { tiddler: { title: "s" } }; });
    mergeGuarded(target, source, "probe");
    expect(Object.keys(target.doc().tiddlers).sort()).toEqual(["other", "second"]);
  });
});

describe("the call sites merge through the guard", () => {
  const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  test("RED: wait-handle.ts and genesis-intake.ts hold no bare `.merge(` of a handle", () => {
    expect(src("wait-handle.ts")).toMatch(/mergeGuarded\(/);
    expect(src("genesis-intake.ts")).toMatch(/mergeGuarded\(/);
    expect(src("wait-handle.ts")).not.toMatch(/fresh\.merge\(/);
    expect(src("genesis-intake.ts")).not.toMatch(/liveHandle\.merge\(incomingHandle\)/);
  });
  test("CONTROL: the helper itself still merges through the handle's own merge", () => {
    expect(src("prototype-key-shore.ts")).toMatch(/target\.merge\(source as never\)/);
  });
});
