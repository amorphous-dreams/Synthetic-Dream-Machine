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
  *leaf-continuity.mjs*) echo c4 >> "$FAKE_CALLS"; exit "\${FAKE_C4_STATUS:-0}" ;;
  *) echo weld >> "$FAKE_CALLS"; [ "\${FAKE_BLOCK_WELD:-0}" = 1 ] && while :; do /bin/sleep 1; done; exit "\${FAKE_WELD_STATUS:-0}" ;;
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

async function testIndependentDriversAndArtifacts() {
  for (const statuses of [{ FAKE_WELD_STATUS: "1" }, { FAKE_C4_STATUS: "1" }]) {
    const harness = await makeHarness("ready", statuses);
    try {
      const { done } = run("bash", [RUNNER], { cwd: REPO, env: harness.env });
      const result = await done;
      assert.equal(result.status, 1, result.output);
      assert.deepEqual(await readLines(harness.calls), ["weld", "c4"]);
      const probe = await readFile(harness.curlCalls, "utf8");
      assert.match(probe, /--connect-timeout 1/);
      assert.match(probe, /--max-time 2/);
      assert.equal(await exists(join(harness.artifacts, "vite.log")), true);
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

await testIndependentDriversAndArtifacts();
await testForeignPortCannotPassReadiness();
await testDelayedForeignPortCannotPassViteReadiness();
await testSignalReapsTheViteProcessGroup();
console.log("browser-weld-witness runner controls: ok");
