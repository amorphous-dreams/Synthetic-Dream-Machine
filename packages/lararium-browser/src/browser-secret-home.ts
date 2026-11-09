/**
 * browser-secret-home — where a browser vessel keeps its SECRET home's address: one place-tree row, `secret-home`.
 *
 * The browser stands the same secret home the node stands (`@lararium/mesh` `secret-home`): one vessel-held document
 * where group-secret seals, dyads and Keyhive cap events rest, sealed under a held key on the vessel's own sealed rest
 * from its first byte. Its address (document id and held key) rests in one sealed row of this browser's keystore under
 * the place tree, never in the boot keys: those read before any key opens.
 *
 * ORDER: the place tree stands open; the home enrolls on the Repo's bound rest and its first byte rests sealed; the row
 * lands after the document flushed; only then does any seal, dyad or cap event write.
 */
import type { Repo } from "@automerge/automerge-repo";
import {
  decodeSecretHomeAddress, encodeSecretHomeAddress, enrollSecretHome, mintSecretHomeAddress, openSecretHome,
  SecretHomeUnavailable, type SecretHome,
} from "@lararium/mesh";
import { readKeystoreRow, withCustodyRows } from "./browser-custody.js";

/** The keystore row the browser's secret home's address rests in. */
export const SECRET_HOME_ROW = "secret-home";

/** Open the home this browser's keystore names; a browser that names none refuses by name, never mints. */
export async function openBrowserSecretHome(idbName: string, repo: Repo): Promise<SecretHome> {
  const held = await readKeystoreRow(idbName, SECRET_HOME_ROW);
  const address = held instanceof Uint8Array ? decodeSecretHomeAddress(held) : null;
  if (address === null) throw new SecretHomeUnavailable("this browser's keystore names no secret home");
  return openSecretHome(repo, address);
}

/** Stand the browser's secret home: open the one its keystore names, or enroll a fresh one and keep its address after
 *  the document rests sealed. */
export async function standBrowserSecretHome(idbName: string, repo: Repo): Promise<SecretHome> {
  const held = await readKeystoreRow(idbName, SECRET_HOME_ROW);
  if (held !== undefined) {
    const address = held instanceof Uint8Array ? decodeSecretHomeAddress(held) : null;
    if (address === null) throw new SecretHomeUnavailable("the keystore's secret-home row reads malformed");
    return openSecretHome(repo, address);
  }
  const address = mintSecretHomeAddress();
  const home = await enrollSecretHome(repo, address);
  await repo.flush([home.handle.documentId]);
  await withCustodyRows(idbName, async (rows) => {
    const standing = await rows.read(SECRET_HOME_ROW);
    if (standing !== undefined) throw new SecretHomeUnavailable("another secret home's address landed first");
    await rows.write(SECRET_HOME_ROW, encodeSecretHomeAddress(address));
  });
  return home;
}
