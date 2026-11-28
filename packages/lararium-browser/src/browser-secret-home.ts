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
  decodeSecretHomeAddress,
  encodeSecretHomeAddress,
  enrollSecretHome,
  enrollVesselState,
  type SecretHomeAddress,
  mintSecretHomeAddress,
  mintVesselDocumentId,
  openSecretHome,
  SecretHomeUnavailable,
  type SecretHome,
} from "@lararium/mesh/secret-home";
import { readKeystoreRecord, withCustodyRecords } from "./browser-custody.js";

/** The keystore row the browser's secret home's address rests in. */
export const SECRET_HOME_RECORD = "secret-home";

/** Open the home this browser's keystore names; a browser that names none refuses by name, never mints. */
export async function openBrowserSecretHome(idbName: string, repo: Repo): Promise<SecretHome> {
  const held = await readKeystoreRecord(idbName, SECRET_HOME_RECORD);
  const address = held instanceof Uint8Array ? decodeSecretHomeAddress(held) : null;
  if (address === null) throw new SecretHomeUnavailable("this browser's keystore names no secret home");
  return ensureState(idbName, repo, address);
}

/** Stand the browser's secret home: open the one its keystore names, or enroll a fresh one and keep its address after
 *  the document rests sealed. */
export async function standBrowserSecretHome(idbName: string, repo: Repo): Promise<SecretHome & { readonly stateUrl: string | null }> {
  const held = await readKeystoreRecord(idbName, SECRET_HOME_RECORD);
  if (held !== undefined) {
    const address = held instanceof Uint8Array ? decodeSecretHomeAddress(held) : null;
    if (address === null) throw new SecretHomeUnavailable("the keystore's secret-home row reads malformed");
    return ensureState(idbName, repo, address);
  }
  // THE VESSEL STATE DOCUMENT MINTS BESIDE THE HOME (operator ruling A6): one row names both, one vessel key seals both.
  const address = { ...mintSecretHomeAddress(), stateId: mintVesselDocumentId() };
  const home = await enrollSecretHome(repo, address);
  await repo.flush([home.handle.documentId, ...(home.state ? [home.state.documentId] : [])]);
  await withCustodyRecords(idbName, async (rows) => {
    const standing = await rows.read(SECRET_HOME_RECORD);
    if (standing !== undefined) throw new SecretHomeUnavailable("another secret home's address landed first");
    await rows.write(SECRET_HOME_RECORD, encodeSecretHomeAddress(address));
  });
  return { ...home, stateUrl: `automerge:${address.stateId}` };
}

async function ensureState(idbName: string, repo: Repo, address: SecretHomeAddress): Promise<SecretHome & { readonly stateUrl: string }> {
  const home = await openSecretHome(repo, address);
  if (address.stateId) return { ...home, stateUrl: `automerge:${address.stateId}` };
  const stateId = mintVesselDocumentId();
  await enrollVesselState(repo, stateId);
  const named = await withCustodyRecords(idbName, async rows => {
    const bytes = await rows.read(SECRET_HOME_RECORD);
    const current = bytes instanceof Uint8Array ? decodeSecretHomeAddress(bytes) : null;
    if (!current || current.documentId !== address.documentId) throw new SecretHomeUnavailable("the secret home's custody changed while naming its registry");
    if (current.stateId) return current;
    const fresh = { ...current, stateId };
    await rows.write(SECRET_HOME_RECORD, encodeSecretHomeAddress(fresh));
    return fresh;
  });
  const opened = await openSecretHome(repo, named);
  return { ...opened, stateUrl: `automerge:${named.stateId}` };
}
