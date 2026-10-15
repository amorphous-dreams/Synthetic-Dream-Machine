/**
 * meme-check-staged leaks no inherited git env into its scratch repo.
 *
 * A pre-commit hook inside a LINKED WORKTREE runs with `GIT_DIR` set to the worktree's own gitdir
 * (`<repo>/.git/worktrees/<name>`) and `GIT_WORK_TREE` unset. `git -C <scratch> init` changes only the
 * working directory: the inherited `GIT_DIR` still wins discovery, so the init re-initializes the
 * worktree's gitdir, reads it as bare, and writes `core.bare = true` into the config every worktree
 * shares, including the primary checkout. The gate clears the git env around its scratch repo, so a commit
 * made in a worktree leaves the shared config as it found it.
 *
 * The test builds a throwaway repo with a linked worktree, stages a `.mem` file there, and runs the real
 * gate script with the env a worktree commit hands its hook. CONTROL: the same `git -C <dir> init` with
 * that env, outside the gate, does flip the flag, so a green here reads the guard and not an inert setup.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const GATE = join(dirname(fileURLToPath(import.meta.url)), "meme-check-staged.sh");

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", env: cleanEnv() }).trim();
}
function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_PREFIX"]) {
    if (!(k in extra)) delete env[k];
  }
  return env;
}

function repoWithWorktree() {
  const root = mkdtempSync(join(tmpdir(), "meme-check-env-"));
  const main = join(root, "main");
  execFileSync("git", ["init", "-q", main], { env: cleanEnv() });
  git(main, "config", "user.email", "t@example.invalid");
  git(main, "config", "user.name", "t");
  writeFileSync(join(main, "seed.txt"), "seed\n");
  git(main, "add", "seed.txt");
  git(main, "commit", "-q", "-m", "seed");
  const wt = join(root, "wt");
  git(main, "worktree", "add", "-q", "-b", "side", wt);
  writeFileSync(join(wt, "x.mem"), "not a carrier\n");
  git(wt, "add", "x.mem");
  const hookEnv = { GIT_DIR: join(main, ".git", "worktrees", "wt") };
  return { root, main, wt, hookEnv };
}

test("CONTROL: a scratch `git -C <dir> init` under a worktree's GIT_DIR flips the shared core.bare", () => {
  const { root, main, wt, hookEnv } = repoWithWorktree();
  try {
    const scratch = mkdtempSync(join(root, "scratch-"));
    spawnSync("git", ["-C", scratch, "init", "-q"], { cwd: wt, env: cleanEnv(hookEnv) });
    assert.equal(git(main, "config", "--get", "core.bare"), "true");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the gate run under a worktree's hook env leaves the shared core.bare false", () => {
  const { root, main, wt, hookEnv } = repoWithWorktree();
  try {
    spawnSync("bash", [GATE], { cwd: wt, env: cleanEnv(hookEnv), encoding: "utf8" });
    assert.equal(git(main, "config", "--get", "core.bare"), "false");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
