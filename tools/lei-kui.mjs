#!/usr/bin/env node
/**
 * lei-kui — the controller strings ONE push lei for a lane (seat-harness#/the-broker).
 *
 *   node tools/lei-kui.mjs --lane-root <dir> --branch <branch> --head <sha> --remote-url <url>
 *
 * Writes `<broker-root>/lei/<lane>/push` (four lines: the lane id, the branch, the head and the push destination) under the one fixed broker root, after the
 * root verifies. No path is named by the caller. The relay reads the lei, binds it to the branch AND the head, and spends it.
 */
import { renameSync, realpathSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { brokerRootPath, ensureLaneDir, laneId } from "./broker-root.mjs";

const opts = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i];
  if (!["--lane-root", "--branch", "--head", "--remote-url"].includes(k) || process.argv[i + 1] === undefined) { console.error(`lei-kui: unknown option ${k}`); process.exit(2); }
  opts[k.slice(2)] = process.argv[i + 1];
}
if (!opts["lane-root"] || !opts.branch || !opts["remote-url"] || !/^[0-9a-f]{40}$/.test(opts.head ?? "")) { console.error("lei-kui: needs --lane-root, --branch, --remote-url and a 40-hex --head"); process.exit(2); }
try {
  const home = realpathSync(os.homedir());
  const lane = realpathSync(opts["lane-root"]);
  const scratch = path.join(home, ".lares-scratch");
  const root = brokerRootPath(home, process.env);
  const dir = ensureLaneDir(root, "lei", lane, { realHome: home, guarded: [lane, scratch] });
  const tmp = path.join(dir, `.lei-${randomUUID()}`);
  writeFileSync(tmp, `${laneId(lane)}\n${opts.branch}\n${opts.head}\n${opts["remote-url"]}\n`, { mode: 0o600, flag: "wx" }); // broker-owned
  renameSync(tmp, path.join(dir, "push")); // broker-owned
  console.log(`push lei strung for ${opts.branch} at ${opts.head}`);
} catch (error) { console.error(`lei-kui refused: ${error.message}`); process.exit(2); }
