/**
 * VM grammar boundary — pono tests for inversion of control.
 *
 * Grammar/parsing/projection work belongs to the TW5 VM. TypeScript in this
 * package may author JS tiddlers and host protocol shells, but tests must not
 * bless host-side parser calls as canonical behavior.
 */

import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { TW5Engine } from "../src/tw5-vm.js";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";

const ROOT = new URL("..", import.meta.url).pathname;

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

describe("pono grammar boundary", () => {
  test("package public API does not export host-sovereign meme parser entrypoints", () => {
    const index = read("src/index.ts");

    expect(index).not.toMatch(/parseMemeText|parseMemeNodes|parseMemeEdges/);
    expect(index).not.toMatch(/collectEvents|buildMemeAst|BOOTSTRAP_SCANS/);
  });

  test("meme AST implementation is authored as a TW5 library tiddler", () => {
    const entry = read("src/meme-ast-entry.ts");

    expect(entry).toContain("title: lar:///ha.ka.ba/lararium/tw5/modules/meme-ast");
    expect(entry).toContain("module-type: library");
    expect(entry).toContain("inside the TW5 VM");
  });

  test("memetic-wikitext deserialization is a TW5 deserializer module", () => {
    const deserializer = read("src/deserializer.ts");

    expect(deserializer).toContain("module-type: tiddlerdeserializer");
    expect(deserializer).toContain("text/memetic-wikitext+tiddlywiki");
    expect(deserializer).toContain("Parsing MUST happen inside the TW5 VM");
  });

  test("host ingest delegates carrier decomposition to the VM wiki deserializer", () => {
    const engine = new TW5Engine();
    const calls: Array<{ type: string; text: string; fields: Record<string, unknown> }> = [];
    const tiddlers = new Map<string, { fields: Record<string, unknown> }>();

    class FakeTiddler {
      fields: Record<string, unknown>;
      constructor(fields: Record<string, unknown>) {
        this.fields = fields;
      }
    }

    const wiki = {
      deserializeTiddlers(type: string, text: string, fields: Record<string, unknown>) {
        calls.push({ type, text, fields });
        return [
          { title: "lar:///test", text: "body", tags: ["pono"] },
          { title: "$:/temp/internal", text: "must not cross host boundary" },
        ];
      },
      addTiddler(tiddler: FakeTiddler) {
        tiddlers.set(String(tiddler.fields.title), { fields: tiddler.fields });
      },
      getTiddler(title: string) {
        return tiddlers.get(title);
      },
      transact(fn: () => void) {
        fn();
      },
    };

    (engine as unknown as { _tw: unknown })._tw = { wiki, Tiddler: FakeTiddler };

    const records = engine.ingestCarrier("lar:///test", "<<~ meme text>>", { type: CARRIER_TYPE });

    expect(calls).toEqual([
      {
        type: CARRIER_TYPE,
        text: "<<~ meme text>>",
        fields: { title: "lar:///test", type: CARRIER_TYPE },
      },
    ]);
    expect(records.map((r) => r.tiddler.title)).toEqual(["lar:///test"]);
  });

  /**
   * ★ THE GATE THAT MISSED IT ★
   *
   * This boundary read `src/index.ts` for forbidden EXPORTS — the door — while nine readers inside the
   * package each carried their own spelling of one question: what address does a carrier's head name?
   * When the corpus quoted its control values, eight stopped matching in the same minute.
   *
   * A bearing read is a control code, a bearing arrow, and a capture. One file holds the answer, and
   * every exemption below is DECLARED with its reason — a list that only shrinks.
   */
  test("★ no reader outside the shore captures a carrier's bearing ★", () => {
    const SHORE = "carrier-head.ts";
    /**
     * DECLARED EXEMPTIONS, each with the reason it stands. Adding one is a ruling, not a convenience.
     */
    const EXEMPT = [
      {
        file: "src/meme-ast/scanner.ts",
        since: "2026-09-07",
        why:
          "THE INDEPENDENT RECOGNISER. `frame-parity` reads this file's control literals as the side " +
          "no tiddler governs — comparing the spec against tiddlers alone reads tautological while " +
          "one hand writes both. Sourcing its patterns from the shore deletes the seam that witness " +
          "measures, which is how this exemption was found: repointing it turned frame-parity red.",
      },
    ];
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, "src")).filter((f) => f.endsWith(".ts"))) {
      if (file.endsWith(SHORE)) continue;
      // GENERATED OUTPUT CARRIES THE SHORE'S OWN BODY. The packed plugin inlines every module it
      // bundles, so the shore's pattern appears there by construction — reading it as a second reader
      // would fail this gate on the very file that proves the collapse worked.
      if (file.endsWith(".generated.ts")) continue;
      if (EXEMPT.some((e) => file.endsWith(e.file))) continue;
      const src = readFileSync(file, "utf8");
      src.split("\n").forEach((line, i) => {
        // a regex literal or a RegExp source naming a HEAD code, reaching an arrow, and capturing
        if (!/&#x00(?:01|11)/.test(line)) return;
        if (!line.includes("->")) return;
        if (!/\(\[\^|\(\?:to=\)|\(\\S\+\)|\((?!\?:)/.test(line)) return;
        offenders.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim().slice(0, 96)}`);
      });
    }
    expect(offenders, "a bearing read belongs in carrier-head.ts — see its header").toEqual([]);
  });

  /**
   * ★ AND THE SAME LAW ONE LAYER OUT ★
   *
   * A reader that matches a SIGIL and captures a value after `key=` holds its own spelling of a
   * question `sigil-attrs` answers. Nine such spellings of the control bearing broke in one minute
   * when the corpus quoted its values; the speaking sigils carry the same hazard, and the RENDER-path
   * pranala rule was found still holding its own capture AFTER the corpus had moved.
   */
  test("★ no reader outside the shore captures a sigil parameter ★", () => {
    const SHORES = ["carrier-head.ts", "sigil-attrs.ts"];
    /** DECLARED EXEMPTIONS, each with the reason it stands. A list that only shrinks. */
    const EXEMPT = [
      {
        file: "src/meme-ast/scanner.ts",
        since: "2026-09-07",
        why: "THE INDEPENDENT RECOGNISER — `frame-parity` reads this file's own literals as the side no " +
             "tiddler governs; sourcing them from the shore makes that comparison tautological.",
      },
      {
        file: "src/wikirules/lar-sigil-shared.ts",
        since: "2026-09-07",
        why: "THE RENDER PATH runs inside the wikitext parser, before any shore import would resolve " +
             "in a packed plugin module. Its captures carry the same law and a vector holds them " +
             "(pranala-attribute-spellings).",
      },
    ];
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, "src")).filter((f) => f.endsWith(".ts"))) {
      if (SHORES.some((sh) => file.endsWith(sh))) continue;
      if (file.endsWith(".generated.ts")) continue;
      if (EXEMPT.some((e) => file.endsWith(e.file))) continue;
      readFileSync(file, "utf8").split("\n").forEach((line, i) => {
        if (!/<<[~^\\]/.test(line)) return;          // it must be reading a SIGIL
        if (!/[A-Za-z-]+=\(/.test(line)) return;       // …and capturing right after a `key=`
        offenders.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim().slice(0, 96)}`);
      });
    }
    expect(offenders, "a sigil parameter read belongs in sigil-attrs.ts — see its header").toEqual([]);
  });

  test("tests do not import meme-ast internals as the canonical grammar surface", () => {
    const testDir = join(ROOT, "tests");
    const offenders = walk(testDir)
      .filter((f) => f.endsWith(".test.ts"))
      .filter((f) => !f.endsWith("vm-grammar-boundary.test.ts"))
      // meme-resilient.test.ts is the EXPLICIT unit test of the meme-ast compile-layer's resilient
      // recovery (Error nodes / the failure-gradient). That layer has no other test surface — the VM
      // render is a separate layer (the wikirule), and the deserializer yields tiddlers, not the AST.
      // It tests parser RESILIENCE, never blesses the grammar surface as canonical. (Operator: redirect
      // if you'd rather route recovery through a blessed surface.)
      .filter((f) => !f.endsWith("meme-resilient.test.ts"))
      // pranala-attribute-spellings.test.ts is the unit test of the compile layer's ATTRIBUTE reading —
      // which separator and which quoting a sigil's trailing parameters may carry. The blessed edge reader
      // anchors on `to=` alone and never exposes family or role, so the claim has no other surface. It
      // blesses no grammar; it holds one layer to the range TiddlyWiki itself parses.
      .filter((f) => !f.endsWith("pranala-attribute-spellings.test.ts"))
      // sigil-unslashed-shelf.test.ts reads the scanner as SOURCE TEXT to hold one naming law: no
      // bootstrap scan reports a name the grammar retired. It drives no compile layer, imports no
      // value, and blesses nothing as canonical — a `sigilName` is a string in a file, and the law
      // asks only how it is spelled. The boundary guards the RUNTIME surface, which this never touches.
      .filter((f) => !f.endsWith("sigil-unslashed-shelf.test.ts"))
      .filter((f) => {
        // The boundary guards the RUNTIME grammar surface — reaching past a blessed entry point to
        // drive the compile layer directly. A `import type` of a rule SHAPE binds no runtime surface
        // and blesses nothing, so it crosses no boundary; a value import or a direct call does.
        const src = readFileSync(f, "utf8").replace(/^\s*import\s+type\s+[^;]*?;$/gm, "");
        return /src\/meme-ast|collectEvents|buildMemeAst|parseMemeText/.test(src);
      })
      .map((f) => relative(ROOT, f));

    expect(offenders).toEqual([]);
  });
});
