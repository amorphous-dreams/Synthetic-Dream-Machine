#!/usr/bin/env node
/**
 * codemap ~ one tool, never a model, writes a tiddler per source file from the landed head.
 *
 * Each tiddler names the file's exports, its top-level declarations with line ranges, its imports and
 * importers, the memes that cite it and the tests that cover it; no code body ever rides. The output
 * derives from the git head alone: it reads the tracked blobs at `HEAD` (never the working tree), the
 * clock and the model stay out, and every list sorts, so two runs at one head write identical bytes.
 *
 *   node tools/codemap.mjs [--repo <dir>] [--out <dir>]
 *
 * `--out` defaults to `<LAR_ROOT>/cache/codemap/<head>/` where `LAR_ROOT` names a house, else a folder
 * under the system temp dir. Inside the repository, `--out` must sit under a dot-directory
 * (`<worktree>/.codemap`); the tracked tree takes no write.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { findCites, memeTitle } from "./codemap/cites.mjs";
import { outlinePython, outlineScripts } from "./codemap/outline.mjs";
import { makeResolver } from "./codemap/resolve.mjs";

export const CODEMAP_ROOT = "lar:///ha.ka.ba/codemap";
const SOURCE_RE = /\.(?:d\.ts|tsx|ts|mjs|cjs|js|py)$/;
const MEME_RE = /^bags\/.*\.(?:mem|md)$/;
const SKIP_SEGMENT = new Set(["node_modules", "dist", "bags", "wikis"]);
const TEST_RE = /(?:^|\/)(?:tests?|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)test_[^/]*\.py$|_test\.py$|(?:^|\/)conftest\.py$/;
const GIANT = 1500;
const LARGE = 800;

const byCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function git(repo, args, input) {
  return execFileSync("git", ["-C", repo, ...args], { input, maxBuffer: 1 << 30 });
}

/** Read every blob in one `cat-file --batch` pass; returns Map<oid, Buffer>. */
function readBlobs(repo, oids) {
  const unique = [...new Set(oids)];
  const raw = git(repo, ["cat-file", "--batch"], `${unique.join("\n")}\n`);
  const blobs = new Map();
  let at = 0;
  while (at < raw.length) {
    const nl = raw.indexOf(10, at);
    const [oid, type, size] = raw.toString("utf8", at, nl).split(" ");
    if (type !== "blob") throw new Error(`codemap: ${oid} reads ${type}, not a blob`);
    const n = Number(size);
    blobs.set(oid, raw.subarray(nl + 1, nl + 1 + n));
    at = nl + 1 + n + 1;
  }
  return blobs;
}

function lineCount(text) {
  if (!text) return 0;
  const n = text.split("\n").length;
  return text.endsWith("\n") ? n - 1 : n;
}

const langOf = (p) => (p.endsWith(".py") ? "py" : /\.tsx?$/.test(p) ? "ts" : "mjs");
const sizeClassOf = (lines) => (lines > GIANT ? "giant" : lines > LARGE ? "large" : "small");

function packageOf(p) {
  const parts = p.split("/");
  if (parts[0] === "packages" && parts.length > 2) return { pkg: parts[1], rest: parts.slice(2).join("/") };
  if (parts.length > 1) return { pkg: parts[0], rest: parts.slice(1).join("/") };
  return { pkg: "_root", rest: p };
}

const encodeSegment = (s) => s.replace(/[^A-Za-z0-9._~@+=,-]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
const oneLine = (s) => String(s).replace(/[\r\n]+/g, " ");

/** A TiddlyWiki list value. */
function twList(items) {
  return items.map((i) => (/[\s[\]]/.test(i) ? `[[${i}]]` : i)).join(" ");
}

function tidFile(fields, text) {
  const head = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${oneLine(v)}`)
    .join("\n");
  return `${head}\n\n${text}\n`;
}

const cell = (s) => String(s).replace(/\|/g, "&#124;");

function bodyOf(outline) {
  const rows = outline.decls.map((d) => `| ${d.start}-${d.end} | ${cell(d.kind)} | ${cell(d.name)} |`);
  const table = rows.length ? `|! lines |! kind |! name |\n${rows.join("\n")}` : "//no top-level declarations//";
  return outline.doc ? `${outline.doc}\n\n${table}` : table;
}

/**
 * Build the map at one head. Returns `{ head, files, index }`: `files` maps a path relative to the out
 * dir to its text.
 */
export async function buildCodemap({ repo, head: headArg } = {}) {
  const root = resolve(repo ?? ".");
  const full = headArg ?? git(root, ["rev-parse", "HEAD"]).toString().trim();
  const head = full.slice(0, 9);
  const entries = git(root, ["ls-tree", "-r", "-z", full]).toString("utf8").split("\0").filter(Boolean).map((l) => {
    const tab = l.indexOf("\t");
    const [mode, type, oid] = l.slice(0, tab).split(" ");
    return { mode, type, oid, path: l.slice(tab + 1) };
  }).filter((e) => e.type === "blob");

  const skipped = (p) => p.split("/").some((s) => SKIP_SEGMENT.has(s));
  const sources = entries.filter((e) => SOURCE_RE.test(e.path) && !skipped(e.path)).sort((a, b) => byCode(a.path, b.path));
  const memes = entries.filter((e) => MEME_RE.test(e.path)).sort((a, b) => byCode(a.path, b.path));
  const pkgJsons = entries.filter((e) => e.path.endsWith("package.json") && !e.path.split("/").includes("node_modules"));
  const blobs = readBlobs(root, [...sources, ...memes, ...pkgJsons].map((e) => e.oid));

  const texts = new Map(sources.map((e) => [e.path, blobs.get(e.oid).toString("utf8")]));
  const outlines = new Map();
  for (const [p, o] of outlineScripts(sources.filter((e) => langOf(e.path) !== "py").map((e) => ({ path: e.path, text: texts.get(e.path) })))) outlines.set(p, o);
  for (const [p, o] of outlinePython(sources.filter((e) => langOf(e.path) === "py").map((e) => ({ path: e.path, text: texts.get(e.path) })))) outlines.set(p, o);

  const packages = new Map();
  for (const e of pkgJsons) {
    try {
      const j = JSON.parse(blobs.get(e.oid).toString("utf8"));
      packages.set(dirname(e.path) === "." ? "" : dirname(e.path), { name: j.name, exports: j.exports, main: j.main });
    } catch {
      // a package.json that fails to parse names no workspace package
    }
  }
  const fileSet = new Set(sources.map((e) => e.path));
  const resolver = makeResolver(fileSet, packages);

  // Imports resolve to repo paths; what resolves to none rides as its specifier.
  const importPaths = new Map();
  const importExternal = new Map();
  const reexportPaths = new Map();
  for (const e of sources) {
    const o = outlines.get(e.path);
    const paths = new Set();
    const external = new Set();
    if (langOf(e.path) === "py") {
      for (const imp of o.imports) {
        const r = resolver.resolvePython(e.path, imp);
        for (const p of r.paths) if (p !== e.path) paths.add(p);
        if (r.external) external.add(r.external);
      }
    } else {
      for (const spec of o.imports) {
        const r = resolver.resolveScript(e.path, spec);
        if (r.path) {
          if (r.path !== e.path) paths.add(r.path);
        } else external.add(r.external);
      }
    }
    importPaths.set(e.path, [...paths].sort(byCode));
    importExternal.set(e.path, [...external].sort(byCode));
    const re = new Set();
    for (const spec of o.reexports) {
      const r = resolver.resolveScript(e.path, spec);
      if (r.path && r.path !== e.path) re.add(r.path);
    }
    reexportPaths.set(e.path, [...re].sort(byCode));
  }

  const importedBy = new Map();
  for (const [p, targets] of importPaths) {
    for (const t of targets) {
      if (!importedBy.has(t)) importedBy.set(t, []);
      importedBy.get(t).push(p);
    }
  }

  // A test covers an import's target direct, and what a barrel re-exports, transitively, via the barrel.
  const isTest = (p) => TEST_RE.test(p);
  const coveredBy = new Map();
  const cover = (target, test, via) => {
    if (isTest(target)) return;
    if (!coveredBy.has(target)) coveredBy.set(target, new Map());
    const m = coveredBy.get(target);
    if (m.get(test) !== "direct") m.set(test, via);
  };
  for (const e of sources) {
    if (!isTest(e.path)) continue;
    for (const t of importPaths.get(e.path)) {
      cover(t, e.path, "direct");
      const seen = new Set([t]);
      const queue = [...reexportPaths.get(t)];
      while (queue.length) {
        const n = queue.shift();
        if (seen.has(n)) continue;
        seen.add(n);
        cover(n, e.path, "barrel");
        queue.push(...reexportPaths.get(n));
      }
    }
  }

  const { citedBy, ambiguous } = findCites(
    memes.map((e) => {
      const text = blobs.get(e.oid).toString("utf8");
      return { title: memeTitle(text), text };
    }),
    sources.map((e) => e.path),
  );

  const files = new Map();
  const titles = {};
  const pkgStats = new Map();
  let totalLines = 0;
  let testCount = 0;
  for (const e of sources) {
    const o = outlines.get(e.path);
    const text = texts.get(e.path);
    const test = isTest(e.path);
    const { pkg, rest } = packageOf(e.path);
    const key = rest.replace(/\//g, "~");
    const lang = langOf(e.path);
    const lines = lineCount(text);
    const sc = sizeClassOf(lines);
    const title = `${CODEMAP_ROOT}/${test ? "test/" : ""}${pkg}/${key}`;
    const cov = coveredBy.get(e.path);
    const covVia = cov ? ([...cov.values()].includes("direct") ? "direct" : "barrel") : "";
    const fields = {
      title,
      "repo-path": e.path,
      package: pkg,
      lang,
      lines,
      bytes: blobs.get(e.oid).length,
      blob: e.oid,
      head,
      exports: twList([...new Set(o.exports)].sort(byCode)),
      imports: twList([...importPaths.get(e.path), ...importExternal.get(e.path)]),
      "imported-by": twList((importedBy.get(e.path) ?? []).sort(byCode)),
      "cited-by": twList([...(citedBy.get(e.path) ?? [])].sort(byCode)),
      "covered-by": test ? "" : twList([...(cov?.keys() ?? [])].sort(byCode)),
      "covered-via": test ? "" : covVia,
      "size-class": sc,
      tags: twList([test ? "codemap/test" : "codemap/file", `codemap/pkg/${pkg}`, `codemap/lang/${lang}`, `codemap/${sc}`]),
      type: "text/vnd.tiddlywiki",
    };
    const rel = `${test ? "test/" : ""}${encodeSegment(pkg)}/${encodeSegment(key)}.tid`;
    files.set(rel, tidFile(fields, bodyOf(o)));
    titles[e.path] = title;
    const st = pkgStats.get(pkg) ?? { files: 0, tests: 0, lines: 0, giants: [] };
    if (test) st.tests++;
    else st.files++;
    st.lines += lines;
    if (sc === "giant") st.giants.push({ path: e.path, lines });
    pkgStats.set(pkg, st);
    totalLines += lines;
    if (test) testCount++;
  }

  for (const [pkg, st] of [...pkgStats].sort((a, b) => byCode(a[0], b[0]))) {
    const giants = st.giants.sort((a, b) => b.lines - a.lines || byCode(a.path, b.path));
    const text = [
      `${st.files} source files and ${st.tests} test files, ${st.lines} lines.`,
      giants.length ? `\n|! lines |! giant |\n${giants.map((g) => `| ${g.lines} | ${cell(g.path)} |`).join("\n")}` : "",
    ].join("");
    files.set(`${encodeSegment(pkg)}.tid`, tidFile({
      title: `${CODEMAP_ROOT}/${pkg}`, package: pkg, files: st.files, "test-files": st.tests, lines: st.lines, head,
      tags: twList(["codemap/package", `codemap/pkg/${pkg}`]), type: "text/vnd.tiddlywiki",
    }, text));
  }

  const ambiguousNames = [...ambiguous.keys()].sort(byCode);
  files.set("codemap.tid", tidFile({
    title: CODEMAP_ROOT,
    head,
    files: sources.length - testCount,
    "test-files": testCount,
    lines: totalLines,
    packages: twList([...pkgStats.keys()].sort(byCode)),
    "cite-ambiguous": twList(ambiguousNames),
    tags: "codemap/root",
    type: "text/vnd.tiddlywiki",
  }, [
    `The code map at head ${head}: ${sources.length - testCount} source files and ${testCount} test files across ${pkgStats.size} packages.`,
    ambiguousNames.length ? `\n|! ambiguous name |! carried by |\n${ambiguousNames.map((n) => `| ${cell(n)} | ${[...ambiguous.get(n)].sort(byCode).map(cell).join(" ")} |`).join("\n")}` : "",
  ].join("")));

  const index = { head, files: titles, written: [...files.keys()].sort(byCode) };
  return { head, files, index };
}

/** Write a built map under `out`, replacing a previous map's files there. */
export function writeCodemap(model, out) {
  const dir = resolve(out);
  const indexPath = join(dir, "codemap.json");
  if (existsSync(dir)) {
    if (existsSync(indexPath)) {
      const prior = JSON.parse(readFileSync(indexPath, "utf8"));
      for (const rel of prior.written ?? []) rmSync(join(dir, rel), { force: true });
      rmSync(indexPath, { force: true });
    } else if (readdirSync(dir).length) {
      throw new Error(`codemap: ${dir} holds files and no codemap.json; name an empty or earlier-map folder`);
    }
  }
  for (const [rel, text] of model.files) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
  }
  writeFileSync(indexPath, `${JSON.stringify(model.index, null, 2)}\n`);
}

/** Refuse an out dir that sits inside the repository's tracked tree. */
export function assertOutOutsideTracked(repo, out) {
  const rel = relative(resolve(repo), resolve(out));
  if (rel === "" || (!rel.startsWith("..") && !rel.split(sep)[0].startsWith("."))) {
    throw new Error(`codemap: --out ${out} sits inside the repository; use a path outside it or under a dot-directory such as .codemap`);
  }
}

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i < 0 ? undefined : argv[i + 1];
}

async function main(argv) {
  const repo = resolve(arg(argv, "--repo") ?? git(process.cwd(), ["rev-parse", "--show-toplevel"]).toString().trim());
  const model = await buildCodemap({ repo });
  const out = resolve(arg(argv, "--out") ?? join(process.env.LAR_ROOT ? join(process.env.LAR_ROOT, "cache") : join(tmpdir(), "codemap-out"), "codemap", model.head));
  assertOutOutsideTracked(repo, out);
  writeCodemap(model, out);
  process.stdout.write(`codemap ${model.head}: ${model.files.size} tiddlers -> ${out}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });
}
