/**
 * AN UNKNOWN NAME REFUSES — WITH OR WITHOUT `--help`.
 *
 * A name outside the command table refuses with status 2. Routing an unknown command to the global
 * menu returns 0 and prints a full page, which reads exactly like a door that opened. A nonsense verb
 * rides as the control, and a live door under `--help` rides as its other side: without both, this file
 * could pass against a binary that answers everything, or one that refuses everything.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { dispatch } from "../src/bin/lares.js";

const CONTROL = "zzz-not-a-verb";

afterEach(() => vi.restoreAllMocks());

const quiet = (): void => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
};

describe("the unknown-command refusal", () => {
  test("★ an unknown name refuses, bare and under --help ★", async () => {
    quiet();
    expect(await dispatch([CONTROL]), "bare answered").toBe(2);
    expect(await dispatch([CONTROL, "--help"]), "--help answered").toBe(2);
  });

  test("CONTROL: a live door under `--help` renders its own help and returns 0", async () => {
    quiet();
    expect(await dispatch(["vessel", "--help"])).toBe(0);
  });
});
