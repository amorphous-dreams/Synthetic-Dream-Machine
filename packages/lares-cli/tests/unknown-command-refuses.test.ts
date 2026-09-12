/**
 * AN UNKNOWN NAME REFUSES — WITH OR WITHOUT `--help`.
 *
 * The vessel collapse retired fourteen spellings and keeps no aliases, and its own verification reads
 * *no old name answers*. That check is only performable from outside if a name that does not answer
 * REFUSES: routing an unknown command to the global menu returns 0 and prints a full page, which reads
 * exactly like a door that opened.
 *
 * Measured before this test existed: a probe of `lares wake --help` reported four retired verbs as
 * ANSWERING, because `--help` on a name outside the table fell through to the global-help branch. The
 * control — a nonsense verb — printed the identical page and exited 0, which is what named the defect.
 * So the control rides here beside the retired spellings: without it, this file could pass against a
 * binary that answers everything.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { dispatch } from "../src/bin/lares.js";
import { VESSEL_SUBS } from "../src/commands/vessel.js";

/**
 * Every spelling the vessel collapse retired, the `carrier` door the meme collapse retired (its verbs
 * answer at `lares meme` and `lares act REPACK` now), plus a name that never existed.
 */
const RETIRED = [
  "init", "wake", "serve", "dev", "reset", "fresh", "reconcile",
  "refresh", "rebuild", "build-genesis", "regenesis", "status", "node",
  "carrier",
] as const;
const CONTROL = "zzz-not-a-verb";

afterEach(() => vi.restoreAllMocks());

const quiet = (): void => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
};

describe("the unknown-command refusal", () => {
  test("★ every retired spelling refuses, bare ★", async () => {
    quiet();
    for (const name of RETIRED) {
      expect(await dispatch([name]), `${name} answered`).toBe(2);
    }
  });

  test("★ every retired spelling refuses under --help too ★", async () => {
    quiet();
    for (const name of RETIRED) {
      expect(await dispatch([name, "--help"]), `${name} --help answered`).toBe(2);
    }
  });

  test("★ the carrier door's three verbs refuse under their old spelling ★", async () => {
    quiet();
    for (const verb of ["normalize", "project-md", "repack"]) {
      expect(await dispatch(["carrier", verb, "x.mem"]), `carrier ${verb} answered`).toBe(2);
    }
  });

  test("★ `bake` is retired as a vessel sub-door — the genesis re-derive is an internal rite step, and the mesh-going act rides `nexus kahuli` ★", () => {
    // The single-vessel `vessel bake` door retires (no alias): advancing the genesis composition is a MESH
    // act (`nexus kahuli`), and the LOCAL re-derive survives only as an internal step of the rebuild/rebirth
    // rites + the `build:genesis` build script. Asserted at the authoritative sub-set (cmdVessel dispatches
    // exclusively through it, returning 2 for anything absent) — dispatching `vessel bake` live would run
    // the build-genesis script against the repo genesis, so the set is the safe, exact instrument.
    expect(VESSEL_SUBS).not.toContain("bake");
    // CONTROL — the primitives that stay still answer, so the retirement is surgical, not a table wipe.
    expect(VESSEL_SUBS).toContain("found");
    expect(VESSEL_SUBS).toContain("seed");
    expect(VESSEL_SUBS).toContain("read");
  });

  test("the control proves the refusal is real, not a binary that refuses everything", async () => {
    quiet();
    expect(await dispatch([CONTROL])).toBe(2);
    expect(await dispatch([CONTROL, "--help"])).toBe(2);
    // A live door under `--help` renders its own help and returns 0 — the other side of the same gate.
    expect(await dispatch(["vessel", "--help"])).toBe(0);
  });
});
