/**
 * kapae-restart-is-emergency — a kapae-driven daemon restart reaches the holder carrying `KAPAE_EMERGENCY_REASON`, on BOTH vessels, so a refused
 * prepare fails closed (the shadowed island does not keep running). Source weld, with a CONTROL: the holder module exports the constant and a
 * planted prose reason would read red.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { KAPAE_EMERGENCY_REASON } from "@lararium/tw5";

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("a kapae-driven restart is flagged an emergency", () => {
  for (const [name, rel] of [["node", "../src/open-node-vessel.ts"], ["browser", "../../lararium-browser/src/open-browser-vessel.ts"]] as const) {
    test(`RED: the ${name} vessel's arrival restart passes the constant, never prose`, () => {
      const src = read(rel);
      expect(src).toMatch(/daemonHolder\.restart\(KAPAE_EMERGENCY_REASON\)/);
      expect(src).not.toContain(KAPAE_EMERGENCY_REASON.length ? `restart("${KAPAE_EMERGENCY_REASON}")` : "");
    });
  }
  test("CONTROL: the constant names a kapae restart, and the planted prose form would match the forbidden shape", () => {
    expect(KAPAE_EMERGENCY_REASON).toMatch(/kapae/);
    expect(`daemonHolder.restart("${KAPAE_EMERGENCY_REASON}")`).toContain(`restart("${KAPAE_EMERGENCY_REASON}")`);
  });
});
