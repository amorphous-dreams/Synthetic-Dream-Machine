import { describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openPromotionApproval as sourceOpenPromotionApproval } from "../../lararium-mesh/src/promotion-approval.js";

describe("in-process workspace imports", () => {
  test("CONTROL the source barrel exports the promotion approval verb", () => {
    expect(typeof sourceOpenPromotionApproval).toBe("function");
  });

  test("the mesh package import resolves to this worktree's source", async () => {
    const { openPromotionApproval } = await import("@lararium/mesh");
    expect(openPromotionApproval).toBe(sourceOpenPromotionApproval);
  });

  test("CONTROL a spawned Node process loads the built mesh artifact; mesh dist not built fails", () => {
    const meshDist = fileURLToPath(new URL("../../lararium-mesh/dist/index.js", import.meta.url));
    if (!existsSync(meshDist)) throw new Error("mesh dist not built");
    // A spawned process resolves through node_modules; a link into another checkout loads that checkout's build.
    const linked = realpathSync(fileURLToPath(new URL("../node_modules/@lararium/mesh", import.meta.url)));
    const own = realpathSync(fileURLToPath(new URL("../../lararium-mesh", import.meta.url)));
    if (linked !== own) throw new Error(`@lararium/mesh links to another checkout (${linked}); a spawned process would load its build`);
    const loadedUrl = execFileSync(process.execPath, [
      "--input-type=module", "-e", [
        "import { openPromotionApproval } from '@lararium/mesh';",
        "if (typeof openPromotionApproval !== 'function') throw new Error('mesh export missing');",
        "process.stdout.write(import.meta.resolve('@lararium/mesh'));",
      ].join("\n"),
    ], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" });
    expect(fileURLToPath(loadedUrl)).toBe(meshDist);
  });
});
