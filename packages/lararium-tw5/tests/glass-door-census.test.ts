import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));
describe("mirror door source census", () => {
  test("CONTROL: the main-thread sovereignty guard remains", () => {
    expect(readFileSync(source("../src/tw5-host-bridge.ts"), "utf8")).toContain("sovereignty violation");
  });
  test.each(["tw5-vm.ts", "tw5-host-bridge.ts"])("R2: %s drops the glass boolean option", file => {
    expect(readFileSync(source(`../src/${file}`), "utf8")).not.toMatch(/options\?\s*:\s*\{\s*glass/);
  });
  test("R2: no URL-selector module remains", () => {
    expect(existsSync(source("../../lararium-web/src/glass/flag.ts"))).toBe(false);
  });
  // R5: no clock decides anything in the mirror's own code. The pattern proves itself on a planted line first.
  const clock = /\b(Date\.now|performance\.now|setTimeout|setInterval|requestIdleCallback)\b|new Date\(/;
  const glassSources = ["../src/glass-mirror.ts", "../src/glass-port-adaptor.ts", "../src/glass-camera.ts", "../src/glass-token.ts",
    ...["stand", "boot", "cas", "cid", "leader", "tab-bus"].map(name => `../../lararium-web/src/glass/${name}.ts`)];
  test("R5 CONTROL: the clock pattern catches a planted clock read", () => {
    expect(clock.test("const t = Date.now();")).toBe(true);
    expect(clock.test("await new Promise(r => setTimeout(r, 5));")).toBe(true);
  });
  test.each(glassSources)("R5: %s reads no clock", file => {
    expect(readFileSync(source(file), "utf8")).not.toMatch(clock);
  });
  // One pattern for boot, width and caps: no setting, URL value or stored value picks a width. The glass sources read storage only for the two evidence keys.
  const widthSources = ["stand", "boot", "cas", "cid", "leader", "tab-bus"].map(name => `../../lararium-web/src/glass/${name}.ts`).concat("../../lararium-web/src/page-mirror.ts");
  test("CONTROL: the width-source pattern catches a planted setting read", () => {
    expect(/localStorage|location\.search|URLSearchParams/.test("const w = localStorage.getItem('width');")).toBe(true);
  });
  test.each(widthSources)("%s reads no local store, query or setting", file => {
    expect(readFileSync(source(file), "utf8")).not.toMatch(/localStorage|location\.search|URLSearchParams/);
  });
  test("stand.ts names storage only through the two evidence keys", () => {
    const text = readFileSync(source("../../lararium-web/src/glass/stand.ts"), "utf8");
    const reads = [...text.matchAll(/store\.(?:getItem|setItem|removeItem)\(([^,)]+)/g)].map(match => match[1]);
    expect(reads.length).toBeGreaterThan(0);
    for (const key of reads) expect(key).toMatch(/^(evidenceKey|standingKey)$/);
  });
});
