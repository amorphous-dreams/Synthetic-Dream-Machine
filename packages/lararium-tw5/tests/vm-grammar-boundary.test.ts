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
    // THE SHORE IS THE FRAME PACKAGE'S `head.ts` — outside this tree, so no file here is exempt as it.
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
    expect(offenders, "a bearing read belongs in @lararium/memetic-frame's head.ts — see its header").toEqual([]);
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
    const SHORES = ["sigil-attrs.ts"];
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
      // hana-body-opacity.test.ts is the unit test of the scanner's own worksite exclusion (the same
      // mechanism pranala's block body already gets) — whether a `<<~ …>>` written INSIDE a hana body
      // fires as an event at all. That question lives entirely at the scan layer: the render path can
      // only observe whether the final tree/HTML differs, never whether the SCANNER specifically
      // excluded the position, so this claim — like pranala-attribute-spellings.test.ts just above —
      // has no other surface. It blesses no grammar; it holds the scan layer to guest-grammar.mem's
      // #/hana-worksite law (a hana body carries a FOREIGN grammar, never this house's own sigils).
      .filter((f) => !f.endsWith("hana-body-opacity.test.ts"))
      // wehe-open-paren.test.ts is the missing RED control for lar:///sigil.wehe.pairs (10d14e51a):
      // whether the tiddler-derived scanner PAIRS open/close on the corpus's own `name(params)`
      // invocation form. The grammar-table snapshot (--check / plugin-artifact-parity) asserts the
      // TABLE's shape; only a scan+build-layer test can catch an orphan-close the render path would
      // only ever report as "different HTML," never as which closer went unmatched. It drives
      // grammar-table.generated.ts — itself derived from the tiddlers, never a hand-typed fixture —
      // so it blesses no grammar as canonical; it holds the derived scan+build layer to the corpus.
      .filter((f) => !f.endsWith("wehe-open-paren.test.ts"))
      // pragma-bang-optional.test.ts (lar:///sigil.grammar.lane) is the same class of
      // scan+build-layer RED control as wehe-open-paren.test.ts just above — whether the tiddler-
      // derived grammar PAIRS open/close on the `<<~!`-prefixed pragma register canon's own prefix
      // table illustrates, and whether waiho/const's carrier-scoped `!` form still fires as a
      // standalone pragma event (no closer). Neither question has any other surface.
      .filter((f) => !f.endsWith("pragma-bang-optional.test.ts"))
      // fence-mask-info-string.test.ts is the unit test of the compile layer's OWN quoted-code
      // span rule (fence-mask.ts) — whether a line's info string carrying a backtick opens no
      // fence (CommonMark §4.5). That question lives at the mask layer alone; nothing downstream
      // can tell a torn frame from a correctly-open one without re-deriving this exact rule, so
      // this claim has no other surface. It blesses no grammar; it holds one mask rule to spec.
      .filter((f) => !f.endsWith("fence-mask-info-string.test.ts"))
      // waiho-equals-separator.test.ts is the unit test of the compile layer's OWN capture-group
      // split for waiho/const's `name = value` shape — whether the `=` separator rides into the
      // captured VALUE or is consumed as a separator. That question lives at the scan+build layer
      // alone (the render path never exposes waiho's raw captured groups), so it has no other
      // surface. It blesses no grammar; it holds one sigil's own capture shape to canon.
      .filter((f) => !f.endsWith("waiho-equals-separator.test.ts"))
      // meme-normalize-mirror-fold.test.ts is the unit test of meme-normalize.ts's own read-only
      // mirror fold — it reads GENERATED_SIGILS to enumerate every `lar-mirror-of` entry the fold
      // must cover, the same derivation meme-normalize.ts itself performs. It drives
      // normalizeMemeSource(), never collectEvents/buildMemeAst, and blesses no grammar as
      // canonical — it holds the fold to the tiddlers' own declared mirror set.
      .filter((f) => !f.endsWith("meme-normalize-mirror-fold.test.ts"))
      // meme-normalize-param-separator.test.ts reads GENERATED_ALIAS_MAP only to compute its OWN
      // expected fold target per shelf head (so the colon-preservation check keeps working once a
      // head folds) — same reasoning as the mirror-fold test just above.
      .filter((f) => !f.endsWith("meme-normalize-param-separator.test.ts"))
      // ahu-sections-address.test.ts reads fence-mask.ts's OWN fenceLineOpen/fenceLineClose to toggle
      // fences the same way the compile layer does — it drives no meme-ast parse at all, only the
      // mask layer's line-fence rule, the same reasoning as fence-mask-info-string.test.ts above.
      .filter((f) => !f.endsWith("ahu-sections-address.test.ts"))
      // sigil-pin-kanawai.test.ts is the scan+build-layer RED control for the aka/pin + kanawai/law
      // split (lar:///sigil.grammar.lane loop 7) — same reasoning as wehe-open-paren.test.ts: whether
      // the tiddler-derived grammar scans and erases these two mirror pairs correctly has no other
      // surface than this layer.
      .filter((f) => !f.endsWith("sigil-pin-kanawai.test.ts"))
      // sigil-unslashed-shelf.test.ts reads the scanner as SOURCE TEXT to hold one naming law: no
      // bootstrap scan reports a name the grammar retired. It drives no compile layer, imports no
      // value, and blesses nothing as canonical — a `sigilName` is a string in a file, and the law
      // asks only how it is spelled. The boundary guards the RUNTIME surface, which this never touches.
      .filter((f) => !f.endsWith("sigil-unslashed-shelf.test.ts"))
      // classifier-decides.test.ts reads scanner.ts (and every tracked source) as SOURCE TEXT via
      // readFileSync, walking the control-matcher regex off the files themselves — same reasoning as
      // sigil-unslashed-shelf.test.ts just above. It imports no value from meme-ast and drives no
      // parse; it only greps source bytes for a literal the scanner's own BOOTSTRAP_SCANS kept.
      .filter((f) => !f.endsWith("classifier-decides.test.ts"))
      // fragment-doors.test.ts drives placeMeme (the blessed entry point) for its own tests; its
      // second describe block is the unit test of composeSlotPath/childUri — ahu-scan.ts's own pure
      // address-composition helpers — same reasoning as ahu-sections-address.test.ts above (ONE
      // helper's own shape, no parse, no AST, no canonical bless).
      .filter((f) => !f.endsWith("fragment-doors.test.ts"))
      // frame-literals-agree.test.ts reads GENERATED_SIGILS and BOOTSTRAP_SCANS only to compare their
      // code sets against @lararium/memetic-frame's own FRAME_MARKS declaration — same reasoning as
      // meme-normalize-mirror-fold.test.ts above (a read-only parity check, never a parse driver).
      .filter((f) => !f.endsWith("frame-literals-agree.test.ts"))
      // slot-spelling-one-address.test.ts and mixed-ahu-fragment-tree.test.ts drive
      // memeticWikitextDeserializer (the blessed entry point) for every record-shape assertion; each
      // calls parseMemeText ONLY to reach a diagnostic (`partial-form:ahu`, the raw node tree's Ahu
      // count) the deserializer's own surface never exposes — the same compile-layer-diagnostic
      // reasoning as waiho-equals-separator.test.ts and fence-mask-info-string.test.ts above.
      .filter((f) => !f.endsWith("slot-spelling-one-address.test.ts"))
      .filter((f) => !f.endsWith("mixed-ahu-fragment-tree.test.ts"))
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
