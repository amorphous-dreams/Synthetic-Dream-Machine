#!/usr/bin/env node
/**
 * carrier-head — the shore, reachable from a gate that cannot import TypeScript.
 *
 * One process, many files: a witness in another language calls this ONCE with every carrier and reads
 * the lines back. Spawning node per file would cost 700 process starts to answer one question.
 *
 * Emits one JSON object per line: { file, uri, namespace, code, quoted } — `uri` null where the
 * carrier's head names no address, which a torn frame must report rather than invent.
 *
 * Usage:  node tools/carrier-head.mjs <file.mem> [more…]
 *         node tools/carrier-head.mjs --stdin   (newline-separated paths)
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHORE = join(HERE, "../packages/lararium-tw5/dist/carrier-head.js");

// THE ABSENCE NAMES ITS OWN CURE. A gate that skipped here would read clean over an unbuilt tree,
// which is the one reading it must never give.
if (!existsSync(SHORE)) {
  console.error(`carrier-head: no built shore at ${SHORE}\n  cure: pnpm --filter @lararium/tw5 build`);
  process.exit(2);
}
const { matchCarrierHead } = await import(SHORE);

const argv = process.argv.slice(2);
const files = argv.includes("--stdin")
  ? readFileSync(0, "utf8").split("\n").filter(Boolean)
  : argv.filter((a) => !a.startsWith("--"));

if (files.length === 0) {
  console.error("carrier-head: name the carriers, or pass --stdin");
  process.exit(2);
}

for (const f of files) {
  let head = null;
  try { head = matchCarrierHead(readFileSync(f, "utf8")); } catch { /* unreadable reads as no head */ }
  process.stdout.write(JSON.stringify({
    file: f,
    uri: head?.uri ?? null,
    namespace: head?.namespace ?? null,
    code: head?.code ?? null,
    quoted: head?.quoted ?? null,
  }) + "\n");
}
