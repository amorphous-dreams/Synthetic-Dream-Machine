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
import type { TreeKey } from "@lararium/mesh";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody } from "../src/custody-session.js";
import { makeCustodyHolder, seatFaceAutoFounder, type CustodyHolder } from "../src/custody-holder.js";
import { seatCustody, unseatCustody } from "../src/custody-seat.js";
import { seatFaceRoute } from "../src/face-route.js";
import { vesselCustodyHomes, type CustodyHomes } from "../src/vault-carriers.js";
import { setMountedFace } from "../src/node-vessel-identity.js";

/** The synthetic route every fixture custody founds under. */
export const FIXTURE_PASSPHRASE = "fixture-custody-passphrase";

// A face founded under this fixture asks its own route; the fixture answers with the same synthetic passphrase.
seatFaceRoute(async () => [{ t: 1, pins: [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }] }]);
seatFaceAutoFounder(() => [{ t: 1, pins: [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }] }]);

export interface SeatedScratchCustody {
  readonly root:   string;
  readonly homes:  CustodyHomes;
  readonly io:     FsCustodyIo;
  readonly holder: CustodyHolder;
  /** A copy of the minted vessel key, for a test that builds a second holder over the same tree. */
  readonly treeKey:     TreeKey;
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
  await holder.adopt(founded.treeKey);
  seatCustody(holder);
  return {
    root, homes, io, holder, treeKey: founded.treeKey,
    async drop() {
      await holder.lock();
      unseatCustody(holder);
      if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
      rmSync(root, { recursive: true, force: true });
    },
  };
}

/** A scratch custody with its founding face standing unlocked for hosting's first write. */
export async function seatHostingCustody(label = "hosting"): Promise<SeatedScratchCustody> {
  const c = await seatScratchCustody(label);
  setMountedFace(undefined);
  await c.holder.foundFace({ ordinal: 0, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }] }] });
  return { ...c, async drop() { setMountedFace(undefined); await c.drop(); } };
}

/**
 * PIN THE OVERLAP OF TWO ACTS THAT RACE FOR ONE SEAL, by handshake and never by timing.
 *
 * Two acts that "start together" each read, decide and then seal a row under the one custody holder. Whether the
 * second READS before the first SEALS depends on the machine: on a slow runner the first may seal before the
 * second has read, and the second then lawfully stands as the next act. A vector that means to prove "the
 * overtaken act refuses" must hold that overlap itself.
 *
 * This gate wraps the seated holder's `updateRow` for the rows `match` names. The first act to ARRIVE at its seal
 * waits there until the second has arrived too: both have then finished their reads. The first then seals, and
 * the second seals only once the first has settled. No clock, no sleep, no retry: the two arrivals shake hands.
 * `release()` restores the holder. Which of the two arrives first stays the machine's own choice, so a vector
 * reads WHO won off the outcome and never off the order it started them in.
 */
export function holdSealsUntilBothArrive(holder: CustodyHolder, match: RegExp): { release(): void } {
  const real = holder.updateRow.bind(holder);
  let arrived = 0;
  let secondArrived!: () => void;
  const second = new Promise<void>((resolve) => { secondArrived = resolve; });
  let firstSettled!: () => void;
  const first = new Promise<void>((resolve) => { firstSettled = resolve; });
  (holder as { updateRow: CustodyHolder["updateRow"] }).updateRow = (async (home, file, decide) => {
    if (!match.test(file)) return real(home, file, decide);
    arrived += 1;
    if (arrived === 1) {
      await second;
      try { return await real(home, file, decide); } finally { firstSettled(); }
    }
    if (arrived === 2) {
      secondArrived();
      await first;
    }
    return real(home, file, decide);
  }) as CustodyHolder["updateRow"];
  return { release() { (holder as { updateRow: CustodyHolder["updateRow"] }).updateRow = real as CustodyHolder["updateRow"]; } };
}
