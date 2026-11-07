import { test } from "node:test";
import { wallTest } from "./wall-test.mjs";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, closeSync, openSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tokenTail } from "./launch-codex.mjs";
import { appendSeatLaw, canaryBrief, leadLaw, canaryVerdict, ceilingFor, COMPACT_LIMIT, TOOL_OUTPUT_LIMIT, distFresh, findRollout, rolloutTokens, watchSeat, mainCheckout, preflight, readPool, realHome, realReaders, run, seatArgs, seatLaw } from "./launch-codex.mjs";
import { globalStampPath, packageStampPath, sourceDigest } from "./stamp-build.mjs";

const TOOL = fileURLToPath(new URL("./launch-codex.mjs", import.meta.url));
const CANON = fileURLToPath(new URL("../bags/lares/ha.ka.ba/lares/docs/pono/mixed-model-swarm.mem", import.meta.url));

// A recorded rollout line (the newest rollout's own rate_limits record, 2026-10-30), used 60% of a 7-day window.
const rate = (used) => `{"timestamp":"2026-10-30T18:16:34.877Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"total_tokens":622660}},"rate_limits":{"limit_id":"codex","primary":{"used_percent":${used},"window_minutes":10080,"resets_at":1793791489},"secondary":null}}}`;
const CACHE = '{"models":[{"slug": "gpt-6.1-sol"},{"slug": "gpt-6.1-terra"},{"slug": "gpt-6-luna"},{"slug": "gpt-6-sol"}]}';

/** A scratch world: a fake real home, a seat dir with a brief under it, a worktree, a main checkout. */
let CURRENT = null;
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
    bwrap: true,
    canon: () => readFileSync(CANON, "utf8"),
    ...over,
  };
  CURRENT = { seatDir };
  return { home, repo, wt, seatDir, readers, calls };
}
/** The supervisor spawn, and the codex invocation it carries after `--` with the prompt file's text last. */
const sup = (spawned) => spawned.find((x) => x.args?.includes?.("--supervise"));
const codexOf = (spawned) => { const s = sup(spawned); if (!s) return undefined; return { cmd: "codex", args: [...s.args.slice(s.args.indexOf("--") + 1), readFileSync(join(CURRENT.seatDir, "prompt.txt"), "utf8")], opts: s.opts }; };
const unwrap = (spawned) => spawned.map((x) => (x.args?.includes?.("--supervise") ? codexOf([x]) : x));
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
  assert.deepEqual(seatArgs({ mode: "lead", model: "m", effort: "high", seatDir: "/lane/s", worktree: "/w", laneRoot: "/lane" }), ["exec", "-m", "m", "-c", "model_reasoning_effort=high", "-c", 'approval_policy="never"', "--skip-git-repo-check", "-o", "/lane/s/final.md", "-c", `model_auto_compact_token_limit=${COMPACT_LIMIT}`, "-c", `tool_output_token_limit=${TOOL_OUTPUT_LIMIT}`, "-s", "workspace-write", "-c", "sandbox_workspace_write.exclude_slash_tmp=true", "-c", "sandbox_workspace_write.exclude_tmpdir_env_var=true", "-c", "sandbox_workspace_write.network_access=false", "-C", "/w", "--add-dir", "/lane/s", "--add-dir", "/lane"]);
});

test("P0-1 a lead holds no git dir and no network flag: edits go through the broker, the model API rides the codex process; CONTROL a git dir passed in is ignored", () => {
  const a = seatArgs({ mode: "lead", model: "m", effort: "high", seatDir: "/lane/s", worktree: "/w", laneRoot: "/lane", gitDir: "/the/git/dir" });
  assert.ok(!a.includes("/the/git/dir"), "no git dir rides --add-dir");
  assert.ok(!a.some((x) => x.endsWith("network_access=true")));
  assert.ok(a.includes("sandbox_workspace_write.network_access=false"));
  const law = leadLaw();
  assert.match(law, /broker/); assert.match(law, /req-<id>\.json/);
  assert.doesNotMatch(law, /git commit -F/, "the law no longer tells a lead to commit itself");
  assert.doesNotMatch(law, /Launch seats ONLY through tools\/launch-codex/);
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
  const calls = unwrap(spawned);
  assert.equal(calls.filter((x) => x.cmd === "codex").length, 2);
  assert.equal(calls[0].cmd, "codex");
  assert.equal(calls[0].opts.env.HOME, w.home);
  assert.match(calls[0].opts.env.TMPDIR, /lares-broker\/seats\/seat-[A-Za-z0-9]+\/\.tmp$/, "TMPDIR sits in the broker-owned dir");
  assert.ok(calls[0].args.at(-1).endsWith(brief) && /^SEAT-MARKER [0-9a-f-]{36}\n\n/.test(calls[0].args.at(-1)), "the brief rides last, law included, behind the seat's own marker");
  assert.equal(readFileSync(join(w.seatDir, "attempts.log"), "utf8").trim().split("\n").length, 2);
  assert.match(out.join("\n"), /SEAT-LAUNCHED .*pid 4242.*until \[ -f .*done-[0-9a-f-]+ \]/s);
});

test("lead law launch twice", () => {
  const w = world();
  const readers = { ...w.readers, gitCommonDir: () => "/git-common" };
  const argv = ["--mode", "lead", "--model", "gpt-6.1-terra", "--effort", "high", "--seat-dir", w.seatDir, "--worktree", w.wt];
  const launch = () => run(argv, { readers, spawn: () => ({ pid: 4242 }), log() {}, err() {} });
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
  for (const phrase of ["git stash", "--no-verify", "git push -u", "force-push", ".git/config", "req-<id>.json", "lar:///w1.w2.w3 — summary", "two trailers", "submodule worktrees", "credential file", "scratch LAR_ROOT", "global LAR_BAGS", "tools/e2e-shards.mjs", "ci/*", "launch door", "Sol seat", "out.md", "final.md", "never push without"]) assert.ok(brief.includes(phrase), phrase);
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
  const readers = w.readers;
  const code = run(["--mode", "lead", "--model", "gpt-6.1-terra", "--effort", "high", "--seat-dir", w.seatDir, "--worktree", w.wt, "--dry-run"], { readers, log: (s) => out.push(s), err() {}, spawn: () => { throw new Error("spawned"); } });
  assert.equal(code, 0);
  const args = JSON.parse(out.find((s) => s.startsWith("DRY-RUN ")).slice(8));
  assert.deepEqual(args, ["codex", ...seatArgs({ mode: "lead", model: "gpt-6.1-terra", effort: "high", seatDir: join(realpathSync(w.home), ".local/state/lares-broker/seats", "seat-DRYRUN"), worktree: realpathSync(w.wt), laneRoot: dirname(realpathSync(w.seatDir)) }), "<brief>"]);
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

test("CONTROL: the pool skips one newest recordless rollout to read its predecessor", () => {
  const home = mkdtempSync(join(tmpdir(), "rollouts-"));
  const dir = join(home, ".codex", "sessions", "2026", "10", "30"); mkdirSync(dir, { recursive: true });
  const old = join(dir, "rollout-old.jsonl"), fresh = join(dir, "rollout-new.jsonl");
  writeFileSync(old, rate(60) + "\n"); writeFileSync(fresh, '{"type":"session_meta"}\n');
  utimesSync(old, 1000, 1000); utimesSync(fresh, 2000, 2000);
  assert.equal(readPool(realReaders(home).rolloutLines()).used, 60, "newest has no record: the older recorded reading answers");
  writeFileSync(fresh, rate(70) + "\n");
  assert.equal(readPool(realReaders(home).rolloutLines()).used, 70, "CONTROL: the newest record answers");
});

test("RED: a relative --worktree is resolved once; spawn carries the absolute path that preflight checked", () => {
  const w = world();
  const spawned = [];
  const prev = process.cwd();
  try {
    process.chdir(join(w.home, ".lares-scratch", "lane"));
    assert.equal(run(["--mode", "build", "--model", "gpt-6.1-terra", "--effort", "high", "--seat-dir", w.seatDir, "--worktree", "wt"], { readers: w.readers, spawn: (c, a) => { spawned.push(a); return { pid: 4242 }; }, log() {}, err() {} }), 0);
  } finally { process.chdir(prev); }
  const a = spawned[0].slice(spawned[0].indexOf("--") + 1);
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
const cevent = (o) => JSON.stringify(o);
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

test("P1-5 findRollout binds a seat to its OWN marker: two overlapping launches in one cwd each find only their own rollout; an earlier rollout never counts; CONTROL a marker no rollout holds finds none", () => {
  const home = mkdtempSync(join(tmpdir(), "rollouts-"));
  const dir = join(home, ".codex", "sessions", "2026", "11", "04");
  mkdirSync(dir, { recursive: true });
  const put = (name, marker, cwd = "/shared") => { const f = join(dir, name); writeFileSync(f, `${cevent({ timestamp: "2026-11-04T10:00:00.000Z", type: "session_meta", payload: { cwd } })}\n${cevent({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: `${marker}\n\nthe brief` }] } })}\n${tc(5)}\n`); return f; };
  const old = put("rollout-old.jsonl", "SEAT-MARKER old");
  const before = new Set([old]);
  const a = put("rollout-b.jsonl", "SEAT-MARKER aaaa"), b = put("rollout-a.jsonl", "SEAT-MARKER bbbb");
  assert.equal(findRollout(home, { marker: "SEAT-MARKER aaaa", before }), a);
  assert.equal(findRollout(home, { marker: "SEAT-MARKER bbbb", before }), b);
  assert.equal(findRollout(home, { marker: "SEAT-MARKER old", before }), null, "a rollout listed before the launch never counts");
  assert.equal(findRollout(home, { marker: "SEAT-MARKER none", before }), null);
  // a seat that echoes ANOTHER seat's marker into tool output claims nothing
  const forged = join(dir, "rollout-forger.jsonl");
  writeFileSync(forged, `${cevent({ type: "session_meta", payload: { cwd: "/shared" } })}\n${cevent({ type: "response_item", payload: { type: "function_call_output", output: "SEAT-MARKER zzzz" } })}\n`);
  const victim = put("rollout-victim.jsonl", "SEAT-MARKER zzzz");
  assert.equal(findRollout(home, { marker: "SEAT-MARKER zzzz", before }), victim, "the prompt line claims the rollout, not an echoed copy");
  rmSync(victim);
  assert.equal(findRollout(home, { marker: "SEAT-MARKER zzzz", before }), null, "CONTROL an echo alone claims nothing");
});

test("row 1: watchSeat stops a seat at its ceiling (SIGTERM, then SIGKILL when it lives), writes ceiling.md naming the reading and the ceiling; reads no run.log", async () => {
  const seatDir = mkdtempSync(join(tmpdir(), "ceil-"));
  writeFileSync(join(seatDir, "run.log"), "tokens used\n12\n"); // the understated line must never decide
  const readings = [100, 7_999_999, 8_100_000];
  const signals = [];
  let alive = true;
  const r = await watchSeat({ seatDir, note: (t) => writeFileSync(join(seatDir, "ceiling.md"), t), pid: 77, ceiling: 8_000_000, mode: "build", tokens: () => readings.shift() ?? 8_100_000, alive: () => alive, kill: (sig) => { signals.push(sig); if (sig === "SIGKILL") alive = false; }, sleep() {}, graceTicks: 2 });
  assert.equal(r, "ceiling");
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
  const note = readFileSync(join(seatDir, "ceiling.md"), "utf8");
  assert.match(note, /8100000/);
  assert.match(note, /8000000/);
  assert.match(note, /build/);
});

test("row 1: CONTROL watchSeat under the ceiling leaves the seat alone and writes nothing; a seat that exits on SIGTERM draws no SIGKILL", async () => {
  const seatDir = mkdtempSync(join(tmpdir(), "ceil-"));
  let ticks = 0;
  const signals = [];
  const r = await watchSeat({ seatDir, note: (t) => writeFileSync(join(seatDir, "ceiling.md"), t), pid: 4242, ceiling: 100, mode: "read", tokens: () => 50, alive: () => ++ticks < 4, kill: (s) => signals.push(s), sleep() {}, graceTicks: 2 });
  assert.equal(r, "exited");
  assert.deepEqual(signals, []);
  assert.throws(() => readFileSync(join(seatDir, "ceiling.md")));
  let up = true;
  const r2 = await watchSeat({ seatDir, note: (t) => writeFileSync(join(seatDir, "ceiling.md"), t), pid: 4242, ceiling: 100, mode: "read", tokens: () => 500, alive: () => up, kill: (s) => { signals.push(s); up = false; }, sleep() {}, graceTicks: 2 });
  assert.equal(r2, "ceiling");
  assert.deepEqual(signals, ["SIGTERM"]);
});

test("row 1: run launches the watchdog detached beside the seat with the mode's ceiling, or the --ceiling override; a dry run launches none", () => {
  const w = world();
  const spawned = [];
  const spawn = (cmd, args, opts) => { spawned.push({ cmd, args, opts }); return { pid: 4242, unref() {} }; };
  const base = ["--mode", "build", "--model", "gpt-6.1-terra", "--effort", "high", "--seat-dir", w.seatDir, "--worktree", w.wt];
  assert.equal(run(base, { readers: w.readers, spawn, log() {} }), 0);
  const dog = sup(spawned);
  assert.ok(dog, "a supervisor spawned");
  assert.equal(dog.opts.detached, true);
  assert.ok(dog.args.includes("--supervise") && dog.args.includes("--"), "the supervisor carries the codex argv after --");
  assert.equal(dog.args[dog.args.indexOf("--ceiling") + 1], "8000000");
  spawned.length = 0;
  assert.equal(run([...base, "--ceiling", "123"], { readers: w.readers, spawn, log() {} }), 0);
  assert.equal(sup(spawned).args[sup(spawned).args.indexOf("--ceiling") + 1], "123");
  spawned.length = 0;
  assert.equal(run([...base, "--dry-run"], { readers: w.readers, spawn, log() {} }), 0);
  assert.equal(spawned.length, 0);
  assert.equal(run([...base, "--ceiling", "nope"], { readers: w.readers, spawn, log() {}, err() {} }), 2);
});

// ---- row 3: the compaction canary ----

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
  const spawn = (cmd, args, opts) => { if (args.includes("--supervise")) { try { snapAtSpawn = readFileSync(join(w.seatDir, "rollouts-before.json"), "utf8"); } catch { snapAtSpawn = "absent"; } } spawned.push({ cmd, args, opts }); return { pid: 9, unref() {} }; };
  const out = [];
  assert.equal(run(["--mode", "read", "--model", "gpt-6-luna", "--effort", "low", "--seat-dir", w.seatDir, "--canary"], { readers: w.readers, spawn, log: (s) => out.push(s) }), 0);
  const codex = codexOf(spawned);
  assert.match(readFileSync(join(w.seatDir, "brief.md"), "utf8"), /CANARY DONE/);
  assert.equal(snapAtSpawn, "[]", "the snapshot stands BEFORE codex spawns");
  const beforeSnap = readFileSync(join(w.seatDir, "rollouts-before.json"), "utf8");
  assert.equal(beforeSnap, "[]", "the snapshot lists the rollouts that stood before the spawn");
  const limit = codex.args.find((x) => x.startsWith("model_auto_compact_token_limit="));
  assert.ok(Number(limit.split("=")[1]) < COMPACT_LIMIT, "the canary runs under a lowered limit so compaction can fire");
  // the check
  const dir = join(w.home, ".codex", "sessions", "2026", "11", "04");
  mkdirSync(dir, { recursive: true });
  const marker = readFileSync(join(w.seatDir, "marker.txt"), "utf8").trim();
  assert.match(marker, /^SEAT-MARKER [0-9a-f-]{36}$/);
  assert.ok(codex.args.at(-1).startsWith(marker), "the marker rides the prompt");
  writeFileSync(join(dir, "rollout-x.jsonl"), `${cevent({ timestamp: "2026-11-04T10:00:00Z", type: "session_meta", payload: { cwd: realpathSync(w.seatDir) } })}\n${cevent({ type: "response_item", payload: { type: "message", role: "user", content: [{ text: marker }] } })}\n${cevent({ type: "compacted", payload: {} })}\n`);
  const say = [];
  assert.equal(run(["--check-canary", "--seat-dir", w.seatDir], { readers: w.readers, log: (s) => say.push(s), err: (s) => say.push(s) }), 0);
  assert.match(say.join("\n"), /COMPACTION-FIRED/);
  // the pre-spawn snapshot: a rollout listed before the launch never counts, and a canary that did not compact exits 1
  const dir2 = join(w.home, ".codex", "sessions", "2026", "11", "04");
  writeFileSync(join(w.seatDir, "rollouts-before.json"), JSON.stringify([join(dir2, "rollout-x.jsonl")]));
  writeFileSync(join(dir2, "rollout-y.jsonl"), `${cevent({ timestamp: "2026-11-04T11:00:00Z", type: "session_meta", payload: { cwd: realpathSync(w.seatDir) } })}\n${cevent({ type: "response_item", payload: { type: "message", role: "user", content: [{ text: marker }] } })}\n`);
  const say3 = [];
  assert.equal(run(["--check-canary", "--seat-dir", w.seatDir], { readers: w.readers, log: (s) => say3.push(s), err() {} }), 1);
  assert.match(say3.join("\n"), /COMPACTION-NOT-FIRED/);
  const none = world();
  mkdirSync(join(none.home, ".codex", "sessions"), { recursive: true });
  const say2 = [];
  assert.equal(run(["--check-canary", "--seat-dir", none.seatDir], { readers: none.readers, log: (s) => say2.push(s), err: (s) => say2.push(s) }), 2);
  assert.match(say2.join("\n"), /no rollout/);
});

// ---- row 4: the fresh-per-step lead ----
test("row 4: --lead-step reads the lane state, bumps the step, writes the step brief, launches a LEAD with the lane root added and the lead ceiling; a missing state refuses", () => {
  const w = world();
  const laneRoot = join(w.home, ".lares-scratch", "lane");
  const readers = { ...w.readers, gitCommonDir: () => "/git-common" };
  const spawned = [];
  const spawn = (cmd, args, opts) => { spawned.push({ cmd, args, opts }); return { pid: 7, unref() {} }; };
  const argv = ["--lead-step", "--lane-root", laneRoot, "--model", "gpt-6.1-terra", "--effort", "high", "--worktree", w.wt];
  const err = [];
  assert.equal(run(argv, { readers, spawn, log() {}, err: (s) => err.push(s) }), 2);
  assert.match(err.join("\n"), /no state\.json/);
  assert.equal(spawned.length, 0);
  writeFileSync(join(laneRoot, "state.json"), JSON.stringify({ head: "e6aa31a8e", owed: ["row 5"], seats: [], worktrees: {}, next: "do row 5", step: 3 }));
  assert.equal(run(argv, { readers, spawn, log() {} }), 0);
  const stepDir = join(realpathSync(laneRoot), "steps", "step-004");
  CURRENT = { seatDir: stepDir };
  const codex = codexOf(spawned);
  assert.ok(!codex.args.includes(stepDir), "the lane step dir is NOT an argument: Codex works in a broker-owned dir");
  assert.ok(codex.args.some((a) => /lares-broker\/seats\/seat-[A-Za-z0-9]+$/.test(a)), "the broker-owned seat dir rides --add-dir");
  assert.ok(codex.args.includes(realpathSync(laneRoot)), "the lane root rides --add-dir so the lead can write state.json");
  assert.ok(codex.args.includes("sandbox_workspace_write.network_access=false") && !codex.args.some((a) => /^\/.*(\.git|git-common)/.test(a) && a !== stepDir), "a lead step carries no git dir and no network flag");
  assert.match(readFileSync(join(stepDir, "brief.md"), "utf8"), /do row 5/);
  assert.match(readFileSync(join(stepDir, "brief.md"), "utf8"), /^## LEAD LAW/m);
  assert.equal(JSON.parse(readFileSync(join(laneRoot, "state.json"), "utf8")).step, 4);
  const dog = sup(spawned);
  assert.equal(dog.args[dog.args.indexOf("--ceiling") + 1], "15000000", "a step is bounded by the lead ceiling");
});

test("row 4: a refused launch does not spend a step; --lead-step needs --lane-root", () => {
  const w = world({ rolloutLines: () => [rate(95)] });
  const laneRoot = join(w.home, ".lares-scratch", "lane");
  writeFileSync(join(laneRoot, "state.json"), JSON.stringify({ head: "e6aa31a8e", owed: [], seats: [], worktrees: {}, next: "x", step: 0 }));
  const err = [];
  assert.equal(run(["--lead-step", "--lane-root", laneRoot, "--model", "gpt-6.1-terra", "--effort", "high", "--worktree", w.wt], { readers: { ...w.readers, gitCommonDir: () => "/g" }, spawn() { throw new Error("spawned"); }, log() {}, err: (s) => err.push(s) }), 2);
  assert.equal(JSON.parse(readFileSync(join(laneRoot, "state.json"), "utf8")).step, 0);
  assert.equal(run(["--lead-step", "--model", "m", "--effort", "high", "--worktree", w.wt], { readers: w.readers, log() {}, err() {} }), 2);
});

test("row 4: a --lead-step dry run writes nothing and spends no step; a lane root outside scratch refuses before any write; a step dir already claimed refuses", () => {
  const w = world();
  const readers = { ...w.readers, gitCommonDir: () => "/g" };
  const laneRoot = join(w.home, ".lares-scratch", "lane");
  const st = { head: "e6aa31a8e", owed: [], seats: [], worktrees: {}, next: "x", step: 0 };
  writeFileSync(join(laneRoot, "state.json"), JSON.stringify(st));
  const base = ["--lead-step", "--model", "gpt-6.1-terra", "--effort", "high", "--worktree", w.wt];
  const out = [];
  assert.equal(run([...base, "--lane-root", laneRoot, "--dry-run"], { readers, log: (s) => out.push(s), err() {}, spawn() { throw new Error("spawned"); } }), 0);
  assert.match(out.join("\n"), /DRY-RUN/);
  assert.throws(() => readFileSync(join(laneRoot, "steps", "step-001", "brief.md")));
  assert.equal(JSON.parse(readFileSync(join(laneRoot, "state.json"), "utf8")).step, 0);
  const outside = mkdtempSync(join(tmpdir(), "outside-lane-"));
  writeFileSync(join(outside, "state.json"), JSON.stringify(st));
  const err = [];
  assert.equal(run([...base, "--lane-root", outside], { readers, log() {}, err: (s) => err.push(s), spawn() { throw new Error("spawned"); } }), 2);
  assert.match(err.join("\n"), /lane root must sit under/);
  assert.throws(() => readFileSync(join(outside, "steps", "step-001", "brief.md")));
  mkdirSync(join(laneRoot, "steps", "step-001"), { recursive: true });
  const err2 = [];
  assert.equal(run([...base, "--lane-root", laneRoot], { readers, log() {}, err: (s) => err2.push(s), spawn() { throw new Error("spawned"); } }), 2);
  assert.match(err2.join("\n"), /already claimed/);
});

test("P1-3 the supervisor is the seat's parent: the launcher spawns ONE detached supervisor that carries the marker, the snapshot, the prompt file and the codex argv; it reads no start tick and passes no pid", () => {
  const w = world();
  const spawned = [];
  const spawn = (cmd, args, opts) => { spawned.push({ cmd, args, opts }); return { pid: 4242, unref() {} }; };
  const argv = ["--mode", "build", "--model", "gpt-6.1-terra", "--effort", "high", "--seat-dir", w.seatDir, "--worktree", w.wt];
  assert.equal(run(argv, { readers: w.readers, spawn, log() {} }), 0);
  assert.equal(spawned.length, 1, "no separate watchdog and no direct codex spawn");
  const s = sup(spawned);
  assert.equal(s.opts.detached, true);
  assert.equal(s.args[s.args.indexOf("--marker") + 1], readFileSync(join(w.seatDir, "marker.txt"), "utf8").trim());
  assert.ok(readFileSync(join(w.seatDir, "prompt.txt"), "utf8").startsWith("SEAT-MARKER "));
  assert.equal(s.opts.stdio[3] > 2, true, "the held seat directory rides down as an inherited fd");
  assert.ok(!s.args.includes("--pid") && !s.args.includes("--born"));
  assert.ok(!readFileSync(new URL("./launch-codex.mjs", import.meta.url), "utf8").includes("startTick"), "no post-spawn start-tick read remains");
});

/** A scratch lane for the live supervisor tests: a held seat dir with a prompt, a snapshot and a rollout; returns the pieces. */
function liveSeat(stubBody, rolloutLines) {
  const dir = mkdtempSync(join(tmpdir(), "sup-"));
  const home = join(dir, "home"), seat = join(dir, "seat"), lane = join(dir, "lane"), sess = join(home, ".codex", "sessions", "2026", "11", "04"); mkdirSync(sess, { recursive: true }); mkdirSync(seat); mkdirSync(lane);
  const bin = join(dir, "bin"); mkdirSync(bin);
  writeFileSync(join(bin, "codex"), `#!/bin/sh\n${stubBody}\n`, { mode: 0o755 });
  writeFileSync(join(seat, "prompt.txt"), "SEAT-MARKER live\n\nbrief"); writeFileSync(join(seat, "rollouts-before.json"), "[]");
  const roll = join(sess, "rollout-live.jsonl");
  writeFileSync(roll, rolloutLines(roll));
  return { dir, home, seat, lane, bin, roll, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, HOME: home, ROLL: roll } };
}
const userLine = () => `${cevent({ type: "response_item", payload: { type: "message", role: "user", content: [{ text: "SEAT-MARKER live\n\nbrief" }] } })}\n`;
const cli = (L, extra = []) => { const fd = openSync(L.seat, "r"), lfd = openSync(L.lane, "r"); try { return spawnSync(process.execPath, [TOOL, "--supervise", "--held-fd", "3", "--lane-fd", "4", "--bsd-path", L.seat, "--ceiling", "100", "--mode", "read", "--marker", "SEAT-MARKER live", "--home", L.home, ...extra, "--", "exec"], { encoding: "utf8", timeout: 40000, env: L.env, stdio: ["ignore", "pipe", "pipe", fd, lfd] }); } finally { closeSync(fd); closeSync(lfd); } };

function ceilingOutputSeat(delay = "") {
  // Output precedes the token event that authorizes the supervisor to stop the group.
  const body = `${delay}echo $$ > "$STUB_PID"\necho STUB-OUTPUT\ncat >> "$ROLL" <<'ROLLOUT'\n${userLine()}${tc(900)}\nROLLOUT\nsleep 60`;
  const L = liveSeat(body, () => "");
  L.env.STUB_PID = join(L.dir, "stub.pid");
  try {
    const r = cli(L); // Wait for the supervisor to exit before reading its files.
    assert.equal(r.status, 0, r.stderr);
    assert.match(readFileSync(join(L.lane, "ceiling.md"), "utf8"), /900 total tokens/);
    assert.match(readFileSync(join(L.lane, "run.log"), "utf8"), /STUB-OUTPUT/, "the child's output landed in run.log through the held fd");
  } finally {
    if (existsSync(L.env.STUB_PID)) {
      const pid = Number(readFileSync(L.env.STUB_PID, "utf8").trim());
      try { killGroup(pid, "SIGKILL"); } catch (e) { if (e.code !== "ESRCH") throw e; }
    }
  }
}

test("P1-3 a seat that sleeps past its ceiling is stopped by its parent: the supervisor kills its OWN child group and writes ceiling.md through the held directory (live, stub codex)", () => {
  ceilingOutputSeat();
});

test("P1-3 a slow stub emits output before its ceiling event", () => {
  ceilingOutputSeat("sleep 1\n");
});

test("P1-4 findRollout parses JSONL events with no byte cap: a prompt past 256 KiB still binds; an echoed marker or a non-user event never does", () => {
  const home = mkdtempSync(join(tmpdir(), "rollouts-"));
  const dir = join(home, ".codex", "sessions", "2026", "11", "04"); mkdirSync(dir, { recursive: true });
  const before = new Set();
  const big = join(dir, "rollout-big.jsonl");
  writeFileSync(big, `${cevent({ type: "session_meta", payload: { cwd: "/x", base_instructions: "y".repeat(400000) } })}\n${cevent({ type: "response_item", payload: { type: "message", role: "user", content: [{ text: "SEAT-MARKER deep\n\nbrief" }] } })}\n`);
  assert.equal(findRollout(home, { marker: "SEAT-MARKER deep", before }), big, "a prompt after 400 KB of preamble binds");
  const asst = join(dir, "rollout-asst.jsonl");
  writeFileSync(asst, `${cevent({ type: "session_meta", payload: { cwd: "/x" } })}\n${cevent({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ text: "SEAT-MARKER asst" }] } })}\n`);
  assert.equal(findRollout(home, { marker: "SEAT-MARKER asst", before }), null, "an assistant message is no prompt");
  const nolf = join(dir, "rollout-partial.jsonl");
  writeFileSync(nolf, cevent({ type: "response_item", payload: { type: "message", role: "user", content: [{ text: "SEAT-MARKER partial" }] } }));
  assert.equal(findRollout(home, { marker: "SEAT-MARKER partial", before }), null, "a prompt line not yet complete reads as not yet");
});

test("P1-4 the supervisor fails closed: a seat with no token reading for blindTicks ticks is stopped and named", async () => {
  const seatDir = mkdtempSync(join(tmpdir(), "blind-"));
  const signals = []; let up = true;
  const r = await watchSeat({ seatDir, note: (t) => writeFileSync(join(seatDir, "ceiling.md"), t), pid: 5, ceiling: 1e9, mode: "build", tokens: () => null, alive: () => up, kill: (s) => { signals.push(s); up = false; }, sleep: async () => {}, blindTicks: 3, graceTicks: 1 });
  assert.equal(r, "blind"); assert.deepEqual(signals, ["SIGTERM"]);
  assert.match(readFileSync(join(seatDir, "ceiling.md"), "utf8"), /no new token event.*failing closed/s);
  let n = 0;
  const ok = await watchSeat({ note: () => {}, pid: 5, ceiling: 1e9, mode: "build", tokens: () => (n++ < 2 ? null : 5), alive: () => n < 10, kill() { throw new Error("killed"); }, sleep: async () => {}, blindTicks: 3 });
  assert.equal(ok, "exited", "CONTROL a reading that appears in time resets the count");
});

test("P1-4 tokenTail reads only the bytes appended since its last call and holds a partial line until it completes", () => {
  const dir = mkdtempSync(join(tmpdir(), "tail-")), f = join(dir, "rollout.jsonl");
  writeFileSync(f, `${tc(10)}\n`);
  const tail = tokenTail(f);
  assert.equal(tail(), 10);
  appendFileSync(f, `${tc(20)}\n${tc(30)}`);
  assert.equal(tail(), 20, "a line not yet newline-terminated waits"); assert.equal(tail.fresh, true);
  appendFileSync(f, "\n");
  assert.equal(tail(), 30); assert.equal(tail.fresh, true);
  assert.equal(tail(), 30, "nothing new reads the same total"); assert.equal(tail.fresh, false, "a re-read of the last total is stale");
});

test("P1-4 findRollout remembers the rollouts whose prompt carries another marker and skips them next tick", () => {
  const home = mkdtempSync(join(tmpdir(), "rollouts-")), dir = join(home, ".codex", "sessions", "2026", "11", "04"); mkdirSync(dir, { recursive: true });
  const other = join(dir, "rollout-other.jsonl");
  writeFileSync(other, `${cevent({ type: "response_item", payload: { type: "message", role: "user", content: [{ text: "SEAT-MARKER other" }] } })}\n`);
  const seen = new Set();
  assert.equal(findRollout(home, { marker: "SEAT-MARKER mine", before: new Set(), seen }), null);
  assert.ok(seen.has(other), "decided: never re-read");
  const mine = join(dir, "rollout-mine.jsonl");
  writeFileSync(mine, `${cevent({ type: "response_item", payload: { type: "message", role: "user", content: [{ text: "SEAT-MARKER mine" }] } })}\n`);
  assert.equal(findRollout(home, { marker: "SEAT-MARKER mine", before: new Set(), seen }), mine);
});

test("P1-4 a STALE reading never resets the blind counter: token events stop while the seat lives and the supervisor stops it at the blind limit", async () => {
  const seatDir = mkdtempSync(join(tmpdir(), "stale-"));
  const signals = []; let up = true, n = 0;
  const r = await watchSeat({ seatDir, note: (t) => writeFileSync(join(seatDir, "ceiling.md"), t), pid: 5, ceiling: 1e9, mode: "build", tokens: () => 500, advanced: () => n++ < 2, alive: () => up, kill: (s) => { signals.push(s); up = false; }, sleep: async () => {}, blindTicks: 4, graceTicks: 1 });
  assert.equal(r, "blind"); assert.deepEqual(signals, ["SIGTERM"]);
  assert.match(readFileSync(join(seatDir, "ceiling.md"), "utf8"), /no new token event.*stale/s);
});

test("P1-3 a rollout read error fails closed: any error while watching stops the seat's group and names the error; CONTROL a healthy watch stops nothing", async () => {
  const seatDir = mkdtempSync(join(tmpdir(), "err-"));
  const signals = []; let up = true, n = 0;
  const r = await watchSeat({ seatDir, note: (t) => writeFileSync(join(seatDir, "ceiling.md"), t), pid: 5, ceiling: 1e9, mode: "build", tokens: () => { if (n++ > 1) throw new Error("EACCES: rollout unreadable"); return 5; }, alive: () => up, kill: (s) => { signals.push(s); up = false; }, sleep: async () => {}, graceTicks: 1 });
  assert.equal(r, "error"); assert.deepEqual(signals, ["SIGTERM"]);
  assert.match(readFileSync(join(seatDir, "ceiling.md"), "utf8"), /EACCES: rollout unreadable.*failing closed/s);
  let m = 0;
  const ok = await watchSeat({ note: () => {}, pid: 5, ceiling: 1e9, mode: "build", tokens: () => 5, alive: () => m++ < 3, kill() { throw new Error("killed"); }, sleep: async () => {} });
  assert.equal(ok, "exited");
});

test("P1-3 live: a rollout that turns unreadable mid-run stops the stub seat through the real supervisor", () => {
  const L = liveSeat("sleep 2\nchmod 000 \"$ROLL\"\nsleep 60", () => `${userLine()}${tc(5)}\n`);
  writeFileSync(join(L.bin, "codex"), `#!/bin/sh\nsleep 2\nchmod 000 '${L.roll}'\nsleep 60\n`, { mode: 0o755 });
  const r = cli(L, []);
  assert.equal(r.status, 1, "an error verdict exits 1");
  assert.match(readFileSync(join(L.lane, "ceiling.md"), "utf8"), /could not be watched.*failing closed/s);
});

test("P1-4 an unchanged total is no progress: a token event that repeats the last total leaves the tail stale", () => {
  const dir = mkdtempSync(join(tmpdir(), "tail-")), f = join(dir, "rollout.jsonl");
  writeFileSync(f, `${tc(10)}\n`);
  const tail = tokenTail(f);
  assert.equal(tail(), 10); assert.equal(tail.fresh, true);
  appendFileSync(f, `${tc(10)}\n`);
  assert.equal(tail(), 10); assert.equal(tail.fresh, false, "the same total again is stale");
  appendFileSync(f, `${tc(11)}\n`);
  assert.equal(tail(), 11); assert.equal(tail.fresh, true);
});

test("P1-3 a stop that throws part-way still runs every step: kill failures neither reject the watch nor skip ceiling.md", async () => {
  const seatDir = mkdtempSync(join(tmpdir(), "stopthrow-"));
  let up = true;
  const r = await watchSeat({ seatDir, note: (t) => writeFileSync(join(seatDir, "ceiling.md"), t), pid: 5, ceiling: 10, mode: "build", tokens: () => 50, alive: () => up, kill: () => { throw new Error("EPERM"); }, sleep: async () => { up = false; }, graceTicks: 2 });
  assert.equal(r, "ceiling");
  assert.match(readFileSync(join(seatDir, "ceiling.md"), "utf8"), /50 total tokens/);
});

// ======================= Terra round 4: held output, a stop that completes, the blind option =======================
import { superviseSeat } from "./launch-codex.mjs";
import { copyBack } from "./held-dir.mjs";
import { heldOver, openHeldSync } from "./held-dir.mjs";
import { chmodSync, existsSync, linkSync, readdirSync, renameSync, statSync } from "node:fs";

const spawnMock = () => { const spawned = []; return { spawned, spawn: (cmd, args, opts) => { spawned.push({ cmd, args, opts }); return { pid: 4242, unref() {} }; } }; };
const launchArgs = (w) => ["--mode", "build", "--model", "gpt-6.1-terra", "--effort", "high", "--seat-dir", w.seatDir, "--worktree", w.wt];

test("P1-1 a file symlink planted at ANY launcher output name refuses by name and writes nothing outside; CONTROL the clean dir launches", () => {
  for (const name of ["attempts.log", "rollouts-before.json", "marker.txt", "prompt.txt", "brief.md"]) {
    const w = world();
    const outside = join(w.home, `outside-${name}`); writeFileSync(outside, "UNTOUCHED");
    rmSync(join(w.seatDir, name), { force: true }); symlinkSync(outside, join(w.seatDir, name));
    const { spawn } = spawnMock(); const err = [];
    assert.equal(run(launchArgs(w), { readers: w.readers, spawn, log() {}, err: (e) => err.push(e) }), 2, name);
    assert.match(err.join("\n"), /SEAT-REFUSED.*symlink/s, name);
    assert.equal(readFileSync(outside, "utf8"), "UNTOUCHED", `${name}: the outside target stands`);
  }
  const w = world(), { spawn } = spawnMock();
  assert.equal(run(launchArgs(w), { readers: w.readers, spawn, log() {} }), 0);
});

test("P1-1 a file hard-linked to an outside file at an output name refuses before it is truncated", () => {
  const w = world();
  const outside = join(w.home, "outside-hard"); writeFileSync(outside, "UNTOUCHED");
  linkSync(outside, join(w.seatDir, "marker.txt"));
  const { spawn } = spawnMock(); const err = [];
  assert.equal(run(launchArgs(w), { readers: w.readers, spawn, log() {}, err: (e) => err.push(e) }), 2);
  assert.match(err.join("\n"), /hard-linked/);
  assert.equal(readFileSync(outside, "utf8"), "UNTOUCHED");
});

test("P1-1 a seat dir swapped for a symlink AFTER validation redirects nothing: every write lands in the held directory", () => {
  const w = world();
  const outside = join(w.home, "outside-dir"); mkdirSync(outside);
  const moved = `${w.seatDir}-moved`;
  const readers = { ...w.readers, afterHold: () => { renameSync(w.seatDir, moved); symlinkSync(outside, w.seatDir); } };
  const { spawn } = spawnMock();
  assert.equal(run(launchArgs(w), { readers, spawn, log() {}, err() {} }), 0);
  assert.deepEqual(readdirSync(outside), [], "nothing landed outside the lane");
  assert.ok(readdirSync(moved).includes("marker.txt") && readdirSync(moved).includes("prompt.txt"), "the held (moved) directory took the writes");
});

test("P1-1 the supervisor writes run.log and ceiling.md through the held fd: symlinks planted at both names redirect nothing", async () => {
  const L = liveSeat("sleep 60", () => `${userLine()}${tc(900)}\n`);
  const outside = join(L.dir, "outside"); writeFileSync(outside, "UNTOUCHED");
  symlinkSync(outside, join(L.seat, "run.log"));
  const held = openHeldSync(L.seat, L.dir);
  await assert.rejects(superviseSeat({ held, marker: "SEAT-MARKER live", home: L.home, ceiling: 100, mode: "read", rest: ["exec"], env: L.env }, { sleep: async () => {} }), /symlink/);
  rmSync(join(L.seat, "run.log"));
  symlinkSync(outside, join(L.seat, "ceiling.md"));
  const verdict = await superviseSeat({ held, marker: "SEAT-MARKER live", home: L.home, ceiling: 100, mode: "read", rest: ["exec"], env: L.env, graceTicks: 1, hardTicks: 2 }, { sleep: () => new Promise((r) => setTimeout(r, 30)) });
  assert.equal(verdict, "ceiling", "the stop ran although the note could not be written");
  assert.equal(readFileSync(outside, "utf8"), "UNTOUCHED");
  held.close();
});

test("P1-2 a stub child that ignores SIGTERM under a signal function that throws still ends dead, and ceiling.md was written BEFORE the stop began", async () => {
  const pidf = join(tmpdir(), "stub-pid-" + process.pid), kidf = join(tmpdir(), "stub-kid-" + process.pid);
  const L = liveSeat("true", () => `${userLine()}${tc(5)}\n`);
  // The stub records both pids FIRST, then lifts the rollout over the ceiling, so the test never races the stub's start.
  writeFileSync(join(L.bin, "codex"), `#!/bin/sh\ntrap '' TERM\necho $$ > '${pidf}'\n(trap '' TERM; echo $$ > '${kidf}'; while true; do sleep 1; done) &\nwhile [ ! -s '${kidf}' ]; do sleep 0.1; done\necho '${tc(900)}' >> '${L.roll}'\nwhile true; do sleep 1; done\n`, { mode: 0o755 });
  const held = openHeldSync(L.seat, L.dir);
  const signals = [];
  const verdict = await superviseSeat({ held, marker: "SEAT-MARKER live", home: L.home, ceiling: 100, mode: "read", rest: ["exec"], env: L.env, graceTicks: 1, hardTicks: 2 }, { sleep: () => new Promise((r) => setTimeout(r, 60)), signal: (pid, sig) => { signals.push(sig); throw new Error("EPERM"); } });
  assert.equal(signals[0], "SIGTERM"); assert.ok(signals.slice(1).length >= 1 && signals.slice(1).every((x) => x === "SIGKILL"), "SIGTERM first, then only SIGKILLs, every one of which threw");
  assert.equal(verdict, "unstopped", "with every group signal throwing, a descendant that ignores SIGTERM keeps the group alive: never read as stopped");
  assert.match(readFileSync(join(L.seat, "ceiling.md"), "utf8"), /900 total tokens/);
  const pid = Number(readFileSync(join(tmpdir(), "stub-pid-" + process.pid), "utf8").trim());
  assert.throws(() => process.kill(pid, 0), /ESRCH/, "the supervisor SIGKILLed its own child through the handle bound to it");
  const kid = Number(readFileSync(join(tmpdir(), "stub-kid-" + process.pid), "utf8").trim());
  assert.ok(kid > 1 && kid !== process.pid); try { process.kill(kid, "SIGKILL"); } catch { /* already gone */ } // cleanup of a descendant: a real pid read from the stub, inside the test namespace
  held.close(); rmSync(join(tmpdir(), "stub-pid-" + process.pid), { force: true }); rmSync(join(tmpdir(), "stub-kid-" + process.pid), { force: true });
});

test("P1-2 watchSeat writes the note before any signal, and 'unstopped' is the verdict while the child lives; CONTROL a child that dies on SIGTERM reads as stopped", async () => {
  const order = [];
  let up = true;
  const r = await watchSeat({ pid: 4242, ceiling: 1, mode: "build", tokens: () => 5, alive: () => up, kill: (s) => { order.push(`kill:${s}`); throw new Error("EPERM"); }, note: () => order.push("note"), sleep: async () => {}, graceTicks: 1, hardTicks: 1 });
  assert.equal(r, "unstopped"); assert.deepEqual(order, ["note", "kill:SIGTERM", "kill:SIGKILL"]);
  const ok = await watchSeat({ pid: 4242, ceiling: 1, mode: "build", tokens: () => 5, alive: () => up, kill: () => { up = false; }, note() {}, sleep: async () => {}, graceTicks: 1, hardTicks: 1 });
  assert.equal(ok, "ceiling");
});

test("the blind limit is a launcher option: --blind-ticks N rides to the supervisor, the default stays 200, junk refuses", () => {
  const w = world(), { spawn, spawned } = spawnMock();
  assert.equal(run([...launchArgs(w), "--blind-ticks", "7"], { readers: w.readers, spawn, log() {} }), 0);
  const s = sup(spawned); assert.equal(s.args[s.args.indexOf("--blind-ticks") + 1], "7");
  spawned.length = 0;
  assert.equal(run(launchArgs(w), { readers: w.readers, spawn, log() {} }), 0);
  assert.ok(!sup(spawned).args.includes("--blind-ticks"), "no option, the 200-tick default");
  assert.equal(run([...launchArgs(w), "--blind-ticks", "x"], { readers: w.readers, spawn, log() {}, err() {} }), 2);
});

// ======================= Terra round 5: the structural cure =======================
test("P1 Codex's own outputs land in a broker-owned dir and reach the lane only through the held hand-back: a lane seat dir swapped after launch, before exit, redirects nothing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bsd-"));
  const home = join(dir, "home"), lane = join(dir, "lane"), bsd = join(dir, "broker", "seat-1"), outside = join(dir, "outside");
  mkdirSync(join(home, ".codex", "sessions", "2026", "11", "04"), { recursive: true }); mkdirSync(lane); mkdirSync(bsd, { recursive: true }); mkdirSync(outside);
  const bin = join(dir, "bin"); mkdirSync(bin);
  writeFileSync(join(bin, "codex"), `#!/bin/sh\nsleep 1\necho HANDBACK > final.md\necho ${"$"}PWD > cwd.txt\n`, { mode: 0o755 });
  writeFileSync(join(bsd, "prompt.txt"), "SEAT-MARKER p\n\nbrief"); writeFileSync(join(bsd, "rollouts-before.json"), "[]");
  const held = openHeldSync(bsd, join(dir, "broker")), laneHeld = openHeldSync(lane, dir);
  const moved = join(dir, "lane-moved");
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, HOME: home };
  const run1 = superviseSeat({ held, laneHeld, marker: "SEAT-MARKER p", home, ceiling: 1e9, mode: "read", rest: ["exec"], env }, { sleep: () => new Promise((r) => setTimeout(r, 100)), pollMs: 20 });
  renameSync(lane, moved); symlinkSync(outside, lane); // the swap, while the child still runs
  const verdict = await run1;
  assert.equal(verdict, "exited");
  assert.deepEqual(readdirSync(outside), [], "nothing reached the swapped path's target");
  assert.equal(readFileSync(join(bsd, "final.md"), "utf8"), "HANDBACK\n", "Codex wrote final.md into the broker-owned dir");
  assert.equal(readFileSync(join(moved, "final.md"), "utf8"), "HANDBACK\n", "the hand-back landed in the HELD lane dir");
  assert.equal(readFileSync(join(bsd, "cwd.txt"), "utf8").trim(), realpathSync(bsd), "Codex ran in the broker-owned dir");
  held.close(); laneHeld.close();
});

test("P1 the hand-back copies only regular files under the cap and replaces a planted symlink at its name; CONTROL a clean copy lands", () => {
  const dir = mkdtempSync(join(tmpdir(), "hb-")), outside = join(dir, "outside"); writeFileSync(outside, "UNTOUCHED");
  const bsd = join(dir, "bsd"), lane = join(dir, "lane"); mkdirSync(bsd); mkdirSync(lane);
  writeFileSync(join(bsd, "final.md"), "ok"); symlinkSync(outside, join(lane, "final.md"));
  writeFileSync(join(bsd, "big.log"), Buffer.alloc(9 * 1024 * 1024, 65)); symlinkSync(outside, join(bsd, "link.md")); mkdirSync(join(bsd, "sub")); writeFileSync(join(bsd, "prompt.txt"), "input");
  const names = copyBack(openHeldSync(bsd, dir), openHeldSync(lane, dir));
  assert.deepEqual(names.sort(), ["big.log", "final.md"]);
  assert.equal(readFileSync(outside, "utf8"), "UNTOUCHED", "the planted symlink was replaced, never followed");
  assert.equal(readFileSync(join(lane, "final.md"), "utf8"), "ok");
  assert.match(readFileSync(join(lane, "big.log"), "utf8").slice(-60), /truncated at 8388608 bytes/);
  assert.equal(existsSync(join(lane, "link.md")) || existsSync(join(lane, "sub")) || existsSync(join(lane, "prompt.txt")), false, "symlinks, directories and lane-owned inputs never copy");
});

test("P1 lead steps go through a held lane root: a `steps` entry swapped for a symlink refuses, and a lane root swapped after the hold writes into the held root, never outside", () => {
  const mk = () => { const w = world(); const laneRoot = join(w.home, ".lares-scratch", "lane"); writeFileSync(join(laneRoot, "state.json"), JSON.stringify({ head: "e6aa31a8e", owed: [], seats: [], worktrees: {}, next: "x", step: 0 })); return { w, laneRoot }; };
  const argvFor = (w, laneRoot) => ["--lead-step", "--lane-root", laneRoot, "--model", "gpt-6.1-terra", "--effort", "high", "--worktree", w.wt];
  { // the steps entry is a symlink to an outside dir
    const { w, laneRoot } = mk(); const outside = join(w.home, "out1"); mkdirSync(outside);
    symlinkSync(outside, join(laneRoot, "steps"));
    const err = []; const { spawn } = spawnMock();
    assert.equal(run(argvFor(w, laneRoot), { readers: w.readers, spawn, log() {}, err: (e) => err.push(e) }), 2);
    assert.match(err.join("\n"), /not a real directory/); assert.deepEqual(readdirSync(outside), []);
  }
  { // the lane root itself is swapped after the hold
    const { w, laneRoot } = mk(); const outside = join(w.home, "out2"); mkdirSync(outside); const moved = `${laneRoot}-moved`;
    const readers = { ...w.readers, afterLaneHold: () => { renameSync(laneRoot, moved); symlinkSync(outside, laneRoot); } };
    const { spawn } = spawnMock();
    run(argvFor(w, laneRoot), { readers, spawn, log() {}, err() {} });
    assert.deepEqual(readdirSync(outside), [], "nothing landed outside");
  }
  { // CONTROL
    const { w, laneRoot } = mk(); const { spawn } = spawnMock();
    assert.equal(run(argvFor(w, laneRoot), { readers: w.readers, spawn, log() {} }), 0);
    assert.equal(JSON.parse(readFileSync(join(laneRoot, "state.json"), "utf8")).step, 1);
  }
});

test("P1 WITNESS: no fs write in launch-codex.mjs or lane-state.mjs names a pathname; each goes through a held handle (.at) or carries the broker-owned mark", () => {
  const writes = /\b(writeFileSync|appendFileSync|mkdirSync|renameSync|copyFileSync|unlinkSync|rmSync|symlinkSync|ftruncateSync)\(|\bopenSync\([^)]*(["']w["']|["']a["']|O_WRONLY|O_CREAT)/;
  for (const f of ["launch-codex.mjs", "lane-state.mjs"]) {
    const bad = readFileSync(new URL(`./${f}`, import.meta.url), "utf8").split("\n").map((l, i) => [i + 1, l]).filter(([, l]) => writes.test(l) && !/\.at\(|\/\/ broker-owned/.test(l));
    assert.deepEqual(bad.map(([i, l]) => `${f}:${i} ${l.trim().slice(0, 90)}`), [], `${f} writes by pathname`);
  }
  // KNOWN POSITIVE: the witness reads a planted pathname write
  assert.ok(writes.test('  writeFileSync(join(seatDir, "x"), "y");') && !/\.at\(|\/\/ broker-owned/.test('  writeFileSync(join(seatDir, "x"), "y");'));
});

test("P1-2 a child that exits promptly on SIGTERM leaving a SIGTERM-ignoring grandchild: the group is killed on the exit and the verdict waits for it; CONTROL a group that never empties reads unstopped", async () => {
  const kid = join(tmpdir(), "p2-kid-" + process.pid);
  const L = liveSeat("true", () => `${userLine()}${tc(5)}\n`);
  // The stub starts the SIGTERM-ignoring grandchild, WAITS until it has written its pid, and only then lifts the rollout over the ceiling.
  writeFileSync(join(L.bin, "codex"), `#!/bin/sh\ntrap 'exit 0' TERM\n(trap '' TERM; echo $$ > '${kid}'; while true; do sleep 1; done) &\nwhile [ ! -s '${kid}' ]; do sleep 0.1; done\necho '${tc(900)}' >> '${L.roll}'\nwhile true; do sleep 1; done\n`, { mode: 0o755 });
  const held = openHeldSync(L.seat, L.dir);
  const verdict = await superviseSeat({ held, marker: "SEAT-MARKER live", home: L.home, ceiling: 100, mode: "read", rest: ["exec"], env: L.env, graceTicks: 3, hardTicks: 3 }, { sleep: () => new Promise((r) => setTimeout(r, 80)), pollMs: 20 });
  assert.equal(verdict, "ceiling");
  const pid = Number(readFileSync(kid, "utf8").trim());
  assert.throws(() => process.kill(pid, 0), /ESRCH/, "the grandchild ended dead when its parent's exit landed");
  held.close(); rmSync(kid, { force: true });
  const L2 = liveSeat("exit 0", () => `${userLine()}${tc(1)}\n`);
  const held2 = openHeldSync(L2.seat, L2.dir);
  const v2 = await superviseSeat({ held: held2, marker: "SEAT-MARKER live", home: L2.home, ceiling: 1e9, mode: "read", rest: ["exec"], env: L2.env }, { sleep: async () => {}, groupAlive: () => true, groupPolls: 3, pollMs: 5 });
  assert.equal(v2, "unstopped", "a group that does not answer ESRCH never reads as stopped");
  held2.close();
});

test("P2 the generated lead law names every field the relay's commit schema accepts and no rejected one", () => {
  const src = readFileSync(new URL("./commit-relay.mjs", import.meta.url), "utf8");
  const accepted = JSON.parse(/commit: (\[[^\]]*\])/.exec(src)[1].replace(/'/g, '"')).filter((f) => f !== "kind");
  const law = leadLaw();
  for (const field of accepted) assert.ok(law.includes(`\`${field}\``), `the law names ${field}`);
  for (const rejected of ["messageFile", "message file", "messagePath"]) assert.ok(!law.includes(rejected), `the law never names ${rejected}`);
});

test("P1-1 the broker root is fixed and verified: a root under any scratch lane, a symlinked component, a group-writable ancestor and a 0755 root each refuse; CONTROL passes and creates the root 0700", () => {
  const attempt = (setup, env) => { const w = world(); const rootEnv = setup(w); const { spawn } = spawnMock(); const err = [];
    const code = run(launchArgs(w), { readers: { ...w.readers, brokerEnv: rootEnv ? { LARES_BROKER_ROOT: rootEnv } : {} }, spawn, log() {}, err: (e) => err.push(e) });
    return { code, err: err.join("\n"), w }; };
  const underLane = attempt((w) => join(w.home, ".lares-scratch", "otherlane", "seats"));
  assert.equal(underLane.code, 2); assert.match(underLane.err, /outside .*\.lares-scratch entirely/);
  const sym = attempt((w) => { const real = join(w.home, "realdir"); mkdirSync(real, { mode: 0o700 }); symlinkSync(real, join(w.home, "linked")); return join(w.home, "linked", "seats"); });
  assert.equal(sym.code, 2); assert.match(sym.err, /not a real directory/);
  const open = attempt((w) => { const r = join(w.home, "broker"); mkdirSync(r, { mode: 0o755 }); chmodSync(r, 0o755); return r; });
  assert.equal(open.code, 2); assert.match(open.err, /mode 0700/);
  const wide = attempt((w) => { const up = join(w.home, "wide"); mkdirSync(up); chmodSync(up, 0o777); const r = join(up, "seats"); mkdirSync(r, { mode: 0o700 }); return r; });
  assert.equal(wide.code, 2); assert.match(wide.err, /group- or world-writable/);
  const ok = attempt(() => undefined);
  assert.equal(ok.code, 0, ok.err);
  const root = join(realpathSync(ok.w.home), ".local/state/lares-broker/seats");
  assert.equal(statSync(root).mode & 0o777, 0o700, "created 0700");
  assert.equal(readdirSync(root).filter((n) => n.startsWith("seat-")).length, 1, "one seat dir stands");
});

test("P1-1 no CLI or request surface names a broker dir: --broker-dir is an unknown option", () => {
  const w = world(); const err = [];
  assert.equal(run([...launchArgs(w), "--broker-dir", "/x"], { readers: w.readers, spawn() {}, log() {}, err: (e) => err.push(e) }), 2);
  assert.match(err.join("\n"), /unknown option --broker-dir/);
  assert.doesNotMatch(readFileSync(new URL("./commit-relay.mjs", import.meta.url), "utf8"), /broker-dir/);
});

test("P2-5 a dry run creates nothing: an absent broker root stays absent", () => {
  const w = world(); const out = [];
  assert.equal(run([...launchArgs(w), "--dry-run"], { readers: w.readers, spawn() { throw new Error("spawned"); }, log: (s) => out.push(s) }), 0);
  assert.equal(existsSync(join(w.home, ".local")), false, "no broker root, no parent");
  assert.match(out.join("\n"), /DRY-RUN/);
});

test("P2-4 a refusal after the broker seat dir exists removes it, and a root over its size bound refuses by name", () => {
  const w = world();
  const { spawn } = spawnMock();
  writeFileSync(join(w.seatDir, "brief.md"), "# b\n"); symlinkSync("/etc/hostname", join(w.seatDir, "marker.txt"));
  assert.equal(run(launchArgs(w), { readers: w.readers, spawn, log() {}, err() {} }), 2);
  const root = join(realpathSync(w.home), ".local/state/lares-broker/seats");
  assert.deepEqual(readdirSync(root), [], "the refused launch left no broker seat dir");
  rmSync(join(w.seatDir, "marker.txt"));
  writeFileSync(join(root, "leftover.bin"), Buffer.alloc(1024 * 1024 * 3));
  const err = [];
  assert.equal(run(launchArgs(w), { readers: { ...w.readers, maxGb: 0.002 }, spawn, log() {}, err: (e) => err.push(e) }), 2);
  assert.match(err.join("\n"), /over the 0\.002 GB bound/);
});

test("P1-2 a launch refuses by name where no PID-namespace wall can stand, and a dry run still shows the argv", () => {
  const w = world(); const err = [];
  assert.equal(run(launchArgs(w), { readers: { ...w.readers, bwrap: false }, spawn() { throw new Error("spawned"); }, log() {}, err: (e) => err.push(e) }), 2);
  assert.match(err.join("\n"), /no wall available: refusing to launch the build seat.*uncontained/);
  assert.equal(run([...launchArgs(w), "--dry-run"], { readers: { ...w.readers, bwrap: false }, spawn() { throw new Error("spawned"); }, log() {} }), 0);
});

test("a refusal after the lead-step claim point spends no step: a bad broker dir refuses before the state is touched", () => {
  const w = world(); const laneRoot = join(w.home, ".lares-scratch", "lane");
  writeFileSync(join(laneRoot, "state.json"), JSON.stringify({ head: "e6aa31a8e", owed: [], seats: [], worktrees: {}, next: "x", step: 0 }));
  const { spawn } = spawnMock();
  assert.equal(run(["--lead-step", "--lane-root", laneRoot, "--model", "gpt-6.1-terra", "--effort", "high", "--worktree", w.wt, "--broker-dir", join(laneRoot, "bsd")], { readers: w.readers, spawn, log() {}, err() {} }), 2);
  assert.equal(JSON.parse(readFileSync(join(laneRoot, "state.json"), "utf8")).step, 0);
  assert.equal(existsSync(join(laneRoot, "bsd")), false, "the bad broker dir was never created");
  assert.equal(existsSync(join(laneRoot, "steps")), false);
});

test("the hand-back's 64-file cap counts only copyable names: 70 dotfiles never crowd out final.md", () => {
  const dir = mkdtempSync(join(tmpdir(), "hb2-")); const bsd = join(dir, "bsd"), lane = join(dir, "lane"); mkdirSync(bsd); mkdirSync(lane);
  for (let i = 0; i < 70; i++) writeFileSync(join(bsd, `.a${i}`), "x");
  writeFileSync(join(bsd, "final.md"), "ok");
  assert.deepEqual(copyBack(openHeldSync(bsd, dir), openHeldSync(lane, dir)), ["final.md"]);
});

import { HAVE_BWRAP } from "./seat-walls.mjs";
import { moveAside } from "./held-dir.mjs";

/** A stub codex that starts a SIGTERM-ignoring descendant in its OWN session, waits, then lifts the rollout over the ceiling. */
function setsidSeat() {
  const L = liveSeat("true", () => `${userLine()}${tc(5)}\n`);
  writeFileSync(join(L.bin, "codex"), `#!/bin/sh\ntrap 'exit 0' TERM\ncat > "$0.kid" <<'EOF2'\n#!/bin/sh\ntrap '' TERM\nwhile true; do sleep 1; done\nEOF2\nchmod +x "$0.kid"\nsetsid "$0.kid" &\nsleep 1\necho '${tc(900)}' >> '${L.roll}'\nwhile true; do sleep 1; done\n`, { mode: 0o755 });
  return L;
}
const kidsOf = (L) => spawnSync("pgrep", ["-f", `${L.bin}/codex.kid`], { encoding: "utf8" }).stdout.trim();

wallTest("P1-2 CONTAINMENT: a descendant that setsid()s and ignores SIGTERM ends dead with the seat, because the seat runs in a PID namespace; the verdict reads off the namespace's end", async () => {
  const L = setsidSeat();
  const held = openHeldSync(L.seat, L.dir);
  const verdict = await superviseSeat({ held, marker: "SEAT-MARKER live", home: L.home, ceiling: 100, mode: "read", rest: ["exec"], env: L.env, contain: true, graceTicks: 3, hardTicks: 3 }, { sleep: () => new Promise((r) => setTimeout(r, 100)), pollMs: 20 });
  assert.equal(verdict, "ceiling");
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(existsSync(`${L.bin}/codex.kid`), true, "the descendant did start (the red is real)");
  assert.equal(kidsOf(L), "", "no process of the setsid descendant survives on the host");
  held.close();
});

test("P1-2 CONTROL without the namespace the same setsid descendant survives its parent (the process-group kill cannot reach it)", async () => {
  const L = setsidSeat();
  const held = openHeldSync(L.seat, L.dir);
  await superviseSeat({ held, marker: "SEAT-MARKER live", home: L.home, ceiling: 100, mode: "read", rest: ["exec"], env: L.env, contain: false, graceTicks: 3, hardTicks: 3 }, { sleep: () => new Promise((r) => setTimeout(r, 100)), pollMs: 20 });
  await new Promise((r) => setTimeout(r, 300));
  const found = kidsOf(L);
  spawnSync("pkill", ["-9", "-f", `${L.bin}/codex.kid`]);
  assert.notEqual(found, "", "uncontained, the setsid descendant outlives the seat (the red the namespace cures)");
  held.close();
});

test("P3 the hand-back filters to copyable names BEFORE the cap and copies final.md first: 70 directories and symlinks sorting ahead never crowd it out", () => {
  const dir = mkdtempSync(join(tmpdir(), "hb3-")); const bsd = join(dir, "bsd"), lane = join(dir, "lane"), out = join(dir, "out"); mkdirSync(bsd); mkdirSync(lane); writeFileSync(out, "x");
  for (let i = 0; i < 70; i++) { mkdirSync(join(bsd, `a-dir-${i}`)); symlinkSync(out, join(bsd, `b-link-${i}`)); }
  writeFileSync(join(bsd, "final.md"), "result");
  const names = copyBack(openHeldSync(bsd, dir), openHeldSync(lane, dir));
  assert.deepEqual(names, ["final.md"]);
});

test("P3 a reused lane seat dir moves its old hand-back aside into prev-<n>/, and the completion marker is written LAST: a wait on it never reads a stale result", async () => {
  const dir = mkdtempSync(join(tmpdir(), "done-"));
  const home = join(dir, "home"), bsd = join(dir, "bsd"), lane = join(dir, "lane"), sess = join(home, ".codex", "sessions", "2026", "11", "04"); mkdirSync(sess, { recursive: true }); mkdirSync(bsd); mkdirSync(lane);
  writeFileSync(join(lane, "final.md"), "STALE"); writeFileSync(join(lane, "ceiling.md"), "STALE-C");
  const laneHeld = openHeldSync(lane, dir);
  assert.deepEqual(moveAside(laneHeld).sort(), ["ceiling.md", "final.md"]);
  assert.equal(existsSync(join(lane, "final.md")), false);
  assert.equal(readFileSync(join(lane, "prev-1", "final.md"), "utf8"), "STALE");
  writeFileSync(join(lane, "final.md"), "STALE2");
  assert.deepEqual(moveAside(laneHeld), ["final.md"]); assert.ok(existsSync(join(lane, "prev-2", "final.md")), "a second run moves into prev-2");
  const bin = join(dir, "bin"); mkdirSync(bin); writeFileSync(join(bin, "codex"), "#!/bin/sh\necho FRESH > final.md\n", { mode: 0o755 });
  writeFileSync(join(bsd, "prompt.txt"), "SEAT-MARKER d\n\nb"); writeFileSync(join(bsd, "rollouts-before.json"), "[]");
  const held = openHeldSync(bsd, dir);
  await superviseSeat({ held, laneHeld, doneName: "done-abc", bsdPath: bsd, marker: "SEAT-MARKER d", home, ceiling: 1e9, mode: "read", rest: ["exec"], env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, HOME: home } }, { sleep: async () => {}, pollMs: 10 });
  const done = JSON.parse(readFileSync(join(lane, "done-abc"), "utf8"));
  assert.equal(done.finalMd, true); assert.ok(done.copied.includes("final.md"));
  assert.equal(readFileSync(join(lane, "final.md"), "utf8"), "FRESH\n");
  assert.ok(statSync(join(lane, "done-abc")).mtimeMs >= statSync(join(lane, "final.md")).mtimeMs, "the marker came after the hand-back");
  assert.equal(existsSync(bsd), false, "P2-4 the broker-owned seat dir is gone after the hand-back");
});

import { EventEmitter } from "node:events";

test("a containment command that fails before Codex runs reads setup-failed, not exited, and the marker names it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "setupfail-")); const bsd = join(dir, "bsd"), lane = join(dir, "lane"); mkdirSync(bsd); mkdirSync(lane); mkdirSync(join(dir, "home", ".codex", "sessions"), { recursive: true });
  writeFileSync(join(bsd, "prompt.txt"), "SEAT-MARKER s\n\nb"); writeFileSync(join(bsd, "rollouts-before.json"), "[]");
  const held = openHeldSync(bsd, dir), laneHeld = openHeldSync(lane, dir);
  const fake = () => { const e = new EventEmitter(); e.pid = 4242; e.kill = () => {}; setImmediate(() => e.emit("exit", 1)); return e; };
  const verdict = await superviseSeat({ held, laneHeld, doneName: "done-x", bsdPath: bsd, marker: "SEAT-MARKER s", home: join(dir, "home"), ceiling: 1e9, mode: "read", rest: [], contain: true }, { spawn: fake, sleep: () => new Promise((r) => setTimeout(r, 1)), groupAlive: () => false, signal: () => {} });
  assert.equal(verdict, "setup-failed");
  const done = JSON.parse(readFileSync(join(lane, "done-x"), "utf8"));
  assert.equal(done.verdict, "setup-failed"); assert.equal(done.exitCode, 1);
});

test("a hand-back that throws part-way still writes the completion marker, naming the error and the names already copied", async () => {
  const dir = mkdtempSync(join(tmpdir(), "partial-")); const bsd = join(dir, "bsd"), lane = join(dir, "lane"); mkdirSync(bsd); mkdirSync(lane); mkdirSync(join(dir, "home", ".codex", "sessions"), { recursive: true });
  writeFileSync(join(bsd, "prompt.txt"), "SEAT-MARKER s\n\nb"); writeFileSync(join(bsd, "rollouts-before.json"), "[]"); writeFileSync(join(bsd, "final.md"), "ok");
  const held = openHeldSync(bsd, dir), laneHeld = openHeldSync(lane, dir);
  const fake = () => { const e = new EventEmitter(); e.pid = 4242; e.kill = () => {}; setImmediate(() => e.emit("exit", 0)); return e; };
  let armed = false;
  const broken = { ...held, at: (n = "") => { if (n === "" && armed) throw new Error("EIO listing the seat dir"); if (n === "") { armed = true; } return held.at(n); } };
  await superviseSeat({ held: broken, laneHeld, doneName: "done-y", marker: "SEAT-MARKER s", home: join(dir, "home"), ceiling: 1e9, mode: "read", rest: [] }, { spawn: fake, sleep: () => new Promise((r) => setTimeout(r, 1)), groupAlive: () => false, signal: () => {} });
  const done = JSON.parse(readFileSync(join(lane, "done-y"), "utf8")) ;
  assert.match(done.handbackError, /EIO listing the seat dir/); assert.equal(done.finalMd, false);
});

test("a supervision failure still leaves a completion marker: a thrown error before the child spawns writes supervisor-error", async () => {
  const dir = mkdtempSync(join(tmpdir(), "superr-")); const bsd = join(dir, "bsd"), lane = join(dir, "lane"); mkdirSync(bsd); mkdirSync(lane);
  const held = openHeldSync(bsd, dir), laneHeld = openHeldSync(lane, dir);
  await assert.rejects(superviseSeat({ held, laneHeld, doneName: "done-z", marker: "m", home: dir, ceiling: 1, mode: "read", rest: [] }, {}), /rollouts-before\.json/);
  assert.equal(JSON.parse(readFileSync(join(lane, "done-z"), "utf8")).verdict, "supervisor-error");
});

import { killGroup } from "./launch-codex.mjs";

test("SAFETY killGroup refuses every pgid that is not an integer above 1 (kill(-1) reaches every process the user owns; kill(-0) the caller's own group); CONTROL it kills a real detached group", async () => {
  for (const bad of [1, 0, -1, -5, NaN, undefined, null, 1.5, "7"]) assert.throws(() => killGroup(bad, 0), /killGroup refuses pgid/, `pgid ${String(bad)} refuses`);
  const { spawn } = await import("node:child_process");
  const kid = spawn("sleep", ["30"], { detached: true, stdio: "ignore" });
  await new Promise((r) => kid.once("spawn", r));
  const gone = new Promise((r) => kid.once("exit", (_c, sig) => r(sig)));
  killGroup(kid.pid, "SIGKILL");
  assert.equal(await gone, "SIGKILL", "a real group still dies");
});

test("SAFETY WITNESS: in the harness sources process.kill appears only inside killGroup; a fake pid never reaches a real signal (the 2026-11-04 kill(-1) class)", () => {
  const files = ["launch-codex.mjs", "seat-walls.mjs", "seat-broker.mjs", "commit-relay.mjs", "held-dir.mjs", "lane-state.mjs", "broker-root.mjs", "tree-export.mjs", "wall-test.mjs"];
  const offenders = [];
  for (const f of files) {
    const lines = readFileSync(new URL(`./${f}`, import.meta.url), "utf8").split("\n");
    let inGuard = false;
    lines.forEach((l, i) => {
      if (/^export function killGroup\(/.test(l)) inGuard = true;
      if (inGuard && /^}/.test(l)) inGuard = false;
      if (/process\.kill\(/.test(l) && !inGuard) offenders.push(`${f}:${i + 1} ${l.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(offenders, []);
  // KNOWN POSITIVE: the scan reads a planted unguarded kill
  const planted = ["  try { process.kill(-child.pid, 'SIGKILL'); } catch {}"];
  assert.ok(planted.some((l) => /process\.kill\(/.test(l)), "the pattern sees a planted kill");
});

test("SAFETY no test fake in this file carries pid 0 or 1: a fake child's pid is 4242-style, and every supervisor test injects its signal", () => {
  const whole = readFileSync(new URL("./launch-codex.test.mjs", import.meta.url), "utf8");
  const src = whole.slice(0, whole.indexOf("test(\"SAFETY no test fake")).split("\n");
  const bad = src.map((l, i) => [i + 1, l]).filter(([, l]) => /\b(e\.pid|pid:)\s*=?\s*[01]\b(?!\d)/.test(l) && !/SAFETY/.test(l) && !/bad of/.test(l));
  assert.deepEqual(bad.map(([i, l]) => `${i} ${l.trim().slice(0, 70)}`), []);
});

// ======================= Terra round 7 =======================
import { checkBrokerRoot } from "./broker-root.mjs";

test("P3 a BUILD worktree outside ~/.lares-scratch refuses (the house law), and a granted root that is an ancestor of the fixed root refuses; CONTROL passes", () => {
  const w = world();
  const outside = join(w.home, "outside-wt"); mkdirSync(outside);
  refuses(w, { mode: "build", worktree: outside }, /builder worktree must sit under/);
  assert.ok(preflight(ask(w), w.readers), "CONTROL a worktree under scratch passes");
  const home = realpathSync(w.home), root = join(home, ".local/state/lares-broker");
  for (const ancestor of [home, join(home, ".local"), join(home, ".local/state")]) assert.throws(() => checkBrokerRoot(root, { realHome: home, guarded: [ancestor] }), /must sit outside/, `ancestor ${ancestor} refuses`);
  assert.doesNotThrow(() => checkBrokerRoot(root, { realHome: home, guarded: [join(home, ".lares-scratch/lane/wt")] }));
});

const bareSeat = () => {
  const dir = mkdtempSync(join(tmpdir(), "fin-")); const bsd = join(dir, "bsd"), lane = join(dir, "lane"), home = join(dir, "home");
  mkdirSync(bsd); mkdirSync(lane); mkdirSync(join(home, ".codex", "sessions"), { recursive: true });
  writeFileSync(join(bsd, "prompt.txt"), "SEAT-MARKER f\n\nb"); writeFileSync(join(bsd, "rollouts-before.json"), "[]");
  return { dir, bsd, lane, home, held: openHeldSync(bsd, dir), laneHeld: openHeldSync(lane, dir) };
};
const fakeChild = (code) => () => { const e = new EventEmitter(); e.pid = 4242; e.kill = () => {}; setTimeout(() => e.emit("exit", code), 5); return e; };
const sleep1 = () => new Promise((r) => setTimeout(r, 1));
const doneOf = (S, name) => JSON.parse(readFileSync(join(S.lane, name), "utf8"));

test("P2 EVERY exit path writes the FULL marker (verdict, exitCode, copied, finalMd, handbackError, error, kept) and removes the broker seat dir: a throw, a clean exit; CONTROL fields all present", async () => {
  const keys = ["copied", "error", "exitCode", "finalMd", "handbackError", "kept", "verdict"];
  { // a throw before the child spawns
    const S = bareSeat(); rmSync(join(S.bsd, "rollouts-before.json"));
    await assert.rejects(superviseSeat({ held: S.held, laneHeld: S.laneHeld, doneName: "done-t", bsdPath: S.bsd, marker: "m", home: S.home, ceiling: 1, mode: "read", rest: [] }, {}), /rollouts-before/);
    const d = doneOf(S, "done-t");
    assert.deepEqual(Object.keys(d).sort(), keys); assert.equal(d.verdict, "supervisor-error"); assert.match(d.error, /rollouts-before/); assert.equal(d.kept, null);
    assert.equal(existsSync(S.bsd), false, "the broker seat dir is removed on a throw");
  }
  { // a clean exit
    const S = bareSeat(); writeFileSync(join(S.bsd, "final.md"), "ok");
    const v = await superviseSeat({ held: S.held, laneHeld: S.laneHeld, doneName: "done-c", bsdPath: S.bsd, marker: "m", home: S.home, ceiling: 1e9, mode: "read", rest: [] }, { spawn: fakeChild(0), sleep: sleep1, groupAlive: () => false, signal: () => {} });
    const d = doneOf(S, "done-c");
    assert.equal(v, "exited"); assert.deepEqual(Object.keys(d).sort(), keys); assert.equal(d.finalMd, true); assert.equal(d.exitCode, 0);
    assert.equal(existsSync(S.bsd), false);
  }
});

test("P2 an UNSTOPPED seat (its group still lives) keeps its broker dir, names it in the full marker, and copies nothing back; once the group is gone the dir is removed", async () => {
  const S = bareSeat(); writeFileSync(join(S.bsd, "final.md"), "partial");
  const v = await superviseSeat({ held: S.held, laneHeld: S.laneHeld, doneName: "done-u", bsdPath: S.bsd, marker: "m", home: S.home, ceiling: 1e9, mode: "read", rest: [] }, { spawn: fakeChild(0), sleep: sleep1, groupAlive: () => true, signal: () => {}, groupPolls: 2, pollMs: 1 });
  assert.equal(v, "unstopped");
  const d = doneOf(S, "done-u");
  assert.equal(d.verdict, "unstopped"); assert.equal(d.kept, S.bsd); assert.deepEqual(d.copied, []);
  assert.equal(existsSync(join(S.bsd, "final.md")), true, "nothing alive loses its cwd");
  assert.equal(existsSync(join(S.lane, "final.md")), false, "no hand-back while the group lives");
});

test("P2 a running seat's output has a live bound: a seat dir over the cap is stopped with verdict size-ceiling and named; CONTROL under the cap exits normally", async () => {
  const S = bareSeat();
  let kid; const sig = [];
  const v = await superviseSeat({ held: S.held, laneHeld: S.laneHeld, doneName: "done-s", bsdPath: S.bsd, marker: "m", home: S.home, ceiling: 1e9, mode: "read", rest: [], maxBytes: 1000, graceTicks: 1, hardTicks: 1 }, {
    spawn: () => { kid = new EventEmitter(); kid.pid = 4242; kid.kill = () => {}; setTimeout(() => writeFileSync(join(S.bsd, "run.log"), Buffer.alloc(5000, 65)), 1); return kid; },
    sleep: () => new Promise((r) => setTimeout(r, 15)), groupAlive: () => false,
    signal: (neg, s) => { sig.push(s); if (s === "SIGTERM") setTimeout(() => kid.emit("exit", 143), 1); },
  });
  assert.equal(v, "size-ceiling");
  assert.equal(doneOf(S, "done-s").verdict, "size-ceiling");
  assert.ok(sig.includes("SIGTERM"));
  const S2 = bareSeat();
  const v2 = await superviseSeat({ held: S2.held, laneHeld: S2.laneHeld, doneName: "done-n", bsdPath: S2.bsd, marker: "m", home: S2.home, ceiling: 1e9, mode: "read", rest: [], maxBytes: 1e6 }, { spawn: fakeChild(0), sleep: sleep1, groupAlive: () => false, signal: () => {} });
  assert.equal(v2, "exited");
});

test("P1 preflight keeps every granted root clear of the staging tree: a lead or build worktree that is the scratch dir or an ancestor of the staging parent refuses, a seat dir inside staging refuses, and the EXACT made worktree passes", () => {
  const w = world();
  const scratch = join(realpathSync(w.home), ".lares-scratch"), st = join(scratch, ".broker-worktrees");
  const madeParent = join(st, "lane-0123456789abcdef", "wt-Ab12Cd"); mkdirSync(join(madeParent, "wt"), { recursive: true });
  for (const mode of ["lead", "build"]) {
    refuses(w, { mode, worktree: scratch }, /equals or contains the broker's worktree staging tree/);
    refuses(w, { mode, worktree: st }, /equals or contains the broker's worktree staging tree/);
    refuses(w, { mode, worktree: join(st, "lane-0123456789abcdef") }, /equals or contains|sits inside/);
    refuses(w, { mode, worktree: madeParent }, /only the exact made worktree/);
  }
  assert.ok(preflight(ask(w, { mode: "build", worktree: join(madeParent, "wt") }), w.readers), "CONTROL the exact made worktree passes");
  const inStage = join(st, "lane-0123456789abcdef", "seatdir"); mkdirSync(inStage, { recursive: true }); writeFileSync(join(inStage, "brief.md"), "b");
  refuses(w, { mode: "read", seatDir: inStage, worktree: undefined }, /sits inside the broker's worktree staging tree/);
});

test("lead law permits an event wait for its own receipt, bounded for a dead broker; seat waits stay outside", () => {
  const law = leadLaw();
  assert.match(law, /own.*res-<id>\.json.*same step/);
  assert.match(law, /event wait.*file.*appear/);
  assert.match(law, /tools\/wait-receipt\.mjs/);
  assert.match(law, /\/\/ LIVENESS:.*broker.*died/);
  assert.doesNotMatch(law, /read its.*on your next step/);
  assert.match(law, /never poll.*seat/);
  const canon = readFileSync(new URL('../bags/lares/ha.ka.ba/lares/docs/pono/seat-harness.mem', import.meta.url), 'utf8');
  const broker = canon.split('<<~ ahu slot=`#/the-broker`>>')[1].split('<<~/ahu>>')[0];
  assert.match(broker, /own.*res-<id>.*same step/);
  assert.match(broker, /event wait.*LIVENESS:.*broker.*died/);
});

test("RED: the pool refuses two newer recordless rollouts; CONTROL one skip and newest record", () => {
  const home = mkdtempSync(join(tmpdir(), "pool-bound-"));
  const dir = join(home, ".codex", "sessions"); mkdirSync(dir, { recursive: true });
  for (const [name, time, line] of [["old", 1000, rate(40)], ["new", 2000, '{}'], ["newest", 3000, '{}']]) {
    const file = join(dir, `rollout-${name}.jsonl`); writeFileSync(file, line); utimesSync(file, time, time);
  }
  const readers = realReaders(home);
  assert.throws(() => readers.rolloutLines(), /pool.*more than one.*rollout/i);
  rmSync(join(dir, 'rollout-newest.jsonl'));
  assert.equal(readPool(readers.rolloutLines()).used, 40);
  writeFileSync(join(dir, 'rollout-new.jsonl'), rate(85));
  assert.equal(readPool(readers.rolloutLines()).used, 85, 'a newest below-floor reading never falls back');
  rmSync(home, { recursive: true, force: true });
});

test("RED: receipt event wait reads its own answer and refuses a dead broker within a code bound", async () => {
  const { waitForReceipt } = await import('./wait-receipt.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'receipt-wait-'));
  try {
    const file = join(dir, 'res-001.json');
    const pending = waitForReceipt(file, { timeoutMs: 1000 });
    writeFileSync(file, ''); // Creation can precede a completed broker write.
    writeFileSync(join(dir, 'res-other.json'), '{}');
    const timer = setTimeout(() => writeFileSync(file, '{"ok":true}'), 30);
    try { assert.deepEqual(await pending, { ok: true }); } finally { clearTimeout(timer); }
    assert.deepEqual(await waitForReceipt(file), { ok: true }, 'CONTROL already arrived');
    await assert.rejects(waitForReceipt(join(dir, 'res-002.json'), { timeoutMs: 30 }), /receipt-timeout.*broker.*died/);
    await assert.rejects(waitForReceipt(file, { timeoutMs: Infinity }), /receipt-timeout-bound/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

