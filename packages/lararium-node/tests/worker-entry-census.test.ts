import { readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";

// Keep listener event names while hiding comments and other string contents.
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g, (token) => {
    if (/^["'](?:message|connect)["']$/.test(token)) return token;
    return token.replace(/[^\n]/g, " ");
  });
}
function listenerIndex(source: string): number {
  const code = codeOnly(source);
  const match = /\.addEventListener\s*\(\s*["'](?:message|connect)["']|\brunBrowserSovereignWorker\s*\(|\bhost\.listen\s*\(/.exec(code);
  return match?.index ?? -1;
}
function violation(name: string, source: string): string | null {
  const code = codeOnly(source), index = listenerIndex(source);
  if (index < 0) return `${name}: no listener`;
  return /\bawait\b/.test(code.slice(0, index)) ? name : null;
}

test("RED: worker entries listen before awaiting; CONTROL: the scanner names a late listener and accepts an early listener", () => {
  expect(violation("planted", 'await boot(); self.addEventListener("message", () => {});')).toBe("planted");
  expect(violation("honest", 'self.addEventListener("message", () => {}); await boot();')).toBeNull();
  expect(violation("missing", "const x = 1;")).toBe("missing: no listener");
  const entries = [
    ["shared-holder.worker.ts", new URL("../../lararium-browser/src/shared-holder.worker.ts", import.meta.url)],
    ["daemon-island-start.ts", new URL("../../lararium-browser/src/daemon-island-start.ts", import.meta.url)],
    ["browser-wiki-worker.ts", new URL("../../lararium-browser/src/browser-wiki-worker.ts", import.meta.url)],
    ["sovereign-kernel.ts", new URL("../../lararium-tw5/src/sovereign-kernel.ts", import.meta.url)],
  ] as const;
  for (const [name, url] of entries) {
    const source = readFileSync(url, "utf8");
    expect(listenerIndex(source), name).toBeGreaterThanOrEqual(0);
    expect(violation(name, source)).toBeNull();
  }
  const kernel = codeOnly(readFileSync(entries[3][1], "utf8"));
  const listen = kernel.indexOf("host.listen("), ready = kernel.indexOf("host.ready?.()", listen);
  expect(listen).toBeGreaterThanOrEqual(0);
  expect(ready).toBeGreaterThan(listen);
  expect(kernel.slice(listen, ready)).not.toMatch(/\bawait\b/);

  // The fixture entries follow the same rule.
  expect(violation("planted.worker.ts", 'await boot(); self.addEventListener("message", () => {});')).toBe("planted.worker.ts");
  const exceptions: Record<string, string> = {
    "faulting-tab.worker.ts": "This fixture deliberately faults before listening.",
    "late-listener-tab.worker.ts": "This fixture deliberately models a slow module graph.",
    "stub-island.worker.ts": "This module exports an island factory rather than a worker entry.",
  };
  const dir = new URL("../../lararium-browser/tests/fixtures/", import.meta.url);
  const files = readdirSync(dir).filter((name) => (name.endsWith(".worker.ts") || name.endsWith(".mjs")) && !(name in exceptions));
  expect(files.length).toBeGreaterThan(0);
  for (const name of files) {
    const source = readFileSync(new URL(name, dir), "utf8");
    expect(listenerIndex(source), name).toBeGreaterThanOrEqual(0);
    expect(violation(name, source)).toBeNull();
  }
});
