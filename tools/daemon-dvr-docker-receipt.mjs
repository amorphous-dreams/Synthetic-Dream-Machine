#!/usr/bin/env node
/**
 * Run the dedicated Node D-VR deployment loop with a unique Compose project.
 * Every Docker query uses the same project/context; cleanup is scoped to that
 * project and runs even when the container fails.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

const exec = promisify(execFile);
const PROJECT = /^[a-z][a-z0-9_-]{0,62}$/;
const RECEIPT = "DVR_NODE_RECEIPT:";

function uniqueProjectName(id = randomUUID(), pid = process.pid) {
  return `dvr-node-owned-${pid}-${id.replaceAll("-", "").slice(0, 20)}`.slice(0, 63);
}

function jsonLines(stdout) {
  const value = stdout.trim();
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return value.split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
  }
}

function receiptFromLogs(logs) {
  const line = logs.split(/\n/).find((candidate) => candidate.includes(RECEIPT));
  if (!line) throw new Error("D-VR container emitted no receipt");
  const receipt = JSON.parse(line.slice(line.indexOf(RECEIPT) + RECEIPT.length));
  if (receipt.schema !== "lararium-dvr-node-owned/v1") throw new Error("D-VR receipt schema is unsupported");
  return receipt;
}

async function call(run, docker, args) {
  try {
    const result = await run(docker, args, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    return { ok: true, stdout: result.stdout || "", stderr: result.stderr || "" };
  } catch (error) {
    return { ok: false, stdout: error.stdout || "", stderr: error.stderr || "", error };
  }
}

export async function runDvrDockerReceipt({
  composeFile = "docker-compose.dvr-node-owned.yml",
  projectName = uniqueProjectName(),
  docker = "docker",
  run = exec,
} = {}) {
  if (!PROJECT.test(projectName)) throw new Error("projectName must be a stable local identifier");
  if (!existsSync(composeFile)) throw new Error(`Compose file is absent: ${composeFile}`);
  const compose = ["compose", "-f", composeFile, "-p", projectName];
  const proof = { preflight: false, activeProcessesInspected: false, run: false, cleanup: false };
  let failure;
  try {
    const info = await call(run, docker, ["info", "--format", "{{.ServerVersion}}"]);
    if (!info.ok) throw new Error(`Docker daemon is unavailable: ${(info.stderr || info.error?.message || "unknown error").trim()}`);

    const config = await call(run, docker, [...compose, "config", "--quiet"]);
    if (!config.ok) throw new Error(`D-VR Compose configuration refused: ${(config.stderr || config.error?.message || "unknown error").trim()}`);

    const before = await call(run, docker, [...compose, "ps", "-a", "--format", "json"]);
    if (!before.ok) throw new Error(`Could not inspect D-VR project: ${(before.stderr || before.error?.message || "unknown error").trim()}`);
    if (jsonLines(before.stdout).length) throw new Error(`D-VR project already has resources: ${projectName}`);
    proof.preflight = true;

    const active = await call(run, docker, ["ps", "--filter", `label=com.docker.compose.project=${projectName}`, "--format", "{{.ID}}"]);
    if (!active.ok) throw new Error(`Could not inspect active D-VR processes: ${(active.stderr || active.error?.message || "unknown error").trim()}`);
    if (active.stdout.trim()) throw new Error(`D-VR project has active containers before run: ${projectName}`);
    proof.activeProcessesInspected = true;

    const up = await call(run, docker, [...compose, "up", "--abort-on-container-exit", "--exit-code-from", "dvr-node-owned"]);
    proof.run = true;
    const logs = await call(run, docker, [...compose, "logs", "--no-color", "dvr-node-owned"]);
    if (!logs.ok) throw new Error(`Could not read D-VR receipt logs: ${(logs.stderr || logs.error?.message || "unknown error").trim()}`);
    if (!up.ok) throw new Error(`D-VR container failed: ${(up.stderr || up.error?.message || "unknown error").trim()}\n${logs.stdout}`);
    return { ok: true, projectName, receipt: receiptFromLogs(logs.stdout), proof };
  } catch (error) {
    failure = error;
  } finally {
    const down = await call(run, docker, [...compose, "down", "-v", "--remove-orphans"]);
    proof.cleanup = down.ok;
    if (!down.ok && !failure) failure = new Error(`D-VR scoped cleanup failed: ${(down.stderr || down.error?.message || "unknown error").trim()}`);
  }
  throw failure;
}

if (process.argv[1]?.endsWith("daemon-dvr-docker-receipt.mjs")) {
  runDvrDockerReceipt({ projectName: process.env.DVR_COMPOSE_PROJECT || uniqueProjectName() })
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}

export { jsonLines, receiptFromLogs, uniqueProjectName };
