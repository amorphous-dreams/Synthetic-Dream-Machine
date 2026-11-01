/**
 * meme-coordinates-witness.test.mjs — proves the retired-field probe over fixture trees the corpus never
 * touches, in the witness's own control style: a known positive before the clean reading is trusted.
 *
 * `file-path` retired (Train Q). `meme-normalize` drops the line in any spelling; the witness must SEE it
 * in any spelling too, or a carrier holding a single-quoted value passes the walk unread (the train
 * security read's LOW-2).
 *
 * Proven:
 *   · KNOWN POSITIVE: the double-quoted spelling reads drift;
 *   · RED, one fixture per spelling: single-quoted, unquoted, no spacing, wide spacing, a quoted key, each reads drift;
 *   · CONTROL: a carrier declaring no `file-path` (its `uri-path` agreeing with its head) reads clean.
 */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SCRIPT = join(ROOT, "tools", "meme-coordinates-witness.sh");

const carrier = (metaLine) =>
  "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>\n\n" +
  "<<^ code=`&#x0001;` from=`?` to=`lar:///ha.ka.ba/x/fixture`>>\n<<^ code=`&#x0002;`>>\n\n" +
  "```toml meta\n" + (metaLine ? metaLine + "\n" : "") +
  'title    = "lar:///ha.ka.ba/x/fixture"\nuri-path = "ha.ka.ba/x/fixture"\n```\n\nbody\n\n<<^ code=`&#x0003;`>>\n';

async function walk(metaLine) {
  const dir = await mkdtemp(join(tmpdir(), "meme-coordinates-"));
  try {
    await mkdir(join(dir, "x"), { recursive: true });
    await writeFile(join(dir, "x", "fixture.mem"), carrier(metaLine));
    const r = spawnSync("bash", [SCRIPT, dir], { cwd: ROOT, encoding: "utf8" });
    return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("KNOWN POSITIVE: a double-quoted file-path reads drift", async () => {
  const r = await walk('file-path = "bags/x/fixture.mem"');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /file-path declares/);
});

for (const [name, line] of [
  ["single-quoted", "file-path = 'bags/x/fixture.mem'"],
  ["unquoted", "file-path = bags/x/fixture.mem"],
  ["no spacing", 'file-path="bags/x/fixture.mem"'],
  ["wide spacing", "file-path\t =   'bags/x/fixture.mem'"],
  ["a quoted key", '"file-path" = "bags/x/fixture.mem"'],
]) {
  test(`RED: file-path spelled ${name} reads drift`, async () => {
    const r = await walk(line);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /file-path declares/);
  });
}

test("CONTROL: a carrier without file-path reads clean, its uri-path agreeing with its head", async () => {
  const r = await walk(null);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /1 carriers · 0 declare the retired file-path · 1 declare uri-path/);
});
