/**
 * carrier-files — the one finder, held to the law it exists to enforce.
 *
 * READ THE DECLARATION, NEVER THE PATH. Twenty-two readers each enumerated "the corpus" with a
 * hardcoded glob, in three disagreeing answers: `bags/**\/*.mem` alone, that plus a `wikis/` tree
 * holding ZERO carriers, and that plus one `.tid` glob. The disagreement hid a real carrier — the
 * runtime kernel face at packages/lararium-tw5/tiddlers/memetic-wikitext.tid — from every gate for
 * three rulings.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */

import { describe, expect, test } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { carrierFiles, currentCarrierFiles, declaresCarrier, SUBMODULES } from "../src/carrier-files.js";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import { REPO } from "./test-wiki.js";

describe("declaresCarrier — a file counts as a carrier when it says so", () => {
  /** The current spelling: a doctype sigil naming the grammar that reads what follows. */
  test("the current doctype declares", () => {
    const d = declaresCarrier("<<!DOCTYPE \"memetic-wikitext+tiddlywiki\" \"lar:///ha.ka.ba/lares/api/pono/memetic-wikitext\">>\n");
    expect(d?.form).toBe("doctype");
  });

  /**
   * A declaration hidden inside `<!-- -->` renders as nothing and reads to a human as though it stood.
   * The finder still counts it, because the file DECLARES — the doctype gate then names the form.
   */
  test("a doctype inside an HTML comment still declares", () => {
    const d = declaresCarrier("<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/lares/api/pono/memetic-wikitext>> -->\n");
    expect(d?.form).toBe("commented-doctype");
  });

  /** A `.tid` field line carries the type where no sigil can precede it. */
  test("a tid type field declares", () => {
    const d = declaresCarrier(`title: lar:///x\ntype: ${CARRIER_TYPE}\ntags:\n`);
    expect(d?.form).toBe("type-field");
  });

  /** A toml meta key carries the same fact inside the meta block. */
  test("a toml meta type key declares", () => {
    const d = declaresCarrier(`\`\`\`toml meta\ntype      = "${CARRIER_TYPE}"\n\`\`\`\n`);
    expect(d?.form).toBe("type-field");
  });

  /**
   * A DECLARATION INSIDE A CODE FENCE DECLARES NOTHING. The spec memes teach the doctype by quoting
   * it; a finder without the mask would enrol every teaching doc into the corpus and then fail it for
   * lacking the frame the lesson never claimed to carry.
   */
  test("a fenced declaration declares nothing", () => {
    const taught = "Write it like this:\n\n```\n<<!DOCTYPE memetic-wikitext+tiddlywiki lar:///x>>\n```\n";
    expect(declaresCarrier(taught)).toBeNull();
  });

  /** An inline code span quotes just as hard as a fence. */
  test("a declaration inside an inline code span declares nothing", () => {
    expect(declaresCarrier("The type reads `type: " + CARRIER_TYPE + "` in a tid.\n")).toBeNull();
  });

  /**
   * A QUOTED DECLARATION STANDS INSIDE SOMETHING ELSE'S LINE. The fence mask covers how a text file
   * quotes; a program quotes with a string literal, and 18 tracked source files — TypeScript, python,
   * JSON, a grammar comment — carry the declaration embedded in a statement. A carrier's declaration
   * owns its line.
   */
  test("a declaration embedded in a program's line declares nothing", () => {
    expect(declaresCarrier('const DECL = "<<!DOCTYPE memetic-wikitext+tiddlywiki lar:///x>>";\n')).toBeNull();
    expect(declaresCarrier('_HEAD = """<!-- <<~ !DOCTYPE = lar:///x>> -->\n"""\n')).toBeNull();
    expect(declaresCarrier(`  "content-type": "${CARRIER_TYPE}",\n`)).toBeNull();
  });

  /** A file naming no grammar declares nothing — the control that keeps the reader from matching all. */
  test("plain prose declares nothing", () => {
    expect(declaresCarrier("# A heading\n\nSome prose about carriers and doctypes.\n")).toBeNull();
  });
});

describe("carrierFiles — the corpus, from the declarations that make it", () => {
  const found = carrierFiles(REPO);

  /** CONTROL: a finder that finds nothing satisfies every per-carrier law beneath it. */
  test("the corpus is not empty", () => {
    expect(found.length).toBeGreaterThan(600);
  });

  /**
   * CONTROL, NAMED: README.md carries `<<!DOCTYPE memetic-wikitext…>>` inside a code fence, as a
   * teaching example. A path-shaped or mask-free finder returns it; this one must not.
   */
  test("README.md declares nothing — its doctype sits in a fence", () => {
    expect(found).not.toContain("README.md");
    expect(declaresCarrier(readFileSync(join(REPO, "README.md"), "utf8"))).toBeNull();
  });

  /** The carrier the path-shaped globs hid: the runtime kernel face, outside `bags/`. */
  test("the runtime kernel face rides in, outside bags/", () => {
    expect(found).toContain("packages/lararium-tw5/tiddlers/memetic-wikitext.tid");
  });

  /** The `bags/` corpus rides in whole. */
  test("every bags/ .mem carrier rides in", () => {
    const bags = execSync("git ls-files 'bags/**/*.mem'", { cwd: REPO, encoding: "utf8" })
      .split("\n").filter(Boolean);
    const missing = bags.filter((f) => !found.includes(f));
    expect(missing, `a bags/ carrier the finder dropped`).toEqual([]);
  });

  /** A vendored submodule holds its own corpus and answers to its own house. */
  test("no submodule path rides in", () => {
    for (const sub of SUBMODULES) {
      expect(found.filter((f) => f.startsWith(sub + "/"))).toEqual([]);
    }
  });

  /**
   * TRACKED ONLY. A filesystem walk would enrol untracked scratch — a half-written draft, a build
   * artifact — into the corpus and fail the gates on files nobody committed.
   */
  test("every file found is tracked", () => {
    const tracked = new Set(execSync("git ls-files", { cwd: REPO, encoding: "utf8" }).split("\n").filter(Boolean));
    expect(found.filter((f) => !tracked.has(f))).toEqual([]);
  });
});

describe("currentCarrierFiles — what a post-ruling law may hold", () => {
  const all = carrierFiles(REPO);
  const current = currentCarrierFiles(REPO);

  /**
   * ONE PREDICATE EXPLAINS THE WHOLE RESIDUE. Measured the day the finder widened: every carrier that
   * declares in the retired comment spelling ALSO carries pre-ruling frame marks, unquoted URI
   * positionals and unrooted slots — 17 files, and head-parity's 8 DRIFT plus 9 name-no-head land on
   * exactly that set and nowhere else. The declaration form reads the carrier's whole vintage.
   */
  test("the retired spelling is the only thing that separates the two answers", () => {
    const dropped = all.filter((f) => !current.includes(f));
    expect(dropped.length).toBeGreaterThan(0);
    for (const f of dropped) {
      expect(declaresCarrier(readFileSync(join(REPO, f), "utf8"))?.form).toBe("commented-doctype");
    }
  });

  /** The migrated kernel face rides in the CURRENT corpus, not the debt. */
  test("the kernel face rides in the current corpus", () => {
    expect(current).toContain("packages/lararium-tw5/tiddlers/memetic-wikitext.tid");
  });

  /** CONTROL: a narrowing that narrowed to nothing would satisfy every law beneath it. */
  test("the current corpus holds nearly all of it", () => {
    expect(current.length).toBeGreaterThan(all.length - 40);
  });
});

describe("no reader enumerates the corpus by its own glob", () => {
  /**
   * THE DISAGREEMENT WAS THE DEFECT. Three answers to one question stood at once, and the gates that
   * held the narrowest one reported clean over a corpus they never read. Any reader pairing
   * `ls-files` with a `bags/` glob has re-opened it.
   *
   * Each exemption stands NAMED WITH ITS REASON. A silently filtered file is a glob that grew back.
   */
  const EXEMPT = new Map([
    // The shore itself — it holds the one `git ls-files` this law permits.
    ["packages/lararium-tw5/src/carrier-files.ts", "THE shore: the single enumeration every reader now calls"],
    // This test proves the shore against the ground it replaces, which requires naming that ground.
    ["packages/lararium-tw5/tests/carrier-files.test.ts", "proves the shore covers the bags/ glob it replaces"],
    // Another spirit owns this file; its glob rides under a separate ruling.
    ["packages/lararium-tw5/tests/shelf-render-census.test.ts", "owned elsewhere — not this sweep's to move"],
    // Not a corpus finder: it asks which files bags/ TRACKS, carrier or not, to catch an uncarried one.
    ["packages/lararium-tw5/tests/carrier-shape.test.ts", "asks what bags/ tracks, not what declares — an uncarried file is its finding"],
    // Not a corpus finder: it sweeps prose and source for a retired photocopy verb.
    ["tools/photocopies-to-has.mjs", "sweeps prose and source for a verb spelling, never the corpus"],
    // Not a corpus finder: it asks which carriers the WORKING TREE shows dirty, to refuse a blind stamp.
  ]);

  /**
   * TWO WAYS TO SPELL THE SAME GLOB, AND ONE OF THEM SLIPPED THE FIRST SWEEP. `git ls-files` was the
   * shape the sweep looked for; `find bags -name "*.mem"` reads the same corpus, walks untracked
   * scratch besides, and stood in three readers a scan for `ls-files` alone reported clean over.
   */
  const FINDER = /(?:ls-files|find\s+bags)/;

  test("every corpus glob outside the shore is named", () => {
    const scanned = execSync(
      "git ls-files 'tools/*.mjs' 'tools/*.sh' 'packages/lararium-tw5/tests/*.test.ts' 'packages/lararium-tw5/src/*.ts'",
      { cwd: REPO, encoding: "utf8" },
    ).split("\n").filter(Boolean);
    const offenders: string[] = [];
    for (const rel of scanned) {
      if (EXEMPT.has(rel)) continue;
      const text = readFileSync(join(REPO, rel), "utf8");
      for (const line of text.split("\n")) {
        if (!FINDER.test(line)) continue;
        if (!/bags/.test(line)) continue;
        // A line naming the finder inside a comment EXPLAINS the law rather than breaking it.
        if (/^\s*(?:\/\/|#|\*)/.test(line)) continue;
        offenders.push(`${rel}: ${line.trim()}`);
      }
    }
    expect(offenders, "a reader enumerating the corpus by its own glob — call carrierFiles() instead")
      .toEqual([]);
  });

  /** A stale exemption reads as a law with a hole in it. Each named file must still stand. */
  test("every exemption names a file that still stands", () => {
    expect([...EXEMPT.keys()].filter((f) => !existsSync(join(REPO, f)))).toEqual([]);
  });
});
