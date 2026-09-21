import { afterEach, describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertNoExecutableOldNames } from "./web-migration-name-control.mjs";

let root;
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });

describe("web migration executable-name control", () => {
  test("catches the stale root filter, weld directory, and Docker vocabulary", () => {
    root = mkdtempSync(join(tmpdir(), "lararium-web-name-"));
    mkdirSync(join(root, "tools"));
    writeFileSync(join(root, "tools", "root.sh"), 'pnpm --filter @lararium/app dev\n');
    writeFileSync(join(root, "tools", "weld.sh"), 'cd packages/lararium-app\n');
    writeFileSync(join(root, "tools", "compose.yml"), 'LAR_APP_PORT: "5173"\n');
    expect(() => assertNoExecutableOldNames(root, [
      "tools/root.sh", "tools/weld.sh", "tools/compose.yml",
    ])).toThrow(/root\.sh.*@lararium\/app|weld\.sh.*lararium-app|compose\.yml.*LAR_APP_PORT/s);
  });

  test("passes once the three named surfaces use web", () => {
    root = mkdtempSync(join(tmpdir(), "lararium-web-name-"));
    mkdirSync(join(root, "tools"));
    writeFileSync(join(root, "tools", "root.sh"), 'pnpm --filter @lararium/web dev\n');
    writeFileSync(join(root, "tools", "weld.sh"), 'cd packages/lararium-web\n');
    writeFileSync(join(root, "tools", "compose.yml"), 'LAR_WEB_PORT: "5173"\n');
    expect(assertNoExecutableOldNames(root, [
      "tools/root.sh", "tools/weld.sh", "tools/compose.yml",
    ]).hits).toHaveLength(0);
  });
});
