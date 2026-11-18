/**
 * meme-merge — the one seal merge: the bare seal, the slot cut, the slot merge, and the carrier merge's verdicts
 * (working-procedures #/the-seal-merge). Line merges run through git's own (`./meme-merge-git`); the sealer here is a
 * stand-in that marks what it sealed, since the normalize law lives above this package.
 */

import { describe, expect, test } from "vitest";
import { BARE_SEAL, bareSeal, mergeCarrier, mergeSlots, splitSlots, type MemeSealer } from "../src/meme-merge.js";
import { mergeTexts } from "../src/meme-merge-git.js";

const slot = (name: string, ...lines: string[]) => [`<<~ ahu slot=\`#/${name}\`>>`, "", ...lines, "", "<<~/ahu>>", ""];
const carrier = (bcc: string | null, ...slots: string[][]) => [
  "<<^ code=`&#x0001;` from=`?` to=`lar:///ha.ka.ba/lares/test/meme-merge`>>",
  "<<^ code=`&#x0002;`>>",
  "",
  ...slots.flat(),
  bcc === null ? BARE_SEAL : `<<^ code=\`&#x0003;\` bcc=\`${bcc}\`>>`,
  "",
  "<<^ code=`&#x0004;` to=`?`>>",
  "",
].join("\n");
const A = (l = "a holds.") => slot("a", l);
const B = (l = "b holds.") => slot("b", l);
const C = (l = "c holds.") => slot("c", l);
const keys = (text: string) => splitSlots(text)?.map((p) => p.key);
const seal: MemeSealer = (text) => ({ ok: true, text: text.replace(BARE_SEAL, "<<^ code=`&#x0003;` bcc=`sealed`>>") });

describe("bareSeal", () => {
  test("sets the last seal line bare", () => {
    expect(bareSeal(carrier("x", A()))).toBe(carrier(null, A()));
  });
  test("leaves a quoted seal in a fence above the real one", () => {
    const quoted = ["```", "<<^ code=`&#x0003;` bcc=`quoted`>>", "```"];
    const text = carrier("x", [...quoted, ""]);
    expect(bareSeal(text)).toBe(carrier(null, [...quoted, ""]));
  });
  test("leaves a carrier with no seal line as it stands", () => {
    expect(bareSeal("no seal\n")).toBe("no seal\n");
  });
});

describe("splitSlots", () => {
  test("cuts the head, each top-level slot and the text after it, and concatenates back byte for byte", () => {
    const text = carrier("x", A(), B());
    const pieces = splitSlots(text)!;
    expect(pieces.map((p) => p.key)).toEqual(["head", "slot:#/a", "after:#/a", "slot:#/b", "after:#/b"]);
    expect(pieces.map((p) => p.text).join("")).toBe(text);
  });
  test("a nested slot rides inside its parent", () => {
    const text = carrier("x", ["<<~ ahu slot=`#/a`>>", ...slot("a/inner", "inner."), "<<~/ahu>>", ""]);
    expect(keys(text)).toEqual(["head", "slot:#/a", "after:#/a"]);
  });
  test("an opener in a fence, inline, or as a kahea call cuts nothing", () => {
    const text = carrier("x", ["```", "<<~ ahu slot=`#/quoted`>>", "```", "say `<<~ ahu slot=`#/inline`>>` here", "<<~ kahea ahu slot=`#/a`>>", ""]);
    expect(keys(text)).toEqual(["head"]);
  });
  test("an opener never closed, a closer with nothing open, or one slot declared twice reads null", () => {
    expect(splitSlots("<<~ ahu slot=`#/a`>>\nbody\n")).toBeNull();
    expect(splitSlots("body\n<<~/ahu>>\n")).toBeNull();
    expect(splitSlots(carrier("x", A(), A()))).toBeNull();
  });
});

describe("mergeSlots", () => {
  const run = (base: string, ours: string, theirs: string) => mergeSlots({ base, ours, theirs, path: "c.mem", lineMerge: mergeTexts });

  test("two slots added at one place both land, ours first, where a line merge conflicts", () => {
    const base = carrier(null, A(), C());
    const ours = carrier(null, A(), slot("ours", "ours."), C());
    const theirs = carrier(null, A(), slot("theirs", "theirs."), C());
    expect(mergeTexts({ base, ours, theirs }).conflicts).toBeGreaterThan(0);
    const r = run(base, ours, theirs);
    expect(r.conflicts).toBe(0);
    expect(r.text).toBe(carrier(null, A(), slot("ours", "ours."), slot("theirs", "theirs."), C()));
  });
  test("a slot one side moved takes that side; a slot both moved line-merges alone", () => {
    const base = carrier(null, A(), slot("b", "one.", "", "two."), C());
    const ours = carrier(null, A("a turns."), slot("b", "one turns.", "", "two."), C());
    const theirs = carrier(null, A(), slot("b", "one.", "", "two turns."), C("c turns."));
    const r = run(base, ours, theirs);
    expect(r.conflicts).toBe(0);
    expect(r.text).toBe(carrier(null, A("a turns."), slot("b", "one turns.", "", "two turns."), C("c turns.")));
  });
  test("a slot one side dropped leaves where the other side held it at base", () => {
    const base = carrier(null, A(), B(), C());
    const r = run(base, carrier(null, A(), C()), carrier(null, A(), B(), C("c turns.")));
    expect(r.conflicts).toBe(0);
    expect(r.text).toBe(carrier(null, A(), C("c turns.")));
  });
  test("a slot one side dropped while the other moved it conflicts over the whole text", () => {
    const base = carrier(null, A(), B(), C());
    const r = run(base, carrier(null, A(), C()), carrier(null, A(), B("b turns."), C()));
    expect(r.conflicts).toBeGreaterThan(0);
    expect(r.conflicted).toEqual(["*"]);
  });
  test("a slot both moved into overlap conflicts, named by its key", () => {
    const base = carrier(null, A(), B(), C());
    const r = run(base, carrier(null, A(), B("b one way."), C()), carrier(null, A(), B("b the other way."), C()));
    expect(r.conflicted).toEqual(["slot:#/b"]);
    expect(r.text).toMatch(/^<<<<<<< c\.mem$/m);
  });
});

describe("mergeCarrier", () => {
  const run = (base: string, ours: string, theirs: string, sealer: MemeSealer | null = seal) =>
    mergeCarrier({ base, ours, theirs, path: "c.mem", markerSize: 7, lineMerge: mergeTexts, seal: sealer });

  test("a plain clean merge stands as it merged, the sealer untouched", () => {
    const base = carrier("x", A(), B());
    const r = run(base, carrier("y", A("a turns."), B()), base, () => { throw new Error("no seal owed"); });
    expect(r).toEqual({ resolved: true, text: carrier("y", A("a turns."), B()) });
  });
  test("a seal conflict alone re-seals the merged body", () => {
    const r = run(carrier("x", A(), B()), carrier("y", A("a turns."), B()), carrier("z", A(), B("b turns.")));
    expect(r).toEqual({ resolved: true, text: carrier("sealed", A("a turns."), B("b turns.")) });
  });
  test("a conflict beyond the seal answers the plain merge over the original sides, naming the slot", () => {
    const base = carrier("x", A(), B());
    const ours = carrier("y", A(), B("b one way."));
    const theirs = carrier("z", A(), B("b the other way."));
    const r = run(base, ours, theirs);
    expect(r.resolved).toBe(false);
    expect(r.text).toBe(mergeTexts({ base, ours, theirs, path: "c.mem" }).text);
    expect(r.resolved === false && r.why).toMatch(/beyond the seal in #\/b/);
  });
  test("no sealer, or a sealer that refuses, leaves the conflict standing", () => {
    const sides = [carrier("x", A(), B()), carrier("y", A("a turns."), B()), carrier("z", A(), B("b turns."))] as const;
    expect(run(...sides, null)).toMatchObject({ resolved: false, why: "the normalize shore does not answer" });
    expect(run(...sides, () => ({ ok: false, why: "torn frame" }))).toMatchObject({ resolved: false, why: "torn frame" });
  });
});
