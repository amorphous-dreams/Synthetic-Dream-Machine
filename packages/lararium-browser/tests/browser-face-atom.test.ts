/**
 * K15 step 2c, the browser half's first act — a browser vessel meets each face through that face's atom, and the
 * atom rests in the face's own custody row.
 *
 *   A1  the first ask for a face mints an atom seed and seals it in `face-atom/<PersonaGroup>`; the next ask
 *       answers the same key; the row holds 32 bytes and reads under the slot tree only.
 *   A2  two faces hold two atoms.
 *   A3  THE ISOLATION RED, mirrored from the mesh row: a thief holding the browser's device seed derives no atom
 *       and opens no group secret sealed to one. CONTROL: a secret sealed to the device key opens for the device
 *       seed, so the red bites.
 *   A4  a vessel with no slot mints no atom: a face's secret rows take a slot first.
 */
import { describe, expect, test } from "vitest";
import {
  deriveDyadVeil, groupSecretOpenerFromSeed, mintVeilTag, sealGroupSecret,
} from "@lararium/mesh";
import { bindSyntheticBrowserCustodySlot } from "./browser-custody-fixture.js";
import { BrowserCustodyRefused, readKeystoreRow } from "../src/browser-custody.js";
import { browserFaceAtom, faceAtomRow, readBrowserFaceAtom } from "../src/browser-face-atom.js";
import { generateOrLoadBrowserVesselIdentity, loadBrowserSigningSeed } from "../src/browser-vessel-identity.js";

const GROUP_A = "group-a";
const GROUP_B = "group-b";
const opSeed = new Uint8Array(32).fill(0x22);

async function vessel(): Promise<string> {
  const idbName = `face-atom-${crypto.randomUUID()}`;
  await bindSyntheticBrowserCustodySlot(idbName);
  return idbName;
}

describe("the browser's face atom", () => {
  test("A1 — the first ask mints and seals an atom; the next ask answers the same key; CONTROL: a face never asked reads none", async () => {
    const idbName = await vessel();
    expect(await readBrowserFaceAtom(idbName, GROUP_A), "CONTROL: nothing stands before the first ask").toBeUndefined();
    const first = await browserFaceAtom(idbName, GROUP_A);
    const again = await browserFaceAtom(idbName, GROUP_A);
    expect(again.key).toBe(first.key);
    expect(first.personaGroup).toBe(GROUP_A);
    const row = await readKeystoreRow(idbName, faceAtomRow(GROUP_A));
    expect(row).toBeInstanceOf(Uint8Array);
    expect((row as Uint8Array).length).toBe(32);
    expect((await readBrowserFaceAtom(idbName, GROUP_A))?.key).toBe(first.key);
  });

  test("A2 — two faces hold two atoms", async () => {
    const idbName = await vessel();
    const a = await browserFaceAtom(idbName, GROUP_A);
    const b = await browserFaceAtom(idbName, GROUP_B);
    expect(a.key).not.toBe(b.key);
  });

  test("A3 — isolation red: the device seed derives no atom and opens no group secret sealed to one; CONTROL: it opens one sealed to its own key", async () => {
    const idbName = await vessel();
    await generateOrLoadBrowserVesselIdentity(idbName, "face-atom fixture");
    const deviceSeed = await loadBrowserSigningSeed(idbName);
    const atom = await browserFaceAtom(idbName, GROUP_A);
    const seal = await sealGroupSecret({ opSeed, prefix: "prefix-a", deviceVerifyingKey: atom.key });
    expect(atom.opener.seal(seal)).not.toBeNull();

    const thief = groupSecretOpenerFromSeed(deviceSeed);
    expect(thief.seal(seal)).toBeNull();
    const veil = await deriveDyadVeil(deviceSeed, mintVeilTag());
    expect(veil.verifyingKey).not.toBe(atom.key);
    expect(thief.deviceKey).not.toBe(atom.key);
    expect(thief.seal({ ...seal, deviceKey: thief.deviceKey })).toBeNull();

    const own = await sealGroupSecret({ opSeed, prefix: "prefix-a", deviceVerifyingKey: thief.deviceKey });
    expect(thief.seal(own), "CONTROL: sealed to the device key, the device seed opens it").not.toBeNull();
  });

  test("A4 — a vessel with no slot mints no atom", async () => {
    const idbName = `face-atom-noslot-${crypto.randomUUID()}`;
    await expect(browserFaceAtom(idbName, GROUP_A)).rejects.toBeInstanceOf(BrowserCustodyRefused);
    expect(await readKeystoreRow(idbName, faceAtomRow(GROUP_A)), "the refused call left no row").toBeUndefined();
  });
});
