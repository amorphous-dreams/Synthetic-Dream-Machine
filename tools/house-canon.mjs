#!/usr/bin/env node
// house-canon — the HOUSE CANON CLONE: the pinned clone a house reads its canon from, never a developer's working
// checkout (lar:///ha.ka.ba/lararium/mesh/founding-runbook#/prepare; operator ruling D4, 2026-11-18).
//
//   node tools/house-canon.mjs stand [--at <dir>] [--pin <ref>] [--from <origin>] [--json]
//   node tools/house-canon.mjs move  [--at <dir>] [--pin <ref>] [--json]
//   node tools/house-canon.mjs read  [--at <dir>] [--json]
//
// THE HOUSE'S CANON MOVES BY AN EXPLICIT ACT. `LARES_WORKSPACE` names the directory the vessel mounts at /workspace and
// reads canon from (`bags/`, `wikis/`), with a disk mirror that writes back into it. Named at a working checkout, a
// branch switch there moves the house's canon underneath it. The canon clone stands apart: its own clone of the
// origin, its HEAD detached at the pin, the pin recorded in the clone's own config (`lares.canonPin`), so the clone
// names itself and a working checkout reads as none.
//
//   stand  clones the origin (default: the origin of the checkout this runs in) to <dir> (default $LARES_CANON, else
//          ~/.lares-canon) and checks out the pin (default `develop`) detached. It refuses a place that already holds
//          files, one inside the working checkout, and one inside LARES_HOUSE.
//   move   fetches the origin and checks out the pin's commit (`--pin` re-pins: a branch, a tag or a commit). The house's
//          write-back rests in the clone's working tree, so a clone holding any change or untracked file refuses and
//          names each path; nothing moves until a hand commits those paths for review or discards them. The next act
//          stays the operator's: `lares vessel seed`, so the standing house reads the moved canon.
//   read   names the clone, its pin and commit, the commit its last fetch saw for the pin, the write-back it holds, and
//          what LARES_WORKSPACE (the environment, else ~/.lares/lares-surface.env) names: this clone, a working
//          checkout (the one dev install, whose write-back lands in source control by design) or another place.
//
// Exit: 0 done · 1 refused (the reason on stderr) · 2 usage.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VERBS = ["stand", "move", "read"];
const USAGE = [
  "usage: node tools/house-canon.mjs stand [--at <dir>] [--pin <ref>] [--from <origin>] [--json]",
  "       node tools/house-canon.mjs move  [--at <dir>] [--pin <ref>] [--json]",
  "       node tools/house-canon.mjs read  [--at <dir>] [--json]",
].join("\n");
const PIN_KEY = "lares.canonPin";
const DEFAULT_PIN = "develop";

class Refusal extends Error {}

/** git with the tree handed in deciding: a leaked hook env (GIT_DIR and its kin) would answer for another repository. */
function git(cwd, args, { allowFail = false } = {}) {
  const env = { ...process.env };
  for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE"]) delete env[k];
  const r = spawnSync("git", args, { cwd, encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Refusal(`git does not answer: ${r.error.message}`);
  if (r.status !== 0 && !allowFail) throw new Refusal(`git ${args.join(" ")} failed in ${cwd}: ${(r.stderr || r.stdout).trim()}`);
  return { ok: r.status === 0, raw: r.stdout ?? "", out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

/** A path with its existing prefix resolved through links, so containment compares real places. */
function real(p) {
  const abs = resolve(p);
  let head = abs;
  const tail = [];
  while (!existsSync(head)) {
    const up = resolve(head, "..");
    if (up === head) return abs;
    tail.unshift(head.slice(up.length).replace(/^[/\\]/, ""));
    head = up;
  }
  return join(realpathSync(head), ...tail);
}
const inside = (child, parent) => {
  const rel = relative(real(parent), real(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

/** The value one name carries: the environment first, else the surface env file's last plain KEY=VALUE line. */
function surfaceValue(name, env = process.env) {
  if (env[name]) return env[name];
  const file = join(env.HOME || homedir(), ".lares", "lares-surface.env");
  if (!existsSync(file)) return "";
  const lines = readFileSync(file, "utf8").split("\n").map((l) => l.match(new RegExp(`^\\s*${name}=(.*)$`))).filter(Boolean);
  return lines.length ? lines.at(-1)[1].trim() : "";
}

const defaultAt = (env = process.env) => env.LARES_CANON || join(env.HOME || homedir(), ".lares-canon");
/** The working checkout this runs in: the top of the tree around the current directory, or null outside one. */
const workingCheckout = (cwd) => { const r = git(cwd, ["rev-parse", "--show-toplevel"], { allowFail: true }); return r.ok ? r.out : null; };
const pinOf = (at) => { const r = git(at, ["config", "--get", PIN_KEY], { allowFail: true }); return r.ok ? r.out : null; };

/** The commit a pin names in the clone: the origin's branch, else a tag, else a commit the clone holds. */
function resolvePin(at, pin) {
  for (const ref of [`refs/remotes/origin/${pin}`, `refs/tags/${pin}`, pin]) {
    const r = git(at, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { allowFail: true });
    if (r.ok && r.out) return r.out;
  }
  return null;
}

/** Every changed or untracked path in the clone's working tree: the house's write-back a move would overwrite. */
function writeBack(at) {
  // `-z` keeps each entry whole: a NUL ends it, and the two status columns lead it untrimmed. A rename carries its
  // source as the entry after it, which the walk skips.
  const entries = git(at, ["status", "--porcelain", "-z", "--untracked-files=all"]).raw.split("\0").filter(Boolean);
  const paths = [];
  for (let i = 0; i < entries.length; i++) {
    paths.push(entries[i].slice(3));
    if (/^[RC]/.test(entries[i])) i++;
  }
  return paths;
}

function requireClone(at) {
  if (!existsSync(at)) throw new Refusal(`${at} stands absent — \`node tools/house-canon.mjs stand --at ${at}\` makes the clone`);
  const pin = pinOf(at);
  if (!workingCheckout(at) || pin === null) {
    throw new Refusal(`${at} reads as no house canon clone (its config records no ${PIN_KEY}); a working checkout never moves by this door`);
  }
  return pin;
}

export function stand({ at = defaultAt(), pin = DEFAULT_PIN, from, cwd = process.cwd(), env = process.env } = {}) {
  at = resolve(at);
  const checkout = workingCheckout(cwd);
  const origin = from ?? (checkout ? git(checkout, ["remote", "get-url", "origin"], { allowFail: true }).out : "");
  if (!origin) throw new Refusal("no origin to clone: run inside a checkout whose `origin` names the repository, or pass --from <origin>");
  if (existsSync(at) && readdirSync(at).length > 0) throw new Refusal(`${at} already holds files; the canon clone stands in an empty or absent place`);
  if (checkout && inside(at, checkout)) throw new Refusal(`${at} stands inside the working checkout ${checkout}; the canon clone stands beside it`);
  const house = surfaceValue("LARES_HOUSE", env);
  if (house && inside(at, house)) throw new Refusal(`${at} stands inside LARES_HOUSE (${house}); the canon clone stands outside every house bind`);
  git(cwd, ["clone", "--quiet", "--no-checkout", "--origin", "origin", origin, at]);
  const commit = resolvePin(at, pin);
  if (!commit) throw new Refusal(`the origin ${origin} carries no branch, tag or commit named ${pin}; the clone stands at ${at} with nothing checked out`);
  git(at, ["config", PIN_KEY, pin]);
  git(at, ["checkout", "--quiet", "--detach", commit]);
  return {
    at, pin, origin, head: commit,
    next: [
      `LARES_WORKSPACE=${at}   # in ~/.lares/lares-surface.env, or exported in this shell`,
      "a standing house reads it at its next `up`, then `lares vessel seed`; a new house founds against it",
    ],
  };
}

export function move({ at = defaultAt(), pin } = {}) {
  at = resolve(at);
  const recorded = requireClone(at);
  const want = pin ?? recorded;
  const dirty = writeBack(at);
  if (dirty.length > 0) {
    throw new Refusal([
      `${at} holds ${dirty.length} path(s) of write-back a move would overwrite:`,
      ...dirty.map((p) => `  ${p}`),
      `commit them for review (\`git -C ${at} switch -c <branch>\`, commit, push, open a PR) or discard them`,
      `(\`git -C ${at} restore --staged --worktree . && git -C ${at} clean -fd\`), then move again`,
    ].join("\n"));
  }
  git(at, ["fetch", "--quiet", "--tags", "--prune", "origin"]);
  const to = resolvePin(at, want);
  if (!to) throw new Refusal(`the origin carries no branch, tag or commit named ${want}; ${at} stays at its commit, pinned to ${recorded}`);
  const from = git(at, ["rev-parse", "HEAD"]).out;
  const changed = from === to ? [] : git(at, ["diff", "--name-only", from, to]).out.split("\n").filter(Boolean);
  if (from !== to) git(at, ["checkout", "--quiet", "--detach", to]);
  if (want !== recorded) git(at, ["config", PIN_KEY, want]);
  return {
    at, pin: want, from, to, changed,
    next: from === to ? [] : ["lares vessel seed   # the standing house reads the moved canon"],
  };
}

export function read({ at = defaultAt(), env = process.env } = {}) {
  at = resolve(at);
  const pin = requireClone(at);
  const named = surfaceValue("LARES_WORKSPACE", env);
  let names = "other";
  if (named && existsSync(named)) {
    if (real(named) === real(at)) names = "clone";
    else if (workingCheckout(named) && pinOf(named) === null) names = "working-checkout";
  }
  return {
    at, pin,
    head: git(at, ["rev-parse", "HEAD"]).out,
    fetched: resolvePin(at, pin),
    dirty: writeBack(at),
    workspace: { value: named, names },
  };
}

function parse(argv) {
  const [verb, ...rest] = argv;
  const opts = { json: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--json") opts.json = true;
    else if (["--at", "--pin", "--from"].includes(a) && rest[i + 1] !== undefined) opts[a.slice(2)] = rest[++i];
    else return { verb: null };
  }
  return { verb: VERBS.includes(verb) ? verb : null, opts };
}

function human(verb, out) {
  if (verb === "stand") return [`stood ${out.at} at ${out.pin} (${out.head.slice(0, 12)}) from ${out.origin}`, ...out.next.map((n) => `  next: ${n}`)];
  if (verb === "move") {
    return out.from === out.to
      ? [`${out.at} already stands at ${out.pin} (${out.to.slice(0, 12)})`]
      : [`moved ${out.at} to ${out.pin}: ${out.from.slice(0, 12)} -> ${out.to.slice(0, 12)}, ${out.changed.length} path(s) changed`, ...out.next.map((n) => `  next: ${n}`)];
  }
  const where = { clone: "this clone", "working-checkout": "a working checkout (the one dev install)", other: "another place" }[out.workspace.names];
  return [
    `${out.at} pinned to ${out.pin} at ${out.head.slice(0, 12)}${out.fetched && out.fetched !== out.head ? ` (its last fetch saw ${out.fetched.slice(0, 12)})` : ""}`,
    `write-back held: ${out.dirty.length} path(s)`,
    `LARES_WORKSPACE ${out.workspace.value ? `names ${out.workspace.value}: ${where}` : "reads unset"}`,
  ];
}

export function main(argv = process.argv.slice(2)) {
  const { verb, opts } = parse(argv);
  if (!verb) { process.stderr.write(`${USAGE}\n`); return 2; }
  try {
    const out = verb === "stand" ? stand(opts) : verb === "move" ? move(opts) : read(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(out, null, 2)}\n` : `${human(verb, out).join("\n")}\n`);
    return 0;
  } catch (err) {
    if (!(err instanceof Refusal)) throw err;
    process.stderr.write(`house-canon: ${err.message}\n`);
    return 1;
  }
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
