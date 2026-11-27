// rite-walk/image-leg — the rite's IMAGE LEG: the product image, the pūlama, the aho and the kūkulu on a real container.
//
// The three-face walk (`steps.mjs`) runs the checkout's built dist and leaves its `image` step unreached. This leg
// walks what that step names, in the order a real house allows:
//   1. the image builds through the host shim; a scratch hearth founds under the staged test custody;
//   2. the vessel stands HOLDING ITS OWN CUSTODY and opens on a terminal; the aho holds an MCP seat across the vessel's
//      stop, restart and kill; the hand strings the kūkulu lei there (a ward act needs a vessel its own route opened);
//   3. the pūlama stands and lights; the kūkulu raises a vessel beside it; `up`, the unlock and `down` read beside it.
// A first `up` beside a lit pūlama seats the vessel's holder over the socket, and the pūlama serves a kūkulu alone
// (a vouched lei): a vessel that wears none keeps the floor, and no terminal opens it. So the lei strings before the
// pūlama stands. Each step writes one row: pass, fail or unreached, the quoted answer, and the measures it took.
// Every terminal act (`up`, `vault unlock`, `lei kui`, `pulama light`, `down`) rides a pseudo-terminal (`script`) and
// types the published test route; the staged custody alone makes that route open anything.
//
// THE SCOPE, held four ways before any act and on every Docker call:
//   the guard     `assertImageScope` refuses a compose project, a port, an image tag or a house the operator's own
//                 surface holds (`lares-surface`, 4321, `lares-surface:local`, a home's `.lares`), and a house, home
//                 or workspace outside the one scratch base the caller names;
//   the wrapper   every `docker` this leg or the shim spawns resolves to a wrapper on a scratch PATH. It writes each
//                 call to `docker.log`, puts `-p <project>` on every compose call, and refuses a call that names the
//                 operator's project, image or containers, a container of another project, or a verb outside its list;
//   the env       a scratch HOME holds its own `.lares/lares-surface.env`, and COMPOSE_PROJECT_NAME names the project;
//   the file      the compose file is a copy that names the project and the build context by absolute path.
//
// Usage: node tools/rite-walk.mjs --image-leg --base <scratch dir> --project <name> --port <n> --image <tag>
//          --out <dir> [--from <step>] [--to <step>] [--keep]
//   --keep   leave the containers and the base standing after a walk that stops before `teardown`
//   rc 0  no step failed · rc 1  a step failed · rc 2  the walk refused before any act
import { execFileSync, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { RiteWalkRefusal, lineOf, quote, sha256, verdict } from "./steps.mjs";

const CHECKOUT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const SURFACE_COMPOSE = "docker-compose.surface.yml";
const IMAGE_SEAT = "/app/packages/lararium-sensorium/scripts/lares_mcp.py";
const CLI_IN_IMAGE = "packages/lares-cli/bin/lares.mjs";
const TEST_ROUTE = "--import=file:///app/tools/test-ward-route.mjs";
const STATE = "image-walk-state.json";

/** What the operator's own surface holds: no walk may name any of it. */
export const OPERATOR = Object.freeze({ project: "lares-surface", port: 4321, image: "lares-surface:local" });

// ── the scope ───────────────────────────────────────────────────────────────────────────────────────────────────────

const within = (outer, inner) => inner === outer || inner.startsWith(outer + sep);

/**
 * THE IMAGE SCOPE: the one compose project, port, image tag and scratch base a walk may touch. Refuses by name before
 * any act; answers the paths the walk stands on, every one beneath the base.
 */
export function assertImageScope({ base, project, port, image, realHome = homedir(), checkout = CHECKOUT } = {}) {
  for (const [name, value] of [["--base", base], ["--project", project], ["--port", port], ["--image", image]]) {
    if (value === undefined || value === "") throw new RiteWalkRefusal(`${name} names nothing; the image leg resolves no default scope`);
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(project)) throw new RiteWalkRefusal(`--project ${project} reads as no compose project name`);
  if (project === OPERATOR.project || project.startsWith(`${OPERATOR.project}-`)) throw new RiteWalkRefusal(`--project ${project} names the operator's own surface`);
  const portN = Number(port);
  if (!Number.isInteger(portN) || portN < 1024 || portN > 65535) throw new RiteWalkRefusal(`--port ${port} names no unprivileged port`);
  if (portN === OPERATOR.port) throw new RiteWalkRefusal(`--port ${port} names the operator's own surface port`);
  if (!/^[a-z0-9][a-z0-9._/-]*:[A-Za-z0-9._-]+$/.test(image)) throw new RiteWalkRefusal(`--image ${image} reads as no repository:tag`);
  if (image.split(":")[0] === OPERATOR.project) throw new RiteWalkRefusal(`--image ${image} names the operator's own image repository`);
  const at = resolve(base);
  const home = resolve(realHome);
  if (at === home || within(at, home)) throw new RiteWalkRefusal(`--base ${at} holds the home ${home}`);
  for (const kept of [".lares", ".claude", ".config", ".docker", ".codex"]) {
    if (within(join(home, kept), at)) throw new RiteWalkRefusal(`--base ${at} stands inside ${join(home, kept)}`);
  }
  if (within(resolve(checkout), at) || within(at, resolve(checkout))) throw new RiteWalkRefusal(`--base ${at} overlaps the checkout ${checkout}`);
  if (at === sep || at.split(sep).filter(Boolean).length < 3) throw new RiteWalkRefusal(`--base ${at} stands too near the filesystem root to clear`);
  return Object.freeze({
    base: at, project, port: portN, image,
    home: join(at, "home"), house: join(at, "house"), workspace: join(at, "workspace"),
    envFile: join(at, "home", ".lares", "lares-surface.env"), compose: join(at, SURFACE_COMPOSE),
    bin: join(at, "home", "bin"), dockerLog: join(at, "docker.log"),
  });
}

/** The scratch surface env, as compose and the host shim read it. */
export function surfaceEnvText(scope, { uid, gid, pulama = false }) {
  return [
    `LARES_HOUSE=${scope.house}`, `LARES_WORKSPACE=${scope.workspace}`, `LARES_PORT=${scope.port}`, "LARES_BIND=127.0.0.1",
    `LARES_IMAGE=${scope.image}`, ...(pulama ? ["LARES_PULAMA=1"] : []), `LARES_UID=${uid}`, `LARES_GID=${gid}`, `COMPOSE_PROJECT_NAME=${scope.project}`,
    "",
  ].join("\n");
}

/** The surface compose file's bytes under another project name and an absolute build context. Each rewrite lands once, or it refuses. */
export function composeCopy(text, { project, context }) {
  const once = (source, pattern, to, what) => {
    const hits = source.match(new RegExp(pattern.source, "gm"))?.length ?? 0;
    if (hits !== 1) throw new RiteWalkRefusal(`the surface compose file carries ${hits} ${what} line(s); the copy rewrites exactly one`);
    return source.replace(pattern, to);
  };
  const named = once(text, /^name: lares-surface$/m, `name: ${project}`, "`name: lares-surface`");
  return once(named, /^( {4}context: )\.$/m, `$1${context}`, "`context: .`");
}

/**
 * The `docker` wrapper's text. It logs each call, holds every compose call to the project, and refuses what the scope
 * forbids (exit 97, the call never reaching the engine).
 */
export function dockerWrapperText({ real, project, image, log }) {
  const q = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;
  return `#!/bin/sh
# rite-walk image leg: every docker call logs here, carries the project, and stays inside the scope.
REAL=${q(real)}; PROJECT=${q(project)}; IMAGE=${q(image)}; LOG=${q(log)}
fmt() {
  out=
  for a in "$@"; do
    flat=$(printf '%s' "$a" | tr '\\n' ' ')
    case "$flat" in *[!A-Za-z0-9_./:=@%+,-]*|'') out="$out '$flat'" ;; *) out="$out $flat" ;; esac
  done
  printf '%s' "$out"
}
line="docker$(fmt "$@")"
stamp() { date -u +%H:%M:%S; }
refuse() { printf '%s\\tREFUSED (%s)\\t%s\\n' "$(stamp)" "$1" "$line" >> "$LOG"; printf 'rite-walk docker wrapper: refused (%s): %s\\n' "$1" "$line" >&2; exit 97; }
for a in "$@"; do
  case "$a" in
    ${OPERATOR.project}|${OPERATOR.project}:*|${OPERATOR.project}-*|${OPERATOR.project}_*) refuse "names the operator's surface" ;;
    *:${OPERATOR.port}:*) refuse "publishes the operator's port" ;;
  esac
done
# A container a plain verb names must carry this project's label.
ours() {
  for a in "$@"; do
    case "$a" in -*) continue ;; esac
    name=\${a%%:*}
    label=$("$REAL" container inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$name" 2>/dev/null) || continue
    [ "$label" = "$PROJECT" ] || refuse "container $name belongs to project \${label:-none}"
  done
}
verb=\${1:-}
case "$verb" in
  compose)
    shift
    if [ "\${1:-}" = -p ]; then [ "\${2:-}" = "$PROJECT" ] || refuse "names another project"; shift 2; fi
    for a in "$@"; do case "$a" in -p|--project-name|--project-name=*) refuse "names a project past the first argument" ;; esac; done
    printf '%s\\tdocker compose -p %s%s\\n' "$(stamp)" "$PROJECT" "$(fmt "$@")" >> "$LOG"
    exec "$REAL" compose -p "$PROJECT" "$@" ;;
  image)
    [ "\${2:-}" = inspect ] || refuse "image takes inspect alone"
    for a in "$@"; do case "$a" in image|inspect|-*|'{{'*|"$IMAGE") ;; *) refuse "inspects an image outside the scope" ;; esac; done ;;
  inspect|cp|exec|stop|rm|logs|kill|pause|unpause) shift; ours "$@"; set -- "$verb" "$@" ;;
  version) ;;
  *) refuse "a verb outside the scope" ;;
esac
printf '%s\\t%s\\n' "$(stamp)" "$line" >> "$LOG"
exec "$REAL" "$@"
`;
}

// ── the receipt ─────────────────────────────────────────────────────────────────────────────────────────────────────

export const IMAGE_RITE = "lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama";
export const IMAGE_VIAS = Object.freeze(["staged-custody", "pty", "seat-stdio"]);
export const IMAGE_CAUSES = Object.freeze({
  "door-absent": "the CLI carries no such door at this head",
  "part-absent": "a part this step stands on has not landed at this head",
});

/** Hold image-leg rows to the outcome law; answers the faults by name. */
export function imageReceiptFaults(rows, steps = IMAGE_STEPS) {
  const table = new Map(steps.map((s) => [s.id, s]));
  const faults = [];
  for (const row of rows) {
    const step = table.get(row.step);
    if (!step) { faults.push(`${row.step}: no such step in the table`); continue; }
    if (!["pass", "fail", "unreached"].includes(row.outcome)) faults.push(`${row.step}: outcome ${JSON.stringify(row.outcome)}`);
    if (row.outcome === "unreached" && !row.cause) faults.push(`${row.step}: unreached and names no cause`);
    if (step.via && row.outcome === "pass" && row.via !== step.via) faults.push(`${row.step}: a bare pass over a ${step.via} stand-in`);
    if (typeof row.command !== "string" || row.command === "") faults.push(`${row.step}: names no command`);
  }
  for (const step of steps) if (!rows.some((r) => r.step === step.id)) faults.push(`${step.id}: the receipt carries no row`);
  return faults;
}

/** The image leg's receipt. `outcomes` digests what a replay compares: each step, its command, outcome, stand-in and cause. */
export function imageReceipt({ head, dirty, walker, scope, rows, legs, docker }) {
  const tally = { pass: 0, fail: 0, unreached: 0 };
  for (const r of rows) tally[r.outcome] += 1;
  const compared = rows.map((r) => [r.step, r.command, r.outcome, r.via ?? null, r.cause ?? null]);
  return {
    kind: "rite-walk-image-receipt", rite: IMAGE_RITE,
    inputs: { head, dirty, walker, scope: { project: scope.project, port: scope.port, image: scope.image, base: scope.base } },
    legs, tally: { ...tally, firstFail: rows.find((r) => r.outcome === "fail")?.step ?? null },
    outcomes: `sha256:${sha256(JSON.stringify(compared))}`,
    steps: rows, docker,
  };
}

/**
 * Walk image steps in order. `run(step)` answers `{ ok, answer, measures }` or `{ unreached, answer }`; a throw reads
 * as a fail carrying the error's words. A step whose `needs` did not pass reads `unreached: blocked:<step>`.
 */
export async function walkImage(steps, { run, now = () => performance.now(), say = () => {}, passed: before = [] }) {
  const rows = [];
  const passed = new Set(before);
  for (const step of steps) {
    const base = { step: step.id, command: step.command, expect: step.expect ?? null };
    const from = now();
    let row;
    const blocker = (step.needs ?? []).find((id) => !passed.has(id));
    if (blocker) row = { ...base, outcome: "unreached", cause: `blocked:${blocker}`, answer: "" };
    else {
      let result;
      try { result = await run(step); } catch (e) { result = { ok: false, answer: e?.message ?? String(e) }; }
      const measures = result?.measures ? { measures: result.measures } : {};
      if (result?.unreached) row = { ...base, outcome: "unreached", cause: result.unreached, answer: quote(result.answer ?? IMAGE_CAUSES[result.unreached] ?? ""), ...measures };
      else if (result?.ok) { row = { ...base, outcome: "pass", ...(step.via ? { via: step.via } : {}), answer: quote(result.answer), ...measures }; passed.add(step.id); }
      else row = { ...base, outcome: "fail", answer: quote(result?.answer), ...measures };
    }
    row.ms = Math.round(now() - from);
    rows.push(row);
    say(row);
  }
  return rows;
}

// ── the hands ───────────────────────────────────────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((settle) => setTimeout(settle, ms));

/** Run one command to its end: `{ code, stdout, stderr, ms }`. A bound that passes kills it and reads code 124. */
function run(command, args, { env, timeout = 120_000, input } = {}) {
  return new Promise((settle) => {
    const from = performance.now();
    const child = spawn(command, args, { env, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "", timedOut = false;
    child.stdout.on("data", (b) => { stdout += String(b); });
    child.stderr.on("data", (b) => { stderr += String(b); });
    const bound = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeout);
    child.once("error", (e) => { clearTimeout(bound); settle({ code: 127, stdout, stderr: `${stderr}${e.message}`, ms: Math.round(performance.now() - from) }); });
    child.once("close", (code) => { clearTimeout(bound); settle({ code: timedOut ? 124 : code ?? 1, stdout, stderr, ms: Math.round(performance.now() - from) }); });
    if (input !== undefined) child.stdin.end(input);
  });
}

/**
 * Run one command under a pseudo-terminal (`script`), typing each answer once its prompt shows, in order. `route` names
 * the one answer the quoted output redacts.
 */
function runPty(commandLine, { env, says, route, timeout = 60_000 }) {
  return new Promise((settle) => {
    const from = performance.now();
    const child = spawn("script", ["-qfec", commandLine, "/dev/null"], { env, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", at = 0, next = 0, timedOut = false;
    const see = (b) => {
      out += String(b);
      while (next < says.length) {
        const found = out.indexOf(says[next].prompt, at);
        if (found < 0) break;
        at = found + says[next].prompt.length;
        child.stdin.write(`${says[next].answer}\r`);
        next += 1;
      }
    };
    child.stdout.on("data", see);
    child.stderr.on("data", see);
    const bound = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeout);
    child.once("close", (code) => { clearTimeout(bound); settle({ code: timedOut ? 124 : code ?? 1, stdout: route ? out.split(route).join("<route>") : out, typed: next === says.length, ms: Math.round(performance.now() - from) }); });
  });
}

/** A scripted MCP client over one spawned aho. Every frame it reads and every aho log line carries the time it arrived. */
function ahoSession(argv, env) {
  const child = spawn(process.execPath, argv, { env, stdio: ["pipe", "pipe", "pipe"] });
  const pending = new Map(), events = [], waiters = [];
  let next = 1, exit = null, childStderr = "";
  createInterface({ input: child.stdout }).on("line", (line) => {
    let msg; try { msg = JSON.parse(line); } catch { return; }
    if (typeof msg.id === "number" && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  createInterface({ input: child.stderr }).on("line", (line) => {
    const m = /^aho: (\S+) generation=(\d+) pending=(\d+)/.exec(line);
    if (!m) { childStderr = `${childStderr}${line}\n`.slice(-4000); return; }
    const event = { at: performance.now(), event: m[1], generation: Number(m[2]), pending: Number(m[3]) };
    events.push(event);
    for (const w of [...waiters]) if (w.test(event)) { waiters.splice(waiters.indexOf(w), 1); w.settle(event); }
  });
  child.once("exit", (code, signal) => { exit = { code, signal }; for (const settle of pending.values()) settle(null); });
  const request = (method, params, bound = 60_000) => {
    const id = next++;
    const from = performance.now();
    const answer = new Promise((settle) => pending.set(id, settle));
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) })}\n`);
    return Promise.race([answer, sleep(bound).then(() => undefined)]).then((msg) => ({ msg, ms: Math.round(performance.now() - from) }));
  };
  return {
    events, request,
    notify: (method) => child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method })}\n`),
    /** The next aho log event after `since` that `test` accepts, or null once `bound` passes. */
    event: (test, since, bound = 60_000) => {
      const seen = events.find((e) => e.at >= since && test(e));
      if (seen) return Promise.resolve(seen);
      return Promise.race([new Promise((settle) => waiters.push({ test, settle })), sleep(bound).then(() => null)]);
    },
    alive: () => exit === null,
    exit: () => exit,
    surfaceStderr: () => childStderr,
    async close() {
      if (exit !== null) return;
      child.stdin.end();
      await Promise.race([new Promise((settle) => child.once("exit", settle)), sleep(10_000).then(() => child.kill("SIGKILL"))]);
    },
  };
}

/** A tool call's answer as one line: the error text where the result reads `isError`, else its first text. */
function toolAnswer(msg) {
  if (msg === undefined) return { error: true, text: "no answer within the bound" };
  if (msg === null) return { error: true, text: "the aho exited" };
  if (msg.error) return { error: true, text: `rpc error ${msg.error.code}: ${msg.error.message}` };
  const text = (msg.result?.content ?? []).map((c) => c?.text ?? "").join(" ").trim();
  return { error: msg.result?.isError === true, text: text || JSON.stringify(msg.result?.structuredContent ?? msg.result ?? null) };
}

/**
 * The hands the image steps run with, over one scope. The checkout holds the shim, the tools, the compose source, the
 * build context and the tree the workspace clones.
 */
export function imageHands(scope, state) {
  const checkout = CHECKOUT;
  const uid = process.getuid(), gid = process.getgid();
  const env = (() => {
    const e = { ...process.env };
    for (const k of Object.keys(e)) if (/^(LAR_|LARES_|COMPOSE_|GIT_DIR$|GIT_WORK_TREE$|GIT_INDEX_FILE$|GIT_COMMON_DIR$|NODE_OPTIONS$|DOCKER_)/.test(k)) delete e[k];
    return {
      ...e, HOME: scope.home, PATH: `${scope.bin}:${e.PATH}`, COMPOSE_PROJECT_NAME: scope.project, LARES_COMPOSE_FILE: scope.compose,
      LARES_HOUSE: scope.house, LARES_WORKSPACE: scope.workspace, LARES_PORT: String(scope.port), LARES_BIND: "127.0.0.1",
      LARES_IMAGE: scope.image, ...(state.vars.pulama ? { LARES_PULAMA: "1" } : {}), LARES_UID: String(uid), LARES_GID: String(gid), NO_COLOR: "1",
    };
  })();
  const shimPath = join(checkout, "tools", "lares-container.sh");
  const composeArgs = ["compose", "-p", scope.project, "--env-file", scope.envFile, "-f", scope.compose];
  const docker = (args, opts) => run("docker", args, { env, ...opts });
  const compose = (args, opts) => docker([...composeArgs, ...args], opts);
  const shim = (args, opts) => run(shimPath, args, { env, ...opts });
  const said = (r) => `${r.stdout}\n${r.stderr}`;
  const cid = async (service) => (await compose(["--profile", "pulama", "ps", "-q", service])).stdout.trim().split("\n")[0] ?? "";
  let aho = null;

  const hands = {
    scope, env, vars: state.vars, uid, gid, docker, compose, shim, said, cid, sleep, checkout,
    head: () => execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    shimLine: (args) => `${shimPath} ${args.join(" ")}`,
    pty: (commandLine, opts) => runPty(commandLine, { env, ...opts }),
    hostCli: (args, opts) => run(process.execPath, [join(checkout, CLI_IN_IMAGE), ...args], { env, ...opts }),
    /** Lay the scratch ground: the base, the home and its env file, the wrapper, the compose copy, the house classes, the workspace worktree. */
    stage() {
      const real = execFileSync("sh", ["-c", "command -v docker"], { encoding: "utf8" }).trim();
      if (within(scope.base, real)) throw new RiteWalkRefusal(`docker already resolves inside the base (${real})`);
      for (const dir of [scope.bin, join(scope.home, ".lares"), ...["hearth", "sensoriums", "projections", "library", "config", "pulama/state"].map((c) => join(scope.house, c))]) mkdirSync(dir, { recursive: true });
      writeFileSync(scope.envFile, surfaceEnvText(scope, { uid, gid, pulama: state.vars.pulama === true }));
      writeFileSync(join(scope.bin, "docker"), dockerWrapperText({ real, project: scope.project, image: scope.image, log: scope.dockerLog }));
      chmodSync(join(scope.bin, "docker"), 0o755);
      writeFileSync(scope.compose, composeCopy(readFileSync(join(checkout, SURFACE_COMPOSE), "utf8"), { project: scope.project, context: checkout }));
      // THE WORKSPACE IS A CLONE, never a worktree: a worktree's `.git` is a file naming a host path no container
      // reaches, and the vessel asks git in `/workspace` for the head's tree. A local clone carries its own objects.
      if (!existsSync(scope.workspace)) {
        const head = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
        execFileSync("git", ["clone", "--quiet", "--local", "--no-checkout", checkout, scope.workspace], { stdio: "pipe" });
        execFileSync("git", ["-C", scope.workspace, "checkout", "--quiet", "--detach", head], { stdio: "pipe" });
      }
    },
    /** Stand the house with a pūlama (`LARES_PULAMA=1` in the surface env and this walk's own) or without one. */
    pulamaMode(on) {
      state.vars.pulama = on;
      if (on) env.LARES_PULAMA = "1"; else delete env.LARES_PULAMA;
      writeFileSync(scope.envFile, surfaceEnvText(scope, { uid, gid, pulama: on }));
    },
    /** What compose itself resolves: the project, the vessel's image and published port, every bind source. Refuses outside the scope. */
    async proveScope() {
      const r = await compose(["--profile", "pulama", "--profile", "offline", "config", "--format", "json"]);
      if (r.code !== 0) throw new RiteWalkRefusal(`compose resolves no configuration: ${lineOf(r.stderr)}`);
      const config = JSON.parse(r.stdout);
      const faults = [];
      if (config.name !== scope.project) faults.push(`project ${config.name}`);
      for (const [name, service] of Object.entries(config.services ?? {})) {
        if (service.image !== scope.image) faults.push(`${name} image ${service.image}`);
        for (const p of service.ports ?? []) if (String(p.published) !== String(scope.port) || p.host_ip !== "127.0.0.1") faults.push(`${name} publishes ${p.host_ip}:${p.published}`);
        for (const v of service.volumes ?? []) if (v.type === "bind" && !within(scope.base, v.source)) faults.push(`${name} binds ${v.source}`);
      }
      if (faults.length > 0) throw new RiteWalkRefusal(`compose resolves outside the scope: ${faults.join("; ")}`);
      return `compose resolves project ${config.name}, image ${scope.image}, port 127.0.0.1:${scope.port}, every bind beneath ${scope.base}`;
    },
    /** The aho over this scope's surface: one seat, held across steps. */
    aho() {
      if (aho === null || !aho.alive()) {
        const line = ["docker", ...composeArgs, "exec", "-T", "-e", "LAR_ROOT", "lares", "python3", IMAGE_SEAT];
        aho = ahoSession([join(checkout, CLI_IN_IMAGE), "mcp", "aho", "--", ...line], { ...env, LAR_ROOT: "/lar" });
        aho.line = `lares mcp aho -- ${line.join(" ")}`;
        aho.fresh = true;
      }
      return aho;
    },
    toolAnswer,
    async close() { if (aho !== null) await aho.close(); },
    /** Every Docker call the wrapper saw, in order. */
    dockerLog: () => (existsSync(scope.dockerLog) ? readFileSync(scope.dockerLog, "utf8").split("\n").filter(Boolean) : []),
    /** Take down this project's containers and its named volumes (the pūlama's socket volume), and clear the base (`keepBase` leaves it standing). Answers what it left. */
    async teardown({ keepBase = false } = {}) {
      await hands.close();
      const down = await compose(["--profile", "pulama", "--profile", "offline", "down", "--volumes", "--remove-orphans", "--timeout", "20"], { timeout: 180_000 });
      const left = await compose(["--profile", "pulama", "--profile", "offline", "ps", "-a", "-q"]);
      const log = hands.dockerLog();
      if (!keepBase) rmSync(scope.base, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
      return { downCode: down.code, containers: left.stdout.trim(), baseStands: existsSync(scope.base), log };
    },
  };
  return hands;
}

// ── the step table ──────────────────────────────────────────────────────────────────────────────────────────────────

export const TEST_PASSPHRASE = "test-founding-passphrase";
const STEWARD = "joshua-fontany";
const READ_TOOL = "status";
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };
/** The last JSON object a mixed answer carries. */
export const lastJson = (text) => { const at = text.lastIndexOf("\n{"); return json(at < 0 ? text.trim() : text.slice(at + 1).trim()) ?? json(text.trim()); };
/** The custody door's one word, as the shim reads it: `{ unlocked }`, null where the answer names none. */
export const unlockedOf = (text) => { const m = /"unlocked"\s*:\s*(true|false)/.exec(text); return { unlocked: m ? m[1] === "true" : null }; };
export const refusal = (r) => `exit ${r.code}: ${lineOf(`${r.stdout}\n${r.stderr}`)}`;

export const build = async (h) => {
  const head = h.head();
  const r = await h.shim(["build"], { timeout: 45 * 60_000 });
  if (r.code !== 0) return { ok: false, answer: refusal(r), measures: { seconds: Math.round(r.ms / 1000) } };
  const seen = await h.docker(["image", "inspect", "--format", '{{.Id}} {{ index .Config.Labels "org.opencontainers.image.revision" }} {{.Size}}', h.scope.image]);
  const [id, revision, size] = seen.stdout.trim().split(" ");
  h.vars.imageId = id;
  return { ok: revision === head, answer: `${h.scope.image} ${id} stamped revision ${revision}${revision === head ? "" : ` (the checkout stands at ${head})`}`, measures: { seconds: Math.round(r.ms / 1000), imageId: id, revision, bytes: Number(size) } };
};

export const stageCustody = async (h) => {
  const tools = `${join(h.checkout, "tools")}:/app/tools:ro`;
  const r = await h.compose(["--profile", "offline", "run", "--rm", "-T", "--entrypoint", "sh", "-v", `${h.scope.house}:/lar`, "-v", tools, "offline", "-ec",
    "node tools/test-scratch-marker.mjs /lar && node tools/seed-test-custody.mjs /lar"], { timeout: 180_000 });
  const marker = existsSync(join(h.scope.house, ".lar-test-scratch"));
  return { ok: r.code === 0 && marker, answer: r.code === 0 ? `the marker stands at the house root: ${marker}; the custody tree stands under the published test route` : refusal(r) };
};

export const found = async (h) => {
  const r = await h.compose(["--profile", "offline", "run", "--rm", "-T", "-v", `${join(h.checkout, "tools")}:/app/tools:ro`,
    "-v", `${join(h.scope.house, ".lar-test-scratch")}:/lar/.lar-test-scratch:ro`, "-e", `NODE_OPTIONS=${TEST_ROUTE}`,
    "offline", "vessel", "found", "--skip-build", "--root", "/lar", "--genesis", "/app/genesis", "--hearth", "--name", STEWARD, "--chair", "dreamnet-kahu-0", "--no-json"], { timeout: 300_000 });
  const text = h.said(r);
  return { ok: r.code === 0 && text.includes("the hearth stands"), answer: r.code === 0 ? lineOf(text, "the hearth stands") : refusal(r), measures: { seconds: Math.round(r.ms / 1000) } };
};

export const pulamaUp = async (h) => {
  h.pulamaMode(true);
  const r = await h.shim(["pulama", "up"], { timeout: 180_000 });
  if (r.code !== 0) return { ok: false, answer: refusal(r) };
  let line = "", status = "";
  for (let i = 0; i < 40 && !line; i++) {
    const id = await h.cid("pulama");
    status = id ? (await h.docker(["inspect", "--format", "{{.State.Status}} restarts={{.RestartCount}}", id])).stdout.trim() : "no container";
    const logs = id ? await h.docker(["logs", id]) : { stdout: "", stderr: "" };
    line = h.said(logs).split("\n").find((l) => l.includes("standing unlit")) ?? "";
    if (!line) { if (/restarts=[1-9]/.test(status)) { line = ""; return { ok: false, answer: `the pūlama restarts: ${status}: ${lineOf(h.said(logs))}` }; } await h.sleep(500); }
  }
  return { ok: line !== "", answer: line ? `${status} · ${line.trim()}` : `the pūlama never said it stands: ${status}`, measures: { upMs: r.ms } };
};

const pulamaMeasure = async (h) => {
  const id = await h.cid("pulama");
  const seen = await h.docker(["inspect", "--format", "{{.HostConfig.ReadonlyRootfs}} {{.Config.User}} {{.HostConfig.NetworkMode}} {{.State.Status}} {{.RestartCount}}", id]);
  const [readOnly, user, network, status, restarts] = seen.stdout.trim().split(" ");
  // THE SOCKET'S MOUNT: a named volume, never a bind of a host path (docker-compose.surface.yml, `lares-pulama-socket`).
  const mounts = await h.docker(["inspect", "--format", '{{range .Mounts}}{{if eq .Destination "/pulama/socket"}}{{.Type}} {{.Name}}{{end}}{{end}}', id]);
  const [socketMountType, socketVolume] = mounts.stdout.trim().split(" ");
  const inside = await h.compose(["--profile", "pulama", "exec", "-T", "pulama", "sh", "-c",
    'id -u; id -g; stat -c "%u:%g %a" /pulama/socket/pulama.sock; stat -c "%u:%g %a" /pulama/socket; stat -c "%u:%g %a" /lar/run/pulama-hand.sock; if touch /app/rite-walk-probe 2>/dev/null; then echo root-writable; else echo root-read-only; fi']);
  const [inUid, inGid, vesselSock, socketDir, handSock, rootProbe] = inside.stdout.trim().split("\n");
  const hostSocketDir = join(h.scope.house, "pulama", "socket");
  const [sockOwner, sockMode] = (vesselSock ?? "").split(" ");
  const measures = {
    readOnlyRootfs: readOnly === "true", rootProbe, user, network, status, restarts: Number(restarts),
    processUid: Number(inUid), processGid: Number(inGid), vesselSocketInside: vesselSock, socketDirInside: socketDir, handSocketInside: handSock,
    socketMount: { type: socketMountType ?? "", volume: socketVolume ?? "" }, hostSocketDirStands: existsSync(hostSocketDir),
    socketPathBytes: { inContainer: Buffer.byteLength("/pulama/socket/pulama.sock"), hand: Buffer.byteLength("/lar/run/pulama-hand.sock"), max: 107 },
  };
  const ok = measures.readOnlyRootfs && rootProbe === "root-read-only" && status === "running" && measures.restarts === 0
    && measures.processUid === h.uid && sockOwner === `${h.uid}:${h.gid}` && sockMode === "600"
    && measures.socketMount.type === "volume" && !measures.hostSocketDirStands && measures.socketPathBytes.inContainer <= 107;
  return { ok, answer: `read-only root ${readOnly} (${rootProbe}); runs as ${inUid}:${inGid}, network ${network}; vessel socket ${vesselSock} inside (dir ${socketDir}); /pulama/socket mounts as ${socketMountType} ${socketVolume ?? ""}, the host house holds ${measures.hostSocketDirStands ? "a socket directory" : "no socket directory"}; path ${measures.socketPathBytes.inContainer} bytes inside, of ${measures.socketPathBytes.max}`, measures };
};

export const pulamaStatus = (wantLit) => async (h) => {
  const r = await h.shim(["pulama", "status"]);
  const status = lastJson(r.stdout);
  if (r.code !== 0 || status === null) return { ok: false, answer: refusal(r) };
  h.vars.pulamaStatus = status;
  return { ok: status.lit === wantLit, answer: JSON.stringify(status), measures: { status } };
};

export const pulamaLight = async (h) => {
  const r = await h.pty(h.shimLine(["pulama", "light"]), { says: [{ prompt: "route: ", answer: TEST_PASSPHRASE }], route: TEST_PASSPHRASE, timeout: 120_000 });
  const after = await h.shim(["pulama", "status"]);
  const status = lastJson(after.stdout);
  const flat = r.stdout.replace(/\r/g, "").trim();
  return { ok: r.code === 0 && status?.lit === true, answer: `exit ${r.code}; route typed: ${r.typed}; ${quote(flat).slice(0, 200)} · status ${JSON.stringify(status)}`, measures: { ms: r.ms, status } };
};

const vesselLog = async (h) => { const id = await h.cid("lares"); return id ? h.said(await h.docker(["logs", id])) : ""; };
const pulamaLines = (log) => log.split("\n").filter((l) => l.includes("[pulama]")).map((l) => l.trim());

/** The unlock's three prompts on a terminal, answered under the published test route. */
export const UNLOCK_SAYS = [{ prompt: "(p): ", answer: "p" }, { prompt: "passphrase: ", answer: TEST_PASSPHRASE }, { prompt: "[y/N]: ", answer: "n" }];
export const tail = (text) => quote(text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean).slice(-2).join(" · "));
/** `up` on a terminal, as the operator runs it: the shim stands the vessel, then runs the unlock attached. */
const upOnTerminal = (h) => h.pty(h.shimLine(["up"]), { says: UNLOCK_SAYS, route: TEST_PASSPHRASE, timeout: 420_000 });
const unlockOnTerminal = (h) => h.pty(h.shimLine(["vault", "unlock", "--all", "--face", "0"]), { says: UNLOCK_SAYS, route: TEST_PASSPHRASE, timeout: 120_000 });
const vaultUnlocked = async (h) => unlockedOf((await h.shim(["vault", "status", "--json"])).stdout).unlocked;

export const upOwn = async (h) => {
  const r = await upOnTerminal(h);
  const unlocked = await vaultUnlocked(h);
  return { ok: r.code === 0 && unlocked === true, answer: `exit ${r.code}; the unlock ran attached: ${r.typed}; vault unlocked: ${unlocked} · ${tail(r.stdout)}`, measures: { seconds: Math.round(r.ms / 1000), unlocked } };
};

/** The reading the vessel's last `serves no session` line names (`…: <reading>; …` or `… (<reading>)`), or null where none stands. */
export function pulamaWaits(lines) {
  for (const line of [...lines].reverse()) {
    const m = /serves no session(?::\s*|\s*\()([a-z0-9-]+)/.exec(line);
    if (m) return m[1];
  }
  return null;
}

/**
 * The seat after `up`: exit 0 and the vessel's own `[pulama]` line (its holder dialed the socket); whether the up recreated
 * the container rides the answer (a kūkulu before it may already stand a new one). Whether the pūlama SERVES it rides the answer by name: an image the host just reported stands unadmitted until the
 * operator's hand admits it (`pulama admit`), or a kūkulu lands par.
 */
export function judgeUpPulama({ code, before, after, lines }) {
  const recreated = after !== before && after !== "";
  const waits = pulamaWaits(lines);
  const said = waits === null ? "" : ` · the pūlama waits: ${waits}${waits === "pulama-image-unadmitted" ? " (the operator admits the image with `lares-container.sh pulama admit`, the route typed)" : ""}`;
  return { ok: code === 0 && lines.length > 0, answer: `exit ${code}; a new vessel container: ${recreated}; ${lines.at(-1) ?? "its log carries no [pulama] line"}${said}`, waits };
}

/** The first `up` beside a lit pūlama: the vessel seats its holder over the socket and offers what it wears. */
export const upPulama = async (h) => {
  const before = await h.cid("lares");
  const r = await upOnTerminal(h);
  const after = await h.cid("lares");
  const lines = pulamaLines(await vesselLog(h));
  const unlocked = await vaultUnlocked(h);
  const j = judgeUpPulama({ code: r.code, before, after, lines });
  return { ok: j.ok, answer: `${j.answer}; vault unlocked: ${unlocked} · ${tail(r.stdout)}`,
    measures: { seconds: Math.round(r.ms / 1000), recreated: after !== before, unlockPrompted: r.typed, unlocked, waits: j.waits, pulamaLines: lines.slice(-6) } };
};

/** The admission's answer: the route typed, and the pūlama reads `admitted`; any other reading fails by its name. */
export function judgePulamaAdmit(r, answer) {
  const ok = r?.code === 0 && r?.typed === true && answer?.reading === "admitted" && Array.isArray(answer?.lent) && answer.lent.length > 0;
  return { ok, answer: `exit ${r?.code}; route typed: ${r?.typed === true}; reading ${answer?.reading ?? "(none)"}${answer?.admitted ? ` · admitted ${answer.admitted} for faces ${answer.lent?.map(n => `h${n}`).join(", ")}` : ""}` };
}

/** The admission names the selected faces; an empty selection admits every lit face. */
export const pulamaAdmitArgs = (faces = []) => ["pulama", "admit", ...faces.map(String)];

/** THE OPERATOR'S HAND ADMITS THE IMAGE the host reported at `up`: `pulama admit` reads the route on a terminal (the
 *  published test route here) and proves it against the lit holder; it opens nothing. */
export const pulamaAdmit = async (h) => {
  const r = await h.pty(h.shimLine(pulamaAdmitArgs()), { says: [{ prompt: "to admit ", answer: TEST_PASSPHRASE }], route: TEST_PASSPHRASE, timeout: 120_000 });
  const j = judgePulamaAdmit(r, lastJson(r.stdout.replace(/\r/g, "")));
  return { ...j, measures: { ms: r.ms } };
};

/** `vault unlock` at a vessel whose holder rests at the pūlama: the terminal's answer, quoted. */
export const unlockUnderPulama = async (h) => {
  if (await vaultUnlocked(h) === true) return { ok: true, answer: "the vessel already stands unlocked by the pūlama's session; no unlock ran" };
  const r = await unlockOnTerminal(h);
  const unlocked = await vaultUnlocked(h);
  const said = tail(r.stdout);
  return { ok: unlocked === true, answer: `exit ${r.code}; the terminal asked for the route: ${r.typed}; vault unlocked: ${unlocked} · ${said}`, measures: { exit: r.code, routePrompted: r.typed, unlocked, said } };
};

const observe = async (h) => {
  const seen = await h.shim(["vessel", "stand", "--observe", "--json"]);
  const vault = await h.shim(["vault", "status", "--json"]);
  const standing = json(seen.stdout.trim())?.data?.standing ?? json(seen.stdout.trim())?.standing ?? null;
  const custody = unlockedOf(vault.stdout);
  const lines = pulamaLines(await vesselLog(h));
  const pulama = await h.shim(["pulama", "status"]);
  const status = lastJson(pulama.stdout);
  // THE SEAT, not the session: the vessel's own `[pulama]` line proves its holder dialed the socket. Whether the pūlama
  // served it (a kūkulu wearing a vouched lei) rides the answer and the measures.
  const ok = seen.code === 0 && standing !== null && lines.length > 0;
  return { ok, answer: `standing ${JSON.stringify(standing)} · vault unlocked: ${custody?.unlocked} · pūlama sessions: ${status?.sessions} · ${lines.at(-1) ?? "no [pulama] line"}`, measures: { standing, custody, pulama: status, pulamaLines: lines.slice(-6) } };
};

/** Open the seat where none stands: initialize, the initialized note, and the protocol the surface negotiates. */
async function seated(h) {
  const seat = h.aho();
  if (!seat.fresh) return seat;
  seat.fresh = false;
  const init = await seat.request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "rite-walk-image", version: "0" } }, 120_000);
  if (!init.msg?.result) throw new Error(`the aho answered no initialize: ${JSON.stringify(init.msg ?? null)} ${lineOf(seat.surfaceStderr())}`);
  seat.notify("notifications/initialized");
  h.vars.protocol = init.msg.result.protocolVersion;
  h.vars.server = init.msg.result.serverInfo ?? null;
  h.vars.initMs = init.ms;
  return seat;
}
const call = async (seat, bound) => { const r = await seat.request("tools/call", { name: READ_TOOL, arguments: {} }, bound); return { ...toolAnswer(r.msg), ms: r.ms }; };

const ahoHandshake = async (h) => {
  const seat = await seated(h);
  const list = await seat.request("tools/list", {});
  const tools = (list.msg?.result?.tools ?? []).map((t) => t.name);
  const read = await call(seat);
  const measures = { protocolVersion: h.vars.protocol, serverInfo: h.vars.server, initializeMs: h.vars.initMs, tools: tools.length, listMs: list.ms, readTool: READ_TOOL, readMs: read.ms, readError: read.error };
  return { ok: tools.includes(READ_TOOL) && !read.error, answer: `protocol ${h.vars.protocol} · ${tools.length} tools · ${READ_TOOL} → ${read.text.slice(0, 160)}`, measures };
};

/**
 * Poll the read tool until it answers clean, naming each distinct answer on the way. A vessel that returns from a fall
 * rests at the floor, so the first `vessel-locked` answer runs the unlock on a terminal once, as the operator would.
 */
async function untilReads(seat, h, bound = 240_000) {
  const from = performance.now(), seen = [];
  let unlockedAt = null;
  while (performance.now() - from < bound) {
    const r = await call(seat, 30_000);
    const word = r.error ? r.text.replace(/^Error executing tool \S+: /, "").slice(0, 60) : "ok";
    if (seen.at(-1)?.answer !== word) seen.push({ atMs: Math.round(performance.now() - from), answer: word });
    if (!r.error) return { ok: true, ms: Math.round(performance.now() - from), seen, unlockedAt };
    if (unlockedAt === null && r.text.includes("vessel-locked")) { await unlockOnTerminal(h); unlockedAt = Math.round(performance.now() - from); continue; }
    await h.sleep(500);
  }
  return { ok: false, ms: Math.round(performance.now() - from), seen, unlockedAt };
}

const ahoStop = async (h) => {
  const seat = await seated(h);
  const before = await call(seat);
  if (before.error) return { ok: false, answer: `the seat reads no clean call before the stop: ${before.text}` };
  const from = performance.now();
  const stopping = h.compose(["stop", "lares"], { timeout: 120_000 });
  const fell = await seat.event((e) => e.event === "child-down", from, 120_000);
  const stopped = await stopping;
  const asleep = await call(seat, 30_000);
  const alive = seat.alive();
  const started = performance.now();
  const start = await h.shim(["up"], { timeout: 420_000 });
  const back = await untilReads(seat, h);
  const inits = seat.events.filter((e) => e.at >= from).map((e) => `${Math.round(e.at - from)}:${e.event}`);
  const measures = {
    childDiedMs: fell ? Math.round(fell.at - from) : null, composeStopMs: stopped.ms, ahoAlive: alive,
    asleepAnswer: asleep.text.slice(0, 120), asleepMs: asleep.ms, upMs: start.ms, readsAgainMs: Math.round(performance.now() - started), interim: back.seen, ahoEvents: inits,
  };
  const ok = fell !== null && alive && asleep.error && asleep.text.startsWith("hearth-sleeps") && start.code === 0 && back.ok;
  return { ok, answer: `the exec child died ${measures.childDiedMs} ms after the stop began (compose stop took ${stopped.ms} ms); the aho lives: ${alive}; a call while down → ${asleep.text.slice(0, 60)} in ${asleep.ms} ms; after up the same seat reads again with no initialize from the client`, measures };
};

const ahoRestart = async (h) => {
  const seat = await seated(h);
  const from = performance.now();
  const restarting = h.compose(["restart", "lares"], { timeout: 180_000 });
  const fell = await seat.event((e) => e.event === "child-down", from, 120_000);
  const stood = fell ? await seat.event((e) => e.event === "child-standing", fell.at, 180_000) : null;
  const restarted = await restarting;
  const back = await untilReads(seat, h);
  const measures = {
    childDiedMs: fell ? Math.round(fell.at - from) : null, childStandingMs: stood ? Math.round(stood.at - from) : null, composeRestartMs: restarted.ms,
    readsAgainMs: back.ms, interim: back.seen, ahoAlive: seat.alive(), ahoEvents: seat.events.filter((e) => e.at >= from).map((e) => `${Math.round(e.at - from)}:${e.event}`),
  };
  return { ok: fell !== null && seat.alive() && back.ok, answer: `restart: the exec child died at ${measures.childDiedMs} ms, a fresh one stood at ${measures.childStandingMs} ms, the restart returned at ${restarted.ms} ms; the read answers clean ${back.ms} ms after that; interim answers: ${back.seen.map((s) => s.answer).join(" → ")}`, measures };
};

const ahoInFlight = async (h) => {
  const seat = await seated(h);
  const paused = await h.compose(["pause", "lares"]);
  if (paused.code !== 0) return { ok: false, answer: `pause: ${refusal(paused)}` };
  const from = performance.now();
  const flying = call(seat, 120_000);
  await h.sleep(1500);
  const killAt = performance.now();
  const killed = await h.compose(["kill", "lares"]);
  const landed = await flying;
  const answeredMs = Math.round(performance.now() - killAt);
  const alive = seat.alive();
  const start = await h.shim(["up"], { timeout: 420_000 });
  const back = await untilReads(seat, h);
  const measures = { heldMs: Math.round(killAt - from), answeredMsAfterKill: answeredMs, killCode: killed.code, answer: landed.text.slice(0, 120), ahoAlive: alive, upCode: start.code, readsAgainMs: back.ms, interim: back.seen };
  const ok = landed.error && landed.text.startsWith("outcome-unknown") && alive && start.code === 0 && back.ok;
  return { ok, answer: `a call held in a paused vessel for ${measures.heldMs} ms, then the vessel killed → ${landed.text.slice(0, 60)}; the aho lives: ${alive}; after up the seat reads again`, measures };
};

/** The checkout's branch, or the head where it stands detached. */
const branchOf = () => { try { return execFileSync("git", ["-C", CHECKOUT, "symbolic-ref", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return "HEAD"; } };
const doorAbsent = (text) => /unknown (command|verb|sub-?verb|flag)|no such (command|verb)|name a sub-verb|not a lares command/i.test(text);
/** A ward act on a terminal: the one prompt a ward asks, answered under the published test route. */
export const WARD_SAYS = [{ prompt: "passphrase for this one act: ", answer: TEST_PASSPHRASE }];

const leiKui = async (h) => {
  const branch = branchOf();
  const line = ["lei", "kui", "--rite", "kukulu", "--branch", branch, "--returns", "2", "--json"];
  // With no terminal the ward refuses by name; on one, the hand types the face's route for this act alone.
  const plain = await h.shim(line, { timeout: 120_000 });
  const r = await h.pty(h.shimLine(line), { says: WARD_SAYS, route: TEST_PASSPHRASE, timeout: 120_000 });
  const answer = lastJson(r.stdout.replace(/\r/g, ""));
  const show = await h.shim(["lei", "show", "--rite", "kukulu", "--branch", branch, "--json"]);
  const standing = json(show.stdout.trim())?.data?.lei ?? null;
  return { ok: r.code === 0 && answer?.ok === true && standing?.standing === true, answer: `exit ${r.code}; the ward asked on the terminal: ${r.typed}; ${JSON.stringify(answer?.data ?? null)} · the line reads ${JSON.stringify(standing)}`,
    measures: { branch, exit: r.code, wardPrompted: r.typed, withNoTerminal: quote(refusal(plain)).slice(0, 200), standing } };
};

const riteKukulu = async (h) => {
  const before = await h.cid("lares");
  const r = await h.hostCli(["rite", "kukulu", "--no-json"], { timeout: 45 * 60_000 });
  const after = await h.cid("lares");
  const vault = await h.shim(["vault", "status", "--json"]);
  const custody = unlockedOf(vault.stdout);
  const rose = after !== "" && after !== before;
  const ok = r.code === 0 && rose && custody?.unlocked === true;
  return { ok, answer: `exit ${r.code}: ${lineOf(h.said(r))} · a new vessel rose: ${rose} · vault unlocked with no unlock typed: ${custody?.unlocked}`, measures: { seconds: Math.round(r.ms / 1000), before: before.slice(0, 12), after: after.slice(0, 12), custody, said: quote(h.said(r)) } };
};

const riteReceipts = async (h) => {
  const r = await h.shim(["rite", "receipts", "--json"], { timeout: 120_000 });
  const answer = json(r.stdout.trim());
  const conferre = answer?.data?.conferre ?? null;
  const par = conferre?.par ?? null, red = conferre?.red ?? null;
  const count = (x) => (Array.isArray(x) ? x.length : x);
  return { ok: r.code === 0 && count(par) >= 1 && count(red) === 0, answer: r.code === 0 ? `conferre: ${JSON.stringify(conferre)}` : refusal(r), measures: { exit: r.code, conferre, receipts: count(answer?.data?.receipts ?? null) } };
};

const shimDown = async (h) => {
  // On a terminal, as the operator runs it. A vessel at the floor stood locked since it booted, so its census reads clean and
  // `down` stops asking nothing; no typed word stops a vessel over what its census names.
  const r = await h.pty(h.shimLine(["down"]), { says: [], timeout: 180_000 });
  r.stderr = "";
  const vessel = await h.cid("lares");
  const pulama = await h.cid("pulama");
  const running = pulama ? (await h.docker(["inspect", "--format", "{{.State.Status}}", pulama])).stdout.trim() : "absent";
  const status = lastJson((await h.shim(["pulama", "status"])).stdout);
  const said = r.stdout.replace(/\r/g, "");
  const refused = /down refuses/.test(said);
  return { ok: r.code === 0 && !refused && vessel === "" && running === "running" && status?.lit === true, answer: `exit ${r.code}; refused: ${refused}; vessel container: ${vessel ? "stands" : "gone"} · pūlama: ${running}, lit ${status?.lit} · ${tail(r.stdout)}`, measures: { exit: r.code, refused, said: quote(said), pulama: status } };
};

const teardown = async (h) => {
  const t = await h.teardown();
  h.vars.tornDown = true;
  h.vars.dockerLog = t.log;
  return { ok: t.downCode === 0 && t.containers === "" && !t.baseStands, answer: `compose down exit ${t.downCode}; containers left in the project: ${t.containers === "" ? "none" : t.containers}; the base stands: ${t.baseStands}; the image ${h.scope.image} stays`, measures: { containersLeft: t.containers, baseStands: t.baseStands } };
};

const SC = "staged-custody";
export const IMAGE_STEPS = Object.freeze([
  { id: "build", command: "lares-container.sh build", expect: "the image stands stamped at the checkout's head", run: build },
  { id: "stage-custody", command: "test-scratch-marker.mjs /lar && seed-test-custody.mjs /lar (in the image)", via: SC, needs: ["build"], expect: "the marker and the custody tree stand", run: stageCustody },
  { id: "found", command: `lares found --hearth --name '${STEWARD}' --chair 'dreamnet-kahu-0'`, via: SC, needs: ["stage-custody"], expect: "the hearth stands", run: found },
  // The vessel holds its own custody: the hand strings a lei only at a vessel its own route opened.
  { id: "up", command: "lares-container.sh up", via: "pty", needs: ["found"], expect: "the vessel answers healthy, then the unlock on the terminal", run: upOwn },
  { id: "aho-handshake", command: "lares mcp aho -- docker compose -p <project> … exec -T -e LAR_ROOT lares python3 lares_mcp.py", via: "seat-stdio", needs: ["up"], expect: "initialize, tools/list, one read", run: ahoHandshake },
  { id: "aho-stop", command: "docker compose stop lares · a call · lares-container.sh up", via: "seat-stdio", needs: ["aho-handshake"], expect: "hearth-sleeps at once; the seat reads again with no initialize", run: ahoStop },
  { id: "aho-restart", command: "docker compose restart lares", via: "seat-stdio", needs: ["aho-handshake"], expect: "the child falls and a fresh one stands under the same seat", run: ahoRestart },
  { id: "aho-in-flight", command: "docker compose pause lares · a call · docker compose kill lares", via: "seat-stdio", needs: ["aho-handshake"], expect: "outcome-unknown", run: ahoInFlight },
  { id: "lei-kui", command: "lares lei kui --rite kukulu --branch <branch> --returns 2", via: "pty", needs: ["up"], expect: "the lei strings", run: leiKui },
  // The pūlama stands beside the vessel (LARES_PULAMA=1 from here on).
  { id: "pulama-up", command: "lares-container.sh pulama up", needs: ["found"], expect: "standing unlit", run: pulamaUp },
  { id: "pulama-status", command: "lares-container.sh pulama status", needs: ["pulama-up"], expect: "lit: false", run: pulamaStatus(false) },
  { id: "pulama-measure", command: "docker inspect · stat (the read-only root, the uid, the socket)", needs: ["pulama-up"], expect: "read-only root; the operator's uid owns the socket, 0600, inside a named volume no host path reaches; the path fits", run: pulamaMeasure },
  { id: "pulama-light", command: "lares-container.sh pulama light", via: "pty", needs: ["pulama-up"], expect: "lit: true", run: pulamaLight },
  { id: "rite-kukulu", command: "lares rite kukulu", needs: ["lei-kui", "pulama-light"], expect: "a new vessel rises served by the pūlama with no unlock", run: riteKukulu },
  { id: "up-by-pulama", command: "lares-container.sh up", via: "pty", needs: ["pulama-light"], expect: "the vessel seats its holder over the pūlama's socket", run: upPulama },
  { id: "vessel-observe", command: "lares-container.sh vessel stand --observe --json", needs: ["up-by-pulama"], expect: "a verdict; the vessel's own line names what the pūlama answered", run: observe },
  { id: "pulama-admit", command: "lares-container.sh pulama admit (the operator's hand: its route typed, here the published test route)", via: "pty", needs: ["up-by-pulama"], expect: "the pūlama admits the image the host reported at up", run: pulamaAdmit },
  { id: "unlock-by-pulama", command: "lares-container.sh vault unlock --all --face 0", via: "pty", needs: ["pulama-admit"], expect: "the vessel stands unlocked", run: unlockUnderPulama },
  { id: "rite-receipts", command: "lares rite receipts", needs: ["rite-kukulu"], expect: "conferre reads par", run: riteReceipts },
  { id: "shim-down", command: "lares-container.sh down", via: "pty", needs: ["pulama-light"], expect: "the vessel leaves; the pūlama stays lit", run: shimDown },
  { id: "teardown", command: "docker compose down --remove-orphans · rm the base", expect: "no container of the project stands; the base is gone", run: teardown },
]);

// ── the walk ────────────────────────────────────────────────────────────────────────────────────────────────────────

export function parseImageArgs(argv) {
  const opts = { keep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--image-leg") continue;
    if (a === "--keep") opts.keep = true;
    else if (["--base", "--project", "--port", "--image", "--out", "--from", "--to"].includes(a)) {
      if (argv[i + 1] === undefined) throw new RiteWalkRefusal(`${a} names nothing`);
      opts[a.slice(2)] = argv[++i];
    } else throw new RiteWalkRefusal(`unknown argument ${a}`);
  }
  return opts;
}

/** Walk the image leg. Answers `{ code, report }`; throws RiteWalkRefusal before any act where the walk may not run. */
export async function imageWalk(opts, say = console.log) {
  const scope = assertImageScope(opts);
  if (!opts.out) throw new RiteWalkRefusal("--out names the directory the receipt lands in");
  if (within(scope.base, resolve(opts.out))) throw new RiteWalkRefusal("--out stands inside the base the teardown clears");
  for (const name of ["from", "to"]) if (opts[name] && !IMAGE_STEPS.some((s) => s.id === opts[name])) throw new RiteWalkRefusal(`--${name} names no step: ${opts[name]}`);
  const statePath = join(scope.base, STATE);
  if (opts.from && !existsSync(statePath)) throw new RiteWalkRefusal(`${scope.base} carries no kept leg (${STATE})`);
  if (!opts.from && existsSync(scope.base)) throw new RiteWalkRefusal(`${scope.base} already stands; walk on from a kept leg (--from) or clear it`);
  const state = opts.from ? JSON.parse(readFileSync(statePath, "utf8")) : { vars: {}, rows: [], legs: [] };
  const h = imageHands(scope, state);
  h.stage();
  say(await h.proveScope());

  const first = opts.from ? IMAGE_STEPS.findIndex((s) => s.id === opts.from) : 0;
  const last = opts.to ? IMAGE_STEPS.findIndex((s) => s.id === opts.to) : IMAGE_STEPS.length - 1;
  const passedBefore = state.rows.filter((r) => r.outcome === "pass").map((r) => r.step);
  let rows;
  try {
    rows = await walkImage(IMAGE_STEPS.slice(first, last + 1), {
      run: (step) => step.run(h), passed: passedBefore,
      say: (row) => say(`${verdict(row).padEnd(28)} ${row.step.padEnd(16)} ${row.answer ? `→ ${row.answer.slice(0, 220)}` : ""}`),
    });
  } finally { await h.close(); }
  state.rows = [...state.rows.filter((r) => !rows.some((n) => n.step === r.step)), ...rows];
  state.legs.push({ from: IMAGE_STEPS[first].id, to: IMAGE_STEPS[last].id });
  let docker = state.vars.dockerLog ?? h.dockerLog();
  if (!state.vars.tornDown) {
    if (opts.keep) writeFileSync(statePath, JSON.stringify(state));
    else { const t = await h.teardown(); docker = t.log; say(`the walk stopped before teardown and cleared its ground: containers left ${t.containers === "" ? "none" : t.containers}; the base stands: ${t.baseStands}`); }
  }
  const order = new Map(IMAGE_STEPS.map((s, i) => [s.id, i]));
  const all = IMAGE_STEPS.map((s) => state.rows.find((r) => r.step === s.id) ?? { step: s.id, command: s.command, expect: s.expect ?? null, outcome: "unreached", cause: "outside-this-leg", answer: "", ms: 0 });
  all.sort((a, b) => order.get(a.step) - order.get(b.step));
  const walker = sha256(readFileSync(join(CHECKOUT, "tools/rite-walk/image-leg.mjs")));
  const git = (...args) => execFileSync("git", ["-C", CHECKOUT, ...args], { encoding: "utf8" }).trim();
  const report = imageReceipt({ head: git("rev-parse", "HEAD"), dirty: git("status", "--porcelain", "--untracked-files=no") !== "", walker: `sha256:${walker}`, scope, rows: all, legs: state.legs, docker });
  const faults = imageReceiptFaults(report.steps);
  if (faults.length > 0) throw new Error(`the receipt breaks the outcome law:\n  ${faults.join("\n  ")}`);
  mkdirSync(opts.out, { recursive: true });
  writeFileSync(join(opts.out, "image-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    `rite-walk image leg · ${report.rite}`,
    `head ${report.inputs.head}${report.inputs.dirty ? " (dirty)" : ""} · walker ${report.inputs.walker} · project ${scope.project} · port ${scope.port} · image ${scope.image}`,
    ...report.steps.map((r) => `${verdict(r).padEnd(28)} ${r.step.padEnd(16)} ${r.command}${r.answer ? `\n${" ".repeat(29)}→ ${r.answer}` : ""}${r.measures ? `\n${" ".repeat(29)}· ${JSON.stringify(r.measures)}` : ""}`),
    `pass ${report.tally.pass} · fail ${report.tally.fail} · unreached ${report.tally.unreached}${report.tally.firstFail ? ` · first fail ${report.tally.firstFail}` : ""} · outcomes ${report.outcomes}`,
    "", "every docker call, in order:", ...docker,
  ];
  writeFileSync(join(opts.out, "image-report.txt"), `${lines.join("\n")}\n`);
  say(lines.find((l) => /^pass \d/.test(l)));
  say(`receipt: ${join(opts.out, "image-report.json")}${opts.keep && !state.vars.tornDown ? ` · base kept: ${scope.base}` : ""}`);
  return { code: report.tally.fail > 0 ? 1 : 0, report };
}
