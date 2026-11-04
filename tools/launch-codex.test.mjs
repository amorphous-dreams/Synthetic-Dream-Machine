import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appendSeatLaw, canaryBrief, canaryVerdict, ceilingFor, COMPACT_LIMIT, TOOL_OUTPUT_LIMIT, distFresh, findRollout, rolloutTokens, watchSeat, mainCheckout, preflight, readPool, realHome, realReaders, run, seatArgs, seatLaw } from "./launch-codex.mjs";
import { globalStampPath, packageStampPath, sourceDigest } from "./stamp-build.mjs";

const TOOL = fileURLToPath(new URL("./launch-codex.mjs", import.meta.url));
const CANON = fileURLToPath(new URL("../bags/lares/ha.ka.ba/lares/docs/pono/mixed-model-swarm.mem", import.meta.url));

// A recorded rollout line (the newest rollout's own rate_limits record, 2026-10-30), used 60% of a 7-day window.
const rate = (used) => `{"timestamp":"2026-10-30T18:16:34.877Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"total_tokens":622660}},"rate_limits":{"limit_id":"codex","primary":{"used_percent":${used},"window_minutes":10080,"resets_at":1793791489},"secondary":null}}}`;
const CACHE = '{"models":[{"slug": "gpt-6.1-sol"},{"slug": "gpt-6.1-terra"},{"slug": "gpt-6-luna"},{"slug": "gpt-6-sol"}]}';

/** A scratch world: a fake real home, a seat dir with a brief under it, a worktree, a main checkout. */
function world(over = {}) {
  const home = mkdtempSync(join(tmpdir(), "launch-codex-"));
  const repo = join(home, "repo"), wt = join(home, ".lares-scratch", "lane", "wt"), seatDir = join(home, ".lares-scratch", "lane", "seats", "s1");
  for (const d of [repo, wt, seatDir]) mkdirSync(d, { recursive: true });
  writeFileSync(join(seatDir, "brief.md"), "# brief\nDo the thing.\n");
  const calls = { pool: 0 };
  const readers = {
    realHome: home, repo,
    modelsCache: () => CACHE,
    rolloutLines: () => { calls.pool++; return [rate(40)]; },
    distFresh: () => true,
    canon: () => readFileSync(CANON, "utf8"),
    ...over,
  };
  return { home, repo, wt, seatDir, readers, calls };
}
const ask = (w, o = {}) => ({ mode: "build", model: "gpt-6.1-terra", effort: "high", seatDir: w.seatDir, worktree: w.wt, ...o });
const refuses = (w, o, re, readers) => assert.throws(() => preflight(ask(w, o), readers ?? w.readers), re);

test("every mode carries approval never; no mode carries --ephemeral", () => {
  for (const mode of ["build", "read", "research"]) {
    const a = seatArgs({ mode, model: "m", effort: "high", seatDir: "/s", worktree: "/w" });
    assert.ok(a.includes('approval_policy="never"'), `${mode} lacks approval never`);
    assert.ok(!a.includes("--ephemeral"), `${mode} carries --ephemeral`);
    assert.ok(a.includes("model_reasoning_effort=high"));
  }
});

test("build: workspace-write, network off, both tmp excludes, -C worktree, --add-dir seat; CONTROL: no network_access=true", () => {
  const a = seatArgs({ mode: "build", model: "m", effort: "high", seatDir: "/s", worktree: "/w" });
  const j = a.join(" ");
  assert.match(j, /-s workspace-write/);
  assert.ok(a.includes("sandbox_workspace_write.network_access=false"));
  assert.ok(a.includes("sandbox_workspace_write.exclude_slash_tmp=true"));
  assert.ok(a.includes("sandbox_workspace_write.exclude_tmpdir_env_var=true"));
  assert.match(j, /-C \/w --add-dir \/s/);
  assert.ok(!j.includes("network_access=true"));
  assert.ok(!a.includes("--search"));
});

test("lead argv exact", () => {
  assert.deepEqual(seatArgs({ mode: "lead", model: "m", effort: "high", seatDir: "/lane/s", worktree: "/w", gitDir: "/g", laneRoot: "/lane" }), ["exec", "-m", "m", "-c", "model_reasoning_effort=high", "-c", 'approval_policy="never"', "--skip-git-repo-check", "-o", "/lane/s/final.md", "-c", `model_auto_compact_token_limit=${COMPACT_LIMIT}`, "-c", `tool_output_token_limit=${TOOL_OUTPUT_LIMIT}`, "-s", "workspace-write", "-c", "sandbox_workspace_write.exclude_slash_tmp=true", "-c", "sandbox_workspace_write.exclude_tmpdir_env_var=true", "-c", "sandbox_workspace_write.network_access=true", "-C", "/w", "--add-dir", "/lane/s", "--add-dir", "/g", "--add-dir", "/lane"]);
});

test("lead argv needs worktree", () => {
  assert.throws(() => seatArgs({ mode: "lead", model: "m", effort: "high", seatDir: "/s" }), /needs its worktree/);
});

test("read: -s read-only -C seat, no add-dir, no search", () => {
  const a = seatArgs({ mode: "read", model: "m", effort: "high", seatDir: "/s", worktree: "/w" });
  assert.match(a.join(" "), /-s read-only -C \/s$/);
  assert.ok(!a.includes("--add-dir") && !a.includes("--search"));
});

test("only research searches, and --search rides ahead of exec; research is networked inside its seat dir", () => {
  const r = seatArgs({ mode: "research", model: "m", effort: "high", seatDir: "/s" });
  assert.equal(r[0], "--search");
  assert.equal(r[1], "exec");
  assert.ok(r.includes("sandbox_workspace_write.network_access=true"));
  for (const mode of ["build", "read"]) assert.ok(!seatArgs({ mode, model: "m", effort: "high", seatDir: "/s", worktree: "/w" }).includes("--search"));
  assert.equal(seatArgs({ mode: "read", model: "m", effort: "high", seatDir: "/s" })[0], "exec");
});

test("the seat's final.md rides -o, and an unknown mode refuses", () => {
  const a = seatArgs({ mode: "read", model: "m", effort: "high", seatDir: "/s" });
  assert.match(a.join(" "), /-o \/s\/final\.md/);
  assert.throws(() => seatArgs({ mode: "write", model: "m", effort: "high", seatDir: "/s" }), /mode must be/);
});

test("CONTROL: a fresh build seat over a fresh stamp passes preflight, and names its pool", () => {
  const w = world();
  const got = preflight(ask(w), w.readers);
  assert.match(got.pool, /ABOVE FLOOR/);
  assert.match(got.pool, /60.0% left/);
});

test("refuses the main checkout as a build worktree; a reader and a researcher need none", () => {
  const w = world();
  refuses(w, { worktree: w.repo }, /main checkout/);
  refuses(w, { worktree: undefined }, /needs its worktree/);
  assert.ok(preflight(ask(w, { mode: "read", worktree: w.repo }), w.readers));
});

test("lead preflight main checkout", () => {
  const w = world();
  refuses(w, { mode: "lead", worktree: w.repo }, /main checkout/);
  refuses(w, { mode: "lead", worktree: undefined }, /needs its worktree/);
});

test("lead preflight scratch boundary", () => {
  const w = world();
  const outside = join(w.home, "outside"); mkdirSync(outside);
  const link = join(w.home, ".lares-scratch", "lane", "escape"); symlinkSync(outside, link);
  refuses(w, { mode: "lead", worktree: outside }, /worktree.*scratch/);
  refuses(w, { mode: "lead", worktree: link }, /worktree.*scratch/);
});

test("refuses a seat dir outside <scratch>/<lane>/, an absent brief, a model absent from the cache, gpt-6-sol", () => {
  const w = world();
  const outside = mkdtempSync(join(tmpdir(), "outside-")); writeFileSync(join(outside, "brief.md"), "x");
  refuses(w, { seatDir: outside }, /seat dir must sit under/);
  refuses(w, { seatDir: join(w.home, ".lares-scratch", "lane") }, /seat dir must sit under/);
  const empty = join(w.home, ".lares-scratch", "lane", "nobrief"); mkdirSync(empty);
  refuses(w, { seatDir: empty }, /no .*brief\.md/);
  refuses(w, { model: "gpt-6-nope" }, /not in Codex's models cache/);
  refuses(w, { model: "gpt-6-sol" }, /gpt-6\.1-sol/); // present in the cache, still refused
  refuses(w, {}, /models cache/, { ...w.readers, modelsCache: () => null });
});

test("the pool: a pure read of the recorded line; at the floor refuses; CONTROL just above passes", () => {
  const p = readPool([rate(60)]);
  assert.equal(p.used, 60); assert.equal(p.winDays, 7); assert.equal(p.reset, 1793791489);
  assert.equal(p.above, true);
  assert.equal(readPool([rate(80)]).above, false, "exactly 20% left reads AT the floor");
  assert.equal(readPool([rate(79.9)]).above, true);
  assert.equal(readPool(["not json", "{}"]), null);
  assert.equal(readPool([]), null);
  assert.equal(readPool(null), null);
  const w = world();
  refuses(w, {}, /at or below its floor/, { ...w.readers, rolloutLines: () => [rate(80)] });
  refuses(w, {}, /at or below its floor/, { ...w.readers, rolloutLines: () => [rate(97)] });
  assert.ok(preflight(ask(w, { mode: "read" }), { ...w.readers, rolloutLines: () => [rate(79.9)] }));
});

test("lead preflight floor", () => {
  const w = world();
  const at = { ...w.readers, rolloutLines: () => [rate(80)] };
  const fifteen = { ...w.readers, rolloutLines: () => [rate(85)] };
  refuses(w, { mode: "lead" }, /at or below its floor/, at);
  refuses(w, { mode: "lead" }, /at or below its floor/, fifteen);
  assert.ok(preflight(ask(w, { mode: "read" }), fifteen));
});

test("a pool line unreadable twice names itself and never reads zero; once-unreadable reads again", () => {
  const w = world({ rolloutLines: () => { w.calls.pool++; return []; } });
  refuses(w, {}, /unreadable.*twice/s);
  assert.equal(w.calls.pool, 2, "exactly two reads");
  const v = world();
  let n = 0;
  const flaky = { ...v.readers, rolloutLines: () => (++n === 1 ? [] : [rate(60)]) };
  assert.match(preflight(ask(v), flaky).pool, /ABOVE FLOOR/);
  assert.equal(n, 2);
});

test("a stale dist refuses a build seat alone; read and research seats never ask", () => {
  const w = world({ distFresh: () => false });
  refuses(w, {}, /dist is stale.*pnpm build/s);
  assert.ok(preflight(ask(w, { mode: "read" }), w.readers));
  assert.ok(preflight(ask(w, { mode: "research" }), w.readers));
});

test("lead preflight lane passes stale", () => {
  const w = world({ distFresh: () => { throw new Error("lead must not check dist"); } });
  assert.match(preflight(ask(w, { mode: "lead" }), w.readers).pool, /ABOVE FLOOR/);
});

test("the dist question is the guard's closure question: CONTROL a per-package stamp covers a stale global one; KNOWN POSITIVE a stale package reads stale", () => {
  const repo = mkdtempSync(join(tmpdir(), "dist-repo-"));
  const pkg = join(repo, "packages", "a");
  mkdirSync(join(pkg, "src"), { recursive: true }); mkdirSync(join(pkg, "dist"));
  writeFileSync(join(pkg, "package.json"), '{"name":"@x/a"}'); writeFileSync(join(pkg, "src", "i.ts"), "export const a = 1;\n");
  mkdirSync(join(repo, "node_modules", ".lares-build", "pkg"), { recursive: true });
  assert.equal(distFresh(repo), false, "no stamp at all reads stale");
  writeFileSync(packageStampPath(repo, "a"), sourceDigest(pkg));
  writeFileSync(globalStampPath(repo), "stale-global");
  assert.equal(distFresh(repo), true, "a --pkg rebuild passes though the global stamp reads stale");
  writeFileSync(join(pkg, "src", "i.ts"), "export const a = 2;\n");
  assert.equal(distFresh(repo), false, "an edit after the stamp reads stale");
  writeFileSync(globalStampPath(repo), sourceDigest(join(repo, "packages")));
  assert.equal(distFresh(repo), true, "a fresh global stamp covers all");
});

test("the seat law comes from canon, and a brief gains it exactly once across two launches", () => {
  const law = seatLaw(readFileSync(CANON, "utf8"));
  assert.match(law, /^## SEAT LAW/);
  assert.match(law, /Never commit and never run a git write/);
  assert.match(law, /Never run the battery/);
  const once = appendSeatLaw("# brief\nwork\n", law);
  assert.equal(once.match(/^## SEAT LAW/gm).length, 1);
  assert.equal(appendSeatLaw(once, law), once, "a second launch adds nothing");
  assert.throws(() => seatLaw("no section here"), /seat-law/);
});

test("run: a real launch appends the law once, logs the attempt, spawns codex with HOME the passwd home; a second launch adds no law", () => {
  const w = world();
  const spawned = [];
  const spawn = (cmd, args, opts) => { spawned.push({ cmd, args, opts }); return { pid: 4242 }; };
  const out = [];
  const code = () => run(["--mode", "build", "--model", "gpt-6.1-terra", "--effort", "high", "--seat-dir", w.seatDir, "--worktree", w.wt], { readers: w.readers, spawn, log: (s) => out.push(s) });
  assert.equal(code(), 0);
  assert.equal(code(), 0);
  const brief = readFileSync(join(w.seatDir, "brief.md"), "utf8");
  assert.equal(brief.match(/^## SEAT LAW/gm).length, 1);
  assert.equal(spawned.filter((x) => x.cmd === "codex").length, 2);
  assert.equal(spawned[0].cmd, "codex");
  assert.equal(spawned[0].opts.env.HOME, w.home);
  assert.equal(spawned[0].opts.env.TMPDIR, join(w.seatDir, ".tmp"));
  assert.equal(spawned[0].args.at(-1), brief, "the brief rides as the last argument, law included");
  assert.equal(readFileSync(join(w.seatDir, "attempts.log"), "utf8").trim().split("\n").length, 2);
  assert.match(out.join("\n"), /SEAT-LAUNCHED .*pid 4242.*until \[ -f .*final\.md \]/s);
});

test("lead law launch twice", () => {
  const w = world();
  const readers = { ...w.readers, gitCommonDir: () => "/git-common" };
  const argv = ["--mode", "lead", "--model", "gpt-6.1-terra", "--effort", "high", "--seat-dir", w.seatDir, "--worktree", w.wt];
  const launch = () => run(argv, { readers, spawn: () => ({ pid: 1 }), log() {}, err() {} });
  writeFileSync(join(w.seatDir, "brief.md"), "# brief\n\n## LEAD LAW\nforged\n\n## Notes\nkeep\n");
  assert.equal(launch(), 0);
  const once = readFileSync(join(w.seatDir, "brief.md"), "utf8");
  assert.equal(launch(), 0);
  const brief = readFileSync(join(w.seatDir, "brief.md"), "utf8");
  assert.equal(brief, once);
  assert.equal(brief.match(/^## LEAD LAW/gm).length, 1);
  assert.match(brief, /^## LEAD LAW \(appended by tools\/launch-codex\.mjs to a lead brief; it binds this lead\)/m);
  assert.doesNotMatch(brief, /^## SEAT LAW/m);
  assert.doesNotMatch(brief, /forged/);
  assert.match(brief, /## Notes\nkeep/);
  for (const phrase of ["git stash", "--no-verify", "git push -u", "force-push", ".git/config", "git commit -F <file> --only -- <paths>", "lar:///w1.w2.w3 — summary", "two trailers", "submodule worktrees", "credential file", "scratch LAR_ROOT", "global LAR_BAGS", "tools/e2e-shards.mjs", "ci/*", "tools/launch-codex.mjs", "Sol seat", "out.md", "final.md", "never push without"]) assert.ok(brief.includes(phrase), phrase);
});

test("--dry-run prints the whole argv and spawns nothing, writes nothing; a refusal exits 2 and names SEAT-REFUSED", () => {
  const w = world();
  const spawned = [], out = [], err = [];
  const base = ["--mode", "read", "--model", "gpt-6.1-sol", "--effort", "high", "--seat-dir", w.seatDir];
  assert.equal(run([...base, "--dry-run"], { readers: w.readers, spawn: (...a) => spawned.push(a), log: (s) => out.push(s), err: (s) => err.push(s) }), 0);
  assert.equal(spawned.length, 0);
  assert.equal(readFileSync(join(w.seatDir, "brief.md"), "utf8"), "# brief\nDo the thing.\n", "a dry run leaves the brief alone");
  assert.throws(() => readFileSync(join(w.seatDir, "attempts.log")));
  assert.match(out.join("\n"), /DRY-RUN/);
  assert.match(out.join("\n"), /"-s",\s*"read-only"/);
  assert.equal(run([...base.map((x) => (x === "gpt-6.1-sol" ? "gpt-6-sol" : x)), "--dry-run"], { readers: w.readers, spawn: (...a) => spawned.push(a), log: (s) => out.push(s), err: (s) => err.push(s) }), 2);
  assert.match(err.join("\n"), /SEAT-REFUSED/);
  assert.equal(spawned.length, 0);
});

test("lead dry run argv", () => {
  const w = world(), out = [];
  let resolved;
  const readers = { ...w.readers, gitCommonDir: (wt) => { resolved = wt; return "/common/git"; } };
  const code = run(["--mode", "lead", "--model", "gpt-6.1-terra", "--effort", "high", "--seat-dir", w.seatDir, "--worktree", w.wt, "--dry-run"], { readers, log: (s) => out.push(s), err() {}, spawn: () => { throw new Error("spawned"); } });
  assert.equal(code, 0);
  assert.equal(resolved, realpathSync(w.wt));
  const args = JSON.parse(out.find((s) => s.startsWith("DRY-RUN ")).slice(8));
  assert.deepEqual(args, ["codex", ...seatArgs({ mode: "lead", model: "gpt-6.1-terra", effort: "high", seatDir: realpathSync(w.seatDir), worktree: realpathSync(w.wt), gitDir: "/common/git", laneRoot: dirname(realpathSync(w.seatDir)) }), "<brief>"]);
  assert.ok(args.includes(dirname(realpathSync(w.seatDir))));
});

test("HOME for the cache and rollouts reads os.userInfo().homedir, never $HOME (a lead under a scratch HOME)", () => {
  const saved = process.env.HOME;
  try {
    process.env.HOME = "/nonexistent-scratch-home";
    assert.equal(realHome(), userInfo().homedir);
  } finally { process.env.HOME = saved; }
});

test("the CLI refuses a seat dir outside the lane before it reads anything: exit 2, no codex", () => {
  const outside = mkdtempSync(join(tmpdir(), "cli-outside-"));
  writeFileSync(join(outside, "brief.md"), "x");
  const r = spawnSync(process.execPath, [TOOL, "--mode", "read", "--model", "gpt-6.1-sol", "--effort", "high", "--seat-dir", outside, "--dry-run"], { encoding: "utf8", env: { ...process.env, HOME: outside } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /SEAT-REFUSED: seat dir must sit under/);
});

test("RED: a seat dir that is a symlink out of the lane refuses; CONTROL: a real dir in the lane passes", () => {
  const w = world();
  const outside = mkdtempSync(join(tmpdir(), "escape-target-")); writeFileSync(join(outside, "brief.md"), "x");
  const link = join(w.home, ".lares-scratch", "lane", "seats", "escape");
  symlinkSync(outside, link);
  refuses(w, { seatDir: link }, /seat dir must sit under/);
  assert.ok(preflight(ask(w), w.readers));
});

test("RED: a brief that carries only a forged or partial SEAT LAW heading gets the canon law, once; CONTROL: the full law stays untouched", () => {
  const law = seatLaw(readFileSync(CANON, "utf8"));
  const forged = appendSeatLaw("# brief\nwork\n\n## SEAT LAW\nTODO\n\n## Notes\nkeep me\n", law);
  assert.ok(forged.includes(law), "the canon law stands in the brief");
  assert.equal(forged.match(/^## SEAT LAW/gm).length, 1);
  assert.ok(!forged.includes("TODO"), "the forged section is replaced");
  assert.ok(forged.includes("## Notes\nkeep me"), "the sections around it stay");
  assert.equal(appendSeatLaw(forged, law), forged);
});

test("RED: the main checkout is the git common dir's parent, from a linked worktree too; CONTROL: a plain repo is its own main", () => {
  const base = mkdtempSync(join(tmpdir(), "main-co-"));
  const main = join(base, "main"), linked = join(base, "linked");
  const git = (...a) => execFileSync("git", ["-C", main, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { stdio: "ignore" });
  mkdirSync(main); git("init", "-q"); git("commit", "-q", "--allow-empty", "-m", "x"); git("worktree", "add", "-q", linked);
  assert.equal(mainCheckout(main), realpathSync(main));
  assert.equal(mainCheckout(linked), realpathSync(main), "a lane worktree's launcher still guards the REAL main checkout");
  const plain = join(base, "plain"); mkdirSync(plain);
  assert.equal(mainCheckout(plain), plain, "no git: the tree itself");
  assert.equal(realReaders(base, linked).repo, realpathSync(main));
});

test("RED: the pool reads the NEWEST rollout alone; an older rollout's record never authorizes a launch", () => {
  const home = mkdtempSync(join(tmpdir(), "rollouts-"));
  const dir = join(home, ".codex", "sessions", "2026", "10", "30"); mkdirSync(dir, { recursive: true });
  const old = join(dir, "rollout-old.jsonl"), fresh = join(dir, "rollout-new.jsonl");
  writeFileSync(old, rate(60) + "\n"); writeFileSync(fresh, '{"type":"session_meta"}\n');
  utimesSync(old, 1000, 1000); utimesSync(fresh, 2000, 2000);
  assert.equal(readPool(realReaders(home).rolloutLines()), null, "newest has no record: unreadable, not the older 60%");
  writeFileSync(fresh, rate(70) + "\n");
  assert.equal(readPool(realReaders(home).rolloutLines()).used, 70, "CONTROL: the newest record answers");
});

test("RED: a relative --worktree is resolved once; spawn carries the absolute path that preflight checked", () => {
  const w = world();
  const spawned = [];
  const prev = process.cwd();
  try {
    process.chdir(join(w.home, ".lares-scratch", "lane"));
    assert.equal(run(["--mode", "build", "--model", "gpt-6.1-terra", "--effort", "high", "--seat-dir", w.seatDir, "--worktree", "wt"], { readers: w.readers, spawn: (c, a) => { spawned.push(a); return { pid: 1 }; }, log() {}, err() {} }), 0);
  } finally { process.chdir(prev); }
  const a = spawned[0];
  assert.equal(a[a.indexOf("-C") + 1], realpathSync(w.wt));
});

test("RED: the seat law heading is exact: LAWFUL is no law, two blocks collapse to one, a placeholder is replaced", () => {
  const law = seatLaw(readFileSync(CANON, "utf8"));
  const lawful = appendSeatLaw("# b\n## SEAT LAWFUL\nx\n", law);
  assert.ok(lawful.includes("## SEAT LAWFUL") && lawful.includes(law));
  const twice = appendSeatLaw(`# b\n\n${law}\n${law}`, law);
  assert.equal(twice.match(/^## SEAT LAW \(/gm).length, 1);
  assert.ok(twice.includes(law));
});

test("the floors by mode: a READ seat launches down to its own floor (0% while the operator lets readers spend the last of the pool); a build or research seat keeps the 20% house floor", () => {
  const w = world();
  const fifteen = { ...w.readers, rolloutLines: () => [rate(85)] }; // 15% left
  assert.match(preflight(ask(w, { mode: "read" }), fifteen).pool, /floor 0%.*ABOVE FLOOR/);
  refuses(w, {}, /at or below its floor/, fifteen); // CONTROL: a builder at 15% still refuses
  refuses(w, { mode: "research", worktree: undefined }, /at or below its floor/, fifteen);
  assert.match(preflight(ask(w, { mode: "read" }), { ...w.readers, rolloutLines: () => [rate(95)] }).pool, /ABOVE FLOOR/); // 5% left reads above a 0% floor
  refuses(w, { mode: "read" }, /at or below its floor/, { ...w.readers, rolloutLines: () => [rate(100)] }); // an empty pool still refuses
  assert.equal(readPool([rate(85)], "read").above, true);
  assert.equal(readPool([rate(85)], "build").above, false);
});

// ---- row 2: the pool-used ceilings by mode ----
test("row 2: a lead refuses above 50% used, build and research above 60%, a read seat never; the refusal names the reading; CONTROL at the line passes", () => {
  const w = world();
  const at = (u) => ({ ...w.readers, rolloutLines: () => [rate(u)] });
  refuses(w, { mode: "lead" }, /used 55\.0%.*lead.*50%/s, at(55));
  assert.ok(preflight(ask(w, { mode: "lead" }), at(50)));
  refuses(w, { mode: "build" }, /used 65\.0%.*build.*60%/s, at(65));
  assert.ok(preflight(ask(w, { mode: "build" }), at(60)));
  refuses(w, { mode: "research", worktree: undefined }, /used 61\.0%.*research.*60%/s, at(61));
  assert.ok(preflight(ask(w, { mode: "read" }), at(79)));
  refuses(w, { mode: "lead" }, /at or below its floor/, at(85)); // the 20%-left floor still speaks first
});

// ---- row 1: per-seat ceilings ----
const tc = (total) => JSON.stringify({ type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { total_tokens: total } } } });

test("row 1: ceilingFor gives 15M to a lead step and 8M to the rest; an override wins; junk refuses", () => {
  assert.equal(ceilingFor("lead"), 15_000_000);
  for (const m of ["build", "read", "research"]) assert.equal(ceilingFor(m), 8_000_000);
  assert.equal(ceilingFor("build", 1234), 1234);
  assert.equal(ceilingFor("build", "99"), 99);
  for (const bad of [0, -5, "x", 1.5, NaN]) assert.throws(() => ceilingFor("build", bad), /ceiling/);
});

test("row 1: rolloutTokens reads the LAST total_token_usage.total_tokens, skips info:null lines, null when none", () => {
  const nul = JSON.stringify({ type: "event_msg", payload: { type: "token_count", info: null } });
  assert.equal(rolloutTokens([tc(10), nul, tc(7_000_000), "garbage"]), 7_000_000);
  assert.equal(rolloutTokens([nul, "x"]), null);
  assert.equal(rolloutTokens([]), null);
});

test("row 1: findRollout matches the seat by session cwd among the rollouts new since the launch, never another seat's or an earlier one; commas and escapes match; two seats in one cwd each find the earlier start", () => {
  const home = mkdtempSync(join(tmpdir(), "rollouts-"));
  const dir = join(home, ".codex", "sessions", "2026", "11", "04");
  mkdirSync(dir, { recursive: true });
  const metaAt = (cwd, ts) => JSON.stringify({ timestamp: ts, type: "session_meta", payload: { cwd } });
  const put = (name, cwd, ts) => { const f = join(dir, name); writeFileSync(f, `${metaAt(cwd, ts)}\n${tc(5)}\n`); return f; };
  const old = put("rollout-c.jsonl", "/lane/wt", "2026-11-04T09:00:00.000Z");
  const before = new Set([old]);
  const mine = put("rollout-a.jsonl", "/lane/wt", "2026-11-04T10:00:00.000Z");
  put("rollout-b.jsonl", "/elsewhere", "2026-11-04T10:00:00.000Z");
  assert.equal(findRollout(home, { cwds: ["/lane/wt", "/lane/s"], before }), mine);
  assert.equal(findRollout(home, { cwds: ["/nowhere"], before }), null);
  assert.equal(findRollout(home, { cwds: ["/lane/wt"], before: new Set([old, mine]) }), null, "CONTROL: every match listed before reads none");
  const odd = put("rollout-d.jsonl", '/la,ne/"q"', "2026-11-04T10:00:00.000Z");
  assert.equal(findRollout(home, { cwds: ['/la,ne/"q"'], before }), odd);
  put("rollout-f.jsonl", "/shared", "2026-11-04T10:00:09.000Z");
  const early = put("rollout-e.jsonl", "/shared", "2026-11-04T10:00:01.000Z");
  assert.equal(findRollout(home, { cwds: ["/shared"], before }), early);
});

test("row 1: watchSeat stops a seat at its ceiling (SIGTERM, then SIGKILL when it lives), writes ceiling.md naming the reading and the ceiling; reads no run.log", () => {
  const seatDir = mkdtempSync(join(tmpdir(), "ceil-"));
  writeFileSync(join(seatDir, "run.log"), "tokens used\n12\n"); // the understated line must never decide
  const readings = [100, 7_999_999, 8_100_000];
  const signals = [];
  let alive = true;
  const r = watchSeat({ seatDir, pid: 77, ceiling: 8_000_000, mode: "build", tokens: () => readings.shift() ?? 8_100_000, alive: () => alive, kill: (sig) => { signals.push(sig); if (sig === "SIGKILL") alive = false; }, sleep() {}, graceTicks: 2 });
  assert.equal(r, "ceiling");
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
  const note = readFileSync(join(seatDir, "ceiling.md"), "utf8");
  assert.match(note, /8100000/);
  assert.match(note, /8000000/);
  assert.match(note, /build/);
});

test("row 1: CONTROL watchSeat under the ceiling leaves the seat alone and writes nothing; a seat that exits on SIGTERM draws no SIGKILL", () => {
  const seatDir = mkdtempSync(join(tmpdir(), "ceil-"));
  let ticks = 0;
  const signals = [];
  const r = watchSeat({ seatDir, pid: 1, ceiling: 100, mode: "read", tokens: () => 50, alive: () => ++ticks < 4, kill: (s) => signals.push(s), sleep() {}, graceTicks: 2 });
  assert.equal(r, "exited");
  assert.deepEqual(signals, []);
  assert.throws(() => readFileSync(join(seatDir, "ceiling.md")));
  let up = true;
  const r2 = watchSeat({ seatDir, pid: 1, ceiling: 100, mode: "read", tokens: () => 500, alive: () => up, kill: (s) => { signals.push(s); up = false; }, sleep() {}, graceTicks: 2 });
  assert.equal(r2, "ceiling");
  assert.deepEqual(signals, ["SIGTERM"]);
});

test("row 1: run launches the watchdog detached beside the seat with the mode's ceiling, or the --ceiling override; a dry run launches none", () => {
  const w = world();
  const spawned = [];
  const spawn = (cmd, args, opts) => { spawned.push({ cmd, args, opts }); return { pid: 4242, unref() {} }; };
  const base = ["--mode", "build", "--model", "gpt-6.1-terra", "--effort", "high", "--seat-dir", w.seatDir, "--worktree", w.wt];
  assert.equal(run(base, { readers: w.readers, spawn, log() {} }), 0);
  const dog = spawned.find((x) => x.cmd !== "codex");
  assert.ok(dog, "a watchdog spawned");
  assert.equal(dog.opts.detached, true);
  assert.ok(dog.args.includes("--watch"));
  assert.equal(dog.args[dog.args.indexOf("--ceiling") + 1], "8000000");
  assert.equal(dog.args[dog.args.indexOf("--pid") + 1], "4242");
  spawned.length = 0;
  assert.equal(run([...base, "--ceiling", "123"], { readers: w.readers, spawn, log() {} }), 0);
  assert.equal(spawned.find((x) => x.cmd !== "codex").args[spawned.find((x) => x.cmd !== "codex").args.indexOf("--ceiling") + 1], "123");
  spawned.length = 0;
  assert.equal(run([...base, "--dry-run"], { readers: w.readers, spawn, log() {} }), 0);
  assert.equal(spawned.length, 0);
  assert.equal(run([...base, "--ceiling", "nope"], { readers: w.readers, spawn, log() {}, err() {} }), 2);
});

// ---- row 3: the compaction canary ----
const cevent = (o) => JSON.stringify(o);

test("row 3: every mode carries the compaction and tool-output limits as -c overrides; an override moves the compaction limit alone", () => {
  for (const mode of ["build", "lead", "read", "research"]) {
    const a = seatArgs({ mode, model: "m", effort: "high", seatDir: "/s", worktree: "/w" });
    const i = a.indexOf(`model_auto_compact_token_limit=${COMPACT_LIMIT}`), j = a.indexOf(`tool_output_token_limit=${TOOL_OUTPUT_LIMIT}`);
    assert.ok(i > 0 && a[i - 1] === "-c", `${mode} lacks the compact limit`);
    assert.ok(j > 0 && a[j - 1] === "-c", `${mode} lacks the tool output limit`);
  }
  const low = seatArgs({ mode: "read", model: "m", effort: "high", seatDir: "/s", compactLimit: 50000 });
  assert.ok(low.includes("model_auto_compact_token_limit=50000") && low.includes(`tool_output_token_limit=${TOOL_OUTPUT_LIMIT}`));
  assert.ok(!low.includes(`model_auto_compact_token_limit=${COMPACT_LIMIT}`));
});

test("row 3: canaryVerdict reads the rollout's compaction events (compacted, context_compacted, compaction); KNOWN POSITIVE and CONTROL", () => {
  const plain = [cevent({ type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { total_tokens: 90 } } } }), cevent({ type: "response_item", payload: { type: "function_call" } }), cevent({ type: "response_item", payload: { type: "custom_tool_call" } })];
  assert.deepEqual(canaryVerdict(plain), { fired: false, events: 0, calls: 2, tokens: 90 });
  assert.equal(canaryVerdict([...plain, cevent({ type: "compacted", payload: { message: "" } })]).fired, true);
  assert.equal(canaryVerdict([...plain, cevent({ type: "event_msg", payload: { type: "context_compacted" } })]).fired, true);
  const two = canaryVerdict([...plain, cevent({ type: "compacted", payload: {} }), cevent({ type: "event_msg", payload: { type: "context_compacted" } })]);
  assert.equal(two.events, 2);
  assert.equal(canaryVerdict(["garbage", ""]).fired, false);
});

test("row 3: the canary brief demands many separate tool calls in one turn and a closing line", () => {
  const b = canaryBrief();
  assert.match(b, /one tool call per slice/i);
  assert.match(b, /CANARY DONE/);
  assert.match(b, /\b(60|80|100)\b/);
});

test("row 3: --canary on a read seat writes the canary brief and launches with a lowered compaction limit; --check-canary reports the verdict from the seat's own rollout", () => {
  const w = world();
  const spawned = [];
  let snapAtSpawn = null;
  const spawn = (cmd, args, opts) => { if (cmd === "codex") { try { snapAtSpawn = readFileSync(join(w.seatDir, "rollouts-before.json"), "utf8"); } catch { snapAtSpawn = "absent"; } } spawned.push({ cmd, args, opts }); return { pid: 9, unref() {} }; };
  const out = [];
  assert.equal(run(["--mode", "read", "--model", "gpt-6-luna", "--effort", "low", "--seat-dir", w.seatDir, "--canary"], { readers: w.readers, spawn, log: (s) => out.push(s) }), 0);
  const codex = spawned.find((x) => x.cmd === "codex");
  assert.match(readFileSync(join(w.seatDir, "brief.md"), "utf8"), /CANARY DONE/);
  assert.equal(snapAtSpawn, "[]", "the snapshot stands BEFORE codex spawns");
  const beforeSnap = readFileSync(join(w.seatDir, "rollouts-before.json"), "utf8");
  assert.equal(beforeSnap, "[]", "the snapshot lists the rollouts that stood before the spawn");
  const limit = codex.args.find((x) => x.startsWith("model_auto_compact_token_limit="));
  assert.ok(Number(limit.split("=")[1]) < COMPACT_LIMIT, "the canary runs under a lowered limit so compaction can fire");
  // the check
  const dir = join(w.home, ".codex", "sessions", "2026", "11", "04");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "rollout-x.jsonl"), `${cevent({ timestamp: "2026-11-04T10:00:00Z", type: "session_meta", payload: { cwd: realpathSync(w.seatDir) } })}\n${cevent({ type: "compacted", payload: {} })}\n`);
  const say = [];
  assert.equal(run(["--check-canary", "--seat-dir", w.seatDir], { readers: w.readers, log: (s) => say.push(s), err: (s) => say.push(s) }), 0);
  assert.match(say.join("\n"), /COMPACTION-FIRED/);
  // the pre-spawn snapshot: a rollout listed before the launch never counts, and a canary that did not compact exits 1
  const dir2 = join(w.home, ".codex", "sessions", "2026", "11", "04");
  writeFileSync(join(w.seatDir, "rollouts-before.json"), JSON.stringify([join(dir2, "rollout-x.jsonl")]));
  writeFileSync(join(dir2, "rollout-y.jsonl"), `${cevent({ timestamp: "2026-11-04T11:00:00Z", type: "session_meta", payload: { cwd: realpathSync(w.seatDir) } })}\n`);
  const say3 = [];
  assert.equal(run(["--check-canary", "--seat-dir", w.seatDir], { readers: w.readers, log: (s) => say3.push(s), err() {} }), 1);
  assert.match(say3.join("\n"), /COMPACTION-NOT-FIRED/);
  const none = world();
  mkdirSync(join(none.home, ".codex", "sessions"), { recursive: true });
  const say2 = [];
  assert.equal(run(["--check-canary", "--seat-dir", none.seatDir], { readers: none.readers, log: (s) => say2.push(s), err: (s) => say2.push(s) }), 2);
  assert.match(say2.join("\n"), /no rollout/);
});
