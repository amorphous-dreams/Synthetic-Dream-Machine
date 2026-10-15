/**
 * THE DEV BUILD DOES NOT RENDER THE ENGINE. The sha256 of the vendored TW5 core blob IS
 * `hearthTrueName`, riding inside the signed preimage of every device-delegation edge — so re-rendering
 * the blob re-binds every vessel that ever joined. The default `build` runs on every dev-loop
 * `vessel rite refresh` (root `pnpm build`), so a vendor render there moves the epoch by hygiene. The
 * engine render lives ONLY in `build:tw5-vendor`, run on purpose when the TW5 submodule is bumped.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(HERE, "..", "package.json"), "utf8")) as { scripts: Record<string, string> };

describe("★ the default build spells no engine render ★", () => {
  test("build runs no vendor render", () => {
    expect(pkg.scripts["build"]).not.toMatch(/build-tw5-vendor|build:tw5-vendor/);
  });
  test("CONTROL: build still packs the plugin and compiles", () => {
    expect(pkg.scripts["build"]).toMatch(/build-plugin-tiddler/);
    expect(pkg.scripts["build"]).toMatch(/tsc/);
  });
  test("the engine render stands as its own deliberate act", () => {
    expect(pkg.scripts["build:tw5-vendor"]).toMatch(/build-tw5-vendor/);
  });
});
