/**
 * carrier-shape — the reading that names how far down the ingest gradient a file sits.
 *
 * `bcc-witness` reads the check, `meme-coordinates` reads the coordinates, `round-trip` reads the
 * render. Each of them walks the corpus by `uri-path` and skips anything that declares none, so a file
 * that lost its address was invisible to all three at once: seventeen carriers sat outside every gate
 * while each gate called itself corpus-wide.
 *
 * The gradient reading is the one that opens those. It fails on a FAULT and never on a KIND — a bag
 * descriptor carries no body frame because it holds no meme's text, and that is the shape it should be.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */

import { describe, expect, test } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { readCarrierShape } from "../src/carrier-shape.js";
// The fence-mask law surfaces through the SHORE, never through meme-ast internals — the boundary
// this package holds (vm-grammar-boundary.test.ts). The walk below shares the mask with the reader
// it measures on purpose: a lesson that quotes a frame writes no frame on either side of the
// comparison, and the CODE SET is the one thing being held apart.
import { fencedSpans, maskedExecAll } from "../src/deserializer.js";
import { frameMark } from "../src/frame-marks.js";
import { carrierFiles } from "../src/carrier-files.js";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import { REPO } from "./test-wiki.js";

const DECL = "<<!DOCTYPE \"memetic-wikitext+tiddlywiki\" \"lar:///ha.ka.ba/lares/api/pono/memetic-wikitext\">>";
/** The head sigil as the CORPUS writes it — the far side is a named `to=` field, and every carrier
 *  names it (639 when measured, 724 now; the test below asks the corpus rather than this number).
 *  A fixture in the bare form is legal grammar and measures a shape no file has. */
const head = (uri: string, ns = "") =>
  `<<^ code="&#x0001;"${ns ? ` namespace="${ns}"` : ""} from=? -> to=${uri}>>`;

describe("carrier-shape — the kind a file declares, and what that kind owes", () => {
  /**
   * THE ARROW CARRIES A `>`, and a head scan that forgets it reads every carrier as unframed. Measured:
   * a first cut of this reader reported all 617 corpus files headless and faulted 610 of them.
   */
  test("a head sigil is found through its own bearing arrow", () => {
    const shape = readCarrierShape(`${DECL}\n\n${head("lar:///ha.ka.ba/x/y")}\n`);
    expect(shape.marks.head).toBe(true);
    expect(shape.marks.headUri).toBe("lar:///ha.ka.ba/x/y");
  });

  /** The bare form stays legal, so the reader must not REQUIRE the field it now strips. */
  test("an unnamed far side reads the same address", () => {
    const bare = `${DECL}\n\n<<^ code="&#x0001;" ? -> lar:///ha.ka.ba/x/y>>\n`;
    expect(readCarrierShape(bare).marks.headUri).toBe("lar:///ha.ka.ba/x/y");
  });

  /**
   * THE CORPUS IS THE SPEC. A reader green against a hand-built fixture said nothing about the files:
   * this one asks every carrier and refuses an address carrying a field name into itself.
   */
  test("no carrier's head address carries a field name into it", () => {
    const files = carrierFiles(REPO);
    const mangled = files
      .map((f) => [f, readCarrierShape(readFileSync(path.join(REPO, f), "utf8")).marks.headUri] as const)
      .filter(([, u]) => u !== null && !u.startsWith("lar:"))
      .map(([f, u]) => `${f} — ${u}`);
    expect(files.length).toBeGreaterThan(500);
    expect(mangled).toEqual([]);
  });

  /**
   * A DECLARATION OPENS A FENCE, so its opener sits at a mask span's start and a plain masked read
   * rejects it — while a declaration quoted INSIDE a lesson must still not count.
   */
  test("the declaration is read at its own fence, and a quoted one is not", () => {
    const real = `${DECL}\n\n${head("lar:///ha.ka.ba/x/y")}\n\`\`\`toml meta\nuri-path = "ha.ka.ba/x/y"\ntype = "${CARRIER_TYPE}"\n\`\`\`\n`;
    expect(readCarrierShape(real).marks.meta).toBe(true);
    expect(readCarrierShape(real).marks.uriPath).toBe("ha.ka.ba/x/y");

    const taught = `${DECL}\n\n${head("lar:///ha.ka.ba/x/y")}\n\n\`\`\`\`\nA lesson shows one:\n\`\`\`toml meta\nuri-path = "ha.ka.ba/not/this"\n\`\`\`\n\`\`\`\`\n`;
    expect(readCarrierShape(taught).marks.meta, "a quoted declaration counted as the file's own").toBe(false);
  });

  test("the kind reads from what a file DECLARES, never from where it rests", () => {
    const of = (meta: string) => readCarrierShape(`${DECL}\n\n${head("lar:///ha.ka.ba/x/y")}\n\`\`\`toml meta\n${meta}\n\`\`\`\n`).kind;
    expect(of('uri-path = "ha.ka.ba/x/y"')).toBe("carrier");
    expect(of('bag = "lares"')).toBe("descriptor");
    expect(of('collection = "kumulipo"')).toBe("shelf");
    expect(readCarrierShape(`${DECL}\n\nbare prose\n`).kind).toBe("unframed");
  });

  /**
   * THE FAULT THAT MADE EVERY OTHER GATE BLIND: a head that names an address the declaration never
   * states. The file renders, round-trips, and is skipped by every corpus walk keyed on `uri-path`.
   */
  test("a head that names an address the declaration never states reads as the fault it is", () => {
    const shelf = readCarrierShape(`${DECL}\n\n${head("lar:///ha.ka.ba/library/x")}\n\`\`\`toml meta\ncollection = "x"\n\`\`\`\n`);
    expect(shelf.kind).toBe("shelf");
    expect(shelf.faults.join(" ")).toContain("every corpus gate skips it");
  });

  test("a bag descriptor carrying no body frame stands at its floor, not below it", () => {
    const d = readCarrierShape(
      `${DECL}\n\n${head("lar:///ha.ka.ba/bags/lares")}\n\`\`\`toml meta\nbag = "lares"\n\`\`\`\n\nprose\n\n<<^ code="&#x0004;" -> to=?>>\n`,
    );
    expect(d.kind).toBe("descriptor");
    expect(d.faults, "a descriptor faulted for lacking a body it never holds").toEqual([]);
  });

  /** The corpus itself: no file may sit below the floor of the kind it declares. */
  test("every carrier in the corpus stands at its kind's floor", () => {
    const files = carrierFiles(REPO);
    const below = files
      .map((f) => [f, readCarrierShape(readFileSync(path.join(REPO, f), "utf8"))] as const)
      .filter(([, s]) => s.faults.length > 0)
      .map(([f, s]) => `${f} — ${s.faults.join("; ")}`);
    expect(files.length).toBeGreaterThan(500);
    expect(below).toEqual([]);
  });

  /**
   * THE FILES NO GATE WALKS. Every instrument in this tree lists `bags/**\/*.mem`, so a file under a
   * bag with any other extension is read by nothing — not the check, not the coordinates, not the
   * round-trip, and not the gradient above, which classifies whatever it is handed and was never
   * handed these.
   *
   * Thirty-nine stand: 36 `.md` from before the corpus poured, two `.tid`, one `.py`. Two of the `.md` carry
   * a head sigil and are the glyph-definition drafts `period-forms` keeps verbatim, so they read as
   * `shelf` rather than `unframed` — the law and the reading agree without either being told.
   *
   * A CEILING, not a floor: converting one lowers it, and a new uncarried file raises it. ''Lower it
   * whenever it can go lower'' — a ceiling left slack absorbs the next gap silently, which is what the
   * unnamed-carrier count did for a corpus that had shrunk from seventeen to seven beneath it. The sidecar
   * pair is excluded the way `lares meme check --gradient` excludes it — a content file declaring
   * itself in a `.meta` beside it carries no frame of its own and never should.
   */
  test("no more files stand under a bag uncarried than already did", () => {
    const tracked = execSync("git ls-files bags", { encoding: "utf8", cwd: REPO })
      .split("\n").filter(Boolean).filter((f) => !f.endsWith(".gitkeep"));
    const declared = new Set(tracked.filter((f) => f.endsWith(".meta")).map((f) => f.slice(0, -5)));
    const uncarried = tracked.filter((f) =>
      !f.endsWith(".mem") && !f.endsWith(".meta") && !declared.has(f));
    expect(tracked.length).toBeGreaterThan(600);
    expect(uncarried.length, `an uncarried file appeared — run \`lares meme check --gradient $(git ls-files bags)\``)
      .toBeLessThanOrEqual(39);
  });

  /**
   * TORN NEVER READS AS UNCHECKED. A file cut ahead of its closer loses its ETX and its check with it —
   * and a reader that files that under "no check present" hands an adversary the cheapest strip there
   * is. The frame's standing distinguishes a transmission that never carried a check from one that lost
   * its tail, and the gradient faults the second.
   */
  test("a torn frame reads as truncated, never as unchecked", () => {
    const torn = `${DECL}\n\n${head("lar:///ha.ka.ba/x/y")}\n\`\`\`toml meta\nuri-path = "ha.ka.ba/x/y"\ntype = "${CARRIER_TYPE}"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\nbody cut mid-transmissi`;
    const shape = readCarrierShape(torn);
    expect(shape.marks.check).toBe("torn");
    expect(shape.faults.join(" ")).toContain("torn reads as truncated");
  });

  /**
   * ONE TEXT FRAME PER CARRIER. The check covers the first STX..ETX span only, so a second frame would
   * ride beneath a verdict computed over the first — the smuggling shape, surfaced as a fault rather
   * than blessed by the first frame's `ok`.
   */
  test("a second text frame surfaces as a fault rather than riding beneath the first frame's verdict", () => {
    const two = `${DECL}\n\n${head("lar:///ha.ka.ba/x/y")}\n\`\`\`toml meta\nuri-path = "ha.ka.ba/x/y"\ntype = "${CARRIER_TYPE}"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\nfirst body\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0002;">>\n\nsmuggled body\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;
    const shape = readCarrierShape(two);
    expect(shape.faults.join(" ")).toContain("2 text frames");
  });

  /** ADJACENT, EXACTLY. A check shifted off its closer by even one space does not verify — slack there
   *  would let two byte-different files share one verdict, the class the span law exists to close. */
  test("a shifted check does not verify", () => {
    const base = `${DECL}\n\n${head("lar:///ha.ka.ba/x/y")}\n\`\`\`toml meta\nuri-path = "ha.ka.ba/x/y"\ntype = "${CARRIER_TYPE}"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\nbody\n\n<<^ code="&#x0003;">>`;
    const good = readCarrierShape(`${base}ni:///sha-256;AAAA\n\n<<^ code="&#x0004;" -> to=?>>\n`);
    expect(good.marks.check).toBe("mismatch");   // adjacent but wrong digest — SEEN, judged
    const shifted = readCarrierShape(`${base} ni:///sha-256;AAAA\n\n<<^ code="&#x0004;" -> to=?>>\n`);
    expect(shifted.marks.check).toBe("unchecked"); // one space off — not a check at all
  });



});


// ── THE CODE SET, COLLIDED AGAINST THE CORPUS ───────────────────────────────────────────────────
//
// `carrier-shape` reads its STX · ETX · EOT scans off `frameAlt`, so the SET travels from the one
// declaration while each scan keeps the shape its own context earned. The probe walk in
// `carrier-head.test.ts` proves the set REACHES this reader — push a mark into the declaration and
// this reader sees it. That walk drives fixtures, and a fixture pins the GRAMMAR, never the READER.
//
// So this walk asks the files. For every carrier the corpus stands, it reads the frame entities the
// file actually WRITES — independently, off the sigil spans, with no alternation anywhere near it —
// and asks whether the reader answers the same on all three marks. An alternation that reads MORE
// forms than the corpus writes, or FEWER, surfaces here as a disagreement naming the file.
//
// THE FLOORS ARE THE POINT. A gate that stops seeing its subject reports the cleanest run it ever
// produced, so each mark carries a floor on how many corpus files carry it. Raise a floor whenever
// the corpus lets it rise; never lower one to make a run green.
describe("the frame codes the reader takes are the frame codes the corpus writes", () => {
  /** Every frame sigil in a text, outside any quote fence. */
  const SIGIL = /<<\^(?:[^>\n]|>(?!>))*>>/g;

  /**
   * Which mark FAMILIES a file writes — read off the sigils themselves, never off an alternation.
   *
   * The reading is deliberately naive: find the control sigils, collect every `&#xNNNN;` entity
   * standing inside one, and ask the DECLARATION which family each names. It shares the fence mask
   * with the reader under test (a lesson that quotes a frame writes no frame), and shares nothing
   * else — which is what lets a disagreement mean something.
   */
  function familiesWritten(text: string): { stx: boolean; etx: boolean; eot: boolean } {
    const spans = fencedSpans(text);
    const names = new Set<string>();
    for (const sig of maskedExecAll(text, SIGIL, spans)) {
      for (const ent of sig[0].matchAll(/&#x[0-9A-Fa-f]{4};/g)) {
        const mark = frameMark(ent[0]);
        if (mark) names.add(mark.name);
      }
    }
    const has = (family: string): boolean => [...names].some((n) => n.startsWith(family));
    return { stx: has("STX"), etx: has("ETX"), eot: has("EOT") };
  }

  test("★ every corpus carrier's marks read exactly as that carrier spells them ★", () => {
    const files = carrierFiles(REPO);
    const carried = { stx: 0, etx: 0, eot: 0 };
    const disagreed: string[] = [];
    for (const f of files) {
      const text = readFileSync(path.join(REPO, f), "utf8");
      const written = familiesWritten(text);
      const { stx, etx, eot } = readCarrierShape(text).marks;
      if (written.stx) carried.stx++;
      if (written.etx) carried.etx++;
      if (written.eot) carried.eot++;
      if (stx !== written.stx || etx !== written.etx || eot !== written.eot) {
        disagreed.push(`${f} — writes ${JSON.stringify(written)}, reads ${JSON.stringify({ stx, etx, eot })}`);
      }
    }
    // THE FLOOR ON THE WALK ITSELF. Zero files walked and zero disagreements reads identical to a
    // clean corpus, and the second one is the answer this test exists to earn. Measured: 694 · 694 · 700
    // of 724 — raise these whenever the corpus lets them rise.
    expect(files.length).toBeGreaterThan(500);
    expect(carried.stx).toBeGreaterThanOrEqual(690);
    expect(carried.etx).toBeGreaterThanOrEqual(690);
    expect(carried.eot).toBeGreaterThanOrEqual(695);
    expect(disagreed, `the reader's code set drifted from the corpus:\n${disagreed.join("\n")}`).toEqual([]);
  });

  /**
   * THE THIN CODES ARE WHERE A FAMILY DIES QUIETLY.
   *
   * MEASURED over 724 carriers: `&#x0001;` 699 · `&#x0002;` 694 · `&#x0003;` 694 · `&#x0004;` 700 —
   * and `&#x0011;` (SOH2) in ONE file, `&#x0014;` (EOT2) in ONE file. A family floor of 690 stays
   * green while a reader silently drops the second code of a family, because dropping it costs at
   * most one carrier. So the tally runs per CODE.
   *
   * AND THE THIN CODES NEVER STAND ALONE. `kapu.mem` writes `&#x0014;` on the line BELOW its
   * `&#x0004;`, so no corpus carrier's marks turn on the second EOT code and no walk over the corpus
   * as it stands can catch a reader that drops it. Named, not papered over — the substitution walk
   * below is what carries those teeth, and the probe walk in `carrier-head.test.ts` carries the rest.
   *
   * `&#x0017;` (ETB) stands in the declaration and no corpus carrier writes it, so it carries no
   * floor here — an absent count states a fact, and inventing a floor for it would state a false one.
   */
  test("★ the thin codes still stand in the corpus, or the walk above lost its teeth ★", () => {
    const tally = new Map<string, number>();
    for (const f of carrierFiles(REPO)) {
      const text = readFileSync(path.join(REPO, f), "utf8");
      const seen = new Set<string>();
      for (const sig of maskedExecAll(text, SIGIL, fencedSpans(text))) {
        for (const ent of sig[0].matchAll(/&#x[0-9A-Fa-f]{4};/g)) seen.add(ent[0]);
      }
      for (const c of seen) tally.set(c, (tally.get(c) ?? 0) + 1);
    }
    const undeclared = [...tally.keys()].filter((c) => frameMark(c) === undefined);
    expect(undeclared, "a corpus carrier writes a control code the declaration stands nowhere").toEqual([]);
    // The second code of each multi-code family. Losing either would cost one file and no family floor.
    expect(tally.get("&#x0011;") ?? 0, "no carrier writes SOH2 — the SOH family reads as one code").toBeGreaterThanOrEqual(1);
    expect(tally.get("&#x0014;") ?? 0, "no carrier writes EOT2 — the EOT family reads as one code").toBeGreaterThanOrEqual(1);
  });

  /**
   * THE SECOND CODE OF A FAMILY, READ OVER REAL CARRIERS.
   *
   * A fixture pins the GRAMMAR; only the CORPUS pins the READER — and the corpus writes no carrier
   * whose release stands on `&#x0014;` alone. So this takes the corpus AS IT IS and moves one thing:
   * every declared code is rewritten to its family's sibling. The bytes stay a real carrier's, the
   * reading must not move, and a scan that spells one code of a family by hand goes red on all 700.
   */
  test("★ every corpus carrier re-spelled in its family's OTHER code reads the same marks ★", () => {
    const sibling = new Map<string, string>([["&#x0004;", "&#x0014;"], ["&#x0001;", "&#x0011;"]]);
    const files = carrierFiles(REPO);
    let moved = 0;
    const drifted: string[] = [];
    for (const f of files) {
      const text = readFileSync(path.join(REPO, f), "utf8");
      const before = readCarrierShape(text);
      // Only the FRAME SIGILS are re-spelled; prose that teaches a code stays as it stands.
      let after = text;
      for (const [from, to] of sibling) {
        after = after.replace(new RegExp(`(<<\\^(?:[^>\\n]|>(?!>))*?)${from}`, "g"), `$1${to}`);
      }
      if (after === text) continue;
      moved++;
      const now = readCarrierShape(after);
      if (now.marks.eot !== before.marks.eot || now.marks.head !== before.marks.head) {
        drifted.push(`${f} — eot ${before.marks.eot}→${now.marks.eot}, head ${before.marks.head}→${now.marks.head}`);
      }
    }
    // A substitution that reached nothing would report a perfectly clean run.
    expect(moved, "no corpus carrier carried a code to re-spell — this walk saw nothing").toBeGreaterThanOrEqual(695);
    expect(drifted, `a family's second code does not reach this reader:\n${drifted.join("\n")}`).toEqual([]);
  });

  /**
   * CONTROL — the walk reads FALSE where the marks are not the grammar's.
   *
   * Without this, a reader that answered `true` for any four-hex entity would pass every reading
   * above, and so would one that answered `true` unconditionally.
   */
  test("CONTROL — a carrier spelled in undeclared codes reads no marks at all", () => {
    const real = `${DECL}\n\n${head("lar:///ha.ka.ba/x/y")}\n\`\`\`toml meta\nuri-path = "ha.ka.ba/x/y"\ntype = "${CARRIER_TYPE}"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\nbody\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;
    expect(familiesWritten(real)).toEqual({ stx: true, etx: true, eot: true });
    expect(readCarrierShape(real).marks).toMatchObject({ stx: true, etx: true, eot: true });

    const stranger = real.replace('&#x0002;', '&#x0099;').replace('&#x0003;', '&#x009a;').replace('&#x0004;', '&#x009b;');
    expect(familiesWritten(stranger)).toEqual({ stx: false, etx: false, eot: false });
    expect(readCarrierShape(stranger).marks).toMatchObject({ stx: false, etx: false, eot: false });
  });

  /** CONTROL — a frame quoted in a lesson writes no frame, on BOTH sides of the comparison. */
  test("CONTROL — a fenced frame counts for neither reading", () => {
    const lesson = "```\n<<^ code=\"&#x0002;\">>\n<<^ code=\"&#x0003;\">>\n<<^ code=\"&#x0004;\" -> to=?>>\n```\n";
    expect(familiesWritten(lesson)).toEqual({ stx: false, etx: false, eot: false });
    expect(readCarrierShape(lesson).marks).toMatchObject({ stx: false, etx: false, eot: false });
  });
});
