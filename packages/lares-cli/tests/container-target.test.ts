import { describe, expect, test } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import { containerArgs } from "../src/container-target.js";
import type { ParsedArgs } from "../src/parse-args.js";

const args = (options: Record<string, string> = {}): ParsedArgs => ({
  command: "meme", positional: [], options, flags: {},
}) as unknown as ParsedArgs;

describe("containerArgs", () => {
  test("requires one explicit container and names both ways to supply it", () => {
    try {
      containerArgs(args(), "meme get");
      throw new Error("expected no-container refusal");
    } catch (err) {
      expect(err).toMatchObject({ code: "no-container" });
      expect((err as Error).message).toBe(
        "lares meme get: no-container — name where to read: --recipe <slug> (as that wiki, e.g. --recipe lares) or --bag <slug> (that one bag). No default wiki exists.",
      );
    }
  });

  test("returns exactly the named container", () => {
    expect(containerArgs(args({ recipe: " lares " }), "meme get")).toEqual({ recipe: "lares" });
    expect(containerArgs(args({ bag: " sd m " }), "meme put", "write")).toEqual({ bag: "sd m" });
  });

  test("a realm rides beside a bag and names that bag's realm; control: with none named the bag stands alone", () => {
    const realm = "C1AB".repeat(16);
    expect(containerArgs(args({ bag: "lares", realm: ` ${realm} ` }), "meme get")).toEqual({ bag: "lares", realm: realm.toLowerCase() });
    expect(containerArgs(args({ bag: "lares" }), "meme get")).toEqual({ bag: "lares" });
    expect(containerArgs(args({ bag: "lares", realm: "  " }), "meme get")).toEqual({ bag: "lares" });
  });

  test("a realm beside a recipe refuses by name: a wiki lives in no realm", () => {
    try {
      containerArgs(args({ recipe: "lares", realm: "a".repeat(64) }), "meme get");
      throw new Error("expected no-container refusal");
    } catch (err) {
      expect(err).toMatchObject({ code: "no-container" });
      expect((err as Error).message).toContain("--realm names a BAG's realm");
    }
  });

  test("the same named refusal rejects two containers", () => {
    try {
      containerArgs(args({ recipe: "lares", bag: "sdm" }), "meme get");
      throw new Error("expected no-container refusal");
    } catch (err) {
      expect(err).toMatchObject({ code: "no-container" });
      expect((err as Error).message).toBe("lares meme get: no-container — name one of --recipe <slug> or --bag <slug>, never both.");
    }
  });
});

type BareCall = { file: string; line: number; command: string };
const VERB = "(?:put|get|list|delete|project)";

function scanBareCalls(file: string, source: string): BareCall[] {
  const lines = source.split(/\r?\n/);
  const out: BareCall[] = [];
  const recipes = new Set<string>();
  for (const m of source.matchAll(/(?:const|let)\s+(\w+)\s*=\s*\[[^\]]*--(?:recipe|bag)[^\]]*\]/gs)) recipes.add(m[1]!);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/intentional-bare-refusal/.test(line)) continue;
    if (/^\s*(?:\/\/|#|\*)/.test(line)) continue;
    if (/\b(?:test|describe)\s*\(/.test(line)) continue;
    const code = line.replace(/\s+\/\/.*$/, "").replace(/(^|\s)#.*$/, "$1");
    const shell = new RegExp(`\\b(?:lares|\\$LARES|\\$\\{LARES\\})\\s+meme\\s+(${VERB})(?=\\s|$)`).exec(code);
    const node = new RegExp(`\\bnode\\s+[^\\s;&|]*lares\\.(?:mjs|js)\\s+meme\\s+(${VERB})(?=\\s|$)`).exec(code);
    const jsonVerb = new RegExp(`\\bjson_verb\\s+meme\\s+(${VERB})(?=\\s|$)`).exec(code);
    const invocation = shell ?? node ?? jsonVerb;
    if (invocation) {
      const tail = code.slice(invocation.index);
      const command = tail.split(/[;|]/, 1)[0] ?? tail;
      const group = [command];
      while (/\\\s*$/.test(group[group.length - 1]!) && i + 1 < lines.length) group.push(lines[++i]!);
      const full = group.join(" ");
      if (!/--(?:recipe|bag)\b/.test(full) && !/\$@/.test(full) && !(/meme\s+project\b/.test(full) && /--to\s+md\b/.test(full))) {
        out.push({ file, line: i + 1, command: full.trim() });
      }
    }

    const array = /["']meme["']\s*,\s*["'](put|get|list|delete|project)["']/.exec(code);
    if (!array) continue;
    const start = code.lastIndexOf("[", array.index);
    const close = code.indexOf("]", array.index);
    const chunk = (start >= 0 && close >= 0 ? code.slice(start, close + 1) : code.slice(array.index));
    const spreadHasTarget = [...chunk.matchAll(/\.\.\.(\w+)/g)].some((m) =>
      recipes.has(m[1]!) || (m[1] === "seat" && /seat:\s*readonly string\[\]/.test(source)));
    const localMd = /["']project["'][\s\S]*?["']--to["']\s*,\s*["']md["']/.test(chunk);
    if (!/--(?:recipe|bag)/.test(chunk) && !spreadHasTarget && !localMd) {
      out.push({ file, line: i + 1, command: chunk.trim() });
    }
  }
  return out;
}

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  const addTree = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) addTree(path);
      else files.push(path);
    }
  };
  for (const dir of ["tools", "tests", ".github/workflows", "deploy", "packages/lares-cli/src"]) addTree(join(root, dir));
  for (const name of readdirSync(root)) if (/^docker-compose.*\.ya?ml$/.test(name)) files.push(join(root, name));
  for (const name of ["Makefile"]) if (existsSync(join(root, name))) files.push(join(root, name));
  for (const name of readdirSync(join(root, "packages"))) {
    const tests = join(root, "packages", name, "tests");
    addTree(tests);
  }
  return files;
}

describe("repository content-container law", () => {
  test("all literal meme CLI callers name a target, except explicit refusal vectors", () => {
    const root = repoRoot;
    const bare = sourceFiles(root).filter((file) => !file.endsWith("packages/lares-cli/tests/container-target.test.ts")).flatMap((file) =>
      scanBareCalls(relative(root, file), readFileSync(file, "utf8")));
    expect(bare, bare.map((b) => `${b.file}:${b.line}: ${b.command}`).join("\n")).toEqual([]);
  });

  test("CONTROL: the law scanner catches a planted bare call", () => {
    expect(scanBareCalls("planted.test.ts", 'const bad = ["meme", "put", uri, "--json"];')).toEqual([
      { file: "planted.test.ts", line: 1, command: '["meme", "put", uri, "--json"]' },
    ]);
  });

  test("CONTROL: each supported call spelling is detected when bare", () => {
    const planted = [
      ["shell.sh", "lares meme get lar:///t/x"],
      ["node.sh", "node ./packages/lares-cli/bin/lares.mjs meme get lar:///t/x"],
      ["function.sh", "function pull() { lares meme get lar:///t/x; }"],
      ["json.sh", "json_verb meme get lar:///t/x"],
      ["array.ts", 'const args = ["meme", "get", "lar:///t/x"];'],
    ] as const;
    expect(planted.map(([file, source]) => [file, scanBareCalls(file, source).length]))
      .toEqual(planted.map(([file]) => [file, 1]));
  });
});
