/**
 * scratch-custody-setup — the CLI suites' custody, seated when a row first needs it (a vitest setup file).
 *
 * A `lares` command that acts with no vessel standing seats a holder for its own act and opens it at the first
 * sealed row, on a terminal (`offline-custody`, armed by the binary's entry). A suite calls a command's handler
 * with no binary entry and no terminal, so this file names the same when-needed seat with the suites' founding
 * route (`found-route`): at the first sealed row under a root it opens the custody a test founding sealed there,
 * or founds one when the suite reached a sealed row before any founding.
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
import { beforeEach } from "vitest";
import {
  FsCustodyIo, custodyTreeStands, foundCustody, makeCustodyHolder, seatCustodyWhenNeeded, vesselCustodyHomes,
  type CustodyHolder,
} from "@lararium/node";
import { TEST_PASSPHRASE } from "./found-route.js";

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
    await holder.adopt(founded.vk);
    founded.vk.fill(0);
    return;
  }
  const u = await holder.unlock([{ kind: "passphrase", passphrase: TEST_PASSPHRASE }]);
  if (u.reading !== "opens" && u.reading !== "already-unlocked") {
    throw new ScratchCustodyRefused(`the custody standing at ${identity} reads ${u.reading} under the suites' founding route`);
  }
}

function arm(): void {
  seatCustodyWhenNeeded(() => {
    const homes = vesselCustodyHomes();
    return makeCustodyHolder({ io: new FsCustodyIo(homes), homes });
  }, openScratch);
}

arm();
beforeEach(arm);
