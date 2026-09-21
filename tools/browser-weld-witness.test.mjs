/**
 * Process-boundary checks for browser-weld-witness.sh.
 *
 * The PATH tools below stand in for Vite, curl, and the browser drivers.  They
 * let this test prove runner ownership and result handling without starting an
 * app, Chromium, or Docker.
 */
import assert from "node:assert/strict";
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const REPO = resolve(new URL(".", import.meta.url).pathname, "..");
const RUNNER = join(REPO, "tools/browser-weld-witness.sh");
const LEAF = join(REPO, "tools/browser-weld/leaf-continuity.mjs");
const OPEN_VESSEL = join(REPO, "packages/lararium-browser/src/open-browser-vessel.ts");
const OPEN_CORE = join(REPO, "packages/lararium-mesh/src/open-vessel-core.ts");
const DAEMON_CORE = join(REPO, "packages/lararium-tw5/src/daemon-vm-core.ts");
const DAEMON_WORKER = join(REPO, "packages/lararium-web/src/workers/daemon.worker.ts");
const APP_MAIN = join(REPO, "packages/lararium-web/src/main.ts");

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function run(command, args, options) {
  const child = spawn(command, args, options);
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (status, signal) => resolve({ status, signal, output }));
  });
  return { child, done };
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function eventually(predicate, description) {
  const until = Date.now() + 2_000;
  while (Date.now() < until) {
    if (await predicate()) return;
    await sleep(20);
  }
  throw new Error(`${description} did not arrive within 2000ms`);
}

async function makeHarness(mode, extra = {}) {
  const root = await mkdtemp(join(tmpdir(), "browser-weld-runner-"));
  const bin = join(root, "bin");
  const artifacts = join(root, "artifacts");
  const calls = join(root, "calls");
  const curlCalls = join(root, "curl-calls");
  const pids = join(root, "vite-pids");
  await mkdir(bin);

  const tools = {
    npx: `#!/bin/sh
case "$FAKE_MODE" in
  collision)
    echo "error when starting dev server: Error: Port is already in use"
    exit 1
    ;;
  collision-delayed)
    /bin/sleep 1
    echo "error when starting dev server: Error: Port is already in use"
    exit 1
    ;;
esac
echo "  ➜  Local:   http://localhost:$WELD_PORT/"
printf '%s\\n' "$$" > "$FAKE_VITE_PIDS"
(
  trap 'exit 0' TERM INT
  while :; do /bin/sleep 1; done
) &
worker=$!
printf '%s\\n' "$worker" >> "$FAKE_VITE_PIDS"
trap 'exit 0' TERM INT
while :; do /bin/sleep 1; done
`,
    curl: `#!/bin/sh
printf 'curl %s\\n' "$*" >> "$FAKE_CURL_CALLS"
[ "$FAKE_MODE" = "never-ready" ] && exit 1
exit 0
`,
    node: `#!/bin/sh
case "$*" in
  *leaf-continuity.mjs*) echo c4 >> "$FAKE_CALLS"; echo C4-SENTINEL; exit "\${FAKE_C4_STATUS:-0}" ;;
  *) echo weld >> "$FAKE_CALLS"; echo WELD-SENTINEL; [ "\${FAKE_BLOCK_WELD:-0}" = 1 ] && while :; do /bin/sleep 1; done; exit "\${FAKE_WELD_STATUS:-0}" ;;
esac
`,
  };
  await Promise.all(Object.entries(tools).map(async ([name, source]) => {
    const path = join(bin, name);
    await writeFile(path, source);
    await chmod(path, 0o755);
  }));

  return {
    root,
    artifacts,
    calls,
    curlCalls,
    pids,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      ARTIFACT_DIR: artifacts,
      WELD_PORT: "56991",
      WELD_READY_ATTEMPTS: "3",
      WELD_READY_INTERVAL: "0",
      WELD_READY_SETTLE_SECONDS: "0.05",
      FAKE_MODE: mode,
      FAKE_VITE_PIDS: pids,
      FAKE_CALLS: calls,
      FAKE_CURL_CALLS: curlCalls,
      ...extra,
    },
    async dispose() { await rm(root, { recursive: true, force: true }); },
  };
}

async function readLines(path) {
  return (await readFile(path, "utf8")).trim().split("\n").filter(Boolean);
}

async function testC4TraceHookIsOptIn() {
  const source = await readFile(LEAF, "utf8");
  assert.match(source, /const BOOT_TRACE = process\.env\.LEAF_BOOT_TRACE === "1"/);
  assert.match(source, /async function observeKelRead\(context, page\)/);
  assert.match(source, /function watchPage\(context, page\)/);
  assert.match(source, /context\.on\("requestfailed"/);
  assert.match(source, /context\.on\("response"/);
  assert.match(source, /await context\.route\(\/\\\.\(\?:\[cm\]\?\[jt\]sx\?\)\(\?:\\\?\.\*\)\?\$\//);
  assert.match(source, /if \(!BOOT_TRACE \|\| source\.includes\("__laresC4BootTrace"\)\) return source/);
  for (const marker of [
    "host:corpus-ready", "host:kel-carry:start", "host:kel-board:start", "host:daemon-vm:start",
    "host:worker-spawn", "worker:ready", "host:ready-fallback", "host:manifest-post",
    "raw.type === \"breath\"", "raw.type === \"ea\"", "worker:startup-error",
    "worker:manifest-received", "worker:manifest-rejected", "worker:manifest-accepted",
    "worker:pre-first-breath", "worker:pre-ea",
    "host:awaitIslandMsg-raw", "host:awaitIslandMsg-guard-accepted",
    "host:awaitIslandMsg-guard-rejected", "host:awaitIslandMsg-expected-match",
    "host:awaitIslandMsg-resolve",
    "host:worker-handle-listen", "host:worker-handle-dispatch",
    "host:daemon-workerEa-callback",
  ]) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing C4 marker ${marker}`);
  }
}

async function testC4TraceAnchorsStillStand() {
  const [vessel, openCore, daemon, worker, appMain] = await Promise.all([
    readFile(OPEN_VESSEL, "utf8"),
    readFile(OPEN_CORE, "utf8"),
    readFile(DAEMON_CORE, "utf8"),
    readFile(DAEMON_WORKER, "utf8"),
    readFile(APP_MAIN, "utf8"),
  ]);
  for (const [label, source, pattern] of [
    ["corpus-ready", openCore, /emit\("corpus-ready"\);/g],
    ["KEL carry", vessel, /await carryPersonaKelUpTheGradient\(\{/g],
    ["daemon VM", vessel, /daemon = await openBrowserDaemonVm\(\{/g],
    ["worker spawn", daemon, /const worker = host\.spawnWorker\(workerScriptUrl\);/g],
    ["ready gate", daemon, /raw\.type === "ready"/g],
    ["manifest post", daemon, /worker\.post\(manifestMsg, \[syncPort\]\)/g],
    ["worker WASM init", worker, /await initKeyhiveWasm\(\);/g],
    ["worker kernel import", worker, /await import\("@lararium\/browser\/browser-daemon-island"\);/g],
    ["worker trace gate", worker, /searchParams\.get\("c4trace"\) !== "1"/g],
    ["worker trace route", appMain, /daemonWorkerUrl\.searchParams\.set\("c4trace", "1"\);/g],
  ]) {
    assert.equal(source.match(pattern)?.length ?? 0, 1, `${label} trace anchor drifted`);
  }
}

async function testIndependentDriversAndArtifacts() {
  for (const testCase of [
    { env: { FAKE_WELD_STATUS: "1" }, expectedStatus: 1, weldStatus: 1, c4Status: 0 },
    { env: { FAKE_C4_STATUS: "1" }, expectedStatus: 1, weldStatus: 0, c4Status: 1 },
    { env: {}, expectedStatus: 0, weldStatus: 0, c4Status: 0 },
  ]) {
    const harness = await makeHarness("ready", testCase.env);
    try {
      const { done } = run("bash", [RUNNER], { cwd: REPO, env: harness.env });
      const result = await done;
      assert.equal(result.status, testCase.expectedStatus, result.output);
      assert.deepEqual(await readLines(harness.calls), ["weld", "c4"]);
      // L-Prime receipt boundary: driver output stays visible beside the Vite artifact.
      assert.match(result.output, /WELD-SENTINEL/);
      assert.match(result.output, /C4-SENTINEL/);
      assert.match(result.output, /starting Weld driver/);
      assert.match(result.output, /starting C4 leaf driver/);
      assert.match(result.output, new RegExp(`Weld driver exited ${testCase.weldStatus}`));
      assert.match(result.output, new RegExp(`C4 leaf driver exited ${testCase.c4Status}`));
      assert.ok(result.output.indexOf("starting Weld driver") < result.output.indexOf("starting C4 leaf driver"));
      const probe = await readFile(harness.curlCalls, "utf8");
      assert.match(probe, /--connect-timeout 1/);
      assert.match(probe, /--max-time 2/);
      const viteLog = await readFile(join(harness.artifacts, "vite.log"), "utf8");
      assert.match(viteLog, /Local:/);
      assert.doesNotMatch(viteLog, /(?:WELD|C4)-SENTINEL|browser-weld: starting/);
      const weldLog = await readFile(join(harness.artifacts, "weld.log"), "utf8");
      const c4Log = await readFile(join(harness.artifacts, "c4.log"), "utf8");
      assert.match(weldLog, /WELD-SENTINEL/);
      assert.doesNotMatch(weldLog, /C4-SENTINEL/);
      assert.match(c4Log, /C4-SENTINEL/);
      assert.doesNotMatch(c4Log, /WELD-SENTINEL/);
    } finally {
      await harness.dispose();
    }
  }
}

async function testForeignPortCannotPassReadiness() {
  const harness = await makeHarness("collision");
  try {
    const { done } = run("bash", [RUNNER], { cwd: REPO, env: harness.env });
    const result = await done;
    assert.notEqual(result.status, 0, result.output);
    assert.match(result.output, /app process exited before readiness/i);
    assert.equal(await exists(harness.calls), false, result.output);
  } finally {
    await harness.dispose();
  }
}

async function testDelayedForeignPortCannotPassViteReadiness() {
  const harness = await makeHarness("collision-delayed");
  try {
    const { done } = run("bash", [RUNNER], { cwd: REPO, env: harness.env });
    const result = await done;
    assert.notEqual(result.status, 0, result.output);
    assert.match(result.output, /app never answered/i);
    assert.equal(await exists(harness.curlCalls), false, result.output);
    assert.equal(await exists(harness.calls), false, result.output);
  } finally {
    await harness.dispose();
  }
}

async function testSignalReapsTheViteProcessGroup() {
  const harness = await makeHarness("ready", { FAKE_BLOCK_WELD: "1" });
  try {
    const { child, done } = run("bash", [RUNNER], { cwd: REPO, env: harness.env, detached: true });
    await eventually(() => exists(harness.pids), "fake Vite pid record");
    const pids = (await readLines(harness.pids)).map(Number);
    process.kill(-child.pid, "SIGTERM");
    const result = await done;
    assert.equal(result.status, 143, result.output);
    await eventually(async () => {
      for (const pid of pids) {
        try {
          process.kill(pid, 0);
          return false;
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
      }
      return true;
    }, "Vite session reaping after SIGTERM");
  } finally {
    await harness.dispose();
  }
}

await testC4TraceHookIsOptIn();
await testC4TraceAnchorsStillStand();
await testIndependentDriversAndArtifacts();
await testForeignPortCannotPassReadiness();
await testDelayedForeignPortCannotPassViteReadiness();
await testSignalReapsTheViteProcessGroup();
console.log("browser-weld-witness runner controls: ok");
