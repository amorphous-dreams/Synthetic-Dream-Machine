#!/usr/bin/env node
/**
 * span-push — the controller's gated push of a branch it carried lanes onto by pick (tools/lane-pick.mjs), most often the
 * span (mixed-model-swarm#/the-lanes: the span pushes only while no run flies on it).
 *
 *   node tools/span-push.mjs <branch> [--remote <name>]      run from the checkout that stands on <branch>
 *
 * In order: the PINS run, every one of them, since canon a tool quotes (the rite runbook, any sealed carrier, the evergreen
 * ceilings) moves with a pick and no CI run reads the push of a canon-only change; a red pin refuses by name. Then ONE read
 * of `gh run list --branch <branch>` per active status (land-train's `activeRuns`: every status in flight, never only the
 * newest five runs), and a run in flight refuses: push after it completes. The read happens once; this tool never waits,
 * polls or watches, so the pace stays the caller's (POLL_FLOOR_S in tools/ci-verdict.mjs governs any read again).
 *
 * Exit: 0 pushed · 1 a pin red · 2 usage · 3 a run in flight · 5 the CI read failed hard · 6 the push failed
 *       · 10 UNREADABLE (GitHub unreachable or a 5xx), which never reads as clear.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { classifyFailure } from "./ci-verdict.mjs";
import { activeRuns, ghEnv, repoOfRemote, spanPushRefusal } from "./land-train.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The local pin checks a canon-touching push still owes. */
export const PINS = [
  { name: "rite-walk", cmd: "node", args: ["--test", "tools/rite-walk.test.mjs"] },
  { name: "bcc", cmd: "bash", args: ["tools/bcc-witness.sh"] },
  { name: "evergreen", cmd: "bash", args: ["tools/evergreen-boundary-witness.sh"] },
];

/** ops: pin(step) -> exit code · gh(args) -> parsed JSON · push(remote, branch) -> {status, stderr} · head() -> sha · say(line). */
export async function spanPush({ branch, remote = "origin" }, ops) {
  const red = [];
  for (const step of PINS) {
    ops.say(`── pin ${step.name} ──`);
    const rc = ops.pin(step);
    ops.say(`── ${step.name}: ${rc === 0 ? "ok" : `RED exit ${rc}`} ──`);
    if (rc !== 0) red.push(`${step.name} (exit ${rc})`);
  }
  if (red.length) { ops.say(`SPAN PUSH REFUSES: ${red.join(", ")}`); return { code: 1 }; }

  let runs;
  try { runs = activeRuns(ops.gh, branch); }
  catch (err) {
    const unreadable = classifyFailure(err) === "unreadable";
    ops.say(`span-push: ${unreadable ? "UNREADABLE" : "CI READ FAILED"} on ${branch}: ${String(err?.stderr || err?.message).trim()}`);
    return { code: unreadable ? 10 : 5 };
  }
  const refusal = spanPushRefusal(runs);
  if (refusal) { ops.say(refusal.replace("on the span", `on ${branch}`)); return { code: 3 }; }

  const p = ops.push(remote, branch);
  if (p.status !== 0) { ops.say(`span-push: the push of ${branch} failed: ${String(p.stderr).trim()}`); return { code: 6 }; }
  ops.say(`pushed ${ops.head().slice(0, 12)} to ${remote}/${branch}`);
  return { code: 0 };
}

function realOps(cwd, env = process.env) {
  const git = (args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  let ghe;
  const gh = (args) => {
    ghe ??= ghEnv(env, userInfo().homedir, repoOfRemote(git(["remote", "get-url", "origin"])));
    return JSON.parse(execFileSync("gh", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000, env: ghe }));
  };
  return {
    pin: (step) => spawnSync(step.cmd, step.args, { cwd, stdio: "inherit" }).status ?? 1,
    gh,
    push: (remote, branch) => spawnSync("git", ["push", "-q", remote, `HEAD:refs/heads/${branch}`], { cwd, encoding: "utf8" }),
    head: () => git(["rev-parse", "HEAD"]),
    say: (line) => console.log(line),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const argv = process.argv.slice(2);
  let remote = "origin";
  const i = argv.indexOf("--remote");
  if (i >= 0) { remote = argv[i + 1]; argv.splice(i, 2); }
  if (argv.length !== 1 || !remote || argv[0].startsWith("-")) { console.error("usage: span-push.mjs <branch> [--remote <name>]"); process.exit(2); }
  const cwd = process.cwd();
  const current = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, encoding: "utf8" }).trim();
  if (current !== argv[0]) { console.error(`span-push: REFUSED, the checkout stands on ${current}, not ${argv[0]}`); process.exit(2); }
  const { code } = await spanPush({ branch: argv[0], remote }, realOps(cwd));
  process.exit(code);
}
