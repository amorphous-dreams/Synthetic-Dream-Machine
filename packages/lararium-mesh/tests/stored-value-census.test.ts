/**
 * stored-value-census.test — no source file reads a record's field off a document but through the one door.
 *
 * A document rests every string of a record as an Automerge immutable scalar, which reads back as a
 * wrapper object. `stored-value.ts` unwraps (the read door) and `stored-record.ts` wraps (the write door).
 * Two instruments hold the law, and each carries a planted fault:
 *
 *   · THE TYPE. `LarDoc.tiddlers` holds `StoredLarRecord`, which exposes no field. A raw read does not
 *     compile, so every package's typecheck reads it red. CONTROL: `fixtures/stored-read/planted-raw-read.ts`
 *     must fail to compile, and `through-the-door.ts` beside it must compile clean.
 *   · THE SCAN. A cast can talk past a type, and a tool written in plain JavaScript holds no type at all.
 *     The scan DERIVES its ground (every source file under `packages/<package>/src` and `tools/`) and reads
 *     red on: a cast laid over a document's `tiddlers` map or over a record read from it · a local type that
 *     declares its own `tiddlers` map of plain records · a bracket read of `["tiddlers"]` · an untyped file
 *     that reads `.tiddler` off a map it names `tiddlers` · a write into a `tiddlers` map that skips the
 *     write door. CONTROL: the same scanner reads a planted fault of each kind and names it.
 *
 * A named exemption carries its reason and the exact count of lines it covers; a count that moved in
 * either direction reads red, so the list cannot rot into a blanket. `OWED` names the files that stand
 * under another hand's uncommitted change: each line there waits as a saved patch.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, test, expect } from "vitest";

const REPO = join(import.meta.dirname, "..", "..", "..");
const PKG = join(import.meta.dirname, "..");

/** The doors and the shore: the files whose work IS the raw record. */
const DOORS: Readonly<Record<string, string>> = {
  "packages/lararium-mesh/src/stored-value.ts": "the read door",
  "packages/lararium-mesh/src/stored-record.ts": "the write door",
  "packages/lararium-mesh/src/automerge-doc-store.ts": "the shore: it merges a hand's record into the document field by field, inside the change",
};

/** A file whose flagged lines stand outside the law, with the reason and the exact count. */
const EXEMPT: Readonly<Record<string, { readonly count: number; readonly reason: string }>> = {
  "packages/lararium-mesh/src/parallel-drafts.ts": { count: 1, reason: "reads the conflict operations beside the live record; every value it answers passes its own `plain`, which unwraps through the read door" },
  "packages/lararium-mesh/src/genesis-doc.ts": { count: 13, reason: "builds and reads the genesis SEED, which stands as plain data; the document it materializes wraps every record through `storedRecord`" },
  "tools/daemon-dvr-node-receipt.mjs": { count: 1, reason: "a recovery witness that plants one marker and asks only whether the title stands" },
};

/** Lines that wait on another hand's uncommitted change in the same file: none stands owed. An entry
 *  names the file, the exact count of flagged lines, and why they wait. */
const OWED: Readonly<Record<string, { readonly count: number; readonly reason: string }>> = {};

export function findRawReads(path: string, source: string): string[] {
  const found: string[] = [];
  const typed = /\.(?:ts|tsx|mts)$/.test(path);
  // Comments name what they describe; only code counts. Line numbers stay true: a block comment keeps its newlines.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ""))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
  const lines = code.split("\n");
  const namesTiddlers = /\btiddlers\b/.test(code);
  lines.forEach((line, index) => {
    const at = `${path}:${index + 1}`;
    const flag = (what: string): void => { found.push(`${at}: ${what}`); };
    if (!/\btiddlers?\b/.test(line)) return;
    // A packed plugin's JSON text parses to plain data: no document stands behind it.
    const json = /JSON\.parse\(/.test(line) || /JSON\.parse\(/.test(lines[index - 1] ?? "") || /JSON\.parse\(/.test(lines[index - 2] ?? "");

    if (/\[\s*["']tiddlers["']\s*\]/.test(line) && !/\]\s*=\s*tiddlers\b/.test(line)) flag("reads [\"tiddlers\"] by bracket, past the document's type");
    if (!json && /\btiddlers\b\??\s*:\s*(?:Readonly<\s*)?Record<\s*string\s*,\s*(?:unknown|any|LarTiddlerRecord|\{)/.test(line)) flag("declares its own tiddlers map of plain records");
    if (!json && /\bas\s+\{[^}]*\btiddlers\b/.test(line)) flag("casts a document to a local shape");
    if (!json && /\btiddlers\b(?:\s*\?\?\s*\{\s*\})?\s*\)?\s*as\s+(?:unknown|never|any|Record<|\{)/.test(line)) flag("casts a document's tiddlers map");
    if (!json && /\btiddlers\b(?:\s*\?\?\s*\{\s*\}\s*\))?\??\.?\[[^\]]*\]!?\s*\)?\s*as\s+(?:unknown|never|any|Record<|\{|LarTiddlerRecord)/.test(line)) flag("casts a record read off a document");
    if (!json && /\brecord\s+as\s+\{\s*tiddler\b/.test(line) && /\btiddlers\b/.test(line)) flag("casts a record read off a document");
    if (!typed && namesTiddlers && /\.tiddler\b\s*\??\.?\s*[\[.]/.test(line)) flag("an untyped file reads a record's field raw");

    const write = /\btiddlers\b(?:\s+as\s+[^)]*\))?\s*\[[^\]]+\]\s*=(?!=)\s*(.*)$/.exec(line);
    if (write && !/^(?:storedRecord|storedLarRecord)\(/.test(write[1]!.trim())) flag("writes a record into a document past the write door");
  });
  return found;
}

function walk(dir: string, keep: (file: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, keep, out);
    else if (keep(name)) out.push(path);
  }
  return out;
}

function censusGround(): string[] {
  const code = (name: string): boolean => /\.(?:ts|tsx|mts|js|mjs|cjs)$/.test(name) && !/\.test\.[cm]?[jt]sx?$/.test(name) && !name.endsWith(".d.ts");
  const files: string[] = [];
  for (const pkg of readdirSync(join(REPO, "packages"))) {
    const src = join(REPO, "packages", pkg, "src");
    try { if (statSync(src).isDirectory()) walk(src, code, files); } catch { /* a package with no src holds no source */ }
  }
  walk(join(REPO, "tools"), code, files);
  return files.map((f) => relative(REPO, f)).sort();
}

const scan = (file: string): string[] => findRawReads(file, readFileSync(join(REPO, file), "utf8"));

describe("the census of raw record reads", () => {
  const ground = censusGround();

  test("the ground reads wide: every package's source and the tools", () => {
    for (const door of Object.keys(DOORS)) expect(ground).toContain(door);
    expect(ground.filter((f) => f.startsWith("packages/lararium-mesh/src/")).length).toBeGreaterThan(200);
    for (const pkg of ["lararium-node", "lares-cli", "lararium-browser", "lararium-keyhive", "lararium-tw5", "lararium-web"]) {
      expect(ground.some((f) => f.startsWith(`packages/${pkg}/src/`)), pkg).toBe(true);
    }
    expect(ground.some((f) => f.startsWith("tools/") && f.endsWith(".mjs"))).toBe(true);
  });

  test("★ no source file reads a record off a document, or writes one, but through the doors ★", () => {
    const found = ground
      .filter((f) => !(f in DOORS) && !(f in EXEMPT) && !(f in OWED))
      .flatMap(scan);
    expect(found).toEqual([]);
  });

  test("every exemption and every owed line still names exactly the lines it covers", () => {
    for (const [file, { count, reason }] of [...Object.entries(EXEMPT), ...Object.entries(OWED)]) {
      expect(reason.length, file).toBeGreaterThan(20);
      expect(scan(file), file).toHaveLength(count);
    }
    for (const door of Object.keys(DOORS)) expect(ground, door).toContain(door);
  });

  test("the doors' callers reach them: every package that holds a document imports a door by name", () => {
    const callers = ground.filter((f) => !(f in DOORS)
      && /\b(?:plainRecord|plainRecordOrNull|plainField|plainEntries|plainValue|storedRecord|storedLarRecord|tiddlerText)\s*\(/.test(readFileSync(join(REPO, f), "utf8")));
    expect(callers.length).toBeGreaterThan(40);
    for (const pkg of ["lararium-mesh", "lararium-node", "lararium-tw5", "lararium-browser", "lararium-keyhive"]) {
      expect(callers.some((f) => f.startsWith(`packages/${pkg}/src/`)), pkg).toBe(true);
    }
  });
});

describe("CONTROL: the type refuses a raw read", () => {
  test("the planted raw read fails to compile at both lines, and the same reads through the door compile clean", () => {
    let out = "";
    try {
      out = execFileSync("npx", ["tsc", "--noEmit", "--pretty", "false", "-p", "tests/fixtures/stored-read/tsconfig.json"], { cwd: PKG, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      out = String((error as { stdout?: unknown }).stdout ?? "") + String((error as { stderr?: unknown }).stderr ?? "");
    }
    const errors = out.split("\n").filter((l) => /error TS/.test(l) && !/TS6059/.test(l));
    const planted = errors.filter((l) => l.includes("planted-raw-read.ts"));
    expect(planted.map((l) => /error (TS\d+)/.exec(l)![1])).toEqual(["TS2339", "TS2339"]);
    expect(planted[0]).toMatch(/Property 'tiddler' does not exist on type 'StoredLarRecord'/);
    expect(planted[1]).toMatch(/Property 'meta' does not exist on type 'StoredLarRecord'/);
    expect(errors.filter((l) => l.includes("through-the-door.ts"))).toEqual([]);
    expect(errors).toHaveLength(2);
  }, 120_000);
});

describe("CONTROL: a planted fault of each kind reads red in the scan", () => {
  const PLANTED: ReadonlyArray<readonly [string, string, string, RegExp]> = [
    ["a cast over the map", "x.ts", `const t = (handle.doc()?.tiddlers ?? {}) as Record<string, LarTiddlerRecord>;`, /casts a document's tiddlers map/],
    ["a cast over the map in a change", "x.ts", `const target = doc.tiddlers as Record<string, LarTiddlerRecord>;`, /casts a document's tiddlers map/],
    ["a cast over one record", "x.ts", `const rec = h.doc()?.tiddlers?.[title] as LarTiddlerRecord | undefined;`, /casts a record read off a document/],
    ["a cast to never", "x.ts", `tiddlerText((doc.tiddlers ?? {})[key] as never);`, /casts a record read off a document/],
    ["a local doc shape", "x.ts", `const e = (opts.daemonDoc as { tiddlers?: Record<string, unknown> }).tiddlers?.[K];`, /casts a document to a local shape/],
    ["a parameter that declares its own map", "x.ts", `export function scan(\n  tiddlers: Readonly<Record<string, LarTiddlerRecord>> | undefined,\n): void {}`, /declares its own tiddlers map/],
    ["a bracket read", "x.ts", `const map = ((doc as Record<string, unknown>)?.["tiddlers"] ?? {});`, /by bracket/],
    ["an untyped tool", "x.mjs", `for (const [t, e] of Object.entries(doc?.tiddlers ?? {})) { if (typeof e?.tiddler?.bearing === "string") out.push(e.tiddler.bearing); }`, /untyped file reads a record's field raw/],
    ["a literal write", "x.ts", `doc.tiddlers[title] = { tiddler: { title, text }, meta: { authority } };`, /past the write door/],
    ["a plain-record write", "x.ts", `d.tiddlers[rec.tiddler.title] = rec;`, /past the write door/],
    ["a write through a cast", "x.ts", `(doc.tiddlers as Record<string, LarTiddlerRecord>)[key] = record;`, /past the write door/],
  ];
  for (const [name, path, source, expected] of PLANTED) {
    test(name, () => { expect(findRawReads(path, source).join("\n")).toMatch(expected); });
  }

  test("code through the doors reads clean, and so does a packed plugin's JSON", () => {
    const clean = [
      `const text = tiddlerText(handle.doc()?.tiddlers?.[key]);`,
      `for (const [title, rec] of plainEntries(doc?.tiddlers)) use(title, rec.tiddler.text);`,
      `doc.tiddlers[key] = storedLarRecord(key, { text: url }, "boot");`,
      `d.tiddlers[rec.tiddler.title] = storedRecord(rec);`,
      `delete doc.tiddlers[title];`,
      `const tiddlers = (JSON.parse(packed.text ?? "{}") as { tiddlers?: Record<string, { text?: string }> }).tiddlers ?? {};`,
      `// const old = (doc.tiddlers as Record<string, LarTiddlerRecord>)[key];`,
    ].join("\n");
    expect(findRawReads("x.ts", clean)).toEqual([]);
  });
});
