/**
 * herm-sight-seam.test — the herm's sight of a sibling channel stays transient in production. The relay takes a
 * frame observer as a PARAMETER (`startCarriageRelay({ onSiblingFrame })`); no vessel boot path reads an
 * environment switch that turns that sight into a durable log. A witness that needs the sight stands its own relay
 * and passes its own observer.
 *
 *   · RED: no node source outside the relay's own seam names a frame observer or a sight log;
 *   · CONTROL: the seam itself stands — the relay module takes the observer, so a witness can pass one.
 */
import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "src");
/** The relay's own modules: where the observer is a parameter, never read off the environment. */
const SEAM = new Set(["carriage-relay.ts", "authenticated-membership-relay.ts"]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : name.endsWith(".ts") ? [path] : [];
  });
}

describe("the herm's sight stays transient in production", () => {
  test("RED: no node source outside the relay's seam names a frame observer or a sight log", () => {
    const files = sources(SRC);
    expect(files.length).toBeGreaterThan(50);
    const offenders = files
      .filter((f) => !SEAM.has(f.slice(SRC.length + 1)))
      .filter((f) => /onSiblingFrame|HERM_SIGHT/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  test("CONTROL: the relay module takes the observer as a parameter", () => {
    const relay = readFileSync(join(SRC, "carriage-relay.ts"), "utf8");
    expect(relay).toMatch(/onSiblingFrame\?:/);
    expect(relay).not.toMatch(/process\.env/);
  });
});
