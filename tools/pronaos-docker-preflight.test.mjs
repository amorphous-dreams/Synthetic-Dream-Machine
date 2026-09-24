import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectPronaosDockerReservation } from "./pronaos-docker-preflight.mjs";

const compose = JSON.stringify({ services: { web: { ports: [{ published: 4321, target: 4321 }] } } });
const clear = { stdout: "", stderr: "" };

function runnerFrom(map) {
  return async (_file, args) => {
    const key = args.join(" ");
    const value = map.find(([fragment]) => key.includes(fragment))?.[1];
    if (value instanceof Error) throw Object.assign(new Error(value.message), { stderr: value.message });
    return value ?? clear;
  };
}

test("preflight proves a clear project without creating Docker state", async () => {
  const result = await inspectPronaosDockerReservation({
    composeFile: "docker-compose.yml",
    projectName: "pronaos-household",
    run: runnerFrom([
      ["info ", { stdout: "28.0\n", stderr: "" }],
      ["config ", { stdout: compose, stderr: "" }],
      ["ps ", clear],
      ["volume ", clear],
      ["network ", clear],
      ["ss ", { stdout: "LISTEN 0 128 127.0.0.1:9999 0.0.0.0:*\n", stderr: "" }],
    ]),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.publishedPorts, [4321]);
  assert.equal(result.proof.create, "not-run");
});

test("preflight refuses an existing project before volume or network checks", async () => {
  const result = await inspectPronaosDockerReservation({
    projectName: "pronaos-household",
    run: runnerFrom([
      ["info ", { stdout: "28.0\n", stderr: "" }],
      ["config ", { stdout: compose, stderr: "" }],
      ["ps ", { stdout: '{"Name":"old"}\n', stderr: "" }],
    ]),
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "project");
});

test("preflight accepts Compose's empty JSON-array project listing", async () => {
  const result = await inspectPronaosDockerReservation({
    projectName: "pronaos-household",
    run: runnerFrom([
      ["info ", { stdout: "28.0\n", stderr: "" }],
      ["config ", { stdout: compose, stderr: "" }],
      ["ps ", { stdout: "[]\n", stderr: "" }],
      ["volume ", clear],
      ["network ", clear],
      ["ss ", { stdout: "", stderr: "" }],
    ]),
  });
  assert.equal(result.ok, true);
});

test("preflight refuses a daemon it cannot reach", async () => {
  const result = await inspectPronaosDockerReservation({
    projectName: "pronaos-household",
    run: runnerFrom([["info ", new Error("permission denied")]]),
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "daemon");
});

test("preflight refuses a busy published host port", async () => {
  const result = await inspectPronaosDockerReservation({
    projectName: "pronaos-household",
    run: runnerFrom([
      ["info ", { stdout: "28.0\n", stderr: "" }],
      ["config ", { stdout: compose, stderr: "" }],
      ["ps ", clear],
      ["volume ", clear],
      ["network ", clear],
      ["-ltnH", { stdout: "LISTEN 0 128 0.0.0.0:4321 0.0.0.0:*\n", stderr: "" }],
    ]),
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "host-ports");
});
