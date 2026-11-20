/**
 * pool-image-cli — THE POOL HOOK'S IN-IMAGE CLI PATH HAS ONE ANSWER, HELD BY THREE TEXTS.
 *
 * The pool's pre-commit hook falls back to the CLI the vessel's image carries (`IN_IMAGE_CLI`). The Dockerfile's `serve` stage
 * decides where that CLI rests (its WORKDIR and the destination of the `lares-cli/bin` copy) and the host shim
 * (`tools/lares-container.sh`) runs it as `node "$CLI"` from that WORKDIR. The Dockerfile and the shim are the artifacts
 * under test here, config text read as written: when any of the three moves alone, the hook's container leg points at nothing
 * and a commit inside the image refuses.
 *
 *   PI1 the Dockerfile's serve stage places `bin/lares.mjs` where IN_IMAGE_CLI names it
 *   PI2 the shim's `CLI` variable, taken from the serve stage's WORKDIR, names the same file
 *   PI3 control: a Dockerfile that copies the CLI elsewhere, or a shim that names another bin, reads as disagreeing
 */

import { describe, expect, test } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { IN_IMAGE_CLI } from "../src/pool-tree.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DOCKERFILE = readFileSync(path.join(REPO, "Dockerfile"), "utf8");
const SHIM = readFileSync(path.join(REPO, "tools/lares-container.sh"), "utf8");

/** The one stage the vessel runs: its text, from its `FROM` line to the next. */
function serveStage(dockerfile: string): string {
  const parts = dockerfile.split(/^FROM\s/m);
  return parts.find((p) => /^\S+\s+AS\s+serve\b/.test(p)) ?? "";
}

/** Where the serve stage's `COPY … lares-cli/bin` lands the CLI's file, as an absolute image path. */
function dockerfileCliPath(dockerfile: string): string | null {
  const stage = serveStage(dockerfile);
  const workdir = /^WORKDIR\s+(\S+)/m.exec(stage)?.[1];
  const dest = /^COPY\s+(?:--\S+\s+)*\S*packages\/lares-cli\/bin\s+(\S+)\s*$/m.exec(stage)?.[1];
  if (!workdir || !dest) return null;
  return path.posix.join(path.posix.resolve(workdir, dest), "lares.mjs");
}

/** Where the shim's `CLI` variable lands the CLI, run from the serve stage's WORKDIR. */
function shimCliPath(shim: string, dockerfile: string): string | null {
  const workdir = /^WORKDIR\s+(\S+)/m.exec(serveStage(dockerfile))?.[1];
  const cli = /^CLI="([^"]+)"/m.exec(shim)?.[1];
  if (!workdir || !cli) return null;
  return path.posix.resolve(workdir, cli);
}

describe("pool-image-cli — the Dockerfile, the shim and IN_IMAGE_CLI name one file", () => {
  test("PI1 the serve stage places the CLI where IN_IMAGE_CLI names it", () => {
    expect(dockerfileCliPath(DOCKERFILE)).toBe(IN_IMAGE_CLI);
    expect(existsSync(path.join(REPO, "packages/lares-cli/bin/lares.mjs"))).toBe(true);
  });

  test("PI2 the shim's CLI variable names the same file under the serve stage's WORKDIR", () => {
    expect(shimCliPath(SHIM, DOCKERFILE)).toBe(IN_IMAGE_CLI);
  });

  test("PI3 control: a moved copy or another bin reads as disagreeing", () => {
    const moved = DOCKERFILE.replace(/(COPY --from=build \/app\/packages\/lares-cli\/bin\s+)\.\/packages\/lares-cli\/bin/, "$1./cli/bin");
    expect(moved).not.toBe(DOCKERFILE);
    expect(dockerfileCliPath(moved)).not.toBe(IN_IMAGE_CLI);
    const other = SHIM.replace(/^CLI="[^"]+"/m, 'CLI="packages/lares-cli/bin/other.mjs"');
    expect(shimCliPath(other, DOCKERFILE)).not.toBe(IN_IMAGE_CLI);
    const reworked = DOCKERFILE.replace(/(AS serve\s+WORKDIR )\/app/, "$1/srv");
    expect(reworked).not.toBe(DOCKERFILE);
    expect(dockerfileCliPath(reworked)).not.toBe(IN_IMAGE_CLI);
  });
});
