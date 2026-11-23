/**
 * THE RELEASE ACTS ON THE DEEP VESSEL LENS NAME THEIR ID. A bare `--release`, `--release-fresh` or `--release-keep` refuses
 * with its usage, never falling through to the plain read; a release with an id no hold names refuses by name.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dispatch } from "../src/bin/lares.js";

const roots: string[] = [];
const savedRoot = process.env["LAR_ROOT"];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  if (savedRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = savedRoot;
});

function house(): string {
  const root = mkdtempSync(join(tmpdir(), "lares-read-release-"));
  roots.push(root);
  mkdirSync(join(root, "hearth", "vessel"), { recursive: true });
  return root;
}

describe("vessel read vessel --release*", () => {
  for (const act of ["release", "release-fresh", "release-keep"]) {
    test(`a bare --${act} refuses with its usage`, async () => {
      const root = house();
      process.env["LAR_ROOT"] = root;
      const said: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { said.push(a.join(" ")); });
      vi.spyOn(console, "log").mockImplementation(() => {});
      expect(await dispatch(["vessel", "read", "vessel", "--root", root, "--skip-build", `--${act}`])).toBe(2);
      expect(said.join("\n")).toMatch(new RegExp(`--${act} <documentId>`));
    });
  }

  test("a release no hold names refuses by name", async () => {
    const root = house();
    process.env["LAR_ROOT"] = root;
    const said: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { said.push(a.join(" ")); });
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await dispatch(["vessel", "read", "vessel", "--root", root, "--skip-build", "--release-keep", "4NMNnkMhL8jXrdJ9jamS2rUEaQDq"])).toBe(2);
    expect(said.join("\n")).toMatch(/no quarantine hold names this id/);
  });
});
