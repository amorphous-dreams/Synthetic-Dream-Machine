/**
 * bulb — the corm-and-rhizome BULB cap: the COAL, a cold-boot snapshot that carries its own next generation.
 *
 * The bulb = "seed-inside" (vessel-caps#/the-five-caps): the genesis oracle seed plus the engine and plugin CAS
 * bytes it names — the whole ALL-PUBLIC boot material a stranger needs to kindle their OWN sovereign hearth, and
 * nothing that names a house or a Nexus. THE SEED CID NAMES THE BULB: every byte beyond the seed derives from the
 * seed, so two houses holding one genesis hold one bulb under one CID. The other modified stems keep their own
 * organs — the charter epoch is the CORM's freshness lease, spent each cycle; a house's joining pointers ride the
 * STOLON (the invite). The bulb hands the FIRE (engine + genesis + grammar) — NEVER a key: the kindled hearth mints
 * its own sovereign self-certifying key from first breath (`kindleFromBulb`).
 *
 * ALL-PUBLIC → the PUBLIC FLOOR ONLY. The bulb rides the read-face (oracle-substrate) EXCLUSIVELY — NEVER the cad
 * carriage (Socket B). Routing a public artifact through the seal/keyring lane would collapse the OPEN path into
 * CLOSED (crypto-spine ledger #1: the cad seal ⊥ the ECDH box). Bulb ⊥ stolon: the bulb is the OPEN path (a stranger
 * births their own sovereign hearth); the stolon is the CLOSED path (invite a device into YOUR fleet).
 *
 * ONE SEED, ONE CID. The bulb CID is sha256 over the seed.json bytes AS PUBLISHED (`genesisSeedCid`), and the bulb
 * carries those exact bytes, never a re-serialization of the parsed seed. A herm's `/bulb/<cid>.bin` and a lararium
 * Pronaos's `/genesis/seed.json` therefore serve one byte string under one name, and a traveler who brings the stock
 * seed CID finds the same coal at either door.
 *
 * CONTENT-ADDRESSED. The puller fetches the seed by its CID, derives the CAS inventory from that verified seed, and
 * re-verifies `sha256(bytes) == cid` on every named blob before it trusts a byte. No second inventory artifact can
 * widen or narrow the fire.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/bulb
 */

import {
  genesisCasManifestFromSeed,
  sha256HexBytesSync,
  type GenesisSeed,
  type GenesisCasManifest,
} from "@lararium/mesh";
import { readGenesisSeedBytes, parseGenesisSeed, genesisSeedCid, genesisCasDir } from "./genesis-artifact.js";
import { readCasBlobFromFs } from "./node-cas.js";

/** The bulb — the genesis seed's published bytes and its exact seed-named CAS bytes. NO KEY, no house, no Nexus. */
export interface BulbArtifact {
  /** The seed.json bytes as published — the bulb CID names exactly these; the boot MATERIALIZES the oracle from
   *  the seed they parse to (`bulbSeed`). */
  readonly seedBytes:  Uint8Array;
  /** Every CAS-bound blob's {cid, bytes} (engine + plugins) — the FIRE bytes a fresh hearth boots on. */
  readonly casEntries: readonly { readonly cid: string; readonly bytes: Uint8Array }[];
}

/** One content-addressed bulb blob served by cid over the public floor. */
export interface BulbBlob { readonly cid: string; readonly bytes: Uint8Array; }

/** The plain-data genesis seed a bulb carries, parsed off its published bytes. Throws on bytes that are no seed. */
export function bulbSeed(bulb: Pick<BulbArtifact, "seedBytes">): GenesisSeed {
  const seed = parseGenesisSeed(bulb.seedBytes);
  if (!seed) throw new Error("[bulb] seed bytes are not a genesis seed");
  return seed;
}

/**
 * Content-address a bulb into its CID + the flat blob set the read-face serves by cid: the published seed bytes
 * under the bulb CID, then each seed-named CAS entry under its own. The inventory derives from the seed at this
 * boundary, so a caller cannot silently offer a partial or widened fire. NO signer, NO key — integrity rides the
 * content-address.
 */
export function buildBulb(a: BulbArtifact): { cid: string; blobs: BulbBlob[] } {
  const inventory = genesisCasManifestFromSeed(bulbSeed(a));
  const entries = exactCasEntries(inventory, a.casEntries, "build");
  const cid = genesisSeedCid(a.seedBytes);
  return { cid, blobs: [{ cid, bytes: a.seedBytes }, ...entries] };
}

function verified(cid: string, label: string, getBlob: (cid: string) => Uint8Array | null): Uint8Array {
  const bytes = getBlob(cid);
  if (!bytes) throw new Error(`[bulb] ${label} blob absent (cid ${cid})`);
  if (sha256HexBytesSync(bytes) !== cid) throw new Error(`[bulb] ${label} blob fails content-address (cid ${cid})`);
  return bytes;
}

/** Verify the bulb's seed under the bulb CID and derive its one authoritative logical CAS inventory. */
export function bulbSeedInventory(
  cid: string,
  getBlob: (cid: string) => Uint8Array | null,
): { readonly seedBytes: Uint8Array; readonly seed: GenesisSeed; readonly inventory: GenesisCasManifest } {
  const seedBytes = verified(cid, "seed", getBlob);
  const seed = parseGenesisSeed(seedBytes);
  if (!seed) throw new Error("[bulb] seed bytes are not a genesis seed");
  try { return { seedBytes, seed, inventory: genesisCasManifestFromSeed(seed) }; }
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
 * Re-assemble a bulb from its CID + a blob fetcher. The verified seed derives every required CAS CID; each byte
 * then re-verifies `sha256(bytes) == cid`. A tampered, absent, partial, or widened bulb throws. The one intake a
 * puller runs — content-address integrity, secret-free.
 */
export function assembleBulb(cid: string, getBlob: (cid: string) => Uint8Array | null): BulbArtifact {
  const { seedBytes, inventory } = bulbSeedInventory(cid, getBlob);
  const casEntries = exactCasEntries(
    inventory,
    inventory.blobs.map((blob) => ({ cid: blob.cid, bytes: verified(blob.cid, "cas", getBlob) })),
    "assembled",
  );
  return { seedBytes, casEntries };
}

/**
 * Read the bulb a Herm serves off its genesis dir: the seed.json bytes exactly as published, its derived logical CAS
 * inventory, and every genesis/cas/<cid> blob. Returns null when the genesis is absent/malformed (nothing to serve).
 */
export function readBulbArtifact(genesisDir: string): BulbArtifact | null {
  const seedBytes = readGenesisSeedBytes(genesisDir);
  if (!seedBytes) return null;
  let casManifest: GenesisCasManifest;
  try { casManifest = genesisCasManifestFromSeed(bulbSeed({ seedBytes })); } catch { return null; }
  const casDir = genesisCasDir(genesisDir);
  const casEntries = casManifest.blobs.map((b) => {
    const bytes = readCasBlobFromFs(b.cid, casDir);
    if (!bytes) throw new Error(`[bulb] genesis CAS blob absent for cid ${b.cid} — re-run build:genesis`);
    return { cid: b.cid, bytes };
  });
  return { seedBytes, casEntries };
}
