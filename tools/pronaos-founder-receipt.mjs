#!/usr/bin/env node
/**
 * Validate the explicit founder handback before a live route witness runs.
 * The receipt is written by the profile-scoped founder service after the
 * social bootstrap exists in the same named volume the Node peer will read.
 */
import { existsSync, readFileSync, statSync } from "node:fs";

export function assertPronaosFounderReceipt({
  receiptPath,
  bootstrapPath = "/app/.lararium-data/lares/vessel/social-bootstrap.json",
} = {}) {
  if (!receiptPath) throw new Error("Pronaos live witness requires a founder receipt path");
  if (!existsSync(receiptPath) || !statSync(receiptPath).isFile()) {
    throw new Error(`Pronaos founder receipt is absent: ${receiptPath}`);
  }
  let receipt;
  try { receipt = JSON.parse(readFileSync(receiptPath, "utf8")); }
  catch (error) { throw new Error(`Pronaos founder receipt is not valid JSON: ${error.message}`); }
  if (receipt?.kind !== "pronaos-founder") throw new Error("Pronaos founder receipt has no founding kind");
  if (receipt.bootstrap !== bootstrapPath) throw new Error(`Pronaos founder receipt names ${receipt.bootstrap ?? "no bootstrap"}, expected ${bootstrapPath}`);
  if (!existsSync(bootstrapPath) || !statSync(bootstrapPath).isFile()) {
    throw new Error(`Pronaos founder receipt points to an absent bootstrap: ${bootstrapPath}`);
  }
  return { kind: receipt.kind, receiptPath, bootstrapPath };
}

if (process.argv[1]?.endsWith("pronaos-founder-receipt.mjs")) {
  try {
    const result = assertPronaosFounderReceipt({
      receiptPath: process.env.LAR_PRONAOS_FOUNDER_RECEIPT,
      bootstrapPath: process.env.LAR_PRONAOS_BOOTSTRAP ?? "/app/.lararium-data/lares/vessel/social-bootstrap.json",
    });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`[pronaos-founder] RED: ${error.message}`);
    process.exitCode = 1;
  }
}
