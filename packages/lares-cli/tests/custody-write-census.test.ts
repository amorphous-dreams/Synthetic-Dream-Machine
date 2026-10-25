/**
 * custody-write-census — NO FILE UNDER `packages/lares-cli/src` WRITES A CUSTODY ROW.
 *
 * A vessel's sealed rows change behind the custody door: a command sends an act frame, and a node function reads,
 * decides and seals under the one custody holder. A command file that wrote a row itself would write bare bytes
 * where a sealed row rests, or seal under a key session no door granted.
 *
 * EVERYTHING HERE DERIVES FROM THE CARRIER TABLE (`vault-carriers.ts`) AND THE CUSTODY MODULES, never from a list
 * kept in this file:
 *   · THE ROWS: every `hot` and `cold` row of `carrierTable()`.
 *   · THE ROW NAMES: the literal a row's own matcher spells (a flat row's file name), or the subtree it lives under.
 *   · THE WRITE DOORS: the `CustodyHolder` methods that write, update or remove a row (read off the interface);
 *     the custody seat's exported functions that call one; the sealed writer's exported functions that reach a
 *     `CustodyIo` mutator (read off that interface).
 *   · THE WRITER FUNCTIONS: for each row, the module its `writer` column names; in that module, every exported
 *     function that reaches a write door.
 *
 * THE LAW, per command file:
 *   C1  it calls no write door;
 *   C2  it names no writer function of any row's writer module (a command reaches those through an act alone);
 *   C3  it names no row beside a file-system write of its own.
 *
 * WHAT A CENSUS OF SPELLED NAMES CANNOT SEE, stated so nobody reads more into a green: a row's name assembled from
 * parts (`"transition-" + "pending.json"`), a write reached through a helper in another package that neither the
 * table nor the custody modules name, and a call whose name gets computed at run time. The sealed writer's own
 * rotation census catches what such a write leaves on disk: a bare file at a sealed row's path refuses the rotation.
 *
 * THE INSTRUMENT PROVES IT SEES (a zero here could read as blindness):
 *   K1  every hot or cold row yields a name to look for; every writer module that stands yields a writer function;
 *       the derived door set holds the seat's own doors;
 *   K2  PLANTED: a command source that writes a row's file, one that calls a seat door, one that calls a holder
 *       method, one that calls a writer function, each reads RED; a command source that reads rows through acts
 *       reads clean;
 *   K3  a row whose `writer` column names no node module stands UNWRITTEN: no source of any package writes a
 *       file beside its name.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { parseAst } from "vitest/node";
import { carrierTable } from "@lararium/node";

const PACKAGES = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const NODE_SRC = join(PACKAGES, "lararium-node", "src");
const MESH_SRC = join(PACKAGES, "lararium-mesh", "src");
const CLI_SRC  = join(PACKAGES, "lares-cli", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.ts$/.test(name) && !/\.d\.ts$/.test(name) ? [path] : [];
  }).sort();
}

/** One node of a parsed source: the reader walks it as a tree, so a name in a comment never reads as a call. */
interface AstNode { readonly type: string; readonly [field: string]: unknown }
const isNode = (v: unknown): v is AstNode => typeof v === "object" && v !== null && typeof (v as { type?: unknown }).type === "string";

/** Parse one TypeScript source as a tree: its types strip away (they call nothing), and what stays parses as a module. */
function parse(text: string): AstNode {
  return parseAst(stripTypeScriptTypes(text, { mode: "transform" })) as unknown as AstNode;
}
const parseFile = (path: string): AstNode => parse(readFileSync(path, "utf8"));

function walk(node: AstNode, visit: (n: AstNode) => void): void {
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) { for (const v of value) if (isNode(v)) walk(v, visit); }
    else if (isNode(value)) walk(value, visit);
  }
}

/** Every name a node calls: `f(…)` reads as `f`, `a.b.f(…)` reads as `f`. */
function calledNames(node: AstNode): Set<string> {
  const out = new Set<string>();
  walk(node, (n) => {
    if (n.type !== "CallExpression" && n.type !== "NewExpression") return;
    let callee = n["callee"];
    while (isNode(callee) && (callee.type === "ChainExpression" || callee.type === "ParenthesizedExpression")) callee = callee["expression"];
    if (!isNode(callee)) return;
    if (callee.type === "Identifier") out.add(String(callee["name"]));
    else if (callee.type === "MemberExpression" && isNode(callee["property"])) {
      const property = callee["property"];
      if (property.type === "Identifier" && callee["computed"] !== true) out.add(String(property["name"]));
      else if (property.type === "Literal" && typeof property["value"] === "string") out.add(property["value"]);   // `fs["writeFileSync"](…)`
    }
  });
  return out;
}

/** Every identifier a source names anywhere (an import, a call, a reference). */
function namedIdentifiers(node: AstNode): Set<string> {
  const out = new Set<string>();
  walk(node, (n) => { if (n.type === "Identifier") out.add(String(n["name"])); });
  return out;
}

/** Every string a source spells in code: its string literals and its template text. */
function spelledStrings(node: AstNode): string[] {
  const out: string[] = [];
  walk(node, (n) => {
    if (n.type === "Literal" && typeof n["value"] === "string") out.push(n["value"]);
    if (n.type === "TemplateElement" && isNode(n["value"] as unknown) === false) out.push(String((n["value"] as { cooked?: unknown; raw?: unknown }).cooked ?? (n["value"] as { raw?: unknown }).raw ?? ""));
  });
  return out;
}

/** A module's top-level functions (declarations, and `const f = …`): each one's exported flag and the names it calls. */
function moduleFunctions(program: AstNode): Map<string, { readonly exported: boolean; readonly calls: Set<string> }> {
  const out = new Map<string, { exported: boolean; calls: Set<string> }>();
  const take = (decl: AstNode, exported: boolean): void => {
    if (decl.type === "FunctionDeclaration" && isNode(decl["id"])) out.set(String(decl["id"]["name"]), { exported, calls: calledNames(decl) });
    if (decl.type === "VariableDeclaration") {
      for (const d of decl["declarations"] as AstNode[]) {
        if (isNode(d["id"]) && d["id"].type === "Identifier" && isNode(d["init"])) out.set(String(d["id"]["name"]), { exported, calls: calledNames(d["init"]) });
      }
    }
  };
  for (const stmt of program["body"] as AstNode[]) {
    if (stmt.type === "ExportNamedDeclaration" && isNode(stmt["declaration"])) take(stmt["declaration"], true);
    else take(stmt, false);
  }
  return out;
}

/** The exported functions of a module that reach one of `doors`, through any chain of the module's own functions. */
function exportedReaching(program: AstNode, doors: ReadonlySet<string>): string[] {
  const fns = moduleFunctions(program);
  const reaching = new Set<string>();
  for (let grew = true; grew;) {
    grew = false;
    for (const [name, fn] of fns) {
      if (reaching.has(name)) continue;
      if ([...fn.calls].some((c) => doors.has(c) || reaching.has(c))) { reaching.add(name); grew = true; }
    }
  }
  return [...reaching].filter((name) => fns.get(name)!.exported).sort();
}

/** The method names an exported interface declares, read off its own block in the TypeScript source. */
function interfaceMethods(path: string, name: string): string[] {
  const text = readFileSync(path, "utf8");
  const start = text.indexOf(`export interface ${name} {`);
  if (start < 0) throw new Error(`no interface ${name} in ${path}`);
  let depth = 0, end = start;
  for (let i = text.indexOf("{", start); i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) { end = i; break; }
  }
  // A method opens a member line: two spaces, its name, an optional type parameter list, then `(`.
  return [...text.slice(start, end).matchAll(/^ {2}([A-Za-z_]\w*)(?:<[^>\n]*>)?\(/gm)].map((m) => m[1]!);
}

// ── derived from the custody modules ──────────────────────────────────────────────────────────────

/** The `CustodyHolder` methods that change a row at rest. */
const HOLDER_WRITES = interfaceMethods(join(NODE_SRC, "custody-holder.ts"), "CustodyHolder").filter((m) => /^(write|update|remove)/.test(m));
/** The custody seat's exported functions that call one. */
const SEAT_DOORS = exportedReaching(parseFile(join(NODE_SRC, "custody-seat.ts")), new Set(HOLDER_WRITES));
/** The `CustodyIo` methods that change a file, and the sealed writer's exported functions that reach one. */
const IO_WRITES = interfaceMethods(join(MESH_SRC, "sealed-writer.ts"), "CustodyIo").filter((m) => /^(write|rename|remove)$/.test(m));
const SEALED_WRITER_DOORS = exportedReaching(parseFile(join(MESH_SRC, "sealed-writer.ts")), new Set(IO_WRITES));
const WRITE_DOORS: ReadonlySet<string> = new Set([...HOLDER_WRITES, ...SEAT_DOORS, ...SEALED_WRITER_DOORS]);

// ── derived from the carrier table ────────────────────────────────────────────────────────────────

// The holder's own label row (face-owner) is written by the holder alone and is no row a command could name.
const SEALED_ROWS = carrierTable().filter((r) => (r.custody === "hot" || r.custody === "cold" || r.custody === "face-hot" || r.custody === "face-cold") && !r.writer.startsWith("custody-holder"));

/** The literal runs a matcher's source spells, with every regex construct read as a break. */
function literalsOf(source: string): string[] {
  const out: string[] = [];
  let run = "";
  const flush = (): void => { if (run) out.push(run); run = ""; };
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (c === "\\" && i + 1 < source.length && /[.\/\-_]/.test(source[i + 1]!)) { run += source[i + 1]; i++; continue; }
    if (/[A-Za-z0-9_\-]/.test(c)) { run += c; continue; }
    flush();
    if (c === "(" || c === "[") {                                                   // a group or a class spells no literal
      const close = c === "(" ? ")" : "]";
      for (let depth = 1; depth > 0 && ++i < source.length;) {
        if (source[i] === "\\") i++;
        else if (source[i] === c) depth++;
        else if (source[i] === close) depth--;
      }
    } else if (c === "{") { while (i < source.length && source[i] !== "}") i++; }
    else if (c === "\\") i++;                                                       // an escape class (`\d`) spells no literal
  }
  flush();
  return out;
}

/** How a source names one row: its subtree as a whole path segment, or the literal its file name's matcher spells. */
type RowName = { readonly segment: string } | { readonly literal: string };
function rowName(row: (typeof SEALED_ROWS)[number]): RowName | null {
  // A face row rests at faces/<fcid>/<file>: the file's own matcher names it, never the shared `faces` directory.
  if (row.under !== "" && row.faceRow === undefined) return { segment: row.under };
  // The longest literal the matcher spells names the file; a short run (`h`, `json`) names nothing by itself.
  const longest = literalsOf(row.faceRow ? row.faceRow.inner.source.replace(/^\^\(\?:/, "").replace(/\)\$$/, "") : row.match.source).sort((a, b) => b.length - a.length)[0] ?? "";
  return longest.replace(/[.\-_]/g, "").length >= (row.faceRow ? 4 : 6) ? { literal: longest } : null;
}
/** Whether one spelled string names the row: the subtree as a path segment of it, or the file's literal inside it. */
function names(name: RowName, spelled: string): boolean {
  return "segment" in name ? spelled.split(/[\\/]/).includes(name.segment) : spelled.includes(name.literal);
}
const spell = (name: RowName): string => ("segment" in name ? name.segment : name.literal);

/** The node module a row's `writer` column names: its first word, when a module of that name stands. */
function writerModule(row: (typeof SEALED_ROWS)[number]): string | null {
  const word = /^[a-z0-9-]+/.exec(row.writer)?.[0] ?? "";
  const path = join(NODE_SRC, `${word}.ts`);
  try { return statSync(path).isFile() ? path : null; } catch { return null; }
}

const WRITER_MODULES = [...new Set(SEALED_ROWS.map(writerModule).filter((p): p is string => p !== null))].sort();
const WRITER_FUNCTIONS = new Map(WRITER_MODULES.map((path) => [path, exportedReaching(parseFile(path), WRITE_DOORS)] as const));
const EVERY_WRITER_FUNCTION: ReadonlySet<string> = new Set([...WRITER_FUNCTIONS.values()].flat());

// ── the law over one source ───────────────────────────────────────────────────────────────────────

const FS_WRITES: ReadonlySet<string> = new Set([
  "writeFileSync", "appendFileSync", "rmSync", "rmdirSync", "renameSync", "unlinkSync", "copyFileSync", "truncateSync", "createWriteStream",
  "writeFile", "appendFile", "rm", "rename", "unlink", "copyFile", "truncate", "atomicWriteFileSync",
]);

/** The rows a source names in code beside a file-system write of its own. */
function rowsWrittenBeside(program: AstNode, rows: readonly (typeof SEALED_ROWS)[number][]): string[] {
  if (![...FS_WRITES].some((w) => calledNames(program).has(w))) return [];
  const spelled = spelledStrings(program);
  return rows.filter((row) => { const name = rowName(row); return name !== null && spelled.some((str) => names(name, str)); }).map((row) => row.row);
}

/** Why one command source breaks the law; empty when it holds. */
function violations(text: string): string[] {
  const program = parse(text);
  const calls = calledNames(program);
  const named = namedIdentifiers(program);
  const out: string[] = [];
  for (const door of WRITE_DOORS) if (calls.has(door)) out.push(`C1 calls the write door ${door}`);
  for (const fn of EVERY_WRITER_FUNCTION) if (named.has(fn)) out.push(`C2 names the writer function ${fn}`);
  for (const row of rowsWrittenBeside(program, SEALED_ROWS)) out.push(`C3 names the row ${row} beside a file-system write`);
  return out;
}

describe("the custody write census", () => {
  test("K1 — the instrument sees: every sealed row yields a name, every writer module a writer function, and the doors hold the seat's own", () => {
    expect(SEALED_ROWS.length).toBeGreaterThan(20);
    expect(SEALED_ROWS.filter((r) => rowName(r) === null).map((r) => r.row)).toEqual([]);
    expect(HOLDER_WRITES.length).toBeGreaterThanOrEqual(3);
    expect(SEAT_DOORS.length).toBeGreaterThanOrEqual(HOLDER_WRITES.length);
    for (const door of SEAT_DOORS) expect(door).toMatch(/CustodyRow$/);
    expect(SEALED_WRITER_DOORS.length).toBeGreaterThanOrEqual(3);
    expect(WRITER_MODULES.length).toBeGreaterThan(8);
    expect([...WRITER_FUNCTIONS].filter(([, fns]) => fns.length === 0).map(([path]) => relative(NODE_SRC, path))).toEqual([]);
    // The seat's own module never reads as a row's writer: a writer module seals through it.
    expect(WRITER_MODULES.map((p) => relative(NODE_SRC, p))).not.toContain("custody-seat.ts");
  });

  test("K2 — PLANTED: a command source that writes a custody row reads red, by each road; one that asks through acts reads clean", () => {
    const flat = SEALED_ROWS.find((r) => r.row === "keyhive-archive")!;
    const seatDoor = SEAT_DOORS[0]!;
    const writerFn = [...EVERY_WRITER_FUNCTION][0]!;
    const planted: Array<[string, string, RegExp]> = [
      ["a command that writes a flat row's file",
        `import { writeFileSync } from "node:fs";\nimport { join } from "node:path";\nexport function f(home: string): void { writeFileSync(join(home, "${spell(rowName(flat)!)}"), "[]"); }\n`,
        /^C3 names the row keyhive-archive/],
      ["a command that calls a seat door",
        `import { ${seatDoor} } from "@lararium/node";\nexport async function f(): Promise<void> { await (${seatDoor} as (...a: unknown[]) => Promise<unknown>)("identity", "x", new Uint8Array()); }\n`,
        new RegExp(`^C1 calls the write door ${seatDoor}$`)],
      ["a command that reaches a file-system write by a computed name",
        `import * as fs from "node:fs";\nimport { join } from "node:path";\nexport function f(home: string): void { fs["writeFileSync"](join(home, "${spell(rowName(flat)!)}"), "[]"); }\n`,
        /^C3 names the row keyhive-archive/],
      ["a command that calls a holder method",
        `export async function f(holder: { ${HOLDER_WRITES[0]}: (...a: unknown[]) => Promise<void> }): Promise<void> { await holder.${HOLDER_WRITES[0]}("identity", "x", new Uint8Array()); }\n`,
        new RegExp(`^C1 calls the write door ${HOLDER_WRITES[0]}$`)],
      ["a command that calls a writer function",
        `import { ${writerFn} } from "@lararium/node";\nexport const f = (): unknown => (${writerFn} as (...a: unknown[]) => unknown)();\n`,
        new RegExp(`^C2 names the writer function ${writerFn}$`)],
    ];
    for (const [what, source, reads] of planted) {
      const found = violations(source);
      expect(found.length, what).toBeGreaterThan(0);
      expect(found.some((v) => reads.test(v)), `${what}: ${found.join(" · ")}`).toBe(true);
    }
    // CONTROL: a command that names a row in a comment, writes a file of its own and asks an act reads clean.
    const clean = `// the crossing rests in ${spell(rowName(flat)!)}, behind the custody door\nimport { writeFileSync } from "node:fs";\nimport { sealedAct } from "../sealed-act-door.js";\nexport async function f(out: string): Promise<void> { writeFileSync(out, JSON.stringify(await sealedAct("crossing.state"))); }\n`;
    expect(violations(clean)).toEqual([]);
  });

  test("C1-C3 — no file under packages/lares-cli/src writes a custody row", () => {
    const files = sourceFiles(CLI_SRC);
    expect(files.length).toBeGreaterThan(50);                                       // the walk found the command sources
    const found = files.flatMap((path) => violations(readFileSync(path, "utf8")).map((v) => `${relative(CLI_SRC, path)}: ${v}`));
    expect(found).toEqual([]);
  });

  test("K3 — a row whose writer column names no node module stands unwritten by every package's source", () => {
    const unwritten = SEALED_ROWS.filter((r) => writerModule(r) === null);
    const sources = readdirSync(PACKAGES).map((pkg) => join(PACKAGES, pkg, "src")).filter((dir) => { try { return statSync(dir).isDirectory(); } catch { return false; } }).flatMap(sourceFiles);
    expect(sources.length).toBeGreaterThan(300);
    const found: string[] = [];
    for (const path of sources) {
      const text = readFileSync(path, "utf8");
      // A cheap pass first: only a source that spells some unwritten row's name gets parsed.
      if (!unwritten.some((r) => { const name = rowName(r); return name !== null && text.includes(spell(name)); })) continue;
      for (const row of rowsWrittenBeside(parse(text), unwritten)) found.push(`${relative(PACKAGES, path)}: names the row ${row} beside a file-system write, and the table names no module that writes it`);
    }
    expect(found).toEqual([]);
  });
});
