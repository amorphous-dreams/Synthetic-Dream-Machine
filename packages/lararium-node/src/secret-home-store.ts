/**
 * secret-home-store — where a node vessel keeps its SECRET home's address: one hot row under the S key.
 *
 * THE ADDRESS RESTS IN CUSTODY, NEVER IN THE BOOTSTRAP. The secret home's address is its document id and the held key its
 * rest seals it under (`@lararium/mesh` `secret-home`). Both rest together in one sealed row of the identity home
 * (`secret-home.json`, custody `hot`, K15 class S), and nowhere else:
 *   · the bootstrap rests plaintext and reads before any key opens; its oracle rows name the planes the boot mounts, so
 *     an address written there would hand a reader with no key a mount target, and the plane reader a bag to compose;
 *   · the key is worthless apart from the id and the id apart from the key, and a re-founding clears `hearth/` whole,
 *     which takes the row, the bootstrap and the document's rest together: nothing outlives the others.
 *   · the row never leaves its vessel (bundle `stays`): each vessel holds its own dyad, its own device's group-secret seal
 *     and the cap events it ingested, and a fleet-join carries what a joinee needs on its own payload.
 *
 * ORDER (placement-over-patterns, the founding order): the custody seats first; the home enrolls on the Repo's bound
 * rest, and its first byte rests sealed; the row lands after the document flushed, so it never names a document no rest
 * holds; only then does any seal, dyad or cap event write. A founding that stops between the flush and the row leaves an
 * orphan the next founding never names, sealed under a key no row keeps.
 */
import { mkdirSync } from "node:fs";
import type { Repo } from "@automerge/automerge-repo";
import {
  bytesEqual, decodeSecretHomeAddress, encodeSecretHomeAddress, enrollSecretHome, mintSecretHomeAddress, openSecretHome,
  SecretHomeUnavailable, type SecretHome, type SecretHomeAddress,
} from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { readCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { larIdentityDir } from "./vessel-paths.js";

/** The row the vessel's secret home's address rests in. */
export const SECRET_HOME_FILE = "secret-home.json";

/** The address this vessel's custody keeps, or null where no home enrolled. A read never mints. */
export async function readSecretHomeAddress(): Promise<SecretHomeAddress | null> {
  const bytes = await readCustodyRow("identity", SECRET_HOME_FILE);
  if (bytes === null) return null;
  try {
    const address = decodeSecretHomeAddress(bytes);
    if (address === null) throw new CustodyRowUnavailable("identity", SECRET_HOME_FILE, "malformed");
    return address;
  } finally { bytes.fill(0); }
}

/** Keep an enrolled home's address: nothing standing takes it, the same address again changes nothing, another refuses. */
async function keepSecretHomeAddress(address: SecretHomeAddress): Promise<void> {
  const bytes = encodeSecretHomeAddress(address);
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  await updateCustodyRow("identity", SECRET_HOME_FILE, (standing) => {
    if (standing === null) return { plaintext: bytes, value: undefined };
    if (!bytesEqual(standing, bytes)) throw new CustodyRowUnavailable("identity", SECRET_HOME_FILE, "names-another-key");
    return { plaintext: null, value: undefined };
  });
}

/** Open the home this vessel's custody names. A vessel whose custody names none refuses by name: it never mints here. */
export async function openVesselSecretHome(repo: Repo): Promise<SecretHome> {
  const address = await readSecretHomeAddress();
  if (address === null) throw new SecretHomeUnavailable("this vessel's custody names no secret home; found the place first");
  return openSecretHome(repo, address);
}

/**
 * STAND the vessel's secret home on `repo`: open the one its custody names, or enroll a fresh one where none stands. The
 * enrollment maps the document on the Repo's bound rest before its first byte, flushes it sealed, and only then keeps the
 * address. The custody must stand open: the row seals under the S key, so a locked vessel refuses `CustodyLocked` first.
 */
export async function standVesselSecretHome(repo: Repo): Promise<SecretHome> {
  const standing = await readSecretHomeAddress();
  if (standing !== null) return openSecretHome(repo, standing);
  const address = mintSecretHomeAddress();
  const home = await enrollSecretHome(repo, address);
  await repo.flush([home.handle.documentId]);
  await keepSecretHomeAddress(address);
  return home;
}
