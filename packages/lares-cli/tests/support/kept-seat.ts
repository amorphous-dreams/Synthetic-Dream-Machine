/**
 * kept-seat — one keep pair, minted once per suite file under the published test route, planted into each case's fresh root.
 *
 * A keep seat's passphrase slot stretches at the remote cost and derives at custody's, and its mint proves itself by opening:
 * several seconds a case. A suite whose cases each cut a bundle plants this one seat instead (a house that already seated its
 * pair, as every unlocked house has), so a case spends only the opens its own restore asks for.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TEST_ROUTE_PASSPHRASE } from "../../src/offline-custody.js";

let kept: string | null = null;

/** Write the suite's one keep seat into `root`'s config home, minting it on the first call. */
export async function plantKeptSeat(root: string): Promise<void> {
  if (kept === null) {
    const prior = process.env["LAR_ROOT"];
    const mint = mkdtempSync(join(tmpdir(), "lar-kept-seat-"));
    try {
      process.env["LAR_ROOT"] = mint;
      const { keepSeatPath, seatKeepPair } = await import("../../src/keep-seat.js");
      await seatKeepPair([{ kind: "passphrase", passphrase: TEST_ROUTE_PASSPHRASE }], () => {}, true);
      kept = readFileSync(keepSeatPath(), "utf8");
    } finally {
      if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
      rmSync(mint, { recursive: true, force: true });
    }
  }
  mkdirSync(join(root, "config"), { recursive: true });
  writeFileSync(join(root, "config", "keep-seat.json"), kept, { mode: 0o600 });
}
