#!/usr/bin/env node
/**
 * Red-first guard for the app → web rename.
 *
 * It scans executable, tracked text only. History, carriers, receipts, and
 * generated output are deliberately outside this contract: they describe old
 * states and must remain truthful. Run it after the package move; until then
 * the current app package is an expected, named survivor.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

export const OLD_NAME_PATTERNS = [
  /@lararium\/app/g,
  /packages\/lararium-app/g,
  /LAR_APP_[A-Z0-9_]+/g,
];

const EXECUTABLE_EXTENSIONS = new Set([".cjs", ".js", ".mjs", ".json", ".sh", ".ts", ".tsx", ".yml", ".yaml"]);
const HISTORICAL_SEGMENTS = ["/history/", "/receipts/", "/handoff/"];

export function executablePaths(repoRoot) {
  const listed = execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot }).toString("utf8");
  return listed.split("\0").filter(Boolean).filter((file) => {
    const normalized = `/${file}`;
    return EXECUTABLE_EXTENSIONS.has(extname(file)) && !HISTORICAL_SEGMENTS.some((segment) => normalized.includes(segment));
  });
}

export function findOldNameReferences(repoRoot, files = executablePaths(repoRoot)) {
  const hits = [];
  for (const file of files) {
    if (!existsSync(join(repoRoot, file))) continue; // deleted during a staged re-home; no stale executable remains
    const text = readFileSync(join(repoRoot, file), "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (OLD_NAME_PATTERNS.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test(line);
      })) hits.push(`${file}:${index + 1}: ${line.trim()}`);
    });
  }
  return hits;
}

export function assertNoExecutableOldNames(repoRoot, files) {
  const hits = findOldNameReferences(repoRoot, files);
  if (hits.length > 0) {
    throw new Error(`old app name remains in executable surface:\n${hits.join("\n")}`);
  }
  return { checked: (files ?? executablePaths(repoRoot)).length, hits };
}

if (process.argv[1]?.endsWith("web-migration-name-control.mjs")) {
  const repoRoot = process.cwd();
  try {
    const result = assertNoExecutableOldNames(repoRoot);
    console.log(`[web-name] green: ${result.checked} executable files contain no old app references`);
  } catch (error) {
    console.error(`[web-name] RED\n${error.message}`);
    process.exitCode = 1;
  }
}
