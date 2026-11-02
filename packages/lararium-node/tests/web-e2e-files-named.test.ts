/**
 * web-e2e-files-named — every `tests/e2e/*.e2e.test.ts` under lararium-web is named by EXACTLY ONE project include.
 *
 * The web `web-browser` project excludes `tests/e2e/**`, so an e2e file no other project names runs nowhere and its suite reads
 * green: a silent zero (the browser daemon-reopen walk stood unnamed through CI run 41502314358). The two configs that name e2e
 * files are `vitest.config.ts` (its node-env e2e projects) and `vitest.crossing.config.ts` (the floor-crossing job).
 * CONTROL: a planted file no config names reads unnamed, and a file two projects name reads doubled.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const WEB = join(__dirname, "..", "..", "lararium-web");
const CONFIGS = ["vitest.config.ts", "vitest.crossing.config.ts"];

/** How many times each e2e file path appears as an include string across the given config texts. */
function namings(files: readonly string[], configs: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const f of files) {
    const needle = `"tests/e2e/${f}"`;
    out.set(f, configs.reduce((n, text) => n + text.split(needle).length - 1, 0));
  }
  return out;
}

describe("the web e2e files are each named by one project", () => {
  const files = readdirSync(join(WEB, "tests", "e2e")).filter((f) => f.endsWith(".e2e.test.ts"));
  const configs = CONFIGS.map((c) => readFileSync(join(WEB, c), "utf8"));

  test("the directory holds e2e files (a zero here reads red)", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain("daemon-island-reopen.e2e.test.ts");
  });

  test("each file stands in exactly one include", () => {
    const bad = [...namings(files, configs)].filter(([, n]) => n !== 1).map(([f, n]) => `${f} named ${n} time(s)`);
    expect(bad).toEqual([]);
  });

  test("CONTROL: a planted unnamed file reads unnamed, and a doubly named one reads doubled", () => {
    const planted = namings([...files, "zz-planted.e2e.test.ts"], configs);
    expect(planted.get("zz-planted.e2e.test.ts")).toBe(0);
    const doubled = namings(["shore-writes.e2e.test.ts"], [...configs, ...configs]);
    expect(doubled.get("shore-writes.e2e.test.ts")).toBe(2);
  });
});
