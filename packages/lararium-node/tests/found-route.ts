/**
 * found-route — the ONE door every test founding passes through.
 *
 * A founding seals custody from birth and refuses without a human route, so a test that founds supplies one. The
 * route here is a fixed test passphrase; `foundDirect(opts)` reads as `runInit` itself (the direct opener holds the
 * store for the act) with that route filled in. A suite that proves the refusal passes `custody: { slots: [] }`.
 */
import type { SlotSpec } from "@lararium/mesh";
import { runInit, type InitOptions } from "../src/commands/init.js";
import { foundSeedCharter, runFoundHearth, type FoundHearthOptions } from "../src/commands/found-hearth.js";
import { direct } from "./direct-store.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody } from "../src/custody-session.js";
import { makeCustodyHolder } from "../src/custody-holder.js";
import { seatCustody } from "../src/custody-seat.js";
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
  const io = new FsCustodyIo(homes);
  const founded = await foundCustody({ io, homes, slots: TEST_CUSTODY.slots });
  // The founding that follows writes rows sealed under this key, so the suite seats the holder that keeps it.
  const holder = makeCustodyHolder({ io, homes });
  await holder.adopt(founded.vk);
  seatCustody(holder);
}

/**
 * Seat an unlocked holder over the custody ALREADY standing at the current `LAR_ROOT`, by the test route: for a
 * suite that returns to a root some earlier act founded and reads or writes its sealed rows.
 */
export async function openTestCustody(): Promise<void> {
  const homes = { identity: larIdentityDir(), storage: larDataDir(), seal: larSealHome() };
  const holder = makeCustodyHolder({ io: new FsCustodyIo(homes), homes });
  const opened = await holder.unlock([{ kind: "passphrase", passphrase: TEST_PASSPHRASE }]);
  if (opened.reading !== "opens") throw new Error(`the test route did not open this root's custody: ${opened.reading}`);
  seatCustody(holder);
}

/**
 * THE STABLE FOUNDING ACT over the direct holder, with the test route and a read-back that confirms each card as a
 * person would at a terminal (the seeds zero-fill when the act returns). A suite that proves a refused read-back
 * passes its own `readBack`.
 */
export function foundHearthDirect(opts: Omit<FoundHearthOptions, "repo" | "custody" | "name" | "readBack"> & {
  readonly custody?: FoundHearthOptions["custody"];
  readonly name?: string;
  readonly readBack?: FoundHearthOptions["readBack"];
}) {
  const run = direct(runFoundHearth);
  return run({ ...opts, custody: opts.custody ?? TEST_CUSTODY, name: opts.name ?? "staged", readBack: opts.readBack ?? (async () => {}) });
}

/**
 * The seed charter alone, over a place some earlier act founded (custody seated): persona zero's root and seat
 * claim, the seat key, one card confirmed, the genesis at threshold one. A suite that founds faces by the face rite
 * runs this first, as the Stable founding act does before its face.
 */
export function seatSeedCharter(opts: { readonly name?: string; readonly chair?: string } = {}) {
  return foundSeedCharter({ name: opts.name ?? "staged", ...(opts.chair ? { chair: opts.chair } : {}), readBack: async () => {} });
}
