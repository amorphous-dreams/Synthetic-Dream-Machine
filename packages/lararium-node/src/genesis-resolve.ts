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
 * THE SEED WITNESS. Every founding records the seed it used (`genesis-pin.json` beside the store): the seed CID and
 * the seed's ratchet digests (engine, grammar, plugins, floor), whatever the seed's source (shipped, root-held,
 * explicit as the image's is, or configured). The oracle island (the founding record) reloads from the store at
 * boot and never compares the seed; the witness lets the boot NAME a differing seed. D1 holds that seed as an
 * OFFER, never a refusal: the boot prints "a newer seed waits: engine same · grammar moved · ..." and serves the
 * founding record unchanged. Only a torn witness refuses, since then the founding seed reads as unknown.
 *
 * This file imports no other genesis module of this package: `lares-config` calls it, and `genesis-artifact`
 * calls `lares-config`. The ratchet fold comes from the mesh (`genesis-compare`), pure.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  compareGenesisDigests,
  foundingRecordDigests,
  ratchetWords,
  type GenesisDigests,
  type GenesisRecordLike,
} from "@lararium/mesh/genesis-compare";

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

const SEED_WITNESS_FILE = "genesis-pin.json";

const NO_DIGESTS: GenesisDigests = Object.freeze({ engine: null, grammar: null, lararium: null, plugins: null, floor: null });

/** The seed's ratchet digests, recomputed from its blobs (the mesh fold); every ratchet absent where no seed reads. */
function seedDigestsAt(dir: string): GenesisDigests {
  try { return foundingRecordDigests(JSON.parse(readFileSync(join(dir, "seed.json"), "utf8")) as GenesisRecordLike); }
  catch { return NO_DIGESTS; }
}

/** A witness's stored digests, each ratchet a string or absent. */
function witnessDigests(value: unknown): GenesisDigests {
  const v = (value !== null && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const at = (k: string): string | null => (typeof v[k] === "string" && (v[k] as string).length > 0 ? v[k] as string : null);
  return Object.freeze({ engine: at("engine"), grammar: at("grammar"), lararium: at("lararium"), plugins: at("plugins"), floor: at("floor") });
}

/** Record the seed witness a founding used, for EVERY seed source: the seed CID, where it stood, and its ratchet digests. */
export function pinGenesisSeed(storageDir: string, resolution: GenesisResolution): void {
  rmSync(join(storageDir, SEED_WITNESS_FILE), { force: true });
  const seedCid = seedCidAt(resolution.dir);
  if (seedCid === null) return;
  const witness = { seedCid, dir: resolution.dir, source: resolution.source, ratchets: seedDigestsAt(resolution.dir) };
  writeFileSync(join(storageDir, SEED_WITNESS_FILE), JSON.stringify(witness, null, 2) + "\n");
}

/**
 * Read back the line the boot prints about its seed: `witnessed <cid>` where this boot's seed matches the seed witness,
 * `unwitnessed` where no witness stands (the witness's crash window),
 * and `a newer seed waits: <ratchet words>` where the seed differs: the seed (offered) beside the seed witness, ratchet
 * by ratchet. A differing seed never refuses the boot; the founding record keeps serving, and nothing moves at boot.
 * Only a torn witness throws. The witness and the seed both sit on this host, so the compare reads SELF-CONSISTENCY.
 */
export function checkGenesisPin(storageDir: string, resolution: GenesisResolution): string {
  const path = join(storageDir, SEED_WITNESS_FILE);
  const resolved = seedCidAt(resolution.dir);
  if (!existsSync(path)) {
    return `[genesis seed] unwitnessed — no seed witness at ${path}; this boot serves seed ${resolved ?? "(unreadable)"} ` +
      `(${resolution.source} at ${resolution.dir}) and holds nothing to compare it against`;
  }
  let held: { seedCid?: unknown; dir?: unknown; ratchets?: unknown };
  try { held = JSON.parse(readFileSync(path, "utf8")) as typeof held; }
  catch { throw new Error(`[genesis seed] ${path} does not read; this vessel's founding seed is unknown — re-found it, or restore the file`); }
  if (typeof held.seedCid !== "string") throw new Error(`[genesis seed] ${path} names no seed CID — re-found the vessel, or restore the file`);
  if (resolved === held.seedCid) return `[genesis seed] witnessed ${held.seedCid} — this boot's seed matches the seed witness (self-consistency)`;
  const witness = `seed witness ${held.seedCid} (founded at ${String(held.dir)}; ${path})`;
  if (resolved === null) {
    return `[genesis seed] no seed reads at ${resolution.dir} (${resolution.source}) beside the ${witness}; ` +
      `the founding record keeps serving, and nothing moves at boot`;
  }
  const words = ratchetWords(compareGenesisDigests(witnessDigests(held.ratchets), seedDigestsAt(resolution.dir)));
  return `[genesis seed] a newer seed waits: ${words} — seed (offered) ${resolved} (${resolution.source} at ${resolution.dir}) ` +
    `beside the ${witness}; the founding record keeps serving, and nothing moves at boot`;
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
