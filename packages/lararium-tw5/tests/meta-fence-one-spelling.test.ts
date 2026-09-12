/**
 * meta-fence — ONE opener, read the same way by every reader that reads it.
 *
 * ── THE GHOST THIS CLOSES ───────────────────────────────────────────────────────────────────────
 * The `toml meta` opener was spelled seven ways across the tree, differing on four axes: the
 * separator between `toml` and `meta`, what may trail it, whether the line is anchored, and how the
 * fence closes. Five readers demanded exactly one space; the deserializer admitted `[ \t]+`.
 *
 * So a carrier written with two spaces DESERIALIZED WITH ITS FIELDS and read `meta:false` to the
 * shape reader — kind `shelf` when a head stood, `unframed` when none did. The file held its
 * identity at one gate and lost it at every other, which is the instrument-lie the gradient exists
 * to surface and instead produced.
 *
 * ── THE LAW ─────────────────────────────────────────────────────────────────────────────────────
 * RECOGNITION IS PERMISSIVE, CANON IS STRICT, DEVIATION IS LOUD. A reader admits `[ \t]+` between
 * `toml` and `meta` and `[ \t]*` after it, so no carrier goes invisible over whitespace; the canon
 * stays exactly one space, which is how 733 of 733 openers in the corpus and every emitter write it;
 * and a carrier spelled otherwise carries a FAULT naming the canon, so normalize can repair it.
 *
 * Never `\s`. An opener does not cross a newline: `\s+` would make ```toml\nmeta a match, and `\s*`
 * after the label swallows the blank line beneath the opener into the opener itself.
 *
 * THE CLOSE IS NOT SHARED and is not touched here. `carrier-shape` wants a body string, the
 * deserializer wants a span with offsets — one regex for both would silently move `findMetaFence`'s
 * `content` and `end`, and byte-exact round-trip rests on those.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */

import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { readCarrierShape } from "../src/carrier-shape.js";
import { declaresCarrier, currentCarrierFiles } from "../src/carrier-files.js";
import { REPO } from "./test-wiki.js";
import { transposeMarkdown } from "../src/meme-markdown.js";
import { memeticWikitextDeserializer } from "../src/deserializer.js";
import { META_OPEN_CANON } from "../src/meta-fence.js";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";

const DECL = "<<!DOCTYPE \"memetic-wikitext+tiddlywiki\" \"lar:///ha.ka.ba/lares/api/pono/memetic-wikitext\">>";
const HEAD = '<<^ code="&#x0001;" from=? -> to=lar:///ha.ka.ba/x/y>>';

/** A whole carrier whose meta opener is spelled `open`. Everything else is held constant. */
const carrier = (open: string) =>
  `${DECL}\n\n${HEAD}\n${open}\nuri-path = "ha.ka.ba/x/y"\ntype = "${CARRIER_TYPE}"\n\`\`\`\n\n` +
  `<<^ code="&#x0002;">>\n\n<<~ ahu #a>>\n\nbody\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

/**
 * The five readers that must agree, each reached through its own door.
 *
 * Reader 3 STRIPS THE DECLARATION FIRST, and that is load-bearing. 729 of 730 carriers are found by
 * `declaresCarrier` through their DOCTYPE, so an unstripped fixture is green for a reason that has
 * nothing to do with the fence — a red for the wrong reason feels identical to a red for the right one.
 */
const READERS: readonly { name: string; reads: (text: string) => boolean }[] = [
  { name: "shape.marks.meta",         reads: (t) => readCarrierShape(t).marks.meta },
  { name: "shape.marks.uriPath",      reads: (t) => readCarrierShape(t).marks.uriPath !== null },
  { name: "declaresCarrier (no DOCTYPE)", reads: (t) => declaresCarrier(t.replace(`${DECL}\n\n`, "")) !== null },
  { name: "deserializer fields",      reads: (t) => memeticWikitextDeserializer(t, {}).some((r) => r["uri-path"] === "ha.ka.ba/x/y") },
  { name: "markdown drops the fence", reads: (t) => !transposeMarkdown(t).markdown.includes("uri-path") },
];

/** Every reader's verdict on one text, as a name→boolean record — so a failure names WHICH reader. */
const verdicts = (text: string) =>
  Object.fromEntries(READERS.map((r) => [r.name, r.reads(text)])) as Record<string, boolean>;

const allTrue  = Object.fromEntries(READERS.map((r) => [r.name, true]));
const allFalse = Object.fromEntries(READERS.map((r) => [r.name, false]));

describe("the meta fence has ONE opener, and every reader reads it the same", () => {
  /**
   * RED BEFORE THE COLLAPSE. Two spaces and a tab deserialize with their fields while every other
   * reader calls the carrier unmarked — the divergence, stated as the failure it is.
   */
  test.each([
    ["one space  (canon)",     "```toml meta"],
    ["two spaces",             "```toml  meta"],
    ["a tab",                  "```toml\tmeta"],
    ["one space, one trailing", "```toml meta "],
  ])("a meta fence spelled with %s is read by every reader", (_label, open) => {
    expect(verdicts(carrier(open))).toEqual(allTrue);
  });

  /**
   * CONTROL 2 — THE ONE THAT MATTERS. A permissive opener is one mask error away from counting a
   * ````-quoted teaching example as the file's own declaration. A mask that refused every span once
   * erased 840 of the corpus's 852 meta reads; this is the assertion that catches the mirror fault.
   *
   * The quoted example is spelled in EVERY admitted spelling, because a collapse that widened the
   * separator without keeping `allowSpanStart`'s interior refusal would leak exactly here.
   */
  test.each([
    ["one space",  "```toml meta"],
    ["two spaces", "```toml  meta"],
    ["a tab",      "```toml\tmeta"],
  ])("a ````-quoted example spelled with %s is never the file's own declaration", (_label, open) => {
    const taught =
      `${DECL}\n\n${HEAD}\n\n\`\`\`\`\nA lesson shows one:\n${open}\nuri-path = "ha.ka.ba/not/this"\n\`\`\`\n\`\`\`\`\n`;
    expect(readCarrierShape(taught).marks.meta, "a quoted declaration counted as the file's own").toBe(false);
    expect(readCarrierShape(taught).marks.uriPath).toBeNull();
  });

  /**
   * CONTROL 3 — the matcher refuses what it should. `\s` would admit the third of these, which is
   * why the recognition class is `[ \t]` and never `\s`: an opener does not cross a newline.
   */
  test.each([
    ["no separator at all", "```tomlmeta"],
    ["a word after meta",   "```toml meta extra"],
    ["a newline inside",    "```toml\nmeta"],
    ["the wrong label",     "```toml met"],
  ])("a fence spelled with %s is not a meta fence", (_label, open) => {
    expect(verdicts(carrier(open))).toEqual(allFalse);
  });

  /**
   * CONTROL 1 restated at the fixture level — the harness reads something. A test whose readers all
   * answer `false` for every input passes CONTROL 3 trivially and means nothing.
   */
  test("the canonical spelling is the one the corpus writes", () => {
    expect(META_OPEN_CANON).toBe("```toml meta");
    expect(verdicts(carrier(META_OPEN_CANON))).toEqual(allTrue);
  });

  /**
   * CONTROL 4 — the close-fence stayed put. `findMetaFence` hands back `start`/`end`/`content` and
   * the round-trip render rests on them, so a canonical carrier must survive the projection whole.
   */
  test("a canonical carrier still round-trips through the deserializer whole", () => {
    const recs = memeticWikitextDeserializer(carrier(META_OPEN_CANON), {});
    const root = recs.find((r) => r["uri-path"] === "ha.ka.ba/x/y");
    expect(root, "the root record vanished").toBeDefined();
    expect(root!["type"]).toBe(CARRIER_TYPE);
    expect(recs.some((r) => String(r["text"] ?? "").includes("body"))).toBe(true);
  });
});

/**
 * ADMITTED, THEN FAULTED — the other half of the law.
 *
 * Permissive recognition alone would let a deviant spelling stand forever: it parses, so nothing ever
 * says otherwise, and the corpus drifts one file at a time. The gradient names the canon instead, so
 * `meme-normalize` has something to repair and a witness has something to report. Admission keeps the
 * file visible; the fault keeps the corpus one-spaced.
 */
describe("a deviant spelling is ADMITTED and then FAULTED", () => {
  test.each([
    ["two spaces",       "```toml  meta"],
    ["a tab",            "```toml\tmeta"],
    ["a trailing space", "```toml meta "],
  ])("a meta fence spelled with %s carries a canon fault", (_label, open) => {
    const shape = readCarrierShape(carrier(open));
    // ADMITTED — the file keeps its identity, or the fault is just a rejection wearing a nicer name.
    expect(shape.marks.meta, "a deviant spelling must still be READ").toBe(true);
    expect(shape.kind).toBe("carrier");
    // FAULTED — and the fault states the canon, so a repair reads off the finding.
    expect(shape.faults.join(" | ")).toMatch(/meta fence/i);
    expect(shape.faults.join(" | ")).toContain(META_OPEN_CANON);
  });

  /** CONTROL — the canon carries no such fault, or the fault distinguishes nothing. */
  test("the canonical spelling carries no fence fault", () => {
    const shape = readCarrierShape(carrier(META_OPEN_CANON));
    expect(shape.faults.filter((f) => /meta fence/i.test(f))).toEqual([]);
  });

  /**
   * CONTROL — the whole live corpus stands in canon and gains NOT ONE fault from this reading. The
   * fixtures above prove the fault fires; only the corpus proves it does not fire on the house.
   */
  test("no carrier in the corpus carries a fence fault", () => {
    const files = currentCarrierFiles(REPO);
    expect(files.length).toBeGreaterThan(500);
    const faulted = files
      .map((f) => [f, readCarrierShape(readFileSync(join(REPO, f), "utf8")).faults] as const)
      .filter(([, faults]) => faults.some((x) => /meta fence/i.test(x)))
      .map(([f]) => f);
    expect(faulted).toEqual([]);
  });
});
