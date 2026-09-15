/**
 * Regression for crossing-witness's compose-status boundary.
 *
 * The real matrix pipes Compose through grep for concise output. A prior `|| true` ran before
 * PIPESTATUS was read, replacing a failed Compose exit with zero. This fake never invokes Docker and
 * intentionally prints no matching line, exercising the exact quiet-failure shape.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile, chmod } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SCRIPT = join(ROOT, "tools/crossing-witness.sh");

async function withStub({ upExit, upSleep = 0, command = ["bash", SCRIPT] }, check) {
  const dir = await mkdtemp(join(tmpdir(), "crossing-witness-"));
  const docker = join(dir, "docker");
  const callLog = join(dir, "calls.log");
  const artifacts = join(dir, "artifacts");
  try {
    await writeFile(docker, `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$CALL_LOG"
for arg in "$@"; do
  if [ "$arg" = up ]; then
    printf '%s\\n' 'unmatched compose diagnostic' >&2
    sleep "$UP_SLEEP"
    exit "$UP_EXIT"
  fi
done
exit 0
`);
    await chmod(docker, 0o755);
    const [file, ...args] = command;
    const run = spawnSync(file, args, {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, DOCKER_BIN: docker, CALL_LOG: callLog, UP_EXIT: String(upExit), UP_SLEEP: String(upSleep), ARTIFACT_DIR: artifacts },
    });
    await check({ run, artifacts, calls: await readFile(callLog, "utf8") });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

await test("a quiet failed compose run stays red and retains its diagnostics", async () => {
  await withStub({ upExit: 42 }, async ({ run, artifacts, calls }) => {
    assert.notEqual(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /admitted — exit 42/);
    assert.deepEqual((await readdir(artifacts)).sort(), [
      "crossing-admitted.compose.log",
      "crossing-admitted.up.log",
      "crossing-anon.compose.log",
      "crossing-anon.up.log",
      "crossing-impostor.compose.log",
      "crossing-impostor.up.log",
      "crossing-wrong-bind.compose.log",
      "crossing-wrong-bind.up.log",
    ]);
    assert.match(await readFile(join(artifacts, "crossing-admitted.compose.log"), "utf8"), /compose state before teardown/);
    assert.match(await readFile(join(artifacts, "crossing-admitted.up.log"), "utf8"), /unmatched compose diagnostic/);
    assert.ok(calls.split("\n").filter((line) => line.includes("down -v")).length >= 4, "every scenario tears down its compose state");
  });
});

await test("a quiet successful compose run stays green and still tears down", async () => {
  await withStub({ upExit: 0 }, async ({ run, artifacts, calls }) => {
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /4 passed, 0 failed/);
    assert.equal((await readdir(artifacts)).length, 8);
    assert.ok(calls.split("\n").filter((line) => line.includes("down -v")).length >= 4, "the green matrix also tears down");
  });
});

await test("timeout interruption saves the active raw log and tears down only that scenario", async () => {
  await withStub({
    upExit: 0,
    upSleep: 60,
    command: ["timeout", "--kill-after=2s", "1s", "bash", SCRIPT],
  }, async ({ run, artifacts, calls }) => {
    assert.equal(run.status, 124, run.stdout + run.stderr);
    assert.match(await readFile(join(artifacts, "crossing-admitted.up.log"), "utf8"), /unmatched compose diagnostic/);
    assert.match(await readFile(join(artifacts, "crossing-admitted.compose.log"), "utf8"), /compose state before teardown/);
    const lines = calls.trim().split("\n");
    assert.equal(lines.filter((line) => line.includes(" up ")).length, 1, "timeout never advances to another scenario");
    assert.equal(lines.filter((line) => line.includes("down -v")).length, 1, "the active scenario tears down exactly once");
  });
});
