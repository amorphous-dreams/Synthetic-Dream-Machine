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
  test("R2: the flag module has burned", () => {
    expect(existsSync(source("../../lararium-web/src/glass/flag.ts"))).toBe(false);
  });
});
