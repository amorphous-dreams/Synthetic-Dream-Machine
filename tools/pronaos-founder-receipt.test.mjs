import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPronaosFounderReceipt } from "./pronaos-founder-receipt.mjs";

test("founder receipt is the gate before live route claims", () => {
  const root = mkdtempSync(join(tmpdir(), "pronaos-founder-"));
  try {
    const bootstrap = join(root, "social-bootstrap.json");
    const receipt = join(root, "founder-receipt.json");
    writeFileSync(bootstrap, "{}\n");
    writeFileSync(receipt, JSON.stringify({ kind: "pronaos-founder", bootstrap }));
    assert.deepEqual(assertPronaosFounderReceipt({ receiptPath: receipt, bootstrapPath: bootstrap }), {
      kind: "pronaos-founder", receiptPath: receipt, bootstrapPath: bootstrap,
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("missing founder receipt refuses before any route witness", () => {
  const root = mkdtempSync(join(tmpdir(), "pronaos-founder-red-"));
  try {
    const bootstrap = join(root, "social-bootstrap.json");
    assert.throws(() => assertPronaosFounderReceipt({ receiptPath: join(root, "missing.json"), bootstrapPath: bootstrap }), /receipt is absent/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
