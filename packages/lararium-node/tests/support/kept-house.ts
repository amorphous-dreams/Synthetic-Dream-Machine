/**
 * kept-house — stand a suite's house ONCE per file and hand each case its own copy.
 *
 * A house founded per case (the vessel, a face, a charter, each face's hand there) runs a founding's worth of
 * passphrase derivations at the fixed scrypt cost inside every case's `beforeEach`, and a loaded runner runs that past
 * the 10 s hook default. `keepHouse` stands the house once in `beforeAll` under its own scratch, with the room the
 * config gives a founding (`testTimeout`), keeps a whole copy of the root and home beside the scratch roots, and
 * `into` copies that copy over a case's fresh root: each case reads its own acts and derives nothing in its hook.
 */
import { afterAll, beforeAll } from "vitest";
import { cpSync, lstatSync } from "node:fs";
import { closeScratch, openScratch, removeScratchDirs, scratchDirs } from "./scratch-fixture.js";

/** The founding budget the config gives a test (`testTimeout`), which the one standing takes. */
const FOUNDING_BUDGET = 30_000;

/** A socket a holder left behind carries a name, never state: nothing listens at a copy of it. */
const notSocket = (src: string): boolean => !lstatSync(src).isSocket();

export interface KeptHouse {
  /** Copy the kept house over a case's root (and its home, when the case stands one). */
  into(root: string, home?: string): void;
}

/** Register the file's `beforeAll` that stands the house through `stand`, and the `afterAll` that clears the copy. */
export function keepHouse(prefix: string, stand: () => Promise<void>): KeptHouse {
  let kept = { root: "", home: "" };
  beforeAll(async () => {
    const at = openScratch(`${prefix}house-`);
    try {
      await stand();
      kept = scratchDirs(`${prefix}kept-`);
      cpSync(at.root, kept.root, { recursive: true, filter: notSocket });
      cpSync(at.home, kept.home, { recursive: true, filter: notSocket });
    } finally { closeScratch(at); }
  }, FOUNDING_BUDGET);
  afterAll(() => removeScratchDirs(kept));
  return {
    into(root, home) {
      cpSync(kept.root, root, { recursive: true, filter: notSocket });
      if (home !== undefined) cpSync(kept.home, home, { recursive: true, filter: notSocket });
    },
  };
}
