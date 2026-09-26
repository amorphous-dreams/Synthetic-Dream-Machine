import { test } from "node:test";
import assert from "node:assert/strict";
import { readRunningPronaosReceipt } from "./pronaos-docker-receipt.mjs";

test("live expected input comes from the attributed image, independent of host receipt", async () => {
  let calls = [];
  const imageReceipt = { schema: "lararium-pronaos-artifact/v1", routes: [{ path: "/", file: "index.html" }] };
  const run = async (_file, args) => {
    calls.push(args);
    if (args[0] === "inspect") return { stdout: "0123456789abcdef0123456789abcdef\n" };
    return { stdout: JSON.stringify(imageReceipt) };
  };
  const result = await readRunningPronaosReceipt({ container: "qa-1", run });
  assert.equal(result.containerId, "0123456789abcdef0123456789abcdef");
  assert.deepEqual(result.receipt, imageReceipt);
  assert.deepEqual(calls, [
    ["inspect", "--format", "{{.Id}}", "qa-1"],
    ["exec", "qa-1", "cat", "/app/pronaos-build/pronaos-artifact.json"],
  ]);
});

test("missing container attribution refuses before route claims", async () => {
  await assert.rejects(() => readRunningPronaosReceipt({
    container: "qa-1", run: async () => ({ stdout: "" }),
  }), /no attributable ID/);
});
