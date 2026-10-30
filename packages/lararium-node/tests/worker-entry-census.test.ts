import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import { codeOnly, listenerIndex, violation } from "../../../tools/worker-entry-scan.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const packages = resolve(root, "packages");
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : [];
  });
}
function deriveEntries(): string[] {
  const entries = new Set<string>();
  for (const pkg of readdirSync(packages, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const base = resolve(packages, pkg.name);
    for (const sub of ["src", "tests/fixtures"]) {
      let files: string[];
      try { files = walk(resolve(base, sub)); } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      for (const file of files) {
        if (/\.worker\.(?:ts|mjs)$/.test(file)) entries.add(file);
        if (sub !== "src" || !/\.[cm]?[jt]sx?$/.test(file)) continue;
        const source = readFileSync(file, "utf8");
        // Resolve statically named constructor URLs and Vite worker imports. Variable URLs have no static target here.
        const targets = /new\s+(?:SharedWorker|Worker)\s*\(\s*(?:new\s+URL\s*\(\s*)?["']([^"']+)["']|["']([^"']+)\?(?:sharedworker|worker)(?:&[^"']*)?["']/g;
        for (const match of source.matchAll(targets)) {
          const target = match[1] ?? match[2];
          if (target.startsWith(".")) entries.add(resolve(dirname(file), target));
        }
      }
    }
  }
  return [...entries].sort();
}
const nameOf = (path: string) => relative(root, path).replaceAll("\\", "/");
const exceptions: Record<string, string> = {
  "packages/lararium-browser/tests/fixtures/faulting-tab.worker.ts": "This fixture deliberately faults before listening.",
  "packages/lararium-browser/tests/fixtures/late-listener-tab.worker.ts": "This fixture deliberately models a slow module graph.",
  "packages/lararium-browser/tests/fixtures/stub-island.worker.ts": "This module exports an island factory rather than a worker entry.",
};
const readyGated: Record<string, string> = {
  "packages/lararium-web/src/workers/daemon.worker.ts": "packages/lararium-browser/src/daemon-island-start.ts",
  "packages/lararium-web/src/workers/wiki.worker.ts": "packages/lararium-browser/src/browser-wiki-worker.ts",
};
const sharedWorkers = new Set([
  "packages/lararium-web/src/workers/shared-holder.worker.ts",
  "packages/lararium-browser/src/shared-holder.worker.ts",
  "packages/lararium-browser/tests/fixtures/shared-holder-live.worker.ts",
  "packages/lararium-browser/tests/fixtures/buffered-shared.worker.ts",
]);
// Discover SharedWorker targets at their source sites as well as the known direct entry and fixtures.
for (const pkg of readdirSync(packages, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
  let files: string[];
  try { files = walk(resolve(packages, pkg.name, "src")); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
    throw error;
  }
  for (const file of files.filter((path) => /\.[cm]?[jt]sx?$/.test(path))) {
    const source = readFileSync(file, "utf8");
    const targets = /new\s+SharedWorker\s*\(\s*(?:new\s+URL\s*\(\s*)?["']([^"']+)["']|["']([^"']+)\?sharedworker(?:&[^"']*)?["']/g;
    for (const match of source.matchAll(targets)) {
      const target = match[1] ?? match[2];
      if (target.startsWith(".")) sharedWorkers.add(nameOf(resolve(dirname(file), target)));
    }
  }
}
function sharedViolation(name: string, source: string): string | null {
  const code = codeOnly(source);
  const index = /\.addEventListener\s*\(\s*["']connect["']/.exec(code)?.index ?? -1;
  if (index < 0) return `${name}: no connect listener`;
  const before = code.slice(0, index);
  let depth = 0;
  for (const char of before) { if (char === "{") depth++; else if (char === "}") depth--; }
  return depth !== 0 || /\bawait\b/.test(before) ? name : null;
}

test("RED: executable template expressions before a listener are named; CONTROL: plain template text stands", () => {
  expect(violation("template-text.worker.ts", '`await boot()`; self.addEventListener("message", () => {});')).toBeNull();
  expect(violation("template-await.worker.ts", '`${await boot()}`; self.addEventListener("message", () => {});')).toBe("template-await.worker.ts");
});

test("CONTROL: derived census includes known entries and names planted late and missing listeners", () => {
  const entries = deriveEntries().map(nameOf);
  expect(entries.length).toBeGreaterThan(0);
  for (const name of [...Object.keys(readyGated), ...sharedWorkers, ...Object.keys(exceptions)]) expect(entries).toContain(name);
  expect(violation("planted.worker.ts", 'await boot(); self.addEventListener("message", () => {});')).toBe("planted.worker.ts");
  expect(violation("honest.worker.ts", 'self.addEventListener("message", () => {}); await boot();')).toBeNull();
  expect(sharedViolation("nested-shared.worker.ts", 'async function boot() { self.addEventListener("connect", () => {}); }')).toBe("nested-shared.worker.ts");
  expect(sharedViolation("missing-shared.worker.ts", 'self.addEventListener("message", () => {});')).toBe("missing-shared.worker.ts: no connect listener");
});

test("CONTROL: ready-gated delegates listen before the kernel posts ready", () => {
  const kernel = codeOnly(readFileSync(resolve(root, "packages/lararium-tw5/src/sovereign-kernel.ts"), "utf8"));
  const listen = kernel.indexOf("host.listen("), ready = kernel.indexOf("host.ready?.()", listen);
  expect(listen).toBeGreaterThanOrEqual(0);
  expect(ready).toBeGreaterThan(listen);
  expect(kernel.slice(listen, ready)).not.toMatch(/\bawait\b/);
  for (const [entry, delegate] of Object.entries(readyGated)) {
    const source = readFileSync(resolve(root, delegate), "utf8");
    expect(violation(delegate, source), entry).toBeNull();
    expect(codeOnly(source), entry).toMatch(/\brunBrowserSovereignWorker\s*\(/);
  }
});

test("RED: derived worker entries listen before awaiting, including synchronous SharedWorker connect listeners", () => {
  const violations: string[] = [];
  for (const path of deriveEntries()) {
    const name = nameOf(path);
    if (name in exceptions || name in readyGated) continue;
    const source = readFileSync(path, "utf8");
    const result = sharedWorkers.has(name) ? sharedViolation(name, source) : violation(name, source);
    if (result) violations.push(result);
  }
  expect(violations).toEqual([]);
});

test("RED: the scanner reads execution order, not text; CONTROL: honest entries stand", () => {
  // A brace inside a string within an interpolation must not end it; an await after it still precedes the listener.
  expect(violation("brace-in-string.worker.ts", '`${"}" + await boot()}`; self.addEventListener("message", () => {});')).toBe("brace-in-string.worker.ts");
  // A listener named only in a comment inside an interpolation is no listener.
  expect(violation("comment-listener.worker.ts", 'await boot(); `${/* self.addEventListener("message", f) */ 1}`; self.addEventListener("message", () => {});')).toBe("comment-listener.worker.ts");
  // A listener inside a function nobody calls does not stand at the top level; the later top-level await leaves it unregistered.
  expect(violation("uncalled.worker.ts", 'function start() { self.addEventListener("message", () => {}); }\nawait boot();')).toBe("uncalled.worker.ts: no listener");
  // An await inside a deferred function ahead of the listener runs later and delays nothing.
  expect(violation("deferred.worker.ts", 'async function later() { await boot(); }\nself.addEventListener("message", () => {});')).toBeNull();
  // CONTROL: the plain top-level listener before an await stands.
  expect(violation("honest.worker.ts", 'self.addEventListener("message", () => {});\nawait boot();')).toBeNull();
});
