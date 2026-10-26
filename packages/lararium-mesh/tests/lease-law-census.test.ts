/** One lease law: retired spellings stay absent, and every raw prefix scan faces a signed reader. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const PACKAGES = join(import.meta.dirname, "..", "..");
const RETIRED = [["effective", "Lease", "Epoch"], ["roll", "Lease", "Epoch", "OnBoard"]].map((parts) => parts.join(""));
const READERS = ["signedLeaseEpoch", "quorumLeaseEpoch", "quorumLeaseEpochOnBoard", "readLeaseAdvance"];
/** Address makers and writers name the prefix without making an authority read. */
const ALLOWED: Record<string, string> = {
  "lararium-mesh/src/epoch-lease.ts": "defines slot addresses",
  "lararium-mesh/src/quorum-lease.ts": "writes and scans quorum slots through its own verifier",
  "lararium-keyhive/src/operator-daemon-behavior.ts": "passes the address to the signed face gate",
  "lararium-node/src/commands/persona-lease.ts": "writes a signed face slot",
  "lararium-node/tests/lease-fence-weld.test.ts": "checks the feed and lease address spaces stay apart",
  "lararium-node/src/commands/device-admit.ts": "passes face slot texts to readFace.leaseEpoch, which verifies signed advances against the face lineage",
  "lararium-node/src/open-node-vessel.ts": "passes face slots to raiseAnchorFromSlots and readFace.leaseEpoch, both verified lineage readers",
  "lararium-browser/src/open-browser-vessel.ts": "passes face slots to readFace.observedLease and readFace.leaseEpoch, both signed lineage readers",
  "lararium-mesh/tests/epoch-lease.test.ts": "checks only address shape",
  "lararium-mesh/tests/lease-ownership.test.ts": "checks only address ownership",
};
const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
export function barePrefixScan(src: string): boolean {
  const code = stripComments(src);
  return /\bleaseEpochPrefix\s*\(/.test(code) && !READERS.some((reader) => code.includes(reader));
}
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === "node_modules" || name === "dist") continue;
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(?:ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}
function files(): Array<{ rel: string; src: string }> {
  return readdirSync(PACKAGES).flatMap((pkg) => ["src", "tests", "probes"].flatMap((area) => {
    const dir = join(PACKAGES, pkg, area);
    try { if (!statSync(dir).isDirectory()) return []; } catch { return []; }
    return walk(dir).map((path) => ({ rel: relative(PACKAGES, path), src: readFileSync(path, "utf8") }));
  }));
}

describe("lease-law census", () => {
  test("CONTROL: a planted bare scan triggers the same scanner, and the tree has files", () => {
    expect(barePrefixScan("const value = leaseEpochPrefix(resource); const n = Number(slot); ")).toBe(true);
    expect(barePrefixScan("const value = leaseEpochPrefix(resource); signedLeaseEpoch(resource, [], allow);")).toBe(false);
    expect(files().length).toBeGreaterThan(0);
  });
  test("RED: retired names occur nowhere in package source, tests or probes", () => {
    const offenders = files().flatMap((file) => RETIRED.filter((name) => file.src.includes(name)).map((name) => `${file.rel}: ${name}`));
    expect(offenders).toEqual([]);
  });
  test("RED until round B: every authority prefix scan names a signed reader", () => {
    const offenders = files().filter((file) => file.rel.includes("/src/") && barePrefixScan(file.src) && !(file.rel in ALLOWED)).map((file) => file.rel).sort();
    expect(offenders).toEqual([]);
  });
});
