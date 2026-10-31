/**
 * The reality-tunnel's laws, over generated inputs: every kind the engine names holds them for any
 * document a host could hand it, and the literal cases earlier bugs left run first as seeds.
 *
 * L5 · a convergent act changes nothing on a second run; undo restores the recorded bytes exactly
 * L6 · foreign or changed bytes survive without explicit authorization
 * L13 · a refused act refuses before any effect
 * L14 · no wall clock decides an outcome
 * L15 · an output follows from its declared inputs alone
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { describe, expect, test as plain, vi } from "vitest";
import { fc, test } from "@fast-check/vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify as tomlStringify } from "smol-toml";
import { Ledger, read, tend, undo, type Item } from "../../src/reality-tunnel/engine.js";
import {
  claudeHook, headLine, jsonFloor, jsonForeign, jsonIncludes, jsonSet, seedless, tomlForeign, tomlHook, tomlMcpServer,
  tomlTableKey, tomlTableUnset, tomlTopFloor,
} from "../../src/reality-tunnel/kinds.js";

type Kind = (cur: string | null) => string | null;
const MCP = { command: "/usr/bin/python3", args: ["/clone/lares_mcp.py"], env: { PYTHONPATH: "/clone/mp" } };

/** Every JSON kind the catalog names, as one table: a new kind joins every law below by joining it. */
const JSON_KINDS: Array<[string, Kind]> = [
  ["jsonFloor", jsonFloor("cleanupPeriodDays", 99999)],
  ["jsonSet", jsonSet(["mcpServers", "lares"], { command: "p", args: ["a"] })],
  ["jsonIncludes", jsonIncludes("claudeMdExcludes", "**/x.md")],
  ["claudeHook", claudeHook("Stop", "hook.sh", { type: "command", command: 'bash "/new/hook.sh"', timeout: 30 })],
];
const TOML_KINDS: Array<[string, Kind]> = [
  ["tomlTopFloor", tomlTopFloor("project_doc_max_bytes", 65536)],
  ["tomlTableKey", tomlTableKey("history", "persistence", "save-all")],
  ["tomlTableUnset", tomlTableUnset("history", "max_bytes")],
  ["tomlMcpServer", tomlMcpServer("lares", MCP)],
  ["tomlHook", tomlHook("Stop", "hook.sh", "/new/hook.sh", 60)],
];
const TEXT_KINDS: Array<[string, Kind]> = [
  ["headLine", headLine("@.claude/noosphere-boot", "@.claude/noosphere-boot\n\nbody\n")],
  ["seedless", seedless("thin\n")],
];

/** A JSON object a host might hold: plain keys, nested values, the keys the kinds touch among them. */
const key = fc.constantFrom("model", "hooks", "mcpServers", "cleanupPeriodDays", "claudeMdExcludes", "theme", "x");
const jsonDoc = fc.dictionary(key, fc.jsonValue({ maxDepth: 3 }), { maxKeys: 6 }).map((o) => `${JSON.stringify(o, null, 2)}\n`);
/** A TOML document: generated tables, the ones the kinds touch among them, stringified by a real writer. */
const tomlKey = fc.constantFrom("history", "mcp_servers", "model", "project_doc_max_bytes", "persistence", "max_bytes", "a");
const tomlValue = fc.oneof(fc.integer({ min: 0, max: 100000 }), fc.string({ maxLength: 12 }), fc.boolean());
const tomlDoc = fc.dictionary(tomlKey, fc.oneof(tomlValue, fc.dictionary(tomlKey, tomlValue, { maxKeys: 3 })), { maxKeys: 4 })
  .map((o) => { try { return tomlStringify(o); } catch { return ""; } });
/** A text file: plain lines, a pointer line among them sometimes. */
const textDoc = fc.array(fc.oneof(fc.string({ maxLength: 30 }).map((l) => l.replace(/\n/g, " ")), fc.constantFrom("-> [noosphere-boot.mem](x)", "@bags/x/noosphere-boot.mem", "---", "paths: ['**']")), { maxLength: 8 })
  .map((ls) => `${ls.join("\n")}\n`);

const SEEDS_JSON: Array<[string | null]> = [[null], ["{}\n"], ['{"cleanupPeriodDays": 30, "model": "x"}\n'], ['{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"bash \\"/old/hook.sh\\""}]}]}}\n']];
const SEEDS_TOML: Array<[string | null]> = [[null], ["history = 1\n"], ["mcp_servers = 1\n"], ["hooks = 1\n"], ["[project_doc_max_bytes]\n"], ["[a]\nproject_doc_max_bytes = 5\n"], ["project_doc_max_bytes = 32768\n"], ["[history]\npersistence = \"none\"\nmax_bytes = 10\n"], ["[[hooks.Stop]]\n\n[[hooks.Stop.hooks]]\ntype = \"command\"\ncommand = \"/old/hook.sh\"\ntimeout = 60\n"]];

describe("L5 · every kind converges: a second application changes nothing", () => {
  for (const [name, f] of JSON_KINDS) {
    test.prop([fc.option(jsonDoc, { nil: null })], { examples: SEEDS_JSON })(name, (doc) => {
      const once = f(doc);
      expect(f(once)).toBe(once);
    });
  }
  for (const [name, f] of TOML_KINDS) {
    test.prop([fc.option(tomlDoc, { nil: null })], { examples: SEEDS_TOML })(name, (doc) => {
      const once = f(doc);
      expect(f(once)).toBe(once);
    });
  }
  for (const [name, f] of TEXT_KINDS) {
    test.prop([fc.option(textDoc, { nil: null })])(name, (doc) => {
      const once = f(doc);
      expect(f(once)).toBe(once);
    });
  }
  plain("CONTROL: a transform that appends on every run reads non-convergent", () => {
    const grows: Kind = (c) => `${c ?? ""}x`;
    expect(grows(grows("a"))).not.toBe(grows("a"));
  });
});

describe("L6 · a kind never turns bytes that parse into bytes that do not", () => {
  for (const [name, f] of JSON_KINDS) {
    test.prop([fc.option(jsonDoc, { nil: null })], { examples: SEEDS_JSON })(name, (doc) => {
      const out = f(doc);
      if (out !== null) expect(jsonForeign(out)).toBeNull();
    });
  }
  for (const [name, f] of TOML_KINDS) {
    test.prop([fc.option(tomlDoc, { nil: null })], { examples: SEEDS_TOML })(name, (doc) => {
      if (doc !== null && tomlForeign(doc) !== null) return;
      const out = f(doc);
      if (out !== null) expect(tomlForeign(out)).toBeNull();
    });
  }
});

describe("L6 · bytes a kind cannot own survive, untouched, under every kind", () => {
  const notJson = fc.string({ minLength: 1, maxLength: 40 }).filter((s) => jsonForeign(s) !== null);
  for (const [name, f] of JSON_KINDS) {
    test.prop([notJson])(`${name} returns unparseable bytes as it found them`, (bytes) => {
      expect(f(bytes)).toBe(bytes);
    });
  }
  const notToml = fc.string({ minLength: 1, maxLength: 40 }).filter((s) => tomlForeign(s) !== null);
  for (const [name, f] of TOML_KINDS) {
    test.prop([notToml])(`${name} returns unparseable bytes as it found them`, (bytes) => {
      expect(f(bytes)).toBe(bytes);
    });
  }
  plain("CONTROL: the generators reach bytes the detectors call foreign", () => {
    expect(jsonForeign("{not json")).not.toBeNull();
    expect(tomlForeign("[[[")).not.toBeNull();
  });
});

describe("L6 · a kind changes only the keys it owns; every sibling key survives as it stood", () => {
  type J = Record<string, unknown>;
  /** Each JSON kind, with the part of a document it owns pared away; what remains must match on both sides. */
  const OWNED: Array<[string, Kind, (o: J) => J]> = [
    ["jsonFloor", JSON_KINDS[0]![1], (o) => { const c = structuredClone(o); delete c["cleanupPeriodDays"]; return c; }],
    ["jsonSet", JSON_KINDS[1]![1], (o) => { const c = structuredClone(o); const m = c["mcpServers"]; if (m && typeof m === "object" && !Array.isArray(m)) { delete (m as J)["lares"]; if (Object.keys(m).length === 0) delete c["mcpServers"]; } return c; }],
    ["jsonIncludes", JSON_KINDS[2]![1], (o) => { const c = structuredClone(o); const l = c["claudeMdExcludes"]; if (Array.isArray(l)) { const k = l.filter((x) => x !== "**/x.md"); if (k.length) c["claudeMdExcludes"] = k; else delete c["claudeMdExcludes"]; } return c; }],
  ];
  const withSiblings = fc.record({
    mine: fc.dictionary(fc.constantFrom("model", "theme", "permissions", "x"), fc.jsonValue({ maxDepth: 2 }), { maxKeys: 3 }),
    servers: fc.dictionary(fc.constantFrom("other", "github", "lares"), fc.jsonValue({ maxDepth: 1 }), { maxKeys: 2 }),
    excludes: fc.array(fc.constantFrom("a", "b/**", "**/x.md"), { maxLength: 3 }),
  }).map(({ mine, servers, excludes }) => `${JSON.stringify({ ...mine, mcpServers: servers, claudeMdExcludes: excludes }, null, 2)}\n`);
  for (const [name, f, pare] of OWNED) {
    test.prop([withSiblings])(name, (doc) => {
      const out = f(doc);
      expect(pare(JSON.parse(out!) as J)).toEqual(pare(JSON.parse(doc) as J));
    });
  }
  plain("CONTROL: a kind that drops a sibling reads as disagreeing", () => {
    const dropper: Kind = () => "{}\n";
    expect(OWNED[0]![2](JSON.parse(dropper('{"model":"m"}')!) as J)).not.toEqual({ model: "m" });
  });
});

describe("the memory guard never lowers: a floor raises a lower value and keeps every higher one", () => {
  test.prop([fc.integer({ min: 0, max: 10_000_000 })])("the JSON floor", (v) => {
    const out = JSON.parse(jsonFloor("cleanupPeriodDays", 99999)(`{"cleanupPeriodDays": ${v}}\n`)!) as { cleanupPeriodDays: number };
    expect(out.cleanupPeriodDays).toBe(Math.max(v, 99999));
  });
  test.prop([fc.integer({ min: 0, max: 10_000_000 })])("the TOML floor", (v) => {
    const out = tomlTopFloor("project_doc_max_bytes", 65536)(`project_doc_max_bytes = ${v}\n`)!;
    expect(out).toContain(`project_doc_max_bytes = ${Math.max(v, 65536)}`);
  });
});

describe("L5 · undo restores whatever bytes a tend replaced, verbatim", () => {
  test.prop([fc.string({ maxLength: 200 })], { numRuns: 40 })("any prior bytes round-trip through tend then undo", async (prior) => {
    const dir = mkdtempSync(join(tmpdir(), "law-undo-"));
    try {
      const path = join(dir, "t");
      writeFileSync(path, prior);
      const l = new Ledger(join(dir, "ledger"));
      const it: Item = { id: "t", radius: "home", host: "t", path, what: "t", transform: () => "the house's bytes\n" };
      await tend([it], l);
      undo(l);
      expect(readFileSync(path, "utf8")).toBe(prior);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("L13 · a refused tend writes nothing at all", () => {
  test.prop([fc.string({ minLength: 1, maxLength: 60 }).filter((s) => jsonForeign(s) !== null)], { numRuns: 40 })("foreign bytes refuse, and the ledger records no generation", async (bytes) => {
    const dir = mkdtempSync(join(tmpdir(), "law-refuse-"));
    try {
      const path = join(dir, "s.json");
      writeFileSync(path, bytes);
      const l = new Ledger(join(dir, "ledger"));
      const r = await tend([{ id: "s", radius: "home", host: "t", path, what: "s", transform: jsonFloor("n", 5), foreign: jsonForeign }], l);
      expect(r.refused.length).toBe(1);
      expect(readFileSync(path, "utf8")).toBe(bytes);
      expect(l.generations()).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("L14 · no wall clock decides: the same act under two clocks leaves the same bytes", () => {
  test.prop([fc.option(jsonDoc, { nil: null }), fc.date({ min: new Date(0), max: new Date(4e12) })], { numRuns: 30 })("every JSON kind", (doc, when) => {
    const at = (t: Date): Array<string | null> => { vi.useFakeTimers(); vi.setSystemTime(t); try { return JSON_KINDS.map(([, f]) => f(doc)); } finally { vi.useRealTimers(); } };
    expect(at(when)).toEqual(at(new Date(when.getTime() + 86_400_000 * 365)));
  });
  plain("CONTROL: a reader of the clock reads two clocks apart", () => {
    const stamp = (): string => new Date().toISOString();
    vi.useFakeTimers(); vi.setSystemTime(new Date(0)); const a = stamp(); vi.setSystemTime(new Date(1e12)); const b = stamp(); vi.useRealTimers();
    expect(a).not.toBe(b);
  });
});

describe("L15 · a kind's output follows from its input alone", () => {
  test.prop([fc.option(jsonDoc, { nil: null })])("the same document twice gives the same bytes, for every kind", (doc) => {
    for (const [, f] of [...JSON_KINDS, ...TEXT_KINDS]) expect(f(doc)).toBe(f(doc));
  });
  plain("the reader the engine uses reads a target without changing it", () => {
    const dir = mkdtempSync(join(tmpdir(), "law-read-"));
    try {
      const path = join(dir, "r.json");
      writeFileSync(path, '{"n": 1}\n');
      read([{ id: "r", radius: "home", host: "t", path, what: "r", transform: jsonFloor("n", 5) }], new Ledger(join(dir, "ledger")));
      expect(readFileSync(path, "utf8")).toBe('{"n": 1}\n');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
