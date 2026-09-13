/**
 * carrier-head — the one reader of a carrier's framing ends.
 *
 * These vectors are the ones that were paid for. Each names a spelling that broke a hand-rolled
 * reader somewhere in this tree, and the shore now answers all of them from one place.
 */
import { describe, test, expect, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  matchCarrierHead,
  matchCarrierMark,
  matchCarrierHeadLine,
  headUriOf,
  carrierHeadPattern,
  carrierReleasePattern,
} from "../src/carrier-head.js";
import { FRAME_MARKS } from "../src/frame-marks.js";

const URI = "lar:///ha.ka.ba/lares/api/pono/example";

describe("both spellings of the bearing reach ONE reading", () => {
  test("★ quoted and bare name the same address ★", () => {
    const quoted = matchCarrierHead(`<<^ code="&#x0001;" from="?" -> to="${URI}">>`);
    const bare = matchCarrierHead(`<<^ code="&#x0001;" from=? -> to=${URI}>>`);
    expect(quoted?.uri).toBe(URI);
    expect(bare?.uri).toBe(URI);
    expect(quoted?.quoted).toBe(true);
    expect(bare?.quoted).toBe(false);
  });

  test("★ the POSITIONAL far side names the same address ★", () => {
    // The spelling the framing ends carried before they took names. `normalize` converts it, so a
    // reader that required `to=` would refuse exactly the carriers normalization exists to reach.
    expect(matchCarrierHead(`<<^ code="&#x0001;" ? -> ${URI}>>`)?.uri).toBe(URI);
  });

  test("the shifted pair carries the same law", () => {
    expect(matchCarrierHead(`<<^ code="&#x0011;" from="?" -> to="${URI}">>`)?.code).toBe("0011");
  });
});

describe("a namespace arrives WHOLE", () => {
  // 66 carriers declare two glyphs and a space. A reader that took the value to the first space
  // silently lost half of it, and the SOH stopped matching what the meta declared.
  test("★ two glyphs and a space survive ★", () => {
    const h = matchCarrierHead(`<<^ code="&#x0001;" namespace="ॐ ँ" from="?" -> to="${URI}">>`);
    expect(h?.namespace).toBe("ॐ ँ");
    expect(h?.uri).toBe(URI);
  });

  test("a head with no namespace reports null, never an empty string", () => {
    expect(matchCarrierHead(`<<^ code="&#x0001;" from="?" -> to="${URI}">>`)?.namespace).toBeNull();
  });
});

describe("TWO questions, held apart", () => {
  const torn = `<<^ code="&#x0001;" namespace="⊙">>`;

  test("a head with no bearing STANDS as a mark", () => {
    expect(matchCarrierMark(torn, "head")?.code).toBe("0001");
  });

  test("★ and names no address — a torn frame must not report one ★", () => {
    expect(matchCarrierHead(torn)).toBeNull();
    expect(headUriOf(torn)).toBeNull();
  });

  test("a release reads as a release, and a head does not", () => {
    expect(matchCarrierMark(`<<^ code="&#x0004;" -> to="?">>`, "release")).not.toBeNull();
    expect(matchCarrierMark(`<<^ code="&#x0004;" -> to="?">>`, "head")).toBeNull();
  });

  test("the release pattern accepts both spellings", () => {
    expect(carrierReleasePattern().test(`<<^ code="&#x0004;" -> to="?">>`)).toBe(true);
    expect(carrierReleasePattern().test(`<<^ code="&#x0004;" -> to=?>>`)).toBe(true);
    expect(carrierReleasePattern().test(`<<^ code="&#x0004;" -> to="lar:///x">>`)).toBe(false);
  });
});

describe("offsets locate the mark in its own text", () => {
  test("index and end bracket the sigil exactly", () => {
    const pre = "prose\n\n";
    const head = `<<^ code="&#x0001;" from="?" -> to="${URI}">>`;
    const h = matchCarrierHead(pre + head + "\nmore")!;
    expect(h.index).toBe(pre.length);
    expect(h.end).toBe(pre.length + head.length);
    expect(h.text).toBe(head);
  });

  test("a `from` offset skips a mark already read", () => {
    const two = `<<^ code="&#x0001;" from="?" -> to="lar:///a">>\n<<^ code="&#x0001;" from="?" -> to="lar:///b">>`;
    const first = matchCarrierHead(two)!;
    expect(first.uri).toBe("lar:///a");
    expect(matchCarrierHead(two, first.end)?.uri).toBe("lar:///b");
  });
});

describe("a fresh pattern per call", () => {
  // A module-scope /g regex carries lastIndex between unrelated callers, and the second reader
  // skips the very first mark in its own text.
  test("★ two reads of the same text agree ★", () => {
    const t = `<<^ code="&#x0001;" from="?" -> to="${URI}">>`;
    expect(matchCarrierHead(t)?.uri).toBe(matchCarrierHead(t)?.uri);
    const a = carrierHeadPattern("g"), b = carrierHeadPattern("g");
    expect(a.exec(t)?.index).toBe(b.exec(t)?.index);
  });
});

describe("the codes come from frame-marks, never from here", () => {
  // One fact, declared once. Restating the codes would let a mark added to FRAME_MARKS read correct in
  // every file while this reader quietly dropped it.
  test("★ every SOH mark the grammar stands is a mark this shore reads ★", () => {
    const soh = FRAME_MARKS.filter((m) => m.name.startsWith("SOH"));
    expect(soh.length).toBeGreaterThan(1);
    for (const m of soh) {
      const head = `<<^ code="${m.code}" from="?" -> to="${URI}">>`;
      expect(matchCarrierHead(head)?.uri, `${m.name} (${m.code})`).toBe(URI);
    }
  });

  test("★ and every EOT mark reads as a release ★", () => {
    for (const m of FRAME_MARKS.filter((x) => x.name.startsWith("EOT"))) {
      expect(carrierReleasePattern().test(`<<^ code="${m.code}" -> to="?">>`), m.name).toBe(true);
    }
  });

  test("a mark that is neither names no head", () => {
    for (const m of FRAME_MARKS.filter((x) => !/^(SOH|EOT)/.test(x.name))) {
      expect(matchCarrierHead(`<<^ code="${m.code}" from="?" -> to="${URI}">>`), m.name).toBeNull();
    }
  });
});

// ── THE PARITY WALK ─────────────────────────────────────────────────────────────────────────────
//
// `frame-marks` rules that the CODES collapse into one fact while the SCANS stay apart. This walk
// enforces exactly that split across EVERY module, so neither half rots:
//
//   · a module that WRITES a control mark must read the code from `FRAME_MARKS` — a code spelled
//     into a plain string is a second copy of a collapsed fact, and a mark added to the declaration
//     would read correct in every file while that string quietly emitted the old grammar;
//   · a module that SCANS for a mark keeps its own regex — three bug-comments in `frame-marks`
//     record what collapsing those costs, so a code standing inside a REGEX LITERAL passes;
//   · a module that TEACHES the shape keeps its comment — a code inside a comment passes.
//
// So the walk reads only STRING LITERAL bodies, and it tokenizes rather than greps: a regex such as
// /code=\s*"&#x(0001|0011);"/ carries quote characters, and a line-wise grep would read the tail of
// it as a string and fail an honest scan.

/** Every string / template literal body in a TS source, with the line each opens on. */
function stringLiteralBodies(src: string): { line: number; body: string }[] {
  const out: { line: number; body: string }[] = [];
  let i = 0;
  let line = 1;
  // The last significant character decides whether `/` opens a regex or divides.
  let prev = "";
  const bump = (s: string): void => { for (const c of s) if (c === "\n") line++; };
  while (i < src.length) {
    const c = src[i]!;
    if (c === "\n") { line++; i++; continue; }
    if (c === "/" && src[i + 1] === "/") { const j = src.indexOf("\n", i); i = j < 0 ? src.length : j; continue; }
    if (c === "/" && src[i + 1] === "*") {
      const j = src.indexOf("*/", i + 2);
      const seg = src.slice(i, j < 0 ? src.length : j + 2);
      bump(seg); i += seg.length; continue;
    }
    if (c === "/" && /[=(,:[!&|?{};+\-*%^~<>]/.test(prev)) {
      let j = i + 1;
      let inClass = false;
      for (; j < src.length; j++) {
        const d = src[j]!;
        if (d === "\\") { j++; continue; }
        if (d === "[") inClass = true;
        else if (d === "]") inClass = false;
        else if (d === "\n") break;
        else if (d === "/" && !inClass) break;
      }
      i = j + 1; prev = "/"; continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const opensAt = line;
      let body = "";
      let j = i + 1;
      for (; j < src.length; j++) {
        const d = src[j]!;
        if (d === "\\") { body += src[j + 1] ?? ""; j++; continue; }
        if (d === c) break;
        if (d === "\n") { if (c !== "`") break; line++; }
        body += d;
      }
      out.push({ line: opensAt, body });
      i = j + 1; prev = c; continue;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

/** Every control-code entity spelled into a plain string, by line. */
function hardcodedMarkStrings(src: string): string[] {
  const codes = FRAME_MARKS.map((m) => m.code);
  const found: string[] = [];
  for (const { line, body } of stringLiteralBodies(src)) {
    for (const code of codes) if (body.includes(code)) found.push(`line ${line}: ${code}`);
  }
  return found;
}

describe("no module re-spells a control code — the parity walk", () => {
  // CONTROL. The walk has teeth only if a re-introduced literal trips it.
  test("★ CONTROL — a code written into a string FAILS the walk ★", () => {
    const reintroduced = `export function emit(): string {\n  return '<<^ code="&#x0002;">>';\n}\n`;
    expect(hardcodedMarkStrings(reintroduced)).toHaveLength(1);
    expect(hardcodedMarkStrings(reintroduced)[0]).toContain("&#x0002;");
  });

  test("★ CONTROL — a template that writes the same mark from FRAME_MARKS PASSES ★", () => {
    const cured = "const out = `<<^ code=\"${MARK(\"STX\")}\">>`;\n";
    expect(hardcodedMarkStrings(cured)).toEqual([]);
  });

  test("CONTROL — a code inside a regex literal passes (the scans stay local)", () => {
    const scan = 'const STX_RE = /<<\\^(?:[^>\\n]|>(?!>))*&#x0002;(?:[^>\\n]|>(?!>))*>>/;\n';
    expect(hardcodedMarkStrings(scan)).toEqual([]);
  });

  test("CONTROL — a regex carrying QUOTE characters is not misread as a string", () => {
    const scan = 'const SOH = /^<<\\^[^>\\n]*?\\bcode=\\s*"&#x(0001|0011);"/;\n';
    expect(hardcodedMarkStrings(scan)).toEqual([]);
  });

  test("CONTROL — a code inside a comment passes (the docs teach the shape)", () => {
    const line = '// SOH: both standard &#x0001; and Kapu DC1 &#x0011;\nconst a = 1;\n';
    const block = '/**\n * The opener canonicalizes to `<<^ code="&#x0001;" `\n */\nconst b = 2;\n';
    expect(hardcodedMarkStrings(line)).toEqual([]);
    expect(hardcodedMarkStrings(block)).toEqual([]);
  });

  test("★ EVERY module writes its marks from frame-marks ★", () => {
    const srcRoot = fileURLToPath(new URL("../src", import.meta.url));
    // `frame-marks` IS the declaration; the generated plugin tiddler is a build product, never hand-edited.
    const exempt = new Set(["frame-marks.ts", "plugin-tiddler.generated.ts"]);
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = join(dir, e.name);
        if (e.isDirectory()) return walk(full);
        return e.isFile() && e.name.endsWith(".ts") && !exempt.has(e.name) ? [full] : [];
      });

    const modules = walk(srcRoot);
    expect(modules.length).toBeGreaterThan(50);

    const offenders: string[] = [];
    for (const file of modules) {
      for (const hit of hardcodedMarkStrings(readFileSync(file, "utf8"))) {
        offenders.push(`${relative(srcRoot, file)} ${hit}`);
      }
    }
    expect(offenders, `a control code spelled into a string re-copies a collapsed fact:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("the prefix stops at an entity", () => {
  // A namespace written as entities and placed BEFORE the code would be read AS the code — the
  // quietest way this frame has broken. Canonical writes `code=` first, so the guard costs nothing.
  test("★ an entity namespace ahead of the code cannot be scanned PAST ★", () => {
    // The FIRST entity is authoritative. A reader whose prefix crossed `&` would skip the namespace,
    // find the real code behind it, and report a sound head for a carrier written out of order.
    const h = matchCarrierHead(`<<^ namespace="&#x0011;" code="&#x0001;" from="?" -> to="${URI}">>`);
    expect(h?.code).not.toBe("0001");
  });

  test("and the canonical order reads", () => {
    expect(matchCarrierHead(`<<^ code="&#x0001;" namespace="&#x2299;" from="?" -> to="${URI}">>`)?.code).toBe("0001");
  });
});

describe("a `>` rides as content", () => {
  // TiddlyWiki's reUnquotedAttribute admits `>(?!>)` inside a value. A capture that excluded `>`
  // outright read NULL where the parser read the whole address — found against the parse tree.
  test("★ an address carrying a bracket survives, quoted ★", () => {
    expect(matchCarrierHead(`<<^ code="&#x0001;" from="?" -> to="lar:///a>b">>`)?.uri).toBe("lar:///a>b");
  });

  test("★ and bare ★", () => {
    expect(matchCarrierHead(`<<^ code="&#x0001;" from="?" -> to=lar:///a>b>>`)?.uri).toBe("lar:///a>b");
  });

  test("but `>>` still closes the sigil", () => {
    expect(matchCarrierHead(`<<^ code="&#x0001;" from="?" -> to="${URI}">> trailing`)?.uri).toBe(URI);
  });
});

describe("a QUOTED head opens nothing", () => {
  // Found by measuring the shore against TiddlyWiki's own parse tree over 700 carriers: a fenced decoy
  // standing above a real head is the one reading where pattern and parser ever diverged.
  const real = `<<^ code="&#x0001;" from="?" -> to="${URI}">>`;

  test("★ a head inside a fence is not this carrier's head ★", () => {
    const decoy = '```\n<<^ code="&#x0001;" from="?" -> to="lar:///DECOY">>\n```\n\n';
    expect(matchCarrierHead(decoy + real)?.uri).toBe(URI);
  });

  test("★ nor one inside a tick span ★", () => {
    const ticked = 'the head reads `<<^ code="&#x0001;" from="?" -> to="lar:///DECOY">>` like so\n\n';
    expect(matchCarrierHead(ticked + real)?.uri).toBe(URI);
  });

  test("a carrier that only QUOTES a head names no address", () => {
    expect(matchCarrierHead('```\n' + real + '\n```')).toBeNull();
  });
});

describe("CONTROLS — what must NOT read as a head", () => {
  test("a speaking sigil is not a control frame", () => {
    expect(matchCarrierHead(`<<~ ahu #/entry>>`)).toBeNull();
  });

  test("a pranala carrying from= and to= is not a frame", () => {
    expect(matchCarrierHead(`<<~ pranala #x from=? -> to=lar:///d family=code role=has>>`)).toBeNull();
  });

  test("a turn bearing is not a frame", () => {
    expect(matchCarrierHead(`<<~ lares aim from=lar:///a -> to=lar:///b>>`)).toBeNull();
  });

  test("a non-framing control code names no head", () => {
    expect(matchCarrierHead(`<<^ code="&#x0002;" from="?" -> to="${URI}">>`)).toBeNull();
  });

  test("prose that merely mentions the shape reads as nothing", () => {
    expect(matchCarrierHead("the head writes code then a bearing arrow then an address")).toBeNull();
  });

  test("a line-anchored read refuses a head that does not open the line", () => {
    const head = `<<^ code="&#x0001;" from="?" -> to="${URI}">>`;
    expect(matchCarrierHeadLine(head)?.uri).toBe(URI);
    expect(matchCarrierHeadLine("  " + head)).toBeNull();
  });
});

// ── THE PROBE WALK — a mark added to FRAME_MARKS must reach every scan ────────────────────────────
//
// The codes collapse into ONE fact (frame-marks.ts) and the SCANS deliberately stay apart. Between
// those two halves sits the gap this walk closes: a scan that spells the code SET into its own
// pattern honors neither. It keeps no shape the ruling protects — the anchors, flags and surround are
// what the scars record — and it silently drops a mark the declaration stands.
//
// So the walk PUSHES a mark and asks each reader whether it sees one. It asserts nothing about the
// text of any pattern: a reader may reach the answer however its own context earned, and only the
// answer is checked. The probes ride an isolated module graph and never touch the real declaration.
describe("a mark added to FRAME_MARKS reaches every scan — the probe walk", () => {
  /** Codes the grammar stands nowhere, each joining an existing family by NAME PREFIX. */
  const PROBE_SOH = "&#x0095;";
  const PROBE_STX = "&#x0092;";
  const PROBE_ETX = "&#x0093;";
  const PROBE_EOT = "&#x0094;";

  const PROBES = [
    { code: PROBE_SOH, name: "SOH3", slots: ["code", "namespace", "bearing", "uri"] },
    { code: PROBE_STX, name: "STX2", slots: ["code"] },
    { code: PROBE_ETX, name: "ETX2", slots: ["code", "bcc"] },
    { code: PROBE_EOT, name: "EOT3", slots: ["code", "target"] },
  ] as const;

  /**
   * Load a fresh module graph, stand the probes in ITS declaration, and hand the caller the readers.
   *
   * `resetModules` gives the graph its own `frame-marks`; the push lands there BEFORE any consumer
   * imports it, so each reader derives over the probed table. The real declaration this file imported
   * at the top never moves.
   */
  async function withProbes<T>(fn: (m: {
    shape: typeof import("../src/carrier-shape.js");
    check: typeof import("../src/carrier-check.js");
    block: typeof import("../src/block-check.js");
    markdown: typeof import("../src/meme-markdown.js");
    normalize: typeof import("../src/meme-normalize.js");
    stream: typeof import("../src/meme-stream.js");
    deser: typeof import("../src/deserializer.js");
  }) => Promise<T> | T): Promise<T> {
    vi.resetModules();
    try {
      const fm = await import("../src/frame-marks.js");
      (fm.FRAME_MARKS as { code: string; name: string; slots: readonly string[] }[]).push(...PROBES);
      return await fn({
        shape:     await import("../src/carrier-shape.js"),
        check:     await import("../src/carrier-check.js"),
        block:     await import("../src/block-check.js"),
        markdown:  await import("../src/meme-markdown.js"),
        normalize: await import("../src/meme-normalize.js"),
        stream:    await import("../src/meme-stream.js"),
        deser:     await import("../src/deserializer.js"),
      });
    } finally {
      vi.resetModules();
    }
  }

  /** A whole carrier spelled in whichever marks the caller names. */
  const carrier = (soh: string, stx: string, etx: string, eot: string): string =>
    `<<!DOCTYPE "memetic-wikitext+tiddlywiki" "lar:///ha.ka.ba/lares/api/pono/memetic-wikitext">>\n\n`
    + `<<^ code="${soh}" from="?" -> to="${URI}">>\n`
    + '```toml meta\n'
    + `uri-path  = "ha.ka.ba/lares/api/pono/example"\n`
    + '```\n\n'
    + `<<^ code="${stx}">>\n\n`
    + `! Entry\n\nthe body stands here.\n\n`
    + `<<^ code="${etx}">>ni:///sha-256;probe\n\n`
    + `<<^ code="${eot}" -> to="?">>\n`;

  const probed  = carrier(PROBE_SOH, PROBE_STX, PROBE_ETX, PROBE_EOT);
  const canon   = carrier("&#x0001;", "&#x0002;", "&#x0003;", "&#x0004;");

  // HANDED BACK, NOT FORGOTTEN. `carrier-shape.ts` sits in the grammar hearth's ground (the
  // hearths ledger names it and its two tests), and the hearths gate REFUSES a hand that reaches
  // there without a crossing row. Its three scans spell the code set by hand and would fail this
  // probe standing; the cure is the same two lines every module above took. The reading stays
  // written so the hearth that holds the file can turn it green by making the change, and the
  // alternation walk below names the file for the same reason.
  test.todo("★ carrier-shape sees a probed STX · ETX · EOT ★ — owed by the grammar hearth", async () => {
    await withProbes(({ shape }) => {
      const m = shape.readCarrierShape(probed).marks;
      expect({ stx: m.stx, etx: m.etx, eot: m.eot }).toEqual({ stx: true, etx: true, eot: true });
    });
  });

  test("★ carrier-check frames a probed span ★", async () => {
    await withProbes(({ check }) => {
      expect(check.frameStanding(probed).kind).toBe("framed");
    });
  });

  test("★ block-check spans a probed frame and strips a probed EOT ★", async () => {
    await withProbes(({ block }) => {
      expect(block.checkedSpan(probed)).not.toBeNull();
      expect(block.classifyPostamble(`\n<<^ code="${PROBE_EOT}" -> to="?">>\n`).kind).toBe("empty");
    });
  });

  test("★ meme-markdown reads the check off a probed ETX ★", async () => {
    await withProbes(({ markdown }) => {
      expect(markdown.transposeMarkdown(probed).check).toBe("ni:///sha-256;probe");
    });
  });

  test("★ meme-normalize names the ends of a probed opener and closer ★", async () => {
    await withProbes(({ normalize }) => {
      const positional =
        `<<^ code="${PROBE_SOH}" ? -> ${URI}>>\n\n<<^ code="${PROBE_EOT}" -> ?>>\n`;
      const out = normalize.normalizeMemeSource(positional).text;
      expect(out).toContain('from="?"');
      expect(out).toContain('to="?"');
    });
  });

  test("★ meme-stream closes a carrier on a probed ETX ★", async () => {
    await withProbes(({ stream }) => {
      const p = new stream.MemeStreamParser();
      const events = p.push(probed);
      expect(events.map((e) => e.kind)).toContain("carrier-close");
    });
  });

  test("★ the deserializer strips a probed STX and keeps the body ★", async () => {
    await withProbes(({ deser }) => {
      const fields = deser.memeticWikitextDeserializer(probed, { title: "probe" });
      const text = String(fields[0]?.["text"] ?? "");
      expect(text).not.toContain(PROBE_STX);
      expect(text).toContain("the body stands here.");
    });
  });

  // CONTROL — the walk measures the PROBE, never the canonical marks. Every reading above must also
  // hold over the declaration as it stands, or a green probe would prove only that the walk is loose.
  test("CONTROL — every reader answers the same over the CANONICAL marks", async () => {
    await withProbes(({ shape, check, block, markdown, stream, deser }) => {
      const m = shape.readCarrierShape(canon).marks;
      expect({ stx: m.stx, etx: m.etx, eot: m.eot }).toEqual({ stx: true, etx: true, eot: true });
      expect(check.frameStanding(canon).kind).toBe("framed");
      expect(block.checkedSpan(canon)).not.toBeNull();
      expect(markdown.transposeMarkdown(canon).check).toBe("ni:///sha-256;probe");
      expect(new stream.MemeStreamParser().push(canon).map((e) => e.kind)).toContain("carrier-close");
      const text = String(deser.memeticWikitextDeserializer(canon, { title: "canon" })[0]?.["text"] ?? "");
      expect(text).toContain("the body stands here.");
    });
  });

  // CONTROL — a code the declaration never stands reaches no reader. Without this the probe tests
  // would pass over a scan that matched ANY four-hex entity, which honors neither half of the ruling.
  test("CONTROL — an UNDECLARED code frames nothing", async () => {
    await withProbes(({ shape, check }) => {
      const stranger = carrier("&#x0001;", "&#x0099;", "&#x009a;", "&#x009b;");
      const m = shape.readCarrierShape(stranger).marks;
      expect({ stx: m.stx, etx: m.etx, eot: m.eot }).toEqual({ stx: false, etx: false, eot: false });
      expect(check.frameStanding(stranger).kind).toBe("absent");
    });
  });

  // A SUPPLEMENTARY READING, and it says so. The probe tests above drive public readers; the one
  // remaining scan — `action-handler`'s SOH wall — sits behind an async catalog handler no unit
  // fixture reaches. What a source walk CAN see is the smell itself: a multi-code alternation of
  // frame entities spelled into a pattern. The bootstrap scanner passes it standing, because its
  // hand-written rows carry ONE code each by the ruling that keeps it independent (scanner.ts).
  /**
   * THE EXEMPTION NAMES ITS OWN RETIREMENT.
   *
   * One file sits exempt above because another hearth holds it, not because the law spares it. An
   * exemption nobody retires reads as a hole with a comment on it — so this asks whether the reason still
   * stands. The moment the grammar hearth takes the shared alternation, this goes red and the cure is to
   * delete the entry and the `test.todo` beside it, never to widen the set.
   */
  test("the handed-back file STILL spells the set by hand — or this exemption has expired", () => {
    const shapeSrc = readFileSync(fileURLToPath(new URL("../src/carrier-shape.js", import.meta.url)).replace(/\.js$/, ".ts"), "utf8");
    const stillHandRolled = /&#x\(\??:?[0-9A-Fa-f]{4}\|[0-9A-Fa-f]{4}/.test(shapeSrc);
    expect(
      stillHandRolled,
      "carrier-shape.ts took the shared alternation — DELETE it from `exempt` above and un-todo the probe",
    ).toBe(true);
  });

  test("★ no module spells a MULTI-CODE alternation of frame entities ★", () => {
    const srcRoot = fileURLToPath(new URL("../src", import.meta.url));
    // `carrier-shape.ts` stands in the grammar hearth's ground and the hearths gate refuses a hand
    // that reaches there without a crossing row. ONE FILE, NAMED — never a pattern: the entry leaves
    // the moment that hearth takes the same alternation every module beside it already takes.
    const exempt = new Set(["frame-marks.ts", "plugin-tiddler.generated.ts", "carrier-shape.ts"]);
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = join(dir, e.name);
        if (e.isDirectory()) return walk(full);
        return e.isFile() && e.name.endsWith(".ts") && !exempt.has(e.name) ? [full] : [];
      });
    // `&#x(` … `|` … `)` — two or more hex bodies listed by hand where the family should speak.
    const ALT = /&#x\(\??:?[0-9A-Fa-f]{4}\|[0-9A-Fa-f]{4}/;
    const offenders: string[] = [];
    for (const file of walk(srcRoot)) {
      readFileSync(file, "utf8").split("\n").forEach((ln, i) => {
        // A doc comment may TEACH the alternation; only live source re-spells it.
        if (/^\s*(\*|\/\/)/.test(ln)) return;
        if (ALT.test(ln)) offenders.push(`${relative(srcRoot, file)}:${i + 1}`);
      });
    }
    expect(offenders, `a hand-listed code set drifts from FRAME_MARKS:\n${offenders.join("\n")}`).toEqual([]);
  });

  test("CONTROL — the alternation walk has teeth", () => {
    const ALT = /&#x\(\??:?[0-9A-Fa-f]{4}\|[0-9A-Fa-f]{4}/;
    expect(ALT.test('const R = /<<\\^&#x(?:0004|0014);/;')).toBe(true);
    expect(ALT.test('const R = new RegExp(`<<\\\\^${frameAlt("EOT")}`);')).toBe(false);
  });
});
