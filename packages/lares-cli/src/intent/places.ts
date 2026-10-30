/**
 * intent/places — where each radius keeps its ledger. The home ledger rests in the home's own state,
 * never under a scratch `LAR_ROOT`; the repo ledger rests in the checkout's own git dir, untracked and
 * per worktree.
 */
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

export const homeLedgerDir = (home: string = homedir()): string =>
  join(process.env["XDG_STATE_HOME"]?.trim() || join(home, ".local", "state"), "lares", "intent", "home");

export const repoLedgerDir = (repo: string): string =>
  join(execFileSync("git", ["-C", repo, "rev-parse", "--absolute-git-dir"], { encoding: "utf8" }).trim(), "lares-intent");

