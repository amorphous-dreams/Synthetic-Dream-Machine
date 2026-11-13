import { signingSeedFromHex } from "@lararium/mesh";
import { readKeystoreRow } from "../src/browser-custody.js";

/** Test-only access to the place KEL seed for thief and custody vectors. */
export async function placeSeed(idbName: string): Promise<Uint8Array> {
  const key = await readKeystoreRow(idbName, "vessel-key") as { signingKey: string } | undefined;
  if (!key) throw new Error("test fixture: vessel-key absent");
  return signingSeedFromHex(key.signingKey);
}
