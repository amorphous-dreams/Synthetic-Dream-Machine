/**
 * scratch-custody-setup — the CLI suites' custody, seated when a row first needs it (a vitest setup file).
 *
 * A `lares` command that acts with no vessel standing seats a holder for its own act and opens it at the first
 * sealed row, on a terminal (`offline-custody`, armed by the binary's entry). A suite calls a command's handler
 * with no binary entry and no terminal, so this file names the same when-needed seat with the suites' founding
 * route (`found-route`): at the first sealed row under a root it opens the custody a test founding sealed there,
 * or founds one when the suite reached a sealed row before any founding.
 * The harness also explicitly seats cold-card read-back here for each test. Refusal controls clear that seat
 * in their own scope; production loads no test setup and seats no stand-in.
 *
 * ── SCRATCH ROOTS ALONE ─────────────────────────────────────────────────────────────────────────
 * The opener refuses unless all three custody homes (identity, storage, seal) resolve under the operating system's
 * temp directory, so no suite ever founds or opens a custody in a home a person keeps. The passphrase guards nothing.
 *
 * A suite that seats its own holder (`scratch-custody`) answers ahead of this seat for that home, and
 * `seatCustody(null)` clears it for a suite that proves a command with no seat at all.
 */
import { mkdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { afterEach, beforeEach } from "vitest";
import {
  FsCustodyIo, custodyTreeStands, foundCustody, makeCustodyHolder, seatCustodyWhenNeeded, seatReadBackStandIn, seatWardGatherer, vesselCustodyHomes,
  type CustodyHolder,
} from "@lararium/node";
import { seatFaceAutoFounder } from "@lararium/node/testing";
import { TEST_PASSPHRASE } from "./found-route.js";

/**
 * OPT IN, PER SUITE: seat a "person" who answers a ward act with the routes the suite's faces are founded under
 * (seat-harness#/the-ward). No suite has one unless it asks, so a command that forgets to carry its ward reads RED.
 */
export function seatSuiteWard(): void {
  seatWardGatherer(async () => [TEST_PASSPHRASE, "fixture-custody-passphrase"].map((passphrase) => ({ kind: "passphrase" as const, passphrase })));
}

// A write to a face the floor index does not name founds that face under the scratch route (the product seats no such policy).
seatFaceAutoFounder(() => [{ t: 1, pins: [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }] }]);

/** Thrown when a suite reaches a sealed row outside a scratch root. */
export class ScratchCustodyRefused extends Error {
  override readonly name = "ScratchCustodyRefused";
}

/**
 * Whether `dir` resolves under the temp directory once every link on its path resolves. A home that does not stand
 * yet resolves through its nearest standing parent, so a link above it that points out of temp reads as outside.
 */
function underTemp(dir: string): boolean {
  const real = (p: string): string => {
    let at = resolve(p);
    const rest: string[] = [];
    for (;;) {
      try { return rest.length ? join(realpathSync(at), ...rest) : realpathSync(at); } catch { /* not standing: climb */ }
      const parent = dirname(at);
      if (parent === at) return resolve(p);
      rest.unshift(basename(at));
      at = parent;
    }
  };
  const temp = real(tmpdir());
  const at = real(dir);
  return at !== temp && at.startsWith(temp + sep);
}

async function openScratch(holder: CustodyHolder): Promise<void> {
  const { identity, storage, seal } = holder.homes;
  if (![identity, storage, seal].every(underTemp)) {
    throw new ScratchCustodyRefused(
      `a suite reached a sealed row whose custody homes stand at ${identity}, ${storage} and ${seal}: the scratch custody founds and opens only under ${tmpdir()}`,
    );
  }
  const io = new FsCustodyIo(holder.homes);
  if (!(await custodyTreeStands(io, holder.homes))) {
    mkdirSync(holder.homes.identity, { recursive: true, mode: 0o700 });
    const founded = await foundCustody({ io, homes: holder.homes, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }] }] });
    await holder.adopt(founded.treeKey);
    founded.treeKey.fill(0);
    return;
  }
  const u = await holder.unlock([{ kind: "passphrase", passphrase: TEST_PASSPHRASE }]);
  if (u.reading !== "opens" && u.reading !== "already-unlocked") {
    throw new ScratchCustodyRefused(`the custody standing at ${identity} reads ${u.reading} under the suites' founding route`);
  }
  await holder.unlockFaces([{ kind: "passphrase", passphrase: TEST_PASSPHRASE }]);   // the route tries every face tree too (`--all`)
}

function arm(): void {
  // This test harness explicitly answers card read-back in the CLI process. A scratch marker or a custody
  // passphrase grants no waiver. Refusal controls (D3, R4, readback-process-seat) clear this seat themselves.
  seatReadBackStandIn(true);
  seatCustodyWhenNeeded(() => {
    const homes = vesselCustodyHomes();
    return makeCustodyHolder({ io: new FsCustodyIo(homes), homes });
  }, openScratch);
}

arm();
beforeEach(arm);
afterEach(() => { seatReadBackStandIn(false); });
