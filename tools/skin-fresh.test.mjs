/**
 * skin-fresh.test.mjs — proves the INSTRUMENT over a fixture git tree with a stand-in pipeline, never the live build.
 *
 * Proven:
 *   · CONTROL: tracked bundles equal what the pipeline writes -> green, every bundle listed;
 *   · RED (the known positive): a source edited with no re-pack -> red, the stale bundle named with both digests
 *     and the cure line; the tree stands as the witness found it (the build's bytes never linger);
 *   · RED: a pipeline that fails reads red (a build that did not run proves nothing); a root that is no git tree
 *     reads red; a bundle the build writes and git does not track reads red.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const SCRIPT = resolve(import.meta.dirname, "skin-fresh.mjs");
const TW5 = "packages/lararium-tw5";
const BUNDLE = `${TW5}/plugins/lares-x.json`;
const TID = `${TW5}/plugins/standalone/lares-x.tid`;
const GEN = `${TW5}/src/plugin-tiddler.generated.ts`;
// The stand-in pipeline: each bundle is a pure function of `skin-source.txt`.
const BUILD = `for f in ${BUNDLE} ${TID} ${GEN}; do printf 'packed:%s\\n' "$(cat skin-source.txt)" > $f; done`;

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "skin-fresh-test-"));
  for (const p of [`${TW5}/plugins/standalone`, `${TW5}/src`]) mkdirSync(join(dir, p), { recursive: true });
  writeFileSync(join(dir, "skin-source.txt"), "v1");
  execFileSync("bash", ["-c", BUILD], { cwd: dir });
  const g = (...a) => execFileSync("git", ["-C", dir, ...a], { stdio: "ignore" });
  g("init", "-q");
  g("add", ".");
  g("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "fixture");
  return dir;
}
const run = (dir, build = BUILD) => spawnSync("node", [SCRIPT, "--root", dir, "--build", build], { encoding: "utf8" });

test("CONTROL: bundles equal the fresh build -> green", () => {
  const dir = fixture();
  const r = run(dir);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /3 bundle\(s\) compared/);
  rmSync(dir, { recursive: true });
});

test("RED: a source edit with no re-pack reads red, names the bundle and the cure, leaves the tree as found", () => {
  const dir = fixture();
  writeFileSync(join(dir, "skin-source.txt"), "v2");
  const before = readFileSync(join(dir, BUNDLE), "utf8");
  const r = run(dir);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /STALE BUNDLE\s+packages\/lararium-tw5\/plugins\/lares-x\.json/);
  assert.match(r.stdout, /tracked\s+[0-9a-f]{64}\n\s+fresh\s+[0-9a-f]{64}/);
  assert.match(r.stdout, /re-pack: pnpm --filter @lararium\/tw5 build:plugin, then commit the bundles/);
  assert.equal(readFileSync(join(dir, BUNDLE), "utf8"), before, "the witness restores the tracked bytes");
  rmSync(dir, { recursive: true });
});

test("RED: a failing pipeline, a non-git root, an untracked fresh bundle", () => {
  const dir = fixture();
  const failed = run(dir, "echo boom >&2; exit 3");
  assert.equal(failed.status, 1);
  assert.match(failed.stdout, /pipeline failed/);
  const extra = run(dir, `${BUILD}; echo x > ${TW5}/plugins/lares-new.json`);
  assert.equal(extra.status, 1);
  assert.match(extra.stdout, /UNTRACKED\s+packages\/lararium-tw5\/plugins\/lares-new\.json/);
  rmSync(dir, { recursive: true });
  const bare = mkdtempSync(join(tmpdir(), "skin-fresh-bare-"));
  assert.equal(run(bare).status, 1);
  rmSync(bare, { recursive: true });
});
