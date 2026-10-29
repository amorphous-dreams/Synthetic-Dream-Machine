/**
 * THE `accepts` ROWS CANNOT DRIFT FROM THE HANDLERS.
 *
 * Each command's row in bin/lares.ts names every flag a handler beneath it reads. This test walks the
 * source reachable from each command's handler file and reds when a literal `options["x"]` / `flags["x"]`
 * read names something the row omits: a handler that gains a flag without its row would otherwise refuse
 * its own flag.
 *
 * A READ WHOSE NAME THE SOURCE COMPUTES (`args.flags[s]` over a list, `name in args.flags`) names nothing a
 * literal scan can see. Every such site answers for the list it walks: `COMPUTED_READS` names the site and
 * derives the list from the source itself, so a name added to that list joins the walk the day it lands, and
 * a computed read no row of the table answers for reads red.
 *
 * THE FORMS THE WALK READS: an indexed read (`args.options["x"]`, with or without `?.`), a dotted read
 * (`args.options.root`), a membership test (`"x" in args.flags`), a destructured read (`const { member,
 * "dry-run": dry } = args.options`), and a computed read through the table below. A read spelled another way
 * (a flag bag handed whole to a helper that picks names off it by its own means) passes the walk; a review
 * reads those.
 *
 * AND THE OTHER WAY ROUND: a row names no flag nobody reads. A name in a row that no handler beneath the command
 * reads passes the gate and changes nothing, so a person who typed it has every reason to believe it took.
 * Each row's names get read by the walk, or sit in `READ_ELSEWHERE` with the reason.
 *
 * CONTROL: the walker finds the reads it should (a known flag per command), so an empty walk reads red
 * rather than passing for nothing.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMANDS, GLOBAL_FLAGS, unknownFlags } from "../src/bin/lares.js";
import { BOOLEAN_FLAGS } from "../src/parse-args.js";
import { posturePlan } from "../src/commands/posture-plan.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

/** Which file each command's handler lives in (the `import` the table row names). */
const HANDLER_FILE: Readonly<Record<string, string>> = {
  vessel: "commands/vessel", herm: "commands/herm", host: "commands/host-cmd", walk: "commands/walk-cmd",
  act: "commands/act", ingest: "commands/ingest", watch: "commands/watch", shore: "commands/shore", draft: "commands/draft",
  receipt: "commands/receipt-cmd", cancel: "commands/receipt-cmd", events: "commands/events", meme: "commands/meme", bag: "commands/bag",
  wiki: "commands/wiki", "cleanup-days": "commands/cleanup-days", sense: "commands/sense", flow: "commands/flow-run",
  "wing-of": "commands/wing-of", mempalace: "commands/mempalace", hooks: "commands/hooks",
  sensorium: "commands/sensorium", "test-quine": "commands/scripted", vault: "commands/vault",
  library: "commands/library", persona: "commands/persona", circle: "commands/circle", cabal: "commands/cabal",
  edge: "commands/edge", raise: "commands/raise", nexus: "commands/nexus",
  handle: "commands/handle", fleet: "commands/fleet", intent: "commands/intent", "intent-relay": "commands/intent-relay",
};

/** Files whose reads are not a command's own: the renderer (json), help, and the table itself. */
const NOT_A_READER = new Set(["render", "env", "parse-args", "command-help", "help-meme", "bin/lares"]);

const code = (f: string): string =>
  readFileSync(f, "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

function reachable(root: string): string[] {
  const seen = new Set<string>();
  const todo = [root];
  while (todo.length > 0) {
    const f = todo.pop() as string;
    if (seen.has(f)) continue;
    const rel = relative(SRC, f).replace(/\.ts$/, "");
    if (NOT_A_READER.has(rel) && f !== root) continue;
    seen.add(f);
    for (const m of code(f).matchAll(/(?:from|import\()\s*"(\.{1,2}\/[^"]+?)\.js"/g)) {
      const p = resolve(dirname(f), `${m[1]}.ts`);
      if (existsSync(p)) todo.push(p);
    }
  }
  return [...seen];
}

/** A read whose index the source computes: `x.flags[name]`, `x.options[k]`, `name in x.flags`. */
const COMPUTED_SITE = /\b[a-zA-Z_.]*\.(?:options|flags)\[(?!")[^\]]+\]|\b[a-zA-Z_$][\w$]* in [a-zA-Z_.]*(?:options|flags)\b/g;

/** The string literals of the first array or union that follows `anchor` in `source`: the list a computed read walks. */
function listAfter(source: string, anchor: string, close: string): string[] {
  const at = source.indexOf(anchor);
  if (at === -1) return [];
  const body = source.slice(at + anchor.length, source.indexOf(close, at + anchor.length));
  return [...body.matchAll(/"([a-z][a-z-]*)"/g)].map((m) => m[1] as string);
}

/**
 * Each file that computes a read's name, with how many such sites it holds and the names they walk, DERIVED
 * from the source: the list's own declaration. A site count that moves reads red, so a new computed read
 * gets its list named here before it passes.
 */
const COMPUTED_READS: Readonly<Record<string, { readonly sites: number; readonly names: () => string[] }>> = {
  // `SURFACES.filter((s) => args.flags[s] === true)`: the harness surfaces a stand or a wire may name.
  "commands/stand":  { sites: 1, names: () => listAfter(code(resolve(SRC, "commands/wire.ts")), "export const SURFACES = [", "]") },
  "commands/wire":   { sites: 1, names: () => listAfter(code(resolve(SRC, "commands/wire.ts")), "export const SURFACES = [", "]") },
  // `reading(name)` reads `args.options[name]` and `name in args.flags` over the three sibling readings of `check`.
  "commands/meme":   { sites: 2, names: () => listAfter(code(resolve(SRC, "commands/meme.ts")), "const reading = (name: ", ")") },
  // `filterKeys.some((k) => args.options[k] …)` and the loop that copies each filter into the verb's args.
  "commands/recall": { sites: 3, names: () => listAfter(code(resolve(SRC, "commands/recall.ts")), "const filterKeys = [", "]") },
  // `posturePlan(Object.keys(a.flags).filter((k) => a.flags[k] === true))` hands on the names PRESENT on the
  // line; it reads no name of its own, and the posture table it feeds holds its own vectors.
  "commands/vessel": { sites: 1, names: () => [] },
};

const relOf = (f: string): string => relative(SRC, f).replace(/\.ts$/, "");

function literalReads(files: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const f of files) {
    const s = code(f);
    // An indexed read, with or without the optional chain: `args.options["x"]`, `args.flags?.["x"]`.
    for (const m of s.matchAll(/\b[a-zA-Z_.]*\.(?:options|flags)(?:\?\.)?\["([^"]+)"\]/g)) names.add(m[1] as string);
    // A dotted read: `args.options.root`, `args.flags?.json`. A call on the bag (`.hasOwnProperty(…)`) and a
    // list's own `length` (a help page's `flags` array) name no flag.
    for (const m of s.matchAll(/\b[a-zA-Z_.]*\.(?:options|flags)\??\.([a-zA-Z_$][\w$]*)\b(?!\s*\()/g)) {
      if (m[1] !== "length") names.add(m[1] as string);
    }
    for (const m of s.matchAll(/"([a-z][a-z-]*)" in [a-z.]*(?:options|flags)/g)) names.add(m[1] as string);
    // `const { member, "dry-run": dry, ["tag-blobs"]: tag, realm = "x" } = args.options`: each key names a flag.
    for (const m of s.matchAll(/\{([^{}=]*(?:=[^{},]*)?(?:,[^{}]*)?)\}\s*=\s*[a-zA-Z_.]*\.(?:options|flags)\b/g)) {
      for (const part of (m[1] as string).split(",")) {
        const key = /^\s*(?:\[?"([a-z][a-z-]*)"\]?|([a-zA-Z][\w]*))/.exec(part);
        if (key) names.add((key[1] ?? key[2]) as string);
      }
    }
    for (const name of COMPUTED_READS[relOf(f)]?.names() ?? []) names.add(name);
  }
  return names;
}

/** Every reachable file's computed read sites, counted. */
function computedSites(files: readonly string[]): Map<string, number> {
  const sites = new Map<string, number>();
  for (const f of files) {
    const n = (code(f).match(COMPUTED_SITE) ?? []).length;
    if (n > 0) sites.set(relOf(f), n);
  }
  return sites;
}

/**
 * Reads reached only through args a handler BUILDS for an inner call (seed hands `act` its own
 * `from`/`out`/`title`/`plane`; `sense` reaches `help-mempalace` only through the guest door), so no user
 * line carries them. Named per command, each with its reason, so an exemption never covers a user flag.
 */
const BUILT_INSIDE: Readonly<Record<string, readonly string[]>> = {
  vessel: ["from", "out", "title", "plane", "source", "to", "source-uri"],   // seed builds its act/ingest lines
  sense:  ["help-mempalace"],                  // the guest comparator's help rides `lares mempalace`
  // `commands/scripted` holds the stand and bake handlers beside this one, and the walk reads a file whole.
  // `cmdTestQuine` takes the line and reads none of it, so the row stays empty and `lares test-quine --x` refuses.
  "test-quine": ["genesis", "port", "root", "wiki"],
};

/**
 * Names a row carries that no handler beneath the command reads off the parsed line, each with where it gets
 * read instead. An entry whose name a handler starts to read, or whose row drops it, reads red: the exemption
 * leaves in the same commit.
 */
const READ_ELSEWHERE: Readonly<Record<string, Readonly<Record<string, string>>>> = {
};

describe("the accepts rows track the handlers", () => {
  test("every command has a row and a located handler", () => {
    for (const c of COMMANDS) {
      expect(HANDLER_FILE[c.name], `${c.name} has no handler file in this test`).toBeDefined();
      expect(Array.isArray(c.accepts), `${c.name} has no accepts row`).toBe(true);
    }
  });

  test("CONTROL: the walker reads real flags (an empty walk would pass for nothing)", () => {
    const circle = literalReads(reachable(resolve(SRC, `${HANDLER_FILE["circle"]}.ts`)));
    expect([...circle].sort()).toEqual(expect.arrayContaining(["petname", "card", "to"]));
  });

  test("★ every computed read answers for the list it walks ★", () => {
    const every = new Map<string, number>();
    for (const c of COMMANDS) for (const [file, n] of computedSites(reachable(resolve(SRC, `${HANDLER_FILE[c.name]}.ts`)))) every.set(file, n);
    const found = Object.fromEntries([...every].sort());
    const declared = Object.fromEntries(Object.entries(COMPUTED_READS).map(([file, row]) => [file, row.sites]).sort());
    expect(found, "a computed read stands in a file COMPUTED_READS does not answer for, or a site count moved").toEqual(declared);
    // Each list derives off the source and reads real names: an anchor that moved reads red here, never as an empty list.
    for (const [file, row] of Object.entries(COMPUTED_READS)) {
      if (file === "commands/vessel") { expect(row.names()).toEqual([]); continue; }
      expect(row.names().length, `${file}: the list its computed read walks reads empty`).toBeGreaterThan(1);
    }
    expect(COMPUTED_READS["commands/stand"]!.names()).toEqual(expect.arrayContaining(["claude", "codex"]));
    expect(COMPUTED_READS["commands/meme"]!.names().sort()).toEqual(["edges", "gradient", "sitting"]);
    // KNOWN POSITIVE: the scan reads each computed spelling, and a literal read reads as none.
    for (const spelled of ["args.flags[s] === true", "args.options[name]", "name in args.flags", "a.flags[k]"]) {
      expect(spelled.match(COMPUTED_SITE), spelled).not.toBeNull();
    }
    for (const literal of ["args.flags[\"json\"]", "\"tree\" in args.flags", "args.options[\"bag\"] ?? \"\""]) {
      expect(literal.match(COMPUTED_SITE), literal).toBeNull();
    }
  });

  for (const c of COMMANDS) {
    test(`★ ${c.name}: every literal read sits in its row ★`, () => {
      const read = literalReads(reachable(resolve(SRC, `${HANDLER_FILE[c.name]}.ts`)));
      const known = new Set([...c.accepts, ...GLOBAL_FLAGS]);
      const missing = [...read].filter((n) => !known.has(n) && !(BUILT_INSIDE[c.name] ?? []).includes(n));
      expect(missing, `${c.name} reads ${missing.join(", ")} but its accepts row omits it`).toEqual([]);
    });
  }

  for (const c of COMMANDS) {
    test(`★ ${c.name}: its row names no flag nobody reads ★`, () => {
      const read = literalReads(reachable(resolve(SRC, `${HANDLER_FILE[c.name]}.ts`)));
      const elsewhere = READ_ELSEWHERE[c.name] ?? {};
      const unread = c.accepts.filter((n) => !read.has(n) && !(n in elsewhere));
      expect(unread, `${c.name}'s row accepts ${unread.join(", ")} and no handler beneath it reads it`).toEqual([]);
      // An exemption holds only while it exempts: the name still sits in the row, and still goes unread here.
      for (const name of Object.keys(elsewhere)) {
        expect(c.accepts, `${c.name}: READ_ELSEWHERE names ${name}, which its row dropped`).toContain(name);
        expect(read.has(name), `${c.name}: READ_ELSEWHERE names ${name}, which a handler reads`).toBe(false);
      }
    });
  }

  test("★ a flag nobody reads refuses by name at the door: `--debug` on a stand, every flag but the global ones on the quine check ★", () => {
    const line = (command: string, flags: Record<string, boolean>) => ({ command, positional: ["stand"], options: {}, flags });
    const vessel = COMMANDS.find((c) => c.name === "vessel")!;
    const quine = COMMANDS.find((c) => c.name === "test-quine")!;
    expect(unknownFlags(vessel, line("vessel", { debug: true })).map((f) => f.name)).toEqual(["debug"]);
    expect(unknownFlags(quine, line("test-quine", { fresh: true, debug: true })).map((f) => f.name).sort()).toEqual(["debug", "fresh"]);
    expect(quine.accepts).toEqual([]);
    // CONTROL: a flag the stand reads passes, and a global flag passes on the quine check.
    expect(unknownFlags(vessel, line("vessel", { restart: true }))).toEqual([]);
    expect(unknownFlags(quine, line("test-quine", { json: true }))).toEqual([]);
    // No table that feeds the door still names it: the boolean set and the posture plan read no `debug`.
    expect(BOOLEAN_FLAGS.has("debug")).toBe(false);
    expect(posturePlan(["debug"]).dropped).toEqual([]);
    expect(posturePlan(["wiki"]).dropped).toEqual(["wiki"]);     // CONTROL: a flag another posture reads does get named
  });

  test("CONTROL: the walk reads a destructured read, quoted keys and defaults among them", () => {
    const edge = literalReads(reachable(resolve(SRC, `${HANDLER_FILE["edge"]}.ts`)));
    expect([...edge]).toEqual(expect.arrayContaining(["member", "voucher", "joiner", "realm"]));
  });

  test("KNOWN POSITIVE: each read form names its flag, and a call on the bag names none", () => {
    const dir = mkdtempSync(join(tmpdir(), "accepts-forms-"));
    const namesIn = (source: string): string[] => {
      const file = join(dir, "form.ts");
      writeFileSync(file, source);
      return [...literalReads([file])].sort();
    };
    try {
      expect(namesIn('const a = args.options["bag"];')).toEqual(["bag"]);
      expect(namesIn('const a = args.flags?.["dry-run"];')).toEqual(["dry-run"]);
      expect(namesIn("const a = args.options.root ?? args.flags?.json;")).toEqual(["json", "root"]);
      expect(namesIn('if ("tree" in args.flags) run();')).toEqual(["tree"]);
      expect(namesIn('const { member, "dry-run": dry, ["tag-blobs"]: tag, realm = "x" } = args.options;')).toEqual(["dry-run", "member", "realm", "tag-blobs"]);
      expect(namesIn("const names = Object.keys(args.flags); const has = args.options.hasOwnProperty(k); if (help.flags.length) show();")).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("★ cabal: every flag its summary offers sits in its row ★", () => {
    const cabal = COMMANDS.find((c) => c.name === "cabal")!;
    const offered = [...cabal.summary.matchAll(/--([a-z][a-z-]*)/g)].map((m) => m[1]!);
    expect(offered.length, "the summary names no flag, so this check reads nothing").toBeGreaterThan(0);
    const known = new Set([...cabal.accepts, ...GLOBAL_FLAGS]);
    expect(offered.filter((f) => !known.has(f)), "cabal's summary offers a flag its row refuses").toEqual([]);
  });
});
