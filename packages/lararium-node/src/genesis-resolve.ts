/**
 * genesis-resolve -- the ONE resolver that names the genesis dir (seed.json + cas/).
 *
 * The founding, the daemon and the CLI all call it, because the genesis manifest is the CAS sweep's protect set
 * (an empty set means delete): two readers resolving differently would let one sweep away a seed the other
 * never saw.
 *
 * ORDER. An explicit declaration (`--genesis`, `LAR_GENESIS`) wins and never falls back; so does a configured
 * one (`config.resources.genesis`). Otherwise `<corpus>/genesis` when it holds a `seed.json` (a torn one stays
 * the root's to refuse; it never falls back). Otherwise the SHIPPED genesis of the build (`<repo>/genesis`),
 * read in place and never written, when it holds a seed. Otherwise the root path, failing as it always did.
 *
 * THE PIN. A vessel founded on the shipped seed records the seed CID it used (`genesis-pin.json` beside the
 * store). The oracle island reloads from the store at boot and never compares the seed, so a boot on a build
 * whose shipped seed differs stood silent; the pin makes it refuse by name. A vessel founded on a root-held or
 * declared seed pins nothing and keeps the behaviour it always had. The cure for a refusal is a re-found, or
 * pointing `LAR_GENESIS` at the pinned seed.
 *
 * This file imports no other genesis module: `lares-config` calls it, and `genesis-artifact` calls `lares-config`.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type GenesisSource = "explicit" | "configured" | "root" | "shipped";

export interface GenesisResolution {
  readonly dir: string;
  readonly source: GenesisSource;
}

export interface GenesisResolveInputs {
  readonly explicit?: string | undefined;
  readonly configured?: string | undefined;
  readonly corpusRoot: string;
  readonly shippedRoot: string;
}

const holdsSeed = (dir: string): boolean => existsSync(join(dir, "seed.json"));

export function resolveGenesis(inputs: GenesisResolveInputs): GenesisResolution {
  if (inputs.explicit !== undefined && inputs.explicit !== "") return { dir: inputs.explicit, source: "explicit" };
  if (inputs.configured !== undefined && inputs.configured !== "") return { dir: inputs.configured, source: "configured" };
  const rootDir = join(inputs.corpusRoot, "genesis");
  if (holdsSeed(rootDir)) return { dir: rootDir, source: "root" };
  const shippedDir = join(inputs.shippedRoot, "genesis");
  if (holdsSeed(shippedDir)) return { dir: shippedDir, source: "shipped" };
  return { dir: rootDir, source: "root" };
}

/** The seed CID as published: sha256 over the seed.json bytes, or null when no seed file reads. */
function seedCidAt(dir: string): string | null {
  try { return createHash("sha256").update(readFileSync(join(dir, "seed.json"))).digest("hex"); }
  catch { return null; }
}

const PIN_FILE = "genesis-pin.json";

/** Record the seed CID a SHIPPED-seed founding used. Any other source pins nothing, and clears an earlier pin. */
export function pinGenesisSeed(storageDir: string, resolution: GenesisResolution): void {
  rmSync(join(storageDir, PIN_FILE), { force: true });
  if (resolution.source !== "shipped") return;
  const seedCid = seedCidAt(resolution.dir);
  if (seedCid === null) return;
  writeFileSync(join(storageDir, PIN_FILE), JSON.stringify({ seedCid, dir: resolution.dir, source: resolution.source }, null, 2) + "\n");
}

/** Refuse by name a boot whose resolved seed differs from the seed the vessel was founded on. No pin passes. */
export function checkGenesisPin(storageDir: string, resolution: GenesisResolution): void {
  const path = join(storageDir, PIN_FILE);
  if (!existsSync(path)) return;
  let pin: { seedCid?: unknown; dir?: unknown };
  try { pin = JSON.parse(readFileSync(path, "utf8")) as typeof pin; }
  catch { throw new Error(`[genesis seed] ${path} does not read; this vessel's founding seed is unknown — re-found it, or restore the file`); }
  if (typeof pin.seedCid !== "string") throw new Error(`[genesis seed] ${path} names no seed CID — re-found the vessel, or restore the file`);
  const resolved = seedCidAt(resolution.dir);
  if (resolved === pin.seedCid) return;
  throw new Error(
    `[genesis seed] this vessel was founded on genesis seed ${pin.seedCid} (${String(pin.dir)}); this boot resolves ` +
    `${resolved ?? "no readable seed"} (${resolution.dir}, ${resolution.source}). Point LAR_GENESIS at the pinned seed, or re-found the vessel.`,
  );
}

/** The line a founding prints: which genesis dir and which seed CID it used. */
export function genesisFoundingLine(resolution: GenesisResolution): string {
  return `genesis: ${resolution.source} seed ${seedCidAt(resolution.dir) ?? "unreadable"} at ${resolution.dir}`;
}

/**
 * The resolution a founding at `genesisDir` stands on: the environment's own when it names that dir (so a
 * shipped-seed founding knows its source), else an explicit one.
 */
export function genesisResolutionAt(genesisDir: string, inputs: GenesisResolveInputs): GenesisResolution {
  const own = resolveGenesis(inputs);
  return resolve(own.dir) === resolve(genesisDir) ? own : { dir: genesisDir, source: "explicit" };
}
