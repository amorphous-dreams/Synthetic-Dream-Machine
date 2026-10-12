/**
 * THE `accepts` ROWS CANNOT DRIFT FROM THE HANDLERS.
 *
 * Each command's row in bin/lares.ts names every flag a handler beneath it reads. This test walks the
 * source reachable from each command's handler file and reds when a literal `options["x"]` / `flags["x"]`
 * read names something the row omits: a handler that gains a flag without its row would otherwise refuse
 * its own flag.
 *
 * CONTROL: the walker finds the reads it should (a known flag per command), so an empty walk reads red
 * rather than passing for nothing.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMANDS, GLOBAL_FLAGS } from "../src/bin/lares.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

/** Which file each command's handler lives in (the `import` the table row names). */
const HANDLER_FILE: Readonly<Record<string, string>> = {
  vessel: "commands/vessel", herm: "commands/herm", host: "commands/host-cmd", walk: "commands/walk-cmd",
  act: "commands/act", ingest: "commands/ingest", watch: "commands/watch", draft: "commands/draft",
  receipt: "commands/receipt-cmd", cancel: "commands/receipt-cmd", meme: "commands/meme", bag: "commands/bag",
  wiki: "commands/wiki", "cleanup-days": "commands/cleanup-days", sense: "commands/sense", flow: "commands/flow-run",
  "wing-of": "commands/wing-of", mempalace: "commands/mempalace", hooks: "commands/hooks",
  sensorium: "commands/sensorium", "test-quine": "commands/scripted", vault: "commands/vault",
  library: "commands/library", persona: "commands/persona", circle: "commands/circle", cabal: "commands/cabal",
  edge: "commands/edge", raise: "commands/raise", nexus: "commands/nexus", "device-admit": "commands/device-admit",
  handle: "commands/handle",
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

function literalReads(files: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const f of files) {
    const s = code(f);
    for (const m of s.matchAll(/\b[a-zA-Z_.]*\.(?:options|flags)\["([^"]+)"\]/g)) names.add(m[1] as string);
    for (const m of s.matchAll(/"([a-z][a-z-]*)" in [a-z.]*(?:options|flags)/g)) names.add(m[1] as string);
  }
  return names;
}

/**
 * Reads reached only through args a handler BUILDS for an inner call (seed hands `act` its own
 * `from`/`out`/`title`/`plane`; `sense` reaches `help-mempalace` only through the guest door), so no user
 * line carries them. Named per command, each with its reason, so an exemption never covers a user flag.
 */
const BUILT_INSIDE: Readonly<Record<string, readonly string[]>> = {
  vessel: ["from", "out", "title", "plane", "source", "to", "source-uri"],   // seed builds its act/ingest lines
  sense:  ["help-mempalace"],                  // the guest comparator's help rides `lares mempalace`
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

  for (const c of COMMANDS) {
    test(`★ ${c.name}: every literal read sits in its row ★`, () => {
      const read = literalReads(reachable(resolve(SRC, `${HANDLER_FILE[c.name]}.ts`)));
      const known = new Set([...c.accepts, ...GLOBAL_FLAGS]);
      const missing = [...read].filter((n) => !known.has(n) && !(BUILT_INSIDE[c.name] ?? []).includes(n));
      expect(missing, `${c.name} reads ${missing.join(", ")} but its accepts row omits it`).toEqual([]);
    });
  }

  test("★ cabal: every flag its summary offers sits in its row ★", () => {
    const cabal = COMMANDS.find((c) => c.name === "cabal")!;
    const offered = [...cabal.summary.matchAll(/--([a-z][a-z-]*)/g)].map((m) => m[1]!);
    expect(offered.length, "the summary names no flag, so this check reads nothing").toBeGreaterThan(0);
    const known = new Set([...cabal.accepts, ...GLOBAL_FLAGS]);
    expect(offered.filter((f) => !known.has(f)), "cabal's summary offers a flag its row refuses").toEqual([]);
  });
});
