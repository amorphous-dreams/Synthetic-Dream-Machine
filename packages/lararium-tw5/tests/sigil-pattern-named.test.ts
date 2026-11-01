/**
 * The sigil tiddlers write the kupono grammar: every call a NAMED, TICKED value, and no arrow between
 * two values. (Train Q, row Q5.)
 *
 * ── WHAT THE SHELF PROMISES ─────────────────────────────────────────────────────────────────────
 * The tiddlers under `tiddlers/sigil-*.tid` are the SOURCE of the grammar: their `lar-*pattern` fields
 * generate the table the scanner reads, and their `lar-example` fields are the one worked call each
 * definition ships. Cut 1 retires the arrow between values (`from=`/`to=` carry the relation), Cut 3
 * names and ticks every value (`name=\`value\``), Cut 4 folds the turn frame into `set lares=` with the
 * `aim` / `steer` / `yield` firings. This file pins all three on the shelf itself:
 *
 *   · every `lar-example` is a named, ticked call, and it matches one of its OWN tiddler's patterns;
 *   · a table of worked calls reads the capture groups the builder indexes (`groups[i]`), so a
 *     rewritten pattern cannot shift a group;
 *   · `from=` and `to=` ride in either order (lookaheads), the slot word rides as `slot=\`#…\``;
 *   · no pattern field keeps a `"`, an arrow, or the `[=:]` alternation;
 *   · no worked specimen in a comment keeps a quoted value or an arrow between values;
 *   · the burned tiddlers stay absent, `sigil-set.tid` fires `lares=`, `sigil-node.tid` stands.
 *
 * CONTROLS ride beside each law: the OLD arrow forms fail the NEW patterns, a known-good existing
 * pattern still passes, and the checkers themselves flag a planted bad specimen.
 */
import { describe, test, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const DIR = new URL("../tiddlers/", import.meta.url).pathname;

interface Tid { file: string; head: string; fields: Record<string, string>; text: string }

function readShelf(): Tid[] {
  return readdirSync(DIR).filter((n) => /^sigil-.*\.tid$/.test(n)).map((file) => {
    const text = readFileSync(DIR + file, "utf8");
    const split = text.indexOf("\n\n");
    const fields: Record<string, string> = {};
    for (const line of text.slice(0, split < 0 ? undefined : split).split("\n")) {
      const m = /^([\w-]+):\s?(.*)$/.exec(line);
      if (m) fields[m[1]!] = m[2]!;
    }
    return { file, head: file.slice("sigil-".length, -".tid".length), fields, text };
  });
}

const shelf = readShelf();
const byHead = new Map(shelf.map((t) => [t.head, t]));
const PATTERN_FIELDS = ["lar-pattern", "lar-open-pattern", "lar-inline-pattern", "lar-block-pattern", "lar-pragma-pattern"];

/** The patterns a tiddler declares to open or stand alone (never the closer). */
const patternsOf = (t: Tid): string[] => PATTERN_FIELDS.flatMap((f) => (t.fields[f] ? [t.fields[f]!] : []));

// ── L1 · a call is NAMED and TICKED ────────────────────────────────────────────────────────────
const TICKED = "(?:```[\\s\\S]*?```|`[^`]*`)";
const NAMED_CALL = new RegExp(`^<<~?!? ?[\\w?-]+(?:\\s+[\\w.-]+=${TICKED})*\\s*>>$`);

/** A worked call that breaks the grammar: a quote, an arrow, a positional value, an unticked value. */
const callProblems = (call: string): string[] => {
  const found: string[] = [];
  if (!NAMED_CALL.test(call)) found.push("not every value rides as name=`value`");
  const outsideTicks = call.replace(new RegExp(TICKED, "g"), "T");
  if (/"/.test(outsideTicks)) found.push("a double quote stands outside a tick");
  if (/->/.test(outsideTicks)) found.push("an arrow stands between values");
  return found;
};

const firstLine = (example: string): string => example.replace(/\\n/g, "\n").split("\n")[0]!;

/**
 * ── WHO MAY STAND OUTSIDE THE EXAMPLE-MATCHES-PATTERN LAW ──────────────────────────────────────
 * Declared, never inferred. `ward` patterns the prose `Drift-Ward(`, never a call; `dispatcher` and the
 * family indexes ship no example.
 */
const PROSE_PATTERN = new Set(["ward"]);

describe("every worked call is named and ticked", () => {
  const withExample = shelf.filter((t) => t.fields["lar-example"]);

  test("CONTROL — the shelf carries worked calls to read", () => {
    expect(withExample.length).toBeGreaterThan(60);
  });

  test("CONTROL — the checker flags a planted quoted call, an arrow call and a positional call", () => {
    expect(callProblems('<<~ persona Lares "a multitude">>')).not.toEqual([]);
    expect(callProblems('<<~ pranala lar:///a.b.c/x lar:///a.b.c/y>>')).not.toEqual([]);
    expect(callProblems("<<~ pranala from=`A` -> to=`B`>>")).toContain("an arrow stands between values");
    expect(callProblems("<<~ aperture 9/measure>>")).not.toEqual([]);
  });

  test("CONTROL — the checker passes a named, ticked call, an arrow INSIDE a value, and a bare call", () => {
    expect(callProblems("<<~ persona name=`Lares` params=`a multitude`>>")).toEqual([]);
    expect(callProblems("<<~ scale name=`organ` ranks=`a ~ one -> b ~ two`>>")).toEqual([]);
    expect(callProblems("<<~ else>>")).toEqual([]);
  });

  test("★ every lar-example is a named, ticked call with no arrow between values ★", () => {
    const bad = withExample.flatMap((t) => callProblems(firstLine(t.fields["lar-example"]!)).map((p) => `${t.file}: ${p} · ${t.fields["lar-example"]}`));
    expect(bad).toEqual([]);
  });

  test("★ every lar-example matches one of its OWN tiddler's patterns ★", () => {
    const bad = withExample.filter((t) => !PROSE_PATTERN.has(t.head)).filter((t) => {
      const call = firstLine(t.fields["lar-example"]!);
      return !patternsOf(t).some((p) => new RegExp(p).test(call));
    }).map((t) => `${t.file}: ${firstLine(t.fields["lar-example"]!)}`);
    expect(bad).toEqual([]);
  });
});

// ── L4 · a pattern keeps no quote, no arrow, no [=:] ───────────────────────────────────────────
describe("a pattern field keeps no quote, no arrow and no colon separator", () => {
  test("CONTROL — the shelf declares patterns to read", () => {
    expect(shelf.flatMap(patternsOf).length).toBeGreaterThan(80);
  });

  test("★ no pattern carries a double quote, an arrow or the [=:] alternation ★", () => {
    const bad = shelf.flatMap((t) => PATTERN_FIELDS.flatMap((f) => {
      const v = t.fields[f];
      if (!v) return [];
      const why = [/"/.test(v) && "a double quote", /->/.test(v) && "an arrow", /\[=:\]/.test(v) && "[=:]"].filter(Boolean);
      return why.length ? [`${t.file} ${f}: ${why.join(", ")}`] : [];
    }));
    expect(bad).toEqual([]);
  });
});

// ── L3 · the capture groups the builder indexes ────────────────────────────────────────────────
type Case = { head: string; field: string; call: string; groups: (string | undefined)[] };
const U = undefined;
const A = "lar:///a.b.c/x";
const B = "lar:///a.b.c/y";
const CASES: Case[] = [
  // slot words ride named
  { head: "ahu", field: "lar-open-pattern", call: "<<~ ahu slot=`#/head`>>", groups: ["#/head", U] },
  { head: "ahu", field: "lar-open-pattern", call: "<<~ ahu slot=`#/a/b` to=`lar:///t/elsewhere`>>", groups: ["#/a/b", "lar:///t/elsewhere"] },
  { head: "ahu", field: "lar-open-pattern", call: "<<~ kahea ahu slot=`#/x`>>", groups: ["#/x", U] },
  { head: "fragment", field: "lar-open-pattern", call: "<<fragment slot=`#/head`>>", groups: ["#/head", U] },
  { head: "fragment", field: "lar-open-pattern", call: "<<fragment slot=`#/head` to=`lar:///t/elsewhere`>>", groups: ["#/head", "lar:///t/elsewhere"] },
  { head: "kau", field: "lar-pattern", call: "<<~ kau slot=`#frag` name=`Laptop` props=`a b`>>", groups: ["#frag", "Laptop", "a b"] },
  { head: "kau", field: "lar-pattern", call: "<<~ kau name=`Laptop`>>", groups: [U, "Laptop", U] },
  // the bearing pair rides from= / to=, in EITHER order
  { head: "pranala", field: "lar-inline-pattern", call: `<<~ pranala from=\`${A}\` to=\`${B}\`>>`, groups: [U, A, B, U, U] },
  { head: "pranala", field: "lar-inline-pattern", call: `<<~ pranala to=\`${B}\` from=\`${A}\`>>`, groups: [U, A, B, U, U] },
  { head: "pranala", field: "lar-inline-pattern", call: `<<~ pranala slot=\`#s\` from=\`${A}\` to=\`${B}\` family=\`dataflow\` role=\`r\`>>`, groups: ["#s", A, B, "dataflow", "r"] },
  { head: "pranala", field: "lar-block-pattern", call: `<<~ pranala from=\`${A}\` to=\`${B}\`>>body<<~/pranala>>`, groups: [U, A, B, "body"] },
  { head: "pranala", field: "lar-block-pattern", call: `<<~ pranala to=\`${B}\` from=\`?\`>>body<<~/pranala>>`, groups: [U, "?", B, "body"] },
  { head: "pono", field: "lar-pattern", call: `<<~ pono slot=\`#s\` from=\`${A}\` to=\`${B}\` role=\`r\`>>`, groups: ["#s", A, B, "r"] },
  { head: "pono", field: "lar-pattern", call: `<<~ pono to=\`${B}\` from=\`${A}\`>>`, groups: [U, A, B, U] },
  { head: "constraint", field: "lar-pattern", call: `<<~ constraint from=\`${A}\` to=\`${B}\` role=\`r\`>>`, groups: [U, A, B, "r"] },
  { head: "papalohe", field: "lar-pattern", call: `<<~ papalohe from=\`${A}\` to=\`${B}\` listenable=\`ev\` subscribable=\`fn\`>>`, groups: [U, A, B, "ev", "fn"] },
  { head: "papalohe", field: "lar-pattern", call: `<<~ papalohe to=\`${B}\` from=\`${A}\`>>`, groups: [U, A, B, U, U] },
  { head: "pranala-header", field: "lar-pattern", call: `<<~ ? to=\`${A}\`>>`, groups: [A] },
  // entity relations: name and params
  { head: "persona", field: "lar-pattern", call: "<<~ persona name=`Lares` params=`a multitude`>>", groups: ["Lares", "a multitude"] },
  { head: "persona", field: "lar-pattern", call: "<<~ persona name=`Lares`>>", groups: ["Lares", U] },
  { head: "mu", field: "lar-pattern", call: "<<~ mu name=`Wand` params=`ascii/* glyph/🜂`>>", groups: ["Wand", "ascii/* glyph/🜂"] },
  { head: "has", field: "lar-pattern", call: "<<~ has entity=`rank` name=`pulse` params=`levels/0-4`>>", groups: ["rank", "pulse", "levels/0-4"] },
  { head: "scale", field: "lar-pattern", call: "<<~ scale name=`organ` ranks=`a ~ one -> b ~ two`>>", groups: ["organ", "a ~ one -> b ~ two"] },
  { head: "stage", field: "lar-pattern", call: "<<~ stage rank=`20` name=`Mischief-Muse`>>", groups: ["20", "Mischief-Muse"] },
  { head: "stance", field: "lar-pattern", call: "<<~ stance named=`🏛️ 🗡️`>>", groups: ["🏛️ 🗡️"] },
  { head: "loops", field: "lar-pattern", call: "<<~ loops phases=`observe -> orient`>>", groups: ["observe -> orient"] },
  { head: "kukali", field: "lar-pattern", call: "<<~ kukali trigger=`on-score`>>", groups: ["on-score"] },
  { head: "suspends", field: "lar-pattern", call: "<<~ suspends trigger=`on-score`>>", groups: ["on-score"] },
  // URI leaves
  { head: "aka", field: "lar-pattern", call: `<<~ aka uri=\`${A}\`>>`, groups: [U, A] },
  { head: "aka", field: "lar-pattern", call: "<<~ aka ahu slot=`#/x`>>", groups: ["ahu ", "#/x"] },
  { head: "kanawai", field: "lar-pattern", call: `<<~ kanawai uri=\`${A}\`>>`, groups: [U, A] },
  { head: "kahea", field: "lar-pattern", call: `<<~ kahea uri=\`${A}\`>>`, groups: [A] },
  { head: "kahea", field: "lar-pattern", call: `<<~ kahea name=\`mask\` uri=\`${A}\`>>`, groups: [A] },
  { head: "kahea", field: "lar-open-pattern", call: "<<~ kahea ahu slot=`#/x`>>", groups: ["ahu", "slot=`#/x`"] },
  { head: "loulou", field: "lar-pattern", call: `<<~ loulou uri=\`${A}\`>>`, groups: [A] },
  { head: "import", field: "lar-pattern", call: `<<~ import uri=\`${A}\` key=\`k\`>>`, groups: [A, "k"] },
  { head: "transclude", field: "lar-pattern", call: `<<~ transclude uri=\`${A}\`>>`, groups: [A, U] },
  { head: "lele", field: "lar-pattern", call: `<<~ lele to=\`${A}\`>>`, groups: [A] },
  { head: "branch", field: "lar-pattern", call: `<<~ branch to=\`${A}\`>>`, groups: [A] },
  { head: "hana", field: "lar-open-pattern", call: "<<~ hana grammar=`toml` body=`a = 1`>>", groups: ["toml", "a = 1"] },
  // control and pragma
  { head: "if", field: "lar-open-pattern", call: "<<~ if filter=`[<x>match[1]]`>>", groups: ["[<x>match[1]]"] },
  { head: "huli", field: "lar-open-pattern", call: "<<~ huli filter=`[tag[x]]`>>", groups: ["[tag[x]]", U] },
  { head: "huli", field: "lar-open-pattern", call: "<<~ huli filter=`[tag[x]]` as=`item`>>", groups: ["[tag[x]]", "item"] },
  { head: "ui", field: "lar-pattern", call: "<<~ ui filter=`[tag[x]]`>>", groups: ["[tag[x]]"] },
  { head: "waiho", field: "lar-open-pattern", call: "<<~ waiho name=`n` value=`v`>>", groups: ["n", "v"] },
  { head: "waiho", field: "lar-pragma-pattern", call: "<<~! waiho name=`n` value=`v`>>", groups: ["n", "v"] },
  { head: "helu", field: "lar-open-pattern", call: "<<~ helu name=`tally` filter=`[tag[x]count[]]`>>", groups: ["tally", U, "[tag[x]count[]]"] },
  { head: "kapu", field: "lar-pattern", call: "<<~ kapu scope=`a threshold`>>", groups: ["a threshold"] },
  // heads the grammar gained a tiddler for (Q5): each value named
  { head: "moves", field: "lar-pattern", call: "<<~ moves name=`rendering` params=`rides/the-marker on/the-renderer`>>", groups: ["rendering", "rides/the-marker on/the-renderer"] },
  { head: "moves", field: "lar-pattern", call: "<<~moves name=`rendering`>>", groups: ["rendering", U] },
  { head: "flows", field: "lar-pattern", call: "<<~ flows name=`turn` path=`a -> b -> c`>>", groups: ["turn", "a -> b -> c"] },
  { head: "hoike", field: "lar-pattern", call: "<<~ hoike slot=`#substrate-clause` held=`no boot clause`>>", groups: ["#substrate-clause", "no boot clause"] },
  { head: "hoike", field: "lar-pattern", call: "<<~ hoike held=`no boot clause` slot=`#substrate-clause`>>", groups: ["#substrate-clause", "no boot clause"] },
  { head: "kue", field: "lar-pattern", call: "<<~ kue voice=`Stranger` key=`a re-entry condition`>>", groups: ["Stranger", "a re-entry condition"] },
  { head: "saksi", field: "lar-pattern", call: "<<~ saksi voice=`house` scope=`deposition`>>", groups: ["house", "deposition"] },
  { head: "moolelo", field: "lar-pattern", call: "<<~ moolelo held=`the direction`>>", groups: ["the direction"] },
  { head: "talk-story", field: "lar-pattern", call: "<<~ talk-story slot=`#floor` ground=`the surface`>>", groups: ["#floor", "the surface"] },
  { head: "status", field: "lar-pattern", call: "<<~ status text=`harvest read-only`>>", groups: ["harvest read-only"] },
  // the turn frame: ONE sigil, three firings
  { head: "node", field: "lar-pattern", call: "<<~ node action=`refreshes the libation dish`>>", groups: ["refreshes the libation dish"] },
];

describe("the capture groups the builder indexes stay put", () => {
  test("CONTROL — the table reads real tiddlers", () => {
    for (const c of CASES) expect(byHead.get(c.head), `sigil-${c.head}.tid stands`).toBeTruthy();
  });

  for (const c of CASES) {
    test(`★ ${c.head} ${c.field} reads ${c.call.slice(0, 70)} ★`, () => {
      const pat = byHead.get(c.head)?.fields[c.field];
      expect(pat, `sigil-${c.head}.tid carries ${c.field}`).toBeTruthy();
      const m = new RegExp(pat!).exec(c.call);
      expect(m, `${c.field} must match ${c.call}`).not.toBeNull();
      expect(Array.from({ length: c.groups.length }, (_, i) => m![i + 1])).toEqual(c.groups);
      expect(m!.length - 1, "the pattern captures exactly the groups the builder indexes").toBe(c.groups.length);
    });
  }

  test("★ the `set` pattern takes a lares firing, whatever its keys carry ★", () => {
    const pat = new RegExp(byHead.get("set")?.fields["lar-pattern"] ?? "$^");
    const yieldCall = "<<~ set lares=`yield` drift-ward=`a ward` aperture=`10/measure -> 12/measure` ooda-ha=`closed 1↺` from=`" + A + "` to=`?`>>";
    expect(pat.test("<<~ set lares=`aim` from=`" + A + "` to=`" + B + "` drift-ward=`a pull`>>")).toBe(true);
    expect(pat.test(yieldCall)).toBe(true);
  });
});

// ── CONTROLS · the OLD forms fail the NEW patterns, a known-good pattern still passes ─────────
describe("the old forms fail and a known-good pattern passes", () => {
  const OLD = [
    '<<~ lares aim from="lar:///a.b.c/x" -> to="lar:///a.b.c/y">>',
    '<<~ pranala "lar:///a.b.c/x" -> "lar:///a.b.c/y">>',
    '<<~ pono "lar:///a.b.c/x" -> "lar:///a.b.c/y">>',
    '<<~ constraint "lar:///a.b.c/x" -> "lar:///a.b.c/y">>',
    '<<~ papalohe "lar:///a.b.c/x" -> "lar:///a.b.c/y">>',
    "<<~ ahu #/head -> lar:///t/elsewhere>>",
    '<<~ moves rendering -> rides/the-marker on/the-renderer>>',
    '<<~ persona Lares "a multitude">>',
    '<<~ aka "lar:///a.b.c/x">>',
  ];

  test("★ the OLD lares arrow example matches no pattern on the shelf ★", () => {
    const hits = shelf.filter((t) => patternsOf(t).some((p) => new RegExp(p).test(OLD[0]!))).map((t) => t.file);
    // `set` leads with the word `set`, never `lares`; a `lares` head has no tiddler left.
    expect(hits).toEqual([]);
  });

  test("★ the OLD arrow, quoted and positional calls fail the pattern of the head they name ★", () => {
    const failing = OLD.slice(1).flatMap((call) => {
      const head = /^<<~\s*(\w+)/.exec(call)![1]!;
      const t = byHead.get(head);
      return t && patternsOf(t).some((p) => new RegExp(p).test(call)) ? [`${head}: ${call}`] : [];
    });
    expect(failing).toEqual([]);
  });

  test("CONTROL — a known-good existing pattern passes on its own call", () => {
    for (const [head, call] of [["holo", "<<~ holo>>"], ["else", "<<~ else>>"], ["tick", "<<~ tick>>"], ["race", "<<~ race>>"]] as const) {
      const t = byHead.get(head)!;
      expect(patternsOf(t).some((p) => new RegExp(p).test(call)), `${head} reads ${call}`).toBe(true);
    }
  });
});

// ── L5 · the specimens in a comment follow the grammar ─────────────────────────────────────────
describe("a worked specimen inside a tiddler keeps the grammar", () => {
  /** Every `<<~ …>>`, `<<scale …>>` or `<<has …>>` call in a tiddler outside a `\procedure` / `\widget` definition. */
  const specimens = (t: Tid): string[] => t.text.split("\n")
    .filter((l) => !/^\\(procedure|widget|function)\b/.test(l))
    .flatMap((l) => [...l.matchAll(/<<(?:~!? ?|scale |has |\^ )[^>\n]*(?:>(?!>)[^>\n]*)*>>/g)].map((m) => m[0]));

  test("CONTROL — the shelf carries specimens to read", () => {
    expect(shelf.flatMap(specimens).length).toBeGreaterThan(20);
  });

  test("★ no specimen keeps a quoted value or an arrow between values ★", () => {
    const bad = shelf.flatMap((t) => specimens(t).flatMap((s) => {
      const outside = s.replace(new RegExp(TICKED, "g"), "T");
      const why = [/"/.test(outside) && "a quote", /->/.test(outside) && "an arrow"].filter(Boolean);
      return why.length ? [`${t.file}: ${why.join(", ")} · ${s}`] : [];
    }));
    expect(bad).toEqual([]);
  });
});

// ── L6 · the burn, the set sigil, the node sigil, the names ───────────────────────────────────
describe("the Cut 4 burns and the new frame sigils", () => {
  const BURNED = ["frame", "lares", "hud", "aperture", "ooda-ha", "drift-ward"];

  test("CONTROL — a live sibling tiddler stands where the burned ones stood", () => {
    expect(existsSync(DIR + "sigil-frame-soh.tid")).toBe(true);
    expect(existsSync(DIR + "sigil-oracle.tid")).toBe(true);
  });

  for (const head of BURNED) {
    test(`★ sigil-${head}.tid stays burned ★`, () => {
      expect(existsSync(DIR + `sigil-${head}.tid`)).toBe(false);
    });
  }

  test("★ sigil-set.tid fires lares= with the aim, steer and yield orders ★", () => {
    const t = byHead.get("set")!;
    expect(t.text).toMatch(/^\\procedure set-aim\(\) lares from to mode mood mu stance aperture ooda-ha drift-ward$/m);
    expect(t.text).toMatch(/^\\procedure set-steer\(\) lares to mode mood mu stance aperture ooda-ha drift-ward$/m);
    expect(t.text).toMatch(/^\\procedure set-yield\(\) lares drift-ward aperture ooda-ha mode mood mu stance from to$/m);
    expect(t.text).toMatch(/^\\procedure ~set\(lares mode mood mu stance aperture ooda-ha drift-ward from to note\)$/m);
    expect(t.text).not.toMatch(/\bhud\b[:=]/);
    expect(firstLine(t.fields["lar-example"]!)).toMatch(/^<<~ set lares=`(aim|steer|yield)`/);
  });

  test("★ sigil-node.tid stands with the action key ★", () => {
    const t = byHead.get("node")!;
    expect(t, "sigil-node.tid stands").toBeTruthy();
    expect(t.text).toMatch(/^\\procedure ~node\(action[:)]/m);
    expect(firstLine(t.fields["lar-example"]!)).toMatch(/^<<~ node action=`/);
  });

  test("★ sigil-kanawai.tid names its address uri ★", () => {
    expect(byHead.get("kanawai")!.text).toMatch(/^\\widget ~kanawai\(uri[:)]/m);
  });

  test("★ no procedure or widget on the shelf keeps a positional pN parameter ★", () => {
    const bad = shelf.flatMap((t) => t.text.split("\n")
      .filter((l) => /^\\(procedure|widget)\b/.test(l) && /\(([^)]*\s)?p[1-5][:\s)]/.test(l))
      .map((l) => `${t.file}: ${l}`));
    expect(bad).toEqual([]);
  });

  test("★ no procedure body reads a positional <<pN>> ★", () => {
    const bad = shelf.filter((t) => /<<p[1-5]>>/.test(t.text) || /\bp[1-5]=<</.test(t.text)).map((t) => t.file);
    expect(bad).toEqual([]);
  });
});
