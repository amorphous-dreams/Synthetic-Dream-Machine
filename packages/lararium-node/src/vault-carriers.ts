/**
 * vault-carriers — THE ONE ENUMERATION OF THE AT-REST SEAL LIFECYCLE'S CARRIERS.
 *
 * `archive-passphrase` composes the lifecycle gestures (seal · rotate · repair · status · export) over a
 * set of secret carriers; `key-class` censuses the identity dir and must say, per key, whether the
 * lifecycle HOLDS it at rest. Both need the same answer to "which files does the vault govern", and this
 * atom is that answer, stated ONCE.
 *
 * WHY IT LIVES APART FROM BOTH. Two derivations of one fact drift, and this fact drifts EXPENSIVELY in
 * both directions: a governed carrier the census omits gets skipped by a sweep that then reports success
 * over an unsealed secret; a carrier the census invents gets written over by a sweep no rotate owns,
 * destroying a leg of the recovery quorum. So the census does not re-spell the family — it asks here.
 *
 * THE DISK IS THE SOURCE, AND ON PURPOSE (the reasoning `deviceShareCarriers` carried, kept whole). The
 * fact the lifecycle governs is A FILE THAT EXISTS. The writer (`nodeRecoveryShareStore.save`) records no
 * roster of its own; the anchor and persona rosters record a DIFFERENT fact (which persona this vessel
 * anchors / holds a root for), read back as `[]` when torn, and can be restored while a share file is not;
 * and a handle COUNT derived from either would skip a gap in the numbering. A dir read cannot be out of
 * date with the disk it reads.
 *
 * The cost of reading the disk instead of a record: a stray file spelled like the family becomes a carrier.
 * That errs the safe way — governing a file that need not be governed refuses a write and names a split;
 * the other error DESTROYS a leg of the recovery quorum.
 *
 * EVERY LOCATION IS SPELLED BY ITS WRITER'S OWN PATH FUNCTION, never by rejoining a scanned string — one
 * spelling of a carrier location, so a writer that moves takes this enumeration with it.
 */

import { readdirSync } from "node:fs";
import { basename } from "node:path";
import { archivePath, veilArchivePath } from "./identity-anchors.js";
import { reserveMineSharePath } from "./seal-reserve-store.js";
import { deviceSharePath } from "./recovery-share-store.js";
import { larIdentityDir } from "./vessel-paths.js";

/**
 * A carrier's name. THREE ARE SINGLETONS AND ONE NAMES A FAMILY: a vessel wearing several personas splits
 * EACH persona-root independently, so the device share is written per handle-index
 * (`recovery-device-share-h${N}.bin`) and every index is its own carrier under this lifecycle. The name
 * carries the index for exactly the reason the filename does — h0's quorum leg and h1's are different
 * secrets, and a status, a rotate report or an export refusal that folded them would name neither.
 */
export type DeviceShareName = `device-share-h${number}`;
export type CarrierName = "archive" | "veil" | "reserve-share" | DeviceShareName;

export interface VaultCarrier {
  readonly name: CarrierName;
  readonly path: string;
}

/** The device-share filename law, read back: the family's spelling in `recovery-share-store`. */
export const DEVICE_SHARE_FILE = /^recovery-device-share-h(\d+)\.bin$/;

export function deviceShareName(handleIndex: number): DeviceShareName {
  return `device-share-h${handleIndex}`;
}

/** The three singleton carrier filenames, each named by the function that WRITES it. */
function singletonFiles(): ReadonlyMap<string, CarrierName> {
  return new Map<string, CarrierName>([
    [basename(archivePath()),          "archive"],
    [basename(veilArchivePath()),      "veil"],
    [basename(reserveMineSharePath()), "reserve-share"],
  ]);
}

/**
 * Every file in `identityDir` the at-rest seal lifecycle GOVERNS, mapped to the carrier it is. THE ONE
 * SCAN AND THE ONE MATCHER — `vaultCarriers` and the key census both read this, so neither can name a
 * carrier the other misses.
 *
 * An absent or unreadable dir governs nothing and faults nothing: no identity home yet means no carrier
 * stands. Null-as-default holds here because an empty map STATES a fact ("no governed file in this dir")
 * rather than losing one — the caller reads the dir's absence from the dir, not from this.
 */
export function vaultCarrierMap(identityDir: string): ReadonlyMap<string, CarrierName> {
  let entries: string[];
  try { entries = readdirSync(identityDir); } catch { return new Map(); }
  const singles = singletonFiles();
  const out = new Map<string, CarrierName>();
  for (const entry of entries) {
    const single = singles.get(entry);
    if (single) { out.set(entry, single); continue; }
    const m = DEVICE_SHARE_FILE.exec(entry);
    if (!m) continue;
    const index = Number(m[1]);
    if (!Number.isSafeInteger(index)) continue;
    out.set(entry, deviceShareName(index));
  }
  return out;
}

/** Just the governed filenames in `identityDir` — the set a custody question asks against. */
export function vaultCarrierFiles(identityDir: string): ReadonlySet<string> {
  return new Set(vaultCarrierMap(identityDir).keys());
}

/** Every device-share carrier STANDING ON DISK, ascending by handle-index. */
export function deviceShareCarriers(): readonly VaultCarrier[] {
  const indices: number[] = [];
  for (const file of vaultCarrierMap(larIdentityDir()).keys()) {
    const m = DEVICE_SHARE_FILE.exec(file);
    if (m) indices.push(Number(m[1]));
  }
  return indices.sort((a, b) => a - b)
    .map((index) => ({ name: deviceShareName(index), path: deviceSharePath(index) }));
}

/** The at-rest secret carriers, in a FIXED order (the rename sequence the ratify flow commits in). */
export function vaultCarriers(): readonly VaultCarrier[] {
  return [
    { name: "archive",       path: archivePath() },
    { name: "veil",          path: veilArchivePath() },
    ...deviceShareCarriers(),
    { name: "reserve-share", path: reserveMineSharePath() },
  ];
}
