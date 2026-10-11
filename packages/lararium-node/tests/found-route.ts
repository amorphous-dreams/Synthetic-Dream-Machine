/**
 * found-route — the ONE door every test founding passes through.
 *
 * A founding seals custody from birth and refuses without a human route, so a test that founds supplies one. The
 * route here is a fixed test passphrase; `foundDirect(opts)` reads as `runInit` itself (the direct opener holds the
 * store for the act) with that route filled in. A suite that proves the refusal passes `custody: { slots: [] }`.
 */
import type { SlotSpec } from "@lararium/mesh";
import { runInit, type InitOptions } from "../src/commands/init.js";
import { direct } from "./direct-store.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody } from "../src/custody-session.js";
import { larDataDir, larIdentityDir, larSealHome } from "../src/vessel-paths.js";

/** The fixed test passphrase. It guards nothing: every founding here lives under a scratch root. */
export const TEST_PASSPHRASE = "test-founding-passphrase";

/** One passphrase slot, threshold 1. */
export const TEST_SLOT: SlotSpec = { t: 1, pins: [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }] };

export const TEST_CUSTODY = { slots: [TEST_SLOT] } as const;

/** `runInit` over the direct holder, with the test route unless the suite names its own. */
export function foundDirect(opts: Omit<InitOptions, "repo" | "custody"> & { readonly custody?: InitOptions["custody"] }) {
  const run = direct(runInit);
  return run({ ...opts, custody: opts.custody ?? TEST_CUSTODY });
}

/**
 * Seal the custody of the CURRENT `LAR_ROOT` (call inside `withLarRoot`) with the test route, for a suite that mints a
 * vessel identity BEFORE its `runInit` (a joinee carries its key to the admitting vessel first). Custody founds before
 * the first identity file, so such a suite founds it here and `runInit` then finds the tree standing.
 */
export async function sealTestCustody(): Promise<void> {
  const homes = { identity: larIdentityDir(), storage: larDataDir(), seal: larSealHome() };
  await foundCustody({ io: new FsCustodyIo(homes), homes, slots: TEST_CUSTODY.slots });
}
