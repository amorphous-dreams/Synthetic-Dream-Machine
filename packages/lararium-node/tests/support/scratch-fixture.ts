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
 * The lares-cli suites take this file too (one fixture for both packages; lares-cli already depends on this package,
 * so the import runs one way): they open and close a scratch by hand in their hooks, `openScratch({ home: false })`
 * where HOME stays the enclosing env's and `openScratch({ gitConfig: "private" })` where a test writes the global git
 * config. `kept-house.ts` allocates its kept copy through {@link scratchDirs}.
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

/** The env keys a scratch may own: set at open, read back and restored at close. */
const KEYS = ["LAR_ROOT", "HOME", "GIT_CONFIG_GLOBAL"] as const;
type Key = (typeof KEYS)[number];

export interface ScratchOptions {
  /** The `mkdtemp` prefix of the root; the home takes `${prefix}home-`. */
  readonly prefix?: string;
  /** Point `HOME` at the scratch home (the default). `false` leaves HOME to the enclosing env, unowned and unread. */
  readonly home?: boolean;
  /** The global git config: `"empty"` (the default) reads `/dev/null`; `"private"` names `.gitconfig` in the scratch home, unwritten. */
  readonly gitConfig?: "empty" | "private";
}

export interface Scratch {
  /** The test's scratch directory; `LAR_ROOT` points here. */
  readonly root: string;
  /** The scratch home beside the root (so a listing of the root stays the test's own); `HOME` points here unless the scratch leaves HOME unowned. */
  readonly home: string;
  /** The values the fixture put in place for the keys it owns, and the prior values it restores. */
  readonly set: Readonly<Partial<Record<Key, string>>>;
  readonly prior: Readonly<Partial<Record<Key, string | undefined>>>;
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

/** The one scratch allocation: a root and a home beside it under the temp dir, both or neither. */
export function scratchDirs(prefix: string): { readonly root: string; readonly home: string } {
  const root = mkdtempSync(join(tmpdir(), prefix));
  try {
    return { root, home: mkdtempSync(join(tmpdir(), `${prefix}home-`)) };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

/** Remove a scratch allocation (an empty name, never allocated, stays untouched). */
export function removeScratchDirs(dirs: { readonly root: string; readonly home: string }): void {
  for (const d of [dirs.root, dirs.home]) if (d) rmSync(d, { recursive: true, force: true });
}

const closed = new WeakSet<Scratch>();

/** Open a scratch: make the directories, set the env the scratch owns, keep the prior values. */
export function openScratch(options: string | ScratchOptions = {}): Scratch {
  const { prefix = "lares-scratch-", home: ownsHome = true, gitConfig = "empty" } = typeof options === "string" ? { prefix: options } : options;
  const { root, home } = scratchDirs(prefix);
  const set: Partial<Record<Key, string>> = {
    LAR_ROOT: root,
    ...(ownsHome ? { HOME: home } : {}),
    GIT_CONFIG_GLOBAL: gitConfig === "private" ? join(home, ".gitconfig") : "/dev/null",
  };
  const owned = KEYS.filter((k) => k in set);
  const prior = Object.fromEntries(owned.map((k) => [k, process.env[k]])) as Partial<Record<Key, string | undefined>>;
  const outer = { root: scratchRoot, home: scratchHome };
  for (const k of owned) process.env[k] = set[k];
  scratchRoot = root;
  if (ownsHome) scratchHome = home;
  return { root, home, set, prior, outer };
}

/**
 * Close a scratch: read the env back, restore every prior value the scratch owned (a prior `undefined` deletes the
 * key), remove the directories, then refuse by name if any owned key had moved. Restore and removal run first, so a
 * leak never outlives its own report. A second close of the same scratch reads as a no-op.
 */
export function closeScratch(scratch: Scratch): void {
  if (closed.has(scratch)) return;
  closed.add(scratch);
  const leaks: ScratchEnvLeak[] = [];
  for (const k of KEYS) {
    const expected = scratch.set[k];
    if (expected === undefined) continue;
    if (process.env[k] !== expected) leaks.push(new ScratchEnvLeak(k, expected, process.env[k]));
    const prior = scratch.prior[k];
    if (prior === undefined) delete process.env[k];
    else process.env[k] = prior;
  }
  removeScratchDirs(scratch);
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
