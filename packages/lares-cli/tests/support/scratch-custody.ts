/**
 * scratch-custody — a founded, seated, UNLOCKED custody under the scratch `LAR_ROOT` a test already set, for a CLI
 * suite that runs a verb which reads or writes a row sealed under the vessel key without founding a vessel.
 *
 * Call it AFTER the test names its scratch `LAR_ROOT`: the homes resolve under that root, so no write reaches a
 * real identity home. The custody founds under the suite's fixed test passphrase (`found-route`) and the holder
 * adopts the minted key. `drop()` locks the holder and clears its seat; the test removes its own root.
 *
 * The root stands STAGED, as a harness stages one: it carries the scratch marker beside custody founded under the
 * published test route, so a rite's card read-back stands in there and nowhere else.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  FsCustodyIo, foundCustody, makeCustodyHolder, seatCustody, unseatCustody, vesselCustodyHomes,
  type CustodyHolder, type CustodyHomes,
} from "@lararium/node";
import { TEST_PASSPHRASE } from "./found-route.js";

export interface ScratchCustody {
  readonly homes:  CustodyHomes;
  readonly holder: CustodyHolder;
  /** Lock the holder and clear its seat. */
  drop(): Promise<void>;
}

export async function seatScratchCustody(): Promise<ScratchCustody> {
  if (!process.env["LAR_ROOT"]) throw new Error("seatScratchCustody: name a scratch LAR_ROOT first");
  const homes = vesselCustodyHomes();
  mkdirSync(homes.identity, { recursive: true, mode: 0o700 });
  const io = new FsCustodyIo(homes);
  const founded = await foundCustody({ io, homes, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }] }] });
  const holder = makeCustodyHolder({ io, homes });
  await holder.adopt(founded.vk);
  seatCustody(holder);
  writeFileSync(join(process.env["LAR_ROOT"]!, ".lar-test-scratch"), "");
  return { homes, holder, async drop() { await holder.lock(); unseatCustody(holder); } };
}
