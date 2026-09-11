/**
 * THE ENGINE EPOCH MOVES BY AN ACT, NEVER BY HYGIENE. The sha256 of the vendored TW5 core blob IS
 * `hearthTrueName`, riding inside the signed preimage of every device-delegation edge — so re-rendering
 * the blob re-binds every vessel that ever joined. `build:genesis` reads the blob that stands and fails
 * loud when none does, naming `build:tw5-vendor` as the intentional act; it never runs that act itself.
 * The e2e harness and `vessel clear` both ride `build:genesis`, so a re-render there moved the epoch
 * on every staged boot.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(HERE, "..", "package.json"), "utf8")) as { scripts: Record<string, string> };

describe("★ build:genesis reads the engine, never mints it ★", () => {
  test("the script spells no vendor render", () => {
    expect(pkg.scripts["build:genesis"]).not.toMatch(/build:tw5-vendor|build:vendor|build-tw5-vendor/);
  });
  test("CONTROL: the script still packs the plugin and bakes the island", () => {
    expect(pkg.scripts["build:genesis"]).toMatch(/build:plugin/);
    expect(pkg.scripts["build:genesis"]).toMatch(/build-genesis-island/);
  });
  test("the genesis script fails loud on an absent blob and names the act", () => {
    const src = readFileSync(join(HERE, "..", "scripts", "build-genesis-island.ts"), "utf8");
    expect(src).toMatch(/TW5 core not found/);
    expect(src).toMatch(/build:(tw5-)?vendor/);
  });
});
