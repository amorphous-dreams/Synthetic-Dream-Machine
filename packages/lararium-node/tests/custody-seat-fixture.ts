/**
 * custody-seat-fixture — a founded, seated, UNLOCKED custody under a scratch root, for every test that reads or
 * writes a row sealed under the vessel key.
 *
 * `LAR_ROOT` names a fresh `mkdtemp` root for the fixture's life, so the identity, storage and seal homes resolve
 * under it and no write reaches a real identity home. The custody founds under a synthetic passphrase and the
 * holder adopts the minted key (one key derivation, at the founding). `drop()` locks, clears its own seat, restores the
 * environment and removes the root.
 */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { VesselKey } from "@lararium/mesh";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody } from "../src/custody-session.js";
import { makeCustodyHolder, type CustodyHolder } from "../src/custody-holder.js";
import { seatCustody, unseatCustody } from "../src/custody-seat.js";
import { vesselCustodyHomes, type CustodyHomes } from "../src/vault-carriers.js";

/** The synthetic route every fixture custody founds under. */
export const FIXTURE_PASSPHRASE = "fixture-custody-passphrase";

export interface SeatedScratchCustody {
  readonly root:   string;
  readonly homes:  CustodyHomes;
  readonly io:     FsCustodyIo;
  readonly holder: CustodyHolder;
  /** A copy of the minted vessel key, for a test that builds a second holder over the same tree. */
  readonly vk:     VesselKey;
  /** Lock, clear the seat, restore `LAR_ROOT`, remove the root. */
  drop(): Promise<void>;
}

/** Found custody under a fresh scratch `LAR_ROOT`, seat a holder over it and hand it back unlocked. */
export async function seatScratchCustody(label = "seat"): Promise<SeatedScratchCustody> {
  const root = mkdtempSync(join(tmpdir(), `lar-custody-${label}-`));
  const priorRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
  const homes = vesselCustodyHomes();
  mkdirSync(homes.identity, { recursive: true, mode: 0o700 });
  const io = new FsCustodyIo(homes);
  const founded = await foundCustody({ io, homes, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }] }] });
  const holder = makeCustodyHolder({ io, homes });
  await holder.adopt(founded.vk);
  seatCustody(holder);
  return {
    root, homes, io, holder, vk: founded.vk,
    async drop() {
      await holder.lock();
      unseatCustody(holder);
      if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
      rmSync(root, { recursive: true, force: true });
    },
  };
}
