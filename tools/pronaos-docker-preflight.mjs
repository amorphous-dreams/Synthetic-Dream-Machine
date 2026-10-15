#!/usr/bin/env node
/**
 * Read-only reservation preflight for a Pronaos Docker run.
 *
 * This command never creates a project, volume, network, image, or container,
 * and never calls `down`. It either proves that the named Compose project and
 * its published host ports are available to reserve, or refuses with the
 * first boundary that cannot be established. A green result is a reservation
 * receipt only; it does not start the mesh or prove any face, relay, Oracle,
 * or WAN behavior.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const exec = promisify(execFile);
const PROJECT = /^[a-z][a-z0-9_-]{0,62}$/;

function refuse(stage, reason) {
  return { ok: false, stage, reason };
}

function parseProjectResources(output) {
  const trimmed = output.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return trimmed.split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
  }
}

function configuredPorts(config) {
  const ports = [];
  for (const service of Object.values(config.services ?? {})) {
    for (const port of service.ports ?? []) {
      const published = typeof port === "object" ? port.published : String(port).split(":").at(-2);
      if (published === undefined || published === null || published === "") continue;
      const number = Number(published);
      if (!Number.isInteger(number) || number < 1 || number > 65535) throw new Error(`invalid published port: ${published}`);
      ports.push(number);
    }
  }
  return [...new Set(ports)].sort((a, b) => a - b);
}

function listeningPorts(output) {
  const ports = new Set();
  for (const line of output.split(/\n+/)) {
    // `ss -ltnH` prints local addresses such as 0.0.0.0:4321 or [::]:4321.
    const match = line.match(/:(\d+)(?:\s|$)/);
    if (match) ports.add(Number(match[1]));
  }
  return ports;
}

async function command(run, file, args) {
  try {
    const result = await run(file, args, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
    return { ok: true, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  } catch (error) {
    return { ok: false, stdout: error.stdout ?? "", stderr: error.stderr ?? "", error };
  }
}

export async function inspectPronaosDockerReservation({
  composeFile = "docker-compose.yml",
  projectName,
  profile = "qa",
  docker = "docker",
  run = exec,
} = {}) {
  if (!projectName || !PROJECT.test(projectName)) return refuse("input", "projectName must be a stable local identifier");
  if (!existsSync(composeFile)) return refuse("compose", `Compose file is absent: ${composeFile}`);
  if (!profile || !/^[a-z][a-z0-9_-]*$/.test(profile)) return refuse("input", "profile must be a stable local identifier");

  const daemon = await command(run, docker, ["info", "--format", "{{.ServerVersion}}"]).catch((error) => ({ ok: false, error }));
  if (!daemon.ok) return refuse("daemon", `Docker daemon is unavailable: ${(daemon.error?.stderr || daemon.error?.message || "unknown error").trim()}`);

  const base = ["compose", "-f", composeFile, "-p", projectName, "--profile", profile];
  const configResult = await command(run, docker, [...base, "config", "--format", "json"]);
  if (!configResult.ok) return refuse("compose", `Compose configuration refused: ${(configResult.error?.stderr || configResult.error?.message || "unknown error").trim()}`);
  let config;
  try { config = JSON.parse(configResult.stdout); }
  catch (error) { return refuse("compose", `Compose configuration was not JSON: ${error.message}`); }

  let ports;
  try { ports = configuredPorts(config); }
  catch (error) { return refuse("ports", error.message); }

  const projectResources = await command(run, docker, ["compose", "-f", composeFile, "-p", projectName, "ps", "-a", "--format", "json"]);
  if (!projectResources.ok) return refuse("project", `Could not inspect the named Compose project: ${(projectResources.error?.stderr || projectResources.error?.message || "unknown error").trim()}`);
  if (parseProjectResources(projectResources.stdout).length > 0) return refuse("project", `Compose project already has resources: ${projectName}`);

  for (const kind of ["volume", "network"]) {
    const result = await command(run, docker, [kind, "ls", "-q", "--filter", `label=com.docker.compose.project=${projectName}`]);
    if (!result.ok) return refuse(kind, `Could not inspect existing ${kind}s: ${(result.error?.stderr || result.error?.message || "unknown error").trim()}`);
    if (result.stdout.trim()) return refuse(kind, `Compose project already owns ${kind}(s): ${projectName}`);
  }

  const listeners = await command(run, "ss", ["-ltnH"]);
  if (!listeners.ok) return refuse("host-ports", `Cannot inspect host listeners with ss; refusing reservation: ${(listeners.error?.stderr || listeners.error?.message || "unknown error").trim()}`);
  const busy = ports.filter((port) => listeningPorts(listeners.stdout).has(port));
  if (busy.length) return refuse("host-ports", `Published host port(s) already listen: ${busy.join(", ")}`);

  return {
    ok: true,
    projectName,
    composeFile,
    profile,
    publishedPorts: ports,
    resources: { project: "clear", volumes: "clear", networks: "clear" },
    proof: { action: "read-only-preflight", create: "not-run", teardown: "not-run", live: "not-run" },
  };
}

if (process.argv[1]?.endsWith("pronaos-docker-preflight.mjs")) {
  const projectName = process.env.LAR_PRONAOS_PROJECT;
  inspectPronaosDockerReservation({ projectName }).then((result) => {
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 2;
  }).catch((error) => {
    console.error(JSON.stringify(refuse("unexpected", error.message)));
    process.exitCode = 2;
  });
}
