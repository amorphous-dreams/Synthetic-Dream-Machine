/**
 * browser-custody-passkey — THE PASSKEY SLOT, NEVER THE SOLE COPY (browser-vessel-lift#/the-slices, slice 1b; the house's default
 * the operator may overrule: custody admits a PRF wrap that never stands as the only route).
 *
 * Each vector stands on a fresh, empty keystore over the engine's own IndexedDB.
 *
 *   BP1 RED      a first seal under a passkey alone refuses `passkey-alone-refused` and leaves the keystore clear; the boot's
 *                first-bind step refuses a passkey answer the same way.
 *   BP2 CONTROL  a passkey slot binds beside a standing passphrase slot: the PRF output alone then opens the tree, the
 *                passphrase still opens it, and the ceremony's reader names the pin's public half (credential id, PRF salt).
 *                A wrong PRF output opens nothing.
 */
import { describe, expect, test } from "vitest";
import {
  bindBrowserCustodySlot, lockBrowserCustody, readBrowserCustody, readBrowserCustodyPasskeys, sealBrowserKeystore, unlockBrowserCustody,
} from "../src/browser-custody.js";
import { standBrowserCustody } from "../src/browser-boot-custody.js";

const PASS = { kind: "passphrase", passphrase: "the hearth keeps its fire" } as const;
const credentialId = Uint8Array.of(3, 8, 13, 21, 34, 55);
const prfSalt = Uint8Array.from({ length: 32 }, (_, i) => 255 - i);
const prfOutput = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const PASSKEY = { kind: "passkey", credentialId, prfSalt, prfOutput } as const;
const fresh = (tag: string): string => `lares:passkey-${tag}-${crypto.randomUUID()}`;

describe("a passkey slot binds only beside a human route", () => {
  test("BP1 RED — a passkey alone refuses passkey-alone-refused, at the seal and at the boot's first bind, and the keystore stays clear", async () => {
    const idbName = fresh("alone");
    await expect(sealBrowserKeystore(idbName, PASSKEY)).rejects.toThrow(/passkey-alone-refused/);
    expect(await readBrowserCustody(idbName)).toEqual({ reading: "clear" });
    await expect(standBrowserCustody({ idbName, secretMintDue: true, ask: async () => ({ kind: "passkey", credentialId, prfOutput }) })).rejects.toThrow(/passkey-alone-refused/);
    expect(await readBrowserCustody(idbName)).toEqual({ reading: "clear" });
  });

  test("BP2 CONTROL — beside a passphrase slot the passkey binds and opens; the reader names its public half; a wrong output opens nothing", async () => {
    const idbName = fresh("beside");
    await sealBrowserKeystore(idbName, PASS);
    await bindBrowserCustodySlot(idbName, PASSKEY);
    const status = await readBrowserCustody(idbName);
    expect(status.reading === "sealed" ? status.slots.map((s) => s.kinds) : null).toEqual([["passphrase"], ["passkey"]]);
    const halves = await readBrowserCustodyPasskeys(idbName);
    expect(halves.map((h) => [[...h.credentialId], [...h.prfSalt]])).toEqual([[[...credentialId], [...prfSalt]]]);

    lockBrowserCustody(idbName);
    const wrong = prfOutput.slice(); wrong[0]! ^= 1;
    expect((await unlockBrowserCustody(idbName, [{ kind: "passkey", credentialId, prfOutput: wrong }])).reading).toBe("no-slot-opens");
    expect((await unlockBrowserCustody(idbName, [{ kind: "passkey", credentialId, prfOutput }])).reading).toBe("opens");
    lockBrowserCustody(idbName);
    expect((await unlockBrowserCustody(idbName, [PASS])).reading).toBe("opens");
  });
});
