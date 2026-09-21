/**
 * bulb — the corm-and-rhizome BULB cap: a HELD cold-boot snapshot that carries its own next generation.
 *
 * The bulb = "seed-inside" (vessel-caps): the whole ALL-PUBLIC boot material a stranger needs to kindle their OWN
 * sovereign hearth — the genesis oracle seed, the engine + plugin CAS bytes, the social bootstrap pointers, PINNED
 * to a charter chain-head epoch. A Herm HOLDS it and serves it FROZEN offline / self-refreshed online (the oracle-
 * substrate corm-lease). It hands the FIRE (engine + genesis + grammar) — NEVER a key: the kindled hearth mints its
 * own sovereign self-certifying key from first breath (`kindleFromBulb`), so carry ⊥ read holds (the bulb carries
 * public boot material; the new hearth's keys never touch the Herm).
 *
 * ALL-PUBLIC → the PUBLIC FLOOR ONLY. The bulb rides the read-face (oracle-substrate) EXCLUSIVELY — NEVER the cad
 * carriage (Socket B). Routing a public artifact through the seal/keyring lane would collapse the OPEN path into
 * CLOSED (crypto-spine ledger #1: the cad seal ⊥ the ECDH box). Bulb ⊥ stolon: the bulb is the OPEN path (a stranger
 * births their own sovereign hearth); the stolon is the CLOSED path (invite a device into YOUR fleet).
 *
 * CONTENT-ADDRESSED. Every piece (seed, bootstrap, each engine/plugin blob) is named by its own sha256. The
 * puller derives the CAS inventory from the verified immutable seed, then re-verifies `sha256(bytes) == cid` on
 * every named blob before it trusts a byte. The serve stays a HINT-free content-address; no second inventory
 * artifact can widen or narrow the fire (the pointer adds freshness).
 *
 * Meme: lar:///ha.ka.ba/lararium/node/bulb
 */

import { readFileSync } from "node:fs";
import {
  genesisCasManifestFromSeed,
  sha256HexBytesSync,
  utf8Bytes,
  type GenesisSeed,
  type GenesisCasManifest,
} from "@lararium/mesh";
import { readGenesisSeed, readGenesisCasManifest, genesisCasDir } from "./genesis-artifact.js";
import { readCasBlobFromFs } from "./node-cas.js";

/** The bulb-manifest format tag — a puller refuses an unknown one (fail-closed). */
export const BULB_MANIFEST_FORMAT = "lararium-bulb-manifest/v1" as const;

/** The held cold-boot snapshot — genesis seed + CAS + bootstrap, PINNED to a charter chain-head epoch. NO KEY. */
export interface BulbArtifact {
  /** The plain-data oracle genesis seed — the boot MATERIALIZES the oracle CRDT fresh from it. */
  readonly seed:            GenesisSeed;
  /** Every CAS-bound blob's {cid, bytes} (engine + plugins) — the FIRE bytes a fresh hearth boots on. */
  readonly casEntries:      readonly { readonly cid: string; readonly bytes: Uint8Array }[];
  /** The ALL-PUBLIC social bootstrap pointers (identities/circles/sessions/daemon/persona doc urls). */
  readonly bootstrap:       Record<string, unknown>;
  /** The charter chain-head epoch this bulb is EPOCH-PINNED to (null when the charter is unseated). */
  readonly sealEpochCid: string | null;
}

/** One content-addressed bulb blob served by cid over the public floor. */
export interface BulbBlob { readonly cid: string; readonly bytes: Uint8Array; }

/** The bulb manifest — enough to fetch and verify the seed, which then names every fire byte. */
export interface BulbManifest {
  readonly format:          typeof BULB_MANIFEST_FORMAT;
  readonly seedCid:         string;              // sha256(JSON(seed))
  readonly bootstrapCid:    string;              // sha256(JSON(bootstrap))
  readonly sealEpochCid: string | null;       // the epoch-PIN (charter chain-head)
}

const jsonBytes = (v: unknown): Uint8Array => utf8Bytes(JSON.stringify(v));

/**
 * Content-address a bulb into a manifest + the flat blob set the read-face serves by cid. The seed and bootstrap
 * get sha256 CIDs; the CAS entries carry their own. The inventory derives from the seed at this boundary, so a
 * caller cannot silently offer a partial or widened fire. NO signer, NO key — a bulb is public boot material;
 * integrity rides the content-address, freshness rides the pointer above.
 */
export function buildBulb(a: BulbArtifact): { manifest: BulbManifest; blobs: BulbBlob[] } {
  const inventory = genesisCasManifestFromSeed(a.seed);
  const entries = exactCasEntries(inventory, a.casEntries, "build");
  const seedBytes        = jsonBytes(a.seed);
  const bootstrapBytes   = jsonBytes(a.bootstrap);
  const seedCid          = sha256HexBytesSync(seedBytes);
  const bootstrapCid     = sha256HexBytesSync(bootstrapBytes);
  const manifest: BulbManifest = {
    format: BULB_MANIFEST_FORMAT,
    seedCid, bootstrapCid,
    sealEpochCid: a.sealEpochCid,
  };
  const blobs: BulbBlob[] = [
    { cid: seedCid,        bytes: seedBytes },
    { cid: bootstrapCid,   bytes: bootstrapBytes },
    ...entries,
  ];
  return { manifest, blobs };
}

function verified(cid: string, label: string, getBlob: (cid: string) => Uint8Array | null): Uint8Array {
  const bytes = getBlob(cid);
  if (!bytes) throw new Error(`[bulb] ${label} blob absent (cid ${cid})`);
  if (sha256HexBytesSync(bytes) !== cid) throw new Error(`[bulb] ${label} blob fails content-address (cid ${cid})`);
  return bytes;
}

/** Verify the bulb's root seed and derive its one authoritative logical CAS inventory. */
export function bulbSeedInventory(
  manifest: BulbManifest,
  getBlob: (cid: string) => Uint8Array | null,
): { readonly seed: GenesisSeed; readonly inventory: GenesisCasManifest } {
  if (manifest.format !== BULB_MANIFEST_FORMAT) {
    throw new Error(`[bulb] unknown manifest format ${String(manifest.format)} — refusing`);
  }
  let seed: GenesisSeed;
  try { seed = JSON.parse(new TextDecoder().decode(verified(manifest.seedCid, "seed", getBlob))) as GenesisSeed; }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("[bulb]")) throw error;
    throw new Error(`[bulb] seed is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  try { return { seed, inventory: genesisCasManifestFromSeed(seed) }; }
  catch (error) { throw new Error(`[bulb] seed-derived CAS inventory refuses: ${error instanceof Error ? error.message : String(error)}`); }
}

function exactCasEntries(
  inventory: GenesisCasManifest,
  entries: readonly { readonly cid: string; readonly bytes: Uint8Array }[],
  label: string,
): BulbBlob[] {
  const byCid = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (byCid.has(entry.cid)) throw new Error(`[bulb] ${label} has duplicate CAS cid ${entry.cid}`);
    if (sha256HexBytesSync(entry.bytes) !== entry.cid) {
      throw new Error(`[bulb] ${label} CAS bytes fail content-address (cid ${entry.cid})`);
    }
    byCid.set(entry.cid, entry.bytes);
  }
  const expected = inventory.blobs.map((blob) => blob.cid);
  if (byCid.size !== expected.length || expected.some((cid) => !byCid.has(cid))) {
    throw new Error(`[bulb] ${label} CAS entries differ from the seed-derived inventory`);
  }
  return expected.map((cid) => ({ cid, bytes: byCid.get(cid)! }));
}

/**
 * Re-assemble a bulb from its manifest + a blob fetcher. The verified seed derives every required CAS CID; each
 * byte then re-verifies `sha256(bytes) == cid`. A tampered, absent, partial, or widened bulb throws. The one
 * intake a puller runs — content-address integrity, secret-free.
 */
export function assembleBulb(manifest: BulbManifest, getBlob: (cid: string) => Uint8Array | null): BulbArtifact {
  const { seed, inventory } = bulbSeedInventory(manifest, getBlob);
  let bootstrap: Record<string, unknown>;
  try { bootstrap = JSON.parse(new TextDecoder().decode(verified(manifest.bootstrapCid, "bootstrap", getBlob))) as Record<string, unknown>; }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("[bulb]")) throw error;
    throw new Error(`[bulb] bootstrap is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const casEntries = exactCasEntries(
    inventory,
    inventory.blobs.map((blob) => ({ cid: blob.cid, bytes: verified(blob.cid, "cas", getBlob) })),
    "assembled",
  );
  return { seed, casEntries, bootstrap, sealEpochCid: manifest.sealEpochCid };
}

/**
 * Read a bulb from TWO SITED INPUTS — the HELD snapshot a Herm serves. The seed rides `genesisDir`; the
 * social bootstrap rides `bootstrapPath`, NAMED rather than reached for, because the two live in
 * different homes now (a shared seed, a per-vessel address book) and a function that names one target
 * while resolving the other from ambient state is the shape every confused-deputy bug wears. Reads the plain-data seed (seed.json),
 * its derived logical CAS inventory, every genesis/cas/<cid> blob, and the vessel's social bootstrap,
 * PINNED to the passed charter chain-head epoch. Returns null when the genesis is absent/malformed (nothing to serve).
 */
export function readBulbArtifact(genesisDir: string, sealEpochCid: string | null, bootstrapPath: string): BulbArtifact | null {
  const seed        = readGenesisSeed(genesisDir);
  const casManifest = readGenesisCasManifest(genesisDir);
  if (!seed || !casManifest) return null;
  const casDir = genesisCasDir(genesisDir);
  const casEntries = casManifest.blobs.map((b) => {
    const bytes = readCasBlobFromFs(b.cid, casDir);
    if (!bytes) throw new Error(`[bulb] genesis CAS blob absent for cid ${b.cid} — re-run build:genesis`);
    return { cid: b.cid, bytes };
  });
  let bootstrap: Record<string, unknown> = {};
  try { bootstrap = JSON.parse(readFileSync(bootstrapPath, "utf8")) as Record<string, unknown>; }
  catch { bootstrap = {}; }   // a Herm with no seated social plane serves an empty bootstrap (a stranger seeds their own)
  return { seed, casEntries, bootstrap, sealEpochCid };
}
