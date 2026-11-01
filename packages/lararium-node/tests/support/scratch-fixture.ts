/**
 * scratch-fixture — the node suites' one scratch root, as a vitest fixture.
 *
 * A suite that drives a vessel in its own process needs a scratch directory, a `LAR_ROOT` that points at it, a
 * `HOME` that stands inside it and a global git config that reads empty, all restored when the test ends. Sixty
 * files spelled that as `mkdtemp` + save + set + restore + `rmSync`; this file spells it once.
 *
 * `test` (also exported as `it`) carries an AUTO fixture, so a file that imports it from here gets the scratch
 * root around every test with no per-test parameter. `scratchRoot` and `scratchHome` are live bindings the
 * fixture moves per test (a file runs its tests one at a time), so a body keeps reading `root` as before:
 * `import { scratchRoot as root, test } from "./support/scratch-fixture.js"`.
 *
 * The close reads the env back. A test that moved `LAR_ROOT`, `HOME` or `GIT_CONFIG_GLOBAL` and did not put it
 * back fails by name ({@link ScratchEnvLeak}) after the fixture restores the prior value, so one leak never
 * poisons the next test. The scratch custody (`scratch-custody-setup.ts`) still refuses any home outside the
 * temp directory; this fixture founds and opens nothing.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as base } from "vitest";

/** The env keys the fixture owns: set at open, read back and restored at close. */
const KEYS = ["LAR_ROOT", "HOME", "GIT_CONFIG_GLOBAL"] as const;
type Key = (typeof KEYS)[number];

export interface Scratch {
  /** The test's scratch directory; `LAR_ROOT` points here. */
  readonly root: string;
  /** `HOME` for the test: its own scratch directory beside the root, so a listing of the root stays the test's own. */
  readonly home: string;
  /** The values the fixture put in place, and the prior values it restores. */
  readonly set: Readonly<Record<Key, string>>;
  readonly prior: Readonly<Record<Key, string | undefined>>;
  /** The root and home bindings an enclosing scratch held, given back at the close (scratches nest). */
  readonly outer: { readonly root: string; readonly home: string };
}

/** Thrown at the close when a test left an env key the fixture owns changed. */
export class ScratchEnvLeak extends Error {
  override readonly name = "ScratchEnvLeak";
  constructor(readonly key: Key, readonly expected: string, readonly found: string | undefined) {
    super(`a test left ${key} changed: the fixture set ${JSON.stringify(expected)} and the close found ${JSON.stringify(found)}`);
  }
}

/** The current test's scratch root, moved per test by the fixture (a live binding: import it `as root`). */
export let scratchRoot = "";
/** The current test's scratch home. */
export let scratchHome = "";

/** Open a scratch: make the directory, set the env, keep the prior values. */
export function openScratch(prefix = "lares-scratch-"): Scratch {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const home = mkdtempSync(join(tmpdir(), `${prefix}home-`));
  const set: Record<Key, string> = { LAR_ROOT: root, HOME: home, GIT_CONFIG_GLOBAL: "/dev/null" };
  const prior = Object.fromEntries(KEYS.map((k) => [k, process.env[k]])) as Record<Key, string | undefined>;
  const outer = { root: scratchRoot, home: scratchHome };
  for (const k of KEYS) process.env[k] = set[k];
  scratchRoot = root;
  scratchHome = home;
  return { root, home, set, prior, outer };
}

/**
 * Close a scratch: read the env back, restore every prior value (a prior `undefined` deletes the key), remove the
 * directory, then refuse by name if any key had moved. Restore and removal run first, so a leak never outlives
 * its own report.
 */
export function closeScratch(scratch: Scratch): void {
  const leaks: ScratchEnvLeak[] = [];
  for (const k of KEYS) {
    if (process.env[k] !== scratch.set[k]) leaks.push(new ScratchEnvLeak(k, scratch.set[k], process.env[k]));
    const prior = scratch.prior[k];
    if (prior === undefined) delete process.env[k];
    else process.env[k] = prior;
  }
  rmSync(scratch.root, { recursive: true, force: true });
  rmSync(scratch.home, { recursive: true, force: true });
  scratchRoot = scratch.outer.root;
  scratchHome = scratch.outer.home;
  if (leaks[0]) throw leaks[0];
}

export const test = base.extend<{ scratch: Scratch }>({
  scratch: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const scratch = openScratch();
      try { await use(scratch); } finally { closeScratch(scratch); }
    },
    { auto: true },
  ],
});
export const it = test;
