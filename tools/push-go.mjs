#!/usr/bin/env node
/**
 * push-go — the controller's tool to grant ONE push (seat-harness#/the-broker).
 *
 *   node tools/push-go.mjs --lane-root <dir> --branch <branch> --head <sha>
 *
 * Writes `<broker-root>/go/<lane>/push-go` (two lines: the branch, then the head) under the one fixed broker root, after the
 * root verifies. No path is named by the caller. The relay reads the go, binds it to the branch AND the head, and spends it.
 */
import { renameSync, realpathSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { brokerRootPath, ensureLaneDir } from "./broker-root.mjs";

const opts = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i];
  if (!["--lane-root", "--branch", "--head"].includes(k) || process.argv[i + 1] === undefined) { console.error(`push-go: unknown option ${k}`); process.exit(2); }
  opts[k.slice(2)] = process.argv[i + 1];
}
if (!opts["lane-root"] || !opts.branch || !/^[0-9a-f]{40}$/.test(opts.head ?? "")) { console.error("push-go: needs --lane-root, --branch and a 40-hex --head"); process.exit(2); }
try {
  const home = realpathSync(os.homedir());
  const lane = realpathSync(opts["lane-root"]);
  const scratch = path.join(home, ".lares-scratch");
  const root = brokerRootPath(home, process.env);
  const dir = ensureLaneDir(root, "go", lane, { realHome: home, guarded: [lane, scratch] });
  const tmp = path.join(dir, `.go-${randomUUID()}`);
  writeFileSync(tmp, `${opts.branch}\n${opts.head}\n`, { mode: 0o600, flag: "wx" }); // broker-owned
  renameSync(tmp, path.join(dir, "push-go")); // broker-owned
  console.log(`push-go written for ${opts.branch} at ${opts.head}`);
} catch (error) { console.error(`push-go refused: ${error.message}`); process.exit(2); }
