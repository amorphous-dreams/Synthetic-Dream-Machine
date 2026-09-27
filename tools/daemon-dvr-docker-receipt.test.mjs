import { test } from "node:test";
import assert from "node:assert/strict";
import { receiptFromLogs, runDvrDockerReceipt, uniqueProjectName } from "./daemon-dvr-docker-receipt.mjs";

const receipt = {
  schema: "lararium-dvr-node-owned/v1",
  physical: { separate: true, ordinaryFiles: [] },
  recovery: { parentAbsent: true, ownedRecovered: true, ordinaryRefused: true },
};

test("D-VR receipt parser requires the dedicated schema", () => {
  assert.deepEqual(receiptFromLogs(`noise\ndvr-node-owned-1  | DVR_NODE_RECEIPT:${JSON.stringify(receipt)}\n`), receipt);
  assert.throws(() => receiptFromLogs("DVR_NODE_RECEIPT:{}"), /schema is unsupported/);
});

test("D-VR runner preflights, inspects same-context processes, runs, and scopes cleanup", async () => {
  const project = uniqueProjectName("01234567-89ab-cdef-0123-456789abcdef", 42);
  const calls = [];
  const run = async (_file, args) => {
    calls.push(args);
    const key = args.join(" ");
    if (key.includes("info --format")) return { stdout: "28.0\n", stderr: "" };
    if (key.includes("config")) return { stdout: "", stderr: "" };
    if (key.includes("ps -a")) return { stdout: "[]\n", stderr: "" };
    if (key.includes("ps --filter")) return { stdout: "", stderr: "" };
    if (key.includes(" up ")) return { stdout: "", stderr: "" };
    if (key.includes("logs")) return { stdout: `DVR_NODE_RECEIPT:${JSON.stringify(receipt)}\n`, stderr: "" };
    if (key.includes("down")) return { stdout: "", stderr: "" };
    throw new Error(`unexpected command: ${key}`);
  };
  const result = await runDvrDockerReceipt({ projectName: project, run });
  assert.equal(result.ok, true);
  assert.equal(result.proof.preflight, true);
  assert.equal(result.proof.activeProcessesInspected, true);
  assert.equal(result.proof.cleanup, true);
  assert.equal(calls.at(-1).join(" "), `compose -f docker-compose.dvr-node-owned.yml -p ${project} down -v --remove-orphans`);
  assert.ok(calls.some((args) => args.join(" ").includes(`ps --filter label=com.docker.compose.project=${project}`)));
  assert.ok(calls.every((args) => !args.includes("nexus")));
});

test("D-VR runner cleans its named project after a failed container", async () => {
  const calls = [];
  const run = async (_file, args) => {
    calls.push(args);
    const key = args.join(" ");
    if (key.includes("info --format")) return { stdout: "28.0\n", stderr: "" };
    if (key.includes("config")) return { stdout: "", stderr: "" };
    if (key.includes("ps -a")) return { stdout: "[]\n", stderr: "" };
    if (key.includes("ps --filter")) return { stdout: "", stderr: "" };
    if (key.includes("up")) throw Object.assign(new Error("exit 1"), { stderr: "exit 1" });
    if (key.includes("logs")) return { stdout: "DVR_NODE_RECEIPT_ERROR:fixture failed\n", stderr: "" };
    if (key.includes("down")) return { stdout: "", stderr: "" };
    throw new Error(`unexpected command: ${key}`);
  };
  await assert.rejects(() => runDvrDockerReceipt({ projectName: uniqueProjectName("fedcba98-7654-3210-fedc-ba9876543210", 43), run }), /D-VR container failed/);
  assert.match(calls.at(-1).join(" "), /down -v --remove-orphans$/);
});
