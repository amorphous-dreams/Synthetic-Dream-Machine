import { readBrowserCustody, sealBrowserKeystore } from "../src/browser-custody.js";

/** Give a fresh test vessel a synthetic slot before its first persona-root mint. */
export async function bindSyntheticBrowserCustodySlot(idbName: string): Promise<void> {
  if ((await readBrowserCustody(idbName)).reading === "clear") {
    await sealBrowserKeystore(idbName, { kind: "passphrase", passphrase: "browser fixture custody slot" });
  }
}

/** The ward route a test face is born under, and the dialog that answers it for one ward act (seat-harness#/the-ward). */
export const FIXTURE_WARD_PASSPHRASE = "browser fixture ward route";
export const FIXTURE_WARD = { kind: "passphrase", passphrase: FIXTURE_WARD_PASSPHRASE } as const;
export const fixtureWardDialog = async (_act: string): Promise<string> => FIXTURE_WARD_PASSPHRASE;
