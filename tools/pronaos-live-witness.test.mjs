import { test } from "node:test";
import assert from "node:assert/strict";
import { runPronaosInProcessWitness, runPronaosLiveWitness } from "./pronaos-live-witness.mjs";

test("executes the compiled Pronaos composition and dispatcher without a socket", async () => {
  const result = await runPronaosInProcessWitness();
  assert.equal(result.transport, "in-process");
  assert.deepEqual(result.proof, { process: "in-process", reach: "none", docker: "not-run" });
  assert.ok(result.routes.includes("/"));
  assert.ok(result.routes.some((route) => /worker/i.test(route)));
});

test("reserved-host process witness remains explicit and makes no Node-face claim", async (t) => {
  if (process.env.CODEX_SANDBOX_NETWORK_DISABLED === "1") {
    t.skip("managed runner denies child process pipes; the daemon-free in-process witness remains runnable, while this process witness belongs in a reserved host or Docker window");
    return;
  }
  const result = await runPronaosLiveWitness();
  assert.ok(Number.isInteger(result.pid));
  assert.ok(result.routes.includes("/"));
  assert.ok(result.routes.some((route) => /worker/i.test(route)));
  assert.equal(result.proof.process, "child");
  assert.equal(result.proof.docker, "not-run");
  assert.ok(["loopback-only", "none"].includes(result.proof.reach));
});
