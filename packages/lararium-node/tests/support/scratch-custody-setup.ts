/**
 * scratch-custody-setup — the node suites' custody, seated when a row first needs it (a vitest setup file).
 *
 * A vessel's private rows rest sealed under its vessel key, and a vessel key mints only inside a held custody. A
 * suite that drives a node function in its own process stands where a `lares` command stands with no vessel
 * running: the command seats a holder for its act and opens it at the first sealed row (`offline-custody`, on a
 * terminal). A suite holds no terminal, so this file names the same when-needed seat with a scratch route: at the
 * first sealed row under a root, it founds that root's custody under a synthetic passphrase, or opens the custody
 * a fixture already founded there under that same passphrase.
 *
 * ── SCRATCH ROOTS ALONE ─────────────────────────────────────────────────────────────────────────
 * The opener refuses unless all three custody homes (identity, storage, seal) resolve under the operating system's
 * temp directory, so no suite ever founds or opens a custody in a home a person keeps. The passphrases guard
 * nothing: a tree a suite founded here answers the first, and a root a harness tool staged
 * (`tools/seed-test-custody.mjs`) answers the published test route.
 *
 * A suite that proves the FLOOR seats its own holder and locks it (`custody-seat-fixture`), or clears every seat
 * with `seatCustody(null)`; an explicit seat for a home always answers ahead of this one.
 */
import { mkdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { beforeEach } from "vitest";
import { FsCustodyIo } from "../../src/custody-io.js";
import { custodyTreeStands, foundCustody } from "../../src/custody-session.js";
import { makeCustodyHolder, seatFaceAutoFounder, type CustodyHolder } from "../../src/custody-holder.js";
import { seatCustodyWhenNeeded } from "../../src/custody-seat.js";
import { vesselCustodyHomes } from "../../src/vault-carriers.js";

// The suites read no person's git config: the vessel's display name reads the global user.name, and a person's own
// config would move what a suite sees. The null device gives every suite, and every child it spawns, the same empty
// global.
process.env.GIT_CONFIG_GLOBAL = "/dev/null";

/** The synthetic route (the seat fixture founds under the same string, so either opens the other's tree). */
export const SCRATCH_PASSPHRASE = "fixture-custody-passphrase";
/** The published test route a harness tool binds a staged root to (`tools/test-custody-route.mjs` spells it). */
const STAGED_ROUTE_PASSPHRASE = "test-founding-passphrase";

// A write to a face the floor index does not name founds that face under the scratch route, in every suite: the product
// founds each face by its own act and seats no such policy.
seatFaceAutoFounder(() => [{ t: 1, pins: [{ kind: "passphrase", passphrase: SCRATCH_PASSPHRASE }] }]);

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

export async function openScratch(holder: CustodyHolder): Promise<void> {
  const { identity, storage, seal } = holder.homes;
  if (![identity, storage, seal].every(underTemp)) {
    throw new ScratchCustodyRefused(
      `a suite reached a sealed row whose custody homes stand at ${identity}, ${storage} and ${seal}: the scratch custody founds and opens only under ${tmpdir()}`,
    );
  }
  const io = new FsCustodyIo(holder.homes);
  const slots = [{ t: 1, pins: [{ kind: "passphrase" as const, passphrase: SCRATCH_PASSPHRASE }] }];
  if (!(await custodyTreeStands(io, holder.homes))) {
    mkdirSync(holder.homes.identity, { recursive: true, mode: 0o700 });
    const founded = await foundCustody({ io, homes: holder.homes, slots });
    await holder.adopt(founded.treeKey);
    founded.treeKey.fill(0);
    return;
  }
  const u = await holder.unlock([
    { kind: "passphrase", passphrase: SCRATCH_PASSPHRASE },
    { kind: "passphrase", passphrase: STAGED_ROUTE_PASSPHRASE },
  ]);
  if (u.reading !== "opens" && u.reading !== "already-unlocked") {
    throw new ScratchCustodyRefused(`the custody standing at ${identity} reads ${u.reading} under the scratch routes`);
  }
  // The scratch routes try every face tree too (`--all`): a face they do not fit stays shut.
  await holder.unlockFaces([
    { kind: "passphrase", passphrase: SCRATCH_PASSPHRASE },
    { kind: "passphrase", passphrase: STAGED_ROUTE_PASSPHRASE },
  ]);
}

function arm(): void {
  seatCustodyWhenNeeded(() => {
    const homes = vesselCustodyHomes();
    return makeCustodyHolder({ io: new FsCustodyIo(homes), homes });
  }, openScratch);
}

arm();
beforeEach(arm);
