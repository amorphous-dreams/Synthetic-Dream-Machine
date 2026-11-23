/**
 * THE RELEASE OF A QUARANTINED ID HOLDS A DOOR OF ITS OWN: `lares vessel release <documentId> [--keep|--fresh]`.
 *
 * `read` inspects and starts nothing, so the hand's write that ends a hold rides its own sub-door, never a flag on the
 * read. The release claims the store for its act (the one claim a standing vessel also holds), so a vessel or another
 * command holding the store refuses it by name, naming the stop that frees it.
 *
 *   R1  a release with no id refuses with its usage.
 *   R2  --keep and --fresh together refuse: one act at a time.
 *   R3  an id no hold names refuses by name.
 *   R4  a held store (a standing vessel, a command mid-act) refuses, naming `lares vessel stop`, and moves nothing.
 *   R5  a release lands: the bytes return under the id, the manifest reads released, and the store claim lets go.
 *   R7  a fallen vessel that let its claim go (a fall during boot frees the store's name) still holds the store: a resting
 *       fall whose process lives refuses the release by name, naming that pid and `lares vessel stop`. CONTROL: a fall whose
 *       process has ended lets the release land.
 *   R6  the old spelling on the read (`vessel read vessel --release*`) moved: it names the new door, exit 2, and reads nothing.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dispatch } from "../src/bin/lares.js";
import { spawn } from "node:child_process";
import { claimStore, quarantineDoc, quarantineHolds, restEngineFall } from "@lararium/node";

const roots: string[] = [];
const savedRoot = process.env["LAR_ROOT"];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  if (savedRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = savedRoot;
});

const DOC = "4NMNnkMhL8jXrdJ9jamS2rUEaQDq";

function house(): { root: string; storageDir: string } {
  const root = mkdtempSync(join(tmpdir(), "lares-release-"));
  roots.push(root);
  const storageDir = join(root, "hearth", "vessel");
  mkdirSync(storageDir, { recursive: true });
  process.env["LAR_ROOT"] = root;
  return { root, storageDir };
}

/** Plant one document's bytes and quarantine them, as a boot's condemn would. */
function held(storageDir: string): void {
  const live = join(storageDir, DOC.slice(0, 2), DOC.slice(2), "snapshot");
  mkdirSync(live, { recursive: true });
  writeFileSync(join(live, "chunk"), "torn bytes");
  quarantineDoc(storageDir, { documentId: DOC, status: "torn", reason: "planted" }, { bagId: "lar:///ha.ka.ba/bags/daemon" });
}

function said(): { err: string[]; out: string[] } {
  const err: string[] = [];
  const out: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { err.push(a.join(" ")); });
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.join(" ")); });
  return { err, out };
}

describe("lares vessel release <documentId> [--keep|--fresh]", () => {
  test("R1 — a release with no id refuses with its usage", async () => {
    const { root } = house();
    const s = said();
    expect(await dispatch(["vessel", "release", "--root", root, "--skip-build"])).toBe(2);
    expect(s.err.join("\n")).toMatch(/lares vessel release <documentId> \[--keep\|--fresh\]/);
  });

  test("R2 — --keep and --fresh together refuse: one act at a time", async () => {
    const { root } = house();
    const s = said();
    expect(await dispatch(["vessel", "release", DOC, "--keep", "--fresh", "--root", root, "--skip-build"])).toBe(2);
    expect(s.err.join("\n")).toMatch(/one act/);
  });

  test("R3 — an id no hold names refuses by name", async () => {
    const { root } = house();
    const s = said();
    expect(await dispatch(["vessel", "release", DOC, "--keep", "--root", root, "--skip-build"])).toBe(2);
    expect(s.err.join("\n")).toMatch(/no quarantine hold names this id/);
  });

  test("R4 — a held store refuses, names `lares vessel stop`, and moves nothing", async () => {
    const { root, storageDir } = house();
    held(storageDir);
    const claim = await claimStore(storageDir);
    try {
      const s = said();
      expect(await dispatch(["vessel", "release", DOC, "--root", root, "--skip-build"])).toBe(2);
      expect(s.err.join("\n")).toMatch(/`lares vessel stop`/);
      expect(quarantineHolds(storageDir).map((h) => h.manifest.documentId)).toEqual([DOC]);
    } finally { await claim.release(); }
  });

  test("R5 — a release lands: the bytes return, the hold ends, and the claim lets go", async () => {
    const { root, storageDir } = house();
    held(storageDir);
    const s = said();
    expect(await dispatch(["vessel", "release", DOC, "--root", root, "--skip-build"])).toBe(0);
    expect(s.out.join("\n")).toMatch(/released 4NMNnkMhL8jXrdJ9jamS2rUEaQDq/);
    expect(existsSync(join(storageDir, DOC.slice(0, 2), DOC.slice(2), "snapshot", "chunk"))).toBe(true);
    expect(quarantineHolds(storageDir)).toEqual([]);
    // The claim let go: a fresh claim binds at once.
    const after = await claimStore(storageDir);
    await after.release();
  });

  for (const flag of ["--release", "--release-keep", "--release-fresh"]) {
    test(`R6 — the old spelling \`vessel read vessel ${flag}\` moved: it names the new door and reads nothing`, async () => {
      const { root, storageDir } = house();
      held(storageDir);
      const s = said();
      expect(await dispatch(["vessel", "read", "vessel", "--root", root, "--skip-build", flag, DOC])).toBe(2);
      expect(s.err.join("\n")).toMatch(/moved to `lares vessel release <documentId> \[--keep\|--fresh\]`/);
      expect(quarantineHolds(storageDir).map((h) => h.manifest.documentId)).toEqual([DOC]);
    });
  }

  test("R7 — a fallen process that let its claim go still holds the store: the release refuses, naming its pid and the stop", async () => {
    const { root, storageDir } = house();
    held(storageDir);
    const husk = spawn("sleep", ["60"], { stdio: "ignore" });
    try {
      restEngineFall(storageDir, { cause: "wasm-unreachable", path: "repo", detail: "x", since: "2026-11-23T01:00:00.000Z", lastSettled: null, inFlight: null }, "a".repeat(32), husk.pid!);
      const s = said();
      expect(await dispatch(["vessel", "release", DOC, "--root", root, "--skip-build"])).toBe(2);
      const err = s.err.join("\n");
      expect(err).toContain(`pid ${husk.pid}`);
      expect(err).toMatch(/`lares vessel stop`/);
      expect(quarantineHolds(storageDir).map((h) => h.manifest.documentId)).toEqual([DOC]);
    } finally { husk.kill(); }
  });

  test("R7 CONTROL — a fall whose process ended lets the release land", async () => {
    const { root, storageDir } = house();
    held(storageDir);
    const gone = spawn("true", [], { stdio: "ignore" });
    await new Promise((r) => gone.once("exit", r));
    restEngineFall(storageDir, { cause: "wasm-unreachable", path: "repo", detail: "x", since: "2026-11-23T01:00:00.000Z", lastSettled: null, inFlight: null }, "a".repeat(32), gone.pid!);
    said();
    expect(await dispatch(["vessel", "release", DOC, "--root", root, "--skip-build"])).toBe(0);
    expect(quarantineHolds(storageDir)).toEqual([]);
  });
});
