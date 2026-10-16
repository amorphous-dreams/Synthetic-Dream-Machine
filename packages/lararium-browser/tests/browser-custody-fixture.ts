import { readBrowserCustody, sealBrowserKeystore } from "../src/browser-custody.js";

/** Give a fresh test vessel a synthetic slot before its first persona-root mint. */
export async function bindSyntheticBrowserCustodySlot(idbName: string): Promise<void> {
  if ((await readBrowserCustody(idbName)).reading === "clear") {
    await sealBrowserKeystore(idbName, { kind: "passphrase", passphrase: "browser fixture custody slot" });
  }
}
