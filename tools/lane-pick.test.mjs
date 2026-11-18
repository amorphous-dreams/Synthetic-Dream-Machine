// lane-pick.test — each conflict shape the pick resolves by law, built in a scratch git repository; a fake `lares` stands
// in for the reseal, so no hearth, no network and no real canon move.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PICK = fileURLToPath(new URL("./lane-pick.mjs", import.meta.url));

function scratchRepo() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "lane-pick-")));
  const git = (...args) => {
    const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  git("init", "-q", "-b", "span");
  for (const [k, v] of [["user.name", "Lane Pick Test"], ["user.email", "lane-pick@test.invalid"], ["commit.gpgsign", "false"], ["core.hooksPath", "/dev/null"]]) git("config", k, v);
  const write = (path, text) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  const commit = (msg, files = {}, extra = []) => { for (const [p, t] of Object.entries(files)) { write(p, t); git("add", p); } git("commit", "-q", ...extra, "-m", msg); return git("rev-parse", "HEAD"); };
  // A fake `lares`: `meme normalize <file>` rewrites the seal line and logs the file.
  const log = join(dir, ".git", "reseal.log");
  const lares = join(dir, ".git", "fake-lares");
  writeFileSync(lares, `#!/usr/bin/env bash\n[ "$1 $2" = "meme normalize" ] || exit 9\nsed -i 's/bcc=\`[^\`]*\`/bcc=\`resealed\`/' "$3"\necho "$3" >> ${log}\n`);
  chmodSync(lares, 0o755);
  const pick = (range) => {
    const r = spawnSync(process.execPath, [PICK, "--repo", dir, range], { encoding: "utf8", env: { ...process.env, LARES_BIN: lares } });
    let receipt = null;
    try { receipt = JSON.parse(r.stdout); } catch { /* the assertion below names the stdout */ }
    return { status: r.status, stdout: r.stdout, stderr: r.stderr, receipt };
  };
  const resealed = () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : []);
  const picking = () => spawnSync("git", ["-C", dir, "rev-parse", "-q", "--verify", "CHERRY_PICK_HEAD"]).status === 0;
  return { dir, git, commit, pick, resealed, picking };
}

const mem = (top, mid, seal) => `${top}\nx\nx\n${mid}\nx\nx\n<<^ code=\`&#x0003;\` bcc=\`${seal}\`>>\n`;
const boundary = (clock, extra = "") => `export const CEILINGS = { drift: 0, clock: ${clock}, narration: 0 };\nexport const EXCEPTIONS = [\n  { rule: "clock", file: "a.mjs", match: "Date.now()", reason: "a." },\n${extra}];\n\nexport function rules() {\n  return 1;\n}\n`;

/** The span and a lane cut from one base; `lane` and `span` each add their commits. Answers the range `base..lane`. */
function fork(r, base, lane, span) {
  const b = r.commit("base", base);
  r.git("switch", "-q", "-c", "lane");
  for (const [msg, files, extra] of lane) r.commit(msg, files, extra);
  r.git("switch", "-q", "span");
  for (const [msg, files] of span) r.commit(msg, files);
  return `${b}..lane`;
}

test("CONTROL: a clean range picks whole, in order, and the receipt names each commit with no law applied", () => {
  const r = scratchRepo();
  const range = fork(r, { "a.txt": "a\n", "b.txt": "b\n" }, [["lane one", { "a.txt": "a lane\n" }], ["lane two", { "c.txt": "c\n" }]], [["span one", { "b.txt": "b span\n" }]]);
  const out = r.pick(range);
  assert.equal(out.status, 0, out.stderr + out.stdout);
  assert.deepEqual(out.receipt.picked.map((p) => p.subject), ["lane one", "lane two"]);
  assert.deepEqual(out.receipt.picked.flatMap((p) => p.resolved), []);
  assert.equal(out.receipt.stopped, null);
  assert.deepEqual(out.receipt.rebuildOwed, []);
  assert.equal(r.git("log", "-1", "--format=%s"), "lane two");
  assert.equal(readFileSync(join(r.dir, "a.txt"), "utf8"), "a lane\n");
});

test("a meme conflict whose every hunk is the bcc seal line takes the span's line and re-seals with lares meme normalize", () => {
  const r = scratchRepo();
  const range = fork(r, { "c.mem": mem("top", "mid", "B0") }, [["lane canon", { "c.mem": mem("top", "mid lane", "B2") }]], [["span canon", { "c.mem": mem("top span", "mid", "B1") }]]);
  const out = r.pick(range);
  assert.equal(out.status, 0, out.stderr + out.stdout);
  assert.deepEqual(out.receipt.picked[0].resolved, [{ path: "c.mem", law: "reseal" }]);
  assert.deepEqual(r.resealed(), ["c.mem"]);
  assert.equal(readFileSync(join(r.dir, "c.mem"), "utf8"), mem("top span", "mid lane", "resealed"));
  assert.equal(r.picking(), false);
});

test("a text conflict in a meme stops by name and leaves the pick for a hand", () => {
  const r = scratchRepo();
  const range = fork(r, { "c.mem": mem("top", "mid", "B0") }, [["lane canon", { "c.mem": mem("top", "mid lane", "B2") }]], [["span canon", { "c.mem": mem("top", "mid span", "B1") }]]);
  const out = r.pick(range);
  assert.equal(out.status, 1, out.stdout);
  assert.equal(out.receipt.stopped.subject, "lane canon");
  assert.deepEqual(out.receipt.stopped.paths, [{ path: "c.mem", why: "text conflict in a meme" }]);
  assert.deepEqual(r.resealed(), [], "a text conflict never re-seals");
  assert.equal(r.picking(), true, "the pick stays open for a hand");
});

test("a generated-artifact conflict takes the span's side and reports the rebuild owed", () => {
  const r = scratchRepo();
  const range = fork(r, { "genesis/unbaked.json": "{\"gap\":0}\n", "a.txt": "a\n" }, [["lane bundle", { "genesis/unbaked.json": "{\"gap\":2}\n", "a.txt": "a lane\n" }]], [["span bundle", { "genesis/unbaked.json": "{\"gap\":1}\n" }]]);
  const out = r.pick(range);
  assert.equal(out.status, 0, out.stderr + out.stdout);
  assert.deepEqual(out.receipt.picked[0].resolved, [{ path: "genesis/unbaked.json", law: "generated" }]);
  assert.deepEqual(out.receipt.rebuildOwed, ["genesis/unbaked.json"]);
  assert.equal(readFileSync(join(r.dir, "genesis/unbaked.json"), "utf8"), "{\"gap\":1}\n");
  assert.equal(readFileSync(join(r.dir, "a.txt"), "utf8"), "a lane\n");
});

test("an empty commit skips and the range carries on", () => {
  const r = scratchRepo();
  const range = fork(r, { "a.txt": "a\n" }, [["lane empty", {}, ["--allow-empty"]], ["lane real", { "b.txt": "b\n" }]], []);
  const out = r.pick(range);
  assert.equal(out.status, 0, out.stderr + out.stdout);
  assert.deepEqual(out.receipt.skipped.map((s) => [s.subject, s.why]), [["lane empty", "empty"]]);
  assert.deepEqual(out.receipt.picked.map((p) => p.subject), ["lane real"]);
});

test("an evergreen ceiling conflict takes the span's side and reports the lane's intended counts", () => {
  const r = scratchRepo();
  const ex = `  { rule: "clock", file: "b.mjs", match: "Date.now() < t", reason: "b." },\n`;
  const range = fork(r, { "tools/evergreen-boundary.mjs": boundary(52) }, [["lane ceiling", { "tools/evergreen-boundary.mjs": boundary(53, ex), "b.mjs": "Date.now() < t;\n" }]], [["span ceiling", { "tools/evergreen-boundary.mjs": boundary(51) }]]);
  const out = r.pick(range);
  assert.equal(out.status, 0, out.stderr + out.stdout);
  assert.deepEqual(out.receipt.picked[0].resolved, [{ path: "tools/evergreen-boundary.mjs", law: "evergreen" }]);
  assert.deepEqual(out.receipt.evergreen, [{ subject: "lane ceiling", sha: out.receipt.evergreen[0].sha, ceilings: { drift: 0, clock: 53, narration: 0 }, exceptions: 2 }]);
  assert.equal(readFileSync(join(r.dir, "tools/evergreen-boundary.mjs"), "utf8"), boundary(51));
});

test("a commit left empty once the laws take the span's side skips and says why", () => {
  const r = scratchRepo();
  const range = fork(r, { "genesis/unbaked.json": "{\"gap\":0}\n" }, [["lane bundle only", { "genesis/unbaked.json": "{\"gap\":2}\n" }]], [["span bundle", { "genesis/unbaked.json": "{\"gap\":1}\n" }]]);
  const out = r.pick(range);
  assert.equal(out.status, 0, out.stderr + out.stdout);
  assert.deepEqual(out.receipt.skipped.map((s) => [s.subject, s.why]), [["lane bundle only", "empty once the laws took the span's side"]]);
  assert.deepEqual(out.receipt.rebuildOwed, ["genesis/unbaked.json"]);
  assert.equal(r.picking(), false);
});

test("an evergreen conflict outside the ceilings and exceptions stops by name", () => {
  const r = scratchRepo();
  const range = fork(r, { "tools/evergreen-boundary.mjs": boundary(52) }, [["lane rule", { "tools/evergreen-boundary.mjs": boundary(52).replace("return 1", "return 3") }]], [["span rule", { "tools/evergreen-boundary.mjs": boundary(52).replace("return 1", "return 2") }]]);
  const out = r.pick(range);
  assert.equal(out.status, 1, out.stdout);
  assert.deepEqual(out.receipt.stopped.paths, [{ path: "tools/evergreen-boundary.mjs", why: "evergreen change outside CEILINGS and EXCEPTIONS" }]);
  assert.equal(r.picking(), true);
});

test("any other conflict stops by name with the pick left for a hand", () => {
  const r = scratchRepo();
  const range = fork(r, { "src.ts": "one\n" }, [["lane src", { "src.ts": "lane\n" }]], [["span src", { "src.ts": "span\n" }]]);
  const out = r.pick(range);
  assert.equal(out.status, 1, out.stdout);
  assert.deepEqual(out.receipt.stopped.paths, [{ path: "src.ts", why: "no law resolves it" }]);
  assert.equal(r.picking(), true);
});

test("a dirty tree or a pick already open refuses before any pick (exit 2)", () => {
  const r = scratchRepo();
  const range = fork(r, { "a.txt": "a\n" }, [["lane", { "b.txt": "b\n" }]], []);
  writeFileSync(join(r.dir, "a.txt"), "dirty\n");
  const out = r.pick(range);
  assert.equal(out.status, 2);
  assert.match(out.stderr, /dirty/);
});
