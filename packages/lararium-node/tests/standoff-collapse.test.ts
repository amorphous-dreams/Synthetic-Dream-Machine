/**
 * THE PERSON'S COLLAPSE RULES: which stand-offs settle with no hand present, read from the daemon face's config tiddlers.
 *
 * Each rule reads its own tiddler (`$:/config/lares/shore/collapse/<rule>`) and collapses only in the bags its `bags`
 * list names. A rule left absent collapses nothing. `slot-disjoint` merges by slot alone: two sides that moved one slot
 * stay a stand-off however their lines fall; `line-three-way` rides only behind its own tiddler.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { canonicalizeCarrierText } from "@lararium/tw5/carrier-canonical";
import { bareSeal } from "@lararium/mesh/meme-merge";
import { mkManifest } from "@lararium/mesh";
import {
  COLLAPSE_RULES, collapseConfigOf, collapseRuleTitle, decideCollapse, foldWhitespace, memeSealer, rulesFor,
  type CollapseRule,
} from "../src/standoff-collapse.js";

const REPO = new URL("../../..", import.meta.url).pathname;
const URI = "lar:///ha.ka.ba/lares/api/pono/tick";
const BASE = readFileSync(`${REPO}bags/lares/ha.ka.ba/lares/api/pono/tick.mem`, "utf8");
const BAG = "lar:///ha.ka.ba/bags/lares";
const canonical = (t: string): string | null => canonicalizeCarrierText(URI, t);
const sealed = (t: string): string => { const s = memeSealer(t); if (!s.ok) throw new Error(s.why); return s.text; };

/** The hand's midnight edit to the file: a line in the head slot. */
const disk = sealed(BASE.replace("Device lifecycle hook: run this block once per //nalu//", "Device lifecycle hook (the hand's midnight words): run this block once per //nalu//"));
/** The seat's append to the records: a line at the end of the edges slot. */
const records = sealed(BASE.replace("<<~ loulou uri=`lar:///ha.ka.ba/lares/api/pono/nalu`>>\n", "<<~ loulou uri=`lar:///ha.ka.ba/lares/api/pono/nalu`>>\n\nThe seat appended this line.\n"));
/** A records edit to the SAME slot the hand moved. */
const sameSlot = sealed(BASE.replace("The concurrency runtime stands before it on the founding road", "The concurrency runtime, as the seat reads it, stands before it on the founding road"));

const on = (...rules: CollapseRule[]): ReadonlySet<CollapseRule> => new Set(rules);
const input = (rules: ReadonlySet<CollapseRule>, over: Partial<Parameters<typeof decideCollapse>[0]> = {}) =>
  ({ base: BASE, records, disk, ext: ".mem", path: "tick.mem", rules, canonical, ...over });

describe("the person's rules rest in their daemon face", () => {
  test("each rule reads its own tiddler's bags list; an absent tiddler enables nowhere", () => {
    const rows: Record<string, Record<string, unknown>> = {
      [collapseRuleTitle("slot-disjoint")]: { bags: `${BAG} [[lar:///ha.ka.ba/wikis/x/working]]` },
      [collapseRuleTitle("whitespace-only")]: { bags: "" },
    };
    const config = collapseConfigOf((t) => rows[t] ?? null);
    expect([...rulesFor(config, BAG)]).toEqual(["slot-disjoint"]);
    expect([...rulesFor(config, "lar:///ha.ka.ba/wikis/x/working")]).toEqual(["slot-disjoint"]);
    expect(rulesFor(config, "lar:///ha.ka.ba/bags/other").size).toBe(0);
    expect(rulesFor(null, BAG).size).toBe(0);
    expect(COLLAPSE_RULES.map(collapseRuleTitle)).toContain("$:/config/lares/shore/collapse/line-three-way");
  });
});

describe("the rules ride a wiki island's manifest, read from the worn face's daemon wiki", () => {
  test("the manifest carries the rules it was handed, and none where none stand", () => {
    const { port1 } = new MessageChannel();
    const recipe = { wikiSlug: "notes" } as unknown as Parameters<typeof mkManifest>[2];
    const grants = {} as Parameters<typeof mkManifest>[3];
    expect(mkManifest("w", port1, recipe, grants, null, { shoreCollapse: { "slot-disjoint": [BAG] } }).shoreCollapse).toEqual({ "slot-disjoint": [BAG] });
    expect("shoreCollapse" in mkManifest("w", port1, recipe, grants, null, { shoreCollapse: {} })).toBe(false);
    port1.close();
  });
});

describe("the midnight story: a hand's disk edit and a seat's append to different slots", () => {
  test("slot-disjoint collapses it, and both edits survive in the merged words", () => {
    const v = decideCollapse(input(on("slot-disjoint")));
    expect(v.collapsed).toBe(true);
    if (!v.collapsed) return;
    expect(v.rule).toBe("slot-disjoint");
    expect(v.toward).toBe("merged");
    expect(v.text).toContain("the hand's midnight words");
    expect(v.text).toContain("The seat appended this line.");
  });

  test("a disabled rule collapses nothing", () => {
    const v = decideCollapse(input(on()));
    expect(v).toEqual({ collapsed: false, why: "no collapse rule stands enabled for this bag" });
    expect(decideCollapse(input(on("whitespace-only", "seal-line-only"))).collapsed).toBe(false);
  });

  test("no base's words in history: slot-disjoint cannot read which side moved, and collapses nothing", () => {
    const v = decideCollapse(input(on("slot-disjoint"), { base: null }));
    expect(v.collapsed).toBe(false);
    if (!v.collapsed) expect(v.why).toMatch(/no history holds the base/);
  });
});

describe("a same-slot conflict stays a stand-off", () => {
  test("slot-disjoint never line-merges inside one slot, though git would merge those lines clean", () => {
    const v = decideCollapse(input(on("slot-disjoint"), { records: sameSlot }));
    expect(v.collapsed).toBe(false);
    if (!v.collapsed) expect(v.why).toMatch(/slot-disjoint/);
  });

  test("line-three-way, enabled by its own tiddler, merges clean hunks and keeps both lines", () => {
    const v = decideCollapse(input(on("line-three-way"), { records: sameSlot }));
    expect(v.collapsed).toBe(true);
    if (v.collapsed) {
      expect(v.rule).toBe("line-three-way");
      expect(v.text).toContain("the hand's midnight words");
      expect(v.text).toContain("as the seat reads it");
    }
  });

  test("an overlapping same-line edit stays a stand-off even under line-three-way", () => {
    const rival = sealed(BASE.replace("Device lifecycle hook: run this block once per //nalu//", "Device lifecycle hook (the seat's rival words): run this block once per //nalu//"));
    const v = decideCollapse(input(on("slot-disjoint", "line-three-way"), { records: rival }));
    expect(v.collapsed).toBe(false);
  });
});

describe("the narrow rules", () => {
  test("seal-line-only takes the records' seal; the words stand equal", () => {
    const stale = disk.replace(/bcc=`[^`]*`/, "bcc=`ni:///sha-256;stale`");
    const v = decideCollapse(input(on("seal-line-only"), { records: disk, disk: stale }));
    expect(v).toMatchObject({ collapsed: true, rule: "seal-line-only", toward: "records" });
  });

  test("whitespace-only lands the file's words", () => {
    const spaced = bareSeal(disk).replace("! \\tick\n", "! \\tick   \n\n\n");
    expect(foldWhitespace(spaced)).toBe(foldWhitespace(bareSeal(disk)));
    const v = decideCollapse(input(on("whitespace-only"), { records: disk, disk: spaced }));
    expect(v).toMatchObject({ collapsed: true, rule: "whitespace-only", toward: "disk" });
  });

  test("canonical-equivalent reads the memetic congruence", () => {
    const v = decideCollapse(input(on("canonical-equivalent"), { records: disk, disk: bareSeal(disk) }));
    expect(v).toMatchObject({ collapsed: true, rule: "canonical-equivalent", toward: "records" });
  });

  test("a merge that already says the records' words settles toward the records", () => {
    // The second weighing after a collapse landed its merge: the records hold the merge, the file the hand's words.
    const first = decideCollapse(input(on("slot-disjoint")));
    if (!first.collapsed) throw new Error("the first weighing collapsed nothing");
    const again = decideCollapse(input(on("slot-disjoint"), { records: first.text }));
    expect(again).toMatchObject({ collapsed: true, toward: "records" });
  });
});
