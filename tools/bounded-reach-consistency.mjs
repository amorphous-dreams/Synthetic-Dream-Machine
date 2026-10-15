#!/usr/bin/env node
/**
 * Bounded-reach design control.
 *
 * This reader visits one explicitly named TOML block inside the bounded-reach
 * meme. It checks the authored capability boundary instead of searching prose
 * for suggestive words. A weakened fixture therefore exercises the same seam
 * a future edit can break.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const MEME_PATH = "bags/lararium/ha.ka.ba/lararium/mesh/bounded-reach-contract.mem";

const EXPECTED = Object.freeze({
  "name-grant": "rendezvous-only",
  "split-horizon-owner": "local-recursive-resolver",
  "authoritative-view": "public-global-unfiltered",
  "identity-source": "self-certifying-key",
  "membership-source": "explicit-capability-contract",
  "read-source": "explicit-capability-contract",
  "onomancy-role": "dnssec-binding-to-existing-document",
  "tls-acme-role": "origin-attestation-only",
});

function controlBlock(source) {
  const match = source.match(/```toml bounded-reach-control\n([\s\S]*?)\n```/);
  if (!match) throw new Error("bounded-reach-control block missing");
  return match[1];
}

function fields(block) {
  const result = Object.create(null);
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^([a-z-]+)\s*=\s*"([^"]*)"\s*$/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

export function assertBoundedReachConsistency(source) {
  const actual = fields(controlBlock(source));
  const errors = [];
  for (const [key, expected] of Object.entries(EXPECTED)) {
    if (actual[key] !== expected) {
      errors.push(`${key}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual[key])}`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`bounded-reach invariant RED:\n${errors.join("\n")}`);
  }
  return { fields: Object.keys(EXPECTED).length };
}

function weaken(source, key, value) {
  const line = new RegExp(`^${key.replaceAll("-", "\\-")}\\s*=\\s*"[^"]*"$`, "m");
  return source.replace(line, `${key} = "${value}"`);
}

function selfTest(source) {
  assertBoundedReachConsistency(source);
  const weakened = [
    ["name-grant", "identity-and-membership"],
    ["split-horizon-owner", "public-authoritative-dns"],
    ["onomancy-role", "tls-certificate-issuer"],
    ["tls-acme-role", "mesh-membership-authority"],
  ];
  for (const [key, value] of weakened) {
    let red = false;
    try { assertBoundedReachConsistency(weaken(source, key, value)); } catch { red = true; }
    if (!red) throw new Error(`deliberate weakening stayed green: ${key}`);
  }
  return { positive: "green", weakened: weakened.length };
}

if (process.argv[1]?.endsWith("bounded-reach-consistency.mjs")) {
  const repo = process.cwd();
  const source = readFileSync(join(repo, MEME_PATH), "utf8");
  try {
    const result = process.argv.includes("--self-test") ? selfTest(source) : assertBoundedReachConsistency(source);
    console.log(`[bounded-reach] green: ${JSON.stringify(result)}`);
  } catch (error) {
    console.error(`[bounded-reach] RED\n${error.message}`);
    process.exitCode = 1;
  }
}
