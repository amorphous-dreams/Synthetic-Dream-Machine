import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allowance, copilotArgs, permissionArgs, refusal, seatEnv } from "./launch-copilot.mjs";

const pairs = (args) => { const out = []; for (let i = 0; i < args.length; i++) if (args[i].startsWith("--") && !args[i + 1]?.startsWith("--")) out.push(`${args[i]} ${args[i + 1]}`); return out; };

test("READ denies every write, URL, git write and shell escape; allows the reads", () => {
  const p = pairs(permissionArgs("read"));
  for (const d of ["write", "url", "shell(git push)", "shell(git commit)", "shell(git stash)", "shell(rm)", "shell(bash)", "shell(env)", "shell(gh)"]) {
    assert.ok(p.includes(`--deny-tool ${d}`), `read misses deny ${d}`);
  }
  assert.ok(p.includes("--allow-tool shell(git diff)"));
  assert.ok(!p.some((x) => x === "--allow-tool write"), "a reader never writes");
});

test("BUILD allows writes, vitest and tsc, and still denies git writes, network, rm, mv, npm and pnpm", () => {
  const p = pairs(permissionArgs("build"));
  for (const a of ["write", "shell(npx vitest:*)", "shell(npx tsc:*)"]) assert.ok(p.includes(`--allow-tool ${a}`), `build misses allow ${a}`);
  for (const d of ["url", "shell(git push)", "shell(git commit)", "shell(rm)", "shell(mv)", "shell(npm)", "shell(pnpm)", "shell(curl)"]) {
    assert.ok(p.includes(`--deny-tool ${d}`), `build misses deny ${d}`);
  }
});

test("BOTH: no built-in MCP, no temp dir, no prompt, no update; an unknown mode refuses", () => {
  const args = copilotArgs({ mode: "read", prompt: "x", model: "gpt-5.3-codex", effort: "medium", share: "/s.md" });
  for (const f of ["--disable-builtin-mcps", "--disallow-temp-dir", "--no-ask-user", "--no-auto-update"]) assert.ok(args.includes(f), `missing ${f}`);
  assert.ok(!args.some((a) => /^--(allow-all|yolo)/.test(a)));
  assert.throws(() => permissionArgs("write"), /unknown mode/);
});

test("KNOWN POSITIVE: a builder that asks for --add-dir refuses (it would widen its write wall)", () => {
  assert.throws(() => copilotArgs({ mode: "build", prompt: "x", model: "m", share: "/s", addDirs: ["/elsewhere"] }), /widens/);
  assert.doesNotThrow(() => copilotArgs({ mode: "read", prompt: "x", model: "m", share: "/s", addDirs: ["/elsewhere"] }));
});

test("the builder's refusals: main checkout, a non-worktree, no LAR_ROOT, a LAR_ROOT inside a checkout — CONTROL: a scratch root opens", () => {
  const base = mkdtempSync(join(tmpdir(), "launch-copilot-"));
  const repo = join(base, "repo"), wt = join(base, "wt"), scratch = join(base, "scratch"), plain = join(base, "plain");
  for (const d of [repo, wt, scratch, plain]) mkdirSync(d);
  writeFileSync(join(wt, ".git"), "gitdir: elsewhere\n");
  const t = { tmp: join(base, "elsewhere-tmp") }; mkdirSync(t.tmp);
  assert.match(refusal({ mode: "build", cwd: repo, env: { LAR_ROOT: scratch }, repo, ...t }), /main checkout/);
  assert.match(refusal({ mode: "build", cwd: plain, env: { LAR_ROOT: scratch }, repo, ...t }), /no git worktree/);
  assert.match(refusal({ mode: "build", cwd: wt, env: {}, repo, ...t }), /scratch LAR_ROOT/);
  assert.match(refusal({ mode: "build", cwd: wt, env: { LAR_ROOT: join(wt, "root") }, repo, ...t }), /inside a checkout/);
  assert.equal(refusal({ mode: "build", cwd: wt, env: { LAR_ROOT: scratch }, repo, ...t }), null);
  assert.equal(refusal({ mode: "read", cwd: repo, env: {}, repo, ...t }), null);
  // KNOWN POSITIVE: a seat cwd inside the system temp directory refuses, since --disallow-temp-dir blinds it there.
  assert.match(refusal({ mode: "read", cwd: wt, env: {}, repo, tmp: base }), /system temp directory/);
});

test("the seat env drops LAR_BAGS and COPILOT_ALLOW_ALL and keeps the rest", () => {
  const env = seatEnv({ LAR_BAGS: "/b", COPILOT_ALLOW_ALL: "true", LAR_ROOT: "/r", PATH: "/bin" });
  assert.deepEqual(env, { LAR_ROOT: "/r", PATH: "/bin" });
});

test("the allowance reads the newest snapshot — KNOWN POSITIVE planted; an empty cache names its absence", () => {
  const dir = mkdtempSync(join(tmpdir(), "copilot-cache-"));
  const f = join(dir, "c.json");
  writeFileSync(f, JSON.stringify({
    a: { response: { quota_reset_date: "2026-11-01", quota_snapshots: { premium_interactions: { quota_remaining: 120, entitlement: 300, timestamp_utc: "2026-10-20T00:00:00Z" } } } },
    b: { response: { quota_reset_date: "2026-11-01", quota_snapshots: { premium_interactions: { quota_remaining: 97, entitlement: 300, timestamp_utc: "2026-10-25T00:00:00Z" } } } },
  }));
  assert.match(allowance(f), /^97\/300 /);
  writeFileSync(f, JSON.stringify({ copilotUserCache: { "v1:abc": { response: { quota_reset_date: "2026-11-01",
    quota_snapshots: { chat: { quota_remaining: 0, entitlement: 0 }, premium_interactions: { quota_remaining: 41, entitlement: 300 } } } } } }));
  assert.match(allowance(f), /^41\/300 \(resets 2026-11-01\)$/, "the nested cache shape reads");
  writeFileSync(f, "{}");
  assert.match(allowance(f), /no premium_interactions/);
});
