/**
 * codemap can fail — the four reds the generator owes, and the controls that keep a green honest.
 *
 * Each case plants a scratch git repository (fixed author, fixed dates), runs the generator over it
 * through its module door, and reads the tiddler folder it writes. The tiddlers sit under a scratch
 * out dir; nothing lands in the tracked tree.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { after, test } from "node:test";
import { buildCodemap, writeCodemap } from "./codemap.mjs";

const scratch = [];
after(() => {
  for (const d of scratch) rmSync(d, { recursive: true, force: true });
});

function scratchDir(tag) {
  const d = mkdtempSync(join(tmpdir(), `codemap-${tag}-`));
  scratch.push(d);
  return d;
}

function git(repo, ...args) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t",
      GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z", GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
    },
  });
}

/** Plant a repo from a `{ path: text }` map and commit it. */
function plant(files) {
  const repo = scratchDir("repo");
  git(repo, "init", "-q");
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, p)), { recursive: true });
    writeFileSync(join(repo, p), text);
  }
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "plant");
  return repo;
}

function readFolder(dir) {
  const out = new Map();
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.set(relative(dir, p), readFileSync(p));
    }
  };
  walk(dir);
  return out;
}

function tiddler(folder, relPath) {
  const raw = folder.get(relPath);
  assert.ok(raw, `tiddler ${relPath} stands in the folder (has: ${[...folder.keys()].join(", ")})`);
  const text = raw.toString("utf8");
  const split = text.indexOf("\n\n");
  const fields = {};
  for (const line of text.slice(0, split).split("\n")) {
    const i = line.indexOf(": ");
    fields[line.slice(0, i)] = line.slice(i + 2);
  }
  return { fields, body: text.slice(split + 2) };
}

const FIXTURE_TS = [
  "// ॐ ँ 🜂 héllo — non-ASCII ahead of the declarations",
  "/** The fixture's leading doc. Second sentence stays out. */",
  "import { helperValue } from \"./helper.js\";",
  "export function alpha(n: number): number {",
  "  const SECRET_BODY_LINE_ALPHA = n + helperValue;",
  "  return SECRET_BODY_LINE_ALPHA * 2;",
  "}",
  "",
  "const hidden = 1;",
  "export class Beta {",
  "  run(): string {",
  "    return \"SECRET_BODY_LINE_BETA\";",
  "  }",
  "}",
  "export const gamma = 3, delta = 4;",
  "",
].join("\n");

const FIXTURE_PY = [
  "\"\"\"Fixture module doc. More follows.\"\"\"",
  "import os",
  "",
  "def first(x):",
  "    secret_body_line_py = x + 1",
  "    return secret_body_line_py",
  "",
  "class Second:",
  "    pass",
  "",
].join("\n");

const BASE = {
  "packages/pk/package.json": JSON.stringify({ name: "@fx/pk", type: "module" }),
  "packages/pk/src/fixture.ts": FIXTURE_TS,
  "packages/pk/src/helper.ts": "export const helperValue = 7;\n",
  "packages/pk/src/tool.py": FIXTURE_PY,
  "bags/b/ha.ka.ba/b/doc.mem": "```toml meta\ntitle = \"lar:///ha.ka.ba/b/doc\"\n```\n\nIt cites `packages/pk/src/helper.ts` and `fixture.ts`.\n",
};

async function runOnce(files = BASE) {
  const repo = plant(files);
  const model = await buildCodemap({ repo });
  const out = scratchDir("out");
  writeCodemap(model, out);
  return { repo, model, out, folder: readFolder(out) };
}

test("codemap-outline-lines: a fixture file's declarations answer their exact line ranges", async () => {
  const { folder } = await runOnce();
  const t = tiddler(folder, "pk/src~fixture.ts.tid");
  assert.equal(t.fields["repo-path"], "packages/pk/src/fixture.ts");
  assert.equal(t.fields.lang, "ts");
  assert.equal(t.fields.lines, "15");
  assert.match(t.body, /\| 4-7 \| export function \| alpha \|/);
  assert.match(t.body, /\| 9-9 \| const \| hidden \|/);
  assert.match(t.body, /\| 10-14 \| export class \| Beta \|/);
  assert.match(t.body, /\| 15-15 \| export const \| gamma \|/);
  assert.match(t.body, /\| 15-15 \| export const \| delta \|/);
  assert.equal(t.fields.exports, "Beta alpha delta gamma");
  assert.equal(t.fields.imports, "packages/pk/src/helper.ts");
  assert.match(t.body, /^The fixture's leading doc\./);
  const py = tiddler(folder, "pk/src~tool.py.tid");
  assert.equal(py.fields.lang, "py");
  assert.match(py.body, /\| 4-6 \| def \| first \|/);
  assert.match(py.body, /\| 8-9 \| class \| Second \|/);
  const helper = tiddler(folder, "pk/src~helper.ts.tid");
  assert.equal(helper.fields["imported-by"], "packages/pk/src/fixture.ts");
});

test("codemap-pure-of-head: two runs at one head write byte-identical folders, and the working tree stays out", async () => {
  const a = await runOnce();
  const b = scratchDir("out");
  writeCodemap(await buildCodemap({ repo: a.repo }), b);
  const second = readFolder(b);
  assert.deepEqual([...second.keys()], [...a.folder.keys()]);
  for (const [k, v] of a.folder) assert.ok(v.equals(second.get(k)), `${k} reads byte-identical`);
  // An uncommitted edit and an untracked file move nothing: the head alone speaks.
  writeFileSync(join(a.repo, "packages/pk/src/fixture.ts"), "export const dirty = 1;\n");
  writeFileSync(join(a.repo, "packages/pk/src/untracked.ts"), "export const u = 1;\n");
  const c = scratchDir("out");
  writeCodemap(await buildCodemap({ repo: a.repo }), c);
  const third = readFolder(c);
  assert.deepEqual([...third.keys()], [...a.folder.keys()]);
  for (const [k, v] of a.folder) assert.ok(v.equals(third.get(k)), `${k} reads byte-identical after a dirty tree`);
  assert.ok(!JSON.stringify([...third.keys()]).includes("untracked"));
});

test("codemap-cite-ambiguous: a basename two files carry lands on the root, in no file's cited-by", async () => {
  const { folder } = await runOnce({
    ...BASE,
    "packages/pk/src/a/index.ts": "export const a = 1;\n",
    "packages/pk/src/b/index.ts": "export const b = 1;\n",
    "bags/b/ha.ka.ba/b/two.mem": "```toml meta\ntitle = \"lar:///ha.ka.ba/b/two\"\n```\n\nSee `index.ts` and `packages/pk/src/a/index.ts`.\n",
  });
  const root = tiddler(folder, "codemap.tid");
  assert.match(root.fields["cite-ambiguous"], /index\.ts/);
  const a = tiddler(folder, "pk/src~a~index.ts.tid");
  const b = tiddler(folder, "pk/src~b~index.ts.tid");
  // The full-path citation lands on a alone; the bare basename lands on neither.
  assert.equal(a.fields["cited-by"], "lar:///ha.ka.ba/b/two");
  assert.equal(b.fields["cited-by"], undefined);
  // Controls: a repo-path citation lands, and a unique basename lands.
  const helper = tiddler(folder, "pk/src~helper.ts.tid");
  assert.equal(helper.fields["cited-by"], "lar:///ha.ka.ba/b/doc");
  const fixture = tiddler(folder, "pk/src~fixture.ts.tid");
  assert.equal(fixture.fields["cited-by"], "lar:///ha.ka.ba/b/doc");
});

test("codemap-no-body: no tiddler text carries a line of a fixture's function body", async () => {
  const { folder } = await runOnce();
  const all = [...folder.values()].map((b) => b.toString("utf8")).join("\n");
  for (const needle of ["SECRET_BODY_LINE_ALPHA", "SECRET_BODY_LINE_BETA", "secret_body_line_py", "helperValue * 2"]) {
    assert.ok(!all.includes(needle), `${needle} stays out of every tiddler`);
  }
  assert.ok(all.includes("alpha"), "the declaration names ride");
});
